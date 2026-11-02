import React, { useState, useMemo } from 'react';
import { UserProfile, TaskSubmission, Task, Category, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Trophy, Crown, Flame, Award, Filter, ShieldAlert } from 'lucide-react';

interface LeaderboardViewProps {
  users: UserProfile[];
  submissions: TaskSubmission[];
  tasks: Task[];
  categories: Category[];
  currentUserId: string;
  language: Language;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  users,
  submissions,
  tasks,
  categories,
  currentUserId,
  language,
}) => {
  const t = translations[language];
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'week' | 'category' | 'task'>('all');
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '');

  const todayKey = new Date().toISOString().split('T')[0];
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Aggregate user points according to filter
  const rankedMembers = useMemo(() => {
    let filteredSubs = submissions;

    if (filterMode === 'today') {
      filteredSubs = submissions.filter((s) => s.dateKey === todayKey);
    } else if (filterMode === 'week') {
      filteredSubs = submissions.filter((s) => s.dateKey >= oneWeekAgo);
    } else if (filterMode === 'category') {
      filteredSubs = submissions.filter((s) => s.categoryId === selectedCatId);
    } else if (filterMode === 'task') {
      filteredSubs = submissions.filter((s) => s.taskId === selectedTaskId);
    }

    // Map points by user
    const userStatsMap = new Map<string, { points: number; count: number; name: string; photo?: string }>();

    if (filterMode === 'all') {
      // In all-time mode, take the live profile points directly
      users.forEach((u) => {
        userStatsMap.set(u.uid, {
          points: u.points || 0,
          count: submissions.filter((s) => s.userId === u.uid).length,
          name: u.displayName || 'Member',
          photo: u.photoURL,
        });
      });
    } else {
      // Aggregated points for filtered submissions
      filteredSubs.forEach((s) => {
        const cur = userStatsMap.get(s.userId) || {
          points: 0,
          count: 0,
          name: s.userDisplayName || 'Member',
          photo: s.userPhotoURL,
        };
        userStatsMap.set(s.userId, {
          points: cur.points + (s.pointsEarned || 0),
          count: cur.count + 1,
          name: s.userDisplayName || cur.name,
          photo: s.userPhotoURL || cur.photo,
        });
      });
    }

    // STRICT ZERO-POINTS EXCLUSION RULE:
    // Any member whose total points are 0 or less MUST NOT appear on the Top 3 Podium or in the active winners leaderboard!
    const activeRanked = Array.from(userStatsMap.entries())
      .filter(([_, data]) => data.points > 0)
      .map(([uid, data]) => ({
        uid,
        displayName: data.name,
        photoURL: data.photo || '',
        points: data.points,
        completionsCount: data.count,
        isCurrentUser: uid === currentUserId,
      }))
      .sort((a, b) => b.points - a.points || b.completionsCount - a.completionsCount);

    return activeRanked.map((m, idx) => ({
      rank: idx + 1,
      ...m,
      badge: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : undefined,
    }));
  }, [users, submissions, filterMode, selectedCatId, selectedTaskId, currentUserId, todayKey, oneWeekAgo]);

  const topThree = rankedMembers.slice(0, 3);
  const remaining = rankedMembers.slice(3);
  const maxScore = rankedMembers.length > 0 ? rankedMembers[0].points : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Leaderboard Header Banner */}
      <div className="relative rounded-3xl glass-panel p-6 sm:p-8 overflow-hidden">
        <div className="absolute -left-10 -top-10 w-64 h-64 bg-[#F59E0B]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#0A84FF]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 mb-2">
              <Trophy className="w-3.5 h-3.5" />
              <span>{t.podiumTitle}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t.leaderboard}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl">
              {t.podiumSub}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto p-1.5 rounded-2xl bg-[#000000]/70 border border-white/10">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'all' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.allTime}
            </button>
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'today' ? 'bg-[#F59E0B] text-black shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.today}
            </button>
            <button
              onClick={() => setFilterMode('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'week' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.thisWeek}
            </button>
            <button
              onClick={() => setFilterMode('category')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'category' ? 'bg-purple-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.byCategory}
            </button>
            <button
              onClick={() => setFilterMode('task')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'task' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.byTask}
            </button>
          </div>
        </div>

        {/* Sub-selector for category or task */}
        {filterMode === 'category' && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs text-neutral-400 flex-shrink-0 font-medium">Select Category:</span>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCatId(c.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCatId === c.id
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-white/10'
                }`}
              >
                {language === 'ar' ? c.nameAr : c.nameEn}
              </button>
            ))}
          </div>
        )}

        {filterMode === 'task' && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
            <span className="text-xs text-neutral-400 flex-shrink-0 font-medium">Select Task:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="bg-[#12141C] border border-white/15 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0A84FF] max-w-sm truncate"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id} className="bg-neutral-900 text-white">
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Top 3 Podium Visual Display (Points > 0 ONLY) */}
      {topThree.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 pt-2">
          
          {/* 2nd Place (Silver) */}
          {topThree[1] && (
            <div className={`relative rounded-3xl glass-panel p-6 flex flex-col justify-between border-slate-400/30 bg-slate-900/30 order-2 md:order-1 transition-all ${
              topThree[1].isCurrentUser ? 'ring-2 ring-[#0A84FF]' : ''
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl" title="2nd Place">🥈</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-400/15 text-slate-300 border border-slate-400/30">
                  Rank #2
                </span>
              </div>

              <div className="text-center my-2">
                <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-300 to-slate-500 p-0.5 shadow-lg shadow-slate-500/20 mb-3 flex items-center justify-center font-bold text-lg text-black">
                  {topThree[1].photoURL ? (
                    <img src={topThree[1].photoURL} alt={topThree[1].displayName} className="w-full h-full object-cover rounded-[14px]" />
                  ) : (
                    topThree[1].displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[1].displayName}</span>
                  {topThree[1].isCurrentUser && (
                    <span className="text-[10px] bg-[#0A84FF]/20 text-[#0A84FF] px-2 py-0.5 rounded-full border border-[#0A84FF]/30">
                      {t.you}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {topThree[1].completionsCount} completions
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-2xl font-black text-slate-200">
                  {topThree[1].points.toLocaleString()} <span className="text-xs font-semibold text-neutral-400">{t.points}</span>
                </div>
              </div>
            </div>
          )}

          {/* 1st Place (Gold Champion) */}
          {topThree[0] && (
            <div className={`relative rounded-3xl glass-panel-elevated p-6 sm:p-7 flex flex-col justify-between border-amber-400/40 bg-gradient-to-b from-amber-500/10 via-neutral-900/70 to-neutral-950/80 order-1 md:order-2 shadow-2xl shadow-amber-500/15 md:-translate-y-2 ${
              topThree[0].isCurrentUser ? 'ring-2 ring-[#0A84FF]' : ''
            }`}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black shadow-lg shadow-amber-500/30">
                <Crown className="w-3.5 h-3.5" />
                <span>{t.champion}</span>
              </div>

              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-4xl" title="Champion">🥇</span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Rank #1
                </span>
              </div>

              <div className="text-center my-2">
                <div className="relative w-20 h-20 mx-auto rounded-3xl overflow-hidden bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/30 mb-3 flex items-center justify-center font-extrabold text-2xl text-black">
                  {topThree[0].photoURL ? (
                    <img src={topThree[0].photoURL} alt={topThree[0].displayName} className="w-full h-full object-cover rounded-[22px]" />
                  ) : (
                    topThree[0].displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[0].displayName}</span>
                  {topThree[0].isCurrentUser && (
                    <span className="text-[10px] bg-[#0A84FF]/20 text-[#0A84FF] px-2 py-0.5 rounded-full border border-[#0A84FF]/30">
                      {t.you}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-amber-300/80 font-medium mt-0.5 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{topThree[0].completionsCount} completions</span>
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-3xl font-black text-amber-300 tracking-tight">
                  {topThree[0].points.toLocaleString()} <span className="text-sm font-semibold text-neutral-400">{t.points}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {topThree[2] && (
            <div className={`relative rounded-3xl glass-panel p-6 flex flex-col justify-between border-amber-700/30 bg-slate-900/30 order-3 md:order-3 transition-all ${
              topThree[2].isCurrentUser ? 'ring-2 ring-[#0A84FF]' : ''
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl" title="3rd Place">🥉</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-700/15 text-amber-400 border border-amber-700/30">
                  Rank #3
                </span>
              </div>

              <div className="text-center my-2">
                <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden bg-gradient-to-tr from-amber-700 to-amber-900 p-0.5 shadow-lg shadow-amber-900/20 mb-3 flex items-center justify-center font-bold text-lg text-white">
                  {topThree[2].photoURL ? (
                    <img src={topThree[2].photoURL} alt={topThree[2].displayName} className="w-full h-full object-cover rounded-[14px]" />
                  ) : (
                    topThree[2].displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[2].displayName}</span>
                  {topThree[2].isCurrentUser && (
                    <span className="text-[10px] bg-[#0A84FF]/20 text-[#0A84FF] px-2 py-0.5 rounded-full border border-[#0A84FF]/30">
                      {t.you}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {topThree[2].completionsCount} completions
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-2xl font-black text-amber-400">
                  {topThree[2].points.toLocaleString()} <span className="text-xs font-semibold text-neutral-400">{t.points}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="rounded-3xl glass-panel p-10 text-center border border-white/10">
          <Trophy className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
          <h4 className="text-base font-bold text-white">{t.noZeroPointsRanking}</h4>
          <p className="text-xs text-neutral-400 mt-1">Complete tasks to earn points and claim a spot on the podium!</p>
        </div>
      )}

      {/* Full Leaderboard Table (Points > 0 ONLY) */}
      {rankedMembers.length > 0 && (
        <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Active Ranking ({rankedMembers.length} members)</h4>
            <span className="text-xs text-neutral-400">Sorted by Points &gt; 0</span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {rankedMembers.map((member) => {
              const percentage = Math.min(100, Math.round((member.points / (maxScore || 1)) * 100));

              return (
                <div
                  key={member.uid}
                  className={`px-6 py-4 flex items-center justify-between gap-4 transition-colors ${
                    member.isCurrentUser ? 'bg-[#0A84FF]/10' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-8 flex-shrink-0 text-center font-bold text-sm">
                      {member.rank === 1 && <span className="text-xl">🥇</span>}
                      {member.rank === 2 && <span className="text-xl">🥈</span>}
                      {member.rank === 3 && <span className="text-xl">🥉</span>}
                      {member.rank > 3 && <span className="text-neutral-500 font-mono text-xs">#{member.rank}</span>}
                    </div>

                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                      {member.photoURL ? (
                        <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                      ) : (
                        member.displayName.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">{member.displayName}</span>
                        {member.isCurrentUser && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">
                            {t.you}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {member.completionsCount} tasks
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block w-36">
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            member.rank === 1
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                              : member.rank === 2
                              ? 'bg-gradient-to-r from-slate-300 to-slate-200'
                              : member.rank === 3
                              ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                              : 'bg-[#0A84FF]'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-sm sm:text-base text-white tracking-tight">
                        {member.points.toLocaleString()}
                        <span className="text-xs font-normal text-neutral-400 ml-1">{t.points}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
