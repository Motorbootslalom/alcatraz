# Fachliche Entscheidungen

Erste Anlaufstelle für fachliche Fragen. Bei Widerspruch zum Code nichts still ändern: datierten Code-Kommentar
(„Entscheidung des Nutzers vom …“) und README vergleichen, es gilt die jüngere Entscheidung. Im Zweifel den Nutzer
fragen und danach diese Liste nachziehen. Was entschieden, aber noch nicht gebaut ist, steht unter „Entschieden, noch
nicht umgesetzt“ – dort weicht der Code bewusst noch ab.

Kennzeichen: **N** = Entscheidung des Nutzers, **R** = Festlegung nach Regelbuch (DM-Reglement 2026, UIM Rulebook Regel
960 „Formula Future“), **R/N** = Regelbuch, vom Nutzer ausgelegt oder ergänzt. Spätere Einträge ersetzen frühere;
Ersetztes steht hier nicht mehr. Pfade ab `src/`, wenn nicht anders angegeben. Neue Entscheidungen hier eintragen,
Belege zusätzlich als Kommentar an der Umsetzung.

## Grundsätze

- 2026-11-12 · N · Wo Fehlerpunkte-Prototyp und alte Excel-Mappe abweichen, gilt der Prototyp; Ausnahmen stehen einzeln
  hier.
- 2026-11-14 · N · Begriffe im Zweifel immer aus den Regelbüchern, auch wenn im Gespräch andere Wörter fallen.
- 2026-11-13 · N · Alcatraz ersetzt Excel ganz: keine Excel-Zuordnung, kein WKR-Name nur für einen einzelnen Bogen.
- 2026-11-12 · N · Alle Einstellungen gebündelt im Reiter „Einstellungen“ (Zahnrad), nicht in den Fachansichten; dort
  auch Vorlage und Teilnehmerdaten als Datei. → `views/SettingsView.vue`, `persistenz/backup.ts`
- 2026-11-15 · N · Keine Abwärtskompatibilität nötig, solange die App in Entwicklung ist (alte Stände,
  Update-Übergänge).
- 2026-11-12 · N · Gestaltung „Steg“ (Wasserfarben, weiche Formen) mit der Reiter-Navigation in der Kopfzeile; Logo
  „A mit Welle“. → `styles/app.css` (Block „Gestaltung Steg“), `components/AppLogo.vue`

## Wertung DM (Manövrieren)

- 2026-11-12 · N · Noch nicht gefahren (holt nach) = leere Zeile, ohne Zeit auf Platz 1: Die anderen können durch
  Nachzügler nur aufsteigen, nie abrutschen. Ausnahme vom Prototyp. → `lib/ergebnis.ts`
- 2026-11-13 · N · Gesamtliste während eines Laufs: n noch nicht Gefahrene auf Platz 1, der beste Gefahrene auf n+1. →
  `lib/ergebnis.ts`
- 2026-11-13 · N · Kann oder darf jemand nicht mehr starten: X „Nicht gestartet“ bei Steg oder Vorsteg =
  Disqualifikation. Unterschied zu „holt nach“ (leer, oben) ist entscheidend. Kein „k.W.“. → `lib/abmeldung.ts`
- 2026-11-12 · N · Nur ein Lauf disqualifiziert: Er wird gestrichen. Zu wenige gültige Läufe (z. B. zwei Disq.) → letzte
  Plätze.
- 2026-11-14 · N · Zwischenstand der Gesamtliste: jede Disqualifikation (nicht nur X) steht hinten, bis der Streichlauf
  greift.
- 2026-11-14 · N · Gleichstand: reine gefahrene Zeit des schnellsten gewerteten Laufs, danach geteilter Platz. →
  `config/regelwerke/dm-2026.yaml` `stichentscheid: [schnellsterLauf]`
- 2026-11-14 · N · Den Stichentscheid auf dem Aushang kennzeichnen. → `components/ErgebnisStapel.vue` stichAufListe
- 2026-11-14 · N · Läufe und Streichläufe frei einstellbar (Regattaleiter, z. B. Abbruch wegen Unwetter; bei zwei
  gefahrenen Läufen: einer gestrichen oder beide zählen); keine Warnung unter DM. → `lib/ergebnis.ts`,
  `components/RegelLaeufeHinweis.vue`
- 2026-11-14 · N · Wahl des Regelwerks stellt Läufe/Streichläufe: DM 3/1, UIM 2/1. → Regelwerk-YAML `wertungslaeufe`,
  `state/reducer.ts`
