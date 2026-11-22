<script setup lang="ts">
import { computed } from 'vue'
import type { KeineZeitGrund, OeffentlicheSicht, WkrRueckfrage, WkrVorschlag } from '../../types'
import { useStore } from '../../state/store'
import { useKonfig } from '../../lib/konfig'
import { listenFelder, werteVon, type Feld } from '../../lib/eingaben'
import { NICHT_GESTARTET } from '../../lib/abmeldung'
import { geraetVonZeile } from '../../state/reducer/wkr'
import { punktVonRef } from '../../wkr/abschluss'
import { liesListe } from '../../wkr/liste'
import { useGeraeteHost } from '../../geraete/host'
import { t } from '../../i18n'
import { punktText, punktVon, uhrzeitText } from './texte'

/**
 * Eingang unter Betrieb → WKR (W2.2, Plan docs/plan-wkr-w2.md §6.1, 21.11.2026): die offenen Rückfragen, je Zeile des
 * Geräts gruppiert (eine Zeile kann mehrere Zellen betreffen), mit „Gerät übernehmen“/„Behalten“ je Zelle und für die
 * ganze Zeile, und die Vorschläge mit „Übernehmen“/„Verwerfen“. Der Grund steht als Satz da (Zelle anders belegt,
 * Start nicht gezeigt, Buchstabe fiele weg; Liste abgeschlossen, Start auf Papier). Ein „X“ (nicht gestartet) vom
 * Gerät ist hervorgehoben (F5) – es nimmt den Starter aus der Wertung des Laufs. „Nicht vorbeigekommen“ steht als
 * „⊘ nicht vorbeigekommen“ am Kopf (W4.3, Prüfbefund 21.11.2026); erst die Entscheidung für das Gerät setzt es.
 * Hat der WKR auf dem Gerät „So lassen“ gewählt, steht „WKR: so lassen (14:03)“ am Kopf (Nutzer 21.11.2026, W3-35,
 * WKR_ANNAHMEN GF5) – die Rückfrage bleibt offen, der Bediener entscheidet wie bisher.
 *
 * Gerätenamen stehen nie im Stand (F10): Sie kommen nur aus dem Register des Hosts über die Geräte-ID der Zeile
 * (`geraetVonZeile`); ein Gerät, das es dort nicht mehr gibt, heißt „entkoppeltes Gerät“. Werte zeigt nur der
 * Bedienrechner – Spaltennamen in der Sprache der Oberfläche.
 */
const props = defineProps<{ sicht: OeffentlicheSicht }>()

const { state, dispatch } = useStore()
const konfig = useKonfig({ oberflaeche: true })
const host = useGeraeteHost()

const geraetName = (zeile: string): string => {
  const id = geraetVonZeile(zeile)
  return host?.raum.value?.geraete.find((g) => g.id === id)?.name ?? t('betrieb.wkr.entkoppelt')
}

/** Kopfzeile: Startnummer, Liste, Lauf/Runde, Gerät, Uhrzeit. */
function kopf(x: { liste: string; ref: string; starter: string; zeit: number }, geraet: string): string {
  const liste = liesListe(x.liste)
  const starter = state.value.starters.find((s) => s.id === x.starter)
  const typ = liste && konfig.value.getPositions().some((p) => p.typeId === liste.typeId) ? konfig.value.getSheetDef(liste.typeId).title : (liste?.typeId ?? '')
  const titel = liste?.racecourse ? `${typ} ${liste.racecourse}` : typ
  const id = punktVonRef(state.value, x.ref)
  const b = liste ? props.sicht.bereiche.find((y) => y.id === liste.bereich) : undefined
  const p = id && b ? punktVon(b, id) : null
  return t('betrieb.wkr.eingang.kopf', { nr: starter?.startNr ?? '?', liste: titel, punkt: p ? punktText(p) : '', geraet, zeit: uhrzeitText(x.zeit) })
}

function felderVon(liste: string, starter: string): Feld[] {
  const l = liesListe(liste)
  const s = state.value.starters.find((x) => x.id === starter)
  if (!l || !s || !konfig.value.getPositions().some((p) => p.typeId === l.typeId)) return []
  return listenFelder(konfig.value, l.typeId, s.klasse)
}

const leer = (w: string) => (w === '' ? t('betrieb.wkr.eingang.leerWert') : w)
/** Ein X (nicht gestartet) in einer Disq.-Zelle vom Gerät (F5). */
const istX = (f: Feld | undefined, wert: string) => f?.kind === 'disq' && wert.split(/[\s,]+/).includes(NICHT_GESTARTET)

const GRUND = { zelle: 'betrieb.wkr.grund.zelle', start: 'betrieb.wkr.grund.start', entfernt: 'betrieb.wkr.grund.entfernt' } as const
const VORSCHLAG_GRUND = { abgeschlossen: 'betrieb.wkr.vorschlag.abgeschlossen', papier: 'betrieb.wkr.vorschlag.papier' } as const

