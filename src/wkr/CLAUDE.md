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
**Antworten 21.11.2026 abends** (Fragenseite Runden 3–6): G–T bestätigt bis auf G1, G3, G6, G11, G13, G15, J1–J3,
K7, L3, L4, M5, N4 (Teil), N8, P9/U2, P10/Q2, T9 und die Form von P16/R (künftig Disq. J) – je Eintrag in annahmen.ts
vermerkt, noch nicht umgebaut (docs/entscheidungen.md „Antworten 21.11.2026 abends (Runden 3–6)“). Umgebaut 21.11.2026
(Plan docs/plan-antworten-runde3-6.md §3, AM1–AM10 noch zu bestätigen): **Parcours-Ampel** (P-03/P-04, ersetzt N8 für
Steg/Vorsteg), „Mehr → Liste abschließen“ entfernt (W3-40, L3), Rückfrage beim Abschluss im laufenden Lauf (R6-10, T9).
Umgebaut 21.11.2026 (Plan §4, BZ1–BZ5 noch zu bestätigen): **Bojenzelle mit Punkten und Disq.-Buchstabe** (W4-12,
ersetzt U2/P9): „5J“, DISQ auf Bojen-Listen fragt immer erst die Boje. Umgebaut 21.11.2026 (Plan §5, GF1–GF11 noch
zu bestätigen): **Gerät-Feinschliff** – Ansicht „Wie Gerät“, Codes anderer Klassen ausgegraut (YAML `abKlasse`),
Steg-Reiter immer mit ✓/Zahl, Übung mit Erklärung und „Übung beenden“, „So lassen“ an den Bedienrechner
(WKR_SO_LASSEN), erste Liste ohne Neuladen, Geräteart beim Koppeln, bis vier Listen (Pad quer nebeneinander), Freigabe
nie vorgewählt, Klassenwechsel-Band nur beim ersten Start + Parcours-Zeichnung, „nicht vorbeigekommen“ = Disq. J.
Umgebaut 21.11.2026 (Plan §6, WN1–WN3 noch zu bestätigen): **WKR-Name aus der Einteilung** (W3-13, ersetzt G11/L4) –
Sicht der eigenen Liste trägt `wkrName`, Gerät ändert unter „Mehr → Name“, Bedienrechner zeigt Abweichungen.
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
  rueckgaengigMs 6000, zuletztLeiste 5, uebungQuittungMs 300, uebungRueckfrageBei 5, uebungStarts 20, uebungTaktSek 30
  (seit 21.11.2026 nur Rückfall, Y1–Y3 Übungstakt 2–6 s nach dem Abschicken);
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
  seitenNachBlick, disqNieInBoje (seit 21.11.2026 `false`, ersetzt durch U1), probeMeisteZeilen, uebungBojen, bojenFehlerfrei, bojenTexteWieBogen, bojenInSicht;
  W4.2 bojenStartnr80 (P17) und beim Bau Q1–Q7: probeLinkerKnopf, klassenWechselUnterKarte, zaehlerMaxImKnopf, wegJeStart,
  bojenBeschriftung, wegKopfOhneUmschalter, uebungListenDesRegelwerks. W4.3 (P16, beim Bau R1–R8, noch zu bestätigen):
  nichtVorbei, nichtVorbeiNichtBeiX (R1, Code `nv-nicht-erlaubt`), nichtVorbeiNurDirekt (R2), nichtVorbeiAufheben (R3),
  nichtVorbeiZelle (R4), nichtVorbeiImAbschluss (R5), nichtVorbeiMehr (R6), nichtVorbeiVerlauf (R7), nichtVorbeiUebung (R8).
  Prüfbefunde W4 (S1–S5, 21.11.2026, noch zu bestätigen): bojenSchalterPrellMs 400, pruefenNurLaufenderPunkt,
  unbekanntBandKurz, zaehlerStandZweiZeilen, hinweisUeberKopf.
  Nutzer 21.11.2026 (T1–T9, noch zu bestätigen): Steg-Zeitversatz stegAblegenVorab (Ablegen sieht „Am Steg“ vorab,
  min. 1), stegAnlegenNachlaufend (Start im Boot nie im Anlegen; Punkt ohne ausstehenden Start = zurück; das Anlegen des
  Starts auf der Tafel zählt nie im Rückstand), stegGanzAblegenZuerst
  (Gerät ganz: Anlegen wartet aufs Ablegen), stegAnlegenNieGeschaetzt, stegAbschlussOhneImBoot; Abmelden am Gerät
  abmeldenWieEntfernen (Liste/Teil abgemeldet + Aufgabe weg), abmeldenLetzterGanz (letztes Gerät → ganze Liste; sonst nur, was kein anderes Gerät abdeckt),
  abmeldenOhneBitte, abmeldenUebungWieBisher; T10 padSpalteBisW5 (breite Bildschirme: Handy-Maske als Spalte bis W5).
  Nutzer 21.11.2026 (noch zu bestätigen): Disq. an der Boje U1 disqAnBoje, U2 disqBojeMitPunkten (seit W4-12 statt
  disqBojeErsetztPunkte), U3 disqBojeOhneLangdruck (Frage), U4 probeDisqAnBoje; W4-12 (BZ1–BZ5): bojenZelle,
  xNieMitPunkten, punkteNebenDisq, disqFragtBoje, papierGegenGeraetAbweichend; Ansicht „Wie der Parcours liegt“ V1 bojenNachLage, V2 bojenSpiegeln.
  Druck nach Modus Z1–Z7 (noch zu bestätigen): druckOhneDigital, druckBeiPause, druckStegJeTeil, druckRueckfall,
  druckLaufzettel, druckOhneListeImmer, druckParallelJeRacecourse (wkr/druck.ts).
  Parcours-Ampel (21.11.2026, AM1–AM5, AM9, AM10, R6-10): parcoursListeAnFeldern, zeitKeineParcoursListe,
  ampelAusOhneDigital, rotDurchErsteZeile, nachfrageNurParcours (nachfrageAbEinem → false), ampelInDerKarte,
  abschlussNurBand (abschlussPunktWahl → false), abschlussFragtWennLaufLaeuft; Auto-Modus AM6–AM8 in BETRIEB_ANNAHMEN.
  Gerät-Feinschliff (21.11.2026, GF1–GF11): wieGeraetVorgabe (sonneVorgabe → false), codesNachKlasse
  (codesAlleKlassen → false), stegReiterImmer, uebungErklaert, soLassenAmBedienrechner (soLassenNurLokal → false),
  ersteListeOhneNeuladen, artBeimKoppeln (handyNachName → false), listenEmpfehlung (handyEineListe → false),
  klassenWechselNurErster, nichtVorbeiAlsJ (GF10/GF11); freigabeVorwahlOhneListe → false (W3-26).
  WKR-Namen (21.11.2026, WN1–WN3): nameNurBeimAbschluss → false, wkrNameNurEigeneListe, wkrNameImLebenszeichen,
  wkrNameOhneEinteilung (G12/L4 bleiben Rückfall ohne Einteilung).
