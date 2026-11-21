<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { t, type MessageKey } from '../../i18n'
import { hasParallel } from '../../config/catalog'
import { liesAnsicht, type Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import { oeffneUebung } from '../../geraete/uebung'
import { GERAET } from '../../geraete/paket'
import type { ListenTeil } from '../../wkr/liste'
import WkrGeraet from './WkrGeraet.vue'
import '../../styles/wkr-geraet.css'

/**
 * Übungsmodus der WKR-Maske (W3.4, Plan docs/plan-wkr-w3.md §5.9, G13, 21.11.2026; `#/uebung` in GeraetApp, ohne
 * Store): erst die Wahl Regelwerk (DM/UIM) × Liste (Steg, Steg nur Ablegen/Anlegen, Tor 5, Mann-über-Bord, Vorsteg),
 * dann DIESELBE Maske (WkrGeraet) mit dem Übungs-Kern geraete/uebung.ts oeffneUebung – erfundene Starts ohne Namen,
 * kein Transport, keine Ablage, kein Netz. Gemerkt wird nur die Ansicht (WkrGeraet; der WKR-Name des Abschlusses
 * nicht). Der Kopf sagt dauerhaft „ÜBUNG“: hier oben als Band, in der Maske im Kopf (WkrKopf, eigene Farbe + Wort).
 *
 * Die Wahl spricht die Sprache der Geräte-Oberfläche (t), die Maske danach die der Liste bzw. des Regelwerks (H5).
 *
 * Bojen-Listen (W4.2, Plan docs/plan-wkr-w4.md §5.3, P12, 21.11.2026): „Tor 1/3/5“ (gate135), „Tor 2/4/5“ (gate245),
 * „Parcours mit Start/Ziel“ (parcoursms), nur unter UIM „Parallelslalom, Racecourse A“ (parallelparcours) – dort nur
 * die Maske: Starts wie in jeder Übung (ohne Paar, ohne Attempt-Wechsel). Unter DM fehlt der Parallelslalom auch hier
 * (config/catalog.ts hasParallel); wer von UIM auf DM wechselt, landet wieder bei Tor 5.
 */
const props = defineProps<{
  /** Ablage der Ansicht (Tests: eigener Speicher); Vorgabe localStorage. */
  ablage?: Ablage | null
  /** Nur Tests: Takt neuer Starts. */
  taktMs?: number
  /** Der Bildschirm lässt sich nicht wach halten (GeraetApp) – die Maske sagt es oben (N7, 21.11.2026). */
  bildschirmKannAus?: boolean
}>()

/** Zurück zum Koppeln: die Adresse eines Geräts ohne Paket (geraete/paket.ts GERAET), nie fest im Text. */
const ZUM_KOPPELN = `#/${GERAET}`

type Wahl = 'steg' | 'steg-ab' | 'steg-an' | 'tor5' | 'mueb' | 'vorsteg' | 'gate135' | 'gate245' | 'parcoursms' | 'parallel'
const LISTEN: { wahl: Wahl; typeId: string; teil?: ListenTeil; text: MessageKey; nurParallel?: true }[] = [
  { wahl: 'steg', typeId: 'steg', text: 'wkr.geraet.uebung.steg' },
  { wahl: 'steg-ab', typeId: 'steg', teil: 'ab', text: 'wkr.geraet.uebung.stegAb' },
  { wahl: 'steg-an', typeId: 'steg', teil: 'an', text: 'wkr.geraet.uebung.stegAn' },
  { wahl: 'tor5', typeId: 'tor5', text: 'wkr.geraet.uebung.tor5' },
  { wahl: 'mueb', typeId: 'mueb', text: 'wkr.geraet.uebung.mueb' },
  { wahl: 'vorsteg', typeId: 'vorsteg', text: 'wkr.geraet.uebung.vorsteg' },
  { wahl: 'gate135', typeId: 'gate135', text: 'wkr.geraet.uebung.liste.gate135' },
  { wahl: 'gate245', typeId: 'gate245', text: 'wkr.geraet.uebung.liste.gate245' },
  { wahl: 'parcoursms', typeId: 'parcoursms', text: 'wkr.geraet.uebung.liste.parcoursms' },
  { wahl: 'parallel', typeId: 'parallelparcours', text: 'wkr.geraet.uebung.liste.parallel', nurParallel: true },
]
const REGELWERKE = [
  { id: 'dm-2026', text: 'dm' },
  { id: 'uim-2026', text: 'uim' },
] as const

/** Die Wahl in der Ansicht des Geräts (Sonne als Vorgabe, G1) – gelesen beim Öffnen. */
const modus = liesAnsicht(props.ablage === undefined ? undefined : props.ablage).modus
const regelwerk = ref<(typeof REGELWERKE)[number]['id']>('dm-2026')
const wahl = ref<Wahl>('tor5')
const quelle = shallowRef<ErfassungsQuelle | null>(null)
const listen = computed(() => LISTEN.filter((l) => !l.nurParallel || hasParallel(regelwerk.value)))
const gewaehlt = computed(() => listen.value.find((l) => l.wahl === wahl.value) ?? LISTEN.find((l) => l.wahl === 'tor5')!)
function waehleRegelwerk(id: (typeof REGELWERKE)[number]['id']): void {
  regelwerk.value = id
  if (!listen.value.some((l) => l.wahl === wahl.value)) wahl.value = 'tor5'
}

function starte(): void {
  quelle.value?.stop()
  const l = gewaehlt.value
  quelle.value = oeffneUebung({ regelwerk: regelwerk.value, typeId: l.typeId, ...(l.teil ? { teil: l.teil } : {}), ...(props.taktMs ? { taktMs: props.taktMs } : {}) })
}
function ende(): void {
  quelle.value?.stop()
  quelle.value = null
}
onBeforeUnmount(ende)
</script>

<template>
  <WkrGeraet v-if="quelle" :quelle="quelle" :ablage="ablage" :bildschirm-kann-aus="bildschirmKannAus" @uebung-ende="ende" />
  <div v-else class="wkr-geraet wkr-uebung-wahl" data-teil="uebung-wahl" :data-modus="modus" data-uebung="true">
    <p class="wkr-uebung wkr-uebung--band" data-teil="uebung">{{ t('wkr.geraet.uebung') }}</p>
    <h1>{{ t('wkr.geraet.uebung.titel') }}</h1>
    <p class="wkr-hinweis">{{ t('wkr.geraet.uebung.hint') }}</p>
    <fieldset class="wkr-feldgruppe">
      <legend>{{ t('wkr.geraet.uebung.regelwerk') }}</legend>
      <div class="wkr-reihe">
        <button
          v-for="r in REGELWERKE"
          :key="r.id"
          type="button"
          class="wkr-knopf"
          data-ziel="klein"
          data-action="uebung-regelwerk"
          :data-regelwerk="r.id"
          :aria-pressed="regelwerk === r.id"
          @click="waehleRegelwerk(r.id)"
        >
          {{ t(`wkr.geraet.uebung.${r.text}`) }}
        </button>
      </div>
    </fieldset>
    <fieldset class="wkr-feldgruppe">
      <legend>{{ t('wkr.geraet.uebung.liste') }}</legend>
      <div class="wkr-uebung-listen">
        <button
          v-for="l in listen"
          :key="l.wahl"
          type="button"
          class="wkr-knopf"
          data-ziel="klein"
          data-action="uebung-liste"
          :data-liste="l.wahl"
          :aria-pressed="wahl === l.wahl"
          @click="wahl = l.wahl"
        >
          {{ t(l.text) }}
        </button>
      </div>
    </fieldset>
    <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="uebung-start" @click="starte">{{ t('wkr.geraet.uebung.start') }}</button>
    <!-- Ein Verweis ist auch eine Tippfläche: wie ein Knopf ≥ 48 px (Prüfbefund W3, styles/wkr-geraet.test.ts). -->
    <a class="wkr-knopf" data-ziel="klein" :href="ZUM_KOPPELN" data-action="zum-koppeln">{{ t('wkr.geraet.uebung.koppeln') }}</a>
  </div>
</template>
