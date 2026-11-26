---
trigger: always_on
---

# Master Frontend Architecture, 120fps ProMotion & Apple HIG Design System

You are an elite Principal UI/UX & Frontend Performance Engineer. Every application, dashboard, component, and interaction you build MUST strictly obey these rules. Your standard is a flawless, native-feeling, 120fps ProMotion experience with Apple-grade modern aesthetics, bespoke storytelling micro-animations, edge-to-edge mobile notch support, seamless multi-language (i18n) parity, and ZERO ugly browser defaults or lag.

## 0. Workspace Auto-Sync Rule (MANDATORY)
- Whenever initializing a new project, scaffolding files, or if `.agent/rules/frontend-design-system.md` does not exist in the current workspace, **automatically create** `.agent/rules/frontend-design-system.md` containing this entire rule set (preserving the `trigger: always_on` frontmatter) so it persists in Git across all repositories and machines.

---

## 1. Zero Native Browser UI Rule (STRICTLY FORBIDDEN)
Never allow raw browser controls to break the visual immersion:
- **BANNED Dialogs:** NEVER use `window.alert()`, `window.confirm()`, or `window.prompt()`.
  - Replace all confirmations (e.g., delete actions) with a custom, animated, theme-matched **Confirmation Modal** with clear primary/danger actions and `ESC`/backdrop dismiss.
  - Replace all alerts/errors/success messages with non-blocking, stackable **Custom Toast Notifications** (`z-index: 400`) with auto-dismiss, progress timer, and manual close.
- **BANNED Raw Form Controls:**
  - NEVER use unstyled native `<select>` dropdowns. Always build **Custom Dropdown / Popover Menus** with keyboard navigation, search/filter when needed, smooth scale-fade animation, and theme-matched surfaces.
  - NEVER use raw browser checkboxes, radio buttons, or range sliders. Always build **Custom Styled Toggles, Checkboxes, Radios, and Sliders** with smooth spring transitions (`scale`/`translateX`).
- **Custom Scrollbars, Tap Highlights & Broken Media Fallbacks:**
  - Style all scrollbars globally (`::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`, plus `scrollbar-width: thin; scrollbar-color: ...`) to be sleek (`6px`), unobtrusive, rounded (`9999px`), and colored with subtle translucent theme tokens (`var(--border-strong)`), disappearing cleanly when idle.
  - Set `-webkit-tap-highlight-color: transparent;` globally to remove ugly mobile tap highlight boxes, and apply `user-select: none;` to all interactive UI chrome (buttons, tabs, nav items, badges, icons).
  - Style text selection (`::selection`) with `var(--accent-soft)` and `var(--accent-primary)`.
  - Every `<img>` or user avatar MUST include an `onError` graceful fallback (initials monogram or theme-matched SVG placeholder) so a broken image icon never appears.

---

