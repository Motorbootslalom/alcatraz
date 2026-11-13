# Alcatraz
Alcatraz ist eine browserbasierte Software für die Auswertung von Wettkämpfen beim Motorbootslalom bzw. Schlauchbootslalom (International: UIM Formula Future)

Ich habe seit 1995 die Auswertungen der Wettkämpfe beim Landesverband Motorbootsport Brandenburg gemacht. Damals noch auf Basis von Excel und VBA. Zwischen jedem Wettkampf habe ich das "Programm" Stück für Stück erweitert. Als ich 2003/2004 aus zeitlichen Gründen nicht mehr teilnehmen konnte, blieb auch die Entwicklung dazu liegen.

Seit 2008 bin ich wieder aktiv dabei. In der Zwischenzeit hatte Volker ein eigenes Programm (auch auf Excel Basis) entwickelt. Beide Programme haben viele Gemeinsamkeiten und unterschiedliche Vorteile. Zusammen haben sie aber den Nachteil, dass sie nur mit Excel unter Windows laufen. Auch mit der aktuellen Version für Mac OS X laufen sie nicht.

Da ich persönlich weder mit Windows noch mit Mac gern arbeite, wächst in mir der Wunsch, nach einer vom Betriebssystem unabhängigen Lösung. Aus diesem Grund, soll Alcatraz im Browser laufen. Auch ohne aktive Internetverbindung...

## Warum der Name Alcatraz?
Alcatraz ist die Bezeichnung für eine Wettkampfrichter Position. Bei dieser Postion stehen zwei Boote hinter Tor 5 quer zum Parcours. Ein Wettkampfrichter meinte dann sehr beschreibend, dass man sich auf dieser Postion wie auf Alcatraz (eine früher als Gefängnis genutzte Insel in der Bucht von San Francisco) fühle.

## Was soll das ganze Kosten?
Nichts...

