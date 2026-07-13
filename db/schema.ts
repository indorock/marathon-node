import type { DatabaseSync } from 'node:sqlite';

/**
 * Creates the schema if it doesn't exist yet. The .db file is gitignored, so a
 * freshly deployed instance starts with an empty database; every seed script
 * calls this first so seeding works from scratch with no manual migration.
 *
 * Uses CREATE TABLE IF NOT EXISTS, so it's a no-op on databases that already
 * have the tables. (It does NOT add columns to existing tables — see the
 * add-enabled-column migration for that case.)
 */
export function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_name TEXT NOT NULL,
      race_datetime TEXT NOT NULL,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS training_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      full_name TEXT,
      source_url TEXT,
      weekstarts TEXT NOT NULL DEFAULT 'mon',
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS training_weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      FOREIGN KEY (program_id) REFERENCES training_programs(id)
    );

    CREATE TABLE IF NOT EXISTS training_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      FOREIGN KEY (week_id) REFERENCES training_weeks(id)
    );

    CREATE TABLE IF NOT EXISTS training_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      FOREIGN KEY (program_id) REFERENCES training_programs(id)
    );
  `);
}
