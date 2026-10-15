const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const core = require("../assets/caffeine-tracker-core.js");

// A fresh process gives Date/Intl an explicit browser-zone analogue without
// mutating the test runner's timezone or relying on the developer's locale.
function inZone(zone, expression) {
    const script = `const core = require(${JSON.stringify(require.resolve("../assets/caffeine-tracker-core.js"))});
        process.stdout.write(JSON.stringify(${expression}));`;
    return JSON.parse(execFileSync(process.execPath, ["-e", script], {
        env: { ...process.env, TZ: zone }, encoding: "utf8",
    }));
}
const sec = iso => Date.parse(iso) / 1000;

for (const fixture of [
    ["Europe/Prague", "2026-03-29T12:00:00Z", "2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z", 23],
    ["Europe/Prague", "2026-10-25T12:00:00Z", "2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z", 25],
    ["America/New_York", "2026-03-08T12:00:00Z", "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z", 23],
    ["America/New_York", "2026-11-01T12:00:00Z", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z", 25],
]) {
    const [zone, instant, start, end, hours] = fixture;
    test(`standalone calendar day: ${zone} ${instant}`, () => {
        const actual = inZone(zone, `({start:core.localDayStartSec(${sec(instant)}), end:core.localDayEndSec(${sec(instant)})})`);
        assert.deepEqual(actual, { start: sec(start), end: sec(end) });
        assert.equal(actual.end - actual.start, hours * 3600);
        // Watch getTodayGraphData currently adds a fixed 86400 seconds.
        assert.notEqual(actual.end, actual.start + 86400);
    });
}

test("a different browser zone changes local midnight and repeated-hour labels", () => {
    const instant = sec("2026-10-25T01:30:00Z");
    const expression = `({start:core.localDayStartSec(${instant}), labels:[core.formatTime(${instant - 3600}, "en-GB"),core.formatTime(${instant}, "en-GB")]})`;
    const prague = inZone("Europe/Prague", expression);
    assert.equal(prague.start, sec("2026-10-24T22:00:00Z"));
    assert.match(prague.labels[0], /^0?2:30$/);
    assert.equal(prague.labels[0], prague.labels[1]);
    assert.deepEqual(inZone("America/New_York", expression), {
        start: sec("2026-10-24T04:00:00Z"), labels: ["20:30", "21:30"],
    });
});

test("explicit graph instants survive browser-zone differences on a 23-hour day", () => {
    const startSec = sec("2026-03-28T23:00:00Z");
    const endSec = sec("2026-03-29T22:00:00Z");
    const events = [{ time: startSec - 900, mg: 80 },
        { time: startSec + 5400, mg: 100 }, { time: startSec + 9000, mg: 64 }];
    const options = { events, startSec, endSec, points: 4,
        halfLifeMinutes: 300, absorptionMinutes: 30, weightKg: 70,
        includeCurrentTimeRatio: true, nowSec: endSec };
    const expression = `core.graphDataForRange(${JSON.stringify(options)})`;
    const prague = inZone("Europe/Prague", expression);
    assert.deepEqual(prague, inZone("America/New_York", expression));
    assert.deepEqual(prague.points.map(p => p.time),
        [startSec, startSec + 27600, startSec + 55200, endSec]);
    // Independent 55-digit Decimal references: carry-in absorption and drinks
    // on both sides of the spring DST jump; calculations use UTC instants.
    const expectedLevels = [0.8023426830138473, 2.123759243534742, 0.7337125631478202, 0.2534817103020357];
    prague.levelPoints.forEach((level, index) => {
        assert.ok(Math.abs(level - expectedLevels[index]) <= 0.000001,
            `DST graph sample ${index}: expected ${expectedLevels[index]}, got ${level}`);
    });
    assert.equal(prague.currentTimeRatio, 1);
});

test("standalone clamps clock-skew markers to the visible range", () => {
    for (const [nowSec, expected] of [[-3600, 0], [90000, 1]]) {
        const graph = core.graphDataForRange({ events: [], startSec: 0, endSec: 86400,
            points: 4, includeCurrentTimeRatio: true, nowSec });
        assert.equal(graph.currentTimeRatio, expected);
    }
});

test("standalone retains its fixed scale even when a peak exceeds it", () => {
    const graph = core.graphDataForRange({ events: [{ time: 0, mg: 500 }],
        startSec: 0, endSec: 3600, points: 3, halfLifeMinutes: 300,
        absorptionMinutes: 30, weightKg: 1, nowSec: 0 });
    assert.equal(graph.maxLevel, 15);
    assert.ok(graph.levelPoints[1] > graph.maxLevel);
});

test("standalone annotation includes carry-in and events beyond the graph end", () => {
    for (const eventTime of [-900, 86401]) {
        const events = [{ time: eventTime, mg: 100 }];
        const graph = core.graphDataForRange({ events, startSec: 0, endSec: 86400,
            points: 4, halfLifeMinutes: 300, absorptionMinutes: 30,
            weightKg: 70, userThreshold: 0.6, nowSec: 0 });
        // Independent analytic projection: 100 mg / 49 L reaches 0.6 mg/L
        // 515 rounded minutes after absorption completes.
        assert.equal(graph.belowAtTime, eventTime + 1800 + 515 * 60);
    }
});
