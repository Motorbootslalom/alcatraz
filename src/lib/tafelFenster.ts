import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'

/**
 * Bedienung eines Fensters, das eine Anzeigetafel zeigt – im zweiten Fenster am Bedienrechner (src/AnzeigeApp.vue)
 * wie auf einem Gerät mit Lese-Link (src/GeraetApp.vue, E6): Taste F oder Doppelklick schaltet Vollbild, der
 * Mauszeiger verschwindet nach kurzer Ruhe. An einer Stelle, damit sich beide Fenster gleich bedienen lassen.
 */
export interface TafelFenster {
  /** Der Mauszeiger ruht: verbergen (Klasse `zeiger-weg`, styles/anzeige.css). */
  zeigerWeg: Readonly<Ref<boolean>>
  vollbildUmschalten(): Promise<void>
  /** Wie eine Mausbewegung: Zeiger (und was mit ihm erscheint) zeigen – auch bei Berührung (Handy, Tablet). */
  regung(): void
}

/** So lange bleibt der Mauszeiger nach der letzten Bewegung sichtbar. */
export const ZEIGER_RUHE_MS = 2500

export function useTafelFenster(): TafelFenster {
  async function vollbildUmschalten(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // Ohne Geste des Nutzers verweigert der Browser das Vollbild – dann eben per F11.
    }
  }

  function beiTaste(e: KeyboardEvent): void {
    // Nicht beim Tippen: Auf dem gekoppelten Gerät (E7) stehen Geräte-Code und Meldung in derselben Wurzel.
    const ziel = e.target as HTMLElement | null
    if (ziel && (ziel.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName))) return
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) void vollbildUmschalten()
  }

  // Der Mauszeiger verschwindet nach kurzer Ruhe – auf der Tafel hat er nichts verloren.
  const zeigerWeg = ref(true)
  let takt: ReturnType<typeof setTimeout> | undefined
  function regung(): void {
    zeigerWeg.value = false
    clearTimeout(takt)
    takt = setTimeout(() => (zeigerWeg.value = true), ZEIGER_RUHE_MS)
  }

  onMounted(() => {
    window.addEventListener('keydown', beiTaste)
    window.addEventListener('mousemove', regung)
    window.addEventListener('pointerdown', regung)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', beiTaste)
    window.removeEventListener('mousemove', regung)
    window.removeEventListener('pointerdown', regung)
    clearTimeout(takt)
  })
  return { zeigerWeg: readonly(zeigerWeg), vollbildUmschalten, regung }
}
