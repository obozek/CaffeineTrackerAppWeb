# Dotazník pro odhad poločasu rozpadu kofeinu u jednotlivce

## Exekutivní shrnutí

Poločas kofeinu (t½) je u zdravých dospělých typicky kolem 4–6 hodin, ale v populaci se běžně uvádí širší rozpětí přibližně 1,5–9,5 hodiny, protože metabolismus kofeinu silně kolísá mezi lidmi. citeturn30search1 Klíčové je, že kofein je z velké části odbouráván v játrech a rychlost jeho eliminace nejvíc určuje aktivita jaterního enzymového systému, zejména CYP1A2. citeturn43search17

Proto má „wizard“ největší přidanou hodnotu tehdy, když se zaměří na faktory, které CYP1A2 výrazně inhibují (poločas prodlužují) nebo indukují (poločas zkracují). Největší, prakticky klinicky významné posuny t½ způsobují: **fluvoxamin** (může zvýšit t½ zhruba z ~5 h na desítky hodin), citeturn41view0turn41view1 **těhotenství** (typicky výrazné prodloužení, zejména ve vyšším trimestru), citeturn4search2turn30search11 **estrogenová hormonální antikoncepce / estrogeny** (často ~1,7–2,2× delší), citeturn0search0turn36view1 **kouření** (často ~0,6–0,8× kratší) a **závažná jaterní dysfunkce** (může posunout t½ do desítek hodin). citeturn37view0turn38search14

Praktický UX závěr: místo jednoho čísla je vhodné zobrazovat **odhad jako rozmezí** (např. „nejpravděpodobněji 6 h, typicky 4–9 h“), a mít **výstražné stavy** pro situace s vysokým rizikem kumulace (těhotenství, jaterní onemocnění, silné inhibitory jako fluvoxamin). citeturn41view0turn38search14turn39search0

## Metodika a rámec modelu

Eliminační poločas je u látek s přibližně 1. řádem eliminace svázán se systémovou clearance (CL) a distribučním objemem (Vd): zhruba platí, že **pokud se CL sníží o X %, t½ se přibližně zvýší o 1/(1−X)** (pokud se Vd výrazně nemění). U kofeinu jsou největší posuny t½ v praxi typicky důsledkem změn CL přes CYP1A2 (inhibice/indukce), zatímco Vd u většiny běžných faktorů hraje menší roli. citeturn43search17turn2search1

Pro implementaci dotazníku dává smysl **multiplikativní model**:

- Nastavte **základní t½_base** (např. 5 h pro „zdravý dospělý, nekuřák, netěhotná, bez estrogenů a bez interagujících léků“). citeturn30search1  
- Pro každou odpověď aplikujte **multiplikátor m_i** (např. kouření m≈0,7; fluvoxamin m≈6–12; těhotenství ve 3. trimestru m≈3–4). citeturn37view0turn41view0turn30search11  
- Výsledek: **t½_est ≈ t½_base × Π m_i**.

Protože nejistota je značná (interindividuálně i metodicky), je vhodné vést i **interval nejistoty**: pro každou položku mít „střední m“ + „konzervativní minimum/maximum“ a výsledné rozmezí spočítat jako součin minim a maxim. Systematický přístup je dobře sladit s UX: uživateli ukázat **typický odhad** + **rozumné rozpětí** a u vysoce rizikových kombinací (např. těhotenství + fluvoxamin) přepnout do režimu „nelze spolehlivě odhadnout, riziko kumulace“. citeturn41view0turn4search2

## Otázky do wizaru s vědeckým podkladem a mapováním

Níže jsou otázky, které mají smysl zahrnout. U každé uvádím: (1) vědecký podklad, (2) směr vlivu na t½, (3) kvantitativní odhad a nejistotu, (4) důvěru a omezení, (5) návrh formulace + mapování na model.

