<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'
import './styles/anzeige.css'
import './styles/zuschauer.css'
import './styles/geraet.css'
import { oeffneLeseLink, type FassungsLage, type LeseGeraet, type LeseUmgebung } from './geraete/geraet'
import { verbindungsLage, type Fehlercode } from './geraete/transport/typen'
import { SEHEN } from './geraete/paket'
import { vollbild } from './lib/router'
import { holeNeueFassung } from './lib/offline'
import { useTafelFenster } from './lib/tafelFenster'
import { useUhr } from './lib/uhr'
import { useWachBleiben } from './lib/wachBleiben'
import { t, tIn } from './i18n'
import { fingerabdruckText } from './components/betrieb/texte'
import AnzeigeTafel from './components/anzeige/AnzeigeTafel.vue'
import ZuschauerListe from './components/zuschauer/ZuschauerListe.vue'
import GeraeteLage from './components/betrieb/GeraeteLage.vue'
import AppDialog from './components/AppDialog.vue'
import GeraetFreigabe from './components/betrieb/GeraetFreigabe.vue'
import WkrUebung from './components/wkr/WkrUebung.vue'

/**
 * Eigene Wurzel für ein fremdes Gerät mit Lese-Link (`#/sehen/<paket>`, Etappe E6, Plan vom 16.11.2026 §4; src/main.ts
 * wählt sie vor jedem Store). Ohne Store, ohne Kopf, Handscanner und Bedienung: Das Gerät kennt nur, was der
 * Bedienrechner ihm als Sicht schickt (geraete/geraet.ts), und zeigt sie mit DENSELBEN Komponenten wie am
 * Bedienrechner – der Anzeigetafel-Link die Anzeigetafel (AnzeigeTafel), der Zuschauer-Link die Zuschauerliste
 * (ZuschauerListe, `jetzt` = Uhr des Hosts: eigene Uhr plus Versatz).
 *
 * Dazu, was ein Gerät ohne Bedienrechner braucht: die Verbindung (nur sichtbar, wenn sie nicht steht – die Tafel hängt
 * vor Publikum), den Fingerabdruck zum Vergleichen, „Raum verlassen“ und die Meldungen für einen kaputten Link, einen
 * beendeten Raum und verschiedene Fassungen (F7: ist der Bedienrechner älter, „Bedienrechner aktualisieren“; ist er
 * neuer, lädt das Gerät gezielt die neue Fassung – sonst nie von selbst).
 *
 * E7 (20.11.2026): Koppel-Link `#/koppeln/<paket>` und gekoppeltes Gerät `#/geraet` zeigen statt dessen die
 * Start-Freigabe (components/betrieb/GeraetFreigabe.vue) – dieselbe Wurzel, ohne Store; dort wird der Koppel-Link
 * sofort durch `#/geraet` ersetzt (QR-Token nicht in Verlauf und Lesezeichen).
 *
 * W3.4 (21.11.2026, G13): `#/uebung` zeigt die Übung der WKR-Maske (components/wkr/WkrUebung.vue) – ohne Store, ohne
 * Kopplung, ohne Netz (geraete/uebung.ts); ein Lese- oder Koppel-Gerät ruht dabei (gestoppt wie beim Wechsel).
 *
 * Das Paket des Lese-Links bleibt in der Adresse (Abweichung von Plan §4, beim Bau von E6 am 16.11.2026 – vom Nutzer zu bestätigen):
 * Lesezeichen und Neuladen brauchen es, und geraet.ts legt den Link-Text nicht ab. Nach „Raum verlassen“ steht nur
 * noch `#/sehen` da.
 */
const props = defineProps<{
  /** Nur Tests: Speicher, Zeiten, Uhr, `aktualisiere` (geraete/geraet.ts LeseUmgebung). */
  umgebung?: LeseUmgebung
}>()

type Lage =
  /** Kein Paket in der Adresse. */
  | { art: 'ohne' }
  /** Eben „Raum verlassen“. */
  | { art: 'verlassen' }
  | { art: 'ungueltig' }
  | { art: 'fassung'; lage: FassungsLage }
  | { art: 'geraet'; geraet: LeseGeraet }

