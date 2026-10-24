# Companion model and graph characterization (R02)

Evidence snapshot dated 2026-10-15. Results describe those fixtures and runs,
not current release readiness. The private Worker's
[implementation progress](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion.md#15-implementation-progress-and-gradual-pr-plan)
owns task status and PR evidence. See [README](../README.md#development) for current
check commands. Paths below are relative to this repository root.

## Numeric model baseline

The JSON fixtures in `tests/fixtures/caffeine-companion-model-v1.json` are an
exact copy of the watch repository's canonical fixture file. They contain
independent high-precision analytic expected levels, not hardware captures.

The baseline intentionally records current standalone differences: 20-minute
absorption maps to 30, doses are normalized, and volume is clamped to at least
1 L. A fractional-dose difference can be smaller than the 0.01 mg/L comparison
tolerance but still violates exact input preservation. Each sample asserts its
independent standalone expected level within 0.000001 mg/L, including cases
that intentionally differ from the watch; a mismatch alone is not a pass. The
tests characterize standalone behavior; a connected adapter must preserve the
watch inputs.

33 fixtures cover 224 sampled levels, all supported half-lives/absorption values,
empty and 50-event inputs, duplicate timestamps, midnight carry-in, future
events, >48-hour retained inputs, legacy doses, and volume fallback. The numeric
baseline does not cover timezone, DST, annotation or graph geometry; the graph/time
checks below extend that evidence. Physical-device transport remains unverified.

Regenerate/check both copies from the watch repository with
`python3 scripts/generate-companion-model-tests.py --check --web-repo ../CaffeineTrackerAppWeb`.

Review regression proof (2026-10-15): returning zero for every 20-minute
absorption input previously passed all 72 tests. With per-sample standalone
goldens, the same temporary mutant failed six fixture tests; the baseline passed
72/72. Mutation was injected outside the repository; the review preserved production calculations.

## Graph and time baseline

`tests/companion-time-graph.test.js` characterizes the current standalone graph:
explicit watch-range instants are zone-independent, local calendar bounds are
23/25 hours on DST days, repeated-hour labels and midnight depend on the browser
zone, the time marker is clamped, scale stays at 15 mg/L, and annotation uses all
supplied events. Tests use fresh Node processes with Europe/Prague and
America/New_York zones, including both DST transitions in 2026.

The coordinated watch tests record its different grid, dynamic scale, annotation
input filtering, and fixed-day/unclamped marker. These differences are preserved
until the connected adapter exists. Node timezone tests are not physical-watch
Gregorian/DST capture or browser SVG fidelity evidence.

The cross-zone graph includes carry-in absorption and drinks on both sides of
the DST jump, with independent analytic sample levels. Review regression proof:
a temporary mutant that adds the browser timezone offset to graph calculation
timestamps previously passed 81/81 under UTC; the strengthened test rejected it.
