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
 * Eine Media-Query live (Pad quer, W3-03): `true`, solange sie passt. Ohne matchMedia (Tests, alte Browser) `false` –
 * dann bleibt es bei den Reitern.
 */
export function useMedien(query: string): Ref<boolean> {
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const passt = ref(!!mq?.matches)
  const neu = (e: MediaQueryListEvent) => (passt.value = e.matches)
  mq?.addEventListener?.('change', neu)
  onBeforeUnmount(() => mq?.removeEventListener?.('change', neu))
  return passt
}
