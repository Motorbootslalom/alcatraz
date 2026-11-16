# src/components – Blätter, Panels, Druck

Bildschirmansicht = Druckansicht; jede Liste teilt sich selbst in Seiten und zählt sie selbst (Wurzelkarte, Druck).
Logik in src/lib (CLAUDE.md dort), Zustand nur per dispatch (Actions: src/state/reducer/<bereich>.ts).

## Dateien (alle .vue, gruppiert)

- Rahmen: ListenDokument (misst, listenSeiten, Seitenzahl, data-druckseite), LeereRueckseite, HerkunftText, QrCode,
  KopfLogos (Logos links/rechts im Kopf; ohne Logo nur der Slot).
- WKR-Bögen `bogen/`: BogenBlatt (misst erste Seite, bogenSeiten, meldet seiten/kapazitaet), BogenSeite, BogenKopf
  (schwebender QR), BogenLegende, BogenBild, BogenRueckseite (180° gedreht). Reiter: WkrListen, ParallelWkrListen,
  WkrVorschau (nie gedruckt; UIM: auch Muster-Runde), WkrEinteilung (Name + Sprache je Parcours/Racecourse × Liste,
  einteilungsZellen; Tabelle volle Breite, damit 2–3 Personen je Feld lesbar sind).
- Wertung: Blätter in `ergebnis/` (eigene Karte: Spalten, Fuß, schräge Zellen, UIM points); Reiter + Stapel:
  ErgebnisListen/…Stapel, ParallelErgebnisListen/…Stapel, EinzelwertungListen/…Stapel, NichtWertenWahl,
  RegelLaeufeHinweis. Mannschaft `pokal/`: PokalPlaetzeBlatt (quer), PokalUimBlatt (hoch); PokalListen, PokalStapel.
- Weitere Listen: StarterBlaetter (Starter-, Vorsteg-, Gewichtslisten), AusgleichListen, TeamListen (Pkt. 3.7),
  CodesAushang, ParallelStartlisten (über ListenDokument), DruckdateiListen. Laufzettel: LaufzettelListen (Seitenzahlen
  aus unsichtbaren BogenBlatt-Instanzen), LaufzettelBlatt, ParallelLaufzettel (Zettel A und B), ParallelMessung.
- Erfassung `erfassung/`: ErfassungTabelle (dispatch SET_EINGABEN; AppDialog vor dem Löschen eines verdeckten X am
  Vorsteg, `frage`), ZeitZelle, ScanHinweis.
- Starter/Verzahnung: ClassSection (Sortierköpfe + Zufall, `sortierung` von oben; „In Klasse X verschieben“, emit
  `oeffne`), ManualAddForm, ExcelPanel, DatumFeld (DatumFeld.test.ts durchsucht alle Vorlagen), StartNumberPanel (auch
  E/D), StarterSperre, ParcoursCard, TrackContainer, ClassChip, PauseChip, SlotCell, FlowPreview, SequenceTable,
  BoatPanel, HeatTable, ParallelRunden.
- Betrieb (16.11.2026, lesen NUR die öffentliche Sicht, betrieb/sicht.ts): `anzeige/` AnzeigeTafel (Kopfzeile mit Logos,
  Bereiche neben-/untereinander nach Seitenverhältnis), AnzeigeBereich (Parcours, Klasse + Lauf, Startnummer, Name,
  Herkunft, davor, Meldung; Kopfzeile immer oben, Rest in `.anzeige-rumpf`; v-fit/v-fit-block, Hinweis v-fit-zeilen aus
  lib/fit.ts; styles/anzeige.css); `betrieb/` StartFreigabe (Lauf beginnen mit AppDialog, Nächster Start mit `vorher`,
  Zurückstellen, Zurück, Anderen Starter wählen, Meldung; Actions über Prop `sende`) mit E2-Teilen: BetriebsFolge (Wahl:
  nächste 12/ganze Folge/Suche, Zeigen, Zurückstellen, Menüknopf „Verschieben …“ mit Zielknöpfen), EinreihenListe
  (zurückgestellt, nachzuholen), KlassenAussetzen (Boot fehlt, Vorziehen, Folge als Plaketten), MeldungWahl (Vorlage
  wählen, „Übernehmen“ → Entwurf),
  EinsteigenAb (Lauf/Klasse → BETRIEB_AB); E3: StartListe (Startliste im Betrieb: ganze Folge nach Lauf, „ca. in“,
  „Zum Vorsteg“, seit m:ss; Ziehen = BETRIEB_VERSCHIEBEN {vor|nach}, Menü wie BetriebsFolge; Prop `jetzt`); texte.ts
  (punktText, startZeile, ganzeFolge, verschiebeZiele – Oberflächensprache; wartezeitText(sek, sprache)).
  `zuschauer/` ZuschauerListe (E3; liest NUR ZuschauerSicht + `jetzt`: Im Boot, Am Steg, Vor Steg, Danach, Boot fehlt;
  Klassenfilter merke `zuschauer.klasse`; Texte tIn(sicht.sprache); styles/zuschauer.css, fürs Handy).
