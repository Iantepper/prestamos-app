// src/db/prestamos.ts
// Consultas de las tablas prestamos y cuotas.
import type { SQLiteDatabase } from 'expo-sqlite';

import { calcularCuotas, type DatosPrestamo, type Frecuencia } from '@/utils/cuotas';
import {
  calcularDescuento,
  calcularSuma,
  ErrorRenovacion,
  type CuotaActual,
  type NuevoCredito,
} from '@/utils/renovacion';

// Error de crearPrestamo cuando el cliente ya tiene un préstamo activo.
export class ClienteConPrestamoActivoError extends Error {
  constructor() {
    super('El cliente ya tiene un préstamo activo');
    this.name = 'ClienteConPrestamoActivoError';
  }
}

// Préstamo activo de cada cliente que tiene uno: id del cliente -> id del préstamo (cada cliente
// puede tener uno solo; los renovados no cuentan).
export async function clientesConPrestamoActivo(db: SQLiteDatabase): Promise<Map<number, number>> {
  const filas = await db.getAllAsync<{ cliente_id: number; prestamo_id: number }>(
    "SELECT cliente_id, MAX(id) AS prestamo_id FROM prestamos WHERE estado = 'activo' GROUP BY cliente_id"
  );
  return new Map(filas.map((f) => [f.cliente_id, f.prestamo_id]));
}

// Guarda el préstamo y todas sus cuotas en una sola transacción. Devuelve el id del préstamo.
// Cada cliente puede tener un solo préstamo activo: si ya tiene uno, no guarda nada y lanza
// ClienteConPrestamoActivoError.
export async function crearPrestamo(
  db: SQLiteDatabase,
  clienteId: number,
  datos: DatosPrestamo,
  moraDiariaPct = 0
): Promise<number> {
  let prestamoId = 0;
  await db.withTransactionAsync(async () => {
    const activos = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM prestamos WHERE cliente_id = ? AND estado = 'activo'",
      [clienteId]
    );
    if ((activos?.n ?? 0) > 0) throw new ClienteConPrestamoActivoError();
    prestamoId = await insertarPrestamo(db, clienteId, datos, moraDiariaPct, null);
  });
  return prestamoId;
}