Das Programm wird hier mit dem gesamten Quelltext als [freie Software](http://fsfe.org/about/basics/freesoftware.de.html) veröffentlicht.

In den meisten Landesverbänden wurden von fleißigen Helfern Programme für die Auswertung geschrieben und gehütet wie ein Staatsgeheimnis. Ich glaube nicht, dass das der richtige Weg ist. Ich glaube, es bringt mehr, wenn jeder seine Erfahrung mit einbringen kann um ein Stück Software zu schaffen,was jeder nutzen kann und auch nutzen möchte.
Gemeinsam kann man oft mehr erreichen.

## Wie ist Alcatraz gebaut?
Alcatraz ist eine reine Browser-Anwendung ([Vue 3](https://vuejs.org/), TypeScript, [Vite](https://vite.dev/)). Es gibt **keinen Server, keine Datenbank und keine Anmeldung**: Alle Daten liegen im Browser des Auswertungsrechners und lassen sich als Datei sichern. Ausgeliefert wird über GitHub Pages; zusätzlich entsteht eine einzelne HTML-Datei (`alcatraz.html`), die ohne Internet per Doppelklick läuft.

- **Mehrsprachig:** Die Oberfläche lässt sich im laufenden Betrieb umschalten (bisher Deutsch und Englisch). Die Texte stehen in `src/i18n/`; eine weitere Sprache ist eine weitere Katalogdatei.
- **Gedruckte Listen im Mittelpunkt:** Gedruckt wird über den Druckdialog des Browsers (auch „Als PDF speichern“).
- **Mehrere Geräte:** Für Anzeigetafel und Startlisten auf anderen Geräten ist die verschlüsselte Übertragung über einen ntfy-Server vorgesehen (noch nicht übernommen, siehe Tabelle).

Alcatraz führt die bisherigen Prototypen zusammen:

| Quelle | Inhalt | Stand in Alcatraz |
|---|---|---|
| `verzahnung-prototyp-vue` | Starter, Startnummern, Verzahnung, Bootbedarf, Parallel-Slalom | übernommen |
| `fehlerpunkte-prototyp-vue` | Regelwerke, Aufbauten, WKR-Listen, Erfassung, Ergebnislisten | Regelwerke und Aufbauten übernommen (`src/config/`); WKR-Einteilung und Beispielansicht unter „Einstellungen“. Die echten Wettkampfrichter-Listen stehen unter „Listen“ (`src/lib/wkrListen.ts`, `src/components/WkrListen.vue`): je Parcours, Klasse, Lauf und Liste ein Bogen mit den Startnummern in der Startreihenfolge der Verzahnung, Leerzeilen für Nachmeldungen, wahlweise Beschreibung auf der Rückseite; bei der Clubmeisterschaft mehrere Klassen je Bogen (Listen mit Parcoursbild bleiben je Klasse). **Erfassung** (eigener Reiter): die ausgefüllten Listen nach dem Lauf abtippen – derselbe Bogen wie auf dem Papier als Eingabetabelle, Tastatur wie im Prototyp, Fortschritt je Bogen, Hinweise auf unplausible Eingaben (`src/views/ErfassungView.vue`, `src/lib/eingaben.ts`, `src/lib/erfassung.ts`). **Wertung** als reine Funktionen (`src/lib/ergebnis.ts`, `scoring.ts`, `time.ts`, `codes.ts`, `disq.ts`), **Ergebnislisten** je Klasse, Lauf und gesamt unter „Listen“ (`src/components/ErgebnisListen.vue`), gedruckt in der Reihenfolge der Bögen (Parcours, dann Klasse nach Startreihenfolge); im Kopf jeder Liste steht, wann sie sich zuletzt geändert hat (`src/lib/listenStand.ts` – der Zeitpunkt kommt mit der Action, steht in der Sicherung und unterscheidet sich vom Druckzeitpunkt im Seitenrand). Bei gleichen Punkten entscheidet der Stichentscheid des Regelwerks (`stichentscheid` in `src/config/regelwerke/*.yaml`: DM der schnellste gewertete Lauf, UIM nach Regel 960 Pkt. 5.2.6 die Summe beider Versuche); erst danach wird ein Platz geteilt. Wer noch nicht gefahren ist, steht ohne Zeit auf Platz 1; ein X am Steg oder Vorsteg steht als „Nicht gestartet“ auf der Liste, zählt wie eine Disqualifikation und steht auch im Zwischenstand der Gesamtliste hinten, bis der Streichlauf den Lauf aufnimmt. Sieht das Regelwerk eine Zahl von Läufen vor (`wertungslaeufe`, UIM: zwei Versuche, der bessere zählt) und ist die Veranstaltung anders eingestellt, weist die Oberfläche darauf hin. Beispieldaten (Starterfeld und Beispielwerte) am Ende von „Veranstaltung“, zugeklappt, solange nicht mit Beispieldaten gearbeitet wird. **QR-Codes** auf jeder Druckseite jedes Bogens und auf jedem Laufzettel (`src/lib/qr.ts`, Format `ALC1.<Veranstaltung>.<Regelwerk>.<Aufbau>.<Parcours>.<Klassen>.<Lauf>[.<Liste>.S<Seite>]`, als Vektor eingebettet, Bibliothek `qrcode-generator` fest eingebaut): Ein Handscanner oder das Feld „Blatt scannen“ springt in der Erfassung zum Bogen und in dessen erste Zelle; Blätter einer anderen Veranstaltung, eines anderen Regelwerks oder Aufbaus werden mit Begründung abgewiesen; ein Scan hinterlässt keine Spur in dem Feld, in dem der Cursor gerade stand (`src/lib/scanner.ts`, `src/lib/scan.ts`). **Laufzettel** (Checklisten) als eigene Listenart: je Blattstapel – Parcours, Klasse und Lauf, bei der Clubmeisterschaft mit gemeinsamen Bögen Parcours und Lauf – ein A4-Querblatt zum Falten auf A5 mit einem Kästchen je gedruckter Seite; die Seitenzahlen sind an denselben Bögen gemessen, die gedruckt werden. Die Form ist wählbar: eine Zeile je Seite mit dem Kästchen vorn (Vorgabe, bei vielen Seiten mehrspaltig) oder eine Zeile je Liste mit den Kästchen nebeneinander (`src/lib/laufzettel.ts`, `src/components/LaufzettelListen.vue`). **Listen der Veranstaltung** (`src/lib/listen.ts`): die Listen des Aufbaus, wahlweise mit „Tor 5 übernimmt die Parcoursüberwachung“ (eine Liste statt zweier; Disq., Bemerkung, Haken und WKR-Name ziehen um, `src/state/tor5.ts`), dazu zusätzliche Listen außerhalb des Aufbaus (Knoten, Vorsteg, Varianten ohne Start/Ziel) – gedruckt, in der WKR-Einteilung geführt, erfasst, gewertet und auf dem Laufzettel gezählt wie die des Aufbaus. Die Knoten-Liste sehen beide Regelwerke in jedem Aufbau des Manövrierens vor (`vorgabeListen` je Disziplin in `src/config/regelwerke/*.yaml`); sie ist abwählbar. **Listenoptionen** unter „Einstellungen“: Starter je Seite fest statt automatisch und „Teilen ab“ für die Wettkampfrichter-Listen (gemeinsame Club-Bögen teilen sich immer automatisch), Bezeichnung der Bojen-Seiten (R/L, Land/See, Kai/Hafen, Pfeile, Innen/Außen – die Ergebnislisten bleiben bei R/L), Sprache der Listen unabhängig von der Oberfläche (deutsch, englisch, zweisprachig; nur wo das Regelwerk Englisch anbietet, `src/lib/listensprache.ts`). **Aushang der Codes** als eigene Listenart: alle Fehler- und Disqualifikations-Codes des Regelwerks mit Quelle auf einem A4-Blatt (`src/components/CodesAushang.vue`). Ergebnislisten lassen sich je Liste in beiden Reihenfolgen (Platz, dann Startnummer) in einem Druck ausgeben. Offen: Erfassung durch die Wettkampfrichter am eigenen Gerät (im Datenmodell vorbereitet), Listen und Wertung des Parallel-Slaloms (entstehen zuerst im Prototyp) |
| `tafel` | Anzeigetafel, Startliste im Betrieb, Geräte über ntfy | offen |
| `Parcours` | Parcours-Zeichnungen | Klasse E, 1–7 und Möwe eingebunden (`src/assets/parcours`, CC BY-NC-SA 4.0, `npm run parcours:sync`); genutzt im Assistenten („Im Bild“) und abgeblendet je Position auf den WKR-Bögen |
| Excel-Auswertung | Mannschaftswertung, Verwiegung, Urkunden-Daten u. a. | Starterlisten, Vorsteg-Liste und Verwiegung (Gewichtslisten, Erfassung) sind da; der Rest ist offen |

Alle Listen und Bögen folgen am Bildschirm dem gewählten Farbschema (auch dunkel); gedruckt sind sie immer schwarz auf weiß mit grauer Fünfer-Zeile. Ihre Farben kommen ausschließlich aus den Variablen `--blatt-*` in `src/styles/blatt.css` – neue Listen verwenden nur diese (`src/styles/blatt.test.ts` prüft das).

### Entwickeln
```sh
npm install
npm run dev          # Entwicklungsserver
npm run check        # Typprüfung und Tests
npm run build:all    # dist/ (GitHub Pages) und dist-single/ (eine Datei)
npm run parcours:sync   # von Hand: Parcours-Zeichnungen aus ../Parcours holen (nicht Teil der CI)
```

Aufbau von `src/`: `domain/` (Klassen, Startnummern), `import/` (Excel-Austausch), `planung/` (Verzahnung, Boote, Parallel-Slalom), `state/` (Zustand als reiner Reducer), `persistenz/` (Speicher im Browser, Sicherung), `i18n/` (Sprachen), `views/` und `components/` (Oberfläche).

## Was soll Alcatraz alles können?
Hier nur eine grob sortierte Auflistung der meisten Ideen:

- [ ] Verzahnung (Starter 1 Klasse 1, Starter 2 Klasse 4, Starter 3 Klasse 1, ...)
- [ ] Ansicht für Wettkampfrichter
  - [ ] Login und Rechtemodel...
  - [ ] Nächster Start wird erst freigegeben, wenn alle Wettkampfrichter den Lauf abgenickt haben
  - [ ] Startnummer und Klasse muss sich vor jedem Start aktualisieren
  - [ ] Starterseite
    - [ ] Anzeige von Informationen wie Startnummer, Name, Klasse und Lauf
    - [ ] Aufgeteilt nach 'Im Boot', 'Am Steg', 'Vor Steg'
    - [ ] Starter Zahl in den Bereichen Konfigurierbar (1 im Boot, 2 am Steg, 2 vor Steg)
    - [ ] Reihenfolge, je nach Berechtigung, änderbar
    - [ ] Unterschiedliche Farben für Klasse und Lauf
    - [ ] Starter rutschen automatisch hoch nach abgeschlossenen Lauf
    - [ ] Zeitplan (Pausen, Feierabend etc) bei der Sortierung
    - [ ] Ungefähre Berechnung der Zeit bis zum Start/Vorsteg
- [ ] Gedruckte WKR Listen
  - [ ] Verzahnung auf einer Liste (kein Blattwechsel immer wieder, sondern von oben nach unten auszufüllen) (optional)
  - [ ] leichte Grau- oder Farbtöne für andere Klassen
    - [ ] Schikane (und andere nicht angefahrende Beobachtungspunkte bei kleineren Klassen auf verzahnten Listen ausgrauen
  - [ ] Auch mehere Klassen auf einer Seite (Konfigurierbar)
    - Bei Clubmeisterschaften oder kleinen Wettkämpfen mit nur 1-2 Starter pro Klasse, macht eine eigene Liste kein Sinn
  - [ ] Übertragung von Listen in das Programm mit gleicher Ansicht (Browserformular und Beobachtungsliste sind identisch)
    - Weniger fehleranfällig und einfache Kontrolle
  - [ ] Lauf kann erst 'abgeschlossen' werden, wenn alle Beobachtungslisten eingetragen & kontrolliert wurden
    - [ ] 4 Augenprinzip. Kontrolle muss mit einem anderen Wettkampfrichter/Benutzer erfolgen
- [ ] Support für 'Spaßstarter'
    - Ältere Starter fahren in jüngeren Klasse (Zustätzlich zum eigentlichen Lauf)
    - Mit auf den Listen und bei der Erfassung
    - Mit im Aushang
    - Nicht in die Endwertung, aber mit Info für die Siegerehrung (Differenz zum eigentlichen Startet etc)
- [ ] Bei Clubmeisterschaft den Verein nicht anzeigen
- [ ] Regel als Set hinterlegen (Deutsche Meisterschaftsregeln)
- [ ] Regeln für die Veranstaltung auf Basis der DM Regeln
  - Regeln können deaktiviert oder überschrieben werden
- [ ] Verstöße werden mit Kürzel (A, B, C usw.) angegeben und Dargestellt
- [ ] Zeiten können im Format 1,2345 und 83,45 statt 1:23:45 eingegeben werden
  - Umrechnung erfolgt für die Anzeige automatisch
- [ ] Jede Berührung, jeder Starfpunkt wird einzeln erfasst und ist auch im Aushang entsprechend dargestellt
- [ ] Vorsteg Listen
  - Zum Laufabhaken und ggf. Punkte, wegen Schwimmestes auf dem Steg ausgezogen
- [ ] 3 Extra Zeilen unter Beobachtungslisten
- [ ] Aushanglisten
  - [ ] Spätstarter (die nicht in der regulären Verzahnung fahren) werden oben (1. Platz) Angezeigt
  - [ ] Fehlerpunkte != Bojenberührungen werden als Buchstaben angezeigt
    - Buchstaben über das gesamte Programm gleich
    - Nur die Buchstaben, die in der Aushangliste aufgeführt werden, werden als (optionale) Tabelle darunter angezeigt
