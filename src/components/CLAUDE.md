# src/components – Blätter, Panels, Druck

Bildschirmansicht = Druckansicht; jede Liste teilt sich selbst in Seiten und zählt sie selbst (Wurzelkarte, Druck).
Logik in src/lib (CLAUDE.md dort), Zustand nur per dispatch (Actions: src/state/reducer/<bereich>.ts).

## Dateien (alle .vue, gruppiert)

- Rahmen: ListenDokument (misst, listenSeiten, Seitenzahl, data-druckseite), LeereRueckseite, HerkunftText, QrCode,
  KopfLogos (Logos links/rechts im Kopf; ohne Logo nur der Slot), AufbauBalken (21.11.2026: Ladebalken mit echtem Stand
  `data-teil="aufbau"`, Zeile `aufbau-zeile` als „Abspann“, erst nach AUFBAU.anzeigeAbMs; Satz `aufbau-druck` nur auf Papier).
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
  Vorsteg, `frage` art `x`; W2.3 (21.11.2026, nur mit Host): Liste des Bogens über wkr/liste.ts listeVonBogen, Marken
  über wkr/lage.ts zeilenMarken (einmal je Bogen), ◆ über herkunftGilt (`data-raute`, Titel Liste · Gerät · Uhrzeit,
  X vom Gerät `.erf-zelle--x-geraet`), „Papier ansehen“ ▭ an der Nummer bzw. Zelle `.erf-zelle--papier`, Rückfrage „!“
  mit Verweis `#/betrieb/wkr/<bereich>`, Kopfzeile `data-teil="wkr-erfassung"`; v-memo mit `wkrVon(z).memo`; `frage`
  art `geraet` vor der ersten Änderung eines Gerätewerts, gilt bis focusout der Zelle und nur für diesen Gerätewert (Zeit
  des Herkunftseintrags); Zeitfelder: „Ersetzen“ schreibt nichts, nur Freigabe + Fokus zurück; Stile styles/erfassung.css),
  ZeitZelle, ScanHinweis.
