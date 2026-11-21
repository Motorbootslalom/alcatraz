<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t, tn } from '../i18n'

/**
 * Ladebalken, während eine lange Liste schrittweise entsteht (lib/aufbau.ts useSchrittweise;
 * Wunsch des Nutzers vom 21.11.2026: „ich habe dich verstanden, ich muss das kurz erzeugen“ – ein
 * Balken mit echtem Stand statt eines endlos drehenden Kreises). Darunter läuft wie ein Abspann,
 * was gerade entsteht: die aktuelle Zeile hell, die letzten davor verblassend darüber.
 *
 * Auslegung (21.11.2026): Der Nutzer nannte als Möglichkeit auch eine „Star-Wars“-Einblendung, die
 * durchrattert. Gewählt ist der Balken mit echtem Stand (sein Favorit) und als Andeutung davon nur
 * dieser kurze Abspann aus vier Zeilen – ein ganzer Lauftext verdeckte die Bögen, die gerade entstehen.
 *
 * Erst sichtbar, wenn der Aufbau länger als AUFBAU.anzeigeAbMs dauert (`zeigen`) – kleine Listen
 * stehen sofort, ohne dass etwas aufblitzt. Bis dahin hält er seinen Platz unsichtbar frei, damit die
 * Bögen beim Erscheinen nicht nach unten rutschen; einmal gezeigt, bleibt er AUFBAU.mindestensMs
 * stehen (lib/aufbau.ts). Klebt beim Rollen unter der ebenfalls klebenden Kopfleiste (gemessen wie
 * in views/ErfassungView.vue: am Telefon bricht sie um und ist höher). Nie gedruckt; wer während des Aufbaus Strg+P drückt,
 * bekommt statt halber Listen nur den Hinweis `aufbau-druckhinweis` aufs Papier (styles/app.css).
 */
const props = defineProps<{
  fertig: number
  gesamt: number
  zeigen: boolean
  /**
   * Was gerade entsteht – mit den Namen, die die Auswahl darüber zeigt (Listentitel wie im Auswahlfeld,
   * unter UIM also in der Sprache der Listen; Runde, Racecourse, Lauf in der Oberflächensprache).
   */
  zeile?: string
  /** Ohne den Satz für Strg+P – wenn ohnehin ein anderer Hinweis statt der Listen gedruckt wird (vor der Verzahnung). */
  ohneDruckhinweis?: boolean
}>()

const anteil = computed(() => (props.gesamt > 0 ? Math.min(1, props.fertig / props.gesamt) : 1))
const prozent = computed(() => `${Math.round(anteil.value * 1000) / 10}%`)
const standText = computed(() => tn('lists.aufbau.stand', props.gesamt, { fertig: props.fertig }))

// Höhe der klebenden Kopfleiste (App.vue .topbar): So weit unten klebt der Balken.
const kopfHoehe = ref(0)
let kopfWaechter: ResizeObserver | undefined
function messeKopf() {
  kopfHoehe.value = Math.round(document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0)
}
onMounted(() => {
  messeKopf()
  const kopf = document.querySelector('.topbar')
  if (kopf && typeof ResizeObserver === 'function') {
    kopfWaechter = new ResizeObserver(messeKopf)
    kopfWaechter.observe(kopf)
  }
})
onBeforeUnmount(() => kopfWaechter?.disconnect())

// Die letzten Zeilen für den Abspann; die jüngste steht unten.
const vorher = ref<string[]>([])
watch(
  () => props.zeile,
  (neu, alt) => {
    if (alt && alt !== neu) vorher.value = [...vorher.value, alt].slice(-3)
  },
)
// Neue Auswahl (anderes Ganzes) oder Stand rückwärts (neuer Anfang): Der Abspann beginnt von vorn,
// ohne Zeilen der vorigen Auswahl. Nach dem Watcher der Zeile: Wechseln beide zugleich, gewinnt das Leeren.
watch(
  () => [props.gesamt, props.fertig] as const,
  ([gesamt, fertig], [altGesamt, altFertig]) => {
    if (gesamt !== altGesamt || fertig < altFertig) vorher.value = []
  },
)
</script>

<template>
  <div class="aufbau" :style="{ '--kopf-hoehe': `${kopfHoehe}px` }">
    <div
      :class="['panel', 'no-print', 'aufbau-balken', zeigen ? '' : 'aufbau-balken--wartet']"
      role="progressbar"
      :aria-hidden="zeigen ? undefined : 'true'"
      :aria-valuemin="0"
      :aria-valuemax="gesamt"
      :aria-valuenow="fertig"
      :aria-valuetext="standText"
      :aria-label="t('lists.aufbau.titel')"
      :data-teil="zeigen ? 'aufbau' : undefined"
    >
      <div class="aufbau-kopf">
        <strong>{{ t('lists.aufbau.titel') }}</strong>
        <span class="aufbau-zahl" data-teil="aufbau-stand">{{ standText }}</span>
      </div>
      <div class="aufbau-bahn"><div class="aufbau-fuellung" :style="{ width: prozent }" /></div>
      <ol class="aufbau-abspann" aria-hidden="true">
        <li v-for="(z, i) in vorher" :key="`${i}-${z}`" :class="`aufbau-alt aufbau-alt--${vorher.length - i}`">{{ z }}</li>
        <li v-if="zeile" class="aufbau-jetzt" data-teil="aufbau-zeile">{{ zeile }}</li>
      </ol>
    </div>
    <p v-if="!ohneDruckhinweis" class="aufbau-druckhinweis" data-hinweis="aufbau-druck">{{ t('lists.aufbau.druck') }}</p>
  </div>
</template>
