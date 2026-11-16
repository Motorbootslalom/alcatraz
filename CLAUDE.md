# Alcatraz – Projektkarte

Statische Browser-App ohne Server, die die Excel-Auswertung für Motorbootslalom (Schlauchbootslalom) ersetzt:
Starter, Verzahnung, Verwiegung, WKR-Bögen, Laufzettel, Erfassung, Wertungs-, Einzel- und Mannschaftswertung, Druck.
Regelwerke: DM-Reglement (`dm-2026`) und UIM Regel 960 „Formula Future“ (`uim-2026`, mit Parallelslalom).
Daten nur im Browser (localStorage + IndexedDB-Verlauf, Sicherung als Datei); GitHub Pages oder eine HTML-Datei.

Technik: Vue 3 `<script setup lang="ts">`, TypeScript strict, Vite 7, Vitest + happy-dom, js-yaml.
Kein Router- und kein Store-Paket: Hash-Router `lib/router.ts`, eigener reiner Reducer `state/reducer.ts`.

## Befehle

```sh
npx vitest run src/lib/ergebnis src/lib/pokal   # gezielt: Pfadteile filtern; -t "Name" für einen Test
npm run test:geaendert                          # Tests zu nicht committeten Änderungen (vitest --changed)
npx vue-tsc -b                                  # Typen + im Code benutzte, in de.ts fehlende Schlüssel
npx vitest run src/i18n                         # gleiche Schlüssel/Platzhalter/Zahlformen in de.ts und en.ts
npx vitest run src/config/kurzform -u           # Snapshot nach gewollter Positionsänderung erneuern
npm run test:leise                              # volle Suite, nur Fehler + Zahlen – erst am Ende
npm run check                                   # vue-tsc + alle Tests (der Hook: dasselbe mit --reporter=minimal)
npm run build:all                               # dist/ (Pages, mit sw.js) und dist-single/ (eine Datei)
```

Volle Suite: rund 120 Testdateien, 35–45 s. Geänderte package.json/vite.config.ts lassen test:geaendert alles laufen.
Mit CLAUDECODE/AI_AGENT gibt Vitest knapp aus wie test:leise. CI (.github/workflows/ci.yml): check + build:all, Node 24.

## Ordnerkarte (* = eigene CLAUDE.md im Ordner, wird beim Lesen dort geladen)

```
src/types.ts, types/  Sammelpunkt (SCHEMA_VERSION = 1, welcher Typ wo); types/zustand (AppState), starter, planung, wertung, einstellungen, bogen (SheetDef)
src/main.ts, App.vue  Store anlegen, Offline starten; Kopf, Reiter (lib/adressen.ts VIEWS), Banner, Fuß
src/state/       *    Store, reiner Reducer (reducer.ts: Einstieg, Sperren; reducer/<bereich>.ts: die Actions), migrate(), Tor 5, zweiter Speicher
src/persistenz/       localStorage-Text, IndexedDB, Dateien Sicherung/Vorlage/Starter (backup.ts)
src/config/      *    YAML: Regelwerke, Aufbauten, Positionen, Laufzettel; configFor() löst auf; validate.ts
src/lib/         *    reine Logik: Wertung, Parallelslalom, Pokal, Bögen, Listen, Laufzettel, QR, Verlauf, Offline
src/components/  *    Blätter und Panels: bogen/, ergebnis/ (eigene Karte), pokal/, erfassung/; ListenDokument teilt Seiten
src/views/       *    Reiter: Event, Starters, Weighing, Verzahnung(+Parallel), Lists, Erfassung, Settings
src/domain/           Klassen, Startnummern, Kürzel, Staaten, Flaggen, Gewicht, Geschlecht, Beispielstarter
src/planung/          Verzahnung, Boote, laufende Nummern, Parallelslalom: Paarung, Runden, Re-run
src/import/           Excel/TSV-Import und -Export der Starter, Zusammenführen, Klassenprüfung
src/i18n/        *    de.ts (Quelle aller Schlüssel), en.ts: setzen de/, en/ nach Bereichen zusammen; t()/tIn()/texteIn()
src/data/             Beispieldaten: erfundene Namen; Clubs teils an reale angelehnt (in Bildern nie Herkunft „Verein“)
src/flaggen/          Flaggenbilder: Staaten aus country-flag-icons, Bundesländer als SVG (LIESMICH.md)
src/assets/parcours/  Parcours-SVGs, nur per `npm run parcours:sync` (QUELLE.json, CC BY-NC-SA 4.0)
src/styles/           CSS; blatt.css einzige Quelle der Listenfarben (--blatt-*), print.css Seitenränder
src/testHilfen.ts     nur Tests: wechsleRegelwerk (trotz Werten), knotenHaken (Regel-960-Knoten)
scripts/              Offline-Speicher (sw.js), parcours-sync, Warnfilter der Tests
docs/                 entscheidungen, funktionen, parallelslalom, betrieb, technik, stand (.md); bilder/ (README)
```

