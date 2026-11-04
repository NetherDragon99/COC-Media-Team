import fs from 'node:fs';
import assert from 'node:assert';
import vm from 'node:vm';

// 1. Read app.js and slice between the engine markers
const appCode = fs.readFileSync('app.js', 'utf8');
const startMarker = '// ==== ENGINE START';
const endMarker = '// ==== ENGINE END';

const startIndex = appCode.indexOf(startMarker);
const endIndex = appCode.indexOf(endMarker);

assert.ok(startIndex !== -1, 'app.js must contain // ==== ENGINE START');
assert.ok(endIndex !== -1, 'app.js must contain // ==== ENGINE END');
assert.ok(startIndex < endIndex, 'ENGINE START marker must precede ENGINE END marker');

const engineCode = appCode.slice(startIndex + startMarker.length, endIndex);

// 2. Evaluate in an isolated VM sandbox with standard globals
const sandbox = {
  console,
  Intl,
  Date,
  Math,
  String,
  Number,
  parseInt,
  parseFloat,
  Array,
  Object,
  Set,
  Map,
  serverNow: () => Date.now(),
  increment: (n) => ({ __op: 'increment', n })
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const exportsObj = vm.runInContext(`(() => {
${engineCode}
return { APP_TIMEZONE, getOccurrences, getOccurrenceFor, formatZonedDateKey, zonedDateToMs, getTaskWindow, computeAttendance, resolveSessionOccurrence, getTimeBucketKeys, buildPointsUpdate, getMemberPeriodPoints };
})()`, sandbox);

const { APP_TIMEZONE, getOccurrences, getOccurrenceFor, formatZonedDateKey, zonedDateToMs, getTaskWindow, computeAttendance, resolveSessionOccurrence, getTimeBucketKeys, buildPointsUpdate, getMemberPeriodPoints } = exportsObj;

assert.strictEqual(APP_TIMEZONE, 'Africa/Cairo', 'APP_TIMEZONE must be Africa/Cairo');
assert.strictEqual(typeof getOccurrences, 'function', 'getOccurrences must be a function');
assert.strictEqual(typeof getOccurrenceFor, 'function', 'getOccurrenceFor must be a function');
assert.strictEqual(typeof getTaskWindow, 'function', 'getTaskWindow must be a function');
assert.strictEqual(typeof computeAttendance, 'function', 'computeAttendance must be a function');

// ==========================================
// TEST 1: ALL 5 TYPES OF SCHEDULE
// ==========================================

// 1.1 Type: once
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const sched = { type: 'once', startDateTime: startMs };
  const occs = getOccurrences(sched, startMs - 1000, startMs + 1000);
  assert.strictEqual(occs.length, 1, 'once schedule should return 1 occurrence in range');
  assert.strictEqual(occs[0], startMs);

  const occBefore = getOccurrenceFor(sched, startMs - 5000);
  assert.strictEqual(occBefore, null, 'once schedule before start should be null');

  const occAt = getOccurrenceFor(sched, startMs);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(occAt)), { key: 'once', start: startMs, nextStart: null });

  const occAfter = getOccurrenceFor(sched, startMs + 10000);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(occAfter)), { key: 'once', start: startMs, nextStart: null });
}

// 1.2 Type: daily
{
  const startMs = zonedDateToMs(2026, 5, 1, 9, 0, 0, 'Africa/Cairo');
  const sched = { type: 'daily', startDateTime: startMs };
  const fromMs = startMs;
  const toMs = zonedDateToMs(2026, 5, 5, 23, 59, 59, 'Africa/Cairo');
  const occs = getOccurrences(sched, fromMs, toMs);
  assert.strictEqual(occs.length, 5, 'daily schedule across 5 days should produce 5 occurrences');
  assert.strictEqual(formatZonedDateKey(occs[0]), '2026-05-01');
  assert.strictEqual(formatZonedDateKey(occs[4]), '2026-05-05');
}

// 1.3 Type: weekly
{
  // 2026-05-02 is a Saturday (Cairo)
  const startMs = zonedDateToMs(2026, 5, 2, 10, 0, 0, 'Africa/Cairo');
  const sched = { type: 'weekly', startDateTime: startMs, days: ['Sat', 'Sun'] };
  const toMs = zonedDateToMs(2026, 5, 16, 23, 59, 59, 'Africa/Cairo');
  const occs = getOccurrences(sched, startMs, toMs);
  // Weeks: May 2 (Sat), May 3 (Sun), May 9 (Sat), May 10 (Sun), May 16 (Sat) = 5 occurrences
  assert.strictEqual(occs.length, 5, 'weekly on Sat and Sun should produce 5 occurrences');
  assert.strictEqual(formatZonedDateKey(occs[0]), '2026-05-02');
  assert.strictEqual(formatZonedDateKey(occs[1]), '2026-05-03');
}

