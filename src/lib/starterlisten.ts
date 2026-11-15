import type { AppState, OriginMode, Starter } from '../types'
import { CLASSES } from '../domain/classes'
import { gewichtsGruppen } from '../domain/gewicht'
import { sortedByStartNr } from '../domain/startnumbers'
import { planEvent } from '../planung/plan'
import { originOf } from './origin'
import { jeHerkunft, mannschaftSchluessel } from './pokal'

// Die Starterlisten unter „Listen“ – rein, ohne DOM (views/ListsView.vue zeichnet sie).
//
// Ein Reiter, drei Arten:
//   • verzahnt: die Startfolge je Parcours. Auf Wunsch für eine Herkunft: die VOLLSTÄNDIGE
//     Liste, in der deren Starter hervorgehoben sind – der Mannschaftsleiter sieht auf einen
//     Blick, wann die eigenen Starter starten.
//   • je Herkunft nach Startnummer: nur die Starter einer Herkunft; der Parcours spielt dort
//     keine Rolle.
//   • nach Klasse.

export const STARTER_ARTEN = ['verzahnt', 'herkunft', 'klasse'] as const
export type StarterArt = (typeof STARTER_ARTEN)[number]
export const istStarterArt = (x: unknown): x is StarterArt => (STARTER_ARTEN as readonly unknown[]).includes(x)

/** Auswahl „alle Herkünfte“ – kein Schlüssel einer Herkunft sieht so aus (die tragen `art:` davor). */
export const ALLE = '*'

/** Was im Reiter „Starterlisten“ gewählt ist; übersteht Ansichtswechsel und Neuladen (lib/merken.ts). */
export interface StarterWahl {
  art: StarterArt
  /** Verzahnt: '' = ohne Markierung, {@link ALLE} oder der Schlüssel einer Herkunft. */
  markierung: string
  /** Je Herkunft: {@link ALLE} oder der Schlüssel einer Herkunft. */
  herkunft: string
}
export const STARTER_WAHL: StarterWahl = { art: 'verzahnt', markierung: '', herkunft: ALLE }

export function istStarterWahl(x: unknown): x is StarterWahl {
  const w = x as Partial<StarterWahl> | null
  return !!w && typeof w === 'object' && istStarterArt(w.art) && typeof w.markierung === 'string' && typeof w.herkunft === 'string'
}

export interface Herkunft {
  /** Unter diesem Schlüssel gehören Schreibweisen zusammen – derselbe wie in der Mannschaftswertung. */
  schluessel: string
  /** Die häufigste Schreibweise; sie steht im Kopf der Liste. */
  name: string
  /** Die Starter dieser Herkunft, in der Reihenfolge des Starterfelds. */
  starter: Starter[]
}

/**
 * Die Herkünfte des Starterfelds, nach Namen sortiert. Herkunft ist, was die Listen in der
 * Spalte zeigen (lib/origin.ts `originOf`) – wer dort nichts stehen hat, gehört zu keiner.
 * Gleichbedeutende Schreibweisen („NRW“ und „Nordrhein-Westfalen“, „GER“ und „Germany“) sind
 * eine Herkunft, wie in der Mannschaftswertung (lib/pokal.ts `mannschaftSchluessel`).
 */
