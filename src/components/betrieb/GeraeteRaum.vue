<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../../state/store'
import { hostServer, useGeraeteHost, type RaumEnde } from '../../geraete/host'
import { leseLinkUrl, type SeitenOrt } from '../../geraete/paket'
import { verbindungsLage, type Fehlercode, type VerbindungsLage } from '../../geraete/transport/typen'
import { PAGES_URL } from '../../lib/build'
import { adresse } from '../../lib/router'
import { t } from '../../i18n'
import { fingerabdruckText } from './texte'
import AppDialog from '../AppDialog.vue'
import GeraeteLage from './GeraeteLage.vue'
import LeseLink from './LeseLink.vue'
import GeraeteKoppeln from './GeraeteKoppeln.vue'
import GeraeteListe from './GeraeteListe.vue'

/**
 * Betrieb → Geräte (Etappe E6, Plan vom 16.11.2026 §4): Gerätebetrieb bewusst einschalten (Raum öffnen), die zwei
 * Lese-Links für Anzeigetafel und Zuschauer mit QR-Code, Fingerabdruck, „Zuschauer-Link erneuern“, „Raum beenden“ und
 * die Verbindung. Die Arbeit macht geraete/host.ts (useGeraeteHost, main.ts stellt ihn bereit) – hier wird nur
 * gezeigt und gefragt.
 *
 * Bis „Gerätebetrieb einschalten“ verlässt nichts den Browser (Wurzel-CLAUDE.md, src/main.geraete.test.ts); der Text
 * davor sagt, was dann über den fremden Server geht. Ein zweites Fenster derselben Veranstaltung zeigt denselben Raum
 * und die Verbindung, die das Führungsfenster über den Fensterbus meldet; seine Knöpfe gehen als Befehl dorthin.
 * E7 (20.11.2026): darunter Koppeln (GeraeteKoppeln.vue: Bereiche, QR-Code, Geräte-Code, Koppel-Link) und die
 * Geräteliste (GeraeteListe.vue: Name, Bereiche, zuletzt gehört, Entziehen).
 */
const { state } = useStore()
const host = useGeraeteHost()