- Starter/Verzahnung: ClassSection (Sortierköpfe + Zufall, `sortierung` von oben; „In Klasse X verschieben“, emit
  `oeffne`), ManualAddForm, ExcelPanel, DatumFeld (DatumFeld.test.ts durchsucht alle Vorlagen), StartNumberPanel (auch
  E/D), StarterSperre, ParcoursCard, TrackContainer, ClassChip, PauseChip, SlotCell, FlowPreview, SequenceTable,
  BoatPanel, HeatTable, ParallelRunden (je Klasse ein Knopf je `schritte`-Eintrag – nach dem Halbfinale Kleines Finale
  und Finale getrennt, 21.11.2026; „Alle Klassen weiter“ ab zwei verschiedenen KLASSEN, nicht Schritten).
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
  E4 Parallelslalom (nur UIM): AnzeigeBereich zweigt bei `aktuell.paar` ab (Racecourse A/B, `.anzeige-bahn`,
  leere Seite `.leer` mit „–“; Lage nach `sicht.einst.parallelAnordnung` als Folge im DOM, `.anzeige-paar` mit
  `data-lage` und Klasse `untereinander` (Raster, waagerechte Linie) bzw. dazu `flach` (AnzeigeTafel `paarFlach`: je
  Seite Nummer neben den Angaben, Spalten per subgrid geteilt); „davor“ in der Folge der Seiten); StartFreigabe zeigt
  Paare je Seite, immer A vor B (`.betrieb-seite`, `data-racecourse`) und statt KlassenAussetzen den Hinweis `data-hinweis="parallel"`; BetriebsFolge/StartListe ohne „Verschieben …“ und Ziehen,
  StartListe Spalte „Versuch“, ohne Zahl; ZuschauerListe Paar-Karten (`.zuschauer-seite`). texte.ts: startZeile mit
  `seiten`/`nummern`/`ids`, tBereich/tnBereich (`….runde`-Texte im Parallelslalom), punktText über rundenName.
  E6 Gerätebetrieb (Bedienrechner, darf den Store lesen): `betrieb/` GeraeteRaum (Betrieb → Geräte: einschalten,
  Verbindung, Fingerabdruck, zwei LeseLink, erneuern/beenden mit AppDialog; Logik geraete/host.ts useGeraeteHost),
  LeseLink (QR über QrCode.vue mit der ganzen URL, Link zum Markieren, Kopieren mit Rückmeldung, Öffnen; Slot für
  „erneuern“; E7 auch art `koppeln`), GeraeteLage (Punkt + Wort je VerbindungsLage; auch in GeraetApp); texte.ts
  fingerabdruckText, uhrzeitText (E7, nie mm/dd). E7: GeraeteKoppeln (Bereiche, QR-Code, Geräte-Code, Koppel-Link),
  GeraeteListe (Name, Bereiche, entziehen) – beide in GeraeteRaum; GeraetFreigabe (auf dem Gerät, OHNE Store: koppeln,
  StartFreigabe `nur-dieser` je eigenem Bereich in `<fieldset disabled>` bis zur Quittung, entzogen, entkoppeln;
  styles/geraet.css).
  W2.2 (21.11.2026, digitale WKR-Erfassung, Bedienrechner – liest Store und Host): WkrMatrix (Bereichswahl, Spalten =
  wkr/lage.ts erfassungsLage, letzte 12/alle, Gerät mit Ampel → emit `geraete`, Zellzeichen + Legende, Stand, Karte
  einer Zelle mit Werten und ◆, `useUhr(5000)`; merke `betrieb.wkr.bereich|alle|bedienung`), WkrListeBedienung (Modus
  als drei Knöpfe, Pausieren/Abmelden/Weiter je Liste und Steg-Teil, „Papier ab“ = Auswahl + Knopf → WKR_PAPIER_AB +
  host.hinweis('papier'), „Bitte Nr. prüfen“, Abschlüsse mit „Abschluss lösen“ hinter AppDialog), WkrEingang
  (Rückfragen je Gerätezeile, je Zelle und „Alle:“, Grund als Satz, X vom Gerät `.wkr-x`; Vorschläge; Gerätename nur
  aus dem Register, sonst „entkoppeltes Gerät“; nach „Gerät übernehmen“/„Übernehmen“ host.merkeEntscheid für ◆). Stile `.wkr-*` in
  styles/app.css – Matrix eigene Klassen `.wkr-mtabelle`/`.wkr-mzelle`/`.wkr-warnt-text`, weil WkrEinteilung `.wkr-tabelle`/`.wkr-zelle`
  nutzt (Prüfbefund 21.11.2026). „Papier ab“/„Weiter“ geben am Steg den Teil an host.hinweis, im Parallelslalom die
  Nummer der eigenen Seite.
  W2.4 (21.11.2026): StartFreigabe Prop `erfassung?: FreigabeErfassung` (wkr/freigabe.ts, reine Daten, kein Store) und
  `erfassungOeffnen?` (nur Bedienrechner: Klick auf die Leiste bzw. Knopf `zur-erfassung` → Unterreiter `wkr`; kein `:type`/`<component>`-Knopf, DatumFeld.test.ts): Geräteleiste `data-teil="wkr-leiste"`
  je Liste (`data-liste`, `data-stand`, `data-ampel`, `data-rot` bei ✕/„!“, `data-neu` 4 s hervorgehoben, ohne Animation – blatt.test.ts liest app.css ohne @keyframes),
  Rückstandszeile `wkr-rueckstand` und `.betrieb-naechster--rueckstand` (gelber Rand, Token `--rueckstand`) um „Als Nächstes“; bei
  `warnung === 'nachfragen'` und warnender Liste geht JEDES BETRIEB_ZEIGEN (Nächster Start, BetriebsFolge über
  `sendeGeprueft`, Einreihen-Listen) erst nach AppDialog `trotzdem-freigeben` hinaus – nie gesperrt (F4, A8, D5).
  GeraetFreigabe reicht `geraet.freigabe[b.id]` durch (Freigabe-Gruppe), i18n betrieb.freigabe.*.
  W3.2 (21.11.2026, Liste zuweisen): `betrieb/wkrListenWahl.ts` useListenWahl (gruppen nach Parcours bzw.
  „Parallelslalom · Racecourse A“, Titel in Oberflächensprache, `teilbar`, `ohneMaske`; listeText „Steg (Parcours 1,
  nur Ablegen)“) und istHandyName (G3/J2). GeraeteKoppeln: `<select data-feld="koppeln-liste">` (Wahl, kein Befehl) +
  Teil-Knöpfe `data-wahl-teil` ganz|ab|an, Hinweis `ohne-maske`; Code/QR auch nur mit Liste. GeraeteListe: je Gerät
  `data-teil="geraet-listen"` (Teil-Knöpfe, `liste-entfernen`, `liste-dazu` = Auswahl + Knopf, Hinweise `listen-voll`,
  `handy-eine`, `pad-zwei`, „Maske: Knöpfe“/„Maske folgt – Papier“). WkrMatrix: `a[data-action="wkr-koppeln"]` an
  Listen ohne Gerät → `#/betrieb/geraete/<liste>`.