- `ampel.ts` (Parcours-Ampel, Nutzer 21.11.2026 P-03) – parcoursAmpel(stand, konfig, bereich, lagen) → AmpelLage {ampel
  aus|gruen|rot|frei, ref, perKnopf, offen (Titel), autoMoeglich, autoOhne}: aus ohne gezeigten Start oder ohne digitale
  aktive Parcours-Liste; grün = nicht durch; rot = durch (lage.ts durchfahrtVon) und eine digitale aktive Parcours-Liste
  mit Rückstand; frei sonst. autoSchritt(AutoEingang) → {ref, vorher} | null (rein; der Host zählt herunter und schickt).
  ampelImStand (WeakMap je Stand, ohne Geräte – für die Listen-Sicht), laufLage (R6-10: laufender Punkt mit freien
  Starts, Start im Boot, Ampel grün/rot oder – mit `nochAufListe` aus sicht.ts – gezeigter Start, den die Liste noch
  nicht erledigt hat: letzter Start auf dem Weg zum Anlegen, Prüfbefund 21.11.2026 → {punkt, unterwegs, offen}).
- `druck.ts` (Nutzer 21.11.2026, Druck nach Modus, WKR_ANNAHMEN Z1–Z7) – nurDigital(bogen, wkr, konfig, abdeckung?),
  teileNachDruck → {gedruckt, digital}: nur Modus `digital`, Status aktiv, am Steg beide Teile aktiv und – wenn das Register
  Geräte kennt – beide Teile abgedeckt (TeilAbdeckung von außen, geraete/register.ts abgedeckteTeile); Knoten (listeVonBogen
  null) immer gedruckt. Nutzer: components/wkrDruck.ts (WkrListen, ParallelWkrListen, Laufzettel, ParallelLaufzettel).
