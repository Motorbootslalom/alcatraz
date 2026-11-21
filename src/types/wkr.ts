// Digitale Erfassung durch die Wettkampfrichter (Etappe W1, Plan docs/plan-wkr-w1.md vom 21.11.2026): was davon im
// Stand steht. Die Werte selbst stehen wie immer in `eingaben` – das Gerät liefert nur Zeilen, die der Reducer über
// die Erfassung übernimmt (state/reducer/wkr.ts, Logik src/wkr/). Hier stehen nur die offenen Entscheidungen
// (Rückfragen, Vorschläge), Modus und Status je Liste und die Abschlüsse. Nie ein Gerätename: Rückfragen tragen die
// zufällige Geräte-ID in ihrer Kennung; Namen stehen nur gerätelokal und im Verlauf (Antwort F10).

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
}
