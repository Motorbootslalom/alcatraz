# Plan: Antworten der Runden 7–8 umsetzen (22.11.2026)

Grundlage: Antworten des Nutzers vom 22.11.2026 auf die Fragenseite (Runden 7 und 8), festgehalten in
[entscheidungen.md](entscheidungen.md) „Antworten 22.11.2026 (Runden 7–8)“ und je Eintrag in `WKR_ANNAHMEN`
(src/wkr/annahmen.ts, „NICHT bestätigt 22.11.2026 (R…)“), `components/BeispieldatenPanel.vue` (BS3). Stand des Codes:
Commit 5e698d9 plus die nicht committeten Vermerke. Alle übrigen Fragen sind mit „passt“ bestätigt und tragen den
Vermerk schon.

Neue Auslegungen tragen eine Kennung (ZT5…, BZ6…, LD1…, BD8…, KN9…, Y4, BS4), das Datum 22.11.2026 und „noch zu
bestätigen“ – im Code an genau einer Stelle (`WKR_ANNAHMEN`, `BETRIEB_ANNAHMEN`, `generate.ts`) und hier in §8
gesammelt. Ersetzte Auslegungen (AM2, BZ1, U3, BD3, BD4, BD7, KN3, KN7, KN8, ZT3, BS3) bekommen „Umgebaut
22.11.2026 (R…)“ und den neuen Wortlaut; ihr Schalter in `WKR_ANNAHMEN` wird umbenannt bzw. umgedreht, wenn der Name
sonst das Gegenteil sagt (z. B. `disqBojeOhneLangdruck` → `disqBojeLangdruck`), mit allen Lesern. Keine Rückfragen
an den Nutzer während des Baus.

Feste Regeln für jede Scheibe: i18n de/ UND en/ (gleiche Platzhalter), Begriffe nach Regelbuch, Reducer rein, neue
Felder in migrate() bzw. normalisiere…, Tafel/Zuschauer nur öffentliche Sicht, nichts aus geraete/ im Reducer, kein
Netz ohne Raum, Geräte ohne Store, Stil (ohne Semikolons, einfache Anführungszeichen), Kommentare mit Warum + Datum.
Lehren aus dem Handy-Test: kein Text abgeschnitten bei 360 px, Maskenfarben nur `--wkr-*`, keine Maskenklassen in
app.css, Tests ohne feste Pausen (`bis()`/`zeigt()`). Gezielt testen; nach Typ-/i18n-Änderungen `npx vue-tsc -b` und
`npx vitest run src/i18n`; volle Suite (`npm run test:leise`) am Ende jeder Scheibe. Nicht committen. Am Ende jeder
Scheibe: Eintrag in entscheidungen.md von „Entschieden, noch nicht umgesetzt“ nach „umgesetzt“, CLAUDE.md-Karten
(Wurzel-Tabelle, src/wkr/CLAUDE.md) nachziehen.

## 1 Reihenfolge

| # | Scheibe | Antworten | warum hier |
|---|---|---|---|
| 1 | Zeit-Listen: Ampel und optionale Felder | R7-01, R8-35 | klein, im Kern (liste.ts, lage.ts, maske.ts); ändert, was später alle Masken sehen. |
| 2 | Mehrere Disq. je Bojenzelle | R7-14 | Zellform, die Wertung, Erfassung, Tabelle und Masken teilen – vor jeder Disq.-Bedienung. |
| 3 | Langes Drücken, Bild-Umschalter von Hand | R7-21, R8-23, R8-20 | Bedienung auf der Zellform aus 2 (Mehrfachwahl in WkrDisqOrt). |
| 4 | Parallelslalom-Zeichnung aus dem Parcours-Repo | R8-19 | eigenständig (Sync, bild.ts, WkrBild); nach 3, weil WkrBild dort den Langdruck bekommt. |
| 5 | Knoten am Tisch | R8-27, R8-31, R8-32 | eigenständig in WkrPruefliste und maske.ts. |
| 6 | Übung: Klasse vorziehen; Beispieldaten je Klasse | R7-45, R7-51 | unabhängig; Übung zuletzt, damit sie alle Masken aus 1–5 zeigt. |

## 2 Scheibe 1 – Zeit-Listen (R7-01, R8-35) – gebaut 22.11.2026

Stand nach dem Bau: istParcoursListe mit `zeitIstParcoursListe` (AM2 umgebaut); zeitPflicht/zeitenOffen/
zeitVollstaendig in wkr/maske.ts, Sprung in WkrZeiten.vue, Probe-Schritt `zeitRest` „weitere Zeiten freiwillig“.
zellenAus blieb unverändert: geraete/erfassen.ts schickt leere Felder ohnehin nur mit eigenem `vorher` (Korrektur),
neue Zeilen tragen sie nicht – die Rund-Probe gilt weiter.

### 2.1 R7-01: Zeit-Listen sind Parcours-Listen der Ampel

Heute: `wkr/liste.ts istParcoursListe` verlangt `def.columns.some(c => c.kind !== 'time' && c.kind !== 'sum')` –
reine Zeit-Listen (`zeit`, `zeit-n`, Parallel „Zeit“ A/B) fallen heraus (AM2 `zeitKeineParcoursListe`). Leser:
`wkr/lage.ts` (Z. ~371 Ampel/Rückstand je Bereich, ~449 `parcours`), `wkr/sicht.ts` (~495), `wkr/ampel.ts` über lage.

Festlegung:
- `istParcoursListe`: mit Lauf, nicht geteilt (Steg), nicht „einmal je Starter“ (Vorsteg) und mindestens ein Feld
  außer Summe – Zeit zählt. AM2 wird „Umgebaut 22.11.2026 (R7-01)“, Schalter `zeitKeineParcoursListe` → entfällt
  (bzw. `zeitIstParcoursListe: true`), AM1-Text um `zeit`, `zeit-n`, `parallelzeit` A/B ergänzt.
- Folgen bewusst mit: Rückstand, Nachfrage „Trotzdem freigeben?“, Auto-Modus und Ampel warten auch auf die Zeit-Liste
  (der Nutzer will das so). Nur Listen, die heute schon zählen (digital, mit Gerät) – an der Bedingung „mit Gerät“
  ändert sich nichts.
