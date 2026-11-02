import React from 'react';
import { Task, TaskSubmission, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Trophy, Users, X, Award, Clock } from 'lucide-react';

interface TaskCompetitionModalProps {
  isOpen: boolean;
  task: Task | null;
  submissions: TaskSubmission[];
  language: Language;
  onClose: () => void;
  currentUserId: string;
}

export const TaskCompetitionModal: React.FC<TaskCompetitionModalProps> = ({
  isOpen,
  task,
  submissions,
  language,
  onClose,
  currentUserId,
}) => {
  const t = translations[language];
  if (!isOpen || !task) return null;

  // Filter submissions for this specific task
  const taskSubs = submissions.filter((s) => s.taskId === task.id);

  // Group by user
  const userMap = new Map<string, { name: string; photo?: string; count: number; points: number; lastSubmission: TaskSubmission }>();
  taskSubs.forEach((s) => {
    const cur = userMap.get(s.userId) || {
      name: s.userDisplayName,
      photo: s.userPhotoURL,
      count: 0,
      points: 0,
      lastSubmission: s,
    };
    userMap.set(s.userId, {
      name: s.userDisplayName,
      photo: s.userPhotoURL,
      count: cur.count + 1,
      points: cur.points + s.pointsEarned,
      lastSubmission: s,
    });
  });

  const rankedContributors = Array.from(userMap.entries())
    .map(([uid, data]) => ({
      uid,
      ...data,
      isCurrent: uid === currentUserId,
    }))
    .sort((a, b) => b.count - a.count || b.points - a.points);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-xl p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-white/10 flex-shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 mb-2">
              <Trophy className="w-3.5 h-3.5" />
              <span>{t.taskCompetition}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {task.title}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {taskSubs.length} total completions by {rankedContributors.length} members
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {rankedContributors.length > 0 ? (
            rankedContributors.map((c, index) => (
              <div
                key={c.uid}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  c.isCurrent ? 'bg-[#0A84FF]/10 border-[#0A84FF]/35' : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 text-center font-bold text-sm flex-shrink-0">
                    {index === 0 && <span className="text-xl">🥇</span>}
                    {index === 1 && <span className="text-xl">🥈</span>}
                    {index === 2 && <span className="text-xl">🥉</span>}
                    {index > 2 && <span className="text-xs text-neutral-500 font-mono">#{index + 1}</span>}
                  </div>

                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-[#0A84FF] to-blue-700 flex items-center justify-center font-bold text-xs text-white shadow-md flex-shrink-0">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      c.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{c.name}</span>
                      {c.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">
                          {t.you}
                        </span>
                      )}
                    </div>
                    {c.lastSubmission?.comment && (
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1 italic">
                        "{c.lastSubmission.comment}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black text-white">
                    {c.count} <span className="text-xs font-normal text-neutral-400">times</span>
                  </div>
                  <div className="text-xs font-bold text-[#F59E0B]">
                    +{c.points} {t.points}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-neutral-400 text-sm">
              <Users className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
              <p>No completions logged on this task yet.</p>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold transition-all"
          >
            {t.cancel}
          </button>
        </div>

      </div>
    </div>
  );
};