- `bojen.ts` (W4.1, 21.11.2026) – rein, ohne Konfiguration: bojenHalt(kennung) → {halt, weg, seite, folge, zaehler,
  durchfahrt?} aus config/kurzform.ts FAHRWEG bzw. PARALLEL_FAHRWEG (= Spalten von parallelparcours, Test); Tor 5 =
  Zähler, t1c = `durchfahrt: 2`, Speedbojen ohne Seite auf dem Rückweg, Parallel bis Boje 5 Hinweg; Knoten und
  Unbekanntes → null (P1). katalogFolge(kennung): katalog:tor5 zwischen Tor 5 hin/rück (hin), katalog:mueb nach t1b (rück).
  Nutzer 21.11.2026 (V1): BOJEN_LAGE/bojenLage(halt bzw. `katalog:…`) = Platz längs der Strecke (Start/Ziel 0,
  Schikane/MüB 1, Tor 1–5 2–6, Speedbojen 7; Parallel Start/Ziel 0, Boje 1–5 1–5), hin und rück gleich – belegt an den
  x-Koordinaten der Parcours-Bilder (bojen.test.ts misst alle Bilder nach). Lagequelle auch für das Bild-Layout W5.
- `liste.ts` – ListenKennung `JSON.stringify(['l', bereich, typeId, racecourse|null])`, listenKennung/liesListe,
  listenDerVeranstaltung (Bereiche × Listen mit Lauf, Parallel × A/B), istParcoursListe (AM1: Lauf, nicht geteilt, nicht
  einmalJeStarter, ein Feld außer Zeit/Summe – Test über alle Aufbauten in ampel.test.ts), teileVon/teilVonZelle, istHaken/teilHaken
  (aus lib/eingaben.ts), startAufListe (Starter, Lauf-Schlüssel, `weitere` am Vorsteg mit „Versuche nacheinander“, Punkt;
  Parallel: eigene Seite aus `fest.starts`); W2: listeVonBogen(bogen, konfig) (Bogen der Erfassung → Liste; Knoten → null).
- `zeile.ts` – GeraeteZeile (Leitung: z, s, t?, k?, seite?, c: [feld, wert, vorher][], W4.3 n?: true), ZeilenFehler,
  pruefeZeile → WkrZeile (types/wkr.ts) | {fehler}; wertGilt = dieselben Sanierer wie ErfassungTabelle.vue, ein Wert
  gilt nur unverändert. WkrZeile trägt `teil` (eigener Teil der Zeile). W4.3: `n` nur mit leerem `c` (sonst
  `wert-ungueltig`), nie wo X gilt (Vorsteg, Steg-Ablegen bzw. ganzer Steg → `nv-nicht-erlaubt`) → WkrZeile.nichtVorbei.
