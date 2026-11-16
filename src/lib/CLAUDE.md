# src/lib – Logik der Wertung und Listen

Fast alles rein (kein DOM, kein Store), Stand und Konfiguration als Parameter. Mit Vue: konfig, event, listensprache,
pokalBlaetter, merken, scan, theme, router, bogenZoom, doppelseitig, offline, update; DOM auch clipboard, scanner.

## Dateien (gruppiert) und Abläufe

- Eingaben: `eingaben.ts` (Schlüssel, setzeWerte, starterfeldFest), `erfassung.ts` (Fortschritt, Plausibilität,
  zeilenSchluessel), `codes.ts`, `disq.ts`, `time.ts`, `scoring.ts` (Zeilenpunkte), `abmeldung.ts` (X: NICHT_GESTARTET),
  `eingabenVerlust.ts`, `gridnav.ts`.
- Manövrieren: `ergebnis.ts` (klassenErgebnis → laufListe, gesamtListe, platziert; Streichläufe, stichSchluessel),
  `ergebnisBlaetter.ts`, `ergebnisText.ts` (SPALTEN → results.col.*, ergebnisTexte(sprache)), `listenStand.ts`
  (Zeitpunkt je Liste, WERTUNG), `disziplinen.ts`. Einzel/Mannschaft: `einzelwertung.ts` (EINZEL_FESTLEGUNGEN),
  `pokal.ts` (pokalKlassen + disziplinen → einzelwertungen), `pokalBlaetter.ts` (usePokalWertung), `teamListe.ts`.
- Parallelslalom: `parallelErgebnis.ts` (Runde, Qualifikation, Re-run, PARALLEL_ANNAHMEN), `parallelStage.ts`
  (klassenStand, schreibeRundeFest, stageErgebnis), `parallelSchluessel.ts`, `parallelBogen.ts` (Listen je Racecourse,
  rundenZettel A/B, messKennungRunde, musterRundenBoegen), `parallelStartliste.ts` (Blatt: ParallelStartlisten.vue).
  Ablauf: PARALLEL_RUNDE_FESTSCHREIBEN (state/reducer/parallel.ts) → parallelStage.schreibeRundeFest → parallelBoegen
  → Werte unter `parallel:<runde>/<attempt>` → rundenErgebnis (mitWiederholungen) → klassenStand → stageErgebnis.
- Bögen und Listen: `wkrListen.ts` (wkrBoegenZumStand: planung/plan.ts planEvent, listen.ts, bogen.ts defFuerKlasse,
  qr.ts), `bogen.ts` (Modell, bogenSeiten), `listen.ts` (veranstaltungsListen), `laufzettel.ts` (messBoegen,
  buildLaufzettel, zettelSchritte), `laufzettelText.ts` (SCHRITTE), `starterlisten.ts`, `druckdatei.ts`, `namen.ts`,
  `origin.ts` (Herkunft, Kürzel, Flagge), `ausgleich.ts`, `besetzung.ts`, `qr.ts`, `einteilung.ts` (WKR-Namen UND
  Sprache je Parcours und Liste: setzeSprache, normalisiereSprachen; einteilungsZellen = gedruckte Zellen).
- Seiten: `paging.ts` (WKR-Bögen, gleicht aus, Blöcke unteilbar), `seiten.ts` (übrige Listen; `gebunden` = Zeilen einer
  Zelle mit rowspan), `doppelseitig.ts`. Sprache: `konfig.ts`, `listensprache.ts`, `event.ts`.
- Betrieb: `offline.ts`, `update.ts`, `verlauf.ts` (ARTEN), `merken.ts`, `scan.ts`, `scanner.ts`, `router.ts`,
  `adressen.ts`, `theme.ts`, `build.ts`, `clipboard.ts`, `bogenZoom.ts`, `datum.ts` (liesDatum, excelSeriennummer).
- Aus der `saat` (Reducer und Oberfläche): `beispielwerte.ts`, `beispieldaten.ts` (Beispiel-Besetzung, -gewichte),
  `reihenfolge.ts` (je Klasse nach Spalte, stabil, fehlende hinten; mische); `saat.ts` neueSaat – nur Oberfläche.
- Parcours, Assistent: parcoursQuelle, parcoursVertrag (auch Node), parcoursbild, parcoursNachweis, assistent(Texte).

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

- Was der Reducer ruft (eingaben, listenStand, abmeldung, parallelStage, beispielwerte, beispieldaten, reihenfolge),
  bleibt rein: kein Date.now()/Math.random(). Zeit = action.zeit, Zufall = zufallAus(saat).
- Eingaben: `eingaben[laufSchluessel][starterId][feld]` – Zeile ist die Starter-ID, nicht die Startnummer.
  Disq/Bemerkung/erfasst gehören zur Liste (`disq@steg`, `erfasst@<typeId>`); Knoten unter Lauf 0 (OHNE_LAUF).
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
- adressen.ts: drittes Segment `wahl` (Wert aus den Daten, kodiert, nicht übersetzt; `*` = alle) nur unter einem
  Reiter; useReiter gibt es an `beiWahl`. Danach steht nur der Reiter da – außer die Ansicht gibt `wahlFuerAdresse`
  (Herkunft der Gewichtslisten, 16.11.2026); das wird schon beim Aufbau gelesen.
- Offline: Cache-Namen, Merk-Cache und Nachrichten von scripts/offline-sw.js teilen alte und neue Fassung –
  ihre Bedeutung nie ändern. Fassung wechselt nur per „Update“ oder bei leerem Stand.

## Tests

`npx vitest run src/lib/parallel src/lib/einzelwertung`, nach Name `-t "Stich"`; Mustertest Einstellung: teamListe.
Ohne eigene Testdatei (u. a.): disziplinen, parallelSchluessel, parallelStartliste, ergebnisText, laufzettelText, namen.
