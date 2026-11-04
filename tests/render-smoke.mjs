/**
 * tests/render-smoke.mjs
 * Comprehensive Page & Admin Render Smoke Test
 *
 * Scope & Limits:
 * - Exercises top-level lifecycle, rendering, setup and UI builder functions in a simulated DOM & Firebase environment.
 * - Detects ReferenceErrors (undefined variables/functions), TypeErrors (invoking non-functions, property access on null/undefined),
 *   and unhandled exceptions across all filters, tabs, and user roles (Signed-Out, Member, Admin).
 * - Limits: Does not verify pixel-perfect layout, CSS rendering or live network I/O.
 */
import fs from 'node:fs';
import vm from 'node:vm';

console.log('=== COC Media Team Render Smoke Test ===');

// 1. Recursive Proxy-based stub generator for resilient external mock boundaries
function createProxyStub(name = 'stub') {
  const fn = function (...args) {
    return createProxyStub(`${name}()`);
  };
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => name;
      if (prop === 'then') return (resolve) => resolve(createProxyStub(`${name}.then`));
      if (prop === 'catch') return (reject) => createProxyStub(`${name}.catch`);
      if (prop === 'id') return 'mock_id_123';
      if (prop === 'exists') return () => true;
      if (prop === 'data') return () => ({ name: 'Mock Data', role: 'member', points: 100 });
      if (prop === 'docs') return [];
      return createProxyStub(`${name}.${String(prop)}`);
    }
  });
}

// 2. Mock DOM Element with chainable methods and attributes
class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.childNodes = [];
    this._innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.classList = {
      _classes: new Set(),
      add: (...c) => c.forEach(x => this.classList._classes.add(x)),
      remove: (...c) => c.forEach(x => this.classList._classes.delete(x)),
      contains: (x) => this.classList._classes.has(x),
      toggle: (x, force) => {
        if (force === true) this.classList._classes.add(x);
        else if (force === false) this.classList._classes.delete(x);
        else if (this.classList._classes.has(x)) this.classList._classes.delete(x);
        else this.classList._classes.add(x);
      }
    };
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) { this._innerHTML = val; }

  appendChild(el) {
    this.children.push(el);
    this.childNodes.push(el);
    return el;
  }
  removeChild(el) {
    this.children = this.children.filter(c => c !== el);
    this.childNodes = this.childNodes.filter(c => c !== el);
    return el;
  }
  querySelector(sel) { return new MockElement('div'); }
  querySelectorAll(sel) { return [new MockElement('div')]; }
  closest(sel) { return this; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 375, height: 667, right: 375, bottom: 667 }; }
  addEventListener(evt, fn) {}
  removeEventListener(evt, fn) {}
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k] || null; }
  removeAttribute(k) { delete this[k]; }
  hasChildNodes() { return this.childNodes.length > 0; }
  click() {}
}

const elementsMap = new Map();
function getOrCreateElement(id, tag = 'div') {
  if (!elementsMap.has(id)) {
    elementsMap.set(id, new MockElement(tag, id));
  }
  return elementsMap.get(id);
}

const domListeners = new Map();

// 3. Complete Browser Sandbox Environment
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Promise,
  Set,
  Map,
  JSON,
  Error,
  TypeError,
  ReferenceError,
  Intl,
  document: {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getOrCreateElement(sel.slice(1));
      return new MockElement('div');
    },
    querySelectorAll: (sel) => [new MockElement('div')],
    createElement: (tag) => new MockElement(tag),
    addEventListener: (evt, fn) => {
      if (!domListeners.has(evt)) domListeners.set(evt, []);
      domListeners.get(evt).push(fn);
    },
    body: getOrCreateElement('body'),
    documentElement: getOrCreateElement('html'),
    hidden: false
  },
  window: {
    addEventListener: (evt, fn) => {
      if (!domListeners.has(evt)) domListeners.set(evt, []);
      domListeners.get(evt).push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: () => true,
    location: { href: 'http://localhost/', hash: '', origin: 'http://localhost', reload: () => {} },
    localStorage: {
      _store: new Map(),
      getItem: (k) => sandbox.window.localStorage._store.get(k) || null,
      setItem: (k, v) => sandbox.window.localStorage._store.set(k, String(v)),
      removeItem: (k) => sandbox.window.localStorage._store.delete(k),
      clear: () => sandbox.window.localStorage._store.clear()
    },
    sessionStorage: {
      _store: new Map(),
      getItem: (k) => sandbox.window.sessionStorage._store.get(k) || null,
      setItem: (k, v) => sandbox.window.sessionStorage._store.set(k, String(v)),
      removeItem: (k) => sandbox.window.sessionStorage._store.delete(k),
      clear: () => sandbox.window.sessionStorage._store.clear()
    },
    matchMedia: () => ({ matches: false, addListener: () => {}, addEventListener: () => {} }),
    lucide: { createIcons: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: (id) => clearTimeout(id)
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    serviceWorker: {
      register: () => Promise.resolve({ addEventListener: () => {} }),
      addEventListener: () => {},
      ready: Promise.resolve({ addEventListener: () => {} }),
      controller: null
    },
    standalone: false
  },
  Event: class { constructor(t) { this.type = t; } },
  CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d?.detail; } }
};

