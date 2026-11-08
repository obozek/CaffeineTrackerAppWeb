# CaffeineTrackerAppWeb

Static pages for Caffeine Tracker and its standalone browser tracker.

## Development

The site uses plain HTML, CSS and JavaScript. Run the automated checks with:

```sh
npm test
```

Read [AGENTS.md](AGENTS.md) for contributor rules.

## Documentation

| Document | Purpose |
| --- | --- |
| [Standalone implementation specification](assets/caffeine-web-tracker-implementation-spec.md) | Original standalone product and implementation decisions |
| [Model and graph characterization](docs/companion-model-characterization.md) | Dated R02 fixtures, results, differences and remaining verification |
| [Canonical companion design](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion.md) | Connected companion contracts and decisions |
| [Interactive roadmap](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion-roadmap.html) | Task dependencies, status and acceptance |
| [Product integration contract](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/companion-product-integration.md) | Deferred Alcogram/other-app boundaries and delivery gates |

Standalone browser data stays separate from connected data. Caffeine is the first
companion target; additional tracker apps require independent R24 acceptance.

## Optional watch session preview

`companion.html` is a separate, default-off connection page. Opening from the
watch redeems a one-use fragment into a host-only HttpOnly cookie, removes the
fragment immediately and permits refresh within the original ten-minute expiry.
Redeeming a new link replaces the previous session; browser logout preserves
watch identity. No account or standalone tracker storage is involved. A separate,
default-off Today endpoint supplies the latest authenticated watch snapshot when
enabled. Today shows the watch’s cached reading, sync time, doses and an
interactive estimate of the caffeine curve. The graph uses the watch’s effective
model and time offsets and shows upcoming values as a projection. Refresh or
return to the tab to fetch the latest uploaded snapshot. Settings controls stay
in a tab-local draft until the revision-checked watch apply flow is implemented.
History shows the retained doses grouped by day. Older snapshots only specify
the watch’s offset for Today, so earlier dates are labeled UTC. The extended
snapshot supplies a local offset per event and adds effective bedtime, bedtime
buffer, smart drink sorting and background refresh to Settings.

Keep `assets/companion-config.js` disabled in the ordinary site. The backend's
[canonical contract](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion.md)
owns activation, API/CORS origins and physical watch/phone acceptance. Requests
carry `X-Caffeine-Companion: 1` for same-origin session reads; foreign origins
remain rejected. `npm test` covers the session client and existing model/graph.
The Worker suite exercises this HTML/JS in Chromium with real local D1; that is
browser evidence, not physical Garmin acceptance.

For an authorized preview, run
`node scripts/build-companion-preview.js /tmp/companion-preview-new [API_ORIGIN]`.
It creates only a new local artifact with absolute links to the main site and
one approved staging/production API origin; staging is the default. Match the
Worker's web origin and isolated watch `--page-url` before authorized hosting.
The builder never publishes or changes normal files.
