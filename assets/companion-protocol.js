// Caffeine companion wire validation, request recovery and record projections.
// No DOM, browser storage or standalone tracker state is owned here.
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
    const uuid = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
    const revision = value => Number.isInteger(value) && value >= 1 && value <= 2147483647;
    const sharedName = value => typeof value === "string" && new TextEncoder().encode(value).length <= 256;
    const changeKinds = ["drink", "custom", "setting", "eventUpdate", "eventDelete", "customUpdate", "customDelete", "customReorder"];
    function calendarDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + "T00:00:00Z");
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    function snapshotAfter(snapshot, afterSequence) {
        return Number.isSafeInteger(snapshot?.snapshotSequence) && snapshot.snapshotSequence > 0 &&
            Number.isSafeInteger(afterSequence) && afterSequence >= 0 && snapshot.snapshotSequence > afterSequence;
    }

    // Retain one immutable request until its exact receipt is known. Checking
    // before retrying is useful feedback; retrying the same ID is what makes
    // a late server commit safe, even when the user has edited another draft.
    function createSaveRecovery(createId) {
        let attempt = null;
        function freeze(value) {
            if (value && typeof value === "object") {
                Object.values(value).forEach(freeze);
                Object.freeze(value);
            }
            return value;
        }
        return {
            get pending() { return attempt !== null; },
            get canRetry() { return attempt?.checked === true; },
            get attempt() { return attempt; },
            prepare(operation, draftKey, priorCount, writeEpoch) {
                const key = JSON.stringify(operation);
                if (attempt && attempt.key !== key) throw new Error("save_uncertain");
                if (!attempt) attempt = { key, draftKey, priorCount, checked: false,
                    request: Object.freeze({ id: createId(), operation: freeze(JSON.parse(key)),
                        ...(writeEpoch ? { writeEpoch } : {}) }) };
                attempt.checked = false;
                return attempt;
            },
            resolve(change) { if (change?.id === attempt?.request.id) attempt = null; },
            checked(change) {
                if (!attempt) return;
                if (change?.id === attempt.request.id) attempt = null;
                else attempt.checked = !["queued", "offered", "interrupted", "unconfirmed"].includes(change?.state);
            },
            clear() { attempt = null; },
        };
    }

    function readToday(data) {
        if (!data || !unix(data.serverTime)) throw new Error("invalid_response");
        if (data.sessionId !== undefined && !uuid(data.sessionId)) throw new Error("invalid_response");
        if (data.snapshot === null && data.receivedAt === null && data.expiresAt === null) return data;
        const snapshot = data.snapshot;
        const day = snapshot?.watchDay;
        const display = snapshot?.watchDisplay;
        const model = snapshot?.model;
        if (!unix(data.receivedAt) || !unix(data.expiresAt) || data.expiresAt <= data.serverTime ||
            ![1, 2, 3, 4, 5].includes(snapshot?.schemaVersion) || !unix(snapshot.capturedAt) ||
            !day || !calendarDate(day.date) || !unix(day.startSec) || day.endSec !== day.startSec + 86400 ||
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
        if (snapshot.schemaVersion >= 3 && (!Array.isArray(snapshot.availablePresets) ||
            snapshot.availablePresets.length > 7 || snapshot.availablePresets.some(name => typeof name !== "string"))) {
            throw new Error("invalid_response");
        }
        if (snapshot.schemaVersion >= 3 && snapshot.customDrinks !== null &&
            (!Array.isArray(snapshot.customDrinks) || snapshot.customDrinks.length > 32 ||
                snapshot.customDrinks.some(drink => snapshot.schemaVersion === 5
                    ? !sharedName(drink?.name) || !finite(drink.mg) || drink.mg < 0 || drink.mg > 100000
                    : typeof drink?.name !== "string" || !Number.isInteger(drink.mg) || drink.mg < 0 || drink.mg > 500))) {
            throw new Error("invalid_response");
        }
        if (snapshot.schemaVersion >= 4 && ((snapshot.futureDrinkSeconds !== undefined && snapshot.futureDrinkSeconds !== 86400) ||
            !validDrinkOrder(snapshot) ||
            snapshot.sync?.foregroundIntervalSeconds !== 60 ||
            ![null, 5].includes(snapshot.sync.backgroundIntervalMinutes))) throw new Error("invalid_response");
        if (snapshot.schemaVersion === 5 && ((!Number.isSafeInteger(snapshot.snapshotSequence) || snapshot.snapshotSequence < 1) ||
            snapshot.events.some(event => !uuid(event.id) || !revision(event.revision) || !sharedName(event.name) || event.mg > 100000) ||
            new Set(snapshot.events.map(event => event.id)).size !== snapshot.events.length ||
            (snapshot.customDrinks !== null && (snapshot.customDrinks.some(drink => !uuid(drink.id) || !revision(drink.revision)) ||
                new Set(snapshot.customDrinks.map(drink => drink.id)).size !== snapshot.customDrinks.length)))) throw new Error("invalid_response");
        return data;
    }

    function validDrinkOrder(snapshot) {
        if (snapshot.customDrinks === null) return snapshot.drinkOrder === null;
        const count = snapshot.availablePresets.length + snapshot.customDrinks.length;
        const order = snapshot.drinkOrder;
        return Array.isArray(order) && order.length === count && new Set(order).size === count &&
            order.every(index => Number.isInteger(index) && index >= 0 && index < count);
    }

    function watchDrinks(snapshot, presets) {
        const drinks = [...snapshot.availablePresets.map(name => presets.find(drink => drink.name === name)),
            ...(snapshot.customDrinks || [])];
        const order = snapshot.schemaVersion >= 4 ? snapshot.drinkOrder : null;
        return (order ? order.map(index => drinks[index]) : drinks).filter(Boolean);
    }

    const authoredName = name => typeof name === "string" && name.length > 0 && name === name.trim() &&
        new TextEncoder().encode(name).length <= 64 && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
    const authoredAmount = mg => Number.isInteger(mg) && mg >= 0 && mg <= 500;
    function recordName(record) {
        const name = record?.name;
        // A display fallback must never normalize the retained watch literal.
        return typeof name === "string" && /[^\s\u0000-\u001f\u007f-\u009f]/u.test(name) ? name : "Unnamed drink";
    }
    function loggableDrink(drink) { return Boolean(drink && authoredName(drink.name) && authoredAmount(drink.mg)); }
    function authoredDrink(values) {
        const name = typeof values.name === "string" ? values.name.trim() : "";
        const mg = Number(values.mg);
        if (!authoredName(name)) throw new Error("invalid_name");
        if (!["string", "number"].includes(typeof values.mg) || !authoredAmount(mg) || String(values.mg).trim() === "") throw new Error("invalid_amount");
        return { name, mg };
    }

    function drinkTime(value, now, futureSeconds = 0) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("invalid_time");
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || localDateTime(date) !== value) throw new Error("invalid_time");
        const seconds = date.getTime() / 1000;
        if (seconds < now - 172800 || seconds > now + futureSeconds) throw new Error("time_range");
        return seconds;
    }

    function localDateTime(date) {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }

    // Only changed fields cross the wire. Historic values can predate current
    // authoring limits, and a minute picker must not erase original seconds.
    function recordPatch(original, values, now, futureSeconds, baseline = {}) {
        const patch = {};
        // Native text inputs can remove legacy CR/LF while prefilling. Compare
        // with the displayed baseline, retaining the original SDK literal.
        const name = values.name === (baseline.name ?? original.name) ? original.name : values.name.trim();
        if (name !== original.name) {
            if (!authoredName(name)) throw new Error("invalid_name");
            patch.name = name;
        }
        const mg = Number(values.mg);
        if (mg !== original.mg || values.mg.trim() === "") {
            if (!authoredAmount(mg) || values.mg.trim() === "") throw new Error("invalid_amount");
            patch.mg = mg;
        }
        if (values.time !== undefined && values.time !== (baseline.time ?? localDateTime(new Date(original.time * 1000)))) {
            patch.time = drinkTime(values.time, now, futureSeconds);
        }
        return patch;
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
            group.entries.push({ time, mg: event.mg, scheduled, ...(schemaVersion >= 5 ? { record: event } : {}) });
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
            const exactChange = path.startsWith("/v1/guest/changes/") && uuid(path.slice("/v1/guest/changes/".length));
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const response = await fetcher(api.origin + path, { method, credentials: "include", cache: "no-store", signal: controller.signal,
                    headers: { "X-Caffeine-Companion": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
                if (closed) throw new Error("unavailable");
                if (response.status === 404 && ["/v1/guest/today", "/v1/guest/changes", "/v1/guest/changes/reconcile"].includes(path)) return null;
                if (response.status === 409) {
                    let failure;
                    try { failure = await response.json(); } catch { /* Older servers may omit a JSON error. */ }
                    throw new Error(failure?.error === "stale_write_session" ? "stale_write_session" : "change_conflict");
                }
                if (path === "/v1/guest/changes" && method === "POST" && [400, 413].includes(response.status)) throw new Error("invalid_change");
                if (!response.ok) throw new Error(response.status === 401 ? "expired" : response.status === 429 ? "rate_limited" : "unavailable");
                if (response.status === 204) return null;
                const data = await response.json();
                if (closed) throw new Error("unavailable");
                if (path === "/v1/guest/changes" || path === "/v1/guest/changes/reconcile" || exactChange) {
                    if (!data || (data.sessionId !== undefined && !uuid(data.sessionId)) || (data.change !== null && (!data.change || !uuid(data.change.id) ||
                        !changeKinds.includes(data.change.kind) ||
                        !["queued", "offered", "applied", "conflict", "premium", "invalid", "interrupted", "expired", "unconfirmed"].includes(data.change.state) ||
                        (data.change.afterSequence !== undefined && (data.change.state !== "applied" ||
                            !Number.isSafeInteger(data.change.afterSequence) || data.change.afterSequence < 0))))) {
                        throw new Error("invalid_response");
                    }
                    if (path.endsWith("/reconcile")) {
                        if (!uuid(data.writeEpoch) || !uuid(data.sessionId)) throw new Error("invalid_response");
                    } else if (method === "POST" && (data.change?.id !== body.id || data.change.kind !== body.operation.kind)) throw new Error("invalid_response");
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
            changes: (id = null) => request("/v1/guest/changes" + (id ? "/" + id : ""), "GET"),
            reconcile: () => request("/v1/guest/changes/reconcile", "POST", {}),
            sendChange: change => request("/v1/guest/changes", "POST", change),
            logout: () => request("/v1/guest/session", "DELETE", {}),
            close: () => { closed = true; if (controller) controller.abort(); }
        };
    }
    const exported = { takeHandoff, createClient, readToday, watchTime, retainedHistory, watchDrinks, drinkTime, createSaveRecovery, recordName, recordPatch, localDateTime, loggableDrink, authoredDrink, snapshotAfter, isId: uuid };
    if (typeof module !== "undefined" && module.exports) { module.exports = exported; return; }
    root.CaffeineCompanionProtocol = Object.freeze(exported);
})(typeof window === "undefined" ? globalThis : window);
