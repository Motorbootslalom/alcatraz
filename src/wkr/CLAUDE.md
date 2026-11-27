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
G15 ein) gebaut 21.11.2026 – seit 24.11.2026 ersetzt durch „Nicht gestartet · Disq. X“ (NG1–NG8, unten) – W4 fertig,
Feldtest offen.
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
nie vorgewählt, Klassenwechsel-Band nur beim ersten Start + Parcours-Zeichnung, „nicht vorbeigekommen“ = Disq. J
(GF10/GF11, ersetzt 24.11.2026). **Nutzer 24.11.2026**: „‚Nicht vorbeigekommen Disq J‘ ist falsch. Das meint hier eher
‚Nicht gestartet Disq X‘.“ – „Mehr → Nicht gestartet · Disq. X“ auf jeder Liste mit Disq.-Feld, ein gewöhnliches X (NG1–NG8,
NG4–NG6 bestätigt 26.11.2026); Kennzeichen ⊘ samt WkrStand.nichtVorbei, GeraeteZeile.n und wkr/nichtVorbei.ts entfernt.
Umgebaut 21.11.2026 (Plan §6, WN1–WN3 noch zu bestätigen): **WKR-Name aus der Einteilung** (W3-13, ersetzt G11/L4) –
Sicht der eigenen Liste trägt `wkrName`, Gerät ändert unter „Mehr → Name“, Bedienrechner zeigt Abweichungen.
W5 (Pad, Plan docs/plan-wkr-w5.md): W5.1 (Pad-Rahmen, mehrere Listen nebeneinander, Maskenwahl) gebaut 22.11.2026,
PD1–PD6 und MW1–MW3 noch zu bestätigen; W5.2 (Maske „Bild“) gebaut 22.11.2026, BD1–BD7 noch zu bestätigen;
W5.3 (Listen ohne Lauf, Knoten-Prüfliste) gebaut 22.11.2026, KN1–KN8 noch zu bestätigen; W5.4 (Zeit-Listen mit
Ziffernblock, „keine Zeit“) gebaut 22.11.2026, ZT1–ZT4 noch zu bestätigen; W5.5 (Tabelle für Geübte) gebaut
22.11.2026, TB1–TB5 noch zu bestätigen – W5 fertig, Feldtest offen (docs/feldtest.md „Pad (W5)“).
**Antworten 22.11.2026** (Fragenseite Runden 7–8, R7-01…52, R8-01…42): AM, BZ, U, V3, GF, WN, Z, Y, P15, PD, MW, BD, KN,
ZT, TB bestätigt (je Eintrag „Bestätigt 22.11.2026 (Frage)“) bis auf AM1/AM2 (R7-01 Zeit zählt zur Ampel – umgebaut
22.11.2026), BZ1 (R7-14
mehrere Disq. je Boje, Komma), U3 (R7-21 Langdruck – umgebaut 22.11.2026, LD1–LD4 neu), BD3 (R8-19 – umgebaut 22.11.2026, BD8–BD10 neu), BD4 (R8-20 –
umgebaut 22.11.2026), BD7 (R8-23 – umgebaut 22.11.2026), KN3 (R8-27), KN7 (R8-31),
KN8 (R8-32) (alle drei umgebaut 22.11.2026, KN9–KN11 neu), ZT3 (R8-35 – umgebaut 22.11.2026, ZT5/ZT6 neu) – „NICHT bestätigt“ im Eintrag, sonst noch nicht umgebaut (docs/entscheidungen.md „Antworten
22.11.2026 (Runden 7–8)“); Y1 bestätigt mit Zusatzwunsch (R7-45: in der Übung Klasse vorziehen – gebaut 22.11.2026,
Y4 uebungVorziehen, noch zu bestätigen). Alle Antworten der Runden 7–8 sind seit 22.11.2026 umgesetzt.
**Antworten 23.11.2026** (Runde 9, R9-01…14): bestätigt (je Eintrag „Bestätigt 23.11.2026 (Frage)“) BZ1/BZ6, BZ7, U3,
LD1–LD4, Langdruck in BD7, KN7–KN12, ZT3, ZT5, ZT6, Y4 (und BS3/BS4 der Beispieldaten); NICHT bestätigt BD8–BD10
(R9-05…07) – umgebaut 23.11.2026: Parallel.svg ist die Eine-Bahn-Ausgabe des Parcours-Repos ohne Steg, IDs von dort
(`A_Boje1` …), für Racecourse A und B dieselbe Bahn, nichts gedimmt (docs/entscheidungen.md „Antworten 23.11.2026 (Runde 9)“).
Werte gehen nur über `eingaben` (wie Abtippen), nie über den Betrieb; belegte Zellen nie still überschreiben.

## Dateien