- Parallel: Zeit A/B zählen je Racecourse wie Fahrweg A/B (Paar als Einheit wie bisher).
- Texte: Hilfetexte/Tooltips zur Ampel, die „ohne Zeit“ sagen (grep `zeit` in i18n betrieb.wkr.*, betrieb.freigabe.*,
  docs/betrieb.md, docs/feldtest.md) anpassen.
- Tests: `wkr/ampel.test.ts` (Zeit-Liste hält rot, bis abgeschickt; reine Zeit-Liste im Auto-Modus), `wkr/lage.test.ts`
  (Rückstand zählt Zeit-Liste), `wkr/liste.test.ts` istParcoursListe-Tabelle (zeit, zeit-n, parallel Zeit = true;
  steg, vorsteg, knoten = false), `wkr/freigabe.test.ts`, falls dort Zeit ausgenommen ist.

### 2.2 R8-35: nach gültiger Zeit weiterspringen, weitere Zeitfelder optional

Heute: `wkr/maske.ts fertig` sperrt, solange `zeitenOffen(e, aufbau) > 0` (ZT3: jedes Feld Zeit oder „keine Zeit“);
WkrZeiten.vue springt nicht von selbst weiter. `wkr/zeile.ts` lässt leere Zellen ohnehin zu („Leer gilt immer“).

Festlegung (ZT5, ZT6 neu; ZT3 umgebaut):
- **Pflicht ist nur das ERSTE Zeitfeld der Liste** (in der Folge von `aufbau.zeiten`): lesbare Zeit oder „keine
  Zeit“. Weitere Felder: leer erlaubt; ist eins befüllt, muss es lesbar sein (unlesbar sperrt wie bisher, rot).
  `zeitenOffen` → zählt nur Pflichtfelder; neue Hilfe `zeitPflicht(aufbau, feld)`. Hauptknopf: „noch 1 Zeit“ nur für
  das erste Feld. Bojen + Zeit (moewezeit, bstartziel) ebenso.
- **Weiterspringen (ZT6)**: Nach einer gültigen Zeit springt der Block ins nächste Zeitfeld – aber erst, wenn die Zeit
  „fertig“ ist: beim Komma + zwei Nachkommaziffern (Hundertstel; Stellen aus `lib/time.ts`, sonst mit der Taste „→“
  bzw. Antippen des nächsten Felds). Beim letzten Feld kein Sprung. Ein Sprung leert nichts; Zurück tippen bleibt.
  Auf dem Pad (nebeneinander) wandert nur die Umrandung, auf dem Handy der Feld-Reiter.
- Übernahme: leere weitere Zeitfelder schickt das Gerät als `''` (Zelle leeren) NUR, wenn es sie vorher selbst
  gesetzt hatte (Korrektur); bei einer neuen Zeile fehlen leere Felder in `zellen`, damit eine Papierzeit am Rechner
  nicht überschrieben wird. Prüfen in `zellenAus` (heute schreibt es jedes Feld, auch leer) – zellenAus lässt leere
  optionale Zeitfelder weg, Korrektur über `entwurfAus`-Vergleich schreibt `''`. Wenn das die Rund-Probe
  (`zellenAus(entwurfAus(z))`) verletzt, Rund-Probe auf „soweit gesetzt“ anpassen und begründen.
- Tests: `wkr/maske.test.ts` (fertig mit nur erstem Feld; unlesbares zweites sperrt), `WkrZeiten.test.ts` (Sprung nach
  „12,34“, kein Sprung bei „12,3“, kein Sprung im letzten Feld), `geraete/uebung.test.ts` Zeit-Liste mit zwei Feldern,
  `wkr/zeile.test.ts` (Zeile mit leerem zweitem Feld gilt), Probe (WkrProbe) mit zwei Feldern.

## 3 Scheibe 2 – Mehrere Disq. je Bojenzelle (R7-14) – gebaut 22.11.2026

Stand nach dem Bau: lib/disq.ts bojenZelle (eine Schreibweise) + sanitizeBuoy, lib/scoring.ts bojenWert → {punkte,
disq: string[]}; Leser umgestellt (scoring, ergebnis, erfassung, wkr/zeile, wkr/tabelle, wkr/maske). Gerät:
Entwurf.bojenDisq als Liste, Merker `#bdisq:<feld>=<code>` je Buchstabe, bojenDisqVon/bojenDisqZahl; WkrDisqOrt und
WkrBild mit Mehrfachwahl und „Fertig“ (`disq-ort-fertig`), Probe-Schritt „Disq. an Boje“ erst nach „Fertig“; Stand im
Bild in Zellform („5, J, D“, Schlüssel `wkr.geraet.bild.disq` entfällt). Wertungsliste: Bojenzellen behalten die
Katalogfolge, ab fünf Zeichen zweizeilig (ErgebnisLaufBlatt fitZelle); Erfassung: `.erf-feld--boje-lang` (72 px) ab
fünf Zeichen. Beim Bau: Der Hinweis `bojePunkte` meldet auch X neben einem anderen Buchstaben (BZ2).


Heute (BZ1): `lib/disq.ts sanitizeBuoy` behält Ziffern + den ERSTEN erlaubten Buchstaben, ohne Trenner („5J“);
`lib/scoring.ts bojenWert` liefert `{ punkte, disq? }` (ein Buchstabe). Leser von bojenWert: lib/scoring.ts
(handleBuoy), lib/ergebnis.ts (~288), lib/erfassung.ts (~155 Disq.-Liste, ~189 Hinweise), wkr/zeile.ts (~105 X),
wkr/tabelle.ts, wkr/maske.ts (entwurfAus, Prüfliste). Schreiber: sanitizeBuoy (ErfassungTabelle onInput, eingaben.ts
gueltig, tabelle.ts), wkr/maske.ts zellenAus, lib/beispielwerte.ts (~442).

Festlegung (BZ1 umgebaut, BZ6–BZ8 neu):
- **Speicherform = Anzeigeform** (BZ6): Punkte zuerst, dann die Buchstaben in der Folge des Disq.-Katalogs der Zelle
  (nicht in Tippfolge – so sind zwei Zellen mit gleichem Inhalt String-gleich, BZ5 „abweichend = String-ungleich“
  bleibt einfach), getrennt mit „, “: „5“, „J“, „5, J“, „5, J, D“, „10, G“ (Zähler), „J, D“. Dubletten weg, nur
  erlaubte Buchstaben, „X“ allein (BZ2: „X“ schließt Punkte und andere Buchstaben aus – sanitizeBuoy macht aus allem
  mit X ein „X“).
