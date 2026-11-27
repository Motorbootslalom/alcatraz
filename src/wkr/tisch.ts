/**
 * Knoten am Tisch: Vorschlag der nächsten Nummer (Nutzer 22.11.2026, R8-27, WKR_ANNAHMEN KN9, bestätigt 23.11.2026, R9-08).
 *
 * Am Tisch fährt kein Boot – der WKR tippt die Startnummer selbst. Damit er nicht jede Nummer suchen muss, schlägt das
 * Gerät den nächsten offenen Starter vor: den ersten offenen NACH dem zuletzt abgeschickten in der Folge des Bestands
 * (wkr/liste.ts bestandOhneLauf = Folge des Starter-Reiters); dahinter keiner → von vorn (Rundlauf); ohne „zuletzt“ der
 * erste offene. Beispiel des Nutzers: 8 fertig → 9; 10 getippt → 11; danach 9 → 11 (die 10 war schon).
 *
 * „Offen“ = weder laut Sicht erledigt noch von diesem Gerät selbst geschickt (`z` = eigene Zeile): Die Quittung kann
 * nachlaufen, sonst schlüge der Vorschlag die gerade geschickte Nummer gleich wieder vor. „Zuletzt“ hält der Kern
 * gerätelokal (eigene Zeilen der Liste, nie AppState) – geraete/erfassen.ts bzw. geraete/uebung.ts `zuletzt`.
 *
 * Rein: keine Uhr, kein Zufall, kein Store.
 */

/** Was die Funktion von einem Eintrag des Bestands braucht (geraete/erfassen.ts BestandEintrag passt). */
export interface TischEintrag {
  key: string
  erledigt: boolean
  /** Eigene Zeile dieses Geräts (selbst geschickt). */
  z?: number
  klasse?: string
}

/** Offen am Tisch: nicht erledigt und nicht selbst geschickt. */
export const tischOffen = (b: TischEintrag): boolean => !b.erledigt && b.z === undefined

/**
 * Der nächste offene Starter nach `zuletzt` (Kennung des zuletzt abgeschickten) in der Folge des Bestands, im Rundlauf;
 * `null`, wenn keiner mehr offen ist. Steht `zuletzt` nicht (mehr) im Bestand, gilt der erste offene.
 *
 * `klasse` (Übung, „Klasse vorziehen“, Nutzer 22.11.2026 R7-45, WKR_ANNAHMEN Y4): der erste offene dieser Klasse in
 * der Folge des Bestands; hat sie keinen offenen mehr, gilt die Regel oben.
 */
export function naechsterOffener<T extends TischEintrag>(bestand: readonly T[], zuletzt?: string | null, klasse?: string | null): T | null {
  const vorgezogen = klasse ? bestand.find((b) => b.klasse === klasse && tischOffen(b)) : undefined
  if (vorgezogen) return vorgezogen
  const ab = zuletzt ? bestand.findIndex((b) => b.key === zuletzt) + 1 : 0
  for (let i = 0; i < bestand.length; i++) {
    const b = bestand[(ab + i) % bestand.length]
    if (tischOffen(b)) return b
  }
  return null
}
