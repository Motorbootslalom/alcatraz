<script setup lang="ts">
import type { ListenTeil } from '../../wkr/liste'
import { useWkrText } from './texte'

/**
 * Steg-Reiter (W3.3, Plan §5.3, F16): [ABLEGEN 23 · 2] [ANLEGEN 17 · 1] – Nummer des Kopfs und Zahl wartender Boote
 * je Teil. Wechselt NIE von selbst (sonst tippt der Wettkampfrichter im falschen Teil); ein Teil-Gerät sieht nur
 * seinen Reiter, ohne Knopf.
 *
 * Nutzer 21.11.2026 (W3-51, WKR_ANNAHMEN GF3): Auf einem Gerät für den ganzen Steg stehen BEIDE Reiter immer da, auch
 * wenn im anderen Teil gerade nichts zu tun ist, und jeder sagt, ob er fertig ist: „✓“ = nichts offen, sonst die Zahl
 * offener Starts (`data-offen`) – so sieht der WKR, dass im anderen Teil jemand wartet. Feste Höhe (zwei Zeilen
 * reserviert), damit nichts darunter springt, wenn die Zahl kommt oder geht (M5).
 */
defineProps<{
  teil: ListenTeil
  /** Teil-gekoppelt: nur dieser Teil. */
  fest: boolean
  stand: Record<ListenTeil, { kopf: string | null; wartend: number }>
}>()
const emit = defineEmits<{ waehle: [teil: ListenTeil] }>()
const { w } = useWkrText()
const TEILE: ListenTeil[] = ['ab', 'an']
</script>

<template>
  <div class="wkr-stegreiter" role="tablist" data-teil="steg-reiter">
    <template v-for="x in TEILE" :key="x">
      <button
        v-if="!fest || x === teil"
        type="button"
        role="tab"
        class="wkr-knopf wkr-stegreiter-knopf"
        data-ziel="klein"
        data-action="steg-teil"
        :data-steg="x"
        :aria-selected="x === teil"
        :disabled="fest"
        @click="emit('waehle', x)"
      >
        <b>{{ w(x === 'ab' ? 'wkr.geraet.steg.ab' : 'wkr.geraet.steg.an') }}</b>
        <span class="wkr-stegreiter-zeile">
          <span v-if="stand[x].kopf" data-teil="steg-kopf">{{ stand[x].kopf }}</span>
          <span
            class="wkr-stegreiter-stand"
            data-teil="steg-stand"
            :data-offen="stand[x].wartend"
            :title="stand[x].wartend === 0 ? w('wkr.geraet.steg.fertig') : w('wkr.geraet.steg.offen', { n: stand[x].wartend })"
          >
            {{ stand[x].wartend === 0 ? '✓' : `· ${stand[x].wartend}` }}
          </span>
        </span>
      </button>
    </template>
  </div>
</template>
