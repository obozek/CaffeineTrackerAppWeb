# Caffeine Tracker Web Implementation Brief

This document is a handoff brief for building a JavaScript/web tracker that
feels and calculates like the Caffeine Tracker Garmin widget in this repository.
It is intentionally written as product and algorithm guidance, not as a Monkey C
port. Keep the web implementation idiomatic JavaScript while preserving the
observable behavior described here.

Primary source files used for this brief:

- `source/caffeine/AppConfig.mc`
- `source/caffeine/CaffeineModel.mc`
- `source/caffeine/CaffeineEngine.mc`
- `source/caffeine/CaffeineDetailView.mc`
- `source/caffeine/AddDrinkView.mc`
- `source/caffeine/HistoryView.mc`
- `source/caffeine/settings/CaffeineSettings.mc`
- `source/caffeine/settings/TresholdPickerView.mc`
- `source/caffeine/customDrinks/CustomDrink.mc`
- `source/caffeine/customDrinks/DrinkStorageManager.mc`
- `source/caffeine/customDrinks/DrinkUsageRanker.mc`
- `source/caffeine/customDrinks/LatestIntakeCalculator.mc`
- `source/caffeine/dailySummary/`
- `source/shared/EventRepository.mc`
- `source/shared/tools/TimeUtils.mc`

## Product Shape

Build a caffeine intake tracker with these primary surfaces:

- Current caffeine graph for the current local day.
- Add-drink flow with presets, custom drinks, and time selection.
- History list with event deletion.
- Today and yesterday summaries.
- Settings for half-life, threshold, bedtime, bedtime buffer, smart sorting, and
  refresh cadence.

On the watch, the app has three pages: graph, today summary, yesterday summary.
For web, tabs or a compact dashboard are fine, but the first view should be the
usable tracker/graph, not a marketing landing page.

## Design And Color Direction

The visual target is a compact, dark, instrument-like tracker. It should feel
closer to a sports watch data screen than to a lifestyle landing page: black
background, crisp graph, bright caffeine curve, restrained labels, and controls
that stay out of the way of the data.

Use these CSS variables as the recommended web translation of the Garmin colors:

```css
:root {
  --ct-bg: #000000;
  --ct-panel: #050505;
  --ct-text: #ffffff;
  --ct-text-muted: #a1a1aa;
  --ct-grid: #3f3f46;
  --ct-axis: #ffffff;
  --ct-curve: #ffff00;
  --ct-now: #1d4ed8;
  --ct-threshold-stimulated: #166534;
  --ct-threshold-high: #f97316;
  --ct-threshold-max: #ef4444;
  --ct-chip-bg: #18181b;
  --ct-chip-border: #3f3f46;
  --ct-card-bg: #09090b;
  --ct-card-border: #27272a;
  --ct-focus: #facc15;
}
```

### Overall Layout

- First viewport should be the actual tracker, with the graph as the primary
  visual element.
- Use a dark app shell: black page background, no light theme.
- Keep the graph visually dominant. On desktop, give it roughly `55%` to `70%`
  of the first screen height. On mobile, let it occupy the top half of the app.
- Put Add Drink, History, Summary, and Settings controls around the graph as
  compact functional controls, not as marketing sections.
- Avoid decorative gradients, oversized hero copy, and big illustrated cards.
- If using cards, keep them subtle: `--ct-card-bg`, `1px` border, `6px` to
  `8px` radius. Do not put cards inside cards.

### Graph Design

The graph is the signature element and should be visually close to the watch UI.

- Background: solid black.
- X-axis: white.
- Y-axis: do not draw a vertical y-axis line.
- Grid: vertical dark-gray lines every 2 hours.
- Time labels: light gray labels every 4 hours.
- Caffeine curve: bright yellow, `2px` to `3px`, rounded line caps.
- Past/current curve: solid.
- Future projection: dashed yellow, about `4px` dash and `4px` gap.
- Current time marker: vertical blue line.
- Threshold lines:
  - `Stm` at `1.0 mg/L`, dark green.
  - `High` at `5.0 mg/L`, orange.
  - `Max` at `10.0 mg/L`, red.
