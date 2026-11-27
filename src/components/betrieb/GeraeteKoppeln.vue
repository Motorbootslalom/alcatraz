<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BereichId } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { freigabeBereiche, listenAufgaben, type Aufgabe, type ListenAufgabe } from '../../geraete/aufgaben'
import { formatiereCode, restSekunden } from '../../geraete/koppeln'
import { koppelLinkUrl, type SeitenOrt } from '../../geraete/paket'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { mmss } from '../../betrieb/prognose'
import { PAGES_URL } from '../../lib/build'
import { merke } from '../../lib/merken'
import { useUhr } from '../../lib/uhr'
import { t } from '../../i18n'
import QrCode from '../QrCode.vue'
import LeseLink from './LeseLink.vue'
import { useListenWahl } from './wkrListenWahl'
import type { ListenTeil } from '../../wkr/liste'

/**
 * Betrieb → Geräte, Koppeln (Etappe E7, Plan vom 16.11.2026 §4/§5; Vorbild tafel PairingPanel.vue, neu geschrieben):
 * Für welche Bereiche (Parcours bzw. Parallelslalom) das NÄCHSTE Gerät die Start-Freigabe bekommt, dann einer von zwei
 * Wegen:
 * - **QR-Code** (P-3): Inhalt = Koppel-Link mit Token; der Token wechselt alle 30 s (geraete/koppeln.ts), die Sitzung
 *   schließt sich nach höchstens 10 min. Das Handy koppelt sofort nach dem Scannen (GeraetFreigabe.vue).
 * - **Geräte-Code** (P-4): 6 Zeichen, 5 min, EIN Gerät. Das Handy braucht dazu den Koppel-Link – der steht hier als
 *   Link mit QR-Code zum Weitergeben; der Code geht über Funk.
 * Entschieden wird am Host (koppelEntscheid.ts): gültiger Code bzw. Token → gekoppelt, mit den Rechten, die beim
 * Ausgeben galten. Eine zusätzliche Rückfrage „annehmen?“ am Bedienrechner gibt es nicht (Auslegung 20.11.2026,
 * bestätigt 27.11.2026, R13-07 – BETRIEB_ANNAHMEN.koppelnOberflaeche): Den Code gibt nur, wer am Bedienrechner sitzt, und ein
 * fremdes Gerät stünde sofort in der Geräteliste, wo es sich entziehen lässt.
 *
 * W3.2 (21.11.2026, Plan docs/plan-wkr-w3.md §6): Die Aufgabe des nächsten Geräts ist die Start-Freigabe (Bereiche)
 * und/oder EINE WKR-Liste (J4; eine zweite gibt die Geräteliste) aus wkr/liste.ts listenDerVeranstaltung – Titel in
 * Oberflächensprache, gruppiert nach Parcours bzw. Racecourse (wkrListenWahl.ts), Listen ohne Maske in W3 mit
 * „Maske folgt – Papier“ (G14) –, am Steg ganz / nur Ablegen / nur Anlegen (F16). Gemerkt `geraete.koppeln.liste` und
 * `geraete.koppeln.teil`; vorgewählt auch über den Verweis „Gerät koppeln“ der Matrix (`#/betrieb/geraete/<liste>`,
 * BetriebView beiWahl). Die Start-Freigabe ist nie vorgewählt, auch nicht mit einem einzigen Parcours (Nutzer 21.11.2026,
 * W3-26: „ein Recht wie die Listen“ – die Vorwahl hatte verwirrt; ersetzt J3 und die E7-Vorwahl).
 *
 * Alles geht über den Host (useGeraeteHost) und damit über das Führungsfenster; hier wird nur gezeigt und gewählt. Die
 * Wahl der Bereiche ist Bedienung (lib/merken.ts), nicht Stand.
 *
 * Feldtest 21.11.2026 (Befund 6, BETRIEB_ANNAHMEN.koppelnWege): Der Koppel-Link (ohne Token) stand mit großem QR-Code
 * offen da und wurde statt des QR-Codes zum Koppeln gescannt – das Handy fragte dann nach einem Geräte-Code. Jetzt ist
 * „QR-Code zeigen“ der Hauptweg („scannen – fertig, kein Code nötig“); Geräte-Code UND Koppel-Link stehen zusammen in
 * einem zugeklappten Weg `data-teil="koppeln-weg-code"`, der sich erst beim Aufklappen oder Ausgeben eines Codes öffnet.
 */
const { state } = useStore()
const host = useGeraeteHost()
const raum = computed(() => host?.raum.value ?? null)
const jetzt = useUhr(1000)

const bereiche = computed(() => sichtOeffentlich(state.value, { logos: false }).bereiche.map((b) => ({ id: b.id, name: b.name })))
const name = (id: BereichId) => bereiche.value.find((b) => b.id === id)?.name ?? id

