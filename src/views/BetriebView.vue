<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { ClassId } from '../types'
import { useStore } from '../state/store'
import { merke } from '../lib/merken'
import { adresse, useReiter } from '../lib/router'
import { oeffneAnzeige, oeffneZuschauer } from '../lib/anzeigeFenster'
import { useUhr } from '../lib/uhr'
import { useKonfig } from '../lib/konfig'
import { erfassungsLage } from '../wkr/lage'
import { sichtFreigabe, type FreigabeErfassung } from '../wkr/freigabe'
import { parcoursAmpel } from '../wkr/ampel'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { geraetAngaben } from '../geraete/register'
import { CLASS_IDS } from '../domain/classes'
import { sichtOeffentlich } from '../betrieb/sicht'
import { mmss } from '../betrieb/prognose'
import { t } from '../i18n'
import AppDialog from '../components/AppDialog.vue'
import StartFreigabe from '../components/betrieb/StartFreigabe.vue'
import StartListe from '../components/betrieb/StartListe.vue'
import GeraeteRaum from '../components/betrieb/GeraeteRaum.vue'
import GeraeteLage from '../components/betrieb/GeraeteLage.vue'
import WkrMatrix from '../components/betrieb/WkrMatrix.vue'
import WkrEingang from '../components/betrieb/WkrEingang.vue'
import { useGeraeteHost } from '../geraete/host'
import { verbindungsLage } from '../geraete/transport/typen'

/**
 * Reiter „Betrieb“ am Wettkampftag (Plan vom 16.11.2026): Unterreiter `start` – die Start-Freigabe je Parcours (E1,
 * mit der Steuerung der Etappe E2) –, `startliste` – die ganze Folge mit Wartezeiten (E3) – und `geraete` – der
 * Gerätebetrieb mit Lese-Links für Anzeigetafel und Zuschauer (E6, components/betrieb/GeraeteRaum.vue) – und `wkr`
 * (W2.2, 21.11.2026): die digitale Erfassung der Wettkampfrichter am Bedienrechner (Matrix Listen × Starts,
 * Bedienung je Liste, Eingang mit Rückfragen und Vorschlägen; components/betrieb/WkrMatrix.vue, WkrEingang.vue). Dazu die
 * Knöpfe, die Anzeigetafel und Zuschauerliste in eigenen Fenstern öffnen. Einstellungen (Anzeigetafel, Startfolge,
 * Startabstände, Server der Geräte) stehen unter „Einstellungen“, nicht hier – verlinkt. Ist ein Raum offen, steht
 * dessen Verbindung auch auf den anderen Unterreitern im Kopf: Wer die Start-Freigabe bedient, soll sehen, wenn die
 * Geräte nichts mehr bekommen.
 *
 * Die Karten lesen nur die öffentliche Sicht (betrieb/sicht.ts) – dieselben Komponenten bedienen später
 * vom Handy aus. Ohne festgeschriebene Verzahnung gibt es keine Bedienung, nur den Weg dorthin – außer es
 * ist schon Betrieb da (Verzahnung mitten am Tag gelöst): Dann bleiben die Karten mit den Knöpfen, die
 * keine Folge brauchen (Zurück, Meldung); Zeigen, Beginnen und alle Schritte der Folge ruhen.
 *
 * Die Uhr der Startliste (lib/uhr.ts) tickt hier, nicht im Store: Gelesen wird sie nur im Zweig der Startliste,
 * die Start-Freigabe zeichnet sie deshalb nicht neu.
 */
const { state, dispatch } = useStore()

