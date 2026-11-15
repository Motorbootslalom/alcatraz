import { inject } from 'vue'
import { formatDateTime, t } from '../i18n'
import { storeKey } from '../state/store'
import { standLeer } from './eingaben'
import { offline, uebernehmen } from './offline'

/**
 * Eine Fassung in Worten, wie in der Fußzeile: Codestand (Commit mit seinem Zeitpunkt) und
 * Zeitpunkt des Builds. Der Offline-Speicher nennt für die bereitliegende Fassung dieselben Angaben.
 * Der Build mit Sekunden (Entscheidung des Nutzers vom 15.11.2026): Zwei Builds derselben Minute
 * aus demselben Commit sind unter „Läuft“ und „Liegt bereit“ sonst nicht zu unterscheiden.
 */
export function fassungsText(commit: string, commitZeit: string, bauZeit: string): string {
  const zeit = formatDateTime(commitZeit)
  const stand = !commit ? t('app.unknown') : zeit ? `${commit} (${zeit})` : commit
  return t('app.footer', { commit: stand, time: formatDateTime(bauZeit, true) || t('app.unknown') })
}

/**
 * „Update“: die bereitliegende Fassung übernehmen (lib/offline.ts). Die Daten bleiben dabei im
 * Browser – trotzdem wird der Stand zuerst unter einem Namen im Verlauf abgelegt: Liest die neue
 * Fassung ihn anders als gedacht, liegt der Stand von davor einen Klick entfernt. Ein leerer
 * Stand braucht das nicht; ohne zweiten Speicher (kein Verlauf) wird trotzdem umgeschaltet.
 */
export function useUpdate(): () => Promise<boolean> {
  const store = inject(storeKey, null)
  let laeuft = false
  return async () => {
    if (laeuft || !offline.neu || offline.uebernimmt) return false
    laeuft = true
    try {
      if (store && !standLeer(store.state.value)) {
        await store.zweit.merke(t('offline.update.backupName', { fassung: [offline.neuFassung, formatDateTime(offline.neuZeit, true)].filter(Boolean).join(', ') || t('app.unknown') })).catch(() => false)
      }
      return await uebernehmen()
    } finally {
      laeuft = false
    }
  }
}
