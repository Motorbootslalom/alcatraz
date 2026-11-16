<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { merke } from '../lib/merken'
import { adresse, useReiter } from '../lib/router'
import { oeffneAnzeige } from '../lib/anzeigeFenster'
import { sichtOeffentlich } from '../betrieb/sicht'
import { t } from '../i18n'
import AppDialog from '../components/AppDialog.vue'
import StartFreigabe from '../components/betrieb/StartFreigabe.vue'

/**
 * Reiter „Betrieb“ am Wettkampftag (Plan vom 16.11.2026): die Start-Freigabe je Parcours (E1, mit der
 * Steuerung der Etappe E2) und der Knopf, der die Anzeigetafel in einem eigenen Fenster öffnet. Unterreiter
 * `start`; die Startliste (E3) und die Geräte (E6) kommen dazu. Einstellungen (Anzeigetafel, Startfolge)
 * stehen unter „Einstellungen“, nicht hier – verlinkt.
 *
 * Die Karten lesen nur die öffentliche Sicht (betrieb/sicht.ts) – dieselben Komponenten bedienen später
 * vom Handy aus. Ohne festgeschriebene Verzahnung gibt es keine Bedienung, nur den Weg dorthin – außer es
 * ist schon Betrieb da (Verzahnung mitten am Tag gelöst): Dann bleiben die Karten mit den Knöpfen, die
 * keine Folge brauchen (Zurück, Meldung); Zeigen, Beginnen und alle Schritte der Folge ruhen.
 */
const { state, dispatch } = useStore()

const REITER = ['start'] as const
const reiter = merke<(typeof REITER)[number]>('betrieb.reiter', 'start')
useReiter('betrieb', reiter, REITER)

// Ohne Logos: Die Bedienung braucht sie nicht, und so trägt die Sicht hier keine Bilder.
const sicht = computed(() => sichtOeffentlich(state.value, { logos: false }))
const fest = computed(() => sicht.value.bereiche.some((b) => b.fest))
const hatBetrieb = computed(() => Object.keys(state.value.betrieb.bereiche).length > 0)

const frageZuruecksetzen = ref(false)
function zuruecksetzen() {
  frageZuruecksetzen.value = false
  dispatch({ type: 'BETRIEB_ZURUECKSETZEN' })
}
</script>

<template>
  <div class="panel betrieb-kopf">
    <h2>{{ t('betrieb.title') }}</h2>
    <p class="hint">{{ t('betrieb.hint') }}</p>
    <div class="row betrieb-kopf-knoepfe">
      <button type="button" class="btn primary" data-action="anzeige-oeffnen" @click="oeffneAnzeige()">{{ t('betrieb.oeffnen') }}</button>
      <span class="note">{{ t('betrieb.oeffnen.hint') }}</span>
      <a :href="adresse('einstellungen', { ziel: 'anzeigetafel' })" data-verweis="anzeige-einstellungen">{{ t('betrieb.einstellungen') }}</a>
      <a :href="adresse('einstellungen', { ziel: 'betrieb' })" data-verweis="betrieb-einstellungen">{{ t('betrieb.einstellungen.folge') }}</a>
      <button v-if="hatBetrieb" type="button" class="btn danger" data-action="betrieb-zuruecksetzen" @click="frageZuruecksetzen = true">
        {{ t('betrieb.zuruecksetzen') }}
      </button>
    </div>
  </div>

  <div v-if="sicht.bereiche.length === 0" class="panel empty">{{ t('betrieb.leer') }}</div>
  <p v-else-if="!fest" class="boat-banner warn" role="status" data-hinweis="vor-verzahnung">
    {{ t(hatBetrieb ? 'betrieb.geloest' : 'betrieb.vorVerzahnung') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a
    >.
  </p>
  <!-- Ist schon Betrieb da, bleiben die Karten auch bei gelöster Verzahnung: Zurück, Meldungen und Zurücksetzen gehen
       immer (BETRIEB_ANNAHMEN.nurFestgeschrieben); Zeigen, Beginnen und die Schritte der Folge (zurückstellen, Klassen
       aussetzen, verschieben, einsteigen – BETRIEB_ANNAHMEN.schritteNurFestgeschrieben) sperrt die Karte selbst (`fest`). -->
  <div v-if="sicht.bereiche.length > 0 && (fest || hatBetrieb)" class="betrieb-karten">
    <StartFreigabe
      v-for="b in sicht.bereiche"
      :key="b.id"
      :sicht="sicht"
      :bereich="b"
      :sende="dispatch"
      :anzeige-oeffnen="sicht.bereiche.length > 1 ? () => oeffneAnzeige(b.id) : undefined"
    />
  </div>

  <AppDialog v-if="frageZuruecksetzen" :titel="t('betrieb.zuruecksetzen.frage')" data-dialog="betrieb-zuruecksetzen" @abbrechen="frageZuruecksetzen = false">
    <p>{{ t('betrieb.zuruecksetzen.text') }}</p>
    <template #knoepfe>
      <button type="button" class="btn danger" data-action="zuruecksetzen-ja" @click="zuruecksetzen">{{ t('betrieb.zuruecksetzen.ja') }}</button>
      <button type="button" class="btn" data-action="zuruecksetzen-nein" autofocus @click="frageZuruecksetzen = false">{{ t('common.cancel') }}</button>
    </template>
  </AppDialog>
</template>
