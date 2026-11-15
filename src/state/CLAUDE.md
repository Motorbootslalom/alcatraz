# src/state – Zustand, Reducer, Speicher

## Dateien

- `store.ts` – dispatch: setzt `action.zeit` (und Kennung), ruft reducer(), speichert nur bei `next !== vorher`
  (localStorage über persistenz/storage.ts, Verlauf über zweit.ts); Abgleich zwischen Fenstern.
- `reducer.ts` (~1000 Zeilen, gezielt lesen) – Action-Union `Aenderung`, emptyState(), wendeAn() mit einem case
  je Action, Sperren (VERZAHNUNG_ACTIONS, PLAN_ACTIONS, STARTERFELD_ACTIONS, klasseFest()), Nachbearbeitung in
  reducer(), Normalisierer (zeilenJeSeiteZahl, teilenAbZahl, leerzeilenZahl, laufzettelLayoutWert, streichlaeufeWert).
- `migrate.ts` – gelesenen Stand normalisieren (Objekt `stand`), normalizeStarter(); SCHEMA_VERSION aus types.ts.
- `tor5.ts` – mitTor5Umzug: Eingaben, WKR-Namen und Sprachen der Bögen ziehen mit, wenn die Liste für Tor 5 wechselt.
- `zweit.ts` – zweiter Speicher und Verlauf: Schreibpumpe, Start-Entscheidung, merken/wiederherstellen.
- Nachbarn: persistenz/storage.ts (Schlüssel, serialisiere() mit Speichermarke vorn), persistenz/backup.ts
  (Sicherung/Vorlage/Starterdatei), persistenz/zweitspeicher.ts (IndexedDB „alcatraz“), lib/verlauf.ts (ARTEN).

## Abläufe

- Eingabe: dispatch SET_EINGABEN → store (zeit) → wendeAn (lib/eingaben.ts gueltigeZellen, setzeWerte) →
  reducer(): mitVorlaufPlan (nur beim Löschen), mitAbmeldungenInRunden, mitTor5Umzug, ergaenzeAbmeldungen,
  lib/listenStand.ts geaenderteListen + listenStandNach → sichere() → localStorage + zweit.notiere.
- Start: main.ts createStore() → storage.liesGespeichert() → migrate() → createZweit() (ist IndexedDB neuer:
  übernehmen + Banner) → lib/offline.ts starteOffline (von selbst nur bei leerem Stand = keine Starter).
- Datei laden: SettingsView → backup.ts parseFile → migrate → LOAD_STATE {art:'sicherung'}; Vorlage: apply(state)
  behält Starter, Eingaben, Kennung, Einteilung, Co-Piloten, Pläne, nichtWerten → LOAD_STATE {art:'vorlage'}.
- Starter importieren: IMPORT_STARTERS {mode:'replace'|'merge'} → import/starterMerge.ts (IDs bleiben).
- Abmelden: ABMELDEN_STARTER (nur wenn starterfeldFest) → X in leere Läufe/Runden (lib/abmeldung.ts).

## Wo ändere ich …

- Neues AppState-Feld: types.ts (mit Doku) → emptyState() → Action im Typ + case (unverändert ⇒ `state`)
  → migrate.ts eigene Zeile in `stand` mit Typprüfung und Rückfall → backup.ts (Template-Omit, makeFile-
  Destrukturierung, apply() mit current.x – falls es zur Veranstaltung oder zu Personen gehört)
  → lib/verlauf.ts ARTEN (optional, Rückfall 'einstellung') → views/SettingsView.vue → de.ts/en.ts.
  Muster: versucheNacheinander; reine UIM-Einstellung wie parallelZebra (SettingsView `v-if="parallel"`, Test für
  reducer, Vorlage und migrate in src/lib/teamListe.test.ts). Eine reine Einstellung reist über `...settings` von
  selbst in Sicherung und Vorlage.
