<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KeineZeitGrund, OeffentlicheSicht } from '../../types'
import { useStore } from '../../state/store'
import { useKonfig } from '../../lib/konfig'
import { merke } from '../../lib/merken'
import { adresse } from '../../lib/router'
import { useUhr } from '../../lib/uhr'
import { listenFelder, werteVon } from '../../lib/eingaben'
import { liesRef } from '../../betrieb/folge'
import { erfassungsLage, tischLage, type Ampel, type ListenGeraet, type ListenLage, type Zelle } from '../../wkr/lage'
import { liesListe, startAufListe } from '../../wkr/liste'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { useGeraeteHost } from '../../geraete/host'
import { geraetAngaben } from '../../geraete/register'
import { herkunftGilt } from '../../geraete/wkrEingang'
import { t, tn } from '../../i18n'
import WkrListeBedienung from './WkrListeBedienung.vue'
import { punktText, punktVon, uhrzeitText } from './texte'

/**
 * Betrieb → WKR (W2.2, Plan docs/plan-wkr-w2.md §6.1, 21.11.2026): die Matrix Listen × Starts eines Bereichs mit den
 * zwei Ampeln – „Gerät gehört?“ (Gerätespalte) und „Zeile da?“ (Zellen) – und je Liste ihr Stand und die Bedienung
 * (WkrListeBedienung.vue, aufklappbar). Gerechnet wird alles in wkr/lage.ts (EINE Stelle für Matrix, Geräteleiste,
 * Warnung, Erfassung); hier nur Zeichen, Wahl und Klicks. Am Bedienrechner – liest den Store und, wenn es ihn gibt,
 * den Host (Register für die Ampel, Herkunft ◆ für die Karte einer Zelle). Ohne Raum steht die Matrix trotzdem: Sie
 * zeigt beim Abtippen die Lücken; die Gerätespalte ist dann leer („—“), Listen ohne Eintrag sind Papier (▭).
 *
 * W3.2 (21.11.2026): Eine Liste ohne Gerät trägt den Verweis „Gerät koppeln“ → Betrieb → Geräte mit dieser Liste
 * vorgewählt (`#/betrieb/geraete/<liste>`, BetriebView beiWahl → merke `geraete.koppeln.liste`; J5: immer, auch ohne Raum).
 *
 * W5.3 (22.11.2026, WKR_ANNAHMEN KN4): Unter der Matrix ein eigener Block „Am Tisch“ für die Listen ohne Lauf (Knoten):
 * je Liste Gerät, „Knoten: 14 / 38 offen“ (wkr/lage.ts tischLage) und dieselbe Bedienung – nie Spalten, nie
 * Rückstand, nie eine Warnung; er steht auch ohne Bereich des Betriebs (Knoten oft vor der Verzahnung).
 *
 * Die Uhr (Ampel, „vor 2 min“) tickt alle 5 s und nur in diesem Zweig. Bedienauswahl (Bereich, alle Starts,
 * aufgeklappte Bedienung) über lib/merken.ts `betrieb.wkr.*`, nie im Stand.
 */
const props = defineProps<{ sicht: OeffentlicheSicht }>()
const emit = defineEmits<{ geraete: []; eingang: [] }>()

const { state } = useStore()
const konfig = useKonfig({ oberflaeche: true })
const host = useGeraeteHost()
const jetzt = useUhr(5000)

const bereich = merke('betrieb.wkr.bereich', '')
const alle = merke('betrieb.wkr.alle', false)
const offen = merke('betrieb.wkr.bedienung', '')

const bereiche = computed(() => props.sicht.bereiche)
const gewaehlt = computed(() => bereiche.value.find((b) => b.id === bereich.value) ?? bereiche.value[0] ?? null)
const geraete = computed(() => geraetAngaben(host?.raum.value?.geraete ?? []))
const mitRaum = computed(() => !!host?.raum.value)

const lage = computed(() => (gewaehlt.value ? erfassungsLage(state.value, konfig.value, gewaehlt.value.id, geraete.value, jetzt.value, alle.value ? 'alle' : 'punkt') : null))
const tisch = computed(() => tischLage(state.value, konfig.value, geraete.value, jetzt.value))

