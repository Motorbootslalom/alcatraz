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
  E4 Parallelslalom (Bereich `parallel`): ZURUECKSTELLEN/EINREIHEN/gezieltes ZEIGEN nehmen das Paar (paarStarts; ZEIGEN
  holt den im Plan direkt folgenden Attempt mit, planPartner),
  AUSSETZEN/VORZIEHEN/KLASSE_VOR/VERSCHIEBEN ändern dort nichts (umstellenErlaubt); Pläne ändert der Betrieb nie.
  Parcours-Ampel (21.11.2026): BETRIEB_DURCHFAHRT {bereich, ref, an} – nur der gezeigte Start, setzt/löscht
  `durchfahrt` {ref, zeit vom Store}, unverändert = derselbe Stand; ZEIGEN/ZURUECK nehmen sie weg; normalisiereBereich
  behält sie nur für den gezeigten Start. SET_ANZEIGE `wkrAuto` (Auto-Modus, Vorgabe BETRIEB_ANNAHMEN.autoVorgabe).
  SET_ANZEIGE trägt auch die Startfolge im Betrieb (`verzahnungHalten`, ab E3 amSteg/vorSteg/abstaende; SettingsView
  `#betrieb`) und die Lage von Racecourse A und B (`parallelAnordnung`, PARALLEL_ANORDNUNGEN, Vorgabe `a-links`);
  geschickt werden die Schritte von components/betrieb/ (Start-Freigabe) über `sende`. E6: SET_GERAETE_SERVER
  (`geraeteServer`, '' = Vorgabe geraete/themen.ts NTFY_VORGABE; geprüft mit lib/serverAdresse.ts – nichts aus
  geraete/ im Reducer; reist als Einstellung mit Sicherung und Vorlage, migrate: Unbrauchbares → '').
- Wiederholung nach Ausfall (26.11.2026, R11-11): `reducer/erfassung.ts` WIEDERHOLUNG_AUSFALL {bereich, ref} – leert
  `eingaben[lauf][starter]` (außer der Vorsteg-Zeile mit „Versuche nacheinander“, WH6), wkrOhneVersuch (reducer/wkr.ts:
  Rückfragen, Vorschläge, „keine Zeit“, P der Pausen, papier/abweichend der Abschlüsse) und mitWiederholung
  (reducer/betrieb.ts) in EINER Action; Eingabeweg (`eingegeben`), Verlauf `wiederholungAusfall` (EINZELN, mit
  Startnummer). Die verworfenen Werte merkt WkrStand.`verworfen` (je Bereich + Start, samt „keine Zeit“; optional,
  normalisiereWkr, wkrOhneLaeufe/wkrNurStarter räumen, reducer() mitGeltendenVerworfenen räumt bei geändertem Betrieb
  alles ohne stehenden Abbruch). WIEDERHOLUNG_AUFHEBEN (27.11.2026, „Doch keine Wiederholung“, statt
  BETRIEB_WIEDERHOLUNG_AUFHEBEN) holt sie zurück – nur in leere Zellen – und ruft reducer/betrieb.ts ohneWiederholung
  (nur der zuletzt abgebrochene Versuch); Eingabeweg, Verlauf `wiederholungAufgehoben`. Nur so schreibt etwas aus dem
  Betrieb in `eingaben` (Projektkarte, Feste Regeln); vom Freigabe-Handy seit 27.11.2026 (R13-01/R13-06) über die eng
  geprüfte Ausnahme geraete/aufgaben.ts erlaubteWiederholung – der Reducer bleibt, wie er ist (Zeit vom Store).
  reducer/betrieb.ts: EINREIHEN nimmt auch `wiederholung`, ZEIGEN räumt sie, ZURUECKSTELLEN/ZURUECK/DURCHFAHRT lassen den abgebrochenen
  Versuch; normalisiereBereich liest `abgebrochen` (nur `true`) und `wiederholung` (nur wartende). reducer/wkr.ts:
  WKR_ZEILEN prüft WkrZeile.versuch noch einmal (zwei Fenster), WKR_PAPIER_AB nimmt den jüngsten geltenden Versuch.
  Parallelslalom (27.11.2026, R13-02): WIEDERHOLUNG_AUSFALL {bereich, ref: Paar, nur?: 'a'|'b'} – Boote aus
  betrieb/folge.ts gefahreneSeiten, je Boot Zelle `attemptSchluessel` leeren, wkrOhneVersuch (Listen des anderen
  Racecourse behalten P/Abschluss) und ein WkrVerworfen (je Bereich + Start + Starter; eindeutigeVerworfene);
  mitWiederholung(…, nur) setzt GezeigterStart.nur. AUFHEBEN holt alle Einträge des Starts zurück. reducer/wkr.ts zählt
  Abbrüche je Seite der Liste (wkr/versuch.ts listenSeite). Prüfbefund 27.11.2026: beide Actions mit optionalem
  `abbrueche` (gesehene Zahl der Abbrüche; stimmt sie nicht, derselbe Stand – gesehenerVersuch; Start-Freigaben schicken
  sie immer, das Handy muss); AUFHEBEN ändert nichts, wenn im Start niemand mehr fährt (betrieb/folge.ts faehrtNoch, X),
  und holt im Paar keine Werte eines Boots zurück, das inzwischen X hat.
  lib/verlauf.ts beschreibe(action, nachher, vorher) – Boote eines Paares aus `wkr.verworfen` (Aufheben: vorher).
