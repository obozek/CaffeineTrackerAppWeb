const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/caffeine-tracker-core.js");
const data = require("./fixtures/caffeine-companion-model-v1.json");

// Characterize the current standalone API. Known differences are preserved
// here; the later connected adapter must pass every golden sample unchanged.
for (const fixture of data.fixtures) {
    test(`companion baseline: ${fixture.id}`, () => {
        const effectiveVolume = fixture.apparentVolumeLiters > 0 ? fixture.apparentVolumeLiters : 1;
        const differences = fixture.samples.map(sample => {
            const actual = core.levelAtTime(fixture.events, sample.time,
                fixture.halfLifeMinutes, effectiveVolume / 0.7, fixture.absorptionMinutes);
            assert.ok(Number.isFinite(actual), "Standalone output must be finite");
            return Math.abs(actual - sample.levelMgPerL);
        });
        const maxError = Math.max(...differences);
        if (fixture.standaloneParity) {
            assert.ok(maxError <= data.toleranceMgPerL, `${fixture.id}: ${maxError} mg/L`);
        } else {
            assert.ok(maxError > 0.000001, `Expected documented difference: ${fixture.reason}`);
        }
    });
}

test("standalone graph samples an end-inclusive grid", () => {
    const graph = core.graphDataForRange({ events: [], startSec: 0, endSec: 86400,
        points: 4, halfLifeMinutes: 300, absorptionMinutes: 30, weightKg: 70, nowSec: 0 });
    assert.deepEqual(graph.points.map(point => point.time), [0, 28800, 57600, 86400]);
    // Watch computeGraphDataForRange uses range / points, excluding the end.
    // Connected sample-grid alignment is future work; preserve local behavior.
    assert.notDeepEqual(graph.points.map(point => point.time), [0, 21600, 43200, 64800]);
});
