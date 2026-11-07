import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

console.log('=== Universal Swipe Unit & Integration Test ===');

class MockClassList {
  constructor() { this._classes = new Set(); }
  add(...cls) { cls.forEach(c => this._classes.add(c)); }
  remove(...cls) { cls.forEach(c => this._classes.delete(c)); }
  contains(c) { return this._classes.has(c); }
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.classList = new MockClassList();
    this.children = [];
    this.childNodes = [];
    this.parentNode = null;
    this.parentElement = null;
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this._rect = { left: 100, top: 50, width: 300, height: 60, right: 400, bottom: 110 };
    this._innerHTML = '';
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    // Simple parser for icon container mock
    if (val.includes('universal-swipe-icon-container')) {
      const iconWrap = new MockElement('div');
      iconWrap.className = 'universal-swipe-icon-container flex items-center gap-2';
      this.appendChild(iconWrap);
    }
  }

  get className() { return Array.from(this.classList._classes).join(' '); }
  set className(val) {
    this.classList._classes.clear();
    (val || '').split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }

  getBoundingClientRect() { return this._rect; }
  setAttribute(k, v) { this[k] = String(v); }
  getAttribute(k) { return this[k] || null; }

  appendChild(el) {
    this.children.push(el);
    this.childNodes.push(el);
    el.parentNode = this;
    el.parentElement = this;
    return el;
  }

  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    newChild.parentElement = this;
    const idx = refChild ? this.children.indexOf(refChild) : -1;
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
      this.childNodes.push(newChild);
    }
    return newChild;
  }

  removeChild(el) {
    this.children = this.children.filter(c => c !== el);
    this.childNodes = this.childNodes.filter(c => c !== el);
    if (el) { el.parentNode = null; el.parentElement = null; }
    return el;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      for (const ch of this.children) {
        if (ch.classList.contains(cls)) return ch;
        const sub = ch.querySelector(sel);
        if (sub) return sub;
      }
    }
    return null;
  }

  querySelectorAll(sel) { return []; }
  closest(sel) { return null; }

  addEventListener(type, fn) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(f => f !== fn);
    }
  }

  dispatchEvent(evt) {
    if (this.listeners[evt.type]) {
      this.listeners[evt.type].forEach(fn => fn(evt));
    }
  }
}

function createProxyStub(name = 'stub') {
  const fn = function () { return createProxyStub(`${name}()`); };
  return new Proxy(fn, {
    get(t, p) { return createProxyStub(`${name}.${String(p)}`); }
  });
}

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
  Set,
  Map,
  JSON,
  document: {
    createElement: (tag) => new MockElement(tag),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new MockElement('body')
  },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  navigator: {},
  location: { hash: '' },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id)
};

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
  sandbox[`_fb_${sym}`] = createProxyStub(sym);
}

vm.createContext(sandbox);

let appCode = fs.readFileSync('app.js', 'utf8');
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
appCode = appCode.replace(/^export\s+/gm, '');
appCode += `\nif (typeof window !== 'undefined') { window.attachUniversalSwipeActions = attachUniversalSwipeActions; }\n`;

vm.runInContext(appCode, sandbox);

const attachUniversalSwipeActions = sandbox.attachUniversalSwipeActions;
assert.ok(typeof attachUniversalSwipeActions === 'function', 'attachUniversalSwipeActions must be a function');

// ==========================================
// TEST 1: Middle 60% Hit Zone Ignored
// ==========================================
console.log('--- TEST 1: Middle 60% touch ignored ---');
const wrapper1 = new MockElement('div');
const card1 = new MockElement('div');
card1.classList.add('notification-card');
card1._rect = { left: 100, top: 50, width: 300, height: 60, right: 400, bottom: 110 };
wrapper1.appendChild(card1);

let archived1 = false;
let deleted1 = false;
attachUniversalSwipeActions(wrapper1, {
  onArchive: () => { archived1 = true; },
  onDelete: () => { deleted1 = true; }
});

