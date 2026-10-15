# Website contributor guide

Keep the standalone tracker compatible. Companion tests must not silently
change local storage, model settings, event normalization, or graph behavior.

## Companion roadmap synchronization

The canonical companion contract and roadmap live in the private
[CaffeineTrackerCodeWorker repository](https://github.com/obozek/CaffeineTrackerCodeWorker):
`docs/caffeine-tracker-web-companion.md` and
`docs/caffeine-tracker-web-companion-roadmap.html`. Read their latest applicable
PR/branch before companion implementation; do not replace current decisions
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
