import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { SICHT_FASSUNG } from '../betrieb/sicht'
import { geraetAblage, ichOderNeu, liesKopplung, pruefeRaum, schreibeKopplung, type Ablage, type KoppelLage, type Kopplung, type RaumBezug } from './ablage'
import { bereinige, freigabeBereiche, liesAufgaben, type Aufgabe } from './aufgaben'
import { lesegeraetAus, type FassungsLage, type LeseGeraet, type LeseUmgebung } from './geraet'
import { normalisiereCode } from './koppeln'
import { liesKoppelLink, packeKoppelPaket, PAKET_FASSUNG, type KoppelPaket } from './paket'
import { koppelThema } from './themen'
import { fromBase64Url } from './transport/ntfy/codec'
import { GeraetTransport } from './transport/ntfy/transport'
import type { Ablehnung, Ergebnis, GeraeteAction } from './transport/protokoll'

/**
 * Ein gekoppeltes Gerät für die Start-Freigabe (Etappe E7, Plan vom 16.11.2026 §5): liest die öffentliche Sicht wie die
 * Anzeigetafel (Thema oA, geraete/geraet.ts lesegeraetAus) und schickt Betriebs-Actions an den Host – nur für die
 * Bereiche, die der Host ihm gibt; geprüft wird dort (aufgaben.ts darf), hier nur, damit die Oberfläche Knöpfe sperren
 * kann. Ohne Store: Ein Gerät berührt `alcatraz:state:v1` nie.
 *
 * - Koppeln über einen QR-Code (Paket mit Token) oder Koppel-Link + Geräte-Code ({@link GekoppeltesGeraet.koppeln}).
 * - **Sende-Schlange** im Gerätespeicher (transport.ts), der Reihe nach, eine Action zur Zeit, bis zur Quittung; nach
 *   dem Neuladen geht weiter, was offen ist (gleiche Nummer – der Host zählt sie nicht doppelt, K18).
 * - Wiederverbinden mit `since` (S3); ein bekanntes Gerät meldet sich nach jedem Start selbst wieder an (P-7) und
 *   bekommt so Rechte und Schlüssel, die sich in der Pause geändert haben.
 * - Entzogen: sendet nichts mehr, liest Öffentliches weiter (K14, gewollt).
 * - Die Kopplung liegt gerätelokal (ablage.ts `alcatraz.geraet.kopplung`): nach dem Neuladen findet `#/geraet` sie
 *   ohne Paket in der Adresse ({@link oeffneGekoppelt}).
 */

export interface Quittung {
  nr: number
  ergebnis: Ergebnis
  grund?: Ablehnung
}

export interface GekoppeltesGeraet extends Omit<LeseGeraet, 'art' | 'zuschauer'> {
  readonly koppelPaket: KoppelPaket
  readonly lage: Readonly<Ref<KoppelLage>>
  /** Warum die Anmeldung abgelehnt wurde (`lage = abgelehnt`). */
  readonly grund: Readonly<Ref<Ablehnung | null>>
  /** Eigene Aufgaben, wie der Host sie zuletzt schickte. */
  readonly aufgaben: Readonly<ShallowRef<Aufgabe[]>>
  /**
   * Nummern eigener Actions, für die noch keine Quittung da ist – die Oberfläche sperrt ihre Knöpfe so lange (K32).
   * Ohne die Anmeldung: Die meldet {@link GekoppeltesGeraet.meldetSich}.
   */
  readonly offen: Readonly<ShallowRef<number[]>>
  /**
   * Ein gekoppeltes Gerät meldet sich selbst wieder an (P-7, nach jedem Start) und wartet auf die Antwort. Kein
   * Grund, Knöpfe zu sperren – niemand hat etwas gedrückt; eine Action wartet dahinter (Befund der E7-Prüfung
   * 20.11.2026: sonst stand nach jedem Neuladen „Wird gesendet …“ da, bei ausgeschaltetem Bedienrechner dauerhaft
   * „Keine Bestätigung“).
   */
  readonly meldetSich: Readonly<Ref<boolean>>
  /** Die zuletzt gekommene Quittung. */
  readonly quittung: Readonly<ShallowRef<Quittung | null>>
  /**
   * Anmelden: mit `code` (getippt, Koppel-Link) oder ohne (QR-Code: der Token im Paket). `code-ungueltig`: Der Code
   * hat nicht die Form eines Geräte-Codes; `ohne-code`: weder Code noch QR-Token.
   */
  koppeln(name: string, code?: string): 'gesendet' | 'code-ungueltig' | 'ohne-code'
  /** Eine Action an den Host; die Nummer, oder `null`, wenn das Gerät (noch, nicht mehr) nichts senden darf. */
  sende(action: GeraeteAction): number | null
  /** Darf dieses Gerät die Action nach seinen Aufgaben? Nur für die Oberfläche – entscheiden tut der Host. */
  darf(action: GeraeteAction): boolean
}

