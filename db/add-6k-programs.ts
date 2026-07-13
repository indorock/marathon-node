/**
 * Complete, self-contained seed for the B2 Run instance (e.g. the b2run
 * subdomain). Creates the schema if missing, adds three 8-week 6K training
 * programs (beginner / intermediate / advanced), sets the target race to the
 * B2 Run (16 Sep 2026), and enables ONLY the three 6K plans in the dropdown.
 *
 * Unlike seed:sqlite, this has NO external dependency (no XML files), so it
 * reproduces the full intended state on a fresh server from nothing.
 *
 * Idempotent: re-running replaces the same programs and re-points the event.
 * Run with: npm run seed:b2run   (or: npx tsx db/add-6k-programs.ts)
 *
 * Notes on the existing schema (unchanged here):
 *  - There is no "distance"/"difficulty"/"finish-time" column, so the race
 *    distance and goal finish time are encoded in `training_programs.full_name`
 *    (shown in the credits line) and in the per-program `training_info` rows.
 *  - `events` is single-row from the app's point of view (getEvent = LIMIT 1),
 *    so the target race is set by updating the existing event row.
 *  - The calendar lays each week out as 7 consecutive days (Mon..Sun) and treats
 *    the final day as race day, so every week carries exactly 7 day rows; the
 *    "training days per week" are the non-rest rows, the rest are 'rest'.
 */

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureSchema } from './schema';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'db', 'marathon.db');

type Day = { type: string; desc: string };

const REST: Day = { type: 'rest', desc: 'Rest / cross-train' };

/** Build a 7-slot week (Mon..Sun) from a sparse {dayIndex: Day} map; gaps = rest. */
function week(days: Record<number, Day>): Day[] {
  return Array.from({ length: 7 }, (_, i) => days[i] ?? REST);
}

interface Program {
  name: string;
  full_name: string;
  source_url: string;
  weekstarts: string;
  weeks: Day[][];
  info: { type: string; desc: string }[];
}

// Day indices: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun. Race lands on the
// final day of week 8 (index 6). Distances use "<n>K" so the weekly-distance
// total (which parses the first number before "K") shows sensible values.

