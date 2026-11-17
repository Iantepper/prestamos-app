// src/db/pagos.ts
// Registro de pagos de cuotas.
import type { SQLiteDatabase } from 'expo-sqlite';

import { calcularMoraPendiente } from '@/utils/mora';
import { repartirPago, saldoTotal, type Aplicacion, type CuotaPendiente } from '@/utils/reparto';

export type PagoNuevo = {
  cuotaId: number;
  fecha: string; // 'YYYY-MM-DD'
  monto: number; // parte del pago que va a la cuota
  mora: number; // parte del pago que va al recargo por mora
};

// Guarda el pago, lo suma a la cuota (que queda pagada si se cubre su monto)
// y marca el préstamo como saldado cuando no le quedan cuotas pendientes.
export async function registrarPago(db: SQLiteDatabase, pago: PagoNuevo): Promise<void> {
  await db.withTransactionAsync(() => aplicarPago(db, pago));
}

// Lo mismo que registrarPago, sin abrir una transacción propia: para usarla dentro de otra.
async function aplicarPago(db: SQLiteDatabase, pago: PagoNuevo): Promise<void> {
  await db.runAsync('INSERT INTO pagos (cuota_id, fecha, monto, mora) VALUES (?, ?, ?, ?)', [
    pago.cuotaId,
    pago.fecha,
    pago.monto,
    pago.mora,
  ]);

  await db.runAsync(
    `UPDATE cuotas
        SET monto_pagado = ROUND(monto_pagado + ?, 2),
            estado = CASE WHEN ROUND(monto_pagado + ?, 2) >= monto THEN 'pagada' ELSE 'pendiente' END
      WHERE id = ?`,
    [pago.monto, pago.monto, pago.cuotaId]
  );

  await db.runAsync(
    `UPDATE prestamos
        SET estado = 'saldado'
      WHERE id = (SELECT prestamo_id FROM cuotas WHERE id = ?)
        AND NOT EXISTS (
          SELECT 1 FROM cuotas q WHERE q.prestamo_id = prestamos.id AND q.estado = 'pendiente'
        )`,
    [pago.cuotaId]
  );
}

// Cuotas pendientes de los préstamos activos de un cliente, de la más vieja a la más nueva,
// con lo que falta de cada una y su recargo por mora a la fecha dada.
export async function listarCuotasPendientesCliente(
  db: SQLiteDatabase,
  clienteId: number,
  fecha: string // 'YYYY-MM-DD'
): Promise<CuotaPendiente[]> {
  const filas = await db.getAllAsync<{
    id: number;
    numero: number;
    fecha_vencimiento: string;
    monto: number;
    monto_pagado: number;
    mora_pagada: number;
    mora_diaria_pct: number;
  }>(
    `SELECT q.id, q.numero, q.fecha_vencimiento, q.monto, q.monto_pagado, p.mora_diaria_pct,
            (SELECT COALESCE(SUM(g.mora), 0) FROM pagos g WHERE g.cuota_id = q.id) AS mora_pagada
       FROM cuotas q
       JOIN prestamos p ON p.id = q.prestamo_id
      WHERE p.cliente_id = ? AND p.estado = 'activo' AND q.estado = 'pendiente'
      ORDER BY q.fecha_vencimiento, p.id, q.numero`,
    [clienteId]
  );
  return filas.map((q) => ({
    id: q.id,
    numero: q.numero,
    falta: Math.round((q.monto - q.monto_pagado) * 100) / 100,
    recargo: calcularMoraPendiente(
      { monto: q.monto, fechaVencimiento: q.fecha_vencimiento, moraPagada: q.mora_pagada },
      q.mora_diaria_pct,
      fecha
    ).recargo,
  }));
}

// Registra un pago de un cliente repartiéndolo entre sus cuotas pendientes, de la más vieja a la
// más nueva (puede adelantar cuotas), todo en una transacción. No acepta más que lo que debe en
// total. Devuelve cómo se aplicó.
export async function registrarPagoCliente(
  db: SQLiteDatabase,
  clienteId: number,
  monto: number,
  fecha: string // 'YYYY-MM-DD'
): Promise<Aplicacion[]> {
  let aplicaciones: Aplicacion[] = [];
  await db.withTransactionAsync(async () => {
    const cuotas = await listarCuotasPendientesCliente(db, clienteId, fecha);
    if (!(monto > 0)) throw new Error('El monto tiene que ser mayor a 0');
    if (monto > saldoTotal(cuotas) + 0.005) throw new Error('El monto supera lo que debe');
    aplicaciones = repartirPago(cuotas, monto);
    for (const a of aplicaciones) {
      await aplicarPago(db, { cuotaId: a.cuotaId, fecha, monto: a.monto, mora: a.mora });
    }
  });
  return aplicaciones;
}
