<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../i18n'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import { liesAnsicht, merkeProbe, probeErledigt, schreibeAnsicht, type Ablage, type GeraetAnsicht, type RaumBezug } from '../../geraete/ablage'
import { probeMaske } from '../../wkr/maske'
import WkrMaske from './WkrMaske.vue'
import WkrProbe from './WkrProbe.vue'
import WkrRuhe from './WkrRuhe.vue'
import { stelleWkrText } from './texte'
import { wachHinweisWeg } from './gedaechtnis'
import '../../styles/wkr-geraet.css'

/**
 * Wurzel der WKR-Maske auf einem Gerät (W3.3, Plan docs/plan-wkr-w3.md §5, 21.11.2026). Ohne Store: Die Quelle ist
 * die echte Erfassung (geraete/erfassen.ts, über GeraetFreigabe) oder die Übung ohne Netz (geraete/uebung.ts) –
 * beide mit derselben Schnittstelle. Je eigener Liste ein Reiter (Pad mit zwei Listen, F15); GeraetFreigabe kann
 * eine Liste vorgeben (`nurListe`, dann ohne eigene Reiter).
 *
 * Ansicht aus der Geräteablage (ablage.ts `alcatraz.geraet.ansicht`): Sonnenmodus als Vorgabe (G1), Hand, Sprache.
 * Die Sprache der Maske ist die der Liste (F13, G9: zweisprachig → deutsch), umgeschaltet über die Ansicht – nie die
 * der Geräte-Oberfläche. Farben nur über --wkr-* (styles/wkr-geraet.css), unabhängig von prefers-color-scheme.
 *
 * W3.4 (21.11.2026): „Mehr → Ansicht/Sprache“ schreibt hier die Ansicht (schreibeAnsicht; nimmt der Speicher sie nicht,
 * gilt sie bis zum Neuladen). Der WKR-Name des Abschlusses wird gemerkt (G12) – in der Übung nicht (dort bleibt nur
 * die Ansicht, G13). Probe (G10): nach dem ersten Erhalt der Sicht einer Liste einmal je Raum und Liste (ablage.ts
 * `probe`; nur mit `raum`, also nie in der Übung von selbst), jederzeit über „Mehr → Probe“; sie ersetzt die Maske,
 * bis sie fertig oder übersprungen ist, und schickt nichts.
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  /** Ablage der Ansicht (Tests: eigener Speicher); Vorgabe localStorage. */
  ablage?: Ablage | null
  /** Nur diese Liste zeigen (GeraetFreigabe mit eigenen Reitern). */
  nurListe?: string
  /** Meldung der Start-Freigabe für den Bereich einer Liste (öffentliche Sicht). */
  meldungFuer?: (liste: string) => string | null
  /** Raum des gekoppelten Geräts – für die Probe einmal je Raum und Liste (G10). Ohne (Übung): keine Probe von selbst. */
  raum?: RaumBezug | null
  /**
   * Der Bildschirm lässt sich nicht wach halten (GeraetApp, lib/wachBleiben.ts) – N7 vom Feldtest 21.11.2026: Über
   * http://192.168…:5173 gibt es keine Wake Lock, das Handy sperrte mitten in der Erfassung. Gut sichtbar oben.
   */
  bildschirmKannAus?: boolean
}>()
const emit = defineEmits<{ uebungEnde: [] }>()

/** Ablage wie übergeben; `undefined` = Vorgabe (localStorage), `null` = keine. */
const ablage = () => (props.ablage === undefined ? undefined : props.ablage)
const ansicht = ref(liesAnsicht(ablage()))
function setzeAnsicht(aenderung: Partial<GeraetAnsicht>): void {
  schreibeAnsicht(aenderung, ablage())
  const neu: GeraetAnsicht = { ...ansicht.value }
  for (const [k, v] of Object.entries(aenderung) as [keyof GeraetAnsicht, unknown][]) {
    if (v === undefined) delete neu[k]
    else (neu as unknown as Record<string, unknown>)[k] = v
  }
  ansicht.value = neu
}
function merkeName(name: string): void {
  if (!props.quelle.uebung) setzeAnsicht({ name })
}
const listen = computed(() => props.quelle.listen.value)
const reiter = ref<string | null>(null)
const aktiv = computed(() => {
  const gesucht = props.nurListe ?? reiter.value
  return listen.value.find((a) => a.liste === gesucht) ?? (props.nurListe ? null : (listen.value[0] ?? null))
})
const sicht = computed(() => (aktiv.value ? (props.quelle.sichten.value[aktiv.value.liste] ?? null) : null))

