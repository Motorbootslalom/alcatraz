# Parallelslalom und Einzelwertung (Regel 960)

Was Alcatraz unter UIM Regel 960 „Formula Future“ für den Parallelslalom und die Wertung über beide Stages kann.
Das Manövrieren und alles Gemeinsame steht in [funktionen.md](funktionen.md).
Warum etwas so ist, steht mit Datum in [entscheidungen.md](entscheidungen.md).
„Entscheidung vom …“ meint hier immer eine Entscheidung des Nutzers.

## Inhalt

- [Überblick](#überblick)
- [Startplan des Vorlaufs](#startplan-des-vorlaufs)
- [WKR-Listen des Vorlaufs](#wkr-listen-des-vorlaufs)
- [Erfassung im Parallelslalom](#erfassung-im-parallelslalom)
- [race officials](#race-officials)
- [Startliste je Racecourse](#startliste-je-racecourse)
- [Wertung des Vorlaufs](#wertung-des-vorlaufs)
- [Runden nach dem Vorlauf](#runden-nach-dem-vorlauf)
- [Abmelden](#abmelden)
- [Betrieb: Start-Freigabe und Anzeigetafel](#betrieb-start-freigabe-und-anzeigetafel)
- [Dummys und Wörter](#dummys-und-wörter)
- [Einzelwertung](#einzelwertung)
  - [Disziplin nicht werten](#disziplin-nicht-werten)
  - [Mannschaftswertung UIM](#mannschaftswertung-uim)
  - [Festlegungen zum Stichentscheid](#festlegungen-zum-stichentscheid)

## Überblick

Alcatraz rechnet den Startplan des Vorlaufs
(`src/planung/parallel.ts`, `src/planung/parallelRunden.ts`, Ansicht „Verzahnung → Parallel-Slalom“).
Dazu je Klasse Halbfinale, Finals und Wiederholung (Re-run) bis zum Gesamtergebnis der Stage.
Jede Runde hat WKR-Listen, Laufzettel, Erfassung und Wertungslisten.
Daraus entstehen die Einzelwertung über beide Stages und die Mannschaftswertung UIM aus den Punkten beider Stages
(siehe [Einzelwertung](#einzelwertung)).
Den Parallelslalom gibt es nur unter einem Regelwerk mit der Disziplin `parallel` (Regel 960), also bis Klasse 5.
Der frühere Zustand `parallelInternational` (nationaler Parallelslalom) ist entfallen; alte Sicherungen laden weiter.

## Startplan des Vorlaufs

- **Paare nach Klassen** (Pkt. 4.4 „Two drivers from the same class shall start at the same time“):
  Vorgabe ist die strenge Klassentrennung
  (`parallelStreng`, Schalter in der Ansicht) mit einem Dummy je ungerader Klasse.
  Ausgeschaltet fährt der Übrige gegen den ersten der nächsten Klasse im gleichen Boot.
  Einen Dummy gibt es dann nur bei ungerader Starterzahl eines Bootstyps.
  Die frühere Paarung nur nach Bootstyp (Dolphin gegen Klasse 3) gibt es nicht mehr.
  Dummy, Bootstypen und Blöcke stehen nicht im Regelbuch – sie sind Organisation.
- **Reihenfolge:** Die Klassen bleiben zusammen.
  „Klassen in der Reihenfolge ihrer kleinsten Startnummer“ ordnet die Klassen eines Bootstyps nach ihrer kleinsten
  Nummer statt in der festen Folge.
  Gedacht ist das für klassische Nummern; bei Nummern je Klasse stünde Dolphin wegen des „E“ hinter den Klassen 1 bis 3.
  Blöcke (kleines und großes Paar im Wechsel) und der Tausch im 2. Versuch sind geblieben.
  Der frühere Start eines Paares ist der 1. Versuch (Attempt).
- **Festgeschriebener Plan:**
  - Einfrieren: „Verzahnung festschreiben“ friert den Vorlauf ein
    (`parallelPlaene.pre`: je Start die Starter-IDs auf A und B, Attempt, Block, Bootstyp
    – keine Namen, keine Startnummern).
    Danach wird er nicht neu gerechnet.
  - Meldungen: Die Ansicht meldet Nachgemeldete, entfernte Starter und Klassenwechsel, statt sie einzureihen.
    An der Stelle eines entfernten Starters steht ein Dummy.
    Fehlen beide eines Paares, steht der Start als „entfällt“ an seiner Position.
  - Nachzügler: Aufgenommen werden sie durch Freigeben und erneutes Festschreiben.
    Ein älterer Stand mit festgeschriebener Verzahnung bekommt seinen Plan beim Laden.
  - Sicherung und Vorlage: Der Plan steht in der Sicherung, nicht in der Vorlage (er hängt an den Startern);
    `parallelStreng` reist in beiden mit.
    Bleibt beim Anwenden einer Vorlage der hiesige feste Plan stehen
    (hier festgeschrieben, und die Vorlage bringt die Sperre mit),
    bleiben auch die drei Schalter, nach denen er gerechnet wurde
    (`parallelStreng`, `class4Small`, `parallelOrderByStartNr`) – wie im Reducer, der sie bei gesetzter Sperre sperrt.
- **Klassische Startnummern** mit der Reihenfolge „Parallel-Slalom“ folgen demselben Plan wie die Anzeige
  (`vorlaufPlan`), bei festgeschriebener Verzahnung also dem festen.
  Erneutes Vergeben ändert dann keine Nummer.
  Wer nach dem Festschreiben gemeldet wurde, bekommt die nächste Nummer hinter allen anderen.
  Die Nummer eines entfernten Starters bleibt als Lücke frei; niemand rückt auf.

## WKR-Listen des Vorlaufs

`src/lib/parallelBogen.ts`, „Listen → Wettkampfrichter-Listen → Parallel-Slalom“.

- Je Runde sechs Listen: je Racecourse A und B Zeit, Steg und Fahrweg aus dem Aufbau `parallel`
  (`aufbauFuer` in `src/config/catalog.ts`; im Stand steht dafür nichts, es gibt genau einen).
- Die Zeilen sind die Starts des **festgeschriebenen** Plans in seiner Reihenfolge, über alle Klassen.
  Vorn stehen die Spalten Start, Nr., Klasse, Attempt.
  Zeile n ist auf allen sechs Listen derselbe Start.
- Ohne festgeschriebenen Plan gibt es keine Liste, nur den Hinweis.
- Annahmen (Organisation, nicht Regel 960): keine Leerzeilen;
  ein Dummy und ein entfallener Start stehen als schraffierte Zeile ohne Eingabe;
  am Ende eines Blocks steht eine Linie.
- Die Steg-Liste hat hier keine Spalte „Bemerkung“ (`ohneSpalten` am Aufbau, `config/aufbauten/parallel.yaml`).
  Die Fahrweg-Liste hat eine Σ-Spalte hinter „Disq.“ wie die Fahrweg-Listen des Manövrierens mit Bojen.
- `config/validate.ts` prüft, dass die Spalten der Parallel-Listen nicht von der Klasse abhängen (`PARALLEL_KLASSEN`).

**Englische Spaltenköpfe:**

- Steg-Liste nach Regel 960 (Pkt. 4.1 „leaving the starting pontoon“, 4.1.1 „Mooring“):
  „Leaving: codes / pen.“ und „Mooring: codes / pen.“ – auch auf der Steg-Liste des Manövrierens.
- Auf den englischen Wertungslisten ebenso nach dem Rulebook gekürzt: „Leav.“ und „Moor.“ statt „Dep.“ und „Moor“
  (Entscheidung vom 15.11.2026: Die Sprache des Rulebooks hat Vorrang).
- Die übrigen englischen Spaltenköpfe sind gegen Regel 960 geprüft:
  - „Rank.“ (5.2.1/5.2.2 „ranking“), „Time“, „Pen.“ („penalties“),
  - „Time incl. pen.“ („times including penalties“) – jetzt auch je Attempt auf der Gesamtliste
    und dem Result einer Runde statt „Total“,
  - „Knots“ („knots test penalties“), „Combined time“ (5.2.2 „combined times“, 5.2.6 „best combined times“),
  - „UIM points“, „UIM combined points“ (5.2.3), „Fin.“ („finishing line“), „MOB“ („man-over-board“),
  - „DSQ“ (Rulebook, allgemeiner Teil: „DSQ – Disqualified“).

**Seiten:** Eine Seite endet nur am Blockende (`gruppenSeiten` in `src/lib/paging.ts`; ein Block sind 4 bzw. 2 Starts).

- **Jede Liste teilt für sich, mit so wenigen Seiten wie möglich** (Entscheidung vom 15.11.2026).
  Die Zeit-Liste fasst mehr Starts als Steg und Fahrweg.
  Seite n trägt also nicht überall dieselben Starts; was zusammengehört, sagt die Spalte „Start“.
- **Seiten ausgleichen** (Entscheidung vom 15.11.2026 abends): Auf diese Seitenzahl werden die Starts gleichmäßig
  verteilt – statt 32 + 32 + 6 also 24 + 24 + 22.
  Erst die kleinste Obergrenze je Seite, mit der es bei der Seitenzahl bleibt.
  Dann die Blöcke so verteilt, dass die kürzeste Seite so lang wie möglich ist (`gruppenVerteilen`).
  40 Starts bei 12 je Seite also 12 + 12 + 8 + 8, nicht 12 + 12 + 12 + 4.
  Bei gleich guten Verteilungen sind die vorderen Seiten die volleren.
  Laufzettel-Kästchen und QR-Seitennummern folgen von selbst, weil die Zahl der Seiten gleich bleibt.
- „Starter je Seite“ und „Teilen ab“ gelten als Obergrenze, abgerundet auf Blockenden (`gruppenKapazitaet`).
- Gemessen (Chromium, A4 hoch, Beschreibung vorn): Zeit 32–34 Starts je Seite, Steg 24, Fahrweg 28–30;
  zweisprachig Zeit 32, Steg 16–18, Fahrweg 24–26.
- Listen-Option „jede zweite Zeile grau“ (`parallelZebra`): **Vorgabe an** (Entscheidung vom 15.11.2026),
  abschaltbar, in Sicherung und Vorlage.
  Die Zeile eines Dummys bleibt schraffiert und hebt sich mit kräftigerer Schraffur und kursivem „Dummy“ davon ab.

**QR-Code:** Format `ALC2` mit Runde und Racecourse
(`ALC2.<Kennung>.<Regelwerk>.<Aufbau>.<Runde>.<A|B>[.<Liste>.S<Seite>]`, `src/lib/qr.ts`).
Der Laufzettel nennt seinen Racecourse und öffnet nur dessen Listen.
`ALC1` bleibt für das Manövrieren und wird weiter gelesen.

**Laufzettel** je Runde statt je Klasse und Lauf, **immer getrennt je Racecourse** (Entscheidung vom 15.11.2026 abends).

- Ein Zettel A und ein Zettel B, jeder mit den Kästchen seiner drei Listen.
- **Ein Kästchen je gedrucktem Blatt:** Jede Liste hat ihre eigene Seitenzahl
  (`components/ParallelMessung.vue` misst je Liste).
- Jeder Zettel hat einen eigenen QR-Code, der in der Erfassung nur diese drei Listen öffnet
  (`rundenZettel` in `src/lib/parallelBogen.ts`, `src/components/ParallelLaufzettel.vue`).
- Er dient dazu, die richtigen Blätter einzusammeln und zusammenzuhalten.
- Die Schritte der Auswertung (Ergebnisse sortiert, geprüft, unterschrieben, ausgehängt, an die Mannschaftsleiter
  geschickt) stehen nur auf Zettel A – die Runde wird einmal ausgewertet.
  Zettel B sagt an derselben Stelle, wo sie stehen: „Auswertung: siehe Laufzettel Parcours A“ (16.11.2026).
- Passen die Kästchen auch dicht gesetzt nicht, sagt es der Zettel; nichts wird zu Seitenbereichen zusammengefasst.

## Erfassung im Parallelslalom

- Unter einem Regelwerk mit Parallelslalom steht die Disziplin zur Wahl;
  im Parallelslalom wählt man Racecourse und Liste.
- Ist oben ein Racecourse gewählt, erscheint unten nichts vom anderen – weder in den Reitern noch unter
  „alle untereinander“ (Entscheidung vom 15.11.2026).
  Der Laufzettel eines Racecourse öffnet nur dessen drei Listen.
- Im Kopf der Erfassungstabelle trägt auch die letzte Unter-Spalte der zweiten Kopfzeile ihre senkrechte Linie,
  z. B. „R“ unter „Ziel“ vor „Disq.“ (Start und Ziel haben je zwei Zellen „L“ und „R“).
  Vorher fehlte sie, weil die Regel „rechts außen keine Linie“ auch dort griff (`styles/erfassung.css`).
  Auf den gedruckten Bögen war sie schon da.
- Gespeichert wird je Starter-ID und Attempt unter dem Lauf-Schlüssel `parallel:pre/1` bzw. `/2`
  (`src/lib/parallelSchluessel.ts`).
  Der Racecourse steht nicht im Schlüssel; er folgt aus dem Plan (der frühere Start ist der 1. Attempt).
- Die Zeile eines Dummys hat keine Felder und wird übersprungen.
- Diese Werte gelten nicht als „verborgen“, solange Plan, Attempt und Feld zu einer Liste gehören.

**Plan und Werte:**

- Sobald zum Vorlauf Werte erfasst sind, bleibt sein Plan festgeschrieben, auch bei freigegebener Verzahnung.
  Die Schalter des Plans (streng, Klasse 4 klein, Reihenfolge) sind dann gesperrt (`vorlaufGebunden`),
  auch gegenüber einer Vorlage ohne Sperre.
- Gelöst wird das **nur über „Alle erfassten Werte löschen“** (Entscheidung vom 15.11.2026).
  Ist die Verzahnung dann offen, entfällt der Plan im selben Schritt (`reducer` in `src/state/reducer.ts`),
  und das nächste Festschreiben rechnet neu.
- Das Leeren des letzten einzelnen Felds löst ihn nicht – wer einen Tippfehler berichtigt, verlöre sonst den Plan,
  nach dem gedruckt ist. Auch ein Neuladen lässt ihn stehen.
- Im Verlauf heißt eine Eingabe im Vorlauf „Parallel-Slalom Vorlauf, 1. Versuch“ statt „1. Lauf“
  (`runde` in `src/lib/verlauf.ts`).

## race officials

Die WKR-Einteilung hat für den Parallelslalom eine zweite Tabelle mit Racecourse A und B (Zeit, Steg, Fahrweg).
Die Namen stehen in `einteilung` unter den festen Kennungen `racecourse-a`/`racecourse-b` –
in der Sicherung, nicht in der Vorlage.
Die Sprache des Bogens (deutsch, englisch, zweisprachig) steht neben jedem Namen.
Sie gilt je Racecourse und Liste, getrennt vom Manövrieren (Entscheidung vom 15.11.2026).

## Startliste je Racecourse

Entscheidung vom 15.11.2026.
Unter „Listen → Starterlisten“ gibt es unter Regel 960 die Art „Parallel-Slalom“.
Je festgeschriebener Runde (Auswahl „Runde“) entweder die gemeinsame Startliste (A und B nebeneinander,
wie in der Druckdatei) oder je Racecourse eine eigene zum Aushang am jeweiligen Parcours.
Auswahl „Parcours“: nebeneinander, nur A, nur B, je Parcours eine eigene Liste.

- Die Liste eines Racecourse hat die Spalten Start, Attempt, Klasse, Nr., Name, Vorname, Herkunft.
- Die Start-Nummern sind die der gemeinsamen Liste und der Listen der race officials.
- Ein Dummy und ein entfallener Start sind schraffierte Zeilen
  (`racecourse` in `components/ParallelStartlisten.vue`;
  `StarterWahl.runde`/`racecourse` in `src/lib/starterlisten.ts`).
- Sie steht nicht in der Druckdatei.
- Beide Formen (auch die gemeinsame in der Druckdatei) sind abwechselnd weiß und grau wie die Listen der race officials.
  Es gilt dieselbe Einstellung `parallelZebra`, über die ganze Liste gezählt.
  Eine Zeile ohne Starter zählt mit, bleibt aber weiß; die Zelle des Dummys ist schraffiert.
- Die Seiten werden nicht ausgeglichen: Ein Block (4 bzw. 2 Starts) bleibt auf einer Seite.
  Eine letzte Seite mit 2 oder 4 Zeilen ist in Ordnung (Entscheidung vom 15.11.2026;
  im Test mit gemessenen Zeilenhöhen belegt, `src/views/ParallelListen.test.ts`).

## Wertung des Vorlaufs

**Wertung je Disziplin:** Stichentscheid und Wertungsläufe stehen im Regelwerk allgemein
(`stichentscheid`, `wertungslaeufe` – gelten für das Manövrieren).
Wo eine Disziplin abweicht, stehen sie unter `wertungJeDisziplin.<disziplin>` (`wertungDer` in `src/lib/ergebnis.ts`).
`uim-2026.yaml` nennt dort für `parallel` zwei Läufe ohne Streichlauf und den Stichentscheid `besterLauf`
(Regel 960, Pkt. 4.4 und 5.2.6, im YAML wörtlich zitiert).
`klassenErgebnis` nimmt dafür wahlweise eine Wertungseinheit
(`WertungsEinheit`: Disziplin, Lauf-Schlüssel, Listen, Läufe).
Ohne sie rechnet es wie bisher: Die Wertung des Manövrierens unter DM und UIM ist unverändert
(Regressionstest in `src/lib/parallelErgebnis.test.ts`).

**Ergebnis des Vorlaufs** (`src/lib/parallelErgebnis.ts`, „Listen → Wertungslisten → Parallel-Slalom“), nach Pkt. 5.2.2:

- Es zählt die Summe beider Attempts mit Strafsekunden.
  Bei gleicher Summe entscheidet der bessere Einzelversuch (Pkt. 5.2.6), sonst ist der Platz geteilt.
- Ein disqualifizierter Attempt (auch X „Nicht gestartet“) disqualifiziert für die ganze Runde.
- Gewertet wird, wer im festgeschriebenen Plan steht; der Racecourse je Attempt kommt aus dem Plan.
- Annahmen (im Code gekennzeichnet):
  - Offene stehen wie im Manövrieren ohne Ergebnis auf Platz 1.
    Beide Attempts zählen von Anfang an; einen Zwischenstand nach dem 1. Attempt gibt es nicht.
  - Disqualifizierte teilen den letzten Platz ohne Punkte.
  - „Qualified“ (die besten vier, Pkt. 4.4) und Punkte erscheinen erst, wenn die Klasse vollständig ist.
  - Ab Platz 5 stehen die UIM points des Platzes im Vorlauf.
- Aufeinanderfolgende Zeilen mit „Qualified“ sind in der Spalte „UIM points“ EINE Zelle; „Qualified“ steht schräg darin
  (Entscheidung vom 15.11.2026).
  Im Halbfinale gilt das ebenso für „Final 1–2“ und „Small final“; „Re-run“ bleibt je Zeile.
  Winkel und Größe passen den Text in die Zelle.
  Sie bleibt weiß, auch wenn eine graue Zeile darin liegt, und kein Seitenwechsel trennt sie
  (`gebunden` in `src/lib/seiten.ts` und `components/ListenDokument.vue`).

**Gleichstand an der Grenze 4/5,** den auch der Stichentscheid nicht trennt (Entscheidungen vom 15.11.2026):

- Die Betroffenen tragen „Re-run“, und die **ganze Klasse bleibt ohne „Qualified“**, bis der Re-run gefahren ist.
  Auch wer klar davor steht, hat so lange keinen Vermerk.
- Wer dahinter steht, hat seine **UIM points schon vor dem Re-run**.
- Der Re-run entscheidet nur die Reihenfolge der Gleichstehenden.
  Wer darin disqualifiziert wird, bekommt den hinteren Platz der Gruppe (z. B. Platz 5) mit dessen Punkten,
  nicht den letzten (`disqInWiederholungDesVorlaufs: 'heat'` in `PARALLEL_ANNAHMEN`).
  Die Plätze dahinter ändern sich dadurch nicht mehr.
  Im Gesamtergebnis der Stage steht er dann als „Disq.“ ohne Zeit (nach dem Re-run zählt nur dessen Zeit).
- Die Ansicht warnt deutlich, und `entschieden` ist falsch – daran hängt das Weiterkommen
  (Pkt. 5.2.6 „must re-run both attempts“; siehe [Runden nach dem Vorlauf](#runden-nach-dem-vorlauf)).

**Wertungslisten des Vorlaufs:**

- Je Klasse die Liste der Attempts (`components/ergebnis/ParallelAttemptsBlatt.vue`):
  zwei Tabellen auf einem Blatt mit den Strafsekunden an jeder Stelle des Fahrwegs.
  **Ohne Spalte „Platz“** – es zählt die Summe beider Attempts.
  Trotzdem „nach Platz“ sortiert: beste Zeit zuerst, Disqualifizierte am Ende, in beiden Ansichten.
- Dazu das Result (`ErgebnisGesamtBlatt.vue` mit `runde`): je Attempt Racecourse, Time, Pen., „Time incl. pen.“,
  dann „Combined time“ und „UIM points“.
- Die Ansicht „nach Attempt / nach Racecourse“ teilt die Liste der Attempts in „1st/2nd attempt“ mit der Spalte
  Racecourse oder in „Racecourse A/B“ mit der Spalte Attempt.
  Gemerkt wie die Fassung (`lib/merken.ts`), ohne einen Wert oder Zeitstempel zu ändern.
- Zeitstempel der letzten Änderung (`listenStand` unter `parallel:pre/<klasse>/<attempt>` und `…/gesamt`).
  Beide Listen tragen den jüngsten der Klasse in der Runde.
- Fuß mit O.O.D. und „Time of posting“, eigene Seitenteilung und „doppelseitig drucken“
  wie bei den übrigen Wertungslisten.
- Die Druckdatei hat dafür den Teil „Wertungslisten Parallel-Slalom“ hinter denen des Manövrierens.

## Runden nach dem Vorlauf

`src/lib/parallelStage.ts`, `src/components/ParallelRunden.vue`.
Die Ansicht „Verzahnung → Parallel-Slalom“ zeigt sie unter dem Plan des Vorlaufs, außerhalb der Sperre der Verzahnung.

- Je Klasse zeigt die Ansicht, wo sie steht.
  Sie bietet die nächste Runde zum Festschreiben an, sobald die Runde davor vollständig erfasst ist
  (Actions `PARALLEL_RUNDE_FESTSCHREIBEN` / `PARALLEL_RUNDE_LOESEN`; wer fährt, rechnet der Reducer).
- Der Plan einer Runde (`parallelPlaene.semi`, `.final`, `rerun-<runde>-<n>`) sammelt die Starts aller Klassen
  in der Folge des Festschreibens.
  Jeder Start trägt seine `klasse`, in den Finals `finale` (1 = um Platz 1 und 2, 3 = um Platz 3 und 4).
- Damit gibt es für jede Runde dieselben Listen wie für den Vorlauf:
  WKR-Listen, Laufzettel und QR-Code je Runde, die Runden-Auswahl in der Erfassung,
  Beispielwerte („Leere Zeilen der Runde füllen“), Wertungslisten (Attempts, Result) mit eigenem Zeitstempel.

**Halbfinale** (Pkt. 4.4): die besten vier.
Paare „according to the personal number“: nach Startnummer, die kleinere auf Racecourse A.
Alle vier werden gemeinsam nach der Summe beider Attempts gereiht.

**Finals:** 1. und 2. um Platz 1 und 2, 3. und 4. um Platz 3 und 4.
Gewertet wird je Paar; ein Gleichstand bleibt stehen (Pkt. 5.2.6 „dead-heat result“).

**Re-run** (Pkt. 5.2.6):

- Bei einem Gleichstand an einer Grenze (Vorlauf 4/5, Halbfinale 2/3) wiederholen die Betroffenen beide Attempts.
  Danach zählt für ihre Reihenfolge nur die Wiederholung; sie vergibt die geteilten Plätze.
- Die Re-run-Fahrer bleiben dabei auf den Plätzen, um die sie gleichauf lagen –
  gleich, wie schnell oder langsam ihre Wiederholung ist (mit Test belegt, `src/lib/parallelStage.test.ts`).
  Das gilt auch für den, der darin disqualifiziert wird (hinterer Platz der Gruppe).
- Bleibt es gleich, folgt die nächste Wiederholung.
- Im Halbfinale steht, solange eine Wiederholung aussteht, bei niemandem, welches Finale er fährt.
- Hat die Wiederholung Plätze entschieden, trägt jeder davon ein Sternchen (Entscheidung vom 15.11.2026):
  im Result der Runde und im Gesamtergebnis der Stage (dort mit der Summe der Wiederholung).
  Die Fußnote sagt es nach Pkt. 5.2.6 („Ranking decided by the re-run …“).
- Das Zeichen ist dasselbe wie beim Stichentscheid; steht beides auf einer Seite, nennt die Fußnote beides
  (`durchWiederholung` in `src/lib/parallelErgebnis.ts`, `stageDurchWiederholung` in `src/lib/parallelStage.ts`).
  Die Liste der Wiederholung selbst hat keines.

**Festschreiben und Löschen:** von Hand, je Klasse.
Der Knopf heißt „… löschen“, nicht „lösen“ (Entscheidung vom 15.11.2026: Er löscht die Werte).

- Ändert ein Protest das Ergebnis davor, bleibt der Plan, wie er gedruckt ist, und gilt als veraltet (Warnung).
- Solange ein Plan der Klasse veraltet ist, hat sie kein Gesamtergebnis der Stage und keine Einzelwertung.
  Wertungslisten und Druckdatei nennen die Klasse mit der Runde
  („Plan passt nicht mehr zum Ergebnis davor: löschen und neu festschreiben“).
- Gelöscht wird nur die letzte Runde der Klasse (oder eine, die nicht mehr gebraucht wird), nach Rückfrage.
  Die Rückfrage nennt, wie viele erfasste Werte (Zeiten, Fehler, Disqualifikationen, Haken „erfasst“)
  von wie vielen Startern verloren gehen (`rundenWerteZahl` in `src/lib/parallelStage.ts`).
  Zurück geht es nur über den Verlauf („Parallel-Slalom: Halbfinale gelöscht (Klasse 1)“).
- „Alle erfassten Werte löschen“ nimmt die Runden nach dem Vorlauf mit.
  Entfällt der Plan des Vorlaufs bei offener Verzahnung, gehen die Pläne und Werte der Runden danach mit.

**Annahmen** zu Fällen, die Regel 960 nicht regelt.
Sie sind vom Veranstalter noch zu bestätigen, im Code gekennzeichnet und an einer Stelle umstellbar
(`PARALLEL_ANNAHMEN` in `src/lib/parallelErgebnis.ts`):

- 3 Gewertete im Vorlauf → Halbfinale mit Dummy; der Dritte hat Platz 3 ohne Kleines Finale (Platz 3 und 4).
- 2 Gewertete → direkt das Finale; 1 Gewerteter → Platz 1 aus dem Vorlauf.
- Disqualifikation in Halbfinale oder Finale (Pkt. 5.2.2 „ranked last in the relevant heat“):
  Platz 4 der vier bzw. der hintere Platz des Paars; die Punkte dieses Platzes bleiben.
  Zwei Disqualifizierte teilen ihn sich.
- Disqualifikation in einer Wiederholung (zum Vorlauf wie zum Halbfinale): hinterer Platz der Gruppe mit dessen Punkten
  (zum Vorlauf Entscheidung vom 15.11.2026).
  Werden alle der Gruppe disqualifiziert, teilen sie sich diesen Platz.
- Das Kleine Finale (Platz 3 und 4) wird zuerst gefahren; jedes Paar fährt seine beiden Attempts nacheinander.

**Gesamtergebnis der Stage** (`stageErgebnis`, Blatt `components/ergebnis/ParallelStageBlatt.vue`, „Overall results“):

- Plätze 1 bis 4 aus den Finals, ab Platz 5 aus dem Vorlauf.
  Dazu die Summe aus der Runde, die den Platz bestimmt hat, und die UIM points (Pkt. 5.1).
- Eine Spalte mit dieser Runde gibt es nicht (Entscheidung vom 15.11.2026).
  Der Platz sagt es: Unter Platz 4 ist alles aus dem Vorlauf.
- Es entsteht erst, wenn die Klasse alle ihre Runden gefahren ist.
  Bis dahin nennt ein Hinweis die Runde, an der es hängt.
  Das tut auch der Unfertig-Hinweis der Druckdatei, sobald zum Parallelslalom etwas erfasst ist.
- In der Druckdatei lassen sich Gesamtergebnis und Runden einzeln abwählen.

## Abmelden

Wer nach Wettkampfbeginn als „nicht gestartet“ eingetragen wird, bekommt das X auch im Parallelslalom
(`src/lib/abmeldung.ts`).

- Es steht in jedem Attempt jeder festgeschriebenen Runde, in der er im Plan steht und zu dem noch nichts erfasst ist.
- Wird eine Runde erst danach festgeschrieben, kommt das X dann – nur für die Klasse, die festgeschrieben wird.
- Ein von Hand entferntes X (er fährt doch) kommt nicht zurück.
- „Werte des Gewählten löschen“ setzt das X der Abgemeldeten in den gelöschten Läufen und Runden wieder;
  sie bleiben abgemeldet.
- Beispielwerte lassen Abgemeldete aus.
- Das X einer Abmeldung macht eine Disziplin nicht zur „gefahrenen“
  (`disziplinGefahren` in `src/lib/disziplinen.ts` übergeht Zeilen Abgemeldeter, in denen nur das X steht).
  Wer nur das Manövrieren fährt und danach jemanden abmeldet, behält seine Einzelwertung.

## Betrieb: Start-Freigabe und Anzeigetafel

Etappe E4 des Plans zur Übernahme der Tafel (16.11.2026); das Allgemeine steht in
[funktionen.md](funktionen.md#betrieb-start-freigabe-und-anzeigetafel). Unter DM gibt es den Bereich nicht.
Die Auslegungen stehen mit Datum in `BETRIEB_ANNAHMEN` (`src/betrieb/annahmen.ts`) und sind noch zu bestätigen.

- **Bereich „Parallel slalom“** (`parallel`) hinter den Parcours, sobald jemand in einer Klasse bis 5 fährt
  oder eine Runde festgeschrieben ist (`src/betrieb/folge.ts`).
- **Punkte sind die festgeschriebenen Runden**, in der Folge, in der sie gefahren werden: Vorlauf, seine
  Wiederholungen, Halbfinale, dessen Wiederholungen, Finals. Eine Runde ohne festgeschriebenen Plan steht nicht im
  Programm. Ein Re-run, der erst nach dem Halbfinale festgeschrieben wird, ordnet sich davor ein und wartet als
  nicht begonnene Runde („Vorlauf – Wiederholung beginnen“). Das kleine Finale ist keine eigene Runde: Es steht
  im Plan der Finals vorn, und jeder Start nennt sein Finale („Small final (3rd and 4th place)“, „Final“).
- **Die Runden laufen je Klasse für sich** (Halbfinale, Finals und Re-runs werden je Klasse festgeschrieben; Prüfung
  von E4, 16.11.2026, noch zu bestätigen): „Nachzuholen“ ist ein Start nur, wenn hinter ihm schon ein Start derselben
  Runde gezeigt ist. Ein Re-run, der festgeschrieben wird, während das Halbfinale läuft, kommt nach „Re-run beginnen“
  also dran; das Halbfinale einer Klasse, das erst während der Finals einer anderen festgeschrieben wird, ist sofort
  freigegeben. Gefahren wird in der Folge der Runden, aber ein Paar im Boot fährt erst seinen anderen Attempt. Als
  laufende Runde nennen Tafel und Zuschauerliste die des nächsten Starts.
- Betrieb ist möglich, sobald eine Runde festgeschrieben ist – unabhängig von der Sperre der Verzahnung.
- **Starts sind die Paare des Plans**, in seiner Reihenfolge – dieselbe wie auf den Listen der race officials.
  Die Kennung eines Starts bilden Runde, Attempt und die gespeicherten IDs auf A und B (`parallelPlaene[runde].starts`),
  nie die aufgelösten Paare: Wird ein Starter gelöscht, bleibt ein schon gezeigter Start derselbe und taucht nicht
  wieder als offen auf (Kritik K8).
- **Leere Seite:** Steht auf einer Seite ein Dummy, ein gelöschter Starter oder ein X „nicht gestartet“ in diesem
  Attempt, zeigt die Anzeigetafel sie leer („–“); der Gegner fährt – so fährt ein Halbfinale mit einer abgemeldeten
  Seite. Der Start entfällt erst, wenn auf keiner Seite jemand fährt (beide gelöscht, beide X, Dummy gegen X).
  Die Sicht sagt nicht, warum eine Seite leer ist; die Zuschauerliste (öffentlicher Link) nennt auch in ihren
  internen Kennungen nur, wer fährt.
- **Anzeigetafel:** Racecourse A und B nebeneinander, je Seite Startnummer, Name und Herkunft; darüber Klasse,
  Runde und Attempt („Class Dolphin“, „Preliminary heat · Attempt 2“), auf Wunsch das Paar davor. Englisch nach dem
  Rulebook, deutsch als Einstellung („Vorlauf · 2. Versuch“, „Parcours A“). Die gemeinsame Tafel nimmt den
  Parallelslalom von selbst erst dazu, wenn eine Runde begonnen ist; „Eigene Anzeigetafel“ öffnet `#/anzeige/parallel`.
- **Start-Freigabe:** „Vorlauf beginnen“ (bzw. die nächste Runde), „Nächster Start“, „Zurück“, Meldung,
  „Anderen Starter wählen“ (die Suche findet ein Paar über beide Nummern), „Einsteigen ab …“ Runde und Klasse.
  Zurückstellen nimmt das ganze Paar – seine offenen Attempts der Runde –, Einreihen und gezieltes Zeigen holen die
  wartenden Attempts des Paares in ihrer Folge mit, gezieltes Zeigen nach dem Vorlauf auch den direkt folgenden (im
  Vorlauf wechseln dazwischen die Bootstypen, dort bleibt der Plan); „Als Nächster“ und gezielt Gezeigtes kommen hinter
  das zuletzt Gezeigte ihrer Runde, „Ans Ende der Runde“ ans Ende ihrer Runde, nie in eine spätere. Klassen aussetzen oder vorziehen und Starts verschieben gibt es
  hier nicht: Der Plan gibt die Folge vor (Paare, Blöcke im Wechsel der Bootstypen, Tausch zum 2. Attempt); die
  Karte sagt das statt „Klassen · Boot fehlt“.
- **Startliste und Zuschauerliste:** je Zeile bzw. Karte ein Paar mit Racecourse A und B; „am Steg“ und „vor Steg“
  wie im Manövrieren, aber **ohne geschätzte Wartezeit**: Paarstarts werden nicht gemessen – ihr Takt (zwei Boote
  zugleich, kurzer Racecourse, Tausch zum 2. Attempt) verzerrte die Abstände der Klassen fürs Manövrieren, und eine
  eigene Vorgabe gibt es nicht. In der Startliste wird nicht gezogen.
- Der Betrieb ändert weder die Pläne noch die Werte der Runden.

## Dummys und Wörter

- Die Dummys je Bootstyp sind eine Anzahl.
- Englisch heißen die einzelnen Starts „starts“; „heat“ ist im Regelbuch die Runde
  (Pkt. 5.2.2 „preliminary heat / semi-finals / finals“).
- Die Runden heißen „Preliminary heat“, „Semi-finals“, „Finals“, „Re-run“.
  „Small final“ trägt den Zusatz „3rd and 4th place“ (Entscheidung des Nutzers;
  Regel 960 nennt nur „compete for the 3rd and 4th place“).
- Deutsch: Vorlauf, Halbfinale, Finale, Kleines Finale (Platz 3 und 4), Wiederholung.

## Einzelwertung

**Einzelwertung** („Individual competition“, Regel 960, Pkt. 5.1, 5.2.3).
Umsetzung: `src/lib/einzelwertung.ts`, `src/lib/disziplinen.ts`, Blatt `components/ergebnis/EinzelwertungBlatt.vue`,
Ansicht „Listen → Wertungslisten → Einzelwertung“ und Teil „Einzelwertung“ der Druckdatei.

- Ganz vorn der Platz der Einzelwertung, wie auf allen Wertungslisten (Entscheidung vom 15.11.2026 abends).
- Dann je Klasse und Disziplin drei Spalten aus deren Gesamtergebnis: Zeit, Platz, UIM points.
  Manövrieren: die gewertete Zeit der Gesamtliste, also der bessere Versuch mit Strafen und Knoten.
  Parallelslalom: die Summe beider Attempts in der Runde, die den Platz bestimmt hat, ab Platz 5 also im Vorlauf.
- Dahinter die Summe der Punkte und nur bei Punktgleichen die „Combined time“
  (Entscheidung vom 15.11.2026; keine Spalte „Heat“, kein Fuß dazu).
- Mit Zeitstempel (dem jüngsten der Klasse aus beiden Disziplinen), Unterschriftszeile „O.O.D.“
  und Feld „Time of posting“.

**Welche Disziplin zählt** (Entscheidungen vom 15.11.2026):

- Es gibt keine Wahl: Eine Disziplin zählt, sobald zu ihr der erste Wert erfasst ist.
  Ohne Werte fehlt sie in Einzelwertung, Mannschaftswertung und Druckdatei.
- Das gilt in beide Richtungen (auch nur der Parallelslalom ohne Manövrieren).
  Nirgends wird eine Reihenfolge der Disziplinen vorausgesetzt.
- Ist nur eine gefahren, entsteht die Einzelwertung aus ihr allein (ihre drei Spalten und die Summe;
  die andere hat keine Spalten).
- Die Liste entsteht, sobald jede Disziplin fertig ist, die für die Klasse zählt.
- Die UIM points des Manövrierens gibt es erst, wenn auch die **Knoten** erfasst sind
  (Pkt. 5.2.1 „best times including knots test penalties“; `klasseFertig` in `src/lib/pokal.ts`).
  Dafür reicht ein Wert oder der Haken „erfasst“ der Knoten-Liste; unter der DM bleibt es unverändert.
- Wer in einer Disziplin disqualifiziert ist, hat dort 0 Punkte.
- Bei gleicher Punktsumme entscheidet nach Pkt. 5.2.6 die Zeit:
  „the sum of his/her better manoeuvring attempt (including penalties) and both his/her parallel slalom attempts“.
  Sie steht bei Punktgleichen in einer eigenen Spalte; ein Sternchen am Platz zeigt den Stichentscheid.

### Disziplin nicht werten

`AppState.nichtWerten`, Action `SET_NICHT_WERTEN`, `components/NichtWertenWahl.vue` unter der Einzelwertung.

- Wird eine Disziplin in einer Klasse abgebrochen, zählt sie für diese Klasse nicht.
- Ob sie dann auch für fertige Klassen gestrichen wird, entscheidet der O.O.D. vor Ort.
  Dafür gibt es den Schalter je Disziplin und Klasse, mit der Abkürzung „Alle Klassen“.
- Regel 960 regelt das nicht. Sie sagt nur in Pkt. 5.1: „Drivers must complete the relevant stage and cross the
  finishing line in order to be classified for the stage.“
  Im Code und in der Oberfläche ist es als Entscheidung des O.O.D. gekennzeichnet.
- Einzel- und Mannschaftswertung folgen dem Schalter
  (auch die Wertungen nach Plätzen, wenn das Manövrieren gestrichen ist).
- Es nennen: das Blatt der Einzelwertung („Parallel slalom not scored – decision of the O.O.D.“),
  das Blatt der UIM-Mannschaftswertung, die Blätter der Wertung nach Plätzen (wenn das Manövrieren gestrichen ist)
  und die Ansicht.
  Ebenso die Listen der Disziplin selbst: die Gesamtliste des Manövrierens bzw. das Ergebnis jeder Runde
  und das Gesamtergebnis des Parallelslaloms der betroffenen Klasse (gleicher Fußhinweis).
- Auf diesen Listen **entfällt für die Klasse die Spalte „UIM points“** (Entscheidung vom 15.11.2026);
  Zeiten und Plätze bleiben.
- Wer weiterfährt, steht trotzdem da: Im Ergebnis des Vorlaufs und des Halbfinales bleibt die Spalte „UIM points“
  in derselben Form – der Block „Qualified“ (bzw. „Re-run“), im Halbfinale die Blöcke der Finals.
  Die übrigen Zellen sind leer; der Fußhinweis erklärt es (Entscheidung vom 15.11.2026, statt einer Spalte „Remark“).
  In den Finals und Wiederholungen gibt es die Spalte nicht
  (`ParallelErgebnisStapel.vue`, `ErgebnisStapel.vue`, `ParallelStageBlatt.vue`).
- Die Tabelle bleibt so breit wie das Blatt (Namen bekommen den Platz); die Seitenteilung ändert sich nicht.
  Im Browser gemessen: 45 Starter einer Klasse, 31/14 bzw. 32/13 Zeilen mit und ohne Spalte.
- Das Umschalten gilt als Änderung dieser Listen (`listenInhalte` in `src/lib/listenStand.ts`):
  Sie bekommen den Zeitpunkt, und mit ihnen Einzel- und Mannschaftswertung.
  Die Listen der Attempts behalten ihren: Sie tragen den jüngsten Zeitpunkt ihrer Attempts (`laeufeZeit`),
  und an denen ändert der Schalter nichts.
- Der Schalter gehört zu den Ergebnissen: in der Sicherung, nicht in Vorlage oder Teilnehmerdaten.
  „Werte löschen“ setzt ihn zurück.

### Mannschaftswertung UIM

Pkt. 5.1, 5.2.4.

- Sobald der Parallelslalom gefahren wird (oder eine Disziplin nicht gewertet wird),
  zählen je Starter die Punkte der Einzelwertung:
  die addierten Punkte der Disziplinen, die für seine Klasse zählen.
  Bei gleichen Punkten an der Grenze der Besten zählt der mit dem besseren Platz.
- Der Platz auf dem Blatt ist der der Einzelwertung, der Zeitstempel der jüngste über beide Disziplinen.
- Bis jede Klasse ihre Disziplinen beendet hat, ist sie ein Zwischenstand
  (der Fuß nennt je Klasse die offenen Läufe oder die offene Runde).
- Bei punktgleichen Mannschaften entscheidet nach Pkt. 5.2.6 die Summe der Punkte der „1st places“,
  dann der „2nd places“ usw. (`mitPlatz` in `src/lib/pokal.ts`, mit Test).
- Nur mit dem Manövrieren und unter der DM rechnet sie unverändert aus dessen Gesamtliste;
  unter Regel 960 erst mit erfassten Knoten.
  Die Wertungen nach Plätzen (1–3, 1–6) lesen immer nur das Manövrieren.

### Festlegungen zum Stichentscheid

Entscheidungen vom 15.11.2026 zu dem, was Pkt. 5.2.6 offen lässt;
an einer Stelle umstellbar: `EINZEL_FESTLEGUNGEN` in `src/lib/einzelwertung.ts`.

- Es zählen der bessere Versuch des Manövrierens **mit** den Strafen der Knoten
  und die beiden Attempts des Vorlaufs (nach einer Wiederholung deren Zeiten).
- Wem für den Stichentscheid eine Zeit fehlt, weil er in einer Disziplin disqualifiziert ist,
  steht **hinter** den Punktgleichen mit Zeit.
  Eine Disqualifikation ist eine Wertung, damit letzter Platz unter den Punktgleichen.
  Mehrere solche teilen sich diesen hinteren Platz.
- Der Fuß der Liste nennt die Regel auf jeder Seite mit Punktgleichen; mit nur einer Disziplin nur deren Zeit.