const beginner: Program = {
  name: '6k-beginner',
  full_name: '6K Beginner Plan (8 weeks) — Goal: finish under 35 min (~5:50/km), 1–2 runs per week',
  source_url: 'https://www.b2run.de',
  weekstarts: 'mon',
  weeks: [
    week({ 5: { type: 'run', desc: '3K easy' } }),
    week({ 1: { type: 'run', desc: '3K easy' }, 5: { type: 'run', desc: '4K easy' } }),
    week({ 1: { type: 'run', desc: '3K easy + 4 x 20s strides' }, 5: { type: 'long', desc: '5K easy' } }),
    week({ 5: { type: 'long', desc: '5K easy (recovery week)' } }),
    week({ 1: { type: 'run', desc: '4K easy incl 5 x 1min @ goal pace' }, 5: { type: 'long', desc: '6K easy' } }),
    week({ 1: { type: 'repeats-800', desc: '6 x 400m @ goal pace (5:50/km), jog 200m' }, 5: { type: 'long', desc: '6K steady' } }),
    week({ 1: { type: 'repeats-800', desc: '4K incl 3 x 800m @ goal pace' }, 5: { type: 'long', desc: '6K, last 2K @ goal pace' } }),
    week({ 1: { type: 'run', desc: '3K easy + 4 x 100m strides' }, 6: { type: 'race', desc: '6K Race — B2 Run! Goal: sub-35' } }),
  ],
  info: [
    { type: 'run', desc: '<h3>Easy Run</h3><p><strong>Easy running is the foundation of the whole plan — and it really should feel easy.</strong> Aim for roughly 6:20–6:40 per kilometre, but don\'t obsess over the watch. The best guide is the <em>talk test</em>: you should be able to hold a full conversation in complete sentences. If you\'re breathing too hard to chat, you\'re going too fast — ease off, it\'s meant to feel comfortable.</p><p><strong>New to running?</strong> It is completely fine to mix in walking breaks — for example, run 4 minutes, walk 1 minute, and repeat. Begin every run with 3–5 minutes of brisk walking or gentle jogging to warm up, and finish with a few easy minutes to cool down.</p><p>These runs quietly build your aerobic base — the endurance engine that lets you race a strong 6K without falling apart.</p>' },
    { type: 'repeats-800', desc: '<h3>Intervals (Repeats)</h3><p><strong>Intervals are short, faster bursts of running with an easy recovery in between.</strong> They let your body rehearse race pace without the fatigue of running fast the entire time.</p><p>Run the fast segments at your <strong>6K goal pace (about 5:50/km)</strong> — controlled and strong, <em>not</em> an all-out sprint. Between each one, jog very slowly or walk until your breathing calms down (roughly 200m, or 60–90 seconds). That recovery is not cheating — it is what makes the next rep possible.</p><p>A session written as <em>"6 x 400m"</em> means six fast segments of 400 metres (one lap of a running track) each. Always warm up with 5–10 minutes of easy running beforehand and cool down the same way.</p>' },
    { type: 'long', desc: '<h3>Long / Weekend Run</h3><p><strong>This is your longest run of the week, and it is run slowly</strong> — the same relaxed, conversational effort as your easy runs. Distance is the goal here, never speed.</p><p>These runs gradually stretch out toward 6K and a little beyond, so that the race distance feels familiar and manageable on the day. When the plan says <em>"last 2K at goal pace"</em>, just lift the effort a little over the final stretch to practise finishing strong. Walk breaks are still perfectly fine, especially in the early weeks.</p>' },
    { type: 'race', desc: '<h3>Race Day 🏁</h3><p><strong>This is what you\'ve trained for!</strong> Arrive early, jog for 5 minutes to loosen up, and line up feeling relaxed and confident.</p><p>The most common first-timer mistake is starting too fast. Hold back for the first kilometre at your goal pace (~5:50/km), settle into a rhythm, and only start pushing over the final 1–2K once you know you can hold on. A sub-35-minute 6K is well within reach off this training — so enjoy every step of it.</p>' },
    { type: 'rest', desc: '<h3>Rest / Cross-train</h3><p><strong>Rest days are training days too.</strong> Your body gets fitter and stronger while it recovers, not while it runs — skipping rest is how injuries and burnout begin.</p><p>Either take the day fully off, or do some gentle <em>cross-training</em>: a walk, an easy bike ride, a swim, or some light yoga. The idea is to keep moving without pounding your legs. And listen to your body — if you feel unusually tired or sore, taking an extra rest day is always the smart choice.</p>' },
  ],
};

