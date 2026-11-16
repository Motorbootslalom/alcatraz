# Technik

Wie Alcatraz gebaut ist und wie man daran arbeitet.
Was die App fachlich kann: [funktionen.md](funktionen.md).
Betrieb ohne Internet, Sicherung und Verlauf: [betrieb.md](betrieb.md).
Für Agenten und Entwickler gibt es dazu die Projektkarte [CLAUDE.md](../CLAUDE.md) mit Ordnerkarte und Datenfluss.

## Inhalt

- [Aufbau](#aufbau)
- [Offline-Speicher](#offline-speicher)
- [Entwickeln](#entwickeln)
- [Tests](#tests)

## Aufbau

Alcatraz ist eine reine Browser-Anwendung ([Vue 3](https://vuejs.org/), TypeScript, [Vite](https://vite.dev/)).
Server, Datenbank und Anmeldung gibt es nicht (siehe [README](../README.md)).

- **Mehrsprachig:** Die Oberfläche lässt sich im laufenden Betrieb umschalten (bisher Deutsch und Englisch).
  Die Texte stehen in `src/i18n/`; eine weitere Sprache ist eine weitere Katalogdatei.
- **Adressen in der Sprache der Oberfläche:** Jede Ansicht, jeder Reiter und jedes Sprungziel hat eine Adresse
  zum Weitergeben (`#/listen/wkr`, englisch `#/lists/race-officials`).
  - Geschrieben wird sie in der Sprache der Oberfläche, gelesen in jeder.
    Ein deutscher Verweis geht auch bei englischer Oberfläche auf und wird ohne Schritt im Verlauf umgeschrieben.
  - Die Wörter stehen je Sprache in einer Tabelle in `src/lib/adressen.ts`; die Namen im Code bleiben deutsch.
  - Ergibt eine weitere Sprache ein mehrdeutiges Wort, gilt für dieses Ziel das englische (`wortraum`).
  - Ein Querverweis kann eine Auswahl im Reiter mitgeben (drittes Segment, ein Wert aus den Daten, nicht übersetzt).
    Beispiel: „Verwiegung → Gewichtslisten drucken“ führt zu `#/listen/gewicht/<Herkunft>` (`*` = alle).
    Die Ansicht übernimmt die Wahl; danach steht in der Adresse wieder nur der Reiter.
  - Verändert wird nur der Hash – das geht auch in der Ein-Datei-Fassung unter `file://`.
- **Gedruckte Listen im Mittelpunkt:** Gedruckt wird über den Druckdialog des Browsers (auch „Als PDF speichern“).

Aufbau von `src/`:

- `domain/`: Klassen, Startnummern
- `import/`: Excel-Austausch
- `planung/`: Verzahnung, Boote, Parallel-Slalom
- `state/`: Zustand als reiner Reducer
- `persistenz/`: Speicher im Browser, Sicherung
- `i18n/`: Sprachen
- `views/` und `components/`: Oberfläche

Die vollständige Ordnerkarte steht in [CLAUDE.md](../CLAUDE.md).

## Offline-Speicher

Was Auswerter davon sehen und tun müssen, steht in [betrieb.md](betrieb.md).

- `scripts/offline-sw.js` ist der Service Worker, von Hand geschrieben, ohne Workbox.
  Eine Strategie: alles vorab, mit Prüfsumme je Datei, ein Cache je Fassung.
- Welche Fassung ausgeliefert wird, sagt ein Zeiger „gültige Fassung“ im Speicher.
  Ihn setzt nur „Update“ um – oder bei leerem Stand der Start –, nicht der gerade laufende Service Worker.
  Deshalb muss die Datei über Fassungen hinweg verträglich bleiben, siehe ihren Kopf;
  alte Caches gehen nach dem Umschalten.
- Einen Übergang von Fassungen vor dem Zeiger gibt es nicht:
  Die Anwendung ist noch in Entwicklung (Entscheidung vom 15.11.2026).
- Geprüft mit zwei Builds hintereinander, die ein statischer Server auf derselben Adresse nacheinander ausliefert:
  Mit Startern bleibt die alte Fassung über Neuladen, neuen Tab und Neustart des Browsers hinweg,
  bis „Update“ gedrückt wird (andere Fenster zeigen danach „bitte neu laden“).
  Ohne Starter übernimmt Alcatraz die neue beim Öffnen von selbst
  (bzw. beim nächsten Öffnen, wenn im Fenster schon gearbeitet wurde).
- `scripts/offline-speicher.ts` schreibt den Service Worker beim Build mit der Liste aller Dateien als `dist/sw.js`.
  Das Deployment ruft das Skript nach dem Kopieren von `alcatraz.html` noch einmal auf.
- Die Seite dazu: `src/lib/offline.ts`, `src/components/OfflinePanel.vue`.
- Der zweite Speicher: `src/persistenz/zweitspeicher.ts` (IndexedDB),
  `src/state/zweit.ts` (wann geschrieben wird, Abgleich beim Start),
  `src/lib/verlauf.ts` (welcher Stand neuer ist, Zusammenfassen, Grenzen), `src/components/VerlaufPanel.vue`.
- Jede Speicherung trägt eine Speichermarke (Folge-Nummer und Uhrzeit), die der Store vergibt;
  der Reducer bleibt ohne Uhr.
  Sie steht im gespeicherten Text, aber nicht im Stand und nie in einer Datei.
- Die Tests benutzen statt der IndexedDB des Browsers `fake-indexeddb` (nur zum Testen).
- `public/manifest.webmanifest` macht die Pages-Fassung installierbar.

## Entwickeln

```sh
npm install
npm run dev             # Entwicklungsserver
npm run check           # Typprüfung und Tests
npm run build:all       # dist/ (GitHub Pages) und dist-single/ (eine Datei)
npm run parcours:sync   # von Hand: Parcours-Zeichnungen aus ../Parcours holen (nicht Teil der CI)
```

Die Parcours-Zeichnungen unter `src/assets/parcours/` kommen nur über `npm run parcours:sync`
(Herkunft und Lizenz: [`src/assets/parcours/LICENSE.md`](../src/assets/parcours/LICENSE.md)).

**Bilder der README** (`docs/bilder/`): aufgenommen mit `npm run dev` und den Beispieldaten der App.

- Nur erfundene Daten: Beispiel-Starterfeld, Beispielwerte, Beispiel-Besetzung, Beispielgewichte,
  ein erfundener Veranstaltungsname ohne Jahr (die App hängt das Jahr an, im Kopf stünde es sonst doppelt).
- Herkunft „Bundesland“ oder „Land“, nie „Verein“: `src/data/clubs.ts` ist an reale Vereine angelehnt,
  und erfundene Personen sollen nicht echten Vereinen zugeordnet erscheinen.
- Helles Farbschema, zugeschnitten auf das Wesentliche, etwa 1200 px breit, je Datei unter 250 KB
  (verkleinert mit ImageMagick auf 64–256 Farben und `oxipng`).
- Ohne Fußzeile der App und ohne die Quellenzeile unter dem Parcoursbild; die Lizenz steht in der README.
- Die README zeigt sie nur als Vorschau mit Link auf das volle Bild:
  Ansichten und Bögen 180–300 px breit, breite Listen 600 px in einer eigenen Zeile.

## Tests

Getestet wird mit Vitest und happy-dom; die Tests liegen neben dem Code (`*.test.ts`).
Personen in Tests und Beispieldaten sind erfunden (`src/data/names.ts`).
Die Befehle für gezielte und volle Läufe stehen in der Projektkarte unter [Befehle](../CLAUDE.md#befehle).

Die CI (`.github/workflows/ci.yml`) führt `npm run check` und `npm run build:all` aus.
Das Deployment auf GitHub Pages (`.github/workflows/deploy.yml`) liefert die Ein-Datei-Fassung als `alcatraz.html` mit.