// 1.4 Type: monthlyDates (and 31 in a 30-day month test)
{
  // Target date 31. April 2026 has 30 days. May 2026 has 31 days.
  const startMs = zonedDateToMs(2026, 4, 1, 10, 0, 0, 'Africa/Cairo');
  const sched = { type: 'monthlyDates', startDateTime: startMs, monthDates: [31] };
  const toMs = zonedDateToMs(2026, 5, 31, 23, 59, 59, 'Africa/Cairo');
  const occs = getOccurrences(sched, startMs, toMs);
  assert.strictEqual(occs.length, 2, 'April and May should produce 2 occurrences for date 31');
  assert.strictEqual(formatZonedDateKey(occs[0]), '2026-04-30', '31 in April (30-day month) must clamp to April 30');
  assert.strictEqual(formatZonedDateKey(occs[1]), '2026-05-31', '31 in May (31-day month) must fall on May 31');
}

// 1.5 Type: monthlyWeekdays (and 'Last' week test)
{
  // In May 2026, Sundays are: May 3 (1st), May 10 (2nd), May 17 (3rd), May 24 (4th), May 31 (5th / Last)
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const sched = { type: 'monthlyWeekdays', startDateTime: startMs, weeks: ['1st', 'Last'], weekdays: ['Sun'] };
  const toMs = zonedDateToMs(2026, 5, 31, 23, 59, 59, 'Africa/Cairo');
  const occs = getOccurrences(sched, startMs, toMs);
  assert.strictEqual(occs.length, 2, '1st and Last Sunday of May 2026');
  assert.strictEqual(formatZonedDateKey(occs[0]), '2026-05-03', '1st Sunday of May 2026 is May 3');
  assert.strictEqual(formatZonedDateKey(occs[1]), '2026-05-31', 'Last Sunday of May 2026 is May 31');
}

// ==========================================
// TEST 2: SATURDAY WEEK START
// ==========================================
{
  const satMs = zonedDateToMs(2026, 5, 2, 10, 0, 0, 'Africa/Cairo');
  const sched = { type: 'weekly', startDateTime: satMs, days: ['Sat'] };
  const occs = getOccurrences(sched, satMs, satMs + 14 * 86400000);
  assert.strictEqual(formatZonedDateKey(occs[0]), '2026-05-02');
  assert.strictEqual(formatZonedDateKey(occs[1]), '2026-05-09');
}

// ==========================================
// TEST 3: getOccurrenceFor (before / at / after)
// ==========================================
{
  const startMs = zonedDateToMs(2026, 5, 1, 12, 0, 0, 'Africa/Cairo');
  const item = {
    schedule: { type: 'daily', startDateTime: startMs }
  };

  // Before start
  assert.strictEqual(getOccurrenceFor(item, startMs - 1000), null);

  // At start
  const atOcc = getOccurrenceFor(item, startMs);
  assert.ok(atOcc);
  assert.strictEqual(atOcc.key, '2026-05-01');
  assert.strictEqual(atOcc.start, startMs);

  // After start (3 hours later)
  const afterOcc = getOccurrenceFor(item, startMs + 3 * 3600000);
  assert.ok(afterOcc);
  assert.strictEqual(afterOcc.key, '2026-05-01');
  assert.strictEqual(afterOcc.start, startMs);

  // Next day after next start
  const nextDayMs = zonedDateToMs(2026, 5, 2, 14, 0, 0, 'Africa/Cairo');
  const day2Occ = getOccurrenceFor(item, nextDayMs);
  assert.ok(day2Occ);
  assert.strictEqual(day2Occ.key, '2026-05-02');
}

// ==========================================
// TEST 4: getTaskWindow
// ==========================================