- **Lesen großzügig**: Ziffern zusammengezählt wie heute (alle Ziffern = eine Zahl; „5 5“ bleibt „55“ wie bisher –
  nicht ändern), Buchstaben einzeln, Trenner Leerzeichen, Komma, Semikolon, nichts: „5JD“, „5 J D“, „5,J,D“, „j5d“,
  „5, d, j“ → „5, J, D“ (bei Katalogfolge J vor D; sonst entsprechend). Beim Tippen in der Erfassung (onInput je
  Taste): Zwischenstände dürfen nicht stören – „5“ → „5“, „5 “ → „5“, „5J“ → „5, J“; der Cursor bleibt am Ende
  (prüfen, dass `input.value = wert` das tut).
- **bojenWert** (EINZIGER Leser) → `{ punkte: number; disq: string[] }` (immer Array; leer = keiner). Alle Leser
  umstellen: scoring.ts handleBuoy pusht je Buchstabe einen DisqHit; ergebnis.ts `disqs.push(...boje.disq)`;
  erfassung.ts `?? []` → direkt; zeile.ts X: `disq.includes('X')`; maske.ts entwurfAus setzt jeden Buchstaben.
- **Anzeige**: Erfassungstabelle zeigt den gespeicherten Wert; Wertungsliste lib/ergebnis.ts zellText für Bojenzellen
  ohne Sonderweg (Speicherform hat das Komma schon) – prüfen, dass Spaltenbreite der Wertungslisten/Einzelwertung und
  der Erfassung „5, J, D“ fasst (sonst Zeilenumbruch erlauben, nie abschneiden). WKR-Bögen sind leer – unbetroffen.
- **Gerät** (wkr/maske.ts): `Entwurf.bojenDisq: Record<string, string[]>` (statt string). `tippeBojenDisq(e, boje,
  code)` schaltet EINEN Buchstaben an/aus (weitere bleiben); `null` nimmt alle Buchstaben der Boje heraus. Folge-Merker
  für „zurück“: je Buchstabe ein Merker `BOJEN_DISQ + feld + '=' + code` (der WAR-Mechanismus für „ersetzt“ entfällt –
  es wird nichts mehr ersetzt); „− letzte zurück“ nimmt den zuletzt gesetzten Buchstaben heraus. `zellenAus` schreibt
  über dieselbe Formatfunktion wie sanitizeBuoy (neu `bojenZelle(punkte, buchstaben, erlaubt)` in lib/disq.ts, eine
  Stelle). `bojenDisqListe`/Zählung (Z. ~621, ~671, ~685) je Buchstabe.
- **WkrDisqOrt.vue / WkrDisq.vue**: Bei einer Boje Mehrfachwahl – Tipp schaltet einen Buchstaben an/aus, die Wahl
  bleibt offen, Knopf „Fertig“ schließt (statt Schließen nach dem ersten Buchstaben). Die Knöpfe der Bojen-Maske
  (WkrBojen) zeigen „Disq. J, D“ (kurz; bei 360 px Umbruch, nie abgeschnitten).
- **Tabelle** (wkr/tabelle.ts zelleAusEingabe `boje`): mehrere Buchstaben erlaubt; Fehler `zeichen-fremd` nur noch für
  nicht erlaubte Zeichen (nicht mehr für „mehr als einer“); Dubletten still weg.
- **Gerät ↔ Bedienrechner**: Zellwert bleibt String – Protokoll unverändert. Ein Gerät älterer Fassung läse „5, J, D“
  nur mit erstem Buchstaben → `LISTEN_SICHT_FASSUNG` (wkr/sicht.ts, heute 9) auf 10 heben, damit alte Geräte über F7
  neu laden; sicht.test.ts nachziehen.
- Beispieldaten (lib/beispielwerte.ts ~442): Kommentar und Erwartung auf „5, J“; selten zwei Buchstaben – nicht nötig.
- Keine Migration (Abwärtskompatibilität nicht nötig; „5J“ aus alten Ständen liest bojenWert ohnehin).
- Tests: `lib/disq.test.ts` (Tabelle der Eingaben oben inkl. X-Fälle, Katalogfolge, Dubletten, fremde Buchstaben),
  `lib/scoring.test.ts` (zwei Disq. → zwei DisqHits, Punkte bleiben), `lib/ergebnis.test.ts` (zwei Buchstaben an
  einer Boje → Disq. mit beiden Codes), `lib/erfassung.test.ts`, `wkr/maske.test.ts` (an/aus je Buchstabe, zurück,
  Rund-Probe `zellenAus(entwurfAus(z))` mit „5, J, D“; die Eigenschaft „jede Tipp-Folge besteht wertGilt“),
  `wkr/tabelle.test.ts`, `wkr/zeile.test.ts`, `wkr/uebernahme.test.ts` (BZ5 mit „5, J“ gegen „5“),
  `WkrKnoepfe.test.ts`/WkrDisqOrt-Test (Mehrfachwahl), `config/regelwerke.test.ts` (jede Bojenzelle jedes Regelwerks:
  alle erlaubten Buchstaben einzeln und zu zweit laufen rund durch sanitizeBuoy → bojenWert).

## 4 Scheibe 3 – Langes Drücken; Bild-Umschalter nur von Hand (R7-21, R8-23, R8-20) – gebaut 22.11.2026

