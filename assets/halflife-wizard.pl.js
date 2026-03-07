/**
 * Caffeine Half-Life Wizard — Polish translations for QUESTIONS
 * Overrides the English QUESTIONS array from halflife-wizard.js
 * Scoring logic (multipliers, PRESETS, BASE_HALFLIFE) stays identical.
 */

const QUESTIONS_PL = [
    {
        id: "age",
        title: "Ile masz lat?",
        subtitle: "Wiek może wpływać na metabolizm kofeiny.",
        sources: [
            { text: "Okres półtrwania kofeiny u zdrowych dorosłych wynosi zazwyczaj 1,5–9,5 h; starsi dorośli wykazują podobne profile, ale z większą niepewnością.", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "Nawrot P et al. – Wpływ kofeiny na zdrowie człowieka (przegląd zmienności związanej z wiekiem).", url: "https://pubmed.ncbi.nlm.nih.gov/12519715/" },
        ],
        options: [
            { label: "18–64",  value: "18-64",  multiplier: 1.0 },
            { label: "65+",    value: "65+",     multiplier: 1.1 },
        ],
    },
    {
        id: "pregnancy",
        title: "Czy jesteś w ciąży?",
        subtitle: "Ciąża znacząco spowalnia eliminację kofeiny.",
        sources: [
            { text: "Knutti R et al. – Wpływ ciąży na farmakokinetykę kofeiny (t½ ~8,3 h vs 3,4 h u grupy kontrolnej).", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "NCBI Bookshelf – Okres półtrwania kofeiny może osiągnąć 15–18 h w późnej ciąży.", url: "https://www.ncbi.nlm.nih.gov/books/NBK223808/" },
            { text: "Aldridge A et al. – Metabolizm kofeiny u noworodka (przegląd efektów ciąży).", url: "https://pubmed.ncbi.nlm.nih.gov/6836474/" },
        ],
        options: [
            { label: "Nie",             value: "no",   multiplier: 1.0 },
            { label: "1. trymestr",     value: "t1",   multiplier: 1.2 },
            { label: "2. trymestr",     value: "t2",   multiplier: 2.0 },
            { label: "3. trymestr",     value: "t3",   multiplier: 3.5 },
        ],
    },
    {
        id: "contraception",
        title: "Czy stosujesz antykoncepcję hormonalną opartą na estrogenach?",
        subtitle: "Tabletki kombinowane (estrogenowe) mniej więcej podwajają okres półtrwania.",
        sources: [
            { text: "Abernethy DR & Todd EL – Upośledzenie klirensu kofeiny przez przewlekłe stosowanie doustnych środków antykoncepcyjnych z niską dawką estrogenu (t½ 10,7 h vs 6,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
            { text: "Pollock BG et al. – Hamowanie metabolizmu kofeiny przez estradiol (klirens ↓54–55%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "Nie",                                    value: "no",       multiplier: 1.0 },
            { label: "Tak (kombinowane / estrogenowe)",        value: "estrogen", multiplier: 2.0 },
            { label: "Tylko progestagen / wkładka",            value: "prog",     multiplier: 1.0 },
        ],
    },
    {
        id: "hrt",
        title: "Czy stosujesz hormonalną terapię zastępczą (estrogen)?",
        subtitle: "HTZ oparta na estrogenach hamuje CYP1A2.",
        sources: [
            { text: "Pollock BG et al. – Wpływ estradiolu i jego metabolitów na aktywność CYP1A2 mierzoną współczynnikiem metabolizmu kofeiny (↓29%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "Nie",  value: "no",  multiplier: 1.0 },
            { label: "Tak",  value: "yes", multiplier: 1.4 },
        ],
    },
    {
        id: "smoking",
        title: "Czy palisz papierosy?",
        subtitle: "Palenie indukuje enzym wątrobowy, który eliminuje kofeinę.",
        sources: [
            { text: "Parsons WD & Neims AH – Wpływ palenia na klirens kofeiny (t½ 190 min vs 276 min u niepalących).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Abernethy DR & Todd EL – Dyspozycja kofeiny u palaczy vs niepalących (t½ ~3,5 h vs ~6,0 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
        ],
        options: [
            { label: "Nie",            value: "0",      multiplier: 1.0 },
            { label: "1–9 / dzień",    value: "1-9",    multiplier: 0.8 },
            { label: "10–19 / dzień",  value: "10-19",  multiplier: 0.7 },
            { label: "20+ / dzień",    value: "20+",    multiplier: 0.6 },
        ],
    },
    {
        id: "liver",
        title: "Czy masz zdiagnozowaną chorobę wątroby?",
        subtitle: "Wątroba jest głównym miejscem metabolizmu kofeiny.",
        sources: [
            { text: "Frye RF et al. – Choroba wątroby i farmakokinetyka kofeiny u pacjentów OIT (t½ ~24 h vs ~7 h).", url: "https://pubmed.ncbi.nlm.nih.gov/16855463/" },
            { text: "Desmond PV et al. – Upośledzona eliminacja kofeiny w marskości wątroby.", url: "https://pubmed.ncbi.nlm.nih.gov/7359946/" },
        ],
        options: [
            { label: "Nie",                                         value: "no",     multiplier: 1.0 },
            { label: "Łagodna (np. stłuszczenie wątroby)",          value: "mild",   multiplier: 1.3 },
            { label: "Ciężka (np. marskość, zapalenie wątroby)",    value: "severe", multiplier: 4.0 },
        ],
    },
    {
        id: "medication",
        title: "Czy regularnie przyjmujesz któryś z tych leków?",
        subtitle: "Niektóre leki silnie hamują lub indukują CYP1A2.",
        sources: [
            { text: "Jeppesen U et al. – Fluwoksamina hamuje metabolizm kofeiny (t½ z ~5 h do ~56 h).", url: "https://pubmed.ncbi.nlm.nih.gov/8841157/" },
            { text: "Healy DP et al. – Interakcja ciprofloksacyny z kofeiną (t½ z 5,2 h do 8,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/2643614/" },
            { text: "Parsons WD & Neims AH – Hamowanie eliminacji kofeiny przez cymetydynę (t½ +45–96%).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Backman JT et al. (1995) – Ryfampicyna zmniejszyła t½ kofeiny z 6,2 do 3,5 h (p<0,004).", url: "https://pubmed.ncbi.nlm.nih.gov/7751591/" },
            { text: "Backman JT et al. (2006) – Ryfampicyna jest jedynie słabym induktorem CYP1A2.", url: "https://pubmed.ncbi.nlm.nih.gov/16758262/" },
        ],
        options: [
            { label: "Żaden z tych",      value: "none",          multiplier: 1.0 },
            { label: "Fluwoksamina",       value: "fluvoxamine",   multiplier: 10.0 },
            { label: "Ciprofloksacyna",    value: "ciprofloxacin", multiplier: 1.6 },
            { label: "Cymetydyna",         value: "cimetidine",    multiplier: 1.7 },
            { label: "Ryfampicyna",        value: "rifampicin",    multiplier: 0.75 },
        ],
    },
    {
        id: "obesity",
        title: "Czy Twoje BMI wynosi 30 lub więcej?",
        subtitle: "Otyłość może nieznacznie wydłużyć okres półtrwania kofeiny.",
        sources: [
            { text: "Abernethy DR et al. – Otyłość i dyspozycja kofeiny (t½ 7,05 h vs 5,40 h, tylko trend).", url: "https://pubmed.ncbi.nlm.nih.gov/985663/" },
        ],
        options: [
            { label: "Nie / Nie wiem",    value: "no",  multiplier: 1.0 },
            { label: "Tak (BMI ≥ 30)",    value: "yes", multiplier: 1.1 },
        ],
    },
    {
        id: "cyp1a2",
        title: "Czy znasz swój genotyp CYP1A2 (np. z 23andMe)?",
        subtitle: "Gen CYP1A2 (rs762551) wpływa na to, jak indukowalny jest Twój metabolizm kofeiny. Efekt jest najsilniejszy u palaczy; u niepalących różnica jest mniejsza.",
        sources: [
            { text: "Sachse C et al. – Znaczenie funkcjonalne polimorfizmu C→A w intronie 1 genu CYP1A2 (A/A wykazuje wyższą indukowalność).", url: "https://pubmed.ncbi.nlm.nih.gov/10325023/" },
            { text: "Palatini P et al. – Genotyp CYP1A2 modyfikuje związek między spożyciem kawy a ryzykiem nadciśnienia.", url: "https://pubmed.ncbi.nlm.nih.gov/19451835/" },
        ],
        options: [
            { label: "Nie wiem",                              value: "unknown", multiplier: 1.0 },
            { label: "A/A — szybki metabolizer",              value: "AA",      multiplier: 0.9 },
            { label: "A/C — pośredni metabolizer",            value: "AC",      multiplier: 1.0 },
            { label: "C/C — wolny metabolizer",               value: "CC",      multiplier: 1.1 },
        ],
    },
];

// Override the global QUESTIONS for the Polish wizard
QUESTIONS = QUESTIONS_PL;
