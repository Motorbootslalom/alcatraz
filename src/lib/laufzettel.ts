import type { ClassId } from '../types'
import type { WkrBogen } from './wkrListen'

// Laufzettel (Checklisten): Ein Zettel hält die losen Blätter zusammen, die nach dem Lauf als
// ein Stapel zur Auswertung gehen, mit einem Kästchen je gedruckter Seite jeder Liste – so
// lässt sich abhaken, ob von jeder Position alle Seiten zurück sind. Vorbild:
// lib/laufzettel.ts im Fehlerpunkte-Prototyp.
//
// Was ein Stapel ist:
// - Sonst je Parcours, Klasse und Lauf: Jeder Bogen trägt eine Klasse.
// - Clubmeisterschaft mit „Papier sparen“: je Parcours und Lauf – alle Klassen stehen auf
//   denselben Bögen (`jeParcours`).
// - Clubmeisterschaft ohne „Papier sparen“: Listen ohne Bild (Zeit, Steg …) teilen sich die
//   Klassen weiter, nur Listen mit Bild sind je Klasse getrennt. Ein gemeinsamer Bogen kann
//   nicht in zwei Stapeln liegen – der Zettel gilt deshalb für alle Klassen, die über
//   gemeinsame Bögen zusammenhängen (in der Regel wieder der ganze Parcours); die Bögen
//   einzelner Klassen nennen ihre Klasse in der Zeile.
// - Eine Liste ohne Lauf (Knoten) wird einmal abgenommen und gedruckt: Sie liegt im Stapel
//   des 1. Laufs und steht nur auf dessen Zettel.
//
// Grundlage sind die Bögen der Veranstaltung (lib/wkrListen.ts), also genau das, was gedruckt
// wird. Die Seitenzahl eines Bogens kommt von außen (`seitenVon`): Sie ist gemessen – dieselbe
// Messung, die den Bogen beim Drucken aufteilt (components/bogen/BogenBlatt.vue) –, nicht
// geschätzt.
//

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
 * - Ein Zettel je Blattstapel (siehe oben): Parcours, Klasse(ngruppe) und Lauf – in der
 *   Reihenfolge der Bögen, also erst Parcours, dann die Klassen so, wie sie laut Verzahnung
 *   zuerst starten, dann der Lauf.
 * - Darauf die Listen in der Reihenfolge des Aufbaus (`listen`); mehrere Bögen derselben
 *   Liste (je Klasse einer) bleiben in ihrer Reihenfolge.
 * - Eine Zeile je Druckseite. Eine Liste ohne Lauf (Knoten) gibt es nur einmal; sie steht
 *   auf dem Zettel des Laufs, zu dem ihr Bogen gehört (dem ersten).
 */
export function buildLaufzettel(
  boegen: readonly WkrBogen[],
  listen: readonly string[],
  seitenVon: (bogen: WkrBogen) => number,
  /** `jeParcours`: ein Zettel je Parcours und Lauf, gleich wie die Klassen auf den Bögen stehen (Club, „Papier sparen“). */
  optionen: { jeParcours?: boolean } = {},
): Laufzettel[] {
  const rang = (typeId: string) => {
    const i = listen.indexOf(typeId)
    return i < 0 ? Number.POSITIVE_INFINITY : i
  }
  const zettel: Laufzettel[] = []
  const parcours = [...new Set(boegen.map((b) => b.parcoursId))]
  for (const parcoursId of parcours) {
    const amParcours = boegen.filter((b) => b.parcoursId === parcoursId)
    const stapel = optionen.jeParcours ? [[...new Set(amParcours.flatMap((b) => b.klassen))]] : klassenGruppen(amParcours)
    for (const klassen of stapel) {
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
 * Fasst die Kästchen eines Zettels je Liste zusammen: je Liste ihre Bögen, je Bogen seine
 * Seitenzahl. Das Blatt (LaufzettelBlatt.vue) setzt daraus beide Formen – eine Zeile je Seite
 * mit dem Kästchen vorn (wie im Prototyp) oder eine Zeile je Liste mit den Kästchen
 * nebeneinander. Reihenfolge der Listen und Bögen wie in `zeilen`; kein Kästchen geht verloren.
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