Stand nach dem Bau: components/wkr/langdruck.ts useLangdruck({kurz, lang, langMoeglich, gesperrt}) → `an(x)` für
`v-on` (pointerdown/move/up/cancel, contextmenu, click) und `fuellt` (Ring, `data-langdruck="fuellt"`). WkrBojen meldet
`disqBoje` → WkrMitte `disqAnBoje` → WkrMaske/WkrProbe `oeffneDisqAnBoje` (disqOffen + Prop `boje` an WkrDisqOrt =
Schritt 2); WkrBild öffnet seine eigene Buchstabenwahl. Beim Bau (LD1): Eine Boje ohne Disq.-Buchstaben kennt keinen
Langdruck – dort zählt auch ein langer Druck als Tipp. Der Ring ist fest (kein Übergang, die Maske kennt keine
Animation – styles/wkr-geraet.test.ts). `click` ohne vorherige Berührung (Tastatur, Hilfstechnik) = kurzer Tipp, ein
`click` bis 1 s nach einer Berührung gilt als ihr Nachläufer. Schalter: U3 `disqBojeLangdruck`, BD7
`bildDisqKnopfUndLangdruck`, BD4 `bildUmschalterNurVonHand`; neu langdruckMs 800, langdruckNieTipp, langdruckWegPx 10,
langdruckRingMs 300, langdruckPrellschutz.


### 4.1 Langes Drücken (U3, BD7 umgebaut; LD1–LD4 neu)

Heute: Disq. an einer Boje nur über DISQ im Fuß → Ortswahl bzw. Knopf „Disq. an Boje …“ (WkrBojen, WkrBild);
Prellschutz S1 in WkrMaske `tippeBojeKnopf` (Zeitmarke je Feld).

Festlegung:
- **LD1** Ein Druck von mindestens `WKR_ANNAHMEN.langdruckMs = 800` auf einen Bojen-Knopf (WkrBojen) bzw. einen
  Trefferkreis (WkrBild) öffnet die Disq.-Buchstaben DIESER Boje (WkrDisqOrt direkt im Schritt 2, Mehrfachwahl aus
  Scheibe 2). Der Knopf „Disq. an Boje …“ und DISQ im Fuß bleiben.
- **LD2** Ein Langdruck zählt NIE zusätzlich als Tipp: Die Berührung wird beim Loslassen (pointerup) gezählt, nicht beim
  Aufsetzen; ist der Langdruck ausgelöst, verwirft pointerup/click den Tipp. Heute zählt der Knopf über `@click` –
  umbauen auf eine gemeinsame Hilfe `components/wkr/langdruck.ts` (`useLangdruck({ ms, kurz, lang })`, Pointer-Events,
  `setPointerCapture`), die beide Komponenten nutzen. Tastatur (Enter/Leertaste) bleibt kurzer Tipp.
- **LD3** Abbruch: Bewegung über `langdruckWegPx = 10` (Wischen/Scrollen) oder pointercancel → weder Tipp noch
  Langdruck. `contextmenu` und Textauswahl auf den Knöpfen unterdrücken (iOS: `-webkit-touch-callout: none`,
  `user-select: none` in wkr-geraet.css, nur `.wkr-*`). Rückmeldung: nach ~300 ms ein Füllring/Rand am Knopf
  (Farbe `--wkr-*`), bei Auslösen `navigator.vibrate?.(30)` falls vorhanden.
- **LD4** Prellschutz (S1) bleibt beim kurzen Tipp unverändert (Zeitmarke beim gezählten Tipp, also pointerup); ein
  Langdruck setzt keine Zeitmarke. Gesperrte Maske (Übertragen, Pause) → kein Langdruck.
- Probe/Übung: Der Probe-Schritt „Disq. an Boje“ (U4) nennt beide Wege („… oder lange drücken“), Text in
  wkr.geraet.probe.* (de/en). Übung: ohne Änderung, der Langdruck geht dort automatisch.
- Tests: `components/wkr/langdruck.test.ts` (Fake-Timer erlaubt – keine echten Pausen: kurz → kurz-Rückruf; ≥ 800 ms →
  lang, kein kurz; Bewegung 12 px → keiner; pointercancel → keiner), `WkrBojen`- bzw. `WkrKnoepfe.test.ts`
  (Langdruck öffnet Ortswahl mit dieser Boje im Schritt 2, Zähler unverändert), `WkrBild.test.ts` (dasselbe im Bild),
  Prellschutz-Test unverändert grün.

### 4.2 R8-20: kein automatischer Wechsel auf „Rückweg“ (BD4 umgebaut)

Heute: `wkr/bild.ts wegNachTipp` schaltet beim ersten Tipp an Tor 5 auf dem Hinweg auf „rueck“; WkrBild.vue nutzt es.
Festlegung: `wegNachTipp` entfällt (oder gibt immer `weg` zurück – lieber löschen samt Lesern); der Umschalter wechselt
nur von Hand. Kopfkommentar WkrBild.vue (Z. ~28) und BD4 anpassen; Schalter `bildRueckNachTor5` → entfällt. Tests:
`wkr/bild.test.ts` (Tipp an Tor 5 lässt `hin`), `WkrBild.test.ts` (nach Tipp an Tor 5 zeigt der Umschalter weiter
„Hinweg“; zweiter Tipp an Tor 5 zählt auf dem Hinweg).

## 5 Scheibe 4 – Parallelslalom-Zeichnung aus dem Parcours-Repo (R8-19) – gebaut 22.11.2026

Überholt 23.11.2026 (Runde 9, R9-05 bis R9-07, docs/entscheidungen.md „Antworten 23.11.2026 (Runde 9)“): eine Bahn
ohne Steg aus `dist/parallel/alcatraz_Parcours`, IDs aus dem Parcours-Repo (`A_Boje1` …), keine Zuordnung nach Lage,
kein Zuschnitt in der App, für A und B dieselbe Bahn. Dieser Abschnitt bleibt als Verlauf.

