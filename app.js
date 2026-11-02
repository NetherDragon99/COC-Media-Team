/**
 * COC Media Team - v1.0.0
 * Production Task, Quota & Attendance Platform
 * Designed & Developed by Steven Mario
 * GitHub Pages Compatible (Vanilla JS + Firebase CDN)
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

/* ==========================================================================
   1. FIREBASE CONFIGURATION & INITIALIZATION
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBgnWU2azejTgCr-zVtVPLQYYRMGNtfieQ",
  authDomain: "coc-media-team.firebaseapp.com",
  projectId: "coc-media-team",
  storageBucket: "coc-media-team.firebasestorage.app",
  messagingSenderId: "956334806347",
  appId: "1:956334806347:web:f9f1200268c451bbe284ce",
  measurementId: "G-BXX1WE9EWJ"
};

let app, auth, db, googleProvider;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {
  console.error("Firebase init failed:", e);
}

const ADMIN_MASTER_PASSWORD = '$J@@s#COC1982';

/* ==========================================================================
   2. GLOBAL STATE & I18N DICTIONARY
   ========================================================================== */
const state = {
  lang: localStorage.getItem('coc_lang') || 'en',
  user: null, // { uid, displayName, email, photoURL, points, totalPenalties, role, streakDays }
  isAdminUnlocked: false,
  activeTab: 'tasks',
  tasks: [],
  categories: [
    { id: 'video', nameEn: 'Video Editing', nameAr: 'مونتاج الفيديو', color: '#0A84FF' },
    { id: 'social', nameEn: 'Social Media', nameAr: 'سوشيال ميديا', color: '#EC4899' },
    { id: 'stream', nameEn: 'Live Streaming', nameAr: 'البث المباشر', color: '#10B981' },
    { id: 'design', nameEn: 'Graphic Design', nameAr: 'تصميم جرافيك', color: '#F59E0B' },
    { id: 'sound', nameEn: 'Sound Engineering', nameAr: 'هندسة الصوت', color: '#8B5CF6' },
    { id: 'photo', nameEn: 'Photography', nameAr: 'التصوير الفوتوغرافي', color: '#06B6D4' }
  ],
  attendanceSessions: [],
  submissions: [],
  attendanceLogs: [],
  notifications: [],
  members: [],
  selectedCategory: 'all',
  searchQuery: '',
  statusFilter: 'all',
  leaderboardPeriod: 'all',
  settings: {
    appName: 'COC Media Team',
    subtitleEn: 'Production Task, Quota & Attendance Platform',
    subtitleAr: 'منصة إدارة المهام، الكوتا ومحرك الحضور لفريق الميديا',
    announcementEn: '',
    announcementAr: '',
    logoUrl: './image_ad59c0.jpg',
    developerCredit: 'Steven Mario',
    version: 'v1.0.0'
  }
};

const i18n = {
  en: {
    nav_tasks: 'Tasks',
    nav_attendance: 'Attendance',
    nav_leaderboard: 'Leaderboard',
    nav_notifications: 'Updates',
    nav_profile: 'Profile',
    stat_active_tasks: 'Active Tasks',
    stat_completed_today: 'Completed Today',
    stat_my_points: 'My Points',
    empty_tasks_title: 'No active tasks found',
    empty_tasks_desc: 'There are no tasks available matching this filter. Check back later or adjust your filters.',
    attendance_engine_live: 'Live Attendance Engine',
    attendance_status_label: 'Your Today Status:',
    scheduled_sessions: 'Scheduled Sessions',
    today_attendance_log: "Today's Check-in Log",
    leaderboard_title: 'Team Leaderboard',
    leaderboard_sub: 'Rankings based on verified completed quotas and points.',
    all_team_rankings: 'Team Rankings',
    notifications_title: 'Team Announcements & Alerts',
    notifications_sub: 'Real-time updates, task assignments, and points announcements.',
    sign_in: 'Sign In',
    complete_task: 'Complete Task',
    already_completed: 'Completed Today',
    open_link: 'Open Task Link ↗'
  },
  ar: {
    nav_tasks: 'المهام',
    nav_attendance: 'الحضور',
    nav_leaderboard: 'المتصدرين',
    nav_notifications: 'الإشعارات',
    nav_profile: 'الملف الشخصي',
    stat_active_tasks: 'المهام المتاحة',
    stat_completed_today: 'منجزات اليوم',
    stat_my_points: 'نقاطي',
    empty_tasks_title: 'لا توجد مهام حالياً',
    empty_tasks_desc: 'لا توجد مهام تطابق هذا التصنيف حالياً. يرجى المتابعة لاحقاً أو تغيير الفلتر.',
    attendance_engine_live: 'محرك تسجيل الحضور المباشر',
    attendance_status_label: 'حالة حضورك اليوم:',
    scheduled_sessions: 'جلسات الخدمة المجدولة',
    today_attendance_log: 'سجل حضور اليوم',
    leaderboard_title: 'لوحة شرف الفريق',
    leaderboard_sub: 'ترتيب أعضاء الفريق بناءً على النقاط والكوتا المنجزة.',
    all_team_rankings: 'ترتيب أعضاء الفريق',
    notifications_title: 'تنبيهات وإعلانات الفريق',
    notifications_sub: 'تحديثات فورية، مهام جديدة، وإشعارات النقاط والكوتا.',
    sign_in: 'تسجيل الدخول',
    complete_task: 'إنجاز المهمة',
    already_completed: 'تم إنجازها اليوم',
    open_link: 'فتح رابط المهمة ↗'
  }
};

/* ==========================================================================
   3. NON-BLOCKING FAIL-SAFE LOADER
   ========================================================================== */
let isLoaderHidden = false;
function hideLoader() {
  if (isLoaderHidden) return;
  isLoaderHidden = true;
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 420);
  }
}
// Guaranteed fallback so the screen NEVER gets stuck black under any circumstance
setTimeout(hideLoader, 2500);

/* ==========================================================================
   4. DOM HELPERS & UI UPDATERS
   ========================================================================== */
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function triggerConfetti() {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#0A84FF', '#F59E0B', '#10B981', '#FFFFFF']
    });
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/* ==========================================================================
   5. I18N & LANGUAGE TOGGLE
   ========================================================================== */
function applyLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('coc_lang', lang);
  
  const isArabic = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  
  const langIndicator = document.getElementById('lang-indicator');
  if (langIndicator) {
    langIndicator.textContent = isArabic ? 'EN' : 'AR';
  }

  // Update text strings with data-i18n
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang] && i18n[lang][key]) {
      el.textContent = i18n[lang][key];
    }
  });

  // Dynamic Subtitle
  const subEl = document.getElementById('header-subtitle');
  if (subEl) {
    subEl.textContent = isArabic ? (state.settings.subtitleAr || i18n.ar.subtitle) : (state.settings.subtitleEn || i18n.en.subtitle);
  }

  // Dynamic Announcement
  updateAnnouncementUI();
  renderTasks();
  renderAttendance();
  renderLeaderboard();
  renderNotifications();
  refreshIcons();
}

