# src/views – die Reiter

App.vue wählt die Ansicht über die Hash-Adresse (lib/router.ts, Wörter je Sprache in lib/adressen.ts VIEWS/ADRESSEN)
und hört auf den Handscanner. Ansichten lesen `state.value`, ändern nur per dispatch. Panels: components/, Logik: lib/.

## Dateien

- `EventView.vue` – Veranstaltung: Name, Jahr, Regelwerk, Aufbau, Art, Herkunft (originMode, SET_ORIGIN_MODE);
  Besetzung, Beispieldaten (components/BeispieldatenPanel.vue, zugeklappt; Test EventView.test.ts `beispielstarter`,
  `beispielbesetzung`, `beispielgewichte`; Herkunft der Beispielstarter = originMode, nie umgestellt).
- `StartersView.vue` – Starter je Klasse, Startnummern, Excel-Austausch, Schalter „zählt für Mannschaftswertung“;
  Leiste „Alle Klassen“ (`sortierung-alle`): Sortierung ändern/Zufall für alle, Spaltenköpfe in ClassSection.vue.
- `WeighingView.vue` – Verwiegung: Gewichte je Herkunft in Ausdruck-Reihenfolge abtippen (SET_WEIGHT); Link
  „Gewichtslisten drucken“ → `#/listen/gewicht/<Herkunft>` (`*` = alle), ListsView übernimmt sie (gewichtHerkunft).
- `VerzahnungView.vue` – Parcours, Klassen, Sperre (Festschreiben), Startnummern; Unterreiter Parallelslalom, useReiter.
- `ParallelView.vue` – Vorlauf-Plan: Schalter streng/nach Startnummer, Heat-Tabelle (Runden: ParallelRunden.vue).
- `ListsView.vue` – Reiter „Listen“: KINDS (starter, gewicht, vorsteg, wkr, laufzettel, codes, ergebnis, pokal,
  druckdatei), Auswahl, Doppelseitig-Schalter, Sperren (`blocked`, `nothingToPrint`), print() setzt
  document.title (= Dateiname) und ruft window.print().
- `ErfassungView.vue` – Bogen wählen oder scannen, Eingabetabelle; nach Laufzettel-Scan alle Blätter untereinander.
- `SettingsView.vue` (~740 Zeilen, gezielt lesen) – alle Einstellungen in Abschnitten mit id (logos (LogosPanel),
  wertung, streichlaeufe, ergebnislisten, pokal, wkr-listen, wkr-zeilen-je-seite, wkr-teilen-ab, wkr-leerzeilen,
  laufzettel-layout, dateien …) und `data-feld` je Steuerelement; Kürzel, Dateien, Verlauf.

## Abläufe

- Einstellung: SettingsView (data-feld) → dispatch SET_… → state/reducer/<bereich>.ts (Normalisierer: reducer/listen.ts,
  Streichläufe: wertung.ts) → AppState → Komponenten lesen state.value.<feld>; beim Laden migrate().
- Drucken: ListsView kind → passende Listen-Komponente → ListenDokument/BogenBlatt teilen Seiten → print().
- Erfassung: ErfassungView (Auswahl über lib/merken.ts; Bögen aus lib/wkrListen.ts bzw. lib/parallelBogen.ts)
  → erfassung/ErfassungTabelle.vue → SET_EINGABEN.
- Scan: App.vue bzw. Scan-Feld → lib/scan.ts meldeScan → ErfassungView watch → lib/qr.ts leseCode →
  scanBogen / scanRundenBogen → Auswahl und Fokus; erfassung/ScanHinweis.vue meldet Treffer oder Grund.
- Datei laden: SettingsView → persistenz/backup.ts parseFile → LOAD_STATE bzw. IMPORT_STARTERS.

## Wo ändere ich …

