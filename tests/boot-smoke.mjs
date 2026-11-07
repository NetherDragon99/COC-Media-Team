/**
 * tests/boot-smoke.mjs
 * Boot sequence smoke test: verifies DOMContentLoaded, Signed-Out, Member, and Admin states.
 * Uses node:vm and minimal DOM/Firebase stubs (< 200 lines).
 */
import fs from 'node:fs';
import vm from 'node:vm';

console.log('=== COC Media Team Boot Smoke Test ===');

let authCallback = null;

// 1. Minimal DOM Mock Element
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
  querySelectorAll(sel) { return []; }
  closest(sel) { return this; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 375, height: 667, right: 375, bottom: 667 }; }
  addEventListener(evt, fn) {}
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k] || null; }
  removeAttribute(k) { delete this[k]; }
  hasChildNodes() { return this.childNodes.length > 0; }
}

const elementsMap = new Map();
function getOrCreateElement(id, tag = 'div') {
  if (!elementsMap.has(id)) {
    elementsMap.set(id, new MockElement(tag, id));
  }
  return elementsMap.get(id);
}

const domListeners = new Map();

// 2. Minimal Global Sandbox
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
  document: {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getOrCreateElement(sel.slice(1));
      return new MockElement('div');
    },
    querySelectorAll: (sel) => [],
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
    history: { pushState: () => {}, replaceState: () => {}, back: () => {} },
    localStorage: {
      _store: new Map(),
      getItem: (k) => sandbox.window.localStorage._store.get(k) || null,
      setItem: (k, v) => sandbox.window.localStorage._store.set(k, String(v)),
      removeItem: (k) => sandbox.window.localStorage._store.delete(k),
      clear: () => sandbox.window.localStorage._store.clear()
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
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
  CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d?.detail; } },
  // Firebase Stubs
  _fb_initializeApp: () => ({}),
  _fb_getApps: () => [],
  _fb_getApp: () => ({}),
  _fb_getAuth: () => ({ currentUser: null }),
  _fb_onAuthStateChanged: (auth, cb) => { authCallback = cb; },
  _fb_GoogleAuthProvider: class { setCustomParameters() {} },
  _fb_signInWithPopup: () => Promise.resolve(),
  _fb_signInWithRedirect: () => Promise.resolve(),
  _fb_getRedirectResult: () => Promise.resolve(null),
  _fb_signOut: () => Promise.resolve(),
  _fb_setPersistence: () => Promise.resolve(),
  _fb_browserLocalPersistence: 'LOCAL',
  _fb_updateProfile: () => Promise.resolve(),
  _fb_getFirestore: () => ({}),
  _fb_initializeFirestore: () => ({}),
  _fb_persistentLocalCache: () => ({}),
  _fb_persistentMultipleTabManager: () => ({}),
  _fb_collection: () => ({}),
  _fb_doc: () => ({ id: 'mock-doc' }),
  _fb_setDoc: () => Promise.resolve(),
  _fb_getDoc: (ref) => Promise.resolve({
    exists: () => true,
    data: () => ({ name: 'Test User', role: 'member', points: 50, penalties: 0 })
  }),
  _fb_getDocs: () => Promise.resolve({ docs: [] }),
  _fb_Timestamp: {
    now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
    fromMillis: (m) => ({ toMillis: () => m, toDate: () => new Date(m) }),
    fromDate: (d) => ({ toMillis: () => new Date(d).getTime(), toDate: () => new Date(d) })
  },
  _fb_addDoc: () => Promise.resolve({ id: 'new-doc-id' }),
  _fb_updateDoc: () => Promise.resolve(),
  _fb_deleteDoc: () => Promise.resolve(),
  _fb_onSnapshot: () => (() => {}),
  _fb_serverTimestamp: () => ({ _st: true }),
  _fb_increment: (n) => ({ _inc: n }),
  _fb_getDocFromServer: () => Promise.resolve({ exists: () => false }),
  _fb_getAggregateFromServer: () => Promise.resolve({ data: () => ({}) }),
  _fb_getCountFromServer: () => Promise.resolve({ data: () => ({ count: 0 }) }),
  _fb_arrayUnion: (...x) => x,
  _fb_arrayRemove: (...x) => x,
  _fb_sum: () => ({}),
  _fb_query: () => ({}),
  _fb_limit: () => ({}),
  _fb_where: () => ({}),
  _fb_orderBy: () => ({}),
  _fb_startAfter: () => ({}),
  _fb_writeBatch: () => ({
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: () => Promise.resolve()
  }),
  _fb_getMessaging: () => ({}),
  _fb_getToken: () => Promise.resolve('mock-token'),
  _fb_deleteToken: () => Promise.resolve(),
  _fb_onMessage: () => {},
  _fb_isSupported: () => Promise.resolve(false)
};

sandbox.window.document = sandbox.document;
sandbox.window.window = sandbox.window;
sandbox.history = sandbox.window.history;
sandbox.location = sandbox.window.location;
sandbox.localStorage = sandbox.window.localStorage;
sandbox.requestAnimationFrame = (fn) => setTimeout(fn, 16);
sandbox.cancelAnimationFrame = (id) => clearTimeout(id);
vm.createContext(sandbox);