function updateAnnouncementUI() {
  const bar = document.getElementById('announcement-bar');
  const textEl = document.getElementById('announcement-text');
  const text = state.lang === 'ar' ? state.settings.announcementAr : state.settings.announcementEn;
  if (text && text.trim().length > 0) {
    if (textEl) textEl.textContent = text;
    if (bar) bar.classList.remove('hidden');
  } else {
    if (bar) bar.classList.add('hidden');
  }
}

/* ==========================================================================
   6. AUTHENTICATION & USER PROFILE MANAGEMENT
   ========================================================================== */
function initAuth() {
  // Check local guest fallback first
  const storedGuest = localStorage.getItem('coc_guest_user');
  if (storedGuest) {
    try {
      state.user = JSON.parse(storedGuest);
      updateUserUI();
    } catch (e) {
      console.warn("Invalid guest data:", e);
    }
  }

  if (!auth) {
    hideLoader();
    return;
  }

  onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (firebaseUser) {
        // User logged in via Firebase
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let userData;
        if (userSnap.exists()) {
          userData = userSnap.data();
          // Update last active
          await updateDoc(userRef, { lastActiveDate: getTodayKey() });
        } else {
          userData = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Team Member',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || './image_ad59c0.jpg',
            points: 0,
            totalPenalties: 0,
            role: 'member',
            createdAt: new Date().toISOString(),
            lastActiveDate: getTodayKey(),
            isActive: true,
            streakDays: 1
          };
          await setDoc(userRef, userData);
        }

        state.user = userData;
        localStorage.removeItem('coc_guest_user');
      } else if (!state.user) {
        // Default guest member if none
        state.user = {
          uid: 'guest_' + Math.random().toString(36).substring(2, 9),
          displayName: 'Team Contributor',
          email: 'member@cocmedia.local',
          photoURL: './image_ad59c0.jpg',
          points: 0,
          totalPenalties: 0,
          role: 'member',
          createdAt: new Date().toISOString(),
          isActive: true,
          streakDays: 1
        };
      }
      updateUserUI();
    } catch (err) {
      console.warn("Auth state resolution warning:", err);
    } finally {
      hideLoader();
    }
  });
}

function updateUserUI() {
  const authSection = document.getElementById('header-user-section');
  const greetingEl = document.getElementById('hero-greeting');
  const userPointsEl = document.getElementById('stat-user-points');
  
  if (state.user) {
    if (greetingEl) {
      greetingEl.textContent = state.lang === 'ar' ? `أهلاً بك، ${state.user.displayName}` : `Welcome back, ${state.user.displayName}`;
    }
    if (userPointsEl) {
      userPointsEl.textContent = `${state.user.points || 0} pts`;
    }

    if (authSection) {
      authSection.innerHTML = `
        <div class="flex items-center gap-2 p-1 pl-2.5 rounded-full bg-white/[0.06] border border-white/10 hover:border-white/20 transition cursor-pointer" id="btn-profile-pill">
          <span class="text-xs font-semibold text-white truncate max-w-[100px] sm:max-w-[130px]">${state.user.displayName}</span>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30 font-bold">${state.user.points || 0} pts</span>
          <img src="${state.user.photoURL || './image_ad59c0.jpg'}" alt="${state.user.displayName}" class="w-7 h-7 rounded-full object-cover border border-white/20" onerror="this.src='./image_ad59c0.jpg'" />
        </div>
      `;
      document.getElementById('btn-profile-pill')?.addEventListener('click', () => {
        switchTab('profile');
      });
    }

    // Update Profile View Elements
    const profImg = document.getElementById('profile-user-img');
    const profName = document.getElementById('profile-user-name');
    const profEmail = document.getElementById('profile-user-email');
    const profRole = document.getElementById('profile-role-badge');
    const profPts = document.getElementById('prof-stat-points');
    const profStreak = document.getElementById('prof-stat-streak');
    const profPenalties = document.getElementById('prof-stat-penalties');

    if (profImg) profImg.src = state.user.photoURL || './image_ad59c0.jpg';
    if (profName) profName.textContent = state.user.displayName;
    if (profEmail) profEmail.textContent = state.user.email || 'local-member';
    if (profRole) {
      profRole.textContent = state.user.role?.toUpperCase() || 'MEMBER';
      if (state.user.role === 'admin') {
        profRole.className = 'text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 font-semibold';
      }
    }
    if (profPts) profPts.textContent = `${state.user.points || 0}`;
    if (profStreak) profStreak.textContent = `${state.user.streakDays || 1} Days`;
    if (profPenalties) profPenalties.textContent = `-${state.user.totalPenalties || 0} pts`;
  }

  renderTasks();
  renderLeaderboard();
  renderProfileHistory();
  refreshIcons();
}

/* ==========================================================================
   7. GITHUB PAGES UNAUTHORIZED DOMAIN WARNING HANDLER
   ========================================================================== */
async function handleGoogleSignIn() {
  if (!auth) {
    alert("Firebase Auth is not ready. Continuing with Local Mode.");
    openModal('modal-auth');
    return;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    closeAllModals();
    triggerConfetti();
  } catch (error) {
    console.error("Firebase Sign-In Error:", error);
    
    // Check specifically for GitHub Pages unauthorized domain error
    if (error.code === 'auth/unauthorized-domain' || error.message?.includes('unauthorized-domain')) {
      const hostnameLabel = document.getElementById('current-hostname-label');
      if (hostnameLabel) {
        hostnameLabel.textContent = window.location.hostname;
      }
      closeModal('modal-auth');
      openModal('modal-unauthorized-domain');
    } else {
      alert(`Sign in could not complete (${error.message}). You can log in directly with your name below.`);
    }
  }
}

/* ==========================================================================
   8. REALTIME DATA LISTENERS (FIRESTORE)
   ========================================================================== */