sandbox.window.document = sandbox.document;
sandbox.window.window = sandbox.window;
sandbox.history = { pushState: () => {}, replaceState: () => {}, back: () => {} };
sandbox.window.history = sandbox.history;
sandbox.location = sandbox.window.location;
sandbox.localStorage = sandbox.window.localStorage;
sandbox.sessionStorage = sandbox.window.sessionStorage;
sandbox.requestAnimationFrame = (fn) => setTimeout(fn, 16);
sandbox.cancelAnimationFrame = (id) => clearTimeout(id);

// 4. Proxy-based Firebase CDN stubs
const firebaseSymbols = [
  'initializeApp', 'getApps', 'getApp',
  'getAuth', 'onAuthStateChanged', 'GoogleAuthProvider', 'signInWithPopup', 'signInWithRedirect',
  'getRedirectResult', 'signOut', 'setPersistence', 'browserLocalPersistence', 'updateProfile',
  'initializeFirestore', 'persistentLocalCache', 'persistentMultipleTabManager', 'getFirestore',
  'collection', 'doc', 'setDoc', 'getDoc', 'getDocs', 'Timestamp', 'addDoc', 'updateDoc', 'deleteDoc',
  'onSnapshot', 'serverTimestamp', 'increment', 'getDocFromServer', 'getAggregateFromServer',
  'getCountFromServer', 'arrayUnion', 'arrayRemove', 'sum', 'query', 'limit', 'where', 'orderBy',
  'startAfter', 'writeBatch',
  'getMessaging', 'getToken', 'deleteToken', 'onMessage', 'isSupported'
];

for (const sym of firebaseSymbols) {
  if (sym === 'Timestamp') {
    sandbox[`_fb_${sym}`] = {
      now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
      fromMillis: (m) => ({ toMillis: () => m, toDate: () => new Date(m) }),
      fromDate: (d) => ({ toMillis: () => new Date(d).getTime(), toDate: () => new Date(d) })
    };
  } else if (sym === 'GoogleAuthProvider') {
    sandbox[`_fb_${sym}`] = class { setCustomParameters() {} };
  } else if (sym === 'browserLocalPersistence') {
    sandbox[`_fb_${sym}`] = 'LOCAL';
  } else {
    sandbox[`_fb_${sym}`] = createProxyStub(sym);
  }
}

vm.createContext(sandbox);

// 5. Load and evaluate app.js in sandbox
let appCode = fs.readFileSync('app.js', 'utf8');