**Věk**  
1) Podklad: U dospělých je průměrný t½ kolem ~5 h, ale ve věkových extrémech se může dramaticky lišit (novorozenci mají velmi dlouhý t½ kvůli nezralému metabolismu; u starších dospělých mohou hrát roli komorbidity). Přehledově se uvádí široká variabilita v populaci. citeturn30search1turn12search9  
2) Směr: děti (zejména novorozenci) → **prodloužení**; starší dospělí → často **žádný až mírné prodloužení**. citeturn9search0turn12search9  
3) Odhad:  
- běžný dospělý: ~1,5–9,5 h (referenční rozpětí) citeturn30search1  
- novorozenci: typicky řádově **desítky až >100 hodin** (prakticky jiný režim) citeturn12search9  
- starší dospělí: studie u zdravých starších osob ukazuje podobný profil jako u mladších (tj. m≈1,0), ale nejistota roste kvůli častějším lékům/játrům. citeturn9search0turn38search14  
4) Důvěra: **vysoká** pro extrém „novorozenec“ (velký, dobře popsaný efekt); **střední** pro „senior“ (často nulový efekt, ale silně závislé na zdraví a medikaci). citeturn9search0turn38search14  
5) UX otázka + mapping: „Kolik je vám let?“  
- <1 rok: režim „mimo rozsah“ (zobrazit varování; nepočítat standardním modelem)  
- 1–17: volitelně zvláštní pediatrické presety (pokud produkt cílí na děti)  
- 18–64: m_age=1,0  
- ≥65: m_age=1,1 (konzervativně 0,9–1,4)

**Pohlaví / menstruační cyklus**  
1) Podklad: Kontrolované pokusy naznačují, že samotné pohlaví ani fáze menstruačního cyklu nemusejí mít přímý vliv na farmakokinetiku kofeinu, pokud se vyloučí estrogenové preparáty a další confoundery. citeturn29view0  
2) Směr: typicky **žádný**. citeturn29view0  
3) Odhad: m_sex≈1,0 (rozumné rozpětí 0,9–1,1). citeturn29view0  
4) Důvěra: **střední až vysoká** (studie existují, ale generalizace na běžnou populaci je limitována tím, že reálný svět má více léků/komorbidit). citeturn29view0turn38search14  
5) UX + mapping: Pokud už se ptáte (např. kvůli těhotenství/HRT): „Jaké je vaše pohlaví při narození?“ → m=1,0 (žádná změna) a následně samostatné otázky na hormonální stavy.

**Těhotenství a trimestr**  
1) Podklad: Těhotenství snižuje aktivitu metabolismu kofeinu; studie ukazuje delší t½ u těhotných vs. netěhotných (např. ~8,3 h vs. 3,4 h). citeturn4search2 V přehledových materiálech se uvádí, že t½ se může směrem ke konci těhotenství prodloužit až na řádově ~15–18 h. citeturn30search11turn12search9  
2) Směr: **prodloužení** (roste s trimestry). citeturn12search9  
3) Odhad (konzervativní multiplikátory vůči „dospělý baseline“):  
- 1. trimestr: m≈1,2 (1,0–1,6)  
- 2. trimestr: m≈2,0 (1,5–2,8)  
- 3. trimestr: m≈3,5 (2,5–4,5)  
Oporou jsou data o zhruba ~2,4× delším t½ u těhotných vs. kontrol a přehledy o výrazném prodlužování v závěru gravidity. citeturn4search2turn12search9turn30search11  
4) Důvěra: **střední** (efekt je nepochybně velký; nejistota je v přesném „kolik v kterém týdnu“, v dávce a v individuální variabilitě). citeturn4search2turn30search1  
5) UX + mapping: „Jste těhotná? Pokud ano, v jakém trimestru?“  
- Ne: m_preg=1,0  
- Ano, 1./2./3. trimestr: použít multiplikátory výše + zobrazit varování o kumulaci a bezpečných limitech příjmu (např. 200 mg/den jako běžně uváděný limit v populárně-zdravotních doporučeních v ČR). citeturn39search0turn39search1

**Hormonální antikoncepce (zejména estrogenová)**  
1) Podklad: U žen na kombinované hormonální antikoncepci se popisuje významně delší t½ (např. ~10,7 h vs. 6,2 h). citeturn0search0 V klinickém pokusu došlo po cyklu užívání ethinylestradiolových kombinací ke snížení clearance kofeinu o ~54–55 %. citeturn36view1  
2) Směr: **prodloužení** t½. citeturn0search0turn36view1  
3) Odhad:  
- z přímého t½: m≈10,7/6,2≈1,7 citeturn0search0  
- z clearance −54 % vychází velmi hrubě m≈1/(1−0,54)=2,17 (při stabilním Vd). citeturn36view1turn43search17  
Prakticky: preset **m_OC=2,0** s nejistotou 1,6–2,4.  
4) Důvěra: **střední** (efekt je konzistentně inhibiční, ale přesná velikost kolísá podle preparátu, dávky estrogenů a interakcí). citeturn0search0turn36view1  
5) UX + mapping: „Užíváte hormonální antikoncepci? (kombinovanou s estrogenem / čistě gestagenní / nitroděložní systém / ne / nevím)“  
- Kombinovaná s estrogenem: m=2,0  
- Čistě gestagenní / lokální systémy: m=1,0–1,2 (spíše konzervativně 1,0, pokud nemáte data)  
- Ne/nevím: m=1,0, ale pokud „nevím“, zvažte širší interval výsledku.