function initDataSubscriptions() {
  if (!db) {
    hideLoader();
    seedDefaultTasksFallback();
    return;
  }

  try {
    // 1. Settings & Branding Listener
    onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        state.settings = { ...state.settings, ...snapshot.data() };
        applyBrandingSettings();
      }
    }, (err) => console.warn("Settings listener error:", err));

    // 2. Tasks Listener
    onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const loadedTasks = [];
      snapshot.forEach((doc) => {
        loadedTasks.push({ id: doc.id, ...doc.data() });
      });
      state.tasks = loadedTasks;
      
      // If Firestore tasks are completely empty, initialize default sample production tasks
      if (state.tasks.length === 0) {
        seedDefaultTasks();
      } else {
        renderTasks();
        renderAdminTasks();
      }
      hideLoader();
    }, (err) => {
      console.warn("Tasks listener error:", err);
      seedDefaultTasksFallback();
      hideLoader();
    });

    // 3. Submissions Listener (For Leaderboard aggregation)
    onSnapshot(collection(db, 'submissions'), (snapshot) => {
      const loadedSubs = [];
      snapshot.forEach((doc) => {
        loadedSubs.push({ id: doc.id, ...doc.data() });
      });
      state.submissions = loadedSubs;
      renderLeaderboard();
      renderTasks(); // update completion status
      renderProfileHistory();
    }, (err) => console.warn("Submissions listener error:", err));

    // 4. Attendance Sessions Listener
    onSnapshot(collection(db, 'attendance_sessions'), (snapshot) => {
      const loadedSessions = [];
      snapshot.forEach((doc) => {
        loadedSessions.push({ id: doc.id, ...doc.data() });
      });
      state.attendanceSessions = loadedSessions;
      if (state.attendanceSessions.length === 0) {
        seedDefaultAttendanceSessions();
      } else {
        renderAttendance();
        renderAdminSessions();
      }
    }, (err) => {
      console.warn("Attendance listener error:", err);
      seedDefaultAttendanceSessions();
    });

    // 5. Attendance Logs Listener
    onSnapshot(collection(db, 'attendance_logs'), (snapshot) => {
      const loadedLogs = [];
      snapshot.forEach((doc) => {
        loadedLogs.push({ id: doc.id, ...doc.data() });
      });
      // Sort newest first
      loadedLogs.sort((a, b) => new Date(b.checkInTimestamp) - new Date(a.checkInTimestamp));
      state.attendanceLogs = loadedLogs;
      renderAttendanceLogs();
    }, (err) => console.warn("Attendance logs listener error:", err));

    // 6. Registered Members Listener
    onSnapshot(collection(db, 'users'), (snapshot) => {
      const loadedUsers = [];
      snapshot.forEach((doc) => {
        loadedUsers.push({ id: doc.id, ...doc.data() });
      });
      state.members = loadedUsers;
      renderLeaderboard();
      renderAdminMembers();
    }, (err) => console.warn("Users listener error:", err));

    // 7. Notifications Listener
    onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const loadedNotifications = [];
      snapshot.forEach((doc) => {
        loadedNotifications.push({ id: doc.id, ...doc.data() });
      });
      loadedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      state.notifications = loadedNotifications;
      renderNotifications();
    }, (err) => console.warn("Notifications listener error:", err));

  } catch (err) {
    console.error("Data subscription error:", err);
    hideLoader();
  }
}

function applyBrandingSettings() {
  const brandTitle = document.getElementById('header-app-title');
  const footerBrand = document.getElementById('footer-brand-name');
  const footerDev = document.getElementById('footer-dev-credit');
  const headerLogo = document.getElementById('header-logo-img');

  if (brandTitle) brandTitle.textContent = state.settings.appName || 'COC Media Team';
  if (footerBrand) footerBrand.textContent = state.settings.appName || 'COC Media Team';
  if (footerDev) footerDev.textContent = `Designed & Developed by ${state.settings.developerCredit || 'Steven Mario'}`;
  if (headerLogo && state.settings.logoUrl) {
    headerLogo.src = state.settings.logoUrl;
  }
  updateAnnouncementUI();
}

/* ==========================================================================
   9. INITIAL SEEDS (FALLBACK & ZERO-STATE RECOVERY)
   ========================================================================== */
