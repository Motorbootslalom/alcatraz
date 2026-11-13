import type { AppState } from '../types'

// Welche Wettkampfrichter-Listen eine Veranstaltung hat – an EINER Stelle. Gedruckt, in der
// WKR-Einteilung geführt, erfasst, gewertet und auf dem Laufzettel gezählt wird genau das,
// was `veranstaltungsListen` nennt; wer die Listen braucht, fragt hier und nicht
// `konfig.aufbauOrder`.
//
// Es sind die Listen des Aufbaus – mit „Tor 5 übernimmt die Parcoursüberwachung“ die
// zusammengelegte statt der beiden einzelnen (config/kombi.ts) –, dahinter die zusätzlichen:
// Positionen, die der Aufbau nicht nennt, die sich aber in jedem wählen lassen
// (`schnellauswahl`, im Prototyp `menuOrder = order + zusatz`). Welche davon gelten, sagt
// zuerst das Regelwerk (`vorgabeListen` je Disziplin, z. B. die Knoten im Manövrieren) und dann die Veranstaltung: Im
// Stand steht nur, was von der Vorgabe abweicht (`zusatzListen`) – so gilt nach einem Wechsel
// des Regelwerks dessen Vorgabe, ohne dass jemand nachziehen muss.

/** Was die Auswahl vom Stand braucht; fehlende Angaben (Tests, alte Aufrufer) gelten als Vorgabe. */
export type ListenWahl = Pick<AppState, 'aufbau'> & Partial<Pick<AppState, 'tor5MitParcours' | 'zusatzListen'>>

/** Was die Auswahl von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface ListenWahlKonfig {
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
  getAufbau(id: string): { zusatz?: string[]; kombi?: { positionId: string; ersetzt: string[] }; disziplin?: string }
  getRegelwerk?(): { vorgabeListen?: Readonly<Record<string, readonly string[]>> }
}

/** Eine zusätzliche Liste des Aufbaus, wie sie in den Einstellungen zur Wahl steht. */
export interface ZusatzListe {
  id: string
  /** Gilt sie für diese Veranstaltung? */
  an: boolean
  /** Das Regelwerk sieht sie vor (sie gilt, solange sie niemand abwählt). */
  vorgabe: boolean
}

/**
 * Die Listen, die das Regelwerk in den Aufbauten einer Disziplin vorsieht. Die Vorgabe hängt
 * an der Disziplin: Knoten gehören zum Manövrieren, im Parallelslalom gibt es sie nicht.
 */
export function vorgabeListenVon(regelwerk: { vorgabeListen?: Readonly<Record<string, readonly string[]>> }, disziplin: string | undefined): readonly string[] {
  // Nur eigene Einträge: „constructor“ o. Ä. als Disziplin träfe sonst das Objekt-Urbild.
  const jeDisziplin = regelwerk.vorgabeListen ?? {}
  return disziplin !== undefined && Object.prototype.hasOwnProperty.call(jeDisziplin, disziplin) ? jeDisziplin[disziplin] : []
}

/** Die zusätzlichen Listen des Aufbaus in dessen Reihenfolge, je mit ihrem Stand. */
export function zusatzListen(konfig: ListenWahlKonfig, stand: ListenWahl): ZusatzListe[] {
  const aufbau = konfig.getAufbau(stand.aufbau)
  const vorgaben = vorgabeListenVon(konfig.getRegelwerk?.() ?? {}, aufbau.disziplin)
  const wahl = stand.zusatzListen ?? {}
  return (aufbau.zusatz ?? []).map((id) => {
    const vorgabe = vorgaben.includes(id)
    return { id, vorgabe, an: Object.prototype.hasOwnProperty.call(wahl, id) ? wahl[id] === true : vorgabe }
  })
}

/**
 * Die Listen der Veranstaltung in ihrer Reihenfolge: die des Aufbaus (wahlweise
 * zusammengelegt), dahinter die gewählten zusätzlichen. Dieselbe Reihenfolge gilt im Druck,
 * in der Erfassung und auf dem Laufzettel.
 */
export function veranstaltungsListen(konfig: ListenWahlKonfig, stand: ListenWahl): string[] {
  const order = konfig.aufbauOrder(stand.aufbau, stand.tor5MitParcours === true)
  const dazu = zusatzListen(konfig, stand)
    .filter((z) => z.an && !order.includes(z.id))
    .map((z) => z.id)
  return [...order, ...dazu]
}

/**
 * Die gespeicherte Wahl der zusätzlichen Listen, bereinigt: nur Kennung → an/aus. Was es im
 * Aufbau gerade nicht gibt, bleibt stehen – es gilt wieder, sobald der Aufbau die Liste anbietet.
 */
export function normalisiereZusatzListen(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const paare = Object.entries(raw).filter((x): x is [string, boolean] => x[0] !== '__proto__' && x[0] !== '' && typeof x[1] === 'boolean')
  return Object.fromEntries(paare)
}
