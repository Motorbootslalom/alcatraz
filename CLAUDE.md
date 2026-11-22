# Alcatraz – Projektkarte

Statische Browser-App ohne eigenen Server, die die Excel-Auswertung für Motorbootslalom (Schlauchbootslalom) ersetzt:
Starter, Verzahnung, Verwiegung, WKR-Bögen, Laufzettel, Erfassung, Wertungs-, Einzel- und Mannschaftswertung, Druck;
am Wettkampftag Start-Freigabe, Anzeigetafel im zweiten Fenster, Startliste mit Wartezeiten und Zuschauerliste,
unter UIM auch für den Parallelslalom (Plan zur Übernahme der Tafel, 16.11.2026: E1–E4); E5–E7 = Gerätebetrieb:
Anzeigetafel und Zuschauerliste über Lese-Links (QR) auf anderen Geräten, Start-Freigabe vom gekoppelten Handy (E7),
verschlüsselt über einen fremden ntfy-Server.
Regelwerke: DM-Reglement (`dm-2026`) und UIM Regel 960 „Formula Future“ (`uim-2026`, mit Parallelslalom).
Daten nur im Browser (localStorage + IndexedDB-Verlauf, Sicherung als Datei); GitHub Pages oder eine HTML-Datei.
Einzige Ausnahme: der bewusst eingeschaltete Gerätebetrieb (Betrieb → Geräte) – dann gehen Startnummer, Name nach
der öffentlichen Namensregel, Herkunft, Klasse, Startfolge und Meldungen verschlüsselt über den ntfy-Server; ohne
Einschalten keine Verbindung (src/main.geraete.test.ts).

