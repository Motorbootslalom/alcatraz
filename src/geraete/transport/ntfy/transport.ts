import { shallowRef, type Ref } from 'vue'
import { canCompress, fingerprint, fromBase64Url, textHash } from './codec'
import { applyPatch, diff, equal, type Json } from './patch'
import { INLINE_GRENZE, MAX_ANHANG, NtfyLeitung, type NtfyEreignis, type NtfyZeiten, type PostErgebnis } from './leitung'
import {
  direktThemaVon,
  geraeteThemaVon,
  gruppeDesLinks,
  gruppenSchluessel,
  DIREKT_MERKEN,
  leererGeraetStand,
  mitGruppe,
  mitNeuemSchluessel,
  themenDerGruppe,
  vermerke,
  type Ausstehend,
  type GeraetSpeicher,
  type GeraetStand,
  type HostRaum,
  type HostSpeicher,
  type LesePaket,
} from './raum'
import {
  belegteFassung,
  openDirekt,
  openGruppe,
  openVomGeraet,
  parseGeraetWire,
  parseHostWire,
  sealAnkuendigung,
  sealDirekt,
  sealGruppe,
  sealVomGeraet,
  verifyHostWire,
  type GeraetWire,
  type HostKopf,
  type HostWire,
} from './wire'
import {
  DIREKT,
  istGruppe,
  istOeffentlich,
  OEFFENTLICH,
  PROTOKOLL_FASSUNG,
  type Ablehnung,
  type DirektNachricht,
  type Ergebnis,
  type GeraeteNachricht,
  type GruppenInhalt,
  type GruppenMeldung,
  type GruppenSchluessel,
} from '../protokoll'
import type { Transport } from '../typen'
import { normalisiereServer, zufallsThema } from '../../themen'
import type { Zaehlart } from '../../kontingent'

/**
 * Host und Gerät über einen ntfy-Server – ohne eigenes Relais (aus dem Prototyp tafel, transport/ntfy/
 * transport.ts, 16.11.2026 übernommen und nach Plan §5 umgebaut; Leitung in leitung.ts, Format in wire.ts).
 *
 * Gegenüber dem Prototyp:
 * - **Gruppen** statt eines Raumschlüssels: je Gruppe Schlüssel, Epoche, Zähler `n` und Grundlage der Differenz.
 *   `ko` (Anzeigetafel, oA) und `kz` (Zuschauer, oZ, ab E6) sind öffentlich (Lese-Links) und werden nie neu
 *   verschlüsselt (K14); weitere Gruppen (später je Liste, K31) bekommen nach einem Entzug neue Schlüssel.
 * - **Themen** nach geraete/themen.ts: Der Host liest g (abgeleitet), schreibt an oA/oZ (zufällig), d· und k·.
 * - **Einstieg mit `since`** (S3, K15): Ein Gerät fragt zuerst ab, nimmt den neuesten Vollstand und die
 *   Differenzen danach und abonniert dann ab der letzten Nachricht. Der Host liest g ab der zuletzt verarbeiteten.
 * - **Nummer `nr` je Gerät** (S2, K18): Der Host merkt sich die letzte im Raum (dauerhaft); Doppelte bekommen nur
 *   erneut eine Quittung, auch nach einem Neustart. Das Gerät schickt eine Nachricht zur Zeit, bis zur Quittung.
 * - **Kein Anhang aus g** (K13): Der Host lädt nie etwas. Geräte laden Anhänge nur nach signierter Ankündigung
 *   mit Prüfsumme und kleiner Grenze (S5).
 * - **Unbekannte drosseln** (S6): Nachrichten unbekannter Schlüssel öffnet der Host nur auf Koppel-Themen, je
 *   Thema in begrenzter Zahl, auf g gar nicht; Ablehnungen und zweite Antworten kosten ihn nur wenige
 *   Veröffentlichungen.
 * - **Keine Umbindung** (S1): Eine gebundene Geräte-ID bekommt nie einen anderen Schlüssel.
 * - **Fassungen** `v`/`sv` und Sendezeit `hz` in jeder Nachricht des Hosts (K16, K17), dazu der Fassungsbeleg `fs`;
 *   Fehler als Codes.
 * - **Verwaltungsnachrichten dauerhaft** (Befund E5-Prüfung 16.11.2026): Schlüsselwechsel und `entzogen` stehen
 *   im Raum, bis ntfy sie angenommen hat; die Sende-Schlange selbst liegt nur im Arbeitsspeicher.
 */

const clone = <T>(wert: T): T => JSON.parse(JSON.stringify(wert)) as T
const bytes = (text: string) => fromBase64Url(text) ?? new Uint8Array(0)

/** Wird eine Differenz größer als dieser Anteil der vollen Sicht, geht die volle. */
const PATCH_ANTEIL = 0.5

/**
 * Drosselung für Unbekannte (S6): so viele Nachrichten je Minute und Koppel-Thema öffnet der Host, so viele
 * Ablehnungen sendet er insgesamt.
 */
const UNBEKANNT_JE_MINUTE = 10
const ABLEHNUNGEN_JE_MINUTE = 6
/** Eine Ablehnung je Schlüssel höchstens so oft. */
const ABLEHNUNG_ABSTAND_MS = 30_000
/**
 * Zweite Antworten an gekoppelte Geräte (Quittung `doppelt`, erneute Begrüßung): je Gerät erst nach
 * quittungMs/2, dann mit doppeltem Abstand bis höchstens {@link NOCHMAL_HOECHSTENS_MS}, insgesamt höchstens
 * {@link NOCHMAL_JE_MINUTE}. Sonst brächte, wer die letzte Nachricht eines Geräts wieder einstellt, den Host zu
 * 12 Veröffentlichungen je Minute und Gerät – an S6 vorbei, weil der Schlüssel bekannt ist (Befund E5-Prüfung
 * 16.11.2026). Das echte Gerät wiederholt ohnehin nur, bis eine Antwort ankommt.
 */
const NOCHMAL_JE_MINUTE = 12
const NOCHMAL_HOECHSTENS_MS = 5 * 60_000

/**
 * Wie lange eine Meldung „neu laden“ höchstens auf das Senden wartet (Prüfung E8, 21.11.2026 – vom Nutzer zu
 * bestätigen, BETRIEB_ANNAHMEN.alleNeuLaden). Ohne Abo sendet der Host nichts; käme die Verbindung erst nach einer
 * Stunde zurück, ginge der Befehl mit frischem `hz` hinaus, bestünde die Frische-Prüfung der Geräte (geraet.ts
 * NEULADEN_BEFEHL_GUELTIG_MS) und lüde alle Geräte mitten im Lauf neu. Eine Minute deckt kurze Wackler (Wiederholung
 * des POST) und nicht mehr.
 */
export const NEULADEN_SENDEN_MS = 60_000

/**
 * Wiederholungen eines Geräts ohne Antwort (Befund der E7-Prüfung 20.11.2026): erst nach quittungMs, dann mit
 * doppeltem Abstand bis höchstens {@link WIEDERHOLEN_HOECHSTENS_MS}. Sonst schickte ein Handy, dessen Anmeldung niemand
 * beantwortet (falscher Code, Bedienrechner aus), ohne Ende alle 10 s – rund 360 POSTs je Stunde aus demselben Hotspot
 * wie der Bedienrechner, dessen Kontingent je IP es mit aufbraucht. Verloren geht dabei nichts: Was ntfy angenommen
 * hat, liest der Host ohnehin mit `since` nach; die Wiederholung hilft nur, wenn eine Nachricht unterwegs verschwand.
 */
const WIEDERHOLEN_HOECHSTENS_MS = 5 * 60_000

/** Abstand vor der nächsten Wiederholung einer Nachricht, die schon `mal`-mal hinausging. */
export function wiederholAbstand(quittungMs: number, mal: number): number {
  return Math.min(quittungMs * 2 ** Math.max(0, mal - 1), Math.max(quittungMs, WIEDERHOLEN_HOECHSTENS_MS))
}

/** Einfacher Eimer: höchstens `menge` in `fensterMs`. */
class Eimer {
  private zeiten: number[] = []
  constructor(
    private readonly menge: number,
    private readonly fensterMs: number,
  ) {}

  nimm(jetzt: number): boolean {
    this.zeiten = this.zeiten.filter((t) => jetzt - t < this.fensterMs)
    if (this.zeiten.length >= this.menge) return false
    this.zeiten.push(jetzt)
    return true
  }
}

// ===========================================================================
// Host
// ===========================================================================

export interface HostOptionen {
  /** Adresse des ntfy-Servers (Einstellung; Vorgabe themen.ts NTFY_VORGABE). Muss zum Raum passen. */
  server: string
  /** Raum und Register, gerätelokal (geraete/ablage.ts; in Tests im Arbeitsspeicher). */
  speicher: HostSpeicher
  /** Fassung der Sicht (OeffentlicheSicht['sv']) – steht in jeder Nachricht. */
  sichtFassung: number
  zeiten?: Partial<NtfyZeiten>
  /** Uhr für die Sendezeit `hz` (Tests). */
  uhr?: () => number
  /** E8: Kontingent-Zähler (geraete/kontingent.ts) – was an den Server geht. */
  zaehle?: (art: Zaehlart) => void
}

/** Eine Nachricht eines Geräts, wie der Host sie bekommt. Antworten gehen über {@link HostTransport}. */
export interface Eingang {
  id: string
  pk: string
  nr: number
  /** Thema, auf dem sie kam – dorthin antwortet der Host einem noch nicht gekoppelten Gerät. */
  thema: string
  nachricht: GeraeteNachricht
  /**
   * Geräte-ID und Schlüssel gehören zu einem gekoppelten Gerät. Sonst kommt nur `hallo` durch, und es zählt nur
   * mit gültigem Code (E7) – eine bekannte ID allein beweist nichts.
   */
  gebunden: boolean
}

interface Basis {
  n: number
  sicht: Json
}

interface Versiegelt {
  text: string
  kopf: HostKopf
  /** Ist der große Text schon als Anhang draußen, fehlt nur noch die Ankündigung. */
  ankuendigung?: string
}