// 4.1 permanent never closes (both once and recurring)
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const taskPermanentOnce = {
    schedule: { type: 'once', startDateTime: startMs },
    isPermanent: true
  };
  const winAt = getTaskWindow(taskPermanentOnce, startMs);
  assert.strictEqual(winAt.state, 'open');
  assert.strictEqual(winAt.closesAt, null);
  assert.strictEqual(winAt.occurrenceKey, 'once');

  const winLater = getTaskWindow(taskPermanentOnce, startMs + 100 * 86400000);
  assert.strictEqual(winLater.state, 'open');
  assert.strictEqual(winLater.closesAt, null);
  assert.strictEqual(winLater.occurrenceKey, 'once');

  const taskPermanentRecur = {
    schedule: { type: 'daily', startDateTime: startMs },
    isPermanent: true
  };
  const winRecur = getTaskWindow(taskPermanentRecur, startMs + 5 * 86400000);
  assert.strictEqual(winRecur.state, 'open');
  assert.strictEqual(winRecur.closesAt, null);
  assert.strictEqual(winRecur.occurrenceKey, '2026-05-06');
}

// 4.2 timed closes after expiry
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const taskTimed = {
    schedule: { type: 'once', startDateTime: startMs },
    isPermanent: false,
    durationMinutes: 60
  };
  const winBeforeExpiry = getTaskWindow(taskTimed, startMs + 30 * 60000); // 10:30
  assert.strictEqual(winBeforeExpiry.state, 'open');
  assert.strictEqual(winBeforeExpiry.closesAt, startMs + 60 * 60000);

  const winAfterExpiry = getTaskWindow(taskTimed, startMs + 61 * 60000); // 11:01
  assert.strictEqual(winAfterExpiry.state, 'closed');
  assert.strictEqual(winAfterExpiry.closesAt, startMs + 60 * 60000);
}

// 4.3 no-duration is open for the occurrence day
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const taskNoDuration = {
    schedule: { type: 'once', startDateTime: startMs },
    isPermanent: false,
    durationMinutes: null
  };
  // Same day at 22:00 in Africa/Cairo
  const sameDayMs = zonedDateToMs(2026, 5, 1, 22, 0, 0, 'Africa/Cairo');
  const winSameDay = getTaskWindow(taskNoDuration, sameDayMs);
  assert.strictEqual(winSameDay.state, 'open');

  // Next day at 02:00 in Africa/Cairo
  const nextDayMs = zonedDateToMs(2026, 5, 2, 2, 0, 0, 'Africa/Cairo');
  const winNextDay = getTaskWindow(taskNoDuration, nextDayMs);
  assert.strictEqual(winNextDay.state, 'closed');
}

// 4.4 once key
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const taskOnce = {
    schedule: { type: 'once', startDateTime: startMs }
  };
  const win = getTaskWindow(taskOnce, startMs);
  assert.strictEqual(win.occurrenceKey, 'once');
}

// ==========================================
// TEST 5: computeAttendance (Task 4)
// ==========================================

// 5.1 early check-in blocked
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30, // opens at 09:30
    lateCutoffMinutes: 60
  };
  const nowMs = zonedDateToMs(2026, 5, 1, 9, 15, 0, 'Africa/Cairo'); // 09:15:00
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'blocked');
  assert.strictEqual(res.reason, 'early');
  assert.strictEqual(res.opensAt, zonedDateToMs(2026, 5, 1, 9, 30, 0, 'Africa/Cairo'));
  assert.strictEqual(res.message, 'Check-in opens at 09:30');
}

// 5.2 on-time check-in (penalty == 0)
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60
  };
  // 09:45 (early window, on-time)
  const resEarlyWindow = computeAttendance(session, zonedDateToMs(2026, 5, 1, 9, 45, 0, 'Africa/Cairo'));
  assert.strictEqual(resEarlyWindow.status, 'on_time');
  assert.strictEqual(resEarlyWindow.penalty, 0);
  assert.strictEqual(resEarlyWindow.delaySeconds, 0);
  assert.strictEqual(resEarlyWindow.message, 'On time (0 EGP penalty)');

  // 10:00:00 (exact start)
  const resExactStart = computeAttendance(session, startMs);
  assert.strictEqual(resExactStart.status, 'on_time');
  assert.strictEqual(resExactStart.penalty, 0);
  assert.strictEqual(resExactStart.delaySeconds, 0);
  assert.strictEqual(resExactStart.message, 'On time (0 EGP penalty)');
}