- Vorgabe aus dem Regelwerk: steht dreimal – emptyState, case SET_REGELWERK, migrate.
- Wirkt das Feld auf Wertungslisten: lib/listenStand.ts WERTUNG ergänzen (sonst kein neuer Zeitpunkt).
- Neuer Eingabeweg mit Zeitpunkt: in die `eingegeben`-Bedingung in reducer() aufnehmen.
- Neue Sperre: die passende Menge in reducer.ts; SET_REGELWERK ist Sonderfall am Anfang von wendeAn().
- Neues Starterfeld: types.ts Starter → normalizeStarter() (zählt Felder einzeln auf!) → import/tsv.ts →
  import/starterMerge.ts FIELDS (sonst gilt es beim Abgleich nie als geändert) + eigene Merge-Regel, wenn die Spalte
  freiwillig ist und der bisherige Wert bleiben soll (Muster geschlecht).
- Neue Verlaufsart: lib/verlauf.ts VerlaufArt/ARTEN + i18n history.what.<art>.

## Fallen

- Reducer rein: kein Date.now(), Math.random(), uid() (auch nicht in gerufenen lib-Funktionen). Zeit = action.zeit,
  neue Kennung bei RESET_ALL setzt der Store, Zufall kommt als `saat`, IDs bringt die Action mit.
- migrate(): `...uebernommen` übernimmt alle Rohfelder UNGEPRÜFT. Neues Feld daher explizit in `stand`.
  Absichtlich entfernt: listenSprache, pokalStand, gespeichert, parallelInternational. Höhere SCHEMA_VERSION → null.
  Stufen nur bei Bedarf als `if (version < n)`; bisher läuft alles über Vorgaben je Feld.
- Speichermarke ({"gespeichert":{folge,zeit}}) steht vorn im Text; markeAus() liest per Regex – Reihenfolge in
  serialisiere() nicht ändern. Sie gehört nicht zum Stand.
- backup.ts: Personen- und Veranstaltungsdaten an DREI Stellen (Template, makeFile, apply). Eine Vorlage enthält
  nie Personennamen; dolphinPraefix und Boote je Klasse reisen mit.
- Tor 5 zieht zentral in reducer() um, nicht je Action; LOAD_STATE/RESET_ALL nicht, Vorlage in apply() selbst.
- wkrSprachen ist gebaut wie einteilung (Parcours → Liste → Sprache): SET_PARCOURS_PRESET/REMOVE_PARCOURS hängen beide
  um; migrate verteilt die alte Form je Liste auf alle Parcours (lib/einteilung.ts normalisiereSprachen). Anders als die
  Namen eine Einstellung: reist in der Vorlage mit (dort mit deren Parcours).
- Beispieldaten-Actions (FILL_BEISPIELWERTE, FILL_BEISPIEL_BESETZUNG, FILL_BEISPIELGEWICHTE) bringen nur die `saat`; was
  gefüllt wird, rechnet der Reducer aus dem Stand (konfigVon). Die Rückfrage vor dem Ersetzen stellt BeispieldatenPanel.
- CLEAR_EINGABEN löscht auch abgemeldet, abgemeldetBis, nichtWerten und alle Runden nach dem Vorlauf. Ein einzeln
  geleertes Feld löst den Vorlaufplan nicht (Entscheidung 15.11.2026).
- Sobald Werte erfasst sind (lib/eingaben.ts starterfeldFest): Starterfeld und Regelwerk gesperrt. Tests wechseln
  das Regelwerk über src/testHilfen.ts wechsleRegelwerk.

## Tests

`npx vitest run src/state src/persistenz` (reducer, migrate, eingaben, eigeneAufbauten, zweit; backup,
zweitspeicher – IndexedDB über fake-indexeddb). Dazu oft: src/lib/verlauf, src/lib/listenStand,
src/views/SettingsView (Dateien laden). Neue Felder: migrate.test.ts, backup.test.ts, reducer.test.ts ergänzen.