type HostAuftrag =
  | {
      art: 'gruppe'
      gruppe: string
      n: number
      /** Sicht (Vollstand oder Differenz gegen `basis`) oder Meldung. */
      sicht?: Json
      basis?: Basis | null
      meldung?: GruppenMeldung
      /** Nur „neu laden“: Bis wann (Host-Uhr) die Meldung noch hinaus darf – siehe {@link NEULADEN_SENDEN_MS}. */
      verfall?: number
      inhalt?: GruppenInhalt
      offen: string[]
      versiegelt: Map<string, Versiegelt>
      laeuft: boolean
    }
  | {
      art: 'direkt'
      thema: string
      pk: string
      nachricht: DirektNachricht
      versiegelt?: Versiegelt
      laeuft: boolean
      /** Vermerk im Raum – fällt weg, sobald ntfy die Nachricht angenommen hat. */
      ausstehend?: Ausstehend
      /** Bei `schluessel`: die Epochen, die versiegelt wurden. */
      epochen?: Record<string, number>
    }

export class HostTransport extends NtfyLeitung implements Transport {
  private raum: HostRaum | null = null
  private boxSecret: Uint8Array = new Uint8Array(0)
  private signSecret: Uint8Array = new Uint8Array(0)
  private handler = new Set<(e: Eingang) => void>()
  private schlange: HostAuftrag[] = []
  /** Zuletzt eingereihte Sicht je Gruppe – Grundlage der nächsten Differenz. */
  private kopfstand = new Map<string, Basis>()
  /** Gruppen, deren nächste Sicht voll gehen muss (nach einer verworfenen Nachricht). */
  private vollNoetig = new Set<string>()
  private letzteSicht = new Map<string, number>()
  private letzterVoll = new Map<string, number>()
  private vollTimer: ReturnType<typeof setInterval> | null = null
  /** Geräte-Nachrichten in Arbeit: id → Nummer und seit wann. */
  private inArbeit = new Map<string, { nr: number; seit: number }>()
  /** Zweite Antworten je Geräte-ID: auf welche Nummer, wie oft schon, wann zuletzt. */
  private nochmal = new Map<string, { nr: number; mal: number; zuletzt: number }>()
  private nochmalEimer = new Eimer(NOCHMAL_JE_MINUTE, 60_000)
  /** Erneutes `entzogen` an entzogene Geräte, die sich auf g melden: je Gerät wachsender Abstand, eigener Eimer. */
  private entzogenNochmal = new Map<string, { nr: number; mal: number; zuletzt: number }>()
  private entzogenEimer = new Eimer(ABLEHNUNGEN_JE_MINUTE, 60_000)
  /** Je Koppel-Thema ein Eimer für Unbekannte: Eine Flut auf einem Thema hungert kein anderes aus. */
  private unbekannt = new Map<string, Eimer>()
  private ablehnungen = new Eimer(ABLEHNUNGEN_JE_MINUTE, 60_000)
  private abgelehnt = new Map<string, number>()
  /** Weitere Themen, etwa zum Koppeln (E7). */
  private extra = new Set<string>()
  private readonly uhr: () => number

  constructor(private readonly optionen: HostOptionen) {
    super(normalisiereServer(optionen.server) ?? '', optionen.zeiten, optionen.zaehle)
    this.uhr = optionen.uhr ?? Date.now
  }

  async start(): Promise<void> {
    if (!this.gestoppt) return
    if (!canCompress()) return this.scheitere({ code: 'browser-zu-alt' })
    if (!this.server) return this.scheitere({ code: 'server-ungueltig' })
    const raum = this.optionen.speicher.lies()
    if (!raum) return this.scheitere({ code: 'raum-fehlt' })
    if (raum.server !== this.server) return this.scheitere({ code: 'raum-anderer-server' })
    this.raum = raum
    this.boxSecret = bytes(raum.box.sk)
    this.signSecret = bytes(raum.sign.sk)
    this.fehler.value = null
    this.beginne()
    // Was ein früheres Führungsfenster nicht mehr hinausbrachte (Schlüsselwechsel, Entzug), geht zuerst.
    this.vorne(this.ausstehendeAuftraege(raum))
    const pruefe = Math.max(10, Math.min(this.zeiten.vollstandMs / 4, 60_000))
    this.vollTimer = setInterval(() => this.vollstandFaellig(), pruefe)
  }

  override stop(): void {
    if (this.vollTimer) clearInterval(this.vollTimer)
    this.vollTimer = null
    this.schlange = []
    // Die Grundlagen der Differenzen gelten nur, solange dieses Fenster ohne Unterbrechung führt: In der Zwischenzeit
    // kann ein anderes verteilt haben. Ein erneuter start() derselben Instanz beginnt deshalb mit einem Vollstand
    // (Befund E5-Prüfung 16.11.2026).
    this.kopfstand.clear()
    this.vollNoetig.clear()
    this.letzteSicht.clear()
    this.letzterVoll.clear()
    super.stop()
  }

  beiEingang(fn: (e: Eingang) => void): () => void {
    this.handler.add(fn)
    return () => this.handler.delete(fn)
  }

  /** Thema `g` – kommt per willkommen zu gekoppelten Geräten, steht nie in einem Link. */
  geraeteThema(): string | null {
    return this.raum ? geraeteThemaVon(this.raum) : null
  }

  /** Ein weiteres Thema mitlesen, etwa ein Koppel-Thema, solange ein Code gilt (E7). */
  liesAuch(thema: string): void {
    if (this.extra.has(thema)) return
    this.extra.add(thema)
    this.neuAbonnieren()
  }

  liesNichtMehr(thema: string): void {
    this.unbekannt.delete(thema)
    if (this.extra.delete(thema)) this.neuAbonnieren()
  }

  protected aboThemen(): string[] {
    return this.raum ? [geraeteThemaVon(this.raum), ...this.extra] : []
  }

  protected aboSeit(): string | null {
    return this.raum?.seit ?? this.zeiten.einstiegFenster
  }

  private aendere(f: (raum: HostRaum) => void): HostRaum | null {
    const neu = this.optionen.speicher.aendere(f)
    if (neu) this.raum = neu
    // Speicher voll: weiter mit dem Stand im Arbeitsspeicher (der Speicher liefert ihn), aber sichtbar melden.
    if (this.optionen.speicher.voll?.()) this.fehler.value = { code: 'ablage-voll' }
    else if (this.fehler.value?.code === 'ablage-voll') this.fehler.value = null
    return neu
  }

  // -------------------------------------------------------------------------
  // Verteilen an Gruppen
  // -------------------------------------------------------------------------

  /**
   * Die Sicht einer Gruppe verteilen: als Differenz zur zuletzt verteilten, sonst voll. Gleiches geht nicht
   * hinaus; wartet die vorige noch, wird sie ersetzt (beim Umsortieren zählt nur der letzte Stand).
   */
  verteile(gruppe: string, sicht: Json, optionen: { voll?: boolean } = {}): void {
    if (this.gestoppt || !this.raum?.gruppen[gruppe]) return
    const kopie = clone(sicht)
    const kopf = this.kopfstand.get(gruppe)
    // `voll` (W1): nach einem neuen Schlüssel oder für ein neues Gerät der Gruppe – auch gleicher Inhalt geht hinaus.
    const voll = !!optionen.voll || this.vollNoetig.has(gruppe)
    if (kopf && equal(kopf.sicht, kopie) && !voll) return
    const letzter = this.schlange[this.schlange.length - 1]
    if (letzter?.art === 'gruppe' && letzter.gruppe === gruppe && letzter.sicht !== undefined && !letzter.laeuft) {
      letzter.sicht = kopie
      if (voll) letzter.basis = null
      this.kopfstand.set(gruppe, { n: letzter.n, sicht: kopie })
      this.kick()
      return
    }
    const basis = voll ? null : (kopf ?? null)
    this.reiheEin(gruppe, { sicht: kopie, basis })
  }

  /** Einen Vollstand erzwingen (alle {@link NtfyZeiten.vollstandMs} von selbst, K15). */
  vollstand(gruppe: string): void {
    const kopf = this.kopfstand.get(gruppe)
    if (this.gestoppt || !kopf) return
    this.reiheEin(gruppe, { sicht: kopf.sicht, basis: null })
  }

  /**
   * Eine Meldung an eine Gruppe: Raum beendet, neu laden. „Neu laden“ geht vor einer wartenden Sicht hinaus (wie im
   * Prototyp, tafel enqueue urgent): Lädt das Fenster danach selbst neu, leert es die Schlange, und die Meldung
   * dürfte nicht hinter einer Sicht warten, die noch abstandMs zurückgehalten wird. Die wartende Sicht entfällt; der
   * letzte Stand folgt als Vollstand mit höherer Nummer – mit ihrer kleineren Nummer verwürfen die Geräte sie nach
   * der Meldung als schon gesehen.
   */
  melde(gruppe: string, meldung: GruppenMeldung): void {
    if (this.gestoppt || !this.raum?.gruppen[gruppe]) return
    if (meldung.art !== 'neu-laden') return this.reiheEin(gruppe, { meldung })
    const wartend = (a: HostAuftrag) => a.art === 'gruppe' && a.gruppe === gruppe && a.sicht !== undefined && !a.laeuft
    const ersetzt = this.schlange.some(wartend)
    this.schlange = this.schlange.filter((a) => !wartend(a))
    this.reiheEin(gruppe, { meldung }, true, this.uhr() + NEULADEN_SENDEN_MS)
    const kopf = this.kopfstand.get(gruppe)
    if (ersetzt && kopf) this.reiheEin(gruppe, { sicht: kopf.sicht, basis: null })
  }

  private reiheEin(gruppe: string, inhalt: { sicht: Json; basis: Basis | null } | { meldung: GruppenMeldung }, vorn = false, verfall?: number): void {
    // Die Nummer steigt dauerhaft: frisch gelesen, erhöht, geschrieben – auch ein zweites Fenster vergibt sie nie doppelt.
    let n = 0
    const raum = this.aendere((r) => {
      const g = r.gruppen[gruppe]
      if (!g) return
      g.n += 1
      n = g.n
    })
    if (!raum || n === 0) return
    if ('sicht' in inhalt) {
      this.vollNoetig.delete(gruppe)
      this.kopfstand.set(gruppe, { n, sicht: inhalt.sicht })
    }
    const auftrag: HostAuftrag = { art: 'gruppe', gruppe, n, ...inhalt, ...(verfall !== undefined ? { verfall } : {}), offen: themenDerGruppe(raum, gruppe), versiegelt: new Map(), laeuft: false }
    if (vorn) this.vorne([auftrag])
    else this.schlange.push(auftrag)
    this.kick()
  }

