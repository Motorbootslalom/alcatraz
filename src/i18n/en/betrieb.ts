import type de from '../de/betrieb'

/**
 * Englisch zu de/betrieb.ts – genau dieselben Schlüssel. „Display board“, „start release“ und „begin
 * attempt N“ sind vorläufig (Plan vom 16.11.2026, §7 Nr. 19): Das Rulebook hat kein Wort für den Ablauf am
 * Steg. „Attempt“, „course“, „driver“ und „pontoon“ nach Regel 960.
 */
export default {
  'betrieb.title': 'Start release',
  'betrieb.hint':
    'Release here who starts next. The display board shows it at once – in a window of its own, for example on a second screen. The order of starts is that of the locked interleaving, attempt by attempt.',
  'betrieb.oeffnen': 'Open display board',
  'betrieb.oeffnen.hint': 'Opens a window of its own; press F there for full screen.',
  'betrieb.oeffnen.bereich': 'Separate display board',
  'betrieb.oeffnen.bereichTitel': 'Open a display board for {name} only',
  'betrieb.einstellungen': 'Display board settings',
  'betrieb.vorVerzahnung':
    'Start release begins once the interleaving is locked – only then are the start numbers and the order of starts fixed:',
  'betrieb.geloest':
    'The interleaving is no longer locked: “Next start” and “Begin attempt” are on hold until it is locked again. Back, messages and reset still work:',
  'betrieb.leer': 'No driver is on a course yet.',
  'betrieb.zuruecksetzen': 'Reset operation',
  'betrieb.zuruecksetzen.frage': 'Reset operation?',
  'betrieb.zuruecksetzen.text':
    'Begun attempts, shown starts and messages of all courses are cleared; the display board shows “ready” again. Drivers, interleaving and entered values remain.',
  'betrieb.zuruecksetzen.ja': 'Reset',
  'betrieb.imBoot': 'In the boat',
  'betrieb.keiner': 'No start shown yet.',
  'betrieb.geloescht': 'Driver deleted – the display board shows “ready”.',
  'betrieb.davor': 'previous',
  'betrieb.naechster': 'Next',
  'betrieb.lauf': 'Attempt {n}',
  'betrieb.laeufe': 'Attempts {von}–{bis}',
  'betrieb.laufend': '{punkt} in progress',
  'betrieb.offen': '{n} start to go | {n} starts to go',
  'betrieb.nichtBegonnen': 'No attempt begun yet.',
  'betrieb.punktZuEnde': '{punkt} is complete – the display board keeps showing the last start.',
  'betrieb.alleZuEnde': 'All attempts are complete.',
  'betrieb.zeigen': 'Next start',
  'betrieb.zurueck': 'Back',
  'betrieb.zurueck.title': 'Take back the start shown last',
  'betrieb.beginnen': 'Begin attempt {n}',
  'betrieb.beginnen.laeufe': 'Begin attempts {von}–{bis}',
  'betrieb.beginnen.frage': 'Begin the next attempt?',
  'betrieb.beginnen.text':
    'The current attempt still has {n} start to go. It stays released and comes before the starts of the new attempt. | The current attempt still has {n} starts to go. They stay released and come before the starts of the new attempt.',
  'betrieb.nachzuholen': 'To be made up',
  'betrieb.nachzuholen.hint':
    'Starts before the one shown last that have not had their turn – after a late entry, a removed X or a missed attempt. They never become the next start by themselves.',
  'betrieb.nachzuholen.zeigen': 'Show now',
  'betrieb.meldung': 'Message',
  'betrieb.meldung.hint': 'A disruption or break replaces the driver on the display board; a notice is shown below.',
  'betrieb.meldung.platzhalter': 'Text for the display board …',
  'betrieb.meldung.setzen': 'Show message',
  'betrieb.meldung.alle': 'Show on all courses',
  'betrieb.meldung.loeschen': 'Clear message',
  'betrieb.meldung.aktiv': 'On the display board ({art}): “{text}”',

  'anzeige.titel': 'Display board',
  'anzeige.bereit': 'ready',
  'anzeige.davor': 'previous',
  'anzeige.keineStarter': 'No drivers yet',

  'meldung.info': 'Notice',
  'meldung.stoerung': 'Disruption',
  'meldung.pause': 'Break',
} satisfies Record<keyof typeof de, string>
