<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ClassId } from '../types'
import { useStore } from '../state/store'
import { merke } from '../lib/merken'
import { adresse, useReiter } from '../lib/router'
import { oeffneAnzeige, oeffneZuschauer } from '../lib/anzeigeFenster'
import { useUhr } from '../lib/uhr'
import { CLASS_IDS } from '../domain/classes'
import { sichtOeffentlich } from '../betrieb/sicht'
import { mmss } from '../betrieb/prognose'
import { t } from '../i18n'
import AppDialog from '../components/AppDialog.vue'
import StartFreigabe from '../components/betrieb/StartFreigabe.vue'
import StartListe from '../components/betrieb/StartListe.vue'
import GeraeteRaum from '../components/betrieb/GeraeteRaum.vue'
import GeraeteLage from '../components/betrieb/GeraeteLage.vue'
import { useGeraeteHost } from '../geraete/host'
import { verbindungsLage } from '../geraete/transport/typen'

/**
 * Reiter „Betrieb“ am Wettkampftag (Plan vom 16.11.2026): Unterreiter `start` – die Start-Freigabe je Parcours (E1,
 * mit der Steuerung der Etappe E2) –, `startliste` – die ganze Folge mit Wartezeiten (E3) – und `geraete` – der
 * Gerätebetrieb mit Lese-Links für Anzeigetafel und Zuschauer (E6, components/betrieb/GeraeteRaum.vue). Dazu die
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

const REITER = ['start', 'startliste', 'geraete'] as const
const HINWEIS = { start: 'betrieb.hint', startliste: 'betrieb.liste.hint', geraete: 'betrieb.geraete.hint' } as const
const reiter = merke<(typeof REITER)[number]>('betrieb.reiter', 'start')
useReiter('betrieb', reiter, REITER)

// Ohne Logos: Die Bedienung braucht sie nicht, und so trägt die Sicht hier keine Bilder.
const sicht = computed(() => sichtOeffentlich(state.value, { logos: false }))
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
      />
    </div>
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
