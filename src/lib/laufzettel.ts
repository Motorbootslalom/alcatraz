import type { ClassId } from '../types'
import type { WkrBogen } from './wkrListen'

// Laufzettel (Checklisten): je Parcours, Klasse und Lauf ein Zettel mit einem Kästchen je
// gedruckter Seite jeder Liste – so lässt sich nach dem Lauf abhaken, ob von jeder Position
// alle Seiten zurück sind. Vorbild: lib/laufzettel.ts im Fehlerpunkte-Prototyp.
//
// Grundlage sind die Bögen der Veranstaltung (lib/wkrListen.ts), also genau das, was gedruckt
// wird. Die Seitenzahl eines Bogens kommt von außen (`seitenVon`): Sie ist gemessen – dieselbe
// Messung, die den Bogen beim Drucken aufteilt (components/bogen/BogenBlatt.vue) –, nicht
// geschätzt.
//
// Clubmeisterschaft: Dort stehen mehrere Klassen auf einem Bogen. Ein Zettel gilt dann für
// die Klassen, die sich Bögen teilen (alle, die über gemeinsame Bögen zusammenhängen); Listen,
// die nur einen Teil davon tragen, nennen ihre Klassen in der Zeile.

export interface LaufzettelZeile {
  /** Eindeutig je Laufzettel (Bogen + Seite). */
  key: string
  bogenId: string
  typeId: string
  /** Die Klassen des Bogens, wenn es nicht alle des Zettels sind; sonst leer. */
  klassen: ClassId[]
  /** Seite ab 1 und Seitenzahl des Bogens. */
  seite: number
  seiten: number
}

export interface Laufzettel {
  /** Eindeutig und stabil: Parcours, Klassen, Lauf. */
  id: string
  parcoursId: string
  parcoursName: string
  klassen: ClassId[]
  lauf: number
  zeilen: LaufzettelZeile[]
}

/**
 * Woran die Seitenzahl eines Bogens hängt: Parcours, Klassen und Liste – nicht am Lauf. Die
 * Bögen der Läufe unterscheiden sich nur in der Zeile „1. Lauf“ im Kopf; gemessen wird
 * deshalb einer je Kennung, und das Ergebnis gilt für alle Läufe.
 */
export function messKennung(b: Pick<WkrBogen, 'parcoursId' | 'klassen' | 'typeId'>): string {
  return [b.parcoursId, b.klassen.join('+'), b.typeId].join('|')
}

/** Je Kennung ein Bogen zum Messen (der erste, also der des frühesten Laufs). */
export function messBoegen(boegen: readonly WkrBogen[]): WkrBogen[] {
  const je = new Map<string, WkrBogen>()
  for (const b of boegen) if (!je.has(messKennung(b))) je.set(messKennung(b), b)
  return [...je.values()]
}

/** Die Klassen eines Parcours, die über gemeinsame Bögen zusammenhängen – in der Reihenfolge der Bögen. */
function klassenGruppen(boegen: readonly WkrBogen[]): ClassId[][] {
  const gruppen: ClassId[][] = []
  for (const b of boegen) {
    const treffer = gruppen.filter((g) => g.some((k) => b.klassen.includes(k)))
    const neu = [...new Set([...treffer.flat(), ...b.klassen])]
    if (treffer.length === 0) gruppen.push(neu)
    else {
      // An der Stelle der ersten getroffenen Gruppe zusammenführen: Die Reihenfolge bleibt die der Bögen.
      gruppen.splice(gruppen.indexOf(treffer[0]), 1, neu)
      for (const g of treffer.slice(1)) gruppen.splice(gruppen.indexOf(g), 1)
    }
  }
  return gruppen
}

/**
 * Bildet die Laufzettel aus den Bögen.
 *
 * - Ein Zettel je Parcours, Klasse(ngruppe) und Lauf – in der Reihenfolge der Bögen, also
 *   erst Parcours, dann die Klassen so, wie sie laut Verzahnung zuerst starten, dann der Lauf.
 * - Darauf die Listen in der Reihenfolge des Aufbaus (`listen`); mehrere Bögen derselben
 *   Liste (je Klasse einer) bleiben in ihrer Reihenfolge.
 * - Eine Zeile je Druckseite. Eine Liste ohne Lauf (Knoten) gibt es nur einmal; sie steht
 *   auf dem Zettel des Laufs, zu dem ihr Bogen gehört (dem ersten).
 */