- 2026-11-12 · N · Bojen und Strafpunkte wie im Prototyp; der Aushang zeigt, an welchem Tor/welcher Boje was geschah,
  nicht nur die Summe. → `components/ergebnis/ErgebnisLaufBlatt.vue`
- 2026-11-15 · N · WKR-Listen mit Bojen: auch Start und Ziel je mit eigener Spalte für die linke und die rechte Boje –
  erkennbar, welche berührt wurde. Wertungslisten nennen Bojen immer R/L. → `config/kurzform.ts`, `lib/ergebnis.ts`
  BOJEN_SEITE
- 2026-11-13 · R · Knoten sind Pflicht: Liste und Erfassung in jedem Aufbau. → `config/aufbauten/gemeinsam.yaml`
- 2026-11-15 · N · „Bremsen mit der Hand beim Anlegen“: kein Fehlercode 24, sondern Disq-Buchstabe S, nur auf der
  Steg-Liste (Reglement: Verstöße ohne Strafpunkte führen zur Disqualifikation). → `config/regelwerke/dm-2026.yaml`
- 2026-11-15 · N · Disqualifikation für den ganzen Tag: einfach X. Kein Feld für die Protestfrist, kein 7-Tage-Hinweis.
- 2026-11-15 · N · Abmelde-X nur in leere Läufe; eine Klasse nur mit X bekommt keine Wertungsliste. → `lib/abmeldung.ts`
- 2026-11-12 · N · Clubmeisterschaft: Rangliste je Klasse, Läufe und Regeln wie sonst, Klassen ohne Starter entfallen;
  WKR-Listen mit mehreren Klassen je Seite.
- 2026-11-13 · N · Clubmeisterschaft „Papier sparen“ (`wkrClubGemeinsam`): Klassen teilen sich einen Bogen ohne
  Parcoursbild (sonst je Klasse mit Bild); fehlende Spalten einer Klasse sind in deren Zeilen schraffiert; Leerzeilen je
  Seite statt je Klasse (2026-11-14). → `lib/wkrListen.ts`

## Wertung UIM und Parallelslalom

- 2026-11-12 · N · Parallelslalom nur unter UIM, als Unterpunkt der Verzahnung; unter DM fehlt er auch in allen Texten.
  → `config/catalog.ts` hasParallel
- 2026-11-13 · R · UIM = zwei getrennte Stages: Manövrieren (DM-Aufbauten nutzbar) und Parallelslalom (eigener Aufbau).
  → `config/aufbauten/parallel.yaml`
- 2026-11-15 · N · Welche Stages in welcher Reihenfolge gefahren werden, entscheidet der O.O.D.; keine eigene Wahl in
  der App: Was Werte hat, wird gewertet und gedruckt; eine Disziplin zählt ab ihrem ersten erfassten Wert. →
  `lib/disziplinen.ts`
- 2026-11-15 · N · Auf Listen keine Stage-Nummern, nur der Name der Disziplin.
- 2026-11-15 · N · Abbruch einer Disziplin in einer Klasse: zählt für diese Klasse nicht; ob auch für fertige Klassen,
  wählt der O.O.D. je Klasse („Disziplin nicht werten“). Auf deren Listen entfallen dann die UIM points, mit kurzem
  Hinweis. → `components/NichtWertenWahl.vue`, `lib/disziplinen.ts`
- 2026-11-14 · R · Gleichstand im Manövrieren: Summe beider Versuche ohne Knoten. → `uim-2026.yaml` `stichentscheid`
- 2026-11-15 · R · UIM points des Manövrierens erst, wenn die Knoten erfasst sind (Pkt. 5.2.1); der Haken „erfasst“ der
  Knoten-Liste reicht dafür (N). → `lib/ergebnis.ts`, `lib/pokal.ts`
- 2026-11-15 · N · Strenge Klassentrennung im Parallelslalom ist Vorgabe. → AppState.parallelStreng,
  `planung/parallel.ts`
- 2026-11-15 · N · „Dummy“ bleibt als Wort; entfallener Start als graue Zeile, Dummy-Zeile schraffiert.
- 2026-11-15 · N · Startplan bleibt fest, sobald Werte erfasst sind; bei freigegebener Verzahnung entfällt er nur über
  „Werte löschen“, nicht durch ein einzeln geleertes Feld. → `planung/parallelRunden.ts` mitVorlaufPlan
- 2026-11-15 · N · Weiter zur nächsten Runde erst, wenn alle Ergebnisse eingetragen sind. → `lib/parallelStage.ts`
  klassenStand