// 5.3 late check-in with seconds step duration
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    penaltyUnit: 'seconds',
    stepDuration: 30, // every 30 seconds
    penaltyPerStep: 2, // 2 EGP per step
    minPenalty: 0,
    maxPenalty: 100
  };
  // 75 seconds late -> Math.ceil(75 / 30) = 3 steps * 2 = 6 EGP penalty
  const nowMs = startMs + 75 * 1000;
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'late');
  assert.strictEqual(res.delaySeconds, 75);
  assert.strictEqual(res.penalty, 6);
  assert.strictEqual(res.message, 'Late by 1m 15s (-6 EGP)');
}

// 5.4 late check-in with minutes step duration
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    penaltyUnit: 'minutes',
    stepDuration: 5, // every 5 minutes (300 sec)
    penaltyPerStep: 3, // 3 EGP per step
    minPenalty: 0,
    maxPenalty: 100
  };
  // 12 minutes late (720 seconds) -> Math.ceil(720 / 300) = 3 steps * 3 = 9 EGP
  const nowMs = startMs + 12 * 60 * 1000;
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'late');
  assert.strictEqual(res.delaySeconds, 720);
  assert.strictEqual(res.penalty, 9);
  assert.strictEqual(res.message, 'Late by 12m 0s (-9 EGP)');
}

// 5.5 minPenalty clamp
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    penaltyUnit: 'minutes',
    stepDuration: 10,
    penaltyPerStep: 1, // 1 step = 1 EGP
    minPenalty: 10, // clamped up to 10
    maxPenalty: 50
  };
  // 2 minutes late -> 1 step * 1 = 1 EGP raw -> clamped to minPenalty 10 EGP
  const nowMs = startMs + 2 * 60 * 1000;
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'late');
  assert.strictEqual(res.penalty, 10);
  assert.strictEqual(res.message, 'Late by 2m 0s (-10 EGP)');
}

// 5.6 maxPenalty clamp
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 120,
    penaltyUnit: 'minutes',
    stepDuration: 1,
    penaltyPerStep: 5,
    minPenalty: 5,
    maxPenalty: 25 // clamped down to 25
  };
  // 30 minutes late -> 30 steps * 5 = 150 EGP raw -> clamped to maxPenalty 25 EGP
  const nowMs = startMs + 30 * 60 * 1000;
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'late');
  assert.strictEqual(res.penalty, 25);
  assert.strictEqual(res.message, 'Late by 30m 0s (-25 EGP)');
}

// 5.7 closed cutoff blocked
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60 // closes at 11:00:00
  };
  const nowMs = zonedDateToMs(2026, 5, 1, 11, 5, 0, 'Africa/Cairo'); // 11:05:00
  const res = computeAttendance(session, nowMs);
  assert.strictEqual(res.status, 'blocked');
  assert.strictEqual(res.reason, 'closed');
  assert.strictEqual(res.closedAt, zonedDateToMs(2026, 5, 1, 11, 0, 0, 'Africa/Cairo'));
  assert.strictEqual(res.message, 'Check-in closed');
}

// 5.8 weekly recurring occurrence resolution on specific weekdays
{
  // Weekly session on Mon and Thu at 18:00 (Cairo)
  // 2026-05-04 is Monday, 2026-05-07 is Thursday
  const startMs = zonedDateToMs(2026, 5, 1, 18, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'weekly', startDateTime: startMs, days: ['Mon', 'Thu'] },
    earlyCheckInMinutes: 30, // opens at 17:30
    lateCutoffMinutes: 120, // closes at 20:00
    penaltyUnit: 'minutes',
    stepDuration: 10,
    penaltyPerStep: 5,
    minPenalty: 5,
    maxPenalty: 50
  };

  // Test on Monday May 4 at 17:20 (early)
  const monEarlyMs = zonedDateToMs(2026, 5, 4, 17, 20, 0, 'Africa/Cairo');
  const resMonEarly = computeAttendance(session, monEarlyMs);
  assert.strictEqual(resMonEarly.status, 'blocked');
  assert.strictEqual(resMonEarly.reason, 'early');
  assert.strictEqual(resMonEarly.occurrenceKey, '2026-05-04');
  assert.strictEqual(resMonEarly.message, 'Check-in opens at 17:30');

  // Test on Monday May 4 at 17:40 (on time)
  const monOnTimeMs = zonedDateToMs(2026, 5, 4, 17, 40, 0, 'Africa/Cairo');
  const resMonOnTime = computeAttendance(session, monOnTimeMs);
  assert.strictEqual(resMonOnTime.status, 'on_time');
  assert.strictEqual(resMonOnTime.occurrenceKey, '2026-05-04');
  assert.strictEqual(resMonOnTime.penalty, 0);

  // Test on Monday May 4 at 18:25 (25 mins late -> 3 steps * 5 = 15 EGP)
  const monLateMs = zonedDateToMs(2026, 5, 4, 18, 25, 0, 'Africa/Cairo');
  const resMonLate = computeAttendance(session, monLateMs);
  assert.strictEqual(resMonLate.status, 'late');
  assert.strictEqual(resMonLate.occurrenceKey, '2026-05-04');
  assert.strictEqual(resMonLate.penalty, 15);

  // Test on Thursday May 7 at 18:00 (exact start)
  const thuStartMs = zonedDateToMs(2026, 5, 7, 18, 0, 0, 'Africa/Cairo');
  const resThu = computeAttendance(session, thuStartMs);
  assert.strictEqual(resThu.status, 'on_time');
  assert.strictEqual(resThu.occurrenceKey, '2026-05-07');
}

