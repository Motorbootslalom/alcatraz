<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useStore } from '../state/store'
import { useBogenKonfig } from '../lib/konfig'
import { messBoegenRunde, messKennungRunde } from '../lib/parallelBogen'
import type { WkrBogen } from '../lib/wkrListen'
import BogenBlatt from './bogen/BogenBlatt.vue'

/**
 * Misst, wie viele Tabellenzeilen auf ein Blatt jeder Liste des Parallelslaloms passen – je
 * Racecourse und Liste für sich: Jede Liste teilt selbst, auf so wenige Seiten wie möglich
 * (lib/parallelBogen.ts), und ihre Sprache gilt je Racecourse (zweisprachig bricht anders um). Die
 * Laufzettel rechnen daraus die Seitenzahl jeder Liste (ein Kästchen je gedrucktem Blatt).
 *
 * Unsichtbar neben dem Fenster steht dazu je Racecourse und Liste ein Bogen in Druckmaßen (wie die
 * Messung der Laufzettel, components/LaufzettelListen.vue). Gemessen wird jeder Bogen in seiner
 * eigenen Sprache und mit der Rückseiten-Option, wie er gedruckt wird. Was noch nicht gemessen
 * ist (und ohne Layout, etwa im Test), fehlt = unbekannt. Schlüssel: lib/parallelBogen.ts `messKennungRunde`.
 */
const props = defineProps<{ boegen: readonly WkrBogen[] }>()
const emit = defineEmits<{ kapazitaeten: [jeListe: Record<string, number>] }>()

const { state } = useStore()
const bogenKonfig = useBogenKonfig()
const zuMessen = computed(() => messBoegenRunde(props.boegen).map((b) => ({ b, kennung: messKennungRunde({ racecourse: b.runde!.racecourse, typeId: b.typeId }) })))
const gemessen = reactive(new Map<string, number>())
const kapazitaeten = computed(() => Object.fromEntries(zuMessen.value.flatMap(({ kennung }) => ((gemessen.get(kennung) ?? 0) > 0 ? [[kennung, gemessen.get(kennung)!] as const] : []))))
watch(kapazitaeten, (jeListe) => emit('kapazitaeten', jeListe), { immediate: true })
</script>

<template>
  <!-- Nur zum Messen: unsichtbar, nie gedruckt, für Vorleseprogramme nicht da. -->
  <div class="lz-messung no-print" aria-hidden="true" inert>
    <BogenBlatt
      v-for="{ b, kennung } in zuMessen"
      :key="kennung"
      :konfig="bogenKonfig(b.typeId, b.parcoursId)"
      :auftrag="b.auftrag"
      :optionen="b.optionen"
      :rueckseite="state.wkrRueckseite"
      @kapazitaet="gemessen.set(kennung, $event)"
    />
  </div>
</template>
