<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BereichId } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { freigabeBereiche, LISTEN_JE_GERAET, listenAufgaben, type Aufgabe, type ListenAufgabe } from '../../geraete/aufgaben'
import type { RegisterEintrag } from '../../geraete/register'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { useUhr } from '../../lib/uhr'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { uhrzeitText } from './texte'
import { istHandyName, useListenWahl } from './wkrListenWahl'
import type { ListenTeil } from '../../wkr/liste'

/**
 * Betrieb → Geräte, Geräteliste (Etappe E7, Plan vom 16.11.2026 §4/§5; Vorbild tafel DeviceList.vue, neu geschrieben):
 * je gekoppeltem Gerät Name (änderbar), die Bereiche seiner Start-Freigabe (Häkchen – wirkt sofort: `aufgaben` an das
 * Gerät, `darf` am Host, P-6), wann gekoppelt und zuletzt gehört, „Entziehen“ mit Rückfrage (K14: das Gerät liest
 * Öffentliches weiter). Darunter die zuletzt entzogenen.
 *
 * W3.2 (21.11.2026, Plan docs/plan-wkr-w3.md §6): je Gerät seine WKR-Listen – Teil am Steg (ganz / nur Ablegen / nur
 * Anlegen, F16) umschalten, entfernen, eine Liste dazunehmen (Auswahl + eigener Knopf, nie über `change` eines
 * `<select>`), höchstens LISTEN_JE_GERAET (F15); Hinweis „Handy: eine Liste“ nach dem Namen (G3, J2). „Maske: Knöpfe“
 * nur als Anzeige (G4) – bzw. „Maske folgt – Papier“ bei Listen ohne Maske in W3 (G14). Jede Änderung geht sofort
 * über host.setzeAufgaben (der Host rotiert die Schlüssel der Listen-Gruppe, W1); die Folge der Aufgaben bleibt.
 *
 * „Zuletzt gehört“ statt „verbunden“: Ein Gerät meldet sich nur, wenn es schaltet oder neu startet (kein Herzschlag –
 * jede Nachricht kostet Kontingent am fremden Server). Ein Bereich, den es im Stand nicht mehr gibt, bleibt im Register
 * (der Parcours kann zurückkommen), wird hier aber nicht gezeigt; der Host lässt ihn ohnehin nicht gelten.
 */
const { state } = useStore()
const host = useGeraeteHost()
const raum = computed(() => host?.raum.value ?? null)
const geraete = computed(() => raum.value?.geraete ?? [])
const entzogen = computed(() => raum.value?.entzogen ?? [])
const jetzt = useUhr(30_000)

const bereiche = computed(() => sichtOeffentlich(state.value, { logos: false }).bereiche.map((b) => ({ id: b.id, name: b.name })))

function schalte(g: RegisterEintrag, id: BereichId, an: boolean): void {
  const neu = new Set(freigabeBereiche(g.aufgaben))
  if (an) neu.add(id)
  else neu.delete(id)
  // Andere Aufgaben (WKR-Listen, W1) bleiben – hier wird nur die Start-Freigabe umgeschaltet.
  host?.setzeAufgaben(g.id, [{ art: 'startfreigabe', bereiche: [...neu] }, ...g.aufgaben.filter((a) => a.art !== 'startfreigabe')])
}

// --- WKR-Listen (W3.2) ---
const { gruppen, liste: listeVon, listeText } = useListenWahl()
/** Gewählte Liste im „Liste dazu“-Feld je Gerät (Bedienung, nicht Stand). */
const neueListe = ref<Record<string, string>>({})