- Title above graph: `Caffeine 1.23 mg/l`, centered or left-aligned depending
  on the web layout.
- Optional projection text: `Below 0.6 mg/l at 22:15`; visually emphasize the
  time with yellow or stronger white.

Suggested canvas/SVG styling:

```css
.caffeine-graph {
  background: var(--ct-bg);
  color: var(--ct-text);
}

.caffeine-curve {
  stroke: var(--ct-curve);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.caffeine-curve.future {
  stroke-dasharray: 4 4;
}

.graph-grid {
  stroke: var(--ct-grid);
  stroke-width: 1;
}

.graph-axis {
  stroke: var(--ct-axis);
  stroke-width: 1;
}

.now-line {
  stroke: var(--ct-now);
  stroke-width: 1.5;
}
```

### Controls And Lists

- Drink rows should be dense and scannable:
  - main label: drink name
  - sublabel: `64 mg (21:45)` or `64 mg (too late)`
- Use yellow accents for primary action/focus, but avoid making the whole UI
  yellow.
- Primary button: dark background, yellow border or yellow text.
- Secondary buttons: dark gray background, light gray border.
- Numeric settings can use compact segmented controls or select controls.
- History rows should look utilitarian: drink name, mg amount, local time, and a
  clear delete affordance.
- Summary rows should be simple two-column stat rows:
  - label left, value right
  - labels uppercase and muted
  - values white

### Typography

- Use a clean sans-serif such as Inter, system UI, or SF Pro.
- Keep graph labels small: `11px` to `13px`.
- Current level/title: `16px` to `22px` depending on viewport.
- Summary values: `14px` to `18px`.
- Avoid huge hero text. This app is a tool; the data should be the main visual.

### Reference Screenshots

Use these checked-in screenshots as visual references:

- `ScreenShots/WidgetDetail.png`
- `ScreenShots/GraphDetail.png`
- `ScreenShots/AddDrink.png`
- `ScreenShots/HistoryDetail.png`
- `ScreenShots/Settings.png`

## Data Model

Use local browser storage or another persistent store with these shapes:

```ts
type CaffeineEvent = {
  name: string;
  mg: number;
  time: number; // Unix seconds
};

type CustomDrink = {
  name: string;
  mg: number;
};

type DrinkUsageEntry = {
  score: number;
  lastUsed: number; // Unix seconds
};
```

Event retention:

- Keep events in chronological order.
- Keep only the latest 48 hours of events.
- Cap stored events at 50, dropping the oldest.
- Future same-day events are allowed. The Garmin app intentionally supports
  scheduled caffeine intake.

Suggested web storage keys:

- `caffeineEvents`
- `cachedCaffeineLevel`
- `cachedTime`
- `customDrinks`
- `drinkUsage`
- `drinkLastInteraction`
- `drinkLastDecayDay`
- `settings`

## Preset Drinks

Use these defaults:

| Drink | Caffeine |
| --- | ---: |
| Espresso | 64 mg |
| 2x Espresso | 128 mg |
| Brewed Coffee 240ml | 95 mg |
| Black Tea 240ml | 45 mg |
| Green Tea 240ml | 30 mg |
| Energy Drink 240ml | 80 mg |
| Coca Cola 330ml | 32 mg |

Custom drinks:

- Name input should trim whitespace.
- Empty custom drink name becomes `Custom Drink`.
- Caffeine amount picker/range should allow `0` to `500` mg in `1` mg steps.
- Default amount is `60` mg.
- Custom drink names must be unique across presets and custom drinks. If a name
  already exists, append ` 2`, ` 3`, and so on.

## Settings

Half-life controls the caffeine decay model.

| Value | Label |
| ---: | --- |
| 180 min | Very short - 3 hours |
| 240 min | Short - 4 hours |
| 300 min | Average - 5 hours |
| 360 min | Long - 6 hours |
| 480 min | Very long - 8 hours |
| 600 min | Extra long - 10 hours |

Defaults and settings:

