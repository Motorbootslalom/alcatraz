# Fachliche Entscheidungen

Erste Anlaufstelle für fachliche Fragen. Bei Widerspruch zum Code nichts still ändern: datierten Code-Kommentar
(„Entscheidung des Nutzers vom …“) und [funktionen.md](funktionen.md) bzw. [parallelslalom.md](parallelslalom.md)
vergleichen, es gilt die jüngere Entscheidung. Im Zweifel den Nutzer fragen und danach diese Liste nachziehen.
Was entschieden, aber noch nicht gebaut ist, steht unter „Entschieden, noch nicht umgesetzt“ – dort weicht der Code
bewusst noch ab.

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
- 2026-11-16 · N · Einzelne Vornamen dürfen in der Doku stehen (etwa in der Vorgeschichte, `docs/stand.md`) – nie mit
  Nachname, Verein, Geburtsdatum oder Ergebnis. Für Tests und Bilder bleibt es bei erfundenen Daten.
- 2026-11-16 · N · Namensnennung der Parcours-Zeichnungen: Es genügt der Vermerk in den Einstellungen unter „Fremde
  Bestandteile und Lizenzen“, wie bei den Flaggen – Parcours und App betreut derselbe Verantwortliche. Bilder der Bögen
  in der Doku brauchen keine eigene Quellenzeile. → `components/FremdeBestandteile.vue`

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
  `state/reducer/regelwerk.ts`
- 2026-11-12 · N · Bojen und Strafpunkte wie im Prototyp; der Aushang zeigt, an welchem Tor/welcher Boje was geschah,
  nicht nur die Summe. → `components/ergebnis/ErgebnisLaufBlatt.vue`
- 2026-11-15 · N · WKR-Listen mit Bojen: Start und Ziel je mit eigener Zelle für die linke und die rechte Boje (L, R),
  mit durchgezogener Linie getrennt (nicht gepunktet wie die Bojen eines Tores), im Kopf nur die Seite; ohne
  Blickrichtung erst L, dann R. Auf dem Bogen und in der Erfassung, auch im Parallelslalom (Start/Finish). Gespeichert
  wird je Seite wie bisher, die Wertung bleibt. → `config/kurzform.ts` (`subKopf`, `subTrenner: linie`),
  `config/aufbauten/parallel.yaml`
- 2026-11-15 · N · Wertungslisten nennen Bojen immer R/L; Start und Ziel stehen dort wie die Tore mit L und R (vorher
  beide in einer Zelle), auch auf den Attempts des Parallelslaloms. → `config/kurzform.ts` ergebnisspaltenAusFahrweg,
  `lib/ergebnis.ts` BOJEN_SEITE
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
  Hinweis; in den Results von Vorlauf und Halbfinale bleibt die Spalte „UIM points“ in derselben Form (Block
  „Qualified“ bzw. der Finals, „Re-run“), die übrigen Zellen leer – keine Spalte „Remark“. →
  `components/NichtWertenWahl.vue`, `lib/disziplinen.ts`, `components/ParallelErgebnisStapel.vue` punkteVon
- 2026-11-14 · R · Gleichstand im Manövrieren: Summe beider Versuche ohne Knoten. → `uim-2026.yaml` `stichentscheid`
- 2026-11-15 · R · UIM points des Manövrierens erst, wenn die Knoten erfasst sind (Pkt. 5.2.1); der Haken „erfasst“ der
  Knoten-Liste reicht dafür (N). → `lib/ergebnis.ts`, `lib/pokal.ts`
- 2026-11-15 · N · UIM „Overall“ des Manövrierens ohne Spalte „Result“ (bester Versuch ohne Knoten – man sieht ihn an
  den gestrichenen Versuchen): Attempts, Knots pen., Best time incl. knots pen., UIM points. Die DM-Gesamtliste behält
  „Ergebnis“. → `components/ergebnis/ErgebnisGesamtBlatt.vue` ohneErgebnis, `components/ErgebnisStapel.vue`
  (`aushang.punkte` in `uim-2026.yaml`)
- 2026-11-15 · N · Strenge Klassentrennung im Parallelslalom ist Vorgabe. → AppState.parallelStreng,
  `planung/parallel.ts`
- 2026-11-15 · N · „Dummy“ bleibt als Wort; entfallener Start als graue Zeile, Dummy-Zeile schraffiert.
- 2026-11-15 · N · Startplan bleibt fest, sobald Werte erfasst sind; bei freigegebener Verzahnung entfällt er nur über
  „Werte löschen“, nicht durch ein einzeln geleertes Feld. → `planung/parallelRunden.ts` mitVorlaufPlan
- 2026-11-15 · N · Weiter zur nächsten Runde erst, wenn alle Ergebnisse eingetragen sind. → `lib/parallelStage.ts`
  klassenStand
- 2026-11-15 · N · Das Halbfinale beginnt erst nach Ablauf der Protestzeit des Vorlaufs.
- 2026-11-15 · N · Das Finale um Platz 3 und 4 wird vor dem Finale gefahren. Seit 21.11.2026 als eigene Runde `small`
  (Rundenfolge pre, semi, small, final; im Betrieb ein eigener Punkt vor dem Finale). → `planung/parallelRunden.ts`
  rundenRang, `betrieb/folge.ts`
- 2026-11-15 · R/N · Disqualifiziert im Vorlauf: für die ganze Stage (Pkt. 5.2.2), 0 Punkte. Abmelde-X auch im Vorlauf.
- 2026-11-15 · R/N · Disqualifiziert in Halbfinale/Finale: letzter Platz im heat (Pkt. 5.2.2) mit dessen Punkten. →
  `lib/parallelErgebnis.ts` PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte
- 2026-11-15 · N · Wenige Gewertete: Halbfinale ab 3, Finale ab 2, sonst Platz 1 aus dem Vorlauf. →
  PARALLEL_ANNAHMEN.halbfinaleAb/finaleAb
- 2026-11-15 · N · „Qualified“ bleibt als Wort; unter fünf Gewerteten sind alle „Qualified“.
- 2026-11-15 · N · Results des Vorlaufs: In der Spalte „UIM points“ sind aufeinanderfolgende Zeilen mit „Qualified“
  EINE Zelle (rowspan), „Qualified“ steht diagonal darin; im Halbfinale ebenso „Final 1–2“ und „Small final“.
  „Re-run“ bleibt je Zeile. Die Zelle bleibt weiß, auch über einer grauen Zeile; kein Seitenwechsel trennt sie. →
  `components/ergebnis/ErgebnisGesamtBlatt.vue` (bloecke, schraeg), `lib/seiten.ts` listenSeiten `gebunden`
- 2026-11-15 · N · Gleichstand an der Qualifikationsgrenze: Die ganze Klasse bleibt ohne „Qualified“, bis der Re-run
  gefahren ist. Die Re-run-Fahrer bleiben auf den Plätzen, um die sie gleichauf lagen (z. B. 4 und 5), egal welche
  Re-run-Zeit. → `lib/parallelErgebnis.ts` qualifikation, mitWiederholungen
- 2026-11-15 · N · Der Re-run entscheidet nur die Reihenfolge der Gleichstehenden: Disqualifikation darin → hinterer
  Platz der Gruppe (z. B. 5.), nicht letzter Platz. → PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs = 'heat'
- 2026-11-15 · N · Ist eine ganze Re-run-Gruppe disqualifiziert, entscheidet der O.O.D. vor Ort; die App löst den Fall
  nicht eigens. → `lib/parallelErgebnis.ts` mitWiederholung
- 2026-11-15 · N · Re-run: Die Plätze, die er entschieden hat, tragen ein * mit Fußnote nach Pkt. 5.2.6 (wie der
  Stichentscheid; beides auf einer Seite = eine Fußnote mit beiden Sätzen) – im Result der Runde und in den Overall
  results; die Liste der Wiederholung selbst nicht. → `lib/parallelErgebnis.ts` durchWiederholung,
  `lib/parallelStage.ts` stageDurchWiederholung, i18n parallel.results.rerunNote
- 2026-11-15 · N · Geteilter Platz bekommt die vollen Punkte.
- 2026-11-15 · N · „Small final“ / „kleines Finale“ für Platz 3 und 4 statt des Regelbuch-Wortlauts; Halbfinale-Vermerk
  „Small final“ ohne Zusatz. → `i18n/de/parallel.ts`, `i18n/en/parallel.ts` parallel.*
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
- 2026-11-19 · N · „Alle Klassen weiter“: Nach Vorlauf und Halbfinale wird als Ganzes weitergeschaltet, mit EINEM
  Knopf (ein Schritt, ein Verlaufseintrag) für alle Klassen, für die Halbfinale bzw. Finals anstehen. Auslegung: Wer
  noch fährt, einen Gleichstand an der Grenze hat (Re-run bleibt je Klasse) oder einen veralteten Plan hat, bleibt und
  steht im Hinweis; keine Rückfrage (wie beim Knopf je Klasse); der Knopf erst ab zwei Klassen. Seit 21.11.2026
  (Finals getrennt, s. dort): nach dem Halbfinale Kleines Finale und Finale zusammen; gezählt werden Klassen, nicht
  Schritte. → `lib/parallelStage.ts` alleWeiter, Action PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN, `components/ParallelRunden.vue`
- 2026-11-20 · N · Re-run im Parallelslalom (Antwort des Nutzers): „Der nötige Re-run ist erst nach der Auswertung des
  Laufes für wenige Starter nötig und kommt fast nie vor. Hier kannst du also die normale Verzahnung (großes
  Boot/kleines Boot) machen.“ Er bleibt je Klasse festzuschreiben (nicht über „Alle Klassen weiter“), seine Runde wird
  verzahnt wie die übrigen. → `planung/parallelRunden.ts` verzahneRunde, PARALLEL_ANNAHMEN.rundenVerzahnen (bestätigt)
- 2026-11-20 · N · „Alle Klassen weiter“ schon bei einer bereiten Klasse? „Nein, eigentlich nicht.“ Der Knopf bleibt ab
  zwei Klassen. → `components/ParallelRunden.vue`
- 2026-11-20 · N · Gedruckte Runden sind fest (Antwort des Nutzers): „Ja, auf jeden Fall. Man muss es aber wieder lösen
  können, wenn später ein Fehler auffällt und neu gedruckt werden muss.“ Werden WKR-Bögen, Laufzettel oder Startlisten
  einer Runde nach dem Vorlauf unter „Listen“ gedruckt, ordnet eine später festgeschriebene oder gelöschte Klasse die
  Runde nicht mehr neu (nur ans Ende). „Druck lösen …“ mit Rückfrage gibt sie wieder frei; erfasste Werte und ein im
  Betrieb begonnener Lauf binden weiter. Festlegungen bei der Umsetzung: vermerkt beim `beforeprint` (Knopf und
  Strg+P), Wertungslisten zählen nicht, die Startlisten der Runden in der Druckdatei (Regel 960) schon, der Vorlauf nicht (hängt an der Verzahnung); Zeitpunkt des ersten Drucks; in
  der Sicherung, nicht in der Vorlage; ohne Plan fällt der Vermerk weg. → AppState.parallelGedruckt, Actions
  PARALLEL_RUNDEN_GEDRUCKT/PARALLEL_DRUCK_LOESEN (`state/reducer/parallel.ts`), `views/ListsView.vue`,
  `components/ParallelRunden.vue`
- 2026-11-19 · N · Auch Halbfinale, Finals und Re-runs fahren verzahnt wie der Vorlauf: großes/kleines Boot im Wechsel
  (Block: klein 1. Attempt, groß 1. Attempt, klein 2. Attempt, groß 2. Attempt; Rest als 2er-Blöcke). Auslegung: die
  Klassen je Bootstyp in ihrer Folge im Vorlauf; eine später (oder einzeln) festgeschriebene oder gelöschte Klasse
  ordnet die Runde neu, solange darin nichts erfasst und sie im Betrieb nicht begonnen ist – danach kommt sie nur ans
  Ende. → `planung/parallel.ts` verzahne, `planung/parallelRunden.ts` verzahneRunde,
  PARALLEL_ANNAHMEN.rundenVerzahnen, `state/reducer/parallel.ts`
- 2026-11-21 · N · Kleines Finale und Finale getrennt (Auftrag des Nutzers): „Kleines und großes Finale ist getrennt,
  wie Vorlauf und Halbfinale. Das sind 4 in sich geschlossene Listen/Auswertungen.“ Vier Runden `pre`, `semi`,
  `small` (Kleines Finale, Platz 3 und 4), `final` (Finale, Platz 1 und 2), gefahren in dieser Folge; Re-runs je Runde
  wie bisher. Jede hat ihren eigenen festgeschriebenen Plan (verzahnt), WKR-Listen je Racecourse, Laufzettel,
  Startliste, Results, Erfassung und QR-Code (`…PARALLEL.SMALL…`), einen eigenen Punkt im Betrieb und einen eigenen
  Druckvermerk. Je Klasse werden beide nach dem Halbfinale getrennt festgeschrieben (eigener Knopf je Runde, beliebige
  Folge), beide lassen sich löschen; das Halbfinale erst, wenn keins mehr steht. Ohne Kleines Finale (Halbfinale mit
  Dummy, nur 2 Gewertete) entfällt die Runde für die Klasse. Das Gesamtergebnis nimmt 1/2 aus dem Finale, 3/4 aus dem
  Kleinen Finale. Rundennamen „Kleines Finale“/„Small final“ und „Finale“/„Final“ (statt „Finals“); der Vermerk
  „Kleines Finale (Platz 3 und 4)“ in der Klasse-Spalte von Plänen und Startlisten entfällt (die Runde sagt es). Alte
  Stände mit einer gemeinsamen Runde `final` teilt migrate() auf (Werte ziehen um), sonst verwirft es sie; alte
  gedruckte QR-Codes des Kleinen Finales treffen danach den Bogen des Finales (hingenommen, bestätigt 27.11.2026,
  R13-14 (5)). →
  `types/planung.ts` ParallelRunde, `lib/parallelStage.ts`, `lib/parallelErgebnis.ts`, `state/migrate.ts`
  teileAlteFinals, `components/ParallelRunden.vue`
- 2026-11-24 · N · „Alle Klassen weiter“ schreibt nach dem Halbfinale Kleines Finale und Finale auf einmal fest (ein
  Schritt, ein Verlaufseintrag; Auslegung vom 21.11.2026, bestätigt): Beide folgen aus demselben Halbfinale, die
  Entscheidung vom 19.11. nennt einen Schritt, gedruckt wird ohnehin zusammen; die Fahrfolge sichert der Betrieb. Die
  Knöpfe je Klasse bleiben getrennt. → PARALLEL_ANNAHMEN.finalsZusammen
- 2026-11-24 · N · Alle Annahmen des Parallelslaloms bestätigt („Ja, Ja, Ja, Ja, Ja“): Schwellen bei wenigen Gewerteten
  (Halbfinale ab 3, Finale ab 2), Punkte des hinteren Platzes bei Disq. in Halbfinale/Finals, Disq. im Re-run zum
  Vorlauf = hinterer Platz der Gruppe, Verzahnung der Runden nach dem Vorlauf, beide Finals zusammen bei „Alle Klassen
  weiter“. → `lib/parallelErgebnis.ts` PARALLEL_ANNAHMEN (Kommentare „BESTÄTIGT vom Nutzer 24.11.2026“)
- 2026-11-26 · N · Finals getrennt, Auslegungen vom 21.11.2026 bestätigt: Rundenname „Small final“/„Kleines Finale“
  ohne den früheren Zusatz „(3rd and 4th place)“, überall gleich (R11-25); der Hinweis „offene Runde“ (Results,
  Druckdatei, Einzel- und Mannschaftswertung) nennt je Klasse EINE Runde – die zuerst gefahrene, nicht fertige, also
  das Kleine Finale vor dem Finale, auch nach einem Protest, wenn beide veraltet sind (R11-29 (7)). →
  `planung/parallelRunden.ts` rundenText, `lib/parallelStage.ts` offeneRunde

## Einzelwertung (Regel 960, Pkt. 5.2.3 und 5.2.6)

- 2026-11-15 · N · „Individual competition“ wird auch gedruckt, wenn nur eine Stage gefahren ist.
- 2026-11-15 · N · Gesamtplatz ganz vorn; je Disziplin Zeit, Platz, UIM points; keine Spalte „Heat“ (auch nicht auf
  „Overall results“ des Parallelslaloms). → `components/ergebnis/EinzelwertungBlatt.vue`
- 2026-11-15 · N · Stichentscheid: Die Knotenstrafe zählt zur Manövrier-Zeit. Beleg, dem Nutzer am 24.11.2026 auf
  seine Frage erklärt, wohin die Knoten laut UIM gehören (abgeleitet, nicht eigens bestätigt): Regel 960, Pkt. 4.3
  „Manoeuvring consists of: Tying knots (point 4.3.1); Driving on the manoeuvring racecourse (point 4.3.2)“ und
  Pkt. 5.2.1 „best times including knots test penalties“ – die Knoten gehören nur zum Manövrieren. →
  `lib/einzelwertung.ts` EINZEL_FESTLEGUNGEN.stichMitKnoten
- 2026-11-24 · N · Stichentscheid Parallelslalom (Pkt. 5.2.6 „both his/her parallel slalom attempts“): „jeweils die
  letzte gefahrene Runde, wenn das nicht reicht zusätzlich auch die vorletzte Runde“ – je Punktgleichem die Summe
  beider Attempts SEINER zuletzt gefahrenen Runde (Finale, Kleines Finale, Halbfinale oder Vorlauf), bei gleicher Zeit
  die seiner vorletzten; ein Re-run ersetzt die Zeiten seiner Runde. Ersetzt „die beiden Attempts des Vorlaufs“ vom
  15.11.2026. Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-26, R11-27, R11-29 (8)): Runde ohne Start (in keinem
  Attempt eine Zeit oder Disq. außer X) gilt nicht als gefahren; Disq. in der letzten Runde = ohne Zeit, kein Ausweichen; wer nur den Vorlauf gefahren ist, hat keine vorletzte Runde –
  dann bleibt der Platz geteilt, für die ganze Gruppe der Gleichen; Punktgleiche ohne Zeit bekommen keine zweite
  Stufe; die Zeit der vorletzten Runde steht auf der Liste in Klammern hinter der Zeit. → EINZEL_FESTLEGUNGEN.stichParallelRunde = 'letzteDannVorletzte',
  `lib/einzelwertung.ts` gefahreneRunden, `components/ergebnis/EinzelwertungBlatt.vue`
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
- 2026-11-21 · N · WKR-Bögen zusätzlich nach Position: „Die Sortierung muss so sein, dass man die Listen für die WKR
  ohne Sortieren verteilen kann … zusätzlich muss nach Position sortiert werden.“ Druckfolge Parcours → Position (Liste
  in der Reihenfolge des Aufbaus, dahinter die zusätzlichen) → zeitliche Folge der Verzahnung; Parallelslalom
  Racecourse → Position → Runde. Ausgelegt, noch zu bestätigen: innen erst alle Klassen im 1. Lauf (Klassen in der
  Startfolge), dann der 2. Lauf – wie der Betrieb („Lauf 2 beginnen“ je Parcours); umstellbar auf „je Klasse alle Läufe“
  (`WKR_DRUCKFOLGE.innen`). Laufzettel bleiben je Parcours, Klasse und Lauf; Seitenzahlen je Bogen unverändert; keine
  Leerseiten zwischen Positionen nötig (jede Vorderseite hat ihre eigene Rückseite bzw. ist einseitig); die Druckdatei
  enthält keine WKR-Bögen; die Auswahl in der Erfassung bleibt nach Klasse/Lauf. → `lib/wkrListen.ts` WKR_DRUCKFOLGE,
  `lib/parallelBogen.ts`
- 2026-11-21 · N · Übungstakt: „dass der nächste Starter immer erst so 2–6 Sekunden später kommt, nachdem man was
  geschickt hat. Dann hin und wieder auch mal vorher, wie jetzt auch.“ Korrekturen und Rückfragen der Übung bleiben.
  Ausgelegt, noch zu bestätigen (WKR_ANNAHMEN Y1–Y3): zufällig gleichverteilt, Saat je Übung; jeder 4.–6. gezeigte
  Start zieht einen weiteren vorab nach sich; 30 s nur noch Rückfall ohne Eingabe; Beginn mit einem Start. →
  `geraete/uebung.ts` UEBUNG_FOLGE_MS, UEBUNG_FRUEH_JEDER
- 2026-11-21 · N · Druck nach Modus: „Warum werden Listen gedruckt, wenn ich beim Betrieb nur Gerät ausgewählt habe und
  nicht beides?“ Listen im Modus „Gerät“ (digital) werden unter WKR-Bögen und Laufzetteln weder gezeigt noch gedruckt;
  „beides“, „Papier“ und ohne Eintrag wie bisher; Hinweis über dem Stapel mit „Trotzdem drucken (Rückfall auf Papier)“
  (Bedienauswahl). Ausgelegt, noch zu bestätigen (WKR_ANNAHMEN Z1–Z7): pausiert/abgemeldet → gedruckt; Steg mit nur
  einem Teil auf Geräten (Register am Bedienrechner) oder einem nicht aktiven Teil → gedruckt (Anlegen auf Papier);
  Knoten immer; Parallelslalom je Liste und Racecourse. → `wkr/druck.ts`, `components/wkrDruck.ts`
- 2026-11-24 · N · Mehrere Klassen auf einem WKR-Bogen (Clubmeisterschaft): „bitte ein Option einbauen, wo ich
  entscheiden kann, ob die Klassen getrennt oder nach der Verzahnung auf dem Blatt aufgeführt werden sollen. Farben
  brauchen wir nicht. Wenn die Klassen als Block getrennt werden, reicht die Klassen Info darüber. Wenn sie in der
  Verzahnung sind, wird die Klasse nach der Startnummer benötigt. Das Ausgrauen hast du bei den Dummy schon sehr gut
  umgesetzt. So soll das dort dann auch sein.“ Einstellung „Klassen auf gemeinsamen Bögen“: getrennt (Vorgabe, wie
  bisher) oder nach der Verzahnung (gemischt in der Startfolge, Spalte „Kl.“ hinter der Nummer, keine Überschriften);
  gilt mit und ohne „Papier sparen“. Spalten, die eine Klasse nicht hat, in beiden Fällen schraffiert wie die
  Dummy-Zeile. Keine Farbtöne je Klasse (damit erledigt sich die Idee „Farbtöne für andere Klassen auf gemeinsamen
  Bögen“). Festlegungen bei der Umsetzung, bestätigt 26.11.2026: In der Startfolge stehen die Leerzeilen je Seite
  (`wkrLeerzeilenSeite`) am Ende jeder Seite mit leerer Klassenzelle, auch ohne „Papier sparen“, und entfallen bis auf
  eine, wenn sie allein ein Blatt kosteten; mit „Versuche direkt nacheinander“ (UIM) ist jede Leerzeile eine Zeile
  ohne Versuch – eine Nachmeldung füllt zwei, wie schon auf Bögen einer Klasse (R11-04); die Erfassung am Bildschirm
  behält ihre blasse Schraffur (dort liegt daneben die Schraffur „nicht gestartet“; R11-29 (2)). Bestätigt 27.11.2026:
  der Kopf nennt die Klassen der Seite (R13-05); die Beispielansicht mischt die Muster-Starter mit der Verzahnung des
  Parcours (R13-14 (3)). Offen: ob gemeinsame Bögen über Klassen auch bei DM/UIM-Meisterschaften
  kommen sollen (beantwortet 26.11.2026, R11-03, nächster Eintrag). → AppState.wkrGemeinsamFolge, `lib/wkrListen.ts`,
  `lib/bogen.ts`, `styles/bogen.css`
- 2026-11-26 · N · R11-03 Gemeinsame WKR-Bögen mehrerer Klassen auch bei Meisterschaften (DM, UIM): „Wenn es schon da
  ist, kann man das auch bei den anderen nutzen.“ Einstellung „Gemeinsame Bögen“ unter Einstellungen →
  Wettkampfrichter-Listen, nur wenn die Veranstaltung keine Clubmeisterschaft ist, Vorgabe aus (je Klasse ein Bogen wie
  bisher). An: dieselbe Gruppierung wie bei der Clubmeisterschaft ohne „Papier sparen“ (gleiche Spalten und gleiche
  Zeichnung → ein Bogen, Listen mit verschiedener Zeichnung je Klasse), mit der Folge getrennt/nach der Verzahnung;
  „Papier sparen“ (alle Klassen einer Liste, ohne Bild) als weiterer Haken. Die Clubmeisterschaft bleibt, wie sie war
  (eigene Angabe `wkrClubGemeinsam`, Vorgabe Papier sparen). Folgen wie bei der Clubmeisterschaft: Laufzettel je
  Parcours und Lauf für alle Klassen, die sich Bögen teilen (bestätigt 27.11.2026, R12-05); QR-Codes nennen die
  Klassen des Bogens (nach dem Umstellen findet der Scan den Bogen der ersten Klasse und meldet „ungenau“); Seiten
  gemeinsamer Bögen immer automatisch; WKR-Geräte, Parallelslalom und Wertung unverändert. R11-04 bestätigt: in der Startfolge die Leerzeilen je Seite am Seitenende.
  Beim Bau ausgelegt, bestätigt 27.11.2026: „Papier sparen“ auch bei Meisterschaften angeboten (ohne Parcoursbild,
  Vorgabe aus; R12-04); Leerzeilen je Klasse bleiben beim Einschalten, wie eingestellt (Meisterschaft 3,
  Clubmeisterschaft 1; R12-18 (3)).
  → AppState.wkrMeisterschaftGemeinsam (`aus`|`gleich`|`alle`), `lib/wkrListen.ts` gemeinsameBoegen,
  `views/SettingsView.vue` `wkr-meisterschaft-gemeinsam`/`wkr-meisterschaft-papier`
- 2026-11-12 · N · Startlisten je Parcours getrennt, nicht je Klasse; eine Klasse nicht unnötig über einen Seitenwechsel
  trennen.
- 2026-11-13 · N · Geburtsdatum nie auf Wertungslisten; auf Starterlisten ein-/ausblendbar; auf Gewichtslisten immer
  (Abgleich beim Check-in). → AppState.showBirthdate
- 2026-11-14 · N · Wertungslisten in „beiden Reihenfolgen“: erst nach Startnummer, dann nach Platz; die Gesamtliste hat
  dafür ein eigenes Auswahlfeld.
- 2026-11-14 · N · Listensprache folgt dem Regelwerk (DM deutsch, UIM englisch), nicht der Oberfläche; WKR-Bögen
  wählbar (siehe nächster Eintrag), unter UIM Vorgabe englisch. → `lib/listensprache.ts`
- 2026-11-15 · N · Sprache der WKR-Bögen je Liste UND Parcours, im Parallelslalom je Racecourse A/B: Auf den Parcours
  sitzen ganz getrennte Gruppen. Gewählt wird je Zelle der WKR-Einteilung gleich neben dem Namen (DE, EN, DE+EN), keine
  eigene Spalte mehr; eine frühere Wahl je Liste gilt beim Laden für jeden Parcours und beide Racecourses. Gedruckte
  Bögen, die Messung der Laufzettel und die Beispielansicht folgen ihr. Weiter eine Einstellung: in Sicherung und
  Vorlage, dort mit den Parcours der Vorlage. Festlegung bei der Umsetzung, vom Nutzer nicht entschieden (siehe
  „Offen“): Die Erfassung bleibt bei der Sprache der Oberfläche (Bedienung). →
  AppState.wkrSprachen, `lib/listensprache.ts` wkrSpracheFuer, `lib/einteilung.ts`, `components/WkrEinteilung.vue`
- 2026-11-15 · N · Beispielansicht beim Aufbau: Der Name des Wettkampfrichters wird dort nur angezeigt (der in der
  WKR-Einteilung für Liste und Parcours eingeteilte), nicht eingetragen – gepflegt wird er nur in der Einteilung. Ohne
  Eintrag die leere Linie mit „Name Wettkampfrichter*in“ / „Name of race official“ wie auf dem Papier; der Assistent für
  eigene Aufbauten ebenso. → `components/WkrVorschau.vue`, `components/bogen/BogenKopf.vue`
- 2026-11-15 · N · Beispielansicht unter einem Regelwerk mit Parallelslalom (UIM) auch mit dessen Listen: je Racecourse A
  und B Zeit, Steg (pontoon), Fahrweg einer Muster-Runde – Muster-Startnummern in 4er- bzw. 2er-Blöcken wie gedruckt,
  eine Dummy-Zeile, Kennzeichen „Beispielansicht“, Muster-QR (Scan: Beispiel). Gebaut mit denselben Bausteinen wie die
  echten Listen. „Muster-Zeilen“ zählt dort die Starts, aufgerundet auf ganze Paare; die gewählte Klasse fährt in ihrem
  Boot. Festlegung bei der Umsetzung: Bei 0 Muster-Zeilen leere Listen wie im Manövrieren, der Hinweis sagt das. →
  `lib/parallelBogen.ts` musterRundenBoegen, `components/WkrVorschau.vue`