// Inserta el préstamo y sus cuotas, sin abrir una transacción propia (para usar dentro de otra).
async function insertarPrestamo(
  db: SQLiteDatabase,
  clienteId: number,
  datos: DatosPrestamo,
  moraDiariaPct: number,
  renuevaA: number | null
): Promise<number> {
  const resultado = await db.runAsync(
    `INSERT INTO prestamos
       (cliente_id, monto, tasa_interes, cant_cuotas, frecuencia, fecha_inicio, mora_diaria_pct,
        renueva_a)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      datos.monto,
      datos.tasaPct,
      datos.cantCuotas,
      datos.frecuencia,
      datos.fechaInicio,
      moraDiariaPct,
      renuevaA,
    ]
  );
  const prestamoId = resultado.lastInsertRowId;
  for (const cuota of calcularCuotas(datos)) {
    await db.runAsync(
      'INSERT INTO cuotas (prestamo_id, numero, fecha_vencimiento, monto) VALUES (?, ?, ?, ?)',
      [prestamoId, cuota.numero, cuota.fechaVencimiento, cuota.monto]
    );
  }
  return prestamoId;
}

export type OpcionesRenovacion =
  | (NuevoCredito & { modo: 'descuento'; frecuencia: Frecuencia; fechaInicio: string })
  | (NuevoCredito & { modo: 'sumar' });

// Cuotas de un préstamo en la forma que usan los cálculos de renovación.
export async function cuotasParaRenovar(
  db: SQLiteDatabase,
  prestamoId: number
): Promise<CuotaActual[]> {
  const filas = await db.getAllAsync<{
    id: number;
    numero: number;
    fecha_vencimiento: string;
    monto: number;
    monto_pagado: number;
    estado: CuotaActual['estado'];
  }>(
    'SELECT id, numero, fecha_vencimiento, monto, monto_pagado, estado FROM cuotas WHERE prestamo_id = ?',
    [prestamoId]
  );
  return filas.map((q) => ({
    id: q.id,
    numero: q.numero,
    fechaVencimiento: q.fecha_vencimiento,
    monto: q.monto,
    montoPagado: q.monto_pagado,
    estado: q.estado,
  }));
}

// Renueva un préstamo activo, todo en una transacción (las reglas están en src/utils/renovacion.ts).
//   descuento: el préstamo pasa a 'renovado', sus cuotas pendientes a 'cancelada', y se crea uno
//              nuevo de X (con renueva_a y sus cuotas, sin mora).
//   sumar:     se agrandan las cuotas pendientes, se agregan las que sobran y se actualizan
//              cant_cuotas y monto (capital total: suma solo lo entregado, porque la deuda ya
//              estaba en el monto del préstamo).
// En los dos casos se anota la renovación en la tabla renovaciones (monto_nuevo = X y
// entregado = X − deuda), con el préstamo que queda vigente. Devuelve el id de ese préstamo. Si los
// datos no sirven, lanza ErrorRenovacion.
export async function renovarPrestamo(
  db: SQLiteDatabase,
  prestamoId: number,
  opciones: OpcionesRenovacion,
  fecha: string // 'YYYY-MM-DD'
): Promise<number> {
  let vigente = prestamoId;
  await db.withTransactionAsync(async () => {
    const prestamo = await db.getFirstAsync<{
      cliente_id: number;
      estado: string;
      frecuencia: Frecuencia;
    }>('SELECT cliente_id, estado, frecuencia FROM prestamos WHERE id = ?', [prestamoId]);
    if (!prestamo || prestamo.estado !== 'activo') {
      throw new ErrorRenovacion('Solo se puede renovar un préstamo activo');
    }
    const cuotas = await cuotasParaRenovar(db, prestamoId);

    if (opciones.modo === 'descuento') {
      const r = calcularDescuento(cuotas, opciones);
      await db.runAsync("UPDATE prestamos SET estado = 'renovado' WHERE id = ?", [prestamoId]);
      await db.runAsync(
        "UPDATE cuotas SET estado = 'cancelada' WHERE prestamo_id = ? AND estado = 'pendiente'",
        [prestamoId]
      );
      vigente = await insertarPrestamo(
        db,
        prestamo.cliente_id,
        {
          monto: opciones.montoNuevo,
          tasaPct: opciones.tasaPct,
          cantCuotas: opciones.cantCuotas,
          frecuencia: opciones.frecuencia,
          fechaInicio: opciones.fechaInicio,
        },
        0,
        prestamoId
      );
      await anotarRenovacion(
        db,
        vigente,
        fecha,
        'descuento',
        r.deuda,
        opciones.montoNuevo,
        r.entregado
      );
    } else {
      const r = calcularSuma(cuotas, prestamo.frecuencia, opciones);
      for (const q of r.modificadas) {
        await db.runAsync('UPDATE cuotas SET monto = ? WHERE id = ?', [q.monto, q.id]);
      }
      for (const q of r.agregadas) {
        await db.runAsync(
          'INSERT INTO cuotas (prestamo_id, numero, fecha_vencimiento, monto) VALUES (?, ?, ?, ?)',
          [prestamoId, q.numero, q.fechaVencimiento, q.monto]
        );
      }
      await db.runAsync(
        'UPDATE prestamos SET cant_cuotas = cant_cuotas + ?, monto = ROUND(monto + ?, 2) WHERE id = ?',
        [r.agregadas.length, r.entregado, prestamoId]
      );
      await anotarRenovacion(
        db,
        prestamoId,
        fecha,
        'sumar',
        r.deuda,
        opciones.montoNuevo,
        r.entregado
      );
    }
  });
  return vigente;
}

async function anotarRenovacion(
  db: SQLiteDatabase,
  prestamoId: number,
  fecha: string,
  modo: 'descuento' | 'sumar',
  deudaAnterior: number,
  montoNuevo: number,
  entregado: number
) {
  await db.runAsync(
    `INSERT INTO renovaciones (prestamo_id, fecha, modo, deuda_anterior, monto_nuevo, entregado)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [prestamoId, fecha, modo, deudaAnterior, montoNuevo, entregado]
  );
}

export type PrestamoListado = {
  id: number;
  cliente_nombre: string;
  monto: number;
  cant_cuotas: number;
  cuotas_pagadas: number;
  cobrado: number; // suma de lo pagado de cada cuota (sin recargos por mora)
  falta_cobrar: number; // suma de lo que falta de cada cuota pendiente
  proximo_vencimiento: string | null; // 'YYYY-MM-DD'; null si no quedan cuotas pendientes
  estado: 'activo' | 'saldado' | 'renovado';
};

// Préstamos activos o cerrados con el avance de sus cuotas. "saldado" trae también los renovados
// (cerrados por una renovación), para que sigan a la vista. Primero los que vencen antes; los
// cerrados, del más nuevo al más viejo.
export async function listarPrestamos(
  db: SQLiteDatabase,
  estado: 'activo' | 'saldado'
): Promise<PrestamoListado[]> {
  return db.getAllAsync<PrestamoListado>(
    `SELECT p.id, c.nombre AS cliente_nombre, p.monto, p.cant_cuotas, p.estado,
            (SELECT COUNT(*) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pagada') AS cuotas_pagadas,
            (SELECT COALESCE(SUM(q.monto_pagado), 0) FROM cuotas q
              WHERE q.prestamo_id = p.id) AS cobrado,
            (SELECT COALESCE(SUM(MAX(q.monto - q.monto_pagado, 0)), 0) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pendiente') AS falta_cobrar,
            (SELECT MIN(q.fecha_vencimiento) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pendiente') AS proximo_vencimiento
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE (? = 'activo' AND p.estado = 'activo')
         OR (? = 'saldado' AND p.estado IN ('saldado', 'renovado'))
      ORDER BY proximo_vencimiento, p.id DESC`,
    [estado, estado]
  );
}