- `annahmen.ts` – WKR_ANNAHMEN: alle Auslegungen mit Datum (Plan §9, „noch zu bestätigen“), Zahlen (Bündel 8, Schlange
  12, danach 5, zuletzt 20, Lebenszeichen 60 s), Steg-Teile nach Spalten-Key (`fehlerAB`/`fehlerAN`, gemeinsam
  `disq`/`bemerkung`), X nur Steg-Ablegen und Vorsteg (F5 – seit 24.11.2026 nur noch für X neben anderem bzw. die
  Disq.-Knöpfe, NG2/NG3), `vorabListen` (Vorsteg sieht die nächsten), Knoten seit W5.3 (`listenOhneLaufErstW5` false).
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
  bojenBeschriftung, wegKopfOhneUmschalter, uebungListenDesRegelwerks. W4.3 (P16, R1–R8; seit 24.11.2026 NICHT mehr
  gültig, alle `false`): nichtVorbei, nichtVorbeiNichtBeiX, nichtVorbeiNurDirekt, nichtVorbeiAufheben, nichtVorbeiZelle,
  nichtVorbeiImAbschluss, nichtVorbeiMehr, nichtVorbeiVerlauf, nichtVorbeiUebung. Dahinter „Nicht gestartet · Disq. X“
  (Nutzer 24.11.2026, NG1–NG8): nichtGestartetMehr (NG1), nichtGestartetUeberall (NG2), xKnoepfeNurF5 (NG3),
  nichtGestartetWirkung (NG4, Steg-Anlegen bestätigt 26.11.2026, R11-10/R11-12), nichtGestartetKorrektur (NG5, bestätigt
  26.11.2026), nichtGestartetStattKennzeichen (NG6, Werte anderer Zellen bestätigt 26.11.2026), nichtGestartetUebung (NG7),
  nichtGestartetFassung 13 (NG8).
  Prüfbefunde W4 (S1–S5, 21.11.2026, noch zu bestätigen): bojenSchalterPrellMs 400, pruefenNurLaufenderPunkt,
  unbekanntBandKurz, zaehlerStandZweiZeilen, hinweisUeberKopf.
  Nutzer 21.11.2026 (T1–T9, noch zu bestätigen): Steg-Zeitversatz stegAblegenVorab (Ablegen sieht „Am Steg“ vorab,
  min. 1), stegAnlegenNachlaufend (Start im Boot nie im Anlegen; Punkt ohne ausstehenden Start = zurück; das Anlegen des
  Starts auf der Tafel zählt nie im Rückstand), stegGanzAblegenZuerst
  (Gerät ganz: Anlegen wartet aufs Ablegen), stegAnlegenNieGeschaetzt, stegAbschlussOhneImBoot; Abmelden am Gerät
  abmeldenWieEntfernen (Liste/Teil abgemeldet + Aufgabe weg), abmeldenLetzterGanz (letztes Gerät → ganze Liste; sonst nur, was kein anderes Gerät abdeckt),
  abmeldenOhneBitte, abmeldenUebungWieBisher; T10 padSpalteBisW5 (seit W5.1 22.11.2026 `false`).
  W5.1 (22.11.2026, noch zu bestätigen): PD1 padAbKurzeSeite 600, PD2 padSpalteMinPx 480/padSpaltenMax 4/
  padHochSpaltenMax 2/padHochSpalteMinPx 360, PD3 padSeiteNurEineSpalte + seiteSchlange 5, PD4 rundenBandBeiGleichemPaar,
  PD5 attemptSperreMs 1000, PD6 bildInDerSeite, MW1 maskeVorgabePadBild, MW2 maskeWahlJeRaumUndListe, MW3 probeJeMaske.
  W5.3 (22.11.2026, noch zu bestätigen): KN1 knotenEineListe, KN2 ohneLaufStartIstStarter, KN3 ohneLaufBestand, KN4
  ohneLaufNieRueckstand, KN5 ohneLaufAbschlussGanz, KN6 knotenDarfDigital (Z6 angepasst), KN7 knotenPunkte 5, KN8
  tischOhneTakt; umgebaut 22.11.2026 (R8-27/R8-31/R8-32, noch zu bestätigen): KN3, KN7 (Merker jetzt KN10
  prueflisteRestRichtig, vorher prueflisteAlleGesetzt), KN8; neu KN9 tischVorschlag, KN11 tischRueckfrageErfasst; Prüfbefund 22.11.2026 KN12 tischVorschlagVorbelegt (leeres Feld = Vorschlag gewählt).
  W5.4 (22.11.2026, noch zu bestätigen): ZT1 zeitMaske, ZT2 zeitWieErfassung, ZT3 zeitEineZeile, ZT4 keineZeitMitGrund;
  G2/P1 nachgezogen (Zeit hat seit W5.4 eine Maske, `spaeter` nur noch Punkte). Umgebaut 22.11.2026 (R8-35): ZT3
  zeitEineZeile (Pflicht nur das erste Feld), neu ZT5 zeitNurErstesPflicht, ZT6 zeitSpringtWeiter (noch zu bestätigen).
  W5.5 (22.11.2026, noch zu bestätigen): TB1 tabelleNurPad, TB2 tabelleOhneProbe, TB3 tabelleWieErfassung, TB4
  tabelleBojenAlsPunkte, TB5 tabelleZeilen {gesendet 5, naechste 3}.
  W5.2 (22.11.2026, noch zu bestätigen): BD1 bildSeitenWieSpalten, BD2 bildSonstKnoepfe, BD3 bildParallelZeichnung (umgebaut 22.11.2026 R8-19, vorher bildParallelSchema; neu BD8–BD10, seit 23.11.2026 nach R9-05…07 umgeschrieben: BD8 bildParallelIdsAusParcoursRepo, BD9 bildParallelEineBahnFuerBeide, BD10 bildParallelNurEineBahn), BD4
  bildUmschalterNurVonHand (umgebaut 22.11.2026 R8-20, vorher bildRueckNachTor5), BD5 bildRueck2, BD6 bildTrefferMm 15,
  BD7 bildDisqKnopfUndLangdruck (umgebaut 22.11.2026 R8-23, vorher bildDisqUeberKnopf), beim Bau bildDrehungNurPad; Prüfbefunde 22.11.2026: bildDrehungNachPlatz, tastaturAendertNichts (PD1).
  Nutzer 24.11.2026: Lage des Bilds BL1 bildLageWahl (seit Prüfbefund mit „Automatisch“), BL2
  bildLageNachSteg, BL3 bildLageVorPlatz, BL4 bildTextAufrecht, BL5 bildLageOhneSchema, BL6 bildDisqOrtVorgabeFolge;
  Übung Y5 uebungVorziehenUnten, UK1 uebungKopfAusDemBild und UK3 uebungKopfZuletztBleibt (beide entfallen 26.11.2026,
  R11-14, `false`, ersetzt durch UK7 uebungErklaerungAusDemBild), UK2 uebungKopfNurEineSpalte,
  Prüfbefunde 24.11.2026: UK4 uebungKopfSeiteRechts, UK5 uebungKopfMitNaechsterKarte, UK6 uebungKopfAmTisch.
  **Antworten 26.11.2026** (Runde 11): bestätigt BL1, BL3, BL6, Y5, UK2, UK4, AG1–AG4, CM2, CM3 (ohne „D schon
  gesetzt“), CM5, CM6, CM8, NG4, NG5, NG6 (je „Bestätigt 26.11.2026 (R11-xx)“); NICHT bestätigt BL2 (R11-13 – umgebaut: BL7 bildLageNachStartZiel, Lagen
  „Start/Ziel links/oben/rechts/unten“) und UK1/UK3 (R11-14 – umgebaut: UK7 uebungErklaerungAusDemBild, der Kopf bleibt,
  nur die Erklärung rollt hinaus; UK6 ebenso); H2 „↩ Rückgängig“ (R11-30 (2), Pfeil als Zeichnung in WkrFuss).
  **Antworten 27.11.2026** (Runde 13): bestätigt NG1 (Zeitnahme und Knoten ohne „Nicht gestartet“, R13-03), CM3 „D schon
  gesetzt“ und CM4 (R13-04), BL4 (R13-14 (4)). Die veralteten „noch zu bestätigen“ an schon bestätigten Einträgen
  sind seitdem gestrichen; offen bleiben BL5 (bewusst nicht gefragt) und BL8 (beim Bau ausgelegt).
  Nutzer 21.11.2026 (noch zu bestätigen): Disq. an der Boje U1 disqAnBoje, U2 disqBojeMitPunkten (seit W4-12 statt
  disqBojeErsetztPunkte), U3 disqBojeLangdruck (umgebaut 22.11.2026 R7-21, vorher disqBojeOhneLangdruck; dazu LD1 langdruckMs 800,
  LD2 langdruckNieTipp, LD3 langdruckWegPx 10 + langdruckRingMs 300, LD4 langdruckPrellschutz – Hilfe
  components/wkr/langdruck.ts, noch zu bestätigen), U4 probeDisqAnBoje; W4-12 (BZ1–BZ5): bojenZelle,
  xNieMitPunkten, punkteNebenDisq, disqFragtBoje, papierGegenGeraetAbweichend; R7-14 (22.11.2026, BZ1 umgebaut, neu
  BZ6 bojenZelleMitKomma, BZ7 disqBojeMehrfachwahl, BZ8 bojenZelleFassung 10, noch zu bestätigen); Bojen-Folge V3 bojenFolge (22.11.2026, ersetzt V1/V2 „Wie der Parcours liegt“, entfernt).
  Druck nach Modus Z1–Z7 (noch zu bestätigen): druckOhneDigital, druckBeiPause, druckStegJeTeil, druckRueckfall,
  druckLaufzettel, druckOhneListeImmer, druckParallelJeRacecourse (wkr/druck.ts).
  Parcours-Ampel (21.11.2026, AM1–AM5, AM9, AM10, R6-10): parcoursListeAnFeldern, zeitIstParcoursListe (AM2,
  umgebaut 22.11.2026 R7-01; vorher zeitKeineParcoursListe),
  ampelAusOhneDigital, rotDurchErsteZeile, nachfrageNurParcours (nachfrageAbEinem → false), ampelInDerKarte,
  abschlussNurBand (abschlussPunktWahl → false), abschlussFragtWennLaufLaeuft; Auto-Modus AM6–AM8 in BETRIEB_ANNAHMEN.
  Gerät-Feinschliff (21.11.2026, GF1–GF11): wieGeraetVorgabe (sonneVorgabe → false), codesNachKlasse
  (codesAlleKlassen → false), stegReiterImmer, uebungErklaert, soLassenAmBedienrechner (soLassenNurLokal → false),
  ersteListeOhneNeuladen, artBeimKoppeln (handyNachName → false), listenEmpfehlung (handyEineListe → false),
  klassenWechselNurErster, nichtVorbeiAlsJ (GF10/GF11, seit 24.11.2026 `false`, NG1); freigabeVorwahlOhneListe → false (W3-26).
  WKR-Namen (21.11.2026, WN1–WN3): nameNurBeimAbschluss → false, wkrNameNurEigeneListe, wkrNameImLebenszeichen,
  wkrNameOhneEinteilung (G12/L4 bleiben Rückfall ohne Einteilung).
  Steg-Gerät mit Boot und Co-Piloten (Nutzer 27.11.2026, CP1–CP10, beim Bau ausgelegt, noch zu bestätigen; R12-09 gilt
  fürs Gerät nicht mehr, Papier-Bögen ohne): coPilotListen ['steg'], coPilotJeKlasse, coPilotNurBenannt,
  coPilotAusgleichNurKlammer, coPilotKarte (beide Teile; Folge Klasse, Lauf, AG, Boot, Co-Pilot, Ersatz klein; in der
  Korrektur eines Starts außerhalb der Schlange keine Klammer), coPilotAusgleichTeil 'ab', coPilotZeilenFrei (eigene
  Zeile über die Kartenbreite, Platz = höchster Block der Liste, CP7), coPilotUebung, coPilotFassung 14 (mit `sv` 9),
  coPilotNamenVoll (Einstellung „Namen“ gilt nicht, CP10).
  Ausgleichsgewicht am Steg (Nutzer 24.11.2026, AG1–AG4; alle bestätigt 26.11.2026, R11-05/R11-06/R11-29/R11-30): ausgleichListen ['steg']
  (Datenschutz-Ausnahme), ausgleichNurLesen (nichts am Steg pflegen, kein Haken, Nachtrag in der Verwiegung kommt von selbst),
  ausgleichTeil 'ab' (Karte nur im Ablegen; ein Gerät nur fürs Anlegen empfängt den Wert mit – eine Gruppe je Liste,
  so bestätigt), ausgleichUebung (erfundene Abstände je Startnummer in der Übung). Prüfbefund 24.11.2026 (bestätigt): auf 0 kg
  gerundet = „kein AG“, auf Papier leer (components/AusgleichListen.vue), Verwiegung weiter „0 kg“.
  Höchstzahl je Code (Nutzer 24.11.2026, CM1–CM8; CM2, CM3, CM5, CM6, CM8 bestätigt 26.11.2026, CM4 und „D schon gesetzt“ in CM3 am 27.11.2026, R13-04): codeMaxAusRegelwerk (YAML `max`/`danach`
  je Code: „2. und 3. Versuch“ 2× → D, Tor 5 Code 1 1×), codeMaxAllgemein 3 (lib/codes.ts codeHoechstens/
  codesUeberMax), codeDanachStattZaehler (maske.ts tippe), codeMaxImKnopf, codeMaxGeraet (tabelle.ts `code-zu-oft`/
  `code-danach`, zeile.ts wertGilt), codeMaxAbtippenHinweis (lib/erfassung.ts `codeZuOft`/`codeDanach`), codeMaxFassung 12,
  codeDanachPrellschutz (CM8, Prüfbefund 24.11.2026: maske.ts codeTippPrellt, Uhr in WkrMaske tippeCode).
