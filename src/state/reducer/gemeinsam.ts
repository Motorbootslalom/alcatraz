// Was reducer.ts und mehrere Bereiche brauchen: die Konfiguration zum Stand.

import type { AppState } from '../../types'
import { configFor, type Konfig } from '../../config/konfig'

/** Die Konfiguration zum Stand – eine reine Funktion, der Reducer bleibt deterministisch. */
export const konfigVon = (state: Pick<AppState, 'regelwerk' | 'eigeneAufbauten'>): Konfig => configFor({ regelwerk: state.regelwerk, eigeneAufbauten: state.eigeneAufbauten })
