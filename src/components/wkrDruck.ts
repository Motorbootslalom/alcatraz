import { computed } from 'vue'
import { merke } from '../lib/merken'
import { useKonfig } from '../lib/konfig'
import { useStore } from '../state/store'
import { useGeraeteHost } from '../geraete/host'
import { abgedeckteTeile } from '../geraete/register'
import { teileNachDruck, type TeilAbdeckung } from '../wkr/druck'
import type { WkrBogen } from '../lib/wkrListen'

/**
 * Druck nach Modus (Nutzer 21.11.2026, WKR_ANNAHMEN Z1–Z7): Welche WKR-Bögen gedruckt werden – für WkrListen,
 * ParallelWkrListen, LaufzettelListen und ParallelLaufzettel an EINER Stelle. Die Regel steht rein in wkr/druck.ts;
 * hier kommen Stand, Konfiguration, das Register gekoppelter Geräte (nur am Bedienrechner mit Raum, Steg je Teil) und
 * der Rückfall-Schalter „Trotzdem drucken“ (Bedienauswahl, lib/merken.ts – ein Schalter für alle vier Ansichten).
 */
export function useWkrDruck() {
  const { state } = useStore()
  const konfig = useKonfig()
  const host = useGeraeteHost()
  const trotzdem = merke<boolean>('listen.wkr.digitalDrucken', false, { ueberNeuladen: true })
  const abdeckung = computed<TeilAbdeckung | undefined>(() => {
    const geraete = host?.raum.value?.geraete
    return geraete ? (kennung) => abgedeckteTeile(geraete, kennung) : undefined
  })
  /** `gedruckt` = was im Stapel steht (mit „Trotzdem drucken“ alles), `digital` = die nur digitalen (für den Hinweis). */
  function teile<B extends Pick<WkrBogen, 'parcoursId' | 'typeId' | 'runde'>>(boegen: readonly B[]): { gedruckt: B[]; digital: B[] } {
    const t = teileNachDruck(boegen, state.value.wkr, konfig.value, abdeckung.value)
    return trotzdem.value ? { gedruckt: [...boegen], digital: t.digital } : t
  }
  return { trotzdem, teile }
}