- `tisch.ts` (22.11.2026, R8-27, KN9) – naechsterOffener(bestand, zuletzt, klasse?) (`klasse` = Übung „Klasse vorziehen“,
  Y4: erster offener dieser Klasse, sonst wie ohne) → erster offener Starter NACH `zuletzt` in der
  Folge des Bestands, Rundlauf, ohne `zuletzt` der erste offene, sonst null; tischOffen (nicht erledigt UND ohne eigene
  Zeile `z` – die Quittung kann nachlaufen). Rein, generisch über {key, erledigt, z?} (geraete/erfassen.ts
  BestandEintrag passt). Nutzer: components/wkr/WkrPruefliste.vue („zuletzt“ = quelle.zuletzt, gerätelokal). Test
  tisch.test.ts (Beispiel des Nutzers 8 → 9, 10 → 11, 9 → 11).
- `anordnung.ts` (W5.1, 22.11.2026, PD1–PD3) – anordnung({breite, hoehe, typ, listen, teile}) → {art handy|padQuer|
  padHoch, spalten: Spalte {liste, teil?}[], reiter (Listen, die sich die LETZTE Spalte teilen; erste = Vorgabe), seite
  rechts|unten|null}; anordnungsArt (Art der Kopplung vor der Fenstergröße, Rechner = Pad, ohne Art kürzere Seite ≥ 600),
  spaltenPlatz (quer floor(B/480) ≤ 4, hoch floor(B/360) ≤ 2). `teile` = ganzer Steg: auf dem Pad Ablegen + Anlegen als
  zwei Spalten, nur wenn ALLE Listen samt Teilen passen. Geräteart als eigener Typ (nichts aus geraete/). Nutzer:
  components/wkr/WkrGeraet.vue; Test anordnung.test.ts (Tabelle Breite × Höhe × Art × Listen), styles/wkr-geraet.test.ts
  (Breite je Spalte ≥ 336 px bei 768×1024, 1024×768, 1366×1024).
- `maskenWahl.ts` (W5.1, F14, MW1) – MaskenWahl knoepfe|bild|text (= geraete/aufgaben.ts MASKEN_VORGABEN, Test),
  MASKEN_GEBAUT (bild seit W5.2, text seit W5.5 `true`), erlaubteMasken({bojen, zeit?}) (Bild nur Bojen-Listen; reine
  Zeit-Liste nur `knoepfe` = feste Art), maskeAufGeraet(m, pad) (TB1: Tabelle nur Pad/Rechner),
  vorgabeMaske({bojen, pad}) (Pad + Bojen → Bild, nie Tabelle), wirksameMaske(liste, {vorgabe, fest, wahl}) (fest vor
  Wahl vor Vorgabe, nur Erlaubtes und auf dem Gerät Mögliches, nicht Gebautes → Knöpfe). Nutzer: WkrGeraet (Gerät,
  `aus` = ausgegraut), GeraeteListe.vue (Bedienrechner), WkrUebung.
- `tabelle.ts` (W5.5, 22.11.2026, TB3/TB4; Bojen seit R7-14 mit mehreren Buchstaben, `zeichen-fremd` nur für
  unerlaubte) – Maske „Tabelle“, rein: tabellenSpalten(sicht, klasse, aufbau, teil,
  sprache) → TabellenSpalte {feld, art boje|code|disq|zeit|text, titel, unter, teil?} (Folge und Köpfe wie der Bogen,
  nur Felder, die zellenAus des Teils trägt), kopfGruppen (zweizeiliger Kopf), zelleAusEingabe(spalte, eingabe, aufbau,
  teil) → {wert, fehler} über DIESELBEN Sanierer wie ErfassungTabelle (sanitizeBuoy, sanitizeCodeInput +
  normalizeCodeCell, sanitizeDisq, sanitizeTimeInput; Buchstaben aus dem Aufbau), TabellenFehler zeichen-fremd |
  code-unbekannt | boje-punkte | zeit-unlesbar | zu-lang | nicht-darstellbar | code-zu-oft | code-danach (24.11.2026,
  CM5: mehr als `max`, bei Codes mit `danach` „3x20“ – die Tabelle wandelt nicht in D um), zeileAusEingaben (Rund-Probe:
  entwurfAus → zellenAus muss die Zellen ergeben; Entwurf aus den fehlerfreien Zellen, „keine Zeit“ für leere
  Zeitfelder bleibt), eingabenAus(spalten, entwurf, …). Nutzer: components/wkr/WkrTabelle.vue, WkrMaske. Test
  tabelle.test.ts (jede Spalte jeder Liste mit Maske, DM + UIM, je Klasse und Teil: gültige Eingaben → wertGilt
  unverändert und genau diese Zellen hinaus).