- Neue Einstellung: SettingsView im passenden Abschnitt, data-feld; Texte `listopt.*` in i18n de/+en/listenoptionen.ts;
  dahinter types/zustand.ts, state/reducer/<bereich>.ts, migrate.ts (src/state/CLAUDE.md). Hängt sie am Regelwerk:
  `v-if` auf `regelwerk.<feld> !== undefined`; nur für UIM/Parallelslalom in den Block `<template v-if="parallel">`
  (Muster parallelZebra). Tests: SettingsView.test.ts oder Listenoptionen.test.ts.
- Neue Listenart: ListsView KINDS + computed (ownView/ownStand, blocked, nothingToPrint) + Template-Zweig;
  lib/adressen.ts ReiterNamen['listen']; i18n lists.kind.<art> (listen.ts); ggf. lib/doppelseitig.ts DOPPELSEITIG_ARTEN;
  eigenes @page in styles/ (eingebunden in main.ts).
- Neuer Reiter: lib/adressen.ts VIEWS + ADRESSEN, App.vue `<main>`, i18n nav.<view> (de/+en/allgemein.ts).

## Fallen

- Neue Einstellungen gehören hierher, nicht in die Fachansichten (Entscheidung des Nutzers). Bedienauswahl (Listenart,
  Parcours, Klasse, Lauf, Fassung, aufgeklappt) nicht in den AppState, sondern lib/merken.ts merke(key, vorgabe,
  { ueberNeuladen, gueltig }); die Listenart steht auch in der Adresse.
- ListsView sperrt den Druck bei fehlenden/doppelten Startnummern – außer Gewichtsliste je Herkunft, Codes,
  Wertungslisten, Mannschaftswertung, Druckdatei. Dann erzeugt WkrListen auch per Strg+P keinen Bogen.
- WKR-Bögen des Manövrierens und ihre Laufzettel zusätzlich bis zum Festschreiben der Verzahnung (`vorVerzahnung`,
  Entscheidung 15.11.2026): Knopf gesperrt, Hinweis `vor-verzahnung` (wird mitgedruckt), Stapel `no-print` – am
  Bildschirm zu sehen, Strg+P druckt nur den Hinweis. Parallel-Listen nicht (hängen an festgeschriebenen Runden).
  Tests, die WKR-Bögen oder Laufzettel drucken, schreiben vorher die Verzahnung fest (SET_VERZAHNUNG_LOCK).
- Sobald Werte erfasst sind, sind Regelwerk und Starterfeld gesperrt (components/StarterSperre.vue).
  Tests: src/testHilfen.ts wechsleRegelwerk; UIM points des Manövrierens erst mit knotenHaken.
- ListsView: useReiter steht NACH gewichtWahl und gewichtAuswahl – `beiWahl` setzt die eine, `wahlFuerAdresse` liest
  die andere schon beim Aufbau (sonst TDZ-Fehler). Die gewählte Herkunft bleibt in der Adresse (`#/listen/gewicht/…`).
- Unter DM gibt es keinen Parallelslalom – auch nicht in Texten und Hinweisen (config/catalog.ts hasParallel).
- Dateinamen und Titel von Downloads folgen der Oberflächensprache (englisch: „backup“, Datum yyyy-mm-dd).
- Testdaten nur erfunden (Muster views/Laufzettel.test.ts: `Vor${klasse}${i}`, `Nach…`, 'Musterclub').

## Tests

Je Thema eine Datei `src/views/<Thema>.test.ts` (mount() mit eigenem Store, meist über ListsView), z. B. Verwiegung
(Link zu den Gewichtslisten), Ergebnislisten, ParallelErgebnis, Einzelwertung, Pokalauswertung, Laufzettel, Druckdatei,
Seitenzahlen, Doppelseitig, SettingsView, Listenoptionen, ErfassungView, ErfassungScan, Dolphin, UimAushang (englisch).
Gezielt: `npx vitest run src/views/Laufzettel`; alle Ansichten: `npx vitest run src/views` (dauert länger).
