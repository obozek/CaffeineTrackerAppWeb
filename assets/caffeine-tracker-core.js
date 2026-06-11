/**
 * Caffeine Tracker Web core.
 *
 * Pure calculation, validation, time, and drink-ranking helpers. This file has
 * no DOM or localStorage dependency so it can be tested directly in Node.
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        root.CaffeineTrackerCore = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const LN2 = Math.log(2);
    const SECONDS_PER_MINUTE = 60;
    const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
    const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
    const EVENT_RETENTION_SECONDS = 48 * SECONDS_PER_HOUR;
    const MAX_EVENTS = 50;
    const GRAPH_MAX_LEVEL = 15.0;
    const DEFAULT_ABSORPTION_MINUTES = 30;
    const DEFAULT_CUSTOM_DRINK_NAME = "Custom Drink";

    const THRESHOLDS = {
        sleep: 1.0,
        optimal: 5.0,
        max: 10.0,
        belowAt: 0.6,
    };

    const DEFAULT_SETTINGS = {
        halfLifeMinutes: 300,
        absorptionMinutes: DEFAULT_ABSORPTION_MINUTES,
        weightKg: 70,
        weightUnit: "kg",
        belowAtThresholdMgPerL: THRESHOLDS.belowAt,
        smartSorting: true,
    };

    const HALFLIFE_OPTIONS = [
        { minutes: 180, hours: 3, label: "Very short - 3 hours" },
        { minutes: 240, hours: 4, label: "Short - 4 hours" },
        { minutes: 300, hours: 5, label: "Average - 5 hours" },
        { minutes: 360, hours: 6, label: "Long - 6 hours" },
        { minutes: 480, hours: 8, label: "Very long - 8 hours" },
        { minutes: 600, hours: 10, label: "Extra long - 10 hours" },
    ];

    const ABSORPTION_OPTIONS = [
        { minutes: 15, label: "Fast - 15 minutes" },
        { minutes: 30, label: "Normal - 30 minutes" },
        { minutes: 45, label: "Slow - 45 minutes" },
        { minutes: 60, label: "Very slow - 60 minutes" },
    ];

    const PRESET_DRINKS = [
        { id: "espresso", name: "Espresso", mg: 64 },
        { id: "double_espresso", name: "2x Espresso", mg: 128 },
        { id: "brewed_coffee_240", name: "Brewed Coffee 240ml", mg: 95 },
        { id: "black_tea_240", name: "Black Tea 240ml", mg: 45 },
        { id: "green_tea_240", name: "Green Tea 240ml", mg: 30 },
        { id: "energy_drink_240", name: "Energy Drink 240ml", mg: 80 },
        { id: "coca_cola_330", name: "Coca Cola 330ml", mg: 32 },
    ];

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    function toFiniteNumber(value, fallback) {
        const number = typeof value === "number" ? value : Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function roundTo(value, decimals) {
        const factor = Math.pow(10, decimals || 0);
        return Math.round(value * factor) / factor;
    }

    function normalizeAbsorptionMinutes(absorptionMinutes) {
        const minutes = Math.round(toFiniteNumber(absorptionMinutes, DEFAULT_ABSORPTION_MINUTES));
        return ABSORPTION_OPTIONS.some(function (option) { return option.minutes === minutes; })
            ? minutes
            : DEFAULT_ABSORPTION_MINUTES;
    }

    function nowSec(clock) {
        const source = clock && typeof clock.now === "function" ? clock.now() : Date.now();
        return Math.floor(source / 1000);
    }

    function dateFromDateOrSeconds(value) {
        if (value instanceof Date) return new Date(value.getTime());
        if (isFiniteNumber(value)) return new Date(value * 1000);
        return new Date();
    }

    function localDayStartSec(value) {
        const date = dateFromDateOrSeconds(value);
        return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000);
    }

    function localDayEndSec(value) {
        const date = dateFromDateOrSeconds(value);
        return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() / 1000);
    }

    function previousLocalDayRange(value) {
        const date = dateFromDateOrSeconds(value);
        const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
        return {
            startSec: localDayStartSec(previous),
            endSec: localDayEndSec(previous),
        };
    }

    function localDayKey(value) {
        const date = dateFromDateOrSeconds(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function formatTime(timeSec, locale) {
        if (!isFiniteNumber(timeSec)) return "--:--";
        return new Intl.DateTimeFormat(locale || undefined, {
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(timeSec * 1000));
    }

    function formatDuration(seconds) {
        const safeSeconds = Math.max(0, Math.round(toFiniteNumber(seconds, 0)));
        const hours = Math.floor(safeSeconds / SECONDS_PER_HOUR);
        const minutes = Math.floor((safeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
        return `${hours}h ${minutes}m`;
    }

    function weightToKg(value, unit) {
        const number = toFiniteNumber(value, DEFAULT_SETTINGS.weightKg);
        return unit === "lb" ? number * 0.45359237 : number;
    }

    function weightFromKg(weightKg, unit) {
        const kg = toFiniteNumber(weightKg, DEFAULT_SETTINGS.weightKg);
        return unit === "lb" ? kg / 0.45359237 : kg;
    }

    function normalizeSettings(settings) {
        const source = settings && typeof settings === "object" ? settings : {};
        const unit = source.weightUnit === "lb" ? "lb" : "kg";
        let weightKg = toFiniteNumber(source.weightKg, NaN);

        if (!Number.isFinite(weightKg) && source.weightValue != null) {
            weightKg = weightToKg(source.weightValue, unit);
        }

        if (!Number.isFinite(weightKg)) {
            weightKg = DEFAULT_SETTINGS.weightKg;
        }

        return {
            halfLifeMinutes: clamp(Math.round(toFiniteNumber(source.halfLifeMinutes, DEFAULT_SETTINGS.halfLifeMinutes)), 30, 1440),
            absorptionMinutes: normalizeAbsorptionMinutes(source.absorptionMinutes),
            weightKg: clamp(weightKg, 1, 500),
            weightUnit: unit,
            belowAtThresholdMgPerL: roundTo(clamp(toFiniteNumber(source.belowAtThresholdMgPerL, DEFAULT_SETTINGS.belowAtThresholdMgPerL), 0.1, 1.5), 1),
            smartSorting: source.smartSorting !== false,
        };
    }

    function normalizeEvent(event) {
        if (!event || typeof event !== "object") return null;

        const time = Math.floor(toFiniteNumber(event.time, NaN));
        if (!Number.isFinite(time)) return null;

        const rawName = typeof event.name === "string" ? event.name.trim() : "";
        const name = rawName || "Drink";
        const mg = clamp(Math.round(toFiniteNumber(event.mg, 0)), 0, 500);

        return { name, mg, time };
    }

    function sortEvents(events) {
        return normalizeEvents(events).sort(function (a, b) {
            return a.time - b.time;
        });
    }

    function normalizeEvents(events) {
        if (!Array.isArray(events)) return [];
        return events.map(normalizeEvent).filter(Boolean);
    }

    function pruneEvents(events, referenceTimeSec) {
        const now = Math.floor(toFiniteNumber(referenceTimeSec, nowSec()));
        const cutoff = now - EVENT_RETENTION_SECONDS;
        return sortEvents(events)
            .filter(function (event) { return event.time >= cutoff; })
            .slice(-MAX_EVENTS);
    }

    function remainingMgAtTime(event, timeSec, halfLifeMinutes, absorptionMinutes) {
        const normalized = normalizeEvent(event);
        const target = toFiniteNumber(timeSec, NaN);
        const halfLife = toFiniteNumber(halfLifeMinutes, 0);
        const absorption = normalizeAbsorptionMinutes(absorptionMinutes);

        if (!normalized || !Number.isFinite(target) || halfLife <= 0) return 0;
        if (normalized.time > target) return 0;

        const elapsedMinutes = (target - normalized.time) / SECONDS_PER_MINUTE;
        const absorbedMinutes = Math.min(elapsedMinutes, absorption);
        const eliminationRate = LN2 / halfLife;
        const amountDuringAbsorption = normalized.mg *
            (1 - Math.exp(-eliminationRate * absorbedMinutes)) /
            (eliminationRate * absorption);

        if (elapsedMinutes <= absorption) return amountDuringAbsorption;

        return amountDuringAbsorption * Math.exp(-eliminationRate * (elapsedMinutes - absorption));
    }

    function levelAtTime(events, timeSec, halfLifeMinutes, weightKg, absorptionMinutes) {
        const target = toFiniteNumber(timeSec, NaN);
        if (!Number.isFinite(target)) return 0;

        const volumeLiters = Math.max(toFiniteNumber(weightKg, DEFAULT_SETTINGS.weightKg) * 0.7, 1);
        const totalMg = normalizeEvents(events).reduce(function (sum, event) {
            return sum + remainingMgAtTime(event, target, halfLifeMinutes, absorptionMinutes);
        }, 0);

        return totalMg / volumeLiters;
    }

    function decayLevel(level, fromTimeSec, toTimeSec, halfLifeMinutes) {
        const currentLevel = Math.max(0, toFiniteNumber(level, 0));
        const from = toFiniteNumber(fromTimeSec, NaN);
        const to = toFiniteNumber(toTimeSec, NaN);
        const halfLife = toFiniteNumber(halfLifeMinutes, 0);

        if (!Number.isFinite(from) || !Number.isFinite(to) || halfLife <= 0) return 0;
        if (to <= from) return currentLevel;

        const deltaMinutes = (to - from) / SECONDS_PER_MINUTE;
        const exponent = (LN2 / halfLife) * deltaMinutes;
        return currentLevel * Math.exp(-exponent);
    }

    function hasEventBecomeDue(events, fromTimeSec, toTimeSec) {
        const from = toFiniteNumber(fromTimeSec, NaN);
        const to = toFiniteNumber(toTimeSec, NaN);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return false;

        return normalizeEvents(events).some(function (event) {
            return event.time > from && event.time <= to;
        });
    }

    function hasActiveAbsorption(events, fromTimeSec, toTimeSec, absorptionMinutes) {
        const from = toFiniteNumber(fromTimeSec, NaN);
        const to = toFiniteNumber(toTimeSec, NaN);
        const absorptionSeconds = normalizeAbsorptionMinutes(absorptionMinutes) * SECONDS_PER_MINUTE;
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || absorptionSeconds <= 0) return false;

        return normalizeEvents(events).some(function (event) {
            return event.time <= to && event.time + absorptionSeconds > from;
        });
    }

    function currentLevelFromCache(options) {
        const opts = options || {};
        const settings = normalizeSettings(opts.settings);
        const now = Math.floor(toFiniteNumber(opts.nowSec, nowSec()));
        const cachedLevel = toFiniteNumber(opts.cachedLevel, NaN);
        const cachedTime = Math.floor(toFiniteNumber(opts.cachedTime, NaN));

        const shouldRecompute =
            !Number.isFinite(cachedLevel) ||
            !Number.isFinite(cachedTime) ||
            cachedTime > now ||
            hasEventBecomeDue(opts.events, cachedTime, now) ||
            hasActiveAbsorption(opts.events, cachedTime, now, settings.absorptionMinutes);

        const level = shouldRecompute
            ? levelAtTime(opts.events, now, settings.halfLifeMinutes, settings.weightKg, settings.absorptionMinutes)
            : decayLevel(cachedLevel, cachedTime, now, settings.halfLifeMinutes);

        return {
            level,
            time: now,
            recomputed: shouldRecompute,
        };
    }

    function lowerThanTime(events, thresholdMgPerL, halfLifeMinutes, weightKg, absorptionMinutes) {
        const sorted = sortEvents(events);
        const threshold = toFiniteNumber(thresholdMgPerL, 0);
        const halfLife = toFiniteNumber(halfLifeMinutes, 0);
        const absorption = normalizeAbsorptionMinutes(absorptionMinutes);
        const absorptionSeconds = absorption * SECONDS_PER_MINUTE;

        if (!sorted.length || threshold <= 0 || halfLife <= 0) return null;

        const referenceTime = sorted.reduce(function (latest, event) {
            return Math.max(latest, event.time + absorptionSeconds);
        }, sorted[0].time + absorptionSeconds);
        const totalLevelAtReferenceTime = levelAtTime(sorted, referenceTime, halfLife, weightKg, absorption);
        if (totalLevelAtReferenceTime <= 0) return null;

        const k = LN2 / halfLife;
        const minutes = Math.round(-Math.log(threshold / totalLevelAtReferenceTime) / k);
        return referenceTime + minutes * SECONDS_PER_MINUTE;
    }

    function graphDataForRange(options) {
        const opts = options || {};
        const settings = normalizeSettings({
            halfLifeMinutes: opts.halfLifeMinutes,
            absorptionMinutes: opts.absorptionMinutes,
            weightKg: opts.weightKg,
            belowAtThresholdMgPerL: opts.userThreshold,
        });
        const startSec = Math.floor(toFiniteNumber(opts.startSec, localDayStartSec(nowSec())));
        const endSec = Math.floor(toFiniteNumber(opts.endSec, localDayEndSec(startSec)));
        const pointCount = clamp(Math.round(toFiniteNumber(opts.points, 240)), 2, 600);
        const now = Math.floor(toFiniteNumber(opts.nowSec, nowSec()));
        const duration = Math.max(endSec - startSec, 1);
        const step = duration / (pointCount - 1);
        const points = [];

        for (let i = 0; i < pointCount; i += 1) {
            const time = i === pointCount - 1 ? endSec : startSec + i * step;
            points.push({
                time,
                level: levelAtTime(opts.events, time, settings.halfLifeMinutes, settings.weightKg, settings.absorptionMinutes),
            });
        }

        return {
            points,
            levelPoints: points.map(function (point) { return point.level; }),
            currentTimeRatio: opts.includeCurrentTimeRatio
                ? clamp((now - startSec) / duration, 0, 1)
                : null,
            maxLevel: GRAPH_MAX_LEVEL,
            thresholds: {
                sleep: THRESHOLDS.sleep,
                optimal: THRESHOLDS.optimal,
                max: THRESHOLDS.max,
                belowAt: settings.belowAtThresholdMgPerL,
            },
            belowAtTime: lowerThanTime(opts.events, settings.belowAtThresholdMgPerL, settings.halfLifeMinutes, settings.weightKg, settings.absorptionMinutes),
        };
    }

    function normalizeDrinkName(name) {
        const trimmed = typeof name === "string" ? name.trim() : "";
        return trimmed || DEFAULT_CUSTOM_DRINK_NAME;
    }

    function uniqueDrinkName(name, existingNames) {
        const base = normalizeDrinkName(name);
        const used = new Set((existingNames || []).map(function (existing) {
            return String(existing).trim().toLowerCase();
        }));

        if (!used.has(base.toLowerCase())) return base;

        let suffix = 2;
        while (used.has(`${base} ${suffix}`.toLowerCase())) {
            suffix += 1;
        }
        return `${base} ${suffix}`;
    }

    function normalizeCustomDrink(drink) {
        if (!drink || typeof drink !== "object") return null;
        return {
            name: normalizeDrinkName(drink.name),
            mg: clamp(Math.round(toFiniteNumber(drink.mg, 60)), 0, 500),
        };
    }

    function normalizeCustomDrinks(drinks) {
        if (!Array.isArray(drinks)) return [];
        const normalized = [];
        const used = PRESET_DRINKS.map(function (drink) { return drink.name; });

        drinks.forEach(function (drink) {
            const custom = normalizeCustomDrink(drink);
            if (!custom) return;
            custom.name = uniqueDrinkName(custom.name, used.concat(normalized.map(function (entry) { return entry.name; })));
            normalized.push(custom);
        });

        return normalized;
    }

    function addCustomDrink(customDrinks, name, mg, presetNames) {
        const existingCustom = normalizeCustomDrinks(customDrinks);
        const presets = Array.isArray(presetNames) && presetNames.length
            ? presetNames
            : PRESET_DRINKS.map(function (drink) { return drink.name; });
        const uniqueName = uniqueDrinkName(name, presets.concat(existingCustom.map(function (drink) { return drink.name; })));
        const nextDrink = normalizeCustomDrink({ name: uniqueName, mg });
        return existingCustom.concat([nextDrink]);
    }

    function presetDrinksWithNames(presetNames) {
        const names = presetNames || {};
        return PRESET_DRINKS.map(function (drink) {
            return {
                key: `preset:${drink.id}`,
                id: drink.id,
                name: names[drink.id] || drink.name,
                mg: drink.mg,
                custom: false,
            };
        });
    }

    function customDrinkKey(drink) {
        return `custom:${normalizeDrinkName(drink && drink.name).toLowerCase()}`;
    }

    function customDrinksWithKeys(customDrinks) {
        return normalizeCustomDrinks(customDrinks).map(function (drink) {
            return {
                key: customDrinkKey(drink),
                name: drink.name,
                mg: drink.mg,
                custom: true,
            };
        });
    }

    function allDrinks(customDrinks, presetNames) {
        return presetDrinksWithNames(presetNames).concat(customDrinksWithKeys(customDrinks));
    }

    function normalizeUsage(usage) {
        if (!usage || typeof usage !== "object" || Array.isArray(usage)) return {};
        const normalized = {};

        Object.keys(usage).forEach(function (key) {
            const entry = usage[key];
            if (!entry || typeof entry !== "object") return;
            normalized[key] = {
                score: Math.max(0, toFiniteNumber(entry.score, 0)),
                lastUsed: Math.floor(toFiniteNumber(entry.lastUsed, 0)),
            };
        });

        return normalized;
    }

    function sortDrinksByUsage(drinks, usage, smartSorting) {
        const normalizedUsage = normalizeUsage(usage);
        const decorated = (drinks || []).map(function (drink, index) {
            const entry = normalizedUsage[drink.key] || { score: 0, lastUsed: 0 };
            return {
                drink,
                index,
                score: entry.score,
            };
        });

        if (smartSorting === false) {
            return decorated.map(function (entry) { return entry.drink; });
        }

        decorated.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return a.index - b.index;
        });

        return decorated.map(function (entry) { return entry.drink; });
    }

    function recordDrinkUsage(usage, key, timeSec) {
        const normalized = normalizeUsage(usage);
        const entry = normalized[key] || { score: 0, lastUsed: 0 };
        normalized[key] = {
            score: entry.score + 1,
            lastUsed: Math.floor(toFiniteNumber(timeSec, nowSec())),
        };
        return normalized;
    }

    function pruneUsageForDrinks(usage, drinkKeys) {
        const normalized = normalizeUsage(usage);
        const allowed = new Set(drinkKeys || []);
        const pruned = {};

        Object.keys(normalized).forEach(function (key) {
            if (allowed.has(key)) pruned[key] = normalized[key];
        });

        return pruned;
    }

    function decayDrinkUsageForDay(options) {
        const opts = options || {};
        const usage = normalizeUsage(opts.usage);
        const lastInteraction = Math.floor(toFiniteNumber(opts.lastInteraction, 0));
        const now = Math.floor(toFiniteNumber(opts.nowSec, nowSec()));
        const currentDay = localDayKey(now);

        if (!lastInteraction || opts.lastDecayDay === currentDay) {
            return { usage, lastDecayDay: opts.lastDecayDay || null, decayed: false };
        }

        const currentStart = localDayStartSec(now);
        const interactionStart = localDayStartSec(lastInteraction);
        const inactiveDays = Math.round((currentStart - interactionStart) / SECONDS_PER_DAY);

        if (inactiveDays > 3) {
            return { usage, lastDecayDay: currentDay, decayed: false };
        }

        const decayed = {};
        Object.keys(usage).forEach(function (key) {
            decayed[key] = {
                score: usage[key].score * 0.85,
                lastUsed: usage[key].lastUsed,
            };
        });

        return { usage: decayed, lastDecayDay: currentDay, decayed: true };
    }

    return {
        LN2,
        SECONDS_PER_MINUTE,
        SECONDS_PER_HOUR,
        SECONDS_PER_DAY,
        EVENT_RETENTION_SECONDS,
        MAX_EVENTS,
        GRAPH_MAX_LEVEL,
        DEFAULT_ABSORPTION_MINUTES,
        THRESHOLDS,
        DEFAULT_SETTINGS,
        HALFLIFE_OPTIONS,
        ABSORPTION_OPTIONS,
        PRESET_DRINKS,
        nowSec,
        localDayStartSec,
        localDayEndSec,
        previousLocalDayRange,
        localDayKey,
        formatTime,
        formatDuration,
        weightToKg,
        weightFromKg,
        normalizeAbsorptionMinutes,
        normalizeSettings,
        normalizeEvent,
        normalizeEvents,
        sortEvents,
        pruneEvents,
        remainingMgAtTime,
        levelAtTime,
        decayLevel,
        hasEventBecomeDue,
        hasActiveAbsorption,
        currentLevelFromCache,
        lowerThanTime,
        graphDataForRange,
        normalizeDrinkName,
        uniqueDrinkName,
        normalizeCustomDrink,
        normalizeCustomDrinks,
        addCustomDrink,
        presetDrinksWithNames,
        customDrinkKey,
        customDrinksWithKeys,
        allDrinks,
        normalizeUsage,
        sortDrinksByUsage,
        recordDrinkUsage,
        pruneUsageForDrinks,
        decayDrinkUsageForDay,
    };
});
