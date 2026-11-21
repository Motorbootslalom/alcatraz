# src/lib – Logik der Wertung und Listen

Fast alles rein (kein DOM, kein Store), Stand und Konfiguration als Parameter. Mit Vue: konfig, event, listensprache,
pokalBlaetter, merken, scan, theme, router, bogenZoom, doppelseitig, offline, update, listenLogos, uhr; DOM auch
clipboard, scanner, logoBild.

## Dateien (gruppiert) und Abläufe

- Eingaben: `eingaben.ts` (Schlüssel, setzeWerte, starterfeldFest), `erfassung.ts` (Fortschritt, Plausibilität,
  zeilenSchluessel), `codes.ts`, `disq.ts`, `time.ts`, `scoring.ts` (Zeilenpunkte), `abmeldung.ts` (X: NICHT_GESTARTET),
  `eingabenVerlust.ts`, `gridnav.ts`.
- Manövrieren: `ergebnis.ts` (klassenErgebnis → laufListe, gesamtListe, platziert; Streichläufe, stichSchluessel),
  `ergebnisBlaetter.ts`, `ergebnisText.ts` (SPALTEN → results.col.*, ergebnisTexte(sprache)), `listenStand.ts`
  (Zeitpunkt je Liste, WERTUNG), `disziplinen.ts`. Einzel/Mannschaft: `einzelwertung.ts` (EINZEL_FESTLEGUNGEN),
  `pokal.ts` (pokalKlassen + disziplinen → einzelwertungen), `pokalBlaetter.ts` (usePokalWertung), `teamListe.ts`.
- Parallelslalom: `parallelErgebnis.ts` (Runde, Qualifikation, Re-run, PARALLEL_ANNAHMEN), `parallelStage.ts`
  (klassenStand, schreibeRundeFest, alleWeiter, stageErgebnis), `parallelSchluessel.ts`, `parallelBogen.ts` (Listen je Racecourse,
  rundenZettel A/B, messKennungRunde, musterRundenBoegen), `parallelStartliste.ts` (Blatt: ParallelStartlisten.vue).
  Ablauf: PARALLEL_RUNDE_FESTSCHREIBEN (state/reducer/parallel.ts) → parallelStage.schreibeRundeFest → parallelBoegen
  → Werte unter `parallel:<runde>/<attempt>` → rundenErgebnis (mitWiederholungen) → klassenStand → stageErgebnis.
  Runden (21.11.2026): pre, semi, small (Kleines Finale, Platz 3/4), final (Platz 1/2) + rerun-*; PARALLEL_RUNDEN in
  parallelSchluessel.ts. Nach dem Halbfinale stehen beide Finals in klassenStand `schritte` (unabhängig festzuschreiben,
  `naechste` = erster); stageErgebnis nimmt 1/2 aus `final`, 3/4 aus `small`. Alte Stände: state/migrate.ts teileAlteFinals.
- Bögen und Listen: `wkrListen.ts` (wkrBoegenZumStand: planung/plan.ts planEvent, listen.ts, bogen.ts defFuerKlasse,
  qr.ts), `bogen.ts` (Modell, bogenSeiten), `listen.ts` (veranstaltungsListen), `laufzettel.ts` (messBoegen,
  buildLaufzettel, zettelSchritte), `laufzettelText.ts` (SCHRITTE), `starterlisten.ts`, `druckdatei.ts`, `namen.ts`,
  `origin.ts` (Herkunft, Kürzel, Flagge), `ausgleich.ts`, `besetzung.ts`, `qr.ts`, `einteilung.ts` (WKR-Namen UND
  Sprache je Parcours und Liste: setzeSprache, normalisiereSprachen; einteilungsZellen = gedruckte Zellen).
- Aufbau (21.11.2026, mit Vue): `aufbau.ts` useSchrittweise – lange Listen Stück für Stück einhängen (Ladebalken,
  AUFBAU, setzeSchrittweise; Tests: aus). Teuer war das Zeichnen/Messen, nicht die Berechnung (Kopfkommentar).
- Seiten: `paging.ts` (WKR-Bögen, gleicht aus, Blöcke unteilbar), `seiten.ts` (übrige Listen; `gebunden` = Zeilen einer
  Zelle mit rowspan), `doppelseitig.ts`. Sprache: `konfig.ts`, `listensprache.ts`, `event.ts`.
