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
tolerance but still violates exact input preservation. No calculation code
changes in this slice; a later connected adapter must preserve the watch inputs.

33 fixtures cover 224 sampled levels, all supported half-lives/absorption values,
empty and 50-event inputs, duplicate timestamps, midnight carry-in, future
events, >48-hour retained inputs, legacy doses, and volume fallback. Timezone,
DST, annotation, graph geometry, and real-device transport checks remain open.

Regenerate/check both copies from the watch repository with
`python3 scripts/generate-companion-model-tests.py --check --web-repo ../CaffeineTrackerAppWeb`.
Keep this PR separate from the connected calculation implementation.
