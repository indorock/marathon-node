/**
 * Seeds the SQLite database from XML source files in ../../marathon/xml/
 * Run with: npm run seed:sqlite
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DOMParser } from '@xmldom/xmldom';
import { ensureSchema } from './schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XML_DIR   = path.join(__dirname, '../../marathon/xml');
const DB_PATH   = process.env.DB_PATH ?? path.join(process.cwd(), 'db', 'marathon.db');

function getText(node: Element | null | undefined): string {
  return node?.textContent?.trim() ?? '';
}

function parseXml(filePath: string): Document {
  const content = fs.readFileSync(filePath, 'utf8');
  return new DOMParser().parseFromString(content, 'text/xml') as unknown as Document;
}

function seedEvent(db: DatabaseSync): void {
  const doc   = parseXml(path.join(XML_DIR, 'site_data.xml'));
  const items = doc.getElementsByTagName('item');
  const data: Record<string, string> = {};
  for (let i = 0; i < items.length; i++) {
    data[items[i].getAttribute('name') ?? ''] = getText(items[i] as unknown as Element);
  }

  const existing = db.prepare('SELECT id FROM events LIMIT 1').get() as { id: number } | undefined;
  if (existing) {
    db.prepare('UPDATE events SET race_name=?, race_datetime=?, url=? WHERE id=?')
      .run(data.race_name, data.race_datetime, data.url, existing.id);
    console.log('Updated event:', data.race_name);
  } else {
    db.prepare('INSERT INTO events (race_name, race_datetime, url) VALUES (?, ?, ?)')
      .run(data.race_name, data.race_datetime, data.url);
    console.log('Inserted event:', data.race_name);
  }
}

function seedProgram(db: DatabaseSync, xmlFile: string): void {
  const name       = path.basename(xmlFile, '.xml');
  const doc        = parseXml(xmlFile);
  const aboutNode  = doc.getElementsByTagName('about')[0];
  const fullName   = getText(aboutNode.getElementsByTagName('name')[0] as unknown as Element);
  const sourceUrl  = getText(aboutNode.getElementsByTagName('url')[0] as unknown as Element);
  // NB: @xmldom/xmldom returns '' (not null) for a missing attribute, so use
  // `||` fallbacks rather than `??` throughout this parser.
  const weekstarts = aboutNode.getAttribute('weekstarts') || 'mon';

  // Update-or-insert (not INSERT OR REPLACE): keeps the row's id stable so the
  // existing child rows' foreign keys stay valid while we rebuild them, and
  // preserves columns we don't touch here (e.g. `enabled`).
  const existing = db.prepare('SELECT id FROM training_programs WHERE name = ?').get(name) as { id: number } | undefined;
  let programId: number;
  if (existing) {
    programId = existing.id;
    // Clear children first, while the FK references are still valid.
    for (const row of db.prepare('SELECT id FROM training_weeks WHERE program_id = ?').all(programId) as { id: number }[]) {
      db.prepare('DELETE FROM training_days WHERE week_id = ?').run(row.id);
    }
    db.prepare('DELETE FROM training_weeks WHERE program_id = ?').run(programId);
    db.prepare('DELETE FROM training_info WHERE program_id = ?').run(programId);
    db.prepare('UPDATE training_programs SET full_name = ?, source_url = ?, weekstarts = ? WHERE id = ?')
      .run(fullName, sourceUrl, weekstarts, programId);
  } else {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO training_programs (name, full_name, source_url, weekstarts) VALUES (?, ?, ?, ?)')
      .run(name, fullName, sourceUrl, weekstarts);
    programId = Number(lastInsertRowid);
  }

  const weekNodes = doc.getElementsByTagName('week');
  for (let w = 0; w < weekNodes.length; w++) {
    // XML source uses `num`; also tolerate `number`. Fall back to position.
    const rawNum     = weekNodes[w].getAttribute('num') || weekNodes[w].getAttribute('number');
    const parsedNum  = parseInt(rawNum || '', 10);
    const weekNum    = Number.isNaN(parsedNum) ? w + 1 : parsedNum;
    const { lastInsertRowid: weekId } = db.prepare('INSERT INTO training_weeks (program_id, week_number) VALUES (?, ?)').run(programId, weekNum);
    const dayNodes   = weekNodes[w].getElementsByTagName('day');
    for (let d = 0; d < dayNodes.length; d++) {
      db.prepare('INSERT INTO training_days (week_id, day_number, activity_type, description) VALUES (?, ?, ?, ?)')
        .run(weekId, d + 1, dayNodes[d].getAttribute('type') || 'rest', getText(dayNodes[d] as unknown as Element));
    }
  }

  const infoParent = doc.getElementsByTagName('info')[0];
  if (infoParent) {
    const items = infoParent.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      db.prepare('INSERT INTO training_info (program_id, activity_type, description) VALUES (?, ?, ?)')
        .run(programId, items[i].getAttribute('name') ?? '', getText(items[i] as unknown as Element));
    }
  }

  console.log(`Seeded program: ${name} (${weekNodes.length} weeks)`);
}

function seed(): void {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  ensureSchema(db);
  seedEvent(db);

  const programsDir = path.join(XML_DIR, 'programs');
  for (const file of fs.readdirSync(programsDir).filter(f => f.endsWith('.xml')).sort()) {
    seedProgram(db, path.join(programsDir, file));
  }

  console.log('\nSQLite seeding complete.');
}

seed();
