import { MongoClient, type Db } from 'mongodb';
import type { DbAdapter, EventRecord, ProgramRecord, WeekRecord, ActivityTypeRecord } from './interface';

// ── MongoDB document shapes ────────────────────────────────────────────────

interface ProgramDoc {
  name: string;
  full_name: string;
  source_url: string;
  weekstarts: string;
  enabled?: boolean;
}

interface ActivityTypeDoc {
  type: string;
  description: string;
}

interface TrainingScheduleDoc {
  program_name: string;
  weeks: WeekRecord[];
}

interface EventDoc {
  race_name: string;
  race_datetime: string;
  url: string;
}

// ── Adapter ────────────────────────────────────────────────────────────────

export class MongoAdapter implements DbAdapter {
  private constructor(
    private readonly db: Db,
    private readonly client: MongoClient,
  ) {}

  static async connect(uri: string, dbName = 'marathon'): Promise<MongoAdapter> {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    await MongoAdapter.ensureIndexes(db);
    return new MongoAdapter(db, client);
  }

  private static async ensureIndexes(db: Db): Promise<void> {
    await db.collection('training_programs').createIndex({ name: 1 }, { unique: true });
    await db.collection('activity_types').createIndex({ type: 1 }, { unique: true });
    await db.collection('training_schedules').createIndex({ program_name: 1 }, { unique: true });
  }

  async getEvent(): Promise<EventRecord | null> {
    const doc = await this.db.collection<EventDoc>('events').findOne({});
    if (!doc) return null;
    return { race_name: doc.race_name, race_datetime: doc.race_datetime, url: doc.url };
  }

  async getAllProgramNames(): Promise<string[]> {
    const docs = await this.db
      .collection<ProgramDoc>('training_programs')
      // Only enabled programs appear in the dropdown; treat a missing field as enabled.
      .find({ enabled: { $ne: false } }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray();
    return docs.map(d => d.name);
  }

  async getProgram(name: string): Promise<ProgramRecord | null> {
    const doc = await this.db.collection<ProgramDoc>('training_programs').findOne({ name });
    if (!doc) return null;
    return { name: doc.name, full_name: doc.full_name, source_url: doc.source_url, weekstarts: doc.weekstarts };
  }

  async getSchedule(programName: string): Promise<WeekRecord[]> {
    const doc = await this.db
      .collection<TrainingScheduleDoc>('training_schedules')
      .findOne({ program_name: programName });
    return doc?.weeks ?? [];
  }

  // MongoDB holds a single global activity_types collection (programName is ignored).
  async getActivityTypes(_programName: string): Promise<ActivityTypeRecord[]> {
    const docs = await this.db.collection<ActivityTypeDoc>('activity_types').find({}).toArray();
    return docs.map(d => ({ type: d.type, description: d.description }));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
