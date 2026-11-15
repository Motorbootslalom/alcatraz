# src/components – Blätter, Panels, Druck

Grundsatz: Die Bildschirmansicht ist die Druckansicht. Jede Liste teilt sich selbst in Seiten und schreibt ihre
Seitenzahl selbst aufs Blatt (ListenDokument.vue bzw. bogen/BogenBlatt.vue); der Browser-Seitenrand bleibt leer.
Logik liegt in src/lib (CLAUDE.md dort), Zustand ändert sich nur per dispatch.

## Dateien (gruppiert)

- Rahmen: `ListenDokument.vue` (misst Zeilen, listenSeiten, Seitenzahl, data-druckseite), `LeereRueckseite.vue`,
  `HerkunftText.vue`, `QrCode.vue`.
- WKR-Bögen `bogen/`: `BogenBlatt.vue` (misst erste Seite, bogenSeiten, meldet seiten/kapazitaet), `BogenSeite.vue`,
  `BogenKopf.vue` (schwebender QR), `BogenLegende.vue`, `BogenBild.vue`, `BogenRueckseite.vue` (180° gedreht).
  Reiter: `WkrListen.vue`, `ParallelWkrListen.vue`, `WkrVorschau.vue` (nie gedruckt), `WkrEinteilung.vue`.
- Wertung `ergebnis/`: `ErgebnisLaufBlatt.vue`, `ErgebnisGesamtBlatt.vue` (DM, UIM und Runden-Ergebnis Parallel),
  `ErgebnisFuss.vue`, `ParallelAttemptsBlatt.vue`, `ParallelStageBlatt.vue`, `EinzelwertungBlatt.vue`.
  Reiter + Stapel: `ErgebnisListen`/`ErgebnisStapel`, `ParallelErgebnisListen`/`…Stapel`, `EinzelwertungListen`/
  `…Stapel`, `NichtWertenWahl.vue`, `RegelLaeufeHinweis.vue`.
- Mannschaft `pokal/`: `PokalPlaetzeBlatt.vue` (quer), `PokalUimBlatt.vue` (hoch); `PokalListen.vue`, `PokalStapel.vue`.
- Weitere Listen: `StarterBlaetter.vue` (Starter-, Vorsteg-, Gewichtslisten), `AusgleichListen.vue`, `TeamListen.vue`
  (Pkt. 3.7), `CodesAushang.vue`, `ParallelStartlisten.vue` (über ListenDokument), `DruckdateiListen.vue`.
- Laufzettel: `LaufzettelListen.vue` (Seitenzahlen aus unsichtbaren BogenBlatt-Instanzen), `LaufzettelBlatt.vue`,
  `ParallelLaufzettel.vue` (Zettel A und B; Schritte nur auf A), `ParallelMessung.vue`.
- Erfassung `erfassung/`: `ErfassungTabelle.vue` (dispatch SET_EINGABEN; AppDialog vor dem Löschen eines verdeckten X
  am Vorsteg, `frage`), `ZeitZelle.vue`, `ScanHinweis.vue`.
- Starter/Verzahnung: `ClassSection.vue`, `ManualAddForm.vue`, `ExcelPanel.vue`, `StartNumberPanel.vue` (auch E/D),
  `StarterSperre.vue`, `ParcoursCard.vue`, `TrackContainer.vue`, `ClassChip.vue`, `PauseChip.vue`, `SlotCell.vue`,
  `FlowPreview.vue`, `SequenceTable.vue`, `BoatPanel.vue`, `HeatTable.vue`, `ParallelRunden.vue`.
- Panels: `BeispieldatenPanel.vue` (Starter + saat entstehen hier; unter UIM Herkunft „Land“), `BesetzungPanel.vue`,
  `EigeneAufbautenPanel.vue`, `AufbauAssistent.vue` + `ZuordnungImBild.vue` + `BlickErklaerung.vue`, `VerlaufPanel.vue`,
  `OfflinePanel.vue`, `AppearancePanel.vue`, `EingabenHinweis.vue`, `HerkunftWahl.vue` (Listenform), `SettingsNav.vue`.
  Klein: AppDialog, AppLogo, LocaleFlag, LocaleSelect, ThemeToggle, ToTop, ParcoursNachweis, FremdeBestandteile.

## Abläufe

- Wertungsliste: ErgebnisListen (klassenErgebnis, ergebnisBlaetter) → ErgebnisStapel (namen, origin, listenStand,
  stichAufListe) → ErgebnisLaufBlatt/GesamtBlatt (texteIn(sprache)) → ListenDokument → ErgebnisFuss.