- `reducer/wkr.ts` (W1, 21.11.2026) – WKR_ZEILEN (Übernahme über wkr/uebernahme.ts, Rückfrage-ID zeile|lauf|starter|feld,
  Papier/abgeschlossen → Vorschlag, nicht gezeigt → Rückfrage `start`, Haken nur ohne Konflikt, beide Teilhaken →
  ganzer), WKR_RUECKFRAGE (Grund `start` mit `vereinige`: gegen das dann Stehende vereinigt), WKR_VORSCHLAG, WKR_LISTE
  (Pause mit P = Schlange; `teil`: nur dieser Steg-Teil), WKR_ABSCHLUSS(_LOESEN) je Teil (`punkt|teil`, nur begonnene
  Punkte; wkr/abschluss.ts); W2: WKR_PAPIER_AB (abgemeldet, Pause ab Zeit des Starts mit `ab`, P = Schlange ab dort),
  Zeile zu P-Start → Vorschlag (A6); wkrLeer,
  normalisiereWkr (migrate), wkrOhneLaeufe (CLEAR_EINGABEN/_TEIL), wkrNurStarter (mitStartern). Logik: src/wkr/.
  W5.3 (22.11.2026, KN5): WKR_ABSCHLUSS/_LOESEN mit WkrPunkt (`ohne` = ganze Liste am Tisch; offen = Bestand ohne
  Haken, nur digital und aktiv), normalisiereWkr behält `ohne` nur an der Liste am Tisch, CLEAR_EINGABEN_TEIL mit Lauf 1
  nimmt auch `ohne` mit (wie die Eingaben `<disziplin>/0`).
  W4.3 (21.11.2026) WkrStand.nichtVorbei („nicht vorbeigekommen“) entfiel am 24.11.2026 (WKR_ANNAHMEN NG6): „Nicht
  gestartet · Disq. X“ ist eine gewöhnliche Zeile mit X; normalisiereWkr lässt ein altes `nichtVorbei` (auch `teil` an
  Rückfrage/Vorschlag) beim Laden weg.
  W5.4 (22.11.2026, ZT4): WkrStand.keineZeit („keine Zeit“ je Zeitfeld, wkr/keineZeit.ts) – kzWirkung nur, wo die
  Zeile gilt (direkt, WKR_RUECKFRAGE `geraet`, WKR_VORSCHLAG `uebernehmen`; Rückfrage/Vorschlag tragen
  `keineZeit`); reducer() hebt Felder mit Wert auf (ohneUeberholteKeineZeit); wkrOhneLaeufe/wkrNurStarter räumen;
  normalisiereWkr liest es (normalisiereKeineZeit, an Rückfragen liesKeineZeitFelder).
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
- Beispieldaten-Actions (FILL_BEISPIELWERTE, FILL_BEISPIEL_BESETZUNG, FILL_BEISPIELGEWICHTE, FILL_BEISPIEL_BOOTE,
  FILL_BEISPIEL_CO_PILOTEN) bringen nur die `saat`; was gefüllt wird, rechnet der Reducer aus dem Stand (konfigVon,
  lib/besetzung.ts besetzungsKlassen/coPilotKlassen). Die Rückfrage vor dem Ersetzen stellt die Oberfläche
  (BeispieldatenPanel, lib/beispielBoote.ts).
