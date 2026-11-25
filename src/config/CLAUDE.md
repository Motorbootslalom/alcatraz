# src/config – Regelwerke, Aufbauten, Texte als YAML

Alle Regelwerks- und Aufbaudaten stehen als YAML im Repo, werden per `import.meta.glob(…, ?raw)` gebündelt, beim
Modulstart zusammengeführt und über die reine, memoisierte `configFor()` aufgelöst. Zur Laufzeit lädt nichts nach.

## Dateien

- YAML: `regelwerke.yaml` (IDs, erste = Vorgabe), `regelwerke/dm-2026.yaml` (Kopf beschreibt alle Felder; Länder nach
  IOC wie die UIM), `regelwerke/uim-2026.yaml` (en-Texte, IOC-Kürzel, wertungJeDisziplin.parallel, Aushang, Laufzettel,
  UIM points), `aufbauten.yaml` (Reihenfolge `dateien`, Parameterbeschreibung), `aufbauten/gemeinsam.yaml` (Disziplin
  manoevrieren, Positionen zeit/steg/vorsteg/knoten/tor5/mueb/parcours), `aufbauten/parallel.yaml`,
  `aufbauten/{alcatraz,frontal,berlin,bawue,moewe}.yaml` (Tor-Positionen in Kurzform), `einstellungen.yaml`
  (Bojen-Kürzel, Beschriftungen, Laufzettel-Vorgabe, pokalPunkte, startabstaende), `i18n/en.yaml` (Englisch nach
  deutschem Wortlaut).
- `konfig.ts` – lädt YAML, ROH_REGELWERKE/ROH_QUELLE (eingefroren), baue(), `configFor(wahl)` mit Zugriffen
  (getSheetDef, getAufbau, getDisziplin, getLegende, getLaufzettelConfig …).
- `build.ts` – buildConfig: Roh → SheetDefs, Spalten, Legende, Laufzettel; regelwerkInfo(), RegelwerkInfo.
- `schema.ts` – Roh-Typen aller YAML; STICH_KRITERIEN, POKAL_VARIANTEN, POKAL_PLATZ_VARIANTEN, STARTABSTAND_MIN/MAX.
- `validate.ts` – Fachprüfung (validateRawConfig, validateConfigTexts), Fehlercodes BAD_*/DUP_*/MISSING_EN.
- `catalog.ts` – schmale Sicht für Zustand/Planung: REGELWERKE, AUFBAUTEN, regelwerkOf, aufbauOf, hasParallel,
  sollgewichtOf, startabstandOf/startabstandVorgabe/STARTABSTAENDE (Betrieb, E3).
- `kurzform.ts` – FAHRWEG, Kurzform → Position, Ergebnisspalten und Überwachung aus dem Fahrweg, aufloesen().
- `merge-positionen.ts` (Dateireihenfolge, Listen anhängen), `eigene.ts` (eigene Aufbauten prüfen/einbauen,
  YAML-Austausch), `feld.ts` (Feld-Kennungen), `kombi.ts` (`ersetzt`), `zeitnahme.ts` (Zeitspalten je Gerät),
  `sprache.ts` (uebersetzt, bogenTexte(): feste de/en-Texte der Bögen), `pokal.ts` (pokalRegeln, pokalWert).

## Abläufe

- YAML → Konfig: konfig.ts glob → quellDateien + mergePositionen → configFor(wahl) [Memo-Schlüssel = JSON von
  regelwerk, sprache, beschriftung, eigene; max. 12] → eigene.ts brauchbareEigene → kurzform.ts aufloesen →
  baue() (Regelwerk + Positionen, laufzettel-Override) → build.ts buildConfig → Konfig.
- Stand → Bogen: lib/konfig.ts useBogenKonfig (Sprache je Parcours/Liste) → configFor → lib/wkrListen.ts → lib/bogen.ts.
- Regelwerk wählen (state/reducer/regelwerk.ts) → regelwerkOf → Läufe/Streichläufe, versucheNacheinander, Vorlaufplan.

## Wo ändere ich …

- Disq-Buchstabe: regelwerke/<id>.yaml `disqualifikationen: { code, text, en, bereiche }` (`en` nur bei `sprachen`);
  Großbuchstabe, nie O; Bereiche vorsteg|steg|parcours|mueb (Position: `disq:`); regelwerke.test.ts ergänzen (s. Tests).
- Fehlercode: `kataloge.<katalog>.fehler { code, text, en, punkte }` (über alle Kataloge eindeutig) oder `direktpunkte`.
  Gilt ein Code nur in manchen Klassen: `abKlasse` (in der Folge von `klassen`) oder `klassen` (W3-07, 21.11.2026;
  validate BAD_FEHLER_KLASSE, catalog.ts codeKlassenOf) – wirkt nur auf das WKR-Gerät (ausgegraut, drückbar).
  Höchstzahl je Lauf `max` und Buchstabe für den Tipp danach `danach` (24.11.2026; validate BAD_FEHLER_MAX/_DANACH,
  UNKNOWN_FEHLER_DANACH, BAD_FEHLER_DANACH_BEREICH = Buchstabe gilt auf einer Liste des Katalogs nicht) → build.ts
  ErrorDef → Sicht der Liste; ohne `max` gilt WKR_ANNAHMEN.codeMaxAllgemein (lib/codes.ts codeHoechstens).
