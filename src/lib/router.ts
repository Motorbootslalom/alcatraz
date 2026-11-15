import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { locale, type Locale } from '../i18n'
import { adressbuch, ADRESSEN, liesAdresse, schreibeAdresse, VIEWS, type AdressTabelle, type Ort, type ReiterNamen, type ReiterView, type Sprungziel, type ViewName } from './adressen'

/**
 * Winziger Hash-Router. Bewusst kein vue-router: Der Hash funktioniert auch
 * dann, wenn die Anwendung als einzelne Datei von `file://` geöffnet wird –
 * dort gibt es keine History-API-Pfade. Deshalb wird hier auch nur der Hash
 * verändert (`location.hash`, `location.replace('#…')`), nie der Pfad.
 *
 * Die Adresse steht in der Sprache der Oberfläche (`#/lists/race-officials`), gelesen wird jede
 * Sprache (lib/adressen.ts). Die Namen im Code bleiben die internen, deutschen.
 */
export { VIEWS }
export type { ViewName, Sprungziel }

// Jede Sprache der Oberfläche braucht ihre Tabelle – fehlt eine, schlägt der Typecheck hier fehl.
const TABELLEN: Record<Locale, AdressTabelle> = ADRESSEN
const BUCH = adressbuch(TABELLEN)

/** Die Adresse des Fensters in ihren Teilen (interne Namen). */
export function ort(hash: string = location.hash): Ort {
  return liesAdresse(BUCH, hash)
}

function parse(hash: string): ViewName {
  return ort(hash).view ?? 'veranstaltung'
}

/**
 * Der Verweis auf eine Ansicht in der Sprache der Oberfläche – für `href` und `navigate`.
 * Liest `locale`: In einer Vorlage folgt der Verweis dem Sprachwechsel von selbst.
 */
export function adresse<V extends ViewName>(view: V, teile: { reiter?: V extends ReiterView ? ReiterNamen[V] : never; ziel?: Sprungziel } = {}): string {
  return schreibeAdresse(BUCH, locale.value, view, teile)
}

export function navigate(view: ViewName): void {
  location.hash = adresse(view)
}

/** Dieselbe Adresse, wie die Sprache der Oberfläche sie schreibt; `undefined`, wenn sie keine bekannte Ansicht nennt. */
function inSprache(hash: string): string | undefined {
  const o = ort(hash)
  return o.view ? schreibeAdresse(BUCH, locale.value, o.view, o) : undefined
}

/**
 * Die Art eines alten Verweises (`#/listen/verzahnt` → Reiter „Starterlisten“, Art „verzahnt“),
 * die beim Umschreiben der Adresse verloren ginge: Die Adresse wird hier umgeschrieben, bevor
 * die Ansicht sie liest (`useRoute` läuft vor `useReiter`). `useReiter` holt sie hier ab.
 */
let alteArt: { view: ViewName; art: string } | undefined

/** Schreibt die Adresse in die Sprache der Oberfläche um – ohne Schritt im Verlauf. */
function schreibeUm(): void {
  const o = ort()
  if (o.view && o.art) alteArt = { view: o.view, art: o.art }
  const ziel = inSprache(location.hash)
  if (ziel && ziel !== location.hash) location.replace(ziel)
}

export function useRoute(): Ref<ViewName> {
  const view = ref<ViewName>(parse(location.hash))
  const onChange = () => {
    view.value = parse(location.hash)
    // Ein Verweis in einer anderen Sprache (weitergegeben, altes Lesezeichen) geht auf und
    // steht danach in der Sprache der Oberfläche da.
    schreibeUm()
  }
  onChange()
  window.addEventListener('hashchange', onChange)
  // Beim Sprachwechsel folgt die Adresse sofort.
  const ende = watch(locale, schreibeUm, { flush: 'sync' })
  onUnmounted(() => {
    window.removeEventListener('hashchange', onChange)
    ende()
  })
  return view
}

/** Das Sprungziel der Adresse (`#/einstellungen?wertung` → `wertung`), sonst leer. */
export function sprungziel(): string {
  return ort().ziel
}

/**
 * Hält den gewählten Reiter einer Ansicht in der Adresse (`#/listen/wkr`). Die Adresse
 * übersteht, was das Gedächtnis des Fensters (lib/merken.ts) nicht übersteht: das Neuladen –
 * auch das selbsttätige nach einer neuen Fassung – und das Weitergeben als Verweis.
 *
 * Steht ein gültiger Reiter in der Adresse, gilt er. Sonst (Klick auf „Listen“ im Kopf) gilt
 * der gemerkte und wird in die Adresse nachgetragen, ohne einen Schritt im Verlauf zu
 * hinterlassen. Ein Klick auf einen Reiter ist dagegen ein Schritt: „Zurück“ führt zum vorigen.
 */
export function useReiter<V extends ReiterView, T extends ReiterNamen[V]>(
  view: V,
  wahl: Ref<T>,
  gueltig: MaybeRefOrGetter<readonly T[]>,
  /**
   * Ein alter Verweis, der heute eine Auswahl INNERHALB eines Reiters meint (`#/listen/verzahnt`
   * → Reiter „Starterlisten“, Art „verzahnt“; lib/adressen.ts `ALTE_ADRESSEN`): Die Ansicht
   * bekommt die Art, bevor die Adresse auf das heutige Wort umgeschrieben wird.
   */
  beiAlterArt?: (art: string) => void,
): void {
  const hier = () => ort().view === view
  const schreibe = (ersetzen: boolean) => {
    // Ein Verweis mit Sprungziel (`…?wertung`) bleibt, wie er ist.
    if (!hier() || location.hash.includes('?')) return
    const ziel = schreibeAdresse(BUCH, locale.value, view, { reiter: wahl.value })
    if (location.hash === ziel) return
    if (ersetzen) location.replace(ziel)
    else location.hash = ziel
  }
  const lies = () => {
    if (!hier()) return
    const o = ort()
    const r = o.reiter
    // Die Art eines alten Verweises: aus der Adresse – oder gemerkt, wenn `useRoute` sie schon umgeschrieben hat.
    const art = o.art ?? (alteArt?.view === view ? alteArt.art : undefined)
    alteArt = undefined
    if ((toValue(gueltig) as readonly string[]).includes(r)) {
      wahl.value = r as T
      if (art) beiAlterArt?.(art)
    }
    // Fehlt der Reiter, ist er unbekannt oder in einer anderen Sprache geschrieben: nachtragen
    // (ohne Schritt im Verlauf).
    schreibe(true)
  }
  lies()
  watch(wahl, () => schreibe(false))
  window.addEventListener('hashchange', lies)
  onUnmounted(() => window.removeEventListener('hashchange', lies))
}
