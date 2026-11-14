/**
 * CoC Media Team - Dedicated Serverless Backend (v3.2.0)
 * Unified Task & Attendance Watchdog, Server-Time Tier & Grace Engine, Canonical Ledger Sync & FCM v1 Web Push
 * Deployed on Google Apps Script via @google/clasp
 */

const CONFIG = {
  FIREBASE_PROJECT_ID: "coc-media-team",
  PRE_SESSION_BUFFER_MINUTES: 15,
  MAX_DAILY_AUTO_CLOSE_CHECK: 50,
  TIMEZONE: "Africa/Cairo",
  PWA_URL: "https://stevenmario.github.io/COC-Media-Team/"
};

let _scriptLockHeld = false;

/**
 * Concurrency Guardrail: Acquires ScriptLock (up to timeoutMs) to prevent overlapping
 * webhook dispatches and time-driven triggers from double-evaluating or double-penalizing.
 */
function runWithScriptLock(label, fn, timeoutMs = 10000) {
  if (_scriptLockHeld) {
    return fn();
  }
  const lock = (typeof LockService !== "undefined" && LockService && typeof LockService.getScriptLock === "function")
    ? LockService.getScriptLock()
    : null;
  if (!lock) {
    return fn();
  }
  const acquired = lock.tryLock(timeoutMs);
  if (!acquired) {
    console.warn(`[ScriptLock] Could not acquire lock for ${label} within ${timeoutMs}ms; skipping concurrent execution.`);
    return { skipped: true, reason: "lock_busy", label: label };
  }
  _scriptLockHeld = true;
  try {
    return fn();
  } finally {
    _scriptLockHeld = false;
    try {
      lock.releaseLock();
    } catch (releaseErr) {
      console.warn(`[ScriptLock] Release warning for ${label}:`, releaseErr);
    }
  }
}

// -------------------------------------------------------------
// HTTP ROUTER (WEBHOOK & HEALTH CHECK)
// -------------------------------------------------------------
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    version: "3.2.0",
    system: "CoC Media Unified Task & Attendance Backend Watchdog",
    timezone: CONFIG.TIMEZONE,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const rawData = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(rawData);
    const action = payload.action || "";

    if (
      action === "SESSION_UPDATED" ||
      action === "TASK_UPDATED" ||
      action === "FORCE_EVALUATE" ||
      action === "EVALUATE_TASKS_NOW"
    ) {
      const evalSummary = syncAndEvaluateAll();
      return jsonResponse({
        status: "success",
        message: "Unified task & session schedules evaluated and synchronized successfully.",
        result: evalSummary
      });
    }

    if (action === "MANUAL_CLOSE_SESSION" && payload.sessionId) {
      const result = closeSessionAndApplyPenalties(payload.sessionId, null, payload.occurrenceKey || null);
      return jsonResponse({
        status: "success",
        message: `Session ${payload.sessionId} closed and penalties processed.`,
        result: result
      });
    }

    if (action === "MANUAL_CLOSE_TASK" && payload.taskId) {
      const result = closeTaskAndApplyPenalties(payload.taskId, null, payload.occurrenceKey || null);
      return jsonResponse({
        status: "success",
        message: `Task ${payload.taskId} closed and missed penalties processed.`,
        result: result
      });
    }

    if (action === "PROCESS_CHECKIN") {
      const result = handleProcessCheckIn(payload);
      return jsonResponse({
        status: "success",
        message: "Check-in evaluated by server authority and member ledger synchronized.",
        result: result
      });
    }

    if (action === "PROCESS_TASK_SUBMISSION") {
      const result = handleProcessTaskSubmission(payload);
      return jsonResponse({
        status: "success",
        message: "Task submission evaluated by server authority and member ledger synchronized.",
        result: result
      });
    }

    if (action === "DELETE_LOG" || action === "REVERSE_LOG") {
      const result = deleteAttendanceLogAndReverse(payload);
      return jsonResponse({
        status: "success",
        message: "Attendance log deleted and member ledger reversed.",
        result: result
      });
    }

    if (action === "DISPATCH_NOTIFICATION") {
      const result = handleDispatchNotification(payload);
      return jsonResponse({
        status: "success",
        message: `Notification dispatched to ${result.recipientCount} recipient(s).`,
        result: result
      });
    }

    if (action === "REGISTER_PUSH_TOKEN") {
      const result = handleRegisterPushToken(payload);
      return jsonResponse({
        status: "success",
        message: "Push token state updated.",
        result: result
      });
    }

    if (action === "GET_ALL_ATTENDANCE_LOGS" || action === "LIST_ALL_LOGS") {
      const logs = firestoreList("attendance_logs", 250);
      const records = firestoreList("attendance_records", 250);
      const mergedMap = {};
      records.forEach(r => { if (r && r.id) mergedMap[r.id] = r; });
      logs.forEach(l => { if (l && l.id) mergedMap[l.id] = { ...(mergedMap[l.id] || {}), ...l }; });
      return jsonResponse({
        status: "success",
        logs: Object.values(mergedMap)
      });
    }

    if (action === "UPDATE_LOG") {
      const result = updateAttendanceLogAndSyncLedger(payload);
      return jsonResponse({
        status: "success",
        message: "Attendance log updated and member ledger synchronized.",
        result: result
      });
    }

    return jsonResponse({
      status: "ignored",
      reason: "Unknown action: " + action
    });

  } catch (err) {
    console.error("doPost error:", err);
    return jsonResponse({
      status: "error",
      error: err && err.message ? err.message : err.toString()
    });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// CAIRO TIMEZONE & RECURRENCE ENGINE (UNIFIED FOR TASKS & SESSIONS)
// -------------------------------------------------------------
const ENGINE_WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const SAT_OFFSET = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };

function parseDateTimeToMs(val, timeZone = CONFIG.TIMEZONE) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  if (typeof val === "object") {
    if (typeof val.toMillis === "function") return val.toMillis();
    if (typeof val.seconds === "number") return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
  }
  if (typeof val === "string") {
    if (val.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(val)) {
      return Date.parse(val) || 0;
    }
    const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
      return zonedDateToMs(
        parseInt(m[1], 10),
        parseInt(m[2], 10),
        parseInt(m[3], 10),
        m[4] ? parseInt(m[4], 10) : 0,
        m[5] ? parseInt(m[5], 10) : 0,
        m[6] ? parseInt(m[6], 10) : 0,
        timeZone
      );
    }
    return Date.parse(val) || 0;
  }
  return 0;
}

function getZonedParts(dateOrMs, timeZone = CONFIG.TIMEZONE) {
  const ms = parseDateTimeToMs(dateOrMs, timeZone);
  const d = new Date(ms || 0);
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
      hour12: false
    });
    const parts = dtf.formatToParts(d);
    const map = {};
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.type !== "literal") map[p.type] = p.value;
    }
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour === "24" ? "0" : map.hour, 10),
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
      weekday: map.weekday
    };
  }
  const formatted = Utilities.formatDate(d, timeZone, "yyyy-M-d-H-m-s-E");
  const sp = formatted.split("-");
  return {
    year: parseInt(sp[0], 10),
    month: parseInt(sp[1], 10),
    day: parseInt(sp[2], 10),
    hour: parseInt(sp[3], 10),
    minute: parseInt(sp[4], 10),
    second: parseInt(sp[5], 10),
    weekday: sp[6].slice(0, 3)
  };
}

function zonedDateToMs(year, month, day, hour = 0, minute = 0, second = 0, timeZone = CONFIG.TIMEZONE) {
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(guessMs, timeZone);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const currentZonedUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = targetUtc - currentZonedUtc;
    if (diff === 0) break;
    guessMs += diff;
  }
  return guessMs;
}