// ==========================================
// TEST 6: REGRESSION TESTS FOR serverNow() NUMBER RETURN & DEFAULT nowMs
// ==========================================
{
  const startMs = zonedDateToMs(2026, 5, 1, 10, 0, 0, 'Africa/Cairo');
  const task = {
    schedule: { type: 'once', startDateTime: startMs },
    isPermanent: true
  };
  const session = {
    schedule: { type: 'once', startDateTime: startMs },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60
  };

  // 6.1 Calling with plain number nowMs must not throw
  assert.doesNotThrow(() => {
    getOccurrenceFor(task, startMs);
    getTaskWindow(task, startMs);
    resolveSessionOccurrence(session, startMs);
    computeAttendance(session, startMs);
  }, 'Engine functions must accept a plain number timestamp without throwing now.getTime is not a function');

  // 6.2 Calling without nowMs (relying on default serverNow()) must not throw
  assert.doesNotThrow(() => {
    getOccurrenceFor(task);
    getTaskWindow(task);
    resolveSessionOccurrence(session);
    computeAttendance(session);
  }, 'Engine functions must default to serverNow() without throwing now.getTime is not a function');
}

// ==========================================
// TEST 7: TIME-BUCKET HELPERS & LEADERBOARD PERIODS (v2.0.0)
// ==========================================
{
  const may1Ms = zonedDateToMs(2026, 5, 1, 12, 0, 0, 'Africa/Cairo');
  const { curMonthKey, curWeekKey } = getTimeBucketKeys(may1Ms, 'Africa/Cairo');
  assert.strictEqual(curMonthKey, '2026-05', 'Month key for May 1 2026 should be 2026-05');
  assert.strictEqual(curWeekKey, '2026-W18', 'Week key for May 1 2026 should be 2026-W18');

  // buildPointsUpdate for new user or fresh month
  const update1 = buildPointsUpdate({ points: 10, monthBucket: '2026-04', monthPoints: 5, weekBucket: '2026-W17', weekPoints: 5 }, 15, may1Ms);
  assert.strictEqual(update1.monthBucket, '2026-05');
  assert.strictEqual(update1.monthPoints, 15);
  assert.strictEqual(update1.weekBucket, '2026-W18');
  assert.strictEqual(update1.weekPoints, 15);

  // buildPointsUpdate for existing bucket (accumulating)
  const update2 = buildPointsUpdate({ points: 25, monthBucket: '2026-05', monthPoints: 15, weekBucket: '2026-W18', weekPoints: 15 }, 10, may1Ms);
  assert.deepStrictEqual(update2.monthPoints, { __op: 'increment', n: 10 });
  assert.deepStrictEqual(update2.weekPoints, { __op: 'increment', n: 10 });

  // getMemberPeriodPoints
  const member = {
    points: 100,
    monthBucket: '2026-05',
    monthPoints: 40,
    weekBucket: '2026-W18',
    weekPoints: 20
  };
  assert.strictEqual(getMemberPeriodPoints(member, 'all', may1Ms), 100);
  assert.strictEqual(getMemberPeriodPoints(member, 'month', may1Ms), 40);
  assert.strictEqual(getMemberPeriodPoints(member, 'week', may1Ms), 20);

  // Expired bucket gives 0 points
  const june1Ms = zonedDateToMs(2026, 6, 1, 12, 0, 0, 'Africa/Cairo');
  assert.strictEqual(getMemberPeriodPoints(member, 'month', june1Ms), 0);
  assert.strictEqual(getMemberPeriodPoints(member, 'week', june1Ms), 0);
}

console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY!');
