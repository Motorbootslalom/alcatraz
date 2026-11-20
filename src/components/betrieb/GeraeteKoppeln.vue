<script setup lang="ts">
import { computed } from 'vue'
import type { BereichId } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { freigabeBereiche, type Aufgabe } from '../../geraete/aufgaben'
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

/**
 * Betrieb → Geräte, Koppeln (Etappe E7, Plan vom 16.11.2026 §4/§5; Vorbild tafel PairingPanel.vue, neu geschrieben):
 * Für welche Bereiche (Parcours bzw. Parallelslalom) das NÄCHSTE Gerät die Start-Freigabe bekommt, dann einer von zwei
 * Wegen:
 * - **QR-Code** (P-3): Inhalt = Koppel-Link mit Token; der Token wechselt alle 30 s (geraete/koppeln.ts), die Sitzung
 *   schließt sich nach höchstens 10 min. Das Handy koppelt sofort nach dem Scannen (GeraetFreigabe.vue).
 * - **Geräte-Code** (P-4): 6 Zeichen, 5 min, EIN Gerät. Das Handy braucht dazu den Koppel-Link – der steht hier als
 *   Link mit QR-Code zum Weitergeben; der Code geht über Funk.
 * Entschieden wird am Host (koppelEntscheid.ts): gültiger Code bzw. Token → gekoppelt, mit den Rechten, die beim
 * Ausgeben galten. Eine zusätzliche Rückfrage „annehmen?“ am Bedienrechner gibt es nicht (Auslegung 20.11.2026, vom
 * Nutzer zu bestätigen – BETRIEB_ANNAHMEN.koppelnOberflaeche): Den Code gibt nur, wer am Bedienrechner sitzt, und ein
 * fremdes Gerät stünde sofort in der Geräteliste, wo es sich entziehen lässt.
 *
 * Alles geht über den Host (useGeraeteHost) und damit über das Führungsfenster; hier wird nur gezeigt und gewählt. Die
 * Wahl der Bereiche ist Bedienung (lib/merken.ts), nicht Stand.
 */
const { state } = useStore()
const host = useGeraeteHost()
const raum = computed(() => host?.raum.value ?? null)
const jetzt = useUhr(1000)

const bereiche = computed(() => sichtOeffentlich(state.value, { logos: false }).bereiche.map((b) => ({ id: b.id, name: b.name })))
const name = (id: BereichId) => bereiche.value.find((b) => b.id === id)?.name ?? id

// Gemerkte Wahl; ein einziger Bereich gilt ohne Wahl (der häufige Fall: ein Parcours).
const wahl = merke<string[]>('geraete.koppeln.bereiche', [])
const gewaehlt = computed<BereichId[]>(() => {
  const da = bereiche.value.map((b) => b.id)
  const w = wahl.value.filter((id) => da.includes(id))
  return w.length === 0 && da.length === 1 ? da : w
})
function schalte(id: BereichId, an: boolean): void {
  const neu = new Set(gewaehlt.value)
  if (an) neu.add(id)
  else neu.delete(id)
  wahl.value = bereiche.value.map((b) => b.id).filter((b) => neu.has(b))
}
const aufgaben = computed<Aufgabe[]>(() => [{ art: 'startfreigabe', bereiche: gewaehlt.value }])
const fuerText = (a: Aufgabe[]) => t('geraete.koppeln.fuer', { bereiche: freigabeBereiche(a).map(name).join(', ') || '–' })

const seite: SeitenOrt = { protocol: location.protocol, origin: location.origin, pathname: location.pathname }
const koppelLink = computed(() => (raum.value ? koppelLinkUrl(raum.value.koppelLink, seite, PAGES_URL) : ''))

const code = computed(() => raum.value?.koppeln.code ?? null)
const codeRest = computed(() => (code.value ? restSekunden(code.value.bis, jetzt.value) : 0))
const qr = computed(() => raum.value?.koppeln.qr ?? null)
const qrUrl = computed(() => (qr.value ? koppelLinkUrl(qr.value.paket, seite, PAGES_URL) : ''))
// Läuft die Sitzung ab, räumt das Führungsfenster sie im nächsten Takt weg; bis dahin nicht mehr scannen lassen.
const qrOffen = computed(() => !!qr.value && restSekunden(qr.value.endet, jetzt.value) > 0)
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
    <p v-if="gewaehlt.length === 0" class="note" data-hinweis="bereiche-fehlen">{{ t('geraete.koppeln.bereicheFehlen') }}</p>

    <div class="row">
      <button type="button" class="btn primary" data-action="koppeln-qr" :disabled="gewaehlt.length === 0" @click="host?.oeffneQr(aufgaben)">{{ t('geraete.koppeln.qr') }}</button>
      <button type="button" class="btn" data-action="koppeln-code" :disabled="gewaehlt.length === 0" @click="host?.gibCode(aufgaben)">{{ t('geraete.koppeln.code') }}</button>
    </div>

    <div class="geraete-koppel-karten">
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

      <LeseLink v-if="koppelLink" art="koppeln" :url="koppelLink" />
    </div>
  </section>
</template>