- Neue Regelwerk-Angabe: YAML (Beleg als Kommentar) → schema.ts RawRegelwerk → validate.ts ConfigInput (eigene
  Kopie!) + Prüfung → build.ts RegelwerkInfo/regelwerkInfo() → catalog.ts Regelwerk/readRegelwerk(). Nur für
  Zustand/Planung (wie disziplinen, gewichte, coPilot): konfig.ts RohRegelwerk, in baue() herausnehmen.
- Neues Regelwerk: YAML kopieren (id = Dateiname), in regelwerke.yaml eintragen; braucht Kataloge tor5, mueb,
  stegAblegen, stegAnlegen; bei `sprachen: [de, en]` alle en-Felder.
- Neuer Aufbau/Kursvariante: aufbauten/<name>.yaml + aufbauten.yaml `dateien` (fehlt sie: Fehler beim Start; doppelte
  IDs: DUP_*); Titel in i18n/en.yaml; Bilder per `npm run parcours:sync`; Snapshot bewusst erneuern.
- WKR-Spaltenkopf: `positionen[].spalten[].label` bzw. kurzform.ts FAHRWEG; Englisch in i18n/en.yaml `texte`.
  Kopf der Unter-Spalten ≠ Kennung: `subKopf` (Start/Ziel nur „L“/„R“, `sub` bleibt „hin seiteB“); gewöhnliche
  Linie statt des gepunkteten Positions-Standards: `subTrenner: linie` (CSS bogen.css/erfassung.css `…-linie`).
- Laufzettel: einstellungen.yaml `laufzettel` bzw. Regelwerk `laufzettel` (ersetzt je Schlüssel titel/schritte/
  schritteLetzterLauf); Übersetzung lib/laufzettelText.ts SCHRITTE + runsheet.step.* in i18n de/+en/listen.ts.
- Mannschaftswertung: einstellungen.yaml pokalPunkte; Regelwerk `pokal`; neue Variante: schema, pokal.ts, validate.
- Startabstände (Prognose im Betrieb): einstellungen.yaml `startabstaende` (allgemein, Beleg dort), Regelwerk
  `startabstaende` ersetzt je Klasse; schema.ts STARTABSTAND_MIN/MAX (auch für AppState.anzeige.abstaende) →
  validate.ts (BAD_/UNKNOWN_STARTABSTAND…, validateConfigTexts legt beide zusammen) → catalog.ts startabstandOf
  (eigener Wert, Regelwerk, allgemein – beim Lesen aufgelöst, der Stand hält nur eigene); baue() nimmt beide heraus.

## Fallen

- Drei Textsysteme: Oberfläche/Listen in i18n/de/+en/ (Bereichsdateien); Regelwerk/Positionen in YAML (`en`, `titelEn`,
  `fehlerHinweisEn`, i18n/en.yaml nach deutschem Wortlaut); feste Bogen-/Legendentexte in sprache.ts bzw. build.ts.
- Übersetzungen hängen am exakten deutschen Wortlaut (en.yaml, lib/ergebnisText.ts SPALTEN, laufzettelText.ts
  SCHRITTE). Deutschen Text ändern ⇒ Zuordnung mitziehen, sonst MISSING_EN oder Deutsch auf englischer Liste.
- Positionen werden gegen JEDES Regelwerk geprüft; eigene Aufbauten probeweise mit jedem gebaut (abgelehnteEigene).
- Unter `sprachen: [de, en]` ist jede fehlende Übersetzung ein Fehler (MISSING_EN), bei eigenen nur EN_TITEL_FEHLT.
- Parallelslalom: Positionen/Spalten ohne `klassen` (PARALLEL_KLASSEN). configFor, ROH_* sind tief eingefroren –
  nie verändern; catalog.ts kennt keine eigenen Aufbauten.
- YAML-Kommentare tragen Belege (Reglement, Regel 960 Pkt.) und Nutzerentscheidungen mit Datum – mitpflegen. Veraltet
  (gibt es nicht): `npm run config:sync`/`config:check`, scripts/*-config.ts, public/config/; geprüft: validate.test.ts.
- Parcours-SVGs nie von Hand ändern (Quelle: Parcours-Repo, lib/parcoursVertrag.ts, lib/parcoursQuelle.test.ts).

## Tests

`npx vitest run src/config src/i18n` (validate.test.ts prüft die echten YAML; regelwerke.test.ts feste Codes und je
Position die volle Buchstabenliste, `buchstaben('steg')`; Snapshot `__snapshots__/kurzform.test.ts.snap`; erneuern und
Typen: Wurzelkarte). Bei Wertung/Texten zusätzlich src/lib/ergebnis, parallelErgebnis, einzelwertung, pokal, disq.