export function herkuenfte(starters: readonly Starter[], mode: OriginMode): Herkunft[] {
  if (mode === 'none') return []
  const schluessel = (name: string) => mannschaftSchluessel(name, mode)
  const sammler = jeHerkunft<Starter[]>(schluessel)
  for (const p of starters) {
    const name = originOf(p, mode).replace(/\s+/g, ' ').trim()
    if (name) sammler.zu(name, () => []).push(p)
  }
  return sammler
    .alle()
    .map((g) => ({ schluessel: schluessel(g.herkunft), name: g.herkunft, starter: g.wert }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Starter, die zu keiner Herkunft gehören (leeres Feld) – sie stehen auf keiner Liste je Herkunft. */
export function ohneHerkunft(starters: readonly Starter[], mode: OriginMode): Starter[] {
  return mode === 'none' ? [] : starters.filter((p) => originOf(p, mode).trim() === '')
}

/**
 * Nach Startnummer, Klasse E zuerst: „E01 kommt vor 101“ (Vorgabe des Nutzers). Die Klasse E
 * steht auch dann vorn, wenn ihre Nummern reine Zahlen sind (Startnummern-Art „klassisch“,
 * importierte Nummern). Danach Nummern mit Buchstaben vorn, dann die reinen Zahlen, innerhalb
 * jeweils natürlich sortiert (E2 vor E10, 99 vor 401); Starter ohne Nummer zuletzt in ihrer
 * Gruppe. Bei gleicher Nummer bleibt die Reihenfolge.
 */
export function nachStartnummer(starters: readonly Starter[]): Starter[] {
  const rang = (p: Starter) => (p.klasse === 'E' ? 0 : 3) + (p.startNr.trim() === '' ? 2 : /^\d/.test(p.startNr.trim()) ? 1 : 0)
  return [...starters].sort((a, b) => rang(a) - rang(b) || a.startNr.trim().localeCompare(b.startNr.trim(), 'de', { numeric: true }))
}

/** Die gewählten Herkünfte: alle bei {@link ALLE}, sonst die eine – eine, die es nicht (mehr) gibt, zählt wie „alle“. */
export function gewaehlteHerkuenfte(alle: readonly Herkunft[], wahl: string): Herkunft[] {
  const eine = alle.find((h) => h.schluessel === wahl)
  return eine ? [eine] : [...alle]
}

/** Eine Zeile der Liste: der Starter, ob sie grau hinterlegt ist und ob sie hervorgehoben ist. */
export interface StarterZeile {
  p: Starter
  shade: boolean
  markiert: boolean
}

/** Eine Liste, die für sich ein Dokument ist: eigenes Blatt, eigene Seitenzählung. */
export interface StarterDokument {
  id: string
  /** Name der Liste im ersten Feld des Kopfs, z. B. „Starterliste“. */
  title: string
  /** Zweites Feld: der Parcours (nur bei mehreren) oder „nach Klasse“; fehlt = das Feld entfällt. */
  zusatz?: string
  /** Eigenes Feld für die Herkunft, für die das Blatt gilt (Gewichtsliste, Liste je Herkunft, Markierung); fehlt = entfällt. */
  origin?: string
  /** Die Starter dieser Herkunft sind hervorgehoben (▶ Zeile ◀, fett) – die Tabelle lässt dafür seitlich Platz. */
  markierung: boolean
  /**
   * Zeilenblöcke, die möglichst nicht über einen Seitenwechsel getrennt
   * werden: bei der Liste nach Klasse je Klasse einer, sonst ein einziger
   * (die verzahnte Folge hat keine sinnvolle Trennstelle).
   */
  groups: StarterZeile[][]
}

/** Welche der Listen mit einer Zeile je Starter gemeint ist (components/StarterBlaetter.vue zeichnet sie alle). */
export type StarterListe = 'starter' | 'vorsteg' | 'gewicht'

/** Die Titel im Kopf, schon in der Sprache der Liste. */
export interface StarterTitel {
  starter: string
  vorsteg: string
  gewicht: string
  klasse: string
}

/** Jede fünfte Zeile ist grau hinterlegt – durchgezählt über die Blöcke und Seiten; `n` zählt weiter. */
const zeilenVon = (starter: readonly Starter[], zaehler: { n: number }): StarterZeile[] => starter.map((p) => ({ p, shade: ++zaehler.n % 5 === 0, markiert: false }))

/**
 * Die Dokumente einer Auswahl – für den Reiter der Liste (views/ListsView.vue) und für die
 * Druckdatei (components/DruckdateiListen.vue), die dieselbe verzahnte Starterliste enthält.
 * `art`, `markierung` und `herkunft` gelten nur für die Starterlisten und müssen schon geprüft
 * sein (eine Herkunft, die es nicht gibt, zählt wie „alle“ – {@link gewaehlteHerkuenfte}).
 */
export function starterDokumente(
  stand: AppState,
  wahl: { liste: StarterListe; art?: StarterArt; markierung?: string; herkunft?: string },
  titel: StarterTitel,
): StarterDokument[] {
  if (wahl.liste === 'gewicht') {
    // Je Herkunft ein eigenes Blatt für den Mannschaftsleiter; dort beginnt die Zählung der grauen Zeilen neu.
    return gewichtsGruppen(stand.starters, stand.originMode, (name) => mannschaftSchluessel(name, stand.originMode)).map((g) => ({
      id: `gewicht:${g.origin}`,
      title: titel.gewicht,
      origin: g.origin || undefined,
      markierung: false,
      groups: [zeilenVon(g.starters, { n: 0 })],
    }))
  }
  const art = wahl.liste === 'starter' ? (wahl.art ?? 'verzahnt') : 'verzahnt'
  if (art === 'klasse') {
    const zaehler = { n: 0 }
    const groups = CLASSES.map((c) => sortedByStartNr(stand.starters.filter((p) => p.klasse === c.id)))
      .filter((g) => g.length > 0)
      .map((g) => zeilenVon(g, zaehler))
    return groups.length > 0 ? [{ id: 'klasse', title: titel.starter, zusatz: titel.klasse, markierung: false, groups }] : []
  }
  if (art === 'herkunft') {
    // Nur die Starter einer Herkunft, nach Startnummer; der Parcours spielt hier keine Rolle.
    return gewaehlteHerkuenfte(herkuenfte(stand.starters, stand.originMode), wahl.herkunft ?? ALLE).map((h) => ({
      id: `herkunft:${h.schluessel}`,
      title: titel.starter,
      origin: h.name,
      markierung: false,
      groups: [zeilenVon(nachStartnummer(h.starter), { n: 0 })],
    }))
  }
  // Je Parcours eine eigene Liste auf eigenem Blatt – sie hängt an einem anderen Steg.
  const plans = new Map(planEvent(stand).plans.map((p) => [p.parcoursId, p]))
  const several = stand.parcoursList.length > 1
  const kopf = wahl.liste === 'vorsteg' ? titel.vorsteg : titel.starter
  const folgen = stand.parcoursList.map((p) => ({ p, starter: plans.get(p.id)?.sequence ?? [] })).filter((f) => f.starter.length > 0)
  // Die grauen Zeilen zählen je Parcours (je Dokument); jede Fassung mit Markierung trägt sie an
  // denselben Stellen – es ist dieselbe Liste.
  const grau = folgen.map((f) => zeilenVon(f.starter, { n: 0 }))
  const markierung = wahl.liste === 'starter' ? (wahl.markierung ?? '') : ''
  const fuer = markierung !== '' ? gewaehlteHerkuenfte(herkuenfte(stand.starters, stand.originMode), markierung) : undefined
  if (!fuer) return folgen.map((f, i) => ({ id: f.p.id, title: kopf, zusatz: several ? f.p.name : undefined, markierung: false, groups: [grau[i]] }))
  // Mit Markierung: je Herkunft der ganze Satz, ein Dokument je Parcours. Ein Parcours, auf dem
  // die Herkunft niemanden am Start hat, entfällt für sie.
  return fuer.flatMap((h) => {
    const eigene = new Set(h.starter.map((p) => p.id))
    return folgen.flatMap((f, i) =>
      f.starter.some((p) => eigene.has(p.id))
        ? [{ id: `${f.p.id}|${h.schluessel}`, title: kopf, zusatz: several ? f.p.name : undefined, origin: h.name, markierung: true, groups: [grau[i].map((z) => ({ ...z, markiert: eigene.has(z.p.id) }))] }]
        : [],
    )
  })
}
