/**
 * Static sector map — JS mirror of _SECTORS in ml/python/features_v2.py.
 * Used only by the EXPERIMENTAL v2 path (trainedPredictorV2.js).
 */
export const SECTORS = {
  TECH: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'CSCO', 'ADBE', 'CRM', 'INTC'],
  HEALTH: ['JNJ', 'UNH', 'PFE', 'ABT', 'MRK'],
  FIN: ['JPM', 'V', 'MA', 'BAC'],
  CONSUMER: ['AMZN', 'HD', 'WMT', 'PG', 'PEP', 'KO'],
  MEDIA_TELCO: ['META', 'NFLX', 'DIS', 'T', 'VZ'],
  ENERGY_AUTO: ['XOM', 'TSLA']
}

export const SECTOR_OF = {}
for (const [sector, members] of Object.entries(SECTORS)) {
  for (const m of members) SECTOR_OF[m] = sector
}