  private vollstandFaellig(): void {
    const jetzt = Date.now()
    for (const gruppe of this.kopfstand.keys()) {
      // Ein Vollstand in der Schlange (auch einer, der gerade hinausgeht) genügt.
      const wartet = this.schlange.some((a) => a.art === 'gruppe' && a.gruppe === gruppe && a.sicht !== undefined && a.basis === null)
      if (wartet) continue
      const zuletzt = this.letzterVoll.get(gruppe) ?? 0
      if (this.vollNoetig.has(gruppe) || jetzt - zuletzt >= this.zeiten.vollstandMs) this.vollstand(gruppe)
    }
  }

  // -------------------------------------------------------------------------
  // Gruppen und Geräte verwalten
  // -------------------------------------------------------------------------

  /**
   * Ein öffentliches Thema erneuern (E6: „Zuschauer-Link erneuern“, K13): neues zufälliges Thema; Schlüssel und
   * Nummern bleiben, der andere Link (die Anzeigetafel, eigene Gruppe) merkt nichts. Wartende Nachrichten der Gruppe
   * gehen schon an das neue Thema, gleich danach ein Vollstand, damit der neue Link sofort etwas zeigt. Liefert das
   * neue Thema.
   */
  erneuereThema(welches: 'a' | 'z'): string | null {
    const neu = { thema: null as string | null }
    const raum = this.aendere((r) => {
      r.oeffentlich[welches] = zufallsThema()
      neu.thema = r.oeffentlich[welches]
    })
    if (!raum || !neu.thema) return null
    const gruppe = gruppeDesLinks(welches)
    for (const a of this.schlange) {
      if (a.art !== 'gruppe' || a.gruppe !== gruppe || a.laeuft) continue
      a.offen = themenDerGruppe(raum, gruppe)
      a.versiegelt.clear()
    }
    this.vollstand(gruppe)
    return neu.thema
  }

  /**
   * Wartet, bis alles hinaus ist, was in der Schlange steht – etwa die Meldung „Raum beendet“, bevor der Raum
   * gelöscht wird. `false` nach `ms` oder wenn der Transport vorher stoppt (dann bleibt es liegen; die Geräte
   * löschen ihre Sicht spätestens nach Ablauf, K20).
   */
  async bisGesendet(ms: number): Promise<boolean> {
    const ende = Date.now() + ms
    while (!this.gestoppt && this.schlange.length > 0) {
      if (Date.now() >= ende) return false
      await new Promise((erfuelle) => setTimeout(erfuelle, 20))
    }
    return !this.gestoppt
  }

  /** Eine nicht öffentliche Gruppe anlegen (später je Liste, K31). */
  legeGruppeAn(gruppe: string): boolean {
    let neu = false
    this.aendere((r) => {
      neu = mitGruppe(r, gruppe)
    })
    return neu
  }

  /**
   * Neuer Schlüssel für eine nicht öffentliche Gruppe; ihre Geräte bekommen ihn einzeln, vor allem anderen.
   * Für `ko` und `kz` nie (K14) – `false`.
   */
  rotiere(gruppe: string): boolean {
    if (istOeffentlich(gruppe)) return false
    let gedreht = false
    const raum = this.aendere((r) => {
      gedreht = mitNeuemSchluessel(r, gruppe)
      if (gedreht) this.vermerkeSchluessel(r, [gruppe])
    })
    if (!raum || !gedreht) return false
    this.vorne(this.ausstehendeAuftraege(raum))
    return true
  }

  /** Im Raum vermerken: Jedes Gerät in diesen Gruppen bekommt seine neuen Schlüssel (im selben Schreiben wie der Wechsel). */
  private vermerkeSchluessel(r: HostRaum, gruppen: string[]): void {
    for (const [id, geraet] of Object.entries(r.geraete)) {
      if (gruppen.some((g) => geraet.gruppen.includes(g))) vermerke(r, { id, pk: geraet.pk, art: 'schluessel' })
    }
  }

  /**
   * Aufträge aus den Vermerken im Raum. Der Inhalt von `schluessel` entsteht erst beim Versiegeln (die dann
   * neuesten Schlüssel aller Gruppen des Geräts).
   */
  private ausstehendeAuftraege(raum: HostRaum): HostAuftrag[] {
    return raum.ausstehend.map((a): HostAuftrag => ({
      art: 'direkt',
      thema: direktThemaVon(raum, a.id),
      pk: a.pk,
      nachricht: a.art === 'entzogen' ? { art: 'entzogen' } : { art: 'schluessel', gruppen: [] },
      ausstehend: a,
      laeuft: false,
    }))
  }

  /**
   * Aufträge vor alle wartenden setzen (der laufende bleibt vorn) – ein neuer Schlüssel muss vor der nächsten
   * Nachricht da sein. Einen Vermerk, der schon wartet, nicht noch einmal.
   */
  private vorne(auftraege: HostAuftrag[]): void {
    const gleich = (a: Ausstehend, b?: Ausstehend) => !!b && a.id === b.id && a.art === b.art && a.pk === b.pk
    // Ein laufender `schluessel` trägt vielleicht schon veraltete Schlüssel – ein neuer darf dann hinterher.
    const neu = auftraege.filter(
      (neuer) => neuer.art !== 'direkt' || !neuer.ausstehend ||
        !this.schlange.some((a) => a.art === 'direkt' && (!a.laeuft || a.ausstehend?.art === 'entzogen') && gleich(neuer.ausstehend!, a.ausstehend)),
    )
    if (!neu.length) return
    const an = this.schlange[0]?.laeuft ? 1 : 0
    this.schlange.splice(an, 0, ...neu)
    this.kick()
  }

  /** ntfy hat eine Verwaltungsnachricht angenommen (oder endgültig abgewiesen): Vermerk weg – außer bei einem neueren Wechsel. */
  private ausstehendErledigt(auftrag: Extract<HostAuftrag, { art: 'direkt' }>): void {
    const a = auftrag.ausstehend
    if (!a) return
    this.aendere((r) => {
      const i = r.ausstehend.findIndex((x) => x.id === a.id && x.art === a.art && x.pk === a.pk)
      if (i < 0) return
      if (a.art === 'schluessel' && auftrag.epochen) {
        // Kam während des Sendens ein weiterer Wechsel, bleibt der Vermerk; der Auftrag dafür wartet schon (vorne).
        const geraet = r.geraete[a.id]
        const jetzt = geraet?.pk === a.pk ? geraet.gruppen.filter((g) => r.gruppen[g]) : []
        if (jetzt.some((g) => r.gruppen[g].e !== auftrag.epochen![g])) return
      }
      r.ausstehend.splice(i, 1)
    })
  }

  /**
   * Ein Gerät koppeln und begrüßen. Bindet die ID an den Schlüssel der Anmeldung – nie um (S1): Gehört die ID
   * schon einem anderen Schlüssel, bleibt alles, wie es ist (`'id-belegt'`; E7 vergibt dann eine neue ID oder
   * lehnt ab). Die Nummer der Anmeldung zählt ab jetzt als letzte.
   */
  begruesse(e: Eingang, angaben: { id?: string; gruppen: string[]; aufgaben: unknown[]; name?: string }): 'gebunden' | 'id-belegt' {
    const id = angaben.id ?? e.id
    const belegt = { ja: false }
    const jetzt = this.uhr()
    const raum = this.aendere((r) => {
      const vorhanden = r.geraete[id]
      if (vorhanden && vorhanden.pk !== e.pk) {
        belegt.ja = true
        return
      }
      // Ein Schlüssel gehört einem Gerät: Meldet er sich unter einer neuen ID, gilt die alte nicht mehr.
      for (const [andere, g] of Object.entries(r.geraete)) if (andere !== id && g.pk === e.pk) delete r.geraete[andere]
      const gruppen = angaben.gruppen.filter((g) => !istOeffentlich(g) && r.gruppen[g])
      // Register (E7): Name und Aufgaben im selben Schreiben wie die Bindung – eine Kopplung ohne Rechte gibt es so nie.
      r.geraete[id] = {
        ...vorhanden,
        pk: e.pk,
        letzteNr: Math.max(vorhanden?.letzteNr ?? 0, e.nr),
        gruppen,
        aufgaben: angaben.aufgaben,
        ...(angaben.name !== undefined ? { name: angaben.name } : {}),
        seit: vorhanden?.seit ?? jetzt,
        zuletzt: jetzt,
      }
    })
    if (!raum || belegt.ja) return 'id-belegt'
    this.inArbeit.delete(e.id)
    const gruppen = angaben.gruppen.map((g) => gruppenSchluessel(raum, g)).filter((s): s is GruppenSchluessel => s !== null)
    const nachricht: DirektNachricht = {
      art: 'willkommen',
      auf: e.nr,
      id,
      themen: { g: geraeteThemaVon(raum), d: direktThemaVon(raum, id) },
      gruppen,
      aufgaben: angaben.aufgaben,
    }
    this.direkt(this.antwortThema(raum, e), e.pk, nachricht)
    return 'gebunden'
  }

  /**
   * Wohin die Antwort auf eine Anmeldung geht: Kam sie über g, hört das Gerät auf sein d-Thema; kam sie über ein
   * Koppel-Thema, hört es (noch ohne willkommen) nur dort – auch ein schon gebundenes, dessen willkommen verloren ging.
   */
  private antwortThema(raum: HostRaum, e: Eingang): string {
    return e.thema === geraeteThemaVon(raum) ? direktThemaVon(raum, e.id) : e.thema
  }