const lage = shallowRef<Lage>({ art: 'ohne' })
/** E7: Koppel-Link oder gekoppeltes Gerät – dann führt GeraetFreigabe, die Lese-Teile hier ruhen. */
const freigabe = ref<{ paket?: string } | null>(null)
/** W3.4: Übung der WKR-Maske. */
const uebung = ref(false)
/** Das Paket, das gerade gilt – eine Adresse mit demselben (auch nach dem eigenen `location.replace`) ändert nichts. */
let paket: string | undefined

/** Der Host spricht eine neuere Fassung (geraet.ts ruft das höchstens einmal je Fassung in 10 min). */
function aktualisiere(): void {
  if (props.umgebung?.aktualisiere) {
    props.umgebung.aktualisiere()
    return
  }
  // Mit Offline-Speicher: suchen, laden, übernehmen; ohne (Datei, privates Fenster): neu laden holt das Neueste.
  void holeNeueFassung().then((ok) => {
    if (!ok) location.reload()
  })
}

function oeffne(text: string | undefined, verlassen = false): void {
  if (lage.value.art === 'geraet') lage.value.geraet.stop()
  paket = text
  if (!text) {
    lage.value = { art: verlassen ? 'verlassen' : 'ohne' }
    return
  }
  const r = oeffneLeseLink(text, { ...props.umgebung, aktualisiere })
  if (!r.ok) {
    lage.value = r.code === 'fassung' ? { art: 'fassung', lage: r.lage } : { art: 'ungueltig' }
    return
  }
  lage.value = { art: 'geraet', geraet: r.geraet }
  void r.geraet.start()
}

const geraet = computed(() => (lage.value.art === 'geraet' ? lage.value.geraet : null))
const art = computed(() => geraet.value?.art ?? null)
const tafel = computed(() => (geraet.value && !geraet.value.beendet.value ? geraet.value.anzeige.value : null))
const liste = computed(() => (geraet.value && !geraet.value.beendet.value ? geraet.value.zuschauer.value : null))

const verbindung = computed(() => (geraet.value ? verbindungsLage(geraet.value.status.value, geraet.value.fehler.value) : 'aus'))
/** Ein Fehler, den die Lage nicht schon sagt. `fassung` sagt die eigene Meldung (F7) deutlicher. */
const fehler = computed<Fehlercode | null>(() => {
  const code = geraet.value?.fehler.value?.code ?? null
  return code === 'verbindung-gestoert' || code === 'zu-viele-anfragen' || code === 'fassung' ? null : code
})
const fassung = computed<FassungsLage | null>(() => (lage.value.art === 'fassung' ? lage.value.lage : (geraet.value?.fassung.value ?? null)))
/** Etwas stimmt nicht – dann steht die Leiste unten immer da, auch über der Tafel. */
const stoerung = computed(() => !!geraet.value && !geraet.value.beendet.value && (verbindung.value !== 'verbunden' || !!fehler.value || !!fassung.value))

// Die Zuschauerliste rechnet „ca. in“ mit der Uhr des Hosts (Versatz aus `hz`, BETRIEB_ANNAHMEN.uhrversatzFrisch).
const uhr = useUhr(5000)
const hostJetzt = computed(() => geraet.value?.hostZeit(uhr.value) ?? uhr.value)

// Vollbild (F, Doppelklick) und Mauszeiger wie im zweiten Fenster; die Leiste unten erscheint mit dem Zeiger.
const { zeigerWeg, vollbildUmschalten, regung } = useTafelFenster()

// Bildschirm wach halten (E8, 20.11.2026), solange ein Lese-Link läuft oder die Start-Freigabe offen ist – nicht mehr
// nach „Raum beendet“/„Raum verlassen“. Geht das nicht (altes iPhone, Energiesparen), sagt es die Leiste leise.
const wach = useWachBleiben(() => uebung.value || !!freigabe.value || (!!geraet.value && !geraet.value.beendet.value))
const bildschirmKannAus = computed(() => wach.value === 'nicht-moeglich')

