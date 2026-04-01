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

export function getCurrentSeasonInfo() {
  const date = new Date();
  const year = date.getFullYear();
  const index = getAdjustedSeasonIndex(date);
  
  // If index is 3 (Winter) and it is Jan-Mar (qIndex 0), the year should be Year-1? 
  // User says: Current is 2026 Spring (Apr). 
  // If it was Jan, and they want "2025 Winter", then index 3 corresponds to year-1.
  const qIndex = Math.floor(date.getMonth() / 3);
  const adjustedYear = (index === 3 && qIndex === 0) ? year - 1 : year;

  return { 
    year: adjustedYear, 
    seasonZh: SEASONS_ZH[index], 
    seasonEng: SEASONS_ENG[index] 
  };
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
