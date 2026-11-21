# src/wkr – Digitale WKR-Erfassung, Fachkern (W1)

Reine Logik der Erfassung durch die Wettkampfrichter am eigenen Gerät (Vorschlag docs/vorschlag-wkr-erfassung.md,
Antworten F1–F17 vom 21.11.2026; Plan docs/plan-wkr-w1.md). **Rein**: kein DOM, kein Store, kein Date.now(), und
**nichts aus geraete/** – der Reducer (state/reducer/wkr.ts) und geraete/ (host.ts, aufgaben.ts, erfassen.ts) benutzen
diesen Ordner, nie umgekehrt. W1 (W1.1–W1.4) gebaut 21.11.2026; W2 (Bedienrechner, Plan docs/plan-wkr-w2.md, Scheiben
W2.1–W2.4) gebaut 21.11.2026; alle Auslegungen W1 und W2 (A1–A13, B1–B6, C1–C4, D1–D5, E1–E4) vom Nutzer bestätigt
21.11.2026 (A4 in der Fassung N8); W3 (Handy-Maske „Knöpfe“,
Plan docs/plan-wkr-w3.md): W3.1 (reine Maske, Übung, Gerätekern) und W3.2 (Liste zuweisen am Bedienrechner) gebaut
21.11.2026, G1–G16, H1–H5 und J1–J5 noch zu bestätigen; W3.3 (Handy-Maske „Knöpfe“ mit Rahmen, components/wkr/)
gebaut 21.11.2026, K1–K9 noch zu bestätigen; W3.4 (Liste abschließen, Probe, Ansicht/Sprache, Übung `#/uebung`) gebaut
21.11.2026, L1–L9 noch zu bestätigen – W3 fertig, Feldtest offen. W4 (Bojen-Maske, Plan docs/plan-wkr-w4.md): W4.1
(reine Bojen-Logik, Sicht, Maske) gebaut 21.11.2026, P1–P15 noch zu bestätigen; W4.2 (Handy-Maske Bojen, Probe, Übung,
components/wkr/WkrBojen.vue) gebaut 21.11.2026, P17 und Q1–Q7 noch zu bestätigen; W4.3 („Nicht vorbeigekommen“, löst
G15 ein) gebaut 21.11.2026, P16 und R1–R8 noch zu bestätigen – W4 fertig, Feldtest offen.
Werte gehen nur über `eingaben` (wie Abtippen), nie über den Betrieb; belegte Zellen nie still überschreiben.

## Dateien

- `annahmen.ts` – WKR_ANNAHMEN: alle Auslegungen mit Datum (Plan §9, „noch zu bestätigen“), Zahlen (Bündel 8, Schlange
  12, danach 5, zuletzt 20, Lebenszeichen 60 s), Steg-Teile nach Spalten-Key (`fehlerAB`/`fehlerAN`, gemeinsam
  `disq`/`bemerkung`), X nur Steg-Ablegen und Vorsteg (F5), `vorabListen` (Vorsteg sieht die nächsten), Knoten erst W5.
  W2 (A1–A13, 21.11.2026, bestätigt 21.11.2026): matrixStarts 12, rueckstandVorgabe 2 → seit N8 1 (Grenzen 1–20), ampelStillSek 90,
  ampelWegSek 300, papierStartVorschlag (A6), papierAbMeldetAb (A10), papierAnsehen (A5) …; W2.2 beim Bau B1–B6
  (Zähler nur Rückfragen, Modus ohne Gerät, „Weiter“ mit Hinweis, Papier-ab-Vorgabe, Karte, `zuletzt` gedrosselt);
  W2.3 beim Bau C1–C4 (◆ an jeder Liste, Nachfrage bei der ersten Änderung, Zahl mit Zellmarken, Uhr 30 s);
  W2.4 beim Bau D1–D5 (Leiste mit allen Listen, Rückfragen nur als Zahl + `warnt`, Titel in Tafel-Sprache,
  freigabeTaktSek 15, Nachfrage vor jedem Zeigen); Prüfbefunde W2 E1–E4 (abgetippt = erledigt in lage.ts, ◆ nach
  Entscheid, Hinweise je Steg-Teil, Freigabe je Gerätewert/Zeitfelder; plan-wkr-w2.md §10).
  W3 (G1–G16, plan-wkr-w3.md §9): sperreMs 1000 (weiterNachMs 2000 ersetzt durch N1), ohneQuittungMs 10000, papierHinweisSek 300,
  rueckgaengigMs 6000, zuletztLeiste 5, uebungQuittungMs 300, uebungRueckfrageBei 5, uebungStarts 20, uebungTaktSek 30;
  W3.1 beim Bau H1–H5 (Disq. als Schalter, ohne Disq.-Feld ins erste Code-Feld; „zurück“ = letzter Tipp; Schlange je
  Steg-Teil auf dem Gerät; Entwürfe im Ausgang; Übung in der Sprache des Regelwerks); W3.2 beim Bau J1–J5 („Maske
  folgt“ nach den Klassen der Starter, Handy am Namen erkannt, Freigabe-Vorwahl nur ohne Liste, beim Koppeln eine
  Liste, Verweis „Gerät koppeln“ immer); W3.3 beim Bau K1–K9 (Disq. zweiter Tipp, Sperre auch während „gesendet“,
  Erfassung bleibt nach Entzug offen, Entwurf je Tipp, Pause ohne Knöpfe, Reiter „Freigabe“ zuerst, „So lassen“ nur
  lokal, Suche mit „E“, Hauptknopf mit Disq.); W3.4 beim Bau L1–L9 (Korrektur aus der Prüfansicht nur über „Zuletzt“,
  Regel des Abschluss-Bands, Punkt unter „Mehr“, Name beim Abschicken gemerkt – Übung nie, Sprache der Liste = keine
  eigene Wahl, Probe nur mit Maske/Übung nur über „Mehr“, Übungsadresse fest, „Mehr“ auch ohne Arbeit, Zeile ohne
  Ausgang = übernommen); Prüfbefunde W3 M1–M6 (gemeinsame Steg-Felder je Teil, Korrektur aus `stand`, Vormerken je
  Start, Gedächtnis über Reiter, Bildschirm ohne Nachrutschen, Entwürfe fürs Papier; plan-wkr-w3.md §14).
  Feldtest mit echtem Handy 21.11.2026 N1–N7 (alle noch zu bestätigen): Overlay nach dem Abschicken mit Quittung
  (uebertragenMinMs 600, uebernommenMs 800, uebertragenMaxMs 3000 – wkr/maske.ts wechselTakt/wechselNach, Takt
  `uebernommen`), „Bestätigung folgt“ über dem Kopf, nie abgeschnittener Text, Farben nur der Maske (Klassen-Kollision
  mit app.css), Ende der Probe, Knopf DISQ/FEHLER nennt das Ziel + „Andere Startnummer …“, Hinweis „Bildschirm kann
  ausgehen“ in der Maske. Start-Freigabe N8–N10 (Feldtest 21.11.2026, Befunde 8/9/12, ändert F4): `warnt` AB R
  (`rueckstandAbR`, vorher mehr als R), Vorgabe R = 1 und `warnungVorgabe` „nachfragen“, „überfällig“ erst bei mehr
  als max(R, `ueberfaelligMin` 2) jüngeren; Leiste mit Zeichen nach Erfassungsstand ✓/⧗/✕/▭, Verbindung klein;
  Rückfrage nennt Liste und Startnummern. Nie gesperrt. N11–N13 (Feldtest 21.11.2026, noch zu bestätigen):
  `verbindeKarenzSek` 12 (nach dem Öffnen neutral „verbinde …“, rot erst nach Karenz oder Abriss; geraete/erfassen.ts
  `verbindung`), `wartendNurUeberNull`, `pruefenOeffnet` („Bitte Nr. prüfen“ → „601 öffnen“ in WkrMaske).
  W4.1 (P1–P15, 21.11.2026, noch zu bestätigen): bojenPunkte 5, bojenZaehlerMax 9, bojenZeilenEineSeite 7 (Umschalter
  ab MEHR Zeilen), klassenWechselMs 2000 (erst W4.2); Merker bojenAmFahrweg, zaehlerNurTor5, tor1ZweiZeilen, fahrtfolge,
  seitenNachBlick, disqNieInBoje, probeMeisteZeilen, uebungBojen, bojenFehlerfrei, bojenTexteWieBogen, bojenInSicht;
  W4.2 bojenStartnr80 (P17) und beim Bau Q1–Q7: probeLinkerKnopf, klassenWechselUnterKarte, zaehlerMaxImKnopf, wegJeStart,
  bojenBeschriftung, wegKopfOhneUmschalter, uebungListenDesRegelwerks. W4.3 (P16, beim Bau R1–R8, noch zu bestätigen):
  nichtVorbei, nichtVorbeiNichtBeiX (R1, Code `nv-nicht-erlaubt`), nichtVorbeiNurDirekt (R2), nichtVorbeiAufheben (R3),
  nichtVorbeiZelle (R4), nichtVorbeiImAbschluss (R5), nichtVorbeiMehr (R6), nichtVorbeiVerlauf (R7), nichtVorbeiUebung (R8).
  Prüfbefunde W4 (S1–S5, 21.11.2026, noch zu bestätigen): bojenSchalterPrellMs 400, pruefenNurLaufenderPunkt,
  unbekanntBandKurz, zaehlerStandZweiZeilen, hinweisUeberKopf.
- `bojen.ts` (W4.1, 21.11.2026) – rein, ohne Konfiguration: bojenHalt(kennung) → {halt, weg, seite, folge, zaehler,
  durchfahrt?} aus config/kurzform.ts FAHRWEG bzw. PARALLEL_FAHRWEG (= Spalten von parallelparcours, Test); Tor 5 =
  Zähler, t1c = `durchfahrt: 2`, Speedbojen ohne Seite auf dem Rückweg, Parallel bis Boje 5 Hinweg; Knoten und
  Unbekanntes → null (P1). katalogFolge(kennung): katalog:tor5 zwischen Tor 5 hin/rück (hin), katalog:mueb nach t1b (rück).
- `liste.ts` – ListenKennung `JSON.stringify(['l', bereich, typeId, racecourse|null])`, listenKennung/liesListe,
  listenDerVeranstaltung (Bereiche × Listen mit Lauf, Parallel × A/B), teileVon/teilVonZelle, istHaken/teilHaken
  (aus lib/eingaben.ts), startAufListe (Starter, Lauf-Schlüssel, `weitere` am Vorsteg mit „Versuche nacheinander“, Punkt;
  Parallel: eigene Seite aus `fest.starts`); W2: listeVonBogen(bogen, konfig) (Bogen der Erfassung → Liste; Knoten → null).
- `zeile.ts` – GeraeteZeile (Leitung: z, s, t?, k?, seite?, c: [feld, wert, vorher][], W4.3 n?: true), ZeilenFehler,
  pruefeZeile → WkrZeile (types/wkr.ts) | {fehler}; wertGilt = dieselben Sanierer wie ErfassungTabelle.vue, ein Wert
  gilt nur unverändert. WkrZeile trägt `teil` (eigener Teil der Zeile). W4.3: `n` nur mit leerem `c` (sonst
  `wert-ungueltig`), nie wo X gilt (Vorsteg, Steg-Ablegen bzw. ganzer Steg → `nv-nicht-erlaubt`) → WkrZeile.nichtVorbei.
- `nichtVorbei.ts` (W4.3, 21.11.2026) – „Nicht vorbeigekommen“ im Stand (WkrStand.nichtVorbei, je Liste Schlüssel):
  nvSchluessel(lauf, starter, teil?) = `${lauf}|${starter}` bzw. `…|an`, liesNvSchluessel, istNichtVorbei,
  mitNichtVorbei (setzen/löschen, gleiche Referenz), ohneUeberholteNichtVorbei(stand, konfig) – hebt Kennzeichen auf,
  deren Zelle eigene Werte der Liste hat (am Steg nur Felder des Anlegens); ruft reducer.ts nach jeder Änderung der
  Eingaben.
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
- `sicht.ts` (W1.2) – sichtListe(stand, konfig, liste, extra) → ListenSicht (LISTEN_SICHT_FASSUNG = 5; 5 seit W4.3
  „Nicht vorbeigekommen“ – Form gleich, nur damit alte Geräte/Bedienrechner nicht mischen; 4 seit W4.1:
  MaskenFeld.boje {halt, weg, folge, titel, unter, spalte 0|1|null, zaehler?, durchfahrt?} je Fahrweg-Boje – titel/unter
  aus defFuerKlasse(...).columns (label, sub[i], Beschriftung schon aufgelöst), spalte = Index der Seite in der ersten
  Spalte der LISTE mit zwei verschiedenen Bojen (P7), AndereFeld.boje {titel, unter}; 3 seit W3:
  `andere` = dieselben Masken in der anderen Sprache, nur Texte, nur wenn das Regelwerk [de, en] hat (UIM); bei
  zweisprachiger Liste stehen `klassen` deutsch, `andere` englisch (G9) – maskenSprachen; maskenJeKlasse(konfig,
  sprachKonfig, typeId, klassen, xErlaubt) ist der geteilte Masken-Teil (auch uebung.ts), maskenTexte für `andere`; 2 seit den
  Prüfbefunden 21.11.2026: `teile` {ab, an} je Teil Status und abgeschlossene Punkte, ListenStart.teile = Teil braucht
  nichts mehr): Kopf in der
  Sprache der Liste (wkrSpracheFuer + eigene configFor-Fassung für Titel, Spaltenköpfe, Kataloge), Modus/Status,
  laufender Punkt, abgeschlossene Punkte, Schlange (≤ 12) und „danach“ als ListenStart (Startnummer, Klasse, Titel,
  Lauf-Schlüssel, Seite, Boot, Steg-Teile, entfaellt, vorab), Masken je Klasse (null = Klasse ohne Liste; X nur wo
  F5 es erlaubt), je Gerät aus `extra` bis/abgelehnt/hinweise + eigene Rückfragen mit `steht` + abweichend.
  WKR_HINWEISE (Codes des Rückkanals) steht hier, damit die Sicht nichts aus geraete/ braucht.
- `maske.ts` (W3.1, 21.11.2026) – Maske „Knöpfe“, rein: maskenArt (G2, an den Feldarten: nur code/disq/text →
  katalog bzw. vorsteg, sonst spaeter), maskeFuer(sicht, klasse, 'liste'|'andere') → MaskenAufbau {art, titel, teile
  (Code-Felder mit Katalog, Steg ab/an), disq {feld, teil, codes mit `nurIn` (X am Steg nur Ablegen)}, bemerkung} | null
  (entfällt), teileFuer, disqFuer(aufbau, teil?); Entwurf {codes je Feld, disq, bemerkung, folge}: leererEntwurf,
  tippe, tippeDisq (Schalter), mitBemerkung, zurueck, eintraege, punkteVon; zellenAus(e, aufbau, teil?) = Zellwerte
  über normalizeCodeCell („2x6, 20“), Disq. in Tipp-Folge („A, X“), auch leere (Fehlerfrei); entwurfAus (rund);
  wechselTakt(gesendetUm, jetzt) → gesendet|sperre|frei (G5). W3.2: listeMitMaske(konfig, typeId, klassen) – hat die
  Liste in W3 eine Maske (alle Klassen der Starter mit der Liste nur Katalog/Disq./Text, J1); Bedienrechner beim Zuweisen.
  W3.4: probeMaske(sicht, sprache) – Maske der ersten Klasse mit Maske für die Probe (G10), `null` = keine Probe.
  W4.1 (21.11.2026): MaskenArt `bojen` (buoy MIT `boje`; buoy ohne, time, points → spaeter; listeMitMaske prüft über
  bojenHalt), MaskenAufbau.abschnitte (MaskenHalt {halt, titel, weg, durchfahrt?, bojen: MaskenBoje {feld, unter,
  spalte, zaehler, punkte}} bzw. Katalog-Teil an seinem Fahrweg-Platz, nach `folge`) + umschalter (maskenZeilen >
  bojenZeilenEineSeite; Katalog zählt je Code), wegVon, bojenVon, eintraegeAuf(e, aufbau, weg) (Zahl am Reiter);
  Entwurf.bojen (Berührungen je Feld) + tippeBoje (Schalter 0↔1 samt Merker `#boje:`, Zähler bis bojenZaehlerMax,
  danach gleiche Referenz); zurueck/eintraege/punkteVon kennen Bojen; zellenAus n×punkte bzw. '' (Disq. nur ins
  Disq.-Feld, P9); entwurfAus Punkte → round(wert/punkte), Schalter ≤ 1; probeMaske = Klasse mit den meisten Zeilen.
- `uebung.ts` (W3.1) – Übung ohne AppState/Store/Netz: uebungsStand(regelwerk, typeId, sprache?) → UebungsStand
  {naechster, offen je Teil}, uebungsSicht(stand) → ListenSicht (Starts 1–20 ohne Namen und ohne Boot in den Klassen
  mit der Liste, Kennung `["m","u<n>",lauf]`, Vorsteg 2 `vorab`, nach Nr. 20 der nächste Lauf), uebungsSchritt(stand,
  zeile|null) (Zeile erledigt Start bzw. Teil, Takt = null zeigt den nächsten, ≤ Schlange 12). Kern: geraete/uebung.ts.
- `lage.ts` (W2.1, 21.11.2026) – erfassungsLage(stand, konfig, bereich, geraete, jetzt, starts?) → {punkt, starts
  (Spalten: gezeigte Starts des laufenden Punkts, letzte 12 bzw. alle; Vorsteg + `vorab`), listen: ListenLage (Modus,
  Status, Teile, papierAb, Geräte mit Ampel, Zellstand je Spalte, Rückstand, warnt, Rückfragen/Vorschläge, Abschlüsse
  mit Startnummern, W4.3 auch `nichtVorbei`)}; Zellstand ok/halb/offen/ueberfaellig/rueckfrage/vorschlag/entfaellt/
  papier/x/vorab/nv (Vorrang X → Klasse ohne Liste → Rückfrage → Vorschlag → nv → Haken → Teile → Schlange; nicht in
  der Schlange = Papier; Steg: Anlegen nv + Ablegen ok → nv, sonst ½; nv ist in zeilenMarken „Papier ansehen“);
  ampelVon (gehoert/still/weg, ohne laufenden Punkt ruht), schlechteste; zeilenMarken (Erfassung: `${lauf}|${starter}` →
  Zeile/Zelle „papier-ansehen“ bzw. „rueckfrage“, nur Listen digital/beides); rueckstandZeile (Zeile über „Nächster
  Start“). Geräte nur als GeraetAngabe (einfache Daten vom Host, geraete/register.ts geraetAngaben), nichts aus
  geraete/. Nutzer W2.2: components/betrieb/WkrMatrix.vue (Betrieb → WKR); W2.3: components/erfassung/ErfassungTabelle.vue
  (listeVonBogen + zeilenMarken einmal je Bogen, ◆ über geraete/wkrEingang.ts herkunftGilt).
- `freigabe.ts` (W2.4, 21.11.2026) – sichtFreigabe(bereich, lagen, warnung) → FreigabeErfassung {fv:
  FREIGABE_SICHT_FASSUNG = 1, bereich, warnung, listen: FreigabeListe {titel, stand aktiv|pausiert|abgemeldet|papier,
  ampel|null, offen, von, bis, wartend?, rueckfragen, warnt (≥ R seit N8)}} – Feld für Feld, leer ohne Eintrag im Bereich; liesFreigabe
  (Gerät: Form prüfen, Fremdes fällt weg). Nutzer: StartFreigabe.vue Prop `erfassung` (BetriebView rechnet sie aus
  erfassungsLage, GeraetFreigabe bekommt sie über geraete/gekoppelt.ts `freigabe`), geraete/host.ts verteileFreigabe
  (Freigabe-Gruppe je Bereich, geraete/wkrGruppen.ts gruppeDerFreigabe). Nie über ko/kz (F17).
- Nutzer außerhalb: geraete/aufgaben.ts erlaubteWkr (pruefeZeile), geraete/host.ts (sichtListe je Listen-Gruppe),
  geraete/erfassen.ts (Gerät: liest ListenSicht, rechnet zeilenPruefsumme wie WKR_ABSCHLUSS, Zahlen aus WKR_ANNAHMEN:
  buendel, zuletzt, lebenszeichenSek, nameMax). Ende zu Ende: geraete/wkr.test.ts.
- Stand: types/wkr.ts (WkrStand in AppState.wkr), Actions state/reducer/wkr.ts (WKR_ZEILEN, WKR_RUECKFRAGE,
  WKR_VORSCHLAG, WKR_LISTE, WKR_ABSCHLUSS, WKR_ABSCHLUSS_LOESEN, W2: WKR_PAPIER_AB {liste, ref, teil?} mit WkrPause.ab;
  W4.3: WkrStand.nichtVorbei – WKR_ZEILEN setzt es mit dem Haken nur bei direkter Übernahme, jede Zeile ohne `n`
  löscht es, eigene Werte löschen es (reducer.ts → ohneUeberholteNichtVorbei), wkrOhneLaeufe/wkrNurStarter räumen;
  normalisiereWkr für migrate). Verlauf: lib/verlauf.ts eingabeGeraet (Liste + Gerätename), rueckfrage, vorschlag,
  wkrListe, wkrAbschluss, wkrPapierAb, W4.3 wkrNichtVorbei (Bündel nur aus `n`-Zeilen). Einstellung R und warnen/nachfragen: AppState.anzeige.wkrRueckstand/wkrWarnung
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
- Maske (W3): `zellenAus` muss genau das liefern, was wertGilt unverändert annimmt (maske.test.ts prüft jede
  Tipp-Folge je Position, DM und UIM) – keine eigene Schreibweise, immer über lib/codes.ts bzw. die Disq.-Reihenfolge.
  Disq.-Feld (sanitizeDisq) behält die Tipp-Reihenfolge, Code-Felder sortieren (normalizeCodeCell).
- Bojen (W4.1): Zeilen folgen dem FAHRWEG, nie den Spalten des Bogens (frontal135 = gate135); die Knopfspalten
  dagegen folgen dem Bogen (Blick). Eine Bojenzelle bekommt vom Gerät nur Ziffern (sanitizeBuoy nähme sonst den
  Buchstaben statt der Punkte) – Disq. immer ins Disq.-Feld. Seit W4.2 zeigt WkrMaske `bojen` mit WkrBojen.vue (Probe
  auch); `spaeter` bleiben nur Zeit, Knoten und Bojen außerhalb des Fahrwegs.
- Sicht der Liste: jedes Objekt Feld für Feld neu (wie sichtZuschauer); nie Name, Herkunft, Geburtsdatum, Gewicht,
  Geschlecht, Werte (auch nicht der eigenen Liste), Summen, Wertung, WKR-Name des Abschlusses. Einzige Ausnahme `steht`
  (F11) – steht unter dem Gerät der Rückfrage, lesbar aber für jedes Gerät derselben Liste (EIN Gruppeninhalt,
  WKR_ANNAHMEN.rueckfrageInListe). Neues Feld → Positivliste in sicht.test.ts und ggf. LISTEN_SICHT_FASSUNG.
- „Nicht vorbeigekommen“ (W4.3): Kennzeichen UND Haken – Schlange und Rückstand sehen nur den Haken, die Matrix ⊘.
  Wer `nichtVorbei` liest, nimmt istNichtVorbei/nvSchluessel (nie selbst zusammensetzen). Eine Zeile ohne `n` hebt es
  auf, auch eine leere Korrektur – das Gerät schickt sie dafür auch ohne geänderte Werte (erfassen.ts korrigiere).
  Nie in sichtOeffentlich/sichtZuschauer/Freigabe-Sicht (F17, sicht.test.ts).
- Steg je Teil: Status/Pausen (WkrListe.teile) und Abschluss (`punkt|teil`) – nie `wkr.abschluss[liste][punkt]` direkt
  lesen, immer über abschluss.ts; WKR_LISTE mit `teil` nur Status, nur bei vorhandenem Eintrag.

## Tests

`npx vitest run src/wkr src/geraete/uebung src/GeraetWkr src/views/BetriebWkr src/GeraetKoppeln src/views/SettingsView src/geraete/aufgaben src/geraete/wkrGruppen src/state/reducer/wkr src/state/migrate src/persistenz/backup src/lib/verlauf src/lib/eingaben`.
Hilfe: testHilfen.ts wkrBetriebsStand (DM, festgeschrieben, Lauf 1 auf beiden Parcours begonnen).
