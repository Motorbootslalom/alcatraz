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
- 2026-11-15 · N · Das Finale um Platz 3 und 4 wird vor dem Finale gefahren.
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
- 2026-11-16 · N · Die Zahlen im Beispieldaten-Block (Starter je Klasse, Herkünfte, Wahl der Beispielwerte) überstehen
  ein Neuladen nur im selben Tab; das reicht. → `components/BeispieldatenPanel.vue`

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
  Fassung haben. → Plan §7 (F2–F7), ab E5 `geraete/`
- 2026-11-11 · N · Für die Tafel darf ein öffentlicher ntfy-Server genutzt werden („Im Fall der ../tafel kann aber
  auf ntfy.adminforge.de zurückgegriffen werden“): Vorgabe ntfy.adminforge.de, in den Einstellungen änderbar (wie im
  Lastenheft der Tafel, P-9). Die frühere Notiz „Hostname bewusst nicht im Repo“ stammte nicht vom Nutzer. → ab E5

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

## Entschieden, noch nicht umgesetzt (Stand 2026-11-16)

Der Code weicht hier noch ab. Vor dem Umsetzen kurz mit dem Nutzer bestätigen, danach den Eintrag oben einsortieren.

Zurzeit nichts.

## Offen

- Geburtstags-Ausnahme des DM-Reglements (ME ab dem 6. Geburtstag, M7 bis zum 27. Geburtstag): abschaltbar in den
  Einstellungen oder nur Warnung im Reiter „Starter“ – welche Form, ist offen; bisher nicht umgesetzt (`dm-2026.yaml`).
- Nummernpakete mit Präfix D für Dolphin: möglich, nicht entschieden.
- Erfassung durch Wettkampfrichter am Gerät: kommt später, im Konzept mitdenken.
- Mehrgeräte-Betrieb über ntfy (Etappen E5–E8): noch nicht gebaut; Entscheidungen dazu unter „Betrieb und Offline“.
  Ohne Netz gibt es seit 16.11.2026 (E1) die Anzeigetafel im zweiten Fenster und die Start-Freigabe am Bedienrechner.
- PARALLEL_ANNAHMEN (`lib/parallelErgebnis.ts`) und EINZEL_FESTLEGUNGEN (`lib/einzelwertung.ts`) legen aus, wo Regel 960
  schweigt; bei neuer Auskunft der UIM dort umstellen und diese Liste anpassen.