- Default half-life: `300` minutes.
- Default body weight fallback: `70 kg`.
- Apparent distribution volume: `weightKg * 0.7` liters. Default is `49 L`.
- Default bedtime: `23:00`.
- Bedtime buffer options: `0`, `30`, `60`, `90`, `120` minutes.
- Default bedtime buffer: `60` minutes.
- Smart drink sorting: default `on`.
- Refresh cadence: default `15` minutes. Web UI can repaint more often, but the
  model should behave as if cached values decay between full recomputes.

Thresholds:

- Fixed graph sleep/stimulation threshold: `1.0 mg/L`.
- Fixed optimal threshold: `5.0 mg/L`.
- Fixed maximum threshold: `10.0 mg/L`.
- Graph maximum scale: `15.0 mg/L`.
- User-configurable "below at" threshold: default `0.6 mg/L`, allowed `0.1` to
  `1.5` in `0.1` steps.

Important nuance: the app uses `1.0 mg/L` for the graph's sleep/stimulation
line, latest-safe-intake advice, and summary stimulated time. The configurable
threshold defaults to `0.6 mg/L` and is used for the premium-style projection:
`Below X mg/l at HH:MM`.

## Caffeine Calculation

The tracker uses a constant absorption-rate phase with exponential metabolism
running during and after absorption. Absorption is selectable as `15`, `30`,
`45`, or `60` minutes and defaults to `30` minutes.

Constants:

```ts
const LN2 = Math.log(2);
const E = Math.E;
```

Remaining caffeine from one event at a target time:

```ts
function remainingMgAtTime(event, timeSec, halfLifeMinutes) {
  if (halfLifeMinutes <= 0) return 0;
  if (event.time > timeSec) return 0;

  const absorptionMinutes = 30;
  const elapsedMinutes = (timeSec - event.time) / 60;
  const absorbedMinutes = Math.min(elapsedMinutes, absorptionMinutes);
  const eliminationRate = LN2 / halfLifeMinutes;
  const amountDuringAbsorption =
    event.mg *
    (1 - Math.exp(-eliminationRate * absorbedMinutes)) /
    (eliminationRate * absorptionMinutes);

  if (elapsedMinutes <= absorptionMinutes) return amountDuringAbsorption;

  return amountDuringAbsorption *
    Math.exp(-eliminationRate * (elapsedMinutes - absorptionMinutes));
}
```

Current concentration in `mg/L`:

```ts
function levelAtTime(events, timeSec, halfLifeMinutes, weightKg = 70) {
  const apparentVolumeLiters = Math.max(weightKg * 0.7, 1);
  let totalMg = 0;

  for (const event of events) {
    if (event.time > timeSec) break;
    totalMg += remainingMgAtTime(event, timeSec, halfLifeMinutes);
  }

  return totalMg / apparentVolumeLiters;
}
```

Decay a cached level without loading all events:

```ts
function decayLevel(level, fromTimeSec, toTimeSec, halfLifeMinutes) {
  if (toTimeSec <= fromTimeSec) return level;

  const deltaMinutes = (toTimeSec - fromTimeSec) / 60;
  const exponent = (LN2 / halfLifeMinutes) * deltaMinutes;
  return level * Math.exp(-exponent);
}
```

Cache behavior:

- If no cached level/time exists, compute from events and cache it.
- If a scheduled future event has become due since the cache timestamp, do a full
  recompute.
- Otherwise decay the cached level from cached time to now, then update the
  cached level/time.

## Graph Data

The main graph covers the current local calendar day from `00:00` to `24:00`.
Yesterday summary/graph data covers the previous local calendar day.

For the web graph:

- Sample across the day using roughly one point per horizontal CSS pixel, or
  cap at a sensible value such as `240` to `400` points for desktop.
- Garmin uses the graph width as the point count on the detail view and `96`
  points for daily summaries.
- Use local midnight boundaries.
- For today, split the curve at current time:
  - Past/current segment: solid yellow.
  - Future projection: dashed yellow.
- Future scheduled events are shown in the future projection once their event
  time is reached by the sample.

Graph generation:

