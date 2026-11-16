import { ref, type Ref } from 'vue'
import {
  auszusondern,
  eintragFuer,
  entscheideStart,
  type Beschreibung,
  type Speichermarke,
  type VerlaufEintrag,
  type VerlaufGrenzen,
} from '../lib/verlauf'
import { oeffneZweitspeicher, type Schreibauftrag, type Zweitspeicher } from '../persistenz/zweitspeicher'

/**
 * Zweiter Speicher und Verlauf aus Sicht des Stores: wann geschrieben wird, was beim Start gilt
 * und was die Einstellungen damit tun können.
 *
 * WANN GESCHRIEBEN WIRD. Jede Änderung geht sofort hinaus – ohne Wartezeit, die erst ablaufen
 * müsste. Es läuft aber immer nur EIN Schreibvorgang; kommen währenddessen weitere Änderungen,
 * wartet nur die jüngste (ältere Zwischenstände braucht niemand) und geht hinaus, sobald der
 * laufende fertig ist. Damit ist das offene Zeitfenster so lang wie ein Schreibvorgang (gemessen
 * in Chromium bei 336 Startern: im Mittel 5 ms, höchstens 26 ms; bei pausenlosen Eingaben
 * höchstens 47 ms – siehe docs/betrieb.md), und schnelles Tippen staut nichts auf: Das Schreiben
 * geschieht im Hintergrund, die Eingabe gibt nur den fertigen Text ab. Eine feste Verzögerung
 * („erst 300 ms nach dem letzten Tastendruck“) hielte dagegen genau das Fenster offen, das der
 * zweite Speicher schließen soll. Wird die Seite verborgen oder verlassen, geht auch ein
 * wartender Stand sofort hinaus, ohne auf den laufenden zu warten.
 */
export type ZweitLage = 'pruefen' | 'bereit' | 'nicht-verfuegbar' | 'gestoert'

export interface Zweit {
  /** `nicht-verfuegbar`: kein zweiter Speicher in diesem Browser. `gestoert`: Das letzte Schreiben ist gescheitert. */
  lage: Ref<ZweitLage>
  /** Beim Start war der zweite Speicher neuer: `zeit` ist der Zeitpunkt des wiederhergestellten Stands. */
  wiederhergestellt: Ref<{ zeit: number } | null>
  /** Zählt bei jeder Änderung am Verlauf – die Liste liest dann neu. */
  version: Ref<number>
  /** Folge-Nummer des jetzigen Stands: Der Eintrag mit dieser Nummer ist der jetzige Stand. */
  folge: Ref<number>
  eintraege(): Promise<VerlaufEintrag[]>
  /** „Stand merken“: den jetzigen Stand mit Namen ablegen. `false`, wenn es nicht ging. */
  merke(name: string): Promise<boolean>
  /** Der Text eines Stands aus dem Verlauf; `null`, wenn es ihn nicht (mehr) gibt. */
  stand(id: string): Promise<string | null>
  loesche(id: string): Promise<void>
  /** Wartet, bis alles geschrieben ist, was aussteht (vor dem Wiederherstellen; in Tests). */
  fertig(): Promise<void>
}

export interface ZweitIntern extends Zweit {
  /** Vom Store bei jeder Speicherung: der Text, seine Marke und wie die Änderung heißt. */
  notiere(json: string, marke: Speichermarke, was: Beschreibung | null, leeren?: boolean): void
  /** Ein anderes Fenster hat geschrieben: Dessen Einträge liegen jetzt hinter dem eigenen letzten. */
  fremd(marke: Speichermarke | null): void
  /** Alles Wartende sofort schreiben (Seite wird verborgen oder verlassen). */
  sofort(): void
}