// Fenster nach Art: schwarz für die Anzeigetafel (kein weißer Blitz), sonst wie die Zuschauerliste.
watchEffect(() => {
  const html = document.documentElement
  html.classList.toggle('anzeige-fenster', art.value === 'anzeige')
  html.classList.toggle('zuschauer-fenster', art.value === 'zuschauer')
  html.classList.add('geraet-fenster')
  html.classList.toggle('freigabe-fenster', !!freigabe.value || uebung.value)
})
watchEffect(() => {
  // Den Titel der Start-Freigabe setzt GeraetFreigabe selbst.
  if (freigabe.value) return
  if (uebung.value) {
    document.title = t('wkr.geraet.uebung.titel')
    return
  }
  const s = tafel.value ?? liste.value
  const titel = s ? tIn(s.sprache, art.value === 'anzeige' ? 'anzeige.titel' : 'zuschauer.titel') : t('geraete.sehen.titel')
  document.title = [titel, s?.kopf].filter(Boolean).join(' – ')
  // Sprache von Tafel bzw. Liste (Vorlesen, Silbentrennung); ohne Sicht bleibt die der Seite.
  if (s) document.documentElement.lang = s.sprache
})

const frageVerlassen = ref(false)
function verlasse(): void {
  frageVerlassen.value = false
  geraet.value?.verlasse()
  oeffne(undefined, true)
  // Ohne Paket: Ein Neuladen oder Lesezeichen öffnet den Raum nicht wieder. Gleiche Wurzel – main.ts lädt nicht neu.
  location.replace(`#/${SEHEN}`)
}

function beiAdresse(): void {
  const v = vollbild()
  uebung.value = v?.art === 'uebung'
  if (uebung.value) {
    if (lage.value.art === 'geraet') lage.value.geraet.stop()
    lage.value = { art: 'ohne' }
    paket = undefined
    freigabe.value = null
    return
  }
  if (v?.art === 'koppeln' || v?.art === 'geraet') {
    if (lage.value.art === 'geraet') lage.value.geraet.stop()
    lage.value = { art: 'ohne' }
    paket = undefined
    // `#/geraet` nach dem eigenen Ersetzen: GeraetFreigabe behält ihr Gerät (sie öffnet nur ein neues Paket).
    freigabe.value = v.art === 'koppeln' ? { paket: v.bereich } : { paket: freigabe.value?.paket }
    return
  }
  freigabe.value = null
  const neu = v?.bereich
  if (neu !== paket) oeffne(neu)
}

onMounted(() => {
  window.addEventListener('hashchange', beiAdresse)
  beiAdresse()
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', beiAdresse)
  if (lage.value.art === 'geraet') lage.value.geraet.stop()
  document.documentElement.classList.remove('anzeige-fenster', 'zuschauer-fenster', 'geraet-fenster', 'freigabe-fenster')
})
</script>

