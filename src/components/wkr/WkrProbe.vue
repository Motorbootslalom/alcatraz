<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { ListenTeil } from '../../wkr/liste'
import { disqFuer, eintraege, leererEntwurf, punkteVon, teileFuer, tippe, tippeDisq, wechselTakt, zurueck, type Entwurf, type MaskenAufbau } from '../../wkr/maske'
import WkrFuss from './WkrFuss.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrStarterKarte from './WkrStarterKarte.vue'
import WkrVorsteg from './WkrVorsteg.vue'
import { useWkrText } from './texte'

/**
 * Probe beim Einrichten (W3.4, Plan docs/plan-wkr-w3.md §5.9, G10, 21.11.2026): DIESELBEN Teile wie die echte Maske
 * (Karte, Knöpfe bzw. Vorsteg, Fuß) mit dem Start „P“ – aber ohne Quelle: Es wird nichts gesendet, nichts als Entwurf
 * abgelegt, der Bedienrechner sieht die Probe nicht. Schritte (immer mit „Überspringen“):
 *
 * - Katalog (Tor 5, MüB, Steg-Teil): Code <erster Code> tippen → „− letzte zurück“ → Hauptknopf (Fehlerfrei bzw.
 *   Ablegen/Anlegen OK).
 * - Vorsteg: zweimal X, dann „Abbrechen“ (die große Rückfrage, F5) → „In Ordnung“.
 *
 * Der letzte Schritt zeigt das Weiterspringen samt Sperre (G5, wkr/maske.ts wechselTakt): 2 s „● gesendet“, Blitz,
 * 1 s keine Eingabe – erst dann „Probe fertig“. WkrGeraet merkt die Probe je Raum und Liste (ablage.ts `probe`).
 */
const props = defineProps<{
  aufbau: MaskenAufbau
  teil?: ListenTeil
  hand: 'rechts' | 'links'
}>()
const emit = defineEmits<{ fertig: [] }>()
const { w } = useWkrText()

const vorsteg = computed(() => props.aufbau.art === 'vorsteg')
const teile = computed(() => teileFuer(props.aufbau, props.teil))
const ersterCode = computed(() => teile.value[0]?.codes[0] ?? null)
const disqCodes = computed(() => disqFuer(props.aufbau, props.teil))
/** Ohne Code (Katalog ohne Einträge) und ohne X am Vorsteg bleibt nur der Hauptknopf. */
const schritte = computed<('code' | 'zurueck' | 'x' | 'haupt')[]>(() => {
  if (vorsteg.value) return disqCodes.value.some((c) => c.code === 'X') ? ['x', 'haupt'] : ['haupt']
  return ersterCode.value ? ['code', 'zurueck', 'haupt'] : ['haupt']
})
const schritt = ref(0)
const art = computed(() => schritte.value[schritt.value] ?? null)
const entwurf = shallowRef<Entwurf>(leererEntwurf())

// --- Takt wie nach dem echten Abschicken ---
const gesendetUm = ref<number | null>(null)
const jetzt = ref(Date.now())
const zeitgeber = new Set<ReturnType<typeof setTimeout>>()
function nach(ms: number, f: () => void): void {
  const id = setTimeout(() => {
    zeitgeber.delete(id)
    f()
  }, ms)
  zeitgeber.add(id)
}
onBeforeUnmount(() => {
  for (const id of zeitgeber) clearTimeout(id)
})
const takt = computed(() => wechselTakt(gesendetUm.value, jetzt.value))
const gesperrt = computed(() => gesendetUm.value !== null)
const blitz = ref(false)
const fertig = computed(() => gesendetUm.value !== null && takt.value === 'frei')