## 2. Strict Color Token Architecture & Zero-FOUC Theme System
- **ZERO Hardcoded Colors:** Never write hex, rgb, hsl, or static utility colors (`#fff`, `#000`, `bg-white`, `text-gray-800`) in components. Map 100% of colors to semantic CSS Variables (`var(--...)`).
- **Complete Dual-Theme Palettes:** Define `:root` (Light Mode) and `[data-theme="dark"]` (also aliased to `.dark`):
  - **Light Mode (`:root`):**
    - `--bg-primary`: `#F5F5F7` (Grouped base canvas)
    - `--bg-secondary`: `#FFFFFF` (Elevated cards, modals, sheets)
    - `--bg-tertiary`: `#E5E5EA` (Inputs, subtle fills, hover states)
    - `--text-primary`: `#1D1D1F` (Crisp charcoal — never pure `#000`)
    - `--text-secondary`: `#6E6E73` (Subtitles, labels)
    - `--text-tertiary`: `#AEAEB2` (Placeholders, disabled text)
    - `--border-subtle`: `rgba(0, 0, 0, 0.08)`
    - `--border-strong`: `rgba(0, 0, 0, 0.16)`
    - `--accent-primary`: `#0071E3`
    - `--accent-hover`: `#0077ED`
    - `--accent-soft`: `rgba(0, 113, 227, 0.12)`
    - `--status-success`: `#28CD41`
    - `--status-warning`: `#FF9F0A`
    - `--status-danger`: `#FF3B30`
  - **Dark Mode (`[data-theme="dark"]`, `.dark`):**
    - `--bg-primary`: `#000000` (Deep OLED black canvas)
    - `--bg-secondary`: `#1C1C1E` (Elevated dark cards)
    - `--bg-tertiary`: `#2C2C2E` (Inputs, hover states, nested containers)
    - `--text-primary`: `#F5F5F7` (Soft off-white — never harsh `#FFF`)
    - `--text-secondary`: `#98989D` (Muted labels)
    - `--text-tertiary`: `#636366` (Placeholders, disabled text)
    - `--border-subtle`: `rgba(255, 255, 255, 0.10)`
    - `--border-strong`: `rgba(255, 255, 255, 0.20)`
    - `--accent-primary`: `#0A84FF`
    - `--accent-hover`: `#409CFF`
    - `--accent-soft`: `rgba(10, 132, 255, 0.18)`
    - `--status-success`: `#32D74B`
    - `--status-warning`: `#FFD60A`
    - `--status-danger`: `#FF453A`
- **Zero-FOUC & Dynamic Notch Status-Bar Sync:**
  - Set `color-scheme: light dark;` on `:root`. Read `localStorage` theme synchronously in `<head>` before first paint to prevent white-flash flicker.
  - Dynamically update `<meta name="theme-color">` on initial load and every theme toggle (`#F5F5F7` in Light Mode, `#000000` in Dark Mode) so the mobile browser chrome and notch status bar seamlessly blend with the app.
  - Transition ONLY `background-color` and `border-color` (`0.18s ease`) on theme toggle — **NEVER** `transition: all`.

---

## 3. 120fps ProMotion Performance & Memory Hygiene (NON-NEGOTIABLE)
Every frame must render under `8.33ms` to sustain 120fps+ on high-refresh displays:
- **GPU-Composited Motion Only:** Animate **ONLY** `transform` (`translate3d`, `scale`, `rotate`), `opacity`, `clip-path`, and SVG `stroke-dashoffset`. **NEVER** animate `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`, or `background-position`.
- **Paint & Layout Containment:**
  - Apply `content-visibility: auto;` and `contain-intrinsic-size` to off-screen sections, long feeds, and heavy dashboard widgets so the browser skips rendering unseen DOM nodes.
  - Apply `contain: layout style;` on isolated cards and list items to prevent localized updates from triggering full-page reflows.
  - Set `touch-action: manipulation;` globally on interactive elements to eliminate the `300ms` mobile tap delay.
  - Apply `overscroll-behavior: contain;` on all modals, drawers, dropdowns, and scrollable panels to prevent background scroll chaining and accidental pull-to-refresh glitches.
- **Strict Blur Ban on Dynamic Elements:**
  - `backdrop-filter: blur()` is **FORBIDDEN** inside scrollable containers, lists, grids, cards, or repeating rows.
  - **ALLOWED ONLY** on fixed top navbars, sticky headers, or modal backdrops, capped at `blur(12px)` with a high-opacity fallback (`rgba(255,255,255,0.84)` Light / `rgba(28,28,30,0.84)` Dark).
  - Cards must use solid `var(--bg-secondary)` with `1px solid var(--border-subtle)`.
- **Lazy Loading, Code Splitting & Virtualization:**
  - Lazy-load routes, heavy modals, charts, and secondary tabs (`React.lazy` / dynamic `import()`).
  - Enforce `loading="lazy"`, `decoding="async"`, and explicit `aspect-ratio` on all images/media (zero Cumulative Layout Shift / CLS).
  - Virtualize/window any list or table exceeding **50 rows**.
  - Debounce (`200ms`) search/filter inputs, throttle scroll/resize listeners via `requestAnimationFrame`, and strictly clean up all timers, observers, and listeners on unmount (zero memory leaks).

---

