// Auslegungen der digitalen WKR-Erfassung (Etappe W1) – an EINER Stelle, nach dem Muster von BETRIEB_ANNAHMEN und
// PARALLEL_ANNAHMEN. Grundlage: docs/vorschlag-wkr-erfassung.md (§12, Antworten des Nutzers vom 21.11.2026 auf F1–F17)
// und docs/plan-wkr-w1.md §9. Was mit „noch zu bestätigen“ markiert ist, hat der Nutzer noch nicht gesehen. Die
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
   * Rückfrage, keine leere Zelle. 21.11.2026, noch zu bestätigen.
   */
  uebernahmeNurVorher: true,
  /**
   * (Plan §9.3) Zeilen zu nicht gezeigten Starts (auch die ohne Netz geschätzten) werden ganz zur Rückfrage (Grund
   * `start`), nie still übernommen. Ausnahme: der Vorsteg sieht die nächsten freien Starts schon vor dem Zeigen
   * (Vorschlag §2). 21.11.2026, noch zu bestätigen.
   */
  nichtGezeigtRueckfrage: true,
  /**
   * (Plan §9.4, F16) Steg in zwei Teilen: Ablegen und Anlegen schicken getrennt, je mit Teilhaken
   * (`erfasst.ab@steg`, `erfasst.an@steg`); beide zusammen setzen `erfasst@steg`. Die Teile sind die Spalten
   * `fehlerAB`/`fehlerAN` (Spalten-Keys aus config/aufbauten/gemeinsam.yaml, die Feld-Kennungen sind die Kataloge);
   * Disq. und Bemerkung gehören beiden (Disq. vereinigt, Bemerkung mit „; “ angehängt, nie ersetzt). Die
   * Anlegen-Schlange sind alle gezeigten Starts ohne Anlegen-Haken, auch wenn das Ablegen auf Papier ist.
   * 21.11.2026, noch zu bestätigen.
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
   * die beim Pausieren offen waren, und alle, die während der Pause gezeigt wurden. 21.11.2026, noch zu bestätigen.
   */
  pauseJeListe: true,
  /**
   * (Plan §9.5 mit F16, Prüfbefund 21.11.2026) Am Steg mit Teil-Kopplung pausiert bzw. meldet ein Teil-Gerät nur
   * SEINEN Teil ab (WkrListe.teile): Das andere Handy erfasst weiter, P gilt nur für diesen Teil. Ein Gerät für den
   * ganzen Steg und der Bedienrechner wirken auf die ganze Liste. Sonst wartete die Freigabe auf einen Teil, der
   * längst auf Papier ist – gegen F1. 21.11.2026, noch zu bestätigen.
   */
  pauseJeTeil: true,
  /**
   * (Plan §9.6) Modus: Eine Liste ohne Eintrag ist Papier; das erste „digital“ (oder „beides“) setzt `seit`. Die
   * Schlange beginnt erst dort – ältere Starts tippt man vom Bogen ab. Ein Wechsel von Papier zurück auf digital
   * setzt `seit` neu. Zeilen einer Liste auf Papier (oder ohne Eintrag) werden Vorschläge. 21.11.2026, noch zu
   * bestätigen.
   */
  ohneEintragPapier: true,
  /**
   * (Plan §9.7, F7, F8) Abschluss je Liste und Punkt (Lauf bzw. Runde), mit Namen des Wettkampfrichters – die
   * digitale Unterschrift. Er wird angenommen, wenn nichts mehr offen ist oder „Rest auf Papier“ gewählt ist; sonst
   * ändert er nichts. Weicht die geprüfte Fassung des Geräts vom Stand ab, wird das je Start vermerkt (W2 zeigt es),
   * ohne Sperre. Danach werden Korrekturen vom Gerät zu Vorschlägen. 21.11.2026, noch zu bestätigen.
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
   * Gerät (d-Thema) kostete Kontingent. 21.11.2026, noch zu bestätigen.
   */
  rueckfrageInListe: true,
  /**
   * Listen, die die nächsten Starts schon vor dem Zeigen sehen (Vorschlag §2: „Vorsteg sieht die nächsten Starts schon
   * vor dem Zeigen“): so viele freie, wie die Zuschauerliste am und vor dem Steg zählt (`anzeige.amSteg + vorSteg`).
   * Ihre Zeilen gelten als gezeigt. 21.11.2026.
   */
  vorabListen: ['vorsteg'] as readonly string[],
  /**
   * Ein Start, dessen Klasse die Liste nicht hat (MüB erst ab Klasse 4), steht in der Schlange grau als „entfällt“
   * – nur solange er der zuletzt gezeigte Start des Bereichs ist; mit dem nächsten Start schließt er sich von
   * selbst (Vorschlag §2). Beim Bau von W1.1, 21.11.2026, noch zu bestätigen.
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
} as const
