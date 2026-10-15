# CaffeineTrackerAppWeb
Web pages for Caffeine Tracker App

## Companion model characterization (R02)

Run `npm test` for the existing standalone tests and the companion baseline.
The JSON fixtures in `tests/fixtures/caffeine-companion-model-v1.json` are an
exact copy of the watch repository's canonical fixture file. They contain
independent high-precision analytic expected levels, not hardware captures.

The baseline intentionally records current standalone differences: 20-minute
absorption maps to 30, doses are normalized, and volume is clamped to at least
1 L. A fractional-dose difference can be smaller than the 0.01 mg/L comparison
tolerance but still violates exact input preservation. Each sample asserts its
independent standalone expected level within 0.000001 mg/L, including cases
that intentionally differ from the watch; a mismatch alone is not a pass. No calculation code
changes in this slice; a later connected adapter must preserve the watch inputs.

33 fixtures cover 224 sampled levels, all supported half-lives/absorption values,
empty and 50-event inputs, duplicate timestamps, midnight carry-in, future
events, >48-hour retained inputs, legacy doses, and volume fallback. Timezone,
DST, annotation, graph geometry, and real-device transport checks remain open.

Regenerate/check both copies from the watch repository with
`python3 scripts/generate-companion-model-tests.py --check --web-repo ../CaffeineTrackerAppWeb`.
Keep this PR separate from the connected calculation implementation.

Review regression proof (2026-10-15): returning zero for every 20-minute
absorption input previously passed all 72 tests. With per-sample standalone
goldens, the same temporary mutant fails six fixture tests; the baseline passes
72/72. Mutation was injected outside the repository; production core is unchanged.

## Graph and time baseline (next R02 slice)

`tests/companion-time-graph.test.js` characterizes the current standalone graph:
explicit watch-range instants are zone-independent, local calendar bounds are
23/25 hours on DST days, repeated-hour labels and midnight depend on the browser
zone, the time marker is clamped, scale stays at 15 mg/L, and annotation uses all
supplied events. Tests use fresh Node processes with Europe/Prague and
America/New_York zones, including both DST transitions in 2026.

The coordinated watch tests record its different grid, dynamic scale, annotation
input filtering, and fixed-day/unclamped marker. These differences are preserved
until the connected adapter exists. Node timezone tests are not physical-watch
Gregorian/DST capture or browser SVG fidelity evidence. No runtime, local data,
version, or UI changes are included.

The cross-zone graph includes carry-in absorption and drinks on both sides of
the DST jump, with independent analytic sample levels. Review regression proof:
a temporary mutant that adds the browser timezone offset to graph calculation
timestamps previously passed 81/81 under UTC; the strengthened test rejects it.
