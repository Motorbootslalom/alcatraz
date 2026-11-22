import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import type { AnsichtModus, AnsichtWahl } from '../../geraete/ablage'

/**
 * Hell/Dunkel des Geräts für die WKR-Maske (Nutzer 21.11.2026, P-18/W3-01, WKR_ANNAHMEN GF1, noch zu bestätigen):
 * „Hell/Dunkel ist für Geräteeigentümer heilig“ – ohne eigene Wahl folgt die Maske dem System, auch wenn es mitten im
 * Wettkampf umschaltet (Abenddämmerung). Gelesen in JS statt per `@media (prefers-color-scheme)` in der CSS: So bleibt
 * `data-modus` die EINE Stelle, an der die Farben hängen (Tokens --wkr-* je Modus), und `color-scheme` folgt der Maske.
 */
export function useSystemModus(): Ref<'hell' | 'dunkel'> {
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const modus = ref<'hell' | 'dunkel'>(mq?.matches ? 'dunkel' : 'hell')
  const neu = (e: MediaQueryListEvent) => (modus.value = e.matches ? 'dunkel' : 'hell')
  mq?.addEventListener?.('change', neu)
  onBeforeUnmount(() => mq?.removeEventListener?.('change', neu))
  return modus
}

/** Was die Maske zeigt: die Wahl, bei „Wie Gerät“ der Modus des Systems. */
export function wirksamerModus(wahl: AnsichtWahl, system: 'hell' | 'dunkel'): AnsichtModus {
  return wahl === 'geraet' ? system : wahl
}

/** Wahl und System zusammen – für WkrGeraet und die Übungswahl. */
export function useWirksamerModus(wahl: () => AnsichtWahl) {
  const system = useSystemModus()
  return computed(() => wirksamerModus(wahl(), system.value))
}

/**
 * Breite und Höhe des Fensters live (W5.1, 22.11.2026) – für die Anordnung der Maske (wkr/anordnung.ts). Ersetzt die
 * Media-Query `useMedien` (Pad quer ≥ 1000 px, GF8): Die Anordnung rechnet rein mit Zahlen, und Tests setzen die Größe
 * über `window.innerWidth`/`innerHeight` (happy-dom setViewport) und ein `resize`-Ereignis, ohne feste Pausen. Ohne
 * Fenster (SSR): 0 × 0, also Handy.
 */
export function useFenster(): Ref<{ breite: number; hoehe: number }> {
  const lies = () => (typeof window !== 'undefined' ? { breite: window.innerWidth || 0, hoehe: window.innerHeight || 0 } : { breite: 0, hoehe: 0 })
  const groesse = ref(lies())
  const neu = () => {
    const g = lies()
    // Bildschirmtastatur (Prüfbefund 22.11.2026, WKR_ANNAHMEN.tastaturAendertNichts): Android-Browser verkleinern beim
    // Öffnen der Tastatur das Fenster. Gleiche Breite, andere Höhe, während ein Eingabefeld den Fokus hat → die alte
    // Höhe behalten – sonst spränge ein Pad hochkant auf „quer“ (anderer Spaltenplatz), die Spalte mit dem Feld würde
    // abgebaut, Fokus und Tastatur gingen weg und die Anordnung spränge zurück. Ein Drehen ändert immer die Breite.
    if (g.breite === groesse.value.breite && g.hoehe !== groesse.value.hoehe && tippt()) return
    if (g.breite !== groesse.value.breite || g.hoehe !== groesse.value.hoehe) groesse.value = g
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', neu)
  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', neu)
  })
  return groesse
}

/** Hat ein Feld mit Bildschirmtastatur den Fokus (Eingabe außer Knöpfen/Haken, Textfeld, editierbar)? */
function tippt(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el || el === document.body) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}
