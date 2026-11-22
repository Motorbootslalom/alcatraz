<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BereichId } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { freigabeBereiche, LISTEN_EMPFEHLUNG, LISTEN_JE_GERAET, listenAufgaben, type Aufgabe, type ListenAufgabe } from '../../geraete/aufgaben'
import { GERAETE_TYPEN } from '../../geraete/transport/protokoll'
import type { RegisterEintrag } from '../../geraete/register'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { useUhr } from '../../lib/uhr'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { uhrzeitText } from './texte'
import { useListenWahl } from './wkrListenWahl'
import { liesListe, type ListenTeil } from '../../wkr/liste'
import { einteilungsName, einteilungsParcours } from '../../wkr/sicht'
import { erlaubteMasken, maskeAufGeraet, MASKEN_GEBAUT, vorgabeMaske, type MaskenWahl } from '../../wkr/maskenWahl'

/**
 * Betrieb → Geräte, Geräteliste (Etappe E7, Plan vom 16.11.2026 §4/§5; Vorbild tafel DeviceList.vue, neu geschrieben):
 * je gekoppeltem Gerät Name (änderbar), die Bereiche seiner Start-Freigabe (Häkchen – wirkt sofort: `aufgaben` an das
 * Gerät, `darf` am Host, P-6), wann gekoppelt und zuletzt gehört, „Entziehen“ mit Rückfrage (K14: das Gerät liest
 * Öffentliches weiter). Darunter die zuletzt entzogenen.
 *
 * W3.2 (21.11.2026, Plan docs/plan-wkr-w3.md §6): je Gerät seine WKR-Listen – Teil am Steg (ganz / nur Ablegen / nur
 * Anlegen, F16) umschalten, entfernen, eine Liste dazunehmen (Auswahl + eigener Knopf, nie über `change` eines
 * `<select>`), höchstens LISTEN_JE_GERAET. „Maske: Knöpfe“
 * nur als Anzeige (G4) – bzw. „Maske folgt – Papier“ bei Listen ohne Maske in W3 (G14). Jede Änderung geht sofort
 * über host.setzeAufgaben (der Host rotiert die Schlüssel der Listen-Gruppe, W1); die Folge der Aufgaben bleibt.
 *
 * Nutzer 21.11.2026 (W3-25, W3-03; WKR_ANNAHMEN GF7, GF8): Je Gerät seine Art (Handy/Pad/Rechner) – gemeldet beim
 * Koppeln, hier per Knopf änderbar (`data-wahl-typ`, host.setzeTyp). Die Zahl der Listen ist nur empfohlen
 * (LISTEN_EMPFEHLUNG: Handy eine, Pad zwei); darüber ein Hinweis, gesperrt wird erst bei LISTEN_JE_GERAET (4). Vorher
 * erkannte J2 das Handy am Namen.
 *
 * Nutzer 21.11.2026 (W3-13, WKR_ANNAHMEN WN2): je Liste der Name des Wettkampfrichters – aus der Einteilung der
 * Veranstaltung (`liste-wkr-name`) bzw. der auf dem Gerät geänderte (Register `wkrNamen`, aus dem Lebenszeichen,
 * gerätelokal). Weicht er ab, nur ein Hinweis „Name auf dem Gerät: … – Einteilung: …“ (`wkr-name-abweichend`) mit „In
 * Veranstaltung übernehmen“ (SET_WKR_NAME, dieselbe Action wie die Einteilung unter Veranstaltung); sonst nichts – der
 * WKR kann auf dem Gerät erneut überschreiben.
 *
 * W5.1 (22.11.2026, F14, WKR_ANNAHMEN MW1): je Liste mit Maske die Maske als Knöpfe (`data-wahl-maske`; Knöpfe immer,
 * Bild nur auf Bojen-Listen (gebaut seit W5.2, 22.11.2026), Tabelle seit W5.5 (22.11.2026) – für ein Handy ausgegraut,
 * TB1, wkr/maskenWahl.ts maskeAufGeraet) und
 * „fest“ (`data-feld="maske-fest"`) – beides über host.setzeAufgaben in Aufgabe.maske/fest (aufgaben.ts prüft). Ohne
 * Auswahl gilt die Vorgabe MW1 (Pad/Rechner + Bojen → Bild, sonst Knöpfe); gedrückt steht, was das Gerät zeigen wird.
 * „Fest“ schreibt die gezeigte Maske ausdrücklich mit, damit sie nicht mit der Art des Geräts wechselt.
 *
 * „Zuletzt gehört“ statt „verbunden“: Ein Gerät meldet sich nur, wenn es schaltet oder neu startet (kein Herzschlag –
 * jede Nachricht kostet Kontingent am fremden Server). Ein Bereich, den es im Stand nicht mehr gibt, bleibt im Register
 * (der Parcours kann zurückkommen), wird hier aber nicht gezeigt; der Host lässt ihn ohnehin nicht gelten.
 */
const { state, dispatch } = useStore()
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
/** Mehr Listen als für die Art empfohlen (W3-03); ohne bekannte Art gilt die des Pads (zwei). */
const ueberEmpfehlung = (g: RegisterEintrag) => listenAufgaben(g.aufgaben).length > LISTEN_EMPFEHLUNG[g.typ ?? 'pad']

