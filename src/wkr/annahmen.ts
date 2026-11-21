// Auslegungen der digitalen WKR-Erfassung (Etappe W1) – an EINER Stelle, nach dem Muster von BETRIEB_ANNAHMEN und
// PARALLEL_ANNAHMEN. Grundlage: docs/vorschlag-wkr-erfassung.md (§12, Antworten des Nutzers vom 21.11.2026 auf F1–F17)
// und docs/plan-wkr-w1.md §9. Was mit „noch zu bestätigen“ markiert ist, hat der Nutzer noch nicht gesehen; alle
// Auslegungen aus W1 und W2 (Fragen W1-01…W1-15, W2-01…W2-30) hat er am 21.11.2026 mit „passt“ bestätigt. Die
// Werte, die der Code liest, sind hier umstellbar; die übrigen Einträge halten fest, wie der Code gebaut ist.

import type { ListenTeil } from '../lib/eingaben'

/** Die Spalten (Spalten-Keys des Bogens, `Feld.zelle`) eines Teils einer Liste. */
export interface ListenTeile {
  ab: readonly string[]
  an: readonly string[]
  /** Spalten, die beide Teile beschreiben: Disq.-Buchstaben werden vereinigt, Bemerkungen angehängt. */
  gemeinsam: readonly string[]
}