**HRT / estrogenová substituce**  
1) Podklad: U postmenopauzálních žen na estradiolu došlo ke snížení „caffeine metabolic ratio“ (paraxanthine/caffeine), což odpovídá inhibici CYP1A2-dependentního metabolismu. citeturn36view0  
2) Směr: **prodloužení** t½. citeturn36view0  
3) Odhad: Pokles metabolického poměru ~−29 % lze přibližně chápat jako pokles aktivity metabolismu; hrubě m≈1/(1−0,29)=1,41. (Nejistota vysoká: 1,1–1,8). citeturn36view0turn43search17  
4) Důvěra: **střední** (měřeno přes metabolický poměr, ne přímo t½; populace specifická). citeturn36view0  
5) UX + mapping: „Užíváte hormonální substituční léčbu (estrogeny)?”  
- Ano: m_HRT=1,4 (1,1–1,8)  
- Ne/nevím: m=1,0

**Kouření (intenzita) a typ nikotinu**  
1) Podklad: Srovnání kuřáků vs. nekuřáků ukazuje kratší t½ u kuřáků (např. ~190±15 min vs. 276±30 min). citeturn37view0 Starší data uvádějí podobný směr (např. ~3,5 h vs. 6,0 h). citeturn0search2  
2) Směr: kouření → **zkrácení** t½ (indukce CYP1A2, typicky přes produkty spalování). citeturn37view0  
3) Odhad: z dat ~190/276 ≈ 0,69×; rozumné preset rozpětí **m_smoke ≈ 0,6–0,8** (střed 0,7). citeturn37view0turn0search2  
4) Důvěra: **vysoká** pro směr a obecnou velikost (efekt je robustní), **střední** pro mapování přes „cigaret/den“ (v datech se často rozlišuje jen kuřák/nekuřák a liší se expozice). citeturn37view0  
5) UX + mapping: „Kouříte klasické cigarety (spalované)? Kolik denně?“  
- 0: m=1,0  
- 1–9: m=0,8  
- 10–19: m=0,7  
- ≥20: m=0,6  
Doplněk: „Používáte pouze e-cigaretu / nikotinové sáčky bez spalování?“ → default m=1,0 (ale označit jako nejisté, pokud nechcete vymýšlet nepodložené multiplikátory).

**Nedávné zanechání kouření**  
1) Podklad: Po ukončení těžkého kouření klesla clearance kofeinu o ~36,1 % (95% CI ~30,9–42,2 %) a „poločas poklesu aktivity“ byl ~38,6 h (95% CI ~27,4–54,4 h). citeturn15search0  
2) Směr: po zanechání kouření → **prodloužení** t½ (návrat od indukovaného stavu směrem k nekuřáckému). citeturn15search0  
3) Odhad: Pokud člověk přestane kouřit, očekávejte přibližně **+45 až +73 %** delší t½ během prvních několika dnů (protože clearance klesne o ~31–42 %). citeturn15search0  
4) Důvěra: **vysoká** pro časový profil (studie přímo měří). Omezení: data z „heavy smoking“, individualita, další induktory. citeturn15search0  
5) UX + mapping: „Přestal(a) jste kouřit v posledních 7 dnech? Pokud ano, kdy naposledy?“  
- <48 h: přidejte k výsledku „transition“ multiplikátor m_quit≈1,2  
- 2–5 dní: m_quit≈1,4  
- >5–7 dní: m_quit≈1,6  
- >7 dní: vraťte se na nekuřácké multiplikátory (tj. bez kouření)  
(Pokročile: použít exponenciální aproximaci s poločasem 38,6 h). citeturn15search0