const punkt = computed(() => {
  const p = lage.value?.punkt
  const b = gewaehlt.value
  return p && b ? punktVon(b, p) : null
})
/** Startnummer(n) im Boot – wenn der Start eine Spalte ist. */
const imBoot = computed(() => {
  const key = gewaehlt.value?.aktuell?.key
  return key ? (lage.value?.starts.find((s) => s.key === key)?.nummern.join('/') ?? null) : null
})

const ZEICHEN: Record<Zelle, string> = { ok: '✓', halb: '½', offen: '○', ueberfaellig: '○!', rueckfrage: '!', vorschlag: 'V', entfaellt: '–', papier: 'P', x: '✕', vorab: '»', spaeter: '…' }
const ZELLEN = Object.keys(ZEICHEN) as Zelle[]
const AMPEL: Record<Ampel, string> = { gehoert: '●', still: '◐', weg: '✕', ruht: '○' }

/** Verweis „Gerät koppeln“ mit vorgewählter Liste (W3.2). */
const koppelnAdresse = (liste: string) => adresse('betrieb', { reiter: 'geraete', wahl: liste })

function seitText(ms: number): string {
  return ms < 60_000 ? t('betrieb.wkr.vorSek', { n: Math.floor(ms / 1000) }) : t('betrieb.wkr.vorMin', { n: Math.floor(ms / 60_000) })
}

function titelVon(l: ListenLage): string {
  return l.racecourse ? `${l.titel} ${l.racecourse}` : l.titel
}

function geraetTitel(g: ListenGeraet): string {
  const teil = g.teil ? ` (${t(`betrieb.wkr.teil.${g.teil}`)})` : ''
  const akku = g.akku !== undefined ? ` · ${t('betrieb.wkr.akku', { n: g.akku })}` : ''
  return t('betrieb.wkr.geraet.title', { name: g.name + teil, ampel: t(`betrieb.wkr.ampel.${g.ampel}`), seit: seitText(g.seitMs) }) + akku
}

/** Der Stand einer Liste als kurze Sätze (Spalte „Stand“). */
function standTeile(l: ListenLage): string[] {
  if (l.modus === null || l.modus === 'papier') return [t('betrieb.wkr.stand.papier')]
  const out: string[] = []
  if (l.papierAb) out.push(t('betrieb.wkr.stand.papierAb', { nr: l.papierAb }))
  else if (l.status !== 'aktiv') out.push(t(`betrieb.wkr.stand.${l.status}`))
  for (const teil of ['ab', 'an'] as const) {
    const s = l.teile?.[teil]?.status
    if (s && s !== 'aktiv') out.push(`${t(`betrieb.wkr.teil.${teil}`)}: ${t(`betrieb.wkr.stand.${s}`)}`)
  }
  out.push(l.rueckstand ? t('betrieb.wkr.stand.offen', { n: l.rueckstand.zahl, von: l.rueckstand.von, bis: l.rueckstand.bis }) : t('betrieb.wkr.stand.nichtsOffen'))
  const wartend = l.geraete.reduce((s, g) => s + (g.wartend ?? 0), 0)
  if (wartend > 0) out.push(tn('betrieb.wkr.stand.wartend', wartend))
  if (l.rueckfragen > 0) out.push(tn('betrieb.wkr.stand.rueckfragen', l.rueckfragen))
  if (l.vorschlaege > 0) out.push(tn('betrieb.wkr.stand.vorschlaege', l.vorschlaege))
  return out
}

function zellTitel(z: { zelle: Zelle; teile?: { ab: Zelle; an: Zelle }; keineZeit?: Record<string, KeineZeitGrund> }): string {
  // „Keine Zeit“ (W5.4): die Gründe hinter dem Stand, ohne Feldnamen (die nennt die Karte der Zelle).
  const kz = z.keineZeit ? ` – ${t('betrieb.wkr.zelle.keineZeit')}: ${[...new Set(Object.values(z.keineZeit))].map((g) => t(`wkr.geraet.keineZeit.grund.${g}`)).join(', ')}` : ''
  const grund = t(`betrieb.wkr.zelle.${z.zelle}`) + kz
  if (!z.teile) return grund
  return `${grund} – ${t('betrieb.wkr.teil.ab')}: ${t(`betrieb.wkr.zelle.${z.teile.ab}`)}, ${t('betrieb.wkr.teil.an')}: ${t(`betrieb.wkr.zelle.${z.teile.an}`)}`
}