<template>
  <WkrUebung v-if="uebung" :ablage="umgebung?.ablage" :bildschirm-kann-aus="bildschirmKannAus" />
  <GeraetFreigabe v-else-if="freigabe" :paket="freigabe.paket" :umgebung="umgebung" :aktualisiere="aktualisiere" :bildschirm-kann-aus="bildschirmKannAus" />
  <div v-else class="geraet-app" :data-art="art ?? lage.art" @dblclick="art === 'anzeige' && vollbildUmschalten()">
    <!-- Die Anzeigetafel wie im zweiten Fenster, ohne Logos (BETRIEB_ANNAHMEN.logosNurLokal). -->
    <div v-if="art === 'anzeige' && tafel" class="anzeige-app" :class="{ 'zeiger-weg': zeigerWeg }">
      <AnzeigeTafel :sicht="tafel" />
    </div>
    <main v-else-if="art === 'zuschauer' && liste" class="zuschauer-app">
      <h1 class="zuschauer-kopf">{{ liste.kopf || tIn(liste.sprache, 'zuschauer.titel') }}</h1>
      <ZuschauerListe :sicht="liste" :jetzt="hostJetzt" />
    </main>

    <!-- Was statt der Sicht dasteht: warten, beendet, verlassen, kein oder kaputter Link, andere Fassung. -->
    <section v-else class="geraet-meldung" role="status" :data-meldung="geraet?.beendet.value ? 'beendet' : geraet ? 'warte' : lage.art">
      <template v-if="geraet?.beendet.value">
        <h1>{{ t('geraete.sehen.beendet') }}</h1>
      </template>
      <template v-else-if="geraet">
        <h1>{{ t('geraete.sehen.warte') }}</h1>
        <p>{{ t('geraete.sehen.warte.hint') }}</p>
      </template>
      <template v-else-if="lage.art === 'verlassen'">
        <h1>{{ t('geraete.sehen.verlassen.fertig') }}</h1>
        <p>{{ t('geraete.sehen.keinLink.hint') }}</p>
      </template>
      <template v-else-if="lage.art === 'ungueltig'">
        <h1>{{ t('geraete.fehler.link-ungueltig') }}</h1>
      </template>
      <template v-else-if="lage.art === 'fassung'">
        <h1>{{ t(lage.lage === 'host-neuer' ? 'geraete.sehen.hostNeuer' : 'geraete.sehen.hostAelter') }}</h1>
        <p v-if="lage.lage === 'host-neuer'">
          <button type="button" class="btn" data-action="neu-laden" @click="aktualisiere">{{ t('geraete.sehen.neuLaden') }}</button>
        </p>
      </template>
      <template v-else>
        <h1>{{ t('geraete.sehen.keinLink') }}</h1>
        <p>{{ t('geraete.sehen.keinLink.hint') }}</p>
      </template>
    </section>

    <!-- Leiste unten: Verbindung, Fingerabdruck, Vollbild, „Raum verlassen“. Über der Tafel nur mit dem Mauszeiger (oder
         einer Berührung) und immer, wenn etwas nicht stimmt; unter der Zuschauerliste immer. -->
    <footer
      v-if="geraet && !geraet.beendet.value"
      class="geraet-leiste"
      :class="{ schwebend: art === 'anzeige' && !!tafel, verborgen: art === 'anzeige' && !!tafel && zeigerWeg && !stoerung }"
      data-teil="leiste"
      @pointerdown="regung"
    >
      <span data-teil="verbindung" :data-lage="verbindung"><GeraeteLage :lage="verbindung" /></span>
      <span v-if="fehler" class="geraet-hinweis" data-teil="fehler" :data-fehler="fehler">{{ t(`geraete.fehler.${fehler}`) }}</span>
      <span v-if="fassung" class="geraet-hinweis" data-teil="fassung" :data-fassung="fassung">
        {{ t(fassung === 'host-neuer' ? 'geraete.sehen.hostNeuer' : 'geraete.sehen.hostAelter') }}
        <button v-if="fassung === 'host-neuer'" type="button" class="btn sm" data-action="neu-laden" @click="aktualisiere">{{ t('geraete.sehen.neuLaden') }}</button>
      </span>
      <span v-if="bildschirmKannAus" class="note" data-teil="wach">{{ t('geraete.sehen.bildschirmKannAus') }}</span>
      <span class="geraet-fingerabdruck" data-teil="fingerabdruck">{{ t('geraete.sehen.fingerabdruck', { f: fingerabdruckText(geraet.fingerabdruck) }) }}</span>
      <span class="geraet-knoepfe">
        <button v-if="art === 'anzeige'" type="button" class="btn sm" data-action="vollbild" @click="vollbildUmschalten">{{ t('geraete.sehen.vollbild') }}</button>
        <button type="button" class="btn sm" data-action="raum-verlassen" @click="frageVerlassen = true">{{ t('geraete.sehen.verlassen') }}</button>
      </span>
    </footer>

    <AppDialog v-if="frageVerlassen" :titel="t('geraete.sehen.verlassen.frage')" data-dialog="raum-verlassen" @abbrechen="frageVerlassen = false">
      <p>{{ t('geraete.sehen.verlassen.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="verlassen-ja" @click="verlasse">{{ t('geraete.sehen.verlassen.ja') }}</button>
        <button type="button" class="btn" data-action="verlassen-nein" autofocus @click="frageVerlassen = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