const raum = computed(() => host?.raum.value ?? null)
const fuehrt = computed(() => host?.fuehrt.value ?? false)
/** Ohne Schema und Schrägstrich: lesbar, wie man ihn eintippt. */
const ohneSchema = (server: string) => server.replace(/^https:\/\//, '')
const server = computed(() => ohneSchema(raum.value?.server ?? hostServer(state.value) ?? state.value.geraeteServer))

// Die Seite, auf der die Links landen: diese Seite – unter file:// die App auf Pages (geraete/paket.ts leseLinkUrl).
const seite: SeitenOrt = { protocol: location.protocol, origin: location.origin, pathname: location.pathname }
const alsDatei = seite.protocol !== 'https:' && seite.protocol !== 'http:'
const links = computed(() =>
  raum.value ? { anzeige: leseLinkUrl(raum.value.anzeige, seite, PAGES_URL), zuschauer: leseLinkUrl(raum.value.zuschauer, seite, PAGES_URL) } : null,
)

/** Lage der Verbindung; ein offener Raum ohne Meldung heißt: Ein Fenster verbindet gerade (oder übernimmt die Führung). */
const lage = computed<VerbindungsLage>(() => {
  const m = host?.verbindung.value
  return m ? verbindungsLage(m.status, m.fehler) : 'verbinde'
})
/** Fehler, die die Lage nicht schon sagt (gestört, Kontingent), als eigener Satz. */
const fehler = computed<Fehlercode | null>(() => {
  const code = host?.verbindung.value?.fehler?.code ?? null
  return code === 'verbindung-gestoert' || code === 'zu-viele-anfragen' ? null : code
})

const FEHLERCODES: readonly Fehlercode[] = ['browser-zu-alt', 'server-ungueltig', 'raum-fehlt', 'raum-anderer-server', 'link-ungueltig', 'verbindung-gestoert', 'zu-viele-anfragen', 'abgewiesen', 'zu-gross', 'fassung', 'ablage-voll']
const einschaltFehler = ref<Fehlercode | null>(null)
function einschalten(): void {
  if (!host) return
  einschaltFehler.value = null
  ende.value = null
  erneuert.value = false
  try {
    host.oeffne()
  } catch (e) {
    const code = e instanceof Error ? (e.message as Fehlercode) : null
    einschaltFehler.value = code && FEHLERCODES.includes(code) ? code : 'server-ungueltig'
  }
}

const frageErneuern = ref(false)
const erneuert = ref(false)
function erneuern(): void {
  frageErneuern.value = false
  host?.erneuereZuschauer()
  erneuert.value = true
}

const frageBeenden = ref(false)
const beendet = ref(false)
const ende = ref<RaumEnde | null>(null)
async function beenden(): Promise<void> {
  frageBeenden.value = false
  if (!host || beendet.value) return
  beendet.value = true
  erneuert.value = false
  try {
    ende.value = await host.beende()
  } finally {
    beendet.value = false
  }
}
</script>

<template>
  <div class="panel geraete-raum" data-teil="geraete">
    <p v-if="!host" class="note" data-hinweis="geraete-nicht-verfuegbar">{{ t('geraete.nichtVerfuegbar') }}</p>

    <template v-else-if="!raum">
      <p class="geraete-aus" data-teil="geraete-aus"><b>{{ t('geraete.aus') }}</b></p>
      <p v-if="ende" class="boat-banner ok" role="status" data-teil="geraete-ende" :data-ende="ende">
        {{ t(ende === 'gemeldet' ? 'geraete.beendet.gemeldet' : 'geraete.beendet.ohneMeldung') }}
      </p>
      <p class="hint" data-hinweis="geraete-daten">{{ t('geraete.wasGeht', { server }) }}</p>
      <p class="note">
        {{ t('geraete.server', { server }) }} ·
        <a :href="adresse('einstellungen', { ziel: 'geraete' })" data-verweis="geraete-server">{{ t('geraete.server.einstellen') }}</a>
      </p>
      <div class="row" style="align-items: center; gap: 12px">
        <button type="button" class="btn primary" data-action="geraete-einschalten" @click="einschalten">{{ t('geraete.einschalten') }}</button>
        <span class="note" style="flex: 1; min-width: 240px">{{ t('geraete.einschalten.hint') }}</span>
      </div>
      <p v-if="einschaltFehler" class="boat-banner warn" role="alert" data-teil="geraete-fehler" :data-fehler="einschaltFehler">
        {{ t(`geraete.fehler.${einschaltFehler}`) }}
      </p>
    </template>

    <template v-else>
      <div class="geraete-zeilen">
        <p class="geraete-zeile" data-teil="verbindung" :data-lage="lage">
          <b>{{ t('geraete.verbindung') }}:</b> <GeraeteLage :lage="lage" />
          <span class="note">{{ t('geraete.server', { server }) }}</span>
        </p>
        <p v-if="fehler" class="boat-banner warn" role="alert" data-teil="verbindung-fehler" :data-fehler="fehler">
          {{ t(`geraete.fehler.${fehler}`) }}
          <a v-if="fehler === 'raum-anderer-server' || fehler === 'server-ungueltig'" :href="adresse('einstellungen', { ziel: 'geraete' })">{{ t('geraete.server.einstellen') }}</a>
        </p>
        <p v-if="!fuehrt" class="note" data-hinweis="anderes-fenster">{{ t('geraete.anderesFenster') }}</p>
        <p class="geraete-zeile">
          <b>{{ t('geraete.fingerabdruck') }}:</b> <code class="geraete-fingerabdruck" data-teil="fingerabdruck">{{ fingerabdruckText(raum.fingerabdruck) }}</code>
          <span class="note">{{ t('geraete.fingerabdruck.hint') }}</span>
        </p>
        <p v-if="alsDatei" class="note" data-hinweis="links-pages">{{ t('geraete.link.pages', { pages: PAGES_URL }) }}</p>
      </div>

      <div v-if="links" class="lese-links">
        <LeseLink art="anzeige" :url="links.anzeige" />
        <LeseLink art="zuschauer" :url="links.zuschauer">
          <button type="button" class="btn" data-action="zuschauer-erneuern" @click="frageErneuern = true">{{ t('geraete.zuschauerErneuern') }}</button>
        </LeseLink>
      </div>
      <p v-if="erneuert" class="boat-banner ok" role="status" data-teil="zuschauer-erneuert">{{ t('geraete.zuschauerErneuert') }}</p>

      <GeraeteKoppeln />
      <GeraeteListe />

      <div class="row" style="margin-top: 14px">
        <button type="button" class="btn danger" data-action="raum-beenden" :disabled="beendet" @click="frageBeenden = true">
          {{ beendet ? t('geraete.beenden.laeuft') : t('geraete.beenden') }}
        </button>
      </div>
    </template>

    <AppDialog v-if="frageErneuern" :titel="t('geraete.zuschauerErneuern.frage')" data-dialog="zuschauer-erneuern" @abbrechen="frageErneuern = false">
      <p>{{ t('geraete.zuschauerErneuern.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="erneuern-ja" @click="erneuern">{{ t('geraete.zuschauerErneuern.ja') }}</button>
        <button type="button" class="btn" data-action="erneuern-nein" autofocus @click="frageErneuern = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
    <AppDialog v-if="frageBeenden" :titel="t('geraete.beenden.frage')" data-dialog="raum-beenden" @abbrechen="frageBeenden = false">
      <p>{{ t('geraete.beenden.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="beenden-ja" @click="beenden">{{ t('geraete.beenden.ja') }}</button>
        <button type="button" class="btn" data-action="beenden-nein" autofocus @click="frageBeenden = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