## Datenfluss

```
Komponente dispatch({ type, … })    IDs und Zufall (saat) entstehen VOR dem dispatch
 → state/store.ts dispatch          setzt action.zeit und Kennung; speichert nur, wenn next !== vorher
 → state/reducer.ts reducer()       rein; Sperren; Nachbearbeitung: Vorlaufplan, Tor 5, Abmeldungen, listenStand
 → AppState (reaktiv)               localStorage + IndexedDB-Verlauf (lib/verlauf.ts)
 → config/konfig.ts configFor()     YAML → aufgelöste Konfiguration je Regelwerk, Sprache, Beschriftung
 → lib/*                            wkrListen/bogen, ergebnis, parallelErgebnis/Stage, einzelwertung, pokal, laufzettel
 → components/**/…Blatt.vue         ListenDokument/BogenBlatt messen Zeilen, lib/seiten.ts bzw. lib/paging.ts teilen
 → views/ListsView.vue print()      window.print(); Bildschirmansicht = Druckansicht, jede Liste zählt ihre Seiten
Laden: persistenz/storage.ts bzw. backup.ts → state/migrate.ts migrate() → LOAD_STATE
```

## Wo ändere ich …

| Aufgabe | Stellen (Pfade ab src/) |
|---|---|
| Neue Einstellung (AppState) | types/zustand.ts → state/reducer/<bereich>.ts Action + case (emptyState: reducer/veranstaltung.ts), case-Zeile in reducer.ts → migrate.ts `stand` → SettingsView.vue |
| … Fortsetzung | i18n de/+en/listenoptionen.ts (listopt.*); backup.ts nur bei Veranstaltungs-/Personendaten; lib/verlauf.ts ARTEN optional |
| … Sonderfälle | nur UIM: SettingsView `v-if="parallel"`, Muster parallelZebra; Wertung: lib/listenStand.ts WERTUNG |
| Bedientext | i18n/de/<bereich>.ts UND en/<bereich>.ts (Präfix → Datei: i18n/CLAUDE.md); auf Listen useListenSprache()/texteIn(), nicht t() |
| Spaltenkopf Wertungsliste | i18n results.*, individual.col.* (de/+en/wertung.ts); Fahrweg: config/kurzform.ts + ergebnisText SPALTEN |
| Spaltenfolge Wertungsliste | components/ergebnis/*Blatt.vue: colgroup, thead, tbody gleich ändern (+ `erg-gruppe`) |
| Spalte/Titel WKR-Bogen | config/aufbauten/gemeinsam+parallel.yaml `spalten[].label`; Tor-Spalten kurzform.ts FAHRWEG |
| … Englisch, feste Texte | config/i18n/en.yaml (nach deutschem Wortlaut); config/sprache.ts bogenTexte() |
| Disq-Buchstabe, Fehlercode | config/regelwerke/<id>.yaml `disqualifikationen`/`kataloge`; regelwerke.test.ts |
| Läufe, Stichentscheid | Regelwerk-YAML `wertungslaeufe`/`stichentscheid`; lib/ergebnis.ts; STICH_KRITERIEN |
| Wertung Parallelslalom | lib/parallelErgebnis.ts PARALLEL_ANNAHMEN, parallelStage.ts; uim-2026.yaml |
| Re-run: Wertung | lib/parallelErgebnis.ts qualifikation, mitWiederholung(en), rundenVermerke; „*“: durchWiederholung |
| Re-run: Runde, Name | planung/parallelRunden.ts rerunRunde/zerlegeRerun/rundenName + sprache.ts bogenTexte().runde (Rundennamen doppelt: beide) |
| Einzelwertung | lib/einzelwertung.ts EINZEL_FESTLEGUNGEN; lib/disziplinen.ts (nichtWerten) |
| Mannschaftswertung | config/einstellungen.yaml pokalPunkte; Regelwerk-YAML `pokal`; config/pokal.ts; lib/pokal.ts |
| Laufzettel-Schritte | config/einstellungen.yaml `laufzettel` (Regelwerk ersetzt je Schlüssel); lib/laufzettelText.ts |
| Laufzettel Parallelslalom | lib/parallelBogen.ts rundenZettel (Schritte nur auf A); ParallelLaufzettel.vue |
| Seiten der WKR-Bögen | lib/paging.ts, lib/bogen.ts bogenSeiten; Stand wkrZeilenJeSeite/wkrTeilenAb/wkrLeerzeilen* |
| Seiten ausgleichen | lib/paging.ts gruppenSeiten/gruppenKapazitaet (Nutzer: bogen.ts, parallelBogen.ts) |
| Seiten der übrigen Listen | lib/seiten.ts listenSeiten (füllt auf, gleicht nicht aus; `gebunden`); ListenDokument.vue; mm ↔ CSS |
| Listenart unter „Listen“ | views/ListsView.vue KINDS; lib/adressen.ts; i18n lists.kind.* (de/+en/listen.ts); lib/doppelseitig.ts |
| Sprache der WKR-Bögen | lib/listensprache.ts wkrSpracheFuer(stand, parcoursId, typeId); lib/konfig.ts useBogenKonfig |
| Beispielansicht der Bögen | components/WkrVorschau.vue (Name nur Anzeige); Parallel: lib/parallelBogen.ts musterRundenBoegen |
| Druckdatei | lib/druckdatei.ts DRUCKDATEI_TEILE/druckdateiFolge; components/DruckdateiListen.vue |
| Neue Ansicht/Reiter | lib/adressen.ts VIEWS/ADRESSEN; App.vue `<main>`; i18n nav.* (de/+en/allgemein.ts) |
| Länder, Kürzel, Flaggen | domain/staaten.ts, kuerzel.ts, flaggen.ts; flaggen/bilder.ts; YAML `laenderKuerzel` |
| Starterfeld/Importspalte | types/starter.ts Starter → migrate.ts normalizeStarter → import/tsv.ts HEADER_ALIASES, Export |
| … Abgleich beim Import | import/starterMerge.ts FIELDS + Merge-Regel bei freiwilliger Spalte (Muster geschlecht) |
| Startnummern | domain/startnumbers.ts (parseClassNumber); YAML `startNrPraefix`; state/reducer/startnummern.ts assignStartNumbers |
| Reihenfolge im Starter-Reiter | lib/reihenfolge.ts (Spalten, stabil, mische); ClassSection.vue, StartersView.vue; ORDER_/SHUFFLE_STARTERS in state/reducer/startnummern.ts |
| Druck erst nach Verzahnung | views/ListsView.vue vorVerzahnung → WkrListen/LaufzettelListen `druckGesperrt` (Stapel no-print) |
| Datumsfeld | components/DatumFeld.vue (Textfeld, `sofort` = Formular); lib/datum.ts liesDatum; Import: import/tsv.ts |
| Jahrgang passt nicht zur Klasse | import/klassenPruefung.ts (klassenFuerJahr, startendeJahrgaenge); Vorschlag in ManualAddForm, ClassSection (MOVE_STARTER_TO_CLASS), ExcelPanel (klasseJeZeile) |
| Querverweis mit Auswahl | lib/adressen.ts drittes Segment `wahl` → router.ts useReiter `beiWahl` (Muster: WeighingView → ListsView gewichtHerkunft) |
| Dolphin-Präfix E/D | AppState.dolphinPraefix (state/reducer/startnummern.ts) → config/catalog.ts startNrPraefixe; components/StartNumberPanel.vue |
| Herkunft der Veranstaltung | AppState.originMode, SET_ORIGIN_MODE (views/EventView.vue, state/reducer/veranstaltung.ts); Anzeige lib/origin.ts |
| Neues Regelwerk / neue Angabe | regelwerke/<id>.yaml + regelwerke.yaml; Angabe: schema → validate → build → catalog |
| Neuer Aufbau | config/aufbauten/<name>.yaml + aufbauten.yaml `dateien`; en.yaml; Snapshot erneuern |
| Beispieldaten | components/BeispieldatenPanel.vue (Herkunft wie Veranstaltung, saat, Rückfragen); domain/generate.ts, data/*; |
| … Werte, Besetzung, Gewichte | lib/beispielwerte.ts; lib/beispieldaten.ts; Actions FILL_BEISPIEL* in state/reducer/erfassung.ts |
| Sperre einer Action | state/reducer.ts VERZAHNUNG_ACTIONS / PLAN_ACTIONS / STARTERFELD_ACTIONS; klasseFest in reducer/starter.ts |
| Offline, Update | scripts/offline-sw.js, scripts/offline-speicher.ts, lib/offline.ts, lib/update.ts |

## Feste Regeln

- Begriffe im Zweifel wie im Regelbuch (DM-Reglement, UIM Rulebook Regel 960), auch wenn das Gespräch andere
  Wörter nutzt. Englische Listen nach Rulebook: driver, race official, racecourse, attempt, preliminary heat,
  re-run, O.O.D. Deutsch: „Wertungslisten“, „Mannschaftswertung“, „Ausgleichsgewicht“.
- Listensprache folgt dem Regelwerk (DM deutsch, UIM englisch), nicht der Oberfläche; WKR-Bögen je Liste und Parcours
  (Racecourse), AppState.wkrSprachen wie die Einteilung; Erfassung = Oberfläche.
- Alle sichtbaren Texte über i18n: Schlüssel in de/ UND en/<bereich>.ts (gleiche Platzhalter, „Einzahl | Mehrzahl“).
  Regelwerks- und Positionstexte in YAML (`en`, config/i18n/en.yaml), Bogentexte in config/sprache.ts.
- Reducer rein und deterministisch: kein Date.now(), Math.random(), uid() darin oder in dem, was er ruft.
  Zeit setzt der Store, IDs und `saat` kommen mit der Action. Unverändert → dieselbe Referenz zurückgeben.
- Neue Zustandsfelder explizit in migrate() (Objekt `stand`, mit Typprüfung und Rückfall), Starterfelder in
  normalizeStarter(). Sonst kommt Kaputtes ungeprüft durch bzw. das Starterfeld verschwindet beim Laden.
- Neue Einstellungen gehören in views/SettingsView.vue, nicht in die Fachansichten. Bedienauswahl (Reiter,
  Filter, aufgeklappt) nicht in den AppState, sondern lib/merken.ts.
- Datumsfelder nie als `<input type="date">` (zeigt je nach System mm/dd/yyyy – „darf es nie geben“), immer
  components/DatumFeld.vue: deutsch TT.MM.JJJJ, englisch JJJJ-MM-TT, Schrägstrich = Tag zuerst; gespeichert JJJJ-MM-TT.
- Kein Geburtsdatum auf Wertungslisten. Klasse E heißt unter DM „E“, unter UIM „Dolphin“, nie „ME“.
- Parallelslalom nur unter UIM; unter DM fehlt er auch in Texten und Hinweisen (config/catalog.ts hasParallel).
- Druck: Seitenzahlen zählt jede Liste selbst, nie der Browser; Rand oben/unten höchstens 8 mm (sonst druckt
  Chromium Kopf- und Fußzeilen); Listenfarben nur über --blatt-* (styles/blatt.css).
- „X“ = nicht gestartet (lib/abmeldung.ts) muss in jedem Regelwerk stehen; „O“ wird nie vergeben.
- Annahmen nur an einer Stelle: PARALLEL_ANNAHMEN, EINZEL_FESTLEGUNGEN. Belege und Entscheidungen mit Datum als
  Kommentar (YAML bzw. Code) mitpflegen.
- Datenschutz: Das Repo ist öffentlich. Keine echten Namen, Geburtsdaten oder Einzelergebnisse in Code, Tests,
  Fixtures, Doku, Bildern; keine Pfade zu privaten Dateien außerhalb des Repos. Tests mit erfundenen Daten
  (data/names.ts, data/clubs.ts, Muster `Vor1`/`Nach1`/'Musterclub'), Hilfen in src/testHilfen.ts.
- Stil: keine Semikolons, einfache Anführungszeichen, 2 Leerzeichen, Kommentare auf Deutsch und mit dem Warum.
- Keine Abwärtskompatibilität nötig, solange die App in Entwicklung ist (alte Stände, Update-Übergänge).

## Arbeitsweise für Agenten

- Zuerst diese Karte und die CLAUDE.md des Bereichsordners, dann gezielt lesen: grep, Kopfkommentare, Read mit
  offset/limit. Groß: config/validate.ts, SettingsView.vue, docs/funktionen.md, docs/parallelslalom.md.
- Fachliche Fragen: docs/entscheidungen.md (auch „Entschieden, noch nicht umgesetzt“ und „Offen“). Bei Widerspruch
  zum Code nichts still ändern: datierten Code-Kommentar und docs/funktionen.md bzw. parallelslalom.md vergleichen,
  es gilt die jüngere Entscheidung; im Zweifel den Nutzer fragen und danach die Liste nachziehen.
- Gezielt testen; volle Suite (`npm run test:leise`) nur am Ende. Nach Typ- oder i18n-Änderungen `npx vue-tsc -b`.
- Bildschirmfotos klein halten (Ausschnitt, geringe Auflösung). README.md bleibt kurz; Neues gehört nach docs/.
  Bilder für docs/bilder/: Regeln in docs/technik.md unter „Entwickeln“ (nur Beispieldaten, nie Herkunft „Verein“).
