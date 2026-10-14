// src/db/database.ts
// Modelo de datos local (SQLite) para la app de préstamos.
// Se ejecuta una vez al abrir la app (ver SQLiteProvider en src/app/_layout.tsx).
import type { SQLiteDatabase } from 'expo-sqlite';

const VERSION_ACTUAL = 1;

export async function migrarDB(db: SQLiteDatabase) {
  // Las claves foráneas hay que activarlas en cada conexión.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = fila?.user_version ?? 0;
  if (version >= VERSION_ACTUAL) return;

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
      tasa_interes    REAL NOT NULL,           -- a definir en Fase 1 (total o por período)
      cant_cuotas     INTEGER NOT NULL,
      frecuencia      TEXT NOT NULL,           -- 'semanal' | 'quincenal' | 'mensual'
      fecha_inicio    TEXT NOT NULL,           -- 'YYYY-MM-DD'
      mora_diaria_pct REAL NOT NULL DEFAULT 0, -- % de recargo por día de atraso
      estado          TEXT NOT NULL DEFAULT 'activo'  -- 'activo' | 'saldado'
    );

    CREATE TABLE IF NOT EXISTS cuotas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      prestamo_id       INTEGER NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
      numero            INTEGER NOT NULL,
      fecha_vencimiento TEXT NOT NULL,         -- editable: ingresos irregulares
      monto             REAL NOT NULL,         -- editable por el prestamista
      monto_pagado      REAL NOT NULL DEFAULT 0,
      estado            TEXT NOT NULL DEFAULT 'pendiente'  -- 'pendiente' | 'pagada'
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

    PRAGMA user_version = ${VERSION_ACTUAL};
  `);
}