const REITER = ['start', 'startliste', 'wkr', 'geraete'] as const
const HINWEIS = { start: 'betrieb.hint', startliste: 'betrieb.liste.hint', wkr: 'betrieb.wkr.hint', geraete: 'betrieb.geraete.hint' } as const
const reiter = merke<(typeof REITER)[number]>('betrieb.reiter', 'start')
// Ein Querverweis kann den Bereich der WKR-Matrix mitgeben (`#/betrieb/wkr/<parcours>`, Scheibe 4: Klick auf die
// Geräteleiste der Start-Freigabe); gemerkt wird er wie die Wahl in der Matrix (lib/merken.ts).
const wkrBereich = merke('betrieb.wkr.bereich', '')
// W3.2: `#/betrieb/geraete/<liste>` (Verweis „Gerät koppeln“ der Matrix) wählt die Liste fürs nächste Gerät vor –
// derselbe Merker wie in GeraeteKoppeln.vue; ob es die Liste gibt, prüft die Wahl dort. Teil wieder „ganz“.
const koppelnListe = merke('geraete.koppeln.liste', '')
const koppelnTeil = merke('geraete.koppeln.teil', '')
useReiter('betrieb', reiter, REITER, undefined, (r, wahl) => {
  if (r === 'wkr') wkrBereich.value = wahl
  if (r === 'geraete') {
    koppelnListe.value = wahl
    koppelnTeil.value = ''
  }
})

/** Offene Rückfragen der WKR-Geräte – im Kopf jedes Unterreiters, damit sie niemand übersieht (Plan W2 §6.1). */
const wkrRueckfragen = computed(() => state.value.wkr.rueckfragen.length)
function zumEingang() {
  document.querySelector('[data-teil="wkr-eingang"]')?.scrollIntoView?.({ block: 'start' })
}

// Ohne Logos: Die Bedienung braucht sie nicht, und so trägt die Sicht hier keine Bilder. Mit `gefahren` (R11-11,
// 26.11.2026): die gezeigten Starts als Wahl für „Wiederholung (Ausfall)“ – nur hier, nie auf der Leitung.
const sicht = computed(() => sichtOeffentlich(state.value, { logos: false, gefahren: true }))
const fest = computed(() => sicht.value.bereiche.some((b) => b.fest))
const hatBetrieb = computed(() => Object.keys(state.value.betrieb.bereiche).length > 0)
const jetzt = useUhr(1000)

/** Die Startabstände, mit denen die Startliste rechnet – je Klasse der Sicht, in der Folge der Klassen. */
const abstaende = computed(() =>
  CLASS_IDS.filter((k: ClassId) => sicht.value.abstaende[k] !== undefined && sicht.value.klassen[k]).map((k) => ({
    klasse: k,
    name: sicht.value.klassen[k]!.name,
    farbe: sicht.value.klassen[k]!.farbe,
    zeit: mmss(sicht.value.abstaende[k]!),
  })),
)

// Gerätebetrieb (E6): `null` in Tests ohne Host – dann gibt es auch keine Anzeige der Verbindung im Kopf.
const geraete = useGeraeteHost()
const geraeteLage = computed(() => {
  if (!geraete?.raum.value) return null
  const m = geraete.verbindung.value
  return m ? verbindungsLage(m.status, m.fehler) : 'verbinde'
})

/**
 * W2.4 (Plan W2 §6.3): der Stand der WKR-Erfassung je Bereich für die Start-Freigabe (Geräteleiste, Rückstand,
 * Nachfrage) – dieselbe Form wie auf dem Freigabe-Handy (wkr/freigabe.ts). Nur, solange irgendeine Liste einen Eintrag
 * hat; Uhr im Takt der Freigabe-Sicht (die Ampel altert), getrennt von der Sekunden-Uhr der Startliste. Weitergereicht
 * wird nur bei geändertem Inhalt – sonst zeichnete die Uhr die Karten alle paar Sekunden neu.
 */
