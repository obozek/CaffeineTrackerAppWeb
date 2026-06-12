# Caffeine Web Tracker Implementation Specification

Status: implementation plan with user decisions captured. This document is
planning-only; no tracker implementation code has been written yet.

Source brief: `assets/caffeine-web-tracker-brief.md`

## Objective

Create a static, browser-based caffeine level graph page that behaves like the
Garmin Caffeine Tracker graph while fitting the existing web site. The tracker
must calculate caffeine concentration in mg/L, render a current-day graph with
past and future projection segments, allow preset and custom drink logging,
persist user data locally, smart-sort drinks by usage, support future same-day
intake scheduling, support kg and lb body-weight entry, support all existing
site languages, and respect the site's existing light/dark theme toggle.

## Current Repository Constraints

- The site is plain static HTML, CSS, and JavaScript.
- There is no package manager, bundler, framework, or test runner configured.
- Existing tests use a zero-dependency Node script pattern:
  `node assets/halflife-wizard.test.js`.
- The current homepage is a marketing page for the Garmin app.
- The existing theme switcher writes `html[data-theme="light"]`,
  `html[data-theme="dark"]`, or removes the attribute for auto mode.
- Existing local changes include untracked `.idea/` files and the brief itself;
  implementation must not touch unrelated files.

## Resolved Product Decisions

User decisions:

- Placement: create a separate tracker page, not an embedded homepage section.
- Scope: implement the graph, drink logging, custom drinks, and smart sorting.
- Light mode: keep the graph surface black in light mode.
- Weight: default to `70 kg`, but expose an easy body-weight setting.
- Weight units: support both kg and lb.
- Caffeine absorption: default to `30` minutes, selectable as `15`, `30`, `45`,
  or `60` minutes. Caffeine should already metabolize during absorption.
- Empty state: start empty, without seeded demo data.
- Localization: support all existing site languages: English, German, Spanish,
  and Polish.
- Time display: follow browser locale.
- Threshold projection: when already below the configured threshold, show the
  previous mathematical crossing time rather than `now`.
- Scheduled intake: allow future same-day scheduled drinks.
- Tests: use whatever makes tests better and more CI-ready.
- Medical copy: include a concise estimate-only disclaimer.

## Proposed Scope

Implement the web tracker as a focused static feature with these surfaces:

- Current caffeine graph for the local day.
- Current level title, for example `Caffeine 1.23 mg/L`.
- Projection text, for example `Below 0.6 mg/L at 22:15`.
- Add-drink flow using presets and custom drinks.
- Future same-day intake scheduling from the add-drink flow.
- Custom drink creation with unique names and configurable caffeine amount.
- Smart sorting of preset and custom drinks.
- Body-weight setting with kg/lb input and `70 kg` default.
- Local persistence for events, custom drinks, usage ranking, body-weight
  setting, and cached level.
- Light and dark theme support through the existing site theme mechanism.
- Localized UI strings for English, German, Spanish, and Polish.
- Concise estimate-only disclaimer.

Out of scope unless explicitly re-added:

- Today/yesterday summary pages.
- Full history page.
- Full settings panel for bedtime, bedtime buffer, refresh cadence, and
  threshold editing.
- Premium/locked Garmin behavior.

Recommended minimal support UI:

- A compact recent-drinks list with delete controls should still be included,
  even though a full history page is out of scope. Without delete support, a
  single accidental drink entry would be hard to correct in local-only storage.

## Non-Goals For First Implementation

- No backend, account system, cloud sync, or Garmin device integration.
- No paid/premium lock state.
- No external charting library.
- No framework migration.
- No medically authoritative advice. The UI should describe values as estimates.

## Recommended Product Placement

Create standalone localized pages:

- `tracker.html`
- `de/tracker.html`
- `es/tracker.html`
- `pl/tracker.html`

Add navigation links from each localized homepage to its matching tracker page.
Keep the existing marketing homepage structure intact.

## Visual Specification

### Theme Behavior

The tracker should use component-scoped CSS variables so it can follow:

- `html[data-theme="dark"]`
- `html[data-theme="light"]`
- browser preference when no explicit `data-theme` is set

Resolved behavior:

- Dark mode: Garmin-like black instrument panel.
- Light mode: light surrounding controls, but keep the graph surface dark for
  visual fidelity and better contrast with the yellow caffeine curve.

### Graph

