/**
 * COC Media Team - v1.0.4
 * Production Task, Quota, Attendance & Gamification Platform
 * Designed & Developed by Steven Mario
 * GitHub Pages Compatible (Vanilla JS + Firebase Modular CDN)
 */

// 1. CAPTURE PWA INSTALL PROMPT GLOBALLY AT TOP
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.deferredPrompt = e;
  console.log('PWA beforeinstallprompt captured successfully');
});

// 2. FIREBASE CDN MODULAR IMPORTS
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
  serverTimestamp, 
  increment 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

/* ==========================================================================
   FIREBASE CONFIGURATION
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

// SECURE ADMINISTRATIVE MASTER PASSWORD (VALIDATED ONLY IN JS LOGIC)
const ADMIN_MASTER_PASSWORD = '$J@@s#COC1982';

/* ==========================================================================
   GLOBAL APPLICATION STATE
   ========================================================================== */
const state = {
  lang: localStorage.getItem('coc_lang') || 'en',
  user: null, // null = Guest Mode, or { uid, displayName, email, photoURL, points, totalPenalties, isAdmin, role, streakDays }
  isAdminUnlocked: false,
  activeTab: 'tasks',
  tasks: [],
  categories: [
    { id: 'video', nameEn: 'Video Editing', nameAr: 'مونتاج الفيديو', color: '#0A84FF', icon: 'film' },
    { id: 'social', nameEn: 'Social Media', nameAr: 'سوشيال ميديا', color: '#EC4899', icon: 'share-2' },
    { id: 'stream', nameEn: 'Live Streaming', nameAr: 'البث المباشر', color: '#10B981', icon: 'radio' },
    { id: 'design', nameEn: 'Graphic Design', nameAr: 'تصميم جرافيك', color: '#F59E0B', icon: 'palette' },
    { id: 'sound', nameEn: 'Sound Engineering', nameAr: 'هندسة الصوت', color: '#8B5CF6', icon: 'mic-2' },
    { id: 'photo', nameEn: 'Photography', nameAr: 'التصوير الفوتوغرافي', color: '#06B6D4', icon: 'camera' }
  ],
  attendanceSessions: [],
  attendanceLogs: [],
  submissions: [],
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
    developerCredit: 'Designed & Developed by Steven Mario',
    version: 'v1.0.4'
  }
};

/* ==========================================================================
   I18N DICTIONARY
   ========================================================================== */
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
    task_completed: 'Completed',
    check_in_now: 'Check In Now',
    checked_in: 'Checked In',
    on_time: 'On Time',
    late: 'Late',
    guest_mode_notice: 'You need to sign in first to perform this action.'
  },
  ar: {
    nav_tasks: 'المهام',
    nav_attendance: 'الحضور',
    nav_leaderboard: 'المتصدرين',
    nav_notifications: 'التحديثات',
    nav_profile: 'حسابي',
    stat_active_tasks: 'المهام النشطة',
    stat_completed_today: 'المنجز اليوم',
    stat_my_points: 'نقاطي',
    empty_tasks_title: 'لا توجد مهام نشطة',
    empty_tasks_desc: 'لا توجد مهام مطابقة للفلتر المحدد حالياً. تحقق لاحقاً أو غيّر الفلتر.',
    attendance_engine_live: 'محرك الحضور المباشر',
    attendance_status_label: 'حالة حضورك اليوم:',
    scheduled_sessions: 'الجلسات المجدولة',
    today_attendance_log: 'سجل حضور اليوم',
    leaderboard_title: 'لوحة الشرف والمتصدرين',
    leaderboard_sub: 'الترتيب مبني على الكوتا المكتملة والنقاط الموثقة.',
    all_team_rankings: 'ترتيب الفريق بالكامل',
    notifications_title: 'إعلانات وتنبيهات الفريق',
    notifications_sub: 'تحديثات مباشرة، إسناد المهام وإعلانات النقاط.',
    sign_in: 'تسجيل الدخول',
    complete_task: 'إنجاز المهمة',
    task_completed: 'مكتملة',
    check_in_now: 'تسجيل الحضور الآن',
    checked_in: 'تم تسجيل الحضور',
    on_time: 'في الموعد',
    late: 'متأخر',
    guest_mode_notice: 'عليك تسجيل الدخول أولاً للقيام بهذا الإجراء.'
  }
};

