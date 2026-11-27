Deutsch · [English](en/stand.md)

# Stand und Herkunft

Woher Alcatraz kommt, was aus den Prototypen übernommen ist, was heute gebaut ist und was noch fehlt.
Was die App kann: [funktionen.md](funktionen.md); Wettkampftag und Gerätebetrieb: [betrieb.md](betrieb.md).
Warum etwas so ist, steht mit Datum in [entscheidungen.md](entscheidungen.md), offene Fragen unter
[Offen](entscheidungen.md#offen).

## Wie es dazu kam

Ich habe seit 1995 die Auswertungen der Wettkämpfe beim Landesverband Motorbootsport Brandenburg gemacht.
Damals noch auf Basis von Excel und VBA.
Zwischen jedem Wettkampf habe ich das „Programm“ Stück für Stück erweitert.
Als ich 2003/2004 aus zeitlichen Gründen nicht mehr teilnehmen konnte, blieb auch die Entwicklung dazu liegen.

Seit 2008 bin ich wieder aktiv dabei.
In der Zwischenzeit hatte Volker ein eigenes Programm (auch auf Excel-Basis) entwickelt.
Beide Programme haben viele Gemeinsamkeiten und unterschiedliche Vorteile.
Zusammen haben sie aber den Nachteil, dass sie nur mit Excel unter Windows laufen.
Auch mit der aktuellen Version für Mac OS X laufen sie nicht.

Da ich persönlich weder mit Windows noch mit Mac gern arbeite, wächst in mir der Wunsch
nach einer vom Betriebssystem unabhängigen Lösung.
Aus diesem Grund soll Alcatraz im Browser laufen.
Auch ohne aktive Internetverbindung …

## Zusammenführung der Prototypen

Alcatraz führt die bisherigen Prototypen zusammen:

| Quelle | Inhalt | Stand in Alcatraz |
|---|---|---|
| `verzahnung-prototyp-vue` | Starter, Startnummern, Verzahnung, Bootbedarf, Parallelslalom | übernommen |
| `fehlerpunkte-prototyp-vue` | Regelwerke, Aufbauten, WKR-Listen, Erfassung, Wertungslisten | übernommen, siehe unten |
| `tafel` | Anzeigetafel, Startliste im Betrieb, Geräte über ntfy | übernommen (E1–E8), Feldtest offen |
| `Parcours` | Parcours-Zeichnungen | eingebunden, siehe unten |
| Excel-Auswertung | Mannschaftswertung, Verwiegung, Urkunden-Daten u. a. | größtenteils übernommen, siehe unten |

**Aus `fehlerpunkte-prototyp-vue`** sind übernommen (Einzelheiten in [funktionen.md](funktionen.md)):

- Regelwerke und Aufbauten (`src/config/`),
- die WKR-Einteilung und die Beispielansicht der Listen
  ([Veranstaltung und Besetzung](funktionen.md#veranstaltung-und-besetzung)),
- die [Wettkampfrichter-Listen](funktionen.md#wettkampfrichter-listen),
  [Laufzettel und QR-Codes](funktionen.md#laufzettel-und-qr-codes),
- die [Erfassung](funktionen.md#erfassung),
- [Wertung und Wertungslisten](funktionen.md#wertung-und-wertungslisten),
  der [Aushang der Codes](funktionen.md#aushang-der-codes).

Listen und Wertung des Parallelslaloms kamen dazu ([Parallelslalom](parallelslalom.md)).

**Aus `tafel`** ist übernommen, was der Plan vom 16.11.2026 vorsah (Etappen E1 bis E8), bis auf den Feldtest:
Anzeigetafel im zweiten Fenster, Start-Freigabe am Bedienrechner, Startliste mit Wartezeiten und Zuschauerliste,
ohne Netz (E1–E3), unter UIM auch für den Parallelslalom (E4); der Übertragungskern über einen ntfy-Server,
verschlüsselt und signiert, mit den Lücken des Prototyps geschlossen
(E5, [technik.md](technik.md#gerätebetrieb-sicherheitsmodell)); Lese-Links mit QR-Code für
Anzeigetafel und Zuschauerliste auf anderen Geräten (E6) und das Koppeln eines Handys für die Start-Freigabe (E7).
E8 ist vorbereitet: Bildschirm wach halten, „Alle Geräte neu laden“, Kontingent-Zähler und der
[Ablauf am Wettkampftag](betrieb.md#ablauf-am-wettkampftag); offen ist der Feldtest ([feldtest.md](feldtest.md)).
Bedienung: [Betrieb: Start-Freigabe und Anzeigetafel](funktionen.md#betrieb-start-freigabe-und-anzeigetafel),
[Gerätebetrieb](betrieb.md#gerätebetrieb).

**Aus `Parcours`:** Die Zeichnungen der Klassen E und 1–7, für die Klassen 5–7 auch als Möwe, und die Bahn des
Parallelslaloms sind eingebunden (`src/assets/parcours`, `npm run parcours:sync`;
Lizenz: [README](../README.md#lizenzen)).
Genutzt werden sie im Assistenten für eigene Aufbauten („Im Bild“), auf den WKR-Bögen (im Parallelslalom nur auf dem
Fahrweg-Bogen) und am WKR-Gerät (Maske „Bild“, bei den Knöpfen unter der Maske).

**Aus der Excel-Auswertung** sind da:

- die [Starterlisten](funktionen.md#starterlisten-und-vorsteg-liste) und die Vorsteg-Liste,
- die [Verwiegung](funktionen.md#verwiegung) mit Gewichtslisten und der Liste „Ausgleichsgewichte“,
- die [Mannschaftswertung](funktionen.md#mannschaftswertung),
- die [Druckdatei](funktionen.md#druckdatei).

Es fehlen die Urkunden-Daten (gedacht als CSV/XLSX für Serienbriefe, Entscheidung vom 12.11.2026).

## Stand

Stand 27.11.2026. Gebaut und mit Tests geprüft ist, was die Etappen E1–E8 und W1–W5 vorsahen; offen sind vor allem
die Feldtests.

- **Vor dem Wettkampf, Listen und Wertung:** Starter, Startnummern, Verwiegung, Verzahnung, WKR-Bögen, Laufzettel,
  Erfassung, Wertungslisten und Mannschaftswertung nach DM-Reglement und UIM Regel 960, unter UIM dazu Parallelslalom
  und Einzelwertung ([funktionen.md](funktionen.md), [parallelslalom.md](parallelslalom.md)).
- **Betrieb am Wettkampftag (E1–E8, 16.–20.11.2026):** Anzeigetafel, Start-Freigabe, Startliste mit Wartezeiten und
  Zuschauerliste ([funktionen.md](funktionen.md#betrieb-start-freigabe-und-anzeigetafel)); mit eingeschaltetem
  Gerätebetrieb Anzeigetafel und Zuschauerliste auch auf anderen Geräten und die Start-Freigabe vom gekoppelten Handy
  ([betrieb.md](betrieb.md#gerätebetrieb)).
- **Digitale WKR-Erfassung (W1–W5, 21.–22.11.2026)** nach dem [Vorschlag vom 21.11.2026](vorschlag-wkr-erfassung.md)
  ([funktionen.md](funktionen.md#digitale-wkr-erfassung)):
  Der Wettkampfrichter erfasst seine Liste auf dem Handy oder Pad statt auf dem Bogen.
  Masken: „Knöpfe“ für Steg, Tor 5, Mann-über-Bord und Vorsteg, auf Listen mit Bojen eine Zeile je Halt; „Bild“
  (Bojen in der Parcours-Zeichnung antippen); „Tabelle“ für Geübte (nur Pad und Rechner).
  Zeit-Listen haben einen Ziffernblock, die Knoten eine Prüfliste am Tisch.
  Ein Pad zeigt mehrere Listen nebeneinander (quer je nach Breite bis zu vier, hochkant bis zu zwei).
  Die Probe sendet nichts, die Übung braucht kein Netz (`#/uebung`).
  Am Bedienrechner: Matrix Listen × Starts, Eingang für Rückfragen und Vorschläge, ◆ und „Papier ansehen“ in der
  Erfassung, Parcours-Ampel mit Auto-Modus in der Start-Freigabe.
  Werte vom Gerät gehen denselben Weg wie das Abtippen; eine belegte Zelle wird nie still überschrieben.
- **Antworten des Nutzers:** Die Runden bis 11 der Fragenseite (21.–26.11.2026) und die Wünsche vom 24.11.2026 sind
  eingebaut. Aus Runde 11 (26.11.2026): Geburtstags-Warnung in zwei Stufen (gelber Hinweis bis 14 Tage, rote Warnung bis
  2 Tage um den ersten Wettkampftag), gemeinsame WKR-Bögen auf Wunsch auch bei DM- und UIM-Meisterschaften, Co-Piloten
  je Klasse mit Ersatz und Gewicht samt eigenem Ausgleichsgewicht, Wiederholung eines Laufs nach bestätigtem Ausfall,
  die Lage der Zeichnung nach Start/Ziel benannt, „↩ Rückgängig“ mit Pfeil nach links, in der Übung rollt nur noch die
  Erklärung aus dem Bild. Davor u. a.: mehrere Disq. an einer Boje („5, J, D“), langes Drücken auf eine Boje, die Bahn
  des Parallelslaloms auf Gerät und Fahrweg-Bogen, Höchstzahl je Code (der dritte Tipp auf „2. und 3. Versuch“ setzt
  Disq. D), „Nicht gestartet · Disq. X“ statt „Nicht vorbeigekommen“, Lage der Zeichnung im „Bild“, das
  Ausgleichsgewicht auf dem Steg-Gerät und in einstellbaren Stufen, gemeinsame WKR-Bögen der Clubmeisterschaft nach der
  Verzahnung, Geburtstags-Warnung nach DM-Reglement C8, Buchstabe D für Klasse E wählbar auch unter DM, Stichentscheid
  der Einzelwertung nach Regel 960 Pkt. 5.2.6 (im Parallelslalom die letzte, dann die vorletzte gefahrene Runde).
  Einzelheiten mit Datum: [entscheidungen.md](entscheidungen.md), zur WKR-Erfassung ab [Digitale
  WKR-Erfassung](entscheidungen.md#digitale-wkr-erfassung-antworten-21112026), dazu die Pläne `plan-*.md`.

## Was offen ist

- **Feldtests** ([feldtest.md](feldtest.md)): der Gerätebetrieb mit echten Handys und dem echten ntfy-Server
  (Lese-Links, Koppeln, Start-Freigabe vom Handy, Hintergrund, Wake Lock, iPhone, Kontingent) und die WKR-Masken auf
  Handy und Pad (Handschuhe, Sonne, Trefferkreise im Bild, Knoten am Tisch, Zeitnahme, Tabelle).
  Die Tests prüfen den Gerätebetrieb gegen einen nachgebauten Server; die Befunde eines ersten Versuchs mit echtem
  Handy (21.11.2026) sind eingearbeitet, die Checkliste ist noch nicht abgearbeitet.
- **W6 nach Befund** ([plan-wkr-w5.md](plan-wkr-w5.md)): die Maske „Bild“ eigens für das Handy hochkant, Zeit-Listen
  eigens für das Handy, im Parallelslalom ein Steg-Gerät für beide Seiten („A | B“ in einer Maske).
- **Offene Fragen** an den Nutzer für die nächste Runde der Fragenseite, gesammelt unter
  [Offen](entscheidungen.md#offen): vor allem, was beim Umbau nach Runde 11 neu ausgelegt wurde (Wiederholung nach
  Ausfall, Co-Piloten mit Ersatz und Gewicht, Einzelheiten der Geburtstags-Warnung und der gemeinsamen WKR-Bögen),
  dazu einzelne Auslegungen zur Höchstzahl je Code, zu „Nicht gestartet · Disq. X“ und zur Übung, ältere zum Koppeln
  (E7) und zu den getrennten Finals.
- **Wackelige Tests:** Zwei Ende-zu-Ende-Tests in `src/GeraetWkr.test.ts` schlagen unter Last gelegentlich fehl
  (feste Zeitgrenze beim Warten). Auf GitHub laufen sie seit 24.11.2026 nur auf Wunsch, lokal und im pre-commit-Hook
  immer ([technik.md](technik.md#tests)). Die Ursache ist nicht behoben.
- **Check-in am Gerät:** im Gerätebetrieb als spätere Aufgabe vorgesehen (`src/geraete/aufgaben.ts`), nicht gebaut.
- **Aus der Excel-Auswertung:** die Urkunden-Daten.
- Ideen ohne Entscheidung: leere Kästchen in der [Ideenliste](#ursprüngliche-ideenliste).

## Ursprüngliche Ideenliste

Die Liste stammt aus der Zeit vor den Prototypen; der Wortlaut der Ideen ist unverändert, nur Tippfehler sind berichtigt.
Die Kästchen sind am 25.11.2026 gegen den Code nachgezogen.
Hinter jeder Idee steht nach „→“, wo sie umgesetzt ist, oder was fehlt.
„Anders gelöst“ heißt: Der Zweck ist erfüllt, nur auf anderem Weg als in der Idee.
„Teilweise“ und „offen“ heißen: noch zu entscheiden, ob es kommt oder verworfen wird.

Hier nur eine grob sortierte Auflistung der meisten Ideen:

- [x] Verzahnung (Starter 1 Klasse 1, Starter 2 Klasse 4, Starter 3 Klasse 1, ...)
  → [Verzahnung](funktionen.md#verzahnung)
- [x] Ansicht für Wettkampfrichter
  → [digitale WKR-Erfassung](funktionen.md#digitale-wkr-erfassung) am eigenen Handy oder Pad (W1–W5, siehe
  [Stand](#stand)); der Feldtest steht aus
  - [x] Login und Rechtemodell ... → anders gelöst: keine Anmeldung. Ein Gerät wird am Bedienrechner per QR-Code
    oder Geräte-Code gekoppelt und bekommt dort seine Aufgaben: Start-Freigabe für bestimmte Parcours, eine oder
    mehrere WKR-Listen. In der Geräteliste lassen sie sich ändern und entziehen; geprüft wird nur am Bedienrechner.
    Einstellungen und „Betrieb zurücksetzen“ bleiben dort.
  - [x] Nächster Start wird erst freigegeben, wenn alle Wettkampfrichter den Lauf abgenickt haben
    → anders gelöst, bewusst ohne Sperre (Entscheidung F4 vom 21.11.2026: ein Gerät kann ausfallen): Die
    Parcours-Ampel der Start-Freigabe ist grün, bis der Starter durchs Start-Tor ist („Durchs Start-Tor“ oder die
    erste Zeile eines Parcours-WKR), danach rot, bis jede digital erfasste Parcours-Liste den Start abgeschickt hat.
    Der Auto-Modus (Vorgabe aus) zeigt dann von selbst den Nächsten. Sonst fragt die Start-Freigabe bei Rückstand einer
    Parcours-Liste „Trotzdem weiter?“ oder warnt nur (Einstellungen → Startfolge im Betrieb).
    Steg und Vorsteg halten nie auf.
  - [x] Startnummer und Klasse muss sich vor jedem Start aktualisieren → Das WKR-Gerät zeigt von selbst den Start,
    den die Start-Freigabe gezeigt hat: Startnummer groß, Klasse, nie den Namen; Vorsteg und Steg-Ablegen sehen die
    nächsten Starts schon vorab. In der Bojen-Maske steht beim ersten Start einer neuen Klasse kurz „Achtung,
    Klassenwechsel!“.
  - [x] Starterseite → die [Anzeigetafel](funktionen.md#betrieb-start-freigabe-und-anzeigetafel) im zweiten
    Fenster am Bedienrechner („Im Boot“, davor), die Startliste im Betrieb und die Zuschauerliste (fürs Handy gebaut);
    seit E6 Anzeigetafel und Zuschauerliste auch über einen Lese-Link auf anderen Geräten, seit E7 die
    Start-Freigabe auf dem gekoppelten Handy
    - [x] Anzeige von Informationen wie Startnummer, Name, Klasse und Lauf → Anzeigetafel
    - [x] Aufgeteilt nach 'Im Boot', 'Am Steg', 'Vor Steg' → Zuschauerliste (Anzeigetafel: „Im Boot“ und davor)
    - [x] Starterzahl in den Bereichen konfigurierbar (1 im Boot, 2 am Steg, 2 vor Steg) → Einstellungen → Startfolge
      im Betrieb (je 0–10)
    - [x] Reihenfolge, je nach Berechtigung, änderbar → an der Start-Freigabe zurückstellen, verschieben, Klasse
      aussetzen oder vorziehen, in der Startliste auch durch Ziehen. Am Bedienrechner geht alles, auf dem gekoppelten
      Handy nur in den freigegebenen Parcours und ohne „Betrieb zurücksetzen“.
    - [x] Unterschiedliche Farben für Klasse und Lauf → Anzeigetafel (Klasse mit Klassenfarbe, Lauf in eigener Farbe)
    - [x] Starter rutschen automatisch hoch nach abgeschlossenem Lauf → „Nächster Start“ zeigt den Nächsten der Folge,
      im Auto-Modus ohne Tipp, sobald alle Parcours-WKR abgeschickt haben; der nächste Lauf wird ausdrücklich begonnen
    - [ ] Zeitplan (Pausen, Feierabend etc.) bei der Sortierung → offen; Pausen gibt es als Meldung auf der
      Anzeigetafel (auch als Vorlage: Mittagspause, Siegerehrung …)
    - [x] Ungefähre Berechnung der Zeit bis zum Start/Vorsteg → Startliste und Zuschauerliste: „ca. in“ und „Zum
      Vorsteg“ aus den Startabständen je Klasse (ab drei Messungen gemessen, sonst Vorgabe aus der DM 2025); nicht im
      Parallelslalom
- [x] Gedruckte WKR-Listen → [Wettkampfrichter-Listen](funktionen.md#wettkampfrichter-listen); Listen, die nur am
  Gerät erfasst werden, druckt Alcatraz nicht mit („Trotzdem drucken“ als Rückfall)
  - [x] Verzahnung auf einer Liste (kein Blattwechsel immer wieder, sondern von oben nach unten auszufüllen) (optional)
    → Ein Bogen gilt je Klasse und Lauf, die Starter stehen darauf in der Startfolge der Verzahnung. Stehen mehrere
    Klassen auf einem Bogen (Clubmeisterschaft), gibt es seit 24.11.2026 die Wahl „Klassen auf gemeinsamen Bögen“
    (Einstellungen → Wettkampfrichter-Listen): getrennt, je Klasse ein Block mit Überschrift, oder nach der
    Verzahnung, gemischt in der Startfolge. Seit 26.11.2026 gibt es gemeinsame Bögen auf Wunsch auch bei DM- und
    UIM-Meisterschaften (Haken „Gemeinsame Bögen …“ an derselben Stelle), mit derselben Wahl.
  - [x] leichte Grau- oder Farbtöne für andere Klassen
    → anders gelöst (Nutzer 24.11.2026: „Farben brauchen wir nicht“): getrennt trägt jeder Block die Klasse als
    Überschrift, nach der Verzahnung steht sie in der Spalte „Kl.“ hinter der Startnummer.
    - [x] Schikane (und andere nicht angefahrene Beobachtungspunkte) bei kleineren Klassen auf verzahnten Listen
          ausgrauen → Spalten, die eine Klasse nicht hat, sind in ihren Zeilen kräftig schraffiert wie die Zeile
          eines Dummys im Parallelslalom (seit 24.11.2026)
  - [x] Auch mehrere Klassen auf einer Seite (konfigurierbar)
    → bei der Art „Clubmeisterschaft“ (Reiter „Veranstaltung“), seit 26.11.2026 auf Wunsch auch bei Meisterschaften
    („Einstellungen → Wettkampfrichter-Listen → Gemeinsame Bögen“); Listen, deren Zeichnung sich je Klasse
    unterscheidet, bleiben je Klasse, außer mit „Papier sparen“ (dann ohne Parcoursbild)
    - Bei Clubmeisterschaften oder kleinen Wettkämpfen mit nur 1–2 Startern pro Klasse macht eine eigene Liste keinen
      Sinn
  - [x] Übertragung von Listen in das Programm mit gleicher Ansicht
        (Browserformular und Beobachtungsliste sind identisch) → [Erfassung](funktionen.md#erfassung); Werte vom
        WKR-Gerät kommen über dieselbe Erfassung an (◆)
    - Weniger fehleranfällig und einfache Kontrolle
  - [ ] Lauf kann erst 'abgeschlossen' werden, wenn alle Beobachtungslisten eingetragen & kontrolliert wurden
    → teilweise: Auf Papier hat der [Laufzettel](funktionen.md#laufzettel-und-qr-codes) ein Kästchen je Bogen und
    die Schritte der Auswertung; die Erfassung zeigt den Fortschritt je Bogen. Digital schließt der Wettkampfrichter
    seine Liste am Gerät mit seinem Namen ab („Liste abschließen“ ersetzt die Unterschrift auf dem Bogen), danach
    gehen Korrekturen nur noch als Vorschlag. Was fehlt, zeigt die Matrix unter Betrieb → WKR. Gesperrt wird nichts.
    - [ ] 4-Augen-Prinzip. Kontrolle muss mit einem anderen Wettkampfrichter/Benutzer erfolgen
      → teilweise, auf Papier: „Kontrolliert“ und „Unterschrieben“ auf dem Laufzettel; in der App ohne Benutzer offen
- [ ] Support für 'Spaßstarter' → offen
    - Ältere Starter fahren in jüngerer Klasse (zusätzlich zum eigentlichen Lauf)
    - Mit auf den Listen und bei der Erfassung
    - Mit im Aushang
    - Nicht in die Endwertung, aber mit Info für die Siegerehrung (Differenz zum eigentlichen Starter etc.)
- [x] Bei Clubmeisterschaft den Verein nicht anzeigen → Herkunft „ohne“ im Reiter „Veranstaltung“
- [x] Regel als Set hinterlegen (Deutsche Meisterschaftsregeln)
  → DM-Reglement (`dm-2026`), dazu UIM Regel 960 (`uim-2026`); [Regelwerke](funktionen.md#regelwerke-und-begriffe)
- [ ] Regeln für die Veranstaltung auf Basis der DM-Regeln
  → teilweise: Läufe, Streichläufe, zusätzliche Listen, eigene Aufbauten und die Stufen des Ausgleichsgewichts sind
  je Veranstaltung einstellbar; einzelne Regeln abschalten oder überschreiben geht nicht.
  - Regeln können deaktiviert oder überschrieben werden
- [x] Verstöße werden mit Kürzel (A, B, C usw.) angegeben und dargestellt
  → Disq.-Buchstaben und Fehlercodes aus dem Regelwerk; [Aushang der Codes](funktionen.md#aushang-der-codes)
- [x] Zeiten können im Format 1,2345 und 83,45 statt 1:23:45 eingegeben werden
  → [Erfassung](funktionen.md#erfassung); am WKR-Gerät ebenso über einen Ziffernblock
  - Umrechnung erfolgt für die Anzeige automatisch
- [x] Jede Berührung, jeder Strafpunkt wird einzeln erfasst und ist auch im Aushang entsprechend dargestellt
  → Erfasst wird je Tor und Boje (Start und Ziel getrennt nach L und R).
  Die Wertungsliste eines Laufs zeigt die Punkte je Bogen des Fahrwegs und den Fehler-Schlüssel.
- [x] Vorsteg-Listen → [Starterlisten und Vorsteg-Liste](funktionen.md#starterlisten-und-vorsteg-liste); dazu ein
  Vorsteg-Bogen, der wie die übrigen Bögen erfasst und gewertet wird
  - Zum Laufabhaken und ggf. Punkte, wegen Schwimmwesten auf dem Steg ausgezogen
- [x] 3 Extra-Zeilen unter Beobachtungslisten → Leerzeilen für Nachmeldungen, Zahl einstellbar
  (Einstellungen → Wettkampfrichter-Listen)
- [x] Aushanglisten → [Wertung und Wertungslisten](funktionen.md#wertung-und-wertungslisten)
  - [x] Spätstarter (die nicht in der regulären Verzahnung fahren) werden oben (1. Platz) angezeigt
    → Wer noch nicht gefahren ist, steht ohne Zeit auf Platz 1.
  - [x] Fehlerpunkte != Bojenberührungen werden als Buchstaben angezeigt
    → Fehler-Schlüssel auf der Wertungsliste eines Laufs: die Fehlercodes, dahinter die Disq.-Buchstaben
    - Buchstaben über das gesamte Programm gleich
    - [ ] Nur die Buchstaben, die in der Aushangliste aufgeführt werden, werden als (optionale) Tabelle darunter
      angezeigt → offen: Heute stehen alle Codes des Regelwerks auf einem eigenen Aushang, nicht nur die benutzten
      unter der Liste.
