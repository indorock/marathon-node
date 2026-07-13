/**
 * Seeds the MongoDB database from XML source files in ../../marathon/xml/
 * Collections: events, training_programs, activity_types, training_schedules
 * Run with: npm run seed:mongo
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { DOMParser } from '@xmldom/xmldom';
import type { WeekRecord } from './adapters/interface';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const XML_DIR    = path.join(__dirname, '../../marathon/xml');
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const DB_NAME    = process.env.MONGODB_DB   ?? 'marathon';

function getText(node: Element | null | undefined): string {
  return node?.textContent?.trim() ?? '';
}

function parseXml(filePath: string): Document {
  const content = fs.readFileSync(filePath, 'utf8');
  return new DOMParser().parseFromString(content, 'text/xml') as unknown as Document;
}

async function seed(): Promise<void> {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // ── Indexes ──────────────────────────────────────────────────────────────
  await db.collection('training_programs').createIndex({ name: 1 }, { unique: true });
  await db.collection('activity_types').createIndex({ type: 1 }, { unique: true });
  await db.collection('training_schedules').createIndex({ program_name: 1 }, { unique: true });

  // ── Event ─────────────────────────────────────────────────────────────────
  const siteDoc = parseXml(path.join(XML_DIR, 'site_data.xml'));
  const siteItems = siteDoc.getElementsByTagName('item');
  const eventData: Record<string, string> = {};
  for (let i = 0; i < siteItems.length; i++) {
    eventData[siteItems[i].getAttribute('name') ?? ''] = getText(siteItems[i] as unknown as Element);
  }
  await db.collection('events').updateOne(
    {},
    { $set: { race_name: eventData.race_name, race_datetime: eventData.race_datetime, url: eventData.url } },
    { upsert: true },
  );
  console.log('Upserted event:', eventData.race_name);

  // ── Programs ──────────────────────────────────────────────────────────────
  const programsDir = path.join(XML_DIR, 'programs');
  const files = fs.readdirSync(programsDir).filter(f => f.endsWith('.xml')).sort();

  for (const file of files) {
    const name      = path.basename(file, '.xml');
    const doc       = parseXml(path.join(programsDir, file));
    const aboutNode = doc.getElementsByTagName('about')[0];
    const fullName  = getText(aboutNode.getElementsByTagName('name')[0] as unknown as Element);
    const sourceUrl = getText(aboutNode.getElementsByTagName('url')[0] as unknown as Element);
    const weekstarts = aboutNode.getAttribute('weekstarts') ?? 'mon';

    // training_programs
    await db.collection('training_programs').updateOne(
      { name },
      { $set: { name, full_name: fullName, source_url: sourceUrl, weekstarts } },
      { upsert: true },
    );

    // training_schedules — embedded weeks + days
    const weekNodes = doc.getElementsByTagName('week');
    const weeks: WeekRecord[] = [];
    for (let w = 0; w < weekNodes.length; w++) {
      const weekNum  = parseInt(weekNodes[w].getAttribute('number') ?? String(w + 1), 10);
      const dayNodes = weekNodes[w].getElementsByTagName('day');
      const days = Array.from({ length: dayNodes.length }, (_, d) => ({
        day_number:    d + 1,
        activity_type: dayNodes[d].getAttribute('type') ?? 'rest',
        description:   getText(dayNodes[d] as unknown as Element),
      }));
      weeks.push({ week_number: weekNum, days });
    }
    await db.collection('training_schedules').updateOne(
      { program_name: name },
      { $set: { program_name: name, weeks } },
      { upsert: true },
    );

    // activity_types — global, unique per type (last write wins on conflict)
    const infoParent = doc.getElementsByTagName('info')[0];
    if (infoParent) {
      const items = infoParent.getElementsByTagName('item');
      for (let i = 0; i < items.length; i++) {
        const type        = items[i].getAttribute('name') ?? '';
        const description = getText(items[i] as unknown as Element);
        await db.collection('activity_types').updateOne(
          { type },
          { $set: { type, description } },
          { upsert: true },
        );
      }
    }

    console.log(`Seeded program: ${name} (${weekNodes.length} weeks)`);
  }

  await client.close();
  console.log('\nMongoDB seeding complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