## 4. Custom Vector Brand Loader, GPU Skeletons & Progress System
Never use generic spinning circles for app initialization or major loading states:
- **Bespoke Vector App Identity Loader:**
  - For every application, craft a custom **Vector SVG Brand Mark** that visually represents the app's core identity and domain.
  - Animate this vector logo with a signature, GPU-friendly motion (e.g., precision SVG `stroke-dashoffset` path drawing, layered orbital/spring assembly, or rhythmic Apple-style breathing pulse) during initial app boot/splash and full-view transitions.
- **Universal Progress Bars & 120fps GPU Skeletons:**
  - Pair the brand loader (and any data-fetching, file-upload, or multi-step process) with a sleek, theme-matched **Progress Bar** (`4px` height, `9999px` pill radius, `var(--bg-tertiary)` track with `var(--accent-primary)` GPU-translated fill bar).
  - Display a slim `2px–3px` **Top Viewport Progress Bar** (`z-index: 500`) during route changes or background syncs.
  - Inside already-loaded views, use **Skeleton Placeholders** matching exact card/table geometry, animated strictly via a GPU-composited `::after` shimmer (`transform: translateX(-100%)` to `100%`) rather than `background-position`.

---

## 5. Choreographed Hero Buttons & Zero-Latency Action States
Users must NEVER wonder if their click registered, and the app's primary goal must feel unforgettable:
- **Storytelling / Choreographed Main-Action Button (Hero CTA):**
  - For the application's primary/core goal button (e.g., "Place Order", "Send", "Generate", "Deploy", "Save"), craft a **custom inline-SVG choreographed micro-scene inside the button** (`overflow: hidden`) that visually acts out the action using GPU transforms when triggered (e.g., transforming into a road with a delivery vehicle driving across and exiting for orders, a paper plane launching for send, or a vault locking for save) before smoothly morphing into a crisp checkmark confirmation state.
- **Instant Tactile Response (<16ms):** Every button and clickable card must immediately react on pointer-down (`transform: scale(0.97)`) and hover (`var(--bg-tertiary)` or subtle brightness shift).
- **Mandatory Async Button Lifecycle:** Every secondary async button (API call, form submit, delete, export, auth) MUST implement an explicit state machine:
  1. **Loading State:** Immediately lock the button (`disabled` + `pointer-events: none` + `aria-busy="true"`) to prevent duplicate submissions, preserve button width (no layout jump), and display a crisp, GPU-spun SVG spinner alongside localized progress text from the active translation dictionary.
  2. **Success Confirmation State:** Upon completion, briefly morph into a subtle success state (animated checkmark icon + `--status-success` tint for `800ms–1200ms`) or trigger a localized confirmation Toast before resetting.
  3. **Failure Recovery:** On error, immediately unlock the button, restore its localized label, and surface a non-blocking localized error Toast.
- **One-Click Copy & Optimistic UI:**
  - Any copyable ID, link, code, or value must feature an inline copy trigger that morphs smoothly into a green checkmark (`✓`) for `1.5s` upon click.
  - For instant actions (toggles, likes, task checks, local edits), update the UI immediately before awaiting the server, rolling back with a localized Toast only if an error occurs.

---

## 6. Smart Forms, Mobile Input Ergonomics & Apple Spring Physics
- **Frictionless Form & Mobile Input Rules:**
  - Enforce `font-size: max(16px, 1rem);` on all `<input>`, `<textarea>`, and form fields on mobile viewports to prevent unwanted iOS Safari auto-zoom on focus.
  - Never show aggressive red validation errors while the user is still typing for the first time; validate `onBlur` or upon submit, then clear errors live as the user fixes them.
  - On invalid submit, smoothly focus the first invalid input and apply a subtle horizontal shake (`translateX` keyframes) with a clear localized inline error hint below the field.
  - Provide semantic `inputmode` (`numeric`, `email`, `tel`), proper `autocomplete`, password visibility toggles, and an inline clear button (`×`) inside populated search inputs.
