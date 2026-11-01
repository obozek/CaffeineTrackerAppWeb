# CaffeineTrackerAppWeb

Static pages for Caffeine Tracker and its standalone browser tracker.

## Development

The site uses plain HTML, CSS and JavaScript. Run the automated checks with:

```sh
npm test
```

Read [AGENTS.md](AGENTS.md) for contributor rules.

### CI runner

The test workflow runs `npm test` on PRs, main pushes and manual runs using Node 24.
This public repository uses standard GitHub-hosted runners, whose compute is
[free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
It does not publish the site or require deployment secrets.

The same `CI_RUNNER=self-hosted` variable used by the private Worker/watch repos
is supported only if this repository becomes private. It then selects labels
`self-hosted`, `linux`, `x64`, `caffeine-web-ci`; unset/`github-hosted` selects
`ubuntu-24.04`. Public and fork PRs always route to GitHub-hosted runners. This is
routing policy, not isolation from edited workflow files: do not register a
personal persistent runner while this repository is public. Any future private
runner needs its own account/VM with Git, Node 24 and an updated official GitHub
runner; do not share its execution account with signing or backend deployment.

Selection is explicit, with no automatic credit detection or offline fallback.
After switching, cancel queued jobs and start a new run. No runner is registered
and no repository variable is changed by this workflow preparation.

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
