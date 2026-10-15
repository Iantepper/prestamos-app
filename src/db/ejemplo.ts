// src/db/ejemplo.ts
// Datos de ejemplo para la demo y borrado de todos los datos.
import type { SQLiteDatabase } from 'expo-sqlite';

import { crearCliente } from '@/db/clientes';
import { registrarPago } from '@/db/pagos';
import { crearPrestamo, listarCuotas } from '@/db/prestamos';
import { hoyISO, sumarDias } from '@/utils/formato';
import { calcularMora } from '@/utils/mora';

export async function hayDatos(db: SQLiteDatabase): Promise<boolean> {
  const fila = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM clientes) + (SELECT COUNT(*) FROM prestamos) AS n'
  );
  return (fila?.n ?? 0) > 0;
}

// Crea 4 clientes, uno de cada perfil de riesgo, con préstamos en distintos estados:
//   Rosa (Cumplidor): un préstamo saldado y otro con dos cuotas pagas y una que vence hoy.
//   Jorge (Con atrasos): una cuota pagada tarde (con mora) y otra vencida hace 3 días.
//   Carlos (Riesgo): una cuota vencida hace unos 20 días.
//   Ana (Nuevo): un préstamo que empieza hoy, sin cuotas vencidas.
// Las fechas se calculan a partir de hoy, así la demo funciona cualquier día.
export async function cargarDatosDeEjemplo(db: SQLiteDatabase): Promise<void> {
  const hoy = hoyISO();
  const dia = (n: number) => sumarDias(hoy, n);

  const pagarCuota = async (prestamoId: number, numero: number, fecha: string, moraPct = 0) => {
    const cuota = (await listarCuotas(db, prestamoId)).find((q) => q.numero === numero);
    if (!cuota) return;
    const { recargo } = calcularMora(
      { monto: cuota.monto, fechaVencimiento: cuota.fecha_vencimiento },
      moraPct,
      fecha
    );
    await registrarPago(db, { cuotaId: cuota.id, fecha, monto: cuota.monto, mora: recargo });
  };

  const rosa = await crearCliente(db, {
    nombre: 'Rosa Fernández',
    telefono: '11 4567 8901',
    direccion: 'Av. Rivadavia 5200, CABA',
    notas: 'Paga siempre en efectivo',
  });
  const saldado = await crearPrestamo(db, rosa, {
    monto: 20000,
    tasaPct: 10,
    cantCuotas: 2,
    frecuencia: 'quincenal',
    fechaInicio: dia(-60),
  });
  await pagarCuota(saldado, 1, dia(-46));
  await pagarCuota(saldado, 2, dia(-32));
  const deRosa = await crearPrestamo(
    db,
    rosa,
    { monto: 30000, tasaPct: 20, cantCuotas: 4, frecuencia: 'semanal', fechaInicio: dia(-21) },
    1
  );
  await pagarCuota(deRosa, 1, dia(-14));
  await pagarCuota(deRosa, 2, dia(-8)); // pagó un día antes; la cuota 3 vence hoy

  const jorge = await crearCliente(db, {
    nombre: 'Jorge Medina',
    telefono: '11 2345 6789',
    direccion: 'Av. Corrientes 3400, CABA',
  });
  const deJorge = await crearPrestamo(
    db,
    jorge,
    { monto: 15000, tasaPct: 20, cantCuotas: 4, frecuencia: 'semanal', fechaInicio: dia(-17) },
    1
  );
  await pagarCuota(deJorge, 1, dia(-8), 1); // vencía hace 10 días y pagó 2 días tarde

  const carlos = await crearCliente(db, {
    nombre: 'Carlos Ruiz',
    telefono: '11 3456 7890',
    direccion: 'Av. San Martín 2100, CABA',
    notas: 'Llamar antes de ir',
  });
  await crearPrestamo(
    db,
    carlos,
    { monto: 50000, tasaPct: 30, cantCuotas: 3, frecuencia: 'mensual', fechaInicio: dia(-50) },
    0.5
  );

  const ana = await crearCliente(db, {
    nombre: 'Ana Gómez',
    direccion: 'Av. Cabildo 1500, CABA',
  });
  await crearPrestamo(db, ana, {
    monto: 10000,
    tasaPct: 15,
    cantCuotas: 4,
    frecuencia: 'semanal',
    fechaInicio: hoy,
  });
}

// Borra todos los clientes, préstamos, cuotas y pagos.
export async function borrarTodosLosDatos(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM pagos;
      DELETE FROM cuotas;
      DELETE FROM prestamos;
      DELETE FROM clientes;
      DELETE FROM sqlite_sequence WHERE name IN ('pagos', 'cuotas', 'prestamos', 'clientes');
    `);
  });
}