Use SVG, not canvas, unless a later performance issue appears.

Rationale:

- SVG is easy to style with CSS variables.
- SVG is accessible and inspectable.
- The graph only needs a few hundred points, so canvas performance is not needed.
- Solid/dashed path split, threshold lines, labels, and current-time marker are
  straightforward in SVG.

Required graph elements:

- Solid black/dark graph background.
- Horizontal x-axis line.
- No vertical y-axis line.
- Vertical grid lines every 2 hours.
- Time labels every 4 hours.
- Threshold lines:
  - `Stm` at `1.0 mg/L`, green.
  - `High` at `5.0 mg/L`, orange.
  - `Max` at `10.0 mg/L`, red.
- Bright yellow caffeine curve.
- Solid curve for times up to now.
- Dashed yellow curve for future projection.
- Blue current-time marker.
- Graph max scale fixed at `15.0 mg/L`.
- Responsive sizing for mobile and desktop.

### Controls

Controls should be compact and functional:

- Primary actions use dark styling with yellow border or text.
- Secondary controls use muted borders and subtle backgrounds.
- Rows should be dense and scannable.
- Add-drink rows show drink name and dose, for example `Espresso` and `64 mg`.
- Recent-drink rows show drink name, dose, local time, and delete control.
- Body-weight setting supports kg and lb.

### Accessibility

- All buttons and inputs must be keyboard reachable.
- Use native form controls where practical.
- Use `aria-label` on icon-only/delete controls.
- Keep focus states visible in both themes.
- Graph should have a text summary via `role="img"` and `aria-label`, plus
  visible numeric summary outside the graph.

## Data Model

Use Unix seconds for stored timestamps.

```js
// CaffeineEvent
{
  name: string,
  mg: number,
  time: number
}

// CustomDrink
{
  name: string,
  mg: number
}

// DrinkUsageEntry
{
  score: number,
  lastUsed: number
}

// Settings
{
  halfLifeMinutes: number, // defaulted, not necessarily exposed in first UI
  absorptionMinutes: number, // one of 15, 30, 45, 60; default 30
  weightKg: number,
  weightUnit: "kg" | "lb",
  belowAtThresholdMgPerL: number,
  smartSorting: boolean,
}
```

Recommended storage keys:

- `caffeineEvents`
- `cachedCaffeineLevel`
- `cachedTime`
- `customDrinks`
- `drinkUsage`
- `drinkLastInteraction`
- `drinkLastDecayDay`
- `settings`

Storage rules:

- Keep events sorted chronologically.
- Keep only events from the latest 48 hours.
- Cap stored events at 50, dropping the oldest.
- Allow future same-day events.
- Validate stored JSON defensively and fall back to defaults if corrupted.
- Use schema normalization on read so old or partial settings do not break the UI.

## Caffeine Calculation Specification

The core model uses a constant absorption-rate phase with exponential
metabolism running during and after absorption.

Rules:

- A drink absorbs at a constant rate over the selected absorption window.
- The supported absorption windows are `15`, `30`, `45`, and `60` minutes.
- The default absorption window is `30` minutes.
- Half-life elimination starts immediately, including while caffeine is still
  absorbing.
- After absorption completes, the remaining amount decays by half-life.
- Future events must not affect a level before their timestamp.
- Concentration is total remaining caffeine divided by apparent distribution
  volume.
- Apparent distribution volume is `max(weightKg * 0.7, 1)` liters.
- Default `weightKg` is `70`.
- Default half-life is `300` minutes.

Pure functions to implement:

- `remainingMgAtTime(event, timeSec, halfLifeMinutes, absorptionMinutes)`
- `levelAtTime(events, timeSec, halfLifeMinutes, weightKg, absorptionMinutes)`
- `decayLevel(level, fromTimeSec, toTimeSec, halfLifeMinutes)`
- `lowerThanTime(events, thresholdMgPerL, halfLifeMinutes, weightKg, absorptionMinutes)`
- `graphDataForRange(options)`

Threshold crossing behavior:

- The brief's `lowerThanTime` sample can return a timestamp before "now" if the
  user is already below the threshold after the last event. The approved
  behavior is to show the previous mathematical crossing time.

## Time Handling

Use local calendar days, not UTC day windows.

Required helpers:

- `nowSec(clock)`
- `localDayStartSec(date)`
- `localDayEndSec(date)`
- `previousLocalDayRange(date)`
- `formatTime(sec, options)`
- `formatDuration(seconds)`
- `weightToKg(value, unit)`
- `weightFromKg(weightKg, unit)`

