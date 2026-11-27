// Digitale Erfassung durch die Wettkampfrichter (Etappe W1, Plan docs/plan-wkr-w1.md vom 21.11.2026): was davon im
// Stand steht. Die Werte selbst stehen wie immer in `eingaben` – das Gerät liefert nur Zeilen, die der Reducer über
// die Erfassung übernimmt (state/reducer/wkr.ts, Logik src/wkr/). Hier stehen nur die offenen Entscheidungen
// (Rückfragen, Vorschläge), Modus und Status je Liste und die Abschlüsse. Nie ein Gerätename: Rückfragen tragen die
// zufällige Geräte-ID in ihrer Kennung; Namen stehen nur gerätelokal und im Verlauf (Antwort F10).

import type { PunktId } from './betrieb'

/**
 * Punkt einer WKR-Liste: ein Punkt des Betriebs (Lauf, Runde) oder `ohne` – die ganze Liste ohne Lauf (Knoten, W5.3,
 * 22.11.2026, WKR_ANNAHMEN KN5). Abschlüsse, Werte des Geräts und die Sicht führen ihn wie einen Punkt.
 */
export type WkrPunkt = PunktId | 'ohne'

/**
 * Warum ein Zeitfeld keine Zeit hat (W5.4, 22.11.2026, WKR_ANNAHMEN ZT4, bestätigt 22.11.2026, R8-36): `anlage` (Zeitanlage
 * ausgefallen), `nichtImZiel` (Boot kam nicht ins Ziel), `anderes`. Die Zelle bleibt leer; der Grund steht nur in
 * {@link WkrStand.keineZeit} und am Bedienrechner (Eingang, Matrix, „Papier ansehen“) – nie auf Tafel, Zuschauerliste
 * oder Start-Freigabe (F17).
 */
export type KeineZeitGrund = 'anlage' | 'nichtImZiel' | 'anderes'

/** Wie eine Liste erfasst wird (F1, 21.11.2026: alle drei immer wählbar). Eine Liste ohne Eintrag ist Papier. */
export type WkrModus = 'digital' | 'papier' | 'beides'

/** Was das Gerät einer Liste gerade tut (F1): erfassen, kurz pausieren oder abgemeldet – dann übernimmt Papier. */
export type WkrStatus = 'aktiv' | 'pausiert' | 'abgemeldet'

/** Eine Pause (oder Abmeldung) einer Liste: von, bis (`null` = läuft noch) und die Starts, die dabei aufs Papier gingen. */
export interface WkrPause {
  von: number
  bis: number | null
  /** Kennungen (`refKey`) der Starts, die beim Pausieren offen waren (P, Plan §3.1). */
  papier: string[]
  /**
   * Nur „Papier ab Start …“ (W2, WKR_PAPIER_AB): die Kennung (`refKey`) des Starts, ab dem der Bogen gilt – für die
   * Anzeige „Papier ab 15“ (wkr/lage.ts `papierAb`); P und Anzeige kommen so aus EINEM Eintrag (Plan W2 §2).
   */
  ab?: string
}

/** Status und Pausen eines Teils einer geteilten Liste (Steg: Ablegen/Anlegen, F16 mit F1). */
export interface WkrTeilStatus {
  status: WkrStatus
  pausen: WkrPause[]
}

/** Modus und Status einer Liste (Schlüssel: Listen-Kennung, wkr/liste.ts `listenKennung`). */
export interface WkrListe {
  modus: WkrModus
  /** Status der ganzen Liste (Bedienrechner oder ein Gerät ohne Teil). */
  status: WkrStatus
  /** Seit wann digital erfasst wird (`action.zeit`): ältere gezeigte Starts stehen nicht in der Schlange. 0 = nie. */
  seit: number
  pausen: WkrPause[]
  /**
   * Nur geteilte Listen (Steg): Status und Pausen je Teil, gesetzt von einem Gerät mit Teil-Kopplung. Pausiert das
   * Ablegen, erfasst das Anlegen weiter (WKR_ANNAHMEN.pauseJeTeil, Prüfbefund 21.11.2026). Fehlt ein Teil: aktiv.
   */
  teile?: Partial<Record<'ab' | 'an', WkrTeilStatus>>
}

/**
 * Abschluss einer Liste (bzw. eines Teils am Steg, F16) für einen Punkt (Lauf, Runde): die digitale Unterschrift (F8).
 * Schlüssel in {@link WkrStand.abschluss}: der Punkt bzw. `${punkt}|ab` / `${punkt}|an` (wkr/abschluss.ts).
 */