- 2026-11-15 · N · Das Halbfinale beginnt erst nach Ablauf der Protestzeit des Vorlaufs.
- 2026-11-15 · N · Das Finale um Platz 3 und 4 wird vor dem Finale gefahren.
- 2026-11-15 · R/N · Disqualifiziert im Vorlauf: für die ganze Stage (Pkt. 5.2.2), 0 Punkte. Abmelde-X auch im Vorlauf.
- 2026-11-15 · R/N · Disqualifiziert in Halbfinale/Finale: letzter Platz im heat (Pkt. 5.2.2) mit dessen Punkten. →
  `lib/parallelErgebnis.ts` PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte
- 2026-11-15 · N · Wenige Gewertete: Halbfinale ab 3, Finale ab 2, sonst Platz 1 aus dem Vorlauf. →
  PARALLEL_ANNAHMEN.halbfinaleAb/finaleAb
- 2026-11-15 · N · „Qualified“ bleibt als Wort; unter fünf Gewerteten sind alle „Qualified“.
- 2026-11-15 · N · Gleichstand an der Qualifikationsgrenze: Die ganze Klasse bleibt ohne „Qualified“, bis der Re-run
  gefahren ist. Die Re-run-Fahrer bleiben auf den Plätzen, um die sie gleichauf lagen (z. B. 4 und 5), egal welche
  Re-run-Zeit. → `lib/parallelErgebnis.ts` qualifikation, mitWiederholungen
- 2026-11-15 · N · Der Re-run entscheidet nur die Reihenfolge der Gleichstehenden: Disqualifikation darin → hinterer
  Platz der Gruppe (z. B. 5.), nicht letzter Platz. → PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs = 'heat'
- 2026-11-15 · N · Ist eine ganze Re-run-Gruppe disqualifiziert, entscheidet der O.O.D. vor Ort; die App löst den Fall
  nicht eigens. → `lib/parallelErgebnis.ts` mitWiederholung
- 2026-11-15 · N · Geteilter Platz bekommt die vollen Punkte.
- 2026-11-15 · N · „Small final“ / „kleines Finale“ für Platz 3 und 4 statt des Regelbuch-Wortlauts; Halbfinale-Vermerk
  „Small final“ ohne Zusatz. → `i18n/de.ts`, `i18n/en.ts` parallel.*
- 2026-11-15 · N · „Lösen“ einer Runde heißt in der Oberfläche „Löschen“ (es löscht die Werte). →
  `components/ParallelRunden.vue`
- 2026-11-15 · N · Liste der Attempts ohne Platz-Spalte, aber sortiert wie nach Platz (beste Zeit zuerst,
  Disqualifizierte am Ende). → `components/ergebnis/ParallelAttemptsBlatt.vue`
- 2026-11-15 · N · „Versuche direkt nacheinander“ (anlegen ohne auszusteigen) nur als Option: Der Starter steht zweimal
  nacheinander auf dem Klassenzettel, auf der Vorsteg-Liste nur einmal. → AppState.versucheNacheinander
- 2026-11-15 · N · O.O.D., „Time of posting“ und „Course n“ auf den Listen. → `uim-2026.yaml` `aushang`
- 2026-11-15 · R · Liste der Fahrer je Team nach Pkt. 3.7 (Gewicht/Ballast) wird gebaut, gehört aber nicht in die
  Druckdatei (N). Sie ist intern und trägt Geburtsdatum (abschaltbar) und Geschlecht (N). → `lib/teamListe.ts`
- 2026-11-15 · N · Parallel-Steg-Liste (pontoon) ohne Spalte „Bemerkung“, dafür mit der Summe der Fehlerpunkte je
  Zeile. → `config/aufbauten/parallel.yaml`

## Einzelwertung (Regel 960, Pkt. 5.2.3 und 5.2.6)

- 2026-11-15 · N · „Individual competition“ wird auch gedruckt, wenn nur eine Stage gefahren ist.
- 2026-11-15 · N · Gesamtplatz ganz vorn; je Disziplin Zeit, Platz, UIM points; keine Spalte „Heat“ (auch nicht auf
  „Overall results“ des Parallelslaloms). → `components/ergebnis/EinzelwertungBlatt.vue`
- 2026-11-15 · N · Stichentscheid: Die Knotenstrafe zählt zur Manövrier-Zeit. → `lib/einzelwertung.ts`
  EINZEL_FESTLEGUNGEN.stichMitKnoten
