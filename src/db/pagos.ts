// src/db/pagos.ts
// Registro de pagos de cuotas.
import type { SQLiteDatabase } from 'expo-sqlite';

export type PagoNuevo = {
  cuotaId: number;
  fecha: string; // 'YYYY-MM-DD'
  monto: number; // parte del pago que va a la cuota
  mora: number; // parte del pago que va al recargo por mora
};

// Guarda el pago, lo suma a la cuota (que queda pagada si se cubre su monto)
// y marca el préstamo como saldado cuando no le quedan cuotas pendientes.
export async function registrarPago(db: SQLiteDatabase, pago: PagoNuevo): Promise<void> {
  await db.withTransactionAsync(async () => {
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
  });
}