Technik: Vue 3 `<script setup lang="ts">`, TypeScript strict, Vite 7, Vitest + happy-dom, js-yaml; tweetnacl (geraete/).
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
npm run dev:https                               # Handy-Test im WLAN mit HTTPS (selbst signiert; Wake Lock), docs/technik.md
```

Volle Suite: rund 120 Testdateien, 35–45 s. Geänderte package.json/vite.config.ts lassen test:geaendert alles laufen.
Mit CLAUDECODE/AI_AGENT gibt Vitest knapp aus wie test:leise. CI (.github/workflows/ci.yml): check + build:all, Node 24.

## Ordnerkarte (* = eigene CLAUDE.md im Ordner, wird beim Lesen dort geladen)

```
src/types.ts, types/  Sammelpunkt (SCHEMA_VERSION = 1, welcher Typ wo); types/zustand (AppState), starter, planung, wertung, einstellungen, bogen (SheetDef), wkr
src/main.ts, App.vue  Wurzel nach Adresse; Store anlegen, Offline starten; Kopf, Reiter (lib/adressen.ts VIEWS), Banner, Fuß
src/AnzeigeApp.vue    Wurzel der Anzeigetafel `#/anzeige[/<bereich>]`: Nur-Lese-Store, ohne Kopf/Scanner/Offline
src/ZuschauerApp.vue  Wurzel der Zuschauerliste `#/zuschauer[/<bereich>]` (E3): ebenso, liest nur sichtZuschauer
src/GeraetApp.vue     Wurzel eines Geräts `#/sehen/<paket>` (E6), `#/koppeln/<paket>`/`#/geraet` (E7), `#/uebung` (W3.4): OHNE Store
src/state/       *    Store, reiner Reducer (reducer.ts: Einstieg, Sperren; reducer/<bereich>.ts: die Actions), migrate(), Tor 5, zweiter Speicher
src/persistenz/       localStorage-Text, IndexedDB, Dateien Sicherung/Vorlage/Starter (backup.ts)
src/config/      *    YAML: Regelwerke, Aufbauten, Positionen, Laufzettel; configFor() löst auf; validate.ts
src/lib/         *    reine Logik: Wertung, Parallelslalom, Pokal, Bögen, Listen, Laufzettel, QR, Verlauf, Offline
src/betrieb/     *    Betrieb am Wettkampftag, rein: Folge (abgeleitet), Lage, Schritte, Sicht, Prognose, BETRIEB_ANNAHMEN
src/wkr/         *    Digitale WKR-Erfassung (W1–W5), rein: Listen (auch ohne Lauf am Tisch), Zeile prüfen, Schlange, Übernahme, Sicht der Liste, Lage, Freigabe-Sicht, Maske, Bojen, Bild, Tabelle, Anordnung, Maskenwahl, Übung, WKR_ANNAHMEN
src/geraete/     *    Gerätebetrieb über ntfy (E5 Kern, E6 Lese-Links, E7 Koppeln, W1 WKR): transport/, Themen, Führung, Fensterbus, Ablage (gerätelokal), paket, host (Bedienfenster), geraet/gekoppelt/erfassen (Gerät)
src/components/  *    Blätter und Panels: bogen/, ergebnis/ (eigene Karte), pokal/, erfassung/, anzeige/, betrieb/, zuschauer/, wkr/ (Handy- und Pad-Maske)
src/views/       *    Reiter: Event, Starters, Weighing, Verzahnung(+Parallel), Lists, Betrieb, Erfassung, Settings
src/domain/           Klassen, Startnummern, Kürzel, Staaten, Flaggen, Gewicht, Geschlecht, Beispielstarter
src/planung/          Verzahnung, Boote, laufende Nummern, Parallelslalom: Paarung, Runden, Re-run
src/import/           Excel/TSV-Import und -Export der Starter, Zusammenführen, Klassenprüfung
src/i18n/        *    de.ts (Quelle aller Schlüssel), en.ts: setzen de/, en/ nach Bereichen zusammen; t()/tIn()/texteIn()
src/data/             Beispieldaten: erfundene Namen; Clubs teils an reale angelehnt (in Bildern nie Herkunft „Verein“)
src/flaggen/          Flaggenbilder: Staaten aus country-flag-icons, Bundesländer als SVG (LIESMICH.md)
src/assets/parcours/  Parcours-SVGs, nur per `npm run parcours:sync` (QUELLE.json, CC BY-NC-SA 4.0)
src/styles/           CSS; blatt.css einzige Quelle der Listenfarben (--blatt-*), print.css Seitenränder; anzeige.css (--anzeige-*), zuschauer.css, wkr-geraet.css (--wkr-*)
src/testHilfen.ts     nur Tests: wechsleRegelwerk (trotz Werten), knotenHaken (Regel-960-Knoten), Testlogos
scripts/              Offline-Speicher (sw.js), parcours-sync, Warnfilter der Tests
docs/                 entscheidungen, funktionen, parallelslalom, betrieb (Ablauf am Wettkampftag), feldtest (E8), technik, stand (.md); bilder/ (README)
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
| Bojenzelle „5J“ (Punkte + Disq., W4-12) | lib/disq.ts sanitizeBuoy (schreiben), lib/scoring.ts bojenWert (EINZIGER Leser); Gerät: wkr/maske.ts zellenAus, components/wkr/WkrDisqOrt.vue; WKR_ANNAHMEN BZ1–BZ5 |
| Läufe, Stichentscheid | Regelwerk-YAML `wertungslaeufe`/`stichentscheid`; lib/ergebnis.ts; STICH_KRITERIEN |
| Wertung Parallelslalom | lib/parallelErgebnis.ts PARALLEL_ANNAHMEN, parallelStage.ts; uim-2026.yaml |
| Runden nach dem Vorlauf: Verzahnung, „Alle Klassen weiter“ | planung/parallel.ts verzahne (auch Vorlauf), parallelRunden.ts verzahneRunde; lib/parallelStage.ts alleWeiter; state/reducer/parallel.ts (gebunden: erfasst ohne Abmelde-X/begonnen; rundenNeuGeordnet → Rückfrage); components/ParallelRunden.vue |
| Re-run: Wertung | lib/parallelErgebnis.ts qualifikation, mitWiederholung(en), rundenVermerke; „*“: durchWiederholung |
| Runde gedruckt (fest), „Druck lösen“ | AppState.parallelGedruckt; views/ListsView.vue `beforeprint` → PARALLEL_RUNDEN_GEDRUCKT; state/reducer/parallel.ts rundeGebunden; components/ParallelRunden.vue |
| Re-run: Runde, Name | planung/parallelRunden.ts rerunRunde/zerlegeRerun/rundenName + sprache.ts bogenTexte().runde (Rundennamen doppelt: beide); Runden pre/semi/small/final (lib/parallelSchluessel.ts PARALLEL_RUNDEN, Kleines Finale eigene Runde seit 21.11.2026) |
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
| Reihenfolge im Starter-Reiter | lib/reihenfolge.ts (Spalten, stabil, mische; Stufen ↑ A→Z, ↓ Z→A, aus naechsteSortierung (S-01), SortierWahl mit Folge, 21.11.2026); ClassSection.vue, StartersView.vue; ORDER_/SHUFFLE_STARTERS in state/reducer/startnummern.ts |
| Ladebalken langer Listen (schrittweiser Aufbau) | lib/aufbau.ts useSchrittweise/AUFBAU (Messung im Kopfkommentar), components/AufbauBalken.vue; WkrListen/ParallelWkrListen `stand.fertig` → ListsView `imAufbau` (Knopf), Stapel `no-print` + `data-aufbau`; Tests aus über test-setup.ts setzeSchrittweise(false); i18n lists.aufbau.* |
| WKR-Bögen: Druckfolge (Position), Druck nach Modus | lib/wkrListen.ts WKR_DRUCKFOLGE (+ parallelBogen.ts); wkr/druck.ts (WKR_ANNAHMEN Z1–Z7) → components/wkrDruck.ts, WkrDigitalHinweis.vue |
| Druck erst nach Verzahnung | views/ListsView.vue vorVerzahnung → WkrListen/LaufzettelListen `druckGesperrt` (Stapel no-print) |
| Datumsfeld | components/DatumFeld.vue (Textfeld, `sofort` = Formular); lib/datum.ts liesDatum; Import: import/tsv.ts |
| Jahrgang passt nicht zur Klasse | import/klassenPruefung.ts (klassenFuerJahr, startendeJahrgaenge); Vorschlag in ManualAddForm, ClassSection (MOVE_STARTER_TO_CLASS), ExcelPanel (klasseJeZeile) |
| Querverweis mit Auswahl | lib/adressen.ts drittes Segment `wahl` → router.ts useReiter `beiWahl`, bleibt per `wahlFuerAdresse` (Muster: WeighingView → ListsView gewichtHerkunft) |
| Startnummern nach Westengröße, fehlende Westen | domain/startnrBereiche.ts (vergibKlasse, naechsteStartNr, verteileInBereichen); YAML `startNrBereiche` → config/catalog.ts startNrBereicheOf/startNrRegeln; AppState.startNrBereiche/fehlendeStartNr (state/reducer/startnummern.ts); components/StartNrBereichePanel.vue |
| Dolphin-Präfix E/D | AppState.dolphinPraefix (state/reducer/startnummern.ts) → config/catalog.ts startNrPraefixe; components/StartNumberPanel.vue |
| Herkunft der Veranstaltung | AppState.originMode, SET_ORIGIN_MODE (views/EventView.vue, state/reducer/veranstaltung.ts); Anzeige lib/origin.ts |
| Neues Regelwerk / neue Angabe | regelwerke/<id>.yaml + regelwerke.yaml; Angabe: schema → validate → build → catalog |
| Neuer Aufbau | config/aufbauten/<name>.yaml + aufbauten.yaml `dateien`; en.yaml; Snapshot erneuern |
| Beispieldaten | components/BeispieldatenPanel.vue (Herkunft generate.ts beispielHerkunft: wie Veranstaltung, Clubmeisterschaft keine; saat, Rückfragen); domain/generate.ts, data/*; Gesamtzahl (Vorschlag) und Zahl je Klasse (merke `beispiel.klassen`): generate.ts BEISPIEL_STARTERZAHL, BEISPIEL_KLASSEN_ANTEILE, verteileAufKlassen |
| … Werte, Besetzung, Gewichte | lib/beispielwerte.ts; lib/beispieldaten.ts; Actions FILL_BEISPIEL* in state/reducer/erfassung.ts |
| … Boote, Co-Piloten (Beispiel) | data/boote.ts; lib/beispieldaten.ts beispielBoote/-CoPiloten, lib/besetzung.ts besetzungsKlassen/coPilotKlassen; Knöpfe lib/beispielBoote.ts (nur BeispieldatenPanel, 21.11.2026: Beispielwerte an EINER Stelle) |
| Sperre einer Action | state/reducer.ts VERZAHNUNG_ACTIONS / PLAN_ACTIONS / STARTERFELD_ACTIONS; klasseFest in reducer/starter.ts |
| Logos auf den Listen | lib/logo.ts (Grenzen, logoWert, Maße), lib/logoBild.ts (Verkleinern), lib/listenLogos.ts (useListenLogos); components/KopfLogos.vue in jedem Listenkopf, LogosPanel.vue; styles/logos.css |
| Offline, Update | scripts/offline-sw.js, scripts/offline-speicher.ts, lib/offline.ts, lib/update.ts |
| Betrieb: Folge, Lauf beginnen, Nächster | betrieb/folge.ts (lage), state/reducer/betrieb.ts (BETRIEB_*); Auslegungen nur betrieb/annahmen.ts |
| … umstellen (zurückstellen, aussetzen, verschieben, einsteigen) | betrieb/schritte.ts (Schnappschuss, Abgleich, webeNeu); Actions in state/reducer/betrieb.ts |
| … was Tafel und Freigabe sehen | betrieb/sicht.ts sichtOeffentlich (EINE Stelle, Datenschutz; Form ändern → `sv`, sicht.test.ts) |
| Anzeigetafel: Aussehen, Schrift | components/anzeige/AnzeigeTafel.vue + AnzeigeBereich.vue, styles/anzeige.css (--anzeige-*), lib/fit.ts |
| … Fenster, Adresse, Rückfall file:// | AnzeigeApp.vue/ZuschauerApp.vue/GeraetApp.vue, main.ts (Wurzel), lib/adressen.ts VOLLBILDER/liesVollbild, lib/anzeigeFenster.ts; Vollbild/Mauszeiger lib/tafelFenster.ts |
| … Einstellung | SettingsView `#anzeigetafel`, `#betrieb` (Startfolge, Am/Vor Steg, Startabstände) → SET_ANZEIGE (normalisiereAnzeige); Texte listopt.anzeige.*, listopt.betrieb.* |
| Start-Freigabe (Bedienung) | views/BetriebView.vue, components/betrieb/ (StartFreigabe + BetriebsFolge, EinreihenListe, KlassenAussetzen, MeldungWahl, EinsteigenAb; texte.ts); i18n betrieb.* |
| Parcours-Ampel, „Durchs Start-Tor“, Auto-Modus (P-03) | wkr/liste.ts istParcoursListe, wkr/ampel.ts (parcoursAmpel, autoSchritt, laufLage), wkr/lage.ts durchfahrtVon; BETRIEB_DURCHFAHRT (state/reducer/betrieb.ts); Freigabe-Sicht fv 2 (wkr/freigabe.ts); Auto im Führungsfenster geraete/host.ts; components/betrieb/StartFreigabe.vue; Annahmen WKR_ANNAHMEN AM1–AM5/AM9/AM10, BETRIEB_ANNAHMEN AM6–AM8 |
| Startliste, Wartezeiten („ca. in“, Zum Vorsteg) | betrieb/prognose.ts (Messung auf dem Stand, wartezeiten auf dem Bildschirm), components/betrieb/StartListe.vue, lib/uhr.ts; Vorgabe einstellungen.yaml `startabstaende` → config/catalog.ts startabstandOf |
| Zuschauerliste | betrieb/sicht.ts sichtZuschauer (Schlüssel-Test), components/zuschauer/ZuschauerListe.vue (Klassen- und Team-Filter, BETRIEB_ANNAHMEN.zuschauerTeamFilter; merke `dauerhaft`), styles/zuschauer.css; i18n zuschauer.* (Tafel-Sprache) |
| Parallelslalom im Betrieb (UIM) | betrieb/folge.ts parallelFolge (Ref aus fest.starts, leere Seite, `paar`), SichtStart.paar (sicht.ts), Schritte gesperrt/Paar als Einheit in state/reducer/betrieb.ts; AnzeigeBereich.vue (A/B); texte.ts tBereich (`….runde`-Texte) |
| Geräte: Nachrichten, Signatur, Leitung zu ntfy | geraete/transport/protokoll.ts (Arten, PROTOKOLL_FASSUNG), ntfy/wire.ts, ntfy/leitung.ts (NTFY_ZEITEN), ntfy/transport.ts (Host/Gerät); Tests mit ntfy/testNtfy.ts |
| … Themen, Vorgabe-Server | geraete/themen.ts (`NTFY_VORGABE` – einzige Stelle des Hostnamens) |
| … wo Raum/Schlüssel liegen | geraete/ablage.ts ABLAGE (`alcatraz.geraete.*`, `alcatraz.geraet.*`), nie AppState |
| … welches Fenster verbindet, wo Geräte-Actions angewandt werden | geraete/fuehrung.ts (Web Locks, Lease), geraete/fensterbus.ts (Schreibfenster, 1 s Rückfall) |
| … Bedienung (einschalten, Links, QR, erneuern, beenden, Verbindung) | components/betrieb/GeraeteRaum.vue (+ LeseLink.vue, GeraeteLage.vue), BetriebView `geraete`; Logik geraete/host.ts (useGeraeteHost); i18n geraete.* (betrieb.ts) |
| … Koppeln, Geräteliste (E7) | components/betrieb/GeraeteKoppeln.vue (QR = Hauptweg; Geräte-Code + Koppel-Link zugeklappt, BETRIEB_ANNAHMEN.koppelnWege), GeraeteListe.vue (Name, Bereiche, entziehen); host.ts gibCode/oeffneQr/setzeAufgaben/entziehe; Rechte geraete/aufgaben.ts (Positivliste) |
| … WKR-Liste einem Gerät zuweisen (W3.2) | components/betrieb/wkrListenWahl.ts (Listen, Titel, „Maske folgt“ über wkr/maske.ts listeMitMaske, istHandyName); GeraeteKoppeln.vue (merke `geraete.koppeln.liste`/`.teil`), GeraeteListe.vue (Teil, dazu, entfernen, ≤ LISTEN_JE_GERAET); WkrMatrix-Verweis `#/betrieb/geraete/<liste>` → BetriebView beiWahl; i18n geraete.koppeln.liste*, geraete.liste.liste* |
| … Start-Freigabe auf dem Handy (E7) | components/betrieb/GeraetFreigabe.vue (in GeraetApp für `#/koppeln`, `#/geraet`; StartFreigabe `nur-dieser`, Sperre bis Quittung); geraete/gekoppelt.ts; i18n geraete.freigabe.*, geraete.ablehnung.* |
| … Lese-Link, Gerät, Fassung (F7) | geraete/paket.ts (`#/sehen/<paket>`, leseLinkUrl, lib/build.ts PAGES_URL), geraete/geraet.ts, src/GeraetApp.vue; Selbst-Update lib/offline.ts holeNeueFassung |
| … Wake Lock, „Alle Geräte neu laden“, Kontingent (E8) | lib/wachBleiben.ts (GeraetApp-Hinweis `geraete.sehen.bildschirmKannAus`); host.ts ladeAlleNeu/neueFassung + geraet.ts NEULADEN_BEFEHL_GUELTIG_MS; geraete/kontingent.ts KONTINGENT; Oberfläche GeraeteRaum.vue; Bedienung docs/betrieb.md, Feldtest docs/feldtest.md |
| WKR-Maske „Bild“ (W5.2): Boje ↔ SVG-ID, Umschalter Hin/Rück/Rück 2, Parallel-Schema, Trefferkreise | wkr/bild.ts (BILD_BOJEN, bildTreffer, bildZiel, wegNachTipp, schemaParallel, inlineSvg, schiebeAuseinander; innen/außen nur über config/kurzform.ts bildBojeId); components/wkr/WkrBild.vue (Einbau WkrMitte/WkrMaske `bildZuordnungJetzt`, WkrProbe, WkrUebung `uebung-maske`), Stile `.wkr-bild*` (--wkr-bild-*); Entwurf/Zellen nur wkr/maske.ts; Auslegungen BD1–BD7; Test wkr/bild.test.ts (alle Klassen-SVGs × Aufbauten × Klassen) |
| WKR-Knoten am Tisch (W5.3): Liste ohne Lauf, Start = Starter, Bestand, Prüfliste ✓/✗ | wkr/liste.ts (TISCH_BEREICH, ohneLaufKennung, bestandOhneLauf, startAufListe `o`), zeile.ts, sicht.ts (`bestand`/`offen`, Fassung 9), lage.ts tischLage, abschluss.ts OHNE_PUNKT (types/wkr.ts WkrPunkt), maske.ts `pruefliste` (tippePruef, fertig); Reducer state/reducer/wkr.ts (WKR_ABSCHLUSS `ohne`, normalisiereWkr); Gerät geraete/erfassen.ts `bestand`, geraete/uebung.ts; Oberfläche components/wkr/WkrPruefliste.vue + WkrZiffern.vue (Einbau WkrGeraet), WkrMatrix-Block `wkr-tisch`, wkrListenWahl „Am Tisch“; Auslegungen KN1–KN8; Plan docs/plan-wkr-w5.md §6 |
| WKR-Zeit-Listen (W5.4): Ziffernblock, „keine Zeit“ mit Grund | wkr/maske.ts (art `zeit`, Bojen + Zeit, setzeZeit/setzeKeineZeit, fertig, zellenAus = Roh-Eingabe wie ZeitZelle.vue, lib/time.ts), wkr/zeile.ts `kz`, wkr/keineZeit.ts (WkrStand.keineZeit, migrate), lage.ts ZellLage.keineZeit/zeilenMarken; Gerät geraete/erfassen.ts + uebung.ts (`kz`, keineZeit, korrigiere); Oberfläche components/wkr/WkrZeiten.vue + WkrZiffern.vue `zeit` (Einbau WkrMitte/WkrMaske/WkrProbe/WkrUebung), WkrMatrix/WkrEingang; Auslegungen ZT1–ZT4; Plan docs/plan-wkr-w5.md §7 |
| WKR-Maske „Tabelle“ für Geübte (W5.5): Spalten wie der Bogen, Eingabe über die Sanierer, Tab/Enter, Korrektur in der Tabelle | wkr/tabelle.ts (tabellenSpalten, zelleAusEingabe, zeileAusEingaben mit Rund-Probe über maske.ts entwurfAus → zellenAus, eingabenAus; Fehler als Codes); components/wkr/WkrTabelle.vue (Einbau WkrMitte `tabelle`, WkrMaske `tabelle`/`tabellenFehler`, WkrFuss `zellenFehler`); nur Pad/Rechner wkr/maskenWahl.ts maskeAufGeraet (WkrMehr/GeraeteListe ausgegraut, WkrUebung auf dem Pad); i18n wkr.geraet.tabelle.*; Auslegungen TB1–TB5; Plan docs/plan-wkr-w5.md §8 |
| WKR-Erfassung am Gerät: Zeile, Schlange, Übernahme | wkr/ (zeile.ts pruefeZeile, schlange.ts, uebernahme.ts, annahmen.ts WKR_ANNAHMEN); Stand types/wkr.ts AppState.wkr, Actions state/reducer/wkr.ts; Haken lib/eingaben.ts istHaken/teilHaken |
| … was das WKR-Gerät sieht, was es darf | wkr/sicht.ts sichtListe (Feld für Feld, LISTEN_SICHT_FASSUNG, sicht.test.ts Schlüssel); Rechte geraete/aufgaben.ts Aufgabe `liste`, WKR_ACTIONS, erlaubteWkr; Gruppe geraete/wkrGruppen.ts |
| WKR-Maske „Knöpfe“ (W3): Aufbau, Tipps → Zellwerte, Takt; Übung ohne Netz | wkr/maske.ts (maskeFuer, zellenAus über lib/codes.ts, wechselTakt; maske.test.ts: jede Tipp-Folge besteht wertGilt), wkr/sicht.ts maskenJeKlasse/`andere` (F13), wkr/uebung.ts; Gerätekern geraete/erfassen.ts (Schlange je Teil, Entwürfe, holeZurueck, pruefung, ErfassungsQuelle), geraete/uebung.ts oeffneUebung; Ansicht/Probe geraete/ablage.ts; Maskenvorgabe aufgaben.ts `maske`/`fest`; Auslegungen G1–G16/H1–H5 in WKR_ANNAHMEN; Plan docs/plan-wkr-w3.md |
| WKR-Bojen-Maske (W4): Halt einer Boje, Fahrtfolge, Seiten nach Blick, Schalter/Zähler | wkr/bojen.ts (bojenHalt, katalogFolge, PARALLEL_FAHRWEG ↔ parallel.yaml), wkr/sicht.ts MaskenFeld.boje (seit W4.1), wkr/maske.ts (art `bojen`, abschnitte, umschalter, tippeBoje); Oberfläche components/wkr/WkrBojen.vue + WkrWegUmschalter.vue (Einbau WkrMaske, Probe WkrProbe, Übung WkrUebung), Stile `.wkr-bojen*` in styles/wkr-geraet.css; Auslegungen P1–P17, Q1–Q7 in WKR_ANNAHMEN; Plan docs/plan-wkr-w4.md |
| WKR-Maske auf dem Pad (W5.1): Anordnung, Spalten, Seitenspalte, Steg ganz, Rundenband, Attempt-Wechsel, Maskenwahl | wkr/anordnung.ts (PD1–PD3, Fenster über components/wkr/systemModus.ts useFenster, Art aus geraete/gekoppelt.ts `typ`), wkr/maskenWahl.ts (MW1, MASKEN_GEBAUT, TB1 maskeAufGeraet); components/wkr/WkrGeraet.vue (Spalten, Reiter, Probe je Spalte, PD4), WkrMaske.vue (seite, stegTeil, PD5 wkr/maske.ts attemptWechsel), WkrMitte.vue (Wahl der Mitte), WkrSeite.vue (PD3/PD6); Stile styles/wkr-geraet.css `data-anordnung`, geraet.css Hülle; Vorgabe am Bedienrechner components/betrieb/GeraeteListe.vue (Aufgabe.maske/fest), Wahl auf dem Gerät geraete/ablage.ts `masken`, Probe je Maske; Auslegungen PD1–PD6, MW1–MW3; Plan docs/plan-wkr-w5.md |
| … Disq. an der Boje (21.11.2026), Bojen-Folge „Rückweg gedreht“/Fahrtfolge/untereinander (22.11.2026) | wkr/maske.ts tippeBojenDisq/bojenDisq (Zelle = Buchstabe, sanitizeBuoy), BojenFolge/mitUmschalter/bojenAbschnitte(Alle); WkrBojen.vue, WkrDisqOrt.vue, WkrProbe.vue (`folge`), WkrMehr.vue (Ansicht), Merken geraete/ablage.ts GeraetAnsicht.bojenFolge; WKR_ANNAHMEN U1–U4, V3 bojenFolge |
| … „Nicht vorbeigekommen“ (W4.3) | Gerät: WkrMehr.vue (Rückfrage) → WkrMaske `nichtVorbei` → geraete/erfassen.ts `schicke({nv})` (GeraeteZeile.n, ohne Zellen; uebung.ts ebenso); Prüfung wkr/zeile.ts (`nv-nicht-erlaubt` wo X gilt); Stand AppState.wkr.nichtVorbei (types/wkr.ts, wkr/nichtVorbei.ts Schlüssel/Aufheben, state/reducer/wkr.ts + reducer.ts Nachbearbeitung, normalisiereWkr); Matrix wkr/lage.ts Zelle `nv` → WkrMatrix ⊘; LISTEN_SICHT_FASSUNG 5; Auslegungen P16, R1–R8 |
| WKR-Geräte am Host (W1): Gruppen je Liste, stille Quittung, Annahme, Herkunft ◆, Hinweise | geraete/host.ts nimmWkrAn/verteileListen, geraete/wkrEingang.ts (Ablage `alcatraz.geraete.wkr`/`.herkunft`), aufgaben.ts erlaubteWkr, wkrGruppen.ts, wkr/sicht.ts; Protokoll 2 transport/protokoll.ts |
| WKR-Gerät (W1, ohne Maske): Ausgang, Bündeln, Stufen, Korrektur, Pause, Abschluss, Lebenszeichen | geraete/erfassen.ts oeffneErfassung (auf gekoppelt.ts `kanal`), Ablage `alcatraz.geraet.wkr` (ablage.ts geraetWkrAblage); Ende zu Ende geraete/wkr.test.ts; Masken: components/wkr/ (W3/W4) |
| WKR-Erfassung: Lage (Matrix, Ampel, Rückstand, „Papier ansehen“) | wkr/lage.ts (erfassungsLage, zeilenMarken, rueckstandZeile), Zahlen/Auslegungen wkr/annahmen.ts WKR_ANNAHMEN (W2 A1–A13); „Papier ab“ WKR_PAPIER_AB (state/reducer/wkr.ts, WkrPause.ab); R und warnen/nachfragen AppState.anzeige.wkrRueckstand/wkrWarnung (SettingsView `#betrieb`, listopt.betrieb.wkr*); Plan docs/plan-wkr-w2.md |
| WKR-Erfassung am Bedienrechner: Matrix, Bedienung je Liste, Rückfragen (W2.2) | components/betrieb/WkrMatrix.vue, WkrListeBedienung.vue, WkrEingang.vue (Betrieb → `wkr`); Lage wkr/lage.ts; host.ts `herkunft`/`eingang`, register.ts geraetAngaben; i18n betrieb.wkr.* (betrieb.ts); Auslegungen WKR_ANNAHMEN |
| WKR-Erfassung in der Start-Freigabe (Geräteleiste, Rückstand, „Trotzdem freigeben?“) und auf dem Freigabe-Handy (W2.4) | wkr/freigabe.ts sichtFreigabe/liesFreigabe (Positivliste, FREIGABE_SICHT_FASSUNG); components/betrieb/StartFreigabe.vue Prop `erfassung` (BetriebView aus erfassungsLage, GeraetFreigabe aus gekoppelt.ts `freigabe`); Gruppe geraete/wkrGruppen.ts gruppeDerFreigabe, host.ts verteileFreigabe/ergaenzeGruppen; i18n betrieb.freigabe.*; nie über ko/kz (F17) |
| WKR-Erfassung in der Erfassung (◆, „Papier ansehen“, Nachfrage beim Überschreiben) | components/erfassung/ErfassungTabelle.vue (listeVonBogen, zeilenMarken, herkunftGilt aus useGeraeteHost().herkunft); Regeln wkr/lage.ts, Auslegungen wkr/annahmen.ts (A5, A7, C1–C4); i18n capture.wkr.* (de/+en/erfassung.ts); styles/erfassung.css |
| WKR-Maske auf dem Handy (W3.3) | components/wkr/ (WkrGeraet → WkrMaske → Kopf, Karte, Knöpfe, Fuß …), Logik wkr/maske.ts, Kern geraete/erfassen.ts ErfassungsQuelle; Einbau components/betrieb/GeraetFreigabe.vue; styles/wkr-geraet.css (--wkr-*, data-ziel); i18n wkr.geraet.* (de/+en/wkrGeraet.ts, Sprache der Liste); Auslegungen WKR_ANNAHMEN G*, K*, N* (Feldtest 21.11.2026: Overlay WkrUebertragen, Klassen nur in wkr-geraet.css); breite Bildschirme bis W5: Spalte 560 px `@media (min-width: 700px)` in wkr-geraet.css + geraet.css (T10) |
| … Liste abschließen, Ansicht/Sprache, Probe (W3.4) | components/wkr/WkrAbschluss.vue (pruefung, schliesseAb, abschluesse; Band G16 in WkrMaske bandPunkt), WkrMehr.vue (Ansicht, Sprache, Probe), WkrGeraet.vue (schreibeAnsicht, Probe über ablage.ts probeErledigt/merkeProbe, `raum` aus GeraetFreigabe), WkrProbe.vue (wkr/maske.ts probeMaske, nichts gesendet); Auslegungen WKR_ANNAHMEN L1–L9 |
| … Übung ohne Verbindung (W3.4) | `#/uebung`: lib/adressen.ts VOLLBILDER `uebung`/UEBUNG_ADRESSE → main.ts wurzel → GeraetApp → components/wkr/WkrUebung.vue (Regelwerk × Liste) → WkrGeraet mit geraete/uebung.ts oeffneUebung (Übungstakt: nächster Start 2–6 s nach dem Abschicken, hin und wieder vorher – UEBUNG_FOLGE_MS/UEBUNG_FRUEH_JEDER, Y1–Y3; 30 s nur Rückfall); Verweis in GeraetFreigabe; Test src/main.uebung.test.ts (kein Store, kein Netz), geraete/uebung.test.ts „Übungstakt“ |
| WKR-Erfassung: Schlange, Steg-Zeitversatz (Ablegen vorab, Anlegen nachlaufend), Rückstand | wkr/schlange.ts (vorabStarts, imBoot), wkr/lage.ts, wkr/sicht.ts; Auslegungen nur wkr/annahmen.ts WKR_ANNAHMEN (Karte wkr/CLAUDE.md) |
| … Abmelden am Gerät (= Liste entfernen) | geraete/host.ts nimmWkrAn, geraete/erfassen.ts `abgemeldet`, components/wkr/WkrRuhe.vue `abmeldung` |
| WKR-Gerät: Ansicht „Wie Gerät“, Pad nebeneinander, Parcours-Zeichnung | components/wkr/systemModus.ts, WkrGeraet.vue, WkrParcoursBild.vue (Sicht `bild`, wkr/sicht.ts maskenJeKlasse); geraete/ablage.ts liesAnsicht; WKR_ANNAHMEN GF1, GF8, GF9 |
| … Codes nur in manchen Klassen (ausgegraut) | Regelwerk-YAML `abKlasse`/`klassen` je Code → config/validate.ts, catalog.ts codeKlassenOf → Sicht `katalog[].aus` → WkrKnoepfe.vue |
| … Geräteart, Listen je Gerät, „So lassen“ | protokoll.ts `hallo.typ`, register.ts setzeTyp, aufgaben.ts LISTEN_JE_GERAET/LISTEN_EMPFEHLUNG, GeraeteListe.vue; WKR_SO_LASSEN (aufgaben.ts, reducer/wkr.ts, WkrEingang.vue) |
| … WKR-Name auf dem Gerät (aus der Einteilung, „Mehr → Name“, Hinweis am Bedienrechner) | wkr/sicht.ts `wkrName`/einteilungsName (nur eigene Liste); geraete/erfassen.ts wkrName/setzeWkrName, Lebenszeichen `namen` (protokoll.ts), register.ts `wkrNamen`; components/wkr/WkrMehr.vue, WkrAbschluss.vue; components/betrieb/GeraeteListe.vue, WkrListeBedienung.vue; WKR_ANNAHMEN WN1–WN3 |
| … Server (Einstellung) | AppState.geraeteServer (SET_GERAETE_SERVER, lib/serverAdresse.ts), SettingsView `#geraete`; i18n listopt.geraete.* |

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
- Betrieb (16.11.2026): „Anzeigetafel“ (Code `anzeige`; „Tafel“ ist das Aushangbrett), „Start-Freigabe“. Tafel und
  Start-Freigabe lesen NUR die öffentliche Sicht (betrieb/sicht.ts) – nie Geburtsdatum, Gewicht, Geschlecht, Werte.
  Das Tafel-Fenster schreibt nie (state/leseStore.ts). Der Betrieb schreibt nie in `eingaben`.
- Gerätebetrieb (ab E5): Raum, Schlüssel und Register nur gerätelokal (geraete/ablage.ts), nie im AppState, also nie
  in Sicherung, Vorlage oder Verlauf; nichts aus geraete/ im Reducer. Auf die Leitung nur Sichten, nie der AppState;
  Fehler als Codes. Den Server bekommt der Transport immer von außen (Vorgabe nur themen.ts NTFY_VORGABE).
  Ohne bewusst geöffneten Raum keine Verbindung (kein WebSocket, kein fetch) – neue Wege ins Netz nur hinter diesem
  Schalter, Test src/main.geraete.test.ts. Geräte (`#/sehen`) haben keinen Store und zeigen dieselben Komponenten.
- Druck: Seitenzahlen zählt jede Liste selbst, nie der Browser; Rand oben/unten höchstens 8 mm (sonst druckt
  Chromium Kopf- und Fußzeilen); Listenfarben nur über --blatt-* (styles/blatt.css).
- „X“ = nicht gestartet (lib/abmeldung.ts) muss in jedem Regelwerk stehen; „O“ wird nie vergeben.
- Annahmen nur an einer Stelle: PARALLEL_ANNAHMEN, EINZEL_FESTLEGUNGEN. Belege und Entscheidungen mit Datum als
  Kommentar (YAML bzw. Code) mitpflegen.
- Datenschutz: Das Repo ist öffentlich. Keine echten Namen, Geburtsdaten oder Einzelergebnisse in Code, Tests,
  Fixtures, Doku, Bildern (Ausnahme: einzelne Vornamen in der Doku, 16.11.2026); keine Pfade zu privaten Dateien
  außerhalb des Repos. Tests mit erfundenen Daten (data/names.ts, data/clubs.ts, Muster `Vor1`/`Nach1`/'Musterclub'),
  Hilfen in src/testHilfen.ts.
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