- 2026-11-15 · N · Stichentscheid Parallelslalom: die beiden Attempts des Vorlaufs, nach einem Re-run dessen Zeiten. →
  EINZEL_FESTLEGUNGEN.stichParallelRunde = 'vorlauf'
- 2026-11-15 · N · Punktgleiche ohne Zeit für den Stichentscheid (disqualifiziert) stehen hinter den Punktgleichen mit
  Zeit; mehrere teilen sich diesen Platz. → `lib/einzelwertung.ts`

## Mannschaftswertung

- 2026-11-14 · N · Drei Varianten je Herkunft: Plätze 1–3 je Klasse (10/7/5), Plätze 1–6 (6/5/4/3/2/1), Punkte je Platz
  änderbar; UIM: Plätze 1–20 nach UIM-Punktetabelle, je Herkunft zählen die besten 5. → `config/einstellungen.yaml`
  pokalPunkte, Regelwerk-YAML `pokal`, `lib/pokal.ts`
- 2026-11-14 · N · Mindestens fünf Starter je Mannschaft, auch bei der DM; bei „nur ausgewählte“ zählen die
  Ausgewählten.
- 2026-11-15 · R · Stichentscheid unter DM nach Reglement C6: Anzahl der 1. Plätze, dann der 2. und 3.; sonst
  geteilter Platz. Gilt für jede eingeschaltete Variante, auch die nach Plätzen. → `config/regelwerke/dm-2026.yaml`
  `pokal.stichentscheid`
- 2026-11-14 · N · Einstellbar, dass nur ausgewählte Starter zählen: Kästchen im Reiter „Starter“, Knöpfe „alle/keine“
  und „umkehren“. → `Starter.pokal`, AppState.pokal.nurAuswahl
- 2026-11-15 · N · Stichentscheid unter UIM: zuerst die „1st places“ der fünf Gewerteten (Plätze der Einzelwertung),
  dann schrittweise die nächsten Plätze. Trennt der Stichentscheid nicht, teilen sich Herkünfte den Platz. →
  `lib/pokal.ts`
- 2026-11-14 · N · Der Zwischenstand darf springen: Plätze unter den bisher Gefahrenen, nicht auf vollständige Läufe
  warten.
- 2026-11-14 · N · Druck: Plätze-Variante quer (Platz, Herkunft, Gesamt, je Klasse Spalten 1.–6.); UIM hoch, je Herkunft
  ein Block mit eigenen Spaltenköpfen, Summe der Besten, Gesamtplatz. → `components/pokal/`

## Listen und Druck

- 2026-11-12 · N · Format aller Listen: umrandeter Kopf (Listenname links, Veranstaltung rechts), Gitter mit kräftigem
  Rahmen, mittig, Arial; jede fünfte Zeile grau, über die ganze Liste durchgezählt. → `styles/`
- 2026-11-13 · N · Am Bildschirm dürfen Listen dem Farbschema folgen; der Druck bleibt schwarz auf weiß. →
  `styles/blatt.css`
- 2026-11-14 · N · Seitenzahlen nie vom Browser und nie über den ganzen Druck: Jede Liste zählt je Dokument, nur bei
  mehr als einer Seite. Kein Druckzeitpunkt im Seitenrand. → `components/ListenDokument.vue`, `styles/print.css`
- 2026-11-14 · N · Nur Lauf- und Gesamtlisten tragen einen Zeit-Block ca. 5 mm unter der Tabelle: nur der Zeitstempel
  mit Sekunden. Kette: je Klasse und Lauf bei jeder Änderung von Zeit/Fehlerpunkten; Gesamtliste = jüngster ihrer Läufe;
  Mannschaftswertung = jüngste der Gesamtlisten. → `lib/listenStand.ts`, `components/ergebnis/ErgebnisFuss.vue`
- 2026-11-13 · N · Druckreihenfolge erst nach Parcours, dann nach Klasse: nach dem Druck nur trennen, nicht sortieren.
- 2026-11-12 · N · Startlisten je Parcours getrennt, nicht je Klasse; eine Klasse nicht unnötig über einen Seitenwechsel
  trennen.
- 2026-11-13 · N · Geburtsdatum nie auf Wertungslisten; auf Starterlisten ein-/ausblendbar; auf Gewichtslisten immer
  (Abgleich beim Check-in). → AppState.showBirthdate
- 2026-11-14 · N · Wertungslisten in „beiden Reihenfolgen“: erst nach Startnummer, dann nach Platz; die Gesamtliste hat
  dafür ein eigenes Auswahlfeld.