export type KoppelStart =
  | { ok: true; geraet: GekoppeltesGeraet }
  | { ok: false; code: 'link-ungueltig' }
  | { ok: false; code: 'fassung'; lage: FassungsLage }

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Einen Koppel-Link oder QR-Code öffnen (Text aus `#/koppeln/<paket>`). Gehört er zum Raum einer abgelegten Kopplung,
 * geht diese weiter (etwa ein neuer QR-Code für ein gekoppeltes Gerät); ein anderer Raum räumt sie weg.
 */
export function oeffneKoppelLink(text: unknown, umgebung: LeseUmgebung = {}): KoppelStart {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const gelesen = liesKoppelLink(text)
  if (!gelesen.ok) {
    if (gelesen.code === 'link-ungueltig') return gelesen
    return { ok: false, code: 'fassung', lage: gelesen.fassung > PAKET_FASSUNG ? 'host-neuer' : 'host-aelter' }
  }
  return { ok: true, geraet: gekoppeltAus(gelesen.paket, umgebung, ablage) }
}

/** Nach dem Neuladen (`#/geraet`): die abgelegte Kopplung wieder aufnehmen – `null`, wenn es keine gibt. */
export function oeffneGekoppelt(umgebung: LeseUmgebung = {}): GekoppeltesGeraet | null {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const k = liesKopplung(ablage)
  if (!k) return null
  const gelesen = liesKoppelLink(k.paket)
  if (!gelesen.ok) return null
  return gekoppeltAus(gelesen.paket, umgebung, ablage)
}