export const WKR_ANNAHMEN = {
  /**
   * (Plan §9.1) Übernahmeregel: Ein Wert vom Gerät wird übernommen, wenn der Stand gleich `vorher` (das, was das
   * Gerät dort erwartet; beim ersten Mal leer) oder gleich dem neuen Wert ist. Sonst bleibt der Stand und es entsteht
   * eine Rückfrage – nie still überschrieben. Hat der Bediener eine vom Gerät gesetzte Zelle geleert, ist das eine
   * Rückfrage, keine leere Zelle. 21.11.2026, bestätigt 21.11.2026.
   */
  uebernahmeNurVorher: true,
  /**
   * (Plan §9.3) Zeilen zu nicht gezeigten Starts (auch die ohne Netz geschätzten) werden ganz zur Rückfrage (Grund
   * `start`), nie still übernommen. Ausnahme: der Vorsteg sieht die nächsten freien Starts schon vor dem Zeigen
   * (Vorschlag §2). 21.11.2026, bestätigt 21.11.2026.
   */
  nichtGezeigtRueckfrage: true,
  /**
   * (Plan §9.4, F16) Steg in zwei Teilen: Ablegen und Anlegen schicken getrennt, je mit Teilhaken
   * (`erfasst.ab@steg`, `erfasst.an@steg`); beide zusammen setzen `erfasst@steg`. Die Teile sind die Spalten
   * `fehlerAB`/`fehlerAN` (Spalten-Keys aus config/aufbauten/gemeinsam.yaml, die Feld-Kennungen sind die Kataloge);
   * Disq. und Bemerkung gehören beiden (Disq. vereinigt, Bemerkung mit „; “ angehängt, nie ersetzt). Die
   * Anlegen-Schlange sind alle gezeigten Starts ohne Anlegen-Haken, auch wenn das Ablegen auf Papier ist.
   * 21.11.2026, bestätigt 21.11.2026.
   */
  teile: { steg: { ab: ['fehlerAB'], an: ['fehlerAN'], gemeinsam: ['disq', 'bemerkung'] } } as Readonly<Record<string, ListenTeile>>,
  /**
   * (F5, 21.11.2026 bestätigt) Ein X „nicht gestartet“ vom Gerät nur am Steg (Teil Ablegen – ein Gerät für den
   * ganzen Steg darf es auch, nur nicht in der Spalte des Anlegens) und am Vorsteg. Sonst lehnt der Bedienrechner die
   * Zeile ab (`x-nicht-erlaubt`).
   */
  xListen: ['steg', 'vorsteg'] as readonly string[],
  /** Der Teil, in dem am Steg das X erlaubt ist (F5). */
  xTeil: 'ab' as ListenTeil,
  /**
   * (Plan §9.5, F1) Pausieren und Abmelden gelten für die Liste, nicht für ein Gerät. P („Papier“) = die Starts,
   * die beim Pausieren offen waren, und alle, die während der Pause gezeigt wurden. 21.11.2026, bestätigt 21.11.2026.
   */
  pauseJeListe: true,
  /**
   * (Plan §9.5 mit F16, Prüfbefund 21.11.2026) Am Steg mit Teil-Kopplung pausiert bzw. meldet ein Teil-Gerät nur
   * SEINEN Teil ab (WkrListe.teile): Das andere Handy erfasst weiter, P gilt nur für diesen Teil. Ein Gerät für den
   * ganzen Steg und der Bedienrechner wirken auf die ganze Liste. Sonst wartete die Freigabe auf einen Teil, der
   * längst auf Papier ist – gegen F1. 21.11.2026, bestätigt 21.11.2026.
   */
  pauseJeTeil: true,
  /**
   * (Plan §9.6) Modus: Eine Liste ohne Eintrag ist Papier; das erste „digital“ (oder „beides“) setzt `seit`. Die
   * Schlange beginnt erst dort – ältere Starts tippt man vom Bogen ab. Ein Wechsel von Papier zurück auf digital
   * setzt `seit` neu. Zeilen einer Liste auf Papier (oder ohne Eintrag) werden Vorschläge. 21.11.2026, bestätigt
   * 21.11.2026.
   */
  ohneEintragPapier: true,
  /**
   * (Plan §9.7, F7, F8) Abschluss je Liste und Punkt (Lauf bzw. Runde), mit Namen des Wettkampfrichters – die
   * digitale Unterschrift. Er wird angenommen, wenn nichts mehr offen ist oder „Rest auf Papier“ gewählt ist; sonst
   * ändert er nichts. Weicht die geprüfte Fassung des Geräts vom Stand ab, wird das je Start vermerkt (W2 zeigt es),
   * ohne Sperre. Danach werden Korrekturen vom Gerät zu Vorschlägen. 21.11.2026, bestätigt 21.11.2026.
   * Prüfbefunde 21.11.2026: Am Steg je Teil (eigener Eintrag `punkt|ab`/`punkt|an`, wkr/abschluss.ts) – der Abschluss
   * des Ablegens macht Zeilen des Anlegens nicht zu Vorschlägen und überschreibt nie dessen Unterschrift; die ganze
   * Liste gilt mit beiden Teilen als abgeschlossen. Nur für einen Punkt, der im Bereich begonnen hat. Starts, die mit
   * „Rest auf Papier“ aufs Papier gingen, und der abgeschlossene Punkt fehlen danach in der Schlange.
   */
  abschlussJePunkt: true,
  /**
   * (F11, Prüfbefund 21.11.2026) Die Sicht der Liste ist EIN Inhalt der Listen-Gruppe: `steht` einer Rückfrage,
   * Ablehnungen und Hinweise sieht jedes Gerät DERSELBEN Liste (am Steg auch das des anderen Teils), nie ein Gerät
   * einer anderen Liste oder der Tafel. Es sind dieselben Wettkampfrichter derselben Liste; eine eigene Nachricht je
   * Gerät (d-Thema) kostete Kontingent. 21.11.2026, bestätigt 21.11.2026.
   */
  rueckfrageInListe: true,
  /**
   * Listen, die die nächsten Starts schon vor dem Zeigen sehen (Vorschlag §2: „Vorsteg sieht die nächsten Starts schon
   * vor dem Zeigen“): so viele freie, wie die Zuschauerliste am und vor dem Steg zählt (`anzeige.amSteg + vorSteg`).
   * Ihre Zeilen gelten als gezeigt. 21.11.2026. Seit dem Nutzerbefund 21.11.2026 auch das Steg-Ablegen, aber nur so
   * viele wie „Am Steg“ ({@link stegAblegenVorab}, wkr/schlange.ts vorabStarts).
   */
  vorabListen: ['vorsteg'] as readonly string[],
  /**
   * Ein Start, dessen Klasse die Liste nicht hat (MüB erst ab Klasse 4), steht in der Schlange grau als „entfällt“
   * – nur solange er der zuletzt gezeigte Start des Bereichs ist; mit dem nächsten Start schließt er sich von
   * selbst (Vorschlag §2). Beim Bau von W1.1, 21.11.2026, bestätigt 21.11.2026.
   */
  entfaelltNurAktuell: true,
  /**
   * (Plan §9.9) Knoten und andere Listen ohne Lauf erst mit W5: W1 kennt nur Listen mit Lauf
   * (wkr/liste.ts `listenDerVeranstaltung`).
   */
  listenOhneLaufErstW5: true,
  /**
   * Vorsteg mit „Versuche direkt nacheinander“: Die Zeile gilt für jeden Versuch – wie in der Erfassungstabelle
   * (lib/erfassung.ts `zeilenSchluesselAlle`). Geprüft wird gegen den ersten Versuch, geschrieben in alle.
   */
  vorstegAlleVersuche: true,
  /** (Plan §9.11) Zahlen: Bündel ≤ 8 Zeilen, Schlange ≤ 12, „danach“ ≤ 5, „zuletzt“ ≤ 20 Zeilen je Gerät. */
  buendel: 8,
  schlange: 12,
  danach: 5,
  zuletzt: 20,
  /** (Plan §9.11) Lebenszeichen nach so vielen Sekunden Stille (nur mit Liste und laufendem Punkt). */
  lebenszeichenSek: 60,
  /** Höchstlänge eines Textwerts vom Gerät (Bemerkung), wie in der Erfassungstabelle getrimmt. */
  textMax: 200,
  /** Höchstlänge des Namens beim Abschluss (Plan §5). */
  nameMax: 60,
  /** (Plan §6, F7) Modus beim ersten Koppeln einer Liste – nur wenn sie noch keinen Eintrag hat. */
  modusBeimKoppeln: 'digital',

  // --- W2 Bedienrechner (docs/plan-wkr-w2.md §9, 21.11.2026, alle bestätigt 21.11.2026) ------------------
  /**
   * (A1) Der Unterreiter im Betrieb heißt „WKR“ (englisch „Race officials“), nicht „Erfassung“ – das ist schon der
   * Hauptreiter zum Abtippen; zwei Dinge mit demselben Namen führen am Wettkampftag zu „wo war das noch?“.
   */
  unterreiterWkr: true,
  /**
   * (A2) Die Matrix zeigt die letzten `matrixStarts` gezeigten Starts des laufenden Punkts, umschaltbar auf alle des
   * Punkts – bei 60 Startern passt kein ganzer Lauf in die Breite, und was älter ist und ✓ hat, braucht niemand.
   */
  matrixStarts: 12,
  /**
   * (A3) Läuft im Bereich kein Punkt, „ruht“ jedes Gerät (grau) statt ✕: Die Geräte schicken nur während eines Laufs
   * Lebenszeichen (W1, Kontingent); in der Mittagspause würde sonst nach 5 min jedes Handy rot – ein Fehlalarm.
   */
  ruhtOhnePunkt: true,
  /**
   * (A4, F4) Rückstand = offene gezeigte Starts der Liste (Schlange ohne Vorsteg-Vorschau und „entfällt“). Am Steg mit
   * Teil-Geräten zählt der Teil, der weiter zurück ist. Pausiert, abgemeldet und Papier zählen nie (F1) – sonst wäre
   * Pausieren sinnlos.
   * Geändert nach dem Feldtest 21.11.2026 (Befund 8, Nutzer: „nächster Starter sollte nicht einfach möglich sein, wenn
   * der WKR noch nicht fertig ist“): gewarnt wird AB R offenen Starts (`rueckstandAbR`, vorher „mehr als R“), Vorgabe
   * R = 1 (vorher 2) und „nachfragen“ (`warnungVorgabe`, vorher „warnen“). Wer mit 2–3 Booten auf dem Wasser Tor 5 oder
   * Anlegen digital führt, stellt R in den Einstellungen höher. Gesperrt wird weiter nie (N8).
   * A4 bestätigt 21.11.2026 – in DIESER geänderten Fassung (R = 1, nachfragen); N8 selbst bleibt unten offen.
   */
  rueckstandVorgabe: 1,
  /** (N8) `warnt` ab `zahl >= R` (wkr/lage.ts erfassungsLage); „überfällig“ (A5) bleibt bei MEHR als R jüngeren Starts. */
  rueckstandAbR: true,
  /**
   * (N8) „Überfällig“ (A5, „Papier ansehen“ in der Erfassung) erst bei mehr als max(R, `ueberfaelligMin`) jüngeren
   * gezeigten Starts – so streng wie bis zum Feldtest mit der alten Vorgabe R = 2. Die strengere Vorgabe R = 1 gilt der
   * Rückfrage der Start-Freigabe, nicht den Marken der Erfassung (sonst wäre bei Tor 5 fast jede Zeile markiert).
   */
  ueberfaelligMin: 2,
  /** (N8) Vorgabe der Einstellung „Bei Rückstand“ (`anzeige.wkrWarnung`): vor jedem Zeigen nachfragen. */
  warnungVorgabe: 'nachfragen',
  /** Grenzen von R in der Einstellung (SettingsView `#betrieb`). */
  rueckstandMin: 1,
  rueckstandMax: 20,
  /**
   * (A5, F4) „Papier ansehen“ an der Zeile in der Erfassung, wenn der Start auf Papier ging (Pause, „Papier ab“, Rest
   * auf Papier, vor `seit`), überfällig ist (mehr als R jüngere gezeigte Starts derselben Liste dahinter) oder offen,
   * während jedes Gerät der Liste `weg` ist; an der Zelle, wenn nur ein Steg-Teil fehlt (dessen Spalten) oder genau
   * dort eine Rückfrage steht. „Beides“ wie digital; eine Liste ohne Eintrag oder auf Papier bekommt keine Marken (dort
   * ist der Bogen ohnehin die Quelle). Ein gerade erst gezeigter Start ist noch nicht verdächtig.
   * Beim Bau 21.11.2026 dazu: Ist kein Gerät der Liste bekannt (Raum zu, Bedienfenster ohne Register), zählt „offen“
   * nicht als „weg“ – ohne Angaben lässt sich nicht urteilen, sonst wäre jede offene Zeile markiert.
   */
  papierAnsehen: true,
  /**
   * (A6, §8 Vorrang 5, §7) Zeilen zu Starts, die schon aufs Papier gingen (papierStarts der Liste bzw. des Teils),
   * werden Vorschlag `papier` – nicht still übernommen, nicht verworfen: Ein wiederbelebtes Handy schriebe sonst still
   * in schon abgetippte Zeilen. Beim Bau 21.11.2026 dazu: Eine ganze Zeile einer geteilten Liste (Steg ohne Teil)
   * wird es schon, wenn EIN Teil den Start auf Papier hat (wie beim Abschluss, `zeileAbgeschlossen`).
   */
  papierStartVorschlag: true,
  /** (A7) Überschreiben eines Gerätewerts beim Abtippen fragt einmal je Zelle, solange sie den Fokus hat. */
  ueberschreibenEinmalJeFokus: true,
  /** (A8, F4) „nachfragen“ gilt für jedes Zeigen (Nächster Start und „Anderen Starter wählen“); gesperrt wird nie. */
  nachfragenJedesZeigen: true,
  /**
   * (A9, F17) Auf dem Freigabe-Handy nur Listenname, Ampel, Zahl und Startnummern der offenen Starts, keine
   * Gerätenamen, keine Werte – in einer eigenen Gruppe, nicht in der Sicht der Anzeigetafel.
   */
  freigabeOhneNamen: true,
  /**
   * (A10) „Papier ab Start …“ meldet die Liste (bzw. den Steg-Teil) ab: Status `abgemeldet`, die Pause beginnt mit der
   * Zeit, zu der der Start gezeigt wurde (sonst jetzt), P = die Schlange ab diesem Start, die Startnummer steht im
   * Stand (`WkrPause.ab`). „Weiter digital“ gilt ab dem nächsten gezeigten Start – rückwirkend würden Starts, die schon
   * vom Bogen abgetippt werden, wieder vom Gerät erwartet. Beim Bau 21.11.2026 dazu: Ist die Liste schon pausiert
   * oder abgemeldet, bekommt die offene Pause das `ab` und die Starts ab dort dazu (keine zweite Pause).
   */
  papierAbMeldetAb: true,
  /** (A11) ⧗ („laut Gerät abgeschickt“) nur als Zahl wartender Zeilen je Gerät, nicht je Zelle – das Lebenszeichen trägt nur die Zahl. */
  wartendNurZahl: true,
  /** (A12) Eine getrennte Kontingentanzeige der Erfassung erst mit dem Feldtest; die Gesamtzählung (E8) warnt weiter. */
  kontingentErfassungErstFeldtest: true,
  /** (A13, Vorschlag §6.1) Gerätezustand: ● unter `ampelStillSek`, ◐ bis `ampelWegSek`, ✕ darüber; Akku nur, wo gemeldet. */
  ampelStillSek: 90,
  ampelWegSek: 300,
  // --- W2.2 Matrix und Eingang, beim Bau 21.11.2026 (bestätigt 21.11.2026) ----------------------------------------
  /**
   * (B1) Unterreiter in der Folge Start-Freigabe, Startliste, WKR, Geräte (Adresse `#/betrieb/wkr`, englisch
   * `#/operation/officials` – „race-officials“ heißt schon die WKR-Liste unter „Lists“). Der Zähler „WKR: ! n“ im
   * Kopf jedes Unterreiters zählt ALLE offenen Rückfragen (alle Parcours); Vorschläge nicht – sie warten ohne Eile.
   */
  zaehlerNurRueckfragen: true,
  /**
   * (B2) Der Bediener kann den Modus jeder Liste jederzeit umstellen, auch ohne gekoppeltes Gerät (F1: „immer
   * wählbar“; papier → digital setzt `seit` wie beim ersten Koppeln). Pausieren/Abmelden/Weiter und „Papier ab“ gibt
   * es nur bei „digital“ oder „beides“ – auf Papier gibt es nichts zu pausieren.
   */
  modusOhneGeraet: true,
  /**
   * (B3) „Weiter digital“ schickt den Geräten der Liste immer den Hinweis `weiter-digital` – nach „Papier ab“ wie nach
   * Pausieren/Abmelden –, damit auf dem Handy nicht „Papier ab Nr.“ stehen bleibt. Hinweise („Papier ab“, „Bitte
   * Nr. prüfen“) gehen nur bei offenem Raum hinaus; ohne Raum ändert „Papier ab“ nur den Stand.
   */
  weiterMitHinweis: true,
  /** (B4) „Papier ab Start …“ wählt unter den gezeigten Starts der Matrix-Spalten; vorgewählt ist der zuletzt gezeigte. */
  papierAbVorgabeLetzter: true,
  /**
   * (B5) Die Karte einer Matrix-Zelle zeigt nur belegte Felder (mit ◆ nur, solange der Gerätewert unverändert steht,
   * geraete/wkrEingang.ts herkunftGilt). Ein Gerät, das es im Register nicht mehr gibt, heißt im Eingang
   * „entkoppeltes Gerät“ (F10: im Stand steht nie ein Name).
   */
  karteNurBelegte: true,
  /**
   * (B6) `zuletzt gehört` zieht das Führungsfenster höchstens alle 5 s nach (geraete/host.ts ZULETZT_NACHZIEHEN_MS,
   * nach echter Zeit): Die Ampel kennt Stufen von 90 s und 5 min, schneller muss die Oberfläche nicht folgen.
   */
  zuletztGedrosselt: true,
  // --- W2.3 Erfassung: ◆ und „Papier ansehen“, beim Bau 21.11.2026 (bestätigt 21.11.2026) -------------------------
  /**
   * (C1) ◆ steht an JEDER Zelle, deren Wert noch der vom Gerät ist – auch wenn das Feld auf mehreren Listen steht
   * (gemeinsame Felder); der Titel nennt die Liste des Geräts. Marken („Papier ansehen“, Rückfrage) dagegen nur für die
   * Liste des Bogens. Ohne Host (kein Bedienfenster) weder ◆ noch Marken noch Nachfrage.
   */
  rauteJedeListe: true,
  /**
   * (C2) Die Nachfrage vor dem Ersetzen eines Gerätewerts (Vorrang 3) kommt bei der ersten Änderung, auch beim Leeren
   * der Zelle; der Haken „abgetippt“ und „leere Zeilen bestätigen“ fragen nicht (sie ändern keinen Gerätewert). Die
   * Antwort „Ersetzen“ gilt, bis die Zelle den Fokus verliert (A7); „Behalten“ stellt den Wert zurück. Zeitfelder
   * bekommen danach den Fokus nicht zurück (sie markierten ihren Inhalt, die nächste Ziffer überschriebe ihn).
   * Geändert nach den Prüfbefunden 21.11.2026 (E4): Bei Zeitfeldern schreibt „Ersetzen“ nichts – nur Freigabe und
   * Fokus zurück; „Behalten“ wie bisher ohne Fokus.
   */
  ersetzenFragtErsteAenderung: true,
  /**
   * (C3) Gezählt („n Zeilen: Papier ansehen“) wird jede Zeile mit Marke an der Zeile ODER an einer Zelle (Steg-Teil);
   * Rückfragen stehen getrennt daneben mit dem Verweis auf Betrieb → WKR des Bereichs (dort wird entschieden, nicht in
   * der Erfassung – ein Tippen in die Zelle entscheidet die Rückfrage nicht).
   */
  papierZahlMitZellen: true,
  /** (C4) Die Erfassung rechnet „Gerät weg“ (A5) mit einer Uhr im 30-s-Takt – die Ampel kennt Stufen von 90 s und 5 min. */
  erfassungUhrSek: 30,
  // --- W2.4 Start-Freigabe und Freigabe-Handy, beim Bau 21.11.2026 (bestätigt 21.11.2026) -------------------------
  /**
   * (D1) Die Geräteleiste der Start-Freigabe nennt JEDE Liste des Bereichs, sobald eine einen Eintrag hat – Listen
   * ohne Eintrag als ▭ (Papier). Je Liste: schlechteste Ampel ihrer Geräte, „n offen“ bzw. ✓, ⧗ wartende Zeilen, „!“
   * bei offener Rückfrage. Rot (und einmal hervorgehoben, wenn es neu so wird) bei ✕ oder „!“; kein Ton, kein Dialog.
   * Den Rückstand je Steg-Teil zeigt die Matrix, nicht die Leiste (½ wäre am Steg-Handy ohne Spalten unverständlich).
   */
  leisteAlleListen: true,
  /**
   * (D2) Die Freigabe-Sicht trägt über A9 hinaus nur zwei abgeleitete Angaben: die ZAHL offener Rückfragen (für „!“) und
   * `warnt` (am Host gerechnet, damit Handy und Bedienrechner dieselbe Grenze R anwenden). Keine Startnummer einer
   * Rückfrage, kein „Papier ab“, keine Abschlüsse.
   */
  freigabeRueckfragenNurZahl: true,
  /**
   * (D3) Die Listennamen der Freigabe-Sicht stehen in der Sprache der Anzeigetafel (wie Parcours- und Klassennamen der
   * Start-Freigabe), am Bedienrechner in der Sprache der Oberfläche (wie die Matrix).
   */
  freigabeTitelTafelSprache: true,
  /**
   * (D4) Ohne Zustandsänderung rechnet das Führungsfenster die Freigabe-Sicht alle `freigabeTaktSek` neu (die Ampel
   * altert mit der Uhr); gesendet wird nur bei geändertem Inhalt. Ein Bereich, dessen Listen alle ohne Eintrag sind,
   * schickt nichts, solange noch nichts hinausging.
   */
  freigabeTaktSek: 15,
  /**
   * (D5) „Nachfragen“ (F4, A8) fragt in der Start-Freigabe vor JEDEM Zeigen, solange eine Liste des Bereichs warnt –
   * auch aus „Anderen Starter wählen“, aus den Zurückgestellten und Nachzuholenden. „Lauf beginnen“, „Zurück“ und
   * Zurückstellen fragen nicht (sie zeigen keinen neuen Start). Am Handy genauso, sobald die Freigabe-Sicht dort ist.
   */
  nachfragenVorJedemZeigen: true,
  // --- Prüfbefunde W2, 21.11.2026 (bestätigt 21.11.2026) ------------------------------------------------------------
  /**
   * (E1) „Erledigt“ für Zellstand, Rückstand und „Papier ansehen“ (wkr/lage.ts): Haken ODER eigene Werte der Liste –
   * wie lib/erfassung.ts zeileErfasst; am Steg je Teil nur die Felder des Teils (gemeinsame Disq./Bemerkung zählen
   * nicht, wie bei der Prüfsumme). Wer vom Bogen abtippt, setzt den Haken nicht – sonst bliebe ▭ stehen und die
   * Warnung käme vor jedem Start. Die Schlange der Geräte (schlange.ts) bleibt beim Haken: Ein Wert, den der Bediener
   * in einer offenen Zeile tippt (etwa eine Disq. nach Protest), nähme dem WKR sonst die Zeile weg; was das Gerät
   * danach schickt, prüft die Übernahme gegen `vorher` (gleich → nichts, anders → Rückfrage).
   */
  abgetipptErledigt: true,
  /**
   * (E2) ◆ auch nach einer Entscheidung im Eingang: „Gerät übernehmen“ (Rückfrage; bei `vereinige` der vereinigte
   * Wert) und „Übernehmen“ (Vorschlag) schreiben die Herkunft – nur, wo danach der Gerätewert steht; Gerätename aus
   * dem Register, sonst „entkoppeltes Gerät“ (geraete/host.ts merkeEntscheid, Vorschlag §5/§6.2).
   */
  rauteNachEntscheid: true,
  /**
   * (E3) Hinweise „Papier ab“ und „weiter digital“ gehen am Steg mit Teil nur an die Geräte dieses Teils und an
   * Geräte ohne Teil (F16); „Papier ab“ nennt im Parallelslalom die Startnummer der eigenen Seite, bei leerer Seite
   * keine. Die Auswahl „Papier ab Start …“ hält die Wahl des Bedieners, auch wenn ihr Start aus den Matrix-Spalten
   * fällt (erst ein neuer Punkt räumt sie); ungewählt folgt sie dem zuletzt gezeigten.
   */
  hinweisJeTeil: true,
  /**
   * (E4) Die Freigabe „Ersetzen“ (A7) gilt nur für den Gerätewert, nach dem gefragt wurde (Zeit des
   * Herkunftseintrags): Kommt ein neuer Gerätewert in die Zelle, fragt die nächste Eingabe wieder. Rückfragen zu
   * nicht gezeigten Starts (Grund `start`) bekommen in der Erfassung ebenfalls „!“.
   */
  freigabeJeGeraetewert: true,
  // --- W3 Handy-Maske „Knöpfe“ (docs/plan-wkr-w3.md §9, G1–G16, 21.11.2026 beim Planen, alle noch zu bestätigen) ---
  /** (G1) Sonnenmodus (schwarz auf weiß, hoher Kontrast) ist Vorgabe jedes WKR-Geräts; Hell/Dunkel wählbar, gemerkt je Gerät. */
  sonneVorgabe: true,
  /**
   * (G2) Masken nur für Listen, deren Felder alle Katalog, Disq. oder Text sind (Steg, Vorsteg, Tor 5, Tor 5 +
   * Parcours ohne Bojen, MüB) – erkannt an den Feldarten (wkr/maske.ts maskenArt), nicht an der Listen-ID: eigene
   * Aufbauten gelten so von selbst. Listen mit Bojen, Zeit oder Punkten sind `spaeter` (W4/W5) – Bojen auf dem
   * Fahrweg haben seit W4.1 die Maske `bojen` (P1).
   */
  maskeNachFeldarten: true,
  /** (G3, F15) Handy eine Liste, Pad zwei – nur als Hinweis am Bedienrechner; erzwungen bleibt LISTEN_JE_GERAET = 2. */
  handyEineListe: true,
  /** (G4, F14) Maskenvorgabe `maske`/`fest` an der Aufgabe; in W3 nur `knoepfe`, ohne Wahl – nur Anzeige. */
  maskeVorgabeNurKnoepfe: true,
  /**
   * (G5) Doppeltipp-Schutz: Nach dem Abschicken bleibt die Startnummer stehen, dann wechselt sie (Blitz, Vibration),
   * und `sperreMs` lang nimmt die Maske KEINE Eingabe an – auch Codes und Disq., nicht nur den Hauptknopf (ein Tropfen
   * auf „Code 1“ ist so schlimm wie auf „Fehlerfrei“). Bis zum Feldtest 21.11.2026 stand die Nummer fest 2 s mit
   * „● gesendet“ (`weiterNachMs`) – „als ob es ein Problem gibt“; seitdem Overlay mit Quittung, siehe N1.
   */
  sperreMs: 1000,
  /**
   * (N1, Feldtest 21.11.2026, Befund 13; noch zu bestätigen) Nach „Fehlerfrei“/„Abschicken“ sofort ein Overlay über die
   * ganze Maske: „wird übertragen …“ (im Ausgang) bzw. „gesendet – wartet auf Bestätigung …“, mindestens
   * `uebertragenMinMs` (kein Flackern), bis zur Quittung; dann `uebernommenMs` „✓ übernommen“ (bei Rückfrage/Ablehnung
   * deren Zeichen und Wort), dann der nächste Start. Ohne Quittung nach `uebertragenMaxMs` weg (nie dauerhaft
   * gesperrt), siehe N2. Das Overlay hat keine Knöpfe (ein zweiter Tipp landet auf ihm, nicht auf der Maske);
   * „Rückgängig“ ist danach wieder erreichbar (G8: wartet die Zeile nicht mehr, öffnet es die Korrektur).
   * wkr/maske.ts wechselTakt/wechselNach, components/wkr/WkrUebertragen.vue.
   */
  uebertragenMinMs: 600,
  uebernommenMs: 800,
  uebertragenMaxMs: 3000,
  /** (§5.2) Ohne Quittung nach so vielen ms im Kopf „Keine Bestätigung – Verbindung prüfen“ – nie gesperrt. */
  ohneQuittungMs: 10_000,
  /** (§5.6) Ohne Verbindung ab so vielen Sekunden „Länger weg? Papierbogen ab Nr. x“. */
  papierHinweisSek: 300,
  /** (G6) Codes „ab Klasse n“ bleiben drückbar – die Kataloge tragen die Klasse nur als Text (ein YAML-Feld `abKlasse` käme später). */
  codesAlleKlassen: true,
  /** (G7) Suche nach Startnummer nur in Schlange, „danach“ und „Zuletzt“; eine Nummer außerhalb wird nicht angeboten. */
  sucheNurBekannte: true,
  /**
   * (G8) „Rückgängig“ `rueckgaengigMs` nach dem Abschicken: Wartet die Zeile noch im Ausgang, holt sie
   * geraete/erfassen.ts holeZurueck zurück (Werte wieder im Entwurf); ist sie schon unterwegs, öffnet der Knopf die
   * Korrektur – kein automatisches Hinterherschicken.
   */
  rueckgaengigMs: 6000,
  /** (§5.5) Die Leiste „Zuletzt“ zeigt die letzten so vielen eigenen Zeilen (die Liste dahinter bis `zuletzt`). */
  zuletztLeiste: 5,
  /**
   * (G9, F13) Sprache der Maske: Vorgabe die der Liste, `de+en` → `de` (zwei Zeilen je Knopf kosten Platz im
   * Daumenbereich). Umschalten wechselt Bedientexte immer, Kataloge und Titel nur, wenn die Sicht `andere` trägt –
   * also das Regelwerk beide Sprachen hat (UIM; DM hat kein Englisch).
   */
  spracheDerListe: true,
  /** (G10) Probe beim Einrichten einmal je Raum und Liste, überspringbar; nichts geht an den Bedienrechner. */
  probeJeRaumUndListe: true,
  /** (G11, F8) WKR-Name nur beim Abschluss, kein „WKR wechseln“ in W3 – wer übernimmt, schließt mit seinem Namen ab. */
  nameNurBeimAbschluss: true,
  /** (G12) Der zuletzt eingegebene WKR-Name ist vorbelegt (Geräteablage), gelöscht mit „Raum verlassen“/Entkoppeln. */
  nameVorbelegt: true,
  /**
   * (G13) Übung ohne Netz: erfundene Starts 1–20 ohne Namen in den Klassen des Regelwerks, Quittung nach
   * `uebungQuittungMs`, eine Beispiel-Rückfrage beim `uebungRueckfrageBei`. Start; erreichbar ohne Kopplung; nichts außer
   * der Ansicht wird abgelegt. `uebungTaktSek` ist seit 21.11.2026 nur noch der Rückfall, wenn der WKR so lange
   * nichts tut (Y1–Y3 unten); sonst kommt der nächste Start 2–6 s nach dem Abschicken.
   */
  uebungQuittungMs: 300,
  uebungRueckfrageBei: 5,
  uebungStarts: 20,
  uebungTaktSek: 30,
  /** (G14) Liste ohne Maske: Das Gerät sagt „Papier“ und bietet „Pausieren“ an; der Bedienrechner kennzeichnet sie beim Koppeln. */
  ohneMaskePapier: true,
  /**
   * (G15) „Nicht vorbeigekommen“ erst mit W4 (Protokoll, Reducer, Matrix); bis dahin Bemerkung oder nichts schicken.
   * Eingelöst mit W4.3 (21.11.2026, P16 – `nichtVorbei*` unten).
   */
  nichtVorbeigekommenErstW4: true,
  /** (G16) Band „Liste abschließen“, sobald der eigene Punkt nicht mehr läuft und nicht abgeschlossen ist; unter „Mehr“ immer. */
  abschlussBand: true,
  // --- W3.1 beim Bau, 21.11.2026 (noch zu bestätigen) ------------------------------------------------------------
  /**
   * (H1) Ein Disq.-Buchstabe in der Maske ist ein Schalter (zweiter Tipp nimmt ihn wieder heraus) und steht im
   * Disq.-Feld in Tipp-Reihenfolge („A, X“ – so lässt sanitizeDisq ihn unverändert); hat die Liste kein eigenes
   * Disq.-Feld, gehen die Buchstaben in das erste Code-Feld des Teils (normalizeCodeCell sortiert sie dort).
   */
  disqAlsSchalter: true,
  /**
   * (H2) Ein Code-Tipp zählt +1 („2x20“); „− letzte zurück“ nimmt den letzten Tipp – Code ODER Disq. – zurück, der
   * Text der Bemerkung zählt nicht als Tipp (er hat sein eigenes Feld).
   */
  zurueckLetzterTipp: true,
  /**
   * (H3) Schlange je Steg-Teil auf dem Gerät: Eine eigene Zeile nimmt den Start nur aus der Schlange IHRES Teils
   * (eine Zeile ohne Teil aus beiden); ein Gerät für den ganzen Steg behält den Start in der gemeinsamen Schlange,
   * bis beide Teile erledigt sind (eigene Zeile oder `teile` der Sicht).
   */
  schlangeJeTeil: true,
  /**
   * (H4) Entwürfe liegen im Ausgang (36 h, gehen mit „Raum verlassen“), je Liste, Start und Teil; `schicke` räumt den
   * Entwurf dieses Starts und Teils. Nach dem Entzug bleiben sie lesbar (zum Übertragen aufs Papier).
   */
  entwurfImAusgang: true,
  /** (H5) Die Übungs-Sicht nimmt die Sprache des Regelwerks (DM deutsch, UIM englisch) wie eine echte Liste. */
  uebungSpracheRegelwerk: true,
  // --- W3.2 Bedienrechner: Liste zuweisen (beim Bau 21.11.2026, J1–J5, alle noch zu bestätigen) ---
  /**
   * (J1) „Maske folgt – Papier“ beim Zuweisen (wkr/maske.ts listeMitMaske): eine Liste hat in W3 eine Maske, wenn
   * JEDE Klasse der Starter, die sie hat, nur Katalog/Disq./Text trägt; ohne Starter zählen alle Klassen der Liste.
   */
  maskeNachStarterKlassen: true,
  /**
   * (J2) Der Hinweis „Handy: eine Liste“ (G3) richtet sich nach dem Gerätenamen: Das Register kennt keine Geräteart,
   * der Name ist aber bis zum Umbenennen die übersetzte Art (geraete.name.iphone / android-handy, de oder en).
   * Ein umbenanntes Handy bekommt den allgemeinen Hinweis „Handy eine, Pad höchstens zwei“.
   */
  handyNachName: true,
  /**
   * (J3) Mit nur einem Parcours ist die Start-Freigabe beim Koppeln vorgewählt (wie seit E7) – aber nur, solange keine
   * WKR-Liste gewählt ist: Ein Handy für eine Liste bekommt die Freigabe nur, wenn man sie ausdrücklich anhakt.
   */
  freigabeVorwahlOhneListe: true,
  /** (J4) Beim Koppeln genau eine Liste (oder keine); eine zweite gibt erst die Geräteliste (F15, Pad). Teil: Vorgabe „ganz“. */
  koppelnEineListe: true,
  /**
   * (J5) Verweis „Gerät koppeln“ in der Matrix an jeder Liste ohne Gerät – auch ohne offenen Raum (er führt dann zu
   * „Gerätebetrieb einschalten“) und auch bei Listen ohne Maske (dort steht beim Koppeln „Maske folgt – Papier“).
   */
  koppelnVerweisImmer: true,
  // --- W3.3 Handy-Maske „Knöpfe“ mit Rahmen (beim Bau 21.11.2026, K1–K9, alle noch zu bestätigen) ---
  /**
   * (K1) Disq. auf dem Handy: Der erste Tipp merkt den Buchstaben nur vor („noch einmal tippen“), der zweite setzt ihn;
   * ein gesetzter geht mit EINEM Tipp wieder heraus. X fragt danach noch einmal groß (F5). components/wkr/WkrDisq.vue.
   */
  disqZweiterTipp: true,
  /**
   * (K2) Gesperrt (inert + Prüfung in jedem Tipp) ist die Mitte samt Ausweichen und der Fuß vom Abschicken bis zum
   * Ende von `sperreMs` nach dem Wechsel – auch während des Overlays (N1), nicht erst nach dem Wechsel (sonst landete
   * ein Tipp auf dem schon gesendeten Start). „Zuletzt“, „Rückgängig“ und die Bänder liegen außerhalb (seit N1 vom
   * Overlay verdeckt, solange es steht); eine Korrektur oder „Rückgängig“ beendet den Takt.
   */
  sperreAuchGesendet: true,
  /**
   * (K3) Nach dem Entzug bleibt die Erfassung des Geräts offen (kein stop), damit nicht abgeschickte Entwürfe lesbar
   * bleiben (§5.6 „auf Papier übertragen“); sie schickt dann nichts mehr (erfassen.ts ohneListen). Gestoppt wird beim
   * Unmount, beim Entkoppeln und wenn GeraetFreigabe ein anderes Gerät öffnet.
   */
  erfassungBleibtNachEntzug: true,
  /** (K4) Der Entwurf geht bei JEDEM Tipp in den Ausgang (nicht erst beim Wechsel) – so überlebt er auch ein Neuladen mitten im Start. */
  entwurfJeTipp: true,
  /**
   * (K5) Pausiert/abgemeldet zeigt statt ausgegrauter Codes nur das große Band „Papierbogen gilt“ mit „Weiter digital“
   * (Zuletzt bleibt für Korrekturen) – ausgegraute Knöpfe verleiten in der Sonne zum Tippen.
   */
  pauseOhneKnoepfe: true,
  /** (K6) Gerät mit Start-Freigabe UND Liste: unten Reiter „Freigabe“ / Listenname, Vorgabe „Freigabe“ (Steg b vor Steg a). */
  reiterFreigabeZuerst: true,
  /** (K7) „So lassen“ an einer Rückfrage/Ablehnung legt das Band nur auf dem Gerät weg – keine Nachricht; der Bediener entscheidet ohnehin. */
  soLassenNurLokal: true,
  /**
   * (K8) Ziffernfeld der Suche mit einer Taste je Buchstaben vor den bekannten Startnummern (Schlange, „danach“,
   * „Zuletzt“): „E“ (E01), unter UIM auch „D“ (Dolphin-Präfix, AppState.dolphinPraefix) – Prüfbefund W3 21.11.2026,
   * vorher nur „E“. Verglichen wird ohne führende Nullen und ohne Groß/Klein („e1“ = „E01“, „d3“ = „D03“). Gesucht wird
   * in Schlange und „danach“ des gewählten Teils, dann in „Zuletzt“.
   */
  sucheMitE: true,
  /**
   * (K9) Hauptknopf mit Einträgen: „Abschicken · 5 Pkt. · Disq. P“ (Punkte nur der Codes, Disq. als Buchstaben), nur
   * Disq.: „Abschicken · Disq. A“; am Steg „Abschicken Ablegen · …“. Die Maske spricht die Sprache der Liste (tIn),
   * die Reiter der Freigabe die des Geräts.
   */
  hauptknopfMitDisq: true,
  // --- W3.4 Abschluss, Ansicht, Probe, Übung (beim Bau 21.11.2026, L1–L9, alle noch zu bestätigen) ---
  /**
   * (L1) Korrektur aus der Prüfansicht („Liste abschließen“) nur für Starts, deren neueste eigene Zeile noch in
   * „Zuletzt“ steht (≤ `zuletzt` Zeilen) – der Kern korrigiert über die Zeilennummer. Ältere Zeilen stehen nur zum Lesen da.
   */
  pruefKorrekturNurZuletzt: true,
  /**
   * (L2) Band „Liste abschließen“ (G16) konkret: der letzte eigene Punkt (neueste eigene Zeile) ist nicht der laufende
   * der Sicht – der nächste Lauf begann mit dem Zeigen seines ersten Starts – oder Schlange und „danach“ sind leer;
   * nicht bei Papier-Modus, abgeschlossenem Punkt (am Steg des eigenen Teils) oder eigenem Abschluss unterwegs/angenommen.
   */
  abschlussBandRegel: true,
  /** (L3) „Mehr → Liste abschließen“ nimmt den Punkt des Bands, sonst den laufenden, sonst den letzten eigenen. */
  abschlussPunktWahl: true,
  /**
   * (L4) Der WKR-Name wird beim Abschicken des Abschlusses gemerkt (auch wenn der Bedienrechner ihn ablehnt) – in der
   * Übung nie (dort bleibt nur die Ansicht, G13).
   */
  nameBeimAbschicken: true,
  /**
   * (L5) Sprache: Die Wahl der Sprache der Liste heißt „keine eigene Wahl“ (das Gerät folgt dann der Liste); eine
   * andere Wahl gilt für alle Listen des Geräts. Zweisprachige Liste (`de+en`): Vorgabe deutsch (G9).
   */
  spracheListeOhneWahl: true,
  /**
   * (L6) Probe nur, wenn die Liste eine Maske hat (wkr/maske.ts probeMaske – erste Klasse mit Maske); Steg ganz übt
   * das Ablegen; Vorsteg ohne X nur „In Ordnung“. Übersprungen zählt als erledigt. In der Übung kommt sie nie von
   * selbst, nur über „Mehr → Probe“ (und wird dort nicht abgelegt).
   */
  probeNurMitMaske: true,
  /**
   * (L7) Übung: Adresse `#/uebung` in jeder Sprache gleich (fest im Koppel-Formular); die Wahl spricht die Sprache der
   * Geräte-Oberfläche, die Maske die des Regelwerks (H5). Verweis auch ohne Kopplung („Kein Gerät“/„entkoppelt“);
   * „Übung verlassen“ führt zur Wahl zurück, „Zum Koppeln“ nach `#/geraet`.
   */
  uebungAdresseFest: true,
  /** (L8) „Mehr“ steht auch in Zuständen ohne Arbeit (außer „Verbinde …“): Ansicht, Sprache, Probe, Abschluss bleiben erreichbar. */
  mehrAuchInRuhe: true,
  /** (L9) Eine eigene Zeile ohne Eintrag mehr im Ausgang gilt in der Prüfansicht als „✓ übernommen“ (nur Quittiertes verlässt ihn). */
  pruefOhneStufeUebernommen: true,
  // --- Prüfbefunde W3 (21.11.2026, M1–M6, alle noch zu bestätigen) ---
  /**
   * (M1) Gemeinsame Felder des Stegs (Disq., Bemerkung) merkt das Gerät je Teil: `vorher` einer Zeile eines Teils kommt
   * für sie nur aus Zeilen DIESES Teils; leer und ohne eigenes `vorher` gehen sie gar nicht hinaus. Am Bedienrechner
   * vereinigt `vereinige` (Disq. nur dazu, Wegfall = Rückfrage `entfernt`). Der Stand ohne Teil (Prüfsumme, Prüfansicht
   * des ganzen Stegs) vereinigt beide Teile wie der Bedienrechner. Vorher löschte ein Gerät für den ganzen Steg mit
   * „Anlegen OK ✓“ still die Disq. und Bemerkung seines Ablegens.
   */
  gemeinsameFelderJeTeil: true,
  /**
   * (M2) Korrektur: Entwurf und „alt“ im Dialog aus dem eigenen Stand des Starts und Teils (Kern `stand(z)`), nie aus
   * den Zellen der Zeile – Korrekturzeilen tragen nur das Geänderte.
   */
  korrekturAusStand: true,
  /**
   * (M3) Ein vorgemerkter Disq.-Buchstabe (K1) gilt nur für diesen Start und Teil (WkrDisq je Start neu); in der Sperre
   * nach dem Abschicken merkt ein Tipp nichts vor.
   */
  disqVormerkenJeStart: true,
  /**
   * (M4) Bedienung über den Neuaufbau der Maske hinweg (Reiter Freigabe ↔ Liste, zwei Listen): „getrennt seit“ und
   * „wartend seit“ zählt der Kern (Wanduhr), „So lassen“ und „behalten“ hält ein Gedächtnis je Quelle und Liste im
   * Arbeitsspeicher (components/wkr/gedaechtnis.ts) – nach dem Neuladen der Seite kommen sie wieder.
   */
  gedaechtnisUeberReiter: true,
  /**
   * (M5) Bildschirm: Der Fuß mit dem Hauptknopf klebt unten (sticky); „Rückgängig“ steht in der Zeile der Leiste
   * „Zuletzt“ (feste Höhe), „Keine Bestätigung“ legt sich über den Kopf – was ohne Tipp kommt und geht, verschiebt die
   * Codes nicht. Das rote „Keine Verbindung“, Hinweise des Bedienrechners, verwaiste Entwürfe und das Abschluss-Band
   * stehen weiter im Fluss (selten, und sie brauchen ihre Knöpfe). Auf niedrigen Bildschirmen (≤ 700 px hoch) ist die
   * Startnummer 80 px statt 96 px groß.
   */
  bildschirmOhneNachrutschen: true,
  /**
   * (M6) Entwürfe nach dem Entzug: mit Titel und Bereich der Liste, Steg-Teil und Feldüberschriften, wie die Sicht sie
   * beim Ablegen nannte (im Ausgang mitgemerkt, `papier`) – nie ein Name.
   */
  entwurfFuersPapier: true,
  // --- Feldtest mit echtem Handy (21.11.2026, Befunde 1–4, 10, 11, 13, 14; N1–N7, alle noch zu bestätigen) ---
  // N1 steht bei den Zahlen oben (uebertragenMinMs, uebernommenMs, uebertragenMaxMs).
  /**
   * (N2) Ohne Quittung nach `uebertragenMaxMs`: Overlay weg, über dem Kopf (wie „Keine Bestätigung“, ohne die Codes
   * zu verschieben) „Start n gesendet – Bestätigung folgt“, bis die Zeile eine Antwort hat; ab `ohneQuittungMs`
   * übernimmt „Keine Bestätigung – Verbindung prüfen“.
   */
  bestaetigungFolgtBand: true,
  /**
   * (N3) Nie abgeschnittener Text (Befund 1): Umbruch überall, Silbentrennung nach Sprache, Nummern brechen nie; Code-
   * Knopf mit fester Spalte für Nummer und Zähler (der erste Tipp verschiebt nichts), Punkte neben dem Text, notfalls
   * darunter; Fuß: Nebenknöpfe höchstens 45 % der Breite. Ausnahme bleibt die Leiste „Zuletzt“ (M5: eine Zeile fester
   * Höhe, rechts fallen ältere Nummern weg – die Liste dahinter zeigt alle).
   */
  textNieAbschneiden: true,
  /**
   * (N4) Farben (Befunde 2, 11): Ursache waren gleichnamige Klassen in styles/app.css, die nach wkr-geraet.css geladen
   * werden und gewannen (Leiste „Zuletzt“ bekam unter System-Dunkelmodus die dunkle Fläche der App). Klassen der Maske
   * gibt es nur noch in wkr-geraet.css (Test), jede Fläche setzt Grund UND Schrift, `color-scheme` folgt dem Modus der
   * Maske, nie dem System.
   */
  farbenNurMaske: true,
  /**
   * (N5) Ende der Probe (Befund 4): „Probe fertig. Ab jetzt wird gesendet: …“ mit „Los geht's“ und klein „Probe
   * wiederholen“; das gelbe Band sagt dann „Probe beendet“. In der Übung statt „wird gesendet“ „gesendet wird nichts“.
   */
  probeEndeSatz: true,
  /**
   * (N6) Umschaltknopf im Fuß (Befund 10) nennt das Ziel: „DISQ“ bei offenen Codes, „FEHLER“ bei offenen
   * Disq.-Buchstaben (englisch „PENALTY“, kurz für schmale Handys); über der offenen Liste steht „Disq.“ wie „Fehler“
   * über den Codes. „Nr.“ heißt „Andere Startnummer …“ und steht über die volle Breite (Befund 3).
   */
  umschaltenNenntZiel: true,
  /**
   * (N7) Bildschirm (Befund 14a): Kann die Maske den Bildschirm nicht wach halten (lib/wachBleiben.ts: http ohne
   * Zertifikat, altes Gerät, Energiesparen), steht oben ein gelbes Band mit dem Tipp „Display-Zeit am Handy
   * verlängern“; „Ausblenden“ gilt bis zum Neuladen der Seite (nicht gemerkt – am nächsten Tag soll es wieder da sein).
   */
  wachHinweisInMaske: true,
  // --- Feldtest 21.11.2026, Start-Freigabe (Befunde 8, 9, 12; N8–N10, noch zu bestätigen) ---------------------------
  /**
   * (N8, Befund 8, ändert F4/A4) Die Start-Freigabe fragt schon ab EINEM offenen Start nach („Mann-über-Bord hat 604
   * noch nicht abgeschickt – trotzdem weiter?“), Vorgaben `rueckstandVorgabe` 1 und `warnungVorgabe` „nachfragen“.
   * Hart gesperrt wird nie: Ein Gerät kann ausfallen, der Bediener entscheidet; „Papier ab“ bleibt der Weg, eine Liste
   * aufs Papier zu nehmen. Das Freigabe-Handy fragt genauso (`warnt` und `warnung` rechnet der Host, D2).
   * Prüfbefund 21.11.2026, OFFEN (dem Nutzer vorgelegt): Der gerade gezeigte Start zählt schon als offen. Bei Listen,
   * die erst abschließen können, wenn das Boot den Parcours verlassen hat (Mann-über-Bord, Tor 5, Steg-Anlegen),
   * käme mit 2–3 Booten auf dem Wasser vor JEDEM „Nächster Start“ die Frage – Gewöhnung an den Dialog. Denkbar: R je
   * Listenart (1 für Ablegen/Vorsteg, 2 für Listen mit Boot auf dem Wasser) oder der zuletzt gezeigte Start zählt
   * nicht, solange er läuft. Bis zur Entscheidung gilt R = 1 für alle Listen; wer es lockerer will, stellt R höher.
   * Für das Steg-Anlegen entschieden vom Nutzer 21.11.2026 (Steg-Zeitversatz, {@link stegAnlegenNachlaufend}): Der
   * Start im Boot zählt dort nicht. Mann-über-Bord und Tor 5 bleiben offen.
   * Ein W2-Stand mit der alten Vorgabe 2/„warnen“ wird beim Laden einmal auf 1/„nachfragen“ gehoben
   * (state/reducer/betrieb.ts WKR_VORGABE_FASSUNG), sonst wirkte N8 bei schon angelegten Veranstaltungen nicht.
   */
  nachfrageAbEinem: true,
  /**
   * (N9, Befunde 9 und 12) Das Zeichen eines Feldes der Geräteleiste nennt den ERFASSUNGSSTAND, nicht die Verbindung:
   * ✓ fertig (grün, nichts offen), ⧗ wartet n (gelb/orange), ✕ Gerät weg (rot, schlechteste Ampel `weg` – auch wenn
   * noch etwas offen ist), ▭ Papier (kein Eintrag, Modus Papier, pausiert, abgemeldet). Die Verbindung steht klein
   * dahinter (● ◐ ○, ohne Gerät „–“); der grüne Punkt neben „1 offen“ las sich als „fertig“. Zeilen, die laut
   * Lebenszeichen noch im Gerät warten (A11), heißen „n im Gerät“ – ⧗ ist jetzt „wartet“.
   * Prüfbefund 21.11.2026: Digital und aktiv mit offenen Starts, aber OHNE Gerät (nie gekoppelt, entzogen) – da sendet
   * niemand, „⧗ wartet“ hieße „kommt gleich“. Also wie „Gerät weg“: ✕ rot, Text „kein Gerät · wartet n“.
   */
  leisteZeichenNachStand: true,
  /**
   * (N10, Befund 8) Der Dialog nennt je warnender Liste, welche Startnummern noch nicht abgeschickt sind; Titel
   * „Trotzdem weiter?“, Knopf „Trotzdem weiter“. Die Fokus-Vorgabe bleibt „Abbrechen“ (ein Enter zeigt nicht still).
   */
  frageNenntNummern: true,
  /**
   * (Befund 15, Prüfbefund 21.11.2026) Je Gerät sendet nur EIN Tab: der zuletzt geöffnete (geraete/tabWache.ts). Zwei
   * Tabs derselben Kopplung hielten je eine Sende-Schlange; kam die höhere Nummer des einen vor der niedrigeren des
   * anderen an, verwarf der Host die niedrigere still – ✓ am Handy, offen am Bedienrechner. Der ältere Tab zeigt
   * „In einem anderen Tab geöffnet“ mit „Hier weitermachen“.
   */
  einTabSendet: true,
  // --- Feldtest 21.11.2026, nach dem Neuladen und „Bitte Nr. prüfen“ (N11–N13, noch zu bestätigen) ---------------
  /**
   * (N11, Befund mit Bild: nach dem Neuladen sofort roter Kasten „Keine Verbindung – weiter erfassen, 0 Zeilen
   * warten“, „○ getrennt“ und „geschätzt (ohne Verbindung)“, obwohl nur der Aufbau lief) In den ersten
   * `verbindeKarenzSek` nach dem Öffnen der Erfassung zeigt die Maske neutral „◌ verbinde …“ – kein Rot, keine
   * geschätzten Starts. Rot erst, wenn die Karenz ohne Verbindung um ist oder eine bestehende Verbindung abreißt
   * (geraete/erfassen.ts `verbindung`). 12 s: Der Aufbau (WebSocket, Abo mit `since`, Begrüßung) dauert im Mobilnetz
   * meist 1–5 s; ein Funkloch, das länger dauert, soll der WKR bald sehen. 21.11.2026, noch zu bestätigen.
   */
  verbindeKarenzSek: 12,
  /**
   * (N12, selber Befund) Die Zahl wartender Zeilen steht nur, wenn sie größer als 0 ist – „0 Zeilen warten“ hieß nichts
   * und las sich wie ein Fehler. Ohne wartende Zeile sagt das Band nur „Keine Verbindung – weiter erfassen“.
   * 21.11.2026, noch zu bestätigen.
   */
  wartendNurUeberNull: true,
  /**
   * (N13, Nutzer: „Da kommt nur eine gelbe Meldung und ein Gesehen-Button. Ich komme aber nicht in diese Startnummer
   * rein.“) „Bitte Nr. prüfen“ vom Bedienrechner zeigt auf dem Handy „Bediener bittet: Start 601 prüfen“ mit dem
   * Hauptknopf „601 öffnen“: schon gesendet → Korrektur mit den bisherigen eigenen Werten (`stand(z)`); noch offen in
   * der Schlange bzw. „danach“ → Eingabe dieses Starts; auf dem Gerät unbekannt → Suche mit 601 vorbelegt (und dem
   * Satz „nicht in der Folge“). Gesendet geht vor offen, außer die eigene Zeile wurde abgelehnt (dann steht der Start
   * wieder offen). Das Öffnen meldet den Hinweis zugleich als gesehen – der WKR hat reagiert; „Gesehen“ steht klein
   * daneben für „schon erledigt“. 21.11.2026, noch zu bestätigen.
   */
  pruefenOeffnet: true,
  // --- W4 Bojen-Maske (docs/plan-wkr-w4.md §10, P1–P15 und P17; 21.11.2026 beim Planen bzw. Bau W4.1, alle noch zu bestätigen) ---
  /**
   * (P1) Bojen-Maske an den Feldern erkannt: Ein `buoy`-Feld ist eine Boje der Maske, wenn seine Kennung auf dem
   * Fahrweg (config/kurzform.ts FAHRWEG) oder dem Parallel-Fahrweg (wkr/bojen.ts PARALLEL_FAHRWEG) liegt; sonst
   * (Knoten, eigene ausführliche Aufbauten) bleibt die Liste Papier. Listen mit Zeit- oder Punktfeldern bleiben
   * `spaeter` (W5). Gemischte Listen (Bojen + Einfahrt Tor 5 / MüB, Disq., Bemerkung) bekommen EINE Maske.
   * 21.11.2026, noch zu bestätigen.
   */
  bojenAmFahrweg: true,
  /**
   * (P2, F2) Schalter und Zähler: Zähler nur die Torbojen von Tor 5 (je Richtung ein Feld); Start/Ziel, Tore 1–4,
   * Speedbojen und die Bojen des Parallelslaloms sind Schalter. Unter UIM gleich (Regel 960 Pkt. 5.3 nennt nur
   * „Touching of a buoy“; die Spalten sind dieselben). 21.11.2026, noch zu bestätigen.
   */
  zaehlerNurTor5: true,
  /**
   * (P3) Tor 1 auf der Rückfahrt: zwei Zeilen mit je einem Schalter je Boje (Felder `t1b`, `t1c`); die zweite
   * („2. Durchfahrt“, `durchfahrt: 2`) an ihrem Platz nach Sp. 2 – kein Zähler 0–2, weil der Bogen zwei Spalten hat.
   * 21.11.2026, noch zu bestätigen.
   */
  tor1ZweiZeilen: true,
  /**
   * (P4) Punkte je Berührung fest 5 – DM „je Boje und je Fahrtrichtung 5“, „Tor 5 … je Boje und Berührung 5“, UIM
   * „Touching of a buoy 5“ (Regelwerk `direktpunkte`, wkr/bojen.test.ts vergleicht). Zellwert = Punkte („5“, Zähler
   * „10“), wie auf dem Papier. 21.11.2026, noch zu bestätigen.
   */
  bojenPunkte: 5,
  /**
   * (P5) Ein Zähler nimmt höchstens so viele Tipps je Feld an (danach sagt der Knopf es kurz); zurück nur über
   * „− letzte zurück“. 9 × 5 = 45 Punkte an einer Torboje – mehr ist am Wasser nicht zu sehen, ein Hänger am Knopf
   * soll keine Zahl erzeugen, die keiner bemerkt. 21.11.2026, noch zu bestätigen.
   */
  bojenZaehlerMax: 9,
  /**
   * (P6) Fahrtfolge: Zeilen nach FAHRWEG, nicht nach den Spalten des Bogens (frontal135 hat dieselbe Folge wie
   * gate135, obwohl der Bogen Tor 5 rück vor hin stellt); Katalog-Abschnitte an ihrem Platz – Einfahrt Tor 5
   * zwischen Tor 5 hin und rück (zählt zum Hinweg), MüB nach Tor 1 R (Rückweg), ein Katalog ohne Platz ans Ende.
   * Parallelslalom: Folge der Spalten, Boje 5 (Wende) zum Hinweg. 21.11.2026, noch zu bestätigen.
   */
  fahrtfolge: true,
  /**
   * (P7) Seiten nach Blick: zwei Knopfspalten in der Reihenfolge der Unterspalten auf dem Bogen dieser Liste (die
   * Kurzform ordnet sie nach `blick`; maßgeblich ist die erste Spalte mit zwei verschiedenen Bojen); Einzelboje in der
   * Spalte ihrer Seite; Speedboje, Parallel-Bojen 1–5 und Listen ganz ohne zweibojiges Tor volle Breite. Beschriftung
   * = Kopf der Unterspalte wie auf dem Bogen (Beschriftungsschema wirkt von selbst). 21.11.2026, noch zu bestätigen.
   */
  seitenNachBlick: true,
  /**
   * (P8) Umschalter Hinweg/Rückweg erst bei MEHR als so vielen Zeilen (Halte + Codes der Katalog-Abschnitte) der
   * Klasse – gate135 Klasse 4 (7 Zeilen) ohne, Klassen 5–7 mit. Wechselt nie von selbst; neuer Start auf „Hinweg“,
   * ein Start mit Entwurf auf seiner letzten Seite; Zahl der Einträge je Seite am Reiter (wkr/maske.ts eintraegeAuf).
   * 21.11.2026, noch zu bestätigen.
   */
  bojenZeilenEineSeite: 7,
  /**
   * (P9, ersetzt durch U1 am 21.11.2026) Bis dahin: Disq. auf Bojen-Listen immer ins Disq.-Feld der Liste, kein „an
   * welcher Boje?“. Der Nutzer fragte am 21.11.2026 („Was ist der Stand mit den Disq. und der Zuordnung an die Boje?
   * Aktuell kann ich das noch nicht eingeben.“) – seitdem gilt {@link WKR_ANNAHMEN.disqAnBoje}. Disq. ohne Boje
   * gehen weiter über den DISQ-Knopf ins Disq.-Feld.
   */
  disqNieInBoje: false,
  /**
   * (U1, Nutzer 21.11.2026) Disq. an der Boje wie auf dem Papier: Die Bojenzelle nimmt Punkte ODER einen erlaubten
   * Disq.-Buchstaben (lib/disq.ts sanitizeBuoy) – genau das schickt das Gerät. Bedienung: „Disq. an Boje“ (Knopf über
   * den Bojen) → Boje antippen → Liste der Buchstaben DIESER Zelle (alle, die die Zelle annimmt, wie beim Abtippen –
   * keine engere Auswahl nach Bedeutung) → die Boje zeigt den Buchstaben statt 5/0. Im Disq.-Modus nimmt ein Tipp auf
   * eine Boje mit Buchstaben ihn wieder heraus. Nach dem Setzen verlässt die Maske den Disq.-Modus (ein Disq. je
   * Gang, kein zweiter aus Versehen). 21.11.2026, noch zu bestätigen.
   */
  disqAnBoje: true,
  /**
   * (U2) Ein Buchstabe ersetzt die Berührungen DIESER Boje (die Zelle hält nur eins, sanitizeBuoy nähme sonst den
   * Buchstaben und verwürfe die Punkte still): Setzen löscht ihre Berührungen samt Merkern, Herausnehmen stellt sie
   * nicht wieder her. Ohne Disq.-Modus nimmt eine Boje mit Buchstaben keinen Tipp an (kein stilles Überschreiben).
   * „− letzte zurück“ nimmt einen Buchstaben wie jeden Tipp zurück. 21.11.2026, noch zu bestätigen.
   */
  disqBojeErsetztPunkte: true,
  /**
   * (U3) Langes Drücken auf eine Boje als zweiter Weg (Handschuhe) ist NICHT gebaut – Frage an den Nutzer: Lange
   * Tipps sind mit Handschuhen schwer abzugrenzen und kollidierten mit dem Prellschutz (S1); der Knopf „Disq. an Boje“
   * ist sichtbar und übt sich in der Probe. 21.11.2026, noch zu bestätigen.
   */
  disqBojeOhneLangdruck: true,
  /**
   * (U4) Die Probe hat auf Bojen-Listen einen Schritt „Disq. an Boje“ (vor dem Hauptknopf): an der ersten Boje mit
   * Buchstaben im RECHTEN Knopf der ersten zweibojigen Zeile (bzw. der ersten Boje), mit ihrem ersten Buchstaben – der
   * Hauptknopf heißt danach „Abschicken“. Mit Umschalter (Fahrtfolge) liegt die Boje auf der gerade offenen Seite:
   * nach dem Rückweg-Schritt auf dem Rückweg, ohne Buchstaben dort kommt der Schritt vor den Rückweg-Schritt
   * (Prüfbefund 21.11.2026 – sonst stand die genannte Boje nicht auf dem Bildschirm). 21.11.2026, noch zu bestätigen.
   */
  probeDisqAnBoje: true,
  /**
   * (V1, Nutzer 21.11.2026: „Die Reihenfolge der Tore soll der WKR bitte auch wechseln können … von oben nach unten so
   * durchgehe, wie die Boote fahren, jedoch ist das nicht so, wie der Parcours liegt.“) Mehr → Ansicht: „Fahrtfolge“
   * (Vorgabe, P6) oder „Wie der Parcours liegt“ – je Ort im Parcours EINE Gruppe (Tor 1 mit Hin, Rück und 2.
   * Durchfahrt; Start und Ziel zusammen; Einfahrt Tor 5 bei Tor 5; MüB an der Schikane zwischen Start und Tor 1;
   * Sp. 1 und Sp. 2 zusammen hinter Tor 5), Gruppen nach der Lage längs der Strecke (wkr/bojen.ts BOJEN_LAGE, belegt
   * an den x-Koordinaten der Parcours-Bilder, bojen.test.ts). In der Gruppe die Zeilen in Fahrtfolge. Gemerkt je
   * Gerät und Liste (ablage.ts `alcatraz.geraet.ansicht` → `bojen[liste]`, wie Hand und Modus). 21.11.2026, noch zu
   * bestätigen.
   */
  bojenNachLage: true,
  /**
   * (V2) Spiegeln: „Start oben“ (Vorgabe) bzw. „Start unten“ dreht die Folge der Gruppen um (Blick von Start bzw. vom
   * Wendepunkt her, der WKR steht links bzw. rechts der Strecke), nur in der Lage-Ansicht; „Bojen links/rechts
   * tauschen“ tauscht die zwei Knopfspalten in BEIDEN Ansichten (falls der Bogen-Blick nicht zum Standort passt). Der
   * Umschalter Hinweg/Rückweg fällt in der Lage-Ansicht weg (ein Tor steht nur einmal da, die Seite scrollt).
   * Dieselbe Lagequelle nimmt später das Bild-Layout von W5. 21.11.2026, noch zu bestätigen.
   */
  bojenSpiegeln: true,
  /**
   * (P10) Klassenwechsel: Hat der Start andere Halte als der zuvor gezeigte, liegt so lange ein Band „Klasse n –
   * andere Halte“ über der Mitte, ohne Knöpfe zu verschieben und ohne einen Tipp zu nehmen. 21.11.2026, noch zu
   * bestätigen.
   */
  klassenWechselMs: 2000,
  /**
   * (P11) Probe auf Bojen-Listen an der Klasse mit den meisten Zeilen (wkr/maske.ts probeMaske; zeigt Speedrunde und
   * Umschalter), mit Bojen-Schritten (Schalter, zurück, ggf. Zähler, ggf. Umschalter, Fehlerfrei); Katalog-Teile
   * gemischter Listen übt sie nicht. 21.11.2026, noch zu bestätigen.
   */
  probeMeisteZeilen: true,
  /**
   * (P12) Übung mit Bojen-Listen: Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel; unter UIM Parallelslalom
   * Racecourse A nur als Maske (ohne Paar, ohne Attempt-Wechsel). 21.11.2026, noch zu bestätigen.
   */
  uebungBojen: true,
  /**
   * (P13) „Fehlerfrei“ auf Bojen-Listen = Zeile mit leeren Feldern wie W3; „Abschicken · n Pkt.“ zählt Bojen und
   * Codes (wkr/maske.ts punkteVon). 21.11.2026, noch zu bestätigen.
   */
  bojenFehlerfrei: true,
  /**
   * (P14) Texte in Zuletzt, Korrektur und Prüfansicht: „Tor 1 H L: 5 · Tor 5 H R: 10“ (Kopf wie auf dem Bogen);
   * Punkte in der Prüfansicht auch bei Bojen. 21.11.2026, noch zu bestätigen.
   */
  bojenTexteWieBogen: true,
  /**
   * (P15) Sicht: `MaskenFeld.boje` {halt, weg, folge, titel, unter, spalte, zaehler?, durchfahrt?} – nur Bogentexte
   * und Fahrweg-Angaben, keine Werte; `AndereFeld.boje` {titel, unter}; LISTEN_SICHT_FASSUNG 4. Die Seitenfolge
   * kommt aus der ganzen Liste, nicht der Klasse (dieselbe Boje steht in jeder Klasse in derselben Spalte).
   * 21.11.2026, noch zu bestätigen.
   */
  bojenInSicht: true,
  /**
   * (P17) Startnummer auf Bojen-Listen 80 px statt 96 px (styles/wkr-geraet.css `.wkr-maske--bojen`) – die Zeilen
   * brauchen den Platz; sonst wie W3. 21.11.2026, noch zu bestätigen.
   */
  bojenStartnr80: true,
  // --- W4.2 beim Bau (Oberfläche Bojen-Maske, 21.11.2026, Q1–Q7, alle noch zu bestätigen) ---
  /**
   * (Q1) Probe, erster Schritt: der LINKE Knopf (Spalte 0) der ersten zweibojigen Zeile – gate135 „Tor 1 · H R“. Der
   * Plan §5.3 nennt die Regel „linker Knopf“, sein Beispiel aber „H L“ (rechts); es gilt die Regel. Nach dem
   * Zähler-Schritt stehen Berührungen im Entwurf: Der letzte Schritt heißt dann „Abschicken“ statt „Fehlerfrei“.
   * 21.11.2026, noch zu bestätigen.
   */
  probeLinkerKnopf: true,
  /**
   * (Q2) Klassenwechsel-Band (P10) liegt unter der Starterkarte über dem Anfang der Mitte (absolut): Die Startnummer
   * bleibt lesbar, kein Knopf rutscht; Tipps auf seiner Fläche fängt es ab (darunter liegen höchstens „Ausweichen“
   * bzw. die ersten Knöpfe). Nicht beim ersten Start der Maske, nicht in der Korrektur; nur auf Bojen-Listen.
   * 21.11.2026, noch zu bestätigen.
   */
  klassenWechselUnterKarte: true,
  /**
   * (Q3) Zähler am Höchstwert (P5): „höchstens 9×“ steht dauerhaft im Knopf neben „9× = 45“ statt einer kurzen
   * Meldung – eine kommende und gehende Zeile würde die Knöpfe darunter verschieben (M5). 21.11.2026, noch zu bestätigen.
   */
  zaehlerMaxImKnopf: true,
  /**
   * (Q4) Seite des Umschalters je Start und Steg-Teil im Gedächtnis der Maske (components/wkr/gedaechtnis.ts `wege`,
   * je Quelle und Liste, nur Arbeitsspeicher): übersteht Ausweichen und Reiterwechsel, nicht das Neuladen. Eine
   * Korrektur beginnt wie ein neuer Start auf „Hinweg“. 21.11.2026, noch zu bestätigen.
   */
  wegJeStart: true,
  /**
   * (Q5) Beschriftung: Eine Boje ohne Unterspalte (Speedboje, Parallel-Bojen 1–5) heißt im Knopf „Berührt“ (der
   * Titel steht schon links); in Zuletzt/Korrektur/Prüfansicht trägt die 2. Durchfahrt den Vermerk „(2. Durchf.)“
   * („Tor 1 (2. Durchf.) R L: 5“), und die Texte folgen der Maske (Fahrtfolge, Disq., Bemerkung), nicht den Zellen.
   * 21.11.2026, noch zu bestätigen.
   */
  bojenBeschriftung: true,
  /**
   * (Q6) Ohne Umschalter (≤ bojenZeilenEineSeite Zeilen) stehen beide Wege untereinander mit den Kopfzeilen HINWEG
   * und RÜCKWEG (nur wenn es beide gibt) – der Plan zeigt sie nur am Umschalter. 21.11.2026, noch zu bestätigen.
   */
  wegKopfOhneUmschalter: true,
  /**
   * (Q7) Übung (P12): Zur Wahl stehen nur Listen des gewählten Regelwerks – der Parallelslalom nur unter UIM
   * (config/catalog.ts hasParallel); wer mit „Parallelslalom“ gewählt auf DM wechselt, landet bei Tor 5. In der Übung
   * hat der Parallelslalom normale Übungsstarts (Klasse, Lauf), kein Paar und keinen Attempt-Wechsel. 21.11.2026,
   * noch zu bestätigen.
   */
  uebungListenDesRegelwerks: true,
  // --- Prüfbefunde W4 (21.11.2026, S1–S6, alle noch zu bestätigen) ---
  /**
   * (S1) Prellschutz der Bojen-Schalter: Ein zweiter Tipp auf denselben Schalter innerhalb dieser Zeit wird verworfen
   * (components/wkr/WkrMaske.vue tippeBojeKnopf, Zeitmarke je Feld). Sonst nähme ein prellender Handschuh-Tipp oder ein
   * ungeduldiger zweiter Tipp die Berührung still wieder weg, und „Fehlerfrei“ schickte den Start ohne die 5 Punkte.
   * Wegnehmen bleibt per Tipp möglich (danach, oder über „− letzte zurück“). Zähler (Tor 5) zählen jeden Tipp – die
   * Zahl zeigt es. 400 ms: länger als ein Prellen, kürzer als ein bewusstes „doch nicht“. 21.11.2026, noch zu bestätigen.
   */
  bojenSchalterPrellMs: 400,
  /**
   * (S2) „Bitte Nr. prüfen“ (N13) sucht die gesendete Zeile nur im laufenden Punkt (Lauf, Attempt): „Zuletzt“ reicht
   * über Punkte hinweg, die Nummer kommt in Lauf 1 und 2 vor. Keine Zeile im laufenden Punkt → offen bzw. unbekannt
   * (Suche vorbelegt; von dort erreicht der WKR auch eine Zeile eines früheren Punkts). 21.11.2026, noch zu bestätigen.
   */
  pruefenNurLaufenderPunkt: true,
  /**
   * (S3) Das Band „Nr. n ist nicht in der Folge“ nach „n öffnen“ in der Ruhe verschwindet, sobald ein Start gezeigt
   * wird, beim Abschicken, „Nicht vorbeigekommen“ und Öffnen einer Korrektur – und hat „Gesehen“. 21.11.2026, noch zu
   * bestätigen.
   */
  unbekanntBandKurz: true,
  /**
   * (S4) Tor-5-Zähler bei 360 px: Ohne Berührung steht „0×“ statt „Berührungen“ (das Wort passte nicht in den halben
   * Knopf); am Höchstwert steht „höchstens 9×“ als eigene Zeile unter „9× = 45“, der Stand bricht an Leerzeichen um,
   * die Zahl nie (N3: nichts abgeschnitten, nichts über den Knopfrand). 21.11.2026, noch zu bestätigen.
   */
  zaehlerStandZweiZeilen: true,
  /**
   * (S5) „Bediener bittet: Start n prüfen“ kommt ohne Tipp: Es liegt wie „Keine Bestätigung“ ÜBER Kopf und Karte
   * (`.wkr-kopf-ueber`), statt den Kopf zu verlängern – sonst rutschten alle Bojen- und Code-Knöpfe um gut 100 px,
   * und ein Tipp in dem Moment träfe eine andere Boje (M5). Es deckt solange die Starterkarte; „n öffnen“ bzw.
   * „Gesehen“ nehmen es weg. Vorrang: getrennt (rot) bleibt im Fluss, der Hinweis liegt über „Keine Bestätigung“.
   * 21.11.2026, noch zu bestätigen.
   */
  hinweisUeberKopf: true,
  // --- W4.3 „Nicht vorbeigekommen“ (Plan docs/plan-wkr-w4.md §6, 21.11.2026, P16 und R1–R8 beim Bau, alle noch zu bestätigen) ---
  /**
   * (P16, löst G15 ein) „Nicht vorbeigekommen“ unter „Mehr“ mit großer Rückfrage: Zeile ohne Zellen mit `n`
   * (GeraeteZeile.n, nur mit leerem `c`, sonst `wert-ungueltig`), setzt den Haken (Schlange und Rückstand gehen weiter
   * – das Boot kommt ja nicht) und das Kennzeichen WkrStand.nichtVorbei; kein X, keine Wertung. Matrix „⊘“ gelb mit
   * Wort, Erfassung „Papier ansehen“, LISTEN_SICHT_FASSUNG 5. 21.11.2026, noch zu bestätigen.
   */
  nichtVorbei: true,
  /**
   * (P16, R1) Nicht dort, wo X erlaubt ist (`xListen`/`xTeil`, F5): Vorsteg und Steg-Ablegen – dort kommt jedes Boot
   * vorbei oder startet nicht. Abgelehnt mit eigenem Code `nv-nicht-erlaubt` (nicht `teil-fremd`, damit das Gerät
   * sagen kann, warum). Ein Gerät für den ganzen Steg schickt es nur für den Teil Anlegen; die Maske bietet es dort
   * nur im Reiter „Anlegen“ an. 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiNichtBeiX: true,
  /**
   * (R2) Kennzeichen am Bedienrechner nur, wo die Zeile gilt: direkt übernommen, oder als Vorschlag (Punkt
   * abgeschlossen, Papier) bzw. Rückfrage (Start nicht gezeigt) erst mit „Übernehmen“ bzw. „Gerät übernehmen“. Vorschlag
   * und Rückfrage tragen es mit (WkrVorschlag/WkrRueckfrage `nichtVorbei`, `teil`), der Eingang zeigt „⊘ nicht
   * vorbeigekommen“. Geändert mit dem Prüfbefund 21.11.2026 (vorher fiel es dort still weg, die Matrix zeigte ✓).
   * 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiNurDirekt: true,
  /**
   * (R3) Aufgehoben wird das Kennzeichen von jeder späteren Zeile desselben Starts (und Teils) OHNE `n` – auch einer
   * leeren „fehlerfrei“-Korrektur („doch vorbei“) –, aber wie beim Setzen (R2) erst, wenn sie gilt: direkt übernommen
   * bzw. Vorschlag übernommen / Rückfrage für das Gerät entschieden; ein verworfener Vorschlag lässt ⊘ stehen
   * (Prüfbefund 21.11.2026). Ebenso von eigenen Werten der Liste in der Zelle (Abtippen am Bedienrechner; am Steg Werte
   * des Anlegens). Der Haken bleibt. 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiAufheben: true,
  /**
   * (R4) Zellstand `nv` in der Matrix (wkr/lage.ts): Vorrang nach Rückfrage und Vorschlag, vor dem Haken; zählt nicht
   * als Rückstand (der Haken ist ja gesetzt); am Steg: Anlegen `nv` und Ablegen erfasst → ganze Zelle `nv`. Die
   * Erfassung markiert die Zeile „Papier ansehen“ (am Steg die Zellen des Anlegens) – ob der Bogen etwas sagt. Die
   * Start-Freigabe warnt nicht. 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiZelle: true,
  /**
   * (R5) Abschluss: Der Bedienrechner nennt je Abschluss die Startnummern mit Kennzeichen in diesem Punkt (und Teil)
   * („1 nicht vorbeigekommen: 27“); die Prüfansicht des Geräts zählt sie aus dem eigenen Ausgang. Der Abschluss selbst
   * speichert sie nicht (das Kennzeichen kann später fallen). 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiImAbschluss: true,
  /**
   * (R6) Gerät: „Nicht vorbeigekommen“ unter „Mehr“ nur, wenn ein Start gezeigt wird, nicht in der Korrektur, nicht in
   * der Probe; es verwirft einen Entwurf dieses Starts (die Rückfrage sagt „Es wird nichts eingetragen.“). Eine
   * Korrektur einer ⊘-Zeile beginnt leer; „Abschicken“ (auch leer = fehlerfrei) hebt es auf. 21.11.2026, noch zu
   * bestätigen.
   */
  nichtVorbeiMehr: true,
  /**
   * (R7) Verlauf: WKR_ZEILEN, deren Zeilen alle „nicht vorbeigekommen“ sind, heißen `wkrNichtVorbei` (Liste + Gerät);
   * gemischte Bündel bleiben `eingabeGeraet`. 21.11.2026, noch zu bestätigen.
   */
  nichtVorbeiVerlauf: true,
  /**
   * (R8) Übung (geraete/uebung.ts): „Nicht vorbeigekommen“ geht wie echt (Zuletzt ⊘, Prüfansicht), erledigt den Start;
   * die Ablehnung am Vorsteg/Ablegen prüft die Übung nicht nach – die Maske bietet es dort gar nicht an. 21.11.2026,
   * noch zu bestätigen.
   */
  nichtVorbeiUebung: true,
  // --- Nutzer 21.11.2026: Steg-Zeitversatz und „Abmelden“ am Gerät (T1–T8, alle noch zu bestätigen) ---------------
  /**
   * (T1, Nutzer 21.11.2026: „Eine Startnummer kann nicht gleichzeitig am Steg und im Parcours sein. Steg läuft deswegen
   * beim Ablegen etwas vor der Tafel und dem Parcours und beim Anlegen hinterher.“) Ablegen ist VORAB wie der Vorsteg:
   * Die Schlange des Ablegens (und eines Geräts für den ganzen Steg) enthält schon die nächsten freien Starts, bevor die
   * Start-Freigabe sie zeigt – so viele, wie „Am Steg“ der Anzeige zählt (`anzeige.amSteg`, mindestens 1 = „Als
   * Nächstes“). Die Boote am Steg legen als Nächste ab; „Vor Steg“ wartet noch an Land. Zeilen dieser Starts gelten als
   * gezeigt (wie am Vorsteg), sie zählen erst ab dem Zeigen als Rückstand. Der Papierbogen „Steg“ bleibt, wie er ist.
   * 21.11.2026, noch zu bestätigen.
   */
  stegAblegenVorab: true,
  /**
   * (T2, selber Befund) Anlegen ist NACHLAUFEND: Ein Start kommt erst in die Schlange des Anlegens, wenn er nicht mehr
   * „Im Boot“ ist – ein späterer Start wurde gezeigt, oder in seinem Punkt (Lauf, Runde) steht kein Start mehr aus
   * (frei, zurückgestellt, „Boot fehlt“, nachzuholen – Prüfbefund 21.11.2026, vorher nur frei); der letzte Start eines
   * Laufs bleibt zwar auf der Tafel stehen, kommt aber zurück (Nutzer: „bzw. Lauf/Punkt endet“), damit das Anlegen-Gerät
   * ihn noch erfassen und die Liste abschließen kann. Die Matrix zeigt das Anlegen im Boot als „kommt noch“ (`spaeter`).
   * Den Rückstand vor „Nächster Start“ zählt das Anlegen des Starts auf der Tafel (`aktuell`) NIE – auch am Ende eines
   * Punkts nicht (Prüfbefund 21.11.2026: sonst fragte die Start-Freigabe mit R = 1 an jeder Laufgrenze; Nutzer:
   * „Anlegen des aktuellen Starts zählt NICHT als offen“). 21.11.2026, noch zu bestätigen.
   */
  stegAnlegenNachlaufend: true,
  /**
   * (T3) Ein Gerät für den ganzen Steg zeigt nie denselben Starter zugleich im Ablegen und im Anlegen: Steht ein Start
   * noch in der Schlange des Ablegens (Ablegen nie abgeschickt), wartet sein Anlegen, bis das Ablegen geschickt ist –
   * am Steg kommt zuerst das Ablegen. Nur auf dem Gerät (geraete/erfassen.ts, geraete/uebung.ts); am Bedienrechner
   * sind beide Teile offen, wie sie sind (zwei Teil-Geräte sehen jedes seinen Teil). 21.11.2026, noch zu bestätigen.
   */
  stegGanzAblegenZuerst: true,
  /**
   * (T4) Ohne Verbindung schätzt das Gerät aus „danach“ nur das Ablegen weiter – nie das Anlegen (es kommt erst nach
   * dem Zeigen). 21.11.2026, noch zu bestätigen.
   */
  stegAnlegenNieGeschaetzt: true,
  /**
   * (T9) „Liste abschließen“ (Anlegen bzw. ganzer Steg) rechnet mit derselben Schlange wie das Gerät: Der Start im Boot
   * zählt dort nicht als offen. Die Prüfansicht des Geräts kennt ihn ebenso wenig – sonst lehnte der Bedienrechner einen
   * Abschluss mit „offen“ ab, den das Gerät als vollständig zeigt. Abgeschlossen wird ohnehin nach dem Lauf (dann gilt
   * der letzte Start als zurück, T2, und zählt wieder); ein Anlegen, das nach einem verfrühten Abschluss kommt, wird
   * Vorschlag. 21.11.2026, noch zu bestätigen.
   * Pause, Abmelden und „Papier ab“ dagegen nehmen das Anlegen des Starts im Boot MIT in P (Prüfbefund 21.11.2026):
   * Das Boot kommt während der Pause zurück, der WKR schreibt das Anlegen auf den Bogen. Ohne P fiele es nach „Weiter“
   * (bzw. neu Zuweisen und „Weiter“) wieder offen in die Schlange, stünde doppelt auf dem Gerät und ließe die
   * Start-Freigabe fragen.
   */
  stegAbschlussOhneImBoot: true,
  /**
   * (T5, Nutzer 21.11.2026: „Beim Abmelden auf dem WKR-Gerät bleibt die Position trotzdem offen und es wird der nächste
   * Starter angezeigt. … Das muss so sein, als ob ich die Liste von dem Gerät entferne.“) „Abmelden“ am Gerät wirkt wie
   * das Entfernen der Liste am Bedienrechner, ausgelöst vom Gerät: Der Host setzt die Liste (Teil-Gerät: seinen Teil)
   * `abgemeldet` – P wie bisher, zählt nicht als offen, keine Rückfrage vor „Nächster Start“, Matrix und Leiste ▭ –,
   * nimmt dem Gerät die Aufgabe `liste` (Register, neuer Schlüssel der Listen-Gruppe wie beim Entzug) und quittiert
   * direkt. Das Gerät zeigt sofort (ohne auf die Quittung zu warten) die Ruhe-Ansicht „Von Liste X abgemeldet“ mit
   * seinen Entwürfen und „Zuletzt“ zum Übertragen aufs Papier; ein „Weiter digital“ gibt es dort nicht mehr. Wieder
   * dabei nur über neues Zuweisen bzw. Koppeln am Bedienrechner (dann gilt `weiter` wie bisher über den Bediener).
   * Pausieren bleibt, wie es ist. Das Gerät verlässt die Ruhe beim neuen Zuweisen, sobald es die Liste fehlen sah ODER
   * eine Sicht der Liste kommt, die die Abmeldung schon verarbeitet hat (`bis` ≥ ihre Nummer – lesbar nur mit dem neuen
   * Schlüssel; Prüfbefund 21.11.2026: Gerät schlief bzw. lud neu, Entzug und Zuweisung im selben Takt). 21.11.2026,
   * noch zu bestätigen.
   */
  abmeldenWieEntfernen: true,
  /**
   * (T6) Hat nach dem Abmelden KEIN Gerät mehr diese Liste (auch nicht für den anderen Teil), wird die ganze Liste
   * abgemeldet – sonst bliebe ein Teil digital ohne Gerät „offen“ und die Start-Freigabe fragte weiter (Ursache des
   * Befunds, Teil-Gerät „Ablegen“ allein). Hat ein anderes Gerät die Liste noch, wird nur abgemeldet, was danach kein
   * Gerät mehr abdeckt (Prüfbefund 21.11.2026, „wie Entfernen bei EINEM Gerät“): am Steg der eigene Teil bzw. beim Gerät
   * für den ganzen Steg der Teil, den das andere nicht hat (WKR_ANNAHMEN.pauseJeTeil); deckt das andere alles ab (auch
   * jede ungeteilte Liste), ändert sich am Status nichts, nur die Aufgabe fällt weg. Das Entfernen einer Liste am
   * Bedienrechner (Geräteliste) setzt weiter keinen Status: Dort ist es oft ein Umhängen auf ein anderes Gerät, und ein
   * neues Zuweisen holt eine abgemeldete Liste nicht von selbst zurück. 21.11.2026, noch zu bestätigen.
   */
  abmeldenLetzterGanz: true,
  /**
   * (T7) Kein Knopf „Bitte wieder zuweisen“ in der Ruhe-Ansicht: Das Gerät hat nach dem Abmelden keine Rechte an der
   * Liste mehr, eine Bitte bräuchte eine neue Nachrichtenart; der WKR sagt es dem Bediener (Funk, Zuruf). Die Ansicht
   * nennt den Weg („am Bedienrechner neu zuweisen“). Nach dem Neuladen des Geräts ohne Liste steht nur die
   * Start-Freigabe bzw. „keine Liste“ – die Entwürfe liegen weiter im Ausgang. 21.11.2026, noch zu bestätigen.
   */
  abmeldenOhneBitte: true,
  /**
   * (T8) Die Übung (geraete/uebung.ts) behält das alte Abmelden (Ruhe „Papierbogen gilt“ mit „Weiter digital“) – dort
   * gibt es keinen Bedienrechner, der neu zuweisen könnte. 21.11.2026, noch zu bestätigen.
   */
  abmeldenUebungWieBisher: true,
  /**
   * (T10, Nutzer 21.11.2026: „Die Pad-Geräte-Listen … sehen auf dem Pad noch sehr komisch aus“) Bis W5 zeigt ein
   * breiter Bildschirm (ab 700 px) dieselbe Handy-Maske als mittige Spalte von 560 px; links und rechts ein ruhiger
   * Rand je Modus (styles/wkr-geraet.css `--wkr-umfeld`), Fuß mit Hauptknopf, Reiter und Leiste genauso breit
   * (styles/geraet.css). Keine größeren Knöpfe und keine zwei Listen nebeneinander – das sind die Pad-Masken von W5.
   * 21.11.2026, noch zu bestätigen.
   */
  padSpalteBisW5: true,
  // --- Druck nach Modus (Nutzer 21.11.2026: „Warum werden Listen gedruckt, wenn ich beim Betrieb nur Gerät
  // ausgewählt habe und nicht beides? Das müsste bitte noch gefiltert werden.“; wkr/druck.ts) ---
  /**
   * (Z1) Unter Listen → WKR-Bögen und Laufzettel entfallen die Bögen einer Liste mit Modus `digital`; `papier`,
   * `beides` und eine Liste ohne Eintrag (= Papier) werden gedruckt wie bisher. Sie stehen dann auch nicht am Bildschirm
   * (Bildschirmansicht = Druckansicht), ein Hinweis über dem Stapel nennt sie. 21.11.2026, noch zu bestätigen.
   */
  druckOhneDigital: true,
  /**
   * (Z2) Eine digitale Liste, die gerade pausiert oder abgemeldet ist (ganz oder ein Steg-Teil), wird gedruckt: Dann
   * übernimmt der Papierbogen (F1). Der Druck folgt dem Stand beim Drucken, nicht dem späteren. 21.11.2026, noch zu
   * bestätigen.
   */
  druckBeiPause: true,
  /**
   * (Z3) Steg digital, aber nur ein Teil auf einem Gerät (Register am Bedienrechner: nur Teil-Geräte eines Teils, z. B.
   * „nur Ablegen“) → der Bogen wird gedruckt, das Anlegen schreibt auf Papier. Der Bogen ist einer für beide Teile –
   * eine halbe Liste gibt es nicht. Ohne gekoppeltes Gerät zählt der Modus allein (der Bediener hat „digital“ gewählt,
   * B2). Der Druck liest das Register nur am Bedienrechner (nie im Stand). 21.11.2026, noch zu bestätigen.
   */
  druckStegJeTeil: true,
  /**
   * (Z4) Rückfall: Schalter „Trotzdem drucken“ über dem Stapel (Bedienauswahl, lib/merken.ts `listen.wkr.digitalDrucken`,
   * übersteht Neuladen, nie im Stand) druckt auch die nur digitalen – für Ausfall von Netz oder Geräten. Er gilt für
   * Bögen UND Laufzettel. 21.11.2026, noch zu bestätigen.
   */
  druckRueckfall: true,
  /**
   * (Z5) Laufzettel: ohne die Bögen, die nicht gedruckt werden (kein Kästchen für ein Blatt, das es nicht gibt). Ein
   * Stapel, dessen Bögen alle nur digital sind, hat keinen Zettel. 21.11.2026, noch zu bestätigen.
   */
  druckLaufzettel: true,
  /**
   * (Z6) Listen ohne Liste der WKR-Erfassung (Knoten bis W5, Positionen außerhalb des Regelwerks) werden immer
   * gedruckt (wkr/liste.ts listeVonBogen → null). Die Druckdatei enthält keine WKR-Bögen – dort ändert sich nichts.
   * 21.11.2026, noch zu bestätigen.
   */
  druckOhneListeImmer: true,
  /**
   * (Z7) Parallelslalom: dieselbe Regel je Liste und Racecourse (Bereich `parallel`); die Runde gilt nach dem Drucken
   * nur als gebunden, wenn von ihr etwas gedruckt wurde (views/ListsView.vue gedruckteRunden). 21.11.2026, noch zu
   * bestätigen.
   */
  druckParallelJeRacecourse: true,
  // --- Übungstakt (Nutzer 21.11.2026: „dass der nächste Starter immer erst so 2–6 Sekunden später kommt, nachdem man
  // was geschickt hat. Dann hin und wieder auch mal vorher, wie jetzt auch.“ Y1–Y3, alle noch zu bestätigen) --------
  /**
   * (Y1) Übung (geraete/uebung.ts): Hat der WKR nach dem Abschicken (auch „Fehlerfrei“, „nicht vorbeigekommen“) keinen
   * gezeigten Start seines Teils mehr vor sich, kommt der nächste nach zufällig 2–6 s (UEBUNG_FOLGE_MS, gleichverteilt,
   * Saat je Übung). „Als Nächstes“ vorab (Vorsteg, Steg-Ablegen) zählt nicht als „vor sich“ – das sieht er immer.
   * Die Übung beginnt mit EINEM gezeigten Start (früher zwei). Korrekturen, Rückfragen und Quittungen bleiben wie
   * bisher (Nutzer: „sehr cool“). 21.11.2026, noch zu bestätigen.
   */
  uebungFolgeNachSenden: true,
  /**
   * (Y2) „Hin und wieder vorher“: Jeder 4.–6. gezeigte Start (UEBUNG_FRUEH_JEDER, neu gezogen nach jedem) zieht nach
   * 2–6 s einen weiteren nach sich, ohne aufs Abschicken zu warten – dann stehen zwei an. Nie zwei geplant zugleich;
   * „Rückgängig“ vor der Quittung nimmt den geplanten nächsten zurück. 21.11.2026, noch zu bestätigen.
   */
  uebungFruehHinUndWieder: true,
  /**
   * (Y3) Der 30-s-Takt (uebungTaktSek) läuft nur noch, wenn der WKR so lange nichts schickt oder korrigiert (Uhr
   * beginnt mit jeder Eingabe und jedem gezeigten Start neu). Pausiert/abgemeldet zeigt nichts; „Weiter“ holt den
   * nächsten nach 2–6 s. Am Steg-Anlegen zeigt die Übung so viele, bis einer anlegen kann (der zuletzt gezeigte ist
   * noch im Boot, T1/T2). 21.11.2026, noch zu bestätigen.
   */
  uebungTaktNurRueckfall: true,
} as const