function schalteBedienung(liste: string): void {
  offen.value = offen.value === liste ? '' : liste
}

// --- Karte einer Zelle: die Werte der Zeile in Oberflächensprache, ◆ mit Gerät und Uhrzeit ---
const karte = ref<{ liste: string; key: string } | null>(null)
watch(gewaehlt, () => (karte.value = null))

const karteInhalt = computed(() => {
  const k = karte.value
  if (!k) return null
  const liste = liesListe(k.liste)
  const ref = liesRef(k.key)
  const l = lage.value?.listen.find((x) => x.liste === k.liste)
  if (!liste || !ref || !l) return null
  const start = startAufListe(state.value, konfig.value, liste, ref)
  if (!start) return null
  const werte = werteVon(state.value.eingaben, start.lauf, start.starter.id)
  const herkunft = host?.herkunft.value
  // „Keine Zeit“ (W5.4, ZT4): das Feld steht mit Grund statt Wert in der Karte.
  const kz = l.zellen[k.key]?.keineZeit ?? {}
  const felder = listenFelder(konfig.value, liste.typeId, start.starter.klasse)
    .filter((f) => (werte[f.kennung] ?? '') !== '' || !!kz[f.kennung])
    .map((f) => {
      const h = herkunft ? herkunftGilt(herkunft, state.value.eingaben, start.lauf, start.starter.id, f.kennung) : null
      const wert = werte[f.kennung] || `${t('betrieb.wkr.zelle.keineZeit')} (${t(`wkr.geraet.keineZeit.grund.${kz[f.kennung]}`)})`
      return { kennung: f.kennung, label: f.label, wert, herkunft: h ? t('betrieb.wkr.karte.herkunft', { geraet: h.g, zeit: uhrzeitText(h.z, jetzt.value) }) : null }
    })
  return { titel: t('betrieb.wkr.karte.titel', { nr: start.starter.startNr, liste: titelVon(l) }), felder, rueckfrage: l.zellen[k.key]?.zelle === 'rueckfrage' }
})

function zumEingang(): void {
  karte.value = null
  emit('eingang')
}
</script>