export function buildLaufzettel(boegen: readonly WkrBogen[], listen: readonly string[], seitenVon: (bogen: WkrBogen) => number): Laufzettel[] {
  const rang = (typeId: string) => {
    const i = listen.indexOf(typeId)
    return i < 0 ? Number.POSITIVE_INFINITY : i
  }
  const zettel: Laufzettel[] = []
  const parcours = [...new Set(boegen.map((b) => b.parcoursId))]
  for (const parcoursId of parcours) {
    const amParcours = boegen.filter((b) => b.parcoursId === parcoursId)
    for (const klassen of klassenGruppen(amParcours)) {
      const derGruppe = amParcours.filter((b) => klassen.includes(b.klassen[0]))
      for (const lauf of [...new Set(derGruppe.map((b) => b.lauf))].sort((a, b) => a - b)) {
        // `sort` ist stabil: Gleiche Listen behalten die Reihenfolge der Bögen.
        const imLauf = derGruppe.filter((b) => b.lauf === lauf).sort((a, b) => rang(a.typeId) - rang(b.typeId))
        zettel.push({
          id: [parcoursId, klassen.join('+'), lauf].join('|'),
          parcoursId,
          parcoursName: amParcours[0].parcoursName,
          klassen,
          lauf,
          zeilen: imLauf.flatMap((b) => {
            const seiten = Math.max(1, Math.floor(seitenVon(b)) || 1)
            const eigene = b.klassen.length === klassen.length ? [] : [...b.klassen]
            return Array.from({ length: seiten }, (_, i) => ({ key: `${b.id}:${i + 1}`, bogenId: b.id, typeId: b.typeId, klassen: eigene, seite: i + 1, seiten }))
          }),
        })
      }
    }
  }
  return zettel
}

/** Eine Zeile des Zettels: eine Liste mit ihren Bögen, je Bogen so viele Kästchen wie Seiten. */
export interface LaufzettelListe {
  typeId: string
  boegen: { bogenId: string; /** Wie in {@link LaufzettelZeile}: leer = alle Klassen des Zettels. */ klassen: ClassId[]; seiten: number }[]
}

/**
 * Fasst die Kästchen eines Zettels je Liste zusammen – so steht er auf dem Blatt: eine Zeile
 * je Liste, darin die Kästchen ihrer Seiten nebeneinander. Eine Zeile je Seite (wie im
 * Prototyp) passt bei großen Klassen und bei der Clubmeisterschaft nicht mehr auf A5.
 * Reihenfolge der Listen und Bögen wie in `zeilen`; kein Kästchen geht verloren.
 */
export function listenZeilen(zeilen: readonly LaufzettelZeile[]): LaufzettelListe[] {
  const je = new Map<string, LaufzettelListe>()
  for (const z of zeilen) {
    let liste = je.get(z.typeId)
    if (!liste) je.set(z.typeId, (liste = { typeId: z.typeId, boegen: [] }))
    const bogen = liste.boegen.find((b) => b.bogenId === z.bogenId)
    if (bogen) bogen.seiten++
    else liste.boegen.push({ bogenId: z.bogenId, klassen: z.klassen, seiten: 1 })
  }
  return [...je.values()]
}

/** Was gezeigt und gedruckt wird; ein fehlender Wert heißt „alle“. */
export interface LaufzettelAuswahl {
  parcours?: string
  klasse?: ClassId
  lauf?: number
}

export function waehleLaufzettel(zettel: readonly Laufzettel[], auswahl: LaufzettelAuswahl): Laufzettel[] {
  return zettel.filter(
    (z) =>
      (auswahl.parcours === undefined || z.parcoursId === auswahl.parcours) &&
      (auswahl.klasse === undefined || z.klassen.includes(auswahl.klasse)) &&
      (auswahl.lauf === undefined || z.lauf === auswahl.lauf),
  )
}