- 2026-11-15 · N · Englische Wertungslisten: Kürzel nach Rulebook (Leav./Moor. statt Dep./Moor); die Sprache des
  Rulebooks hat Vorrang. → `i18n/en/wertung.ts` results.col.stegAb/stegAn, `lib/ergebnisText.ts` SPALTEN (WKR-Bögen:
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
- 2026-11-15 · R/N · Länder nach IOC: unter UIM nach Regel 209, unter DM ebenso (Entscheidung des Nutzers: Der Verband
  gehört zum Olympischen Sportbund; vorher ISO 3166-1). Frühere IOC-Kürzel werden erkannt, ausgegeben die heutigen;
  Bundesländer behalten ihre Kürzel. → `config/regelwerke/dm-2026.yaml` und `uim-2026.yaml` `laenderKuerzel: ioc`
- 2026-11-14 · N · Reiter „Starterlisten“: verzahnt (wahlweise ▶ Zeile ◀ + fett für eine Herkunft, oder „alle“ = je
  Herkunft ein Satz), je Herkunft nach Startnummer (ohne Parcours-Spalte), nach Klasse. Kopf: Titel, Herkunft/Parcours
  und Veranstaltung in eigenen Feldern. → `lib/starterlisten.ts`
- 2026-11-14 · N · Liste je Herkunft nach Startnummer: klassisch rein nach Nummer, klassenbezogen E vor 1.
  Steg-Gewichtsliste nach Startnummer.
- 2026-11-13 · N · Gewichtslisten gehen vor der Verzahnung und ohne Startnummern: je Verein/Bundesland/Land, nach Klasse
  (E, 1, 2 …), Nachname, Vorname, mit Feld für das Gewicht und dem Standardgewicht; Querformat, hohe Zeilen. →
  `components/StarterBlaetter.vue`, `views/WeighingView.vue`
- 2026-11-15 · N · Verwiegung: neben der Auswahl der Herkunft der Link „Gewichtslisten drucken“ zu Listen →
  Gewichtslisten, mit der gewählten Herkunft (bei „Alle“ alle); Adresse sprachabhängig und weitergebbar wie die
  übrigen Querverweise. Festlegung bei der Umsetzung: Die Herkunft steht als drittes Segment in der Adresse
  (`#/listen/gewicht/<Herkunft>`, `*` = alle, nicht übersetzt), die Listen übernehmen sie (Schreibweisen
  zusammengefasst wie in der Mannschaftswertung), danach steht nur der Reiter in der Adresse; dafür haben die
  Gewichtslisten zum Eintragen jetzt selbst eine Auswahl der Herkunft. → `views/WeighingView.vue`,
  `lib/adressen.ts` (wahl), `lib/router.ts` useReiter beiWahl, `views/ListsView.vue` gewichtHerkunft
- 2026-11-15 · N · WKR-Listen (Bögen des Manövrierens) und ihre Laufzettel erst drucken, wenn die Verzahnung
  festgeschrieben ist („Erst danach darf ich WKR-Listen drucken“): vorher „Drucken“ gesperrt, Hinweis mit Link zur
  Verzahnung; die Bildschirmansicht bleibt. Festlegung bei der Umsetzung: Auch Strg+P druckt dann keine Bögen, nur den
  Hinweis. Andere Wege gibt es nicht (Druckdatei ohne Bögen, Beispielansicht nie gedruckt); die Listen des
  Parallelslaloms hängen unverändert an ihren festgeschriebenen Runden. → `views/ListsView.vue` vorVerzahnung,
  `components/WkrListen.vue`, `components/LaufzettelListen.vue` (druckGesperrt)
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
- 2026-11-15 · N · Startlisten des Parallelslaloms (gemeinsam, je Racecourse, in der Druckdatei) abwechselnd weiß/grau
  wie die WKR-Listen: dieselbe Einstellung parallelZebra; Dummy-Zelle schraffiert, Zeile ohne Starter bleibt weiß. →
  `components/ParallelStartlisten.vue`, `styles/app.css`
- 2026-11-15 · N · Startliste einer Parallel-Runde: die gemeinsame (A und B nebeneinander) und zusätzlich je Racecourse
  eine. → `components/ParallelStartlisten.vue`
- 2026-11-16 · N · Die Herkunft der Gewichtslisten bleibt nach dem Link aus der Verwiegung in der Adresse stehen und
  folgt der Auswahl, damit sich die Adresse weitergeben lässt; „alle“ steht nicht da. → `lib/router.ts`
  `wahlFuerAdresse`, `views/ListsView.vue`
- 2026-11-16 · N · Logos auf allen gedruckten Listen, auch auf WKR-Bögen und Laufzetteln: zwei frei belegbare Plätze
  „Logo links“ und „Logo rechts“, unter DM und UIM gleich, ohne Vorbelegung – ohne Logo bleibt jede Liste wie vorher.
  Der Nutzer lädt die Bilder selbst (im Browser verkleinert); das Repo enthält keine fremden Logos. In Sicherung und
  Vorlage. Höhe einstellbar, Vorgabe 15 mm – nach Beispielen in 10/15/20 mm bestätigt; auf den WKR-Bögen höchstens
  12 mm („können kleiner sein“), Laufzettel wie die übrigen Listen. Fehlt der Vorlage ein Logo, bleibt das hiesige;
  mit nur einem Logo steht der Titel nicht genau mittig (beides bestätigt). → `components/KopfLogos.vue`,
  `components/LogosPanel.vue`, `lib/logo.ts` (LOGO_HOEHE_VORGABE_MM, LOGO_HOEHE_BOGEN_MAX_MM)

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
- 2026-11-15 · N · Vorsteg mit „Versuche direkt nacheinander“: Löschte eine Eingabe in der Zeile beim Angleichen ein X
  eines späteren Versuchs, das die Zeile nicht zeigt, fragt die Erfassung vorher (Dialog, Vorgabe „X behalten“); ohne X
  gleicht sie still an wie bisher. → `lib/erfassung.ts` ueberschreibtX, `components/erfassung/ErfassungTabelle.vue`
- 2026-11-14 · N · Nach Laufzettel-Scan alle Listen von Klasse und Lauf untereinander; Knoten gestapelt nur im letzten
  Lauf, einzeln in jedem Lauf. → `views/ErfassungView.vue`
- 2026-11-15 · N · Erfassung Parallelslalom: Ist Racecourse A gewählt, erscheint nichts von B (auch nicht „alle
  untereinander“).
- 2026-11-14 · N · Auswahl und aufgeklappte Blöcke überstehen ein Neuladen. → `lib/merken.ts`
- 2026-11-16 · N · Laufzettel B des Parallelslaloms verweist auf die Schritte: „Auswertung: siehe Laufzettel Parcours
  A“ (englisch „Scoring: see the checklist for Racecourse A“). → `components/ParallelLaufzettel.vue`
- 2026-11-16 · N · Die Erfassung bleibt in der Sprache der Oberfläche, nicht der des Bogens: Am Auswertungsrechner tippt
  eine Person die Bögen aller Parcours ab. Erfassen später Wettkampfrichter selbst, wird neu entschieden.

## Starter und Startnummern

- 2026-11-12 · N · Startnummern klassisch (fortlaufend) oder klassenbasiert, nie beides; manuell oder automatisch;
  intern zählt die Starter-ID. Beim Ändern springt die Zeile nicht, sortiert wird nur per Knopf; doppelte Nummern
  sperren das Beenden des Bearbeitens, leere sind bis zum Erstellen der Listen erlaubt. → `domain/startnumbers.ts`,
  `components/ClassSection.vue`
- 2026-11-13 · N · Die Verzahnung ist maßgeblich (bestimmt Startnummern und alle Listen) und wird festgeschrieben. →
  AppState.verzahnungLocked
- 2026-11-15 · N · Reihenfolge im Starter-Reiter: „Sortierung ändern“ je Klasse (statt „Nach Größe“) und einmal oben für
  alle Klassen (jede Klasse in sich, die Folge der Klassen bleibt). Dann sind die Spaltenköpfe Name, Vorname, Herkunft
  (Verein/Bundesland/Land wie die Veranstaltung), Größe, Geschlecht, Geburtsdatum Knöpfe; ein zweiter Klick dreht die
  Richtung um, die Richtung steht am Kopf. Stabil: erst Vorname, dann Name = nach Name und Vorname. „Zufall“ mischt
  jedes Mal neu (saat in der Action). Die vorhandenen Startnummern werden nur neu verteilt; Verlaufseintrag. Nur solange
  die Verzahnung offen ist, danach gesperrt (auch im Reducer) mit Hinweis. Festlegung bei der Umsetzung: Ohne Angabe
  steht in beiden Richtungen hinten; Texte nach deutscher Ordnung (Umlaut beim Grundbuchstaben, groß/klein gleich),
  unabhängig von der Oberfläche; Geschlecht in der Folge M, F, D, keine Angabe; Geburtsdatum aufsteigend = Älteste
  zuerst; unbekannte Größe wie keine. Verschieben einzelner Starter und Nummern von Hand bleiben nach dem
  Festschreiben möglich (nicht entschieden). Nach der Prüfung (16.11.): Ohne Startnummern (klassisch vor der
  Verzahnung) ordnen Sortieren, Zufall und Verschieben die Starter selbst um; die Verzahnung vergibt die Nummern
  dann in dieser Folge. Fehlen nur einige, gehen die vorhandenen an die ersten, die übrigen folgen sortiert. → `lib/reihenfolge.ts`, `components/ClassSection.vue`,
  `views/StartersView.vue`, Actions ORDER_STARTERS/SHUFFLE_STARTERS in `state/reducer.ts` VERZAHNUNG_ACTIONS
- 2026-11-21 · N · Sortierung im Starter-Reiter in drei Stufen (Feldtest, ersetzt „zweiter Klick dreht um“): Klick 1
  markiert die Spalte deutlich und sortiert aufsteigend A→Z (Pfeil ↑), Klick 2 absteigend Z→A (↓), Klick 3 löscht
  die Markierung, die Reihenfolge bleibt (keine Action); eine andere Spalte beginnt bei Stufe 1. Je Klasse und für alle
  Klassen. Folge vom Nutzer 21.11.2026 abends berichtigt (S-01, zuerst gebaut war Klick 1 Z→A), **gebaut 21.11.2026**:
  „aufsteigend“ = A→Z bzw. kleinster Wert zuerst (Größe XS vor XL, Geburtsdatum Älteste zuerst), ohne Angabe in beiden
  Richtungen hinten. Ursache der
  fehlenden Markierung: Mit Startnummern-Bereichen sortiert der Reducer nur je Größengruppe, die Markierung hing aber
  daran, dass die ganze Klasse nach der Spalte steht – sie verschwand sofort, und der zweite Klick sortierte erneut in
  derselben Richtung. Jetzt gilt sie, solange die Klasse in der Folge nach dem Sortieren steht (Bedienauswahl,
  lib/merken.ts; bestätigt 21.11.2026, P-19). → `lib/reihenfolge.ts` naechsteSortierung/SortierWahl,
  `components/ClassSection.vue`, `views/StartersView.vue`
- 2026-11-15 · N · Der Buchstabe der Dolphin-Nummern ist wählbar: E (Vorgabe, E01) oder D – seit 2026-11-24 auch unter
  DM (Eintrag unten). Er gilt für neu vergebene Nummern; beim Weiterzählen zählen E und D gemeinsam (parseClassNumber).
  Ein Buchstaben-Präfix sortiert wie 0, also vorn. → AppState.dolphinPraefix, `config/catalog.ts` startNrPraefixe,
  `components/StartNumberPanel.vue`, `domain/startnumbers.ts`
- 2026-11-14 · N · Nach den ersten Ergebnissen steht das Starterfeld fest: kein Entfernen (auch kein nicht
  angetretener, stattdessen abmelden = X), kein Hinzufügen, kein Import, Beispielfeld gesperrt. → `lib/eingaben.ts`
  starterfeldFest, `state/reducer.ts` STARTERFELD_ACTIONS, `lib/abmeldung.ts`
- 2026-11-15 · N · Regelwerk-Wechsel während eines Wettkampfs gesperrt, bis alles zurückgesetzt ist. →
  `state/reducer.ts`
- 2026-11-15 · N · Klasse und Geburtsjahr müssen beim Import und Eintragen passen (falscher Jahrgang bleibt verboten);
  nach dem Festschreiben steht die Klasse fest. → `import/klassenPruefung.ts`, `state/reducer/starter.ts` klasseFest
- 2026-11-15 · N · Unpassender Jahrgang: Gehört er in eine andere Klasse des Regelwerks, steht unter der Meldung ein
  Vorschlag – beim Hinzufügen „In Klasse X anlegen“ (mit allen Angaben), beim Bearbeiten (Geburtsdatum geändert)
  „In Klasse X verschieben“, nur solange die Klasse nicht feststeht. Passt er in keine Klasse, nennt die Meldung die
  Jahrgänge, die überhaupt starten. Klassen aus dem Regelwerk, Jahrgänge aus dem Jahr der Veranstaltung. Festlegung
  bei der Umsetzung: Verschieben ist auch gesperrt, sobald Ergebnisse erfasst sind (wie Entfernen/Hinzufügen,
  STARTERFELD_ACTIONS); eine klassenbasierte Startnummer wird in der neuen Klasse neu vergeben (nächste freie, hinten),
  eine klassische bleibt; eigener Verlaufseintrag. Beim Einfügen aus Excel derselbe Vorschlag je Zeile („In Klasse X
  übernehmen“, mit „zurück“), nie für alle auf einmal – ist nur das Jahr der Veranstaltung falsch eingestellt, passte
  sonst jeder Starter „woanders“; die Excel-Liste bleibt, wie sie ist. Nicht bei der Teilnehmerdaten-Datei (eine Datei
  dieses Programms: passt dort eine Klasse nicht, stimmt eher das Jahr der Veranstaltung nicht). →
  `components/ManualAddForm.vue`, `components/ClassSection.vue`, `components/ExcelPanel.vue`, Action
  `MOVE_STARTER_TO_CLASS`, `import/tsv.ts` klasseJeZeile
- 2026-11-16 · N · Beim Einfügen aus Excel zusätzlich ein Knopf „Alle beheben“, weil es manchmal viele sind: alle
  Starter in die Klasse ihres Jahrgangs, zu alte nicht übernehmen (Auslegung: ebenso zu junge – beide passen in keine
  Klasse). Ein Zusatz, kein Entweder-oder: Die Knöpfe je Zeile bleiben („In Klasse X übernehmen“, neu auch „Nicht
  übernehmen“). Gegen ein falsch eingestelltes Jahr nennt der Knopf das Jahr, und jede Änderung steht mit „zurück“
  darunter. → `components/ExcelPanel.vue`, `import/tsv.ts` ohneZeilen
- 2026-11-15 · N · Datumsfelder nie als Datumswahl des Browsers (`<input type="date">` zeigte je nach Systemsprache
  mm/dd/yyyy – „darf es nie geben“), sondern als Textfeld mit festem Muster: deutsch TT.MM.JJJJ, englisch JJJJ-MM-TT
  (siehe „Begriffe“, 13.11.). Beim Tippen und Einfügen werden auch 2019-12-01, 01.12.2019, 1.12.2019, 01/12/2019
  erkannt; Schrägstrich IMMER Tag zuerst; ungültige Daten (31.02.) werden gemeldet. Gespeichert wird JJJJ-MM-TT. Der
  Excel-Import liest dieselben Schreibweisen, nie Monat/Tag. Festlegung bei der Umsetzung: Der Import liest dazu ein
  Jahr allein (→ 1. Januar, wie bisher), eine angehängte Uhrzeit und Excel-Seriennummern (fünfstellig; vorher wurden
  sie nicht erkannt); Unlesbares bleibt leer und wird in der Vorschau und in der Meldung nach der Übernahme genannt
  (wie beim Geschlecht). Zweistellige Jahre werden nicht erraten. → `components/DatumFeld.vue`, `lib/datum.ts`, `import/tsv.ts`; Test
  `components/DatumFeld.test.ts` (keine Vorlage mit type="date")
- 2026-11-14 · R · Altersgrenzen der Klassen sind bei DM und UIM gleich (Klasse = Veranstaltungsjahr − Geburtsjahr). →
  `domain/classes.ts`
- 2026-11-13 · R · Standardgewichte DM (Reglement C3): E 26, 1 33, 2 42, 3 52, 4 65, 5 72, 6 75, 7 78 kg; UIM (Pkt.
  3.7): Dolphin 26, 1 32, 2 40, 3 52, 4 64, 5 71 kg. Die Veranstaltung speichert nur Abweichungen. → Regelwerk-YAML
  `gewichte`
- 2026-11-15 · N · Geschlecht: gespeichert M, F, D (divers), nA (keine Angabe). Das Kürzel folgt der Sprache: englische
  Listen (UIM) M, F, D, n/a, deutsche Listen (DM) M, W, D, k. A.; der Starter-Reiter folgt der Oberfläche. Der Import
  erkennt beide Schreibweisen (W, k. A., n/a …). Zu sehen ist das Geschlecht derzeit nur auf der Liste nach Pkt. 3.7
  (nur unter UIM, also immer englisch) und im Starter-Reiter; unter der DM steht es auf keiner Liste – deutsch
  erscheint es nur in der deutschen Oberfläche. → `domain/geschlecht.ts` geschlechtKuerzel, geschlechtAufListe
- 2026-11-16 · N · „Starterliste kopieren“ schreibt das Geschlecht in der Sprache der Oberfläche (M, W, D, k. A. bzw.
  M, F, D, n/a); der Import liest beides. → `import/tsv.ts` formatStartersTsv
- 2026-11-16 · N · „Liste ersetzen“ ohne Startnummern: Wer an Klasse und Name wiedererkannt wird, behält seine bisherige
  Nummer; Nummern, die erst der Import vergibt, zählen beim Wiedererkennen nicht – sonst erbte ein neuer Starter Gewicht
  und Platz in der Verzahnung eines anderen. → `import/tsv.ts` `bisherige`, `import/starterMerge.ts` `nummerVomImport`
- 2026-11-16 · N · Die Meldung nach „Ergänzen“ zählt nur die wirklich neuen Starter; übergangene (schon in ihrer Klasse)
  nennt eine eigene Zeile. → `components/ExcelPanel.vue`
- 2026-11-16 · N · ▲▼ im Starter-Reiter ist nach dem Festschreiben der Verzahnung gesperrt wie „Sortierung ändern“ und
  „Zufall“; Startnummern von Hand bleiben frei, für Korrekturen. → `state/reducer.ts` VERZAHNUNG_ACTIONS
- 2026-11-19 · N · Klassenbasierte Startnummern nach Größenbereichen der Westen; einzelne Nummern (fehlende Westen)
  lassen sich ausschließen. Die DMYV-Startnummernliste ist Vorgabe der DM 2026. Festlegungen bei der Umsetzung (am
  20.11. vom Nutzer beantwortet, siehe die Einträge darunter: Überlauf ersetzt, ▲▼ frei, Auffüllen hinfällig):
  Größengruppen S–M, L–XL, XXL (XS → S–M, XXXL → XXL); Überlauf erst in größere, dann kleinere Bereiche, sonst hinter dem höchsten; ohne Größe wie die größte Gruppe; erst die Passenden, dann
  die Ausweichenden; die Veranstaltung speichert nur abweichende Bereiche je Klasse (Vorgabe wechselt mit dem
  Regelwerk); Umstellen (▲▼, Sortieren, Zufall) bleibt in den Bereichen (▲▼ seit 20.11. frei); neue Starter bekommen die erste freie Nummer
  ihres Bereichs – auch eine frei gewordene (vorher: höchste + 1). Bei gleichem Zahlwert sortiert die Nummer mit
  Präfix vorn (E101 vor 101). → `domain/startnrBereiche.ts`, `dm-2026.yaml` `startNrBereiche`,
  `config/catalog.ts` startNrBereicheOf/startNrRegeln, AppState.startNrBereiche/fehlendeStartNr,
  `components/StartNrBereichePanel.vue`
- 2026-11-20 · N · DMYV-Liste geklärt (Antwort des Nutzers): Klasse E ist E01–E30 (auf dem Zettel versehentlich
  E101–E130); die Klassen E bis 3 haben nur S–M, erst ab Klasse 4 ist nach Größen aufgeteilt; Klasse 7: 701–710 S–M,
  711–725 L–XL, 726–730 XXL. → `dm-2026.yaml` `startNrBereiche`
- 2026-11-20 · N · Kein automatisches Ausweichen (ersetzt die Überlaufregel vom 19.11.): Ist der Bereich einer Größe
  voll oder fehlt er, bleibt die Nummer leer und der Starter-Reiter nennt den Starter – „dann muss eh manuell geschaut
  werden, wer eher in eine kleinere oder größere rutschen muss“. Hat eine Klasse nur Bereiche einer Gruppe (E–3), gilt
  er für alle Größen. → `domain/startnrBereiche.ts` gruppeFuer
- 2026-11-20 · N · Starterfeld steht mit dem Wettkampf fest (Antwort des Nutzers): „Wenn der Wettkampf anfängt, wird
  die Starterliste importiert und die Gewichtsliste gedruckt, danach steht fest, wer teilnimmt. Danach wird kein
  Starter mehr gelöscht oder hinzugefügt.“ Die Frage, ob neue Starter frei gewordene Nummern ihres Bereichs auffüllen
  sollen, ist damit hinfällig; es bleibt, wie gebaut (erste freie Nummer).
- 2026-11-20 · N · Startnummern-Bereiche, Verschieben (Antwort „Nein“ auf „nur innerhalb der Größengruppe?“): ▲▼ wirkt
  frei wie ohne Bereiche, die Nummern wandern mit der Folge; passt danach eine nicht zur Größe, nennt „Von Hand
  prüfen“ den Starter. Der Hinweis, dass Verschieben nicht ging, entfällt. Auslegung (nicht gefragt): „Sortierung
  ändern“ und „Zufall“ bleiben in den Bereichen – die Größen stehen fest. → `state/reducer/startnummern.ts` inFolge
- 2026-11-20 · N · Beispiel-Boote: lustige erfundene Namen (Flash, Merlin …), jedes Boot anders – Antwort des Nutzers,
  damit ist die Frage „je Bootstyp oder je Klasse“ erledigt. → `data/boote.ts`
- 2026-11-24 · R/N · Geburtstags-Ausnahme des DM-Reglements C8 („Klasse ME Starterlaubnis versicherungsbedingt ab dem
  6. Geburtstag und Klasse M7 Starterlaubnis bis zum 27. Geburtstag“): nur eine Warnung im Reiter „Starter“, die
  übergangen werden kann (Nutzer: „Bei den Geburtstag-Ausnahmen reicht eine Warnung und kann dann einfach übergangen
  werden“). Gebaut: die Grenzen im Regelwerk (`geburtstagsGrenzen`, nur DM: E ab 6, 7 bis 27); ein freiwilliges Datum
  der Veranstaltung (erster Wettkampftag) unter „Veranstaltung“ – in der Sicherung, nicht in der Vorlage; liegt es in
  einem anderen Jahr als die Veranstaltung, ein leiser Hinweis am Feld. Im Reiter „Starter“ je Klasse eine gelbe Marke
  im Kopf („1 Geburtstag prüfen“, auch zugeklappt), in der offenen Klasse die Liste mit Satz je Starter und ein „!“ am
  Geburtsdatum. Nichts wird gesperrt, verschoben oder abgefragt, es gibt nichts zu bestätigen. Ohne Datum der
  Veranstaltung nennt die Liste die Grenz-Jahrgänge (werden im Jahr 6 bzw. 27) zum Prüfen, mit Verweis auf das Datum,
  dazu wer sicher außerhalb liegt (bestätigt 26.11.2026, R11-29 (1)); ohne Geburtsdatum keine Warnung. „Bis zum 27. Geburtstag“ = am Geburtstag selbst
  nicht mehr (beim Bau ausgelegt, vom Nutzer bestätigt am 26.11.2026, R11-01). Mehrtägige Veranstaltungen: zwei Stufen,
  Eintrag vom 26.11.2026 (R11-02). Beim Bau ausgelegt, bestätigt 27.11.2026 (R13-14 (1)): am 29.02. Geborene werden in
  Jahren ohne 29.02. am 01.03. älter (BGB § 188). → `import/klassenPruefung.ts` geburtstagsHinweise,
  `dm-2026.yaml` `geburtstagsGrenzen`, AppState.eventDatum (SET_EVENT_DATUM), `components/ClassSection.vue`,
  `views/EventView.vue`
- 2026-11-26 · N · R11-02 Geburtstags-Warnung bei mehrtägigen Veranstaltungen (Nutzer: „Es sollte dann zwei Warnungen
  geben. Einen Hinweis, dass man 2 Wochen vor dem Datum ist, und eine deutliche Warnung, wenn der Tag weniger als 2
  Tage dran ist.“). Gemessen wird der Abstand zwischen dem entscheidenden Geburtstag (6. bzw. 27.) und dem Datum der
  Veranstaltung (erster Wettkampftag), in beide Richtungen. Deutliche Warnung (rot): Geburtstag bis 2 Tage davor oder
  danach – der Satz nennt den Geburtstag, den Abstand und ab bzw. bis wann der Starter starten darf („… wird am
  06.09.2026 6 Jahre alt (1 Tag nach dem ersten Wettkampftag) – darf in Klasse E erst ab diesem Tag starten“, Klasse 7
  „… nur bis zum 05.09.2026 starten“ = Tag vor dem 27. Geburtstag); rot bleibt auch, wer am ersten Tag klar zu jung
  oder zu alt ist (Geburtstag mehr als 2 Tage weg). Hinweis (gelb): der Starter darf am ersten Tag starten, aber der
  Geburtstag liegt 3 bis 14 Tage davor (E) bzw. danach (7) – „Geburtstag nahe am Wettkampftag: … bitte prüfen“. Ohne
  Datum wie bisher: Grenz-Jahrgänge gelb zum Prüfen, sicher außerhalb rot. Im Reiter „Starter“ je Stufe eine Marke im
  Kopf („2 Geburtstage: Warnung“, „1 Geburtstag prüfen“; ein Starter zählt nur in seiner stärksten Stufe) und ein
  Kasten in der offenen Klasse, das „!“ am Geburtsdatum in der stärksten Stufe; der Satz darunter nennt beide Spannen.
  Beides übergehbar, nichts gesperrt. Die Zahlen 2 und 14 stehen an einer Stelle (`GEBURTSTAG_FENSTER`), nicht im
  Regelwerk: Das Reglement nennt nur die Grenzen in Jahren, wie früh die App warnt, gilt für jedes Regelwerk gleich.
  Beim Bau ausgelegt, bestätigt 27.11.2026: „weniger als 2 Tage“ einschließlich 2 Tagen (so ist bei Freitag bis
  Sonntag auch der dritte Tag erfasst; R12-01); die rote Warnung kommt auch, wenn der 6. Geburtstag bis 2 Tage VOR dem
  ersten Tag liegt (darf dann schon starten; R12-02); wer in Klasse E 3–14 Tage nach dem ersten Tag 6 wird, bleibt „zu
  jung“ (rot), nicht gelb (R12-03). Nach der Prüfung (26.11.2026): Liegt jemand knapp daneben, aber am ersten Tag
  schon außerhalb (E: 6. Geburtstag 1–2 Tage danach; 7: 27. Geburtstag am Tag oder 1–2 Tage davor), sagt der Satz es
  ausdrücklich („…, am
  ersten Wettkampftag also noch nicht“ bzw. „… schon nicht mehr“); der Satz unter den Kästen nennt den Hinweis nur
  noch für Starter, die am Tag starten dürfen; der Klassenkopf bricht auf dem Handy um, statt mit zwei Marken über den
  Kasten zu ragen. → `import/klassenPruefung.ts` GEBURTSTAG_FENSTER, geburtstagsArtMitDatum, geburtstagsHinweise,
  knappAmErstenTagAusserhalb, `components/ClassSection.vue`, `styles/app.css` (`.geburtstag-*--warnung`,
  `.class-toggle-btn` umbrechend)
- 2026-11-24 · N · Buchstabe D für die Klasse E auch unter DM zur Wahl (Nutzer: „D Präfix kannst du einbauen und zur
  Auswahl stellen“), Vorgabe bleibt E; Beschriftung unter DM „Buchstabe der Klasse E“, unter UIM weiter „Dolphin“. Die
  Startnummern-Bereiche folgen dem Buchstaben: Mit D vergibt „Automatisch vergeben“ aus der DM-Vorgabe E01–E30 die
  Nummern D01–D30, die Einstellungen zeigen Bereiche und fehlende Westen mit D. Gelesen werden E und D gleich (eigene
  Bereiche, fehlende Westen, vorhandene Nummern); gespeichert bleibt, was eingetragen ist. Vorher wirkte D nur unter
  UIM (dort ohne Bereiche); unter DM vergab die App trotz D weiter E01. → `config/catalog.ts` startNrPraefixe,
  `domain/startnrBereiche.ts` nummerMitPraefix, `components/StartNumberPanel.vue`, `components/StartNrBereichePanel.vue`

## Beispieldaten

- 2026-11-13 · N · Block „Beispieldaten“ zugeklappt unter „Veranstaltung“; offen, sobald Beispieldaten geladen sind. →
  `views/EventView.vue`
- 2026-11-15 · N · Nationen immer international (englischer Name, dreistelliger Code nach IOC). → `domain/generate.ts`
  `LAENDER`, `lib/origin.ts`
- 2026-11-15 · N · Das Beispiel-Starterfeld folgt der Herkunft der Veranstaltung, unabhängig vom Regelwerk: Verein →
  Vereine, Bundesland → Bundesländer, Land → Länder (Kürzel nach IOC), ohne → Starter ohne Herkunft. Die Einstellung
  bleibt, wie gewählt (kein Umstellen auf „Land“ unter UIM mehr). „Herkünfte (leer = unbegrenzt)“ zählt die jeweilige
  Art; ohne Herkunft ist das Feld gesperrt. → `components/BeispieldatenPanel.vue`, `domain/generate.ts`, Test
  `views/EventView.test.ts`
- 2026-11-15 · N · Beispiel-Besetzung, eigener Knopf: füllt jede Zelle der WKR-Einteilung, deren Bogen gedruckt wird (je
  Parcours und Liste, unter UIM auch je Racecourse), mit zwei bis drei erfundenen Personen aus `data/`, durch Komma
  getrennt. Über 40 Zeichen stehen die Vornamen abgekürzt, reicht das nicht, nur zwei Personen – so bleibt der Eintrag
  im Bogenkopf auf einer Zeile (gemessen, auch neben QR-Code und „WKR / Race official:“). Stehen dort schon Namen: erst
  Rückfrage. Die Namen stehen wie echte in der Sicherung, nie in der Vorlage; eigener Verlaufseintrag; deterministisch
  über `saat`. → `lib/beispieldaten.ts`, Action `FILL_BEISPIEL_BESETZUNG`
- 2026-11-15 · N · Beispielgewichte, eigener Knopf: je Starter um das Durchschnittsgewicht seiner Klasse (Regelwerk oder
  abweichender Wert der Veranstaltung), ein Teil leichter, damit Ausgleichsgewichte entstehen; auf 0,1 kg wie die
  Eingabe in der Verwiegung. Sind schon Gewichte da: erst Rückfrage; eigener Verlaufseintrag; deterministisch über
  `saat`. Festlegung bei der Umsetzung: 40 % je Klasse leichter (ab zwei Startern mindestens einer, je 1 kg bis gut
  15 % darunter), die übrigen bis 25 % darüber (`ANTEIL_LEICHTER`). → `lib/beispieldaten.ts`, Action
  `FILL_BEISPIELGEWICHTE`
- 2026-11-15 · N · Beispielwerte: Abweichung zwischen Racecourse A und B bleibt; wählbar, welche Stages/Runden Werte
  bekommen. → `lib/beispielwerte.ts`
- 2026-11-16 · N · Die Zahlen im Beispieldaten-Block (Starter je Klasse – seit 21.11.2026 die Gesamtzahl –, Herkünfte, Wahl der Beispielwerte) überstehen
  ein Neuladen nur im selben Tab; das reicht. → `components/BeispieldatenPanel.vue`
- 2026-11-19 · N · Beispiel-Boote und Beispiel-Co-Piloten, je ein Knopf im Block „Besetzung“ (wo beides gepflegt wird)
  und unter „Beispieldaten“ neben der Beispiel-Besetzung (Wunsch des Nutzers). Auslegung bei der Umsetzung: Boote für
  jede Klasse der Veranstaltung (Regelwerk und Klassen mit Startern, wie die Tabelle), je Klasse ein anderer erfundener
  Name (seit 20.11.2026 lustige Namen wie Flash, Merlin, `data/boote.ts`, ohne „Delfin“ wegen „Dolphin“); Co-Piloten nur in den Klassen, in denen das
  Regelwerk einen vorsieht (`coPilot` im YAML), eine erfundene Person je Klasse aus `data/names.ts`. Steht schon etwas:
  erst Rückfrage, dann werden die Angaben dieser Klassen ersetzt, die übrigen bleiben. Eigener Verlaufseintrag;
  deterministisch über `saat`. → `lib/beispieldaten.ts`, `lib/beispielBoote.ts`, Actions `FILL_BEISPIEL_BOOTE`,
  `FILL_BEISPIEL_CO_PILOTEN`
- 2026-11-21 · N · Beispiel-Knöpfe nur an EINER Stelle (Wunsch des Nutzers: „Das passt nicht zum Rest, wo die
  Beispielwerte an einem Punkt angelegt werden.“): „Beispiel-Boote“/„Beispiel-Co-Piloten“ aus dem Block „Besetzung“
  entfernt, sie bleiben unter „Beispieldaten“. Weitere verstreute Beispiel-Knöpfe gab es nicht (geprüft). →
  `components/BesetzungPanel.vue`, `components/BeispieldatenPanel.vue`
- 2026-11-21 · N · Beispiel-Starterfeld realistisch (Wunsch des Nutzers): Gesamtzahl statt „Starter je Klasse“,
  gezogen über `saat` nach Art der Veranstaltung – Clubmeisterschaft 10–20, Meisterschaft mit Vereinen 45–75,
  Bundesland/Land 100–160 –, änderbar und neu ziehbar. Verteilung nach Anteilen aus drei Starterlisten 2025/2026 (nur
  Anteile, keine Daten): E 4 %, 1 9 %, 2 13 %, 3 15 %, 4 15 %, 5 18 %, 6 11 %, 7 15 %; größte Reste, E darf 0 sein;
  UIM gleich (Dolphin = E, Klassen E–5 neu gewichtet). Auslegungen (beantwortet 21.11.2026 abends: R6-03, R6-04
  bestätigt, R6-01 und R6-02 anders – „Antworten 21.11.2026 abends“): Die Clubmeisterschaft geht
  vor die Herkunft; eine Meisterschaft ohne Herkunft zählt wie eine mit Vereinen (45–75); Obergrenze des Felds 999;
  wechselt die Art, wird neu gezogen, sonst bleibt die Zahl (auch über das Neuladen im selben Tab). Seit 21.11.2026
  (R6-02) wieder mit Zahl je Klasse – siehe „Beispielfeld (R6-01)“ unten. →
  `domain/generate.ts` BEISPIEL_KLASSEN_ANTEILE/BEISPIEL_STARTERZAHL/beispielFeldArt/verteileAufKlassen,
  `components/BeispieldatenPanel.vue`

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

- 2026-11-16 · N · Die Tafel wird nach dem Plan vom 16.11.2026 in Etappen übernommen (E1 Anzeigetafel im zweiten
  Fenster und Start-Freigabe am Bedienrechner … E8 Feldtest). Der Nutzer hat die Auslegungen bestätigt („Deine
  Annahmen zur Tafel usw. sind hiermit bestätigt“): Betrieb erst nach dem Festschreiben der Verzahnung, Knoten nicht
  auf der Anzeigetafel, die Anzeigetafel schreibt nie ein X, Nachzügler kommen unter „Nachzuholen“ statt von selbst
  als Nächste, Sprache der Anzeigetafel = Listensprache des Regelwerks. Die übrigen Auslegungen stehen mit Datum in
  `BETRIEB_ANNAHMEN`. → `betrieb/annahmen.ts`
- 2026-11-16 · N · Mehrere Geräte (ab Etappe E5–E7), mit derselben Bestätigung: vorerst kein Gerätebetrieb ohne
  Internet (ohne Netz bleibt die Anzeigetafel am zweiten Bildschirm); Anzeigetafel und Zuschauer bekommen einen
  Lese-Link mit QR-Code statt einer Kopplung (Zuschauer-Link erneuerbar); kein Ersatzrechner, der den Raum übernimmt
  (neuer Raum, neu koppeln; keine Schlüssel in Sicherungen); vorerst kein „Poweruser“ – die Start-Freigabe darf das
  Betriebliche ihrer Parcours, Einstellungen bleiben am Bedienrechner; eine öffentliche Namensregel für Anzeigetafel
  und Zuschauer (wie der Aushang der Wertungslisten); Gerätebetrieb nur, wenn Bedienrechner und Geräte dieselbe
  Fassung haben. → Plan §7 (F2–F7), ab E5 `geraete/`; E6 Lese-Links mit QR (Betrieb → Geräte,
  `components/betrieb/GeraeteRaum.vue`), Gerät `GeraetApp.vue` (`#/sehen/<paket>`), Fassungsprüfung `geraete/geraet.ts`
- 2026-11-16 · N · Anordnung A/B einstellbar, standortabhängig: Auf der Anzeigetafel des Parallelslaloms lässt sich
  einstellen, ob Racecourse A und B neben- oder untereinander stehen und welcher links bzw. oben („Bei der
  Parallel-Tafel bitte einstellbar machen, ob horizontal oder vertikal geteilt wird. Das ist standortabhängig.“ –
  „Ja, es muss einstellbar sein, ob oben oder unten bzw. links/rechts.“). Vier Möglichkeiten, Vorgabe A links; nur
  unter UIM; reist mit der Vorlage. Ausgelegt beim Bau, bestätigt 27.11.2026 (R13-12 (3)): Start-Freigabe, Startliste und
  Zuschauerliste bleiben bei A vor B. → `AnzeigeEinstellungen.parallelAnordnung` (types/betrieb.ts),
  `components/anzeige/AnzeigeBereich.vue`, `styles/anzeige.css`, `BETRIEB_ANNAHMEN.parallelAnordnungNurTafel`
- 2026-11-24 · N · Parallelslalom im Betrieb: „Beim Parallel sind die einzelnen Stufen einzeln mit beginnen
  freizuschalten.“ Jede Runde (auch das Finale nach dem Kleinen Finale) wird mit „… beginnen“ freigegeben, nichts
  schließt von selbst an (Frage vom 21.11.2026). → `BETRIEB_ANNAHMEN.parallelRundenAlsPunkte`
- 2026-11-26 · N · R11-11 **Wiederholung nach Ausfall** (Manövrieren, DM und UIM): „Bei einem bestätigten Ausfall kommt
  es zu einer Wiederholung des Laufes. … Wenn der Ausfall Verschulden vom Starter ist, dann ist es ein J Falscher
  Parcours.“ Auf Rückfrage: **von Hand einreihen**, **Werte werden verworfen**, ausgelöst am **Bedienrechner**. An der
  Start-Freigabe „Wiederholung (Ausfall) …“ – Wahl unter den gezeigten Starts, Rückfrage mit Startnummer, Lauf und
  Folgen – verwirft die Werte des Starters in diesem Lauf auf allen Listen (samt Haken, Disq., Bemerkung; Rückfragen,
  Vorschläge, „keine Zeit“ der WKR-Geräte) und stellt den Start unter „Wiederholung offen“; dort reiht ihn die
  Wettkampfleitung ein („Als Nächster“, „Ans Ende des Laufs“, „Jetzt zeigen“). Die WKR-Geräte bekommen ihn danach wie
  einen neuen Start; auf Papier wird die Zeile gestrichen und die Wiederholung in eine Leerzeile eingetragen
  (Erfassung: ↻ an der Nummer). Der alte Stand bleibt im Verlauf zurückholbar; „Doch keine Wiederholung“ holt die Werte
  zurück (27.11.2026). Ausnahme von „Der Betrieb schreibt nie
  in `eingaben`“: nur über diese eigene Action der Erfassung. „J bei Verschulden“ setzt der WKR an der Boje – dafür
  ist nichts gebaut; der Parallelslalom behält seinen Re-run (seit 27.11.2026, R13-02, gibt es die Wiederholung auch
  dort, und seit R13-01/R13-06 löst auch das Freigabe-Handy aus – Einträge unten). Beim Bau ausgelegt: WH3–WH10 –
  bestätigt 27.11.2026 (R12-11 bis R12-16, R12-18 (4)–(6); WH10 nur für Abgemeldete) bis auf die unter „Offen“
  genannten, nicht gefragten Punkte. →
  `state/reducer/erfassung.ts` WIEDERHOLUNG_AUSFALL/WIEDERHOLUNG_AUFHEBEN, `state/reducer/betrieb.ts`
  mitWiederholung/ohneWiederholung/BETRIEB_EINREIHEN, `betrieb/folge.ts` lage (`wiederholung`), `wkr/versuch.ts`,
  `components/betrieb/AusfallWahl.vue`, `BETRIEB_ANNAHMEN` WH1–WH10
- 2026-11-27 · N · R11-11 Wiederholung nach Ausfall, nach den Prüfbefunden nachgezogen (bestätigt 27.11.2026: (1)
  R12-11, (2) R12-15, (3) R12-13, (5) R12-14, (6) R12-18 (6), (8) R12-12):
  (1) **„Doch keine Wiederholung“ holt die verworfenen Werte zurück** (samt Haken und „keine Zeit“, nur in leere
  Zellen – was seit dem Ausfall eingetragen wurde, bleibt); dafür merkt die Erfassung sie, solange der Abbruch steht
  (`WkrStand.verworfen`). Vorher ging das nur über den Verlauf, der alles seitdem mit zurücknahm, und die WKR-Geräte
  boten den Start danach nie wieder an. Es ist jetzt eine Action der Erfassung (WIEDERHOLUNG_AUFHEBEN statt
  BETRIEB_WIEDERHOLUNG_AUFHEBEN) und nimmt nur den zuletzt abgebrochenen Versuch zurück. (2) Ein schon
  **abgeschlossener Lauf** einer Liste: Die Wiederholung kommt trotzdem auf das Gerät; ihre Zeile wird dort Vorschlag
  „abgeschlossen“ (WH8 – vorher kam sie gar nicht an). (3) **„Versuche direkt nacheinander“**: Die Vorsteg-Zeile
  (unter Lauf 1) bleibt auch für die Geräte gültig – korrigierbar, P und Abschluss bleiben, kein ↻ (WH6). (4) **„Papier
  ab“** ab der Wiederholung nimmt nur sie und Späteres. (5) Eine späte Gerätezeile wird auch zwischen zwei Fenstern nie
  still wieder eingefüllt (WkrZeile.versuch, WH7). (6) Abgemeldete Starter stehen in der Wahl ausgegraut („abgemeldet –
  keine Wiederholung“). (7) Der Verlauf nennt die Startnummer. (8) Englisch „Repeat“ statt „Re-run“ (das ist unter UIM
  die Runde des Parallelslaloms). → `state/reducer/erfassung.ts` WIEDERHOLUNG_AUFHEBEN, `state/reducer/betrieb.ts`
  ohneWiederholung, `state/reducer/wkr.ts` (WKR_ZEILEN, WKR_PAPIER_AB, wkrOhneVersuch, verworfen), `wkr/schlange.ts`
  rahmen, `wkr/versuch.ts` versuchVeraltetAuf, `BETRIEB_ANNAHMEN` WH3, WH4, WH6–WH8
- 2026-11-27 · N · R13-02 **Wiederholung nach Ausfall auch im Parallelslalom** (Frage: „Wiederholung nach Ausfall im
  Parallelslalom?“ – „Auch hier kann es zu technischen Ausfällen kommen.“; damit ist WH10 „keine im Parallelslalom“
  umentschieden, der Teil zu Abgemeldeten bleibt). Welche Boote wiederholen (nur das ausgefallene oder beide des Paares),
  hat der Nutzer offen gelassen. Gebaut 27.11.2026: „Wiederholung (Ausfall) …“ an der Start-Freigabe auch im
  Parallelslalom; die Wahl zeigt die gezeigten Paar-Starts der laufenden Runden, die Rückfrage fragt JEDES MAL ohne
  Vorauswahl „Nur 101 (Parcours A)“, „Nur 102 (Parcours B)“ oder „Beide wiederholen“ (leere Seite: nur das Boot, das
  fuhr). Verworfen werden die Werte der gewählten Boote in genau diesem Attempt auf allen Listen beider Racecourses
  (samt Haken, Disq., „keine Zeit“), gemerkt je Boot; „Doch keine Wiederholung“ holt sie zurück (nur in leere Zellen).
  Das Paar steht danach unter „Wiederholung offen“ – wiederholt nur ein Boot, steht das andere dort und auf der
  Anzeigetafel als „–“ – und wird von Hand eingereiht, als Einheit (R13-13; „Ans Ende der Runde“ nimmt den 2. Attempt,
  der im Plan direkt dahinter steht, mit). Die WKR-Geräte des wiederholenden Boots bekommen den Attempt als neuen Start,
  eine späte Zeile dazu wird abgelehnt; auf dem anderen Racecourse gilt der Versuch weiter. Titel „Vorlauf · 1. Versuch ·
  Wiederholung“ bzw. „Preliminary heat · Attempt 1 · Repeat“ (`sv` bleibt 7). Die Wertung nimmt den wiederholten Attempt
  wie jeden anderen; der Re-run bei Gleichstand und „Runde gedruckt (fest)“ bleiben unberührt (die Paarung ändert sich
  nie). Beim Bau ausgelegt, vom Nutzer zu bestätigen: WHP1–WHP6 (unter „Offen“). Nicht Teil dieses Schritts: das
  Auslösen vom Freigabe-Handy (R13-01, R13-06, nächster Eintrag). → `state/reducer/erfassung.ts` WIEDERHOLUNG_AUSFALL `nur`,
  `state/reducer/betrieb.ts` mitWiederholung/BETRIEB_EINREIHEN, `betrieb/folge.ts` abgebrochenAuf/wiederholtNur/
  gefahreneSeiten, `GezeigterStart.nur`, `wkr/versuch.ts` listenSeite, `components/betrieb/AusfallWahl.vue`,
  `BETRIEB_ANNAHMEN` WH10, WHP1–WHP6
- 2026-11-27 · N · R13-01/R13-06 **Wiederholung nach Ausfall auch an der Start-Freigabe auf dem Handy** (Frage R13-01:
  „Wiederholung nur am Bedienrechner?“ – „Nein, auch an der Start Freigabe, wenn diese auf einem anderen Gerät aktiv
  ist. Die Start-Freigabe ist die Instance, die bestimmt, wer im Parcours ist und als welchen Lauf dieser gewertet wird.
  Damit sind auch Wiederholungen direkt dort zu entscheiden“; Frage R13-06 „Rechte der Start-Freigabe auf dem Handy“ –
  „Wiederholungen von Starts auslösen und einordnen in der Verzahnung, das die Position auch machen.“; sonst bleibt es
  beim Gebauten: kein „Betrieb zurücksetzen“, kein „Auf allen Parcours zeigen“, keine Einstellungen). WH3 („nur am
  Bedienrechner“) und der Teil von WH4 („Doch keine Wiederholung“ nur am Bedienrechner) sind damit umentschieden.
  Gebaut 27.11.2026: Das gekoppelte Freigabe-Handy zeigt für seine Parcours „Wiederholung (Ausfall) …“ mit derselben
  Wahl und Rückfrage wie am Bedienrechner (im Parallelslalom mit der Wahl der Boote) und in „Wiederholung offen“ „Doch
  keine Wiederholung“; Einreihen ging schon. Die beiden Actions der Erfassung (WIEDERHOLUNG_AUSFALL,
  WIEDERHOLUNG_AUFHEBEN) gehen über eine eigene, eng geprüfte Ausnahme der Positivliste, nicht pauschal: Der Host
  prüft den eigenen Bereich, dass der Start (das Paar, das Boot) unter den gefahrenen Starts des Bereichs steht und
  nicht abgemeldet ist, und lehnt sonst mit Grund ab („Für diesen Start gibt es keine Wiederholung …“, „Der Starter ist
  abgemeldet – keine Wiederholung …“). Die Wahl steht dafür in jeder öffentlichen Sicht (`sv` 8); die Abgemeldeten
  unter den gefahrenen Starts bekommt nur das Handy des Bereichs über die Freigabe-Gruppe (fv 3), zum Ausgrauen. Beim
  Bau ausgelegt, vom Nutzer zu bestätigen: WH11–WH13 (unter „Offen“). → `geraete/aufgaben.ts`
  STARTFREIGABE_WIEDERHOLUNG/erlaubteWiederholung, `geraete/host.ts` nimmAn/verteileFreigabe, `betrieb/folge.ts`
  gefahreneStarts/ausfallGrund/ausfallGesperrt, `betrieb/sicht.ts` (sv 8), `wkr/freigabe.ts` `ausfallGesperrt`,
  `components/betrieb/GeraetFreigabe.vue`, `BETRIEB_ANNAHMEN` WH3, WH4, WH11–WH13, startfreigabeRechte
- 2026-11-27 · N · R13-01/R13-02/R13-06 **Prüfbefunde zur Wiederholung nach Ausfall (Handy, Parallelslalom)** –
  behoben 27.11.2026: (1) Wiederholt nur ein Boot und fährt es danach nicht mehr (Abmeldung setzt X in den geleerten
  Attempt, X von Hand), entfällt der Start jetzt wie im Manövrieren (`betrieb/folge.ts` faehrtNoch) – vorher blieb ein
  leeres Paar unter „Wiederholung offen“, fuhr als „Attempt 1 · Repeat“ ohne Boote über die Tafel, und „Doch keine
  Wiederholung“ schrieb die alte Zeit neben das X; das geht jetzt auch im Manövrieren nicht mehr, und wiederholten beide
  Boote und hat eins inzwischen X, holt es nur die Werte des anderen zurück (WH4, WHP3). (2)
  Parcours-Ampel, „Durchs Start-Tor“ und „unterwegs“ zählen bei der Wiederholung nur eines Boots nur dessen Listen –
  vorher hielten die stehen gebliebenen Werte des anderen Boots die Ampel sofort für „durch“ (WHP4). (3) Die
  Wiederholung nur eines Boots kommt auf den Listen des anderen Racecourse nie als neuer Start, auch wenn die Liste beim
  ersten Versuch pausiert oder noch nicht digital war (`betrieb/folge.ts` giltAuf für Schlange, P, „überfällig“, Marken;
  WHP4). (4) Der Verlauf nennt die Boote aus den verworfenen Werten (beim Aufheben aus dem Stand davor), nicht beide
  laut Plan (WHP6). (5) **Gebunden an den gesehenen Versuch**: „Wiederholung (Ausfall)“ und „Doch keine Wiederholung“
  tragen die Zahl der Abbrüche, die die Start-Freigabe zeigte (`SichtStart.abbrueche`, Action `abbrueche`, vom Handy
  Pflicht); stimmt sie nicht mehr, ändert sich nichts, das Handy liest „Inzwischen hat sich dort etwas geändert – bitte
  die Anzeige prüfen.“ – vorher traf eine Nachricht aus dem Funkloch die inzwischen am Bedienrechner gezeigte
  Wiederholung selbst; die offene Rückfrage schließt sich, sobald ihr Start nicht mehr so unter den gefahrenen steht
  (WH14, neu, zu bestätigen). (6) Datenschutz-Aussagen nachgezogen: Abmeldungen (nur die Abgemeldeten unter den
  gefahrenen Starts, nur in der Freigabe-Gruppe des Bereichs) gehen über die Leitung – Text vor dem Einschalten
  (`geraete.wasGeht`), `geraete/CLAUDE.md`, Projektkarte, Leitungs-Test (WH12, zu bestätigen). Nicht umgebaut, zur
  Entscheidung (WH11, unter „Offen“): `gefahren` hält alle Starter begonnener Läufe den ganzen Tag in der Sicht der
  Tafel-Links. Die Nutzer-Doku (docs/funktionen.md, betrieb.md, parallelslalom.md, de und en) zieht ein eigener Schritt
  nach. → `betrieb/folge.ts` faehrtNoch/giltAuf, `state/reducer/erfassung.ts`, `wkr/schlange.ts`, `wkr/lage.ts`
  durchfahrtVon, `wkr/ampel.ts` laufLage, `geraete/aufgaben.ts` bereinigeWiederholung/erlaubteWiederholung (`konflikt`),
  `components/betrieb/AusfallWahl.vue`, `lib/verlauf.ts`, `BETRIEB_ANNAHMEN` WH4, WH11, WH12, WH14, WHP3, WHP4, WHP6
- 2026-11-26 · N · Gerätebetrieb (E6–E8) wie gebaut bestätigt (R11-15 bis R11-24, Einzelheiten im Abschnitt „Antworten
  26.11.2026 (Runde 11)“): zwei Lese-Links mit eigenem Schlüssel, nur der Zuschauer-Link erneuerbar; Uhrversatz nur aus
  frisch empfangenen Nachrichten; der Raum endet nur mit „Raum beenden“; Fassungsprüfung an der Form der Nachrichten;
  Link bleibt in der Adresse, Leiste nur bei Maus/Berührung oder Störung; „unverändert“ nach einem Führungswechsel nur
  im Wortlaut; abgelaufener Geräte-Code nach 2 min ohne Antwort; Bildschirm wach auf jedem verbundenen Gerät; „Alle
  Geräte neu laden“ höchstens 10 min, ohne Verbindung nichts; Kontingent-Warnung ab 80 % und nur am Bedienrechner
  gezählt. Offen bleibt der Feldtest mit echtem ntfy. → `BETRIEB_ANNAHMEN` lesenJeLink, uhrversatzFrisch, raumEnde,
  fassungGleich, leseLinkOberflaeche, koppelnZeiten, koppelnOberflaeche, wachBleiben, alleNeuLaden, kontingent
- 2026-11-11 · N · Für die Tafel darf ein öffentlicher ntfy-Server genutzt werden („Im Fall der ../tafel kann aber
  auf ntfy.adminforge.de zurückgegriffen werden“): Vorgabe ntfy.adminforge.de, in den Einstellungen änderbar (wie im
  Lastenheft der Tafel, P-9). Die frühere Notiz „Hostname bewusst nicht im Repo“ stammte nicht vom Nutzer. → ab E5
  `geraete/themen.ts` NTFY_VORGABE; E6 Einstellung `geraeteServer` (Einstellungen → Geräte; leer = Vorgabe, reist mit
  Vorlage und Sicherung)

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

## Digitale WKR-Erfassung (Antworten 21.11.2026)

Antworten des Nutzers auf F1–F17 aus [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §12 („Vorschlag
schlüssig, weitermachen“). Etappen W1–W6 ebd. §11; **W1 (Kern) gebaut 21.11.2026** nach
[plan-wkr-w1.md](plan-wkr-w1.md) – ohne Masken und ohne Oberfläche am Bedienrechner, nur gegen den nachgebauten
Server geprüft (`src/wkr/`, `state/reducer/wkr.ts`, `geraete/erfassen.ts`, Ende zu Ende `geraete/wkr.test.ts`).

Beim Bau von W1 ausgelegt, **bestätigt 21.11.2026** (Plan §9, im Code `src/wkr/annahmen.ts` WKR_ANNAHMEN):

1. Übernahme nur, wenn der Stand gleich `vorher` (beim ersten Mal leer) oder gleich dem neuen Wert ist; eine vom
   Bediener geleerte Gerätezelle ist eine Rückfrage.
2. Herkunft ◆ gerätelokal am Bedienrechner (bleibt nach „Raum beenden“, weg mit anderer Veranstaltung), Gerätename im
   Verlauf; Rückfragen, Vorschläge, Status und Abschluss im Stand (Sicherung), ohne Gerätenamen.
3. Zeilen zu nicht gezeigten Starts (auch die ohne Netz geschätzten) werden ganz Rückfrage.
4. Steg: Teilhaken Ablegen/Anlegen, beide zusammen = Haken des Stegs; Teile = Spalten `fehlerAB`/`fehlerAN`; die
   Bemerkung des zweiten Teils wird mit „; “ angehängt.
5. Pausieren/Abmelden gilt für die Liste; P = beim Pausieren offene und während der Pause gezeigte Starts.
6. Eine Liste ohne Eintrag ist Papier; das erste Koppeln setzt „digital“ ab jetzt, die Schlange beginnt dort.
7. Abschluss je Liste und Punkt, immer angenommen, wenn nichts offen ist (sonst nur mit „Rest auf Papier“);
   Abweichungen der geprüften Fassung je Start vermerkt, ohne Sperre.
8. Quittungen gesammelt über die Gruppe der Liste; direkt nur, wenn das Gerät die Gruppe (noch) nicht hat.
9. Knoten und Zeit-Listen am Gerät erst mit W5.
10. Das gekoppelte Gerät liest weiter die öffentliche Sicht; die WKR-Maske zeigt keine Namen.
11. Zahlen: Bündel ≤ 8 Zeilen, Schlange ≤ 12, „danach“ ≤ 5, „zuletzt“ ≤ 20, Lebenszeichen nach 60 s Stille.
12. (W1.4) Prüfsummen beim Abschluss über alle Starts des Punkts, für die das Gerät Werte geschickt hat (nicht nur die
    letzten 20 Zeilen); eine Korrektur einer noch wartenden Zeile ändert diese, statt eine zweite zu schicken.

**W2 (Bedienrechner) gebaut 21.11.2026** nach [plan-wkr-w2.md](plan-wkr-w2.md), Scheiben W2.1–W2.4: Lage und „Papier
ab Start …“, Betrieb → WKR (Matrix Listen × Starts, Bedienung je Liste, Eingang mit Rückfragen und Vorschlägen), ◆ und
„Papier ansehen“ in der Erfassung, Geräteleiste und Rückstandswarnung in der Start-Freigabe am Bedienrechner und auf dem
Freigabe-Handy (eigene verschlüsselte Gruppe je Bereich, nie über Anzeigetafel/Zuschauer). Weiterhin nur gegen den
nachgebauten Server geprüft. Beim Bau ausgelegt, **bestätigt 21.11.2026** (im Code `WKR_ANNAHMEN`, Hintergrund je Punkt in
plan-wkr-w2.md §9):

- A1 Unterreiter heißt „WKR“ (englisch „Race officials“), nicht „Erfassung“ (das ist schon ein Hauptreiter).
- A2 Matrix: die letzten 12 gezeigten Starts des laufenden Laufs, umschaltbar auf alle.
- A3 Ohne laufenden Lauf „ruht“ jedes Gerät (grau) statt ✕ – Geräte schicken dann kein Lebenszeichen.
- A4 Rückstand = offene gezeigte Starts der Liste; Warnung ab R (Vorgabe 1, „nachfragen“ – Fassung nach dem Feldtest, N8); am Steg zählt der Teil, der
  weiter zurück ist; pausiert/abgemeldet/Papier zählen nie.
- A5 „Papier ansehen“ an der Zeile (Start auf Papier, überfällig, Gerät seit über 5 min weg), an der Zelle (nur ein
  Steg-Teil fehlt, Rückfrage genau dort).
- A6 Zeilen zu Starts, die schon aufs Papier gingen, werden Vorschlag (nicht still übernommen).
- A7 Überschreiben eines Gerätewerts beim Abtippen fragt einmal je Zelle, solange sie den Fokus hat.
- A8 „Nachfragen“ gilt für jedes Zeigen, auch „Anderen Starter wählen“; gesperrt wird nie.
- A9 Auf dem Freigabe-Handy nur Listenname, Ampel, Zahl und Startnummern offener Starts – keine Gerätenamen, keine Werte.
- A10 „Papier ab Start …“ meldet die Liste ab; „Weiter digital“ gilt ab dem nächsten gezeigten Start.
- A11 ⧗ wartende Zeilen nur als Zahl je Gerät, nicht je Zelle.
- A12 Getrennte Kontingentanzeige der Erfassung erst mit dem Feldtest.
- A13 Gerätezustand ● unter 90 s, ◐ bis 5 min, ✕ darüber.
- Beim Bau dazu B1–B6 (Matrix/Eingang: Zähler nur Rückfragen, Modus auch ohne Gerät umstellbar, „Weiter“ schickt
  immer den Hinweis, „Papier ab“ wählt unter den Matrix-Spalten, Karte nur belegter Felder, `zuletzt` gedrosselt),
  C1–C4 (Erfassung: ◆ an jeder Liste, Nachfrage bei der ersten Änderung, Zahl mit Zellmarken, Uhr 30 s) und D1–D5
  (Start-Freigabe: Leiste mit allen Listen des Bereichs, Rückfragen nur als Zahl, Listennamen in der Sprache der
  Anzeigetafel, Neuberechnung alle 15 s und Senden nur bei Änderung, Nachfrage vor jedem Zeigen – nicht bei „Lauf
  beginnen“, „Zurück“, Zurückstellen).

**W3 (Handy-Maske „Knöpfe“) gebaut 21.11.2026** nach [plan-wkr-w3.md](plan-wkr-w3.md), Scheiben W3.1–W3.4: Maske für
Steg (ganz bzw. nur Ablegen/Anlegen), Tor 5, Mann-über-Bord und Vorsteg mit Rahmen (Kopf, Startnummer ohne Namen,
Ausweichen und Suche, „Zuletzt“ mit Korrektur, Hauptknopf „Fehlerfrei ✓“ → „Abschicken · n“, Disq. getrennt,
Doppeltipp-Schutz, Zustände ohne Arbeit), Liste zuweisen am Bedienrechner, „Liste abschließen“ mit Prüfansicht und
WKR-Name, Ansicht (Sonne/Hell/Dunkel, Linkshand) und Sprache unter „Mehr“, Probe beim Einrichten, Übungsmodus
`#/uebung` ohne Netz. Listen mit Bojen, Zeit oder Knoten zeigen „bitte Papier“ (W4/W5). Weiterhin nur gegen den
nachgebauten Server geprüft. Beim Planen und Bau ausgelegt (im Code `WKR_ANNAHMEN`, Hintergrund plan-wkr-w3.md
§9–§13), **beantwortet 21.11.2026 abends**: bestätigt bis auf G1, G3, G6, G11, G13, G15, J1–J3, K7, L3, L4 und M5 – dort
gilt die Entscheidung unten „Antworten 21.11.2026 abends (Runden 3–6)“:

- G1 Sonnenmodus ist Vorgabe, Hell/Dunkel wählbar, gemerkt je Gerät. G2 Masken nur für Listen aus Katalog/Disq./
  Bemerkung, erkannt an den Feldarten. G3 Handy eine Liste, Pad zwei – nur als Hinweis am Bedienrechner. G4 Maskenvorgabe
  (F14) nur als Feld, in W3 immer „Knöpfe“. G5 Doppeltipp-Schutz: 2 s „gesendet“, Blitz/Vibration, 1 s keine Eingabe –
  auch für Codes und Disq. G6 Codes „ab Klasse n“ bleiben drückbar. G7 Suche nur in Schlange, „danach“ und „Zuletzt“.
  G8 Rückgängig 6 s. G9 Sprache: Vorgabe die der Liste (`de+en` → deutsch); Kataloge wechseln nur unter UIM.
  G10 Probe einmal je Raum und Liste, überspringbar, nichts gesendet. G11 WKR-Name nur beim Abschluss. G12 letzter
  WKR-Name vorbelegt, gelöscht mit „Raum verlassen“. G13 Übung mit erfundenen Starts, ohne Kopplung, nichts außer der
  Ansicht abgelegt. G14 Liste ohne Maske: „Papier“ mit „Pausieren“. G15 „Nicht vorbeigekommen“ erst mit W4 (gebaut
  mit W4.3). G16 Band „Liste abschließen“, sobald der eigene Punkt nicht mehr läuft.
- Beim Bau dazu H1–H5 (Disq. als Schalter, „zurück“ = letzter Tipp, Schlange je Steg-Teil, Entwürfe im Ausgang, Übung
  in der Sprache des Regelwerks), J1–J5 (Liste zuweisen: „Maske folgt“ nach den Klassen der Starter, Handy am Namen
  erkannt, Freigabe-Vorwahl nur ohne Liste, beim Koppeln eine Liste, Verweis „Gerät koppeln“ immer), K1–K9 (Disq.
  zweiter Tipp, Sperre auch während „gesendet“, Erfassung bleibt nach Entzug offen, Entwurf je Tipp, Pause ohne
  Knöpfe, Reiter „Freigabe“ zuerst, „So lassen“ nur lokal, Suche mit „E“, Hauptknopf mit Disq.) und L1–L9 (Korrektur
  aus der Prüfansicht nur über „Zuletzt“, Regel des Abschluss-Bands, welcher Punkt abgeschlossen wird, Name beim
  Abschicken gemerkt – in der Übung nie, Sprache der Liste = keine eigene Wahl, Probe nur mit Maske und in der Übung
  nur über „Mehr“, Übungsadresse fest, „Mehr“ auch ohne Arbeit, Zeile ohne Ausgang = übernommen).

**W4 (Handy, Bojen) gebaut 21.11.2026** nach [plan-wkr-w4.md](plan-wkr-w4.md), Scheiben W4.1–W4.3: Bojen-Maske in
Fahrtfolge für jede Liste, deren Bojen auf dem Fahrweg liegen (Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel, die
Listen der Aufbauten, Parallelslalom Racecourse A/B), je Boje und Richtung ein Schalter, Tor 5 Zähler, Tor 1 auf der
Rückfahrt zwei Zeilen (F2), Seiten nach Blick wie auf dem Bogen, Umschalter Hinweg/Rückweg ab acht Zeilen, Probe und
Übung mit Bojen-Listen; „Nicht vorbeigekommen“ unter „Mehr“ (löst G15 ein; Kennzeichen ⊘, später Disq. J – seit
24.11.2026 ersetzt durch „Nicht gestartet · Disq. X“, Abschnitt „Nicht gestartet statt nicht vorbeigekommen“). Zeit-
und Knotenlisten bleiben Papier (W5).
Weiterhin nur gegen den nachgebauten Server geprüft. Beim Planen und Bau ausgelegt (im Code `WKR_ANNAHMEN`, Hintergrund
plan-wkr-w4.md §10), **beantwortet 21.11.2026 abends**: bestätigt bis auf P9/U2, P10/Q2 und die Form von P16/R1–R8
(Disq. J statt ⊘); P15 nicht gefragt:

- P1 Bojen-Maske an den Feldern erkannt (Boje auf dem Fahrweg; sonst Papier). P2 Zähler nur Tor 5, sonst Schalter
  (auch UIM). P3 Tor 1 Rückfahrt zwei Zeilen statt Zähler 0–2. P4 je Berührung 5 Punkte, Zellwert = Punkte. P5 Zähler
  höchstens 9. P6 Zeilen in Fahrtfolge, Einfahrt Tor 5 zwischen Tor 5 hin/rück, MüB nach Tor 1 R. P7 Knopfspalten nach
  Blick wie die Unterspalten des Bogens. P8 Umschalter erst bei mehr als 7 Zeilen, wechselt nie von selbst. P9 Disq.
  immer ins Disq.-Feld (überholt 21.11.2026: Nutzer will Disq. an der Boje – U1–U4, plan-wkr-w4.md §13). P10 Band „Klasse n – andere Halte“ 2 s. P11 Probe an der Klasse mit den meisten Zeilen. P12
  Übung Tor 1/3/5, Tor 2/4/5, Parcours, unter UIM Parallelslalom. P13 Fehlerfrei = Zeile ohne Zellen. P14 Texte „Tor 1
  H L: 5“. P15 Bojen-Angaben in der Sicht. P16 „Nicht vorbeigekommen“ (ersetzt 24.11.2026). P17 Startnummer 80 px auf
  Bojen-Listen.
- Beim Bau W4.2 dazu Q1–Q7 (Probe beginnt mit dem linken Knopf, Klassenwechsel-Band unter der Karte, „höchstens 9×“ im
  Knopf, Seite je Start gemerkt, „Berührt“ und „(2. Durchf.)“, Kopfzeilen HINWEG/RÜCKWEG ohne Umschalter, Übung nur
  mit Listen des Regelwerks) und beim Bau W4.3 R1–R8 zu „Nicht vorbeigekommen“ (mit ihm ersetzt 24.11.2026).

- 2026-11-21 · F1 · Papier bzw. „beides“ ist **immer** je Liste wählbar, nicht nur beim ersten Wettkampf. Das Gerät kann
  sich „pausieren“ oder „abmelden“; dann zählt die Liste nicht als Rückstand, die Freigabe wartet nicht darauf.
- 2026-11-21 · F2 · Eine Boje kann je Richtung nur einmal berührt werden (Schalter 5/0). Ausnahmen: Torbojen von Tor 5
  (Zähler je Berührung) und Tor 1 auf der Rückfahrt, das wegen der Speedrunde zweimal durchfahren wird – im Fahrweg
  schon zwei Halte (`t1b` „1 R“, `t1c` „1 R“ Speedrunde, `config/kurzform.ts`), also je Durchfahrt ein Schalter.
- 2026-11-21 · F3 · Digitale WKR nur mit Start-Freigabe.
- 2026-11-21 · F4 · Warnen ab R = 2, „nachfragen“ wählbar, nie sperren; dazu in der Erfassung am Bedienrechner eine
  Markierung an Zeile/Zelle, deren Gerätewert fehlt („Papier ansehen“). **Geändert nach dem Feldtest 21.11.2026**
  (Befund 8, Nutzer: „Hier sollte nächster Starter nicht einfach möglich sein, wenn der WKR noch nicht fertig ist“):
  Rückfrage schon ab **einem** offenen Start („Mann-über-Bord hat 604 noch nicht abgeschickt – trotzdem weiter?“),
  Vorgabe R = 1 und „nachfragen“, R zählt jetzt „ab“ statt „mehr als“; weiter **kein hartes Sperren** (ein Gerät kann
  ausfallen, der Bediener entscheidet, „Papier ab“ bleibt); gilt auch auf dem Freigabe-Handy. „Papier ansehen“ in der
  Erfassung bleibt so streng wie vorher (überfällig erst bei mehr als max(R, 2) jüngeren Starts). Geräteleiste: das
  Zeichen nennt den Erfassungsstand (✓ fertig, ⧗ wartet n, ✕ Gerät weg, ▭ Papier), die Verbindung steht klein
  dahinter (Befunde 9, 12). WKR_ANNAHMEN N9, N10 bestätigt 21.11.2026; N8 vom Nutzer neu gefasst (P-03, unten).
- 2026-11-21 · F5 · X vom Gerät nur bei Steg-Ablegen und Vorsteg, mit Rückfrage und Hervorhebung am Bedienrechner.
  Seit 24.11.2026 nur noch für die Disq.-Knöpfe; „Nicht gestartet · Disq. X“ unter „Mehr“ geht auf jeder Liste
  (Abschnitt „Nicht gestartet statt nicht vorbeigekommen“).
- 2026-11-21 · F6 · Kein Name auf dem WKR-Gerät (Startnummer, Klasse, ggf. Boot).
- 2026-11-21 · F7 · Korrektur über „Zuletzt“ (die letzten abgeschickten Zeilen bleiben auf dem Gerät erreichbar).
  „Liste abschließen“ zeigt am Laufende alle Zeilen der Liste noch einmal zur Prüfung und wird als Ganzes quittiert;
  bis dahin direkte Korrektur, danach nur Vorschlag an den Bedienrechner (Nutzerfrage „wie korrigieren, wenn nur der
  aktive Starter zu sehen ist?“, so ausgelegt).
- 2026-11-21 · F8 · „Liste abschließen“ mit WKR-Name ersetzt die Unterschrift auf dem Bogen.
- 2026-11-21 · F9 · Zeitnahme: nur die abgelesene Zeit eintippen, kein Stoppen am Handy.
- 2026-11-21 · F10 · Herkunft der Werte nicht in der Sicherung, nur Zeichen ◆ und Verlauf am Bedienrechner.
- 2026-11-21 · F11 · Ausnahme „Werte auf der Leitung“: Werte der eigenen Liste verschlüsselt Gerät → Bedienrechner,
  zurück nur Quittungen bzw. bei Rückfrage eine Zelle; kein Ausgleichsgewicht (seit 24.11.2026 doch, nur an der
  Steg-Liste – Abschnitt „Ausgleichsgewicht am Steg“ unten).
- 2026-11-21 · F12 · Übernahme automatisch in leere Zellen, abnicken nur bei Abweichung.
- 2026-11-21 · F13 · Sprache der Maske = Sprache der Liste, auf dem Gerät umschaltbar.
- 2026-11-21 · F14 · Der Bedienrechner gibt die Maske vor; der WKR wechselt nur, solange nichts festgelegt ist.
- 2026-11-21 · F15 · Handy genau eine Liste, Pad höchstens zwei.
- 2026-11-21 · F16 · Teilkopplung nur am Steg (Ablegen/Anlegen); Disq./Bemerkung werden vereinigt.
- 2026-11-21 · F17 · Nichts davon auf der Anzeigetafel oder Zuschauerliste.
- 2026-11-21 · W1/W2 · Alle Auslegungen aus W1 und W2 (Fragen W1-01…W1-15, W2-01…W2-30 der Fragenseite; WKR_ANNAHMEN
  bis „Prüfbefunde W2“, A1–A13, B1–B6, C1–C4, D1–D5, E1–E4) vom Nutzer mit „passt“ bestätigt. Die Rückstandswarnung
  (A4) gilt in der Fassung nach dem Feldtest (R = 1, „nachfragen“, ab R). W3-Auslegungen und die des Feldtests (N…)
  blieben offen – beantwortet 21.11.2026 abends (unten „Antworten 21.11.2026 abends (Runden 3–6)“).
- 2026-11-21 · Steg-Zeitversatz (Nutzer: „Eine Startnummer kann nicht gleichzeitig am Steg und im Parcours sein. Steg
  läuft deswegen beim Ablegen etwas vor der Tafel und dem Parcours und beim Anlegen hinterher.“): Ablegen sieht die
  Starts „Am Steg“ schon vor dem Zeigen (wie der Vorsteg), Anlegen erst, wenn das Boot nicht mehr „Im Boot“ ist; das
  Anlegen des gezeigten Starts zählt nie als offen (keine Rückfrage vor „Nächster Start“). Ein Gerät für den ganzen
  Steg zeigt nie denselben Starter in beiden Teilen. Papierbogen „Steg“ unverändert. Gebaut 21.11.2026, Auslegungen
  WKR_ANNAHMEN T1–T4 bestätigt 21.11.2026; T9 nicht (R6-10: Abschluss im laufenden Lauf nur mit Rückfrage).
- 2026-11-21 · „Abmelden“ am WKR-Gerät (Nutzer: „Das muss so sein, als ob ich die Liste von dem Gerät entferne.“): wirkt
  wie das Entfernen der Liste – Liste (Teil-Gerät: sein Teil, letztes Gerät der Liste: die ganze) abgemeldet, zählt
  nicht als offen, Aufgabe weg, neuer Schlüssel; das Gerät zeigt „Von … abgemeldet“ mit Entwürfen und „Zuletzt“, wieder
  dabei nur über neues Zuweisen. Ursache des Befunds: ein Teil-Gerät (Ablegen) meldete nur seinen Teil ab, der
  Anlegen-Teil ohne Gerät blieb digital „offen“; ein Gerät für den ganzen Steg bekam in der Sicht je Teil weiter
  „aktiv“ und zeigte den nächsten Start. Gebaut 21.11.2026, Auslegungen WKR_ANNAHMEN T5–T8 bestätigt 21.11.2026.
- 2026-11-21 · Pad bis W5 (Nutzer: „Die Pad-Geräte-Listen … sehen auf dem Pad noch sehr komisch aus“): Ab 700 px Breite
  steht die Handy-Maske als mittige Spalte von 560 px mit ruhigem Rand je Modus (Sonne/Hell/Dunkel) statt in der
  720-px-Hülle der Freigabe auf dem Grund der App; Fuß mit Hauptknopf, Reiter und Leiste genauso breit. Eigene
  Pad-Masken (größer, zwei Listen nebeneinander) erst mit W5. Gebaut 21.11.2026, WKR_ANNAHMEN T10 bestätigt 21.11.2026.

### Antworten 21.11.2026 abends (Runden 3–6)

Antworten des Nutzers auf die Fragenseite, Runden 3–6 (W3-01…W3-52, P-01…P-19, W4-01…W4-35, R6-01…R6-17, S-01). Alle
übrigen Fragen hat er mit „passt“ bestätigt (in `WKR_ANNAHMEN`, BETRIEB_ANNAHMEN, `lib/reihenfolge.ts`,
`domain/generate.ts` je Eintrag „bestätigt 21.11.2026 (Frage)“; Übersicht plan-wkr-w3.md §15, plan-wkr-w4.md §14).
Hier die Fragen, die er **anders** entschieden hat – noch nicht umgesetzt (siehe „Entschieden, noch nicht umgesetzt“),
bis dahin gilt der gebaute Stand:

- 2026-11-21 · N · **Start-Freigabe nur für den Parcours, Parcours-Ampel** (P-03; **gebaut 21.11.2026**, Auslegungen
  AM1–AM10 in WKR_ANNAHMEN/BETRIEB_ANNAHMEN beantwortet 22.11.2026, Runde 7: bestätigt bis auf AM1/AM2 (R7-01) – plan-antworten-runde3-6.md §3, §8; ersetzt die Frage „zählt der
  gezeigte Start sofort als offen?“; P-04 damit erledigt). Wortlaut: „Die Freigabe bezieht sich immer auf den Parcours
  und nie auf den Steg oder Vorsteg. Sobald ein Starter bereit ist, in den Parcours zu fahren, wird die Tafel auf diesen
  umgestellt, alle Parcours-WKR bekommen diesen Starter angezeigt und die Ampel wird grün. Wenn der Starter durch das
  Start/Ziel-Tor fährt, wird die Ampel rot. Die Ampel bleibt auch rot, wenn der Starter den Parcours wieder verlassen
  hat. Das ist dann die Zeit, wo die WKR ihre Bewertung eintragen und abschicken. Wenn dann alle grün sind, kann der
  nächste Starter. Es kann auch einen Auto-Modus geben, der automatisch weiterschaltet, wenn alle WKR ihre Eintragung
  abgeschickt haben. Das klappt aber nur, wenn alle ein Gerät haben. Es muss also nie auf den Steg gewartet werden.
  Diese laufen autark.“ Daraus:
  1. Rückstand und Rückfrage vor „Nächster Start“ zählen nur die **Parcours-Listen** (Tore, Bojen, Tor 5,
     Mann-über-Bord, Start/Ziel); Steg (Ablegen und Anlegen) und Vorsteg halten die Freigabe nie auf.
  2. Ampel je Parcours: **grün**, sobald der Starter gezeigt ist (Anzeigetafel umgestellt, alle Parcours-WKR sehen
     ihn); **rot** ab der Durchfahrt durch das Start/Ziel-Tor – rot auch nach dem Verlassen des Parcours, **bis alle
     Parcours-WKR abgeschickt haben**; dann darf der Nächste.
  3. **Auto-Modus** (wählbar): „Nächster Start“ von selbst, sobald alle Parcours-WKR abgeschickt haben – nur
     möglich, wenn jede Parcours-Liste ein Gerät hat (eine Papierliste meldet nichts).
  Gebaut 21.11.2026 mit diesen Auslegungen (noch zu bestätigen): Parcours-Liste an den Feldern erkannt (AM1/AM2:
  nicht Steg, Vorsteg, Zeit, Knoten); Durchfahrt per Knopf „Durchs Start-Tor“ an der Start-Freigabe (auch Handy) ODER
  durch die erste Zeile/den ersten Wert einer Parcours-Liste zum gezeigten Start (AM4); gespeichert nur der Knopf
  (`BereichBetrieb.durchfahrt`), grün/rot/frei abgeleitet (`wkr/ampel.ts`); keine Ampel ohne digitale Parcours-Liste
  (AM3); Rückfrage nur über Parcours-Listen, der gezeigte Start zählt erst ab rot (AM5); Auto-Modus als Einstellung
  (Vorgabe aus) mit 3 s Countdown und „Anhalten“, nie neuer Lauf/Nachzuholende/Zurückgestellte/Pause (AM6/AM7);
  keine Ampel auf Anzeigetafel und Zuschauerliste (AM8); kleiner Punkt in der Starterkarte der Parcours-WKR (AM9). Ein
  Lichtsignal am Wasser gibt es in der App nicht. → `wkr/ampel.ts`, `wkr/lage.ts`, `wkr/freigabe.ts` (fv 2),
  `wkr/sicht.ts` (Fassung 6), `geraete/host.ts` (Auto), `components/betrieb/StartFreigabe.vue`,
  WKR_ANNAHMEN.nachfrageNurParcours, BETRIEB_ANNAHMEN.autoVorgabe
- 2026-11-21 · N · **Disq. an der Boje mit Punkten in derselben Zelle** (W4-12): „Boje/Tor usw. ist wichtig, damit
  geprüft werden kann, wo der Disq.-Fehler genau passiert ist. Daher sollte das immer nachgefragt werden und auch in
  dieser Spalte eingetragen werden können. Wichtig ist auch, dass es dann passieren kann, dass Fehlerpunkte (5) und ein
  Disq.-Grund in der gleichen Bojenspalte stehen können müssen.“ Also: Bei einer Disq. auf Bojen-Listen fragt die Maske
  **immer** nach Boje bzw. Tor; die Bojenzelle hält Punkte UND Buchstaben zugleich (etwa „5 J“). Der Bau vom
  21.11.2026 (U1/U2, Commit 404d7c6) ersetzt die Berührungen durch den Buchstaben – überholt. Braucht eine Zellform,
  die Erfassung, Wertung (Punkte zählen, Disq. wirkt) und Bogen beide lesen (`lib/disq.ts` sanitizeBuoy). →
  WKR_ANNAHMEN.disqAnBoje/disqBojeMitPunkten. **Gebaut 21.11.2026** (Plan docs/plan-antworten-runde3-6.md §4,
  BZ1–BZ5 noch zu bestätigen): Zellform „5J“/„10G“ (Ziffern + ein Buchstabe, tolerant getippt, alte Werte gültig),
  bojenWert zählt die Punkte neben dem Buchstaben, Wertungsliste „5J“ ohne Komma, X nie mit Punkten; auf dem Gerät
  fragt DISQ immer erst die Boje („Keine Boje / ganzer Parcours“ → Disq.-Feld), der Buchstabe kommt zu den Punkten.
- 2026-11-21 · N · „Nicht vorbeigekommen“ = Disq. J (W3-17) – ersetzt am 24.11.2026 durch „Nicht gestartet · Disq.
  X“ (Abschnitt „Nicht gestartet statt nicht vorbeigekommen“).
- 2026-11-21 · N · **Hell/Dunkel des Geräts ist Vorgabe** (W3-01, P-18): „Hell/Dunkel ist für Geräteeigentümer heilig.
  Das darf auf keinen Fall ignoriert werden. Es kann abgeändert werden, aber Default ist immer der Gerätemodus.“ Die
  WKR-Maske startet im Modus des Systems (hell oder dunkel); Sonne, Hell, Dunkel bleiben unter „Mehr → Ansicht“
  jederzeit wählbar. Ersetzt G1 (Sonne als Vorgabe) und den Teil von N4, nach dem die Maske den System-Dunkelmodus
  ignoriert. → WKR_ANNAHMEN.sonneVorgabe/farbenNurMaske, `styles/wkr-geraet.css`, `geraete/ablage.ts` liesAnsicht
  **Gebaut 21.11.2026** (GF1): Vorgabe „Wie Gerät“ (live), Wahl Wie Gerät/Sonne/Hell/Dunkel, auch in der Übung.
- 2026-11-21 · N · **Sortierung im Reiter Starter** (S-01, berichtigt „hier war ich ungenau“): Klick 1 **A→Z** (↑),
  Klick 2 **Z→A** (↓), Klick 3 hebt die Markierung auf. → `lib/reihenfolge.ts` naechsteSortierung **Gebaut 21.11.2026**: Pfeile,
  `aria-sort` und Titel der Spaltenköpfe (je Klasse und „Alle Klassen“) folgen.
- 2026-11-21 · N · Listen je Gerät nur Empfehlung (W3-03): Handy eine, Pad zwei ist eine Empfehlung; mehr Listen
  sollen gehen, auf dem Pad nebeneinander. Die Geräteart (Handy/Pad) meldet das Gerät beim Koppeln, der Bedienrechner
  speichert sie (W3-25, statt Erkennung am Gerätenamen J2). **Gebaut 21.11.2026** (GF7, GF8): bis 4 Listen,
  Empfehlung Handy 1/Pad 2 nur als Hinweis, Pad quer zwei Spalten; Art handy/pad/rechner beim Koppeln, änderbar.
- 2026-11-21 · N · Codes anderer Klassen (W3-07): ausgegraut, aber drückbar – die Besprechung kann sie für weitere
  Klassen freigeben. Braucht die Klasse je Code im Katalog (YAML). **Gebaut 21.11.2026** (GF2): YAML `abKlasse`
  (dm-2026 Codes 4/23 ab 3, 2/5/10/16 ab 4), ohne Rückfrage.
- 2026-11-21 · N · WKR-Name (W3-13, W3-41): kommt aus der WKR-Einteilung der Veranstaltung (Parcours × Liste), ist
  unter „Mehr“ jederzeit änderbar und am Bedienrechner unter Betrieb → WKR/Geräte zu sehen. Weicht er von der
  Einteilung ab, nur ein Hinweis: unter Veranstaltung übernehmen oder auf dem Gerät erneut überschreiben. Ersetzt G11
  (Name nur beim Abschluss); W3-41 („Was meinst du hiermit?“) ist damit erledigt. **Gebaut 21.11.2026** (Plan
  docs/plan-antworten-runde3-6.md §6, WN1–WN3 noch zu bestätigen): Name nur in der verschlüsselten Sicht der eigenen
  Liste (`wkrName`, LISTEN_SICHT_FASSUNG 8; nie Tafel, Zuschauer, Freigabe), „Mehr → Name“ gerätelokal je Raum und
  Liste, geänderter Name im Lebenszeichen an den Bedienrechner (Register, nie AppState); Betrieb → Geräte und
  Betrieb → WKR zeigen „Name auf dem Gerät: … – Einteilung: …“ mit „In Veranstaltung übernehmen“ (SET_WKR_NAME).
  Ohne Einteilung fragt der Abschluss wie bisher (G12 bleibt Rückfall).
- 2026-11-21 · N · Übung (W3-15, „Das ist der Hammer“): dazu „Übung beenden/Abbrechen“ unterhalb der Knöpfe beim
  Hochziehen (statt Neuladen) und die Erklärung der Übungsstarts in der Übung selbst (Starts 1–20 ohne Namen in den
  Klassen des Regelwerks, Bestätigung kurz nach dem Senden, gelegentlich eine Rückfrage, Starts kommen nach und nach).
  **Gebaut 21.11.2026** (GF4): Erklärung einklappbar oben, „Übung beenden“ unter der Maske.
- 2026-11-21 · N · Erste Liste auf einem Gerät (W3-24, Befund statt Antwort): Bekommt ein Gerät ohne Liste eine Liste
  zugewiesen, bleibt es auf „verbinde zum Bedienrechner“, bis man die Seite neu lädt – das soll von selbst gehen
  und/oder über einen Knopf. **Gebaut 21.11.2026** (GF6): Gerät holt nach jedem neuen Gruppenschlüssel sofort nach,
  „Neu verbinden“ nach der Karenz.
- 2026-11-21 · N · Start-Freigabe beim Koppeln nie vorgewählt (W3-26): „Das ist genauso ein Recht wie die Listen.“
  **Gebaut 21.11.2026**.
- 2026-11-21 · N · „So lassen“ (W3-35): Der Bedienrechner erfährt, dass der WKR eine Rückfrage mit „So lassen“
  beantwortet hat (bisher nur auf dem Gerät). **Gebaut 21.11.2026** (GF5): Action WKR_SO_LASSEN, Eingang „WKR: so
  lassen (Uhrzeit)“, die Rückfrage bleibt offen.
- 2026-11-21 · N · „Mehr → Liste abschließen“ (W3-40): unklar, warum mitten im Lauf und für alle Klassen – herausnehmen
  oder den Zweck genauer erklären. Das Band nach dem Lauf (G16, L2) ist bestätigt. **Gebaut 21.11.2026** (AM10): unter
  „Mehr“ entfernt, das Band nennt den Zweck (Unterschrift für den Lauf, alle Klassen).
- 2026-11-21 · N · Umschalter Ablegen/Anlegen (W3-51): muss beim Gerät für den ganzen Steg immer sichtbar sein, sonst
  merkt der WKR nicht, dass im anderen Teil jemand wartet – gern mit einem Zeichen „fertig/offen“ je Teil.
  **Gebaut 21.11.2026** (GF3): beide Reiter immer, je Teil ✓ bzw. Zahl offener Starts, feste Höhe.
- 2026-11-21 · N · Klassenwechsel-Band (W4-13): nur beim ersten Start einer neuen Klasse; beim Hochwischen soll die
  Parcours-Zeichnung mit angezeigt werden. **Gebaut 21.11.2026** (GF9): Band nur beim ersten Start einer Klasse im
  Punkt; Zeichnung der Klasse unter den Knöpfen (Sicht `bild`, gebündelt).
- 2026-11-21 · N · Anlegen-Liste abschließen, solange der Lauf noch läuft (R6-10): immer mit Rückfrage. **Gebaut
  21.11.2026** – für jede Liste: „Lauf n läuft noch (604 unterwegs) – trotzdem abschließen?“ (Sicht `laeuft`).
- 2026-11-21 · N · Beispielfeld (R6-01): „Clubmeisterschaft ist eine Meisterschaft ohne Vereine, jedoch mit mehreren
  Klassen auf einem Blatt.“ (R6-02): Die Zahl je Klasse soll weiter festlegbar sein; „neu ziehen“ (seltsamer Name)
  setzt die Vorgabe, danach z. B. eine Klasse auf 0 und eine andere höher. **Gebaut 21.11.2026** (BS1–BS3, noch zu
  bestätigen): Größe der Clubmeisterschaft bleibt 10–20; ihre Beispielstarter bekommen nie eine Herkunft, auch wenn
  die Veranstaltung nach dem Wechsel („ohne“) von Hand wieder eine bekam (BS1, `domain/generate.ts` beispielHerkunft);
  „mehrere Klassen auf einem Blatt“ = die gemeinsamen WKR-Bögen (vorhanden, Test mit einem Feld von 15), die
  Wertungslisten bleiben je Klasse. Gesamtzahl = Vorschlag, verteilt auf die Klassen; je Klasse wieder ein Zahlfeld
  (0–999), daneben „zusammen n (Vorschlag m)“; Knopf „Vorschlag neu“/„New suggestion“ setzt Gesamtzahl und Klassen
  neu (BS2); eine neue Gesamtzahl verteilt neu (BS3); gemerkt mit der Art (merke `beispiel.klassen`).
- 2026-11-21 · R · Bojenpunkte (W4-07, „ja“ mit Auftrag „Früher hatten wir 10 Punkte pro Boje“): geprüft –
  dm-2026.yaml `direktpunkte` 5 je Boje und Fahrtrichtung bzw. je Berührung an Tor 5 (Reglement C5 b, c),
  uim-2026.yaml „Touching of a buoy“ 5; 10 steht in keinem Regelwerk. Fest 5 bleibt (WKR_ANNAHMEN.bojenPunkte,
  wkr/bojen.test.ts vergleicht mit beiden Regelwerken).
- 2026-11-22 · Reihenfolge der Bojen-Maske (Nutzer: „Deine Implementierung ‚Wie der Parcours liegt‘ ist leider Müll.
  Es ging mir bei dem Punkt darum, dass du bei Hin eine andere Zeilenreihenfolge (Start/Ziel, Tor 1, Tor 3, Tor 5)
  hast als beim Rück-Tab (Tor 5, Tor 3, Tor 1, Start/Ziel). Den zweiten Tab wollte ich gedreht haben. Du kannst auch
  die beiden alten Tabs optional auch untereinander schreiben: Start, Tor 1, Tor 3, Tor 5, Tor 5, Tor 3, Tor 1,
  Ziel.“): Die Ansicht „Wie der Parcours liegt“ samt Start oben/unten und „Bojen links/rechts tauschen“ (V1/V2 vom
  21.11.2026) ist entfernt. Mehr → Ansicht → „Bojen“, je Gerät und Liste gemerkt: **„Rückweg gedreht“ (Vorgabe)** – der
  Rück-Reiter in derselben Folge wie Hin, jedes Tor an derselben Stelle; „Fahrtfolge“ – der Rück-Reiter, wie das Boot
  fährt; „Alles untereinander“ – ein Reiter ohne Umschalter. Für alle Bojen-Listen (Tor 1/3/5, Tor 2/4/5, Parcours,
  Parallel A/B). Gebaut 22.11.2026; Auslegungen WKR_ANNAHMEN V3 `bojenFolge` (a)–(g) bestätigt 22.11.2026 (R8-01…R8-07) – vor allem
  (a): Speedbojen, Tor 1 der Speedrunde und MüB haben auf dem Hinweg kein Gegenstück und stehen unter „gedreht“ seit
  dem Prüfbefund 22.11.2026 an ihrer Stelle der umgekehrten Fahrtfolge (Klasse 7: Ziel, Tor 1 (2.), Speed 2, Tor 1 R,
  Tor 3, Tor 5; vorher unter den Toren).
- 2026-11-22 · W5 „Pad“ gebaut (Plan [plan-wkr-w5.md](plan-wkr-w5.md), Scheiben W5.1–W5.5): Pad-Anordnung mit bis
  vier Listen nebeneinander und Maskenwahl am Bedienrechner (W5.1), Maske „Bild“ (W5.2), Knoten am Tisch als Liste
  ohne Lauf mit Prüfliste (W5.3), Zeit-Listen mit Ziffernblock und „Keine Zeit“ (W5.4), Tabelle für Geübte nur auf
  Pad und Rechner (W5.5). Ohne Rückfrage beim Bau ausgelegt, beantwortet 22.11.2026 (Runde 8, Abschnitt unten; BD3, BD4,
  BD7, KN3, KN7, KN8, ZT3 anders entschieden): PD1–PD6 (Anordnung), MW1–MW3
  (Maskenwahl), BD1–BD7 (Bild), KN1–KN8 (Knoten), ZT1–ZT4 (Zeit), TB1–TB5 (Tabelle: nur Pad/Rechner, keine Probe,
  Zeile wie der Bogen mit denselben Sanierern und Fehler je Zelle statt stiller Verbesserung, Bojen als Punkte,
  letzte 5 + nächste 3 Zeilen mit Korrektur an der Zeile) – je Eintrag in WKR_ANNAHMEN (src/wkr/annahmen.ts) und
  gesammelt in plan-wkr-w5.md §10. Feldtest offen ([feldtest.md](feldtest.md) „Pad (W5)“).

### Antworten 22.11.2026 (Runden 7–8)

Antworten des Nutzers auf die Fragenseite, Runde 7 (R7-01…R7-52: Parcours-Ampel, Abschluss, Bojenzelle, Gerät,
WKR-Namen, Druck nach Modus, Übung, Beispieldaten) und Runde 8 (R8-01…R8-42: Torreihenfolge, Pad, Maskenwahl, Bild,
Knoten, Zeit, Tabelle). Alle übrigen Fragen hat er mit „passt“ bestätigt (in `WKR_ANNAHMEN`, `BETRIEB_ANNAHMEN`,
`domain/generate.ts`, `components/BeispieldatenPanel.vue` je Eintrag „Bestätigt 22.11.2026 (Frage)“; Übersicht
plan-antworten-runde3-6.md §8, plan-wkr-w5.md §10). R7-23/R7-24 („Wie der Parcours liegt“, Spiegeln/Tauschen) sind
durch die Bojen-Folge V3 überholt, die mit R8-01…R8-07 bestätigt ist. Hier die Antworten, die **anders** entscheiden
oder etwas dazuwünschen – noch nicht umgesetzt (siehe „Entschieden, noch nicht umgesetzt“), bis dahin gilt der
gebaute Stand:

- 2026-11-22 · R7-01 · **Zeit-Listen zählen zur Parcours-Ampel** (gegen AM1/AM2): „Zeit gehört mit zu den
  Parcours-Listen und ist relevant für die Ampel.“ Reine Zeit-Listen (`zeit`, `zeit-n`) halten die Ampel also auf rot,
  bis sie abgeschickt haben (und zählen damit auch für Rückstand, Nachfrage und Auto-Modus). **Umgesetzt 22.11.2026**
  (Scheibe 1, plan-antworten-runde7-8.md §2.1): wkr/liste.ts istParcoursListe zählt Zeit mit (`zeit`, `zeit-n`,
  Parallel „Zeit“ A/B je Racecourse), AM2 umgebaut (`zeitIstParcoursListe`), docs/betrieb.md nachgezogen.
- 2026-11-22 · R7-14 · **Mehrere Disq. je Bojenzelle, Anzeige mit Komma** (gegen BZ1 „5J“): „Es können pro Boje auch
  mehrere Disq. eingetragen werden. Bei der Eingabe kann flexibel geparst werden. Also mit Leerzeichen, ohne oder mit
  Komma. Angezeigt wird es dann aber mit Komma.“ Eine Bojenzelle hält Punkte und beliebig viele Disq.-Buchstaben;
  Eingabe tolerant („5 J G“, „5JG“, „5, J, G“), angezeigt mit Komma (z. B. „5, J, G“). **Umgesetzt 22.11.2026**
  (Scheibe 2, plan-antworten-runde7-8.md §3): Speicherform = Anzeige „5, J, D“ (Punkte zuerst, Buchstaben in
  Katalogfolge der Zelle, Dubletten weg, X allein), lib/disq.ts sanitizeBuoy + bojenZelle (eine Stelle), lib/scoring.ts
  bojenWert liefert eine Liste (je Buchstabe ein Disq.), Gerät: Disq.-Wahl an einer Boje als Mehrfachwahl mit
  „Fertig“, „zurück“ nimmt den zuletzt gesetzten Buchstaben; LISTEN_SICHT_FASSUNG 10. Neue Auslegungen BZ1
  (umgebaut), BZ6–BZ8 – noch zu bestätigen.
- 2026-11-22 · R7-21 · **Langes Drücken auf eine Boje als zweiter Weg zum Disq.** (gegen U3): „Ja“ – bauen.
  **Umgesetzt 22.11.2026** (Scheibe 3, plan-antworten-runde7-8.md §4.1): Ein Druck ab 800 ms auf einen Bojen-Knopf
  öffnet die Disq.-Buchstaben DIESER Boje (Ortswahl gleich im zweiten Schritt); der Tipp zählt beim Loslassen, ein
  Langdruck nie zusätzlich als Tipp; Abbruch ab 10 px Bewegung; Prellschutz unverändert; Ring als Rückmeldung,
  Vibration beim Auslösen; „Disq. an Boje …“ und DISQ im Fuß bleiben; die Probe nennt beide Wege
  (components/wkr/langdruck.ts). Auslegungen U3 (umgebaut), LD1–LD4 – noch zu bestätigen.
- 2026-11-22 · R7-45 · Übungstakt bestätigt (Y1: 2–6 s nach dem Abschicken, Beginn mit einem Start), **dazu**: „man
  muss auch in der Übung andere Klassen vorziehen können, damit man diese Klasse sehen kann.“ Die Übung braucht also
  einen Weg, eine bestimmte Klasse als nächsten Start zu holen (um ihre Maske zu sehen). **Umgesetzt 22.11.2026**
  (Scheibe 6, plan-antworten-runde7-8.md §7.1): „Mehr → Klasse vorziehen“ (am Tisch aufklappbar unter den offenen
  Nummern) mit den Klassen der Liste; wirkt einmal – der nächste gezeigte Start ist einer dieser Klasse (der nächste
  ihres Blocks, sonst ein erfundener mit neuer Nummer 21, 22 …), steht gerade keiner an, sofort; am Tisch springt der
  Vorschlag auf ihren ersten offenen (wkr/uebung.ts ziehVor, geraete/uebung.ts zieheKlasseVor). Y4 neu – noch zu
  bestätigen.
- 2026-11-22 · R7-51 · **Handeingaben je Klasse bleiben, Reset-Knopf** (gegen BS3): „Manuelle Anpassung soll
  berücksichtigt werden. Mit einem Reset-Knopf.“ Ändert man die Gesamtzahl, bleiben von Hand gesetzte Klassenzahlen
  stehen (verteilt wird nur der Rest); ein Reset-Knopf setzt alles auf die Verteilung zurück. **Umgesetzt 22.11.2026**
  (Scheibe 6, §7.2): gemerkt wird `hand` (von Hand gesetzte Klassen, markiert ✎); neue Gesamtzahl und „Vorschlag neu“
  verteilen nur die übrigen (domain/generate.ts verteileAufKlassen mit `fest`; Σ Hand > Gesamtzahl → übrige 0, die
  Summe zeigt die Abweichung); „Zurücksetzen“ (nur mit Hand-Zahlen) verteilt wieder über alle; Wechsel der Art
  verwirft wie bisher. BS3 umgebaut, BS4 neu – noch zu bestätigen.
- 2026-11-22 · R8-19 · **Parallelslalom-Bild aus dem Parcours-Repo** (gegen BD3 Schema): „Schau mal im Parcours-Repo,
  da sollte es einen Parcours für Parallel geben.“ Vor dem Umbau dort nach einer Parallel-Zeichnung suchen und sie
  (über `npm run parcours:sync`, Lizenz wie die übrigen) statt des Schemas nehmen; fehlt sie, bleibt das Schema.
  **Umgesetzt 22.11.2026** (Plan [plan-antworten-runde7-8.md](plan-antworten-runde7-8.md) §5): gefunden unter
  `dist/parallel/en/pontoon_bottom/ParallelSlalom.svg`, beim Sync von 493 KB auf 23 KB verkleinert
  (`src/assets/parcours/Parallel.svg`), IDs je Bahn über die Lage gesetzt (BD8), Racecourse A = vom Steg aus linke
  Bahn (BD9), fremde Bahn gedimmt ohne Treffer (BD10) – noch zu bestätigen, Frage: IDs im Parcours-Repo direkt
  vergeben? Überholt 23.11.2026 durch R9-05 bis R9-07 (unten): eine Bahn ohne Steg, IDs aus dem Parcours-Repo.
- 2026-11-22 · R8-20 · **Kein automatischer Wechsel des Bild-Umschalters** (gegen BD4): „Den automatischen Wechsel
  bitte wieder raus.“ Der erste Tipp an Tor 5 schaltet nicht mehr von selbst auf „Rückweg“. **Umgesetzt 22.11.2026**
  (Scheibe 3, §4.2): wkr/bild.ts wegNachTipp entfernt, der Umschalter des Bilds wechselt nur von Hand (BD4 umgebaut,
  noch zu bestätigen).
- 2026-11-22 · R8-23 · **Disq. im Bild auch mit langem Drücken** (zu BD7): „Wenn möglich, bitte auch langes Drücken
  unterstützen.“ Knopf „Disq. an Boje …“ bleibt, dazu langes Drücken auf eine Boje im Bild (wie R7-21).
  **Umgesetzt 22.11.2026** (Scheibe 3, §4.1): langer Druck auf einen Trefferkreis öffnet die Buchstaben dieser Boje,
  dieselbe Hilfe wie die Bojen-Knöpfe (BD7 umgebaut, LD1–LD4 – noch zu bestätigen).
- 2026-11-22 · R8-27 · **Knoten: nächste offene Nummer vorschlagen** (zu KN3): „Es soll aber der nächste offene laut
  Ablauf immer vorgeschlagen werden. Ich mache also gerade die 8, dann wird die 9 als nächster vorgeschlagen. Ich
  kann dann aber die 10 tippen und bekomme danach die 11 vorgeschlagen. Wenn ich dann die 9 tippe, dann wird die 11
  vorgeschlagen, weil die 10 schon war.“ Vorschlag = der nächste noch offene Starter nach dem zuletzt getippten in der
  Folge des Bestands; jede andere Nummer bleibt tippbar. **Umgesetzt 22.11.2026** (Scheibe 5,
  plan-antworten-runde7-8.md §6): wkr/tisch.ts naechsterOffener (Rundlauf; offen = weder in der Sicht erledigt noch
  selbst geschickt), „zuletzt“ = Startnummer der neuesten eigenen Zeile der Liste (gerätelokal im Kern); das leere
  Nummernfeld zeigt groß „Nächster: 9 (Klasse 2)“, Antippen übernimmt. KN3 umgebaut, KN9 neu – noch zu bestätigen;
  offene Frage: Folge des Bestands (Starter-Reiter, gebaut) oder Startfolge des Tages?
- 2026-11-22 · R8-31 · **Knoten: Hauptknopf „Alle richtig“** (zu KN7): „Ja, aber es soll auch einen Button ‚alle
  richtig‘ geben. Das kann, wie bei den anderen Listen auch, der große Button sein. Also statt ‚5 offen‘. So muss dann
  nur der falsche markiert werden.“ ✓/✗ je Knoten bleibt (✗ = 5); solange Knoten offen sind, heißt der Hauptknopf
  „Alle richtig“ und setzt die offenen auf ✓ (statt gesperrt „n offen“). **Umgesetzt 22.11.2026** (Scheibe 5, §6):
  „✓ Alle richtig“ (nichts gesetzt) bzw. „✓ Rest richtig · Σ n“ (teils gesetzt) setzt die offenen auf ✓ und schickt
  in einem Tipp ab, alle gesetzt: „Abschicken · Σ n“ (wkr/maske.ts restRichtig, fertig sobald Knoten da). KN7
  umgebaut, KN10 neu – noch zu bestätigen.
- 2026-11-22 · R8-32 · **Knoten: erfasste Nummer nur mit Rückfrage** (zu KN8): „Wenn schon erfasst wurde, dann immer
  nachfragen.“ Eine schon erfasste Nummer öffnet die Korrektur nicht direkt, sondern erst nach einer Rückfrage.
  **Umgesetzt 22.11.2026** (Scheibe 5, §6): „Nr. 23 ist schon erfasst – korrigieren?“ (Ja → Korrektur bzw. neue Zeile
  wie bisher, Nein → Feld leer, Vorschlag bleibt) – getippt, über den Vorschlag oder die Liste der offenen; die Frage
  steht in der Maske statt der Knoten (kein Dialog, damit „1“ → „12“ weitergetippt werden kann). KN8 umgebaut, KN11
  neu – noch zu bestätigen.
- 2026-11-22 · Prüfbefund zu R8-27/R8-31 · **Knoten: Vorschlag vorbelegt** (KN12): Der Vorschlag stand bisher als
  eigener Knopf im leeren Feld; erst ein Tipp darauf zeigte die Knoten – je fehlerfreiem Starter zwei Tipps. Jetzt gilt
  der Vorschlag bei leerem Feld als gewählt („Nr. 9“, Knoten und „✓ Alle richtig“ sofort), Eintippen ersetzt ihn.
  Ausgelegt nach den Worten „immer vorgeschlagen“ und „nur der falsche markiert“ – noch zu bestätigen.
- 2026-11-22 · R8-35 · **Zeit: Weiterspringen erlaubt, weitere Zeitfelder optional** (gegen ZT3): „Weiter springen
  ist okay, die anderen Zeiten sind optional.“ Nach einer gültigen Zeit darf der Ziffernblock ins nächste Zeitfeld
  springen; abschicken geht, ohne dass jedes weitere Zeitfeld gesetzt ist. **Umgesetzt 22.11.2026** (Scheibe 1,
  plan-antworten-runde7-8.md §2.2): Pflicht nur das erste Zeitfeld (ZT5, wkr/maske.ts zeitPflicht/zeitenOffen),
  Sprung, sobald die Zeit alle Stellen hat (ZT6, zeitVollstaendig: „83,45“, „1,2345“ – nicht schon „1,23“),
  ZT3 umgebaut; ein leeres weiteres Feld überschreibt nie eine Papierzeit (das Gerät schickt es nur als Korrektur
  einer eigenen Zeit). ZT5/ZT6 noch zu bestätigen.
- 2026-11-23 · N · **Maske „Bild“ ohne Titel und Namensnennung** (Nutzer, nach dem Test): „Bei der Bilder-Variante
  kann noch der Text und die Lizenzangabe von den Bildern weg. Das reicht, dass es bei den Einstellungen steht. Das
  nimmt kostbaren Platz weg.“ Wie 2026-11-16 (Vermerk unter „Fremde Bestandteile und Lizenzen“ genügt). Umgesetzt:
  kein Titel, keine Namensnennung unter WkrBild und WkrParcoursBild; auf dem Gerät (ohne Zugang zu den Einstellungen)
  steht die Zeile nur noch zugeklappt unter „Mehr“; --wkr-bild-rest 440 → 380 px, die Zeichnung wird entsprechend größer.

### Antworten 23.11.2026 (Runde 9)

Antworten des Nutzers auf die Fragenseite, Runde 9 (R9-01…R9-14: mehrere Disq. an einer Boje, langes Drücken,
Parallelslalom-Zeichnung, Knoten am Tisch, Zeit-Listen, Übung, Beispieldaten). R9-01 bis R9-04 und R9-08 bis R9-14 hat
er mit „passt“ bestätigt – in `WKR_ANNAHMEN` je Eintrag „Bestätigt 23.11.2026 (Frage)“: BZ1 (neue Fassung) und BZ6
(R9-01: Punkte zuerst, Buchstaben in Katalogfolge mit Komma), BZ7 (R9-02: Mehrfachwahl mit „Fertig“), U3, LD1, LD3 und
der Langdruck in BD7 (R9-03: ab 0,8 s, Ring ab 0,3 s, Abbruch ab 10 px), LD2, LD4 (R9-04: Tipp zählt beim Loslassen),
KN9 (R9-08: Folge des Starter-Reiters, nicht die Startfolge des Tages), KN7/KN10 und KN12 (R9-09: Vorschlag vorbelegt,
„Alle richtig“ schickt in einem Tipp ab), KN8/KN11 (R9-10: Rückfrage in der Maske), ZT3 und ZT5 (R9-11: nur das erste
Zeitfeld Pflicht), ZT6 (R9-12: Sprung bei vollständiger Zeit), Y4 (R9-13: „Klasse vorziehen“ wirkt einmal); BS3/BS4
in `components/BeispieldatenPanel.vue` und `domain/generate.ts` (R9-14: Hand-Zahlen bleiben, „Zurücksetzen“ nur mit
Hand-Zahlen). Anders entschieden hat er die drei Fragen zur Parallelslalom-Zeichnung:

- 2026-11-23 · R9-05 · **IDs im Parcours-Repository vergeben, nur eine Bahn** (gegen BD8, Zuordnung nach Lage): „Auf
  dem Parallel-Slalom-Parcours ist A und B dargestellt. Wir brauchen bei dem Bild in der App und auf den WKR-Listen nur
  einen von beiden. Bitte den Parcours auch unter ../parcours berichtigen und mit A und B in den IDs benennen.“
- 2026-11-23 · R9-06 · **Keine Zuordnung Racecourse ↔ Bahn der Zeichnung, ohne Steg** (gegen BD9 „A = obere Bahn“):
  „Für die Eintragung ist das eigentlich egal. Die Zeichnung ist eine schematische Darstellung und variiert von
  Standort zu Standort. Also was den Steg angeht und ob sie nebeneinander passen. Daher kommt auf den Listen und auf
  dem Gerät nur einer der zwei Parcours und ohne Steg.“
- 2026-11-23 · R9-07 · **Nur eine Bahn im Bild** (gegen BD10, ganze Zeichnung mit gedimmter fremder Bahn): „Nur eine
  Bahn.“

**Umgesetzt 23.11.2026:**

- Parcours-Repository (Commit a9c4275, eigener Schritt): `parallel.svg` trägt IDs je Bahn (`A_Boje1` … `A_Boje5`,
  `A_StartZiel_oben`/`_unten`, `A_StartZiel_Linie`, `A_Nummer_Boje<n>`, `A_Fahrlinie_hin`/`_rueck`, `A_Steg`,
  `A_Abmessung`, Bahn B ebenso mit `B_`; Tabelle in README.parallel.md); neue Ausgabe „eine Bahn ohne Steg“
  `dist/parallel/alcatraz_Parcours/ParallelSlalom.svg` (nur Bahn A mit Fahrlinien, ohne Steg, Logos, Titel, Maße,
  765 × 182). Die übrigen Ausgaben sehen unverändert aus.
- Scheibe 1 „App-Bild: eine Bahn“: `npm run parcours:sync` übernimmt diese Datei als `src/assets/parcours/Parallel.svg`
  (13 KB) ohne Umbenennen; lib/parcoursVertrag.ts prüft nur noch (PARALLEL_PFLICHT_IDS: Bojen 1–5, Start/Ziel
  oben/unten je genau einmal; keine zweite Bahn, kein Steg, keine Maße, kein Rasterbild; Lage im Bild) und bricht
  sonst mit einer Meldung ab, die die fehlende ID und ihre Herkunft nennt. Die Zuordnung nach Lage (parallelZuordnung)
  und der Zuschnitt in der App (PARALLEL_AUSSCHNITT) sind entfernt. Maske „Bild“: Racecourse A und B zeigen dieselbe
  eine Bahn mit denselben Treffern (`A_Boje<n>`, Start/Ziel seiteA = `A_StartZiel_unten`, seiteB = `_oben`), nichts
  gedimmt; welcher Racecourse, sagt die Liste (`aria-label`, `data-racecourse`). Das Schema (Rückfall ohne Datei) ist
  für A und B ebenfalls gleich (vorher B gespiegelt) – beim Bau ausgelegt, noch zu bestätigen. BD3 ergänzt, BD8–BD10
  umgeschrieben (Schalter jetzt `bildParallelIdsAusParcoursRepo`, `bildParallelEineBahnFuerBeide`,
  `bildParallelNurEineBahn`).
- Scheibe 2 „Parallel-WKR-Bögen mit der Zeichnung einer Bahn“ („… und auf den WKR-Listen nur einen von beiden“):
  Der Fahrweg-Bogen von Racecourse A und B trägt dieselbe Bahn wie das Gerät (lib/parallelBogen.ts
  PARALLEL_BOGEN_BILD über BogenAuftrag.bild, lib/bogen.ts), mit Namensnennung im Fuß und am Bildschirm unter den Bögen
  (auch in der Muster-Runde der Beispielansicht). Beim Bau ausgelegt, **noch zu bestätigen**: (a) nur der
  Fahrweg-Bogen – die Liste mit Bojen-Spalten –, Zeit und Steg ohne, wie im Manövrieren; (b) vorn rechts neben der
  Legende, höchstens so hoch wie sie (`.bogen--bild-streifen`), damit die Zeilen je Blatt, die Seitenzahlen und die
  Laufzettel-Kästchen bleiben (gemessen: Fuß 40,2 mm mit und ohne; darunter in voller Breite kostete sie rund acht
  Zeilen je Blatt) – 94 × 22 mm (Bojen 1,7 mm, Ziffern rund 4,5 pt); (c) mit „Beschreibung auf der Rückseite“
  dort unter der Legende in voller Breite. Nach einem Prüfbefund (23.11.2026) ist der Rahmen immer 100 mm breit:
  Zweisprachig blieben neben der 144 mm breiten Legende sonst nur 45 × 11 mm (Bojen 0,8 mm, nicht lesbar); jetzt
  bricht dort die Legende auf rund 91 mm um, die Zeichnung ist 98 × 23 mm groß und der Bogen fasst 24 statt 26 Zeilen
  je Blatt (einsprachig unverändert 31). Die Namensnennung im Fuß steht in der Sprache des Bogens (vorher in der der
  Oberfläche). Docs: [parallelslalom.md](parallelslalom.md) „WKR-Listen des Vorlaufs“.

### Antworten 24.11.2026 (Runde 10)

Antworten des Nutzers auf die Fragenseite, Runde 10 (R10-01…R10-07, Parallelslalom-Zeichnung nach dem Umbau aus
Runde 9): alle sieben mit „ja“ bestätigt, nichts umzubauen.

- 2026-11-24 · R10-01 · **IDs je Bahn**: obere Bahn „A“, untere „B“, jedes Teil mit dem Buchstaben vorn
  (`A_Boje1` … `A_Boje5`, `A_StartZiel_oben`/`_unten`, `A_Nummer_Boje<n>`, `A_Fahrlinie_hin`/`_rueck`, `A_Steg`,
  `A_Abmessung`; B ebenso), deutsche Namen wie bei den Klassen-Zeichnungen; Überschrift und Ablauftext ohne Buchstaben
  (`WKR_ANNAHMEN` BD8).
- 2026-11-24 · R10-02 · **Ausgabe „eine Bahn“**: ohne Steg, Maße, Überschrift, Ablauftext, Logos und Beschriftung, mit
  Fahrlinien; die App nutzt die Fassung mit Fahrlinien (BD8).
- 2026-11-24 · R10-03 · **Ordner und Veröffentlichung**: `dist/parallel/alcatraz_Parcours` im Parcours-Repository ist
  richtig; der Commit a9c4275 ist am 24.11.2026 auf GitHub gepusht (der Sync warnt nicht mehr).
- 2026-11-24 · R10-04 · **Dieselbe Zeichnung für A und B**, ohne Buchstaben im Bild; den Racecourse nennt nur die
  Überschrift der Liste bzw. der Kopf des Bogens; das Schema (Rückfall ohne Datei) ebenso für beide gleich (BD9, BD10).
- 2026-11-24 · R10-05 · **Nur der Fahrweg-Bogen** trägt die Zeichnung, Zeit und Steg nicht – in jeder Runde, auf A und
  B (lib/parallelBogen.ts `parallelListeMitBild`).
- 2026-11-24 · R10-06 · **Rechts neben der Legende**, höchstens so hoch wie sie, in einem 100 mm breiten Rahmen (rund
  94 × 22 mm, kostet einsprachig keine Zeile); mit „Beschreibung auf der Rückseite“ dort unter der Legende
  (`.bogen--bild-streifen` in styles/bogen.css).
- 2026-11-24 · R10-07 · **Zweisprachig bricht die Legende um**, damit die Zeichnung lesbar bleibt (98 × 23 mm); der
  Bogen fasst dann 24 statt 26 Zeilen je Blatt.

### Ausgleichsgewicht am Steg (Entscheidung 24.11.2026)

Nutzer: „Das Ausgleichgewicht wird nicht beim Steg gepflegt. Wenn jemand kein Gewicht hat, wird das später in der
Eingabemaske oder im Checkin später nachgetragen und bei einer Papierliste manuell nachgetragen. In den digitalen Listen
kommt das dann einfach mit rein.“ Löst die offene Frage aus F11 und §9 von
[vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) („kein Ausgleichsgewicht, eigene Entscheidung mit dem
Check-In E10“). Gebaut 24.11.2026 (`WKR_ANNAHMEN` AG1–AG4 in `src/wkr/annahmen.ts`):

- 2026-11-24 · AG1 · **Datenschutz-Ausnahme**: Die Sicht der Steg-Liste trägt je Start das Ausgleichsgewicht
  (`ListenStart.ausgleich`, Fassung 11 der Listen-Sicht) – nur in der verschlüsselten Gruppe der Steg-Liste, nie
  Körper- oder Durchschnittsgewicht, nie auf Anzeigetafel, Zuschauerliste oder Start-Freigabe. Der Datenschutz so
  reicht (bestätigt 26.11.2026, R11-06): dieselbe gerundete Zahl wie auf Papier, eine Gruppe je Liste.
- 2026-11-24 · AG2 · **Nicht am Steg gepflegt**: keine Eingabe und kein Haken am Steg (auch kein „Gewicht geladen“,
  bestätigt 26.11.2026, R11-29 (3)). Fehlt das Gewicht, wird es in
  der Verwiegung nachgetragen (später beim Check-in) und kommt mit der nächsten Sicht von selbst aufs Gerät; auf der
  Papierliste „Ausgleichsgewichte“ bleibt dafür ein Feld zum Eintragen von Hand (klein „nicht gewogen“, rechts „kg“).
  Gerechnet wird an einer Stelle (`src/lib/ausgleich.ts`): ganze kg, 0 = keines nötig, „fehlt“ = nicht gewogen; ohne
  Durchschnittsgewicht der Klasse steht nichts.
- 2026-11-24 · AG3 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-05): Die Starterkarte zeigt es neben der Startnummer nur im
  Teil „Ablegen“ („AG 4 kg“, „kein AG“, „AG: Gewicht fehlt“; englisch „Extra weight 4 kg“) – auch auf dem Gerät für den
  ganzen Steg im Reiter „Ablegen“ –, im „Anlegen“ nicht und nicht in der Schlange auf der Seite des Pads.
- 2026-11-24 · AG4 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-30 (6)): Die Übung zeigt am Steg erfundene Werte (reihum
  „AG n kg“, „kein AG“, „Gewicht fehlt“), wenn das Regelwerk Durchschnittsgewichte kennt.
