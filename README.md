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
