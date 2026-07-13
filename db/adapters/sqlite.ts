import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { DbAdapter, EventRecord, ProgramRecord, WeekRecord, ActivityTypeRecord } from './interface';

export class SqliteAdapter implements DbAdapter {
  private readonly db: DatabaseSync;

  constructor() {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'db', 'marathon.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  async getEvent(): Promise<EventRecord | null> {
    const row = this.db
      .prepare('SELECT race_name, race_datetime, url FROM events LIMIT 1')
      .get() as EventRecord | undefined;
    return row ?? null;
  }

  async getAllProgramNames(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT name FROM training_programs WHERE enabled = 1 ORDER BY name')
      .all() as { name: string }[];
    return rows.map(r => r.name);
  }

  async getProgram(name: string): Promise<ProgramRecord | null> {
    const row = this.db
      .prepare('SELECT name, full_name, source_url, weekstarts FROM training_programs WHERE name = ?')
      .get(name) as ProgramRecord | undefined;
    return row ?? null;
  }

  async getSchedule(programName: string): Promise<WeekRecord[]> {
    const prog = this.db
      .prepare('SELECT id FROM training_programs WHERE name = ?')
      .get(programName) as { id: number } | undefined;
    if (!prog) return [];

    const weeks = this.db
      .prepare('SELECT id, week_number FROM training_weeks WHERE program_id = ? ORDER BY week_number')
      .all(prog.id) as { id: number; week_number: number }[];

    return weeks.map(week => ({
      week_number: week.week_number,
      days: (this.db
        .prepare('SELECT day_number, activity_type, description FROM training_days WHERE week_id = ? ORDER BY day_number')
        .all(week.id) as { day_number: number; activity_type: string; description: string }[]),
    }));
  }

  async getActivityTypes(programName: string): Promise<ActivityTypeRecord[]> {
    const prog = this.db
      .prepare('SELECT id FROM training_programs WHERE name = ?')
      .get(programName) as { id: number } | undefined;
    if (!prog) return [];

    const rows = this.db
      .prepare('SELECT activity_type, description FROM training_info WHERE program_id = ? ORDER BY id')
      .all(prog.id) as { activity_type: string; description: string }[];
    return rows.map(r => ({ type: r.activity_type, description: r.description }));
  }
}