function formatZonedDateKey(dateOrMs, timeZone = CONFIG.TIMEZONE) {
  const p = getZonedParts(dateOrMs, timeZone);
  const y = String(p.year).padStart(4, "0");
  const m = String(p.month).padStart(2, "0");
  const d = String(p.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekKeyOf(ms, tz = CONFIG.TIMEZONE) {
  const validMs = parseDateTimeToMs(ms, tz);
  const p = getZonedParts(validMs, tz);
  const offset = SAT_OFFSET[p.weekday] != null ? SAT_OFFSET[p.weekday] : 0;
  const satMs = zonedDateToMs(p.year, p.month, p.day - offset, 12, 0, 0, tz);
  const satParts = getZonedParts(satMs, tz);
  return `${String(satParts.year).padStart(4, "0")}-${String(satParts.month).padStart(2, "0")}-${String(satParts.day).padStart(2, "0")}`;
}

function monthKeyOf(ms, tz = CONFIG.TIMEZONE) {
  const validMs = parseDateTimeToMs(ms, tz);
  const p = getZonedParts(validMs, tz);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}`;
}

function normalizeScheduleObject(input) {
  if (!input) return { type: "once", startDateTime: 0, days: [], monthDates: [], weeks: [], weekdays: [] };
  if (typeof input === "string") return { type: input, startDateTime: 0, days: [], monthDates: [], weeks: [], weekdays: [] };
  const type = input.type || "once";
  const days = Array.isArray(input.days) && input.days.length > 0
    ? input.days
    : (Array.isArray(input.weekdays) && type === "weekly" ? input.weekdays : []);
  const monthDates = Array.isArray(input.monthDates) && input.monthDates.length > 0
    ? input.monthDates.map(Number)
    : (Array.isArray(input.dates) ? input.dates.map(Number) : []);
  return {
    type: type,
    startDateTime: input.startDateTime || input.startTime || 0,
    days: days,
    monthDates: monthDates,
    weeks: Array.isArray(input.weeks) ? input.weeks : [],
    weekdays: Array.isArray(input.weekdays) ? input.weekdays : []
  };
}

function getOccurrencesInGas(scheduleInput, fromMs, toMs) {
  const sched = normalizeScheduleObject(scheduleInput);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  if (toMs < fromMs || (startMs > toMs && sched.type === "once")) {
    return [];
  }

  const startParts = getZonedParts(startMs, CONFIG.TIMEZONE);
  const eventHour = startParts.hour;
  const eventMinute = startParts.minute;
  const eventSecond = startParts.second;
  const results = [];

  if (sched.type === "once") {
    if (startMs >= fromMs && startMs <= toMs) {
      results.push(startMs);
    }
    return results;
  }

  const effectiveFromMs = Math.max(fromMs, startMs);
  const fromParts = getZonedParts(effectiveFromMs, CONFIG.TIMEZONE);
  const toParts = getZonedParts(toMs, CONFIG.TIMEZONE);

  if (sched.type === "daily") {
    let curYear = fromParts.year;
    let curMonth = fromParts.month;
    let curDay = fromParts.day;

    while (true) {
      const occMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, CONFIG.TIMEZONE);
      if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
        results.push(occMs);
      }
      if (occMs > toMs + 86400000) break;

      curDay++;
      const maxDays = daysInMonth(curYear, curMonth);
      if (curDay > maxDays) {
        curDay = 1;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
      if (curYear > toParts.year || (curYear === toParts.year && (curMonth > toParts.month || (curMonth === toParts.month && curDay > toParts.day)))) {
        const lastCheckMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, CONFIG.TIMEZONE);
        if (lastCheckMs <= toMs && lastCheckMs >= fromMs && lastCheckMs >= startMs) {
          results.push(lastCheckMs);
        }
        break;
      }
    }
  } else if (sched.type === "weekly") {
    const targetDays = sched.days.length > 0 ? sched.days : [startParts.weekday];
    let curYear = fromParts.year;
    let curMonth = fromParts.month;
    let curDay = fromParts.day;

    while (true) {
      const noonMs = zonedDateToMs(curYear, curMonth, curDay, 12, 0, 0, CONFIG.TIMEZONE);
      const noonParts = getZonedParts(noonMs, CONFIG.TIMEZONE);
      if (targetDays.includes(noonParts.weekday)) {
        const occMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, CONFIG.TIMEZONE);
        if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
          results.push(occMs);
        }
      }

      curDay++;
      const maxDays = daysInMonth(curYear, curMonth);
      if (curDay > maxDays) {
        curDay = 1;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
      if (curYear > toParts.year || (curYear === toParts.year && (curMonth > toParts.month || (curMonth === toParts.month && curDay > toParts.day + 1)))) {
        break;
      }
    }
  } else if (sched.type === "monthlyDates") {
    const targetDates = sched.monthDates.length > 0 ? sched.monthDates : [startParts.day];
    let curYear = fromParts.year;
    let curMonth = fromParts.month;

    while (true) {
      const maxDays = daysInMonth(curYear, curMonth);
      const resolvedDays = new Set();
      for (let i = 0; i < targetDates.length; i++) {
        const resolved = Math.min(Math.max(1, targetDates[i]), maxDays);
        resolvedDays.add(resolved);
      }
      resolvedDays.forEach(resolvedDay => {
        const occMs = zonedDateToMs(curYear, curMonth, resolvedDay, eventHour, eventMinute, eventSecond, CONFIG.TIMEZONE);
        if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
          results.push(occMs);
        }
      });

      if (curYear > toParts.year || (curYear === toParts.year && curMonth >= toParts.month)) {
        break;
      }
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  } else if (sched.type === "monthlyWeekdays") {
    const targetWeeks = sched.weeks.length > 0 ? sched.weeks : ["1st"];
    const targetWeekdays = sched.weekdays.length > 0 ? sched.weekdays : [startParts.weekday];
    let curYear = fromParts.year;
    let curMonth = fromParts.month;

    while (true) {
      const totalDays = daysInMonth(curYear, curMonth);
      const weekdayOccurrences = {};
      ENGINE_WEEKDAYS.forEach(wd => { weekdayOccurrences[wd] = []; });
      for (let day = 1; day <= totalDays; day++) {
        const noonMs = zonedDateToMs(curYear, curMonth, day, 12, 0, 0, CONFIG.TIMEZONE);
        const p = getZonedParts(noonMs, CONFIG.TIMEZONE);
        if (weekdayOccurrences[p.weekday]) {
          weekdayOccurrences[p.weekday].push(day);
        }
      }

      targetWeekdays.forEach(wd => {
        const daysList = weekdayOccurrences[wd] || [];
        targetWeeks.forEach(w => {
          let chosenDay = null;
          if (w === "1st" && daysList.length >= 1) chosenDay = daysList[0];
          else if (w === "2nd" && daysList.length >= 2) chosenDay = daysList[1];
          else if (w === "3rd" && daysList.length >= 3) chosenDay = daysList[2];
          else if (w === "4th" && daysList.length >= 4) chosenDay = daysList[3];
          else if (w === "Last" && daysList.length >= 1) chosenDay = daysList[daysList.length - 1];

          if (chosenDay !== null) {
            const occMs = zonedDateToMs(curYear, curMonth, chosenDay, eventHour, eventMinute, eventSecond, CONFIG.TIMEZONE);
            if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
              results.push(occMs);
            }
          }
        });
      });

      if (curYear > toParts.year || (curYear === toParts.year && curMonth >= toParts.month)) {
        break;
      }
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  }

  return Array.from(new Set(results)).sort((a, b) => a - b);
}

// -------------------------------------------------------------
// UNIFIED CANONICAL USER LEDGER HELPER (GUARDRAIL 3)
// -------------------------------------------------------------

/**
 * Computes and applies the canonical user ledger update across both Tasks and Attendance Sessions.
 * Strictly enforces the zero-floor invariant (Math.max(0, ...)) for points, penalties, finesDue, and netPts.
 */
function applyCanonicalUserLedgerUpdate(uid, userDoc, deltaOpts) {
  if (!uid) return null;
  const docObj = userDoc || firestoreGet(`users/${uid}`) || {};
  const nowMs = deltaOpts.nowMs || Date.now();
  const nowIso = deltaOpts.nowIso || new Date(nowMs).toISOString();

  // Separate positive points earned/reversed from penalty points added/reversed and fine EGP added/reversed
  const pointsChange = Number(deltaOpts.pointsChange) || 0;
  const penaltyChange = Number(deltaOpts.penaltyChange) || 0;
  const fineChange = Number(deltaOpts.fineChange) || 0;

  const curPts = Math.max(0, Number(docObj.points) || 0);
  const curTotalPts = Math.max(0, Number(docObj.totalPoints != null ? docObj.totalPoints : (docObj.totalEarned != null ? docObj.totalEarned : curPts)) || 0);
  const curPen = Math.max(0, Number(docObj.penalties != null ? docObj.penalties : (docObj.penaltyPoints != null ? docObj.penaltyPoints : docObj.totalPenalties)) || 0);
  const curFines = Math.max(0, Number(docObj.finesDue != null ? docObj.finesDue : (docObj.fines != null ? docObj.fines : docObj.quotas)) || 0);

  const newPoints = Math.max(0, curPts + pointsChange);
  const newTotalPoints = Math.max(0, curTotalPts + pointsChange);
  const newPenalties = Math.max(0, curPen + penaltyChange);
  const newFines = Math.max(0, curFines + fineChange);
  const newNetPts = Math.max(0, newPoints - newPenalties);

  const wk = weekKeyOf(nowMs, CONFIG.TIMEZONE);
  const mo = monthKeyOf(nowMs, CONFIG.TIMEZONE);
  const prevWeekKey = docObj.weekKey || docObj.weekBucket || docObj.lastWeekKey || "";
  const prevMonthKey = docObj.monthKey || docObj.monthBucket || docObj.lastMonthKey || "";
  const curWeekPts = prevWeekKey === wk ? Math.max(0, Number(docObj.weekPoints) || 0) : 0;
  const curMonthPts = prevMonthKey === mo ? Math.max(0, Number(docObj.monthPoints) || 0) : 0;

  const newWeekPoints = Math.max(0, curWeekPts + pointsChange);
  const newMonthPoints = Math.max(0, curMonthPts + pointsChange);

  const userPatch = {
    points: newPoints,
    totalPoints: newTotalPoints,
    totalEarned: newTotalPoints,
    penalties: newPenalties,
    penaltyPoints: newPenalties,
    totalPenalties: newPenalties,
    fines: newFines,
    finesDue: newFines,
    netPts: newNetPts,
    weekKey: wk,
    weekBucket: wk,
    lastWeekKey: wk,
    weekPoints: newWeekPoints,
    monthKey: mo,
    monthBucket: mo,
    lastMonthKey: mo,
    monthPoints: newMonthPoints,
    updatedAt: nowIso
  };

  const mask = [
    "points",
    "totalPoints",
    "totalEarned",
    "penalties",
    "penaltyPoints",
    "totalPenalties",
    "fines",
    "finesDue",
    "netPts",
    "weekKey",
    "weekBucket",
    "lastWeekKey",
    "weekPoints",
    "monthKey",
    "monthBucket",
    "lastMonthKey",
    "monthPoints",
    "updatedAt"
  ];

  if (deltaOpts.lastOpId) {
    userPatch.lastOpId = String(deltaOpts.lastOpId);
    mask.push("lastOpId");
  }

  firestorePatch(`users/${uid}`, userPatch, mask);

  if (fineChange !== 0) {
    firestorePatch(`users_private/${uid}`, {
      finesEGP: newFines,
      finesDue: newFines,
      fines: newFines,
      updatedAt: nowIso
    }, ["finesEGP", "finesDue", "fines", "updatedAt"]);
  }

  return userPatch;
}

// -------------------------------------------------------------
// ADAPTIVE CRON LOOPS & UNIFIED WATCHDOG (SESSIONS + TASKS)
// -------------------------------------------------------------

/**
 * Base Watchdog: Runs every 5 minutes in idle periods.
 */
function watchdog5Min() {
  console.log("[Watchdog 5-Min] Checking active and upcoming sessions & tasks...");
  syncAndEvaluateAll();
  processScheduledNotifications();
}

/**
 * High-Frequency Heartbeat: Runs every 1 minute strictly during active/upcoming sessions or tasks.
 */
function sessionHeartbeat1Min() {
  console.log("[Heartbeat 1-Min] Inspecting active sessions & tasks...");
  const result = syncAndEvaluateAll();
  if (!result || !result.hasActiveOrUpcoming) {
    console.log("[Heartbeat 1-Min] No remaining active sessions/tasks. De-escalating triggers to 5-min watchdog...");
    setOneMinuteTriggerActive(false);
  }
}

/**
 * Backwards-compatible alias for syncAndEvaluateAll().
 */
function syncAndEvaluateSessions() {
  return syncAndEvaluateAll();
}

/**
 * Evaluates all active attendance_sessions AND tasks under a ScriptLock (Guardrail 2)
 * to auto-close expired windows, apply missed penalties/fines, send opening window alerts,
 * and determine if the 1-minute heartbeat trigger should be active.
 */
function syncAndEvaluateAll() {
  return runWithScriptLock("syncAndEvaluateAll", function () {
    const now = new Date();
    const nowMs = now.getTime();
    const allSessions = fetchSessionsFromFirestore();
    const allTasks = fetchTasksFromFirestore();
    let hasActiveOrUpcoming = false;
    let allUsersCache = null;

    // A. Evaluate Attendance Sessions
    allSessions.forEach(session => {
      if (session.archived || session.status === "closed" || session.status === "archived" || session.active === false) {
        return;
      }

      const occ = resolveSessionWindow(session, nowMs);
      if (!occ) return;

      const startMs = occ.startMs;
      const cutoffMs = occ.cutoffMs;
      const openWindowMs = occ.openWindowMs;
      const occurrenceKey = occ.occurrenceKey;

      // 1. Check if session has passed cutoff -> Auto-Close & Apply Penalties
      if (cutoffMs && nowMs >= cutoffMs) {
        const closedKey = session.lastAutoClosedKey || "";
        if (session.status !== "closed" && closedKey !== occurrenceKey) {
          console.log(`[Watchdog] Session ${session.id} reached cutoff (${new Date(cutoffMs).toISOString()}). Closing...`);
          closeSessionAndApplyPenalties(session.id, session, occurrenceKey);
        }
        return;
      }

      // 2. Check if session is inside its early check-in opening window -> Send Opening Push once per occurrence
      if (startMs && nowMs >= openWindowMs && nowMs <= cutoffMs) {
        hasActiveOrUpcoming = true;
        const notifiedKey = session.lastOpenNotifiedKey || "";
        if (notifiedKey !== occurrenceKey) {
          if (!allUsersCache) allUsersCache = fetchApprovedUsers();
          notifySessionWindowOpened(session, occ, allUsersCache);
        }
      } else if (startMs) {
        const preBufferMs = startMs - (CONFIG.PRE_SESSION_BUFFER_MINUTES * 60 * 1000);
        if (nowMs >= preBufferMs && nowMs < cutoffMs) {
          hasActiveOrUpcoming = true;
        }
      }
    });

    // B. Evaluate Tasks
    allTasks.forEach(task => {
      if (!task || task.archived || task.status === "archived" || task.active === false) {
        return;
      }

      const windowsToInspect = getTaskWindowsForWatchdog(task, nowMs);
      windowsToInspect.forEach(win => {
        if (!win) return;
        const startMs = win.start;
        const cutoffMs = win.cutoffMs;
        const occurrenceKey = win.occurrenceKey;

        // 1. Check if task occurrence has passed deadline/grace cutoff -> Auto-Close & Apply Missed Task Penalties
        if (!win.isPermanent && cutoffMs && nowMs >= cutoffMs) {
          const closedKey = task.lastAutoClosedKey || task.lastClosedOccurrenceKey || "";
          if (closedKey !== occurrenceKey) {
            console.log(`[Watchdog] Task ${task.id} (${occurrenceKey}) reached cutoff (${new Date(cutoffMs).toISOString()}). Applying missed penalties...`);
            closeTaskAndApplyPenalties(task.id, task, occurrenceKey);
          }
          return;
        }

        // 2. Check if task occurrence is open -> Send Opening Push once per occurrence
        if (startMs && nowMs >= startMs && (win.isPermanent || !cutoffMs || nowMs < cutoffMs)) {
          if (!win.isPermanent) {
            hasActiveOrUpcoming = true;
          }
          const notifiedKey = task.lastOpenNotifiedKey || task.lastOpenedOccurrenceKey || "";
          if (notifiedKey !== occurrenceKey) {
            if (!allUsersCache) allUsersCache = fetchApprovedUsers();
            notifyTaskWindowOpened(task, win, allUsersCache);
          }
        } else if (startMs && !win.isPermanent) {
          const preBufferMs = startMs - (CONFIG.PRE_SESSION_BUFFER_MINUTES * 60 * 1000);
          if (nowMs >= preBufferMs && (!cutoffMs || nowMs < cutoffMs)) {
            hasActiveOrUpcoming = true;
          }
        }
      });
    });

    setOneMinuteTriggerActive(hasActiveOrUpcoming);
    return {
      hasActiveOrUpcoming: hasActiveOrUpcoming,
      evaluatedSessions: allSessions.length,
      evaluatedTasks: allTasks.length
    };
  });
}

/**
 * Sends a native Chrome Web Push and in-app notification when a session enters its check-in window.
 */
function notifySessionWindowOpened(session, occ, allUsers) {
  try {
    const eligibleMembers = (allUsers || []).filter(u => isUserEligibleForSession(session, u));
    const tokens = collectFcmTokensForUsers(eligibleMembers);
    const title = "Attendance Check-In Open! 🟢";
    const body = `"${session.title || 'Attendance Session'}" is now open for check-in. Check in early to earn bonus rewards!`;

    firestorePatch(`attendance_sessions/${session.id}`, {
      lastOpenNotifiedKey: occ.occurrenceKey,
      updatedAt: new Date().toISOString()
    }, ["lastOpenNotifiedKey", "updatedAt"]);

    if (tokens.length > 0) {
      sendFcmWebPush(tokens, title, body, CONFIG.PWA_URL + "#attendance");
    }
    console.log(`[OpenNotify] Sent opening alert for session ${session.id} (${occ.occurrenceKey}) to ${tokens.length} push token(s).`);
  } catch (err) {
    console.warn("[OpenNotify] Failed:", err);
  }
}

/**
 * Sends a native Chrome Web Push and in-app notification when a task occurrence window opens.
 */
function notifyTaskWindowOpened(task, win, allUsers) {
  try {
    const eligibleMembers = (allUsers || []).filter(u => isUserEligibleForTask(task, u));
    const tokens = collectFcmTokensForUsers(eligibleMembers);
    const tiers = normalizeTaskTiersInGas(task);
    const title = "New Task Window Open! 📋";
    const bonusNote = (tiers.earlyBonus.enabled && tiers.earlyBonus.points > tiers.onTimePoints)
      ? ` Submit early for +${tiers.earlyBonus.points} pts!`
      : ` Reward: +${tiers.onTimePoints} pts.`;
    const body = `"${task.title || 'Task'}" is now open for submission.${bonusNote}`;
    const nowIso = new Date().toISOString();

    firestorePatch(`tasks/${task.id}`, {
      lastOpenNotifiedKey: win.occurrenceKey,
      lastOpenedOccurrenceKey: win.occurrenceKey,
      updatedAt: nowIso
    }, ["lastOpenNotifiedKey", "lastOpenedOccurrenceKey", "updatedAt"]);

    if (tokens.length > 0) {
      sendFcmWebPush(tokens, title, body, CONFIG.PWA_URL + "#tasks");
    }
    console.log(`[TaskOpenNotify] Sent opening alert for task ${task.id} (${win.occurrenceKey}) to ${tokens.length} push token(s).`);
  } catch (err) {
    console.warn("[TaskOpenNotify] Failed:", err);
  }
}

// -------------------------------------------------------------
// TASK TIMING, SUBMISSION & MISSED-TASK PENALTY ENGINE
// -------------------------------------------------------------

function normalizeTaskTiersInGas(task) {
  if (!task) {
    return {
      points: 5,
      onTimePoints: 5,
      durationMinutes: null,
      earlyBonus: { enabled: false, untilMinutes: 0, points: 5 },
      grace: { enabled: false, untilMinutes: 0, penaltyPoints: 0, fineAmountEGP: 0 },
      missedPenalty: { enabled: false, points: 0, fineAmountEGP: 0 }
    };
  }
  const onTimePoints = typeof task.points === "number"
    ? task.points
    : (typeof (task.tieredRewards && task.tieredRewards.onTimePoints) === "number" ? task.tieredRewards.onTimePoints : (Number(task.points) || 5));
  const durationMinutes = (typeof task.durationMinutes === "number" && task.durationMinutes > 0)
    ? task.durationMinutes
    : (Number(task.durationMinutes) > 0 ? Number(task.durationMinutes) : null);

  let earlyBonus = { enabled: false, untilMinutes: 0, points: onTimePoints };
  if (task.earlyBonus && typeof task.earlyBonus === "object") {
    earlyBonus = {
      enabled: Boolean(task.earlyBonus.enabled),
      untilMinutes: Number(task.earlyBonus.untilMinutes) || 0,
      points: typeof task.earlyBonus.points === "number" ? task.earlyBonus.points : (Number(task.earlyBonus.points) || onTimePoints)
    };
  } else if (task.tieredRewards) {
    const ebMin = Number(task.tieredRewards.earlyBonusMinutes) || 0;
    if (ebMin > 0 && task.tieredRewards.enabled !== false) {
      earlyBonus = {
        enabled: true,
        untilMinutes: ebMin,
        points: typeof task.tieredRewards.earlyPoints === "number" ? task.tieredRewards.earlyPoints : onTimePoints
      };
    }
  }

  let grace = { enabled: false, untilMinutes: 0, penaltyPoints: 0, fineAmountEGP: 0 };
  if (task.grace && typeof task.grace === "object") {
    grace = {
      enabled: Boolean(task.grace.enabled),
      untilMinutes: Number(task.grace.untilMinutes) || 0,
      penaltyPoints: Math.max(0, Number(task.grace.penaltyPoints || task.grace.latePenaltyPoints || 0)),
      fineAmountEGP: Math.max(0, Number(task.grace.fineAmountEGP || task.grace.fineEGP || 0)),
      points: task.grace.points != null ? Number(task.grace.points) : null
    };
  } else if (task.tieredRewards && task.tieredRewards.graceMinutes) {
    const gMin = Number(task.tieredRewards.graceMinutes) || 0;
    if (gMin > 0 && durationMinutes && task.tieredRewards.enabled !== false) {
      grace = {
        enabled: true,
        untilMinutes: durationMinutes + gMin,
        penaltyPoints: 0,
        fineAmountEGP: 0,
        points: task.tieredRewards.gracePoints != null ? Number(task.tieredRewards.gracePoints) : null
      };
    }
  }

  let missedPenalty = { enabled: false, points: 0, fineAmountEGP: 0 };
  if (task.missedPenalty && typeof task.missedPenalty === "object") {
    missedPenalty = {
      enabled: Boolean(task.missedPenalty.enabled),
      points: Math.max(0, Number(task.missedPenalty.points) || 0),
      fineAmountEGP: Math.max(0, Number(task.missedPenalty.fineAmountEGP || task.missedPenalty.fineEGP || 0))
    };
  } else if (task.tieredRewards) {
    const p = Number(task.tieredRewards.missedPenaltyPoints || (task.tieredRewards.missedPenalty && (task.tieredRewards.missedPenalty.penaltyPoints || task.tieredRewards.missedPenalty.points))) || 0;
    if (p > 0 && task.tieredRewards.enabled !== false) {
      missedPenalty = {
        enabled: true,
        points: p,
        fineAmountEGP: 0
      };
    }
  }

  return { points: onTimePoints, onTimePoints: onTimePoints, durationMinutes: durationMinutes, earlyBonus: earlyBonus, grace: grace, missedPenalty: missedPenalty };
}

function evaluateTaskOccurrenceInGas(task, occurrenceKey, startMs, nowMs) {
  const isPermanent = Boolean(task.isPermanent);
  const tiers = normalizeTaskTiersInGas(task);
  const { onTimePoints, durationMinutes, earlyBonus, grace } = tiers;

  const closesAt = isPermanent ? null : (durationMinutes ? startMs + durationMinutes * 60000 : (() => {
    const p = getZonedParts(startMs, CONFIG.TIMEZONE);
    return zonedDateToMs(p.year, p.month, p.day, 23, 59, 59, CONFIG.TIMEZONE) + 999;
  })());

  const graceEndsAt = (!isPermanent && grace.enabled && grace.untilMinutes > 0)
    ? startMs + grace.untilMinutes * 60000
    : null;

  const cutoffMs = isPermanent ? null : (graceEndsAt || closesAt);

  if (nowMs < startMs) {
    return {
      state: "upcoming",
      pointsForNow: (earlyBonus.enabled && earlyBonus.untilMinutes > 0) ? earlyBonus.points : onTimePoints,
      inGrace: false,
      isEarlyBonus: false,
      isPermanent: isPermanent,
      occurrenceKey: occurrenceKey,
      start: startMs,
      closesAt: closesAt,
      graceEndsAt: graceEndsAt,
      cutoffMs: cutoffMs
    };
  }

  if (isPermanent) {
    return {
      state: "open",
      pointsForNow: onTimePoints,
      inGrace: false,
      isEarlyBonus: false,
      isPermanent: true,
      occurrenceKey: occurrenceKey,
      start: startMs,
      closesAt: null,
      graceEndsAt: null,
      cutoffMs: null
    };
  }

  if (nowMs < closesAt) {
    const isEarly = earlyBonus.enabled && earlyBonus.untilMinutes > 0 && nowMs < (startMs + earlyBonus.untilMinutes * 60000);
    return {
      state: "open",
      pointsForNow: isEarly ? earlyBonus.points : onTimePoints,
      inGrace: false,
      isEarlyBonus: isEarly,
      isPermanent: false,
      occurrenceKey: occurrenceKey,
      start: startMs,
      closesAt: closesAt,
      graceEndsAt: graceEndsAt,
      cutoffMs: cutoffMs
    };
  }

  if (graceEndsAt && nowMs < graceEndsAt) {
    const gracePenaltyPts = Math.max(0, Number(grace.penaltyPoints) || 0);
    const baseGracePts = grace.points != null ? Number(grace.points) : onTimePoints;
    return {
      state: "grace",
      pointsForNow: Math.max(0, baseGracePts - gracePenaltyPts),
      inGrace: true,
      isEarlyBonus: false,
      isPermanent: false,
      occurrenceKey: occurrenceKey,
      start: startMs,
      closesAt: closesAt,
      graceEndsAt: graceEndsAt,
      cutoffMs: cutoffMs
    };
  }

  return {
    state: "closed",
    pointsForNow: 0,
    inGrace: false,
    isEarlyBonus: false,
    isPermanent: false,
    occurrenceKey: occurrenceKey,
    start: startMs,
    closesAt: closesAt,
    graceEndsAt: graceEndsAt,
    cutoffMs: cutoffMs
  };
}

function getTaskWindowInGas(task, nowMs = Date.now()) {
  if (!task) return null;
  const sched = normalizeScheduleObject(task.schedule || task);
  const startMs = parseDateTimeToMs(sched.startDateTime);

  if (sched.type === "once") {
    return evaluateTaskOccurrenceInGas(task, "once", startMs, nowMs);
  }

  if (nowMs < startMs) {
    return evaluateTaskOccurrenceInGas(task, formatZonedDateKey(startMs, CONFIG.TIMEZONE), startMs, nowMs);
  }

  const fromMs = Math.max(startMs, nowMs - 35 * 86400000);
  const toMs = nowMs + 35 * 86400000;
  const occs = getOccurrencesInGas(sched, fromMs, toMs);

  if (occs.length === 0) {
    return evaluateTaskOccurrenceInGas(task, formatZonedDateKey(startMs, CONFIG.TIMEZONE), startMs, nowMs);
  }

  const pastOccs = occs.filter(o => o <= nowMs);
  if (pastOccs.length === 0) {
    const firstOcc = occs[0];
    return evaluateTaskOccurrenceInGas(task, formatZonedDateKey(firstOcc, CONFIG.TIMEZONE), firstOcc, nowMs);
  }

  const currStart = pastOccs[pastOccs.length - 1];
  return evaluateTaskOccurrenceInGas(task, formatZonedDateKey(currStart, CONFIG.TIMEZONE), currStart, nowMs);
}

/**
 * Returns both the previous occurrence (if any) and current occurrence so recurring tasks
 * whose deadline closed just before a new recurrence started are never missed by the watchdog.
 */
function getTaskWindowsForWatchdog(task, nowMs = Date.now()) {
  if (!task) return [];
  const sched = normalizeScheduleObject(task.schedule || task);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  if (sched.type === "once") {
    return [evaluateTaskOccurrenceInGas(task, "once", startMs, nowMs)];
  }
  const fromMs = Math.max(startMs, nowMs - 35 * 86400000);
  const toMs = nowMs + 7 * 86400000;
  const occs = getOccurrencesInGas(sched, fromMs, toMs);
  if (occs.length === 0) {
    return [evaluateTaskOccurrenceInGas(task, formatZonedDateKey(startMs, CONFIG.TIMEZONE), startMs, nowMs)];
  }
  const pastOccs = occs.filter(o => o <= nowMs);
  const windows = [];
  if (pastOccs.length >= 2) {
    const prevStart = pastOccs[pastOccs.length - 2];
    windows.push(evaluateTaskOccurrenceInGas(task, formatZonedDateKey(prevStart, CONFIG.TIMEZONE), prevStart, nowMs));
  }
  if (pastOccs.length >= 1) {
    const currStart = pastOccs[pastOccs.length - 1];
    windows.push(evaluateTaskOccurrenceInGas(task, formatZonedDateKey(currStart, CONFIG.TIMEZONE), currStart, nowMs));
  } else {
    const nextStart = occs[0];
    windows.push(evaluateTaskOccurrenceInGas(task, formatZonedDateKey(nextStart, CONFIG.TIMEZONE), nextStart, nowMs));
  }
  return windows;
}

/**
 * Evaluates a user's task submission against server time (nowMs) and task tiers.
 */
function evaluateTaskSubmissionTiming(task, nowMs = Date.now()) {
  const tiers = normalizeTaskTiersInGas(task);
  const win = getTaskWindowInGas(task, nowMs);
  if (!win) {
    throw new Error("Unable to resolve task schedule window.");
  }

  if (win.state === "upcoming") {
    let openFormatted = "scheduled time";
    try {
      openFormatted = Utilities.formatDate(new Date(win.start), CONFIG.TIMEZONE, "MMM d, HH:mm");
    } catch (_) { }
    throw new Error(`Task submission window is not open yet (opens at ${openFormatted}).`);
  }

  if (win.state === "closed") {
    throw new Error("Submission closed: deadline and grace period have expired.");
  }

  if (win.state === "grace") {
    const gracePenaltyPts = Math.max(0, Number(tiers.grace.penaltyPoints) || 0);
    const graceFineEgp = Math.max(0, Number(tiers.grace.fineAmountEGP) || 0);
    const baseGracePts = tiers.grace.points != null ? Number(tiers.grace.points) : tiers.onTimePoints;
    const pointsAwarded = Math.max(0, baseGracePts - gracePenaltyPts);
    return {
      canSubmit: true,
      tier: "grace",
      statusText: "Grace Period",
      occurrenceKey: win.occurrenceKey,
      pointsAwarded: pointsAwarded,
      penaltyPts: gracePenaltyPts,
      fineEGP: graceFineEgp,
      inGrace: true,
      isEarlyBonus: false
    };
  }

  const isEarly = Boolean(win.isEarlyBonus);
  const pointsAwarded = Math.max(0, isEarly ? tiers.earlyBonus.points : tiers.onTimePoints);
  return {
    canSubmit: true,
    tier: isEarly ? "early" : "onTime",
    statusText: isEarly ? "Early Bonus" : "On Time",
    occurrenceKey: win.occurrenceKey,
    pointsAwarded: pointsAwarded,
    penaltyPts: 0,
    fineEGP: 0,
    inGrace: false,
    isEarlyBonus: isEarly
  };
}

/**
 * Checks whether a user is eligible/assigned for a given task.
 */
function isUserEligibleForTask(task, user) {
  if (!task || !user) return false;
  if (user.disabled || user.blocked) return false;
  const uid = user.id || user.uid;
  if (!uid) return false;
  if (Array.isArray(task.excludedUids) && task.excludedUids.includes(uid)) {
    return false;
  }
  if (task.claimPolicy === "admin_assigned" || task.claimPolicy === "milestone") {
    if (Array.isArray(task.assignedUids) && task.assignedUids.length > 0) {
      return task.assignedUids.includes(uid);
    }
    return false;
  }
  return true;
}

/**
 * Processes a user's task submission using strict server-time evaluation (Guardrail 1 & 3),
 * writes the submission document, updates the member's canonical ledger, and logs transactions.
 */
function handleProcessTaskSubmission(payload) {
  const uid = payload.uid;
  const taskId = payload.taskId;
  if (!uid || !taskId) {
    throw new Error("Missing uid or taskId in PROCESS_TASK_SUBMISSION");
  }

  const task = firestoreGet(`tasks/${taskId}`);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  if (task.archived || task.status === "archived" || task.active === false) {
    throw new Error("This task is archived and no longer accepting submissions.");
  }

  const userDoc = firestoreGet(`users/${uid}`);
  if (!userDoc) {
    throw new Error(`User profile ${uid} not found.`);
  }
  if (!isUserEligibleForTask(task, userDoc)) {
    throw new Error("You are not eligible to submit this task.");
  }

  const isAdminOverride = payload.isAdminOverride === true || payload.source === "admin_override";
  const nowMs = isAdminOverride && payload.submittedAtMs ? Number(payload.submittedAtMs) : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let evalResult;
  if (isAdminOverride && payload.pointsAwarded !== undefined) {
    const win = getTaskWindowInGas(task, nowMs);
    evalResult = {
      canSubmit: true,
      tier: payload.tier || "admin_override",
      statusText: "Admin Override",
      occurrenceKey: payload.occurrenceKey || (win ? win.occurrenceKey : "once"),
      pointsAwarded: Math.max(0, Number(payload.pointsAwarded) || 0),
      penaltyPts: Math.max(0, Number(payload.penaltyPts || payload.penalty) || 0),
      fineEGP: Math.max(0, Number(payload.fineEGP || 0)),
      inGrace: false,
      isEarlyBonus: false
    };
  } else {
    evalResult = evaluateTaskSubmissionTiming(task, nowMs);
  }

  const occurrenceKey = (task.schedule && task.schedule.type === "once")
    ? "once"
    : (evalResult.occurrenceKey || payload.occurrenceKey || "once");
  const subId = payload.submissionId || `${taskId}_${uid}_${occurrenceKey}`;

  const existingSub = firestoreGet(`submissions/${subId}`);
  if (existingSub && existingSub.ledgerSynced === true && !isAdminOverride) {
    return {
      skipped: true,
      submissionId: subId,
      taskId: taskId,
      occurrenceKey: occurrenceKey,
      tier: existingSub.tier || evalResult.tier,
      pointsAwarded: Number(existingSub.pointsAwarded) || evalResult.pointsAwarded,
      penaltyPts: Number(existingSub.penaltyPoints) || 0,
      fineEGP: Number(existingSub.fineEGP) || 0,
      statusText: evalResult.statusText
    };
  }

  const userName = payload.userName || userDoc.displayName || userDoc.name || "Member";
  const userAvatar = payload.userAvatar || userDoc.photoURL || userDoc.avatarUrl || "";
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const comment = payload.comment != null ? String(payload.comment) : "";
  const taskTitle = task.title || payload.taskTitle || "Task";

  const subDocPayload = {
    id: subId,
    taskId: taskId,
    taskTitle: taskTitle,
    uid: uid,
    userId: uid,
    userName: userName,
    userAvatar: userAvatar,
    occurrenceKey: occurrenceKey,
    answers: answers,
    comment: comment,
    pointsAwarded: evalResult.pointsAwarded,
    penaltyPoints: evalResult.penaltyPts,
    fineEGP: evalResult.fineEGP,
    tier: evalResult.tier,
    statusText: evalResult.statusText,
    status: "approved",
    ledgerSynced: true,
    submittedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  firestorePatch(`submissions/${subId}`, subDocPayload);

  // Update member ledger via canonical helper (Guardrail 3)
  const updatedLedger = applyCanonicalUserLedgerUpdate(uid, userDoc, {
    pointsChange: evalResult.pointsAwarded,
    penaltyChange: evalResult.penaltyPts,
    fineChange: evalResult.fineEGP,
    nowMs: nowMs,
    nowIso: nowIso,
    lastOpId: subId
  });

  // Record transaction in users/{uid}/transactions
  if (evalResult.pointsAwarded > 0) {
    firestorePost(`users/${uid}/transactions`, {
      uid: uid,
      userId: uid,
      taskId: taskId,
      submissionId: subId,
      bucket: "points",
      direction: "add",
      type: evalResult.isEarlyBonus ? "task_early_bonus" : (evalResult.inGrace ? "task_grace_reward" : "task_reward"),
      category: "tasks",
      amount: evalResult.pointsAwarded,
      pointsDelta: evalResult.pointsAwarded,
      egpDelta: 0,
      reason: `Task Completed (${evalResult.statusText}): ${taskTitle}`,
      status: "active",
      createdAt: nowIso,
      timestamp: nowIso,
      createdAtMs: nowMs
    });
  }

  if (evalResult.penaltyPts > 0 || evalResult.fineEGP > 0) {
    firestorePost(`users/${uid}/transactions`, {
      uid: uid,
      userId: uid,
      taskId: taskId,
      submissionId: subId,
      bucket: evalResult.penaltyPts > 0 ? "penalties" : "fines",
      direction: "add",
      type: "task_late_penalty",
      category: "tasks",
      amount: evalResult.penaltyPts || evalResult.fineEGP,
      pointsDelta: -evalResult.penaltyPts,
      egpDelta: -evalResult.fineEGP,
      reason: `Late Task Submission (${evalResult.statusText}): ${taskTitle}`,
      status: "active",
      createdAt: nowIso,
      timestamp: nowIso,
      createdAtMs: nowMs
    });

    firestorePost("adjustments", {
      uid: uid,
      targetUid: uid,
      userName: userName,
      type: "penalty",
      amount: evalResult.penaltyPts,
      pointsDelta: -evalResult.penaltyPts,
      egpDelta: -evalResult.fineEGP,
      amountEGP: -evalResult.fineEGP,
      fineAmount: evalResult.fineEGP,
      reason: `Late Task Submission (${evalResult.statusText}): ${taskTitle}`,
      source: "task_submission",
      taskId: taskId,
      submissionId: subId,
      occurrenceKey: occurrenceKey,
      status: "applied",
      createdAt: nowIso,
      timestamp: nowIso,
      createdAtMs: nowMs
    });
  }

  return {
    submissionId: subId,
    taskId: taskId,
    occurrenceKey: occurrenceKey,
    tier: evalResult.tier,
    statusText: evalResult.statusText,
    pointsAwarded: evalResult.pointsAwarded,
    penaltyPts: evalResult.penaltyPts,
    fineEGP: evalResult.fineEGP,
    newPoints: updatedLedger ? updatedLedger.points : evalResult.pointsAwarded,
    newNetPts: updatedLedger ? updatedLedger.netPts : evalResult.pointsAwarded
  };
}

var processTaskSubmissionAndSyncLedger = handleProcessTaskSubmission;

/**
 * Closes an expired task occurrence window and automatically deducts missed-task penalties
 * for all eligible members who did not submit (wrapped in ScriptLock per Guardrail 2).
 */
function closeTaskAndApplyPenalties(taskId, taskObj, occurrenceKey) {
  return runWithScriptLock(`closeTask_${taskId}`, function () {
    const task = taskObj || firestoreGet(`tasks/${taskId}`);
    if (!task) {
      console.warn(`[CloseTask] Task ${taskId} not found.`);
      return { closed: false, reason: "not_found" };
    }
    if (task.isPermanent) {
      return { closed: false, reason: "permanent_task" };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const win = getTaskWindowInGas(task, nowMs);
    const effOccKey = occurrenceKey || (win ? win.occurrenceKey : formatZonedDateKey(nowMs, CONFIG.TIMEZONE));
    const sched = normalizeScheduleObject(task.schedule || task);
    const isRecurring = sched.type !== "once";

    // 1. Mark task occurrence closed in Firestore
    const taskPatch = {
      lastAutoClosedKey: effOccKey,
      lastClosedOccurrenceKey: effOccKey,
      closedAt: nowIso,
      closedBy: "system_watchdog",
      updatedAt: nowIso
    };
    const taskMask = ["lastAutoClosedKey", "lastClosedOccurrenceKey", "closedAt", "closedBy", "updatedAt"];
    firestorePatch(`tasks/${taskId}`, taskPatch, taskMask);

    const tiers = normalizeTaskTiersInGas(task);
    const ptsPenalty = tiers.missedPenalty.enabled ? Math.max(0, Number(tiers.missedPenalty.points) || 0) : 0;
    const finePenalty = tiers.missedPenalty.enabled ? Math.max(0, Number(tiers.missedPenalty.fineAmountEGP) || 0) : 0;

    if (!tiers.missedPenalty.enabled || (ptsPenalty <= 0 && finePenalty <= 0)) {
      return { closed: true, penalizedCount: 0, occurrenceKey: effOccKey, reason: "missed_penalty_disabled" };
    }

    // 2. Fetch approved members & filter eligible for this task
    const allUsers = fetchApprovedUsers();
    const eligibleMembers = allUsers.filter(u => isUserEligibleForTask(task, u));

    // 3. Fetch submissions & existing missed_penalties for this task
    const existingSubs = fetchSubmissionsForTask(taskId);
    const submittedUids = new Set(
      existingSubs
        .filter(s => !effOccKey || !s.occurrenceKey || s.occurrenceKey === effOccKey || (!isRecurring && s.occurrenceKey === "once"))
        .map(s => s.uid || s.userId)
        .filter(Boolean)
    );

    const existingMissed = fetchMissedPenaltiesForTask(taskId);
    const alreadyPenalizedUids = new Set(
      existingMissed
        .filter(m => !effOccKey || !m.occurrenceKey || m.occurrenceKey === effOccKey)
        .map(m => m.uid || m.userId)
        .filter(Boolean)
    );

    let penalizedCount = 0;
    const taskTitle = task.title || "Task";

    eligibleMembers.forEach(member => {
      const uid = member.id || member.uid;
      if (!uid) return;
      if (submittedUids.has(uid)) return;
      if (alreadyPenalizedUids.has(uid)) return;

      const penaltyDocId = `${taskId}_${uid}_${effOccKey}`;
      const existingDoc = firestoreGet(`missed_penalties/${penaltyDocId}`);
      if (existingDoc) return;

      penalizedCount++;

      // A. Record missed_penalties document
      firestorePatch(`missed_penalties/${penaltyDocId}`, {
        id: penaltyDocId,
        taskId: taskId,
        taskTitle: taskTitle,
        uid: uid,
        userId: uid,
        userName: member.displayName || member.name || "Member",
        occurrenceKey: effOccKey,
        penaltyPoints: ptsPenalty,
        fineEGP: finePenalty,
        appliedBy: "system_watchdog",
        appliedAt: nowIso,
        createdAt: nowIso
      });

      // B. Update member profile points, penalties & fines via canonical helper (Guardrail 3)
      const freshUser = firestoreGet(`users/${uid}`) || member;
      applyCanonicalUserLedgerUpdate(uid, freshUser, {
        pointsChange: -ptsPenalty,
        penaltyChange: ptsPenalty,
        fineChange: finePenalty,
        nowMs: nowMs,
        nowIso: nowIso,
        lastOpId: `missed_${penaltyDocId}`
      });

      // C. Write audit trail in adjustments collection
      firestorePost("adjustments", {
        uid: uid,
        targetUid: uid,
        userName: member.displayName || member.name || "Member",
        type: "penalty",
        amount: ptsPenalty,
        pointsDelta: -ptsPenalty,
        egpDelta: -finePenalty,
        amountEGP: -finePenalty,
        fineAmount: finePenalty,
        reason: `Missed Task Deadline: ${taskTitle} (${effOccKey})`,
        source: "task_missed_watchdog",
        taskId: taskId,
        taskTitle: taskTitle,
        occurrenceKey: effOccKey,
        adminId: "system_watchdog",
        status: "applied",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });

      // D. Write ledger transaction
      firestorePost(`users/${uid}/transactions`, {
        uid: uid,
        userId: uid,
        taskId: taskId,
        bucket: "penalties",
        direction: "add",
        type: "task_missed_penalty",
        category: "tasks",
        amount: ptsPenalty,
        pointsDelta: -ptsPenalty,
        egpDelta: -finePenalty,
        reason: `Missed Task: ${taskTitle} (${effOccKey})`,
        status: "active",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });

      // E. Dispatch in-app notification
      const notifTitle = "Task Deadline Missed ⚠️";
      const notifBody = `You missed the deadline for "${taskTitle}". Penalty: -${ptsPenalty} pts${finePenalty > 0 ? `, -${finePenalty} EGP` : ""}.`;
      const notifPayload = {
        uid: uid,
        userId: uid,
        title: notifTitle,
        message: notifBody,
        body: notifBody,
        type: "penalty",
        category: "alert",
        icon: "alert-circle",
        taskId: taskId,
        read: false,
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      };
      firestorePost("notifications", notifPayload);
      firestorePost(`users/${uid}/notifications`, notifPayload);

      // F. Dispatch external Chrome Web Push
      const memberTokens = collectFcmTokensForUsers([member]);
      if (memberTokens.length > 0) {
        sendFcmWebPush(memberTokens, notifTitle, notifBody, CONFIG.PWA_URL + "#tasks");
      }
    });

    console.log(`[CloseTask] Task ${taskId} (${effOccKey}) finalized. Penalized ${penalizedCount} unsubmitted members.`);
    return { closed: true, penalizedCount: penalizedCount, occurrenceKey: effOccKey };
  });
}

// -------------------------------------------------------------
// TIERED EARLY BONUS & CHECK-IN LEDGER ENGINE
// -------------------------------------------------------------

/**
 * Evaluates check-in timing against session's custom timeBrackets (bidirectional) & retroactive grace period.
 */
function evaluateCheckInTiming(session, checkInMs, startMs) {
  const S = Number(startMs) || (getSessionStartDate(session) ? getSessionStartDate(session).getTime() : checkInMs);
  const gracePeriodMins = Number(session.gracePeriodMins != null ? session.gracePeriodMins : (session.graceMinutes != null ? session.graceMinutes : 0));
  const earlyCheckInMins = Number(session.earlyCheckInMinutes != null ? session.earlyCheckInMinutes : 30);
  const opensAt = S - earlyCheckInMins * 60000;

  // STRICT CHECK-IN OPENS GATE
  if (checkInMs < opensAt) {
    let openTimeFormatted = "scheduled time";
    try {
      openTimeFormatted = Utilities.formatDate(new Date(opensAt), CONFIG.TIMEZONE, "HH:mm");
    } catch (_) { }
    throw new Error(`Check-in window is not open yet (opens at ${openTimeFormatted})`);
  }

  const timeBrackets = Array.isArray(session.timeBrackets)
    ? session.timeBrackets
    : (Array.isArray(session.earlyBonusTiers)
      ? session.earlyBonusTiers.map(t => ({
        type: "before",
        fromMins: Number(t.fromMinsBefore) || 0,
        toMins: Number(t.toMinsBefore) || 0,
        points: Number(t.bonusPoints) || 0,
        egp: Number(t.bonusEgp != null ? t.bonusEgp : t.bonusEGP) || 0
      }))
      : []);

  if (checkInMs < S) {
    const earlySeconds = Math.max(0, Math.floor((S - checkInMs) / 1000));
    const minsEarly = Math.ceil((S - checkInMs) / 60000);
    let bonusPts = 0;
    let bonusEgp = 0;
    let appliedTierLabel = "";

    const beforeBrackets = timeBrackets.filter(t => t.type !== "after");
    if (beforeBrackets.length > 0) {
      let bestReward = -1;
      beforeBrackets.forEach(t => {
        const rawFrom = Number(t.fromMins != null ? t.fromMins : t.fromMinsBefore) || 0;
        const rawTo = Number(t.toMins != null ? t.toMins : t.toMinsBefore) || 0;
        const upper = Math.max(rawFrom, rawTo);
        const lower = Math.min(rawFrom, rawTo);
        if (minsEarly <= upper && minsEarly >= lower) {
          const pts = Math.max(0, Number(t.points != null ? t.points : t.bonusPoints) || 0);
          const egp = Math.max(0, Number(t.egp != null ? t.egp : (t.bonusEgp != null ? t.bonusEgp : t.bonusEGP)) || 0);
          const score = pts + egp;
          if (score > bestReward) {
            bestReward = score;
            bonusPts = pts;
            bonusEgp = egp;
            appliedTierLabel = `${upper}m–${lower}m Early Tier`;
          }
        }
      });
    } else if (session.earlyBonusEnabled !== false) {
      bonusPts = Math.max(0, Number(session.earlyBonusPoints) || 0);
      bonusEgp = Math.max(0, Number(session.earlyBonusEGP) || 0);
      if (bonusPts > 0 || bonusEgp > 0) {
        appliedTierLabel = "Early Arrival Bonus";
      }
    }

    return {
      status: "early",
      earlyMinutes: minsEarly,
      earlySeconds: earlySeconds,
      lateMinutes: 0,
      lateSeconds: 0,
      earlyBonusPoints: bonusPts,
      earlyBonusEGP: bonusEgp,
      penaltyPts: 0,
      fineEGP: 0,
      pointsDelta: bonusPts,
      egpDelta: bonusEgp,
      appliedTierLabel: appliedTierLabel
    };
  }

  // Arrival is at or after start time S
  const lateTotalSec = Math.max(0, Math.floor((checkInMs - S) / 1000));
  const lateMinutes = Math.floor(lateTotalSec / 60);
  const lateSeconds = lateTotalSec % 60;

  // Retroactive Grace Period: If gracePeriodMins > 0 and arrival <= gracePeriodMins, 0 penalty, on_time
  if (gracePeriodMins > 0 && lateMinutes <= gracePeriodMins) {
    return {
      status: "on_time",
      earlyMinutes: 0,
      earlySeconds: 0,
      lateMinutes: 0,
      lateSeconds: 0,
      earlyBonusPoints: 0,
      earlyBonusEGP: 0,
      penaltyPts: 0,
      fineEGP: 0,
      pointsDelta: 0,
      egpDelta: 0,
      appliedTierLabel: `Grace Period (${lateMinutes}m)`
    };
  }

  // Late arrival beyond grace period: Calculate penalty from ORIGINAL start time S (do NOT subtract grace period)
  let penaltyPts = 0;
  let fineEGP = 0;
  let appliedTierLabel = `Late by ${lateMinutes}m ${lateSeconds}s`;

  const afterBrackets = timeBrackets.filter(t => t.type === "after");
  let matchedAfterBracket = false;
  if (afterBrackets.length > 0) {
    for (let i = 0; i < afterBrackets.length; i++) {
      const b = afterBrackets[i];
      const rawFrom = Number(b.fromMins) || 0;
      const rawTo = Number(b.toMins) || 0;
      const lower = Math.min(rawFrom, rawTo);
      const upper = Math.max(rawFrom, rawTo);
      if (lateMinutes >= lower && lateMinutes <= upper) {
        penaltyPts = Math.max(0, Number(b.points) || 0);
        fineEGP = Math.max(0, Number(b.egp) || 0);
        appliedTierLabel = `${lower}m–${upper}m Late Tier`;
        matchedAfterBracket = true;
        break;
      }
    }
  }

  if (!matchedAfterBracket) {
    const intervalMins = Math.max(1, Number(session.lateIntervalMinutes) || (session.pointsPenalty && session.pointsPenalty.stepSize) || 30);
    const ptsPerInterval = Number(session.pointsPerInterval != null ? session.pointsPerInterval : (session.pointsPenalty && session.pointsPenalty.perStep) || 1);
    const egpPerInterval = Number(session.finePerIntervalEGP != null ? session.finePerIntervalEGP : (session.finePenalty && session.finePenalty.perStep) || 5);
    const maxPenaltyPts = Number(session.maxLatePenaltyPoints != null ? session.maxLatePenaltyPoints : (session.pointsPenalty && session.pointsPenalty.max) || (session.absencePenalty || 5));

    const intervals = Math.ceil(Math.max(1, lateMinutes) / intervalMins);
    penaltyPts = Math.min(maxPenaltyPts, intervals * ptsPerInterval);
    fineEGP = intervals * egpPerInterval;
  }

  return {
    status: "late",
    earlyMinutes: 0,
    earlySeconds: 0,
    lateMinutes: lateMinutes,
    lateSeconds: lateSeconds,
    earlyBonusPoints: 0,
    earlyBonusEGP: 0,
    penaltyPts: penaltyPts,
    fineEGP: fineEGP,
    pointsDelta: -penaltyPts,
    egpDelta: -fineEGP,
    appliedTierLabel: appliedTierLabel
  };
}

/**
 * Guardrail 1 & 3:
 * Evaluates member check-ins strictly against server time (nowMs) and strips client overrides
 * for regular member check-ins, while preserving Admin Override authority when isAdminOverride === true.
 */
function handleProcessCheckIn(payload) {
  const uid = payload.uid;
  const sessionId = payload.sessionId;
  if (!uid || !sessionId) {
    throw new Error("Missing uid or sessionId in PROCESS_CHECKIN");
  }

  const session = fetchSingleSession(sessionId) || {};
  const isAdminOverride = payload.isAdminOverride === true || payload.source === "admin_override";
  const nowMs = isAdminOverride && payload.checkInTimestamp ? Number(payload.checkInTimestamp) : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const occ = resolveSessionWindow(session, nowMs);
  const startMs = (isAdminOverride && payload.sessionStartMs)
    ? Number(payload.sessionStartMs)
    : (occ ? occ.startMs : (getSessionStartDate(session) ? getSessionStartDate(session).getTime() : nowMs));
  const effOccKey = payload.occurrenceKey || (occ ? occ.occurrenceKey : formatZonedDateKey(startMs, CONFIG.TIMEZONE));
  const logId = payload.logId || `${sessionId}_${uid}_${effOccKey}`;

  const existingLog = firestoreGet(`attendance_logs/${logId}`);
  if (existingLog && existingLog.ledgerSynced === true && !isAdminOverride) {
    return {
      skipped: true,
      logId: logId,
      status: existingLog.status,
      pointsDelta: Number(existingLog.pointsDelta) || 0,
      egpDelta: Number(existingLog.egpDelta) || 0,
      appliedTierLabel: existingLog.appliedTierLabel || "",
      reason: "Ledger already synced for log " + logId
    };
  }

  let evalResult;
  let pointsDelta;
  let egpDelta;

  if (isAdminOverride) {
    // Guardrail 1: Respect Admin-supplied override fields without re-evaluating against server nowMs
    const overridePenaltyPts = Math.max(0, Number(payload.penaltyPts != null ? payload.penaltyPts : payload.penalty) || 0);
    const overrideFineEgp = Math.max(0, Number(payload.fineEGP) || 0);
    const overrideBonusPts = Math.max(0, Number(payload.earlyBonusPoints != null ? payload.earlyBonusPoints : (payload.pointsDelta > 0 ? payload.pointsDelta : 0)) || 0);
    const overrideBonusEgp = Math.max(0, Number(payload.earlyBonusEGP != null ? payload.earlyBonusEGP : (payload.egpDelta > 0 ? payload.egpDelta : 0)) || 0);
    pointsDelta = payload.pointsDelta !== undefined ? Number(payload.pointsDelta) : (overrideBonusPts > 0 ? overrideBonusPts : -overridePenaltyPts);
    egpDelta = payload.egpDelta !== undefined ? Number(payload.egpDelta) : (overrideBonusEgp > 0 ? overrideBonusEgp : -overrideFineEgp);
    evalResult = {
      status: payload.status || (pointsDelta > 0 ? "early" : (pointsDelta < 0 || egpDelta < 0 ? "late" : "on_time")),
      earlyMinutes: Number(payload.earlyMinutes) || 0,
      earlySeconds: Number(payload.earlySeconds) || 0,
      lateMinutes: Number(payload.lateMinutes) || 0,
      lateSeconds: Number(payload.lateSeconds) || 0,
      earlyBonusPoints: overrideBonusPts,
      earlyBonusEGP: overrideBonusEgp,
      penaltyPts: overridePenaltyPts,
      fineEGP: overrideFineEgp,
      pointsDelta: pointsDelta,
      egpDelta: egpDelta,
      appliedTierLabel: payload.appliedTierLabel || "Admin Override"
    };
  } else {
    // Guardrail 1: Strict Server-Time evaluation for regular member self-check-ins (no client override)
    evalResult = evaluateCheckInTiming(session, nowMs, startMs);
    pointsDelta = evalResult.pointsDelta;
    egpDelta = evalResult.egpDelta;
  }

  const logPayload = {
    id: logId,
    sessionId: sessionId,
    sessionTitle: session.title || payload.sessionTitle || "Attendance Session",
    occurrenceKey: effOccKey,
    uid: uid,
    userId: uid,
    userName: payload.userName || "Member",
    displayName: payload.userName || "Member",
    userAvatar: payload.userAvatar || "",
    status: evalResult.status,
    earlyMinutes: evalResult.earlyMinutes,
    lateMinutes: evalResult.lateMinutes,
    lateSeconds: evalResult.lateSeconds,
    earlyBonusPoints: evalResult.earlyBonusPoints,
    earlyBonusEGP: evalResult.earlyBonusEGP,
    penalty: evalResult.penaltyPts,
    fineEGP: evalResult.fineEGP,
    pointsDelta: pointsDelta,
    egpDelta: egpDelta,
    appliedTierLabel: evalResult.appliedTierLabel || "",
    ledgerSynced: true,
    timestamp: nowIso,
    checkedInAt: nowIso,
    checkInTimestamp: nowMs,
    checkInTime: nowIso,
    updatedAt: nowIso
  };

  firestorePatch(`attendance_logs/${logId}`, logPayload);
  firestorePatch(`attendance_records/${logId}`, logPayload);

  // Synchronize member ledger via canonical helper (Guardrail 3)
  const userDoc = firestoreGet(`users/${uid}`);
  if (userDoc) {
    const penaltyPts = pointsDelta < 0 ? Math.abs(pointsDelta) : Number(evalResult.penaltyPts) || 0;
    const bonusEGP = egpDelta > 0 ? egpDelta : 0;
    const penaltyEGP = egpDelta < 0 ? Math.abs(egpDelta) : Number(evalResult.fineEGP) || 0;
    const netFineChange = penaltyEGP - bonusEGP;

    applyCanonicalUserLedgerUpdate(uid, userDoc, {
      pointsChange: pointsDelta,
      penaltyChange: penaltyPts,
      fineChange: netFineChange,
      nowMs: nowMs,
      nowIso: nowIso,
      lastOpId: logId
    });

    if (pointsDelta !== 0 || egpDelta !== 0) {
      const sessionTitle = session.title || payload.sessionTitle || "Attendance Session";
      firestorePost(`users/${uid}/transactions`, {
        uid: uid,
        userId: uid,
        sessionId: sessionId,
        logId: logId || "",
        bucket: pointsDelta > 0 ? "points" : (pointsDelta < 0 ? "penalties" : "fines"),
        direction: (pointsDelta > 0 || egpDelta > 0) ? "add" : "deduct",
        type: evalResult.status === "early" ? "attendance_early_bonus" : "attendance_late_penalty",
        category: "attendance",
        amount: Math.abs(pointsDelta || egpDelta),
        pointsDelta: pointsDelta,
        egpDelta: egpDelta,
        reason: `${sessionTitle} (${evalResult.appliedTierLabel || evalResult.status})`,
        status: "active",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });

      firestorePost("adjustments", {
        uid: uid,
        targetUid: uid,
        userName: payload.userName || userDoc.displayName || userDoc.name || "Member",
        type: (pointsDelta > 0 || egpDelta > 0) ? "bonus" : "penalty",
        pointsDelta: pointsDelta,
        egpDelta: egpDelta,
        amountEGP: egpDelta,
        reason: (pointsDelta > 0 || egpDelta > 0)
          ? `Early Check-In (${evalResult.earlyMinutes || 0}m early): ${sessionTitle}`
          : `Late Check-In (${evalResult.lateMinutes || 0}m late): ${sessionTitle}`,
        source: isAdminOverride ? "admin_override" : "attendance_checkin",
        sessionId: sessionId,
        logId: logId || "",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });
    }
  }

  return {
    logId: logId,
    status: evalResult.status,
    earlyMinutes: evalResult.earlyMinutes,
    lateMinutes: evalResult.lateMinutes,
    lateSeconds: evalResult.lateSeconds,
    earlyBonusPoints: evalResult.earlyBonusPoints,
    earlyBonusEGP: evalResult.earlyBonusEGP,
    penaltyPts: evalResult.penaltyPts,
    fineEGP: evalResult.fineEGP,
    pointsDelta: pointsDelta,
    egpDelta: egpDelta,
    appliedTierLabel: evalResult.appliedTierLabel
  };
}

var processCheckInAndSyncLedger = handleProcessCheckIn;

/**
 * Deletes an attendance log/record and reverses any points/penalties/fines applied to the member.
 */
function deleteAttendanceLogAndReverse(payload) {
  const logId = payload.logId;
  if (!logId) throw new Error("Missing logId in DELETE_LOG");

  let existingLog = firestoreGet(`attendance_logs/${logId}`);
  if (!existingLog) {
    existingLog = firestoreGet(`attendance_records/${logId}`);
  }

  const targetUid = payload.uid || (existingLog && (existingLog.uid || existingLog.userId));
  const pointsDelta = payload.pointsDelta !== undefined
    ? Number(payload.pointsDelta)
    : Number((existingLog && (existingLog.pointsDelta || (existingLog.status === "early" ? existingLog.earlyBonusPoints : -existingLog.penalty))) || 0);
  const egpDelta = payload.egpDelta !== undefined
    ? Number(payload.egpDelta)
    : Number((existingLog && (existingLog.egpDelta || (existingLog.status === "early" ? existingLog.earlyBonusEGP : -existingLog.fineEGP))) || 0);

  firestoreDelete(`attendance_logs/${logId}`);
  firestoreDelete(`attendance_records/${logId}`);

  if (targetUid && (pointsDelta !== 0 || egpDelta !== 0)) {
    const userDoc = firestoreGet(`users/${targetUid}`);
    if (userDoc) {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const penaltyPts = pointsDelta < 0 ? Math.abs(pointsDelta) : 0;
      const bonusEGP = egpDelta > 0 ? egpDelta : 0;
      const penaltyEGP = egpDelta < 0 ? Math.abs(egpDelta) : 0;

      applyCanonicalUserLedgerUpdate(targetUid, userDoc, {
        pointsChange: -pointsDelta,
        penaltyChange: -penaltyPts,
        fineChange: bonusEGP - penaltyEGP,
        nowMs: nowMs,
        nowIso: nowIso
      });

      firestorePost(`users/${targetUid}/transactions`, {
        uid: targetUid,
        userId: targetUid,
        logId: logId,
        bucket: pointsDelta > 0 ? "points" : "penalties",
        direction: pointsDelta > 0 ? "deduct" : "add",
        type: "attendance_reversal",
        category: "attendance",
        amount: Math.abs(pointsDelta || egpDelta),
        pointsDelta: -pointsDelta,
        egpDelta: -egpDelta,
        reason: `Reversal of deleted attendance log ${logId}`,
        status: "active",
        createdAt: nowIso,
        timestamp: nowIso
      });
    }
  }

  return { success: true, logId: logId, reversedUid: targetUid, reversedPoints: -pointsDelta, reversedEgp: -egpDelta };
}

/**
 * Updates an attendance log/record (Admin Override) and synchronizes member ledger liabilities.
 */
function updateAttendanceLogAndSyncLedger(payload) {
  const logId = payload.logId;
  if (!logId) throw new Error("Missing logId in UPDATE_LOG");

  let existingLog = firestoreGet(`attendance_logs/${logId}`);
  if (!existingLog) {
    existingLog = firestoreGet(`attendance_records/${logId}`);
  }

  const targetUid = payload.uid || (existingLog && (existingLog.uid || existingLog.userId));
  const oldPenalty = Number((existingLog && (existingLog.penalty != null ? existingLog.penalty : existingLog.penaltyApplied)) || 0);
  const oldFine = Number((existingLog && existingLog.fineEGP) || 0);
  const oldPoints = Number(
    existingLog && existingLog.points !== undefined
      ? existingLog.points
      : (existingLog && existingLog.earlyBonusPoints !== undefined
        ? existingLog.earlyBonusPoints
        : (existingLog && existingLog.pointsDelta > 0 ? existingLog.pointsDelta : 0))
  );

  const newStatus = payload.status || (existingLog && existingLog.status) || "on_time";
  const rawNewPenalty = payload.penalty !== undefined ? payload.penalty : (payload.penaltyPts !== undefined ? payload.penaltyPts : oldPenalty);
  const newPenalty = Math.max(0, Number(rawNewPenalty) || 0);
  const newFine = payload.fineEGP !== undefined ? Math.max(0, Number(payload.fineEGP) || 0) : oldFine;
  const rawNewPoints = payload.points !== undefined ? payload.points : (payload.earlyBonusPoints !== undefined ? payload.earlyBonusPoints : oldPoints);
  const newPoints = Math.max(0, Number(rawNewPoints) || 0);
  const newNote = payload.adminNote !== undefined ? payload.adminNote : ((existingLog && existingLog.adminNote) || "");
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const netPointsDelta = newPoints > 0 ? newPoints : (newPenalty > 0 ? -newPenalty : 0);
  const netEgpDelta = newFine > 0 ? -newFine : 0;

  const patchData = {
    status: newStatus,
    penalty: newPenalty,
    penaltyApplied: newPenalty,
    fineEGP: newFine,
    points: newPoints,
    earlyBonusPoints: newPoints,
    pointsDelta: netPointsDelta,
    egpDelta: netEgpDelta,
    excused: newStatus === "excused",
    isLate: newStatus === "late",
    isEarly: newStatus === "early" || newPoints > 0,
    adminNote: newNote,
    ledgerSynced: true,
    updatedAt: nowIso
  };

  if (payload.lateMinutes !== undefined) patchData.lateMinutes = Math.max(0, Number(payload.lateMinutes) || 0);
  if (payload.lateSeconds !== undefined) patchData.lateSeconds = Math.max(0, Number(payload.lateSeconds) || 0);
  if (payload.delaySeconds !== undefined) patchData.delaySeconds = Math.max(0, Number(payload.delaySeconds) || 0);
  if (payload.checkedInAt) patchData.checkedInAt = payload.checkedInAt;
  if (payload.timestamp) patchData.timestamp = payload.timestamp;
  if (payload.occurrenceKey) patchData.occurrenceKey = payload.occurrenceKey;
  if (payload.sessionId) patchData.sessionId = payload.sessionId;
  if (payload.sessionTitle) patchData.sessionTitle = payload.sessionTitle;
  if (payload.userName) {
    patchData.userName = payload.userName;
    patchData.displayName = payload.userName;
  }
  if (payload.userAvatar) patchData.userAvatar = payload.userAvatar;
  if (targetUid) {
    patchData.uid = targetUid;
    patchData.userId = targetUid;
  }

  if (!existingLog) {
    patchData.id = logId;
    patchData.createdAt = nowIso;
    if (!patchData.checkedInAt) patchData.checkedInAt = nowIso;
    if (!patchData.timestamp) patchData.timestamp = nowIso;
  }

  const mask = Object.keys(patchData);
  firestorePatch(`attendance_logs/${logId}`, patchData, mask);
  firestorePatch(`attendance_records/${logId}`, patchData, mask);

  // Calculate deltas to adjust member ledger via canonical helper (Guardrail 3)
  const penDiff = newPenalty - oldPenalty;
  const fineDiff = newFine - oldFine;
  const ptsDiff = (newPoints - oldPoints) - penDiff;

  if (targetUid && (penDiff !== 0 || fineDiff !== 0 || ptsDiff !== 0)) {
    const userDoc = firestoreGet(`users/${targetUid}`);
    if (userDoc) {
      applyCanonicalUserLedgerUpdate(targetUid, userDoc, {
        pointsChange: ptsDiff,
        penaltyChange: penDiff,
        fineChange: fineDiff,
        nowMs: nowMs,
        nowIso: nowIso,
        lastOpId: `edit_${logId}`
      });

      firestorePost(`users/${targetUid}/transactions`, {
        uid: targetUid,
        userId: targetUid,
        sessionId: patchData.sessionId || (existingLog && existingLog.sessionId) || "",
        logId: logId,
        bucket: penDiff !== 0 ? "penalties" : (fineDiff !== 0 ? "fines" : "points"),
        direction: (ptsDiff >= 0 && penDiff <= 0 && fineDiff <= 0) ? "add" : "deduct",
        type: "admin_attendance_override",
        category: "attendance",
        amount: Math.abs(ptsDiff || penDiff || fineDiff),
        pointsDelta: ptsDiff,
        egpDelta: -fineDiff,
        reason: `Admin Attendance Update (${newStatus}): ${patchData.sessionTitle || (existingLog && existingLog.sessionTitle) || logId}`,
        status: "active",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });
    }
  }

  return { success: true, logId: logId, newStatus: newStatus, newPenalty: newPenalty, newFine: newFine, newPoints: newPoints };
}

// -------------------------------------------------------------
// AUTO-CLOSE & ABSENCE PENALTY ENGINE
// -------------------------------------------------------------

/**
 * Closes an attendance session and applies absence penalties to eligible members who did not attend.
 * Wrapped with ScriptLock (Guardrail 2) and Canonical Ledger Helper (Guardrail 3).
 */
function closeSessionAndApplyPenalties(sessionId, sessionObj, occurrenceKey) {
  return runWithScriptLock(`closeSession_${sessionId}`, function () {
    const session = sessionObj || fetchSingleSession(sessionId);
    if (!session) {
      console.warn(`[Close] Session ${sessionId} not found.`);
      return { closed: false, reason: "not_found" };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const occ = resolveSessionWindow(session, nowMs);
    const effOccKey = occurrenceKey || (occ ? occ.occurrenceKey : nowIso.slice(0, 10));
    const isRecurring = session.recurrence === "weekly" || session.type === "recurring" || (session.schedule && session.schedule.type && session.schedule.type !== "once");

    // 1. Mark session closed in Firestore (or record lastAutoClosedKey for recurring sessions)
    const sessionPatch = {
      lastAutoClosedKey: effOccKey,
      closedAt: nowIso,
      closedBy: "system_watchdog",
      updatedAt: nowIso
    };
    const sessionMask = ["lastAutoClosedKey", "closedAt", "closedBy", "updatedAt"];
    if (!isRecurring) {
      sessionPatch.status = "closed";
      sessionPatch.active = false;
      sessionMask.push("status", "active");
    }
    firestorePatch(`attendance_sessions/${sessionId}`, sessionPatch, sessionMask);

    // 2. Fetch approved members & filter eligible
    const allUsers = fetchApprovedUsers();
    const eligibleMembers = allUsers.filter(u => isUserEligibleForSession(session, u));

    // 3. Fetch attendance logs for this session
    const existingLogs = fetchAttendanceLogsForSession(sessionId);
    const attendedUids = new Set(
      existingLogs
        .filter(l => !effOccKey || !l.occurrenceKey || l.occurrenceKey === effOccKey)
        .map(l => l.uid || l.userId)
        .filter(Boolean)
    );

    // 4. Fetch approved waivers for this session
    const approvedWaivers = fetchApprovedWaiversForSession(sessionId);
    const waivedUids = new Set(
      approvedWaivers
        .filter(w => !effOccKey || !w.occurrenceKey || w.occurrenceKey === effOccKey)
        .map(w => w.uid || w.userId)
        .filter(Boolean)
    );

    // 5. Calculate absence penalties
    const ptsAbsence = Number(session.pointsPenalty && session.pointsPenalty.absence) ||
      Number(session.absencePenalty) || 5;
    const fineAbsence = Number(session.finePenalty && session.finePenalty.absence) ||
      Number(session.absenceFineEGP) || 0;

    let absentCount = 0;
    const sessionTitle = session.title || "Attendance Session";

    eligibleMembers.forEach(member => {
      const uid = member.id || member.uid;
      if (!uid) return;
      if (attendedUids.has(uid)) return;
      if (waivedUids.has(uid)) return;

      absentCount++;
      const logDocId = `${sessionId}_${effOccKey}_${uid}`;

      // A. Create absent attendance log
      const absentLogData = {
        id: logDocId,
        sessionId: sessionId,
        sessionTitle: sessionTitle,
        occurrenceKey: effOccKey,
        sessionDate: effOccKey,
        uid: uid,
        userId: uid,
        userName: member.displayName || member.name || "Member",
        displayName: member.displayName || member.name || "Member",
        userAvatar: member.photoURL || member.avatarUrl || "",
        status: "absent",
        earlyMinutes: 0,
        lateMinutes: 0,
        lateSeconds: 0,
        penalty: ptsAbsence,
        pointsPenalty: ptsAbsence,
        finePenalty: fineAbsence,
        fineEGP: fineAbsence,
        pointsDelta: -ptsAbsence,
        egpDelta: -fineAbsence,
        appliedTierLabel: "Absent (Auto-Close)",
        ledgerSynced: true,
        checkInTimestamp: nowMs,
        checkInTime: nowIso,
        checkedInAt: nowIso,
        timestamp: nowIso,
        createdAt: nowIso
      };
      firestorePatch(`attendance_logs/${logDocId}`, absentLogData);
      firestorePatch(`attendance_records/${logDocId}`, absentLogData);

      // B. Update member profile points, penalties & fines via canonical helper (Guardrail 3)
      const freshUser = firestoreGet(`users/${uid}`) || member;
      applyCanonicalUserLedgerUpdate(uid, freshUser, {
        pointsChange: -ptsAbsence,
        penaltyChange: ptsAbsence,
        fineChange: fineAbsence,
        nowMs: nowMs,
        nowIso: nowIso,
        lastOpId: logDocId
      });

      // Write audit trail in adjustments collection
      firestorePost("adjustments", {
        uid: uid,
        targetUid: uid,
        userName: member.displayName || member.name || "Member",
        type: "penalty",
        amount: ptsAbsence,
        pointsDelta: -ptsAbsence,
        egpDelta: -fineAbsence,
        amountEGP: -fineAbsence,
        fineAmount: fineAbsence,
        reason: `Absent: ${sessionTitle} (${effOccKey})`,
        sessionId: sessionId,
        sessionTitle: sessionTitle,
        occurrenceKey: effOccKey,
        adminId: "system_watchdog",
        status: "applied",
        createdAt: nowIso,
        timestamp: nowIso
      });

      // C. Write ledger transaction
      firestorePost(`users/${uid}/transactions`, {
        uid: uid,
        userId: uid,
        sessionId: sessionId,
        bucket: "penalties",
        direction: "add",
        type: "attendance_absence_penalty",
        category: "attendance",
        amount: ptsAbsence,
        pointsDelta: -ptsAbsence,
        egpDelta: -fineAbsence,
        reason: `Absent: ${sessionTitle} (${effOccKey})`,
        status: "active",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });

      // D. Dispatch in-app notification
      const notifTitle = "Session Closed — Absence Recorded ⚠️";
      const notifBody = `You missed check-in for "${sessionTitle}". Penalty: -${ptsAbsence} pts${fineAbsence > 0 ? `, -${fineAbsence} EGP` : ""}.`;
      const notifPayload = {
        uid: uid,
        userId: uid,
        title: notifTitle,
        message: notifBody,
        body: notifBody,
        type: "penalty",
        category: "alert",
        icon: "alert-circle",
        sessionId: sessionId,
        read: false,
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      };
      firestorePost("notifications", notifPayload);
      firestorePost(`users/${uid}/notifications`, notifPayload);

      // E. Dispatch external Chrome Web Push to absent member
      const memberTokens = collectFcmTokensForUsers([member]);
      if (memberTokens.length > 0) {
        sendFcmWebPush(memberTokens, notifTitle, notifBody, CONFIG.PWA_URL + "#attendance");
      }
    });

    console.log(`[Close] Session ${sessionId} (${effOccKey}) finalized. Penalized ${absentCount} absent members.`);
    return { closed: true, absentCount: absentCount, occurrenceKey: effOccKey };
  });
}

// -------------------------------------------------------------
// NOTIFICATION MANAGER & FCM HTTP v1 WEB PUSH ENGINE
// -------------------------------------------------------------

/**
 * Handles Admin Notification Manager dispatches via GAS Admin OAuth token
 * (bypassing client Firestore permission issues) and sends real Chrome Web Push.
 */
function handleDispatchNotification(payload) {
  const title = String(payload.title || "").trim();
  const body = String(payload.body || payload.message || "").trim();
  if (!title || !body) {
    throw new Error("Notification title and body are required.");
  }

  const category = payload.category || "system";
  const icon = payload.icon || "bell";
  const senderUid = payload.senderUid || payload.adminUid || "admin";
  const senderName = payload.senderName || "Admin";
  const isBroadcast = Boolean(payload.isBroadcast || payload.targetType === "all" || (!payload.targetUid && (!payload.recipients || payload.recipients.length === 0)));
  const skipFirestoreWrite = Boolean(payload.skipFirestoreWrite);
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  const allUsers = fetchApprovedUsers();
  let targetUids = Array.isArray(payload.recipients) ? payload.recipients.filter(Boolean) : [];
  if (payload.targetUid) {
    targetUids.push(payload.targetUid);
  }
  if (isBroadcast || targetUids.length === 0) {
    targetUids = allUsers.map(u => u.id || u.uid).filter(Boolean);
  }

  if (!skipFirestoreWrite) {
    if (isBroadcast) {
      firestorePost("notifications_broadcast", {
        title: title,
        message: body,
        body: body,
        type: category,
        category: category,
        icon: icon,
        target: "all",
        targetType: "all",
        senderUid: senderUid,
        senderName: senderName,
        active: true,
        archived: false,
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      });
    }

    targetUids.forEach(uid => {
      const notifData = {
        uid: uid,
        userId: uid,
        title: title,
        message: body,
        body: body,
        type: category,
        category: category,
        icon: icon,
        targetType: isBroadcast ? "all" : "individual",
        senderUid: senderUid,
        senderName: senderName,
        read: false,
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: nowMs
      };
      firestorePost("notifications", notifData);
      firestorePost(`users/${uid}/notifications`, notifData);
    });
  }

  const targetUidSet = new Set(targetUids);
  const targetUserObjs = allUsers.filter(u => targetUidSet.has(u.id || u.uid));

  let pushSentCount = 0;
  try {
    const tokens = collectFcmTokensForUsers(targetUserObjs);
    if (tokens.length > 0) {
      pushSentCount = sendFcmWebPush(tokens, title, body, CONFIG.PWA_URL + "#notifications");
    }
  } catch (pushErr) {
    console.warn("[handleDispatchNotification] FCM push dispatch warning:", (pushErr && pushErr.message) || pushErr);
  }

  return {
    status: "success",
    ok: true,
    recipientCount: targetUids.length,
    pushSentCount: pushSentCount
  };
}

/**
 * Registers or unregisters a member's Web Push token in Firestore via GAS Admin OAuth.
 */
function handleRegisterPushToken(payload) {
  const uid = payload.uid;
  if (!uid) throw new Error("Missing uid for REGISTER_PUSH_TOKEN");

  const enabled = Boolean(payload.pushEnabled);
  const token = String(payload.token || "").trim();
  const nowIso = new Date().toISOString();

  const userDoc = firestoreGet(`users/${uid}`) || {};
  let existingTokens = Array.isArray(userDoc.fcmTokens) ? userDoc.fcmTokens.filter(Boolean) : [];

  if (enabled && token) {
    if (!existingTokens.includes(token)) existingTokens.push(token);
  } else if (!enabled && token) {
    existingTokens = existingTokens.filter(t => t !== token);
  } else if (!enabled) {
    existingTokens = [];
  }

  firestorePatch(`users/${uid}`, {
    pushEnabled: enabled,
    fcmTokens: existingTokens,
    pushUpdatedAt: nowIso
  }, ["pushEnabled", "fcmTokens", "pushUpdatedAt"]);

  firestorePatch(`users_private/${uid}`, {
    pushEnabled: enabled,
    fcmTokens: existingTokens,
    updatedAt: nowIso
  }, ["pushEnabled", "fcmTokens", "updatedAt"]);

  return {
    uid: uid,
    pushEnabled: enabled,
    tokenCount: existingTokens.length
  };
}

/**
 * Extracts unique FCM tokens for a list of user documents.
 */
function collectFcmTokensForUsers(users) {
  const tokenSet = new Set();
  (users || []).forEach(u => {
    if (!u || u.pushEnabled === false) return;
    if (Array.isArray(u.fcmTokens)) {
      u.fcmTokens.forEach(t => {
        if (t && typeof t === "string" && !t.startsWith("local-sw-")) {
          tokenSet.add(t);
        }
      });
    }
    if (u.fcmToken && typeof u.fcmToken === "string" && !u.fcmToken.startsWith("local-sw-")) {
      tokenSet.add(u.fcmToken);
    }
  });
  return Array.from(tokenSet);
}

/**
 * Sends Web Push notifications via Firebase Cloud Messaging HTTP v1 API.
 */
function sendFcmWebPush(userTokens, title, body, clickTargetUrl) {
  if (!Array.isArray(userTokens) || userTokens.length === 0) return 0;
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/messages:send`;
  const targetLink = clickTargetUrl || CONFIG.PWA_URL;
  let successCount = 0;

  userTokens.forEach(token => {
    if (!token) return;
    try {
      const messagePayload = {
        message: {
          token: token,
          notification: {
            title: title,
            body: body
          },
          data: {
            title: title,
            body: body,
            url: targetLink
          },
          webpush: {
            notification: {
              title: title,
              body: body,
              icon: CONFIG.PWA_URL + "pwa-192x192.png",
              badge: CONFIG.PWA_URL + "pwa-192x192.png"
            },
            fcm_options: {
              link: targetLink
            }
          }
        }
      };

      const res = UrlFetchApp.fetch(fcmEndpoint, {
        method: "post",
        headers: getAuthHeader(),
        payload: JSON.stringify(messagePayload),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        successCount++;
      } else {
        console.warn(`[FCM] Token push non-200 (${res.getResponseCode()}): ${res.getContentText()}`);
      }
    } catch (err) {
      console.error("[FCM] sendFcmWebPush error:", err);
    }
  });

  return successCount;
}

/**
 * Checks session eligibility matching frontend rules.
 */
function isUserEligibleForSession(session, user) {
  if (!session || !user) return false;
  if (user.disabled || user.blocked) return false;
  const assignmentType = session.assignmentType || (session.targetType === "custom" ? "specific" : (session.targetType === "badge" ? "by_badge" : "all"));

  if (assignmentType === "all") return true;

  if (assignmentType === "specific") {
    const list = Array.isArray(session.assignedMembers) && session.assignedMembers.length > 0
      ? session.assignedMembers
      : (Array.isArray(session.assignedUids) ? session.assignedUids : []);
    const uid = user.id || user.uid;
    return list.includes(uid);
  }

  if (assignmentType === "by_badge") {
    const userBadges = Array.isArray(user.badgeIds) ? user.badgeIds : (Array.isArray(user.badges) ? user.badges : []);
    const bIds = Array.isArray(session.badgeIds) ? session.badgeIds : [];
    if (bIds.length === 0) return true;
    return bIds.some(b => userBadges.includes(b));
  }

  return true;
}

// -------------------------------------------------------------
// TRIGGER ADAPTIVE SCHEDULING (GUARDRAIL 2: QUOTA PROTECTION)
// -------------------------------------------------------------

/**
 * Guardrail 2: Inspects ScriptApp.getProjectTriggers() first.
 * Only creates the 1-minute trigger if it does not already exist, and only deletes it
 * when transitioning back to idle (shouldBeActive === false).
 */
function setOneMinuteTriggerActive(shouldBeActive) {
  if (typeof ScriptApp === "undefined" || !ScriptApp || typeof ScriptApp.getProjectTriggers !== "function") {
    return;
  }
  const triggers = ScriptApp.getProjectTriggers();
  let has5Min = false;
  let has1Min = false;

  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "watchdog5Min") {
      has5Min = true;
    } else if (fn === "sessionHeartbeat1Min") {
      if (shouldBeActive) {
        has1Min = true;
      } else {
        ScriptApp.deleteTrigger(t);
      }
    }
  });

  if (!has5Min) {
    ScriptApp.newTrigger("watchdog5Min")
      .timeBased()
      .everyMinutes(5)
      .create();
  }

  if (shouldBeActive && !has1Min) {
    ScriptApp.newTrigger("sessionHeartbeat1Min")
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

function ensureTriggers(hasActiveSessions) {
  return setOneMinuteTriggerActive(hasActiveSessions);
}

/**
 * Setup function: Call this once to initialize backend triggers.
 */
function setup() {
  console.log("[Setup] Initializing watchdog triggers...");
  setOneMinuteTriggerActive(false);
  syncAndEvaluateAll();
  console.log("[Setup] Finished initialization.");
}

function processScheduledNotifications() {
  console.log("[Notifications] Processing scheduled background queue...");
}

// -------------------------------------------------------------
// FIRESTORE REST API CLIENT
// -------------------------------------------------------------

function getAuthHeader() {
  return {
    "Authorization": "Bearer " + ScriptApp.getOAuthToken(),
    "Content-Type": "application/json"
  };
}

function firestoreUrl(path) {
  const cleanPath = String(path).replace(/^\//, "");
  return `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/${cleanPath}`;
}

function firestoreGet(path) {
  try {
    const res = UrlFetchApp.fetch(firestoreUrl(path), {
      method: "get",
      headers: getAuthHeader(),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      return fromFirestore(data);
    }
    return null;
  } catch (err) {
    console.error("firestoreGet error:", err);
    return null;
  }
}

function firestoreList(collectionPath, pageSize = 300) {
  try {
    const url = `${firestoreUrl(collectionPath)}?pageSize=${pageSize}`;
    const res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: getAuthHeader(),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      const docs = data.documents || [];
      return docs.map(fromFirestore);
    }
    return [];
  } catch (err) {
    console.error("firestoreList error:", err);
    return [];
  }
}

function firestorePost(collectionPath, obj) {
  try {
    const url = firestoreUrl(collectionPath);
    const body = JSON.stringify(toFirestore(obj));
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      headers: getAuthHeader(),
      payload: body,
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return fromFirestore(JSON.parse(res.getContentText()));
    }
    console.warn(`firestorePost failed: ${res.getResponseCode()} ${res.getContentText()}`);
    return null;
  } catch (err) {
    console.error("firestorePost error:", err);
    return null;
  }
}

function firestorePatch(docPath, obj, fieldMaskArray = []) {
  try {
    let url = firestoreUrl(docPath);
    if (fieldMaskArray && fieldMaskArray.length > 0) {
      const maskParams = fieldMaskArray.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
      url += `?${maskParams}`;
    }
    const body = JSON.stringify(toFirestore(obj));
    const res = UrlFetchApp.fetch(url, {
      method: "patch",
      headers: getAuthHeader(),
      payload: body,
      muteHttpExceptions: true
    });
    return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  } catch (err) {
    console.error("firestorePatch error:", err);
    return false;
  }
}

function firestoreDelete(docPath) {
  try {
    const url = firestoreUrl(docPath);
    const res = UrlFetchApp.fetch(url, {
      method: "delete",
      headers: getAuthHeader(),
      muteHttpExceptions: true
    });
    return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  } catch (err) {
    console.error("firestoreDelete error:", err);
    return false;
  }
}

// -------------------------------------------------------------
// FIRESTORE SERIALIZERS & SCHEDULE HELPERS
// -------------------------------------------------------------

function fetchSessionsFromFirestore(statusFilter = null) {
  const list = firestoreList("attendance_sessions", 100);
  if (!statusFilter) return list;
  return list.filter(s => {
    if (statusFilter === "active") {
      return s.status === "active" || (!s.status && s.active !== false && !s.archived);
    }
    return s.status === statusFilter;
  });
}

function fetchTasksFromFirestore() {
  const list = firestoreList("tasks", 150);
  return list.filter(t => t && !t.archived && t.status !== "archived" && t.active !== false);
}

function fetchSingleSession(sessionId) {
  return firestoreGet(`attendance_sessions/${sessionId}`);
}

function fetchApprovedUsers() {
  const users = firestoreList("users", 300);
  return users.filter(u => !u.disabled && !u.blocked);
}

function fetchAttendanceLogsForSession(sessionId) {
  const logs = firestoreList("attendance_logs", 300);
  return logs.filter(l => l.sessionId === sessionId);
}

function fetchSubmissionsForTask(taskId) {
  const subs = firestoreList("submissions", 300);
  return subs.filter(s => s.taskId === taskId);
}

function fetchMissedPenaltiesForTask(taskId) {
  const penalties = firestoreList("missed_penalties", 300);
  return penalties.filter(m => m.taskId === taskId);
}

function fetchApprovedWaiversForSession(sessionId) {
  const waivers = firestoreList("waivers", 150).concat(firestoreList("waiver_requests", 150));
  return waivers.filter(w => w.sessionId === sessionId && (w.status === "approved" || w.approved === true));
}

function resolveSessionWindow(session, nowMs) {
  if (!session) return null;
  const start = getSessionStartDate(session, nowMs);
  if (!start || isNaN(start.getTime())) return null;

  const startMs = start.getTime();
  const earlyMins = Number(session.earlyWindowMinutes != null ? session.earlyWindowMinutes : (session.earlyCheckInMinutes != null ? session.earlyCheckInMinutes : 60));
  const cutoffMins = Number(session.lateCutoffMinutes != null ? session.lateCutoffMinutes : (session.durationMinutes != null ? session.durationMinutes : 120));

  let cutoffMs = startMs + cutoffMins * 60000;
  if (session.endTime) {
    const parsedEnd = new Date(session.endTime).getTime();
    if (!isNaN(parsedEnd) && parsedEnd > startMs) {
      cutoffMs = parsedEnd;
    }
  }

  const openWindowMs = startMs - earlyMins * 60000;
  const sched = normalizeScheduleObject(session.schedule || session);
  const occurrenceKey = (sched.type && sched.type !== "once")
    ? formatZonedDateKey(startMs, CONFIG.TIMEZONE)
    : (session.date || formatZonedDateKey(startMs, CONFIG.TIMEZONE));

  return {
    startMs: startMs,
    cutoffMs: cutoffMs,
    openWindowMs: openWindowMs,
    occurrenceKey: occurrenceKey
  };
}

function getSessionStartDate(session, nowMs = Date.now()) {
  if (!session) return null;
  if (session.schedule && session.schedule.type && session.schedule.type !== "once") {
    const sched = normalizeScheduleObject(session.schedule);
    const baseStartMs = parseDateTimeToMs(sched.startDateTime);
    const earlyMins = Number(session.earlyWindowMinutes != null ? session.earlyWindowMinutes : (session.earlyCheckInMinutes != null ? session.earlyCheckInMinutes : 60));
    const earlyWindowMs = earlyMins * 60000;
    const fromMs = Math.max(baseStartMs, nowMs - 35 * 86400000);
    const toMs = nowMs + 35 * 86400000;
    const occs = getOccurrencesInGas(sched, fromMs, toMs);
    if (occs.length > 0) {
      const upcomingIdx = occs.findIndex(o => o > nowMs);
      if (upcomingIdx !== -1 && nowMs >= occs[upcomingIdx] - earlyWindowMs) {
        return new Date(occs[upcomingIdx]);
      }
      const pastOccs = occs.filter(o => o <= nowMs);
      if (pastOccs.length > 0) {
        return new Date(pastOccs[pastOccs.length - 1]);
      }
      return new Date(occs[0]);
    }
  }
  if (session.schedule && session.schedule.startDateTime) {
    return new Date(parseDateTimeToMs(session.schedule.startDateTime));
  }
  if (session.startDateTime) return new Date(parseDateTimeToMs(session.startDateTime));
  if (session.startTime) {
    const parsed = new Date(session.startTime);
    if (!isNaN(parsed.getTime())) return parsed;
    if (session.date && /^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
      return new Date(parseDateTimeToMs(`${session.date}T${session.startTime}:00`, CONFIG.TIMEZONE));
    }
  }
  return null;
}

function getSessionCutoffDate(session) {
  const occ = resolveSessionWindow(session, Date.now());
  return occ ? new Date(occ.cutoffMs) : null;
}

function fromFirestore(doc) {
  if (!doc) return null;
  const id = doc.name ? doc.name.split("/").pop() : "";
  const fields = doc.fields || {};
  const obj = { id: id };
  for (const k in fields) {
    obj[k] = unwrapValue(fields[k]);
  }
  return obj;
}

function unwrapValue(val) {
  if (!val || typeof val !== "object") return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return Boolean(val.booleanValue);
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.mapValue !== undefined) {
    const res = {};
    const sub = val.mapValue.fields || {};
    for (const sk in sub) res[sk] = unwrapValue(sub[sk]);
    return res;
  }
  if (val.arrayValue !== undefined) {
    const arr = val.arrayValue.values || [];
    return arr.map(unwrapValue);
  }
  return null;
}

function toFirestore(obj) {
  const fields = {};
  for (const k in obj) {
    if (k === "id") continue;
    fields[k] = wrapValue(obj[k]);
  }
  return { fields: fields };
}

function wrapValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(wrapValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const k in val) fields[k] = wrapValue(val[k]);
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(val) };
}
