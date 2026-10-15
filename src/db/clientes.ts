// src/db/clientes.ts
// Consultas de la tabla clientes.
import type { SQLiteDatabase } from 'expo-sqlite';

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

// Devuelve todos los clientes ordenados por nombre.
export async function listarClientes(db: SQLiteDatabase): Promise<Cliente[]> {
  return db.getAllAsync<Cliente>(
    'SELECT id, nombre, telefono, direccion, notas FROM clientes ORDER BY nombre COLLATE NOCASE'
  );
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