<template>
  <section class="panel wkr-matrix" data-teil="wkr-matrix">
    <div class="row wkr-matrix-kopf">
      <div v-if="bereiche.length > 1" class="segmented" role="group" :aria-label="t('betrieb.reiter.wkr')">
        <button
          v-for="b in bereiche"
          :key="b.id"
          type="button"
          :data-bereich="b.id"
          :class="gewaehlt?.id === b.id ? 'active' : ''"
          :aria-pressed="gewaehlt?.id === b.id"
          @click="bereich = b.id"
        >
          {{ b.name }}
        </button>
      </div>
      <span v-if="punkt" class="note" data-teil="wkr-punkt">{{ imBoot ? t('betrieb.wkr.punkt', { punkt: punktText(punkt), nr: imBoot }) : punktText(punkt) }}</span>
      <div class="segmented wkr-starts" role="group">
        <button type="button" data-action="wkr-starts-punkt" :class="!alle ? 'active' : ''" :aria-pressed="!alle" @click="alle = false">{{ t('betrieb.wkr.starts.punkt', { n: WKR_ANNAHMEN.matrixStarts }) }}</button>
        <button type="button" data-action="wkr-starts-alle" :class="alle ? 'active' : ''" :aria-pressed="alle" @click="alle = true">{{ t('betrieb.wkr.starts.alle') }}</button>
      </div>
    </div>
    <p v-if="!mitRaum" class="note" data-hinweis="wkr-ohne-raum">{{ t('betrieb.wkr.ohneRaum') }}</p>

    <template v-if="lage">
      <p v-if="lage.starts.length === 0" class="note" data-hinweis="wkr-kein-start">{{ t('betrieb.wkr.keinStart') }}</p>
      <div class="wkr-matrix-rahmen">
        <table class="wkr-mtabelle">
          <thead>
            <tr>
              <th scope="col">{{ t('betrieb.wkr.spalte.liste') }}</th>
              <th scope="col">{{ t('betrieb.wkr.spalte.geraet') }}</th>
              <th
                v-for="s in lage.starts"
                :key="s.key"
                scope="col"
                class="wkr-start"
                :class="{ vorab: s.vorab, aktuell: s.key === gewaehlt?.aktuell?.key }"
                :data-start="s.key"
                :title="s.vorab ? t('betrieb.wkr.spalte.vorab') : undefined"
              >
                {{ s.nummern.join('/') }}
              </th>
              <th scope="col">{{ t('betrieb.wkr.spalte.stand') }}</th>
              <th scope="col"><span class="sr-only">{{ t('betrieb.wkr.bedienung') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="l in lage.listen" :key="l.liste">
              <tr :data-liste="l.liste" :data-modus="l.modus ?? 'papier'" :class="{ warnt: l.warnt }">
                <th scope="row" class="wkr-liste">{{ titelVon(l) }}</th>
                <td class="wkr-geraete">
                  <button
                    v-for="g in l.geraete"
                    :key="g.id"
                    type="button"
                    class="wkr-mgeraet"
                    :data-geraet="g.id"
                    :data-ampel="g.ampel"
                    :title="geraetTitel(g)"
                    @click="emit('geraete')"
                  >
                    <span class="wkr-ampel" aria-hidden="true">{{ AMPEL[g.ampel] }}</span>
                    {{ g.name }}<template v-if="g.teil"> ({{ t(`betrieb.wkr.teil.${g.teil}`) }})</template>
                    <span class="note">· {{ seitText(g.seitMs) }}</span>
                  </button>
                  <span v-if="l.geraete.length === 0 && (l.modus === null || l.modus === 'papier')" class="note" data-teil="papier-liste">▭ {{ t('betrieb.wkr.papierListe') }}</span>
                  <span v-else-if="l.geraete.length === 0" class="note">{{ t('betrieb.wkr.keinGeraet') }}</span>
                  <a v-if="l.geraete.length === 0" class="wkr-koppeln" data-action="wkr-koppeln" :href="koppelnAdresse(l.liste)">{{ t('betrieb.wkr.koppeln') }}</a>
                </td>
                <td v-for="s in lage.starts" :key="s.key" class="wkr-mzelle-td">
                  <button
                    v-if="l.zellen[s.key]"
                    type="button"
                    class="wkr-mzelle"
                    :data-zelle="l.zellen[s.key].zelle"
                    :data-start="s.key"
                    :title="zellTitel(l.zellen[s.key])"
                    @click="karte = { liste: l.liste, key: s.key }"
                  >
                    {{ ZEICHEN[l.zellen[s.key].zelle] }}
                    <!-- ✓ mit Disq.-Marke (seit W3-17, 21.11.2026); ein X zeigt die Zelle als ✕ (24.11.2026, NG4). -->
                    <span v-if="l.zellen[s.key].disq" class="wkr-mzelle-wort" data-teil="mzelle-disq">{{ t('betrieb.wkr.zelle.disq', { disq: l.zellen[s.key].disq! }) }}</span>
                    <!-- W5.4 (22.11.2026, ZT4): ✓ mit „keine Zeit“ – der Grund steht im Titel, auf dem Bogen nachsehen. -->
                    <span v-if="l.zellen[s.key].keineZeit" class="wkr-mzelle-wort" data-teil="mzelle-keine-zeit">{{ t('betrieb.wkr.zelle.keineZeit') }}</span>
                  </button>
                </td>
                <td class="wkr-stand" data-teil="wkr-stand">
                  <span v-if="l.warnt" class="wkr-warnt-text" data-teil="wkr-warnt">{{ t('betrieb.wkr.stand.warnt') }}:</span>
                  {{ standTeile(l).join(' · ') }}
                </td>
                <td>
                  <button type="button" class="btn sm" data-action="wkr-bedienung" :aria-expanded="offen === l.liste" @click="schalteBedienung(l.liste)">
                    {{ t('betrieb.wkr.bedienung') }}
                  </button>
                </td>
              </tr>
              <tr v-if="offen === l.liste" class="wkr-bedienung-zeile">
                <td :colspan="lage.starts.length + 4">
                  <WkrListeBedienung :lage="l" :starts="lage.starts" :bereich="gewaehlt!" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="karteInhalt" class="wkr-karte" data-teil="wkr-karte" role="region" :aria-label="karteInhalt.titel">
        <h3>{{ karteInhalt.titel }}</h3>
        <p v-if="karteInhalt.felder.length === 0" class="note">{{ t('betrieb.wkr.karte.keine') }}</p>
        <dl v-else class="wkr-karte-werte">
          <template v-for="f in karteInhalt.felder" :key="f.kennung">
            <dt>{{ f.label }}</dt>
            <dd :data-feld="f.kennung">
              {{ f.wert }}
              <span v-if="f.herkunft" class="wkr-raute" data-teil="herkunft" :title="f.herkunft">◆</span>
            </dd>
          </template>
        </dl>
        <div class="row">
          <button v-if="karteInhalt.rueckfrage" type="button" class="btn primary sm" data-action="wkr-zum-eingang" @click="zumEingang">{{ t('betrieb.wkr.karte.zumEingang') }}</button>
          <button type="button" class="btn sm" data-action="wkr-karte-zu" @click="karte = null">{{ t('betrieb.wkr.karte.schliessen') }}</button>
        </div>
      </div>

      <details class="wkr-legende" data-teil="wkr-legende">
        <summary>{{ t('betrieb.wkr.legende') }}</summary>
        <ul>
          <li v-for="z in ZELLEN" :key="z"><span class="wkr-mzelle" :data-zelle="z">{{ ZEICHEN[z] }}</span> {{ t(`betrieb.wkr.zelle.${z}`) }}</li>
          <li v-for="a in (Object.keys(AMPEL) as Ampel[])" :key="a"><span class="wkr-ampel" :data-ampel="a">{{ AMPEL[a] }}</span> {{ t(`betrieb.wkr.ampel.${a}`) }}</li>
        </ul>
      </details>
    </template>

    <!-- W5.3 (KN4): Listen ohne Lauf (Knoten) – eigener Block, ohne Spalten, ohne Rückstand. -->
    <div v-if="tisch.length" class="wkr-tisch" data-teil="wkr-tisch">
      <h3>{{ t('betrieb.wkr.tisch.titel') }}</h3>
      <table class="wkr-mtabelle">
        <tbody>
          <template v-for="l in tisch" :key="l.liste">
            <tr :data-liste="l.liste" :data-modus="l.modus ?? 'papier'">
              <th scope="row" class="wkr-liste">{{ l.titel }}</th>
              <td class="wkr-geraete">
                <button v-for="g in l.geraete" :key="g.id" type="button" class="wkr-mgeraet" :data-geraet="g.id" :data-ampel="g.ampel" :title="geraetTitel(g)" @click="emit('geraete')">
                  <span class="wkr-ampel" aria-hidden="true">{{ AMPEL[g.ampel] }}</span>
                  {{ g.name }}
                  <span class="note">· {{ seitText(g.seitMs) }}</span>
                </button>
                <span v-if="l.geraete.length === 0 && (l.modus === null || l.modus === 'papier')" class="note" data-teil="papier-liste">▭ {{ t('betrieb.wkr.papierListe') }}</span>
                <span v-else-if="l.geraete.length === 0" class="note">{{ t('betrieb.wkr.keinGeraet') }}</span>
                <a v-if="l.geraete.length === 0" class="wkr-koppeln" data-action="wkr-koppeln" :href="koppelnAdresse(l.liste)">{{ t('betrieb.wkr.koppeln') }}</a>
              </td>
              <td class="wkr-stand" data-teil="wkr-tisch-offen" :title="l.knoten.nummern.join(', ')">
                {{ t('betrieb.wkr.tisch.offen', { liste: l.titel, n: l.knoten.offen, m: l.knoten.gesamt }) }}
                <template v-if="l.rueckfragen > 0"> · {{ tn('betrieb.wkr.stand.rueckfragen', l.rueckfragen) }}</template>
                <template v-if="l.vorschlaege > 0"> · {{ tn('betrieb.wkr.stand.vorschlaege', l.vorschlaege) }}</template>
              </td>
              <td>
                <button type="button" class="btn sm" data-action="wkr-bedienung" :aria-expanded="offen === l.liste" @click="schalteBedienung(l.liste)">
                  {{ t('betrieb.wkr.bedienung') }}
                </button>
              </td>
            </tr>
            <tr v-if="offen === l.liste" class="wkr-bedienung-zeile">
              <td colspan="4">
                <WkrListeBedienung :lage="l" :starts="[]" :bereich="null" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