- 2026-11-24 · Prüfbefund, bestätigt 26.11.2026 (R11-29 (5)): Auf 0 kg gerundet (weniger als 0,5 kg leichter, z. B. 64,6 kg in einer
  Klasse mit 65 kg) gilt am Steg wie „keines nötig“ – das Gerät zeigt „kein AG“, die Papierliste lässt das Feld leer
  (vorher druckte sie „0 kg“, ein zweiter Text für denselben Starter). Die Verwiegung zeigt weiter „0 kg“.
- 2026-11-24 · Prüfbefund: Ein Gerät nur für „Anlegen“ empfängt das Ausgleichsgewicht verschlüsselt mit (die Sicht
  ist ein Inhalt je Liste, eine Gruppe je Steg-Teil gibt es nicht), zeigt es aber nicht – so bestätigt 26.11.2026
  (R11-06).
- 2026-11-24 · N · **Abstufung und Rundung** (Nutzer: „kannst du noch einstellbar machen, wie kleinteilig die
  Zusatzgewichte sind. Vielleicht haben einige halbe Kilos und bei anderen ist 2 kg das kleinste.“ und „Runden bitte
  nach den üblichen Mathe-Regeln. Kein grundsätzliches Aufrunden.“): Einstellung der Veranstaltung „Ausgleichsgewicht
  in Stufen von“ bei den Durchschnittsgewichten – 0,1 / 0,5 / 1 / 2 kg oder ein eigener Wert (0,1–10 kg, Komma erlaubt).
  Das Ausgleichsgewicht ist ein Vielfaches der Stufe, gerundet auf die nächste Stufe, genau in der Mitte aufwärts
  (Stufe 2 kg: 0,9 → 0, 1,0 → 2, 2,9 → 2, 3,0 → 4; Stufe 0,5 kg: 1,2 → 1,0, 1,25 → 1,5). Vorgabe 1 kg = wie vorher
  (ganze kg, ab ,5 aufwärts – aufgerundet wurde auch vorher nie grundsätzlich). Eine Rundung für alle Stellen
  (`src/domain/gewicht.ts` `rundeAufStufe`, in Gramm gerechnet, über `src/lib/ausgleich.ts` `ausgleichVon`): Liste
  „Ausgleichsgewichte“, Liste nach Regel 960 Pkt. 3.7, Verwiegung, Steg-Gerät; Beispielgewichte sind mindestens eine
  halbe Stufe leichter, damit wirklich ein Ausgleichsgewicht entsteht. Auf 0 gerundet bleibt „keines“ (Papier leer,
  Gerät „kein AG“, Verwiegung „0 kg“). Zahlen mit Nachkommastelle mit dem Dezimalzeichen der Sprache („1,5 kg“,
  englisch „1.5 kg“); die Sicht der Steg-Liste behält ihre Form (Fassung 11 zeigt sie schon richtig). Reist in Sicherung
  und Vorlage.