**Denní příjem kofeinu (dávka) a typ zdroje**  
1) Podklad: Kontrolovaný pokus u zdravých mužů nenašel změnu farmakokinetiky kofeinu po 1 týdnu pravidelného vysokého příjmu kofeinu. citeturn17view0 Naopak observační/field data ukazují, že „heavy coffee consumption“ (≥3 šálky/den) je spojena s vyšší aktivitou CYP1A2 (měřeno poměrem paraxanthine/caffeine). citeturn31view0turn40view0  
2) Směr: nejisté; pokud vůbec, „těžká konzumace kávy“ může být spojena s **mírným zkrácením** t½ (indukce), zatímco samotný kofein po krátkém období nemusí t½ měnit. citeturn17view0turn31view0  
3) Odhad: konzervativně **m_caffeine_intake=1,0** (0,85–1,05). Pokud chcete jemně modelovat „≥3 šálky kávy/den“, uvažujte m≈0,9 (0,8–1,0), ale s nízkou důvěrou. citeturn17view0turn31view0  
4) Důvěra: **nízká až střední** (směr je biologicky plausibilní, ale data jsou směsí krátkodobých intervencí a observačních měření, navíc „káva“ ≠ „kofein“). citeturn31view0turn17view0  
5) UX + mapping: „Kolik kofeinu zhruba denně přijmete?“ + pomocný odhadník (káva/čaj/cola/energeťáky/tablety). Do modelu buď vůbec nezahrnout (m=1,0) nebo jen volitelný „power user“ přepínač „piji ≥3 kávy denně“ → m=0,9.

**Jaterní onemocnění / funkce jater**  
1) Podklad: V ICU kohortě měli pacienti s jaterním onemocněním výrazně delší t½ (≈23,96±12,19 h) než pacienti bez jaterního onemocnění (≈7,25±3,04 h). citeturn38search14 Existují i extrémní kazuistiky s desítkami až stovkami hodin u alkoholického jaterního onemocnění. citeturn38search0  
2) Směr: **silné prodloužení** t½. citeturn38search14  
3) Odhad:  
- „žádné známé jaterní onemocnění“: m=1,0  
- „diagnostikované jaterní onemocnění (např. cirhóza, těžká hepatitida, dekompenzace)“: m≈3,0–6,0 (typicky desítky hodin); pro konzervativní horní mez klidně m=10+ u těžkých stavů. citeturn38search14turn38search0  
Pozn.: ICU data mohou zahrnovat další faktory (akutní nemoc, polyfarmacie), takže pro ambulantní „mírné“ NAFLD je nejistota větší. citeturn38search14  
4) Důvěra: **vysoká** pro to, že efekt může být obrovský; **střední** pro přesné přiřazení podle self-report (uživatel často nezná závažnost). citeturn38search14turn38search3  
5) UX + mapping: „Máte diagnostikované onemocnění jater (ztučnění jater / hepatitida / cirhóza / jiné)?“ + „Byl(a) jste v posledním roce hospitalizován(a) kvůli játrům?“  
- Cirhóza / těžké onemocnění: m=4,0 (2,5–10) a vždy varování  
- Ztučnění / mírné: m=1,3 (1,0–2,0) a širší interval  
- Nevím: nezvyšovat střed, ale rozšířit horní mez (např. +30–50 % k horní hranici)

**BMI / hmotnost**  
1) Podklad: U obézních jedinců se v jedné studii t½ lišil jen trendově (≈7,05±1,08 h vs. 5,40±0,40 h) a rozdíl nebyl statisticky významný; autoři zmiňují spíše změny Vd než clearance. citeturn2search1  
2) Směr: nejspíš **žádný až mírné prodloužení**. citeturn2search1  
3) Odhad: m_BMI≈1,1 (0,9–1,3). citeturn2search1  
4) Důvěra: **nízká až střední** (málo dat, malé soubory, heterogenita). citeturn2search1  
5) UX + mapping: „Jaká je vaše výška a hmotnost?“ → spočítat BMI, ale v modelu použít jen jemnou korekci: BMI ≥30 → m=1,1; jinak m=1,0.

