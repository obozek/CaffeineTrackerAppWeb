// Connected workspace UI. All wire validation and request semantics live in
// companion-protocol; this module owns the visible session, drafts and focus.
(function (root) {
    "use strict";
    if (typeof module !== "undefined" && module.exports) {
        module.exports = require("./companion-protocol.js");
        return;
    }
    const { takeHandoff, createClient, watchTime, retainedHistory, watchDrinks,
        drinkTime, createSaveRecovery, recordName, recordPatch, localDateTime, loggableDrink, authoredDrink,
        snapshotAfter, isId: uuid } = root.CaffeineCompanionProtocol;
    // Consume before loading styles/images or rendering. Never write secrets to
    // storage, DOM, logs, URL query parameters or analytics.
    let handoff, linkError;
    try { handoff = takeHandoff(root.location, root.history); } catch (error) { linkError = error.message; }
    root.addEventListener("DOMContentLoaded", async () => {
        const title = document.getElementById("connection-title");
        const message = document.getElementById("connection-message");
        const detail = document.getElementById("connection-detail");
        const action = document.getElementById("connection-action");
        const badge = document.getElementById("connection-badge");
        const duration = document.getElementById("connection-duration");
        let expiryTimer, changeTimer, session, client, generation = 0;
        const today = document.getElementById("watch-today");
        const content = document.getElementById("today-content");
        const status = document.getElementById("today-status");
        const privacy = document.getElementById("connection-privacy");
        const purchaseNote = privacy.textContent;
        const refresh = document.getElementById("today-refresh");
        const events = document.getElementById("today-events");
        const more = document.getElementById("today-more");
        const collapsedLimit = 5;
        const graph = document.getElementById("today-graph");
        const scrub = document.getElementById("today-scrub");
        const estimate = document.getElementById("today-estimate");
        const historyDays = document.getElementById("history-days");
        const historyDay = document.getElementById("history-day");
        const historyNote = document.getElementById("history-note");
        const values = document.getElementById("watch-settings-values");
        const settingsNote = document.getElementById("watch-settings-note");
        const paneButtons = [...document.querySelectorAll("[data-watch-pane]")];
        let graphState, history = [], lastRead = -Infinity;
        const changeStatus = document.getElementById("watch-change-status");
        const changeTitle = document.getElementById("watch-change-title");
        const changeDetail = document.getElementById("watch-change-detail");
        const changeAnnouncement = document.getElementById("watch-change-announcement");
        const checkSync = document.getElementById("watch-change-check");
        const retrySave = document.getElementById("watch-change-retry");
        const checkedWatch = document.getElementById("watch-change-reviewed");
        const reviewedChanges = new Set();
        const recovery = createSaveRecovery(() => root.crypto.randomUUID());
        const addForm = document.getElementById("watch-add-form");
        const customForm = document.getElementById("watch-custom-form");
        const settingForm = document.getElementById("watch-setting-form");
        const drinkChoices = document.getElementById("watch-drink-choices");
        const editor = document.getElementById("watch-editor");
        const editorTitle = document.getElementById("watch-editor-title");
        const editorFeedback = document.getElementById("watch-editor-feedback");
        const addOpen = document.getElementById("watch-add-open");
        const reviewChange = document.getElementById("watch-change-review");
        const customSection = document.getElementById("watch-custom-section");
        let editorMode, editorReturn, editorReturnTarget, selectedDrink = null, addDraftStarted = false;
        const timeInput = document.getElementById("watch-drink-time");
        const addError = document.getElementById("watch-add-error");
        const customList = document.getElementById("watch-custom-list");
        const customNote = document.getElementById("watch-custom-note");
        const customError = document.getElementById("watch-custom-error");
        const settingValue = document.getElementById("watch-setting-value");
        const settingError = document.getElementById("watch-setting-error");
        const settingHint = document.getElementById("watch-settings-edit-note");
        const eventForm = document.getElementById("watch-event-form");
        const deleteForm = document.getElementById("watch-delete-form");
        const reorderForm = document.getElementById("watch-reorder-form");
        const eventError = document.getElementById("watch-event-error");
        const deleteError = document.getElementById("watch-delete-error");
        const reorderError = document.getElementById("watch-reorder-error");
        const recordEdit = document.getElementById("watch-record-edit");
        const recordDelete = document.getElementById("watch-record-delete");
        const customReorder = document.getElementById("watch-custom-reorder");
        const reorderList = document.getElementById("watch-reorder-list");
        const changeForms = [addForm, customForm, settingForm, eventForm, deleteForm, reorderForm];
        let writable, workspaceSnapshot, workspaceClock, currentChange, sent, settingEdit, picks = [];
        let writeEpoch = null, writeSessionId = null, needsReconcile = true, scopeRestarts = 0;
        let recoveredHandoffId = null;
        let selectedRecord = null, eventEdit = null, eventBaseline = null, customEdit = null, customBaseline = null, orderEdit = null;
        let editorEntry = null, closingEditorEntry = null;
        let busyChange = false, snapshotChecks = 0, awaitingSnapshot = false;
        const management = () => writable && workspaceSnapshot?.schemaVersion === 5;
        const currentRecord = selection => selection?.type === "event"
            ? workspaceSnapshot?.events.find(record => record.id === selection.record.id)
            : workspaceSnapshot?.customDrinks?.find(record => record.id === selection?.record.id);
        const canDeleteCustom = () => (workspaceSnapshot?.availablePresets.length || 0) + (workspaceSnapshot?.customDrinks?.length || 0) > 1;

        const changeLabels = {
            queued: ["Waiting for watch", "On your watch, open Phone → Sync from web. Then tap Check sync here."],
            offered: ["Received by the watch", "Waiting for confirmation. Finish syncing on the watch, then tap Check sync."],
            applied: ["Synced to watch", "Saved on your watch. The latest watch data will appear after it uploads."],
            conflict: ["Change wasn’t saved", "The watch data changed or the drink name is already in use. Refresh data and review your entry before sending again."],
            premium: ["Premium required", "This change requires Premium on your watch."],
            invalid: ["Change wasn’t saved", "The watch rejected this change. Check the values and try again."],
            interrupted: ["Save needs review", "Check the watch’s History or setting first, then choose “I checked the watch” to continue. New saves are paused."],
            expired: ["Change expired", "The watch didn’t receive this change. You can send it again."],
            unconfirmed: ["Save wasn’t confirmed", "Check the watch’s History or setting first, then choose “I checked the watch” to continue. New saves are paused."],
        };
        const pendingChange = () => ["queued", "offered"].includes(currentChange?.state);
        const uncertainOutcome = () => ["interrupted", "unconfirmed"].includes(currentChange?.state) && !reviewedChanges.has(currentChange.id);
        const saveBlocked = () => pendingChange() || uncertainOutcome() || recovery.pending || awaitingSnapshot;

        function setChangeStatus(title = "", detail = "", state = "", canCheck = false) {
            const announcement = [title, detail].filter(Boolean).join(". ");
            const focusedCheck = document.activeElement === checkSync;
            changeTitle.textContent = title;
            changeDetail.textContent = detail;
            changeStatus.dataset.state = state;
            changeStatus.hidden = !title;
            checkSync.hidden = !canCheck;
            retrySave.hidden = !recovery.canRetry;
            checkedWatch.hidden = !uncertainOutcome();
            reviewChange.hidden = !sent || ["queued", "offered", "applied"].includes(state);
            if (focusedCheck && checkSync.hidden && title && !editor.open) changeTitle.focus({ preventScroll: true });
            if (changeAnnouncement.textContent !== announcement) changeAnnouncement.textContent = announcement;
        }

        function showChange(result) {
            recovery.resolve(result);
            const operation = result && result.id === sent?.id ? sent.operation : null;
            const canVerifySnapshot = result?.state === "applied" && (operation !== null || result.afterSequence !== undefined);
            if (canVerifySnapshot) {
                if (currentChange?.id !== result.id || currentChange?.state !== "applied" || currentChange?.afterSequence !== result.afterSequence) snapshotChecks = 3;
                awaitingSnapshot = result.afterSequence !== undefined
                    ? !snapshotAfter(workspaceSnapshot, result.afterSequence) : !reflectsSave();
                if (!awaitingSnapshot) snapshotChecks = 0;
            }
            if (operation && result.state === "applied" && (result.id !== currentChange?.id || pendingChange())) {
                discardMatchedDraft(sent);
            }
            currentChange = result;
            if (result) {
                const updatedDataLoaded = canVerifySnapshot && !awaitingSnapshot;
                const kind = { drink: "Drink", custom: "Custom drink", setting: "Setting", eventUpdate: "Drink update",
                    eventDelete: "Drink deletion", customUpdate: "Custom drink update", customDelete: "Custom drink deletion", customReorder: "Drink order" }[result.kind];
                const subject = sent?.id === result.id && sent.summary || operation?.name || (operation?.kind === "setting" &&
                    settingFields(workspaceSnapshot).find(field => field[0] === operation.field)?.[1]) || kind;
                const [title, detail] = changeLabels[result.state];
                const guidance = reviewedChanges.has(result.id) && ["interrupted", "unconfirmed"].includes(result.state)
                    ? "You reviewed the watch. The earlier save result is still unknown; any new save is a separate change."
                    : result.state === "queued" && workspaceSnapshot?.schemaVersion >= 4
                        ? "Return to Caffeine’s main screen on your watch. It checks within a minute. Or choose Phone → Sync from web."
                        : result.state === "applied" && awaitingSnapshot ? snapshotChecks
                            ? "Confirmed by your watch. Waiting for refreshed watch data…"
                            : "Confirmed by your watch. Open Caffeine’s main screen, then tap Refresh for updated data. New changes wait for this update."
                            : updatedDataLoaded ? "Saved on your watch. Updated watch data is loaded." : detail;
                const reviewed = reviewedChanges.has(result.id) && ["interrupted", "unconfirmed"].includes(result.state);
                const appliedTitle = result.state === "applied" && ["eventDelete", "customDelete"].includes(result.kind) ? "Deleted from watch" : title;
                setChangeStatus(reviewed ? "Previous save reviewed" : appliedTitle, subject + " · " + guidance, result.state, pendingChange() || uncertainOutcome() || awaitingSnapshot);
            } else {
                setChangeStatus();
            }
            if (editor.open && result && !pendingChange() && result.state !== "applied") {
                editorFeedback.hidden = false;
                editorFeedback.textContent = changeLabels[result.state].join(". ");
            }
            updateChangeButtons();
        }

        function discardMatchedDraft(saved) {
            const operation = saved.operation;
            if (operation.kind === "drink" && drinkDraftKey() === saved.draftKey) {
                addDraftStarted = false;
                showFormError(addError);
            } else if (operation.kind === "custom" && customForm.elements.name.value.trim() === operation.name &&
                Number(customForm.elements.mg.value) === operation.mg) {
                customForm.reset();
            } else if (operation.kind === "setting" && settingEdit?.[0] === operation.field && editedSetting() === operation.value) {
                closeSetting();
            } else if (operation.kind === "eventUpdate" && eventEdit && eventDraftKey() === saved.draftKey) {
                eventEdit = eventBaseline = null;
                eventForm.reset();
            } else if (operation.kind === "customUpdate" && customEdit && customDraftKey() === saved.draftKey) {
                customEdit = customBaseline = null;
                customForm.reset();
            } else if (operation.kind === "customReorder" && orderEdit && JSON.stringify(orderEdit.order) === saved.draftKey) {
                orderEdit = null;
            }
        }

        function showFormError(element, message = "") {
            element.textContent = message;
            element.hidden = !message;
        }

        function updateChangeButtons() {
            const pending = saveBlocked();
            checkedWatch.disabled = busyChange || refresh.disabled;
            retrySave.disabled = !writable || busyChange || refresh.disabled || pendingChange() || uncertainOutcome() || awaitingSnapshot;
            addOpen.disabled = !writable || busyChange || refresh.disabled || pending;
            document.getElementById("watch-custom-open").disabled = addOpen.disabled || workspaceSnapshot?.customDrinks === null;
            customReorder.disabled = addOpen.disabled;
            recordEdit.disabled = !management() || busyChange || refresh.disabled || pending;
            recordDelete.disabled = recordEdit.disabled || (selectedRecord?.type === "custom" && !canDeleteCustom());
            reviewChange.disabled = !writable || busyChange || refresh.disabled || pendingChange();
            for (const button of values.querySelectorAll("button")) button.disabled = !writable || refresh.disabled || busyChange || pending;
            for (const form of changeForms) {
                form.querySelector('button[type="submit"]').disabled = !writable || busyChange || refresh.disabled || pending ||
                    (form === addForm && !loggableDrink(selectedDrink)) || (form === customForm && workspaceSnapshot?.customDrinks === null) ||
                    ([eventForm, deleteForm, reorderForm].includes(form) && !management()) ||
                    (form === reorderForm && (!orderEdit || JSON.stringify(orderEdit.order) === JSON.stringify(orderEdit.expected.map(record => record.id))));
            }
            refreshRecordBadges();
        }

        function settingFields(snapshot) {
            const model = snapshot.model;
            const watch = snapshot.watchSettings;
            return [
                ["halfLifeMinutes", "Caffeine half-life", model.halfLifeMinutes, [180, 240, 300, 360, 480, 600], " min"],
                ["absorptionMinutes", "Absorption time", model.absorptionMinutes, [20, 30, 45, 60], " min"],
                ["thresholdTenths", "Sleep threshold", Math.round(model.belowAtThresholdMgPerL * 10), null],
                ...(watch ? [
                    ["bedtimeOverrideMinutes", "Bedtime", watch.bedtimeOverrideMinutes, null],
                    ["bedtimeBufferMinutes", "Bedtime buffer", watch.bedtimeBufferMinutes, [0, 30, 60, 90, 120], " min"],
                    ["smartSorting", "Sort drinks by use", watch.smartSorting, [false, true]],
                ] : []),
            ];
        }

        function recordDetails(element, record, type) {
            const rows = [["Drink", recordName(record)], ["Caffeine", dose(record.mg)]];
            if (type === "event") {
                const stamp = new Date((record.time + record.offsetSeconds) * 1000).toISOString();
                rows.push(["When", friendlyDay(stamp.slice(0, 10)) + " · " + stamp.slice(11, record.time % 60 ? 19 : 16) + " · watch time"]);
            }
            element.replaceChildren(...rows.map(([label, value]) => readoutRow(label, value)));
        }

        function openRecord(type, record) {
            selectedRecord = { type, record: { ...record } };
            recordDetails(document.getElementById("watch-record-details"), record, type);
            document.getElementById("watch-record-note").textContent = saveBlocked() || !writable
                ? "Changes are paused. Check the latest watch data before making another change." : type === "event"
                ? "Changes update this drink on your watch and its caffeine graph."
                : canDeleteCustom() ? "Changes affect future drinks. Drinks already logged keep their original name and amount."
                    : "Keep at least one drink available. Add another drink before deleting this one.";
            openEditor("detail");
            editorTitle.textContent = type === "event" ? "Drink details" : "Custom drink";
            editorTitle.focus({ preventScroll: true });
        }

        function configureAmount(input, original) {
            input.value = String(original.mg);
            input.min = "0";
            input.max = String(Math.max(500, original.mg));
            input.step = "any";
        }

        function openEvent(record, preserve = false) {
            if (!preserve) {
                eventEdit = { ...record };
                eventForm.elements.name.value = record.name;
                eventBaseline = Object.freeze({ name: eventForm.elements.name.value,
                    time: localDateTime(new Date(record.time * 1000)), zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                eventForm.elements.name.required = Boolean(eventBaseline.name);
                configureAmount(eventForm.elements.mg, record);
                eventForm.elements.time.value = eventBaseline.time;
            }
            showFormError(eventError);
            document.getElementById("watch-event-time-note").textContent = "Time zone for this edit · " +
                eventBaseline.zone.replaceAll("_", " ") + ". Original seconds are kept unless you change the time.";
            openEditor("event");
            eventForm.elements.name.focus({ preventScroll: true });
        }

        function openCustom(record = null, preserve = false) {
            if (!preserve) {
                customEdit = record ? { ...record } : null;
                customForm.reset();
                if (record) {
                    customForm.elements.name.value = record.name;
                    configureAmount(customForm.elements.mg, record);
                } else {
                    customForm.elements.mg.min = "0"; customForm.elements.mg.max = "500"; customForm.elements.mg.step = "1";
                }
            }
            if (!preserve) customBaseline = customEdit ? Object.freeze({ name: customForm.elements.name.value }) : null;
            customForm.elements.name.maxLength = Math.max(64, record?.name.length || customEdit?.name.length || 0);
            document.getElementById("watch-custom-intro").textContent = customEdit
                ? "Changes affect future drinks only. Editing requires Premium on your watch."
                : "Save a favourite with its caffeine amount. Requires Premium on your watch.";
            customForm.noValidate = Boolean(customEdit);
            customForm.elements.name.required = !customEdit || Boolean(customBaseline?.name);
            customForm.querySelector('[type="submit"]').textContent = customEdit ? "Save changes" : "Save custom drink";
            showFormError(customError);
            openEditor("custom");
            editorTitle.textContent = customEdit ? "Edit custom drink" : "Create a drink";
        }

        function confirmDelete() {
            if (!selectedRecord || !management()) return;
            const { type, record } = selectedRecord;
            recordDetails(document.getElementById("watch-delete-details"), record, type);
            document.getElementById("watch-delete-question").textContent = type === "event"
                ? "Remove this drink from your watch?" : "Remove this custom drink from your list?";
            document.getElementById("watch-delete-note").textContent = type === "event"
                ? "Your watch’s caffeine graph and totals will update after deletion."
                : "Drinks already logged keep their original name and amount.";
            showFormError(deleteError);
            openEditor("delete");
            document.getElementById("watch-delete-cancel").focus({ preventScroll: true });
        }

        function openOrder(preserve = false) {
            const records = workspaceSnapshot.customDrinks;
            if (!preserve) orderEdit = { records: records.map(record => ({ ...record })),
                expected: records.map(({ id, revision }) => ({ id, revision })), order: records.map(record => record.id) };
            document.getElementById("watch-reorder-note").textContent = workspaceSnapshot.watchSettings?.smartSorting
                ? "Move drinks into your preferred default order. With sorting by use on, your watch uses this order to break ties."
                : "Move drinks into your preferred default order. The Add drink list follows your watch’s next sync.";
            showFormError(reorderError);
            renderOrder();
            openEditor("reorder");
            editorTitle.focus({ preventScroll: true });
        }

        function renderOrder(focusedId, direction) {
            if (!orderEdit) return;
            reorderList.replaceChildren(...orderEdit.order.map((id, index) => {
                const record = orderEdit.records.find(record => record.id === id);
                const item = document.createElement("li"), copy = document.createElement("span"), amount = document.createElement("small");
                copy.className = "reorder-copy"; copy.textContent = recordName(record); amount.textContent = dose(record.mg); copy.append(amount);
                const controls = document.createElement("div"); controls.className = "reorder-controls";
                for (const [step, title, symbol] of [[-1, "up", "↑"], [1, "down", "↓"]]) {
                    const button = document.createElement("button");
                    button.type = "button"; button.className = "secondary"; button.textContent = symbol;
                    button.dataset.record = id; button.dataset.direction = title;
                    button.setAttribute("aria-label", "Move " + recordName(record) + " " + title);
                    button.disabled = index + step < 0 || index + step >= orderEdit.order.length || saveBlocked();
                    button.addEventListener("click", () => {
                        [orderEdit.order[index], orderEdit.order[index + step]] = [orderEdit.order[index + step], orderEdit.order[index]];
                        renderOrder(id, title);
                        document.getElementById("watch-reorder-announcement").textContent = recordName(record) + " moved to " + (index + step + 1) + " of " + orderEdit.order.length + ".";
                        updateChangeButtons();
                    });
                    controls.append(button);
                }
                item.append(copy, controls); return item;
            }));
            if (focusedId) {
                const button = reorderList.querySelector(`[data-record="${focusedId}"][data-direction="${direction}"]`);
                (button?.disabled ? button.parentElement.querySelector('button:not(:disabled)') : button)?.focus({ preventScroll: true });
            }
        }

        const eventDraftKey = () => JSON.stringify([eventEdit?.id, eventForm.elements.name.value, eventForm.elements.mg.value, eventForm.elements.time.value]);
        const customDraftKey = () => JSON.stringify([customEdit?.id, customForm.elements.name.value, customForm.elements.mg.value]);

        function unchangedRecord(type, record, error) {
            const current = currentRecord({ type, record });
            if (!current || current.revision !== record.revision) {
                showFormError(error, current ? "This drink changed on your watch. Refresh and reopen it to review the latest version."
                    : "This drink is no longer on your watch. Refresh to update the list.");
                return false;
            }
            return true;
        }

        function patchError(error) {
            return error.message === "invalid_name" ? "Enter a short drink name without line breaks."
                : error.message === "invalid_amount" ? "Use a whole caffeine amount from 0 to 500 mg."
                    : error.message === "time_range" ? "Choose a changed time in the past 48 hours or next 24 hours."
                        : "Enter a valid local date and time.";
        }

        function submitRecordEdit(type, record, form, error, draftKey) {
            if (!record || !unchangedRecord(type, record, error)) return;
            if (type === "event" && form.elements.time.value !== eventBaseline.time &&
                Intl.DateTimeFormat().resolvedOptions().timeZone !== eventBaseline.zone) {
                showFormError(error, "Your time zone changed. Close and reopen this drink before changing its time."); return;
            }
            let patch;
            try { patch = recordPatch(record, Object.fromEntries(new FormData(form)), workspaceNow(), futureWindow(), type === "event" ? eventBaseline : customBaseline); }
            catch (failure) { showFormError(error, patchError(failure)); return; }
            if (!Object.keys(patch).length) { showFormError(error, "Change a value to save an edit."); return; }
            void submitChange({ kind: type + "Update", [type + "Id"]: record.id, expectedRevision: record.revision, patch }, draftKey());
        }

        function reviewRecordEdit(operation, context) {
            const isEvent = operation.kind === "eventUpdate";
            const original = isEvent ? eventEdit : customEdit;
            const form = isEvent ? eventForm : customForm;
            const open = isEvent ? openEvent : openCustom;
            if (original?.id === (isEvent ? operation.eventId : operation.customId)) { open(original, true); return; }
            open(context);
            if (operation.patch.name !== undefined) form.elements.name.value = operation.patch.name;
            if (operation.patch.mg !== undefined) form.elements.mg.value = String(operation.patch.mg);
            if (isEvent && operation.patch.time !== undefined) form.elements.time.value = localDateTime(new Date(operation.patch.time * 1000));
        }

        function openSetting(field) {
            settingEdit = field;
            const [key, title, initial, choices, unit] = field;
            const label = document.createElement("label");
            label.textContent = title + (key === "thresholdTenths" ? " (mg/L)" : "");
            const input = document.createElement(choices ? "select" : "input");
            input.name = "desired";
            if (choices) {
                input.replaceChildren(...choices.map(value => new Option(unit ? value + unit : value ? "On" : "Off", String(value))));
                input.value = String(initial);
            } else if (key === "thresholdTenths") {
                input.type = "number"; input.min = "0.1"; input.max = "1.5"; input.step = "0.1";
                input.required = true; input.value = String(initial / 10);
            } else {
                input.type = "time";
                if (initial !== null) input.value = String(Math.floor(initial / 60)).padStart(2, "0") + ":" + String(initial % 60).padStart(2, "0");
                label.append(document.createTextNode(" · leave blank to use the watch default"));
            }
            label.append(input);
            settingValue.replaceChildren(label);
            showFormError(settingError);
            openEditor("setting");
            editorTitle.textContent = title;
            input.focus();
        }

        function closeSetting(returnFocus = false) {
            const field = settingEdit?.[0];
            settingEdit = null;
            if (editorMode === "setting") closeEditor(returnFocus);
            settingForm.hidden = true;
            settingValue.replaceChildren();
            showFormError(settingError);
            if (returnFocus && field) values.querySelector(`[data-setting="${field}"]`)?.focus();
        }

        function editedSetting() {
            const raw = settingForm.elements.desired.value;
            switch (settingEdit[0]) {
                case "smartSorting": return raw === "true";
                case "thresholdTenths": return Math.round(Number(raw) * 10);
                case "bedtimeOverrideMinutes": {
                    if (!raw) return null;
                    const [hours, minutes] = raw.split(":").map(Number);
                    return hours * 60 + minutes;
                }
                default: return Number(raw);
            }
        }

        document.getElementById("watch-setting-cancel").addEventListener("click", () => closeSetting(true));
        settingForm.addEventListener("input", () => showFormError(settingError));
        customForm.addEventListener("input", () => showFormError(customError));

        function renderWorkspace(snapshot, serverTime) {
            workspaceSnapshot = snapshot;
            workspaceClock = { serverTime, elapsedAt: performance.now() };
            addOpen.hidden = !writable;
            customSection.hidden = !writable;
            document.getElementById("watch-sync-help").hidden = false;
            settingHint.hidden = false;
            settingHint.textContent = writable ? "Changes are confirmed by your watch." : "These settings are read-only in this session.";
            document.getElementById("watch-sync-note").textContent = "Open Caffeine on your watch to upload its latest data, then tap Refresh here.";
            if (!writable) {
                closeSetting();
                closeEditor(false);
                showChange(null);
                return;
            }
            const catalog = snapshot.customDrinks;
            const selection = selectedDrink;
            picks = watchDrinks(snapshot, root.CaffeineTrackerCore.PRESET_DRINKS);
            document.getElementById("watch-sync-note").textContent = snapshot.schemaVersion >= 4
                ? "Keep Caffeine’s main screen open to receive browser changes within a minute." +
                    (snapshot.sync.backgroundIntervalMinutes === 5
                        ? " Watch data uploads retry every five minutes while this session is active."
                        : " Access ends with this session.")
                : "To save a browser change, select Phone → Sync from web on your watch.";
            document.getElementById("watch-drink-order-note").textContent = catalog === null
                ? "Only preset drinks are shared. Manage other drinks on your watch."
                : snapshot.schemaVersion >= 4 ? "Drink order matches your watch’s latest sync."
                    : "Sync with the updated watch app to use its drink order.";
            selectedDrink = selection ? picks.find(drink => drink.name === selection.name && drink.mg === selection.mg && loggableDrink(drink)) || null : picks.find(loggableDrink) || null;
            renderDrinkChoices();
            updateTimeHint();
            customForm.hidden = catalog === null;
            customNote.hidden = Boolean(catalog?.length);
            customNote.textContent = catalog === null ? "Your custom drink list isn’t available in this session. Manage it on your watch."
                : "No custom drinks on your watch yet.";
            customList.replaceChildren(...(catalog || []).map(drink => management() ? recordRow("custom", drink, "") : drinkRow(drink.name, drink.mg, false)));
            customReorder.hidden = !management() || !catalog || catalog.length < 2;
            document.getElementById("watch-add-custom").hidden = catalog === null;
            updateChangeButtons();
        }

        async function submitChange(operation, draftKey, retrying = false) {
            if (!session || !writable || busyChange || refresh.disabled || pendingChange() || uncertainOutcome() || awaitingSnapshot ||
                (recovery.pending && !retrying)) return;
            const current = generation;
            const restoreFocus = changeForms.some(form => form.contains(document.activeElement));
            const attempt = recovery.prepare(operation, draftKey, operation.kind === "drink"
                ? workspaceSnapshot.events.filter(event => event.time === operation.time && event.mg === operation.mg).length : 0, writeEpoch);
            const request = attempt.request;
            const context = retrying && sent?.id === request.id ? sent.context : operation.kind === "eventUpdate" ? eventEdit : operation.kind === "customUpdate" ? customEdit
                : operation.kind === "customReorder" ? orderEdit : ["eventDelete", "customDelete"].includes(operation.kind) ? selectedRecord : null;
            const summary = operation.kind === "customReorder" ? "Custom drink order" : context ? recordName(context.record || context) : null;
            sent = { ...request, draftKey: attempt.draftKey, priorCount: attempt.priorCount,
                context: context ? JSON.parse(JSON.stringify(context)) : null, summary };
            snapshotChecks = 0;
            busyChange = true;
            refresh.disabled = action.disabled = checkSync.disabled = true;
            setChangeStatus("Sending change", "Keep this page open while we send your change.");
            updateChangeButtons();
            try {
                const result = await client.sendChange(request);
                if (generation !== current || !session) return;
                if (!result) throw new Error("unavailable");
                if (result.sessionId !== writeSessionId) { await changedConnection(current); return; }
                recovery.resolve(result.change);
                showChange(result.change);
                if (pendingChange() || result.change?.state === "applied") {
                    focusChangeStatus();
                }
            } catch (error) {
                if (generation !== current || !session) return;
                if (error.message === "expired") { problem("expired"); return; }
                if (error.message === "invalid_change") {
                    recovery.clear();
                    setChangeStatus("Change wasn’t sent", "Check your entry and try again.", "invalid");
                } else if (error.message === "stale_write_session") {
                    await reconcileStale(current);
                } else {
                    setChangeStatus(error.message === "change_conflict" ? "A change may already be waiting" : "Send couldn’t be confirmed",
                        "Keep this tab open. Check sync before trying again. New saves are paused.", "unconfirmed", true);
                }
                focusChangeStatus();
            } finally {
                if (generation === current) {
                    busyChange = false;
                    refresh.disabled = action.disabled = checkSync.disabled = false;
                    updateChangeButtons();
                    if (restoreFocus && document.activeElement === document.body && !changeStatus.hidden) changeTitle.focus();
                    scheduleChangeCheck();
                }
            }
        }

        function focusChangeStatus() {
            closeEditor(false);
            showPane(sent?.operation.kind.startsWith("event") ? "history"
                : sent?.operation.kind === "setting" || sent?.operation.kind.startsWith("custom") ? "settings" : "today");
            changeTitle.focus({ preventScroll: true });
            changeStatus.scrollIntoView({ block: "nearest", behavior:
                root.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }

        function drinkDraftKey() {
            return selectedDrink ? JSON.stringify([selectedDrink.name, selectedDrink.mg, timeInput.value]) : null;
        }

        const workspaceNow = () => workspaceClock.serverTime + Math.floor((performance.now() - workspaceClock.elapsedAt) / 1000);
        const futureWindow = () => workspaceSnapshot?.futureDrinkSeconds || 0;

        function updateTimeHint() {
            if (!workspaceClock) return;
            const now = workspaceNow();
            timeInput.min = localDateTime(new Date((now - 172800) * 1000));
            timeInput.max = localDateTime(new Date((now + futureWindow()) * 1000));
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");
            document.getElementById("watch-drink-time-note").textContent = "Your local time · " + zone + ". " +
                (futureWindow() ? "Past 48 hours or next 24 hours." : "Past 48 hours. Update the watch test app to schedule future drinks.");
            const scheduled = new Date(timeInput.value).getTime() / 1000 > now;
            addForm.querySelector('[type="submit"]').textContent = scheduled ? "Schedule drink" : "Add drink";
        }

        function renderDrinkChoices() {
            const focused = drinkChoices.contains(document.activeElement);
            drinkChoices.replaceChildren(...picks.map((drink, index) => {
                const label = document.createElement("label");
                label.className = "drink-choice";
                const radio = document.createElement("input");
                radio.type = "radio"; radio.name = "drink"; radio.value = String(index);
                radio.checked = drink === selectedDrink;
                radio.disabled = !loggableDrink(drink);
                const name = document.createElement("span"); name.textContent = recordName(drink);
                const amount = document.createElement("small"); amount.textContent = dose(drink.mg) + (radio.disabled ? " · edit this drink before logging" : "");
                label.append(radio, name, amount);
                radio.addEventListener("change", () => { selectedDrink = drink; showFormError(addError); updateChangeButtons(); });
                return label;
            }));
            if (focused) drinkChoices.querySelector('input:checked')?.focus({ preventScroll: true });
        }

        function openEditor(mode, preserveDraft = false) {
            if (!session || (!writable && !(mode === "detail" && workspaceSnapshot))) return;
            if (!editor.open) {
                editorReturn = document.activeElement;
                editorReturnTarget = { id: editorReturn.id, eventId: editorReturn.dataset.eventId,
                    customId: editorReturn.dataset.customId, setting: editorReturn.dataset.setting,
                    pane: editorReturn.closest("#watch-pane-today, #watch-pane-history, #watch-pane-settings")?.id };
            }
            editorMode = mode;
            for (const [name, selected] of [["add", "drink"], ["custom", "custom"], ["detail", "detail"], ["event", "event"], ["delete", "delete"], ["reorder", "reorder"]]) {
                document.getElementById("watch-pane-" + name).hidden = mode !== selected;
            }
            settingForm.hidden = mode !== "setting";
            editorTitle.textContent = { drink: "Add a drink", custom: "Create a drink", setting: "Edit setting",
                detail: "Drink details", event: "Edit drink", delete: "Delete drink?", reorder: "Default drink order" }[mode];
            editorFeedback.hidden = true;
            if (mode === "drink") {
                if (!addDraftStarted && !preserveDraft) {
                    timeInput.value = localDateTime(new Date(workspaceNow() * 1000));
                    addDraftStarted = true;
                    selectedDrink = selectedDrink || picks.find(loggableDrink) || null;
                }
                renderDrinkChoices();
                updateTimeHint();
            }
            if (!editor.open) {
                editor.showModal();
                editorEntry = root.crypto.randomUUID();
                if (!closingEditorEntry) root.history.pushState(sheetHistoryState(), "");
            }
            editor.scrollTop = 0;
            if (mode === "drink") (drinkChoices.querySelector('input:checked') || drinkChoices.querySelector('input'))?.focus({ preventScroll: true });
            if (mode === "custom") customForm.elements.name.focus({ preventScroll: true });
            updateChangeButtons();
        }

        function closeEditor(restore = true, fromBack = false) {
            if (editor.open) editor.close();
            editorMode = null;
            if (restore) {
                let target = editorReturn?.isConnected ? editorReturn : null;
                const scope = document.getElementById(editorReturnTarget?.pane) || document;
                if (!target && editorReturnTarget?.eventId) target = scope.querySelector(`[data-event-id="${editorReturnTarget.eventId}"]`);
                if (!target && editorReturnTarget?.customId) target = scope.querySelector(`[data-custom-id="${editorReturnTarget.customId}"]`);
                if (!target && editorReturnTarget?.setting) target = values.querySelector(`[data-setting="${editorReturnTarget.setting}"]`);
                if (!target && editorReturnTarget?.id) target = document.getElementById(editorReturnTarget.id);
                if (!target || target.disabled || !target.getClientRects().length) target = document.getElementById("today-title");
                target.focus({ preventScroll: true });
            }
            const owned = editorEntry && root.history.state?.caffeineCompanionEditor === editorEntry;
            if (owned && !fromBack) closingEditorEntry = editorEntry;
            editorEntry = null;
            if (owned && !fromBack) root.history.back();
        }
        function sheetHistoryState() {
            return { caffeineCompanionEditor: editorEntry, caffeineCompanionPage: root.location.pathname };
        }
        async function restoreSheetNavigation() {
            // A reload discards the in-memory editor, but not its history entry.
            // Unwind only entries explicitly marked by this same-page sheet.
            for (let remaining = root.history.length; remaining > 0; remaining -= 1) {
                const state = root.history.state;
                if (!uuid(state?.caffeineCompanionEditor) || state.caffeineCompanionPage !== root.location.pathname) break;
                const moved = await new Promise(resolve => {
                    const complete = () => { clearTimeout(timer); root.removeEventListener("popstate", changed); resolve(true); };
                    const changed = () => complete();
                    const timer = setTimeout(() => { root.removeEventListener("popstate", changed); resolve(false); }, 500);
                    root.addEventListener("popstate", changed, { once: true });
                    root.history.back();
                });
                if (!moved) { root.history.replaceState(null, ""); break; }
            }
        }
        root.addEventListener("popstate", () => {
            if (closingEditorEntry) {
                closingEditorEntry = null;
                if (editor.open && editorEntry) root.history.pushState(sheetHistoryState(), "");
                return;
            }
            if (editor.open && root.history.state?.caffeineCompanionEditor !== editorEntry) closeEditor(true, true);
        });
        editor.addEventListener("cancel", event => { event.preventDefault(); closeEditor(); });
        editor.addEventListener("keydown", event => {
            if (event.key === "Escape") { event.preventDefault(); closeEditor(); }
        });
        document.getElementById("watch-editor-close").addEventListener("click", () => closeEditor());
        addOpen.addEventListener("click", () => openEditor("drink"));
        document.getElementById("watch-custom-open").addEventListener("click", () => {
            document.getElementById("watch-custom-back").hidden = true;
            openCustom();
        });
        document.getElementById("watch-add-custom").addEventListener("click", () => {
            document.getElementById("watch-custom-back").hidden = false;
            openCustom();
        });
        document.getElementById("watch-custom-back").addEventListener("click", () => openEditor("drink", true));
        recordEdit.addEventListener("click", () => {
            if (selectedRecord?.type === "event") openEvent(selectedRecord.record);
            else if (selectedRecord) openCustom(selectedRecord.record);
        });
        recordDelete.addEventListener("click", confirmDelete);
        document.getElementById("watch-event-cancel").addEventListener("click", () => openRecord("event", eventEdit));
        document.getElementById("watch-delete-cancel").addEventListener("click", () => openRecord(selectedRecord.type, selectedRecord.record));
        customReorder.addEventListener("click", () => openOrder());
        document.getElementById("watch-reorder-cancel").addEventListener("click", () => closeEditor());
        eventForm.addEventListener("input", () => showFormError(eventError));
        eventForm.addEventListener("submit", event => {
            event.preventDefault();
            submitRecordEdit("event", eventEdit, eventForm, eventError, eventDraftKey);
        });
        deleteForm.addEventListener("submit", event => {
            event.preventDefault();
            if (!selectedRecord || !unchangedRecord(selectedRecord.type, selectedRecord.record, deleteError)) return;
            const { type, record } = selectedRecord;
            if (type === "custom" && !canDeleteCustom()) { showFormError(deleteError, "Keep at least one drink available. Add another drink first."); return; }
            void submitChange(type === "event" ? { kind: "eventDelete", eventId: record.id, expectedRevision: record.revision }
                : { kind: "customDelete", customId: record.id, expectedRevision: record.revision });
        });
        reorderForm.addEventListener("submit", event => {
            event.preventDefault();
            if (!orderEdit) return;
            const current = workspaceSnapshot.customDrinks?.map(({ id, revision }) => ({ id, revision }));
            if (JSON.stringify(current) !== JSON.stringify(orderEdit.expected)) {
                showFormError(reorderError, "Your custom drinks changed on the watch. Close this editor and review the latest list."); return;
            }
            void submitChange({ kind: "customReorder", expected: orderEdit.expected, order: orderEdit.order }, JSON.stringify(orderEdit.order));
        });
        reviewChange.addEventListener("click", () => {
            if (!sent) return;
            const operation = sent.operation;
            if (["eventUpdate", "customUpdate"].includes(operation.kind)) {
                reviewRecordEdit(operation, sent.context);
            } else if (["eventDelete", "customDelete"].includes(operation.kind)) {
                selectedRecord = sent.context;
                confirmDelete();
            } else if (operation.kind === "customReorder") {
                orderEdit = sent.context;
                openOrder(true);
            } else if (operation.kind === "setting") {
                if (settingEdit?.[0] !== sent.operation.field) {
                    const field = settingFields(workspaceSnapshot).find(field => field[0] === sent.operation.field);
                    if (!field) return;
                    openSetting(field);
                    settingEdit = [...field];
                    settingEdit[2] = sent.operation.expected;
                    const input = settingForm.elements.desired;
                    input.value = sent.operation.field === "thresholdTenths" ? String(sent.operation.value / 10)
                        : sent.operation.field === "bedtimeOverrideMinutes" ? sent.operation.value === null ? ""
                            : String(Math.floor(sent.operation.value / 60)).padStart(2, "0") + ":" + String(sent.operation.value % 60).padStart(2, "0")
                        : String(sent.operation.value);
                } else openEditor("setting", true);
            } else if (operation.kind === "custom") openCustom(null, true);
            else openEditor(operation.kind, true);
            editorFeedback.hidden = false;
            editorFeedback.textContent = changeTitle.textContent + ". " + changeDetail.textContent;
        });
        timeInput.addEventListener("input", updateTimeHint);
        addForm.noValidate = true;
        addForm.addEventListener("input", () => showFormError(addError));
        addForm.addEventListener("submit", event => {
            event.preventDefault();
            if (!workspaceClock) return;
            if (!selectedDrink) { showFormError(addError, "Choose a drink to continue."); return; }
            const draftKey = drinkDraftKey();
            let time;
            try { time = drinkTime(timeInput.value, workspaceNow(), futureWindow()); }
            catch (error) {
                showFormError(addError, error.message === "time_range"
                    ? futureWindow() ? "Choose a time in the past 48 hours or next 24 hours. Your entered time hasn’t changed."
                        : "This watch build supports the past 48 hours. Update the test app to schedule future drinks."
                    : "Enter a valid local date and time.");
                return;
            }
            void submitChange({ kind: "drink", name: selectedDrink.name, mg: selectedDrink.mg, time }, draftKey);
        });
        customForm.addEventListener("submit", event => {
            event.preventDefault();
            if (customEdit) {
                submitRecordEdit("custom", customEdit, customForm, customError, customDraftKey);
                return;
            }
            let drink;
            try { drink = authoredDrink(Object.fromEntries(new FormData(customForm))); }
            catch (error) { showFormError(customError, patchError(error)); return; }
            void submitChange({ kind: "custom", ...drink });
        });
        settingForm.addEventListener("submit", event => {
            event.preventDefault();
            if (!settingEdit) return;
            const [field, , expected] = settingEdit;
            const current = settingFields(workspaceSnapshot).find(item => item[0] === field);
            if (!current || current[2] !== expected) {
                showFormError(settingError, "This setting changed on your watch. Cancel, then choose Edit again to review the latest value.");
                return;
            }
            const value = editedSetting();
            if (value === expected) {
                showFormError(settingError, "Choose a different value to send.");
                return;
            }
            void submitChange({ kind: "setting", field, expected, value });
        });

        function showPane(name) {
            document.getElementById("today-title").textContent = { today: "Today", history: "History", settings: "Settings" }[name];
            for (const button of paneButtons) {
                const selected = button.dataset.watchPane === name;
                document.getElementById(button.getAttribute("aria-controls")).hidden = !selected;
                button.setAttribute("aria-pressed", String(selected));
            }
        }
        for (const button of paneButtons) button.addEventListener("click", () => showPane(button.dataset.watchPane));
        document.getElementById("open-watch-history").addEventListener("click", () => {
            showPane("history");
            paneButtons.find(button => button.dataset.watchPane === "history").focus();
        });

        function clearToday() {
            clearTimeout(changeTimer);
            today.hidden = true;
            content.hidden = true;
            events.replaceChildren();
            historyDays.replaceChildren();
            historyDay.replaceChildren();
            historyNote.textContent = "";
            values.replaceChildren();
            document.getElementById("watch-settings-advanced").replaceChildren();
            settingsNote.textContent = "";
            history = [];
            writable = false;
            workspaceSnapshot = workspaceClock = sent = null;
            recovery.clear(); reviewedChanges.clear();
            writeEpoch = writeSessionId = null; needsReconcile = true;
            recoveredHandoffId = null;
            selectedRecord = eventEdit = eventBaseline = customEdit = customBaseline = orderEdit = null;
            busyChange = false; snapshotChecks = 0; awaitingSnapshot = false;
            closeEditor(false);
            editorReturn = editorReturnTarget = null;
            editorFeedback.textContent = "";
            editorFeedback.hidden = true;
            for (const form of changeForms) form.reset();
            selectedDrink = null; addDraftStarted = false;
            addOpen.hidden = customSection.hidden = true;
            document.getElementById("watch-sync-help").hidden = true;
            drinkChoices.replaceChildren();
            customList.replaceChildren();
            document.getElementById("watch-record-details").replaceChildren();
            document.getElementById("watch-delete-details").replaceChildren();
            reorderList.replaceChildren();
            for (const id of ["watch-record-note", "watch-delete-question", "watch-delete-note", "watch-reorder-note", "watch-reorder-announcement", "watch-event-time-note"]) {
                document.getElementById(id).textContent = "";
            }
            showFormError(addError);
            customNote.hidden = true;
            customNote.textContent = "";
            closeSetting();
            showFormError(customError);
            showFormError(eventError); showFormError(deleteError); showFormError(reorderError);
            picks = [];
            showChange(null);
            showPane("today");
            events.dataset.collapsed = "true";
            updateHistoryButton();
            graph.replaceChildren();
            document.getElementById("today-thresholds").replaceChildren();
            graphState = null;
            lastRead = -Infinity;
            estimate.textContent = "";
            scrub.value = "0";
            scrub.removeAttribute("aria-valuetext");
            status.textContent = "";
            document.getElementById("watch-sync-note").textContent = "";
            document.getElementById("watch-connection-notice").hidden = true;
            document.getElementById("today-day").textContent = "";
            document.getElementById("today-offset").textContent = "";
            privacy.textContent = purchaseNote;
            document.getElementById("today-reading").textContent = "";
            document.getElementById("today-captured").textContent = "";
            document.getElementById("today-total").textContent = "";
            document.getElementById("today-count").textContent = "";
            duration.textContent = "";
            refresh.disabled = checkSync.disabled = false;
        }

        function selectTime() {
            if (!graphState) return;
            const { day, data, cursor } = graphState;
            const ratio = Number(scrub.value) / Number(scrub.max);
            const seconds = day.startSec + ratio * (day.endSec - day.startSec);
            const label = watchTime(seconds, day.offsetSegments) + " · " + data.levelAt(seconds).toFixed(2) + " mg/L";
            estimate.textContent = label;
            scrub.setAttribute("aria-valuetext", label);
            const x = Number(cursor.dataset.plotStart) + Number(cursor.dataset.plotWidth) * ratio;
            cursor.setAttribute("x1", x);
            cursor.setAttribute("x2", x);
        }

        function renderGraph(snapshot, now) {
            const day = snapshot.watchDay;
            const data = root.CaffeineTrackerCore.graphFromWatchSnapshot(snapshot, now);
            const formatTime = seconds => watchTime(seconds, day.offsetSegments);
            const offsets = day.offsetSegments.map(({ offsetSeconds }) => {
                const minutes = Math.round(Math.abs(offsetSeconds) / 60);
                return "UTC" + (offsetSeconds < 0 ? "−" : "+") +
                    String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
            });
            document.getElementById("today-offset").textContent = "Watch time · " + offsets.join(" → ");
            graph.innerHTML = root.CaffeineTrackerGraph.renderGraph(data, {
                startSec: day.startSec, endSec: day.endSec, nowSec: now, formatTime,
                compact: root.matchMedia("(max-width: 580px)").matches,
                watchStyle: true,
                sleepThreshold: true,
                dict: { thresholdStimulated: "Stimulated", thresholdHigh: "High", thresholdMax: "Max" },
                ariaLabel: "Estimated caffeine level by watch time. Solid for elapsed time, dashed for projected time.",
            });
            const levels = document.getElementById("today-thresholds");
            levels.replaceChildren(...[
                ["sleep", "Sleep threshold", data.thresholds.belowAt],
                ["stimulated", "Stimulated", data.thresholds.sleep],
                ["high", "High", data.thresholds.optimal],
                ["max", "Max", data.thresholds.max],
            ].map(([key, label, value]) => {
                const item = document.createElement("li"); item.dataset.level = key;
                item.textContent = label + " · " + value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " mg/L";
                return item;
            }));
            graphState = { day, data, cursor: graph.querySelector(".ct-graph-cursor") };
            scrub.value = String(Math.max(0, Math.min(1440, Math.floor((now - day.startSec) / 60))));
            selectTime();
        }
        scrub.addEventListener("input", selectTime);

        function updateHistoryButton() {
            const collapsed = events.dataset.collapsed === "true";
            const count = events.childElementCount;
            more.hidden = count <= collapsedLimit;
            more.textContent = collapsed ? "Show all " + count + " drinks" : "Show fewer drinks";
            more.setAttribute("aria-expanded", String(!collapsed));
        }
        more.addEventListener("click", () => {
            events.dataset.collapsed = String(events.dataset.collapsed !== "true");
            updateHistoryButton();
        });

        const dose = mg => mg.toLocaleString(undefined, { maximumFractionDigits: 3 }) + " mg";

        function drinkRow(time, mg, scheduled) {
            const row = document.createElement("li");
            const label = document.createElement("span");
            label.textContent = time + (scheduled ? " · scheduled" : "");
            const amount = document.createElement("strong");
            amount.textContent = dose(mg);
            row.append(label, amount);
            return row;
        }

        function recordRow(type, record, subtitle) {
            const row = document.createElement("li"), button = document.createElement(writable ? "button" : "div");
            button.className = "record-button";
            if (writable) {
                button.type = "button";
                button.dataset[type + "Id"] = record.id;
                button.setAttribute("aria-label", "View " + recordName(record) + ", " + dose(record.mg) + (subtitle ? ", " + subtitle : ""));
                button.addEventListener("click", () => openRecord(type, record));
            }
            const copy = document.createElement("span"), name = document.createElement("span");
            copy.className = "record-copy"; name.className = "record-name"; name.textContent = recordName(record); copy.append(name);
            if (subtitle) { const line = document.createElement("small"); line.textContent = subtitle; copy.append(line); }
            const pending = document.createElement("small"); pending.className = "record-pending"; pending.dataset.recordStatus = record.id;
            pending.hidden = true; copy.append(pending);
            const amount = document.createElement("span"), value = document.createElement("strong");
            amount.className = "record-amount"; value.textContent = dose(record.mg); amount.append(value);
            button.append(copy, amount); row.append(button);
            return row;
        }

        function refreshRecordBadges() {
            const op = sent?.operation;
            for (const label of document.querySelectorAll("[data-record-status]")) {
                const target = op && [op.eventId, op.customId].includes(label.dataset.recordStatus);
                const waiting = target && currentChange?.id === sent.id && pendingChange();
                label.textContent = target && busyChange ? "Sending…" : waiting
                    ? op.kind.endsWith("Delete") ? "Deletion waiting for watch" : "Update waiting for watch"
                    : target && currentChange?.id === sent.id && currentChange.state === "applied" && awaitingSnapshot ? "Waiting for refreshed watch data" : "";
                label.hidden = !label.textContent;
            }
        }

        function renderHistory() {
            historyDays.replaceChildren();
            const visible = historyDay.value ? history.filter(day => day.key === historyDay.value) : history;
            if (!visible.length) {
                const empty = document.createElement("p");
                empty.className = "detail";
                empty.textContent = "The watch snapshot has no retained drinks.";
                historyDays.append(empty);
            }
            for (const day of visible) {
                const group = document.createElement("section");
                group.className = "history-group";
                const heading = document.createElement("h4");
                heading.textContent = friendlyDay(day.date) + (day.usesWatchTime ? "" : " · UTC");
                const total = document.createElement("p");
                total.className = "detail";
                total.textContent = day.entries.length + (day.entries.length === 1 ? " entry" : " entries") +
                    " · " + dose(day.total) + " logged";
                const list = document.createElement("ul");
                list.className = "drink-list";
                list.append(...day.entries.map(entry => entry.record
                    ? recordRow("event", entry.record, entry.time + (entry.scheduled ? " · scheduled" : ""))
                    : drinkRow(entry.time, entry.mg, entry.scheduled)));
                group.append(heading, total, list);
                historyDays.append(group);
            }
        }
        historyDay.addEventListener("change", renderHistory);

        function friendlyDay(date) {
            return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })
                .format(new Date(date + "T12:00:00Z"));
        }

        function settingReadout(field, snapshot) {
            const [key, , value, , unit] = field;
            if (key === "thresholdTenths") return snapshot.model.belowAtThresholdMgPerL.toLocaleString() + " mg/L";
            if (key === "smartSorting") return value ? "On" : "Off";
            if (key === "bedtimeOverrideMinutes") {
                const minutes = snapshot.watchSettings.effectiveBedtimeMinutes;
                return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0") +
                    (value === null ? " · profile or watch default" : " · watch override");
            }
            return value + unit;
        }

        function settingRow(label, value, field = null) {
            const item = readoutRow(label, value);
            const observed = item.lastElementChild;
            const editable = field && (field[3] === null || field[3].includes(field[2])) &&
                (field[0] !== "thresholdTenths" || (field[2] >= 1 && field[2] <= 15));
            if (field && writable && !editable) {
                const hint = document.createElement("small");
                hint.textContent = "Adjust this value on your watch.";
                observed.append(document.createElement("br"), hint);
            }
            if (editable && writable) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "secondary";
                button.textContent = "Edit";
                button.dataset.setting = field[0];
                button.setAttribute("aria-label", "Edit " + label);
                button.addEventListener("click", () => openSetting(field));
                item.append(button);
            }
            return item;
        }

        function readoutRow(label, value) {
            const item = document.createElement("div");
            const name = document.createElement("dt");
            const observed = document.createElement("dd");
            name.textContent = label; observed.textContent = value;
            item.append(name, observed);
            return item;
        }

        function renderSettings(snapshot) {
            const focusedSetting = document.activeElement?.dataset.setting;
            values.replaceChildren(...settingFields(snapshot).map(field => settingRow(field[1], settingReadout(field, snapshot), field)));
            const advanced = [settingRow("Effective model volume",
                snapshot.model.apparentVolumeLiters.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " L")];
            if (snapshot.watchSettings) advanced.push(settingRow("Watch background refresh", snapshot.watchSettings.backgroundIntervalMinutes + " min"));
            document.getElementById("watch-settings-advanced").replaceChildren(...advanced);
            if (focusedSetting) values.querySelector(`[data-setting="${focusedSetting}"]`)?.focus({ preventScroll: true });
            settingsNote.textContent = snapshot.watchSettings
                ? "Background refresh updates the watch’s local display and complication."
                : snapshot.schemaVersion === 1
                    ? "A newer watch build can also share bedtime, bedtime buffer, drink sorting and background refresh."
                    : "Additional settings were unavailable in this watch snapshot.";
        }

        function renderSnapshotWait(hasStatus) {
            today.hidden = false;
            if (hasStatus || workspaceSnapshot) showSharingNote();
            if (workspaceSnapshot) {
                status.textContent = "Waiting for refreshed watch data. You’re seeing the last synced copy; new changes are paused.";
            } else {
                status.textContent = hasStatus ? "Waiting for refreshed watch data. Open Caffeine’s main screen, then tap Refresh."
                    : "No recent snapshot. Open Today from your watch to sync.";
                content.hidden = !hasStatus;
                addOpen.hidden = customSection.hidden = true;
                for (const button of paneButtons) {
                    button.disabled = true;
                    document.getElementById(button.getAttribute("aria-controls")).hidden = true;
                }
            }
        }

        function renderToday(data) {
            if (!data.snapshot) return;
            showSharingNote();
            const { watchDay, watchDisplay, capturedAt } = data.snapshot;
            const clockSkew = Math.abs(data.receivedAt - capturedAt) > 600;
            const pastDay = data.serverTime >= watchDay.endSec;
            const stale = data.serverTime - data.receivedAt >= 7200 || pastDay;
            const synced = new Date(data.receivedAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            document.getElementById("today-day").textContent = (pastDay ? "Last watch day · " : "") + friendlyDay(watchDay.date);
            status.textContent = (clockSkew ? "Watch time differs from server time. " : stale ? "Stale snapshot. " : "") +
                "Synced " + synced + ".";
            document.getElementById("today-reading").textContent = watchDisplay.cachedLevelMgPerL === null
                ? "—" : watchDisplay.cachedLevelMgPerL.toFixed(2) + " mg/L";
            document.getElementById("today-captured").textContent = watchDisplay.cachedAt === null
                ? "Open Caffeine on your watch to refresh its reading."
                : "From your watch · " + new Date(watchDisplay.cachedAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            events.replaceChildren();
            const reference = clockSkew ? capturedAt : data.serverTime;
            renderGraph(data.snapshot, reference);
            const rows = data.snapshot.events.filter(event => event.time >= watchDay.startSec && event.time < watchDay.endSec);
            const logged = rows.filter(event => event.time <= reference);
            const scheduled = rows.length - logged.length;
            const total = logged.reduce((sum, event) => sum + event.mg, 0);
            document.getElementById("today-total").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " mg";
            document.getElementById("today-count").textContent = logged.length + (logged.length === 1 ? " drink" : " drinks") +
                (scheduled ? " · " + scheduled + " scheduled" : "");
            document.getElementById("today-empty").hidden = rows.length !== 0;
            for (const event of rows.reverse()) {
                events.append(data.snapshot.schemaVersion === 5
                    ? recordRow("event", event, watchTime(event.time, watchDay.offsetSegments) + (event.time > reference ? " · scheduled" : ""))
                    : drinkRow(watchTime(event.time, watchDay.offsetSegments), event.mg, event.time > reference));
            }
            const previousDay = historyDay.value;
            history = retainedHistory(data.snapshot, reference);
            historyDay.replaceChildren(new Option("All retained days", ""), ...history.map(day =>
                new Option(day.date + (day.usesWatchTime ? "" : " UTC"), day.key)));
            if (history.some(day => day.key === previousDay)) historyDay.value = previousDay;
            historyNote.textContent = "Time and caffeine amount for entries still stored on your watch. " +
                (data.snapshot.schemaVersion === 1 ? "Earlier dates are shown in UTC." : "Times follow the watch’s time zone.") +
                (data.snapshot.schemaVersion === 5 && writable ? " Tap a drink to edit its details or delete it."
                    : " History is read-only in this watch snapshot.");
            renderHistory();
            renderSettings(data.snapshot);
            updateHistoryButton();
            content.hidden = false;
        }

        function reflectsSave() {
            if (!sent || !workspaceSnapshot) return false;
            const op = sent.operation;
            if (op.kind === "drink") return workspaceSnapshot.events.filter(event =>
                event.time === op.time && event.mg === op.mg).length > sent.priorCount;
            if (op.kind === "custom") return workspaceSnapshot.customDrinks?.some(drink => drink.name === op.name && drink.mg === op.mg);
            if (op.kind === "setting") return settingFields(workspaceSnapshot).find(field => field[0] === op.field)?.[2] === op.value;
            if (op.kind === "eventDelete") return !workspaceSnapshot.events.some(record => record.id === op.eventId);
            if (op.kind === "customDelete") return !workspaceSnapshot.customDrinks?.some(record => record.id === op.customId);
            if (op.kind === "customReorder") return JSON.stringify(workspaceSnapshot.customDrinks?.map(record => record.id)) === JSON.stringify(op.order);
            const record = op.kind === "eventUpdate" ? workspaceSnapshot.events.find(record => record.id === op.eventId)
                : workspaceSnapshot.customDrinks?.find(record => record.id === op.customId);
            return record && record.revision > op.expectedRevision && Object.entries(op.patch).every(([field, value]) => record[field] === value);
        }

        function scheduleChangeCheck() {
            clearTimeout(changeTimer);
            if (session && (pendingChange() || snapshotChecks > 0) && !document.hidden) {
                changeTimer = setTimeout(() => {
                    if (session && !busyChange && !document.hidden) {
                        if (!pendingChange()) snapshotChecks -= 1;
                        void loadToday(generation);
                    }
                }, pendingChange() ? 5000 : 2000);
            }
        }

        async function reconcileStale(current) {
            needsReconcile = true;
            writeEpoch = null;
            try {
                const result = await client.reconcile();
                if (generation !== current || !session) return;
                if (result === null) {
                    writable = false;
                    setChangeStatus("Saves unavailable", "Your draft is kept. Refresh or open a new connection to try again.", "unconfirmed", true);
                    return;
                }
                if (result.sessionId !== writeSessionId) { await changedConnection(current); return; }
                writeEpoch = result.writeEpoch;
                needsReconcile = false;
                // The atomic server barrier retires the previous epoch. An
                // absent request can no longer arrive later and create a save.
                recovery.clear();
                showChange(result.change);
                if (!result.change || result.change.id !== sent?.id) {
                    const waiting = pendingChange() || uncertainOutcome();
                    setChangeStatus(waiting ? changeTitle.textContent : "Review your draft",
                        (waiting ? changeDetail.textContent + " " : "") + "This page was refreshed elsewhere. Your unsent draft is kept; review it before a new save.",
                        result.change?.state || "conflict", waiting);
                }
            } catch (error) {
                if (generation !== current || !session) return;
                if (error.message === "expired") { problem("expired"); return; }
                setChangeStatus("Couldn’t check the session", "Keep this tab open. Check sync before trying again. Your draft is kept.", "unconfirmed", true);
            }
        }

        async function changedConnection(current) {
            if (generation !== current || !session) return;
            if (scopeRestarts >= 1) { problem("connection_context"); return; }
            scopeRestarts += 1;
            await begin(null, null, true);
        }

        async function loadToday(current) {
            if (refresh.disabled) return;
            const focusedCheck = document.activeElement === checkSync;
            let loadedData = null;
            refresh.disabled = action.disabled = checkSync.disabled = true;
            updateChangeButtons();
            try {
                const reconcile = needsReconcile;
                let changes = null, retiredRequest = false;
                if (reconcile) {
                    changes = await client.reconcile();
                    if (generation !== current || !session) return;
                    if (changes !== null) {
                        if (writeSessionId && changes.sessionId !== writeSessionId) { await changedConnection(current); return; }
                        retiredRequest = recovery.pending;
                        writeEpoch = changes.writeEpoch; writeSessionId = changes.sessionId; needsReconcile = false;
                        recovery.clear();
                    }
                }
                const data = await client.today();
                if (generation !== current || !session || data === null) return;
                if (writeSessionId && data.sessionId !== writeSessionId) { await changedConnection(current); return; }
                loadedData = data;
                lastRead = Date.now();
                today.hidden = false;
                detail.textContent = "Latest snapshot from your watch.";
                detail.dataset.normal = "true";
                const heldId = recovery.attempt?.request.id || ((pendingChange() || uncertainOutcome() || awaitingSnapshot) ? currentChange?.id : null);
                if (!reconcile && writeEpoch) changes = await client.changes(heldId);
                if (generation !== current || !session) return;
                if (changes !== null && writeSessionId && changes.sessionId !== writeSessionId) { await changedConnection(current); return; }
                if (!heldId && changes?.change && reviewedChanges.has(changes.change.id) &&
                    ["interrupted", "unconfirmed"].includes(changes.change.state) && currentChange && currentChange.id !== changes.change.id) {
                    // A previously reviewed older unknown must not replace a
                    // newer result. A different pending/unreviewed ID still wins.
                    changes = await client.changes(currentChange.id);
                    if (generation !== current || !session) return;
                    if (changes !== null && changes.sessionId !== writeSessionId) { await changedConnection(current); return; }
                }
                writable = data.snapshot?.schemaVersion >= 3 && changes !== null && uuid(writeEpoch);
                if (changes === null) { writeEpoch = null; needsReconcile = true; }
                if (data.snapshot) {
                    renderToday(data);
                    renderWorkspace(data.snapshot, data.serverTime);
                    for (const button of paneButtons) button.disabled = false;
                    showPane(paneButtons.find(button => button.getAttribute("aria-pressed") === "true")?.dataset.watchPane || "today");
                } else renderSnapshotWait(Boolean(changes?.change || currentChange || recovery.pending || sent));
                if (changes !== null) {
                    showChange(changes.change);
                    recovery.checked(reviewedChanges.has(changes.change?.id) ? null : changes.change);
                    if (retiredRequest && !changes.change) {
                        setChangeStatus("Review your draft", "The session was refreshed. Your draft is kept; review it before a new save.", "conflict");
                    }
                    if (recovery.pending && !pendingChange() && !uncertainOutcome()) {
                        setChangeStatus("No receipt found", "Retry the same save to check or send it safely. Your current draft will be kept.", "unconfirmed", true);
                    }
                }
                showSharingNote();
                if (recoveredHandoffId && writeSessionId !== recoveredHandoffId) {
                    const notice = document.getElementById("watch-connection-notice");
                    notice.textContent = writeSessionId
                        ? "The new link wasn’t accepted. Your previous connection is still open. Review its data before saving."
                        : "The connection was recovered. Review the watch data shown.";
                    notice.hidden = false;
                }
                recoveredHandoffId = null;
                scopeRestarts = 0;
                return true;
            } catch (error) {
                if (generation !== current || !session) return;
                if (error.message === "expired") { problem("expired"); return; }
                writable = false;
                today.hidden = false;
                if (!workspaceSnapshot && !loadedData && !writeSessionId) {
                    try { loadedData = await client.today(); } catch { /* The read-only retry is bounded to this load. */ }
                    if (generation !== current || !session) return;
                }
                if (!workspaceSnapshot && loadedData?.snapshot) {
                    renderToday(loadedData);
                    renderWorkspace(loadedData.snapshot, loadedData.serverTime);
                    status.textContent = "Watch data loaded. Saves couldn’t be checked. Tap Refresh to try again.";
                } else status.textContent = workspaceSnapshot
                    ? "Couldn’t refresh. You’re seeing the last synced watch data."
                    : "Couldn’t load watch data. Tap Refresh to try again.";
                if (!checkSync.hidden) {
                    setChangeStatus("Couldn’t check sync", "Try Check sync again before sending the change again.", "unconfirmed", true);
                }
            } finally {
                if (generation === current) {
                    refresh.disabled = action.disabled = checkSync.disabled = false;
                    updateChangeButtons();
                    if (focusedCheck && document.activeElement === document.body && !changeStatus.hidden) {
                        (checkSync.hidden ? changeTitle : checkSync).focus({ preventScroll: true });
                    }
                    scheduleChangeCheck();
                }
            }
        }
        const refreshWorkspace = () => { if (session) void loadToday(generation); };
        refresh.addEventListener("click", refreshWorkspace);
        checkSync.addEventListener("click", refreshWorkspace);
        checkedWatch.addEventListener("click", async () => {
            if (!uncertainOutcome() || refresh.disabled) return;
            const id = currentChange.id;
            const current = generation;
            const fresh = await loadToday(current);
            if (fresh !== true || generation !== current || !session || currentChange?.id !== id || !uncertainOutcome()) return;
            reviewedChanges.add(id);
            if (sent?.id === id) {
                discardMatchedDraft(sent);
                sent = null;
            }
            recovery.checked(null);
            showChange(currentChange);
            changeTitle.focus({ preventScroll: true });
        });
        retrySave.addEventListener("click", () => {
            if (!recovery.canRetry) return;
            const attempt = recovery.attempt;
            void submitChange(attempt.request.operation, attempt.draftKey, true);
        });
        document.addEventListener("visibilitychange", () => {
            clearTimeout(changeTimer);
            if (!document.hidden && session?.destination === "today" &&
                (pendingChange() || Date.now() - lastRead >= 15000)) {
                void loadToday(generation);
            } else {
                scheduleChangeCheck();
            }
        });

        function show(state, heading, text, extra = "") {
            badge.textContent = state; title.textContent = heading; message.textContent = text; detail.textContent = extra;
            delete detail.dataset.normal;
            action.hidden = state !== "Connected"; action.disabled = false;
            duration.hidden = state !== "Connected";
            if (state !== "Connected") document.getElementById("watch-sync-help").hidden = true;
        }
        function showSharingNote() {
            privacy.textContent = "Shared watch data can include recent drink names, amounts, times, custom drinks and settings in a temporary server copy. " + purchaseNote;
        }
        function problem(code) {
            clearTimeout(expiryTimer); session = null;
            if (client) client.close();
            clearToday();
            scopeRestarts = 0;
            const expired = code === "expired";
            show(expired ? "Session ended" : "Connection unavailable", expired ? "Open again from your watch" : "We couldn’t connect",
                code === "invalid_link" ? "This connection link is incomplete. Open a new link from Caffeine Tracker on your watch." :
                code === "rate_limited" ? "Please wait a minute, then open a new connection from your watch." :
                expired ? "For your privacy, watch access ends after ten minutes or when you disconnect." :
                "Open a new connection from your watch when the companion is available.");
        }
        function connected(data, current) {
            session = data; handoff = null;
            duration.textContent = "Connected until " + new Date((Date.now() + (data.expiresAt - data.serverTime) * 1000))
                .toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            show("Connected", "Your watch is connected", "Your watch is connected for up to ten minutes. No account needed.", "Watch data and settings are not available in this preview.");
            expiryTimer = setTimeout(() => { if (generation === current) problem("expired"); }, Math.max(0, (data.expiresAt - data.serverTime) * 1000));
            if (data.destination === "today") void loadToday(current);
        }
        action.addEventListener("click", async () => {
            if (!session) return;
            action.disabled = true; const current = generation;
            try { await client.logout(); if (generation !== current) return; clearTimeout(expiryTimer); session = null; clearToday(); show("Disconnected", "You’re disconnected", "Open Caffeine Tracker on your watch to connect again."); }
            catch { if (generation !== current) return; action.disabled = false; delete detail.dataset.normal; detail.textContent = "Couldn’t disconnect. Please try again; access still ends at the original expiry time."; }
        });
        root.addEventListener("pagehide", () => { generation += 1; clearTimeout(expiryTimer); handoff = null; clearToday(); if (client) client.close(); });
        // BFCache must revalidate; neither cached DOM nor an old promise proves access.
        root.addEventListener("pageshow", event => { if (event.persisted) root.location.reload(); });
        async function begin(token, linkFailure, changed = false) {
        const current = ++generation;
        clearTimeout(expiryTimer); session = null;
        clearToday();
        if (!changed) scopeRestarts = 0;
        if (changed) {
            const notice = document.getElementById("watch-connection-notice");
            notice.textContent = "The watch connection changed. Previous drafts were cleared. Review this watch’s data before saving.";
            notice.hidden = false;
        }
        if (client) client.close();
        show("Connecting", "Connecting to your watch", "Please keep this page open for a moment.");
        try {
            client = createClient(root.CaffeineCompanionConfig || { enabled: false, apiOrigin: "https://worker.caffeinetracker.app" }, root.fetch.bind(root));
            let data;
            if (token) {
                try { data = await client.redeem(token); }
                catch (error) {
                    // A failed replacement can leave either the old cookie or a
                    // newly committed cookie valid. Recover whichever still works.
                    if (generation !== current) return;
                    try { data = await client.resume(); }
                    catch { throw error; }
                    recoveredHandoffId = token.sessionId;
                }
            } else data = await client.resume();
            if (generation === current) connected(data, current);
        } catch (error) { if (generation === current) { handoff = null; problem(linkFailure || error.message); } }
        }
        root.addEventListener("hashchange", () => {
            try { const token = takeHandoff(root.location, root.history); if (token) void begin(token); }
            catch (error) { void begin(null, error.message); }
        });
        await restoreSheetNavigation();
        await begin(handoff, linkError);
    });
})(typeof window === "undefined" ? globalThis : window);
