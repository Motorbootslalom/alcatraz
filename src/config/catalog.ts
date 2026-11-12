import type { ClassId } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { configFor, eigeneAuswahl, ROH_REGELWERKE, type RohRegelwerk } from './konfig'
import { regelwerkInfo } from './build'
import type { RawAufbau } from './schema'

/**
 * Was eine Veranstaltung zur Auswahl hat: Regelwerke (aus der Ausschreibung) und
 * Aufbauten (wie die Wettkampfrichter am Austragungsort sitzen).
 *
 * Eine schmale Sicht auf die Konfiguration der Wettkampfrichter-Listen
 * (config/konfig.ts) – dieselben YAML-Dateien, dieselbe Lesart. Hier steht nur,
 * was Zustand und Planung brauchen, ohne Positionen und Fehlerkataloge. Zu den
 * mitgelieferten Aufbauten kommen die eigenen aus dem Stand der Veranstaltung.
 */
export const MANOEVRIEREN = 'manoevrieren'
export const PARALLEL = 'parallel'

export interface Regelwerk {
  id: string
  /** Anzeige, z. B. „DM 2026“. */
  label: string
  klassen: ClassId[]
  /** Eigene Klassennamen, z. B. E → „Dolphin“. */
  klassenNamen: Partial<Record<ClassId, string>>
  /** Kennungen der Disziplinen, die nach diesem Regelwerk gefahren werden. */
  disziplinen: string[]
  /** Statistisches Durchschnittsgewicht je Klasse in kg (Grundlage des Zusatzgewichts). */
  gewichte: Partial<Record<ClassId, number>>
}

export interface Aufbau {
  id: string
  name: string
  disziplin: string
  /** Ein eigener Aufbau aus dem Stand der Veranstaltung, nicht mitgeliefert. */
  eigen?: boolean
}

const isClassId = (value: string): value is ClassId => (CLASS_IDS as string[]).includes(value)

function readRegelwerk(raw: RohRegelwerk): Regelwerk {
  const info = regelwerkInfo(raw)
  return {
    id: info.id,
    label: info.label,
    klassen: info.klassen.filter(isClassId),
    klassenNamen: raw.klassenNamen ?? {},
    disziplinen: raw.disziplinen ?? [MANOEVRIEREN],
    gewichte: raw.gewichte ?? {},
  }
}

/** Regelwerke in Menü-Reihenfolge; das erste ist die Vorgabe. */
export const REGELWERKE: Regelwerk[] = ROH_REGELWERKE.map(readRegelwerk)

/** Mitgelieferte Aufbauten in Menü-Reihenfolge; der erste ist die Vorgabe. */
export const AUFBAUTEN: Aufbau[] = configFor().aufbauten.map(({ id, name, disziplin }) => ({ id, name, disziplin }))

/** Mitgelieferte Aufbauten für das Manövrieren; der Parallelslalom hat einen festen. */
export const MANOEVER_AUFBAUTEN = AUFBAUTEN.filter((a) => a.disziplin === MANOEVRIEREN)

export const DEFAULT_REGELWERK = REGELWERKE[0].id
export const DEFAULT_AUFBAU = MANOEVER_AUFBAUTEN[0].id

/**
 * Die Aufbauten, unter denen für das Manövrieren gewählt wird: die mitgelieferten, dahinter
 * die eigenen, die die Prüfung bestehen (`eigeneAuswahl` in konfig.ts). Es ist dieselbe
 * Auswahl, mit der die Konfiguration gebaut wird – was hier wählbar ist, liefert sie auch.
 * Nicht wählbar sind deshalb: ein eigener mit der Kennung eines mitgelieferten (der
 * mitgelieferte gilt), ein beschädigter und einer für eine andere Disziplin.
 */
export function manoeverAufbauten(eigene: readonly RawAufbau[] = []): Aufbau[] {
  const dazu = eigeneAuswahl(eigene).gut.map((a): Aufbau => ({ id: a.id, name: a.name, disziplin: MANOEVRIEREN, eigen: true }))
  return [...MANOEVER_AUFBAUTEN, ...dazu]
}

/** Das Regelwerk mit dieser Kennung; unbekannte fallen auf die Vorgabe zurück. */
export function regelwerkOf(id: string): Regelwerk {
  return REGELWERKE.find((r) => r.id === id) ?? REGELWERKE[0]
}

/** Der wählbare Aufbau mit dieser Kennung; unbekannte (auch gelöschte oder abgelehnte eigene) fallen auf die Vorgabe zurück. */
export function aufbauOf(id: string, eigene: readonly RawAufbau[] = []): Aufbau {
  return manoeverAufbauten(eigene).find((a) => a.id === id) ?? MANOEVER_AUFBAUTEN[0]
}

/** Wird nach diesem Regelwerk ein Parallelslalom gefahren? */
export function hasParallel(regelwerkId: string): boolean {
  return regelwerkOf(regelwerkId).disziplinen.includes(PARALLEL)
}

/**
 * Standardgewicht einer Klasse in kg: der eigene Wert der Veranstaltung, sonst
 * der des Regelwerks. `0`, wenn das Regelwerk für die Klasse keines nennt.
 */
export function sollgewichtOf(regelwerkId: string, eigene: Partial<Record<ClassId, number>>, klasse: ClassId): number {
  return eigene[klasse] ?? regelwerkOf(regelwerkId).gewichte[klasse] ?? 0
}