- `bild.ts` (W5.2, 22.11.2026, BD1–BD6) – Maske „Bild“, rein: BILD_BOJEN (SVG-ID der Klassen-SVGs → {halt, seite};
  innen/außen über config/kurzform.ts bildBojeId = dieselbe Regel wie die Unterspalten/`boje.spalte`, BD1), bildIdVon(feld)
  (nur Kennungen mit Richtung bzw. Speedbojen; `start|seiteA` ist Parallel); Parallelslalom seit 22.11.2026 (R8-19,
  BD3), seit 23.11.2026 eine Bahn (R9-05…07, BD8–BD10): PARALLEL_BILD (Parallel.svg, Drehung 0, nichts gedimmt),
  parallelBildId(feld) → `A_Boje<n>` bzw. `A_StartZiel_unten` (seiteA) / `_oben` (seiteB) – OHNE Racecourse, A und B
  treffen dieselbe Bahn, der Racecourse kommt aus der Liste (`racecourse` der Zuordnung); `blass` leer;
  schemaParallel(rc) (Start/Ziel unten, 1–4, 5 Wende, für A und B gleich) + schemaIdVon nur noch Rückfall ohne
  vollständige Parallel.svg; bildZuordnung(aufbau, {bild,
  racecourse, svg}) / bildTreffer(sicht, klasse, svgVon – ohne Bild der Klasse holt es PARALLEL_DATEI) → {art
  svg|schema, treffer feld→id, ids, blass, racecourse?} | null (BD2: ID fehlt oder nicht genau einmal → Knöpfe;
  Stand 22.11.2026 nur Klasse7_Moewe ohne Speedboje_unten), probeBild, BildWeg hin|rueck|rueck2 (BD5), bildWege,
  bildZiel(aufbau, z, id, weg) (eine Boje an der ID → diese, sonst nach Weg; der Umschalter wechselt nur von Hand –
  wegNachTipp entfiel 22.11.2026, BD4/R8-20), bildZahlen, inlineSvg (IDs mit Präfix, Drehung über viewBox + `<g>`, Deckkraft als `style` am
  Element – kein `<style>`-Block), schiebeAuseinander (BD6), svgSeiten + wirksameDrehung (±90° nur, wo die gedrehte
  Zeichnung im Platz nicht kleiner wird, Prüfbefund 22.11.2026; seit 24.11.2026 `wahl` des WKR geht vor, BL3).
  Lage (Nutzer 24.11.2026, BL1–BL5, BL7 26.11.2026): BildLage 0|90|180|270 (im Uhrzeigersinn), BILD_LAGEN,
  BILD_LAGE_SEITE {start, wende} (Datei = Start/Ziel links, Tor 5/Boje 5 rechts – Test bild.test.ts „BL7 an den echten
  Zeichnungen“; Namen nach Start/Ziel, nie nach dem Steg), istBildLage, lageVonDrehung, aufrechtTransform (Gegendrehung je
  `<text>`, BL4). Entwurf/Zellen NUR über maske.ts (maske.test.ts: gleiche
  Tipps im Bild und in den Knöpfen → gleiche Zellen). Nutzer: components/wkr/WkrBild.vue, WkrMaske, WkrProbe, WkrGeraet.
- `ampel.ts` (Parcours-Ampel, Nutzer 21.11.2026 P-03) – parcoursAmpel(stand, konfig, bereich, lagen) → AmpelLage {ampel
  aus|gruen|rot|frei, ref, perKnopf, offen (Titel), autoMoeglich, autoOhne}: aus ohne gezeigten Start oder ohne digitale
  aktive Parcours-Liste; grün = nicht durch; rot = durch (lage.ts durchfahrtVon) und eine digitale aktive Parcours-Liste
  mit Rückstand; frei sonst. autoSchritt(AutoEingang) → {ref, vorher} | null (rein; der Host zählt herunter und schickt).
  ampelImStand (WeakMap je Stand, ohne Geräte – für die Listen-Sicht), laufLage (R6-10: laufender Punkt mit freien
  Starts, Start im Boot, Ampel grün/rot oder – mit `nochAufListe` aus sicht.ts – gezeigter Start, den die Liste noch
  nicht erledigt hat: letzter Start auf dem Weg zum Anlegen, Prüfbefund 21.11.2026 → {punkt, unterwegs, offen}).
- `druck.ts` (Nutzer 21.11.2026, Druck nach Modus, WKR_ANNAHMEN Z1–Z7) – nurDigital(bogen, wkr, konfig, abdeckung?),
  teileNachDruck → {gedruckt, digital}: nur Modus `digital`, Status aktiv, am Steg beide Teile aktiv und – wenn das Register
  Geräte kennt – beide Teile abgedeckt (TeilAbdeckung von außen, geraete/register.ts abgedeckteTeile); Bögen ohne Liste
  (listeVonBogen null) immer gedruckt; Knoten seit W5.3 über die Liste am Tisch wie jede andere (KN6). Nutzer: components/wkrDruck.ts (WkrListen, ParallelWkrListen, Laufzettel, ParallelLaufzettel).
- `bojen.ts` (W4.1, 21.11.2026) – rein, ohne Konfiguration: bojenHalt(kennung) → {halt, weg, seite, folge, zaehler,
  durchfahrt?} aus config/kurzform.ts FAHRWEG bzw. PARALLEL_FAHRWEG (= Spalten von parallelparcours, Test); Tor 5 =
  Zähler, t1c = `durchfahrt: 2`, Speedbojen ohne Seite auf dem Rückweg, Parallel bis Boje 5 Hinweg; Knoten und
  Unbekanntes → null (P1). katalogFolge(kennung): katalog:tor5 zwischen Tor 5 hin/rück (hin), katalog:mueb nach t1b (rück).
- `liste.ts` – ListenKennung `JSON.stringify(['l', bereich, typeId, racecourse|null])`, listenKennung/liesListe,
  listenDerVeranstaltung (Bereiche × Listen mit Lauf, Parallel × A/B; seit W5.3 dahinter je Liste ohne Lauf EINE im
  Bereich TISCH_BEREICH `tisch`, auch ohne Bereich des Betriebs), W5.3: istTischListe, istOhneLauf, ohneLaufKennung/
  liesOhneLauf (`["o", starterId]`), OhneLaufRef, liesStartKennung(key, liesRef), bestandOhneLauf (Starter der Klassen
  mit der Liste, nicht abgemeldet), startAufListe nimmt `{art:'o'}` (nur am Tisch; Lauf `<disziplin>/0`, Punkt `ohne`), istParcoursListe (AM1: Lauf, nicht geteilt, nicht
  einmalJeStarter, ein Feld außer Summe – seit 22.11.2026 (R7-01, AM2) zählen reine Zeit-Listen mit; Test über alle
  Aufbauten in ampel.test.ts; Knoten nie), teileVon/teilVonZelle, istHaken/teilHaken
  (aus lib/eingaben.ts), startAufListe (Starter, Lauf-Schlüssel, `weitere` am Vorsteg mit „Versuche nacheinander“, Punkt;
  Parallel: eigene Seite aus `fest.starts`); W2: listeVonBogen(bogen, konfig) (Bogen der Erfassung → Liste; Knoten →
  die Liste am Tisch, gleich welcher Parcours; unbekannte Position → null).
- `zeile.ts` – GeraeteZeile (Leitung: z, s, t?, k?, seite?, c: [feld, wert, vorher][]), ZeilenFehler,
  pruefeZeile → WkrZeile (types/wkr.ts) | {fehler}; wertGilt = dieselben Sanierer wie ErfassungTabelle.vue, ein Wert
  gilt nur unverändert. WkrZeile trägt `teil` (eigener Teil der Zeile). X: neben anderem bzw. in Bojen-/Code-Zellen nur
  Steg-Ablegen/Vorsteg (F5, sonst `x-nicht-erlaubt`); allein im Disq.-Feld (Feldart `disq`) mit sonst leeren Zellen =
  „Nicht gestartet“ auf jeder Liste und in jedem Steg-Teil (24.11.2026, NG2; `nv-nicht-erlaubt` und `n` entfielen) –
  am Steg OHNE `vereinige` (Prüfbefund 24.11.2026, NG6: ein Buchstabe des anderen Teils wird Rückfrage, nie „A, X“).
  W5.3: am Tisch nur `["o", id]` (sonst `start-unbekannt`, auch umgekehrt), ohne Folge/Zeigen, `gezeigt` immer.
  W5.4 (22.11.2026, ZT4): GeraeteZeile.`kz` [feld, grund][] (Form: bekannter Grund, sonst `wert-ungueltig`;
  kein Zeitfeld der Klasse oder doppelt → `feld-fremd`; Zeit UND Grund im selben Feld → `wert-ungueltig`) →
  WkrZeile.keineZeit (steht `kz`, auch leer, ersetzt es das Kennzeichen des Starts; fehlt es, bleibt das stehende).
