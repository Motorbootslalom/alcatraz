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

**Aus `tafel`** ist übernommen (Plan vom 16.11.2026, Etappe E1;
[Betrieb: Start-Freigabe und Anzeigetafel](funktionen.md#betrieb-start-freigabe-und-anzeigetafel)):
die Anzeigetafel in einem zweiten Fenster am Bedienrechner und die Start-Freigabe dort, für das Manövrieren,
ohne Netz. Es folgen in Etappen: Steuerung mit Zurückstellen, Aussetzen und Verschieben, die Startliste im Betrieb
mit Zeitprognose und Zuschauerliste, der Parallelslalom auf der Anzeigetafel, dann Anzeigetafel, Zuschauer und
Start-Freigabe auf anderen Geräten (verschlüsselt über ntfy).

**Aus `Parcours`:** Klasse E, 1–7 und Möwe sind eingebunden
(`src/assets/parcours`, `npm run parcours:sync`; Lizenz: [README](../README.md#lizenzen)).
Genutzt werden sie im Assistenten („Im Bild“) und auf den WKR-Bögen.

**Aus der Excel-Auswertung** sind da:

- die [Starterlisten](funktionen.md#starterlisten-und-vorsteg-liste) und die Vorsteg-Liste,
- die [Verwiegung](funktionen.md#verwiegung) mit Gewichtslisten und der Liste „Ausgleichsgewichte“,
- die [Mannschaftswertung](funktionen.md#mannschaftswertung),
- die [Druckdatei](funktionen.md#druckdatei).

## Was offen ist

- Erfassung durch die Wettkampfrichter am eigenen Gerät (im Datenmodell vorbereitet).
- **Mehrere Geräte:** Die Anzeigetafel läuft heute im zweiten Fenster am Bedienrechner (ohne Netz). Für Anzeigetafel,
  Start-Freigabe und Startlisten auf anderen Geräten ist die verschlüsselte Übertragung über einen ntfy-Server
  vorgesehen (Prototyp `tafel`, noch nicht übernommen).
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
    Fenster am Bedienrechner („Im Boot“, davor); Startliste im Betrieb und andere Geräte folgen (Prototyp `tafel`)
    - [x] Anzeige von Informationen wie Startnummer, Name, Klasse und Lauf → Anzeigetafel
    - [ ] Aufgeteilt nach 'Im Boot', 'Am Steg', 'Vor Steg' → teilweise: „Im Boot“ und davor; Am/Vor Steg kommt
      mit der Startliste im Betrieb
    - [ ] Starterzahl in den Bereichen konfigurierbar (1 im Boot, 2 am Steg, 2 vor Steg) → vorbereitet (2/2 im Stand),
      noch nicht einstellbar
    - [ ] Reihenfolge, je nach Berechtigung, änderbar → offen: Verschieben kommt; Berechtigungen mit den Geräten
    - [x] Unterschiedliche Farben für Klasse und Lauf → Anzeigetafel (Klasse mit Klassenfarbe, Lauf in eigener Farbe)
    - [x] Starter rutschen automatisch hoch nach abgeschlossenem Lauf → „Nächster Start“ zeigt den Nächsten der Folge;
      der Lauf danach wird ausdrücklich begonnen
    - [ ] Zeitplan (Pausen, Feierabend etc.) bei der Sortierung → offen; Pausen gibt es als Meldung auf der Anzeigetafel
    - [ ] Ungefähre Berechnung der Zeit bis zum Start/Vorsteg → offen, kommt mit der Startliste im Betrieb
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
