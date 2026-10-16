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

// Cuántos préstamos activos y saldados tiene un cliente (para decidir si se puede eliminar).
export async function contarPrestamosDeCliente(
  db: SQLiteDatabase,
  clienteId: number
): Promise<{ activos: number; saldados: number }> {
  const fila = await db.getFirstAsync<{ activos: number; saldados: number }>(
    `SELECT COALESCE(SUM(estado = 'activo'), 0) AS activos,
            COALESCE(SUM(estado = 'saldado'), 0) AS saldados
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
      `DELETE FROM pagos WHERE cuota_id IN (
         SELECT q.id FROM cuotas q JOIN prestamos p ON p.id = q.prestamo_id WHERE p.cliente_id = ?
       )`,
      [clienteId]
    );
    await db.runAsync(
      'DELETE FROM cuotas WHERE prestamo_id IN (SELECT id FROM prestamos WHERE cliente_id = ?)',
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