function gekoppeltAus(paket: KoppelPaket, umgebung: LeseUmgebung, ablage: Ablage | null): GekoppeltesGeraet {
  const uhr = umgebung.uhr ?? Date.now
  const bezug: RaumBezug = { u: paket.u, r: paket.r, s: paket.s }
  pruefeRaum(bezug, ablage)
  const ohneQr: KoppelPaket = { ...paket }
  delete ohneQr.q
  const abgelegt = liesKopplung(ablage)
  const k: Kopplung =
    abgelegt && abgelegt.r === paket.r && abgelegt.u === paket.u && abgelegt.s === paket.s
      ? abgelegt
      : { ...bezug, paket: packeKoppelPaket(ohneQr), lage: 'ungekoppelt', name: '', aufgaben: [], thema: null }

  // Gleich ablegen, auch ungekoppelt: GeraetApp ersetzt den Koppel-Link sofort durch `#/geraet` (kein QR-Token in
  // Verlauf und Lesezeichen) – ein Neuladen vor dem Koppeln fände sonst nichts mehr (Oberfläche E7, 20.11.2026).
  if (k !== abgelegt) schreibeKopplung(k, ablage)

  const lage = ref<KoppelLage>(k.lage)
  const grund = ref<Ablehnung | null>(null)
  const aufgaben = shallowRef<Aufgabe[]>(liesAufgaben(k.aufgaben))
  const offen = shallowRef<number[]>([])
  const meldetSich = ref(false)
  const quittung = shallowRef<Quittung | null>(null)
  const merke = (aenderung: Partial<Kopplung>) => {
    Object.assign(k, aenderung)
    schreibeKopplung({ ...k, lage: lage.value, aufgaben: aufgaben.value }, ablage)
  }

  // Kennung erst hier (ablage.ts: Kennung und Nummernfolge in EINEM Eintrag): Ein Gerät, das nur den Link geöffnet hat,
  // hat damit noch nichts gesendet.
  const ich = ichOderNeu(bezug, ablage)
  const t = new GeraetTransport({
    server: paket.u,
    raum: paket.r,
    hostSign: fromBase64Url(paket.s) ?? new Uint8Array(0),
    hostBox: fromBase64Url(paket.b) ?? new Uint8Array(0),
    lesen: [paket.t],
    oeffentlich: { g: paket.g, k: paket.k, e: paket.e },
    koppeln: k.lage === 'koppelt' ? (k.thema ?? undefined) : undefined,
    ich,
    speicher: geraetAblage(bezug, ablage),
    sichtFassung: SICHT_FASSUNG,
    zeiten: umgebung.zeiten,
    uhr,
  })
  const kern = lesegeraetAus(paket, 'anzeige', umgebung, ablage, uhr, t)
  const aktualisiereOffen = () => {
    const anmeldung = t.offeneAnmeldung()
    const jetzt = t.unbestaetigt().filter((nr) => nr !== anmeldung)
    if (jetzt.join(',') !== offen.value.join(',')) offen.value = jetzt
    meldetSich.value = anmeldung !== null && lage.value === 'gekoppelt'
  }

  t.beiEmpfang((e) => {
    if (e.art === 'verworfen') {
      // ntfy hat die eigene Nachricht abgewiesen: War es die Anmeldung, ist das Gerät wieder ungekoppelt.
      if (lage.value === 'koppelt' && !t.unbestaetigt().length) {
        lage.value = 'ungekoppelt'
        merke({ thema: null })
      }
      aktualisiereOffen()
      return
    }
    if (e.art !== 'direkt') return
    const n = e.nachricht
    switch (n.art) {
      case 'willkommen':
        lage.value = 'gekoppelt'
        grund.value = null
        aufgaben.value = liesAufgaben(n.aufgaben)
        merke({ thema: null })
        break
      case 'abgelehnt':
        // Nur eine Anmeldung wird so abgelehnt; ein schon gekoppeltes Gerät bleibt es (Actions bekommen eine Quittung).
        if (lage.value !== 'gekoppelt') {
          lage.value = 'abgelehnt'
          grund.value = n.grund
          merke({ thema: null })
        }
        break
      case 'quittung':
        quittung.value = { nr: n.auf, ergebnis: n.ergebnis, ...(n.grund ? { grund: n.grund } : {}) }
        break
      case 'aufgaben':
        // Rechte geändert – wirkt sofort (P-6).
        aufgaben.value = liesAufgaben(n.aufgaben)
        merke({})
        break
      case 'entzogen':
        // Liest Öffentliches weiter (K14), sendet nichts mehr; Unbestätigtes hat der Transport verworfen.
        lage.value = 'entzogen'
        aufgaben.value = []
        merke({ thema: null })
        break
    }
    aktualisiereOffen()
  })

  return {
    ...kern,
    koppelPaket: paket,
    lage,
    grund,
    aufgaben,
    offen,
    meldetSich,
    quittung,
    async start() {
      await kern.start()
      aktualisiereOffen()
      // P-7: Ein bekanntes Gerät meldet sich nach jedem Start selbst – ohne Code. Der Host begrüßt es mit seinen
      // jetzigen Rechten und Schlüsseln (oder es ist inzwischen entzogen: dann kommt `entzogen` über d).
      if (lage.value === 'gekoppelt' && t.unbestaetigt().length === 0) {
        t.sende({ art: 'hallo', name: k.name, code: '' })
        aktualisiereOffen()
      }
    },
    koppeln(name, code) {
      const wert = code !== undefined ? normalisiereCode(code) : (paket.q?.token ?? null)
      if (code !== undefined && !wert) return 'code-ungueltig'
      if (!wert) return 'ohne-code'
      const thema = code !== undefined ? koppelThema(paket.t, wert) : paket.q!.thema
      lage.value = lage.value === 'gekoppelt' ? 'gekoppelt' : 'koppelt'
      grund.value = null
      merke({ name, thema })
      // Eine frühere Anmeldung ohne Antwort (falscher Code) zuerst weg – sonst wartete die neue hinter ihr.
      t.verwirfAnmeldung()
      t.koppleUeber(thema)
      t.sende({ art: 'hallo', name, code: wert })
      aktualisiereOffen()
      return 'gesendet'
    },
    sende(action) {
      if (lage.value !== 'gekoppelt') return null
      const nr = t.sende({ art: 'action', action })
      aktualisiereOffen()
      return nr
    },
    darf(action) {
      const sauber = bereinige(action)
      return lage.value === 'gekoppelt' && !!sauber && freigabeBereiche(aufgaben.value).includes(sauber.bereich)
    },
  }
}