**Genetika CYP1A2 (pokud ji uživatel zná)**  
1) Podklad: Genotyp rs762551 (C/A) ovlivňuje „inducibilitu“ CYP1A2. Studie u kuřáků ukazuje rozdíly v poměru 17X/caffeine mezi genotypy (A/A vyšší než C nositelé), zatímco u nekuřáků rozdíly patrné nebyly. citeturn14view0  
2) Směr: bez induktoru (kouření) často **žádný**; s kouřením může A/A znamenat **rychlejší metabolismus** (kratší t½) než C nositelé. citeturn14view0  
3) Odhad: mapujte spíš jako „modifikátor kouření“ než jako samostatný velký faktor. Prakticky:  
- nekuřák: m_gen=1,0  
- kuřák + A/A: dodatečně m≈0,85 (0,7–1,0)  
- kuřák + A/C nebo C/C: dodatečně m≈1,05 (0,9–1,2)  
Opora: rozdíly v metabolickém poměru u kuřáků (ne přímo t½), proto široká nejistota. citeturn14view0turn43search17  
4) Důvěra: **nízká až střední** (měřeno přes poměr metabolitů; účinek je kontextový; replikace se liší). citeturn14view0  
5) UX + mapping: „Znáte svůj genotyp CYP1A2 (rs762551) z genetického testu?“ (AA / AC / CC / nevím). Pokud „nevím“, nepoužívat.

**Léky s velkým účinkem (inhibitory/induktory CYP1A2)**  
1) Podklad:  
- Fluvoxamin: v kontrolované studii prodloužil t½ z ~4,9 h na ~55,9 h (a výrazně snížil clearance), s velkým efektem a uvedenými 95% CI pro rozdíl. citeturn41view0 Jiná studie uvádí zvýšení t½ z ~5 h na ~31 h. citeturn41view1  
- Ciprofloxacin: prodloužil t½ z ~5,2±1,2 h na ~8,2±2,5 h. citeturn42view0  
- Cimetidin: zvýšil t½ o ~45 % u kuřáků a o ~96 % u nekuřáků. citeturn37view0  
- Rifampicin: po 7 dnech snížil t½ z 6,2 h na 3,5 h (indukce). citeturn44view0  
2) Směr: inhibitory (fluvoxamin, ciprofloxacin, cimetidin) → **prodloužení**; induktory (rifampicin) → **zkrácení**. citeturn41view0turn42view0turn44view0  
3) Odhad (praktické presety):  
- **Fluvoxamin**: m≈6 až 12 (konzervativně 5–15), protože t½ může jít z ~5 h do ~30–56 h. citeturn41view0turn41view1  
- **Ciprofloxacin**: m≈1,6 (1,2–2,1). citeturn42view0  
- **Cimetidin**: m≈1,5 (kuřák) až 2,0 (nekuřák); obecně m≈1,7 (1,3–2,5). citeturn37view0  
- **Rifampicin**: m≈0,56 (0,45–0,75). citeturn44view0  
U „dalších“ inhibitorů/induktorů (např. některá chinolonová ATB, zileuton, některá antiepileptika) často chybí jednoduché, konzistentní číselné údaje pro kofein; konzervativní přístup je nabídnout výběr „jiný silný inhibitor/induktor – nevím“ a rozšířit interval výsledku. citeturn43search17turn43search7  
4) Důvěra: **vysoká** pro fluvoxamin/ciprofloxacin/cimetidin/rifampicin (přímá PK data); **nízká** pro dlouhý „tail“ dalších léků bez přímé kvantifikace pro kofein. citeturn41view0turn42view0turn37view0turn44view0  
5) UX + mapping: „Užíváte některý z těchto léků (posledních 7–10 dní)?“ s vyhledáváním podle názvu i účinné látky:  
- Fluvoxamin (Fevarin apod.)  
- Ciprofloxacin  
- Cimetidin  
- Rifampicin  
- „Jiné: (vyhledat lék)“ → pokud spadá do známé skupiny CYP1A2 inhibitor/induktor, použít default m=1,3 (inhibitor) / m=0,8 (induktor) a označit nízkou důvěru.

