/**
 * Staaten und Gebiete: Codes nach ISO 3166-1 (zweistellig → dreistellig), dazu die im Sport
 * üblichen Kürzel (IOC, wie sie auch die UIM führt) und gängige Namen, die der Browser nicht
 * von selbst kennt. Eine Quelle für die Kürzel-Vorgaben (domain/kuerzel.ts) und für die
 * Zuordnung der Flaggen (domain/flaggen.ts).
 *
 * Die Liste umfasst genau die Codes, für die der Flaggensatz ein Bild hat (flaggen/bilder.ts;
 * ein Test hält beides beieinander). Die ausgeschriebenen Namen liefert der Browser (Intl);
 * die der europäischen Staaten und der im Sport üblichen stehen zusätzlich fest hier
 * (`STAAT_NAMEN_FEST`), damit die Zuordnung nicht vom Stand des Browsers abhängt.
 */
export const ISO_STAATEN =
  'AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW ' +
  'AX:ALA AZ:AZE BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN ' +
  'BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ CA:CAN CC:CCK CD:COD CF:CAF CG:COG ' +
  'CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE ' +
  'DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN ' +
  'FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL ' +
  'GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY HK:HKG HM:HMD HN:HND HR:HRV ' +
  'HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM ' +
  'JO:JOR JP:JPN KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO ' +
  'LB:LBN LC:LCA LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY MA:MAR MC:MCO MD:MDA ME:MNE ' +
  'MF:MAF MG:MDG MH:MHL MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS ' +
  'MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL ' +
  'NR:NRU NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI ' +
  'PS:PSE PT:PRT PW:PLW PY:PRY QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA SA:SAU SB:SLB SC:SYC SD:SDN ' +
  'SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ST:STP SV:SLV ' +
  'SX:SXM SY:SYR SZ:SWZ TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON ' +
  'TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB VA:VAT VC:VCT VE:VEN ' +
  'VG:VGB VI:VIR VN:VNM VU:VUT WF:WLF WS:WSM YE:YEM YT:MYT ZA:ZAF ZM:ZMB ZW:ZWE XK:XKX'

/**
 * Kürzel des IOC, wo sie vom dreistelligen ISO-Code abweichen (GER statt DEU, NED statt NLD,
 * SUI statt CHE …) – so stehen die Nationen in Ausschreibungen und Ergebnissen der UIM.
 * Ein IOC-Kürzel, das zugleich ISO-Code eines anderen Staates ist (BRN: IOC Bahrain, ISO
 * Brunei), fehlt: Der ISO-Code gilt.
 */
export const IOC_STAATEN =
  'ALG:DZ ANG:AO ANT:AG ARU:AW ASA:AS BAH:BS BAN:BD BAR:BB BER:BM BHU:BT BIZ:BZ BOT:BW BRU:BN BUL:BG ' +
  'BUR:BF CAM:KH CAY:KY CGO:CG CHA:TD CHI:CL CRC:CR CRO:HR DEN:DK ESA:SV FIJ:FJ GAM:GM GBS:GW GEQ:GQ ' +
  'GER:DE GRE:GR GRN:GD GUA:GT GUI:GN HAI:HT HON:HN INA:ID IRI:IR ISV:VI IVB:VG KOS:XK KSA:SA KUW:KW ' +
  'LAT:LV LBA:LY LES:LS LIB:LB MAD:MG MAS:MY MAW:MW MGL:MN MON:MC MRI:MU MTN:MR MYA:MM NCA:NI NED:NL ' +
  'NEP:NP NGR:NG NIG:NE OMA:OM PAR:PY PHI:PH PLE:PS POR:PT PUR:PR ROM:RO RSA:ZA SAM:WS SEY:SC SIN:SG ' +
  'SKN:KN SLO:SI SOL:SB SRI:LK SUD:SD SUI:CH TAN:TZ TGA:TO TOG:TG TPE:TW TRI:TT UAE:AE URU:UY VAN:VU ' +
  'VIE:VN VIN:VC ZAM:ZM ZIM:ZW ENG:GB-ENG SCO:GB-SCT WAL:GB-WLS NIR:GB-NIR'