- Anzeigetafel (16.11.2026): `fit.ts` (fitLine/fitBlock/fitZeilen, v-fit, v-fit-block, v-fit-zeilen; nur mounted/updated,
  kein ResizeObserver; fitBlock misst die natürliche Höhe mit `flex-grow: 0` und passt vor jeder Messung die Zeilen an),
  `anzeigeFenster.ts` (oeffneAnzeige = window.open `#/anzeige[/<bereich>]`, E3 oeffneZuschauer = `#/zuschauer`;
  postMessage-Rückfall, wo `storage` unter file:// nicht trägt), `uhr.ts` (E3: useUhr(takt) = Date.now() im Takt,
  solange die Komponente steht – Wartezeiten nie im Store), `tafelFenster.ts` (E6: useTafelFenster – Taste F/Doppelklick
  Vollbild, Mauszeiger weg nach 2,5 s; AnzeigeApp und GeraetApp), `wachBleiben.ts` (E8: halteWach/useWachBleiben(aktiv) =
  Screen Wake Lock, neu bei visibilitychange, still ohne API; AnzeigeApp, ZuschauerApp, GeraetApp mit Hinweis). Logik des Betriebs: src/betrieb/ (eigene Karte).
- Betrieb: `offline.ts` (E6: holeNeueFassung = gezieltes Selbst-Update eines Geräts, nur aus GeraetApp), `update.ts`, `verlauf.ts` (ARTEN), `merken.ts`, `scan.ts`, `scanner.ts`, `router.ts`,
  `adressen.ts`, `theme.ts`, `build.ts` (E6: PAGES_URL – Ziel der Lese-Links unter file://), `clipboard.ts`, `bogenZoom.ts`, `datum.ts` (liesDatum, excelSeriennummer),
  `serverAdresse.ts` (E6: normalisiereServer, serverEinstellung – Adresse des ntfy-Servers, rein, ohne tweetnacl, für
  Reducer, migrate und Einstellungen; geraete/themen.ts reicht sie weiter).
- Aus der `saat` (Reducer und Oberfläche): `beispielwerte.ts`, `beispieldaten.ts` (Beispiel-Besetzung, -gewichte,
  19.11.2026 -boote, -Co-Piloten; Knöpfe und Rückfrage `beispielBoote.ts`, mit Vue),
  `reihenfolge.ts` (je Klasse nach Spalte, stabil, fehlende hinten; mische; 21.11.2026 Stufen naechsteSortierung ↓ ↑ keine,
  SortierWahl = Stufe + Folge je Klasse, gleicheFolge statt istGeordnet – mit Startnummern-Bereichen sortiert der Reducer je Größengruppe); `saat.ts` neueSaat – nur Oberfläche.
- Parcours, Assistent: parcoursQuelle, parcoursVertrag (auch Node), parcoursbild, parcoursNachweis, assistent(Texte).
- Logos (16.11.2026): `logo.ts` (rein: Grenzen, logoTeile = eine Lesart der data-URL, logoWert, logoHoeheZahl, Maße,
  zielMasse), `logoBild.ts` (nur Browser: verkleinereLogo; testbar svgMasse, svgFuerZiel = viewBox ergänzen),
  `listenLogos.ts` (useListenLogos, logoUrl = Blob-Adressen mit LRU, SVG bleibt data-URL; logoSchluessel).

## Wo ändere ich …

- Stichkriterium: config/schema.ts STICH_KRITERIEN + ergebnis.ts stichSchluessel + i18n results.tie.<k> (wertung.ts).
- Streichläufe: ergebnis.ts streichZahl/streichlaeufeVon/laeufeLautRegelwerk; Action: state/reducer/wertung.ts.
- Parallel-Annahmen: nur PARALLEL_ANNAHMEN; Rundenfolge parallelStage.ts klassenStand; Paarung planung/.
- Re-run (Wurzelkarte): Disq in mitWiederholung; Annahme auch in Doku von stageErgebnis; „*“: stageDurchWiederholung.
- Mannschaftswertung: pokal.ts plaetzeWertung/uimWertung/platzPunkte/klasseFertig; Regeln config/pokal.ts.
- Druckdatei: druckdatei.ts DRUCKDATEI_TEILE, SPAETERE_TEILE, istDruckdateiWahl, druckdateiFolge.
- Beispielwerte: beispielwerte.ts (DM_2026, WM_MANOEVRIEREN, WM_PARALLEL; nur gerundete Kennzahlen). Besetzung,
  Gewichte: beispieldaten.ts (BESETZUNG_PERSONEN, BESETZUNG_HOECHSTENS = eine Zeile im Bogenkopf, ANTEIL_LEICHTER);
  Zellen: einteilung.ts einteilungsZellen (auch „alle auf …“ in WkrEinteilung.vue). Actions: state/reducer/erfassung.ts.

## Fallen

- Was der Reducer ruft (eingaben, listenStand, abmeldung, parallelStage, beispielwerte, beispieldaten, reihenfolge, logo),
  bleibt rein: kein Date.now()/Math.random(). Zeit = action.zeit, Zufall = zufallAus(saat).
- Eingaben: `eingaben[laufSchluessel][starterId][feld]` – Zeile ist die Starter-ID, nicht die Startnummer.
  Disq/Bemerkung/erfasst gehören zur Liste (`disq@steg`, `erfasst@<typeId>`); Knoten unter Lauf 0 (OHNE_LAUF).
  Haken immer über istHaken (auch Teilhaken `erfasst.ab@steg` der WKR-Erfassung, 21.11.2026), nie startsWith('erfasst@').
  Parallel: `parallel:<runde>/<attempt>`, der Racecourse folgt aus dem festgeschriebenen Plan.
- Disziplin-Kennungen: Konfig/Schlüssel `manoevrieren`/`parallel`, aber WertungsDisziplin/nichtWerten `manoever`.
- listenStand.ts: neues wertungsrelevantes Feld in WERTUNG; laufInhalt/gesamtInhalt NICHT um Anzeigefelder
  erweitern (sonst ändern sich alle Prüfsummen und Sicherungen verlieren ihre Zeitpunkte).
- Welche WKR-Listen es gibt, sagt immer listen.ts veranstaltungsListen (Parallel: parallelBogen.ts parallelListen).
- X macht keinen Lauf zum gefahrenen; ein X allein beim Abgemeldeten zählt nicht als gefahrene Disziplin.
- Wertungslisten nennen Bojen immer R/L (ergebnis.ts BOJEN_SEITE: letztes Wort nach Leerzeichen oder „|“ – Start/Ziel
  `start|hin seiteB`, im Parallelslalom `start|seiteB`). QR: ALC1 muss lesbar bleiben, Runden = ALC2.
- Vorsteg mit „Versuche direkt nacheinander“: Die Zeile schreibt in jeden Versuch; löschte das ein verdecktes X eines
  späteren Versuchs, fragt ErfassungTabelle.vue erst (erfassung.ts ueberschreibtX).
- merken.ts mit ueberNeuladen: neue Werte brauchen einen Guard für alte gemerkte Auswahl (SPAETERE_TEILE).
  `dauerhaft` (21.11.2026, nur Team-Filter der Zuschauerliste): localStorage statt sessionStorage; vergissAuswahl/
  vergissAlles räumen beide Speicher (Präfix `alcatraz.merke.`).
- adressen.ts: Fenster mit eigener Wurzel (VOLLBILDER, `#/anzeige`/`#/display`, `#/zuschauer`/`#/spectators`, E6
  `#/sehen/<paket>`, E7 `#/koppeln/<paket>` und `#/geraet` in jeder Sprache gleich – das Paket im zweiten Segment,
  Groß/klein zählt; sehen/koppeln/geraet = EINE Wurzel GeraetApp, main.ts `wurzel`) liest
  liesVollbild VOR jedem Store (main.ts wählt danach AnzeigeApp/ZuschauerApp/GeraetApp); ihre Wörter dürfen nie die einer Ansicht
  sein (adressen.test.ts). Reiter `betrieb` (en `operation`, vorläufig) mit `start`, `startliste` (en `starting-order`),
  E6 `geraete` (en `devices`); Sprungziel `geraete` (en `devices`).
- adressen.ts: drittes Segment `wahl` (Wert aus den Daten, kodiert, nicht übersetzt; `*` = alle) nur unter einem
  Reiter; useReiter gibt es an `beiWahl`. Danach steht nur der Reiter da – außer die Ansicht gibt `wahlFuerAdresse`
  (Herkunft der Gewichtslisten, 16.11.2026); das wird schon beim Aufbau gelesen.
- Offline: Cache-Namen, Merk-Cache und Nachrichten von scripts/offline-sw.js teilen alte und neue Fassung –
  ihre Bedeutung nie ändern. Fassung wechselt nur per „Update“ oder bei leerem Stand.

## Tests

`npx vitest run src/lib/parallel src/lib/einzelwertung`, nach Name `-t "Stich"`; Mustertest Einstellung: teamListe.
Ohne eigene Testdatei (u. a.): disziplinen, parallelSchluessel, parallelStartliste, ergebnisText, laufzettelText, namen.