- WKR-Maske auf dem Handy `wkr/` (W3.3, 21.11.2026, Plan docs/plan-wkr-w3.md §5; OHNE Store, liest nur
  geraete/erfassen.ts ErfassungsQuelle – echte Erfassung oder Übung): WkrGeraet (Wurzel: Ansicht aus ablage.ts
  liesAnsicht → `data-modus` sonne|hell|dunkel, `data-hand`; Sprache der LISTE über texte.ts stelleWkrText/useWkrText
  (tIn, nie t()); Reiter je Liste, `nurListe`; entzogen → WkrRuhe mit Entwürfen), WkrMaske (je Liste: Steg-Teil,
  Schlange/gewählter Start, Entwurf je Tipp → merkeEntwurf, Takt wkr/maske.ts wechselTakt mit Blitz + vibrate, `inert`
  auf `.wkr-mitte`/`.wkr-unten` UND Prüfung in jedem Tipp, Korrektur mit AppDialog alt → neu, Rückgängig, Suche,
  verwaiste Entwürfe, Ruhe-Zustände), WkrKopf, WkrStarterKarte (nie ein Name), WkrAusweichen (Ziffernfeld mit „E“),
  WkrKnoepfe, WkrStegReiter, WkrVorsteg, WkrDisq (zweiter Tipp setzt, X mit AppDialog), WkrFuss (Hauptknopf-Text,
  Linkshand `wkr-fuss--links`), WkrZuletzt (Leiste, Liste, Rückfrage-/Ablehnungs-Band, Rückgängig), WkrMehr
  (Bemerkung, Pausieren/Abmelden/Weiter), WkrRuhe (warte, leer, pausiert, abgemeldet, papier, abgeschlossen,
  entfaellt, spaeter, entzogen); texte.ts (stufeZeichen, zellenText). Stile styles/wkr-geraet.css (Tokens --wkr-*,
  Sonne Vorgabe, `data-ziel` gross ≥ 64 px / klein ≥ 48 px – JEDER `<button>` hier trägt `class="wkr-knopf…"` und
  `data-ziel`, styles/wkr-geraet.test.ts prüft das). Einbau: betrieb/GeraetFreigabe.vue (oeffneErfassung einmal je
  Gerät, Reiter `geraet-reiter` Freigabe/Liste). W3.4 (21.11.2026): WkrAbschluss („Liste abschließen“: Summe, Zeilen aus
  `pruefung` mit Tipp → Korrektur `pruef-korrigieren`, Name `wkr-name` Pflicht, `rest-papier` Pflicht bei offenen
  Starts, Ergebnis `abschluss-ergebnis` unterwegs|angenommen|abgelehnt; ersetzt in WkrMaske die Mitte; Band
  `abschluss-band` G16), WkrMehr (zusätzlich `abschliessen`, Ansicht `modus`/`linkshand`, Sprache `sprache` de|en mit
  Satz `nur-bedientexte` ohne `andere`, `probe`, `uebung-ende`; auch in Ruhe-Zuständen außer „warte“), WkrProbe (Start
  „P“, Schritte code → zurueck → haupt bzw. Vorsteg x → haupt, Takt mit Sperre, OHNE Quelle – sendet nie; WkrDisq/
  WkrVorsteg melden dafür `xNein`), WkrUebung (Wahl Regelwerk × Liste in Oberflächensprache t(), dann WkrGeraet mit
  oeffneUebung; in GeraetApp für `#/uebung`). WkrGeraet: Ansicht über schreibeAnsicht, Probe je Raum+Liste (`raum`),
  Ereignis `uebungEnde`. GeraetFreigabe: Verweis `a[data-action="ueben"]` → `#/uebung`.
  Prüfbefunde W3 (21.11.2026): Korrektur aus `quelle.stand(z)` (nie aus `zellen` der Zeile), WkrDisq/WkrVorsteg mit
  `:key` je Start + `gesperrt`, gedaechtnis.ts („So lassen“/„behalten“ je Quelle und Liste), Ausweichen-Tasten aus den
  Buchstaben der Startnummern, `.wkr-unten` sticky (`.wkr-mit-reiter`), „Rückgängig“ in der Leisten-Zeile,
  „Keine Bestätigung“ `.wkr-kopf-ueber`; auch `<a>` braucht `.wkr-knopf` + `data-ziel`.