Stand nach dem Bau: `lib/parcoursVertrag.ts` parallelZuordnung/machParallel/parallelBefunde (PARALLEL_QUELLE,
PARALLEL_DATEI, PARALLEL_PFLICHT_IDS, PARALLEL_AUSSCHNITT, BEARBEITUNGSVERMERK_PARALLEL; normalisiere nimmt den Vermerk
als Parameter), scripts/parcours-sync.ts mit zweitem Ordner (Git-Sauberkeit beider Ordner), `Parallel.svg` 23 KB
(Quelle 493 KB): weg sind LogoEN, text1016/text1026, abmessung samt „the dimensions shown …“ (g4772), ungenutzte Marker
(Arrow1Lstart-7, Arrow1Lend-6, RazorWire, Scissors, Legs) und Verläufe, `-inkscape-font-specification`; der Ausschnitt
ist auf die Bahnen verkleinert (viewBox 8 186 934 410). `metadata` blieb (Titel, Urheber, Lizenz reisen mit der Datei;
nur `ns2:` → `cc:`, damit metadaten() sie liest) – abweichend vom Plan, der sie streichen wollte. Gesetzt sind neben
Bojen und Start/Ziel auch `P_<bahn>_linie1…3` (Fahrlinien, Startlinie) und `P_<bahn>_nr1…5` (Ziffern), damit die
fremde Bahn ganz gedimmt werden kann. Racecourse A = obere Bahn der Zeichnung (gerechnet). QUELLE.json: Eintrag
`parallel` {ordner, quelle, titel, urheber, dateien}. lib/parcoursQuelle.ts lädt Parallel.svg wie die Klassen-SVGs
(`?raw`, eager, über glob – ohne Datei das Schema), parcoursDateien() bleibt die Klassenliste. wkr/bild.ts PARALLEL_BILD,
parallelBildId, bildZuordnung/bildTreffer (Zeichnung, sonst Schema), BildZuordnung.racecourse; WkrBild Titel
„Racecourse A“ und `data-racecourse` an der Fläche. Ladeweg: wie die Klassen-SVGs im einen Bündel (die App hat nur
einen Chunk) – dist-single 2 884 623 → 2 909 000 Bytes (+24 KB, gzip +2,5 KB). Tests: lib/parcoursVertrag.test.ts,
wkr/bild.test.ts, components/wkr/WkrBild.test.ts.

Befund beim Planen (Parcours-Repo lokal `../Parcours`, Commit 9b92e69, README.parallel.md):
- `dist/parallel/en/pontoon_bottom/ParallelSlalom.svg` (493 KB) und `Parcours.svg` („empty course“, 487 KB). Die Größe
  kommt fast ganz aus zwei eingebetteten Rasterbildern in der Gruppe `LogoEN` (`image8485` JPEG ~130 KB, `image6009`
  PNG ~320 KB). Ohne sie bleiben rund 38 KB Vektor.
- Zwei Bahnen übereinander (Gruppen-Versatz 172 Einheiten in y). Die Bojen der unteren Bahn tragen IDs aus dem
  Manövrier-Parcours (`Tor1_aussen`, `Tor2_innen`, `Tor3_aussen`, `Tor4_innen`, `Tor5_unten` = Bojen 1–5, orange
  `#ff6600`); die der oberen Bahn sind Kopien ohne sprechende IDs (`path17530` … `path17538`, gleiche x-Lagen).
  Ziffern 1–5 als Texte (`ParcoursLabel`), Start/Ziel als schwarze Kreise (`g13156`/`g13172` bzw. `g17522`/`g17526`),
  Fahrlinien in Gruppe `ParallelSlalom` (`path1028`/`path1030`, `path17586`/`path17588`), darin auch Titel- und
  Beschreibungstexte (`text1016`, `text1026`); Maße in `abmessung`, Steg in `steg_unten`/`Steg`.
- Keine Bahnbeschriftung „A“/„B“ in der Zeichnung.

Festlegung (BD3 umgebaut, BD8–BD10 neu):
- **Quelle**: `pontoon_bottom/ParallelSlalom.svg` (mit Fahrlinien – sie zeigen Hin/Rück wie die Klassen-SVGs);
  `Parcours.svg` nur, falls die Fahrlinien stören (beim Bau ansehen, im Kommentar begründen).
- **scripts/parcours-sync.ts** bekommt einen zweiten Ordner `dist/parallel/en/pontoon_bottom` (Git-Sauberkeit auch
  dort prüfen, `commit()`), kopiert die Datei als `src/assets/parcours/Parallel.svg` und **verkleinert beim Sync**:
  Gruppe `LogoEN` (Rasterbilder), Titel/Beschreibung (`text1016`, `text1026`), `metadata` und ungenutzte `defs`-Marker
  weg; Maße (`abmessung`) bleiben aus (optional – ansehen). Ziel < 60 KB; der Sync bricht ab, wenn danach noch ein
  `<image` drin ist oder die Datei > 100 KB ist. `QUELLE.json`: zweiter Eintrag (`ordner`, `dateien`) bzw. `quellen[]`
  mit Commit, Urheber, CC BY-NC-SA 4.0 – die Namensnennung (WkrBildNachweis.vue, LICENSE.md im Ordner) gilt auch für
  die Parallel-Zeichnung. `lib/parcoursVertrag.ts` (PARCOURS_DATEIEN, vertragsBefunde) um die Parallel-Datei und
  ihren Vertrag ergänzen.
- **IDs ohne Änderung am Parcours-Repo** (BD8): Der Sync setzt sprechende IDs, die bild.ts liest:
  `P_<bahn>_b1` … `P_<bahn>_b5`, `P_<bahn>_start` (die beiden Start/Ziel-Kreise als ein Tor: `_seiteA`/`_seiteB`) –
  zugeordnet über die Lage: untere Bahn über die vorhandenen IDs `Tor1_aussen`…`Tor5_unten`, obere Bahn je Boje die
  Kopie mit gleichem x (± 1) und dem Gruppen-/Bahnversatz; Start/Ziel-Kreise über Gruppen-Transform. Zuordnung als
  reine Funktion in `lib/parcoursVertrag.ts` (testbar am Original), der Sync bricht ab, wenn nicht genau 5 Bojen je
  Bahn und 2 Kreise je Bahn gefunden werden. Vorschlag für später (nur Notiz, Parcours-Repo NICHT ändern): IDs dort
  direkt vergeben (`A_Boje1` …) – steht in §8 als Frage.
- **Racecourse A/B ↔ Bahn** (BD9, Auslegung): Vom Steg (unten) aus gesehen ist Racecourse A die LINKE Bahn – wie die
  Vorgabe der Tafel „A links, B rechts“ (docs/parallelslalom.md). Welche der beiden SVG-Bahnen nach der Drehung links
  liegt, rechnet der Sync aus den Transformationen (nicht raten); Test am Original. Noch zu bestätigen.