**Alkohol: akutní vs. pravidelný**  
1) Podklad: U zdravých mužů vedl pravidelný příjem alkoholu 50 g/den po dobu 1 týdne k prodloužení t½ kofeinu o 72 % a snížení clearance o 36 %. citeturn17view0 Akutní ethanol (cílová BAC ~0,7 g/l) zvýšil AUC kofeinu 1,38× (90% CI 1,25–1,52), což odpovídá mírné inhibici metabolismu. citeturn18view0  
2) Směr: akutně i chronicky spíše **prodloužení** t½ (inhibice). citeturn17view0turn18view0  
3) Odhad:  
- „včera večer 2–4 drinky“: m≈1,3 (1,2–1,5) citeturn18view0  
- „pravidelně ~50 g alkoholu/den“: m≈1,72 (1,4–2,1) citeturn17view0  
4) Důvěra: **střední** (jsou přímá data, ale dávka a časování silně mění efekt; navíc u alkoholického jaterního onemocnění se efekt kumuluje s dysfunkcí jater). citeturn17view0turn38search14  
5) UX + mapping: 2 otázky:  
- „Pil(a) jste alkohol v posledních 24 hodinách? (0 / 1–2 / 3–4 / ≥5 drinků)“ → m akutně 1,0 / 1,1 / 1,3 / 1,5  
- „Pijete dlouhodobě větší množství alkoholu (např. ≥4 drinky denně skoro každý den)?“ → m chronicky 1,7

**Dieta: grapefruit, brukvovitá zelenina, grilované/zuhelnatělé maso**  
1) Podklad: Grapefruitová šťáva (ve studii ~1,2 l/den) snížila clearance kofeinu o 23 % (95% CI 7–30 %) a prodloužila t½ o 31 % (95% CI 20–44 %), což ukazuje inhibici CYP1A2 u člověka. citeturn19search0 Brukvovitá zelenina (Brassica) v krátkodobé intervenci snížila průměrný t½ asi o ~20 %. citeturn26view0 U brokolice byla pozorována indukce metabolismu měřená metabolickým poměrem (+~19 %), což by odpovídalo mírnému zkrácení t½. citeturn23view0 U grilovaných/charbroiled jídel jsou výsledky méně stabilní a mohou být i protichůdné (indukce vs. pozdější inhibice). citeturn19search2turn19search6  
2) Směr: grapefruit → **prodloužení**; Brassica/brokolice → **zkrácení**; charbroiled → **nejisté**. citeturn19search0turn26view0turn19search6  
3) Odhad:  
- grapefruit: m≈1,31 (1,20–1,44) citeturn19search0  
- Brassica (krátkodobě vysoká dávka): m≈0,80 (0,70–0,95) citeturn26view0  
- brokolice 500 g/den: m≈0,85 (0,75–0,98) (odvozeno z +19 % metabolického poměru; nepřímé) citeturn23view0turn43search17  
- charbroiled: default m=1,0 (0,8–1,2) a spíš jen rozšířit nejistotu. citeturn19search6  
4) Důvěra: grapefruit **vysoká**; Brassica/brokolice **střední**; charbroiled **nízká**. citeturn19search0turn26view0turn19search6  
5) UX + mapping:  
- „Pijete často grapefruitovou šťávu (např. ≥3× týdně)?“ → m=1,3  
- „Jíte velmi často brukvovitou zeleninu (brokolice, kapusta, růžičková kapusta) ve velkých porcích?“ → m=0,9 (a varovat, že efekt je malý)  
- „Jíte často silně opékané/zuhelnatělé maso?“ → nezahrnovat do středu, jen rozšířit interval

**Bylinky a doplňky ovlivňující enzymy: třezalka tečkovaná (St John’s wort)**  
1) Podklad: Ve studii s třezalkou (3×300 mg/den, 14 dní) byla pozorována indukce CYP1A2 u žen (poměr 1,2; 95% CI 1,1–1,4), zatímco u mužů efekt jasný nebyl. citeturn27view0  
2) Směr: u žen potenciálně **zkrácení** t½; u mužů spíše **žádný**. citeturn27view0  
3) Odhad: ženy m≈0,85 (0,7–0,95); muži m≈1,0 (0,9–1,1). citeturn27view0turn43search17  
4) Důvěra: **střední** (přímá měření, ale malý soubor; pohlavní dimorfismus; dávky extraktu se liší). citeturn27view0  
5) UX + mapping: „Užíváte třezalku tečkovanou (např. na náladu/spánek)?“ → pokud ano, aplikujte „female-only“ multiplikátor nebo přepněte na širší interval.

