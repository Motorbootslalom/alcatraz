import type { AppState, ClassId, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { planEvent } from '../planung/plan'
import { defFuerKlasse, type BogenAuftrag, type BogenKonfig, type BogenOptionen } from './bogen'

// Die echten Wettkampfrichter-Listen einer Veranstaltung, abgeleitet aus Stand und
// Verzahnung – rein, ohne DOM: je Parcours, Klasse, Lauf und Liste des gewählten Aufbaus ein
// Bogen (lib/bogen.ts zeichnet ihn). Die Zeilen stehen in der Startreihenfolge der
// Verzahnung, also so wie auf der Starterliste des Parcours.
//
// Auf dem Bogen stehen nur Startnummern, keine Namen – wie im Fehlerpunkte-Prototyp und im
// PDF der Deutschen Meisterschaft: Der Wettkampfrichter sieht die Nummer am Boot, die Bögen
// liegen offen am Steg (Namen und Geburtsjahre Minderjähriger gehören dort nicht hin), und
// die Zeile bleibt schmal genug für alle Spalten.
//
// Erfassung (kommt später): Eine Eingabe gehört zu Starter-ID + Lauf + Liste (+ Spalte).
// Genau das trägt ein Bogen: `lauf`, `typeId` und je Zeile die `id` des Starters – die
// Startnummer ist nur die Beschriftung und darf sich ändern.

/** Was die Ableitung von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface WkrListenKonfig extends BogenKonfig {
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
}

export type WkrListenStand = Pick<
  AppState,
  'eventName' | 'eventJahr' | 'eventKind' | 'laufCount' | 'aufbau' | 'parcoursList' | 'einteilung' | 'wkrLeerzeilen' | 'wkrLeerzeilenKlasse' | 'wkrClubGemeinsam'
>

/** Ein Bogen der Veranstaltung: eine Liste für eine Klasse (Clubmeisterschaft: mehrere) in einem Lauf auf einem Parcours. */
export interface WkrBogen {
  /** Eindeutig und stabil: Parcours, Klassen, Lauf, Liste. */
  id: string
  parcoursId: string
  parcoursName: string
  klassen: ClassId[]
  lauf: number
  typeId: string
  /** Name der Liste, wie er im Kopf steht. */
  titel: string
  auftrag: BogenAuftrag
  optionen: Pick<BogenOptionen, 'leerzeilen' | 'klassenBloecke' | 'leerzeilenJeKlasse'>
}

export interface WkrListen {
  boegen: WkrBogen[]
  /**
   * Klassen mit Startern, für die es keinen Bogen gibt: Sie fahren auf keinem Parcours, das
   * Regelwerk kennt sie nicht, oder der Aufbau hat keine Liste für sie.
   */
  ohneListe: ClassId[]
}

/**
 * Woran sich entscheidet, ob zwei Klassen sich einen Bogen teilen können (Clubmeisterschaft):
 * dieselben Spalten, dieselbe Beschreibung und – wenn die Liste ein Parcoursbild trägt –
 * dieselbe Zeichnung. Ein Bogen zeigt genau ein Bild; stünde dort die Zeichnung einer anderen
 * Klasse (anderer Kurs, in der Möwe-Variante sogar andere Fahrtrichtung), gliche der
 * Wettkampfrichter die Fahrt mit dem falschen Parcours ab. Listen mit Bild bleiben deshalb in
 * der Regel je Klasse; Listen ohne Bild (Steg, Zeit, Knoten …) stehen zusammen.
 */
function aufbauSignatur(konfig: BogenKonfig, aufbauId: string, typeId: string, klasse: string): string {
  const d = defFuerKlasse(konfig.getSheetDef(typeId), klasse)
  const bild = d.bildErzeugen ? konfig.bildDatei(aufbauId, klasse) : null
  return JSON.stringify([d.columns.map((c) => [c.key, c.sub ?? []]), d.errorTable, d.errorGroups, d.legendNote, d.disqTable, bild])
}

/** Die Klassen einer Liste, zu Bögen zusammengefasst: einzeln, oder (Club) nach gleichem Aufbau. */
function klassenGruppen(
  konfig: BogenKonfig,
  aufbauId: string,
  typeId: string,
  klassen: ClassId[],
  gemeinsam: boolean,
  alleZusammen: boolean,
): ClassId[][] {
  if (!gemeinsam) return klassen.map((k) => [k])
  // Papier sparen: ein Bogen für alle Klassen der Liste, ohne Bild; was eine Klasse nicht hat, ist schraffiert.
  if (alleZusammen) return klassen.length > 0 ? [klassen] : []
  const gruppen = new Map<string, ClassId[]>()
  for (const k of klassen) {
    const s = aufbauSignatur(konfig, aufbauId, typeId, k)
    gruppen.set(s, [...(gruppen.get(s) ?? []), k])
  }
  return [...gruppen.values()]
}

/**
 * Alle Bögen der Veranstaltung. `folgen` ist die Startreihenfolge je Parcours aus der
 * Verzahnung (`planEvent(...).plans[].sequence`).
 *
 * Reihenfolge: Parcours, dann Klasse (in der Reihenfolge, in der die Klassen laut Verzahnung
 * zuerst starten), Lauf und Liste (in der Reihenfolge des Aufbaus).
 * Eine Liste ohne Lauf im Kopf (Knoten) gibt es nur einmal; sie zählt zum 1. Lauf.
 *
 * Clubmeisterschaft: Klassen, deren Bogen gleich aufgebaut ist, stehen mit
 * Zwischenüberschrift untereinander auf einem Bogen; eine Klasse mit anderen Spalten oder
 * anderem Parcoursbild bekommt ihren eigenen. Mit `wkrClubGemeinsam` (Papier sparen) stehen
 * alle Klassen einer Liste zusammen, ohne Bild; fehlende Spalten sind je Zeile schraffiert. Die Wertung bleibt klassenbezogen – jede Zeile kennt ihre Klasse.
 */
export function wkrBoegen(stand: WkrListenStand, konfig: WkrListenKonfig, folgen: ReadonlyMap<string, readonly Starter[]>): WkrListen {
  const eventName = [stand.eventName, stand.eventJahr].filter(Boolean).join(' ')
  const mehrereParcours = stand.parcoursList.length > 1
  const listen = konfig.aufbauOrder(stand.aufbau, false)
  const laeufe = Math.max(1, stand.laufCount)
  // Reihenfolge der Klassen je Parcours: so, wie sie in der Verzahnung zuerst an den Start
  // gehen – nicht E, 1, 2 … Der Stapel aus dem Drucker liegt dann schon in der Reihenfolge,
  // in der die Bögen am Steg gebraucht werden; man muss ihn nur noch trennen.
  const auftritt = new Map<string, Map<ClassId, number>>()
  const boegen: WkrBogen[] = []
  const club = stand.eventKind === 'club'

  for (const parcours of stand.parcoursList) {
    const folge = folgen.get(parcours.id) ?? []
    // Klassen ohne Starter entfallen.
    const zuerst = new Map<ClassId, number>()
    folge.forEach((s, i) => {
      if (!zuerst.has(s.klasse)) zuerst.set(s.klasse, i)
    })
    auftritt.set(parcours.id, zuerst)
    const klassen = [...zuerst.keys()]
    const jeGruppe = listen.flatMap((typeId) => {
      const mitListe = klassen.filter((k) => konfig.positionAllowsClass(typeId, k))
      return klassenGruppen(konfig, stand.aufbau, typeId, mitListe, club, club && stand.wkrClubGemeinsam).map((gruppe) => ({ gruppe, typeId }))
    })
    for (const { gruppe, typeId } of jeGruppe) {
      const def = konfig.getSheetDef(typeId)
      const zeilen = folge.filter((s) => gruppe.includes(s.klasse)).map((s) => ({ nr: s.startNr, id: s.id, klasse: s.klasse }))
      for (let lauf = 1; lauf <= (def.showLauf === false ? 1 : laeufe); lauf++) {
        boegen.push({
          id: [parcours.id, gruppe.join('+'), lauf, typeId].join('|'),
          parcoursId: parcours.id,
          parcoursName: parcours.name,
          klassen: gruppe,
          lauf,
          typeId,
          titel: def.title,
          auftrag: {
            typeId,
            klassen: gruppe,
            lauf,
            zeilen,
            eventName,
            aufbauId: stand.aufbau,
            // Wie auf den Startlisten: Der Parcours steht nur da, wenn es mehrere gibt.
            parcours: mehrereParcours ? parcours.name : undefined,
            // Der Name hängt am Parcours des Bogens, nicht an der Klasse (lib/einteilung.ts).
            wkr: stand.einteilung[parcours.id]?.[typeId]?.trim() ?? '',
            // Gemeinsamer Bogen über Klassen mit verschiedenen Zeichnungen: lieber kein Bild als ein fremdes.
            ohneBild: club && stand.wkrClubGemeinsam && gruppe.length > 1,
          },
          optionen:
            gruppe.length > 1
              ? { klassenBloecke: true, leerzeilen: stand.wkrLeerzeilen, leerzeilenJeKlasse: stand.wkrLeerzeilenKlasse }
              : { leerzeilen: stand.wkrLeerzeilenKlasse[gruppe[0]] ?? stand.wkrLeerzeilen },
        })
      }
    }
  }
  // Je Klasse(ngruppe) erst alle Läufe, darin die Listen in der Reihenfolge des Aufbaus.
  const lage = new Map(boegen.map((b, i) => [b.id, i]))
  const parcoursRang = new Map(stand.parcoursList.map((p, i) => [p.id, i]))
  boegen.sort(
    (a, b) =>
      parcoursRang.get(a.parcoursId)! - parcoursRang.get(b.parcoursId)! ||
      auftritt.get(a.parcoursId)!.get(a.klassen[0])! - auftritt.get(b.parcoursId)!.get(b.klassen[0])! ||
      a.lauf - b.lauf ||
      lage.get(a.id)! - lage.get(b.id)!,
  )

  const mitBogen = new Set(boegen.flatMap((b) => b.klassen))
  const alle = new Set([...folgen.values()].flat().map((s) => s.klasse))
  return { boegen, ohneListe: CLASS_IDS.filter((k) => alle.has(k) && !mitBogen.has(k)) }
}

/**
 * Die Bögen zum Stand: Die Startreihenfolge kommt aus der Verzahnung. Starter einer Klasse,
 * die auf keinem Parcours fährt, stehen in keiner Folge – ihre Klasse wird als `ohneListe`
 * gemeldet.
 */
export function wkrBoegenZumStand(stand: AppState, konfig: WkrListenKonfig): WkrListen {
  const folgen = new Map(planEvent(stand).plans.map((p) => [p.parcoursId, p.sequence]))
  const ergebnis = wkrBoegen(stand, konfig, folgen)
  const mitBogen = new Set(ergebnis.boegen.flatMap((b) => b.klassen))
  return { ...ergebnis, ohneListe: CLASS_IDS.filter((k) => !mitBogen.has(k) && stand.starters.some((s) => s.klasse === k)) }
}

/** Was gedruckt wird; ein fehlender Wert heißt „alle“. */
export interface WkrAuswahl {
  parcours?: string
  klasse?: ClassId
  lauf?: number
  liste?: string
}

export function waehleBoegen(boegen: readonly WkrBogen[], auswahl: WkrAuswahl): WkrBogen[] {
  return boegen.filter(
    (b) =>
      (auswahl.parcours === undefined || b.parcoursId === auswahl.parcours) &&
      (auswahl.klasse === undefined || b.klassen.includes(auswahl.klasse)) &&
      (auswahl.lauf === undefined || b.lauf === auswahl.lauf) &&
      (auswahl.liste === undefined || b.typeId === auswahl.liste),
  )
}
