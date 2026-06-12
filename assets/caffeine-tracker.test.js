const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("./caffeine-tracker-core.js");
const i18n = require("./caffeine-tracker-i18n.js");
const storageFactory = require("./caffeine-tracker-storage.js");
const ui = require("./caffeine-tracker-ui.js");

function approx(actual, expected, epsilon = 0.000001) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≈ ${expected}`);
}

function expectedRemainingWithAbsorption(mg, elapsedMinutes, halfLifeMinutes, absorptionMinutes = core.DEFAULT_ABSORPTION_MINUTES) {
    const eliminationRate = core.LN2 / halfLifeMinutes;
    const absorbedMinutes = Math.min(elapsedMinutes, absorptionMinutes);
    const amountDuringAbsorption = mg *
        (1 - Math.exp(-eliminationRate * absorbedMinutes)) /
        (eliminationRate * absorptionMinutes);

    if (elapsedMinutes <= absorptionMinutes) return amountDuringAbsorption;

    return amountDuringAbsorption * Math.exp(-eliminationRate * (elapsedMinutes - absorptionMinutes));
}

test("remainingMgAtTime starts at zero during default absorption", function () {
    const event = { name: "Espresso", mg: 64, time: 1_000 };
    approx(core.remainingMgAtTime(event, 1_000, 300), 0);
});

test("remainingMgAtTime metabolizes during default absorption", function () {
    const event = { name: "Espresso", mg: 64, time: 1_000 };
    const remaining = core.remainingMgAtTime(event, 1_000 + 15 * 60, 300);

    assert.ok(remaining < 32);
    approx(remaining, expectedRemainingWithAbsorption(64, 15, 300));
});

test("remainingMgAtTime returns peak dose minus metabolized amount after absorption", function () {
    const event = { name: "Espresso", mg: 64, time: 1_000 };
    const remaining = core.remainingMgAtTime(event, 1_000 + core.DEFAULT_ABSORPTION_MINUTES * 60, 300);

    assert.ok(remaining < 64);
    approx(remaining, expectedRemainingWithAbsorption(64, core.DEFAULT_ABSORPTION_MINUTES, 300));
});

test("remainingMgAtTime supports configured absorption duration", function () {
    const event = { name: "Espresso", mg: 64, time: 1_000 };
    approx(core.remainingMgAtTime(event, 1_000 + 15 * 60, 300, 15), expectedRemainingWithAbsorption(64, 15, 300, 15));
    approx(core.remainingMgAtTime(event, 1_000 + 60 * 60, 300, 60), expectedRemainingWithAbsorption(64, 60, 300, 60));
});

test("remainingMgAtTime returns half dose one half-life after absorption completes", function () {
    const event = { name: "Coffee", mg: 100, time: 1_000 };
    const peak = expectedRemainingWithAbsorption(100, core.DEFAULT_ABSORPTION_MINUTES, 300);

    approx(core.remainingMgAtTime(event, 1_000 + (core.DEFAULT_ABSORPTION_MINUTES + 300) * 60, 300), peak / 2);
});

test("future events do not contribute before their timestamp", function () {
    const event = { name: "Future", mg: 200, time: 2_000 };
    assert.equal(core.remainingMgAtTime(event, 1_999, 300), 0);
});

test("levelAtTime sums events and divides by apparent volume", function () {
    const events = [
        { name: "A", mg: 70, time: 1_000 },
        { name: "B", mg: 70, time: 1_000 },
    ];
    const expectedMg = expectedRemainingWithAbsorption(70, core.DEFAULT_ABSORPTION_MINUTES, 300) * 2;
    approx(core.levelAtTime(events, 1_000 + core.DEFAULT_ABSORPTION_MINUTES * 60, 300, 100), expectedMg / 70);
});

test("decayLevel matches half-life decay", function () {
    approx(core.decayLevel(2, 1_000, 1_000 + 300 * 60, 300), 1);
});

test("currentLevelFromCache decays when no scheduled event became due", function () {
    const absorptionSeconds = core.DEFAULT_ABSORPTION_MINUTES * 60;
    const result = core.currentLevelFromCache({
        events: [{ name: "Old", mg: 100, time: 1_000 - absorptionSeconds }],
        cachedLevel: 2,
        cachedTime: 1_000,
        nowSec: 1_000 + 300 * 60,
        settings: { halfLifeMinutes: 300, weightKg: 70 },
    });

    assert.equal(result.recomputed, false);
    approx(result.level, 1);
});

test("currentLevelFromCache recomputes when a scheduled event becomes due", function () {
    const result = core.currentLevelFromCache({
        events: [{ name: "Scheduled", mg: 49, time: 1_500 }],
        cachedLevel: 0,
        cachedTime: 1_000,
        nowSec: 1_500 + core.DEFAULT_ABSORPTION_MINUTES * 60,
        settings: { halfLifeMinutes: 300, weightKg: 70 },
    });

    assert.equal(result.recomputed, true);
    assert.ok(result.level > 0.9);
});

test("currentLevelFromCache recomputes while a drink is still absorbing", function () {
    const result = core.currentLevelFromCache({
        events: [{ name: "Coffee", mg: 49, time: 1_000 }],
        cachedLevel: 0,
        cachedTime: 1_000,
        nowSec: 1_000 + 15 * 60,
        settings: { halfLifeMinutes: 300, weightKg: 70 },
    });

    assert.equal(result.recomputed, true);
    approx(result.level, expectedRemainingWithAbsorption(49, 15, 300) / 49);
});

test("local day boundaries are local calendar boundaries", function () {
    const date = new Date(2026, 5, 5, 13, 30, 0);
    const start = core.localDayStartSec(date);
    const end = core.localDayEndSec(date);

    assert.equal(new Date(start * 1000).getHours(), 0);
    assert.equal(new Date(start * 1000).getMinutes(), 0);
    assert.equal(new Date(end * 1000).getDate(), new Date(2026, 5, 6).getDate());
});

test("formatTime supports 24-hour display locales", function () {
    const timeSec = Math.floor(new Date(2026, 5, 5, 13, 5, 0).getTime() / 1000);
    const formatted = core.formatTime(timeSec, "en-GB");

    assert.match(formatted, /13:05/);
    assert.doesNotMatch(formatted, /AM|PM/i);
});

test("resolveTimeLocale follows browser locale for generic English pages", function () {
    assert.equal(ui.resolveTimeLocale("en", "en", "en-US"), "en-US");
    assert.equal(ui.resolveTimeLocale("en", "en", "en-CA"), "en-CA");
    assert.equal(ui.resolveTimeLocale("en", "en", undefined), undefined);
});

test("resolveTimeLocale keeps regional page locale and localized defaults", function () {
    assert.equal(ui.resolveTimeLocale("en", "en-AU", "en-US"), "en-AU");
    assert.equal(ui.resolveTimeLocale("de", "de", "en-US"), "de-DE");
    assert.equal(ui.resolveTimeLocale("es", "es", "en-US"), "es-ES");
    assert.equal(ui.resolveTimeLocale("pl", "pl", "en-US"), "pl-PL");
});

test("graphDataForRange returns requested point count and fixed max scale", function () {
    const graph = core.graphDataForRange({
        events: [],
        startSec: 0,
        endSec: 86_400,
        points: 96,
        includeCurrentTimeRatio: true,
        nowSec: 43_200,
        halfLifeMinutes: 300,
        weightKg: 70,
        userThreshold: 0.6,
    });

    assert.equal(graph.points.length, 96);
    assert.equal(graph.levelPoints.length, 96);
    assert.equal(graph.maxLevel, 15);
    approx(graph.currentTimeRatio, 0.5);
});

test("graphDataForRange excludes future events until samples reach event time", function () {
    const graph = core.graphDataForRange({
        events: [{ name: "Future", mg: 49, time: 60 }],
        startSec: 0,
        endSec: 3_660,
        points: 3,
        nowSec: 0,
        halfLifeMinutes: 300,
        weightKg: 70,
        userThreshold: 0.6,
    });

    assert.equal(graph.points[0].level, 0);
    assert.ok(graph.points[1].level > 0.9);
});

test("lowerThanTime uses the post-absorption reference point", function () {
    const event = { name: "Coffee", mg: 490, time: 0 };
    const crossing = core.lowerThanTime([event], 5, 300, 70);
    const peakLevel = expectedRemainingWithAbsorption(490, core.DEFAULT_ABSORPTION_MINUTES, 300) / 49;
    const minutesAfterAbsorption = Math.round(-Math.log(5 / peakLevel) / (core.LN2 / 300));

    assert.equal(crossing, (core.DEFAULT_ABSORPTION_MINUTES + minutesAfterAbsorption) * 60);
});

test("lowerThanTime returns null without usable events", function () {
    assert.equal(core.lowerThanTime([], 0.6, 300, 70), null);
    assert.equal(core.lowerThanTime([{ name: "A", mg: 0, time: 1 }], 0.6, 300, 70), null);
});

test("pruneEvents removes events older than 48 hours", function () {
    const now = 200_000;
    const events = [
        { name: "Old", mg: 1, time: now - core.EVENT_RETENTION_SECONDS - 1 },
        { name: "Kept", mg: 1, time: now - core.EVENT_RETENTION_SECONDS },
        { name: "Recent", mg: 1, time: now },
    ];

    assert.deepEqual(core.pruneEvents(events, now).map((event) => event.name), ["Kept", "Recent"]);
});

test("pruneEvents caps stored events at 50 and drops oldest", function () {
    const events = Array.from({ length: 60 }, function (_, index) {
        return { name: `E${index}`, mg: 1, time: index };
    });

    const pruned = core.pruneEvents(events, 60);
    assert.equal(pruned.length, 50);
    assert.equal(pruned[0].name, "E10");
    assert.equal(pruned[49].name, "E59");
});

test("uniqueDrinkName appends numeric suffixes case-insensitively", function () {
    const name = core.uniqueDrinkName("Espresso", ["espresso", "Espresso 2"]);
    assert.equal(name, "Espresso 3");
});

test("addCustomDrink trims names and applies default name", function () {
    const drinks = core.addCustomDrink([], "   ", 80, []);
    assert.deepEqual(drinks, [{ name: "Custom Drink", mg: 80 }]);
});

test("smart sorting orders by score with stable tie-break", function () {
    const drinks = [
        { key: "a", name: "A" },
        { key: "b", name: "B" },
        { key: "c", name: "C" },
    ];
    const sorted = core.sortDrinksByUsage(drinks, {
        b: { score: 2, lastUsed: 1 },
        c: { score: 2, lastUsed: 99 },
        a: { score: 1, lastUsed: 2 },
    }, true);

    assert.deepEqual(sorted.map((drink) => drink.key), ["b", "c", "a"]);
});

test("smart sorting can be disabled", function () {
    const drinks = [{ key: "a" }, { key: "b" }];
    const sorted = core.sortDrinksByUsage(drinks, { b: { score: 10, lastUsed: 1 } }, false);
    assert.deepEqual(sorted.map((drink) => drink.key), ["a", "b"]);
});

test("recordDrinkUsage increments score and records last used time", function () {
    const usage = core.recordDrinkUsage({ espresso: { score: 2, lastUsed: 1 } }, "espresso", 100);
    assert.deepEqual(usage.espresso, { score: 3, lastUsed: 100 });
});

test("daily usage decay multiplies scores by 0.85", function () {
    const today = new Date(2026, 5, 5, 12, 0, 0);
    const yesterday = new Date(2026, 5, 4, 12, 0, 0);
    const result = core.decayDrinkUsageForDay({
        usage: { a: { score: 10, lastUsed: 1 } },
        lastInteraction: Math.floor(yesterday.getTime() / 1000),
        lastDecayDay: core.localDayKey(yesterday),
        nowSec: Math.floor(today.getTime() / 1000),
    });

    assert.equal(result.decayed, true);
    approx(result.usage.a.score, 8.5);
    assert.equal(result.lastDecayDay, core.localDayKey(today));
});

test("daily usage decay freezes after more than 3 inactive days", function () {
    const now = new Date(2026, 5, 10, 12, 0, 0);
    const last = new Date(2026, 5, 5, 12, 0, 0);
    const result = core.decayDrinkUsageForDay({
        usage: { a: { score: 10, lastUsed: 1 } },
        lastInteraction: Math.floor(last.getTime() / 1000),
        lastDecayDay: core.localDayKey(last),
        nowSec: Math.floor(now.getTime() / 1000),
    });

    assert.equal(result.decayed, false);
    assert.equal(result.usage.a.score, 10);
    assert.equal(result.lastDecayDay, core.localDayKey(now));
});

test("normalizeSettings supports kg and lb", function () {
    const settings = core.normalizeSettings({ weightValue: 154.3234, weightUnit: "lb" });
    approx(settings.weightKg, 70, 0.01);
    approx(core.weightFromKg(settings.weightKg, "lb"), 154.3234, 0.01);
});

test("normalizeSettings defaults caffeine absorption to 30 minutes", function () {
    const settings = core.normalizeSettings({});

    assert.equal(settings.absorptionMinutes, 30);
});

test("absorption options expose supported duration presets", function () {
    assert.deepEqual(core.ABSORPTION_OPTIONS.map((option) => option.minutes), [15, 30, 45, 60]);
});

test("half-life options expose supported metabolism presets", function () {
    assert.deepEqual(core.HALFLIFE_OPTIONS.map((option) => option.minutes), [180, 240, 300, 360, 480, 600]);
});

test("normalizeSettings clamps invalid values to safe defaults", function () {
    const settings = core.normalizeSettings({
        halfLifeMinutes: -1,
        absorptionMinutes: -1,
        weightKg: -5,
        weightUnit: "stone",
        belowAtThresholdMgPerL: 99,
        smartSorting: "yes",
    });

    assert.equal(settings.halfLifeMinutes, 30);
    assert.equal(settings.absorptionMinutes, 30);
    assert.equal(settings.weightKg, 1);
    assert.equal(settings.weightUnit, "kg");
    assert.equal(settings.belowAtThresholdMgPerL, 1.5);
    assert.equal(settings.smartSorting, true);
});

test("i18n dictionaries contain the required keys and preset labels", function () {
    const requiredKeys = Object.keys(i18n.get("en"));
    const presetIds = core.PRESET_DRINKS.map((drink) => drink.id);

    ["en", "de", "es", "pl"].forEach(function (lang) {
        const dict = i18n.get(lang);
        requiredKeys.forEach(function (key) {
            assert.ok(Object.prototype.hasOwnProperty.call(dict, key), `${lang} has ${key}`);
        });
        presetIds.forEach(function (id) {
            assert.ok(dict.presetNames[id], `${lang} has preset ${id}`);
        });
    });
});

test("storage readCache treats missing values as an empty cache", function () {
    const storage = storageFactory.createStorage(storageFactory.createMemoryStorage());
    assert.deepEqual(storage.readCache(), { level: null, time: null });
});

test("storage readSettings migrates absorption default and clears stale cache", function () {
    const backing = storageFactory.createMemoryStorage();
    backing.setItem("settings", JSON.stringify({
        halfLifeMinutes: 300,
        weightKg: 70,
        weightUnit: "kg",
        belowAtThresholdMgPerL: 0.6,
        smartSorting: true,
    }));
    backing.setItem("cachedCaffeineLevel", "2");
    backing.setItem("cachedTime", "1000");

    const storage = storageFactory.createStorage(backing);
    const settings = storage.readSettings();

    assert.equal(settings.absorptionMinutes, 30);
    assert.deepEqual(storage.readCache(), { level: null, time: null });
});

test("storage normalizes and prunes events on write", function () {
    const storage = storageFactory.createStorage(storageFactory.createMemoryStorage());
    const now = 200_000;
    storage.writeEvents([
        { name: "Old", mg: 10, time: now - core.EVENT_RETENTION_SECONDS - 1 },
        { name: "  Coffee  ", mg: 95.2, time: now },
        { name: "", mg: -1, time: "bad" },
    ], now);

    assert.deepEqual(storage.readEvents(now), [{ name: "Coffee", mg: 95, time: now }]);
});
