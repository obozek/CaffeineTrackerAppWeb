/**
 * Caffeine Half-Life Wizard — Spanish translations for QUESTIONS
 * Overrides the English QUESTIONS array from halflife-wizard.js
 * Scoring logic (multipliers, PRESETS, BASE_HALFLIFE) stays identical.
 */

const QUESTIONS_ES = [
    {
        id: "age",
        title: "¿Cuántos años tienes?",
        subtitle: "La edad puede afectar el metabolismo de la cafeína.",
        sources: [
            { text: "La vida media de la cafeína en adultos sanos es típicamente 1,5–9,5 h; adultos mayores muestran perfiles similares pero con mayor incertidumbre.", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "Nawrot P et al. – Efectos de la cafeína en la salud humana (revisión de la variabilidad por edad).", url: "https://pubmed.ncbi.nlm.nih.gov/12519715/" },
        ],
        options: [
            { label: "18–64",  value: "18-64",  multiplier: 1.0 },
            { label: "65+",    value: "65+",     multiplier: 1.1 },
        ],
    },
    {
        id: "pregnancy",
        title: "¿Estás embarazada?",
        subtitle: "El embarazo ralentiza significativamente la eliminación de cafeína.",
        sources: [
            { text: "Knutti R et al. – Efecto del embarazo en la farmacocinética de la cafeína (t½ ~8,3 h vs 3,4 h en controles).", url: "https://pubmed.ncbi.nlm.nih.gov/7361718/" },
            { text: "NCBI Bookshelf – La vida media de la cafeína puede alcanzar 15–18 h en el embarazo avanzado.", url: "https://www.ncbi.nlm.nih.gov/books/NBK223808/" },
            { text: "Aldridge A et al. – Metabolismo de la cafeína en el recién nacido (revisión de efectos del embarazo).", url: "https://pubmed.ncbi.nlm.nih.gov/6836474/" },
        ],
        options: [
            { label: "No",              value: "no",   multiplier: 1.0 },
            { label: "1er trimestre",   value: "t1",   multiplier: 1.2 },
            { label: "2do trimestre",   value: "t2",   multiplier: 2.0 },
            { label: "3er trimestre",   value: "t3",   multiplier: 3.5 },
        ],
    },
    {
        id: "contraception",
        title: "¿Usas anticoncepción hormonal basada en estrógenos?",
        subtitle: "Las píldoras combinadas (estrógeno) aproximadamente duplican la vida media.",
        sources: [
            { text: "Abernethy DR & Todd EL – Deterioro de la eliminación de cafeína por uso crónico de anticonceptivos orales con estrógenos (t½ 10,7 h vs 6,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
            { text: "Pollock BG et al. – Inhibición del metabolismo de la cafeína por estradiol (eliminación ↓54–55%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "No",                                   value: "no",       multiplier: 1.0 },
            { label: "Sí (combinado / estrógeno)",           value: "estrogen", multiplier: 2.0 },
            { label: "Solo progestina / DIU",                value: "prog",     multiplier: 1.0 },
        ],
    },
    {
        id: "hrt",
        title: "¿Usas terapia de reemplazo hormonal (estrógeno)?",
        subtitle: "La TRH basada en estrógenos inhibe CYP1A2.",
        sources: [
            { text: "Pollock BG et al. – Efectos del estradiol y sus metabolitos en la actividad CYP1A2 medida por la ratio metabólica de cafeína (↓29%).", url: "https://pubmed.ncbi.nlm.nih.gov/10445549/" },
        ],
        options: [
            { label: "No",  value: "no",  multiplier: 1.0 },
            { label: "Sí",  value: "yes", multiplier: 1.4 },
        ],
    },
    {
        id: "smoking",
        title: "¿Fumas cigarrillos?",
        subtitle: "Fumar induce la enzima hepática que elimina la cafeína.",
        sources: [
            { text: "Parsons WD & Neims AH – Efecto del tabaquismo en la eliminación de cafeína (t½ 190 min vs 276 min en no fumadores).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Abernethy DR & Todd EL – Disposición de cafeína en fumadores vs no fumadores (t½ ~3,5 h vs ~6,0 h).", url: "https://pubmed.ncbi.nlm.nih.gov/4075070/" },
        ],
        options: [
            { label: "No",            value: "0",      multiplier: 1.0 },
            { label: "1–9 / día",     value: "1-9",    multiplier: 0.8 },
            { label: "10–19 / día",   value: "10-19",  multiplier: 0.7 },
            { label: "20+ / día",     value: "20+",    multiplier: 0.6 },
        ],
    },
    {
        id: "liver",
        title: "¿Tienes alguna enfermedad hepática diagnosticada?",
        subtitle: "El hígado es el sitio principal del metabolismo de la cafeína.",
        sources: [
            { text: "Frye RF et al. – Enfermedad hepática y farmacocinética de la cafeína en pacientes de UCI (t½ ~24 h vs ~7 h).", url: "https://pubmed.ncbi.nlm.nih.gov/16855463/" },
            { text: "Desmond PV et al. – Eliminación deteriorada de cafeína en cirrosis.", url: "https://pubmed.ncbi.nlm.nih.gov/7359946/" },
        ],
        options: [
            { label: "No",                                        value: "no",     multiplier: 1.0 },
            { label: "Leve (ej. hígado graso)",                   value: "mild",   multiplier: 1.3 },
            { label: "Grave (ej. cirrosis, hepatitis)",           value: "severe", multiplier: 4.0 },
        ],
    },
    {
        id: "medication",
        title: "¿Tomas regularmente alguno de estos medicamentos?",
        subtitle: "Algunos fármacos inhiben o inducen fuertemente CYP1A2.",
        sources: [
            { text: "Jeppesen U et al. – Fluvoxamina inhibe el metabolismo de la cafeína (t½ de ~5 h a ~56 h).", url: "https://pubmed.ncbi.nlm.nih.gov/8841157/" },
            { text: "Healy DP et al. – Interacción ciprofloxacino y cafeína (t½ de 5,2 h a 8,2 h).", url: "https://pubmed.ncbi.nlm.nih.gov/2643614/" },
            { text: "Parsons WD & Neims AH – Inhibición por cimetidina de la eliminación de cafeína (t½ +45–96%).", url: "https://pubmed.ncbi.nlm.nih.gov/6812584/" },
            { text: "Backman JT et al. (1995) – Rifampicina redujo la t½ de cafeína de 6,2 a 3,5 h (p<0,004).", url: "https://pubmed.ncbi.nlm.nih.gov/7751591/" },
            { text: "Backman JT et al. (2006) – Rifampicina es solo un inductor débil de CYP1A2.", url: "https://pubmed.ncbi.nlm.nih.gov/16758262/" },
        ],
        options: [
            { label: "Ninguno de estos",  value: "none",          multiplier: 1.0 },
            { label: "Fluvoxamina",       value: "fluvoxamine",   multiplier: 10.0 },
            { label: "Ciprofloxacino",    value: "ciprofloxacin", multiplier: 1.6 },
            { label: "Cimetidina",        value: "cimetidine",    multiplier: 1.7 },
            { label: "Rifampicina",       value: "rifampicin",    multiplier: 0.75 },
        ],
    },
    {
        id: "obesity",
        title: "¿Tu IMC es 30 o superior?",
        subtitle: "La obesidad puede aumentar ligeramente la vida media de la cafeína.",
        sources: [
            { text: "Abernethy DR et al. – Obesidad y disposición de cafeína (t½ 7,05 h vs 5,40 h, solo tendencia).", url: "https://pubmed.ncbi.nlm.nih.gov/985663/" },
        ],
        options: [
            { label: "No / No lo sé",     value: "no",  multiplier: 1.0 },
            { label: "Sí (IMC ≥ 30)",     value: "yes", multiplier: 1.1 },
        ],
    },
    {
        id: "cyp1a2",
        title: "¿Conoces tu genotipo CYP1A2 (ej. de 23andMe)?",
        subtitle: "El gen CYP1A2 (rs762551) afecta cuán inducible es tu metabolismo de cafeína. El efecto es más fuerte en fumadores; en no fumadores la diferencia es menor.",
        sources: [
            { text: "Sachse C et al. – Significancia funcional de un polimorfismo C→A en el intrón 1 del gen CYP1A2 (A/A muestra mayor inducibilidad).", url: "https://pubmed.ncbi.nlm.nih.gov/10325023/" },
            { text: "Palatini P et al. – El genotipo CYP1A2 modifica la asociación entre consumo de café y riesgo de hipertensión.", url: "https://pubmed.ncbi.nlm.nih.gov/19451835/" },
        ],
        options: [
            { label: "No lo sé",                            value: "unknown", multiplier: 1.0 },
            { label: "A/A — metabolizador rápido",          value: "AA",      multiplier: 0.9 },
            { label: "A/C — metabolizador intermedio",      value: "AC",      multiplier: 1.0 },
            { label: "C/C — metabolizador lento",           value: "CC",      multiplier: 1.1 },
        ],
    },
];

// Override the global QUESTIONS for the Spanish wizard
QUESTIONS = QUESTIONS_ES;