  /** Eine Anmeldung oder Action ablehnen. An Ungekoppelte gedrosselt (S6): je Schlüssel selten, insgesamt wenige. */
  ablehnen(e: Eingang, grund: Ablehnung): void {
    const raum = this.raum
    if (!raum) return
    this.inArbeit.delete(e.id)
    if (e.gebunden) {
      this.direkt(this.antwortThema(raum, e), e.pk, { art: 'abgelehnt', auf: e.nr, grund })
      return
    }
    const jetzt = Date.now()
    if (jetzt - (this.abgelehnt.get(e.pk) ?? -Infinity) < ABLEHNUNG_ABSTAND_MS) return
    if (!this.ablehnungen.nimm(jetzt)) return
    this.abgelehnt.set(e.pk, jetzt)
    if (this.abgelehnt.size > 256) this.abgelehnt.delete(this.abgelehnt.keys().next().value!)
    this.direkt(this.antwortThema(raum, e), e.pk, { art: 'abgelehnt', auf: e.nr, grund })
  }

  /**
   * Eine Nachricht eines gekoppelten Geräts ist bearbeitet: Nummer dauerhaft merken (erst jetzt – ging sie vorher
   * verloren, wiederholt das Gerät sie), dann die Quittung.
   *
   * `still` (W1, 21.11.2026, Plan §5/§8): keine direkte Quittung – das Gerät erfährt es gesammelt aus der Sicht seiner
   * Liste (`bis` = `letzteNr`, wkr/sicht.ts) und nimmt dann alles bis dahin aus seiner Schlange
   * ({@link GeraetTransport.bestaetige}). Nur, wenn das Gerät die Gruppe der Liste hat (entscheidet host.ts). Eine
   * Wiederholung derselben Nummer bekommt weiter direkt `doppelt` (gedrosselt) – das ist der Rückfall, wenn die Sicht
   * nicht ankam.
   */
  quittiere(e: Eingang, ergebnis: Ergebnis, grund?: Ablehnung, optionen: { still?: boolean } = {}): void {
    if (!e.gebunden) return
    let passt = false
    const raum = this.aendere((r) => {
      const g = r.geraete[e.id]
      if (!g || g.pk !== e.pk) return
      g.letzteNr = Math.max(g.letzteNr, e.nr)
      passt = true
    })
    this.inArbeit.delete(e.id)
    if (!raum || !passt || optionen.still) return
    const nachricht: DirektNachricht = { art: 'quittung', auf: e.nr, ergebnis }
    if (grund) nachricht.grund = grund
    this.direkt(direktThemaVon(raum, e.id), e.pk, nachricht)
  }

  /**
   * Den Raum ändern, ohne den Transport zu umgehen (E7: Register, Koppel-Stand – geraete/host.ts): liest frisch, wendet
   * an, schreibt; danach gilt der neue Raum auch hier. Nur im Führungsfenster, wie alles Schreiben des Raums.
   */
  verwalte(f: (raum: HostRaum) => void): HostRaum | null {
    return this.aendere(f)
  }

  /** Der Raum, wie dieser Transport ihn zuletzt gelesen oder geschrieben hat (nach start()). */
  raumJetzt(): HostRaum | null {
    return this.raum
  }

  /**
   * Einem gekoppelten Gerät die Schlüssel all seiner Gruppen schicken (W1: neue Liste in den Aufgaben, Plan §5) – als
   * Vermerk im Raum wie ein Schlüsselwechsel, also dauerhaft bis ntfy annimmt, und vor allem Wartenden. `false` ohne
   * Eintrag oder ohne nicht öffentliche Gruppe.
   */
  schickeSchluessel(id: string): boolean {
    const g = this.raum?.geraete[id]
    if (!g || !g.gruppen.some((x) => !istOeffentlich(x))) return false
    const raum = this.aendere((r) => {
      const jetzt = r.geraete[id]
      if (jetzt) vermerke(r, { id, pk: jetzt.pk, art: 'schluessel' })
    })
    if (!raum) return false
    this.vorne(this.ausstehendeAuftraege(raum))
    return true
  }

  /** Etwas an ein gekoppeltes Gerät (geänderte Aufgaben). `false`, wenn es nicht gekoppelt ist. */
  sende(id: string, nachricht: DirektNachricht): boolean {
    const g = this.raum?.geraete[id]
    if (!this.raum || !g) return false
    this.direkt(direktThemaVon(this.raum, id), g.pk, nachricht)
    return true
  }

  /**
   * Entzug (K14): `entzogen` an das Gerät, dann aus dem Register; die nicht öffentlichen Gruppen, in denen es war,
   * bekommen neue Schlüssel. `ko` bleibt – das Gerät liest Öffentliches weiter (gewollt).
   */
  entziehe(id: string): boolean {
    const vorher = this.raum?.geraete[id]
    if (!this.raum || !vorher) return false
    // In EINEM Schreiben: aus dem Register, neue Schlüssel, und vermerkt, wer was noch bekommen muss – schließt das
    // Fenster vor dem Senden, holt der nächste Start es nach.
    const raum = this.aendere((r) => {
      delete r.geraete[id]
      r.ausstehend = r.ausstehend.filter((a) => !(a.id === id && a.art === 'schluessel'))
      vermerke(r, { id, pk: vorher.pk, art: 'entzogen' })
      const gruppen = vorher.gruppen.filter((g) => mitNeuemSchluessel(r, g))
      this.vermerkeSchluessel(r, gruppen)
    })
    if (!raum) return false
    this.inArbeit.delete(id)
    // Vor allem Wartenden: `entzogen` und die neuen Schlüssel an die übrigen – die nächste Nachricht ihrer Gruppe
    // geht schon mit dem neuen Schlüssel hinaus (versiegelt wird erst beim Senden).
    this.vorne(this.ausstehendeAuftraege(raum))
    return true
  }

  private direkt(thema: string, pk: string, nachricht: DirektNachricht): void {
    if (this.gestoppt) return
    this.schlange.push({ art: 'direkt', thema, pk, nachricht, laeuft: false })
    this.kick()
  }

  // -------------------------------------------------------------------------
  // Empfangen
  // -------------------------------------------------------------------------

  protected async empfange(ereignis: NtfyEreignis): Promise<void> {
    const thema = typeof ereignis.topic === 'string' ? ereignis.topic : ''
    // Der Host lädt nie einen Anhang (K13): Nachrichten der Geräte sind klein, Größeres ist Störung.
    if (!ereignis.attachment && typeof ereignis.message === 'string' && ereignis.message.length <= INLINE_GRENZE) {
      const wire = parseGeraetWire(ereignis.message)
      if (wire) await this.vomGeraet(wire, thema)
    }
    if (typeof ereignis.id === 'string') {
      const id = ereignis.id
      this.aendere((r) => {
        r.seit = id
      })
    }
  }

  private async vomGeraet(wire: GeraetWire, thema: string): Promise<void> {
    const raum = this.raum
    const pk = wire.pk
    if (!raum) return
    const g = geraeteThemaVon(raum)
    const bekannt = Object.values(raum.geraete).some((x) => x.pk === pk)
    if (!bekannt) {
      // Auf g schreiben nur gekoppelte Geräte; Ungekoppelte melden sich über ein Koppel-Thema an. Unbekanntes auf g
      // öffnet der Host also gar nicht – sonst hungerte, wer g kennt (jedes gekoppelte und jedes entzogene Gerät),
      // mit zehn Nachrichten je Minute jede Kopplung aus (Befund E5-Prüfung 16.11.2026).
      if (thema === g) {
        this.erinnereEntzogenes(raum, pk)
        return
      }
      // Unbekannte Schlüssel kosten Rechenzeit (box) und Antworten – nur wenige je Minute und Koppel-Thema (S6).
      let eimer = this.unbekannt.get(thema)
      if (!eimer) this.unbekannt.set(thema, (eimer = new Eimer(UNBEKANNT_JE_MINUTE, 60_000)))
      if (!eimer.nimm(Date.now())) return
    }
    const klar = await openVomGeraet(wire, this.boxSecret)
    if (!klar || this.gestoppt) return
    const geraet = this.raum?.geraete[klar.id]
    if (geraet && geraet.pk === pk) {
      if (klar.nr <= geraet.letzteNr) {
        // Schon bearbeitet – das Gerät hat die Antwort wohl nicht bekommen. Nur auf die jüngste, und gedrosselt.
        if (klar.nr !== geraet.letzteNr || !this.nochmalErlaubt(klar.id, klar.nr)) return
        if (klar.nachricht.art === 'hallo' && thema !== g) {
          // Eine Anmeldung, die über ein Koppel-Thema wiederkommt: Das willkommen kam nie an (etwa weil das
          // Führungsfenster vorher schloss) – das Gerät hört noch nicht auf sein d-Thema. Also noch einmal an die
          // Anwendung (E7), die es erneut begrüßt; die Antwort geht auf dasselbe Koppel-Thema.
          this.liefere({ id: klar.id, pk, nr: klar.nr, thema, nachricht: klar.nachricht, gebunden: true })
          return
        }
        this.direkt(direktThemaVon(raum, klar.id), pk, { art: 'quittung', auf: klar.nr, ergebnis: 'doppelt' })
        return
      }
      const arbeit = this.inArbeit.get(klar.id)
      if (arbeit && arbeit.nr >= klar.nr && Date.now() - arbeit.seit < this.zeiten.bearbeitungMs) return
      this.inArbeit.set(klar.id, { nr: klar.nr, seit: Date.now() })
      this.liefere({ id: klar.id, pk, nr: klar.nr, thema, nachricht: klar.nachricht, gebunden: true })
      return
    }
    // Unbekannter Schlüssel oder eine bekannte ID mit fremdem Schlüssel: nur die Anmeldung.
    if (klar.nachricht.art !== 'hallo') return
    this.liefere({ id: klar.id, pk, nr: klar.nr, thema, nachricht: klar.nachricht, gebunden: false })
  }

