import type { Geraet } from '../types'
import type { RawAufbauEintrag, RawPosition, RawSpalte } from './schema'

// Zeitnahme: Jede Zeitspalte gehört zu einem Gerät, der elektronischen Zeiterfassung
// (Lichtschranke) oder einer Stoppuhr. Eine Liste mit `zeiten` bekommt je Gerät eine
// Spalte. Im Aufbau kann eine Position abgewandelt werden, z. B. eine Zeitliste je
// Gerät bei der DM 2026. Läuft ohne Bundler (scripts/check-config.ts).

export const GERAETE: readonly Geraet[] = ['elektronisch', 'stoppuhr']

/** Die Positions-ID eines Eintrags im Aufbau, abgewandelt oder nicht. */
export function eintragId(eintrag: string | RawAufbauEintrag): string {
  return typeof eintrag === 'string' ? eintrag : eintrag?.id
}

/** Die Positions-IDs eines Aufbaus in Reihenfolge, ohne Nummern. */
export function aufbauIds(positionen: Array<string | RawAufbauEintrag> | undefined): string[] {
  return (positionen ?? []).map(eintragId)
}

/** Die Zeitspalten zu den Geräten. Mit mehreren Geräten trägt jede Spalte den Namen ihres Geräts. */
export function zeitSpalten(zeiten: Geraet[]): RawSpalte[] {
  const stoppuhren = zeiten.filter((g) => g === 'stoppuhr').length
  let nr = 0
  return zeiten.map((geraet, i): RawSpalte => {
    const label =
      zeiten.length === 1
        ? 'Zeit'
        : geraet === 'elektronisch'
          ? 'Elektronisch'
          : stoppuhren > 1
            ? `Stoppuhr ${++nr}`
            : 'Stoppuhr'
    return { key: `zeit${i + 1}`, label, typ: 'zeit', geraet }
  })
}

/** Der Titel einer Liste mit genau einem Gerät. */
export function zeitTitel(zeiten: Geraet[]): string | undefined {
  if (zeiten.length !== 1) return undefined
  return zeiten[0] === 'elektronisch' ? 'Elektronische Zeiterfassung' : 'Stoppuhr'
}

/** Die Position mit je einer Zeitspalte für ihre Geräte, an der Stelle der bisherigen Zeitspalten. */
export function mitZeiten(pos: RawPosition, zeiten: Geraet[] | undefined = pos.zeiten): RawPosition {
  if (!zeiten) return pos
  // Vor der ersten Zeitspalte steht keine andere, ohne Zeitspalten kommen sie an den Anfang.
  const vorher = Math.max(pos.spalten.findIndex((s) => s.typ === 'zeit'), 0)
  const ohne = pos.spalten.filter((s) => s.typ !== 'zeit')
  return { ...pos, zeiten, spalten: [...ohne.slice(0, vorher), ...zeitSpalten(zeiten), ...ohne.slice(vorher)] }
}

/**
 * Eine Position, wie ein Eintrag im Aufbau sie abwandelt. Eine reine Zeitliste mit genau
 * einem Gerät heißt nach ihm, sofern der Eintrag keinen Titel nennt.
 */
export function abwandlung(pos: RawPosition, eintrag: RawAufbauEintrag): RawPosition {
  const neu = mitZeiten(pos, eintrag.zeiten ?? pos.zeiten)
  const nurZeit = neu.spalten.every((s) => s.typ === 'zeit' || s.typ === 'trenner')
  const titel = eintrag.titel ?? (nurZeit && eintrag.zeiten ? zeitTitel(eintrag.zeiten) : undefined)
  return titel ? { ...neu, titel, menue: titel } : neu
}

export interface Nummeriert {
  /** Positions-ID ohne Nummer. */
  id: string
  /** Nummerierte ID (zeit-1 …), falls die Position mehrfach steht oder abgewandelt ist. */
  nid?: string
  /** Die Nummer der ID, sie bestimmt auch die Feld-Kennungen (zeit1~2 …). */
  n?: number
  variante?: RawAufbauEintrag
}

/**
 * Steht eine Position mehrfach in einem Aufbau, bekommt jedes Vorkommen eine eigene
 * nummerierte ID (zeit-1, zeit-2 …). Abwandlungen sind immer nummeriert, damit sie die
 * Position selbst nicht verdecken.
 */
export function nummerierung(positionen: Array<string | RawAufbauEintrag>): Nummeriert[] {
  const ids = positionen.map(eintragId)
  const anzahl = new Map<string, number>()
  for (const id of ids) anzahl.set(id, (anzahl.get(id) ?? 0) + 1)
  const bisher = new Map<string, number>()
  return positionen.map((eintrag, i) => {
    const id = ids[i]
    const variante = typeof eintrag === 'string' ? undefined : eintrag
    if (!variante && (anzahl.get(id) ?? 0) < 2) return { id }
    const n = (bisher.get(id) ?? 0) + 1
    bisher.set(id, n)
    return { id, nid: `${id}-${n}`, n, variante }
  })
}