const intermediate: Program = {
  name: '6k-intermediate',
  full_name: '6K Intermediate Plan (8 weeks) — Goal: finish under 30 min (~5:00/km), 2–3 runs per week',
  source_url: 'https://www.b2run.de',
  weekstarts: 'mon',
  weeks: [
    week({ 1: { type: 'run', desc: '5K easy' }, 5: { type: 'long', desc: '6K easy' } }),
    week({ 1: { type: 'run', desc: '5K easy' }, 3: { type: 'repeats-800', desc: '5K w/ 6 x 1min @ goal pace' }, 5: { type: 'long', desc: '7K easy' } }),
    week({ 1: { type: 'run', desc: '6K easy' }, 3: { type: 'repeats-800', desc: '6 x 600m @ 5:00/km, jog 200m' }, 5: { type: 'long', desc: '8K easy' } }),
    week({ 1: { type: 'run', desc: '5K easy' }, 5: { type: 'long', desc: '6K easy (recovery week)' } }),
    week({ 1: { type: 'run', desc: '6K easy' }, 3: { type: 'repeats-800', desc: '5 x 800m @ goal pace, jog 200m' }, 5: { type: 'long', desc: '8K steady' } }),
    week({ 1: { type: 'run', desc: '6K easy' }, 3: { type: 'repeats-1000', desc: '3 x 1K @ goal pace (5:00/km), jog 400m' }, 5: { type: 'long', desc: '9K easy' } }),
    week({ 1: { type: 'run', desc: '6K easy + strides' }, 3: { type: 'tempo', desc: 'Tempo: 4K @ ~5:10/km' }, 5: { type: 'long', desc: '6K, last 3K @ goal pace' } }),
    week({ 3: { type: 'run', desc: '4K easy + 4 x 100m strides' }, 6: { type: 'race', desc: '6K Race — B2 Run! Goal: sub-30' } }),
  ],
  info: [
    { type: 'run', desc: '<h3>Easy Run</h3><p><strong>Easy running makes up the bulk of your week, and it should feel comfortable</strong> — around 5:40–5:55 per kilometre. Use the <em>talk test</em>: if you can chat in full sentences, you\'ve got the effort right. Running these too hard is the number-one reason plans stall, so keep them honestly easy.</p><p>Start each run with a few minutes of gentle jogging to warm up and finish with an easy cool-down. These runs build the aerobic engine that carries a fast 6K — the fitness that lets your harder sessions actually pay off.</p>' },
    { type: 'repeats-800', desc: '<h3>Intervals (Repeats)</h3><p><strong>Short, faster repetitions at or just under your 6K goal pace (~5:00/km), with an easy jog to recover between each.</strong> They sharpen your leg speed and running economy so goal pace starts to feel smooth.</p><p>Keep the fast parts controlled and even — the aim is to finish the last rep as strong as the first, not to blow up on rep two. Jog slowly (about 200m) between reps until your breathing settles. Always bookend the session with a 5–10 minute easy warm-up and cool-down.</p>' },
    { type: 'repeats-1000', desc: '<h3>1K Repeats</h3><p><strong>Longer intervals — 1 kilometre at your exact 6K goal pace (5:00/km)</strong> — with a 400m jog recovery. This is the single best predictor of your race fitness: if you can hit these paces cleanly and repeatably, your goal time is on.</p><p>Resist the urge to run them faster than goal pace. The skill you\'re building is holding <em>precisely</em> the right pace when you\'re tired. Warm up and cool down thoroughly.</p>' },
    { type: 'tempo', desc: '<h3>Tempo Run</h3><p><strong>A continuous "comfortably hard" effort</strong> at around 5:10/km — a touch slower than 6K race pace. It should feel controlled but focused: you could speak only a few words at a time, not hold a conversation.</p><p>Tempo runs raise your <em>lactate threshold</em> — in plain terms, the pace you can sustain before your legs and lungs start protesting. Run 10–15 minutes easy first, hold the tempo effort for the prescribed distance, then jog easy to finish.</p>' },
    { type: 'long', desc: '<h3>Long / Steady Run</h3><p><strong>Your longest run of the week</strong>, run easy for most of the distance to build endurance beyond race distance. In the sharper weeks you\'ll add faster "goal pace" finishes — lifting the effort over the final kilometres to practise running strong on tired legs.</p><p>Keep the easy portions genuinely relaxed. The point is to spend time on your feet, not to race your training partner.</p>' },
    { type: 'race', desc: '<h3>Race Day 🏁</h3><p><strong>Time to put it all together.</strong> Warm up with 5–10 minutes of easy jogging and a few short strides so you\'re ready from the gun.</p><p>Go out right at 5:00/km — no faster, however good you feel — hold that rhythm through 4K, then empty the tank over the final 2K. A sub-30 6K <em>is</em> 5:00/km start to finish, so trust the pace work you\'ve banked and execute.</p>' },
    { type: 'rest', desc: '<h3>Rest / Cross-train</h3><p><strong>Rest is where the fitness actually happens</strong> — your body absorbs the hard work and rebuilds stronger on these days. Two to three quality runs a week only work when the days between them are genuinely easy.</p><p>Take the day off, or cross-train gently: an easy bike ride, a swim, a walk, or some mobility and stretching. If you\'re carrying unusual fatigue or a niggle, an extra rest day is never wasted.</p>' },
  ],
};

