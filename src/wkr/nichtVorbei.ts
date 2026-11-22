import type { AppState, WkrStand } from '../types'
import type { Konfig } from '../config/konfig'
import { listenFelder, werteVon, type ListenTeil } from '../lib/eingaben'
import { liesListe, teileVon, teilVonZelle } from './liste'

// „Nicht vorbeigekommen“ (W4.3, Plan docs/plan-wkr-w4.md §6, 21.11.2026, P16 – löst G15 ein): das Kennzeichen im Stand
// (WkrStand.nichtVorbei) lesen, schreiben und aufheben – rein, ohne DOM, ohne Store, nichts aus geraete/. EINE Stelle
// für den Schlüssel, damit Reducer (setzen, aufheben), lage.ts (Matrix, Marken, Abschluss) und migrate gleich lesen.

/**
 * „Nicht vorbeigekommen“ ist Disq. J (Nutzer 21.11.2026, W3-17: „Parcours verlassen oder falscher Parcours“; WKR_ANNAHMEN
 * GF10, noch zu bestätigen): Der Buchstabe, den das Gerät dafür ins Disq.-Feld schreibt.
 */
export const NICHT_VORBEI_DISQ = 'J'

/**
 * Wie das Gerät „nicht vorbeigekommen“ meldet (GF10): `disq` = als Disq. J ins Disq.-Feld, wo die Liste J für diesen
 * Teil kennt (`codes` = disqFuer der Maske; DM/UIM: J nur auf `parcours`/`mueb`); sonst `kennzeichen` = das
 * bisherige ⊘ (Steg-Anlegen hat kein J). Der Ablauf (W4.3: „Mehr“, nur der gezeigte Start, Rückfrage) bleibt gleich.
 */
export function nichtVorbeiArt(codes: readonly { code: string }[]): 'disq' | 'kennzeichen' {
  return codes.some((c) => c.code === NICHT_VORBEI_DISQ) ? 'disq' : 'kennzeichen'
}

/** Schlüssel einer Zelle: `${lauf}|${starter}`, am Steg mit Teil `${lauf}|${starter}|an` (Ablegen hat X statt nv). */
export function nvSchluessel(lauf: string, starter: string, teil?: ListenTeil): string {
  return teil === undefined ? `${lauf}|${starter}` : `${lauf}|${starter}|${teil}`
}

/** Lauf, Starter und Teil eines Schlüssels; `null`, wenn er nicht von {@link nvSchluessel} stammen kann. */
export function liesNvSchluessel(k: unknown): { lauf: string; starter: string; teil?: ListenTeil } | null {
  if (typeof k !== 'string') return null
  const teile = k.split('|')
  // Lauf-Schlüssel und Starter-IDs enthalten kein „|“ (lib/eingaben.ts gueltigeZellen prüft den Lauf beim Laden).
  if (teile.length < 2 || teile.length > 3 || teile[0] === '' || teile[1] === '') return null
  if (teile.length === 3 && teile[2] !== 'ab' && teile[2] !== 'an') return null
  return teile.length === 3 ? { lauf: teile[0], starter: teile[1], teil: teile[2] as ListenTeil } : { lauf: teile[0], starter: teile[1] }
}

/** Steht das Kennzeichen für diese Zelle (und diesen Teil) der Liste? */
export function istNichtVorbei(wkr: WkrStand, liste: string, lauf: string, starter: string, teil?: ListenTeil): boolean {
  const jeListe = Object.hasOwn(wkr.nichtVorbei, liste) ? wkr.nichtVorbei[liste] : undefined
  return !!jeListe?.includes(nvSchluessel(lauf, starter, teil))
}

/** Mit bzw. ohne einen Schlüssel; unverändert = dasselbe Objekt. */
export function mitNichtVorbei(nv: WkrStand['nichtVorbei'], liste: string, schluessel: string, an: boolean): WkrStand['nichtVorbei'] {
  const alt = Object.hasOwn(nv, liste) ? nv[liste] : []
  if (alt.includes(schluessel) === an) return nv
  const neu = an ? [...alt, schluessel] : alt.filter((k) => k !== schluessel)
  if (neu.length > 0) return { ...nv, [liste]: neu }
  const { [liste]: _weg, ...rest } = nv
  return rest
}

/**
 * Hebt Kennzeichen auf, zu deren Zelle die Liste inzwischen eigene Werte hat (WKR_ANNAHMEN.nichtVorbeiAufheben, R3):
 * abgetippt, Rückfrage für das Gerät entschieden, Vorschlag übernommen – „doch vorbei“. Am Steg zählen für `an` nur die
 * Felder des Anlegens (die gemeinsamen Disq./Bemerkung kann das Ablegen geschrieben haben). Der Haken bleibt. Ohne
 * Kennzeichen oder unverändert: derselbe Stand.
 */
export function ohneUeberholteNichtVorbei(stand: AppState, konfig: Konfig): AppState {
  const nv = stand.wkr.nichtVorbei
  if (Object.keys(nv).length === 0) return stand
  const klasseVon = new Map(stand.starters.map((s) => [s.id, s.klasse]))
  const positionen = new Set(konfig.getPositions().map((p) => p.typeId))
  let out = nv
  for (const [liste, schluessel] of Object.entries(nv)) {
    const l = liesListe(liste)
    for (const k of schluessel) {
      const z = liesNvSchluessel(k)
      const klasse = z ? klasseVon.get(z.starter) : undefined
      // Ohne Liste, Starter oder Position bleibt es stehen – aufräumen ist Sache von wkrNurStarter/wkrOhneLaeufe.
      if (!l || !z || klasse === undefined || !positionen.has(l.typeId)) continue
      const werte = werteVon(stand.eingaben, z.lauf, z.starter)
      const geteilt = !!teileVon(l.typeId)
      const eigen = listenFelder(konfig, l.typeId, klasse).some((f) => (!geteilt || z.teil === undefined || teilVonZelle(l.typeId, f.zelle) === z.teil) && !!werte[f.kennung])
      if (eigen) out = mitNichtVorbei(out, liste, k, false)
    }
  }
  return out === nv ? stand : { ...stand, wkr: { ...stand.wkr, nichtVorbei: out } }
}
