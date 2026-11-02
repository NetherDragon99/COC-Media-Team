import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Task, 
  Category, 
  UserProfile, 
  AttendanceSession, 
  AttendanceLog, 
  TaskSubmission, 
  NotificationItem, 
  AppSettings, 
  Language 
} from './types.ts';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  onAuthStateChanged,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  increment 
} from './firebase.ts';
import { translations, DEFAULT_CATEGORIES } from './i18n.ts';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { Footer } from './components/Footer.tsx';
import { TaskCard } from './components/TaskCard.tsx';
import { SubmitTaskModal } from './components/SubmitTaskModal.tsx';
import { TaskCompetitionModal } from './components/TaskCompetitionModal.tsx';
import { AttendanceView } from './components/AttendanceView.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { NotificationsView } from './components/NotificationsView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AdminPasswordModal } from './components/AdminPasswordModal.tsx';
import { ConfettiEffect } from './components/ConfettiEffect.tsx';
import { Search, Inbox, AlertCircle, Layers, CheckSquare } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'COC Media Team',
  subtitleEn: 'Production Task, Quota & Attendance Platform',
  subtitleAr: 'منصة إدارة المهام، الكوتا ومحرك الحضور لفريق الميديا',
  announcementEn: '',
  announcementAr: '',
  accentColor: '#0A84FF',
  logoUrl: 'image_ad59c0.jpg',
  developerCredit: 'Steven Mario',
  version: 'v1.0.0',
};