const advanced: Program = {
  name: '6k-advanced',
  full_name: '6K Advanced Plan (8 weeks) — Goal: finish under 25 min (~4:07/km), 2–3 runs per week',
  source_url: 'https://www.b2run.de',
  weekstarts: 'mon',
  weeks: [
    week({ 1: { type: 'run', desc: '6K easy' }, 3: { type: 'repeats-400', desc: '6 x 400m @ 4:00/km, jog 200m' }, 5: { type: 'long', desc: '8K easy' } }),
    week({ 1: { type: 'run', desc: '7K easy' }, 3: { type: 'repeats-800', desc: '5 x 800m @ goal pace (4:07/km), jog 200m' }, 5: { type: 'long', desc: '10K easy' } }),
    week({ 1: { type: 'run', desc: '8K easy' }, 3: { type: 'tempo', desc: 'Tempo: 5K @ ~4:20/km' }, 5: { type: 'long', desc: '12K easy' } }),
    week({ 1: { type: 'run', desc: '6K easy' }, 5: { type: 'long', desc: '8K easy (recovery week)' } }),
    week({ 1: { type: 'run', desc: '8K easy incl strides' }, 3: { type: 'repeats-1000', desc: '6 x 1K @ goal pace, jog 200m' }, 5: { type: 'long', desc: '12K steady' } }),
    week({ 1: { type: 'run', desc: '8K easy' }, 3: { type: 'repeats-800', desc: '3 x 2K @ ~4:15/km, jog 400m' }, 5: { type: 'long', desc: '14K easy' } }),
    week({ 1: { type: 'run', desc: '8K easy + strides' }, 3: { type: 'tempo', desc: 'Tempo: 6K @ ~4:15/km' }, 5: { type: 'long', desc: '8K, last 4K @ goal pace' } }),
    week({ 3: { type: 'run', desc: '5K easy incl 6 x 100m strides' }, 6: { type: 'race', desc: '6K Race — B2 Run! Goal: sub-25' } }),
  ],
  info: [
    { type: 'run', desc: '<h3>Easy Run</h3><p><strong>Easy aerobic mileage at roughly 4:50–5:10/km.</strong> Deliberately kept easy so that your two hard sessions each week land with real quality — if the easy days creep up in pace, the key workouts suffer. The talk test still applies: conversational, controlled, relaxed.</p><p>This is the volume that underpins everything else. Warm up and cool down as a matter of routine.</p>' },
    { type: 'repeats-400', desc: '<h3>400m Repeats</h3><p><strong>Short, sharp reps at ~4:00/km — faster than 6K goal pace</strong> — with a jogged 200m recovery. These develop top-end speed and running economy, making goal pace feel easier by comparison.</p><p>Run them fast but smooth and repeatable; don\'t turn the first few into a sprint. A thorough warm-up (including a few strides) is essential before the first rep.</p>' },
    { type: 'repeats-800', desc: '<h3>Interval Repeats</h3><p><strong>Longer reps at or near your 6K goal pace (4:07–4:15/km)</strong> with jogged recoveries — the core race-specific sharpening work of this plan. Sessions like <em>3 x 2K</em> build the ability to sustain race effort under fatigue.</p><p>Hold even splits across every rep and keep the recoveries easy. Warm up and cool down properly to get the most from the session and stay healthy.</p>' },
    { type: 'repeats-1000', desc: '<h3>1K Repeats</h3><p><strong>1 kilometre at 6K goal pace with a short 200m recovery.</strong> The brief recovery makes this a demanding, highly specific predictor of race fitness — close to the effort you\'ll sustain on race day.</p><p>Nail goal pace exactly rather than racing the reps. Consistency across the set is the win.</p>' },
    { type: 'tempo', desc: '<h3>Tempo Run</h3><p><strong>A sustained threshold effort at ~4:15–4:20/km</strong>, held continuously for the prescribed distance. It should feel "comfortably hard" — strong and focused, but not a race.</p><p>Tempo work raises the pace you can hold before fatigue accumulates, directly extending how long you can stay on goal pace in the 6K. Bookend it with easy running.</p>' },
    { type: 'long', desc: '<h3>Long / Steady Run</h3><p><strong>The weekly long run, building up to ~14K</strong>, run easy for most of the distance with sharp goal-pace finishes late in the training block. This underpins race-day durability — the strength to hold form when it hurts.</p><p>Keep the bulk of it relaxed; the value is in the accumulated easy volume, with the fast finishes teaching you to close hard.</p>' },
    { type: 'race', desc: '<h3>Race Day 🏁</h3><p><strong>4:07/km is sub-25 for a 6K.</strong> Warm up properly — 10–15 minutes easy plus strides — so you can hit goal pace from the first stride.</p><p>Go out on pace (not over it), sit on the effort through 4K, then drive the final 2K home. You\'ve done the specific work; execute the plan and back yourself.</p>' },
    { type: 'rest', desc: '<h3>Rest / Cross-train</h3><p><strong>At this intensity, recovery days are what protect the quality of your key sessions.</strong> Skimp on them and the hard workouts lose their edge — or you get hurt.</p><p>Take the day off or cross-train lightly (easy spin, swim, mobility). Guard your recovery as carefully as your hard efforts; both are part of getting fast.</p>' },
  ],
};