- (`nichtVorbei.ts`, W4.3 – „nicht vorbeigekommen“ im Stand, Schlüssel, Disq. J – entfernt 24.11.2026, NG6; den
  Zellschlüssel `${lauf}|${starter}` von „keine Zeit“ hält seitdem keineZeit.ts kzSchluessel.)
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
  Abschlüsse einer Liste mit Punkt/Teil). W5.3: OHNE_PUNKT `ohne` (Typ WkrPunkt = PunktId | 'ohne', types/wkr.ts),
  istWkrPunkt, wkrPunktVonRef (`["o", …]` → `ohne`); alle Schlüssel-Funktionen nehmen WkrPunkt.
- `uebernahme.ts` – wendeZeileAn (gleich → nichts, vorher → setzen, sonst Konflikt; `vereinige`: Disq. vereinigt,
  Wegfall = Konflikt `entfernt`, Bemerkung mit „; “; X kommt nie still neben andere Buchstaben → Konflikt `zelle`,
  Prüfbefund 24.11.2026, NG6/BZ2), vereinigeDisq, haengeAn, vereinigt (Ziel einer gemeinsamen
  Zelle bei Entscheid für das Gerät – Rückfrage `start` mit `vereinige: {vorher}`; mischte es X mit Buchstaben, gilt
  der Wert des Geräts), zeilenPruefsumme (FNV-1a).
- `sicht.ts` (W1.2) – sichtListe(stand, konfig, liste, extra) → ListenSicht (LISTEN_SICHT_FASSUNG = 14 seit den
  Co-Piloten am Steg 27.11.2026, CP9 – mit `sv` 9, weil nur `sv` alte Geräte neu laden lässt: `coPiloten` je Klasse an der Steg-Liste, ListenCoPilot {rolle, coPilot,
  ausgleich?}, coPilotenJeKlasse(stand, klassen) auch für die Übung; 13 seit „Nicht
  gestartet · Disq. X“ 24.11.2026, NG8 – Form gleich, alte Geräte schickten `n` bzw. J; 12 seit der Höchstzahl
  je Code 24.11.2026, CM7: MaskenFeld.katalog `max` (aufgelöst) und `danach` (nur, wo das Feld den Buchstaben annimmt);
  11 seit dem Ausgleichsgewicht; 10 seit mehreren
  Disq. je Bojenzelle 22.11.2026, BZ8 – Form gleich, nur die Zellform „5, J, D“; 8 seit den
  WKR-Namen 21.11.2026: `wkrName` = Name der EIGENEN Liste aus AppState.einteilung (einteilungsName(stand, liste),
  einteilungsParcours(liste) = Parcours bzw. RACECOURSE_PARCOURS – auch für SET_WKR_NAME am Bedienrechner; fehlt ohne
  Eintrag, WN1/WN3); 7 seit dem
  Gerät-Feinschliff 21.11.2026: Katalog-Eintrag `aus` (Code gilt in der Klasse nicht, config/catalog.ts codeKlassenOf,
  GF2) und je Klasse `bild` {datei, dim, aus, drehung} (Parcours-Zeichnung wie das Bild des Bogens; maskenJeKlasse mit
  `aufbauId`, GF9); 6 seit der
  Parcours-Ampel 21.11.2026: `ampel` {key, ampel} nur an Parcours-Listen (AM9), `laeuft` {punkt, unterwegs, offen}
  (R6-10), ListenStart.`punkt` (Prüfansicht des Bands nach Beginn des nächsten Laufs, W3-40); 5 seit W4.3
  „Nicht vorbeigekommen“ (entfernt 24.11.2026) – Form gleich, nur damit alte Geräte/Bedienrechner nicht mischen; 4 seit W4.1:
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
  Fassung 9 seit W5.3 (22.11.2026, KN3): an der Liste am Tisch `bestand` (ListenBestand {key, startNr, klasse,
  erledigt = Haken}) und `offen` {n, m}, `punkt` {id: 'ohne', titel „Alle Starter“}, Bereich „Am Tisch“ (BogenTexte
  `tisch`/`alleStarter`), Schlange/danach leer, nie `ampel`/`laeuft`; einteilungsName am Tisch: `tisch`, sonst erster
  eingetragener Name der Liste.
- `maske.ts` (W3.1, 21.11.2026) – Maske „Knöpfe“, rein: maskenArt (G2, an den Feldarten: nur code/disq/text →
  katalog bzw. vorsteg, sonst spaeter), maskeFuer(sicht, klasse, 'liste'|'andere') → MaskenAufbau {art, titel, teile
  (Code-Felder mit Katalog, Steg ab/an), disq {feld, teil, codes mit `nurIn` (X am Steg nur Ablegen)}, bemerkung} | null
  (entfällt), teileFuer, disqFuer(aufbau, teil?); Entwurf {codes je Feld, disq, bemerkung, folge}: leererEntwurf,
  tippe, tippeDisq (Schalter), mitBemerkung, zurueck, eintraege, punkteVon. Seit 24.11.2026 (CM1–CM4, CM8): MaskenCode
  `max` (immer) und `danach?` (nur, wo das Disq.-Feld des Teils den Buchstaben annimmt); `tippe(e, aufbau, feld, code)`
  zählt bis `max`, der Tipp danach setzt `danach` wie ein DISQ-Tipp (Merker `#disq:D`, Rückgängig nimmt ihn), sonst
  gleiche Referenz; codeAnzahl, codeStand (Knopf: zaehlt|danach|nichts, danachGesetzt), codeTippPrellt (CM8: Tipp auf
  denselben Code mit `danach` innerhalb von bojenSchalterPrellMs verwerfen; Uhr in WkrMaske); entwurfAus zählt
  höchstens bis `max`. zellenAus(e, aufbau, teil?) = Zellwerte
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
  W4-12 bleiben die Berührungen, tippeBoje nimmt weiter Tipps), disqAnBojen (Fuß), zellenAus über lib/disq.ts
  bojenZelle („5, G“), entwurfAus über bojenWert (Punkte → Berührungen UND jeder Buchstabe → bojenDisq), eintraege/
  eintraegeAuf zählen ihn, punkteVon zählt die Punkte auch neben ihm (BZ3); seit R7-14 (22.11.2026, BZ6/BZ7)
  Entwurf.bojenDisq: Record<feld, string[]> (Tippfolge), tippeBojenDisq schaltet EINEN Buchstaben an/aus (null = alle
  weg), Merker `#bdisq:<feld>=<code>` je Buchstabe („zurück“ = zuletzt gesetzter; kein Ersetzen mehr),
  bojenDisqVon(e, boje) (Katalogfolge, für Knöpfe/Stand), bojenDisqZahl (Zählungen, auch bild.ts Rück 2);
  Nutzer 22.11.2026 (V3, ersetzt „Wie der Parcours liegt“): BojenFolge gedreht (Vorgabe)|fahrt|untereinander,
  mitUmschalter(aufbau, folge), bojenAbschnitte(aufbau, folge, weg) (Rück unter `gedreht`: jedes Tor unter seinem
  Gegenstück auf Hin, Ziel unter Start; ohne Gegenstück – Speedbojen, Tor 1 der Speedrunde, MüB – direkt vor
  ihrem Vorgänger in der Fahrtfolge, also insgesamt umgekehrte Fahrtfolge, Prüfbefund 22.11.2026), bojenAbschnitteAlle (Ortswahl: Hin, dann Rück wie sein Reiter).
  W5.3 (22.11.2026, KN7): MaskenArt `pruefliste` (maskenArt(felder, ohneLauf): nur Bojen ohne Fahrweg + Text auf einer
  Liste ohne Lauf; maskeFuer erkennt sie an `sicht.bestand`, listeMitMaske an showLauf), MaskenAufbau.pruef
  (MaskenPruef {feld, titel, punkte = knotenPunkte}), Entwurf.pruef (PruefWahl ok|fehler), tippePruef (derselbe Tipp
  nimmt heraus), pruefOffen, restRichtig(e, aufbau) (offene → ✓, KN10 22.11.2026), fertig(e, aufbau) (Prüfliste seit
  KN10 sobald sie Knoten hat – vorher erst bei allen gesetzt; sonst immer), zellenAus ✓ → '',
  ✗ → '5', entwurfAus (Punkte > 0 → ✗, vorhandene leere Zelle → ✓, fehlende → offen), punkteVon/eintraege zählen ✗;
  probeMaske übergeht die Prüfliste.
  W5.4 (22.11.2026, ZT1–ZT4): MaskenArt `zeit` (nur time + Disq./Text); Bojen + time → `bojen` mit Zeit-Abschnitt;
  time neben Katalog ohne Bojen bleibt `spaeter`. MaskenAufbau.zeiten (MaskenZeit {feld, titel}, alle Zeitfelder der
  Klasse); Entwurf.zeiten (Ziffernfolge wie getippt) und .keineZeit (Grund je Feld); setzeZeit (sanitizeTimeInput mit
  Komma, ≤ ZEIT_ZEICHEN_MAX 8, hebt „keine Zeit“ auf), setzeKeineZeit (leert die Zeit; derselbe Grund/null = heraus),
  zeitDeutung (= lib/time.ts parseTime), zeitFertig, zeitenOffen (seit 22.11.2026 ZT5: Pflichtfeld offen + weitere
  unlesbare), zeitPflicht (nur das erste Zeitfeld, ZT5), zeitVollstaendig (alle Stellen da → Sprung, ZT6), zeitUnlesbar, keineZeitAus (→ `kz` der Zeile),
  zeitUhr/zeitTeile („1:23,45“, Komma nach Sprache); fertig() verlangt das erste Zeitfeld fertig und keine
  unlesbaren weiteren (ZT5, auch gemischt);
  zellenAus: lesbar → sanitizeTimeInput(Text), sonst '' (leeres optionales Feld bleibt '' – geraete/erfassen.ts
  schickt es nur mit eigenem `vorher`, also nie über eine Papierzeit)'' (maske.test.ts: jede Tipp-Folge bis 5 Tasten → wertGilt und
  gleiche Deutung wie am Rechner); entwurfZellen (gerätelokaler Entwurf mit halb getippten Zeiten); entwurfAus(zellen,
  aufbau, keineZeit?); eintraege zählt Zeiten und „keine Zeit“.
  W5.1 (22.11.2026): listeMitBojen(konfig, typeId, klassen) (Bedienrechner: „Bild“ wählbar), attemptWechsel(vorher,
  jetzt) → Attempt-Nummer bei derselben Startnummer im Parallelslalom (PD5, WkrMaske Band + Sperre) | null.