const konfig = useKonfig({ oberflaeche: true })
const wkrJetzt = useUhr(WKR_ANNAHMEN.freigabeTaktSek * 1000)
const erfassung = shallowRef<Record<string, FreigabeErfassung>>({})
let erfassungText = ''
watch(
  () => {
    if (reiter.value !== 'start' || Object.keys(state.value.wkr.listen).length === 0) return {}
    const angaben = geraetAngaben(geraete?.raum.value?.geraete ?? [])
    // Auto-Modus (AM6): Den Countdown kennt nur das Führungsfenster (geraete/host.ts `auto`) – hier als Sekunden beim
    // Rechnen; die Start-Freigabe zählt selbst herunter.
    const auto = geraete?.auto?.value ?? {}
    const aus: Record<string, FreigabeErfassung> = {}
    for (const b of sicht.value.bereiche) {
      try {
        const listen = erfassungsLage(state.value, konfig.value, b.id, angaben, wkrJetzt.value).listen
        const a = auto[b.id]
        const autoIn = a ? Math.max(0, (a.bis - Date.now()) / 1000) : null
        aus[b.id] = sichtFreigabe(b.id, listen, state.value.anzeige.wkrWarnung, parcoursAmpel(state.value, konfig.value, b.id, listen), autoIn)
      } catch {
        // Ein Bereich ohne Listen (etwa mitten im Umbau): keine Leiste – die Freigabe selbst geht weiter.
      }
    }
    return aus
  },
  (aus) => {
    const text = JSON.stringify(aus)
    if (text === erfassungText) return
    erfassungText = text
    erfassung.value = aus
  },
  { immediate: true },
)
/** Klick auf die Geräteleiste: Unterreiter WKR mit diesem Bereich (wie der Querverweis `#/betrieb/wkr/<parcours>`). */
function zurErfassung(bereich: string) {
  wkrBereich.value = bereich
  reiter.value = 'wkr'
}

/**
 * Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11, BETRIEB_ANNAHMEN WH3): nur am Bedienrechner. Eine Action der
 * Erfassung (die Werte werden verworfen), die zugleich den Start unter „Wiederholung offen“ stellt – deshalb hier und
 * nicht über `sende` der Start-Freigabe (das Freigabe-Handy kann sie nicht schicken).
 */
function wiederholen(bereich: string, ref: string) {
  dispatch({ type: 'WIEDERHOLUNG_AUSFALL', bereich, ref })
}
/** „Doch keine Wiederholung“ – ebenso eine Action der Erfassung: Die verworfenen Werte kommen zurück (Prüfbefund 27.11.2026). */
function aufheben(bereich: string, ref: string) {
  dispatch({ type: 'WIEDERHOLUNG_AUFHEBEN', bereich, ref })
}

const frageZuruecksetzen = ref(false)
function zuruecksetzen() {
  frageZuruecksetzen.value = false
  dispatch({ type: 'BETRIEB_ZURUECKSETZEN' })
}
</script>

