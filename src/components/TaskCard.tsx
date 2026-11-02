import React, { useState, useEffect } from 'react';
import { Task, Category, TaskSubmission, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { 
  Award, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  Repeat, 
  Lock, 
  Users, 
  Plus, 
  AlertCircle,
  Timer
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  category?: Category;
  userSubmissions: TaskSubmission[];
  allTaskSubmissions: TaskSubmission[];
  language: Language;
  onInitiateComplete: (task: Task) => void;
  onOpenCompetition: (task: Task) => void;
  accentColor?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  userSubmissions,
  allTaskSubmissions,
  language,
  onInitiateComplete,
  onOpenCompetition,
  accentColor = '#0A84FF',
}) => {
  const t = translations[language];
  const todayKey = new Date().toISOString().split('T')[0];

  // User completions on this task
  const myCompletionsCount = userSubmissions.length;
  const isCompletedToday = userSubmissions.some((s) => s.dateKey === todayKey);
  const isCompletedOnce = myCompletionsCount > 0;

  // Countdown timer calculation
  const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (task.deadlineType === 'none' || !task.deadlineTimestamp) {
      setTimeLeftStr(null);
      setIsExpired(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = task.deadlineTimestamp! - now;

      if (diff <= 0) {
        setTimeLeftStr(t.expired);
        setIsExpired(true);
      } else {
        setIsExpired(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 24) {
          const days = Math.floor(hours / 24);
          setTimeLeftStr(`${days}d ${hours % 24}h`);
        } else {
          setTimeLeftStr(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [task.deadlineTimestamp, task.deadlineType, t.expired]);

  // Quota and completion logic
  let isLocked = isExpired;
  let lockReason = isExpired ? t.expired : '';
  let buttonLabel = t.completeTask;
  let targetQuota = task.targetQuota || 1;

  if (task.quotaType === 'once') {
    if (isCompletedOnce) {
      isLocked = true;
      lockReason = t.completedOnce;
    }
  } else if (task.quotaType === 'daily') {
    if (isCompletedToday) {
      isLocked = true;
      lockReason = t.completedToday;
    }
  } else if (task.quotaType === 'exact_target') {
    if (myCompletionsCount >= targetQuota) {
      isLocked = true;
      lockReason = `${t.completed} (${myCompletionsCount}/${targetQuota})`;
    } else {
      buttonLabel = `${t.completeTask} (${myCompletionsCount}/${targetQuota})`;
    }
  } else if (task.quotaType === 'unlimited') {
    buttonLabel = myCompletionsCount > 0 ? t.logNewCompletion : t.completeTask;
  }

  // Head to head contributors
  const contributorMap = new Map<string, number>();
  allTaskSubmissions.forEach((s) => {
    const name = s.userDisplayName || 'Member';
    contributorMap.set(name, (contributorMap.get(name) || 0) + 1);
  });
  const topContributors = Array.from(contributorMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Safe external Link
  let safeLink = task.taskLink;
  if (safeLink && !safeLink.startsWith('http://') && !safeLink.startsWith('https://')) {
    safeLink = `https://${safeLink}`;
  }

  const categoryName = language === 'ar' ? category?.nameAr : category?.nameEn;
  const categoryColor = category?.color || accentColor;

  return (
    <div className={`relative rounded-3xl glass-panel p-5 sm:p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 ${
      isLocked ? 'border-white/10 opacity-90' : 'glass-card-hover'
    }`}>
      {/* Top Ambient Glow */}
      <div 
        className="absolute -top-12 -left-12 w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-20"
        style={{ backgroundColor: categoryColor }}
      />

      <div>
        {/* Category & Status Bar */}
        <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span 
              className="px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md"
              style={{
                backgroundColor: `${categoryColor}18`,
                borderColor: `${categoryColor}40`,
                color: categoryColor,
              }}
            >
              {categoryName || category?.nameEn || 'Media'}
            </span>

            {/* Quota Type Badge */}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-neutral-300 border border-white/10">
              {task.quotaType === 'daily' && t.daily}
              {task.quotaType === 'once' && t.once}
              {task.quotaType === 'unlimited' && t.unlimited}
              {task.quotaType === 'exact_target' && `${t.exactTarget}: ${targetQuota}`}
              {task.quotaType === 'minimum_quota' && `Min: ${targetQuota}`}
            </span>

            {/* Estimated Duration */}
            {task.estimatedDuration && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-neutral-400 border border-white/[0.08] flex items-center gap-1">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>{task.estimatedDuration}</span>
              </span>
            )}
          </div>

          {/* Reward Points */}
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-black">
            <Award className="w-3.5 h-3.5" />
            <span>+{task.points} {t.points}</span>
          </div>
        </div>

        {/* Task Title */}
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
          {task.title}
        </h3>

        {/* Task Description */}
        <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed line-clamp-3">
          {task.description}
        </p>

        {/* Live Countdown Timer if deadline set */}
        {timeLeftStr && (
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold ${
            isExpired 
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' 
              : 'bg-[#0A84FF]/10 border border-[#0A84FF]/25 text-[#0A84FF]'
          }`}>
            <Timer className="w-3.5 h-3.5" />
            <span>{isExpired ? t.expired : `${t.remainingTime}: ${timeLeftStr}`}</span>
          </div>
        )}

        {/* External Resource Link */}
        {safeLink && (
          <div className="mt-3">
            <a
              href={safeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white text-xs font-medium transition-all"
            >
              <span>{t.viewTaskLink}</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </a>
          </div>
        )}

        {/* Visual Progress Bar for exact_target or minimum_quota */}
        {(task.quotaType === 'exact_target' || task.quotaType === 'minimum_quota') && (
          <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
              <span>{t.progress}</span>
              <span className="font-bold text-white">{myCompletionsCount} / {targetQuota}</span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, (myCompletionsCount / targetQuota) * 100)}%`,
                  backgroundColor: categoryColor 
                }}
              />
            </div>
          </div>
        )}

        {/* Head-to-Head Mini Competition */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden">
              {topContributors.length > 0 ? (
                topContributors.map((c) => (
                  <div
                    key={c.name}
                    title={`${c.name}: ${c.count}`}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-neutral-900 bg-gradient-to-tr from-[#0A84FF] to-blue-700 text-[10px] font-bold text-white flex items-center justify-center text-center shadow"
                  >
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-neutral-500">0 submissions</div>
              )}
            </div>

            {allTaskSubmissions.length > 0 && (
              <span className="text-[11px] text-neutral-400 font-medium">
                {allTaskSubmissions.length} done
              </span>
            )}
          </div>

          <button
            onClick={() => onOpenCompetition(task)}
            className="text-[11px] font-bold text-[#0A84FF] hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t.taskCompetition}</span>
          </button>
        </div>

      </div>

      {/* Complete Task Button */}
      <div className="mt-5 pt-3.5 border-t border-white/[0.08]">
        {isLocked ? (
          <div className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-neutral-400 text-xs font-bold flex items-center justify-center gap-2">
            {isExpired ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{lockReason}</span>
          </div>
        ) : (
          <button
            onClick={() => onInitiateComplete(task)}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#0A84FF] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#0A84FF]/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{buttonLabel}</span>
          </button>
        )}
      </div>

    </div>
  );
};