- **Darstellung** (BD10): Das Bild einer Racecourse-Liste zeigt die ganze Zeichnung; die fremde Bahn ist gedimmt
  (`inlineSvg` Option `dim`), ihre Bojen ohne Trefferkreis (`aus`). Hin/Rück wie heute über PARALLEL_FAHRWEG; Boje n
  hin und rück ist dieselbe Boje (Umschalter sagt die Fahrt). Drehung nach Platz (bildDrehungNachPlatz) unverändert.
  Lage „pontoon_bottom“ = Steg unten = Blick des WKR vom Steg (wie die Klassen-SVGs).
- **Rückfall Schema**: `schemaParallel` bleibt nur, wenn die Datei fehlt (Build ohne Asset, Test) – `bildZuordnung`
  nimmt die Zeichnung, sonst Schema.
- Datei- und Ladegröße: Parallel.svg wird wie die Klassen-SVGs nur in der Maske geladen (dynamischer Import / `?raw`
  wie heute – prüfen, dass es nicht ins Haupt-Bundle fällt; `npm run build:all`, dist-single-Größe vorher/nachher).
- Tests: `lib/parcoursVertrag.test.ts` (Zuordnung am Original aus `../Parcours`, übersprungen, wenn es fehlt – wie die
  übrigen Sync-Tests; plus am synchronisierten Asset: je Bahn genau die IDs b1–b5, start A/B, kein `<image`),
  `wkr/bild.test.ts` (Parallel A und B: jede Boje des Aufbaus `parallel` hat genau einen Treffer in IHRER Bahn, die
  fremde Bahn ist `aus`; Schema nur ohne SVG), `WkrBild.test.ts` (Parallel rendert Zeichnung, Lizenzhinweis sichtbar).

## 6 Scheibe 5 – Knoten am Tisch (R8-27, R8-31, R8-32) – gebaut 22.11.2026

Gebaut wie unten festgelegt: wkr/tisch.ts naechsterOffener/tischOffen (Test tisch.test.ts), wkr/maske.ts restRichtig +
fertig (Merker `prueflisteRestRichtig`, vorher `prueflisteAlleGesetzt`), WkrPruefliste.vue (Vorschlag
`pruef-vorschlag`, Hauptknopf „✓ Alle richtig“/„✓ Rest richtig · Σ n“/„Abschicken · Σ n“, Rückfrage `pruef-frage` mit
`pruef-frage-ja`/`-nein`). „Zuletzt“ kommt ohne neues Feld aus dem Kern: `quelle.zuletzt` (eigene Zeilen, neueste
zuerst) – erfassen.ts und uebung.ts unverändert. Beim Bau ausgelegt (KN11): die Rückfrage steht in der Maske an
Stelle der Knoten, nicht als Dialog (sonst blockierte „1“ den Weg zu „12“); „Korrigieren“ aus der Prüfansicht des
Abschlusses fragt nicht noch einmal. Die Knoten-Liste hat keine Probe (W5.3) – kein Probe-Schritt nötig.

Heute: WkrPruefliste.vue – Startnummer über WkrZiffern, „offen n / m“, offene Nummern als Spalte (Pad) bzw.
aufklappbar (Handy); Hauptknopf gesperrt „noch n offen“ (KN7, `fertig` in maske.ts `pruefliste`); erledigte Nummer
öffnet direkt die Korrektur (KN8). Bestand in der Folge des Stands (wkr/liste.ts bestandOhneLauf = Starter-Reiter).

Festlegung:
- **KN9 Vorschlag (R8-27)**: reine Funktion `wkr/liste.ts` bzw. neue `wkr/tisch.ts naechsterOffener(bestand,
  zuletzt)`: der erste noch offene Starter NACH dem zuletzt getippten in der Folge des Bestands; gibt es dahinter keinen,
  vom Anfang (Rundlauf); ohne „zuletzt“ der erste offene. „Zuletzt“ = die Nummer der zuletzt abgeschickten Zeile auf
  diesem Gerät (gerätelokal im Kern, nicht im AppState); „offen“ = nicht erledigt laut Sicht PLUS nicht selbst
  abgeschickt (die Quittung kann nachlaufen – sonst schlüge er die gerade geschickte Nummer gleich wieder vor).
  Beispiel des Nutzers als Test: 8 fertig → 9; 10 getippt → 11; dann 9 → 11 (10 erledigt). „Laut Ablauf“ = Folge des
  Bestands; ist die Startfolge des Tages (betrieb/folge.ts) für Knoten sinnvoller (Knoten wird vor dem Start
  geprüft)? Auslegung: Bestand (Starter-Reiter) bleibt die Folge – noch zu bestätigen.
- Anzeige: Das leere Nummernfeld zeigt den Vorschlag als großen Knopf „Nächster: 9 (Klasse 2)“ (data-action
  `pruef-vorschlag`); Antippen übernimmt; Eintippen über WkrZiffern bleibt und ersetzt den Vorschlag. Kein Vorschlag,
  wenn nichts offen ist.
- **KN10 Hauptknopf „Alle richtig“ (R8-31)**: Solange Knoten offen sind, heißt der große Knopf „Alle richtig“ (wenn
  noch keiner gesetzt ist) bzw. „Rest richtig“ (wenn schon ✓/✗ gesetzt) und ist aktiv: setzt alle offenen auf ✓ und
  schickt ab (ein Tipp, wie „Fehlerfrei“ bei den anderen Listen – gleicher Takt der Rückmeldung). Sind alle gesetzt:
  „Abschicken“. `wkr/maske.ts`: `fertig` für `pruefliste` immer wahr (sobald eine Nummer gewählt ist); neue Funktion
  `restRichtig(e, aufbau)`; „noch n offen“ entfällt als Sperrtext (Text-Schlüssel entfernen in de/en).
- **KN11 Rückfrage bei erfasster Nummer (R8-32)**: Eine Nummer, die erledigt ist (Sicht) oder die das Gerät schon
  geschickt hat, öffnet zuerst eine Rückfrage „Nr. 23 ist schon erfasst – korrigieren?“ (Ja → Korrektur der eigenen
  Zeile bzw. neue Zeile, wenn sie vom Bedienrechner kam – wie heute; Nein → Feld leer, Vorschlag bleibt). Gilt auch,
  wenn der Vorschlag oder die Liste der offenen getippt wird (dort kann es nach einem Wechsel am Rechner vorkommen).
  Rückfrage-Komponente wie die übrigen Rückfragen der Maske (WkrMehr/WkrAbschluss-Muster), Texte wkr.geraet.pruef.*.
