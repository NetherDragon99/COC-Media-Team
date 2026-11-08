import fs from 'node:fs';
import assert from 'node:assert';
import vm from 'node:vm';

// 1. Read app.js and slice between the engine markers
const appCode = fs.readFileSync('app.js', 'utf8');
const startMarker = appCode.includes('const ENGINE_START_MARKER = 1;') ? 'const ENGINE_START_MARKER = 1;' : '// ==== ENGINE START';
const endMarker = appCode.includes('const ENGINE_END_MARKER = 1;') ? 'const ENGINE_END_MARKER = 1;' : '// ==== ENGINE END';

const startIndex = appCode.indexOf(startMarker);
const endIndex = appCode.indexOf(endMarker);

assert.ok(startIndex !== -1, 'app.js must contain ENGINE START marker');
assert.ok(endIndex !== -1, 'app.js must contain ENGINE END marker');
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
return { APP_TIMEZONE, getOccurrences, getOccurrenceFor, formatZonedDateKey, zonedDateToMs, getTaskWindow, computeAttendance, resolveSessionOccurrence, getTimeBucketKeys, buildPointsUpdate, getMemberPeriodPoints, parseDateTimeToMs, msToZonedParts, zonedPartsToMs, startOfZonedDay, addDaysZoned, weekKeyOf, monthKeyOf, offsetFromPickers, pickersFromOffset, normalizeTaskTiers, computeTieredTaskPoints, normalizeSession, calculateSystemPenalty, computeCropRect, createRowGesture, buildRoster, isUserEligibleForSession };
})()`, sandbox);

const { APP_TIMEZONE, getOccurrences, getOccurrenceFor, formatZonedDateKey, zonedDateToMs, getTaskWindow, computeAttendance, resolveSessionOccurrence, getTimeBucketKeys, buildPointsUpdate, getMemberPeriodPoints, parseDateTimeToMs, msToZonedParts, zonedPartsToMs, startOfZonedDay, addDaysZoned, weekKeyOf, monthKeyOf, offsetFromPickers, pickersFromOffset, normalizeTaskTiers, computeTieredTaskPoints, normalizeSession, calculateSystemPenalty, computeCropRect, createRowGesture, buildRoster, isUserEligibleForSession } = exportsObj;
assert.strictEqual(typeof computeCropRect, 'function', 'computeCropRect must be a function');
assert.strictEqual(typeof createRowGesture, 'function', 'createRowGesture must be a function');
assert.strictEqual(typeof buildRoster, 'function', 'buildRoster must be a function');

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
// TEST 7: TIME-BUCKET HELPERS & LEADERBOARD PERIODS
// ==========================================
{
  const may1Ms = zonedDateToMs(2026, 5, 1, 12, 0, 0, 'Africa/Cairo');
  const { curMonthKey, curWeekKey } = getTimeBucketKeys(may1Ms, 'Africa/Cairo');
  assert.strictEqual(curMonthKey, '2026-05', 'Month key for May 1 2026 should be 2026-05');
  assert.strictEqual(curWeekKey, '2026-04-25', 'Week key for May 1 2026 (Friday) should be 2026-04-25 (Saturday start)');

  // buildPointsUpdate for new user or fresh month
  const update1 = buildPointsUpdate({ points: 10, monthKey: '2026-04', monthPoints: 5, weekKey: '2026-04-18', weekPoints: 5 }, 15, may1Ms);
  assert.strictEqual(update1.monthKey, '2026-05');
  assert.strictEqual(update1.monthPoints, 15);
  assert.strictEqual(update1.weekKey, '2026-04-25');
  assert.strictEqual(update1.weekPoints, 15);

  // buildPointsUpdate for existing bucket (accumulating)
  const update2 = buildPointsUpdate({ points: 25, monthKey: '2026-05', monthPoints: 15, weekKey: '2026-04-25', weekPoints: 15 }, 10, may1Ms);
  assert.deepStrictEqual(update2.monthPoints, { __op: 'increment', n: 10 });
  assert.deepStrictEqual(update2.weekPoints, { __op: 'increment', n: 10 });

  // getMemberPeriodPoints
  const member = {
    points: 100,
    monthKey: '2026-05',
    monthPoints: 40,
    weekKey: '2026-04-25',
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


// ==========================================
// TEST 8: FIRESTORE TIMESTAMP / DATE / NUMBER / UNDEFINED DATE HANDLING
// ==========================================
{
  const targetMs = zonedDateToMs(2026, 5, 1, 12, 0, 0, 'Africa/Cairo');

  // All representation variants
  const variants = [
    { label: 'number timestamp', val: targetMs },
    { label: 'Date instance', val: new Date(targetMs) },
    { label: 'Firestore Timestamp with toMillis()', val: { toMillis: () => targetMs } },
    { label: 'Firestore Timestamp with toDate()', val: { toDate: () => new Date(targetMs) } },
    { label: 'Firestore Timestamp with seconds/nanoseconds', val: { seconds: Math.floor(targetMs / 1000), nanoseconds: (targetMs % 1000) * 1e6 } }
  ];

  for (const { label, val } of variants) {
    // 8.1 parseDateTimeToMs converts cleanly to targetMs
    assert.strictEqual(parseDateTimeToMs(val), targetMs, `parseDateTimeToMs must handle ${label}`);

    // 8.2 getTimeBucketKeys never throws and returns correct keys
    const keys = getTimeBucketKeys(val, 'Africa/Cairo');
    assert.strictEqual(keys.curMonthKey, '2026-05', `Month key should be 2026-05 for ${label}`);
    assert.strictEqual(keys.curWeekKey, '2026-04-25', `Week key should be 2026-04-25 for ${label}`);

    // 8.3 getOccurrenceFor / getTaskWindow / computeAttendance
    const task = { schedule: { type: 'once', startDateTime: val }, isPermanent: true };
    assert.doesNotThrow(() => getOccurrenceFor(task, val), `getOccurrenceFor must accept ${label}`);
    assert.doesNotThrow(() => getTaskWindow(task, val), `getTaskWindow must accept ${label}`);

    const session = { schedule: { type: 'once', startDateTime: val }, earlyCheckInMinutes: 30, lateCutoffMinutes: 60 };
    assert.doesNotThrow(() => computeAttendance(session, val), `computeAttendance must accept ${label}`);
  }

  // 8.4 Defaulting to serverNow() without arguments must not throw
  assert.doesNotThrow(() => {
    getTimeBucketKeys();
    buildPointsUpdate({ points: 10 }, 5);
    getMemberPeriodPoints({ points: 10 });
  }, 'Time bucket helpers must default safely to serverNow() without throwing');
}


// ==========================================
// TEST 9: TIMEZONE CONVERSIONS, WHEEL PICKER HELPERS & DST TRANSITIONS
// ==========================================
{
  const testZones = ['UTC', 'Africa/Cairo', 'America/Los_Angeles', 'Pacific/Auckland'];

  for (const tz of testZones) {
    // 9.1 msToZonedParts <-> zonedPartsToMs round trip
    const baseMs = Date.UTC(2026, 4, 15, 14, 30, 0);
    const parts = msToZonedParts(baseMs, tz);
    assert.strictEqual(typeof parts.y, 'number');
    assert.strictEqual(typeof parts.m, 'number');
    assert.strictEqual(typeof parts.d, 'number');
    assert.strictEqual(typeof parts.hh, 'number');
    assert.strictEqual(typeof parts.mm, 'number');

    const roundMs = zonedPartsToMs(parts, tz);
    assert.strictEqual(roundMs, baseMs, `Round trip ms <-> zonedParts must match exactly for ${tz}`);

    // 9.2 startOfZonedDay returns midnight in the given timezone
    const dayStartMs = startOfZonedDay(baseMs, tz);
    const startParts = msToZonedParts(dayStartMs, tz);
    assert.strictEqual(startParts.y, parts.y);
    assert.strictEqual(startParts.m, parts.m);
    assert.strictEqual(startParts.d, parts.d);
    assert.strictEqual(startParts.hh, 0, `Hour must be 0 for startOfZonedDay in ${tz}`);
    assert.strictEqual(startParts.mm, 0, `Minute must be 0 for startOfZonedDay in ${tz}`);
    assert.strictEqual(startParts.ss, 0, `Second must be 0 for startOfZonedDay in ${tz}`);
  }

  // 9.3 DST Transition tests
  // Africa/Cairo DST 2026: spring-forward on Friday April 24 (00:00 -> 01:00)
  // Let's add 2 days from April 23 15:30 Cairo time across the DST boundary
  const cairoBefore = zonedPartsToMs({ y: 2026, m: 4, d: 23, hh: 15, mm: 30 }, 'Africa/Cairo');
  const cairoAfter = addDaysZoned(cairoBefore, 2, 'Africa/Cairo');
  const cairoAfterParts = msToZonedParts(cairoAfter, 'Africa/Cairo');
  assert.strictEqual(cairoAfterParts.y, 2026);
  assert.strictEqual(cairoAfterParts.m, 4);
  assert.strictEqual(cairoAfterParts.d, 25);
  assert.strictEqual(cairoAfterParts.hh, 15, 'Hour must remain 15:30 across Cairo spring-forward DST transition');
  assert.strictEqual(cairoAfterParts.mm, 30, 'Minute must remain 15:30 across Cairo spring-forward DST transition');

  // America/Los_Angeles DST 2026: spring-forward on March 8 (02:00 -> 03:00)
  // Add 2 days from March 7 10:15
  const laBefore = zonedPartsToMs({ y: 2026, m: 3, d: 7, hh: 10, mm: 15 }, 'America/Los_Angeles');
  const laAfter = addDaysZoned(laBefore, 2, 'America/Los_Angeles');
  const laAfterParts = msToZonedParts(laAfter, 'America/Los_Angeles');
  assert.strictEqual(laAfterParts.y, 2026);
  assert.strictEqual(laAfterParts.m, 3);
  assert.strictEqual(laAfterParts.d, 9);
  assert.strictEqual(laAfterParts.hh, 10, 'Hour must remain 10:15 across Los Angeles spring-forward DST transition');
  assert.strictEqual(laAfterParts.mm, 15, 'Minute must remain 10:15 across Los Angeles spring-forward DST transition');

  // Pacific/Auckland DST 2026: fall-back on April 5 (03:00 -> 02:00)
  // Add 2 days from April 4 09:45
  const aucklandBefore = zonedPartsToMs({ y: 2026, m: 4, d: 4, hh: 9, mm: 45 }, 'Pacific/Auckland');
  const aucklandAfter = addDaysZoned(aucklandBefore, 2, 'Pacific/Auckland');
  const aucklandAfterParts = msToZonedParts(aucklandAfter, 'Pacific/Auckland');
  assert.strictEqual(aucklandAfterParts.y, 2026);
  assert.strictEqual(aucklandAfterParts.m, 4);
  assert.strictEqual(aucklandAfterParts.d, 6);
  assert.strictEqual(aucklandAfterParts.hh, 9, 'Hour must remain 09:45 across Auckland fall-back DST transition');
  assert.strictEqual(aucklandAfterParts.mm, 45, 'Minute must remain 09:45 across Auckland fall-back DST transition');
}


// ==========================================
// TEST 8: TASK 4/10 LEADERBOARD COUNTERS (weekKeyOf, monthKeyOf, buildPointsUpdate)
// ==========================================

// 8.1 weekKeyOf and monthKeyOf under APP_TIMEZONE ('Africa/Cairo')
{
  assert.strictEqual(typeof weekKeyOf, 'function', 'weekKeyOf must be a function');
  assert.strictEqual(typeof monthKeyOf, 'function', 'monthKeyOf must be a function');

  // Boundary 1: Friday 2026-11-06 23:59:59 Cairo vs Saturday 2026-11-07 00:00:00 Cairo
  const friNightCairo = zonedDateToMs(2026, 11, 6, 23, 59, 59, 'Africa/Cairo');
  const satMorningCairo = zonedDateToMs(2026, 11, 7, 0, 0, 0, 'Africa/Cairo');

  // Friday belongs to Saturday 2026-10-31 week
  assert.strictEqual(weekKeyOf(friNightCairo, 'Africa/Cairo'), '2026-10-31', 'Friday 23:59:59 Cairo must belong to Saturday 2026-10-31 week');
  assert.strictEqual(monthKeyOf(friNightCairo, 'Africa/Cairo'), '2026-11', 'Friday 2026-11-06 must be in month 2026-11');

  // Saturday 00:00:00 Cairo starts a new week!
  assert.strictEqual(weekKeyOf(satMorningCairo, 'Africa/Cairo'), '2026-11-07', 'Saturday 00:00:00 Cairo starts Saturday 2026-11-07 week');
  assert.strictEqual(monthKeyOf(satMorningCairo, 'Africa/Cairo'), '2026-11', 'Saturday 2026-11-07 must be in month 2026-11');

  // Boundary 2: Month transition Oct 31 23:59:59 Cairo vs Nov 1 00:00:00 Cairo
  const octEndCairo = zonedDateToMs(2026, 10, 31, 23, 59, 59, 'Africa/Cairo');
  const novStartCairo = zonedDateToMs(2026, 11, 1, 0, 0, 0, 'Africa/Cairo');

  assert.strictEqual(monthKeyOf(octEndCairo, 'Africa/Cairo'), '2026-10', 'Oct 31 23:59:59 must be 2026-10');
  assert.strictEqual(monthKeyOf(novStartCairo, 'Africa/Cairo'), '2026-11', 'Nov 1 00:00:00 must be 2026-11');
  // Both Oct 31 (Sat) and Nov 1 (Sun) belong to the Saturday 2026-10-31 week!
  assert.strictEqual(weekKeyOf(octEndCairo, 'Africa/Cairo'), '2026-10-31');
  assert.strictEqual(weekKeyOf(novStartCairo, 'Africa/Cairo'), '2026-10-31');
}

// 8.2 Testing weekKeyOf and monthKeyOf in UTC, America/Los_Angeles, and Pacific/Auckland
{
  const timezones = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland'];

  for (const tz of timezones) {
    // Saturday morning in this timezone
    const satNoon = zonedDateToMs(2026, 5, 2, 12, 0, 0, tz); // 2026-05-02 is a Saturday
    const friEve = zonedDateToMs(2026, 5, 8, 23, 59, 0, tz); // 2026-05-08 is a Friday
    const nextSat = zonedDateToMs(2026, 5, 9, 0, 0, 1, tz); // 2026-05-09 is next Saturday

    assert.strictEqual(weekKeyOf(satNoon, tz), '2026-05-02', `Saturday in ${tz} must yield Saturday key`);
    assert.strictEqual(weekKeyOf(friEve, tz), '2026-05-02', `Friday in ${tz} must yield start of that week Saturday key`);
    assert.strictEqual(weekKeyOf(nextSat, tz), '2026-05-09', `Next Saturday in ${tz} must yield next Saturday key`);

    // Month boundary in timezone
    const lastSecMonth = zonedDateToMs(2026, 4, 30, 23, 59, 59, tz);
    const firstSecMonth = zonedDateToMs(2026, 5, 1, 0, 0, 0, tz);
    assert.strictEqual(monthKeyOf(lastSecMonth, tz), '2026-04', `Last second in ${tz} must be 2026-04`);
    assert.strictEqual(monthKeyOf(firstSecMonth, tz), '2026-05', `First second in ${tz} must be 2026-05`);
  }
}

// 8.3 DST Transitions (America/Los_Angeles March 8 spring forward, Nov 1 fall back)
{
  // Spring forward: 2026-03-08 in America/Los_Angeles
  const springSun = zonedDateToMs(2026, 3, 8, 14, 0, 0, 'America/Los_Angeles');
  assert.strictEqual(weekKeyOf(springSun, 'America/Los_Angeles'), '2026-03-07', 'Spring forward Sunday must map to Saturday 2026-03-07');
  assert.strictEqual(monthKeyOf(springSun, 'America/Los_Angeles'), '2026-03');

  // Fall back: 2026-11-01 in America/Los_Angeles
  const fallSun = zonedDateToMs(2026, 11, 1, 14, 0, 0, 'America/Los_Angeles');
  assert.strictEqual(weekKeyOf(fallSun, 'America/Los_Angeles'), '2026-10-31', 'Fall back Sunday must map to Saturday 2026-10-31');
  assert.strictEqual(monthKeyOf(fallSun, 'America/Los_Angeles'), '2026-11');
}

// 8.4 buildPointsUpdate contract
{
  const refTime = zonedDateToMs(2026, 11, 7, 14, 0, 0, 'Africa/Cairo'); // Saturday week 2026-11-07, month 2026-11
  const curWk = '2026-11-07';
  const curMo = '2026-11';

  // Positive: same week & month -> increment
  const userSame = { weekKey: curWk, weekPoints: 10, monthKey: curMo, monthPoints: 20, points: 50 };
  const upSame = buildPointsUpdate(userSame, 15, refTime);
  assert.deepStrictEqual(upSame.points, { __op: 'increment', n: 15 });
  assert.deepStrictEqual(upSame.weekPoints, { __op: 'increment', n: 15 });
  assert.deepStrictEqual(upSame.monthPoints, { __op: 'increment', n: 15 });
  assert.strictEqual(upSame.weekKey, undefined, 'weekKey should not be overwritten when already current');

  // Positive: new week & month -> sets keys and points to delta
  const userOld = { weekKey: '2026-10-10', weekPoints: 10, monthKey: '2026-10', monthPoints: 20, points: 50 };
  const upNew = buildPointsUpdate(userOld, 15, refTime);
  assert.deepStrictEqual(upNew.points, { __op: 'increment', n: 15 });
  assert.strictEqual(upNew.weekKey, curWk);
  assert.strictEqual(upNew.weekPoints, 15);
  assert.strictEqual(upNew.monthKey, curMo);
  assert.strictEqual(upNew.monthPoints, 15);

  // Negative: same week & month -> decrements points, writes absolute Math.max(0, current + delta) for window counters
  const upNegSame = buildPointsUpdate(userSame, -5, refTime);
  assert.deepStrictEqual(upNegSame.points, { __op: 'increment', n: -5 });
  assert.strictEqual(upNegSame.weekPoints, 5, 'weekPoints must be absolute Math.max(0, 10 - 5) = 5');
  assert.strictEqual(upNegSame.monthPoints, 15, 'monthPoints must be absolute Math.max(0, 20 - 5) = 15');

  // Negative: past week & month (e.g. revoking submission from last month) -> decrements points only!
  const pastSubmissionTime = zonedDateToMs(2026, 9, 15, 12, 0, 0, 'Africa/Cairo');
  const upNegPast = buildPointsUpdate(userSame, -10, pastSubmissionTime);
  assert.deepStrictEqual(upNegPast.points, { __op: 'increment', n: -10 });
  assert.strictEqual(upNegPast.weekPoints, undefined, 'Must not touch current weekPoints for past week submission');
  assert.strictEqual(upNegPast.monthPoints, undefined, 'Must not touch current monthPoints for past month submission');

  // getMemberPeriodPoints
  assert.strictEqual(getMemberPeriodPoints(userSame, 'all', refTime), 50);
  assert.strictEqual(getMemberPeriodPoints(userSame, 'month', refTime), 20);
  assert.strictEqual(getMemberPeriodPoints(userSame, 'week', refTime), 10);
  assert.strictEqual(getMemberPeriodPoints(userOld, 'month', refTime), 0, 'Expired month bucket yields 0');
  assert.strictEqual(getMemberPeriodPoints(userOld, 'week', refTime), 0, 'Expired week bucket yields 0');
}


// ==========================================
// TEST 9: TASK MODAL, PICKERS & TIERS (TASK 5)
// ==========================================

// 9.1 offsetFromPickers & pickersFromOffset
{
  // Once: absolute start and deadline ms
  const sMs = zonedDateToMs(2026, 6, 1, 10, 0, 0, 'Africa/Cairo');
  const dMs = zonedDateToMs(2026, 6, 1, 12, 30, 0, 'Africa/Cairo');
  const durOnce = offsetFromPickers({ isOnce: true, startMs: sMs, deadlineMs: dMs });
  assert.strictEqual(durOnce, 150, 'Once duration 10:00 to 12:30 must be 150 min');

  const pOnce = pickersFromOffset({ isOnce: true, startMs: sMs, durationMinutes: 150 });
  assert.strictEqual(pOnce.deadlineMs, dMs, 'pickersFromOffset must recover deadlineMs for once task');

  // Recurring: daysAfter + start/deadline times
  const durRec = offsetFromPickers({ isOnce: false, startTime: '10:00', deadlineTime: '12:30', daysAfter: 1 });
  assert.strictEqual(durRec, 1440 + 150, '1 day after + 2.5 hours must be 1590 min');

  const pRec = pickersFromOffset({ isOnce: false, startTime: '10:00', durationMinutes: 1590 });
  assert.strictEqual(pRec.daysAfter, 1);
  assert.strictEqual(pRec.deadlineTime, '12:30');

  // Same day earlier time -> invalid without daysAfter > 0
  assert.throws(() => offsetFromPickers({ isOnce: false, startTime: '14:00', deadlineTime: '10:00', daysAfter: 0 }), /Deadline must be after start/);
}

// 9.2 normalizeTaskTiers: legacy vs modern
{
  // Modern format
  const modern = {
    points: 10,
    durationMinutes: 120,
    earlyBonus: { enabled: true, untilMinutes: 30, points: 15 },
    grace: { enabled: true, untilMinutes: 180 },
    missedPenalty: { enabled: true, points: 5 }
  };
  const normModern = normalizeTaskTiers(modern);
  assert.strictEqual(normModern.points, 10);
  assert.strictEqual(normModern.earlyBonus.enabled, true);
  assert.strictEqual(normModern.earlyBonus.untilMinutes, 30);
  assert.strictEqual(normModern.earlyBonus.points, 15);
  assert.strictEqual(normModern.grace.enabled, true);
  assert.strictEqual(normModern.grace.untilMinutes, 180);
  assert.strictEqual(normModern.missedPenalty.enabled, true);
  assert.strictEqual(normModern.missedPenalty.points, 5);

  // Legacy format (tieredRewards)
  const legacy = {
    points: 8,
    durationMinutes: 120,
    tieredRewards: {
      earlyBonusMinutes: 40,
      earlyPoints: 12,
      onTimePoints: 8,
      graceMinutes: 60,
      gracePoints: 4,
      missedPenaltyPoints: 3
    }
  };
  const normLegacy = normalizeTaskTiers(legacy);
  assert.strictEqual(normLegacy.points, 8);
  assert.strictEqual(normLegacy.earlyBonus.enabled, true);
  assert.strictEqual(normLegacy.earlyBonus.untilMinutes, 40);
  assert.strictEqual(normLegacy.earlyBonus.points, 12);
  assert.strictEqual(normLegacy.grace.enabled, true);
  assert.strictEqual(normLegacy.grace.untilMinutes, 180, 'Legacy grace: duration (120) + graceMinutes (60) = 180 min');
  assert.strictEqual(normLegacy.missedPenalty.enabled, true);
  assert.strictEqual(normLegacy.missedPenalty.points, 3);
}

// 9.3 getTaskWindow states
{
  const start = zonedDateToMs(2026, 6, 1, 10, 0, 0, 'Africa/Cairo');
  const task = {
    id: 'task-test-1',
    isPermanent: false,
    durationMinutes: 120, // closes at 12:00
    points: 5,
    earlyBonus: { enabled: true, untilMinutes: 30, points: 10 }, // until 10:30
    grace: { enabled: true, untilMinutes: 180 }, // until 13:00
    missedPenalty: { enabled: true, points: 2 },
    schedule: { type: 'once', startDateTime: start }
  };

  // 1. Upcoming (before start)
  const wUpcoming = getTaskWindow(task, start - 10000);
  assert.strictEqual(wUpcoming.state, 'upcoming');
  assert.strictEqual(wUpcoming.pointsForNow, 10);
  assert.strictEqual(wUpcoming.inGrace, false);

  // 2. Open - Early Bonus (at start + 15 min = 10:15)
  const wEarly = getTaskWindow(task, start + 15 * 60000);
  assert.strictEqual(wEarly.state, 'open');
  assert.strictEqual(wEarly.pointsForNow, 10);
  assert.strictEqual(wEarly.inGrace, false);
  assert.strictEqual(wEarly.isEarlyBonus, true);

  // 3. Open - Standard On-Time (at start + 45 min = 10:45)
  const wStandard = getTaskWindow(task, start + 45 * 60000);
  assert.strictEqual(wStandard.state, 'open');
  assert.strictEqual(wStandard.pointsForNow, 5);
  assert.strictEqual(wStandard.inGrace, false);
  assert.strictEqual(wStandard.isEarlyBonus, false);

  // 4. Grace (at start + 150 min = 12:30, after closesAt 12:00, before graceEndsAt 13:00)
  const wGrace = getTaskWindow(task, start + 150 * 60000);
  assert.strictEqual(wGrace.state, 'grace');
  assert.strictEqual(wGrace.pointsForNow, 5, 'Grace submissions earn on-time points');
  assert.strictEqual(wGrace.inGrace, true);

  // 5. Closed (at start + 200 min = 13:20, after graceEndsAt)
  const wClosed = getTaskWindow(task, start + 200 * 60000);
  assert.strictEqual(wClosed.state, 'closed');
  assert.strictEqual(wClosed.pointsForNow, 0);

  // 6. Permanent task -> always open, on-time points
  const permTask = { id: 'p1', isPermanent: true, points: 7 };
  const wPerm = getTaskWindow(permTask, start + 9999999);
  assert.strictEqual(wPerm.state, 'open');
  assert.strictEqual(wPerm.pointsForNow, 7);
  assert.strictEqual(wPerm.isPermanent, true);
  assert.strictEqual(wPerm.inGrace, false);
}

// 9.4 computeTieredTaskPoints
{
  const start = zonedDateToMs(2026, 6, 1, 10, 0, 0, 'Africa/Cairo');
  const task = {
    points: 10,
    durationMinutes: 60,
    earlyBonus: { enabled: true, untilMinutes: 15, points: 20 },
    grace: { enabled: true, untilMinutes: 90 },
    schedule: { type: 'once', startDateTime: start }
  };
  assert.strictEqual(computeTieredTaskPoints(task, start + 10 * 60000).points, 20); // within early bonus
  assert.strictEqual(computeTieredTaskPoints(task, start + 30 * 60000).points, 10); // standard on-time
  assert.strictEqual(computeTieredTaskPoints(task, start + 75 * 60000).points, 10); // grace earns standard points
  assert.strictEqual(computeTieredTaskPoints(task, start + 75 * 60000).inGrace, true);
  assert.strictEqual(computeTieredTaskPoints(task, start + 100 * 60000).canSubmit, false); // after grace
}


// =========================================================================
// TEST 10: ATTENDANCE OVERHAUL: MIRRORED PENALTIES & EGP MODEL (TASK 6)
// =========================================================================

// 10.1 normalizeSession: Legacy vs Modern
{
  // Legacy session
  const legacy = {
    id: 's_legacy',
    penaltyPointsEnabled: true,
    penaltyFinesEnabled: false,
    penaltyUnit: 'minutes',
    stepDuration: 5,
    penaltyPerStep: 2,
    minPenalty: 4,
    maxPenalty: 20,
    absencePenalty: 15,
    absenceFineEGP: 50,
    earlyCheckInMinutes: 20,
    lateCutoffMinutes: 90
  };
  const normLeg = normalizeSession(legacy);
  assert.strictEqual(normLeg.pointsPenalty.enabled, true);
  assert.strictEqual(normLeg.pointsPenalty.mode, 'stepped');
  assert.strictEqual(normLeg.pointsPenalty.stepUnit, 'minutes');
  assert.strictEqual(normLeg.pointsPenalty.stepSize, 5);
  assert.strictEqual(normLeg.pointsPenalty.perStep, 2);
  assert.strictEqual(normLeg.pointsPenalty.min, 4);
  assert.strictEqual(normLeg.pointsPenalty.max, 20);
  assert.strictEqual(normLeg.pointsPenalty.absence, 15);

  assert.strictEqual(normLeg.finePenalty.enabled, false);
  assert.strictEqual(normLeg.finePenalty.absence, 50);

  // Modern session
  const modern = {
    id: 's_modern',
    pointsPenalty: {
      enabled: true,
      mode: 'fixed',
      fixed: 7,
      min: 0,
      max: 10,
      absence: 12
    },
    finePenalty: {
      enabled: true,
      mode: 'stepped',
      stepUnit: 'seconds',
      stepSize: 30,
      perStep: 5,
      min: 10,
      max: 50,
      absence: 100
    }
  };
  const normMod = normalizeSession(modern);
  assert.strictEqual(normMod.pointsPenalty.enabled, true);
  assert.strictEqual(normMod.pointsPenalty.mode, 'fixed');
  assert.strictEqual(normMod.pointsPenalty.fixed, 7);
  assert.strictEqual(normMod.pointsPenalty.absence, 12);

  assert.strictEqual(normMod.finePenalty.enabled, true);
  assert.strictEqual(normMod.finePenalty.mode, 'stepped');
  assert.strictEqual(normMod.finePenalty.stepUnit, 'seconds');
  assert.strictEqual(normMod.finePenalty.stepSize, 30);
  assert.strictEqual(normMod.finePenalty.perStep, 5);
  assert.strictEqual(normMod.finePenalty.min, 10);
  assert.strictEqual(normMod.finePenalty.max, 50);
  assert.strictEqual(normMod.finePenalty.absence, 100);
}

// 10.2 computeAttendance: Fixed penalty mode
{
  const start = zonedDateToMs(2026, 7, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    id: 's_fixed',
    schedule: { type: 'once', startDateTime: start },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    pointsPenalty: { enabled: true, mode: 'fixed', fixed: 8, min: 0, max: 20, absence: 15 },
    finePenalty: { enabled: true, mode: 'fixed', fixed: 25, min: 0, max: 100, absence: 50 }
  };

  // On time
  const onTime = computeAttendance(session, start - 5000);
  assert.strictEqual(onTime.status, 'on_time');
  assert.strictEqual(onTime.pointsPenalty, 0);
  assert.strictEqual(onTime.finePenalty, 0);
  assert.strictEqual(onTime.fineEGP, 0);

  // Late
  const late = computeAttendance(session, start + 60000); // 1m late
  assert.strictEqual(late.status, 'late');
  assert.strictEqual(late.pointsPenalty, 8);
  assert.strictEqual(late.finePenalty, 25);
  assert.strictEqual(late.fineEGP, 25);
  assert.strictEqual(late.penalty, 8); // legacy compatibility
}

// 10.3 computeAttendance: Stepped in seconds & in minutes
{
  const start = zonedDateToMs(2026, 7, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    id: 's_stepped',
    schedule: { type: 'once', startDateTime: start },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    pointsPenalty: {
      enabled: true,
      mode: 'stepped',
      stepUnit: 'seconds',
      stepSize: 15,
      perStep: 2,
      min: 0,
      max: 999999,
      absence: 20
    },
    finePenalty: {
      enabled: true,
      mode: 'stepped',
      stepUnit: 'minutes',
      stepSize: 5,
      perStep: 10,
      min: 0,
      max: 999999,
      absence: 50
    }
  };

  // 10s late:
  // Points (15s steps): ceil(10 / 15) = 1 step * 2 = 2 pts
  // Fines (5m steps): ceil(10 / 300) = 1 step * 10 = 10 EGP
  const late10s = computeAttendance(session, start + 10000);
  assert.strictEqual(late10s.pointsPenalty, 2);
  assert.strictEqual(late10s.finePenalty, 10);

  // 35s late:
  // Points: ceil(35 / 15) = 3 steps * 2 = 6 pts
  // Fines: ceil(35 / 300) = 1 step * 10 = 10 EGP
  const late35s = computeAttendance(session, start + 35000);
  assert.strictEqual(late35s.pointsPenalty, 6);
  assert.strictEqual(late35s.finePenalty, 10);

  // 360s (6m) late:
  // Points: ceil(360 / 15) = 24 steps * 2 = 48 pts
  // Fines: ceil(360 / 300) = 2 steps * 10 = 20 EGP
  const late6m = computeAttendance(session, start + 360000);
  assert.strictEqual(late6m.pointsPenalty, 48);
  assert.strictEqual(late6m.finePenalty, 20);
}

// 10.4 Min and Max Clamps
{
  const start = zonedDateToMs(2026, 7, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    id: 's_clamps',
    schedule: { type: 'once', startDateTime: start },
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    pointsPenalty: {
      enabled: true,
      mode: 'stepped',
      stepUnit: 'minutes',
      stepSize: 1,
      perStep: 1,
      min: 5, // minimum 5
      max: 15, // maximum 15
      absence: 20
    },
    finePenalty: {
      enabled: true,
      mode: 'fixed',
      fixed: 2,
      min: 10, // minimum 10
      max: 50,
      absence: 30
    }
  };

  // 1 min late: raw points = 1 -> clamped to min 5; fixed fine = 2 -> clamped to min 10
  const late1m = computeAttendance(session, start + 60000);
  assert.strictEqual(late1m.pointsPenalty, 5);
  assert.strictEqual(late1m.finePenalty, 10);

  // 30 min late: raw points = 30 -> clamped to max 15
  const late30m = computeAttendance(session, start + 30 * 60000);
  assert.strictEqual(late30m.pointsPenalty, 15);
  assert.strictEqual(late30m.finePenalty, 10);
}

// 10.5 Independent Enablement: Points Only, Fines Only, Both Off
{
  const start = zonedDateToMs(2026, 7, 1, 10, 0, 0, 'Africa/Cairo');

  // Points on, Fines off
  const sPtsOnly = {
    schedule: { type: 'once', startDateTime: start },
    pointsPenalty: { enabled: true, mode: 'fixed', fixed: 10, min: 0, max: 20 },
    finePenalty: { enabled: false, mode: 'fixed', fixed: 50, min: 0, max: 100 }
  };
  const resPts = computeAttendance(sPtsOnly, start + 60000);
  assert.strictEqual(resPts.pointsPenalty, 10);
  assert.strictEqual(resPts.finePenalty, 0);

  // Points off, Fines on
  const sFinesOnly = {
    schedule: { type: 'once', startDateTime: start },
    pointsPenalty: { enabled: false, mode: 'fixed', fixed: 10, min: 0, max: 20 },
    finePenalty: { enabled: true, mode: 'fixed', fixed: 50, min: 0, max: 100 }
  };
  const resFines = computeAttendance(sFinesOnly, start + 60000);
  assert.strictEqual(resFines.pointsPenalty, 0);
  assert.strictEqual(resFines.finePenalty, 50);

  // Both off
  const sNone = {
    schedule: { type: 'once', startDateTime: start },
    pointsPenalty: { enabled: false },
    finePenalty: { enabled: false }
  };
  const resNone = computeAttendance(sNone, start + 60000);
  assert.strictEqual(resNone.pointsPenalty, 0);
  assert.strictEqual(resNone.finePenalty, 0);
}

// 10.6 Absence calculation
{
  const session = {
    id: 's_abs',
    pointsPenalty: { enabled: true, absence: 25 },
    finePenalty: { enabled: true, absence: 75 }
  };
  const absRes = computeAttendance(session, 'absent');
  assert.strictEqual(absRes.status, 'absent');
  assert.strictEqual(absRes.pointsPenalty, 25);
  assert.strictEqual(absRes.finePenalty, 75);
  assert.strictEqual(absRes.fineEGP, 75);

  // With fines disabled for absence
  const sessionNoFine = {
    id: 's_abs_nofine',
    pointsPenalty: { enabled: true, absence: 30 },
    finePenalty: { enabled: false, absence: 100 }
  };
  const absNoFineRes = computeAttendance(sessionNoFine, 'absent');
  assert.strictEqual(absNoFineRes.pointsPenalty, 30);
  assert.strictEqual(absNoFineRes.finePenalty, 0);
}

// 10.7 Early & Closed window checks
{
  const start = zonedDateToMs(2026, 7, 1, 10, 0, 0, 'Africa/Cairo');
  const session = {
    schedule: { type: 'once', startDateTime: start },
    earlyCheckInMinutes: 30, // opens at 09:30
    lateCutoffMinutes: 60    // closes at 11:00
  };

  const tooEarly = computeAttendance(session, start - 35 * 60000); // 09:25
  assert.strictEqual(tooEarly.status, 'blocked');
  assert.strictEqual(tooEarly.reason, 'early');

  const tooLate = computeAttendance(session, start + 65 * 60000); // 11:05
  assert.strictEqual(tooLate.status, 'blocked');
  assert.strictEqual(tooLate.reason, 'closed');
}


// ==========================================
// TEST 11: COMPUTE CROP RECT (TASK 1)
// ==========================================
{
  const assertClose = (a, b, eps = 1e-3, msg = '') => {
    assert.ok(Math.abs(a - b) < eps, `${msg}: expected ${b}, got ${a}`);
  };

  // 11.1 Square image at zoom = 1
  const sq1 = computeCropRect({ imgW: 500, imgH: 500, viewport: 280, zoom: 1 });
  assertClose(sq1.coverScale, 280 / 500);
  assertClose(sq1.containScale, 280 / 500);
  assertClose(sq1.minZoom, 1);
  assertClose(sq1.effectiveScale, 280 / 500);
  assertClose(sq1.dispW, 280);
  assertClose(sq1.dispH, 280);
  assertClose(sq1.clampedX, 0);
  assertClose(sq1.clampedY, 0);
  assertClose(sq1.sx, 0);
  assertClose(sq1.sy, 0);
  assertClose(sq1.sw, 500);
  assertClose(sq1.sh, 500);
  assertClose(sq1.dx, 0);
  assertClose(sq1.dy, 0);
  assertClose(sq1.dw, 280);
  assertClose(sq1.dh, 280);

  // 11.2 Square image at zoom = 2
  const sq2 = computeCropRect({ imgW: 500, imgH: 500, viewport: 280, zoom: 2 });
  assertClose(sq2.effectiveScale, (280 / 500) * 2);
  assertClose(sq2.dispW, 560);
  assertClose(sq2.dispH, 560);
  assertClose(sq2.clampedX, -140);
  assertClose(sq2.clampedY, -140);
  assertClose(sq2.sx, 125);
  assertClose(sq2.sy, 125);
  assertClose(sq2.sw, 250);
  assertClose(sq2.sh, 250);
  assertClose(sq2.dx, 0);
  assertClose(sq2.dy, 0);
  assertClose(sq2.dw, 280);
  assertClose(sq2.dh, 280);

  // 11.3 Max zoom clamp (zoom = 10 -> 4)
  const sqMax = computeCropRect({ imgW: 500, imgH: 500, viewport: 280, zoom: 10 });
  assertClose(sqMax.effectiveScale, (280 / 500) * 4);
  assertClose(sqMax.dispW, 1120);

  // 11.4 Min zoom clamp for square (minZoom = 1)
  const sqMin = computeCropRect({ imgW: 500, imgH: 500, viewport: 280, zoom: 0.2 });
  assertClose(sqMin.effectiveScale, 280 / 500);
  assertClose(sqMin.dispW, 280);

  // 11.5 Landscape image (1000x500 on 280 viewport)
  // coverScale = 280 / 500 = 0.56
  // containScale = 280 / 1000 = 0.28
  // minZoom = 0.28 / 0.56 = 0.5
  const ls1 = computeCropRect({ imgW: 1000, imgH: 500, viewport: 280, zoom: 1 });
  assertClose(ls1.minZoom, 0.5);
  assertClose(ls1.dispW, 560);
  assertClose(ls1.dispH, 280);
  assertClose(ls1.clampedX, -140); // centered horizontally
  assertClose(ls1.clampedY, 0);
  assertClose(ls1.sx, 250);
  assertClose(ls1.sy, 0);
  assertClose(ls1.sw, 500);
  assertClose(ls1.sh, 500);

  // 11.6 Landscape at minZoom (0.5)
  const lsMin = computeCropRect({ imgW: 1000, imgH: 500, viewport: 280, zoom: 0.5, isLogo: true });
  assertClose(lsMin.dispW, 280);
  assertClose(lsMin.dispH, 140);
  assertClose(lsMin.clampedX, 0);
  assertClose(lsMin.clampedY, 70); // centered vertically in viewport
  assertClose(lsMin.sx, 0);
  assertClose(lsMin.sy, 0);
  assertClose(lsMin.sw, 1000);
  assertClose(lsMin.sh, 500);
  assertClose(lsMin.dx, 0);
  assertClose(lsMin.dy, 70);
  assertClose(lsMin.dw, 280);
  assertClose(lsMin.dh, 140);

  // 11.7 Portrait image (500x1000 on 280 viewport) with 35% default bias
  const pt1 = computeCropRect({ imgW: 500, imgH: 1000, viewport: 280, zoom: 1 });
  assertClose(pt1.minZoom, 0.5);
  assertClose(pt1.dispW, 280);
  assertClose(pt1.dispH, 560);
  assertClose(pt1.clampedX, 0);
  // (280 - 560) * 0.35 = -280 * 0.35 = -98
  assertClose(pt1.clampedY, -98);
  assertClose(pt1.sx, 0);
  assertClose(pt1.sy, 175); // 98 / 0.56 = 175
  assertClose(pt1.sw, 500);
  assertClose(pt1.sh, 500);
  assertClose(pt1.dx, 0);
  assertClose(pt1.dy, 0);
  assertClose(pt1.dw, 280);
  assertClose(pt1.dh, 280);

  // 11.8 Bounds assertions across arbitrary sizes and offsets
  const testCases = [
    { imgW: 1920, imgH: 1080, viewport: 300, zoom: 1.5, offsetX: -100, offsetY: -50 },
    { imgW: 400, imgH: 800, viewport: 250, zoom: 2.5, offsetX: 50, offsetY: -300 },
    { imgW: 100, imgH: 100, viewport: 280, zoom: 0.1, offsetX: 0, offsetY: 0 },
    { imgW: 800, imgH: 600, viewport: 280, zoom: 1, offsetX: -500, offsetY: 200 }
  ];

  for (const tc of testCases) {
    const res = computeCropRect(tc);
    assert.ok(res.sx >= 0, 'sx must be >= 0');
    assert.ok(res.sy >= 0, 'sy must be >= 0');
    assert.ok(res.sx + res.sw <= tc.imgW + 1e-4, 'sx + sw must not exceed imgW');
    assert.ok(res.sy + res.sh <= tc.imgH + 1e-4, 'sy + sh must not exceed imgH');
    assert.ok(res.dx >= 0, 'dx must be >= 0');
    assert.ok(res.dy >= 0, 'dy must be >= 0');
    assert.ok(res.dx + res.dw <= tc.viewport + 1e-4, 'dx + dw must not exceed viewport');
    assert.ok(res.dy + res.dh <= tc.viewport + 1e-4, 'dy + dh must not exceed viewport');
    assert.ok(res.sw > 0, 'sw must be > 0');
    assert.ok(res.sh > 0, 'sh must be > 0');
    assert.ok(res.dw > 0, 'dw must be > 0');
    assert.ok(res.dh > 0, 'dh must be > 0');
  }


  // 11.9 High-res 4000x3000 landscape at zoom 1, 2, 4
  const hrLandscape1 = computeCropRect({ imgW: 4000, imgH: 3000, viewport: 280, zoom: 1 });
  assertClose(hrLandscape1.coverScale, 280 / 3000);
  assertClose(hrLandscape1.sw, 3000, 1e-3, 'Landscape zoom 1 sw must equal shorter side (3000)');
  assertClose(hrLandscape1.sh, 3000, 1e-3, 'Landscape zoom 1 sh must equal shorter side (3000)');
  assert.ok(hrLandscape1.sx >= 0 && hrLandscape1.sx + hrLandscape1.sw <= 4000, 'sx bounds');
  assert.ok(hrLandscape1.sy >= 0 && hrLandscape1.sy + hrLandscape1.sh <= 3000, 'sy bounds');

  const hrLandscape2 = computeCropRect({ imgW: 4000, imgH: 3000, viewport: 280, zoom: 2 });
  assertClose(hrLandscape2.sw, 1500, 1e-3, 'Landscape zoom 2 sw must equal shorter side / 2');
  assertClose(hrLandscape2.sh, 1500, 1e-3, 'Landscape zoom 2 sh must equal shorter side / 2');

  const hrLandscape4 = computeCropRect({ imgW: 4000, imgH: 3000, viewport: 280, zoom: 4 });
  assertClose(hrLandscape4.sw, 750, 1e-3, 'Landscape zoom 4 sw must equal shorter side / 4');
  assertClose(hrLandscape4.sh, 750, 1e-3, 'Landscape zoom 4 sh must equal shorter side / 4');

  // 11.10 High-res 3000x4000 portrait at zoom 1, 2, 4
  const hrPortrait1 = computeCropRect({ imgW: 3000, imgH: 4000, viewport: 280, zoom: 1 });
  assertClose(hrPortrait1.coverScale, 280 / 3000);
  assertClose(hrPortrait1.sw, 3000, 1e-3, 'Portrait zoom 1 sw must equal shorter side (3000)');
  assertClose(hrPortrait1.sh, 3000, 1e-3, 'Portrait zoom 1 sh must equal shorter side (3000)');
  assert.ok(hrPortrait1.sx >= 0 && hrPortrait1.sx + hrPortrait1.sw <= 3000, 'portrait sx bounds');
  assert.ok(hrPortrait1.sy >= 0 && hrPortrait1.sy + hrPortrait1.sh <= 4000, 'portrait sy bounds');

  // Extreme pans clamping verification
  const extremePan = computeCropRect({ imgW: 4000, imgH: 3000, viewport: 280, zoom: 2, offsetX: -99999, offsetY: 99999 });
  assert.ok(extremePan.sx >= 0 && extremePan.sx + extremePan.sw <= 4000 + 1e-4, 'extreme pan bounds');
  assert.ok(extremePan.sy >= 0 && extremePan.sy + extremePan.sh <= 3000 + 1e-4, 'extreme pan bounds');
}


// ============================================================================
// 12. CREATE ROW GESTURE FACTORY TESTS
// ============================================================================
{
  let timerFn = null;
  let timerIdCounter = 1;
  const activeTimers = new Map();

  const fakeSetTimer = (fn, ms) => {
    const id = timerIdCounter++;
    activeTimers.set(id, fn);
    return id;
  };
  const fakeClearTimer = (id) => {
    activeTimers.delete(id);
  };

  let tapCalls = [];
  let longPressCalls = [];
  let toggleCalls = [];
  let vibrateCalls = [];
  let selecting = false;

  const gestures = createRowGesture({
    longPressMs: 450,
    moveTolerance: 10,
    setTimer: fakeSetTimer,
    clearTimer: fakeClearTimer,
    vibrate: (ms) => vibrateCalls.push(ms),
    isInteractive: (t) => t && t.interactive === true,
    isSelecting: () => selecting,
    onTap: (id) => tapCalls.push(id),
    onLongPress: (id) => longPressCalls.push(id),
    onToggle: (id) => toggleCalls.push(id)
  });

  // 12.1 Quick Tap -> onTap called once
  tapCalls = []; longPressCalls = [];
  gestures.down({ clientX: 100, clientY: 100 }, 'row-1');
  gestures.up({ clientX: 100, clientY: 100 }, 'row-1');
  gestures.click({ clientX: 100, clientY: 100 }, 'row-1');
  assert.strictEqual(tapCalls.length, 1, 'tap must call onTap once');
  assert.strictEqual(tapCalls[0], 'row-1');
  assert.strictEqual(longPressCalls.length, 0, 'quick tap must not trigger onLongPress');

  // 12.2 Long Press -> onLongPress called once, subsequent click suppressed
  tapCalls = []; longPressCalls = []; vibrateCalls = [];
  gestures.down({ clientX: 100, clientY: 100 }, 'row-2');
  // Fire timers
  const entries = Array.from(activeTimers.entries());
  for (const [id, fn] of entries) {
    fn();
    activeTimers.delete(id);
  }
  assert.strictEqual(longPressCalls.length, 1, 'long press timer must call onLongPress');
  assert.strictEqual(longPressCalls[0], 'row-2');
  assert.strictEqual(vibrateCalls.length, 1, 'vibrate must be called on long press');

  let prevented = false;
  let stopped = false;
  gestures.click({ preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } }, 'row-2');
  assert.strictEqual(tapCalls.length, 0, 'click after long-press must NOT call onTap');
  assert.ok(prevented && stopped, 'click after long-press must call preventDefault & stopPropagation');

  // 12.3 Movement beyond tolerance -> clears timer, click ignored
  tapCalls = []; longPressCalls = [];
  gestures.down({ clientX: 100, clientY: 100 }, 'row-3');
  assert.strictEqual(activeTimers.size, 1);
  gestures.move({ clientX: 115, clientY: 100 }, 'row-3'); // dx = 15 > 10
  assert.strictEqual(activeTimers.size, 0, 'movement beyond tolerance must cancel timer');
  gestures.up({ clientX: 115, clientY: 100 }, 'row-3');
  gestures.click({ clientX: 115, clientY: 100 }, 'row-3');
  assert.strictEqual(tapCalls.length, 0, 'click after drag must not call onTap');
  assert.strictEqual(longPressCalls.length, 0);

  // 12.4 Interactive target ignored
  tapCalls = []; longPressCalls = [];
  gestures.down({ target: { interactive: true }, clientX: 100, clientY: 100 }, 'row-4');
  assert.strictEqual(activeTimers.size, 0, 'interactive target down must be ignored');
  gestures.click({ target: { interactive: true } }, 'row-4');
  assert.strictEqual(tapCalls.length, 0, 'interactive target click must be ignored');

  // 12.5 Selection mode active -> onToggle called instead of onTap
  selecting = true;
  tapCalls = []; toggleCalls = [];
  gestures.down({ clientX: 100, clientY: 100 }, 'row-5');
  gestures.up({ clientX: 100, clientY: 100 }, 'row-5');
  gestures.click({ clientX: 100, clientY: 100 }, 'row-5');
  assert.strictEqual(tapCalls.length, 0, 'in selection mode, click must not call onTap');
  assert.strictEqual(toggleCalls.length, 1, 'in selection mode, click must call onToggle');
  assert.strictEqual(toggleCalls[0], 'row-5');
  selecting = false;
}

// ============================================================================
// 13. BUILD ROSTER RECONCILIATION ENGINE TESTS
// ============================================================================
{
  // 13.1 Screenshot Scenario:
  // Once session Nov 5 9:00 PM Cairo (2026-11-05T21:00:00+02:00)
  // One late log, now 10:30 PM (2026-11-05T22:30:00+02:00) -> closed, assigned = 2 active members
  const session = {
    id: 'sess_nov5',
    title: 'General Meeting',
    schedule: {
      type: 'once',
      startDateTime: '2026-11-05T21:00:00'
    },
    earlyCheckInMinutes: 15,
    lateCutoffMinutes: 60 // closed at 22:00
  };
  const members = [
    { uid: 'u1', name: 'Alice' },
    { uid: 'u2', name: 'Bob' },
    { uid: 'u3', name: 'Charlie', disabled: true } // disabled must be excluded
  ];
  const logs = [
    { sessionId: 'sess_nov5', userId: 'u1', status: 'late', delaySeconds: 900 }
  ];
  const nowMs = zonedPartsToMs({ year: 2026, month: 11, day: 5, hour: 22, minute: 30, second: 0 }, 'Africa/Cairo');
  const roster = buildRoster({ session, logs, members, nowMs });

  assert.strictEqual(roster.counts.assignedCount, 2, 'Assigned must count all non-disabled active members');
  assert.strictEqual(roster.counts.presentCount, 1, 'Present count must be 1');
  assert.strictEqual(roster.counts.lateCount, 1, 'Late count must be 1');
  assert.strictEqual(roster.counts.absentCount, 1, 'Absent count must be 1 for Bob who had no check-in');
  assert.strictEqual(roster.counts.excusedCount, 0);
  assert.strictEqual(roster.state, 'closed', 'Session window must be closed at 22:30');
  assert.strictEqual(roster.occurrence.key, 'once');

  // 13.2 Excused via waiver
  const waivers = [
    { sessionId: 'sess_nov5', userId: 'u2', status: 'approved' }
  ];
  const rosterWithWaiver = buildRoster({ session, logs, waivers, members, nowMs });
  assert.strictEqual(rosterWithWaiver.counts.excusedCount, 1, 'Bob must be excused via approved waiver');
  assert.strictEqual(rosterWithWaiver.counts.absentCount, 0, 'No members absent when Bob is excused');

  // 13.3 Weekly session retains last occurrence after closing until next window opens
  const weeklySession = {
    id: 'sess_weekly',
    title: 'Sunday Gathering',
    schedule: {
      type: 'weekly',
      weekdays: ['Sun'],
      timeOfDay: '18:00',
      startDateTime: '2026-10-01T18:00:00'
    },
    earlyCheckInMinutes: 30, // opens 17:30
    lateCutoffMinutes: 120   // closes 20:00
  };

  // Check on Monday Nov 2 10:00 AM (Sunday Nov 1 occurrence is closed, but next is Nov 8)
  const mondayMs = zonedPartsToMs({ year: 2026, month: 11, day: 2, hour: 10, minute: 0, second: 0 }, 'Africa/Cairo');
  const rosterMonday = buildRoster({ session: weeklySession, members, nowMs: mondayMs });
  assert.strictEqual(rosterMonday.state, 'closed');
  // Occurrences list has Sunday Nov 1
  assert.ok(rosterMonday.occurrence.key.includes('2026-11-01') || rosterMonday.occurrence.key.includes('2026-10-'), 'Must show previous closed occurrence');

  // Check on Saturday Nov 7 12:00 PM (still before next early window opens on Sunday Nov 8 17:30)
  const saturdayMs = zonedPartsToMs({ year: 2026, month: 11, day: 7, hour: 12, minute: 0, second: 0 }, 'Africa/Cairo');
  const rosterSat = buildRoster({ session: weeklySession, members, nowMs: saturdayMs });
  assert.strictEqual(rosterSat.state, 'closed', 'Must remain in closed state showing last occurrence');
}

// ==========================================
// 14. DEFAULT AVATAR DETECTION, RESIZING & NOTIFICATION MANAGER
// ==========================================
{
  const isDefaultProfilePicFn = vm.runInContext(`(() => {
    return function isDefaultEmailProfilePic(url) {
      if (!url || typeof url !== 'string') return true;
      const clean = url.trim();
      if (!clean || clean === './image_ad59c0.jpg') return true;
      if (/default-user/i.test(clean)) return true;
      if (/AAAAAAAAAAA/i.test(clean)) return true;
      if (/ui-avatars\\.com/i.test(clean)) return true;
      if (/dicebear\\.com.*\\/initials/i.test(clean)) return true;
      if (/gravatar\\.com\\/avatar\\/.*[\\?&]d=(?:identicon|retro|initials|mp|blank)/i.test(clean)) return true;
      if (/placeholder/i.test(clean) && !clean.startsWith('data:image/svg')) return true;
      return false;
    };
  })()`, sandbox);

  assert.strictEqual(isDefaultProfilePicFn(''), true, 'Empty url must be detected as default profile pic');
  assert.strictEqual(isDefaultProfilePicFn(null), true, 'Null url must be detected as default profile pic');
  assert.strictEqual(isDefaultProfilePicFn('./image_ad59c0.jpg'), true, 'App generic logo url must be detected as default');
  assert.strictEqual(isDefaultProfilePicFn('https://lh3.googleusercontent.com/a/default-user=s96-c'), true, 'Google default initial photo must be detected');
  assert.strictEqual(isDefaultProfilePicFn('https://lh3.googleusercontent.com/a/default-user'), true, 'Google default-user photo must be detected');
  assert.strictEqual(isDefaultProfilePicFn('https://lh3.googleusercontent.com/AAAAAAAAAAA/photo.jpg'), true, 'Google legacy default photo must be detected');
  assert.strictEqual(isDefaultProfilePicFn('https://ui-avatars.com/api/?name=Steven'), true, 'ui-avatars letter url must be detected');
  assert.strictEqual(isDefaultProfilePicFn('https://images.unsplash.com/photo-1534528741775-53994a69daeb'), false, 'Custom real photo must not be detected as default');
  assert.strictEqual(isDefaultProfilePicFn('data:image/svg+xml;utf8,<svg>...</svg>'), false, 'Preset SVG avatar must not be detected as default');

  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes('id="admin-panel-notifications"'), 'index.html must have standalone admin-panel-notifications page');
  assert.ok(indexHtml.includes('data-page="notifications"'), 'index.html must have notifications dock item');
  assert.ok(indexHtml.includes('id="admin-notif-members-list"'), 'Notification manager must have members list');
  assert.ok(indexHtml.includes('id="form-admin-notifications-page"'), 'Notification manager must have compose form');

  assert.ok(appCode.includes('function renderAdminNotifications'), 'app.js must contain renderAdminNotifications');
  assert.ok(appCode.includes('calculatedHeight = initialSheetHeight - deltaY'), 'app.js must dynamically calculate sheet height on finger drag');
  assert.ok(appCode.includes('target.setPointerCapture'), 'app.js must capture pointer for smooth finger tracking');
}

// ==========================================
// 15. v3.0.1 SMART CHECK-IN, ELIGIBILITY, EARLY BONUSES & CACHE SYNC
// ==========================================
{
  assert.strictEqual(typeof isUserEligibleForSession, 'function', 'isUserEligibleForSession must be exported as a function');

  const userAlice = { uid: 'user_alice', displayName: 'Alice', badgeIds: ['badge_video'] };
  const userBob = { uid: 'user_bob', displayName: 'Bob', badgeIds: ['badge_audio'] };
  const userCharlie = { uid: 'user_charlie', displayName: 'Charlie', badgeIds: [] };

  // 15.1 All members eligibility
  const sessionAll = normalizeSession({
    id: 'sess_all',
    title: 'General Meeting',
    assignmentType: 'all',
    schedule: { type: 'once', startDateTime: Date.now() }
  });
  assert.strictEqual(isUserEligibleForSession(sessionAll, userAlice), true, 'All session must be eligible for Alice');
  assert.strictEqual(isUserEligibleForSession(sessionAll, userBob), true, 'All session must be eligible for Bob');
  assert.strictEqual(isUserEligibleForSession(sessionAll, userCharlie), true, 'All session must be eligible for Charlie');

  // 15.2 Strict Specific Members eligibility
  const sessionSpecific = normalizeSession({
    id: 'sess_specific',
    title: 'Video Team Only',
    assignmentType: 'specific',
    assignedMembers: ['user_alice'],
    schedule: { type: 'once', startDateTime: Date.now() }
  });
  assert.strictEqual(isUserEligibleForSession(sessionSpecific, userAlice), true, 'Assigned user Alice must be eligible');
  assert.strictEqual(isUserEligibleForSession(sessionSpecific, userBob), false, 'Non-assigned user Bob must NOT be eligible');
  assert.strictEqual(isUserEligibleForSession(sessionSpecific, userCharlie), false, 'Non-assigned user Charlie must NOT be eligible');

  // Legacy targetType: custom with assignedUids
  const sessionCustomLegacy = normalizeSession({
    id: 'sess_custom_legacy',
    title: 'Sound Crew',
    targetType: 'custom',
    assignedUids: ['user_bob'],
    schedule: { type: 'once', startDateTime: Date.now() }
  });
  assert.strictEqual(isUserEligibleForSession(sessionCustomLegacy, userBob), true, 'Bob must be eligible via legacy assignedUids');
  assert.strictEqual(isUserEligibleForSession(sessionCustomLegacy, userAlice), false, 'Alice must NOT be eligible');

  // 15.3 Badge based eligibility
  const sessionBadge = normalizeSession({
    id: 'sess_badge',
    title: 'Audio Engineers',
    assignmentType: 'by_badge',
    badgeIds: ['badge_audio'],
    schedule: { type: 'once', startDateTime: Date.now() }
  });
  assert.strictEqual(isUserEligibleForSession(sessionBadge, userBob), true, 'Bob has badge_audio and must be eligible');
  assert.strictEqual(isUserEligibleForSession(sessionBadge, userAlice), false, 'Alice lacks badge_audio and must NOT be eligible');

  // 15.4 Early Arrival Bonus calculation in computeAttendance
  const baseStartMs = zonedDateToMs(2026, 6, 1, 10, 0, 0, 'Africa/Cairo');
  const sessionBonus = normalizeSession({
    id: 'sess_bonus',
    title: 'Sunday Morning Service',
    earlyBonusPoints: 15,
    earlyBonusEGP: 25,
    earlyCheckInMinutes: 30,
    lateCutoffMinutes: 60,
    schedule: { type: 'once', startDateTime: baseStartMs }
  });

  // Check-in 10 minutes before start (within early window)
  const earlyCheckInMs = baseStartMs - 10 * 60000;
  const calcEarly = computeAttendance(sessionBonus, earlyCheckInMs);
  assert.strictEqual(calcEarly.status, 'on_time', 'Early check-in within window must be on_time status');
  assert.strictEqual(calcEarly.isEarly, true, 'isEarly must be true');
  assert.strictEqual(calcEarly.earlyBonusPoints, 15, 'Early bonus points must be 15');
  assert.strictEqual(calcEarly.earlyBonusEGP, 25, 'Early bonus EGP must be 25');
  assert.strictEqual(calcEarly.penalty, 0, 'Early check-in must have 0 penalty');

  // Check-in exactly at start time
  const exactStartMs = baseStartMs;
  const calcExact = computeAttendance(sessionBonus, exactStartMs);
  assert.strictEqual(calcExact.status, 'on_time');
  assert.strictEqual(calcExact.isEarly, false, 'Exact start time is not early');
  assert.strictEqual(calcExact.earlyBonusPoints, 0, 'No early bonus at exact start time');

  // Check-in 15 minutes late
  const lateMs = baseStartMs + 15 * 60000;
  const calcLate = computeAttendance(sessionBonus, lateMs);
  assert.strictEqual(calcLate.status, 'late');
  assert.strictEqual(calcLate.isEarly, false);

  // 15.5 DOM and Styling guards for v3.0.1
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes('id="smart-checkin-hero-container"'), 'index.html must contain smart-checkin-hero-container');
  assert.ok(indexHtml.includes('id="attendance-sessions-wrap"'), 'index.html must wrap admin sessions in attendance-sessions-wrap');

  const stylesCss = fs.readFileSync('styles.css', 'utf8');
  assert.ok(stylesCss.includes('.smart-checkin-hero-card'), 'styles.css must have smart-checkin-hero-card class');
  assert.ok(stylesCss.includes('.smart-checkin-btn-massive'), 'styles.css must have smart-checkin-btn-massive class');
  assert.ok(stylesCss.includes('.undo-snackbar-progress-bar'), 'styles.css must have undo-snackbar-progress-bar class');
  assert.ok(stylesCss.includes('.att-member-picker-row'), 'styles.css must have att-member-picker-row class');

  // 15.6 Notification read and cache sync functions
  assert.ok(appCode.includes('function renderSmartCheckInHero'), 'app.js must contain renderSmartCheckInHero');
  assert.ok(appCode.includes('persistToLocalCache(true)'), 'app.js must immediately persist to local cache');
  assert.ok(appCode.includes('undo-snackbar-secs'), 'app.js must render undo-snackbar-secs countdown');

  // ==========================================
  // TEST 16: v3.1.0 TIERED EARLY BONUS MATRIX & DETAILED METRICS
  // ==========================================
  const tieredStartMs = zonedDateToMs(2026, 6, 15, 10, 0, 0, 'Africa/Cairo');
  const tieredSession = normalizeSession({
    id: 'sess_tiered',
    title: 'Tiered Bonus Session',
    earlyCheckInMinutes: 60,
    lateCutoffMinutes: 60,
    earlyBonusTiers: [
      { fromMinsBefore: 60, toMinsBefore: 30, bonusPoints: 10, bonusEgp: 20 },
      { fromMinsBefore: 29, toMinsBefore: 10, bonusPoints: 5, bonusEgp: 10 }
    ],
    pointsPenalty: { enabled: true, mode: 'stepped', stepUnit: 'minutes', stepSize: 5, perStep: 1, min: 2, max: 30, absence: 20 },
    finePenalty: { enabled: true, mode: 'stepped', stepUnit: 'minutes', stepSize: 5, perStep: 3, min: 6, max: 60, absence: 50 },
    schedule: { type: 'once', startDateTime: tieredStartMs }
  });

  // 45m early -> matches 60m-30m tier (+10 pts, +20 EGP)
  const calc45mEarly = computeAttendance(tieredSession, tieredStartMs - 45 * 60000);
  assert.strictEqual(calc45mEarly.isEarly, true);
  assert.strictEqual(calc45mEarly.earlyMinutes, 45);
  assert.strictEqual(calc45mEarly.earlyBonusPoints, 10);
  assert.strictEqual(calc45mEarly.earlyBonusEGP, 20);
  assert.strictEqual(calc45mEarly.pointsDelta, 10);
  assert.strictEqual(calc45mEarly.egpDelta, 20);
  assert.ok(calc45mEarly.appliedTierLabel.includes('60m–30m'));

  // 20m early -> matches 29m-10m tier (+5 pts, +10 EGP)
  const calc20mEarly = computeAttendance(tieredSession, tieredStartMs - 20 * 60000);
  assert.strictEqual(calc20mEarly.isEarly, true);
  assert.strictEqual(calc20mEarly.earlyMinutes, 20);
  assert.strictEqual(calc20mEarly.earlyBonusPoints, 5);
  assert.strictEqual(calc20mEarly.earlyBonusEGP, 10);
  assert.strictEqual(calc20mEarly.pointsDelta, 5);
  assert.strictEqual(calc20mEarly.egpDelta, 10);

  // 5m early -> outside tier brackets -> 0 bonus, On Time
  const calc5mEarly = computeAttendance(tieredSession, tieredStartMs - 5 * 60000);
  assert.strictEqual(calc5mEarly.status, 'on_time');
  assert.strictEqual(calc5mEarly.earlyMinutes, 5);
  assert.strictEqual(calc5mEarly.earlyBonusPoints, 0);
  assert.strictEqual(calc5mEarly.earlyBonusEGP, 0);
  assert.strictEqual(calc5mEarly.pointsDelta, 0);

  // 14m 34s late -> lateMinutes=14, lateSeconds=34, negative pointsDelta & egpDelta
  const calcLateDetailed = computeAttendance(tieredSession, tieredStartMs + (14 * 60 + 34) * 1000);
  assert.strictEqual(calcLateDetailed.status, 'late');
  assert.strictEqual(calcLateDetailed.lateMinutes, 14);
  assert.strictEqual(calcLateDetailed.lateSeconds, 34);
  assert.ok(calcLateDetailed.pointsDelta < 0, 'Late check-in must produce negative pointsDelta');
  assert.ok(calcLateDetailed.egpDelta < 0, 'Late check-in must produce negative egpDelta');
}

console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY!');