- Panels: BeispieldatenPanel (Starter und saat entstehen hier; Beispiel-Besetzung, -gewichte; confirm vor dem
  Ersetzen), BesetzungPanel, EigeneAufbautenPanel, LogosPanel (Logos der Listen, verkleinert beim Einlesen),
  AufbauAssistent + ZuordnungImBild + BlickErklaerung, VerlaufPanel, OfflinePanel, AppearancePanel, EingabenHinweis,
  HerkunftWahl (Listenform), SettingsNav. Klein: AppDialog, AppLogo, LocaleFlag, LocaleSelect, ThemeToggle, ToTop,
  ParcoursNachweis, FremdeBestandteile (Lizenzvermerke: Flaggen mit MIT-Text, tweetnacl, Parcours; neues Paket in
  `dependencies` → hier nennen, Test FremdeBestandteile.test.ts).

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

- WkrListen/ParallelWkrListen hängen die Bögen schrittweise ein (lib/aufbau.ts useSchrittweise, `aufbau.sichtbar`):
  Bis `fertig` ist der Stapel `no-print` mit `data-aufbau="laeuft"`, `stand.fertig` false sperrt den Druckknopf und
  bindet keine Parallel-Runde (ListsView gedruckteRunden). Balken einhängen mit `!fertig || zeigen` (Mindestdauer
  AUFBAU.mindestensMs, Platz bis zum Erscheinen unsichtbar frei, klebt unter der Kopfleiste über --kopf-hoehe).
  Tests laufen ohne Schritte (src/test-setup.ts); wer den Aufbau prüft: setzeSchrittweise(true) (views/WkrAufbau.test.ts).
  Muster für weitere langsame Listen (Laufzettel ~1 s gemessen): Liste durch useSchrittweise, Balken, `fertig` melden.
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
  Texte per tIn(sicht.sprache), nie t(). StartFreigabe/AnzeigeTafel nie an den Store hängen: Sie laufen ab E6/E7 auf Geräten (auch `erfassung` kommt als Prop).
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
Parallelslalom auf der Tafel (englisch, keine deutschen Wörter): components/anzeige/AnzeigeParallel.test.ts;
Zuschauerliste: src/ZuschauerApp.test.ts. Gerätebetrieb: views/BetriebGeraete.test.ts, src/GeraetApp.test.ts.
WKR-Maske: src/GeraetWkr.test.ts (Host + nachgebauter ntfy; Takt mit Fake-Uhr gegen die Übung; Hilfe `mitCode`
überspringt die Probe, `'lassen'` behält sie), styles/wkr-geraet.test.ts, src/main.uebung.test.ts (Übung ohne Netz).
Im Zusammenhang src/views/*.test.ts; UIM-Kopfzeilen: views/UimAushang.test.ts, Beispieldaten: views/EventView.test.ts.