/**
 * „Keine Zeit“ einer Zeile als Satz (W5.4, 22.11.2026, ZT4): „Zeit 2: keine Zeit (Zeitanlage ausgefallen)“ – leer ohne.
 * Sonst sähe eine Zeile ohne Zeit aus, als hätte das Gerät die Zeit vergessen.
 */
function kzText(liste: string, starter: string, kz: Readonly<Record<string, KeineZeitGrund>> | undefined): string {
  if (!kz) return ''
  const felder = felderVon(liste, starter)
  return Object.entries(kz)
    .map(([feld, grund]) => t('betrieb.wkr.eingang.keineZeit', { feld: felder.find((x) => x.kennung === feld)?.label ?? feld, grund: t(`wkr.geraet.keineZeit.grund.${grund}`) }))
    .join(' · ')
}

interface Gruppe {
  key: string
  kopf: string
  /** „Keine Zeit“ der Zeile (W5.4) als Satz, '' ohne. */
  kz: string
  /** „Nicht vorbeigekommen“ (W4.3, Prüfbefund 21.11.2026): sonst sähe die Zeile wie ein bloßer Haken aus. */
  nv: boolean
  /** „So lassen“ vom Gerät (Nutzer 21.11.2026, W3-35, GF5): Zeit des ersten Vermerks der Zeile, sonst null. */
  soLassen: number | null
  zellen: { rf: WkrRueckfrage; label: string; x: boolean }[]
}

const gruppen = computed<Gruppe[]>(() => {
  const out = new Map<string, Gruppe>()
  for (const rf of state.value.wkr.rueckfragen) {
    const key = `${rf.zeile}|${rf.lauf}|${rf.starter}`
    let g = out.get(key)
    if (!g) out.set(key, (g = { key, kopf: kopf(rf, geraetName(rf.zeile)), kz: kzText(rf.liste, rf.starter, rf.keineZeit), nv: !!rf.nichtVorbei, soLassen: null, zellen: [] }))
    if (rf.soLassen !== undefined && (g.soLassen === null || rf.soLassen < g.soLassen)) g.soLassen = rf.soLassen
    const f = felderVon(rf.liste, rf.starter).find((x) => x.kennung === rf.feld)
    g.zellen.push({ rf, label: f?.label ?? rf.feld, x: istX(f, rf.wert) })
  }
  return [...out.values()]
})

const vorschlaege = computed(() =>
  state.value.wkr.vorschlaege.map((v: WkrVorschlag) => {
    const felder = felderVon(v.liste, v.starter)
    return {
      v,
      kopf: kopf(v, geraetName(v.id)),
      kz: kzText(v.liste, v.starter, v.keineZeit),
      zellen: v.zellen.map((c) => {
        const f = felder.find((x) => x.kennung === c.feld)
        return { feld: c.feld, label: f?.label ?? c.feld, wert: c.wert, x: istX(f, c.wert) }
      }),
    }
  }),
)

/**
 * Entscheiden. Bei „Gerät übernehmen“ danach ◆ (Prüfbefund 21.11.2026, Vorschlag §5/§6.2): Gerade die strittigen Werte
 * kamen vom Gerät – geschrieben nur, wo nach dem dispatch der Wert des Geräts steht (bei `vereinige` das Vereinigte,
 * es trägt den Buchstaben des Geräts).
 */
function entscheide(id: string, wahl: 'geraet' | 'behalten'): void {
  const rf = state.value.wkr.rueckfragen.find((x) => x.id === id)
  dispatch({ type: 'WKR_RUECKFRAGE', id, wahl })
  if (!rf || wahl !== 'geraet' || !host) return
  const wert = rf.vereinige ? (werteVon(state.value.eingaben, rf.lauf, rf.starter)[rf.feld] ?? '') : rf.wert
  host.merkeEntscheid(rf.liste, geraetName(rf.zeile), [{ lauf: rf.lauf, weitere: rf.weitere, starter: rf.starter, zellen: [{ feld: rf.feld, wert }] }])
}
function vorschlag(v: WkrVorschlag, wahl: 'uebernehmen' | 'verwerfen'): void {
  dispatch({ type: 'WKR_VORSCHLAG', id: v.id, wahl })
  if (wahl === 'uebernehmen') host?.merkeEntscheid(v.liste, geraetName(v.id), [{ lauf: v.lauf, weitere: v.weitere, starter: v.starter, zellen: v.zellen }])
}
function alle(g: Gruppe, wahl: 'geraet' | 'behalten'): void {
  for (const z of g.zellen) entscheide(z.rf.id, wahl)
}
</script>