- 2026-11-14 · N · Listensprache folgt dem Regelwerk (DM deutsch, UIM englisch), nicht der Oberfläche; WKR-Bögen je
  Liste wählbar, unter UIM Vorgabe englisch. → `lib/listensprache.ts`, AppState.wkrSprachen
- 2026-11-15 · N · Englische Wertungslisten: Kürzel nach Rulebook (Leav./Moor. statt Dep./Moor); die Sprache des
  Rulebooks hat Vorrang. → `i18n/en.ts` results.col.stegAb/stegAn, `lib/ergebnisText.ts` SPALTEN (WKR-Bögen:
  `config/i18n/en.yaml`)
- 2026-11-15 · N · Fahrweg-Liste „Parcours einfach“: keine Σ-Spalte (dort Disqualifikationen, keine Bojenfehler).
- 2026-11-15 · N · Nummernzelle ohne Schraffur.
- 2026-11-14 · N · Namen (Bojen-Schemata, Zusatzlisten) werden nicht übersetzt.
- 2026-11-14 · N · Herkunft wahlweise mit Flagge: nur Flagge, Flagge + Kürzel, Flagge + ausgeschrieben, ohne.
  Vektorbilder statt Emoji, Bundesländer mit Wappen (Bayern: Rautenflagge); im Druck nie Flagge allein; Unerkanntes
  bleibt Text. → `domain/flaggen.ts`, `flaggen/`, `components/HerkunftText.vue`
- 2026-11-12 · N · Kürzel: eigene je Verein/Bundesland/Gruppe haben Vorrang; Bundesländer nach ISO 3166-2 (BY, NW …);
  Länder dreistellig. Startlisten: lang oder Kürzel; Wertungslisten standardmäßig Kürzel. → `domain/kuerzel.ts`,
  `domain/staaten.ts`, Regelwerk-YAML `laenderKuerzel`
- 2026-11-15 · R · Länder unter UIM nach IOC (Regel 209), frühere IOC-Kürzel werden erkannt, ausgegeben die heutigen. →
  `config/regelwerke/uim-2026.yaml` `laenderKuerzel: ioc`. Unter DM: siehe „Entschieden, noch nicht umgesetzt“.
- 2026-11-14 · N · Reiter „Starterlisten“: verzahnt (wahlweise ▶ Zeile ◀ + fett für eine Herkunft, oder „alle“ = je
  Herkunft ein Satz), je Herkunft nach Startnummer (ohne Parcours-Spalte), nach Klasse. Kopf: Titel, Herkunft/Parcours
  und Veranstaltung in eigenen Feldern. → `lib/starterlisten.ts`
- 2026-11-14 · N · Liste je Herkunft nach Startnummer: klassisch rein nach Nummer, klassenbezogen E vor 1.
  Steg-Gewichtsliste nach Startnummer.
- 2026-11-13 · N · Gewichtslisten gehen vor der Verzahnung und ohne Startnummern: je Verein/Bundesland/Land, nach Klasse
  (E, 1, 2 …), Nachname, Vorname, mit Feld für das Gewicht und dem Standardgewicht; Querformat, hohe Zeilen. →
  `components/StarterBlaetter.vue`, `views/WeighingView.vue`
- 2026-11-14 · N · Doppelseitiger Druck: optional eine leere Seite nach Dokumenten mit ungerader Seitenzahl. →
  `lib/doppelseitig.ts`
- 2026-11-14 · N · Druckdatei: eine PDF für alle teilnehmenden Gruppen, Fassung intern/extern wie die Aushänge. →
  `lib/druckdatei.ts`
- 2026-11-15 · N · Druckdatei: Starterliste nur als verzahnte Liste (DM wie UIM); vor jeder Parallel-Runde deren
  gemeinsame Startliste mit Blöcken; unter UIM erst Mannschaftswertung, Legende der Fehlerpunkte, dann die Listen der
  Stages. Nicht hinein: Startlisten je Racecourse, Liste nach Pkt. 3.7. Unfertiges wird vermerkt. → `lib/druckdatei.ts`
- 2026-11-15 · N · Parallel-Listen: „Zeilen je Seite“/„Teilen ab“ gelten, Blöcke (4 bzw. 2 Starts) nie trennen, kurze
  letzte Seite ausgleichen; jede zweite Zeile grau (Vorgabe an). → `lib/paging.ts`, `lib/parallelBogen.ts`,
  AppState.parallelZebra
