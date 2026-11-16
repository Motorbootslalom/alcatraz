# src/state – Zustand, Reducer, Speicher

## Dateien

- `store.ts` – dispatch: setzt `action.zeit` (und Kennung, auch die neue bei RESET_ALL), ruft reducer(), speichert nur
  bei `next !== vorher` (localStorage über persistenz/storage.ts, Verlauf über zweit.ts); Abgleich zwischen Fenstern.
- `reducer.ts` – reducer() mit Nachbearbeitung; wendeAn(): Sperren (VERZAHNUNG_/PLAN_/STARTERFELD_ACTIONS), je Action
  ein case → Bereich; reicht alle Exporte weiter. `reducer/<bereich>.ts`: Teil-Union `…Aenderung` + `wende…An()` –
  veranstaltung (emptyState), regelwerk (+ Aufbau, Tor 5), starter (+ Gewichte, klasseFest), startnummern (inFolge,
  assignStartNumbers), verzahnung, parallel, erfassung (+ Beispieldaten), wertung (+ Pokal, streichlaeufeWert), listen
  (+ Normalisierer), gemeinsam (konfigVon). Neue Action: Teil-Union + case dort, case-Zeile in wendeAn() (sonst TS1360).
- `migrate.ts` – gelesenen Stand normalisieren (Objekt `stand`), normalizeStarter(); SCHEMA_VERSION aus types.ts.
- `tor5.ts` – mitTor5Umzug: Eingaben, WKR-Namen und Sprachen der Bögen ziehen mit, wenn die Liste für Tor 5 wechselt.
- `zweit.ts` – zweiter Speicher und Verlauf: Schreibpumpe, Start-Entscheidung, merken/wiederherstellen.
- `leseStore.ts` – Nur-Lese-Store der Anzeigetafel (zweites Fenster): liest localStorage, folgt `storage`, schreibt nie.
  Angelegt in main.ts statt createStore(), wenn die Adresse `#/anzeige` ist; `lies()` auch auf postMessage des openers.
- `reducer/betrieb.ts` – BETRIEB_* (beginnen, zeigen mit `vorher`, zurück, Meldung, zurücksetzen; E2: zurückstellen,
  einreihen, aussetzen, vorziehen, klasse vor, verschieben, ab), SET_ANZEIGE; normalisiereBetrieb/-Anzeige für migrate.
  Logik der Folge: betrieb/ (eigene Karte), Schritte in betrieb/schritte.ts; der Reducer schreibt nur `betrieb`.
  SET_ANZEIGE trägt auch die Startfolge im Betrieb (`verzahnungHalten`, ab E3 amSteg/vorSteg/abstaende; SettingsView
  `#betrieb`); geschickt werden die Schritte von components/betrieb/ (Start-Freigabe) über `sende`.
- Nachbarn: persistenz/storage.ts (Schlüssel, serialisiere() mit Speichermarke vorn), persistenz/backup.ts
  (Sicherung/Vorlage/Starterdatei), persistenz/zweitspeicher.ts (IndexedDB „alcatraz“), lib/verlauf.ts (ARTEN).

## Abläufe

- Eingabe: SET_EINGABEN → store (zeit) → reducer/erfassung.ts (lib/eingaben.ts gueltigeZellen, setzeWerte) → reducer():
  mitVorlaufPlan (nur beim Löschen), mitAbmeldungenInRunden, mitTor5Umzug, ergaenzeAbmeldungen, listenStand → sichere().
- Start: main.ts createStore() → storage.liesGespeichert() → migrate() → createZweit() (ist IndexedDB neuer:
  übernehmen + Banner) → lib/offline.ts starteOffline (von selbst nur bei leerem Stand = keine Starter).
- Datei laden: SettingsView → backup.ts parseFile → migrate → LOAD_STATE {art:'sicherung'}; Vorlage: apply(state)
  behält Starter, Eingaben, Kennung, Einteilung, Co-Piloten, Pläne, nichtWerten → LOAD_STATE {art:'vorlage'}.
- Starter (reducer/starter.ts): IMPORT_STARTERS {mode:'replace'|'merge', nummerVomImport} → import/starterMerge.ts
  (IDs bleiben; vom Import vergebene Nummern zählen beim Wiedererkennen nicht, tsv.ts `bisherige` behält alte);
  ABMELDEN_STARTER (nur wenn starterfeldFest) → X in leere Läufe/Runden (lib/abmeldung.ts).

## Wo ändere ich …

- Neues AppState-Feld: types/zustand.ts (mit Doku) → emptyState() (reducer/veranstaltung.ts) → Action in die Teil-Union
  des Bereichs + case dort (unverändert ⇒ `state`) + case-Zeile in reducer.ts → migrate.ts eigene Zeile in `stand`
  (Typprüfung, Rückfall) → backup.ts (Template-Omit, makeFile-Destrukturierung, apply() mit current.x – nur bei
  Veranstaltungs-/Personendaten; reine Einstellungen reisen über `...settings` von selbst mit) → lib/verlauf.ts ARTEN
  (optional, Rückfall 'einstellung') → views/SettingsView.vue → i18n de/+en/listenoptionen.ts. Muster:
  versucheNacheinander; nur UIM wie parallelZebra (`v-if="parallel"`; Test reducer/Vorlage/migrate: teamListe.test.ts).