- 2026-11-24 · Beim Bau ausgelegt, bestätigt 27.11.2026 (R13-14 (2)): Die Beschriftung heißt nach dem Reglement
  „Ausgleichsgewicht in Stufen von“ (Hinweis: „das kleinste Gewichtsstück, das am Steg ins Boot gelegt wird“), nicht
  „Kleinstes Zusatzgewicht“ – „Zusatzgewicht“ steht seit 14.11.2026 nicht in der Oberfläche. Bestätigt 26.11.2026: Ein eigener
  Wert gilt auf 10 g genau (0,25 kg geht; 0,125 wird 0,13; R11-29 (6)). Die Übung auf dem Gerät rechnet immer mit
  1 kg (sie kennt keine Veranstaltung; R11-30 (6)). Mit 0,1 kg verrät das Ausgleichsgewicht auf dem Steg-Gerät das
  Körpergewicht eines leichten Starters auf 0,1 kg genau (AG1: vorher auf 1 kg) – das Gerät zeigt trotzdem dieselbe
  Zahl wie die Papierliste (R11-06).
- 2026-11-24 · Prüfbefund, bestätigt 26.11.2026 (R11-29 (5)): Auch die Liste nach Regel 960 Pkt. 3.7 (Spalte „Ballast required“)
  schreibt ein auf 0 gerundetes Ausgleichsgewicht wie „keines nötig“ als „–“, nicht „0 kg“ daneben – mit einer groben
  Stufe (2 kg: jeder, der weniger als 1 kg leichter ist) käme das sonst oft vor. Die Verwiegung bleibt bei „0 kg“.
