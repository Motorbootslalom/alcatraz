import { ref } from 'vue'
import type { ClassId } from '../types'
import type { QrZiel } from './qr'
import type { WkrBogen } from './wkrListen'

// Vom gelesenen Code zum Bogen der Erfassung. Der Code nennt Parcours, Klassen, Lauf und –
// bei einem Bogen – die Liste; gesucht wird unter den Bögen der Veranstaltung
// (lib/wkrListen.ts), denselben, die gedruckt wurden.

export interface ScanTreffer {
  bogen: WkrBogen
  /** Die Klasse, unter der die Erfassung den Bogen zeigt. */
  klasse: ClassId
  /**
   * `false`: Den Bogen gibt es so nicht mehr (nach dem Druck wurde anders zusammengefasst,
   * etwa „Papier sparen“ umgestellt) – gezeigt wird der, auf dem die erste Klasse des Codes
   * jetzt steht. Die Eingaben hängen am Starter, sie landen trotzdem richtig.
   */
  genau: boolean
}

const gleich = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k))

/**
 * Der Bogen zu einem Code. Ein Laufzettel-Code trifft die erste Liste seiner Klasse(n) in dem
 * Lauf. `ohneLauf` sagt, ob eine Liste keinen Lauf hat (Knoten): Sie gibt es nur einmal, und
 * sie passt zu jedem Lauf. `null`: Für diese Klassen gibt es dort keinen Bogen (mehr).
 */
export function scanBogen(ziel: QrZiel, boegen: readonly WkrBogen[], ohneLauf: (typeId: string) => boolean): ScanTreffer | null {
  const amParcours = boegen.filter((b) => b.parcoursId === ziel.parcoursId && (b.lauf === ziel.lauf || ohneLauf(b.typeId)))
  const infrage = ziel.typeId === undefined ? amParcours.filter((b) => b.lauf === ziel.lauf) : amParcours.filter((b) => b.typeId === ziel.typeId)
  const mit = (b: WkrBogen) => ziel.klassen.find((k) => b.klassen.includes(k))
  // Ein Bogen-Code nennt genau die Klassen des Bogens; ein Laufzettel fasst mehrere Bögen zusammen.
  const genau = ziel.typeId === undefined ? infrage.find((b) => b.klassen.includes(ziel.klassen[0])) : infrage.find((b) => gleich(b.klassen, ziel.klassen))
  const bogen = genau ?? infrage.find((b) => b.klassen.includes(ziel.klassen[0])) ?? infrage.find((b) => mit(b) !== undefined)
  if (!bogen) return null
  return { bogen, klasse: mit(bogen)!, genau: !!genau }
}

// ---- Stand der Ansicht --------------------------------------------------------
// Bewusst nicht im Stand der Veranstaltung: Ein Scan ist Bedienung, kein Inhalt. Er lebt für
// dieses Fenster – der Scanner wirkt in jeder Ansicht (App.vue) und führt in die Erfassung.

export interface ScanStand {
  code: string
  /** Zählt jeden Scan, damit auch derselbe Code noch einmal zum Bogen springt. */
  nr: number
}

/** Der zuletzt gelesene Code; ausgewertet wird er in der Erfassung, die den Stand kennt. */
export const scanStand = ref<ScanStand | null>(null)

let zaehler = 0

/**
 * Der Scan, zu dessen Bogen die Erfassung schon gesprungen ist. Die Ansicht wird bei jedem
 * Wechsel neu aufgebaut; ohne dieses Merken spränge sie beim Zurückkommen wieder dorthin.
 */
export const scanErledigt = { nr: 0 }

/** Einen gescannten oder getippten Code zur Auswertung melden. */
export function meldeScan(text: string): void {
  // So, wie der Code gelesen wird (lib/qr.ts): ohne Leerraum, groß – auch in der Anzeige.
  scanStand.value = { code: text.replace(/\s+/g, '').toUpperCase(), nr: ++zaehler }
}

/** Den Hinweis zum letzten Scan schließen. */
export function scanBeenden(): void {
  scanStand.value = null
}