// WKR-Liste (W3.2): '' = keine; eine nicht (mehr) vorhandene Liste gilt als keine.
const { gruppen, liste: listeVon, listeText } = useListenWahl()
const listeWahl = merke<string>('geraete.koppeln.liste', '')
const listeTeil = merke<string>('geraete.koppeln.teil', '')
const gewaehlteListe = computed(() => (listeWahl.value ? listeVon(listeWahl.value) : undefined))
const teil = computed<ListenTeil | undefined>(() =>
  gewaehlteListe.value?.teilbar && (listeTeil.value === 'ab' || listeTeil.value === 'an') ? listeTeil.value : undefined,
)
function waehleListe(kennung: string): void {
  listeWahl.value = kennung
  listeTeil.value = ''
}

// Gemerkte Wahl, nie eine Vorwahl (Nutzer 21.11.2026, W3-26, WKR_ANNAHMEN.freigabeVorwahlOhneListe = false).
const wahl = merke<string[]>('geraete.koppeln.bereiche', [])
const gewaehlt = computed<BereichId[]>(() => {
  const da = bereiche.value.map((b) => b.id)
  return wahl.value.filter((id) => da.includes(id))
})
function schalte(id: BereichId, an: boolean): void {
  const neu = new Set(gewaehlt.value)
  if (an) neu.add(id)
  else neu.delete(id)
  wahl.value = bereiche.value.map((b) => b.id).filter((b) => neu.has(b))
}
const aufgaben = computed<Aufgabe[]>(() => {
  const aus: Aufgabe[] = []
  if (gewaehlt.value.length > 0) aus.push({ art: 'startfreigabe', bereiche: gewaehlt.value })
  if (gewaehlteListe.value) {
    const a: ListenAufgabe = { art: 'liste', liste: gewaehlteListe.value.kennung }
    if (teil.value) a.teil = teil.value
    aus.push(a)
  }
  return aus
})
const leer = computed(() => aufgaben.value.length === 0)
/** „Freigabe für: Parcours 1 · Liste: Steg (Parcours 1, nur Ablegen)“ – was das Gerät mit diesem Code bekommt. */
function fuerText(a: Aufgabe[]): string {
  const teile: string[] = []
  const frei = freigabeBereiche(a)
  if (frei.length > 0 || listenAufgaben(a).length === 0) teile.push(t('geraete.koppeln.fuer', { bereiche: frei.map(name).join(', ') || '–' }))
  for (const l of listenAufgaben(a)) teile.push(t('geraete.koppeln.fuerListe', { liste: listeText(l.liste, l.teil) }))
  return teile.join(' · ')
}

const seite: SeitenOrt = { protocol: location.protocol, origin: location.origin, pathname: location.pathname }
const koppelLink = computed(() => (raum.value ? koppelLinkUrl(raum.value.koppelLink, seite, PAGES_URL) : ''))

const code = computed(() => raum.value?.koppeln.code ?? null)
const codeRest = computed(() => (code.value ? restSekunden(code.value.bis, jetzt.value) : 0))
const qr = computed(() => raum.value?.koppeln.qr ?? null)
const qrUrl = computed(() => (qr.value ? koppelLinkUrl(qr.value.paket, seite, PAGES_URL) : ''))
// Läuft die Sitzung ab, räumt das Führungsfenster sie im nächsten Takt weg; bis dahin nicht mehr scannen lassen.
const qrOffen = computed(() => !!qr.value && restSekunden(qr.value.endet, jetzt.value) > 0)

// Weg „Geräte-Code“ (Befund 6): zugeklappt, bis jemand ihn öffnet oder ein Code ausgegeben ist. Nur Bedienung, nicht
// gemerkt: Nach dem Neuladen steht wieder der Hauptweg QR-Code vorn.
const wegCodeOffen = ref(false)
watch(code, (c) => {
  if (c) wegCodeOffen.value = true
}, { immediate: true })
</script>

