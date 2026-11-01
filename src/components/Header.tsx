import React from 'react';
import { Sparkles, Trophy, CheckSquare, User, RefreshCw, Radio } from 'lucide-react';

interface HeaderProps {
  currentMember: string;
  userPoints: number;
  completedCount: number;
  activeTab: 'tasks' | 'leaderboard' | 'chat';
  setActiveTab: (tab: 'tasks' | 'leaderboard' | 'chat') => void;
  onOpenNameModal: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMember,
  userPoints,
  completedCount,
  activeTab,
  setActiveTab,
  onOpenNameModal,
  onRefreshData,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-[#090b10]/80 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & App Name - MUST INCLUDE EXACT TAG: <img src="image_ad59c0.jpg" alt="COC Media Team Logo"> */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/15 bg-neutral-900 shadow-xl flex items-center justify-center">
                <img 
                  src="image_ad59c0.jpg" 
                  alt="COC Media Team Logo" 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  COC Media Team
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  CMS Live
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium hidden sm:block">
                Production Task Tracker &amp; Gamification Platform
              </p>
            </div>
          </div>

          {/* Navigation Pill (Apple-style segmented control) */}
          <nav className="flex items-center p-1 rounded-full bg-neutral-900/90 border border-white/10 shadow-inner">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Tasks</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 relative ${
                activeTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>AI Assistant</span>
              <span className="hidden md:inline-flex px-1.5 py-0.2 rounded text-[9px] bg-white/20 font-bold uppercase tracking-wider">
                Thinking
              </span>
            </button>
          </nav>

          {/* User Profile Pill & Refresh */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              title="Refresh CMS Data from Google Sheet"
              className="p-2 sm:p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-400 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={onOpenNameModal}
              className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-500/20">
                {currentMember ? currentMember.slice(0, 2).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-semibold leading-tight group-hover:text-indigo-300 transition-colors">
                  {currentMember || 'Anonymous'}
                </div>
                <div className="text-[10px] text-indigo-400 font-bold">
                  {userPoints} pts • {completedCount} done
                </div>
              </div>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
