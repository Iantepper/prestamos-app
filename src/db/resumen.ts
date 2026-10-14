// src/db/resumen.ts
// Totales para la pantalla de resumen.
import type { SQLiteDatabase } from 'expo-sqlite';

export type Resumen = {
  total_prestado: number; // capital de los préstamos activos
  total_cobrado: number; // todo lo cobrado (cuotas y recargos por mora), de todos los préstamos
  mora_cobrada: number; // parte de lo cobrado que fue recargo por mora
  falta_cobrar: number; // lo que falta de las cuotas de préstamos activos (sin mora)
  prestamos_activos: number;
  prestamos_saldados: number;
};

export async function obtenerResumen(db: SQLiteDatabase): Promise<Resumen> {
  const fila = await db.getFirstAsync<Resumen>(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM prestamos WHERE estado = 'activo') AS total_prestado,
       (SELECT COALESCE(SUM(monto + mora), 0) FROM pagos) AS total_cobrado,
       (SELECT COALESCE(SUM(mora), 0) FROM pagos) AS mora_cobrada,
       (SELECT COALESCE(SUM(MAX(q.monto - q.monto_pagado, 0)), 0)
          FROM cuotas q JOIN prestamos p ON p.id = q.prestamo_id
         WHERE p.estado = 'activo') AS falta_cobrar,
       (SELECT COUNT(*) FROM prestamos WHERE estado = 'activo') AS prestamos_activos,
       (SELECT COUNT(*) FROM prestamos WHERE estado = 'saldado') AS prestamos_saldados`
  );
  return (
    fila ?? {
      total_prestado: 0,
      total_cobrado: 0,
      mora_cobrada: 0,
      falta_cobrar: 0,
      prestamos_activos: 0,
      prestamos_saldados: 0,
    }
  );
}