- CLEAR_EINGABEN löscht auch abgemeldet, abgemeldetBis, nichtWerten und alle Runden nach dem Vorlauf; ein einzeln
  geleertes Feld löst den Vorlaufplan nicht (15.11.2026). CLEAR_EINGABEN_TEIL, das alles leert, ruft den case direkt.
- Werte erfasst (lib/eingaben.ts starterfeldFest) ⇒ Starterfeld, Regelwerk gesperrt; Tests: testHilfen.wechsleRegelwerk.
- MOVE_STARTER_TO_CLASS (Jahrgang gehört in andere Klasse): abgelehnt bei klasseFest UND in STARTERFELD_ACTIONS;
  klassenbasierte Nummer = nächste freie der neuen Klasse, klassische bleibt. UPDATE_STARTER mit `klasse` nur Tests.
- ORDER_STARTERS/SHUFFLE_STARTERS (Starter-Reiter, lib/reihenfolge.ts) und MOVE_STARTER (▲▼, 16.11.2026) in
  VERZAHNUNG_ACTIONS: danach keine neue Folge; Nummern von Hand gehen weiter; unverändert ⇒ derselbe Stand. Alle drei über inFolge(): Nummern neu
  verteilt UND Starter im Array umgestellt – ohne Nummer zählt die Array-Folge (sortedByStartNr, Verzahnung, Export).
  Mit Startnummern-Bereichen bleiben nur Sortieren/Zufall in den Bereichen; ▲▼ wirkt frei (20.11.2026, `inBereichen`).
- parallelGedruckt (20.11.2026): Runde → Zeit des ersten Drucks, bindet die Runde wie erfasste Werte (rundeGebunden);
  reducer() wirft Vermerke ohne Plan weg (ohneVerwaistenDruck); Sicherung ja, Vorlage nein (wie parallelPlaene).
- betrieb/anzeige (16.11.2026): betrieb in der Sicherung, nicht in der Vorlage (apply hängt ihn per haengeUm auf
  deren Parcours um, `parallel` bleibt); anzeige reist mit, kopfzeile bleibt beim Ziel. BETRIEB_* ohne Verlaufseintrag
  (verlauf.ts `null`); VerlaufPanel stellt mit dem jetzigen betrieb wieder her – nur bei gleicher `kennung` (sonst der des
  Eintrags); CLEAR_EINGABEN lässt ihn stehen.
- wkr (W1, 21.11.2026): in der Sicherung, nicht in der Vorlage (apply behält current.wkr); nie ein Gerätename im Stand.
  WKR_ZEILEN/RUECKFRAGE/VORSCHLAG sind Eingabewege (`eingegeben` in reducer.ts). CLEAR_EINGABEN leert Rückfragen,
  Vorschläge, Abschlüsse – Modus/Status der Listen bleiben.
- logos/logoHoeheMm (16.11.2026): Prüfung nur über lib/logo.ts logoWert/logoHoeheZahl (Reducer UND migrate);
  unbrauchbares SET_LOGO ändert nichts; backup.ts apply: je Seite gilt das Logo der Vorlage, fehlt es, bleibt das
  hiesige; nicht in WERTUNG.

## Tests

`npx vitest run src/state src/persistenz` (reducer, migrate, eingaben, eigeneAufbauten, zweit; backup, zweitspeicher –
fake-indexeddb); oft auch lib/verlauf, lib/listenStand, views/SettingsView. Neue Felder: migrate/backup/reducer.test.ts.