/* ==========================================================================
   GLOBAL TOAST NOTIFICATION SYSTEM (APPLE-STYLE TOP PILL)
   ========================================================================== */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const toastTypeClass = type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : 'toast-info');
  toast.className = `toast ${toastTypeClass}`;
  
  let iconName = 'info';
  let iconColor = 'text-[#0A84FF]';
  if (type === 'success') {
    iconName = 'check-circle-2';
    iconColor = 'text-[#30D158]';
  } else if (type === 'error') {
    iconName = 'alert-circle';
    iconColor = 'text-[#FF453A]';
  }

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} flex-shrink-0"></i>
    <span class="flex-1">${escapeHtml(message)}</span>
  `;

  // Dismiss on click
  toast.onclick = () => dismissToast(toast);

  container.appendChild(toast);
  refreshIcons();

  // Dynamic duration based on string length (3 to 5 seconds)
  const duration = Math.min(5000, Math.max(3000, message.length * 60));

  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast._timeoutId = timeoutId;
}

function dismissToast(toastEl) {
  if (!toastEl || toastEl._isDismissed) return;
  toastEl._isDismissed = true;
  if (toastEl._timeoutId) clearTimeout(toastEl._timeoutId);
  toastEl.classList.add('toast-hiding');
  setTimeout(() => {
    toastEl.remove();
  }, 300);
}

/* ==========================================================================
   CUSTOM APPLE-STYLE DIALOGS (ZERO NATIVE ALERTS)
   ========================================================================== */
export function showCustomAlert(title, message, options = {}) {
  const modal = document.getElementById('modal-custom-alert');
  const titleEl = document.getElementById('custom-alert-title');
  const msgEl = document.getElementById('custom-alert-message');
  const okBtn = document.getElementById('btn-custom-alert-ok');
  const actionBtn = document.getElementById('btn-custom-alert-action');
  const actionLabel = document.getElementById('btn-custom-alert-action-label');
  const icon = document.getElementById('custom-alert-icon');
  const iconBox = document.getElementById('custom-alert-icon-box');

  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent = message;

  if (options.type === 'error') {
    iconBox.className = 'w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400';
    icon.setAttribute('data-lucide', 'alert-circle');
  } else if (options.type === 'success') {
    iconBox.className = 'w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400';
    icon.setAttribute('data-lucide', 'check-circle-2');
  } else {
    iconBox.className = 'w-14 h-14 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 flex items-center justify-center mx-auto text-[#0A84FF]';
    icon.setAttribute('data-lucide', 'info');
  }

  if (options.actionLabel && typeof options.onAction === 'function') {
    actionBtn.classList.remove('hidden');
    actionLabel.textContent = options.actionLabel;
    actionBtn.onclick = () => {
      modal.classList.add('hidden');
      options.onAction();
    };
  } else {
    actionBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  refreshIcons();

  return new Promise((resolve) => {
    okBtn.onclick = () => {
      modal.classList.add('hidden');
      resolve(true);
    };
  });
}

export function showCustomConfirm(title, message) {
  const modal = document.getElementById('modal-custom-confirm');
  const titleEl = document.getElementById('custom-confirm-title');
  const msgEl = document.getElementById('custom-confirm-message');
  const okBtn = document.getElementById('btn-custom-confirm-ok');
  const cancelBtn = document.getElementById('btn-custom-confirm-cancel');

  if (!modal) return Promise.resolve(false);

  titleEl.textContent = title;
  msgEl.textContent = message;
  modal.classList.remove('hidden');
  refreshIcons();

  return new Promise((resolve) => {
    okBtn.onclick = () => {
      modal.classList.add('hidden');
      resolve(true);
    };
    cancelBtn.onclick = () => {
      modal.classList.add('hidden');
      resolve(false);
    };
  });
}

export function showCustomPrompt(title, message, defaultValue = '') {
  const modal = document.getElementById('modal-custom-prompt');
  const titleEl = document.getElementById('custom-prompt-title');
  const msgEl = document.getElementById('custom-prompt-message');
  const input = document.getElementById('input-custom-prompt');
  const form = document.getElementById('form-custom-prompt');
  const cancelBtn = document.getElementById('btn-custom-prompt-cancel');
  const errEl = document.getElementById('custom-prompt-error');

  if (!modal) return Promise.resolve(null);

  titleEl.textContent = title;
  msgEl.textContent = message;
  input.value = defaultValue;
  errEl.classList.add('hidden');
  modal.classList.remove('hidden');
  input.focus();
  refreshIcons();

  return new Promise((resolve) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const val = input.value;
      modal.classList.add('hidden');
      resolve(val);
    };
    cancelBtn.onclick = () => {
      modal.classList.add('hidden');
      resolve(null);
    };
  });
}

/* ==========================================================================
   SIDE DRAWER CONTROLLER (NEVER STICKS)
   ========================================================================== */
function openDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('drawer-open');
    backdrop.classList.add('drawer-open');
  }
}

function closeDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('drawer-open');
    backdrop.classList.remove('drawer-open');
  }
}

/* ==========================================================================
   AUTH & GUEST MODE CONTROLLER
   ========================================================================== */
function requireAuth(actionCallback) {
  if (state.user) {
    actionCallback(state.user);
    return true;
  }
  showToast('Please sign in first to perform this action.', 'error');
  showCustomAlert(
    'Sign In Required',
    'You need to sign in first to perform this action. You can browse tasks and leaderboard in Read-Only Guest Mode.',
    {
      actionLabel: 'Sign In with Google',
      onAction: () => handleGoogleSignIn()
    }
  );
  return false;
}

async function handleGoogleSignIn() {
  if (!auth || !googleProvider) {
    showToast('Authentication service is initializing. Please try again.', 'error');
    return;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;
    await syncUserRecord(u);
    closeDrawer();
    showToast(`Welcome back, ${u.displayName}!`, 'success');
    checkRouteGuard();
  } catch (error) {
    console.error('Google sign in error:', error);
    if (error.code === 'auth/unauthorized-domain') {
      const modal = document.getElementById('modal-unauthorized-domain');
      const hostLabel = document.getElementById('current-hostname-label');
      if (hostLabel) hostLabel.textContent = window.location.hostname;
      if (modal) modal.classList.remove('hidden');
      showToast('Domain authorization required in Firebase Console.', 'error');
    } else if (error.code !== 'auth/popup-closed-by-user') {
      showToast(error.message || 'Could not complete Google Sign-In.', 'error');
    }
  }
}

async function syncUserRecord(firebaseUser) {
  if (!db || !firebaseUser) return;
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      state.user = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || data.displayName || 'Member',
        email: firebaseUser.email || data.email || '',
        photoURL: firebaseUser.photoURL || data.photoURL || './image_ad59c0.jpg',
        points: data.points || 0,
        totalPenalties: data.totalPenalties || 0,
        isAdmin: data.isAdmin || false,
        role: data.role || (data.isAdmin ? 'admin' : 'member'),
        streakDays: data.streakDays || 1
      };
      if (data.isAdmin) {
        state.isAdminUnlocked = true;
      }
    } else {
      const newUser = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Team Member',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || './image_ad59c0.jpg',
        points: 0,
        totalPenalties: 0,
        isAdmin: false,
        role: 'member',
        streakDays: 1,
        createdAt: serverTimestamp()
      };
      await setDoc(userRef, newUser);
      state.user = newUser;
    }
    updateProfileUI();
  } catch (err) {
    console.warn('Sync user record offline/error:', err);
    state.user = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || 'Team Member',
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || './image_ad59c0.jpg',
      points: 0,
      totalPenalties: 0,
      isAdmin: false,
      role: 'member',
      streakDays: 1
    };
    updateProfileUI();
  }
}

async function handleSignOut() {
  const confirmed = await showCustomConfirm('Sign Out', 'Are you sure you want to sign out and return to Guest Mode?');
  if (!confirmed) return;
  try {
    if (auth) await signOut(auth);
    state.user = null;
    state.isAdminUnlocked = false;
    updateProfileUI();
    closeDrawer();
    // Close admin dashboard if open
    document.getElementById('modal-admin-dashboard')?.classList.add('hidden');
    if (window.location.hash === '#admin' || window.location.hash === '#admin-dashboard') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    showToast('Signed out successfully. You are now in Guest Mode.', 'info');
  } catch (err) {
    console.error('Sign out error:', err);
    showToast('Failed to sign out. Please try again.', 'error');
  }
}

/* ==========================================================================
   ADMIN AUTHENTICATION & ROUTE GUARD (FIXED EXACT FLOW)
   ========================================================================== */
function openAdminPortal() {
  closeDrawer();
  
  // a) User clicks "Admin Dashboard"
  // Must be logged in first
  if (!state.user) {
    showToast('Please sign in first to access the Admin Console.', 'error');
    const authModal = document.getElementById('modal-auth');
    if (authModal) {
      authModal.classList.remove('hidden');
    } else {
      handleGoogleSignIn();
    }
    return;
  }

  // If already authenticated as admin on this account:
  if (state.user.isAdmin || state.isAdminUnlocked) {
    window.location.hash = '#admin';
    showAdminDashboard();
    return;
  }

  // Otherwise, open the dedicated Admin Password Modal
  const modal = document.getElementById('modal-admin-auth');
  const input = document.getElementById('input-admin-password');
  const errEl = document.getElementById('admin-auth-error');

  if (errEl) errEl.classList.add('hidden');
  if (input) {
    input.value = '';
    input.placeholder = 'Enter Master Password';
  }
  if (modal) modal.classList.remove('hidden');
  if (input) input.focus();
}

async function handleAdminAuthSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('input-admin-password');
  const submitBtn = document.getElementById('btn-admin-auth-submit');
  const enteredPassword = input ? input.value : '';
  const errEl = document.getElementById('admin-auth-error');

  // b) Validate entered password against master key
  if (enteredPassword !== ADMIN_MASTER_PASSWORD) {
    // c) If FALSE: Show an error toast (Do NOT redirect)
    showToast('Invalid Master Password. Access Denied.', 'error');
    if (errEl) {
      errEl.textContent = 'Invalid Master Password. Access Denied.';
      errEl.classList.remove('hidden');
    }
    if (input) {
      input.value = '';
      input.focus();
    }
    return;
  }

  // d) If TRUE: Update users/{uid} in Firestore with isAdmin: true. AWAIT this Firestore update to finish!
  if (errEl) errEl.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="inline-block animate-spin mr-1.5">◌</span> Verifying...';
  }

  try {
    if (db && state.user && state.user.uid) {
      await updateDoc(doc(db, 'users', state.user.uid), {
        isAdmin: true,
        role: 'admin'
      });
    }
    state.user.isAdmin = true;
    state.user.role = 'admin';
    state.isAdminUnlocked = true;
    updateProfileUI();

    // e) Show a success toast ("Admin Access Granted")
    showToast('Admin Access Granted', 'success');

    // f) Close the password modal and SUCCESSFULLY render/navigate to the Admin Dashboard
    document.getElementById('modal-admin-auth')?.classList.add('hidden');
    if (input) input.value = '';

    window.location.hash = '#admin';
    showAdminDashboard();
  } catch (err) {
    console.error('Failed to update admin role in Firestore:', err);
    // Allow access for this session even if network glitch
    state.user.isAdmin = true;
    state.user.role = 'admin';
    state.isAdminUnlocked = true;
    updateProfileUI();

    showToast('Admin Access Granted', 'success');
    document.getElementById('modal-admin-auth')?.classList.add('hidden');
    if (input) input.value = '';

    window.location.hash = '#admin';
    showAdminDashboard();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Unlock Admin Console';
    }
  }
}

function showAdminDashboard() {
  const modal = document.getElementById('modal-admin-dashboard');
  if (modal) {
    modal.classList.remove('hidden');
    renderAdminTasks();
    renderAdminSessions();
    renderAdminAttendanceLogs();
    renderAdminMembers();
    renderAdminCategories();
    refreshIcons();
  }
}

// g) The Route Guard MUST recognize that the user now has isAdmin === true and ALLOW them to stay on the dashboard!
function checkRouteGuard() {
  if (window.location.hash === '#admin' || window.location.hash === '#admin-dashboard') {
    // 1. If user is logged in AND is admin: stay on the dashboard!
    if (state.user && (state.user.isAdmin || state.isAdminUnlocked)) {
      showAdminDashboard();
      return;
    }

    // 2. If user is logged in but NOT admin yet: open password modal so they can authenticate (do NOT redirect)
    if (state.user && !state.user.isAdmin) {
      const modal = document.getElementById('modal-admin-auth');
      if (modal) modal.classList.remove('hidden');
      return;
    }

    // 3. If guest / not logged in: clear hash and show prompt
    history.replaceState(null, '', window.location.pathname + window.location.search);
    showToast('Please sign in first to access the Admin Console.', 'error');
    document.getElementById('modal-auth')?.classList.remove('hidden');
  }
}

/* ==========================================================================
   REAL-TIME FIRESTORE SYNCHRONIZATION
   ========================================================================== */
function initFirestoreListeners() {
  if (!db) {
    console.warn('Firestore db not available, running in offline fallback mode.');
    return;
  }

  // 1. Categories Listener
  try {
    onSnapshot(collection(db, 'categories'), (snapshot) => {
      if (!snapshot.empty) {
        state.categories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      populateCategoryFilters();
      populateTaskCategorySelect();
      renderAdminCategories();
    }, (err) => console.warn('Categories snapshot listener:', err));
  } catch (e) { console.warn(e); }

  // 2. Tasks Listener
  try {
    onSnapshot(collection(db, 'tasks'), (snapshot) => {
      state.tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTasks();
      renderAdminTasks();
      updateHeroStats();
    }, (err) => console.warn('Tasks snapshot listener:', err));
  } catch (e) { console.warn(e); }

  // 3. Attendance Sessions Listener
  try {
    onSnapshot(collection(db, 'attendance_sessions'), (snapshot) => {
      state.attendanceSessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAttendanceView();
      renderAdminSessions();
    }, (err) => console.warn('Attendance sessions listener:', err));
  } catch (e) { console.warn(e); }

  // 4. Attendance Logs Listener
  try {
    onSnapshot(collection(db, 'attendance_logs'), (snapshot) => {
      state.attendanceLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAttendanceLogs();
      renderAdminAttendanceLogs();
    }, (err) => console.warn('Attendance logs listener:', err));
  } catch (e) { console.warn(e); }

  // 5. Submissions Listener
  try {
    onSnapshot(collection(db, 'submissions'), (snapshot) => {
      state.submissions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTasks();
      renderLeaderboard();
      updateHeroStats();
      if (state.user) renderProfileSubmissions();
    }, (err) => console.warn('Submissions snapshot listener:', err));
  } catch (e) { console.warn(e); }

  // 6. Registered Members Listener
  try {
    onSnapshot(collection(db, 'users'), (snapshot) => {
      state.members = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
      renderLeaderboard();
      renderAdminMembers();
      // Keep current user updated
      if (state.user) {
        const currentUpdated = state.members.find(m => m.uid === state.user.uid);
        if (currentUpdated) {
          state.user = { ...state.user, ...currentUpdated };
          if (currentUpdated.isAdmin) state.isAdminUnlocked = true;
          updateProfileUI();
        }
      }
    }, (err) => console.warn('Users snapshot listener:', err));
  } catch (e) { console.warn(e); }

  // 7. Notifications Listener
  try {
    onSnapshot(collection(db, 'notifications'), (snapshot) => {
      state.notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderNotifications();
    }, (err) => console.warn('Notifications snapshot listener:', err));
  } catch (e) { console.warn(e); }

  // 8. Settings Listener
  try {
    onSnapshot(doc(db, 'settings', 'app_config'), (docSnap) => {
      if (docSnap.exists()) {
        state.settings = { ...state.settings, ...docSnap.data() };
        applySettings();
      }
    }, (err) => console.warn('Settings snapshot listener:', err));
  } catch (e) { console.warn(e); }
}

/* ==========================================================================
   UI RENDERING: TASKS
   ========================================================================== */
function populateCategoryFilters() {
  const container = document.getElementById('category-filter-chips');
  if (!container) return;

  const currentSelected = state.selectedCategory;
  let html = `
    <button data-category="all" class="cat-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${currentSelected === 'all' ? 'bg-[#0A84FF] text-white shadow-sm' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}">
      ${state.lang === 'ar' ? 'جميع المهام' : 'All Tasks'}
    </button>
  `;

  state.categories.forEach(cat => {
    const isSelected = currentSelected === cat.id;
    const catName = state.lang === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn;
    html += `
      <button data-category="${cat.id}" class="cat-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${isSelected ? 'text-white shadow-sm' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}" style="${isSelected ? `background-color: ${cat.color || '#0A84FF'};` : ''}">
        ${catName}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.onclick = () => {
      state.selectedCategory = btn.dataset.category;
      populateCategoryFilters();
      renderTasks();
    };
  });
}

function populateTaskCategorySelect() {
  const select = document.getElementById('select-task-category');
  if (!select) return;
  select.innerHTML = state.categories.map(c => `
    <option value="${c.id}">${c.nameEn} / ${c.nameAr || ''}</option>
  `).join('');
}