- 2026-11-24 · Prüfbefund: Die Hinweise zum Gerätebetrieb („Betrieb → Geräte“ und Einstellungen → Geräte) nennen die
  Ausnahme AG1 jetzt ausdrücklich: Die Steg-Liste bekommt je Starter das Ausgleichsgewicht; bei einem leichteren
  Starter lässt sich daraus das Körpergewicht ungefähr zurückrechnen (so genau wie die Stufe).
- 2026-11-26 · R/N · R11-07 **Ersatz-Co-Pilot und Ausgleichsgewicht der Co-Piloten** (DM-Reglement C3: „Bei wechselnden
  Co-Piloten innerhalb einer Klasse ist durch Ausgleichsgewichte sicherzustellen, dass das Gesamtgewicht in der
  jeweiligen Klasse und jedem Lauf gleich ist.“; Nutzer: „sollte am besten gleich bei der Co-Piloten-Konfiguration mit
  abgefragt werden. Da soll man dann pro Klasse auch einen Ersatz-Co-Piloten eintragen. Jeder Co-Pilot kann dann
  optional auch ein Gewicht eingetragen bekommen. Dann steht zur Wahl, ob das Ausgleichsgewicht über alle Co-Piloten
  zählt oder nur pro Klasse. […] Beide Co-Piloten stehen untereinander auf den Listen, damit beim Steg klar ist, wer die
  Alternative ist.“). Block „Besetzung“ je Klasse: Co-Pilot, Gewicht, Ersatz-Co-Pilot, Gewicht (Gewicht gelesen wie in
  der Verwiegung), daneben das Ausgleichsgewicht, das daraus folgt. Einstellung „Ausgleichsgewicht der Co-Piloten“ bei
  den Durchschnittsgewichten: je Klasse (Vorgabe, so steht es in C3) oder über alle Co-Piloten. Bezug = schwerster
  gewogener Co-Pilot der Klasse bzw. der Veranstaltung; Ausgleichsgewicht = Bezug − eigenes Gewicht, mit derselben
  Abstufung und Rundung wie beim Fahrer (`lib/ausgleich.ts` ausgleichAufStufe/coPilotAusgleichVon), getrennt vom
  Ausgleich des Fahrers. Listen: Kopf der „Ausgleichsgewichte“ und Spalte „Co-driver“ der Liste nach Regel 960
  Pkt. 3.7 – der Co-Pilot, darunter benannt der Ersatz, je mit „(+3,5 kg)“ bzw. „(nicht gewogen)“ hinter dem Namen; nie
  das Körpergewicht. Namen und Gewichte nur in der Sicherung (nie Vorlage, Anzeigetafel, Zuschauerliste,
  Start-Freigabe oder Geräte-Sicht – seit 27.11.2026 mit einer Ausnahme: Namen und Ausgleichsgewicht in der Sicht der
  Steg-Liste, Eintrag „Steg-Gerät mit Boot und Co-Piloten“ unten), die Wahl reist als Einstellung mit. Beispiel-Co-Piloten bringen Ersatz und
  Gewichte (55–95 kg) mit. R11-05/R11-06 bestätigt. Beim Bau ausgelegt, bestätigt 27.11.2026: wer kein Gewicht hat,
  zählt für den Bezug nicht – „nicht gewogen“ nur, wenn andere seiner Gruppe gewogen sind (R12-06); „über alle“ zählt
  die Klassen mit Startern und die eigene, vor der ersten Meldung alle Klassen der Besetzung (Prüfbefund 27.11.2026,
  nächster Eintrag; R12-07); die Wahl steht in den Einstellungen, der Block „Besetzung“ nennt sie und verweist hin
  (R12-08); auf den WKR-Bögen und dem Steg-Gerät stehen weiter keine Co-Piloten (R12-09; für das Steg-Gerät
  überholt am 27.11.2026, Eintrag „Steg-Gerät mit Boot und Co-Piloten“ unten); der Ersatz steht auch auf
  der Liste nach Pkt. 3.7, obwohl Pkt. 2 „the same co-driver“ verlangt (R12-10).
  → AppState.coPiloten (`CoPiloten`: je Klasse `haupt`/`ersatz` mit `name`, `gewicht`), AppState.coPilotAusgleich,
  `lib/besetzung.ts`, `lib/ausgleich.ts`, `components/BesetzungPanel.vue`, `components/AusgleichListen.vue`,
  `components/TeamListen.vue`, Sprungziel `?durchschnittsgewichte`
