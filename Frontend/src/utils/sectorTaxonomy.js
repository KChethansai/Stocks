// Market category taxonomy (frontend display + filtering only).
// The backend universe + ML training universe are untouched: this maps the
// raw sector strings arriving on stock rows to a small coherent GICS-style
// set for chips and labels. Nothing is dropped: rows with missing or
// unrecognized sectors filter and display as Unknown.
export const UNKNOWN_SECTOR = 'Unknown'

const CANONICAL_SECTORS = [
  'Technology',
  'Communication Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Financial Services',
  'Healthcare',
  'Energy'
]

// Raw universe strings → canonical sector. Semiconductors lives inside
// Technology; single-stock Automotive folds into Consumer Cyclical
// (GICS: Tesla is Consumer Discretionary). Equivalent labels map to one
// canonical entry — never duplicated.
const SECTOR_MAP = new Map([
  ['technology', 'Technology'],
  ['semiconductors', 'Technology'],
  ['communication services', 'Communication Services'],
  ['consumer cyclical', 'Consumer Cyclical'],
  ['consumer discretionary', 'Consumer Cyclical'],
  ['automotive', 'Consumer Cyclical'],
  ['consumer defensive', 'Consumer Defensive'],
  ['consumer staples', 'Consumer Defensive'],
  ['financial services', 'Financial Services'],
  ['financials', 'Financial Services'],
  ['healthcare', 'Healthcare'],
  ['energy', 'Energy']
])

export function normalizeSector(raw) {
  if (typeof raw !== 'string') return UNKNOWN_SECTOR
  const key = raw.trim().toLowerCase()
  if (!key) return UNKNOWN_SECTOR
  return SECTOR_MAP.get(key) || UNKNOWN_SECTOR
}

export function canonicalSectorList() {
  return [...CANONICAL_SECTORS]
}