- `keineZeit.ts` (W5.4, 22.11.2026, ZT4) – „Keine Zeit“ im Stand (WkrStand.keineZeit: Liste → `${lauf}|${starter}` →
  Feld → Grund `anlage|nichtImZiel|anderes`, KEINE_ZEIT_GRUENDE, istKeineZeitGrund; Schlüssel kzSchluessel – seit
  24.11.2026 hier, vorher aus nichtVorbei.ts): keineZeitVon, mitKeineZeit (ersetzt
  ganz, `{}` hebt auf, gleiche Referenz), keineZeitNur (Läufe/Starter löschen), ohneUeberholteKeineZeit (Feld mit Wert
  → weg; reducer.ts nach jeder Änderung der Eingaben), normalisiereKeineZeit/
  liesKeineZeitFelder (migrate über normalisiereWkr). Nie in einer Sicht (Liste, Freigabe, Tafel, Zuschauer).
- `uebung.ts` (W3.1) – Übung ohne AppState/Store/Netz: uebungsStand(regelwerk, typeId, sprache?, gezeigt = 2) → UebungsStand
  {naechster, offen je Teil}, uebungsSicht(stand) → ListenSicht (Starts 1–20 ohne Namen – seit 27.11.2026 (CP8) mit
  Boot uebungsBoot(klasse) aus data/boote.ts an jedem Start und am Steg `coPiloten` aus uebungsCoPiloten (data/names.ts,
  reihum WKR_ANNAHMEN.coPilotUebung) – in den Klassen
  mit der Liste, Kennung `["m","u<n>",lauf]`, Vorsteg 2 `vorab`, Steg-Ablegen 1 `vorab` und Anlegen erst nach dem
  zuletzt gezeigten (T1/T2), nach Nr. 20 der nächste Lauf), uebungsSchritt(stand,
  zeile|null, mindestens = 2) (Zeile erledigt Start bzw. Teil und füllt bis `mindestens` auf – der Gerätekern gibt 0,
  Übungstakt Y1–Y3; null zeigt den nächsten, ≤ Schlange 12). Kern: geraete/uebung.ts. W5.3 (KN8): Liste ohne Lauf
  (Knoten) → UebungsStand.erledigt (Nummern), Sicht mit Bestand 1–20 (`["o","u<n>"]`, Bereich `tisch`, Punkt `ohne`),
  Schritt null ändert nichts (kein Takt), eine Zeile hakt ihre Nummer einmal ab. Y4 (22.11.2026, R7-45): ziehVor(stand,
  klasse) setzt `vorziehen` (Klasse ohne die Liste → gleiche Referenz); der nächste gezeigte Start ist der nächste
  ihres Blocks im laufenden Lauf (übersprungene in `vorgezogen`, die normale Folge lässt sie aus), sonst ein
  erfundener in `extra` (Nummer uebungStarts + k + 1); Vorsteg sieht ihn vorab (folgeVon); `zuletzt` = zuletzt
  gezeigter (Steg-Anlegen im Boot). Am Tisch gilt `vorziehen` bis zur nächsten Zeile.
- `lage.ts` (W2.1, 21.11.2026) – erfassungsLage(stand, konfig, bereich, geraete, jetzt, starts?) → {punkt, starts
  (Spalten: gezeigte Starts des laufenden Punkts, letzte 12 bzw. alle; Vorsteg + `vorab`), listen: ListenLage (Modus,
  Status, Teile, papierAb, Geräte mit Ampel, Zellstand je Spalte, Rückstand, warnt, Rückfragen/Vorschläge, Abschlüsse
  mit Startnummern)}; Zellstand ok/halb/offen/ueberfaellig/rueckfrage/vorschlag/entfaellt/
  papier/x/vorab/spaeter (Vorrang X → Klasse ohne Liste → Rückfrage → Vorschlag → Haken → Teile → Schlange; nicht in
  der Schlange = Papier; X = irgendeine Disq.-Zelle des Laufs, seit 24.11.2026 auch „Nicht gestartet“ vom Tor (NG4);
  `nv` ⊘ entfiel 24.11.2026; Steg-Anlegen des Starts im Boot bzw. eines Vorab-Starts = `spaeter` „kommt noch“, kein
  Rückstand – T2; Vorab-Spalten je Liste mit hatVorab);
  ampelVon (gehoert/still/weg, ohne laufenden Punkt ruht), schlechteste; ZellLage.disq (seit W3-17, 21.11.2026):
  `ok` mit Buchstaben im Disq.-Feld der Liste → Matrix „✓ Disq. D“; Parcours-Ampel (21.11.2026): ListenLage.parcours,
  `warnt` nur Parcours-Listen, der gezeigte Start zählt im Rückstand einer Parcours-Liste erst ab der Durchfahrt
  (durchfahrtVon: Knopf `BereichBetrieb.durchfahrt` oder Haken/Wert/Rückfrage/Vorschlag einer Parcours-Liste, X = durch); zeilenMarken (Erfassung: `${lauf}|${starter}` →
  Zeile/Zelle „papier-ansehen“ bzw. „rueckfrage“, nur Listen digital/beides); rueckstandZeile (Zeile über „Nächster
  Start“). Geräte nur als GeraetAngabe (einfache Daten vom Host, geraete/register.ts geraetAngaben), nichts aus
  geraete/. Nutzer W2.2: components/betrieb/WkrMatrix.vue (Betrieb → WKR); W2.3: components/erfassung/ErfassungTabelle.vue
  (listeVonBogen + zeilenMarken einmal je Bogen, ◆ über geraete/wkrEingang.ts herkunftGilt). W5.3 (KN4):
  tischLage(stand, konfig, geraete, jetzt) → TischLage (ListenLage ohne Zellen, Rückstand null, warnt/parcours false,
  `knoten` {offen, gesamt, nummern}; erledigt = Haken oder eigene Werte). W5.4 (ZT4): ZellLage.keineZeit (an `ok`, aus
  wkr/keineZeit.ts) → Matrix „✓ keine Zeit“; zeilenMarken markiert genau diese Zellen „papier-ansehen“ (Zeile ohne Marke) – erfassungsLage kennt die Liste am Tisch nie
  (anderer Bereich), also auch Freigabe und Ampel nicht. Nutzer: WkrMatrix-Block „Am Tisch“.
