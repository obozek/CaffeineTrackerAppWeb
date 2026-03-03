/**
 * Tests for the caffeine half-life wizard scoring engine.
 *
 * Run with:  node assets/halflife-wizard.test.js
 */

const {
    PRESETS,
    BASE_HALFLIFE,
    QUESTIONS,
    computeRawHalfLife,
    snapToPreset,
    computeHalfLife,
} = require("./halflife-wizard.js");

/* ── Tiny test harness ───────────────────────────────────────── */

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error("  FAIL:", msg);
    }
}

function approx(a, b, eps) {
    return Math.abs(a - b) < (eps || 0.01);
}

function section(name) {
    console.log("\n" + name);
}

/* ── Tests ───────────────────────────────────────────────────── */

section("CONFIG");
assert(PRESETS.length === 4, "Should have 4 presets");
assert(PRESETS[0] === 4, "First preset is 4");
assert(PRESETS[3] === 10, "Last preset is 10");
assert(BASE_HALFLIFE === 5, "Base half-life is 5 h");
assert(QUESTIONS.length >= 5, "Should have at least 5 questions");

section("QUESTIONS structure");
QUESTIONS.forEach(function (q) {
    assert(typeof q.id === "string" && q.id.length > 0, q.id + " has an id");
    assert(typeof q.title === "string", q.id + " has a title");
    assert(Array.isArray(q.options) && q.options.length >= 2, q.id + " has ≥2 options");
    q.options.forEach(function (o) {
        assert(typeof o.label === "string", q.id + "/" + o.value + " has label");
        assert(typeof o.value === "string", q.id + "/" + o.value + " has value");
        assert(typeof o.multiplier === "number" && o.multiplier > 0, q.id + "/" + o.value + " multiplier > 0");
    });
    // Every question should have a "neutral" option with multiplier 1.0
    var hasNeutral = q.options.some(function (o) { return o.multiplier === 1.0; });
    assert(hasNeutral, q.id + " has a neutral (1.0) option");
});

section("snapToPreset");
assert(snapToPreset(4) === 4, "4 → 4");
assert(snapToPreset(5.5) === 5.5, "5.5 → 5.5");
assert(snapToPreset(7.5) === 7.5, "7.5 → 7.5");
assert(snapToPreset(10) === 10, "10 → 10");
assert(snapToPreset(4.5) === 4, "4.5 → 4 (closer to 4)");
assert(snapToPreset(4.8) === 5.5, "4.8 → 5.5 (closer to 5.5)");
assert(snapToPreset(6.4) === 5.5, "6.4 → 5.5");
assert(snapToPreset(6.6) === 7.5, "6.6 → 7.5");
assert(snapToPreset(9) === 10, "9 → 10");
assert(snapToPreset(1) === 4, "1 → 4 (clamp low)");
assert(snapToPreset(100) === 10, "100 → 10 (clamp high)");

section("computeRawHalfLife — no answers (all neutral)");
var raw0 = computeRawHalfLife({});
assert(raw0 === BASE_HALFLIFE, "Empty answers → base (" + raw0 + ")");

section("computeRawHalfLife — all-neutral answers");
var neutralAnswers = {};
QUESTIONS.forEach(function (q) {
    var neutralOpt = q.options.find(function (o) { return o.multiplier === 1.0; });
    neutralAnswers[q.id] = neutralOpt.value;
});
var rawNeutral = computeRawHalfLife(neutralAnswers);
assert(rawNeutral === BASE_HALFLIFE, "All-neutral answers → base (" + rawNeutral + ")");

section("computeRawHalfLife — single factor: smoking 20+");
var rawSmoke = computeRawHalfLife({ smoking: "20+" });
assert(approx(rawSmoke, 5 * 0.6, 0.01), "Smoking 20+ → 3.0 h (" + rawSmoke + ")");

section("computeRawHalfLife — single factor: pregnancy 3rd trimester");
var rawPreg = computeRawHalfLife({ pregnancy: "t3" });
assert(approx(rawPreg, 5 * 3.5, 0.01), "Pregnancy t3 → 17.5 h (" + rawPreg + ")");

section("computeRawHalfLife — single factor: fluvoxamine");
var rawFluv = computeRawHalfLife({ medication: "fluvoxamine" });
assert(approx(rawFluv, 5 * 10, 0.01), "Fluvoxamine → 50 h (" + rawFluv + ")");

section("computeRawHalfLife — single factor: estrogen contraception");
var rawOC = computeRawHalfLife({ contraception: "estrogen" });
assert(approx(rawOC, 5 * 2.0, 0.01), "Estrogen OC → 10 h (" + rawOC + ")");

section("computeRawHalfLife — combined: smoking + obesity");
var rawCombo1 = computeRawHalfLife({ smoking: "10-19", obesity: "yes" });
assert(approx(rawCombo1, 5 * 0.7 * 1.1, 0.01), "Smoking 10-19 + BMI30 → 3.85 h (" + rawCombo1 + ")");

