import * as OpenCC from 'opencc-js';
import type { Anime } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const genreMap: Record<string, string> = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士', 'Ecchi': '福利'
};

export async function searchAnimeOnline(query: string): Promise<Anime[]> {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME, isAdult: false) {
          id
          title { romaji english native }
          genres
          tags { name rank }
          coverImage { large extraLarge }
          season
          seasonYear
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: { search: query } })
    });
    if (!res.ok) return [];
    const json = await res.json();
    const media = json.data.Page.media || [];
    
    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    
    return media.map((item: any) => {
      const seasonMap: Record<string, string> = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
      const seasonStr = seasonMap[item.season as string] || "";
      const yearSeason = item.seasonYear ? `${item.seasonYear} ${seasonStr}` : "未知年份";
      
      return {
        id: `anilist-${item.id}`,
        titleZh: converter(item.title.native || item.title.romaji || item.title.english || ""),
        coverImage: item.coverImage?.extraLarge || item.coverImage?.large || "",
        yearSeason: yearSeason.trim(),
        genres: (item.genres || []).map((g: string) => genreMap[g] || g)
      };
    });
  } catch (e) {
    console.error('Search online failed:', e);
    return [];
  }
}

// ACG Secrets Month Mapping
const SEASON_MONTH_MAP: Record<string, string> = {
  'WINTER': '01',
  'SPRING': '04',
  'SUMMER': '07',
  'FALL': '10'
};

async function fetchACGSecretsTitles(year: number, season: string) {
  const month = SEASON_MONTH_MAP[season.toUpperCase()];
  if (!month) return new Map<string, string>();
  
  try {
    const url = `https://acgsecrets.hk/bangumi/${year}${month}/`;
    const res = await fetch(url);
    if (!res.ok) return new Map<string, string>();
    const html = await res.text();
    
    // JSON-based regex is much more robust for acgsecrets.hk as it bypasses complex DOM structure
    const titleMap = new Map<string, string>();
    const regex = /"name":"([^"]+)","alternateName":\["([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const zh = match[1].trim();
      const jp = match[2].trim();
      if (zh && jp) titleMap.set(jp, zh);
    }
    
    return titleMap;
  } catch (e) {
    console.warn('Failed to fetch acgsecrets.hk titles:', e);
    return new Map<string, string>();
  }
}

async function fetchAniListBySeason(year: number, season: string) {
  const query = `
    query ($season: MediaSeason, $seasonYear: Int) {
      Page(page: 1, perPage: 50) {
        media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          id
          title { romaji english native }
          genres
          tags { name rank }
          coverImage { large extraLarge }
        }
      }
    }
  `;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables: { season, seasonYear: year } })
  });
  if (!res.ok) throw new Error('AniList API error');
  const json = await res.json();
  return json.data.Page.media || [];
}