const sprache = computed<Locale>(() => ansicht.value.sprache ?? (sicht.value?.sprache === 'en' ? 'en' : 'de'))
const spracheWahl = computed(() => (ansicht.value.sprache && sicht.value?.andere?.sprache === ansicht.value.sprache ? 'andere' : 'liste'))
const { w } = stelleWkrText(sprache)

const titelVon = (liste: string) => props.quelle.sichten.value[liste]?.titel ?? '…'

// --- Probe (G10) ---
// Bojen-Listen haben seit W4.2 (21.11.2026) ihre eigenen Probe-Schritte (WkrProbe, P11).
const probeAufbau = computed(() => (sicht.value ? probeMaske(sicht.value, spracheWahl.value) : null))
/** Liste, deren Probe gerade läuft. */
const probe = ref<string | null>(null)
watch(
  [() => aktiv.value?.liste, () => !!sicht.value, () => !!probeAufbau.value],
  ([l, mitSicht, mitMaske]) => {
    const r = props.raum
    if (!l || !mitSicht || !mitMaske || !r || props.quelle.entzogen.value) return
    if (!probeErledigt(r, l, ablage())) probe.value = l
  },
  { immediate: true },
)
function probeFertig(): void {
  const l = probe.value
  probe.value = null
  if (l && props.raum) merkeProbe(props.raum, l, ablage())
}
// --- Bildschirm kann ausgehen (N7): „Ausblenden“ gilt bis zum Neuladen, auch über den Neuaufbau (Reiterwechsel). ---
const wachWeg = ref(wachHinweisWeg.weg)
function blendeWachAus(): void {
  wachWeg.value = wachHinweisWeg.weg = true
}
/** Ohne https (http im WLAN) hat der Browser gar keine Sperre – dann sagt der Satz auch warum. */
const ohneHttps = typeof window !== 'undefined' && window.isSecureContext === false

const probeTeil = computed(() => (sicht.value?.teile ? (aktiv.value?.teil ?? 'ab') : undefined))
</script>

<template>
  <div class="wkr-geraet" data-teil="wkr-geraet" :data-modus="ansicht.modus" :data-hand="ansicht.hand" :data-uebung="quelle.uebung || undefined" :lang="sprache">
    <p v-if="bildschirmKannAus && !wachWeg" class="wkr-band wkr-band--warn" role="status" data-teil="wach-hinweis">
      <span>
        <b>{{ w('wkr.geraet.wach.titel') }}</b>
        {{ w(ohneHttps ? 'wkr.geraet.wach.ohneHttps' : 'wkr.geraet.wach.tipp') }}
      </span>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="wach-ausblenden" @click="blendeWachAus">{{ w('wkr.geraet.wach.ausblenden') }}</button>
    </p>
    <WkrRuhe v-if="quelle.entzogen.value" art="entzogen" :entwuerfe="quelle.entwuerfe.value" />
    <WkrRuhe v-else-if="!aktiv" art="keine-liste" />
    <WkrProbe v-else-if="probe === aktiv.liste && probeAufbau" :key="`probe|${aktiv.liste}`" :aufbau="probeAufbau" :teil="probeTeil" :hand="ansicht.hand" :uebung="quelle.uebung" @fertig="probeFertig" />
    <WkrMaske
      v-else
      :key="aktiv.liste"
      :quelle="quelle"
      :aufgabe="aktiv"
      :sprache-wahl="spracheWahl"
      :hand="ansicht.hand"
      :modus="ansicht.modus"
      :name="ansicht.name ?? ''"
      :meldung="meldungFuer?.(aktiv.liste) ?? null"
      @ansicht="setzeAnsicht"
      @name="merkeName"
      @probe="probe = probeAufbau ? aktiv.liste : null"
      @uebung-ende="emit('uebungEnde')"
    />
    <nav v-if="!nurListe && !quelle.entzogen.value && listen.length > 1" class="wkr-listenreiter" role="tablist" :aria-label="w('wkr.geraet.listen')" data-teil="listen-reiter">
      <button
        v-for="a in listen"
        :key="a.liste"
        type="button"
        role="tab"
        class="wkr-knopf"
        data-ziel="klein"
        data-action="liste-reiter"
        :data-liste="a.liste"
        :aria-selected="a.liste === aktiv?.liste"
        @click="reiter = a.liste"
      >
        {{ titelVon(a.liste) }}
      </button>
    </nav>
  </div>
</template>