function setzeListen(g: RegisterEintrag, listen: ListenAufgabe[]): void {
  const andere: Aufgabe[] = g.aufgaben.filter((a) => a.art !== 'liste')
  host?.setzeAufgaben(g.id, [...andere, ...listen])
}
function setzeTeil(g: RegisterEintrag, kennung: string, teil: ListenTeil | undefined): void {
  setzeListen(
    g,
    listenAufgaben(g.aufgaben).map((a) => {
      if (a.liste !== kennung) return a
      const neu: ListenAufgabe = { ...a }
      if (teil) neu.teil = teil
      else delete neu.teil
      return neu
    }),
  )
}
function entferneListe(g: RegisterEintrag, kennung: string): void {
  setzeListen(g, listenAufgaben(g.aufgaben).filter((a) => a.liste !== kennung))
}
function nimmListe(g: RegisterEintrag): void {
  const kennung = neueListe.value[g.id]
  const da = listenAufgaben(g.aufgaben)
  if (!kennung || !listeVon(kennung) || da.length >= LISTEN_JE_GERAET || da.some((a) => a.liste === kennung)) return
  setzeListen(g, [...da, { art: 'liste', liste: kennung }])
  neueListe.value = { ...neueListe.value, [g.id]: '' }
}
const voll = (g: RegisterEintrag) => listenAufgaben(g.aufgaben).length >= LISTEN_JE_GERAET

function benenne(g: RegisterEintrag, e: Event): void {
  const feld = e.target as HTMLInputElement
  const name = feld.value.trim()
  // Leer heißt: zurück zum alten Namen – ein Gerät ohne Namen fände niemand in der Liste wieder.
  if (!name) feld.value = g.name
  else if (name !== g.name) host?.benenne(g.id, name)
}

const frageEntziehen = ref<RegisterEintrag | null>(null)
function entziehe(): void {
  const g = frageEntziehen.value
  frageEntziehen.value = null
  if (g) host?.entziehe(g.id)
}
</script>