export type PrestamoDetalle = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  monto: number;
  tasa_interes: number;
  cant_cuotas: number;
  frecuencia: Frecuencia;
  fecha_inicio: string; // 'YYYY-MM-DD'
  mora_diaria_pct: number;
  estado: 'activo' | 'saldado' | 'renovado';
  renueva_a: number | null; // préstamo anterior, si este salió de una renovación con descuento
  renovado_el: string | null; // 'YYYY-MM-DD' de la última renovación que lo involucra
  renovado_por: number | null; // préstamo nuevo que lo reemplazó, si este quedó 'renovado'
};

export type Cuota = {
  id: number;
  numero: number;
  fecha_vencimiento: string; // 'YYYY-MM-DD'
  monto: number;
  monto_pagado: number;
  mora_pagada: number; // recargos por mora ya cobrados de esta cuota
  estado: 'pendiente' | 'pagada' | 'cancelada'; // cancelada: pasó a un préstamo nuevo al renovar
};

// Datos de un préstamo con el nombre de su cliente, o null si no existe.
export async function obtenerPrestamo(
  db: SQLiteDatabase,
  prestamoId: number
): Promise<PrestamoDetalle | null> {
  return db.getFirstAsync<PrestamoDetalle>(
    `SELECT p.id, p.cliente_id, c.nombre AS cliente_nombre, p.monto, p.tasa_interes, p.cant_cuotas,
            p.frecuencia, p.fecha_inicio, p.mora_diaria_pct, p.estado, p.renueva_a,
            (SELECT MAX(r.fecha) FROM renovaciones r JOIN prestamos n ON n.id = r.prestamo_id
              WHERE r.prestamo_id = p.id OR n.renueva_a = p.id) AS renovado_el,
            (SELECT MAX(n.id) FROM prestamos n WHERE n.renueva_a = p.id) AS renovado_por
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = ?`,
    [prestamoId]
  );
}

export async function listarCuotas(db: SQLiteDatabase, prestamoId: number): Promise<Cuota[]> {
  return db.getAllAsync<Cuota>(
    `SELECT q.id, q.numero, q.fecha_vencimiento, q.monto, q.monto_pagado, q.estado,
            (SELECT COALESCE(SUM(g.mora), 0) FROM pagos g WHERE g.cuota_id = q.id) AS mora_pagada
       FROM cuotas q
      WHERE q.prestamo_id = ?
      ORDER BY numero`,
    [prestamoId]
  );
}

// Cambia la fecha de vencimiento y el monto de una cuota. Las cuotas pagadas no se modifican.
export async function actualizarCuota(
  db: SQLiteDatabase,
  cuotaId: number,
  cambios: { fechaVencimiento: string; monto: number }
): Promise<void> {
  await db.runAsync(
    `UPDATE cuotas SET fecha_vencimiento = ?, monto = ? WHERE id = ? AND estado = 'pendiente'`,
    [cambios.fechaVencimiento, cambios.monto, cuotaId]
  );
}

// Borra un préstamo y sus cuotas, solo si está activo, no tiene pagos registrados y no participó
// de una renovación. Devuelve false (y no borra nada) si no se puede.
export async function eliminarPrestamoSinPagos(
  db: SQLiteDatabase,
  prestamoId: number
): Promise<boolean> {
  let eliminado = false;
  await db.withTransactionAsync(async () => {
    const fila = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM pagos g JOIN cuotas q ON q.id = g.cuota_id WHERE q.prestamo_id = ?`,
      [prestamoId]
    );
    if ((fila?.n ?? 0) > 0) return;
    const renovacion = await db.getFirstAsync<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM prestamos WHERE id = ? AND (estado <> 'activo' OR renueva_a IS NOT NULL))
            + (SELECT COUNT(*) FROM renovaciones WHERE prestamo_id = ?) AS n`,
      [prestamoId, prestamoId]
    );
    if ((renovacion?.n ?? 0) > 0) return;
    await db.runAsync('DELETE FROM cuotas WHERE prestamo_id = ?', [prestamoId]);
    await db.runAsync('DELETE FROM prestamos WHERE id = ?', [prestamoId]);
    eliminado = true;
  });
  return eliminado;
}
