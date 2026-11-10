(function (root) {
    "use strict";
    const destinations = ["today", "settings", "drinks"];
    const tokenPattern = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/;
    function takeHandoff(location, history) {
        const fragment = location.hash;
        if (fragment) history.replaceState(null, "", location.pathname + location.search);
        if (!fragment) return null;
        const match = fragment.match(/^#connect=(.+)$/);
        const token = match && match[1].match(tokenPattern);
        if (!token) throw new Error("invalid_link");
        return { sessionId: token[1], handoffSecret: token[2] };
    }
    const unix = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
    const finite = value => typeof value === "number" && Number.isFinite(value);

    function readToday(data) {
        if (!data || !unix(data.serverTime)) throw new Error("invalid_response");
        if (data.snapshot === null && data.receivedAt === null && data.expiresAt === null) return data;
        const snapshot = data.snapshot;
        const day = snapshot?.watchDay;
        const display = snapshot?.watchDisplay;
        const model = snapshot?.model;
        if (!unix(data.receivedAt) || !unix(data.expiresAt) || data.expiresAt <= data.serverTime ||
            ![1, 2, 3].includes(snapshot?.schemaVersion) || !unix(snapshot.capturedAt) ||
            !day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !unix(day.startSec) || day.endSec !== day.startSec + 86400 ||
            !Array.isArray(day.offsetSegments) || day.offsetSegments.length < 1 || day.offsetSegments.length > 2 ||
            day.offsetSegments[0]?.fromSec !== day.startSec ||
            day.offsetSegments.some((segment, index, segments) => !unix(segment?.fromSec) ||
                !Number.isInteger(segment.offsetSeconds) || Math.abs(segment.offsetSeconds) > 86400 ||
                segment.fromSec >= day.endSec || (index > 0 && segment.fromSec <= segments[index - 1].fromSec)) ||
            !model || model.id !== "caffeine-constant-absorption-v1" ||
            !finite(model.halfLifeMinutes) || model.halfLifeMinutes <= 0 || ![20, 30, 45, 60].includes(model.absorptionMinutes) ||
            !finite(model.apparentVolumeLiters) || model.apparentVolumeLiters <= 0 ||
            !finite(model.belowAtThresholdMgPerL) ||
            !Array.isArray(snapshot.events) || snapshot.events.length > 50 ||
            snapshot.events.some(event => !unix(event?.time) || !finite(event?.mg) || event.mg < 0) ||
            !display || ((display.cachedLevelMgPerL !== null || display.cachedAt !== null) &&
                (!finite(display.cachedLevelMgPerL) || display.cachedLevelMgPerL < 0 || !unix(display.cachedAt)))) {
            throw new Error("invalid_response");
        }
        if (snapshot.schemaVersion >= 2 &&
            ((snapshot.watchSettings !== null && !validWatchSettings(snapshot.watchSettings)) || snapshot.events.some(event =>
                !Number.isInteger(event.offsetSeconds) || Math.abs(event.offsetSeconds) > 86400))) {
            throw new Error("invalid_response");
        }
        if (snapshot.schemaVersion === 3 && (!Array.isArray(snapshot.availablePresets) ||
            snapshot.availablePresets.length > 7 || snapshot.availablePresets.some(name => typeof name !== "string"))) {
            throw new Error("invalid_response");
        }
        if (snapshot.schemaVersion === 3 && snapshot.customDrinks !== null &&
            (!Array.isArray(snapshot.customDrinks) || snapshot.customDrinks.length > 32 ||
                snapshot.customDrinks.some(drink => typeof drink?.name !== "string" ||
                    !Number.isInteger(drink.mg) || drink.mg < 0 || drink.mg > 500))) {
            throw new Error("invalid_response");
        }
        return data;
    }

    function validWatchSettings(settings) {
        const minuteOfDay = value => Number.isInteger(value) && value >= 0 && value < 1440;
        return settings && typeof settings.smartSorting === "boolean" &&
            [0, 30, 60, 90, 120].includes(settings.bedtimeBufferMinutes) &&
            [5, 15, 30].includes(settings.backgroundIntervalMinutes) &&
            minuteOfDay(settings.effectiveBedtimeMinutes) &&
            (settings.bedtimeOverrideMinutes === null || settings.bedtimeOverrideMinutes === settings.effectiveBedtimeMinutes);
    }

    function watchTime(seconds, segments) {
        let offset = segments[0].offsetSeconds;
        for (const segment of segments) {
            if (seconds < segment.fromSec) break;
            offset = segment.offsetSeconds;
        }
        return new Date((seconds + offset) * 1000).toISOString().slice(11, 16);
    }

    function retainedHistory(snapshot, now) {
        const { events, watchDay, schemaVersion } = snapshot;
        const groups = new Map();
        for (const event of [...events].reverse()) {
            const insideWatchDay = event.time >= watchDay.startSec && event.time < watchDay.endSec;
            const usesWatchTime = schemaVersion >= 2 || insideWatchDay;
            const stamp = new Date((event.time + (schemaVersion >= 2 ? event.offsetSeconds : 0)) * 1000).toISOString();
            const date = insideWatchDay && schemaVersion === 1 ? watchDay.date : stamp.slice(0, 10);
            const key = date + (usesWatchTime ? "" : "-utc");
            const group = groups.get(key) || { key, date, usesWatchTime, entries: [], total: 0 };
            const scheduled = event.time > now;
            const time = schemaVersion === 1 && insideWatchDay
                ? watchTime(event.time, watchDay.offsetSegments) : stamp.slice(11, 16);
            group.entries.push({ time, mg: event.mg, scheduled });
            if (!scheduled) group.total += event.mg;
            groups.set(key, group);
        }
        return [...groups.values()];
    }

    function createClient(config, fetcher) {
        let active = false;
        let closed = false;
        let controller;
        const api = new URL(config.apiOrigin);
        if (api.protocol !== "https:" || api.origin !== config.apiOrigin) throw new Error("unavailable");
        async function request(path, method, body) {
            if (!config.enabled || closed) throw new Error("unavailable");
            if (active) throw new Error("busy");
            active = true; controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const response = await fetcher(api.origin + path, { method, credentials: "include", cache: "no-store", signal: controller.signal,
                    headers: { "X-Caffeine-Companion": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
                if (closed) throw new Error("unavailable");
                if (response.status === 404 && ["/v1/guest/today", "/v1/guest/changes"].includes(path)) return null;
                if (response.status === 409) throw new Error("change_conflict");
                if (!response.ok) throw new Error(response.status === 401 ? "expired" : response.status === 429 ? "rate_limited" : "unavailable");
                if (response.status === 204) return null;
                const data = await response.json();
                if (closed) throw new Error("unavailable");
                if (path === "/v1/guest/changes") {
                    if (!data || (data.change !== null && (!data.change || typeof data.change.id !== "string" ||
                        !["drink", "custom", "setting"].includes(data.change.kind) ||
                        !["queued", "offered", "applied", "conflict", "premium", "invalid", "interrupted", "expired", "unconfirmed"].includes(data.change.state)))) {
                        throw new Error("invalid_response");
                    }
                    return data;
                }
                if (path === "/v1/guest/today") return readToday(data);
                if (data.protocolVersion !== 1 || data.appId !== "caffeine" || !destinations.includes(data.destination) ||
                    !Number.isSafeInteger(data.serverTime) || data.serverTime < 0 || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= data.serverTime || data.expiresAt > data.serverTime + 600) throw new Error("invalid_response");
                return data;
            } finally { clearTimeout(timer); active = false; controller = null; }
        }
        return {
            redeem: handoff => request("/v1/guest/redeem", "POST", handoff),
            resume: () => request("/v1/guest/session", "GET"),
            today: () => request("/v1/guest/today", "GET"),
            changes: () => request("/v1/guest/changes", "GET"),
            sendChange: change => request("/v1/guest/changes", "POST", change),
            logout: () => request("/v1/guest/session", "DELETE", {}),
            close: () => { closed = true; if (controller) controller.abort(); }
        };
    }
    const exported = { takeHandoff, createClient, readToday, watchTime, retainedHistory };
    if (typeof module !== "undefined" && module.exports) { module.exports = exported; return; }
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
        let expiryTimer, session, client, generation = 0;
        const today = document.getElementById("watch-today");
        const content = document.getElementById("today-content");
        const status = document.getElementById("today-status");
        const privacy = document.getElementById("connection-privacy");
        const purchaseNote = privacy.textContent;
        const refresh = document.getElementById("today-refresh");
        const events = document.getElementById("today-events");
        const more = document.getElementById("today-more");
        const collapsedLimit = 5;
        const settings = document.getElementById("settings-draft");
        const changes = document.getElementById("settings-changes");
        const graph = document.getElementById("today-graph");
        const scrub = document.getElementById("today-scrub");
        const estimate = document.getElementById("today-estimate");
        const historyDays = document.getElementById("history-days");
        const historyDay = document.getElementById("history-day");
        const historyNote = document.getElementById("history-note");
        const values = document.getElementById("watch-settings-values");
        const settingsNote = document.getElementById("watch-settings-note");
        const paneButtons = [...document.querySelectorAll("[data-watch-pane]")];
        let model, graphState, history = [], lastRead = -Infinity;
        const changeStatus = document.getElementById("watch-change-status");
        const addForm = document.getElementById("watch-add-form");
        const customForm = document.getElementById("watch-custom-form");
        const settingForm = document.getElementById("watch-setting-form");
        const picker = document.getElementById("watch-drink-picker");
        const customList = document.getElementById("watch-custom-list");
        const customNote = document.getElementById("watch-custom-note");
        const settingValue = document.getElementById("watch-setting-value");
        const changeForms = [addForm, customForm, settingForm];
        let writable, workspaceSnapshot, workspaceClock, currentChange, retry, picks = [];
        let busyChange = false;

        const changeLabels = {
            queued: "Waiting for watch · On the watch, open Phone → Sync from web. Then tap Refresh here.",
            offered: "Received by the watch · Waiting for confirmation. Tap Refresh to check.",
            applied: "Synced to watch · The watch confirmed the save.",
            conflict: "The watch has different data or the name is already in use. Refresh and try again.",
            premium: "This change requires Premium on your watch.",
            invalid: "The watch rejected the change. Check the values and try again.",
            interrupted: "The watch couldn’t verify the save. Check the watch before retrying.",
            expired: "This change expired before the watch received it.",
            unconfirmed: "The session ended before the watch confirmed the save. Check the watch before retrying.",
        };

        function setChangeStatus(message) {
            changeStatus.textContent = message || "";
            delete changeStatus.dataset.state;
            changeStatus.hidden = !message;
        }

        function showChange(result) {
            if (result && result.id === retry?.request.id) retry = null;
            currentChange = result;
            const kind = result && { drink: "Drink", custom: "Custom drink", setting: "Setting" }[result.kind];
            setChangeStatus(result ? kind + " · " + changeLabels[result.state] : null);
            if (result) changeStatus.dataset.state = result.state;
            updateChangeButtons();
        }

        function updateChangeButtons() {
            const pending = currentChange && ["queued", "offered"].includes(currentChange.state);
            for (const form of changeForms) {
                form.querySelector("button").disabled = !writable || busyChange || Boolean(pending) ||
                    (form === customForm && workspaceSnapshot?.customDrinks === null);
            }
        }

        function settingFields(snapshot) {
            const model = snapshot.model;
            const watch = snapshot.watchSettings;
            return [
                ["halfLifeMinutes", "Caffeine half-life", model.halfLifeMinutes, [180, 240, 300, 360, 480, 600], " min"],
                ["absorptionMinutes", "Absorption time", model.absorptionMinutes, [20, 30, 45, 60], " min"],
                ["thresholdTenths", "Personal threshold", Math.round(model.belowAtThresholdMgPerL * 10), null],
                ...(watch ? [
                    ["bedtimeOverrideMinutes", "Bedtime", watch.bedtimeOverrideMinutes, null],
                    ["bedtimeBufferMinutes", "Bedtime buffer", watch.bedtimeBufferMinutes, [0, 30, 60, 90, 120], " min"],
                    ["smartSorting", "Sort drinks by use", watch.smartSorting, [false, true]],
                ] : []),
            ];
        }

        function drawSettingInput() {
            const field = settingFields(workspaceSnapshot).find(item => item[0] === settingForm.elements.field.value);
            const [key, title, initial, choices, unit] = field;
            const label = document.createElement("label");
            label.textContent = title;
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
        }

        function renderWorkspace(snapshot, serverTime) {
            const previous = workspaceSnapshot;
            workspaceSnapshot = snapshot;
            workspaceClock = { serverTime, elapsedAt: performance.now() };
            for (const button of paneButtons) {
                if (["add", "custom"].includes(button.dataset.watchPane)) button.hidden = !writable;
            }
            settingForm.hidden = !writable;
            settings.closest("details").hidden = writable;
            if (!writable) {
                if (["add", "custom"].some(pane => !document.getElementById("watch-pane-" + pane).hidden)) showPane("today");
                showChange(null);
                return;
            }
            const catalog = snapshot.customDrinks;
            const selection = picks[Number(picker.value)];
            picks = [...root.CaffeineTrackerCore.PRESET_DRINKS.filter(drink => snapshot.availablePresets.includes(drink.name)), ...(catalog || [])];
            picker.replaceChildren(new Option("Choose a drink", ""), ...picks.map((drink, index) =>
                new Option(drink.name + " · " + dose(drink.mg), String(index))));
            const index = selection ? picks.findIndex(drink => drink.name === selection.name && drink.mg === selection.mg) : -1;
            if (index >= 0) picker.value = String(index);
            customNote.hidden = catalog !== null;
            customNote.textContent = catalog === null ? "This watch catalog is outside the sharing limits. Manage it on the watch." : "";
            customList.replaceChildren(...(catalog || []).map(drink => drinkRow(drink.name, drink.mg, false)));
            const selected = settingForm.elements.field.value;
            const fields = settingFields(snapshot);
            settingForm.elements.field.replaceChildren(...fields.map(([key, name]) => new Option(name, key)));
            if (fields.some(([key]) => key === selected)) settingForm.elements.field.value = selected;
            if (!previous || !selected || JSON.stringify(settingFields(previous)) !== JSON.stringify(fields)) drawSettingInput();
            updateChangeButtons();
        }

        settingForm.elements.field.addEventListener("change", drawSettingInput);
        async function submitChange(operation) {
            if (!session || !writable || busyChange || refresh.disabled) return;
            const current = generation;
            const key = JSON.stringify(operation);
            const request = retry?.key === key ? retry.request : { id: root.crypto.randomUUID(), operation };
            retry = { key, request };
            busyChange = true;
            refresh.disabled = action.disabled = true;
            updateChangeButtons();
            try {
                const result = await client.sendChange(request);
                if (generation !== current || !session) return;
                retry = null;
                showChange(result.change);
            } catch (error) {
                if (generation !== current || !session) return;
                if (error.message === "expired") { problem("expired"); return; }
                setChangeStatus(error.message === "change_conflict"
                    ? "A change may already be waiting. Tap Refresh to check its status."
                    : "The request could not be confirmed. Retry the same change or tap Refresh.");
            } finally {
                if (generation === current) {
                    busyChange = false;
                    refresh.disabled = action.disabled = false;
                    updateChangeButtons();
                }
            }
        }

        addForm.addEventListener("submit", event => {
            event.preventDefault();
            if (!picker.value || !workspaceClock) return;
            const drink = picks[Number(picker.value)];
            const previous = retry?.request.operation;
            const time = previous?.kind === "drink" && previous.name === drink.name && previous.mg === drink.mg
                ? previous.time : workspaceClock.serverTime + Math.floor((performance.now() - workspaceClock.elapsedAt) / 1000);
            void submitChange({ kind: "drink", name: drink.name, mg: drink.mg, time });
        });
        customForm.addEventListener("submit", event => {
            event.preventDefault();
            const name = customForm.elements.name.value.trim();
            if (!name || new TextEncoder().encode(name).length > 64) {
                setChangeStatus("Enter a drink name of up to 64 UTF-8 bytes.");
                return;
            }
            void submitChange({ kind: "custom", name, mg: Number(customForm.elements.mg.value) });
        });
        settingForm.addEventListener("submit", event => {
            event.preventDefault();
            const field = settingForm.elements.field.value;
            const expected = settingFields(workspaceSnapshot).find(item => item[0] === field)[2];
            const raw = settingForm.elements.desired.value;
            let value = Number(raw);
            if (field === "smartSorting") value = raw === "true";
            else if (field === "thresholdTenths") value = Math.round(value * 10);
            else if (field === "bedtimeOverrideMinutes") {
                const [hours, minutes] = raw.split(":").map(Number);
                value = raw ? hours * 60 + minutes : null;
            }
            if (value === expected) { setChangeStatus("Choose a different value to send."); return; }
            void submitChange({ kind: "setting", field, expected, value });
        });

        function showPane(name) {
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
            today.hidden = true;
            content.hidden = true;
            events.replaceChildren();
            historyDays.replaceChildren();
            historyDay.replaceChildren();
            historyNote.textContent = "";
            values.replaceChildren();
            settingsNote.textContent = "";
            history = [];
            writable = false;
            workspaceSnapshot = workspaceClock = retry = null;
            busyChange = false;
            for (const form of changeForms) form.reset();
            picker.replaceChildren(new Option("Choose a drink", ""));
            customList.replaceChildren();
            customNote.hidden = true;
            customNote.textContent = "";
            settingValue.replaceChildren();
            picks = [];
            showChange(null);
            showPane("today");
            events.dataset.collapsed = "true";
            updateHistoryButton();
            graph.replaceChildren();
            graphState = null;
            lastRead = -Infinity;
            estimate.textContent = "";
            scrub.removeAttribute("aria-valuetext");
            status.textContent = "";
            document.getElementById("today-title").textContent = "Today";
            document.getElementById("today-day").textContent = "";
            privacy.textContent = purchaseNote;
            document.getElementById("today-reading").textContent = "";
            document.getElementById("today-captured").textContent = "";
            settings.elements.halfLifeMinutes.replaceChildren();
            settings.elements.absorptionMinutes.replaceChildren();
            settings.elements.belowAtThresholdMgPerL.defaultValue = "";
            settings.elements.belowAtThresholdMgPerL.value = "";
            settings.closest("details").open = true;
            changes.textContent = "";
            model = null;
            refresh.disabled = false;
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
                dict: { thresholdStimulated: "Stimulated", thresholdHigh: "High", thresholdMax: "Max" },
                ariaLabel: "Estimated caffeine level by watch time. Solid for elapsed time, dashed for projected time.",
            });
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
                heading.textContent = day.date + (day.usesWatchTime ? " · Watch time" : " · UTC");
                const total = document.createElement("p");
                total.className = "detail";
                total.textContent = day.entries.length + (day.entries.length === 1 ? " entry" : " entries") +
                    " · " + dose(day.total) + " logged";
                const list = document.createElement("ul");
                list.className = "drink-list";
                list.append(...day.entries.map(entry => drinkRow(entry.time, entry.mg, entry.scheduled)));
                group.append(heading, total, list);
                historyDays.append(group);
            }
        }
        historyDay.addEventListener("change", renderHistory);

        function renderSettings(snapshot) {
            const settings = snapshot.watchSettings;
            const clock = minutes => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" +
                String(minutes % 60).padStart(2, "0");
            const items = [
                ["Caffeine half-life", snapshot.model.halfLifeMinutes + " min"],
                ["Absorption time", snapshot.model.absorptionMinutes + " min"],
                ["Personal threshold", snapshot.model.belowAtThresholdMgPerL.toLocaleString() + " mg/L"],
                ["Effective model volume", snapshot.model.apparentVolumeLiters.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " L"],
            ];
            if (settings) items.push(
                ["Bedtime", clock(settings.effectiveBedtimeMinutes) +
                    (settings.bedtimeOverrideMinutes === null ? " · profile or watch default" : " · watch override")],
                ["Bedtime buffer", settings.bedtimeBufferMinutes + " min"],
                ["Sort drinks by use", settings.smartSorting ? "On" : "Off"],
                ["Watch background refresh", settings.backgroundIntervalMinutes + " min"],
            );
            values.replaceChildren();
            for (const [label, value] of items) {
                const item = document.createElement("div");
                const name = document.createElement("dt");
                const observed = document.createElement("dd");
                name.textContent = label;
                observed.textContent = value;
                item.append(name, observed);
                values.append(item);
            }
            settingsNote.textContent = settings
                ? "Background refresh updates the watch’s local display and complication."
                : snapshot.schemaVersion === 1
                    ? "A newer watch build can also share bedtime, bedtime buffer, drink sorting and background refresh."
                    : "Additional settings were unavailable in this watch snapshot.";
        }

        function renderToday(data) {
            if (!data.snapshot) {
                clearToday();
                today.hidden = false;
                status.textContent = "No recent snapshot. Open Today from your watch to sync.";
                return;
            }
            const { watchDay, watchDisplay, capturedAt } = data.snapshot;
            const clockSkew = Math.abs(data.receivedAt - capturedAt) > 600;
            const pastDay = data.serverTime >= watchDay.endSec;
            const stale = data.serverTime - data.receivedAt >= 7200 || pastDay;
            const synced = new Date(data.receivedAt * 1000).toLocaleString();
            document.getElementById("today-title").textContent = pastDay ? "Last watch day" : "Today";
            document.getElementById("today-day").textContent = watchDay.date;
            status.textContent = (clockSkew ? "Watch time differs from server time. " : stale ? "Stale snapshot. " : "") +
                "Last synced " + synced + ".";
            document.getElementById("today-reading").textContent = watchDisplay.cachedLevelMgPerL === null
                ? "No cached reading from the watch" : watchDisplay.cachedLevelMgPerL.toFixed(2) + " mg/L";
            document.getElementById("today-captured").textContent = watchDisplay.cachedAt === null
                ? "Snapshot captured " + new Date(capturedAt * 1000).toLocaleString()
                : "Watch’s cached reading from " + new Date(watchDisplay.cachedAt * 1000).toLocaleString();
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
                events.append(drinkRow(watchTime(event.time, watchDay.offsetSegments), event.mg, event.time > reference));
            }
            const previousDay = historyDay.value;
            history = retainedHistory(data.snapshot, reference);
            historyDay.replaceChildren(new Option("All retained days", ""), ...history.map(day =>
                new Option(day.date + (day.usesWatchTime ? "" : " UTC"), day.key)));
            if (history.some(day => day.key === previousDay)) historyDay.value = previousDay;
            historyNote.textContent = "Time and caffeine amount for entries still stored on your watch. " +
                (data.snapshot.schemaVersion === 1 ? "Earlier dates are shown in UTC." : "Times follow the watch’s time zone.");
            renderHistory();
            renderSettings(data.snapshot);
            updateHistoryButton();
            const previousModel = model;
            model = data.snapshot.model;
            if (previousModel &&
                previousModel.halfLifeMinutes === model.halfLifeMinutes &&
                previousModel.absorptionMinutes === model.absorptionMinutes &&
                previousModel.belowAtThresholdMgPerL === model.belowAtThresholdMgPerL) return;
            for (const [key, values] of [["halfLifeMinutes", [180, 240, 300, 360, 480, 600]], ["absorptionMinutes", [20, 30, 45, 60]]]) {
                const select = settings.elements[key];
                const choices = Array.from(new Set([...values, model[key]])).sort((a, b) => a - b);
                select.replaceChildren(...choices.map(value => new Option(value + " min", String(value), value === model[key], value === model[key])));
            }
            const threshold = settings.elements.belowAtThresholdMgPerL;
            threshold.defaultValue = model.belowAtThresholdMgPerL.toFixed(1);
            threshold.value = threshold.defaultValue;
            changes.textContent = "Matches the watch snapshot.";
            content.hidden = false;
        }

        async function loadToday(current) {
            if (refresh.disabled) return;
            refresh.disabled = true;
            action.disabled = true;
            try {
                const data = await client.today();
                if (generation !== current || !session || data === null) return;
                lastRead = Date.now();
                today.hidden = false;
                detail.textContent = "Latest snapshot from your watch.";
                const changes = data.snapshot?.schemaVersion === 3 ? await client.changes() : null;
                if (generation !== current || !session) return;
                writable = changes !== null;
                renderToday(data);
                if (data.snapshot) renderWorkspace(data.snapshot, data.serverTime);
                if (writable) showChange(changes.change);
                privacy.textContent = "This session shows a temporary copy of recent entries and settings from your watch. " + purchaseNote;
            } catch (error) {
                if (generation !== current || !session) return;
                if (error.message === "expired") { problem("expired"); return; }
                today.hidden = false;
                status.textContent = "Couldn’t load Today. Try Refresh.";
            } finally {
                if (generation === current) {
                    action.disabled = false;
                    refresh.disabled = false;
                }
            }
        }
        refresh.addEventListener("click", () => { if (session) void loadToday(generation); });
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && session?.destination === "today" && Date.now() - lastRead >= 15000) {
                void loadToday(generation);
            }
        });
        settings.addEventListener("submit", event => event.preventDefault());
        settings.addEventListener("reset", () => { changes.textContent = "Matches the watch snapshot."; });
        settings.addEventListener("input", () => {
            if (!model) return;
            if (!settings.checkValidity()) { changes.textContent = "Enter a threshold from 0.1 to 1.5 mg/L."; return; }
            const fields = [
                ["Half-life", "halfLifeMinutes", "min", model.halfLifeMinutes],
                ["Absorption", "absorptionMinutes", "min", model.absorptionMinutes],
                ["Threshold", "belowAtThresholdMgPerL", "mg/L", Number(model.belowAtThresholdMgPerL.toFixed(1))],
            ];
            const edits = fields.flatMap(([label, key, unit, initial]) => {
                const value = Number(settings.elements[key].value);
                return value === initial ? [] : [label + " " + initial + " → " + value + " " + unit];
            });
            changes.textContent = edits.length ? edits.join(" · ") : "Matches the watch snapshot.";
        });

        function show(state, heading, text, extra = "") {
            badge.textContent = state; title.textContent = heading; message.textContent = text; detail.textContent = extra;
            action.hidden = state !== "Connected"; action.disabled = false;
        }
        function problem(code) {
            clearTimeout(expiryTimer); session = null;
            clearToday();
            const expired = code === "expired";
            show(expired ? "Session ended" : "Connection unavailable", expired ? "Open again from your watch" : "We couldn’t connect",
                code === "invalid_link" ? "This connection link is incomplete. Open a new link from Caffeine Tracker on your watch." :
                code === "rate_limited" ? "Please wait a minute, then open a new connection from your watch." :
                expired ? "For your privacy, watch access ends after ten minutes or when you disconnect." :
                "Open a new connection from your watch when the companion is available.");
        }
        function connected(data, current) {
            session = data; handoff = null;
            show("Connected", "Your watch is connected", "Your watch is connected for up to ten minutes. No account needed.", "Watch data and settings are not available in this preview.");
            expiryTimer = setTimeout(() => { if (generation === current) problem("expired"); }, Math.max(0, (data.expiresAt - data.serverTime) * 1000));
            if (data.destination === "today") void loadToday(current);
        }
        action.addEventListener("click", async () => {
            if (!session) return;
            action.disabled = true; const current = generation;
            try { await client.logout(); if (generation !== current) return; clearTimeout(expiryTimer); session = null; clearToday(); show("Disconnected", "You’re disconnected", "Open Caffeine Tracker on your watch to connect again."); }
            catch { if (generation !== current) return; action.disabled = false; detail.textContent = "Couldn’t disconnect. Please try again; access still ends at the original expiry time."; }
        });
        root.addEventListener("pagehide", () => { generation += 1; clearTimeout(expiryTimer); handoff = null; clearToday(); if (client) client.close(); });
        // BFCache must revalidate; neither cached DOM nor an old promise proves access.
        root.addEventListener("pageshow", event => { if (event.persisted) root.location.reload(); });
        async function begin(token, linkFailure) {
        const current = ++generation;
        clearTimeout(expiryTimer); session = null;
        clearToday();
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
                }
            } else data = await client.resume();
            if (generation === current) connected(data, current);
        } catch (error) { if (generation === current) { handoff = null; problem(linkFailure || error.message); } }
        }
        root.addEventListener("hashchange", () => {
            try { const token = takeHandoff(root.location, root.history); if (token) void begin(token); }
            catch (error) { void begin(null, error.message); }
        });
        await begin(handoff, linkError);
    });
})(typeof window === "undefined" ? globalThis : window);