export interface ZweitUmgebung {
  /** `indexedDB` des Browsers; fehlt sie, gibt es keinen zweiten Speicher. */
  fabrik: IDBFactory | undefined | null
  /** Folge-Nummer des Stands, mit dem die Seite geladen wurde. */
  folge: number
  /** Was gerade im localStorage liegt. `leer`: ein Stand ohne Starter (nichts, was man aufheben müsste). */
  erster(): { json: string | null; marke: Speichermarke | null; leer: boolean }
  /** Den Stand aus dem zweiten Speicher übernehmen; `false`, wenn er sich nicht lesen lässt. */
  uebernimm(json: string, marke: Speichermarke): boolean
  /** Dem Stand im localStorage eine Marke geben (er hat keine) und ihn wie eine Änderung speichern. */
  stempel(mindestens: number, was: Beschreibung): void
  /** Der jetzige Stand als Text mit seiner Marke. */
  jetzigerText(): { json: string; marke: Speichermarke }
  /**
   * Merker „der Verlauf ist noch zu leeren“, der ein Neuladen übersteht (der Store legt ihn in
   * den localStorage). Fehlt er, gilt der Merker nur, solange das Fenster offen ist.
   */
  leerenOffen?: { lies(): boolean; setze(offen: boolean): void }
  jetzt?: () => number
  grenzen?: VerlaufGrenzen
}

interface Wartend {
  json: string
  marke: Speichermarke
  aenderungen: (Beschreibung | null)[]
  leeren: boolean
  nurWennNeuer: boolean
  /** Kennung eines eben erst angelegten Eintrags, den diese Änderung ersetzt (siehe `ebenAngelegt`). */
  ersetzt?: string
}

