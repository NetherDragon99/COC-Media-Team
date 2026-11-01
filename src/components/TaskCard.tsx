import React, { useState } from 'react';
import { Task } from '../types.ts';
import { ExternalLink, CheckCircle2, Award, Sparkles, Loader2, Video, Mic, Radio, Sun, Image, Share2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isCompleted: boolean;
  onComplete: (task: Task) => Promise<void>;
  memberName: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isCompleted,
  onComplete,
  memberName,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCompleteClick = async () => {
    if (isCompleted || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onComplete(task);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryTheme = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('video')) {
      return {
        icon: <Video className="w-3.5 h-3.5 text-indigo-400" />,
        badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        glow: 'from-indigo-500/10 to-transparent',
      };
    }
    if (lower.includes('audio') || lower.includes('sound')) {
      return {
        icon: <Mic className="w-3.5 h-3.5 text-amber-400" />,
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        glow: 'from-amber-500/10 to-transparent',
      };
    }
    if (lower.includes('broadcast') || lower.includes('stream')) {
      return {
        icon: <Radio className="w-3.5 h-3.5 text-sky-400" />,
        badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        glow: 'from-sky-500/10 to-transparent',
      };
    }
    if (lower.includes('light')) {
      return {
        icon: <Sun className="w-3.5 h-3.5 text-yellow-400" />,
        badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        glow: 'from-yellow-500/10 to-transparent',
      };
    }
    if (lower.includes('graphic') || lower.includes('thumb')) {
      return {
        icon: <Image className="w-3.5 h-3.5 text-pink-400" />,
        badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
        glow: 'from-pink-500/10 to-transparent',
      };
    }
    if (lower.includes('social')) {
      return {
        icon: <Share2 className="w-3.5 h-3.5 text-emerald-400" />,
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        glow: 'from-emerald-500/10 to-transparent',
      };
    }
    return {
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
      badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      glow: 'from-purple-500/10 to-transparent',
    };
  };

  const theme = getCategoryTheme(task.category);

  // Normalize link URL
  let safeLink = task.taskLink || '#';
  if (safeLink !== '#' && !safeLink.startsWith('http://') && !safeLink.startsWith('https://')) {
    safeLink = `https://${safeLink}`;
  }

  return (
    <div className={`relative group rounded-3xl glass-panel p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 ${
      isCompleted 
        ? 'border-emerald-500/40 bg-emerald-950/15' 
        : 'glass-card-hover'
    }`}>
      {/* Subtle background glow */}
      <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${theme.glow} rounded-full blur-2xl pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity`} />

      <div>
        {/* Header: Category Badge & Points */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${theme.badge} shadow-sm backdrop-blur-md`}>
            {theme.icon}
            <span>{task.category || 'General Media'}</span>
          </span>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold tracking-wide">
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span>+{task.points} pts</span>
          </div>
        </div>

        {/* Task Title */}
        <h3 className="text-lg font-bold text-white tracking-tight leading-snug group-hover:text-indigo-200 transition-colors">
          {task.taskName}
        </h3>

        {/* Task Description */}
        <p className="text-sm text-neutral-400 mt-2.5 leading-relaxed line-clamp-3">
          {task.description || 'Complete this task to support COC Media Team broadcast and earn points.'}
        </p>
      </div>

      {/* Card Actions: TaskLink & Complete Task */}
      <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between gap-3">
        {/* Clickable URL button (TaskLink) */}
        {task.taskLink ? (
          <a
            href={safeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white text-xs font-semibold transition-all group/link"
            title="Open Task Resources"
          >
            <span>Resource</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover/link:text-indigo-400 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
          </a>
        ) : (
          <div />
        )}

        {/* Complete Task button */}
        {isCompleted ? (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Completed</span>
          </div>
        ) : (
          <button
            onClick={handleCompleteClick}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Recording...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete Task</span>
              </>
            )}
          </button>
        )}
      </div>

    </div>
  );
};