```ts
function graphDataForRange({
  events,
  startSec,
  endSec,
  points,
  includeCurrentTimeRatio,
  nowSec,
  halfLifeMinutes,
  weightKg,
  userThreshold,
}) {
  const step = (endSec - startSec) / points;
  const levelPoints = [];

  for (let i = 0; i < points; i += 1) {
    const t = startSec + i * step;
    levelPoints.push(levelAtTime(events, t, halfLifeMinutes, weightKg));
  }

  return {
    levelPoints,
    currentTimeRatio: includeCurrentTimeRatio
      ? (nowSec - startSec) / (24 * 60 * 60)
      : null,
    maxLevel: 15.0,
    thresholds: {
      sleep: 1.0,
      optimal: 5.0,
      max: 10.0,
      belowAt: userThreshold,
    },
    belowAtTime: lowerThanTime(events, userThreshold, halfLifeMinutes, weightKg),
  };
}
```

Threshold crossing projection:

```ts
function lowerThanTime(events, thresholdMgPerL, halfLifeMinutes, weightKg = 70) {
  if (!events.length || thresholdMgPerL <= 0 || halfLifeMinutes <= 0) {
    return Math.floor(Date.now() / 1000);
  }

  const apparentVolumeLiters = Math.max(weightKg * 0.7, 1);
  const lastEvent = events[events.length - 1];
  const lastTime = lastEvent.time;

  let priorMgAtLastTime = 0;
  for (let i = 0; i < events.length - 1; i += 1) {
    priorMgAtLastTime += remainingMgAtTime(
      events[i],
      lastTime,
      halfLifeMinutes,
    );
  }

  const totalLevelAtLastTime =
    (priorMgAtLastTime + lastEvent.mg) / apparentVolumeLiters;

  if (totalLevelAtLastTime <= 0) {
    return Math.floor(Date.now() / 1000);
  }

  const k = LN2 / halfLifeMinutes;
  const minutes = Math.round(-Math.log(thresholdMgPerL / totalLevelAtLastTime) / k);
  return lastTime + minutes * 60;
}
```

## Latest Safe Intake Advice

The Add Drink list shows each drink as `Name` plus `N mg`. When unlocked in the
watch app, it also shows the latest time the user can drink that dose and still
be below `1.0 mg/L` at bedtime. On locked Garmin installs this shows `--:--`.
For the web version, you can always show the advisory unless you are modelling a
premium state.

Definitions:

- `bedSec`: today's local bedtime timestamp.
- `cutoffSec`: `bedSec - bedtimeBufferMinutes * 60`.
- `T`: minutes from now to bedtime.
- `k`: `ln(2) / halfLifeMinutes`.
- `vd`: apparent distribution volume in liters.
- `mg0`: current level in `mg/L * vd`.
- `mgThreshold`: `1.0 mg/L * vd`.
- `rhsBase`: `mgThreshold * exp(k * T) - mg0`.

Algorithm:

```ts
function latestSafeTimeForDose({
  doseMg,
  nowSec,
  bedSec,
  bedtimeBufferMinutes,
  currentLevelMgPerL,
  halfLifeMinutes,
  weightKg = 70,
}) {
  const cutoffSec = bedSec - bedtimeBufferMinutes * 60;
  if (nowSec >= cutoffSec) return null;
  if (doseMg <= 0) return nowSec;

  const T = (bedSec - nowSec) / 60;
  if (T <= 0) return null;

  const k = LN2 / halfLifeMinutes;
  const vd = Math.max(weightKg * 0.7, 1);
  const mg0 = currentLevelMgPerL * vd;
  const mgThreshold = 1.0 * vd;
  const rhsBase = mgThreshold * Math.exp(k * T) - mg0;

  if (rhsBase <= 0) return null;

  const ratio = rhsBase / doseMg;
  if (ratio <= 1) return null;

  let xMaxMinutes = Math.log(ratio) / k;
  xMaxMinutes = Math.max(0, Math.min(xMaxMinutes, T));

  let latestSec = nowSec + Math.floor(xMaxMinutes) * 60;

  if (latestSec >= cutoffSec) {
    const clamped = cutoffSec - 60;
    if (clamped < nowSec) return null;
    latestSec = clamped;
  }

  return latestSec;
}
```

Display `too late` if this returns `null`.

