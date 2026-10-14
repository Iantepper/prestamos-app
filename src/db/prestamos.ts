// src/db/prestamos.ts
// Consultas de las tablas prestamos y cuotas.
import type { SQLiteDatabase } from 'expo-sqlite';

import { calcularCuotas, type DatosPrestamo } from '@/utils/cuotas';

// Guarda el préstamo y todas sus cuotas en una sola transacción. Devuelve el id del préstamo.
export async function crearPrestamo(
  db: SQLiteDatabase,
  clienteId: number,
  datos: DatosPrestamo
): Promise<number> {
  const cuotas = calcularCuotas(datos);
  let prestamoId = 0;

  await db.withTransactionAsync(async () => {
    const resultado = await db.runAsync(
      `INSERT INTO prestamos (cliente_id, monto, tasa_interes, cant_cuotas, frecuencia, fecha_inicio)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clienteId, datos.monto, datos.tasaPct, datos.cantCuotas, datos.frecuencia, datos.fechaInicio]
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

export type PrestamoActivo = {
  id: number;
  cliente_nombre: string;
  monto: number;
  cant_cuotas: number;
  cuotas_pagadas: number;
  proximo_vencimiento: string | null; // 'YYYY-MM-DD'; null si no quedan cuotas pendientes
};

// Préstamos activos con el avance de sus cuotas, primero los que vencen antes.
export async function listarPrestamosActivos(db: SQLiteDatabase): Promise<PrestamoActivo[]> {
  return db.getAllAsync<PrestamoActivo>(
    `SELECT p.id, c.nombre AS cliente_nombre, p.monto, p.cant_cuotas,
            (SELECT COUNT(*) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pagada') AS cuotas_pagadas,
            (SELECT MIN(q.fecha_vencimiento) FROM cuotas q
              WHERE q.prestamo_id = p.id AND q.estado = 'pendiente') AS proximo_vencimiento
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
      WHERE p.estado = 'activo'
      ORDER BY proximo_vencimiento, p.id`
  );
}