export default function App() {
  // Navigation Tabs: 'tasks' | 'attendance' | 'leaderboard' | 'notifications' | 'profile' | 'admin'
  const [activeTab, setActiveTab] = useState<'tasks' | 'attendance' | 'leaderboard' | 'notifications' | 'profile' | 'admin'>('tasks');

  // Language State - DEFAULT ENGLISH per prompt requirement
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return (localStorage.getItem('coc_pwa_lang') as Language) || 'en';
    } catch {
      return 'en';
    }
  });

  const t = translations[language];

  // Document direction & lang synchronization
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('coc_pwa_lang', language);
    } catch {}
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  // User Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Admin Mode Unlock State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('coc_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);

  // Firestore Data Collections
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushPermissionState, setPushPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Search & Category Filter for Tasks
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  // Modals & Celebrations
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);
  const [competitionTask, setCompetitionTask] = useState<Task | null>(null);
  const [celebration, setCelebration] = useState<{ show: boolean; points: number; title: string }>({
    show: false,
    points: 0,
    title: '',
  });

  // Listen for Firebase Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: data.displayName || fbUser.displayName || 'Media Operator',
              photoURL: data.photoURL || fbUser.photoURL || '',
              points: data.points ?? 0,
              totalPenalties: data.totalPenalties ?? 0,
              role: data.role || 'member',
              createdAt: data.createdAt || new Date().toISOString(),
              isActive: data.isActive !== false,
              streakDays: data.streakDays || 1,
            });
          } else {
            // New User Registration in Firestore
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'Media Operator',
              photoURL: fbUser.photoURL || '',
              points: 0,
              totalPenalties: 0,
              role: 'member',
              createdAt: new Date().toISOString(),
              isActive: true,
              streakDays: 1,
            };
            await setDoc(userRef, newProfile);
            setUser(newProfile);
          }
        } catch (e) {
          console.warn('Firestore user fetch note:', e);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Media Operator',
            photoURL: fbUser.photoURL || '',
            points: 0,
            totalPenalties: 0,
            role: 'member',
            createdAt: new Date().toISOString(),
            isActive: true,
          });
        }
      } else {
        // Fallback demo profile from localStorage if offline/preview
        const savedDemo = localStorage.getItem('coc_demo_user');
        if (savedDemo) {
          try {
            setUser(JSON.parse(savedDemo));
          } catch {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. App Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      }
    });

    // 2. Tasks Collection
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
      const taskList: Task[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.isActive !== false) {
          taskList.push({
            id: doc.id,
            title: d.title || 'Untitled Task',
            description: d.description || '',
            categoryId: d.categoryId || 'cat_general',
            taskLink: d.taskLink || '',
            points: Number(d.points) || 50,
            estimatedDuration: d.estimatedDuration || '',
            startTime: d.startTime || '',
            deadlineType: d.deadlineType || 'none',
            deadlineValue: d.deadlineValue || '',
            deadlineTimestamp: d.deadlineTimestamp,
            quotaType: d.quotaType || 'daily',
            targetQuota: Number(d.targetQuota) || 1,
            enableComment: Boolean(d.enableComment),
            isCommentRequired: Boolean(d.isCommentRequired),
            enableQuestion: Boolean(d.enableQuestion),
            questionPrompt: d.questionPrompt || '',
            isQuestionRequired: Boolean(d.isQuestionRequired),
            isActive: d.isActive !== false,
            createdAt: d.createdAt || '',
          });
        }
      });
      setTasks(taskList);
    });

    // 3. Categories Collection
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      if (!snap.empty) {
        const catList: Category[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          catList.push({
            id: doc.id,
            nameEn: d.nameEn || doc.id,
            nameAr: d.nameAr || d.nameEn || doc.id,
            color: d.color || '#0A84FF',
            icon: d.icon,
          });
        });
        setCategories(catList);
      } else {
        // Seed default categories into firestore
        DEFAULT_CATEGORIES.forEach(async (c) => {
          try {
            await setDoc(doc(db, 'categories', c.id), c);
          } catch {}
        });
      }
    });

    // 4. Users Collection
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const userList: UserProfile[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        userList.push({
          uid: doc.id,
          email: d.email || '',
          displayName: d.displayName || 'Member',
          photoURL: d.photoURL || '',
          points: d.points || 0,
          totalPenalties: d.totalPenalties || 0,
          role: d.role || 'member',
          createdAt: d.createdAt || '',
          isActive: d.isActive !== false,
          streakDays: d.streakDays || 1,
        });
      });
      setUsers(userList);

      // Keep active user object in sync with database updates
      if (user) {
        const currentUpdated = userList.find((u) => u.uid === user.uid);
        if (currentUpdated) {
          setUser(currentUpdated);
        }
      }
    });

    // 5. Submissions Collection
    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snap) => {
      const subList: TaskSubmission[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        subList.push({
          id: doc.id,
          taskId: d.taskId,
          taskTitle: d.taskTitle,
          userId: d.userId,
          userDisplayName: d.userDisplayName,
          userPhotoURL: d.userPhotoURL,
          categoryId: d.categoryId,
          pointsEarned: d.pointsEarned || 0,
          comment: d.comment,
          questionAnswer: d.questionAnswer,
          completedAt: d.completedAt,
          actualDurationMinutes: d.actualDurationMinutes,
          dateKey: d.dateKey || (d.completedAt ? d.completedAt.slice(0, 10) : ''),
        });
      });
      setSubmissions(subList);
    });

    // 6. Attendance Sessions & Logs
    const unsubSessions = onSnapshot(collection(db, 'attendance_sessions'), (snap) => {
      const sList: AttendanceSession[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        sList.push({
          id: doc.id,
          title: d.title || 'Worship Service',
          scheduledDays: d.scheduledDays || [0, 3],
          exactStartTime: d.exactStartTime || '09:00',
          checkInWindowEnd: d.checkInWindowEnd || '11:00',
          gracePeriodMinutes: d.gracePeriodMinutes || 10,
          penaltyUnitMinutes: d.penaltyUnitMinutes || 5,
          penaltyRatePerUnit: d.penaltyRatePerUnit || 2,
          minPenalty: d.minPenalty || 5,
          maxPenaltyCap: d.maxPenaltyCap || 50,
          isActive: d.isActive !== false,
        });
      });
      setSessions(sList);
    });

    const unsubLogs = onSnapshot(collection(db, 'attendance_logs'), (snap) => {
      const logList: AttendanceLog[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        logList.push({
          id: doc.id,
          sessionId: d.sessionId,
          sessionTitle: d.sessionTitle,
          userId: d.userId,
          userDisplayName: d.userDisplayName,
          checkInTimestamp: d.checkInTimestamp,
          dateKey: d.dateKey,
          status: d.status,
          lateMinutes: d.lateMinutes || 0,
          penaltyPointsApplied: d.penaltyPointsApplied || 0,
          bonusPointsApplied: d.bonusPointsApplied || 0,
        });
      });
      setAttendanceLogs(logList);
    });

    // 7. Notifications Collection
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snap) => {
      const notifList: NotificationItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        notifList.push({
          id: doc.id,
          targetUserId: d.targetUserId || 'all',
          title: d.title || 'Notification',
          body: d.body || '',
          type: d.type || 'announcement',
          createdAt: d.createdAt || '',
          read: Boolean(d.read),
          url: d.url,
        });
      });
      setNotifications(notifList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });

    return () => {
      unsubSettings();
      unsubTasks();
      unsubCategories();
      unsubUsers();
      unsubSubmissions();
      unsubSessions();
      unsubLogs();
      unsubNotifications();
    };
  }, [user?.uid]);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newProf: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Media Operator',
          photoURL: result.user.photoURL || '',
          points: 0,
          totalPenalties: 0,
          role: 'member',
          createdAt: new Date().toISOString(),
          isActive: true,
          streakDays: 1,
        };
        await setDoc(userRef, newProf);
        setUser(newProf);
      }
    }
  };

  // Direct manual sign-in fallback (useful for preview/iframe environments)
  const handleManualSignIn = async (name: string, email: string) => {
    const demoId = `user_${Date.now()}`;
    const demoProf: UserProfile = {
      uid: demoId,
      email,
      displayName: name,
      photoURL: '',
      points: 0,
      totalPenalties: 0,
      role: 'member',
      createdAt: new Date().toISOString(),
      isActive: true,
      streakDays: 1,
    };
    try {
      await setDoc(doc(db, 'users', demoId), demoProf);
    } catch {}
    setUser(demoProf);
    localStorage.setItem('coc_demo_user', JSON.stringify(demoProf));
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {}
    setUser(null);
    localStorage.removeItem('coc_demo_user');
    setActiveTab('tasks');
  };

  // Profile Update
  const handleUpdateProfile = async (displayName: string, photoURL: string) => {
    if (!user) return;
    const updated = { ...user, displayName, photoURL };
    setUser(updated);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName, photoURL });
    } catch (e) {
      console.warn('Update user doc warning:', e);
    }
  };

  // Admin Verification & Persistent Unlock
  const handleOpenAdminFromProfile = () => {
    if (isAdminUnlocked) {
      setActiveTab('admin');
    } else {
      setIsAdminPasswordModalOpen(true);
    }
  };

  const handleAdminSuccess = () => {
    setIsAdminUnlocked(true);
    try {
      localStorage.setItem('coc_admin_unlocked', 'true');
    } catch {}
    setIsAdminPasswordModalOpen(false);
    setActiveTab('admin');
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      localStorage.removeItem('coc_admin_unlocked');
    } catch {}
    setActiveTab('profile');
  };

  // Task Execution Submission
  const handleInitiateTaskComplete = (task: Task) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    // If task requires comment, duration, or question, open modal
    if (task.enableQuestion || task.isCommentRequired || task.enableComment) {
      setSubmittingTask(task);
    } else {
      executeTaskSubmission(task, '', '');
    }
  };

  const executeTaskSubmission = async (
    task: Task, 
    comment: string, 
    questionAnswer: string, 
    actualDurationMinutes?: number
  ) => {
    if (!user) return;
    const todayKey = new Date().toISOString().split('T')[0];
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const submissionDoc: TaskSubmission = {
      id: subId,
      taskId: task.id,
      taskTitle: task.title,
      userId: user.uid,
      userDisplayName: user.displayName,
      userPhotoURL: user.photoURL,
      categoryId: task.categoryId,
      pointsEarned: task.points,
      comment,
      questionAnswer,
      completedAt: new Date().toISOString(),
      actualDurationMinutes,
      dateKey: todayKey,
    };

    // Optimistic UI update
    setSubmissions((prev) => [submissionDoc, ...prev]);

    // Show celebration confetti
    setCelebration({
      show: true,
      points: task.points,
      title: task.title,
    });

    try {
      // 1. Save submission to Firestore
      await setDoc(doc(db, 'submissions', subId), submissionDoc);

      // 2. Increment user points in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(task.points),
      });

      // 3. Dispatch system notification
      const notifId = `notif_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        targetUserId: user.uid,
        title: 'Task Completed! 🎯',
        body: `You earned +${task.points} pts for completing "${task.title}".`,
        type: 'points',
        createdAt: new Date().toISOString(),
        read: false,
      });
    } catch (e) {
      console.warn('Firestore task submission notice:', e);
    }
  };

  // Attendance Check-In
  const handleAttendanceCheckIn = async (
    session: AttendanceSession, 
    lateMinutes: number, 
    penalty: number, 
    bonus: number
  ) => {
    if (!user) return;
    const todayKey = new Date().toISOString().split('T')[0];
    const logId = `att_${session.id}_${user.uid}_${todayKey}`;

    const newLog: AttendanceLog = {
      id: logId,
      sessionId: session.id,
      sessionTitle: session.title,
      userId: user.uid,
      userDisplayName: user.displayName,
      checkInTimestamp: new Date().toISOString(),
      dateKey: todayKey,
      status: penalty > 0 ? 'late' : 'on_time',
      lateMinutes,
      penaltyPointsApplied: penalty,
      bonusPointsApplied: bonus,
    };

    setAttendanceLogs((prev) => [newLog, ...prev]);

    try {
      await setDoc(doc(db, 'attendance_logs', logId), newLog);

      const netDelta = bonus - penalty;
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(netDelta),
        totalPenalties: increment(penalty),
      });

      // Dispatch notification
      const notifId = `notif_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        targetUserId: user.uid,
        title: penalty > 0 ? 'Late Penalty Recorded ⚠️' : 'Checked In On Time! 🟢',
        body: penalty > 0 
          ? `Checked in ${lateMinutes}m late for ${session.title}. Applied -${penalty} pts penalty.`
          : `On-time check-in recorded for ${session.title}. Awarded +${bonus} bonus pts!`,
        type: 'attendance',
        createdAt: new Date().toISOString(),
        read: false,
      });
    } catch (e) {
      console.warn('Attendance log write notice:', e);
    }
  };

  // Request External Push Notification Permission
  const handleRequestPushPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setPushPermissionState(perm);
      if (perm === 'granted' && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'COC Media Team',
          body: 'System notifications are now active on your device!',
        });
      }
    }
  };

  // Admin Actions
  const handleSaveTask = async (taskData: Partial<Task>) => {
    const id = taskData.id || `task_${Date.now()}`;
    await setDoc(doc(db, 'tasks', id), { ...taskData, id });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteDoc(doc(db, 'tasks', taskId));
  };

  const handleSaveCategory = async (catData: Partial<Category>) => {
    const id = catData.id || `cat_${Date.now()}`;
    await setDoc(doc(db, 'categories', id), { ...catData, id });
  };

  const handleDeleteCategory = async (catId: string) => {
    await deleteDoc(doc(db, 'categories', catId));
  };

  const handleAdjustUserPoints = async (userId: string, delta: number, reason: string) => {
    await updateDoc(doc(db, 'users', userId), {
      points: increment(delta),
    });

    const notifId = `notif_${Date.now()}`;
    await setDoc(doc(db, 'notifications', notifId), {
      targetUserId: userId,
      title: delta >= 0 ? 'Points Bonus Awarded! 🏆' : 'Points Adjustment',
      body: `Admin adjusted your score by ${delta >= 0 ? `+${delta}` : delta} pts. Reason: ${reason}`,
      type: 'points',
      createdAt: new Date().toISOString(),
      read: false,
    });
  };

  const handleSendAdminNotification = async (
    targetUserId: string, 
    title: string, 
    body: string, 
    type: 'task' | 'attendance' | 'points' | 'announcement'
  ) => {
    const notifId = `notif_${Date.now()}`;
    await setDoc(doc(db, 'notifications', notifId), {
      targetUserId,
      title,
      body,
      type,
      createdAt: new Date().toISOString(),
      read: false,
    });
  };

  const handleSaveAttendanceSession = async (sessionData: Partial<AttendanceSession>) => {
    const id = sessionData.id || `session_${Date.now()}`;
    await setDoc(doc(db, 'attendance_sessions', id), { ...sessionData, id });
  };

  const handleDeleteAttendanceSession = async (sessionId: string) => {
    await deleteDoc(doc(db, 'attendance_sessions', sessionId));
  };

  const handleDeleteSubmission = async (submission: TaskSubmission) => {
    await deleteDoc(doc(db, 'submissions', submission.id));
    // Reverse points
    if (submission.userId && submission.pointsEarned) {
      await updateDoc(doc(db, 'users', submission.userId), {
        points: increment(-submission.pointsEarned),
      });
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await setDoc(doc(db, 'settings', 'global'), newSettings);
    setSettings(newSettings);
  };

  // Filtered Notifications for current user
  const userNotifications = useMemo(() => {
    return notifications.filter((n) => n.targetUserId === 'all' || (user && n.targetUserId === user.uid));
  }, [notifications, user]);

  const unreadNotificationsCount = userNotifications.filter((n) => !n.read).length;

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedCategoryFilter !== 'All' && t.categoryId !== selectedCategoryFilter) {
        return false;
      }
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, selectedCategoryFilter, taskSearch]);

  return (
    <div className="min-h-screen bg-[#000000] text-neutral-100 flex flex-col relative selection:bg-[#0A84FF]/30 selection:text-white pb-safe">
      
      {/* Background ambient lighting */}
      <div 
        className="ambient-glow -top-40 -right-40 w-[600px] h-[600px]"
        style={{ backgroundColor: settings.accentColor || '#0A84FF' }}
      />
      <div className="ambient-glow top-1/2 -left-40 w-[600px] h-[600px] bg-[#F59E0B]/15" />
      <div className="ambient-glow -bottom-40 right-1/4 w-[500px] h-[500px] bg-blue-700/15" />

      {/* Main Header */}
      <Header
        settings={settings}
        user={user}
        language={language}
        onToggleLanguage={toggleLanguage}
        unreadNotificationsCount={unreadNotificationsCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        
        {/* VIEW 1: TASKS & QUOTAS */}
        {activeTab === 'tasks' && (
          <section className="space-y-6 animate-in fade-in duration-300">
            
            {/* Category Filter Pills & Search */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                <button
                  onClick={() => setSelectedCategoryFilter('All')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategoryFilter === 'All'
                      ? 'bg-[#0A84FF] text-white shadow-lg shadow-[#0A84FF]/30'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white border border-white/10'
                  }`}
                >
                  {t.allCategories}
                </button>

                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryFilter(c.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      selectedCategoryFilter === c.id
                        ? 'bg-[#0A84FF] text-white shadow-lg shadow-[#0A84FF]/30'
                        : 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {language === 'ar' ? c.nameAr : c.nameEn}
                  </button>
                ))}
              </div>

              {/* Task Search Bar */}
              <div className="relative md:w-64">
                <input
                  type="text"
                  placeholder={t.search}
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="w-full px-3.5 py-2 pl-9 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50"
                />
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
              </div>

            </div>

            {/* Task Cards Grid or STRICT EMPTY STATE */}
            {filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTasks.map((task) => {
                  const cat = categories.find((c) => c.id === task.categoryId);
                  const mySubs = submissions.filter((s) => s.taskId === task.id && s.userId === user?.uid);
                  const allSubs = submissions.filter((s) => s.taskId === task.id);

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      category={cat}
                      userSubmissions={mySubs}
                      allTaskSubmissions={allSubs}
                      language={language}
                      onInitiateComplete={handleInitiateTaskComplete}
                      onOpenCompetition={(t) => setCompetitionTask(t)}
                      accentColor={settings.accentColor}
                    />
                  );
                })}
              </div>
            ) : (
              /* STRICT EMPTY-STATE SECURITY RULE:
                 Display clean message WITHOUT ANY BUTTON OR LINK to add tasks or open Admin Dashboard! */
              <div className="rounded-3xl glass-panel-elevated p-12 text-center max-w-md mx-auto border border-white/10 my-8">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-neutral-400 mb-4">
                  <Inbox className="w-8 h-8 text-[#0A84FF]" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {t.noActiveTasks}
                </h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  {t.noActiveTasksSub}
                </p>
              </div>
            )}

          </section>
        )}

        {/* VIEW 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <AttendanceView
            sessions={sessions}
            logs={attendanceLogs}
            user={user}
            language={language}
            onCheckIn={handleAttendanceCheckIn}
          />
        )}

        {/* VIEW 3: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            users={users}
            submissions={submissions}
            tasks={tasks}
            categories={categories}
            currentUserId={user?.uid || ''}
            language={language}
          />
        )}

        {/* VIEW 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <NotificationsView
            notifications={userNotifications}
            language={language}
            onMarkAllAsRead={() => {
              userNotifications.forEach(async (n) => {
                if (!n.read) {
                  try {
                    await updateDoc(doc(db, 'notifications', n.id), { read: true });
                  } catch {}
                }
              });
            }}
            onRequestPushPermission={handleRequestPushPermission}
            pushPermissionState={pushPermissionState}
          />
        )}

        {/* VIEW 5: PROFILE & EXCLUSIVE ADMIN ENTRY */}
        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            language={language}
            onUpdateProfile={handleUpdateProfile}
            onOpenAdmin={handleOpenAdminFromProfile}
            isAdminUnlocked={isAdminUnlocked}
            onSignOut={handleSignOut}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {/* VIEW 6: ADMIN DASHBOARD (ACCESSIBLE ONLY VIA PROFILE) */}
        {activeTab === 'admin' && (
          <AdminDashboard
            settings={settings}
            tasks={tasks}
            categories={categories}
            users={users}
            sessions={sessions}
            logs={attendanceLogs}
            submissions={submissions}
            language={language}
            onSaveTask={handleSaveTask}
            onDeleteTask={handleDeleteTask}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onAdjustUserPoints={handleAdjustUserPoints}
            onSendNotification={handleSendAdminNotification}
            onSaveAttendanceSession={handleSaveAttendanceSession}
            onDeleteAttendanceSession={handleDeleteAttendanceSession}
            onDeleteSubmission={handleDeleteSubmission}
            onSaveSettings={handleSaveSettings}
            onLockAdmin={handleLockAdmin}
          />
        )}

      </main>

      {/* Footer strictly observing rules */}
      <Footer
        settings={settings}
        language={language}
      />

      {/* Mobile Glass Bottom Nav */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Interactive Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        language={language}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onManualSignIn={handleManualSignIn}
      />

      <AdminPasswordModal
        isOpen={isAdminPasswordModalOpen}
        onSuccess={handleAdminSuccess}
        onClose={() => setIsAdminPasswordModalOpen(false)}
      />

      <SubmitTaskModal
        isOpen={Boolean(submittingTask)}
        task={submittingTask}
        language={language}
        onClose={() => setSubmittingTask(null)}
        onSubmit={executeTaskSubmission}
        userName={user?.displayName || 'Member'}
      />

      <TaskCompetitionModal
        isOpen={Boolean(competitionTask)}
        task={competitionTask}
        submissions={submissions}
        language={language}
        onClose={() => setCompetitionTask(null)}
        currentUserId={user?.uid || ''}
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