  /**
   * Ein entzogenes Gerät meldet sich auf g (Befund der E7-Prüfung 20.11.2026): Es war aus, als `entzogen` kam, und
   * länger als ntfy vorhält (12 h) – holeNach findet nichts mehr, das Gerät hält sich für gekoppelt und meldet sich
   * selbst an (P-7). Ohne Antwort stünde dort für immer „Keine Bestätigung“ statt des Entzugs. Erkannt nur am
   * öffentlichen Schlüssel aus `raum.entzogen` (geöffnet wird nichts); `entzogen` geht auf sein d-Thema, gedrosselt
   * je Gerät (wachsender Abstand) und insgesamt. Andere unbekannte Schlüssel auf g bleiben unbeantwortet.
   */
  private erinnereEntzogenes(raum: HostRaum, pk: string): void {
    const e = raum.entzogen?.find((x) => x.pk === pk)
    if (!e || raum.geraete[e.id] || !this.nochmalErlaubt(e.id, 0, this.entzogenNochmal, this.entzogenEimer)) return
    this.direkt(direktThemaVon(raum, e.id), pk, { art: 'entzogen' })
  }

  /** Darf der Host einem gekoppelten Gerät noch einmal auf `nr` antworten? Abstand je Gerät wächst, Summe gedeckelt. */
  private nochmalErlaubt(id: string, nr: number, liste = this.nochmal, eimer = this.nochmalEimer): boolean {
    const jetzt = Date.now()
    const bisher = liste.get(id)
    const mal = bisher?.nr === nr ? bisher.mal : 0
    if (bisher && mal > 0) {
      const abstand = Math.min((this.zeiten.quittungMs / 2) * 2 ** (mal - 1), NOCHMAL_HOECHSTENS_MS)
      if (jetzt - bisher.zuletzt < abstand) return false
    }
    if (!eimer.nimm(jetzt)) return false
    liste.set(id, { nr, mal: mal + 1, zuletzt: jetzt })
    return true
  }

  private liefere(e: Eingang): void {
    for (const fn of this.handler) fn(e)
  }

  // -------------------------------------------------------------------------
  // Senden
  // -------------------------------------------------------------------------

  protected async pumpe(): Promise<void> {
    const sitzung = this.sitzung
    const vorbei = () => this.gestoppt || sitzung !== this.sitzung
    while (!vorbei() && this.abonniert && this.schlange.length > 0) {
      const auftrag = this.schlange[0]
      if (auftrag.art === 'gruppe' && auftrag.sicht !== undefined && !auftrag.laeuft) {
        const warte = (this.letzteSicht.get(auftrag.gruppe) ?? 0) + this.zeiten.abstandMs - Date.now()
        if (warte > 0) {
          // In dieser Zeit wird die Sicht noch ersetzt, wenn eine neue kommt.
          await this.schlafe(warte, true)
          continue
        }
      }
      auftrag.laeuft = true
      let ergebnis: PostErgebnis
      try {
        ergebnis = await this.sendeSchritt(auftrag)
      } catch {
        ergebnis = { art: 'verworfen', status: 0 }
      }
      if (vorbei()) return
      if (ergebnis.art === 'ok') {
        if (auftrag.art === 'direkt' || auftrag.offen.length === 0) this.erledigt(auftrag)
        continue
      }
      if (ergebnis.art === 'verworfen') {
        this.schlange.shift()
        // Fehlt den Geräten eine Differenz, muss die nächste Sicht voll gehen.
        if (auftrag.art === 'gruppe' && auftrag.sicht !== undefined) this.vollNoetig.add(auftrag.gruppe)
        // Was ntfy endgültig abweist (oder wofür es kein Gerät mehr gibt), wird auch beim nächsten Start nichts.
        if (auftrag.art === 'direkt') this.ausstehendErledigt(auftrag)
        continue
      }
      await this.warteNachFehler(ergebnis)
    }
  }

  private erledigt(auftrag: HostAuftrag): void {
    this.schlange.shift()
    if (auftrag.art === 'direkt') this.ausstehendErledigt(auftrag)
    if (auftrag.art !== 'gruppe' || auftrag.sicht === undefined) return
    this.letzteSicht.set(auftrag.gruppe, Date.now())
    if (auftrag.inhalt && 'voll' in auftrag.inhalt) this.letzterVoll.set(auftrag.gruppe, Date.now())
  }

  /** Ein Thema eines Auftrags: versiegeln (einmal), senden – groß als Anhang mit signierter Ankündigung. */
  private async sendeSchritt(auftrag: HostAuftrag): Promise<PostErgebnis> {
    const thema = auftrag.art === 'gruppe' ? auftrag.offen[0] : auftrag.thema
    // „Neu laden“, das zu lange auf die Verbindung gewartet hat, verfällt (Prüfung E8, 21.11.2026): Sonst ginge es nach
    // einem Ausfall mit frischem `hz` hinaus, und alle Geräte lüden mitten im Lauf neu.
    if (auftrag.art === 'gruppe' && auftrag.verfall !== undefined && this.uhr() > auftrag.verfall) return { art: 'verworfen', status: 0 }
    let v = (auftrag.art === 'gruppe' ? auftrag.versiegelt.get(thema) : auftrag.versiegelt) ?? null
    if (!v) {
      v = await this.versiegle(auftrag, thema)
      if (!v) return { art: 'verworfen', status: 0 }
      if (auftrag.art === 'gruppe') auftrag.versiegelt.set(thema, v)
      else auftrag.versiegelt = v
    }
    const ergebnis = await this.sendeText(thema, v)
    if (ergebnis.art === 'ok' && auftrag.art === 'gruppe') auftrag.offen.shift()
    return ergebnis
  }

  private async sendeText(thema: string, v: Versiegelt): Promise<PostErgebnis> {
    // Gestoppt (Führung verloren) während des Versiegelns: nichts mehr senden – sonst schickte ein altes Fenster neben
    // dem neuen Führungsfenster. Was so liegen bleibt, holt der nächste Start nach (Vermerke, Vollstand, Wiederholung
    // der Geräte).
    if (this.gestoppt) return { art: 'nochmal' }
    if (v.ankuendigung) return this.post(thema, v.ankuendigung)
    if (v.text.length <= INLINE_GRENZE) return this.post(thema, v.text)
    if (v.text.length > MAX_ANHANG) {
      this.meldeSendefehler({ code: 'zu-gross' })
      return { art: 'verworfen', status: 413 }
    }
    const ergebnis = await this.post(thema, v.text)
    if (ergebnis.art !== 'ok' || this.gestoppt) return ergebnis
    const url = ergebnis.antwort?.attachment?.url
    if (typeof url !== 'string' || !url.startsWith(`${this.server}/file/`)) {
      // Der Server hat keine Anhänge (oder eine andere Adresse) – ankündigen lässt sich nichts.
      this.meldeSendefehler({ code: 'zu-gross' })
      return { art: 'verworfen', status: 0 }
    }
    v.ankuendigung = sealAnkuendigung(v.kopf, thema, { u: url, b: v.text.length, h: textHash(v.text) }, this.signSecret)
    return this.post(thema, v.ankuendigung)
  }

  private async versiegle(auftrag: HostAuftrag, thema: string): Promise<Versiegelt | null> {
    const raum = this.raum
    if (!raum) return null
    const sv = this.optionen.sichtFassung
    if (auftrag.art === 'direkt') {
      const pk = bytes(auftrag.pk)
      if (pk.length !== 32) return null
      if (auftrag.ausstehend?.art === 'schluessel') {
        // Erst jetzt aus dem Raum: die neuesten Schlüssel aller Gruppen des Geräts, auch nach mehreren Wechseln.
        const geraet = raum.geraete[auftrag.ausstehend.id]
        if (!geraet || geraet.pk !== auftrag.ausstehend.pk) return null
        const gruppen = geraet.gruppen.map((g) => gruppenSchluessel(raum, g)).filter((s): s is GruppenSchluessel => s !== null)
        if (!gruppen.length) return null
        auftrag.nachricht = { art: 'schluessel', gruppen }
        auftrag.epochen = Object.fromEntries(gruppen.map((s) => [s.g, s.e]))
      }
      let n = 0
      const neu = this.aendere((r) => {
        r.uhr += 1
        n = r.uhr
      })
      if (!neu) return null
      const kopf: HostKopf = { v: PROTOKOLL_FASSUNG, r: raum.r, g: DIREKT, e: 0, n, a: 'd', sv, hz: this.uhr() }
      return { text: await sealDirekt(auftrag.nachricht, kopf, thema, pk, this.boxSecret, this.signSecret), kopf }
    }
    const gruppe = raum.gruppen[auftrag.gruppe]
    if (!gruppe) return null
    auftrag.inhalt ??= auftrag.meldung ? { meldung: auftrag.meldung } : this.sichtInhalt(auftrag.sicht ?? null, auftrag.basis ?? null)
    const a = 'meldung' in auftrag.inhalt ? 'm' : 'voll' in auftrag.inhalt ? 'v' : 'p'
    const kopf: HostKopf = { v: PROTOKOLL_FASSUNG, r: raum.r, g: auftrag.gruppe, e: gruppe.e, n: auftrag.n, a, sv, hz: this.uhr() }
    return { text: await sealGruppe(auftrag.inhalt, kopf, thema, bytes(gruppe.k), this.signSecret), kopf }
  }

  private sichtInhalt(sicht: Json, basis: Basis | null): GruppenInhalt {
    if (!basis) return { voll: sicht }
    const ops = diff(basis.sicht, sicht)
    if (JSON.stringify(ops).length > JSON.stringify(sicht).length * PATCH_ANTEIL) return { voll: sicht }
    return { patch: { base: basis.n, ops, h: fingerprint(sicht) } }
  }
}

// ===========================================================================
// Gerät
// ===========================================================================

export interface GeraetOptionen {
  server: string
  /** Raum-ID aus Link oder QR-Code. */
  raum: string
  /** Signaturschlüssel des Hosts – der Vertrauensanker. */
  hostSign: Uint8Array
  /** Box-Schlüssel des Hosts – nur gekoppelte Geräte (E7) schicken etwas. */
  hostBox?: Uint8Array
  /** Öffentliche Themen aus dem Link (Lese-Link: genau eines, oA oder oZ). */
  lesen: string[]
  /** Schlüssel der öffentlichen Gruppe aus dem Link; `g` = welche (Vorgabe `ko`, der Zuschauer-Link trägt `kz`). */
  oeffentlich?: { g?: string; k: string; e: number }
  /** Koppel-Thema, solange die Anmeldung läuft (E7): `hallo` geht dorthin, die Antwort kommt dort. */
  koppeln?: string
  /** Eigene ID und Schlüsselpaar – nur gekoppelte Geräte. */
  ich?: { id: string; schluessel: { publicKey: Uint8Array; secretKey: Uint8Array } }
  /** Was das Gerät über die Verbindung weiß, gerätelokal (geraete/ablage.ts `alcatraz.geraet.verbindung`). */
  speicher: GeraetSpeicher
  /** Fassung der Sicht, die dieses Gerät lesen kann (Plan F7: nur dieselbe). */
  sichtFassung: number
  zeiten?: Partial<NtfyZeiten>
  /** Uhr für das Alter eines Vollstands (Tests). */
  uhr?: () => number
}