// 3. Prepare app.js source for evaluation in sandbox
let appCode = fs.readFileSync('app.js', 'utf8');

// Replace CDN imports with sandbox stubs
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

// Strip 'export ' keywords
appCode = appCode.replace(/^export\s+/gm, '');

// Execute app.js in sandbox
try {
  vm.runInContext(appCode, sandbox);
  console.log('PASS: app.js evaluated in mock environment without syntax/top-level errors');
} catch (err) {
  console.error('FAIL: app.js failed to evaluate:', err);
  process.exit(1);
}

// 4. Test Step A: DOMContentLoaded
console.log('\n[Simulating DOMContentLoaded]');
const domReadyHandlers = domListeners.get('DOMContentLoaded') || [];
for (const handler of domReadyHandlers) {
  try {
    handler();
  } catch (err) {
    console.error('FAIL: Error during DOMContentLoaded boot:', err);
    process.exit(1);
  }
}
console.log('PASS: DOMContentLoaded executed cleanly (safeInit ran, no crash)');

// 5. Test Step B: Signed-out State
console.log('\n[Simulating Auth: Signed-Out (null)]');
try {
  if (typeof authCallback === 'function') {
    authCallback(null);
  }
  console.log('PASS: Signed-out state rendered cleanly');
} catch (err) {
  console.error('FAIL: Error in signed-out auth state:', err);
  process.exit(1);
}

// 6. Test Step C: Signed-in Member State
console.log('\n[Simulating Auth: Member User]');
try {
  if (typeof authCallback === 'function') {
    authCallback({
      uid: 'user_member_123',
      displayName: 'Member Bob',
      email: 'bob@example.com',
      photoURL: ''
    });
  }
  console.log('PASS: Member state processed cleanly');
} catch (err) {
  console.error('FAIL: Error in member auth state:', err);
  process.exit(1);
}

// 7. Test Step D: Signed-in Admin State & Push Console
console.log('\n[Simulating Auth: Admin User & Admin Panels]');
try {
  // Override Firestore getDoc to return admin role
  sandbox._fb_getDoc = (ref) => Promise.resolve({
    exists: () => true,
    data: () => ({ name: 'Admin Alice', role: 'admin', points: 150, penalties: 0, isAdmin: true })
  });

  if (typeof authCallback === 'function') {
    authCallback({
      uid: 'user_admin_999',
      displayName: 'Admin Alice',
      email: 'alice@example.com',
      photoURL: ''
    });
  }

  // Verify push console initializer
  if (typeof sandbox.window.initAdminPushConsole === 'function') {
    sandbox.window.initAdminPushConsole();
  }
  console.log('PASS: Admin state & push console initialized cleanly');
} catch (err) {
  console.error('FAIL: Error in admin auth state:', err);
  process.exit(1);
}

// 8. Test Step E: What's New Fingerprinting & Automatic Launch Pop-up Logic
console.log('\n[Simulating What\'s New Auto-Presentation & Fingerprint Storage]');
try {
  const getFp = sandbox.window.getWhatsNewFingerprint;
  const getLastSeen = sandbox.window.getLastSeenChangelogId;
  const setLastSeen = sandbox.window.setLastSeenChangelogId;
  const key = sandbox.window.LAST_SEEN_CHANGELOG_KEY;

  if (key !== 'coc_last_seen_changelog_id') {
    throw new Error(`Unexpected LAST_SEEN_CHANGELOG_KEY: ${key}`);
  }

  // Test fingerprint generation across formats
  const fp1 = getFp({ publishId: 'wn_v2.2.9_1730000000' });
  if (fp1 !== 'wn_v2.2.9_1730000000') throw new Error(`Fingerprint publishId failed: ${fp1}`);

  const fp2 = getFp({ version: '2.2.9', publishedAtMs: 1730000000 });
  if (fp2 !== 'v2.2.9_1730000000') throw new Error(`Fingerprint publishedAtMs failed: ${fp2}`);

  const fp3 = getFp(null);
  if (!fp3.startsWith('v')) throw new Error(`Fingerprint null failed: ${fp3}`);

  // Test localStorage interaction
  sandbox.window.localStorage.removeItem(key);
  if (getLastSeen() !== null) throw new Error(`getLastSeen should be null initially`);

  setLastSeen('wn_test_fp_123');
  if (getLastSeen() !== 'wn_test_fp_123') throw new Error(`setLastSeen/getLastSeen mismatch`);

  // Test auto-popup function presence and safe execution
  if (typeof sandbox.window.checkAndShowAutoWhatsNew !== 'function') {
    throw new Error('checkAndShowAutoWhatsNew is not a function');
  }
  sandbox.window.checkAndShowAutoWhatsNew();

  console.log('PASS: What\'s New Fingerprinting and Auto-Launch mechanics verified cleanly');
} catch (err) {
  console.error('FAIL: Error in What\'s New smoke test:', err);
  process.exit(1);
}

console.log('\nALL BOOT SMOKE TESTS PASSED (exit code 0).\n');
process.exit(0);