- `nichtVorbei.ts` (W4.3, 21.11.2026) – „Nicht vorbeigekommen“ im Stand (WkrStand.nichtVorbei, je Liste Schlüssel):
  nvSchluessel(lauf, starter, teil?) = `${lauf}|${starter}` bzw. `…|an`, liesNvSchluessel, istNichtVorbei,
  mitNichtVorbei (setzen/löschen, gleiche Referenz), seit 21.11.2026 (W3-17, GF10) NICHT_VORBEI_DISQ = 'J' und
  nichtVorbeiArt(disqCodes) → 'disq' (Gerät schickt Disq. J ins Disq.-Feld, eine gewöhnliche Zeile) | 'kennzeichen'
  (⊘, wo die Liste kein J kennt: Steg-Anlegen), ohneUeberholteNichtVorbei(stand, konfig) – hebt Kennzeichen auf,
  deren Zelle eigene Werte der Liste hat (am Steg nur Felder des Anlegens); ruft reducer.ts nach jeder Änderung der
  Eingaben.
- `schlange.ts` – schlange(stand, liste, teil?) (gezeigt ab `seit`, ohne Pausen/P der Liste UND des Teils, ohne Starts
  aus „Rest auf Papier“ und abgeschlossene Punkte, ohne Haken, X fällt weg, Klasse ohne Liste nur als letzter gezeigter
  `entfaellt`, Vorsteg + nächste freie `vorab`; geteilte Liste ohne Teil: Start, solange EIN Teil ihn braucht,
  `teileOffen`), danach, papierStarts(stand, liste, teil?), naechsteFreie; `leser` (auch für lage.ts: X, Haken).
  Steg-Zeitversatz (Nutzer 21.11.2026, T1/T2): vorabStarts(stand, liste) (Vorsteg: Am+Vor Steg; Steg: „Am Steg“, nur
  Teil Ablegen), hatVorab(typeId), imBoot(stand, bereich) (zuletzt gezeigt, solange in seinem Punkt noch ein Start aussteht:
  frei, zurückgestellt, „Boot fehlt“, nachzuholen); das Anlegen nimmt weder vorab noch den Start im Boot; Option
  `{ nachlaufend: false }` für lage.ts und P (Pause, Abmelden, „Papier ab“ im Reducer – das Anlegen im Boot geht mit
  aufs Papier, Prüfbefund 21.11.2026).
- `abschluss.ts` (Prüfbefunde 21.11.2026) – Abschluss-Schlüssel `punkt` bzw. `punkt|ab`/`punkt|an` (abschlussSchluessel,
  liesAbschlussSchluessel), abschlussVon, istAbgeschlossen (Teil: ganz oder Teil; ohne Teil: ganz oder beide Teile),
  zeileAbgeschlossen (ganze Zeile einer geteilten Liste schon bei EINEM Teil), abgeschlossenePunkte, abschlussPapier,
  punktVonRef, punktBegonnen (Abschluss nur für begonnene Punkte – Reducer UND erlaubteWkr); W2: abschluesseVon (alle
  Abschlüsse einer Liste mit Punkt/Teil).
- `uebernahme.ts` – wendeZeileAn (gleich → nichts, vorher → setzen, sonst Konflikt; `vereinige`: Disq. vereinigt,
  Wegfall = Konflikt `entfernt`, Bemerkung mit „; “), vereinigeDisq, haengeAn, vereinigt (Ziel einer gemeinsamen
  Zelle bei Entscheid für das Gerät – Rückfrage `start` mit `vereinige: {vorher}`), zeilenPruefsumme (FNV-1a).
