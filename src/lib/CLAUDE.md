# src/lib – Logik der Wertung und Listen

Fast alles rein (kein DOM, kein Store), Stand und Konfiguration als Parameter. Mit Vue: konfig, event, listensprache,
pokalBlaetter, merken, scan, theme, router, bogenZoom, doppelseitig, offline, update; DOM auch clipboard, scanner.

## Dateien (gruppiert)

- Eingaben: `eingaben.ts` (Lauf-/Starter-/Feldschlüssel, setzeWerte, starterfeldFest), `erfassung.ts`
  (Fortschritt, Plausibilität, zeilenSchluessel), `codes.ts`, `disq.ts`, `time.ts`, `scoring.ts` (Zeilenpunkte),
  `abmeldung.ts` (X = NICHT_GESTARTET), `eingabenVerlust.ts`, `gridnav.ts`.
- Manövrieren: `ergebnis.ts` (klassenErgebnis, Streichläufe, stichSchluessel, Plätze), `ergebnisBlaetter.ts`,
  `ergebnisText.ts` (SPALTEN → results.col.*), `listenStand.ts` (Zeitpunkt je Liste, WERTUNG), `disziplinen.ts`.
- Parallelslalom: `parallelErgebnis.ts` (Runde, Qualifikation, Re-run, PARALLEL_ANNAHMEN), `parallelStage.ts`
  (klassenStand, schreibeRundeFest, stageErgebnis), `parallelSchluessel.ts`, `parallelBogen.ts` (Listen je Racecourse;
  rundenZettel: Zettel A und B, Schritte nur auf A), `parallelStartliste.ts` (Blatt: components/ParallelStartlisten).
- Einzel/Mannschaft: `einzelwertung.ts` (EINZEL_FESTLEGUNGEN), `pokal.ts`, `pokalBlaetter.ts`, `teamListe.ts`.
- Bögen und Listen: `wkrListen.ts` (wkrBoegenZumStand), `bogen.ts` (Modell, bogenSeiten), `listen.ts`
  (veranstaltungsListen), `laufzettel.ts`, `laufzettelText.ts` (SCHRITTE), `starterlisten.ts`, `druckdatei.ts`,
  `namen.ts`, `origin.ts` (Herkunft, Kürzel, Flagge), `ausgleich.ts`, `besetzung.ts`, `einteilung.ts`, `qr.ts`.
- Seiten: `paging.ts` (WKR-Bögen; gruppenSeiten/gruppenKapazitaet gleichen aus, Blöcke unteilbar), `seiten.ts`
  (listenSeiten füllt auf, gleicht nicht aus), `doppelseitig.ts`. Sprache: `konfig.ts`, `listensprache.ts`, `event.ts`.
- Betrieb: `offline.ts`, `update.ts`, `verlauf.ts` (ARTEN, beschreibe), `merken.ts`, `scan.ts`, `scanner.ts`,
  `router.ts`, `adressen.ts`, `theme.ts`, `build.ts`, `clipboard.ts`, `bogenZoom.ts`, `beispielwerte.ts` (saat → Werte).
- Parcours, Assistent: parcoursQuelle, parcoursVertrag (auch Node), parcoursbild, parcoursNachweis, assistent(Texte).

## Abläufe

- Wertungsliste: state.eingaben → ergebnis.ts klassenErgebnis (laufListe, gesamtListe, platziert) →
  ergebnisBlaetter → components/ErgebnisStapel.vue → ergebnis/ErgebnisLaufBlatt|GesamtBlatt.vue.
- WKR-Bögen: wkrListen.ts wkrBoegenZumStand (planung/plan.ts planEvent, listen.ts, bogen.ts defFuerKlasse,
  qr.ts) → components/bogen/BogenBlatt.vue → bogen.ts bogenSeiten (paging.ts).
- Laufzettel: wkrBoegenZumStand → laufzettel.ts messBoegen/buildLaufzettel/zettelSchritte → laufzettelText.ts.
- Parallel: PARALLEL_RUNDE_FESTSCHREIBEN → parallelStage.schreibeRundeFest → parallelBoegen → Werte unter
  `parallel:<runde>/<attempt>` → parallelErgebnis.rundenErgebnis (mitWiederholungen) → klassenStand → stageErgebnis.