**Spánek, stres, fyzická aktivita (doporučení: spíš mimo model t½)**  
1) Podklad: Studie testující vliv pohlaví, cvičení a tepelného stresu nenašla efekt na farmakokinetiku kofeinu. citeturn29view0  
2) Směr: na samotné t½ pravděpodobně **žádný** (spánek ovlivňuje spíš citlivost/účinek, ne eliminaci). citeturn29view0  
3) Odhad: m=1,0; místo toho použijte tyto položky pro vysvětlení subjektivního účinku („proč mě kofein drží vzhůru“) a pro doporučení „nejpozdější čas poslední dávky“ podle vypočteného t½. citeturn29view0turn30search1  
4) Důvěra: **střední** (existují data pro cvičení/teplo; pro cirkadiánní vlivy či chronický stres je méně přímých PK dat pro kofein v běžném dotazníkovém formátu). citeturn29view0  
5) UX + mapping: „Kdy obvykle chodíte spát?“ a „Kdy byla poslední dávka kofeinu dnes?“ → nepoužívat pro t½, ale pro výstup typu „Při vašem odhadu t½ bude po 8 h stále ~25 % dávky“.

## Souhrnná tabulka multiplikátorů

Doporučené presety (m = multiplikátor poločasu t½). „Rozsah“ je navržené rozpětí nejistoty pro UX (nikoli vždy statistické CI).

| Kategorie / otázka | Odpověď (kategorie) | Směr | Doporučené m (rozsah) | Důvěra |
|---|---:|---|---:|---|
| Věk | 18–64 | žádný | 1,0 (0,8–1,2) | střední |
| Věk | ≥65 | mírné prodloužení / žádný | 1,1 (0,9–1,4) | střední |
| Věk | <1 rok | výrazné prodloužení | mimo model (desítky–100+ h) | vysoká |
| Pohlaví / cyklus | libovolné | žádný | 1,0 (0,9–1,1) | střední–vysoká citeturn29view0 |
| Těhotenství | 1. trimestr | prodloužení | 1,2 (1,0–1,6) | střední citeturn4search2 |
| Těhotenství | 2. trimestr | prodloužení | 2,0 (1,5–2,8) | střední citeturn12search9 |
| Těhotenství | 3. trimestr | prodloužení | 3,5 (2,5–4,5) | střední citeturn12search9 |
| Estrogenová antikoncepce | ano | prodloužení | 2,0 (1,6–2,4) | střední citeturn0search0turn36view1 |
| HRT (estrogen) | ano | prodloužení | 1,4 (1,1–1,8) | střední citeturn36view0 |
| Kouření (spalované) | 10–19 cig./den | zkrácení | 0,7 (0,6–0,8) | vysoká citeturn37view0 |
| Kouření (spalované) | ≥20 cig./den | zkrácení | 0,6 (0,5–0,75) | střední citeturn37view0 |
| Zanechání kouření | 2–5 dní od poslední cig. | prodloužení (návrat) | 1,4 (1,2–1,6) | vysoká citeturn15search0 |
| Fluvoxamin | ano | silné prodloužení | 10 (6–15) | vysoká citeturn41view0turn41view1 |
| Ciprofloxacin | ano | prodloužení | 1,6 (1,2–2,1) | vysoká citeturn42view0 |
| Cimetidin | ano | prodloužení | 1,7 (1,3–2,5) | střední citeturn37view0 |
| Rifampicin | ano | zkrácení | 0,56 (0,45–0,75) | vysoká citeturn44view0 |
| Alkohol (akutně) | „větší večer“ | prodloužení | 1,3 (1,2–1,5) | střední citeturn18view0 |
| Alkohol (pravidelně) | ~50 g/den | prodloužení | 1,7 (1,4–2,1) | střední citeturn17view0 |
| Grapefruit | pravidelně | prodloužení | 1,31 (1,20–1,44) | vysoká citeturn19search0 |
| Brassica (krátkodobě vysoká) | ano | zkrácení | 0,8 (0,7–0,95) | střední citeturn26view0 |
| BMI | ≥30 | mírné prodloužení / žádný | 1,1 (0,9–1,3) | nízká–střední citeturn2search1 |
| CYP1A2 rs762551 | znám + kuřák AA | zkrácení vs. kuřák default | 0,85 (0,7–1,0) | nízká–střední citeturn14view0 |
| Třezalka (u žen) | ano | zkrácení | 0,85 (0,7–0,95) | střední citeturn27view0 |
| Jaterní onemocnění | ano (těžké/cirhóza) | silné prodloužení | 4 (2,5–10+) | střední–vysoká citeturn38search14turn38search0 |