function renderTasks() {
  const container = document.getElementById('tasks-container');
  const emptyState = document.getElementById('tasks-empty-state');
  if (!container) return;

  let filtered = state.tasks.filter(t => {
    // Category filter
    if (state.selectedCategory !== 'all' && t.category !== state.selectedCategory) return false;
    // Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    // Status filter
    if (state.statusFilter !== 'all') {
      const isCompleted = state.user && state.submissions.some(s => s.taskId === t.id && s.uid === state.user.uid);
      if (state.statusFilter === 'completed' && !isCompleted) return false;
      if (state.statusFilter === 'pending' && isCompleted) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(task => {
    const categoryObj = state.categories.find(c => c.id === task.category) || { nameEn: task.category || 'General', color: '#0A84FF' };
    const categoryName = state.lang === 'ar' && categoryObj.nameAr ? categoryObj.nameAr : categoryObj.nameEn;
    const catColor = categoryObj.color || '#0A84FF';

    const taskCompletions = state.submissions.filter(s => s.taskId === task.id);
    const userCompleted = state.user ? taskCompletions.some(s => s.uid === state.user.uid) : false;

    // Schedule / Deadline preview
    let scheduleBadge = '';
    if (task.startDateTime || task.endDateTime) {
      const endStr = task.endDateTime ? new Date(task.endDateTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      scheduleBadge = `
        <div class="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono mt-2">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-neutral-500"></i>
          <span>Deadline: ${endStr || 'No cutoff'}</span>
        </div>
      `;
    }

    return `
      <div class="glass-card rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all duration-200 relative group">
        <div>
          <!-- Card Header: Category & Points -->
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border" style="background-color: ${catColor}15; color: ${catColor}; border-color: ${catColor}35;">
              ${categoryName}
            </span>
            <span class="text-xs font-mono font-bold text-[#F59E0B] px-2 py-0.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30">
              +${task.points || 5} pts
            </span>
          </div>

          <h3 class="font-bold text-sm sm:text-base text-white group-hover:text-white/95 leading-snug">${escapeHtml(task.title)}</h3>
          <p class="text-xs text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">${escapeHtml(task.description || '')}</p>

          ${scheduleBadge}
        </div>

        <div class="pt-4 mt-3 border-t border-white/5 space-y-2">
          <!-- Completions Row -->
          <div class="flex items-center justify-between text-xs text-neutral-400">
            <button class="btn-view-task-completions hover:text-white transition flex items-center gap-1.5" data-task-id="${task.id}">
              <i data-lucide="users" class="w-3.5 h-3.5 text-[#0A84FF]"></i>
              <span>${taskCompletions.length} completions</span>
            </button>
            ${task.link ? `
              <a href="${task.link}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0A84FF] hover:underline flex items-center gap-1">
                <span>Task Link</span>
                <i data-lucide="external-link" class="w-3 h-3"></i>
              </a>
            ` : ''}
          </div>

          <!-- Action Button -->
          ${userCompleted ? `
            <button class="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-default">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>${i18n[state.lang].task_completed}</span>
            </button>
          ` : `
            <button class="btn-complete-task w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#0A84FF] hover:bg-[#0A84FF]/90 transition shadow-lg shadow-[#0A84FF]/25 flex items-center justify-center gap-1.5" data-task-id="${task.id}">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>${i18n[state.lang].complete_task}</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners for Task Cards
  container.querySelectorAll('.btn-complete-task').forEach(btn => {
    btn.onclick = () => {
      const taskId = btn.dataset.taskId;
      requireAuth(() => openSubmitTaskModal(taskId));
    };
  });

  container.querySelectorAll('.btn-view-task-completions').forEach(btn => {
    btn.onclick = () => {
      const taskId = btn.dataset.taskId;
      openTaskCompetitionModal(taskId);
    };
  });

  refreshIcons();
}

function openSubmitTaskModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const modal = document.getElementById('modal-task-submit');
  const catEl = document.getElementById('submit-modal-category');
  const titleEl = document.getElementById('submit-modal-title');
  const ptsEl = document.getElementById('submit-modal-points');
  const idInput = document.getElementById('submit-task-id');
  const questionBox = document.getElementById('submit-question-box');
  const questionLabel = document.getElementById('submit-question-label');
  const answerInput = document.getElementById('input-submit-answer');
  const commentInput = document.getElementById('input-submit-comment');

  idInput.value = task.id;
  titleEl.textContent = task.title;
  catEl.textContent = task.category || 'General';
  ptsEl.textContent = `+${task.points || 5} pts`;

  if (task.enableQuestion && task.questionPrompt) {
    questionBox.classList.remove('hidden');
    questionLabel.textContent = task.questionPrompt;
    answerInput.required = true;
  } else {
    questionBox.classList.add('hidden');
    answerInput.required = false;
  }

  commentInput.value = '';
  modal.classList.remove('hidden');
  refreshIcons();
}

async function handleTaskSubmitForm(e) {
  e.preventDefault();
  if (!state.user || !db) return;

  const taskId = document.getElementById('submit-task-id').value;
  const answer = document.getElementById('input-submit-answer').value.trim();
  const comment = document.getElementById('input-submit-comment').value.trim();
  const minutes = Number(document.getElementById('input-submit-minutes').value) || 30;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const earnedPoints = Number(task.points) || 5;

  try {
    // 1. Record submission in Firestore
    await addDoc(collection(db, 'submissions'), {
      taskId: task.id,
      taskTitle: task.title,
      taskCategory: task.category || 'General',
      uid: state.user.uid,
      userName: state.user.displayName,
      userPhoto: state.user.photoURL,
      pointsEarned: earnedPoints,
      answer: answer || '',
      comment: comment || '',
      minutesSpent: minutes,
      createdAt: serverTimestamp()
    });

    // 2. Increment user points in Firestore
    await updateDoc(doc(db, 'users', state.user.uid), {
      points: increment(earnedPoints)
    });

    // 3. Post a system notification
    await addDoc(collection(db, 'notifications'), {
      title: 'Quota Completed',
      message: `${state.user.displayName} completed "${task.title}" (+${earnedPoints} pts)`,
      type: 'reward',
      createdAt: serverTimestamp()
    });

    document.getElementById('modal-task-submit').classList.add('hidden');

    // Confetti celebration
    if (typeof confetti === 'function') {
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
    }

    showToast(`Task completed! You collected +${earnedPoints} points!`, 'success');
  } catch (err) {
    console.error('Error submitting task:', err);
    showToast('Failed to save submission. Please check connection.', 'error');
  }
}

function openTaskCompetitionModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const modal = document.getElementById('modal-task-competition');
  const titleEl = document.getElementById('comp-modal-title');
  const listEl = document.getElementById('comp-modal-list');

  titleEl.textContent = `${task.title} - Completions`;
  const completions = state.submissions.filter(s => s.taskId === task.id);

  if (completions.length === 0) {
    listEl.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400">No member has submitted this quota yet. Be the first!</div>`;
  } else {
    listEl.innerHTML = completions.map(sub => `
      <div class="py-2.5 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <img src="${sub.userPhoto || './image_ad59c0.jpg'}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-white/10" />
          <div>
            <div class="font-bold text-xs text-white">${escapeHtml(sub.userName || 'Member')}</div>
            ${sub.comment ? `<div class="text-[11px] text-neutral-400 italic truncate max-w-xs">"${escapeHtml(sub.comment)}"</div>` : ''}
          </div>
        </div>
        <span class="text-xs font-mono font-bold text-[#F59E0B]">+${sub.pointsEarned || 5} pts</span>
      </div>
    `).join('');
  }

  modal.classList.remove('hidden');
  refreshIcons();
}

/* ==========================================================================
   UI RENDERING: ATTENDANCE & GRANULAR PENALTY ENGINE
   ========================================================================= */
function renderAttendanceView() {
  const container = document.getElementById('attendance-sessions-container');
  if (!container) return;

  const activeSessions = state.attendanceSessions.filter(s => s.isActive !== false);

  if (activeSessions.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-8 sm:p-10 text-center border border-white/10 relative overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-400">
          <i data-lucide="lock" class="w-7 h-7 text-neutral-400"></i>
        </div>
        <h3 class="text-base sm:text-lg font-bold text-white">No Active Attendance Session Right Now</h3>
        <p class="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-md mx-auto leading-relaxed">
          Attendance check-in is currently locked. Check-in unlocks automatically when an attendance session is activated by the media administration.
        </p>
      </div>
    `;
    updateUserTodayAttendanceBadge(null);
    refreshIcons();
    return;
  }

  container.innerHTML = activeSessions.map(session => {
    const userLog = state.user ? state.attendanceLogs.find(l => l.sessionId === session.id && l.uid === state.user.uid) : null;
    if (userLog) {
      updateUserTodayAttendanceBadge(userLog);
    }

    const startDateTimeStr = session.startDateTime ? new Date(session.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM';
    const endDateTimeStr = session.endDateTime ? new Date(session.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM';

    return `
      <div class="glass-card rounded-2xl p-5 border border-emerald-500/20 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span class="text-xs font-mono uppercase text-emerald-400 font-bold">Active Attendance Session</span>
            </div>
            <h3 class="text-base font-bold text-white mt-1">${escapeHtml(session.title)}</h3>
            <div class="text-xs text-neutral-400 mt-0.5 flex flex-wrap gap-2">
              <span>Time: ${startDateTimeStr} - ${endDateTimeStr}</span>
              <span>•</span>
              <span>Grace: ${session.gracePeriodMinutes || 10} mins</span>
              <span>•</span>
              <span>Late Step: -${session.penaltyAmountPerStep || 5} pts / ${session.everyNMinutes || 5}m</span>
            </div>
          </div>
        </div>

        <div class="pt-2">
          ${userLog ? `
            <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 text-emerald-400 font-semibold">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                <span>You checked in: ${userLog.status === 'on_time' ? 'On Time' : `Late (${userLog.lateMinutes}m late)`}</span>
              </div>
              <span class="font-mono ${userLog.penaltyDeducted > 0 ? 'text-rose-400' : 'text-emerald-400'} font-bold">
                ${userLog.penaltyDeducted > 0 ? `-${userLog.penaltyDeducted} pts penalty` : '0 penalty'}
              </span>
            </div>
          ` : `
            <button class="btn-check-in-session w-full py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2" data-session-id="${session.id}">
              <i data-lucide="user-check" class="w-4 h-4"></i>
              <span>${i18n[state.lang].check_in_now}</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-check-in-session').forEach(btn => {
    btn.onclick = () => {
      const sessionId = btn.dataset.sessionId;
      requireAuth(() => processAttendanceCheckIn(sessionId));
    };
  });

  refreshIcons();
}

async function processAttendanceCheckIn(sessionId) {
  if (!state.user || !db) return;

  const session = state.attendanceSessions.find(s => s.id === sessionId);
  if (!session) return;

  const existing = state.attendanceLogs.find(l => l.sessionId === session.id && l.uid === state.user.uid);
  if (existing) {
    showToast('You have already recorded your attendance for this session.', 'info');
    return;
  }

  // EXACT GRANULAR LATE PENALTY FORMULA:
  const now = new Date();
  const sessionStart = session.startDateTime ? new Date(session.startDateTime) : new Date();
  const graceMins = Number(session.gracePeriodMinutes) || 10;
  const cutoffTime = new Date(sessionStart.getTime() + (graceMins * 60 * 1000));

  let lateMinutes = 0;
  let penalty = 0;
  let status = 'on_time';

  if (now > cutoffTime) {
    status = 'late';
    lateMinutes = Math.floor((now.getTime() - cutoffTime.getTime()) / (60 * 1000));
    
    const everyN = Number(session.everyNMinutes) || 5;
    const stepAmount = Number(session.penaltyAmountPerStep) || 5;
    const minP = Number(session.minPenalty) || 5;
    const maxP = Number(session.maxPenalty) || 50;

    const steps = Math.ceil(lateMinutes / everyN);
    penalty = Math.min(maxP, Math.max(minP, steps * stepAmount));
  }

  try {
    await addDoc(collection(db, 'attendance_logs'), {
      sessionId: session.id,
      sessionTitle: session.title,
      uid: state.user.uid,
      userName: state.user.displayName,
      userEmail: state.user.email,
      userPhoto: state.user.photoURL,
      checkInTime: new Date().toISOString(),
      lateMinutes,
      penaltyDeducted: penalty,
      status
    });

    if (penalty > 0) {
      await updateDoc(doc(db, 'users', state.user.uid), {
        totalPenalties: increment(penalty)
      });
    }

    await addDoc(collection(db, 'notifications'), {
      title: 'Attendance Check-in',
      message: `${state.user.displayName} checked in: ${status === 'on_time' ? 'On Time' : `Late by ${lateMinutes} mins (-${penalty} pts)`}`,
      type: status === 'on_time' ? 'info' : 'warning',
      createdAt: serverTimestamp()
    });

    if (status === 'on_time') {
      showToast('Checked in successfully! On time badge recorded.', 'success');
    } else {
      showToast(`Checked in! You were ${lateMinutes}m late (-${penalty} pts penalty).`, 'error');
    }

    renderAttendanceView();
  } catch (err) {
    console.error('Attendance check-in error:', err);
    showToast('Failed to record attendance. Please check network.', 'error');
  }
}

function renderAttendanceLogs() {
  const container = document.getElementById('attendance-logs-feed');
  const countEl = document.getElementById('attendance-log-count');
  if (!container) return;

  if (countEl) countEl.textContent = `${state.attendanceLogs.length} Check-ins`;

  if (state.attendanceLogs.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400">No attendance records logged today yet.</div>`;
    return;
  }

  const sorted = [...state.attendanceLogs].sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));

  container.innerHTML = sorted.map(log => {
    const timeStr = log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const isOnTime = log.status === 'on_time';
    return `
      <div class="py-2.5 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5">
          <img src="${log.userPhoto || './image_ad59c0.jpg'}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-white/10" />
          <div>
            <div class="font-bold text-white">${escapeHtml(log.userName || 'Member')}</div>
            <div class="text-[11px] text-neutral-400">${escapeHtml(log.sessionTitle || 'Session')} • ${timeStr}</div>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isOnTime ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
            ${isOnTime ? 'On Time' : `Late (-${log.penaltyDeducted || 0} pts)`}
          </span>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

function updateUserTodayAttendanceBadge(log) {
  const badge = document.getElementById('user-today-attendance-badge');
  if (!badge) return;

  if (!log) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-neutral-500"></span> Not Checked In`;
    badge.className = 'font-bold text-neutral-400 mt-1 flex items-center gap-1.5';
  } else if (log.status === 'on_time') {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Checked In (On Time)`;
    badge.className = 'font-bold text-emerald-400 mt-1 flex items-center gap-1.5';
  } else {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Checked In (Late: -${log.penaltyDeducted} pts)`;
    badge.className = 'font-bold text-rose-400 mt-1 flex items-center gap-1.5';
  }
}

/* ==========================================================================
   UI RENDERING: LEADERBOARD (ZERO-POINTS PODIUM FILTER)
   ========================================================================== */
function renderLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  const countEl = document.getElementById('leaderboard-total-count');

  let memberMap = new Map();

  state.members.forEach(m => {
    memberMap.set(m.uid, {
      uid: m.uid,
      displayName: m.displayName || 'Member',
      photoURL: m.photoURL || './image_ad59c0.jpg',
      points: m.points || 0,
      totalPenalties: m.totalPenalties || 0,
      tasksCount: 0
    });
  });

  state.submissions.forEach(s => {
    if (memberMap.has(s.uid)) {
      memberMap.get(s.uid).tasksCount += 1;
    } else {
      memberMap.set(s.uid, {
        uid: s.uid,
        displayName: s.userName || 'Member',
        photoURL: s.userPhoto || './image_ad59c0.jpg',
        points: s.pointsEarned || 5,
        totalPenalties: 0,
        tasksCount: 1
      });
    }
  });

  const allRanked = Array.from(memberMap.values())
    .sort((a, b) => b.points - a.points);

  if (countEl) countEl.textContent = `${allRanked.length} Members`;

  // Zero-Points Filter for Podium: only members with > 0 points appear on podium
  const podiumEligible = allRanked.filter(m => m.points > 0);

  const first = podiumEligible[0] || null;
  const second = podiumEligible[1] || null;
  const third = podiumEligible[2] || null;

  updatePodiumSlot(1, first);
  updatePodiumSlot(2, second);
  updatePodiumSlot(3, third);

  if (listEl) {
    if (allRanked.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400">No members registered yet.</div>`;
    } else {
      listEl.innerHTML = allRanked.map((member, index) => {
        const rank = index + 1;
        const isCurrentUser = state.user && state.user.uid === member.uid;
        return `
          <div class="p-3.5 flex items-center justify-between gap-3 text-xs ${isCurrentUser ? 'bg-[#0A84FF]/10 border-l-2 border-[#0A84FF]' : 'hover:bg-white/[0.02]'} transition">
            <div class="flex items-center gap-3">
              <span class="w-6 text-center font-mono font-bold ${rank <= 3 ? 'text-[#F59E0B]' : 'text-neutral-400'}">
                #${rank}
              </span>
              <img src="${member.photoURL || './image_ad59c0.jpg'}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-white/10" />
              <div>
                <div class="font-bold text-white flex items-center gap-1.5">
                  <span>${escapeHtml(member.displayName)}</span>
                  ${isCurrentUser ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-[#0A84FF]/30 text-[#0A84FF] font-mono">YOU</span>' : ''}
                </div>
                <div class="text-[11px] text-neutral-400">${member.tasksCount || 0} completed quotas</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-extrabold text-[#F59E0B] text-sm">${member.points || 0} pts</div>
              ${member.totalPenalties > 0 ? `<div class="text-[10px] text-rose-400 font-mono">-${member.totalPenalties} penalties</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (state.user) {
    const userIndex = allRanked.findIndex(m => m.uid === state.user.uid);
    const rankEl = document.getElementById('profile-stat-rank');
    if (rankEl) rankEl.textContent = userIndex !== -1 ? `#${userIndex + 1}` : '--';
  }
}

function updatePodiumSlot(rankNum, member) {
  const nameEl = document.getElementById(`podium-${rankNum}-name`);
  const ptsEl = document.getElementById(`podium-${rankNum}-pts`);
  const tasksEl = document.getElementById(`podium-${rankNum}-tasks`);
  const imgEl = document.getElementById(`podium-${rankNum}-img`);

  if (!nameEl) return;

  if (member && member.points > 0) {
    nameEl.textContent = member.displayName;
    ptsEl.textContent = `${member.points} pts`;
    if (tasksEl) tasksEl.textContent = `${member.tasksCount || 0} tasks`;
    if (imgEl && member.photoURL) imgEl.src = member.photoURL;
  } else {
    nameEl.textContent = 'Vacant';
    ptsEl.textContent = '0 pts';
    if (tasksEl) tasksEl.textContent = '0 tasks';
    if (imgEl) imgEl.src = './image_ad59c0.jpg';
  }
}

/* ==========================================================================
   UI RENDERING: NOTIFICATIONS & BROADCASTS
   ========================================================================== */
function renderNotifications() {
  const container = document.getElementById('notifications-container');
  const badge = document.getElementById('header-unread-badge');
  const dot = document.getElementById('tab-unread-dot');
  if (!container) return;

  const list = state.notifications.filter(n => {
    if (!n.targetUid) return true;
    return state.user && n.targetUid === state.user.uid;
  });

  const unreadCount = list.filter(n => !n.read).length;
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (dot) {
    if (unreadCount > 0) dot.classList.remove('hidden');
    else dot.classList.add('hidden');
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-neutral-400 glass-card rounded-2xl">No notifications or updates right now.</div>`;
    return;
  }

  container.innerHTML = list.map(notif => {
    let icon = 'bell';
    let iconClass = 'text-[#0A84FF]';
    if (notif.type === 'reward') { icon = 'award'; iconClass = 'text-[#F59E0B]'; }
    if (notif.type === 'warning') { icon = 'alert-triangle'; iconClass = 'text-rose-400'; }

    const timeStr = notif.createdAt?.seconds 
      ? new Date(notif.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
      : 'Just now';

    return `
      <div class="glass-card rounded-2xl p-4 flex items-start gap-3 text-xs">
        <div class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 ${iconClass}">
          <i data-lucide="${icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(notif.title)}</h4>
            <span class="text-[10px] text-neutral-500 font-mono">${timeStr}</span>
          </div>
          <p class="text-neutral-300 mt-1 leading-relaxed">${escapeHtml(notif.message)}</p>
        </div>
      </div>
    `;
  }).join('');

  refreshIcons();
}

/* ==========================================================================
   UI RENDERING: PROFILE VIEW
   ========================================================================== */
function updateProfileUI() {
  const guestCard = document.getElementById('drawer-guest-card');
  const profileCard = document.getElementById('drawer-profile-card');
  const signOutBtn = document.getElementById('drawer-btn-signout');

  const avatarEl = document.getElementById('drawer-user-avatar');
  const nameEl = document.getElementById('drawer-user-name');
  const emailEl = document.getElementById('drawer-user-email');
  const pointsEl = document.getElementById('drawer-user-points');
  const roleEl = document.getElementById('drawer-user-role');

  const viewAvatar = document.getElementById('profile-view-avatar');
  const viewName = document.getElementById('profile-view-name');
  const viewEmail = document.getElementById('profile-view-email');
  const viewRole = document.getElementById('profile-view-role');
  const statPoints = document.getElementById('profile-stat-points');
  const statCompleted = document.getElementById('profile-stat-completed');
  const statPenalties = document.getElementById('profile-stat-penalties');

  if (!state.user) {
    if (guestCard) guestCard.classList.remove('hidden');
    if (profileCard) profileCard.classList.add('hidden');
    if (signOutBtn) signOutBtn.classList.add('hidden');

    if (viewName) viewName.textContent = 'Guest User (زائر)';
    if (viewEmail) viewEmail.textContent = 'Read-Only Mode • Sign in to save progress';
    if (viewRole) viewRole.textContent = 'GUEST';
    if (statPoints) statPoints.textContent = '0';
    if (statCompleted) statCompleted.textContent = '0';
    if (statPenalties) statPenalties.textContent = '0 pts';
  } else {
    if (guestCard) guestCard.classList.add('hidden');
    if (profileCard) profileCard.classList.remove('hidden');
    if (signOutBtn) signOutBtn.classList.remove('hidden');

    const photo = state.user.photoURL || './image_ad59c0.jpg';
    if (avatarEl) avatarEl.src = photo;
    if (nameEl) nameEl.textContent = state.user.displayName;
    if (emailEl) emailEl.textContent = state.user.email;
    if (pointsEl) pointsEl.textContent = `${state.user.points || 0} pts`;
    if (roleEl) roleEl.textContent = state.user.isAdmin ? 'ADMIN' : 'MEMBER';

    if (viewAvatar) viewAvatar.src = photo;
    if (viewName) viewName.textContent = state.user.displayName;
    if (viewEmail) viewEmail.textContent = state.user.email;
    if (viewRole) viewRole.textContent = state.user.isAdmin ? '👑 ADMIN' : 'MEMBER';
    if (statPoints) statPoints.textContent = state.user.points || 0;
    if (statPenalties) statPenalties.textContent = `${state.user.totalPenalties || 0} pts`;

    renderProfileSubmissions();
  }

  updateHeroStats();
}

function renderProfileSubmissions() {
  const container = document.getElementById('profile-submissions-list');
  const statCompleted = document.getElementById('profile-stat-completed');
  if (!container || !state.user) return;

  const mySubs = state.submissions.filter(s => s.uid === state.user.uid);
  if (statCompleted) statCompleted.textContent = mySubs.length;

  if (mySubs.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400">You haven't completed any quotas yet. Browse the Tasks tab to start!</div>`;
    return;
  }

  container.innerHTML = mySubs.map(s => `
    <div class="py-2.5 flex items-center justify-between text-xs">
      <div>
        <div class="font-bold text-white">${escapeHtml(s.taskTitle || 'Task')}</div>
        <div class="text-[11px] text-neutral-400">${s.taskCategory || 'General'} • ${s.minutesSpent || 30} mins spent</div>
      </div>
      <span class="font-mono font-bold text-[#F59E0B]">+${s.pointsEarned || 5} pts</span>
    </div>
  `).join('');

  refreshIcons();
}

function updateHeroStats() {
  const activeCountEl = document.getElementById('stat-active-tasks-count');
  const completedTodayEl = document.getElementById('stat-completed-today-count');
  const myPointsEl = document.getElementById('stat-user-points');
  const heroGreeting = document.getElementById('hero-greeting');

  if (activeCountEl) activeCountEl.textContent = state.tasks.length;
  if (myPointsEl) myPointsEl.textContent = state.user ? state.user.points || 0 : 0;
  if (completedTodayEl) {
    const today = new Date().toDateString();
    const todayDone = state.submissions.filter(s => {
      if (!s.createdAt?.seconds) return false;
      return new Date(s.createdAt.seconds * 1000).toDateString() === today;
    }).length;
    completedTodayEl.textContent = todayDone;
  }
  if (heroGreeting) {
    if (state.user) {
      heroGreeting.textContent = `Welcome back, ${state.user.displayName}!`;
    } else {
      heroGreeting.textContent = `Welcome to COC Media Hub`;
    }
  }
}

/* ==========================================================================
   ADMIN HUB: TASKS MANAGER (CRUD & SUBMISSIONS)
   ========================================================================== */
function renderAdminTasks() {
  const tbody = document.getElementById('admin-tasks-tbody');
  if (!tbody) return;

  if (state.tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-neutral-400">No tasks created yet. Click "+ Add New Task" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.tasks.map(t => {
    const cat = state.categories.find(c => c.id === t.category) || { nameEn: t.category || 'General' };
    const endStr = t.endDateTime ? new Date(t.endDateTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'None';

    return `
      <tr class="border-b border-white/5 hover:bg-white/[0.02]">
        <td class="p-3 font-medium text-white">${escapeHtml(t.title)}</td>
        <td class="p-3 text-neutral-300">${escapeHtml(cat.nameEn)}</td>
        <td class="p-3 font-mono font-bold text-[#F59E0B]">${t.points || 5} pts</td>
        <td class="p-3 text-neutral-400 font-mono text-[11px]">${endStr}</td>
        <td class="p-3 text-right space-x-1">
          <button class="btn-admin-edit-task px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#0A84FF] text-[11px] font-semibold" data-id="${t.id}">Edit</button>
          <button class="btn-admin-delete-task px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold" data-id="${t.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-admin-edit-task').forEach(btn => {
    btn.onclick = () => openAdminTaskForm(btn.dataset.id);
  });
  tbody.querySelectorAll('.btn-admin-delete-task').forEach(btn => {
    btn.onclick = () => deleteAdminTask(btn.dataset.id);
  });
}

function openAdminTaskForm(taskId = null) {
  const container = document.getElementById('admin-task-form-container');
  const titleEl = document.getElementById('admin-task-form-title');
  const form = document.getElementById('form-manage-task');

  const idInput = document.getElementById('input-task-id');
  const titleInput = document.getElementById('input-task-title');
  const descInput = document.getElementById('input-task-desc');
  const catSelect = document.getElementById('select-task-category');
  const pointsInput = document.getElementById('input-task-points');
  const quotaSelect = document.getElementById('select-task-quota');
  const linkInput = document.getElementById('input-task-link');
  const startInput = document.getElementById('input-task-start-datetime');
  const endInput = document.getElementById('input-task-end-datetime');
  const durationInput = document.getElementById('input-task-duration');

  populateTaskCategorySelect();

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    titleEl.textContent = 'Edit Task Configuration';
    idInput.value = task.id;
    titleInput.value = task.title || '';
    descInput.value = task.description || '';
    catSelect.value = task.category || '';
    pointsInput.value = task.points || '';
    quotaSelect.value = task.quotaType || 'daily';
    linkInput.value = task.link || '';
    startInput.value = task.startDateTime || '';
    endInput.value = task.endDateTime || '';
    durationInput.value = task.duration || '';
  } else {
    titleEl.textContent = 'New Task Configuration';
    form.reset();
    idInput.value = '';
    pointsInput.value = '';
  }

  container.classList.remove('hidden');
}

async function handleAdminTaskSave(e) {
  e.preventDefault();
  if (!db) return;

  const id = document.getElementById('input-task-id').value;
  const title = document.getElementById('input-task-title').value.trim();
  const desc = document.getElementById('input-task-desc').value.trim();
  const cat = document.getElementById('select-task-category').value;
  const rawPoints = document.getElementById('input-task-points').value;
  const points = Number(rawPoints) || 5;
  const quota = document.getElementById('select-task-quota').value;
  const link = document.getElementById('input-task-link').value.trim();
  const startDateTime = document.getElementById('input-task-start-datetime').value;
  const endDateTime = document.getElementById('input-task-end-datetime').value;
  const duration = document.getElementById('input-task-duration').value.trim();
  const enableComment = document.getElementById('check-enable-comment').checked;
  const enableQuestion = document.getElementById('check-enable-question').checked;
  const questionPrompt = document.getElementById('input-question-prompt').value.trim();

  const taskData = {
    title,
    description: desc,
    category: cat,
    points,
    quotaType: quota,
    link,
    startDateTime,
    endDateTime,
    duration,
    enableComment,
    enableQuestion,
    questionPrompt,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'tasks', id), taskData);
      showToast('Task updated in Firestore!', 'success');
    } else {
      taskData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'tasks'), taskData);
      showToast('Task successfully created and published!', 'success');
    }
    document.getElementById('admin-task-form-container').classList.add('hidden');
  } catch (err) {
    console.error('Save task error:', err);
    showToast('Failed to save task to Firestore.', 'error');
  }
}

async function deleteAdminTask(taskId) {
  const confirmed = await showCustomConfirm('Delete Task', 'Are you sure you want to delete this task? This action cannot be undone.');
  if (!confirmed || !db) return;

  try {
    await deleteDoc(doc(db, 'tasks', taskId));
    showToast('Task deleted successfully.', 'success');
  } catch (err) {
    console.error('Delete task error:', err);
    showToast('Could not delete task.', 'error');
  }
}

/* ==========================================================================
   ADMIN HUB: ATTENDANCE SESSIONS & LIVE LOGS (WAIVER/EDIT)
   ========================================================================== */
function renderAdminSessions() {
  const container = document.getElementById('admin-sessions-list');
  if (!container) return;

  if (state.attendanceSessions.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-neutral-400">No scheduled sessions configured. Use the form above to add one.</div>`;
    return;
  }

  container.innerHTML = state.attendanceSessions.map(session => {
    const isActive = session.isActive !== false;
    const startStr = session.startDateTime ? new Date(session.startDateTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const endStr = session.endDateTime ? new Date(session.endDateTime).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    return `
      <div class="p-3.5 rounded-xl glass-card border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-white text-sm">${escapeHtml(session.title)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30'}">
              ${isActive ? 'Active / Open' : 'Closed'}
            </span>
          </div>
          <div class="text-neutral-400 text-[11px] mt-1 space-x-2">
            <span>Window: ${startStr} - ${endStr}</span>
            <span>• Grace: ${session.gracePeriodMinutes || 10}m</span>
            <span>• Deduction: -${session.penaltyAmountPerStep || 5}pts / ${session.everyNMinutes || 5}m</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-center">
          <button class="btn-toggle-session-active px-2.5 py-1.5 rounded-lg text-xs font-semibold ${isActive ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'}" data-id="${session.id}" data-active="${isActive}">
            ${isActive ? 'Close Session' : 'Activate'}
          </button>
          <button class="btn-edit-session px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold" data-id="${session.id}">
            Edit
          </button>
          <button class="btn-delete-session px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold" data-id="${session.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-toggle-session-active').forEach(btn => {
    btn.onclick = () => toggleSessionActive(btn.dataset.id, btn.dataset.active === 'true');
  });
  container.querySelectorAll('.btn-edit-session').forEach(btn => {
    btn.onclick = () => openEditSessionForm(btn.dataset.id);
  });
  container.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.onclick = () => deleteSession(btn.dataset.id);
  });
}

function renderAdminAttendanceLogs() {
  const tbody = document.getElementById('admin-attendance-logs-tbody');
  const countEl = document.getElementById('admin-attendance-log-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = `${state.attendanceLogs.length} logs`;

  if (state.attendanceLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-neutral-400">No attendance records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.attendanceLogs.map(log => {
    const timeStr = log.checkInTime ? new Date(log.checkInTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const isOnTime = log.status === 'on_time';

    return `
      <tr class="border-b border-white/5 hover:bg-white/[0.02]">
        <td class="p-3">
          <div class="font-semibold text-white">${escapeHtml(log.userName || 'Member')}</div>
          <div class="text-[10px] text-neutral-400">${escapeHtml(log.userEmail || '')}</div>
        </td>
        <td class="p-3 text-neutral-300">${escapeHtml(log.sessionTitle || 'Session')}</td>
        <td class="p-3 font-mono text-[11px] text-neutral-400">${timeStr}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isOnTime ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${isOnTime ? 'On Time' : `${log.lateMinutes || 0}m late`}
          </span>
        </td>
        <td class="p-3 font-mono font-bold ${log.penaltyDeducted > 0 ? 'text-rose-400' : 'text-emerald-400'}">
          ${log.penaltyDeducted > 0 ? `-${log.penaltyDeducted} pts` : '0'}
        </td>
        <td class="p-3 text-right space-x-1">
          <button class="btn-edit-attendance-log px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[#0A84FF] text-[11px]" data-id="${log.id}">
            Edit
          </button>
          ${log.penaltyDeducted > 0 ? `
            <button class="btn-waive-penalty px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px]" data-id="${log.id}" data-uid="${log.uid}" data-penalty="${log.penaltyDeducted}">
              Waive
            </button>
          ` : ''}
          <button class="btn-delete-attendance-log px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px]" data-id="${log.id}">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-edit-attendance-log').forEach(btn => {
    btn.onclick = () => openEditLogModal(btn.dataset.id);
  });
  tbody.querySelectorAll('.btn-waive-penalty').forEach(btn => {
    btn.onclick = () => waivePenaltyAction(btn.dataset.id, btn.dataset.uid, Number(btn.dataset.penalty));
  });
  tbody.querySelectorAll('.btn-delete-attendance-log').forEach(btn => {
    btn.onclick = () => deleteAttendanceLog(btn.dataset.id);
  });
}

async function handleAdminSessionSave(e) {
  e.preventDefault();
  if (!db) return;

  const id = document.getElementById('input-session-id').value;
  const title = document.getElementById('input-session-title').value.trim();
  const startDateTime = document.getElementById('input-session-start-datetime').value;
  const endDateTime = document.getElementById('input-session-end-datetime').value;
  const gracePeriodMinutes = Number(document.getElementById('input-session-grace').value) || 10;
  const everyNMinutes = Number(document.getElementById('input-session-every-n').value) || 5;
  const penaltyAmountPerStep = Number(document.getElementById('input-session-step-amount').value) || 5;
  const minPenalty = Number(document.getElementById('input-session-min-penalty').value) || 5;
  const maxPenalty = Number(document.getElementById('input-session-max-penalty').value) || 50;
  const isActive = document.getElementById('check-session-active').checked;

  const sessionData = {
    title,
    startDateTime,
    endDateTime,
    gracePeriodMinutes,
    everyNMinutes,
    penaltyAmountPerStep,
    minPenalty,
    maxPenalty,
    isActive,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'attendance_sessions', id), sessionData);
      showToast('Attendance session updated!', 'success');
    } else {
      sessionData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'attendance_sessions'), sessionData);
      showToast('Attendance session created!', 'success');
    }

    document.getElementById('form-manage-session').reset();
    document.getElementById('input-session-id').value = '';
    document.getElementById('admin-session-form-title').textContent = 'Create Attendance Session';
    document.getElementById('btn-cancel-session-form').classList.add('hidden');
  } catch (err) {
    console.error('Save session error:', err);
    showToast('Failed to save attendance session.', 'error');
  }
}

function openEditSessionForm(sessionId) {
  const session = state.attendanceSessions.find(s => s.id === sessionId);
  if (!session) return;

  document.getElementById('input-session-id').value = session.id;
  document.getElementById('input-session-title').value = session.title || '';
  document.getElementById('input-session-start-datetime').value = session.startDateTime || '';
  document.getElementById('input-session-end-datetime').value = session.endDateTime || '';
  document.getElementById('input-session-grace').value = session.gracePeriodMinutes || 10;
  document.getElementById('input-session-every-n').value = session.everyNMinutes || 5;
  document.getElementById('input-session-step-amount').value = session.penaltyAmountPerStep || 5;
  document.getElementById('input-session-min-penalty').value = session.minPenalty || 5;
  document.getElementById('input-session-max-penalty').value = session.maxPenalty || 50;
  document.getElementById('check-session-active').checked = session.isActive !== false;

  document.getElementById('admin-session-form-title').textContent = 'Edit Attendance Session';
  document.getElementById('btn-cancel-session-form').classList.remove('hidden');
}

async function toggleSessionActive(sessionId, currentActive) {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'attendance_sessions', sessionId), {
      isActive: !currentActive
    });
    showToast(`Session ${!currentActive ? 'activated' : 'closed'}.`, 'info');
  } catch (err) {
    console.error('Toggle session error:', err);
    showToast('Failed to update session status.', 'error');
  }
}

async function deleteSession(sessionId) {
  const confirmed = await showCustomConfirm('Delete Session', 'Are you sure you want to delete this session?');
  if (!confirmed || !db) return;
  try {
    await deleteDoc(doc(db, 'attendance_sessions', sessionId));
    showToast('Attendance session deleted.', 'success');
  } catch (err) {
    console.error('Delete session error:', err);
    showToast('Failed to delete session.', 'error');
  }
}

// Attendance Log Edit & Waive
function openEditLogModal(logId) {
  const log = state.attendanceLogs.find(l => l.id === logId);
  if (!log) return;

  const modal = document.getElementById('modal-admin-edit-log');
  document.getElementById('input-edit-log-id').value = log.id;
  document.getElementById('input-edit-log-uid').value = log.uid || '';
  document.getElementById('edit-log-member-name').textContent = `Member: ${log.userName || log.uid}`;
  document.getElementById('select-edit-log-status').value = log.status || 'on_time';
  document.getElementById('input-edit-log-late-mins').value = log.lateMinutes || 0;
  document.getElementById('input-edit-log-penalty').value = log.penaltyDeducted || 0;

  modal.classList.remove('hidden');
}

async function handleSaveEditLog(e) {
  e.preventDefault();
  if (!db) return;

  const logId = document.getElementById('input-edit-log-id').value;
  const status = document.getElementById('select-edit-log-status').value;
  const lateMinutes = Number(document.getElementById('input-edit-log-late-mins').value) || 0;
  const penaltyDeducted = Number(document.getElementById('input-edit-log-penalty').value) || 0;

  try {
    await updateDoc(doc(db, 'attendance_logs', logId), {
      status,
      lateMinutes,
      penaltyDeducted
    });
    document.getElementById('modal-admin-edit-log').classList.add('hidden');
    showToast('Attendance record updated.', 'success');
  } catch (err) {
    console.error('Update log error:', err);
    showToast('Failed to update attendance record.', 'error');
  }
}

async function waivePenaltyAction(logId, uid, penaltyAmount) {
  const confirmed = await showCustomConfirm('Waive Penalty', `Are you sure you want to waive the ${penaltyAmount} pts penalty for this member?`);
  if (!confirmed || !db) return;

  try {
    await updateDoc(doc(db, 'attendance_logs', logId), {
      penaltyDeducted: 0,
      status: 'excused'
    });

    if (uid && penaltyAmount > 0) {
      await updateDoc(doc(db, 'users', uid), {
        totalPenalties: increment(-penaltyAmount)
      });
    }

    showToast('Penalty waived and refunded successfully!', 'success');
  } catch (err) {
    console.error('Waive penalty error:', err);
    showToast('Failed to waive penalty.', 'error');
  }
}

async function deleteAttendanceLog(logId) {
  const confirmed = await showCustomConfirm('Delete Log', 'Delete this attendance record?');
  if (!confirmed || !db) return;
  try {
    await deleteDoc(doc(db, 'attendance_logs', logId));
    showToast('Attendance record deleted.', 'success');
  } catch (err) {
    console.error('Delete log error:', err);
    showToast('Failed to delete record.', 'error');
  }
}

/* ==========================================================================
   ADMIN HUB: REGISTERED MEMBERS & POINT ADJUSTMENTS
   ========================================================================== */
function renderAdminMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  const searchInput = document.getElementById('input-admin-search-members');
  if (!tbody) return;

  let query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  let filtered = state.members.filter(m => {
    if (!query) return true;
    return m.displayName?.toLowerCase().includes(query) || m.email?.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-neutral-400">No members match your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(member => {
    const isAdmin = member.isAdmin || member.role === 'admin';
    return `
      <tr class="border-b border-white/5 hover:bg-white/[0.02]">
        <td class="p-3">
          <div class="flex items-center gap-2.5">
            <img src="${member.photoURL || './image_ad59c0.jpg'}" alt="Avatar" class="w-8 h-8 rounded-full object-cover border border-white/10" />
            <div>
              <div class="font-bold text-white">${escapeHtml(member.displayName || 'Member')}</div>
              <div class="text-[10px] text-neutral-400">${escapeHtml(member.email || '')}</div>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAdmin ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-neutral-500/20 text-neutral-300'}">
            ${isAdmin ? 'ADMIN' : 'MEMBER'}
          </span>
        </td>
        <td class="p-3 font-mono font-bold text-[#F59E0B]">${member.points || 0}</td>
        <td class="p-3 font-mono text-rose-400">${member.totalPenalties || 0}</td>
        <td class="p-3 text-right space-x-1 whitespace-nowrap">
          <button class="btn-admin-adjust-points px-2.5 py-1 rounded bg-[#0A84FF]/15 hover:bg-[#0A84FF]/25 text-[#0A84FF] text-[11px] font-semibold" data-uid="${member.uid}" data-name="${escapeHtml(member.displayName || 'Member')}">
            +/- Points
          </button>
          <button class="btn-admin-send-notif px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px]" data-uid="${member.uid}" data-name="${escapeHtml(member.displayName || 'Member')}">
            Message
          </button>
          <button class="btn-admin-toggle-role px-2 py-1 rounded ${isAdmin ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-300'} text-[11px] font-semibold" data-uid="${member.uid}" data-is-admin="${isAdmin}">
            ${isAdmin ? 'Demote' : 'Make Admin'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-admin-adjust-points').forEach(btn => {
    btn.onclick = () => openAdjustPointsModal(btn.dataset.uid, btn.dataset.name);
  });
  tbody.querySelectorAll('.btn-admin-send-notif').forEach(btn => {
    btn.onclick = () => openDirectNotificationModal(btn.dataset.uid, btn.dataset.name);
  });
  tbody.querySelectorAll('.btn-admin-toggle-role').forEach(btn => {
    btn.onclick = () => toggleMemberAdminRole(btn.dataset.uid, btn.dataset.isAdmin === 'true');
  });
}

// Points Adjustment Modal
let currentAdjustType = 'add';
function openAdjustPointsModal(uid, name) {
  const modal = document.getElementById('modal-admin-adjust-points');
  document.getElementById('input-adjust-points-uid').value = uid;
  document.getElementById('adjust-points-target-name').textContent = `Target Member: ${name}`;
  document.getElementById('input-adjust-amount').value = '10';
  document.getElementById('input-adjust-reason').value = '';

  currentAdjustType = 'add';
  updateAdjustTypeButtons();

  modal.classList.remove('hidden');
}

function updateAdjustTypeButtons() {
  const addBtn = document.getElementById('btn-adjust-type-add');
  const deductBtn = document.getElementById('btn-adjust-type-deduct');
  if (currentAdjustType === 'add') {
    addBtn.className = 'py-2 rounded-xl font-bold border border-emerald-500 bg-emerald-500/20 text-emerald-400';
    deductBtn.className = 'py-2 rounded-xl font-bold border border-white/10 bg-white/5 text-neutral-400 hover:text-white';
  } else {
    deductBtn.className = 'py-2 rounded-xl font-bold border border-rose-500 bg-rose-500/20 text-rose-400';
    addBtn.className = 'py-2 rounded-xl font-bold border border-white/10 bg-white/5 text-neutral-400 hover:text-white';
  }
}

async function handleAdminAdjustPoints(e) {
  e.preventDefault();
  if (!db) return;

  const uid = document.getElementById('input-adjust-points-uid').value;
  const rawAmount = Number(document.getElementById('input-adjust-amount').value) || 0;
  const delta = currentAdjustType === 'add' ? rawAmount : -rawAmount;
  const reason = document.getElementById('input-adjust-reason').value.trim();

  try {
    await updateDoc(doc(db, 'users', uid), {
      points: increment(delta)
    });

    await addDoc(collection(db, 'notifications'), {
      targetUid: uid,
      title: delta > 0 ? 'Points Awarded' : 'Points Deducted',
      message: `${delta > 0 ? `+${delta}` : delta} points: ${reason}`,
      type: delta > 0 ? 'reward' : 'warning',
      createdAt: serverTimestamp()
    });

    document.getElementById('modal-admin-adjust-points').classList.add('hidden');
    showToast(`Points ${delta > 0 ? 'awarded' : 'deducted'} (${delta > 0 ? '+' + delta : delta} pts) successfully!`, 'success');
  } catch (err) {
    console.error('Adjust points error:', err);
    showToast('Failed to adjust points.', 'error');
  }
}

// Direct Notification Modal
function openDirectNotificationModal(uid, name) {
  const modal = document.getElementById('modal-admin-direct-notification');
  document.getElementById('input-direct-notif-uid').value = uid;
  document.getElementById('direct-notif-target-name').textContent = `To: ${name}`;
  document.getElementById('input-direct-notif-title').value = '';
  document.getElementById('input-direct-notif-message').value = '';
  modal.classList.remove('hidden');
}

async function handleAdminDirectNotification(e) {
  e.preventDefault();
  if (!db) return;

  const uid = document.getElementById('input-direct-notif-uid').value;
  const title = document.getElementById('input-direct-notif-title').value.trim();
  const message = document.getElementById('input-direct-notif-message').value.trim();
  const type = document.getElementById('select-direct-notif-type').value;

  try {
    await addDoc(collection(db, 'notifications'), {
      targetUid: uid,
      title,
      message,
      type,
      createdAt: serverTimestamp()
    });
    document.getElementById('modal-admin-direct-notification').classList.add('hidden');
    showToast('Direct notification sent to member!', 'success');
  } catch (err) {
    console.error('Direct notification error:', err);
    showToast('Failed to send notification.', 'error');
  }
}

async function toggleMemberAdminRole(uid, currentIsAdmin) {
  const actionText = currentIsAdmin ? 'demote this admin to regular member' : 'promote this member to ADMIN';
  const confirmed = await showCustomConfirm('Change Role', `Are you sure you want to ${actionText}?`);
  if (!confirmed || !db) return;

  try {
    await updateDoc(doc(db, 'users', uid), {
      isAdmin: !currentIsAdmin,
      role: !currentIsAdmin ? 'admin' : 'member'
    });
    showToast('Member role updated successfully!', 'success');
  } catch (err) {
    console.error('Toggle role error:', err);
    showToast('Failed to update member role.', 'error');
  }
}

/* ==========================================================================
   ADMIN HUB: CATEGORIES MANAGER (CRUD & DYNAMIC TASK COUNTS)
   ========================================================================== */
function renderAdminCategories() {
  const container = document.getElementById('admin-categories-list');
  if (!container) return;

  if (state.categories.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400 sm:col-span-3">No categories found. Click "+ Add Category" to create one.</div>`;
    return;
  }

  container.innerHTML = state.categories.map(cat => {
    const count = state.tasks.filter(t => t.category === cat.id).length;
    const catColor = cat.color || '#0A84FF';

    return `
      <div class="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between space-y-3 relative overflow-hidden">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${catColor};"></span>
            <div>
              <h4 class="font-bold text-white text-xs sm:text-sm">${escapeHtml(cat.nameEn)}</h4>
              <div class="text-[11px] text-neutral-400 font-cairo">${escapeHtml(cat.nameAr || '')}</div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-neutral-300">
            ${count} ${count === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
          <button class="btn-edit-category px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[#0A84FF] text-[11px] font-semibold" data-id="${cat.id}">
            Edit
          </button>
          <button class="btn-delete-category px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold" data-id="${cat.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-category').forEach(btn => {
    btn.onclick = () => openCategoryForm(btn.dataset.id);
  });
  container.querySelectorAll('.btn-delete-category').forEach(btn => {
    btn.onclick = () => deleteCategoryAction(btn.dataset.id);
  });
}

function openCategoryForm(catId = null) {
  const container = document.getElementById('admin-category-form-container');
  const titleEl = document.getElementById('admin-category-form-title');
  const idInput = document.getElementById('input-category-id');
  const nameEn = document.getElementById('input-cat-name-en');
  const nameAr = document.getElementById('input-cat-name-ar');
  const color = document.getElementById('input-cat-color');
  const icon = document.getElementById('input-cat-icon');

  if (catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    titleEl.textContent = 'Edit Category';
    idInput.value = cat.id;
    nameEn.value = cat.nameEn || '';
    nameAr.value = cat.nameAr || '';
    color.value = cat.color || '#0A84FF';
    icon.value = cat.icon || 'film';
  } else {
    titleEl.textContent = 'New Category';
    document.getElementById('form-manage-category').reset();
    idInput.value = '';
    color.value = '#0A84FF';
    icon.value = 'film';
  }

  container.classList.remove('hidden');
}

async function handleCategorySave(e) {
  e.preventDefault();
  if (!db) return;

  const id = document.getElementById('input-category-id').value;
  const nameEn = document.getElementById('input-cat-name-en').value.trim();
  const nameAr = document.getElementById('input-cat-name-ar').value.trim();
  const color = document.getElementById('input-cat-color').value;
  const icon = document.getElementById('input-cat-icon').value.trim() || 'film';

  const catData = { nameEn, nameAr, color, icon, updatedAt: serverTimestamp() };

  try {
    if (id) {
      await updateDoc(doc(db, 'categories', id), catData);
      showToast('Category updated!', 'success');
    } else {
      const slug = nameEn.toLowerCase().replace(/[^a-z0-9]/g, '_');
      catData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'categories', slug), catData);
      showToast('Category created successfully!', 'success');
    }

    document.getElementById('admin-category-form-container').classList.add('hidden');
  } catch (err) {
    console.error('Save category error:', err);
    showToast('Failed to save category.', 'error');
  }
}

async function deleteCategoryAction(catId) {
  const confirmed = await showCustomConfirm('Delete Category', 'Are you sure you want to delete this category? Tasks with this category may lose their styling.');
  if (!confirmed || !db) return;

  try {
    await deleteDoc(doc(db, 'categories', catId));
    showToast('Category deleted.', 'success');
  } catch (err) {
    console.error('Delete category error:', err);
    showToast('Failed to delete category.', 'error');
  }
}

/* ==========================================================================
   ADMIN HUB: BROADCASTS & BRANDING SETTINGS
   ========================================================================== */
async function handleAdminAnnouncement(e) {
  e.preventDefault();
  if (!db) return;

  const en = document.getElementById('input-announcement-en').value.trim();
  const ar = document.getElementById('input-announcement-ar').value.trim();

  try {
    await setDoc(doc(db, 'settings', 'app_config'), {
      announcementEn: en,
      announcementAr: ar
    }, { merge: true });

    showToast('Announcement broadcasted to all screens!', 'success');
  } catch (err) {
    console.error('Broadcast error:', err);
    showToast('Failed to publish announcement.', 'error');
  }
}

async function handleClearAnnouncement() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'settings', 'app_config'), {
      announcementEn: '',
      announcementAr: ''
    }, { merge: true });
    showToast('Announcement banner cleared.', 'info');
  } catch (err) {
    console.error('Clear announcement error:', err);
    showToast('Failed to clear banner.', 'error');
  }
}

async function handleAdminSettings(e) {
  e.preventDefault();
  if (!db) return;

  const appName = document.getElementById('input-settings-appname').value.trim();
  const logoUrl = document.getElementById('input-settings-logourl').value.trim();
  const subEn = document.getElementById('input-settings-sub-en').value.trim();
  const subAr = document.getElementById('input-settings-sub-ar').value.trim();
  const devCredit = document.getElementById('input-settings-devcredit').value.trim();

  try {
    await setDoc(doc(db, 'settings', 'app_config'), {
      appName,
      logoUrl,
      subtitleEn: subEn,
      subtitleAr: subAr,
      developerCredit: devCredit
    }, { merge: true });

    showToast('Branding settings saved!', 'success');
  } catch (err) {
    console.error('Save settings error:', err);
    showToast('Failed to save settings.', 'error');
  }
}

function applySettings() {
  const s = state.settings;
  const headerTitle = document.getElementById('header-app-title');
  const headerLogo = document.getElementById('header-logo-img');
  const footerBrand = document.getElementById('drawer-footer-brand');
  const footerDev = document.getElementById('drawer-footer-dev');

  if (headerTitle && s.appName) headerTitle.textContent = s.appName;
  if (headerLogo && s.logoUrl) headerLogo.src = s.logoUrl;
  if (footerBrand && s.appName) footerBrand.textContent = s.appName;
  if (footerDev && s.developerCredit) footerDev.textContent = s.developerCredit;

  const banner = document.getElementById('announcement-bar');
  const bannerText = document.getElementById('announcement-text');
  const msg = state.lang === 'ar' && s.announcementAr ? s.announcementAr : s.announcementEn;

  if (banner && bannerText) {
    if (msg) {
      bannerText.textContent = msg;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

/* ==========================================================================
   EDIT PROFILE MODAL (LOCAL + FIRESTORE)
   ========================================================================== */
function openEditProfileModal() {
  if (!state.user) {
    requireAuth(() => {});
    return;
  }
  const modal = document.getElementById('modal-edit-profile');
  const nameInput = document.getElementById('input-edit-profile-name');
  const avatarInput = document.getElementById('input-edit-profile-avatar');
  const preview = document.getElementById('edit-profile-preview');

  nameInput.value = state.user.displayName || '';
  avatarInput.value = state.user.photoURL && state.user.photoURL !== './image_ad59c0.jpg' ? state.user.photoURL : '';
  if (preview) preview.src = state.user.photoURL || './image_ad59c0.jpg';

  modal.classList.remove('hidden');
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();
  if (!state.user || !db) return;

  const name = document.getElementById('input-edit-profile-name').value.trim();
  const photo = document.getElementById('input-edit-profile-avatar').value.trim() || './image_ad59c0.jpg';

  try {
    await updateDoc(doc(db, 'users', state.user.uid), {
      displayName: name,
      photoURL: photo
    });
    state.user.displayName = name;
    state.user.photoURL = photo;
    updateProfileUI();
    document.getElementById('modal-edit-profile').classList.add('hidden');
    showToast('Profile changes saved successfully!', 'success');
  } catch (err) {
    console.error('Update profile error:', err);
    showToast('Failed to update profile.', 'error');
  }
}

/* ==========================================================================
   LIVE CLOCK & UTILITIES
   ========================================================================== */
function startLiveClock() {
  const clockEl = document.getElementById('live-clock');
  const dateEl = document.getElementById('live-date');

  function tick() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    if (dateEl) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-US', options);
    }
  }
  tick();
  setInterval(tick, 1000);
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   TAB NAVIGATION (MAIN APPS & ADMIN)
   ========================================================================== */
function switchMainTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.className = 'tab-btn flex-1 min-w-[76px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 text-white bg-white/[0.14] shadow-sm';
    } else {
      btn.className = 'tab-btn flex-1 min-w-[76px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.05]';
    }
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    if (view.id === `view-${tabName}`) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  closeDrawer();
  refreshIcons();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admintab-btn').forEach(btn => {
    if (btn.dataset.admintab === tabName) {
      btn.className = 'admintab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 whitespace-nowrap';
    } else {
      btn.className = 'admintab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white whitespace-nowrap';
    }
  });

  document.querySelectorAll('.admin-panel').forEach(panel => {
    if (panel.id === `admin-panel-${tabName}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  refreshIcons();
}

/* ==========================================================================
   LANGUAGE TOGGLE
   ========================================================================== */
function toggleLanguage() {
  state.lang = state.lang === 'en' ? 'ar' : 'en';
  localStorage.setItem('coc_lang', state.lang);
  applyLanguage();
  showToast(state.lang === 'ar' ? 'تم تحويل اللغة إلى العربية' : 'Switched language to English', 'info');
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';

  const badge = document.getElementById('drawer-lang-badge');
  if (badge) badge.textContent = state.lang === 'en' ? 'English' : 'العربية';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[state.lang] && i18n[state.lang][key]) {
      el.textContent = i18n[state.lang][key];
    }
  });

  populateCategoryFilters();
  renderTasks();
  applySettings();
}

/* ==========================================================================
   1-CLICK PWA INSTALLATION TRIGGER
   ========================================================================== */
async function handlePwaInstall() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('User PWA install response:', choice.outcome);
      if (choice.outcome === 'accepted') {
        showToast('App installed to your home screen!', 'success');
      }
      deferredPrompt = null;
      window.deferredPrompt = null;
      closeDrawer();
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  } else {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      showCustomAlert(
        'Install on iOS Safari',
        state.lang === 'ar' 
          ? 'لتثبيت التطبيق على الآيفون: اضغط على زر المشاركة (Share) في متصفح سفاري، ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
          : 'To install on iOS: Tap the Share button in Safari, then select "Add to Home Screen".'
      );
    } else {
      showToast('This app is already installed or ready in your browser menu.', 'info');
    }
  }
}