// --- Maske je Liste (F14, W5.1) ---
const bojenListe = (kennung: string) => !!listeVon(kennung)?.bojen
/** Sichtbare Knöpfe: alle erlaubten Masken; nicht gebaute bzw. auf diesem Gerät nicht mögliche (TB1) ausgegraut. */
const maskenKnoepfe = (kennung: string): MaskenWahl[] => erlaubteMasken({ bojen: bojenListe(kennung) })
/** Ohne bekannte Art zählt das Gerät als Pad (wie die Empfehlung) – erst ein Handy graut „Tabelle“ aus. */
const maskeAus = (g: RegisterEintrag, m: MaskenWahl) => !MASKEN_GEBAUT[m] || !maskeAufGeraet(m, g.typ !== 'handy')
/** Was das Gerät zeigen wird: die Vorgabe des Bedieners bzw. MW1 – eine nicht gebaute bzw. dort nicht mögliche als Knöpfe. */
function maskeGezeigt(g: RegisterEintrag, a: ListenAufgabe): MaskenWahl {
  const m = a.maske ?? vorgabeMaske({ bojen: bojenListe(a.liste), pad: g.typ !== 'handy' })
  return maskeAus(g, m) ? 'knoepfe' : m
}
function setzeMaske(g: RegisterEintrag, kennung: string, maske: MaskenWahl, fest: boolean): void {
  setzeListen(
    g,
    listenAufgaben(g.aufgaben).map((a) => {
      if (a.liste !== kennung) return a
      const neu: ListenAufgabe = { ...a, maske }
      if (fest) neu.fest = true
      else delete neu.fest
      return neu
    }),
  )
}

// --- WKR-Name je Liste (W3-13) ---
/** Name laut Einteilung, der auf dem Gerät und ob sie sich unterscheiden. */
function wkrNamen(g: RegisterEintrag, kennung: string): { einteilung: string; geraet: string; abweichend: boolean } {
  const l = liesListe(kennung)
  const einteilung = l ? einteilungsName(state.value, l) : ''
  const geraet = g.wkrNamen?.[kennung] ?? ''
  return { einteilung, geraet, abweichend: geraet !== '' && geraet !== einteilung }
}
/** Den Namen vom Gerät in die Einteilung der Veranstaltung übernehmen (wie WkrEinteilung.vue). */
function uebernimmName(g: RegisterEintrag, kennung: string): void {
  const l = liesListe(kennung)
  const name = g.wkrNamen?.[kennung]
  if (!l || !name) return
  dispatch({ type: 'SET_WKR_NAME', parcoursId: einteilungsParcours(l), typeId: l.typeId, name })
}

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
          <div class="segmented geraete-typ" role="group" :aria-label="t('geraete.liste.typ')" data-teil="geraet-typ">
            <button
              v-for="ty in GERAETE_TYPEN"
              :key="ty"
              type="button"
              class="sm"
              :data-wahl-typ="ty"
              :class="g.typ === ty ? 'active' : ''"
              :aria-pressed="g.typ === ty"
              @click="g.typ !== ty && host?.setzeTyp(g.id, ty)"
            >
              {{ t(`geraete.typ.${ty}`) }}
            </button>
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
                <span v-if="!listeVon(a.liste) || listeVon(a.liste)!.ohneMaske" class="note" data-teil="liste-maske">{{ t('geraete.liste.liste.ohneMaske') }}</span>
                <!-- W5.3 (22.11.2026): Am Tisch gibt es nur die Prüfliste – keine Maskenwahl. -->
                <span v-else-if="listeVon(a.liste)!.tisch" class="note" data-teil="liste-maske" data-maske="pruefliste">{{ t('geraete.liste.maske.pruefliste') }}</span>
                <template v-else>
                  <span class="segmented" role="group" :aria-label="t('geraete.liste.maske')" data-teil="liste-maske">
                    <button
                      v-for="m in maskenKnoepfe(a.liste)"
                      :key="m"
                      type="button"
                      class="sm"
                      :data-wahl-maske="m"
                      :disabled="maskeAus(g, m)"
                      :title="!MASKEN_GEBAUT[m] ? t('geraete.liste.maske.folgt') : maskeAus(g, m) ? t('geraete.liste.maske.nurPad') : undefined"
                      :class="maskeGezeigt(g, a) === m ? 'active' : ''"
                      :aria-pressed="maskeGezeigt(g, a) === m"
                      @click="setzeMaske(g, a.liste, m, !!a.fest)"
                    >
                      {{ t(`geraete.liste.maske.${m}`) }}
                    </button>
                  </span>
                  <label class="geraete-bereich">
                    <input type="checkbox" data-feld="maske-fest" :checked="!!a.fest" @change="setzeMaske(g, a.liste, maskeGezeigt(g, a), ($event.target as HTMLInputElement).checked)" />
                    {{ t('geraete.liste.maske.fest') }}
                  </label>
                </template>
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
                <span v-if="wkrNamen(g, a.liste).abweichend" class="note geraete-wkr-name" data-teil="wkr-name-abweichend">
                  {{
                    t('geraete.liste.wkrName.abweichend', {
                      geraet: wkrNamen(g, a.liste).geraet,
                      einteilung: wkrNamen(g, a.liste).einteilung || t('geraete.liste.wkrName.niemand'),
                    })
                  }}
                  <button type="button" class="btn sm" data-action="wkr-name-uebernehmen" @click="uebernimmName(g, a.liste)">{{ t('geraete.liste.wkrName.uebernehmen') }}</button>
                </span>
                <span v-else-if="wkrNamen(g, a.liste).einteilung" class="note geraete-wkr-name" data-teil="liste-wkr-name">
                  {{ t('geraete.liste.wkrName', { name: wkrNamen(g, a.liste).einteilung }) }}
                </span>
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
            <p v-if="g.typ === 'handy' && ueberEmpfehlung(g)" class="note" data-hinweis="handy-eine">{{ t('geraete.liste.liste.handy') }}</p>
            <p v-else-if="ueberEmpfehlung(g)" class="note" data-hinweis="pad-zwei">{{ t('geraete.liste.liste.pad') }}</p>
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