<template>
  <section class="geraete-koppeln" data-teil="koppeln">
    <h3>{{ t('geraete.koppeln') }}</h3>
    <p class="note">{{ t('geraete.koppeln.hint') }}</p>

    <fieldset class="geraete-bereiche" data-teil="koppeln-bereiche">
      <legend>{{ t('geraete.koppeln.bereiche') }}</legend>
      <label v-for="b in bereiche" :key="b.id" class="geraete-bereich">
        <input type="checkbox" :data-bereich="b.id" :checked="gewaehlt.includes(b.id)" @change="schalte(b.id, ($event.target as HTMLInputElement).checked)" />
        {{ b.name }}
      </label>
    </fieldset>

    <fieldset v-if="gruppen.length > 0" class="geraete-bereiche geraete-listenwahl" data-teil="koppeln-liste">
      <legend>{{ t('geraete.koppeln.liste') }}</legend>
      <select class="input" data-feld="koppeln-liste" :aria-label="t('geraete.koppeln.liste')" :value="gewaehlteListe?.kennung ?? ''" @change="waehleListe(($event.target as HTMLSelectElement).value)">
        <option value="">{{ t('geraete.koppeln.liste.keine') }}</option>
        <optgroup v-for="g in gruppen" :key="g.name" :label="g.name">
          <option v-for="l in g.listen" :key="l.kennung" :value="l.kennung" :data-ohne-maske="l.ohneMaske ? '' : undefined">
            {{ l.ohneMaske ? t('geraete.koppeln.liste.ohneMaske', { titel: l.titel }) : l.titel }}
          </option>
        </optgroup>
      </select>
      <div v-if="gewaehlteListe?.teilbar" class="segmented" role="group" data-teil="koppeln-teil" :aria-label="t('geraete.koppeln.liste.teil')">
        <button
          v-for="w in (['', 'ab', 'an'] as const)"
          :key="w"
          type="button"
          :data-wahl-teil="w || 'ganz'"
          :class="(teil ?? '') === w ? 'active' : ''"
          :aria-pressed="(teil ?? '') === w"
          @click="listeTeil = w"
        >
          {{ t(w ? `geraete.koppeln.liste.teil.${w}` : 'geraete.koppeln.liste.teil.ganz') }}
        </button>
      </div>
      <p v-if="gewaehlteListe?.ohneMaske" class="note" data-hinweis="ohne-maske">{{ t('geraete.koppeln.liste.ohneMaske.hint') }}</p>
    </fieldset>
    <p v-if="leer" class="note" data-hinweis="bereiche-fehlen">{{ t('geraete.koppeln.bereicheFehlen') }}</p>

    <!-- Hauptweg: QR-Code mit Token – scannen, fertig. -->
    <div class="row koppel-hauptweg" data-teil="koppeln-hauptweg">
      <button type="button" class="btn primary" data-action="koppeln-qr" :disabled="leer" @click="host?.oeffneQr(aufgaben)">{{ t('geraete.koppeln.qr') }}</button>
      <span class="note">{{ t('geraete.koppeln.qr.kurz') }}</span>
    </div>

    <div v-if="qr && qrOffen" class="lese-link koppel-qr" data-teil="koppeln-qr">
      <h3>{{ t('geraete.koppeln.qr.titel') }}</h3>
      <p class="note">{{ t('geraete.koppeln.qr.hint') }}</p>
      <QrCode :inhalt="qrUrl" />
      <p class="note" data-teil="qr-zeit">
        {{ t('geraete.koppeln.qr.endet', { s: restSekunden(qr.tokenBis, jetzt), zeit: mmss(restSekunden(qr.endet, jetzt)) }) }}
      </p>
      <p class="note" data-teil="qr-fuer">{{ fuerText(qr.aufgaben) }}</p>
      <div class="row">
        <button type="button" class="btn" data-action="qr-beenden" @click="host?.beendeKoppeln('qr')">{{ t('geraete.koppeln.qr.beenden') }}</button>
      </div>
    </div>

    <!-- Zweiter Weg (über Funk): Geräte-Code + Koppel-Link – zugeklappt, damit niemand den Link statt des QR-Codes scannt. -->
    <details class="koppel-weg-code" data-teil="koppeln-weg-code" :open="wegCodeOffen" @toggle="wegCodeOffen = ($event.target as HTMLDetailsElement).open">
      <summary>{{ t('geraete.koppeln.wegCode') }}</summary>
      <p class="note">{{ t('geraete.koppeln.wegCode.hint') }}</p>
      <div class="row">
        <button type="button" class="btn" data-action="koppeln-code" :disabled="leer" @click="host?.gibCode(aufgaben)">{{ t('geraete.koppeln.code') }}</button>
      </div>
      <div class="geraete-koppel-karten">
        <div v-if="code" class="lese-link koppel-code" data-teil="koppeln-code" :data-lage="code.benutzt !== null ? 'benutzt' : codeRest > 0 ? 'gilt' : 'abgelaufen'">
          <h3>{{ t('geraete.koppeln.code.titel') }}</h3>
          <p class="note">{{ t('geraete.koppeln.code.hint') }}</p>
          <p class="koppel-code-wert" data-teil="code">{{ formatiereCode(code.wert) }}</p>
          <p class="note" data-teil="code-zeit">
            {{
              code.benutzt !== null
                ? t('geraete.koppeln.code.benutzt')
                : codeRest > 0
                  ? t('geraete.koppeln.code.gilt', { zeit: mmss(codeRest) })
                  : t('geraete.koppeln.code.abgelaufen')
            }}
          </p>
          <p class="note" data-teil="code-fuer">{{ fuerText(code.aufgaben) }}</p>
          <div class="row">
            <button v-if="code.benutzt === null && codeRest > 0" type="button" class="btn" data-action="code-beenden" @click="host?.beendeKoppeln('code')">
              {{ t('geraete.koppeln.code.beenden') }}
            </button>
          </div>
        </div>

        <LeseLink v-if="koppelLink && wegCodeOffen" art="koppeln" :url="koppelLink" />
      </div>
    </details>
  </section>
</template>
