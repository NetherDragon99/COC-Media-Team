/**
 * ============================================================================
 * COC Media Team - Production Web App (v2.1.9)
 * Static PWA for GitHub Pages - Vanilla JS ES Modules + Firebase v10.8.1 CDN
 * Designed & Developed by Steven Mario
 * ============================================================================
 * 
 * SETUP & ARCHITECTURE README:
 * 1. INITIAL ADMIN SETUP:
 *    The first administrator MUST be assigned manually in the Firebase Console:
 *    navigate to Firestore -> `users/{uid}` and set `role: "admin"`.
 *    There is strictly no in-app self-promotion to prevent unauthorized privilege escalation.
 * 
 * 2. DEPLOY RULES & INDEXES:
 *    Deploy security rules and database indexes via the Firebase CLI:
 *    `firebase deploy --only firestore:rules,firestore:indexes`
 * 
 * 3. FREE SPARK PLAN RESTRICTIONS:
 *    This project operates entirely on the free Firebase Spark plan. There are NO
 *    Cloud Functions, Blaze-only APIs, or server-side background runners used anywhere.
 *    All quota, streak, schedule, and attendance calculations occur client-side.
 * 
 * 4. FIREBASE AUTH & AUTHORIZED DOMAINS:
 *    Add your GitHub Pages custom domain or `username.github.io` in:
 *    Firebase Console -> Authentication -> Settings -> Authorized domains.
 *    `signInWithPopup` is our primary authentication strategy. In environments where
 *    popups are blocked or unsupported, the app seamlessly falls back to `signInWithRedirect`.
 *    (Note: redirect sign-in can fail in private tabs where third-party storage is blocked,
 *    so popup remains the primary mode).
 * ============================================================================
 */

// SINGLE SOURCE OF TRUTH FOR APP VERSION
export const APP_VERSION = '2.1.9';

/* ==========================================================================
   GLOBAL PWA INSTALL PROMPT CAPTURE
   ========================================================================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.deferredPrompt = e;
  const pwaBtn = document.getElementById('drawer-btn-pwa');
  if (pwaBtn && !isAppStandalone()) {
    pwaBtn.classList.remove('hidden');
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const pwaBtn = document.getElementById('drawer-btn-pwa');
  if (pwaBtn) pwaBtn.classList.add('hidden');
  toast('COC Media installed successfully!', 'success');
});

function isAppStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/* ==========================================================================
   FIREBASE CDN MODULAR IMPORTS (v10.8.1)
   ========================================================================== */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  setPersistence,
  browserLocalPersistence,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  Timestamp,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  increment,
  getDocFromServer,
  getAggregateFromServer,
  getCountFromServer,
  arrayUnion,
  arrayRemove,
  sum,
  query,
  limit,
  where,
  orderBy,
  startAfter,
  writeBatch,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';

/* ==========================================================================
   FIREBASE CONFIGURATION & INITIALIZATION
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
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  // Initialize Firestore with robust multi-tab persistent cache
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (cacheErr) {
    console.warn('Persistent multi-tab cache failed, fallback to getFirestore:', cacheErr);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase init failed:", e);
}

// Master password for emergency admin access
const ADMIN_MASTER_PASSWORD = '$J@@s#COC1982';

/* ==========================================================================
   SHARED ADMIN HELPERS (Task 5)
   ========================================================================== */
export function createNotification(batch, { uid, title, message, body, type = 'system', icon = 'bell', targetAction = null, refId = null }) {
  const notifRef = doc(collection(db, 'notifications'));
  batch.set(notifRef, {
    uid,
    title,
    message: message || body || '',
    body: body || message || '',
    type,
    icon: icon || 'bell',
    targetAction: targetAction || null,
    refId,
    read: false,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  return notifRef;
}

export function logAdminAction(batch, { action, targetUid = null, details = {} }) {
  const logRef = doc(collection(db, 'admin_logs'));
  batch.set(logRef, {
    adminUid: state.user?.uid || 'admin',
    action,
    targetUid,
    details: typeof details === 'string' ? { message: details } : details,
    at: serverTimestamp()
  });
  return logRef;
}

/* ==========================================================================
   FIRESTORE LISTENER MANAGER
   ========================================================================== */
export const listeners = {
  _map: new Map(),
  add(key, unsubscribe) {
    if (this._map.has(key)) {
      try { this._map.get(key)(); } catch (e) { /* ignore */ }
    }
    this._map.set(key, unsubscribe);
  },
  clear(prefix = '') {
    for (const [key, unsub] of this._map.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        try { unsub(); } catch (e) { /* ignore */ }
        this._map.delete(key);
      }
    }
  }
};

/* ==========================================================================
   SAFE INITIALIZER RUNNER (Boot error isolation)
   ========================================================================== */
export function safeInit(name, fn) {
  try {
    if (typeof fn === 'function') fn();
  } catch (err) {
    console.error(`[init:${name}]`, err);
    // Non-fatal: do NOT let one secondary component crash the whole app / trigger error boundary
  }
}

/* ==========================================================================
   SHARED TICKER SERVICE (Task 2 - Performance & Overheating)
   ========================================================================== */
export const ticker = {
  _subscribers: new Map(),
  _timer: null,
  _baseInterval: 1000,
  _isPaused: false,

  subscribe(idOrFn, fnOrInterval = 1000, intervalMs = 1000) {
    let id, fn, interval;
    if (typeof idOrFn === 'function') {
      id = 'sub_' + Math.random().toString(36).slice(2, 9);
      fn = idOrFn;
      interval = typeof fnOrInterval === 'number' ? fnOrInterval : 1000;
    } else {
      id = String(idOrFn);
      fn = fnOrInterval;
      interval = typeof intervalMs === 'number' ? intervalMs : 1000;
    }
    this._subscribers.set(id, {
      fn,
      intervalMs: Math.max(50, interval),
      lastRun: Date.now()
    });
    this._ensureRunning();
    return () => this.unsubscribe(id);
  },

  unsubscribe(id) {
    this._subscribers.delete(id);
    if (this._subscribers.size === 0) {
      this._stop();
    }
  },

  _ensureRunning() {
    if (this._timer || this._isPaused) return;
    const minInterval = this._subscribers.size > 0
      ? Math.min(...Array.from(this._subscribers.values()).map(s => s.intervalMs))
      : this._baseInterval;
    this._timer = setInterval(() => this._tick(), Math.max(50, Math.min(1000, minInterval)));
  },

  _stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  _tick() {
    if (this._isPaused || (typeof document !== 'undefined' && document.hidden)) return;
    const now = Date.now();
    for (const [id, sub] of this._subscribers.entries()) {
      if (now - sub.lastRun >= sub.intervalMs) {
        sub.lastRun = now;
        try {
          sub.fn(serverNow());
        } catch (e) {
          console.warn('Ticker error in ' + id + ':', e);
        }
      }
    }
  },

  initVisibility() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._isPaused = true;
        this._stop();
      } else {
        this._isPaused = false;
        this._tick();
        this._ensureRunning();
      }
    });
  }
};
ticker.initVisibility();


/* ==========================================================================
   SERVER CLOCK & OFFSET SYNCHRONIZATION
   ========================================================================== */
let serverOffsetMs = 0;
let lastForegroundSync = Date.now();

export function serverNow() {
  return Date.now() + serverOffsetMs;
}

export async function initServerClock() {
  if (!auth?.currentUser || !navigator.onLine) return;
  try {
    const uid = auth.currentUser.uid;
    const privRef = doc(db, 'users_private', uid);
    // Write lastSeenAt to private doc to eliminate public push storms
    await setDoc(privRef, { lastSeenAt: serverTimestamp() }, { merge: true });
    const snap = await getDocFromServer(privRef);
    if (snap.exists()) {
      const serverTime = snap.data()?.lastSeenAt?.toMillis ? snap.data().lastSeenAt.toMillis() : Date.now();
      serverOffsetMs = serverTime - Date.now();
    }
  } catch (err) {
    console.warn('Server clock sync failed (preserving previous offset):', err);
  }
}

// Resync clock when returning to foreground after 30+ minutes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    if (Date.now() - lastForegroundSync > 30 * 60 * 1000) {
      lastForegroundSync = Date.now();
      initServerClock();
    }
  }
});

/* ==========================================================================
   APPLICATION STATE
   ========================================================================== */
const state = {
  user: null, // { uid, name, avatarUrl, role:"member", points:0, penalties:0, lastOpId:null }
  userPrivate: null, // { email:"", fcmTokens:[] }
  currentFcmToken: null,
  isAdminUnlocked: false,
  tasks: [],
  categories: [
    { id: 'video', nameEn: 'Video Editing', color: '#0A84FF', icon: 'film' },
    { id: 'social', nameEn: 'Social Media', color: '#EC4899', icon: 'share-2' },
    { id: 'stream', nameEn: 'Live Streaming', color: '#10B981', icon: 'radio' },
    { id: 'design', nameEn: 'Graphic Design', color: '#F59E0B', icon: 'palette' },
    { id: 'sound', nameEn: 'Sound Engineering', color: '#8B5CF6', icon: 'mic-2' },
    { id: 'photo', nameEn: 'Photography', color: '#06B6D4', icon: 'camera' }
  ],
  attendanceSessions: [],
  attendanceLogs: [],
  myAttendanceLogs: [],
  waiverRequests: [],
  myWaiverRequests: [],
  adminAttendanceFilter: 'active',
  appliedMissedPenalties: new Set(),
  leaderboardPeriodUserOverridden: false,
  submissions: [],
  mySubmissions: [],
  notifications: [],
  personalNotifications: [],
  broadcastNotificationsAll: [],
  broadcastNotificationsBadge: [],
  members: [],
  broadcasts: [],
  editingBroadcastId: null,
  selectedCategory: 'all',
  searchQuery: '',
  statusFilter: 'all',
  leaderboardPeriod: 'all',
  editingTaskId: null,
  editingCategoryId: null,
  editingSessionId: null,
  adminTasksFilter: 'active',
  adminCatsFilter: 'active',
  adminSessionsFilter: 'active',
  adminBroadcastsFilter: 'active',
  adminSubmissionsLimit: 50,
  hasMoreSubmissions: false,
  adminSubmissionsSearch: '',
  adminSubmissionsTaskFilter: 'all',
  adminMembersLimit: 50,
  hasMoreMembers: false,
  adminMembersSearch: '',
  adminMembersRoleFilter: 'all',
  settings: {
    appName: 'COC Media Team',
    subtitleEn: 'Production Task, Quota & Attendance Platform',
    announcementEn: '',
    logoUrl: './image_ad59c0.jpg',
    developerCredit: 'Designed & Developed by Steven Mario',
    version: APP_VERSION
  }
};

/* ==========================================================================
   MODULE-LEVEL ADMIN FILTER & EDITING STATE (Hoisted module scope)
   ========================================================================== */
export let adminTasksFilter = 'active';
export let adminCatsFilter = 'active';
export let adminCategoriesFilter = 'active';
export let adminSessionsFilter = 'active';
export let adminBroadcastsFilter = 'active';
export let adminSubmissionsFilter = 'all';
export let adminMembersFilter = 'all';
export let statusFilter = 'all';
export let selectedCategory = 'all';
export let searchQuery = '';
export let leaderboardPeriod = 'all';
export let editingTaskId = null;
export let editingCategoryId = null;
export let editingSessionId = null;
export let editingBroadcastId = null;

/* ==========================================================================
   CATEGORY ICONS & COLOR SWATCHES
   ========================================================================== */
export const IOS_SYSTEM_COLORS = [
  { name: 'System Blue', hex: '#0A84FF' },
  { name: 'Green', hex: '#30D158' },
  { name: 'Red', hex: '#FF453A' },
  { name: 'Orange', hex: '#FF9F0A' },
  { name: 'Yellow', hex: '#FFD60A' },
  { name: 'Pink', hex: '#FF375F' },
  { name: 'Purple', hex: '#BF5AF2' },
  { name: 'Teal', hex: '#64D2FF' },
  { name: 'Indigo', hex: '#5E5CE6' },
  { name: 'Brown', hex: '#A2845E' },
  { name: 'Mint', hex: '#00C7BE' },
  { name: 'Cyan', hex: '#32ADE6' },
  { name: 'Gray', hex: '#8E8E93' },
  { name: 'Dark Gray', hex: '#636366' }
];

export const CATEGORY_COLORS = IOS_SYSTEM_COLORS.map(c => c.hex);

export const CATEGORY_ICONS = {
  camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>`,
  video: `<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>`,
  clapperboard: `<path d="M20.2 6 3 11l-.9-2.4c-.3-.8.2-1.7 1-2l14.8-4.3c.8-.3 1.7.2 2 1L20.2 6z"></path><rect x="2" y="8" width="20" height="14" rx="2"></rect><path d="M7 8l3-5"></path><path d="M12 8l3-5"></path>`,
  microphone: `<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>`,
  headphones: `<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>`,
  palette: `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.6-10-9.6z"></path>`,
  sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>`,
  monitor: `<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
  broadcast: `<path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path><path d="M7.76 16.24a6 6 0 0 1 0-8.48"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.48"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`,
  reel: `<circle cx="12" cy="12" r="10"></circle><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"></path>`,
  photo: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>`,
  lightning: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`,
  pen: `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>`,
  globe: `<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>`,
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>`,
  star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
  film: `<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line>`,
  music: `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`,
  layers: `<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`,
  scissors: `<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>`,
  wand: `<path d="m15 4 5 5"></path><path d="m18 1 5 5"></path><path d="M2 22 17 7"></path><path d="M8 2l.7 2.1L11 5l-2.3.9L8 8l-.7-2.1L5 5l2.3-.9Z"></path>`,
  megaphone: `<path d="m3 11 18-5v12L3 13v-2z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`,
  heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`
};

export function getCategorySvg(iconKey, className = 'w-4 h-4') {
  if (CATEGORY_ICONS[iconKey]) {
    return `<svg class="${className} stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24">${CATEGORY_ICONS[iconKey]}</svg>`;
  }
  return getIconSvg(iconKey, className);
}

export function formatDateTime(ts, options = {}) {
  if (!ts) return '';
  const ms = typeof ts === 'number' ? ts : (ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime()));
  if (isNaN(ms)) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  }).format(new Date(ms));
}

/* ==========================================================================
   LEGACY COMPATIBILITY NORMALIZERS
   ========================================================================== */
// Assumption: legacy docs may lack fields; assign default values client-side
function normalizeCategory(raw) {
  if (!raw) return null;
  return {
    id: raw.id || '',
    name: raw.name || raw.nameEn || raw.title || 'General',
    nameEn: raw.name || raw.nameEn || raw.title || 'General',
    iconKey: raw.iconKey || raw.icon || 'film',
    icon: raw.iconKey || raw.icon || 'film',
    color: raw.color || '#0A84FF',
    archived: Boolean(raw.archived)
  };
}

function normalizeTask(raw) {
  if (!raw) return null;
  const categoryId = raw.categoryId || raw.category || 'general';
  const durationMinutes = typeof raw.durationMinutes === 'number'
    ? raw.durationMinutes
    : (raw.duration ? parseInt(raw.duration, 10) || null : null);

  const tieredRewards = raw.tieredRewards ? {
    enabled: Boolean(raw.tieredRewards.enabled),
    earlyBonusMinutes: typeof raw.tieredRewards.earlyBonusMinutes === 'number' ? raw.tieredRewards.earlyBonusMinutes : (Number(raw.tieredRewards.earlyBonusMinutes) || 1440),
    earlyPoints: typeof raw.tieredRewards.earlyPoints === 'number' ? raw.tieredRewards.earlyPoints : (Number(raw.tieredRewards.earlyPoints) || 15),
    onTimePoints: typeof raw.tieredRewards.onTimePoints === 'number' ? raw.tieredRewards.onTimePoints : (Number(raw.tieredRewards.onTimePoints) || 10),
    graceMinutes: typeof raw.tieredRewards.graceMinutes === 'number' ? raw.tieredRewards.graceMinutes : (Number(raw.tieredRewards.graceMinutes) || 120),
    gracePoints: typeof raw.tieredRewards.gracePoints === 'number' ? raw.tieredRewards.gracePoints : (Number(raw.tieredRewards.gracePoints) || 5)
  } : {
    enabled: false,
    earlyBonusMinutes: 1440,
    earlyPoints: 15,
    onTimePoints: 10,
    graceMinutes: 120,
    gracePoints: 5
  };

  const missedPenalty = raw.missedPenalty ? {
    enabled: Boolean(raw.missedPenalty.enabled),
    points: typeof raw.missedPenalty.points === 'number' ? raw.missedPenalty.points : (Number(raw.missedPenalty.points) || 5)
  } : {
    enabled: false,
    points: 5
  };

  const assignedUids = Array.isArray(raw.assignedUids) ? raw.assignedUids : [];

  return {
    id: raw.id || '',
    title: raw.title || raw.titleEn || (raw.titleAr ? 'Untitled Task' : 'Task'),
    description: raw.description || raw.descEn || raw.descAr || '',
    categoryId,
    category: categoryId,
    points: typeof raw.points === 'number' ? raw.points : 5,
    tieredRewards,
    missedPenalty,
    assignedUids,
    schedule: raw.schedule || { type: 'once', startDateTime: raw.startDate || raw.startDateTime || Date.now() },
    isPermanent: Boolean(raw.isPermanent),
    durationMinutes: raw.isPermanent ? null : durationMinutes,
    questions: Array.isArray(raw.questions) ? raw.questions : (raw.enableQuestion && raw.questionPrompt ? [{ id: 'q1', questionText: raw.questionPrompt, isRequired: true }] : []),
    active: raw.active !== false && raw.status !== 'archived',
    archived: Boolean(raw.archived || raw.status === 'archived'),
    status: raw.status || (raw.archived ? 'archived' : 'active'),
    link: raw.link || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
}

export const usersMap = new Map();
export const usersPrivate = new Map();

export function normalizeUser(raw) {
  if (!raw) return null;
  const name = raw.name || raw.displayName || 'Team Member';
  const avatarUrl = raw.avatarUrl || raw.photoURL || '';
  const penalties = typeof raw.penalties === 'number' ? raw.penalties : (typeof raw.totalPenalties === 'number' ? raw.totalPenalties : 0);
  const badges = Array.isArray(raw.badges) ? raw.badges : [];
  const badgeIds = Array.isArray(raw.badgeIds)
    ? raw.badgeIds
    : badges.map(b => (typeof b === 'string' ? b : b?.id)).filter(Boolean);

  return {
    uid: raw.uid || '',
    name,
    displayName: name,
    avatarUrl,
    photoURL: avatarUrl,
    role: raw.role || 'member',
    isAdmin: Boolean(raw.isAdmin || raw.role === 'admin'),
    points: typeof raw.points === 'number' ? raw.points : 0,
    penalties,
    totalPenalties: penalties,
    monthBucket: raw.monthBucket || '',
    monthPoints: typeof raw.monthPoints === 'number' ? raw.monthPoints : 0,
    weekBucket: raw.weekBucket || '',
    weekPoints: typeof raw.weekPoints === 'number' ? raw.weekPoints : 0,
    badges,
    badgeIds,
    streakDays: typeof raw.streakDays === 'number' ? raw.streakDays : 0,
    lastOpId: raw.lastOpId || null,
    lastSeenAt: raw.lastSeenAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
}

export function getUserProfile(uid, fallbackName = 'Member', fallbackAvatar = '') {
  if (uid && usersMap.has(uid)) {
    const u = usersMap.get(uid);
    return {
      uid: u.uid,
      name: u.name || u.displayName || fallbackName,
      displayName: u.displayName || u.name || fallbackName,
      avatarUrl: u.avatarUrl || u.photoURL || fallbackAvatar,
      photoURL: u.photoURL || u.avatarUrl || fallbackAvatar,
      role: u.role || 'member',
      isAdmin: Boolean(u.isAdmin),
      points: u.points || 0,
      penalties: u.penalties || 0,
      monthBucket: u.monthBucket || '',
      monthPoints: u.monthPoints || 0,
      weekBucket: u.weekBucket || '',
      weekPoints: u.weekPoints || 0,
      badges: u.badges || [],
      badgeIds: u.badgeIds || []
    };
  }
  return {
    uid: uid || '',
    name: fallbackName,
    displayName: fallbackName,
    avatarUrl: fallbackAvatar,
    photoURL: fallbackAvatar,
    role: 'member',
    isAdmin: false,
    points: 0,
    penalties: 0,
    monthBucket: '',
    monthPoints: 0,
    weekBucket: '',
    weekPoints: 0,
    badges: [],
    badgeIds: []
  };
}

function normalizeWaiverRequest(raw) {
  if (!raw) return null;
  return {
    id: raw.id || '',
    sessionId: raw.sessionId || '',
    sessionTitle: raw.sessionTitle || 'Session',
    occurrenceKey: raw.occurrenceKey || 'once',
    occurrenceStart: raw.occurrenceStart || null,
    uid: raw.uid || '',
    userName: raw.userName || 'Member',
    userAvatar: raw.userAvatar || '',
    reason: raw.reason || '',
    category: raw.category || '',
    status: raw.status || 'pending',
    adminNote: raw.adminNote || '',
    createdAt: raw.createdAt || null,
    resolvedAt: raw.resolvedAt || null,
    resolvedBy: raw.resolvedBy || null
  };
}

function normalizeAttendanceLog(raw) {
  if (!raw) return null;
  const uid = raw.uid || raw.userId || '';
  return {
    id: raw.id || '',
    sessionId: raw.sessionId || '',
    sessionTitle: raw.sessionTitle || 'Session',
    uid,
    userId: uid,
    userName: raw.userName || raw.name || raw.displayName || 'Member',
    userEmail: raw.userEmail || '',
    userAvatar: raw.userAvatar || raw.avatarUrl || raw.photoURL || '',
    occurrenceKey: raw.occurrenceKey || 'once',
    occurrenceStart: raw.occurrenceStart || null,
    checkedInAt: raw.checkedInAt || raw.timestamp || raw.createdAt || null,
    timestamp: raw.checkedInAt || raw.timestamp || raw.createdAt || null,
    status: raw.status || (raw.isLate ? 'late' : 'on_time'),
    isLate: raw.status === 'late' || Boolean(raw.isLate),
    delaySeconds: typeof raw.delaySeconds === 'number' ? raw.delaySeconds : 0,
    penalty: typeof raw.penalty === 'number' ? raw.penalty : (typeof raw.penaltyApplied === 'number' ? raw.penaltyApplied : 0),
    penaltyApplied: typeof raw.penalty === 'number' ? raw.penalty : (typeof raw.penaltyApplied === 'number' ? raw.penaltyApplied : 0),
    fineEGP: typeof raw.fineEGP === 'number' ? raw.fineEGP : 0,
    penaltyUnit: raw.penaltyUnit || 'minutes',
    pointsEarned: typeof raw.pointsEarned === 'number' ? raw.pointsEarned : 0
  };
}

function normalizeSubmission(raw) {
  if (!raw) return null;
  const uid = raw.uid || raw.userId || '';
  return {
    id: raw.id || '',
    taskId: raw.taskId || '',
    taskTitle: raw.taskTitle || 'Task',
    uid,
    userId: uid,
    userName: raw.userName || raw.name || raw.displayName || 'Member',
    userEmail: raw.userEmail || '',
    userAvatar: raw.userAvatar || raw.avatarUrl || raw.photoURL || '',
    occurrenceKey: raw.occurrenceKey || 'once',
    answers: Array.isArray(raw.answers) ? raw.answers : [],
    comment: raw.comment || raw.notes || '',
    notes: raw.comment || raw.notes || '',
    pointsAwarded: typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded : 5,
    submittedAt: raw.submittedAt || raw.createdAt || null
  };
}

function normalizeNotification(raw) {
  if (!raw) return null;
  return {
    id: raw.id || '',
    title: raw.title || 'Notification',
    body: raw.body || raw.message || '',
    message: raw.message || raw.body || '',
    type: raw.type || 'system',
    icon: raw.icon || 'bell',
    targetAction: raw.targetAction || null,
    targetUserId: raw.targetUserId || raw.uid || 'all',
    uid: raw.uid || '',
    timestamp: raw.timestamp || raw.createdAt || null,
    createdAt: raw.createdAt || raw.timestamp || null,
    read: Boolean(raw.read),
    readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
    link: raw.link || ''
  };
}

// PRESET_BADGES hoisted above

export function getAllAvailableBadges() {
  const badgeMap = new Map();
  PRESET_BADGES.forEach(b => badgeMap.set(b.id, { ...b }));
  (state.badges || []).forEach(b => {
    if (b && b.id) {
      badgeMap.set(b.id, {
        id: b.id,
        label: b.label || b.name || b.nameEn || b.id,
        description: b.description || '',
        color: b.color || '#0A84FF',
        icon: b.icon || 'star'
      });
    }
  });
  (state.members || []).forEach(m => {
    (m.badges || []).forEach(b => {
      const norm = typeof b === 'string' ? { id: b, label: b, color: '#3A3A3C' } : b;
      if (norm && norm.id && !badgeMap.has(norm.id)) {
        badgeMap.set(norm.id, { id: norm.id, label: norm.label || norm.id, color: norm.color || '#3A3A3C', icon: norm.icon || 'star' });
      }
    });
  });
  return Array.from(badgeMap.values());
}

export function normalizeBroadcast(raw) {
  if (!raw) return null;
  const startMs = raw.startDateTime?.toMillis ? raw.startDateTime.toMillis() : (raw.startDateTime?.seconds ? raw.startDateTime.seconds * 1000 : (typeof raw.startDateTime === 'number' ? raw.startDateTime : new Date(raw.startDateTime || 0).getTime()));
  const endMs = raw.endDateTime?.toMillis ? raw.endDateTime.toMillis() : (raw.endDateTime?.seconds ? raw.endDateTime.seconds * 1000 : (typeof raw.endDateTime === 'number' ? raw.endDateTime : new Date(raw.endDateTime || 0).getTime()));

  const icon = raw.icon || raw.iconKey || 'megaphone';
  const targetType = (raw.targetType === 'badge') ? 'badge' : 'all';
  const badgeIds = Array.isArray(raw.badgeIds) ? raw.badgeIds : [];
  const customFooter = typeof raw.customFooter === 'string' ? raw.customFooter.trim() : '';
  const archived = Boolean(raw.archived);

  return {
    id: raw.id || '',
    title: raw.title || '',
    description: raw.description || '',
    durationSeconds: typeof raw.durationSeconds === 'number' && raw.durationSeconds >= 3 && raw.durationSeconds <= 30 ? raw.durationSeconds : (typeof raw.durationSeconds === 'number' && raw.durationSeconds > 0 ? raw.durationSeconds : 5),
    startDateTime: isNaN(startMs) ? 0 : startMs,
    endDateTime: isNaN(endMs) ? 0 : endMs,
    icon,
    targetType,
    badgeIds,
    customFooter,
    archived,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
}

// ==== ENGINE START
// Editable application timezone constant
const APP_TIMEZONE = "Africa/Cairo";

const ENGINE_WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function getZonedParts(dateOrMs, timeZone = APP_TIMEZONE) {
  const ms = parseDateTimeToMs(dateOrMs);
  const d = new Date(ms || 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hour12: false
  });
  const parts = dtf.formatToParts(d);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1..12
    day: parseInt(map.day, 10), // 1..31
    hour: parseInt(map.hour === '24' ? '0' : map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: map.weekday // 'Sat'..'Fri'
  };
}

function zonedDateToMs(year, month, day, hour = 0, minute = 0, second = 0, timeZone = APP_TIMEZONE) {
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(guessMs, timeZone);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const currentZonedUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = targetUtc - currentZonedUtc;
    if (diff === 0) break;
    guessMs += diff;
  }
  return guessMs;
}

function formatZonedDateKey(dateOrMs, timeZone = APP_TIMEZONE) {
  const p = getZonedParts(dateOrMs, timeZone);
  const y = String(p.year).padStart(4, '0');
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SAT_OFFSET = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };

function offsetFromPickers(daysAfter = 0, startMinuteOfDay = 0, endMinuteOfDay = 0) {
  if (typeof daysAfter === 'object' && daysAfter !== null) {
    const o = daysAfter;
    if (o.isOnce) {
      const s = Number(o.startMs) || 0;
      const d = Number(o.deadlineMs) || 0;
      return Math.round((d - s) / 60000);
    }
    const days = Number(o.daysAfter) || 0;
    let sMin = Number(o.startMinuteOfDay);
    let eMin = Number(o.endMinuteOfDay);
    if (o.startTime && typeof o.startTime === 'string') {
      const [sh, sm] = o.startTime.split(':').map(Number);
      sMin = (sh || 0) * 60 + (sm || 0);
    }
    if (o.deadlineTime && typeof o.deadlineTime === 'string') {
      const [eh, em] = o.deadlineTime.split(':').map(Number);
      eMin = (eh || 0) * 60 + (em || 0);
    }
    const dur = days * 1440 + ((Number(eMin) || 0) - (Number(sMin) || 0));
    if (dur <= 0) {
      throw new Error('Deadline must be after start');
    }
    return dur;
  }
  return (Number(daysAfter) || 0) * 1440 + ((Number(endMinuteOfDay) || 0) - (Number(startMinuteOfDay) || 0));
}

function pickersFromOffset(durationMinutes = 0, startMinuteOfDay = 0) {
  if (typeof durationMinutes === 'object' && durationMinutes !== null) {
    const o = durationMinutes;
    if (o.isOnce) {
      const s = Number(o.startMs) || 0;
      const dur = Number(o.durationMinutes) || 0;
      return { deadlineMs: s + dur * 60000 };
    }
    const dur = Number(o.durationMinutes) || 0;
    let sMin = Number(o.startMinuteOfDay) || 0;
    if (o.startTime && typeof o.startTime === 'string') {
      const [sh, sm] = o.startTime.split(':').map(Number);
      sMin = (sh || 0) * 60 + (sm || 0);
    }
    const total = sMin + dur;
    const daysAfter = Math.floor(total / 1440);
    const endMinuteOfDay = ((total % 1440) + 1440) % 1440;
    const hh = String(Math.floor(endMinuteOfDay / 60)).padStart(2, '0');
    const mm = String(endMinuteOfDay % 60).padStart(2, '0');
    return { daysAfter, endMinuteOfDay, deadlineTime: `${hh}:${mm}` };
  }
  const dur = Number(durationMinutes) || 0;
  const startMin = Number(startMinuteOfDay) || 0;
  const total = startMin + dur;
  const daysAfter = Math.floor(total / 1440);
  const endMinuteOfDay = ((total % 1440) + 1440) % 1440;
  return { daysAfter, endMinuteOfDay };
}

function normalizeTaskTiers(task) {
  if (!task) return { points: 5, onTimePoints: 5, durationMinutes: null, earlyBonus: { enabled: false, untilMinutes: 0, points: 5 }, grace: { enabled: false, untilMinutes: 0 }, missedPenalty: { enabled: false, points: 0 } };
  const onTimePoints = typeof task.points === 'number' ? task.points : (typeof task.tieredRewards?.onTimePoints === 'number' ? task.tieredRewards.onTimePoints : 5);
  const durationMinutes = (typeof task.durationMinutes === 'number' && task.durationMinutes > 0) ? task.durationMinutes : null;

  // Early Bonus: switch; picker defines when window ends (untilMinutes > 0 and < durationMinutes)
  let earlyBonus = { enabled: false, untilMinutes: 0, points: onTimePoints };
  if (task.earlyBonus && typeof task.earlyBonus === 'object') {
    earlyBonus = {
      enabled: Boolean(task.earlyBonus.enabled),
      untilMinutes: Number(task.earlyBonus.untilMinutes) || 0,
      points: typeof task.earlyBonus.points === 'number' ? task.earlyBonus.points : onTimePoints
    };
  } else if (task.tieredRewards) {
    const ebMin = Number(task.tieredRewards.earlyBonusMinutes) || 0;
    if (ebMin > 0 && (task.tieredRewards.enabled !== false)) {
      earlyBonus = {
        enabled: true,
        untilMinutes: ebMin,
        points: typeof task.tieredRewards.earlyPoints === 'number' ? task.tieredRewards.earlyPoints : onTimePoints
      };
    }
  }

  // Grace Period: switch; picker defines cutoff (untilMinutes > durationMinutes). NO grace points!
  let grace = { enabled: false, untilMinutes: 0 };
  if (task.grace && typeof task.grace === 'object') {
    grace = {
      enabled: Boolean(task.grace.enabled),
      untilMinutes: Number(task.grace.untilMinutes) || 0
    };
  } else if (task.tieredRewards && task.tieredRewards.graceMinutes) {
    const gMin = Number(task.tieredRewards.graceMinutes) || 0;
    if (gMin > 0 && durationMinutes && (task.tieredRewards.enabled !== false)) {
      grace = {
        enabled: true,
        untilMinutes: durationMinutes + gMin
      };
    }
  }

  // Missed Penalty: switch + missedPenalty: { enabled, points }
  let missedPenalty = { enabled: false, points: 0 };
  if (task.missedPenalty && typeof task.missedPenalty === 'object') {
    missedPenalty = {
      enabled: Boolean(task.missedPenalty.enabled),
      points: Number(task.missedPenalty.points) || 0
    };
  } else if (task.tieredRewards) {
    const p = Number(task.tieredRewards.missedPenaltyPoints || task.tieredRewards.missedPenalty?.penaltyPoints || task.tieredRewards.missedPenalty?.points) || 0;
    if (p > 0 && (task.tieredRewards.enabled !== false)) {
      missedPenalty = {
        enabled: true,
        points: p
      };
    }
  }

  return { points: onTimePoints, onTimePoints, durationMinutes, earlyBonus, grace, missedPenalty };
}

function weekKeyOf(ms, tz = APP_TIMEZONE) {
  const validMs = parseDateTimeToMs(ms, tz);
  const p = getZonedParts(validMs, tz);
  const offset = SAT_OFFSET[p.weekday] ?? 0;
  const satMs = zonedDateToMs(p.year, p.month, p.day - offset, 12, 0, 0, tz);
  const satParts = getZonedParts(satMs, tz);
  return `${String(satParts.year).padStart(4, '0')}-${String(satParts.month).padStart(2, '0')}-${String(satParts.day).padStart(2, '0')}`;
}

function monthKeyOf(ms, tz = APP_TIMEZONE) {
  const validMs = parseDateTimeToMs(ms, tz);
  const p = getZonedParts(validMs, tz);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}`;
}

function getTimeBucketKeys(nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now()), timeZone = APP_TIMEZONE) {
  const nowMs = parseDateTimeToMs(nowInput, timeZone);
  const curMonthKey = monthKeyOf(nowMs, timeZone);
  const curWeekKey = weekKeyOf(nowMs, timeZone);
  return { curMonthKey, curWeekKey, monthKey: curMonthKey, weekKey: curWeekKey };
}

function buildPointsUpdate(userDocOrMapEntry, deltaPoints, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  const user = userDocOrMapEntry || {};
  const atMs = parseDateTimeToMs(nowInput);
  const wk = weekKeyOf(atMs, APP_TIMEZONE);
  const mo = monthKeyOf(atMs, APP_TIMEZONE);
  const delta = Number(deltaPoints) || 0;

  const update = {
    points: increment(delta)
  };

  if (delta >= 0) {
    if ((user.weekKey || user.weekBucket || '') === wk) {
      update.weekPoints = increment(delta);
    } else {
      update.weekKey = wk;
      update.weekPoints = delta;
    }

    if ((user.monthKey || user.monthBucket || '') === mo) {
      update.monthPoints = increment(delta);
    } else {
      update.monthKey = mo;
      update.monthPoints = delta;
    }
  } else {
    // Negative delta (revoke / edit down / bulk delete of submission): use original submittedAt (atMs)
    if ((user.weekKey || user.weekBucket || '') === wk) {
      const curWk = Number(user.weekPoints) || 0;
      update.weekPoints = Math.max(0, curWk + delta);
    }
    if ((user.monthKey || user.monthBucket || '') === mo) {
      const curMo = Number(user.monthPoints) || 0;
      update.monthPoints = Math.max(0, curMo + delta);
    }
  }

  return update;
}

function getMemberPeriodPoints(userObj, period = 'all', nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  if (!userObj) return 0;
  if (period === 'all') {
    return typeof userObj.points === 'number' ? userObj.points : 0;
  }
  const nowMs = parseDateTimeToMs(nowInput);
  if (period === 'month') {
    const curMonthKey = monthKeyOf(nowMs, APP_TIMEZONE);
    return (userObj.monthKey === curMonthKey || userObj.monthBucket === curMonthKey) ? (userObj.monthPoints || 0) : 0;
  }
  if (period === 'week') {
    const curWeekKey = weekKeyOf(nowMs, APP_TIMEZONE);
    return (userObj.weekKey === curWeekKey || userObj.weekBucket === curWeekKey) ? (userObj.weekPoints || 0) : 0;
  }
  return typeof userObj.points === 'number' ? userObj.points : 0;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDateTimeToMs(val, timeZone = APP_TIMEZONE) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1e6) : 0);
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    if (val.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(val)) {
      return Date.parse(val);
    }
    const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      const hour = m[4] ? parseInt(m[4], 10) : 0;
      const min = m[5] ? parseInt(m[5], 10) : 0;
      const sec = m[6] ? parseInt(m[6], 10) : 0;
      return zonedDateToMs(year, month, day, hour, min, sec, timeZone);
    }
    return Date.parse(val) || 0;
  }
  return 0;
}

function normalizeScheduleObject(input) {
  if (!input) return { type: 'once', startDateTime: 0 };
  if (typeof input === 'string') return { type: input, startDateTime: 0 };
  const type = input.type || 'once';
  return {
    type,
    startDateTime: input.startDateTime || input.startTime || 0,
    days: Array.isArray(input.days) ? input.days : [],
    monthDates: Array.isArray(input.monthDates) ? input.monthDates.map(Number) : [],
    weeks: Array.isArray(input.weeks) ? input.weeks : [],
    weekdays: Array.isArray(input.weekdays) ? input.weekdays : []
  };
}

function getOccurrences(scheduleInput, fromMs, toMs) {
  const sched = normalizeScheduleObject(scheduleInput);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  if (toMs < fromMs || (startMs > toMs && sched.type === 'once')) {
    return [];
  }

  const startParts = getZonedParts(startMs, APP_TIMEZONE);
  const eventHour = startParts.hour;
  const eventMinute = startParts.minute;
  const eventSecond = startParts.second;

  const results = [];

  if (sched.type === 'once') {
    if (startMs >= fromMs && startMs <= toMs) {
      results.push(startMs);
    }
    return results;
  }

  const effectiveFromMs = Math.max(fromMs, startMs);
  const fromParts = getZonedParts(effectiveFromMs, APP_TIMEZONE);
  const toParts = getZonedParts(toMs, APP_TIMEZONE);

  if (sched.type === 'daily') {
    let curYear = fromParts.year;
    let curMonth = fromParts.month;
    let curDay = fromParts.day;

    while (true) {
      const occMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, APP_TIMEZONE);
      if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
        results.push(occMs);
      }
      if (occMs > toMs + 86400000) break;

      curDay++;
      const maxDays = daysInMonth(curYear, curMonth);
      if (curDay > maxDays) {
        curDay = 1;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
      if (curYear > toParts.year || (curYear === toParts.year && (curMonth > toParts.month || (curMonth === toParts.month && curDay > toParts.day)))) {
        const lastCheckMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, APP_TIMEZONE);
        if (lastCheckMs <= toMs && lastCheckMs >= fromMs && lastCheckMs >= startMs) {
          results.push(lastCheckMs);
        }
        break;
      }
    }
  } else if (sched.type === 'weekly') {
    const targetDays = sched.days.length > 0 ? sched.days : [startParts.weekday];
    let curYear = fromParts.year;
    let curMonth = fromParts.month;
    let curDay = fromParts.day;

    while (true) {
      const noonMs = zonedDateToMs(curYear, curMonth, curDay, 12, 0, 0, APP_TIMEZONE);
      const noonParts = getZonedParts(noonMs, APP_TIMEZONE);
      if (targetDays.includes(noonParts.weekday)) {
        const occMs = zonedDateToMs(curYear, curMonth, curDay, eventHour, eventMinute, eventSecond, APP_TIMEZONE);
        if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
          results.push(occMs);
        }
      }

      curDay++;
      const maxDays = daysInMonth(curYear, curMonth);
      if (curDay > maxDays) {
        curDay = 1;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
      if (curYear > toParts.year || (curYear === toParts.year && (curMonth > toParts.month || (curMonth === toParts.month && curDay > toParts.day + 1)))) {
        break;
      }
    }
  } else if (sched.type === 'monthlyDates') {
    const targetDates = sched.monthDates.length > 0 ? sched.monthDates : [startParts.day];
    let curYear = fromParts.year;
    let curMonth = fromParts.month;

    while (true) {
      const maxDays = daysInMonth(curYear, curMonth);
      const resolvedDays = new Set();
      for (const d of targetDates) {
        const resolved = Math.min(Math.max(1, d), maxDays);
        resolvedDays.add(resolved);
      }

      for (const resolvedDay of resolvedDays) {
        const occMs = zonedDateToMs(curYear, curMonth, resolvedDay, eventHour, eventMinute, eventSecond, APP_TIMEZONE);
        if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
          results.push(occMs);
        }
      }

      if (curYear > toParts.year || (curYear === toParts.year && curMonth >= toParts.month)) {
        break;
      }
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  } else if (sched.type === 'monthlyWeekdays') {
    const targetWeeks = sched.weeks.length > 0 ? sched.weeks : ['1st'];
    const targetWeekdays = sched.weekdays.length > 0 ? sched.weekdays : [startParts.weekday];

    let curYear = fromParts.year;
    let curMonth = fromParts.month;

    while (true) {
      const totalDays = daysInMonth(curYear, curMonth);
      const weekdayOccurrences = {};
      for (const wd of ENGINE_WEEKDAYS) {
        weekdayOccurrences[wd] = [];
      }
      for (let day = 1; day <= totalDays; day++) {
        const noonMs = zonedDateToMs(curYear, curMonth, day, 12, 0, 0, APP_TIMEZONE);
        const p = getZonedParts(noonMs, APP_TIMEZONE);
        if (weekdayOccurrences[p.weekday]) {
          weekdayOccurrences[p.weekday].push(day);
        }
      }

      for (const wd of targetWeekdays) {
        const daysList = weekdayOccurrences[wd] || [];
        for (const w of targetWeeks) {
          let chosenDay = null;
          if (w === '1st' && daysList.length >= 1) chosenDay = daysList[0];
          else if (w === '2nd' && daysList.length >= 2) chosenDay = daysList[1];
          else if (w === '3rd' && daysList.length >= 3) chosenDay = daysList[2];
          else if (w === '4th' && daysList.length >= 4) chosenDay = daysList[3];
          else if (w === 'Last' && daysList.length >= 1) chosenDay = daysList[daysList.length - 1];

          if (chosenDay !== null) {
            const occMs = zonedDateToMs(curYear, curMonth, chosenDay, eventHour, eventMinute, eventSecond, APP_TIMEZONE);
            if (occMs >= startMs && occMs >= fromMs && occMs <= toMs) {
              results.push(occMs);
            }
          }
        }
      }

      if (curYear > toParts.year || (curYear === toParts.year && curMonth >= toParts.month)) {
        break;
      }
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  }

  return Array.from(new Set(results)).sort((a, b) => a - b);
}

function getOccurrenceFor(item, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  const sched = normalizeScheduleObject(item?.schedule || item);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  const earlyWindowMs = (item?.earlyWindowMinutes || 0) * 60000;
  const nowMs = parseDateTimeToMs(nowInput);

  if (sched.type === 'once') {
    if (nowMs < startMs - earlyWindowMs) {
      return null;
    }
    return {
      key: 'once',
      start: startMs,
      nextStart: null
    };
  }

  const windowFrom = Math.max(startMs, nowMs - 45 * 86400000);
  const windowTo = nowMs + 45 * 86400000;

  const occs = getOccurrences(sched, windowFrom, windowTo);
  if (occs.length === 0) {
    const futureOccs = getOccurrences(sched, startMs, startMs + 45 * 86400000);
    if (futureOccs.length > 0) {
      const nextOne = futureOccs[0];
      if (earlyWindowMs > 0 && nowMs >= nextOne - earlyWindowMs && nowMs < nextOne) {
        return {
          key: formatZonedDateKey(nextOne, APP_TIMEZONE),
          start: nextOne,
          nextStart: futureOccs[1] || null
        };
      }
    }
    return null;
  }

  const upcomingIdx = occs.findIndex(o => o > nowMs);
  if (earlyWindowMs > 0 && upcomingIdx !== -1) {
    const upcomingStart = occs[upcomingIdx];
    if (nowMs >= upcomingStart - earlyWindowMs) {
      return {
        key: formatZonedDateKey(upcomingStart, APP_TIMEZONE),
        start: upcomingStart,
        nextStart: occs[upcomingIdx + 1] || null
      };
    }
  }

  const pastOccs = occs.filter(o => o <= nowMs);
  if (pastOccs.length === 0) {
    return null;
  }

  const currentStart = pastOccs[pastOccs.length - 1];
  const nextOcc = occs.find(o => o > currentStart) || null;

  return {
    key: formatZonedDateKey(currentStart, APP_TIMEZONE),
    start: currentStart,
    nextStart: nextOcc
  };
}

function getTaskWindow(task, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  if (!task) return null;
  const sched = normalizeScheduleObject(task.schedule || task);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  const isPermanent = Boolean(task.isPermanent);
  const nowMs = parseDateTimeToMs(nowInput);
  const { onTimePoints, durationMinutes, earlyBonus, grace } = normalizeTaskTiers(task);



  function evaluateOccurrence(occurrenceKey, start) {
    const closesAt = isPermanent ? null : (durationMinutes ? start + durationMinutes * 60000 : (() => {
      const p = getZonedParts(start, APP_TIMEZONE);
      return zonedDateToMs(p.year, p.month, p.day, 23, 59, 59, APP_TIMEZONE) + 999;
    })());

    const graceEndsAt = (!isPermanent && grace.enabled && grace.untilMinutes > 0)
      ? start + grace.untilMinutes * 60000
      : null;

    if (nowMs < start) {
      return {
        state: 'upcoming',
        pointsForNow: (earlyBonus.enabled && earlyBonus.untilMinutes > 0) ? earlyBonus.points : onTimePoints,
        inGrace: false,
        occurrenceKey,
        start,
        closesAt,
        graceEndsAt
      };
    }

    if (isPermanent) {
      return {
        state: 'open',
        pointsForNow: onTimePoints,
        inGrace: false,
        isPermanent: true,
        occurrenceKey,
        start,
        closesAt: null,
        graceEndsAt: null
      };
    }

    // Before deadline
    if (nowMs < closesAt) {
      const isEarly = earlyBonus.enabled && earlyBonus.untilMinutes > 0 && nowMs < (start + earlyBonus.untilMinutes * 60000);
      return {
        state: 'open',
        pointsForNow: isEarly ? earlyBonus.points : onTimePoints,
        inGrace: false,
        isEarlyBonus: isEarly,
        occurrenceKey,
        start,
        closesAt,
        graceEndsAt
      };
    }

    // Grace window
    if (graceEndsAt && nowMs < graceEndsAt) {
      return {
        state: 'grace',
        pointsForNow: onTimePoints,
        inGrace: true,
        occurrenceKey,
        start,
        closesAt,
        graceEndsAt
      };
    }

    // Closed
    return {
      state: 'closed',
      pointsForNow: 0,
      inGrace: false,
      occurrenceKey,
      start,
      closesAt,
      graceEndsAt
    };
  }

  if (sched.type === 'once') {
    return evaluateOccurrence('once', startMs);
  }

  // Recurring
  if (nowMs < startMs) {
    const occurrenceKey = formatZonedDateKey(startMs, APP_TIMEZONE);
    return evaluateOccurrence(occurrenceKey, startMs);
  }

  const fromMs = Math.max(startMs, nowMs - 35 * 86400000);
  const toMs = nowMs + 35 * 86400000;
  const occs = getOccurrences(sched, fromMs, toMs);

  if (occs.length === 0) {
    return evaluateOccurrence(formatZonedDateKey(startMs, APP_TIMEZONE), startMs);
  }

  const pastOccs = occs.filter(o => o <= nowMs);
  if (pastOccs.length === 0) {
    const firstOcc = occs[0];
    return evaluateOccurrence(formatZonedDateKey(firstOcc, APP_TIMEZONE), firstOcc);
  }

  const currStart = pastOccs[pastOccs.length - 1];
  return evaluateOccurrence(formatZonedDateKey(currStart, APP_TIMEZONE), currStart);
}

function computeTieredTaskPoints(task, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  const win = getTaskWindow(task, nowInput);
  if (!win) {
    return { points: Number(task?.points) || 5, tier: 'flat', canSubmit: true, inGrace: false, statusText: '' };
  }
  const canSubmit = win.state === 'open' || win.state === 'grace';
  const tier = (win.state === 'open' && win.pointsForNow !== (Number(task?.points) || 5)) ? 'early' : (win.state === 'grace' ? 'grace' : 'onTime');
  const statusText = tier === 'early' ? 'Early Bonus' : (tier === 'grace' ? 'Grace Period' : 'On Time');
  return { points: win.pointsForNow, tier, canSubmit, inGrace: win.inGrace, statusText };
}

function resolveSessionOccurrence(session, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  const sched = normalizeScheduleObject(session?.schedule || session);
  const startMs = parseDateTimeToMs(sched.startDateTime);
  const nowMs = parseDateTimeToMs(nowInput);
  const lateCutoffMinutes = typeof session?.lateCutoffMinutes === 'number' ? session.lateCutoffMinutes : 120;

  if (sched.type === 'once') {
    return {
      start: startMs,
      key: 'once'
    };
  }

  const fromMs = Math.max(startMs, nowMs - 35 * 86400000);
  const toMs = nowMs + 35 * 86400000;
  const occs = getOccurrences(sched, fromMs, toMs);

  if (occs.length === 0) {
    return {
      start: startMs,
      key: formatZonedDateKey(startMs, APP_TIMEZONE)
    };
  }

  const past = occs.filter(o => o <= nowMs);
  const upcoming = occs.filter(o => o > nowMs);

  const lastPast = past.length > 0 ? past[past.length - 1] : null;
  const nextUpcoming = upcoming.length > 0 ? upcoming[0] : null;

  if (lastPast && nowMs <= lastPast + lateCutoffMinutes * 60000) {
    return {
      start: lastPast,
      key: formatZonedDateKey(lastPast, APP_TIMEZONE)
    };
  }

  if (lastPast && nextUpcoming) {
    const timeSinceClosed = nowMs - (lastPast + lateCutoffMinutes * 60000);
    const timeUntilNext = nextUpcoming - nowMs;
    if (timeSinceClosed < timeUntilNext && timeSinceClosed < 12 * 3600000) {
      return {
        start: lastPast,
        key: formatZonedDateKey(lastPast, APP_TIMEZONE)
      };
    }
    return {
      start: nextUpcoming,
      key: formatZonedDateKey(nextUpcoming, APP_TIMEZONE)
    };
  }

  if (nextUpcoming) {
    return {
      start: nextUpcoming,
      key: formatZonedDateKey(nextUpcoming, APP_TIMEZONE)
    };
  }

  return {
    start: lastPast || startMs,
    key: formatZonedDateKey(lastPast || startMs, APP_TIMEZONE)
  };
}

function normalizeSession(s) {
  if (!s) return null;
  const legacyUnit = s.penaltyUnit === 'seconds' ? 'seconds' : 'minutes';
  const legacyStepSize = (typeof s.stepDuration === 'number' && s.stepDuration >= 1) ? s.stepDuration : 1;
  const legacyPerStep = typeof s.penaltyPerStep === 'number' ? s.penaltyPerStep : (typeof s.penaltyPoints === 'number' ? s.penaltyPoints : 1);
  const legacyMin = typeof s.minPenalty === 'number' ? s.minPenalty : 0;
  const legacyMax = typeof s.maxPenalty === 'number' ? s.maxPenalty : 999999;
  const legacyAbsencePts = typeof s.absencePenalty === 'number' ? s.absencePenalty : (typeof s.maxPenalty === 'number' ? s.maxPenalty : 20);
  const legacyAbsenceFine = typeof s.absenceFineEGP === 'number' ? s.absenceFineEGP : (typeof s.maxPenalty === 'number' ? s.maxPenalty : 50);

  let pointsPenalty = {
    enabled: s.penaltyPointsEnabled !== false,
    mode: 'stepped',
    fixed: legacyPerStep,
    stepUnit: legacyUnit,
    stepSize: legacyStepSize,
    perStep: legacyPerStep,
    min: legacyMin,
    max: legacyMax,
    absence: legacyAbsencePts
  };
  if (s.pointsPenalty && typeof s.pointsPenalty === 'object') {
    pointsPenalty = {
      enabled: Boolean(s.pointsPenalty.enabled),
      mode: s.pointsPenalty.mode === 'fixed' ? 'fixed' : 'stepped',
      fixed: Number(s.pointsPenalty.fixed) || 0,
      stepUnit: s.pointsPenalty.stepUnit === 'seconds' ? 'seconds' : 'minutes',
      stepSize: Math.max(1, Number(s.pointsPenalty.stepSize) || 1),
      perStep: Number(s.pointsPenalty.perStep) || 0,
      min: Math.max(0, Number(s.pointsPenalty.min) || 0),
      max: typeof s.pointsPenalty.max === 'number' ? s.pointsPenalty.max : 999999,
      absence: Math.max(0, Number(s.pointsPenalty.absence) || 0)
    };
  }

  let finePenalty = {
    enabled: Boolean(s.penaltyFinesEnabled),
    mode: 'stepped',
    fixed: legacyPerStep,
    stepUnit: legacyUnit,
    stepSize: legacyStepSize,
    perStep: legacyPerStep,
    min: legacyMin,
    max: legacyMax,
    absence: legacyAbsenceFine
  };
  if (s.finePenalty && typeof s.finePenalty === 'object') {
    finePenalty = {
      enabled: Boolean(s.finePenalty.enabled),
      mode: s.finePenalty.mode === 'fixed' ? 'fixed' : 'stepped',
      fixed: Number(s.finePenalty.fixed) || 0,
      stepUnit: s.finePenalty.stepUnit === 'seconds' ? 'seconds' : 'minutes',
      stepSize: Math.max(1, Number(s.finePenalty.stepSize) || 1),
      perStep: Number(s.finePenalty.perStep) || 0,
      min: Math.max(0, Number(s.finePenalty.min) || 0),
      max: typeof s.finePenalty.max === 'number' ? s.finePenalty.max : 999999,
      absence: Math.max(0, Number(s.finePenalty.absence) || 0)
    };
  }

  const targetType = s.targetType || (Array.isArray(s.assignedUids) && s.assignedUids.length > 0 ? 'custom' : (Array.isArray(s.badgeIds) && s.badgeIds.length > 0 ? 'badge' : 'all'));
  return {
    ...s,
    id: s.id || '',
    title: s.title || 'Attendance Session',
    schedule: s.schedule || { type: 'once', startDateTime: s.startTime || s.startDateTime || Date.now() },
    targetType,
    badgeIds: Array.isArray(s.badgeIds) ? s.badgeIds : [],
    assignedUids: Array.isArray(s.assignedUids) ? s.assignedUids : [],
    active: s.active !== false && s.status !== 'closed' && s.status !== 'archived',
    archived: Boolean(s.archived || s.status === 'archived'),
    status: s.status || (s.archived ? 'archived' : (s.active === false ? 'inactive' : 'active')),
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null,
    pointsPenalty,
    finePenalty,
    earlyCheckInMinutes: typeof s.earlyCheckInMinutes === 'number' ? s.earlyCheckInMinutes : (typeof s.earlyWindowMinutes === 'number' ? s.earlyWindowMinutes : 30),
    lateCutoffMinutes: typeof s.lateCutoffMinutes === 'number' ? s.lateCutoffMinutes : 120
  };
}

function calculateSystemPenalty(sys, delaySeconds, isAbsent = false) {
  if (!sys || !sys.enabled) return 0;
  if (isAbsent) return Math.max(0, Number(sys.absence) || 0);
  if (delaySeconds <= 0) return 0;

  if (sys.mode === 'fixed') {
    const fixedVal = Math.max(0, Number(sys.fixed) || 0);
    const minVal = Math.max(0, Number(sys.min) || 0);
    const maxVal = typeof sys.max === 'number' ? sys.max : 999999;
    return Math.min(maxVal, Math.max(minVal, fixedVal));
  }

  const stepSec = sys.stepUnit === 'seconds' ? Math.max(1, Number(sys.stepSize) || 1) : Math.max(1, Number(sys.stepSize) || 1) * 60;
  const steps = Math.ceil(delaySeconds / stepSec);
  const raw = steps * (Number(sys.perStep) || 0);
  const minVal = Math.max(0, Number(sys.min) || 0);
  const maxVal = typeof sys.max === 'number' ? sys.max : 999999;
  return Math.min(maxVal, Math.max(minVal, raw));
}

function computeAttendance(session, nowInput = (typeof serverNow === 'function' ? serverNow() : Date.now())) {
  if (!session) return { status: 'blocked', reason: 'no_session', message: 'No session provided' };
  const norm = normalizeSession(session);

  // Support explicit absent status calculation
  if (nowInput === 'absent' || (typeof nowInput === 'object' && nowInput !== null && nowInput.status === 'absent')) {
    const ptsAbsence = calculateSystemPenalty(norm.pointsPenalty, 0, true);
    const fineAbsence = calculateSystemPenalty(norm.finePenalty, 0, true);
    return {
      status: 'absent',
      penalty: ptsAbsence,
      pointsPenalty: ptsAbsence,
      finePenalty: fineAbsence,
      fineEGP: fineAbsence,
      delaySeconds: 0,
      message: `Absent penalty (-${ptsAbsence} pts, ${fineAbsence} EGP)`
    };
  }

  const nowMs = parseDateTimeToMs(nowInput);
  const occ = resolveSessionOccurrence(norm, nowMs);
  if (!occ) {
    return { status: 'blocked', reason: 'no_occurrence', message: 'No active session occurrence' };
  }
  const S = occ.start;
  const occurrenceKey = occ.key;
  const earlyCheckInMinutes = norm.earlyCheckInMinutes;
  const lateCutoffMinutes = norm.lateCutoffMinutes;
  const opensAt = S - earlyCheckInMinutes * 60000;
  const closedAt = S + lateCutoffMinutes * 60000;

  if (nowMs < opensAt) {
    const p = getZonedParts(opensAt, APP_TIMEZONE);
    const hh = String(p.hour).padStart(2, '0');
    const mm = String(p.minute).padStart(2, '0');
    return {
      status: 'blocked',
      reason: 'early',
      opensAt,
      occurrenceKey,
      occurrenceStart: S,
      message: `Check-in opens at ${hh}:${mm}`
    };
  }

  if (nowMs > closedAt) {
    return {
      status: 'blocked',
      reason: 'closed',
      closedAt,
      occurrenceKey,
      occurrenceStart: S,
      message: 'Check-in closed'
    };
  }

  if (nowMs <= S) {
    return {
      status: 'on_time',
      penalty: 0,
      pointsPenalty: 0,
      finePenalty: 0,
      fineEGP: 0,
      delaySeconds: 0,
      occurrenceKey,
      occurrenceStart: S,
      message: 'On time (0 EGP penalty)'
    };
  }

  const delaySeconds = Math.floor((nowMs - S) / 1000);
  const pointsPenalty = calculateSystemPenalty(norm.pointsPenalty, delaySeconds, false);
  const finePenalty = calculateSystemPenalty(norm.finePenalty, delaySeconds, false);
  const m = Math.floor(delaySeconds / 60);
  const s = delaySeconds % 60;

  let feeStr = '';
  if (finePenalty > 0 && pointsPenalty > 0) {
    feeStr = ` (-${pointsPenalty} pts, -${finePenalty} EGP)`;
  } else if (finePenalty > 0) {
    feeStr = ` (-${finePenalty} EGP)`;
  } else if (pointsPenalty > 0) {
    // If it was a legacy session without explicit pointsPenalty, legacy message format was EGP
    if (!session.pointsPenalty && !session.finePenalty) {
      feeStr = ` (-${pointsPenalty} EGP)`;
    } else {
      feeStr = ` (-${pointsPenalty} pts)`;
    }
  } else {
    feeStr = ' (0 penalty)';
  }

  return {
    status: 'late',
    penalty: pointsPenalty,
    pointsPenalty,
    finePenalty,
    fineEGP: finePenalty,
    delaySeconds,
    occurrenceKey,
    occurrenceStart: S,
    message: `Late by ${m}m ${s}s${feeStr}`
  };
}

function msToZonedParts(dateOrMs, tz = APP_TIMEZONE) {
  const p = getZonedParts(dateOrMs, tz);
  return {
    y: p.year,
    m: p.month,
    d: p.day,
    hh: p.hour,
    mm: p.minute,
    ss: p.second,
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
    second: p.second,
    weekday: p.weekday
  };
}

function zonedPartsToMs(parts, tz = APP_TIMEZONE) {
  if (!parts) return 0;
  const yr = parts.y ?? parts.year ?? 1970;
  const mo = parts.m ?? parts.month ?? 1;
  const dy = parts.d ?? parts.day ?? 1;
  const hr = parts.hh ?? parts.hour ?? 0;
  const mi = parts.mm ?? parts.minute ?? 0;
  const se = parts.ss ?? parts.second ?? 0;
  return zonedDateToMs(yr, mo, dy, hr, mi, se, tz);
}

function startOfZonedDay(dateOrMs, tz = APP_TIMEZONE) {
  const p = getZonedParts(dateOrMs, tz);
  return zonedDateToMs(p.year, p.month, p.day, 0, 0, 0, tz);
}

function addDaysZoned(dateOrMs, n = 0, tz = APP_TIMEZONE) {
  const p = getZonedParts(dateOrMs, tz);
  return zonedDateToMs(p.year, p.month, p.day + n, p.hour, p.minute, p.second, tz);
}

if (typeof globalThis !== 'undefined') {
  globalThis.APP_TIMEZONE = APP_TIMEZONE;
  globalThis.getOccurrences = getOccurrences;
  globalThis.getOccurrenceFor = getOccurrenceFor;
  globalThis.formatZonedDateKey = formatZonedDateKey;
  globalThis.zonedDateToMs = zonedDateToMs;
  globalThis.getZonedParts = getZonedParts;
  globalThis.offsetFromPickers = offsetFromPickers;
  globalThis.pickersFromOffset = pickersFromOffset;
  globalThis.normalizeTaskTiers = normalizeTaskTiers;
  globalThis.getTaskWindow = getTaskWindow;
  globalThis.computeTieredTaskPoints = computeTieredTaskPoints;
  globalThis.resolveSessionOccurrence = resolveSessionOccurrence;
  globalThis.normalizeSession = normalizeSession;
  globalThis.calculateSystemPenalty = calculateSystemPenalty;
  globalThis.computeAttendance = computeAttendance;
  globalThis.weekKeyOf = weekKeyOf;
  globalThis.monthKeyOf = monthKeyOf;
  globalThis.getTimeBucketKeys = getTimeBucketKeys;
  globalThis.buildPointsUpdate = buildPointsUpdate;
  globalThis.getMemberPeriodPoints = getMemberPeriodPoints;
  globalThis.parseDateTimeToMs = parseDateTimeToMs;
  globalThis.msToZonedParts = msToZonedParts;
  globalThis.zonedPartsToMs = zonedPartsToMs;
  globalThis.startOfZonedDay = startOfZonedDay;
  globalThis.addDaysZoned = addDaysZoned;
  if (typeof usersMap !== 'undefined') globalThis.usersMap = usersMap;
  if (typeof getUserProfile !== 'undefined') globalThis.getUserProfile = getUserProfile;
}
// ==== ENGINE END

export { APP_TIMEZONE, getOccurrences, getOccurrenceFor, formatZonedDateKey, getTaskWindow, computeAttendance, resolveSessionOccurrence, getTimeBucketKeys, buildPointsUpdate, getMemberPeriodPoints, parseDateTimeToMs, msToZonedParts, zonedPartsToMs, startOfZonedDay, addDaysZoned };

/* ==========================================================================
   SHARED UI INFRASTRUCTURE (MANDATORY EXACT NAMES)
   ========================================================================== */

/**
 * Escapes HTML characters safely.
 */

/* ==========================================================================
   v2.1.0 SHARED iOS COMPONENTS (Task 1)
   ========================================================================== */

// Prototype getter/setter for .checked on <button role="switch">
if (typeof HTMLButtonElement !== 'undefined' && !Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'checked')) {
  Object.defineProperty(HTMLButtonElement.prototype, 'checked', {
    get() {
      if (this.getAttribute('role') === 'switch') {
        return this.getAttribute('aria-checked') === 'true';
      }
      return undefined;
    },
    set(v) {
      if (this.getAttribute('role') === 'switch') {
        const bool = Boolean(v);
        this.setAttribute('aria-checked', bool ? 'true' : 'false');
        this.classList.toggle('active', bool);
      }
    },
    configurable: true
  });
}

// Global delegated toggle for role="switch"
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="switch"]');
    if (btn && !btn.disabled) {
      e.preventDefault();
      const current = btn.getAttribute('aria-checked') === 'true';
      const next = !current;
      btn.setAttribute('aria-checked', next ? 'true' : 'false');
      btn.classList.toggle('active', next);
      btn.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && e.target?.getAttribute?.('role') === 'switch' && !e.target.disabled) {
      e.preventDefault();
      const current = e.target.getAttribute('aria-checked') === 'true';
      const next = !current;
      e.target.setAttribute('aria-checked', next ? 'true' : 'false');
      e.target.classList.toggle('active', next);
      e.target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

/**
 * Returns HTML string for an iOS Switch.
 */
export function renderSwitchHTML({ id = '', checked = false, disabled = false, label = '', className = '' } = {}) {
  const isChecked = Boolean(checked);
  return `
    <label class="ios-switch-wrapper ${className}" ${id ? `data-switch-for="${esc(id)}"` : ''}>
      ${label ? `<span class="ios-switch-label text-sm font-medium text-neutral-200">${esc(label)}</span>` : ''}
      <button type="button" role="switch" aria-checked="${isChecked ? 'true' : 'false'}" ${id ? `id="${esc(id)}"` : ''} class="ios-switch ${isChecked ? 'active' : ''}" ${disabled ? 'disabled' : ''} tabindex="${disabled ? '-1' : '0'}">
        <span class="ios-switch-thumb"></span>
      </button>
    </label>
  `.trim();
}

/**
 * DOM creator for iOS Switch.
 */
export function renderSwitch({ checked = false, onChange = null, label = '', disabled = false, id = '', className = '' } = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = `ios-switch-wrapper ${className}`.trim();
  if (disabled) wrapper.style.pointerEvents = 'none';

  let isChecked = Boolean(checked);

  if (label) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'ios-switch-label text-sm font-medium text-neutral-200';
    labelSpan.textContent = label;
    wrapper.appendChild(labelSpan);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
  btn.className = `ios-switch ${isChecked ? 'active' : ''}`.trim();
  if (id) btn.id = id;
  if (disabled) btn.disabled = true;
  btn.tabIndex = disabled ? -1 : 0;

  const thumb = document.createElement('span');
  thumb.className = 'ios-switch-thumb';
  btn.appendChild(thumb);
  wrapper.appendChild(btn);

  wrapper.setChecked = (val, trigger = false) => {
    isChecked = Boolean(val);
    btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    btn.classList.toggle('active', isChecked);
    if (trigger) {
      btn.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof onChange === 'function') onChange(isChecked);
    }
  };

  btn.setChecked = wrapper.setChecked;

  Object.defineProperty(wrapper, 'checked', {
    get: () => isChecked,
    set: (v) => wrapper.setChecked(v, false)
  });

  if (onChange) {
    btn.addEventListener('change', () => onChange(btn.checked));
  }

  return wrapper;
}

/**
 * Renders an iOS Segmented Control with sliding thumb.
 */
export function renderSegmented({ options = [], value = '', onChange = null, className = '', id = '' } = {}) {
  const container = document.createElement('div');
  container.className = `ios-segmented ${className}`.trim();
  if (id) container.id = id;
  container.setAttribute('role', 'tablist');

  const thumb = document.createElement('div');
  thumb.className = 'ios-segmented-thumb';
  container.appendChild(thumb);

  let currentValue = value !== undefined && value !== null ? value : (options[0]?.value ?? '');

  const buttons = options.map((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ios-segmented-item ${opt.value === currentValue ? 'active' : ''}`.trim();
    btn.dataset.value = String(opt.value);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', opt.value === currentValue ? 'true' : 'false');
    btn.textContent = opt.label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentValue === opt.value) return;
      setValue(opt.value, true);
    });
    container.appendChild(btn);
    return btn;
  });

  function updateThumb(immediate = false) {
    const activeBtn = container.querySelector(`.ios-segmented-item[data-value="${currentValue}"]`);
    if (!activeBtn) {
      thumb.style.opacity = '0';
      return;
    }
    thumb.style.opacity = '1';
    const left = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;
    if (immediate) {
      thumb.style.transition = 'none';
      thumb.style.transform = `translateX(${left}px)`;
      thumb.style.width = `${width}px`;
      void thumb.offsetWidth;
      thumb.style.transition = '';
    } else {
      thumb.style.transform = `translateX(${left}px)`;
      thumb.style.width = `${width}px`;
    }
  }

  function setValue(v, trigger = false) {
    currentValue = v;
    buttons.forEach((btn) => {
      const match = btn.dataset.value === String(v);
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });
    updateThumb(false);
    if (trigger && typeof onChange === 'function') {
      onChange(v);
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (container.offsetWidth > 0) updateThumb(true);
    });
    ro.observe(container);
  }

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => updateThumb(true)).catch(() => {});
  }

  setTimeout(() => updateThumb(true), 10);

  container.setValue = setValue;
  container.getValue = () => currentValue;

  return container;
}

/**
 * Renders an iOS Stepper with press-and-hold repeating.
 */
export function renderStepper({ value = 0, min = 0, max = 9999, step = 1, unit = '', onChange = null, id = '', className = '' } = {}) {
  const container = document.createElement('div');
  container.className = `ios-stepper ${className}`.trim();
  if (id) container.id = id;

  let currentVal = Math.min(Math.max(Number(value) || 0, min), max);

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'ios-stepper-btn';
  minusBtn.setAttribute('aria-label', 'Decrease');
  minusBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14"/></svg>';

  const valDisplay = document.createElement('span');
  valDisplay.className = 'ios-stepper-val';

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'ios-stepper-btn';
  plusBtn.setAttribute('aria-label', 'Increase');
  plusBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>';

  function update() {
    valDisplay.textContent = unit ? `${currentVal} ${unit}` : `${currentVal}`;
    minusBtn.disabled = currentVal <= min;
    plusBtn.disabled = currentVal >= max;
  }

  function adjust(delta, trigger = true) {
    const next = Math.min(Math.max(currentVal + delta, min), max);
    if (next !== currentVal) {
      currentVal = next;
      update();
      if (trigger && typeof onChange === 'function') onChange(currentVal);
    }
  }

  function attachHold(btn, delta) {
    let timeout = null;
    let interval = null;

    const start = (e) => {
      e.preventDefault();
      adjust(delta, true);
      timeout = setTimeout(() => {
        interval = setInterval(() => {
          adjust(delta, true);
        }, 80);
      }, 300);
    };

    const stop = () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      timeout = null;
      interval = null;
    };

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }

  attachHold(minusBtn, -step);
  attachHold(plusBtn, step);

  container.appendChild(minusBtn);
  container.appendChild(valDisplay);
  container.appendChild(plusBtn);

  update();

  container.setValue = (v, trigger = false) => {
    currentVal = Math.min(Math.max(Number(v) || 0, min), max);
    update();
    if (trigger && typeof onChange === 'function') onChange(currentVal);
  };
  container.getValue = () => currentVal;

  return container;
}

/**
 * Open iOS Wheel Date/Time Picker bottom sheet.
 * Returns Promise<epochMs | minutesSinceMidnight | null>
 */
export function openDateTimePicker({ title = 'Select Date & Time', valueMs = null, mode = 'datetime', minMs = null, maxMs = null } = {}) {
  return new Promise((resolve) => {
    const baseMs = valueMs ? parseDateTimeToMs(valueMs) : serverNow();
    const parts = msToZonedParts(baseMs, APP_TIMEZONE);

    // Selected state
    let selYear = parts.year;
    let selMonth = parts.month;
    let selDay = parts.day;
    let selHour = parts.hour % 12 || 12;
    let selMinute = parts.minute;
    let selAmPm = parts.hour >= 12 ? 'PM' : 'AM';
    let selDayMs = startOfZonedDay(baseMs, APP_TIMEZONE);

    let modalRef = null;

    // Build wheel columns HTML
    let wheelsHtml = '';

    if (mode === 'datetime') {
      const days = [];
      const curStart = startOfZonedDay(serverNow(), APP_TIMEZONE);
      const selStart = startOfZonedDay(baseMs, APP_TIMEZONE);
      for (let i = -366; i <= 366; i++) {
        const dMs = addDaysZoned(curStart, i, APP_TIMEZONE);
        const p = msToZonedParts(dMs, APP_TIMEZONE);
        const isToday = dMs === curStart;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = isToday ? `Today, ${monthNames[p.m - 1]} ${p.d}` : `${p.weekday}, ${monthNames[p.m - 1]} ${p.d}`;
        days.push({ ms: dMs, label, isSel: dMs === selStart, p });
      }

      wheelsHtml = `
        <div class="ios-wheel-container">
          <div class="ios-wheel-highlight"></div>
          <div class="ios-wheel-mask-top"></div>
          <div class="ios-wheel-mask-bottom"></div>

          <div class="ios-wheel-col col-date" style="flex: 2.2;">
            ${days.map(d => `<div class="ios-wheel-item ${d.isSel ? 'active' : ''}" data-ms="${d.ms}" data-y="${d.p.y}" data-m="${d.p.m}" data-d="${d.p.d}">${d.label}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-hour" style="flex: 1;">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<div class="ios-wheel-item ${h === selHour ? 'active' : ''}" data-val="${h}">${h}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-min" style="flex: 1;">
            ${Array.from({ length: 60 }, (_, i) => i).map(m => `<div class="ios-wheel-item ${m === selMinute ? 'active' : ''}" data-val="${m}">${String(m).padStart(2, '0')}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-ampm" style="flex: 1;">
            <div class="ios-wheel-item ${selAmPm === 'AM' ? 'active' : ''}" data-val="AM">AM</div>
            <div class="ios-wheel-item ${selAmPm === 'PM' ? 'active' : ''}" data-val="PM">PM</div>
          </div>
        </div>
      `;
    } else if (mode === 'date') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const curYear = parts.year;
      const years = Array.from({ length: 15 }, (_, i) => curYear - 2 + i);

      wheelsHtml = `
        <div class="ios-wheel-container">
          <div class="ios-wheel-highlight"></div>
          <div class="ios-wheel-mask-top"></div>
          <div class="ios-wheel-mask-bottom"></div>

          <div class="ios-wheel-col col-month" style="flex: 1.5;">
            ${monthNames.map((name, i) => `<div class="ios-wheel-item ${i + 1 === selMonth ? 'active' : ''}" data-val="${i + 1}">${name}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-day" style="flex: 1;">
            ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<div class="ios-wheel-item ${d === selDay ? 'active' : ''}" data-val="${d}">${d}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-year" style="flex: 1.2;">
            ${years.map(y => `<div class="ios-wheel-item ${y === selYear ? 'active' : ''}" data-val="${y}">${y}</div>`).join('')}
          </div>
        </div>
      `;
    } else { // mode === 'time'
      wheelsHtml = `
        <div class="ios-wheel-container">
          <div class="ios-wheel-highlight"></div>
          <div class="ios-wheel-mask-top"></div>
          <div class="ios-wheel-mask-bottom"></div>

          <div class="ios-wheel-col col-hour" style="flex: 1;">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<div class="ios-wheel-item ${h === selHour ? 'active' : ''}" data-val="${h}">${h}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-min" style="flex: 1;">
            ${Array.from({ length: 60 }, (_, i) => i).map(m => `<div class="ios-wheel-item ${m === selMinute ? 'active' : ''}" data-val="${m}">${String(m).padStart(2, '0')}</div>`).join('')}
          </div>
          <div class="ios-wheel-col col-ampm" style="flex: 1;">
            <div class="ios-wheel-item ${selAmPm === 'AM' ? 'active' : ''}" data-val="AM">AM</div>
            <div class="ios-wheel-item ${selAmPm === 'PM' ? 'active' : ''}" data-val="PM">PM</div>
          </div>
        </div>
      `;
    }

    modalRef = openModal({
      title: esc(title),
      bodyHtml: `
        <div class="space-y-3">
          <div class="text-[11px] font-mono text-neutral-400 text-center tracking-wide">Interpret &amp; Display: ${APP_TIMEZONE}</div>
          ${wheelsHtml}
        </div>
      `,
      saveLabel: 'Done',
      cancelLabel: 'Cancel',
      onClose: () => resolve(null),
      onSave: () => {
        let result = null;
        if (mode === 'datetime') {
          const hr24 = (selHour % 12) + (selAmPm === 'PM' ? 12 : 0);
          result = zonedPartsToMs({ y: selYear, m: selMonth, d: selDay, hh: hr24, mm: selMinute, ss: 0 }, APP_TIMEZONE);
        } else if (mode === 'date') {
          result = zonedPartsToMs({ y: selYear, m: selMonth, d: selDay, hh: 0, mm: 0, ss: 0 }, APP_TIMEZONE);
        } else {
          result = (selHour % 12 + (selAmPm === 'PM' ? 12 : 0)) * 60 + selMinute;
        }

        if (typeof minMs === 'number' && typeof result === 'number') result = Math.max(minMs, result);
        if (typeof maxMs === 'number' && typeof result === 'number') result = Math.min(maxMs, result);
        resolve(result);
      }
    });

    // Wire wheel columns scroll and selection
    setTimeout(() => {
      const modalEl = document.getElementById('shared-modal');
      if (!modalEl) return;

      const cols = modalEl.querySelectorAll('.ios-wheel-col');
      cols.forEach((col) => {
        const items = col.querySelectorAll('.ios-wheel-item');
        const activeIdx = Array.from(items).findIndex(el => el.classList.contains('active'));
        if (activeIdx !== -1) {
          col.scrollTop = activeIdx * 36;
        }

        let scrollTimeout = null;
        const onWheelScroll = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            const idx = Math.round(col.scrollTop / 36);
            items.forEach((item, i) => {
              const isActive = i === idx;
              item.classList.toggle('active', isActive);
              if (isActive) {
                if (col.classList.contains('col-date')) {
                  selDayMs = Number(item.dataset.ms);
                  selYear = Number(item.dataset.y);
                  selMonth = Number(item.dataset.m);
                  selDay = Number(item.dataset.d);
                } else if (col.classList.contains('col-hour')) {
                  selHour = Number(item.dataset.val);
                } else if (col.classList.contains('col-min')) {
                  selMinute = Number(item.dataset.val);
                } else if (col.classList.contains('col-ampm')) {
                  selAmPm = item.dataset.val;
                } else if (col.classList.contains('col-month')) {
                  selMonth = Number(item.dataset.val);
                } else if (col.classList.contains('col-day')) {
                  selDay = Number(item.dataset.val);
                } else if (col.classList.contains('col-year')) {
                  selYear = Number(item.dataset.val);
                }
              }
            });
          }, 40);
        };

        col.addEventListener('scroll', onWheelScroll, { passive: true });

        items.forEach((item, i) => {
          item.addEventListener('click', () => {
            col.scrollTo({ top: i * 36, behavior: 'smooth' });
          });
        });
      });
    }, 50);
  });
}

/**
 * Format timestamp into display string for date/time field chip.
 */
function formatDateTimeDisplay(val, mode = 'datetime') {
  if (val === null || val === undefined || val === '') return 'Select';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (mode === 'time') {
    const totalMinutes = typeof val === 'number' ? val : 0;
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const hr12 = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const ms = parseDateTimeToMs(val);
  const p = msToZonedParts(ms, APP_TIMEZONE);
  const hr12 = p.hour % 12 || 12;
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const minPad = String(p.minute).padStart(2, '0');
  if (mode === 'date') {
    return `${p.weekday}, ${monthNames[p.month - 1]} ${p.day}, ${p.year}`;
  }
  return `${p.weekday}, ${monthNames[p.month - 1]} ${p.day} - ${hr12}:${minPad} ${ampm}`;
}

/**
 * Renders an inset-grouped row for selecting Date/Time via the wheel picker.
 */
export function renderDateTimeField({ label = 'Date & Time', valueMs = null, mode = 'datetime', onChange = null, placeholder = 'Select', id = '', className = '' } = {}) {
  const container = document.createElement('div');
  container.className = `ios-datetime-field ${className}`.trim();
  if (id) container.id = id;
  container.setAttribute('role', 'button');
  container.tabIndex = 0;

  let currentVal = valueMs ? parseDateTimeToMs(valueMs) : (mode === 'time' ? 12 * 60 : serverNow());

  const labelBox = document.createElement('div');
  labelBox.className = 'flex flex-col text-left';
  labelBox.innerHTML = `
    <span class="text-xs font-semibold text-neutral-200">${esc(label)}</span>
  `;

  const chip = document.createElement('div');
  chip.className = 'ios-datetime-chip font-mono';
  chip.textContent = formatDateTimeDisplay(currentVal, mode);

  container.appendChild(labelBox);
  container.appendChild(chip);

  async function open() {
    const res = await openDateTimePicker({ title: label, valueMs: currentVal, mode });
    if (res !== null && res !== undefined) {
      currentVal = res;
      chip.textContent = formatDateTimeDisplay(currentVal, mode);
      if (typeof onChange === 'function') onChange(currentVal);
    }
  }

  container.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      open();
    }
  });

  container.setValue = (v) => {
    currentVal = mode === 'time' ? Number(v) : parseDateTimeToMs(v);
    chip.textContent = formatDateTimeDisplay(currentVal, mode);
  };
  container.getValue = () => currentVal;

  return container;
}

/**
 * Opens an iOS Item Picker Half-Sheet modal with optional search and icons.
 * Returns Promise<selectedId | null>
 */
export function openItemPicker({ title = 'Select Item', items = [], selectedId = null, searchable = false, emptyText = 'No items found' } = {}) {
  return new Promise((resolve) => {
    let curSel = selectedId;
    let filterQuery = '';

    function buildListHtml(query = '') {
      const q = query.trim().toLowerCase();
      const filtered = q ? items.filter(it => (it.label || '').toLowerCase().includes(q) || (it.sublabel || '').toLowerCase().includes(q)) : items;

      if (filtered.length === 0) {
        return `<div class="p-8 text-center text-xs text-neutral-400">${esc(emptyText)}</div>`;
      }

      return filtered.map((it) => {
        const isSelected = it.id === curSel;
        const iconSvg = it.iconKey && ICON_LIBRARY[it.iconKey] ? ICON_LIBRARY[it.iconKey] : '';
        return `
          <button type="button" class="item-picker-row w-full p-3 rounded-xl flex items-center justify-between text-left transition hover:bg-white/5 active:bg-white/10 ${isSelected ? 'bg-white/[0.08]' : ''}" data-id="${esc(it.id)}">
            <div class="flex items-center gap-3 min-w-0 pr-2">
              ${iconSvg ? `<span class="w-7 h-7 rounded-lg bg-white/10 text-[#0A84FF] flex items-center justify-center shrink-0">${iconSvg}</span>` : ''}
              <div class="min-w-0 flex-1 break-words">
                <div class="text-sm font-semibold text-white break-words">${esc(it.label)}</div>
                ${it.sublabel ? `<div class="text-xs text-neutral-400 break-words mt-0.5">${esc(it.sublabel)}</div>` : ''}
              </div>
            </div>
            ${isSelected ? `
              <svg class="w-5 h-5 text-[#0A84FF] shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            ` : ''}
          </button>
        `;
      }).join('');
    }

    const showSearch = searchable || items.length > 7;

    const modal = openModal({
      title: esc(title),
      bodyHtml: `
        <div class="space-y-3">
          ${showSearch ? `
            <div class="relative">
              <input type="search" id="item-picker-search" class="ios-input w-full pl-9 pr-3 py-2 text-xs text-white" placeholder="Search..." autocomplete="off" />
              <svg class="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
            </div>
          ` : ''}
          <div id="item-picker-list" class="max-h-[320px] overflow-y-auto space-y-1 divide-y divide-white/5">
            ${buildListHtml('')}
          </div>
        </div>
      `,
      cancelLabel: 'Cancel',
      onClose: () => resolve(null)
    });

    setTimeout(() => {
      const modalEl = document.getElementById('shared-modal');
      if (!modalEl) return;

      const searchInp = modalEl.querySelector('#item-picker-search');
      const listEl = modalEl.querySelector('#item-picker-list');

      function wireRows() {
        listEl.querySelectorAll('.item-picker-row').forEach((row) => {
          row.onclick = () => {
            const id = row.dataset.id;
            modal.close();
            resolve(id);
          };
        });
      }

      if (searchInp) {
        searchInp.oninput = (e) => {
          filterQuery = e.target.value;
          listEl.innerHTML = buildListHtml(filterQuery);
          wireRows();
        };
        searchInp.focus();
      }

      wireRows();
    }, 30);
  });
}

/**
 * Pick image file, crop in interactive 280px sheet, compress to Base64 data URI.
 * Returns Promise<dataURI | null>
 */
export function pickAndCropImage({ shape = 'circle', outSize = 160, maxChars = 30000 } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }

      if (!file.type || !file.type.startsWith('image/')) {
        toast('Please select a valid image file', 'error');
        resolve(null);
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        toast('Image must be under 15MB', 'error');
        resolve(null);
        return;
      }

      try {
        let bmp;
        if (typeof createImageBitmap === 'function') {
          bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
        }
        if (!bmp) {
          bmp = await new Promise((res, rej) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => { URL.revokeObjectURL(url); res(img); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image decode error')); };
            img.src = url;
          });
        }

        // Downscale source to max 1024px for mobile memory safety
        let srcW = bmp.width;
        let srcH = bmp.height;
        const maxDim = 1024;
        if (srcW > maxDim || srcH > maxDim) {
          if (srcW > srcH) {
            srcH = Math.round((srcH * maxDim) / srcW);
            srcW = maxDim;
          } else {
            srcW = Math.round((srcW * maxDim) / srcH);
            srcH = maxDim;
          }
        }

        const offCanvas = document.createElement('canvas');
        offCanvas.width = srcW;
        offCanvas.height = srcH;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(bmp, 0, 0, srcW, srcH);

        // Open 280px cropper modal
        const minScale = Math.max(280 / srcW, 280 / srcH);
        let scale = minScale;
        const maxScale = minScale * 3.5;
        let panX = (280 - srcW * scale) / 2;
        let panY = (280 - srcH * scale) / 2;

        function clamp() {
          scale = Math.max(minScale, Math.min(scale, maxScale));
          const curW = srcW * scale;
          const curH = srcH * scale;
          panX = Math.min(0, Math.max(panX, 280 - curW));
          panY = Math.min(0, Math.max(panY, 280 - curH));
        }

        clamp();

        const maskClass = shape === 'circle' ? 'ios-cropper-mask-circle' : 'ios-cropper-mask-rounded';

        const cropModal = openModal({
          title: shape === 'circle' ? 'Crop Profile Avatar' : 'Crop App Logo',
          sheetClass: 'cropper-modal-sheet',
          body: `
            <div class="space-y-4">
              <div class="ios-cropper-viewport" id="cropper-viewport">
                <canvas id="cropper-canvas" width="280" height="280" class="block w-[280px] h-[280px] pointer-events-none"></canvas>
                <div class="${maskClass}"></div>
              </div>
              <div class="px-2 space-y-1">
                <div class="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Zoom</span>
                  <span id="cropper-zoom-text">1.0x</span>
                </div>
                <input id="cropper-zoom-slider" type="range" min="1" max="3.5" step="0.05" value="1" class="w-full accent-[#0A84FF]" />
              </div>
            </div>
          `,
          saveLabel: 'Save Image',
          cancelLabel: 'Cancel',
          onClose: () => resolve(null),
          onSave: () => {
            // Render cropped area to outSize x outSize canvas
            const outCanvas = document.createElement('canvas');
            outCanvas.width = outSize;
            outCanvas.height = outSize;
            const outCtx = outCanvas.getContext('2d');

            const cropX = -panX / scale;
            const cropY = -panY / scale;
            const cropW = 280 / scale;
            const cropH = 280 / scale;

            outCtx.drawImage(offCanvas, cropX, cropY, cropW, cropH, 0, 0, outSize, outSize);

            let dataUri = '';
            // Try webp first
            dataUri = outCanvas.toDataURL('image/webp', 0.82);
            if (!dataUri.startsWith('data:image/webp')) {
              dataUri = outCanvas.toDataURL('image/jpeg', 0.82);
            }

            // Stepwise compression if over maxChars
            const qualities = [0.72, 0.62, 0.52, 0.42];
            let qIdx = 0;
            while (dataUri.length > maxChars && qIdx < qualities.length) {
              const mime = dataUri.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
              dataUri = outCanvas.toDataURL(mime, qualities[qIdx]);
              qIdx++;
            }

            // Downscale dimension if still too large
            if (dataUri.length > maxChars) {
              const smallerDim = Math.round(outSize * 0.8);
              outCanvas.width = smallerDim;
              outCanvas.height = smallerDim;
              outCtx.drawImage(offCanvas, cropX, cropY, cropW, cropH, 0, 0, smallerDim, smallerDim);
              dataUri = outCanvas.toDataURL('image/jpeg', 0.6);
            }

            if (dataUri.length > maxChars) {
              toast('Image could not be compressed under character limit', 'error');
              resolve(null);
              return;
            }

            resolve(dataUri);
            return true;
          }
        });

        // Wire canvas drawing and viewport pointer events
        setTimeout(() => {
          const viewport = document.getElementById('cropper-viewport');
          const canvas = document.getElementById('cropper-canvas');
          const zoomSlider = document.getElementById('cropper-zoom-slider');
          const zoomText = document.getElementById('cropper-zoom-text');
          if (!viewport || !canvas) return;

          const ctx = canvas.getContext('2d');

          function draw() {
            ctx.clearRect(0, 0, 280, 280);
            ctx.drawImage(offCanvas, panX, panY, srcW * scale, srcH * scale);
            if (zoomText) zoomText.textContent = `${(scale / minScale).toFixed(1)}x`;
            if (zoomSlider) zoomSlider.value = (scale / minScale).toFixed(2);
          }

          draw();

          // Pointer tracking for drag & pinch
          const pointers = new Map();
          let prevDiff = -1;

          viewport.onpointerdown = (e) => {
            viewport.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          };

          viewport.onpointermove = (e) => {
            if (!pointers.has(e.pointerId)) return;
            const prev = pointers.get(e.pointerId);
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pointers.size === 1) {
              panX += dx;
              panY += dy;
              clamp();
              draw();
            } else if (pointers.size === 2) {
              const pts = Array.from(pointers.values());
              const curDiff = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
              if (prevDiff > 0) {
                const ratio = curDiff / prevDiff;
                scale *= ratio;
                clamp();
                draw();
              }
              prevDiff = curDiff;
            }
          };

          const onPointerEnd = (e) => {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) prevDiff = -1;
          };

          viewport.onpointerup = onPointerEnd;
          viewport.onpointercancel = onPointerEnd;

          // Mouse wheel zoom
          viewport.onwheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.08 : 0.92;
            scale *= delta;
            clamp();
            draw();
          };

          // Slider zoom
          if (zoomSlider) {
            zoomSlider.oninput = (e) => {
              scale = minScale * Number(e.target.value);
              clamp();
              draw();
            };
          }
        }, 50);

      } catch (err) {
        console.error('Error preparing image:', err);
        toast('Failed to load image', 'error');
        resolve(null);
      }
    };

    input.click();
  });
}


export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
export const escapeHtml = esc;

/**
 * Apple-style top floating glass pill toast.
 */
export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="w-4 h-4 text-emerald-400 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="w-4 h-4 text-rose-400 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg class="w-4 h-4 text-amber-400 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else {
    iconSvg = '<svg class="w-4 h-4 text-[#0A84FF] stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toastEl.innerHTML = `${iconSvg}<span>${esc(message)}</span>`;
  toastEl.onclick = () => dismissToast(toastEl);
  container.appendChild(toastEl);

  const duration = Math.min(5000, Math.max(3000, message.length * 60));
  const timeoutId = setTimeout(() => dismissToast(toastEl), duration);
  toastEl._timeoutId = timeoutId;
}
export const showToast = toast;

function dismissToast(el) {
  if (!el || el._dismissed) return;
  el._dismissed = true;
  if (el._timeoutId) clearTimeout(el._timeoutId);
  el.classList.add('toast-hiding');
  setTimeout(() => el.remove(), 300);
}

/**
 * iOS Action Sheet confirmation returning Promise<boolean>.
 */
export function confirmSheet({ title = 'Confirm', message = 'Are you sure?', confirmLabel, confirmText, destructive = false, isDestructive = false }) {
  const actualConfirmLabel = confirmLabel || confirmText || 'Confirm';
  const isDest = Boolean(destructive || isDestructive);
  const root = document.getElementById('shared-confirm-root');
  const titleEl = document.getElementById('shared-confirm-title');
  const msgEl = document.getElementById('shared-confirm-message');
  const actionBtn = document.getElementById('shared-confirm-action');
  const cancelBtn = document.getElementById('shared-confirm-cancel');

  if (!root || !actionBtn || !cancelBtn) return Promise.resolve(false);

  titleEl.textContent = title;
  msgEl.textContent = message;
  actionBtn.textContent = actualConfirmLabel;
  actionBtn.className = `action-sheet-btn ${isDest ? 'destructive' : 'primary'}`;

  document.body.style.overflow = 'hidden';
  root.classList.add('open');

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = (result) => {
      if (resolved) return;
      resolved = true;
      root.classList.remove('open');
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      root.onclick = null;
      actionBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    actionBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    root.onclick = (e) => {
      if (e.target === root) cleanup(false);
    };
    window.addEventListener('keydown', onKeyDown);
  });
}
export const showCustomConfirm = (title, message) => confirmSheet({ title, message, confirmLabel: 'Confirm', destructive: true });

/**
 * Reusable Bottom Sheet / Modal with validation, scroll lock, dirty check, and focus trap.
 */
export const modalStack = [];

function openModal({ title, body, bodyHtml, onSave, onClose, isDirty, saveLabel, sheetClass = '' }) {
  const root = document.getElementById('shared-modal-root');
  const titleEl = document.getElementById('shared-modal-title');
  const bodyEl = document.getElementById('shared-modal-body');
  const cancelBtn = document.getElementById('shared-modal-cancel');
  const saveBtn = document.getElementById('shared-modal-save');
  const modalSheet = root?.querySelector('.modal-sheet');

  if (!root || !titleEl || !bodyEl || !cancelBtn || !saveBtn) {
    return { close: () => {}, modalEl: null };
  }

  // Nested modal support: preserve parent modal state & DOM nodes cleanly
  if (root.classList.contains('open')) {
    const savedNodes = Array.from(bodyEl.childNodes);
    modalStack.push({
      title: titleEl.textContent,
      nodes: savedNodes,
      onSave: saveBtn.onclick,
      saveVisible: !saveBtn.classList.contains('hidden'),
      saveDisabled: saveBtn.disabled,
      saveText: saveBtn.textContent,
      cancelText: cancelBtn.textContent,
      sheetClass: modalSheet ? modalSheet.className : '',
      scrollTop: bodyEl.scrollTop,
      onClose
    });
  }

  if (sheetClass && modalSheet) {
    sheetClass.split(' ').filter(Boolean).forEach(c => modalSheet.classList.add(c));
  }

  titleEl.textContent = title || '';
  const modalBodyContent = body !== undefined ? body : bodyHtml;
  if (typeof modalBodyContent === 'string') {
    bodyEl.innerHTML = modalBodyContent;
  } else if (modalBodyContent instanceof HTMLElement) {
    bodyEl.innerHTML = '';
    bodyEl.appendChild(modalBodyContent);
  }

  if (typeof onSave === 'function') {
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = false;
    saveBtn.textContent = saveLabel || 'Save';
  } else {
    saveBtn.classList.add('hidden');
  }

  document.body.style.overflow = 'hidden';
  root.classList.add('open');

  let isClosing = false;
  const tryClose = async () => {
    if (isClosing) return;
    if (typeof isDirty === 'function' && isDirty()) {
      const discard = await confirmSheet({
        title: 'Discard Changes?',
        message: 'You have unsaved changes. Are you sure you want to discard them?',
        confirmLabel: 'Discard',
        destructive: true
      });
      if (!discard) return;
    }
    close();
  };

  const close = () => {
    if (isClosing) return;
    isClosing = true;
    if (typeof onClose === 'function') onClose();

    // If a parent modal is stacked, pop and restore its exact nodes and input states
    if (modalStack.length > 0) {
      const prev = modalStack.pop();
      titleEl.textContent = prev.title || '';
      bodyEl.innerHTML = '';
      prev.nodes.forEach(n => bodyEl.appendChild(n));
      if (modalSheet && prev.sheetClass) {
        modalSheet.className = prev.sheetClass;
      }
      if (prev.saveVisible) {
        saveBtn.classList.remove('hidden');
        saveBtn.disabled = prev.saveDisabled;
        saveBtn.textContent = prev.saveText;
        saveBtn.onclick = prev.onSave;
      } else {
        saveBtn.classList.add('hidden');
        saveBtn.onclick = null;
      }
      cancelBtn.textContent = prev.cancelText;
      bodyEl.scrollTop = prev.scrollTop;
      return;
    }

    root.classList.remove('open');
    if (sheetClass && modalSheet) {
      sheetClass.split(' ').filter(Boolean).forEach(c => modalSheet.classList.remove(c));
    }
    document.body.style.overflow = '';
    window.removeEventListener('keydown', onKeyDown);
    root.onclick = null;
    cancelBtn.onclick = null;
    saveBtn.onclick = null;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') tryClose();
  };

  cancelBtn.onclick = tryClose;
  root.onclick = (e) => {
    if (e.target === root) tryClose();
  };
  window.addEventListener('keydown', onKeyDown);

  if (typeof onSave === 'function') {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        const result = await onSave();
        if (result !== false) {
          close();
        } else {
          saveBtn.disabled = false;
          saveBtn.textContent = saveLabel || 'Save';
        }
      } catch (err) {
        console.error('Error during modal onSave:', err);
        toast(err.message || 'Error saving changes', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = saveLabel || 'Save';
      }
    };
  }

  return { close, modalEl: root };
}

/**
 * Deterministic avatar renderer with color hashed from uid and fallback initials.
 */
export function renderAvatar(user, sizeClass = 'w-10 h-10') {
  if (typeof sizeClass === 'number') {
    sizeClass = sizeClass === 48 ? 'w-12 h-12' : `w-[${sizeClass}px] h-[${sizeClass}px]`;
  }
  const name = user?.name || user?.displayName || user?.userName || 'Team Member';
  const uid = user?.uid || user?.userId || 'guest';
  const photo = user?.avatarUrl || user?.photoURL || user?.userAvatar || '';
  const isSafe = /^data:image\/(webp|jpeg|png);base64,/i.test(photo) || /^https?:\/\//i.test(photo);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'U';

  const palette = ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#5856D6', '#00C7BE', '#32ADE6'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const color = palette[Math.abs(hash) % palette.length];

  if (isSafe && photo) {
    return `
      <div class="${sizeClass} rounded-full overflow-hidden border border-white/20 flex-shrink-0 bg-white/5 relative">
        <img src="${esc(photo)}" alt="${esc(name)}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div style="display:none; background-color:${color};" class="w-full h-full items-center justify-center font-bold text-white text-xs">
          ${esc(initials)}
        </div>
      </div>
    `;
  }

  return `
    <div class="${sizeClass} rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-xs border border-white/20 shadow-sm" style="background-color: ${color};">
      ${esc(initials)}
    </div>
  `;
}

/* ==========================================================================
   DYNAMIC SPACE-AWARE BADGE ROW & MINI-PROFILE OVERHANGING SHEET (Task 4)
   ========================================================================== */

export function normalizeBadgeItem(b) {
  if (!b) return null;
  if (typeof b === 'string') {
    return { id: b, label: b, icon: 'star', color: '#0A84FF', description: '' };
  }
  return {
    id: b.id || b.label || 'badge',
    label: b.label || b.name || b.id || 'Badge',
    icon: b.icon || 'star',
    color: b.color || '#0A84FF',
    description: b.description || ''
  };
}

const badgeRowObservers = new WeakMap();

/**
 * Renders space-aware badge pills using ResizeObserver.
 * Strictly prioritizes member name and points metric remaining 100% visible and unclipped.
 */
export function renderBadgeRow(container, badges, member) {
  if (!container) return;
  const rawList = Array.isArray(badges) ? badges : (member?.badges && Array.isArray(member.badges) ? member.badges : []);
  const normBadges = rawList.map(normalizeBadgeItem).filter(Boolean);

  if (normBadges.length === 0) {
    container.innerHTML = '';
    const oldRo = badgeRowObservers.get(container);
    if (oldRo) {
      oldRo.disconnect();
      badgeRowObservers.delete(container);
    }
    return;
  }

  const memberUid = member?.uid || (typeof member === 'string' ? member : container.dataset.uid);

  const updateBadgesLayout = () => {
    const availableWidth = container.clientWidth;
    if (availableWidth <= 0) return;

    // Fast offscreen measurement to compute exact font/padding dimensions
    const offscreen = document.createElement('div');
    offscreen.className = 'flex items-center gap-1';
    offscreen.style.cssText = 'position: absolute; visibility: hidden; pointer-events: none; left: -9999px; top: -9999px; white-space: nowrap; font-size: 10px;';

    normBadges.forEach(b => {
      const chip = document.createElement('span');
      chip.className = 'badge-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none shrink-0';
      chip.innerHTML = `${getCategorySvg(b.icon || 'star', 'w-2.5 h-2.5')}<span class="truncate max-w-[70px]">${esc(b.label)}</span>`;
      offscreen.appendChild(chip);
    });

    const morePill = document.createElement('button');
    morePill.className = 'badge-more-pill inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none shrink-0';
    morePill.textContent = `+${normBadges.length}`;
    offscreen.appendChild(morePill);

    document.body.appendChild(offscreen);

    const chipWidths = [];
    for (let i = 0; i < normBadges.length; i++) {
      chipWidths.push(offscreen.children[i].getBoundingClientRect().width);
    }
    const moreWidth = offscreen.children[normBadges.length].getBoundingClientRect().width;
    document.body.removeChild(offscreen);

    const gap = 4;
    let visibleCount = 0;
    let hasMore = false;

    // Check if ALL badges fit without +N
    const totalAll = chipWidths.reduce((a, b) => a + b, 0) + (normBadges.length - 1) * gap;
    if (totalAll <= availableWidth) {
      visibleCount = normBadges.length;
      hasMore = false;
    } else {
      // Find maximum k complete chips that fit cleanly with +N counter pill
      for (let k = normBadges.length - 1; k >= 1; k--) {
        const subSum = chipWidths.slice(0, k).reduce((a, b) => a + b, 0) + k * gap + moreWidth;
        if (subSum <= availableWidth) {
          visibleCount = k;
          hasMore = true;
          break;
        }
      }
      if (visibleCount === 0) {
        // Space only fits 1 chip (or less) -> render at most 1 chip + compact gray +N counter pill
        visibleCount = 1;
        hasMore = normBadges.length > 1;
      }
    }

    const htmlParts = [];
    for (let i = 0; i < visibleCount; i++) {
      const b = normBadges[i];
      htmlParts.push(`
        <span class="badge-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none shrink-0" style="background:${b.color}20; color:${b.color}; border: 1px solid ${b.color}40;" title="${esc(b.label)}">
          ${getCategorySvg(b.icon || 'star', 'w-2.5 h-2.5')}
          <span class="truncate max-w-[70px]">${esc(b.label)}</span>
        </span>
      `);
    }

    if (hasMore && normBadges.length > visibleCount) {
      const remaining = normBadges.length - visibleCount;
      htmlParts.push(`
        <button type="button" class="badge-more-pill inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none shrink-0 cursor-pointer hover:bg-white/20 transition" style="background: rgba(142,142,147,0.24); color: #E5E5EA; border: 1px solid rgba(255,255,255,0.1);" title="${remaining} more badges" data-uid="${esc(memberUid || '')}">
          +${remaining}
        </button>
      `);
    }

    container.innerHTML = htmlParts.join('');

    const moreBtn = container.querySelector('.badge-more-pill');
    if (moreBtn) {
      moreBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (memberUid) openMiniProfileSheet(memberUid);
      };
    }
  };

  let ro = badgeRowObservers.get(container);
  if (!ro) {
    ro = new ResizeObserver(() => {
      updateBadgesLayout();
    });
    ro.observe(container);
    badgeRowObservers.set(container, ro);
  }

  updateBadgesLayout();
  requestAnimationFrame(updateBadgesLayout);
}

/**
 * Opens read-only Mini-Profile Half-Sheet with overhanging avatar.
 * NEVER renders finesEGP to other members (only self or admin).
 */
export function openMiniProfileSheet(uidOrMember) {
  const uid = typeof uidOrMember === 'string' ? uidOrMember : (uidOrMember?.uid || '');
  const userProf = getUserProfile(uid, uidOrMember?.displayName || uidOrMember?.name || 'Member', uidOrMember?.photoURL || uidOrMember?.avatarUrl || '');
  const normBadges = (userProf.badges || []).map(normalizeBadgeItem).filter(Boolean);

  const currentUid = state.user?.uid;
  const currentUserInMap = currentUid ? usersMap.get(currentUid) : null;
  const isViewerAdmin = Boolean(
    state.user?.isAdmin || 
    state.user?.role === 'admin' || 
    currentUserInMap?.isAdmin || 
    currentUserInMap?.role === 'admin'
  );
  const isSelf = Boolean(currentUid && currentUid === userProf.uid);
  const showFines = isSelf || isViewerAdmin;

  const wrapperEl = document.createElement('div');
  wrapperEl.className = 'mini-profile-container relative w-full flex flex-col h-full';

  // 1. Overhanging Avatar (88px x 88px, margin-top: -44px, protruding 44px above sheet border)
  const avatarHtml = `
    <div class="mini-profile-avatar-anchor flex justify-center w-full" style="position: relative; z-index: 30; flex-shrink: 0;">
      <div class="mini-profile-avatar-protruding rounded-full overflow-hidden flex items-center justify-center" style="width: 88px; height: 88px; margin-top: -44px; border: 4px solid var(--bg-elevated, #1C1C1E); box-shadow: 0 8px 24px rgba(0,0,0,0.5); background: var(--bg-elevated, #1C1C1E);">
        ${renderAvatar(userProf, 'w-full h-full text-2xl font-bold')}
      </div>
    </div>
  `;

  // 2. Dismiss Button
  const dismissBtnHtml = `
    <button type="button" class="mini-profile-close-btn absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center text-xs z-40 transition cursor-pointer" aria-label="Close">✕</button>
  `;

  // 3. Stats row (NEVER show finesEGP to other members; only self or admin)
  const statsHtml = showFines ? `
    <div class="grid grid-cols-3 gap-2.5 pt-2">
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
        <span class="text-[10px] uppercase tracking-wider text-neutral-400 block font-medium">Points</span>
        <span class="text-base font-bold font-mono text-amber-400 mt-0.5 block">${userProf.points || 0}</span>
      </div>
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
        <span class="text-[10px] uppercase tracking-wider text-neutral-400 block font-medium">Penalties</span>
        <span class="text-base font-bold font-mono text-rose-400 mt-0.5 block">${userProf.penalties || 0}</span>
      </div>
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
        <span class="text-[10px] uppercase tracking-wider text-neutral-400 block font-medium">Fines</span>
        <span class="text-base font-bold font-mono text-rose-300 mt-0.5 block">${userProf.finesEGP !== undefined ? userProf.finesEGP : (userProf.penalties ? `${userProf.penalties} EGP` : '0 EGP')}</span>
      </div>
    </div>
  ` : `
    <div class="grid grid-cols-2 gap-2.5 pt-2">
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
        <span class="text-[10px] uppercase tracking-wider text-neutral-400 block font-medium">Points</span>
        <span class="text-base font-bold font-mono text-amber-400 mt-0.5 block">${userProf.points || 0}</span>
      </div>
      <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-center">
        <span class="text-[10px] uppercase tracking-wider text-neutral-400 block font-medium">Penalties</span>
        <span class="text-base font-bold font-mono text-rose-400 mt-0.5 block">${userProf.penalties || 0}</span>
      </div>
    </div>
  `;

  // 4. Badges detail grid
  const badgesGridHtml = `
    <div class="space-y-2 pt-1">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-white uppercase tracking-wider">Earned Badges (${normBadges.length})</span>
      </div>
      ${normBadges.length === 0 ? `
        <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-neutral-400">
          No badges earned yet.
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${normBadges.map(b => `
            <div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: ${b.color}20; color: ${b.color}; border: 1px solid ${b.color}40;">
                ${getCategorySvg(b.icon || 'star', 'w-4 h-4')}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs text-white truncate">${esc(b.label)}</div>
                <div class="text-[11px] text-neutral-400 mt-0.5 leading-snug">${esc(b.description || 'Verified Team Achievement')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  wrapperEl.innerHTML = `
    ${avatarHtml}
    ${dismissBtnHtml}
    <div class="mini-profile-scroll-body flex-1 overflow-y-auto space-y-4 pt-1 pb-4" style="-webkit-overflow-scrolling: touch;">
      <div>
        <h3 class="text-lg font-bold text-white text-center">${esc(userProf.displayName)}</h3>
        <div class="flex justify-center mt-1">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${userProf.isAdmin ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/10 text-neutral-300 border border-white/10'}">
            ${esc(userProf.role || (userProf.isAdmin ? 'admin' : 'member'))}
          </span>
        </div>
      </div>
      ${statsHtml}
      ${badgesGridHtml}
    </div>
  `;

  let modal = null;
  const dismissBtn = wrapperEl.querySelector('.mini-profile-close-btn');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      if (modal) modal.close();
    };
  }

  modal = openModal({
    title: '',
    body: wrapperEl,
    sheetClass: 'mini-profile-sheet'
  });
}

/* ==========================================================================
   UNIVERSAL iOS MEMBER PICKER HALF-SHEET
   ========================================================================== */
export function openMemberPicker({ multi = false, includeAllOption = false, filterBadgeIds = null, selectedUids = [], onConfirm }) {
  const selectedSet = new Set((selectedUids || []).map(String));
  let searchQuery = '';
  let activeFilter = 'all';

  const getDistinctBadges = () => {
    const list = [];
    const seen = new Set();
    for (const u of usersMap.values()) {
      if (Array.isArray(u.badges)) {
        for (const b of u.badges) {
          if (b && b.id && !seen.has(b.id)) {
            seen.add(b.id);
            list.push(b);
          }
        }
      }
    }
    return list;
  };

  const badgesList = getDistinctBadges();

  const renderContent = () => {
    let members = Array.from(usersMap.values());

    if (Array.isArray(filterBadgeIds) && filterBadgeIds.length > 0) {
      members = members.filter(m => (m.badgeIds || []).some(id => filterBadgeIds.includes(id)));
    }

    if (activeFilter === 'admin') {
      members = members.filter(m => m.isAdmin || m.role === 'admin');
    } else if (activeFilter !== 'all') {
      members = members.filter(m => (m.badgeIds || []).includes(activeFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      members = members.filter(m => {
        const nameMatch = (m.displayName || m.name || '').toLowerCase().includes(q);
        const roleMatch = (m.role || '').toLowerCase().includes(q);
        const badgeMatch = (m.badges || []).some(b => (b.label || b.id || '').toLowerCase().includes(q));
        return nameMatch || roleMatch || badgeMatch;
      });
    }

    const pillsHtml = `
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1" id="member-picker-pills">
        <button type="button" data-filter="all" class="member-filter-pill px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeFilter === 'all' ? 'bg-[#0A84FF] text-white' : 'bg-white/10 text-neutral-300 hover:text-white'}">
          All (${usersMap.size})
        </button>
        <button type="button" data-filter="admin" class="member-filter-pill px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeFilter === 'admin' ? 'bg-[#0A84FF] text-white' : 'bg-white/10 text-neutral-300 hover:text-white'}">
          Admins
        </button>
        ${badgesList.map(b => `
          <button type="button" data-filter="${esc(b.id)}" class="member-filter-pill px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeFilter === b.id ? 'bg-[#0A84FF] text-white' : 'bg-white/10 text-neutral-300 hover:text-white'}" style="${activeFilter === b.id && b.color ? `background-color: ${b.color};` : ''}">
            ${esc(b.label || b.id)}
          </button>
        `).join('')}
      </div>
    `;

    const allSelected = selectedSet.has('all');
    const allRowHtml = includeAllOption ? `
      <div class="member-picker-item flex items-center justify-between p-3 rounded-2xl glass-card border ${allSelected ? 'border-[#0A84FF]/60 bg-[#0A84FF]/10' : 'border-white/5 hover:bg-white/5'} cursor-pointer transition select-none" data-uid="all">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="font-bold text-white text-sm truncate">All Team Members</div>
            <div class="text-[11px] text-neutral-400">Broadcast or assign to everyone</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${allSelected ? `
            <span class="w-6 h-6 rounded-full bg-[#0A84FF] flex items-center justify-center text-white">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          ` : `
            <span class="w-6 h-6 rounded-full border border-white/20"></span>
          `}
        </div>
      </div>
    ` : '';

    const membersHtml = members.length === 0 ? `
      <div class="p-8 text-center text-xs text-neutral-400">No members match your search.</div>
    ` : members.map(m => {
      const isSelected = selectedSet.has(m.uid);
      const badgesBadgeHtml = (m.badges || []).map(b => `
        <span class="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded-full font-semibold" style="background-color: ${b.color || '#0A84FF'}22; color: ${b.color || '#0A84FF'}; border: 1px solid ${b.color || '#0A84FF'}44;">
          ${esc(b.label || b.id)}
        </span>
      `).join('');

      return `
        <div class="member-picker-item flex items-center justify-between p-3 rounded-2xl glass-card border ${isSelected ? 'border-[#0A84FF]/60 bg-[#0A84FF]/10' : 'border-white/5 hover:bg-white/5'} cursor-pointer transition select-none" data-uid="${esc(m.uid)}">
          <div class="flex items-center gap-3 min-w-0">
            ${renderAvatar(m, 'w-10 h-10')}
            <div class="min-w-0">
              <div class="font-bold text-white text-sm truncate flex items-center gap-1.5">
                <span>${esc(m.displayName || m.name)}</span>
                ${m.isAdmin ? '<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin</span>' : ''}
              </div>
              <div class="flex items-center gap-1.5 flex-wrap text-[11px] text-neutral-400 mt-0.5">
                <span class="capitalize">${esc(m.role || 'member')}</span>
                <span>•</span>
                <span class="font-mono text-amber-400 font-semibold">${m.points || 0} pts</span>
                ${badgesBadgeHtml}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${isSelected ? `
              <span class="w-6 h-6 rounded-full bg-[#0A84FF] flex items-center justify-center text-white">
                <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
            ` : `
              <span class="w-6 h-6 rounded-full border border-white/20"></span>
            `}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-3.5 text-xs">
        <div class="relative">
          <svg class="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="search" id="member-picker-search" class="w-full pl-9 pr-3 py-2 rounded-xl bg-white/10 text-white placeholder-neutral-400 text-xs border border-white/10 focus:border-[#0A84FF] focus:outline-none transition" placeholder="Search members by name, role or badge..." value="${esc(searchQuery)}" />
        </div>

        ${pillsHtml}

        <div id="member-picker-items-container" class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          ${allRowHtml}
          ${membersHtml}
        </div>
      </div>
    `;
  };

  const bindPickerEvents = (modalRef) => {
    const container = document.getElementById('shared-modal-body');
    if (!container) return;

    const searchInput = document.getElementById('member-picker-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        refreshListOnly();
      };
    }

    container.querySelectorAll('.member-filter-pill').forEach(btn => {
      btn.onclick = () => {
        activeFilter = btn.dataset.filter;
        refreshFull();
      };
    });

    container.querySelectorAll('.member-picker-item').forEach(item => {
      item.onclick = () => {
        const uid = item.dataset.uid;
        if (!multi) {
          selectedSet.clear();
          selectedSet.add(uid);
          if (typeof onConfirm === 'function') {
            onConfirm([uid]);
          }
          if (modalRef && typeof modalRef.close === 'function') {
            modalRef.close();
          } else {
            closeAllModals();
          }
        } else {
          if (selectedSet.has(uid)) {
            selectedSet.delete(uid);
          } else {
            selectedSet.add(uid);
          }
          refreshFull();
        }
      };
    });
  };

  let modalInstance = null;

  const refreshFull = () => {
    const bodyEl = document.getElementById('shared-modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = renderContent();
      bindPickerEvents(modalInstance);
    }
  };

  const refreshListOnly = () => {
    refreshFull();
    const searchInput = document.getElementById('member-picker-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    }
  };

  modalInstance = openModal({
    title: multi ? 'Select Members' : 'Select Member',
    body: renderContent(),
    saveLabel: 'Done',
    onSave: multi ? () => {
      if (typeof onConfirm === 'function') {
        onConfirm(Array.from(selectedSet));
      }
      return true;
    } : null
  });

  bindPickerEvents(modalInstance);
}

/**
 * Skeleton shimmer loading card generator.
 */
export function renderSkeleton(type = 'card', count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'row') {
      html += `
        <div class="inset-row flex items-center justify-between py-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full skeleton-shimmer"></div>
            <div class="space-y-1.5">
              <div class="w-24 h-3.5 skeleton-shimmer"></div>
              <div class="w-16 h-2.5 skeleton-shimmer"></div>
            </div>
          </div>
          <div class="w-12 h-4 skeleton-shimmer"></div>
        </div>
      `;
    } else {
      html += `
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="w-20 h-4 skeleton-shimmer"></div>
            <div class="w-12 h-4 skeleton-shimmer"></div>
          </div>
          <div class="w-3/4 h-5 skeleton-shimmer"></div>
          <div class="w-full h-3 skeleton-shimmer"></div>
        </div>
      `;
    }
  }
  return html;
}

/**
 * iOS-style empty state card helper.
 */
export function renderEmptyState({ icon = 'clipboard-list', title = 'No items found', message = 'Check back later or adjust your filters.', actionLabel = '', onAction = null }) {
  return `
    <div class="glass-card p-10 text-center border border-dashed border-white/15 my-4">
      <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-white/[0.05] flex items-center justify-center text-neutral-400">
        <svg class="w-7 h-7 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="ios-headline text-white">${esc(title)}</h3>
      <p class="ios-footnote text-neutral-400 mt-1 max-w-xs mx-auto">${esc(message)}</p>
      ${actionLabel ? `
        <button class="mt-4 px-4 py-2 rounded-full text-xs font-semibold bg-[#0A84FF] text-white empty-action-btn">
          ${esc(actionLabel)}
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Offline status banner controller.
 */
function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  const update = () => {
    if (navigator.onLine) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

/**
 * Global friendly English error boundary.
 */
function initErrorBoundary() {
  const boundary = document.getElementById('global-error-boundary');
  const msgEl = document.getElementById('error-boundary-message');
  if (!boundary) return;

  const isIgnoredError = (err) => {
    if (!err) return false;
    const msg = String(err?.message || err?.reason?.message || (typeof err === 'string' ? err : ''));
    const stack = String(err?.stack || err?.reason?.stack || '');
    const filename = String(err?.filename || '');
    const target = err?.target?.constructor?.name || '';
    const combined = `${msg} ${stack} ${filename} ${target}`.toLowerCase();

    return (
      combined.includes('resizeobserver') ||
      combined.includes('loop completed with undelivered notifications') ||
      combined.includes('websocket') ||
      combined.includes('@vite/client') ||
      combined.includes('ws://') ||
      combined.includes('wss://') ||
      combined.includes('closed without opened') ||
      combined.includes('vite:ws')
    );
  };

  const handleError = (error) => {
    if (isIgnoredError(error)) {
      console.warn('Ignored transient layout/WebSocket warning:', error?.message || error);
      return;
    }
    console.error('Captured by global error boundary:', error);
    if (msgEl) {
      msgEl.textContent = error?.message || 'An unexpected error occurred while executing the workspace.';
    }
    boundary.classList.remove('hidden');
    boundary.style.display = '';
  };

  const dismissBtn = document.getElementById('dismissErrorBtn');
  if (dismissBtn) {
    dismissBtn.onclick = (e) => {
      e?.preventDefault?.();
      boundary.classList.add('hidden');
      boundary.style.display = 'none';
      document.body.style.overflow = '';
      if (msgEl) msgEl.textContent = '';
    };
  }

  window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (isIgnoredError(error || msg)) return true;
  };

  window.addEventListener('error', (event) => {
    if (isIgnoredError(event) || isIgnoredError(event.error)) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      return true;
    }
    handleError(event.error || event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isIgnoredError(event) || isIgnoredError(event.reason)) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      return true;
    }
    handleError(event.reason || event);
  });
}

/**
 * Custom dialogs for backwards compatibility.
 */
export function showCustomAlert(title, message, options = {}) {
  const modal = document.getElementById('modal-custom-alert');
  const titleEl = document.getElementById('custom-alert-title');
  const msgEl = document.getElementById('custom-alert-message');
  const okBtn = document.getElementById('btn-custom-alert-ok');
  const actionBtn = document.getElementById('btn-custom-alert-action');
  const actionLabel = document.getElementById('btn-custom-alert-action-label');

  if (!modal) return Promise.resolve(true);

  titleEl.textContent = title;
  msgEl.textContent = message;

  if (options.actionLabel && typeof options.onAction === 'function') {
    actionBtn.classList.remove('hidden');
    actionLabel.textContent = options.actionLabel;
    actionBtn.onclick = () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      options.onAction();
    };
  } else {
    actionBtn.classList.add('hidden');
  }

  document.body.style.overflow = 'hidden';
  modal.classList.add('open');

  return new Promise((resolve) => {
    okBtn.onclick = () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      resolve(true);
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

  if (!modal) return Promise.resolve(null);

  titleEl.textContent = title;
  msgEl.textContent = message;
  input.value = defaultValue;

  document.body.style.overflow = 'hidden';
  modal.classList.add('open');
  input.focus();

  return new Promise((resolve) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const val = input.value;
      modal.classList.remove('open');
      document.body.style.overflow = '';
      resolve(val);
    };
    cancelBtn.onclick = () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      resolve(null);
    };
  });
}

/* ==========================================================================
   GLOBAL LONG-PRESS BULK SELECTION MODE CONTROLLER
   ========================================================================== */
export const selectionState = {
  active: false,
  type: null, // 'tasks' | 'admin_tasks' | 'categories' | 'notifications' | 'members' | 'sessions' | 'submissions' | 'broadcasts'
  selectedIds: new Set(),
  visibleIds: []
};

const BULK_INDICATOR_HTML = `<span class="bulk-select-indicator" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`;

export function attachLongPress(cardEl, onTrigger) {
  if (!cardEl || typeof onTrigger !== 'function') return;
  let timer = null;
  let startX = 0;
  let startY = 0;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const start = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    clear();
    timer = setTimeout(() => {
      clear();
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (_) {}
      }
      onTrigger();
    }, 500);
  };

  const move = (e) => {
    if (!timer) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = Math.abs(pt.clientX - startX);
    const dy = Math.abs(pt.clientY - startY);
    if (dx > 8 || dy > 8) {
      clear();
    }
  };

  if (window.PointerEvent) {
    cardEl.addEventListener('pointerdown', start);
    cardEl.addEventListener('pointermove', move);
    cardEl.addEventListener('pointerup', clear);
    cardEl.addEventListener('pointercancel', clear);
  } else {
    cardEl.addEventListener('touchstart', start, { passive: true });
    cardEl.addEventListener('touchmove', move, { passive: true });
    cardEl.addEventListener('touchend', clear, { passive: true });
    cardEl.addEventListener('touchcancel', clear, { passive: true });
  }
}

function getVisibleCardsForType(type) {
  let container = null;
  if (type === 'tasks') container = document.getElementById('tasks-container');
  else if (type === 'notifications') container = document.getElementById('notifications-container');
  else if (type === 'admin_tasks') container = document.getElementById('admin-tasks-tbody');
  else if (type === 'categories') container = document.getElementById('admin-categories-list');
  else if (type === 'members') container = document.getElementById('admin-members-tbody');
  else if (type === 'sessions') container = document.getElementById('admin-sessions-list');
  else if (type === 'submissions') container = document.getElementById('admin-submissions-list');
  else if (type === 'broadcasts') container = document.getElementById('admin-broadcasts-list');

  if (!container) return [];
  return Array.from(container.querySelectorAll('.bulk-select-card[data-bulk-id]'));
}

export function getBulkActions(listType) {
  const isArchivedView = (
    (listType === 'tasks' || listType === 'admin_tasks') && state.adminTasksFilter === 'archived'
  ) || (
    listType === 'categories' && state.adminCatsFilter === 'archived'
  ) || (
    listType === 'sessions' && adminSessionsFilter === 'archived'
  ) || (
    listType === 'broadcasts' && adminBroadcastsFilter === 'archived'
  );

  if (listType === 'tasks' || listType === 'admin_tasks' || listType === 'categories' || listType === 'sessions' || listType === 'broadcasts') {
    return [
      { id: 'btn-bulk-archive', label: isArchivedView ? 'Restore' : 'Archive', type: 'archive', isRestore: isArchivedView, class: 'bg-white/10 hover:bg-white/20 text-white' },
      { id: 'btn-bulk-delete', label: 'Delete', type: 'delete', class: 'text-[#FF453A] hover:bg-[#FF453A]/10' }
    ];
  }

  if (listType === 'submissions' || listType === 'attendance_logs' || listType === 'notifications_admin' || listType === 'waivers') {
    return [
      { id: 'btn-bulk-delete', label: 'Delete', type: 'delete', class: 'text-[#FF453A] hover:bg-[#FF453A]/10' }
    ];
  }

  if (listType === 'members') {
    return [
      { id: 'btn-bulk-add-badge', label: 'Add Badge', type: 'add_badge', class: 'bg-[#0A84FF] hover:bg-[#0071E3] text-white' },
      { id: 'btn-bulk-remove-badge', label: 'Remove Badge', type: 'remove_badge', class: 'bg-white/10 hover:bg-white/20 text-white' }
    ];
  }

  if (listType === 'notifications' || listType === 'updates') {
    return [
      { id: 'btn-bulk-mark-read', label: 'Mark Read', type: 'mark_read', class: 'bg-[#0A84FF] hover:bg-[#0071E3] text-white' }
    ];
  }

  return [
    { id: 'btn-bulk-delete', label: 'Delete', type: 'delete', class: 'text-[#FF453A]' }
  ];
}

export function enterSelectionMode(type, initialSelectedId = null) {
  selectionState.active = true;
  selectionState.type = type;
  selectionState.selectedIds = new Set();
  if (initialSelectedId) {
    selectionState.selectedIds.add(String(initialSelectedId));
  }

  document.body.classList.add('selection-mode-active');

  const userPagerEl = document.getElementById('user-pager');
  const adminPagerEl = document.getElementById('admin-pager');
  if (userPagerEl) {
    userPagerEl.style.overflowX = 'hidden';
    userPagerEl.style.touchAction = 'pan-y';
  }
  if (adminPagerEl) {
    adminPagerEl.style.overflowX = 'hidden';
    adminPagerEl.style.touchAction = 'pan-y';
  }

  const bar = document.getElementById('bulk-selection-bar');
  if (bar) {
    bar.classList.remove('hidden');
  }

  updateSelectionUI();
}

export function exitSelectionMode() {
  selectionState.active = false;
  selectionState.type = null;
  selectionState.selectedIds.clear();
  selectionState.visibleIds = [];

  document.body.classList.remove('selection-mode-active');

  const userPagerEl = document.getElementById('user-pager');
  const adminPagerEl = document.getElementById('admin-pager');
  if (userPagerEl) {
    userPagerEl.style.overflowX = '';
    userPagerEl.style.touchAction = '';
  }
  if (adminPagerEl) {
    adminPagerEl.style.overflowX = '';
    adminPagerEl.style.touchAction = '';
  }

  document.querySelectorAll('.bulk-select-card.selected').forEach(card => {
    card.classList.remove('selected');
  });

  const bar = document.getElementById('bulk-selection-bar');
  if (bar) {
    bar.classList.add('hidden');
  }
}

export function updateSelectionUI() {
  if (!selectionState.active) return;

  const cards = getVisibleCardsForType(selectionState.type);
  selectionState.visibleIds = cards.map(c => c.dataset.bulkId).filter(Boolean);

  cards.forEach(card => {
    const isSelected = selectionState.selectedIds.has(card.dataset.bulkId);
    card.classList.toggle('selected', isSelected);
  });

  const count = selectionState.selectedIds.size;
  const countEl = document.getElementById('bulk-selection-count');
  if (countEl) {
    countEl.textContent = `${count} Selected`;
  }

  const selectAllBtn = document.getElementById('btn-bulk-select-all');
  if (selectAllBtn) {
    const allSelected = selectionState.visibleIds.length > 0 &&
      selectionState.visibleIds.every(id => selectionState.selectedIds.has(id));
    selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
    selectAllBtn.onclick = toggleSelectAll;
  }

  const actionsContainer = document.getElementById('bulk-actions-container');
  if (actionsContainer) {
    const actions = getBulkActions(selectionState.type);
    actionsContainer.innerHTML = '';
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = act.id;
      btn.className = `text-xs font-semibold px-2.5 py-1 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${act.class || ''}`;
      btn.textContent = act.label;
      btn.disabled = (count === 0);
      btn.onclick = () => {
        if (act.type === 'archive') {
          handleBulkArchive(act.isRestore);
        } else if (act.type === 'delete') {
          handleBulkDelete();
        } else if (act.type === 'add_badge') {
          handleBulkBadge(true);
        } else if (act.type === 'remove_badge') {
          handleBulkBadge(false);
        } else if (act.type === 'mark_read') {
          handleBulkMarkRead();
        }
      };
      actionsContainer.appendChild(btn);
    });

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.id = 'btn-bulk-done';
    doneBtn.className = 'text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-white hover:bg-white/20 transition';
    doneBtn.textContent = 'Done';
    doneBtn.onclick = exitSelectionMode;
    actionsContainer.appendChild(doneBtn);
  }
}

export function toggleItemSelection(cardEl, id) {
  if (!selectionState.active) return;
  const strId = String(id);
  if (selectionState.selectedIds.has(strId)) {
    selectionState.selectedIds.delete(strId);
  } else {
    selectionState.selectedIds.add(strId);
  }
  updateSelectionUI();
}

export function toggleSelectAll() {
  if (!selectionState.active) return;
  const allSelected = selectionState.visibleIds.length > 0 &&
    selectionState.visibleIds.every(id => selectionState.selectedIds.has(id));

  if (allSelected) {
    selectionState.selectedIds.clear();
  } else {
    selectionState.visibleIds.forEach(id => selectionState.selectedIds.add(id));
  }
  updateSelectionUI();
}

export async function handleBulkArchive(isRestore = false) {
  const ids = Array.from(selectionState.selectedIds);
  const count = ids.length;
  if (count === 0) return;

  const type = selectionState.type;
  const newArchived = !isRestore;
  const actionLabel = isRestore ? 'Restore' : 'Archive';

  const confirmed = await confirmSheet({
    title: `${actionLabel} ${count} Item(s)?`,
    message: `${actionLabel} ${count} selected item(s)?`,
    confirmLabel: `${actionLabel} ${count}`,
    destructive: false
  });
  if (!confirmed) return;

  try {
    const CHUNK_SIZE = 450;
    let colName = 'tasks';
    if (type === 'categories') colName = 'categories';
    else if (type === 'sessions') colName = 'attendance_sessions';
    else if (type === 'broadcasts') colName = 'notifications_broadcast';

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        const ref = doc(db, colName, id);
        batch.update(ref, { archived: newArchived, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }

    // In-memory update immediately
    if (type === 'tasks' || type === 'admin_tasks') {
      ids.forEach(id => {
        const t = state.tasks.find(x => x.id === id);
        if (t) t.archived = newArchived;
      });
      renderTasksView();
      renderAdminTasks();
    } else if (type === 'categories') {
      ids.forEach(id => {
        const c = state.categories.find(x => x.id === id);
        if (c) c.archived = newArchived;
      });
      renderAdminCategories();
    } else if (type === 'sessions') {
      ids.forEach(id => {
        const s = state.attendanceSessions.find(x => x.id === id);
        if (s) s.archived = newArchived;
      });
      renderAdminSessions();
      renderAttendanceView();
    } else if (type === 'broadcasts') {
      ids.forEach(id => {
        const b = state.broadcasts.find(x => x.id === id);
        if (b) b.archived = newArchived;
      });
      renderAdminBroadcasts();
      renderBroadcastBanner();
    }

    toast(`${count} item(s) ${isRestore ? 'restored' : 'archived'} successfully`, 'success');
    exitSelectionMode();
  } catch (err) {
    console.error(`Bulk ${actionLabel} error:`, err);
    toast(`Failed to ${actionLabel.toLowerCase()} items: ` + err.message, 'error');
  }
}

export async function handleBulkDelete() {
  const ids = Array.from(selectionState.selectedIds);
  const count = ids.length;
  if (count === 0) return;

  const type = selectionState.type;
  if (type === 'members') {
    toast('Members cannot be deleted.', 'error');
    return;
  }

  const consequence = {
    tasks: 'Submissions will keep their history.',
    admin_tasks: 'Submissions will keep their history.',
    categories: 'Tasks in this category will become "Uncategorized".',
    sessions: 'Attendance history will remain preserved.',
    broadcasts: 'This broadcast announcement will be permanently removed.',
    submissions: 'Awarded points will be revoked from members.',
    attendance_logs: 'Penalties will be reversed from members.',
    notifications_admin: 'These notifications will be permanently deleted.',
    waivers: 'These waiver requests will be permanently deleted.'
  }[type] || 'This action cannot be undone.';

  const confirmed = await confirmSheet({
    title: `Permanently Delete ${count} Item(s)?`,
    message: `Permanently delete ${count} selected item(s)? This cannot be undone.\n\n${consequence}`,
    confirmLabel: `Delete ${count}`,
    destructive: true
  });
  if (!confirmed) return;

  try {
    const CHUNK_SIZE = 450;

    if (type === 'submissions') {
      const subMap = new Map();
      ids.forEach(id => {
        const s = state.submissions.find(sub => sub.id === id);
        if (s) {
          const uid = s.userId || s.uid;
          if (uid) {
            if (!subMap.has(uid)) subMap.set(uid, { totalPoints: 0, submissions: [] });
            const entry = subMap.get(uid);
            entry.totalPoints += (Number(s.pointsAwarded) || 0);
            entry.submissions.push(s);
          }
        }
      });

      for (const [uid, entry] of subMap.entries()) {
        const memberUser = usersMap.get(uid) || state.members.find(m => m.uid === uid);
        const batch = writeBatch(db);

        entry.submissions.forEach(s => {
          batch.delete(doc(db, 'submissions', s.id));
        });

        if (memberUser && entry.totalPoints > 0) {
          const latestTime = entry.submissions[0]?.submittedAt || Date.now();
          const pointsUpdate = buildPointsUpdate(memberUser, -entry.totalPoints, latestTime);
          batch.update(doc(db, 'users', uid), pointsUpdate);

          createNotification(batch, {
            uid,
            title: 'Points Revoked',
            message: `${entry.totalPoints} points have been revoked due to deleted submissions.`,
            type: 'task',
            targetAction: { route: 'home' }
          });

          logAdminAction(batch, {
            action: 'submissions_bulk_deleted',
            targetUid: uid,
            details: { count: entry.submissions.length, pointsRevoked: entry.totalPoints }
          });
        }
        await batch.commit();

        if (memberUser && entry.totalPoints > 0) {
          memberUser.points = Math.max(0, (memberUser.points || 0) - entry.totalPoints);
          if (state.user && state.user.uid === uid) {
            state.user.points = memberUser.points;
            updateProfileUI();
          }
        }
      }

      state.submissions = state.submissions.filter(s => !selectionState.selectedIds.has(s.id));
      renderSubmissionsInspector();
    } else if (type === 'attendance_logs') {
      const logMap = new Map();
      ids.forEach(id => {
        const l = state.attendanceLogs.find(log => log.id === id) || state.myAttendanceLogs.find(log => log.id === id);
        if (l) {
          const uid = l.uid;
          if (uid) {
            if (!logMap.has(uid)) logMap.set(uid, { totalPenalty: 0, logs: [] });
            const entry = logMap.get(uid);
            entry.totalPenalty += (Number(l.penalty) || 0);
            entry.logs.push(l);
          }
        }
      });

      for (const [uid, entry] of logMap.entries()) {
        const memberUser = usersMap.get(uid) || state.members.find(m => m.uid === uid);
        const batch = writeBatch(db);

        entry.logs.forEach(l => {
          batch.delete(doc(db, 'attendance_logs', l.id));
        });

        if (memberUser && entry.totalPenalty > 0) {
          batch.update(doc(db, 'users', uid), {
            penalties: increment(-entry.totalPenalty),
            updatedAt: serverTimestamp()
          });
        }
        await batch.commit();

        invalidateEgpCache(uid);
        if (memberUser && entry.totalPenalty > 0) {
          memberUser.penalties = Math.max(0, (memberUser.penalties || 0) - entry.totalPenalty);
          if (state.user && state.user.uid === uid) {
            state.user.penalties = memberUser.penalties;
            updateProfileUI();
          }
        }
      }

      state.attendanceLogs = state.attendanceLogs.filter(l => !selectionState.selectedIds.has(l.id));
      state.myAttendanceLogs = state.myAttendanceLogs.filter(l => !selectionState.selectedIds.has(l.id));
      renderAttendanceLogs();
    } else {
      let colName = 'tasks';
      if (type === 'categories') colName = 'categories';
      else if (type === 'sessions') colName = 'attendance_sessions';
      else if (type === 'broadcasts') colName = 'notifications_broadcast';
      else if (type === 'notifications' || type === 'notifications_admin') colName = 'notifications';
      else if (type === 'waivers') colName = 'waiver_requests';

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, colName, id));
        });
        await batch.commit();
      }

      if (type === 'tasks' || type === 'admin_tasks') {
        state.tasks = state.tasks.filter(t => !selectionState.selectedIds.has(t.id));
        renderTasksView();
        renderAdminTasks();
      } else if (type === 'categories') {
        state.categories = state.categories.filter(c => !selectionState.selectedIds.has(c.id));
        renderAdminCategories();
        renderTasksView();
      } else if (type === 'sessions') {
        state.attendanceSessions = state.attendanceSessions.filter(s => !selectionState.selectedIds.has(s.id));
        renderAdminSessions();
        renderAttendanceView();
      } else if (type === 'broadcasts') {
        state.broadcasts = state.broadcasts.filter(b => !selectionState.selectedIds.has(b.id));
        renderAdminBroadcasts();
        renderBroadcastBanner();
      } else if (type === 'notifications' || type === 'notifications_admin') {
        state.notifications = state.notifications.filter(n => !selectionState.selectedIds.has(n.id));
        renderNotifications();
      } else if (type === 'waivers') {
        state.waiverRequests = state.waiverRequests.filter(w => !selectionState.selectedIds.has(w.id));
        renderAdminWaivers();
      }
    }

    toast(`${count} item(s) permanently deleted`, 'info');
    exitSelectionMode();
  } catch (err) {
    console.error('Bulk delete error:', err);
    toast('Bulk delete failed: ' + err.message, 'error');
  }
}

export function handleBulkBadge(isAdd = true) {
  const ids = Array.from(selectionState.selectedIds);
  const count = ids.length;
  if (count === 0) return;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-3';
  bodyEl.innerHTML = `
    <p class="text-xs text-neutral-300">
      ${isAdd ? 'Select a badge to assign to' : 'Select a badge to remove from'} <strong>${count}</strong> member(s):
    </p>
    <div class="grid grid-cols-2 gap-2 pt-2 max-h-60 overflow-y-auto">
      ${PRESET_BADGES.map(preset => `
        <button type="button" class="btn-bulk-badge-pick p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition flex items-center gap-2" data-preset-id="${esc(preset.id)}">
          <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${preset.color}"></span>
          <span class="font-bold text-white text-xs">${esc(preset.label)}</span>
        </button>
      `).join('')}
    </div>
  `;

  openModal({
    title: isAdd ? 'Assign Badge in Bulk' : 'Remove Badge in Bulk',
    body: bodyEl,
    saveLabel: 'Cancel',
    onSave: async () => true
  });

  bodyEl.querySelectorAll('.btn-bulk-badge-pick').forEach(btn => {
    btn.onclick = async () => {
      const presetId = btn.dataset.presetId;
      const preset = PRESET_BADGES.find(p => p.id === presetId);
      if (!preset) return;

      closeModal();
      try {
        const CHUNK_SIZE = 450;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          chunk.forEach(uid => {
            const member = usersMap.get(uid) || state.members.find(m => m.uid === uid);
            let curBadges = Array.isArray(member?.badges) ? [...member.badges] : [];
            let curBadgeIds = Array.isArray(member?.badgeIds) ? [...member.badgeIds] : curBadges.map(b => (b.id || b.label || b));

            if (isAdd) {
              if (!curBadgeIds.includes(preset.id)) {
                curBadges.push(preset);
                curBadgeIds.push(preset.id);
              }
            } else {
              curBadges = curBadges.filter(b => (b.id || b.label || b) !== preset.id);
              curBadgeIds = curBadgeIds.filter(id => id !== preset.id);
            }

            batch.update(doc(db, 'users', uid), {
              badges: curBadges,
              badgeIds: curBadgeIds,
              updatedAt: serverTimestamp()
            });

            createNotification(batch, {
              uid,
              title: isAdd ? 'Badge Awarded!' : 'Badge Removed',
              message: isAdd ? `You have been awarded the "${preset.label}" badge!` : `The "${preset.label}" badge was removed from your profile.`,
              type: 'badge'
            });

            if (member) {
              member.badges = curBadges;
              member.badgeIds = curBadgeIds;
            }
          });

          await batch.commit();
        }

        renderMembersAdmin();
        toast(`Badge "${preset.label}" ${isAdd ? 'added to' : 'removed from'} ${count} member(s)`, 'success');
        exitSelectionMode();
      } catch (err) {
        console.error('Bulk badge error:', err);
        toast('Failed to update badges: ' + err.message, 'error');
      }
    };
  });
}

export async function handleBulkMarkRead() {
  const ids = Array.from(selectionState.selectedIds);
  const count = ids.length;
  if (count === 0) return;

  try {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(id => {
        const notif = state.notifications.find(n => n.id === id);
        if (notif?.isBroadcast) {
          batch.update(doc(db, 'notifications_broadcast', id), {
            readBy: arrayUnion(state.user.uid)
          });
        } else {
          batch.update(doc(db, 'notifications', id), {
            read: true
          });
        }
      });
      await batch.commit();
    }

    ids.forEach(id => {
      const notif = state.notifications.find(n => n.id === id);
      if (notif) notif.read = true;
    });

    renderNotifications();
    toast(`Marked ${count} notification(s) as read`, 'success');
    exitSelectionMode();
  } catch (err) {
    console.error('Bulk mark read error:', err);
    toast('Failed to mark notifications as read: ' + err.message, 'error');
  }
}

/* ==========================================================================
   NAVIGATION: SWIPE PAGER + GLASS DOCK
   ========================================================================== */
/* ==========================================================================
   TOUCH GESTURE DISAMBIGUATION (Card Swipes vs. Page Pager)
   ========================================================================== */
export function enableSwipeableCard(cardEl, { onSwipeLeft, onSwipeRight } = {}) {
  if (!cardEl) return () => {};

  let startX = 0;
  let startY = 0;
  let isCardSwiping = false;
  const pagerEl = cardEl.closest('.pager-container') || document.getElementById('user-pager');

  const origOverflowX = pagerEl ? pagerEl.style.overflowX : '';
  const origTouchAction = pagerEl ? pagerEl.style.touchAction : '';

  const onTouchStart = (e) => {
    if (selectionState.active) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isCardSwiping = false;

    // Screen edge navigation zones: reserve 24px bezel at viewport edges for pager swipe
    if (startX < 24 || startX > window.innerWidth - 24) {
      return;
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    if (startX < 24 || startX > window.innerWidth - 24) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (!isCardSwiping) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        isCardSwiping = true;
        if (pagerEl) {
          pagerEl.style.overflowX = 'hidden';
          pagerEl.style.touchAction = 'pan-y';
        }
      }
    }

    if (isCardSwiping) {
      e.stopPropagation();
      cardEl.style.transform = `translateX(${deltaX}px)`;
      cardEl.style.transition = 'none';
    }
  };

  const onTouchEnd = (e) => {
    if (isCardSwiping) {
      const touch = e.changedTouches[0];
      const deltaX = touch ? touch.clientX - startX : 0;
      cardEl.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
      cardEl.style.transform = '';

      if (deltaX < -60 && typeof onSwipeLeft === 'function') {
        onSwipeLeft(cardEl);
      } else if (deltaX > 60 && typeof onSwipeRight === 'function') {
        onSwipeRight(cardEl);
      }
    }

    isCardSwiping = false;
    if (pagerEl) {
      pagerEl.style.overflowX = origOverflowX;
      pagerEl.style.touchAction = origTouchAction;
    }
  };

  cardEl.addEventListener('touchstart', onTouchStart, { passive: true });
  cardEl.addEventListener('touchmove', onTouchMove, { passive: false });
  cardEl.addEventListener('touchend', onTouchEnd, { passive: true });
  cardEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    cardEl.removeEventListener('touchstart', onTouchStart);
    cardEl.removeEventListener('touchmove', onTouchMove);
    cardEl.removeEventListener('touchend', onTouchEnd);
    cardEl.removeEventListener('touchcancel', onTouchEnd);
  };
}

/* ==========================================================================
   PAGE NAVIGATION PAGER CONTROLLER
   ========================================================================== */
function createPager(pagerEl, dockEl, pages, defaultPageId = 'home', onPageChange = null) {
  if (!pagerEl || !dockEl || !Array.isArray(pages) || pages.length === 0) {
    return { goTo: () => {}, getActive: () => '', destroy: () => {} };
  }

  const thumbEl = dockEl.querySelector('.dock-thumb');
  const dockItems = dockEl.querySelectorAll('.dock-item');

  // Determine initial target page from hash or defaultPageId
  const initialHash = window.location.hash;
  const matchedIdx = pages.findIndex(p => p.hash === initialHash);
  const defaultIdx = pages.findIndex(p => p.id === defaultPageId);
  const fallbackIdx = defaultIdx !== -1 ? defaultIdx : 0;
  let activeIndex = matchedIdx !== -1 ? matchedIdx : fallbackIdx;
  let isProgrammatic = false;
  let programmaticTimeout = null;
  let scrollTimeout = null;

  // Swipe gesture tracking state
  let isTracking = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let startScrollLeft = 0;
  let startTime = 0;
  let swipeDirection = null; // 'horizontal' | 'vertical' | null
  let isPointerDragging = false;

  function updateDockThumb(index, immediate = false) {
    if (index < 0 || index >= pages.length) return;
    activeIndex = index;

    dockItems.forEach((btn, i) => {
      if (i === index) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (thumbEl && dockItems[index]) {
      const targetBtn = dockItems[index];
      const offsetLeft = targetBtn.offsetLeft;
      const width = targetBtn.offsetWidth;

      if (immediate) {
        const prevTransition = thumbEl.style.transition;
        thumbEl.style.transition = 'none';
        thumbEl.style.transform = `translateX(${offsetLeft - 4}px)`;
        thumbEl.style.width = `${width}px`;
        void thumbEl.offsetWidth; // Force layout reflow
        thumbEl.style.transition = prevTransition;
      } else {
        thumbEl.style.transform = `translateX(${offsetLeft - 4}px)`;
        thumbEl.style.width = `${width}px`;
      }

      dockEl.scrollTo({
        left: offsetLeft - dockEl.clientWidth / 2 + width / 2,
        behavior: immediate ? 'instant' : 'smooth'
      });
    }

    const currentHash = pages[index]?.hash;
    if (currentHash && window.location.hash !== currentHash) {
      history.replaceState(null, '', currentHash);
    }
  }

  function goTo(pageId, behavior = 'smooth') {
    if (selectionState.active) exitSelectionMode();
    const idx = pages.findIndex(p => p.id === pageId);
    if (idx !== -1) {
      isProgrammatic = true;
      if (programmaticTimeout) clearTimeout(programmaticTimeout);

      if (thumbEl) thumbEl.style.transition = '';
      updateDockThumb(idx, behavior === 'instant');

      const pageEl = pagerEl.children[idx] || pagerEl.querySelector(`#page-${pageId}`) || pagerEl.querySelector(`#admin-panel-${pageId}`);
      const targetLeft = pageEl ? pageEl.offsetLeft : idx * pagerEl.clientWidth;
      pagerEl.scrollTo({
        left: targetLeft,
        behavior
      });

      programmaticTimeout = setTimeout(() => {
        isProgrammatic = false;
        if (thumbEl) thumbEl.style.transition = '';
      }, 420);
    }
  }

  dockItems.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const pageId = btn.dataset.page;
      goTo(pageId, 'smooth');
    };
  });

  // Touch Swipe Gesture Handlers
  function getTouchCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onTouchStart(e) {
    if (e.touches && e.touches.length > 1) return;
    if (e.target && e.target.closest && e.target.closest('#category-filter-chips, input, textarea, select')) {
      return;
    }

    const coords = getTouchCoords(e);
    startX = coords.x;
    startY = coords.y;
    currentX = coords.x;
    currentY = coords.y;
    startScrollLeft = pagerEl.scrollLeft;
    startTime = Date.now();
    isTracking = true;
    swipeDirection = null;
    isProgrammatic = false;
    if (programmaticTimeout) clearTimeout(programmaticTimeout);
  }

  function onTouchMove(e) {
    if (!isTracking) return;

    const coords = getTouchCoords(e);
    currentX = coords.x;
    currentY = coords.y;
    const dx = currentX - startX;
    const dy = currentY - startY;

    if (!swipeDirection) {
      if (Math.hypot(dx, dy) > 7) {
        if (Math.abs(dx) > Math.abs(dy)) {
          swipeDirection = 'horizontal';
          pagerEl.style.scrollSnapType = 'none';
          if (thumbEl) thumbEl.style.transition = 'none';
        } else {
          swipeDirection = 'vertical';
        }
      }
    }

    if (swipeDirection === 'horizontal') {
      if (e.cancelable) {
        e.preventDefault();
      }

      let effectiveDx = dx;
      const isAtFirst = activeIndex === 0 && dx > 0;
      const isAtLast = activeIndex === pages.length - 1 && dx < 0;
      if (isAtFirst || isAtLast) {
        effectiveDx = dx * 0.35;
      }

      pagerEl.scrollLeft = startScrollLeft - effectiveDx;

      const pageWidth = pagerEl.clientWidth || 1;
      const progress = pagerEl.scrollLeft / pageWidth;
      const clamped = Math.max(0, Math.min(pages.length - 1, progress));
      const baseIdx = Math.floor(clamped);
      const nextIdx = Math.min(pages.length - 1, baseIdx + 1);
      const ratio = clamped - baseIdx;

      if (thumbEl && dockItems[baseIdx] && dockItems[nextIdx]) {
        const btnA = dockItems[baseIdx];
        const btnB = dockItems[nextIdx];
        const xA = btnA.offsetLeft - 4;
        const xB = btnB.offsetLeft - 4;
        const wA = btnA.offsetWidth;
        const wB = btnB.offsetWidth;
        thumbEl.style.transform = `translateX(${xA + (xB - xA) * ratio}px)`;
        thumbEl.style.width = `${wA + (wB - wA) * ratio}px`;
      }

      const closestIdx = Math.round(clamped);
      if (closestIdx !== activeIndex && closestIdx >= 0 && closestIdx < pages.length) {
        activeIndex = closestIdx;
        dockItems.forEach((btn, i) => {
          btn.classList.toggle('active', i === closestIdx);
        });
      }
    }
  }

  function onTouchEnd(e) {
    if (!isTracking) return;
    isTracking = false;

    if (swipeDirection === 'horizontal') {
      pagerEl.style.scrollSnapType = '';
      if (thumbEl) thumbEl.style.transition = '';

      const coords = getTouchCoords(e);
      const dx = coords.x - startX;
      const dt = Math.max(1, Date.now() - startTime);
      const velocity = dx / dt;
      const pageWidth = pagerEl.clientWidth || 1;

      const isQuickFlick = dt < 320 && Math.abs(dx) > 30 && Math.abs(velocity) > 0.22;
      const isSignificantDistance = Math.abs(dx) > pageWidth * 0.16;

      let targetIdx = activeIndex;

      if ((isQuickFlick && velocity < 0) || (isSignificantDistance && dx < 0)) {
        targetIdx = Math.min(pages.length - 1, activeIndex + 1);
      } else if ((isQuickFlick && velocity > 0) || (isSignificantDistance && dx > 0)) {
        targetIdx = Math.max(0, activeIndex - 1);
      } else {
        targetIdx = Math.round((pagerEl.scrollLeft || 0) / pageWidth);
        targetIdx = Math.max(0, Math.min(pages.length - 1, targetIdx));
      }

      goTo(pages[targetIdx].id);
    } else {
      pagerEl.style.scrollSnapType = '';
    }

    swipeDirection = null;
  }

  // Pointer / Mouse Drag Fallback for Desktop
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('button, a, input, textarea, select, #category-filter-chips, .interactive')) {
      return;
    }

    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
    startScrollLeft = pagerEl.scrollLeft;
    startTime = Date.now();
    isPointerDragging = true;
    swipeDirection = null;
    isProgrammatic = false;
    if (programmaticTimeout) clearTimeout(programmaticTimeout);
  }

  function onPointerMove(e) {
    if (!isPointerDragging || e.pointerType === 'touch') return;
    currentX = e.clientX;
    currentY = e.clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    if (!swipeDirection) {
      if (Math.hypot(dx, dy) > 8) {
        if (Math.abs(dx) > Math.abs(dy)) {
          swipeDirection = 'horizontal';
          pagerEl.style.scrollSnapType = 'none';
          if (thumbEl) thumbEl.style.transition = 'none';
          pagerEl.style.cursor = 'grabbing';
          pagerEl.style.userSelect = 'none';
        } else {
          swipeDirection = 'vertical';
        }
      }
    }

    if (swipeDirection === 'horizontal') {
      pagerEl.scrollLeft = startScrollLeft - dx;

      const pageWidth = pagerEl.clientWidth || 1;
      const progress = pagerEl.scrollLeft / pageWidth;
      const clamped = Math.max(0, Math.min(pages.length - 1, progress));
      const baseIdx = Math.floor(clamped);
      const nextIdx = Math.min(pages.length - 1, baseIdx + 1);
      const ratio = clamped - baseIdx;

      if (thumbEl && dockItems[baseIdx] && dockItems[nextIdx]) {
        const btnA = dockItems[baseIdx];
        const btnB = dockItems[nextIdx];
        const xA = btnA.offsetLeft - 4;
        const xB = btnB.offsetLeft - 4;
        const wA = btnA.offsetWidth;
        const wB = btnB.offsetWidth;
        thumbEl.style.transform = `translateX(${xA + (xB - xA) * ratio}px)`;
        thumbEl.style.width = `${wA + (wB - wA) * ratio}px`;
      }
    }
  }

  function onPointerUp(e) {
    if (!isPointerDragging || e.pointerType === 'touch') return;
    isPointerDragging = false;
    pagerEl.style.cursor = '';
    pagerEl.style.userSelect = '';

    if (swipeDirection === 'horizontal') {
      pagerEl.style.scrollSnapType = '';
      if (thumbEl) thumbEl.style.transition = '';

      const dx = e.clientX - startX;
      const dt = Math.max(1, Date.now() - startTime);
      const velocity = dx / dt;
      const pageWidth = pagerEl.clientWidth || 1;

      let targetIdx = activeIndex;
      if ((dt < 300 && velocity < -0.22) || dx < -pageWidth * 0.16) {
        targetIdx = Math.min(pages.length - 1, activeIndex + 1);
      } else if ((dt < 300 && velocity > 0.22) || dx > pageWidth * 0.16) {
        targetIdx = Math.max(0, activeIndex - 1);
      } else {
        targetIdx = Math.round((pagerEl.scrollLeft || 0) / pageWidth);
        targetIdx = Math.max(0, Math.min(pages.length - 1, targetIdx));
      }

      goTo(pages[targetIdx].id);
    } else {
      pagerEl.style.scrollSnapType = '';
    }
    swipeDirection = null;
  }

  // Native scroll handler for trackpad gestures
  const onScroll = () => {
    if (isProgrammatic || isTracking || isPointerDragging) {
      if (isProgrammatic) {
        const targetLeft = activeIndex * (pagerEl.clientWidth || 1);
        if (Math.abs(pagerEl.scrollLeft - targetLeft) <= 2) {
          isProgrammatic = false;
        }
      }
      return;
    }

    const pageWidth = pagerEl.clientWidth || 1;
    const scrollLeft = pagerEl.scrollLeft;
    const progress = scrollLeft / pageWidth;
    const clampedProgress = Math.max(0, Math.min(pages.length - 1, progress));
    const baseIdx = Math.floor(clampedProgress);
    const nextIdx = Math.min(pages.length - 1, baseIdx + 1);
    const ratio = clampedProgress - baseIdx;

    if (thumbEl && dockItems[baseIdx] && dockItems[nextIdx]) {
      const btnA = dockItems[baseIdx];
      const btnB = dockItems[nextIdx];
      const xA = btnA.offsetLeft - 4;
      const xB = btnB.offsetLeft - 4;
      const wA = btnA.offsetWidth;
      const wB = btnB.offsetWidth;
      const curX = xA + (xB - xA) * ratio;
      const curW = wA + (wB - wA) * ratio;

      thumbEl.style.transition = 'none';
      thumbEl.style.transform = `translateX(${curX}px)`;
      thumbEl.style.width = `${curW}px`;
    }

    const closestIdx = Math.round(clampedProgress);
    if (closestIdx !== activeIndex && closestIdx >= 0 && closestIdx < pages.length) {
      activeIndex = closestIdx;
      dockItems.forEach((btn, i) => {
        btn.classList.toggle('active', i === closestIdx);
      });
    }

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!isProgrammatic && !isTracking && !isPointerDragging) {
        if (thumbEl) thumbEl.style.transition = '';
        const scrollLeft = pagerEl.scrollLeft;
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < pages.length; i++) {
          const pageEl = pagerEl.children[i];
          const pageLeft = pageEl ? pageEl.offsetLeft : i * pagerEl.clientWidth;
          const diff = Math.abs(scrollLeft - pageLeft);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        if (closestIdx !== activeIndex) {
          if (selectionState.active) exitSelectionMode();
          updateDockThumb(closestIdx, false);
        }
      }
    }, 80);
  };

  pagerEl.addEventListener('scroll', onScroll, { passive: true });

  const onScrollEnd = () => {
    if (!isTracking && !isPointerDragging) {
      isProgrammatic = false;
      if (thumbEl) thumbEl.style.transition = '';
      const scrollLeft = pagerEl.scrollLeft;
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pagerEl.children[i];
        const pageLeft = pageEl ? pageEl.offsetLeft : i * pagerEl.clientWidth;
        const diff = Math.abs(scrollLeft - pageLeft);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      if (closestIdx !== activeIndex) {
        if (selectionState.active) exitSelectionMode();
        updateDockThumb(closestIdx, false);
      }
    }
  };

  pagerEl.addEventListener('scrollend', onScrollEnd, { passive: true });

  pagerEl.addEventListener('touchstart', onTouchStart, { passive: true });
  pagerEl.addEventListener('touchmove', onTouchMove, { passive: false });
  pagerEl.addEventListener('touchend', onTouchEnd, { passive: true });
  pagerEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

  pagerEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  const onResize = () => {
    const activePageEl = pagerEl.children[activeIndex];
    if (activePageEl) {
      pagerEl.scrollTo({
        left: activePageEl.offsetLeft,
        behavior: 'instant'
      });
      updateDockThumb(activeIndex, true);
    }
  };
  window.addEventListener('resize', onResize);

  // Position immediately on boot before first paint to prevent flash
  const initialTargetEl = pagerEl.children[activeIndex];
  if (initialTargetEl) {
    pagerEl.scrollTo({
      left: initialTargetEl.offsetLeft,
      behavior: 'instant'
    });
  }
  updateDockThumb(activeIndex, true);

  requestAnimationFrame(() => {
    const el = pagerEl.children[activeIndex];
    if (el && Math.abs(pagerEl.scrollLeft - el.offsetLeft) > 2) {
      pagerEl.scrollTo({ left: el.offsetLeft, behavior: 'instant' });
      updateDockThumb(activeIndex, true);
    }
    setTimeout(() => {
      if (thumbEl) thumbEl.style.transition = '';
    }, 60);
  });

  return {
    goTo,
    getActive: () => pages[activeIndex]?.id || '',
    destroy: () => {
      pagerEl.removeEventListener('scroll', onScroll);
      pagerEl.removeEventListener('scrollend', onScrollEnd);
      pagerEl.removeEventListener('touchstart', onTouchStart);
      pagerEl.removeEventListener('touchmove', onTouchMove);
      pagerEl.removeEventListener('touchend', onTouchEnd);
      pagerEl.removeEventListener('touchcancel', onTouchEnd);
      pagerEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', onResize);
    }
  };
}

let userPagerInstance = null;
let adminPagerInstance = null;

export const PAGE_ORDER = [
  { id: 'notifications', label: 'Updates', hash: '#notifications', sectionId: 'page-notifications' },
  { id: 'tasks', label: 'Tasks', hash: '#tasks', sectionId: 'page-tasks' },
  { id: 'home', label: 'Home', hash: '#home', sectionId: 'page-home' },
  { id: 'attendance', label: 'Attendance', hash: '#attendance', sectionId: 'page-attendance' },
  { id: 'profile', label: 'Profile', hash: '#profile', sectionId: 'page-profile' }
];

function initNavigation() {
  const userPagerEl = document.getElementById('user-pager');
  const userDockEl = document.getElementById('user-dock');

  const userPages = PAGE_ORDER.map(p => ({ id: p.id, hash: p.hash }));

  if (userPagerEl && userDockEl) {
    userPagerInstance = createPager(userPagerEl, userDockEl, userPages, 'home');
  }

  const adminPagerEl = document.getElementById('admin-pager');
  const adminDockEl = document.getElementById('admin-dock');

  const adminPages = [
    { id: 'overview', hash: '#admin-overview' },
    { id: 'tasks', hash: '#admin-tasks' },
    { id: 'categories', hash: '#admin-categories' },
    { id: 'badges', hash: '#admin-badges' },
    { id: 'attendance', hash: '#admin-attendance' },
    { id: 'submissions', hash: '#admin-submissions' },
    { id: 'waivers', hash: '#admin-waivers' },
    { id: 'members', hash: '#admin-members' },
    { id: 'broadcasts', hash: '#admin-broadcasts' }
  ];

  if (adminPagerEl && adminDockEl) {
    adminPagerInstance = createPager(adminPagerEl, adminDockEl, adminPages, 'overview');
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    const userMatch = userPages.find(p => p.hash === hash);
    if (userMatch && userPagerInstance) {
      userPagerInstance.goTo(userMatch.id);
      return;
    }
    const adminMatch = adminPages.find(p => p.hash === hash);
    if (adminMatch) {
      if (state.user?.isAdmin || state.isAdminUnlocked) {
        showAdminDashboard(adminMatch.id);
      } else {
        openAdminPortal();
      }
    }
  });
}

/* ==========================================================================
   SIDE DRAWER CONTROLLER
   ========================================================================== */
export function updateDrawerPushUI() {
  const statusEl = document.getElementById('drawer-push-status');
  const switchContainer = document.getElementById('drawer-push-switch-container');
  if (!switchContainer) return;

  const supported = ('Notification' in window) && Boolean(isFCMSupported);
  const permission = supported ? Notification.permission : 'unsupported';
  const hasToken = Boolean(state.currentFcmToken || (state.userPrivate?.fcmTokens && state.userPrivate.fcmTokens.length > 0));
  const isPushActive = supported && permission === 'granted' && hasToken;

  if (statusEl) {
    if (!supported) statusEl.textContent = 'Not Supported';
    else if (permission === 'denied') statusEl.textContent = 'Blocked';
    else if (isPushActive) statusEl.textContent = 'On';
    else statusEl.textContent = 'Off';
  }

  switchContainer.innerHTML = '';
  switchContainer.appendChild(renderSwitch({
    id: 'drawer-push-switch',
    checked: isPushActive,
    disabled: !supported || permission === 'denied' || !state.user,
    onChange: async (checked) => {
      if (!state.user) {
        toast('Please sign in to enable push notifications', 'warning');
        updateDrawerPushUI();
        return;
      }
      if (checked) {
        await enablePushNotifications();
      } else {
        await disablePushNotifications();
      }
      updateDrawerPushUI();
    }
  }));
}

let isDrawerRendering = false;

export function updateDrawerProfile() {
  if (isDrawerRendering) return;
  isDrawerRendering = true;
  try {
    const userCard = document.getElementById('drawer-profile-card');
    const guestCard = document.getElementById('drawer-guest-card');
    const avatarEl = document.getElementById('drawer-profile-avatar');
    const nameEl = document.getElementById('drawer-profile-name');
    const emailEl = document.getElementById('drawer-profile-email');
    const roleEl = document.getElementById('drawer-profile-role');
    const signoutContainer = document.getElementById('drawer-signout-container');
    const adminBtn = document.getElementById('drawer-btn-admin');

    if (state.user) {
      if (guestCard) guestCard.classList.add('hidden');
      if (userCard) {
        userCard.classList.remove('hidden');
        const userDoc = usersMap.get(state.user.uid) || state.user;
        const displayName = userDoc.displayName || userDoc.name || state.user.displayName || 'Member';
        const email = state.userPrivate?.email || userDoc.email || state.user.email || 'Verified Member';
        const isAdmin = Boolean(userDoc.role === 'admin' || userDoc.isAdmin || state.user.isAdmin || state.isAdminUnlocked);

        if (avatarEl) avatarEl.innerHTML = renderAvatar(userDoc, 48);
        if (nameEl) nameEl.textContent = displayName;
        if (emailEl) emailEl.textContent = email;
        if (roleEl) {
          roleEl.textContent = isAdmin ? 'Admin' : 'Member';
          roleEl.className = isAdmin
            ? 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-neutral-300';
        }

        userCard.onclick = () => {
          closeDrawer();
          if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.goTo) {
            userPagerInstance.goTo('profile');
          }
        };
      }

      if (signoutContainer) signoutContainer.classList.remove('hidden');
      if (adminBtn) {
        const isAdmin = Boolean(state.user.isAdmin || state.user.role === 'admin' || state.isAdminUnlocked);
        adminBtn.classList.toggle('hidden', !isAdmin);
      }
    } else {
      if (userCard) userCard.classList.add('hidden');
      if (guestCard) guestCard.classList.remove('hidden');
      if (signoutContainer) signoutContainer.classList.add('hidden');
      if (adminBtn) adminBtn.classList.add('hidden');
    }

    updateDrawerPushUI();
  } catch (err) {
    console.error('[drawer] Error updating drawer profile:', err);
  } finally {
    isDrawerRendering = false;
  }
}

export function renderSettingsDrawer() {
  updateDrawerProfile();
}

export function openDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('drawer-open', 'is-open');
    backdrop.classList.add('drawer-open', 'is-open');
    updateDrawerProfile();
  }
}

export function closeDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('drawer-open', 'is-open');
    backdrop.classList.remove('drawer-open', 'is-open');
  }
}

export function toggleDrawer() {
  const drawer = document.getElementById('side-drawer');
  if (!drawer) return;
  if (drawer.classList.contains('drawer-open') || drawer.classList.contains('is-open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

/* ==========================================================================
   ADMIN DASHBOARD OVERLAY CONTROLLER
   ========================================================================== */
function openAdminPortal() {
  if (state.user?.isAdmin || state.isAdminUnlocked) {
    showAdminDashboard();
  } else {
    const modal = document.getElementById('modal-admin-auth');
    if (modal) {
      document.body.style.overflow = 'hidden';
      modal.classList.add('open');
      const input = document.getElementById('input-admin-password');
      if (input) input.focus();
    }
  }
}

export function showAdminDashboard(targetPage = 'overview') {
  const overlay = document.getElementById('modal-admin-dashboard');
  if (overlay) {
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const backBtn = document.getElementById('adminHubBackBtn') || document.getElementById('btn-exit-admin');
    if (backBtn) {
      backBtn.onclick = (e) => {
        e?.preventDefault?.();
        closeAdminDashboard();
      };
    }
    if (adminPagerInstance) {
      adminPagerInstance.goTo(targetPage);
    }
    // Re-attach admin-only listeners if authorized
    if (state.user?.isAdmin || state.isAdminUnlocked) {
      setupSubmissionsListeners();
      setupAttendanceListeners();
    }
    updateAdminOverviewStats();
  }
}

export function closeAdminDashboard() {
  if (selectionState.active) exitSelectionMode();
  const overlay = document.getElementById('modal-admin-dashboard');
  if (overlay) {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.currentPage) {
      userPagerInstance.goTo(userPagerInstance.currentPage);
    }
    // Clean up admin-only listeners on close to preserve bandwidth/reads
    listeners.clear('submissions');
    listeners.clear('attendance_logs');
    state.submissions = state.mySubmissions || [];
    state.attendanceLogs = state.myAttendanceLogs || [];
  }
}

let isFetchingOverviewStats = false;

async function updateAdminOverviewStats() {
  const tEl = document.getElementById('admin-overview-tasks');
  const mEl = document.getElementById('admin-overview-members');
  const sEl = document.getElementById('admin-overview-submissions');
  const pEl = document.getElementById('admin-overview-penalties');
  const sesEl = document.getElementById('admin-overview-sessions');

  // Optimistic initial values from memory
  if (tEl && !tEl.textContent) tEl.textContent = state.tasks.filter(t => t.active).length;
  if (mEl && !mEl.textContent) mEl.textContent = state.members.length;
  if (sEl && !sEl.textContent) sEl.textContent = state.submissions.length;
  if (sesEl && !sesEl.textContent) sesEl.textContent = state.attendanceSessions.length;

  if (isFetchingOverviewStats || !db) return;
  isFetchingOverviewStats = true;

  try {
    // 1. Members count: getCountFromServer(users)
    const membersSnapPromise = getCountFromServer(collection(db, 'users')).catch(() => null);

    // 2. Active tasks: getCountFromServer(query(tasks, where('active', '==', true)))
    const activeTasksQuery = query(collection(db, 'tasks'), where('active', '==', true));
    const activeTasksPromise = getCountFromServer(activeTasksQuery).catch(() => null);

    // 3. Submissions today: APP_TIMEZONE day start
    const now = serverNow();
    const todayDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    const [tY, tM, tD] = todayDateStr.split('-').map(Number);
    const todayMidnight = new Date(Date.UTC(tY, tM - 1, tD, 0, 0, 0));
    const todayStartTs = Timestamp.fromDate(todayMidnight);

    const todaySubsQuery = query(
      collection(db, 'submissions'),
      where('submittedAt', '>=', todayStartTs)
    );
    const todaySubsPromise = getCountFromServer(todaySubsQuery).catch(() => null);

    // 4. Penalties issued: getAggregateFromServer(attendance_logs, sum('penalty'))
    const penaltiesPromise = getAggregateFromServer(collection(db, 'attendance_logs'), {
      totalPenalty: sum('penalty')
    }).catch(() => null);

    const [membersSnap, activeTasksSnap, todaySubsSnap, penaltiesSnap] = await Promise.all([
      membersSnapPromise,
      activeTasksPromise,
      todaySubsPromise,
      penaltiesPromise
    ]);

    if (mEl && membersSnap) mEl.textContent = membersSnap.data().count;
    if (tEl && activeTasksSnap) tEl.textContent = activeTasksSnap.data().count;
    if (sEl && todaySubsSnap) sEl.textContent = todaySubsSnap.data().count;
    if (pEl && penaltiesSnap) {
      const pen = penaltiesSnap.data().totalPenalty || 0;
      pEl.textContent = `${pen} EGP`;
    }

    // 5. Render 7-day submissions bar chart
    renderSubmissionsTrendChart();
  } catch (err) {
    console.warn('Error fetching aggregate overview stats:', err);
  } finally {
    isFetchingOverviewStats = false;
  }
}

async function renderSubmissionsTrendChart() {
  const chartContainer = document.getElementById('admin-overview-chart');
  const totalCountEl = document.getElementById('admin-chart-total-count');
  if (!chartContainer) return;

  const now = serverNow();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
    const [y, m, day] = dateStr.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
    const end = new Date(start.getTime() + 86400000);
    const dayOfWeek = dayNames[start.getUTCDay()];
    daysData.push({
      dateStr,
      label: i === 0 ? 'Today' : dayOfWeek,
      startTs: Timestamp.fromDate(start),
      endTs: Timestamp.fromDate(end),
      count: 0
    });
  }

  try {
    const countPromises = daysData.map(async (dayObj) => {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('submittedAt', '>=', dayObj.startTs),
          where('submittedAt', '<', dayObj.endTs)
        );
        const snap = await getCountFromServer(q);
        return snap.data().count;
      } catch (e) {
        // Fallback to in-memory filter if network/index fails
        const sCount = state.submissions.filter(s => {
          if (!s.submittedAt) return false;
          const ts = s.submittedAt.seconds ? s.submittedAt.seconds * 1000 : new Date(s.submittedAt).getTime();
          return ts >= dayObj.startTs.toMillis() && ts < dayObj.endTs.toMillis();
        }).length;
        return sCount;
      }
    });

    const counts = await Promise.all(countPromises);
    counts.forEach((c, idx) => { daysData[idx].count = c; });
  } catch (err) {
    console.warn('Trend chart query error, using local data:', err);
    daysData.forEach(dayObj => {
      dayObj.count = state.submissions.filter(s => {
        if (!s.submittedAt) return false;
        const ts = s.submittedAt.seconds ? s.submittedAt.seconds * 1000 : new Date(s.submittedAt).getTime();
        return ts >= dayObj.startTs.toMillis() && ts < dayObj.endTs.toMillis();
      }).length;
    });
  }

  const total = daysData.reduce((acc, d) => acc + d.count, 0);
  if (totalCountEl) totalCountEl.textContent = `${total} this week`;

  const maxCount = Math.max(...daysData.map(d => d.count), 5);
  const chartHeight = 110;
  const chartWidth = 320;
  const barWidth = 28;
  const gap = (chartWidth - (barWidth * 7)) / 8;

  const svgBars = daysData.map((d, idx) => {
    const x = Math.round(gap + idx * (barWidth + gap));
    const h = Math.round((d.count / maxCount) * 75);
    const y = 85 - h;
    const isToday = idx === 6;
    const barColor = isToday ? '#0A84FF' : 'rgba(255, 255, 255, 0.25)';

    return `
      <g class="chart-col">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(h, 4)}" rx="6" fill="${barColor}" class="chart-bar-rect">
          <title>${d.label} (${d.dateStr}): ${d.count} submissions</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-family="monospace" font-weight="bold" fill="${isToday ? '#0A84FF' : '#A1A1AA'}">${d.count}</text>
        <text x="${x + barWidth / 2}" y="102" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="${isToday ? 'bold' : 'normal'}" fill="${isToday ? '#FFFFFF' : '#71717A'}">${d.label}</text>
      </g>
    `;
  }).join('');

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="w-full h-28 overflow-visible" aria-label="7-day submissions bar chart">
      <line x1="0" y1="85" x2="${chartWidth}" y2="85" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      ${svgBars}
    </svg>
  `;
}

/* ==========================================================================
   AUTH & USER DATA SPLIT CONTROLLER
   ========================================================================== */
let initialAuthResolved = false;

async function setupAuthLifecycle() {
  if (!auth) {
    console.warn('Auth module not loaded.');
    dismissLoader();
    return;
  }

  // Ensure browserLocalPersistence BEFORE any sign-in flow
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn('Local persistence setting failed:', err);
  }

  // Cold-start fail-safe: dismiss splash after 500ms so cached UI is immediately usable
  setTimeout(() => {
    if (!initialAuthResolved) {
      initialAuthResolved = true;
      dismissLoader();
    }
  }, 500);

  // Handle redirect result if user returned from signInWithRedirect
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      toast('Signed in via redirect!', 'success');
    }
  } catch (redirectErr) {
    console.warn('getRedirectResult check:', redirectErr);
    if (redirectErr.code === 'auth/unauthorized-domain') {
      showDomainModal();
    }
  }

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const privRef = doc(db, 'users_private', firebaseUser.uid);

      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          state.user = normalizeUser({ uid: firebaseUser.uid, ...userSnap.data() });
        } else {
          // New users ALWAYS initialize with role: "member", points: 0, penalties: 0
          const initialUser = {
            name: firebaseUser.displayName || 'Team Member',
            avatarUrl: firebaseUser.photoURL || '',
            role: 'member',
            points: 0,
            penalties: 0,
            lastOpId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await setDoc(userRef, initialUser);
          state.user = normalizeUser({ uid: firebaseUser.uid, ...initialUser });
        }

        // Split data: Manage users_private collection
        const privSnap = await getDoc(privRef).catch(() => null);
        if (!privSnap || !privSnap.exists()) {
          const initialPrivate = {
            email: firebaseUser.email || '',
            fcmTokens: []
          };
          await setDoc(privRef, initialPrivate).catch(console.warn);
          state.userPrivate = initialPrivate;
        } else {
          state.userPrivate = privSnap.data();
          // For existing users, copy email into users_private if missing
          if (!privSnap.data()?.email && firebaseUser.email) {
            await updateDoc(privRef, { email: firebaseUser.email }).catch(console.warn);
            state.userPrivate.email = firebaseUser.email;
          }
        }
      } catch (err) {
        console.warn('User profile sync:', err);
        state.user = normalizeUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Member',
          avatarUrl: firebaseUser.photoURL || ''
        });
      }

      if (state.user?.isAdmin) {
        state.isAdminUnlocked = true;
      }

      // Initialize server clock sync on login
      initServerClock();

      // Start authenticated Firestore listeners
      initFirestoreListeners();
    } else {
      state.user = null;
      state.userPrivate = null;
      state.isAdminUnlocked = false;
      listeners.clear(); // Unsubscribe all listeners on sign-out
      usersPrivate.clear();
      usersMap.clear();
      state.members = [];
      state.notifications = [];
      state.personalNotifications = [];
      state.broadcastNotificationsAll = [];
      state.broadcastNotificationsBadge = [];
    }

    updateProfileUI();
    updateUserTodayAttendanceBadge();
    checkAdminRoleUI();

    // RENDER UI ONLY AFTER FIRST onAuthStateChanged RESOLVES (branded splash until then)
    if (!initialAuthResolved) {
      initialAuthResolved = true;
      dismissLoader();
    }
  });
}

async function handleGoogleSignIn() {
  if (!auth || !googleProvider) {
    toast('Authentication unavailable', 'error');
    return;
  }

  // Ensure persistence before signing in
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn(e);
  }

  try {
    // Primary mode: signInWithPopup
    await signInWithPopup(auth, googleProvider);
    toast('Signed in successfully!', 'success');
    closeAllModals();
  } catch (err) {
    console.warn('Popup sign in failed, attempting redirect fallback:', err);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        if (redirectErr.code === 'auth/unauthorized-domain') {
          showDomainModal();
        } else {
          toast(redirectErr.message || 'Sign in failed', 'error');
        }
      }
    } else if (err.code === 'auth/unauthorized-domain') {
      showDomainModal();
    } else {
      toast(err.message || 'Google sign-in failed', 'error');
    }
  }
}

function showDomainModal() {
  const modal = document.getElementById('modal-unauthorized-domain');
  const hostLabel = document.getElementById('current-hostname-label');
  if (hostLabel) hostLabel.textContent = window.location.hostname;
  if (modal) {
    document.body.style.overflow = 'hidden';
    modal.classList.add('open');
  }
}

async function handleSignOut() {
  const confirmed = await confirmSheet({
    title: 'Sign Out',
    message: 'Are you sure you want to sign out and return to Guest Mode?',
    confirmLabel: 'Sign Out',
    destructive: true
  });

  if (confirmed && auth) {
    // Unsubscribe all active listeners before sign out to prevent permission errors
    listeners.clear();
    usersPrivate.clear();
    usersMap.clear();
    state.members = [];
    state.myWaiverRequests = [];
    state.waiverRequests = [];
    state.notifications = [];
    state.personalNotifications = [];
    state.broadcastNotificationsAll = [];
    state.broadcastNotificationsBadge = [];
    await signOut(auth);
    state.user = null;
    state.userPrivate = null;
    state.currentFcmToken = null;
    state.isAdminUnlocked = false;
    closeAllModals();
    updateProfileUI();
    checkAdminRoleUI();
    toast('Signed out successfully.', 'info');
  }
}

function checkAdminRoleUI() {
  const adminBtn = document.getElementById('drawer-btn-admin');
  if (adminBtn) {
    if (state.user?.isAdmin || state.isAdminUnlocked) {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }
}

function closeAllModals() {
  if (typeof modalStack !== 'undefined') modalStack.length = 0;
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.classList.remove('open');
  });
  document.body.style.overflow = '';
}

function setupSubmissionsListeners() {
  if (!db) return;
  if (!state.user) {
    listeners.clear('my_submissions');
    listeners.clear('submissions');
    state.mySubmissions = [];
    state.submissions = [];
    renderTasks();
    renderProfileSubmissions();
    return;
  }

  // 1. User's own live submissions: where uid == me, ordered by submittedAt desc, limit 200
  try {
    const qUserSubs = query(
      collection(db, 'submissions'),
      where('uid', '==', state.user.uid),
      orderBy('submittedAt', 'desc'),
      limit(200)
    );
    const unsubMySubs = onSnapshot(qUserSubs, (snapshot) => {
      state.mySubmissions = snapshot.docs.map(d => normalizeSubmission({ id: d.id, ...d.data() }));
      if (!state.user?.isAdmin) {
        state.submissions = state.mySubmissions;
      }
      renderTasks();
      renderProfileSubmissions();
      updateHeroStats();
    }, (err) => console.warn('User submissions listener:', err));
    listeners.add('my_submissions', unsubMySubs);
  } catch (e) { console.warn('Error setting up user submissions listener:', e); }

  // 2. Admin submissions listener (only if admin)
  if (state.user?.isAdmin || state.isAdminUnlocked) {
    try {
      listeners.clear('submissions');
      const qAllSubs = query(
        collection(db, 'submissions'),
        orderBy('submittedAt', 'desc'),
        limit(state.adminSubmissionsLimit || 50)
      );
      const unsubAllSubs = onSnapshot(qAllSubs, (snapshot) => {
        state.submissions = snapshot.docs.map(d => normalizeSubmission({ id: d.id, ...d.data() }));
        state.hasMoreSubmissions = snapshot.docs.length >= (state.adminSubmissionsLimit || 50);
        renderTasks();
        renderLeaderboard();
        renderAdminSubmissions();
        updateAdminOverviewStats();
      }, (err) => console.warn('Admin submissions listener:', err));
      listeners.add('submissions', unsubAllSubs);
    } catch (e) { console.warn('Error setting up admin submissions listener:', e); }
  }
}

function setupAttendanceListeners() {
  if (!db) return;
  if (!state.user) {
    listeners.clear('my_attendance_logs');
    listeners.clear('attendance_logs');
    state.myAttendanceLogs = [];
    state.attendanceLogs = [];
    renderAttendanceView();
    renderAttendanceLogs();
    renderProfileAttendance();
    updateUserTodayAttendanceBadge();
    return;
  }

  // 1. Current user's attendance logs: where uid == me, ordered by checkedInAt desc, limit 50
  try {
    const qMyLogs = query(
      collection(db, 'attendance_logs'),
      where('uid', '==', state.user.uid),
      orderBy('checkedInAt', 'desc'),
      limit(50)
    );
    const unsubMyLogs = onSnapshot(qMyLogs, (snapshot) => {
      state.myAttendanceLogs = snapshot.docs.map(d => normalizeAttendanceLog({ id: d.id, ...d.data() }));
      if (!state.user?.isAdmin && !state.isAdminUnlocked) {
        state.attendanceLogs = state.myAttendanceLogs;
      }
      renderAttendanceView();
      renderAttendanceLogs();
      renderProfileAttendance();
      updateUserTodayAttendanceBadge();
    }, (err) => {
      console.warn('My attendance logs listener:', err);
    });
    listeners.add('my_attendance_logs', unsubMyLogs);
  } catch (e) { console.warn('Error setting up my attendance logs listener:', e); }

  // 2. Admin attendance logs listener (only if admin)
  if (state.user?.isAdmin || state.isAdminUnlocked) {
    try {
      const qAllLogs = query(
        collection(db, 'attendance_logs'),
        orderBy('checkedInAt', 'desc'),
        limit(100)
      );
      const unsubAllLogs = onSnapshot(qAllLogs, (snapshot) => {
        state.attendanceLogs = snapshot.docs.map(d => normalizeAttendanceLog({ id: d.id, ...d.data() }));
        renderAdminAttendanceLogs();
        renderAttendanceLogs();
        updateUserTodayAttendanceBadge();
      }, (err) => console.warn('Admin attendance logs listener:', err));
      listeners.add('attendance_logs', unsubAllLogs);
    } catch (e) { console.warn('Error setting up admin attendance logs listener:', e); }
  }
}

function setupMembersListeners() {
  if (!db) return;
  try {
    listeners.clear('users');
    const qUsers = query(collection(db, 'users'), limit(500));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      usersMap.clear();
      snapshot.docs.forEach(d => {
        const u = normalizeUser({ uid: d.id, ...d.data() });
        usersMap.set(d.id, u);
      });
      state.members = Array.from(usersMap.values());
      state.hasMoreMembers = false;
      renderLeaderboard();
      renderAdminMembers();
      updateAdminOverviewStats();
      updateAdminPushTargets();
      renderTasks();
      renderAttendanceView();
      if (typeof renderAdminSubmissions === 'function') renderAdminSubmissions();
      if (state.user) {
        const found = usersMap.get(state.user.uid);
        if (found) {
          const prevRole = state.user.role;
          state.user = { ...state.user, ...found };
          if (found.isAdmin) state.isAdminUnlocked = true;
          updateProfileUI();
          if (prevRole !== found.role) {
            setupSubmissionsListeners();
            setupAttendanceListeners();
            setupNotificationsListener();
            setupUsersPrivateListener();
            setupWaiverRequestsListener();
          }
        }
      }
    }, (err) => console.warn('Users listener:', err));
    listeners.add('users', unsubUsers);
  } catch (e) { console.warn('Error setting up members listener:', e); }
}

/**
 * Initializes users_private real-time listeners (Task 5).
 * Regular members listen to their own users_private/{uid} document.
 * Admins listen to collection('users_private') limit(500) so email and finesEGP are always live.
 */

// ============================================================================
// DERIVED EGP BALANCE CACHE & HELPERS (TASK 6)
// Balance = users_private.finesEGP (admin adjustments) + sum(attendance_logs.fineEGP)
// ============================================================================
const egpAggregateCache = new Map(); // uid -> { fineSum, timestamp }

function invalidateEgpCache(uid) {
  if (uid) {
    egpAggregateCache.delete(uid);
  } else {
    egpAggregateCache.clear();
  }
}

async function getMemberDerivedEgpBalance(uid, forceRefresh = false) {
  if (!uid || !db) return 0;
  const privDoc = usersPrivate.get(uid);
  const adminAdj = (privDoc && typeof privDoc.finesEGP === 'number') ? privDoc.finesEGP : 0;

  let cached = egpAggregateCache.get(uid);
  if (forceRefresh || !cached || (Date.now() - cached.timestamp > 30000)) {
    try {
      const aggSnap = await getAggregateFromServer(
        query(collection(db, 'attendance_logs'), where('uid', '==', uid)),
        { total: sum('fineEGP') }
      );
      const fineSum = Number(aggSnap?.data()?.total) || 0;
      cached = { fineSum, timestamp: Date.now() };
      egpAggregateCache.set(uid, cached);
    } catch (err) {
      console.warn('Failed to fetch attendance fine aggregate for', uid, err);
      cached = cached || { fineSum: 0, timestamp: Date.now() };
    }
  }
  return adminAdj + (cached?.fineSum || 0);
}

function setupUsersPrivateListener() {
  if (!db || !state.user?.uid) {
    listeners.clear('users_private');
    usersPrivate.clear();
    return;
  }

  const uid = state.user.uid;
  const isAdmin = Boolean(
    state.user.isAdmin || 
    state.user.role === 'admin' || 
    usersMap.get(uid)?.isAdmin || 
    usersMap.get(uid)?.role === 'admin'
  );

  listeners.clear('users_private');

  if (isAdmin) {
    try {
      const q = query(collection(db, 'users_private'), limit(500));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(d => {
          const data = d.data() || {};
          usersPrivate.set(d.id, {
            email: data.email || '',
            finesEGP: typeof data.finesEGP === 'number' ? data.finesEGP : 0,
            ...data
          });
        });
        if (state.user?.uid && usersPrivate.has(state.user.uid)) {
          state.userPrivate = usersPrivate.get(state.user.uid);
        }
        if (typeof renderAdminMembers === 'function') renderAdminMembers();
        if (typeof updateProfileUI === 'function') updateProfileUI();
        if (typeof updateActivityRings === 'function') updateActivityRings();
        if (typeof updateAdminPushTargets === 'function') updateAdminPushTargets();
      }, (err) => {
        console.warn('Admin users_private listener:', err);
      });
      listeners.add('users_private', unsub);
    } catch (e) {
      console.warn('Error setting up admin users_private listener:', e);
    }
  } else {
    try {
      const ref = doc(db, 'users_private', uid);
      const unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data() || {};
          const priv = {
            email: data.email || state.user.email || '',
            finesEGP: typeof data.finesEGP === 'number' ? data.finesEGP : 0,
            ...data
          };
          usersPrivate.set(uid, priv);
          state.userPrivate = priv;
        } else {
          const priv = {
            email: state.user.email || '',
            finesEGP: 0
          };
          usersPrivate.set(uid, priv);
          state.userPrivate = priv;
        }
        if (typeof updateProfileUI === 'function') updateProfileUI();
        if (typeof updateActivityRings === 'function') updateActivityRings();
      }, (err) => {
        console.warn('Member users_private listener:', err);
      });
      listeners.add('users_private', unsub);
    } catch (e) {
      console.warn('Error setting up member users_private listener:', e);
    }
  }
}

/**
 * Initializes waiver_requests real-time listeners (Task 6).
 * Regular members listen to their own waiver requests.
 * Admins listen to all waiver requests to approve/reject excuses.
 */
function setupWaiverRequestsListener() {
  if (!db || !state.user?.uid) {
    listeners.clear('my_waiver_requests');
    listeners.clear('waiver_requests');
    state.myWaiverRequests = [];
    state.waiverRequests = [];
    return;
  }

  const isAdmin = Boolean(
    state.user.isAdmin || 
    state.user.role === 'admin' || 
    state.isAdminUnlocked ||
    usersMap.get(state.user.uid)?.isAdmin || 
    usersMap.get(state.user.uid)?.role === 'admin'
  );

  listeners.clear('my_waiver_requests');
  listeners.clear('waiver_requests');

  // 1. My waiver requests
  try {
    const qMy = query(
      collection(db, 'waiver_requests'),
      where('uid', '==', state.user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubMy = onSnapshot(qMy, (snapshot) => {
      state.myWaiverRequests = snapshot.docs.map(d => normalizeWaiverRequest({ id: d.id, ...d.data() }));
      renderAttendanceView();
    }, (err) => console.warn('My waiver requests listener:', err));
    listeners.add('my_waiver_requests', unsubMy);
  } catch (e) { console.warn('Error setting up my waiver requests listener:', e); }

  // 2. Admin all waiver requests
  if (isAdmin) {
    try {
      const qAll = query(
        collection(db, 'waiver_requests'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const unsubAll = onSnapshot(qAll, (snapshot) => {
        state.waiverRequests = snapshot.docs.map(d => normalizeWaiverRequest({ id: d.id, ...d.data() }));
        const pendingCount = state.waiverRequests.filter(w => w.status === 'pending').length;
        updateWaiversBadge(pendingCount);
        if (typeof renderAdminWaivers === 'function') renderAdminWaivers();
      }, (err) => console.warn('Admin waiver requests listener:', err));
      listeners.add('waiver_requests', unsubAll);
    } catch (e) { console.warn('Error setting up admin waiver requests listener:', e); }
  }
}

function mergeAndRenderNotifications() {
  const personal = state.personalNotifications || [];
  const bAll = state.broadcastNotificationsAll || [];
  const bBadge = state.broadcastNotificationsBadge || [];

  const combinedMap = new Map();

  personal.forEach(n => {
    combinedMap.set(n.id, {
      ...n,
      isBroadcast: false,
      read: Boolean(n.read)
    });
  });

  [...bAll, ...bBadge].forEach(n => {
    const isRead = Array.isArray(n.readBy) && n.readBy.includes(state.user?.uid);
    combinedMap.set(n.id, {
      ...n,
      isBroadcast: true,
      read: isRead
    });
  });

  const combined = Array.from(combinedMap.values()).sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || a.timestamp || 0).getTime());
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || b.timestamp || 0).getTime());
    return timeB - timeA;
  });

  state.notifications = combined;
  updateNotificationBadges();
  renderNotifications();
}


export function showLiveNotificationToast({ title, message, icon = 'bell', onClick = null } = {}) {
  const toastEl = document.getElementById('live-notification-toast');
  if (!toastEl) return;

  const iconEl = document.getElementById('live-toast-icon');
  const titleEl = document.getElementById('live-toast-title');
  const bodyEl = document.getElementById('live-toast-body');
  const closeBtn = document.getElementById('btn-close-live-toast');

  if (iconEl) iconEl.innerHTML = getIconSvg(icon || 'bell', 'w-5 h-5');
  if (titleEl) titleEl.textContent = title || 'Announcement';
  if (bodyEl) bodyEl.textContent = message || '';

  toastEl.classList.remove('hidden');
  requestAnimationFrame(() => {
    toastEl.classList.remove('-translate-y-12', 'opacity-0');
    toastEl.classList.add('translate-y-0', 'opacity-100');
  });

  let dismissTimer = setTimeout(dismiss, 5000);

  function dismiss() {
    clearTimeout(dismissTimer);
    toastEl.classList.remove('translate-y-0', 'opacity-100');
    toastEl.classList.add('-translate-y-12', 'opacity-0');
    setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 300);
  }

  toastEl.onclick = (e) => {
    if (e.target.closest('#btn-close-live-toast')) {
      e.stopPropagation();
      dismiss();
      return;
    }
    dismiss();
    if (typeof onClick === 'function') {
      onClick();
    } else {
      window.location.hash = '#notifications';
    }
  };

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismiss();
    };
  }
}

let isPersonalInitialLoad = true;
let isBroadcastAllInitialLoad = true;
let isBroadcastBadgeInitialLoad = true;

function setupNotificationsListener() {
  if (!db) return;
  if (!state.user) {
    listeners.clear('notifications_personal');
    listeners.clear('notifications_broadcast_all');
    listeners.clear('notifications_broadcast_badge');
    state.notifications = [];
    state.personalNotifications = [];
    state.broadcastNotificationsAll = [];
    state.broadcastNotificationsBadge = [];
    isPersonalInitialLoad = true;
    isBroadcastAllInitialLoad = true;
    isBroadcastBadgeInitialLoad = true;
    renderNotifications();
    updateNotificationBadges();
    return;
  }

  // 1. Personal Notifications
  try {
    listeners.clear('notifications_personal');
    const qPersonal = query(
      collection(db, 'notifications'),
      where('uid', '==', state.user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      if (!isPersonalInitialLoad) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            showLiveNotificationToast({
              title: data.title || 'Personal Notification',
              message: data.message || data.body || '',
              icon: data.icon || 'bell'
            });
          }
        });
      }
      isPersonalInitialLoad = false;
      state.personalNotifications = snapshot.docs.map(d => normalizeNotification({ id: d.id, ...d.data() }));
      mergeAndRenderNotifications();
    }, (err) => console.warn('Personal notifications listener:', err));
    listeners.add('notifications_personal', unsubPersonal);
  } catch (e) {
    console.warn('Personal notifications listener error:', e);
  }

  // 2. Broadcast Notifications: targetType == "all"
  try {
    listeners.clear('notifications_broadcast_all');
    const qBroadcastAll = query(
      collection(db, 'notifications_broadcast'),
      where('targetType', '==', 'all'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubBroadcastAll = onSnapshot(qBroadcastAll, (snapshot) => {
      if (!isBroadcastAllInitialLoad) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (!data.readBy || !data.readBy.includes(state.user?.uid)) {
              showLiveNotificationToast({
                title: data.title || 'Team Broadcast',
                message: data.message || data.body || '',
                icon: data.icon || 'megaphone'
              });
            }
          }
        });
      }
      isBroadcastAllInitialLoad = false;
      state.broadcastNotificationsAll = snapshot.docs.map(d => normalizeNotification({ id: d.id, ...d.data() })).filter(b => b.archived !== true);
      mergeAndRenderNotifications();
    }, (err) => console.warn('Broadcast "all" notifications listener:', err));
    listeners.add('notifications_broadcast_all', unsubBroadcastAll);
  } catch (e) {
    console.warn('Broadcast all notifications listener error:', e);
  }

  // 3. Broadcast Notifications: targetType == "badge"
  const userBadges = Array.isArray(state.user?.badgeIds) ? state.user.badgeIds.slice(0, 10) : [];
  if (userBadges.length > 0) {
    try {
      listeners.clear('notifications_broadcast_badge');
      const qBroadcastBadge = query(
        collection(db, 'notifications_broadcast'),
        where('targetType', '==', 'badge'),
        where('badgeId', 'in', userBadges),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const unsubBroadcastBadge = onSnapshot(qBroadcastBadge, (snapshot) => {
        if (!isBroadcastBadgeInitialLoad) {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (!data.readBy || !data.readBy.includes(state.user?.uid)) {
                showLiveNotificationToast({
                  title: data.title || 'Badge Announcement',
                  message: data.message || data.body || '',
                  icon: data.icon || 'star'
                });
              }
            }
          });
        }
        isBroadcastBadgeInitialLoad = false;
        state.broadcastNotificationsBadge = snapshot.docs.map(d => normalizeNotification({ id: d.id, ...d.data() })).filter(b => b.archived !== true);
        mergeAndRenderNotifications();
      }, (err) => console.warn('Broadcast badge notifications listener:', err));
      listeners.add('notifications_broadcast_badge', unsubBroadcastBadge);
    } catch (e) {
      console.warn('Broadcast badge notifications listener error:', e);
    }
  }
}

function setupBroadcastsListener() {
  if (!db) return;
  try {
    listeners.clear('broadcasts');
    const qBroadcasts = query(
      collection(db, 'broadcasts'),
      orderBy('endDateTime', 'desc'),
      limit(30)
    );
    const unsubBroadcasts = onSnapshot(qBroadcasts, (snapshot) => {
      state.broadcasts = snapshot.docs.map(d => normalizeBroadcast({ id: d.id, ...d.data() }));
      renderHomeBroadcastBanner();
      renderAdminBroadcasts();
    }, (err) => console.warn('Broadcasts listener:', err));
    listeners.add('broadcasts', unsubBroadcasts);
  } catch (e) {
    console.warn('Error setting up broadcasts listener:', e);
  }
}

/* ==========================================================================
   FIREBASE CLOUD MESSAGING (CLIENT-SIDE PUSH PIPELINE)
   ========================================================================== */
const FCM_VAPID_KEY = 'BHAllHVmcFAqchvINO9TY95yyGoeYKQ9aDgD31hhYXpI3jkG4CPOVsxU7mi0OQzGUZcKYx3l_FTGvpWEMcEz4yY';
const FCM_SW_SCOPE = './firebase-cloud-messaging-push-scope';
let messaging = null;
let fcmRegistration = null;
let isFCMSupported = false;

async function initFCM() {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported || !('serviceWorker' in navigator)) {
      isFCMSupported = false;
      updatePushNotificationUI();
      return;
    }

    isFCMSupported = true;
    messaging = getMessaging(app);

    // Register dedicated SW for FCM with scope ./firebase-cloud-messaging-push-scope
    try {
      fcmRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
        scope: FCM_SW_SCOPE
      });
    } catch (swErr) {
      console.warn('Could not register FCM Service Worker:', swErr);
    }

    // Foreground listener: in-app toast & refresh badge (no duplicate system notification)
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Team Update';
      const body = payload.notification?.body || payload.data?.body || '';
      toast(`${title}: ${body}`, 'info');
      updateNotificationBadges();
    });

    updatePushNotificationUI();
  } catch (err) {
    console.warn('initFCM error:', err);
    updatePushNotificationUI();
  }
}

function updatePushNotificationUI() {
  const badgeEl = document.getElementById('push-status-badge');
  const descEl = document.getElementById('push-status-desc');
  const btnEl = document.getElementById('btn-toggle-push');
  const btnLabelEl = document.getElementById('btn-toggle-push-label');
  const iosNoteEl = document.getElementById('push-ios-note');

  // iOS check: iOS 16.4+ requires Web App added to Home Screen
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (iosNoteEl) {
    if (isIOS) iosNoteEl.classList.remove('hidden');
    else iosNoteEl.classList.add('hidden');
  }

  if (!badgeEl || !btnEl || !btnLabelEl) return;

  if (!('Notification' in window) || !isFCMSupported) {
    badgeEl.textContent = 'Not supported';
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-white/10 text-neutral-400';
    btnEl.disabled = true;
    btnEl.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold text-neutral-400 bg-white/5 cursor-not-allowed flex items-center justify-center gap-1.5';
    btnLabelEl.textContent = 'Push Not Supported';
    if (descEl) descEl.textContent = 'Push notifications are not supported on this device/browser.';
    return;
  }

  const permission = Notification.permission;

  if (permission === 'denied') {
    badgeEl.textContent = 'Blocked';
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
    btnEl.disabled = true;
    btnEl.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold text-neutral-400 bg-white/5 cursor-not-allowed flex items-center justify-center gap-1.5';
    btnLabelEl.textContent = 'Notifications Blocked';
    if (descEl) descEl.textContent = 'Notifications are blocked in your browser site settings.';
    return;
  }

  // Check if active user has an FCM token stored
  const hasToken = Boolean(state.currentFcmToken || (state.userPrivate?.fcmTokens && state.userPrivate.fcmTokens.length > 0));

  if (permission === 'granted' && hasToken) {
    badgeEl.textContent = 'On';
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    btnEl.disabled = false;
    btnEl.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 transition shadow-sm flex items-center justify-center gap-1.5';
    btnLabelEl.textContent = 'Disable Notifications';
    if (descEl) descEl.textContent = 'Push notifications are active on this device.';
  } else {
    badgeEl.textContent = 'Off';
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-white/10 text-neutral-300';
    btnEl.disabled = false;
    btnEl.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-[#0A84FF] hover:bg-[#0A84FF]/90 transition shadow-sm flex items-center justify-center gap-1.5';
    btnLabelEl.textContent = 'Enable Notifications';
    if (descEl) descEl.textContent = 'Receive instant task alerts and team updates.';
  }
}

async function handleTogglePushNotifications() {
  if (!state.user) {
    toast('Please sign in to configure push notifications', 'warning');
    return;
  }

  const hasToken = Boolean(state.currentFcmToken || (state.userPrivate?.fcmTokens && state.userPrivate.fcmTokens.length > 0));
  if (Notification.permission === 'granted' && hasToken) {
    await disablePushNotifications();
  } else {
    await enablePushNotifications();
  }
}

async function enablePushNotifications() {
  if (!state.user) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast('Notification permission was ' + permission, 'warning');
      updatePushNotificationUI();
      return;
    }

    if (!messaging || !fcmRegistration) {
      fcmRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
        scope: FCM_SW_SCOPE
      });
      messaging = getMessaging(app);
    }

    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: fcmRegistration
    });

    if (token) {
      state.currentFcmToken = token;
      const privRef = doc(db, 'users_private', state.user.uid);
      await setDoc(privRef, {
        email: state.userPrivate?.email || state.user?.email || '',
        fcmTokens: arrayUnion(token)
      }, { merge: true });

      if (!state.userPrivate) state.userPrivate = {};
      if (!state.userPrivate.fcmTokens) state.userPrivate.fcmTokens = [];
      if (!state.userPrivate.fcmTokens.includes(token)) {
        state.userPrivate.fcmTokens.push(token);
      }

      toast('Push notifications enabled!', 'success');
    } else {
      toast('Could not retrieve push token', 'warning');
    }
    updatePushNotificationUI();
  } catch (err) {
    console.error('enablePushNotifications error:', err);
    toast('Failed to enable push: ' + (err.message || err), 'error');
    updatePushNotificationUI();
  }
}

async function disablePushNotifications() {
  if (!state.user) return;
  try {
    const tokenToRemove = state.currentFcmToken || state.userPrivate?.fcmTokens?.[0];
    if (tokenToRemove) {
      const privRef = doc(db, 'users_private', state.user.uid);
      await updateDoc(privRef, {
        fcmTokens: arrayRemove(tokenToRemove)
      }).catch(() => {});
    }

    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }

    state.currentFcmToken = null;
    if (state.userPrivate?.fcmTokens) {
      state.userPrivate.fcmTokens = [];
    }

    toast('Push notifications disabled', 'info');
    updatePushNotificationUI();
  } catch (err) {
    console.error('disablePushNotifications error:', err);
    toast('Failed to disable push: ' + (err.message || err), 'error');
    updatePushNotificationUI();
  }
}

/* ==========================================================================
   ADMIN PUSH SENDER CONSOLE
   ========================================================================== */
export function initAdminPushConsole() {
  const form = document.getElementById('form-admin-send-push');
  if (!form) return;

  // Ensure hidden inputs exist
  let targetInput = document.getElementById('select-push-target');
  if (!targetInput) {
    targetInput = document.createElement('input');
    targetInput.type = 'hidden';
    targetInput.id = 'select-push-target';
    targetInput.value = 'all';
    form.appendChild(targetInput);
  }

  let routeInput = document.getElementById('select-push-route');
  if (!routeInput) {
    routeInput = document.createElement('input');
    routeInput.type = 'hidden';
    routeInput.id = 'select-push-route';
    routeInput.value = '';
    form.appendChild(routeInput);
  }

  let itemIdInput = document.getElementById('input-push-item-id');
  if (!itemIdInput) {
    itemIdInput = document.createElement('input');
    itemIdInput.type = 'hidden';
    itemIdInput.id = 'input-push-item-id';
    itemIdInput.value = '';
    form.appendChild(itemIdInput);
  }

  // 1. Audience Segmented Control
  const audienceContainer = document.getElementById('push-audience-segmented-container');
  const detailsContainer = document.getElementById('push-audience-details-container');
  if (audienceContainer && detailsContainer && !audienceContainer.dataset.initialized) {
    audienceContainer.dataset.initialized = 'true';
    renderSegmented(audienceContainer, {
      options: [
        { value: 'all', label: 'All Team' },
        { value: 'badge', label: 'By Badge' },
        { value: 'member', label: 'Member' }
      ],
      value: targetInput.value?.startsWith('badge:') ? 'badge' : (targetInput.value && targetInput.value !== 'all' ? 'member' : 'all'),
      onChange: (val) => {
        if (val === 'all') {
          targetInput.value = 'all';
          detailsContainer.innerHTML = `
            <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div class="text-[11px] text-neutral-300">Broadcasts to all team members</div>
            </div>
          `;
        } else if (val === 'badge') {
          const defaultBadge = (state.badges && state.badges[0]) || (typeof PRESET_BADGES !== 'undefined' && PRESET_BADGES[0]) || { id: 'media', label: 'Media Team' };
          targetInput.value = 'badge:' + defaultBadge.id;
          detailsContainer.innerHTML = `
            <button type="button" id="btn-push-pick-badge" class="w-full glass-card p-2.5 rounded-xl flex items-center justify-between hover:border-white/25 transition text-left">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${defaultBadge.color || '#0A84FF'}"></span>
                <span id="push-selected-badge-label" class="text-xs font-semibold text-white">${esc(defaultBadge.label || defaultBadge.id)}</span>
              </div>
              <span class="text-[10px] text-neutral-400 px-2 py-0.5 rounded-full bg-white/10">Choose</span>
            </button>
          `;
          const pickBadgeBtn = detailsContainer.querySelector('#btn-push-pick-badge');
          if (pickBadgeBtn) {
            pickBadgeBtn.onclick = () => {
              openBadgePickerSheet({
                onSelect: (b) => {
                  targetInput.value = 'badge:' + b.id;
                  const lbl = detailsContainer.querySelector('#push-selected-badge-label');
                  if (lbl) lbl.textContent = b.label || b.id;
                }
              });
            };
          }
        } else if (val === 'member') {
          const firstMember = (state.members && state.members[0]) || (state.user) || { uid: 'all', name: 'Member' };
          targetInput.value = firstMember.uid;
          detailsContainer.innerHTML = `
            <button type="button" id="btn-push-pick-member" class="w-full glass-card p-2.5 rounded-xl flex items-center justify-between hover:border-white/25 transition text-left">
              <div class="flex items-center gap-2 min-w-0">
                <div id="push-selected-member-avatar" class="shrink-0">${renderAvatar(firstMember, 'w-6 h-6')}</div>
                <span id="push-selected-member-name" class="text-xs font-semibold text-white truncate">${esc(firstMember.displayName || firstMember.name || 'Select Member')}</span>
              </div>
              <span class="text-[10px] text-neutral-400 px-2 py-0.5 rounded-full bg-white/10 shrink-0">Choose</span>
            </button>
          `;
          const pickMemberBtn = detailsContainer.querySelector('#btn-push-pick-member');
          if (pickMemberBtn) {
            pickMemberBtn.onclick = () => {
              openMemberPicker({
                multi: false,
                includeAllOption: false,
                selectedUids: [targetInput.value],
                onConfirm: (selected) => {
                  const uid = selected[0];
                  if (!uid) return;
                  targetInput.value = uid;
                  const mem = getUserProfile(uid);
                  const nameEl = detailsContainer.querySelector('#push-selected-member-name');
                  const avEl = detailsContainer.querySelector('#push-selected-member-avatar');
                  if (nameEl) nameEl.textContent = mem.displayName || mem.name || 'Member';
                  if (avEl) avEl.innerHTML = renderAvatar(mem, 'w-6 h-6');
                }
              });
            };
          }
        }
      }
    });
    // Initial display
    detailsContainer.innerHTML = `
      <div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center shrink-0">
          <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <div class="text-[11px] text-neutral-300">Broadcasts to all team members</div>
      </div>
    `;
  }

  // 2. Category Picker Button
  const catBtn = document.getElementById('btn-push-category-picker');
  const catInput = document.getElementById('input-push-type') || document.getElementById('select-push-type');
  const catLabel = document.getElementById('push-category-label');
  if (catBtn && !catBtn.dataset.bound) {
    catBtn.dataset.bound = 'true';
    const categories = [
      { id: 'system', label: 'System / Notice', sub: 'General announcements and system alerts' },
      { id: 'task', label: 'Task Update', sub: 'New or updated assignments' },
      { id: 'attendance', label: 'Attendance Alert', sub: 'Session reminders and check-in calls' },
      { id: 'announcement', label: 'Important Notice', sub: 'High-visibility updates' },
      { id: 'reminder', label: 'Reminder', sub: 'Deadlines and upcoming events' }
    ];
    catBtn.onclick = () => {
      openItemPicker({
        title: 'Select Notification Category',
        items: categories,
        selectedId: catInput?.value || 'system',
        onSelect: (item) => {
          if (catInput) catInput.value = item.id;
          if (catLabel) catLabel.textContent = item.label;
        }
      });
    };
  }

  // 3. Deep Link Action Picker Button
  const actionBtn = document.getElementById('btn-push-action-picker');
  const actionLabel = document.getElementById('push-action-label');
  const subPickerContainer = document.getElementById('push-sub-picker-container');
  const subPickerBtn = document.getElementById('btn-push-subitem-picker');
  const subPickerLabel = document.getElementById('push-subitem-label');

  if (actionBtn && !actionBtn.dataset.bound) {
    actionBtn.dataset.bound = 'true';
    const actions = [
      { id: '', label: 'None (Default Feed)' },
      { id: 'tasks', label: 'Tasks Tab' },
      { id: 'task_detail', label: 'Specific Task...' },
      { id: 'attendance', label: 'Attendance Tab' },
      { id: 'attendance_session', label: 'Specific Attendance Session...' },
      { id: 'profile', label: 'Profile Tab' },
      { id: 'leaderboard', label: 'Leaderboard Tab' }
    ];

    actionBtn.onclick = () => {
      openItemPicker({
        title: 'Open When Tapped',
        items: actions,
        selectedId: routeInput?.value || '',
        onSelect: (act) => {
          if (act.id === 'task_detail') {
            routeInput.value = 'task_detail';
            if (actionLabel) actionLabel.textContent = 'Specific Task...';
            if (subPickerContainer) subPickerContainer.classList.remove('hidden');
          } else if (act.id === 'attendance_session') {
            routeInput.value = 'attendance_session';
            if (actionLabel) actionLabel.textContent = 'Specific Session...';
            if (subPickerContainer) subPickerContainer.classList.remove('hidden');
          } else {
            routeInput.value = act.id;
            itemIdInput.value = '';
            if (actionLabel) actionLabel.textContent = act.label;
            if (subPickerContainer) subPickerContainer.classList.add('hidden');
          }
        }
      });
    };

    if (subPickerBtn && !subPickerBtn.dataset.bound) {
      subPickerBtn.dataset.bound = 'true';
      subPickerBtn.onclick = () => {
        const curRoute = routeInput?.value;
        if (curRoute === 'task_detail') {
          const taskItems = (state.tasks || []).map(t => ({ id: t.id, label: t.title, sub: `${t.points} pts` }));
          openItemPicker({
            title: 'Select Target Task',
            items: taskItems,
            selectedId: itemIdInput?.value || '',
            onSelect: (item) => {
              itemIdInput.value = item.id;
              if (subPickerLabel) subPickerLabel.textContent = item.label;
            }
          });
        } else if (curRoute === 'attendance_session') {
          const sessItems = (state.attendanceSessions || []).map(s => ({ id: s.id, label: s.title || 'Session', sub: s.type || 'General' }));
          openItemPicker({
            title: 'Select Target Session',
            items: sessItems,
            selectedId: itemIdInput?.value || '',
            onSelect: (item) => {
              itemIdInput.value = item.id;
              if (subPickerLabel) subPickerLabel.textContent = item.label;
            }
          });
        }
      };
    }
  }

  // Ensure icon preview is initialized
  const iconInput = document.getElementById('input-push-icon');
  const iconPreview = document.getElementById('push-icon-preview');
  const iconLabel = document.getElementById('push-icon-label');
  const curIcon = iconInput?.value || 'bell';
  if (iconPreview && !iconPreview.hasChildNodes()) {
    iconPreview.innerHTML = getIconSvg(curIcon, 'w-4 h-4 stroke-current');
  }
  if (iconLabel) iconLabel.textContent = curIcon;
}

export function updateAdminPushTargets() {
  const hiddenInput = document.getElementById('select-push-target');
  const currentVal = hiddenInput?.value || 'all';
  updatePushTargetPickerDisplay(currentVal);
}

export function updatePushTargetPickerDisplay(val = 'all') {
  const nameEl = document.getElementById('picker-push-target-name');
  const subEl = document.getElementById('picker-push-target-sub');
  const avatarContainer = document.getElementById('picker-push-target-avatar-container');
  const hiddenInput = document.getElementById('select-push-target');
  if (hiddenInput) hiddenInput.value = val;

  if (nameEl) {
    if (val === 'all') {
      nameEl.textContent = 'All Team Members';
      if (subEl) subEl.textContent = 'Broadcast to everyone';
      if (avatarContainer) {
        avatarContainer.className = 'w-8 h-8 rounded-full bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center flex-shrink-0';
        avatarContainer.innerHTML = '<svg class="w-4 h-4 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
      }
    } else if (val.startsWith('badge:')) {
      const bId = val.replace('badge:', '');
      nameEl.textContent = 'Badge Group: ' + bId;
      if (subEl) subEl.textContent = 'Broadcast to badge members';
      if (avatarContainer) {
        avatarContainer.className = 'w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0';
        avatarContainer.innerHTML = '<svg class="w-4 h-4 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
      }
    } else {
      const member = getUserProfile(val);
      nameEl.textContent = member.displayName || member.name;
      if (subEl) subEl.textContent = (member.role || 'Member').toUpperCase();
      if (avatarContainer) {
        avatarContainer.className = 'w-8 h-8 flex-shrink-0';
        avatarContainer.innerHTML = renderAvatar(member, 'w-8 h-8');
      }
    }
  }
}

async function handleAdminSendPush(e) {
  e.preventDefault();
  if (!state.user?.isAdmin && !state.isAdminUnlocked) {
    toast('Admin access required', 'error');
    return;
  }

  const titleInput = document.getElementById('input-push-title');
  const bodyInput = document.getElementById('input-push-body');
  const targetSelect = document.getElementById('select-push-target');
  const iconInput = document.getElementById('input-push-icon');
  const typeSelect = document.getElementById('select-push-type');
  const routeSelect = document.getElementById('select-push-route');
  const itemIdInput = document.getElementById('input-push-item-id');
  const sendBtn = document.getElementById('btn-admin-send-push');

  const title = titleInput?.value?.trim();
  const body = bodyInput?.value?.trim();
  const target = targetSelect?.value || 'all';
  const icon = iconInput?.value || 'bell';
  const type = typeSelect?.value || 'system';
  const route = routeSelect?.value || '';
  const itemId = itemIdInput?.value?.trim() || '';

  if (!title || !body) {
    toast('Please enter both title and message body', 'warning');
    return;
  }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>Delivering...</span>';
  }

  const targetAction = route ? { route, itemId } : null;

  try {
    // 1. Write to push_queue for client FCM listeners
    addDoc(collection(db, 'push_queue'), {
      title,
      body,
      target,
      icon,
      type,
      targetAction,
      createdBy: state.user.uid,
      createdAt: serverTimestamp(),
      status: 'queued'
    }).catch(e => console.warn('push_queue write error:', e));

    // 2. Hybrid Firestore Notification Delivery
    if (target === 'all') {
      await addDoc(collection(db, 'notifications_broadcast'), {
        title,
        message: body,
        body,
        type,
        icon,
        targetType: 'all',
        badgeId: null,
        readBy: [],
        targetAction,
        createdAt: serverTimestamp()
      });
      toast('Broadcast notification sent to all team members!', 'success');
    } else if (target.startsWith('badge:')) {
      const badgeId = target.replace('badge:', '');
      await addDoc(collection(db, 'notifications_broadcast'), {
        title,
        message: body,
        body,
        type,
        icon,
        targetType: 'badge',
        badgeId,
        readBy: [],
        targetAction,
        createdAt: serverTimestamp()
      });
      toast(`Notification broadcast to badge group "${badgeId}"!`, 'success');
    } else {
      // Direct personal notification
      await addDoc(collection(db, 'notifications'), {
        uid: target,
        title,
        message: body,
        body,
        type,
        icon,
        targetAction,
        refId: null,
        read: false,
        createdAt: serverTimestamp()
      });
      toast('Personal notification sent!', 'success');
    }

    const batchLog = writeBatch(db);
    logAdminAction(batchLog, {
      action: 'admin_send_push',
      details: { title, target, icon, type, targetAction }
    });
    await batchLog.commit();

    // Reset inputs
    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.value = '';
    if (itemIdInput) itemIdInput.value = '';
    if (routeSelect) routeSelect.value = '';
    if (iconInput) iconInput.value = 'bell';
    const iconLabel = document.getElementById('push-icon-label');
    if (iconLabel) iconLabel.textContent = 'bell';
    const iconPreview = document.getElementById('push-icon-preview');
    if (iconPreview) iconPreview.innerHTML = getIconSvg('bell', 'w-4 h-4 stroke-current');
  } catch (err) {
    console.error('Send push error:', err);
    toast(err.message || 'Failed to dispatch notification', 'error');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span>Send Notification</span>';
    }
  }
}

/* ==========================================================================
   FIRESTORE REAL-TIME LISTENERS (MANAGED & LIMITED)
   ========================================================================== */
function initFirestoreListeners() {
  if (!db) {
    console.warn('Firestore database unavailable.');
    return;
  }

  // 1. Categories (limit 100)
  try {
    const unsubCats = onSnapshot(query(collection(db, 'categories'), limit(100)), (snapshot) => {
      state.categories = snapshot.docs.map(d => normalizeCategory({ id: d.id, ...d.data() }));
      populateCategoryFilters();
      renderAdminCategories();
      renderTasks();
    }, (err) => console.warn('Categories listener:', err));
    listeners.add('categories', unsubCats);
  } catch (e) { console.warn(e); }

  // 2. Tasks (limit 200)
  try {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), limit(200)), (snapshot) => {
      state.tasks = snapshot.docs.map(d => normalizeTask({ id: d.id, ...d.data() }));
      renderTasks();
      renderAdminTasks();
      updateHeroStats();
      updateAdminOverviewStats();
    }, (err) => console.warn('Tasks listener:', err));
    listeners.add('tasks', unsubTasks);
  } catch (e) { console.warn(e); }

  // 3. Attendance Sessions
  try {
    const unsubSessions = onSnapshot(query(collection(db, 'attendance_sessions'), limit(50)), (snapshot) => {
      state.attendanceSessions = snapshot.docs.map(d => normalizeSession({ id: d.id, ...d.data() }));
      renderAttendanceView();
      renderAdminSessions();
      updateAdminOverviewStats();
    }, (err) => console.warn('Attendance sessions listener:', err));
    listeners.add('attendance_sessions', unsubSessions);
  } catch (e) { console.warn(e); }

  // Badges Realtime Listener (Section 3)
  try {
    const unsubBadges = onSnapshot(collection(db, 'badges'), (snapshot) => {
      state.badges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminBadges();
    }, (err) => console.warn('Badges listener:', err));
    listeners.add('badges', unsubBadges);
  } catch (e) { console.warn(e); }

  // 4. Attendance Logs (User live attendance & Admin oversight)
  setupAttendanceListeners();

  // 5. Submissions (User live submissions & Admin oversight)
  setupSubmissionsListeners();

  // 6. Registered Members & Private User Profiles
  setupMembersListeners();
  setupUsersPrivateListener();
  setupWaiverRequestsListener();

  // 7. Notifications (User real-time sync)
  setupNotificationsListener();

  // 8. Broadcasts (Live carousel & Banner)
  setupBroadcastsListener();

  // 9. Settings (app_config & general)
  try {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'app_config'), (docSnap) => {
      if (docSnap.exists()) {
        state.settings = { ...state.settings, ...docSnap.data() };
        applySettings();
      }
    }, (err) => console.warn('Settings listener:', err));
    listeners.add('settings', unsubSettings);

    const unsubSettingsGeneral = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.defaultLeaderboardPeriod && ['all', 'month', 'week'].includes(data.defaultLeaderboardPeriod)) {
          state.settings.defaultLeaderboardPeriod = data.defaultLeaderboardPeriod;
          if (!state.leaderboardPeriodUserOverridden) {
            state.leaderboardPeriod = data.defaultLeaderboardPeriod;
            updateLeaderboardPeriodButtons();
            renderLeaderboard();
          }
        }
      }
    }, (err) => console.warn('Settings general listener:', err));
    listeners.add('settings_general', unsubSettingsGeneral);
  } catch (e) { console.warn(e); }
}

/* ==========================================================================
   UI RENDERING: TASKS
   ========================================================================== */
function populateCategoryFilters() {
  const container = document.getElementById('category-filter-chips');
  if (!container) return;

  const current = state.selectedCategory;
  let html = `
    <button data-category="all" class="cat-filter-btn px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${current === 'all' ? 'bg-[#0A84FF] text-white' : 'bg-white/10 text-neutral-300'}">
      All Tasks
    </button>
  `;

  state.categories.filter(c => !c.archived).forEach(cat => {
    const isSelected = current === cat.id;
    html += `
      <button data-category="${esc(cat.id)}" class="cat-filter-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${isSelected ? 'text-white' : 'bg-white/10 text-neutral-300'}" style="${isSelected ? `background-color: ${cat.color || '#0A84FF'};` : ''}">
        ${getCategorySvg(cat.iconKey, 'w-3.5 h-3.5')}
        <span>${esc(cat.name)}</span>
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

function renderTasks() {
  const container = document.getElementById('tasks-container');
  const emptyState = document.getElementById('tasks-empty-state');
  if (!container) return;

  const now = serverNow();
  let filtered = state.tasks.filter(t => {
    if (t.archived || t.active === false) return false;
    if (state.selectedCategory !== 'all' && (t.categoryId !== state.selectedCategory && t.category !== state.selectedCategory)) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (state.statusFilter !== 'all') {
      const win = getTaskWindow(t, now);
      const isCompleted = Boolean(state.user && state.mySubmissions?.some(s => s.taskId === t.id && (t.schedule?.type === 'once' ? true : s.occurrenceKey === win?.occurrenceKey)));
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
    const cat = state.categories.find(c => c.id === task.categoryId || c.id === task.category) || { name: 'General', color: '#0A84FF', iconKey: 'film' };
    const win = getTaskWindow(task, now);
    const isDone = Boolean(state.user && state.mySubmissions?.some(s => s.taskId === task.id && (task.schedule?.type === 'once' ? true : s.occurrenceKey === win?.occurrenceKey)));
    const totalCompletions = state.submissions.filter(s => s.taskId === task.id).length;

    let badgeHtml = '';
    if (isDone) {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Done</span>`;
    } else if (win?.state === 'open') {
      badgeHtml = task.isPermanent
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">No Deadline</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Due now</span>`;
    } else if (win?.state === 'upcoming') {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Upcoming</span>`;
    } else {
      badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-neutral-400 border border-white/15">Closed</span>`;
    }

    const isSelected = selectionState.active && selectionState.type === 'tasks' && selectionState.selectedIds.has(task.id);

    return `
      <div class="task-card bulk-select-card glass-card p-4 relative overflow-hidden cursor-pointer transition hover:border-white/25 active:scale-[0.99]${isSelected ? ' selected' : ''}" data-task-id="${esc(task.id)}" data-bulk-id="${esc(task.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content space-y-3 w-full">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold" style="background-color: ${cat.color}25; color: ${cat.color}; border: 1px solid ${cat.color}40;">
                ${getCategorySvg(cat.iconKey, 'w-3 h-3')}
                <span>${esc(cat.name)}</span>
              </span>
              ${badgeHtml}
            </div>
            ${(() => {
              const tieredInfo = computeTieredTaskPoints(task, now);
              const displayedPoints = task.tieredRewards?.enabled ? tieredInfo.points : task.points;
              const pointsSubtext = task.tieredRewards?.enabled && tieredInfo.statusText ? ` <span class="text-[10px] text-amber-300 font-normal">(${esc(tieredInfo.statusText)})</span>` : '';
              return `<span class="text-xs font-bold font-mono text-amber-400">+${displayedPoints} pts${pointsSubtext}</span>`;
            })()}
          </div>

          <div>
            <h3 class="ios-headline text-white">${esc(task.title)}</h3>
            <p class="ios-footnote text-neutral-400 mt-1 line-clamp-2">${esc(task.description)}</p>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            <button type="button" class="btn-view-task-completions text-neutral-400 hover:text-white flex items-center gap-1 font-mono" data-task-id="${esc(task.id)}">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>${totalCompletions} done</span>
            </button>

            <span class="font-semibold text-xs ${isDone ? 'text-emerald-400' : 'text-[#0A84FF]'}">
              ${isDone ? 'Completed ✓' : 'View & Submit &rarr;'}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Tapping ANY card opens the Task Details & Submission modal (or toggles selection if in selection mode)
  container.querySelectorAll('.task-card').forEach(card => {
    card.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'tasks') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      openTaskDetailsModal(card.dataset.taskId);
    };

    attachLongPress(card, () => {
      enterSelectionMode('tasks', card.dataset.bulkId);
    });
  });

  container.querySelectorAll('.btn-view-task-completions').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'tasks') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      openTaskCompetitionModal(btn.dataset.taskId);
    };
  });
}

function openTaskDetailsModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = serverNow();
  const win = getTaskWindow(task, now);
  const cat = state.categories.find(c => c.id === task.categoryId || c.id === task.category) || { name: 'General', color: '#0A84FF', iconKey: 'film' };

  const isDone = Boolean(state.user && state.mySubmissions?.some(s =>
    s.taskId === task.id && (task.schedule?.type === 'once' ? true : s.occurrenceKey === win?.occurrenceKey)
  ));

  let statusBadge = '';
  if (isDone) {
    statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Done</span>';
  } else if (win?.state === 'open') {
    if (task.isPermanent) {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">No Deadline</span>';
    } else {
      const closeTimeStr = win.closesAt ? `Closes ${formatDateTime(win.closesAt)}` : 'Due now';
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">${closeTimeStr}</span>`;
    }
  } else if (win?.state === 'grace') {
    const graceTimeStr = win.graceEndsAt ? `Grace cutoff ${formatDateTime(win.graceEndsAt)}` : 'Grace period';
    statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${graceTimeStr}</span>`;
  } else if (win?.state === 'upcoming') {
    const startTimeStr = `Starts ${formatDateTime(win.start)}`;
    statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">${startTimeStr}</span>`;
  } else {
    statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-neutral-400 border border-white/15">Closed</span>';
  }

  const linkBtnHtml = task.link ? `
    <a href="${esc(task.link)}" target="_blank" rel="noopener noreferrer" class="w-full py-3 px-4 rounded-xl font-bold bg-[#0A84FF]/20 hover:bg-[#0A84FF]/30 text-[#0A84FF] border border-[#0A84FF]/40 flex items-center justify-center gap-2 transition my-3">
      <span>Open Task Link</span>
      <svg class="w-4 h-4 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    </a>
  ` : '';

  const questions = Array.isArray(task.questions) ? task.questions : [];
  const questionsHtml = questions.length > 0 ? `
    <div class="space-y-3.5 pt-3 border-t border-white/10" id="task-detail-questions-container">
      <h4 class="text-xs font-bold text-white uppercase tracking-wider">Required Questions</h4>
      ${questions.map((q) => {
        const qType = q.type || 'short';
        const isReq = Boolean(q.isRequired);
        const reqBadge = isReq ? '<span class="text-rose-400">*</span>' : '<span class="text-neutral-500 font-normal">(Optional)</span>';

        if (qType === 'long') {
          return `
            <div class="task-q-card space-y-1.5" data-q-id="${esc(q.id)}" data-q-type="long" data-is-required="${isReq}">
              <label class="block text-xs font-semibold text-neutral-200">
                ${esc(q.questionText)} ${reqBadge}
              </label>
              <textarea class="task-q-input w-full glass-input text-xs leading-relaxed" rows="3" placeholder="Write your detailed answer..." ${isDone || win?.state === 'closed' ? 'disabled' : ''}></textarea>
              <div class="task-q-error text-[11px] text-rose-400 hidden">This question is required</div>
            </div>
          `;
        }

        if (qType === 'mcq') {
          const opts = Array.isArray(q.options) ? q.options : [];
          return `
            <div class="task-q-card space-y-2" data-q-id="${esc(q.id)}" data-q-type="mcq" data-is-required="${isReq}">
              <label class="block text-xs font-semibold text-neutral-200">
                ${esc(q.questionText)} ${reqBadge}
              </label>
              <div class="space-y-1.5 mcq-options-group">
                ${opts.map((opt) => `
                  <label class="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition">
                    <input type="radio" name="mcq_${esc(q.id)}" value="${esc(opt.label)}" class="text-[#0A84FF] focus:ring-0" ${isDone || win?.state === 'closed' ? 'disabled' : ''} />
                    <span class="text-xs text-white">${esc(opt.label)}</span>
                  </label>
                `).join('')}
                ${q.allowOther ? `
                  <label class="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition">
                    <input type="radio" name="mcq_${esc(q.id)}" value="Other" class="text-[#0A84FF] focus:ring-0 mcq-radio-other" ${isDone || win?.state === 'closed' ? 'disabled' : ''} />
                    <span class="text-xs text-white">Other</span>
                  </label>
                  <input type="text" class="mcq-other-input w-full glass-input text-xs hidden mt-1.5" placeholder="Please specify your answer..." ${isDone || win?.state === 'closed' ? 'disabled' : ''} />
                ` : ''}
              </div>
              <div class="task-q-error text-[11px] text-rose-400 hidden">Please select an answer</div>
            </div>
          `;
        }

        // Default: short text
        return `
          <div class="task-q-card space-y-1.5" data-q-id="${esc(q.id)}" data-q-type="short" data-is-required="${isReq}">
            <label class="block text-xs font-semibold text-neutral-200">
              ${esc(q.questionText)} ${reqBadge}
            </label>
            <input type="text" class="task-q-input w-full glass-input text-xs" placeholder="Your answer..." ${isDone || win?.state === 'closed' ? 'disabled' : ''} />
            <div class="task-q-error text-[11px] text-rose-400 hidden">This question is required</div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  // Banner status with countdown
  let bannerHtml = '';
  if (isDone) {
    bannerHtml = '<div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium text-center flex items-center justify-center gap-2">✓ You have completed this occurrence.</div>';
  } else if (win?.state === 'closed') {
    bannerHtml = '<div class="p-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium text-center">This task is closed for submissions.</div>';
  } else if (win?.state === 'upcoming') {
    bannerHtml = `<div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium text-center">Starts ${formatDateTime(win.start)}</div>`;
  } else if (!state.user) {
    bannerHtml = '<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium text-center">Sign in from the Profile tab to submit proof and claim points.</div>';
  } else if (win?.state === 'grace') {
    bannerHtml = '<div class="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium text-center">Deadline passed: in grace period. Submissions earn standard points.</div>';
  }

  const commentHtml = `
    <div class="space-y-1 pt-3 border-t border-white/10">
      <label class="block text-xs font-medium text-neutral-300">Comment / Proof Notes (Optional)</label>
      <textarea id="task-detail-comment" rows="2" class="w-full glass-input text-xs" placeholder="Add submission notes..." ${isDone || win?.state === 'closed' ? 'disabled' : ''}></textarea>
    </div>
  `;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-3';
  bodyEl.innerHTML = `
    <div class="flex items-center justify-between pb-1">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style="background-color: ${cat.color}25; color: ${cat.color}; border: 1px solid ${cat.color}40;">
          ${getCategorySvg(cat.iconKey, 'w-3.5 h-3.5')}
          <span>${esc(cat.name)}</span>
        </span>
        ${statusBadge}
      </div>
      <span class="text-sm font-bold font-mono text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20" id="task-detail-points-badge">
        +${win ? win.pointsForNow : (task.points || 5)} pts
      </span>
    </div>

    <div>
      <h2 class="text-lg font-bold text-white leading-snug">${esc(task.title)}</h2>
      <div class="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed mt-2">${esc(task.description)}</div>
    </div>

    ${linkBtnHtml}
    ${bannerHtml}
    ${questionsHtml}
    ${commentHtml}
  `;

  // Wire MCQ Other toggle
  bodyEl.querySelectorAll('.task-q-card[data-q-type="mcq"]').forEach(card => {
    const radios = card.querySelectorAll('input[type="radio"]');
    const otherInp = card.querySelector('.mcq-other-input');
    radios.forEach(r => {
      if (r) r.onchange = () => {
        if (otherInp) {
          if (r.value === 'Other' && r.checked) {
            otherInp.classList.remove('hidden');
            otherInp.focus();
          } else {
            otherInp.classList.add('hidden');
          }
        }
      };
    });
  });

  const canSubmit = state.user && !isDone && (win?.state === 'open' || win?.state === 'grace');

  openModal({
    title: 'Task Details',
    body: bodyEl,
    saveLabel: canSubmit ? 'Submit Proof' : null,
    onSave: canSubmit ? async () => {
      let hasError = false;
      const answers = [];

      bodyEl.querySelectorAll('.task-q-card').forEach(card => {
        const qId = card.dataset.qId;
        const qType = card.dataset.qType || 'short';
        const isReq = card.dataset.isRequired === 'true';
        const errEl = card.querySelector('.task-q-error');
        const originalQ = questions.find(q => q.id === qId);
        const qText = originalQ ? originalQ.questionText : '';

        if (qType === 'short' || qType === 'long') {
          const inp = card.querySelector('.task-q-input');
          const val = inp?.value.trim() || '';
          if (isReq && !val) {
            hasError = true;
            if (errEl) errEl.classList.remove('hidden');
            if (inp) inp.classList.add('border-rose-500');
          } else {
            if (errEl) errEl.classList.add('hidden');
            if (inp) inp.classList.remove('border-rose-500');
          }
          answers.push({
            questionId: qId,
            questionText: qText,
            type: qType,
            answer: val,
            otherText: null
          });
        } else if (qType === 'mcq') {
          const checkedRadio = card.querySelector('input[type="radio"]:checked');
          const otherInp = card.querySelector('.mcq-other-input');
          const isOther = checkedRadio?.value === 'Other';
          const otherVal = otherInp?.value.trim() || '';

          if (isReq && !checkedRadio) {
            hasError = true;
            if (errEl) { errEl.textContent = 'Please select an option'; errEl.classList.remove('hidden'); }
          } else if (isOther && !otherVal) {
            hasError = true;
            if (errEl) { errEl.textContent = 'Please specify your other answer'; errEl.classList.remove('hidden'); }
            if (otherInp) otherInp.classList.add('border-rose-500');
          } else {
            if (errEl) errEl.classList.add('hidden');
            if (otherInp) otherInp.classList.remove('border-rose-500');
          }

          answers.push({
            questionId: qId,
            questionText: qText,
            type: 'mcq',
            answer: checkedRadio ? checkedRadio.value : '',
            otherText: isOther ? otherVal : null
          });
        }
      });

      if (hasError) return false;

      try {
        const currentWin = getTaskWindow(task, serverNow());
        if (currentWin?.state !== 'open' && currentWin?.state !== 'grace') {
          toast('Submission closed: deadline and grace period have expired.', 'error');
          return false;
        }

        const occurrenceKey = (task.schedule?.type === 'once') ? 'once' : (currentWin?.occurrenceKey || 'once');
        const policy = task.claimPolicy || 'once_per_cycle';
        let subId;
        let pointsAwarded = currentWin.pointsForNow;

        if (policy === 'milestone') {
          const hasPriorSub = (state.submissions || []).some(s => s.taskId === task.id && s.uid === state.user.uid);
          if (hasPriorSub) {
            pointsAwarded = 0;
          }
          subId = `${task.id}_${state.user.uid}_milestone`;
        } else if (policy === 'every_submission') {
          subId = `${task.id}_${state.user.uid}_${Date.now()}`;
        } else {
          subId = `${task.id}_${state.user.uid}_${occurrenceKey}`;
        }
        const comment = bodyEl.querySelector('#task-detail-comment')?.value || '';

        const batch = writeBatch(db);
        const subRef = doc(db, 'submissions', subId);
        const userRef = doc(db, 'users', state.user.uid);

        batch.set(subRef, {
          taskId: task.id,
          taskTitle: task.title,
          uid: state.user.uid,
          userName: state.user.name || state.user.displayName || 'Member',
          userAvatar: state.user.avatarUrl || state.user.photoURL || '',
          occurrenceKey,
          answers,
          inGrace: Boolean(currentWin.inGrace),
          comment: comment.trim(),
          pointsAwarded,
          submittedAt: serverTimestamp()
        });

        const pointsUpdate = buildPointsUpdate(usersMap.get(state.user.uid) || state.user, pointsAwarded, serverNow());
        batch.update(userRef, {
          ...pointsUpdate,
          lastOpId: subId,
          updatedAt: serverTimestamp()
        });

        await batch.commit();
        toast(`Task submitted! +${pointsAwarded} pts awarded${currentWin.inGrace ? ' (Grace Period)' : ''}`, 'success');
        renderTasks();
        return true;
      } catch (err) {
        console.error('Submission error:', err);
        toast(err.message || 'Submission failed', 'error');
        return false;
      }
    } : null
  });
}

function openTaskCompetitionModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  const subs = state.submissions.filter(s => s.taskId === taskId);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-2';

  if (subs.length === 0) {
    bodyEl.innerHTML = '<p class="text-xs text-neutral-400 py-6 text-center">No completions recorded yet.</p>';
  } else {
    bodyEl.innerHTML = subs.map(s => {
      const userProf = getUserProfile(s.userId || s.uid, s.userName, s.userAvatar);
      return `
      <div class="completion-row py-2.5 flex items-center justify-between text-xs border-b border-white/5 cursor-pointer hover:bg-white/[0.04] transition rounded-lg" data-member-uid="${esc(s.userId || s.uid)}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div class="shrink-0">${renderAvatar(userProf, 'w-7 h-7')}</div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-white flex items-center gap-1.5 min-w-0">
              <span class="truncate shrink-0 max-w-[100px]">${esc(userProf.displayName)}</span>
              <div class="badge-row-container flex items-center gap-1 min-w-0 flex-1 overflow-hidden" data-uid="${esc(s.userId || s.uid)}"></div>
            </div>
            <div class="text-[10px] text-neutral-400">${s.submittedAt ? formatDateTime(s.submittedAt) : 'Recent'}</div>
          </div>
        </div>
        <span class="text-emerald-400 font-mono font-bold shrink-0">+${s.pointsAwarded || 5} pts</span>
      </div>
    `;
    }).join('');

    bodyEl.querySelectorAll('.badge-row-container').forEach(c => {
      const uid = c.dataset.uid;
      const mem = usersMap.get(uid) || state.members.find(m => m.uid === uid);
      if (mem) {
        renderBadgeRow(c, mem.badges, mem);
      }
    });

    bodyEl.querySelectorAll('.completion-row').forEach(row => {
      row.onclick = () => {
        const uid = row.dataset.memberUid;
        if (uid) openMiniProfileSheet(uid);
      };
    });
  }

  openModal({
    title: task ? `${task.title} - Completions` : 'Completions',
    body: bodyEl
  });
}

/* ==========================================================================
   UI RENDERING: ATTENDANCE
   ========================================================================== */
let attendanceTickerInterval = null;

function renderAttendanceView() {
  const container = document.getElementById('attendance-sessions-container');
  if (!container) return;

  if (attendanceTickerInterval) {
    clearInterval(attendanceTickerInterval);
    attendanceTickerInterval = null;
  }

  const userUid = state.user?.uid;
  const isAdmin = Boolean(state.user?.isAdmin || state.user?.role === 'admin' || state.isAdminUnlocked);
  const userBadgeIds = new Set([
    ...(Array.isArray(state.user?.badgeIds) ? state.user.badgeIds : []),
    ...(Array.isArray(state.user?.badges) ? state.user.badges.map(x => typeof x === 'string' ? x : x?.id).filter(Boolean) : [])
  ]);

  const activeSessions = (state.attendanceSessions || []).filter(s => {
    if (!s.active || s.archived) return false;
    if (isAdmin) return true;
    if (!userUid) return false;

    const targetType = s.targetType || (Array.isArray(s.assignedUids) && s.assignedUids.length > 0 ? 'custom' : (Array.isArray(s.badgeIds) && s.badgeIds.length > 0 ? 'badge' : 'all'));
    if (targetType === 'all') return true;
    if (targetType === 'badge') {
      const bIds = Array.isArray(s.badgeIds) ? s.badgeIds : [];
      if (bIds.length === 0) return true;
      return bIds.some(bid => userBadgeIds.has(bid));
    }
    if (targetType === 'custom') {
      const uids = Array.isArray(s.assignedUids) ? s.assignedUids : [];
      return uids.includes(userUid);
    }
    return true;
  });

  if (activeSessions.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-6 text-center border border-dashed border-white/10">
        <p class="ios-footnote text-neutral-400">No active attendance sessions currently open for you.</p>
      </div>
    `;
    return;
  }

  const nowMs = serverNow();

  container.innerHTML = activeSessions.map(session => {
    const calc = computeAttendance(session, nowMs);
    const occurrenceKey = calc.occurrenceKey;

    // Has user checked in for this occurrence?
    const userLog = state.myAttendanceLogs?.find(l => l.sessionId === session.id && (l.occurrenceKey === occurrenceKey || (session.schedule?.type === 'once' && l.occurrenceKey === 'once')));

    // Has user an approved waiver for this occurrence?
    const approvedWaiver = state.myWaiverRequests?.find(w => w.sessionId === session.id && (w.occurrenceKey === occurrenceKey || (session.schedule?.type === 'once' && w.occurrenceKey === 'once')) && w.status === 'approved');

    const S = calc.occurrenceStart || session.schedule?.startDateTime || nowMs;
    const startFormatted = formatDateTime(S);

    if (userLog) {
      const isLate = userLog.status === 'late' || (userLog.penalty > 0);
      const isAbsent = userLog.status === 'absent';
      return `
        <div class="glass-card p-4 space-y-3 ${isAbsent ? 'border-rose-500/20 bg-rose-500/[0.03]' : 'border-emerald-500/20 bg-emerald-500/[0.03]'}">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="ios-headline text-white">${esc(session.title)}</h3>
              <p class="text-xs text-neutral-400 mt-0.5">${startFormatted} (Cairo)</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${isAbsent ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'} flex items-center gap-1">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
                ${isAbsent ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
              </svg>
              <span>${isAbsent ? 'Recorded Absent' : 'Checked In'}</span>
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/[0.03] text-xs">
            <div>
              <span class="text-[10px] text-neutral-400 block">${isAbsent ? 'Record Time' : 'Time Checked In'}</span>
              <span class="text-white font-medium">${formatDateTime(userLog.checkedInAt)}</span>
            </div>
            <div>
              <span class="text-[10px] text-neutral-400 block">Status &amp; Deductions</span>
              <span class="font-semibold ${isLate || isAbsent ? 'text-rose-400' : 'text-emerald-400'} font-mono">
                ${isAbsent ? `Absent (-${userLog.penalty} pts${userLog.fineEGP > 0 ? ' -' + userLog.fineEGP + ' EGP' : ''})` : (isLate ? `Late (-${userLog.penalty} pts${userLog.fineEGP > 0 ? ' -' + userLog.fineEGP + ' EGP' : ''})` : 'On Time (0 penalty)')}
              </span>
            </div>
          </div>
          ${userLog.delaySeconds > 0 ? `
            <div class="text-[11px] text-neutral-400">
              Recorded delay: ${Math.floor(userLog.delaySeconds / 60)}m ${userLog.delaySeconds % 60}s
            </div>
          ` : ''}
        </div>
      `;
    }

    if (approvedWaiver) {
      return `
        <div class="glass-card p-4 space-y-3 border-blue-500/20 bg-blue-500/[0.03]">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="ios-headline text-white">${esc(session.title)}</h3>
              <p class="text-xs text-neutral-400 mt-0.5">${startFormatted} (Cairo)</p>
            </div>
            <span class="badge-waived px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 font-mono">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Excuse Approved</span>
            </span>
          </div>
          <div class="p-2.5 rounded-xl bg-white/[0.03] text-xs space-y-1">
            <span class="text-[10px] text-neutral-400 block font-semibold">Exempted from attendance penalty</span>
            <p class="text-neutral-300 italic text-[11px]">"${esc(approvedWaiver.reason)}"</p>
            ${approvedWaiver.adminNote ? `<div class="text-[10px] text-blue-300">Admin note: ${esc(approvedWaiver.adminNote)}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Not checked in yet
    const isBlocked = calc.status === 'blocked';
    const isLate = calc.status === 'late';
    const isOnTime = calc.status === 'on_time';

    let statusPill = '';
    let previewBox = '';
    let btnText = '';
    let btnDisabled = false;

    if (isBlocked) {
      btnDisabled = true;
      if (calc.reason === 'early') {
        statusPill = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Opens Soon</span>`;
        previewBox = `
          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span id="preview-text-${esc(session.id)}">${calc.message}</span>
          </div>
        `;
        btnText = `Check-in Opens Soon`;
      } else {
        statusPill = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Closed</span>`;
        previewBox = `
          <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            <span id="preview-text-${esc(session.id)}">${calc.message}</span>
          </div>
        `;
        btnText = `Check-in Closed`;
      }
    } else if (isOnTime) {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Open (On Time)</span>`;
      previewBox = `
        <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span id="preview-text-${esc(session.id)}">On time check-in window</span>
          </div>
          <span class="font-bold font-mono text-emerald-400">0 penalty</span>
        </div>
      `;
      btnText = `Check In Now (0 Penalty)`;
    } else {
      // Late
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">Late Window</span>`;
      previewBox = `
        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
          <div class="flex items-center justify-between font-semibold">
            <span id="preview-text-${esc(session.id)}">${calc.message}</span>
            <span id="preview-penalty-${esc(session.id)}" class="font-bold font-mono text-rose-400">-${calc.penalty} ${session.penaltyFinesEnabled ? 'EGP' : 'pts'}</span>
          </div>
          <div class="text-[10px] text-rose-300/70">
            Deduction step: +${session.penaltyPerStep} ${session.penaltyFinesEnabled ? 'EGP' : 'pts'} every ${session.stepDuration} ${session.penaltyUnit}
          </div>
        </div>
      `;
      btnText = `Check In Now (-${calc.penalty} ${session.penaltyFinesEnabled ? 'EGP' : 'pts'})`;
    }

    return `
      <div class="glass-card p-4 space-y-3 border-white/10" data-session-card="${esc(session.id)}">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="ios-headline text-white">${esc(session.title)}</h3>
            <p class="text-xs text-neutral-400 mt-0.5">${startFormatted} (Cairo)</p>
          </div>
          ${statusPill}
        </div>

        <div class="text-[11px] text-neutral-400 space-y-0.5">
          <div>Early window: ${session.earlyCheckInMinutes} mins before start</div>
          <div>Late cutoff: ${session.lateCutoffMinutes} mins after start</div>
        </div>

        <div id="session-preview-container-${esc(session.id)}">
          ${previewBox}
        </div>

        <button
          class="btn-check-in-session w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition ${btnDisabled ? 'bg-white/10 text-neutral-500 cursor-not-allowed' : (isLate ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white')}"
          data-session-id="${esc(session.id)}"
          ${btnDisabled ? 'disabled' : ''}
          id="btn-session-checkin-${esc(session.id)}">
          ${btnText}
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-check-in-session:not([disabled])').forEach(btn => {
    btn.onclick = () => handleAttendanceCheckIn(btn.dataset.sessionId);
  });

  // Start 1-second live penalty preview counter
  attendanceTickerInterval = setInterval(() => {
    const curNow = serverNow();
    activeSessions.forEach(session => {
      const card = container.querySelector(`[data-session-card="${session.id}"]`);
      if (!card) return;

      const calc = computeAttendance(session, curNow);
      const prevTextEl = card.querySelector(`#preview-text-${session.id}`);
      const prevPenEl = card.querySelector(`#preview-penalty-${session.id}`);
      const btn = card.querySelector(`#btn-session-checkin-${session.id}`);

      if (calc.status === 'blocked') {
        if (prevTextEl) prevTextEl.textContent = calc.message;
        if (btn && !btn.disabled) {
          btn.disabled = true;
          btn.className = 'btn-check-in-session w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition bg-white/10 text-neutral-500 cursor-not-allowed';
          btn.textContent = calc.reason === 'early' ? 'Check-in Opens Soon' : 'Check-in Closed';
        }
      } else if (calc.status === 'on_time') {
        if (prevTextEl) prevTextEl.textContent = 'On time check-in window';
        if (btn && btn.disabled) {
          btn.disabled = false;
          btn.className = 'btn-check-in-session w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition bg-emerald-600 hover:bg-emerald-500 text-white';
          btn.textContent = 'Check In Now (0 Penalty)';
          btn.onclick = () => handleAttendanceCheckIn(session.id);
        }
      } else if (calc.status === 'late') {
        if (prevTextEl) prevTextEl.textContent = calc.message;
        if (prevPenEl) prevPenEl.textContent = `-${calc.penalty} ${session.penaltyFinesEnabled ? 'EGP' : 'pts'}`;
        if (btn) {
          btn.disabled = false;
          btn.className = 'btn-check-in-session w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition bg-rose-600 hover:bg-rose-500 text-white';
          btn.textContent = `Check In Now (-${calc.penalty} ${session.penaltyFinesEnabled ? 'EGP' : 'pts'})`;
          btn.onclick = () => handleAttendanceCheckIn(session.id);
        }
      }
    });
  }, 1000);
}

async function handleAttendanceCheckIn(sessionId) {
  if (!state.user) {
    toast('Please sign in to check in', 'error');
    if (userPagerInstance) userPagerInstance.goTo('profile');
    return;
  }

  const session = state.attendanceSessions.find(s => s.id === sessionId);
  if (!session) return;

  const nowMs = serverNow();
  const calc = computeAttendance(session, nowMs);

  if (calc.status === 'blocked') {
    toast(calc.message || 'Check-in is currently unavailable', 'error');
    return;
  }

  const occurrenceKey = calc.occurrenceKey;

  // Check if member already has an approved waiver for this occurrence
  const approvedWaiver = state.myWaiverRequests?.find(w => w.sessionId === session.id && (w.occurrenceKey === occurrenceKey || (session.schedule?.type === 'once' && w.occurrenceKey === 'once')) && w.status === 'approved');
  if (approvedWaiver) {
    toast('You have an approved excuse for this session.', 'info');
    return;
  }

  const penaltyPts = (session.penaltyPointsEnabled !== false) ? calc.penalty : 0;
  const fineEGP = (session.penaltyFinesEnabled) ? calc.penalty : 0;

  const confirmed = await confirmSheet({
    title: calc.status === 'on_time' ? 'Confirm Check-In' : 'Confirm Late Check-In',
    message: calc.status === 'on_time'
      ? `Check in for "${session.title}" on time with 0 penalty?`
      : `You are checking in late for "${session.title}". A deduction of ${penaltyPts > 0 ? penaltyPts + ' pts' : ''}${fineEGP > 0 ? ' ' + fineEGP + ' EGP' : ''} will be recorded. Confirm?`,
    confirmLabel: 'Check In',
    destructive: calc.status === 'late'
  });

  if (!confirmed) return;

  // Exact deterministic log ID: sessionId_occurrenceKey_uid
  const logId = `${session.id}_${occurrenceKey}_${state.user.uid}`;

  try {
    const batch = writeBatch(db);
    const logRef = doc(db, 'attendance_logs', logId);

    const logPayload = {
      sessionId: session.id,
      sessionTitle: session.title,
      uid: state.user.uid,
      userName: state.user.name || state.user.displayName || 'Member',
      userAvatar: state.user.avatarUrl || state.user.photoURL || '',
      occurrenceKey,
      occurrenceStart: Timestamp.fromMillis(calc.occurrenceStart),
      checkedInAt: serverTimestamp(),
      status: calc.status,
      delaySeconds: calc.delaySeconds,
      penalty: penaltyPts,
      fineEGP: fineEGP,
      penaltyUnit: session.penaltyUnit || 'minutes'
    };

    batch.set(logRef, logPayload);

    // Conditionally increment penalties ONLY if penaltyPointsEnabled is true and penaltyPts > 0
    if (session.penaltyPointsEnabled !== false && penaltyPts > 0) {
      const userRef = doc(db, 'users', state.user.uid);
      batch.update(userRef, {
        penalties: increment(penaltyPts),
        lastOpId: logId
      });
    }

    await batch.commit();

    // Optimistic cache update
    const optLog = normalizeAttendanceLog({
      id: logId,
      ...logPayload,
      checkedInAt: { toMillis: () => nowMs }
    });
    state.myAttendanceLogs = [optLog, ...state.myAttendanceLogs.filter(l => l.id !== logId)];
    if (penaltyPts > 0) {
      state.user.penalties = (state.user.penalties || 0) + penaltyPts;
      updateProfileUI();
    }
    renderAttendanceView();
    renderAttendanceLogs();
    renderProfileAttendance();
    updateUserTodayAttendanceBadge();

    getMemberDerivedEgpBalance(state.user.uid, true).then(() => { updateProfileUI(); });
    toast(calc.status === 'on_time' ? 'Checked in successfully! (0 penalty)' : `Checked in late. -${penaltyPts > 0 ? penaltyPts + ' pts' : ''}${fineEGP > 0 ? ' ' + fineEGP + ' EGP' : ''} applied.`, 'success');
  } catch (err) {
    console.error('Attendance check-in error:', err);
    toast(err.message || 'Check-in failed', 'error');
  }
}

function renderAttendanceLogs() {
  const feed = document.getElementById('attendance-logs-feed');
  const countEl = document.getElementById('attendance-log-count');
  if (!feed) return;

  const userLogs = state.myAttendanceLogs || [];
  if (countEl) countEl.textContent = `${userLogs.length} Check-ins`;

  if (userLogs.length === 0) {
    feed.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">No check-ins recorded yet.</p>';
    return;
  }

  feed.innerHTML = userLogs.map(log => {
    const isLate = log.status === 'late' || log.penalty > 0;
    return `
      <div class="inset-row flex items-center justify-between text-xs py-2.5">
        <div class="flex items-center gap-2.5">
          ${renderAvatar({ displayName: log.userName, uid: log.uid, photoURL: log.userAvatar }, 'w-8 h-8')}
          <div>
            <div class="font-semibold text-white">${esc(log.sessionTitle)}</div>
            <div class="text-[11px] text-neutral-400">${formatDateTime(log.checkedInAt)}</div>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${isLate ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
            ${isLate ? `Late (-${log.penalty} EGP)` : 'On Time'}
          </span>
          ${log.delaySeconds > 0 ? `
            <div class="text-[10px] text-neutral-500 mt-0.5">+${Math.floor(log.delaySeconds / 60)}m ${log.delaySeconds % 60}s delay</div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderProfileAttendance() {
  const listEl = document.getElementById('profile-attendance-list');
  const countEl = document.getElementById('profile-attendance-count');
  if (!listEl) return;

  const logs = state.myAttendanceLogs || [];
  if (countEl) countEl.textContent = `${logs.length} check-ins`;

  if (logs.length === 0) {
    listEl.innerHTML = '<div class="p-4 text-center text-xs text-neutral-400">No attendance records yet.</div>';
    return;
  }

  listEl.innerHTML = logs.map(log => {
    const isLate = log.status === 'late' || log.penalty > 0;
    return `
      <div class="inset-row flex items-center justify-between py-2.5 text-xs">
        <div>
          <div class="font-semibold text-white">${esc(log.sessionTitle)}</div>
          <div class="text-[11px] text-neutral-400">${formatDateTime(log.checkedInAt)}</div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${isLate ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
            ${isLate ? `Late (-${log.penalty} EGP)` : 'On Time'}
          </span>
          ${log.delaySeconds > 0 ? `
            <div class="text-[10px] text-neutral-500 mt-0.5">${Math.floor(log.delaySeconds / 60)}m ${log.delaySeconds % 60}s late</div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderProfileTransactions() {
  const container = document.getElementById('profile-transactions-list');
  const countBadge = document.getElementById('profile-tx-count');
  if (!container || !state.user) return;
  loadTransactionLedger(state.user.uid, container, countBadge);

  const toggleBtn = document.getElementById('btn-toggle-profile-transactions');
  if (toggleBtn && !toggleBtn.dataset.wired) {
    toggleBtn.dataset.wired = 'true';
    toggleBtn.onclick = () => {
      const isHidden = container.classList.toggle('hidden');
      const chevron = document.getElementById('profile-tx-chevron');
      if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
      if (!isHidden && container.innerHTML.trim() === '') {
        loadTransactionLedger(state.user.uid, container, countBadge);
      }
    };
  }
}

function updateUserTodayAttendanceBadge() {
  const badge = document.getElementById('user-today-attendance-badge');
  if (!badge) return;

  if (!state.user) {
    badge.textContent = 'Guest Mode';
    badge.className = 'text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-400';
    return;
  }

  const todayChecked = state.myAttendanceLogs?.length > 0;
  if (todayChecked) {
    badge.textContent = 'Checked In';
    badge.className = 'text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold';
  } else {
    badge.textContent = 'Not Checked In';
    badge.className = 'text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-medium';
  }
}

/* ==========================================================================
   UI RENDERING: LEADERBOARD
   ========================================================================== */
let leaderboardSegmentedInstance = null;

function setupLeaderboardSegmented() {
  const mount = document.getElementById('leaderboard-period-segmented-mount');
  if (!mount) return;
  if (!leaderboardSegmentedInstance || !mount.contains(leaderboardSegmentedInstance)) {
    mount.innerHTML = '';
    leaderboardSegmentedInstance = renderSegmented({
      id: 'leaderboard-period-segmented',
      options: [
        { value: 'all', label: 'All' },
        { value: 'month', label: 'Month' },
        { value: 'week', label: 'Week' }
      ],
      value: state.leaderboardPeriod || 'all',
      onChange: (val) => {
        state.leaderboardPeriod = val;
        state.leaderboardPeriodUserOverridden = true;
        renderLeaderboard();
      }
    });
    mount.appendChild(leaderboardSegmentedInstance);
  } else if (leaderboardSegmentedInstance.getValue && leaderboardSegmentedInstance.getValue() !== (state.leaderboardPeriod || 'all')) {
    leaderboardSegmentedInstance.setValue(state.leaderboardPeriod || 'all', false);
  }
}

function updateLeaderboardPeriodButtons() {
  setupLeaderboardSegmented();
}

function renderLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  const countEl = document.getElementById('leaderboard-total-count');
  const podiumEl = document.getElementById('leaderboard-podium');
  if (!listEl) return;

  updateLeaderboardPeriodButtons();

  const nowMs = serverNow();
  const period = state.leaderboardPeriod || 'all';

  // Zero-Extra-Reads: compute directly from usersMap in memory (identical for guests and signed-in users)
  const allMembers = usersMap.size > 0 ? Array.from(usersMap.values()) : [...state.members];

  const sorted = (allMembers || []).map(m => {
    const prof = getUserProfile(m.uid, m.displayName, m.photoURL);
    const periodPoints = Number(getMemberPeriodPoints(m, period, nowMs) || 0);
    const penalties = typeof m.penalties === 'number' ? m.penalties : (typeof m.totalPenalties === 'number' ? m.totalPenalties : 0);
    return { ...m, ...prof, periodPoints, penalties };
  });

  const rankedMembers = sorted
    .filter(m => Number(m.periodPoints || 0) > 0)
    .sort((a, b) => {
      const diff = Number(b.periodPoints || 0) - Number(a.periodPoints || 0);
      if (diff !== 0) return diff;
      const penDiff = (a.penalties || 0) - (b.penalties || 0);
      if (penDiff !== 0) return penDiff;
      return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
    });
  const unrankedMembers = sorted
    .filter(m => Number(m.periodPoints || 0) <= 0)
    .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));

  if (countEl) countEl.textContent = `${sorted.length} Members`;

  const taskCountOf = (uid) => (state.submissions || []).filter(s => s.userId === uid || s.uid === uid).length;

  function podiumCard(member, place) {
    const cfg = {
      1: { label: '#1', border: 'border-amber-400', text: 'text-amber-400', sub: 'text-amber-300/80', ring: 'border-amber-400', size: 'w-14 h-14', pad: 'p-3.5', extra: 'shadow-xl bg-gradient-to-b from-amber-500/10 to-transparent' },
      2: { label: '#2', border: 'border-slate-300', text: 'text-slate-300', sub: 'text-neutral-400', ring: 'border-slate-300', size: 'w-12 h-12', pad: 'p-3', extra: '' },
      3: { label: '#3', border: 'border-amber-700', text: 'text-amber-500', sub: 'text-neutral-400', ring: 'border-amber-700', size: 'w-12 h-12', pad: 'p-3', extra: '' }
    }[place];
    const name = member.displayName || member.name || 'Member';
    return `
      <div id="podium-${place === 1 ? 'first' : place === 2 ? 'second' : 'third'}" class="podium-card glass-card ${cfg.pad} text-center border-t-2 ${cfg.border} ${cfg.extra} rounded-xl cursor-pointer hover:bg-white/5 transition" data-member-uid="${esc(member.uid)}">
        <div class="text-xs font-bold ${cfg.text} mb-1">${cfg.label}</div>
        <div class="mx-auto mb-1.5 flex justify-center">${renderAvatar(member, cfg.size)}</div>
        <div class="font-bold text-xs text-white truncate">${esc(name)}</div>
        <div class="text-xs font-bold ${cfg.text} font-mono mt-0.5">${member.periodPoints} pts</div>
        <div class="text-[10px] ${cfg.sub}">${taskCountOf(member.uid)} tasks</div>
      </div>`;
  }

  // ----- Podium / Spotlight / Empty state (built dynamically, no static fallback HTML) -----
  if (podiumEl) {
    if (rankedMembers.length === 0) {
      podiumEl.className = 'pt-4 pb-2';
      podiumEl.innerHTML = `
        <div class="ios-card text-center py-6" id="leaderboard-empty-state">
          <p class="text-sm font-semibold text-white">No points awarded yet.</p>
          <p class="text-xs text-neutral-400 mt-1">Complete tasks to climb the leaderboard.</p>
        </div>`;
    } else if (rankedMembers.length === 1) {
      podiumEl.className = 'flex justify-center items-center pt-4 pb-2';
      const m = rankedMembers[0];
      podiumEl.innerHTML = `
        <div id="podium-first" class="podium-card glass-card p-4 text-center border-2 border-amber-400 shadow-xl bg-gradient-to-b from-amber-500/15 to-transparent rounded-2xl w-full max-w-[260px] cursor-pointer hover:scale-[1.02] transition" data-member-uid="${esc(m.uid)}">
          <div class="text-sm font-bold text-amber-400 mb-1">#1</div>
          <div class="mx-auto mb-2 flex justify-center">${renderAvatar(m, 'w-16 h-16')}</div>
          <div class="font-bold text-sm text-white truncate">${esc(m.displayName || m.name || 'Member')}</div>
          <div class="text-sm font-bold text-amber-400 font-mono mt-0.5">${m.periodPoints} pts</div>
          <div class="text-[10px] text-amber-300/80">${taskCountOf(m.uid)} tasks</div>
        </div>`;
    } else if (rankedMembers.length === 2) {
      podiumEl.className = 'grid grid-cols-2 gap-3 max-w-sm mx-auto items-end pt-4 pb-2';
      podiumEl.innerHTML = podiumCard(rankedMembers[1], 2) + podiumCard(rankedMembers[0], 1);
    } else {
      podiumEl.className = 'grid grid-cols-3 gap-2 items-end pt-4 pb-2';
      podiumEl.innerHTML = podiumCard(rankedMembers[1], 2) + podiumCard(rankedMembers[0], 1) + podiumCard(rankedMembers[2], 3);
    }

    podiumEl.querySelectorAll('.podium-card').forEach(card => {
      card.onclick = () => {
        if (selectionState && selectionState.active) return;
        const uid = card.dataset.memberUid;
        if (uid) openMiniProfileSheet(uid);
      };
    });
  }

  // ----- "All Members" list: only members NOT already shown in the podium -----
  const podiumCount = Math.min(rankedMembers.length, 3);
  const restRanked = rankedMembers.slice(podiumCount);

  function rowHtml(member, rankNum, muted) {
    const isMe = state.user?.uid === member.uid;
    return `
      <div class="leaderboard-member-row inset-row flex items-center justify-between py-2.5 cursor-pointer hover:bg-white/[0.03] transition rounded-xl ${isMe ? 'bg-[#0A84FF]/10' : ''} ${muted ? 'opacity-60' : ''}" data-member-uid="${esc(member.uid)}">
        <div class="flex items-center gap-3 min-w-0 flex-1 mr-2">
          <span class="w-5 text-center font-mono font-bold text-xs shrink-0 ${rankNum && rankNum <= 3 ? 'text-amber-400' : 'text-neutral-500'}">${rankNum || '–'}</span>
          <div class="shrink-0">${renderAvatar(member, 'w-8 h-8')}</div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-xs text-white flex items-center gap-1.5 min-w-0">
              <span class="truncate shrink-0 max-w-[100px]">${esc(member.displayName || member.name || 'Member')}</span>
              ${isMe ? '<span class="text-[9px] px-1 rounded bg-[#0A84FF] text-white shrink-0">You</span>' : ''}
              <div class="badge-row-container flex items-center gap-1 min-w-0 flex-1 overflow-hidden" data-uid="${esc(member.uid)}"></div>
            </div>
            <div class="text-[10px] text-neutral-400">${taskCountOf(member.uid)} quotas</div>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-bold font-mono text-xs ${muted ? 'text-neutral-400' : 'text-amber-400'}">${member.periodPoints || 0} pts</div>
          <div class="text-[10px] text-neutral-500">${member.role || 'member'}</div>
        </div>
      </div>`;
  }

  let listHtml = restRanked.map((m, i) => rowHtml(m, podiumCount + 1 + i, false)).join('');
  if (unrankedMembers.length > 0) {
    listHtml += `<div class="pt-3 pb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">No points yet</div>`;
    listHtml += unrankedMembers.map(m => rowHtml(m, null, true)).join('');
  }
  listEl.innerHTML = listHtml;

  const listGroup = listEl.closest('.inset-group');
  if (listGroup) listGroup.classList.toggle('hidden', listHtml.trim() === '');

  listEl.querySelectorAll('.badge-row-container').forEach(c => {
    const uid = c.dataset.uid;
    const mem = usersMap.get(uid) || state.members.find(m => m.uid === uid);
    if (mem) renderBadgeRow(c, mem.badges, mem);
  });

  listEl.querySelectorAll('.leaderboard-member-row').forEach(row => {
    row.onclick = () => {
      if (selectionState && selectionState.active) return;
      const uid = row.dataset.memberUid;
      if (uid) openMiniProfileSheet(uid);
    };
  });
}

/* ==========================================================================
   UI RENDERING: NOTIFICATIONS (Task 6)
   ========================================================================== */
function updateNotificationBadges() {
  const badge = document.getElementById('header-unread-badge');
  const dockBadge = document.getElementById('dock-unread-badge');
  const dot = document.getElementById('tab-unread-dot');

  const unreadCount = state.notifications.filter(n => n.read === false || n.read === undefined).length;
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = badgeText;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (dockBadge) {
    if (unreadCount > 0) {
      dockBadge.textContent = badgeText;
      dockBadge.classList.remove('hidden');
    } else {
      dockBadge.classList.add('hidden');
    }
  }

  if (dot) {
    if (unreadCount > 0) {
      dot.classList.remove('hidden');
    } else {
      dot.classList.add('hidden');
    }
  }
}

/* ==========================================================================
   TASK 8: 50+ VECTOR SVG ICON LIBRARY (ZERO EMOJIS)
   ========================================================================== */

// EXACTLY 50 CURATED SVG ICONS (10 Media, 10 Tasks, 10 Rewards, 10 People, 10 System)
export const ICON_CATALOG = new Map([
  // 1. Media & Production (10 icons)
  ['camera', {
    category: 'media',
    label: 'Camera',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>'
  }],
  ['video', {
    category: 'media',
    label: 'Video',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>'
  }],
  ['mic', {
    category: 'media',
    label: 'Microphone',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>'
  }],
  ['waveform', {
    category: 'media',
    label: 'Waveform',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M2 10v4"></path><path d="M6 7v10"></path><path d="M10 4v16"></path><path d="M14 7v10"></path><path d="M18 10v4"></path><path d="M22 12v0"></path></svg>'
  }],
  ['tv', {
    category: 'media',
    label: 'Monitor / TV',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>'
  }],
  ['antenna', {
    category: 'media',
    label: 'Live Broadcast',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4.93 19.07a10 10 0 0 1 0-14.14"></path><path d="M7.76 16.24a6 6 0 0 1 0-8.48"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.48"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>'
  }],
  ['sliders', {
    category: 'media',
    label: 'Audio Mixer',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>'
  }],
  ['play', {
    category: 'media',
    label: 'Play Media',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
  }],
  ['headphones', {
    category: 'media',
    label: 'Headphones',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>'
  }],
  ['film', {
    category: 'media',
    label: 'Film Roll',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>'
  }],

  // 2. Tasks & Production Flow (10 icons)
  ['checklist', {
    category: 'tasks',
    label: 'Checklist',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>'
  }],
  ['clock', {
    category: 'tasks',
    label: 'Clock',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  }],
  ['hourglass', {
    category: 'tasks',
    label: 'Hourglass',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>'
  }],
  ['target', {
    category: 'tasks',
    label: 'Target',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'
  }],
  ['flag', {
    category: 'tasks',
    label: 'Milestone Flag',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>'
  }],
  ['clipboard', {
    category: 'tasks',
    label: 'Clipboard',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>'
  }],
  ['inbox', {
    category: 'tasks',
    label: 'Submissions Inbox',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>'
  }],
  ['upload', {
    category: 'tasks',
    label: 'Upload Work',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'
  }],
  ['folder', {
    category: 'tasks',
    label: 'Project Folder',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
  }],
  ['check-circle', {
    category: 'tasks',
    label: 'Completed',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
  }],

  // 3. Rewards & Achievements (10 icons)
  ['trophy', {
    category: 'rewards',
    label: 'Trophy',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1h12v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 4H6v7a6 6 0 0 0 12 0V4z"></path></svg>'
  }],
  ['medal', {
    category: 'rewards',
    label: 'Medal',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>'
  }],
  ['star', {
    category: 'rewards',
    label: 'Star',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
  }],
  ['sparkles', {
    category: 'rewards',
    label: 'Sparkles',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2.1 2.1M8.6 15.4l-2.1 2.1m11-2.1l-2.1-2.1M8.6 8.6L6.5 6.5"></path></svg>'
  }],
  ['flame', {
    category: 'rewards',
    label: 'Streak Fire',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>'
  }],
  ['crown', {
    category: 'rewards',
    label: 'Crown',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path></svg>'
  }],
  ['zap', {
    category: 'rewards',
    label: 'Lightning / Bonus',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'
  }],
  ['coins', {
    category: 'rewards',
    label: 'Points / Coins',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="8" cy="8" r="6"></circle><path d="M18.09 10.37A6 6 0 1 1 10.34 18"></path><path d="M7 6h1v4"></path><path d="M16.7 13.3l.6.6"></path></svg>'
  }],
  ['alert-triangle', {
    category: 'rewards',
    label: 'Penalty Alert',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
  }],
  ['slash-circle', {
    category: 'rewards',
    label: 'Deduction / Fine',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>'
  }],

  // 4. People & Membership (10 icons)
  ['user', {
    category: 'people',
    label: 'Member',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
  }],
  ['users', {
    category: 'people',
    label: 'Team Members',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
  }],
  ['badge', {
    category: 'people',
    label: 'Role Badge',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"></path></svg>'
  }],
  ['id', {
    category: 'people',
    label: 'ID Card',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="2"></rect><circle cx="8" cy="10" r="3"></circle><line x1="14" y1="8" x2="18" y2="8"></line><line x1="14" y1="12" x2="18" y2="12"></line><line x1="6" y1="17" x2="18" y2="17"></line></svg>'
  }],
  ['handshake', {
    category: 'people',
    label: 'Partnership',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 17a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2z"></path><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>'
  }],
  ['chat', {
    category: 'people',
    label: 'Chat Message',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
  }],
  ['smile', {
    category: 'people',
    label: 'Smile / Friendly',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>'
  }],
  ['shield', {
    category: 'people',
    label: 'Admin Shield',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>'
  }],
  ['key', {
    category: 'people',
    label: 'Access Key',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1.5-1.5L10 7M3 13a7 7 0 1 0 14 0 7 7 0 0 0-14 0z"></path></svg>'
  }],
  ['heart', {
    category: 'people',
    label: 'Gratitude',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
  }],

  // 5. System & Navigation (10 icons)
  ['bell', {
    category: 'system',
    label: 'Notification Bell',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>'
  }],
  ['calendar', {
    category: 'system',
    label: 'Calendar / Schedule',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
  }],
  ['compass', {
    category: 'system',
    label: 'Explore / Hub',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>'
  }],
  ['settings', {
    category: 'system',
    label: 'Settings',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
  }],
  ['layers', {
    category: 'system',
    label: 'Layers',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>'
  }],
  ['database', {
    category: 'system',
    label: 'Database',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>'
  }],
  ['refresh', {
    category: 'system',
    label: 'Sync / Refresh',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
  }],
  ['trash', {
    category: 'system',
    label: 'Trash / Purge',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
  }],
  ['link', {
    category: 'system',
    label: 'External Link',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
  }],
  ['info', {
    category: 'system',
    label: 'Info / Notice',
    svg: '<svg class="{CLASS}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  }]
]);

export const ICON_LIBRARY = Object.fromEntries(ICON_CATALOG);

export function getIconSvg(iconKey, className = 'w-5 h-5') {
  const item = ICON_CATALOG.get(iconKey) || ICON_LIBRARY[iconKey] || ICON_CATALOG.get('bell') || ICON_LIBRARY.bell;
  return item.svg.replace('{CLASS}', className);
}

export function openSubModal({ title = 'Select Icon', body, onClose }) {
  const overlay = document.getElementById('subModalOverlay');
  const titleEl = document.getElementById('sub-modal-title');
  const bodyEl = document.getElementById('sub-modal-body');
  const cancelBtn = document.getElementById('subModalCancelBtn') || document.getElementById('sub-modal-cancel');
  if (!overlay || !bodyEl) return;

  if (titleEl) titleEl.textContent = title;
  bodyEl.innerHTML = '';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof Node) {
    bodyEl.appendChild(body);
  }

  const cleanup = () => {
    closeSubModal();
    if (typeof onClose === 'function') onClose();
  };

  if (cancelBtn) cancelBtn.onclick = cleanup;
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup();
  };

  overlay.classList.remove('is-hidden');
}

export function closeSubModal() {
  const overlay = document.getElementById('subModalOverlay');
  if (overlay) {
    overlay.classList.add('is-hidden');
    const bodyEl = document.getElementById('sub-modal-body');
    if (bodyEl) bodyEl.innerHTML = '';
  }
}

export function openUnifiedIconPicker(param1, onSelectParam) {
  let selectedKey = 'bell';
  let onSelect = null;
  if (typeof param1 === 'object' && param1 !== null) {
    selectedKey = param1.selectedKey || 'bell';
    onSelect = param1.onSelect;
  } else if (typeof param1 === 'string') {
    selectedKey = param1;
    onSelect = onSelectParam;
  }

  const categories = [
    { id: 'media', label: 'Media' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'people', label: 'People' },
    { id: 'system', label: 'System' }
  ];

  let activeCategory = 'all';
  let searchQuery = '';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-3';

  bodyEl.innerHTML = `
    <div class="space-y-3">
      <input type="text" id="icon-picker-search" class="ios-input text-xs w-full text-white placeholder-neutral-500" placeholder="Search 50 curated SVG icons..." value="" />
      <div class="task-filter-bar flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
        <button type="button" class="btn-picker-cat px-2.5 py-1 rounded-full whitespace-nowrap bg-[#0A84FF] text-white font-bold" data-cat="all">All</button>
        ${categories.map(c => `
          <button type="button" class="btn-picker-cat px-2.5 py-1 rounded-full whitespace-nowrap bg-white/10 text-neutral-400" data-cat="${c.id}">${c.label}</button>
        `).join('')}
      </div>
      <div id="iconGridContainer" class="icon-picker-grid max-h-[300px] overflow-y-auto pr-1"></div>
    </div>
  `;

  function renderGridChunks() {
    const gridContainer = bodyEl.querySelector('#iconGridContainer');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const matchingKeys = Array.from(ICON_CATALOG.keys()).filter(key => {
      const item = ICON_CATALOG.get(key) || ICON_LIBRARY[key];
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchQuery = !searchQuery || key.toLowerCase().includes(searchQuery.toLowerCase()) || item.label.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    if (matchingKeys.length === 0) {
      gridContainer.innerHTML = '<div class="col-span-4 py-8 text-center text-xs text-neutral-400">No matching icons found</div>';
      return;
    }

    const CHUNK_SIZE = 15;
    let index = 0;

    function appendChunk() {
      const fragment = document.createDocumentFragment();
      const end = Math.min(index + CHUNK_SIZE, matchingKeys.length);
      for (; index < end; index++) {
        const key = matchingKeys[index];
        const item = ICON_CATALOG.get(key) || ICON_LIBRARY[key];
        const isSelected = key === selectedKey;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-picker-item ${isSelected ? 'selected' : ''}`;
        btn.dataset.iconKey = key;
        btn.title = item.label;
        btn.innerHTML = `
          ${getIconSvg(key, 'w-6 h-6 stroke-current')}
          <span class="text-[10px] text-neutral-300 truncate w-full text-center">${esc(item.label)}</span>
        `;
        btn.onclick = () => {
          if (typeof onSelect === 'function') onSelect(key);
          const previewEl = document.getElementById('badgeIconPreview') || document.getElementById('badge-icon-preview');
          if (previewEl) previewEl.innerHTML = getIconSvg(key, 'w-4 h-4');
          const nameEl = document.getElementById('badge-icon-name');
          if (nameEl) nameEl.textContent = key;
          closeSubModal();
        };
        fragment.appendChild(btn);
      }
      gridContainer.appendChild(fragment);
      if (index < matchingKeys.length) {
        requestAnimationFrame(appendChunk);
      }
    }
    appendChunk();
  }

  const searchInput = bodyEl.querySelector('#icon-picker-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value.trim();
      renderGridChunks();
    };
  }

  bodyEl.querySelectorAll('.btn-picker-cat').forEach(b => {
    b.onclick = () => {
      activeCategory = b.dataset.cat;
      bodyEl.querySelectorAll('.btn-picker-cat').forEach(btn => {
        const isActive = btn.dataset.cat === activeCategory;
        btn.className = `btn-picker-cat px-2.5 py-1 rounded-full whitespace-nowrap ${isActive ? 'bg-[#0A84FF] text-white font-bold' : 'bg-white/10 text-neutral-400'}`;
      });
      renderGridChunks();
    };
  });

  renderGridChunks();

  openSubModal({
    title: 'Select Icon',
    body: bodyEl
  });
}

export const openIconPicker = openUnifiedIconPicker;

function getSquircleColorClass(type) {
  if (type === 'reward' || type === 'bonus' || type === 'points' || type === 'attendance_approved') return 'notification-squircle-green';
  if (type === 'penalty' || type === 'fine' || type === 'revocation' || type === 'attendance_missed') return 'notification-squircle-red';
  if (type === 'warning' || type === 'attendance') return 'notification-squircle-amber';
  return 'notification-squircle-blue';
}

function renderNotifications() {
  const container = document.getElementById('notifications-container');
  if (!container) return;

  updateNotificationBadges();

  if (state.notifications.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-8 text-center text-xs text-neutral-400 space-y-2">
        <div class="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
          ${getIconSvg('bell', 'w-5 h-5 stroke-current')}
        </div>
        <p class="font-bold text-white text-sm">No Notifications Yet</p>
        <p class="text-[11px] text-neutral-400">You are completely caught up! New updates, task reviews, and broadcasts will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.notifications.map(n => {
    const isUnread = n.read === false || n.read === undefined;
    const timeFormatted = formatDateTime(n.timestamp || n.createdAt);
    const isSelected = selectionState.active && selectionState.type === 'notifications' && selectionState.selectedIds.has(n.id);
    const squircleClass = getSquircleColorClass(n.type);
    const iconSvg = getIconSvg(n.icon || n.type || 'bell', 'w-5 h-5 stroke-current');

    return `
      <div class="notification-card bulk-select-card ${isUnread ? 'unread border-l-4 border-l-[#0A84FF]' : 'read opacity-85'}${isSelected ? ' selected' : ''}" data-notif-id="${esc(n.id)}" data-bulk-id="${esc(n.id)}" role="button" tabindex="0">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content flex items-start gap-3 w-full min-w-0">
          <div class="notification-squircle ${squircleClass} shrink-0">
            ${iconSvg}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate">
                ${isUnread ? '<span class="w-1.5 h-1.5 rounded-full bg-[#0A84FF] shrink-0"></span>' : ''}
                <div class="font-bold text-white text-xs truncate">${esc(n.title)}</div>
              </div>
              <span class="text-[10px] text-neutral-400 flex-shrink-0 font-mono">${timeFormatted}</span>
            </div>
            <p class="text-neutral-300 text-xs line-clamp-2 mt-1">${esc(n.body || n.message || '')}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.notification-card').forEach(card => {
    card.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'notifications') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      const notif = state.notifications.find(x => x.id === card.dataset.notifId);
      if (notif) openNotificationDetailModal(notif);
    };

    attachLongPress(card, () => {
      enterSelectionMode('notifications', card.dataset.bulkId);
    });
  });
}

function openNotificationDetailModal(notif) {
  // Mark as read in Firestore
  if (!notif.read && state.user) {
    notif.read = true;
    try {
      if (notif.isBroadcast) {
        updateDoc(doc(db, 'notifications_broadcast', notif.id), {
          readBy: arrayUnion(state.user.uid)
        }).catch(err => console.warn('Error marking broadcast notification read:', err));
      } else {
        updateDoc(doc(db, 'notifications', notif.id), { read: true }).catch(err => {
          console.warn('Error marking notification read:', err);
        });
      }
    } catch (e) {
      console.warn('Mark as read exception:', e);
    }
    updateNotificationBadges();
    renderNotifications();
  }

  const timeFormatted = formatDateTime(notif.timestamp || notif.createdAt);
  const targetAction = notif.targetAction || null;
  const squircleClass = getSquircleColorClass(notif.type);
  const iconSvg = getIconSvg(notif.icon || notif.type || 'bell', 'w-6 h-6 stroke-current');

  let ctaBtnHtml = '';
  if (targetAction && targetAction.route) {
    let ctaLabel = 'View Details ➔';
    if (targetAction.route === 'profile') ctaLabel = 'Open Profile & Balance ➔';
    else if (targetAction.route === 'tasks') ctaLabel = 'View Task ➔';
    else if (targetAction.route === 'broadcast') ctaLabel = 'Open Broadcast ➔';
    else if (targetAction.route === 'attendance') ctaLabel = 'Go to Attendance ➔';

    ctaBtnHtml = `
      <button id="btn-notif-action-cta" class="w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white font-semibold transition text-xs shadow-md">
        ${esc(ctaLabel)}
      </button>
    `;
  }

  openModal({
    title: 'Notification Details',
    body: `
      <div class="space-y-4 text-xs">
        <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div class="notification-squircle ${squircleClass} !w-12 !h-12 !rounded-2xl shrink-0">
            ${iconSvg}
          </div>
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] uppercase font-mono tracking-wider text-[#0A84FF] font-bold">${esc(notif.type || 'Notice')}</span>
              <span class="text-[10px] text-neutral-400 font-mono">${timeFormatted}</span>
            </div>
            <h2 class="font-bold text-white text-sm leading-snug truncate">${esc(notif.title)}</h2>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-white/5 border border-white/10 text-neutral-200 leading-relaxed whitespace-pre-wrap">
          ${esc(notif.body || notif.message || '')}
        </div>

        <div class="pt-2 space-y-2">
          ${ctaBtnHtml}
          <button class="modal-close-btn w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition text-xs">
            Dismiss
          </button>
        </div>
      </div>
    `
  });

  const closeBtn = document.querySelector('.modal-close-btn');
  if (closeBtn) closeBtn.onclick = closeAllModals;

  const actionBtn = document.getElementById('btn-notif-action-cta');
  if (actionBtn && targetAction) {
    actionBtn.onclick = () => {
      closeAllModals();
      const route = targetAction.route;
      if (route === 'profile') {
        if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.goTo) {
          userPagerInstance.goTo('profile');
        } else {
          document.querySelector('#user-dock [data-page="profile"]')?.click();
        }
        if (targetAction.itemId === 'ledger') {
          setTimeout(() => {
            const txSec = document.getElementById('section-profile-transactions');
            const txList = document.getElementById('profile-transactions-list');
            if (txSec) {
              if (txList && txList.classList.contains('hidden')) {
                document.getElementById('btn-toggle-profile-transactions')?.click();
              }
              txSec.scrollIntoView({ behavior: 'smooth' });
            }
          }, 200);
        }
      } else if (route === 'tasks') {
        if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.goTo) {
          userPagerInstance.goTo('tasks');
        } else {
          document.querySelector('#user-dock [data-page="tasks"]')?.click();
        }
        if (targetAction.itemId) {
          setTimeout(() => {
            if (typeof openTaskDetailsModal === 'function') {
              openTaskDetailsModal(targetAction.itemId);
            }
          }, 250);
        }
      } else if (route === 'broadcast') {
        openBroadcastDetailModal(targetAction.itemId || null);
      } else if (route === 'attendance') {
        if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.goTo) {
          userPagerInstance.goTo('attendance');
        } else {
          document.querySelector('#user-dock [data-page="attendance"]')?.click();
        }
      }
    };
  }
}

async function markAllNotificationsRead() {
  if (!state.user) return;
  const unreads = (state.notifications || []).filter(n => !n.read);
  if (unreads.length === 0) {
    toast('All notifications are already marked as read', 'info');
    return;
  }

  try {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < unreads.length; i += CHUNK_SIZE) {
      const chunk = unreads.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(n => {
        if (n.isBroadcast) {
          batch.update(doc(db, 'notifications_broadcast', n.id), {
            readBy: arrayUnion(state.user.uid)
          });
        } else {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
        n.read = true;
      });
      await batch.commit();
    }
    updateNotificationBadges();
    renderNotifications();
    toast('All notifications marked as read', 'success');
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    toast(err.message || 'Failed to mark all as read', 'error');
  }
}

/* ==========================================================================
   UI RENDERING: PROFILE
   ========================================================================== */
function updateProfileUI() {
  const nameEl = document.getElementById('profile-view-name');
  const emailEl = document.getElementById('profile-view-email');
  const avatarEl = document.getElementById('profile-view-avatar');
  const roleEl = document.getElementById('profile-view-role');
  const streakEl = document.getElementById('profile-view-streak');

  const ptsEl = document.getElementById('profile-stat-points');
  const compEl = document.getElementById('profile-stat-completed');
  const penEl = document.getElementById('profile-stat-penalties');
  const rankEl = document.getElementById('profile-stat-rank');

  const guestCard = document.getElementById('drawer-guest-card');
  const userCard = document.getElementById('drawer-profile-card');

  if (state.user) {
    if (nameEl) nameEl.textContent = state.user.displayName;
    const emailToDisplay = state.userPrivate?.email || state.user.email || 'Verified Member';
    if (emailEl) emailEl.textContent = emailToDisplay;
    if (avatarEl && state.user.photoURL) avatarEl.src = state.user.photoURL;
    if (roleEl) roleEl.textContent = state.user.role.toUpperCase();
    if (streakEl) streakEl.textContent = `${state.user.streakDays || 0} Day Streak`;

    if (ptsEl) ptsEl.textContent = state.user.points || 0;
    const completedCount = state.submissions.filter(s => s.userId === state.user.uid).length;
    if (compEl) compEl.textContent = completedCount;
    if (penEl) penEl.textContent = `${state.user.penalties || 0} pts`;

    const sorted = [...state.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    const myRank = sorted.findIndex(m => m.uid === state.user.uid);
    if (rankEl) rankEl.textContent = myRank !== -1 ? `#${myRank + 1}` : '--';

    renderSettingsDrawer();

    renderProfileSubmissions();
    renderProfileAttendance();
    renderProfileTransactions();
  } else {
    if (nameEl) nameEl.textContent = 'Guest User';
    if (emailEl) emailEl.textContent = 'Read-Only Mode';
    if (avatarEl) avatarEl.src = './image_ad59c0.jpg';
    if (roleEl) roleEl.textContent = 'GUEST';
    if (streakEl) streakEl.textContent = '0 Days';

    if (ptsEl) ptsEl.textContent = '0';
    if (compEl) compEl.textContent = '0';
    if (penEl) penEl.textContent = '0';
    if (rankEl) rankEl.textContent = '--';

    if (guestCard) guestCard.classList.remove('hidden');
    if (userCard) userCard.classList.add('hidden');
    renderProfileSubmissions();
    renderProfileAttendance();
    renderProfileTransactions();
  }

  updateHeroStats();
  updatePushNotificationUI();
}

function renderProfileSubmissions() {
  const container = document.getElementById('profile-submissions-list');
  if (!container || !state.user) return;

  const mySubs = state.mySubmissions || [];
  if (mySubs.length === 0) {
    container.innerHTML = '<p class="text-xs text-neutral-400 py-3 text-center">No submissions yet.</p>';
    return;
  }

  container.innerHTML = mySubs.map(s => `
    <div class="inset-row flex items-center justify-between text-xs py-2.5">
      <div class="min-w-0 flex-1 pr-2">
        <div class="font-semibold text-white truncate">${esc(s.taskTitle)}</div>
        <div class="text-[10px] text-neutral-400">${s.submittedAt ? formatDateTime(s.submittedAt) : 'Recent'}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="font-bold font-mono text-emerald-400">+${s.pointsAwarded || 5} pts</span>
      </div>
    </div>
  `).join('');
}

function updateHeroStats() {
  const greetingEl = document.getElementById('hero-greeting');
  if (greetingEl) {
    if (state.user?.displayName) {
      const firstName = state.user.displayName.trim().split(' ')[0];
      greetingEl.textContent = `Welcome back, ${firstName}`;
    } else {
      greetingEl.textContent = 'Welcome to COC Media Hub';
    }
  }

  const activeCountEl = document.getElementById('stat-active-tasks-count');
  const compCountEl = document.getElementById('stat-completed-today-count');
  const userPtsEl = document.getElementById('stat-user-points');

  if (activeCountEl) activeCountEl.textContent = state.tasks.filter(t => t.active && !t.archived).length;
  if (compCountEl) {
    const todayKey = formatZonedDateKey(serverNow(), APP_TIMEZONE);
    const completedToday = state.submissions.filter(s => {
      if (!s.submittedAt) return false;
      const subUid = s.uid || s.userId;
      if (subUid !== state.user?.uid) return false;
      const ms = s.submittedAt.toMillis ? s.submittedAt.toMillis() : (s.submittedAt.seconds ? s.submittedAt.seconds * 1000 : Number(new Date(s.submittedAt)));
      if (!ms || isNaN(ms)) return false;
      return formatZonedDateKey(ms, APP_TIMEZONE) === todayKey;
    }).length;
    compCountEl.textContent = completedToday;
  }
  if (userPtsEl) userPtsEl.textContent = state.user?.points || 0;

  updateActivityRings();
  renderHomeDueTasks();
}

function updateActivityRings() {
  const ringPts = document.getElementById('ring-points');
  const ringQuotas = document.getElementById('ring-quotas');
  const ringPen = document.getElementById('ring-penalties');
  const centerPts = document.getElementById('ring-center-pts');
  const legPts = document.getElementById('ring-legend-points');
  const legQuotas = document.getElementById('ring-legend-quotas');
  const legPen = document.getElementById('ring-legend-penalties');

  const userPts = state.user?.points || 0;
  const userPen = state.user?.penalties || 0;

  const activeCount = state.tasks.filter(t => t.active && !t.archived).length;
  const todayKey = formatZonedDateKey(serverNow(), APP_TIMEZONE);
  const completedToday = state.submissions.filter(s => {
    if (!s.submittedAt) return false;
    const subUid = s.uid || s.userId;
    if (subUid !== state.user?.uid) return false;
    const ms = s.submittedAt.toMillis ? s.submittedAt.toMillis() : (s.submittedAt.seconds ? s.submittedAt.seconds * 1000 : Number(new Date(s.submittedAt)));
    if (!ms || isNaN(ms)) return false;
    return formatZonedDateKey(ms, APP_TIMEZONE) === todayKey;
  }).length;

  // 1. Points Ring (circumference 251.32)
  const ptsGoal = 50;
  const ptsProgress = Math.min(userPts / ptsGoal, 1);
  const ptsOffset = 251.32 * (1 - ptsProgress);
  if (ringPts) ringPts.style.strokeDashoffset = ptsOffset;

  // 2. Quotas Ring (circumference 188.49)
  const quotasGoal = Math.max(activeCount, 1);
  const quotasProgress = Math.min(completedToday / quotasGoal, 1);
  const quotasOffset = 188.49 * (1 - quotasProgress);
  if (ringQuotas) ringQuotas.style.strokeDashoffset = quotasOffset;

  // 3. Penalties Ring (circumference 125.66)
  const penProgress = userPen === 0 ? 1 : Math.max(0, 1 - (userPen / 50));
  const penOffset = 125.66 * (1 - penProgress);
  if (ringPen) ringPen.style.strokeDashoffset = penOffset;

  if (centerPts) centerPts.textContent = userPts;
  if (legPts) legPts.textContent = `${userPts} pts`;
  if (legQuotas) legQuotas.textContent = `${completedToday}/${activeCount}`;
  const cachedFineSum = (state.user?.uid && egpAggregateCache.get(state.user.uid)?.fineSum) || 0;
  const adminAdj = state.user?.uid ? (usersPrivate.get(state.user.uid)?.finesEGP || 0) : 0;
  const userFines = adminAdj + cachedFineSum;
  if (legPen) legPen.textContent = `${userFines} EGP`;
}

function renderHomeDueTasks() {
  const container = document.getElementById('home-due-tasks-list');
  if (!container) return;

  const now = serverNow();
  const activeTasks = state.tasks.filter(t => t.active && !t.archived);

  // Filter tasks that are open/due today
  const dueTasks = activeTasks.filter(task => {
    try {
      const windowInfo = getTaskWindow(task, now);
      return windowInfo && windowInfo.isOpen;
    } catch {
      return true;
    }
  });

  // Filter out tasks the user has already submitted for this occurrence
  const pendingDue = dueTasks.filter(task => {
    if (!state.user) return true;
    const occ = getOccurrenceFor(task, now);
    const hasSubmitted = state.submissions.some(s => {
      if (s.userId !== state.user.uid || s.taskId !== task.id) return false;
      if (occ && s.occurrenceKey) return s.occurrenceKey === occ;
      return true;
    });
    return !hasSubmitted;
  });

  if (pendingDue.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-4 text-center space-y-1.5 border border-emerald-500/20 bg-emerald-500/5">
        <div class="w-8 h-8 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <svg class="w-4 h-4 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="text-xs font-semibold text-white">All Caught Up for Today!</div>
        <p class="text-[11px] text-neutral-400">You have completed all scheduled tasks due in this window.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingDue.map(task => {
    const cat = state.categories.find(c => c.id === task.categoryId || c.id === task.category) || {
      name: task.category || 'General',
      color: '#0A84FF'
    };
    const catName = cat.name || cat.nameEn || 'Task';
    const catColor = cat.color || '#0A84FF';

    return `
      <div class="glass-card p-3 flex items-center justify-between gap-3 border-l-4" style="border-left-color: ${catColor}">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded" style="background-color: ${catColor}20; color: ${catColor}">
              ${esc(catName)}
            </span>
            <span class="text-[10px] text-amber-400 font-mono font-bold">+${task.points || 5} pts</span>
          </div>
          <h4 class="font-semibold text-xs text-white truncate">${esc(task.title)}</h4>
          <p class="text-[10px] text-neutral-400 truncate">${esc(task.description || 'Complete quota and submit proof.')}</p>
        </div>
        <button type="button" class="btn-home-submit-task px-3 py-1.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white text-xs font-semibold flex-shrink-0 shadow-sm transition" data-task-id="${esc(task.id)}">
          Submit
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-home-submit-task').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tid = btn.getAttribute('data-task-id');
      if (tid) openTaskDetailsModal(tid);
    };
  });
}

/* ==========================================================================
   ADMIN CONTROLLER & OPERATIONS
   ========================================================================== */
function openCategoryModal(categoryId = null) {
  state.editingCategoryId = categoryId;
  const existingCat = categoryId ? state.categories.find(c => c.id === categoryId) : null;

  let currentName = existingCat ? (existingCat.name || existingCat.nameEn || '') : '';
  let currentColor = existingCat ? (existingCat.color || '#0A84FF') : '#0A84FF';
  let currentIconKey = existingCat ? (existingCat.iconKey || existingCat.icon || 'film') : 'film';
  let isDirty = false;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4';

  function renderCategoryModalContent() {
    bodyEl.innerHTML = `
      <div>
        <label class="block text-xs font-semibold text-neutral-200 mb-1">Category Name *</label>
        <input id="cat-modal-name" type="text" class="w-full glass-input text-xs" placeholder="e.g. Photography" value="${esc(currentName)}" />
      </div>

      <div>
        <label class="block text-xs font-semibold text-neutral-200 mb-1.5">Color Theme</label>
        <div class="flex items-center gap-2 overflow-x-auto pb-1" id="cat-color-swatches">
          ${CATEGORY_COLORS.map(c => `
            <button type="button" class="cat-color-swatch-btn w-7 h-7 rounded-full border-2 transition flex-shrink-0 ${currentColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-80 hover:opacity-100'}" style="background-color: ${c};" data-color="${c}"></button>
          `).join('')}
          <div class="relative w-7 h-7 rounded-full overflow-hidden border border-white/20 flex-shrink-0 flex items-center justify-center cursor-pointer" title="Custom Color">
            <input id="cat-modal-custom-color" type="color" value="${currentColor}" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            <svg class="w-3.5 h-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 14 14"></polyline></svg>
          </div>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-neutral-200 mb-1.5">Choose Icon (${Object.keys(CATEGORY_ICONS).length} Icons)</label>
        <div class="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1.5 rounded-xl bg-black/20 border border-white/10" id="cat-icon-grid">
          ${Object.keys(CATEGORY_ICONS).map(iconKey => `
            <button type="button" class="cat-icon-grid-btn p-2 rounded-xl flex items-center justify-center border transition ${currentIconKey === iconKey ? 'border-[#0A84FF] bg-[#0A84FF]/25 text-[#0A84FF] ring-2 ring-[#0A84FF]/40 scale-105' : 'border-white/5 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'}" data-icon-key="${iconKey}" title="${iconKey}">
              ${getCategorySvg(iconKey, 'w-5 h-5')}
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-neutral-200 mb-1.5">Live Preview</label>
        <div id="cat-modal-preview" class="flex items-center gap-2 p-3 rounded-xl border transition" style="background-color: ${currentColor}20; border-color: ${currentColor}40; color: ${currentColor};">
          <span id="cat-modal-preview-icon">${getCategorySvg(currentIconKey, 'w-5 h-5')}</span>
          <span id="cat-modal-preview-label" class="font-bold text-xs">${esc(currentName) || 'Category Name Preview'}</span>
        </div>
      </div>
    `;

    const nameInput = bodyEl.querySelector('#cat-modal-name');
    if (nameInput) nameInput.oninput = (e) => {
      currentName = e.target.value;
      isDirty = true;
      const previewLabel = bodyEl.querySelector('#cat-modal-preview-label');
      if (previewLabel) previewLabel.textContent = currentName || 'Category Name Preview';
    };

    bodyEl.querySelectorAll('.cat-color-swatch-btn').forEach(btn => {
      btn.onclick = () => {
        currentColor = btn.dataset.color;
        isDirty = true;
        updatePreviewStyles();
        bodyEl.querySelectorAll('.cat-color-swatch-btn').forEach(b => {
          if (b.dataset.color === currentColor) {
            b.classList.add('border-white', 'scale-110');
            b.classList.remove('border-transparent');
          } else {
            b.classList.remove('border-white', 'scale-110');
            b.classList.add('border-transparent');
          }
        });
      };
    });

    const customColorInput = bodyEl.querySelector('#cat-modal-custom-color');
    if (customColorInput) {
      customColorInput.oninput = (e) => {
        currentColor = e.target.value;
        isDirty = true;
        updatePreviewStyles();
      };
    }

    bodyEl.querySelectorAll('.cat-icon-grid-btn').forEach(btn => {
      btn.onclick = () => {
        currentIconKey = btn.dataset.iconKey;
        isDirty = true;
        bodyEl.querySelectorAll('.cat-icon-grid-btn').forEach(b => {
          if (b.dataset.iconKey === currentIconKey) {
            b.className = 'cat-icon-grid-btn p-2 rounded-xl flex items-center justify-center border transition border-[#0A84FF] bg-[#0A84FF]/25 text-[#0A84FF] ring-2 ring-[#0A84FF]/40 scale-105';
          } else {
            b.className = 'cat-icon-grid-btn p-2 rounded-xl flex items-center justify-center border transition border-white/5 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10';
          }
        });
        const previewIcon = bodyEl.querySelector('#cat-modal-preview-icon');
        if (previewIcon) previewIcon.innerHTML = getCategorySvg(currentIconKey, 'w-5 h-5');
      };
    });

    function updatePreviewStyles() {
      const previewEl = bodyEl.querySelector('#cat-modal-preview');
      if (previewEl) {
        previewEl.style.backgroundColor = `${currentColor}20`;
        previewEl.style.borderColor = `${currentColor}40`;
        previewEl.style.color = currentColor;
      }
    }
  }

  renderCategoryModalContent();

  openModal({
    title: existingCat ? 'Edit Category' : 'New Category',
    body: bodyEl,
    saveLabel: existingCat ? 'Save Changes' : 'Create Category',
    isDirty: () => isDirty,
    onClose: () => {
      state.editingCategoryId = null;
    },
    onSave: async () => {
      const trimmed = currentName.trim();
      if (!trimmed) {
        toast('Category name is required', 'error');
        return false;
      }

      const payload = {
        name: trimmed,
        nameEn: trimmed,
        iconKey: currentIconKey,
        icon: currentIconKey,
        color: currentColor,
        archived: false
      };

      try {
        if (state.editingCategoryId) {
          await updateDoc(doc(db, 'categories', state.editingCategoryId), {
            ...payload,
            updatedAt: serverTimestamp()
          });
          toast('Category updated', 'success');
        } else {
          await addDoc(collection(db, 'categories'), {
            ...payload,
            createdAt: serverTimestamp()
          });
          toast('Category created', 'success');
        }
        state.editingCategoryId = null;
        return true;
      } catch (err) {
        console.error('Failed to save category:', err);
        toast(err.message || 'Failed to save category', 'error');
        return false;
      }
    }
  });
}

function renderAdminCategories() {
  const list = document.getElementById('admin-categories-list');
  if (!list) return;

  const isArchivedView = state.adminCatsFilter === 'archived';
  const filtered = state.categories.filter(c => isArchivedView ? c.archived : !c.archived);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="glass-card p-6 text-center text-xs text-neutral-400">No ${isArchivedView ? 'archived' : 'active'} categories found.</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const taskCount = state.tasks.filter(t => (t.categoryId === c.id || t.category === c.id) && !t.archived).length;
    const isSelected = selectionState.active && selectionState.type === 'categories' && selectionState.selectedIds.has(c.id);

    return `
      <div class="glass-card bulk-select-card p-3 flex items-center justify-between text-xs${isSelected ? ' selected' : ''}" data-cat-id="${esc(c.id)}" data-bulk-id="${esc(c.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content flex items-center justify-between w-full">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${c.color}25; color: ${c.color}; border: 1px solid ${c.color}40;">
              ${getCategorySvg(c.iconKey, 'w-4 h-4')}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-white truncate">${esc(c.name)}</div>
              <div class="text-[10px] text-neutral-400">${taskCount} active tasks</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${isArchivedView ? `
              <button type="button" class="btn-restore-cat text-xs text-emerald-400 px-2 py-1 hover:underline" data-cat-id="${esc(c.id)}">Restore</button>
            ` : `
              <button type="button" class="btn-edit-cat text-xs text-[#0A84FF] px-2 py-1 hover:underline" data-cat-id="${esc(c.id)}">Edit</button>
              <button type="button" class="btn-archive-cat text-xs text-amber-400 px-2 py-1 hover:underline" data-cat-id="${esc(c.id)}">Archive</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.glass-card').forEach(card => {
    card.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'categories') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
    };

    attachLongPress(card, () => {
      enterSelectionMode('categories', card.dataset.bulkId);
    });
  });

  list.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'categories') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      openCategoryModal(btn.dataset.catId);
    };
  });

  list.querySelectorAll('.btn-archive-cat').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'categories') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const cat = state.categories.find(c => c.id === btn.dataset.catId);
      if (!cat) return;
      const count = state.tasks.filter(t => (t.categoryId === cat.id || t.category === cat.id) && !t.archived).length;
      const confirmed = await confirmSheet({
        title: 'Archive Category',
        message: `Are you sure you want to archive "${cat.name}"? ${count} active task(s) currently use this category.`,
        confirmLabel: 'Archive',
        destructive: true
      });
      if (confirmed) {
        await updateDoc(doc(db, 'categories', cat.id), { archived: true, updatedAt: serverTimestamp() });
        toast('Category archived', 'info');
      }
    };
  });

  list.querySelectorAll('.btn-restore-cat').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'categories') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      await updateDoc(doc(db, 'categories', btn.dataset.catId), { archived: false, updatedAt: serverTimestamp() });
      toast('Category restored', 'success');
    };
  });
}

/* ==========================================================================
   ADMIN TASKS RENDERER & COMPATIBILITY ALIASES
   ========================================================================== */
export function renderAdminTasks() {
  const tbody = document.getElementById('admin-tasks-tbody');
  if (!tbody) return;

  const isArchivedView = state.adminTasksFilter === 'archived';
  const filtered = (state.tasks || []).filter(t => isArchivedView ? t.archived : !t.archived);

  if (filtered.length === 0) {
    tbody.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400">No ${isArchivedView ? 'archived' : 'active'} tasks found.</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const cat = (state.categories || []).find(c => c.id === t.categoryId || c.id === t.category) || { name: 'General', color: '#0A84FF', iconKey: 'film' };
    const isSelected = selectionState.active && selectionState.type === 'admin_tasks' && selectionState.selectedIds.has(t.id);
    return `
      <div class="inset-row bulk-select-card flex items-center justify-between py-2 text-xs${isSelected ? ' selected' : ''}" data-task-id="${esc(t.id)}" data-bulk-id="${esc(t.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content flex items-center justify-between w-full">
          <div class="min-w-0 flex-1 pr-2">
            <div class="font-semibold text-white truncate">${esc(t.title)}</div>
            <div class="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
              <span class="inline-flex items-center gap-1" style="color: ${cat.color};">
                ${getCategorySvg(cat.iconKey, 'w-3 h-3')}
                <span>${esc(cat.name)}</span>
              </span>
              <span>•</span>
              <span class="font-mono text-amber-400 font-bold">${t.points} pts</span>
              <span>•</span>
              <span>${t.isPermanent ? 'Permanent' : (t.schedule?.type || 'once')}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            ${isArchivedView ? `
              <button type="button" class="btn-admin-restore-task text-xs text-emerald-400 px-2 py-1 hover:underline" data-task-id="${esc(t.id)}">Restore</button>
              <button type="button" class="btn-admin-delete-task text-xs text-rose-400 px-2 py-1 hover:underline" data-task-id="${esc(t.id)}">Delete permanently</button>
            ` : `
              <button type="button" class="btn-admin-edit-task text-xs text-[#0A84FF] px-2 py-1 hover:underline" data-task-id="${esc(t.id)}">Edit</button>
              <button type="button" class="btn-admin-archive-task text-xs text-amber-400 px-2 py-1 hover:underline" data-task-id="${esc(t.id)}">Archive</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  tbody.querySelectorAll('.inset-row').forEach(row => {
    row.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'admin_tasks') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
    };

    attachLongPress(row, () => {
      enterSelectionMode('admin_tasks', row.dataset.bulkId);
    });
  });

  tbody.querySelectorAll('.btn-admin-edit-task').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'admin_tasks') {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest('.bulk-select-card');
        if (row) toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      openAdminTaskModal(btn.dataset.taskId);
    };
  });

  tbody.querySelectorAll('.btn-admin-archive-task').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'admin_tasks') {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest('.bulk-select-card');
        if (row) toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const task = (state.tasks || []).find(t => t.id === btn.dataset.taskId);
      if (!task) return;
      const confirm = await confirmSheet({
        title: 'Archive Task',
        message: `Are you sure you want to archive "${task.title}"? It will be hidden from members.`,
        confirmLabel: 'Archive',
        destructive: true
      });
      if (confirm) {
        await updateDoc(doc(db, 'tasks', task.id), { archived: true, updatedAt: serverTimestamp() });
        toast('Task archived', 'info');
      }
    };
  });

  tbody.querySelectorAll('.btn-admin-restore-task').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'admin_tasks') {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest('.bulk-select-card');
        if (row) toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      await updateDoc(doc(db, 'tasks', btn.dataset.taskId), { archived: false, updatedAt: serverTimestamp() });
      toast('Task restored', 'success');
    };
  });

  tbody.querySelectorAll('.btn-admin-delete-task').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'admin_tasks') {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest('.bulk-select-card');
        if (row) toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const task = (state.tasks || []).find(t => t.id === btn.dataset.taskId);
      const confirm = await confirmSheet({
        title: 'Delete Task Permanently',
        message: `Are you sure you want to permanently delete "${task ? task.title : 'this task'}"? This action cannot be undone.`,
        confirmLabel: 'Delete Permanently',
        destructive: true
      });
      if (confirm) {
        await deleteDoc(doc(db, 'tasks', btn.dataset.taskId));
        toast('Task permanently deleted', 'info');
      }
    };
  });
}

export function renderTasksView() {
  return renderTasks();
}

export function renderBroadcastBanner() {
  return renderHomeBroadcastBanner();
}

export function renderSubmissionsInspector() {
  return renderAdminSubmissions();
}

export function closeModal() {
  return closeAllModals();
}

export function renderMembersAdmin() {
  return renderAdminMembers();
}

export function renderAttendance() {
  renderAttendanceView();
  renderAttendanceLogs();
}

export function openBadgePickerSheet({ onSelect }) {
  const presets = typeof PRESET_BADGES !== 'undefined' ? PRESET_BADGES : [];
  const items = presets.map(b => ({
    id: b.id,
    label: b.label,
    icon: b.icon,
    color: b.color,
    badge: b
  }));
  openItemPicker({
    title: 'Select Badge',
    items,
    selectedId: null,
    onSelect: (item) => {
      if (typeof onSelect === 'function') onSelect(item.badge || item);
    }
  });
}

function openAdminTaskModal(taskId = null) {
  state.editingTaskId = taskId;
  const task = taskId ? state.tasks.find(t => t.id === taskId) : null;

  let currentTitle = task ? task.title : '';
  let currentDesc = task ? task.description : '';
  let currentCategoryId = task ? (task.categoryId || task.category || (state.categories[0]?.id || '')) : (state.categories[0]?.id || '');
  let currentPoints = task ? (task.points !== undefined ? String(task.points) : '') : '';
  let currentLink = task ? (task.link || '') : '';
  let currentClaimPolicy = task ? (task.claimPolicy || 'once_per_cycle') : 'once_per_cycle';
  let currentIsPermanent = task ? Boolean(task.isPermanent) : false;

  // Normalized tiers & schedule
  const normTiers = normalizeTaskTiers(task || {});
  let sched = normalizeScheduleObject(task?.schedule || task || { type: 'once', startDateTime: Date.now() });
  let schedType = sched.type || 'once';
  let schedStartMs = parseDateTimeToMs(sched.startDateTime) || Date.now();
  let schedParts = getZonedParts(schedStartMs, APP_TIMEZONE);

  const pad2 = n => String(n).padStart(2, '0');
  let selectedDateStr = `${schedParts.year}-${pad2(schedParts.month)}-${pad2(schedParts.day)}`;
  let selectedTimeStr = `${pad2(schedParts.hour)}:${pad2(schedParts.minute)}`;

  const toDateStr = ms => {
    const p = getZonedParts(ms, APP_TIMEZONE);
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  };
  const toTimeStr = ms => {
    const p = getZonedParts(ms, APP_TIMEZONE);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
  };
  const dtToMs = (dStr, tStr) => {
    const [y, mo, d] = String(dStr || '').split('-').map(Number);
    const [h, mi] = String(tStr || '').split(':').map(Number);
    return zonedDateToMs(y, mo, d, h || 0, mi || 0, 0, APP_TIMEZONE);
  };

  // Deadline state (absolute date + time, relative to the first occurrence start)
  const currentDurationMinutes = normTiers.durationMinutes || 1440;
  let deadlineDateStr = toDateStr(schedStartMs + currentDurationMinutes * 60000);
  let deadlineTimeStr = toTimeStr(schedStartMs + currentDurationMinutes * 60000);

  // Tier 1: Early Bonus
  let earlyBonusEnabled = Boolean(normTiers.earlyBonus.enabled);
  let earlyBonusPoints = normTiers.earlyBonus.points || 15;
  const earlyMins = normTiers.earlyBonus.untilMinutes > 0 ? normTiers.earlyBonus.untilMinutes : Math.max(1, Math.round(currentDurationMinutes / 2));
  let earlyBonusDateStr = toDateStr(schedStartMs + earlyMins * 60000);
  let earlyBonusTimeStr = toTimeStr(schedStartMs + earlyMins * 60000);

  // Tier 2: Grace Period (NO grace points)
  let graceEnabled = Boolean(normTiers.grace.enabled);
  const graceMins = normTiers.grace.untilMinutes > 0 ? normTiers.grace.untilMinutes : currentDurationMinutes + 1440;
  let graceDateStr = toDateStr(schedStartMs + graceMins * 60000);
  let graceTimeStr = toTimeStr(schedStartMs + graceMins * 60000);

  // Tier 3: Missed Penalty
  let missedPenaltyEnabled = Boolean(normTiers.missedPenalty.enabled);
  let missedPenaltyPoints = normTiers.missedPenalty.points || 5;

  // Recurrence schedule sets
  let weeklyDays = new Set(Array.isArray(sched.days) ? sched.days : ['Sat', 'Sun']);
  let monthlyDates = new Set(Array.isArray(sched.dates) ? sched.dates.map(Number).filter(n => n >= 1 && n <= 31) : [1]);
  let monthlyLastDay = sched.lastDay === true;
  if (monthlyLastDay) monthlyDates.delete(31);
  let monthlyWeeks = new Set(Array.isArray(sched.weeks) ? sched.weeks : ['1st']);
  let monthlyWeekdays = new Set(Array.isArray(sched.weekdays) ? sched.weekdays : ['Sat']);

  // Questions with type ('short' | 'long' | 'mcq'), options, allowOther
  let currentQuestions = (Array.isArray(task?.questions) ? task.questions : []).map(q => ({
    id: q.id || ('q_' + Math.random().toString(36).slice(2, 7)),
    questionText: q.questionText || '',
    type: q.type || 'short',
    isRequired: Boolean(q.isRequired),
    options: Array.isArray(q.options) && q.options.length >= 2 ? JSON.parse(JSON.stringify(q.options)) : [
      { id: 'opt_1', label: 'Option 1' },
      { id: 'opt_2', label: 'Option 2' }
    ],
    allowOther: Boolean(q.allowOther)
  }));

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4 text-xs';

  function formatTimeDisplayWords(hour, min) {
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h12}:${pad2(min)} ${ampm}`;
  }

  function renderContent() {
    bodyEl.innerHTML = `
      <div class="space-y-3.5">
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Task Title *</label>
          <input id="adm-task-title" type="text" class="w-full glass-input text-xs" placeholder="e.g. Sunday Service Video Edit" value="${esc(currentTitle)}" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Description *</label>
          <textarea id="adm-task-desc" rows="3" class="w-full glass-input text-xs leading-relaxed" placeholder="Detailed requirements and deliverables...">${esc(currentDesc)}</textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-neutral-200 mb-1">Category</label>
            <div id="adm-task-category-picker-wrap">
     <button type="button" id="btn-pick-task-category" class="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-between text-xs hover:bg-white/10 transition">
       <span id="btn-pick-task-category-label">Select Category</span>
       <svg class="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
     </button>
     <input type="hidden" id="adm-task-category" value="" />
   </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-neutral-200 mb-1">On-Time Points</label>
            <input id="adm-task-points" type="number" min="1" placeholder="5" class="w-full glass-input text-xs font-mono" value="${esc(currentPoints)}" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Task Link URL (Optional)</label>
          <input id="adm-task-link" type="url" class="w-full glass-input text-xs font-mono" placeholder="https://..." value="${esc(currentLink)}" />
        </div>

        <!-- Points Claim Policy Card -->
        <div class="ios-card space-y-2" style="margin-bottom:0">
          <div class="text-xs font-bold text-white uppercase tracking-wider">Points Claim Policy</div>
          <p id="adm-claim-hint" class="text-[11px] text-neutral-400"></p>
          <div id="mount-task-claim-policy"></div>
        </div>

        <!-- Schedule / Recurrence Card (hidden for one-time milestones) -->
        <div id="adm-recurrence-card" class="ios-card space-y-3 ${currentClaimPolicy === 'milestone' ? 'hidden' : ''}" style="margin-bottom:0">
          <div class="text-xs font-bold text-white uppercase tracking-wider">Recurrence &amp; Schedule</div>
          <div>
            <label class="block text-xs text-neutral-300 mb-1">Schedule Type</label>
            <div id="adm-task-sched-type-wrap"></div>
          </div>
          <div id="adm-sched-subform" class="space-y-3 pt-1"></div>
        </div>

        <!-- Permanent Task Switch Card -->
        <div class="ios-card space-y-2" style="margin-bottom:0">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-white">Permanent Task</span>
              <p class="text-[11px] text-neutral-400">Permanent tasks never close and have no deadlines or tiers</p>
            </div>
            <div id="mount-switch-permanent"></div>
          </div>
        </div>

        <!-- Deadlines & Tiers Container (Hidden if Permanent Task is ON) -->
        <div id="adm-nonpermanent-container" class="${currentIsPermanent ? 'hidden' : ''} space-y-3.5">
          <div class="ios-card space-y-3" style="margin-bottom:0">
            <div class="text-xs font-bold text-white uppercase tracking-wider">Task Deadline</div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] text-neutral-300 mb-1">Deadline Date</label>
                <input id="adm-dl-date" type="date" class="ios-input" value="${deadlineDateStr}" />
              </div>
              <div>
                <label class="block text-[11px] text-neutral-300 mb-1">Deadline Time</label>
                <input id="adm-dl-time" type="time" class="ios-input" value="${deadlineTimeStr}" />
              </div>
            </div>
            <div id="adm-deadline-words" class="hidden"></div>
          </div>

          <!-- Tier 1: Early Bonus Card -->
          <div class="ios-card space-y-3" style="margin-bottom:0">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-white">Early Bonus</span>
                <p class="text-[11px] text-neutral-400">Award extra points for finishing before deadline</p>
              </div>
              <div id="mount-switch-early"></div>
            </div>
            <div id="adm-early-container" class="${earlyBonusEnabled ? '' : 'hidden'} space-y-2.5 pt-2 border-t border-white/10">
              <div>
                <label class="block text-[11px] text-neutral-300 mb-1">Early Points</label>
                <input id="adm-early-pts" type="number" inputmode="numeric" min="1" class="ios-input font-mono" value="${earlyBonusPoints}" placeholder="15" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] text-neutral-300 mb-1">Bonus Ends Date</label>
                  <input id="adm-early-date" type="date" class="ios-input" value="${earlyBonusDateStr}" />
                </div>
                <div>
                  <label class="block text-[11px] text-neutral-300 mb-1">Bonus Ends Time</label>
                  <input id="adm-early-time" type="time" class="ios-input" value="${earlyBonusTimeStr}" />
                </div>
              </div>
              <div id="adm-early-words" class="hidden"></div>
            </div>
          </div>

          <!-- Tier 2: Grace Period Card (NO grace points) -->
          <div class="ios-card space-y-3" style="margin-bottom:0">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-white">Grace Period</span>
                <p class="text-[11px] text-neutral-400">Allow standard submissions past deadline</p>
              </div>
              <div id="mount-switch-grace"></div>
            </div>
            <div id="adm-grace-container" class="${graceEnabled ? '' : 'hidden'} space-y-2.5 pt-2 border-t border-white/10">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] text-neutral-300 mb-1">Grace Cutoff Date</label>
                  <input id="adm-grace-date" type="date" class="ios-input" value="${graceDateStr}" />
                </div>
                <div>
                  <label class="block text-[11px] text-neutral-300 mb-1">Grace Cutoff Time</label>
                  <input id="adm-grace-time" type="time" class="ios-input" value="${graceTimeStr}" />
                </div>
              </div>
              <div id="adm-grace-words" class="hidden"></div>
            </div>
          </div>

          <!-- Tier 3: Missed-Deadline Penalty Card -->
          <div class="ios-card space-y-3" style="margin-bottom:0">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-white">Missed-Deadline Penalty</span>
                <p class="text-[11px] text-neutral-400">Penalize unexcused members after grace period</p>
              </div>
              <div id="mount-switch-missed"></div>
            </div>
            <div id="adm-missed-container" class="${missedPenaltyEnabled ? '' : 'hidden'} pt-2 border-t border-white/10">
              <label class="block text-[11px] text-neutral-300 mb-1">Penalty Points</label>
              <input id="adm-task-missed-pts" type="number" inputmode="numeric" min="1" class="ios-input font-mono" value="${missedPenaltyPoints}" placeholder="5" />
            </div>
          </div>
        </div>

        <!-- Question Builder Card -->
        <div class="p-3.5 rounded-2xl bg-black/20 border border-white/10 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-white uppercase tracking-wider">Submission Questions</div>
              <div class="text-[11px] text-neutral-400">Short text, paragraph or multiple choice questions</div>
            </div>
            <button type="button" id="btn-add-question" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] text-white hover:bg-[#0071E3] transition">
              + Add Question
            </button>
          </div>

          <div id="adm-questions-list" class="space-y-3 pt-1"></div>
        </div>
      </div>
    `;

    // Wire inputs with defensive null guards
    const titleInp = bodyEl.querySelector('#adm-task-title');
    if (titleInp) titleInp.oninput = e => { currentTitle = e.target.value; };
    const descInp = bodyEl.querySelector('#adm-task-desc');
    if (descInp) descInp.oninput = e => { currentDesc = e.target.value; };
    const catInp = bodyEl.querySelector('#adm-task-category');
    if (catInp) catInp.onchange = e => { currentCategoryId = e.target.value; };
    const ptsInp = bodyEl.querySelector('#adm-task-points');
    if (ptsInp) ptsInp.oninput = e => { currentPoints = e.target.value; };
    const linkInp = bodyEl.querySelector('#adm-task-link');
    if (linkInp) linkInp.oninput = e => { currentLink = e.target.value; };

    // Category picker button wiring
    const catBtn = bodyEl.querySelector('#btn-pick-task-category');
    if (catBtn) {
      const catObj = state.categories.find(c => c.id === currentCategoryId);
      const catLabel = bodyEl.querySelector('#btn-pick-task-category-label');
      if (catLabel && catObj) catLabel.textContent = catObj.name || catObj.nameEn || 'Select Category';
      catBtn.onclick = () => {
        openItemPicker({
          title: 'Select Category',
          items: state.categories.map(c => ({
            id: c.id,
            label: c.name || c.nameEn,
            color: c.color,
            icon: c.iconKey || c.icon || 'film'
          })),
          selectedId: currentCategoryId,
          onSelect: (item) => {
            currentCategoryId = item.id;
            if (catInp) catInp.value = item.id;
            if (catLabel) catLabel.textContent = item.label;
          }
        });
      };
    }

    // Claim policy: milestones never repeat, so the recurrence card is hidden for them
    function applyClaimPolicyVisibility() {
      const card = bodyEl.querySelector('#adm-recurrence-card');
      if (card) card.classList.toggle('hidden', currentClaimPolicy === 'milestone');
      const hint = bodyEl.querySelector('#adm-claim-hint');
      if (hint) {
        hint.textContent = currentClaimPolicy === 'milestone'
          ? 'Awarded once per member, ever. This task does not repeat.'
          : currentClaimPolicy === 'every_submission'
            ? 'Points are awarded on every submission.'
            : 'Points are awarded once per cycle. Set the recurrence below.';
      }
    }

    const mountClaimPolicy = bodyEl.querySelector('#mount-task-claim-policy');
    if (mountClaimPolicy) {
      mountClaimPolicy.appendChild(renderSegmented({
        id: 'segmented-task-claim-policy',
        options: [
          { value: 'once_per_cycle', label: 'Once per cycle' },
          { value: 'every_submission', label: 'Every submission' },
          { value: 'milestone', label: 'One-time milestone' }
        ],
        value: currentClaimPolicy,
        onChange: (val) => {
          currentClaimPolicy = val;
          applyClaimPolicyVisibility();
        }
      }));
    }
    applyClaimPolicyVisibility();

    // Schedule Type Segmented control (updates only the sub-form, never the whole modal)
    const mountTaskSchedType = bodyEl.querySelector('#adm-task-sched-type-wrap');
    if (mountTaskSchedType) {
      mountTaskSchedType.innerHTML = '';
      mountTaskSchedType.appendChild(renderSegmented({
        id: 'segmented-task-sched-type',
        options: [
          { value: 'once', label: 'One-Time' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthlyDates', label: 'Monthly' }
        ],
        value: schedType,
        onChange: (val) => {
          schedType = val;
          renderSchedSubform();
        }
      }));
    }

    // Mount Permanent Switch
    const mountPerm = bodyEl.querySelector('#mount-switch-permanent');
    if (mountPerm) {
      mountPerm.appendChild(renderSwitch({
        id: 'adm-task-is-permanent-sw',
        checked: currentIsPermanent,
        onChange: (chk) => {
          currentIsPermanent = chk;
          const nonperm = bodyEl.querySelector('#adm-nonpermanent-container');
          if (nonperm) nonperm.classList.toggle('hidden', currentIsPermanent);
        }
      }));
    }

    // Mount Early Switch
    const mountEarly = bodyEl.querySelector('#mount-switch-early');
    if (mountEarly) {
      mountEarly.appendChild(renderSwitch({
        id: 'adm-task-early-sw',
        checked: earlyBonusEnabled,
        onChange: (chk) => {
          earlyBonusEnabled = chk;
          const c = bodyEl.querySelector('#adm-early-container');
          if (c) c.classList.toggle('hidden', !earlyBonusEnabled);
          updateAllWords();
        }
      }));
    }

    // Mount Grace Switch
    const mountGrace = bodyEl.querySelector('#mount-switch-grace');
    if (mountGrace) {
      mountGrace.appendChild(renderSwitch({
        id: 'adm-task-grace-sw',
        checked: graceEnabled,
        onChange: (chk) => {
          graceEnabled = chk;
          const c = bodyEl.querySelector('#adm-grace-container');
          if (c) c.classList.toggle('hidden', !graceEnabled);
          updateAllWords();
        }
      }));
    }

    // Mount Missed Penalty Switch
    const mountMissed = bodyEl.querySelector('#mount-switch-missed');
    if (mountMissed) {
      mountMissed.appendChild(renderSwitch({
        id: 'adm-task-missed-sw',
        checked: missedPenaltyEnabled,
        onChange: (chk) => {
          missedPenaltyEnabled = chk;
          const c = bodyEl.querySelector('#adm-missed-container');
          if (c) c.classList.toggle('hidden', !missedPenaltyEnabled);
        }
      }));
    }

    // Native date / time inputs
    const bindField = (sel, setter) => {
      const el = bodyEl.querySelector(sel);
      if (el) {
        const handler = e => { if (e.target.value) setter(e.target.value); updateAllWords(); };
        el.onchange = handler;
        el.oninput = handler;
      }
    };
    bindField('#adm-dl-date', v => { deadlineDateStr = v; });
    bindField('#adm-dl-time', v => { deadlineTimeStr = v; });
    bindField('#adm-early-date', v => { earlyBonusDateStr = v; });
    bindField('#adm-early-time', v => { earlyBonusTimeStr = v; });
    bindField('#adm-grace-date', v => { graceDateStr = v; });
    bindField('#adm-grace-time', v => { graceTimeStr = v; });

    const earlyPtsInp = bodyEl.querySelector('#adm-early-pts');
    if (earlyPtsInp) earlyPtsInp.oninput = e => { earlyBonusPoints = Number(e.target.value) || 15; };
    const missedPtsInp = bodyEl.querySelector('#adm-task-missed-pts');
    if (missedPtsInp) missedPtsInp.oninput = e => { missedPenaltyPoints = Number(e.target.value) || 5; };

    renderSchedSubform();
    renderQuestionsList();
    updateAllWords();

    const addQBtn = bodyEl.querySelector('#btn-add-question');
    if (addQBtn) {
      addQBtn.onclick = () => {
        currentQuestions.push({
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          questionText: '',
          type: 'short',
          isRequired: true,
          options: [
            { id: 'opt_1', label: 'Option 1' },
            { id: 'opt_2', label: 'Option 2' }
          ],
          allowOther: false
        });
        renderQuestionsList();
      };
    }
  }

  const HINT_CLASS = 'p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 font-medium';
  function setHint(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = msg ? HINT_CLASS : 'hidden';
  }

  // Inline validation hints only (no developer-facing text)
  function updateAllWords() {
    const startMs = dtToMs(selectedDateStr, selectedTimeStr);
    const dlMs = dtToMs(deadlineDateStr, deadlineTimeStr);
    const ebMs = dtToMs(earlyBonusDateStr, earlyBonusTimeStr);
    const grMs = dtToMs(graceDateStr, graceTimeStr);
    const ok = n => Number.isFinite(n);

    setHint(bodyEl.querySelector('#adm-deadline-words'),
      ok(startMs) && ok(dlMs) && dlMs <= startMs ? '⚠ The deadline must be after the start date and time.' : '');
    setHint(bodyEl.querySelector('#adm-early-words'),
      earlyBonusEnabled && ok(ebMs) && ok(startMs) && ok(dlMs) && (ebMs <= startMs || ebMs >= dlMs)
        ? '⚠ The bonus window must end after the start and before the deadline.' : '');
    setHint(bodyEl.querySelector('#adm-grace-words'),
      graceEnabled && ok(grMs) && ok(dlMs) && grMs <= dlMs
        ? '⚠ The grace cutoff must be after the deadline.' : '');
  }

  function renderSchedSubform() {
    const subContainer = bodyEl.querySelector('#adm-sched-subform');
    if (!subContainer) return;

    const startFields = (timeLabel) => `
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-1">Start Date</label>
          <input id="sched-inp-date" type="date" class="ios-input" value="${selectedDateStr}" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-1">${timeLabel}</label>
          <input id="sched-inp-time" type="time" class="ios-input" value="${selectedTimeStr}" />
        </div>
      </div>`;

    function wireStartFields() {
      const d = subContainer.querySelector('#sched-inp-date');
      const t = subContainer.querySelector('#sched-inp-time');
      if (d) { d.onchange = e => { if (e.target.value) selectedDateStr = e.target.value; updateAllWords(); }; }
      if (t) { t.onchange = e => { if (e.target.value) selectedTimeStr = e.target.value; updateAllWords(); }; }
    }

    const chipOn = 'bg-[#0A84FF] border-[#0A84FF] text-white';
    const chipOff = 'bg-white/5 border-white/10 text-neutral-400';

    if (schedType === 'once') {
      subContainer.innerHTML = startFields('Start Time');
      wireStartFields();
    } else if (schedType === 'daily') {
      subContainer.innerHTML = startFields('Daily Time');
      wireStartFields();
    } else if (schedType === 'weekly') {
      subContainer.innerHTML = `
        <div>
          <label class="block text-[11px] text-neutral-400 mb-1.5">Select Weekdays</label>
          <div class="flex flex-wrap gap-1.5" id="weekly-days-picker">
            ${['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => `
              <button type="button" class="btn-day-chip px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${weeklyDays.has(day) ? chipOn : chipOff}" data-day="${day}">${day}</button>
            `).join('')}
          </div>
        </div>
        ${startFields('Event Time')}`;
      subContainer.querySelectorAll('.btn-day-chip').forEach(btn => {
        btn.onclick = () => {
          const d = btn.dataset.day;
          if (weeklyDays.has(d)) weeklyDays.delete(d); else weeklyDays.add(d);
          btn.className = `btn-day-chip px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${weeklyDays.has(d) ? chipOn : chipOff}`;
        };
      });
      wireStartFields();
    } else {
      // Monthly: day-of-month grid (1-31) + Last Day of Month
      const dayCls = (on) => `btn-mday h-9 rounded-lg text-xs font-semibold font-mono transition ${on ? 'bg-[#0A84FF] text-white' : 'bg-white/[0.08] text-neutral-300'}`;
      const lastCls = (on) => `w-full h-10 rounded-lg text-xs font-semibold transition ${on ? 'bg-[#0A84FF] text-white' : 'bg-white/[0.08] text-neutral-300'}`;
      subContainer.innerHTML = `
        <div>
          <label class="block text-[11px] text-neutral-400 mb-1.5">Day of Month</label>
          <div id="monthly-day-grid" class="grid grid-cols-7 gap-1.5">
            ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => `
              <button type="button" class="${dayCls(monthlyDates.has(day))}" data-day="${day}">${day}</button>
            `).join('')}
          </div>
          <button type="button" id="btn-mday-last" class="${lastCls(monthlyLastDay)} mt-2">Last Day of Month</button>
        </div>
        ${startFields('Event Time')}`;
      subContainer.querySelectorAll('.btn-mday').forEach(btn => {
        btn.onclick = () => {
          const d = Number(btn.dataset.day);
          if (monthlyDates.has(d)) monthlyDates.delete(d); else monthlyDates.add(d);
          btn.className = dayCls(monthlyDates.has(d));
        };
      });
      const lastBtn = subContainer.querySelector('#btn-mday-last');
      if (lastBtn) {
        lastBtn.onclick = () => {
          monthlyLastDay = !monthlyLastDay;
          lastBtn.className = `${lastCls(monthlyLastDay)} mt-2`;
        };
      }
      wireStartFields();
    }
  }

  function renderQuestionsList() {
    const qListEl = bodyEl.querySelector('#adm-questions-list');
    if (!qListEl) return;

    if (currentQuestions.length === 0) {
      qListEl.innerHTML = '<div class="text-[11px] text-neutral-400 italic py-2 text-center border border-dashed border-white/10 rounded-xl">No custom questions added. Click + Add Question above.</div>';
      return;
    }

    qListEl.innerHTML = '';
    currentQuestions.forEach((q, idx) => {
      const qCard = document.createElement('div');
      qCard.className = 'p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 text-xs';
      qCard.dataset.idx = idx;

      // Card Header: Reorder buttons, Prompt Input, Delete
      const headerRow = document.createElement('div');
      headerRow.className = 'flex items-start gap-2';

      const reorderBtns = document.createElement('div');
      reorderBtns.className = 'flex flex-col gap-1 pt-1';
      reorderBtns.innerHTML = `
        <button type="button" class="btn-q-up text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5 ${idx === 0 ? 'disabled opacity-30 cursor-not-allowed' : ''}">▲</button>
        <button type="button" class="btn-q-down text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-white/5 ${idx === currentQuestions.length - 1 ? 'disabled opacity-30 cursor-not-allowed' : ''}">▼</button>
      `;
      const btnUp = reorderBtns.querySelector('.btn-q-up');
      if (btnUp) {
        btnUp.onclick = () => {
          if (idx > 0) {
            const item = currentQuestions.splice(idx, 1)[0];
            currentQuestions.splice(idx - 1, 0, item);
            renderQuestionsList();
          }
        };
      }
      const btnDown = reorderBtns.querySelector('.btn-q-down');
      if (btnDown) {
        btnDown.onclick = () => {
          if (idx < currentQuestions.length - 1) {
            const item = currentQuestions.splice(idx, 1)[0];
            currentQuestions.splice(idx + 1, 0, item);
            renderQuestionsList();
          }
        };
      }

      const promptInp = document.createElement('input');
      promptInp.type = 'text';
      promptInp.className = 'inp-q-text flex-1 glass-input text-xs font-semibold';
      promptInp.placeholder = `Question ${idx + 1} prompt...`;
      promptInp.value = q.questionText || '';
      promptInp.oninput = e => { q.questionText = e.target.value; };

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition shrink-0';
      delBtn.title = 'Remove Question';
      delBtn.innerHTML = '<svg class="w-4 h-4 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      delBtn.onclick = () => {
        currentQuestions.splice(idx, 1);
        renderQuestionsList();
      };

      headerRow.appendChild(reorderBtns);
      headerRow.appendChild(promptInp);
      headerRow.appendChild(delBtn);
      qCard.appendChild(headerRow);

      // Row 2: Type selector (full width)
      const typeRow = document.createElement('div');
      typeRow.className = 'pt-1 border-t border-white/5';
      typeRow.appendChild(renderSegmented({
        options: [
          { value: 'short', label: 'Short Text' },
          { value: 'long', label: 'Paragraph' },
          { value: 'mcq', label: 'Multiple Choice' }
        ],
        value: q.type || 'short',
        onChange: (val) => {
          q.type = val;
          if (val === 'mcq' && (!q.options || q.options.length < 2)) {
            q.options = [
              { id: 'opt_1', label: 'Option 1' },
              { id: 'opt_2', label: 'Option 2' }
            ];
          }
          renderQuestionsList();
        }
      }));
      qCard.appendChild(typeRow);

      // Row 3: Required label (left) + iOS switch (right), never clipped
      const reqRow = document.createElement('div');
      reqRow.className = 'flex items-center';
      reqRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
      reqRow.innerHTML = '<span class="text-[12px] text-neutral-200 font-medium">Required</span>';
      reqRow.appendChild(renderSwitch({
        id: `q-req-sw-${q.id}`,
        checked: Boolean(q.isRequired),
        onChange: (chk) => { q.isRequired = chk; }
      }));
      qCard.appendChild(reqRow);

      // MCQ Options Builder (if type === 'mcq')
      if (q.type === 'mcq') {
        const mcqBox = document.createElement('div');
        mcqBox.className = 'p-2.5 rounded-xl bg-black/20 border border-white/5 space-y-2 pt-2';

        const optList = document.createElement('div');
        optList.className = 'space-y-1.5';

        (q.options || []).forEach((opt, optIdx) => {
          const optRow = document.createElement('div');
          optRow.className = 'flex items-center gap-2';

          const optInp = document.createElement('input');
          optInp.type = 'text';
          optInp.className = 'flex-1 glass-input text-xs py-1 px-2.5';
          optInp.placeholder = `Option ${optIdx + 1}`;
          optInp.value = opt.label || '';
          optInp.oninput = e => { opt.label = e.target.value; };

          const optDel = document.createElement('button');
          optDel.type = 'button';
          optDel.className = `p-1 text-rose-400 hover:bg-rose-500/10 rounded ${q.options.length <= 2 ? 'opacity-30 cursor-not-allowed' : ''}`;
          optDel.innerHTML = '✕';
          optDel.onclick = () => {
            if (q.options.length > 2) {
              q.options.splice(optIdx, 1);
              renderQuestionsList();
            }
          };

          optRow.appendChild(optInp);
          optRow.appendChild(optDel);
          optList.appendChild(optRow);
        });

        const addOptBtn = document.createElement('button');
        addOptBtn.type = 'button';
        addOptBtn.className = 'px-2 py-1 text-[11px] text-[#0A84FF] hover:underline font-semibold';
        addOptBtn.textContent = '+ Add Option';
        addOptBtn.onclick = () => {
          q.options.push({ id: 'opt_' + Date.now(), label: `Option ${q.options.length + 1}` });
          renderQuestionsList();
        };

        const otherSwitchBox = document.createElement('div');
        otherSwitchBox.className = 'flex items-center justify-between pt-1 border-t border-white/5';
        otherSwitchBox.innerHTML = '<span class="text-[11px] text-neutral-400">Allow \'Other\' (custom answer)</span>';
        otherSwitchBox.appendChild(renderSwitch({
          id: `q-other-sw-${q.id}`,
          checked: Boolean(q.allowOther),
          onChange: (chk) => { q.allowOther = chk; }
        }));

        mcqBox.appendChild(optList);
        mcqBox.appendChild(addOptBtn);
        mcqBox.appendChild(otherSwitchBox);
        qCard.appendChild(mcqBox);
      }

      qListEl.appendChild(qCard);
    });
  }

  renderContent();

  openModal({
    title: taskId ? 'Edit Task' : 'New Task',
    body: bodyEl,
    saveLabel: 'Save Task',
    onSave: async () => {
      const trimmedTitle = currentTitle.trim();
      const trimmedDesc = currentDesc.trim();
      if (!trimmedTitle) {
        toast('Task title is required', 'error');
        return false;
      }
      if (!trimmedDesc) {
        toast('Task description is required', 'error');
        return false;
      }

      const [yearStr, monthStr, dayStr] = (selectedDateStr || '2026-05-01').split('-');
      const [hourStr, minStr] = (selectedTimeStr || '10:00').split(':');
      const startDateTimeMs = zonedDateToMs(
        parseInt(yearStr, 10),
        parseInt(monthStr, 10),
        parseInt(dayStr, 10),
        parseInt(hourStr, 10),
        parseInt(minStr, 10),
        0,
        APP_TIMEZONE
      );

      // Milestones never repeat: force a one-time schedule
      const effectiveSchedType = currentClaimPolicy === 'milestone' ? 'once' : schedType;

      // Validate & compute durationMinutes (deadline date/time relative to start)
      let finalDurationMinutes = null;
      if (!currentIsPermanent) {
        const deadlineMs = dtToMs(deadlineDateStr, deadlineTimeStr);
        finalDurationMinutes = Math.round((deadlineMs - startDateTimeMs) / 60000);
        if (!Number.isFinite(finalDurationMinutes) || finalDurationMinutes <= 0) {
          toast('The deadline must be after the start date and time', 'error');
          return false;
        }
      }

      // Early Bonus validation
      let finalEarlyBonus = { enabled: false, untilMinutes: 0, points: Number(currentPoints) || 5 };
      if (!currentIsPermanent && earlyBonusEnabled) {
        const ebMs = dtToMs(earlyBonusDateStr, earlyBonusTimeStr);
        const ebUntilMinutes = Math.round((ebMs - startDateTimeMs) / 60000);
        if (!Number.isFinite(ebUntilMinutes) || ebUntilMinutes <= 0 || (finalDurationMinutes && ebUntilMinutes >= finalDurationMinutes)) {
          toast('The bonus window must end after the start and before the deadline', 'error');
          return false;
        }
        finalEarlyBonus = {
          enabled: true,
          untilMinutes: ebUntilMinutes,
          points: Number(earlyBonusPoints) || 15
        };
      }

      // Grace Period validation (NO grace points)
      let finalGrace = { enabled: false, untilMinutes: 0 };
      if (!currentIsPermanent && graceEnabled) {
        const grMs = dtToMs(graceDateStr, graceTimeStr);
        const grUntilMinutes = Math.round((grMs - startDateTimeMs) / 60000);
        if (!Number.isFinite(grUntilMinutes) || (finalDurationMinutes && grUntilMinutes <= finalDurationMinutes)) {
          toast('The grace cutoff must be after the deadline', 'error');
          return false;
        }
        finalGrace = { enabled: true, untilMinutes: grUntilMinutes };
      }

      // Missed Penalty
      let finalMissedPenalty = { enabled: false, points: 0 };
      if (!currentIsPermanent && missedPenaltyEnabled) {
        finalMissedPenalty = {
          enabled: true,
          points: Number(missedPenaltyPoints) || 5
        };
      }

      let finalSchedule = {
        type: effectiveSchedType,
        startDateTime: startDateTimeMs
      };
      if (effectiveSchedType === 'weekly') {
        if (weeklyDays.size === 0) {
          toast('Select at least one weekday', 'error');
          return false;
        }
        finalSchedule.days = Array.from(weeklyDays);
      } else if (effectiveSchedType === 'monthlyDates') {
        const dates = new Set(monthlyDates);
        if (monthlyLastDay) dates.add(31);
        if (dates.size === 0) {
          toast('Select at least one day of the month', 'error');
          return false;
        }
        finalSchedule.dates = Array.from(dates).sort((a, b) => a - b);
        if (monthlyLastDay) finalSchedule.lastDay = true;
      }

      const validQuestions = currentQuestions
        .map(q => {
          const qText = (q.questionText || '').trim();
          const cleanQ = {
            id: q.id || ('q_' + Math.random().toString(36).slice(2, 7)),
            questionText: qText,
            type: q.type || 'short',
            isRequired: Boolean(q.isRequired)
          };
          if (cleanQ.type === 'mcq') {
            cleanQ.options = (q.options || [])
              .map(o => ({ id: o.id || ('opt_' + Math.random().toString(36).slice(2, 6)), label: (o.label || '').trim() }))
              .filter(o => o.label.length > 0);
            if (cleanQ.options.length < 2) {
              cleanQ.options = [
                { id: 'opt_1', label: 'Option 1' },
                { id: 'opt_2', label: 'Option 2' }
              ];
            }
            cleanQ.allowOther = Boolean(q.allowOther);
          }
          return cleanQ;
        })
        .filter(q => q.questionText.length > 0);

      const payload = {
        title: trimmedTitle,
        description: trimmedDesc,
        link: currentLink.trim(),
        categoryId: currentCategoryId || 'general',
        category: currentCategoryId || 'general',
        points: Number(currentPoints) || 5,
        earlyBonus: finalEarlyBonus,
        grace: finalGrace,
        missedPenalty: finalMissedPenalty,
        schedule: finalSchedule,
        isPermanent: currentIsPermanent,
        claimPolicy: currentClaimPolicy || 'once_per_cycle',
        durationMinutes: currentIsPermanent ? null : finalDurationMinutes,
        questions: validQuestions,
        active: true,
        archived: false
      };

      try {
        if (state.editingTaskId) {
          await updateDoc(doc(db, 'tasks', state.editingTaskId), {
            ...payload,
            updatedAt: serverTimestamp()
          });
          toast('Task updated', 'success');
        } else {
          await addDoc(collection(db, 'tasks'), {
            ...payload,
            createdAt: serverTimestamp()
          });
          toast('Task created', 'success');
        }
        return true;
      } catch (err) {
        console.error('Task save error:', err);
        toast(err.message || 'Failed to save task', 'error');
        return false;
      }
    }
  });
}

function renderAdminSessions() {
  const list = document.getElementById('admin-sessions-list');
  if (!list) return;

  const isArchived = adminSessionsFilter === 'archived';
  const filtered = state.attendanceSessions.filter(s => isArchived ? s.archived : !s.archived);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="glass-card p-6 text-center text-xs text-neutral-400 border border-dashed border-white/10">
        No ${isArchived ? 'archived' : 'active'} attendance sessions found.
      </div>
    `;
    return;
  }

  const nowMs = serverNow();

  list.innerHTML = filtered.map(session => {
    const calc = computeAttendance(session, nowMs);
    const occ = getOccurrenceFor(session, nowMs);
    const occStart = occ ? occ.start : (session.schedule?.startDateTime || nowMs);
    const occKey = occ ? occ.key : 'once';

    const sched = session.schedule || { type: 'once' };
    let schedDesc = sched.type;
    if (sched.type === 'once') {
      schedDesc = `Once (${formatDateTime(sched.startDateTime)})`;
    } else if (sched.type === 'daily') {
      schedDesc = `Daily at ${formatDateTime(sched.startDateTime, { month: undefined, day: undefined })}`;
    } else if (sched.type === 'weekly') {
      schedDesc = `Weekly on ${(sched.days || []).join(', ')} at ${formatDateTime(sched.startDateTime, { month: undefined, day: undefined })}`;
    } else if (sched.type === 'monthlyDates') {
      schedDesc = `Monthly on dates ${(sched.dates || sched.monthDates || []).join(', ')}`;
    } else if (sched.type === 'monthlyWeekdays') {
      schedDesc = `Monthly on ${(sched.weeks || []).join(', ')} ${(sched.weekdays || []).join(', ')}`;
    }

    const isSelected = selectionState.active && selectionState.type === 'sessions' && selectionState.selectedIds.has(session.id);

    return `
      <div class="glass-card bulk-select-card p-4 space-y-3 text-xs border-white/10${isSelected ? ' selected' : ''}" data-session-id="${esc(session.id)}" data-bulk-id="${esc(session.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content space-y-3 w-full">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="ios-headline text-white">${esc(session.title)}</h3>
              <p class="text-[11px] text-neutral-400 mt-0.5">${esc(schedDesc)} (${APP_TIMEZONE})</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${session.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-neutral-400'}">
              ${session.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/[0.03] text-[11px] text-neutral-300">
            <div>
              <span class="text-[10px] text-neutral-400 block">Window Boundaries</span>
              <span>Early: -${session.earlyCheckInMinutes}m • Cutoff: +${session.lateCutoffMinutes}m</span>
            </div>
            <div>
              <span class="text-[10px] text-neutral-400 block">Penalty Matrix</span>
              <span>${session.penaltyPerStep} EGP / ${session.stepDuration} ${session.penaltyUnit} (${session.minPenalty}..${session.maxPenalty} EGP)</span>
            </div>
          </div>

          <div class="p-2 rounded-lg bg-black/20 text-[11px] flex items-center justify-between text-neutral-300">
            <span>Current Occurrence: <strong class="text-white">${formatDateTime(occStart)}</strong></span>
            <span class="font-mono text-xs ${calc.status === 'on_time' ? 'text-emerald-400' : (calc.status === 'late' ? 'text-rose-400' : 'text-neutral-400')}">
              ${calc.status.toUpperCase()}
            </span>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t border-white/10">
            <button class="btn-roster-session flex-1 py-1.5 rounded-xl font-semibold bg-[#0A84FF]/20 text-[#0A84FF] hover:bg-[#0A84FF]/30 transition text-center" data-session-id="${esc(session.id)}" data-occ-key="${esc(occKey)}" data-occ-start="${occStart}">
              View Roster
            </button>
            <button class="btn-edit-session px-3 py-1.5 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/15 transition" data-session-id="${esc(session.id)}">
              Edit
            </button>
            <button class="btn-archive-session px-3 py-1.5 rounded-xl font-semibold ${session.archived ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} hover:bg-white/10 transition" data-session-id="${esc(session.id)}" data-archived="${session.archived}">
              ${session.archived ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.glass-card').forEach(card => {
    card.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'sessions') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
    };

    attachLongPress(card, () => {
      enterSelectionMode('sessions', card.dataset.bulkId);
    });
  });

  list.querySelectorAll('.btn-roster-session').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'sessions') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const session = state.attendanceSessions.find(s => s.id === btn.dataset.sessionId);
      if (session) {
        openAdminRosterModal(session, btn.dataset.occKey, Number(btn.dataset.occStart));
      }
    };
  });

  list.querySelectorAll('.btn-edit-session').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'sessions') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      openAdminSessionModal(btn.dataset.sessionId);
    };
  });

  list.querySelectorAll('.btn-archive-session').forEach(btn => {
    btn.onclick = async (e) => {
      if (selectionState.active && selectionState.type === 'sessions') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const session = state.attendanceSessions.find(s => s.id === btn.dataset.sessionId);
      if (!session) return;
      const isArchived = btn.dataset.archived === 'true';
      const confirmed = await confirmSheet({
        title: isArchived ? 'Restore Session' : 'Archive Session',
        message: isArchived ? `Restore "${session.title}"?` : `Archive "${session.title}"? Members will not see archived sessions.`,
        confirmLabel: isArchived ? 'Restore' : 'Archive',
        destructive: !isArchived
      });
      if (confirmed) {
        await updateDoc(doc(db, 'attendance_sessions', session.id), {
          archived: !isArchived,
          updatedAt: serverTimestamp()
        });
        toast(isArchived ? 'Session restored' : 'Session archived', 'success');
      }
    };
  });
}

function openAdminSessionModal(sessionId = null) {
  editingSessionId = sessionId;
  const rawSession = sessionId ? state.attendanceSessions.find(s => s.id === sessionId) : null;
  const session = rawSession ? normalizeSession(rawSession) : null;

  let currentTitle = session ? session.title : '';
  let sched = normalizeScheduleObject(session?.schedule || session || { type: 'once', startDateTime: Date.now() });
  let schedType = sched.type || 'once';
  let schedStartMs = parseDateTimeToMs(sched.startDateTime) || Date.now();
  let schedParts = getZonedParts(schedStartMs, APP_TIMEZONE);

  let weeklyDays = new Set(Array.isArray(sched.days) ? sched.days : ['Sun']);
  let monthlyDates = new Set(Array.isArray(sched.dates || sched.monthDates) ? (sched.dates || sched.monthDates) : [1]);

  const pad2 = n => String(n).padStart(2, '0');
  let selectedDateStr = `${schedParts.year}-${pad2(schedParts.month)}-${pad2(schedParts.day)}`;
  let selectedTimeStr = `${pad2(schedParts.hour)}:${pad2(schedParts.minute)}`;

  // Window boundaries
  let earlyCheckInMinutes = session ? session.earlyCheckInMinutes : 30;
  let lateCutoffMinutes = session ? session.lateCutoffMinutes : 120;

  const [sH, sM] = selectedTimeStr.split(':').map(Number);
  const startMinsOfDay = (sH || 0) * 60 + (sM || 0);

  const openMins = ((startMinsOfDay - earlyCheckInMinutes) % 1440 + 1440) % 1440;
  const closeMins = (startMinsOfDay + lateCutoffMinutes) % 1440;

  let opensTimeStr = `${pad2(Math.floor(openMins / 60))}:${pad2(openMins % 60)}`;
  let closesTimeStr = `${pad2(Math.floor(closeMins / 60))}:${pad2(closeMins % 60)}`;

  // 3-Way Attendee Assignment State: 'all' | 'badge' | 'custom'
  let targetType = session?.targetType || (Array.isArray(session?.assignedUids) && session.assignedUids.length > 0 ? 'custom' : (Array.isArray(session?.badgeIds) && session.badgeIds.length > 0 ? 'badge' : 'all'));
  let selectedBadgeIds = new Set(Array.isArray(session?.badgeIds) ? session.badgeIds : []);
  let assignedUids = new Set(Array.isArray(session?.assignedUids) ? session.assignedUids : []);

  // SYSTEM 1: Points Deductions
  let pointsPenalty = {
    enabled: session ? session.pointsPenalty.enabled : true,
    mode: session ? session.pointsPenalty.mode : 'stepped',
    fixed: session ? session.pointsPenalty.fixed : 5,
    stepUnit: session ? session.pointsPenalty.stepUnit : 'minutes',
    stepSize: session ? session.pointsPenalty.stepSize : 5,
    perStep: session ? session.pointsPenalty.perStep : 1,
    min: session ? session.pointsPenalty.min : 5,
    max: session ? session.pointsPenalty.max : 30,
    absence: session ? session.pointsPenalty.absence : 20
  };

  // SYSTEM 2: Financial Fines (EGP)
  let finePenalty = {
    enabled: session ? session.finePenalty.enabled : false,
    mode: session ? session.finePenalty.mode : 'stepped',
    fixed: session ? session.finePenalty.fixed : 10,
    stepUnit: session ? session.finePenalty.stepUnit : 'minutes',
    stepSize: session ? session.finePenalty.stepSize : 5,
    perStep: session ? session.finePenalty.perStep : 2,
    min: session ? session.finePenalty.min : 10,
    max: session ? session.finePenalty.max : 100,
    absence: session ? session.finePenalty.absence : 50
  };

  let active = session ? session.active !== false : true;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4';

  // Build the entire DOM once without innerHTML destruction on toggle
  // 1. Title
  const titleBox = document.createElement('div');
  titleBox.innerHTML = `
    <label class="block text-xs font-semibold text-neutral-200 mb-1">Session Title *</label>
    <input id="adm-session-title" type="text" class="w-full glass-input text-xs" placeholder="e.g. Sunday Production Service" value="${esc(currentTitle)}" />
  `;
  const titleInp = titleBox.querySelector('#adm-session-title');
  titleInp.oninput = (e) => { currentTitle = e.target.value; };
  bodyEl.appendChild(titleBox);

  // 2. Recurrence & Schedule Type
  const schedBox = document.createElement('div');
  schedBox.className = 'p-3 rounded-2xl bg-black/20 border border-white/10 space-y-3';
  schedBox.innerHTML = `
    <label class="block text-xs font-bold text-white uppercase tracking-wider">Recurrence &amp; Schedule</label>
    <div>
      <label class="block text-xs text-neutral-300 mb-1">Schedule Type</label>
      <div id="adm-session-sched-type-wrap"></div>
    </div>
    <div id="adm-session-sched-weekly-box" class="space-y-1.5 pt-1" style="display: ${schedType === 'weekly' ? 'block' : 'none'};">
      <label class="block text-[11px] text-neutral-300 font-medium">Days of the Week:</label>
      <div class="flex flex-wrap gap-1.5" id="adm-weekly-days-wrap">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `
          <button type="button" class="btn-att-wday px-2.5 py-1 text-xs rounded-lg font-medium transition ${weeklyDays.has(d) ? 'bg-[#0A84FF] text-white' : 'bg-white/5 text-neutral-400'}" data-day="${d}">${d}</button>
        `).join('')}
      </div>
    </div>
    <div id="adm-session-sched-monthly-box" class="space-y-1.5 pt-1" style="display: ${schedType === 'monthlyDates' ? 'block' : 'none'};">
      <label class="block text-[11px] text-neutral-300 font-medium">Days of the Month (1-31):</label>
      <div class="grid grid-cols-7 gap-1" id="adm-monthly-dates-wrap">
        ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => `
          <button type="button" class="btn-att-mdate p-1 text-[11px] rounded font-mono transition ${monthlyDates.has(day) ? 'bg-[#0A84FF] text-white font-bold' : 'bg-white/5 text-neutral-400'}" data-day="${day}">${day}</button>
        `).join('')}
      </div>
    </div>
  `;

  const weeklyBox = schedBox.querySelector('#adm-session-sched-weekly-box');
  const monthlyBox = schedBox.querySelector('#adm-session-sched-monthly-box');

  schedBox.querySelectorAll('.btn-att-wday').forEach(b => {
    b.onclick = () => {
      const d = b.dataset.day;
      if (weeklyDays.has(d)) {
        if (weeklyDays.size > 1) weeklyDays.delete(d);
      } else {
        weeklyDays.add(d);
      }
      b.className = `btn-att-wday px-2.5 py-1 text-xs rounded-lg font-medium transition ${weeklyDays.has(d) ? 'bg-[#0A84FF] text-white' : 'bg-white/5 text-neutral-400'}`;
    };
  });

  schedBox.querySelectorAll('.btn-att-mdate').forEach(b => {
    b.onclick = () => {
      const d = Number(b.dataset.day);
      if (monthlyDates.has(d)) {
        if (monthlyDates.size > 1) monthlyDates.delete(d);
      } else {
        monthlyDates.add(d);
      }
      b.className = `btn-att-mdate p-1 text-[11px] rounded font-mono transition ${monthlyDates.has(d) ? 'bg-[#0A84FF] text-white font-bold' : 'bg-white/5 text-neutral-400'}`;
    };
  });

  const schedTypeWrap = schedBox.querySelector('#adm-session-sched-type-wrap');
  if (schedTypeWrap) {
    schedTypeWrap.appendChild(renderSegmented({
      id: 'segmented-session-sched-type',
      options: [
        { value: 'once', label: 'One-Time' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthlyDates', label: 'Monthly' }
      ],
      value: schedType === 'monthlyDates' || schedType === 'monthlyWeekdays' ? 'monthlyDates' : schedType,
      onChange: (val) => {
        schedType = val;
        weeklyBox.style.display = (val === 'weekly') ? 'block' : 'none';
        monthlyBox.style.display = (val === 'monthlyDates') ? 'block' : 'none';
      }
    }));
  }
  bodyEl.appendChild(schedBox);

  // 3. Clean Native Date & Time Pickers (Stripped of "(Africa/Cairo)" and "308m")
  const timeCard = document.createElement('div');
  timeCard.className = 'p-3 rounded-2xl bg-black/20 border border-white/10 space-y-2.5';
  timeCard.innerHTML = `
    <label class="block text-xs font-bold text-white uppercase tracking-wider">Session Time &amp; Check-In Window</label>
    <div class="ios-inset-group bg-white/[0.03] border border-white/10 rounded-xl p-2.5 space-y-2.5">
      <div class="flex items-center justify-between gap-3">
        <label for="attSessionDate" class="text-xs font-medium text-neutral-300">Session Date</label>
        <input type="date" id="attSessionDate" value="${selectedDateStr}" class="glass-input text-xs px-2.5 py-1.5 rounded-lg text-white bg-white/5 border border-white/10 font-mono" />
      </div>
      <div class="h-px bg-white/5"></div>
      <div class="flex items-center justify-between gap-3">
        <label for="attSessionTime" class="text-xs font-medium text-neutral-300">Start Time</label>
        <input type="time" id="attSessionTime" value="${selectedTimeStr}" class="glass-input text-xs px-2.5 py-1.5 rounded-lg text-white bg-white/5 border border-white/10 font-mono" />
      </div>
      <div class="h-px bg-white/5"></div>
      <div class="flex items-center justify-between gap-3">
        <label for="attOpensTime" class="text-xs font-medium text-neutral-300">Check-in Opens</label>
        <input type="time" id="attOpensTime" value="${opensTimeStr}" class="glass-input text-xs px-2.5 py-1.5 rounded-lg text-white bg-white/5 border border-white/10 font-mono" />
      </div>
      <div class="h-px bg-white/5"></div>
      <div class="flex items-center justify-between gap-3">
        <label for="attClosesTime" class="text-xs font-medium text-neutral-300">Check-in Closes</label>
        <input type="time" id="attClosesTime" value="${closesTimeStr}" class="glass-input text-xs px-2.5 py-1.5 rounded-lg text-white bg-white/5 border border-white/10 font-mono" />
      </div>
    </div>
  `;

  const inpDate = timeCard.querySelector('#attSessionDate');
  const inpTime = timeCard.querySelector('#attSessionTime');
  const inpOpens = timeCard.querySelector('#attOpensTime');
  const inpCloses = timeCard.querySelector('#attClosesTime');

  if (inpDate) inpDate.onchange = (e) => { selectedDateStr = e.target.value; };
  if (inpTime) inpTime.onchange = (e) => { selectedTimeStr = e.target.value; };
  if (inpOpens) inpOpens.onchange = (e) => { opensTimeStr = e.target.value; };
  if (inpCloses) inpCloses.onchange = (e) => { closesTimeStr = e.target.value; };
  bodyEl.appendChild(timeCard);

  // 4. 3-Way Attendee Assignment Selector (All Members | By Badge | Specific Members)
  const assignBox = document.createElement('div');
  assignBox.className = 'p-3 rounded-2xl bg-black/20 border border-white/10 space-y-3';
  assignBox.innerHTML = `
    <div class="space-y-1">
      <label class="block text-xs font-bold text-white uppercase tracking-wider">Attendee Assignment</label>
      <p class="text-[11px] text-neutral-400">Choose who is eligible and rostered for this attendance session.</p>
    </div>
    <div id="session-target-type-segmented-wrap"></div>
    <div id="target-all-box" class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-neutral-300 flex items-center gap-2" style="display: ${targetType === 'all' ? 'flex' : 'none'};">
      <svg class="w-4 h-4 text-[#0A84FF] shrink-0 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      <span>All active team members are automatically rostered and eligible.</span>
    </div>
    <div id="target-badge-box" class="space-y-2" style="display: ${targetType === 'badge' ? 'block' : 'none'};">
      <div class="flex items-center justify-between text-xs">
        <span class="text-neutral-400">Select Badges:</span>
        <span id="att-badge-count-label" class="text-[#0A84FF] font-semibold">${selectedBadgeIds.size} selected</span>
      </div>
      <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-xl bg-black/20 border border-white/5">
        ${getAllAvailableBadges().map(b => {
          const isChecked = selectedBadgeIds.has(b.id);
          return `
            <button type="button" class="btn-att-badge-pill px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${isChecked ? 'bg-[#0A84FF] text-white shadow-sm' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'}" data-badge-id="${esc(b.id)}">
              <span class="w-2 h-2 rounded-full" style="background-color: ${b.color || '#0A84FF'};"></span>
              <span>${esc(b.label || b.name || b.id)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
    <div id="target-custom-box" class="space-y-2" style="display: ${targetType === 'custom' ? 'block' : 'none'};">
      <div class="flex items-center justify-between text-xs">
        <span class="text-neutral-400">Select Individual Members:</span>
        <span id="att-custom-count-label" class="text-[#0A84FF] font-semibold">${assignedUids.size} selected</span>
      </div>
      <div class="max-h-48 overflow-y-auto rounded-xl bg-black/20 border border-white/5 divide-y divide-white/5">
        ${(state.members || []).map(m => {
          const isSelected = assignedUids.has(m.uid);
          return `
            <label class="flex items-center justify-between p-2 hover:bg-white/5 transition cursor-pointer text-xs">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium text-white truncate">${esc(m.displayName || m.name || m.email || m.uid)}</span>
                ${m.role === 'admin' ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Admin</span>' : ''}
              </div>
              <input type="checkbox" class="att-member-cb rounded bg-white/10 border-white/20 text-[#0A84FF] focus:ring-0" data-uid="${esc(m.uid)}" ${isSelected ? 'checked' : ''} />
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;

  const targetAllBox = assignBox.querySelector('#target-all-box');
  const targetBadgeBox = assignBox.querySelector('#target-badge-box');
  const targetCustomBox = assignBox.querySelector('#target-custom-box');
  const badgeCountLabel = assignBox.querySelector('#att-badge-count-label');
  const customCountLabel = assignBox.querySelector('#att-custom-count-label');

  assignBox.querySelectorAll('.btn-att-badge-pill').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const bId = btn.dataset.badgeId;
      if (selectedBadgeIds.has(bId)) selectedBadgeIds.delete(bId);
      else selectedBadgeIds.add(bId);
      btn.className = `btn-att-badge-pill px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${selectedBadgeIds.has(bId) ? 'bg-[#0A84FF] text-white shadow-sm' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'}`;
      if (badgeCountLabel) badgeCountLabel.textContent = `${selectedBadgeIds.size} selected`;
    };
  });

  assignBox.querySelectorAll('.att-member-cb').forEach(cb => {
    cb.onchange = (e) => {
      const uid = cb.dataset.uid;
      if (e.target.checked) assignedUids.add(uid);
      else assignedUids.delete(uid);
      if (customCountLabel) customCountLabel.textContent = `${assignedUids.size} selected`;
    };
  });

  const segWrap = assignBox.querySelector('#session-target-type-segmented-wrap');
  if (segWrap) {
    segWrap.appendChild(renderSegmented({
      id: 'segmented-att-target-type',
      options: [
        { value: 'all', label: 'All Members' },
        { value: 'badge', label: 'By Badge' },
        { value: 'custom', label: 'Specific Members' }
      ],
      value: targetType,
      onChange: (val) => {
        targetType = val;
        targetAllBox.style.display = (val === 'all') ? 'flex' : 'none';
        targetBadgeBox.style.display = (val === 'badge') ? 'block' : 'none';
        targetCustomBox.style.display = (val === 'custom') ? 'block' : 'none';
      }
    }));
  }
  bodyEl.appendChild(assignBox);

  // 5. Penalty Systems (Points & Fines) with attendance-grid-2 and zero-scroll-jump
  function renderPenaltySystemSection(sysKey, title, subtitle, unitLabel, sysObj) {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-2xl bg-black/20 border border-white/10 space-y-3';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
      <div>
        <span class="text-xs font-bold text-white block uppercase tracking-wider">${esc(title)}</span>
        <span class="text-[11px] text-neutral-400">${esc(subtitle)}</span>
      </div>
      <div id="switch-${sysKey}-wrap"></div>
    `;

    const matrixBox = document.createElement('div');
    matrixBox.className = 'space-y-3 pt-2 border-t border-white/5';
    matrixBox.style.display = sysObj.enabled ? 'block' : 'none';

    const switchWrap = header.querySelector(`#switch-${sysKey}-wrap`);
    switchWrap.appendChild(renderSwitch({
      id: `adm-session-${sysKey}-toggle`,
      checked: sysObj.enabled,
      onChange: (chk) => {
        sysObj.enabled = chk;
        matrixBox.style.display = chk ? 'block' : 'none';
      }
    }));
    card.appendChild(header);

    // Mode: Fixed vs Stepped
    const modeWrap = document.createElement('div');
    modeWrap.innerHTML = `<label class="block text-[11px] text-neutral-300 mb-1 font-semibold">Calculation Mode</label>`;

    const fixedDiv = document.createElement('div');
    fixedDiv.style.display = (sysObj.mode === 'fixed') ? 'block' : 'none';
    fixedDiv.innerHTML = `
      <label class="block text-[11px] text-neutral-300 mb-1">Fixed Late Penalty (${unitLabel})</label>
      <input type="number" min="0" class="w-full glass-input text-xs font-mono" value="${sysObj.fixed}" />
    `;
    const fixedInp = fixedDiv.querySelector('input');
    if (fixedInp) {
      fixedInp.oninput = (e) => {
        sysObj.fixed = Math.max(0, Number(e.target.value) || 0);
      };
    }

    const steppedContainer = document.createElement('div');
    steppedContainer.className = 'space-y-3';
    steppedContainer.style.display = (sysObj.mode === 'stepped') ? 'block' : 'none';

    // Step Unit (Minutes vs Seconds)
    const unitRow = document.createElement('div');
    unitRow.innerHTML = `<label class="block text-[11px] text-neutral-300 mb-1 font-medium">Step Unit</label>`;
    unitRow.appendChild(renderSegmented({
      id: `seg-${sysKey}-unit`,
      options: [
        { value: 'minutes', label: 'Minutes' },
        { value: 'seconds', label: 'Seconds' }
      ],
      value: sysObj.stepUnit,
      onChange: (uVal) => {
        sysObj.stepUnit = uVal;
      }
    }));
    steppedContainer.appendChild(unitRow);

    // Stepped Rate: Strict 2-column grid (.attendance-grid-2)
    const stepRow = document.createElement('div');
    stepRow.className = 'attendance-grid-2 pt-1';
    stepRow.innerHTML = `
      <div>
        <label class="block text-[11px] text-neutral-300 mb-1 font-medium">Step Interval</label>
        <div id="stepper-${sysKey}-wrap" class="stepper-control"></div>
      </div>
      <div>
        <label class="block text-[11px] text-neutral-300 mb-1 font-medium">Fee / Step (${unitLabel})</label>
        <input type="number" min="0" class="w-full glass-input text-xs font-mono" value="${sysObj.perStep}" />
      </div>
    `;

    const stWrap = stepRow.querySelector(`#stepper-${sysKey}-wrap`);
    stWrap.appendChild(renderStepper({
      id: `step-${sysKey}-size`,
      value: sysObj.stepSize,
      min: 1,
      max: 3600,
      onChange: (newSize) => {
        sysObj.stepSize = newSize;
      }
    }));

    const feeInp = stepRow.querySelector('input');
    if (feeInp) {
      feeInp.oninput = (e) => {
        sysObj.perStep = Math.max(0, Number(e.target.value) || 0);
      };
    }
    steppedContainer.appendChild(stepRow);

    modeWrap.appendChild(renderSegmented({
      id: `seg-${sysKey}-mode`,
      options: [
        { value: 'fixed', label: 'Fixed Amount' },
        { value: 'stepped', label: 'Stepped Rate' }
      ],
      value: sysObj.mode,
      onChange: (mVal) => {
        sysObj.mode = mVal;
        fixedDiv.style.display = (mVal === 'fixed') ? 'block' : 'none';
        steppedContainer.style.display = (mVal === 'stepped') ? 'block' : 'none';
      }
    }));

    matrixBox.appendChild(modeWrap);
    matrixBox.appendChild(fixedDiv);
    matrixBox.appendChild(steppedContainer);

    // Min & Max Bounds (in attendance-grid-2)
    const boundsGrid = document.createElement('div');
    boundsGrid.className = 'attendance-grid-2 pt-1';
    boundsGrid.innerHTML = `
      <div>
        <label class="block text-[11px] text-neutral-300 mb-1">Minimum Late (${unitLabel})</label>
        <input type="number" min="0" class="w-full glass-input text-xs font-mono inp-min" value="${sysObj.min}" />
      </div>
      <div>
        <label class="block text-[11px] text-neutral-300 mb-1">Maximum Late (${unitLabel})</label>
        <input type="number" min="0" class="w-full glass-input text-xs font-mono inp-max" value="${sysObj.max}" />
      </div>
    `;
    const inpMin = boundsGrid.querySelector('.inp-min');
    if (inpMin) inpMin.oninput = (e) => { sysObj.min = Math.max(0, Number(e.target.value) || 0); };
    const inpMax = boundsGrid.querySelector('.inp-max');
    if (inpMax) inpMax.oninput = (e) => { sysObj.max = Math.max(0, Number(e.target.value) || 0); };
    matrixBox.appendChild(boundsGrid);

    // Unexcused Absence
    const absenceBox = document.createElement('div');
    absenceBox.className = 'pt-2 border-t border-white/5';
    absenceBox.innerHTML = `
      <label class="block text-[11px] text-neutral-300 mb-1">Unexcused Absence (${unitLabel})</label>
      <input type="number" min="0" class="w-full glass-input text-xs font-mono" value="${sysObj.absence}" />
    `;
    const inpAbsence = absenceBox.querySelector('input');
    if (inpAbsence) inpAbsence.oninput = (e) => { sysObj.absence = Math.max(0, Number(e.target.value) || 0); };
    matrixBox.appendChild(absenceBox);

    card.appendChild(matrixBox);
    return card;
  }

  bodyEl.appendChild(renderPenaltySystemSection(
    'pts',
    'Points Penalty Matrix',
    'Subtract penalty points for late check-in & absence',
    'pts',
    pointsPenalty
  ));

  bodyEl.appendChild(renderPenaltySystemSection(
    'fine',
    'Financial Fine Matrix (EGP)',
    'Deduct EGP balance for late check-in & absence',
    'EGP',
    finePenalty
  ));

  openModal({
    title: sessionId ? 'Edit Attendance Session' : 'New Attendance Session',
    body: bodyEl,
    saveLabel: sessionId ? 'Save Changes' : 'Create Session',
    onSave: async () => {
      const title = currentTitle.trim();
      if (!title) {
        toast('Session title is required', 'error');
        return false;
      }

      // Calculate clean relative offsets in JS
      const [sHour, sMin] = selectedTimeStr.split(':').map(Number);
      const [oHour, oMin] = opensTimeStr.split(':').map(Number);
      const [cHour, cMin] = closesTimeStr.split(':').map(Number);

      const startTotalMins = (sHour || 0) * 60 + (sMin || 0);
      const openTotalMins = (oHour || 0) * 60 + (oMin || 0);
      const closeTotalMins = (cHour || 0) * 60 + (cMin || 0);

      const earlyCheckInMinutes = (startTotalMins - openTotalMins + 1440) % 1440;
      const lateCutoffMinutes = (closeTotalMins - startTotalMins + 1440) % 1440;

      const dateParts = selectedDateStr.split('-').map(Number);
      const startDateTimeMs = zonedDateToMs(
        dateParts[0] || 2026,
        dateParts[1] || 1,
        dateParts[2] || 1,
        sHour || 0,
        sMin || 0,
        0,
        APP_TIMEZONE
      );

      const finalSchedule = {
        type: schedType,
        startDateTime: startDateTimeMs
      };
      if (schedType === 'weekly') {
        finalSchedule.days = Array.from(weeklyDays);
      } else if (schedType === 'monthlyDates') {
        finalSchedule.dates = Array.from(monthlyDates).sort((a, b) => a - b);
        finalSchedule.monthDates = finalSchedule.dates;
      }

      const payload = {
        title,
        schedule: finalSchedule,
        earlyCheckInMinutes,
        lateCutoffMinutes,
        targetType,
        badgeIds: targetType === 'badge' ? Array.from(selectedBadgeIds) : [],
        assignedUids: targetType === 'custom' ? Array.from(assignedUids) : [],
        pointsPenalty: {
          enabled: Boolean(pointsPenalty.enabled),
          mode: pointsPenalty.mode,
          fixed: Number(pointsPenalty.fixed) || 0,
          stepUnit: pointsPenalty.stepUnit,
          stepSize: Number(pointsPenalty.stepSize) || 1,
          perStep: Number(pointsPenalty.perStep) || 0,
          min: Number(pointsPenalty.min) || 0,
          max: Number(pointsPenalty.max) || 999999,
          absence: Number(pointsPenalty.absence) || 0
        },
        finePenalty: {
          enabled: Boolean(finePenalty.enabled),
          mode: finePenalty.mode,
          fixed: Number(finePenalty.fixed) || 0,
          stepUnit: finePenalty.stepUnit,
          stepSize: Number(finePenalty.stepSize) || 1,
          perStep: Number(finePenalty.perStep) || 0,
          min: Number(finePenalty.min) || 0,
          max: Number(finePenalty.max) || 999999,
          absence: Number(finePenalty.absence) || 0
        },
        active: Boolean(active),

        // Legacy compatibility fields
        penaltyPointsEnabled: Boolean(pointsPenalty.enabled),
        penaltyFinesEnabled: Boolean(finePenalty.enabled),
        penaltyUnit: pointsPenalty.stepUnit || 'minutes',
        stepDuration: pointsPenalty.stepSize || 1,
        penaltyPerStep: pointsPenalty.perStep || 1,
        minPenalty: pointsPenalty.min || 0,
        maxPenalty: pointsPenalty.max || 999999,
        absencePenalty: pointsPenalty.absence || 20,
        absenceFineEGP: finePenalty.absence || 50
      };

      try {
        if (editingSessionId) {
          await updateDoc(doc(db, 'attendance_sessions', editingSessionId), {
            ...payload,
            updatedAt: serverTimestamp()
          });
          toast('Attendance session updated', 'success');
        } else {
          await addDoc(collection(db, 'attendance_sessions'), {
            ...payload,
            archived: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          toast('Attendance session created', 'success');
        }
        renderAdminSessions();
        renderAttendanceView();
        closeModal();
        return true;
      } catch (err) {
        console.error('Error saving attendance session:', err);
        toast('Failed to save session: ' + (err.message || err), 'error');
        return false;
      }
    }
  });
}

// =========================================================================
// SECTION 3: ADMIN "BADGES" MANAGEMENT DASHBOARD
// =========================================================================

export function renderAdminBadges() {
  const container = document.getElementById('admin-badges-list');
  if (!container) return;

  const allBadges = getAllAvailableBadges();
  if (allBadges.length === 0) {
    container.innerHTML = `
      <div class="col-span-full glass-card p-8 text-center text-xs text-neutral-400 border border-dashed border-white/10 rounded-2xl">
        No team badges created yet. Tap "+ New Badge" to create one.
      </div>
    `;
    return;
  }

  container.innerHTML = allBadges.map(badge => {
    const memberCount = (state.members || []).filter(m => {
      const uBadgeIds = Array.isArray(m.badgeIds) ? m.badgeIds : (
        Array.isArray(m.badges) ? m.badges.map(x => typeof x === 'string' ? x : x?.id).filter(Boolean) : []
      );
      return uBadgeIds.includes(badge.id);
    }).length;

    const color = badge.color || '#0A84FF';
    const iconSvg = getIconSvg(badge.icon || 'star', 'w-5 h-5');

    return `
      <div class="glass-card p-4 rounded-2xl border border-white/10 space-y-3 relative overflow-hidden" data-badge-id="${esc(badge.id)}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md" style="background-color: ${color}25; border: 1px solid ${color}50; color: ${color};">
              ${iconSvg}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-white text-sm truncate">${esc(badge.label || badge.name || badge.id)}</h3>
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color};"></span>
              </div>
              <p class="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">${esc(badge.description || 'No description provided.')}</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-neutral-300 shrink-0">
            ${memberCount} ${memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <button type="button" class="btn-edit-badge px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition" data-badge-id="${esc(badge.id)}">
            Edit
          </button>
          <button type="button" class="btn-delete-badge px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-medium transition" data-badge-id="${esc(badge.id)}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-badge').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const bId = btn.dataset.badgeId;
      const b = allBadges.find(x => x.id === bId);
      if (b) openBadgeModal(b);
    };
  });

  container.querySelectorAll('.btn-delete-badge').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const bId = btn.dataset.badgeId;
      const b = allBadges.find(x => x.id === bId);
      if (!b) return;

      const confirmed = await confirmSheet({
        title: 'Delete Badge',
        message: `Delete badge "${b.label || b.name || b.id}"? Existing members and past activity logs will be kept.`,
        confirmLabel: 'Delete Badge',
        destructive: true
      });
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, 'badges', b.id));
        state.badges = (state.badges || []).filter(x => x.id !== b.id);
        renderAdminBadges();
        toast('Badge deleted', 'info');
      } catch (err) {
        console.error('Error deleting badge:', err);
        toast('Failed to delete badge: ' + (err.message || err), 'error');
      }
    };
  });
}

export function openBadgeModal(badge = null) {
  let name = badge ? (badge.label || badge.name || '') : '';
  let description = badge ? (badge.description || '') : '';
  let selectedColor = badge ? (badge.color || '#0A84FF') : '#0A84FF';
  let selectedIcon = badge ? (badge.icon || 'star') : 'star';

  const PRESET_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#FF375F', '#FFD60A', '#5E5CE6', '#98989D'];

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4';

  function renderForm() {
    bodyEl.innerHTML = `
      <div class="space-y-3">
        <!-- Badge Name -->
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Badge Name *</label>
          <input type="text" id="badge-input-name" class="w-full glass-input text-xs" placeholder="e.g. Master Video Editor" value="${esc(name)}" />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Description</label>
          <textarea id="badge-input-desc" rows="2" class="w-full glass-input text-xs" placeholder="e.g. Awarded for editing top production videos.">${esc(description)}</textarea>
        </div>

        <!-- Icon Picker Row -->
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Badge Icon</label>
          <button type="button" id="btn-badge-icon-picker" class="w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition">
            <div class="flex items-center gap-2.5">
              <div id="badge-icon-preview" class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${selectedColor}25; color: ${selectedColor};">
                ${getIconSvg(selectedIcon, 'w-4 h-4')}
              </div>
              <span id="badge-icon-name" class="text-xs text-white capitalize font-medium">${esc(selectedIcon)}</span>
            </div>
            <span class="text-[11px] text-neutral-400">Change &rarr;</span>
          </button>
        </div>

        <!-- Color Swatches -->
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1.5">Badge Color</label>
          <div class="flex flex-wrap gap-2 pt-0.5">
            ${PRESET_COLORS.map(c => `
              <button type="button" class="btn-color-swatch w-7 h-7 rounded-full transition transform hover:scale-110 flex items-center justify-center ${selectedColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : ''}" style="background-color: ${c};" data-color="${c}">
                ${selectedColor === c ? '<span class="w-2 h-2 rounded-full bg-white"></span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Explicit Cancel Button -->
        <div class="pt-2 flex justify-end">
          <button type="button" id="badgeCancelBtn" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-300 text-xs font-semibold transition">
            Cancel
          </button>
        </div>
      </div>
    `;

    const nameInp = bodyEl.querySelector('#badge-input-name');
    if (nameInp) nameInp.oninput = (e) => { name = e.target.value; };

    const descInp = bodyEl.querySelector('#badge-input-desc');
    if (descInp) descInp.oninput = (e) => { description = e.target.value; };

    const iconBtn = bodyEl.querySelector('#btn-badge-icon-picker');
    if (iconBtn) {
      iconBtn.onclick = (e) => {
        e.preventDefault();
        openIconPicker({
          selectedKey: selectedIcon,
          onSelect: (newKey) => {
            selectedIcon = newKey;
            renderForm();
          }
        });
      };
    }

    bodyEl.querySelectorAll('.btn-color-swatch').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        selectedColor = btn.dataset.color;
        renderForm();
      };
    });

    const cancelBtn = bodyEl.querySelector('#badgeCancelBtn');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        closeModal();
      };
    }
  }

  renderForm();

  openModal({
    title: badge ? 'Edit Badge' : 'New Badge',
    body: bodyEl,
    saveLabel: badge ? 'Save Changes' : 'Create Badge',
    onSave: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast('Badge name is required', 'error');
        return false;
      }

      const badgeId = badge ? badge.id : (trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `badge_${Date.now()}`);

      const payload = {
        id: badgeId,
        label: trimmedName,
        name: trimmedName,
        description: description.trim(),
        color: selectedColor,
        icon: selectedIcon,
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(doc(db, 'badges', badgeId), payload, { merge: true });

        const idx = (state.badges || []).findIndex(b => b.id === badgeId);
        if (idx !== -1) {
          state.badges[idx] = { ...state.badges[idx], ...payload };
        } else {
          state.badges = [...(state.badges || []), payload];
        }

        renderAdminBadges();
        toast(badge ? 'Badge updated' : 'Badge created', 'success');
        closeModal();
        return true;
      } catch (err) {
        console.error('Error saving badge:', err);
        toast('Failed to save badge: ' + (err.message || err), 'error');
        return false;
      }
    }
  });
}

async function openAdminRosterModal(session, occurrenceKey, occurrenceStart) {
  const occKey = occurrenceKey || 'once';
  const occMs = Number(occurrenceStart) || Date.now();
  const dateStr = formatDateTime(occMs, { hour: undefined, minute: undefined });

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4';
  bodyEl.innerHTML = `
    <div class="p-6 text-center text-xs text-neutral-400">
      Loading roster for ${esc(session.title)}...
    </div>
  `;

  openModal({
    title: `${session.title} Roster`,
    body: bodyEl,
    saveLabel: 'Done',
    onSave: async () => true
  });

  try {
    // 1. Fetch logs for this session and occurrence
    const logsSnap = await getDocs(query(
      collection(db, 'attendance_logs'),
      where('sessionId', '==', session.id),
      where('occurrenceKey', '==', occKey),
      limit(450)
    ));
    const logs = logsSnap.docs.map(d => normalizeAttendanceLog({ id: d.id, ...d.data() }));

    // 2. Fetch waiver requests for this session and occurrence
    const waiversSnap = await getDocs(query(
      collection(db, 'waiver_requests'),
      where('sessionId', '==', session.id),
      where('occurrenceKey', '==', occKey),
      limit(450)
    ));
    const waiversMap = new Map();
    waiversSnap.docs.forEach(d => {
      const w = d.data();
      waiversMap.set(w.uid, { id: d.id, ...w });
    });

    // 3. Fetch active members list
    let members = state.members.filter(m => m.role === 'member');
    if (members.length === 0) {
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'member'),
        limit(450)
      ));
      members = usersSnap.docs.map(d => normalizeUser({ uid: d.id, ...d.data() }));
    }

    // Filter by assignedUids if specified
    if (Array.isArray(session.assignedUids) && session.assignedUids.length > 0) {
      members = members.filter(m => session.assignedUids.includes(m.uid));
    }

    const attendedMap = new Map();
    logs.forEach(l => attendedMap.set(l.uid, l));

    const presentList = [];
    const excusedList = [];
    const penalizedAbsentList = [];
    const unprocessedAbsentList = [];

    const nowMs = serverNow();
    const cutoffMs = occMs + (session.lateCutoffMinutes || 120) * 60000;
    const isClosed = nowMs > cutoffMs;

    members.forEach(m => {
      if (attendedMap.has(m.uid)) {
        const log = attendedMap.get(m.uid);
        if (log.status === 'absent') {
          penalizedAbsentList.push({ member: m, log });
        } else {
          presentList.push({ member: m, log });
        }
      } else if (waiversMap.get(m.uid)?.status === 'approved') {
        excusedList.push({ member: m, waiver: waiversMap.get(m.uid) });
      } else {
        unprocessedAbsentList.push(m);
      }
    });

    const onTimeCount = presentList.filter(p => p.log.status === 'on_time').length;
    const lateCount = presentList.filter(p => p.log.status === 'late' || p.log.penalty > 0).length;
    const totalPenalties = presentList.reduce((sum, p) => sum + (p.log.penalty || 0), 0) +
      penalizedAbsentList.reduce((sum, p) => sum + (p.log.penalty || 0), 0);
    const totalFines = presentList.reduce((sum, p) => sum + (p.log.fineEGP || 0), 0) +
      penalizedAbsentList.reduce((sum, p) => sum + (p.log.fineEGP || 0), 0);

    const renderRosterContent = () => {
      bodyEl.innerHTML = `
        <div class="text-xs text-neutral-400 mb-2 flex items-center justify-between">
          <span>Occurrence: <strong class="text-white">${dateStr}</strong> (${APP_TIMEZONE})</span>
          <span class="font-mono text-[10px] px-2 py-0.5 rounded ${isClosed ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}">
            ${isClosed ? 'Window Closed' : 'Check-in Open'}
          </span>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-4 gap-2 text-center text-xs">
          <div class="p-2 rounded-xl bg-white/[0.03]">
            <span class="text-[10px] text-neutral-400 block">Assigned</span>
            <span class="font-bold font-mono text-white mt-0.5">${members.length}</span>
          </div>
          <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span class="text-[10px] text-emerald-300 block">Present</span>
            <span class="font-bold font-mono text-emerald-400 mt-0.5">${presentList.length}</span>
          </div>
          <div class="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span class="text-[10px] text-blue-300 block">Excused</span>
            <span class="font-bold font-mono text-blue-400 mt-0.5">${excusedList.length}</span>
          </div>
          <div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span class="text-[10px] text-rose-300 block">Absent</span>
            <span class="font-bold font-mono text-rose-400 mt-0.5">${penalizedAbsentList.length + unprocessedAbsentList.length}</span>
          </div>
        </div>

        ${(totalPenalties > 0 || totalFines > 0) ? `
          <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between font-mono">
            <span>Deductions Incurred:</span>
            <span>${totalPenalties > 0 ? `-${totalPenalties} pts ` : ''}${totalFines > 0 ? `-${totalFines} EGP` : ''}</span>
          </div>
        ` : ''}

        <!-- Present Members -->
        <div class="space-y-2">
          <div class="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Attended (${presentList.length})</span>
            <span class="text-[10px] text-emerald-400 font-normal">${onTimeCount} on time, ${lateCount} late</span>
          </div>
          <div class="divide-y divide-white/5 rounded-xl bg-white/[0.02] border border-white/10 max-h-40 overflow-y-auto">
            ${presentList.length === 0 ? `
              <div class="p-3 text-xs text-neutral-400 text-center">No members checked in yet.</div>
            ` : presentList.map(({ member, log }) => {
              const isLate = log.status === 'late' || log.penalty > 0 || log.fineEGP > 0;
              const prof = getUserProfile(member.uid, member.displayName || member.name, member.photoURL || member.avatarUrl);
              return `
                <div class="roster-member-row p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.04] transition rounded-lg" data-member-uid="${esc(member.uid)}">
                  <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <div class="shrink-0">${renderAvatar(prof, 'w-7 h-7')}</div>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-white flex items-center gap-1.5 min-w-0">
                        <span class="truncate shrink-0 max-w-[100px]">${esc(prof.displayName)}</span>
                        <div class="badge-row-container flex items-center gap-1 min-w-0 flex-1 overflow-hidden" data-uid="${esc(member.uid)}"></div>
                      </div>
                      <div class="text-[10px] text-neutral-400">${formatDateTime(log.checkedInAt)}</div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${isLate ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
                      ${isLate ? `Late (-${log.penalty} pts${log.fineEGP > 0 ? ' -' + log.fineEGP + ' EGP' : ''})` : 'On Time'}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Excused Members (Approved Waivers) -->
        ${excusedList.length > 0 ? `
          <div class="space-y-2">
            <div class="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Excused (${excusedList.length})</span>
              <span class="text-[10px] text-blue-400 font-normal">Approved Waiver</span>
            </div>
            <div class="divide-y divide-white/5 rounded-xl bg-white/[0.02] border border-white/10 max-h-32 overflow-y-auto">
              ${excusedList.map(({ member, waiver }) => {
                const prof = getUserProfile(member.uid, member.displayName || member.name, member.photoURL || member.avatarUrl);
                return `
                  <div class="roster-member-row p-2 flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.04] transition rounded-lg" data-member-uid="${esc(member.uid)}">
                    <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div class="shrink-0">${renderAvatar(prof, 'w-6 h-6')}</div>
                      <div class="min-w-0 flex-1">
                        <span class="font-semibold text-white truncate block">${esc(prof.displayName)}</span>
                        <span class="text-[10px] text-neutral-400 truncate block">"${esc(waiver.reason)}"</span>
                      </div>
                    </div>
                    <span class="badge-waived px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono shrink-0">
                      Excused
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Absent Members (Penalized + Unprocessed) -->
        <div class="space-y-2">
          <div class="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Absent (${penalizedAbsentList.length + unprocessedAbsentList.length})</span>
            ${(isClosed && unprocessedAbsentList.length > 0) ? `
              <button id="btn-penalize-all-absent" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-sm">
                <span>Penalize All Unprocessed (${unprocessedAbsentList.length})</span>
              </button>
            ` : ''}
          </div>
          <div class="divide-y divide-white/5 rounded-xl bg-white/[0.02] border border-white/10 max-h-48 overflow-y-auto">
            ${(penalizedAbsentList.length === 0 && unprocessedAbsentList.length === 0) ? `
              <div class="p-3 text-xs text-emerald-400 text-center">All members present or excused!</div>
            ` : `
              <!-- Penalized Absentees -->
              ${penalizedAbsentList.map(({ member, log }) => {
                const prof = getUserProfile(member.uid, member.displayName || member.name, member.photoURL || member.avatarUrl);
                return `
                  <div class="roster-member-row p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.04] transition rounded-lg" data-member-uid="${esc(member.uid)}">
                    <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div class="shrink-0">${renderAvatar(prof, 'w-7 h-7')}</div>
                      <div class="min-w-0 flex-1">
                        <span class="font-semibold text-white truncate block">${esc(prof.displayName)}</span>
                        <span class="text-[10px] text-rose-400 font-mono">Penalized: -${log.penalty} pts${log.fineEGP > 0 ? ' -' + log.fineEGP + ' EGP' : ''}</span>
                      </div>
                    </div>
                    <span class="badge-penalized px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono shrink-0">
                      Absent (Penalized)
                    </span>
                  </div>
                `;
              }).join('')}

              <!-- Unprocessed Absentees -->
              ${unprocessedAbsentList.map(member => {
                const prof = getUserProfile(member.uid, member.displayName || member.name, member.photoURL || member.avatarUrl);
                return `
                  <div class="roster-member-row p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.04] transition rounded-lg" data-member-uid="${esc(member.uid)}">
                    <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div class="shrink-0">${renderAvatar(prof, 'w-7 h-7')}</div>
                      <div class="min-w-0 flex-1">
                        <span class="font-semibold text-white truncate block">${esc(prof.displayName)}</span>
                        <span class="text-[10px] text-neutral-400">Not checked in</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span class="badge-unprocessed px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono">
                        ${isClosed ? 'Absent' : 'Pending'}
                      </span>
                      ${isClosed ? `
                        <button class="btn-penalize-single px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white font-semibold text-[11px] border border-rose-500/30 transition" data-uid="${esc(member.uid)}">
                          Penalize
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            `}
          </div>
        </div>
      `;

      bodyEl.querySelectorAll('.badge-row-container').forEach(c => {
        const uid = c.dataset.uid;
        const mem = usersMap.get(uid) || state.members.find(m => m.uid === uid);
        if (mem) {
          renderBadgeRow(c, mem.badges, mem);
        }
      });

      bodyEl.querySelectorAll('.roster-member-row').forEach(row => {
        row.onclick = (e) => {
          if (e.target.closest('button')) return;
          const uid = row.dataset.memberUid;
          if (uid) openMiniProfileSheet(uid);
        };
      });

      // Wire Penalize All
      const penalizeAllBtn = bodyEl.querySelector('#btn-penalize-all-absent');
      if (penalizeAllBtn) {
        penalizeAllBtn.onclick = () => {
          applyAbsencePenalties([...unprocessedAbsentList], penalizeAllBtn);
        };
      }

      // Wire Penalize Single
      bodyEl.querySelectorAll('.btn-penalize-single').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetUid = btn.dataset.uid;
          const targetMember = unprocessedAbsentList.find(m => m.uid === targetUid);
          if (targetMember) {
            applyAbsencePenalties([targetMember], btn);
          }
        };
      });
    };

    // Idempotent Absence Penalty Application
    const applyAbsencePenalties = async (targetMembers, buttonEl) => {
      if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.textContent = 'Processing...';
      }

      const penaltyPts = (session.penaltyPointsEnabled !== false) ? (session.absencePenalty || session.maxPenalty || 20) : 0;
      const fineEGP = (session.penaltyFinesEnabled) ? (session.absenceFineEGP || session.maxPenalty || 50) : 0;

      let processedCount = 0;
      try {
        for (const m of targetMembers) {
          const deterministicId = `${session.id}_${occKey}_${m.uid}`;

          // Memory & Firestore idempotency check
          if (attendedMap.has(m.uid)) continue;
          const snap = await getDoc(doc(db, 'attendance_logs', deterministicId));
          if (snap.exists()) {
            attendedMap.set(m.uid, snap.data());
            continue;
          }

          const batch = writeBatch(db);
          const logRef = doc(db, 'attendance_logs', deterministicId);
          const logData = {
            sessionId: session.id,
            sessionTitle: session.title,
            uid: m.uid,
            userName: m.displayName || m.name || 'Member',
            userAvatar: m.avatarUrl || m.photoURL || '',
            occurrenceKey: occKey,
            occurrenceStart: Timestamp.fromMillis(occMs),
            checkedInAt: serverTimestamp(),
            status: 'absent',
            penalty: penaltyPts,
            fineEGP: fineEGP,
            processedBy: state.user.uid
          };
          batch.set(logRef, logData);

          if (penaltyPts > 0) {
            batch.update(doc(db, 'users', m.uid), {
              penalties: increment(penaltyPts),
              updatedAt: serverTimestamp()
            });
          }

          if (fineEGP > 0) {
            batch.set(doc(db, 'users_private', m.uid), {
              finesEGP: increment(fineEGP),
              updatedAt: serverTimestamp()
            }, { merge: true });

            const txRef = doc(collection(db, 'users', m.uid, 'transactions'));
            batch.set(txRef, {
              type: 'fine',
              category: 'financial',
              amount: fineEGP,
              reason: `Unexcused absence penalty: ${session.title}`,
              adminUid: state.user.uid,
              adminName: state.user.displayName || 'Admin',
              createdAt: serverTimestamp()
            });
          }

          createNotification(batch, {
            uid: m.uid,
            title: 'Absence Penalty Recorded',
            message: `Unexcused absence recorded for "${session.title}" (${penaltyPts > 0 ? penaltyPts + ' pts' : ''}${fineEGP > 0 ? ' ' + fineEGP + ' EGP' : ''}).`,
            type: 'attendance',
            targetAction: { route: 'attendance' }
          });

          logAdminAction(batch, {
            action: 'absence_penalty_applied',
            targetUid: m.uid,
            details: { sessionId: session.id, occKey, penaltyPts, fineEGP }
          });

          await batch.commit();
          attendedMap.set(m.uid, logData);
          penalizedAbsentList.push({ member: m, log: logData });
          const idx = unprocessedAbsentList.findIndex(x => x.uid === m.uid);
          if (idx !== -1) unprocessedAbsentList.splice(idx, 1);
          processedCount++;
        }

        toast(`Absence penalty applied for ${processedCount} member(s)`, 'success');
        renderRosterContent();
      } catch (err) {
        console.error('Error applying absence penalty:', err);
        toast(err.message || 'Failed to apply absence penalty', 'error');
        renderRosterContent();
      }
    };

    renderRosterContent();
  } catch (err) {
    console.error('Load roster error:', err);
    bodyEl.innerHTML = `<div class="p-4 text-xs text-rose-400 text-center">Failed to load roster: ${esc(err.message)}</div>`;
  }
}

function renderAdminAttendanceLogs() {
  const tbody = document.getElementById('admin-attendance-logs-tbody');
  const countEl = document.getElementById('admin-attendance-log-count');
  if (!tbody) return;

  const logs = state.attendanceLogs || [];
  if (countEl) countEl.textContent = `${logs.length} logs`;

  if (logs.length === 0) {
    tbody.innerHTML = '<div class="p-3 text-xs text-neutral-400 text-center">No recent check-in logs.</div>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const isLate = l.status === 'late' || l.penalty > 0;
    const prof = getUserProfile(l.uid, l.userName, l.userAvatar);
    return `
      <div class="inset-row flex items-center justify-between py-2 text-xs">
        <div class="flex items-center gap-2">
          ${renderAvatar(prof, 'w-7 h-7')}
          <div>
            <div class="font-semibold text-white">${esc(prof.displayName)}</div>
            <div class="text-[10px] text-neutral-400">${esc(l.sessionTitle)} • ${formatDateTime(l.checkedInAt)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${isLate ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}">
            ${isLate ? `-${l.penalty} EGP` : 'On Time'}
          </span>
          <button class="btn-delete-attendance-log text-rose-400 text-xs px-1.5 py-0.5 rounded hover:bg-rose-500/10" data-log-id="${esc(l.id)}">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-delete-attendance-log').forEach(btn => {
    btn.onclick = async () => {
      const confirm = await confirmSheet({
        title: 'Delete Attendance Log',
        message: 'Remove this check-in record? This cannot be undone.',
        confirmLabel: 'Remove',
        destructive: true
      });
      if (confirm) {
        await deleteDoc(doc(db, 'attendance_logs', btn.dataset.logId));
        toast('Log removed', 'info');
      }
    };
  });
}

/* ==========================================================================
   ADMIN CONTROLS: SUBMISSIONS INSPECTOR, MEMBER CONTROL, REPAIR TOTALS (Task 5)
   ========================================================================== */

function getFilteredAdminSubmissions() {
  const queryText = (state.adminSubmissionsSearch || '').toLowerCase().trim();
  const taskFilter = state.adminSubmissionsTaskFilter || 'all';

  return state.submissions.filter(s => {
    if (taskFilter !== 'all' && s.taskId !== taskFilter) {
      return false;
    }
    if (!queryText) return true;

    const nameMatch = (s.userName || '').toLowerCase().includes(queryText);
    const emailMatch = (s.userEmail || '').toLowerCase().includes(queryText);
    const taskMatch = (s.taskTitle || '').toLowerCase().includes(queryText);
    const commentMatch = (s.comment || s.notes || '').toLowerCase().includes(queryText);
    const answersMatch = Array.isArray(s.answers) && s.answers.some(a => String(a || '').toLowerCase().includes(queryText));

    return nameMatch || emailMatch || taskMatch || commentMatch || answersMatch;
  });
}


async function renderAdminMissedTasks() {
  const container = document.getElementById('admin-missed-tasks-container');
  const listEl = document.getElementById('admin-missed-tasks-list');
  const countBadge = document.getElementById('admin-missed-tasks-count-badge');
  if (!container || !listEl) return;

  const now = serverNow();
  const nowMs = parseDateTimeToMs(now);
  const missedTasksList = [];

  const candidateTasks = (state.tasks || []).filter(t => t.active && !t.archived && t.missedPenalty?.enabled && !t.isPermanent);

  for (const task of candidateTasks) {
    const win = getTaskWindow(task, nowMs);
    if (!win || !win.closesAt) continue;

    const graceMs = (task.tieredRewards?.enabled ? (Number(task.tieredRewards.graceMinutes) || 120) : 0) * 60000;
    const deadlineWithGrace = win.closesAt + graceMs;

    if (nowMs <= deadlineWithGrace) continue; // Not closed yet

    const occurrenceKey = win.occurrenceKey || 'once';

    // Target members
    let targets = [];
    if (Array.isArray(task.assignedUids) && task.assignedUids.length > 0) {
      targets = task.assignedUids.map(uid => usersMap.get(uid)).filter(Boolean);
    } else {
      targets = Array.from(usersMap.values()).filter(m => m.role !== 'archived' && !m.archived);
    }

    const missedMembers = [];
    for (const member of targets) {
      const lockDocId = `${task.id}_${occurrenceKey}_${member.uid}`;
      if (state.appliedMissedPenalties?.has(lockDocId)) continue;

      const hasSubmitted = (state.submissions || []).some(s =>
        s.taskId === task.id &&
        (task.schedule?.type === 'once' ? true : s.occurrenceKey === occurrenceKey) &&
        (s.uid === member.uid || s.userId === member.uid)
      );

      if (!hasSubmitted) {
        missedMembers.push(member);
      }
    }

    if (missedMembers.length > 0) {
      missedTasksList.push({
        task,
        occurrenceKey,
        missedMembers,
        penaltyPoints: Number(task.missedPenalty.points) || 5
      });
    }
  }

  const totalMissedCount = missedTasksList.reduce((acc, curr) => acc + curr.missedMembers.length, 0);

  if (totalMissedCount === 0) {
    container.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  if (countBadge) countBadge.textContent = String(totalMissedCount);

  listEl.innerHTML = missedTasksList.map(item => `
    <div class="glass-card p-3 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div class="space-y-0.5 min-w-0">
        <div class="font-bold text-white text-xs flex items-center gap-2">
          <span>${esc(item.task.title)}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">-${item.penaltyPoints} pts</span>
        </div>
        <p class="text-[11px] text-neutral-300">
          <strong class="text-amber-400 font-mono">${item.missedMembers.length}</strong> member${item.missedMembers.length === 1 ? '' : 's'} missed deadline: ${item.missedMembers.slice(0, 3).map(m => esc(m.displayName || m.name)).join(', ')}${item.missedMembers.length > 3 ? ` + ${item.missedMembers.length - 3} more` : ''}
        </p>
      </div>
      <button type="button" class="btn-apply-task-penalty shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition active:scale-95 flex items-center justify-center gap-1.5" data-task-id="${esc(item.task.id)}" data-occ-key="${esc(item.occurrenceKey)}">
        <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>Apply Penalty (${item.missedMembers.length})</span>
      </button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-apply-task-penalty').forEach(btn => {
    btn.onclick = async () => {
      const taskId = btn.dataset.taskId;
      const occKey = btn.dataset.occKey;
      const targetItem = missedTasksList.find(x => x.task.id === taskId && x.occurrenceKey === occKey);
      if (!targetItem) return;

      const confirmed = await confirmSheet({
        title: 'Apply Missed Deadline Penalty?',
        message: `Apply -${targetItem.penaltyPoints} penalty points to ${targetItem.missedMembers.length} member(s) who missed "${targetItem.task.title}"?`,
        confirmLabel: 'Apply Penalties',
        destructive: true
      });
      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = 'Applying penalties...';

      try {
        const batch = writeBatch(db);
        const processedDocIds = [];

        for (const member of targetItem.missedMembers) {
          const lockDocId = `${targetItem.task.id}_${targetItem.occurrenceKey}_${member.uid}`;
          
          // Verify with Firestore getDoc for cross-tab idempotency
          const lockDocRef = doc(db, 'missed_penalties', lockDocId);
          const lockSnap = await getDoc(lockDocRef);
          if (lockSnap.exists()) {
            state.appliedMissedPenalties.add(lockDocId);
            continue;
          }

          batch.set(lockDocRef, {
            taskId: targetItem.task.id,
            occurrenceKey: targetItem.occurrenceKey,
            uid: member.uid,
            penaltyPoints: targetItem.penaltyPoints,
            adminUid: state.user.uid,
            createdAt: serverTimestamp()
          });

          const userRef = doc(db, 'users', member.uid);
          batch.update(userRef, {
            penalties: increment(targetItem.penaltyPoints),
            updatedAt: serverTimestamp()
          });

          const txRef = doc(collection(db, 'users', member.uid, 'transactions'));
          batch.set(txRef, {
            type: 'penalty',
            category: 'penalty',
            amount: targetItem.penaltyPoints,
            reason: `Missed task penalty: ${targetItem.task.title}`,
            adminUid: state.user.uid,
            adminName: state.user.displayName || 'Admin',
            createdAt: serverTimestamp()
          });

          createNotification(batch, {
            uid: member.uid,
            title: 'Missed Task Penalty',
            message: `A penalty of ${targetItem.penaltyPoints} points was recorded for missing the task "${targetItem.task.title}".`,
            type: 'task',
            refId: lockDocId
          });

          logAdminAction(batch, {
            action: 'apply_missed_task_penalty',
            targetUid: member.uid,
            details: {
              taskId: targetItem.task.id,
              taskTitle: targetItem.task.title,
              occurrenceKey: targetItem.occurrenceKey,
              penaltyPoints: targetItem.penaltyPoints,
              lockDocId
            }
          });

          processedDocIds.push(lockDocId);
        }

        if (processedDocIds.length > 0) {
          await batch.commit();
          processedDocIds.forEach(id => state.appliedMissedPenalties.add(id));
          toast(`Penalties applied to ${processedDocIds.length} member(s)`, 'success');
        } else {
          toast('All missed penalties were already processed.', 'info');
        }

        renderAdminMissedTasks();
      } catch (err) {
        console.error('Error applying missed penalties:', err);
        toast(err.message || 'Failed to apply missed penalties', 'error');
        btn.disabled = false;
        btn.textContent = 'Apply Penalty';
      }
    };
  });
}

function renderAdminSubmissions() {
  renderAdminMissedTasks();
  const list = document.getElementById('admin-submissions-list');
  const taskSelect = document.getElementById('select-admin-filter-task');
  const loadMoreBtn = document.getElementById('btn-load-more-submissions');
  if (!list) return;

  // Populate task filter dropdown if not focused
  if (taskSelect && document.activeElement !== taskSelect) {
    const currentVal = state.adminSubmissionsTaskFilter || 'all';
    const taskOptions = [`<option value="all">All Tasks</option>`];
    state.tasks.forEach(t => {
      taskOptions.push(`<option value="${esc(t.id)}"${currentVal === t.id ? ' selected' : ''}>${esc(t.title)}</option>`);
    });
    taskSelect.innerHTML = taskOptions.join('');
  }

  // Update load more button visibility
  if (loadMoreBtn) {
    if (state.hasMoreSubmissions) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }

  const filtered = getFilteredAdminSubmissions();

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="glass-card p-6 text-center text-xs text-neutral-400 space-y-1">
        <p class="font-semibold text-white">No submissions found</p>
        <p class="text-[11px]">Adjust your search query or task filter to inspect records.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const task = state.tasks.find(t => t.id === s.taskId);
    const dateFormatted = formatDateTime(s.submittedAt);

    // Build question/answer elements
    let qaHtml = '';
    if (task && Array.isArray(task.questions) && task.questions.length > 0) {
      qaHtml = (Array.isArray(s.answers) && s.answers.length > 0)
      ? s.answers.map((a, idx) => {
          let prompt = '';
          let ansText = '';
          if (typeof a === 'string') {
            prompt = task?.questions?.[idx]?.questionText || `Question ${idx + 1}`;
            ansText = a;
          } else if (a && typeof a === 'object') {
            prompt = a.questionText || task?.questions?.[idx]?.questionText || `Question ${idx + 1}`;
            if (a.type === 'mcq') {
              ansText = a.answer === 'Other' ? `Other: ${a.otherText || ''}` : (a.answer || '');
            } else {
              ansText = a.answer || '';
            }
          }
          return `
            <div class="p-2 rounded-lg bg-black/20 border border-white/5 space-y-1">
              <div class="font-semibold text-neutral-300 text-[11px]">${esc(prompt)}</div>
              <div class="text-white text-xs">${ansText ? esc(ansText) : '<span class="text-neutral-500 italic">No answer</span>'}</div>
            </div>
          `;
        }).join('')
      : (task?.questions ? task.questions.map((q, idx) => `
          <div class="p-2 rounded-lg bg-black/20 border border-white/5 space-y-1">
            <div class="font-semibold text-neutral-300 text-[11px]">${esc(q.questionText || `Question ${idx + 1}`)}</div>
            <div class="text-neutral-500 italic text-xs">No answer</div>
          </div>
        `).join('') : '');
    }

    const comment = s.comment || s.notes || '';
    const isSelected = selectionState.active && selectionState.type === 'submissions' && selectionState.selectedIds.has(s.id);
    const userProf = getUserProfile(s.userId || s.uid, s.userName, s.userAvatar);

    return `
      <div class="glass-card bulk-select-card p-4 space-y-3 text-xs${isSelected ? ' selected' : ''}" data-sub-id="${esc(s.id)}" data-bulk-id="${esc(s.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content space-y-3 w-full">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition btn-view-sub-member" data-member-uid="${esc(s.userId || s.uid)}">
              ${renderAvatar(userProf, 'w-9 h-9')}
              <div>
                <div class="font-bold text-white text-sm">${esc(userProf.displayName)}</div>
                <div class="text-[11px] text-neutral-400 flex items-center gap-1.5 flex-wrap">
                  <span>${esc(userProf.email || s.userEmail || s.uid)}</span>
                  <span>•</span>
                  <span>${dateFormatted}</span>
                </div>
              </div>
            </div>
            <span class="font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs whitespace-nowrap">
              +${s.pointsAwarded || 0} pts
            </span>
          </div>

          <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-[#0A84FF] text-xs">${esc(s.taskTitle)}</span>
              <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">${esc(s.occurrenceKey || 'once')}</span>
            </div>

            ${qaHtml ? `<div class="space-y-1.5 pt-1">${qaHtml}</div>` : ''}

            ${comment ? `
              <div class="pt-1 text-[11px] text-neutral-300 bg-black/20 p-2 rounded-lg border border-white/5">
                <span class="font-semibold text-neutral-400">Comment:</span> ${esc(comment)}
              </div>
            ` : ''}
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button class="btn-sub-edit-points px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition" data-sub-id="${esc(s.id)}">
              Edit Points
            </button>
            <button class="btn-sub-revoke px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition" data-sub-id="${esc(s.id)}">
              Revoke
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.glass-card').forEach(card => {
    card.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'submissions') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
    };

    attachLongPress(card, () => {
      enterSelectionMode('submissions', card.dataset.bulkId);
    });
  });

  list.querySelectorAll('.btn-view-sub-member').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      openMiniProfileSheet(el.dataset.memberUid);
    };
  });

  // Wire action buttons
  list.querySelectorAll('.btn-sub-edit-points').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'submissions') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const sub = state.submissions.find(x => x.id === btn.dataset.subId);
      if (sub) openAdminEditSubmissionModal(sub);
    };
  });

  list.querySelectorAll('.btn-sub-revoke').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'submissions') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const sub = state.submissions.find(x => x.id === btn.dataset.subId);
      if (sub) handleAdminRevokeSubmission(sub);
    };
  });
}


// ============================================================================
// TASK 6: ATTENDANCE ASSIGNMENTS, IDEMPOTENT ABSENCE & WAIVER REQUESTS
// ============================================================================

export function generateFutureOccurrences(sessionTemplate, count = 52) {
  if (!sessionTemplate) return [];
  const schedule = sessionTemplate.schedule || sessionTemplate;
  const nowMs = Date.now();
  const oneYearAheadMs = nowMs + 365 * 24 * 60 * 60 * 1000;

  let rawTimestamps = [];
  try {
    rawTimestamps = getOccurrences(schedule, nowMs, oneYearAheadMs, APP_TIMEZONE);
  } catch (err) {
    console.warn('generateFutureOccurrences error:', err);
  }

  if (!rawTimestamps || rawTimestamps.length === 0) {
    const rawStart = schedule?.startDateTime || sessionTemplate.startDateTime || sessionTemplate.createdAt;
    const fallbackStart = parseDateTimeToMs(rawStart);
    if (typeof fallbackStart === 'number' && !isNaN(fallbackStart) && fallbackStart >= nowMs && fallbackStart <= oneYearAheadMs) {
      rawTimestamps.push(fallbackStart);
    }
  }

  const uniqueSorted = Array.from(new Set(rawTimestamps))
    .filter(ms => typeof ms === 'number' && !isNaN(ms) && ms >= nowMs)
    .sort((a, b) => a - b)
    .slice(0, count);

  return uniqueSorted.map(dateMs => {
    const d = new Date(dateMs);
    const dateStr = d.toISOString().slice(0, 10);
    const formattedDate = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: APP_TIMEZONE || undefined
    });
    const formattedTime = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: APP_TIMEZONE || undefined
    });

    const monthNum = d.getMonth() + 1;
    const dayNum = d.getDate();
    const monthShort = d.toLocaleDateString('en-US', { month: 'short', timeZone: APP_TIMEZONE }).toLowerCase();
    const monthLong = d.toLocaleDateString('en-US', { month: 'long', timeZone: APP_TIMEZONE }).toLowerCase();
    const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: APP_TIMEZONE }).toLowerCase();
    const weekdayLong = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: APP_TIMEZONE }).toLowerCase();

    // Normalized search variations string (e.g., "2026-11-08 11/8 11-8 8/11 8-11 8 nov november sunday sun...")
    const searchTerms = `${dateStr} ${monthNum}/${dayNum} ${monthNum}-${dayNum} ${dayNum}/${monthNum} ${dayNum}-${monthNum} ${dayNum} ${monthShort} ${monthLong} ${weekdayShort} ${weekdayLong} ${formattedDate} ${formattedTime}`.toLowerCase();

    return {
      dateMs,
      dateStr,
      formattedDate,
      formattedTime,
      searchTerms,
      key: `occ_${dateMs}`
    };
  });
}

export function openRequestWaiverModal() {
  if (!state.user) {
    toast('Please sign in to submit a waiver request', 'error');
    if (typeof userPagerInstance !== 'undefined' && userPagerInstance?.goTo) {
      userPagerInstance.goTo('profile');
    }
    return;
  }

  // STEP 1: Find UNIQUE service templates the user is rostered for
  const assignedSessions = (state.attendanceSessions || []).filter(session => {
    if (session.active === false || session.archived) return false;
    const targetType = session.targetType || (Array.isArray(session.assignedUids) && session.assignedUids.length > 0 ? 'custom' : (Array.isArray(session.badgeIds) && session.badgeIds.length > 0 ? 'badge' : 'all'));
    if (targetType === 'badge') {
      const uBadges = new Set([...(state.user?.badgeIds || []), ...(state.user?.badges || []).map(b => typeof b === 'string' ? b : b?.id).filter(Boolean)]);
      const sBadges = session.badgeIds || [];
      if (sBadges.length > 0 && !sBadges.some(bid => uBadges.has(bid))) return false;
    } else if (targetType === 'custom') {
      if (Array.isArray(session.assignedUids) && !session.assignedUids.includes(state.user.uid)) return false;
    }
    return true;
  });

  let currentStep = 1;
  let selectedSession = null;
  let selectedOccurrenceDateMs = null;
  let selectedOccurrence = null;
  let selectedCategory = 'Exams / Study';
  let dateSearchQuery = '';

  const WAIVER_REASON_CATEGORIES = [
    { id: 'Exams / Study', label: 'Exams / Study', icon: 'clipboard', prefill: 'Exams and academic study preparation.' },
    { id: 'Medical', label: 'Medical', icon: 'heart', prefill: 'Medical appointment or health condition.' },
    { id: 'Other Service', label: 'Other Service', icon: 'users', prefill: 'Serving in another church service / ministry.' },
    { id: 'Travel', label: 'Travel', icon: 'compass', prefill: 'Traveling out of town during session hours.' },
    { id: 'Other', label: 'Other', icon: 'info', prefill: '' }
  ];

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-4 text-xs';

  function renderView() {
    bodyEl.innerHTML = '';

    if (currentStep === 1) {
      // STEP 1: Unique Service Templates Selection
      const headerBox = document.createElement('div');
      headerBox.className = 'space-y-1 mb-2';
      headerBox.innerHTML = `
        <div class="ios-title-3 text-white font-bold text-sm">Step 1: Select Service Template</div>
        <p class="text-neutral-400 text-xs">Choose the assigned service you need to request an excuse for.</p>
      `;
      bodyEl.appendChild(headerBox);

      if (assignedSessions.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'glass-card p-6 text-center space-y-2 border border-dashed border-white/10 rounded-2xl';
        emptyDiv.innerHTML = `
          <div class="w-12 h-12 mx-auto rounded-full bg-white/[0.05] flex items-center justify-center text-neutral-400">
            <svg class="w-6 h-6 stroke-current fill-none" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div class="font-bold text-white text-sm">No Assigned Services</div>
          <p class="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
            You are not rostered for any active attendance sessions.
          </p>
        `;
        bodyEl.appendChild(emptyDiv);
      } else {
        const listDiv = document.createElement('div');
        listDiv.className = 'space-y-2 max-h-72 overflow-y-auto pr-1';

        assignedSessions.forEach(session => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'w-full p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition flex items-center justify-between gap-3';
          card.innerHTML = `
            <div class="min-w-0 flex-1">
              <div class="font-bold text-white text-sm truncate">${esc(session.title)}</div>
              <div class="text-[11px] text-neutral-400 mt-0.5 capitalize">Schedule: ${session.schedule?.type || 'Standard'}</div>
            </div>
            <div class="text-[#0A84FF] text-xs font-semibold shrink-0 flex items-center gap-1">
              <span>Choose</span>
              <span>&rarr;</span>
            </div>
          `;
          card.onclick = () => {
            selectedSession = session;
            const futureOccs = generateFutureOccurrences(session, 52);
            selectedOccurrence = futureOccs[0] || null;
            selectedOccurrenceDateMs = futureOccs[0]?.dateMs || null;
            currentStep = 2;
            renderView();
          };
          listDiv.appendChild(card);
        });
        bodyEl.appendChild(listDiv);
      }
    } else {
      // STEP 2: Pick Specific Date Occurrence & Fill Excuse Details
      const topRow = document.createElement('div');
      topRow.className = 'flex items-center justify-between pb-2 border-b border-white/10';
      topRow.innerHTML = `
        <button type="button" id="btn-waiver-back" class="text-xs text-[#0A84FF] font-semibold flex items-center gap-1 hover:underline">
          &larr; Back to Services
        </button>
        <span class="font-semibold text-white truncate max-w-[180px] text-xs">${esc(selectedSession.title)}</span>
      `;
      const backBtn = topRow.querySelector('#btn-waiver-back');
      backBtn.onclick = () => {
        currentStep = 1;
        renderView();
      };
      bodyEl.appendChild(topRow);

      const futureOccs = generateFutureOccurrences(selectedSession, 52);
      if (selectedOccurrenceDateMs === null && futureOccs.length > 0) {
        selectedOccurrenceDateMs = futureOccs[0].dateMs;
        selectedOccurrence = futureOccs[0];
      }

      const step2Box = document.createElement('div');
      step2Box.className = 'space-y-3.5 pt-1';

      step2Box.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Select Which Occurrence Date</label>
          <input type="text" id="excuseDateSearch" class="input-field w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs mb-2 focus:outline-none focus:border-[#0A84FF]" placeholder="Search upcoming dates..." value="${esc(dateSearchQuery)}" />
          <div id="excuseOccurrencesList" class="space-y-1.5 max-h-44 overflow-y-auto pr-1"></div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1.5">Reason Category</label>
          <div class="flex flex-wrap gap-1.5" id="waiver-cat-chips">
            ${WAIVER_REASON_CATEGORIES.map(cat => `
              <button type="button" class="btn-waiver-cat px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${selectedCategory === cat.id ? 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-sm' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}" data-cat="${esc(cat.id)}">
                ${esc(cat.label)}
              </button>
            `).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-neutral-200 mb-1">Explanation Note *</label>
          <textarea id="waiver-reason-input" class="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-neutral-500 text-xs leading-relaxed focus:outline-none focus:border-[#0A84FF] transition" rows="3" placeholder="Explain why you cannot attend this session...">${esc(WAIVER_REASON_CATEGORIES.find(c => c.id === selectedCategory)?.prefill || '')}</textarea>
        </div>
        <button type="button" id="btn-submit-waiver" class="w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
          Submit Excuse Request
        </button>
      `;

      const listContainer = step2Box.querySelector('#excuseOccurrencesList');
      function renderOccurrencesRows() {
        if (!listContainer) return;
        const filtered = futureOccs.filter(occ => {
          if (!dateSearchQuery) return true;
          const q = dateSearchQuery.toLowerCase().trim();
          return (occ.searchTerms || '').includes(q);
        });

        if (filtered.length === 0) {
          listContainer.innerHTML = '<div class="py-4 text-center text-xs text-neutral-400">No matching dates found</div>';
          return;
        }

        listContainer.innerHTML = filtered.map(occ => {
          const isSelected = selectedOccurrenceDateMs === occ.dateMs;
          return `
            <button type="button" class="occurrence-row btn-occ-radio w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${isSelected ? 'bg-[#0A84FF]/20 border-[#0A84FF] text-white font-semibold' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}" data-date-ms="${occ.dateMs}" data-search="${esc(occ.searchTerms || '')}">
              <span>${occ.formattedDate} at ${occ.formattedTime}</span>
              <div class="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-[#0A84FF] bg-[#0A84FF] text-white' : 'border-white/20 bg-white/5'}">
                ${isSelected ? '<svg class="w-3 h-3 stroke-current fill-none" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
              </div>
            </button>
          `;
        }).join('');

        listContainer.querySelectorAll('.btn-occ-radio').forEach(b => {
          b.onclick = () => {
            selectedOccurrenceDateMs = Number(b.dataset.dateMs);
            selectedOccurrence = futureOccs.find(o => o.dateMs === selectedOccurrenceDateMs) || null;
            renderOccurrencesRows();
          };
        });
      }

      renderOccurrencesRows();

      const searchInput = step2Box.querySelector('#excuseDateSearch');
      if (searchInput) {
        searchInput.oninput = (e) => {
          dateSearchQuery = e.target.value.trim();
          renderOccurrencesRows();
        };
      }

      step2Box.querySelectorAll('.btn-waiver-cat').forEach(b => {
        b.onclick = () => {
          selectedCategory = b.dataset.cat;
          const prefill = WAIVER_REASON_CATEGORIES.find(c => c.id === selectedCategory)?.prefill || '';
          const reasonInp = step2Box.querySelector('#waiver-reason-input');
          if (reasonInp) reasonInp.value = prefill;
          step2Box.querySelectorAll('.btn-waiver-cat').forEach(btn => {
            const isActive = btn.dataset.cat === selectedCategory;
            btn.className = `btn-waiver-cat px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${isActive ? 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-sm' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
          });
        };
      });

      const submitBtn = step2Box.querySelector('#btn-submit-waiver');
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const reasonVal = step2Box.querySelector('#waiver-reason-input')?.value.trim();
          if (!reasonVal) {
            toast('Please provide a reason for the excuse request', 'error');
            return;
          }
          if (!selectedOccurrenceDateMs) {
            toast('Please select an occurrence date', 'error');
            return;
          }

          const occKey = `occ_${selectedOccurrenceDateMs}`;
          const deterministicId = `waiver_${selectedSession.id}_${occKey}_${state.user.uid}`;

          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';

          try {
            await setDoc(doc(db, 'waiver_requests', deterministicId), {
              sessionId: selectedSession.id,
              sessionTemplateId: selectedSession.id,
              sessionTitle: selectedSession.title,
              occurrenceKey: occKey,
              selectedOccurrenceDateMs: selectedOccurrenceDateMs,
              occurrenceStart: Timestamp.fromMillis(selectedOccurrenceDateMs),
              uid: state.user.uid,
              userName: state.user.name || state.user.displayName || 'Member',
              userEmail: state.user.email || '',
              userAvatar: state.user.avatarUrl || state.user.photoURL || '',
              category: selectedCategory,
              reason: reasonVal,
              status: 'pending',
              adminNote: '',
              reviewedBy: '',
              reviewedAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            toast('Excuse request submitted for admin review', 'success');
            closeModal();
          } catch (err) {
            console.error('Error submitting waiver:', err);
            toast('Failed to submit: ' + err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Excuse Request';
          }
        };
      }

      bodyEl.appendChild(step2Box);
    }
  }

  renderView();

  openModal({
    title: 'Attendance Excuse Request',
    body: bodyEl,
    saveLabel: null
  });
}

function updateWaiversBadge(count) {
  const n = typeof count === 'number' ? count : (state.waiverRequests || []).filter(w => w.status === 'pending').length;
  const dockBadge = document.getElementById('admin-waivers-dock-badge');
  if (dockBadge) {
    dockBadge.textContent = n > 99 ? '99+' : String(n);
    dockBadge.classList.toggle('hidden', n === 0);
  }
}

function formatWaiverTargetDate(w) {
  const ms = w.occurrenceStart ? parseDateTimeToMs(w.occurrenceStart) : NaN;
  if (Number.isFinite(ms)) {
    return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_TIMEZONE });
  }
  return w.occurrenceKey || '';
}

function renderAdminWaivers() {
  const container = document.getElementById('admin-waivers-list');
  const countEl = document.getElementById('admin-waiver-count');
  const labelEl = document.getElementById('admin-waivers-filter-label');
  const segMount = document.getElementById('admin-waivers-segmented-mount');
  if (!container) return;

  const filter = state.adminWaiverFilter || 'pending';
  const all = state.waiverRequests || [];
  updateWaiversBadge(all.filter(w => w.status === 'pending').length);

  // Segmented control: mounted once, then only its value is synced
  if (segMount && !segMount.firstChild) {
    segMount.appendChild(renderSegmented({
      id: 'admin-waivers-segmented',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
      ],
      value: filter,
      onChange: (val) => {
        state.adminWaiverFilter = val;
        renderAdminWaivers();
      }
    }));
  }

  const waivers = all.filter(w => w.status === filter);
  if (countEl) countEl.textContent = `${waivers.length} request${waivers.length === 1 ? '' : 's'}`;
  if (labelEl) labelEl.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);

  if (waivers.length === 0) {
    container.innerHTML = `
      <div class="ios-card text-center text-xs text-neutral-400 py-6">
        ${filter === 'pending' ? 'No pending excuse requests. You are all caught up.' : `No ${filter} excuse requests.`}
      </div>`;
    return;
  }

  container.innerHTML = waivers.map(w => {
    const prof = getUserProfile(w.uid, w.userName, w.userAvatar);
    const isPending = w.status === 'pending';
    const statusCls = w.status === 'approved' ? 'waiver-status-approved' : w.status === 'rejected' ? 'waiver-status-rejected' : 'waiver-status-pending';
    return `
      <div class="ios-card space-y-3 text-xs" style="margin-bottom:0" data-waiver-id="${esc(w.id)}">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            ${renderAvatar(prof, 'w-9 h-9')}
            <div class="min-w-0">
              <div class="font-bold text-white text-sm truncate">${esc(prof.displayName || w.userName)}</div>
              <div class="text-[11px] text-[#0A84FF] truncate font-medium">${esc(w.sessionTitle)}</div>
            </div>
          </div>
          <span class="${statusCls} px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">${esc(w.status.charAt(0).toUpperCase() + w.status.slice(1))}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="text-[10px] uppercase font-semibold text-neutral-500">Target Date</div>
            <div class="text-neutral-200">${esc(formatWaiverTargetDate(w))}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase font-semibold text-neutral-500">Category</div>
            <div class="text-neutral-200">${esc(w.category || 'Other')}</div>
          </div>
        </div>

        <div>
          <div class="text-[10px] uppercase font-semibold text-neutral-500 mb-1">Explanation</div>
          <div class="p-2.5 rounded-lg bg-black/30 text-neutral-200 leading-relaxed">${esc(w.reason)}</div>
          ${!isPending && w.adminNote ? `<div class="text-[10px] text-neutral-400 mt-1.5">Admin note: ${esc(w.adminNote)}</div>` : ''}
        </div>

        ${isPending ? `
          <input type="text" class="input-waiver-note ios-input" placeholder="Optional note for the member..." />
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn-reject-waiver py-2.5 rounded-xl font-bold text-white text-sm transition" style="background:#FF453A" data-id="${esc(w.id)}">Reject</button>
            <button type="button" class="btn-approve-waiver py-2.5 rounded-xl font-bold text-black text-sm transition" style="background:#30D158" data-id="${esc(w.id)}">Approve</button>
          </div>
        ` : ''}
      </div>`;
  }).join('');

  const resolveWaiver = async (waiverId, newStatus, cardEl) => {
    const waiver = (state.waiverRequests || []).find(w => w.id === waiverId);
    if (!waiver || !cardEl) return;

    const noteInput = cardEl.querySelector('.input-waiver-note');
    const adminNote = noteInput?.value.trim() || '';
    cardEl.querySelectorAll('button').forEach(b => { b.disabled = true; });

    const verb = newStatus === 'approved' ? 'Approved' : 'Rejected';
    const targetDate = formatWaiverTargetDate(waiver);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'waiver_requests', waiver.id), {
        status: newStatus,
        excused: newStatus === 'approved',
        adminNote,
        resolvedAt: serverTimestamp(),
        resolvedBy: state.user.uid,
        reviewedAt: serverTimestamp(),
        reviewedBy: state.user.uid,
        updatedAt: serverTimestamp()
      });

      // In-app notification for the member
      createNotification(batch, {
        uid: waiver.uid,
        title: 'Attendance Excuse Update',
        body: `Your excuse request for ${waiver.sessionTitle} on ${targetDate} was ${verb}.`,
        type: 'attendance',
        targetAction: { route: 'attendance' }
      });

      logAdminAction(batch, {
        action: `waiver_${newStatus}`,
        targetUid: waiver.uid,
        details: { waiverId: waiver.id, sessionId: waiver.sessionId, occurrenceKey: waiver.occurrenceKey, adminNote }
      });

      await batch.commit();
      waiver.status = newStatus;
      waiver.adminNote = adminNote;
      toast(`Excuse ${newStatus}`, 'success');
      renderAdminWaivers();
    } catch (err) {
      console.error('Error resolving waiver:', err);
      toast(err.message || 'Failed to update waiver', 'error');
      cardEl.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
  };

  container.querySelectorAll('.btn-approve-waiver').forEach(btn => {
    btn.onclick = () => resolveWaiver(btn.dataset.id, 'approved', btn.closest('[data-waiver-id]'));
  });
  container.querySelectorAll('.btn-reject-waiver').forEach(btn => {
    btn.onclick = () => resolveWaiver(btn.dataset.id, 'rejected', btn.closest('[data-waiver-id]'));
  });
}


function openAdminEditSubmissionModal(submission) {
  openModal({
    title: 'Edit Submission Points',
    body: `
      <div class="space-y-4 text-xs">
        <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
          <div class="font-bold text-white">${esc(submission.taskTitle)}</div>
          <div class="text-neutral-400">Member: <strong class="text-white">${esc(submission.userName)}</strong></div>
          <div class="text-neutral-400">Current Points: <strong class="text-emerald-400">${submission.pointsAwarded || 0} pts</strong></div>
        </div>

        <div>
          <label class="block text-neutral-300 font-semibold mb-1">New Points Value</label>
          <input id="input-edit-sub-points" type="number" min="0" max="1000" value="${submission.pointsAwarded || 0}" class="ios-input font-mono text-white text-base" required />
          <p class="text-[10px] text-neutral-400 mt-1">Difference will be atomically added or deducted from the member's profile score.</p>
        </div>

        <div>
          <label class="block text-neutral-300 font-semibold mb-1">Reason for Adjustment (Optional)</label>
          <input id="input-edit-sub-reason" type="text" placeholder="e.g. Bonus effort, corrected score" class="ios-input text-white" />
        </div>
      </div>
    `,
    saveLabel: 'Update Points',
    onSave: async () => {
      const ptsInput = document.getElementById('input-edit-sub-points');
      const reasonInput = document.getElementById('input-edit-sub-reason');
      const newPoints = parseInt(ptsInput?.value, 10);
      const reason = reasonInput?.value?.trim() || 'Admin score adjustment';

      if (isNaN(newPoints) || newPoints < 0) {
        toast('Please enter a valid points amount (0 or more).', 'error');
        return;
      }

      const delta = newPoints - (submission.pointsAwarded || 0);

      try {
        const batch = writeBatch(db);
        const subRef = doc(db, 'submissions', submission.id);
        batch.update(subRef, {
          pointsAwarded: newPoints,
          updatedAt: serverTimestamp()
        });

        if (delta !== 0 && submission.uid) {
          const userRef = doc(db, 'users', submission.uid);
          const pointsUpdate = buildPointsUpdate(usersMap.get(submission.uid) || { points: 0 }, delta);
          batch.update(userRef, {
            ...pointsUpdate,
            updatedAt: serverTimestamp()
          });
        }

        if (submission.uid) {
          createNotification(batch, {
            uid: submission.uid,
            title: 'Task Score Updated',
            message: `Your points for "${submission.taskTitle}" were updated to ${newPoints} pts (${delta >= 0 ? '+' : ''}${delta}).`,
            type: 'task',
            refId: submission.id
          });
        }

        logAdminAction(batch, {
          action: 'submission_points_edited',
          targetUid: submission.uid,
          details: {
            submissionId: submission.id,
            taskTitle: submission.taskTitle,
            oldPoints: submission.pointsAwarded || 0,
            newPoints,
            delta,
            reason
          }
        });

        await batch.commit();
        toast('Submission points successfully updated!', 'success');
        closeAllModals();
      } catch (err) {
        console.error('Error editing submission points:', err);
        toast(err.message || 'Failed to update points', 'error');
      }
    }
  });
}

async function handleAdminRevokeSubmission(submission) {
  const confirm = await confirmSheet({
    title: 'Revoke Submission',
    message: `Revoke "${submission.taskTitle}" for ${submission.userName}? This permanently removes the submission proof and deducts ${submission.pointsAwarded || 0} points from their balance.`,
    confirmLabel: 'Revoke & Deduct',
    destructive: true
  });

  if (!confirm) return;

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'submissions', submission.id));

    if (submission.uid && submission.pointsAwarded) {
      const pointsUpdate = buildPointsUpdate(usersMap.get(submission.uid) || { points: 0 }, -submission.pointsAwarded);
      batch.update(doc(db, 'users', submission.uid), {
        ...pointsUpdate,
        updatedAt: serverTimestamp()
      });
    }

    if (submission.uid) {
      createNotification(batch, {
        uid: submission.uid,
        title: 'Task Submission Revoked',
        message: `Your submission for "${submission.taskTitle}" was revoked by an admin (-${submission.pointsAwarded || 0} pts).`,
        type: 'task',
        refId: submission.id
      });
    }

    logAdminAction(batch, {
      action: 'submission_revoked',
      targetUid: submission.uid,
      details: {
        submissionId: submission.id,
        taskTitle: submission.taskTitle,
        pointsDeducted: submission.pointsAwarded || 0
      }
    });

    await batch.commit();
    toast('Submission revoked and points deducted', 'info');
  } catch (err) {
    console.error('Error revoking submission:', err);
    toast(err.message || 'Failed to revoke submission', 'error');
  }
}

function exportSubmissionsCSV() {
  const list = getFilteredAdminSubmissions();
  if (!list || list.length === 0) {
    toast('No submissions match the current filter to export', 'info');
    return;
  }

  const headers = ['ID', 'Member Name', 'Member UID', 'Task Title', 'Points Awarded', 'Submitted At', 'Occurrence', 'Comment', 'Answers'];
  const escCsv = (val) => {
    const s = String(val == null ? '' : val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(s => {
    const dateStr = formatDateTime(s.submittedAt);
    const answersStr = Array.isArray(s.answers)
      ? s.answers.map(a => {
          if (typeof a === 'string') return a;
          if (!a) return '';
          if (a.type === 'mcq') {
            return a.answer === 'Other' ? `Other: ${a.otherText || ''}` : (a.answer || '');
          }
          return a.answer || '';
        }).filter(Boolean).join(' | ')
      : '';
    return [
      escCsv(s.id),
      escCsv(s.userName),
      escCsv(s.uid),
      escCsv(s.taskTitle),
      escCsv(s.pointsAwarded || 0),
      escCsv(dateStr),
      escCsv(s.occurrenceKey || 'once'),
      escCsv(s.comment || s.notes || ''),
      escCsv(answersStr)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coc_submissions_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Exported ${list.length} records to CSV`, 'success');
}

function getFilteredAdminMembers() {
  const queryText = (state.adminMembersSearch || '').toLowerCase().trim();
  const roleFilter = state.adminMembersRoleFilter || 'all';

  return state.members.filter(m => {
    if (roleFilter === 'admin' && !(m.isAdmin || m.role === 'admin')) return false;
    if (roleFilter === 'member' && (m.isAdmin || m.role === 'admin')) return false;

    if (!queryText) return true;
    const nameMatch = (m.displayName || '').toLowerCase().includes(queryText);
    const uidMatch = (m.uid || '').toLowerCase().includes(queryText);
    return nameMatch || uidMatch;
  });
}

function renderAdminMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  const loadMoreBtn = document.getElementById('btn-load-more-members');
  if (!tbody) return;

  if (loadMoreBtn) {
    if (state.hasMoreMembers) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }

  const filtered = getFilteredAdminMembers();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <div class="p-6 text-center text-xs text-neutral-400 space-y-1">
        <p class="font-semibold text-white">No members found</p>
        <p class="text-[11px]">Adjust your search query or role filter.</p>
      </div>
    `;
    return;
  }

    tbody.innerHTML = filtered.map(m => {
    const isAdmin = Boolean(m.isAdmin || m.role === 'admin');
    const isSelected = selectionState.active && selectionState.type === 'members' && selectionState.selectedIds.has(m.uid);
    const memberEmail = esc(usersPrivate.get(m.uid)?.email || m.email || '');
    const points = m.points || 0;
    const penalties = m.penalties || 0;
    const finesDue = m.finesDue || 0;

    return `
      <div class="admin-member-row member-card-row bulk-select-card hover:bg-white/5 transition cursor-pointer select-none rounded-xl p-3 bg-white/[0.02] border border-white/5 mb-2${isSelected ? ' selected' : ''}" data-member-uid="${esc(m.uid)}" data-bulk-id="${esc(m.uid)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content flex flex-col w-full min-w-0 gap-2">
          <!-- ROW 1 (Header): Avatar + Name + Role badge (Left) | "Manage ›" button (Right) -->
          <div class="flex items-center justify-between w-full min-w-0">
            <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div class="shrink-0">
                ${renderAvatar(m, 'w-10 h-10')}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-white text-sm truncate">${esc(m.displayName || m.name || 'Member')}</div>
              </div>
              ${isAdmin ? `
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  Admin
                </span>
              ` : `
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-neutral-300 shrink-0">
                  Member
                </span>
              `}
            </div>
            <button type="button" class="btn-manage-member px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition flex items-center gap-1 shrink-0">
              <span>Manage</span>
              <svg class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </button>
          </div>

          <!-- ROW 2 (Details): Email + Badges (wrap) (Left) | Stat pills: pts (Green), pen (Red), EGP (Orange) (Right) -->
          <div class="flex items-center justify-between w-full min-w-0 pt-2 border-t border-white/5 gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              ${memberEmail ? `
                <span style="font-size:12px; color:#8E8E93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">
                  ${memberEmail}
                </span>
              ` : ''}
              <div class="badge-row-container flex items-center gap-1 min-w-0 flex-wrap" data-uid="${esc(m.uid)}"></div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">${points} pts</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/25">${penalties} pen</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/25">${finesDue} EGP</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  tbody.querySelectorAll('.badge-row-container').forEach(c => {
    const uid = c.dataset.uid;
    const mem = usersMap.get(uid) || state.members.find(m => m.uid === uid);
    if (mem) {
      renderBadgeRow(c, mem.badges, mem);
    }
  });

  tbody.querySelectorAll('.admin-member-row').forEach(row => {
    row.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'members') {
        e.preventDefault();
        e.stopPropagation();
        toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      if (e.target.closest('.btn-manage-member')) return;
      openMiniProfileSheet(row.dataset.memberUid);
    };

    attachLongPress(row, () => {
      enterSelectionMode('members', row.dataset.bulkId);
    });
  });

  tbody.querySelectorAll('.btn-manage-member').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (selectionState.active && selectionState.type === 'members') {
        e.preventDefault();
        const row = btn.closest('.bulk-select-card');
        if (row) toggleItemSelection(row, row.dataset.bulkId);
        return;
      }
      const row = btn.closest('.admin-member-row');
      const member = state.members.find(x => x.uid === row?.dataset.memberUid);
      if (member) openMemberControlModal(member);
    };
  });
}

// Preset badges for Quick Add in Admin Member Control
const PRESET_BADGES = [
  { id: 'top_contributor', label: 'Top Contributor', icon: 'star', color: '#FFD60A' },
  { id: 'task_master', label: 'Task Master', icon: 'zap', color: '#0A84FF' },
  { id: 'streak_warrior', label: 'Streak Warrior', icon: 'flame', color: '#FF9F0A' },
  { id: 'rising_star', label: 'Rising Star', icon: 'sparkle', color: '#30D158' },
  { id: 'quality_champion', label: 'Quality Champion', icon: 'shield', color: '#BF5AF2' },
  { id: 'event_hero', label: 'Event Hero', icon: 'heart', color: '#FF375F' }
];

export const renderMemberLedger = (...args) => loadTransactionLedger(...args);
export async function loadTransactionLedger(uid, containerEl, countBadgeEl) {
  if (!containerEl) return;
  // Security check: only self or admin can view financial ledger
  const isSelf = state.user?.uid === uid;
  const isAdminUser = state.user?.role === 'admin';
  if (!isSelf && !isAdminUser) {
    containerEl.innerHTML = '<div class="p-4 text-center text-xs text-neutral-500">Access restricted.</div>';
    return;
  }

  containerEl.innerHTML = `
    <div class="py-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
      <div class="w-4 h-4 border-2 border-white/20 border-t-[#0A84FF] rounded-full animate-spin"></div>
      <span>Loading transaction ledger...</span>
    </div>
  `;

  try {
    // 1. Fetch manual admin transactions
    const qTxs = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapTxs = await getDocs(qTxs);
    const txs = [];
    snapTxs.forEach(d => {
      const data = d.data();
      const ms = parseDateTimeToMs(data.createdAt);
      txs.push({ id: d.id, ...data, sortTime: ms });
    });

    // 2. Fetch member attendance logs with fineEGP > 0
    const qLogs = query(
      collection(db, 'attendance_logs'),
      where('uid', '==', uid),
      limit(50)
    );
    const snapLogs = await getDocs(qLogs);
    snapLogs.forEach(d => {
      const l = d.data();
      const fine = Number(l.fineEGP) || 0;
      if (fine > 0) {
        const ms = parseDateTimeToMs(l.checkedInAt || l.occurrenceStart);
        txs.push({
          id: 'att_fine_' + d.id,
          type: 'fine',
          category: 'financial',
          amount: fine,
          reason: 'Attendance fine - ' + (l.sessionTitle || 'Session'),
          adminName: l.status === 'absent' ? 'Admin' : 'System Check-In',
          createdAt: l.checkedInAt || l.occurrenceStart,
          sortTime: ms,
          isAttendanceLog: true
        });
      }
    });

    // Sort merged ledger descending
    txs.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

    if (countBadgeEl) {
      countBadgeEl.textContent = txs.length;
      if (txs.length > 0) countBadgeEl.classList.remove('hidden');
    }

    if (txs.length === 0) {
      containerEl.innerHTML = `
        <div class="p-6 text-center text-xs text-neutral-400">
          No transactions recorded yet.
        </div>
      `;
      return;
    }

        containerEl.innerHTML = `
      <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
        ${txs.map(tx => {
          const isPts = tx.category === 'points' || tx.type === 'bonus' || tx.type === 'penalty';
          let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          let sign = '+';
          let unit = isPts ? 'pts' : 'EGP';

          if (tx.type === 'penalty') {
            badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            sign = '-';
          } else if (tx.type === 'fine') {
            badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            sign = '+';
          } else if (tx.type === 'payment') {
            badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            sign = '-';
          } else if (tx.type === 'waive') {
            badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            sign = 'Waived ';
          }

          const dateStr = tx.createdAt ? formatDateTime(tx.createdAt) : 'Just now';

          return `
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-white uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-white/10">${esc(tx.type || 'entry')}</span>
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${badgeColor}">
                    ${sign}${tx.amount} ${unit}
                  </span>
                  ${tx.status === 'revoked' ? `
                    <span class="text-neutral-400 font-mono text-[10px] font-medium tracking-wide">[REVOKED]</span>
                  ` : (isAdminUser && !tx.isAttendanceLog ? `
                    <button type="button" class="btn-text-danger btn-revoke-ledger text-xs text-rose-400 hover:text-rose-300 font-semibold transition px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20" data-id="${tx.id}">Revoke</button>
                  ` : '')}
                </div>
              </div>
              <p class="text-neutral-300 text-xs">${esc(tx.reason || 'No description provided')}</p>
              <div class="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-white/5 font-mono">
                <span>By ${esc(tx.adminName || 'Admin')}</span>
                <span>${dateStr}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    containerEl.querySelectorAll('.btn-revoke-ledger').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const txId = btn.dataset.id;
        const txItem = txs.find(t => t.id === txId);
        if (!txItem) return;

        const confirmed = await confirmSheet({
          title: 'Revoke Transaction',
          message: `Are you sure you want to revoke this ${txItem.type} transaction (${txItem.amount})? This will atomically reverse the member's balance in the database.`,
          confirmLabel: 'Revoke',
          destructive: true
        });
        if (!confirmed) return;

        btn.disabled = true;
        btn.textContent = 'Revoking...';

        try {
                    let newPoints = undefined;
          let newPenalties = undefined;
          let newFinesDue = undefined;

          await runTransaction(db, async (t) => {
            const txDocRef = doc(db, 'users', uid, 'transactions', txId);
            const txSnap = await t.get(txDocRef);
            if (!txSnap.exists()) {
              throw new Error('Transaction record not found.');
            }
            const txData = txSnap.data();
            if (txData.status === 'revoked') {
              throw new Error('Transaction has already been revoked.');
            }

            const userDocRef = doc(db, 'users', uid);
            const userSnap = await t.get(userDocRef);
            const userData = userSnap.exists() ? userSnap.data() : {};

            const userPoints = Number(userData.points || 0);
            const userPenalties = Number(userData.penalties || 0);
            const userFines = Number(userData.finesDue || 0);
            const amount = Number(txData.amount || 0);

            const userUpdates = { updatedAt: serverTimestamp() };

            if (txData.category === 'points' || txData.type === 'bonus' || txData.type === 'penalty') {
              if (txData.type === 'bonus') {
                newPoints = Math.max(0, userPoints - amount);
                userUpdates.points = newPoints;
              } else if (txData.type === 'penalty') {
                newPoints = userPoints + amount;
                newPenalties = Math.max(0, userPenalties - amount);
                userUpdates.points = newPoints;
                userUpdates.penalties = newPenalties;
              }
              t.update(userDocRef, userUpdates);
            } else if (txData.category === 'financial' || txData.type === 'fine' || txData.type === 'payment' || txData.type === 'waive') {
              const privDocRef = doc(db, 'users_private', uid);
              const privSnap = await t.get(privDocRef);
              const privData = privSnap.exists() ? privSnap.data() : {};
              const currentFines = Number(privData.finesEGP || userFines);

              if (txData.type === 'fine') {
                newFinesDue = Math.max(0, currentFines - amount);
              } else if (txData.type === 'payment' || txData.type === 'waive') {
                newFinesDue = currentFines + amount;
              }
              t.set(privDocRef, { finesEGP: newFinesDue, updatedAt: serverTimestamp() }, { merge: true });
              t.update(userDocRef, { finesDue: newFinesDue, updatedAt: serverTimestamp() });
            }

            t.update(txDocRef, {
              status: 'revoked',
              revokedAt: serverTimestamp(),
              revokedBy: state.user?.uid || 'Admin'
            });
          });

          // Instantly update local usersMap
          const localUser = usersMap.get(uid) || state.members.find(m => m.uid === uid);
          if (localUser) {
            if (newPoints !== undefined) localUser.points = newPoints;
            if (newPenalties !== undefined) localUser.penalties = newPenalties;
            if (newFinesDue !== undefined) localUser.finesDue = newFinesDue;
          }

          invalidateEgpCache(uid);
          await getMemberDerivedEgpBalance(uid, true);
          toast('Transaction revoked and balance reversed atomically', 'success');
          loadTransactionLedger(uid, containerEl, countBadgeEl);

          // Update Adjuster summary cards in place if member control is open
          const ptsEl = document.getElementById('ctrl-summary-points');
          if (ptsEl && newPoints !== undefined) ptsEl.textContent = newPoints;
          const penEl = document.getElementById('ctrl-summary-penalties');
          if (penEl && newPenalties !== undefined) penEl.textContent = newPenalties;
          const finEl = document.getElementById('ctrl-summary-fines');
          if (finEl && newFinesDue !== undefined) finEl.textContent = `${newFinesDue} EGP`;

          if (typeof renderAdminMembers === 'function') renderAdminMembers();
          if (typeof renderLeaderboard === 'function') renderLeaderboard();
        } catch (err) {
          console.error('Revoke transaction error:', err);
          toast('Failed to revoke transaction: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Revoke';
        }
      };
    });
  } catch (err) {
    console.error('Error loading transaction ledger:', err);
    containerEl.innerHTML = `
      <div class="p-4 text-center text-xs text-rose-400">
        Failed to load ledger: ${esc(err.message)}
      </div>
    `;
  }
}

function openMemberControlModal(member) {
  let activeTab = 'profile';
  let adjusterCategory = 'points'; // 'points' | 'financial'
  let adjusterType = 'bonus'; // 'bonus' | 'penalty' | 'fine' | 'payment' | 'waive'
  let hasPendingChanges = false;
  let editedName = member.displayName || '';
  let selectedRole = member.role || (member.isAdmin ? 'admin' : 'member');
  let ledgerLoaded = false;

  const currentMember = state.members.find(m => m.uid === member.uid) || member;
  const isAdmin = Boolean(selectedRole === 'admin' || currentMember.role === 'admin' || currentMember.isAdmin);
  const privateData = usersPrivate.get(currentMember.uid) || {};
  const memberEmail = privateData.email || currentMember.email || 'No email on record';
  const cachedFineSum = egpAggregateCache.get(currentMember.uid)?.fineSum || 0;
  const finesBalance = (privateData.finesEGP || currentMember.finesDue || 0) + cachedFineSum;

  function markDirty() {
    hasPendingChanges = true;
    updateSaveButtonState();
  }

  function updateSaveButtonState() {
    const saveBtn = document.getElementById('shared-modal-save') || document.getElementById('btn-modal-save');
    if (saveBtn) {
      saveBtn.disabled = !hasPendingChanges;
      saveBtn.classList.toggle('opacity-40', !hasPendingChanges);
      saveBtn.classList.toggle('cursor-not-allowed', !hasPendingChanges);
    }
  }

  const modalBody = document.createElement('div');
  modalBody.id = 'member-ctrl-body';
  modalBody.className = 'space-y-3 text-xs';

  modalBody.innerHTML = `
    <!-- Navigation Tab Bar (Flexible, non-wrapping, horizontal scroll) -->
    <div id="member-ctrl-tab-bar" class="modal-tabs flex items-center gap-2 p-1.5 rounded-xl bg-white/5 border border-white/10 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap" style="scrollbar-width: none; -ms-overflow-style: none;">
      <button type="button" class="member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap bg-[#0A84FF] text-white shadow-sm" data-tab="profile">
        Profile
      </button>
      <button type="button" class="member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap text-neutral-400 hover:text-white" data-tab="adjuster">
        Adjust
      </button>
      <button type="button" class="member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap text-neutral-400 hover:text-white" data-tab="ledger">
        Ledger
      </button>
      <button type="button" class="member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap text-neutral-400 hover:text-white" data-tab="tasks">
        Tasks
      </button>
      <button type="button" class="member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap text-neutral-400 hover:text-white" data-tab="attendance">
        Attendance
      </button>
    </div>

    <!-- TAB 1: Profile (iOS Inset Grouped) -->
    <div id="tab-sec-profile" class="member-tab-panel space-y-3">
      <!-- Member Identity Hero Card -->
      <div class="ios-card flex items-center gap-3">
        <div id="btn-crop-member-avatar" class="cursor-pointer relative group flex-shrink-0" title="Tap to change avatar">
          <div id="member-ctrl-avatar-wrap">${renderAvatar(currentMember, 'w-12 h-12')}</div>
          <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[9px] text-white font-bold">Edit</div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-white text-base truncate" id="member-ctrl-hero-name">${esc(currentMember.displayName || currentMember.name || 'Member')}</div>
          <div class="text-[12px] text-neutral-400 truncate">${esc(memberEmail)}</div>
          <div class="mt-1">
            <span id="member-ctrl-hero-role-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
              ${isAdmin ? 'ADMIN' : 'MEMBER'}
            </span>
          </div>
        </div>
      </div>

      <!-- Identity & Role Card -->
      <div class="ios-card space-y-3">
        <div class="text-[11px] font-bold text-neutral-400 tracking-wider uppercase">Identity &amp; Role</div>
        <div>
          <label class="block text-neutral-300 font-semibold mb-1">Display Name</label>
          <input id="ctrl-member-name" type="text" class="ios-input text-white w-full" value="${esc(editedName)}" required />
        </div>
        <div>
          <label class="block text-neutral-300 font-semibold mb-1">Role &amp; Permissions</label>
          <div id="ctrl-role-seg-wrap"></div>
          <p class="text-[11px] text-neutral-400 mt-1">Admin has full access across all management tools.</p>
        </div>
      </div>

      <!-- Badges Management Card -->
      <div class="ios-card space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-neutral-400 tracking-wider uppercase">Member Badges</span>
          <button type="button" id="btn-open-badge-picker" class="text-[#0A84FF] text-[11px] font-semibold hover:underline">
            + Add Custom Badge
          </button>
        </div>

        <div id="ctrl-badges-list" class="flex flex-wrap gap-1.5 min-h-8 items-center">
          ${Array.isArray(currentMember.badges) && currentMember.badges.length > 0 ? currentMember.badges.map(b => {
            const norm = typeof b === 'string' ? { id: b, label: b, color: '#3A3A3C' } : b;
            return `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white border border-white/10" style="background-color: ${norm.color || '#3A3A3C'}40">
                <span class="w-2 h-2 rounded-full" style="background-color: ${norm.color || '#3A3A3C'}"></span>
                <span>${esc(norm.label)}</span>
                <button type="button" class="btn-remove-member-badge hover:text-rose-400 transition ml-0.5" data-badge-id="${esc(norm.id)}" aria-label="Remove badge">&times;</button>
              </span>
            `;
          }).join('') : `
            <span class="text-neutral-500 italic text-[11px] py-1">No badges assigned to this member.</span>
          `}
        </div>

        <div>
          <label class="block text-neutral-400 text-[11px] font-semibold mb-1.5">Quick Add Presets:</label>
          <div class="flex flex-wrap gap-1.5">
            ${PRESET_BADGES.map(preset => {
              const alreadyHas = (currentMember.badges || []).some(b => (b.id || b.label || b) === preset.id);
              return `
                <button type="button" class="btn-quick-add-badge text-[11px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${alreadyHas ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/10 text-neutral-400' : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'}" data-preset-id="${preset.id}" ${alreadyHas ? 'disabled' : ''}>
                  <span class="w-2 h-2 rounded-full" style="background-color: ${preset.color}"></span>
                  <span>+ ${preset.label}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Universal Adjuster (Points & Financials) -->
    <div id="tab-sec-adjuster" class="member-tab-panel space-y-3 hidden">
      <!-- Quick Metric Summary strip (.ios-card) -->
      <div class="ios-card grid grid-cols-3 gap-2 text-center">
        <div class="p-1">
          <div class="text-[10px] text-neutral-400 uppercase font-mono">Points</div>
          <div id="ctrl-summary-points" class="text-base font-bold text-amber-400 font-mono">${currentMember.points || 0}</div>
        </div>
        <div class="p-1 border-x border-white/10">
          <div class="text-[10px] text-neutral-400 uppercase font-mono">Penalties</div>
          <div id="ctrl-summary-penalties" class="text-base font-bold text-rose-400 font-mono">${currentMember.penalties || 0}</div>
        </div>
        <div class="p-1">
          <div class="text-[10px] text-neutral-400 uppercase font-mono">Fines Due</div>
          <div id="ctrl-summary-fines" class="text-base font-bold text-blue-400 font-mono">${finesBalance} EGP</div>
        </div>
      </div>

      <!-- Adjuster Form (.ios-card) -->
      <div class="ios-card space-y-3.5">
        <div class="text-[11px] font-bold text-neutral-400 tracking-wider uppercase">Adjustment Type</div>
        
        <!-- Category Toggle Segmented -->
        <div id="ctrl-adj-cat-wrap"></div>

        <!-- Action Pills: Points Group -->
        <div id="adj-action-points-group" class="grid grid-cols-2 gap-2">
          <button type="button" class="btn-adj-type py-2 px-3 rounded-xl border text-center font-bold text-xs transition bg-emerald-500/20 border-emerald-500/50 text-emerald-300" data-type="bonus">
            + Add Bonus
          </button>
          <button type="button" class="btn-adj-type py-2 px-3 rounded-xl border text-center font-bold text-xs transition bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10" data-type="penalty">
            - Deduct Penalty
          </button>
        </div>

        <!-- Action Pills: Financial Group -->
        <div id="adj-action-financial-group" class="space-y-2 hidden">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] text-neutral-400">Current Balance:</span>
            <span id="ctrl-adj-fines-preview" class="text-xs font-mono text-[#0A84FF] font-bold">${finesBalance} EGP</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button type="button" class="btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition bg-rose-500/20 border-rose-500/50 text-rose-300" data-type="fine">
              + Add Fine
            </button>
            <button type="button" class="btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10" data-type="payment">
              - Record Pay
            </button>
            <button type="button" class="btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10" data-type="waive">
              ~ Waive Fine
            </button>
          </div>
        </div>

        <!-- Amount & Preset Chips -->
        <div>
          <label class="block text-neutral-300 font-semibold mb-1">
            Amount (<span id="ctrl-adj-unit-label">Points</span>)
          </label>
          <input id="ctrl-adjust-amount" type="number" min="1" step="1" class="ios-input text-white font-mono text-sm w-full" placeholder="e.g. 50" required />
          
          <!-- Points Presets -->
          <div id="adj-presets-points" class="grid grid-cols-4 gap-1.5 mt-2">
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="25">25</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="50">50</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="100">100</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="250">250</button>
          </div>

          <!-- Financial Presets -->
          <div id="adj-presets-financial" class="grid grid-cols-4 gap-1.5 mt-2 hidden">
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="50">50</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="100">100</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="200">200</button>
            <button type="button" class="btn-adj-preset py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono text-xs text-center" data-amount="500">500</button>
          </div>
        </div>

        <!-- Reason & Quick Chips -->
        <div>
          <label class="block text-neutral-300 font-semibold mb-1">
            Reason <span class="text-rose-400">*</span>
          </label>
          <textarea id="ctrl-adjust-reason" class="ios-input text-white text-xs leading-relaxed w-full" rows="2" placeholder="Required explanation for the transaction ledger..." required></textarea>
          <div class="flex flex-wrap gap-1 mt-1.5">
            ${['Meeting attendance', 'Late check-in', 'Special contribution', 'Manual adjustment'].map(chip => `
              <button type="button" class="btn-quick-reason px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] text-neutral-300 transition" data-reason="${chip}">
                ${chip}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pt-1">
          <button type="button" id="btn-submit-adjust" class="w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white font-bold transition flex items-center justify-center gap-2">
            <span>Apply &amp; Record in Ledger</span>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 3: Ledger -->
    <div id="tab-sec-ledger" class="member-tab-panel space-y-3 hidden">
      <div class="ios-card space-y-3">
        <div class="flex items-center justify-between text-neutral-400 text-[11px] px-1">
          <span>Historical transactions on record</span>
          <button type="button" id="btn-refresh-ctrl-ledger" class="text-[#0A84FF] hover:underline font-semibold">Refresh</button>
        </div>
        <div id="member-ctrl-ledger-list"></div>
      </div>
    </div>

    <!-- TAB 4: Current Tasks -->
    <div id="tab-sec-tasks" class="member-tab-panel space-y-3 hidden">
      <div class="ios-card space-y-3">
        <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-300 flex items-center justify-between">
          <span>Tracking active tasks for current occurrence.</span>
          <span class="font-mono text-neutral-400">${state.tasks.filter(t => !t.archived).length} active</span>
        </div>

        <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
          ${state.tasks.filter(t => !t.archived).map(task => {
            const win = getTaskWindow(task, serverNow());
            const occKey = win ? win.occurrenceKey : 'once';
            const isCompleted = state.submissions.some(s => s.uid === currentMember.uid && s.taskId === task.id && (task.isPermanent || s.occurrenceKey === occKey));
            const sub = state.submissions.find(s => s.uid === currentMember.uid && s.taskId === task.id && (task.isPermanent || s.occurrenceKey === occKey));

            return `
              <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    ${isCompleted ? `
                      <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
                    ` : `
                      <span class="w-5 h-5 rounded-full bg-white/10 text-neutral-400 flex items-center justify-center text-xs">○</span>
                    `}
                    <span class="font-bold text-white">${esc(task.title)}</span>
                  </div>
                  <span class="font-mono text-[11px] ${isCompleted ? 'text-emerald-400' : 'text-neutral-400'} font-semibold">
                    ${task.points || 0} pts
                  </span>
                </div>

                ${isCompleted && sub ? `
                  <div class="pt-1 text-[11px] space-y-1.5 border-t border-white/5">
                    <div class="flex items-center justify-between text-neutral-400">
                      <span>Submitted: ${formatDateTime(sub.submittedAt)}</span>
                      <span class="font-mono text-emerald-400 font-bold">+${sub.pointsAwarded || 0} pts</span>
                    </div>
                    ${sub.comment ? `<p class="text-neutral-300 italic bg-black/20 p-1.5 rounded">"${esc(sub.comment)}"</p>` : ''}
                    <div class="flex items-center justify-end gap-2 pt-1">
                      <button type="button" class="btn-ctrl-edit-sub px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition" data-sub-id="${esc(sub.id)}">Edit</button>
                      <button type="button" class="btn-ctrl-revoke-sub px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold transition" data-sub-id="${esc(sub.id)}">Revoke</button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- TAB 5: Attendance -->
    <div id="tab-sec-attendance" class="member-tab-panel space-y-3 hidden">
      <div class="ios-card space-y-3">
        <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-300 flex items-center justify-between">
          <span>Tracking attendance logs and penalties.</span>
          <span class="font-mono text-neutral-400">${state.attendanceSessions.filter(s => !s.archived).length} sessions</span>
        </div>

        <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
          ${state.attendanceSessions.filter(s => !s.archived).map(session => {
            const occ = resolveSessionOccurrence(session, serverNow());
            const occKey = occ ? occ.key : 'once';
            const log = state.attendanceLogs.find(l => l.uid === currentMember.uid && l.sessionId === session.id && l.occurrenceKey === occKey);

            return `
              <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white">${esc(session.title)}</span>
                  ${log ? `
                    <span class="px-2 py-0.5 rounded-full font-semibold font-mono text-[10px] ${log.status === 'on_time' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                      ${log.status === 'on_time' ? 'ON TIME' : 'LATE (-' + (log.penalty || 0) + ' pts)'}
                    </span>
                  ` : `
                    <span class="px-2 py-0.5 rounded-full font-semibold font-mono text-[10px] bg-white/10 text-neutral-400">NOT CHECKED IN</span>
                  `}
                </div>

                ${log ? `
                  <div class="pt-1 text-[11px] space-y-1.5 border-t border-white/5">
                    <div class="flex items-center justify-between text-neutral-400">
                      <span>Checked In: ${formatDateTime(log.checkedInAt)}</span>
                      ${log.fineEGP ? `<span class="text-rose-400 font-mono">${log.fineEGP} EGP</span>` : ''}
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-1">
                      <button type="button" class="btn-ctrl-edit-log px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition" data-log-id="${esc(log.id)}">Edit Penalty</button>
                      <button type="button" class="btn-ctrl-delete-log px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold transition" data-log-id="${esc(log.id)}">Delete Log</button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire Tab Switching: Strictly CSS class toggle (Zero innerHTML re-render)
  modalBody.querySelectorAll('.member-tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      modalBody.querySelectorAll('.member-tab-btn').forEach(b => {
        const isActive = b.dataset.tab === activeTab;
        b.className = `member-tab-btn flex-shrink-0 py-1.5 px-3 rounded-lg font-semibold transition text-center whitespace-nowrap ${isActive ? 'bg-[#0A84FF] text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`;
      });
      modalBody.querySelectorAll('.member-tab-panel').forEach(panel => {
        panel.classList.add('hidden');
      });
      const activePanel = modalBody.querySelector(`#tab-sec-${activeTab}`);
      if (activePanel) activePanel.classList.remove('hidden');

      if (activeTab === 'ledger' && !ledgerLoaded) {
        ledgerLoaded = true;
        loadTransactionLedger(currentMember.uid, modalBody.querySelector('#member-ctrl-ledger-list'));
      }

      btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    };
  });

  // Wire Refresh Ledger
  const refreshLedgerBtn = modalBody.querySelector('#btn-refresh-ctrl-ledger');
  if (refreshLedgerBtn) {
    refreshLedgerBtn.onclick = () => {
      loadTransactionLedger(currentMember.uid, modalBody.querySelector('#member-ctrl-ledger-list'));
    };
  }

  // Wire Avatar Tap-to-Crop
  const avatarCropBtn = modalBody.querySelector('#btn-crop-member-avatar');
  if (avatarCropBtn) {
    avatarCropBtn.onclick = () => {
      pickAndCropImage({
        aspect: 1,
        onCropped: async (base64Url) => {
          try {
            await updateDoc(doc(db, 'users', currentMember.uid), {
              avatarUrl: base64Url,
              photoURL: base64Url,
              updatedAt: serverTimestamp()
            });
            currentMember.avatarUrl = base64Url;
            currentMember.photoURL = base64Url;
            const u = usersMap.get(currentMember.uid);
            if (u) { u.avatarUrl = base64Url; u.photoURL = base64Url; }
            const wrap = modalBody.querySelector('#member-ctrl-avatar-wrap');
            if (wrap) wrap.innerHTML = renderAvatar(currentMember, 'w-12 h-12');
            toast('Avatar updated successfully', 'success');
            renderMembersAdmin();
          } catch (err) {
            console.error('Avatar update error:', err);
            toast('Failed to update avatar: ' + err.message, 'error');
          }
        }
      });
    };
  }

  // Wire Display Name Input
  const nameInp = modalBody.querySelector('#ctrl-member-name');
  if (nameInp) {
    nameInp.oninput = (e) => {
      editedName = e.target.value;
      const heroName = modalBody.querySelector('#member-ctrl-hero-name');
      if (heroName) heroName.textContent = editedName.trim() || 'Member';
      markDirty();
    };
  }

  // Wire Role Segmented Selector
  const roleWrap = modalBody.querySelector('#ctrl-role-seg-wrap');
  if (roleWrap) {
    roleWrap.appendChild(renderSegmented({
      id: 'ctrl-member-role-seg',
      options: [
        { value: 'member', label: 'Member' },
        { value: 'admin', label: 'Admin' }
      ],
      value: selectedRole,
      onChange: (newRole) => {
        if (newRole !== 'admin') {
          if (currentMember.uid === state.user?.uid) {
            toast('You cannot demote yourself from admin', 'error');
            return;
          }
          const adminCount = state.members.filter(m => m.role === 'admin' || m.isAdmin).length;
          if (adminCount <= 1) {
            toast('Cannot demote the last administrator', 'error');
            return;
          }
        }
        selectedRole = newRole;
        const roleBadge = modalBody.querySelector('#member-ctrl-hero-role-badge');
        if (roleBadge) {
          const isNowAdmin = selectedRole === 'admin';
          roleBadge.textContent = isNowAdmin ? 'ADMIN' : 'MEMBER';
          roleBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${isNowAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`;
        }
        markDirty();
      }
    }));
  }

  // Wire Badges Management
  function refreshBadgesDOM() {
    const badgesList = modalBody.querySelector('#ctrl-badges-list');
    if (!badgesList) return;
    if (Array.isArray(currentMember.badges) && currentMember.badges.length > 0) {
      badgesList.innerHTML = currentMember.badges.map(b => {
        const norm = typeof b === 'string' ? { id: b, label: b, color: '#3A3A3C' } : b;
        return `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white border border-white/10" style="background-color: ${norm.color || '#3A3A3C'}40">
            <span class="w-2 h-2 rounded-full" style="background-color: ${norm.color || '#3A3A3C'}"></span>
            <span>${esc(norm.label)}</span>
            <button type="button" class="btn-remove-member-badge hover:text-rose-400 transition ml-0.5" data-badge-id="${esc(norm.id)}" aria-label="Remove badge">&times;</button>
          </span>
        `;
      }).join('');
    } else {
      badgesList.innerHTML = '<span class="text-neutral-500 italic text-[11px] py-1">No badges assigned to this member.</span>';
    }
    wireBadgeRemoveHandlers();

    modalBody.querySelectorAll('.btn-quick-add-badge').forEach(btn => {
      const presetId = btn.dataset.presetId;
      const alreadyHas = (currentMember.badges || []).some(b => (b.id || b.label || b) === presetId);
      btn.disabled = alreadyHas;
      btn.className = `btn-quick-add-badge text-[11px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${alreadyHas ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/10 text-neutral-400' : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'}`;
    });
  }

  function wireBadgeRemoveHandlers() {
    modalBody.querySelectorAll('.btn-remove-member-badge').forEach(btn => {
      btn.onclick = async () => {
        const badgeId = btn.dataset.badgeId;
        const curBadges = Array.isArray(currentMember.badges) ? [...currentMember.badges] : [];
        const newBadges = curBadges.filter(b => (b.id || b.label || b) !== badgeId);
        const newBadgeIds = newBadges.map(b => (typeof b === 'string' ? b : b?.id)).filter(Boolean);

        try {
          const batch = writeBatch(db);
          batch.update(doc(db, 'users', currentMember.uid), {
            badges: newBadges,
            badgeIds: newBadgeIds,
            updatedAt: serverTimestamp()
          });

          logAdminAction(batch, {
            action: 'badge_removed',
            targetUid: currentMember.uid,
            details: { badgeId }
          });

          await batch.commit();
          currentMember.badges = newBadges;
          currentMember.badgeIds = newBadgeIds;
          toast('Badge removed', 'info');
          refreshBadgesDOM();
        } catch (err) {
          console.error('Error removing badge:', err);
          toast('Failed to remove badge', 'error');
        }
      };
    });
  }
  wireBadgeRemoveHandlers();

  const openBadgePickerBtn = modalBody.querySelector('#btn-open-badge-picker');
  if (openBadgePickerBtn) {
    openBadgePickerBtn.onclick = () => {
      openBadgePickerSheet({
        onSelect: async (badgeObj) => {
          if (!badgeObj) return;
          const curBadges = Array.isArray(currentMember.badges) ? [...currentMember.badges] : [];
          if (curBadges.some(b => (b.id || b.label || b) === badgeObj.id)) return;

          const newBadges = [...curBadges, badgeObj];
          const newBadgeIds = newBadges.map(b => (typeof b === 'string' ? b : b?.id)).filter(Boolean);

          try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'users', currentMember.uid), {
              badges: newBadges,
              badgeIds: newBadgeIds,
              updatedAt: serverTimestamp()
            });

            createNotification(batch, {
              uid: currentMember.uid,
              title: 'Badge Awarded!',
              message: `You have been awarded the "${badgeObj.label}" badge!`,
              type: 'badge'
            });

            logAdminAction(batch, {
              action: 'badge_awarded',
              targetUid: currentMember.uid,
              details: { badgeId: badgeObj.id, badgeLabel: badgeObj.label }
            });

            await batch.commit();
            currentMember.badges = newBadges;
            currentMember.badgeIds = newBadgeIds;
            toast(`Badge "${badgeObj.label}" awarded!`, 'success');
            refreshBadgesDOM();
          } catch (err) {
            console.error('Error adding badge:', err);
            toast('Failed to add badge', 'error');
          }
        }
      });
    };
  }

  modalBody.querySelectorAll('.btn-quick-add-badge').forEach(btn => {
    btn.onclick = async () => {
      const presetId = btn.dataset.presetId;
      const preset = PRESET_BADGES.find(p => p.id === presetId);
      if (!preset) return;

      const curBadges = Array.isArray(currentMember.badges) ? [...currentMember.badges] : [];
      if (curBadges.some(b => (b.id || b.label || b) === preset.id)) return;

      const newBadges = [...curBadges, preset];
      const newBadgeIds = newBadges.map(b => (typeof b === 'string' ? b : b?.id)).filter(Boolean);

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', currentMember.uid), {
          badges: newBadges,
          badgeIds: newBadgeIds,
          updatedAt: serverTimestamp()
        });

        createNotification(batch, {
          uid: currentMember.uid,
          title: 'Badge Awarded!',
          message: `You have been awarded the "${preset.label}" badge by an administrator!`,
          type: 'badge'
        });

        logAdminAction(batch, {
          action: 'badge_awarded',
          targetUid: currentMember.uid,
          details: { badgeId: preset.id, badgeLabel: preset.label }
        });

        await batch.commit();
        currentMember.badges = newBadges;
        currentMember.badgeIds = newBadgeIds;
        toast(`Badge "${preset.label}" awarded!`, 'success');
        refreshBadgesDOM();
      } catch (err) {
        console.error('Error adding preset badge:', err);
        toast('Failed to add badge', 'error');
      }
    };
  });

  // Wire Adjuster Category Segmented (In-place switching)
  const adjCatWrap = modalBody.querySelector('#ctrl-adj-cat-wrap');
  if (adjCatWrap) {
    adjCatWrap.appendChild(renderSegmented({
      id: 'adj-cat-segmented',
      options: [
        { value: 'points', label: 'Points & Penalties' },
        { value: 'financial', label: 'Financials (EGP)' }
      ],
      value: adjusterCategory,
      onChange: (val) => {
        adjusterCategory = val;
        adjusterType = val === 'points' ? 'bonus' : 'fine';
        
        const pointsGroup = modalBody.querySelector('#adj-action-points-group');
        const finGroup = modalBody.querySelector('#adj-action-financial-group');
        const pointsPresets = modalBody.querySelector('#adj-presets-points');
        const finPresets = modalBody.querySelector('#adj-presets-financial');
        const unitLabel = modalBody.querySelector('#ctrl-adj-unit-label');

        if (pointsGroup) pointsGroup.classList.toggle('hidden', val !== 'points');
        if (finGroup) finGroup.classList.toggle('hidden', val !== 'financial');
        if (pointsPresets) pointsPresets.classList.toggle('hidden', val !== 'points');
        if (finPresets) finPresets.classList.toggle('hidden', val !== 'financial');
        if (unitLabel) unitLabel.textContent = val === 'points' ? 'Points' : 'EGP';

        updateAdjusterTypeButtons();
      }
    }));
  }

  function updateAdjusterTypeButtons() {
    modalBody.querySelectorAll('.btn-adj-type').forEach(btn => {
      const isSel = btn.dataset.type === adjusterType;
      if (btn.dataset.type === 'bonus') {
        btn.className = `btn-adj-type py-2 px-3 rounded-xl border text-center font-bold text-xs transition ${isSel ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
      } else if (btn.dataset.type === 'penalty') {
        btn.className = `btn-adj-type py-2 px-3 rounded-xl border text-center font-bold text-xs transition ${isSel ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
      } else if (btn.dataset.type === 'fine') {
        btn.className = `btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition ${isSel ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
      } else if (btn.dataset.type === 'payment') {
        btn.className = `btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition ${isSel ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
      } else if (btn.dataset.type === 'waive') {
        btn.className = `btn-adj-type py-2 px-2 rounded-xl border text-center font-bold text-[11px] transition ${isSel ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'}`;
      }
    });
  }

  // Wire Adjuster Action Pills
  modalBody.querySelectorAll('.btn-adj-type').forEach(btn => {
    btn.onclick = () => {
      adjusterType = btn.dataset.type;
      updateAdjusterTypeButtons();
    };
  });

  // Wire Adjuster Preset Chips
  modalBody.querySelectorAll('.btn-adj-preset').forEach(btn => {
    btn.onclick = () => {
      const amtInput = modalBody.querySelector('#ctrl-adjust-amount');
      if (amtInput) amtInput.value = btn.dataset.amount;
    };
  });

  // Wire Quick Reason Chips
  modalBody.querySelectorAll('.btn-quick-reason').forEach(btn => {
    btn.onclick = () => {
      const reasonInput = modalBody.querySelector('#ctrl-adjust-reason');
      if (reasonInput) reasonInput.value = btn.dataset.reason;
    };
  });

  // Wire Adjuster Submit
  const submitAdjustBtn = modalBody.querySelector('#btn-submit-adjust');
  if (submitAdjustBtn) {
    submitAdjustBtn.onclick = async () => {
      const amountVal = parseInt(modalBody.querySelector('#ctrl-adjust-amount')?.value, 10);
      const reasonVal = modalBody.querySelector('#ctrl-adjust-reason')?.value.trim();

      if (isNaN(amountVal) || amountVal <= 0) {
        toast('Please enter a valid amount greater than 0', 'error');
        return;
      }

      if (!reasonVal) {
        toast('Adjustment reason is mandatory for the ledger', 'error');
        return;
      }

      submitAdjustBtn.disabled = true;
      submitAdjustBtn.textContent = 'Recording adjustment...';

      try {
        const batch = writeBatch(db);
        const txRef = doc(collection(db, 'users', currentMember.uid, 'transactions'));
        const txData = {
          type: adjusterType,
          category: adjusterCategory,
          amount: amountVal,
          reason: reasonVal,
          adminUid: state.user.uid,
          adminName: state.user.displayName || 'Admin',
          createdAt: serverTimestamp()
        };
        batch.set(txRef, txData);

        let actionLabel = 'adjustment';
        if (adjusterCategory === 'points') {
          if (adjusterType === 'bonus') {
            const pointsUpdate = buildPointsUpdate(usersMap.get(currentMember.uid) || currentMember, amountVal);
            batch.update(doc(db, 'users', currentMember.uid), {
              ...pointsUpdate,
              updatedAt: serverTimestamp()
            });
            actionLabel = `+${amountVal} bonus points`;
            currentMember.points = (currentMember.points || 0) + amountVal;
          } else if (adjusterType === 'penalty') {
            batch.update(doc(db, 'users', currentMember.uid), {
              penalties: increment(amountVal),
              updatedAt: serverTimestamp()
            });
            actionLabel = `-${amountVal} penalty points`;
            currentMember.penalties = (currentMember.penalties || 0) + amountVal;
          }
        } else {
          const pRef = doc(db, 'users_private', currentMember.uid);
          let newFineDue = currentMember.finesDue || 0;
          if (adjusterType === 'fine') {
            batch.set(pRef, { finesEGP: increment(amountVal), updatedAt: serverTimestamp() }, { merge: true });
            actionLabel = `+${amountVal} EGP fine`;
            newFineDue += amountVal;
          } else if (adjusterType === 'payment') {
            batch.set(pRef, { finesEGP: increment(-amountVal), updatedAt: serverTimestamp() }, { merge: true });
            actionLabel = `payment of ${amountVal} EGP`;
            newFineDue = Math.max(0, newFineDue - amountVal);
          } else if (adjusterType === 'waive') {
            batch.set(pRef, { finesEGP: increment(-amountVal), updatedAt: serverTimestamp() }, { merge: true });
            actionLabel = `waive of ${amountVal} EGP fine`;
            newFineDue = Math.max(0, newFineDue - amountVal);
          }
          currentMember.finesDue = newFineDue;
        }

        createNotification(batch, {
          uid: currentMember.uid,
          title: 'Account Adjusted',
          message: `Admin adjusted your account: ${actionLabel}. Reason: "${reasonVal}"`,
          type: 'system'
        });

        logAdminAction(batch, {
          action: 'member_adjusted',
          targetUid: currentMember.uid,
          details: { type: adjusterType, category: adjusterCategory, amount: amountVal, reason: reasonVal }
        });

        await batch.commit();

        invalidateEgpCache(currentMember.uid);
        getMemberDerivedEgpBalance(currentMember.uid, true).then((latestEgp) => {
          const finEl = modalBody.querySelector('#ctrl-summary-fines');
          if (finEl) finEl.textContent = `${latestEgp} EGP`;
          const prevEl = modalBody.querySelector('#ctrl-adj-fines-preview');
          if (prevEl) prevEl.textContent = `${latestEgp} EGP`;
        });

        // Update Summary metrics in place
        const ptsEl = modalBody.querySelector('#ctrl-summary-points');
        if (ptsEl) ptsEl.textContent = currentMember.points || 0;
        const penEl = modalBody.querySelector('#ctrl-summary-penalties');
        if (penEl) penEl.textContent = currentMember.penalties || 0;

        // Reset inputs
        const amtInput = modalBody.querySelector('#ctrl-adjust-amount');
        if (amtInput) amtInput.value = '';
        const reasonInput = modalBody.querySelector('#ctrl-adjust-reason');
        if (reasonInput) reasonInput.value = '';

        if (ledgerLoaded) {
          loadTransactionLedger(currentMember.uid, modalBody.querySelector('#member-ctrl-ledger-list'));
        }

        toast(`Successfully applied ${actionLabel}`, 'success');
      } catch (err) {
        console.error('Adjuster error:', err);
        toast('Failed to record adjustment: ' + err.message, 'error');
      } finally {
        submitAdjustBtn.disabled = false;
        submitAdjustBtn.textContent = 'Apply & Record in Ledger';
      }
    };
  }

  openModal({
    title: `Member Control: ${member.displayName || member.name || 'Member'}`,
    body: modalBody,
    saveLabel: 'Save',
    cancelLabel: 'Cancel',
    isDirty: () => hasPendingChanges,
    onSave: async () => {
      if (!hasPendingChanges) return true;
      const cleanName = editedName.trim();
      if (!cleanName) {
        toast('Display name cannot be empty', 'error');
        return false;
      }

      try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', member.uid);

        batch.update(userRef, {
          displayName: cleanName,
          name: cleanName,
          role: selectedRole,
          isAdmin: selectedRole === 'admin',
          updatedAt: serverTimestamp()
        });

        logAdminAction(batch, {
          action: 'member_updated',
          targetUid: member.uid,
          details: { displayName: cleanName, role: selectedRole }
        });

        await batch.commit();

        member.displayName = cleanName;
        member.name = cleanName;
        member.role = selectedRole;
        member.isAdmin = (selectedRole === 'admin');

        const u = usersMap.get(member.uid);
        if (u) {
          u.displayName = cleanName;
          u.name = cleanName;
          u.role = selectedRole;
          u.isAdmin = (selectedRole === 'admin');
        }

        renderMembersAdmin();
        toast('Member profile saved successfully', 'success');
        hasPendingChanges = false;
        return true;
      } catch (err) {
        console.error('Error saving member profile:', err);
        toast('Failed to save member profile: ' + err.message, 'error');
        return false;
      }
    }
  });

  updateSaveButtonState();
}

async function handleRepairTotals() {
  openModal({
    title: 'Repair Account Totals',
    body: `
      <div id="repair-totals-body" class="py-8 text-center space-y-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-amber-400 border-t-transparent"></div>
        <div class="space-y-1">
          <p class="font-bold text-white text-sm">Auditing Team Balances &amp; Time Buckets...</p>
          <p class="text-xs text-neutral-400">Comparing member points, month/week buckets, and penalties against verified submissions and attendance records.</p>
        </div>
      </div>
    `
  });

  try {
    // 1. Fetch all members with pagination
    let allUsers = [];
    let lastDoc = null;
    while (true) {
      let q = query(collection(db, 'users'), limit(100));
      if (lastDoc) {
        q = query(collection(db, 'users'), startAfter(lastDoc), limit(100));
      }
      const snap = await getDocs(q);
      if (snap.empty) break;
      snap.forEach(d => allUsers.push(normalizeUser({ uid: d.id, ...d.data() })));
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 100) break;
    }

    const mismatches = [];
    const nowMs = serverNow();
    const { curMonthKey, curWeekKey } = getTimeBucketKeys(nowMs, APP_TIMEZONE);

    // 2. Audit each member with submissions + bonus transactions + attendance logs
    for (const u of allUsers) {
      let realPoints = 0;
      let realMonthPoints = 0;
      let realWeekPoints = 0;

      // 2.1 Verified Task Submissions
      const subSnap = await getDocs(query(collection(db, 'submissions'), where('uid', '==', u.uid))).catch(() => ({ docs: [] }));
      subSnap.docs.forEach(d => {
        const s = d.data();
        const pts = Number(s.pointsAwarded) || 0;
        realPoints += pts;
        const sTime = s.submittedAt?.toDate ? s.submittedAt.toDate().getTime() : (s.submittedAt?.seconds ? s.submittedAt.seconds * 1000 : new Date(s.submittedAt || s.createdAt || 0).getTime());
        if (monthKeyOf(sTime, APP_TIMEZONE) === curMonthKey) realMonthPoints += pts;
        if (weekKeyOf(sTime, APP_TIMEZONE) === curWeekKey) realWeekPoints += pts;
      });

      // 2.2 Points & Deduction Transactions
      const txSnap = await getDocs(query(collection(db, 'users', u.uid, 'transactions'))).catch(() => ({ docs: [] }));
      let txDeductions = 0;
      txSnap.docs.forEach(d => {
        const t = d.data();
        if (t.category === 'points' && t.type === 'bonus') {
          const bPts = Number(t.amount) || 0;
          realPoints += bPts;
          const tTime = t.createdAt?.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt || 0).getTime();
          if (monthKeyOf(tTime, APP_TIMEZONE) === curMonthKey) realMonthPoints += bPts;
          if (weekKeyOf(tTime, APP_TIMEZONE) === curWeekKey) realWeekPoints += bPts;
        } else if (t.category === 'points' && t.type === 'deduction') {
          txDeductions += Number(t.amount) || 0;
        }
      });

      // 2.3 Attendance Penalties
      const attAgg = await getAggregateFromServer(query(collection(db, 'attendance_logs'), where('uid', '==', u.uid)), {
        totalPenalty: sum('penalty')
      }).catch(() => ({ data: () => ({ totalPenalty: 0 }) }));
      const realPenalties = (attAgg.data().totalPenalty || 0) + txDeductions;

      const curPoints = u.points || 0;
      const curPenalties = u.penalties || 0;
      const curMonthPoints = (u.monthKey === curMonthKey || u.monthBucket === curMonthKey) ? (u.monthPoints || 0) : 0;
      const curWeekPoints = (u.weekKey === curWeekKey || u.weekBucket === curWeekKey) ? (u.weekPoints || 0) : 0;

      const needsRepair = curPoints !== realPoints || 
                          curPenalties !== realPenalties || 
                          u.monthKey !== curMonthKey || 
                          u.monthPoints !== realMonthPoints || 
                          u.weekKey !== curWeekKey || 
                          u.weekPoints !== realWeekPoints;

      if (needsRepair) {
        mismatches.push({
          user: u,
          curPoints,
          realPoints,
          curPenalties,
          realPenalties,
          curMonthPoints,
          realMonthPoints,
          curWeekPoints,
          realWeekPoints
        });
      }
    }

    const bodyEl = document.getElementById('repair-totals-body');
    if (!bodyEl) return;

    if (mismatches.length === 0) {
      bodyEl.innerHTML = `
        <div class="py-6 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">✓</div>
          <h3 class="font-bold text-white text-base">All Member Totals &amp; Buckets In Sync</h3>
          <p class="text-xs text-neutral-400 max-w-sm mx-auto">All ${allUsers.length} member accounts match their verified points, attendance penalties, and current month/week buckets perfectly.</p>
          <div class="pt-2">
            <button class="modal-close-btn px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition">
              Close
            </button>
          </div>
        </div>
      `;
      const closeBtn = bodyEl.querySelector('.modal-close-btn'); if (closeBtn) closeBtn.onclick = closeAllModals;
      return;
    }

    // Display mismatches preview
    bodyEl.innerHTML = `
      <div class="text-left space-y-4">
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
          <div class="font-bold text-amber-400 flex items-center gap-1.5">
            <span>⚠ Audit Discrepancies Found</span>
          </div>
          <p class="text-neutral-300">Found <strong>${mismatches.length}</strong> member(s) needing score or time-bucket synchronization. Review calculated corrections below before applying.</p>
        </div>

        <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
          ${mismatches.map(m => `
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
              <div class="font-bold text-white">${esc(m.user.displayName)} <span class="font-mono text-[10px] text-neutral-400">(${esc(m.user.uid)})</span></div>
              <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span class="text-neutral-400">Total Points:</span>
                  <span class="font-mono ${m.curPoints !== m.realPoints ? 'text-amber-400 font-bold' : 'text-neutral-300'}">
                    ${m.curPoints} &rarr; ${m.realPoints}
                  </span>
                </div>
                <div>
                  <span class="text-neutral-400">Penalties:</span>
                  <span class="font-mono ${m.curPenalties !== m.realPenalties ? 'text-rose-400 font-bold' : 'text-neutral-300'}">
                    ${m.curPenalties} &rarr; ${m.realPenalties}
                  </span>
                </div>
                <div>
                  <span class="text-neutral-400">Month (${curMonthKey}):</span>
                  <span class="font-mono ${m.curMonthPoints !== m.realMonthPoints ? 'text-sky-400 font-bold' : 'text-neutral-300'}">
                    ${m.curMonthPoints} &rarr; ${m.realMonthPoints}
                  </span>
                </div>
                <div>
                  <span class="text-neutral-400">Week (${curWeekKey}):</span>
                  <span class="font-mono ${m.curWeekPoints !== m.realWeekPoints ? 'text-sky-400 font-bold' : 'text-neutral-300'}">
                    ${m.curWeekPoints} &rarr; ${m.realWeekPoints}
                  </span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button id="btn-cancel-repair" class="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition">
            Cancel
          </button>
          <button id="btn-apply-repair" class="px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/20">
            Apply Repair (${mismatches.length})
          </button>
        </div>
      </div>
    `;
    const cancelRepairBtn = bodyEl.querySelector('#btn-cancel-repair') || document.getElementById('btn-cancel-repair');
    if (cancelRepairBtn) cancelRepairBtn.onclick = closeAllModals;
    const applyRepairBtn = bodyEl.querySelector('#btn-apply-repair') || document.getElementById('btn-apply-repair');
    if (applyRepairBtn) applyRepairBtn.onclick = async () => {
      const applyBtn = document.getElementById('btn-apply-repair');
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying Repairs...';
      }

      try {
        const CHUNK_SIZE = 450;
        for (let i = 0; i < mismatches.length; i += CHUNK_SIZE) {
          const chunk = mismatches.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          for (const item of chunk) {
            const userRef = doc(db, 'users', item.user.uid);
            batch.update(userRef, {
              points: item.realPoints,
              penalties: item.realPenalties,
              monthBucket: curMonthKey,
              monthPoints: item.realMonthPoints,
              weekBucket: curWeekKey,
              weekPoints: item.realWeekPoints,
              updatedAt: serverTimestamp()
            });

            createNotification(batch, {
              uid: item.user.uid,
              title: 'Account Totals Reconciled',
              message: `Your account score was recalculated from verified submissions (${item.realPoints} pts, ${item.realPenalties} penalties, Month: ${item.realMonthPoints} pts, Week: ${item.realWeekPoints} pts).`,
              type: 'system'
            });

            logAdminAction(batch, {
              action: 'repair_totals',
              targetUid: item.user.uid,
              details: {
                oldPoints: item.curPoints,
                newPoints: item.realPoints,
                oldPenalties: item.curPenalties,
                newPenalties: item.realPenalties,
                monthBucket: curMonthKey,
                monthPoints: item.realMonthPoints,
                weekBucket: curWeekKey,
                weekPoints: item.realWeekPoints
              }
            });

            if (usersMap.has(item.user.uid)) {
              const mem = usersMap.get(item.user.uid);
              mem.points = item.realPoints;
              mem.penalties = item.realPenalties;
              mem.monthBucket = curMonthKey;
              mem.monthPoints = item.realMonthPoints;
              mem.weekBucket = curWeekKey;
              mem.weekPoints = item.realWeekPoints;
            }

            if (state.user?.uid === item.user.uid) {
              state.user.points = item.realPoints;
              state.user.penalties = item.realPenalties;
              state.user.monthBucket = curMonthKey;
              state.user.monthPoints = item.realMonthPoints;
              state.user.weekBucket = curWeekKey;
              state.user.weekPoints = item.realWeekPoints;
            }
          }

          await batch.commit();
        }

        toast(`Repaired totals for ${mismatches.length} members!`, 'success');
        closeAllModals();
      } catch (err) {
        console.error('Error applying repair totals:', err);
        toast(err.message || 'Failed to apply repair', 'error');
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = 'Retry Apply';
        }
      }
    };
  } catch (err) {
    console.error('Error executing repair audit:', err);
    toast(err.message || 'Audit failed', 'error');
    closeAllModals();
  }
}

/* ==========================================================================
   UI RENDERING: BROADCAST CAROUSEL & ADMIN BROADCASTS (Task 6)
   ========================================================================== */

let broadcastTimer = null;
let currentBroadcastIndex = 0;
let isBroadcastModalOpen = false;
let broadcastEvalInterval = null;

function toDatetimeLocalString(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getActiveBroadcasts() {
  const now = serverNow();
  const isAdmin = Boolean(state.user?.isAdmin || state.user?.role === 'admin');

  const userBadgeIds = new Set([
    ...(Array.isArray(state.user?.badgeIds) ? state.user.badgeIds : []),
    ...(Array.isArray(state.user?.badges) ? state.user.badges.map(x => typeof x === 'string' ? x : x?.id).filter(Boolean) : [])
  ]);

  return (state.broadcasts || []).filter(b => {
    // 1. Exclude archived broadcasts
    if (b.archived === true || b.status === 'archived') return false;

    // 2. Ensure serverNow() is strictly within start/end limits
    const startMs = typeof b.startDateTime === 'number' ? b.startDateTime : (b.startDateTime?.toMillis ? b.startDateTime.toMillis() : new Date(b.startDateTime || 0).getTime());
    const endMs = typeof b.endDateTime === 'number' ? b.endDateTime : (b.endDateTime?.toMillis ? b.endDateTime.toMillis() : new Date(b.endDateTime || 0).getTime());
    if (startMs && now < startMs) return false;
    if (endMs && now > endMs) return false;

    // 3. Strictly match audience: badgeIds or 'all'
    const targetType = b.targetType || 'all';
    if (targetType === 'all') return true;

    if (targetType === 'badge') {
      const bBadgeIds = Array.isArray(b.badgeIds) ? b.badgeIds : [];
      if (bBadgeIds.length === 0) return true;
      if (isAdmin) return true;
      return bBadgeIds.some(id => userBadgeIds.has(id));
    }

    return true;
  });
}

let broadcastProgressMs = 0;
let lastBroadcastTickMs = 0;
let isBannerHeldOrHovered = false;
let isBroadcastTickerInitialized = false;

function ensureBroadcastTicker() {
  if (isBroadcastTickerInitialized) return;
  isBroadcastTickerInitialized = true;

  ticker.subscribe('home_broadcast_progress', () => {
    const active = getActiveBroadcasts();
    const fillEl = document.getElementById('broadcast-progress-fill') || document.querySelector('.broadcast-progress-fill');

    // If active <= 1: do not rotate, reset width to 0%
    if (active.length <= 1) {
      broadcastProgressMs = 0;
      lastBroadcastTickMs = Date.now();
      if (fillEl) fillEl.style.width = '0%';
      return;
    }

    // Pause on modal open, touch/hold, hover, or document.hidden
    if (isBroadcastModalOpen || isBannerHeldOrHovered || (typeof document !== 'undefined' && document.hidden)) {
      lastBroadcastTickMs = Date.now();
      return;
    }

    const now = Date.now();
    const delta = lastBroadcastTickMs > 0 ? Math.min(now - lastBroadcastTickMs, 500) : 100;
    lastBroadcastTickMs = now;

    if (currentBroadcastIndex >= active.length) {
      currentBroadcastIndex = 0;
    }
    const current = active[currentBroadcastIndex];
    const durationMs = Math.max(3000, ((Number(current?.durationSeconds) || 5) * 1000));

    broadcastProgressMs += delta;

    if (broadcastProgressMs >= durationMs) {
      // 100% reached: advance immediately to next broadcast, reset width to 0%, repeat
      broadcastProgressMs = 0;
      if (fillEl) {
        fillEl.style.transition = 'none';
        fillEl.style.width = '0%';
      }
      advanceBroadcast();
    } else {
      const pct = Math.min(100, (broadcastProgressMs / durationMs) * 100);
      if (fillEl) {
        fillEl.style.transition = 'width 0.1s linear';
        fillEl.style.width = `${pct}%`;
      }
    }
  }, 100);
}

export function renderHomeBroadcastBanner() {
  ensureBroadcastTicker();
  const banner = document.getElementById('home-broadcast-banner');
  const titleEl = document.getElementById('broadcast-banner-title');
  const iconEl = document.getElementById('broadcast-banner-icon');
  const trackEl = document.getElementById('broadcast-progress-track') || banner?.querySelector('.broadcast-progress-track');
  const fillEl = document.getElementById('broadcast-progress-fill') || banner?.querySelector('.broadcast-progress-fill');
  if (!banner || !titleEl) return;

  const active = getActiveBroadcasts();

  // If activeBroadcasts.length === 0: hide banner
  if (active.length === 0) {
    banner.classList.add('hidden');
    if (fillEl) fillEl.style.width = '0%';
    broadcastProgressMs = 0;
    return;
  }

  banner.classList.remove('hidden');

  if (currentBroadcastIndex >= active.length) {
    currentBroadcastIndex = 0;
    broadcastProgressMs = 0;
  }

  const current = active[currentBroadcastIndex];
  titleEl.textContent = current.title || 'Notice';

  if (iconEl) {
    iconEl.innerHTML = getIconSvg(current.icon || 'megaphone', 'w-4 h-4 text-[#0A84FF]');
  }

  // Tapping banner opens Broadcast Detail modal
  banner.onclick = () => {
    openBroadcastDetailModal(current.id);
  };

  // Wire pause listeners on touch/hold and mouse hover
  if (!banner.dataset.touchWired) {
    banner.dataset.touchWired = 'true';
    banner.addEventListener('touchstart', () => { isBannerHeldOrHovered = true; }, { passive: true });
    banner.addEventListener('touchend', () => { isBannerHeldOrHovered = false; lastBroadcastTickMs = Date.now(); }, { passive: true });
    banner.addEventListener('touchcancel', () => { isBannerHeldOrHovered = false; lastBroadcastTickMs = Date.now(); }, { passive: true });
    banner.addEventListener('mouseenter', () => { isBannerHeldOrHovered = true; });
    banner.addEventListener('mouseleave', () => { isBannerHeldOrHovered = false; lastBroadcastTickMs = Date.now(); });
  }

  // If active.length === 1: hide track, do not run rotation
  if (active.length === 1) {
    if (trackEl) trackEl.classList.add('hidden');
    if (fillEl) fillEl.style.width = '0%';
    broadcastProgressMs = 0;
  } else {
    if (trackEl) trackEl.classList.remove('hidden');
  }
}

export function advanceBroadcast() {
  if (isBroadcastModalOpen) return;
  const active = getActiveBroadcasts();
  if (active.length <= 1) return;

  const banner = document.getElementById('home-broadcast-banner');
  if (!banner) return;

  banner.classList.add('fade-out');
  setTimeout(() => {
    currentBroadcastIndex = (currentBroadcastIndex + 1) % active.length;
    broadcastProgressMs = 0;
    const fillEl = document.getElementById('broadcast-progress-fill') || banner.querySelector('.broadcast-progress-fill');
    if (fillEl) {
      fillEl.style.transition = 'none';
      fillEl.style.width = '0%';
    }
    renderHomeBroadcastBanner();
    banner.classList.remove('fade-out');
    banner.classList.add('fade-in');
    setTimeout(() => {
      banner.classList.remove('fade-in');
    }, 250);
  }, 200);
}

function openBroadcastDetailModal(initialBroadcastOrId) {
  isBroadcastModalOpen = true;
  if (broadcastTimer) {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
  }

  const activeBroadcasts = getActiveBroadcasts();
  if (activeBroadcasts.length === 0) {
    toast('No active broadcast notices at this time.', 'info');
    isBroadcastModalOpen = false;
    return;
  }

  let selectedId;
  if (typeof initialBroadcastOrId === 'string') {
    selectedId = activeBroadcasts.some(b => b.id === initialBroadcastOrId) ? initialBroadcastOrId : activeBroadcasts[0].id;
  } else if (initialBroadcastOrId && initialBroadcastOrId.id) {
    selectedId = initialBroadcastOrId.id;
  } else {
    selectedId = activeBroadcasts[0].id;
  }

  const bodyEl = document.createElement('div');
  bodyEl.className = 'space-y-3';

  function renderModalCard() {
    const currentB = activeBroadcasts.find(b => b.id === selectedId) || activeBroadcasts[0];
    const iconSvg = getIconSvg(currentB.icon || 'megaphone', 'w-5 h-5 text-[#0A84FF]');

    let switcherHtml = '';
    if (activeBroadcasts.length > 1) {
      switcherHtml = `
        <div class="task-filter-bar flex items-center gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none">
          ${activeBroadcasts.map((b, idx) => `
            <button type="button" class="btn-switch-broadcast px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 flex-shrink-0 ${b.id === selectedId ? 'bg-[#0A84FF] text-white shadow-md' : 'bg-white/10 text-neutral-400 hover:text-white'}" data-b-id="${esc(b.id)}">
              <span class="w-3.5 h-3.5 flex items-center justify-center shrink-0">${getIconSvg(b.icon || 'megaphone', 'w-3.5 h-3.5')}</span>
              <span>${esc(b.title || `Notice ${idx + 1}`)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    const hasFooter = Boolean(currentB.customFooter && currentB.customFooter.trim());

    bodyEl.innerHTML = `
      ${switcherHtml}
      <div class="broadcast-unified-card">
        <div class="broadcast-unified-header flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#0A84FF]/25 border border-[#0A84FF]/30 flex items-center justify-center shrink-0">
            ${iconSvg}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase font-bold tracking-wider text-[#0A84FF]">Official Broadcast</div>
            <h3 class="text-base font-bold text-white truncate leading-snug">${esc(currentB.title)}</h3>
          </div>
        </div>

        <div class="broadcast-unified-body text-xs text-neutral-200 whitespace-pre-line py-3">
          ${esc(currentB.description || 'No additional details provided.')}
        </div>

        ${hasFooter ? `
          <div class="broadcast-unified-footer flex items-center text-[11px] text-neutral-400 pt-2 border-t border-white/5">
            <span>${esc(currentB.customFooter.trim())}</span>
          </div>
        ` : ''}
      </div>

      <div class="pt-2 text-center">
        <button class="modal-close-btn px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition text-xs">
          Dismiss
        </button>
      </div>
    `;

    bodyEl.querySelectorAll('.btn-switch-broadcast').forEach(btn => {
      btn.onclick = () => {
        selectedId = btn.dataset.bId;
        renderModalCard();
      };
    });

    const closeBtn = bodyEl.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeAllModals;
  }

  renderModalCard();

  openModal({
    title: 'Broadcast Notice',
    body: bodyEl,
    saveLabel: null,
    onClose: () => {
      isBroadcastModalOpen = false;
      renderHomeBroadcastBanner();
    }
  });
}

// 30-second re-evaluation interval for active broadcasts
if (!broadcastEvalInterval) {
  broadcastEvalInterval = setInterval(() => {
    renderHomeBroadcastBanner();
  }, 30000);
}

function renderAdminBroadcasts() {
  const container = document.getElementById('admin-broadcasts-list');
  if (!container) return;

  if (state.broadcasts.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-6 text-center text-xs text-neutral-400 space-y-1">
        <p class="font-semibold text-white">No broadcasts created</p>
        <p class="text-[11px]">Create a new broadcast to display announcements on member home feeds.</p>
      </div>
    `;
    return;
  }

  const now = serverNow();
  const allBadges = getAllAvailableBadges();

  container.innerHTML = state.broadcasts.map(b => {
    let statusClass = 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30';
    let statusLabel = 'Expired';
    if (now >= b.startDateTime && now <= b.endDateTime) {
      statusClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      statusLabel = 'Live Active';
    } else if (now < b.startDateTime) {
      statusClass = 'bg-[#0A84FF]/20 text-[#0A84FF] border-[#0A84FF]/30';
      statusLabel = 'Scheduled';
    }

    const startFormatted = formatDateTime(b.startDateTime);
    const endFormatted = formatDateTime(b.endDateTime);
    const isSelected = selectionState.active && selectionState.type === 'broadcasts' && selectionState.selectedIds.has(b.id);
    const iconSvg = getIconSvg(b.icon || 'megaphone', 'w-4 h-4 text-[#0A84FF]');

    let audienceHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">All Team</span>';
    if (b.targetType === 'badge') {
      const bBadgeIds = Array.isArray(b.badgeIds) ? b.badgeIds : [];
      if (bBadgeIds.length === 0) {
        audienceHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-500/20 text-neutral-300">All Badges</span>';
      } else {
        audienceHtml = bBadgeIds.map(bId => {
          const badgeObj = allBadges.find(bg => bg.id === bId) || { label: bId, color: '#3A3A3C' };
          return `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white border border-white/10" style="background-color: ${badgeObj.color || '#3A3A3C'}40">${esc(badgeObj.label)}</span>`;
        }).join(' ');
      }
    }

    return `
      <div class="glass-card bulk-select-card p-3.5 space-y-2 text-xs${isSelected ? ' selected' : ''}" data-broadcast-id="${esc(b.id)}" data-bulk-id="${esc(b.id)}">
        ${BULK_INDICATOR_HTML}
        <div class="bulk-card-content space-y-2 w-full">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-start gap-2.5 min-w-0 flex-1">
              <div class="w-8 h-8 rounded-lg bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                ${iconSvg}
              </div>
              <div class="space-y-1 min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusClass}">
                    ${statusLabel}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-neutral-300">
                    ${b.durationSeconds || 5}s rotation
                  </span>
                  ${audienceHtml}
                </div>
                <h3 class="font-bold text-white text-sm pt-0.5 truncate">${esc(b.title)}</h3>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button class="btn-edit-broadcast px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition" data-broadcast-id="${esc(b.id)}">
                Edit
              </button>
              <button class="btn-delete-broadcast px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold transition" data-broadcast-id="${esc(b.id)}">
                Delete
              </button>
            </div>
          </div>

          ${b.description ? `
            <p class="text-neutral-300 text-[11px] line-clamp-2 bg-black/20 p-2 rounded-lg border border-white/5">
              ${esc(b.description)}
            </p>
          ` : ''}

          ${b.customFooter ? `
            <div class="text-[10px] text-neutral-300 italic flex items-center gap-1">
              <span class="text-neutral-500">Footer:</span>
              <span>"${esc(b.customFooter)}"</span>
            </div>
          ` : ''}

          <div class="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 pt-1 border-t border-white/5">
            <span>Schedule:</span>
            <span>${startFormatted} &rarr; ${endFormatted}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-broadcast').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'broadcasts') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const b = state.broadcasts.find(x => x.id === btn.dataset.broadcastId);
      if (b) openAdminBroadcastModal(b);
    };
  });

  container.querySelectorAll('.btn-delete-broadcast').forEach(btn => {
    btn.onclick = (e) => {
      if (selectionState.active && selectionState.type === 'broadcasts') {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.bulk-select-card');
        if (card) toggleItemSelection(card, card.dataset.bulkId);
        return;
      }
      e.stopPropagation();
      const b = state.broadcasts.find(x => x.id === btn.dataset.broadcastId);
      if (b) handleDeleteBroadcast(b);
    };
  });
}

function openAdminBroadcastModal(broadcast = null) {
  state.editingBroadcastId = broadcast ? broadcast.id : null;
  const now = serverNow();
  const defaultStart = broadcast ? broadcast.startDateTime : now;
  const defaultEnd = broadcast ? broadcast.endDateTime : (now + 7 * 24 * 3600 * 1000);

  let selectedIcon = broadcast?.icon || 'megaphone';
  let targetType = broadcast?.targetType === 'badge' ? 'badge' : 'all';
  let selectedBadgeIds = Array.isArray(broadcast?.badgeIds) ? [...broadcast.badgeIds] : [];
  let durationSeconds = typeof broadcast?.durationSeconds === 'number' && broadcast.durationSeconds >= 3 && broadcast.durationSeconds <= 30
    ? broadcast.durationSeconds
    : (broadcast?.durationSeconds || 5);
  let broadcastStartMs = defaultStart;
  let broadcastEndMs = defaultEnd;

  const modalBody = document.createElement('div');
  modalBody.className = 'space-y-4 text-xs';

  function renderForm() {
    modalBody.innerHTML = `
      <!-- Section 1: Icon & Identity -->
      <div class="ios-inset-group">
        <div class="ios-inset-header">ANNOUNCEMENT IDENTITY</div>
        <div class="p-3.5 space-y-3.5">
          <!-- Icon Picker Row -->
          <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <div class="flex items-center gap-3 min-w-0">
              <div id="broadcast-icon-preview" class="w-10 h-10 rounded-xl bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] flex-shrink-0">
                ${getIconSvg(selectedIcon, 'w-5 h-5')}
              </div>
              <div class="min-w-0">
                <div class="font-semibold text-white text-xs truncate">Broadcast Icon</div>
                <div class="text-[11px] text-neutral-400 capitalize truncate">${esc(selectedIcon)}</div>
              </div>
            </div>
            <button type="button" id="btn-change-broadcast-icon" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition text-xs flex-shrink-0">
              Change Icon
            </button>
          </div>

          <!-- Title -->
          <div>
            <label class="block text-neutral-300 font-semibold mb-1">Title *</label>
            <input id="input-broadcast-title" type="text" maxlength="120" class="ios-input text-white text-sm" value="${esc(broadcast?.title || '')}" placeholder="e.g. Media Team General Meeting" required />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-neutral-300 font-semibold mb-1">Description (Optional)</label>
            <textarea id="input-broadcast-desc" rows="3" class="ios-input text-white text-xs" placeholder="Full announcement notes or details shown when tapped...">${esc(broadcast?.description || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Section 2: Audience & Rotation Duration -->
      <div class="ios-inset-group">
        <div class="ios-inset-header">AUDIENCE &amp; ROTATION</div>
        <div class="p-3.5 space-y-3.5">
          <!-- Audience Selector -->
          <div>
            <label class="block text-neutral-300 font-semibold mb-1">Target Audience</label>
            <div id="broadcast-audience-seg-wrap"></div>
            <p class="text-[10px] text-neutral-400 mt-1">Select whether this broadcast is shown to everyone or specific badges.</p>
          </div>

          <!-- Badge Selector (shown if Badges chosen) -->
          <div id="broadcast-badges-section" class="${targetType === 'badge' ? '' : 'hidden'} space-y-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-white">Target Badges *</span>
              <button type="button" id="btn-select-broadcast-badges" class="text-[#0A84FF] text-xs font-semibold hover:underline">
                + Select Badges
              </button>
            </div>
            <div id="broadcast-badges-chips" class="flex flex-wrap gap-1.5 min-h-6 items-center">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Rotation Duration Stepper -->
          <div class="flex items-center justify-between gap-3 pt-1">
            <div class="min-w-0 flex-1">
              <span class="block text-neutral-200 font-semibold text-xs">Carousel Rotation Duration</span>
              <span class="block text-[10px] text-neutral-400">Display duration before rotating to next banner (3-30s)</span>
            </div>
            <div id="broadcast-stepper-wrap" class="flex-shrink-0"></div>
          </div>
        </div>
      </div>

      <!-- Section 3: Schedule -->
      <div class="ios-inset-group">
        <div class="ios-inset-header">SCHEDULE (ACTIVE WINDOW)</div>
        <div class="p-3.5 space-y-3">
          <div id="field-broadcast-start"></div>
          <div id="field-broadcast-end"></div>
        </div>
      </div>

      <!-- Section 4: Custom Footer -->
      <div class="ios-inset-group">
        <div class="ios-inset-header">FOOTER NOTE (OPTIONAL)</div>
        <div class="p-3.5 space-y-1.5">
          <label class="block text-neutral-300 font-semibold mb-1">Custom Footer (max 80 chars)</label>
          <input id="input-broadcast-footer" type="text" maxlength="80" class="ios-input text-white text-xs" value="${esc(broadcast?.customFooter || '')}" placeholder="e.g. Bring your laptop and badges" />
          <p class="text-[10px] text-neutral-400">Displayed at the bottom of the member detail card. Leave empty to omit the footer entirely.</p>
        </div>
      </div>
    `;

    wireComponents();
  }

  function wireComponents() {
    // 1. Icon Change Button
    const changeIconBtn = modalBody.querySelector('#btn-change-broadcast-icon');
    if (changeIconBtn) {
      changeIconBtn.onclick = () => {
        openIconPicker({
          selectedKey: selectedIcon,
          onSelect: (newKey) => {
            selectedIcon = newKey;
            const previewEl = modalBody.querySelector('#broadcast-icon-preview');
            if (previewEl) previewEl.innerHTML = getIconSvg(selectedIcon, 'w-5 h-5');
            const nameEl = previewEl?.nextElementSibling?.querySelector('.capitalize');
            if (nameEl) nameEl.textContent = selectedIcon;
          }
        });
      };
    }

    // 2. Audience Segmented
    const audWrap = modalBody.querySelector('#broadcast-audience-seg-wrap');
    if (audWrap) {
      audWrap.innerHTML = '';
      audWrap.appendChild(renderSegmented({
        id: 'broadcast-audience-seg',
        options: [
          { value: 'all', label: 'All Team' },
          { value: 'badge', label: 'Badges' }
        ],
        value: targetType,
        onChange: (val) => {
          targetType = val;
          const badgeSec = modalBody.querySelector('#broadcast-badges-section');
          if (badgeSec) {
            if (val === 'badge') {
              badgeSec.classList.remove('hidden');
              if (selectedBadgeIds.length === 0) {
                openBadgeMultiPickerModal();
              }
            } else {
              badgeSec.classList.add('hidden');
            }
          }
        }
      }));
    }

    // 3. Badge chips and Selector button
    renderBadgeChips();
    const selectBadgesBtn = modalBody.querySelector('#btn-select-broadcast-badges');
    if (selectBadgesBtn) {
      selectBadgesBtn.onclick = () => openBadgeMultiPickerModal();
    }

    // 4. Stepper for Duration
    const stepperWrap = modalBody.querySelector('#broadcast-stepper-wrap');
    if (stepperWrap) {
      stepperWrap.innerHTML = '';
      stepperWrap.appendChild(renderStepper({
        id: 'broadcast-stepper',
        value: durationSeconds,
        min: 3,
        max: 30,
        step: 1,
        unit: 's',
        onChange: (v) => {
          durationSeconds = v;
        }
      }));
    }

    // 5. DateTime fields
    const startBox = modalBody.querySelector('#field-broadcast-start');
    if (startBox) {
      startBox.replaceWith(renderDateTimeField({
        label: 'Start Date & Time',
        valueMs: broadcastStartMs,
        mode: 'datetime',
        onChange: (ms) => { broadcastStartMs = ms; }
      }));
    }
    const endBox = modalBody.querySelector('#field-broadcast-end');
    if (endBox) {
      endBox.replaceWith(renderDateTimeField({
        label: 'End Date & Time',
        valueMs: broadcastEndMs,
        mode: 'datetime',
        onChange: (ms) => { broadcastEndMs = ms; }
      }));
    }
  }

  function renderBadgeChips() {
    const chipsContainer = modalBody.querySelector('#broadcast-badges-chips');
    if (!chipsContainer) return;
    if (selectedBadgeIds.length === 0) {
      chipsContainer.innerHTML = '<span class="text-neutral-500 italic text-[11px]">No badges selected yet.</span>';
      return;
    }
    const allBadges = getAllAvailableBadges();
    chipsContainer.innerHTML = selectedBadgeIds.map(bId => {
      const bObj = allBadges.find(b => b.id === bId) || { id: bId, label: bId, color: '#3A3A3C' };
      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white border border-white/10" style="background-color: ${bObj.color || '#3A3A3C'}40">
          <span class="w-2 h-2 rounded-full" style="background-color: ${bObj.color || '#3A3A3C'}"></span>
          <span>${esc(bObj.label)}</span>
          <button type="button" class="btn-remove-broadcast-badge hover:text-rose-400 transition ml-0.5" data-badge-id="${esc(bObj.id)}" aria-label="Remove badge">&times;</button>
        </span>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.btn-remove-broadcast-badge').forEach(btn => {
      btn.onclick = () => {
        const idToRemove = btn.dataset.badgeId;
        selectedBadgeIds = selectedBadgeIds.filter(id => id !== idToRemove);
        renderBadgeChips();
      };
    });
  }

  function openBadgeMultiPickerModal() {
    const allBadges = getAllAvailableBadges();
    const tempSelected = new Set(selectedBadgeIds);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'space-y-3';

    function renderPickerRows() {
      bodyEl.innerHTML = `
        <div class="space-y-1.5 max-h-72 overflow-y-auto">
          ${allBadges.map(b => {
            const isSelected = tempSelected.has(b.id);
            return `
              <button type="button" class="btn-toggle-badge-row w-full p-2.5 rounded-xl flex items-center justify-between text-left transition ${isSelected ? 'bg-[#0A84FF]/20 border border-[#0A84FF]/40 text-white' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300'}" data-badge-id="${esc(b.id)}">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${b.color || '#0A84FF'}"></span>
                  <span class="font-semibold text-xs truncate">${esc(b.label)}</span>
                </div>
                ${isSelected ? `
                  <svg class="w-4 h-4 text-[#0A84FF] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                  </svg>
                ` : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;

      bodyEl.querySelectorAll('.btn-toggle-badge-row').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.badgeId;
          if (tempSelected.has(id)) {
            tempSelected.delete(id);
          } else {
            tempSelected.add(id);
          }
          renderPickerRows();
        };
      });
    }

    renderPickerRows();

    openModal({
      title: 'Select Target Badges',
      body: bodyEl,
      saveLabel: 'Done',
      onSave: async () => {
        selectedBadgeIds = Array.from(tempSelected);
        renderBadgeChips();
        return true;
      }
    });
  }

  renderForm();

  openModal({
    title: broadcast ? 'Edit Broadcast' : 'New Broadcast',
    body: modalBody,
    saveLabel: broadcast ? 'Save Changes' : 'Publish Broadcast',
    onClose: () => {
      state.editingBroadcastId = null;
    },
    onSave: async () => {
      const titleInput = modalBody.querySelector('#input-broadcast-title');
      const descInput = modalBody.querySelector('#input-broadcast-desc');
      const footerInput = modalBody.querySelector('#input-broadcast-footer');
      const saveBtn = document.getElementById('shared-modal-save');

      const title = titleInput?.value.trim() || '';
      const desc = descInput?.value.trim() || '';
      const customFooter = footerInput?.value.trim() || '';

      if (!title) {
        toast('Broadcast title is required', 'error');
        return false;
      }
      if (title.length > 120) {
        toast('Title cannot exceed 120 characters', 'error');
        return false;
      }
      if (customFooter.length > 80) {
        toast('Custom footer cannot exceed 80 characters', 'error');
        return false;
      }
      if (targetType === 'badge' && selectedBadgeIds.length === 0) {
        toast('Please select at least one badge for the target audience', 'error');
        return false;
      }
      if (isNaN(durationSeconds) || durationSeconds < 3 || durationSeconds > 30) {
        toast('Rotation duration must be between 3 and 30 seconds', 'error');
        return false;
      }
      if (isNaN(broadcastStartMs) || isNaN(broadcastEndMs)) {
        toast('Invalid date/time provided', 'error');
        return false;
      }
      if (broadcastEndMs <= broadcastStartMs) {
        toast('End date/time must be strictly after start date/time', 'error');
        return false;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      try {
        const payload = {
          title,
          description: desc || '',
          icon: selectedIcon,
          targetType,
          badgeIds: targetType === 'badge' ? selectedBadgeIds : [],
          durationSeconds,
          startDateTime: Timestamp.fromMillis(broadcastStartMs),
          endDateTime: Timestamp.fromMillis(broadcastEndMs),
          customFooter,
          updatedAt: serverTimestamp()
        };

        if (state.editingBroadcastId) {
          const bId = state.editingBroadcastId;
          await updateDoc(doc(db, 'broadcasts', bId), payload);

          const batch = writeBatch(db);
          logAdminAction(batch, {
            action: 'update_broadcast',
            details: { id: bId, title }
          });
          await batch.commit();

          toast('Broadcast updated successfully', 'success');
        } else {
          payload.archived = false;
          payload.createdAt = serverTimestamp();
          const docRef = await addDoc(collection(db, 'broadcasts'), payload);

          // Write matching notifications_broadcast doc(s)
          if (targetType === 'badge') {
            for (const bId of selectedBadgeIds) {
              await addDoc(collection(db, 'notifications_broadcast'), {
                title,
                message: desc || title,
                body: desc || title,
                type: 'broadcast',
                targetType: 'badge',
                badgeId: bId,
                broadcastId: docRef.id,
                icon: selectedIcon,
                archived: false,
                readBy: [],
                createdAt: serverTimestamp()
              });
            }
          } else {
            await addDoc(collection(db, 'notifications_broadcast'), {
              title,
              message: desc || title,
              body: desc || title,
              type: 'broadcast',
              targetType: 'all',
              broadcastId: docRef.id,
              icon: selectedIcon,
              archived: false,
              readBy: [],
              createdAt: serverTimestamp()
            });
          }

          const batch = writeBatch(db);
          logAdminAction(batch, {
            action: 'create_broadcast',
            details: { id: docRef.id, title }
          });
          await batch.commit();

          toast('Broadcast published & notified to team!', 'success');
        }

        state.editingBroadcastId = null;
        closeAllModals();
        return true;
      } catch (err) {
        console.error('Error saving broadcast:', err);
        toast('Failed to save broadcast: ' + err.message, 'error');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = broadcast ? 'Save Changes' : 'Publish Broadcast';
        }
        return false;
      }
    }
  });
}

async function handleDeleteBroadcast(broadcast) {
  const confirm = await confirmSheet({
    title: 'Delete Broadcast',
    message: `Are you sure you want to delete "${broadcast.title}"? It will immediately stop displaying on member feeds.`,
    confirmLabel: 'Delete Broadcast',
    destructive: true
  });

  if (!confirm) return;

  try {
    await deleteDoc(doc(db, 'broadcasts', broadcast.id));

    const batch = writeBatch(db);
    logAdminAction(batch, {
      action: 'delete_broadcast',
      details: { id: broadcast.id, title: broadcast.title }
    });
    await batch.commit();

    toast('Broadcast deleted', 'info');
  } catch (err) {
    console.error('Error deleting broadcast:', err);
    toast(err.message || 'Failed to delete broadcast', 'error');
  }
}

async function importLegacyAnnouncements() {
  let importedCount = 0;
  try {
    // 1. Check settings/app_config.announcementEn
    if (state.settings?.announcementEn) {
      const existing = state.broadcasts.find(b => b.title === state.settings.announcementEn);
      if (!existing) {
        const now = serverNow();
        const payload = {
          title: state.settings.announcementEn,
          description: '',
          durationSeconds: 5,
          startDateTime: Timestamp.fromMillis(now),
          endDateTime: Timestamp.fromMillis(now + 7 * 24 * 3600 * 1000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'broadcasts'), payload);
        importedCount++;
      }
    }

    // 2. Check legacy 'announcements' collection if one exists
    try {
      const snap = await getDocs(collection(db, 'announcements'));
      for (const d of snap.docs) {
        const data = d.data();
        const title = data.title || data.text || data.announcement || data.message || 'Legacy Announcement';
        const existing = state.broadcasts.find(b => b.title === title || b.id === d.id);
        if (!existing) {
          const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : serverNow());
          const payload = {
            title,
            description: data.description || data.body || '',
            durationSeconds: 5,
            startDateTime: Timestamp.fromMillis(createdMs),
            endDateTime: Timestamp.fromMillis(createdMs + 7 * 24 * 3600 * 1000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await addDoc(collection(db, 'broadcasts'), payload);
          importedCount++;
        }
      }
    } catch (collErr) {
      // Announcements collection might not exist; safe to continue
    }

    if (importedCount > 0) {
      toast(`Imported ${importedCount} announcement(s) into broadcasts!`, 'success');
    } else {
      toast('No new legacy announcements found to import.', 'info');
    }
  } catch (err) {
    console.error('Error importing announcements:', err);
    toast(err.message || 'Failed to import announcements', 'error');
  }
}

function applySettings() {
  const titleEls = [
    document.getElementById('header-app-title'),
    document.getElementById('drawer-footer-brand'),
    document.getElementById('loader-app-name')
  ];
  titleEls.forEach(el => {
    if (el) el.textContent = state.settings.appName || 'COC Media Team';
  });

  const versionEls = [
    document.getElementById('drawer-footer-version'),
    document.getElementById('loader-app-version'),
    document.getElementById('header-app-version'),
    document.getElementById('profile-footer-version')
  ];
  document.querySelectorAll('.version-badge').forEach(el => { if (el) el.textContent = `v${APP_VERSION}`; });
  versionEls.forEach(el => {
    if (el) el.textContent = `v${APP_VERSION}`;
  });

  const devCreditEl = document.getElementById('drawer-footer-dev');
  if (devCreditEl) devCreditEl.textContent = state.settings.developerCredit || 'Designed & Developed by Steven Mario';

  const announcementBar = document.getElementById('announcement-bar');
  if (announcementBar) {
    announcementBar.classList.add('hidden');
  }

  // Sync Admin Hub settings fields with current state
  const appNameInput = document.getElementById('input-settings-appname');
  if (appNameInput && state.settings.appName) appNameInput.value = state.settings.appName;
  const logoUrlInput = document.getElementById('input-settings-logourl');
  const logoPreview = document.getElementById('img-settings-logo-preview');
  if (logoUrlInput && state.settings.logoUrl) {
    logoUrlInput.value = state.settings.logoUrl;
    if (logoPreview) logoPreview.src = state.settings.logoUrl;
  }
  const subEnInput = document.getElementById('input-settings-sub-en');
  if (subEnInput && state.settings.subtitleEn) subEnInput.value = state.settings.subtitleEn;
  const devCreditInput = document.getElementById('input-settings-devcredit');
  if (devCreditInput && state.settings.developerCredit) devCreditInput.value = state.settings.developerCredit;
  const defaultPeriodInput = document.getElementById('input-settings-default-leaderboard-period');
  if (defaultPeriodInput && state.settings.defaultLeaderboardPeriod) defaultPeriodInput.value = state.settings.defaultLeaderboardPeriod;
}

/* ==========================================================================
   EVENT HANDLERS & INITIALIZATION
   ========================================================================== */
export function updateLiveAppLogo(logoUrl) {
  if (!logoUrl) return;
  state.settings.logoUrl = logoUrl;
  const targets = [
    document.getElementById('header-logo-img'),
    document.getElementById('img-settings-logo-preview'),
    document.querySelector('#side-drawer img[alt="Logo"]'),
    document.querySelector('#app-loader img[alt="COC Media Team Logo"]')
  ];
  targets.forEach(img => {
    if (img) img.src = logoUrl;
  });
}

export async function handleChangeAppLogo() {
  try {
    const dataUri = await pickAndCropImage({ shape: 'rounded', outSize: 256, maxChars: 60000 });
    if (!dataUri) return;

    await setDoc(doc(db, 'settings', 'general'), {
      logoUrl: dataUri,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(doc(db, 'settings', 'app_config'), {
      logoUrl: dataUri,
      updatedAt: serverTimestamp()
    }, { merge: true });

    updateLiveAppLogo(dataUri);
    toast('App logo updated successfully!', 'success');
  } catch (err) {
    console.error('Error updating app logo:', err);
    toast('Failed to update app logo: ' + (err.message || err), 'error');
  }
}

function attachEventHandlers() {
  // Navigation & Drawer
  const menuBtn = document.getElementById('btn-open-drawer');
  if (menuBtn) menuBtn.onclick = openDrawer;

  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  if (closeDrawerBtn) closeDrawerBtn.onclick = closeDrawer;

  const backdrop = document.getElementById('side-drawer-backdrop');
  if (backdrop) backdrop.onclick = closeDrawer;

  const notifBell = document.getElementById('btn-open-notifications');
  if (notifBell) {
    notifBell.onclick = () => {
      if (userPagerInstance) userPagerInstance.goTo('notifications');
    };
  }

  // Admin Overlay Buttons
  const adminBtn = document.getElementById('drawer-btn-admin');
  if (adminBtn) {
    adminBtn.onclick = () => {
      closeDrawer();
      openAdminPortal();
    };
  }

  const closeAdminBtn = document.getElementById('btn-close-admin-dashboard');
  if (closeAdminBtn) closeAdminBtn.onclick = closeAdminDashboard;

  // Floating Bulk Selection Action Bar Handlers
  const selectAllBtn = document.getElementById('btn-bulk-select-all');
  if (selectAllBtn) selectAllBtn.onclick = toggleSelectAll;

  const deleteBulkBtn = document.getElementById('btn-bulk-delete');
  if (deleteBulkBtn) deleteBulkBtn.onclick = handleBulkDelete;

  const doneBulkBtn = document.getElementById('btn-bulk-done');
  if (doneBulkBtn) doneBulkBtn.onclick = exitSelectionMode;

  // Master Admin Auth Form
  const adminAuthForm = document.getElementById('form-admin-auth');
  if (adminAuthForm) {
    adminAuthForm.onsubmit = (e) => {
      e.preventDefault();
      const pwInput = document.getElementById('input-admin-password');
      const errEl = document.getElementById('admin-auth-error');
      if (pwInput && pwInput.value === ADMIN_MASTER_PASSWORD) {
        state.isAdminUnlocked = true;
        closeAllModals();
        showAdminDashboard();
        checkAdminRoleUI();
        toast('Admin privileges unlocked!', 'success');
      } else {
        if (errEl) errEl.classList.remove('hidden');
      }
    };
  }

  // PWA Install Button Handler
  const pwaBtn = document.getElementById('drawer-btn-pwa');
  if (pwaBtn) {
    // Hide Install button if already in standalone mode
    if (isAppStandalone()) {
      pwaBtn.classList.add('hidden');
    }

    pwaBtn.onclick = async () => {
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          toast('Thank you for installing COC Media!', 'success');
          pwaBtn.classList.add('hidden');
        }
        deferredPrompt = null;
      } else {
        // iOS Safari or browsers without beforeinstallprompt
        openModal({
          title: 'Install App (iOS & Android)',
          body: `
            <div class="space-y-4 text-xs text-neutral-300">
              <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div class="font-bold text-white flex items-center gap-2">
                  <span>📱 Apple iOS Safari:</span>
                </div>
                <ol class="list-decimal pl-4 space-y-1">
                  <li>Tap the <strong>Share</strong> button (box with upward arrow).</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong> at top right to complete.</li>
                </ol>
              </div>
              <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div class="font-bold text-white flex items-center gap-2">
                  <span>🌐 Chrome / Android / Desktop:</span>
                </div>
                <p>Tap the three-dot browser menu and select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</p>
              </div>
            </div>
          `
        });
      }
    };
  }

  // Profile Auth Buttons (Only Place for Sign In / Sign Out)
  const googleSignInBtn = document.getElementById('drawer-btn-google-signin');
  if (googleSignInBtn) googleSignInBtn.onclick = handleGoogleSignIn;

  const authGoogleModalBtn = document.getElementById('btn-auth-google');
  if (authGoogleModalBtn) authGoogleModalBtn.onclick = handleGoogleSignIn;

  const fallbackGuestBtn = document.getElementById('btn-fallback-guest');
  if (fallbackGuestBtn) {
    fallbackGuestBtn.onclick = () => {
      closeAllModals();
      toast('Continuing in Read-Only Guest Mode', 'info');
    };
  }

  const copyHostBtn = document.getElementById('btn-copy-hostname');
  if (copyHostBtn) {
    copyHostBtn.onclick = () => {
      navigator.clipboard.writeText(window.location.hostname).then(() => {
        toast('Hostname copied to clipboard', 'success');
      });
    };
  }

  const signOutBtn = document.getElementById('drawer-btn-signout');
  if (signOutBtn) signOutBtn.onclick = handleSignOut;

  // Search and Status Filters
  const searchInput = document.getElementById('input-search-tasks');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value.trim();
      renderTasks();
    };
  }

  const statusFilterSelect = document.getElementById('select-status-filter');
  if (statusFilterSelect) {
    statusFilterSelect.onchange = (e) => {
      state.statusFilter = e.target.value;
      renderTasks();
    };
  }

  // Mark all notifications read
  const markReadBtn = document.getElementById('btn-mark-all-read');
  if (markReadBtn) markReadBtn.onclick = markAllNotificationsRead;

  // Close announcement banner
  const closeAnnounceBtn = document.getElementById('btn-close-announcement');
  if (closeAnnounceBtn) {
    closeAnnounceBtn.onclick = () => {
      const banner = document.getElementById('announcement-bar');
      if (banner) banner.classList.add('hidden');
    };
  }

  // Generic modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.onclick = () => closeAllModals();
  });

  // Task Submission Form
  const submitForm = document.getElementById('form-submit-task');
  if (submitForm) {
    submitForm.onsubmit = async (e) => {
      e.preventDefault();
      const taskId = document.getElementById('submit-task-id')?.value;
      const notes = document.getElementById('input-submit-comment')?.value || '';
      const answer = document.getElementById('input-submit-answer')?.value;
      const task = state.tasks.find(t => t.id === taskId);

      if (!task || !state.user) {
        toast('Please sign in to submit tasks', 'error');
        return;
      }

      const now = serverNow();
      const win = getTaskWindow(task, now);
      const occurrenceKey = (task.schedule?.type === 'once') ? 'once' : (win?.occurrenceKey || 'once');
      const subId = `${task.id}_${state.user.uid}_${occurrenceKey}`;

      try {
        if (!navigator.onLine) {
          toast('Saved offline, will sync', 'info');
        }

        const batch = writeBatch(db);
        const subRef = doc(db, 'submissions', subId);
        const userRef = doc(db, 'users', state.user.uid);

        const answers = answer ? [{
          questionId: 'q_default',
          questionText: 'Proof Answer',
          answer
        }] : [];

        const formPtsInfo = computeTieredTaskPoints(task, now);
        if (!formPtsInfo.canSubmit) {
          toast('Submission closed: deadline and grace period have expired.', 'error');
          return;
        }
        const pointsAwarded = formPtsInfo.points;

        batch.set(subRef, {
          taskId: task.id,
          taskTitle: task.title,
          uid: state.user.uid,
          userName: state.user.name || state.user.displayName || 'Member',
          userAvatar: state.user.avatarUrl || state.user.photoURL || '',
          occurrenceKey,
          answers,
          comment: notes,
          pointsAwarded,
          submittedAt: serverTimestamp(),
          status: 'approved'
        });

        const pointsUpdate = buildPointsUpdate(usersMap.get(state.user.uid) || state.user, pointsAwarded);
        batch.update(userRef, {
          ...pointsUpdate,
          lastOpId: subId,
          updatedAt: serverTimestamp()
        });

        await batch.commit();

        toast('Proof submitted! Points awarded.', 'success');
        closeAllModals();
      } catch (err) {
        toast(err.message || 'Submission failed', 'error');
      }
    };
  }

  // Admin Tasks & Categories Management
  const addTaskBtn = document.getElementById('btn-admin-add-task');
  if (addTaskBtn) {
    addTaskBtn.onclick = () => openAdminTaskModal();
  }

  const addCatBtn = document.getElementById('btn-admin-add-category');
  if (addCatBtn) {
    addCatBtn.onclick = () => openCategoryModal();
  }

  const adminTaskFilterActive = document.getElementById('admin-tasks-filter-active');
  const adminTaskFilterArchived = document.getElementById('admin-tasks-filter-archived');
  if (adminTaskFilterActive && adminTaskFilterArchived) {
    adminTaskFilterActive.onclick = () => {
      adminTasksFilter = 'active';
      state.adminTasksFilter = 'active';
      adminTaskFilterActive.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] text-white';
      adminTaskFilterArchived.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-neutral-300 hover:text-white';
      renderAdminTasks();
    };
    adminTaskFilterArchived.onclick = () => {
      adminTasksFilter = 'archived';
      state.adminTasksFilter = 'archived';
      adminTaskFilterArchived.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] text-white';
      adminTaskFilterActive.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-neutral-300 hover:text-white';
      renderAdminTasks();
    };
  }

  const adminCatFilterActive = document.getElementById('admin-cats-filter-active');
  const adminCatFilterArchived = document.getElementById('admin-cats-filter-archived');
  if (adminCatFilterActive && adminCatFilterArchived) {
    adminCatFilterActive.onclick = () => {
      adminCatsFilter = 'active';
      adminCategoriesFilter = 'active';
      state.adminCatsFilter = 'active';
      adminCatFilterActive.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] text-white';
      adminCatFilterArchived.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-neutral-300 hover:text-white';
      renderAdminCategories();
    };
    adminCatFilterArchived.onclick = () => {
      adminCatsFilter = 'archived';
      adminCategoriesFilter = 'archived';
      state.adminCatsFilter = 'archived';
      adminCatFilterArchived.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] text-white';
      adminCatFilterActive.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-neutral-300 hover:text-white';
      renderAdminCategories();
    };
  }

  // Admin Session Buttons & Segmented Filters
  const btnAdminAddSession = document.getElementById('btn-admin-add-session');
  if (btnAdminAddSession) {
    btnAdminAddSession.onclick = () => openAdminSessionModal();
  }

  // Admin Badges Add Button (Section 3)
  const btnAdminAddBadge = document.getElementById('btn-admin-add-badge');
  if (btnAdminAddBadge) {
    btnAdminAddBadge.onclick = () => openBadgeModal();
  }

  const filterSessionActive = document.getElementById('filter-session-active');
  const filterSessionArchived = document.getElementById('filter-session-archived');
  const filterSessionWaivers = document.getElementById('filter-session-waivers');
  const adminSessionsList = document.getElementById('admin-sessions-list');
  const adminWaiversContainer = document.getElementById('admin-waivers-container');

  if (filterSessionActive && filterSessionArchived) {
    filterSessionActive.onclick = () => {
      adminSessionsFilter = 'active';
      filterSessionActive.classList.add('active');
      filterSessionArchived.classList.remove('active');
      if (filterSessionWaivers) filterSessionWaivers.classList.remove('active');
      if (adminSessionsList) adminSessionsList.classList.remove('hidden');
      if (adminWaiversContainer) adminWaiversContainer.classList.add('hidden');
      renderAdminSessions();
    };
    filterSessionArchived.onclick = () => {
      adminSessionsFilter = 'archived';
      filterSessionArchived.classList.add('active');
      filterSessionActive.classList.remove('active');
      if (filterSessionWaivers) filterSessionWaivers.classList.remove('active');
      if (adminSessionsList) adminSessionsList.classList.remove('hidden');
      if (adminWaiversContainer) adminWaiversContainer.classList.add('hidden');
      renderAdminSessions();
    };
    if (filterSessionWaivers) {
      filterSessionWaivers.onclick = () => {
        adminSessionsFilter = 'waivers';
        filterSessionWaivers.classList.add('active');
        filterSessionActive.classList.remove('active');
        filterSessionArchived.classList.remove('active');
        if (adminSessionsList) adminSessionsList.classList.add('hidden');
        if (adminWaiversContainer) adminWaiversContainer.classList.remove('hidden');
        renderAdminWaivers();
      };
    }
  }

  // Waiver Buttons Wiring
  const btnOpenWaiver = document.getElementById('btn-open-waiver-modal');
  if (btnOpenWaiver) btnOpenWaiver.onclick = () => openRequestWaiverModal();
  const drawerBtnWaiver = document.getElementById('drawer-btn-waiver');
  if (drawerBtnWaiver) drawerBtnWaiver.onclick = () => {
    closeDrawer();
    openRequestWaiverModal();
  };

  // Admin Submissions Controls
  const inputSearchSubs = document.getElementById('input-admin-search-submissions');
  if (inputSearchSubs) {
    inputSearchSubs.oninput = (e) => {
      state.adminSubmissionsSearch = e.target.value;
      renderAdminSubmissions();
    };
  }

  const selectFilterTask = document.getElementById('select-admin-filter-task');
  if (selectFilterTask) {
    selectFilterTask.onchange = (e) => {
      state.adminSubmissionsTaskFilter = e.target.value;
      renderAdminSubmissions();
    };
  }

  const btnExportCsv = document.getElementById('btn-export-submissions-csv');
  if (btnExportCsv) {
    btnExportCsv.onclick = exportSubmissionsCSV;
  }

  const btnLoadMoreSubs = document.getElementById('btn-load-more-submissions');
  if (btnLoadMoreSubs) {
    btnLoadMoreSubs.onclick = () => {
      state.adminSubmissionsLimit = (state.adminSubmissionsLimit || 50) + 50;
      setupSubmissionsListeners();
    };
  }

  // Admin Members Controls
  const inputSearchMembers = document.getElementById('input-admin-search-members');
  if (inputSearchMembers) {
    inputSearchMembers.oninput = (e) => {
      state.adminMembersSearch = e.target.value;
      renderAdminMembers();
    };
  }

  const selectFilterRole = document.getElementById('select-admin-filter-role');
  if (selectFilterRole) {
    selectFilterRole.onchange = (e) => {
      state.adminMembersRoleFilter = e.target.value;
      renderAdminMembers();
    };
  }

  const btnLoadMoreMembers = document.getElementById('btn-load-more-members');
  if (btnLoadMoreMembers) {
    btnLoadMoreMembers.onclick = () => {
      state.adminMembersLimit = (state.adminMembersLimit || 50) + 50;
      setupMembersListeners();
    };
  }

  // Push Sender Icon Picker (Task 8)
  const pushIconPickerBtn = document.getElementById('btn-push-icon-picker');
  const pushIconInput = document.getElementById('input-push-icon');
  const pushIconPreview = document.getElementById('push-icon-preview');
  const pushIconLabel = document.getElementById('push-icon-label');
  if (pushIconPickerBtn) {
    pushIconPickerBtn.onclick = () => {
      openIconPicker({
        selectedKey: pushIconInput?.value || 'bell',
        onSelect: (key) => {
          if (pushIconInput) pushIconInput.value = key;
          if (pushIconPreview) pushIconPreview.innerHTML = getIconSvg(key, 'w-4 h-4 stroke-current');
          if (pushIconLabel) pushIconLabel.textContent = key;
        }
      });
    };
  }

  // Admin Hub App Logo Upload & Reset (Task 3)
  const btnChangeLogo = document.getElementById('btn-change-logo');
  if (btnChangeLogo) btnChangeLogo.onclick = handleChangeAppLogo;
  const btnChangeLogoAction = document.getElementById('btn-change-logo-action');
  if (btnChangeLogoAction) btnChangeLogoAction.onclick = handleChangeAppLogo;

  const btnResetLogo = document.getElementById('btn-reset-logo');
  if (btnResetLogo) {
    btnResetLogo.onclick = async () => {
      const defaultLogo = './image_ad59c0.jpg';
      try {
        await setDoc(doc(db, 'settings', 'general'), {
          logoUrl: defaultLogo,
          updatedAt: serverTimestamp()
        }, { merge: true });
        await setDoc(doc(db, 'settings', 'app_config'), {
          logoUrl: defaultLogo,
          updatedAt: serverTimestamp()
        }, { merge: true });
        updateLiveAppLogo(defaultLogo);
        toast('Logo reset to default', 'info');
      } catch (err) {
        toast('Failed to reset logo: ' + (err.message || err), 'error');
      }
    };
  }

  // Clear All Notifications from DB (Task 8 Purge)
  const purgeNotifsBtn = document.getElementById('btn-admin-purge-notifications');
  if (purgeNotifsBtn) {
    purgeNotifsBtn.onclick = async () => {
      const confirmed = await confirmSheet({
        title: 'Clear All Notifications from DB?',
        message: 'This will permanently batch-delete all personal and broadcast notifications from Firestore. This action cannot be undone.',
        confirmLabel: 'Purge All Notifications',
        destructive: true
      });
      if (!confirmed) return;

      purgeNotifsBtn.disabled = true;
      purgeNotifsBtn.textContent = 'Purging...';

      try {
        let totalDeleted = 0;

        // 1. Delete notifications in chunks of 450
        const personalSnap = await getDocs(collection(db, 'notifications'));
        const personalDocs = personalSnap.docs;
        for (let i = 0; i < personalDocs.length; i += 450) {
          const chunk = personalDocs.slice(i, i + 450);
          const b = writeBatch(db);
          chunk.forEach(d => b.delete(d.ref));
          await b.commit();
          totalDeleted += chunk.length;
        }

        // 2. Delete notifications_broadcast in chunks of 450
        const broadcastSnap = await getDocs(collection(db, 'notifications_broadcast'));
        const broadcastDocs = broadcastSnap.docs;
        for (let i = 0; i < broadcastDocs.length; i += 450) {
          const chunk = broadcastDocs.slice(i, i + 450);
          const b = writeBatch(db);
          chunk.forEach(d => b.delete(d.ref));
          await b.commit();
          totalDeleted += chunk.length;
        }

        const logBatch = writeBatch(db);
        logAdminAction(logBatch, {
          action: 'admin_purge_notifications',
          details: { totalDeleted }
        });
        await logBatch.commit();

        toast(`Purged ${totalDeleted} notification records from database`, 'success');
      } catch (err) {
        console.error('Purge notifications error:', err);
        toast(err.message || 'Failed to purge notifications', 'error');
      } finally {
        purgeNotifsBtn.disabled = false;
        purgeNotifsBtn.textContent = 'Purge DB';
      }
    };
  }

  // Reset Local Cache Button (Task 8)
  const resetCacheBtn = document.getElementById('btn-admin-reset-cache');
  if (resetCacheBtn) {
    resetCacheBtn.onclick = async () => {
      const confirmed = await confirmSheet({
        title: 'Reset Local Cache & Storage?',
        message: 'This clears all Service Worker caches and temporary offline storage on this device, then refreshes the application.',
        confirmLabel: 'Reset & Reload',
        destructive: false
      });
      if (!confirmed) return;

      try {
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(k => caches.delete(k)));
        }
        localStorage.clear();
        sessionStorage.clear();
        toast('Local cache cleared. Reloading...', 'info');
        setTimeout(() => {
          window.location.reload(true);
        }, 500);
      } catch (err) {
        toast('Failed to clear cache: ' + err.message, 'error');
      }
    };
  }

  // Admin Repair Totals Button
  const btnRepairTotals = document.getElementById('btn-admin-repair-totals');
  if (btnRepairTotals) {
    btnRepairTotals.onclick = handleRepairTotals;
  }

  // Admin Broadcasts Controls (Task 6)
  const btnAdminAddBroadcast = document.getElementById('btn-admin-add-broadcast');
  if (btnAdminAddBroadcast) {
    btnAdminAddBroadcast.onclick = () => openAdminBroadcastModal();
  }

  const btnAdminImportAnnouncements = document.getElementById('btn-admin-import-legacy-announcements');
  if (btnAdminImportAnnouncements) {
    btnAdminImportAnnouncements.onclick = () => importLegacyAnnouncements();
  }

  // Push Notifications Toggle (Task 7)
  const btnTogglePush = document.getElementById('btn-toggle-push');
  if (btnTogglePush) {
    btnTogglePush.onclick = handleTogglePushNotifications;
  }

  // Admin Push Sender Console (Task 7)
  const formAdminSendPush = document.getElementById('form-admin-send-push');
  if (formAdminSendPush) {
    formAdminSendPush.onsubmit = handleAdminSendPush;
  }

  // Universal iOS Member Picker for Push Target
  const pushPickerBtn = document.getElementById('picker-push-target-btn');
  if (pushPickerBtn) {
    pushPickerBtn.onclick = () => {
      const hiddenInput = document.getElementById('select-push-target');
      const cur = hiddenInput?.value || 'all';
      openMemberPicker({
        multi: false,
        includeAllOption: true,
        selectedUids: [cur],
        onConfirm: (selected) => {
          const val = selected[0] || 'all';
          updatePushTargetPickerDisplay(val);
        }
      });
    };
  }

  // Leaderboard Period Switching (All / Month / Week)
  document.querySelectorAll('.leader-period-btn').forEach(btn => {
    btn.onclick = () => {
      state.leaderboardPeriod = btn.dataset.period || 'all';
      state.leaderboardPeriodUserOverridden = true;
      updateLeaderboardPeriodButtons();
      renderLeaderboard();
    };
  });

  // Admin Settings Form
  const settingsForm = document.getElementById('form-admin-settings');
  if (settingsForm) {
    settingsForm.onsubmit = async (e) => {
      e.preventDefault();
      const appName = document.getElementById('input-settings-appname')?.value;
      const logoUrl = document.getElementById('input-settings-logourl')?.value;
      const subEn = document.getElementById('input-settings-sub-en')?.value;
      const devCredit = document.getElementById('input-settings-devcredit')?.value;

      const defaultPeriod = document.getElementById('input-settings-default-leaderboard-period')?.value || 'all';

      try {
        await setDoc(doc(db, 'settings', 'app_config'), {
          appName,
          logoUrl,
          subtitleEn: subEn,
          developerCredit: devCredit,
          defaultLeaderboardPeriod: defaultPeriod
        }, { merge: true });

        await setDoc(doc(db, 'settings', 'general'), {
          defaultLeaderboardPeriod: defaultPeriod
        }, { merge: true });

        toast('Settings updated', 'success');
      } catch (err) {
        toast(err.message || 'Failed to save settings', 'error');
      }
    };
  }

  // Edit Profile Form
  const editProfileBtn = document.getElementById('btn-open-edit-profile');
  if (editProfileBtn) {
    editProfileBtn.onclick = () => {
      if (!state.user) return;
      const modal = document.getElementById('modal-edit-profile');
      const nameInput = document.getElementById('input-edit-profile-name');
      const avatarInput = document.getElementById('input-edit-profile-avatar');
      if (nameInput) nameInput.value = state.user.displayName;
      if (avatarInput) avatarInput.value = state.user.photoURL;
      document.body.style.overflow = 'hidden';
      if (modal) modal.classList.add('open');
    };
  }

  const editProfileForm = document.getElementById('form-edit-profile');
  if (editProfileForm) {
    editProfileForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = document.getElementById('input-edit-profile-name')?.value;
      const newAvatar = document.getElementById('input-edit-profile-avatar')?.value;

      if (!state.user) return;
      try {
        if (auth?.currentUser) {
          await updateProfile(auth.currentUser, {
            displayName: newName,
            photoURL: newAvatar || ''
          }).catch(console.warn);
        }
        // Writes users/{uid} with updatedAt: serverTimestamp() per security rules
        await updateDoc(doc(db, 'users', state.user.uid), {
          name: newName,
          avatarUrl: newAvatar || '',
          updatedAt: serverTimestamp()
        });
        state.user.displayName = newName;
        state.user.name = newName;
        state.user.photoURL = newAvatar || '';
        state.user.avatarUrl = newAvatar || '';
        if (usersMap.has(state.user.uid)) {
          const u = usersMap.get(state.user.uid);
          u.name = newName;
          u.displayName = newName;
          u.avatarUrl = newAvatar || '';
          u.photoURL = newAvatar || '';
        }
        updateProfileUI();
        renderLeaderboard();
        renderAdminMembers();
        updateAdminPushTargets();
        closeAllModals();
        toast('Profile updated', 'success');
      } catch (err) {
        toast(err.message || 'Update failed', 'error');
      }
    };
  }

  // Live Digital Clock in Cairo Time
  startLiveClock();
}

function startLiveClock() {
  const clockEl = document.getElementById('live-clock');
  const dateEl = document.getElementById('live-date');

  const tick = () => {
    const now = new Date(serverNow());
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { timeZone: APP_TIMEZONE, hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString([], { timeZone: APP_TIMEZONE, weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  tick();
  setInterval(tick, 1000);
}

function dismissLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 350);
  }
}

// Automated Zero-Touch Service Worker & Update Architecture (Task 5 / v2.1.2)
if ('serviceWorker' in navigator) {
  let appSwRegistration = null;

  const registerAppServiceWorker = async () => {
    try {
      appSwRegistration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });

      // Trigger reg.update() on initial load
      if (appSwRegistration && typeof appSwRegistration.update === 'function') {
        appSwRegistration.update().catch(() => {});
      }

      // Trigger reg.update() on visibilitychange (when visible)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && appSwRegistration && typeof appSwRegistration.update === 'function') {
          appSwRegistration.update().catch(() => {});
        }
      });

      // Trigger reg.update() periodically every 10 mins
      setInterval(() => {
        if (appSwRegistration && typeof appSwRegistration.update === 'function') {
          appSwRegistration.update().catch(() => {});
        }
      }, 10 * 60 * 1000);

      // When a new service worker is installed, tell it to skipWaiting immediately
      appSwRegistration.addEventListener('updatefound', () => {
        const newWorker = appSwRegistration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('skipWaiting');
            }
          });
        }
      });
    } catch (e) {
      console.warn('ServiceWorker registration handled safely:', e);
    }
  };

  if (document.readyState === 'complete') {
    registerAppServiceWorker();
  } else {
    window.addEventListener('load', registerAppServiceWorker);
  }

  // On controllerchange, guard with sessionStorage and reload page smoothly once
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!sessionStorage.getItem('sw_controller_reloaded')) {
      sessionStorage.setItem('sw_controller_reloaded', 'true');
      window.location.reload();
    }
  });

  // Clear controller reload guard after successful boot
  setTimeout(() => {
    try { sessionStorage.removeItem('sw_controller_reloaded'); } catch (e) {}
  }, 5000);
}

// BOOTSTRAP WORKSPACE
window.addEventListener('DOMContentLoaded', () => {
  initErrorBoundary();
  safeInit('offlineBanner', initOfflineBanner);
  initNavigation();
  safeInit('adminPushConsole', initAdminPushConsole);
  attachEventHandlers();
  // Cold-start cache: immediately attach listeners so local cache renders instantly before auth/network completes
  initFirestoreListeners();
  setupAuthLifecycle();
  safeInit('applySettings', applySettings);
  safeInit('fcm', initFCM);

  setTimeout(() => {
    safeInit('lucide', () => {
      if (window.lucide) window.lucide.createIcons();
    });
  }, 400);
});

// Window compatibility exports
if (typeof window !== 'undefined') {
  window.safeInit = safeInit;
  window.initAdminPushConsole = initAdminPushConsole;
  window.updateAdminPushTargets = updateAdminPushTargets;
  window.updatePushTargetPickerDisplay = updatePushTargetPickerDisplay;
  window.renderTasks = renderTasks;
  window.renderTasksView = renderTasksView;
  window.renderAdminTasks = renderAdminTasks;
  window.renderBroadcastBanner = renderBroadcastBanner;
  window.getActiveBroadcasts = getActiveBroadcasts;
  window.advanceBroadcast = advanceBroadcast;
  window.renderHomeBroadcastBanner = renderHomeBroadcastBanner;
  window.renderSubmissionsInspector = renderSubmissionsInspector;
  window.closeModal = closeModal;
  window.closeAllModals = closeAllModals;
  window.renderMembersAdmin = renderMembersAdmin;
  window.renderAdminMembers = renderAdminMembers;
  window.renderAttendance = renderAttendance;
  window.renderAttendanceView = renderAttendanceView;
  window.renderAttendanceLogs = renderAttendanceLogs;
  window.adminTasksFilter = adminTasksFilter;
  window.adminCatsFilter = adminCatsFilter;
  window.adminCategoriesFilter = adminCategoriesFilter;
  window.adminSessionsFilter = adminSessionsFilter;
  window.adminBroadcastsFilter = adminBroadcastsFilter;
  window.adminSubmissionsFilter = adminSubmissionsFilter;
  window.adminMembersFilter = adminMembersFilter;
  window.statusFilter = statusFilter;
  window.selectedCategory = selectedCategory;
  window.searchQuery = searchQuery;
  window.leaderboardPeriod = leaderboardPeriod;
  window.editingTaskId = editingTaskId;
  window.editingCategoryId = editingCategoryId;
  window.editingSessionId = editingSessionId;
  window.editingBroadcastId = editingBroadcastId;
  window.renderSettingsDrawer = renderSettingsDrawer;
  window.updateDrawerProfile = updateDrawerProfile;
  window.openDrawer = openDrawer;
  window.closeDrawer = closeDrawer;
  window.toggleDrawer = toggleDrawer;
  window.updateDrawerPushUI = updateDrawerPushUI;
  window.updateLiveAppLogo = updateLiveAppLogo;
  window.handleChangeAppLogo = handleChangeAppLogo;
  window.openBadgePickerSheet = openBadgePickerSheet;
}