- 2026-11-15 · N · Jede Liste einer Parallel-Runde teilt sich selbst, mit so wenigen Seiten wie möglich. Seite n trägt
  deshalb nicht auf allen Listen dieselben Starts (Spalte „Start“). → `lib/parallelBogen.ts`, `lib/paging.ts`
  gruppenSeiten/gruppenKapazitaet
- 2026-11-15 · N · Startlisten des Parallelslaloms (gemeinsam und je Racecourse) NICHT ausgleichen; nur Blöcke nie über
  einen Seitenwechsel trennen – eine letzte Seite mit 2 bzw. 4 Zeilen ist in Ordnung. →
  `components/ParallelStartlisten.vue`, `lib/seiten.ts` listenSeiten
- 2026-11-15 · N · Startliste einer Parallel-Runde: die gemeinsame (A und B nebeneinander) und zusätzlich je Racecourse
  eine. → `components/ParallelStartlisten.vue`

## Laufzettel und Erfassung

- 2026-11-12 · N · Erfasst wird zuerst durch Abtippen vom Papier am Auswertungsrechner.
- 2026-11-13 · N · Der Laufzettel hält die losen Blätter eines Stapels zusammen (bei „Papier sparen“ je Lauf): eine
  Zeile je Seite, Kästchen vorn; „Seite 1“ ohne „von 2“. → `lib/laufzettel.ts`, `components/LaufzettelBlatt.vue`
- 2026-11-15 · N · „Ausgehangen“ (zentrale Tafel) und „An die ML geschickt“ (PDF per Messenger) sind zwei getrennte
  Schritte. → `config/einstellungen.yaml` `laufzettel`
- 2026-11-14 · N · Zettel des letzten Laufs mit den Knoten und eigenen Schritten: kein Aushang, Einsicht der
  Mannschaftsleiter, Gesamtergebnis gedruckt und kontrolliert. Unter UIM zusätzlich Aushang binnen einer Stunde mit
  Unterschrift (R, Pkt. 5.2). → `config/einstellungen.yaml`, `uim-2026.yaml` `laufzettel.schritteLetzterLauf`
- 2026-11-15 · N · Laufzettel einer Parallel-Runde immer getrennt je Racecourse A und B. → `lib/parallelBogen.ts`
  rundenZettel
- 2026-11-14 · N · Nach Laufzettel-Scan alle Listen von Klasse und Lauf untereinander; Knoten gestapelt nur im letzten
  Lauf, einzeln in jedem Lauf. → `views/ErfassungView.vue`
- 2026-11-15 · N · Erfassung Parallelslalom: Ist Racecourse A gewählt, erscheint nichts von B (auch nicht „alle
  untereinander“).
- 2026-11-14 · N · Auswahl und aufgeklappte Blöcke überstehen ein Neuladen. → `lib/merken.ts`

## Starter und Startnummern

- 2026-11-12 · N · Startnummern klassisch (fortlaufend) oder klassenbasiert, nie beides; manuell oder automatisch;
  intern zählt die Starter-ID. Beim Ändern springt die Zeile nicht, sortiert wird nur per Knopf; doppelte Nummern
  sperren das Beenden des Bearbeitens, leere sind bis zum Erstellen der Listen erlaubt. → `domain/startnumbers.ts`,
  `components/ClassSection.vue`
- 2026-11-13 · N · Die Verzahnung ist maßgeblich (bestimmt Startnummern und alle Listen) und wird festgeschrieben. →
  AppState.verzahnungLocked
- 2026-11-15 · N · Unter UIM ist der Buchstabe der Dolphin-Nummern wählbar: E (Vorgabe, E01) oder D. Er gilt für neu
  vergebene Nummern; beim Weiterzählen zählen E und D gemeinsam (parseClassNumber). Ein Buchstaben-Präfix sortiert wie
  0, also vorn. → AppState.dolphinPraefix, `config/catalog.ts` startNrPraefixe, `components/StartNumberPanel.vue`,
  `domain/startnumbers.ts`
- 2026-11-14 · N · Nach den ersten Ergebnissen steht das Starterfeld fest: kein Entfernen (auch kein nicht
  angetretener, stattdessen abmelden = X), kein Hinzufügen, kein Import, Beispielfeld gesperrt. → `lib/eingaben.ts`
  starterfeldFest, `state/reducer.ts` STARTERFELD_ACTIONS, `lib/abmeldung.ts`
- 2026-11-15 · N · Regelwerk-Wechsel während eines Wettkampfs gesperrt, bis alles zurückgesetzt ist. →
  `state/reducer.ts`
