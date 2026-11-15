<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

/**
 * Ein kleiner Dialog im Stil der Anwendung – für Rückfragen, die mehr sagen müssen als ein
 * `confirm()` (eine Erklärung, ein Angebot, Folgen). Das Element `<dialog>` bringt die
 * Tastatur mit: Der Fokus bleibt im Dialog, Esc bricht ab, und beim Schließen steht er wieder
 * auf dem Knopf, der den Dialog geöffnet hat. Gezeigt wird er, solange er eingebaut ist (`v-if`).
 */
defineProps<{ titel: string }>()
const emit = defineEmits<{ abbrechen: [] }>()

const id = useId()
const el = ref<HTMLDialogElement>()

onMounted(() => {
  const d = el.value
  if (!d) return
  // Ohne `showModal` (sehr alte Browser, Testumgebung) steht er als gewöhnlicher Kasten da.
  if (typeof d.showModal === 'function') d.showModal()
  else d.setAttribute('open', '')
})
// Ausdrücklich schließen: Nur dann gibt der Browser den Fokus an den auslösenden Knopf zurück.
onBeforeUnmount(() => {
  const d = el.value
  if (d?.open && typeof d.close === 'function') d.close()
})

/** Ein Klick neben den Dialog (auf den abgedunkelten Grund) bricht ab – der Grund gehört zum Element selbst. */
function aufGrund(e: MouseEvent) {
  if (e.target === el.value) emit('abbrechen')
}
</script>

<template>
  <dialog ref="el" class="app-dialog" :aria-labelledby="id" @cancel.prevent="emit('abbrechen')" @click="aufGrund">
    <div class="app-dialog-inhalt">
      <h2 :id="id">{{ titel }}</h2>
      <slot />
      <div class="app-dialog-knoepfe">
        <slot name="knoepfe" />
      </div>
    </div>
  </dialog>
</template>