async function seedDefaultTasks() {
  const defaultTasks = [
    {
      title: "Export Sunday Sermon YouTube Highlights",
      description: "Trim 15-min highlight sermon video, export in 1080p60 Apple ProRes/H.264, and upload to shared team Google Drive.",
      categoryId: "video",
      points: 75,
      quotaType: "daily",
      deadlineType: "duration_hours",
      deadlineValue: "6",
      estimatedDuration: "45 mins",
      taskLink: "https://drive.google.com",
      enableComment: true,
      enableQuestion: true,
      questionPrompt: "Paste exported drive link or YouTube unlisted URL:",
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      title: "Create Instagram & Facebook Carousel Announcement",
      description: "Design 4-slide Instagram square carousel (1080x1080) for upcoming youth conference using the official COC Media brand kit.",
      categoryId: "design",
      points: 50,
      quotaType: "once",
      deadlineType: "duration_days",
      deadlineValue: "2",
      estimatedDuration: "30 mins",
      taskLink: "https://canva.com",
      enableComment: true,
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      title: "Audio Mixer Equalization & Sound Check",
      description: "Perform microphone gain calibration, monitor in-ear audio balances, and record high-res WAV stems during rehearsal.",
      categoryId: "sound",
      points: 60,
      quotaType: "daily",
      deadlineType: "none",
      estimatedDuration: "40 mins",
      enableComment: true,
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      title: "Photo Selection & Lightroom Color Grading",
      description: "Select the top 20 candid worship photos from last night, color grade, and export WebP/JPEG format.",
      categoryId: "photo",
      points: 55,
      quotaType: "unlimited",
      deadlineType: "duration_hours",
      deadlineValue: "12",
      estimatedDuration: "35 mins",
      enableComment: true,
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  if (db) {
    for (const t of defaultTasks) {
      await addDoc(collection(db, 'tasks'), t);
    }
  } else {
    state.tasks = defaultTasks.map((t, idx) => ({ id: `task_${idx}`, ...t }));
    renderTasks();
  }
}

function seedDefaultTasksFallback() {
  state.tasks = [
    {
      id: "fallback_1",
      title: "Export Sunday Sermon YouTube Highlights",
      description: "Trim highlight sermon video, export in 1080p, and upload to shared Google Drive.",
      categoryId: "video",
      points: 75,
      quotaType: "daily",
      taskLink: "https://drive.google.com",
      enableComment: true,
      isActive: true
    },
    {
      id: "fallback_2",
      title: "Design Carousel Announcement",
      description: "Design 4-slide Instagram square carousel for upcoming conference.",
      categoryId: "design",
      points: 50,
      quotaType: "once",
      enableComment: true,
      isActive: true
    }
  ];
  renderTasks();
}

async function seedDefaultAttendanceSessions() {
  const defaultSessions = [
    {
      title: "Sunday Morning Liturgy & Media Setup",
      scheduledDays: [0], // Sunday
      exactStartTime: "08:30",
      checkInWindowEnd: "11:30",
      gracePeriodMinutes: 15,
      penaltyRatePerUnit: 5,
      penaltyUnitMinutes: 5,
      maxPenaltyCap: 50,
      isActive: true
    },
    {
      title: "Friday Youth Meeting & Live Stream",
      scheduledDays: [5], // Friday
      exactStartTime: "18:45",
      checkInWindowEnd: "21:00",
      gracePeriodMinutes: 10,
      penaltyRatePerUnit: 5,
      penaltyUnitMinutes: 5,
      maxPenaltyCap: 40,
      isActive: true
    }
  ];

  if (db) {
    for (const s of defaultSessions) {
      await addDoc(collection(db, 'attendance_sessions'), s);
    }
  } else {
    state.attendanceSessions = defaultSessions.map((s, idx) => ({ id: `sess_${idx}`, ...s }));
    renderAttendance();
  }
}

/* ==========================================================================
   10. RENDERING FUNCTIONS
   ========================================================================== */

// 1. Render Task Cards
function renderTasks() {
  const container = document.getElementById('tasks-container');
  const emptyState = document.getElementById('tasks-empty-state');
  const activeCountEl = document.getElementById('stat-active-tasks-count');
  const completedTodayEl = document.getElementById('stat-completed-today-count');
  
  if (!container) return;

  const todayKey = getTodayKey();
  const userSubmissions = state.submissions.filter(s => s.userId === state.user?.uid);
  const completedTodayCount = userSubmissions.filter(s => s.dateKey === todayKey).length;
  
  if (completedTodayEl) completedTodayEl.textContent = completedTodayCount;

  // Filter tasks
  const filtered = state.tasks.filter((task) => {
    if (state.selectedCategory !== 'all' && task.categoryId !== state.selectedCategory) {
      return false;
    }
    if (state.searchQuery.trim().length > 0) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = task.title?.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    const isCompleted = userSubmissions.some(s => s.taskId === task.id);
    if (state.statusFilter === 'pending' && isCompleted) return false;
    if (state.statusFilter === 'completed' && !isCompleted) return false;
    return true;
  });

  if (activeCountEl) activeCountEl.textContent = state.tasks.length;

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map((task) => {
    const category = state.categories.find(c => c.id === task.categoryId) || {
      nameEn: 'General',
      nameAr: 'عام',
      color: '#0A84FF'
    };
    const catName = state.lang === 'ar' ? category.nameAr : category.nameEn;

    // Check completion status for current user
    const hasCompletedEver = userSubmissions.some(s => s.taskId === task.id);
    const hasCompletedToday = userSubmissions.some(s => s.taskId === task.id && s.dateKey === todayKey);
    
    let isActionDisabled = false;
    let buttonText = state.lang === 'ar' ? i18n.ar.complete_task : i18n.en.complete_task;

    if (task.quotaType === 'once' && hasCompletedEver) {
      isActionDisabled = true;
      buttonText = state.lang === 'ar' ? 'تم الإنجاز' : 'Completed';
    } else if (task.quotaType === 'daily' && hasCompletedToday) {
      isActionDisabled = true;
      buttonText = state.lang === 'ar' ? i18n.ar.already_completed : i18n.en.already_completed;
    }

    const taskCompletionsCount = state.submissions.filter(s => s.taskId === task.id).length;

    return `
      <div class="glass-card rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all duration-300 relative group">
        <div>
          <!-- Header Chip & Points -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style="background-color: ${category.color}20; color: ${category.color}; border: 1px solid ${category.color}40;">
              ${catName}
            </span>
            <span class="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
              +${task.points} pts
            </span>
          </div>

          <!-- Title & Description -->
          <h3 class="text-sm sm:text-base font-bold text-white group-hover:text-[#0A84FF] transition leading-snug">
            ${task.title}
          </h3>
          <p class="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
            ${task.description}
          </p>

          <!-- Badges & Quota Info -->
          <div class="flex flex-wrap items-center gap-2 mt-4 text-[10px] text-neutral-300">
            <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 flex items-center gap-1">
              <i data-lucide="repeat" class="w-3 h-3 text-neutral-400"></i>
              ${task.quotaType || 'daily'}
            </span>
            ${task.estimatedDuration ? `
              <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3 text-neutral-400"></i>
                ${task.estimatedDuration}
              </span>
            ` : ''}
            <button class="btn-view-task-comp text-neutral-400 hover:text-white flex items-center gap-1 underline underline-offset-2 ml-auto" data-taskid="${task.id}">
              <i data-lucide="users" class="w-3 h-3"></i>
              ${taskCompletionsCount} completed
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
          ${task.taskLink ? `
            <a href="${task.taskLink}" target="_blank" rel="noopener noreferrer" class="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white transition" title="Open Task Link">
              <i data-lucide="external-link" class="w-4 h-4 text-[#0A84FF]"></i>
            </a>
          ` : ''}

          <button 
            class="btn-complete-task flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              isActionDisabled 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed' 
                : 'bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white shadow-lg shadow-[#0A84FF]/20 active:scale-[0.98]'
            }"
            data-taskid="${task.id}"
            ${isActionDisabled ? 'disabled' : ''}
          >
            <i data-lucide="${isActionDisabled ? 'check' : 'check-circle'}" class="w-3.5 h-3.5"></i>
            <span>${buttonText}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach complete button listeners
  container.querySelectorAll('.btn-complete-task').forEach((btn) => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-taskid');
      const task = state.tasks.find(t => t.id === taskId);
      if (task) openSubmitModal(task);
    });
  });

  // Attach view competition listeners
  container.querySelectorAll('.btn-view-task-comp').forEach((btn) => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-taskid');
      const task = state.tasks.find(t => t.id === taskId);
      if (task) openCompetitionModal(task);
    });
  });

  refreshIcons();
}

// 2. Render Attendance View & Active Sessions
function renderAttendance() {
  const container = document.getElementById('attendance-sessions-container');
  if (!container) return;

  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const userLogs = state.attendanceLogs.filter(l => l.userId === state.user?.uid && l.dateKey === getTodayKey());
  const todayBadge = document.getElementById('user-today-attendance-badge');
  
  if (todayBadge) {
    if (userLogs.length > 0) {
      const latest = userLogs[0];
      todayBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full ${latest.status === 'on_time' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
        <span class="${latest.status === 'on_time' ? 'text-emerald-400' : 'text-amber-400'}">${latest.status === 'on_time' ? 'Checked In (On Time)' : `Checked In (${latest.lateMinutes}m Late)`}</span>
      `;
    } else {
      todayBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-neutral-500"></span> Not Checked In Today`;
    }
  }

  if (state.attendanceSessions.length === 0) {
    container.innerHTML = `<div class="col-span-2 text-center text-xs text-neutral-400 p-6 glass-card rounded-2xl">No attendance sessions configured.</div>`;
    return;
  }

  container.innerHTML = state.attendanceSessions.map((sess) => {
    const isToday = sess.scheduledDays ? sess.scheduledDays.includes(currentDay) : true;
    const hasCheckedIn = userLogs.some(l => l.sessionId === sess.id);

    // Calculate time status
    const [startH, startM] = (sess.exactStartTime || '09:00').split(':').map(Number);
    const [endH, endM] = (sess.checkInWindowEnd || '11:00').split(':').map(Number);
    
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const graceEndMinutes = startMinutes + (sess.gracePeriodMinutes || 10);

    let statusText = 'Closed';
    let isWindowOpen = false;
    let lateMinutes = 0;
    let calculatedPenalty = 0;

    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
      isWindowOpen = true;
      if (nowMinutes <= graceEndMinutes) {
        statusText = 'On-Time Window Open';
      } else {
        lateMinutes = nowMinutes - startMinutes;
        const penaltyUnit = sess.penaltyUnitMinutes || 5;
        const penaltyRate = sess.penaltyRatePerUnit || 5;
        const units = Math.ceil((lateMinutes - (sess.gracePeriodMinutes || 10)) / penaltyUnit);
        calculatedPenalty = Math.min(units * penaltyRate, sess.maxPenaltyCap || 50);
        statusText = `Late Window (${lateMinutes}m late, -${calculatedPenalty} pts)`;
      }
    } else if (nowMinutes < startMinutes) {
      statusText = `Starts at ${sess.exactStartTime}`;
    }

    return `
      <div class="glass-card rounded-2xl p-5 border ${isWindowOpen ? 'border-emerald-500/30' : 'border-white/10'} space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${isWindowOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-neutral-400'} inline-block">
              ${statusText}
            </div>
            <h4 class="text-sm sm:text-base font-bold text-white mt-1.5">${sess.title}</h4>
            <div class="text-xs text-neutral-400 mt-1 flex items-center gap-3">
              <span>Time: <strong class="text-neutral-200 font-mono">${sess.exactStartTime} - ${sess.checkInWindowEnd}</strong></span>
              <span>Grace: <strong class="text-neutral-200 font-mono">${sess.gracePeriodMinutes || 10}m</strong></span>
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-white/10 flex items-center justify-between">
          <div class="text-[11px] text-neutral-400">
            Penalty: <span class="text-amber-400 font-mono">-${sess.penaltyRatePerUnit || 5} pts / ${sess.penaltyUnitMinutes || 5}m</span>
          </div>

          <button 
            class="btn-checkin-session px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              hasCheckedIn 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
            }"
            data-sessid="${sess.id}"
            ${hasCheckedIn ? 'disabled' : ''}
          >
            <i data-lucide="${hasCheckedIn ? 'check' : 'user-check'}" class="w-3.5 h-3.5"></i>
            <span>${hasCheckedIn ? 'Checked In' : 'One-Tap Check In'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-checkin-session').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessId = btn.getAttribute('data-sessid');
      const sess = state.attendanceSessions.find(s => s.id === sessId);
      if (sess) performCheckIn(sess);
    });
  });

  refreshIcons();
}

function renderAttendanceLogs() {
  const container = document.getElementById('attendance-logs-feed');
  const countEl = document.getElementById('attendance-log-count');
  if (!container) return;

  const todayKey = getTodayKey();
  const todayLogs = state.attendanceLogs.filter(l => l.dateKey === todayKey);
  
  if (countEl) countEl.textContent = `${todayLogs.length} Check-ins Today`;

  if (todayLogs.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-neutral-500 py-6">No check-ins recorded today yet.</div>`;
    return;
  }

  container.innerHTML = todayLogs.map((log) => {
    const isLate = log.status === 'late';
    return `
      <div class="py-2.5 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 truncate">
          <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">
            ${log.userDisplayName ? log.userDisplayName.charAt(0).toUpperCase() : 'M'}
          </div>
          <div class="truncate">
            <div class="font-bold text-white truncate">${log.userDisplayName}</div>
            <div class="text-[10px] text-neutral-400 font-mono">${log.sessionTitle || 'Service'} • ${new Date(log.checkInTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div class="text-right flex-shrink-0">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isLate ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${isLate ? `Late (-${log.penaltyPointsApplied} pts)` : 'On Time (+10 pts)'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// 3. Render Gamified Leaderboard
function renderLeaderboard() {
  const fullList = document.getElementById('leaderboard-full-list');
  if (!fullList) return;

  // Aggregate user points from members and submissions
  const memberPointsMap = new Map();
  const memberTasksMap = new Map();

  // Populate from known members
  state.members.forEach((m) => {
    memberPointsMap.set(m.uid, {
      uid: m.uid,
      displayName: m.displayName || 'Member',
      photoURL: m.photoURL || './image_ad59c0.jpg',
      points: m.points || 0,
      completionsCount: 0
    });
  });

  // Aggregate submissions
  state.submissions.forEach((sub) => {
    const existing = memberPointsMap.get(sub.userId) || {
      uid: sub.userId,
      displayName: sub.userDisplayName || 'Team Member',
      photoURL: sub.userPhotoURL || './image_ad59c0.jpg',
      points: 0,
      completionsCount: 0
    };
    existing.completionsCount += 1;
    // ensure points include pointsEarned if member record was not yet synchronized
    if (!memberPointsMap.has(sub.userId)) {
      existing.points += (sub.pointsEarned || 0);
    }
    memberPointsMap.set(sub.userId, existing);
  });

  // Ensure current user is in map
  if (state.user && !memberPointsMap.has(state.user.uid)) {
    memberPointsMap.set(state.user.uid, {
      uid: state.user.uid,
      displayName: state.user.displayName,
      photoURL: state.user.photoURL || './image_ad59c0.jpg',
      points: state.user.points || 0,
      completionsCount: state.submissions.filter(s => s.userId === state.user.uid).length
    });
  }

  // Sort by points descending
  const ranked = Array.from(memberPointsMap.values())
    .filter(m => m.points > 0 || m.completionsCount > 0) // EXCLUDE ZERO POINT MEMBERS FROM TOP RANKINGS
    .sort((a, b) => b.points - a.points);

  // Update Top 3 Podium
  const p1 = ranked[0];
  const p2 = ranked[1];
  const p3 = ranked[2];

  if (p1) {
    document.getElementById('podium-1-name').textContent = p1.displayName;
    document.getElementById('podium-1-pts').textContent = `${p1.points} pts`;
    document.getElementById('podium-1-tasks').textContent = `${p1.completionsCount} quotas`;
    document.getElementById('podium-1-img').src = p1.photoURL || './image_ad59c0.jpg';
  }
  if (p2) {
    document.getElementById('podium-2-name').textContent = p2.displayName;
    document.getElementById('podium-2-pts').textContent = `${p2.points} pts`;
    document.getElementById('podium-2-tasks').textContent = `${p2.completionsCount} quotas`;
    document.getElementById('podium-2-img').src = p2.photoURL || './image_ad59c0.jpg';
  }
  if (p3) {
    document.getElementById('podium-3-name').textContent = p3.displayName;
    document.getElementById('podium-3-pts').textContent = `${p3.points} pts`;
    document.getElementById('podium-3-tasks').textContent = `${p3.completionsCount} quotas`;
    document.getElementById('podium-3-img').src = p3.photoURL || './image_ad59c0.jpg';
  }

  if (ranked.length === 0) {
    fullList.innerHTML = `<div class="text-center text-xs text-neutral-400 py-8">No active scores recorded yet. Complete tasks to claim rank #1!</div>`;
    return;
  }

  fullList.innerHTML = ranked.map((m, index) => {
    const rank = index + 1;
    const isMe = m.uid === state.user?.uid;
    const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    return `
      <div class="py-3 px-3 rounded-xl flex items-center justify-between gap-3 transition ${isMe ? 'bg-[#0A84FF]/10 border border-[#0A84FF]/30' : 'hover:bg-white/[0.02]'}">
        <div class="flex items-center gap-3">
          <span class="w-7 text-center font-bold font-mono text-sm ${rank <= 3 ? 'text-lg' : 'text-neutral-400'}">${rankBadge}</span>
          <img src="${m.photoURL || './image_ad59c0.jpg'}" alt="${m.displayName}" class="w-8 h-8 rounded-full object-cover border border-white/20" onerror="this.src='./image_ad59c0.jpg'" />
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-1.5">
              <span>${m.displayName}</span>
              ${isMe ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-[#0A84FF] text-white">YOU</span>` : ''}
            </div>
            <div class="text-[10px] text-neutral-400 font-mono">${m.completionsCount} tasks completed</div>
          </div>
        </div>

        <div class="text-right">
          <span class="text-xs sm:text-sm font-extrabold font-mono text-[#F59E0B]">${m.points} pts</span>
        </div>
      </div>
    `;
  }).join('');
}

// 4. Render Notifications View
function renderNotifications() {
  const container = document.getElementById('notifications-list');
  const badge = document.getElementById('header-unread-badge');
  const dot = document.getElementById('tab-unread-dot');
  if (!container) return;

  const unreadCount = state.notifications.filter(n => !n.read).length;
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (dot) {
    if (unreadCount > 0) dot.classList.remove('hidden');
    else dot.classList.add('hidden');
  }

  if (state.notifications.length === 0) {
    container.innerHTML = `<div class="p-8 text-center glass-card rounded-2xl text-xs text-neutral-500">No new announcements or alerts at this time.</div>`;
    return;
  }

  container.innerHTML = state.notifications.map((n) => {
    return `
      <div class="glass-card rounded-2xl p-4 flex items-start justify-between gap-3 border ${n.read ? 'border-white/5 opacity-80' : 'border-[#0A84FF]/30'}">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full bg-[#0A84FF]/10 text-[#0A84FF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <i data-lucide="bell" class="w-4 h-4"></i>
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-white">${n.title}</h4>
            <p class="text-xs text-neutral-300 mt-0.5 leading-relaxed">${n.body}</p>
            <div class="text-[10px] text-neutral-500 font-mono mt-1.5">${formatRelativeTime(n.createdAt)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

// 5. Render Profile Submissions History
function renderProfileHistory() {
  const container = document.getElementById('profile-history-list');
  if (!container) return;

  const mySubs = state.submissions.filter(s => s.userId === state.user?.uid);
  mySubs.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const countEl = document.getElementById('prof-stat-completed');
  if (countEl) countEl.textContent = mySubs.length;

  if (mySubs.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-neutral-500 py-6">You haven't submitted any tasks yet. Head over to the Tasks tab to get started!</div>`;
    return;
  }

  container.innerHTML = mySubs.map((sub) => {
    return `
      <div class="py-2.5 flex items-center justify-between gap-3 text-xs">
        <div>
          <div class="font-bold text-white">${sub.taskTitle}</div>
          <div class="text-[10px] text-neutral-400 font-mono">${formatRelativeTime(sub.completedAt)} • ${sub.actualDurationMinutes || 30} mins spent</div>
          ${sub.comment ? `<div class="text-[11px] text-neutral-300 italic mt-0.5">"${sub.comment}"</div>` : ''}
        </div>
        <div class="text-right flex-shrink-0">
          <span class="font-mono font-bold text-[#F59E0B] text-xs">+${sub.pointsEarned} pts</span>
        </div>
      </div>
    `;
  }).join('');
}

// 6. Admin Panel Renderers
function renderAdminTasks() {
  const tbody = document.getElementById('admin-tasks-tbody');
  const catSelect = document.getElementById('select-task-category');
  if (catSelect) {
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${state.lang === 'ar' ? c.nameAr : c.nameEn}</option>`).join('');
  }

  if (!tbody) return;
  tbody.innerHTML = state.tasks.map((t) => {
    return `
      <tr class="hover:bg-white/[0.02]">
        <td class="p-3 font-semibold text-white">${t.title}</td>
        <td class="p-3 text-neutral-400 font-mono">${t.categoryId}</td>
        <td class="p-3 text-[#F59E0B] font-mono font-bold">+${t.points}</td>
        <td class="p-3 text-neutral-300">${t.quotaType || 'daily'}</td>
        <td class="p-3 text-right">
          <button class="btn-admin-delete-task text-rose-400 hover:text-white p-1" data-taskid="${t.id}" title="Delete Task">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-admin-delete-task').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = btn.getAttribute('data-taskid');
      if (confirm("Are you sure you want to permanently delete this task?")) {
        if (db) {
          await deleteDoc(doc(db, 'tasks', taskId));
        } else {
          state.tasks = state.tasks.filter(t => t.id !== taskId);
          renderTasks();
          renderAdminTasks();
        }
      }
    });
  });

  refreshIcons();
}

function renderAdminSessions() {
  const list = document.getElementById('admin-sessions-list');
  if (!list) return;
  list.innerHTML = state.attendanceSessions.map((s) => {
    return `
      <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
        <div>
          <div class="font-bold text-white">${s.title}</div>
          <div class="text-[10px] text-neutral-400 font-mono">Time: ${s.exactStartTime} - ${s.checkInWindowEnd} | Grace: ${s.gracePeriodMinutes}m | Penalty: -${s.penaltyRatePerUnit} pts</div>
        </div>
        <button class="btn-admin-delete-session text-rose-400 hover:text-white p-1" data-sessid="${s.id}">
          <i data-lucide="trash" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.btn-admin-delete-session').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sessId = btn.getAttribute('data-sessid');
      if (confirm("Delete this session?")) {
        if (db) {
          await deleteDoc(doc(db, 'attendance_sessions', sessId));
        } else {
          state.attendanceSessions = state.attendanceSessions.filter(s => s.id !== sessId);
          renderAttendance();
          renderAdminSessions();
        }
      }
    });
  });
  refreshIcons();
}

function renderAdminMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.members.map((m) => {
    return `
      <tr class="hover:bg-white/[0.02]">
        <td class="p-3">
          <div class="flex items-center gap-2">
            <img src="${m.photoURL || './image_ad59c0.jpg'}" class="w-6 h-6 rounded-full object-cover" />
            <span class="font-bold text-white">${m.displayName}</span>
          </div>
        </td>
        <td class="p-3 font-mono text-[11px] uppercase">${m.role || 'member'}</td>
        <td class="p-3 font-mono font-bold text-[#F59E0B]">${m.points || 0}</td>
        <td class="p-3 font-mono text-rose-400">-${m.totalPenalties || 0}</td>
        <td class="p-3 text-right">
          <button class="btn-adjust-points px-2 py-1 rounded bg-[#0A84FF]/20 text-[#0A84FF] hover:bg-[#0A84FF]/40 font-mono text-[11px]" data-uid="${m.uid}">+25 pts</button>
          <button class="btn-deduct-points px-2 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 font-mono text-[11px] ml-1" data-uid="${m.uid}">-25 pts</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-adjust-points').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      if (db) await updateDoc(doc(db, 'users', uid), { points: increment(25) });
    });
  });

  tbody.querySelectorAll('.btn-deduct-points').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid');
      if (db) await updateDoc(doc(db, 'users', uid), { points: increment(-25) });
    });
  });
}

