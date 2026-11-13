import { onUnmounted, ref, type Ref } from 'vue'

/**
 * Winziger Hash-Router. Bewusst kein vue-router: Der Hash funktioniert auch
 * dann, wenn die Anwendung als einzelne Datei von `file://` geöffnet wird –
 * dort gibt es keine History-API-Pfade.
 */
export const VIEWS = ['veranstaltung', 'starter', 'verwiegung', 'verzahnung', 'listen', 'erfassung', 'einstellungen'] as const
export type ViewName = (typeof VIEWS)[number]

function parse(hash: string): ViewName {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  return (VIEWS as readonly string[]).includes(path) ? (path as ViewName) : 'veranstaltung'
}

export function navigate(view: ViewName): void {
  location.hash = `#/${view}`
}

export function useRoute(): Ref<ViewName> {
  const view = ref<ViewName>(parse(location.hash))
  const onChange = () => {
    view.value = parse(location.hash)
  }
  window.addEventListener('hashchange', onChange)
  onUnmounted(() => window.removeEventListener('hashchange', onChange))
  return view
}