async function getBangumiDataInfo(nativeTitle: string): Promise<{ title: string; image: string }> {
  try {
    const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(nativeTitle)}?type=2&responseGroup=small`;
    const res = await fetch(url);
    if (!res.ok) return { title: "", image: "" };
    const json = await res.json();
    if (json && json.list && json.list.length > 0) {
      const item = json.list[0];
      return { 
        title: item.name_cn || item.name || "",
        image: item.images?.large || item.images?.common || ""
      };
    }
  } catch (e) {}
  return { title: "", image: "" };
}

async function getJikanAgeRating(title: string, retries = 3, delay = 1000): Promise<string> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    if (res.status === 429 && retries > 0) {
      await sleep(delay);
      return getJikanAgeRating(title, retries - 1, delay * 2);
    }
    if (!res.ok) return "";
    const json = await res.json();
    if (json && json.data && json.data.length > 0) {
      return json.data[0].rating || "";
    }
  } catch(e) {}
  return "";
}

/**
 * Concurrency limited promise runner
 */
async function parallelLimit<T>(items: any[], limit: number, fn: (item: any) => Promise<T>) {
  const results: T[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p as any);
    if (limit <= items.length) {
      const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

export async function scrapeAnimeData(year: number, season: string, onProgress?: (msg: string) => void): Promise<Anime[]> {
  const ALL_SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const seasons = season === 'ALL' ? ALL_SEASONS : [season];
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  let finalAnimeList: Anime[] = [];

  // Phase 0: Fetch ACG Secrets titles map
  if (onProgress) onProgress('🌐 正在從 ACG Secrets.HK 獲取优先翻譯標題...');
  const acgTitlesMap = new Map<string, string>();
  for (const s of seasons) {
    if (onProgress) onProgress(`🔍 正在同步 ACG Secrets: ${year} ${s}...`);
    const map = await fetchACGSecretsTitles(year, s);
    map.forEach((v, k) => acgTitlesMap.set(k, v));
  }

  // Pre-fetch bangumi-data
  if (onProgress) onProgress('正在準備翻譯引擎與字典檔...');
  let bgmData: any = { items: [] };
  try {
    const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
    if (res.ok) bgmData = await res.json();
  } catch(e) {}

  for (const currentSeason of seasons) {
    if (onProgress) onProgress(`🔍 正在爬取 AniList: ${year} 年 ${currentSeason} 季...`);
    try {
      const seasonData = await fetchAniListBySeason(year, currentSeason);
      
      // Parallel Metadata Enhancement
      if (onProgress) onProgress(`🚀 正在並行處理 ${seasonData.length} 部動畫資料...`);
      
      const processedResults = await parallelLimit(seasonData, 5, async (item) => {
        const nativeTitle = item.title.native || item.title.romaji;
        if (onProgress) onProgress(`處理中: ${nativeTitle}`);

        let titleZh = "";
        let finalCover = "";

        // Priority 0: ACG Secrets.HK
        if (acgTitlesMap.has(nativeTitle)) {
          titleZh = acgTitlesMap.get(nativeTitle)!;
        }

        // Phase 1: bangumi-data
        if (!titleZh && bgmData.items.length > 0) {
           const bgmItem = bgmData.items.find((bgm: any) => bgm.title === nativeTitle || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(nativeTitle)));
           if (bgmItem && bgmItem.titleTranslate) {
              if (bgmItem.titleTranslate['zh-Hant']) {
                titleZh = bgmItem.titleTranslate['zh-Hant'][0];
              } else if (bgmItem.titleTranslate['zh-Hans']) {
                titleZh = bgmItem.titleTranslate['zh-Hans'][0];
              }
           }
        }

        // Phase 2: Bangumi API
        const bgmInfo = await getBangumiDataInfo(nativeTitle);
        if (bgmInfo.image) {
           finalCover = bgmInfo.image.replace(/\/c\/|\/m\/|\/s\//g, '/l/');
        } else {
           finalCover = item.coverImage?.extraLarge || item.coverImage?.large || "";
        }
        
        if (!titleZh && bgmInfo.title) {
           titleZh = bgmInfo.title;
        }

        // Fallback
        if (!titleZh) {
           titleZh = nativeTitle || item.title.english || "未知動畫";
        }
        
        // Force Traditional Chinese
        titleZh = converter(titleZh);
        
        // Age Rating & Genres
        let genres = (item.genres || []).map((g: string) => genreMap[g] || g);
        const needsAgeCheck = item.genres?.includes('Ecchi') || item.genres?.includes('Hentai') || item.tags?.some((t:any) => t.name === 'Nudity' || t.name === 'Explicit');
        
        if (needsAgeCheck) {
           const ageRating = await getJikanAgeRating(item.title.romaji || nativeTitle || item.title.english || '');
           if (ageRating.includes('R+') || ageRating.includes('Rx')) {
              if (!genres.includes('紳士')) genres.push('紳士');
           }
        }

        const seasonMap: Record<string, string> = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
        return {
          id: `anilist-${item.id}`,
          titleZh,
          coverImage: finalCover,
          yearSeason: `${year} ${seasonMap[currentSeason]}`,
          genres
        };
      });

      finalAnimeList = [...finalAnimeList, ...processedResults];
    } catch(e) {
      if (onProgress) onProgress(`發生錯誤: ${e}`);
    }
  }
  
  if (onProgress) onProgress('✨ 爬取與翻譯完成！');
  return finalAnimeList;
}