/* ==========================================================================
   INITIALIZATION & EVENT BINDINGS
   ========================================================================== */
function attachEventHandlers() {
  // 1. Drawer open & close
  const openDrawerBtn = document.getElementById('btn-open-drawer');
  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  const drawerBackdrop = document.getElementById('side-drawer-backdrop');

  if (openDrawerBtn) openDrawerBtn.onclick = openDrawer;
  if (closeDrawerBtn) closeDrawerBtn.onclick = closeDrawer;
  if (drawerBackdrop) drawerBackdrop.onclick = closeDrawer;

  // 2. Navigation items
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchMainTab(btn.dataset.tab);
  });

  document.getElementById('drawer-nav-tasks')?.addEventListener('click', () => switchMainTab('tasks'));
  document.getElementById('drawer-nav-attendance')?.addEventListener('click', () => switchMainTab('attendance'));
  document.getElementById('drawer-nav-leaderboard')?.addEventListener('click', () => switchMainTab('leaderboard'));
  document.getElementById('drawer-nav-notifications')?.addEventListener('click', () => switchMainTab('notifications'));
  document.getElementById('btn-open-notifications')?.addEventListener('click', () => switchMainTab('notifications'));

  // 3. Drawer actions
  document.getElementById('drawer-btn-lang')?.addEventListener('click', toggleLanguage);
  document.getElementById('drawer-btn-pwa')?.addEventListener('click', handlePwaInstall);
  document.getElementById('drawer-btn-admin')?.addEventListener('click', openAdminPortal);
  document.getElementById('drawer-btn-google-signin')?.addEventListener('click', handleGoogleSignIn);
  document.getElementById('drawer-btn-signout')?.addEventListener('click', handleSignOut);
  document.getElementById('drawer-profile-card')?.addEventListener('click', openEditProfileModal);

  // 4. Modal Close Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.onclick = (e) => {
      const modal = e.target.closest('.fixed');
      if (modal) {
        modal.classList.add('hidden');
        if (modal.id === 'modal-admin-dashboard') {
          if (window.location.hash === '#admin' || window.location.hash === '#admin-dashboard') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      }
    };
  });

  // Dedicated Admin Close Button
  document.getElementById('btn-close-admin-dashboard')?.addEventListener('click', () => {
    document.getElementById('modal-admin-dashboard')?.classList.add('hidden');
    if (window.location.hash === '#admin' || window.location.hash === '#admin-dashboard') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });

  // 5. Auth Buttons
  document.getElementById('btn-auth-google')?.addEventListener('click', handleGoogleSignIn);
  document.getElementById('form-auth-local')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-local-name').value.trim();
    if (!name) return;
    state.user = {
      uid: 'local_' + Date.now(),
      displayName: name,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@cocmedia.local`,
      photoURL: './image_ad59c0.jpg',
      points: 0,
      totalPenalties: 0,
      isAdmin: false,
      role: 'member',
      streakDays: 1
    };
    updateProfileUI();
    document.getElementById('modal-auth')?.classList.add('hidden');
    showToast(`Welcome, ${name}!`, 'success');
  });

  // 6. Admin Password Auth Form Modal
  document.getElementById('form-admin-auth')?.addEventListener('submit', handleAdminAuthSubmit);

  // 7. Admin Tab Navigation
  document.querySelectorAll('.admintab-btn').forEach(btn => {
    btn.onclick = () => switchAdminTab(btn.dataset.admintab);
  });

  // 8. Admin Task Form Triggers
  document.getElementById('btn-admin-add-task')?.addEventListener('click', () => openAdminTaskForm(null));
  document.getElementById('btn-cancel-task-form')?.addEventListener('click', () => {
    document.getElementById('admin-task-form-container').classList.add('hidden');
  });
  document.getElementById('form-manage-task')?.addEventListener('submit', handleAdminTaskSave);

  // 9. Admin Attendance Form
  document.getElementById('form-manage-session')?.addEventListener('submit', handleAdminSessionSave);
  document.getElementById('btn-cancel-session-form')?.addEventListener('click', () => {
    document.getElementById('form-manage-session').reset();
    document.getElementById('input-session-id').value = '';
    document.getElementById('admin-session-form-title').textContent = 'Create Attendance Session';
    document.getElementById('btn-cancel-session-form').classList.add('hidden');
  });

  // 10. Admin Categories Form
  document.getElementById('btn-admin-add-category')?.addEventListener('click', () => openCategoryForm(null));
  document.getElementById('btn-cancel-category-form')?.addEventListener('click', () => {
    document.getElementById('admin-category-form-container').classList.add('hidden');
  });
  document.getElementById('form-manage-category')?.addEventListener('submit', handleCategorySave);
  document.querySelectorAll('.preset-color-btn').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('input-cat-color').value = btn.dataset.preset;
    };
  });

  // 11. Admin Announcements & Settings
  document.getElementById('form-admin-announcement')?.addEventListener('submit', handleAdminAnnouncement);
  document.getElementById('btn-clear-announcement')?.addEventListener('click', handleClearAnnouncement);
  document.getElementById('form-admin-settings')?.addEventListener('submit', handleAdminSettings);
  document.getElementById('btn-reset-logo')?.addEventListener('click', () => {
    document.getElementById('input-settings-logourl').value = './image_ad59c0.jpg';
    showToast('Reset logo to default emblem.', 'info');
  });

  // 12. Adjust Points & Direct Notification Forms
  document.getElementById('btn-adjust-type-add')?.addEventListener('click', () => {
    currentAdjustType = 'add';
    updateAdjustTypeButtons();
  });
  document.getElementById('btn-adjust-type-deduct')?.addEventListener('click', () => {
    currentAdjustType = 'deduct';
    updateAdjustTypeButtons();
  });
  document.getElementById('form-admin-adjust-points')?.addEventListener('submit', handleAdminAdjustPoints);
  document.getElementById('form-admin-direct-notification')?.addEventListener('submit', handleAdminDirectNotification);
  document.getElementById('form-admin-edit-log')?.addEventListener('submit', handleSaveEditLog);

  // 13. Submit Task Modal
  document.getElementById('form-submit-task')?.addEventListener('submit', handleTaskSubmitForm);

  // 14. Edit Profile
  document.getElementById('btn-open-edit-profile')?.addEventListener('click', openEditProfileModal);
  document.getElementById('form-edit-profile')?.addEventListener('submit', handleEditProfileSubmit);
  document.getElementById('btn-preset-default-avatar')?.addEventListener('click', () => {
    document.getElementById('input-edit-profile-avatar').value = './image_ad59c0.jpg';
    document.getElementById('edit-profile-preview').src = './image_ad59c0.jpg';
  });

  // 15. Search & Filters
  document.getElementById('input-search-tasks')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderTasks();
  });
  document.getElementById('select-status-filter')?.addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    renderTasks();
  });
  document.getElementById('input-admin-search-members')?.addEventListener('input', renderAdminMembers);

  // 16. Leaderboard Period
  document.querySelectorAll('.leader-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.leader-period-btn').forEach(b => {
        b.className = 'leader-period-btn px-3 py-1 rounded-lg font-medium text-neutral-400 hover:text-white';
      });
      btn.className = 'leader-period-btn px-3 py-1 rounded-lg font-medium text-white bg-white/10';
      state.leaderboardPeriod = btn.dataset.period;
      renderLeaderboard();
    };
  });

  // 17. Close announcement button
  document.getElementById('btn-close-announcement')?.addEventListener('click', () => {
    document.getElementById('announcement-bar').classList.add('hidden');
  });

  // 18. Route Guard hash listener
  window.addEventListener('hashchange', checkRouteGuard);
}

// Fail-safe dark loader dismissal (2.5s absolute maximum)
function dismissLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      loader.remove();
    }, 350);
  }
}

// App Bootstrap
async function initApp() {
  applyLanguage();
  startLiveClock();
  attachEventHandlers();

  // Listen to Firebase Auth state
  if (auth) {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        await syncUserRecord(u);
      } else {
        state.user = null;
        updateProfileUI();
      }
      renderTasks();
      renderAttendanceView();
      renderLeaderboard();
      dismissLoader();
      checkRouteGuard();
    });
  }

  // Connect Firestore Real-Time Subscriptions
  initFirestoreListeners();

  // Fail-safe loader dismissal after 2.5s maximum
  setTimeout(dismissLoader, 2500);

  // Initial Route Guard Check
  checkRouteGuard();
  refreshIcons();
}

// Launch on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
