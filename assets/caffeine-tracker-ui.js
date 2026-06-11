/**
 * DOM controller for the static Caffeine Tracker Web page.
 */
(function () {
    "use strict";

    const core = window.CaffeineTrackerCore;
    const storageFactory = window.CaffeineTrackerStorage;
    const i18n = window.CaffeineTrackerI18n;

    if (!core || !storageFactory || !i18n) return;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatNumber(value, decimals) {
        return Number(value).toFixed(decimals);
    }

    function toLocalDateParts(timeSec) {
        const date = new Date(timeSec * 1000);
        return {
            year: date.getFullYear(),
            month: String(date.getMonth() + 1).padStart(2, "0"),
            day: String(date.getDate()).padStart(2, "0"),
            hours: String(date.getHours()).padStart(2, "0"),
            minutes: String(date.getMinutes()).padStart(2, "0"),
        };
    }

    function toDateInputValue(timeSec) {
        const parts = toLocalDateParts(timeSec);
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function toClockInputValue(timeSec) {
        const parts = toLocalDateParts(timeSec);
        return `${parts.hours}:${parts.minutes}`;
    }

    function parseDateAndClockInput(dateValue, clockValue) {
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
        const clockMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(clockValue || "").trim());

        if (!dateMatch || !clockMatch) return null;

        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        const hours = Number(clockMatch[1]);
        const minutes = Number(clockMatch[2]);
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day ||
            date.getHours() !== hours ||
            date.getMinutes() !== minutes
        ) {
            return null;
        }

        return Math.floor(date.getTime() / 1000);
    }

    function formatTimeForDay(timeSec, dayStartSec, locale) {
        if (!Number.isFinite(timeSec)) return "--:--";

        const offsetDays = Math.round((core.localDayStartSec(timeSec) - dayStartSec) / core.SECONDS_PER_DAY);
        const suffix = offsetDays === 0 ? "" : ` (${offsetDays > 0 ? "+" : ""}${offsetDays}d)`;
        return core.formatTime(timeSec, locale) + suffix;
    }

    function localHourSec(dayStartSec, hour) {
        const start = new Date(dayStartSec * 1000);
        return Math.floor(new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour).getTime() / 1000);
    }

    function wizardHref(lang) {
        return "halflife-wizard.html";
    }

    function resolveTimeLocale(lang) {
        const defaults = {
            en: "en-GB",
            de: "de-DE",
            es: "es-ES",
            pl: "pl-PL",
        };
        const normalizedLang = (lang || "").slice(0, 2);
        const rootLang = document.documentElement.lang || "";

        if (rootLang.length > 2 && rootLang.slice(0, 2) === normalizedLang) return rootLang;
        return defaults[normalizedLang] || rootLang || undefined;
    }

    function renderGraph(graph, options) {
        const width = 720;
        const height = 330;
        const plot = { left: 38, right: 14, top: 16, bottom: 30 };
        const plotWidth = width - plot.left - plot.right;
        const plotHeight = height - plot.top - plot.bottom;
        const startSec = options.startSec;
        const endSec = options.endSec;
        const nowSec = options.nowSec;
        const locale = options.locale;
        const dict = options.dict;
        const duration = Math.max(endSec - startSec, 1);

        function xFor(timeSec) {
            return plot.left + ((timeSec - startSec) / duration) * plotWidth;
        }

        function yFor(level) {
            const clamped = Math.max(0, Math.min(level, graph.maxLevel));
            return plot.top + ((graph.maxLevel - clamped) / graph.maxLevel) * plotHeight;
        }

        function pathFor(points) {
            if (!points.length) return "";
            return points.map(function (point, index) {
                const command = index === 0 ? "M" : "L";
                return `${command}${xFor(point.time).toFixed(2)} ${yFor(point.level).toFixed(2)}`;
            }).join(" ");
        }

        const solidPoints = graph.points.filter(function (point) { return point.time <= nowSec; });
        const futurePoints = graph.points.filter(function (point) { return point.time >= nowSec; });
        if (solidPoints.length && futurePoints.length && futurePoints[0] !== solidPoints[solidPoints.length - 1]) {
            futurePoints.unshift(solidPoints[solidPoints.length - 1]);
        }

        const grid = [];
        const labels = [];

        for (let hour = 0; hour <= 24; hour += 2) {
            const time = localHourSec(startSec, hour);
            const x = xFor(time);
            grid.push(`<line class="ct-graph-grid" x1="${x.toFixed(2)}" y1="${plot.top}" x2="${x.toFixed(2)}" y2="${height - plot.bottom}"></line>`);

            if (hour < 24 && hour % 4 === 0) {
                labels.push(`<text class="ct-graph-label" x="${x.toFixed(2)}" y="${height - 8}" text-anchor="middle">${escapeHtml(core.formatTime(time, locale))}</text>`);
            }
        }

        const thresholds = [
            { value: graph.thresholds.sleep, label: dict.thresholdStimulated, className: "ct-threshold-stimulated" },
            { value: graph.thresholds.optimal, label: dict.thresholdHigh, className: "ct-threshold-high" },
            { value: graph.thresholds.max, label: dict.thresholdMax, className: "ct-threshold-max" },
        ].map(function (threshold) {
            const y = yFor(threshold.value);
            return [
                `<line class="${threshold.className}" x1="${plot.left}" y1="${y.toFixed(2)}" x2="${width - plot.right}" y2="${y.toFixed(2)}"></line>`,
                `<text class="ct-threshold-label ${threshold.className}" x="${plot.left + 4}" y="${(y - 4).toFixed(2)}">${escapeHtml(threshold.label)}</text>`,
            ].join("");
        }).join("");

        const nowX = xFor(nowSec);
        const nowLine = nowSec >= startSec && nowSec <= endSec
            ? `<line class="ct-now-line" x1="${nowX.toFixed(2)}" y1="${plot.top}" x2="${nowX.toFixed(2)}" y2="${height - plot.bottom}"></line>`
            : "";

        return `
            <svg class="ct-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel)}" preserveAspectRatio="none">
                <rect class="ct-graph-bg" x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
                ${grid.join("")}
                ${thresholds}
                <line class="ct-graph-axis" x1="${plot.left}" y1="${height - plot.bottom}" x2="${width - plot.right}" y2="${height - plot.bottom}"></line>
                <path class="ct-caffeine-curve" d="${pathFor(solidPoints)}"></path>
                <path class="ct-caffeine-curve ct-caffeine-curve-future" d="${pathFor(futurePoints)}"></path>
                ${nowLine}
                ${labels.join("")}
            </svg>
        `;
    }

    function renderMetabolismOptions(settings) {
        return core.HALFLIFE_OPTIONS.map(function (option) {
            return `<option value="${option.minutes}"${settings.halfLifeMinutes === option.minutes ? " selected" : ""}>${option.hours} h</option>`;
        }).join("");
    }

    function renderAbsorptionOptions(settings, dict) {
        return core.ABSORPTION_OPTIONS.map(function (option) {
            const label = i18n.t(dict, "absorptionOption", { minutes: option.minutes });
            return `<option value="${option.minutes}"${settings.absorptionMinutes === option.minutes ? " selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("");
    }

    function renderThresholdLegend(dict) {
        const items = [
            {
                className: "ct-legend-stimulated",
                value: dict.thresholdStimulatedValue,
                badge: dict.thresholdStimulated,
                name: dict.thresholdStimulatedName,
                description: dict.thresholdStimulatedDescription,
            },
            {
                className: "ct-legend-high",
                value: dict.thresholdHighValue,
                badge: dict.thresholdHigh,
                name: dict.thresholdHighName,
                description: dict.thresholdHighDescription,
            },
            {
                className: "ct-legend-max",
                value: dict.thresholdMaxValue,
                badge: dict.thresholdMax,
                name: dict.thresholdMaxName,
                description: dict.thresholdMaxDescription,
            },
        ];

        return `
            <div class="ct-threshold-legend" aria-label="${escapeHtml(dict.thresholdLegendTitle)}">
                <h3>${escapeHtml(dict.thresholdLegendTitle)}</h3>
                <div class="ct-threshold-legend-grid">
                    ${items.map(function (item) {
                        return `
                            <div class="ct-threshold-legend-item ${item.className}">
                                <div class="ct-threshold-legend-top">
                                    <span class="ct-threshold-value">${escapeHtml(item.value)}</span>
                                    <span class="ct-threshold-badge">${escapeHtml(item.badge)}</span>
                                </div>
                                <strong>${escapeHtml(item.name)}</strong>
                                <p>${escapeHtml(item.description)}</p>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    function renderDrinkButton(drink, dict) {
        const customDelete = drink.custom
            ? `<button class="ct-icon-button" type="button" data-delete-custom="${escapeHtml(drink.name)}" aria-label="${escapeHtml(dict.deleteCustom)}: ${escapeHtml(drink.name)}">×</button>`
            : "";

        return `
            <div class="ct-drink-row">
                <button class="ct-drink-button" type="button" data-drink-key="${escapeHtml(drink.key)}">
                    <span>${escapeHtml(drink.name)}</span>
                    <span>${escapeHtml(drink.mg)} ${escapeHtml(dict.mgUnit)}</span>
                </button>
                ${customDelete}
            </div>
        `;
    }

    function render(root, app, status) {
        const now = core.nowSec();
        app.storage.decayUsageIfNeeded(now);

        const settings = app.storage.readSettings();
        const events = app.storage.readEvents(now);
        const customDrinks = app.storage.readCustomDrinks();
        const allDrinks = core.allDrinks(customDrinks, app.dict.presetNames);
        app.storage.pruneUsage(allDrinks.map(function (drink) { return drink.key; }));
        const usage = app.storage.readUsage();
        const drinks = core.sortDrinksByUsage(allDrinks, usage, settings.smartSorting);
        const cache = app.storage.readCache();
        const current = core.currentLevelFromCache({
            events,
            cachedLevel: cache.level,
            cachedTime: cache.time,
            nowSec: now,
            settings,
        });
        app.storage.writeCache(current);

        const dayStart = core.localDayStartSec(now);
        const dayEnd = core.localDayEndSec(now);
        const graphPoints = Math.min(420, Math.max(180, Math.round((root.clientWidth || 720) * 0.55)));
        const graph = core.graphDataForRange({
            events,
            startSec: dayStart,
            endSec: dayEnd,
            points: graphPoints,
            includeCurrentTimeRatio: true,
            nowSec: now,
            halfLifeMinutes: settings.halfLifeMinutes,
            absorptionMinutes: settings.absorptionMinutes,
            weightKg: settings.weightKg,
            userThreshold: settings.belowAtThresholdMgPerL,
        });

        const currentLevel = formatNumber(current.level, 2);
        const threshold = formatNumber(settings.belowAtThresholdMgPerL, 1);
        const belowText = graph.belowAtTime == null
            ? app.dict.belowAtUnknown
            : i18n.t(app.dict, "belowAt", {
                threshold,
                time: formatTimeForDay(graph.belowAtTime, dayStart, app.timeLocale),
            });
        const selectedDate = toDateInputValue(now);
        const selectedClockTime = toClockInputValue(now);
        const minDate = toDateInputValue(now - core.EVENT_RETENTION_SECONDS);
        const maxDate = toDateInputValue(dayEnd - 60);
        const weightDisplay = formatNumber(core.weightFromKg(settings.weightKg, settings.weightUnit), settings.weightUnit === "lb" ? 1 : 1);
        const recent = events.map(function (event, index) {
            return { event, index };
        }).reverse().slice(0, 10);

        const presetDrinks = drinks.filter(function (drink) { return !drink.custom; });
        const customDrinkList = drinks.filter(function (drink) { return drink.custom; });
        const pendingDrink = app.pendingDrink;

        root.innerHTML = `
            <section class="ct-shell" aria-label="${escapeHtml(app.dict.pageTitle)}">
                <div class="ct-layout">
                    <section class="ct-panel ct-graph-panel">
                        <div class="ct-graph-heading">
                            <div class="ct-current-metric">
                                <span>${escapeHtml(app.dict.currentLevelLabel)}</span>
                                <h2>${escapeHtml(i18n.t(app.dict, "currentLevel", { level: currentLevel }))}</h2>
                            </div>
                            <div class="ct-projection">${escapeHtml(belowText)}</div>
                        </div>
                        <div class="ct-graph-wrap">
                            ${renderGraph(graph, {
                                startSec: dayStart,
                                endSec: dayEnd,
                                nowSec: now,
                                locale: app.timeLocale,
                                dict: app.dict,
                                ariaLabel: i18n.t(app.dict, "graphAria", { level: currentLevel }),
                            })}
                            <div class="ct-hover-readout" hidden></div>
                        </div>
                        ${renderThresholdLegend(app.dict)}
                        <p class="ct-disclaimer">${escapeHtml(app.dict.estimateDisclaimer)}</p>
                    </section>

                    <aside class="ct-side">
                        <section class="ct-panel">
                            <h2>${escapeHtml(app.dict.addDrink)}</h2>
                            <div class="ct-drink-section">
                                <h3>${escapeHtml(app.dict.presets)}</h3>
                                <div class="ct-drink-list">${presetDrinks.map(function (drink) { return renderDrinkButton(drink, app.dict); }).join("")}</div>
                            </div>
                            <div class="ct-drink-section">
                                <h3>${escapeHtml(app.dict.customDrinks)}</h3>
                                <div class="ct-drink-list">
                                    ${customDrinkList.length ? customDrinkList.map(function (drink) { return renderDrinkButton(drink, app.dict); }).join("") : `<p class="ct-empty">${escapeHtml(app.dict.noCustomDrinks)}</p>`}
                                </div>
                                <form class="ct-custom-form" id="ct-custom-form">
                                    <label class="ct-field">
                                        <span>${escapeHtml(app.dict.customName)}</span>
                                        <input class="ct-input" name="customName" type="text" autocomplete="off">
                                    </label>
                                    <label class="ct-field">
                                        <span>${escapeHtml(app.dict.customAmount)}</span>
                                        <input class="ct-input" name="customMg" type="number" min="0" max="500" step="1" value="60">
                                    </label>
                                    <button class="ct-button ct-button-secondary" type="submit">${escapeHtml(app.dict.addCustom)}</button>
                                </form>
                            </div>
                        </section>

                        <section class="ct-panel">
                            <h2>${escapeHtml(app.dict.weightSettings)}</h2>
                            <form class="ct-weight-form" id="ct-weight-form">
                                <label class="ct-field">
                                    <span>${escapeHtml(app.dict.weightSettings)}</span>
                                    <div class="ct-weight-grid">
                                        <input class="ct-input" name="weightValue" type="number" min="1" max="1100" step="0.1" value="${weightDisplay}">
                                        <select class="ct-input" name="weightUnit">
                                            <option value="kg"${settings.weightUnit === "kg" ? " selected" : ""}>kg</option>
                                            <option value="lb"${settings.weightUnit === "lb" ? " selected" : ""}>lb</option>
                                        </select>
                                    </div>
                                </label>
                                <p class="ct-help">${escapeHtml(app.dict.weightHelp)}</p>
                            </form>
                        </section>

                        <section class="ct-panel">
                            <h2>${escapeHtml(app.dict.metabolismSettings)}</h2>
                            <form class="ct-metabolism-form" id="ct-metabolism-form">
                                <label class="ct-field">
                                    <span>${escapeHtml(app.dict.metabolismSettings)}</span>
                                    <select class="ct-input" name="halfLifeMinutes">
                                        ${renderMetabolismOptions(settings)}
                                    </select>
                                </label>
                                <label class="ct-field">
                                    <span>${escapeHtml(app.dict.absorptionSettings)}</span>
                                    <select class="ct-input" name="absorptionMinutes">
                                        ${renderAbsorptionOptions(settings, app.dict)}
                                    </select>
                                </label>
                                <p class="ct-help">${escapeHtml(app.dict.metabolismHelp)}</p>
                                <p class="ct-help">${escapeHtml(app.dict.absorptionHelp)}</p>
                                <a class="ct-button ct-link-button" href="${escapeHtml(wizardHref(app.lang))}">${escapeHtml(app.dict.metabolismWizard)}</a>
                            </form>
                        </section>

                        <section class="ct-panel">
                            <h2>${escapeHtml(app.dict.recentDrinks)}</h2>
                            <div class="ct-recent-list">
                                ${recent.length ? recent.map(function (entry) {
                                    return `
                                        <div class="ct-recent-row">
                                            <div>
                                                <strong>${escapeHtml(entry.event.name)} (${escapeHtml(entry.event.mg)} ${escapeHtml(app.dict.mgUnit)})</strong>
                                                <span>${escapeHtml(formatTimeForDay(entry.event.time, dayStart, app.timeLocale))}</span>
                                            </div>
                                            <button class="ct-icon-button" type="button" data-delete-event="${entry.index}" aria-label="${escapeHtml(app.dict.deleteEvent)}">×</button>
                                        </div>
                                    `;
                                }).join("") : `<p class="ct-empty">${escapeHtml(app.dict.noEvents)}</p>`}
                            </div>
                        </section>
                    </aside>
                </div>

                <div class="ct-status" role="status" aria-live="polite">${status ? escapeHtml(status) : ""}</div>
            </section>

            ${pendingDrink ? `
                <div class="ct-modal-backdrop" role="presentation">
                    <section class="ct-modal" role="dialog" aria-modal="true" aria-labelledby="ct-drink-dialog-title">
                        <h2 id="ct-drink-dialog-title">${escapeHtml(i18n.t(app.dict, "drinkTimePrompt", { name: pendingDrink.name }))}</h2>
                        <p class="ct-modal-dose">${escapeHtml(pendingDrink.mg)} ${escapeHtml(app.dict.mgUnit)}</p>
                        <form id="ct-drink-time-form">
                            <div class="ct-time-grid">
                                <label class="ct-field">
                                    <span>${escapeHtml(app.dict.drinkDate)}</span>
                                    <input class="ct-input" id="ct-drink-date" name="drinkDate" type="date" min="${minDate}" max="${maxDate}" value="${selectedDate}">
                                </label>
                                <label class="ct-field">
                                    <span>${escapeHtml(app.dict.drinkTime)}</span>
                                    <input class="ct-input" id="ct-drink-time" name="drinkClockTime" type="text" inputmode="numeric" autocomplete="off" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxlength="5" placeholder="HH:mm" value="${selectedClockTime}" autofocus>
                                </label>
                            </div>
                            <p class="ct-help">${escapeHtml(app.dict.drinkTimeHint)}</p>
                            <div class="ct-modal-actions">
                                <button class="ct-button ct-button-secondary" type="button" data-cancel-drink>${escapeHtml(app.dict.cancel)}</button>
                                <button class="ct-button" type="submit">${escapeHtml(app.dict.confirmAddDrink)}</button>
                            </div>
                        </form>
                    </section>
                </div>
            ` : ""}
        `;

        bind(root, app, {
            settings,
            drinks,
            graph,
            events,
            dayStart,
            dayEnd,
            timeLocale: app.timeLocale,
            minSec: now - core.EVENT_RETENTION_SECONDS,
            maxSec: dayEnd - 60,
        });
    }

    function bind(root, app, state) {
        root.querySelectorAll("[data-drink-key]").forEach(function (button) {
            button.addEventListener("click", function () {
                const drink = state.drinks.find(function (candidate) {
                    return candidate.key === button.getAttribute("data-drink-key");
                });

                if (!drink) return;
                app.pendingDrink = drink;
                render(root, app);
            });
        });

        const drinkTimeForm = root.querySelector("#ct-drink-time-form");
        if (drinkTimeForm) {
            drinkTimeForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const data = new FormData(drinkTimeForm);
                const drink = app.pendingDrink;
                const timeSec = parseDateAndClockInput(data.get("drinkDate"), data.get("drinkClockTime"));

                if (!drink || timeSec == null || timeSec < state.minSec || timeSec > state.maxSec) {
                    render(root, app, app.dict.invalidTime);
                    return;
                }

                app.storage.addEvent({ name: drink.name, mg: drink.mg, time: timeSec });
                if (state.settings.smartSorting) app.storage.recordUsage(drink.key, core.nowSec());
                app.pendingDrink = null;
                render(root, app, i18n.t(app.dict, "loggedStatus", { name: drink.name }));
            });
        }

        root.querySelectorAll("[data-cancel-drink]").forEach(function (button) {
            button.addEventListener("click", function () {
                app.pendingDrink = null;
                render(root, app);
            });
        });

        root.querySelectorAll("[data-delete-event]").forEach(function (button) {
            button.addEventListener("click", function () {
                app.storage.deleteEventAt(Number(button.getAttribute("data-delete-event")));
                render(root, app, app.dict.eventDeletedStatus);
            });
        });

        root.querySelectorAll("[data-delete-custom]").forEach(function (button) {
            button.addEventListener("click", function () {
                const name = button.getAttribute("data-delete-custom");
                app.storage.deleteCustomDrink(name);
                render(root, app, i18n.t(app.dict, "customDeletedStatus", { name }));
            });
        });

        const customForm = root.querySelector("#ct-custom-form");
        if (customForm) {
            customForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const data = new FormData(customForm);
                const presetNames = Object.values(app.dict.presetNames).concat(core.PRESET_DRINKS.map(function (drink) { return drink.name; }));
                const next = app.storage.addCustomDrink(data.get("customName"), data.get("customMg"), presetNames);
                const saved = next[next.length - 1];
                render(root, app, i18n.t(app.dict, "customSavedStatus", { name: saved.name }));
            });
        }

        const weightForm = root.querySelector("#ct-weight-form");
        if (weightForm) {
            weightForm.addEventListener("change", function () {
                const data = new FormData(weightForm);
                const unit = data.get("weightUnit") === "lb" ? "lb" : "kg";
                const weightKg = core.weightToKg(data.get("weightValue"), unit);
                app.storage.writeSettings(Object.assign({}, state.settings, {
                    weightKg,
                    weightUnit: unit,
                }));
                render(root, app);
            });
        }

        const metabolismForm = root.querySelector("#ct-metabolism-form");
        if (metabolismForm) {
            metabolismForm.addEventListener("change", function () {
                const data = new FormData(metabolismForm);
                const halfLifeMinutes = Number(data.get("halfLifeMinutes"));
                const absorptionMinutes = Number(data.get("absorptionMinutes"));
                app.storage.writeSettings(Object.assign({}, state.settings, {
                    halfLifeMinutes,
                    absorptionMinutes,
                }));
                render(root, app);
            });
        }

        const graphEl = root.querySelector(".ct-graph");
        const readoutEl = root.querySelector(".ct-hover-readout");
        if (graphEl && readoutEl) {
            graphEl.addEventListener("mousemove", function (event) {
                const rect = graphEl.getBoundingClientRect();
                const plotLeft = rect.width * (38 / 720);
                const plotRight = rect.width * (14 / 720);
                const plotWidth = Math.max(rect.width - plotLeft - plotRight, 1);
                const ratio = Math.min(Math.max((event.clientX - rect.left - plotLeft) / plotWidth, 0), 1);
                const timeSec = state.dayStart + ratio * (state.dayEnd - state.dayStart);
                const level = core.levelAtTime(state.events, timeSec, state.settings.halfLifeMinutes, state.settings.weightKg, state.settings.absorptionMinutes);
                const label = i18n.t(app.dict, "hoverReadout", {
                    time: formatTimeForDay(timeSec, state.dayStart, state.timeLocale),
                    level: formatNumber(level, 2),
                });
                readoutEl.textContent = label;
                readoutEl.hidden = false;
                readoutEl.style.left = `${Math.min(Math.max(event.clientX - rect.left, 82), rect.width - 82)}px`;
                readoutEl.style.top = `${Math.min(Math.max(event.clientY - rect.top, 24), rect.height - 24)}px`;
            });
            graphEl.addEventListener("mouseleave", function () {
                readoutEl.hidden = true;
            });
        }
    }

    function init(root) {
        const lang = (root.getAttribute("data-lang") || document.documentElement.lang || "en").slice(0, 2);
        const storage = storageFactory.createStorage(getBrowserStorage());
        const app = {
            lang,
            dict: i18n.get(lang),
            timeLocale: resolveTimeLocale(lang),
            homeHref: root.getAttribute("data-home-href") || "index.html",
            storage,
            pendingDrink: null,
        };
        const appliedStatus = applyIncomingHalfLife(app);

        render(root, app, appliedStatus);
        window.addEventListener("resize", function () { render(root, app); });
        window.setInterval(function () { render(root, app); }, 60 * 1000);
    }

    function applyIncomingHalfLife(app) {
        const params = new URLSearchParams(window.location.search);
        const minutesParam = Number(params.get("halfLifeMinutes"));
        const hoursParam = Number(params.get("halfLifeHours"));
        const halfLifeMinutes = Number.isFinite(minutesParam) && minutesParam > 0
            ? minutesParam
            : Number.isFinite(hoursParam) && hoursParam > 0
                ? hoursParam * 60
                : null;

        if (!halfLifeMinutes) return "";

        const settings = app.storage.readSettings();
        const normalized = core.normalizeSettings(Object.assign({}, settings, {
            halfLifeMinutes,
        }));
        app.storage.writeSettings(normalized);

        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return i18n.t(app.dict, "metabolismAppliedStatus", {
            hours: formatNumber(normalized.halfLifeMinutes / 60, normalized.halfLifeMinutes % 60 === 0 ? 0 : 1),
        });
    }

    function getBrowserStorage() {
        try {
            return window.localStorage;
        } catch (error) {
            return null;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("[data-caffeine-tracker]").forEach(init);
    });
})();
