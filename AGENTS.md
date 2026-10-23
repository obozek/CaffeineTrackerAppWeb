# Website contributor guide

Keep the standalone tracker compatible. Companion tests must not silently
change local storage, model settings, event normalization, or graph behavior.

See [README](README.md) for repository context and characterization evidence.

## Companion roadmap synchronization

The canonical companion contract and roadmap live in the private
[CaffeineTrackerCodeWorker repository](https://github.com/obozek/CaffeineTrackerCodeWorker):
[canonical design](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion.md) and
[interactive roadmap](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/caffeine-tracker-web-companion-roadmap.html).
Read their latest applicable PR/branch before companion implementation; do not replace current decisions
with an older main-branch copy.

- Every companion PR must update the canonical decisions, task status/evidence,
  dependencies, and milestone/parallel-lane overview when affected. Keep the
  Markdown and HTML synchronized in the same coordinated change. If the other
  repository cannot be edited, state the exact follow-up and link it in the PR.
- Record planned, in-progress, verified, and deferred states explicitly. Distinguish
  local work, passing tests, open/merged PRs, deployed resources, and physical-device
  acceptance. A merged PR alone does not complete a task's unverified acceptance.
- Browser-local completion marks are personal notes, never authoritative status.
  The diagram must use the evidence-backed task state, not those checkmarks.
- Use small, cohesive PRs following the documented merge slices. Link cross-repository
  dependencies; keep each PR buildable/testable and preserve older clients.
- Keep the roadmap restricted to the owner/collaborators. Do not publish it,
  provision cloud resources, merge PRs, or collect telemetry without authorization.
- Future product work follows deferred R24 in the canonical Worker's
  [product integration contract](https://github.com/obozek/CaffeineTrackerCodeWorker/blob/main/docs/companion-product-integration.md).
  Keep access product-scoped and model/UI adapters product-owned; Caffeine acceptance does not enable Alcogram.
