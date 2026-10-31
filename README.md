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

`companion.html` is a separate, default-off entry for a watch-authorized temporary
session. The watch sends a single-use fragment; the page removes it immediately
and redeems it for a host-only HttpOnly cookie. No account, local tracker storage,
consumption write or data upload is involved. Refresh resumes only until the
original ten-minute expiry. Reopening from the watch replaces the old session;
this browser can disconnect without revoking the watch identity.

The preview shows connection status only. Today data and configuration screens
remain the canonical roadmap's next slices. The existing standalone tracker is
unchanged. `assets/companion-config.js` stays disabled until separately authorized
hosting/API activation and physical watch/phone acceptance. Backend contract and
coordinated evidence live in the private Worker's canonical design/HTML roadmap.

Run `npm test` for the existing model/graph suite and session-client regressions.
The coordinated Worker PR includes a real Chromium/local-D1 handoff check, run
with `COMPANION_WEB_CHECKOUT` pointing to this checkout. It verifies cookie flags,
fragment removal, reload, same-tab replacement, replay, expiry and logout without
provisioning or making live API calls. These are local browser results, not
physical Garmin transport acceptance. This first connection page is English;
localized companion UI remains a rollout requirement.

For a separately authorized staging check, prepare a new local static artifact:
`node scripts/build-companion-preview.js /tmp/companion-preview-new`.
It enables only that copy and selects the staging API; it never publishes or
changes normal files. Serve it only at an approved HTTPS origin, configure that
exact Worker web origin, and build the isolated watch with its matching
`--page-url https://<approved-host>/companion.html`. API origins are selected from
the two product-owned staging/production values, never from browser URLs or input.