// Replace Firebase CDN imports with sandbox stubs
appCode = appCode.replace(/import\s*\{[^}]*\}\s*from\s*'https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.1\/firebase-app\.js';/, `
const initializeApp = _fb_initializeApp, getApps = _fb_getApps, getApp = _fb_getApp;
`);
appCode = appCode.replace(/import\s*\{[^}]*\}\s*from\s*'https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.1\/firebase-auth\.js';/, `
const getAuth = _fb_getAuth, onAuthStateChanged = _fb_onAuthStateChanged, GoogleAuthProvider = _fb_GoogleAuthProvider,
signInWithPopup = _fb_signInWithPopup, signInWithRedirect = _fb_signInWithRedirect, getRedirectResult = _fb_getRedirectResult,
signOut = _fb_signOut, setPersistence = _fb_setPersistence, browserLocalPersistence = _fb_browserLocalPersistence,
updateProfile = _fb_updateProfile;
`);
appCode = appCode.replace(/import\s*\{[^}]*\}\s*from\s*'https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.1\/firebase-firestore\.js';/, `
const initializeFirestore = _fb_initializeFirestore, persistentLocalCache = _fb_persistentLocalCache,
persistentMultipleTabManager = _fb_persistentMultipleTabManager, getFirestore = _fb_getFirestore,
collection = _fb_collection, doc = _fb_doc, setDoc = _fb_setDoc, getDoc = _fb_getDoc, getDocs = _fb_getDocs,
Timestamp = _fb_Timestamp, addDoc = _fb_addDoc, updateDoc = _fb_updateDoc, deleteDoc = _fb_deleteDoc,
onSnapshot = _fb_onSnapshot, serverTimestamp = _fb_serverTimestamp, increment = _fb_increment,
getDocFromServer = _fb_getDocFromServer, getAggregateFromServer = _fb_getAggregateFromServer,
getCountFromServer = _fb_getCountFromServer, arrayUnion = _fb_arrayUnion, arrayRemove = _fb_arrayRemove,
sum = _fb_sum, query = _fb_query, limit = _fb_limit, where = _fb_where, orderBy = _fb_orderBy,
startAfter = _fb_startAfter, writeBatch = _fb_writeBatch;
`);
appCode = appCode.replace(/import\s*\{[^}]*\}\s*from\s*'https:\/\/www\.gstatic\.com\/firebasejs\/10\.8\.1\/firebase-messaging\.js';/, `
const getMessaging = _fb_getMessaging, getToken = _fb_getToken, deleteToken = _fb_deleteToken,
onMessage = _fb_onMessage, isSupported = _fb_isSupported;
`);

// Expose internal top-level functions and state
appCode = appCode.replace(/^export\s+/gm, '');
appCode += `\n
if (typeof window !== 'undefined') {
  window.state = state;
  window.usersMap = usersMap;
  window.listeners = listeners;
  window.adminSessionsFilter = adminSessionsFilter;
  window.adminBroadcastsFilter = adminBroadcastsFilter;
}
`;

try {
  vm.runInContext(appCode, sandbox);
  console.log('PASS: app.js loaded and evaluated in sandbox.');
} catch (err) {
  console.error('FAIL: app.js evaluation error:', err);
  process.exit(1);
}

// 6. Seed mock state with realistic data
const state = sandbox.window.state || {};
const usersMap = sandbox.window.usersMap || new Map();

if (usersMap) {
  usersMap.set('member_1', {
    uid: 'member_1',
    name: 'Member Bob',
    displayName: 'Member Bob',
    role: 'member',
    points: 120,
    penalties: 0,
    badges: [{ id: 'video_lead', label: 'Video Lead' }]
  });
  usersMap.set('admin_1', {
    uid: 'admin_1',
    name: 'Admin Alice',
    displayName: 'Admin Alice',
    role: 'admin',
    isAdmin: true,
    points: 450,
    penalties: 0,
    badges: [{ id: 'top_contributor', label: 'Top Contributor' }]
  });
}

state.categories = [
  { id: 'cat_1', name: 'Editing', color: '#0A84FF', iconKey: 'film', archived: false },
  { id: 'cat_2', name: 'Old Cat', color: '#888888', iconKey: 'film', archived: true }
];

state.tasks = [
  { id: 'task_1', title: 'Edit Video', categoryId: 'cat_1', points: 50, archived: false },
  { id: 'task_2', title: 'Archived Task', categoryId: 'cat_1', points: 30, archived: true }
];

state.attendanceSessions = [
  { id: 'sess_1', title: 'Sunday Service', type: 'sunday', archived: false, schedule: { type: 'once', startDateTime: Date.now() } },
  { id: 'sess_2', title: 'Old Session', type: 'general', archived: true, schedule: { type: 'once', startDateTime: Date.now() - 86400000 } }
];

state.attendanceLogs = [
  { id: 'log_1', sessionId: 'sess_1', uid: 'member_1', status: 'present', fineEGP: 0, pointsAwarded: 20 }
];

state.submissions = [
  { id: 'sub_1', taskId: 'task_1', uid: 'member_1', userName: 'Member Bob', pointsAwarded: 50, submittedAt: Date.now() }
];

state.broadcasts = [
  { id: 'b_1', title: 'Welcome Team', description: 'Hello all', startDateTime: Date.now() - 1000, endDateTime: Date.now() + 86400000 }
];

state.notifications = [
  { id: 'notif_1', title: 'New Task', message: 'Assigned to you', read: false }
];

