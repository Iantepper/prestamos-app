// src/db/agenda.ts
// Cuotas pendientes para la agenda de cobros.
import type { SQLiteDatabase } from 'expo-sqlite';

export type CobroPendiente = {
  cuota_id: number;
  numero: number;
  fecha_vencimiento: string; // 'YYYY-MM-DD'
  monto: number;
  monto_pagado: number;
  mora_pagada: number;
  mora_diaria_pct: number;
  cliente_nombre: string;
  telefono: string | null;
  direccion: string;
};

// Cuotas pendientes de préstamos activos que vencen hasta la fecha dada (incluye las atrasadas).
export async function listarCobrosPendientes(
  db: SQLiteDatabase,
  hasta: string // 'YYYY-MM-DD'
): Promise<CobroPendiente[]> {
  return db.getAllAsync<CobroPendiente>(
    `SELECT q.id AS cuota_id, q.numero, q.fecha_vencimiento, q.monto, q.monto_pagado,
            (SELECT COALESCE(SUM(g.mora), 0) FROM pagos g WHERE g.cuota_id = q.id) AS mora_pagada,
            p.mora_diaria_pct, c.nombre AS cliente_nombre, c.telefono, c.direccion
       FROM cuotas q
       JOIN prestamos p ON p.id = q.prestamo_id
       JOIN clientes c ON c.id = p.cliente_id
      WHERE q.estado = 'pendiente' AND p.estado = 'activo' AND q.fecha_vencimiento <= ?
      ORDER BY q.fecha_vencimiento, c.nombre COLLATE NOCASE`,
    [hasta]
  );
}

export type CobrosDelDia = {
  fecha: string; // 'YYYY-MM-DD'
  cantidad: number;
  monto: number; // lo que falta de las cuotas que vencen ese día (sin mora)
};

// Cantidad y monto de cuotas pendientes que vencen cada día entre dos fechas (inclusive).
export async function resumirCobrosPorDia(
  db: SQLiteDatabase,
  desde: string,
  hasta: string
): Promise<CobrosDelDia[]> {
  return db.getAllAsync<CobrosDelDia>(
    `SELECT q.fecha_vencimiento AS fecha, COUNT(*) AS cantidad,
            ROUND(SUM(q.monto - q.monto_pagado), 2) AS monto
       FROM cuotas q
       JOIN prestamos p ON p.id = q.prestamo_id
      WHERE q.estado = 'pendiente' AND p.estado = 'activo'
        AND q.fecha_vencimiento BETWEEN ? AND ?
      GROUP BY q.fecha_vencimiento
      ORDER BY q.fecha_vencimiento`,
    [desde, hasta]
  );
}