Default display:

- Follow browser locale for time formatting.
- Use `--:--` when no time exists.
- Append `(+1d)` or `(-1d)` only when displaying a timestamp outside the
  selected day.

Localization:

- Add localized tracker pages for English, German, Spanish, and Polish.
- Keep caffeine math and storage shared.
- Keep UI copy in a small dictionary object rather than duplicating JavaScript
  logic per language.
- Store data under shared local storage keys so events remain available when
  users switch languages.

## Architecture And SOLID Application

The implementation should keep responsibilities separated without introducing a
framework.

Recommended files:

- `assets/caffeine-tracker-core.js`
  - Pure configuration, math, time, graph, drink sorting, and validation
    functions.
  - No DOM access.
  - No direct `localStorage` access.
  - Exports through CommonJS for Node tests and attaches a namespace to `window`
    for browser use.
- `assets/caffeine-tracker-storage.js`
  - Local storage adapter.
  - Read/write methods for events, settings, custom drinks, usage, and cache.
  - Defensive JSON parsing and normalization.
- `assets/caffeine-tracker-ui.js`
  - DOM controller and event handlers.
  - Calls pure core functions and storage adapter.
  - Renders SVG graph, add-drink/custom-drink controls, recent-drinks list, and
    compact body-weight settings.
  - Accepts injected `clock` and `storage` where practical for testability.
- `assets/caffeine-tracker.css`
  - Tracker-specific styles and theme variables.
  - No broad global overrides.
- `assets/caffeine-tracker-i18n.js`
  - Localized UI string dictionaries for `en`, `de`, `es`, and `pl`.
  - No caffeine math or business logic.
- `assets/caffeine-tracker.test.js`
  - CI-ready tests for core behavior.
- `package.json`
  - Optional if adopting a test runner such as Node's built-in test runner
    scripts or Vitest.

SOLID mapping:

- Single Responsibility: math, storage, rendering, and orchestration are separate.
- Open/Closed: drink presets, threshold constants, and settings options live in
  config objects rather than being scattered through UI code.
- Liskov Substitution: storage and clock are small interfaces, so tests can pass
  substitutes without changing callers.
- Interface Segregation: UI only receives the storage methods it needs.
- Dependency Inversion: core logic never depends on browser APIs; UI depends on
  abstractions for storage and time where practical.

## UI State Flow

Initial page load:

1. Load and normalize settings.
2. Load, prune, and sort events.
3. Load custom drinks and usage data.
4. Update cached current level:
   - Full recompute if no cache exists.
   - Full recompute if a scheduled event became due after cached time.
   - Otherwise decay cached level from cached time to now.
5. Generate graph data for today.
6. Render graph, add-drink list, recent-drinks list, and body-weight settings.
7. Start refresh interval.

Add drink:

1. User chooses preset or custom drink.
2. User chooses time, defaulting to now.
3. Validate dose range `0` to `500` mg.
4. Save event.
5. Prune and cap event storage.
6. Update usage ranking if smart sorting is enabled.
7. Invalidate or recompute cache.
8. Rerender all dependent views.

Delete event:

1. User activates delete control.
2. Remove only the selected event.
3. Recompute cache and graph data.
4. Rerender graph and recent-drinks list.

Settings change:

1. Save normalized settings.
2. Recompute cache when weight changes.
3. Rerender dependent views.

Custom drink:

1. Trim the name.
2. Use `Custom Drink` for empty names.
3. Enforce uniqueness against presets and custom drinks by appending ` 2`,
   ` 3`, etc.
4. Validate amount `0` to `500` mg.
5. Save and rerender add-drink list.

## Test Plan

Use CI-friendly tests. Prefer Node's built-in test runner if practical because it
improves reporting without forcing a dependency or bundler. Use Vitest only if
the browser-facing module structure makes native Node tests awkward.

Command:

```sh
npm test
```

Core regression tests:

- `remainingMgAtTime` returns zero at event time with default absorption.
- `remainingMgAtTime` returns peak dose minus the already-metabolized amount
  after the default absorption window.