/**
 * Namen und Schreibweisen, die Intl nicht liefert: umgangssprachliche („Holland“), ältere
 * („Weißrussland“) und die Landesteile des Vereinigten Königreichs. Klein geschrieben; die
 * Zuordnung gleicht Groß-/Kleinschreibung, Leerzeichen und Umlaute selbst aus.
 */
export const STAAT_NAMEN: Readonly<Record<string, string>> = {
  brd: 'DE',
  'bundesrepublik deutschland': 'DE',
  holland: 'NL',
  'the netherlands': 'NL',
  großbritannien: 'GB',
  'great britain': 'GB',
  britain: 'GB',
  uk: 'GB',
  england: 'GB-ENG',
  schottland: 'GB-SCT',
  scotland: 'GB-SCT',
  wales: 'GB-WLS',
  nordirland: 'GB-NIR',
  'northern ireland': 'GB-NIR',
  amerika: 'US',
  america: 'US',
  'united states of america': 'US',
  'vereinigte staaten von amerika': 'US',
  tschechien: 'CZ',
  'tschechische republik': 'CZ',
  czechia: 'CZ',
  'czech republic': 'CZ',
  weißrussland: 'BY',
  'white russia': 'BY',
  'russische föderation': 'RU',
  'russian federation': 'RU',
  türkei: 'TR',
  turkey: 'TR',
  türkiye: 'TR',
  mazedonien: 'MK',
  macedonia: 'MK',
  vae: 'AE',
  emirate: 'AE',
  emirates: 'AE',
  korea: 'KR',
  'south korea': 'KR',
  moldawien: 'MD',
  moldau: 'MD',
  bosnien: 'BA',
  bosnia: 'BA',
  vatikan: 'VA',
  vatican: 'VA',
  elfenbeinküste: 'CI',
  'ivory coast': 'CI',
  'bosnien herzegowina': 'BA',
  'kap verde': 'CV',
  kapverden: 'CV',
  // „Kongo“ ohne Zusatz ist nach ISO und IOC (CGO) die Republik Kongo; die Demokratische Republik nennt sich so.
  kongo: 'CG',
  congo: 'CG',
  'republik kongo': 'CG',
  'republic of the congo': 'CG',
  'dr kongo': 'CD',
  'dr congo': 'CD',
  'demokratische republik kongo': 'CD',
  'democratic republic of the congo': 'CD',
  'chinese taipei': 'TW',
  'chinesisch taipeh': 'TW',
  'republic of korea': 'KR',
  'republik korea': 'KR',
  'slowakische republik': 'SK',
  'slovak republic': 'SK',
  burma: 'MM',
  birma: 'MM',
  swaziland: 'SZ',
  swasiland: 'SZ',
  'east timor': 'TL',
  osttimor: 'TL',
  åland: 'AX',
  'åland islands': 'AX',
  ålandinseln: 'AX',
  hongkong: 'HK',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  'saint lucia': 'LC',
  'st kitts und nevis': 'KN',
  'trinidad und tobago': 'TT',
  'antigua und barbuda': 'AG',
  usa: 'US',
  'vereinigte staaten': 'US',
  'united states': 'US',
  'vereinigte arabische emirate': 'AE',
  'united arab emirates': 'AE',
  europa: 'EU',
  europe: 'EU',
  'europäische union': 'EU',
  'european union': 'EU',
}

/**
 * Deutsche und englische Namen der europäischen Staaten und der Staaten, die im Motorbootsport
 * regelmäßig antreten – fest eingetragen. `Intl.DisplayNames` kennt sie auch, aber je nach
 * Browser und Stand in anderer Schreibweise („Bosnia & Herzegovina“, „Hongkong“/„Hong Kong“);
 * was hier steht, wird überall gleich erkannt. Alle übrigen Namen kommen weiter vom Browser.
 */