/**
 * Was ein Gerät empfängt. `hz` = Sendezeit des Hosts (Uhrversatz für „seit“ und „ca. in“, E6). `nachgeholt`: kam aus
 * der Abfrage beim Einstieg oder beim Schließen einer Lücke, kann also alt sein – für den Uhrversatz zählt nur, was
 * frisch über das Abo kam (geraete/geraet.ts).
 */
export type Empfang =
  | { art: 'sicht'; gruppe: string; sicht: Json; n: number; hz: number; nachgeholt: boolean }
  | { art: 'meldung'; gruppe: string; meldung: GruppenMeldung; n: number; hz: number; nachgeholt: boolean }
  | { art: 'direkt'; nachricht: DirektNachricht; hz: number }
  /** Eine eigene Nachricht hat ntfy abgewiesen – sie ist verworfen. */
  | { art: 'verworfen'; nr: number }

interface Gelesen {
  wire: HostWire
  thema: string
}

export class GeraetTransport extends NtfyLeitung implements Transport {
  /** Fassung des Hosts, wenn sie nicht passt (Plan F7: „Update nötig“ bzw. „Bedienrechner aktualisieren“). */
  readonly fremdeFassung: Ref<{ v: number; sv: number | null } | null> = shallowRef(null)

  private stand: GeraetStand = leererGeraetStand()
  private basis = new Map<string, { n: number; sicht: Json }>()
  private handler = new Set<(e: Empfang) => void>()
  private eingestiegen = false
  private holtNach = false
  /**
   * Ein `schluessel` mit neuer Gruppe kam WÄHREND holeNach (Prüfbefund 21.11.2026, W3-24): Dessen Themen standen schon
   * fest, das Thema der neuen Gruppe fehlte darin – typisch, wenn die Liste zugewiesen wurde, solange das Gerät weg
   * war. Danach noch einmal nachholen, sonst bliebe die Maske auf „verbinde …“, bis der Host die Sicht ändert.
   */
  private nachholenNoetig = false
  private letzterEinstieg = Number.NEGATIVE_INFINITY
  /** Zuletzt gesendete Nummer, wann und wie oft schon – bis zur Quittung. */
  private gesendet: { nr: number; um: number; mal: number } | null = null
  /** Abgelegtes `seit` vom letzten Lauf: Ab dort holt der erste Einstieg die Nachrichten an dieses Gerät nach. */
  private seitVorher: string | null = null
  private readonly uhr: () => number
  /** Koppel-Thema der laufenden Anmeldung (E7: beim Geräte-Code erst bekannt, wenn er getippt ist). */
  private koppelThema: string | undefined

  constructor(private readonly optionen: GeraetOptionen) {
    super(normalisiereServer(optionen.server) ?? '', optionen.zeiten)
    this.uhr = optionen.uhr ?? Date.now
    this.koppelThema = optionen.koppeln
  }

  /**
   * Über dieses Koppel-Thema anmelden (E7, geraete/gekoppelt.ts): Der Geräte-Code wird erst auf dem Gerät getippt,
   * das Thema H(oA ‖ 'koppeln' ‖ code) folgt daraus. Liest ab jetzt dort (die Antwort kommt dort) und schickt eine
   * wartende Anmeldung dorthin. Ohne `ich`/`hostBox` sendet das Gerät ohnehin nichts.
   */
  koppleUeber(thema: string): void {
    if (this.koppelThema === thema) return
    this.koppelThema = thema
    if (!this.gestoppt && !this.stand.themen) this.neuAbonnieren()
    this.kick()
  }

  async start(): Promise<void> {
    if (!this.gestoppt) return
    if (!canCompress()) return this.scheitere({ code: 'browser-zu-alt' })
    if (!this.server) return this.scheitere({ code: 'server-ungueltig' })
    if (this.optionen.hostSign.length !== 32 || this.optionen.lesen.length === 0) return this.scheitere({ code: 'link-ungueltig' })
    const abgelegt = this.optionen.speicher.lies()
    this.stand = abgelegt ?? leererGeraetStand()
    // Ein neuer Stand beginnt seine Nummern bei der Uhrzeit (ms), nicht bei 1: Ging der Stand verloren, der Schlüssel
    // aber nicht (kaputter Eintrag, ein Aufrufer an ablage.ts vorbei), lägen die neuen Nummern sonst unter `letzteNr`
    // des Hosts – die Anmeldung verschwände still, und ein altes willkommen mit `auf: 1` gälte als Antwort (Befund
    // E5-Prüfung 16.11.2026, zweite Sperre neben ablage.ts ichOderNeu). Die Folge steigt danach je Nachricht um 1.
    if (!abgelegt) this.stand.naechsteNr = Math.max(1, Math.floor(this.uhr()))
    const ko = this.optionen.oeffentlich
    const g = ko?.g ?? OEFFENTLICH
    const bisher = this.stand.gruppen[g]
    if (ko && istOeffentlich(g) && (!bisher || ko.e >= bisher.e)) this.stand.gruppen[g] = { k: ko.k, e: ko.e, t: bisher?.t ?? [] }
    // Der Einstieg fragt ab; abonniert wird danach ab dessen letzter Nachricht. Das alte `seit` braucht nur noch das
    // d-Thema (holeNach).
    this.seitVorher = this.stand.seit
    this.stand.seit = null
    this.eingestiegen = false
    this.fehler.value = null
    this.beginne()
  }

  beiEmpfang(fn: (e: Empfang) => void): () => void {
    this.handler.add(fn)
    return () => this.handler.delete(fn)
  }

  /**
   * Eine Nachricht an den Host – in die Sende-Schlange (gerätelokal, übersteht Neuladen), der Reihe nach, eine
   * zur Zeit, bis zur Quittung. Liefert die Nummer; die Oberfläche hält ihren Knopf gesperrt, bis die Quittung
   * mit dieser Nummer kommt (K32).
   */
  sende(nachricht: GeraeteNachricht): number {
    this.nimmHoechsteNr()
    const nr = this.stand.naechsteNr
    this.stand.naechsteNr += 1
    this.stand.schlange.push({ nr, nachricht })
    this.speichere()
    this.kick()
    return nr
  }

  /**
   * Eine noch unbeantwortete Anmeldung zurücknehmen (E7, Oberfläche 20.11.2026): Auf einen falschen oder abgelaufenen
   * Code antwortet niemand (auf dessen Thema hört der Host nicht) – die Anmeldung stünde sonst ewig vorn in der
   * Schlange, und eine neue mit dem richtigen Code käme nie an die Reihe. Nur `hallo`; Actions bleiben.
   */
  verwirfAnmeldung(): void {
    const vorher = this.stand.schlange.length
    this.stand.schlange = this.stand.schlange.filter((u) => u.nachricht.art !== 'hallo')
    if (this.stand.schlange.length === vorher) return
    this.gesendet = null
    this.speichere()
  }

  /** Nummer einer wartenden Anmeldung (`hallo`), sonst `null` – die Oberfläche trennt sie von Actions (E7). */
  offeneAnmeldung(): number | null {
    return this.stand.schlange.find((u) => u.nachricht.art === 'hallo')?.nr ?? null
  }

  /**
   * Eigene ID, wie der Host sie im willkommen vergab (kann von der vorgeschlagenen abweichen, S1) – `null` vor dem
   * Koppeln. W1: Damit findet das Gerät sich in der Sicht seiner Liste (`geraete[id]`).
   */
  eigeneId(): string | null {
    return this.stand.id
  }

  /** Nummern, für die noch keine Quittung da ist. */
  unbestaetigt(): number[] {
    return this.stand.schlange.map((u) => u.nr)
  }

  /**
   * Gesammelte Quittung (W1, Plan §5/§8): Der Host hat alles bis `bisNr` bearbeitet (`bis` dieses Geräts in der Sicht
   * seiner Liste) – ohne direkte Nachricht. Nimmt alle Unbestätigten mit Nummer ≤ `bisNr` aus der Schlange, setzt die
   * Wiederholung zurück, legt ab und schickt das Nächste. Liefert die entfernten Nummern (leer: nichts zu tun).
   */
  bestaetige(bisNr: number): number[] {
    if (!Number.isFinite(bisNr)) return []
    const weg = this.stand.schlange.filter((u) => u.nr <= bisNr).map((u) => u.nr)
    if (weg.length === 0) return []
    this.stand.schlange = this.stand.schlange.filter((u) => u.nr > bisNr)
    if (this.gesendet && this.gesendet.nr <= bisNr) this.gesendet = null
    this.speichere()
    this.kick()
    return weg
  }

  private liefere(e: Empfang): void {
    for (const fn of this.handler) fn(e)
  }

  /**
   * Die Nummer frisch aus dem Speicher nachziehen (Befund 15 des Handy-Tests, 21.11.2026): Zwei Tabs mit derselben
   * Kopplung (QR-Code noch einmal gescannt, alter Tab nach dem Neuladen wieder wach) hielten sonst je ihren eigenen
   * Zähler und vergäben dieselben Nummern. Der Host zählt die zweite als schon bearbeitet (`nr ≤ letzteNr`), und weil
   * `bis` der Sicht sie deckt, hält das Gerät die Zeile für übernommen – ✓ am Handy, kein Haken am Bedienrechner
   * („Mann-über-Bord 3 offen“). Wie beim Host (reiheEin): gelesen, erhöht, geschrieben – die Nummer sinkt nie, auch
   * nicht, wenn ein Tab seinen älteren Stand ablegt.
   */
  private nimmHoechsteNr(): void {
    const abgelegt = this.optionen.speicher.lies()
    if (abgelegt && abgelegt.naechsteNr > this.stand.naechsteNr) this.stand.naechsteNr = abgelegt.naechsteNr
  }

