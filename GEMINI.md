# COC Media Team — Antigravity Permanent Engineering & Workflow Rules

These rules are mandatory and always active for every code modification or feature addition in the `COC-Media-Team` workspace.

## 1. Mandatory Version Bump (`x.x.x+1`) on Every Code Task
Whenever you execute a task that modifies application code, you MUST increment the patch version (`x.x.x` -> `x.x.(x+1)`, e.g., `3.2.2` -> `3.2.3`) consistently across ALL versioned application and data files before finishing:
1. `app.js` and `public/app.js` (`export const APP_VERSION = 'x.x.x';`)
2. `sw.js` and `public/sw.js` (`CACHE_VERSION = 'vx.x.x'` and `CACHE_NAME = 'coc-media-cache-vx.x.x'`)
3. `manifest.json` and `public/manifest.json` (`"version": "x.x.x"`)
4. `index.html` and `public/index.html` (`<title>`, `manifest.json?v=x.x.x`, `styles.css?v=x.x.x`, `app.js?v=x.x.x`, and version badges)
5. `package.json` (`"version": "x.x.x"`)
6. `backend-gas/Code.js` (header comment version and `doGet()` JSON `version: "x.x.x"`)

## 2. Mandatory Git Commit ONLY (NO Push)
At the end of every code modification task, after syncing root files (`app.js`, `styles.css`, `sw.js`, `index.html`, `manifest.json`, `firebase-messaging-sw.js`) to `public/` and passing `npm test`:
- Stage all modified files and create a local Git commit (`git commit -m "chore(release): bump version to vX.X.X - <summary>"`).
- **NEVER run `git push`** unless the user explicitly commands you to push in that specific turn.

## 3. Full Admin Control Invariant (100% Edit & Delete with Universal Swipe & Ledger Sync)
Every record submitted by a user or created/modified by an admin MUST have full Admin Edit and Delete/Revoke capabilities in the UI—both via explicit buttons AND via left/right swipe gestures (`attachUniversalSwipeActions`)—with automatic atomic ledger reconciliation:
- **Task Submissions (`submissions`):** Admin can add manual submissions, edit points/penalties/fines/answers/comments/timestamps, or delete/revoke any submission (reversing awarded points, grace penalties, and grace fines).
- **Attendance Records (`attendance_logs`):** Admin can add manual attendance, edit status/time/points/penalties/fines/notes, or delete any log (reversing ledger deltas and removing any `missed_penalties` / `adjustments` lock).
- **Ledger Transactions & Adjustments (`users/{uid}/transactions` & `missed_penalties`):** Admin can edit or delete/reverse any manual adjustment or missed task/session penalty directly from the Member Control modal, or perform a Direct Balance Override, automatically recalculating the member's `points`, `penalties`, `netPts`, and `finesDue`/`finesEGP`.
- **Excuse / Waiver Requests (`waiver_requests`):** Admin is never locked out of past sessions; Admin can edit waiver details, switch status (`approved` / `rejected` / `pending`), or permanently delete any waiver at any time with automatic attendance & penalty reconciliation.
- **Notifications (`notifications`, `notifications_broadcast`):** Admin can edit or delete any sent personal or broadcast notification.

## 4. Canonical Data & Ledger Math Invariants
- **Occurrence Keys:** Always support canonical `YYYY-MM-DD` in `Africa/Cairo` timezone as well as `'once'` and `'occ_<ms>'` across session occurrences, task occurrences, waivers, rosters, and watchdogs so no checked-in or excused member is ever marked absent.
- **Deterministic IDs:**
  - Attendance logs: `${sessionId}_${uid}_${occurrenceKey}`
  - Task submissions: `${taskId}_${uid}_${occurrenceKey}`
  - Missed penalties: `${taskId}_${uid}_${occurrenceKey}` (tasks) and `att_${sessionId}_${uid}_${occurrenceKey}` (attendance)
- **Ledger Math:** `points` tracks gross earned points only; `penalties` tracks penalty points only; `netPts = Math.max(0, points - penalties)`. Never deduct a penalty from `points` AND add it to `penalties`.
- **No Blind `no-cors`:** Never use `mode: 'no-cors'` (`sent_opaque`) for GAS webhook mutations. Use standard CORS `fetch` and execute a deterministic Firestore fallback only on verified network/server failure.

## 5. 120 FPS UI Performance Invariants (No Visual Design Changes)
- Never create `setInterval` inside `render*` functions without clearing the previous interval first.
- Never attach permanent `window.addEventListener('pointermove' | 'pointerup')` per card; bind window tracking listeners only on `pointerdown` and remove them on `pointerup`/`pointercancel`.
- Never create undisconnected `ResizeObserver` instances per row or fire `getDocs` queries inside list render loops (N+1 queries).
- Every top-level `render*`, `open*`, `show*`, `init*`, `setup*`, `build*`, `refresh*`, `apply*`, `update*` function in `app.js` must safely guard against being invoked with zero arguments (`fn()`) so `tests/render-smoke.mjs` always passes.