// Card rect: left: 100, width: 300. Edge threshold: 300 * 0.20 = 60px.
// Middle 60%: clientX between 161 and 339 (relative X 61 to 239).
// Test touch in exact middle (clientX = 250, relX = 150 = 50%)
let stopped = false;
let prevented = false;

wrapper1.dispatchEvent({
  type: 'touchstart',
  touches: [{ clientX: 250, clientY: 75 }],
  stopPropagation: () => { stopped = true; },
  preventDefault: () => { prevented = true; }
});

assert.strictEqual(stopped, false, 'Middle 60% touch MUST NOT call stopPropagation');
assert.strictEqual(prevented, false, 'Middle 60% touch MUST NOT call preventDefault');

// Move in middle
wrapper1.dispatchEvent({
  type: 'touchmove',
  touches: [{ clientX: 200, clientY: 75 }],
  stopPropagation: () => { stopped = true; },
  preventDefault: () => { prevented = true; },
  cancelable: true
});

assert.strictEqual(card1.style.transform || '', '', 'Middle 60% touch MUST NOT drag the card');
assert.strictEqual(stopped, false, 'Middle 60% move MUST NOT call stopPropagation');
console.log('PASS: Middle 60% touch is completely ignored and bubbles freely.');

// ==========================================
// TEST 2: Left 20% Hit Zone (Archive)
// ==========================================
console.log('\n--- TEST 2: Left 20% hit zone (Archive) & Progressive Interpolation ---');
stopped = false;
// clientX = 120 (relX = 20 <= 60px = 6.6% of card)
wrapper1.dispatchEvent({
  type: 'touchstart',
  touches: [{ clientX: 120, clientY: 75 }],
  stopPropagation: () => { stopped = true; },
  preventDefault: () => { prevented = true; }
});

assert.strictEqual(stopped, true, 'Left 20% edge touch MUST call stopPropagation');

// Drag right by +50px (dx = +50px, LTR Archive progress)
prevented = false;
wrapper1.dispatchEvent({
  type: 'touchmove',
  touches: [{ clientX: 170, clientY: 75 }],
  stopPropagation: () => {},
  preventDefault: () => { prevented = true; },
  cancelable: true
});

assert.strictEqual(prevented, true, 'Card swiping MUST preventDefault on move');
assert.ok(card1.style.transform.includes('translateX(50px)'), 'Card translates with finger drag');

const bgArchive = wrapper1.querySelector('.universal-swipe-bg-archive');
assert.ok(bgArchive, 'bgArchive exists');
assert.strictEqual(bgArchive.style.display, 'flex', 'bgArchive displayed on positive drag');
assert.ok(bgArchive.style.backgroundColor.includes('rgba('), 'bgArchive background interpolated dynamically');

const archiveIcon = bgArchive.querySelector('.universal-swipe-icon-container');
assert.ok(archiveIcon, 'archiveIcon exists');
assert.ok(archiveIcon.style.transform.includes('scale('), 'Icon container scale updated with drag percentage');
assert.ok(Number(archiveIcon.style.opacity) > 0, 'Icon container opacity faded in with drag percentage');
console.log('Archive drag color:', bgArchive.style.backgroundColor);
console.log('Archive icon scale:', archiveIcon.style.transform, 'opacity:', archiveIcon.style.opacity);
console.log('PASS: Left 20% drag progressively interpolates vivid Amber and Archive icon.');

// ==========================================
// TEST 3: Snapback when released before threshold
// ==========================================
console.log('\n--- TEST 3: Snapback when released before threshold ---');
wrapper1.dispatchEvent({
  type: 'touchend',
  changedTouches: [{ clientX: 140, clientY: 75 }] // dx = +20px, well below threshold
});

