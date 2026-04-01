import * as OpenCC from 'opencc-js';
import type { Anime } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const START_YEAR = 2024;
const END_YEAR = 2025;

// Genre map for translation
const genreMap: Record<string, string> = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Ecchi': '紳士', 'Hentai': '紳士'
};

async function fetchAniListBySeason(year: number, season: string) {
  const query = `
    query ($season: MediaSeason, $seasonYear: Int) {
      Page(page: 1, perPage: 50) {
        media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          id
          title { romaji english native }
          genres
          coverImage { large }
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

async function getWikipediaTranslation(nativeTitle: string): Promise<string> {
  try {
    const url = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(nativeTitle)}&prop=langlinks&lllang=zh-tw&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const json = await res.json();
    const pages = json.query?.pages;
    if (!pages) return "";
    
    // Extract translation from the first page object found
    for (const pageId in pages) {
      const page = pages[pageId];
      if (page.langlinks && page.langlinks.length > 0) {
        return page.langlinks[0]['*'];
      }
    }
  } catch (e) {
    // Ignore Wikipedia failures
  }
  return "";
}

async function getBangumiTranslation(nativeTitle: string): Promise<string> {
  try {
    const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(nativeTitle)}?type=2&responseGroup=small`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const json = await res.json();
    if (json && json.list && json.list.length > 0) {
      return json.list[0].name_cn || json.list[0].name || "";
    }
  } catch (e) {
    // Ignore Bangumi API failures
  }
  return "";
}

export async function scrapeAnimeData(onProgress?: (msg: string) => void): Promise<Anime[]> {
  let allAnime: Anime[] = [];
  
  // 1. Initialize OpenCC (cn to tw fallback)
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  if (onProgress) onProgress('正在準備翻譯引擎與字典檔...');

  // 2. Fetch bangumi-data static JSON for fast translation
  let bgmData: any = { items: [] };
  try {
    const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
    if (res.ok) bgmData = await res.json();
  } catch(e) {
    if (onProgress) onProgress('無法取得 bangumi-data 辭典，將依賴活體 API 翻譯...');
  }

  // 3. Process each year and season via AniList
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (const season of SEASONS) {
      if (onProgress) onProgress(`🔍 正在爬取 AniList: ${year} 年 ${season} 季...`);
      
      try {
        const seasonData = await fetchAniListBySeason(year, season);
        
        for (let i = 0; i < seasonData.length; i++) {
          const item = seasonData[i];
          const nativeTitle = item.title.native || item.title.romaji;
          
          if (onProgress) onProgress(`正在翻譯 (${allAnime.length}): ${nativeTitle}`);
          
          let titleZh = "";
          
          // Phase 1: Fast static dump check
          if (bgmData.items.length > 0) {
             const bgmItem = bgmData.items.find((bgm: any) => bgm.title === nativeTitle || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(nativeTitle)));
             if (bgmItem && bgmItem.titleTranslate) {
                if (bgmItem.titleTranslate['zh-Hant']) {
                  titleZh = bgmItem.titleTranslate['zh-Hant'][0];
                } else if (bgmItem.titleTranslate['zh-Hans']) {
                  titleZh = converter(bgmItem.titleTranslate['zh-Hans'][0]);
                }
             }
          }
          
          // Phase 2: User requested web crawling (Wikipedia CORS search)
          if (!titleZh) {
             titleZh = await getWikipediaTranslation(nativeTitle);
             // We can safely await a bit to not overwhelm the API
             if (titleZh) await sleep(200); 
          }
          
          // Phase 3: Project Rules primary data (Bangumi Live API)
          if (!titleZh) {
             titleZh = await getBangumiTranslation(nativeTitle);
             if (titleZh) {
               titleZh = converter(titleZh); // Bangumi often gives simplified
               await sleep(500); 
             }
          }
          
          // Phase 4: Fallback to Kaniji conversion
          if (!titleZh) {
             titleZh = converter(item.title.native || item.title.romaji || item.title.english || "未知動畫");
          }
          
          // Formatting
          const id = `anilist-${item.id}`;
          const seasonMap: Record<string, string> = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
          const yearSeason = `${year} ${seasonMap[season]}`;
          const genres = (item.genres || []).map((g: string) => genreMap[g] || g);
          
          allAnime.push({
            id,
            titleZh,
            coverImage: item.coverImage?.large || "",
            yearSeason,
            genres
          });
        }
        
        await sleep(500); // delay between seasons
      } catch(e) {
        if (onProgress) onProgress(`抓取 ${year} ${season} 發生錯誤，跳過。`);
      }
    }
  }
  
  if (onProgress) onProgress('✨ 爬取與翻譯完成！');
  return allAnime;
}