export interface WkrAbschluss {
  /** Name des Wettkampfrichters, wie am Gerät eingegeben (Personenangabe wie die Einteilung: in der Sicherung, nie in der Vorlage). */
  name: string
  zeit: number
  /** Starts (`refKey`), deren geprüfte Fassung am Gerät nicht zum Stand passte – W2 zeigt sie, nichts ist gesperrt. */
  abweichend: string[]
  /** Starts (`refKey`), die beim Abschluss noch offen waren und vom Papier kommen („Rest auf Papier“). */
  papier: string[]
}

/**
 * Eine Zeile vom Gerät, wie der Reducer sie bekommt: geprüft und aufgelöst (wkr/zeile.ts `pruefeZeile`). Die Zellen
 * benennen Feld, neuen Wert und den Wert, den das Gerät dort erwartet (`vorher`, beim ersten Abschicken leer).
 */
export interface WkrZeile {
  /** `${geraetId}.${z}` – je Gerät fortlaufend. */
  id: string
  /** Listen-Kennung (wkr/liste.ts). */
  liste: string
  /** Kennung des Starts (`refKey`). */
  ref: string
  /** Lauf-Schlüssel der Werte. */
  lauf: string
  /** Weitere Lauf-Schlüssel, in die dieselben Werte gehen: nur Vorsteg mit „Versuche direkt nacheinander“. */
  weitere: string[]
  starter: string
  zellen: { feld: string; wert: string; vorher: string; vereinige?: true }[]
  /** Teil der Zeile (Steg, F16): aus der Kopplung bzw. der Zeile; fehlt bei ungeteilten Listen und ganzen Zeilen. */
  teil?: 'ab' | 'an'
  /** Die Haken, die die Zeile ohne Konflikt setzt: `erfasst@<typeId>` oder ein Teilhaken (`erfasst.ab@steg`). */
  haken: string[]
  /** Ist der Start im Betrieb gezeigt (Vorsteg: auch einer der nächsten)? Sonst wird die ganze Zeile Rückfrage. */
  gezeigt: boolean
  korrektur: boolean
  /**
   * „Keine Zeit“ je Zeitfeld (W5.4, ZT4): Fehlt es, bleibt ein stehendes Kennzeichen; steht es (auch leer), ersetzt es
   * das Kennzeichen des Starts auf dieser Liste ({@link WkrStand.keineZeit}).
   */
  keineZeit?: Record<string, KeineZeitGrund>
  /**
   * Wiederholung nach Ausfall (R11-11, Prüfbefund 27.11.2026): der Versuch, für den das Gerät die Zeile schickte (Zahl
   * der Abbrüche davor, wkr/versuch.ts); fehlt am Tisch. WKR_ZEILEN prüft ihn beim Anwenden noch einmal gegen den Stand –
   * zwischen der Prüfung im Führungsfenster und dem Anwenden im Schreibfenster kann der Versuch abgebrochen worden sein.
   */
  versuch?: number
}

/** Warum eine Rückfrage entstand: Zelle anders belegt, Start nicht gezeigt, oder ein Disq.-Buchstabe soll wegfallen. */
export type WkrRueckfrageGrund = 'zelle' | 'start' | 'entfernt'

/** Eine offene Rückfrage: Das Gerät will eine Zelle anders, als sie steht – der Bediener entscheidet (W2). */
export interface WkrRueckfrage {
  /** `${zeile}|${lauf}|${starter}|${feld}`. */
  id: string
  /** Kennung der Zeile (`${geraetId}.${z}`). */
  zeile: string
  liste: string
  ref: string
  lauf: string
  /** Weitere Lauf-Schlüssel (Vorsteg mit „Versuche nacheinander“), in die die Entscheidung ebenso geht. */
  weitere: string[]
  starter: string
  feld: string
  /** Was das Gerät dort will. */
  wert: string
  /** Was beim Eingang dort stand. */
  steht: string
  grund: WkrRueckfrageGrund
  /**
   * Nur Grund `start` auf einer gemeinsamen Zelle des Stegs (Disq., Bemerkung): `wert` ist der Wert des Geräts, beim
   * Entscheid für das Gerät wird er wie bei der Übernahme mit dem dann Stehenden vereinigt (wkr/uebernahme.ts
   * `vereinigt`), mit `vorher` des Geräts. Sonst ginge der Buchstabe des anderen Teils still verloren.
   */
  vereinige?: { vorher: string }
  /** Die Haken der Zeile: Ist die letzte Rückfrage der Zeile entschieden, werden sie gesetzt. */
  haken: string[]
  /**
   * „Keine Zeit“ der Zeile (W5.4, ZT4) – wirkt erst mit der Entscheidung für das Gerät. (Das Kennzeichen „nicht
   * vorbeigekommen“ samt Steg-Teil reiste bis 24.11.2026 ebenso mit; ersetzt durch X, WKR_ANNAHMEN NG6.)
   */
  keineZeit?: Record<string, KeineZeitGrund>
  /**
   * Der WKR hat auf dem Gerät „So lassen“ gewählt (Zeit des Stores; Nutzer 21.11.2026, W3-35, WKR_ANNAHMEN GF5): Der
   * Eingang zeigt „WKR: so lassen“, die Rückfrage bleibt offen, bis der Bediener entscheidet. Steht an der Rückfrage,
   * weil sie selbst im Stand lebt (ein Merker im Host ginge beim Neuladen oder Führungswechsel verloren).
   */
  soLassen?: number
  zeit: number
}