- 2026-11-27 · Prüfbefund · R11-07 **Co-Piloten: wer zählt** (`lib/ausgleich.ts` ausgleichsKlassen/benannt):
  „über alle Co-Piloten“ zählt nur die Klassen, in denen Starter stehen (dazu die eigene Klasse; ohne jeden Starter
  alle Klassen der Besetzung) – vorher zog z. B. ein Beispiel-Co-Pilot einer Klasse ohne Starter den Bezug hoch und
  die Steg-Liste zeigte zu viel Ballast. Ein Co-Pilot ohne Namen zählt nicht: Wird der Name eines Ersatzes gelöscht,
  bleibt sein Gewicht stehen (beim Neutippen geht es nicht verloren), zählt aber weder als Bezug noch steht ein leeres
  Feld „Ersatz-Co-Pilot“ auf den Listen; der Block „Besetzung“ sagt daneben „zählt erst mit Namen“. Liste nach
  Pkt. 3.7: „Substitute co-driver:“ klein davor und die Schriftgröße je Zeile, ohne die Vorsilbe gemessen – ein
  Ersatz verkleinert den eingeteilten Co-Piloten nicht mehr mit. Beide Auslegungen bestätigt 27.11.2026 (R12-06,
  R12-07).
- 2026-11-27 · N · **Steg-Gerät mit Boot und Co-Piloten** (Nutzer, Bildschirmfoto der Übung am Steg mit den Karten
  „Ablegen“ und „Anlegen“, Pfeile auf den freien Platz in beiden Karten: „Hier beim Steg bitte noch das Boot und ggf.
  die Co-Piloten mit anzeigen“). Damit gilt R12-09 („WKR-Bögen und Steg-Gerät ohne Co-Piloten“) für das Steg-Gerät
  nicht mehr; die WKR-Bögen auf Papier bleiben ohne Co-Piloten (Frage für die nächste Runde, „Offen“). Gebaut
  27.11.2026 (`WKR_ANNAHMEN` CP1–CP10 in `src/wkr/annahmen.ts`): Die Sicht der Steg-Liste trägt je Klasse die
  Co-Piloten mit Namen (`ListenSicht.coPiloten`, Fassung 14) – zweite Datenschutz-Ausnahme neben AG1, nur in der
  verschlüsselten Gruppe der Steg-Liste, nie an anderen Listen, auf Anzeigetafel, Zuschauerliste oder Start-Freigabe,
  Namen nur aus der Besetzung, nie aus der Starterliste und nie am Start (ist ein Co-Pilot selbst Starter, geht sein
  Name als Co-Pilot trotzdem hinaus – Prüfbefund 27.11.2026), nie ein Körpergewicht; die Hinweise zum Gerätebetrieb
  nennen sie. Das Ausgleichsgewicht
  eines Co-Piloten rechnet dieselbe Stelle wie die Papierliste (`lib/ausgleich.ts` coPilotenAmSteg über coPilotZeilen,
  Gruppe nach „Ausgleichsgewicht der Co-Piloten“, gerundet auf die Stufe). Das Boot stand im Ernstfall schon auf der
  Karte; die Übung bekommt erfundene Boote und – am Steg – erfundene Co-Piloten. Beim Bau ausgelegt, vom Nutzer zu
  bestätigen:
  - CP1: nur die Steg-Liste (nicht der Vorsteg).
  - CP2: einmal je Klasse in der Sicht, nicht an jedem Start (kein Name doppelt auf der Leitung; die Karte kennt alle
    Klassen der Liste und kann Platz halten, CP7).
  - CP3: nur Personen mit Namen – anders als auf Papier, wo der eingeteilte Co-Pilot ein leeres Feld zum Eintragen
    bekommt; steht nur der Ersatz mit Namen, zeigt die Karte nur ihn.
  - CP4: das Ausgleichsgewicht eines Co-Piloten nur, wo das Papier eine Klammer druckt („(+3 kg)“, „(nicht gewogen)“);
    keines nötig bzw. auf 0 gerundet geht nicht auf die Leitung.
  - CP5: Boot und Co-Piloten in beiden Teilen, Folge auf der Karte: Klasse, Lauf, Ausgleichsgewicht des Starters, Boot,
    Co-Pilot, darunter kleiner „Ersatz …“ (englisch „Co-driver …“, „Substitute …“); nicht in der Schlange auf der Seite
    des Pads und nicht in der Probe. In der Korrektur eines Starts, der nicht mehr in der Schlange steht (typisch über
    „Zuletzt“), kennt die Karte Boot und Ausgleichsgewicht des Starters nicht – dann auch keine Klammer der Co-Piloten,
    nur die Namen (Prüfbefund 27.11.2026: sonst stand die Last des Co-Piloten da, die des Starters nicht).
  - CP6: die Klammer eines Co-Piloten nur im „Ablegen“ – wie das Ausgleichsgewicht des Starters (AG3): Dort kommt das
    Gewicht ins Boot; beim Anlegen genügt, wer im Boot sitzt.
  - CP7: Die Co-Piloten stehen in einer eigenen Zeile über die ganze Breite der Karte (nicht in der Spalte neben der
    Nummer); ihr Platz ist so hoch wie der höchste Block der Liste (die Blöcke der anderen Klassen liegen unsichtbar
    darunter), auch in Klassen ohne Co-Piloten – die Knöpfe darunter springen beim Klassenwechsel nicht, auch wenn ein
    langer Name umbricht. Die Klammer bricht nie in sich um. Prüfbefund 27.11.2026 (umgebaut): Vorher zählte der Platz
    nur Einträge; in der schmalen Spalte brachen auf dem Handy schon gewöhnliche Namen um, die Knöpfe sprangen 21–25 px.
  - CP8: Übung: Boot je Klasse fest aus den Beispiel-Bootsnamen an jeder Liste (wie im Ernstfall), Co-Piloten nur am
    Steg in den Klassen mit Co-Pilot laut Regelwerk, Namen aus den Beispielnamen, reihum mit und ohne Ersatz und mit
    Klammern „(+6 kg)“, „(+8 kg)“, „(nicht gewogen)“.
  - CP9: Fassung der Listen-Sicht 14 – Prüfbefund 27.11.2026: Die neue `lv` allein lädt ein Gerät mit altem Programm
    nicht neu (es verwarf die Sicht still, die Liste stand); nur die äußere Fassung `sv` tut das. Deshalb zählt `sv`
    mit auf 9 (Tafel und Zuschauer laden einmal neu), und jede künftige `lv` hebt `sv` mit an. Dasselbe galt schon
    für `lv` 10 (BZ8) und 13 (NG8) – dort stand fälschlich „lädt über F7 neu“.
  - CP10: Die Einstellung „Namen“ der Anzeigetafel gilt für die Co-Piloten am Steg nicht – sie stehen vollständig, wie
    in der Besetzung eingetragen, auch bei „Namen: ohne“; die Hinweise vor dem Einschalten sagen das (Prüfbefund
    27.11.2026; Frage unter „Offen“).
  → `src/wkr/sicht.ts` coPilotenJeKlasse, `src/wkr/uebung.ts` uebungsBoot/uebungsCoPiloten,
  `src/components/wkr/WkrStarterKarte.vue`, `WkrMaske.vue` kartenCoPiloten/kartenCoPilotPlatz, `betrieb/sicht.ts`
  SICHT_FASSUNG 9

### Maske „Knöpfe“: Höchstzahl je Code, Disq. nach dem 3. Versuch (Entscheidung 24.11.2026)

Nutzer: „Wenn man bei den 2. und 3. Versuch drauf klickt, dann sollte der dritte Klick der passende Disquali werden.“
und zu „nicht mit gesamter Länge eingefahren ×62“: „Das hier macht auch kein Sinn.“ Gebaut 24.11.2026 (`WKR_ANNAHMEN`
CM1–CM8 in `src/wkr/annahmen.ts`; Regelwerk-YAML `max`/`danach` je Code):

- 2026-11-24 · CM1 · **Höchstzahl je Code im Regelwerk**: „2. und 3. Versuch des Elementes“ (DM und UIM: 6
  Steg-Ablegen, 7 Steg-Anlegen, 20 Tor 5, 19 MüB) höchstens 2×, Tor 5 Code 1 („nicht mit gesamter Länge eingefahren“)
  höchstens 1×. Am Höchstwert nimmt der Knopf nichts mehr an und sagt es im Knopf („höchstens 1×“, CM4 – nicht
  ausgegraut, kein Band; bestätigt 27.11.2026, R13-04 (a)).
- 2026-11-24 · CM3 · **Dritter Tipp = Disq. D**: Auf „2. und 3. Versuch“ setzt der dritte Tipp den Buchstaben D
  („4. Versuch eines Elementes“, UIM „4th attempt of the racecourse“) ins Disq.-Feld der Liste (am Steg das gemeinsame);
  der Zähler bleibt bei 2. Der Knopf zeigt vorher „nächster = Disq. D“, danach „Disq. D gesetzt“. „↶ Rückgängig“ nimmt
  D wieder heraus. Beim Bau ausgelegt, bestätigt 27.11.2026 (R13-04 (b)): Steht D schon (über DISQ), ändert der
  dritte Tipp nichts.
- 2026-11-24 · CM2 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-08): **allgemeine Grenze 3 je Lauf** für Codes ohne eigene
  Angabe (ein Element höchstens dreimal angefahren). Unsicher und gefragt: Stegberührungen (DM 3, 9; UIM 3, 9) und
  „Durchreißen der Schaltung“ (DM 2, 5, 10, 16) können in einem Versuch mehrmals vorkommen.
- 2026-11-24 · CM5 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-30 (1)): Dieselbe Grenze in der Maske „Tabelle“ (Fehler an der
  Zelle, „3x20“ wird nicht in „2x20“ + D umgewandelt) und am Bedienrechner für Zeilen vom Gerät (abgelehnt).
- 2026-11-24 · CM6 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-30 (1)): **Abtippen** lässt stehen, was auf dem Papier steht
  („3x6“), und zeigt einen Hinweis („Code 6 steht öfter als 2× … Disq. D?“) – gesetzt wird nichts.
- 2026-11-24 · CM8 · Prüfbefund, bestätigt 26.11.2026 (R11-09): **Ein Tipp setzt D, mit Prellschutz.** Der dritte Tipp setzt D
  sofort – anders als die Disq.-Knöpfe, die den Buchstaben erst mit dem zweiten Tipp setzen (K1), weil der Nutzer
  „der dritte Klick“ sagt. Damit ein prellender Handschuh kein D macht, verwirft der Knopf eines Codes mit `danach`
  einen Tipp, der weniger als 400 ms nach dem vorigen auf denselben Code kommt (wie der Prellschutz der
  Bojen-Schalter, S1) – beim Tipp, der D setzen würde, und bei den zählenden davor. Codes ohne `danach` zählen
  weiter jeden Tipp.
- 2026-11-24 · **Knöpfe umbenannt**: „− letzte zurück“ heißt „↶ Rückgängig“ (englisch „↶ Undo“), „← Andere Stelle“
  in der Disq.-Wahl an der Boje heißt „← Zurück“ („← Back“).
- 2026-11-26 · R11-08 · Bestätigt (CM2): allgemeine Grenze **3 je Lauf** für Codes ohne eigene Angabe, auch für
  Stegberührungen und „Durchreißen der Schaltung“.
- 2026-11-26 · R11-09 · Bestätigt (CM3, CM8): Der dritte Tipp auf „2. und 3. Versuch“ setzt Disq. D **sofort** (nicht
  erst vorgemerkt wie bei den Disq.-Knöpfen), ein zweiter Tipp auf denselben Code innerhalb von 0,4 s zählt nicht.
- 2026-11-26 · R11-30 (1) · Bestätigt (CM5, CM6): Ein Code öfter als erlaubt wird nirgends still umgewandelt – die
  Tabelle zeigt einen Fehler an der Zelle, das Abtippen lässt „3x6“ stehen und gibt einen Hinweis.
- 2026-11-26 · R11-30 (2) · Nutzer: „Der Pfeil bei 2 soll nach links und nicht nach unten zeigen.“ – **„↩ Rückgängig“**
  (englisch „↩ Undo“) im Fuß der Maske. Der Pfeil ist eine kleine Zeichnung vor dem Wort, kein Schriftzeichen: ↩
  steht in keiner Schrift der App (system-ui, Roboto, Segoe UI, Helvetica, Arial) und käme auf Handys als buntes Emoji.
  „Rückgängig“ in der Leiste „Zuletzt“ trug nie ein Zeichen und bleibt so (`WKR_ANNAHMEN` H2). Prüfbefund 27.11.2026:
  Pfeil und Wort stehen in EINEM Element – wird es eng (Handys von 360 bis 412 px), steht der Pfeil über dem Wort, und
  „Rückgängig“ bricht nie mehr mitten im Wort um (vorher „Rückgän|gig“ auf jeder Handybreite). Angeglichen 27.11.2026:
  „Rückgängig“ im Aufbau-Assistenten (Bojen im Bild zuordnen) trägt denselben gezeichneten Pfeil statt ↶ – bestätigt
  27.11.2026 (R12-18 (2)).

### Nicht gestartet statt nicht vorbeigekommen (Entscheidung 24.11.2026)

Nutzer: „‚Nicht vorbeigekommen Disq J‘ ist falsch. Das meint hier eher ‚Nicht gestartet Disq X‘.“ Auf Rückfrage: „Ein J
kommt, wenn der Starter seine Linie verlassen hat und zum Beispiel ein Tor ausgelassen hat. Hier kommt dann in eine
Boje von dem Tor ein J rein. Du hast diesen Punkt unter den Parcours als ganzes. Dort würde aber nur ein Nicht gestartet
mit einem X Sinn machen.“ Ersetzt W3-17 („nicht vorbeigekommen“ = Disq. J), das Kennzeichen ⊘ aus W4.3 (P16, R1–R8) und
GF10/GF11. Gebaut 24.11.2026 (`WKR_ANNAHMEN` NG1–NG8 in `src/wkr/annahmen.ts`):

- 2026-11-24 · N · **„Mehr → Nicht gestartet · Disq. X“** (englisch „Did not start · Disq. X“) für den gezeigten
  Start, mit großer Rückfrage „23 nicht gestartet?“: trägt X allein ins Disq.-Feld der Liste – auf jeder Liste mit
  Disq.-Feld beider Regelwerke (Tore und Parcours aller Aufbauten, Tor 5, MüB, Parallelslalom, Steg, Vorsteg); Zeit- und
  Knotenlisten haben keins. Am Bedienrechner gilt diese Zeile überall; X neben anderem bleibt nur am Steg-Ablegen und am
  Vorsteg (F5). Kein automatisches J mehr: J setzt der WKR an einer Boje des ausgelassenen Tors (Disq. an der Boje).
  Prüfbefund, bestätigt 27.11.2026 (R13-03): Die Zeitnahme bekommt den Punkt nicht – ihre Liste hat kein Disq.-Feld,
  und in das Feld einer anderen Liste (etwa Steg) darf kein Gerät schreiben; ebenso der Knoten am Tisch.
- 2026-11-24 · NG3 · Die Disq.-Knöpfe (auch an der Boje und in der Tabelle) bieten X weiter nur am Steg-Ablegen und am
  Vorsteg an – an Toren nur über „Mehr“.
- 2026-11-24 · NG4 · Ein X vom Gerät wirkt wie jedes X: Wertung „nicht gestartet“, Erfassung schraffiert, Start entfällt
  in der Folge, fällt aus jeder Schlange, Matrix ✕ auf allen Listen, Parcours-Ampel gilt als durch; keine Abmeldung (nur
  dieser Lauf). Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-10): Ein Gerät nur für „Steg-Anlegen“ setzt X ins gemeinsame
  Disq.-Feld wie das Ablegen. Prüfbefund: Hat das Ablegen dort schon einen Buchstaben gesetzt, kommt das X nicht still
  dazu („A, X“), sondern der Bedienrechner fragt (wie NG6).
- 2026-11-24 · NG5 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-30 (3)): Die Korrektur einer X-Zeile beginnt ohne X („doch
  gestartet“); Abschicken nimmt das X am Bedienrechner heraus. Prüfbefund: Ebenso „↶ Rückgängig“, solange die Zeile
  noch im Gerät wartet – der Start steht ohne X wieder da (vorher zeigte der Fuß „Disq. X“, abgeschickt kam aber
  „fehlerfrei“ an).
- 2026-11-24 · NG6 · Das Kennzeichen ⊘ ist ganz entfernt (Stand, Protokoll, Matrix, Verlauf, Abschluss-Nummern); ein
  alter Stand verliert es beim Laden. Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-12): Stehen am Bedienrechner schon Werte in
  anderen Zellen der Liste, kommt X ohne Rückfrage dazu; steht im Disq.-Feld schon etwas anderes, fragt er wie bisher –
  seit dem Prüfbefund auch am Steg im gemeinsamen Feld, in beide Richtungen: X kommt nie still neben einen anderen
  Buchstaben (BZ2); „Gerät übernehmen“ setzt dann den Wert des Geräts allein.
- 2026-11-24 · NG7/NG8 · Übung wie echt (ohne Beispiel-Rückfrage auf einer X-Zeile); Listen-Sicht Fassung 13 (ältere
  Geräte laden neu). Prüfbefund: Am Übungsgerät für den ganzen Steg erledigt eine X-Zeile im Ablegen auch das Anlegen
  (wie echt – der Start fällt aus jeder Schlange).
- 2026-11-26 · R11-10 · Bestätigt (NG4): Auch ein Gerät nur fürs Steg-Anlegen meldet „Nicht gestartet“; das X geht in
  die gemeinsame Disq.-Spalte der Steg-Liste.