section("computeRawHalfLife — combined: age65 + liver mild + HRT");
var rawCombo2 = computeRawHalfLife({ age: "65+", liver: "mild", hrt: "yes" });
assert(approx(rawCombo2, 5 * 1.1 * 1.3 * 1.4, 0.01), "65+ + liver mild + HRT → " + (5*1.1*1.3*1.4) + " (" + rawCombo2 + ")");

section("computeHalfLife — full pipeline: healthy adult defaults");
var result1 = computeHalfLife(neutralAnswers);
assert(result1.raw === BASE_HALFLIFE, "Raw equals base");
assert(result1.preset === 5.5, "Snaps to 5.5 (closest to 5)");

section("computeHalfLife — full pipeline: heavy smoker");
var result2 = computeHalfLife({ smoking: "20+" });
assert(result2.preset === 4, "Heavy smoker → 4 h preset (raw " + result2.raw + ")");

section("computeHalfLife — full pipeline: estrogen contraception");
var result3 = computeHalfLife({ contraception: "estrogen" });
assert(result3.preset === 10, "Estrogen OC → 10 h preset (raw " + result3.raw + ")");

section("computeHalfLife — full pipeline: liver severe");
var result4 = computeHalfLife({ liver: "severe" });
assert(result4.preset === 10, "Severe liver → 10 h preset (raw " + result4.raw + ")");

section("computeHalfLife — full pipeline: mild liver + age 65");
var result5 = computeHalfLife({ liver: "mild", age: "65+" });
assert(approx(result5.raw, 5 * 1.3 * 1.1, 0.01), "Raw ≈ 7.15");
assert(result5.preset === 7.5, "Preset = 7.5 (raw " + result5.raw + ")");

section("computeHalfLife — full pipeline: smoker 1-9 + obesity");
var result6 = computeHalfLife({ smoking: "1-9", obesity: "yes" });
assert(approx(result6.raw, 5 * 0.8 * 1.1, 0.01), "Raw ≈ 4.4");
assert(result6.preset === 4, "Preset = 4 (raw " + result6.raw + ")");

section("computeRawHalfLife — single factor: CYP1A2 fast metabolizer (A/A)");
var rawAA = computeRawHalfLife({ cyp1a2: "AA" });
assert(approx(rawAA, 5 * 0.85, 0.01), "CYP1A2 A/A → 4.25 h (" + rawAA + ")");

section("computeRawHalfLife — single factor: CYP1A2 slow metabolizer (A/C or C/C)");
var rawAC = computeRawHalfLife({ cyp1a2: "AC_CC" });
assert(approx(rawAC, 5 * 1.15, 0.01), "CYP1A2 A/C or C/C → 5.75 h (" + rawAC + ")");

section("computeRawHalfLife — single factor: CYP1A2 unknown (neutral)");
var rawCypUnknown = computeRawHalfLife({ cyp1a2: "unknown" });
assert(rawCypUnknown === BASE_HALFLIFE, "CYP1A2 unknown → base (" + rawCypUnknown + ")");

section("computeHalfLife — combined: smoker 10-19 + CYP1A2 A/A (fast)");
var resultSmokeAA = computeHalfLife({ smoking: "10-19", cyp1a2: "AA" });
assert(approx(resultSmokeAA.raw, 5 * 0.7 * 0.85, 0.01), "Raw ≈ 2.975 (" + resultSmokeAA.raw + ")");
assert(resultSmokeAA.preset === 4, "Preset = 4");

section("computeHalfLife — combined: CYP1A2 slow + mild liver");
var resultCypLiver = computeHalfLife({ cyp1a2: "AC_CC", liver: "mild" });
assert(approx(resultCypLiver.raw, 5 * 1.15 * 1.3, 0.01), "Raw ≈ 7.475 (" + resultCypLiver.raw + ")");
assert(resultCypLiver.preset === 7.5, "Preset = 7.5");

section("computeRawHalfLife — unknown question id is ignored");
var rawUnknown = computeRawHalfLife({ nonexistent: "foo" });
assert(rawUnknown === BASE_HALFLIFE, "Unknown key ignored → base (" + rawUnknown + ")");

section("computeRawHalfLife — unknown option value is ignored");
var rawBadVal = computeRawHalfLife({ smoking: "bogus" });
assert(rawBadVal === BASE_HALFLIFE, "Unknown value ignored → base (" + rawBadVal + ")");

section("computeHalfLife — multiple strong factors stack multiplicatively");
var resultStack = computeHalfLife({ pregnancy: "t2", hrt: "yes" });
var expectedRaw = 5 * 2.0 * 1.4;
assert(approx(resultStack.raw, expectedRaw, 0.01), "Pregnancy t2 + HRT raw ≈ " + expectedRaw + " (" + resultStack.raw + ")");
assert(resultStack.preset === 10, "Stacked → 10 h preset");

/* ── Summary ─────────────────────────────────────────────────── */

console.log("\n========================================");
console.log("  " + passed + " passed, " + failed + " failed");
console.log("========================================\n");

process.exit(failed > 0 ? 1 : 0);
