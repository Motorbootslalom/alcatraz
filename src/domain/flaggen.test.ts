import { describe, expect, it } from 'vitest'
import { bundeslandVon, flaggeVon, flaggenName, flaggenSchluessel, mehrfachGeschrieben, ohneFlagge, staatVon, STAAT_CODES } from './flaggen'
import { BUNDESLAENDER, defaultKuerzel } from './kuerzel'
import { IOC_STAATEN, ISO_STAATEN, STAAT_NAMEN, STAAT_NAMEN_FEST } from './staaten'
import { LAENDER } from './generate'
import { BUNDESLAENDER as BEISPIEL_LAENDER, CLUBS } from '../data/clubs'
import { FLAGGEN_CODES, flaggenBild, flaggenSvg } from '../flaggen/bilder'

describe('Flaggen: Zuordnung der Herkunft', () => {
  it('Bundesländer: amtliches Kürzel, Name und gängige Schreibweisen – Groß-/Kleinschreibung und Leerzeichen egal', () => {
    for (const { code, name } of BUNDESLAENDER) {
      expect(bundeslandVon(code), code).toBe(code)
      expect(bundeslandVon(code.toLowerCase()), code).toBe(code)
      expect(bundeslandVon(`DE-${code}`), code).toBe(code)
      expect(bundeslandVon(name), name).toBe(code)
      expect(bundeslandVon(`  ${name.toUpperCase()} `), name).toBe(code)
    }
    expect(bundeslandVon('baden wuerttemberg')).toBe('BW')
    expect(bundeslandVon('Baden Württemberg')).toBe('BW')
    expect(bundeslandVon('BaWü')).toBe('BW')
    expect(bundeslandVon('NRW')).toBe('NW')
    expect(bundeslandVon('nordrhein westfalen')).toBe('NW')
    expect(bundeslandVon('Rheinland Pfalz')).toBe('RP')
    expect(bundeslandVon('RLP')).toBe('RP')
    expect(bundeslandVon('Meck-Pomm')).toBe('MV')
    expect(bundeslandVon('Thueringen')).toBe('TH')
    expect(bundeslandVon('Thuringia')).toBe('TH')
    expect(bundeslandVon('Bavaria')).toBe('BY')
    expect(bundeslandVon('Freie und Hansestadt Hamburg')).toBe('HH')
    // „Sachsen“ ist nicht „Sachsen-Anhalt“ und nicht „Niedersachsen“.
    expect(bundeslandVon('Sachsen')).toBe('SN')
    expect(bundeslandVon('Sachsen Anhalt')).toBe('ST')
    expect(bundeslandVon('Niedersachsen')).toBe('NI')
    expect(bundeslandVon('')).toBe('')
    expect(bundeslandVon('Musterclub')).toBe('')
    expect(bundeslandVon('Österreich')).toBe('')
  })

  it('Staaten: ISO zwei- und dreistellig, IOC-Kürzel, deutsche und englische Namen', () => {
    const faelle: [string, string][] = [
      ['DE', 'DE'], ['deu', 'DE'], ['GER', 'DE'], ['Deutschland', 'DE'], ['germany', 'DE'], [' GERMANY ', 'DE'],
      ['NL', 'NL'], ['NLD', 'NL'], ['NED', 'NL'], ['Niederlande', 'NL'], ['Netherlands', 'NL'], ['Holland', 'NL'],
      ['CH', 'CH'], ['CHE', 'CH'], ['SUI', 'CH'], ['Schweiz', 'CH'], ['Switzerland', 'CH'],
      ['AT', 'AT'], ['AUT', 'AT'], ['Österreich', 'AT'], ['Oesterreich', 'AT'], ['OSTERREICH', 'AT'], ['Austria', 'AT'],
      ['LAT', 'LV'], ['LVA', 'LV'], ['Lettland', 'LV'], ['Latvia', 'LV'],
      ['POR', 'PT'], ['DEN', 'DK'], ['CRO', 'HR'], ['SLO', 'SI'], ['SVK', 'SK'], ['BUL', 'BG'], ['GRE', 'GR'],
      ['UAE', 'AE'], ['KUW', 'KW'], ['KSA', 'SA'], ['RSA', 'ZA'],
      ['GBR', 'GB'], ['UK', 'GB'], ['Großbritannien', 'GB'], ['Grossbritannien', 'GB'], ['Great Britain', 'GB'], ['United Kingdom', 'GB'], ['Vereinigtes Königreich', 'GB'],
      ['USA', 'US'], ['United States', 'US'], ['Vereinigte Staaten', 'US'],
      ['Tschechien', 'CZ'], ['Czech Republic', 'CZ'], ['CZE', 'CZ'],
      ['Türkei', 'TR'], ['Tuerkei', 'TR'], ['Turkey', 'TR'],
      ['England', 'GB-ENG'], ['Schottland', 'GB-SCT'], ['SCO', 'GB-SCT'],
      ['Polen', 'PL'], ['Poland', 'PL'], ['POL', 'PL'], ['Estland', 'EE'], ['EST', 'EE'], ['Litauen', 'LT'], ['Italien', 'IT'], ['Ungarn', 'HU'], ['HUN', 'HU'],
      ['Schweden', 'SE'], ['SWE', 'SE'], ['Norwegen', 'NO'], ['Finnland', 'FI'], ['Frankreich', 'FR'], ['Slowakei', 'SK'],
    ]
    for (const [text, code] of faelle) expect(staatVon(text), text).toBe(code)
    expect(staatVon('')).toBe('')
    expect(staatVon('Musterland')).toBe('')
    expect(staatVon('Bayern')).toBe('')
  })

  it('Namen mit „und“/„and“/„&“ und mit „Saint“/„St.“ – und solche, die der Browser anders schreibt', () => {
    const faelle: [string, string][] = [
      ['Bosnia and Herzegovina', 'BA'], ['Bosnia & Herzegovina', 'BA'], ['Bosnien und Herzegowina', 'BA'], ['Bosnien-Herzegowina', 'BA'], ['BIH', 'BA'],
      ['Trinidad and Tobago', 'TT'], ['Trinidad & Tobago', 'TT'], ['Trinidad und Tobago', 'TT'],
      ['Antigua and Barbuda', 'AG'], ['Saint Kitts and Nevis', 'KN'], ['St. Kitts und Nevis', 'KN'], ['Saint Lucia', 'LC'], ['St. Lucia', 'LC'],
      ['Kap Verde', 'CV'], ['Kongo', 'CG'], ['Congo', 'CG'], ['DR Kongo', 'CD'], ['Chinese Taipei', 'TW'], ['TPE', 'TW'],
      ['Republic of Korea', 'KR'], ['Slowakische Republik', 'SK'], ['Slovak Republic', 'SK'], ['Burma', 'MM'], ['Swaziland', 'SZ'],
      ['East Timor', 'TL'], ['Åland', 'AX'], ['Aland', 'AX'], ['Hong Kong', 'HK'], ['Hongkong', 'HK'], ['Macau', 'MO'],
      ['United Arab Emirates', 'AE'], ['Vereinigte Arabische Emirate', 'AE'],
    ]
    for (const [text, code] of faelle) expect(staatVon(text), text).toBe(code)
    // Ein einzelnes Wort bleibt, was es ist: „AND“ ist Andorra, kein Bindewort.
    expect(staatVon('AND')).toBe('AD')
    expect(flaggenSchluessel('and')).toBe('and')
    expect(flaggenSchluessel('Bosnia and Herzegovina')).toBe(flaggenSchluessel('Bosnia & Herzegovina'))
    expect(flaggenSchluessel('Saint Lucia')).toBe('stlucia')
  })

  it('die europäischen Staaten sind deutsch und englisch fest eingetragen – unabhängig vom Browser', () => {
    const europa = 'AL AD AM AT AZ BY BE BA BG HR CY CZ DK EE FI FR GE DE GR HU IS IE IT KZ XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH TR UA GB VA'.split(' ')
    for (const code of europa) {
      const namen = STAAT_NAMEN_FEST[code]
      expect(namen, code).toBeDefined()
      for (const name of namen) {
        expect(staatVon(name), name).toBe(code)
        expect(staatVon(name.toUpperCase()), name).toBe(code)
      }
      expect(flaggenName({ art: 'staat', code, kuerzel: '' }, 'de')).toBe(namen[0])
      expect(flaggenName({ art: 'staat', code, kuerzel: '' }, 'en')).toBe(namen[1])
    }
    for (const code of Object.keys(STAAT_NAMEN_FEST)) expect(STAAT_CODES, code).toContain(code)
  })

  it('„Baden“ und „Württemberg“ allein sind kein Bundesland (Landesteile, oft eigene Verbände)', () => {
    expect(bundeslandVon('Baden')).toBe('')
    expect(bundeslandVon('Württemberg')).toBe('')
  })

  it('nennt Länder, die in mehreren Schreibweisen vorkommen – die häufigste zuerst', () => {
    const namen = ['NRW', 'Nordrhein-Westfalen', 'nrw', 'NRW ', 'Bayern', 'BAYERN', 'Atlantis', 'Atlantis 2', '', 'Meck-Pomm', 'Mecklenburg-Vorpommern', 'Mecklenburg-Vorpommern']
    expect(mehrfachGeschrieben(namen, 'bundesland')).toEqual([
      ['Mecklenburg-Vorpommern', 'Meck-Pomm'],
      ['NRW', 'Nordrhein-Westfalen'],
    ])
    expect(mehrfachGeschrieben(['GER', 'Germany', 'Deutschland', 'NED'], 'land')).toEqual([['GER', 'Germany', 'Deutschland']])
    expect(mehrfachGeschrieben(namen, 'verein')).toEqual([])
    expect(mehrfachGeschrieben(['Bayern', 'bayern'], 'bundesland')).toEqual([])
  })

  it('der ISO-Code gilt vor einem gleich lautenden IOC-Kürzel; kein IOC-Kürzel verdrängt einen ISO-Code', () => {
    const alpha3 = new Map(ISO_STAATEN.split(' ').map((p) => p.split(':').reverse() as [string, string]))
    for (const paar of IOC_STAATEN.split(' ')) {
      const [ioc, alpha2] = paar.split(':')
      // Entweder kein ISO-Code – oder derselbe Staat.
      expect(alpha3.get(ioc) ?? alpha2, ioc).toBe(alpha2)
      expect(staatVon(ioc), ioc).toBe(alpha2)
    }
    // BRN ist nach ISO Brunei (beim IOC Bahrain).
    expect(staatVon('BRN')).toBe('BN')
  })

  it('die Art der Herkunft entscheidet: „BY“ ist als Bundesland Bayern, als Land Belarus; Vereine haben keine Flagge', () => {
    expect(flaggeVon('BY', 'bundesland')).toEqual({ art: 'bundesland', code: 'BY', kuerzel: 'BY' })
    expect(flaggeVon('BY', 'land')).toEqual({ art: 'staat', code: 'BY', kuerzel: 'BLR' })
    expect(flaggeVon('Germany', 'land')).toEqual({ art: 'staat', code: 'DE', kuerzel: 'DEU' })
    expect(flaggeVon('Bayern', 'verein')).toBeUndefined()
    expect(flaggeVon('Bayern', 'none')).toBeUndefined()
    expect(flaggeVon('Bayern', 'land')).toBeUndefined()
    expect(flaggeVon('Deutschland', 'bundesland')).toBeUndefined()
  })

  it('für jede Kennung, zu der die Zuordnung führen kann, gibt es ein Bild – und kein Bild ohne Zuordnung', () => {
    expect([...FLAGGEN_CODES.bundesland].sort()).toEqual(BUNDESLAENDER.map((l) => l.code).sort())
    expect([...FLAGGEN_CODES.staat].sort()).toEqual([...STAAT_CODES].sort())
    for (const ziel of [...IOC_STAATEN.split(' ').map((p) => p.split(':')[1]), ...Object.values(STAAT_NAMEN)]) expect(STAAT_CODES, ziel).toContain(ziel)
    for (const art of ['staat', 'bundesland'] as const) {
      for (const code of FLAGGEN_CODES[art]) {
        const bild = flaggenBild({ art, code })
        expect(flaggenSvg({ art, code }), code).toMatch(/^<svg [^>]*viewBox="/)
        expect(bild?.src.startsWith('data:image/svg+xml,'), code).toBe(true)
        expect(bild!.breite / bild!.hoehe, code).toBeGreaterThanOrEqual(1.4)
        expect(bild!.breite / bild!.hoehe, code).toBeLessThanOrEqual(1.7)
      }
    }
    // Nichts wird nachgeladen: keine Verweise nach außen in den Bildern.
    for (const art of ['staat', 'bundesland'] as const) for (const code of FLAGGEN_CODES[art]) expect(flaggenSvg({ art, code }), code).not.toMatch(/href="(?!#)|url\((?!#)/)
  })

  it('Textalternative: der Name des Landes, Staaten in der Sprache der Liste', () => {
    expect(flaggenName({ art: 'bundesland', code: 'BB', kuerzel: 'BB' })).toBe('Brandenburg')
    expect(flaggenName({ art: 'staat', code: 'DE', kuerzel: 'DEU' }, 'de')).toBe('Deutschland')
    expect(flaggenName({ art: 'staat', code: 'DE', kuerzel: 'DEU' }, 'en')).toBe('Germany')
    expect(flaggenName({ art: 'staat', code: 'GB-SCT', kuerzel: 'SCO' }, 'en')).toBe('Scotland')
  })

  it('nennt die Angaben ohne Flagge – je Schreibweise einmal, Leeres nicht, bei Vereinen keine', () => {
    expect(ohneFlagge(['Bayern', 'Bayrn', 'bayrn', '', '  ', 'Atlantis', 'BY'], 'bundesland')).toEqual(['Atlantis', 'Bayrn'])
    expect(ohneFlagge(['Germany', 'Atlantis'], 'land')).toEqual(['Atlantis'])
    expect(ohneFlagge(['Musterclub'], 'verein')).toEqual([])
    expect(ohneFlagge(['Musterclub'], 'none')).toEqual([])
  })

  it('das Beispiel-Starterfeld zeigt Flaggen: Jede erfundene Herkunft wird erkannt', () => {
    for (const land of LAENDER) expect(flaggeVon(land, 'land'), land).toBeDefined()
    for (const land of [...BEISPIEL_LAENDER, ...CLUBS.map((c) => c.bundesland)]) expect(flaggeVon(land, 'bundesland'), land).toBeDefined()
  })

  it('Schlüssel und Kürzel-Vorgaben: Umlaute, ß und Satzzeichen zählen nicht; alle Staaten haben ein ISO-Kürzel', () => {
    expect(flaggenSchluessel(' Baden-Württemberg ')).toBe('badenwurttemberg')
    expect(flaggenSchluessel('Großbritannien')).toBe('grossbritannien')
    expect(defaultKuerzel('Österreich')).toBe('AUT')
    expect(defaultKuerzel('Slowenien')).toBe('SVN')
    expect(defaultKuerzel('Neuseeland')).toBe('NZL')
    expect(defaultKuerzel('Bayern')).toBe('BY')
  })
})
