/**
 * Local persistence adapter for the Caffeine Tracker Web UI.
 */
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory(require("./caffeine-tracker-core.js"));
    } else {
        root.CaffeineTrackerStorage = factory(root.CaffeineTrackerCore);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
    "use strict";

    const KEYS = {
        events: "caffeineEvents",
        cachedLevel: "cachedCaffeineLevel",
        cachedTime: "cachedTime",
        customDrinks: "customDrinks",
        drinkUsage: "drinkUsage",
        drinkLastInteraction: "drinkLastInteraction",
        drinkLastDecayDay: "drinkLastDecayDay",
        settings: "settings",
    };

    function createMemoryStorage() {
        const store = {};
        return {
            getItem: function (key) {
                return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
            },
            setItem: function (key, value) {
                store[key] = String(value);
            },
            removeItem: function (key) {
                delete store[key];
            },
        };
    }

    function usableStorage(storage) {
        if (!storage) return createMemoryStorage();

        try {
            const probe = "__ct_probe__";
            storage.setItem(probe, "1");
            storage.removeItem(probe);
            return storage;
        } catch (error) {
            return createMemoryStorage();
        }
    }

    function createStorage(storage) {
        const backing = usableStorage(storage);

        function resolveTime(timeSec) {
            const time = Number(timeSec);
            return Number.isFinite(time) ? Math.floor(time) : core.nowSec();
        }

        function getItem(key) {
            try {
                return backing.getItem(key);
            } catch (error) {
                return null;
            }
        }

        function setItem(key, value) {
            try {
                backing.setItem(key, value);
            } catch (error) {
                // Persistence is best-effort. The UI still works in memory.
            }
        }

        function removeItem(key) {
            try {
                backing.removeItem(key);
            } catch (error) {
                // Ignore storage failures.
            }
        }

        function readJSON(key, fallback) {
            const raw = getItem(key);
            if (raw == null) return fallback;

            try {
                return JSON.parse(raw);
            } catch (error) {
                return fallback;
            }
        }

        function writeJSON(key, value) {
            setItem(key, JSON.stringify(value));
        }

        function settingsChanged(rawSettings, normalizedSettings) {
            const raw = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
                ? rawSettings
                : {};

            return raw.halfLifeMinutes !== normalizedSettings.halfLifeMinutes ||
                raw.absorptionMinutes !== normalizedSettings.absorptionMinutes ||
                raw.weightKg !== normalizedSettings.weightKg ||
                raw.weightUnit !== normalizedSettings.weightUnit ||
                raw.belowAtThresholdMgPerL !== normalizedSettings.belowAtThresholdMgPerL ||
                raw.smartSorting !== normalizedSettings.smartSorting;
        }

        function readSettings() {
            const rawSettings = readJSON(KEYS.settings, {});
            const settings = core.normalizeSettings(rawSettings);
            if (settingsChanged(rawSettings, settings)) clearCache();
            writeJSON(KEYS.settings, settings);
            return settings;
        }

        function writeSettings(settings) {
            const normalized = core.normalizeSettings(settings);
            writeJSON(KEYS.settings, normalized);
            clearCache();
            return normalized;
        }

        function readEvents(referenceTimeSec) {
            const now = resolveTime(referenceTimeSec);
            const events = core.pruneEvents(readJSON(KEYS.events, []), now);
            writeJSON(KEYS.events, events);
            return events;
        }

        function writeEvents(events, referenceTimeSec) {
            const now = resolveTime(referenceTimeSec);
            const normalized = core.pruneEvents(events, now);
            writeJSON(KEYS.events, normalized);
            clearCache();
            return normalized;
        }

        function addEvent(event, referenceTimeSec) {
            const now = resolveTime(referenceTimeSec);
            const normalized = core.normalizeEvent(event);
            if (!normalized) return readEvents(now);
            return writeEvents(readEvents(now).concat([normalized]), now);
        }

        function deleteEventAt(index, referenceTimeSec) {
            const now = resolveTime(referenceTimeSec);
            const events = readEvents(now);
            const safeIndex = Number(index);
            if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= events.length) {
                return events;
            }

            events.splice(safeIndex, 1);
            return writeEvents(events, now);
        }

        function readCustomDrinks() {
            const drinks = core.normalizeCustomDrinks(readJSON(KEYS.customDrinks, []));
            writeJSON(KEYS.customDrinks, drinks);
            return drinks;
        }

        function writeCustomDrinks(drinks) {
            const normalized = core.normalizeCustomDrinks(drinks);
            writeJSON(KEYS.customDrinks, normalized);
            return normalized;
        }

        function addCustomDrink(name, mg, presetNames) {
            return writeCustomDrinks(core.addCustomDrink(readCustomDrinks(), name, mg, presetNames));
        }

        function deleteCustomDrink(name) {
            const target = core.normalizeDrinkName(name).toLowerCase();
            const next = readCustomDrinks().filter(function (drink) {
                return drink.name.toLowerCase() !== target;
            });
            writeCustomDrinks(next);
            return next;
        }

        function readUsage() {
            const usage = core.normalizeUsage(readJSON(KEYS.drinkUsage, {}));
            writeJSON(KEYS.drinkUsage, usage);
            return usage;
        }

        function writeUsage(usage) {
            const normalized = core.normalizeUsage(usage);
            writeJSON(KEYS.drinkUsage, normalized);
            return normalized;
        }

        function recordUsage(drinkKey, timeSec) {
            const now = resolveTime(timeSec);
            const usage = core.recordDrinkUsage(readUsage(), drinkKey, now);
            writeUsage(usage);
            setItem(KEYS.drinkLastInteraction, String(now));
            return usage;
        }

        function pruneUsage(drinkKeys) {
            const usage = core.pruneUsageForDrinks(readUsage(), drinkKeys);
            writeUsage(usage);
            return usage;
        }

        function decayUsageIfNeeded(nowSec) {
            const result = core.decayDrinkUsageForDay({
                usage: readUsage(),
                lastInteraction: Number(getItem(KEYS.drinkLastInteraction) || 0),
                lastDecayDay: getItem(KEYS.drinkLastDecayDay),
                nowSec: resolveTime(nowSec),
            });
            writeUsage(result.usage);
            if (result.lastDecayDay) setItem(KEYS.drinkLastDecayDay, result.lastDecayDay);
            return result;
        }

        function readCache() {
            const rawLevel = getItem(KEYS.cachedLevel);
            const rawTime = getItem(KEYS.cachedTime);

            if (rawLevel == null || rawTime == null) {
                return { level: null, time: null };
            }

            const level = Number(rawLevel);
            const time = Number(rawTime);

            if (!Number.isFinite(level) || !Number.isFinite(time)) {
                return { level: null, time: null };
            }

            return { level, time };
        }

        function writeCache(cache) {
            if (!cache || !Number.isFinite(cache.level) || !Number.isFinite(cache.time)) {
                clearCache();
                return;
            }

            setItem(KEYS.cachedLevel, String(cache.level));
            setItem(KEYS.cachedTime, String(Math.floor(cache.time)));
        }

        function clearCache() {
            removeItem(KEYS.cachedLevel);
            removeItem(KEYS.cachedTime);
        }

        return {
            keys: KEYS,
            readSettings,
            writeSettings,
            readEvents,
            writeEvents,
            addEvent,
            deleteEventAt,
            readCustomDrinks,
            writeCustomDrinks,
            addCustomDrink,
            deleteCustomDrink,
            readUsage,
            writeUsage,
            recordUsage,
            pruneUsage,
            decayUsageIfNeeded,
            readCache,
            writeCache,
            clearCache,
        };
    }

    return {
        keys: KEYS,
        createStorage,
        createMemoryStorage,
    };
});
