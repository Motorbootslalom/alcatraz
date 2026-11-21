<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PunktId } from '../../types'
import type { MessageKey } from '../../i18n'
import type { ErfassungsQuelle, PruefZeile } from '../../geraete/erfassen'
import type { ListenTeil } from '../../wkr/liste'
import { stufeZeichen, useWkrText } from './texte'

/**
 * „Liste abschließen“ (W3.4, Plan docs/plan-wkr-w3.md §5.7, F7/F8, 21.11.2026): Prüfansicht aller eigenen Zeilen des
 * Punkts aus `pruefung` (geraete/erfassen.ts – überlebt die letzten 20 Zeilen), oben die Summe „30 abgeschickt,
 * 1 offen: 27, 1 X: 9“, je Zeile Nummer, Klasse, Codes als Text, Punkte und Stufe (Zeichen UND Wort, nie nur Farbe).
 * Ein Tipp auf eine Zeile öffnet die Korrektur – nur für Zeilen, die noch in „Zuletzt“ stehen (der Kern korrigiert
 * über die Zeilennummer, Auslegung L1).
 *
 * Unten der Name des Wettkampfrichters (vorbelegt mit dem zuletzt eingegebenen, G12; Pflicht – er ist die digitale
 * Unterschrift, F8) und bei offenen Starts der Schalter „Rest auf Papier“ – Pflicht, sonst bleibt der Knopf gesperrt
 * und ein Satz sagt warum. „Liste abschließen“ → `schliesseAb`; das Ergebnis kommt aus `abschluesse`: unterwegs,
 * angenommen ✓ oder abgelehnt mit Grund (`offen`: der Bedienrechner kennt noch offene Starts). Am Steg mit Teil
 * schließt das Gerät nur seinen Teil (F16 – der Kern nimmt den Teil der Aufgabe).
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  liste: string
  listenTitel: string
  punkt: PunktId
  punktTitel: string
  /** Teil der Aufgabe (Steg nur Ablegen/Anlegen); ohne = die ganze Liste. */
  teil?: ListenTeil
  /** Vorbelegung des Namens (Geräteablage, G12). */
  name: string
  /** Zeile als Text: Klasse, Codes, Punkte – rechnet WkrMaske mit dem Aufbau der Klasse. */
  zeileText: (z: PruefZeile) => { klasse: string; codes: string; punkte: number | null }
  /** Starts, die sich noch korrigieren lassen (in „Zuletzt“). */
  korrigierbar: ReadonlySet<string>
}>()
const emit = defineEmits<{ korrigiere: [s: string]; zurueck: []; name: [name: string] }>()
const { w } = useWkrText()

const pruefung = computed(() => props.quelle.pruefung(props.liste, props.punkt, props.teil))
const summe = computed(() => {
  const p = pruefung.value
  const teile = [w('wkr.geraet.abschluss.abgeschickt', { n: p.zeilen.length })]
  if (p.offen.length > 0) teile.push(w('wkr.geraet.abschluss.offen', { n: p.offen.length, nrs: p.offen.map((o) => o.startNr).join(', ') }))
  if (p.x.length > 0) teile.push(w('wkr.geraet.abschluss.x', { n: p.x.length, nrs: p.x.join(', ') }))
  // W4.3 (R5): „1 nicht vorbeigekommen: 27“ – so sieht der WKR vor der Unterschrift, wen er ohne Werte abgehakt hat.
  if (p.nichtVorbei.length > 0) teile.push(w('wkr.geraet.abschluss.nichtVorbei', { n: p.nichtVorbei.length, nrs: p.nichtVorbei.join(', ') }))
  return teile.join(', ')
})

const name = ref(props.name)
const restPapier = ref(false)
const nameFehlt = computed(() => name.value.trim() === '')
const restFehlt = computed(() => pruefung.value.offen.length > 0 && !restPapier.value)

/** Der eigene Abschluss dieses Punkts – der eben geschickte oder ein früherer (dann gleich mit Ergebnis). */
const gesendet = ref<number | null>(null)
const abschluss = computed(() => {
  const alle = props.quelle.abschluesse.value.filter((a) => a.liste === props.liste && a.punkt === props.punkt)
  return (gesendet.value !== null ? alle.find((a) => a.id === gesendet.value) : alle[0]) ?? null
})
const grundText = computed(() => {
  const g = abschluss.value?.grund
  if (!g) return ''
  return g === 'verworfen' ? w('wkr.geraet.verworfen') : w(`geraete.ablehnung.${g}` as MessageKey)
})

function schliesseAb(): void {
  if (nameFehlt.value || restFehlt.value) return
  const n = name.value.trim()
  const id = props.quelle.schliesseAb(props.liste, props.punkt, n, pruefung.value.offen.length > 0 && restPapier.value)
  if (id === null) return
  gesendet.value = id
  emit('name', n)
}