<template>
  <section class="panel wkr-eingang" data-teil="wkr-eingang">
    <h3>{{ t('betrieb.wkr.eingang') }}</h3>
    <p v-if="gruppen.length === 0 && vorschlaege.length === 0" class="note" data-hinweis="wkr-eingang-leer">{{ t('betrieb.wkr.eingang.leer') }}</p>

    <template v-if="gruppen.length">
      <h4>{{ t('betrieb.wkr.eingang.rueckfragen', { n: state.wkr.rueckfragen.length }) }}</h4>
      <ul class="wkr-eingang-liste">
        <li v-for="g in gruppen" :key="g.key" class="wkr-eingang-eintrag" data-teil="wkr-rueckfrage-zeile">
          <div class="wkr-eingang-kopf">
            <strong>{{ g.kopf }}</strong>
            <span v-if="g.nv" class="wkr-nv" data-teil="wkr-nv">⊘ {{ t('betrieb.wkr.eingang.nichtVorbei') }}</span>
            <span v-if="g.kz" class="wkr-nv" data-teil="wkr-keine-zeit">{{ g.kz }}</span>
            <!-- W3-35 (21.11.2026): Der WKR hat „So lassen“ gewählt – Feedback für den Bediener; entscheiden muss er weiter. -->
            <span v-if="g.soLassen !== null" class="wkr-so-lassen" data-teil="wkr-so-lassen">{{ t('betrieb.wkr.eingang.soLassen', { zeit: uhrzeitText(g.soLassen) }) }}</span>
            <template v-if="g.zellen.length > 1">
              <button type="button" class="btn sm" data-action="wkr-alle-geraet" @click="alle(g, 'geraet')">{{ t('betrieb.wkr.alleGeraet') }}</button>
              <button type="button" class="btn sm" data-action="wkr-alle-behalten" @click="alle(g, 'behalten')">{{ t('betrieb.wkr.alleBehalten') }}</button>
            </template>
          </div>
          <ul>
            <li v-for="z in g.zellen" :key="z.rf.id" class="wkr-eingang-zelle" data-teil="wkr-rueckfrage" :data-rueckfrage="z.rf.id" :data-x="z.x || undefined">
              <span :class="{ 'wkr-x': z.x }">{{ t('betrieb.wkr.eingang.zelle', { feld: z.label, wert: leer(z.rf.wert), steht: leer(z.rf.steht) }) }}</span>
              <span v-if="z.x" class="wkr-x" data-teil="wkr-x"> ({{ t('betrieb.wkr.eingang.x') }})</span>
              <span class="note"> – {{ t(GRUND[z.rf.grund]) }}</span>
              <button type="button" class="btn sm primary" data-action="wkr-geraet" @click="entscheide(z.rf.id, 'geraet')">{{ t('betrieb.wkr.geraetNehmen') }}</button>
              <button type="button" class="btn sm" data-action="wkr-behalten" @click="entscheide(z.rf.id, 'behalten')">{{ t('betrieb.wkr.behalten') }}</button>
            </li>
          </ul>
        </li>
      </ul>
    </template>

    <template v-if="vorschlaege.length">
      <h4>{{ t('betrieb.wkr.eingang.vorschlaege', { n: vorschlaege.length }) }}</h4>
      <ul class="wkr-eingang-liste">
        <li v-for="e in vorschlaege" :key="e.v.id + e.v.lauf + e.v.starter" class="wkr-eingang-eintrag" data-teil="wkr-vorschlag" :data-vorschlag="e.v.id">
          <div class="wkr-eingang-kopf">
            <strong>{{ e.kopf }}</strong>
            <span v-if="e.v.nichtVorbei" class="wkr-nv" data-teil="wkr-nv">⊘ {{ t('betrieb.wkr.eingang.nichtVorbei') }}</span>
            <span v-if="e.kz" class="wkr-nv" data-teil="wkr-keine-zeit">{{ e.kz }}</span>
          </div>
          <p class="note">{{ t(VORSCHLAG_GRUND[e.v.grund]) }}</p>
          <ul>
            <li v-for="z in e.zellen" :key="z.feld" :data-x="z.x || undefined">
              <span :class="{ 'wkr-x': z.x }">{{ z.label }}: {{ leer(z.wert) }}</span>
              <span v-if="z.x" class="wkr-x"> ({{ t('betrieb.wkr.eingang.x') }})</span>
            </li>
          </ul>
          <div class="row">
            <button type="button" class="btn sm primary" data-action="wkr-uebernehmen" @click="vorschlag(e.v, 'uebernehmen')">{{ t('betrieb.wkr.uebernehmen') }}</button>
            <button type="button" class="btn sm" data-action="wkr-verwerfen" @click="vorschlag(e.v, 'verwerfen')">{{ t('betrieb.wkr.verwerfen') }}</button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