- 2026-11-15 · N · Klasse und Geburtsjahr müssen beim Import und Eintragen passen (falscher Jahrgang bleibt verboten);
  nach dem Festschreiben steht die Klasse fest. → `import/klassenPruefung.ts`, `state/reducer.ts` klasseFest
- 2026-11-14 · R · Altersgrenzen der Klassen sind bei DM und UIM gleich (Klasse = Veranstaltungsjahr − Geburtsjahr). →
  `domain/classes.ts`
- 2026-11-13 · R · Standardgewichte DM (Reglement C3): E 26, 1 33, 2 42, 3 52, 4 65, 5 72, 6 75, 7 78 kg; UIM (Pkt.
  3.7): Dolphin 26, 1 32, 2 40, 3 52, 4 64, 5 71 kg. Die Veranstaltung speichert nur Abweichungen. → Regelwerk-YAML
  `gewichte`
- 2026-11-15 · N · Geschlecht: M, F, D (divers), nA (keine Angabe); auf englischen Listen „n/a“. →
  `domain/geschlecht.ts` geschlechtAufListe. Deutsche Kürzel: siehe „Entschieden, noch nicht umgesetzt“.

## Beispieldaten

- 2026-11-13 · N · Block „Beispieldaten“ zugeklappt unter „Veranstaltung“; offen, sobald Beispieldaten geladen sind. →
  `views/EventView.vue`
- 2026-11-15 · N · Nationen immer international (englischer Name, dreistelliger Code); unter UIM sind Beispielstarter
  immer Nationen, und das Beispielfeld stellt die Herkunft der Veranstaltung auf „Land“ (SET_ORIGIN_MODE). →
  `domain/generate.ts`, `components/BeispieldatenPanel.vue`, Test `views/EventView.test.ts`
- 2026-11-15 · N · Beispielwerte: Abweichung zwischen Racecourse A und B bleibt; wählbar, welche Stages/Runden Werte
  bekommen. → `lib/beispielwerte.ts`

## Begriffe

- 2026-11-14 · N · „Wertungslisten“ statt „Ergebnislisten“; „Mannschaftswertung“ statt „Pokalauswertung“ (UIM: team
  competition).
- 2026-11-14 · N · Klasse E: unter UIM „Dolphin“, unter DM „E“ – nie „ME“ (Überbleibsel aus M1–M7). → Regelwerk-YAML
  `klassenNamen`
- 2026-11-14 · R · Englisch nach UIM Rulebook: driver (nicht competitor), race official, racecourse, attempt,
  preliminary heat, re-run, O.O.D.; der Sport heißt „Formula Future“.
- 2026-11-14 · N · Gewicht: „Durchschnittsgewicht“, „Ausgleichsgewicht“.
- 2026-11-15 · R · „Regattaleiter“ und „Strafpunkte“ wie im DM-Reglement (vom Nutzer bestätigt).
- 2026-11-13 · N · Sprache gilt auch für Dateien: In der englischen Oberfläche englische Dateinamen und Titel
  („backup“), Datum yyyy-mm-dd.
- 2026-11-13 · N · Sprachwahl als Auswahlliste, vor jeder Sprache eine Flagge; jede neue Sprache braucht Katalog und
  Flagge. → `components/LocaleFlag.vue`
- 2026-11-14 · N · Adressen (URL) je Sprache, Reiter in der Adresse; bei mehrdeutigen Wörtern englischer Rückfall. →
  `lib/adressen.ts`

## Betrieb und Offline

- 2026-11-14 · N · Zweiter Speicher (IndexedDB) mit Verlauf: Stände ansehen, wiederherstellen, „Stand merken“ – auch zum
  Ausprobieren. → `state/zweit.ts`, `lib/verlauf.ts`, `components/VerlaufPanel.vue`
- 2026-11-15 · N · Eine neue Fassung übernimmt die App von selbst nur bei leerem Stand („leer“ = keine Starter), sonst
  über den Knopf „Update“. → `main.ts`, `lib/offline.ts`, `lib/update.ts`
- 2026-11-15 · N · Kein Update-Übergang für alte Fassungen im Service Worker. → `scripts/offline-sw.js` (Repo-Wurzel)
- 2026-11-13 · N · Lizenz der Parcours-Zeichnungen: CC BY-NC-SA 4.0 (vom Urheber bestätigt). →
  `assets/parcours/LICENSE.md`
