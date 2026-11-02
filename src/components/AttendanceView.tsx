import React, { useState } from 'react';
import { AttendanceSession, AttendanceLog, UserProfile, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { 
  CalendarCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Award, 
  Calendar, 
  Flame, 
  ShieldAlert,
  Loader2,
  Sparkles
} from 'lucide-react';

interface AttendanceViewProps {
  sessions: AttendanceSession[];
  logs: AttendanceLog[];
  user: UserProfile | null;
  language: Language;
  onCheckIn: (session: AttendanceSession, lateMinutes: number, penalty: number, bonus: number) => Promise<void>;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  sessions,
  logs,
  user,
  language,
  onCheckIn,
}) => {
  const t = translations[language];
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState<string | null>(null);

  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayKey = today.toISOString().split('T')[0];

  const currentHours = today.getHours();
  const currentMinutes = today.getMinutes();
  const currentTimeTotalMinutes = currentHours * 60 + currentMinutes;

  // Filter sessions active today
  const activeSessionsToday = sessions.filter((s) => {
    if (!s.isActive) return false;
    if (!s.scheduledDays || s.scheduledDays.length === 0) return true;
    return s.scheduledDays.includes(currentDayOfWeek);
  });

  const handleCheckInClick = async (session: AttendanceSession) => {
    if (!user) return;
    setIsCheckingIn(session.id);
    setCheckInSuccessMsg(null);

    try {
      // Parse exact start time
      const [startH, startM] = session.exactStartTime.split(':').map((v) => parseInt(v, 10));
      const sessionStartTotalMinutes = startH * 60 + startM;

      let lateMinutes = 0;
      let penalty = 0;
      let bonus = 0;

      // If checked in after exact start + grace period
      const effectiveGraceMinutes = sessionStartTotalMinutes + (session.gracePeriodMinutes || 0);

      if (currentTimeTotalMinutes > effectiveGraceMinutes) {
        lateMinutes = currentTimeTotalMinutes - effectiveGraceMinutes;
        // Calculate penalty formula
        const unit = session.penaltyUnitMinutes || 5;
        const rate = session.penaltyRatePerUnit || 2;
        const rawPenalty = Math.ceil(lateMinutes / unit) * rate;
        const minP = session.minPenalty || 5;
        const maxP = session.maxPenaltyCap || 50;
        penalty = Math.min(maxP, Math.max(minP, rawPenalty));
      } else {
        // On time bonus!
        bonus = 10;
      }

      await onCheckIn(session, lateMinutes, penalty, bonus);
      setCheckInSuccessMsg(
        penalty > 0
          ? `${t.latePenalty}: -${penalty} ${t.points} (${lateMinutes} ${t.minutesLate})`
          : `${t.onTimeBonus}! (+10 ${t.points})`
      );
    } finally {
      setIsCheckingIn(null);
    }
  };

  // User logs
  const userLogs = logs.filter((l) => l.userId === user?.uid);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Attendance Header Banner */}
      <div className="relative rounded-3xl glass-panel-elevated p-6 sm:p-8 overflow-hidden border border-white/10">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#0A84FF]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mb-2">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>{t.smartAttendance}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t.attendance}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl">
              {t.attendanceSub}
            </p>
          </div>

          {/* User Quick Attendance Summary */}
          {user && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-initial px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                <div className="text-xl font-black text-emerald-300">
                  {userLogs.filter((l) => l.status === 'on_time').length}
                </div>
                <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                  On Time
                </div>
              </div>

              <div className="flex-1 md:flex-initial px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                <div className="text-xl font-black text-rose-400">
                  {user.totalPenalties || 0}
                </div>
                <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                  Penalties
                </div>
              </div>
            </div>
          )}
        </div>

        {checkInSuccessMsg && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{checkInSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Today's Active Attendance Sessions */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0A84FF]" />
          <span>Today's Sessions ({activeSessionsToday.length})</span>
        </h3>

        {activeSessionsToday.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessionsToday.map((session) => {
              const alreadyCheckedIn = userLogs.some(
                (l) => l.sessionId === session.id && l.dateKey === todayKey
              );

              return (
                <div
                  key={session.id}
                  className="rounded-3xl glass-panel p-6 border border-white/10 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/[0.06] text-neutral-200 border border-white/10">
                        {session.exactStartTime} - {session.checkInWindowEnd}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{t.gracePeriod}: {session.gracePeriodMinutes}m</span>
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white">{session.title}</h4>

                    <div className="mt-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Late penalty rate:</span>
                        <span className="font-semibold text-rose-300">
                          -{session.penaltyRatePerUnit} pts / {session.penaltyUnitMinutes} min
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Max penalty cap:</span>
                        <span className="font-semibold text-rose-400">-{session.maxPenaltyCap} pts</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {alreadyCheckedIn ? (
                      <div className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{t.checkedInSuccess}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCheckInClick(session)}
                        disabled={isCheckingIn === session.id}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isCheckingIn === session.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Calculating check-in...</span>
                          </>
                        ) : (
                          <>
                            <CalendarCheck className="w-4 h-4" />
                            <span>{t.checkInNow}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl glass-panel p-10 text-center border border-white/10">
            <CalendarCheck className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-400 font-medium">{t.noAttendanceSessions}</p>
          </div>
        )}
      </div>

      {/* Member Attendance History */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">Your Check-In Logs ({userLogs.length})</h4>
          <span className="text-xs text-neutral-400">Timestamped in Firestore</span>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {userLogs.map((log) => (
            <div key={log.id} className="p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{log.sessionTitle}</span>
                  {log.status === 'on_time' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      On Time ✓
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {log.lateMinutes}m Late
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {log.dateKey} • {log.checkInTimestamp?.slice(11, 16) || 'Check-in'}
                </div>
              </div>

              <div className="text-right">
                {log.bonusPointsApplied > 0 && (
                  <span className="text-xs font-bold text-emerald-400">
                    +{log.bonusPointsApplied} pts bonus
                  </span>
                )}
                {log.penaltyPointsApplied > 0 && (
                  <span className="text-xs font-bold text-rose-400">
                    -{log.penaltyPointsApplied} pts penalty
                  </span>
                )}
              </div>
            </div>
          ))}

          {userLogs.length === 0 && (
            <div className="py-10 text-center text-neutral-400 text-xs">
              No check-in history recorded yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