## Smart Drink Sorting

Smart sorting is enabled by default.

Storage:

```ts
type DrinkUsage = Record<string, DrinkUsageEntry>;
```

When an event is successfully saved:

- If smart sort is enabled, increment that drink's `score` by `1.0`.
- Set `lastUsed` to now.
- Set global `drinkLastInteraction` to now.

When rendering Add Drink:

- Merge preset and custom drinks.
- Decorate each drink with its usage score, defaulting to `0`.
- Sort descending by score.
- Preserve original order as a stable tie-break.

Daily decay:

- Run at most once per local day.
- If no interaction exists, do nothing.
- If inactive for more than `3` days, freeze scores and do not decay.
- Otherwise multiply every score by `0.85`.

When custom drinks are deleted, remove missing drink names from usage storage.

## Summary Metrics

Today/yesterday summary values:

- Total caffeine intake in the day: sum event `mg` where `start <= time < end`.
- Peak level: max of the day's graph `levelPoints`.
- Stimulated time: approximate seconds where graph level is above `1.0 mg/L`.
- Last drink: timestamp of the last event inside the day.
- Sleep safe: projected time below the configured threshold, if present.
- For today only, show delta versus yesterday:
  - total mg delta as `[+N]` or `[-N]`
  - stimulated time delta as `[+Nh]` or `[-Nh]`

Stimulated time calculation:

```ts
function aboveThresholdSeconds(levelPoints, threshold = 1.0) {
  if (!levelPoints.length) return 0;
  const above = levelPoints.filter((level) => level > threshold).length;
  return Math.round((above / levelPoints.length) * 86400);
}
```

Summary copy:

- Page titles: `TODAY`, `YESTERDAY`.
- Rows: `TOTAL`, `STIMUL.`, `LAST DRINK`, `SLEEP SAFE`.
- Empty time fallback: `--:--`.
- Duration format: `0h 0m`, `2h 30m`.

## Interaction Flow

Add drink:

1. Show bedtime in the title, e.g. `Bed time: 23:00`.
2. List drinks with subtext:
   - `64 mg (21:45)` when latest-safe time exists.
   - `64 mg (too late)` when it is too late.
   - `64 mg --:--` if modelling locked premium behavior.
3. User selects a drink.
4. User selects a time.
5. Save `{ name, mg, time }`.
6. Refresh cached level, graph, history, and summaries.

History:

- First action: `Add New Drink`.
- Title shows rolling 24-hour intake: `Caff. N mg/24h`.
- Event row text: `Drink Name (64)`.
- Subtext: local time.
- Selecting an event deletes it and refreshes cache/graph.

Settings:

- Most-used drinks first.
- Caffeine half-life.
- Caffeine threshold.
- Bed Time.
- Bed time buffer.
- Background refresh.
- Version/support/rating rows are product-specific and optional on web.

## Time Formatting

Store all event times as Unix seconds. Display in the user's local timezone.

Recommended formatting:

- 24-hour: `HH:mm`.
- 12-hour if desired: `h:mm AM/PM`.
- If a displayed timestamp is outside the selected day, append day offset:
  - `23:10 (+1d)`
  - `23:10 (-1d)`

The Garmin code is careful around local-midnight and UTC conversion. On web,
prefer standard `Date` or a time library with local timezone handling. The key
behavior is that day ranges are local calendar days, not fixed UTC days.

## Implementation Checklist For The Web Agent

- Build pure functions for caffeine math first and unit-test them.
- Keep event persistence separate from calculations.
- Keep settings/defaults in one product config module.
- Render the graph from sampled `levelPoints`; do not simplify away thresholds,
  grid labels, solid/dashed split, or current-time line.
- Support preset and custom drinks.
- Support future same-day scheduled intake.
- Implement smart sorting and daily decay.
- Implement today/yesterday summaries.
- Use local calendar-day boundaries.
- Add regression tests for:
  - exponential decay
  - current level from multiple events
  - future event exclusion until due
  - 48-hour pruning and 50-event cap
  - latest-safe-time advice
  - summary totals and stimulated time
  - custom drink unique names
  - smart-sort decay