- Übung (geraete/uebung.ts, Bestand 20 erfundene Starter): Vorschlag, „Alle richtig“ und Rückfrage gehen dort ebenso.
- Probe (WkrProbe, falls die Knoten-Liste eine hat): Schritt „Alle richtig“ statt „alle setzen“.
- Tests: `wkr/tisch.test.ts` bzw. `wkr/liste.test.ts` (naechsterOffener: Beispiel des Nutzers, Rundlauf, nichts offen,
  selbst geschickt zählt als erledigt), `wkr/maske.test.ts` (restRichtig setzt nur offene, ✗ bleibt; Zellen ✓ = leer,
  ✗ = „5“), `WkrPruefliste.test.ts` (Vorschlag sichtbar/übernehmen; Hauptknopf-Texte „Alle richtig“ → „Rest richtig“ →
  „Abschicken“; Rückfrage bei erledigter Nummer, Nein lässt das Feld leer), `geraete/uebung.test.ts` (Knoten-Übung).

## 7 Scheibe 6 – Übung: Klasse vorziehen (R7-45); Beispieldaten je Klasse (R7-51) – gebaut 22.11.2026

Gebaut wie unten festgelegt. Beim Bau ausgelegt (Y4): Übersprungene Nummern merkt UebungsStand.`vorgezogen` (die
normale Folge überspringt sie, nichts doppelt), erfundene Starts stehen in `extra` (Nummer uebungStarts + k + 1, Lauf
des laufenden), der Steg-Anlegen-Merker „im Boot“ folgt `zuletzt`. Die Knoten-Liste hat kein „Mehr“: dort steht
„Klasse vorziehen“ aufklappbar unter den offenen Nummern (components/wkr/WkrVorziehen.vue, auch in WkrMehr); der
Kern trägt die Klasse als `vorgezogen` (nur Übung am Tisch), wkr/tisch.ts naechsterOffener nimmt sie als drittes
Argument. Beispieldaten: ✎ an handgesetzten Klassen (`data-hand`, `beispiel-hand`), Titel demo.perClass.handTitle.


### 7.1 Übung: andere Klasse vorziehen (Y4 neu)

Heute: wkr/uebung.ts verteilt die Klassen der Liste fest über die Übungsstarts (`klasseVon(i)` nach Nummer); man sieht
eine Klasse erst, wenn ihr Block drankommt. Takt Y1–Y3 bestätigt.

Festlegung:
- In der Übung bekommt „Mehr“ (WkrMehr, nur `uebung`) einen Eintrag „Klasse vorziehen“ mit den Klassen der Liste
  (`klassenVon`, Namen wie in der Maske – Klasse E unter UIM „Dolphin“). Wahl → der NÄCHSTE gezeigte Start ist ein
  Start dieser Klasse (der nächste noch nicht gezeigte ihres Blocks; ist der Block erschöpft, ein erfundener weiterer
  Start mit neuer Nummer). Danach geht es mit der normalen Folge weiter (keine dauerhafte Umstellung).
- Rein in `wkr/uebung.ts`: `UebungsStand.vorziehen?: ClassId` + `ziehVor(stand, klasse)`; `uebungsSchritt` nimmt ihn
  beim nächsten Zeigen. Der Kern geraete/uebung.ts bietet `zieheKlasseVor(klasse)` an der ErfassungsQuelle (nur
  Übung; die echte Quelle hat es nicht – optional im Typ). Ist gerade KEIN Start gezeigt (nach dem Abschicken, Takt
  läuft), kommt der vorgezogene sofort (der Übende will die Maske sehen).
- Knoten-Übung (Bestand): vorziehen = Vorschlag (Scheibe 5) springt auf den ersten offenen dieser Klasse.
- Texte wkr.geraet.uebung.vorziehen* (de/en, Sprache der Liste). Kein Text abgeschnitten bei 360 px (lange
  Klassennamen „Dolphin“).
- Tests: `wkr/uebung.test.ts` (ziehVor → nächster Start hat die Klasse; danach normale Folge; erschöpfter Block),
  `geraete/uebung.test.ts` (über die Quelle, ohne Netz, `bis()`), `src/main.uebung.test.ts` bleibt grün (kein Store,
  kein Netz).

### 7.2 Beispieldaten: von Hand gesetzte Klassenzahlen bleiben (BS3 umgebaut, BS4 neu)

Heute: BeispieldatenPanel.vue merkt `{ art, gesamt, klassen }` (`beispiel.klassen`); eine neue Gesamtzahl verteilt
ALLES neu (`setzeVorgabe` → `verteileAufKlassen(gesamt, ids)`); Zahl je Klasse setzt `klassen[id]`.

Festlegung:
- Gemerkt wird zusätzlich, welche Klassen von Hand gesetzt sind: `{ art, gesamt, klassen, hand: ClassId[] }`
  (`istBeispielKlassen` prüft `hand` als Array von Strings; fehlt es → `[]`).
- `domain/generate.ts verteileAufKlassen(gesamt, klassen, fest?: Partial<Record<ClassId, number>>)`: feste Klassen
  behalten ihre Zahl, der Rest `max(0, gesamt − Σ fest)` wird nach Anteilen auf die übrigen verteilt (gleiche
  Rundung wie heute). Ist Σ fest > gesamt, bleiben die festen stehen und die übrigen bekommen 0 – die Summenanzeige
  (`demo.perClass.sum`) zeigt die Abweichung wie heute.
- Zahl je Klasse eingeben → Klasse kommt in `hand`; Gesamtzahl ändern → nur übrige verteilen; „Vorschlag neu“ (BS2)
  zieht eine neue Gesamtzahl und verteilt ebenfalls nur die übrigen.
- **Knopf „Zurücksetzen“** (data-action `beispiel-klassen-zuruecksetzen`, neben der Klassentabelle): leert `hand`
  und verteilt die aktuelle Gesamtzahl neu über alle Klassen. Sichtbar nur, wenn `hand` nicht leer ist. Texte
  demo.perClass.reset/resetTitle (de/en). Eine handgesetzte Klasse ist markiert (z. B. „✎“ mit title).
