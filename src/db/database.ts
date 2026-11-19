// src/db/database.ts
// Modelo de datos local (SQLite) para la app de préstamos.
// Se ejecuta una vez al abrir la app (ver SQLiteProvider en src/app/_layout.tsx).
// Cada versión se aplica una sola vez, en orden, y deja anotado su número en PRAGMA user_version.
import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrarDB(db: SQLiteDatabase) {
  // Las claves foráneas hay que activarlas en cada conexión.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = fila?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS clientes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre     TEXT NOT NULL,
        telefono   TEXT,
        direccion  TEXT NOT NULL,   -- se usa para abrir Maps
        notas      TEXT
      );

      CREATE TABLE IF NOT EXISTS prestamos (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
        monto           REAL NOT NULL,           -- capital prestado
        tasa_interes    REAL NOT NULL,           -- interés total en %, sobre el monto
        cant_cuotas     INTEGER NOT NULL,
        frecuencia      TEXT NOT NULL,           -- 'semanal' | 'quincenal' | 'mensual'
        fecha_inicio    TEXT NOT NULL,           -- 'YYYY-MM-DD'
        mora_diaria_pct REAL NOT NULL DEFAULT 0, -- % de recargo por día de atraso
        estado          TEXT NOT NULL DEFAULT 'activo'  -- 'activo' | 'saldado' | 'renovado' (v2)
      );

      CREATE TABLE IF NOT EXISTS cuotas (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        prestamo_id       INTEGER NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
        numero            INTEGER NOT NULL,
        fecha_vencimiento TEXT NOT NULL,         -- editable: ingresos irregulares
        monto             REAL NOT NULL,         -- editable por el prestamista
        monto_pagado      REAL NOT NULL DEFAULT 0,
        estado            TEXT NOT NULL DEFAULT 'pendiente'  -- 'pendiente' | 'pagada' | 'cancelada' (v2)
      );

      CREATE TABLE IF NOT EXISTS pagos (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        cuota_id  INTEGER NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
        fecha     TEXT NOT NULL,
        monto     REAL NOT NULL,
        mora      REAL NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_cuotas_venc ON cuotas(fecha_vencimiento, estado);
      CREATE INDEX IF NOT EXISTS idx_prestamos_cliente ON prestamos(cliente_id);

      PRAGMA user_version = 1;
    `);
  }

  // Versión 2: renovación de préstamos.
  // Los estados son texto sin CHECK, así que 'renovado' (préstamos) y 'cancelada' (cuotas) no
  // necesitan cambiar las tablas: solo se agregan la columna renueva_a y la tabla renovaciones.
  if (version < 2) {
    await db.execAsync(`
      ALTER TABLE prestamos ADD COLUMN renueva_a INTEGER REFERENCES prestamos(id);  -- préstamo anterior

      CREATE TABLE IF NOT EXISTS renovaciones (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        prestamo_id    INTEGER NOT NULL REFERENCES prestamos(id),  -- el préstamo que queda vigente
        fecha          TEXT NOT NULL,                              -- 'YYYY-MM-DD'
        modo           TEXT NOT NULL,                              -- 'descuento' | 'sumar'
        deuda_anterior REAL NOT NULL,
        monto_nuevo    REAL NOT NULL,
        entregado      REAL NOT NULL
      );

      PRAGMA user_version = 2;
    `);
  }

  // Versión 3: cada cuota recuerda qué parte de su monto vino de cada renovación. Lo que no figura
  // acá es del crédito original, así que las cuotas anteriores quedan enteras como originales.
  if (version < 3) {
    await db.execAsync(`
      ALTER TABLE renovaciones ADD COLUMN tasa_interes REAL;  -- interés total en %; NULL si es vieja

      CREATE TABLE IF NOT EXISTS cuota_adicionales (
        cuota_id      INTEGER NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
        renovacion_id INTEGER NOT NULL REFERENCES renovaciones(id) ON DELETE CASCADE,
        monto         REAL NOT NULL,
        PRIMARY KEY (cuota_id, renovacion_id)
      );

      PRAGMA user_version = 3;
    `);
  }
}