- Absorption settings expose exactly `15`, `30`, `45`, and `60` minute options.
- `remainingMgAtTime` returns half dose one half-life after absorption completes.
- Future events return `0` before their timestamp.
- `levelAtTime` sums multiple events and divides by `weightKg * 0.7`.
- `decayLevel` matches full recompute when no due events exist.
- Cached level forces full recompute when a scheduled event becomes due.
- Cached level forces full recompute while any event is still absorbing.
- Local day boundaries handle midnight correctly.
- Graph data has expected point count and fixed max scale `15.0`.
- Graph data excludes future events until each sample reaches the event time.
- Today curve split uses current-time ratio.
- `lowerThanTime` handles empty events, invalid thresholds, and already-below
  cases according to the chosen product decision.
- 48-hour pruning removes old events.
- 50-event cap drops oldest events.
- Custom drink unique naming appends numeric suffixes.
- Smart sorting orders by score with stable original-order tie-break.
- Smart sorting daily decay multiplies scores by `0.85`.
- Inactivity longer than 3 days freezes usage scores.
- Corrupted local storage values fall back to safe defaults.
- Missing stored absorption settings migrate to the `30` minute default and
  invalidate stale cached levels.
- kg/lb conversion is stable and rounded only for display.
- Locale dictionary contains all required keys for `en`, `de`, `es`, and `pl`.

Manual browser checks:

- All localized tracker pages load without console errors.
- Add drink updates graph, current level, and recent-drinks list.
- Delete event updates graph and recent-drinks list.
- Future same-day scheduled drink appears in future projection only when sampled
  at or after its timestamp.
- Theme toggle updates tracker in auto, light, and dark modes.
- Mobile layout remains usable below 400 px width.
- Keyboard navigation can reach all controls.
- SVG graph labels remain legible in both themes.

Optional stronger testing, if dependencies are allowed:

- Add Vitest for core tests if native Node tests are not enough.
- Add Playwright smoke tests for browser interactions and theme rendering.

## Implementation Plan

Phase 1: Core model and tests

- Add `assets/caffeine-tracker-core.js`.
- Define constants, defaults, settings normalization, drink presets, and pure
  caffeine math functions.
- Add `assets/caffeine-tracker.test.js`.
- Implement and run core regression tests.
- Add `package.json` with `npm test` if needed for CI.

Phase 2: Persistence

- Add `assets/caffeine-tracker-storage.js`.
- Implement local storage read/write wrappers.
- Add event pruning, event cap, settings normalization, and corrupted-data
  fallback.
- Extend tests for pure pruning/normalization helpers.

Phase 3: Graph renderer

- Add SVG renderer in `assets/caffeine-tracker-ui.js`.
- Generate grid, axis, labels, thresholds, current-time marker, solid curve, and
  dashed future curve.
- Keep graph rendering deterministic from input graph data.

Phase 4: UI controls

- Add tracker markup to localized tracker pages.
- Implement add-drink list, time selector, custom drink form, compact
  recent-drinks list, and body-weight settings.
- Wire all user actions to storage, recomputation, and rerender.

Phase 5: Localization

- Add `assets/caffeine-tracker-i18n.js`.
- Add localized copy for English, German, Spanish, and Polish.
- Reuse one shared UI controller that reads a page-level language code.

Phase 6: Theme and styling

- Add `assets/caffeine-tracker.css`.
- Scope styles under a tracker root class.
- Define dark and light variables aligned with the existing `theme-toggle.js`.
- Verify contrast, focus states, and responsive layout.

Phase 7: Integration and validation

- Link CSS and scripts from all localized tracker pages.
- Add homepage links to localized tracker pages.
- Run automated tests.
- Do manual browser checks.
- Confirm no unrelated file changes.

## Acceptance Criteria

- The tracker renders on localized standalone pages.
- The graph visually matches the Garmin-style behavior from the brief.
- Current level is calculated in mg/L from stored events, half-life, and weight.
- Past and future graph paths are visually distinct.
- Current-time marker and threshold lines render correctly.
- Drink logging, future same-day scheduling, custom drinks, smart sorting,
  deletion, and persistence work.
- Body-weight settings support kg and lb.
- Existing site theme toggle controls tracker light/dark styling.
- `npm test` passes.
- No unrelated user changes are reverted or modified.

## Remaining Implementation Assumption

The selected scope says "only the graph and custom drinks with smart sorting",
but future scheduling and local-only persistence need minimal supporting UI. I
will include a compact recent-drinks list with delete controls as supporting
functionality, not a full history page, unless the user explicitly rejects it.
