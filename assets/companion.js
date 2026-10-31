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
                    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
                if (closed) throw new Error("unavailable");
                if (!response.ok) throw new Error(response.status === 401 ? "expired" : response.status === 429 ? "rate_limited" : "unavailable");
                if (response.status === 204) return null;
                const data = await response.json();
                if (closed) throw new Error("unavailable");
                if (data.protocolVersion !== 1 || data.appId !== "caffeine" || !destinations.includes(data.destination) ||
                    !Number.isSafeInteger(data.serverTime) || data.serverTime < 0 || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= data.serverTime || data.expiresAt > data.serverTime + 600) throw new Error("invalid_response");
                return data;
            } finally { clearTimeout(timer); active = false; controller = null; }
        }
        return {
            redeem: handoff => request("/v1/guest/redeem", "POST", handoff),
            resume: () => request("/v1/guest/session", "GET"),
            logout: () => request("/v1/guest/session", "DELETE", {}),
            close: () => { closed = true; if (controller) controller.abort(); }
        };
    }
    const exported = { takeHandoff, createClient };
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
        function show(state, heading, text, extra = "") {
            badge.textContent = state; title.textContent = heading; message.textContent = text; detail.textContent = extra;
            action.hidden = state !== "Connected"; action.disabled = false;
        }
        function problem(code) {
            clearTimeout(expiryTimer); session = null;
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
        }
        action.addEventListener("click", async () => {
            if (!session) return;
            action.disabled = true; const current = generation;
            try { await client.logout(); if (generation !== current) return; clearTimeout(expiryTimer); session = null; show("Disconnected", "You’re disconnected", "Open Caffeine Tracker on your watch to connect again."); }
            catch { if (generation !== current) return; action.disabled = false; detail.textContent = "Couldn’t disconnect. Please try again; access still ends at the original expiry time."; }
        });
        root.addEventListener("pagehide", () => { generation += 1; clearTimeout(expiryTimer); handoff = null; if (client) client.close(); });
        // BFCache must revalidate; neither cached DOM nor an old promise proves access.
        root.addEventListener("pageshow", event => { if (event.persisted) root.location.reload(); });
        async function begin(token) {
        const current = ++generation;
        clearTimeout(expiryTimer); session = null;
        if (client) client.close();
        show("Connecting", "Connecting to your watch", "Please keep this page open for a moment.");
        try {
            client = createClient(root.CaffeineCompanionConfig || { enabled: false, apiOrigin: "https://worker.caffeinetracker.app" }, root.fetch.bind(root));
            let data;
            if (token) {
                try { data = await client.redeem(token); }
                catch (error) {
                    // The cookie may have been committed before a response was lost.
                    if (error.message !== "unavailable" && error.name !== "AbortError" && !(error instanceof TypeError)) throw error;
                    data = await client.resume();
                }
            } else data = await client.resume();
            if (generation === current) connected(data, current);
        } catch (error) { if (generation === current) { handoff = null; problem(error.message); } }
        }
        root.addEventListener("hashchange", () => {
            try { const token = takeHandoff(root.location, root.history); if (token) void begin(token); }
            catch (error) { generation += 1; if (client) client.close(); problem(error.message); }
        });
        if (linkError) { problem(linkError); return; }
        await begin(handoff);
    });
})(typeof window === "undefined" ? globalThis : window);