/** Ein Vorschlag: eine Zeile, die nicht mehr direkt übernommen wird (Punkt abgeschlossen, Liste auf Papier). */
export interface WkrVorschlag {
  /** Kennung der Zeile (`${geraetId}.${z}`). */
  id: string
  liste: string
  ref: string
  lauf: string
  weitere: string[]
  starter: string
  zellen: { feld: string; wert: string }[]
  haken: string[]
  grund: 'abgeschlossen' | 'papier'
  /** „Keine Zeit“ der Zeile (W5.4, ZT4) – wirkt erst mit „Übernehmen“. */
  keineZeit?: Record<string, KeineZeitGrund>
  zeit: number
}

/** Was die digitale WKR-Erfassung im Stand führt (AppState.wkr). In der Sicherung, nicht in der Vorlage. */
export interface WkrStand {
  /** Je Listen-Kennung Modus und Status. */
  listen: Record<string, WkrListe>
  rueckfragen: WkrRueckfrage[]
  vorschlaege: WkrVorschlag[]
  /**
   * Je Listen-Kennung und Abschluss-Schlüssel der Abschluss: Punkt (ganze Liste) bzw. `${punkt}|ab`/`${punkt}|an`
   * (ein Teil des Stegs, F16) – Lesen und Schreiben nur über wkr/abschluss.ts.
   */
  abschluss: Record<string, Record<string, WkrAbschluss>>
  /**
   * „Keine Zeit“ (W5.4, 22.11.2026, ZT4) je Listen-Kennung und Zelle `${lauf}|${starter}`: je Zeitfeld der Grund. Gesetzt
   * von einer direkt geltenden Zeile mit `keineZeit` (ersetzt den Eintrag des Starts), aufgehoben, sobald das Feld einen
   * Wert hat (Abtippen, spätere Zeile – wkr/keineZeit.ts ohneUeberholteKeineZeit). Lesen über wkr/lage.ts (Matrix,
   * „Papier ansehen“); in der Sicherung wie Rückfragen, nie auf Tafel oder Zuschauerliste (F17). Das Kennzeichen
   * „nicht vorbeigekommen“ (`nichtVorbei`, W4.3) daneben entfiel am 24.11.2026 – es ist jetzt X (WKR_ANNAHMEN NG6).
   */
  keineZeit: Record<string, Record<string, Record<string, KeineZeitGrund>>>
  /**
   * Wiederholung nach Ausfall (R11-11; Prüfbefund 27.11.2026): die Werte abgebrochener Versuche, solange der Abbruch im
   * Betrieb steht – damit „Doch keine Wiederholung“ (WIEDERHOLUNG_AUFHEBEN) sie zurückholen kann, ohne den Verlauf (der
   * alles seitdem mit zurücknähme). Fehlt = keine. In der Sicherung wie Rückfragen, nie in einer Sicht.
   */
  verworfen?: WkrVerworfen[]
}

/**
 * Die Werte eines nach einem Ausfall abgebrochenen Versuchs (WIEDERHOLUNG_AUSFALL), je Start und Starter einer – im
 * Parallelslalom je Boot, das wiederholt (R13-02, 27.11.2026: zwei, wenn beide wiederholen).
 */
export interface WkrVerworfen {
  /** Bereich des Betriebs und Kennung des Starts (betrieb/folge.ts refKey). */
  bereich: string
  ref: string
  /** Zelle: Lauf-Schlüssel und Starter-ID. */
  lauf: string
  starter: string
  /** Die verworfenen Zellen (Feld → Wert, ohne leere), Haken eingeschlossen. */
  werte: Record<string, string>
  /** „Keine Zeit“ dieser Zelle je Liste (Feld → Grund), wie {@link WkrStand.keineZeit}. */
  keineZeit: Record<string, Record<string, KeineZeitGrund>>
}
