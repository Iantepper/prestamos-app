// src/db/riesgo.ts
// Perfil de riesgo de todos los clientes, calculado con sus pagos y cuotas vencidas.
import type { SQLiteDatabase } from 'expo-sqlite';

import { calcularPerfilRiesgo, type HistorialCliente, type NivelRiesgo } from '@/utils/riesgo';

// Devuelve el perfil de cada cliente, por id. Los clientes sin préstamos quedan como 'nuevo'.
export async function obtenerPerfilesRiesgo(
  db: SQLiteDatabase,
  hoy: string // 'YYYY-MM-DD'
): Promise<Map<number, NivelRiesgo>> {
  const [clientes, pagos, vencidas] = await Promise.all([
    db.getAllAsync<{ id: number }>('SELECT id FROM clientes'),
    db.getAllAsync<{ cliente_id: number; fecha: string; fecha_vencimiento: string }>(
      `SELECT p.cliente_id, g.fecha, q.fecha_vencimiento
         FROM pagos g
         JOIN cuotas q ON q.id = g.cuota_id
         JOIN prestamos p ON p.id = q.prestamo_id`
    ),
    db.getAllAsync<{ cliente_id: number; fecha_vencimiento: string }>(
      `SELECT p.cliente_id, q.fecha_vencimiento
         FROM cuotas q
         JOIN prestamos p ON p.id = q.prestamo_id
        WHERE q.estado = 'pendiente' AND q.fecha_vencimiento < ?`,
      [hoy]
    ),
  ]);

  const historiales = new Map<number, HistorialCliente>();
  for (const { id } of clientes) historiales.set(id, { pagos: [], vencimientosPendientes: [] });
  for (const pago of pagos) {
    historiales
      .get(pago.cliente_id)
      ?.pagos.push({ fecha: pago.fecha, fechaVencimiento: pago.fecha_vencimiento });
  }
  for (const cuota of vencidas) {
    historiales.get(cuota.cliente_id)?.vencimientosPendientes.push(cuota.fecha_vencimiento);
  }

  const perfiles = new Map<number, NivelRiesgo>();
  for (const [id, historial] of historiales) perfiles.set(id, calcularPerfilRiesgo(historial, hoy));
  return perfiles;
}