- WKR-Bogen: WkrListen (wkrBoegenZumStand, useBogenKonfig je Liste) → BogenBlatt (@layout → paging.rowsThatFit →
  bogen.bogenSeiten) → BogenSeite + BogenKopf + BogenLegende + BogenBild → optional BogenRueckseite.
- Druckdatei: DruckdateiListen (lib/druckdatei.ts) nutzt dieselben Stapel wie die Reiter; leere Rückseite über
  useLeereRueckseite nach ungerader Seitenzahl, nur wenn noch ein Dokument folgt.

## Wo ändere ich …

- Spaltenkopf einer Wertungsliste: `<th>` in ergebnis/*.vue, pokal/*.vue; Text i18n results.*, individual.col.*,
  parallel.*; Fahrweg-Spalten über lib/ergebnisText.ts; Breiten styles/ergebnis.css (Tests: nichts abgeschnitten).
- Spaltenfolge: je Blatt dreimal gleich (`<colgroup>`, `<thead>`, `<tbody>`), `erg-gruppe` (kräftige Linie) wandert
  mit. DM und UIM teilen das Blatt (Props mitKnoten, punkte, runde, ohneErgebnis): Nur für UIM ändern braucht eine
  Bedingung.
- „Qualified“/Finals als eine schräge Zelle: ErgebnisGesamtBlatt.vue `punkte.bloecke` (rowspan, `schraeg`, `gebunden`).
- Bogen-Texte (Nr., WKR, Seite n / m, Klasse, Lauf, Racecourse, Runde): config/sprache.ts bogenTexte().
- Seitenteilung übriger Listen: lib/seiten.ts (SEITEN_VORGABE, Fußhöhen), ListenDokument.vue messen() (MESS_TOLERANZ_*).
- WKR-Seitenteilung: lib/paging.ts, lib/bogen.ts; Toleranzen in BogenBlatt.vue onLayout.
- Fuß der Wertungslisten: ergebnis/ErgebnisFuss.vue; Höhe lib/seiten.ts ergebnisFussMm ↔ .erg-fuss.

## Fallen

- Auf gedruckten Blättern lt()/texteIn(sprache) aus useListenSprache(), nie t() (sonst Oberflächensprache).
- Feste mm an zwei Stellen gleich halten: SEITENZAHL_MM 5 ↔ app.css .listen-seitenzahl; ERGEBNIS_FUSS_MM 12 ↔
  .erg-fuss; ERGEBNIS_FUSS_UNTERSCHRIFT_MM 22 ↔ .erg-fuss--unterschrift; paging.ts PRINT_MARGIN_MM 8 ↔ @page.
- print.css: Rand oben/unten höchstens 8 mm, seitlich höchstens 12 mm – ab 9 mm druckt Chromium eigene Kopf-/Fußzeilen.
- Zeilenhöhe darf nicht von der Seite abhängen: Flaggen bleiben unter der Zeilenhöhe, QR im Bogenkopf schwebt.
- Farben auf Listen nur über --blatt-* (styles/blatt.css); styles/blatt.test.ts prüft alle CSS-Dateien.
- Gemeinsame Stapel zeichnen im Reiter UND in der Druckdatei – views/Druckdatei.test.ts mitlaufen lassen.
- Laufzettel-Kästchen folgen gemessenen Bogenseiten: Bogenlayout ändern ändert den Laufzettel.
- Results einer Runde: Unter einer zusammengefassten Zelle fehlt der Zeile die td „UIM points“ – in Tests die Spalte
  über `td[data-spalte="uim-punkte"]` (mit rowspan) lesen, nicht über die letzte Zelle jeder Zeile.
- Doppelseitig: nur lib/doppelseitig.ts DOPPELSEITIG_ARTEN; eigene Seiten ohne ListenDokument brauchen
  data-druckseite und useLeereRueckseite selbst.
- Bedienauswahl über lib/merken.ts merke(); nicht mehr vorhandene Wahl gilt als 'alle'/Vorgabe (Muster WkrListen.vue).
- ISSUE_KEYS (own.issue.*) doppelt: EigeneAufbautenPanel und AufbauAssistent. PARALLEL_RUNDE_LOESEN heißt „Löschen“.

## Tests

`npx vitest run src/components src/styles src/lib/seiten src/lib/paging` (Messen per getBoundingClientRect-Spy).
Im Zusammenhang src/views/*.test.ts; UIM-Kopfzeilen: views/UimAushang.test.ts, Beispieldaten: views/EventView.test.ts.
