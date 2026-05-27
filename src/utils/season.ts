export const seasonWeight: Record<string, number> = { '冬': 4, '秋': 3, '夏': 2, '春': 1 };

export const parseSeason = (ys: string) => {
  if (!ys) return 0;
  const parts = ys.split(' ');
  const year = parseInt(parts[0]) || 0;
  const seasonValue = seasonWeight[parts[1]] || 0;
  return year * 10 + seasonValue;
};

// User mapping order: ['春', '夏', '秋', '冬']
// Q1: 春, Q2: 夏, Q3: 秋, Q4: 冬
const SEASONS_ZH = ['春', '夏', '秋', '冬'];
const SEASONS_ENG = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];

/**
 * Gets the season index based on current date.
 * Jan-Mar -> index 3 (Winter of previous yr if offset? No, just Q1=Spring in this specific user mapping)
 * Wait, user says: 2026 Spring is CURRENT (April).
 * April is index 1 of (0,1,2,3). If 1 maps to index 0 (Spring).
 */
function getAdjustedSeasonIndex(date: Date) {
  const month = date.getMonth();
  const qIndex = Math.floor(month / 3); // 0 (Jan-Mar), 1 (Apr-Jun), 2 (Jul-Sep), 3 (Oct-Dec)
  // We want Q2 (Apr-Jun) to be Spring (index 0)
  // Q3 (Jul-Sep) to be Summer (index 1)
  // Q4 (Oct-Dec) to be Autumn (index 2)
  // Q1 (Jan-Mar) to be Winter (index 3) - User considers Winter to be the "end" or previous
  return (qIndex + 3) % 4;
}

export function getSeasonInfo(offset: number = 0) {
  const date = new Date();
  let baseYear = date.getFullYear();
  let index = getAdjustedSeasonIndex(date);
  
  // Base normalization (e.g., if Jan-Mar is Winter, it belongs to previous year)
  const qIndex = Math.floor(date.getMonth() / 3);
  if (index === 3 && qIndex === 0) baseYear--;

  let finalIndex = index + offset;
  let finalYear = baseYear;
  
  // Apply offset and adjust year
  while (finalIndex < 0) {
    finalIndex += 4;
    finalYear--;
  }
  while (finalIndex > 3) {
    finalIndex -= 4;
    finalYear++;
  }

  return {
    year: finalYear,
    seasonZh: SEASONS_ZH[finalIndex],
    seasonEng: SEASONS_ENG[finalIndex]
  };
}

export function getCurrentSeasonInfo() {
  return getSeasonInfo(0);
}

export function getRelativeSeasonString(offset: number) {
  const date = new Date();
  let year = date.getFullYear();
  const baseIndex = getAdjustedSeasonIndex(date);
  
  // If baseIndex is 3 (Winter) and month is Q1, year is Year-1
  const qIndex = Math.floor(date.getMonth() / 3);
  if (baseIndex === 3 && qIndex === 0) year--;

  let newIndex = baseIndex + offset;
  
  while (newIndex > 3) { newIndex -= 4; year++; }
  while (newIndex < 0) { newIndex += 4; year--; }
  
  return `${year} ${SEASONS_ZH[newIndex]}`;
}
