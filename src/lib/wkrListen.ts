import type { AppState, ClassId, ParallelRunde, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { versucheNacheinander } from '../config/catalog'
import { planEvent } from '../planung/plan'
import { BOGEN_VORGABEN, defFuerKlasse, type BogenAuftrag, type BogenKonfig, type BogenOptionen } from './bogen'
import { bogenCode } from './qr'
import { veranstaltungsListen, type ListenWahlKonfig } from './listen'

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
// Erfassung: Eine Eingabe gehört zu Starter-ID + Lauf + Liste (+ Spalte). Genau das trägt
// ein Bogen: `lauf`, `typeId` und je Zeile die `id` des Starters – die Startnummer ist nur
// die Beschriftung und darf sich ändern. Der QR-Code im Kopf (lib/qr.ts) nennt Veranstaltung,
// Regelwerk, Aufbau, Parcours, Klassen, Lauf und Liste; damit findet die Erfassung den Bogen.

/** Was die Ableitung von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface WkrListenKonfig extends BogenKonfig, ListenWahlKonfig {}

export type WkrListenStand = Pick<
  AppState,
  'eventName' | 'eventJahr' | 'eventKind' | 'laufCount' | 'aufbau' | 'parcoursList' | 'einteilung' | 'wkrLeerzeilen' | 'wkrLeerzeilenKlasse' | 'wkrClubGemeinsam'
> &
  // Für den QR-Code; ohne sie (Tests, Beispielansicht) steht dort „keine Kennung“. Ohne
  // Angaben zur Seitenaufteilung wird automatisch geteilt; ohne `wkrLeerzeilenSeite` gilt
  // auf gemeinsamen Bögen die Vorgabe.
  // Ohne `wkrGemeinsamFolge` stehen die Klassen eines gemeinsamen Bogens getrennt (Blöcke).
  Partial<Pick<AppState, 'kennung' | 'regelwerk' | 'wkrZeilenJeSeite' | 'wkrTeilenAb' | 'tor5MitParcours' | 'zusatzListen' | 'wkrLeerzeilenSeite' | 'versucheNacheinander' | 'wkrGemeinsamFolge'>>

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
  optionen: Pick<BogenOptionen, 'leerzeilen' | 'klassenBloecke' | 'leerzeilenJeKlasse' | 'leerzeilenJeSeite' | 'zeilenJeSeite' | 'teilenAb' | 'zebra'>
  /**
   * „Versuche direkt nacheinander“: Der Bogen gilt für so viele Versuche (lib/bogen.ts
   * `BogenAuftrag.versuche`) – ein Klassenzettel für alle Versuche. `lauf` ist dann 1 (der
   * Stapel, in dem er liegt); die Werte stehen je Zeile unter ihrem Versuch. Am Vorsteg
   * (`auftrag.einmal`) steht jeder Starter nur einmal da, seine Zeile gilt für jeden Versuch.
   * Fehlt = ein Lauf.
   */
  versuche?: number
  /**
   * Nur bei Listen des Parallelslaloms (lib/parallelBogen.ts): Der Bogen gehört zu einer Runde
   * und einem Racecourse statt zu Klasse und Lauf. `parcoursId` ist dann die Kennung des
   * Racecourse in der Einteilung, `klassen` nennt alle Klassen des Plans, `lauf` ist ohne
   * Bedeutung (der Attempt steht je Zeile).
   */
  runde?: { runde: ParallelRunde; racecourse: 'A' | 'B' }
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
 * Wie die WKR-Bögen im Druck aufeinander folgen (Nutzer 21.11.2026: „Die Sortierung muss so sein, dass man die Listen
 * für die WKR ohne Sortieren verteilen kann … zusätzlich muss nach Position sortiert werden“): Parcours → Position
 * (Liste) → zeitliche Folge der Verzahnung. Gilt ebenso für den Parallelslalom (lib/parallelBogen.ts: Racecourse →
 * Liste → Runde).
 *
 * `innen` – die zeitliche Folge innerhalb einer Position. Auslegung 21.11.2026, noch zu bestätigen: `lauf` = erst
 * alle Klassen im 1. Lauf (in der Folge der Verzahnung), dann alle im 2. Lauf – so fährt der Betrieb („Lauf 2
 * beginnen“ je Parcours, betrieb/folge.ts: die Folge der Verzahnung je Lauf einmal). `klasse` wäre die frühere
 * Folge (je Klasse erst alle Läufe), falls der WKR seine Bögen je Klasse gebündelt haben will. Seitenzahlen zählt
 * weiter jeder Bogen für sich; die Laufzettel (lib/laufzettel.ts) bleiben je Parcours, Klasse und Lauf.
 */
export const WKR_DRUCKFOLGE: { readonly innen: 'lauf' | 'klasse' } = { innen: 'lauf' }

/**
 * Alle Bögen der Veranstaltung. `folgen` ist die Startreihenfolge je Parcours aus der
 * Verzahnung (`planEvent(...).plans[].sequence`).
 *
 * Reihenfolge ({@link WKR_DRUCKFOLGE}, Nutzer 21.11.2026): Parcours, dann Liste (Position, in der
 * Reihenfolge der Veranstaltung, lib/listen.ts: die Listen des Aufbaus, dahinter die
 * zusätzlichen), darin die zeitliche Folge der Verzahnung – Lauf, darin die Klassen in der
 * Reihenfolge, in der sie laut Verzahnung zuerst starten. So liegt der Stapel aus dem Drucker je
 * Position zusammen und schon in der Folge, in der die Bögen dort gebraucht werden: Er wird nur
 * an den Positionen getrennt und verteilt, nie sortiert.
 * Eine Liste ohne Lauf im Kopf (Knoten) gibt es nur einmal; sie zählt zum letzten Lauf: Die
 * Knoten werden erst für das Gesamtergebnis gebraucht, ihr Bogen liegt deshalb im Stapel des
 * letzten Laufs (und steht auf dessen Laufzettel, lib/laufzettel.ts).
 *
 * Clubmeisterschaft: Klassen, deren Bogen gleich aufgebaut ist, stehen zusammen auf einem
 * Bogen; eine Klasse mit anderen Spalten oder anderem Parcoursbild bekommt ihren eigenen. Mit
 * `wkrClubGemeinsam` (Papier sparen) stehen alle Klassen einer Liste zusammen, ohne Bild;
 * fehlende Spalten sind je Zeile schraffiert (wie die Zeile eines Dummys im Parallelslalom,
 * Nutzer 24.11.2026). Die Wertung bleibt klassenbezogen – jede Zeile kennt ihre Klasse.
 * Wie die Klassen auf dem gemeinsamen Bogen stehen, wählt `wkrGemeinsamFolge` (Nutzer 24.11.2026:
 * „ob die Klassen getrennt oder nach der Verzahnung auf dem Blatt aufgeführt werden sollen“):
 * - `getrennt` (Vorgabe): je Klasse ein Block, die Klasse als Zwischenüberschrift darüber
 *   (lib/bogen.ts `klassenBloecke`). Ohne Papier sparen hat jede Klasse ihre Leerzeilen; mit
 *   Papier sparen teilen sich alle Klassen einer Seite die Leerzeilen – sie stehen einmal am
 *   Ende jeder Seite (`wkrLeerzeilenSeite`) statt nach jeder Klasse.
 * - `verzahnung`: alle Zeilen gemischt in der Startfolge der Verzahnung (die Zeilen kommen
 *   schon so aus `folgen`), ohne Blöcke und Überschriften, die Klasse in einer schmalen Spalte
 *   hinter der Startnummer. Die Leerzeilen stehen am Ende jeder Seite (`wkrLeerzeilenSeite`, mit
 *   leerer Klassenzelle) – es gibt keine Klasse, an deren Ende sie stünden. Geteilt wird
 *   automatisch nach Messung.
 * Ob Bild und Gruppen sich ändern, hängt nur an `wkrClubGemeinsam`; die Folge ändert nur die
 * Zeilen, nicht welche Bögen es gibt (QR-Codes und WKR-Geräte bleiben dieselben; die Laufzettel
 * zählen die Seiten, wie sie dann gedruckt werden).
 *
 * „Versuche direkt nacheinander“ (UIM 960, Pkt. 4.3.2: „2 attempts, run consecutively“; Option
 * der Veranstaltung, config/catalog.ts `versucheNacheinander`): Statt eines Bogens je Lauf gibt
 * es je Liste EINEN, auf dem jeder Starter mit allen Versuchen direkt nacheinander steht – er
 * legt am Steg nur an und fährt gleich noch einmal. Alle Bögen liegen dann in einem Stapel
 * (`lauf` 1, auch die Knoten), mit einem Laufzettel je Klasse. Am Vorsteg kommt der Starter
 * trotzdem nur einmal vorbei (config `einmalJeStarter`): Dort steht er wie auf der Knoten-Liste
 * nur einmal, und seine Zeile gilt für jeden Versuch (lib/bogen.ts `BogenAuftrag.einmal`).
 *
 * `titelVon`: Der Name der Liste, wie er im Kopf ihres Bogens steht – die Bögen haben ihre
 * Sprache je Parcours und Liste (lib/listensprache.ts), der Aufbau ist in jeder Sprache
 * derselbe. Fehlt = der Titel aus `konfig`.
 */
export function wkrBoegen(
  stand: WkrListenStand,
  konfig: WkrListenKonfig,
  folgen: ReadonlyMap<string, readonly Starter[]>,
  titelVon: (typeId: string, parcoursId: string) => string = (typeId) => konfig.getSheetDef(typeId).title,
): WkrListen {
  const eventName = [stand.eventName, stand.eventJahr].filter(Boolean).join(' ')
  const mehrereParcours = stand.parcoursList.length > 1
  const listen = veranstaltungsListen(konfig, stand)
  const laeufe = Math.max(1, stand.laufCount)
  // „Versuche direkt nacheinander“: ein Bogen je Liste mit allen Versuchen – nur, wo das Regelwerk die Option kennt.
  const nacheinander = laeufe > 1 && versucheNacheinander({ regelwerk: stand.regelwerk ?? '', versucheNacheinander: stand.versucheNacheinander })
  const stapel = nacheinander ? 1 : laeufe
  // Reihenfolge der Klassen je Parcours: so, wie sie in der Verzahnung zuerst an den Start
  // gehen – nicht E, 1, 2 … Der Stapel aus dem Drucker liegt dann schon in der Reihenfolge,
  // in der die Bögen am Steg gebraucht werden; man muss ihn nur noch trennen.
  const auftritt = new Map<string, Map<ClassId, number>>()
  const boegen: WkrBogen[] = []
  const club = stand.eventKind === 'club'
  const papierSparen = club && stand.wkrClubGemeinsam
  // Klassen eines gemeinsamen Bogens in der Startfolge statt in Blöcken (Nutzer 24.11.2026, siehe oben).
  const inStartfolge = club && stand.wkrGemeinsamFolge === 'verzahnung'
  const leerJeSeite = stand.wkrLeerzeilenSeite ?? BOGEN_VORGABEN.leerzeilen
  // „Zeilen je Seite“ und „Teilen ab“ gelten für Bögen einer Klasse. Ein gemeinsamer Bogen
  // mehrerer Klassen (Clubmeisterschaft) teilt sich immer automatisch: Die feste Zahl zählt
  // Starter einer Klasse; über Klassen hinweg risse sie Klassen mitten durch und kostete
  // Blätter – dort soll gerade keine Klasse unnötig getrennt werden (lib/paging.ts `blockSeiten`).
  const seiten = { zeilenJeSeite: stand.wkrZeilenJeSeite ?? 0, teilenAb: stand.wkrTeilenAb ?? 0 }

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
      return klassenGruppen(konfig, stand.aufbau, typeId, mitListe, club, papierSparen).map((gruppe) => ({ gruppe, typeId }))
    })
    for (const { gruppe, typeId } of jeGruppe) {
      const def = konfig.getSheetDef(typeId)
      const zeilen = folge.filter((s) => gruppe.includes(s.klasse)).map((s) => ({ nr: s.startNr, id: s.id, klasse: s.klasse }))
      // Ohne Lauf: ein einziger Bogen, im letzten Lauf (siehe oben).
      const versuche = nacheinander && def.showLauf !== false ? laeufe : undefined
      // Am Vorsteg kommt der Starter auch dann nur einmal vorbei: eine Zeile für alle Versuche.
      const einmal = versuche !== undefined && def.einmalJeStarter === true
      for (let lauf = def.showLauf === false ? stapel : 1; lauf <= stapel; lauf++) {
        boegen.push({
          id: [parcours.id, gruppe.join('+'), lauf, typeId].join('|'),
          parcoursId: parcours.id,
          parcoursName: parcours.name,
          klassen: gruppe,
          lauf,
          typeId,
          titel: titelVon(typeId, parcours.id),
          ...(versuche ? { versuche } : {}),
          auftrag: {
            typeId,
            klassen: gruppe,
            lauf,
            zeilen,
            ...(versuche ? { versuche } : {}),
            ...(einmal ? { einmal } : {}),
            eventName,
            aufbauId: stand.aufbau,
            // Wie auf den Startlisten: Der Parcours steht nur da, wenn es mehrere gibt.
            parcours: mehrereParcours ? parcours.name : undefined,
            // Der Name hängt am Parcours des Bogens, nicht an der Klasse (lib/einteilung.ts).
            wkr: stand.einteilung[parcours.id]?.[typeId]?.trim() ?? '',
            // Gemeinsamer Bogen über Klassen mit verschiedenen Zeichnungen: lieber kein Bild als ein fremdes.
            ohneBild: papierSparen && gruppe.length > 1,
            qr: bogenCode({ kennung: stand.kennung ?? '', regelwerk: stand.regelwerk ?? '', aufbau: stand.aufbau }, { parcoursId: parcours.id, klassen: gruppe, lauf, typeId }),
          },
          optionen:
            gruppe.length > 1
              ? inStartfolge
                ? // In der Startfolge: keine Blöcke; die Leerzeilen am Ende jeder Seite gehören keiner Klasse (lib/bogen.ts).
                  { leerzeilen: 0, leerzeilenJeSeite: leerJeSeite }
                : papierSparen
                  ? // Papier sparen: Die Klassen einer Seite teilen sich die Leerzeilen (lib/bogen.ts).
                    { klassenBloecke: true, leerzeilen: 0, leerzeilenJeSeite: leerJeSeite }
                  : { klassenBloecke: true, leerzeilen: stand.wkrLeerzeilen, leerzeilenJeKlasse: stand.wkrLeerzeilenKlasse }
              : { leerzeilen: stand.wkrLeerzeilenKlasse[gruppe[0]] ?? stand.wkrLeerzeilen, ...seiten },
        })
      }
    }
  }
  // Je Parcours und Position die zeitliche Folge (WKR_DRUCKFOLGE); `lage` hält Gleiches stabil
  // (Clubmeisterschaft: Klassengruppen einer Liste in der Folge ihrer ersten Klasse).
  const lage = new Map(boegen.map((b, i) => [b.id, i]))
  const parcoursRang = new Map(stand.parcoursList.map((p, i) => [p.id, i]))
  const listenRang = new Map(listen.map((typeId, i) => [typeId, i]))
  const klasseVor = (a: WkrBogen, b: WkrBogen) => auftritt.get(a.parcoursId)!.get(a.klassen[0])! - auftritt.get(b.parcoursId)!.get(b.klassen[0])!
  const zeit = (a: WkrBogen, b: WkrBogen) => (WKR_DRUCKFOLGE.innen === 'lauf' ? a.lauf - b.lauf || klasseVor(a, b) : klasseVor(a, b) || a.lauf - b.lauf)
  boegen.sort(
    (a, b) =>
      parcoursRang.get(a.parcoursId)! - parcoursRang.get(b.parcoursId)! ||
      listenRang.get(a.typeId)! - listenRang.get(b.typeId)! ||
      zeit(a, b) ||
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
export function wkrBoegenZumStand(stand: AppState, konfig: WkrListenKonfig, titelVon?: (typeId: string, parcoursId: string) => string): WkrListen {
  const folgen = new Map(planEvent(stand).plans.map((p) => [p.parcoursId, p.sequence]))
  const ergebnis = wkrBoegen(stand, konfig, folgen, titelVon)
  const mitBogen = new Set(ergebnis.boegen.flatMap((b) => b.klassen))
  return { ...ergebnis, ohneListe: CLASS_IDS.filter((k) => !mitBogen.has(k) && stand.starters.some((s) => s.klasse === k)) }
}

/**
 * Die Klassen in der Druckreihenfolge aller Listen: erst nach Parcours, dann in der
 * Reihenfolge, in der sie laut Verzahnung zuerst starten – so liegt der Stapel aus dem
 * Drucker schon richtig und muss nur getrennt werden. Klassen mit Startern, die auf keinem
 * Parcours fahren, folgen am Ende (E, 1, 2 …); auch sie können Ergebnisse haben.
 */
export function klassenInStartfolge(stand: AppState): ClassId[] {
  const plaene = new Map(planEvent(stand).plans.map((p) => [p.parcoursId, p.sequence]))
  const folge: ClassId[] = []
  for (const parcours of stand.parcoursList) {
    for (const s of plaene.get(parcours.id) ?? []) if (!folge.includes(s.klasse)) folge.push(s.klasse)
  }
  return [...folge, ...CLASS_IDS.filter((k) => !folge.includes(k) && stand.starters.some((s) => s.klasse === k))]
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