- `sicht.ts` (W1.2) – sichtListe(stand, konfig, liste, extra) → ListenSicht (LISTEN_SICHT_FASSUNG = 8; 8 seit den
  WKR-Namen 21.11.2026: `wkrName` = Name der EIGENEN Liste aus AppState.einteilung (einteilungsName(stand, liste),
  einteilungsParcours(liste) = Parcours bzw. RACECOURSE_PARCOURS – auch für SET_WKR_NAME am Bedienrechner; fehlt ohne
  Eintrag, WN1/WN3); 7 seit dem
  Gerät-Feinschliff 21.11.2026: Katalog-Eintrag `aus` (Code gilt in der Klasse nicht, config/catalog.ts codeKlassenOf,
  GF2) und je Klasse `bild` {datei, dim, aus, drehung} (Parcours-Zeichnung wie das Bild des Bogens; maskenJeKlasse mit
  `aufbauId`, GF9); 6 seit der
  Parcours-Ampel 21.11.2026: `ampel` {key, ampel} nur an Parcours-Listen (AM9), `laeuft` {punkt, unterwegs, offen}
  (R6-10), ListenStart.`punkt` (Prüfansicht des Bands nach Beginn des nächsten Laufs, W3-40); 5 seit W4.3
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
  Nutzer 21.11.2026: MaskenBoje.disq (Buchstaben DIESER Zelle aus MaskenFeld.disq, Texte ggf. `andere`),
  Entwurf.bojenDisq + tippeBojenDisq(e, boje, code|null) (U1: setzt/ersetzt/nimmt heraus, Merker `#bdisq:`; seit
  W4-12 bleiben die Berührungen, tippeBoje nimmt weiter Tipps), disqAnBojen (Fuß), zellenAus `${punkte}${buchstabe}`
  („5G“), entwurfAus über bojenWert (Punkte → Berührungen UND Buchstabe → bojenDisq), eintraege/eintraegeAuf zählen
  ihn, punkteVon zählt die Punkte auch neben ihm (BZ3);
  nachLage(aufbau, startOben) → LageGruppe {lage, titel („Start / Ziel“), titelJeZeile, abschnitte in Fahrtfolge}
  (V1/V2, Ansicht „Wie der Parcours liegt“).
- `uebung.ts` (W3.1) – Übung ohne AppState/Store/Netz: uebungsStand(regelwerk, typeId, sprache?, gezeigt = 2) → UebungsStand
  {naechster, offen je Teil}, uebungsSicht(stand) → ListenSicht (Starts 1–20 ohne Namen und ohne Boot in den Klassen
  mit der Liste, Kennung `["m","u<n>",lauf]`, Vorsteg 2 `vorab`, Steg-Ablegen 1 `vorab` und Anlegen erst nach dem
  zuletzt gezeigten (T1/T2), nach Nr. 20 der nächste Lauf), uebungsSchritt(stand,
  zeile|null, mindestens = 2) (Zeile erledigt Start bzw. Teil und füllt bis `mindestens` auf – der Gerätekern gibt 0,
  Übungstakt Y1–Y3; null zeigt den nächsten, ≤ Schlange 12). Kern: geraete/uebung.ts.
- `lage.ts` (W2.1, 21.11.2026) – erfassungsLage(stand, konfig, bereich, geraete, jetzt, starts?) → {punkt, starts
  (Spalten: gezeigte Starts des laufenden Punkts, letzte 12 bzw. alle; Vorsteg + `vorab`), listen: ListenLage (Modus,
  Status, Teile, papierAb, Geräte mit Ampel, Zellstand je Spalte, Rückstand, warnt, Rückfragen/Vorschläge, Abschlüsse
  mit Startnummern, W4.3 auch `nichtVorbei`)}; Zellstand ok/halb/offen/ueberfaellig/rueckfrage/vorschlag/entfaellt/
  papier/x/vorab/nv/spaeter (Vorrang X → Klasse ohne Liste → Rückfrage → Vorschlag → nv → Haken → Teile → Schlange; nicht in
  der Schlange = Papier; Steg: Anlegen nv + Ablegen ok → nv, sonst ½; nv ist in zeilenMarken „Papier ansehen“; Steg-
  Anlegen des Starts im Boot bzw. eines Vorab-Starts = `spaeter` „kommt noch“, kein Rückstand – T2; Vorab-Spalten je
  Liste mit hatVorab);
  ampelVon (gehoert/still/weg, ohne laufenden Punkt ruht), schlechteste; ZellLage.disq (W3-17, GF10, 21.11.2026):
  `ok` mit Buchstaben im Disq.-Feld der Liste → Matrix „✓ Disq. J“; Parcours-Ampel (21.11.2026): ListenLage.parcours,
  `warnt` nur Parcours-Listen, der gezeigte Start zählt im Rückstand einer Parcours-Liste erst ab der Durchfahrt
  (durchfahrtVon: Knopf `BereichBetrieb.durchfahrt` oder Haken/Wert/Rückfrage/Vorschlag einer Parcours-Liste, X = durch); zeilenMarken (Erfassung: `${lauf}|${starter}` →
  Zeile/Zelle „papier-ansehen“ bzw. „rueckfrage“, nur Listen digital/beides); rueckstandZeile (Zeile über „Nächster
  Start“). Geräte nur als GeraetAngabe (einfache Daten vom Host, geraete/register.ts geraetAngaben), nichts aus
  geraete/. Nutzer W2.2: components/betrieb/WkrMatrix.vue (Betrieb → WKR); W2.3: components/erfassung/ErfassungTabelle.vue
  (listeVonBogen + zeilenMarken einmal je Bogen, ◆ über geraete/wkrEingang.ts herkunftGilt).
- `freigabe.ts` (W2.4, 21.11.2026) – sichtFreigabe(bereich, lagen, warnung) → FreigabeErfassung {fv:
  FREIGABE_SICHT_FASSUNG = 2 (seit der Parcours-Ampel; sichtFreigabe(…, ampel, autoIn) mit `ampel`, `ampelRef`,
  `perKnopf`, `autoMoeglich`, `autoOhne`, `autoIn`), bereich, warnung, listen: FreigabeListe {titel, stand
  aktiv|pausiert|abgemeldet|papier, ampel|null, offen, von, bis, wartend?, rueckfragen, warnt (≥ R seit N8), parcours}}
  – Feld für Feld, leer ohne Eintrag im Bereich; liesFreigabe
  (Gerät: Form prüfen, Fremdes fällt weg). Nutzer: StartFreigabe.vue Prop `erfassung` (BetriebView rechnet sie aus
  erfassungsLage, GeraetFreigabe bekommt sie über geraete/gekoppelt.ts `freigabe`), geraete/host.ts verteileFreigabe
  (Freigabe-Gruppe je Bereich, geraete/wkrGruppen.ts gruppeDerFreigabe). Nie über ko/kz (F17).
- Nutzer außerhalb: geraete/aufgaben.ts erlaubteWkr (pruefeZeile), geraete/host.ts (sichtListe je Listen-Gruppe),
  geraete/erfassen.ts (Gerät: liest ListenSicht, rechnet zeilenPruefsumme wie WKR_ABSCHLUSS, Zahlen aus WKR_ANNAHMEN:
  buendel, zuletzt, lebenszeichenSek, nameMax). Ende zu Ende: geraete/wkr.test.ts.
- Parcours-Ampel im Betrieb (21.11.2026): BereichBetrieb.durchfahrt (types/betrieb.ts) über BETRIEB_DURCHFAHRT
  (state/reducer/betrieb.ts, Positivliste geraete/aufgaben.ts), Einstellung AnzeigeEinstellungen.wkrAuto; Auto-Modus
  zählt im Führungsfenster geraete/host.ts (pruefeAuto/feuereAuto, `auto`, `halteAuto`, Geräte-Nachricht AUTO_HALT).
- Stand: types/wkr.ts (WkrStand in AppState.wkr; WkrRueckfrage.soLassen = Zeit, W3-35/GF5), Actions state/reducer/wkr.ts (WKR_SO_LASSEN {liste, zeile}, WKR_ZEILEN, WKR_RUECKFRAGE,
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
- Parcours-Ampel: Was Parcours ist, sagt NUR istParcoursListe; grün/rot/frei nur ampel.ts (nie in Komponenten
  nachbauen). Der gezeigte Start zählt in lage.ts erst ab der Durchfahrt – Tests, die „drei offen“ erwarten, tippen
  vorher BETRIEB_DURCHFAHRT (Muster lage.test.ts drei(), freigabe.test.ts stand()). Keine Ampel auf ko/kz (AM8).
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
  dagegen folgen dem Bogen (Blick). Eine Bojenzelle bekommt vom Gerät Ziffern, dahinter höchstens einen Buchstaben aus
  MaskenBoje.disq („5G“, seit W4-12 21.11.2026, BZ1) – gelesen NUR über lib/scoring.ts bojenWert, geschrieben so, wie
  sanitizeBuoy es unverändert lässt; X nie mit Punkten (BZ2). Disq. „keine Boje“ ins Disq.-Feld (BZ4). Die Lage-Ansicht (nachLage) ordnet nur um – Felder, Zellen und Texte bleiben dieselben. Seit W4.2 zeigt WkrMaske `bojen` mit WkrBojen.vue (Probe
  auch); `spaeter` bleiben nur Zeit, Knoten und Bojen außerhalb des Fahrwegs.
- Sicht der Liste: jedes Objekt Feld für Feld neu (wie sichtZuschauer); nie Name, Herkunft, Geburtsdatum, Gewicht,
  Geschlecht, Werte (auch nicht der eigenen Liste), Summen, Wertung, WKR-Name des Abschlusses. Ausnahmen: `steht`
  (F11) – steht unter dem Gerät der Rückfrage, lesbar aber für jedes Gerät derselben Liste (EIN Gruppeninhalt,
  WKR_ANNAHMEN.rueckfrageInListe) – und `wkrName` (W3-13, WN1: nur der Name aus der Einteilung für DIESE Liste, nie
  der einer anderen, nie auf ko/kz oder in der Freigabe-Sicht). Neues Feld → Positivliste in sicht.test.ts und ggf.
  LISTEN_SICHT_FASSUNG.
- Steg-Zeitversatz (T1–T3): `vorab` gibt es seit 21.11.2026 auch am Steg, aber nur im Ablegen – wer `vorab` prüft,
  nimmt hatVorab/vorabStarts, nie WKR_ANNAHMEN.vorabListen allein. Der Start im Boot fehlt in der Anlegen-Schlange; in
  der Sicht steht das als `teile.an = true` („braucht noch nichts“, auch für Vorab- und „danach“-Starts) – das Gerät
  kann „erledigt“ und „noch nicht“ dort nicht unterscheiden (gewollt). „Nie beide zugleich“ auf einem Gerät für den
  ganzen Steg macht das Gerät (geraete/erfassen.ts, uebung.ts), nicht schlange.ts. sicht.ts `teile[t].status` nimmt
  den Status der ganzen Liste, wenn die nicht aktiv ist (Befund 21.11.2026: ganzer Steg abgemeldet, Maske zeigte weiter).
- „Nicht vorbeigekommen“ (W4.3): Kennzeichen UND Haken – Schlange und Rückstand sehen nur den Haken, die Matrix ⊘.
  Wer `nichtVorbei` liest, nimmt istNichtVorbei/nvSchluessel (nie selbst zusammensetzen). Eine Zeile ohne `n` hebt es
  auf, auch eine leere Korrektur – das Gerät schickt sie dafür auch ohne geänderte Werte (erfassen.ts korrigiere).
  Nie in sichtOeffentlich/sichtZuschauer/Freigabe-Sicht (F17, sicht.test.ts).
- Steg je Teil: Status/Pausen (WkrListe.teile) und Abschluss (`punkt|teil`) – nie `wkr.abschluss[liste][punkt]` direkt
  lesen, immer über abschluss.ts; WKR_LISTE mit `teil` nur Status, nur bei vorhandenem Eintrag.

## Tests

`npx vitest run src/wkr src/components/betrieb src/geraete/uebung src/GeraetWkr src/views/BetriebWkr src/GeraetKoppeln src/views/SettingsView src/geraete/aufgaben src/geraete/wkrGruppen src/state/reducer/wkr src/state/migrate src/persistenz/backup src/lib/verlauf src/lib/eingaben`.
Hilfe: testHilfen.ts wkrBetriebsStand (DM, festgeschrieben, Lauf 1 auf beiden Parcours begonnen).