  private speichere(): void {
    this.nimmHoechsteNr()
    // Weiter mit dem Stand im Arbeitsspeicher; nach einem Neuladen fehlte aber, was nicht abgelegt ist – melden.
    if (this.optionen.speicher.schreibe(this.stand) === false) this.fehler.value = { code: 'ablage-voll' }
    else if (this.fehler.value?.code === 'ablage-voll') this.fehler.value = null
  }

  protected aboThemen(): string[] {
    const themen = new Set(this.optionen.lesen)
    // Die öffentlichen Themen kommen nur aus dem Link (`lesen`) – ein abgelegtes, inzwischen erneuertes nicht.
    for (const [g, s] of Object.entries(this.stand.gruppen)) if (!istOeffentlich(g)) for (const t of s.t) themen.add(t)
    if (this.stand.themen) themen.add(this.stand.themen.d)
    else if (this.koppelThema) themen.add(this.koppelThema)
    return [...themen]
  }

  protected aboSeit(): string | null {
    return this.stand.seit ?? this.zeiten.einstiegFenster
  }

  protected async vorDemAbo(): Promise<boolean> {
    if (this.eingestiegen) return true
    this.eingestiegen = await this.holeNach()
    return this.eingestiegen
  }

  // -------------------------------------------------------------------------
  // Einstieg und Nachholen (K15, K17)
  // -------------------------------------------------------------------------

  /**
   * Fragt die Themen ab (`since` = Einstiegsfenster) und nimmt je Gruppe den neuesten Vollstand, dazu die
   * Differenzen danach (K15). Hat die Gruppe eine Grundlage, zählt nur, was über dem zuletzt Gesehenen liegt.
   * Ohne Grundlage – ein neues Gerät, oder nach dem Neuladen (die Grundlage liegt nur im Arbeitsspeicher, `seen`
   * im Gerätespeicher) – gilt der neueste Vollstand auch, wenn er schon gesehen war: Mit ihm und den Differenzen
   * danach entsteht die Grundlage neu; geliefert wird ab dem zuletzt Gesehenen (Befund E5-Prüfung 16.11.2026: sonst
   * bliebe eine neu geladene Tafel bis zum nächsten stündlichen Vollstand leer). Ohne Grundlage gilt nur, was nicht
   * älter ist als {@link NtfyZeiten.hoechstensAltMs} – eine alte, erneut eingestellte Nachricht verliert (K17).
   *
   * Nachrichten an dieses Gerät (d) kommen nicht wieder wie ein Vollstand: Beim ersten Einstieg nach dem Neuladen
   * holt das Gerät sie ab dem abgelegten `seit`, auch wenn das länger her ist als das Einstiegsfenster (ntfy hält
   * 12 h) – sonst ginge ein Schlüsselwechsel, `aufgaben` oder `entzogen` aus der Pause verloren (S3).
   */
  private async holeNach(): Promise<boolean> {
    this.holtNach = true
    this.letzterEinstieg = Date.now()
    const sitzung = this.sitzung
    const vorbei = () => this.gestoppt || sitzung !== this.sitzung
    try {
      const themen = this.aboThemen()
      const ereignisse = await this.abfrage(themen, this.zeiten.einstiegFenster)
      if (!ereignisse || vorbei()) return false
      let alle = ereignisse
      const d = this.stand.themen?.d
      if (d && this.seitVorher) {
        // Nach der Hauptabfrage: Was danach auf d kommt, bringt das Abo (ab deren letzter Nachricht).
        const direkt = await this.abfrage([d], this.seitVorher)
        if (!direkt || vorbei()) return false
        const schon = new Set(ereignisse.map((e) => e.id))
        alle = [...direkt.filter((e) => !schon.has(e.id)), ...ereignisse]
      }
      const nachGruppe = new Map<string, Gelesen[]>()
      for (const ereignis of alle) {
        const gelesen = this.liesEreignis(ereignis, themen)
        if (!gelesen) continue
        const liste = nachGruppe.get(gelesen.wire.g) ?? []
        liste.push(gelesen)
        nachGruppe.set(gelesen.wire.g, liste)
      }
      // Direktes zuerst: Ein neuer Schlüssel muss da sein, bevor die Nachrichten seiner Gruppe kommen.
      const gruppen = [...nachGruppe.keys()].sort((a, b) => Number(b === DIREKT) - Number(a === DIREKT))
      for (const gruppe of gruppen) {
        const liste = nachGruppe.get(gruppe)!.sort((x, y) => x.wire.n - y.wire.n)
        const gesehen = this.stand.seen[gruppe] ?? 0
        let auswahl = liste.filter((l) => l.wire.n > gesehen)
        let aufbau = false
        if (gruppe !== DIREKT && this.basis.has(gruppe)) {
          const voll = auswahl.map((l) => l.wire.a === 'v').lastIndexOf(true)
          if (voll >= 0) auswahl = auswahl.slice(voll)
        } else if (gruppe !== DIREKT) {
          const voll = liste.map((l) => l.wire.a === 'v' && this.frisch(l.wire)).lastIndexOf(true)
          aufbau = voll >= 0
          auswahl = aufbau ? liste.slice(voll) : auswahl.filter((l) => l.wire.a === 'm')
        }
        for (const l of auswahl) {
          if (vorbei()) return false
          await this.verarbeite(l.wire, l.thema, false, aufbau)
        }
      }
      if (vorbei()) return false
      this.seitVorher = null
      const letzte = ereignisse[ereignisse.length - 1]
      if (letzte && typeof letzte.id === 'string') {
        this.stand.seit = letzte.id
        this.speichere()
      }
      return true
    } finally {
      this.holtNach = false
      if (this.nachholenNoetig) {
        this.nachholenNoetig = false
        if (!vorbei()) void this.holeNach()
      }
    }
  }

  /** Gilt eine Nachricht noch als frisch (K17)? Sendezeit des Hosts gegen die Uhr des Geräts. */
  private frisch(kopf: { hz: number }): boolean {
    return this.uhr() - kopf.hz <= this.zeiten.hoechstensAltMs
  }

  /** Text eines Ereignisses → geprüfte Nachricht des Hosts auf einem meiner Themen, sonst `null`. */
  private liesEreignis(ereignis: NtfyEreignis, themen: string[]): Gelesen | null {
    const thema = typeof ereignis.topic === 'string' ? ereignis.topic : ''
    // Anhänge nie von selbst (S5) – nur, wenn eine signierte Ankündigung sie nennt.
    if (ereignis.attachment || typeof ereignis.message !== 'string' || !themen.includes(thema)) return null
    const wire = parseHostWire(ereignis.message)
    if (!wire) {
      // Eine andere Protokollfassung zählt nur mit dem Beleg des Hosts, für diesen Raum und frisch – eine
      // unsignierte Zeile `{"v":99}` von einem Zuschauer ändert nichts (Befund E5-Prüfung 16.11.2026).
      const fassung = belegteFassung(ereignis.message, thema, this.optionen.hostSign)
      if (fassung && fassung.v !== PROTOKOLL_FASSUNG && fassung.r === this.optionen.raum && this.frisch(fassung)) {
        this.fremdeFassung.value = { v: fassung.v, sv: fassung.sv }
        this.fehler.value = { code: 'fassung' }
      }
      return null
    }
    if (wire.r !== this.optionen.raum || !verifyHostWire(wire, thema, this.optionen.hostSign)) return null
    return { wire, thema }
  }

  private async lueckeSchliessen(): Promise<void> {
    if (this.holtNach || Date.now() - this.letzterEinstieg < this.zeiten.einstiegAbstandMs) return
    await this.holeNach()
  }

  // -------------------------------------------------------------------------
  // Empfangen
  // -------------------------------------------------------------------------

  protected async empfange(ereignis: NtfyEreignis): Promise<void> {
    const gelesen = this.liesEreignis(ereignis, this.aboThemen())
    if (gelesen) await this.verarbeite(gelesen.wire, gelesen.thema, false)
    // Gestoppt beim Verarbeiten („Raum beendet“ → Raum verlassen, E6): nichts mehr ablegen – sonst stünde die eben
    // gelöschte Verbindung gleich wieder im Speicher des Geräts.
    if (this.gestoppt) return
    if (typeof ereignis.id === 'string') {
      this.stand.seit = ereignis.id
      this.speichere()
    }
  }

  /**
   * Lohnt die Nachricht überhaupt? Vor allem vor einem Anhang: Nichts laden, was ohnehin verworfen würde.
   * `aufbau` (nur beim Einstieg ohne Grundlage, siehe holeNach): auch schon Gesehenes, aber nur Sichten – eine
   * Meldung wirkt nie zweimal – und nur vorwärts.
   */
  private neu(wire: HostWire, aufbau = false): boolean {
    if (wire.g === DIREKT) return !!this.optionen.ich && !!this.optionen.hostBox && !this.direktSchonDa(wire.n)
    const schluessel = this.stand.gruppen[wire.g]
    // Ein verpasster Schlüsselwechsel kommt gezielt über d – bis dahin bleibt die Nachricht liegen.
    if (!schluessel || wire.e !== schluessel.e) return false
    const basis = this.basis.get(wire.g)
    // Ohne Grundlage nur Frisches (K17) – beim Einstieg wie im laufenden Abo: Sonst nähme ein neues Gerät eine alte,
    // erst nach dem Einstieg erneut eingestellte Nachricht an (Befund E5-Prüfung 16.11.2026).
    if (!basis && !this.frisch(wire)) return false
    if (wire.n > (this.stand.seen[wire.g] ?? 0)) return true
    return aufbau && wire.a !== 'm' && wire.n > (basis?.n ?? 0)
  }

  private async verarbeite(wire: HostWire, thema: string, ausAnhang: boolean, aufbau = false): Promise<void> {
    if (!this.neu(wire, aufbau)) return
    if (wire.l) {
      if (ausAnhang) return
      const text = await this.ladeAnhang(wire.l.u, wire.l.b)
      if (text === null || textHash(text) !== wire.l.h || this.gestoppt) return
      const innen = parseHostWire(text)
      if (!innen || innen.l || !verifyHostWire(innen, thema, this.optionen.hostSign)) return
      const gleich = innen.r === wire.r && innen.g === wire.g && innen.e === wire.e && innen.n === wire.n && innen.a === wire.a
      if (gleich) await this.verarbeite(innen, thema, true, aufbau)
      return
    }
    if (wire.g === DIREKT) await this.direkt(wire)
    else await this.gruppe(wire)
  }