assert.strictEqual(card1.style.transform, '', 'Card snaps back when released before threshold');
assert.strictEqual(bgArchive.style.backgroundColor, 'transparent', 'Background color animates back to transparent');
assert.strictEqual(archiveIcon.style.opacity, '0', 'Icon opacity animates back to 0');
assert.strictEqual(archiveIcon.style.transform, 'scale(0.5)', 'Icon scale animates back to 0.5');
console.log('PASS: Released before threshold snaps back and animates color/icon back to 0.');

// ==========================================
// TEST 4: Right 20% Hit Zone (Delete) & Progressive Interpolation
// ==========================================
console.log('\n--- TEST 4: Right 20% hit zone (Delete) & Progressive Interpolation ---');
const wrapper3 = new MockElement('div');
const card3 = new MockElement('div');
card3.classList.add('bulk-card-content');
card3._rect = { left: 100, top: 50, width: 300, height: 60, right: 400, bottom: 110 };
wrapper3.appendChild(card3);
attachUniversalSwipeActions(wrapper3, {
  onArchive: () => {},
  onDelete: () => {}
});

// clientX = 380 (relX = 280 >= 240 = 93.3%)
stopped = false;
wrapper3.dispatchEvent({
  type: 'touchstart',
  touches: [{ clientX: 380, clientY: 75 }],
  stopPropagation: () => { stopped = true; },
  preventDefault: () => {}
});

assert.strictEqual(stopped, true, 'Right 20% edge touch MUST call stopPropagation');

// Move left (dx = -70, Delete progress)
wrapper3.dispatchEvent({
  type: 'touchmove',
  touches: [{ clientX: 310, clientY: 75 }],
  stopPropagation: () => {},
  preventDefault: () => {},
  cancelable: true
});

assert.ok(card3.style.transform.includes('translateX(-70px)'), 'Card translates negatively with finger drag');

const bgDelete = wrapper3.querySelector('.universal-swipe-bg-delete');
assert.ok(bgDelete, 'bgDelete exists');
assert.strictEqual(bgDelete.style.display, 'flex', 'bgDelete displayed on negative drag');
assert.ok(bgDelete.style.backgroundColor.includes('rgba('), 'bgDelete background interpolated dynamically');

const deleteIcon = bgDelete.querySelector('.universal-swipe-icon-container');
assert.ok(deleteIcon, 'deleteIcon exists');
assert.ok(deleteIcon.style.transform.includes('scale('), 'Delete icon scale updated with drag percentage');
assert.ok(Number(deleteIcon.style.opacity) > 0, 'Delete icon opacity faded in with drag percentage');
console.log('Delete drag color:', bgDelete.style.backgroundColor);
console.log('Delete icon scale:', deleteIcon.style.transform, 'opacity:', deleteIcon.style.opacity);
console.log('PASS: Right 20% drag progressively interpolates Crimson Red and Trash Bin icon.');

// ==========================================
// TEST 5: Full solid color fill on release past threshold
// ==========================================
console.log('\n--- TEST 5: Full solid color fill on release past threshold ---');
// Drag past threshold (threshold = 300 * 0.35 = 105px; let dx = -140px)
wrapper3.dispatchEvent({
  type: 'touchmove',
  touches: [{ clientX: 240, clientY: 75 }],
  stopPropagation: () => {},
  preventDefault: () => {},
  cancelable: true
});

wrapper3.dispatchEvent({
  type: 'touchend',
  changedTouches: [{ clientX: 240, clientY: 75 }]
});

assert.strictEqual(bgDelete.style.backgroundColor, '#DC2626', 'Background color fills solid Crimson Red on threshold release');
assert.strictEqual(deleteIcon.style.opacity, '1', 'Icon opacity fills completely to 1');
assert.strictEqual(deleteIcon.style.transform, 'scale(1)', 'Icon scale reaches 1');
console.log('PASS: Released past threshold fills completely with solid Crimson Red.');

console.log('\n=============================================');
console.log('ALL 5 TEST SUITES PASSED FLAWLESSLY (100%)!');
console.log('=============================================');
process.exit(0);
