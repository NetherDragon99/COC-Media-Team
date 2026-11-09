/**
 * CoC Media Team - Dedicated Serverless Backend (v3.1.8)
 * Autonomous Attendance Watchdog, Bidirectional Brackets & Grace Period Engine, Ledger Sync & FCM v1 Web Push
 * Deployed on Google Apps Script via @google/clasp
 */

const CONFIG = {
  FIREBASE_PROJECT_ID: "coc-media-team",
  PRE_SESSION_BUFFER_MINUTES: 15,
  MAX_DAILY_AUTO_CLOSE_CHECK: 50,
  TIMEZONE: "Africa/Cairo",
  PWA_URL: "https://stevenmario.github.io/COC-Media-Team/"
};

// -------------------------------------------------------------
// HTTP ROUTER (WEBHOOK & HEALTH CHECK)
// -------------------------------------------------------------
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    version: "3.1.8",
    system: "CoC Media Backend Watchdog & Push Engine",
    timezone: CONFIG.TIMEZONE,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const rawData = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(rawData);
    const action = payload.action || "";

    if (action === "SESSION_UPDATED" || action === "FORCE_EVALUATE") {
      syncAndEvaluateSessions();
      return jsonResponse({
        status: "success",
        message: "Trigger schedules evaluated and synchronized successfully."
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

    if (action === "PROCESS_CHECKIN") {
      const result = processCheckInAndSyncLedger(payload);
      return jsonResponse({
        status: "success",
        message: "Check-in evaluated and member ledger synchronized.",
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
      const logs = firestoreList("attendance_logs", 1000);
      const records = firestoreList("attendance_records", 1000);
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
      error: err.toString()
    });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// ADAPTIVE CRON LOOPS & WATCHDOGS
// -------------------------------------------------------------

/**
 * Base Watchdog: Runs every 5 minutes in idle periods.
 */
function watchdog5Min() {
  console.log("[Watchdog 5-Min] Checking active and upcoming sessions...");
  syncAndEvaluateSessions();
  processScheduledNotifications();
}

/**
 * High-Frequency Heartbeat: Runs every 1 minute strictly during active sessions.
 */
function sessionHeartbeat1Min() {
  console.log("[Heartbeat 1-Min] Inspecting active sessions...");
  const result = syncAndEvaluateSessions();
  if (!result.hasActiveOrUpcoming) {
    console.log("[Heartbeat 1-Min] No remaining active sessions. De-escalating triggers to 5-min watchdog...");
    ensureTriggers(false);
  }
}

/**
 * Evaluates all sessions to auto-close expired sessions, send opening window alerts,
 * and determine if high-frequency heartbeat is needed.
 */
function syncAndEvaluateSessions() {
  const now = new Date();
  const nowMs = now.getTime();
  const allSessions = fetchSessionsFromFirestore();
  let hasActiveOrUpcoming = false;
  let allUsersCache = null;

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

  ensureTriggers(hasActiveOrUpcoming);
  return { hasActiveOrUpcoming: hasActiveOrUpcoming };
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
    } catch (_) {}
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
 * Ensures check-in log and member ledger balances/transactions are synchronized in Firestore.
 */
function processCheckInAndSyncLedger(payload) {
  const uid = payload.uid;
  const sessionId = payload.sessionId;
  const logId = payload.logId;
  if (!uid || !sessionId) {
    throw new Error("Missing uid or sessionId in PROCESS_CHECKIN");
  }

  const session = fetchSingleSession(sessionId) || {};
  const existingLog = logId ? firestoreGet(`attendance_logs/${logId}`) : null;
  if (existingLog && existingLog.ledgerSynced === true) {
    return { skipped: true, reason: "Ledger already synced for log " + logId };
  }

  const checkInMs = Number(payload.checkInTimestamp) || Date.now();
  const startMs = Number(payload.sessionStartMs) || (getSessionStartDate(session) ? getSessionStartDate(session).getTime() : checkInMs);
  const evalResult = evaluateCheckInTiming(session, checkInMs, startMs);

  const pointsDelta = payload.pointsDelta !== undefined ? Number(payload.pointsDelta) : evalResult.pointsDelta;
  const egpDelta = payload.egpDelta !== undefined ? Number(payload.egpDelta) : evalResult.egpDelta;
  const nowIso = new Date().toISOString();

  // Update attendance_logs/{logId} AND attendance_records/{logId} if logId provided
  const logPayload = {
    id: logId,
    sessionId: sessionId,
    sessionTitle: session.title || payload.sessionTitle || "Attendance Session",
    occurrenceKey: payload.occurrenceKey || "",
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
    checkInTimestamp: checkInMs,
    checkInTime: nowIso,
    updatedAt: nowIso
  };

  if (logId) {
    firestorePatch(`attendance_logs/${logId}`, logPayload);
    firestorePatch(`attendance_records/${logId}`, logPayload);
  }

  // Force backend to write ledger sync to users/{uid}
  const userDoc = firestoreGet(`users/${uid}`);
  if (userDoc) {
    const curPts = Number(userDoc.points) || 0;
    const curTotalPts = Number(userDoc.totalPoints != null ? userDoc.totalPoints : curPts);
    const curPen = Number(userDoc.penalties) || 0;
    const curFines = Number(userDoc.finesDue != null ? userDoc.finesDue : (userDoc.fines || 0));

    const bonusPts = pointsDelta > 0 ? pointsDelta : 0;
    const penaltyPts = pointsDelta < 0 ? Math.abs(pointsDelta) : 0;
    const bonusEGP = egpDelta > 0 ? egpDelta : 0;
    const penaltyEGP = egpDelta < 0 ? Math.abs(egpDelta) : 0;

    const newPoints = curPts + pointsDelta;
    const newTotalPoints = curTotalPts + pointsDelta;
    // Early bonus points strictly increment points and NEVER reduce penalties!
    const newPenalties = Math.max(0, curPen + penaltyPts);
    const newFines = Math.max(0, curFines - bonusEGP + penaltyEGP);
    const newNetPts = Math.max(0, newPoints - newPenalties);

    const userPatch = {
      points: newPoints,
      totalPoints: newTotalPoints,
      penalties: newPenalties,
      fines: newFines,
      finesDue: newFines,
      netPts: newNetPts,
      updatedAt: nowIso
    };
    const mask = ["points", "totalPoints", "penalties", "fines", "finesDue", "netPts", "updatedAt"];

    firestorePatch(`users/${uid}`, userPatch, mask);

    if (egpDelta !== 0) {
      firestorePatch(`users_private/${uid}`, {
        finesEGP: newFines,
        updatedAt: nowIso
      }, ["finesEGP", "updatedAt"]);
    }

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
        createdAtMs: checkInMs
      });

      // Write audit trail in adjustments collection
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
        source: "attendance_checkin",
        sessionId: sessionId,
        logId: logId || "",
        createdAt: nowIso,
        timestamp: nowIso,
        createdAtMs: checkInMs
      });
    }
  }

  return {
    logId: logId,
    status: evalResult.status,
    pointsDelta: pointsDelta,
    egpDelta: egpDelta,
    appliedTierLabel: evalResult.appliedTierLabel
  };
}

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

  const targetUid = payload.uid || existingLog?.uid || existingLog?.userId;
  const pointsDelta = payload.pointsDelta !== undefined
    ? Number(payload.pointsDelta)
    : Number(existingLog?.pointsDelta || (existingLog?.status === 'early' ? existingLog?.earlyBonusPoints : -existingLog?.penalty) || 0);
  const egpDelta = payload.egpDelta !== undefined
    ? Number(payload.egpDelta)
    : Number(existingLog?.egpDelta || (existingLog?.status === 'early' ? existingLog?.earlyBonusEGP : -existingLog?.fineEGP) || 0);

  firestoreDelete(`attendance_logs/${logId}`);
  firestoreDelete(`attendance_records/${logId}`);

  if (targetUid && (pointsDelta !== 0 || egpDelta !== 0)) {
    const userDoc = firestoreGet(`users/${targetUid}`);
    if (userDoc) {
      const nowIso = new Date().toISOString();
      const curPts = Number(userDoc.points) || 0;
      const curTotal = Number(userDoc.totalPoints != null ? userDoc.totalPoints : curPts);
      const curPen = Number(userDoc.penalties) || 0;
      const curFines = Number(userDoc.finesDue != null ? userDoc.finesDue : (userDoc.fines || 0));

      const bonusPts = pointsDelta > 0 ? pointsDelta : 0;
      const penaltyPts = pointsDelta < 0 ? Math.abs(pointsDelta) : 0;
      const bonusEGP = egpDelta > 0 ? egpDelta : 0;
      const penaltyEGP = egpDelta < 0 ? Math.abs(egpDelta) : 0;

      const reversedPoints = curPts - pointsDelta;
      const reversedTotal = curTotal - pointsDelta;
      // Reversing penalty decreases penalty debt; bonus points never reduced penalties
      const reversedPen = Math.max(0, curPen - penaltyPts);
      const reversedFines = Math.max(0, curFines + bonusEGP - penaltyEGP);
      const reversedNet = Math.max(0, reversedPoints - reversedPen);

      const userPatch = {
        points: reversedPoints,
        totalPoints: reversedTotal,
        penalties: reversedPen,
        fines: reversedFines,
        finesDue: reversedFines,
        netPts: reversedNet,
        updatedAt: nowIso
      };
      firestorePatch(`users/${targetUid}`, userPatch, ["points", "totalPoints", "penalties", "fines", "finesDue", "netPts", "updatedAt"]);

      if (egpDelta !== 0) {
        firestorePatch(`users_private/${targetUid}`, {
          finesEGP: reversedFines,
          updatedAt: nowIso
        }, ["finesEGP", "updatedAt"]);
      }

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
 * Updates an attendance log/record and synchronizes member ledger liabilities.
 */
function updateAttendanceLogAndSyncLedger(payload) {
  const logId = payload.logId;
  if (!logId) throw new Error("Missing logId in UPDATE_LOG");

  let existingLog = firestoreGet(`attendance_logs/${logId}`);
  if (!existingLog) {
    existingLog = firestoreGet(`attendance_records/${logId}`);
  }

  const targetUid = payload.uid || existingLog?.uid || existingLog?.userId;
  const oldPenalty = Number(existingLog?.penalty || 0);
  const oldFine = Number(existingLog?.fineEGP || 0);
  const oldPoints = Number(existingLog?.points !== undefined ? existingLog.points : (existingLog?.pointsDelta || (existingLog?.status === 'early' ? existingLog?.earlyBonusPoints : 0) || 0));

  const newStatus = payload.status || existingLog?.status || 'on_time';
  const newPenalty = payload.penalty !== undefined ? Math.max(0, Number(payload.penalty) || 0) : oldPenalty;
  const newFine = payload.fineEGP !== undefined ? Math.max(0, Number(payload.fineEGP) || 0) : oldFine;
  const newPoints = payload.points !== undefined ? Math.max(0, Number(payload.points) || 0) : oldPoints;
  const newNote = payload.adminNote !== undefined ? payload.adminNote : (existingLog?.adminNote || '');
  const nowIso = new Date().toISOString();

  const patchData = {
    status: newStatus,
    penalty: newPenalty,
    fineEGP: newFine,
    points: newPoints,
    pointsDelta: newPoints,
    adminNote: newNote,
    updatedAt: nowIso
  };

  if (payload.checkedInAt) patchData.checkedInAt = payload.checkedInAt;
  if (payload.timestamp) patchData.timestamp = payload.timestamp;
  if (payload.occurrenceKey) patchData.occurrenceKey = payload.occurrenceKey;
  if (payload.sessionId) patchData.sessionId = payload.sessionId;
  if (payload.sessionTitle) patchData.sessionTitle = payload.sessionTitle;
  if (payload.userName) patchData.userName = payload.userName;
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

  // Calculate deltas to adjust member ledger
  const penDiff = newPenalty - oldPenalty;
  const fineDiff = newFine - oldFine;
  const ptsDiff = newPoints - oldPoints;

  if (targetUid && (penDiff !== 0 || fineDiff !== 0 || ptsDiff !== 0)) {
    const userDoc = firestoreGet(`users/${targetUid}`);
    if (userDoc) {
      const curPts = Number(userDoc.points) || 0;
      const curPen = Number(userDoc.penalties) || 0;
      const curFines = Number(userDoc.finesDue != null ? userDoc.finesDue : (userDoc.fines || 0));

      const updatedPts = Math.max(0, curPts + ptsDiff);
      const updatedPen = Math.max(0, curPen + penDiff);
      const updatedFines = Math.max(0, curFines + fineDiff);
      const updatedNet = Math.max(0, updatedPts - updatedPen);

      const userPatch = {
        points: updatedPts,
        penalties: updatedPen,
        fines: updatedFines,
        finesDue: updatedFines,
        netPts: updatedNet,
        updatedAt: nowIso
      };
      firestorePatch(`users/${targetUid}`, userPatch, ["points", "penalties", "fines", "finesDue", "netPts", "updatedAt"]);

      if (fineDiff !== 0) {
        firestorePatch(`users_private/${targetUid}`, {
          finesEGP: updatedFines,
          updatedAt: nowIso
        }, ["finesEGP", "updatedAt"]);
      }
    }
  }

  return { success: true, logId: logId, newStatus, newPenalty, newFine, newPoints };
}

// -------------------------------------------------------------
// AUTO-CLOSE & ABSENCE PENALTY ENGINE
// -------------------------------------------------------------

/**
 * Closes an attendance session and applies absence penalties to eligible members who did not attend.
 */
function closeSessionAndApplyPenalties(sessionId, sessionObj, occurrenceKey) {
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
  const isRecurring = session.recurrence === "weekly" || session.type === "recurring";

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
      createdAt: nowIso
    };
    firestorePatch(`attendance_logs/${logDocId}`, absentLogData);
    firestorePatch(`attendance_records/${logDocId}`, absentLogData);

    // B. Update member profile points, totalPoints, penalties & fines
    const freshUser = firestoreGet(`users/${uid}`) || member;
    const currentPoints = Number(freshUser.points) || 0;
    const currentTotalPoints = Number(freshUser.totalPoints != null ? freshUser.totalPoints : currentPoints);
    const currentPenalties = Number(freshUser.penalties) || 0;
    const currentFines = Number(freshUser.finesDue != null ? freshUser.finesDue : (freshUser.fines || 0));
    const nextPoints = currentPoints - ptsAbsence;
    const nextTotalPoints = currentTotalPoints - ptsAbsence;
    const nextPenalties = Math.max(0, currentPenalties + ptsAbsence);
    const nextFines = Math.max(0, currentFines + fineAbsence);
    const nextNetPts = Math.max(0, nextPoints - nextPenalties);

    firestorePatch(`users/${uid}`, {
      points: nextPoints,
      totalPoints: nextTotalPoints,
      penalties: nextPenalties,
      fines: nextFines,
      finesDue: nextFines,
      netPts: nextNetPts,
      updatedAt: nowIso
    }, ["points", "totalPoints", "penalties", "fines", "finesDue", "netPts", "updatedAt"]);

    if (fineAbsence > 0) {
      firestorePatch(`users_private/${uid}`, {
        finesEGP: nextFines,
        updatedAt: nowIso
      }, ["finesEGP", "updatedAt"]);
    }

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

  // Collect FCM Web Push tokens and send live push
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
// TRIGGER ADAPTIVE SCHEDULING
// -------------------------------------------------------------

function ensureTriggers(hasActiveSessions) {
  const triggers = ScriptApp.getProjectTriggers();
  let has5Min = false;
  let has1Min = false;

  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "watchdog5Min") {
      has5Min = true;
    } else if (fn === "sessionHeartbeat1Min") {
      if (hasActiveSessions) {
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

  if (hasActiveSessions && !has1Min) {
    ScriptApp.newTrigger("sessionHeartbeat1Min")
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

/**
 * Setup function: Call this once to initialize backend triggers.
 */
function setup() {
  console.log("[Setup] Initializing watchdog triggers...");
  ensureTriggers(false);
  syncAndEvaluateSessions();
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

function fetchApprovedWaiversForSession(sessionId) {
  const waivers = firestoreList("waivers", 150).concat(firestoreList("waiver_requests", 150));
  return waivers.filter(w => w.sessionId === sessionId && (w.status === "approved" || w.approved === true));
}

function resolveSessionWindow(session, nowMs) {
  if (!session) return null;
  const start = getSessionStartDate(session);
  if (!start || isNaN(start.getTime())) return null;

  const startMs = start.getTime();
  const earlyMins = Number(session.earlyWindowMinutes != null ? session.earlyWindowMinutes : 60);
  const cutoffMins = Number(session.lateCutoffMinutes != null ? session.lateCutoffMinutes : 120);

  let cutoffMs = startMs + cutoffMins * 60000;
  if (session.endTime) {
    const parsedEnd = new Date(session.endTime).getTime();
    if (!isNaN(parsedEnd) && parsedEnd > startMs) {
      cutoffMs = parsedEnd;
    }
  }

  const openWindowMs = startMs - earlyMins * 60000;
  const occurrenceKey = session.date || new Date(startMs).toISOString().slice(0, 10);

  return {
    startMs: startMs,
    cutoffMs: cutoffMs,
    openWindowMs: openWindowMs,
    occurrenceKey: occurrenceKey
  };
}

function getSessionStartDate(session) {
  if (!session) return null;
  if (session.schedule && session.schedule.startDateTime) {
    return new Date(session.schedule.startDateTime);
  }
  if (session.startDateTime) return new Date(session.startDateTime);
  if (session.startTime) {
    const parsed = new Date(session.startTime);
    if (!isNaN(parsed.getTime())) return parsed;
    if (session.date && /^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
      return new Date(`${session.date}T${session.startTime}:00+02:00`);
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