  private async gruppe(wire: HostWire): Promise<void> {
    const schluessel = this.stand.gruppen[wire.g]
    if (!schluessel) return
    if (wire.a !== 'm' && wire.sv !== this.optionen.sichtFassung) {
      this.fremdeFassung.value = { v: wire.v, sv: wire.sv }
      this.fehler.value = { code: 'fassung' }
      return
    }
    const inhalt = await openGruppe(wire, bytes(schluessel.k))
    if (!inhalt || this.gestoppt) return
    if ('meldung' in inhalt) {
      // Erst merken, dann melden: „neu laden“ darf nach dem Neuladen nicht noch einmal wirken.
      this.stand.seen[wire.g] = wire.n
      this.speichere()
      this.liefere({ art: 'meldung', gruppe: wire.g, meldung: inhalt.meldung, n: wire.n, hz: wire.hz, nachgeholt: this.holtNach })
      return
    }
    let sicht: Json
    if ('voll' in inhalt) {
      sicht = inhalt.voll
    } else {
      const basis = this.basis.get(wire.g)
      if (!basis || inhalt.patch.base !== basis.n) {
        await this.lueckeSchliessen()
        return
      }
      try {
        sicht = applyPatch(clone(basis.sicht), inhalt.patch.ops)
      } catch {
        await this.lueckeSchliessen()
        return
      }
      // Der Fingerabdruck fängt alles ab, was beim Nachziehen schiefgehen könnte.
      if (fingerprint(sicht) !== inhalt.patch.h) {
        await this.lueckeSchliessen()
        return
      }
    }
    if (this.fehler.value?.code === 'fassung') {
      this.fehler.value = null
      this.fremdeFassung.value = null
    }
    this.basis.set(wire.g, { n: wire.n, sicht })
    const gesehen = this.stand.seen[wire.g] ?? 0
    // Beim Aufbau der Grundlage (holeNach): Älteres als das zuletzt Gesehene nur als Grundlage; den Stand, der
    // zuletzt galt, noch einmal liefern – die Anzeige steht dann wieder, ohne auf eine Änderung zu warten.
    if (wire.n < gesehen) return
    if (wire.n > gesehen) {
      this.stand.seen[wire.g] = wire.n
      this.speichere()
    }
    this.liefere({ art: 'sicht', gruppe: wire.g, sicht: clone(sicht), n: wire.n, hz: wire.hz, nachgeholt: this.holtNach })
  }

  /**
   * Schon angenommen? Über der höchsten Nummer nie; im Fenster der gemerkten Nummern nur, was dort steht – eine ältere
   * Nachricht, die erst nach einer neueren eintrifft, wirkt also noch (Prüfung unter Last 21.11.2026: ein `aufgaben`
   * nach einem Schlüsselwechsel ging so verloren); darunter (und ohne Liste) alles, wie zuvor allein mit `seen`.
   */
  private direktSchonDa(n: number): boolean {
    if (n > (this.stand.seen[DIREKT] ?? 0)) return false
    const liste = this.stand.direkt ?? []
    if (liste.length === 0 || n < liste[0]) return true
    return liste.includes(n)
  }

  private merkeDirekt(n: number): void {
    this.stand.seen[DIREKT] = Math.max(this.stand.seen[DIREKT] ?? 0, n)
    const liste = [...new Set([...(this.stand.direkt ?? []), n])].sort((a, b) => a - b)
    this.stand.direkt = liste.slice(-DIREKT_MERKEN)
  }

  private async direkt(wire: HostWire): Promise<void> {
    const ich = this.optionen.ich
    const hostBox = this.optionen.hostBox
    if (!ich || !hostBox) return
    const nachricht = await openDirekt(wire, hostBox, ich.schluessel.secretKey)
    // Nachgeprüft nach dem Öffnen (asynchron): Dieselbe Nachricht kann inzwischen über ein zweites Abo verarbeitet sein.
    if (!nachricht || this.gestoppt || this.direktSchonDa(wire.n)) return
    this.merkeDirekt(wire.n)
    const kopf = this.stand.schlange[0]
    const beantwortet = 'auf' in nachricht && kopf?.nr === nachricht.auf
    // Antworten zählen nur auf die Nachricht, die gerade wartet – eine späte zweite Quittung ändert nichts.
    const gilt = !('auf' in nachricht) || (beantwortet && (nachricht.art !== 'willkommen' || kopf.nachricht.art === 'hallo'))
    let neuAbo = false
    let neueGruppe = false
    if (gilt && nachricht.art === 'willkommen') {
      this.stand.id = nachricht.id
      this.stand.themen = nachricht.themen
      this.uebernimmSchluessel(nachricht.gruppen)
      neuAbo = true
    } else if (nachricht.art === 'schluessel') {
      neuAbo = this.uebernimmSchluessel(nachricht.gruppen)
      neueGruppe = neuAbo
    } else if (nachricht.art === 'entzogen') {
      // Öffentliches liest das Gerät weiter (K14); alles andere ist weg, auch Unbestätigtes.
      for (const g of Object.keys(this.stand.gruppen)) if (!istOeffentlich(g)) delete this.stand.gruppen[g]
      this.stand.themen = null
      this.stand.schlange = []
      this.gesendet = null
      neuAbo = true
    }
    if (gilt && beantwortet) {
      this.stand.schlange.shift()
      this.gesendet = null
    }
    this.speichere()
    if (!gilt) return
    if (neuAbo) this.neuAbonnieren()
    // Erste Liste auf einem Gerät ohne Liste (Nutzer 21.11.2026, W3-24, WKR_ANNAHMEN GF6): Der Host verteilt die Sicht
    // der neuen Gruppe, sobald er die Aufgabe setzt – oft VOR dem Schlüssel an dieses Gerät. Das neue Abo beginnt mit
    // `since` = zuletzt Gesehenes (eben der Schlüssel) und liefe an ihr vorbei; das Gerät stand dann auf
    // „verbinde …“, bis der Host die Sicht wieder schickte oder man neu lud. Darum gleich nachholen wie beim Einstieg
    // (holeNach nimmt für die neue Gruppe den neuesten frischen Vollstand).
    if (neueGruppe && this.holtNach) this.nachholenNoetig = true
    else if (neueGruppe) void this.holeNach()
    this.liefere({ art: 'direkt', nachricht, hz: wire.hz })
    this.kick()
  }

  /** Neue Gruppenschlüssel übernehmen (nie eine ältere Epoche). `true`, wenn sich die Themen geändert haben. */
  private uebernimmSchluessel(gruppen: GruppenSchluessel[]): boolean {
    let themen = false
    for (const s of gruppen) {
      if (!istGruppe(s.g)) continue
      const bisher = this.stand.gruppen[s.g]
      if (bisher && s.e < bisher.e) continue
      if (!bisher || bisher.t.join(',') !== s.t.join(',')) themen = true
      this.stand.gruppen[s.g] = { k: s.k, e: s.e, t: s.t }
    }
    return themen
  }

  // -------------------------------------------------------------------------
  // Senden
  // -------------------------------------------------------------------------

  protected async pumpe(): Promise<void> {
    const ich = this.optionen.ich
    const hostBox = this.optionen.hostBox
    if (!ich || !hostBox) return
    const sitzung = this.sitzung
    const vorbei = () => this.gestoppt || sitzung !== this.sitzung
    while (!vorbei() && this.abonniert && this.stand.schlange.length > 0) {
      const kopf = this.stand.schlange[0]
      const ziel = kopf.nachricht.art === 'hallo' && !this.stand.themen ? this.koppelThema : this.stand.themen?.g
      // Ohne Thema (noch nicht gekoppelt) wartet die Schlange auf `willkommen`.
      if (!ziel) return
      if (this.gesendet?.nr === kopf.nr) {
        const rest = this.gesendet.um + wiederholAbstand(this.zeiten.quittungMs, this.gesendet.mal) - Date.now()
        if (rest > 0) {
          await this.schlafe(rest, true)
          continue
        }
      }
      // Dieselbe Nummer bei jeder Wiederholung: Der Host erkennt so, was er schon bearbeitet hat (S2).
      const text = await sealVomGeraet({ id: this.stand.id ?? ich.id, nr: kopf.nr, nachricht: kopf.nachricht }, ich.schluessel, hostBox)
      if (vorbei()) return
      if (text.length > INLINE_GRENZE) {
        this.verwirf(kopf.nr)
        this.fehler.value = { code: 'zu-gross' }
        continue
      }
      const ergebnis = await this.post(ziel, text)
      if (vorbei()) return
      if (ergebnis.art === 'ok') {
        this.gesendet = { nr: kopf.nr, um: Date.now(), mal: this.gesendet?.nr === kopf.nr ? this.gesendet.mal + 1 : 1 }
        continue
      }
      if (ergebnis.art === 'verworfen') {
        this.verwirf(kopf.nr)
        continue
      }
      await this.warteNachFehler(ergebnis)
    }
  }

  private verwirf(nr: number): void {
    this.stand.schlange = this.stand.schlange.filter((u) => u.nr !== nr)
    this.gesendet = null
    this.speichere()
    this.liefere({ art: 'verworfen', nr })
  }
}

/** Ein Lese-Gerät (Anzeigetafel oder Zuschauer) aus dem Paket eines Lese-Links (E6; geraete/geraet.ts). */
export function lesegeraet(
  paket: LesePaket,
  speicher: GeraetSpeicher,
  sichtFassung: number,
  zeiten?: Partial<NtfyZeiten>,
  uhr?: () => number,
): GeraetTransport {
  return new GeraetTransport({
    uhr,
    server: paket.u,
    raum: paket.r,
    hostSign: bytes(paket.s),
    lesen: [paket.t],
    oeffentlich: { g: paket.g, k: paket.k, e: paket.e },
    speicher,
    sichtFassung,
    zeiten,
  })
}
