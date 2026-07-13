import type { DbAdapter } from '../db/adapters/interface';

// ── View-layer types ──────────────────────────────────────────────────────────

export interface DayData {
  dayName: string;
  activityType: string;
  description: string;
  isToday: boolean;
}

export interface WeekData {
  weekNumber: number;
  weekBeginFmt: string;
  weekEndFmt: string;
  days: DayData[];
  weeklyDistance: number;
}

export interface InfoItem {
  activity_type: string;
  description: string;
}

export interface CountdownData {
  raceName: string;
  raceNameSafe: string;
  raceDisplayDate: string;
  raceDatetime: Date;
  siteUrl: string;
  timeout: number | null;
  left: string;
  leftPlaintext: string;
  daysLeft: number;
  currentWeek: number;
  totalTrainingWeeks: number;
  trainingStarted: boolean;
  daysUntilTraining: number;
  trainingType: string;
  trainingPlans: string[];
  weeks: WeekData[];
  calendarDayNames: string[];
  infoItems: InfoItem[];
  programFullName: string;
  programSourceUrl: string;
  now: Date;
}

export interface CountdownResult {
  data: CountdownData;
  setCookies: Array<{ name: string; value: string; options: { maxAge: number; path: string } }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DATE_REGEX = /^(0?[1-9]|[12][0-9]|3[01])[-\/](0[1-9]|1[012])[-\/](20)\d\d$/;
const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS     = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDmY(str: string): Date {
  const [d, m, y] = str.split(/[-\/]/);
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

function dayNameAt(weekstarts: string, index: number): string {
  const startDow = weekstarts === 'sun' ? 0 : 1;
  return DAY_NAMES[(startDow + index) % 7];
}

function extractKm(activity: string): number {
  const m = activity.match(/([0-9]+)K/i);
  if (m) return parseInt(m[1], 10);
  if (/half marathon/i.test(activity)) return 21;
  if (/marathon|race day/i.test(activity)) return 42;
  return 0;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildCountdown(
  adapter: DbAdapter,
  query: Record<string, string | undefined>,
  cookies: Record<string, string>,
): Promise<CountdownResult> {
  const setCookies: CountdownResult['setCookies'] = [];
  const cookieOpts = { maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' };

  // ── Training plan ─────────────────────────────────────────────────────────
  const allPrograms = await adapter.getAllProgramNames();

  // Default to the preferred plan, but only if it is enabled; otherwise fall
  // back to the first enabled program so we never default to a hidden plan.
  let trainingType = allPrograms.includes('pfitz-55-18')
    ? 'pfitz-55-18'
    : (allPrograms[0] ?? 'pfitz-55-18');
  const reqPlan = (query.trainingplan ?? '').toLowerCase();
  if (reqPlan && allPrograms.includes(reqPlan)) {
    trainingType = reqPlan;
    setCookies.push({ name: 'training_plan', value: reqPlan, options: cookieOpts });
  } else if (cookies.training_plan && allPrograms.includes(cookies.training_plan)) {
    trainingType = cookies.training_plan;
  }

  // ── Load program ──────────────────────────────────────────────────────────
  const [program, weeks, infoRows, event] = await Promise.all([
    adapter.getProgram(trainingType),
    adapter.getSchedule(trainingType),
    adapter.getActivityTypes(trainingType),
    adapter.getEvent(),
  ]);

  if (!program) throw new Error(`Training program not found: ${trainingType}`);
  if (!event)   throw new Error('No event found in database. Run: npm run seed');

  const allDays          = weeks.flatMap(w => w.days);
  const totalTrainingWeeks = weeks.length;
  const infoItems: InfoItem[] = infoRows.map(r => ({ activity_type: r.type, description: r.description }));

  // ── Race date ─────────────────────────────────────────────────────────────
  let raceDatetime = new Date(event.race_datetime.replace(' ', 'T'));
  const defaultTimeParts = event.race_datetime.split(/[ T]/)[1]?.split(':') ?? ['09', '00', '00'];

  function applyDefaultTime(d: Date): Date {
    d.setHours(parseInt(defaultTimeParts[0], 10), parseInt(defaultTimeParts[1], 10), parseInt(defaultTimeParts[2], 10));
    return d;
  }

  const reqRaceday = query.raceday ? decodeURIComponent(query.raceday) : null;
  if (reqRaceday && DATE_REGEX.test(reqRaceday)) {
    raceDatetime = applyDefaultTime(parseDmY(reqRaceday));
    setCookies.push({ name: 'raceday', value: reqRaceday, options: cookieOpts });
  } else if (cookies.raceday && DATE_REGEX.test(cookies.raceday)) {
    raceDatetime = applyDefaultTime(parseDmY(cookies.raceday));
  }

  // ── Countdown calculation ─────────────────────────────────────────────────
  const now         = new Date();
  const secondsLeft = Math.floor((raceDatetime.getTime() - now.getTime()) / 1000);

  const trainingStart = new Date(raceDatetime.getTime() - (allDays.length - 1) * 24 * 3600 * 1000);
  trainingStart.setHours(0, 0, 0, 0);

  const nowMidnight  = new Date(now);          nowMidnight.setHours(0, 0, 0, 0);
  const raceMidnight = new Date(raceDatetime); raceMidnight.setHours(0, 0, 0, 0);
  const trainingDay  = Math.floor((nowMidnight.getTime() - trainingStart.getTime()) / (24 * 3600 * 1000)) + 1;

  let timeout: number | null = null;
  let left;
  let leftPlaintext;
  let daysLeft = 0;
  let currentWeek = 1;

  if (secondsLeft > 0) {
    daysLeft = Math.floor((raceMidnight.getTime() - nowMidnight.getTime()) / (24 * 3600 * 1000));

    if (daysLeft > 1) {
      timeout = null;
      if (daysLeft > 7) {
        const weeksLeft = Math.floor(daysLeft / 7);
        const days = daysLeft - weeksLeft * 7;
        left = `<span id="weeks">${weeksLeft}</span> Week<span id="weeks-plural">${weeksLeft > 1 ? 's' : ''}</span>`;
        leftPlaintext = `T-Minus ${weeksLeft} Week${weeksLeft > 1 ? 's' : ''}`;
        if (days > 0) {
          left += ` <span class="amp">&amp;</span> <span id="days">${days}</span> Day<span id="days-plural">${days > 1 ? 's' : ''}</span>`;
          leftPlaintext += ` & ${days} Day${days > 1 ? 's' : ''}`;
        }
      } else {
        left = `${daysLeft} Day${daysLeft > 1 ? 's' : ''}`;
        leftPlaintext = `T-Minus ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`;
      }
    } else {
      const minutesLeft = Math.floor(secondsLeft / 60);
      if (minutesLeft >= 60) {
        timeout = 15000;
        const hours   = Math.floor(minutesLeft / 60);
        const minutes = minutesLeft - hours * 60;
        left = `<span id="hours">${hours}</span> Hour<span id="hours-plural">${hours > 1 ? 's' : ''}</span> <span class="amp">&amp;</span> <span id="minutes">${minutes}</span> Minute<span id="minutes-plural">${minutes > 1 ? 's' : ''}</span>`;
        leftPlaintext = `T-Minus ${hours} Hour${hours > 1 ? 's' : ''} & ${minutes} Minute${minutes > 1 ? 's' : ''}`;
      } else {
        timeout = 1000;
        const seconds = secondsLeft - minutesLeft * 60;
        left = `<span id="minutes">${minutesLeft}</span> Minute<span id="minutes-plural">${minutesLeft > 1 ? 's' : ''}</span> <span class="amp">&amp;</span> <span id="seconds">${seconds}</span> Second<span id="seconds-plural">${seconds > 1 ? 's' : ''}</span>`;
        leftPlaintext = `T-Minus ${minutesLeft} Minute${minutesLeft > 1 ? 's' : ''} & ${seconds} Second${seconds > 1 ? 's' : ''}`;
      }
    }

    currentWeek = Math.ceil(Math.max(trainingDay, 0) / 7);
    currentWeek = Math.min(Math.max(currentWeek, 1), totalTrainingWeeks);
  } else {
    left          = "It's Race Day!!";
    leftPlaintext = "It's Race Day!!";
    currentWeek   = totalTrainingWeeks;
  }

  // ── Dates & view data ─────────────────────────────────────────────────────
  const raceDisplayDate = `${pad2(raceDatetime.getDate())} ${MONTHS[raceDatetime.getMonth()]}, ${raceDatetime.getFullYear()}`;
  const weekstarts      = program.weekstarts;
  const nowDowName      = DAY_NAMES[now.getDay()];

  const weeksData: WeekData[] = weeks.map((week, wi) => {
    const weekNumber = wi + 1;
    let weeklyDistance = 0;

    const weekBegin = new Date(trainingStart.getTime() + wi * 7 * 24 * 3600 * 1000);
    const weekEnd   = new Date(weekBegin.getTime() + 6 * 24 * 3600 * 1000);
    const fmt       = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

    const days: DayData[] = week.days.map((day, di) => {
      const dName = dayNameAt(weekstarts, di);
      weeklyDistance += extractKm(day.description);
      return {
        dayName:      dName,
        activityType: day.activity_type,
        description:  day.description,
        isToday:      weekNumber === currentWeek && nowDowName.toLowerCase() === dName.toLowerCase(),
      };
    });

    return { weekNumber, weekBeginFmt: fmt(weekBegin), weekEndFmt: fmt(weekEnd), days, weeklyDistance };
  });

  const calendarDayNames = Array.from({ length: 7 }, (_, i) => dayNameAt(weekstarts, i));
  const raceNameSafe     = event.race_name.replace(/[ ,':]/g, '_').toLowerCase();

  return {
    data: {
      raceName: event.race_name, raceNameSafe, raceDisplayDate, raceDatetime,
      siteUrl: event.url, timeout, left, leftPlaintext, daysLeft, currentWeek,
      totalTrainingWeeks, trainingStarted: trainingDay > 0,
      daysUntilTraining: allDays.length - daysLeft,
      trainingType, trainingPlans: allPrograms, weeks: weeksData,
      calendarDayNames, infoItems,
      programFullName: program.full_name, programSourceUrl: program.source_url,
      now,
    },
    setCookies,
  };
}
