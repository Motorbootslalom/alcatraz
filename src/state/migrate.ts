import type { AppState, OriginMode, Starter } from '../types'
import { SCHEMA_VERSION } from '../types'
import { emptyState } from './reducer'
import { aufbauOf, regelwerkOf } from '../config/catalog'
import { ID_MUSTER } from '../config/eigene'
import type { RawAufbau } from '../config/schema'
import { normalisiereEinteilung } from '../lib/einteilung'

/**
 * Einen gelesenen Stand (localStorage, Sicherungsdatei) auf die aktuelle Fassung
 * bringen. Unbekanntes oder Kaputtes ergibt `null` – dann beginnt die
 * Anwendung leer, statt mit halben Daten zu rechnen.
 *
 * Neue Fassungen bekommen hier einen Schritt `if (version < n) { … }`; die
 * Schritte laufen der Reihe nach, sodass auch alte Sicherungen lesbar bleiben.
 */
export function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const loaded = raw as Partial<AppState>
  if (!Array.isArray(loaded.starters)) return null
  if (typeof loaded.schemaVersion === 'number' && loaded.schemaVersion > SCHEMA_VERSION) return null

  const base = emptyState()
  // Eine Kennung gilt einmal, der erste Eintrag gewinnt: Zwei gleiche wären in der Liste
  // nicht zu unterscheiden (Bearbeiten träfe den ersten, Löschen beide).
  const gesehen = new Set<string>()
  const eigeneAufbauten = (Array.isArray(loaded.eigeneAufbauten) ? loaded.eigeneAufbauten.filter(isAufbau) : []).filter(
    (a) => !gesehen.has(a.id) && !!gesehen.add(a.id),
  )
  const parcoursList = Array.isArray(loaded.parcoursList) ? loaded.parcoursList : base.parcoursList
  return {
    ...base,
    ...loaded,
    schemaVersion: SCHEMA_VERSION,
    starters: loaded.starters.map(normalizeStarter),
    parcoursList,
    boats: { ...base.boats, ...loaded.boats },
    // Kennungen, die es nicht (mehr) gibt, fallen auf die Vorgabe zurück.
    regelwerk: regelwerkOf(loaded.regelwerk ?? '').id,
    eigeneAufbauten,
    // Auch ein eigener, den die Fachprüfung ablehnt, ist nicht wählbar (config/catalog.ts).
    aufbau: aufbauOf(loaded.aufbau ?? '', eigeneAufbauten).id,
    sollgewicht: ownWeights(loaded.sollgewicht, regelwerkOf(loaded.regelwerk ?? '').gewichte),
    verzahnungLocked: loaded.verzahnungLocked === true,
    showBirthdate: loaded.showBirthdate !== false,
    listOrigin: loaded.listOrigin === 'kurz' ? 'kurz' : 'lang',
    originShort: { ...loaded.originShort },
    // Fehlt in Ständen vor der WKR-Einteilung; Unbrauchbares entfällt – auch Namen zu
    // Parcours, die es nicht (mehr) gibt.
    einteilung: normalisiereEinteilung(
      loaded.einteilung,
      parcoursList.map((p) => p?.id).filter((id): id is string => typeof id === 'string'),
    ),
    startNrMode: loaded.startNrMode === 'klassisch' ? 'klassisch' : 'klasse',
    // `enabled` stammt aus dem Prototyp (Nummern als Zusatz); hier gibt es nur eine Art je Veranstaltung.
    runningNumbers: { ...base.runningNumbers, ...loaded.runningNumbers, enabled: false },
  }
}

/**
 * Hat der Eintrag die Gestalt eines eigenen Aufbaus? Geprüft wird hier nur die Form, damit
 * eine Sicherung nichts verliert: Was die Fachprüfung ablehnt, bleibt gespeichert, gilt aber
 * nicht (`eigeneAuswahl` in config/konfig.ts) – die Einstellungen nennen es mit dem Grund.
 */
function isAufbau(value: unknown): value is RawAufbau {
  if (!value || typeof value !== 'object') return false
  const a = value as Partial<RawAufbau>
  return (
    typeof a.id === 'string' &&
    ID_MUSTER.test(a.id) &&
    typeof a.name === 'string' &&
    Array.isArray(a.positionen) &&
    a.positionen.every((p) => typeof p === 'string' || (!!p && typeof p === 'object' && typeof p.id === 'string'))
  )
}

/** Nur behalten, was vom Regelwerk abweicht – der Rest folgt dem Regelwerk, auch wenn es wechselt. */
function ownWeights(
  loaded: AppState['sollgewicht'] | undefined,
  preset: AppState['sollgewicht'],
): AppState['sollgewicht'] {
  const own: AppState['sollgewicht'] = {}
  for (const [klasse, kg] of Object.entries(loaded ?? {}) as [keyof AppState['sollgewicht'], number][]) {
    if (typeof kg === 'number' && kg > 0 && kg !== preset[klasse]) own[klasse] = kg
  }
  return own
}

function normalizeStarter(s: Starter): Starter {
  return {
    id: String(s.id),
    startNr: s.startNr ?? '',
    vorname: s.vorname ?? '',
    nachname: s.nachname ?? '',
    verein: s.verein ?? '',
    bundesland: s.bundesland ?? '',
    geburtsdatum: s.geburtsdatum ?? '',
    klasse: s.klasse,
    groesse: s.groesse ?? '',
    ...(typeof s.gewicht === 'number' && s.gewicht > 0 ? { gewicht: s.gewicht } : {}),
  }
}

/**
 * Stand des Verzahnungs-Prototyps (`verzahnung-prototyp:v1`) übernehmen. Der
 * Prototyp nannte die Starter `participants`; alles Übrige passt.
 */
export function fromVerzahnungPrototyp(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (!Array.isArray(old.participants)) return null
  const { participants, initialized: _initialized, originMode, ...rest } = old
  const origin: OriginMode = originMode === 'bundesland' ? 'bundesland' : 'verein'
  return migrate({ ...rest, originMode: origin, starters: participants })
}