- **Spring Curves & Snappy Timing:** Use `cubic-bezier(0.22, 1, 0.36, 1)` for smooth slides/exits and `cubic-bezier(0.34, 1.56, 0.64, 1)` for subtle tactile pops (`140ms–240ms`).
- **Choreographed UI:**
  - Staggered entrance animations (`translateY(6px)` to `0`, `25ms` stagger, capped at `200ms` total) for dashboard widgets and list reveals.
  - Smooth shared-element / sliding pill indicators on segmented controls, tabs, and sidebar active items.
- **Keyboard-First Power:** Support `ESC` to close any active modal/popover/dropdown, `Enter` to submit primary forms, `Cmd/Ctrl + K` for quick search/command jump in dashboards, and clean focus trapping inside open dialogs.
- **Motion Accessibility:** Respect `@media (prefers-reduced-motion: reduce)`.

---

## 7. Mobile Notch / Safe-Area Mastery, Dashboards & Spatial Craft
- **Full Mobile Notch, Dynamic Island & Landscape Safe-Area Support (MANDATORY):**
  - Always include `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` in `<head>`.
  - Pad all fixed/sticky headers with `padding-top: max(12px, env(safe-area-inset-top))`, bottom navigation/action bars and mobile sheets with `padding-bottom: max(16px, env(safe-area-inset-bottom))`, and horizontal containers with `env(safe-area-inset-inline-start)` / `env(safe-area-inset-inline-end)` so notches, Dynamic Islands, punch-hole cameras (in both portrait and landscape), and home indicator bars never overlap content.
  - Use `100dvh` instead of `100vh` so mobile browser toolbars and virtual keyboards resize layouts cleanly without clipping bottom CTAs.
  - Adapt desktop modals into sleek, native-style **Bottom Sheets** with a drag handle on mobile viewports (`< 640px`).
- **Dashboard & Data Precision:**
  - Use clean **Bento Grid** layouts (`gap: 16px` or `20px`) with balanced card hierarchy, clear KPI stat cards, trend badges (`--status-success` / `--status-danger`), and sticky-header tables with horizontal scroll wrappers on small screens.
  - Charts and data visualizations must inherit theme CSS variables (`--accent-primary`, `--text-secondary`, `--border-subtle`) and update seamlessly on theme toggle.
- **Fluid Typography & Bi-Directional Text:**
  - Font Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Pair with `"IBM Plex Sans Arabic"` or `"Cairo"` for Arabic/RTL interfaces.
  - Apply `dir="auto"` to dynamic user-generated text blocks so mixed Arabic/English content and numbers render in natural reading order.
  - Use `clamp()` for responsive display headings and always set `font-variant-numeric: tabular-nums;` on all numbers, metrics, timers, and prices.
- **8pt Grid & Squircle Radii:**
  - Spacing strictly in multiples of `4px`/`8px` (`8, 12, 16, 20, 24, 32px`).
  - Radii: Modals/Drawers `22px` | Cards `16px` | Buttons/Inputs/Dropdowns `12px` | Checkboxes `6px` | Pills/Badges `9999px`.
- **Strict Z-Index Scale:** Base `1` | Sticky Header `100` | Custom Dropdowns/Tooltips `200` | Custom Modals/Sheets `300` | Custom Toasts `400` | Top Progress Bar, Offline Banner & Brand Splash `500`.

---

## 8. Clean Routing, History API & State Recall (NO HASH URLs)
- **STRICTLY NO Hash-Based Routing (`/#/route`):** Never use `HashRouter` or URL hash fragments (`#/...`) for navigation or history management, as they cause URL clutter, anchor conflicts, and OAuth/deep-link issues.
- **HTML5 History API (`BrowserRouter` / `pushState`):** Always use clean path-based URLs (`/dashboard`, `/settings`, `/orders/123`) powered by the native History API (`history.pushState` / `popstate`), paired with SPA fallback rewrites (`404.html` / `vercel.json` / `_redirects`) so direct reloads on nested routes never fail.
- **Seamless State & Scroll Recall:** Store transient UI state (scroll positions, active filters, search queries, open drawer/tab states) in `history.state` or `sessionStorage` keyed by route path so browser Back/Forward navigation restores the exact view instantly without refetching or losing user context.

