import { computed, inject, type ComputedRef } from 'vue'
import { storeKey } from '../state/store'
import { logoMasseMm, logoTeile } from './logo'
import type { LogoBild } from '../types'

// Die Logos im Kopf der gedruckten Listen (Entscheidung des Nutzers vom 16.11.2026), wie sie die Blätter
// brauchen: Adresse des Bildes und Maße in mm. Gelesen von components/KopfLogos.vue und von den
// Messungen ohne ResizeObserver (LaufzettelBlatt.fit, DruckdateiListen.messeCodes) über logoSchluessel.

export interface LogoImKopf {
  url: string
  breiteMm: number
  hoeheMm: number
}

export interface LogosImKopf {
  links: LogoImKopf | null
  rechts: LogoImKopf | null
  hoeheMm: number
}

/**
 * Die Logos für einen Listenkopf – `null`, wenn keins gesetzt ist (dann bleibt jeder Kopf wie vorher)
 * oder kein Store da ist: Blätter werden in Tests auch ohne Store gemountet, useStore() würfe dort.
 * Zweistufig: Die beiden Felder sind eigene computed, und erst daraus entsteht das Ergebnis. Jede
 * Action ersetzt `state.value`; ein computed löst aber nur bei geändertem Wert aus (Vue 3.5) – so
 * zeichnet nicht jeder Tastendruck in der Erfassung alle Köpfe der Druckdatei neu.
 */
export function useListenLogos(hoechstensMm?: number): ComputedRef<LogosImKopf | null> {
  const store = inject(storeKey, null)
  const logos = computed(() => store?.state.value.logos)
  // `hoechstensMm`: WKR-Bögen deckeln die eingestellte Höhe (lib/logo.ts LOGO_HOEHE_BOGEN_MAX_MM).
  const hoehe = computed(() => {
    const mm = store?.state.value.logoHoeheMm
    return mm === undefined || hoechstensMm === undefined ? mm : Math.min(mm, hoechstensMm)
  })
  return computed(() => {
    const l = logos.value
    const hoeheMm = hoehe.value
    if (!l || hoeheMm === undefined || (!l.links && !l.rechts)) return null
    return { links: imKopf(l.links, hoeheMm), rechts: imKopf(l.rechts, hoeheMm), hoeheMm }
  })
}

function imKopf(b: LogoBild | null, hoeheMm: number): LogoImKopf | null {
  return b ? { url: logoUrl(b.src), ...logoMasseMm(b, hoeheMm) } : null
}

/** Höchstens so viele Blob-Adressen bleiben stehen: zwei Logos und je ein gerade ersetztes. */
const URL_CACHE_MAX = 4
/** In der Folge der letzten Nutzung, die zuletzt genutzte hinten (Map behält die Einfügefolge). */
const urls = new Map<string, string>()

/**
 * Die data-URL eines Rasterbilds einmal als Blob-Adresse: Die Druckdatei hat Hunderte Köpfe, und nicht
 * jedes `<img>` soll das ganze Bild als Text tragen. Ohne `URL.createObjectURL` oder bei einem Fehler gilt
 * die data-URL selbst.
 *
 * Freigegeben wird die am längsten nicht genutzte Adresse, wenn mehr als vier da sind (echtes LRU: ein
 * Treffer rückt nach hinten). Mit der Einfügefolge allein fiel das gerade gelesene linke Logo heraus, wenn
 * für das rechte eine neue Adresse nötig war – der erste Kopf zeigte dann einen leeren Kasten (Befund der
 * Prüfung, 16.11.2026). useListenLogos fragt links und rechts nacheinander; beide stehen danach hinten.
 *
 * SVG bleibt data-URL (Befund der Prüfung, 16.11.2026): Eine Blob-Adresse hat den Ursprung der App, und ein
 * SVG, das jemand über „Bild in neuem Tab öffnen“ als Dokument öffnet, könnte dort Skripte ausführen und
 * den Stand lesen. Eine data-URL hat als Dokument einen eigenen, undurchsichtigen Ursprung. SVG kommt nur
 * aus einer von Hand geänderten Vorlage oder Sicherung (das Hochladen rastert), der Text je Kopf ist selten.
 */
export function logoUrl(src: string): string {
  const bekannt = urls.get(src)
  if (bekannt) {
    urls.delete(src)
    urls.set(src, bekannt)
    return bekannt
  }
  const teile = logoTeile(src)
  if (!teile || !teile.base64 || teile.format === 'svg+xml') return src
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return src
  try {
    const bytes = Uint8Array.from(atob(teile.daten), (z) => z.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: `image/${teile.format}` }))
    urls.set(src, url)
    if (urls.size > URL_CACHE_MAX) {
      const [aeltester, alteUrl] = urls.entries().next().value as [string, string]
      urls.delete(aeltester)
      URL.revokeObjectURL(alteUrl)
    }
    return url
  } catch {
    return src
  }
}

/** Kurzer Schlüssel für Watches: '' ohne Logos, sonst Höhe und Breiten – ändert sich genau, wenn sich der Kopf ändert. */
export function logoSchluessel(l: LogosImKopf | null): string {
  return l ? `${l.hoeheMm}|${l.links?.breiteMm ?? ''}|${l.rechts?.breiteMm ?? ''}` : ''
}
