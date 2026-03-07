/**
 * Caffeine Half-Life Wizard — German translations for QUESTIONS
 * Overrides the English QUESTIONS array from halflife-wizard.js
 * Scoring logic (multipliers, PRESETS, BASE_HALFLIFE) stays identical.
 */

const QUESTIONS_DE = [
    {
        id: "age",
        title: "Wie alt bist du?",
        subtitle: "Das Alter kann den Koffeinstoffwechsel beeinflussen.",
        sources: [
            { text: "Die Koffein-Halbwertszeit bei gesunden Erwachsenen beträgt typischerweise 1,5–9,5 h; ältere Erwachsene zeigen ähnliche Profile, aber mit höherer Unsicherheit.", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "Nawrot P et al. – Auswirkungen von Koffein auf die menschliche Gesundheit (Übersicht altersabhängiger Variabilität).", url: "https://pubmed.ncbi.nlm.nih.gov/12519715/" },
        ],
        options: [
            { label: "18–64",  value: "18-64",  multiplier: 1.0 },
            { label: "65+",    value: "65+",     multiplier: 1.1 },
        ],
    },
    {
        id: "pregnancy",
        title: "Bist du schwanger?",
        subtitle: "Schwangerschaft verlangsamt den Koffeinabbau erheblich.",
        sources: [
            { text: "Knutti R et al. – Einfluss der Schwangerschaft auf die Pharmakokinetik von Koffein (t½ ~8,3 h vs 3,4 h bei Kontrollen).", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "NCBI Bookshelf – Die Koffein-Halbwertszeit kann in der Spätschwangerschaft 15–18 h erreichen.", url: "https://www.ncbi.nlm.nih.gov/books/NBK223808/" },
            { text: "Aldridge A et al. – Koffeinstoffwechsel beim Neugeborenen (Übersicht der Schwangerschaftseffekte).", url: "https://pubmed.ncbi.nlm.nih.gov/6836474/" },
        ],
        options: [
            { label: "Nein",            value: "no",   multiplier: 1.0 },
            { label: "1. Trimester",    value: "t1",   multiplier: 1.2 },
            { label: "2. Trimester",    value: "t2",   multiplier: 2.0 },
            { label: "3. Trimester",    value: "t3",   multiplier: 3.5 },
        ],
    },
    {
        id: "contraception",
        title: "Verwendest du östrogenbasierte hormonelle Verhütung?",
        subtitle: "Kombinierte (Östrogen-)Pillen verdoppeln die Halbwertszeit ungefähr.",
        sources: [
            { text: "Abernethy DR & Todd EL – Beeinträchtigung der Koffeinclearance durch chronische Einnahme niedrig dosierter östrogenhaltiger oraler Kontrazeptiva (t½ 10,7 h vs 6,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
            { text: "Pollock BG et al. – Hemmung des Koffeinstoffwechsels durch Östradiol (Clearance ↓54–55%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "Nein",                                value: "no",       multiplier: 1.0 },
            { label: "Ja (kombiniert / Östrogen)",          value: "estrogen", multiplier: 2.0 },
            { label: "Nur Gestagen / Spirale",              value: "prog",     multiplier: 1.0 },
        ],
    },
    {
        id: "hrt",
        title: "Verwendest du Hormonersatztherapie (Östrogen)?",
        subtitle: "Östrogenbasierte HRT hemmt CYP1A2.",
        sources: [
            { text: "Pollock BG et al. – Auswirkungen von Östradiol und seinen Metaboliten auf die CYP1A2-Aktivität, gemessen am Koffein-Metabolismus-Verhältnis (↓29%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "Nein",  value: "no",  multiplier: 1.0 },
            { label: "Ja",    value: "yes", multiplier: 1.4 },
        ],
    },
    {
        id: "smoking",
        title: "Rauchst du Zigaretten?",
        subtitle: "Rauchen aktiviert das Leberenzym, das Koffein abbaut.",
        sources: [
            { text: "Parsons WD & Neims AH – Einfluss des Rauchens auf die Koffeinclearance (t½ 190 min vs 276 min bei Nichtrauchern).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Abernethy DR & Todd EL – Koffeindisposition bei Rauchern vs. Nichtrauchern (t½ ~3,5 h vs ~6,0 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
        ],
        options: [
            { label: "Nein",           value: "0",      multiplier: 1.0 },
            { label: "1–9 / Tag",      value: "1-9",    multiplier: 0.8 },
            { label: "10–19 / Tag",    value: "10-19",  multiplier: 0.7 },
            { label: "20+ / Tag",      value: "20+",    multiplier: 0.6 },
        ],
    },
    {
        id: "liver",
        title: "Hast du eine diagnostizierte Lebererkrankung?",
        subtitle: "Die Leber ist der primäre Ort des Koffeinstoffwechsels.",
        sources: [
            { text: "Frye RF et al. – Lebererkrankung und Koffein-Pharmakokinetik bei Intensivpatienten (t½ ~24 h vs ~7 h).", url: "https://pubmed.ncbi.nlm.nih.gov/16855463/" },
            { text: "Desmond PV et al. – Beeinträchtigte Koffeinelimination bei Zirrhose.", url: "https://pubmed.ncbi.nlm.nih.gov/7359946/" },
        ],
        options: [
            { label: "Nein",                                      value: "no",     multiplier: 1.0 },
            { label: "Leicht (z.B. Fettleber)",                   value: "mild",   multiplier: 1.3 },
            { label: "Schwer (z.B. Zirrhose, Hepatitis)",         value: "severe", multiplier: 4.0 },
        ],
    },
    {
        id: "medication",
        title: "Nimmst du regelmäßig eines dieser Medikamente?",
        subtitle: "Einige Medikamente hemmen oder induzieren CYP1A2 stark.",
        sources: [
            { text: "Jeppesen U et al. – Fluvoxamin hemmt den Koffeinstoffwechsel (t½ von ~5 h auf ~56 h).", url: "https://pubmed.ncbi.nlm.nih.gov/8841157/" },
            { text: "Healy DP et al. – Ciprofloxacin- und Koffein-Interaktion (t½ von 5,2 h auf 8,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/2643614/" },
            { text: "Parsons WD & Neims AH – Cimetidin-Hemmung der Koffeinelimination (t½ +45–96%).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Backman JT et al. (1995) – Rifampicin reduzierte die Koffein-t½ von 6,2 auf 3,5 h (p<0,004).", url: "https://pubmed.ncbi.nlm.nih.gov/7751591/" },
            { text: "Backman JT et al. (2006) – Rifampicin ist nur ein schwacher Induktor von CYP1A2.", url: "https://pubmed.ncbi.nlm.nih.gov/16758262/" },
        ],
        options: [
            { label: "Keines davon",    value: "none",          multiplier: 1.0 },
            { label: "Fluvoxamin",      value: "fluvoxamine",   multiplier: 10.0 },
            { label: "Ciprofloxacin",   value: "ciprofloxacin", multiplier: 1.6 },
            { label: "Cimetidin",       value: "cimetidine",    multiplier: 1.7 },
            { label: "Rifampicin",      value: "rifampicin",    multiplier: 0.75 },
        ],
    },
    {
        id: "obesity",
        title: "Ist dein BMI 30 oder höher?",
        subtitle: "Adipositas kann die Koffein-Halbwertszeit leicht erhöhen.",
        sources: [
            { text: "Abernethy DR et al. – Adipositas und Koffeindisposition (t½ 7,05 h vs 5,40 h, nur Trend).", url: "https://pubmed.ncbi.nlm.nih.gov/985663/" },
        ],
        options: [
            { label: "Nein / Weiß nicht",  value: "no",  multiplier: 1.0 },
            { label: "Ja (BMI ≥ 30)",      value: "yes", multiplier: 1.1 },
        ],
    },
    {
        id: "cyp1a2",
        title: "Kennst du deinen CYP1A2-Genotyp (z.B. von 23andMe)?",
        subtitle: "Das CYP1A2-Gen (rs762551) beeinflusst, wie induzierbar dein Koffeinstoffwechsel ist. Der Effekt ist am stärksten bei Rauchern; bei Nichtrauchern ist der Unterschied kleiner.",
        sources: [
            { text: "Sachse C et al. – Funktionelle Bedeutung eines C→A-Polymorphismus in Intron 1 des CYP1A2-Gens (A/A zeigt höhere Induzierbarkeit).", url: "https://pubmed.ncbi.nlm.nih.gov/10325023/" },
            { text: "Palatini P et al. – CYP1A2-Genotyp modifiziert den Zusammenhang zwischen Kaffeekonsum und Hypertonie-Risiko.", url: "https://pubmed.ncbi.nlm.nih.gov/19451835/" },
        ],
        options: [
            { label: "Weiß ich nicht",                      value: "unknown", multiplier: 1.0 },
            { label: "A/A — schneller Metabolisierer",       value: "AA",      multiplier: 0.9 },
            { label: "A/C — mittlerer Metabolisierer",       value: "AC",      multiplier: 1.0 },
            { label: "C/C — langsamer Metabolisierer",       value: "CC",      multiplier: 1.1 },
        ],
    },
];

// Override the global QUESTIONS for the German wizard
QUESTIONS = QUESTIONS_DE;