const PROGRAMS = [beginner, intermediate, advanced];

function upsertProgram(db: DatabaseSync, p: Program): void {
  // Update-or-insert (not INSERT OR REPLACE): keeps the row's id stable so the
  // existing child rows' foreign keys stay valid while we rebuild them.
  const existing = db.prepare('SELECT id FROM training_programs WHERE name = ?').get(p.name) as { id: number } | undefined;
  let programId: number;
  if (existing) {
    programId = existing.id;
    db.prepare('UPDATE training_programs SET full_name = ?, source_url = ?, weekstarts = ? WHERE id = ?')
      .run(p.full_name, p.source_url, p.weekstarts, programId);
  } else {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO training_programs (name, full_name, source_url, weekstarts) VALUES (?, ?, ?, ?)')
      .run(p.name, p.full_name, p.source_url, p.weekstarts);
    programId = Number(lastInsertRowid);
  }

  // Clear any existing children so re-runs stay idempotent.
  for (const row of db.prepare('SELECT id FROM training_weeks WHERE program_id = ?').all(programId) as { id: number }[]) {
    db.prepare('DELETE FROM training_days WHERE week_id = ?').run(row.id);
  }
  db.prepare('DELETE FROM training_weeks WHERE program_id = ?').run(programId);
  db.prepare('DELETE FROM training_info WHERE program_id = ?').run(programId);

  p.weeks.forEach((days, w) => {
    const { lastInsertRowid: weekId } = db
      .prepare('INSERT INTO training_weeks (program_id, week_number) VALUES (?, ?)')
      .run(programId, w + 1);
    days.forEach((day, d) => {
      db.prepare('INSERT INTO training_days (week_id, day_number, activity_type, description) VALUES (?, ?, ?, ?)')
        .run(weekId, d + 1, day.type, day.desc);
    });
  });

  for (const item of p.info) {
    db.prepare('INSERT INTO training_info (program_id, activity_type, description) VALUES (?, ?, ?)')
      .run(programId, item.type, item.desc);
  }

  console.log(`Seeded program: ${p.name} (${p.weeks.length} weeks)`);
}

function setTargetRace(db: DatabaseSync): void {
  const race = {
    name: 'B2 Run',
    // B2Run corporate runs start in the evening; 65 days out from 2026-07-13.
    datetime: '2026-09-16 19:00:00',
    url: 'https://www.b2run.de',
  };
  const existing = db.prepare('SELECT id FROM events LIMIT 1').get() as { id: number } | undefined;
  if (existing) {
    db.prepare('UPDATE events SET race_name = ?, race_datetime = ?, url = ? WHERE id = ?')
      .run(race.name, race.datetime, race.url, existing.id);
    console.log('Target race set (updated existing event):', race.name, race.datetime);
  } else {
    db.prepare('INSERT INTO events (race_name, race_datetime, url) VALUES (?, ?, ?)')
      .run(race.name, race.datetime, race.url);
    console.log('Target race set (inserted event):', race.name, race.datetime);
  }
}

/** Ensure the `enabled` column exists (so this script is self-contained). */
function ensureEnabledColumn(db: DatabaseSync): void {
  const cols = db.prepare('PRAGMA table_info(training_programs)').all() as { name: string }[];
  if (!cols.some(c => c.name === 'enabled')) {
    db.exec('ALTER TABLE training_programs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
  }
}

/** Enable only the three 6K plans; disable every other program. */
function enableOnly6k(db: DatabaseSync): void {
  const names = PROGRAMS.map(p => p.name);
  const placeholders = names.map(() => '?').join(', ');
  db.prepare(`UPDATE training_programs SET enabled = CASE WHEN name IN (${placeholders}) THEN 1 ELSE 0 END`)
    .run(...names);

  const enabled = (db.prepare('SELECT name FROM training_programs WHERE enabled = 1 ORDER BY name').all() as { name: string }[]).map(r => r.name);
  console.log('Enabled programs (shown in dropdown):', enabled.join(', '));
}

function main(): void {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  ensureSchema(db);          // create tables on a fresh (empty) database
  ensureEnabledColumn(db);   // add `enabled` to a pre-existing training_programs
  setTargetRace(db);
  for (const p of PROGRAMS) upsertProgram(db, p);
  enableOnly6k(db);

  console.log('\n6K programs + B2 Run event ready.');
}

main();
