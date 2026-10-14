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