/* ==========================================================================
   11. ACTIONS & MODAL CONTROLLERS
   ========================================================================== */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    refreshIcons();
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.fixed.z-50').forEach(m => m.classList.add('hidden'));
}

function openSubmitModal(task) {
  document.getElementById('submit-task-id').value = task.id;
  document.getElementById('submit-modal-title').textContent = task.title;
  document.getElementById('submit-modal-points').textContent = `+${task.points} pts`;
  document.getElementById('submit-modal-category').textContent = task.categoryId;

  const qBox = document.getElementById('submit-question-box');
  const qLabel = document.getElementById('submit-question-label');
  if (task.enableQuestion && task.questionPrompt) {
    qLabel.textContent = task.questionPrompt;
    qBox.classList.remove('hidden');
  } else {
    qBox.classList.add('hidden');
  }

  openModal('modal-task-submit');
}

function openCompetitionModal(task) {
  const titleEl = document.getElementById('comp-modal-title');
  const listEl = document.getElementById('comp-modal-list');
  if (titleEl) titleEl.textContent = task.title;

  const taskSubs = state.submissions.filter(s => s.taskId === task.id);
  if (taskSubs.length === 0) {
    listEl.innerHTML = `<div class="text-center text-xs text-neutral-500 py-8">Be the first to complete this task and earn ${task.points} points!</div>`;
  } else {
    listEl.innerHTML = taskSubs.map(s => `
      <div class="py-3 flex items-start gap-3">
        <img src="${s.userPhotoURL || './image_ad59c0.jpg'}" class="w-8 h-8 rounded-full object-cover border border-white/10" />
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">${s.userDisplayName}</span>
            <span class="text-[10px] font-mono text-[#F59E0B] font-bold">+${s.pointsEarned} pts</span>
          </div>
          <div class="text-[10px] text-neutral-400 font-mono">${formatRelativeTime(s.completedAt)}</div>
          ${s.questionAnswer ? `<div class="mt-1 text-xs text-neutral-200 bg-white/5 p-2 rounded-lg font-mono">${s.questionAnswer}</div>` : ''}
          ${s.comment ? `<div class="mt-1 text-xs text-neutral-400 italic">"${s.comment}"</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  openModal('modal-task-competition');
}

async function performCheckIn(session) {
  if (!state.user) {
    openModal('modal-auth');
    return;
  }

  const now = new Date();
  const [startH, startM] = (session.exactStartTime || '09:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let status = 'on_time';
  let lateMinutes = 0;
  let penaltyPoints = 0;
  let bonusPoints = 10;

  if (nowMinutes > startMinutes + (session.gracePeriodMinutes || 10)) {
    status = 'late';
    lateMinutes = nowMinutes - startMinutes;
    const penaltyUnit = session.penaltyUnitMinutes || 5;
    const penaltyRate = session.penaltyRatePerUnit || 5;
    const units = Math.ceil((lateMinutes - (session.gracePeriodMinutes || 10)) / penaltyUnit);
    penaltyPoints = Math.min(units * penaltyRate, session.maxPenaltyCap || 50);
    bonusPoints = 0;
  }

  const logEntry = {
    sessionId: session.id,
    sessionTitle: session.title,
    userId: state.user.uid,
    userDisplayName: state.user.displayName,
    checkInTimestamp: now.toISOString(),
    dateKey: getTodayKey(),
    status,
    lateMinutes,
    penaltyPointsApplied: penaltyPoints,
    bonusPointsApplied: bonusPoints
  };

  try {
    if (db) {
      await addDoc(collection(db, 'attendance_logs'), logEntry);
      const pointsDiff = bonusPoints - penaltyPoints;
      await updateDoc(doc(db, 'users', state.user.uid), {
        points: increment(pointsDiff),
        totalPenalties: increment(penaltyPoints)
      });
    } else {
      state.attendanceLogs.unshift({ id: `log_${Date.now()}`, ...logEntry });
      state.user.points = (state.user.points || 0) + bonusPoints - penaltyPoints;
      state.user.totalPenalties = (state.user.totalPenalties || 0) + penaltyPoints;
      updateUserUI();
    }

    triggerConfetti();
    renderAttendance();
  } catch (err) {
    console.error("Check in error:", err);
    alert("Could not record check in: " + err.message);
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.className = 'tab-btn flex-1 min-w-[76px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 text-white bg-white/[0.12] shadow-sm';
    } else {
      btn.className = 'tab-btn flex-1 min-w-[76px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.05]';
    }
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    if (view.id === `view-${tabId}`) {
      view.classList.remove('hidden');
      view.classList.add('block');
    } else {
      view.classList.add('hidden');
      view.classList.remove('block');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshIcons();
}

/* ==========================================================================
   12. EVENT LISTENERS SETUP
   ========================================================================== */
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Language Switch
  document.getElementById('btn-toggle-lang')?.addEventListener('click', () => {
    applyLanguage(state.lang === 'en' ? 'ar' : 'en');
  });

  // Notifications Bell
  document.getElementById('btn-open-notifications')?.addEventListener('click', () => {
    switchTab('notifications');
  });

  // Announcement close
  document.getElementById('btn-close-announcement')?.addEventListener('click', () => {
    document.getElementById('announcement-bar')?.classList.add('hidden');
  });

  // Modal Closers
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Auth Modal trigger
  document.getElementById('btn-open-auth-modal')?.addEventListener('click', () => {
    openModal('modal-auth');
  });

  // Google Sign In trigger
  document.getElementById('btn-auth-google')?.addEventListener('click', handleGoogleSignIn);

  // Local Name Sign In form
  document.getElementById('form-auth-local')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-local-name').value.trim();
    if (name) {
      state.user = {
        uid: 'user_' + Math.random().toString(36).substring(2, 9),
        displayName: name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@cocmedia.local`,
        photoURL: './image_ad59c0.jpg',
        points: 0,
        totalPenalties: 0,
        role: 'member',
        createdAt: new Date().toISOString(),
        isActive: true,
        streakDays: 1
      };
      localStorage.setItem('coc_guest_user', JSON.stringify(state.user));
      updateUserUI();
      closeAllModals();
      triggerConfetti();
    }
  });

  // Copy hostname button in Unauthorized Domain Modal
  document.getElementById('btn-copy-hostname')?.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.hostname);
    const btn = document.getElementById('btn-copy-hostname');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }
  });

  // Fallback guest button in Unauthorized Domain Modal
  document.getElementById('btn-fallback-guest')?.addEventListener('click', () => {
    closeModal('modal-unauthorized-domain');
    openModal('modal-auth');
  });

  // Admin Portal Lock
  document.getElementById('btn-open-admin-lock')?.addEventListener('click', () => {
    if (state.isAdminUnlocked) {
      openModal('modal-admin-dashboard');
    } else {
      openModal('modal-admin-auth');
    }
  });

  // Admin Password submit
  document.getElementById('form-admin-auth')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('input-admin-password').value;
    const errEl = document.getElementById('admin-auth-error');
    if (pass === ADMIN_MASTER_PASSWORD) {
      state.isAdminUnlocked = true;
      closeModal('modal-admin-auth');
      openModal('modal-admin-dashboard');
      if (errEl) errEl.classList.add('hidden');
    } else {
      if (errEl) errEl.classList.remove('hidden');
    }
  });

  // Admin Dashboard Tabs
  document.querySelectorAll('.admintab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-admintab');
      document.querySelectorAll('.admintab-btn').forEach(b => {
        b.className = 'admintab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white whitespace-nowrap';
      });
      btn.className = 'admintab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 whitespace-nowrap';

      document.querySelectorAll('.admin-panel').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('block');
      });
      const target = document.getElementById(`admin-panel-${tab}`);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('block');
      }
      refreshIcons();
    });
  });

  // Admin Task Form Toggle
  document.getElementById('btn-admin-add-task')?.addEventListener('click', () => {
    document.getElementById('admin-task-form-container')?.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-task-form')?.addEventListener('click', () => {
    document.getElementById('admin-task-form-container')?.classList.add('hidden');
  });

  // Admin Task Form Submit
  document.getElementById('form-manage-task')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTask = {
      title: document.getElementById('input-task-title').value.trim(),
      description: document.getElementById('input-task-desc').value.trim(),
      categoryId: document.getElementById('select-task-category').value,
      points: Number(document.getElementById('input-task-points').value) || 50,
      quotaType: document.getElementById('select-task-quota').value,
      taskLink: document.getElementById('input-task-link').value.trim(),
      estimatedDuration: document.getElementById('input-task-duration').value.trim(),
      deadlineType: document.getElementById('select-task-deadline').value,
      enableComment: document.getElementById('check-enable-comment').checked,
      enableQuestion: document.getElementById('check-enable-question').checked,
      questionPrompt: document.getElementById('input-question-prompt').value.trim(),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      if (db) {
        await addDoc(collection(db, 'tasks'), newTask);
      } else {
        state.tasks.unshift({ id: `task_${Date.now()}`, ...newTask });
        renderTasks();
        renderAdminTasks();
      }
      document.getElementById('form-manage-task').reset();
      document.getElementById('admin-task-form-container').classList.add('hidden');
      alert("Task created successfully!");
    } catch (err) {
      alert("Error saving task: " + err.message);
    }
  });

  // Submit Task Form
  document.getElementById('form-submit-task')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = document.getElementById('submit-task-id').value;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!state.user) {
      openModal('modal-auth');
      return;
    }

    const comment = document.getElementById('input-submit-comment').value.trim();
    const answer = document.getElementById('input-submit-answer').value.trim();
    const duration = Number(document.getElementById('input-submit-minutes').value) || 30;

    const submission = {
      taskId: task.id,
      taskTitle: task.title,
      userId: state.user.uid,
      userDisplayName: state.user.displayName,
      userPhotoURL: state.user.photoURL || './image_ad59c0.jpg',
      categoryId: task.categoryId,
      pointsEarned: task.points,
      comment,
      questionAnswer: answer,
      actualDurationMinutes: duration,
      completedAt: new Date().toISOString(),
      dateKey: getTodayKey()
    };

    try {
      if (db) {
        await addDoc(collection(db, 'submissions'), submission);
        await updateDoc(doc(db, 'users', state.user.uid), {
          points: increment(task.points)
        });
      } else {
        state.submissions.unshift({ id: `sub_${Date.now()}`, ...submission });
        state.user.points = (state.user.points || 0) + task.points;
        updateUserUI();
      }

      closeModal('modal-task-submit');
      document.getElementById('form-submit-task').reset();
      triggerConfetti();
      renderTasks();
      renderLeaderboard();
      renderProfileHistory();
    } catch (err) {
      alert("Submission error: " + err.message);
    }
  });

  // Task Search & Filters
  document.getElementById('input-search-tasks')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTasks();
  });

  document.getElementById('select-status-filter')?.addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    renderTasks();
  });

  // Admin Announcement Publish
  document.getElementById('form-admin-announcement')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const en = document.getElementById('input-announcement-en').value.trim();
    const ar = document.getElementById('input-announcement-ar').value.trim();
    state.settings.announcementEn = en;
    state.settings.announcementAr = ar;

    if (db) {
      await setDoc(doc(db, 'settings', 'app_config'), state.settings, { merge: true });
    }
    updateAnnouncementUI();
    alert("Announcement published!");
  });

  // Admin Settings Submit (Logo URL override & Branding)
  document.getElementById('form-admin-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.settings.appName = document.getElementById('input-settings-appname').value.trim();
    state.settings.logoUrl = document.getElementById('input-settings-logourl').value.trim() || './image_ad59c0.jpg';
    state.settings.subtitleEn = document.getElementById('input-settings-sub-en').value.trim();
    state.settings.subtitleAr = document.getElementById('input-settings-sub-ar').value.trim();
    state.settings.developerCredit = document.getElementById('input-settings-devcredit').value.trim();

    if (db) {
      await setDoc(doc(db, 'settings', 'app_config'), state.settings, { merge: true });
    }
    applyBrandingSettings();
    alert("Branding settings updated!");
  });

  // Reset logo button
  document.getElementById('btn-reset-logo')?.addEventListener('click', () => {
    document.getElementById('input-settings-logourl').value = './image_ad59c0.jpg';
  });

  // Sign out button
  document.getElementById('btn-user-signout')?.addEventListener('click', async () => {
    if (confirm("Sign out from your account?")) {
      if (auth) await signOut(auth);
      localStorage.removeItem('coc_guest_user');
      window.location.reload();
    }
  });

  // Edit display name
  document.getElementById('btn-edit-display-name')?.addEventListener('click', async () => {
    const newName = prompt("Enter new display name:", state.user?.displayName || '');
    if (newName && newName.trim().length > 0) {
      state.user.displayName = newName.trim();
      if (db && state.user.uid && !state.user.uid.startsWith('guest_')) {
        await updateDoc(doc(db, 'users', state.user.uid), { displayName: newName.trim() });
      } else {
        localStorage.setItem('coc_guest_user', JSON.stringify(state.user));
      }
      updateUserUI();
    }
  });

  // Push Notifications Permission Request
  document.getElementById('btn-request-push')?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert("Notifications are not supported in this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      alert("Push notifications enabled for COC Media Team!");
    } else {
      alert("Notification permission denied or dismissed.");
    }
  });

  // PWA Install prompt listener
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.onclick = async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtn.classList.add('hidden');
        }
      };
    }
  });
}

/* ==========================================================================
   13. LIVE CLOCK TICKER
   ========================================================================== */
function startLiveClock() {
  function tick() {
    const now = new Date();
    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ==========================================================================
   14. APPLICATION BOOTSTRAP
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  try {
    startLiveClock();
    setupEventListeners();
    applyLanguage(state.lang);
    initAuth();
    initDataSubscriptions();
  } catch (err) {
    console.error("Initialization error:", err);
  } finally {
    // Failsafe loader dismissal
    setTimeout(hideLoader, 1500);
  }
});