export const STAAT_NAMEN_FEST: Readonly<Record<string, readonly [de: string, en: string]>> = {
  AL: ['Albanien', 'Albania'],
  AD: ['Andorra', 'Andorra'],
  AM: ['Armenien', 'Armenia'],
  AT: ['Österreich', 'Austria'],
  AZ: ['Aserbaidschan', 'Azerbaijan'],
  BY: ['Belarus', 'Belarus'],
  BE: ['Belgien', 'Belgium'],
  BA: ['Bosnien und Herzegowina', 'Bosnia and Herzegovina'],
  BG: ['Bulgarien', 'Bulgaria'],
  HR: ['Kroatien', 'Croatia'],
  CY: ['Zypern', 'Cyprus'],
  CZ: ['Tschechien', 'Czechia'],
  DK: ['Dänemark', 'Denmark'],
  EE: ['Estland', 'Estonia'],
  FI: ['Finnland', 'Finland'],
  FR: ['Frankreich', 'France'],
  GE: ['Georgien', 'Georgia'],
  DE: ['Deutschland', 'Germany'],
  GR: ['Griechenland', 'Greece'],
  HU: ['Ungarn', 'Hungary'],
  IS: ['Island', 'Iceland'],
  IE: ['Irland', 'Ireland'],
  IT: ['Italien', 'Italy'],
  KZ: ['Kasachstan', 'Kazakhstan'],
  XK: ['Kosovo', 'Kosovo'],
  LV: ['Lettland', 'Latvia'],
  LI: ['Liechtenstein', 'Liechtenstein'],
  LT: ['Litauen', 'Lithuania'],
  LU: ['Luxemburg', 'Luxembourg'],
  MT: ['Malta', 'Malta'],
  MD: ['Moldau', 'Moldova'],
  MC: ['Monaco', 'Monaco'],
  ME: ['Montenegro', 'Montenegro'],
  NL: ['Niederlande', 'Netherlands'],
  MK: ['Nordmazedonien', 'North Macedonia'],
  NO: ['Norwegen', 'Norway'],
  PL: ['Polen', 'Poland'],
  PT: ['Portugal', 'Portugal'],
  RO: ['Rumänien', 'Romania'],
  RU: ['Russland', 'Russia'],
  SM: ['San Marino', 'San Marino'],
  RS: ['Serbien', 'Serbia'],
  SK: ['Slowakei', 'Slovakia'],
  SI: ['Slowenien', 'Slovenia'],
  ES: ['Spanien', 'Spain'],
  SE: ['Schweden', 'Sweden'],
  CH: ['Schweiz', 'Switzerland'],
  TR: ['Türkei', 'Turkey'],
  UA: ['Ukraine', 'Ukraine'],
  GB: ['Vereinigtes Königreich', 'United Kingdom'],
  VA: ['Vatikanstadt', 'Vatican City'],
  // Außerhalb Europas: Nationen, die in der UIM regelmäßig starten.
  AE: ['Vereinigte Arabische Emirate', 'United Arab Emirates'],
  AR: ['Argentinien', 'Argentina'],
  AU: ['Australien', 'Australia'],
  BH: ['Bahrain', 'Bahrain'],
  BR: ['Brasilien', 'Brazil'],
  CA: ['Kanada', 'Canada'],
  CN: ['China', 'China'],
  EG: ['Ägypten', 'Egypt'],
  IN: ['Indien', 'India'],
  JP: ['Japan', 'Japan'],
  KW: ['Kuwait', 'Kuwait'],
  NZ: ['Neuseeland', 'New Zealand'],
  QA: ['Katar', 'Qatar'],
  SA: ['Saudi-Arabien', 'Saudi Arabia'],
  ZA: ['Südafrika', 'South Africa'],
  US: ['Vereinigte Staaten', 'United States'],
}
