// Verzahnung: festschreiben und freigeben, Boote, Klasse 4 klein, Parcours mit Klassen, Faktor und Spuren.

import type { AppState, BoatConfig, ClassId, Parcours, TrackItem, WechselFaktor } from '../../types'
import { haengeUm, ohneParcours } from '../../lib/einteilung'
import { mitVorlaufPlan } from '../../planung/parallelRunden'
import { hasParallel } from '../../config/catalog'

export type VerzahnungAenderung =
  /**
   * Verzahnung festschreiben oder freigeben. Beim Festschreiben bringt die
   * Action die gerade gezeigten Spuren mit; sie werden als feste Anordnung
   * übernommen, damit ein später nachgemeldeter Starter die Verteilung der
   * Klassen nicht mehr verschiebt.
   */
  | { type: 'SET_VERZAHNUNG_LOCK'; locked: boolean; tracks?: Record<string, TrackItem[][]> }
  | { type: 'SET_BOATS'; boats: BoatConfig }
  | { type: 'SET_CLASS4_SMALL'; class4Small: boolean }
  | { type: 'ADD_PARCOURS'; id: string }
  | { type: 'SET_PARCOURS_PRESET'; parcours: { id: string; classIds: ClassId[] }[]; wechselFaktor?: WechselFaktor }
  | { type: 'REMOVE_PARCOURS'; id: string }
  | { type: 'RENAME_PARCOURS'; id: string; name: string }
  | { type: 'SET_PARCOURS_CLASSES'; id: string; classIds: ClassId[] }
  | { type: 'SET_PARCOURS_FACTOR'; id: string; wechselFaktor: WechselFaktor }
  | { type: 'SET_PARCOURS_TRACKS'; id: string; tracks: TrackItem[][] }
  | { type: 'RESET_TRACKS'; id: string }

function mapParcours(state: AppState, id: string, fn: (p: Parcours) => Parcours): AppState {
  return { ...state, parcoursList: state.parcoursList.map((p) => (p.id === id ? fn(p) : p)) }
}

export function wendeVerzahnungAn(state: AppState, action: VerzahnungAenderung): AppState {
  switch (action.type) {
    case 'SET_VERZAHNUNG_LOCK': {
      const tracks = action.locked ? action.tracks : undefined
      // Mit der Sperre friert auch der Startplan des Parallelslaloms ein (Vorlauf) und wird
      // danach nicht neu gerechnet; beim Lösen entfällt er (planung/parallelRunden.ts).
      return mitVorlaufPlan(
        {
          ...state,
          verzahnungLocked: action.locked,
          parcoursList: tracks
            ? state.parcoursList.map((p) => (tracks[p.id] ? { ...p, tracks: tracks[p.id] } : p))
            : state.parcoursList,
        },
        hasParallel(state.regelwerk),
      )
    }

    case 'SET_BOATS':
      return { ...state, boats: action.boats }

    case 'SET_CLASS4_SMALL':
      return { ...state, class4Small: action.class4Small }

    case 'ADD_PARCOURS':
      return {
        ...state,
        parcoursList: state.parcoursList.concat({
          id: action.id,
          name: `Parcours ${state.parcoursList.length + 1}`,
          classIds: [],
          wechselFaktor: 2,
        }),
      }

    case 'SET_PARCOURS_PRESET':
      return {
        ...state,
        parcoursList: action.parcours.map((p, i) => ({
          id: p.id,
          name: `Parcours ${i + 1}`,
          classIds: p.classIds,
          wechselFaktor: action.wechselFaktor ?? 2,
        })),
        // Die WKR-Namen hängen an der Kennung des Parcours: Sie ziehen mit, sonst wären sie
        // nach jeder Schnellauswahl unsichtbar, stünden aber weiter in jeder Sicherung.
        einteilung: haengeUm(
          state.einteilung,
          state.parcoursList.map((p) => p.id),
          action.parcours.map((p) => p.id),
        ),
        // Ebenso die Sprache der Bögen je Parcours: Sie gehört zu der Gruppe, die dort sitzt.
        wkrSprachen: haengeUm(
          state.wkrSprachen,
          state.parcoursList.map((p) => p.id),
          action.parcours.map((p) => p.id),
        ),
      }

    case 'REMOVE_PARCOURS':
      // Mit dem Parcours gehen die Namen seiner Wettkampfrichter: Es bliebe sonst kein Weg, sie zu löschen.
      return {
        ...state,
        parcoursList: state.parcoursList.filter((p) => p.id !== action.id),
        einteilung: ohneParcours(state.einteilung, action.id),
        wkrSprachen: ohneParcours(state.wkrSprachen, action.id),
      }

    case 'RENAME_PARCOURS':
      return mapParcours(state, action.id, (p) => ({ ...p, name: action.name }))

    case 'SET_PARCOURS_CLASSES':
      // Andere Klassen machen die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, classIds: action.classIds, tracks: undefined }))

    case 'SET_PARCOURS_FACTOR':
      // Ein anderer Faktor macht die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, wechselFaktor: action.wechselFaktor, tracks: undefined }))

    case 'SET_PARCOURS_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: action.tracks }))

    case 'RESET_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: undefined }))
  }
}
