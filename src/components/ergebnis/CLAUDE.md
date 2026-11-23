# src/components/ergebnis – Blätter der Wertungslisten

Reiter und Stapel dazu liegen eine Ebene höher (ErgebnisListen/…Stapel, ParallelErgebnisListen/…Stapel,
EinzelwertungListen/…Stapel; Karte src/components/CLAUDE.md), die Mannschaftswertung in pokal/.

## Dateien

- `ErgebnisLaufBlatt.vue`, `ErgebnisGesamtBlatt.vue` (DM, UIM und Runden-Ergebnis Parallel), `ErgebnisFuss.vue`,
  `ParallelAttemptsBlatt.vue`, `ParallelStageBlatt.vue`, `EinzelwertungBlatt.vue`.
- Ablauf: ErgebnisListen (klassenErgebnis, ergebnisBlaetter) → ErgebnisStapel (namen, origin, listenStand,
  stichAufListe) → ErgebnisLaufBlatt/GesamtBlatt (texteIn(sprache)) → ListenDokument → ErgebnisFuss.

## Wo ändere ich …

- Spaltenkopf einer Wertungsliste: `<th>` in ergebnis/*.vue, pokal/*.vue; Text i18n results.*, individual.col.*
  (de/+en/wertung.ts), parallel.* (parallel.ts); Fahrweg-Spalten über lib/ergebnisText.ts; Breiten styles/ergebnis.css
  (Tests: nichts abgeschnitten). Fahrweg-Zellen (ErgebnisLaufBlatt fitZelle): Bojenzellen mit Komma („5, J, D“, R7-14
  22.11.2026) ab vier Zeichen in schmalen bzw. fünf in breiteren Spalten `erg-zweizeilig` (bricht um, `td` schneidet sonst ab).
- Spaltenfolge: je Blatt dreimal gleich (`<colgroup>`, `<thead>`, `<tbody>`), `erg-gruppe` (kräftige Linie) wandert
  mit. DM und UIM teilen das Blatt (Props mitKnoten, punkte, runde, ohneErgebnis): Nur für UIM ändern braucht eine
  Bedingung.
- „Qualified“/Finals als eine schräge Zelle: ErgebnisGesamtBlatt.vue `punkte.bloecke` (rowspan, `schraeg`, `gebunden`).
- Fuß der Wertungslisten: ErgebnisFuss.vue; Höhe lib/seiten.ts ergebnisFussMm ↔ .erg-fuss.

## Fallen

- Results einer Runde: Unter einer zusammengefassten Zelle fehlt der Zeile die td „UIM points“ – in Tests die Spalte
  über `td[data-spalte="uim-punkte"]` (mit rowspan) lesen, nicht über die letzte Zelle jeder Zeile.
- Feste mm (ERGEBNIS_FUSS_MM, …_UNTERSCHRIFT_MM ↔ CSS) und lt()/texteIn statt t(): siehe src/components/CLAUDE.md.

## Tests

`npx vitest run src/components/ergebnis`; im Zusammenhang src/views/Ergebnislisten, ParallelErgebnis, Einzelwertung,
Pokalauswertung; UIM-Kopfzeilen: views/UimAushang.test.ts.