- 2026-11-12 · N · Eigene Aufbauten wie im Fehlerpunkte-Prototyp: Assistent und YAML-Austausch. →
  `components/AufbauAssistent.vue`, `config/eigene.ts`
- 2026-11-12 · N · Reihenfolge der Arbeit: Wertung/WKR-Listen, Verwiegung (zu leichte Starter brauchen Zusatzgewicht),
  Mannschaftswertung, Urkunden-Daten als CSV/XLSX für Serienbriefe; Anzeigetafel zum Schluss. NKB-Qualifikation nur
  beschreiben (viel später). Essenkarten entfallen.

## Entschieden, noch nicht umgesetzt (Stand 2026-11-15)

Der Code weicht hier noch ab. Vor dem Umsetzen kurz mit dem Nutzer bestätigen, danach den Eintrag oben einsortieren.

- 2026-11-15 · N · Länderkürzel auch unter DM nach IOC (der Verband gehört zum Olympischen Sportbund), also überall
  IOC; Bundesländer-Kürzel bleiben. Code und README: unter DM noch ISO 3166-1 (`dm-2026.yaml` ohne `laenderKuerzel`,
  Vorgabe `iso` in `config/build.ts`; Festlegung vom 2026-11-12).
- 2026-11-15 · N · Geschlecht folgt der Listensprache: englisch M, F, D, n/a; deutsch M, W, D, k. A. („k. A.“ ist ein
  Vorschlag). Code: deutsch noch M, F, D, nA (`domain/geschlecht.ts` geschlechtAufListe).
- 2026-11-15 · N · UIM „Overall“ des Manövrierens ohne Spalte „Result“ (bester Versuch ohne Knoten). Code: Spalte noch
  da (`components/ergebnis/ErgebnisGesamtBlatt.vue`; Kopfzeilen prüft `views/UimAushang.test.ts`).
- 2026-11-15 · N · Re-run: Die Plätze der Betroffenen tragen ein * mit Fußnote. Code: nur die Fußnote
  (parallel.results.rerunNote in `components/ParallelErgebnisStapel.vue`).
- 2026-11-15 · N · Results des Vorlaufs: In der Spalte „UIM points“ werden die Zeilen mit „Qualified“ zu einer Zelle
  zusammengefasst, „Qualified“ steht diagonal darin. Die Spalte „Remark“ (bei „Disziplin nicht werten“) gefällt nicht;
  Auslegung (noch mit Bildern zu bestätigen): dieselbe Form, übrige Zellen leer, Fußnote; im Halbfinale analog
  „Final“/„Small final“. Code: Spalte „Remark“ (`components/ParallelErgebnisStapel.vue`).
- 2026-11-15 · N · Vorsteg mit „Versuche direkt nacheinander“: vor dem Überschreiben eines abweichenden X in einem
  späteren Versuch nachfragen. Code: nur Hinweis `versucheAbweichend` (`components/erfassung/ErfassungTabelle.vue`).
- 2026-11-15 · N · Startlisten des Parallelslaloms (gemeinsam und je Racecourse) wie die WKR-Listen abwechselnd
  weiß/grau. Code: keine solche Regel für `.parallel-startliste` (`styles/app.css`).

## Offen

- Geburtstags-Ausnahme des DM-Reglements (ME ab dem 6. Geburtstag, M7 bis zum 27. Geburtstag): abschaltbar in den
  Einstellungen oder nur Warnung im Reiter „Starter“ – welche Form, ist offen; bisher nicht umgesetzt (`dm-2026.yaml`).
- Hinweis „Auswertung: siehe Zettel A“ auf Laufzettel B des Parallelslaloms (`lib/parallelBogen.ts` rundenZettel).
- Beispieldaten: ob die Zahlen nur je Reiter stehen sollen (`components/BeispieldatenPanel.vue`).
- Nummernpakete mit Präfix D für Dolphin: möglich, nicht entschieden.
- Erfassung durch Wettkampfrichter am Gerät: kommt später, im Konzept mitdenken.
- Mehrgeräte-Betrieb (Anzeigetafel, Startlisten) über ntfy: noch nicht übernommen; der Server ist mit dem Nutzer
  abgestimmt (Hostname bewusst nicht im Repo).
- PARALLEL_ANNAHMEN (`lib/parallelErgebnis.ts`) und EINZEL_FESTLEGUNGEN (`lib/einzelwertung.ts`) legen aus, wo Regel 960
  schweigt; bei neuer Auskunft der UIM dort umstellen und diese Liste anpassen.