const weiter = () => (schritt.value += 1)
function tippeCode(feld: string, code: string): void {
  if (gesperrt.value) return
  entwurf.value = tippe(entwurf.value, feld, code)
  if (art.value === 'code' && code === ersterCode.value?.code) weiter()
}
function zurueckTipp(): void {
  if (gesperrt.value) return
  entwurf.value = zurueck(entwurf.value)
  if (art.value === 'zurueck') weiter()
}
function setzeDisq(code: string): void {
  if (gesperrt.value) return
  entwurf.value = tippeDisq(entwurf.value, code)
}
function xNein(): void {
  if (art.value === 'x') weiter()
}
function haupt(): void {
  if (gesperrt.value || art.value !== 'haupt') return
  const um = Date.now()
  gesendetUm.value = um
  jetzt.value = um
  nach(WKR_ANNAHMEN.weiterNachMs, () => {
    jetzt.value = Date.now()
    blitz.value = true
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(60)
    } catch {
      // ohne Bedienung werfen manche Browser – der Blitz genügt
    }
    nach(150, () => (blitz.value = false))
  })
  nach(WKR_ANNAHMEN.weiterNachMs + WKR_ANNAHMEN.sperreMs, () => (jetzt.value = Date.now()))
}

const anweisung = computed(() => {
  switch (art.value) {
    case 'code':
      return w('wkr.geraet.probe.code', { code: ersterCode.value?.code ?? '' })
    case 'zurueck':
      return w('wkr.geraet.probe.zurueck', { knopf: w('wkr.geraet.zurueck') })
    case 'x':
      return w('wkr.geraet.probe.x', { knopf: w('wkr.geraet.abbrechen') })
    default:
      return w('wkr.geraet.probe.haupt', {
        knopf: vorsteg.value ? w('wkr.geraet.inOrdnung') : props.teil ? w(props.teil === 'ab' ? 'wkr.geraet.fehlerfrei.ab' : 'wkr.geraet.fehlerfrei.an') : w('wkr.geraet.fehlerfrei'),
      })
  }
})
const start = computed(() => ({ startNr: 'P', titel: w('wkr.geraet.probe.titel') }))
</script>

<template>
  <div class="wkr-probe" data-teil="probe" :data-schritt="fertig ? 'fertig' : gesperrt ? 'takt' : art" :data-takt="takt">
    <p class="wkr-band wkr-band--hinweis" data-teil="probe-band">
      <b>{{ w('wkr.geraet.probe.band') }}</b>
      <button v-if="!fertig" type="button" class="wkr-knopf" data-ziel="klein" data-action="probe-ueberspringen" @click="emit('fertig')">{{ w('wkr.geraet.probe.ueberspringen') }}</button>
    </p>

    <template v-if="fertig">
      <section class="wkr-ruhe" role="status" data-teil="probe-fertig">
        <h2>{{ w('wkr.geraet.probe.fertig') }}</h2>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="probe-fertig" @click="emit('fertig')">{{ w('wkr.geraet.probe.los') }}</button>
      </section>
    </template>
    <template v-else>
      <p class="wkr-probe-schritt" role="status" data-teil="probe-schritt">
        <template v-if="gesperrt">{{ w('wkr.geraet.probe.warte') }}</template>
        <template v-else>{{ w('wkr.geraet.probe.schritt', { i: schritt + 1, n: schritte.length }) }} {{ anweisung }}</template>
      </p>
      <WkrStarterKarte :start="start" :klasse="aufbau.titel" :gesendet="takt === 'gesendet'" />
      <div class="wkr-mitte" :inert="gesperrt" data-teil="mitte">
        <WkrVorsteg v-if="vorsteg" :codes="disqCodes" :gesetzt="entwurf.disq" start-nr="P" @setze="setzeDisq" @x-nein="xNein" />
        <WkrKnoepfe v-else :teile="teile" :entwurf="entwurf" @tippe="tippeCode" />
      </div>
      <div class="wkr-unten" :inert="gesperrt">
        <WkrFuss
          :art="vorsteg ? 'vorsteg' : 'katalog'"
          :teil="teil"
          :eintraege="eintraege(entwurf)"
          :punkte="punkteVon(entwurf, aufbau, teil)"
          :disq="entwurf.disq"
          :korrektur="null"
          :hand="hand"
          :mit-disq="false"
          :disq-offen="false"
          @zurueck="zurueckTipp"
          @haupt="haupt"
        />
      </div>
    </template>
    <div v-if="blitz" class="wkr-blitz" data-teil="blitz" aria-hidden="true" />
  </div>
</template>
