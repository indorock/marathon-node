// Shared record types and the DbAdapter interface implemented by all backends.

export interface EventRecord {
  race_name: string;
  race_datetime: string;
  url: string;
}

export interface ProgramRecord {
  name: string;
  full_name: string;
  source_url: string;
  weekstarts: string;
}

export interface DayRecord {
  day_number: number;
  activity_type: string;
  description: string;
}

export interface WeekRecord {
  week_number: number;
  days: DayRecord[];
}

export interface ActivityTypeRecord {
  type: string;
  description: string;
}

export interface DbAdapter {
  getEvent(): Promise<EventRecord | null>;
  getAllProgramNames(): Promise<string[]>;
  getProgram(name: string): Promise<ProgramRecord | null>;
  /** Returns weeks with embedded days, ordered by week_number. */
  getSchedule(programName: string): Promise<WeekRecord[]>;
  /**
   * Returns activity-type descriptions for the info panel.
   * MongoDB returns the global activity_types collection (programName ignored).
   * SQLite returns the per-program training_info rows.
   */
  getActivityTypes(programName: string): Promise<ActivityTypeRecord[]>;
  close?(): Promise<void>;
}