<template>
  <div class="subnav">
    <div class="segmented" role="group" :aria-label="t('nav.betrieb')">
      <button v-for="r in REITER" :key="r" type="button" :data-reiter="r" :class="reiter === r ? 'active' : ''" :aria-pressed="reiter === r" @click="reiter = r">
        {{ t(`betrieb.reiter.${r}`) }}
      </button>
    </div>
  </div>

  <div class="panel betrieb-kopf">
    <h2>{{ t(`betrieb.reiter.${reiter}`) }}</h2>
    <p class="hint">{{ t(HINWEIS[reiter]) }}</p>
    <div v-if="reiter !== 'geraete'" class="row betrieb-kopf-knoepfe">
      <button type="button" class="btn primary" data-action="anzeige-oeffnen" @click="oeffneAnzeige()">{{ t('betrieb.oeffnen') }}</button>
      <button type="button" class="btn" data-action="zuschauer-oeffnen" :title="t('betrieb.zuschauer.title')" @click="oeffneZuschauer()">{{ t('betrieb.zuschauer') }}</button>
      <span class="note">{{ t('betrieb.oeffnen.hint') }}</span>
      <a :href="adresse('einstellungen', { ziel: 'anzeigetafel' })" data-verweis="anzeige-einstellungen">{{ t('betrieb.einstellungen') }}</a>
      <a :href="adresse('einstellungen', { ziel: 'betrieb' })" data-verweis="betrieb-einstellungen">{{ t('betrieb.einstellungen.folge') }}</a>
      <button v-if="hatBetrieb" type="button" class="btn danger" data-action="betrieb-zuruecksetzen" @click="frageZuruecksetzen = true">
        {{ t('betrieb.zuruecksetzen') }}
      </button>
      <button v-if="wkrRueckfragen > 0" type="button" class="btn sm wkr-chip" data-teil="wkr-chip" :title="t('betrieb.wkr.chip.title')" @click="reiter = 'wkr'">
        {{ t('betrieb.wkr.chip', { n: wkrRueckfragen }) }}
      </button>
      <button v-if="geraeteLage" type="button" class="btn sm geraete-chip" data-teil="geraete-lage" :data-lage="geraeteLage" :title="t('geraete.chip.title')" @click="reiter = 'geraete'">
        {{ t('betrieb.reiter.geraete') }}: <GeraeteLage :lage="geraeteLage" />
      </button>
    </div>
  </div>

  <GeraeteRaum v-if="reiter === 'geraete'" />
  <div v-else-if="sicht.bereiche.length === 0" class="panel empty">{{ t('betrieb.leer') }}</div>
  <p v-else-if="!fest" class="boat-banner warn" role="status" data-hinweis="vor-verzahnung">
    {{ t(hatBetrieb ? 'betrieb.geloest' : 'betrieb.vorVerzahnung') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a
    >.
  </p>
  <!-- Ist schon Betrieb da, bleiben die Karten auch bei gelöster Verzahnung: Zurück, Meldungen und Zurücksetzen gehen
       immer (BETRIEB_ANNAHMEN.nurFestgeschrieben); Zeigen, Beginnen und die Schritte der Folge (zurückstellen, Klassen
       aussetzen, verschieben, einsteigen – BETRIEB_ANNAHMEN.schritteNurFestgeschrieben) sperrt die Karte selbst (`fest`). -->
  <template v-if="reiter !== 'geraete' && sicht.bereiche.length > 0 && (fest || hatBetrieb)">
    <div v-if="reiter === 'start'" class="betrieb-karten">
      <StartFreigabe
        v-for="b in sicht.bereiche"
        :key="b.id"
        :sicht="sicht"
        :bereich="b"
        :sende="dispatch"
        :anzeige-oeffnen="sicht.bereiche.length > 1 ? () => oeffneAnzeige(b.id) : undefined"
        :erfassung="erfassung[b.id]"
        :erfassung-oeffnen="() => zurErfassung(b.id)"
        :auto-anhalten="geraete?.halteAuto ? (ref: string) => geraete!.halteAuto!(b.id, ref) : undefined"
        :wiederholen="(ref: string) => wiederholen(b.id, ref)"
        :aufheben="(ref: string) => aufheben(b.id, ref)"
        :ausfall-gesperrt="state.abgemeldet"
      />
    </div>
    <template v-else-if="reiter === 'wkr'">
      <WkrMatrix :sicht="sicht" @geraete="reiter = 'geraete'" @eingang="zumEingang" />
      <WkrEingang :sicht="sicht" />
    </template>
    <template v-else>
      <p class="note betrieb-abstaende" data-teil="abstaende">
        <span><a :href="adresse('einstellungen', { ziel: 'betrieb' })" data-verweis="startabstaende">{{ t('betrieb.liste.abstaende') }}</a>:</span>
        <span v-for="a in abstaende" :key="a.klasse" class="betrieb-abstand" :data-klasse="a.klasse">
          <span class="class-badge sm" :style="{ background: a.farbe }">{{ a.name }}</span> {{ a.zeit }}
        </span>
      </p>
      <p class="note">{{ t('betrieb.liste.ziehen') }}</p>
      <StartListe v-for="b in sicht.bereiche" :key="b.id" :sicht="sicht" :bereich="b" :jetzt="jetzt" :sende="dispatch" />
    </template>
  </template>

  <AppDialog v-if="frageZuruecksetzen" :titel="t('betrieb.zuruecksetzen.frage')" data-dialog="betrieb-zuruecksetzen" @abbrechen="frageZuruecksetzen = false">
    <p>{{ t('betrieb.zuruecksetzen.text') }}</p>
    <template #knoepfe>
      <button type="button" class="btn danger" data-action="zuruecksetzen-ja" @click="zuruecksetzen">{{ t('betrieb.zuruecksetzen.ja') }}</button>
      <button type="button" class="btn" data-action="zuruecksetzen-nein" autofocus @click="frageZuruecksetzen = false">{{ t('common.cancel') }}</button>
    </template>
  </AppDialog>
</template>