- `freigabe.ts` (W2.4, 21.11.2026) – sichtFreigabe(bereich, lagen, warnung) → FreigabeErfassung {fv:
  FREIGABE_SICHT_FASSUNG = 3 (2 seit der Parcours-Ampel; sichtFreigabe(…, ampel, autoIn) mit `ampel`, `ampelRef`,
  `perKnopf`, `autoMoeglich`, `autoOhne`, `autoIn`; 3 seit 27.11.2026, R13-01: sichtFreigabe(…, ausfallGesperrt) =
  Abgemeldete unter den gefahrenen Starts des Bereichs, nur vom Host, fürs Ausgrauen auf dem Handy), bereich, warnung,
  listen: FreigabeListe {titel, stand
  aktiv|pausiert|abgemeldet|papier, ampel|null, offen, von, bis, wartend?, rueckfragen, warnt (≥ R seit N8), parcours}}
  – Feld für Feld, leer ohne Eintrag im Bereich; liesFreigabe
  (Gerät: Form prüfen, Fremdes fällt weg). Nutzer: StartFreigabe.vue Prop `erfassung` (BetriebView rechnet sie aus
  erfassungsLage, GeraetFreigabe bekommt sie über geraete/gekoppelt.ts `freigabe`), geraete/host.ts verteileFreigabe
  (Freigabe-Gruppe je Bereich, geraete/wkrGruppen.ts gruppeDerFreigabe). Nie über ko/kz (F17).
- `versuch.ts` (Nutzer 26.11.2026, R11-11, BETRIEB_ANNAHMEN WH6/WH7) – Wiederholung nach Ausfall auf den Geräten:
  versuchsKennung(key, n) (n = Abbrüche davor; 0 = Kennung des Betriebs, sonst `["w", n, key]`), liesVersuch,
  geraeteKennung(betrieb, key), versuchVeraltet, giltFuerAlleVersuche (Vorsteg mit „Versuche nacheinander“),
  versuchVeraltetAuf(stand, konfig, liste, kennung) (27.11.2026: auf einer Liste für alle Versuche ist keine Kennung
  veraltet, WH6). sicht.ts gibt ListenStart.key und `ampel.key` als Geräte-Kennung aus; zeile.ts liest sie zurück
  (WkrZeile.ref = Kennung des Betriebs, WkrZeile.`versuch` = n – WKR_ZEILEN prüft ihn beim Anwenden noch einmal) und
  lehnt einen veralteten Versuch mit `versuch-abgebrochen` ab (nie still, keine Rückfrage); WKR_ABSCHLUSS überspringt
  Prüfsummen veralteter Versuche. schlange.ts rahmen: eine Wiederholung (geltender Versuch nach einem abgebrochenen)
  kommt auch in einem abgeschlossenen Punkt (27.11.2026, WH8; Zeile → Vorschlag „abgeschlossen“). schlange.ts/lage.ts überspringen `gezeigt` mit `abgebrochen` (Schlange,
  P der Pausen, Spalten, „überfällig“, Marken); imBoot nie für einen abgebrochenen Versuch, wartet aber auf eine offene
  Wiederholung; ampel.ts laufLage zählt sie als offen; durchfahrtVon: abgebrochener Start im Boot = keine Ampel.
  Test wkr/wiederholung.test.ts, geraete/wkr.test.ts „Wiederholung nach Ausfall Ende zu Ende“.
  Parallelslalom (27.11.2026, R13-02, BETRIEB_ANNAHMEN WHP4): listenSeite(liste) (A → `a`, B → `b`); geraeteKennung/
  versuchVeraltet(Auf) zählen nur Abbrüche, die das Boot der Liste trafen (GezeigterStart.nur). schlange.ts, lage.ts
  (überfällig, Marken), zeile.ts istGezeigt, reducer/wkr.ts (versuchVorbei, PAPIER_AB) über betrieb/folge.ts
  abgebrochenAuf(g, seite); vorab/„danach“ lassen eine Wiederholung nur des anderen Boots aus (fremdeWiederholung).
  Die Matrix-Spalte (lage.ts erfassungsLage) fehlt bei jedem Abbruch bis zum neuen Zeigen. Seit dem Prüfbefund
  27.11.2026 über betrieb/folge.ts giltAuf(b, i, seite) statt abgebrochenAuf: Schlange (Hauptschleife), papierStarts,
  lage.ts rechner („überfällig“) und zeilenMarken lassen die Wiederholung nur des anderen Boots aus – auch wenn der
  frühere Versuch dort nie gezählt war (Liste pausiert, erst später digital); durchfahrtVon zählt nur die Listen des
  wiederholenden Boots, ampel.ts laufLage nennt nur dessen Nummer als `unterwegs`.
- Nutzer außerhalb: geraete/aufgaben.ts erlaubteWkr (pruefeZeile), geraete/host.ts (sichtListe je Listen-Gruppe),
  geraete/erfassen.ts (Gerät: liest ListenSicht, rechnet zeilenPruefsumme wie WKR_ABSCHLUSS, Zahlen aus WKR_ANNAHMEN:
  buendel, zuletzt, lebenszeichenSek, nameMax). Ende zu Ende: geraete/wkr.test.ts.
- Parcours-Ampel im Betrieb (21.11.2026): BereichBetrieb.durchfahrt (types/betrieb.ts) über BETRIEB_DURCHFAHRT
  (state/reducer/betrieb.ts, Positivliste geraete/aufgaben.ts), Einstellung AnzeigeEinstellungen.wkrAuto; Auto-Modus
  zählt im Führungsfenster geraete/host.ts (pruefeAuto/feuereAuto, `auto`, `halteAuto`, Geräte-Nachricht AUTO_HALT).
- Stand: types/wkr.ts (WkrStand in AppState.wkr; WkrRueckfrage.soLassen = Zeit, W3-35/GF5), Actions state/reducer/wkr.ts (WKR_SO_LASSEN {liste, zeile}, WKR_ZEILEN, WKR_RUECKFRAGE,
  WKR_VORSCHLAG, WKR_LISTE, WKR_ABSCHLUSS, WKR_ABSCHLUSS_LOESEN, W2: WKR_PAPIER_AB {liste, ref, teil?} mit WkrPause.ab;
  normalisiereWkr für migrate – ein altes `nichtVorbei` (W4.3, entfernt 24.11.2026) fällt beim Laden weg). Verlauf:
  lib/verlauf.ts eingabeGeraet (Liste + Gerätename; auch „Nicht gestartet“), rueckfrage, vorschlag, wkrListe,
  wkrAbschluss, wkrPapierAb. Einstellung R und warnen/nachfragen: AppState.anzeige.wkrRueckstand/wkrWarnung
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
- Höchstzahl je Code (24.11.2026): Grenze nur über lib/codes.ts codeHoechstens/codesUeberMax (Gerät, Tabelle, wertGilt,
  Abtippen), Code-Tipps nur über maske.ts tippe MIT Aufbau – nie selbst zählen.
- Maske (W3): `zellenAus` muss genau das liefern, was wertGilt unverändert annimmt (maske.test.ts prüft jede
  Tipp-Folge je Position, DM und UIM) – keine eigene Schreibweise, immer über lib/codes.ts bzw. die Disq.-Reihenfolge.
  Disq.-Feld (sanitizeDisq) behält die Tipp-Reihenfolge, Code-Felder sortieren (normalizeCodeCell).