- 2026-11-26 · R11-12 · Bestätigt (NG6): Werte in anderen Spalten der Liste → X kommt ohne Rückfrage dazu; ein anderer
  Buchstabe im Disq.-Feld (auch im gemeinsamen Feld am Steg, in beide Richtungen) → Rückfrage jedes Mal, „Gerät
  übernehmen“ setzt nur den Wert des Geräts.
- 2026-11-26 · R11-30 (3) · Bestätigt (NG5): Korrigieren einer X-Zeile und „Rückgängig“ einer noch nicht angekommenen
  X-Zeile beginnen ohne X; am Steg-Ablegen und am Vorsteg bleibt X im Entwurf (dort gibt es den Knopf).

### Übung und Ansicht der Maske: Kopf aus dem Bild, „Klasse vorziehen“ unten, Lage des Bilds (Entscheidung 24.11.2026)

Nutzer: „Bei dem Header ‚So läuft die Übung‘ und ‚ÜBUNG Tor X bla bla‘ soll beim Klicken auf ‚Fehlerfrei/weiter‘ aus dem
Screen rutschen, so dass der Block mit der Startnummer am Bildschirmrand ist.“ – „Klasse vorziehen kann unterhalb von
Übung verlassen, da es diese Einstellung normalerweise nicht gibt.“ – „Die Einstellungen mit Bojen (Rückweg gedreht,
Fahrtfolge, Alles untereinander) machen keinen Sinn, wenn man Bild ausgewählt hat. Dafür braucht Bild die Auswahl von
den 4 Parcours-Himmelsrichtungen.“ Gebaut 24.11.2026 (`WKR_ANNAHMEN` UK1–UK6, Y5, BL1–BL6 in `src/wkr/annahmen.ts`):

- 2026-11-24 · N · **Übung: Kopf aus dem Bild** – nach „Fehlerfrei“/„Abschicken“ (auch Enter der Tabelle, „Nicht
  gestartet“) rollt die Seite, bis „So läuft die Übung“, das Band „ÜBUNG“ und der Kopf oben hinaus sind; unter dem
  Overlay, mit der nächsten Karte noch einmal ausgerichtet (UK5), ohne Gleiten bei „Bewegung reduzieren“. UK1 beim Bau ausgelegt,
  noch zu bestätigen: nur in der Übung – die echte Maske trägt im Kopf Verbindung, „Keine Bestätigung“ und „Bitte Nr.
  prüfen“. UK2: nicht auf dem Pad mit mehreren Spalten (die Seite rollt für alle zugleich). UK3: Ziel ist das erste
  Element nach dem Kopf – „Zuletzt“ mit „↶ Rückgängig“ und Rückfrage-Bänder bleiben über der Karte sichtbar.
- 2026-11-24 · Y5 · **„Klasse vorziehen“ ganz unten**: in „Mehr“ unter „Probe · Übung verlassen“; am Tisch (Prüfliste
  ohne „Mehr“) unter dem Hauptknopf, direkt über „Übung beenden“ – beim Bau ausgelegt, bestätigt 26.11.2026
  (R11-30 (7)).
- 2026-11-24 · BL1 · **Bojen-Folge nur bei Bojen-Knöpfen**: nicht bei „Bild“ und nicht bei der Tabelle. Bei „Bild“
  steht unter „Mehr → Ansicht“ die **Lage der Zeichnung** mit vier Knöpfen (seit dem Prüfbefund davor „Automatisch“,
  unten); ein Satz nennt, wo Start/Ziel und Tor 5 dann liegen.
- 2026-11-24 · BL2 · Beim Bau ausgelegt, noch zu bestätigen: Die Klassen-Zeichnungen sind die Variante „Steg unten“ des
  Parcours-Repositorys ohne Steg (Start/Ziel links, Tor 5 rechts). Gedreht im Uhrzeigersinn: „Steg unten“ 0° (die
  Zeichnung wie bisher), „Steg links“ 90° (Start/Ziel oben), „Steg oben“ 180° (Start/Ziel rechts), „Steg rechts“ 270°
  (Start/Ziel unten) – eine Drehung, keine Spiegelung. Die Parallel-Zeichnung hat keinen Steg (R9-06): dort heißen
  dieselben Drehungen „Start links/oben/rechts/unten“.
- 2026-11-24 · BL3 · Beim Bau ausgelegt, bestätigt 26.11.2026 (R11-30 (4)): Die Wahl gilt genau so auf Handy und Pad, unabhängig vom
  Platz (vor Blick-Drehung und bildDrehungNachPlatz); ohne Wahl bleibt die Zeichnung wie bisher. Gemerkt je Gerät und
  Liste wie die Bojen-Folge (bleibt nach „Raum verlassen“), gilt im Gerät, in der Übung und in der Probe am Bild.
- 2026-11-24 · BL4/BL5 · Ziffern und Text der Zeichnung bleiben aufrecht (Gegendrehung je Text um seine Mitte –
  sonst läse sich die „6“ der Schikane bei 180° als „9“); die Trefferkreise drehen mit – bestätigt 27.11.2026
  (R13-14 (4)). Das Schema (Rückfall ohne Parallel.svg) dreht nicht und bietet keine Lage an (BL5, nicht gefragt).
- 2026-11-27 · N · BL8 · Nutzer (Bildschirmfoto Klasse E hochkant): „Warum hast du den Text hier drin, wenn der
  Parcours im Hochformat ist?“ – Die Zeichnungen sind quer angelegt; um ±90° gedreht legten sich Titel und
  Fahrweg-Beschreibung (aufrecht nach BL4) quer über den Parcours. **Hochkant nur die Ziffern an den Bojen**, alle
  übrigen Texte der Zeichnung (Titel, Beschreibung, „Tempo - Runde“, „Möwe-Parcour“) ausgeblendet; quer (0°, 180°)
  bleibt alles. Beim Bau ausgelegt (zu bestätigen): auch „Tempo - Runde“ fällt hochkant weg. → `wkr/bild.ts`
  nurBojenZiffern, `WKR_ANNAHMEN.bildHochkantNurZiffern`, Test `wkr/bild.test.ts` „BL8“
- 2026-11-24 · Prüfbefunde (UK4–UK6, BL1, BL6) – UK4, BL1 und BL6 bestätigt 26.11.2026 (R11-30 (4), (5), (8)), UK5
  und UK6 (in der Fassung von UK7) bestätigt 27.11.2026 (R12-17):
  - UK5: Im echten Übungstakt (nächster Start 2–6 s nach dem Abschicken) richtete sich die Seite nur bis zum Ende des
    Overlays aus und sprang danach zurück. Jetzt wird noch einmal ausgerichtet, sobald die nächste Karte steht; bis
    dahin hält die Maske ihre Höhe vom Abschicken.
  - UK4: Pad mit einer Spalte und Seitenspalte rechts – gerollt wird nur bis zur Oberkante der Maske (die Erklärung
    geht hinaus, der Kopf mit „ÜBUNG“ bleibt), sonst ginge der Anfang der Seitenspalte („Schlange“) mit hinaus.
  - UK6: Am Tisch (Knoten-Prüfliste) rollen Erklärung und Kopf nach „Alle richtig“/„Abschicken“ ebenso hinaus. Y5 dort
    mit Test der Lage (unter dem Fuß).
  - BL1: Unter „Lage der Zeichnung“ steht vorn „Automatisch“ – der Weg zurück zu „keine Wahl“ (Lage nach Bogen und
    Platz); ohne Wahl ist „Automatisch“ gedrückt (vorher die wirksame Lage, ohne Rückweg).
  - BL6: Beim Bild zeigt DISQ im Fuß die Ortswahl „Disq. – an welcher Boje?“ immer in der Vorgabe „Rückweg gedreht“,
    nicht in einer früher bei den Knöpfen gewählten Folge, die beim Bild weder zu sehen noch zu ändern ist.
- 2026-11-26 · R11-14 · **Der Kopf der Maske rollt nicht mehr hinaus, auch nicht in der Übung.** Gefragt, ob er auch am
  Wettkampftag hinausrollen soll (dort stehen im Kopf „Keine Bestätigung“ und „Bitte Nr. prüfen“), Nutzer: „Oh, dann
  besser wieder raus damit. Ich dachte, es ist eine extra Zeile.“ Ersetzt UK1 und UK3. Neu UK7: In der Übung rollt nach
  dem Abschicken nur die Erklärung „So läuft die Übung“ oben hinaus, der Kopf mit „ÜBUNG“ steht am oberen Rand, darunter
  „Zuletzt“ und die Karte; UK5 (Ausrichten mit der nächsten Karte) und UK6 (am Tisch ebenso) gelten weiter. Beim Bau
  ausgelegt, bestätigt 27.11.2026 (R12-17): rollen statt die Erklärung nach dem ersten Abschicken zuzuklappen
  (zugeklappt bliebe die Zeile „So läuft die Übung ▸“ über dem Kopf stehen, und die Maske spränge einmal sichtbar
  hoch). Prüfbefund 27.11.2026: Der Hinweis „Bildschirm kann ausgehen“ stand über der Erklärung und rollte mit hinaus;
  er steht jetzt unter ihr und bleibt als Warnung über dem Kopf stehen (mit „Ausblenden“ weg) – bestätigt 27.11.2026
  (R12-17).
- 2026-11-26 · R11-13 · **Lage der Zeichnung nach Start/Ziel benannt.** Nutzer zu „Steg unten/links/oben/rechts“: „Nein,
  Steg ist hier irreführend. Der steht immer anders.“ Ersetzt BL2. Neu BL7: „Start/Ziel links“ (0°, die Zeichnung wie
  bisher), „Start/Ziel oben“ (90° im Uhrzeigersinn), „Start/Ziel rechts“ (180°), „Start/Ziel unten“ (270°), davor
  „Automatisch“; der Satz darunter nennt Start/Ziel und Tor 5 („Start/Ziel oben, Tor 5 unten.“). Parallelslalom wie
  bisher „Start links/oben/rechts/unten“ mit Boje 5. Geprüft an allen Klassen-Zeichnungen und an Parallel.svg: In der
  Datei liegt Start/Ziel links, Tor 5 bzw. Boje 5 rechts. Eine schon gemerkte Lage bleibt gültig (gespeichert ist die
  Drehung; früher „Steg links“ heißt jetzt „Start/Ziel oben“ und zeigt dasselbe Bild). Bestätigt 27.11.2026
  (R12-18 (1)): Klassen „Start/Ziel …“, Parallelslalom weiter kurz „Start …“.
- 2026-11-26 · R11-30 (4)–(8) · Bestätigt: „Automatisch“ vorn unter „Lage der Zeichnung“, eine gewählte Lage gilt genau
  so auf Handy und Pad, gemerkt je Gerät und Liste (BL1, BL3); beim Bild zeigt „Disq. – an welcher Boje?“ immer die
  Vorgabe „Rückweg gedreht“ (BL6); die Steg-Übung zeigt reihum erfundene Ausgleichsgewichte in ganzen kg (AG4); „Klasse
  vorziehen“ ganz unten, am Tisch direkt über „Übung beenden“ (Y5); auf dem Pad mit mehreren Listen nebeneinander rollt
  nichts, mit einer Liste und Seitenspalte bleibt der Kopf (UK2, UK4).

### Antworten 26.11.2026 (Runde 11)

Antworten des Nutzers auf die Fragenseite, Runde 11 (R11-01…R11-30: Geburtstags-Warnung, gemeinsame WKR-Bögen,
Ausgleichsgewicht am Steg, Fehlercodes und Disq. D, „Nicht gestartet · Disq. X“, Lage der Zeichnung, Übung,
Gerätebetrieb, Finals, Stichentscheid der Einzelwertung, Tests, Kleinigkeiten). 23 Fragen hat er mit „Passt“
beantwortet – das Gebaute gilt –, dazu R11-30 bis auf Punkt 2. Anders entschieden hat er R11-02, R11-03, R11-07,
R11-11, R11-13, R11-14 und R11-30 (2); die sind umgebaut, ihre Einträge stehen in den Abschnitten oben. Im Code steht an
jeder bestätigten Auslegung „Bestätigt 26.11.2026 (R11-xx)“.

**Bestätigt:**

- R11-01 · „Bis zum 27. Geburtstag“ = am 27. Geburtstag selbst nicht mehr. → `import/klassenPruefung.ts`,
  `dm-2026.yaml` `geburtstagsGrenzen`
- R11-04 · Gemeinsame Bögen „nach der Verzahnung“: je Seite einfache Leerzeilen (Vorgabe 3) ohne Überschrift, mit
  leerer Klassenzelle; mit „Versuche direkt nacheinander“ füllt eine Nachmeldung zwei. → `lib/bogen.ts`
  leerzeilenJeSeite
- R11-05 · Ausgleichsgewicht auf dem Steg-Gerät nur auf der Karte im Teil „Ablegen“, nicht im „Anlegen“ und nicht in
  der Liste der nächsten Starts (AG3).
- R11-06 · Datenschutz beim Ausgleichsgewicht reicht: dieselbe gerundete Zahl wie auf Papier bei jeder Stufe; eine
  verschlüsselte Gruppe je Liste, ein Gerät nur fürs Anlegen empfängt den Wert und zeigt ihn nicht (AG1, AG3).
- R11-08 · Allgemeine Grenze 3 je Lauf, auch für Stegberührungen und „Durchreißen der Schaltung“ (CM2).
- R11-09 · Der dritte Tipp auf „2. und 3. Versuch“ setzt Disq. D sofort; ein Tipp auf denselben Code binnen 0,4 s
  zählt nicht (CM3, CM8).
- R11-10 · Auch ein Gerät nur fürs Steg-Anlegen meldet „Nicht gestartet“; das X geht ins gemeinsame Disq.-Feld (NG4).
- R11-12 · Werte in anderen Spalten → X kommt ohne Rückfrage dazu; ein anderer Buchstabe im Disq.-Feld (auch am Steg,
  in beide Richtungen) → Rückfrage jedes Mal (NG6).
- R11-15 · Anzeigetafel- und Zuschauer-Link getrennt verschlüsselt, jeder bekommt nur, was er zeigt; erneuern lässt
  sich nur der Zuschauer-Link (`BETRIEB_ANNAHMEN` lesenJeLink).
- R11-16 · Uhrversatz nur aus frisch empfangenen Nachrichten (größter Wert der letzten 20), bis dahin die Uhr des
  Geräts (uhrversatzFrisch).
- R11-17 · Nur „Raum beenden“ beendet den Raum; eine andere Veranstaltung trennt nur, ein anderer Server führt zu einer
  Meldung; ohne Netz beendet der Bedienrechner nach höchstens 8 s ohne Meldung, die Geräte löschen nach 36 h
  (raumEnde).
- R11-18 · „Gleiche Fassung“ = gleiche Form der Nachrichten: Bedienrechner neuer → das Gerät aktualisiert sich (je
  Fassung höchstens einmal in 10 min), älter → „Bedienrechner aktualisieren“ (fassungGleich, leseLinkOberflaeche).
- R11-19 · Der Lese-Link bleibt in der Adresse, „Raum verlassen“ nimmt ihn heraus; die Leiste über der Anzeigetafel
  nur bei Maus/Berührung und bei einer Störung, unter der Zuschauerliste immer; Erneuern und Beenden fragen nach,
  Einschalten nicht (leseLinkOberflaeche, `GeraetApp.vue`).
- R11-20 · „Unverändert“ nach einem Wechsel des führenden Fensters: gelöst nur über den Wortlaut „Nichts geändert –
  schon geschehen oder jemand anderes war schneller. Bitte die Anzeige prüfen.“ (koppelnOberflaeche).
- R11-21 · Geräte-Code 5 min gültig, danach 2 min „abgelaufen“, später keine Antwort („Keine Antwort“ nach 15 s);
  beim QR-Code nur der vorige Wert „abgelaufen“, ältere „Der Code stimmt nicht.“ (koppelnZeiten,
  `geraete/koppeln.ts` KOPPEL_NACHLAUF_MS).
- R11-22 · Bildschirm wach auf jedem verbundenen Gerät, auch auf den Handys der Zuschauer; wo der Browser es nicht
  kann, nur ein leiser Hinweis (wachBleiben).
- R11-23 · „Alle Geräte neu laden“: je Befehl einmal je Gerät, höchstens 10 min alt, ohne Speicher nie; ohne
  Verbindung wird nichts gesendet und nichts nachgeholt (alleNeuLaden).
- R11-24 · Kontingent: Warnung ab 80 % der Tagesgrenze oder nach „zu viele Anfragen“, gezählt nur am Bedienrechner
  (kontingent).
- R11-25 · „Small final“/„Kleines Finale“ ohne den Zusatz „(3rd and 4th place)“, überall gleich.
- R11-26 · Stichentscheid: Eine Runde nur mit X gilt als nicht gefahren (es zählt die Runde davor); Disqualifikation
  oder X neben einem gefahrenen Attempt = gefahren ohne Zeit, hinter den Punktgleichen mit Zeit
  (`lib/einzelwertung.ts` gefahreneRunden).
- R11-27 · Die zweite Stufe (vorletzte Runde) gilt für die ganze Gruppe der Punkt- und Zeitgleichen oder für keinen;
  ohne Zeit in der ersten Stufe keine zweite (einzelwertung).
- R11-28 · Die zwei wackeligen Tests laufen lokal und im pre-commit-Hook weiter immer (`src/testHilfen.ts`,
  docs/technik.md).
- R11-29 · Alle acht Kleinigkeiten: (1) ohne Datum der Veranstaltung die ganzen Grenz-Jahrgänge „zum Prüfen“;
  (2) Spalten, die eine Klasse nicht hat, auf Papier kräftig, in der Erfassung blass schraffiert; (3) kein Haken
  „Gewicht geladen“ am Steg (AG2); (4) „AG 4 kg“, „kein AG“, „AG: Gewicht fehlt“ (AG3); (5) auf 0 kg gerundet = keines
  nötig – Papier leer, Gerät „kein AG“, Liste nach Pkt. 3.7 „–“, nur die Verwiegung „0 kg“ (AG2); (6) eigene Stufe
  0,1–10 kg auf 10 g genau (`domain/gewicht.ts`); (7) der Hinweis „offene Runde“ nennt je Klasse eine Runde, das
  Kleine Finale vor dem Finale (`lib/parallelStage.ts` offeneRunde); (8) die Summe der vorletzten Runde in Klammern
  hinter der „Combined time“, Spalte 32 statt 22 mm.
- R11-30 · Kleinigkeiten zum WKR-Gerät und zur Übung bis auf Punkt 2: (1) ein Code öfter als erlaubt wird nirgends
  still umgewandelt (CM5, CM6); (3) Korrektur und „Rückgängig“ einer X-Zeile beginnen ohne X (NG5); (4) „Automatisch“
  unter „Lage der Zeichnung“, eine Wahl gilt genau so, gemerkt je Gerät und Liste (BL1, BL3); (5) die Ortswahl „Disq. –
  an welcher Boje?“ beim Bild immer in „Rückweg gedreht“ (BL6); (6) die Steg-Übung zeigt erfundene
  Ausgleichsgewichte in ganzen kg (AG4); (7) „Klasse vorziehen“ ganz unten, am Tisch direkt über „Übung beenden“ (Y5);
  (8) auf dem Pad mit mehreren Listen rollt nichts, mit einer Liste und Seitenspalte bleibt der Kopf (UK2, UK4).

**Anders entschieden** (umgebaut 26./27.11.2026):

- R11-02 · Geburtstags-Warnung bei mehrtägigen Veranstaltungen. Nutzer: „Das ist ein wichtiger Punkt. Es sollte dann
  zwei Warnungen geben. Eine Hinweis, dass man 2 Wochen vor dem Datum ist und eine deutliche Warnung, wenn der Tag
  weniger als 2 Tage dran ist.“ Gebaut: deutliche Warnung (rot), wenn der 6. bzw. 27. Geburtstag bis 2 Tage vor oder
  nach dem ersten Wettkampftag liegt oder der Starter dort klar außerhalb ist, mit „ab bzw. bis wann er starten darf“;
  Hinweis (gelb) bei 3 bis 14 Tagen; Zahlen in `GEBURTSTAG_FENSTER`. → Abschnitt „Starter und Startnummern“
- R11-03 · Gemeinsame WKR-Bögen auch bei Meisterschaften. Nutzer: „Wenn es schon da ist, kann man das auch bei den
  anderen nutzen“. Gebaut: Einstellung „Gemeinsame Bögen“ bei DM und UIM (Vorgabe aus), an = dieselbe Gruppierung wie
  bei der Clubmeisterschaft, „Papier sparen“ als weiterer Haken; AppState.wkrMeisterschaftGemeinsam. → Abschnitt
  „Listen und Druck“
- R11-07 · Co-Piloten beim Ausgleichsgewicht. Nutzer: „… sollte am besten gleich bei der Co-Piloten konfiguration mit
  abgefragt werden. Da soll man dann proKlasse auch ein ersatz Co Piloten eintragen. Jeder Co Pilot kann dann optional
  auch ein Gewicht eingetragen bekommen. Dann steht zur Wahl, ob das Ausgleichgewicht über alle Co-Piloten zählt, oder
  nur pro Klasse. Die co-Piloten, die ein Ausgleichgewicht brauchen, haben das auf den Listen in Klammern dahinter.
  Beide Co-Piloten stehen untereinander auf den Listen, damit beim Steg klar ist, wer die alternative ist.“ Gebaut:
  Block „Besetzung“ je Klasse mit Co-Pilot, Ersatz und Gewichten, Einstellung „Ausgleichsgewicht der Co-Piloten“ (je
  Klasse oder über alle), „(+3,5 kg)“ hinter dem Namen, beide untereinander auf den „Ausgleichsgewichten“ und der Liste
  nach Pkt. 3.7. → Abschnitt „Ausgleichsgewicht am Steg“
- R11-11 · Boot gestartet, aber liegen geblieben. Nutzer: „Bei einem bestätigten Ausfall kommt es zu einer
  Wiederholung des Laufes. Das ist evtl. noch gar nicht berücksichtigt im Tool. Wenn der Ausfall verschulden vom
  Starter ist, dann ist es ein J Falscher Parcours.“ Gebaut: „Wiederholung (Ausfall) …“ an der Start-Freigabe (nur am
  Bedienrechner) verwirft die Werte des Starters in diesem Lauf und stellt ihn unter „Wiederholung offen“, von Hand
  einzureihen; „Doch keine Wiederholung“ holt die Werte zurück; J bei Verschulden setzt der WKR an der Boje. →
  Abschnitt „Betrieb und Offline“, `BETRIEB_ANNAHMEN` WH1–WH10
- R11-13 · Benennung der Lage der Zeichnung. Nutzer: „Nein, Steg ist hier irreführend. Der steht immer anders.“
  Gebaut: „Start/Ziel links/oben/rechts/unten“ (BL7, ersetzt BL2), Parallelslalom weiter „Start …“.
- R11-14 · Kopf der Maske hinausrollen. Nutzer: „Oh, dann besser wieder raus damit. Ich dachte, es ist eine extra
  Zeile“. Gebaut: Der Kopf rollt nirgends mehr hinaus, in der Übung nur die Erklärung „So läuft die Übung“ (UK7,
  ersetzt UK1/UK3).
- R11-30 (2) · Zwei „Rückgängig“. Nutzer: „Der Pfeil bei 2 soll nach links und nicht nach unten zeigen“. Gebaut:
  „↩ Rückgängig“ im Fuß mit gezeichnetem Pfeil nach links; „Rückgängig“ in der Leiste „Zuletzt“ ohne Zeichen (H2).

Nicht gefragt und weiter offen (unter „Offen“): was beim Umbauen von R11-02, R11-03, R11-07, R11-11 und R11-14 neu
ausgelegt wurde (beantwortet 27.11.2026, Runde 12, nächster Abschnitt), dazu CM3 „D schon gesetzt → nichts“, CM4, die
Zeitnahme ohne „Nicht gestartet“ (NG1), der Kopf mit den Klassen der Seite, UK5/UK6 (bestätigt in Runde 12), die
Beschriftung „Ausgleichsgewicht in Stufen von“ und der Fall alter gedruckter Codes des Kleinen Finales.

### Antworten 27.11.2026 (Runde 12)

Antworten des Nutzers auf die Fragenseite, Runde 12 (R12-01…R12-18: was beim Umbau nach Runde 11 ausgelegt wurde –
Geburtstags-Warnung, gemeinsame WKR-Bögen bei Meisterschaften, Co-Piloten und Ausgleichsgewicht, Wiederholung nach
Ausfall, Übung, Kleinigkeiten). Alle 18 hat er mit „Passt“ beantwortet: Das Gebaute gilt, umgebaut wurde nichts. Im
Code steht an jeder bestätigten Auslegung „bestätigt 27.11.2026 (R12-xx)“, in den Abschnitten oben ebenso.

**Bestätigt:**

- R12-01 · Rote Warnung bis einschließlich 2 Tage Abstand zum ersten Wettkampftag (davor oder danach), gelb bei 3 bis
  14 Tagen – bei Freitag bis Sonntag ist so auch der Sonntag rot. → `import/klassenPruefung.ts` GEBURTSTAG_FENSTER
- R12-02 · Rot auch, wenn der 6. Geburtstag 1–2 Tage VOR dem ersten Wettkampftag liegt (das Kind darf dann an allen
  Tagen starten; Rot erinnert ans genaue Hinsehen, etwa bei einem Tippfehler in der Meldung).
- R12-03 · Wer am ersten Tag klar zu jung bzw. zu alt ist, steht rot da, egal wie nah der Geburtstag liegt (Klasse E
  mit dem 6. Geburtstag 3–14 Tage danach = „zu jung“); gelb nur, wer am ersten Tag starten darf und 3–14 Tage entfernt
  Geburtstag hat.
- R12-04 · „Papier sparen“ auch bei DM- und UIM-Meisterschaften wählbar, Vorgabe aus: erst „Gemeinsame Bögen“ (nur
  gleich aufgebaute, mit Zeichnung), dann als zweiter Haken „Papier sparen“ mit eigenem Hinweis, dass die Zeichnung
  fehlt. → `lib/wkrListen.ts` gemeinsameBoegen
- R12-05 · Mit gemeinsamen Bögen ein Laufzettel je Gruppe von Klassen, die sich Bögen teilen (meist je Parcours und
  Lauf, wie bei der Clubmeisterschaft); Bögen, die je Klasse bleiben, nennen ihre Klasse auf dem Zettel („Kl. 4“).
  → `lib/laufzettel.ts`
- R12-06 · Ein Co-Pilot zählt für den Maßstab nur mit Namen UND Gewicht; „(nicht gewogen)“ nur, wenn andere seiner
  Gruppe gewogen sind; der Ersatz steht nur mit Namen auf den Listen, der eingeteilte immer (leer zum Eintragen); ein
  Gewicht ohne Namen bleibt gespeichert, daneben „zählt erst mit Namen“. → `lib/ausgleich.ts` benannt,
  coPilotAusgleichVon, coPilotZeilen
- R12-07 · „Über alle Co-Piloten“ = die Klassen mit Startern plus die eigene; vor der ersten Meldung alle Klassen der
  Besetzung. → `lib/ausgleich.ts` ausgleichsKlassen
- R12-08 · Die Wahl „je Klasse / über alle Co-Piloten“ steht unter Einstellungen → Durchschnittsgewichte, der Block
  „Besetzung“ sagt mit einem Satz, was gilt, und verweist hin.
- R12-09 · Co-Piloten nur auf den „Ausgleichsgewichten“ und der UIM-Liste nach Pkt. 3.7; WKR-Bögen und Steg-Gerät
  ohne Co-Piloten. → Für das Steg-Gerät überholt am 27.11.2026 (Nutzer: „Hier beim Steg bitte noch das Boot und ggf.
  die Co-Piloten mit anzeigen“; Abschnitt „Ausgleichsgewicht am Steg“, `WKR_ANNAHMEN` CP1–CP10); die WKR-Bögen bleiben
  ohne.
- R12-10 · Der Ersatz-Co-Pilot steht auch auf der Liste nach Regel 960 Pkt. 3.7 („Substitute co-driver:“), sobald
  einer eingetragen ist. → `lib/teamListe.ts`
- R12-11 · „Doch keine Wiederholung“ setzt die alten Werte nur in Felder, die jetzt leer sind (auch die Haken „Liste
  erledigt“ und „keine Zeit“); Neues seit dem Ausfall bleibt, offene Rückfragen und Vorschläge von damals kommen nicht
  zurück (`BETRIEB_ANNAHMEN` WH4).
- R12-12 · Anzeigetafel, Zuschauerliste und Start-Freigabe zeigen „1. Lauf · Wiederholung“ (ohne Grund, ohne Werte);
  englisch „Attempt 1 · Repeat“, „Repeat (breakdown) …“, „Repeat pending“, „No repeat after all“ – nie „Re-run“, das
  ist unter UIM die Runde des Parallelslaloms (WH5).
- R12-13 · Mit „Versuche direkt nacheinander“ bleibt bei der Wiederholung die Vorsteg-Zeile stehen (ihr Gerät darf
  sie weiter korrigieren), alles andere des Versuchs wird geleert (WH6).
- R12-14 · Eine späte Gerätezeile zum abgebrochenen Versuch wird abgelehnt, mit Satz auf dem Gerät, ohne Rückfrage am
  Bedienrechner; im seltenen Sonderfall (zwei Fenster, Zeile genau beim Wechsel) fehlt der Satz und das Gerät zeigt ✓
  – übernommen wird sie auch dann nicht (WH7).
- R12-15 · Ein schon abgeschlossener Lauf bleibt abgeschlossen: Das Gerät bekommt die Wiederholung angeboten, die
  Eingabe wird Vorschlag „abgeschlossen“ (ein Klick zum Annehmen), in der Übersicht steht der Start bis dahin offen;
  der Abschluss wird nicht gelöst (WH8).
