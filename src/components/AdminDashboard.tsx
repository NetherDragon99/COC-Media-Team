import React, { useState } from 'react';
import { 
  Task, 
  Category, 
  UserProfile, 
  AttendanceSession, 
  AttendanceLog, 
  TaskSubmission, 
  AppSettings, 
  Language, 
  QuotaType, 
  DeadlineType 
} from '../types.ts';
import { translations } from '../i18n.ts';
import { 
  Shield, 
  ListChecks, 
  Layers, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Lock, 
  Check, 
  Upload, 
  Search, 
  Award, 
  Send,
  MessageSquare,
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface AdminDashboardProps {
  settings: AppSettings;
  tasks: Task[];
  categories: Category[];
  users: UserProfile[];
  sessions: AttendanceSession[];
  logs: AttendanceLog[];
  submissions: TaskSubmission[];
  language: Language;
  onSaveTask: (task: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSaveCategory: (category: Partial<Category>) => Promise<void>;
  onDeleteCategory: (catId: string) => Promise<void>;
  onAdjustUserPoints: (userId: string, pointsDelta: number, reason: string) => Promise<void>;
  onSendNotification: (targetUserId: string, title: string, body: string, type: 'task' | 'attendance' | 'points' | 'announcement') => Promise<void>;
  onSaveAttendanceSession: (session: Partial<AttendanceSession>) => Promise<void>;
  onDeleteAttendanceSession: (sessionId: string) => Promise<void>;
  onDeleteSubmission: (submission: TaskSubmission) => Promise<void>;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onLockAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  settings,
  tasks,
  categories,
  users,
  sessions,
  logs,
  submissions,
  language,
  onSaveTask,
  onDeleteTask,
  onSaveCategory,
  onDeleteCategory,
  onAdjustUserPoints,
  onSendNotification,
  onSaveAttendanceSession,
  onDeleteAttendanceSession,
  onDeleteSubmission,
  onSaveSettings,
  onLockAdmin,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'tasks' | 'categories' | 'members' | 'attendance' | 'submissions' | 'settings'>('tasks');

  // Task Form State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCatId, setTaskCatId] = useState(categories[0]?.id || '');
  const [taskPoints, setTaskPoints] = useState(50);
  const [taskLink, setTaskLink] = useState('');
  const [taskDuration, setTaskDuration] = useState('30 mins');
  const [taskQuotaType, setTaskQuotaType] = useState<QuotaType>('daily');
  const [taskTargetQuota, setTaskTargetQuota] = useState(1);
  const [taskDeadlineType, setTaskDeadlineType] = useState<DeadlineType>('none');
  const [taskDeadlineValue, setTaskDeadlineValue] = useState('24');
  const [taskEnableComment, setTaskEnableComment] = useState(true);
  const [taskCommentRequired, setTaskCommentRequired] = useState(false);
  const [taskEnableQuestion, setTaskEnableQuestion] = useState(false);
  const [taskQuestionPrompt, setTaskQuestionPrompt] = useState('');
  const [taskQuestionRequired, setTaskQuestionRequired] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);

  // Category Form State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameAr, setCatNameAr] = useState('');
  const [catColor, setCatColor] = useState('#0A84FF');
  const [isCatSaving, setIsCatSaving] = useState(false);

  // Member Points & Message State
  const [selectedUserForPoints, setSelectedUserForPoints] = useState<string>(users[0]?.uid || '');
  const [pointsDelta, setPointsDelta] = useState(25);
  const [pointsReason, setPointsReason] = useState('Service excellence bonus');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [directMsgUser, setDirectMsgUser] = useState<string>('all');
  const [directMsgTitle, setDirectMsgTitle] = useState('');
  const [directMsgBody, setDirectMsgBody] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Attendance Session Form State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('Sunday Morning Service');
  const [sessionStart, setSessionStart] = useState('09:00');
  const [sessionWindowEnd, setSessionWindowEnd] = useState('11:00');
  const [sessionGrace, setSessionGrace] = useState(10);
  const [sessionRate, setSessionRate] = useState(2);
  const [sessionUnit, setSessionUnit] = useState(5);
  const [sessionMaxCap, setSessionMaxCap] = useState(50);
  const [isSessionSaving, setIsSessionSaving] = useState(false);

  // Submissions Search
  const [subSearch, setSubSearch] = useState('');

  // Site Settings Form State
  const [siteSettings, setSiteSettings] = useState<AppSettings>({ ...settings });
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Reset Task Form
  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskCatId(categories[0]?.id || '');
    setTaskPoints(50);
    setTaskLink('');
    setTaskDuration('30 mins');
    setTaskQuotaType('daily');
    setTaskTargetQuota(1);
    setTaskDeadlineType('none');
    setTaskDeadlineValue('24');
    setTaskEnableComment(true);
    setTaskCommentRequired(false);
    setTaskEnableQuestion(false);
    setTaskQuestionPrompt('');
    setTaskQuestionRequired(false);
  };

  const handleEditTask = (t: Task) => {
    setEditingTaskId(t.id);
    setTaskTitle(t.title);
    setTaskDesc(t.description);
    setTaskCatId(t.categoryId);
    setTaskPoints(t.points);
    setTaskLink(t.taskLink || '');
    setTaskDuration(t.estimatedDuration || '30 mins');
    setTaskQuotaType(t.quotaType);
    setTaskTargetQuota(t.targetQuota || 1);
    setTaskDeadlineType(t.deadlineType);
    setTaskDeadlineValue(t.deadlineValue || '24');
    setTaskEnableComment(Boolean(t.enableComment));
    setTaskCommentRequired(Boolean(t.isCommentRequired));
    setTaskEnableQuestion(Boolean(t.enableQuestion));
    setTaskQuestionPrompt(t.questionPrompt || '');
    setTaskQuestionRequired(Boolean(t.isQuestionRequired));
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setIsTaskSaving(true);
    try {
      let deadlineTimestamp: number | undefined = undefined;
      if (taskDeadlineType === 'duration_hours') {
        deadlineTimestamp = Date.now() + parseInt(taskDeadlineValue || '24', 10) * 60 * 60 * 1000;
      } else if (taskDeadlineType === 'duration_days') {
        deadlineTimestamp = Date.now() + parseInt(taskDeadlineValue || '1', 10) * 24 * 60 * 60 * 1000;
      } else if (taskDeadlineType === 'exact_datetime') {
        deadlineTimestamp = new Date(taskDeadlineValue).getTime();
      }

      await onSaveTask({
        id: editingTaskId || `task_${Date.now()}`,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        categoryId: taskCatId,
        points: Number(taskPoints) || 50,
        taskLink: taskLink.trim(),
        estimatedDuration: taskDuration.trim(),
        quotaType: taskQuotaType,
        targetQuota: Number(taskTargetQuota) || 1,
        deadlineType: taskDeadlineType,
        deadlineValue: taskDeadlineValue,
        deadlineTimestamp,
        enableComment: taskEnableComment,
        isCommentRequired: taskCommentRequired,
        enableQuestion: taskEnableQuestion,
        questionPrompt: taskQuestionPrompt.trim(),
        isQuestionRequired: taskQuestionRequired,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      resetTaskForm();
    } finally {
      setIsTaskSaving(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameEn.trim()) return;
    setIsCatSaving(true);
    try {
      await onSaveCategory({
        id: editingCatId || `cat_${Date.now()}`,
        nameEn: catNameEn.trim(),
        nameAr: catNameAr.trim() || catNameEn.trim(),
        color: catColor,
      });
      setEditingCatId(null);
      setCatNameEn('');
      setCatNameAr('');
      setCatColor('#0A84FF');
    } finally {
      setIsCatSaving(false);
    }
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSessionSaving(true);
    try {
      await onSaveAttendanceSession({
        id: editingSessionId || `session_${Date.now()}`,
        title: sessionTitle.trim(),
        scheduledDays: [0, 3], // Sunday & Wednesday
        exactStartTime: sessionStart,
        checkInWindowEnd: sessionWindowEnd,
        gracePeriodMinutes: Number(sessionGrace) || 10,
        penaltyRatePerUnit: Number(sessionRate) || 2,
        penaltyUnitMinutes: Number(sessionUnit) || 5,
        minPenalty: 5,
        maxPenaltyCap: Number(sessionMaxCap) || 50,
        isActive: true,
      });
      setEditingSessionId(null);
      setSessionTitle('');
    } finally {
      setIsSessionSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSiteSettings((prev) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      
      {/* Top Header & Logout */}
      <div className="rounded-3xl glass-panel-elevated p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0A84FF] to-blue-700 flex items-center justify-center text-white shadow-lg shadow-[#0A84FF]/25">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Admin Master Dashboard</h2>
            <p className="text-xs text-neutral-400">Production Control Panel • Tasks, Quotas, Attendance &amp; Members</p>
          </div>
        </div>

        <button
          onClick={onLockAdmin}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all"
        >
          <Lock className="w-4 h-4" />
          <span>{t.lockAdmin}</span>
        </button>
      </div>

      {/* 6 Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#000000]/70 border border-white/10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'tasks' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>{t.adminTasks} ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'categories' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t.adminCategories} ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'members' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t.adminMembers} ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'attendance' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t.adminAttendance} ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'submissions' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.adminSubmissions} ({submissions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'bg-[#0A84FF] text-white shadow' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{t.adminSettings}</span>
        </button>
      </div>

      {/* TAB 1: TASKS MANAGER */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#0A84FF]" />
              <span>{editingTaskId ? 'Edit Task' : 'Create New Task'}</span>
            </h3>

            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Sunday Livestream Camera 1 Switcher"
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Category *</label>
                  <select
                    value={taskCatId}
                    onChange={(e) => setTaskCatId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#12141C] border border-white/15 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn} ({c.nameAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Description &amp; Instructions</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Explain requirements, deliverables, or gear settings..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Points Reward</label>
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    step="5"
                    value={taskPoints}
                    onChange={(e) => setTaskPoints(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Estimated Duration</label>
                  <input
                    type="text"
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(e.target.value)}
                    placeholder="e.g. 45 mins"
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Completion Frequency</label>
                  <select
                    value={taskQuotaType}
                    onChange={(e) => setTaskQuotaType(e.target.value as QuotaType)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#12141C] border border-white/15 text-white text-xs"
                  >
                    <option value="daily">Daily (Once per day)</option>
                    <option value="once">Once (Permanent)</option>
                    <option value="unlimited">Unlimited (Multiple times)</option>
                    <option value="exact_target">Exact Target Quota</option>
                    <option value="minimum_quota">Minimum Quota</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Target Quota Number</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={taskTargetQuota}
                    onChange={(e) => setTaskTargetQuota(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Deadline Type</label>
                  <select
                    value={taskDeadlineType}
                    onChange={(e) => setTaskDeadlineType(e.target.value as DeadlineType)}
                    className="w-full px-3.5 py-3 rounded-2xl bg-[#12141C] border border-white/15 text-white text-xs"
                  >
                    <option value="none">No Deadline</option>
                    <option value="duration_hours">Hours from now</option>
                    <option value="duration_days">Days from now</option>
                    <option value="exact_datetime">Exact Date &amp; Time</option>
                  </select>
                </div>

                {taskDeadlineType !== 'none' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Deadline Value ({taskDeadlineType === 'duration_hours' ? 'Hours' : taskDeadlineType === 'duration_days' ? 'Days' : 'YYYY-MM-DDTHH:MM'})
                    </label>
                    <input
                      type={taskDeadlineType === 'exact_datetime' ? 'datetime-local' : 'number'}
                      value={taskDeadlineValue}
                      onChange={(e) => setTaskDeadlineValue(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">External Resource Link (Optional)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={taskLink}
                  onChange={(e) => setTaskLink(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-xs sm:text-sm"
                />
              </div>

              {/* Questions & Comments Options */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Require Comment / Proof</span>
                    <span className="text-[11px] text-neutral-400">Members must type notes or paste a link to complete</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={taskCommentRequired}
                    onChange={(e) => setTaskCommentRequired(e.target.checked)}
                    className="w-5 h-5 rounded text-[#0A84FF]"
                  />
                </div>

                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Ask Specific Question</span>
                      <span className="text-[11px] text-neutral-400">Prompts member for an answer before completing</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={taskEnableQuestion}
                      onChange={(e) => {
                        setTaskEnableQuestion(e.target.checked);
                        setTaskQuestionRequired(e.target.checked);
                      }}
                      className="w-5 h-5 rounded text-[#0A84FF]"
                    />
                  </div>

                  {taskEnableQuestion && (
                    <input
                      type="text"
                      placeholder="e.g. What audio gain setting did you set on the pulpit mic?"
                      value={taskQuestionPrompt}
                      onChange={(e) => setTaskQuestionPrompt(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isTaskSaving}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0A84FF] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#0A84FF]/25 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{isTaskSaving ? 'Saving...' : editingTaskId ? 'Update Task' : 'Publish Task'}</span>
                </button>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={resetTaskForm}
                    className="px-4 py-3 rounded-2xl bg-white/[0.06] text-neutral-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Existing Tasks List */}
          <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Active Tasks ({tasks.length})</h4>
              <span className="text-xs text-neutral-400">Stored in Firestore</span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {tasks.map((t) => (
                <div key={t.id} className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{t.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F59E0B]/15 text-[#F59E0B] font-bold">
                        +{t.points} pts
                      </span>
                      <span className="text-[10px] text-neutral-400">({t.quotaType})</span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-1">{t.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEditTask(t)}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete task "${t.title}"?`)) onDeleteTask(t.id);
                      }}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  No tasks created yet. Use the form above to add your first media task.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES MANAGER */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 border border-white/10">
            <h3 className="text-base font-bold text-white mb-4">Add / Edit Category</h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">English Name</label>
                  <input
                    type="text"
                    required
                    value={catNameEn}
                    onChange={(e) => setCatNameEn(e.target.value)}
                    placeholder="e.g. Photography"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Arabic Name</label>
                  <input
                    type="text"
                    value={catNameAr}
                    onChange={(e) => setCatNameAr(e.target.value)}
                    placeholder="e.g. تصوير فوتوغرافي"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className="w-28 px-2.5 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isCatSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#0A84FF] text-white text-xs font-bold"
                >
                  {isCatSaving ? 'Saving...' : editingCatId ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
            <div className="divide-y divide-white/[0.06]">
              {categories.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-bold text-white text-sm">{c.nameEn}</span>
                    <span className="text-xs text-neutral-400">({c.nameAr})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCatId(c.id);
                        setCatNameEn(c.nameEn);
                        setCatNameAr(c.nameAr);
                        setCatColor(c.color);
                      }}
                      className="p-1.5 rounded-lg text-neutral-300 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete category "${c.nameEn}"?`)) onDeleteCategory(c.id);
                      }}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEMBERS & POINTS CONTROLLER */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#F59E0B]" />
              <span>Manual Points Adjustment &amp; Private Alert</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Target Member</label>
                <select
                  value={selectedUserForPoints}
                  onChange={(e) => setSelectedUserForPoints(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-white/15 text-white text-xs"
                >
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Points Delta (+ or -)</label>
                <input
                  type="number"
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Reason Note</label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder="e.g. Sunday Livestream MVP bonus"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isAdjustingPoints || !selectedUserForPoints}
                onClick={async () => {
                  setIsAdjustingPoints(true);
                  try {
                    await onAdjustUserPoints(selectedUserForPoints, pointsDelta, pointsReason);
                    alert(`Successfully applied ${pointsDelta} pts!`);
                  } finally {
                    setIsAdjustingPoints(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#F59E0B] text-black font-bold text-xs"
              >
                {isAdjustingPoints ? 'Applying...' : 'Apply Points Adjustment'}
              </button>
            </div>
          </div>

          {/* Broadcast / Direct Messaging */}
          <div className="rounded-3xl glass-panel p-6 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              <span>Send In-App &amp; Push Notification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Recipient</label>
                <select
                  value={directMsgUser}
                  onChange={(e) => setDirectMsgUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141C] border border-white/15 text-white text-xs"
                >
                  <option value="all">Broadcast to All Members</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Notification Title</label>
                <input
                  type="text"
                  value={directMsgTitle}
                  onChange={(e) => setDirectMsgTitle(e.target.value)}
                  placeholder="e.g. Mandatory Team Briefing"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Notification Body</label>
                <input
                  type="text"
                  value={directMsgBody}
                  onChange={(e) => setDirectMsgBody(e.target.value)}
                  placeholder="e.g. Please be on stage at 08:30 AM"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSendingMsg || !directMsgTitle.trim()}
                onClick={async () => {
                  setIsSendingMsg(true);
                  try {
                    await onSendNotification(directMsgUser, directMsgTitle.trim(), directMsgBody.trim(), 'announcement');
                    setDirectMsgTitle('');
                    setDirectMsgBody('');
                    alert('Notification dispatched!');
                  } finally {
                    setIsSendingMsg(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs"
              >
                {isSendingMsg ? 'Sending...' : 'Dispatch Notification'}
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
            <div className="px-6 py-4 border-b border-white/10">
              <h4 className="text-sm font-bold text-white">Registered Team Members ({users.length})</h4>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {users.map((u) => (
                <div key={u.uid} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-800 flex items-center justify-center font-bold text-xs text-white">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                      ) : (
                        u.displayName?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{u.displayName}</div>
                      <div className="text-xs text-neutral-400 font-mono">{u.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-amber-300 text-sm">{u.points || 0} pts</span>
                    <span className="text-neutral-500 text-xs ml-2">({u.role})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE SESSIONS */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 border border-white/10">
            <h3 className="text-base font-bold text-white mb-4">Create / Edit Attendance Session</h3>
            <form onSubmit={handleSessionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Session Title</label>
                  <input
                    type="text"
                    required
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. Sunday 1st Service"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Exact Start Time (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={sessionStart}
                    onChange={(e) => setSessionStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Check-In Window End (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={sessionWindowEnd}
                    onChange={(e) => setSessionWindowEnd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Grace Period (Mins)</label>
                  <input
                    type="number"
                    value={sessionGrace}
                    onChange={(e) => setSessionGrace(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Penalty Rate (pts)</label>
                  <input
                    type="number"
                    value={sessionRate}
                    onChange={(e) => setSessionRate(parseInt(e.target.value, 10) || 2)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Unit (Mins)</label>
                  <input
                    type="number"
                    value={sessionUnit}
                    onChange={(e) => setSessionUnit(parseInt(e.target.value, 10) || 5)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Max Penalty Cap</label>
                  <input
                    type="number"
                    value={sessionMaxCap}
                    onChange={(e) => setSessionMaxCap(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSessionSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  {isSessionSaving ? 'Saving...' : editingSessionId ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>

          {/* Sessions List */}
          <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
            <div className="divide-y divide-white/[0.06]">
              {sessions.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-white text-sm">{s.title}</div>
                    <div className="text-xs text-neutral-400">
                      {s.exactStartTime} - {s.checkInWindowEnd} (Grace: {s.gracePeriodMinutes}m, Rate: -{s.penaltyRatePerUnit} pts/{s.penaltyUnitMinutes}m)
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete session "${s.title}"?`)) onDeleteAttendanceSession(s.id);
                    }}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUBMISSIONS INSPECTOR */}
      {activeTab === 'submissions' && (
        <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h4 className="text-sm font-bold text-white">Submissions &amp; Answers Log ({submissions.length})</h4>
            <input
              type="text"
              placeholder="Search by member or task..."
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs w-full sm:w-64"
            />
          </div>

          <div className="divide-y divide-white/[0.06] max-h-[600px] overflow-y-auto">
            {submissions
              .filter((s) => s.userDisplayName.toLowerCase().includes(subSearch.toLowerCase()) || s.taskTitle.toLowerCase().includes(subSearch.toLowerCase()))
              .map((sub) => (
                <div key={sub.id} className="p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{sub.userDisplayName}</span>
                      <span className="text-neutral-500">•</span>
                      <span className="text-xs font-semibold text-neutral-300">{sub.taskTitle}</span>
                      <span className="text-[10px] text-amber-400 font-bold">+{sub.pointsEarned} pts</span>
                    </div>

                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {sub.completedAt?.slice(0, 16)} • Date: {sub.dateKey}
                      {sub.actualDurationMinutes && ` • Time logged: ${sub.actualDurationMinutes} mins`}
                    </div>

                    {sub.questionAnswer && (
                      <div className="mt-2.5 p-3 rounded-xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 text-xs">
                        <span className="font-bold text-[#0A84FF] block mb-0.5">Question Answer:</span>
                        <p className="text-neutral-200">{sub.questionAnswer}</p>
                      </div>
                    )}

                    {sub.comment && (
                      <div className="mt-1.5 text-xs text-neutral-400 italic">
                        "{sub.comment}"
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Revoke and delete submission from ${sub.userDisplayName}?`)) {
                        onDeleteSubmission(sub);
                      }
                    }}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300"
                    title="Revoke Submission"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 6: SITE & UI SETTINGS */}
      {activeTab === 'settings' && (
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">App Customizer &amp; Settings</h3>
            {settingsSuccess && (
              <span className="text-xs font-bold text-emerald-400">Settings saved successfully!</span>
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSettingsSaving(true);
              setSettingsSuccess(false);
              try {
                await onSaveSettings(siteSettings);
                setSettingsSuccess(true);
                setTimeout(() => setSettingsSuccess(false), 3000);
              } finally {
                setIsSettingsSaving(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">App Name</label>
                <input
                  type="text"
                  value={siteSettings.appName}
                  onChange={(e) => setSiteSettings({ ...siteSettings, appName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">App Version</label>
                <input
                  type="text"
                  value={siteSettings.version}
                  onChange={(e) => setSiteSettings({ ...siteSettings, version: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">English Subtitle</label>
                <input
                  type="text"
                  value={siteSettings.subtitleEn}
                  onChange={(e) => setSiteSettings({ ...siteSettings, subtitleEn: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Arabic Subtitle</label>
                <input
                  type="text"
                  value={siteSettings.subtitleAr}
                  onChange={(e) => setSiteSettings({ ...siteSettings, subtitleAr: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>
            </div>

            {/* Announcement Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Announcement (English)</label>
                <input
                  type="text"
                  value={siteSettings.announcementEn}
                  onChange={(e) => setSiteSettings({ ...siteSettings, announcementEn: e.target.value })}
                  placeholder="Optional top announcement..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Announcement (Arabic)</label>
                <input
                  type="text"
                  value={siteSettings.announcementAr}
                  onChange={(e) => setSiteSettings({ ...siteSettings, announcementAr: e.target.value })}
                  placeholder="إعلان أعلى الشاشة..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>
            </div>

            {/* Logo Customization */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <label className="block text-xs font-bold text-white">Logo URL or Direct Image Upload</label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-900 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <img
                    src={siteSettings.logoUrl || 'image_ad59c0.jpg'}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'image_ad59c0.jpg';
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={siteSettings.logoUrl}
                    onChange={(e) => setSiteSettings({ ...siteSettings, logoUrl: e.target.value })}
                    placeholder="image_ad59c0.jpg or custom URL"
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                  />
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] text-xs font-semibold text-white">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo File (Base64)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSettingsSaving}
                className="px-6 py-3 rounded-2xl bg-[#0A84FF] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#0A84FF]/30"
              >
                {isSettingsSaving ? 'Saving...' : 'Save Site Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