- Vorgabe aus dem Regelwerk: steht dreimal – emptyState, case SET_REGELWERK (reducer/regelwerk.ts), migrate. Oder
  beim Lesen auflösen, der Stand hält nur eigene Werte (Muster config/catalog.ts sollgewichtOf, startabstandOf).
- Wirkt das Feld auf Wertungslisten: lib/listenStand.ts WERTUNG ergänzen (sonst kein neuer Zeitpunkt).
- reducer.ts: neue Sperre → passende Menge (SET_REGELWERK: Anfang wendeAn()); Eingabeweg mit Zeitpunkt → `eingegeben`.
- Neues Starterfeld: types/starter.ts → normalizeStarter() (zählt Felder einzeln!) → import/tsv.ts → starterMerge.ts
  FIELDS (sonst nie „geändert“) + Merge-Regel bei freiwilliger Spalte, deren Wert bleiben soll (Muster geschlecht).
- Neue Verlaufsart: lib/verlauf.ts VerlaufArt/ARTEN + i18n history.what.<art> (de/+en/verlauf.ts).

## Fallen

- migrate(): `...uebernommen` übernimmt alle Rohfelder UNGEPRÜFT – neues Feld daher explizit in `stand`. Absichtlich
  entfernt: listenSprache, pokalStand, gespeichert, parallelInternational. Höhere SCHEMA_VERSION → null; Stufen nur
  bei Bedarf als `if (version < n)`, bisher läuft alles über Vorgaben je Feld.
- Speichermarke ({"gespeichert":{folge,zeit}}) steht vorn im Text; markeAus() liest per Regex – Reihenfolge in
  serialisiere() nicht ändern. Sie gehört nicht zum Stand.
- backup.ts: Personen- und Veranstaltungsdaten an DREI Stellen (Template, makeFile, apply). Eine Vorlage enthält
  nie Personennamen; dolphinPraefix und Boote je Klasse reisen mit.
- Tor 5 zieht zentral in reducer() um, nicht je Action; LOAD_STATE/RESET_ALL nicht, Vorlage in apply() selbst.
- wkrSprachen wie einteilung (Parcours → Liste → Sprache): SET_PARCOURS_PRESET/REMOVE_PARCOURS hängen beide um; migrate
  verteilt Altes je Liste auf alle Parcours (normalisiereSprachen); als Einstellung in der Vorlage (mit deren Parcours).
- Beispieldaten-Actions (FILL_BEISPIELWERTE, FILL_BEISPIEL_BESETZUNG, FILL_BEISPIELGEWICHTE) bringen nur die `saat`; was
  gefüllt wird, rechnet der Reducer aus dem Stand (konfigVon). Die Rückfrage vor dem Ersetzen stellt BeispieldatenPanel.
- CLEAR_EINGABEN löscht auch abgemeldet, abgemeldetBis, nichtWerten und alle Runden nach dem Vorlauf; ein einzeln
  geleertes Feld löst den Vorlaufplan nicht (15.11.2026). CLEAR_EINGABEN_TEIL, das alles leert, ruft den case direkt.
- Werte erfasst (lib/eingaben.ts starterfeldFest) ⇒ Starterfeld, Regelwerk gesperrt; Tests: testHilfen.wechsleRegelwerk.
- MOVE_STARTER_TO_CLASS (Jahrgang gehört in andere Klasse): abgelehnt bei klasseFest UND in STARTERFELD_ACTIONS;
  klassenbasierte Nummer = nächste freie der neuen Klasse, klassische bleibt. UPDATE_STARTER mit `klasse` nur Tests.
- ORDER_STARTERS/SHUFFLE_STARTERS (Starter-Reiter, lib/reihenfolge.ts) und MOVE_STARTER (▲▼, 16.11.2026) in
  VERZAHNUNG_ACTIONS: danach keine neue Folge; Nummern von Hand gehen weiter; unverändert ⇒ derselbe Stand. Alle drei über inFolge(): Nummern neu
  verteilt UND Starter im Array umgestellt – ohne Nummer zählt die Array-Folge (sortedByStartNr, Verzahnung, Export).
- betrieb/anzeige (16.11.2026): betrieb in der Sicherung, nicht in der Vorlage (apply hängt ihn per haengeUm auf
  deren Parcours um, `parallel` bleibt); anzeige reist mit, kopfzeile bleibt beim Ziel. BETRIEB_* ohne Verlaufseintrag
  (verlauf.ts `null`); VerlaufPanel stellt mit dem jetzigen betrieb wieder her – nur bei gleicher `kennung` (sonst der des
  Eintrags); CLEAR_EINGABEN lässt ihn stehen.
- logos/logoHoeheMm (16.11.2026): Prüfung nur über lib/logo.ts logoWert/logoHoeheZahl (Reducer UND migrate);
  unbrauchbares SET_LOGO ändert nichts; backup.ts apply: je Seite gilt das Logo der Vorlage, fehlt es, bleibt das
  hiesige; nicht in WERTUNG.

## Tests

`npx vitest run src/state src/persistenz` (reducer, migrate, eingaben, eigeneAufbauten, zweit; backup, zweitspeicher –
fake-indexeddb); oft auch lib/verlauf, lib/listenStand, views/SettingsView. Neue Felder: migrate/backup/reducer.test.ts.
