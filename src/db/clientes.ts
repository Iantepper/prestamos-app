// src/db/clientes.ts
// Consultas de la tabla clientes.
import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizarTexto } from '@/utils/busqueda';

export type ClienteNuevo = {
  nombre: string;
  telefono?: string;
  direccion: string;
  notas?: string;
};

// Guarda un cliente y devuelve su id. Los campos opcionales vacíos se guardan como NULL.
export async function crearCliente(db: SQLiteDatabase, cliente: ClienteNuevo): Promise<number> {
  const resultado = await db.runAsync(
    'INSERT INTO clientes (nombre, telefono, direccion, notas) VALUES (?, ?, ?, ?)',
    [
      cliente.nombre.trim(),
      cliente.telefono?.trim() || null,
      cliente.direccion.trim(),
      cliente.notas?.trim() || null,
    ]
  );
  return resultado.lastInsertRowId;
}

export type Cliente = {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string;
  notas: string | null;
};

// Indica si ya hay un cliente con el mismo nombre y la misma dirección. No distingue mayúsculas,
// acentos ni espacios de más ("Jose  perez" es igual a "José Pérez").
export async function existeClienteIgual(
  db: SQLiteDatabase,
  cliente: { nombre: string; direccion: string }
): Promise<boolean> {
  const filas = await db.getAllAsync<{ nombre: string; direccion: string }>(
    'SELECT nombre, direccion FROM clientes'
  );
  const nombre = normalizarTexto(cliente.nombre);
  const direccion = normalizarTexto(cliente.direccion);
  return filas.some(
    (fila) =>
      normalizarTexto(fila.nombre) === nombre && normalizarTexto(fila.direccion) === direccion
  );
}

export type DeudaCliente = {
  debe: number; // lo que falta de todas sus cuotas pendientes (sin mora)
  vencido: number; // la parte de eso que ya venció (cuotas con fecha anterior a hoy)
};

// Deuda de cada cliente con préstamo activo, por id. Los clientes sin préstamo activo no aparecen.
export async function obtenerDeudasClientes(
  db: SQLiteDatabase,
  hoy: string // 'YYYY-MM-DD'
): Promise<Map<number, DeudaCliente>> {
  const filas = await db.getAllAsync<{ cliente_id: number; debe: number; vencido: number }>(
    `SELECT p.cliente_id,
            COALESCE(SUM(MAX(q.monto - q.monto_pagado, 0)), 0) AS debe,
            COALESCE(SUM(CASE WHEN q.fecha_vencimiento < ? THEN MAX(q.monto - q.monto_pagado, 0)
                              ELSE 0 END), 0) AS vencido
       FROM prestamos p
       JOIN cuotas q ON q.prestamo_id = p.id AND q.estado = 'pendiente'
      WHERE p.estado = 'activo'
      GROUP BY p.cliente_id`,
    [hoy]
  );
  return new Map(filas.map((f) => [f.cliente_id, { debe: f.debe, vencido: f.vencido }]));
}

// Devuelve todos los clientes ordenados por nombre.
export async function listarClientes(db: SQLiteDatabase): Promise<Cliente[]> {
  return db.getAllAsync<Cliente>(
    'SELECT id, nombre, telefono, direccion, notas FROM clientes ORDER BY nombre COLLATE NOCASE'
  );
}

// Cuántos préstamos activos y saldados tiene un cliente (para decidir si se puede eliminar).
export async function contarPrestamosDeCliente(
  db: SQLiteDatabase,
  clienteId: number
): Promise<{ activos: number; saldados: number }> {
  const fila = await db.getFirstAsync<{ activos: number; saldados: number }>(
    `SELECT COALESCE(SUM(estado = 'activo'), 0) AS activos,
            COALESCE(SUM(estado IN ('saldado', 'renovado')), 0) AS saldados
       FROM prestamos
      WHERE cliente_id = ?`,
    [clienteId]
  );
  return fila ?? { activos: 0, saldados: 0 };
}

// Elimina un cliente junto con sus préstamos saldados, cuotas y pagos, en una sola transacción.
// No hace nada si el cliente tiene préstamos activos: devuelve false.
export async function eliminarCliente(db: SQLiteDatabase, clienteId: number): Promise<boolean> {
  let eliminado = false;
  await db.withTransactionAsync(async () => {
    const { activos } = await contarPrestamosDeCliente(db, clienteId);
    if (activos > 0) return;
    await db.runAsync(
      `DELETE FROM cuota_adicionales WHERE cuota_id IN (
         SELECT q.id FROM cuotas q JOIN prestamos p ON p.id = q.prestamo_id WHERE p.cliente_id = ?
       )`,
      [clienteId]
    );
    await db.runAsync(
      `DELETE FROM pagos WHERE cuota_id IN (
         SELECT q.id FROM cuotas q JOIN prestamos p ON p.id = q.prestamo_id WHERE p.cliente_id = ?
       )`,
      [clienteId]
    );
    await db.runAsync(
      'DELETE FROM cuotas WHERE prestamo_id IN (SELECT id FROM prestamos WHERE cliente_id = ?)',
      [clienteId]
    );
    await db.runAsync(
      'DELETE FROM renovaciones WHERE prestamo_id IN (SELECT id FROM prestamos WHERE cliente_id = ?)',
      [clienteId]
    );
    await db.runAsync('DELETE FROM prestamos WHERE cliente_id = ?', [clienteId]);
    await db.runAsync('DELETE FROM clientes WHERE id = ?', [clienteId]);
    eliminado = true;
  });
  return eliminado;
}

// Cambia los datos de un cliente. Los campos opcionales vacíos se guardan como NULL.
export async function actualizarCliente(
  db: SQLiteDatabase,
  clienteId: number,
  cliente: ClienteNuevo
): Promise<void> {
  await db.runAsync(
    'UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?, notas = ? WHERE id = ?',
    [
      cliente.nombre.trim(),
      cliente.telefono?.trim() || null,
      cliente.direccion.trim(),
      cliente.notas?.trim() || null,
      clienteId,
    ]
  );
}
