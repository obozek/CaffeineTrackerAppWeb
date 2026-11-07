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
            snapshot?.schemaVersion !== 1 || !unix(snapshot.capturedAt) ||
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
        return data;
    }

    function watchTime(seconds, segments) {
        let offset = segments[0].offsetSeconds;
        for (const segment of segments) {
            if (seconds < segment.fromSec) break;
            offset = segment.offsetSeconds;
        }
        return new Date((seconds + offset) * 1000).toISOString().slice(11, 16);
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
                if (response.status === 404 && path === "/v1/guest/today") return null;
                if (!response.ok) throw new Error(response.status === 401 ? "expired" : response.status === 429 ? "rate_limited" : "unavailable");
                if (response.status === 204) return null;
                const data = await response.json();
                if (closed) throw new Error("unavailable");
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
            logout: () => request("/v1/guest/session", "DELETE", {}),
            close: () => { closed = true; if (controller) controller.abort(); }
        };
    }
    const exported = { takeHandoff, createClient, readToday, watchTime };
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
        let model, graphState, lastRead = -Infinity;

        function clearToday() {
            today.hidden = true;
            content.hidden = true;
            events.replaceChildren();
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
            settings.closest("details").open = false;
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
                dict: { thresholdStimulated: "Sleep", thresholdHigh: "High", thresholdMax: "Max" },
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
                const row = document.createElement("li");
                const time = document.createElement("span");
                time.textContent = watchTime(event.time, watchDay.offsetSegments) + (event.time > reference ? " · scheduled" : "");
                const amount = document.createElement("strong");
                amount.textContent = event.mg.toLocaleString(undefined, { maximumFractionDigits: 3 }) + " mg";
                row.append(time, amount);
                events.append(row);
            }
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
                detail.textContent = "Read-only snapshot from your watch.";
                renderToday(data);
                privacy.textContent = "Today shows a temporary read-only copy from your watch. " + purchaseNote;
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
