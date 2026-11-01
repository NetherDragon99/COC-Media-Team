import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Submission, LeaderboardMember } from './types.ts';
import {
  API_URL,
  DEFAULT_TASKS,
  DEFAULT_SUBMISSIONS,
  STORAGE_KEYS,
} from './constants.ts';
import { Header } from './components/Header.tsx';
import { TaskCard } from './components/TaskCard.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
import { GeminiChatbot } from './components/GeminiChatbot.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AddTaskModal } from './components/AddTaskModal.tsx';
import { ConfettiEffect } from './components/ConfettiEffect.tsx';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  Sparkles,
  Trophy,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Award,
  Radio,
  Layers
} from 'lucide-react';

export default function App() {
  // Member authentication state
  const [currentMember, setCurrentMember] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'tasks' | 'leaderboard' | 'chat'>('tasks');

  // CMS Tasks & Submissions
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [completedTaskNames, setCompletedTaskNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');

  // Modals & Celebrations
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ show: boolean; points: number; title: string }>({
    show: false,
    points: 0,
    title: '',
  });

  // Load persistent user profile & completed tasks from localStorage on initial mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(STORAGE_KEYS.MEMBER_NAME);
      if (savedName) {
        setCurrentMember(savedName);
      } else {
        setIsFirstVisit(true);
        setIsAuthModalOpen(true);
      }

      const savedCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS);
      if (savedCompleted) {
        setCompletedTaskNames(new Set(JSON.parse(savedCompleted)));
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
  }, []);

  // Save member name persistently
  const handleSaveMemberName = (name: string) => {
    setCurrentMember(name);
    setIsFirstVisit(false);
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBER_NAME, name);
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }
  };

  // Fetch CMS data using Vanilla JavaScript fetch()
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    setApiError(null);

    try {
      // Vanilla JavaScript fetch to Google Apps Script Web App
      const res = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('CMS data received:', data);

      // Extract tasks array
      let fetchedTasks: Task[] = [];
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        fetchedTasks = data.tasks;
      } else {
        // Fallback to default production tasks if sheet has not added rows yet
        // Check if user has saved custom tasks locally
        const localTasksRaw = localStorage.getItem(STORAGE_KEYS.LOCAL_TASKS);
        const localTasks = localTasksRaw ? JSON.parse(localTasksRaw) : [];
        fetchedTasks = localTasks.length > 0 ? localTasks : DEFAULT_TASKS;
      }
      setTasks(fetchedTasks);

      // Extract submissions array
      let fetchedSubmissions: Submission[] = [];
      if (Array.isArray(data.submissions) && data.submissions.length > 0) {
        fetchedSubmissions = data.submissions;
      } else {
        // Fallback demo submissions to populate the leaderboard
        const localSubRaw = localStorage.getItem(STORAGE_KEYS.LOCAL_SUBMISSIONS);
        const localSub = localSubRaw ? JSON.parse(localSubRaw) : [];
        fetchedSubmissions = [...DEFAULT_SUBMISSIONS, ...localSub];
      }
      setSubmissions(fetchedSubmissions);
    } catch (err: unknown) {
      console.warn('API fetch warning, loading cached/default CMS data:', err);
      setApiError('Notice: Synchronized with local CMS cache.');
      
      // Load local tasks or defaults
      const localTasksRaw = localStorage.getItem(STORAGE_KEYS.LOCAL_TASKS);
      setTasks(localTasksRaw ? JSON.parse(localTasksRaw) : DEFAULT_TASKS);

      const localSubRaw = localStorage.getItem(STORAGE_KEYS.LOCAL_SUBMISSIONS);
      const localSub = localSubRaw ? JSON.parse(localSubRaw) : [];
      setSubmissions([...DEFAULT_SUBMISSIONS, ...localSub]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Complete Task with POST request
  const handleCompleteTask = async (task: Task) => {
    const memberName = currentMember.trim() || 'Anonymous Crew';
    const payload = {
      memberName,
      taskName: task.taskName,
      points: task.points,
    };

    console.log('Submitting task completion POST:', payload);

    // 1. Optimistic local UI updates
    const nextCompleted = new Set(completedTaskNames);
    nextCompleted.add(task.taskName);
    setCompletedTaskNames(nextCompleted);

    // Save completed task IDs in localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, JSON.stringify(Array.from(nextCompleted)));
    } catch (e) {
      console.warn('Error updating completed tasks in localStorage:', e);
    }

    // Add new submission locally
    const newSubmission: Submission = {
      memberName,
      taskName: task.taskName,
      points: task.points,
      timestamp: new Date().toISOString(),
    };

    setSubmissions((prev) => {
      const updated = [newSubmission, ...prev];
      try {
        const localSubRaw = localStorage.getItem(STORAGE_KEYS.LOCAL_SUBMISSIONS);
        const currentLocals = localSubRaw ? JSON.parse(localSubRaw) : [];
        localStorage.setItem(STORAGE_KEYS.LOCAL_SUBMISSIONS, JSON.stringify([newSubmission, ...currentLocals]));
      } catch {}
      return updated;
    });

    // Show celebration confetti
    setCelebration({
      show: true,
      points: task.points,
      title: task.taskName,
    });

    // 2. Send POST request to Google Apps Script Web App API using Vanilla JavaScript fetch()
    try {
      // In browser, Google Apps Script web app POST requires text/plain and mode: 'no-cors' to avoid CORS preflight rejection
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      console.log('Task POST request successfully dispatched to Google Apps Script.');
    } catch (postError) {
      console.error('Error sending POST to Apps Script endpoint:', postError);
    }
  };

  // Handle adding new task locally and into CMS state
  const handleAddTask = (newTask: Task) => {
    setTasks((prev) => {
      const updated = [newTask, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.LOCAL_TASKS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Calculate Leaderboard rankings by aggregating submissions
  const leaderboardMembers: LeaderboardMember[] = useMemo(() => {
    const scoresMap = new Map<string, { points: number; count: number }>();

    submissions.forEach((sub) => {
      const name = (sub.memberName || 'Unknown').trim();
      if (!name) return;
      const pts = Number(sub.points) || 0;
      const current = scoresMap.get(name) || { points: 0, count: 0 };
      scoresMap.set(name, {
        points: current.points + pts,
        count: current.count + 1,
      });
    });

    // Ensure current member is represented if logged in
    if (currentMember && !scoresMap.has(currentMember)) {
      scoresMap.set(currentMember, { points: 0, count: 0 });
    }

    const sorted = Array.from(scoresMap.entries())
      .map(([name, data]) => ({
        name,
        points: data.points,
        submissionsCount: data.count,
        isCurrentUser: currentMember.toLowerCase() === name.toLowerCase(),
      }))
      .sort((a, b) => b.points - a.points);

    return sorted.map((member, index) => {
      let badge = undefined;
      if (index === 0) badge = '🥇';
      if (index === 1) badge = '🥈';
      if (index === 2) badge = '🥉';

      return {
        rank: index + 1,
        ...member,
        badge,
      };
    });
  }, [submissions, currentMember]);

  // Current user's stats
  const currentUserStats = useMemo(() => {
    const found = leaderboardMembers.find((m) => m.isCurrentUser);
    return {
      points: found ? found.points : 0,
      completedCount: completedTaskNames.size,
      rank: found ? found.rank : leaderboardMembers.length + 1,
    };
  }, [leaderboardMembers, completedTaskNames]);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set)];
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Category filter
      if (selectedCategory !== 'All' && t.category !== selectedCategory) {
        return false;
      }
      // Status filter
      const isDone = completedTaskNames.has(t.taskName);
      if (filterTab === 'pending' && isDone) return false;
      if (filterTab === 'completed' && !isDone) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = t.taskName.toLowerCase().includes(query);
        const matchDesc = (t.description || '').toLowerCase().includes(query);
        const matchCat = (t.category || '').toLowerCase().includes(query);
        return matchTitle || matchDesc || matchCat;
      }

      return true;
    });
  }, [tasks, selectedCategory, filterTab, searchQuery, completedTaskNames]);

  return (
    <div className="min-h-screen bg-[#080a0f] text-neutral-100 flex flex-col relative selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Background ambient lighting orbs (Apple design language) */}
      <div className="ambient-glow -top-40 -left-40 w-[550px] h-[550px] bg-indigo-600/20" />
      <div className="ambient-glow top-1/3 -right-40 w-[600px] h-[600px] bg-purple-600/15" />
      <div className="ambient-glow -bottom-40 left-1/4 w-[500px] h-[500px] bg-blue-600/15" />

      {/* Main Header */}
      <Header
        currentMember={currentMember}
        userPoints={currentUserStats.points}
        completedCount={currentUserStats.completedCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNameModal={() => setIsAuthModalOpen(true)}
        onRefreshData={() => fetchData()}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Personalized Welcome & Status Banner */}
        <section className="mb-8">
          <div className="relative rounded-3xl glass-panel p-6 sm:p-8 overflow-hidden border border-white/10">
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  <Flame className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sunday Production Broadcast Hub</span>
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome back, {currentMember || 'Media Operator'} 🎬
                </h2>

                <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
                  Ready to serve? Complete your production assignments, synchronize livestreams with the Google Sheet CMS, and level up your crew standing.
                </p>
              </div>

              {/* User Standing Stats Cards */}
              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
                
                <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                  <div className="text-xs text-neutral-400 font-medium">Your Score</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">
                    {currentUserStats.points}
                  </div>
                  <div className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">Points</div>
                </div>

                <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                  <div className="text-xs text-neutral-400 font-medium">Rank</div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-300 mt-0.5">
                    #{currentUserStats.rank}
                  </div>
                  <div className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-wider">Overall</div>
                </div>

                <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
                  <div className="text-xs text-neutral-400 font-medium">Completed</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
                    {currentUserStats.completedCount}
                  </div>
                  <div className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider">Tasks</div>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* Tab 1: Tasks Grid */}
        {activeTab === 'tasks' && (
          <section className="space-y-6 animate-in fade-in duration-300">
            
            {/* Control Bar: Filters, Search, Add Task */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-64">
                  <input
                    type="text"
                    placeholder="Search media tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 pl-9 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
                </div>

                {/* Filter Status (All / Available / Done) */}
                <div className="flex items-center p-0.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === 'all' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterTab('pending')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === 'pending' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Available
                  </button>
                  <button
                    onClick={() => setFilterTab('completed')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      filterTab === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Completed
                  </button>
                </div>

                {/* Propose / Add Task Button */}
                <button
                  onClick={() => setIsAddTaskOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold transition-all flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
              </div>

            </div>

            {/* Task Cards Grid */}
            {isLoading ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
                <p className="text-sm text-neutral-400 font-medium">Fetching dynamic tasks from Google Apps Script CMS...</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTasks.map((task, idx) => (
                  <TaskCard
                    key={task.id || `${task.taskName}-${idx}`}
                    task={task}
                    isCompleted={completedTaskNames.has(task.taskName)}
                    onComplete={handleCompleteTask}
                    memberName={currentMember}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl glass-panel p-12 text-center max-w-md mx-auto">
                <Layers className="w-10 h-10 mx-auto text-neutral-500 mb-3" />
                <h3 className="text-base font-bold text-white">No tasks matching your filter</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-4">
                  Try adjusting the category or search query, or add a new task to the board.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                    setFilterTab('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-white transition-all"
                >
                  Reset Filters
                </button>
              </div>
            )}

          </section>
        )}

        {/* Tab 2: Leaderboard */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            members={leaderboardMembers}
            currentMember={currentMember}
          />
        )}

        {/* Tab 3: Gemini AI Assistant */}
        {activeTab === 'chat' && (
          <section className="animate-in fade-in duration-300">
            <GeminiChatbot currentMember={currentMember} />
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-white/[0.08] backdrop-blur-md bg-[#080a0f]/60 text-xs text-neutral-500 text-center relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-400">COC Media Team</span>
            <span>•</span>
            <span>Dynamic CMS &amp; Gamification Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Google Apps Script Connected</span>
            <span>•</span>
            <span>Powered by Gemini 3.8 / 4 Argon</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        currentName={currentMember}
        onSaveName={handleSaveMemberName}
        onClose={() => setIsAuthModalOpen(false)}
        isFirstVisit={isFirstVisit}
      />

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAddTask={handleAddTask}
      />

      <ConfettiEffect
        show={celebration.show}
        pointsEarned={celebration.points}
        taskTitle={celebration.title}
        onDismiss={() => setCelebration((prev) => ({ ...prev, show: false }))}
      />

    </div>
  );
}