<template>
  <section class="geraete-liste" data-teil="geraeteliste">
    <h3>{{ t('geraete.liste') }}</h3>
    <p v-if="geraete.length === 0" class="note" data-hinweis="keine-geraete">{{ t('geraete.liste.leer') }}</p>
    <template v-else>
      <p class="note">{{ t('geraete.liste.hint') }}</p>
      <ul class="geraete-eintraege">
        <li v-for="g in geraete" :key="g.id" class="geraete-eintrag" :data-geraet="g.id">
          <div class="geraete-eintrag-kopf">
            <input class="input geraete-name" :value="g.name" maxlength="40" :aria-label="t('geraete.liste.name', { name: g.name })" data-feld="name" @change="benenne(g, $event)" />
            <span class="note" data-teil="seit">{{ t('geraete.liste.seit', { zeit: g.seit ? uhrzeitText(g.seit, jetzt) : '–' }) }}</span>
            <span class="note" data-teil="zuletzt">{{ t('geraete.liste.zuletzt', { zeit: g.zuletzt ? uhrzeitText(g.zuletzt, jetzt) : '–' }) }}</span>
            <button type="button" class="btn danger sm" data-action="entziehen" @click="frageEntziehen = g">{{ t('geraete.entziehen') }}</button>
          </div>
          <fieldset class="geraete-bereiche">
            <legend>{{ t('geraete.liste.bereiche') }}</legend>
            <label v-for="b in bereiche" :key="b.id" class="geraete-bereich">
              <input
                type="checkbox"
                :data-bereich="b.id"
                :checked="freigabeBereiche(g.aufgaben).includes(b.id)"
                @change="schalte(g, b.id, ($event.target as HTMLInputElement).checked)"
              />
              {{ b.name }}
            </label>
          </fieldset>
          <fieldset v-if="gruppen.length > 0 || listenAufgaben(g.aufgaben).length > 0" class="geraete-bereiche geraete-listen" data-teil="geraet-listen">
            <legend>{{ t('geraete.liste.listen') }}</legend>
            <ul class="geraete-listen-eintraege">
              <li v-for="a in listenAufgaben(g.aufgaben)" :key="a.liste" class="geraete-liste-eintrag" :data-liste="a.liste">
                <span data-teil="liste-titel">{{ listeText(a.liste) }}</span>
                <span class="note" data-teil="liste-maske">{{ listeVon(a.liste)?.ohneMaske ? t('geraete.liste.liste.ohneMaske') : t('geraete.liste.liste.maske') }}</span>
                <span v-if="listeVon(a.liste)?.teilbar" class="segmented" role="group" :aria-label="t('geraete.koppeln.liste.teil')">
                  <button
                    v-for="w in (['', 'ab', 'an'] as const)"
                    :key="w"
                    type="button"
                    class="sm"
                    :data-wahl-teil="w || 'ganz'"
                    :class="(a.teil ?? '') === w ? 'active' : ''"
                    :aria-pressed="(a.teil ?? '') === w"
                    @click="(a.teil ?? '') !== w && setzeTeil(g, a.liste, w || undefined)"
                  >
                    {{ t(w ? `geraete.koppeln.liste.teil.${w}` : 'geraete.koppeln.liste.teil.ganz') }}
                  </button>
                </span>
                <button type="button" class="btn sm" data-action="liste-entfernen" @click="entferneListe(g, a.liste)">{{ t('geraete.liste.liste.entfernen') }}</button>
              </li>
            </ul>
            <div v-if="!voll(g) && gruppen.length > 0" class="row">
              <select
                class="input"
                data-feld="liste-dazu"
                :aria-label="t('geraete.liste.liste.dazu')"
                :value="neueListe[g.id] ?? ''"
                @change="neueListe = { ...neueListe, [g.id]: ($event.target as HTMLSelectElement).value }"
              >
                <option value="">{{ t('geraete.koppeln.liste.keine') }}</option>
                <optgroup v-for="gr in gruppen" :key="gr.name" :label="gr.name">
                  <option v-for="l in gr.listen" :key="l.kennung" :value="l.kennung" :disabled="listenAufgaben(g.aufgaben).some((x) => x.liste === l.kennung)">
                    {{ l.ohneMaske ? t('geraete.koppeln.liste.ohneMaske', { titel: l.titel }) : l.titel }}
                  </option>
                </optgroup>
              </select>
              <button type="button" class="btn sm" data-action="liste-dazu" :disabled="!neueListe[g.id]" @click="nimmListe(g)">{{ t('geraete.liste.liste.dazu') }}</button>
            </div>
            <p v-if="voll(g)" class="note" data-hinweis="listen-voll">{{ t('geraete.liste.liste.voll', { n: LISTEN_JE_GERAET }) }}</p>
            <p v-if="listenAufgaben(g.aufgaben).length >= 1 && istHandyName(g.name)" class="note" data-hinweis="handy-eine">{{ t('geraete.liste.liste.handy') }}</p>
            <p v-else-if="listenAufgaben(g.aufgaben).length >= 2" class="note" data-hinweis="pad-zwei">{{ t('geraete.liste.liste.pad') }}</p>
          </fieldset>
          <p v-if="!freigabeBereiche(g.aufgaben).some((id) => bereiche.some((b) => b.id === id)) && listenAufgaben(g.aufgaben).length === 0" class="note" data-hinweis="nichts-frei">
            {{ t('geraete.liste.keine') }}
          </p>
        </li>
      </ul>
    </template>
    <p v-if="entzogen.length" class="note" data-teil="entzogen">
      {{ t('geraete.liste.entzogen', { namen: entzogen.map((e) => `${e.name} (${uhrzeitText(e.um, jetzt)})`).join(', ') }) }}
    </p>

    <AppDialog v-if="frageEntziehen" :titel="t('geraete.entziehen.frage', { name: frageEntziehen.name })" data-dialog="entziehen" @abbrechen="frageEntziehen = null">
      <p>{{ t('geraete.entziehen.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="entziehen-ja" @click="entziehe">{{ t('geraete.entziehen.ja') }}</button>
        <button type="button" class="btn" data-action="entziehen-nein" autofocus @click="frageEntziehen = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
