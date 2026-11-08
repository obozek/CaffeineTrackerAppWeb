(() => {
    "use strict";
    const core = window.CaffeineTrackerCore;
    const graphUI = window.CaffeineTrackerGraph;
    const screen = document.querySelector("#screen");
    const navigation = document.querySelector("#navigation");
    const notice = document.querySelector("#notice");
    const dialog = document.querySelector("#editor");
    const editor = document.querySelector("#editor-form");
    const storageKey = "caffeine.companion.workspace.preview.v1";
    const tabs = [
        ["today", "◷", "Today"], ["log", "+", "Add drink"], ["history", "≡", "History"],
        ["drinks", "◇", "My drinks"], ["settings", "⚙", "Settings"],
    ];
    const formatTime = time => new Date(time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const formatDate = time => new Date(time * 1000).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const number = value => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const escape = graphUI.escapeHtml;
    const localDateTime = time => {
        const date = new Date(time * 1000);
        return new Date((time - date.getTimezoneOffset() * 60) * 1000).toISOString().slice(0, 16);
    };
    const newId = () => crypto.randomUUID();
    const localTime = (day, hour, minute = 0) => {
        const date = new Date(day * 1000);
        date.setHours(hour, minute, 0, 0);
        return date.getTime() / 1000;
    };

    const defaultSettings = { halfLifeMinutes: 300, absorptionMinutes: 20, threshold: 0.6,
        bedtimeMinutes: 1380, bedtimeBufferMinutes: 60, smartSorting: true };
    const bedtimeClock = minutes => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" +
        String(minutes % 60).padStart(2, "0");

    function seed() {
        const day = core.localDayStartSec(core.nowSec());
        return {
            drinks: [{ id: newId(), name: "My cold brew", mg: 130 }],
            events: [
                [-1, 17, 30, "Black tea", 45], [0, 7, 40, "Espresso", 64],
                [0, 9, 20, "Brewed coffee", 95], [0, 13, 5, "My cold brew", 130],
                [0, 16, 15, "Green tea", 30],
            ].map(([offset, hour, minute, name, mg]) => ({
                id: newId(), time: localTime(day + offset * 86400, hour, minute), name, mg,
            })),
            settings: { ...defaultSettings },
        };
    }
    function validRecord(entry) {
        return entry && typeof entry.id === "string" &&
            /^[a-f0-9-]{36}$/.test(entry.id) && typeof entry.name === "string" &&
            entry.name.trim() === entry.name && entry.name.length > 0 && entry.name.length <= 48 &&
            Number.isFinite(entry.mg) && entry.mg >= 0 && entry.mg <= 500;
    }

    function validSettings(settings) {
        return [180, 240, 300, 360, 480, 600].includes(settings.halfLifeMinutes) &&
            [20, 30, 45, 60].includes(settings.absorptionMinutes) &&
            Number.isFinite(settings.threshold) && settings.threshold >= 0.1 && settings.threshold <= 1.5 &&
            Number.isInteger(settings.bedtimeMinutes) && settings.bedtimeMinutes >= 0 && settings.bedtimeMinutes < 1440 &&
            [0, 30, 60, 90, 120].includes(settings.bedtimeBufferMinutes) && typeof settings.smartSorting === "boolean";
    }

    function load() {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey));
            if (stored && Array.isArray(stored.events) && Array.isArray(stored.drinks)) {
                const settings = { ...defaultSettings, ...stored.settings };
                if (stored.events.every(entry => validRecord(entry) &&
                    Number.isInteger(entry.time) && entry.time >= 0 && entry.time <= 0xffffffff) &&
                    stored.drinks.every(validRecord) && validSettings(settings)) {
                    return { events: stored.events, drinks: stored.drinks, settings };
                }
            }
        } catch { /* The demo can run in memory if browser storage is unavailable. */ }
        return seed();
    }
    let state = load();
    let tab = "today";
    let edit = null;
    let historyDay = "";
    let noticeTimer;
    function save(message) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch { message += " Browser storage is unavailable."; }
        notice.textContent = message;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { notice.textContent = ""; }, 4500);
    }

    const button = (label, action, className = "quiet") =>
        `<button type="button" class="${className}" data-action="${action}">${label}</button>`;
    const heading = (title, note, action = "") =>
        `<div class="screen-head"><div><h1 id="screen-title" tabindex="-1">${title}</h1><p class="sub">${note}</p></div>${action}</div>`;
    const field = (label, control, note = "") =>
        `<label class="field">${label}${control}${note ? `<small>${note}</small>` : ""}</label>`;
    const drinkFields = (entry, date = false) => `<div class="form-grid">
        ${field("Drink name", `<input name="name" maxlength="48" autocomplete="off" required value="${escape(entry.name)}">`)}
        ${field("Caffeine (mg)", `<input name="mg" type="number" min="0" max="500" step="0.1" required value="${entry.mg}">`)}
        ${date ? field("Date and time", `<input name="time" type="datetime-local" required value="${localDateTime(entry.time)}">`) : ""}
    </div>`;
    const sortedEvents = () => [...state.events].sort((a, b) => b.time - a.time);
    const options = (values, selected) => values.map(value =>
        `<option value="${value}"${value === selected ? " selected" : ""}>${value} min</option>`).join("");
    const record = (entry, kind, extra) => `<li class="row">
        <div><strong>${escape(entry.name)}</strong>${extra ? `<small>${extra}</small>` : ""}</div>
        <div class="actions"><span class="dose">${number(entry.mg)} mg</span>
        ${kind ? `<button type="button" class="quiet" data-edit="${kind}" data-id="${entry.id}" aria-label="Edit ${escape(entry.name)}">Edit</button>` : ""}</div>
    </li>`;
    const list = (entries, renderEntry, empty) => entries.length
        ? `<ul class="list">${entries.map(renderEntry).join("")}</ul>`
        : `<p class="empty">${empty}</p>`;

    function today() {
        const now = core.nowSec();
        const start = core.localDayStartSec(now);
        const end = core.localDayEndSec(start);
        const rows = sortedEvents().filter(entry => entry.time >= start && entry.time < end);
        const logged = rows.filter(entry => entry.time <= now);
        const scheduled = rows.length - logged.length;
        const { halfLifeMinutes, absorptionMinutes, threshold } = state.settings;
        const data = core.graphFromWatchSnapshot({
            watchDay: { startSec: start, endSec: end }, events: state.events,
            model: { halfLifeMinutes, absorptionMinutes, apparentVolumeLiters: 49, belowAtThresholdMgPerL: threshold },
        }, now);
        const chart = graphUI.renderGraph(data, {
            startSec: start, endSec: end, nowSec: now,
            formatTime: time => new Date(time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
            dict: { thresholdStimulated: "Sleep", thresholdHigh: "High", thresholdMax: "Max" },
            compact: matchMedia("(max-width: 690px)").matches,
            ariaLabel: "Estimated caffeine through the day. Dashed line shows projected levels.",
        });
        const metric = (label, value, unit, note) => `<div class="card"><span class="metric-label">${label}</span>
            <strong class="metric-value">${value} <span>${unit}</span></strong><small class="metric-note">${note}</small></div>`;
        screen.innerHTML = heading("Today", formatDate(now), button("＋ Add drink", "log", "primary")) +
            `<div class="metrics">
                ${metric("Estimated now", data.levelAt(now).toFixed(2), "mg/L", "From your log")}
                ${metric("Caffeine logged", number(logged.reduce((sum, entry) => sum + entry.mg, 0)), "mg", logged.length + (logged.length === 1 ? " drink" : " drinks"))}
                ${metric("Planned", scheduled, scheduled === 1 ? "drink" : "drinks", "Later today")}
            </div>
            <section class="card graph-card" aria-labelledby="curve-title"><div class="section-head"><h2 id="curve-title">Caffeine level</h2><span class="tag">Today</span></div>
                <div class="graph-shell">${chart}</div>
                <label class="scrub-label" for="scrub">Explore the curve <output for="scrub" id="scrub-value"></output></label>
                <input class="scrub" id="scrub" type="range" min="0" max="${(end - start) / 60}" value="${Math.floor((now - start) / 60)}">
                <p class="legend">Solid line · elapsed time &nbsp; Dashed line · projection &nbsp; Dots · drinks</p>
            </section>
            <section class="card" aria-labelledby="recent-title"><div class="section-head"><h2 id="recent-title">Today’s drinks</h2>${button("View history", "history")}</div>
            ${list(rows.slice(0, 5), entry => record(entry, "", formatTime(entry.time) + (entry.time > now ? " · Scheduled" : "")), "No drinks recorded for today.")}</section>`;
        const scrub = screen.querySelector("#scrub");
        const cursor = screen.querySelector(".ct-graph-cursor");
        function inspect() {
            const time = start + Number(scrub.value) * 60;
            const x = Number(cursor.dataset.plotStart) + Number(cursor.dataset.plotWidth) * Number(scrub.value) / Number(scrub.max);
            const label = formatTime(time) + " · " + data.levelAt(time).toFixed(2) + " mg/L";
            screen.querySelector("#scrub-value").textContent = label;
            scrub.setAttribute("aria-valuetext", label);
            cursor.setAttribute("x1", x);
            cursor.setAttribute("x2", x);
        }
        scrub.addEventListener("input", inspect);
        inspect();
    }

    function log() {
        const presets = [...core.PRESET_DRINKS, ...state.drinks];
        if (state.settings.smartSorting) {
            const usage = new Map();
            for (const entry of state.events) usage.set(entry.name, (usage.get(entry.name) || 0) + 1);
            presets.sort((a, b) => (usage.get(b.name) || 0) - (usage.get(a.name) || 0));
        }
        screen.innerHTML = heading("Add drink", "Pick a usual drink or enter a one-off amount.") +
            `<div class="stack"><section class="card"><h2>Quick pick</h2><div class="presets">
                ${presets.map((preset, index) => `<button type="button" class="preset" data-preset="${index}" aria-pressed="false">${escape(preset.name)}<small>${preset.mg} mg</small></button>`).join("")}
            </div></section>
            <form class="card" data-form="log"><h2>Drink details</h2>${drinkFields({ name: "", mg: 60, time: core.nowSec() }, true)}
                <button class="primary" type="submit">Log drink</button>
            </form></div>`;
        const form = screen.querySelector("form");
        screen.querySelectorAll("[data-preset]").forEach(element => element.addEventListener("click", () => {
            const preset = presets[Number(element.dataset.preset)];
            form.elements.name.value = preset.name;
            form.elements.mg.value = preset.mg;
            screen.querySelectorAll("[data-preset]").forEach(pick => pick.setAttribute("aria-pressed", String(pick === element)));
        }));
    }

    function history() {
        const entries = sortedEvents().filter(entry => !historyDay || localDateTime(entry.time).slice(0, 10) === historyDay);
        screen.innerHTML = heading("History", "Review your log by day, or correct an entry.") +
            `<section class="card"><div class="section-head"><h2>Drink log</h2>
            ${field("Filter by date", `<input id="history-day" type="date" value="${escape(historyDay)}">`)}
            </div>${historyDay ? button("Clear filter", "clear-history") : ""}
            ${list(entries, entry => record(entry, "event", formatDate(entry.time) + " · " + formatTime(entry.time)), "No drinks for this date.")}</section>`;
        screen.querySelector("#history-day").addEventListener("change", event => {
            historyDay = event.target.value;
            history();
            screen.querySelector("#history-day").focus();
        });
    }

    function drinks() {
        screen.innerHTML = heading("My drinks", "Save your own caffeine amounts for faster logging.", button("＋ New custom drink", "new-drink", "primary")) +
            `<section class="card"><h2>Custom drinks</h2>
            ${list(state.drinks, entry => record(entry, "drink", "Available in quick pick"), "Add a custom drink to get started.")}</section>`;
    }

    function settings() {
        const config = state.settings;
        screen.innerHTML = heading("Settings", "Set the inputs used for your caffeine estimate.") +
            `<form class="card" data-form="settings"><h2>Caffeine model</h2>
                <div class="form-grid">
                    ${field("Half-life", `<select name="halfLifeMinutes">${options([180, 240, 300, 360, 480, 600], config.halfLifeMinutes)}</select>`, "How quickly you clear caffeine.")}
                    ${field("Absorption", `<select name="absorptionMinutes">${options([20, 30, 45, 60], config.absorptionMinutes)}</select>`, "How long caffeine takes to enter the model.")}
                    ${field("Personal threshold (mg/L)", `<input name="threshold" type="number" min="0.1" max="1.5" step="0.1" required value="${config.threshold}">`)}
                </div>
                <h2>Sleep and logging</h2>
                <div class="form-grid">
                    ${field("Bedtime", `<input name="bedtimeMinutes" type="time" required value="${bedtimeClock(config.bedtimeMinutes)}">`)}
                    ${field("Bedtime buffer", `<select name="bedtimeBufferMinutes">${options([0, 30, 60, 90, 120], config.bedtimeBufferMinutes)}</select>`)}
                    ${field("Sort drinks by use", `<select name="smartSorting"><option value="1"${config.smartSorting ? " selected" : ""}>On</option><option value="0"${config.smartSorting ? "" : " selected"}>Off</option></select>`)}
                </div>
                <button type="submit" class="primary">Save settings</button>
            </form>`;
    }

    function show(next, focus = true) {
        tab = next;
        navigation.querySelectorAll("[data-action]").forEach(item => {
            if (item.dataset.action === tab) item.setAttribute("aria-current", "page");
            else item.removeAttribute("aria-current");
        });
        ({ today, log, history, drinks, settings })[tab]();
        if (focus) {
            window.scrollTo(0, 0);
            screen.querySelector("h1").focus({ preventScroll: true });
        }
    }

    function openEditor(kind, id) {
        const items = kind === "event" ? state.events : state.drinks;
        const entry = id ? items.find(item => item.id === id) : { name: "", mg: 60 };
        if (!entry) return;
        edit = { kind, id };
        const title = kind === "event" ? "Edit drink entry" : id ? "Edit custom drink" : "New custom drink";
        editor.innerHTML = `<h2 id="editor-title">${title}</h2>${drinkFields(entry, kind === "event")}
            <div class="actions">${button("Cancel", "cancel")}<button type="submit" class="primary">Save</button></div>
            ${id ? `<div class="remove-option">${button("Delete…", "confirm-delete", "danger")}</div>` : ""}`;
        dialog.showModal();
    }

    function closeEditor() {
        dialog.close();
        edit = null;
    }

    function fields(form, withTime) {
        const values = new FormData(form);
        const name = values.get("name").trim();
        if (!name) {
            form.elements.name.value = "";
            form.elements.name.reportValidity();
            return null;
        }
        const result = { name, mg: Number(values.get("mg")) };
        if (withTime) {
            result.time = new Date(values.get("time")).getTime() / 1000;
            if (!Number.isInteger(result.time) || result.time < 0 || result.time > 0xffffffff) {
                form.elements.time.setCustomValidity("Enter a date between 1970 and 2106.");
                form.elements.time.reportValidity();
                form.elements.time.setCustomValidity("");
                return null;
            }
        }
        return result;
    }

    navigation.innerHTML = tabs.map(([id, icon, label]) =>
        `<button class="nav-button" type="button" data-action="${id}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("");
    document.addEventListener("click", event => {
        const control = event.target.closest("button");
        if (!control) return;
        if (control.dataset.edit) { openEditor(control.dataset.edit, control.dataset.id); return; }
        const action = control.dataset.action;
        if (tabs.some(([id]) => id === action)) { show(action); return; }
        if (action === "new-drink") openEditor("drink");
        else if (action === "cancel") closeEditor();
        else if (action === "clear-history") { historyDay = ""; history(); screen.querySelector("#history-day").focus(); }
        else if (action === "confirm-delete") {
            editor.innerHTML = `<h2 id="editor-title">Delete this ${edit.kind === "event" ? "entry" : "custom drink"}?</h2>
                <p class="sub">This change applies to the local preview.</p><div class="actions">
                ${button("Keep it", "cancel")}${button("Delete", "delete", "danger")}</div>`;
            editor.querySelector("button").focus();
        } else if (action === "delete") {
            const key = edit.kind === "event" ? "events" : "drinks";
            state[key] = state[key].filter(entry => entry.id !== edit.id);
            closeEditor();
            show(tab);
            save("Deleted from this browser.");
        }
    });
    dialog.addEventListener("close", () => { if (!dialog.open) edit = null; });
    document.addEventListener("submit", event => {
        const form = event.target;
        event.preventDefault();
        if (form === editor && edit) {
            const key = edit.kind === "event" ? "events" : "drinks";
            const value = fields(form, edit.kind === "event");
            if (!value) return;
            const saved = { ...value, id: edit.id || newId() };
            state[key] = edit.id ? state[key].map(entry => entry.id === edit.id ? saved : entry) : [...state[key], saved];
            closeEditor();
            show(tab);
            save("Saved in this browser.");
        } else if (form.dataset.form === "log") {
            const value = fields(form, true);
            if (!value) return;
            state.events.push({ ...value, id: newId() });
            show("today");
            save(value.time > core.nowSec() ? "Drink scheduled in this browser." : "Drink added in this browser.");
        } else if (form.dataset.form === "settings") {
            const values = Object.fromEntries(new FormData(form));
            const [hours, minutes] = values.bedtimeMinutes.split(":").map(Number);
            state.settings = {
                halfLifeMinutes: Number(values.halfLifeMinutes), absorptionMinutes: Number(values.absorptionMinutes),
                threshold: Number(values.threshold), bedtimeMinutes: hours * 60 + minutes,
                bedtimeBufferMinutes: Number(values.bedtimeBufferMinutes), smartSorting: values.smartSorting === "1",
            };
            save("Settings saved in this browser.");
        }
    });
    show("today", false);
})();