## UX doporučení a rychlý dotazník

Výsledek doporučuji prezentovat ve 3 vrstvách: (a) **střední odhad t½**, (b) **pravděpodobné rozpětí** (např. „typicky“), (c) **konzervativní horní mez** (bezpečnostní). To je důležité, protože i bez extrémních faktorů je variabilita v populaci velká. citeturn30search1turn43search17 U vysoce rizikových stavů (těhotenství, jaterní onemocnění, fluvoxamin) je vhodné zobrazit varování o kumulaci a současně připomenout praktická doporučení k omezení kofeinu; v českých edukativních materiálech se běžně uvádí např. limit **200 mg/den v těhotenství** a **400 mg/den** pro běžnou dospělou populaci. citeturn39search0turn39search1

Rychlý dotazník (60–90 s) v pořadí, které maximalizuje informační hodnotu:

1. Věk (a případně „je vám <18?“ → pokud ano, přepnout do pediatrického režimu nebo varovat). citeturn12search9  
2. Těhotenství + trimestr (pokud relevantní). citeturn4search2turn12search9  
3. Estrogenová antikoncepce / HRT (ano/ne). citeturn0search0turn36view0  
4. Kouření spalovaných cigaret (0 / 1–9 / 10–19 / ≥20) + „přestal(a) jsem v posledním týdnu“. citeturn37view0turn15search0  
5. Léky: „Užíváte fluvoxamin, ciprofloxacin, cimetidin, rifampicin nebo jiný lék s interakcí?“ (vyhledávání názvu). citeturn41view0turn42view0turn37view0turn44view0  
6. Jaterní onemocnění (ano/ne/nevím; pokud ano, jak závažné). citeturn38search14turn38search0  
7. Alkohol: posledních 24 h + dlouhodobě vysoký příjem (ano/ne). citeturn18view0turn17view0  
8. Grapefruit (pravidelně ano/ne). citeturn19search0  
9. BMI (výška+hmotnost; volitelné). citeturn2search1  
10. (Volitelné „advanced“): CYP1A2 genotyp, třezalka, velmi vysoká Brassica dieta. citeturn14view0turn27view0turn26view0  

## Klíčové primární studie a odkazy

Nejdůležitější zdroje pro „velké“ multiplikátory a validaci dotazníku:

- Fluvoxamin ↔ kofein (velký inhibitor): výrazné prodloužení t½ a pokles clearance. citeturn41view0turn41view1  
- Ciprofloxacin ↔ kofein: prodloužení t½ z ~5,2 h na ~8,2 h. citeturn42view0  
- Cimetidin ↔ kofein + rozdíl kuřák/nekuřák (včetně procentuálních změn t½). citeturn37view0  
- Rifampicin (indukce) ↔ kofein: pokles t½ z 6,2 h na 3,5 h. citeturn44view0  
- Kouření a zanechání kouření: časová konstanta návratu aktivity CYP1A2. citeturn15search0turn37view0  
- Těhotenství: delší t½ u těhotných vs. kontrol + přehledová čísla k růstu v průběhu gravidity. citeturn4search2turn12search9turn30search11  
- Estrogenová antikoncepce: delší t½ / snížená clearance. citeturn0search0turn36view1  
- Jaterní onemocnění: t½ ~24 h vs. ~7 h v ICU kohortě + kazuistiky extrémů. citeturn38search14turn38search0  
- Grapefruitová šťáva ↔ kofein: +31 % t½ (s 95% CI). citeturn19search0  
- Brassica dieta ↔ kofein: −~20 % t½. citeturn26view0  
- Alkohol (akutní i 1 týden pravidelně): +38 % AUC (akutně) a +72 % t½ (pravidelně). citeturn18view0turn17view0  
- Česká edukativní doporučení pro limity příjmu (pro UX varování, zejména v těhotenství): citeturn39search0turn39search1  

entity["organization","Evropský úřad pro bezpečnost potravin (EFSA)","food safety agency, eu"] entity["organization","Státní zdravotní ústav","public health institute, cz"] entity["organization","Národní zdravotnický informační portál","health portal, cz"] entity["organization","NCBI Bookshelf","database, nih"] entity["organization","PubMed","biomedical database, nih"]