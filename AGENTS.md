# COC Media Team — UI/UX & Engineering Rules

## Apple HIG Dark Mode & Skeleton Loading Standard

Enforce these UI/UX rules across all components, modals, cards, admin panels, and styles in this project:

### 1. Core Design Philosophy (Apple HIG)
- **Clarity, Deference, and Depth**: The interface must feel like a native iOS / macOS application—clean, uncluttered, content-first, and effortlessly intuitive.
- **Visual Restraint**: Never crowd screens with heavy borders, harsh drop shadows, or competing bright colors. Use subtle surface elevation, generous breathing room, and clear typographic hierarchy instead.

### 2. Dark Mode Color & Elevation Palette
- **Base Canvas (Level 0)**: Deep OLED-friendly near-black (`#08080A` to `#0D0D10`).
- **Primary Elevated Cards (Level 1)**: `#141418` with hairline translucent border (`1px solid rgba(255, 255, 255, 0.08)`).
- **Secondary / Nested Containers (Level 2)**: `#1C1C22` with `1px solid rgba(255, 255, 255, 0.06)`.
- **Interactive / Pressed States (Level 3)**: `#26262E`.
- **Apple System Semantic Accents (Dark Mode calibrated)**:
  - Primary Action / Focus: `#0A84FF` (Apple System Blue)
  - Success / Positive / On-Time: `#30D158` (Apple System Green)
  - Warning / Grace / Pending: `#FF9F0A` (Apple System Orange)
  - Destructive / Absent / Penalty: `#FF453A` (Apple System Red)
- **Text Contrast Hierarchy**:
  - Primary Text: `#FFFFFF`
  - Secondary Text / Subtitles: `#98989F`
  - Tertiary / Timestamps / Placeholders: `#636366`

### 3. Translucency & Materials (Glassmorphism)
- Use frosted glass (`background: rgba(20, 20, 24, 0.72); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);`) for sticky headers, floating bottom navigation bars, drawers, and modal overlays so underlying content subtly diffuses through.
- Avoid stacking `backdrop-filter` on repeated scrollable list cards; use GPU-composited Level 1/2 elevated surfaces with `contain: layout style` for locked 120 FPS scrolling.

### 4. Geometry & Concentric Corner Radii
Follow Apple's concentric curvature rule (`outer radius = inner radius + padding`):
- Modals & Main Containers: `22px` – `24px`
- Standard Cards & List Groups: `16px` – `18px`
- Nested Inner Boxes & Inputs: `12px`
- Action Buttons: `12px` (or `9999px` capsule pills for primary CTAs and filter chips)
- Segmented Controls: Outer track `12px`, active inner thumb `9px` with subtle elevation.

### 5. Typography & Numeric Precision
- Font Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif`.
- Scale & Weight:
  - Page Large Titles: `26px–28px`, `font-weight: 700`, `letter-spacing: -0.02em`.
  - Section / Card Headers: `16px–17px`, `font-weight: 600`.
  - Body Text: `14px–15px`, `font-weight: 400`, `line-height: 1.45`.
  - Micro Labels / Badges: `11px–12px`, `font-weight: 600`.
- Always apply `font-variant-numeric: tabular-nums` on all countdown timers, points, balances, timestamps, and leaderboard ranks.

### 6. Native Interactions, Touch Targets & 120 FPS Motion
- Minimum touch target size: `44px × 44px` for all interactive buttons, tabs, and inputs on mobile.
- Tactile feedback: `transform: scale(0.97); transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);` on `:active` states.
- Transitions & swipes: Use Apple spring deceleration (`cubic-bezier(0.22, 1, 0.36, 1)`) and GPU-composited properties only (`transform`, `opacity`).
- Layout integrity: Never overlap badges over text, never clip action buttons off-screen on narrow viewports (`360px–430px`), and truncate single-line titles with `text-overflow: ellipsis`.

### 7. Skeleton Loading & Perceived Performance (Apple-Style Shimmer)
- **Zero Generic Spinners for Content Loads**: Never show centered spinning wheels or blank screens when loading cards, attendance sessions, tasks, logs, leaderboards, notifications, or transaction ledgers (in Member View or Admin Hub). Always render structural Skeleton Placeholders immediately until data arrives.
- **Zero Layout Shift (CLS = 0)**: Match exact height, padding, border-radius, and grid/flex geometry of the real component (`36px` avatar circles, `14px` title bars, `10px` subtitle bars, capsule status pills).
- **Dark Mode Shimmer Aesthetics**:
  - Base fill: `#1C1C22` (or `rgba(255, 255, 255, 0.05)` inside Level 1 cards) with `overflow: hidden; position: relative;`.
  - Highlight wave: `::after` pseudo-element with `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%)` sweeping over `1.4s ease-in-out infinite`.
- **120 FPS GPU Performance & Accessibility**:
  - Animate ONLY `transform: translateX(-100%)` → `translateX(100%)` on `::after` (never `background-position` or `left`).
  - Respect `@media (prefers-reduced-motion: reduce)` by disabling the sweep animation and showing a calm static tint.
