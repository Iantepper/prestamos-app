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
