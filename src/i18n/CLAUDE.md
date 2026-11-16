# src/i18n – Texte der Oberfläche und der Listen

`de.ts`/`en.ts` setzen nur die Bereichsdateien aus `de/` und `en/` zusammen. `index.ts`: t()/tn(), tIn(), texteIn()
(Listensprache), Datumsformate; MessageKey = Schlüssel von de.ts.
Nicht hier: Regelwerk-/Positionstexte (config/*.yaml, config/i18n/en.yaml), feste Bogentexte (config/sprache.ts).

## Welcher Präfix in welcher Datei (de/ und en/ gleich geschnitten)

| Datei | Präfixe | Stichworte |
|---|---|---|
| allgemein.ts | app, nav, common, date, licences, settings, theme | Kopf/Fuß, Reiter, Datum, Lizenzen, Darstellung |
| veranstaltung.ts | event, demo, crew | Veranstaltung, Beispieldaten, Besetzung |
| starter.ts | starters, import, lock, weigh | Starter, Excel, Sperre des Starterfelds, Verwiegung |
| verzahnung.ts | numbers, running, vz, boats, parcours | Startnummern, laufende Nummern, Verzahnung, Boote |
| parallel.ts | parallel | Parallelslalom |
| erfassung.ts | capture, entries, scan | Erfassung, Verlust erfasster Werte, Scan |
| wertung.ts | individual, notScored, results, scoring, cup | Einzelwertung, nicht werten, Wertungslisten, Streichläufe, Mannschaft |
| listen.ts | lists, runsheet, booklet | Reiter „Listen“, Laufzettel, Druckdatei |
| listenoptionen.ts | wkr, preview, sheet, listopt, origin, short | WKR-Einteilung, Beispielansicht, Listenoptionen, Herkunft, Kürzel |
| aufbauten.ts | own, assist | eigene Aufbauten, Aufbau-Assistent |
| verlauf.ts | offline, files, history, backup | Offline/Update, Dateien, Verlauf, Zurücksetzen |
| betrieb.ts | betrieb, anzeige, meldung | Start-Freigabe (Oberfläche), Anzeigetafel (Sprache der Tafel, tIn), Meldungsarten; ab E6 geraete |

## Text ergänzen

- Schlüssel `<präfix>.<name>` in de/<datei>.ts UND en/<datei>.ts (Datei laut Tabelle), am besten an derselben Stelle.
- Gleiche Platzhalter `{name}` in beiden Sprachen; Zahlform „Einzahl | Mehrzahl“ in beiden oder in keiner (tn(), `{n}`).
- Englisch nach dem Rulebook (driver, race official, racecourse, attempt, re-run); auf Listen texteIn(), nicht t().
  „Display board“, „start release“, „operation“ sind vorläufig (Plan vom 16.11.2026) – das Rulebook hat kein Wort dafür.
  Einstellungen der Anzeigetafel: listopt.anzeige.* (listenoptionen.ts); Reiter nav.betrieb (allgemein.ts).
- Neuer Präfix: in genau eine Datei, Tabelle nachtragen. Neuer Bereich: Datei in de/ und en/, in de.ts und en.ts einhängen.
- Prüfen: `npx vue-tsc -b` (en-Teil gegen de-Teil: fehlende/überzählige Schlüssel; im Code benutzte, fehlende Schlüssel),
  `npx vitest run src/i18n` (Platzhalter, Zahlformen; teile.test.ts: Präfix in genau einem Teil, alle Teile eingehängt).
