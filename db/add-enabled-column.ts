/**
 * Migration: add a boolean `enabled` column to training_programs.
 *
 * Only enabled programs are listed in the workout dropdown (see the adapters'
 * getAllProgramNames). Existing programs default to enabled (1).
 *
 * Idempotent — safe to run repeatedly. Run with: npx tsx db/add-enabled-column.ts
 */

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'db', 'marathon.db');

function main(): void {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');

  const cols = db.prepare('PRAGMA table_info(training_programs)').all() as { name: string }[];
  const has = cols.some(c => c.name === 'enabled');

  if (has) {
    console.log('Column training_programs.enabled already exists — nothing to do.');
  } else {
    db.exec('ALTER TABLE training_programs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
    console.log('Added column training_programs.enabled (INTEGER NOT NULL DEFAULT 1).');
  }

  const rows = db.prepare('SELECT name, enabled FROM training_programs ORDER BY name').all() as { name: string; enabled: number }[];
  console.log('\nCurrent programs:');
  for (const r of rows) console.log(`  ${r.enabled ? '●' : '○'} ${r.name}${r.enabled ? '' : '  (hidden)'}`);
}

main();