- Panels: BeispieldatenPanel (Starter und saat entstehen hier; Beispiel-Besetzung, -gewichte; confirm vor dem
  Ersetzen), BesetzungPanel, EigeneAufbautenPanel, LogosPanel (Logos der Listen, verkleinert beim Einlesen),
  AufbauAssistent + ZuordnungImBild + BlickErklaerung, VerlaufPanel, OfflinePanel, AppearancePanel, EingabenHinweis,
  HerkunftWahl (Listenform), SettingsNav. Klein: AppDialog, AppLogo, LocaleFlag, LocaleSelect, ThemeToggle, ToTop,
  ParcoursNachweis, FremdeBestandteile.

## Abläufe

- WKR-Bogen: WkrListen (wkrBoegenZumStand, useBogenKonfig(typeId, parcoursId)) → BogenBlatt (@layout →
  paging.rowsThatFit → bogen.bogenSeiten) → BogenSeite + BogenKopf + BogenLegende + BogenBild → opt. BogenRueckseite.
- Druckdatei: DruckdateiListen nutzt dieselben Stapel wie die Reiter; leere Rückseite über useLeereRueckseite nach
  ungerader Seitenzahl, nur wenn noch ein Dokument folgt.

## Wo ändere ich …

- Wertungslisten (Spaltenkopf, Spaltenfolge, „Qualified“/Finals schräg, Fuß): ergebnis/CLAUDE.md; auch für pokal/*.vue.
- Bogen-Texte (Nr., WKR, Seite n / m, Klasse, Lauf, Racecourse, Runde): config/sprache.ts bogenTexte().
- Seitenteilung übriger Listen: lib/seiten.ts (SEITEN_VORGABE, Fußhöhen), ListenDokument messen() (MESS_TOLERANZ_*);
  WKR: lib/paging.ts, lib/bogen.ts, Toleranzen in BogenBlatt onLayout; Fuß: ErgebnisFuss, ergebnisFussMm ↔ .erg-fuss.

## Fallen

- Auf gedruckten Blättern lt()/texteIn(sprache) aus useListenSprache(), nie t() (sonst Oberflächensprache).
- Feste mm an zwei Stellen gleich halten: SEITENZAHL_MM 5 ↔ app.css .listen-seitenzahl; ERGEBNIS_FUSS_MM 12 ↔
  .erg-fuss; ERGEBNIS_FUSS_UNTERSCHRIFT_MM 22 ↔ .erg-fuss--unterschrift; paging.ts PRINT_MARGIN_MM 8 ↔ @page.
- print.css: seitlich höchstens 12 mm (oben/unten 8 mm: Wurzelkarte). Farben nur --blatt-*; blatt.test.ts prüft das.
- Zeilenhöhe darf nicht von der Seite abhängen: Flaggen bleiben unter der Zeilenhöhe, QR im Bogenkopf schwebt.
- Gemeinsame Stapel zeichnen im Reiter UND in der Druckdatei – views/Druckdatei.test.ts mitlaufen lassen.
- Laufzettel-Kästchen folgen gemessenen Bogenseiten: Bogenlayout ändern ändert den Laufzettel.
- Doppelseitig: nur lib/doppelseitig.ts DOPPELSEITIG_ARTEN; eigene Seiten ohne ListenDokument brauchen
  data-druckseite und useLeereRueckseite selbst.
- Bedienauswahl über lib/merken.ts merke(); nicht mehr vorhandene Wahl gilt als 'alle'/Vorgabe (Muster WkrListen.vue).
- Sprache eines Bogens hängt an Parcours UND Liste: bogenKonfig(b.typeId, b.parcoursId), auch beim Messen (Laufzettel,
  ParallelMessung je Racecourse). Auswahlfelder über mehrere Parcours: useAuswahlKonfig (sonst Regelwerkssprache).
- Bogenkopf hat kein Namensfeld mehr: Namen nur in WkrEinteilung (Entscheidung 15.11.2026).
- ClassSection: Kopfspalten (v-for über lib/reihenfolge.ts sortierSpalten) und Zellen darunter in derselben Folge
  halten. `reorder()` setzt `resort` zurück, wenn der Reducer nichts ändert (sonst springt die nächste Eingabe).
- DatumFeld: v-model ist JJJJ-MM-TT. Mit `sofort` (Formular) geht jedes vollständige Datum schon beim Tippen hinaus,
  Unfertiges als ''; ohne (Tabellenzelle) erst beim Bestätigen, danach zeigt das Feld wieder den Stand – weist die
  Ansicht ab (Jahrgang), springt es zurück. Meldungen kommen als `fehler`, die Ansicht zeigt sie. Es folgt der Prop,
  nicht dem Store: ClassSection bekommt `starters` von außen, in Tests nach einem dispatch `setProps`.
- ISSUE_KEYS (own.issue.*) doppelt: EigeneAufbautenPanel, AufbauAssistent. PARALLEL_RUNDE_LOESEN heißt „Löschen“.
- Anzeigetafel: Farben nur --anzeige-* (styles/anzeige.css, nicht vom Farbschema), Schriften als Bruchteil von
  --anzeige-u; kein `<Transition>` (verdecktes Fenster bliebe stehen) – ein neuer Start ist ein neuer Block (`:key`).
  Texte per tIn(sicht.sprache), nie t(). StartFreigabe/AnzeigeTafel nie an den Store hängen: Sie laufen ab E6/E7 auf Geräten.
- Start-Freigabe (E2): alle Teile bekommen `sende` und `gesperrt` (= !bereich.fest) von StartFreigabe; Aufgeklapptes über
  merke(`betrieb.<teil>.<bereich>`) – Tests rufen vergissAlles(). Nur betriebliche Knöpfe; Einstellungen in SettingsView.
  Rückfrage nur vor „Lauf beginnen“ mit offenen Starts. Kennungen in `data-start` enthalten `"`: Selektor mit `'…'`.
  Befehle nie über `change` eines `<select>` (Chromium feuert ihn schon bei ↓ auf dem zugeklappten Feld): Menüknopf mit
  Zielknöpfen oder Auswahl + eigener Knopf. Schließt sich ein Teil per v-if, den Fokus zurücksetzen (StartFreigabe wahlZu).
- Neuer Listenkopf → KopfLogos drumherum (Bogen art=leiste, höchstens 12 mm; Laufzettel art=streifen); Logo-Maße fest in mm aus den
  Pixelmaßen, nie vom Laden; Messungen ohne ResizeObserver (LaufzettelBlatt.fit, DruckdateiListen.messeCodes) brauchen
  logoSchluessel im Watch.

## Tests

`npx vitest run src/components src/styles src/lib/seiten src/lib/paging` (Messen per getBoundingClientRect-Spy).
Anzeigetafel: components/anzeige/AnzeigeTafel.test.ts, src/AnzeigeApp.test.ts (zwei Fenster), views/Betrieb.test.ts;
Zuschauerliste: src/ZuschauerApp.test.ts.
Im Zusammenhang src/views/*.test.ts; UIM-Kopfzeilen: views/UimAushang.test.ts, Beispieldaten: views/EventView.test.ts.
