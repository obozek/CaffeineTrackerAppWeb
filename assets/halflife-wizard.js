/**
 * Caffeine Half-Life Wizard — scoring engine
 *
 * Multiplicative model: t½_est = BASE_HALFLIFE × Π(multipliers)
 * The final value is snapped to the nearest supported preset.
 *
 * To tweak behaviour, edit QUESTIONS (weights) or PRESETS below.
 * Each question has an `id`, display strings, and `options` with a `multiplier`.
 */

/* ── Presets (the four values the widget supports) ───────────── */

const PRESETS = [4, 5.5, 7.5, 10];          // hours

/* ── Baseline ────────────────────────────────────────────────── */

const BASE_HALFLIFE = 5;                     // hours (healthy adult, no modifiers)

/* ── Questions & weights ─────────────────────────────────────── */

const QUESTIONS = [
    {
        id: "age",
        title: "How old are you?",
        subtitle: "Age can affect caffeine metabolism.",
        sources: [
            { text: "Caffeine half-life in healthy adults is typically 1.5–9.5 h; older adults show similar profiles but with higher uncertainty.", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "Nawrot P et al. – Effects of caffeine on human health (review of age-related variability).", url: "https://pubmed.ncbi.nlm.nih.gov/12519715/" },
        ],
        options: [
            { label: "18–64",  value: "18-64",  multiplier: 1.0 },
            { label: "65+",    value: "65+",     multiplier: 1.1 },
        ],
    },
    {
        id: "pregnancy",
        title: "Are you pregnant?",
        subtitle: "Pregnancy significantly slows caffeine clearance.",
        sources: [
            { text: "Knutti R et al. – Effect of pregnancy on the pharmacokinetics of caffeine (t½ ~8.3 h vs 3.4 h in controls).", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "NCBI Bookshelf – Caffeine half-life may reach 15–18 h in late pregnancy.", url: "https://www.ncbi.nlm.nih.gov/books/NBK223808/" },
            { text: "Aldridge A et al. – Caffeine metabolism in the newborn (review of pregnancy effects).", url: "https://pubmed.ncbi.nlm.nih.gov/6836474/" },
        ],
        options: [
            { label: "No",            value: "no",   multiplier: 1.0 },
            { label: "1st trimester", value: "t1",   multiplier: 1.2 },
            { label: "2nd trimester", value: "t2",   multiplier: 2.0 },
            { label: "3rd trimester", value: "t3",   multiplier: 3.5 },
        ],
    },
    {
        id: "contraception",
        title: "Do you use estrogen-based hormonal contraception?",
        subtitle: "Combined (estrogen) pills roughly double the half-life.",
        sources: [
            { text: "Abernethy DR & Todd EL – Impairment of caffeine clearance by chronic use of low-dose oestrogen-containing oral contraceptives (t½ 10.7 h vs 6.2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
            { text: "Pollock BG et al. – Inhibition of caffeine metabolism by estradiol (clearance ↓54–55%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "No",                          value: "no",       multiplier: 1.0 },
            { label: "Yes (combined / estrogen)",   value: "estrogen", multiplier: 2.0 },
            { label: "Progestin-only / IUD",        value: "prog",     multiplier: 1.0 },
        ],
    },
    {
        id: "hrt",
        title: "Do you use hormone replacement therapy (estrogen)?",
        subtitle: "Estrogen-based HRT inhibits CYP1A2.",
        sources: [
            { text: "Pollock BG et al. – Effects of estradiol and its metabolites on CYP1A2 activity measured by caffeine metabolic ratio (↓29%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "No",  value: "no",  multiplier: 1.0 },
            { label: "Yes", value: "yes", multiplier: 1.4 },
        ],
    },
    {
        id: "smoking",
        title: "Do you smoke combustible cigarettes?",
        subtitle: "Smoking induces the liver enzyme that clears caffeine.",
        sources: [
            { text: "Parsons WD & Neims AH – Effect of smoking on caffeine clearance (t½ 190 min vs 276 min in non-smokers).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Abernethy DR & Todd EL – Caffeine disposition in smokers vs non-smokers (t½ ~3.5 h vs ~6.0 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
        ],
        options: [
            { label: "No",          value: "0",     multiplier: 1.0 },
            { label: "1–9 / day",   value: "1-9",   multiplier: 0.8 },
            { label: "10–19 / day", value: "10-19",  multiplier: 0.7 },
            { label: "20+ / day",   value: "20+",    multiplier: 0.6 },
        ],
    },
    {
        id: "liver",
        title: "Do you have a diagnosed liver disease?",
        subtitle: "The liver is the primary site of caffeine metabolism.",
        sources: [
            { text: "Frye RF et al. – Liver disease and caffeine pharmacokinetics in ICU patients (t½ ~24 h vs ~7 h).", url: "https://pubmed.ncbi.nlm.nih.gov/16855463/" },
            { text: "Desmond PV et al. – Impaired caffeine elimination in cirrhosis.", url: "https://pubmed.ncbi.nlm.nih.gov/7359946/" },
        ],
        options: [
            { label: "No",                                   value: "no",     multiplier: 1.0 },
            { label: "Mild (e.g. fatty liver)",              value: "mild",   multiplier: 1.3 },
            { label: "Severe (e.g. cirrhosis, hepatitis)",   value: "severe", multiplier: 4.0 },
        ],
    },
    {
        id: "medication",
        title: "Do you regularly take any of these medications?",
        subtitle: "Some drugs strongly inhibit or induce CYP1A2.",
        sources: [
            { text: "Jeppesen U et al. – Fluvoxamine inhibits caffeine metabolism (t½ from ~5 h to ~56 h).", url: "https://pubmed.ncbi.nlm.nih.gov/8841157/" },
            { text: "Healy DP et al. – Ciprofloxacin and caffeine interaction (t½ from 5.2 h to 8.2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/2643614/" },
            { text: "Parsons WD & Neims AH – Cimetidine inhibition of caffeine elimination (t½ +45–96%).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Backman JT et al. (1995) – Rifampin reduced caffeine t½ from 6.2 to 3.5 h (p<0.004).", url: "https://pubmed.ncbi.nlm.nih.gov/7751591/" },
            { text: "Backman JT et al. (2006) – Rifampicin is only a weak inducer of CYP1A2 (caffeine ratio ∙23%, NS).", url: "https://pubmed.ncbi.nlm.nih.gov/16758262/" },
        ],
        options: [
            { label: "None of these",  value: "none",          multiplier: 1.0 },
            { label: "Fluvoxamine",    value: "fluvoxamine",   multiplier: 10.0 },
            { label: "Ciprofloxacin",  value: "ciprofloxacin", multiplier: 1.6 },
            { label: "Cimetidine",     value: "cimetidine",    multiplier: 1.7 },
            { label: "Rifampicin",     value: "rifampicin",    multiplier: 0.75 },
        ],
    },
    {
        id: "obesity",
        title: "Is your BMI 30 or above?",
        subtitle: "Obesity may mildly increase caffeine half-life.",
        sources: [
            { text: "Abernethy DR et al. – Obesity and caffeine disposition (t½ 7.05 h vs 5.40 h, trend only).", url: "https://pubmed.ncbi.nlm.nih.gov/985663/" },
        ],
        options: [
            { label: "No / I don't know", value: "no",  multiplier: 1.0 },
            { label: "Yes (BMI ≥ 30)",    value: "yes", multiplier: 1.1 },
        ],
    },
    {
        id: "cyp1a2",
        title: "Do you know your CYP1A2 genotype (e.g. from 23andMe)?",
        subtitle: "The CYP1A2 gene (rs762551) affects how inducible your caffeine metabolism is. The effect is strongest in smokers; in non-smokers the difference is smaller.",
        sources: [
            { text: "Sachse C et al. – Functional significance of a C→A polymorphism in intron 1 of the CYP1A2 gene (A/A shows higher inducibility).", url: "https://pubmed.ncbi.nlm.nih.gov/10325023/" },
            { text: "Palatini P et al. – CYP1A2 genotype modifies the association between coffee intake and the risk of hypertension.", url: "https://pubmed.ncbi.nlm.nih.gov/19451835/" },
        ],
        options: [
            { label: "I don't know",                    value: "unknown", multiplier: 1.0 },
            { label: "A/A — fast metabolizer",          value: "AA",      multiplier: 0.9 },
            { label: "A/C — intermediate metabolizer",  value: "AC",      multiplier: 1.0 },
            { label: "C/C — slow metabolizer",          value: "CC",      multiplier: 1.1 },
        ],
    },
];

/* ── Pure scoring helpers ────────────────────────────────────── */

/**
 * Compute the raw estimated half-life from a set of answers.
 * @param {Object<string,string>} answers  — map of questionId → selected option value
 * @returns {number} raw half-life in hours (before snapping)
 */
function computeRawHalfLife(answers) {
    let product = BASE_HALFLIFE;
    for (const q of QUESTIONS) {
        const chosen = answers[q.id];
        if (chosen == null) continue;                     // unanswered → neutral
        const opt = q.options.find(o => o.value === chosen);
        if (!opt) continue;
        product *= opt.multiplier;
    }
    return product;
}

/**
 * Snap a raw value to the nearest preset.
 * @param {number} raw
 * @returns {number} one of PRESETS
 */
function snapToPreset(raw) {
    let best = PRESETS[0];
    let bestDist = Math.abs(raw - best);
    for (let i = 1; i < PRESETS.length; i++) {
        const d = Math.abs(raw - PRESETS[i]);
        if (d < bestDist) { best = PRESETS[i]; bestDist = d; }
    }
    return best;
}

/**
 * Full pipeline: answers → snapped preset.
 * @param {Object<string,string>} answers
 * @returns {{ raw: number, preset: number }}
 */
function computeHalfLife(answers) {
    const raw = computeRawHalfLife(answers);
    return { raw: Math.round(raw * 100) / 100, preset: snapToPreset(raw) };
}

/* ── Exports (for tests or ES-module consumers) ─────────────── */

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        PRESETS,
        BASE_HALFLIFE,
        QUESTIONS,
        computeRawHalfLife,
        snapToPreset,
        computeHalfLife,
    };
}
