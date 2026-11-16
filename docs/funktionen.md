# Was Alcatraz kann

Alles, was Alcatraz heute kann – nach Bereichen, ungefähr in der Reihenfolge eines Wettkampfs.
Warum etwas so ist, steht mit Datum in [entscheidungen.md](entscheidungen.md).
„Entscheidung vom …“ meint hier immer eine Entscheidung des Nutzers.
Betrieb ohne Internet, Sicherung und Verlauf: [betrieb.md](betrieb.md).
Aufbau und Entwickeln: [technik.md](technik.md).
Was noch fehlt: [stand.md](stand.md).

## Inhalt

- [Regelwerke und Begriffe](#regelwerke-und-begriffe)
- [Veranstaltung und Besetzung](#veranstaltung-und-besetzung)
- [Starter und Startnummern](#starter-und-startnummern)
- [Herkunft und Flaggen](#herkunft-und-flaggen)
- [Verwiegung](#verwiegung)
- [Verzahnung](#verzahnung)
- [Wettkampfrichter-Listen](#wettkampfrichter-listen)
- [Laufzettel und QR-Codes](#laufzettel-und-qr-codes)
- [Betrieb: Start-Freigabe und Anzeigetafel](#betrieb-start-freigabe-und-anzeigetafel)
- [Erfassung](#erfassung)
- [Wertung und Wertungslisten](#wertung-und-wertungslisten)
- [Mannschaftswertung](#mannschaftswertung)
- [Weitere Listen und Druck](#weitere-listen-und-druck)
- [Sperren und Prüfungen](#sperren-und-prüfungen)
- [Parallelslalom und Einzelwertung (Regel 960)](#parallelslalom-und-einzelwertung-regel-960)
- [Beispieldaten](#beispieldaten)

## Regelwerke und Begriffe

Alcatraz kennt zwei Regelwerke: das DM-Reglement 2026 (`dm-2026`) und UIM Regel 960 „Formula Future“ (`uim-2026`).
Regelwerke und Aufbauten stehen als YAML unter `src/config/`.
Unter der DM wird nur das Manövrieren gefahren, unter UIM auch der [Parallelslalom](parallelslalom.md).

**Begriffe nach den Regelbüchern:**

- Deutsch heißen die Listen „Wertungslisten“ (DM-Reglement C7).
- Englisch folgt dem UIM Circuit Rulebook, Regel 960: „driver“, „attempt“, „race number“, „race official“,
  „team manager“, „co-driver“, „extra weight“, „pontoon“, „results“, „ranking“, „dead heat“.
- Die Klasse E heißt unter UIM überall „Dolphin“ (`klassenNamen` im Regelwerk), unter DM „Klasse E“.
  Ihre Startnummern behalten das „E“ (`startNrPraefix`).
- Gewichte: „(statistisches) Durchschnittsgewicht“ und „Ausgleichsgewicht“ (DM-Reglement C3),
  englisch „average weight“ und „extra weight“ (UIM 960 Pkt. 3.7).
- Der Co-Pilot heißt im DM-Reglement „Co-Pilot“, im UIM-Regelbuch „co-driver“.
- Die Wörter des Parallelslaloms stehen unter [Dummys und Wörter](parallelslalom.md#dummys-und-wörter).

**Sprache der Listen:** Sie folgt dem Regelwerk, unabhängig von der Oberfläche
(`listenSprache` in `src/config/regelwerke/*.yaml`: DM deutsch, UIM englisch).
Nur für die Wettkampfrichter-Bögen lässt sie sich je Liste und Parcours wählen: deutsch, englisch oder zweisprachig.
Gewählt wird in der WKR-Einteilung neben jedem Namen, weil auf jedem Parcours eine eigene Gruppe sitzt.
Das geht nur, wo das Regelwerk Englisch anbietet (`src/lib/listensprache.ts`, `AppState.wkrSprachen`).

## Veranstaltung und Besetzung

Die Ansicht „Veranstaltung“ nimmt Name, Jahr, Zahl der Läufe, Art (Meisterschaft oder Clubmeisterschaft),
Herkunft (Verein, Bundesland, Land oder ohne), Regelwerk und Aufbau auf.

- Die WKR-Einteilung steht im Block „Besetzung“ dieser Ansicht, zusammen mit Booten und Co-Piloten je Klasse.
- Die Beispielansicht der Listen steht unter „Veranstaltung“ und im Assistenten.
  Unter UIM zeigt sie auch die Listen des Parallelslaloms je Racecourse.
  Sie zeigt die Namen der Einteilung nur an.
- Der Name des Co-Piloten steht – wie die Namen der Wettkampfrichter – nur in der Sicherung, nie in der Vorlage.
  Das Boot der Klasse steht auch in der Vorlage (`src/lib/besetzung.ts`).
- Eigene Aufbauten entstehen unter „Einstellungen“ (Assistent und YAML-Austausch).
- Die Beispieldaten stehen am Ende der Ansicht, siehe [Beispieldaten](#beispieldaten).

## Starter und Startnummern

Der Reiter „Starter“ führt die Starter je Klasse.
Sie kommen von Hand oder über den Austausch mit Excel (Import und Export).
Startnummern gibt es klassenbasiert (E01, 101 …) oder klassisch (fortlaufend).

Austausch mit Excel (`src/components/ExcelPanel.vue`, `src/import/tsv.ts`, `src/import/starterMerge.ts`):

- **Liste ersetzen** erkennt bisherige Starter an Klasse und Startnummer, dann an Klasse und Name wieder;
  sie behalten ihre ID und damit Gewicht und Platz in der Verzahnung.
  Kommt die Liste ohne Startnummern, behält ein Wiedererkannter seine bisherige Nummer;
  Nummern, die erst der Import vergibt, zählen beim Wiedererkennen nicht (16.11.2026).
- **Ergänzen** fügt nur neue Starter hinzu. Die Meldung zählt nur, wer wirklich dazukam,
  und nennt die übergangenen eigens (16.11.2026).
- **Starterliste kopieren** schreibt das Geschlecht in der Sprache der Oberfläche
  (M, W, D, k. A. bzw. M, F, D, n/a); der Import liest beide Schreibweisen.
„Automatisch vergeben“ nummeriert klassenbasiert jede Klasse in ihrer aktuellen Reihenfolge,
klassisch in der Startreihenfolge der Verzahnung.
Was ab wann gesperrt ist und was geprüft wird, steht unter [Sperren und Prüfungen](#sperren-und-prüfungen).
Wer für die Mannschaftswertung zählt, lässt sich wählen (siehe [Mannschaftswertung](#mannschaftswertung)).

## Herkunft und Flaggen

Für die Herkunft „Bundesland“ und „Land“ zeigen auf Wunsch die Flagge:
Starter-Reiter, Starter-, Vorsteg- und Gewichtslisten, Wertungslisten und Mannschaftswertung.
Formen: wie bisher (ausgeschrieben / Kürzel), Flagge + Kürzel, Flagge + ausgeschrieben oder nur Flagge.
Gewählt wird unter „Einstellungen → Listen“; die Mannschaftswertung hat die Wahl direkt bei der Liste.
Auf den Wettkampfrichter-Listen stehen keine Flaggen.
Entschieden wird an einer Stelle (`herkunftAnzeige` in `src/lib/origin.ts`),
gezeichnet von einer Komponente (`src/components/HerkunftText.vue`).

- **Zuordnung** (`src/domain/flaggen.ts`, `src/domain/staaten.ts`): Die Herkunft ist freier Text am Starter.
  - Bundesländer werden an Kürzel (BY, DE-BY), Namen und gängigen Schreibweisen (NRW, BaWü, Thueringen) erkannt.
  - Staaten an ISO-Codes (DE, DEU), IOC-Kürzeln (GER, NED, SUI – wie bei der UIM üblich)
    und deutschen und englischen Namen.
  - Bindewörter und „Saint“/„St.“ zählen nicht („Bosnia and Herzegovina“ = „Bosnia & Herzegovina“ =
    „Bosnien-Herzegowina“).
  - Die Namen der europäischen und der im Motorbootsport üblichen Staaten sind fest eingetragen;
    alle übrigen liefert der Browser.
  - Was nicht erkannt wird, steht als Text da; der Reiter „Starter“ nennt diese Angaben.
- **Nationen sind international** (`herkunftAnzeige` in `src/lib/origin.ts`):
  Auf einer englischen Liste (u. a. die Liste nach Pkt. 3.7, Mannschaftswertung, Starterlisten)
  steht ein erkannter Staat mit englischem Namen bzw. Kürzel, auch wenn er deutsch eingetragen ist
  („Litauen“ → „Lithuania“).
  Auf einer deutschen Liste steht er, wie er eingetragen ist.
- **Kürzel der Länder** (`laenderKuerzel` im YAML des Regelwerks, `KuerzelNorm` in `src/domain/kuerzel.ts`):
  - Unter der UIM tragen Staaten das Kürzel des IOC – GER, SUI, NED, LAT statt DEU, CHE, NLD, LVA.
  - Regel 209 „POSTING OF THE RESULTS“: „The nationality of all drivers – either by using a three letter abbreviation
    for the countries worldwide as listed by the IOC or as full names of the nations in English language.“
  - Dort wird jeder erkannte Staat zu diesem Kürzel, gleich wie er eingetragen ist
    („Germany“, „Deutschland“, „DEU“, „GER“ → GER), damit eine Nation auf einer Liste nicht unter zwei Codes steht.
  - Frühere IOC-Kürzel (ROM, SIN, TRI) werden erkannt; ausgegeben werden die heutigen (ROU, SGP, TTO).
  - Die Tabelle der Kürzel unter „Einstellungen → Listen“ zeigt dieselbe Vorgabe.
  - Seit dem 15.11.2026 gilt das auch unter der DM – der Verband gehört zum Olympischen Sportbund
    (vorher ISO 3166-1 alpha-3, Festlegung vom 12.11.2026).
    Die Bundesländer behalten ihre Kürzel (BY, NW).
  - Eigene Kürzel der Veranstaltung gehen immer vor.
- **Schreibweisen:** Nennen Starter dasselbe Land verschieden („NRW“ und „Nordrhein-Westfalen“, „GER“ und „Germany“),
  tragen sie dieselbe Flagge und – unter der UIM – dasselbe Kürzel.
  In der [Mannschaftswertung](#mannschaftswertung) und auf den Starterlisten je Herkunft sind sie **eine** Mannschaft
  (`mannschaftSchluessel` in `src/lib/pokal.ts`); auf der Liste steht die häufigste Schreibweise.
  Der Reiter „Starter“ nennt solche Fälle.
  „Baden“ und „Württemberg“ allein gelten nicht als Baden-Württemberg.
- **Druck:** Listen müssen in Schwarz-Weiß brauchbar sein.
  Gedruckt steht die Flagge deshalb nie allein – bei „nur Flagge“ kommt auf dem Papier das Kürzel dazu.
  Die Flagge hat eine feste Größe unterhalb der Zeilenhöhe und ändert die Seitenteilung nicht.
- **Bilder:** mitgelieferte Vektorbilder (SVG), beim Bauen eingebettet; nichts wird zur Laufzeit geladen.
  Keine Emoji: Windows zeigt keine Flaggen-Emoji, und für Bundesländer gibt es keine.
  Die Ein-Datei-Fassung wächst dadurch um rund 250 kB.
  - Staaten: alle rund 250 Staaten und Gebiete aus dem Paket
    [country-flag-icons](https://www.npmjs.com/package/country-flag-icons)
    (MIT-Lizenz, © 2020 @catamphetamine), Fassung 3:2.
    Der Lizenzvermerk steht auch in der Anwendung selbst (Einstellungen → „Fremde Bestandteile und Lizenzen“,
    dort seit 16.11.2026 auch die Namensnennung der Parcours-Zeichnungen),
    damit er mit der Ein-Datei-Fassung weitergegeben wird.
  - Bundesländer: `src/flaggen/bundeslaender/` – je Land die **Landesflagge, die jedermann führen darf** (Zivilflagge),
    nicht die den Behörden vorbehaltene Dienstflagge mit Wappen.
    Welche das je Land ist und woher die Zeichnungen stammen (Wikimedia Commons, gemeinfrei als amtliche Werke),
    steht in [`src/flaggen/bundeslaender/LIESMICH.md`](../src/flaggen/bundeslaender/LIESMICH.md).

## Verwiegung

- Gewichtslisten je Herkunft zum Eintragen beim Check-in.
  Der Link „Gewichtslisten drucken“ in der Verwiegung öffnet sie für die dort gewählte Herkunft.
  Die Herkunft steht danach in der Adresse (`#/listen/gewicht/<Herkunft>`) und folgt der Auswahl;
  so lässt sich die Adresse weitergeben (16.11.2026).
- Die Erfassung der Gewichte im Reiter „Verwiegung“.
- Die Liste „Ausgleichsgewichte“ für den Steg:
  je Klasse ein Blatt nach Startnummer mit dem Ausgleichsgewicht und einem Kästchen je Lauf.
  Im Kopf stehen Boot und Co-Pilot aus „Veranstaltung → Besetzung“
  (`src/lib/ausgleich.ts`, `src/components/AusgleichListen.vue`).

Die Durchschnittsgewichte je Klasse stehen im Regelwerk (`gewichte`).
Sie lassen sich unter „Einstellungen → Durchschnittsgewichte“ ändern.

### Liste der Fahrer je Team (Regel 960)

Regel 960, Pkt. 3.7 verlangt: Race number, Name and surname, Sex, Date of birth, Verified weight and ballast
required, Class, in den Klassen Dolphin und 1–3 der Co-driver.
Umsetzung: `src/lib/teamListe.ts`, `components/TeamListen.vue`, „Listen → Gewichtslisten → je Mannschaft“.

- Sie ist eine **interne** Liste und steht in keiner Druckdatei.
- Das Geburtsdatum folgt der Listen-Option „Geburtsdatum zeigen“.
- Dafür gibt es das freiwillige Starterfeld `geschlecht` mit **vier Werten** (Entscheidung vom 15.11.2026;
  `src/domain/geschlecht.ts`): M (männlich), F (weiblich), D (divers), nA (keine Angabe).
- Leer bleibt erlaubt und heißt „nicht erfasst“; nur das zählt der Hinweis der Liste als fehlend.
- Unter Regel 960 hat der Starter-Reiter eine Spalte dafür.
- Import-Spalte „Sex“/„Gender“/„Geschlecht“. Erkannt werden (Groß-/Kleinschreibung egal):
  m, male, männlich; f, w, female, weiblich; d, diverse, divers; na, n/a, keine Angabe.
  Unbekanntes bleibt leer und wird beim Einfügen gemeldet.
- Auf der Liste nach Pkt. 3.7 steht es englisch: M, F, D, n/a.
- Das Feld steht in Sicherung und Teilnehmerdaten, nie in der Vorlage; die Wertung kennt es nicht.

## Verzahnung

Die Verzahnung legt die Startreihenfolge fest und damit Startnummern und alle Listen.

- Die Klassen werden nach Starterzahl möglichst gleichmäßig auf die Spuren eines Parcours verteilt,
  sodass nach jedem Start das Boot wechselt.
- Schnellauswahl für einen oder zwei Parcours.
  Klassen-Blöcke lassen sich zwischen den Spuren ziehen; eine Pause lässt eine Spur einige Starts aussetzen.
- Der Bootbedarf wird gegen die vorhandenen kleinen und großen Boote geprüft.
- „Verzahnung festschreiben“ sperrt Parcours, Spuren und Boote, damit Startnummern und Listen gültig bleiben.
- Unter UIM steht hier auch der Startplan des Parallelslaloms
  (siehe [Startplan](parallelslalom.md#startplan-des-vorlaufs)).

## Wettkampfrichter-Listen

Die Wettkampfrichter-Listen (WKR-Bögen) stehen unter „Listen“ (`src/lib/wkrListen.ts`, `src/components/WkrListen.vue`).

- Je Parcours, Klasse, Lauf und Liste ein Bogen.
  Die Startnummern stehen in der Startreihenfolge der Verzahnung.
- Leerzeilen für Nachmeldungen; wahlweise die Beschreibung auf der Rückseite.
- Bei der Clubmeisterschaft stehen mehrere Klassen auf einem Bogen.
  Listen mit Parcoursbild bleiben je Klasse.
  Mit „Papier sparen“ stehen die Leerzeilen einmal je Seite statt je Klasse.
- Die Parcours-Zeichnung steht auf den Bögen, abgeblendet je Position.
- Gedruckt werden die Bögen erst nach dem Festschreiben der Verzahnung (siehe [Sperren](#sperren-und-prüfungen)).

**Listen der Veranstaltung** (`src/lib/listen.ts`): die Listen des Aufbaus.

- Wahlweise mit „Tor 5 übernimmt die Parcoursüberwachung“: eine Liste statt zweier.
  Disq., Bemerkung, Haken und WKR-Name ziehen dann um (`src/state/tor5.ts`).
- Dazu zusätzliche Listen außerhalb des Aufbaus: Knoten, Vorsteg, Varianten ohne Start/Ziel.
  Sie werden gedruckt, in der WKR-Einteilung geführt, erfasst, gewertet und auf dem Laufzettel gezählt
  wie die des Aufbaus.
- Die Knoten-Liste sehen beide Regelwerke in jedem Aufbau des Manövrierens vor
  (`vorgabeListen` je Disziplin in `src/config/regelwerke/*.yaml`); sie ist abwählbar.

**Listenoptionen** unter „Einstellungen“:

- Starter je Seite fest statt automatisch, und „Teilen ab“ für die Wettkampfrichter-Listen.
  Gemeinsame Club-Bögen teilen sich immer automatisch.
- Bezeichnung der Bojen-Seiten: R/L, Land/See, Kai/Hafen, Pfeile, Innen/Außen.
  Die Wertungslisten bleiben bei R/L.
- Die Sprache der Bögen: siehe [Regelwerke und Begriffe](#regelwerke-und-begriffe).

## Laufzettel und QR-Codes

**Laufzettel** (Checklisten) sind eine eigene Listenart
(`src/lib/laufzettel.ts`, `src/components/LaufzettelListen.vue`).

- Je Blattstapel ein Zettel: Parcours, Klasse und Lauf.
  Bei der Clubmeisterschaft mit gemeinsamen Bögen: Parcours und Lauf.
- Ein A4-Querblatt zum Falten auf A5, mit einem Kästchen je gedruckter Seite.
  Die Seitenzahlen sind an denselben Bögen gemessen, die gedruckt werden.
- Die Knoten (eine Liste ohne Lauf) liegen im Stapel des letzten Laufs und stehen auf dessen Zettel.
- Dieser Zettel hat eigene Arbeitsschritte (`schritteLetzterLauf` in `src/config/einstellungen.yaml`):
  kein Aushang, sondern Einsicht der Mannschaftsleiter, dazu das Gesamtergebnis.
- Die Schritte hängen am Regelwerk: Vorgabe in `src/config/einstellungen.yaml`, Abweichung unter `laufzettel`
  im Regelwerk. UIM: Aushang binnen einer Stunde, vom O.O.D. unterschrieben (Pkt. 5.2).
- Die Form ist wählbar: eine Zeile je Seite mit dem Kästchen vorn (Vorgabe, bei vielen Seiten mehrspaltig)
  oder eine Zeile je Liste mit den Kästchen nebeneinander.

**QR-Codes** stehen auf jeder Druckseite jedes Bogens und auf jedem Laufzettel (`src/lib/qr.ts`).

- Format `ALC1.<Veranstaltung>.<Regelwerk>.<Aufbau>.<Parcours>.<Klassen>.<Lauf>[.<Liste>.S<Seite>]`.
- Als Vektor eingebettet; die Bibliothek `qrcode-generator` ist fest eingebaut.
- Ein Handscanner oder das Feld „Blatt scannen“ springt in der Erfassung zum Bogen und in dessen erste Zelle.
- Der Code eines Laufzettels zeigt alle Listen seines Blattstapels untereinander,
  in der Reihenfolge des Zettels und mit einer mitlaufenden Sprungleiste.
  Von Hand: „alle untereinander“ in der Auswahl der Liste (`stapelBoegen` in `src/lib/laufzettel.ts`).
- Blätter einer anderen Veranstaltung, eines anderen Regelwerks oder Aufbaus werden mit Begründung abgewiesen.
- Ein Scan hinterlässt keine Spur in dem Feld, in dem der Cursor gerade stand (`src/lib/scanner.ts`, `src/lib/scan.ts`).

## Betrieb: Start-Freigabe und Anzeigetafel

Am Wettkampftag gibt der Bedienrechner frei, wer als Nächstes startet, und eine **Anzeigetafel** zeigt es – in einem
zweiten Fenster, etwa auf einem Monitor am Steg (Reiter „Betrieb“, `src/views/BetriebView.vue`; Plan zur Übernahme des
Prototyps `tafel` vom 16.11.2026, Etappen E1 bis E3). „Anzeigetafel“ heißt sie, weil „Tafel“ das Aushangbrett ist.
Dazu kommen eine **Startliste** mit geschätzten Wartezeiten und eine **Zuschauerliste**. Mehrere Geräte über das
Internet kommen später; bisher braucht nichts davon ein Netz.

- **Voraussetzung:** Die Verzahnung ist festgeschrieben. Erst dann stehen Startnummern und Folge fest;
  vorher zeigt der Reiter nur den Weg zur Verzahnung. Wird sie mitten am Tag gelöst, bleiben die Karten stehen:
  Zeigen, „Lauf beginnen“ und alles, was die Folge umstellt, ruhen; Zurück, Meldungen und Zurücksetzen gehen weiter.
- **Die Folge der Starts** wird nie gespeichert, sondern aus der Verzahnung abgeleitet, Lauf für Lauf – dieselbe wie
  auf den WKR-Bögen (`src/betrieb/folge.ts`). Gespeichert wird nur, was gezeigt und begonnen wurde – und, sobald die
  Start-Freigabe umstellt, ein Schnappschuss der Folge (`src/betrieb/schritte.ts`). Verzahnung und WKR-Bögen ändert der
  Betrieb nie; eine Nachmeldung oder ein X fließt auch in eine umgestellte Folge ein.
  Mit „Versuche direkt nacheinander“ (UIM) fährt jeder Starter seine Versuche hintereinander, alle in einem Punkt.
- **Freigegeben wird nach Lauf, nicht nach Stelle:** Ein Start eines Laufs, der noch nicht begonnen hat, wartet – auch
  wenn er schon mitten im laufenden steht (etwa der dritte Lauf ans Ende von Lauf 2 gesetzt); gezielt zeigen geht immer.
- **Start-Freigabe** je Parcours (`src/components/betrieb/StartFreigabe.vue`):
  - „Lauf N beginnen“ gibt die Starts des Laufs frei. Sind im laufenden Lauf noch Starts offen, fragt es erst;
    sie bleiben freigegeben und kommen vor dem neuen Lauf dran.
  - „Nächster Start“ bringt den nächsten offenen Start auf die Anzeigetafel, „Zurück“ nimmt ihn zurück.
    Ein Doppelklick schaltet nur einmal: Jeder Klick nennt den Start, der gerade steht.
  - Am Ende eines Laufs bleibt die Anzeigetafel auf dem letzten Starter stehen, bis der nächste Lauf beginnt.
  - **Zurückstellen:** Der Nächste ist kurzfristig verhindert – er fährt vorerst nicht, bleibt aber unter
    „Zurückgestellt“ sichtbar. Von dort „Als Nächster“, „Ans Ende des Laufs“ oder „Jetzt zeigen“.
  - **Nachzuholen:** Starts, die überholt wurden, ohne dran gewesen zu sein – eine Nachmeldung, ein entferntes X,
    ein verpasster Lauf. Sie kommen nie von selbst als Nächstes; „Jetzt zeigen“, „Als Nächster“ oder „Ans Ende des
    Laufs“ (ist der eigene Lauf vorbei: ans Ende des laufenden).
  - **Anderen Starter wählen** (`BetriebsFolge.vue`): die nächsten zwölf offenen Starts, auf Wunsch die ganze Folge,
    und eine Suche nach Startnummer oder Name über alles, was noch zu zeigen ist – auch aus anderen Klassen und
    späteren Läufen („wartet, bis Lauf 3 beginnt“). „Zeigen“ holt den Start sofort auf die Anzeigetafel; er steht dann
    in der Folge dort, wo er gefahren ist, und der bisherige Nächste bleibt der Nächste. Gehören alle Treffer der
    Suche zu einem Starter (eine volle Startnummer findet ihn in jedem Lauf), ist sein Start im laufenden Lauf
    markiert, und die Eingabetaste zeigt ihn. Nach „Zeigen“ steht der Fokus auf „Nächster Start“.
  - **Verschieben** (Menüknopf je Start, die Ziele klappen als Knöpfe auf): vorziehen (vor den Nächsten), ans Ende
    des Laufs, vor oder nach einem anderen Lauf – etwa den dritten Lauf ans Ende von Lauf 2 oder den zweiten vor
    Beginn von Lauf 3. Nie vor schon Gefahrenes. Mit „Verzahnung beim Verschieben halten“ (Einstellung, Vorgabe an)
    rutscht innerhalb eines Laufs die Spur mit: Der Start bekommt den nächsten Platz seiner Spur, zwei Starts derselben
    Spur folgen dort nie aufeinander. In einen anderen Lauf geht er genau ans Ziel; die anderen Läufe bleiben, wie sie
    sind.
  - Was die Bedienung in einen anderen Lauf gesetzt hat (eingereiht, verschoben, gezielt gezeigt), bleibt dort, auch
    wenn später eine Klasse aussetzt oder vorgezogen wird. Läufe, die der Betrieb nicht umgestellt hat, folgen
    weiter der Verzahnung – auch wenn sie gelöst, geändert und wieder festgeschrieben wird.
  - **Klassen · Boot fehlt** (`KlassenAussetzen.vue`): die Klassen in der Folge, in der sie drankommen, je mit der
    Zahl ihrer ausstehenden Starts, darunter die Folge als Klassenplaketten. „Boot fehlt“: Die Klasse fährt vorerst
    nicht, ihre Starts stehen grau am Ende des Laufs. Mit „Andere Klassen vorziehen“ (Vorgabe an) rückt die nächste
    Klasse derselben Spur auf ihre Plätze (`E2E21212121216163` → `E6E61111113`), sonst schließen sich nur die Lücken
    (`EE111116163`). „Boot ist zurück“ verzahnt den Rest des Laufs wieder mit ihr – auch wenn der Lauf schon
    stockte –; spätere Läufe bleiben, wie sie sind. Mit „Versuche direkt nacheinander“ bleiben die Versuche eines
    Starters dabei beisammen. Die Klassen gelten dem laufenden Lauf, auch wenn gerade ein Nachzügler eines früheren
    als Nächster eingereiht ist. „Vorziehen“ macht eine Klasse zur nächsten, umgestellt nur innerhalb der Spuren – eine Klasse, die ihre
    Spur für sich hat, hat diesen Knopf nicht.
  - Sind nur noch zurückgestellte, nachzuholende oder „Boot fehlt“-Starts übrig, stockt der Lauf: Die Karte sagt es,
    der Lauf ist nicht zu Ende.
  - **Einsteigen ab …** Lauf und wahlweise Klasse: wenn die Start-Freigabe erst mitten im Wettkampf dazukommt.
    Was davor nicht gezeigt wurde, gilt als gefahren (ohne Anzeige, ohne Zeit), die Läufe bis dahin als begonnen.
    „Weiter mit“ nennt den Start mit Nummer und Name; er ist danach der Nächste. Ein früherer Einstieg nimmt einen zu
    späten zurück, auch wenn inzwischen schon gezeigt wurde.
  - Ist die Folge umgestellt, sagt die Karte das – mit dem Hinweis, dass die WKR-Bögen bleiben, wie sie sind.
  - Rückfrage gibt es nur vor „Lauf beginnen“, solange Starts offen sind; alles andere lässt sich zurücknehmen.
  - Ein Start mit X („nicht gestartet“) in einer Disq-Zelle des Laufs – am Steg oder am Vorsteg, wie in Wertung und
    Erfassung – entfällt; wird das X entfernt, ist er wieder da. Der Betrieb selbst setzt nie ein X und ändert keine
    Wertungsliste.
  - Wird der Starter im Boot gelöscht (vor dem ersten Wert), zeigt die Anzeigetafel „bereit“; „Nächster Start“
    geht weiter.
  - **Meldung** je Parcours oder auf allen: Störung und Pause stehen statt des Starters auf der Anzeigetafel,
    ein Hinweis steht darunter. **Vorlagen** (Begrüßung, Dank, Pause, Störung; `src/betrieb/meldungen.ts`): wählen,
    „Übernehmen“ schreibt sie ins Textfeld – Uhrzeit oder Tag anpassen, dann zeigen. Ihr Text steht in der Sprache der Anzeigetafel, mit
    dem Namen der Veranstaltung.
  - „Betrieb zurücksetzen“ (mit Rückfrage) löscht Begonnenes, Gezeigtes und Meldungen; Starter, Verzahnung und Werte bleiben.
- **Anzeigetafel** (`src/AnzeigeApp.vue`, `src/components/anzeige/`): „Anzeigetafel öffnen“ öffnet ein eigenes Fenster
  (`#/anzeige`, englisch `#/display`; je Parcours `#/anzeige/<parcours>`). Taste F oder Doppelklick schaltet Vollbild,
  der Mauszeiger verschwindet nach kurzer Ruhe.
  - Je Parcours: Name des Parcours, Klasse (mit Klassenfarbe) und Lauf, groß die Startnummer, Name, Herkunft und auf
    Wunsch der Start davor. Weiß auf Schwarz, gleich welches Farbschema die Bedienung hat.
  - Zwei Parcours stehen untereinander; nur auf sehr breiten Bildschirmen (LED-Band) nebeneinander.
    Zu lange Namen werden kleiner statt abgeschnitten; wird es eng, schrumpft alles gemeinsam (`src/lib/fit.ts`).
    Ein langer Hinweis unter dem Starter schrumpft selbst (höchstens zwei Zeilen), die Startnummer bleibt groß.
    Parcours, Klasse und Lauf stehen immer oben im Bereich – auch bei „bereit“ und bei einer Meldung.
  - Das Fenster liest nur und schreibt nie; es folgt dem Bedienfenster sofort. Neuladen zeigt gleich den Stand.
    Eine Eingabe in der Erfassung zeichnet die Tafel nicht neu – nur was sie zeigt, zählt.
  - Sprache wie die Listen (DM deutsch, UIM englisch: „Course“, „Attempt“, „Class Dolphin“), umstellbar.
- **Startliste** (Unterreiter „Startliste“, `#/betrieb/startliste`; `src/components/betrieb/StartListe.vue`): je
  Parcours der Start im Boot mit „seit m:ss“ (ab einer Stunde „seit über 1 h“) und die ganze Folge der offenen
  Starts, nach Lauf gegliedert, mit zwei Zeiten:
  - **„ca. in“** – wann der Start ungefähr dran ist: der Rest des Starts im Boot, dann je Start der Startabstand seiner
    Klasse;
  - **„Zum Vorsteg“** – wann der Starter am Vorsteg sein muss: sobald er zu den nächsten „am Steg“ + „vor Steg“ Starts
    gehört (Vorgabe 2 + 2). Wer schon dazugehört, hat „am Steg“ bzw. „vor Steg“ stehen.
  - Ohne Zahl bleiben Starts eines Laufs, der noch nicht begonnen hat (sein Beginn steht nicht fest), und „Boot fehlt“
    (wann das Boot zurück ist, weiß niemand); zurückgestellte und nachzuholende stehen darunter, wie an der
    Start-Freigabe zum Einreihen.
  - Zeigt die Anzeigetafel des Parcours eine Pause oder Störung (jede Meldung außer „Hinweis“, auch eine Begrüßung),
    steht keine Zahl da – nur „am Steg“/„vor Steg“ und ein Satz, warum. Ist die Meldung weg, wird weitergerechnet.
  - Unter einer Minute steht „gleich“, sonst Minuten, ab einer Stunde „1 h 05 min“. Gerechnet wird mit der Uhr des
    Bildschirms; gespeichert wird dabei nichts.
  - **Umstellen:** einen offenen Start auf einen anderen ziehen (nach oben gezogen: davor, nach unten: dahinter) oder
    das Menü „Verschieben …“ wie an der Start-Freigabe – dieselben Regeln (nie vor schon Gefahrenes; mit „Verzahnung
    beim Verschieben halten“ rutscht im Lauf die Spur mit, der Start landet dann auf dem nächsten Platz seiner Spur).
  - Darüber die Startabstände, mit denen gerechnet wird, mit Verweis auf die Einstellungen.
- **Startabstände** (`src/betrieb/prognose.ts`): Gemessen wird der Abstand zweier Anzeigen eines Parcours, zugeschlagen
  der Klasse des vorigen Starts. Abstände unter 30 s (Durchklicken) und über 300 s (Pause, Störung, Mittag) zählen
  nicht, ebenso keine über einen „ohne Anzeige“ erledigten Start (Einsteigen), keine über eine Laufgrenze (darin steckt
  der Laufwechsel: „Lauf beginnen“, Bögen tauschen) oder bei einem Start, der inzwischen ein X hat. Ab drei Messungen einer Klasse gilt ihr Mittel; vorher der eigene Wert der Veranstaltung, sonst die Vorgabe:
  die des Regelwerks oder die allgemeinen Werte (`src/config/einstellungen.yaml` `startabstaende`, gerundete Mittel der
  DM 2025: Fahrzeit plus 30 s Bootswechsel; Klasse 1 am schnellsten, E mit mehr Zeit am Steg). Unter UIM gelten bis zur
  Messung dieselben allgemeinen Werte.
- **Zuschauerliste** („Zuschauerliste öffnen“, eigenes Fenster `#/zuschauer`, englisch `#/spectators`; je Parcours
  `#/zuschauer/<parcours>`; `src/ZuschauerApp.vue`, `src/components/zuschauer/`): je Parcours „Im Boot“, „Am Steg“,
  „Vor Steg“, „Danach“ (mit „ca. in“ und „zum Vorsteg in“) und zuletzt „Boot fehlt“ ohne Zahl; Läufe, die noch nicht
  begonnen haben, stehen nicht darin. Bei Pause oder Störung auf der Anzeigetafel steht die Meldung oben, die Gruppen
  bleiben, Zahlen gibt es keine. Filter nach Klasse (nur die Klassen der gezeigten Parcours) – er blendet nur aus,
  Steg-Gruppen und Wartezeiten zählen alle Klassen; das Fenster merkt ihn sich auch über das Neuladen. Schmal genug fürs Handy, in der Sprache der
  Anzeigetafel, im Farbschema der Bedienung. Das Fenster liest nur und schreibt nie, wie die Anzeigetafel. Fürs Handy
  der Zuschauer über das Internet kommt später ein Link (dieselbe Seite).
- **Was die Anzeigetafel zeigt** (`src/betrieb/sicht.ts`): nur Startnummer, Name, Klasse und Herkunft der Starter,
  die gerade vorkommen – nie Geburtsdatum, Gewicht, Geschlecht oder erfasste Werte. Dieselbe Sicht liest die
  Start-Freigabe; so können beide später auch auf anderen Geräten laufen. Die Zuschauerliste liest eine noch
  schmalere Sicht (`sichtZuschauer`): ohne alles, was nur die Bedienung braucht – wer zurückgestellt ist, wer
  nachzuholen ist, die Starts späterer Läufe –, und nur die Starter, die darin vorkommen.
- **Einstellungen** unter „Einstellungen → Anzeigetafel“: Kopfzeile (Vorgabe Name und Jahr der Veranstaltung,
  eigener Text oder keine), Logos links und rechts daneben (die der Listen), welche Parcours die gemeinsame Tafel
  zeigt, Start davor, Name des Parcours, Namen (wie der Aushang der Wertungslisten, voll, gekürzt, ohne), Herkunft,
  Sprache und Schriftgröße (70–130 %). Unter „Einstellungen → Startfolge im Betrieb“: „Verzahnung beim Verschieben
  halten“, wie viele Starts „am Steg“ und „vor Steg“ stehen (je 0–10) und die **Startabstände** je Klasse: Vorgabe,
  eigener Wert (30–600 s; leer oder gleich der Vorgabe heißt Vorgabe), gemessen (Mittel, Zahl, zuletzt) und was gilt.
  **„Messwerte als Vorgabe übernehmen“** macht das Mittel jeder Klasse mit mindestens drei Messungen zum eigenen Wert;
  „Alle auf die Vorgabe“ nimmt die eigenen zurück. Die Einstellungen reisen mit der Vorlage, außer der Kopfzeile – so
  kommen übernommene Startabstände zur nächsten Veranstaltung mit.
- **Gespeichert:** Der Betrieb steht in der Sicherung, nicht in der Vorlage. „Verlauf wiederherstellen“ (innerhalb
  derselben Veranstaltung) und „Alle erfassten Werte löschen“ lassen ihn stehen; ein Stand einer anderen
  Veranstaltung bringt seinen eigenen Betrieb mit.
- Unter `file://` (Ein-Datei-Fassung) tragen nicht alle Browser die Nachricht zwischen zwei Fenstern; dann stößt das
  Bedienfenster die von ihm geöffnete Anzeigetafel und Zuschauerliste selbst an (`src/lib/anzeigeFenster.ts`).
- Wie gebaut ist und was ausgelegt wurde – weder DM-Reglement noch Regel 960 regeln den Ablauf am Steg:
  `BETRIEB_ANNAHMEN` in `src/betrieb/annahmen.ts`.

## Erfassung

Die Erfassung ist ein eigener Reiter (`src/views/ErfassungView.vue`, `src/lib/eingaben.ts`, `src/lib/erfassung.ts`).

- Die ausgefüllten Listen werden nach dem Lauf abgetippt.
- Derselbe Bogen wie auf dem Papier erscheint als Eingabetabelle.
- Die Tastatur arbeitet wie im Fehlerpunkte-Prototyp: Tab zum nächsten Feld, Enter und ↑ ↓ in der Spalte.
- Zeiten lassen sich kurz tippen: „83,45“ sind Sekunden, „1,2345“ oder „1:23,45“ ist 1:23,45 (Punkt oder Komma).
  Vor dem Trenner sind ab 20 Sekunden gemeint, darunter Minuten: „15,30“ ist 15:30,00, nicht 15,30 s
  (`src/lib/time.ts`).
- Fortschritt je Bogen; Hinweise auf unplausible Eingaben.
- Ein QR-Code führt direkt zum Bogen bzw. Blattstapel (siehe [QR-Codes](#laufzettel-und-qr-codes)).

## Wertung und Wertungslisten

- Die Wertung rechnen reine Funktionen (`src/lib/ergebnis.ts`, `scoring.ts`, `time.ts`, `codes.ts`, `disq.ts`).
- Wertungslisten gibt es je Klasse, Lauf und gesamt unter „Listen“ (`src/components/ErgebnisListen.vue`).
- Gedruckt werden sie in der Reihenfolge der Bögen: Parcours, dann Klasse nach Startreihenfolge.
- In einem eigenen Feld unter der Tabelle steht auf jeder Seite, wann sich die Liste zuletzt geändert hat
  (`src/lib/listenStand.ts`).
  Der Zeitpunkt kommt mit der Action und steht in der Sicherung.
  Einen Druckzeitpunkt im Seitenrand gibt es auf keiner Liste mehr.
- Wertungslisten lassen sich je Liste in beiden Reihenfolgen (Startnummer, dann Platz) in einem Druck ausgeben.
  Die Gesamtliste hat dafür ihre eigene Wahl.

**Gleiche Punkte:** Es entscheidet der Stichentscheid des Regelwerks
(`stichentscheid` in `src/config/regelwerke/*.yaml`).
DM: der schnellste gewertete Lauf. UIM nach Regel 960 Pkt. 5.2.6: die Summe beider Versuche.
Erst danach wird ein Platz geteilt.
Ein so vergebener Platz trägt auf der Liste ein Sternchen; unter der Tabelle steht die Regel in Worten.

**Wer noch nicht gefahren ist,** steht ohne Zeit auf Platz 1.
Ein X am Steg oder Vorsteg steht als „Nicht gestartet“ auf der Liste und zählt wie eine Disqualifikation.
Es steht auch im Zwischenstand der Gesamtliste hinten, bis der Streichlauf den Lauf aufnimmt.

**Läufe und Streichläufe:**

- Sieht das Regelwerk eine Zahl von Läufen vor (`wertungslaeufe`; UIM: zwei Versuche, der bessere zählt),
  stellt die Wahl des Regelwerks sie gleich ein.
  UIM: 2 Läufe und 1 Streichlauf. DM: 3 Läufe und „nach Regel“.
- Unter DM streicht „nach Regel“ auch bei nur zwei Läufen einen (Reglement C6, `wertungslaeufe.nachRegel`).
- Von Hand abweichen bleibt möglich; dann weist die Oberfläche darauf hin.
  Ausnahme `nurVorgabe: true` (DM): nur Voreinstellung, kein Hinweis.
- Schon erfasste Werte eines Laufs, den es danach nicht mehr gibt, bleiben im Stand.
  Ein Hinweis nennt sie dort, wo man umstellt.
  Unter „Einzelheiten“ zeigt er je Starter jeden solchen Wert mit Lauf, Liste und Feld,
  ob er in der Wertung weiter mitzählt und warum ihn keine Liste mehr zeigt
  (`verborgeneEinzelheiten` in `src/lib/eingaben.ts`, `src/components/EingabenHinweis.vue`).

### Aushang nach UIM (Regel 960, Pkt. 5.2)

Was ein Regelwerk für den Aushang verlangt, steht in seiner YAML-Datei.
Bisher nur in `src/config/regelwerke/uim-2026.yaml`; die Listen der DM bleiben, wie sie sind.

- `aushang.unterschrift`: Unter jeder Wertungsliste (je Versuch, Gesamtliste, Einzelwertung, Mannschaftswertung)
  stehen eine Unterschriftszeile „O.O.D.“ und ein leeres Feld „Time of posting“, beides zum Eintragen von Hand.
  Regel 960: „All results must be signed by the O.O.D. and must show the time of posting.“
  Der gedruckte Zeitstempel daneben bleibt die letzte Änderung.
  Der Fuß ist dann 22 statt 12 mm hoch; die eigene Seitenteilung rechnet damit (`src/lib/seiten.ts` `ergebnisFussMm`).
- `aushang.punkte`: Die Gesamtliste des Manövrierens hat die Spalte „UIM points“
  (Pkt. 5.2.1, Tabelle Pkt. 5.1 aus `pokal.uim.punkte`).
  Punkte stehen erst da, wenn die Klasse vollständig ist.
  Ein geteilter Platz gibt beiden die vollen Punkte des Platzes; Disqualifizierte haben 0
  (`src/lib/pokal.ts` `gesamtPunkte`).
- Dieselbe Liste hat nach Pkt. 5.2.1 keine Spalte „Result“ (bester Versuch ohne Knoten).
  Man sieht ihn an den gestrichenen Versuchen (Entscheidung vom 15.11.2026).
  Spalten: Attempts, „Knots pen.“, „Best time incl. knots pen.“, „UIM points“
  (`ohneErgebnis` in `components/ergebnis/ErgebnisGesamtBlatt.vue`).
  Die Gesamtliste der DM behält „Ergebnis“.
- Auf Listen und in der Oberfläche steht nie die Nummer einer Stage („stage 2“, „2nd stage“),
  nur der Name der Disziplin (Entscheidung des Nutzers).
- Das Blatt der UIM-Mannschaftswertung sagt, worauf es beruht, solange erst eine Disziplin gefahren ist:
  „Manoeuvring only – nothing has been recorded for Parallel slalom yet.“ (oder umgekehrt).
  Mit beiden steht im Kopf „UIM points (Manoeuvring + Parallel slalom)“.
  Siehe [Einzelwertung](parallelslalom.md#einzelwertung).

### Versuche direkt nacheinander (UIM)

Der Schalter „Versuche direkt nacheinander“ steht unter „Einstellungen → Wertung“.
Grundlage: Pkt. 4.3.2 „2 attempts, run consecutively“.

- Die Vorgabe setzt der Schlüssel `versucheNacheinander` im Regelwerk-YAML (bisher nur `uim-2026.yaml`).
  Die Wahl der Veranstaltung steht im gleichnamigen Zustand, in Sicherung und Vorlage.
- Unter UIM ist es eine **Option, nicht vorgewählt** (Entscheidung vom 15.11.2026):
  Manche Länder legen am Steg nur an, steigen nicht aus und fahren gleich noch einmal.
  Andere fahren die Versuche wie Läufe.
- Der Schalter ist nur unter Regelwerken sichtbar, die ihn kennen.

**An:** Jeder Starter steht auf den Listen der race officials des Manövrierens zweimal direkt nacheinander.

- 1. und 2. Versuch stehen auf **einem** Klassenzettel
  (`BogenAuftrag.versuche` in `src/lib/bogen.ts`, `WkrBogen.versuche` in `src/lib/wkrListen.ts`).
- Hinter der Startnummer steht die Spalte „Attempt“, unter jedem Starter eine Trennlinie.
  Geteilt wird nur zwischen Startern.
- **Ausnahme Vorsteg** (Entscheidung vom 15.11.2026): Dort kommt der Starter nur einmal vorbei.
  Die Liste hat wie die Knoten-Liste **eine** Zeile je Starter, ohne Spalte „Attempt“
  (Position mit `einmalJeStarter: true` in `src/config/aufbauten/gemeinsam.yaml`, `BogenAuftrag.einmal`).
  Was dort steht, gilt für jeden Versuch: Die Erfassung schreibt es unter jeden
  (`zeilenSchluesselAlle` in `src/lib/erfassung.ts`).
  So zählt ein X „Did not start“ vom Vorsteg in beiden Versuchen.
- Trägt ein späterer Versuch dort etwas anderes (geschrieben, bevor die Option an war), weist die Zeile darauf hin.
  Die nächste Eingabe in der Zeile gleicht an; „Leere Zeilen bestätigen“ lässt sie aus.
  Sonst löschte der Sammelknopf etwa ein X im späteren Versuch.
- Was der Vorsteg in einen späteren Versuch schreibt, legt dessen Wertungsliste noch nicht an
  (`einmalKennungen` in `laeufeMitEingaben`, `src/lib/ergebnis.ts`). Sie entsteht, sobald dort gefahren wird.
- Es gibt dann je Liste einen Bogen statt einen je Versuch, alle im selben Stapel
  (auch die Knoten, die nur einmal abgenommen werden).
  Dazu **ein** Laufzettel je Klasse („Attempts 1 to 2“, mit den Schritten des letzten Versuchs).
- Der QR-Code nennt den Stapel; die Erfassung zeigt denselben Bogen ohne Lauf-Auswahl.
  Jede Zeile schreibt unter ihren Versuch (`manoevrieren/1`, `manoevrieren/2`).
  Wertung, Beispielwerte und Wertungslisten bleiben damit, wie sie sind.
- Zwischen den Versuchen wird nichts ausgehängt (Hinweis über den Wertungslisten).
- Gemeinsame Bögen mehrerer Klassen (Clubmeisterschaft) tragen die Versuche ebenfalls je Starter,
  werden aber zeilenweise geteilt.

**Aus:** je Versuch eigene Bögen und Laufzettel wie bisher.
Auf den Zetteln vor dem letzten Versuch stehen die Schritte für den Aushang
(`zwischenaushang: true` in `einstellungen.yaml`).

## Mannschaftswertung

Die Mannschaftswertung (im Code „pokal“) rechnet je Herkunft: Verein, Bundesland oder Land.
Sie ist eine eigene Listenart unter „Listen“, gerechnet aus den Plätzen der Gesamtliste jeder Klasse
(`src/lib/pokal.ts`, `src/components/PokalListen.vue`, `src/components/pokal/`).

**Drei Varianten,** die sich gleichzeitig einschalten lassen:

- Plätze 1–3: 10, 7, 5 Punkte.
- Plätze 1–6: 6 bis 1 Punkte; so rechnet die Mappe der DM 2026.
- UIM-Punkte: Plätze 1–20 nach Regel 960 Pkt. 5.1; je Herkunft zählen die fünf Besten, gewertet wird ab fünf Startern.

Die Punkte der Varianten 1 und 2, die Zahl der Besten und die Mindestzahl sind unter
„Einstellungen → Mannschaftswertung“ änderbar.
Vorgaben stehen in `src/config/einstellungen.yaml` (`pokalPunkte`) und im Regelwerk
(`pokal` in `src/config/regelwerke/*.yaml`: DM Plätze 1–6 und UIM, UIM nur UIM).

**Gleichstand:** Punktgleiche Herkünfte trennt der Stichentscheid des Regelwerks (`pokal.stichentscheid`).
DM (C6): die Zahl der 1. Plätze, dann der 2. und 3.
UIM (960 Pkt. 5.2.6): die Punkte der 1. Plätze, dann der 2. …
Erst danach teilen sie sich den Platz.
Ein so entstandener Platz trägt wie auf den Wertungslisten ein Sternchen; die Regel steht im Fuß.

**Wer zählt:**

- Disqualifizierte, Offene und Starter ohne Herkunft bekommen keine Punkte.
- Schreibweisen einer Herkunft, die sich nur in Groß-/Kleinschreibung oder Leerzeichen unterscheiden,
  gelten als dieselbe.
  Bei Bundesland und Land ist auch jede erkannte Schreibweise dieselbe Mannschaft
  („NRW“ und „Nordrhein-Westfalen“, „GER“ und „Germany“; siehe [Herkunft und Flaggen](#herkunft-und-flaggen)).
  In der Vereinswertung zählt nur das Feld Verein.
- Wahlweise zählen nur ausgewählte Starter.
  Dann zeigt der Reiter „Starter“ eine Spalte mit Kästchen (alle/keine, umkehren – für alle und je Klasse).
  Wer nicht gewählt ist, behält seinen Platz, bekommt aber keine Punkte (wie „MW ja“ in der Mappe).
- Die Auswahl steht in Sicherung und Teilnehmerdaten.
  Beim Einspielen gilt die Auswahl der Datei; ein Excel-Import lässt sie stehen.
  Die Einstellungen stehen in Sicherung und Vorlage.

**Zwischenstand:** Solange nicht jede Klasse ihr Endergebnis hat, ist die Liste als Zwischenstand gekennzeichnet.
Im Zwischenstand zählt eine Klasse mit ihrer Gesamtliste, wie sie gerade steht – auch im angefangenen Lauf.
Die Plätze werden unter den bisher Gefahrenen gebildet, Offene bekommen nichts.
Der Stand kann deshalb von Starter zu Starter springen.

**Druck:** je Variante ein eigenes Dokument.
Plätze quer wie „Mannschaftswertung_Ausgabe“, UIM hoch wie „Mannschaftswertung_UIM“.
Dazu der Zeitstempel der letzten Änderung: der jüngste der Gesamtlisten aller Klassen
(`wertungZeit` in `src/lib/listenStand.ts`).
Die Mannschaftswertung ist nie älter als eine Wertungsliste, und ihr Zeitpunkt läuft nie rückwärts.
Entfallen alle Listen einer Klasse (letzter Wert gelöscht), bleibt der Zeitpunkt des Wegfalls stehen (`KEINE_LISTE`).

Unter Regel 960 mit Parallelslalom: siehe [Mannschaftswertung UIM](parallelslalom.md#mannschaftswertung-uim).

## Weitere Listen und Druck

### Starterlisten und Vorsteg-Liste

Die Starterlisten sind ein Reiter mit der Auswahl „Art“ (`src/lib/starterlisten.ts`):

- verzahnt – auf Wunsch mit hervorgehobenen Startern einer Herkunft für die Mannschaftsleiter,
- je Herkunft nach Startnummer,
- nach Klasse,
- unter Regel 960 zusätzlich „Parallel-Slalom“
  (siehe [Startliste je Racecourse](parallelslalom.md#startliste-je-racecourse)).

Die Vorsteg-Liste ist eine eigene Listenart.

### Aushang der Codes

Eine eigene Listenart: alle Fehler- und Disqualifikations-Codes des Regelwerks mit Quelle auf einem A4-Blatt
(`src/components/CodesAushang.vue`).

### Druckdatei

Die Druckdatei ist der letzte Reiter unter „Listen“ (`src/components/DruckdateiListen.vue`, `src/lib/druckdatei.ts`).
Sie ist die Datei, die nach dem Wettkampf an die teilnehmenden Gruppen geht.

- Inhalt: die verzahnte Starterliste je Parcours, die eingeschalteten Mannschaftswertungen (UIM-Punkte vor Plätzen),
  die Erklärung der Fehlerpunkte und Disqualifikationen, dann je Klasse (E, 1 … 7) die Läufe und die Gesamtliste
  nach Platz.
- Alles in einem Druck: „Als PDF speichern“ ergibt eine Datei; Hoch- und Querformat wechseln.
- Sie setzt die Folge aus denselben Blatt-Komponenten zusammen wie die einzelnen Reiter
  (`StarterBlaetter.vue`, `PokalStapel.vue`, `CodesAushang.vue`, `ErgebnisStapel.vue`).
  Jedes Dokument zählt seine Seiten selbst.
- Teile, Umfang (Läufe und Gesamtliste oder nur Gesamtliste) und Klassen sind abwählbar.
- Zwei Fassungen mit den Einstellungen der Wertungslisten:
  „Extern“ wie der Aushang (Namen gekürzt oder weggelassen – auch auf der Starterliste –, nie ein Geburtsdatum);
  „Intern“ mit vollen Namen und dem Geburtsdatum auf der Starterliste, wenn es für die Listen eingeschaltet ist.
- Solange nicht jede Klasse ihr Endergebnis hat, nennt ein Hinweis die Klassen und die fehlenden Läufe.
- Die Vorschau entsteht in Schritten, damit das Fenster bei großen Feldern bedienbar bleibt.

**Druckdatei nach Regel 960** (Entscheidung vom 15.11.2026; `druckdateiFolge` mit `regel960`, `src/lib/druckdatei.ts`).
Der Hinweis über der Auswahl beschreibt diese Folge (Text `booklet.hint960`):

- Mannschaftswertung, Legende der Fehlerpunkte (Codes), Einzelwertung,
  dann je Disziplin mit Werten deren Listen.
- Vor den Wertungslisten des Manövrierens die verzahnte Starterliste (keine Listen je Herkunft).
- Vor den Wertungslisten jeder Runde des Parallelslaloms deren Startliste mit den Blöcken
  (`src/lib/parallelStartliste.ts`, `components/ParallelStartlisten.vue`).
  Sie bleibt vollständig, auch wenn Klassen abgewählt sind: Ein Block kann Starts mehrerer Klassen tragen;
  der Hinweis sagt es.
- Die Druckdatei der DM bleibt in der Ordnung der Vorlage.
  Auch dort steht nur die normale verzahnte Starterliste, keine Liste je Herkunft und keine Markierung
  (Entscheidung vom 15.11.2026; mit Test belegt).
- Die Liste nach Pkt. 3.7 steht in keiner Druckdatei, auch nicht in der internen.

### Logos

Einstellungen → „Logos auf den Listen“ (`src/components/LogosPanel.vue`; Entscheidung vom 16.11.2026).
Zwei Plätze, „Logo links“ und „Logo rechts“, anfangs leer und für alle Regelwerke gleich.
Ohne Logo sieht jede Liste aus wie vorher.

- Wo sie stehen (`src/components/KopfLogos.vue`):
  - neben dem umrandeten Kopf jeder Seite: Starter-, Gewichts- und Vorsteg-Listen, Ausgleichsgewichte, Liste nach
    Pkt. 3.7, Startlisten und Wertungslisten auch des Parallelslaloms, Einzelwertung, Mannschaftswertung, Codes und
    damit auch die Druckdatei;
  - auf den WKR-Bögen in der Titelleiste, rechts vor dem QR-Code (dessen Lage und Größe bleiben), auch in der
    Beispielansicht, nicht auf der Rückseite;
  - auf den Laufzetteln als Streifen über Titel und QR-Code.
- Höhe 8 bis 30 mm, Vorgabe 15 mm, für beide Logos auf allen Listen gleich; auf den WKR-Bögen höchstens 12 mm (dort
  kostet jeder Millimeter Zeilen; Laufzettel folgen der Einstellung). Die Breite folgt dem Seitenverhältnis,
  höchstens 60 mm bzw. ein Viertel der Kopfbreite. Höhere Logos kosten Zeilen; die Listen messen und teilen neu.
- Hochladen: PNG, JPEG, WebP, GIF oder SVG bis 20 MB. Das Bild wird im Browser verkleinert, auf höchstens 360 px
  Höhe (`src/lib/logoBild.ts`), und als PNG gespeichert, sonst als WebP, notfalls als JPEG – je Logo höchstens rund
  100 kB. Metadaten fallen dabei weg. Unter 200 dpi in der eingestellten Höhe weist die Einstellung darauf hin.
  Ein SVG wird gerastert; fehlt ihm die viewBox, kommt eine aus Breite und Höhe dazu, damit der Inhalt mitwächst.
  Ein SVG aus einer von Hand geänderten Vorlage oder Sicherung bleibt auf den Listen eine data-URL (keine
  Blob-Adresse mit dem Ursprung der App, in der ein im Tab geöffnetes SVG Skripte ausführen könnte).
- Sicherung und Vorlage tragen die Logos (keine Personendaten). Eine Vorlage ohne Logo für eine Seite lässt das
  hiesige stehen. „Alles zurücksetzen“ entfernt die Logos.

### Doppelseitig drucken

Bei den Listenarten mit mehreren Dokumenten in einem Druck steht neben dem Druckknopf der Schalter
„doppelseitig drucken“: Starter-, Gewichts- und Vorsteg-Listen, Wertungslisten, Mannschaftswertung, Druckdatei.
Eingeschaltet beginnt jedes Dokument auf einem neuen Blatt.
Nach einem Dokument mit ungerader Seitenzahl folgt eine leere Seite, die in dessen Seitenzählung nicht mitzählt
(`src/lib/doppelseitig.ts`, `src/components/LeereRueckseite.vue`).
Die Wahl merkt sich die App je Listenart.

### Farben

Alle Listen und Bögen folgen am Bildschirm dem gewählten Farbschema (auch dunkel).
Gedruckt sind sie immer schwarz auf weiß mit grauer Fünfer-Zeile.
Ihre Farben kommen ausschließlich aus den Variablen `--blatt-*` in `src/styles/blatt.css`.
Neue Listen verwenden nur diese (`src/styles/blatt.test.ts` prüft das).
Ausnahme: Logos drucken in ihren eigenen Farben.

## Sperren und Prüfungen

Jeweils in Oberfläche und Reducer.
Die Punkte mit Datum sind Entscheidungen vom 15.11.2026.

- **Starterfeld:** Sobald der erste Wert erfasst ist, lassen sich Starter weder importieren noch hinzufügen
  oder entfernen (auch kein Beispiel-Starterfeld).
  In der Oberfläche mit Hinweis und Lösungsweg, im Reducer als wirkungslose Action
  (`starterfeldFest` in `src/lib/eingaben.ts`).
  Angaben eines Starters ändern, eine Sicherung laden und Zurücksetzen gehen weiter.
- **Regelwerk** (15.11.2026): Sobald Ergebnisse erfasst sind, lässt sich das Regelwerk nicht mehr wechseln,
  bis alle Werte gelöscht sind (`SET_REGELWERK` in `src/state/reducer.ts`).
  Die Knöpfe unter „Veranstaltung“ sind dann gesperrt, mit Hinweis; auch eine Vorlage wechselt es dann nicht.
- **Klasse eines Starters** (15.11.2026): Sie lässt sich nicht mehr ändern, sobald die Verzahnung
  bzw. der Startplan des Parallelslaloms festgeschrieben ist (`klasseFest`, `UPDATE_STARTER`, `MOVE_STARTER_TO_CLASS`).
  Eine Auswahl der Klasse bietet die Oberfläche nicht an: Ein Starter gehört in die Klasse seines Jahrgangs.
  Nur wenn ein geändertes Geburtsdatum in eine andere Klasse gehört, schlägt sie „In Klasse X verschieben“ vor
  (siehe „Jahrgang und Klasse“).
- **Reihenfolge der Starter** (15.11.2026): Im Reiter „Starter“ macht „Sortierung ändern“
  die Spaltenköpfe Name, Vorname, Herkunft, Größe, Geschlecht und Geburtsdatum zu Knöpfen.
  - Das gibt es je Klasse und oben für alle Klassen zugleich (jede Klasse in sich, die Folge der Klassen bleibt).
  - Ein Klick sortiert aufsteigend, ein zweiter dreht die Richtung um; die Richtung steht am Kopf.
    Gleiche Werte behalten ihre Reihenfolge (erst Vorname, dann Name = nach Name und Vorname).
    Ohne Angabe steht in beiden Richtungen hinten.
  - „Zufall“ mischt jedes Mal neu (Saat in der Action).
  - Die vorhandenen Startnummern werden nur neu verteilt
    (`src/lib/reihenfolge.ts`, Actions `ORDER_STARTERS`/`SHUFFLE_STARTERS`, Verlauf „Reihenfolge geändert“).
  - Gesperrt, sobald die Verzahnung festgeschrieben ist (`VERZAHNUNG_ACTIONS`),
    ebenso ▲▼ unter „Bearbeiten“ (`MOVE_STARTER`, 16.11.2026). Startnummern von Hand bleiben frei, für Korrekturen.
- **WKR-Listen drucken** (15.11.2026): Die Bögen des Manövrierens und ihre Laufzettel lassen sich erst drucken,
  wenn die Verzahnung festgeschrieben ist („Erst danach darf ich WKR-Listen drucken“).
  Vorher ist „Drucken“ gesperrt, und ein Hinweis führt zur Verzahnung.
  Am Bildschirm stehen die Bögen schon; Strg+P bringt nur den Hinweis aufs Papier
  (`vorVerzahnung` in `src/views/ListsView.vue`).
  Die Listen des Parallelslaloms hängen an ihren festgeschriebenen Runden; die Druckdatei enthält keine Bögen.
- **Jahrgang und Klasse** (15.11.2026): Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen:
  beim Einfügen aus Excel (die ganze Liste, bis sie berichtigt ist; `src/import/klassenPruefung.ts`),
  beim Einspielen einer Teilnehmerdaten-Datei, beim Hinzufügen von Hand
  und beim Ändern des Geburtsdatums im Bearbeiten-Modus.
  Gehört der Jahrgang in eine andere Klasse des Regelwerks, steht unter der Meldung ein Vorschlag:
  - „In Klasse X anlegen“ beim Hinzufügen (mit allen Angaben),
  - „In Klasse X verschieben“ beim Bearbeiten (mit dem neuen Datum).
    Eine klassenbasierte Startnummer wird die nächste freie der neuen Klasse.
    Gesperrt, sobald die Klasse feststeht oder Ergebnisse erfasst sind (`MOVE_STARTER_TO_CLASS`).
  - „In Klasse X übernehmen“ je Zeile beim Einfügen aus Excel; die Excel-Liste bleibt, wie sie ist.
  - zusätzlich „Alle beheben“ beim Einfügen aus Excel (16.11.2026; die Knöpfe je Zeile bleiben, denn manchmal sind es
    viele): Jeder gemeldete Starter kommt in die Klasse seines
    Jahrgangs, wer in keine passt (zu alt oder zu jung), wird nicht übernommen. Der Knopf nennt das Jahr der
    Veranstaltung; beide Listen darunter („in einer anderen Klasse“, „nicht übernommen“) zeigen jede Änderung mit
    „zurück“. Übernommen wird erst mit „Liste ersetzen“ bzw. „Ergänzen“ (`import/tsv.ts` klasseJeZeile, ohneZeilen).

  Passt der Jahrgang in keine Klasse, nennt die Meldung die Jahrgänge, die überhaupt starten; beim Einfügen aus Excel
  lässt sich die Zeile dann je Starter „Nicht übernehmen“.
  Ohne Geburtsdatum lässt sich nichts prüfen; das fällt in der Starterliste auf („fehlt“).
- **Datumsfelder** (15.11.2026): nie die Datumswahl des Browsers.
  Sie zeigte je nach Systemsprache mm/dd/yyyy – „darf es nie geben“.
  - Stattdessen ein Textfeld mit festem Muster: deutsch TT.MM.JJJJ, englisch JJJJ-MM-TT
    (`src/components/DatumFeld.vue`, `src/lib/datum.ts`).
  - Erkannt werden auch 2019-12-01, 1.12.2019 und 01/12/2019 – mit Schrägstrich immer Tag zuerst.
    Ein Datum, das es nicht gibt (31.02.), wird gemeldet. Gespeichert wird JJJJ-MM-TT.
  - Der Excel-Import liest dieselben Schreibweisen, dazu ein Jahr allein und Excel-Seriennummern.
    Er nennt, was er nicht lesen kann; das Feld bleibt dann leer.
  - `src/components/DatumFeld.test.ts` hält fest, dass keine Vorlage ein `<input type="date">` enthält.
- **Startnummern mit Präfix** (15.11.2026): E01, D01 sortieren überall wie mit einer 0 davor, also vor 101, 201 …
  (`vergleicheStartNr` in `src/domain/startnumbers.ts` – die eine Stelle für Listen, Wertung, Verzahnung
  und die Paare des Parallelslaloms).
  Unter UIM ist der Buchstabe der Dolphin-Nummern wählbar: E oder D
  („Starter → Startnummern“, Zustand `dolphinPraefix`, in Sicherung und Vorlage; gilt für neu vergebene Nummern).
  Beim Weiterzählen gelten in der Klasse E beide Buchstaben (`parseClassNumber`):
  Nach dem Umstellen folgt auf E02 also D03, nicht D01.
- **DM, Disqualifikation S „Bremsen mit der Hand beim Anlegen“** (15.11.2026) – nur auf der Steg-Liste.
  Reglement C5 d: „Ein Bremsen mit der Hand ist nicht zulässig.“
  Liste nach g: „Alle Verstöße gegen diese Ausschreibung, die nicht durch Strafpunkte belegt sind,
  führen zur Disqualifikation.“

## Parallelslalom und Einzelwertung (Regel 960)

Unter Regel 960 kommen der Parallelslalom, die Einzelwertung über beide Stages und die Mannschaftswertung UIM dazu.
Sie stehen auf einer eigenen Seite: [parallelslalom.md](parallelslalom.md).

## Beispieldaten

Die Beispieldaten (Starterfeld und Beispielwerte) stehen am Ende von „Veranstaltung“.
Der Block ist zugeklappt, solange nicht mit Beispieldaten gearbeitet wird.
Alle Namen sind erfunden.

**Beispiel-Starterfeld:**

- Es kennt „Herkünfte“ (leer = unbegrenzt).
  Mit einer Zahl verteilen sich die Starter reihum auf so viele Herkünfte
  (`beispielHerkuenfte` in `src/domain/generate.ts`) – zum Prüfen der Mannschaftswertung.
- Welche Art, folgt der Herkunft der Veranstaltung – **unabhängig vom Regelwerk** (Entscheidung vom 15.11.2026):
  Verein → Vereine, Bundesland → Bundesländer, Land → Länder, ohne → Starter ohne Herkunft
  (das Feld „Herkünfte“ ist dann gesperrt).
  Die Einstellung der Veranstaltung bleibt, wie gewählt.
- Die Länder stehen mit englischem Namen da (`LAENDER` in `src/domain/generate.ts`: Germany, Austria, Lithuania …).
  Ihr Kürzel ist in beiden Regelwerken das des IOC
  (LTU, GER – siehe „Kürzel der Länder“ unter [Herkunft und Flaggen](#herkunft-und-flaggen)).
- Ein Geschlecht bekommen Beispielstarter nur unter einem Regelwerk mit Parallelslalom (für die Liste nach Pkt. 3.7),
  unter der DM nicht.

**Beispielwerte:** Was gefüllt wird, ist eine Auswahl (`components/BeispieldatenPanel.vue`).

- Das Manövrieren (bis Lauf n) oder eine einzelne Runde des Parallelslaloms:
  Vorlauf, Halbfinale, Finale (samt kleinem Finale), Re-run.
  Eine Runde ist erst wählbar, wenn ihr Startplan festgeschrieben ist.
- „Beispielwerte einfügen“ füllt nur das Gewählte
  (Action `FILL_BEISPIELWERTE` mit `laeufe` bzw. `runden` und `nurRunden`;
  in den Runden nach dem Vorlauf mit `nurLeere` nur leere Attempts).
- „Werte des Gewählten löschen“ löscht nur dessen Werte (`CLEAR_EINGABEN_TEIL`).
  Festgeschriebene Pläne bleiben; Abgemeldete bekommen ihr X zurück.
  Bleibt nichts übrig, wirkt es wie „Alle erfassten Werte löschen“
  – bei freigegebener Verzahnung samt Plan des Vorlaufs.
- „Alle erfassten Werte löschen“ bleibt.
- Abgemeldete bekommen keine Beispielwerte.
- Die Werte folgen gerundeten Kennzahlen je Klasse, ohne einzelne Ergebnisse;
  der Unterschied zwischen Racecourse A und B bleibt.
- Die Zahlen je Klasse, die Herkünfte und die Wahl bei den Beispielwerten bleiben wie andere Ansichtswahlen
  über das Neuladen stehen (`merke` mit `ueberNeuladen` in `src/lib/merken.ts`).

**Beispiel-Besetzung** und **Beispielgewichte** haben je einen eigenen Knopf
(`src/lib/beispieldaten.ts`, Actions `FILL_BEISPIEL_BESETZUNG` und `FILL_BEISPIELGEWICHTE`,
deterministisch über `saat`).

- Die Besetzung füllt jede gedruckte Liste der WKR-Einteilung je Parcours (unter UIM auch je Racecourse)
  mit zwei bis drei erfundenen Personen, durch Komma getrennt.
  Höchstens 40 Zeichen, damit der Eintrag im Bogenkopf auf einer Zeile bleibt
  (sonst abgekürzte Vornamen, notfalls zwei Personen).
  Die Namen stehen wie echte in der Sicherung, nie in der Vorlage.
- Die Gewichte liegen um das Durchschnittsgewicht der Klasse (Regelwerk oder Wert der Veranstaltung).
  40 % je Klasse sind leichter, damit Ausgleichsgewichte entstehen; auf 0,1 kg wie in der Verwiegung.
- Stehen schon Namen bzw. Gewichte da, fragt die App vor dem Ersetzen.
  Beide bekommen einen eigenen Eintrag im Verlauf.
