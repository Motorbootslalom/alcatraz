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
  rundenZettel: Zettel A und B, Schritte nur auf A; Messung je Racecourse und Liste `messKennungRunde`; Muster-Runde der
  Beispielansicht `musterRundenBoegen`), `parallelStartliste.ts` (Blatt: components/ParallelStartlisten).
- Einzel/Mannschaft: `einzelwertung.ts` (EINZEL_FESTLEGUNGEN), `pokal.ts`, `pokalBlaetter.ts`, `teamListe.ts`.
- Bögen und Listen: `wkrListen.ts` (wkrBoegenZumStand), `bogen.ts` (Modell, bogenSeiten), `listen.ts`
  (veranstaltungsListen), `laufzettel.ts`, `laufzettelText.ts` (SCHRITTE), `starterlisten.ts`, `druckdatei.ts`,
  `namen.ts`, `origin.ts` (Herkunft, Kürzel, Flagge), `ausgleich.ts`, `besetzung.ts`, `einteilung.ts` (Namen UND Sprache
  der Bögen je Parcours und Liste: setzeSprache, normalisiereSprachen; einteilungsZellen = gedruckte Zellen), `qr.ts`.
- Seiten: `paging.ts` (WKR-Bögen; gruppenSeiten/gruppenKapazitaet gleichen aus, Blöcke unteilbar), `seiten.ts`
  (listenSeiten füllt auf, gleicht nicht aus; `gebunden` = Zeilen einer Zelle mit rowspan), `doppelseitig.ts`. Sprache: `konfig.ts`, `listensprache.ts`, `event.ts`.
- Betrieb: `offline.ts`, `update.ts`, `verlauf.ts` (ARTEN, beschreibe), `merken.ts`, `scan.ts`, `scanner.ts`,
  `router.ts`, `adressen.ts`, `theme.ts`, `build.ts`, `clipboard.ts`, `bogenZoom.ts`, `beispielwerte.ts` (saat → Werte),
  `reihenfolge.ts` (Starter je Klasse nach Spalte, stabil, fehlende hinten; mische(saat); Reducer und Oberfläche),
  `saat.ts` (neueSaat – nur Oberfläche, Math.random), `datum.ts` (liesDatum: JJJJ-MM-TT, TT.MM.JJJJ, TT/MM/JJJJ –
  Schrägstrich immer Tag zuerst; excelSeriennummer),
  `beispieldaten.ts` (saat → Beispiel-Besetzung der WKR-Einteilung, Beispielgewichte).
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
  „*“ an den Plätzen, die er entschied: durchWiederholung (Results), parallelStage.ts stageDurchWiederholung.
- Einzelwertung: EINZEL_FESTLEGUNGEN; „nicht werten“: disziplinen.ts + AppState.nichtWerten.
- Mannschaftswertung: pokal.ts plaetzeWertung/uimWertung/platzPunkte/klasseFertig; Regeln config/pokal.ts.
- Druckdatei: druckdatei.ts DRUCKDATEI_TEILE, SPAETERE_TEILE, istDruckdateiWahl, druckdateiFolge.
- Beispielwerte: beispielwerte.ts (DM_2026, WM_MANOEVRIEREN, WM_PARALLEL; nur gerundete Kennzahlen).
- Beispiel-Besetzung/-gewichte: beispieldaten.ts (BESETZUNG_PERSONEN, BESETZUNG_HOECHSTENS = eine Zeile im Bogenkopf,
  ANTEIL_LEICHTER); welche Zellen: einteilung.ts einteilungsZellen (auch „alle auf …“ in WkrEinteilung.vue).

## Fallen

- Reducer ruft Teile von lib (eingaben, listenStand, abmeldung, parallelStage, beispielwerte, beispieldaten, reihenfolge): dort kein
  Date.now()/Math.random(). Zeit = action.zeit, Zufall = zufallAus(saat).
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
- Listen-Texte über ergebnisTexte(sprache)/useListenSprache. Rundennamen doppelt: rundenName und bogenTexte().runde.
- adressen.ts: drittes Segment `wahl` (Wert aus den Daten, kodiert, nicht übersetzt; `*` = alle) nur unter einem
  Reiter; useReiter gibt es an `beiWahl` und schreibt danach die Adresse ohne Wahl.
- Offline: Cache-Namen, Merk-Cache und Nachrichten von scripts/offline-sw.js teilen alte und neue Fassung –
  ihre Bedeutung nie ändern. Fassung wechselt nur per „Update“ oder bei leerem Stand.

## Tests

`npx vitest run src/lib/parallel src/lib/einzelwertung`, nach Name `-t "Stich"`; Mustertest Einstellung: teamListe.
Ohne eigene Testdatei (u. a.): disziplinen, parallelSchluessel, parallelStartliste, ergebnisText, laufzettelText, namen.
