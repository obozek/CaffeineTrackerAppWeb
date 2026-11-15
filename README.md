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
interactive estimate of the caffeine curve. The synced **Sleep threshold** is
shown as a labeled purple line alongside the fixed watch level lines, with all
values in a readable legend. The connected chart adds vertical headroom only
when needed to keep that sleep target visible, including empty days. Its
calculation inputs, samples, markers and standalone chart behavior are unchanged. The graph uses the watch’s effective
model and time offsets and shows upcoming values as a projection. Refresh or
return to the tab to fetch the latest uploaded snapshot. Read-only sessions show
the synced settings with an explicit read-only note.
History shows the retained doses grouped by day. Older snapshots only specify
the watch’s offset for Today, so earlier dates are labeled UTC. The extended
snapshot supplies a local offset per event and adds effective bedtime, bedtime
buffer, smart drink sorting and background refresh to Settings.

Schema 5 additionally supplies stable IDs, revisions and literal names for
retained drinks and custom definitions. Tap a History or Today row to view its
details, edit its name/amount/time, or confirm deletion. Updates send only changed
fields against the selected ID/revision; identical drinks remain separate.
Unchanged legacy values and original timestamp seconds are preserved. A changed
time is interpreted in the zone shown when editing began; a zone change requires
reopening before changing the time. A changed watch entry requires refreshing
and reviewing it again. Schemas 1–4 retain their
existing read-only History.

The workspace has three destinations: **Today**, **History** and **Settings**.
An enabled write-capable snapshot adds a prominent **Add drink** action.
It opens a native modal, presented as a bottom sheet on phones, with tappable
drinks and one editable local date/time initially set to now. No separate
Now/custom mode is required. Sending returns to Today with the pending status;
only a watch receipt shows **Synced to watch**. A rejected save keeps its draft
behind **Review change**. Escape, Close and browser Back return focus to the
opener; reload discards unsent drafts and normalizes the sheet’s own same-page
history entry. Expiry/disconnect clears and closes the editor.

The intake window covers the past 48 hours. Watch builds advertising
`futureDrinkSeconds: 86400` also accept the next 24 hours. Scheduled values
stay intact on refresh, and validation explains out-of-range/invalid local
times without clamping them. Older watch builds retain past-time entry and
explain the update needed for scheduling. Native date/time controls use the
phone/browser's timezone and locale.

Create a custom drink from the add sheet or **Settings → My drinks**.
Schema 5 also supports editing/deleting a custom definition and saving a default
order with accessible Move up/down controls. Definition changes affect future
logging; existing History keeps its original values. The watch’s smart sort uses
default order for ties, while its exported `drinkOrder` remains authoritative for
Add drink. At least one active catalog drink must remain. Custom creation/editing
requires locally validated Premium; History management, custom deletion and
default ordering do not. Legacy definitions outside the new-drink name/dose
contract stay visible/manageable but cannot be selected for logging until fixed.
Supported setting edits open the same focused modal, keeping the latest watch
value as the expected value. Legacy values outside the writable contract remain
visible with guidance to adjust them on the watch. Watch-only model details are
collapsed separately. Send one change at a time. A schema 4
snapshot supplies the exact order from the watch’s drink ranker, including
custom drinks. Older snapshots keep their original catalog order.

The isolated automatic-sync build checks for browser changes every minute on
the watch’s main graph, summaries or Phone menu. It waits while watch History or
an editor is open. A pending status refreshes every five
seconds while the browser tab is visible, and stops after a terminal result
or session end. **Phone → Sync from web** and **Check sync** remain immediate
manual actions. **Synced to watch** means the watch confirmed the save.
**Refresh** fetches the latest watch snapshot. After an applied receipt, up to
three bounded two-second refreshes fetch the changed data; they stop when it
appears, the tab hides or the session ends. There is no idle polling. The background-capable
build advertises bounded upload retries every five minutes during the guest
window. Browser changes apply in the eligible foreground screens.
If a watch setting
changes during editing, the user must reopen the editor with the latest value.
Connected changes use the watch’s catalog, Premium rules and storage. The
browser preserves the standalone tracker’s local history.

An applied receipt can arrive before its refreshed snapshot. New writes pause
until the watch’s accepted state is reflected; the old row stays visible while
waiting. After the bounded refresh attempts, the page offers explicit Refresh
guidance. Modern applied receipts carry `afterSequence`, the highest Today
sequence reserved before the next export. A strictly newer, valid snapshot
releases the gate even if the watch has since edited or pruned that record.
Older receipts use the current tab’s exact value/ID reflection instead.
If an acknowledged mutation invalidates the server’s old snapshot, the current
tab keeps its last copy explicitly stale/read-only. A fresh page shows the
confirmed receipt and waiting guidance without an invented graph or zero values.
Neither path discards the accepted marker or enables another write before fresh
watch data arrives.

If sending cannot be confirmed, new saves pause. Keep this tab open and use
**Check sync**. When no receipt is found, **Retry same save** resends the original
ID and unchanged payload, preserving any later draft edits. An interrupted or
unconfirmed watch result requires reviewing the watch’s History or setting,
then **I checked the watch**. That action checks the latest status before
allowing a deliberate new save; it leaves the old outcome unknown and never
replays it. This acknowledgement is per change and lasts only in the current tab.

Requests and drafts stay in memory; unsent drafts are not restored after reload.
Before enabling saves on a fresh page, the browser reconciles an opaque server
write epoch. The server atomically retires older epochs: a delayed old request
either already committed and remains visible, or cannot create a save afterward.
Ordinary Refresh/Check sync does not rotate the epoch. Held requests poll their
exact ID; stale epochs require reconciliation and deliberate draft review,
without automatic resubmission. An applied `afterSequence` marker also survives
reload through the server status. Explicit watch-review acknowledgements remain
tab-local and may need repeating after reload. Servers without reconciliation
support remain read-only. Modern snapshot/status/save responses also identify
their non-secret guest session. A shared-cookie switch clears the previous
private view, drafts and request state before showing the new connection; an old
draft is never carried to another watch. No connected watch data is written to
browser storage.

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
