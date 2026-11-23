# Stand und Herkunft

Woher Alcatraz kommt, was aus den Prototypen übernommen ist und was noch fehlt.
Was die App heute kann: [funktionen.md](funktionen.md).
Offene fachliche Fragen stehen in [entscheidungen.md](entscheidungen.md#offen).

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
| `verzahnung-prototyp-vue` | Starter, Startnummern, Verzahnung, Bootbedarf, Parallel-Slalom | übernommen |
| `fehlerpunkte-prototyp-vue` | Regelwerke, Aufbauten, WKR-Listen, Erfassung, Wertungslisten | übernommen, siehe unten |
| `tafel` | Anzeigetafel, Startliste im Betrieb, Geräte über ntfy | teilweise übernommen, siehe unten |
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

Listen und Wertung des Parallelslaloms sind inzwischen ebenfalls da
([Parallelslalom](parallelslalom.md)).

**Aus `tafel`** ist übernommen (Plan vom 16.11.2026, Etappen E1 bis E4;
[Betrieb: Start-Freigabe und Anzeigetafel](funktionen.md#betrieb-start-freigabe-und-anzeigetafel)):
die Anzeigetafel in einem zweiten Fenster am Bedienrechner und die Start-Freigabe dort, für das Manövrieren,
ohne Netz – mit Zurückstellen, anderem Starter, Verschieben, „Boot fehlt“ und Klassen vorziehen, Meldungsvorlagen
und „Einsteigen ab …“; dazu die Startliste im Betrieb mit Wartezeiten („ca. in“, „Zum Vorsteg“) aus gemessenen
Startabständen und die Zuschauerliste in einem eigenen Fenster. Unter UIM auch der Parallelslalom (E4): Runden als
Punkte, Paare mit Racecourse A und B auf der Anzeigetafel, ohne Wartezeiten
([Parallelslalom](parallelslalom.md#betrieb-start-freigabe-und-anzeigetafel)). Mit E5 ist der Übertragungskern
für andere Geräte übernommen (`src/geraete/`): verschlüsselt und signiert über einen
ntfy-Server, mit den Lücken des Prototyps geschlossen (Anmeldung unter fremder Geräte-ID, doppelte Ausführung,
Verlust während einer Trennung, Anhänge vor der Prüfung, Flut von Anmeldungen, zwei führende Fenster); dazu Führung
über Web Locks, Fensterbus und die gerätelokale Ablage ([technik.md](technik.md#gerätebetrieb-sicherheitsmodell)).
Mit E6 nutzt die App ihn: Anzeigetafel und Zuschauerliste auf anderen Geräten über zwei Lese-Links mit QR-Code
(Betrieb → Geräte, erst nach bewusstem Einschalten; [Gerätebetrieb](betrieb.md#gerätebetrieb)). Mit E7
(20.11.2026) koppelt ein Handy per QR-Code oder Geräte-Code und bedient die Start-Freigabe seiner Parcours mit
denselben Knöpfen wie der Bedienrechner; Rechte ändern und entziehen in der Geräteliste
([Start-Freigabe vom Handy](betrieb.md#start-freigabe-vom-handy-koppeln)). E8 ist vorbereitet (20.11.2026):
Bildschirm wach halten, „Alle Geräte neu laden“, Kontingent-Zähler, Härtungstests und der
[Ablauf am Wettkampftag](betrieb.md#ablauf-am-wettkampftag); offen ist der Feldtest ([feldtest.md](feldtest.md)).

**Aus `Parcours`:** Klasse E, 1–7 und Möwe sind eingebunden
(`src/assets/parcours`, `npm run parcours:sync`; Lizenz: [README](../README.md#lizenzen)).
Genutzt werden sie im Assistenten („Im Bild“) und auf den WKR-Bögen.

**Aus der Excel-Auswertung** sind da:

- die [Starterlisten](funktionen.md#starterlisten-und-vorsteg-liste) und die Vorsteg-Liste,
- die [Verwiegung](funktionen.md#verwiegung) mit Gewichtslisten und der Liste „Ausgleichsgewichte“,
- die [Mannschaftswertung](funktionen.md#mannschaftswertung),
- die [Druckdatei](funktionen.md#druckdatei).

## Was offen ist

- Erfassung durch die Wettkampfrichter am eigenen Gerät nach dem [Vorschlag vom 21.11.2026](vorschlag-wkr-erfassung.md)
  (Fragen F1–F17 beantwortet): Etappe W1 „Kern“ ist gebaut ([plan-wkr-w1.md](plan-wkr-w1.md); Übernahme über die
  Erfassung mit Rückfrage, Schlange je Liste, Steg in zwei Teilen mit Abschluss und Pause je Teil, Abschluss mit
  Namen, Protokollfassung 2; Prüfbefunde vom 21.11.2026 behoben) – nur gegen den nachgebauten Server getestet.
  W2 „Bedienrechner“ ist gebaut ([plan-wkr-w2.md](plan-wkr-w2.md): Matrix Listen × Starts mit Geräte-Ampel, Eingang
  für Rückfragen und Vorschläge, ◆ und „Papier ansehen“ in der Erfassung, Geräteleiste und Rückstandswarnung in der
  Start-Freigabe und auf dem Freigabe-Handy; Prüfbefunde vom 21.11.2026 behoben, Auslegungen bestätigt 21.11.2026).
  W3 „Handy, Katalog“ ist gebaut ([plan-wkr-w3.md](plan-wkr-w3.md): Maske „Knöpfe“ für Steg, Tor 5, MüB und
  Vorsteg mit Doppeltipp-Schutz, Liste zuweisen, „Liste abschließen“, Sonnenmodus, Probe, Übung ohne Netz `#/uebung`;
  Prüfbefunde vom 21.11.2026 behoben, Auslegungen am 21.11.2026 abends beantwortet – bestätigt bis auf die
  anders entschiedenen, plan-wkr-w3.md §15).
  Erster Handy-Test (21.11.2026, Befunde 1–16, N1–N10 in WKR_ANNAHMEN) eingearbeitet: Text nie abgeschnitten,
  Farben nur der Maske, Overlay „wird übertragen …“, DISQ/FEHLER, Ende der Probe, Wake-Lock-Hinweis und
  `npm run dev:https`, Koppeln über den QR-Code als Hauptweg, Team-Filter der Zuschauerliste, Rückfrage schon ab
  einem offenen Start (alte W2-Vorgabe 2/„warnen“ wird beim Laden einmal gehoben), Geräteleiste ✓/⧗/✕/▭ (ohne Gerät
  ✕), Sortierung im Reiter „Starter“ in drei Stufen. Zählfehler „3 offen“ trotz ✓ am Handy (Befund 15): zwei Tabs
  derselben Kopplung – jetzt sendet nur der zuletzt geöffnete Tab (geraete/tabWache.ts), der ältere bietet „Hier
  weitermachen“. N8 vom Nutzer 21.11.2026 neu gefasst: Start-Freigabe nur für den Parcours mit Parcours-Ampel und
  Auto-Modus, Steg und Vorsteg autark (gebaut 21.11.2026, siehe unten).
  W4 „Handy, Bojen“ ist gebaut ([plan-wkr-w4.md](plan-wkr-w4.md): Bojen-Maske in Fahrtfolge mit Umschalter
  Hinweg/Rückweg, Tor-5-Zähler, „Nicht vorbeigekommen“; Prüfbefunde vom 21.11.2026 behoben, §12, Auslegungen
  P1–P17, Q1–Q7, R1–R8, S1–S5 am 21.11.2026 abends beantwortet – bestätigt bis auf P9/U2, P10/Q2 und die Form
  von „Nicht vorbeigekommen“ (künftig Disq. J), plan-wkr-w4.md §14).
  Wünsche vom 21.11.2026 (WKR_ANNAHMEN T1–T10, bestätigt 21.11.2026 bis auf T9 – R6-10): Steg-Zeitversatz (Ablegen
  sieht „Am Steg“
  vorab, Anlegen erst, wenn das Boot zurück ist – nie derselbe Starter in beiden; das Anlegen des Starts auf der
  Tafel zählt nie im Rückstand), „Abmelden“ am Gerät wirkt wie Liste entfernen (nur was kein anderes Gerät mehr
  abdeckt; das Anlegen im Boot geht beim Abmelden bzw. Pausieren mit aufs Papier; neu Zuweisen holt das Gerät
  zurück, auch nach Neuladen), Handy-Maske auf dem Pad als mittige Spalte bis W5 (seit W5.1 eigene Pad-Anordnung); Beispiel-Boote/-Co-Piloten nur
  noch unter „Beispieldaten“, Beispielstarter nach Art der Veranstaltung. Prüfbefunde dazu behoben.
  Wünsche vom 21.11.2026, zweiter Teil (WKR_ANNAHMEN U–Z, noch zu bestätigen): Disq. an der Boje in der
  Bojen-Maske (wie auf dem Papier, „− letzte zurück“ stellt den vorigen Stand der Zelle wieder her), Bojen-Folge
  „Rückweg gedreht“ (Vorgabe) / „Fahrtfolge“ / „Alles untereinander“ (22.11.2026; ersetzt „Wie der Parcours liegt“), Druck nur für Listen auf Papier bzw. „beides“, WKR-Bögen je Position in der
  Folge der Verzahnung, Übung mit 2–6 s nach dem Abschicken. Prüfbefunde dazu behoben.
  Antworten der Runden 3–6 (21.11.2026 abends) umgebaut ([plan-antworten-runde3-6.md](plan-antworten-runde3-6.md),
  Auslegungen AM, BZ, GF, WN noch zu bestätigen): Parcours-Ampel mit Auto-Modus in der Start-Freigabe, „Mehr → Liste
  abschließen“ entfernt, Rückfrage beim Abschluss im laufenden Lauf, Bojenzelle mit Punkten und Disq.-Buchstabe,
  Ansicht „Wie Gerät“ als Vorgabe, Codes anderer Klassen ausgegraut, Übung mit Erklärung und „Übung beenden“, „So
  lassen“ an den Bedienrechner, erste Liste ohne Neuladen, Geräteart beim Koppeln, bis vier Listen je Gerät,
  Start-Freigabe nie vorgewählt, „nicht vorbeigekommen“ = Disq. J, WKR-Name aus der Einteilung, Sortierung A→Z
  zuerst. Prüfbefunde dazu behoben (21.11.2026): alte Sonne ohne eigene Wahl gilt als „Wie Gerät“, der letzte Start
  auf dem Weg zum Anlegen zählt als „läuft noch“, erste Liste auch nach einem Funkloch ohne Neuladen, Countdown des
  Auto-Modus in jedem Bedienfenster.
  W5.1 (22.11.2026, Plan docs/plan-wkr-w5.md): Pad-Anordnung statt der mittigen Handy-Spalte – bis vier Listen
  nebeneinander, ganzer Steg als Ablegen + Anlegen, Seitenspalte mit Schlange, „Zuletzt“ und Einträgen im Klartext,
  Rundenband über Racecourse A + B, Attempt-Wechsel invers; Maske je Liste am Bedienrechner vorgeben („fest“), sonst
  wählt der WKR unter „Mehr“. Auslegungen PD1–PD6, MW1–MW3 noch zu bestätigen.
  W5.2 (22.11.2026): Maske „Bild“ – Parcours-Zeichnung der Klasse inline, Bojen der eigenen Liste antippen (fremde
  blass), Umschalter Hin / Rück / Rück 2 (springt nach Tor 5 auf den Rückweg), Disq. an der Boje über „Disq. an Boje …“,
  im Parallelslalom ein Schema je Racecourse; Vorgabe auf dem Pad für Bojen-Listen, Probe und Übung mit Bild. Klasse 7
  auf Möwe-Listen zeigt Knöpfe (Zeichnung ohne untere Speedboje). Auslegungen BD1–BD7 noch zu bestätigen.
  W5.3 (22.11.2026): Knoten am Tisch – eine Knoten-Liste je Veranstaltung (ohne Lauf), am Gerät Nummer über eigene
  Ziffern-Tasten eintippen, je Knoten ✓ / ✗ · 5, Abschicken erst bei allen gesetzt, keine Schlange und kein Takt;
  am Bedienrechner eigener Block „Knoten: 14 / 38 offen“ (nie Rückstand), Abschluss der ganzen Liste, Knoten-Bögen
  „nur digital“ möglich; Übung „Knoten (am Tisch)“. Auslegungen KN1–KN8 noch zu bestätigen.
  W5.4 (22.11.2026): Zeit-Listen mit Ziffernblock – Zeit nur abgelesen eintippen (0–9, „,“, ⌫), groß die Uhr
  „1:23,45“ mit Deutung „= 1 min 23,45 s“ wie am Rechner, unlesbar rot; eine Zeile je Start mit allen Zeitfeldern,
  Abschicken erst, wenn jedes Feld eine Zeit oder „Keine Zeit“ (Grund: Zeitanlage ausgefallen, nicht im Ziel, anderer)
  hat; Pad: Felder nebeneinander, Handy: Feld-Reiter. Start/Ziel mit Zeit (Möwe, Berlin) = Bojen-Maske mit
  Zeit-Abschnitt. Am Bedienrechner „✓ keine Zeit“ in der Matrix, Grund im Eingang, „Papier ansehen“ an genau diesen
  Zellen der Erfassung; nie auf Tafel, Zuschauerliste, Start-Freigabe. Probe „Tippe 83,45 ein“, Übung „Zeit“.
  Auslegungen ZT1–ZT4 noch zu bestätigen.
  W5.5 (22.11.2026): Maske „Tabelle“ für Geübte – nur Pad und Rechner (auf dem Handy ausgegraut), nie Vorgabe: die
  Zeile des Bogens der Klasse mit echter Tastatur, die letzten 5 gesendeten Zeilen (✓/↑) darüber, die nächsten 3
  Starts darunter; Tab/Enter wie die Erfassung am Rechner, Enter in der letzten Zelle schickt ab (Overlay, Sperre wie
  bei den Knöpfen); Codes als Text („2x6, 20“), Bojen als Punkte bzw. „5J“; was die Erfassung still verwürfe, steht als
  Fehler an der Zelle und sperrt; „Korrigieren“ an einer gesendeten Zeile mit Rückfrage alt → neu. Auslegungen TB1–TB5
  noch zu bestätigen. **W5 fertig** – alle Auslegungen PD, MW, BD, KN, ZT, TB noch zu bestätigen.
  Prüfbefunde W5 behoben (22.11.2026, plan-wkr-w5.md §13): Tabelle stiehlt keinen Fokus aus anderen Spalten, „Rück 2“
  bleibt nach DISQ, „Rückweg gedreht“ = umgekehrte Fahrtfolge auch mit Speedrunde, Bild nie höher als der Bildschirm
  (±90° nur wo es passt), Namensnennung der Zeichnung auf dem Gerät, Trefferkreise ≥ --wkr-ziel, Tastatur kippt die
  Pad-Anordnung nicht.
  Antworten der Runden 7–8 (22.11.2026) umgebaut ([plan-antworten-runde7-8.md](plan-antworten-runde7-8.md), neue
  Auslegungen noch zu bestätigen): Zeit-Listen zählen zur Parcours-Ampel, mehrere Disq. je Boje („5, J, D“, Eingabe
  tolerant), Langdruck auf eine Boje öffnet ihre Disq.-Buchstaben (Knöpfe und Bild), Übung mit „Klasse vorziehen“,
  Beispieldaten behalten Hand-Zahlen je Klasse (mit Zurücksetzen), Parallel-Zeichnung aus dem Parcours-Repo, Bild ohne
  automatischen Wechsel auf den Rückweg, Knoten mit vorbelegtem nächstem offenen Starter, „Alle richtig“ und Rückfrage
  vor der Korrektur, Zeitfelder springen weiter (nur das erste Pflicht). Prüfbefunde dazu behoben (22.11.2026):
  Langdruck wirkte im Bild nur einmal (Loslassen jetzt auch am Fenster), Knoten-Vorschlag vorbelegt (KN12); alte
  Bojenzellen „5J“ gelten beim Gerätevergleich als abweichend (BZ1, bewusst ohne Migration).
  Runde 9 (23.11.2026): bis auf die Parallel-Zeichnung alles bestätigt; die zeigt auf dem Gerät jetzt nur eine Bahn
  ohne Steg, für Racecourse A und B dieselbe, mit den IDs aus dem Parcours-Repo (R9-05 bis R9-07); dieselbe Bahn steht
  auf dem Fahrweg-Bogen jedes Racecourse neben der Legende in 100 mm Breite – einsprachig ohne eine Zeile je Blatt
  zu kosten, zweisprachig bricht die Legende dafür um (2 Zeilen weniger je Blatt; noch zu bestätigen). Prüfbefunde
  dazu behoben (23.11.2026): die Zeichnung war zweisprachig nur 45 × 11 mm groß, die Namensnennung im Fuß stand in der
  Sprache der Oberfläche statt des Bogens, der Sync nannte bei einer Boje außerhalb des Bilds fälschlich fehlende IDs.
  Veröffentlichen: Der Parcours-Commit a9c4275 ist noch nicht gepusht – erst ihn, dann alcatraz (QUELLE.json,
  LICENSE.md und die Namensnennung nennen ihn; `npm run parcours:sync` warnt, solange er auf keinem Remote-Branch steht).
  Offen: Feldtest Pad (docs/feldtest.md „Pad (W5)“, u. a. Lage der Trefferkreise im echten Browser), W6 nach Befund;
  die Tests „Probe beim Einrichten … einmal je Raum“ und „W5.2 … Probe am Bild“ (src/GeraetWkr.test.ts) wackeln unter
  Last und können so auch den Pages-Deploy aufhalten (vorerst zurückgestellt; nach einem Push prüfen, ob die neue
  Fassung online ist).
- **Mehrere Geräte:** Anzeigetafel und Zuschauerliste laufen im zweiten Fenster am Bedienrechner (ohne Netz) und
  über Lese-Links auch auf anderen Geräten (E6, verschlüsselt über einen ntfy-Server; nur gegen einen nachgebauten
  Server getestet); seit E7 auch die Start-Freigabe vom gekoppelten Handy. Offen: Feldtest mit echten Handys und
  echtem Server (E8, Checkliste [feldtest.md](feldtest.md): Hintergrund, Wake Lock, iPhone, Kontingent).
- Aus der Excel-Auswertung: Urkunden-Daten u. a.
- Was fachlich entschieden, aber noch offen ist: [entscheidungen.md](entscheidungen.md#offen).

## Ursprüngliche Ideenliste

Die Liste stammt aus der Zeit vor den Prototypen; der Wortlaut der Ideen ist unverändert, nur Tippfehler sind berichtigt.
Die Kästchen sind am 16.11.2026 gegen den Code nachgezogen.
Hinter jeder Idee steht nach „→“, wo sie umgesetzt ist, oder was fehlt.
„Teilweise“ und „offen“ heißen: noch zu entscheiden, ob es kommt oder verworfen wird.

Hier nur eine grob sortierte Auflistung der meisten Ideen:

- [x] Verzahnung (Starter 1 Klasse 1, Starter 2 Klasse 4, Starter 3 Klasse 1, ...)
  → [Verzahnung](funktionen.md#verzahnung)
- [ ] Ansicht für Wettkampfrichter
  → offen: braucht mehrere Geräte; die Erfassung am eigenen Gerät ist im Datenmodell vorbereitet
  (siehe [Was offen ist](#was-offen-ist))
  - [ ] Login und Rechtemodell ... → offen; Alcatraz hat bisher bewusst keine Anmeldung
  - [ ] Nächster Start wird erst freigegeben, wenn alle Wettkampfrichter den Lauf abgenickt haben → offen
  - [ ] Startnummer und Klasse muss sich vor jedem Start aktualisieren → offen
  - [ ] Starterseite → teilweise: die [Anzeigetafel](funktionen.md#betrieb-start-freigabe-und-anzeigetafel) im zweiten
    Fenster am Bedienrechner („Im Boot“, davor), die Startliste im Betrieb und die Zuschauerliste (eigenes Fenster,
    fürs Handy gebaut), beide seit E6 auch über einen Lese-Link auf Handys und Bildschirmen; seit E7 die
    Start-Freigabe auf dem gekoppelten Handy
    - [x] Anzeige von Informationen wie Startnummer, Name, Klasse und Lauf → Anzeigetafel
    - [x] Aufgeteilt nach 'Im Boot', 'Am Steg', 'Vor Steg' → Zuschauerliste (Anzeigetafel: „Im Boot“ und davor)
    - [x] Starterzahl in den Bereichen konfigurierbar (1 im Boot, 2 am Steg, 2 vor Steg) → Einstellungen → Startfolge
      im Betrieb (je 0–10)
    - [ ] Reihenfolge, je nach Berechtigung, änderbar → teilweise: an der Start-Freigabe zurückstellen, verschieben,
      Klasse aussetzen oder vorziehen, in der Startliste auch durch Ziehen; Berechtigungen kommen mit den Geräten
    - [x] Unterschiedliche Farben für Klasse und Lauf → Anzeigetafel (Klasse mit Klassenfarbe, Lauf in eigener Farbe)
    - [x] Starter rutschen automatisch hoch nach abgeschlossenem Lauf → „Nächster Start“ zeigt den Nächsten der Folge;
      der Lauf danach wird ausdrücklich begonnen
    - [ ] Zeitplan (Pausen, Feierabend etc.) bei der Sortierung → offen; Pausen gibt es als Meldung auf der Anzeigetafel
      (auch als Vorlage: Mittagspause, Siegerehrung …)
    - [x] Ungefähre Berechnung der Zeit bis zum Start/Vorsteg → Startliste und Zuschauerliste: „ca. in“ und „Zum
      Vorsteg“ aus den Startabständen je Klasse (ab drei Messungen gemessen, sonst Vorgabe der DM 2025)
- [x] Gedruckte WKR-Listen → [Wettkampfrichter-Listen](funktionen.md#wettkampfrichter-listen)
  - [ ] Verzahnung auf einer Liste (kein Blattwechsel immer wieder, sondern von oben nach unten auszufüllen) (optional)
    → teilweise: Ein Bogen gilt je Klasse und Lauf, die Starter stehen darauf in der Startfolge der Verzahnung.
    Nur bei der Clubmeisterschaft stehen mehrere Klassen auf einem Bogen, dann untereinander statt verzahnt.
  - [ ] leichte Grau- oder Farbtöne für andere Klassen
    → offen: Auf gemeinsamen Bögen trennt eine Zwischenüberschrift die Klassen; grau ist nur jede fünfte Zeile.
    - [ ] Schikane (und andere nicht angefahrene Beobachtungspunkte) bei kleineren Klassen auf verzahnten Listen
          ausgrauen → offen
  - [x] Auch mehrere Klassen auf einer Seite (konfigurierbar)
    → bei der Art „Clubmeisterschaft“ (Reiter „Veranstaltung“); Listen mit Parcoursbild bleiben je Klasse
    - Bei Clubmeisterschaften oder kleinen Wettkämpfen mit nur 1–2 Startern pro Klasse macht eine eigene Liste keinen
      Sinn
  - [x] Übertragung von Listen in das Programm mit gleicher Ansicht
        (Browserformular und Beobachtungsliste sind identisch) → [Erfassung](funktionen.md#erfassung)
    - Weniger fehleranfällig und einfache Kontrolle
  - [ ] Lauf kann erst 'abgeschlossen' werden, wenn alle Beobachtungslisten eingetragen & kontrolliert wurden
    → teilweise, auf Papier: Der [Laufzettel](funktionen.md#laufzettel-und-qr-codes) hat ein Kästchen je Bogen und die
    Schritte der Auswertung. Die Erfassung zeigt den Fortschritt je Bogen, sperrt aber nichts.
    - [ ] 4-Augen-Prinzip. Kontrolle muss mit einem anderen Wettkampfrichter/Benutzer erfolgen
      → teilweise, auf Papier: „Geprüft“ und „Unterschrieben“ auf dem Laufzettel; in der App ohne Benutzer offen
- [ ] Support für 'Spaßstarter' → offen
    - Ältere Starter fahren in jüngerer Klasse (zusätzlich zum eigentlichen Lauf)
    - Mit auf den Listen und bei der Erfassung
    - Mit im Aushang
    - Nicht in die Endwertung, aber mit Info für die Siegerehrung (Differenz zum eigentlichen Starter etc.)
- [x] Bei Clubmeisterschaft den Verein nicht anzeigen → Herkunft „ohne“ im Reiter „Veranstaltung“
- [x] Regel als Set hinterlegen (Deutsche Meisterschaftsregeln)
  → DM-Reglement (`dm-2026`), dazu UIM Regel 960 (`uim-2026`); [Regelwerke](funktionen.md#regelwerke-und-begriffe)
- [ ] Regeln für die Veranstaltung auf Basis der DM-Regeln
  → teilweise: Läufe, Streichläufe, zusätzliche Listen und eigene Aufbauten sind je Veranstaltung einstellbar;
  einzelne Regeln abschalten oder überschreiben geht nicht.
  - Regeln können deaktiviert oder überschrieben werden
- [x] Verstöße werden mit Kürzel (A, B, C usw.) angegeben und dargestellt
  → Buchstaben und Fehlercodes aus dem Regelwerk; [Aushang der Codes](funktionen.md#aushang-der-codes)
- [x] Zeiten können im Format 1,2345 und 83,45 statt 1:23:45 eingegeben werden
  → [Erfassung](funktionen.md#erfassung)
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
    - Buchstaben über das gesamte Programm gleich
    - Nur die Buchstaben, die in der Aushangliste aufgeführt werden, werden als (optionale) Tabelle darunter angezeigt
      → offen: Heute stehen alle Codes des Regelwerks auf einem eigenen Aushang, nicht nur die benutzten unter der Liste.
