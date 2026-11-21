# src/wkr – Digitale WKR-Erfassung, Fachkern (W1)

Reine Logik der Erfassung durch die Wettkampfrichter am eigenen Gerät (Vorschlag docs/vorschlag-wkr-erfassung.md,
Antworten F1–F17 vom 21.11.2026; Plan docs/plan-wkr-w1.md). **Rein**: kein DOM, kein Store, kein Date.now(), und
**nichts aus geraete/** – der Reducer (state/reducer/wkr.ts) und geraete/ (host.ts, aufgaben.ts, erfassen.ts) benutzen
diesen Ordner, nie umgekehrt. W1 (W1.1–W1.4) gebaut 21.11.2026; W2 (Bedienrechner, Plan docs/plan-wkr-w2.md, Scheiben
W2.1–W2.4) gebaut 21.11.2026, Auslegungen A1–A13, B1–B6, C1–C4, D1–D5 noch zu bestätigen; Masken (W3/W4) fehlen noch.
Werte gehen nur über `eingaben` (wie Abtippen), nie über den Betrieb; belegte Zellen nie still überschreiben.

## Dateien

- `annahmen.ts` – WKR_ANNAHMEN: alle Auslegungen mit Datum (Plan §9, „noch zu bestätigen“), Zahlen (Bündel 8, Schlange
  12, danach 5, zuletzt 20, Lebenszeichen 60 s), Steg-Teile nach Spalten-Key (`fehlerAB`/`fehlerAN`, gemeinsam
  `disq`/`bemerkung`), X nur Steg-Ablegen und Vorsteg (F5), `vorabListen` (Vorsteg sieht die nächsten), Knoten erst W5.
  W2 (A1–A13, 21.11.2026, noch zu bestätigen): matrixStarts 12, rueckstandVorgabe 2 (Grenzen 1–20), ampelStillSek 90,
  ampelWegSek 300, papierStartVorschlag (A6), papierAbMeldetAb (A10), papierAnsehen (A5) …; W2.2 beim Bau B1–B6
  (Zähler nur Rückfragen, Modus ohne Gerät, „Weiter“ mit Hinweis, Papier-ab-Vorgabe, Karte, `zuletzt` gedrosselt);
  W2.3 beim Bau C1–C4 (◆ an jeder Liste, Nachfrage bei der ersten Änderung, Zahl mit Zellmarken, Uhr 30 s);
  W2.4 beim Bau D1–D5 (Leiste mit allen Listen, Rückfragen nur als Zahl + `warnt`, Titel in Tafel-Sprache,
  freigabeTaktSek 15, Nachfrage vor jedem Zeigen); Prüfbefunde W2 E1–E4 (abgetippt = erledigt in lage.ts, ◆ nach
  Entscheid, Hinweise je Steg-Teil, Freigabe je Gerätewert/Zeitfelder; plan-wkr-w2.md §10).
- `liste.ts` – ListenKennung `JSON.stringify(['l', bereich, typeId, racecourse|null])`, listenKennung/liesListe,
  listenDerVeranstaltung (Bereiche × Listen mit Lauf, Parallel × A/B), teileVon/teilVonZelle, istHaken/teilHaken
  (aus lib/eingaben.ts), startAufListe (Starter, Lauf-Schlüssel, `weitere` am Vorsteg mit „Versuche nacheinander“, Punkt;
  Parallel: eigene Seite aus `fest.starts`); W2: listeVonBogen(bogen, konfig) (Bogen der Erfassung → Liste; Knoten → null).
- `zeile.ts` – GeraeteZeile (Leitung: z, s, t?, k?, seite?, c: [feld, wert, vorher][]), ZeilenFehler,
  pruefeZeile → WkrZeile (types/wkr.ts) | {fehler}; wertGilt = dieselben Sanierer wie ErfassungTabelle.vue, ein Wert
  gilt nur unverändert. WkrZeile trägt `teil` (eigener Teil der Zeile).
- `schlange.ts` – schlange(stand, liste, teil?) (gezeigt ab `seit`, ohne Pausen/P der Liste UND des Teils, ohne Starts
  aus „Rest auf Papier“ und abgeschlossene Punkte, ohne Haken, X fällt weg, Klasse ohne Liste nur als letzter gezeigter
  `entfaellt`, Vorsteg + nächste freie `vorab`; geteilte Liste ohne Teil: Start, solange EIN Teil ihn braucht,
  `teileOffen`), danach, papierStarts(stand, liste, teil?), naechsteFreie; `leser` (auch für lage.ts: X, Haken).
- `abschluss.ts` (Prüfbefunde 21.11.2026) – Abschluss-Schlüssel `punkt` bzw. `punkt|ab`/`punkt|an` (abschlussSchluessel,
  liesAbschlussSchluessel), abschlussVon, istAbgeschlossen (Teil: ganz oder Teil; ohne Teil: ganz oder beide Teile),
  zeileAbgeschlossen (ganze Zeile einer geteilten Liste schon bei EINEM Teil), abgeschlossenePunkte, abschlussPapier,
  punktVonRef, punktBegonnen (Abschluss nur für begonnene Punkte – Reducer UND erlaubteWkr); W2: abschluesseVon (alle
  Abschlüsse einer Liste mit Punkt/Teil).
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
- `lage.ts` (W2.1, 21.11.2026) – erfassungsLage(stand, konfig, bereich, geraete, jetzt, starts?) → {punkt, starts
  (Spalten: gezeigte Starts des laufenden Punkts, letzte 12 bzw. alle; Vorsteg + `vorab`), listen: ListenLage (Modus,
  Status, Teile, papierAb, Geräte mit Ampel, Zellstand je Spalte, Rückstand, warnt, Rückfragen/Vorschläge, Abschlüsse
  mit Startnummern)}; Zellstand ok/halb/offen/ueberfaellig/rueckfrage/vorschlag/entfaellt/papier/x/vorab (Vorrang
  X → Klasse ohne Liste → Rückfrage → Vorschlag → Haken → Teile → Schlange; nicht in der Schlange = Papier);
  ampelVon (gehoert/still/weg, ohne laufenden Punkt ruht), schlechteste; zeilenMarken (Erfassung: `${lauf}|${starter}` →
  Zeile/Zelle „papier-ansehen“ bzw. „rueckfrage“, nur Listen digital/beides); rueckstandZeile (Zeile über „Nächster
  Start“). Geräte nur als GeraetAngabe (einfache Daten vom Host, geraete/register.ts geraetAngaben), nichts aus
  geraete/. Nutzer W2.2: components/betrieb/WkrMatrix.vue (Betrieb → WKR); W2.3: components/erfassung/ErfassungTabelle.vue
  (listeVonBogen + zeilenMarken einmal je Bogen, ◆ über geraete/wkrEingang.ts herkunftGilt).
- `freigabe.ts` (W2.4, 21.11.2026) – sichtFreigabe(bereich, lagen, warnung) → FreigabeErfassung {fv:
  FREIGABE_SICHT_FASSUNG = 1, bereich, warnung, listen: FreigabeListe {titel, stand aktiv|pausiert|abgemeldet|papier,
  ampel|null, offen, von, bis, wartend?, rueckfragen, warnt}} – Feld für Feld, leer ohne Eintrag im Bereich; liesFreigabe
  (Gerät: Form prüfen, Fremdes fällt weg). Nutzer: StartFreigabe.vue Prop `erfassung` (BetriebView rechnet sie aus
  erfassungsLage, GeraetFreigabe bekommt sie über geraete/gekoppelt.ts `freigabe`), geraete/host.ts verteileFreigabe
  (Freigabe-Gruppe je Bereich, geraete/wkrGruppen.ts gruppeDerFreigabe). Nie über ko/kz (F17).
- Nutzer außerhalb: geraete/aufgaben.ts erlaubteWkr (pruefeZeile), geraete/host.ts (sichtListe je Listen-Gruppe),
  geraete/erfassen.ts (Gerät: liest ListenSicht, rechnet zeilenPruefsumme wie WKR_ABSCHLUSS, Zahlen aus WKR_ANNAHMEN:
  buendel, zuletzt, lebenszeichenSek, nameMax). Ende zu Ende: geraete/wkr.test.ts.
- Stand: types/wkr.ts (WkrStand in AppState.wkr), Actions state/reducer/wkr.ts (WKR_ZEILEN, WKR_RUECKFRAGE,
  WKR_VORSCHLAG, WKR_LISTE, WKR_ABSCHLUSS, WKR_ABSCHLUSS_LOESEN, W2: WKR_PAPIER_AB {liste, ref, teil?} mit WkrPause.ab;
  normalisiereWkr für migrate). Verlauf: lib/verlauf.ts eingabeGeraet (Liste + Gerätename), rueckfrage, vorschlag,
  wkrListe, wkrAbschluss, wkrPapierAb. Einstellung R und warnen/nachfragen: AppState.anzeige.wkrRueckstand/wkrWarnung
  (SET_ANZEIGE, normalisiereAnzeige; SettingsView `#betrieb`).

## Fallen

- Feld-Kennungen des Stegs sind die Kataloge (`katalog:stegAblegen`), Teile hängen am Spalten-Key (`Feld.zelle`).
- Teilhaken `erfasst.ab@steg`/`erfasst.an@steg`: nie Wertung (lib/listenStand.ts), nie „verborgen-unbekannt“, solange
  `erfasst@steg` sichtbar ist (lib/eingaben.ts verborgeneZellen); beide → `erfasst@steg` (Reducer `mitHaken`).
- Eine Liste ohne Eintrag in `wkr.listen` ist Papier: Zeilen werden Vorschläge, die Schlange ist leer.
- Seit W2 (A6) werden auch Zeilen zu Starts in P (papierStarts der Liste bzw. des Teils; ganze Steg-Zeile: schon EIN
  Teil) Vorschlag `papier` – auch nach „Weiter“. Wer still übernehmen will, muss erst P ändern.
- lage.ts: „erledigt“ = Haken ODER eigene Werte (am Steg die Felder des Teils; E1) – schlange.ts dagegen nur der Haken
  (die Geräte sollen ihre Zeile auch nach einer Eingabe des Bedieners noch schicken können). Nicht angleichen.
- lage.ts: „Papier“ heißt gezeigt, ohne Haken, nicht in der Schlange – neue Schlangenregeln wirken dort von selbst;
  keine eigene Papier-Logik in lage.ts nachbauen. Schlangen und Zellen nach `${lauf}|${starter}` (Vorsteg mit
  „Versuche nacheinander“: ein Starter, mehrere Kennungen).
- Freigabe-Sicht (freigabe.ts): neues Feld nur mit Eintrag in der Positivliste (freigabe.test.ts) und ggf. neuer
  FREIGABE_SICHT_FASSUNG; nie Werte, Starter-, Geräte- oder WKR-Namen, keine Startnummer einer Rückfrage (D2). F17:
  wkr/sicht.test.ts prüft sichtOeffentlich/sichtZuschauer über alle WKR-Actions und SET_ANZEIGE R/warnen.
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

`npx vitest run src/wkr src/views/BetriebWkr src/GeraetKoppeln src/views/SettingsView src/geraete/aufgaben src/geraete/wkrGruppen src/state/reducer/wkr src/state/migrate src/persistenz/backup src/lib/verlauf src/lib/eingaben`.
Hilfe: testHilfen.ts wkrBetriebsStand (DM, festgeschrieben, Lauf 1 auf beiden Parcours begonnen).