- Bojen (W4.1): Zeilen folgen dem FAHRWEG, nie den Spalten des Bogens (frontal135 = gate135); die Knopfspalten
  dagegen folgen dem Bogen (Blick). Eine Bojenzelle bekommt vom Gerät Punkte, dahinter Buchstaben aus MaskenBoje.disq
  in Katalogfolge („5, G“, „5, G, J“; seit W4-12 21.11.2026 BZ1, mehrere seit R7-14 22.11.2026 BZ6) – gelesen NUR über
  lib/scoring.ts bojenWert, geschrieben NUR über lib/disq.ts bojenZelle (= was sanitizeBuoy unverändert lässt; „5J“ ist
  vom Gerät ungültig); X nie mit Punkten oder anderen Buchstaben (BZ2). Disq. „keine Boje“ ins Disq.-Feld (BZ4). Die Bojen-Folge (bojenAbschnitte) ordnet nur um – Felder, Zellen und Texte bleiben dieselben. Seit W4.2 zeigt WkrMaske `bojen` mit WkrBojen.vue (Probe
  auch); `spaeter` bleiben nur Zeit, Knoten und Bojen außerhalb des Fahrwegs.
- Sicht der Liste: jedes Objekt Feld für Feld neu (wie sichtZuschauer); nie Name, Herkunft, Geburtsdatum, Gewicht,
  Geschlecht, Werte (auch nicht der eigenen Liste), Summen, Wertung, WKR-Name des Abschlusses. Ausnahmen:
  `ListenStart.ausgleich` (Nutzer 24.11.2026, AG1, Fassung 11) – nur an Listen aus WKR_ANNAHMEN.ausgleichListen (Steg),
  nur über lib/ausgleich.ts ausgleichAmSteg (kg auf die Abstufung AppState.ausgleichStufe gerundet, Vorgabe ganze kg, 0, 'fehlt'; nie Körper- oder Durchschnittsgewicht; die Übung
  über uebungsAusgleich); ob die Karte es zeigt, entscheidet nur WkrMaske `kartenAusgleich` (ausgleichTeil) –,
  `ListenSicht.coPiloten` (Nutzer 27.11.2026, CP1–CP4, Fassung 14 – zweite Namens-Ausnahme: nur an Listen aus
  WKR_ANNAHMEN.coPilotListen (Steg), je Klasse mit Maske EINMAL (nicht je Start, CP2), nur benannte Co-Piloten mit
  Schlüssel `coPilot` (nie `name` – der bleibt im Schlüssel-Test verboten), Ausgleichsgewicht nur über lib/ausgleich.ts
  coPilotenAmSteg (nur > 0 oder 'fehlt', CP4); sicht.ts coPilotenJeKlasse, Übung uebungsCoPiloten; die Klammer zeigt die
  Karte nur im Ablegen, WkrMaske `kartenCoPiloten`/coPilotAusgleichTeil) –, `steht`
  (F11) – steht unter dem Gerät der Rückfrage, lesbar aber für jedes Gerät derselben Liste (EIN Gruppeninhalt,
  WKR_ANNAHMEN.rueckfrageInListe) – und `wkrName` (W3-13, WN1: nur der Name aus der Einteilung für DIESE Liste, nie
  der einer anderen, nie auf ko/kz oder in der Freigabe-Sicht). Neues Feld → Positivliste in sicht.test.ts und ggf.
  LISTEN_SICHT_FASSUNG – dann IMMER auch betrieb/sicht.ts SICHT_FASSUNG (`sv`): Nur `sv` lässt ein Gerät mit altem
  Programm neu laden (F7); eine fremde `lv` verwirft es still, die Liste stünde (Prüfbefund 27.11.2026, CP9; der Test
  „Fassung“ in sicht.test.ts hält beide zusammen fest). Die Co-Piloten tragen Namen nur aus der Besetzung
  (AppState.coPiloten), nie aus der Starterliste und nie am Start; die Einstellung „Namen“ der Anzeigetafel gilt für
  sie nicht (CP10, zu bestätigen).
- Steg-Zeitversatz (T1–T3): `vorab` gibt es seit 21.11.2026 auch am Steg, aber nur im Ablegen – wer `vorab` prüft,
  nimmt hatVorab/vorabStarts, nie WKR_ANNAHMEN.vorabListen allein. Der Start im Boot fehlt in der Anlegen-Schlange; in
  der Sicht steht das als `teile.an = true` („braucht noch nichts“, auch für Vorab- und „danach“-Starts) – das Gerät
  kann „erledigt“ und „noch nicht“ dort nicht unterscheiden (gewollt). „Nie beide zugleich“ auf einem Gerät für den
  ganzen Steg macht das Gerät (geraete/erfassen.ts, uebung.ts), nicht schlange.ts. sicht.ts `teile[t].status` nimmt
  den Status der ganzen Liste, wenn die nicht aktiv ist (Befund 21.11.2026: ganzer Steg abgemeldet, Maske zeigte weiter).
- „Nicht gestartet · Disq. X“ (24.11.2026, NG1–NG6): kein eigenes Kennzeichen – X im Disq.-Feld wie jedes X. Die
  Disq.-Knöpfe bieten X nur am Steg-Ablegen/Vorsteg an (sicht.ts filtert es weg); darum baut das Gerät die Zeile über
  wkr/maske.ts nichtGestartetZellen, nie über zellenAus (das ließe X weg), und jeder Entwurf aus einer X-Zeile –
  Korrektur (WkrMaske oeffneKorrektur) und „Rückgängig“ einer wartenden Zeile (ladeEntwurf, Prüfbefund 24.11.2026) –
  verliert dort das X (maske.ts ohneFremdesX). Wer „ist das ‚nicht gestartet‘?“ fragt, nimmt istNichtGestartet (Zellen) bzw.
  lib/erfassung.ts nichtGestartet (Lauf).
- Listen ohne Lauf (W5.3): Wer Kennungen von Starts liest, nimmt liesStartKennung bzw. wkrPunktVonRef – liesRef allein
  kennt `["o", …]` nicht. Die Liste am Tisch hat keinen Bereich des Betriebs: nie bereichBekannt/lage/betriebVon für sie
  voraussetzen (erlaubteWkr, sicht.ts und WKR_ABSCHLUSS zweigen über istTischListe ab). `ohne` steht nur an ihr.
- Tabelle (W5.5): Keine eigene Schreibweise und kein eigener Sendeweg – die Zellen gehen immer über den Entwurf
  (entwurfAus → zellenAus); eine Eingabe, die das so nicht ergibt, ist `nicht-darstellbar` (Rund-Probe in
  zeileAusEingaben). Wer maske.ts entwurfAus/zellenAus ändert, lässt tabelle.test.ts mitlaufen.
- Steg je Teil: Status/Pausen (WkrListe.teile) und Abschluss (`punkt|teil`) – nie `wkr.abschluss[liste][punkt]` direkt
  lesen, immer über abschluss.ts; WKR_LISTE mit `teil` nur Status, nur bei vorhandenem Eintrag.

## Tests

W5.5: src/wkr/tabelle.test.ts, components/wkr/WkrTabelle.test.ts (Übung auf dem Pad: Enter, Abschicken, Fehler,
Korrektur, Esc, Bojen, Handy ausgegraut). W5.3: src/wkr/ohneLauf.test.ts (Liste, Zeile, Sicht, Lage, Abschluss, normalisiereWkr, Prüfliste, restRichtig, Übung),
src/wkr/tisch.test.ts (KN9),
components/wkr/WkrPruefliste.test.ts, geraete/wkr.test.ts „Knoten am Tisch“, views/BetriebWkr.test.ts „Knoten am Tisch“.
`npx vitest run src/wkr src/components/betrieb src/geraete/uebung src/GeraetWkr src/views/BetriebWkr src/GeraetKoppeln src/views/SettingsView src/geraete/aufgaben src/geraete/wkrGruppen src/state/reducer/wkr src/state/migrate src/persistenz/backup src/lib/verlauf src/lib/eingaben`.
Hilfe: testHilfen.ts wkrBetriebsStand (DM, festgeschrieben, Lauf 1 auf beiden Parcours begonnen).