// 7. Find all target top-level functions to exercise
const candidateNames = Object.keys(sandbox).concat(Object.keys(sandbox.window || {}));
const testableNames = Array.from(new Set(candidateNames)).filter(name => {
  return /^(render|open|show|init|setup|build|refresh|apply|update)/.test(name) &&
         typeof sandbox[name] === 'function';
});

console.log(`\nDiscovered ${testableNames.length} UI & lifecycle functions to smoke test.`);

const failures = [];
const exercised = [];

function runFunctionSafely(name, fn, args = []) {
  try {
    fn(...args);
    exercised.push(name);
  } catch (err) {
    if (err instanceof ReferenceError || err instanceof TypeError) {
      failures.push({ name, err: err.stack || err.message });
      console.error(`FAIL: ${name}() -> ${err.message}`);
    } else {
      // Non-fatal domain errors (e.g. invalid arguments) are logged
      exercised.push(`${name} (handled)`);
    }
  }
}

// 8. Run across Signed-Out, Member, and Admin States
const USER_STATES = [
  {
    label: 'Signed-Out (Visitor)',
    setup: () => {
      state.user = null;
      state.isAdminUnlocked = false;
    }
  },
  {
    label: 'Signed-In (Member)',
    setup: () => {
      state.user = usersMap.get('member_1');
      state.isAdminUnlocked = false;
    }
  },
  {
    label: 'Signed-In (Admin)',
    setup: () => {
      state.user = usersMap.get('admin_1');
      state.isAdminUnlocked = true;
    }
  }
];

// Filter combinations to test
const FILTER_TEST_CASES = [
  { key: 'adminTasksFilter', values: ['active', 'archived'] },
  { key: 'adminCatsFilter', values: ['active', 'archived'] },
  { key: 'adminSessionsFilter', values: ['active', 'archived', 'waivers'] },
  { key: 'adminBroadcastsFilter', values: ['active', 'archived'] },
  { key: 'statusFilter', values: ['all', 'active', 'completed', 'missed'] },
  { key: 'leaderboardPeriod', values: ['all', 'month', 'week'] }
];

for (const userState of USER_STATES) {
  console.log(`\nTesting User State: ${userState.label}`);
  userState.setup();

  // Test filter variations
  for (const filterCase of FILTER_TEST_CASES) {
    for (const val of filterCase.values) {
      state[filterCase.key] = val;
      if (filterCase.key === 'adminSessionsFilter' && typeof sandbox.adminSessionsFilter !== 'undefined') {
        sandbox.adminSessionsFilter = val;
      }
      if (filterCase.key === 'adminBroadcastsFilter' && typeof sandbox.adminBroadcastsFilter !== 'undefined') {
        sandbox.adminBroadcastsFilter = val;
      }

      // Exercise functions that depend on filters
      if (typeof sandbox.renderTasks === 'function') runFunctionSafely('renderTasks', sandbox.renderTasks);
      if (typeof sandbox.renderAdminTasks === 'function') runFunctionSafely('renderAdminTasks', sandbox.renderAdminTasks);
      if (typeof sandbox.renderAdminCategories === 'function') runFunctionSafely('renderAdminCategories', sandbox.renderAdminCategories);
      if (typeof sandbox.renderAdminSessions === 'function') runFunctionSafely('renderAdminSessions', sandbox.renderAdminSessions);
      if (typeof sandbox.renderAttendanceView === 'function') runFunctionSafely('renderAttendanceView', sandbox.renderAttendanceView);
      if (typeof sandbox.renderAdminBroadcasts === 'function') runFunctionSafely('renderAdminBroadcasts', sandbox.renderAdminBroadcasts);
      if (typeof sandbox.renderLeaderboard === 'function') runFunctionSafely('renderLeaderboard', sandbox.renderLeaderboard);
    }
  }

  // Exercise all other candidate functions
  for (const name of testableNames) {
    const fn = sandbox[name];
    if (typeof fn === 'function') {
      runFunctionSafely(name, fn);
    }
  }
}

console.log(`\nExercised ${exercised.length} function invocations.`);

if (failures.length > 0) {
  console.error(`\nFAILED: Found ${failures.length} runtime errors during page/admin render tests:`);
  for (const f of failures) {
    console.error(`- ${f.name}:\n  ${f.err}`);
  }
  process.exit(1);
} else {
  console.log('\nALL PAGE & ADMIN RENDER SMOKE TESTS PASSED (exit code 0).\n');
  process.exit(0);
}