- Einzel/Mannschaft: pokalBlaetter.usePokalWertung → pokal.ts pokalKlassen (+ disziplinen) → einzelwertungen → Wertung.

## Wo ändere ich …

- Stichkriterium: config/schema.ts STICH_KRITERIEN + ergebnis.ts stichSchluessel + i18n results.tie.<k>.
- Streichläufe: ergebnis.ts streichZahl/streichlaeufeVon/laeufeLautRegelwerk; Action SET_STREICHLAEUFE.
- Parallel-Annahmen: nur PARALLEL_ANNAHMEN; Rundenfolge parallelStage.ts klassenStand; Paarung planung/.
- Re-run: parallelErgebnis.ts qualifikation (`rerun`), mitWiederholungen → mitWiederholung (Disq darin). Dieselbe
  Annahme nutzen rundenVermerke und die Doku von parallelStage.ts stageErgebnis; Namen: planung/parallelRunden.ts.
- Einzelwertung: EINZEL_FESTLEGUNGEN; „nicht werten“: disziplinen.ts + AppState.nichtWerten.
- Mannschaftswertung: pokal.ts plaetzeWertung/uimWertung/platzPunkte/klasseFertig; Regeln config/pokal.ts.
- Druckdatei: druckdatei.ts DRUCKDATEI_TEILE, SPAETERE_TEILE, istDruckdateiWahl, druckdateiFolge.
- Beispielwerte: beispielwerte.ts (DM_2026, WM_MANOEVRIEREN, WM_PARALLEL; nur gerundete Kennzahlen).

## Fallen

- Reducer ruft Teile von lib (eingaben, listenStand, abmeldung, parallelStage, beispielwerte): dort kein
  Date.now()/Math.random(). Zeit = action.zeit, Zufall = zufallAus(saat).
- Eingaben: `eingaben[laufSchluessel][starterId][feld]` – Zeile ist die Starter-ID, nicht die Startnummer.
  Disq/Bemerkung/erfasst gehören zur Liste (`disq@steg`, `erfasst@<typeId>`); Knoten unter Lauf 0 (OHNE_LAUF).
  Parallel: `parallel:<runde>/<attempt>`, der Racecourse folgt aus dem festgeschriebenen Plan.
- Disziplin-Kennungen: Konfig/Schlüssel `manoevrieren`/`parallel`, aber WertungsDisziplin/nichtWerten `manoever`.
- listenStand.ts: neues wertungsrelevantes Feld in WERTUNG; laufInhalt/gesamtInhalt NICHT um Anzeigefelder
  erweitern (sonst ändern sich alle Prüfsummen und Sicherungen verlieren ihre Zeitpunkte).
- Welche WKR-Listen es gibt, sagt immer listen.ts veranstaltungsListen (Parallel: parallelBogen.ts parallelListen).
- X macht keinen Lauf zum gefahrenen; ein X allein beim Abgemeldeten zählt nicht als gefahrene Disziplin.
- Wertungslisten nennen Bojen immer R/L (ergebnis.ts BOJEN_SEITE). QR: ALC1 muss lesbar bleiben, Runden = ALC2.
- merken.ts mit ueberNeuladen: neue Werte brauchen einen Guard für alte gemerkte Auswahl (SPAETERE_TEILE).
- Listen-Texte über ergebnisTexte(sprache)/useListenSprache. Rundennamen doppelt: rundenName und bogenTexte().runde.
- Offline: Cache-Namen, Merk-Cache und Nachrichten von scripts/offline-sw.js teilen alte und neue Fassung –
  ihre Bedeutung nie ändern. Fassung wechselt nur per „Update“ oder bei leerem Stand.

## Tests

`npx vitest run src/lib/parallel src/lib/einzelwertung`, nach Name `-t "Stich"`; Mustertest Einstellung: teamListe.
Ohne eigene Testdatei (u. a.): disziplinen, parallelSchluessel, parallelStartliste, ergebnisText, laufzettelText, namen.