let zaehler = 0
/** Kennung eines Eintrags: Zeitpunkt, Zähler und Zufall – eindeutig auch über mehrere Fenster. */
const neueId = () => `${Date.now().toString(36)}-${(zaehler++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function createZweit(um: ZweitUmgebung): ZweitIntern {
  const jetzt = um.jetzt ?? (() => Date.now())
  const lage = ref<ZweitLage>(um.fabrik ? 'pruefen' : 'nicht-verfuegbar')
  const wiederhergestellt = ref<{ zeit: number } | null>(null)
  const version = ref(0)
  const folge = ref(um.folge)

  let db: Zweitspeicher | null = null
  /** Erst nach dem Abgleich beim Start wird geschrieben – vorher wartet alles. */
  let abgeglichen = false
  let wartend: Wartend | null = null
  /** Laufende Schreibvorgänge (in der Regel einer; beim Verlassen der Seite kurz zwei). */
  const laufend = new Set<Promise<unknown>>()
  /** Der Eintrag, den dieses Fenster zuletzt geschrieben hat – nur er wird fortgeschrieben. */
  let letzter: VerlaufEintrag | null = null
  /**
   * Ein Eintrag, der in DIESEM Augenblick (derselben Aufgabe des Browsers) angelegt wurde. Ein
   * Knopfdruck löst manchmal zwei Actions aus („Beispiel-Starterfeld“: erst leeren, dann
   * anlegen). Die erste ist schon unterwegs, wenn die zweite kommt; ihr Zwischenstand soll
   * aber kein eigener Eintrag bleiben. Die zweite übernimmt deshalb dessen Platz.
   */
  let ebenAngelegt: string | null = null
  /**
   * „Alles zurücksetzen“ sagt zu, dass der Verlauf mit allen gemerkten Ständen gelöscht wird.
   * Scheitert genau dieser Schreibvorgang (voller oder kurz gesperrter Speicher), darf das
   * Leeren nicht verloren gehen – sonst lägen Namen und Ergebnisse der vorigen Veranstaltung
   * still weiter im Verlauf. Der Merker bleibt, bis ein Schreibvorgang MIT Leeren gelungen ist:
   * Jeder weitere Auftrag leert dann zuerst, und der nächste Start räumt vor dem Abgleich auf.
   */
  let leerenImFenster = false
  const leerenOffen = () => {
    try {
      return um.leerenOffen ? um.leerenOffen.lies() : leerenImFenster
    } catch {
      return leerenImFenster
    }
  }
  const setzeLeerenOffen = (offen: boolean) => {
    leerenImFenster = offen
    try {
      um.leerenOffen?.setze(offen)
    } catch {
      // Der localStorage nimmt nichts an: Der Merker gilt dann, solange das Fenster offen ist.
    }
  }

  function verfolge<T>(p: Promise<T>): Promise<T> {
    laufend.add(p)
    const ende = () => {
      laufend.delete(p)
      pumpe()
    }
    p.then(ende, ende)
    return p
  }

  function notiere(json: string, marke: Speichermarke, was: Beschreibung | null, leeren = false) {
    folge.value = marke.folge
    if (lage.value === 'nicht-verfuegbar') return
    // Nach „Alles zurücksetzen“ zählt nichts mehr, was davor wartete.
    const davor = leeren ? [] : (wartend?.aenderungen ?? [])
    wartend = {
      json,
      marke,
      aenderungen: [...davor, was],
      leeren: leeren || (wartend?.leeren ?? false),
      nurWennNeuer: false,
      ersetzt: leeren ? undefined : (wartend?.ersetzt ?? ebenAngelegt ?? undefined),
    }
    pumpe()
  }

  function pumpe(auchNebenher = false) {
    if (!db || !abgeglichen || !wartend) return
    if (laufend.size > 0 && !auchNebenher) return
    // Ein Leeren, das zuvor gescheitert ist, wird mit diesem Auftrag nachgeholt.
    const w = !wartend.leeren && leerenOffen() ? { ...wartend, leeren: true, nurWennNeuer: false, ersetzt: undefined } : wartend
    wartend = null
    if (w.leeren) letzter = null
    const zeit = jetzt()
    let eintrag = eintragFuer(letzter, w.aenderungen, { groesse: w.json.length, folge: w.marke.folge }, zeit, neueId)
    const neu = !!eintrag && eintrag.id !== letzter?.id
    // Ein neuer Eintrag, wo der vorige im selben Augenblick entstand: Er nimmt dessen Platz ein.
    if (eintrag && neu && letzter && w.ersetzt === letzter.id) eintrag = { ...eintrag, id: letzter.id, von: letzter.von }
    if (eintrag) letzter = eintrag
    if (eintrag && neu && !ebenAngelegt) {
      ebenAngelegt = eintrag.id
      // Nach dieser Aufgabe des Browsers ist der Augenblick vorbei.
      queueMicrotask(() => (ebenAngelegt = null))
    }
    const auftrag: Schreibauftrag = {
      aktuell: { ...w.marke, json: w.json },
      eintraege: eintrag ? [{ eintrag, json: w.json }] : [],
      leeren: w.leeren,
      nurWennNeuer: w.nurWennNeuer,
    }
    void verfolge(
      db.schreibe(auftrag).then(
        (geschrieben) => {
          lage.value = 'bereit'
          // Ein anderes Fenster war weiter: Der Eintrag ist nicht entstanden.
          if (!geschrieben && letzter === eintrag) letzter = null
          if (geschrieben && w.leeren) setzeLeerenOffen(false)
          version.value++
          if (geschrieben && neu) void raeumeAuf()
        },
        () => {
          // Voller oder inzwischen gesperrter Speicher: Die Anwendung läuft mit dem localStorage
          // weiter; die nächste Änderung versucht es wieder (mit einem neuen Eintrag).
          lage.value = 'gestoert'
          if (letzter === eintrag) letzter = null
          if (w.leeren) setzeLeerenOffen(true)
        },
      ),
    )
  }

  /** Von selbst angelegte Stände, die über den Grenzen liegen, weichen den neueren. */
  function raeumeAuf(): Promise<void> {
    const speicher = db
    if (!speicher) return Promise.resolve()
    return verfolge(
      speicher
        .eintraege()
        .then((alle) => speicher.loesche(auszusondern(alle, jetzt(), um.grenzen)))
        .catch(() => undefined),
    )
  }

  async function starte() {
    db = await oeffneZweitspeicher(um.fabrik)
    if (!db) {
      lage.value = 'nicht-verfuegbar'
      wartend = null
      return
    }
    try {
      // Ein Leeren aus der vorigen Sitzung steht noch aus: zuerst aufräumen. Danach ist der
      // zweite Speicher leer, und der Stand des localStorage (der zurückgesetzte) wird nachgezogen.
      if (leerenOffen()) {
        await db.schreibe({ leeren: true })
        setzeLeerenOffen(false)
      }
      const zweit = await db.liesAktuell()
      // Frisch gelesen, nicht der Stand vom Laden der Seite: Ein anderes Fenster kann inzwischen
      // geschrieben haben – dann ist der zweite Speicher nicht „neuer nach einem Abbruch“.
      const erster = um.erster()
      const wahl = entscheideStart({ vorhanden: erster.json !== null, marke: erster.marke }, zweit)
      if (wahl === 'zweit' && zweit && um.uebernimm(zweit.json, zweit)) {
        folge.value = zweit.folge
        wiederhergestellt.value = { zeit: zweit.zeit }
        // Was eben noch wartete, war der ältere Stand aus dem localStorage.
        wartend = null
        const zeit = jetzt()
        const eintraege: Schreibauftrag['eintraege'] = []
        // Der verdrängte Stand bleibt im Verlauf – falls doch er der richtige war.
        if (erster.json && !erster.leer) {
          eintraege.push({
            eintrag: { id: neueId(), von: zeit, zeit, was: { art: 'verdraengt' }, anzahl: 1, groesse: erster.json.length, folge: erster.marke?.folge ?? 0 },
            json: erster.json,
          })
        }
        const abbruch: VerlaufEintrag = { id: neueId(), von: zeit + 1, zeit: zeit + 1, was: { art: 'abbruch', zeit: zweit.zeit }, anzahl: 1, groesse: zweit.json.length, folge: zweit.folge }
        eintraege.push({ eintrag: abbruch, json: zweit.json })
        letzter = abbruch
        void verfolge(db.schreibe({ eintraege }).then(() => version.value++, () => (lage.value = 'gestoert')))
      } else if (wahl === 'ohneMarke') {
        um.stempel((zweit?.folge ?? 0) + 1, { art: 'start' })
      } else if ((wahl === 'erster' || wahl === 'zweit') && erster.json && erster.marke && !wartend) {
        // Der localStorage ist weiter (oder der zweite Speicher unlesbar): nachziehen.
        wartend = { json: erster.json, marke: erster.marke, aenderungen: [{ art: 'start' }], leeren: false, nurWennNeuer: true }
      }
      lage.value = 'bereit'
    } catch {
      lage.value = 'gestoert'
    }
    abgeglichen = true
    pumpe()
  }

  async function fertig() {
    await bereit
    while (laufend.size > 0 || (wartend && db && abgeglichen)) {
      if (laufend.size === 0) pumpe()
      await Promise.allSettled([...laufend])
    }
  }

  const bereit = starte().catch(() => {
    lage.value = 'nicht-verfuegbar'
  })

  return {
    lage,
    wiederhergestellt,
    version,
    folge,
    notiere,
    fremd(marke) {
      letzter = null
      if (marke) folge.value = Math.max(folge.value, marke.folge)
      version.value++
    },
    sofort: () => pumpe(true),
    fertig,
    async eintraege() {
      await bereit
      return db ? db.eintraege().catch(() => []) : []
    },
    async merke(name) {
      await fertig()
      if (!db) return false
      const { json, marke } = um.jetzigerText()
      const zeit = jetzt()
      const eintrag: VerlaufEintrag = { id: neueId(), von: zeit, zeit, was: { art: 'gemerkt' }, anzahl: 1, name, groesse: json.length, folge: marke.folge }
      // Steht ein Leeren noch aus, geht es mit: Sonst löschte es später den eben gemerkten Stand.
      const leeren = leerenOffen()
      try {
        await verfolge(db.schreibe({ aktuell: leeren ? { ...marke, json } : undefined, eintraege: [{ eintrag, json }], leeren }))
      } catch {
        lage.value = 'gestoert'
        return false
      }
      if (leeren) setzeLeerenOffen(false)
      // Die nächste Änderung beginnt einen neuen Eintrag: Der gemerkte Stand liegt dazwischen.
      letzter = null
      version.value++
      return true
    },
    async stand(id) {
      await fertig()
      return db ? db.stand(id).catch(() => null) : null
    },
    async loesche(id) {
      await fertig()
      if (!db) return
      if (letzter?.id === id) letzter = null
      await verfolge(db.loesche([id]).catch(() => undefined))
      version.value++
    },
  }
}