- Wechsel der Veranstaltungsart (`art`) verwirft wie heute die Wahl (auch `hand`).
- Tests: `domain/generate.test.ts` (verteileAufKlassen mit festen Klassen: Summe, feste unverändert, Σ fest > gesamt),
  `views/EventView.test.ts` (Klasse von Hand → Gesamtzahl ändern → Hand-Zahl bleibt, übrige verteilt; Zurücksetzen
  verteilt alles; Neuladen behält `hand`).

## 8 Neue und umgebaute Auslegungen (alle 22.11.2026; beantwortet 23.11.2026, Runde 9)

Stand nach Runde 9 in der letzten Spalte (docs/entscheidungen.md „Antworten 23.11.2026 (Runde 9)“; in `WKR_ANNAHMEN`
je Eintrag vermerkt). Drei Zeilen sind **nicht** bestätigt und umgebaut: BD3/BD8, BD9, BD10 – die Parallel-Zeichnung
zeigt seit 23.11.2026 nur eine Bahn ohne Steg mit den IDs aus dem Parcours-Repository, für Racecourse A und B dieselbe.

| Kennung | Inhalt | Ort | Stand 23.11.2026 |
|---|---|---|---|
| AM1/AM2 umgebaut | Zeit-Listen sind Parcours-Listen (Ampel, Rückstand, Nachfrage, Auto-Modus) | WKR_ANNAHMEN, wkr/liste.ts | folgt der Entscheidung R7-01; in Runde 9 nicht gefragt |
| ZT3 umgebaut, ZT5 | nur das erste Zeitfeld ist Pflicht; weitere leer erlaubt, befüllt müssen sie lesbar sein; leere optionale Felder überschreiben keine Papierzeit | WKR_ANNAHMEN, wkr/maske.ts | bestätigt (R9-11) |
| ZT6 | Sprung ins nächste Zeitfeld, sobald die Zeit alle Stellen der Deutung hat (Sekunden ab 20: Komma + zwei Ziffern „83,45“; Minuten: Komma + vier „1,2345“ – beim Bau 22.11.2026, sonst sprang „1,23“ vor den Hundertsteln); nicht im letzten Feld | WKR_ANNAHMEN, wkr/maske.ts zeitVollstaendig, WkrZeiten.vue | bestätigt (R9-12) |
| BZ1 umgebaut, BZ6 | Bojenzelle „Punkte, Buchstaben“ mit „, “, Buchstaben in Katalogfolge, Dubletten weg; Speicherform = Anzeige | WKR_ANNAHMEN, lib/disq.ts | bestätigt (R9-01) |
| BZ7 | Disq.-Wahl an einer Boje ist Mehrfachwahl mit „Fertig“; „zurück“ nimmt den zuletzt gesetzten Buchstaben | WKR_ANNAHMEN, wkr/maske.ts | bestätigt (R9-02) |
| BZ8 | LISTEN_SICHT_FASSUNG 10 wegen der neuen Zellform | wkr/sicht.ts | technisch, folgt BZ1; nicht gefragt |
| U3/BD7 umgebaut, LD1–LD4 | Langdruck 800 ms öffnet Disq. der Boje; zählt nie als Tipp; Abbruch ab 10 px; Prellschutz unverändert | WKR_ANNAHMEN, components/wkr/langdruck.ts | bestätigt (R9-03, R9-04) |
| BD4 umgebaut | Bild-Umschalter nur von Hand | WKR_ANNAHMEN, wkr/bild.ts | folgt der Entscheidung R8-20; nicht gefragt |
| BD3 umgebaut, BD8 | Parallel-Zeichnung aus dem Parcours-Repo, IDs beim Sync über die Lage gesetzt (Frage: IDs im Parcours-Repo direkt vergeben?) | WKR_ANNAHMEN, scripts/parcours-sync.ts | **NICHT bestätigt (R9-05), umgebaut:** IDs `A_…`/`B_…` im Parcours-Repository, Ausgabe „eine Bahn ohne Steg“, der Sync prüft nur noch |
| BD9 | Racecourse A = linke Bahn vom Steg aus | WKR_ANNAHMEN | **NICHT bestätigt (R9-06), umgebaut:** keine Zuordnung; A und B zeigen dieselbe Bahn, die Liste sagt, welche |
| BD10 | fremde Bahn gedimmt, ohne Treffer | WKR_ANNAHMEN, wkr/bild.ts | **NICHT bestätigt (R9-07), umgebaut:** nur eine Bahn im Bild, nichts gedimmt |
| KN3 umgebaut, KN9 | Vorschlag „nächster offener nach dem zuletzt getippten“ in Folge des Bestands (Starter-Reiter), selbst geschickt zählt als erledigt | WKR_ANNAHMEN, wkr/tisch.ts | bestätigt (R9-08) |
| KN7 umgebaut, KN10 | Hauptknopf „Alle richtig“/„Rest richtig“ setzt offene auf ✓ und schickt ab | WKR_ANNAHMEN, wkr/maske.ts | bestätigt (R9-09) |
| KN8 umgebaut, KN11 | erfasste Nummer → immer Rückfrage vor der Korrektur | WKR_ANNAHMEN, WkrPruefliste.vue | bestätigt (R9-10) |
| Y4 | Übung: „Klasse vorziehen“ in „Mehr“, wirkt einmal auf den nächsten Start | WKR_ANNAHMEN, wkr/uebung.ts | bestätigt (R9-13) |
| BS3 umgebaut, BS4 | Hand-Zahlen je Klasse bleiben, Rest verteilt; „Zurücksetzen“ | generate.ts, BeispieldatenPanel.vue | bestätigt (R9-14) |

Neu beim Umbau nach Runde 9 ausgelegt (23.11.2026, bestätigt 24.11.2026 mit R10-01 bis R10-07): die Zeichnung der einen Bahn auf dem
Fahrweg-Bogen des Parallelslaloms (nur dieser Bogen, rechts neben der Legende in 100 mm Breite, zweisprachig bricht die
Legende dafür um) – lib/parallelBogen.ts, docs/parallelslalom.md „WKR-Listen des Vorlaufs“; das Schema (Rückfall ohne
Datei) für A und B gleich – WKR_ANNAHMEN BD3.
