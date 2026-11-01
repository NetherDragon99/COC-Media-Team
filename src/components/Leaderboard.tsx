import React from 'react';
import { LeaderboardMember } from '../types.ts';
import { Trophy, Medal, Crown, Star, Flame, Award, TrendingUp, Sparkles } from 'lucide-react';

interface LeaderboardProps {
  members: LeaderboardMember[];
  currentMember: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ members, currentMember }) => {
  const topThree = members.slice(0, 3);
  const remainingMembers = members.slice(3);

  const totalPointsAwarded = members.reduce((sum, m) => sum + m.points, 0);
  const totalMissionsCompleted = members.reduce((sum, m) => sum + m.submissionsCount, 0);
  const maxPoints = members.length > 0 ? members[0].points : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Summary Banner */}
      <div className="relative rounded-3xl glass-panel p-6 sm:p-8 overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-3">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>COC Media Hall of Fame</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Team Gamification Leaderboard
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Rankings aggregated live from all completed media submissions. Complete Sunday tasks to earn points and claim the top podium!
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-initial px-5 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
              <div className="text-xl sm:text-2xl font-black text-amber-300">
                {totalPointsAwarded.toLocaleString()}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mt-0.5">
                Total Points
              </div>
            </div>

            <div className="flex-1 md:flex-initial px-5 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
              <div className="text-xl sm:text-2xl font-black text-indigo-300">
                {totalMissionsCompleted}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mt-0.5">
                Submissions
              </div>
            </div>

            <div className="flex-1 md:flex-initial px-5 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
              <div className="text-xl sm:text-2xl font-black text-emerald-300">
                {members.length}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mt-0.5">
                Crew Members
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Spotlight */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 pt-4">
          
          {/* 2nd Place (Silver) */}
          {topThree[1] && (
            <div className={`relative rounded-3xl glass-panel p-6 flex flex-col justify-between border-slate-400/30 bg-slate-900/40 order-2 md:order-1 transition-all hover:border-slate-300/50 ${
              topThree[1].isCurrentUser ? 'ring-2 ring-indigo-500' : ''
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl" title="2nd Place">🥈</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-400/10 text-slate-300 border border-slate-400/30">
                  Rank #2
                </span>
              </div>

              <div className="text-center my-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-slate-300 to-slate-500 p-0.5 shadow-lg shadow-slate-500/20 mb-3 flex items-center justify-center font-bold text-lg text-black">
                  {topThree[1].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-lg font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[1].name}</span>
                  {topThree[1].isCurrentUser && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      You
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {topThree[1].submissionsCount} completed tasks
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-2xl font-black text-slate-200">
                  {topThree[1].points.toLocaleString()} <span className="text-xs font-semibold text-neutral-400">pts</span>
                </div>
              </div>
            </div>
          )}

          {/* 1st Place (Gold Champion) */}
          {topThree[0] && (
            <div className={`relative rounded-3xl glass-panel-elevated p-6 sm:p-7 flex flex-col justify-between border-amber-400/40 bg-gradient-to-b from-amber-500/10 via-neutral-900/60 to-neutral-950/80 order-1 md:order-2 shadow-2xl shadow-amber-500/10 scale-100 md:-translate-y-2 ${
              topThree[0].isCurrentUser ? 'ring-2 ring-indigo-500' : ''
            }`}>
              {/* Crown Floating Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-extrabold shadow-lg shadow-amber-500/30">
                <Crown className="w-3.5 h-3.5" />
                <span>CHAMPION</span>
              </div>

              <div className="flex items-center justify-between mb-4 mt-1">
                <span className="text-3xl" title="1st Place Champion">🥇</span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Rank #1
                </span>
              </div>

              <div className="text-center my-3">
                <div className="relative w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/30 mb-3 flex items-center justify-center font-extrabold text-2xl text-black">
                  {topThree[0].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-xl font-extrabold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[0].name}</span>
                  {topThree[0].isCurrentUser && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      You
                    </span>
                  )}
                </h3>
                <p className="text-xs text-amber-300/80 font-medium mt-0.5 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{topThree[0].submissionsCount} completed tasks</span>
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-3xl font-black text-amber-300 tracking-tight">
                  {topThree[0].points.toLocaleString()} <span className="text-sm font-semibold text-neutral-400">pts</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {topThree[2] && (
            <div className={`relative rounded-3xl glass-panel p-6 flex flex-col justify-between border-amber-700/30 bg-slate-900/40 order-3 md:order-3 transition-all hover:border-amber-700/50 ${
              topThree[2].isCurrentUser ? 'ring-2 ring-indigo-500' : ''
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl" title="3rd Place">🥉</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-700/10 text-amber-400 border border-amber-700/30">
                  Rank #3
                </span>
              </div>

              <div className="text-center my-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-900 p-0.5 shadow-lg shadow-amber-900/20 mb-3 flex items-center justify-center font-bold text-lg text-white">
                  {topThree[2].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-lg font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{topThree[2].name}</span>
                  {topThree[2].isCurrentUser && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      You
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {topThree[2].submissionsCount} completed tasks
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-center">
                <div className="text-2xl font-black text-amber-400">
                  {topThree[2].points.toLocaleString()} <span className="text-xs font-semibold text-neutral-400">pts</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Full Leaderboard Table / Cards */}
      <div className="rounded-3xl glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-neutral-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              All Media Crew Members ({members.length})
            </h3>
          </div>
          <span className="text-xs text-neutral-400">
            Sorted by Total Points
          </span>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {members.map((member) => {
            const percentage = Math.min(100, Math.round((member.points / (maxPoints || 1)) * 100));
            return (
              <div
                key={member.name}
                className={`px-6 py-4.5 flex items-center justify-between gap-4 transition-colors ${
                  member.isCurrentUser
                    ? 'bg-indigo-600/[0.12] hover:bg-indigo-600/[0.16]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                {/* Rank & User Info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-8 flex-shrink-0 text-center font-bold text-sm">
                    {member.rank === 1 && <span className="text-xl">🥇</span>}
                    {member.rank === 2 && <span className="text-xl">🥈</span>}
                    {member.rank === 3 && <span className="text-xl">🥉</span>}
                    {member.rank > 3 && (
                      <span className="text-neutral-500 font-mono text-xs">#{member.rank}</span>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-xs text-neutral-200 flex-shrink-0">
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {member.name}
                      </span>
                      {member.isCurrentUser && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {member.submissionsCount} tasks submitted
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Points */}
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
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                      {member.points.toLocaleString()}
                      <span className="text-xs font-normal text-neutral-400 ml-1">pts</span>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}

          {members.length === 0 && (
            <div className="py-12 text-center text-neutral-400 text-sm">
              No submissions recorded yet. Complete a task to take the lead!
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