const stufeText = (z: PruefZeile) => (z.stufe ? `${stufeZeichen(z.stufe)} ${w(`wkr.geraet.stufe.${z.stufe.stufe}`)}` : `✓ ${w('wkr.geraet.stufe.uebernommen')}`)
const teilText = computed(() => (props.teil ? w(props.teil === 'ab' ? 'wkr.geraet.steg.ab' : 'wkr.geraet.steg.an') : ''))
</script>

<template>
  <section class="wkr-abschluss" data-teil="abschluss" :data-punkt="punkt">
    <h2>{{ w('wkr.geraet.abschluss.titel', { liste: listenTitel, punkt: punktTitel }) }}</h2>
    <p v-if="teil" class="wkr-hinweis" data-teil="abschluss-teil">{{ w('wkr.geraet.abschluss.teil', { teil: teilText }) }}</p>
    <p class="wkr-abschluss-summe" data-teil="summe">{{ summe }}</p>

    <p v-if="pruefung.zeilen.length === 0" class="wkr-hinweis" data-teil="abschluss-leer">{{ w('wkr.geraet.abschluss.leer', { punkt: punktTitel }) }}</p>
    <ul v-else class="wkr-pruef-liste" data-teil="pruef-liste">
      <li v-for="z in pruefung.zeilen" :key="z.s" class="wkr-pruef-zeile" data-teil="pruef-zeile" :data-start="z.s" :data-stufe="z.stufe?.stufe ?? 'uebernommen'" :data-x="z.x || undefined" :data-nv="z.nv || undefined">
        <button type="button" class="wkr-knopf wkr-pruef-knopf" data-ziel="klein" data-action="pruef-korrigieren" :disabled="!korrigierbar.has(z.s)" @click="emit('korrigiere', z.s)">
          <span class="wkr-zuletzt-nr" data-teil="nr">{{ z.sn ?? '?' }}</span>
          <span class="wkr-pruef-mitte">
            <span data-teil="klasse">{{ zeileText(z).klasse }}</span>
            <span data-teil="codes">{{ zeileText(z).codes }}</span>
          </span>
          <span class="wkr-pruef-rechts">
            <span v-if="zeileText(z).punkte !== null" data-teil="punkte">{{ w('wkr.geraet.punkte', { n: zeileText(z).punkte ?? 0 }) }}</span>
            <span data-teil="stufe">{{ stufeText(z) }}</span>
          </span>
        </button>
      </li>
    </ul>

    <!-- Ergebnis eines geschickten Abschlusses: unterwegs, angenommen, abgelehnt mit Grund. -->
    <p v-if="abschluss" class="wkr-band" :class="abschluss.stufe === 'abgelehnt' ? 'wkr-band--rot' : abschluss.stufe === 'unterwegs' ? 'wkr-band--hinweis' : ''" role="status" data-teil="abschluss-ergebnis" :data-stufe="abschluss.stufe" :data-grund="abschluss.grund">
      <template v-if="abschluss.stufe === 'unterwegs'">↑ {{ w('wkr.geraet.abschluss.unterwegs') }}</template>
      <template v-else-if="abschluss.stufe === 'angenommen'">{{ w('wkr.geraet.abschluss.angenommen', { punkt: punktTitel }) }}</template>
      <template v-else>✗ {{ w('wkr.geraet.abschluss.abgelehnt', { grund: grundText }) }}</template>
    </p>

    <template v-if="!abschluss || abschluss.stufe === 'abgelehnt'">
      <label class="wkr-feld">
        {{ w('wkr.geraet.abschluss.name') }}
        <input v-model="name" class="wkr-eingabe" data-feld="wkr-name" maxlength="60" autocomplete="name" />
      </label>
      <label v-if="pruefung.offen.length > 0" class="wkr-schalter" data-teil="rest-papier">
        <input v-model="restPapier" type="checkbox" data-feld="rest-papier" />
        <span>
          <b>{{ w('wkr.geraet.abschluss.rest') }}</b>
          <span class="wkr-hinweis">{{ w('wkr.geraet.abschluss.rest.hint') }}</span>
        </span>
      </label>
      <p v-if="restFehlt" class="wkr-band wkr-band--warn" role="alert" data-teil="rest-pflicht">{{ w('wkr.geraet.abschluss.restPflicht') }}</p>
      <p v-else-if="nameFehlt" class="wkr-band wkr-band--warn" role="alert" data-teil="name-pflicht">{{ w('wkr.geraet.abschluss.namePflicht') }}</p>
      <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="abschluss-senden" :disabled="nameFehlt || restFehlt" @click="schliesseAb">
        {{ w('wkr.geraet.abschluss') }}
      </button>
    </template>
    <button type="button" class="wkr-knopf" data-ziel="klein" data-action="abschluss-zurueck" @click="emit('zurueck')">{{ w('wkr.geraet.abschluss.zurueck') }}</button>
  </section>
</template>