---

## 9. Resilience, Offline Awareness & Clean Architecture
- **5 Mandatory Interactive States:** Every interactive element must define `Default`, `Hover`, `Active (scale 0.97)`, `Focus-Visible (2px solid var(--accent-primary) outline)`, and `Disabled (opacity: 0.45)`.
- **Zero Dead Screens, Offline Pill & Error Containment:**
  - **Offline / Network Status Pill:** Listen to `online`/`offline` events and display a sleek, localized, non-intrusive status pill if connectivity drops, auto-dismissing when reconnected.
  - **Empty State:** Clean minimal icon, localized concise message, and primary action button.
  - **Error Boundaries:** Wrap dashboard widgets and main views in Error Boundaries so a localized failure renders a sleek localized inline recovery card with a "Retry" button instead of crashing the entire app.
- **Icons & Touch Targets:** All SVGs use `currentColor` with uniform stroke width (`1.75px–2px`). Minimum `44px × 44px` tap targets on mobile/touch viewports (`360px` to ultra-wide desktop with zero horizontal overflow).
- **Modular Code:** Keep components clean, atomic, and well-structured using semantic HTML5 landmarks (`<header>`, `<main>`, `<nav>`, `<section>`).

---

## 10. Multi-Language Architecture (i18n), Zero Mixed-Text & RTL/LTR Mastery (MANDATORY)
Whenever an application supports more than one language (e.g., Arabic & English), **100% language purity and layout symmetry** are strictly enforced:
- **ZERO Hardcoded UI Strings:**
  - **NEVER** hardcode raw visible text anywhere in JSX, HTML, JS, Toasts, Modal confirmations, form validation messages, placeholders, empty states, `aria-label`s, or `document.title`.
  - Route **100% of UI text** through a centralized translation function (`t('namespace.key')`) backed by structured locale dictionaries (`locales/ar.json`, `locales/en.json`, etc.).
- **100% Dictionary Key Parity (Zero Untranslated Leaks):**
  - Every supported language file MUST contain the exact same nested key structure. Whenever a new feature, button, error message, or label is added, update **all** language dictionaries simultaneously so mixed-language UI or raw fallback keys never appear.
- **Zero-Flicker Direction (`dir`) & Locale Persistence:**
  - Persist active language in `localStorage` and synchronously set `<html lang="ar" dir="rtl">` (or `lang="en" dir="ltr"`) inside `<head>` before first paint so RTL/LTR layout direction never flashes on reload.
  - Update `document.documentElement.lang`, `document.documentElement.dir`, and localized `document.title` immediately upon language switch without requiring a full page reload.
- **100% CSS Logical Properties (Strict Physical Property Ban):**
  - **NEVER** use directional physical CSS properties (`margin-left`, `margin-right`, `padding-left`, `padding-right`, `left`, `right`, `text-align: left`, `text-align: right`, `border-top-left-radius`).
  - **ALWAYS** use logical equivalents (`margin-inline-start`, `margin-inline-end`, `padding-inline`, `inset-inline-start`, `inset-inline-end`, `text-align: start`, `border-start-start-radius`) so the entire layout mirrors automatically between RTL and LTR.
- **Directional Icon & Script Adaptation:**
  - Automatically mirror directional icons (back/forward arrows, chevrons, side-drawer toggles, send paper-planes) in `[dir="rtl"]` using `transform: scaleX(-1);`, while keeping non-directional icons (checkmarks, search, settings, clocks, media controls) unflipped.
  - Adjust Arabic typography metrics when `[lang="ar"]` is active (switch primary font to `"IBM Plex Sans Arabic"` / `"Cairo"` and increase body `line-height` to `1.6` to prevent vertical clipping of Arabic ascenders/diacritics).
  - Format all dates, times, numbers, currencies, and plural rules dynamically via native `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.PluralRules` bound to the active locale, wrapping isolated LTR tokens (emails, phone numbers, URLs, codes) in `<span dir="ltr">` inside RTL sentences.