- R12-16 · Am Gerät nichts geändert: Die alte Zeile bleibt mit ✓ unter „Zuletzt“ und in der Übersicht beim
  Abschließen (die Nummer steht dann zweimal), für den Abschluss zählt sie nicht (WH7).
- R12-17 · Übung: Nach dem Abschicken rollt nur die Erklärung „So läuft die Übung“ hinaus (statt zuzuklappen); der
  gelbe Hinweis „Bildschirm kann ausgehen“ (bis „Ausblenden“) und der Kopf bleiben; ebenso am Tisch („Alle
  richtig“); auf dem Pad mit mehreren Listen nebeneinander und in der echten Erfassung rollt nichts (UK7, dazu UK5 –
  noch einmal ausrichten, sobald die nächste Karte steht – und UK6).
- R12-18 · Alle sechs Kleinigkeiten: (1) Klassen „Start/Ziel links/oben/rechts/unten“, Parallelslalom kurz „Start
  links …“ (BL7); (2) „Rückgängig“ im Aufbau-Assistenten mit dem gezeichneten Pfeil nach links wie in der WKR-Maske
  (H2, `components/ZuordnungImBild.vue`); (3) beim Einschalten gemeinsamer Bögen einer Meisterschaft bleiben die
  Leerzeilen je Klasse wie eingestellt (Meisterschaft 3), mit „Papier sparen“ oder „nach der Verzahnung“ gelten die
  Leerzeilen je Seite; (4) die Wahl hinter „Wiederholung (Ausfall) …“: alle gezeigten, geltenden Starts der laufenden
  Läufe, der zuletzt gezeigte oben, die ersten acht sofort, die übrigen über die Suche nach Startnummer (WH3); (5) für
  den abgebrochenen Start im Boot keine Ampel und kein Auto-Modus, „Nächster Start“ von Hand (WH9); (6) keine
  Wiederholung für Abgemeldete – ausgegraut mit „abgemeldet – keine Wiederholung“, erst die Abmeldung zurücknehmen
  (WH10).

Nicht gefragt und weiter offen (unter „Offen“): zur Wiederholung, dass das Freigabe-Handy nicht auslöst (WH3), dass
es im Parallelslalom keine Wiederholung gibt (WH10, bestätigt ist nur der Teil zu Abgemeldeten), dass
„Zurück“ den abgebrochenen Versuch nicht nimmt und „Doch keine Wiederholung“ nur am Bedienrechner geht (WH4; in R12-11
nur als Hintergrund genannt) und was mit den Papier-Vermerken geschieht (WH4, WH8); dazu der 29.02., der Kopf mit den
Klassen der Seite, die Beispielansicht gemeinsamer Bögen, CM3 „D schon gesetzt“, CM4, NG1, BL4/BL5 und die übrigen
älteren Punkte – beantwortet 27.11.2026 (Runde 13, nächster Abschnitt) bis auf BL5 und einzelne ältere.

### Antworten 27.11.2026 (Runde 13)

Antworten des Nutzers auf die Fragenseite, Runde 13 (R13-01…R13-15: Wiederholung nach Ausfall, WKR-Gerät, WKR-Bögen,
Start-Freigabe vom Handy, Startliste, Wartezeiten und Zuschauerliste, Parallelslalom im Betrieb, Kleinigkeiten). Zwölf
Fragen hat er mit „Passt“ beantwortet – das Gebaute gilt –, dazu R13-06 bis auf die Wiederholung. Anders entschieden
hat er R13-01, R13-02 und den Teil von R13-06 zur Wiederholung; die sind umgebaut, ihre Einträge stehen im Abschnitt
„Betrieb und Offline“. Im Code steht an jeder bestätigten Auslegung „Bestätigt 27.11.2026 (R13-xx)“, in den
Abschnitten oben ebenso. Zugleich sind die veralteten „noch zu bestätigen“ im Code gestrichen, deren Auslegung laut
den Runden 7–12 schon bestätigt war (`WKR_ANNAHMEN`, `BETRIEB_ANNAHMEN` AM6–AM8, Kopfkommentare einzelner Dateien).

**Bestätigt:**

- R13-03 · Zeitnahme und Knoten am Tisch ohne „Nicht gestartet · Disq. X“: Die Zeitnahme meldet „keine Zeit“ mit
  Grund, das X kommt von einer Liste mit Disq.-Feld oder vom Bedienrechner (`WKR_ANNAHMEN` NG1).
- R13-04 · Am Höchstwert sagt der Code-Knopf es in sich („höchstens 1×“), bleibt normal, nicht ausgegraut, kein Band
  (CM4); steht D schon (über DISQ gesetzt), bleibt ein weiterer Tipp auf „2. und 3. Versuch“ ohne Wirkung, der Knopf
  sagt „Disq. D gesetzt“ (CM3).
- R13-05 · Der Kopf eines gemeinsamen WKR-Bogens nennt je Seite nur deren Klassen, eine allein als „Klasse 3“; eine
  Seite nur mit Leerzeilen nennt bei „nach der Verzahnung“ alle Klassen des Bogens. → `lib/bogen.ts`
- R13-06 · Bis auf die Wiederholung (unten): Das Freigabe-Handy darf alles Betriebliche seiner Parcours, aber nicht
  „Betrieb zurücksetzen“, keine Meldung „Auf allen Parcours zeigen“, keine Einstellungen (`BETRIEB_ANNAHMEN`
  startfreigabeRechte).
- R13-07 · Koppeln ohne Rückfrage am Bedienrechner; Name nach der Geräteart, eindeutig gemacht, umbenennen in der
  Geräteliste (koppelnOberflaeche, koppelnZeiten).
- R13-08 · Gekoppelte Handys melden sich von selbst wieder an, mit den Rechten von jetzt; entzogen zeigen sie nur noch,
  wer im Boot ist und wer als Nächstes kommt; „Gerät entkoppeln“ löscht nur auf dem Handy; die Geräteliste zeigt
  „zuletzt gehört“ statt „verbunden“ (gekoppelteGeraete, koppelnOberflaeche).
- R13-09 · Startabstände: ab drei Messungen nur der Messwert, vorher nur die Vorgabe; gültig 30 bis 300 s; nie über
  einen Laufwechsel, nicht über „ohne Anzeige“ Erledigte, nicht nach X oder Abbruch, ein zurückgenommener Start zählt
  nicht; „Messwerte als Vorgabe übernehmen“ erst ab drei Messungen (prognoseMessung, keineMessungOhneLauf,
  keineMessungUeberPunktgrenze, vorgabeAbGenugMessungen).
- R13-10 · „ca. in“ nur für offene Starts des begonnenen Laufs; keine Zahl bei Pause oder Störung (auch bei den
  Begrüßungen), für „Boot fehlt“, Zurückgestellte, Nachzuholende, „Wiederholung offen“ und nicht begonnene Läufe
  (wartezeitNurFreigegebene, keineZahlBeiPause, zuschauerGruppen).
- R13-11 · Die Zuschauerliste zeigt nur den laufenden Lauf, ohne Zurückgestellte, Nachzuholende und „Wiederholung
  offen“; die Filter blenden nur aus (zuschauerSchmal, zuschauerGruppen).
- R13-12 · Parallelslalom im Betrieb: (1) ohne „ca. in“; (2) auf der gemeinsamen Anzeigetafel erst ab einer begonnenen
  Runde, sonst wählbar; (3) die Lage von A und B nur auf der Anzeigetafel; (4) eine leere Seite „–“, der Start entfällt
  nur, wenn beide leer sind (parallelOhnePrognose, parallelAufDerTafel, parallelAnordnungNurTafel, parallelLeereSeite).
- R13-13 · Kein Umstellen im Parallelslalom; Zurückstellen, Einreihen und gezieltes Zeigen nehmen das Paar mit; ein
  Paar im Boot fährt vor einer anderen Runde zu Ende (parallelOhneUmstellen, parallelPaarAlsEinheit,
  parallelPaarZuEnde).
- R13-14 · Alle fünf Kleinigkeiten: (1) am 29.02. Geborene werden in Jahren ohne ihn am 01.03. älter
  (`import/klassenPruefung.ts` geburtstagMit); (2) „Ausgleichsgewicht in Stufen von“; (3) die Beispielansicht mischt
  die Muster-Starter in der Verzahnung des Parcours (`components/WkrVorschau.vue`); (4) Ziffern und Text der Zeichnung
  bleiben aufrecht (BL4); (5) alte QR-Codes des Kleinen Finales treffen den Bogen des Finales (hingenommen,
  `state/migrate.ts` teileAlteFinals).
- R13-15 · Alle acht Kleinigkeiten: (1) „Zurück“ nimmt den abgebrochenen Start nicht, dafür „Doch keine Wiederholung“
  (WH4); (2) der Papier-Vermerk fällt mit der Wiederholung weg und kommt nicht zurück (WH4, WH8); (3) „Andere Klassen
  vorziehen“ zu Beginn an, kein „Vorziehen“ für eine Klasse allein auf ihrer Spur (vorziehenVorgabe,
  alleinAufDerSpurFest); (4) „Ans Ende des Laufs“ = Ende des laufenden Laufs (einreihenEndeLaufend); (5) Knöpfe statt
  Ziehen an der Start-Freigabe (knoepfeStattZiehen; dass nur die Startliste das Ziehen kennt, ebenso – ihre Regeln
  des Ablegens waren nicht gefragt); (6) „Einsteigen ab …“ ohne Rückfrage; (7) Meldungsvorlagen in der Sprache der
  Anzeigetafel; (8) Sperre bis zur Bestätigung, der Satz nach 10 s; QR-Code 30 s, Sitzung 10 Minuten
  (koppelnOberflaeche, koppelnZeiten).

**Anders entschieden** (umgebaut 27.11.2026):

- R13-01 · Wiederholung nur am Bedienrechner? Nutzer: „Nein, auch an der Start Freigabe, wenn diese auf einem anderen
  Gerät aktiv ist. Die Start-Freigabe ist die Instance, die bestimmt, wer im Parcours ist und als welchen Lauf dieser
  gewertet wird. Damit sind auch Wiederholungen direkt dort zu entscheiden“.
- R13-06 · Rechte der Start-Freigabe auf dem Handy. Nutzer: „Wiederholungen von Starts auslösen und einordnen in der
  Verzahnung, das die Position auch machen.“ Gebaut (mit R13-01): Das gekoppelte Freigabe-Handy zeigt für seine
  Parcours „Wiederholung (Ausfall) …“ mit derselben Wahl und Rückfrage wie am Bedienrechner und unter „Wiederholung
  offen“ „Doch keine Wiederholung“; einreihen konnte es schon. Die zwei Actions der Erfassung gehen über eine eigene,
  eng geprüfte Ausnahme der Positivliste: Der Host prüft Bereich, gefahrene Starts, Abmeldung und die Zahl der
  Abbrüche und lehnt sonst mit Grund ab. Am Bedienrechner bleiben „Betrieb zurücksetzen“, „Auf allen Parcours zeigen“
  und die Einstellungen. WH3 heißt seitdem `wiederholungAnDerStartFreigabe`. → Abschnitt „Betrieb und Offline“,
  `BETRIEB_ANNAHMEN` WH3, WH4, WH11–WH14
- R13-02 · Wiederholung nach Ausfall auch im Parallelslalom? Nutzer: „Auch hier kann es zu technischen Ausfällen
  kommen.“ Gebaut: „Wiederholung (Ausfall) …“ auch im Parallelslalom. Welche Boote wiederholen, hat der Nutzer offen
  gelassen; die Rückfrage fragt deshalb jedes Mal („Nur 101 (Parcours A)“, „Nur 102 (Parcours B)“, „Beide
  wiederholen“). Verworfen werden die Werte der gewählten Boote in genau diesem Attempt; das Paar wird von Hand
  eingereiht, als Einheit (R13-13). Der Re-run bei Gleichstand, „Runde gedruckt (fest)“ und die Paarung bleiben
  unberührt. → Abschnitt „Betrieb und Offline“, `BETRIEB_ANNAHMEN` WH10, WHP1–WHP6

Beim Umbau ausgelegt und vom Nutzer zu bestätigen – Liste unter „Offen“, vor allem: Soll es im Parallelslalom eine
Vorgabe geben, welche Boote wiederholen (WHP2)? Und zur Entscheidung (WH11): Die Wahl der gefahrenen Starts hält die
Starter begonnener Läufe den ganzen Tag in der Sicht der Tafel-Links. Nicht gefragt und weiter offen: die Sonderfälle
der Startfolge an der Start-Freigabe (für Runde 14 vorgesehen) und einzelne ältere Kleinigkeiten (unter „Offen“).

## Entschieden, noch nicht umgesetzt (Stand 2026-11-21)

Der Code weicht hier noch ab. Vor dem Umsetzen kurz mit dem Nutzer bestätigen, danach den Eintrag oben einsortieren.

- Digitale WKR-Erfassung (Antworten 21.11.2026, Abschnitt oben): Etappen W1–W6 nach
  [vorschlag-wkr-erfassung.md](vorschlag-wkr-erfassung.md) §11; W1 (Kern), W2 (Bedienrechner) und W3 (Handy-Maske
  „Knöpfe“, Übung) und W4 (Bojen-Maske, „Nicht vorbeigekommen“) gebaut 21.11.2026, W5 (Pad, Bild, Knoten, Zeit,
  Tabelle) gebaut 22.11.2026 (Auslegungen PD/MW/BD/KN/ZT/TB am 22.11.2026 beantwortet, Runde 8), W6 offen (nach Befund); Auslegungen W1–W4 bestätigt 21.11.2026 bis auf die oben unter „Antworten 21.11.2026 abends
  (Runden 3–6)“ anders entschiedenen; P15, U1, U2, U4, V3, Z1–Z7, Y1–Y3 bestätigt 22.11.2026 (Runden 7–8), U3 anders entschieden; Feldtest offen
  (docs/feldtest.md „WKR-Maske“, „Bojen-Maske“).
- Antworten 21.11.2026 abends (Abschnitt oben), noch nicht gebaut (gebaut 21.11.2026: Parcours-Ampel mit Auto-Modus
  P-03/P-04, „Mehr → Liste abschließen“ entfernt W3-40, Rückfrage beim Abschließen im laufenden Lauf R6-10; Disq. an
  der Boje immer mit Boje, Punkte und Buchstabe in einer Zelle W4-12; Gerät-Feinschliff W3-01/P-18, W3-03, W3-07,
  W3-15, W3-17, W3-24, W3-25, W3-26, W3-35, W3-51, W4-07, W4-13 mit GF1–GF11; WKR-Name aus der Einteilung W3-13
  mit WN1–WN3; Sortierung Klick 1 A→Z S-01; Beispielfeld je Klasse festlegbar und Clubmeisterschaft ohne Herkunft
  R6-01/R6-02 mit BS1–BS3): nichts mehr offen; zu bestätigen bleiben die datierten Auslegungen
  ([plan-antworten-runde3-6.md](plan-antworten-runde3-6.md) §8).
- Antworten 22.11.2026 (Runden 7–8, Abschnitt oben): alle gebaut 22.11.2026 (Zeit-Listen zur Parcours-Ampel R7-01,
  Zeit: Weiterspringen und weitere Felder optional R8-35, mehrere Disq. je Bojenzelle mit Komma R7-14, langes Drücken
  auf Bojen und im Bild R7-21/R8-23, kein automatischer Wechsel im Bild R8-20, Parallel-Zeichnung aus dem
  Parcours-Repo R8-19; Knoten: nächste offene vorschlagen, „Alle richtig“, Rückfrage bei erfasster Nummer
  R8-27/R8-31/R8-32; Übung: Klasse vorziehen R7-45; Handeingaben je Klasse mit Reset-Knopf R7-51) – nichts mehr
  offen; die neuen Auslegungen stehen in [plan-antworten-runde7-8.md](plan-antworten-runde7-8.md) §8, seit 23.11.2026
  mit dem Stand nach Runde 9 je Zeile: bestätigt bis auf BD3/BD8, BD9 und BD10 (R9-05 bis R9-07, NICHT bestätigt und
  umgebaut, Abschnitt „Antworten 23.11.2026 (Runde 9)“); AM1/AM2, BZ8 und BD4 folgen früheren Entscheidungen.
- Antworten 23.11.2026 (Runde 9, Abschnitt oben): Parallelslalom-Zeichnung eine Bahn ohne Steg, IDs aus dem
  Parcours-Repo (R9-05 bis R9-07) – gebaut 23.11.2026: Gerätebild (Scheibe 1) und Fahrweg-Bogen auf Papier
  (Scheibe 2; noch zu bestätigen: nur der Fahrweg-Bogen, rechts neben der Legende in 100 mm Breite – zweisprachig
  bricht die Legende dafür um und der Bogen fasst 2 Zeilen weniger je Blatt) – alles bestätigt 24.11.2026 (Runde 10,
  Abschnitt oben), der Parcours-Commit a9c4275 ist gepusht. Nichts mehr offen.

## Offen

- **Wiederholung nach Ausfall – Umbau nach Runde 13** (27.11.2026, R13-01, R13-02, R13-06; Abschnitt „Betrieb und
  Offline“). Beim Bau ausgelegt bzw. nach den Prüfbefunden nachgezogen, vom Nutzer zu bestätigen:
  - Parallelslalom (`BETRIEB_ANNAHMEN` WHP1–WHP6, WH10):
    - WHP2: Die Rückfrage hat keine Vorgabe dafür, welche Boote wiederholen. Sie fragt jedes Mal mit „Nur 101
      (Parcours A)“, „Nur 102 (Parcours B)“ oder „Beide wiederholen“, und der Knopf ist zugleich die Bestätigung.
      **Frage für die nächste Runde:** Soll es eine Vorgabe geben, nur das ausgefallene Boot oder beide?
    - WHP2: Fuhr in diesem Versuch nur ein Boot (Dummy, gelöscht, X), wird nur dieses angeboten. Nach einer
      Wiederholung nur von A bietet ein weiterer Ausfall desselben Attempts nur noch A an.
    - WHP3: Wiederholt nur ein Boot, steht das andere unter „Wiederholung offen“, auf Anzeigetafel, Start-Freigabe und
      Zuschauerliste als „–“ (wie eine leere Seite, ohne Grund). Es fährt nicht noch einmal und behält Werte, Haken, P
      der Pausen und Abschlüsse seines Racecourse.
    - WHP3: Der abgebrochene Versuch bleibt im Boot mit beiden Booten stehen, bis der nächste Start kommt.
    - WHP3: Haben beide Boote wiederholt und hat eines inzwischen X, holt „Doch keine Wiederholung“ nur die Werte des
      anderen zurück (beim Bau ausgelegt, nicht als Befund gemeldet).
    - WHP4: Nur die Listen des Racecourse, dessen Boot wiederholt, bekommen eine neue Geräte-Kennung. Eine späte Zeile
      dort wird mit `versuch-abgebrochen` abgelehnt. Auf dem anderen Racecourse gilt der Versuch weiter: Eine späte
      Zeile wird übernommen, und die Wiederholung erscheint dort weder in der Schlange noch vorab noch unter „danach“.
    - WHP4: Die Spalte des Paares in der Matrix der WKR-Erfassung fehlt wie im Manövrieren bis zum neuen Zeigen, auch
      mit der Zelle des Boots, das nicht wiederholt.
    - WHP5: „Als Nächster“ und „Ans Ende der Runde“ nehmen mit der Wiederholung den Attempt mit, der im Plan direkt
      dahinter steht und noch nicht gezeigt ist (planPartner, also nur nach dem Vorlauf). Begründung: Regel 960
      Pkt. 4.4, der 1. Attempt ist der frühere Start. „Zurückstellen“ nimmt eine wartende Wiederholung nicht mit.
    - WHP5: Der 2. Attempt wartet nicht von selbst. Wird vor dem Einreihen „Nächster Start“ getippt, kommt er vor der
      Wiederholung.
    - WHP6: Titel „· Wiederholung“ bzw. „· Repeat“ am Paar. `sv` bleibt 7, weil sich die Form der Sicht nicht ändert.
      Die Zuschauersicht zeigt die Wiederholung nur im Titel.
    - WHP6: Der Verlauf nennt die Startnummern der wiederholenden Boote (bei beiden „E01 / E02“), die Klasse nur, wenn
      sie für alle gleich ist, dazu Runde und Attempt.
    - WHP1: Die Wertung nimmt den wiederholten Attempt wie jeden anderen, weil er in denselben Zellen steht. Re-run bei
      Gleichstand und „Runde gedruckt (fest)“ bleiben unberührt, die Paarung ändert sich nie.
    - WH10 im Parallelslalom je Boot: Ist ein Boot abgemeldet, sind seine Seite und „Beide wiederholen“ gesperrt, das
      andere Boot darf wiederholen. Der Reducer ändert nichts, wenn ein gewähltes Boot abgemeldet ist.
    - Ein zweiter Ausfall desselben Paares ersetzt alle gemerkten verworfenen Werte des ersten, auch die des anderen
      Boots. „Doch keine Wiederholung“ nimmt danach nur den letzten Abbruch zurück, mit dessen Booten.
  - Freigabe-Handy (`BETRIEB_ANNAHMEN` WH11–WH14):
    - WH11 (wiederholungWahlInSicht): Die Wahl `gefahren` steht seit `sv` 8 in jeder öffentlichen Sicht, also auch
      auf den Lese-Links der Anzeigetafel. Das sind schon gefahrene Starts der laufenden Läufe, ohne Werte, Gründe
      oder Abmeldungen; nicht in der Zuschauersicht. Grund: Das Handy liest nur diese Sicht, und die Freigabe-Gruppe
      darf keine Starternamen tragen (A9).
    - WH12 (wiederholungHandyAbmeldungen): Das Handy bekommt Abmeldungen nur zum Ausgrauen. Gemeint sind die IDs der
      Abgemeldeten unter den gefahrenen Starts seines Bereichs, über die Freigabe-Gruppe
      (FreigabeErfassung.ausfallGesperrt, fv 3). Nie alle Abmeldungen, nie in der öffentlichen Sicht, nie an Geräte
      anderer Bereiche.
    - WH13 (wiederholungHandyPruefung): Der Host prüft gegen den vollen Stand und lehnt mit Grund ab: `nicht-erlaubt`
      (fremder oder unbekannter Bereich), `nicht-gezeigt` (nicht unter den gefahrenen Starts; im Parallelslalom auch
      „Nur …“ für ein Boot, das nicht fuhr), `abgemeldet`. Ein Start, der schon auf seine Wiederholung wartet, geht
      durch und ändert nichts („Nichts geändert“). „Doch keine Wiederholung“ prüft nur den Bereich; wartet der Start
      nicht mehr, ebenfalls „Nichts geändert“.
    - WH14 (wiederholungGebunden): Auslösen und „Doch keine Wiederholung“ tragen die Zahl der Abbrüche, die die
      Start-Freigabe zeigte; stimmt sie nicht mehr, ändert sich nichts und das Handy liest „Inzwischen hat sich dort
      etwas geändert …“ (`konflikt`). Die offene Rückfrage schließt sich still, ohne Hinweis (beim Bau ausgelegt,
      nicht als Befund gemeldet).
  - **Zur Entscheidung** (Befund 8, WH11): `gefahren` in der Gruppe ko hält alle Starter begonnener Läufe bzw. Runden
    den ganzen Tag in der Startertabelle der Tafel-Links (Name nach der Namensregel, Herkunft, Klasse). Nicht umgebaut,
    weil es eine fachliche Entscheidung ist. Begrenzen auf die jüngsten Starts widerspräche R12-18 (4) („alle, Rest über
    die Suche“); „Läufe, die gerade laufen“ ist mehrdeutig, weil ein begonnener Lauf nie endet; möglich wäre auch, die
    Wahl nur über eine eigene Gruppe an die Freigabe-Handys zu schicken. Der Nutzer muss wählen.
  - Prüfbefunde ohne eigene Frage (Eintrag 27.11.2026 „nach den Prüfbefunden nachgezogen“, (4) und (7)): „Papier ab“
    ab der Wiederholung nimmt nur sie und Späteres; der Verlauf nennt die Startnummer. Dazu WH4: Fährt in dem Start
    niemand mehr (X nach dem Ausfall), entfällt er, und „Doch keine Wiederholung“ ändert nichts (`betrieb/folge.ts`
    faehrtNoch).
  - Nicht mehr offen: R13-15 (1) und (2) („Passt“) sind in WH4 und WH8 als bestätigt vermerkt. WH3 ist nach den
    Zitaten R13-01 und R13-06 umgeschrieben und heißt `wiederholungAnDerStartFreigabe`; am Bedienrechner bleiben
    „Betrieb zurücksetzen“, „Auf allen Parcours zeigen“ und die Einstellungen, wie in R13-06 bestätigt.
  - Nicht mehr offen: Die Nutzer-Doku (Befund 7) beschreibt die Wiederholung vom Freigabe-Handy und im
    Parallelslalom seit 27.11.2026 (docs/betrieb.md, funktionen.md, parallelslalom.md, feldtest.md, je de und en).
- **Betrieb am Wettkampftag** (E1–E4, ab 16.11.2026, Abschnitt „Betrieb und Offline“): Messung, Wartezeiten,
  Zuschauerliste, Parallelslalom im Betrieb und Umstellen an der Start-Freigabe sind am 27.11.2026 bestätigt (R13-09
  bis R13-13, R13-15 (3)–(7)). Weiter „noch zu bestätigen“ in `BETRIEB_ANNAHMEN` – die Sonderfälle der Startfolge an
  der Start-Freigabe, für Runde 14 vorgesehen: abgemeldetNurDurchX (nur ein X in einer Disq.-Zelle des Laufs lässt
  den Start entfallen), angebrochenFaehrtZuEnde, zeigenJederOffene (auch Zurückgestellte und „Boot fehlt“),
  nichtBegonneneWarten, bootFehltVorNachzuholen, bloeckeJePunkt, haltenImBlock, unberuehrtePunkteFolgenVerzahnung,
  klassenImLaufendenPunkt, schritteNurFestgeschrieben, parallelRundenFuerSich, parallelRundenAlsPunkte (Betrieb ab einer festgeschriebenen
  Runde) und parallelLeereSeite (Kennung eines Paares laut Plan, K8); dazu vorstegVorDenStegStarts (Zeit bis zum
  Vorsteg) und in ziehenInDerStartliste die Regeln des Ablegens (vor/hinter, was nicht gezogen wird).
- **Mehrgeräte-Betrieb über ntfy** (E5–E8): gebaut, aber nur gegen einen nachgebauten Server geprüft; offen ist der
  Feldtest ([feldtest.md](feldtest.md)). Die Auslegungen von E6–E8 sind bestätigt (R11-15 bis R11-24, R13-06 bis
  R13-08, R13-15 (8)). Nicht eigens gefragt, in `BETRIEB_ANNAHMEN` koppelnZeiten und gekoppelteGeraete weiter „noch zu
  bestätigen“ (technische Einzelheiten): der Geräte-Code nur mit Koppel-Link, das Wiederholen mit wachsendem Abstand
  samt später Antwort, das Hingenommene zum Betreiber des ntfy-Servers, ein neuer Code für ein schon gebundenes Gerät,
  das Schreibfenster.
- **Steg-Gerät mit Boot und Co-Piloten** (27.11.2026, Abschnitt „Ausgleichsgewicht am Steg“): CP1–CP8 und CP10 beim
  Bau ausgelegt, vom Nutzer zu bestätigen (CP5 und CP7 nach dem Prüfbefund 27.11.2026 geändert). **Fragen für die
  nächste Runde:** (1) Sollen auch die WKR-Bögen auf Papier (Steg) die Co-Piloten tragen, wie seit 27.11.2026 das
  Steg-Gerät? R12-09 sagte für beide „ohne“; der neue Wunsch nennt nur den Steg am Gerät. (2) Soll die Einstellung
  „Namen“ der Anzeigetafel (voll, gekürzt, ohne) auch für die Co-Piloten am Steg gelten? Gebaut ist „nein“ (CP10): Sie
  stehen vollständig, wie in der Besetzung eingetragen – der WKR soll prüfen, wer ins Boot steigt. Beispiel: Bei einer
  Jugendveranstaltung mit „Namen: ohne“ gehen trotzdem die vollen Namen der Co-Piloten verschlüsselt über den fremden
  ntfy-Server an die Geräte der Steg-Liste (nie an Tafel oder Zuschauer); die Hinweise vor dem Einschalten sagen das.
- **Ältere, nie eigens gefragte Auslegungen:** die Folge innerhalb einer Position beim Druck der WKR-Bögen (erst alle
  Klassen im 1. Lauf; Abschnitt „Listen und Druck“, `lib/wkrListen.ts` WKR_DRUCKFOLGE.innen); zur Lage der Zeichnung
  BL5 (das Schema dreht nicht – erscheint nur als Rückfall ohne Parallel-Zeichnung, bewusst nicht gefragt) und BL8
  (hochkant nur die Ziffern an den Bojen, auch „Tempo - Runde“ fällt weg; `WKR_ANNAHMEN` bildLageOhneSchema,
  bildHochkantNurZiffern).
- PARALLEL_ANNAHMEN (`lib/parallelErgebnis.ts`, alle bestätigt 24.11.2026) und EINZEL_FESTLEGUNGEN
  (`lib/einzelwertung.ts`) legen aus, wo Regel 960 schweigt; bei neuer Auskunft der UIM dort umstellen und diese Liste
  anpassen.
