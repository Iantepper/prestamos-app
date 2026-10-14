// src/db/prestamos.ts
// Consultas de las tablas prestamos y cuotas.
import type { SQLiteDatabase } from 'expo-sqlite';

import { calcularCuotas, type DatosPrestamo, type Frecuencia } from '@/utils/cuotas';

// Guarda el préstamo y todas sus cuotas en una sola transacción. Devuelve el id del préstamo.
export async function crearPrestamo(
  db: SQLiteDatabase,
  clienteId: number,
  datos: DatosPrestamo,
  moraDiariaPct = 0
): Promise<number> {
  const cuotas = calcularCuotas(datos);
  let prestamoId = 0;

  await db.withTransactionAsync(async () => {
    const resultado = await db.runAsync(
      `INSERT INTO prestamos
         (cliente_id, monto, tasa_interes, cant_cuotas, frecuencia, fecha_inicio, mora_diaria_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clienteId,
        datos.monto,
        datos.tasaPct,
        datos.cantCuotas,
        datos.frecuencia,
        datos.fechaInicio,
        moraDiariaPct,
      ]
    );
    prestamoId = resultado.lastInsertRowId;

    for (const cuota of cuotas) {
      await db.runAsync(
        'INSERT INTO cuotas (prestamo_id, numero, fecha_vencimiento, monto) VALUES (?, ?, ?, ?)',
        [prestamoId, cuota.numero, cuota.fechaVencimiento, cuota.monto]
      );
    }
  });

  return prestamoId;
}

export type PrestamoListado = {
  id: number;
  cliente_nombre: string;
  monto: number;
  cant_cuotas: number;
  cuotas_pagadas: number;
  cobrado: number; // suma de lo pagado de cada cuota (sin recargos por mora)
  falta_cobrar: number; // suma de lo que falta de cada cuota
  proximo_vencimiento: string | null; // 'YYYY-MM-DD'; null si no quedan cuotas pendientes
};

// Préstamos activos o saldados con el avance de sus cuotas.
// Primero los que vencen antes; los saldados, del más nuevo al más viejo.
export async function listarPrestamos(
  db: SQLiteDatabase,
  estado: 'activo' | 'saldado'
): Promise<PrestamoListado[]> {
  return db.getAllAsync<PrestamoListado>(
    `SELECT p.id, c.nombre AS cliente_nombre, p.monto, p.cant_cuotas,
            (SELECT COUNT(*) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pagada') AS cuotas_pagadas,
            (SELECT COALESCE(SUM(q.monto_pagado), 0) FROM cuotas q
              WHERE q.prestamo_id = p.id) AS cobrado,
            (SELECT COALESCE(SUM(MAX(q.monto - q.monto_pagado, 0)), 0) FROM cuotas q
              WHERE q.prestamo_id = p.id) AS falta_cobrar,
            (SELECT MIN(q.fecha_vencimiento) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pendiente') AS proximo_vencimiento
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE p.estado = ?
      ORDER BY proximo_vencimiento, p.id DESC`,
    [estado]
  );
}

export type PrestamoDetalle = {
  id: number;
  cliente_nombre: string;
  monto: number;
  tasa_interes: number;
  cant_cuotas: number;
  frecuencia: Frecuencia;
  fecha_inicio: string; // 'YYYY-MM-DD'
  mora_diaria_pct: number;
  estado: 'activo' | 'saldado';
};

export type Cuota = {
  id: number;
  numero: number;
  fecha_vencimiento: string; // 'YYYY-MM-DD'
  monto: number;
  monto_pagado: number;
  mora_pagada: number; // recargos por mora ya cobrados de esta cuota
  estado: 'pendiente' | 'pagada';
};

// Datos de un préstamo con el nombre de su cliente, o null si no existe.
export async function obtenerPrestamo(
  db: SQLiteDatabase,
  prestamoId: number
): Promise<PrestamoDetalle | null> {
  return db.getFirstAsync<PrestamoDetalle>(
    `SELECT p.id, c.nombre AS cliente_nombre, p.monto, p.tasa_interes, p.cant_cuotas,
            p.frecuencia, p.fecha_inicio, p.mora_diaria_pct, p.estado
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
