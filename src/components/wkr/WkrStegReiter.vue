<script setup lang="ts">
import type { ListenTeil } from '../../wkr/liste'
import { useWkrText } from './texte'

/**
 * Steg-Reiter (W3.3, Plan §5.3, F16): [ABLEGEN 23 · 2] [ANLEGEN 17 · 1] – Nummer des Kopfs und Zahl wartender Boote
 * je Teil. Wechselt NIE von selbst (sonst tippt der Wettkampfrichter im falschen Teil); ein Teil-Gerät sieht nur
 * seinen Reiter, ohne Knopf.
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
        <span v-if="stand[x].kopf" data-teil="steg-kopf">{{ stand[x].kopf }}</span>
        <span v-if="stand[x].wartend > 1" data-teil="steg-wartend">· {{ stand[x].wartend }}</span>
      </button>
    </template>
  </div>
</template>
