# src/wkr – Digitale WKR-Erfassung, Fachkern (W1)

Reine Logik der Erfassung durch die Wettkampfrichter am eigenen Gerät (Vorschlag docs/vorschlag-wkr-erfassung.md,
Antworten F1–F17 vom 21.11.2026; Plan docs/plan-wkr-w1.md). **Rein**: kein DOM, kein Store, kein Date.now(), und
**nichts aus geraete/** – der Reducer (state/reducer/wkr.ts) und geraete/ (host.ts, aufgaben.ts, erfassen.ts) benutzen
diesen Ordner, nie umgekehrt. W1 (W1.1–W1.4) gebaut 21.11.2026; Masken (W3/W4) und Bedieneransicht (W2) fehlen noch.
Werte gehen nur über `eingaben` (wie Abtippen), nie über den Betrieb; belegte Zellen nie still überschreiben.

## Dateien

- `annahmen.ts` – WKR_ANNAHMEN: alle Auslegungen mit Datum (Plan §9, „noch zu bestätigen“), Zahlen (Bündel 8, Schlange
  12, danach 5, zuletzt 20, Lebenszeichen 60 s), Steg-Teile nach Spalten-Key (`fehlerAB`/`fehlerAN`, gemeinsam
  `disq`/`bemerkung`), X nur Steg-Ablegen und Vorsteg (F5), `vorabListen` (Vorsteg sieht die nächsten), Knoten erst W5.
- `liste.ts` – ListenKennung `JSON.stringify(['l', bereich, typeId, racecourse|null])`, listenKennung/liesListe,
  listenDerVeranstaltung (Bereiche × Listen mit Lauf, Parallel × A/B), teileVon/teilVonZelle, istHaken/teilHaken
  (aus lib/eingaben.ts), startAufListe (Starter, Lauf-Schlüssel, `weitere` am Vorsteg mit „Versuche nacheinander“, Punkt;
  Parallel: eigene Seite aus `fest.starts`).
- `zeile.ts` – GeraeteZeile (Leitung: z, s, t?, k?, seite?, c: [feld, wert, vorher][]), ZeilenFehler,
  pruefeZeile → WkrZeile (types/wkr.ts) | {fehler}; wertGilt = dieselben Sanierer wie ErfassungTabelle.vue, ein Wert
  gilt nur unverändert. WkrZeile trägt `teil` (eigener Teil der Zeile).
- `schlange.ts` – schlange(stand, liste, teil?) (gezeigt ab `seit`, ohne Pausen/P der Liste UND des Teils, ohne Starts
  aus „Rest auf Papier“ und abgeschlossene Punkte, ohne Haken, X fällt weg, Klasse ohne Liste nur als letzter gezeigter
  `entfaellt`, Vorsteg + nächste freie `vorab`; geteilte Liste ohne Teil: Start, solange EIN Teil ihn braucht,
  `teileOffen`), danach, papierStarts(stand, liste, teil?), naechsteFreie.
- `abschluss.ts` (Prüfbefunde 21.11.2026) – Abschluss-Schlüssel `punkt` bzw. `punkt|ab`/`punkt|an` (abschlussSchluessel,
  liesAbschlussSchluessel), abschlussVon, istAbgeschlossen (Teil: ganz oder Teil; ohne Teil: ganz oder beide Teile),
  zeileAbgeschlossen (ganze Zeile einer geteilten Liste schon bei EINEM Teil), abgeschlossenePunkte, abschlussPapier,
  punktVonRef, punktBegonnen (Abschluss nur für begonnene Punkte – Reducer UND erlaubteWkr).
- `uebernahme.ts` – wendeZeileAn (gleich → nichts, vorher → setzen, sonst Konflikt; `vereinige`: Disq. vereinigt,
  Wegfall = Konflikt `entfernt`, Bemerkung mit „; “), vereinigeDisq, haengeAn, vereinigt (Ziel einer gemeinsamen
  Zelle bei Entscheid für das Gerät – Rückfrage `start` mit `vereinige: {vorher}`), zeilenPruefsumme (FNV-1a).
- `sicht.ts` (W1.2) – sichtListe(stand, konfig, liste, extra) → ListenSicht (LISTEN_SICHT_FASSUNG = 2; 2 seit den
  Prüfbefunden 21.11.2026: `teile` {ab, an} je Teil Status und abgeschlossene Punkte, ListenStart.teile = Teil braucht
  nichts mehr): Kopf in der
  Sprache der Liste (wkrSpracheFuer + eigene configFor-Fassung für Titel, Spaltenköpfe, Kataloge), Modus/Status,
  laufender Punkt, abgeschlossene Punkte, Schlange (≤ 12) und „danach“ als ListenStart (Startnummer, Klasse, Titel,
  Lauf-Schlüssel, Seite, Boot, Steg-Teile, entfaellt, vorab), Masken je Klasse (null = Klasse ohne Liste; X nur wo
  F5 es erlaubt), je Gerät aus `extra` bis/abgelehnt/hinweise + eigene Rückfragen mit `steht` + abweichend.
  WKR_HINWEISE (Codes des Rückkanals) steht hier, damit die Sicht nichts aus geraete/ braucht.
- Nutzer außerhalb: geraete/aufgaben.ts erlaubteWkr (pruefeZeile), geraete/host.ts (sichtListe je Listen-Gruppe),
  geraete/erfassen.ts (Gerät: liest ListenSicht, rechnet zeilenPruefsumme wie WKR_ABSCHLUSS, Zahlen aus WKR_ANNAHMEN:
  buendel, zuletzt, lebenszeichenSek, nameMax). Ende zu Ende: geraete/wkr.test.ts.
- Stand: types/wkr.ts (WkrStand in AppState.wkr), Actions state/reducer/wkr.ts (WKR_ZEILEN, WKR_RUECKFRAGE,
  WKR_VORSCHLAG, WKR_LISTE, WKR_ABSCHLUSS, WKR_ABSCHLUSS_LOESEN; normalisiereWkr für migrate). Verlauf: lib/verlauf.ts
  eingabeGeraet (Liste + Gerätename), rueckfrage, vorschlag, wkrListe, wkrAbschluss.

## Fallen

- Feld-Kennungen des Stegs sind die Kataloge (`katalog:stegAblegen`), Teile hängen am Spalten-Key (`Feld.zelle`).
- Teilhaken `erfasst.ab@steg`/`erfasst.an@steg`: nie Wertung (lib/listenStand.ts), nie „verborgen-unbekannt“, solange
  `erfasst@steg` sichtbar ist (lib/eingaben.ts verborgeneZellen); beide → `erfasst@steg` (Reducer `mitHaken`).
- Eine Liste ohne Eintrag in `wkr.listen` ist Papier: Zeilen werden Vorschläge, die Schlange ist leer.
- Rückfragen/Vorschläge tragen nie einen Gerätenamen (F10), nur die Geräte-ID in `zeile` (`${geraetId}.${z}`).
- getSheetDef wirft bei unbekannter Liste: startAufListe prüft vorher getPositions().
- Prüfsumme des Abschlusses: Reducer und Gerät müssen dieselben Felder nehmen – bei einem Teil (Steg) nur die Felder
  dieses Teils, OHNE die gemeinsamen (Disq., Bemerkung); MaskenFeld.teil fehlt bei gemeinsamen. Ändert sich das
  eine, das andere mitziehen (geraete/erfassen.ts schliesseAb).
- Sicht der Liste: jedes Objekt Feld für Feld neu (wie sichtZuschauer); nie Name, Herkunft, Geburtsdatum, Gewicht,
  Geschlecht, Werte (auch nicht der eigenen Liste), Summen, Wertung, WKR-Name des Abschlusses. Einzige Ausnahme `steht`
  (F11) – steht unter dem Gerät der Rückfrage, lesbar aber für jedes Gerät derselben Liste (EIN Gruppeninhalt,
  WKR_ANNAHMEN.rueckfrageInListe). Neues Feld → Positivliste in sicht.test.ts und ggf. LISTEN_SICHT_FASSUNG.
- Steg je Teil: Status/Pausen (WkrListe.teile) und Abschluss (`punkt|teil`) – nie `wkr.abschluss[liste][punkt]` direkt
  lesen, immer über abschluss.ts; WKR_LISTE mit `teil` nur Status, nur bei vorhandenem Eintrag.

## Tests

`npx vitest run src/wkr src/geraete/aufgaben src/geraete/wkrGruppen src/state/reducer/wkr src/state/migrate src/persistenz/backup src/lib/verlauf src/lib/eingaben`.
Hilfe: testHilfen.ts wkrBetriebsStand (DM, festgeschrieben, Lauf 1 auf beiden Parcours begonnen).
