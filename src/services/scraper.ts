import * as OpenCC from 'opencc-js';
import type { Anime } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Genre map for translation (Ecchi > 福利, mapped Hentai > 紳士)
const genreMap: Record<string, string> = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士', 'Ecchi': '福利'
};

const WAIT_BETWEEN_REQUESTS = 100; // General speed up

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

// Jikan API Age rating checks with exponential backoff for 429
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
 * 每次只爬取單一特定年份與季度的資料，避免冗長過度負載。
 * Season 可以傳入 'ALL' 來抓取四個季度。
 */
export async function scrapeAnimeData(year: number, season: string, onProgress?: (msg: string) => void): Promise<Anime[]> {
  const ALL_SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const seasons = season === 'ALL' ? ALL_SEASONS : [season];

  let allAnime: Anime[] = [];
  
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
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
      
      for (let i = 0; i < seasonData.length; i++) {
        const item = seasonData[i];
        const nativeTitle = item.title.native || item.title.romaji;
        
        if (onProgress) onProgress(`翻譯與分級審查 (${i + 1}/${seasonData.length}): ${nativeTitle}`);
        
        let titleZh = "";
        let finalCover = "";
        
        // Phase 1: bangumi-data 取的繁中官方名稱 (最準確)
        if (bgmData.items.length > 0) {
           const bgmItem = bgmData.items.find((bgm: any) => bgm.title === nativeTitle || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(nativeTitle)));
           if (bgmItem && bgmItem.titleTranslate) {
              if (bgmItem.titleTranslate['zh-Hant']) {
                titleZh = bgmItem.titleTranslate['zh-Hant'][0];
              } else if (bgmItem.titleTranslate['zh-Hans']) {
                titleZh = bgmItem.titleTranslate['zh-Hans'][0];
              }
           }
        }
        
        // Phase 2: 若無，仰賴 Bangumi REST API 查詢
        const bgmInfo = await getBangumiDataInfo(nativeTitle);
        
        if (bgmInfo.image) {
           finalCover = bgmInfo.image.replace(/\/c\/|\/m\/|\/s\//g, '/l/');
        } else {
           finalCover = item.coverImage?.extraLarge || item.coverImage?.large || "";
        }
        
        if (!titleZh && bgmInfo.title) {
           titleZh = bgmInfo.title;
        }
        
        await sleep(WAIT_BETWEEN_REQUESTS); 
        
        // Phase 3: 放棄維基百科，直接用原名防止奇異改名
        if (!titleZh) {
           titleZh = item.title.native || item.title.romaji || item.title.english || "未知動畫";
        }
        
        // 強制將簡體轉換為繁體
        titleZh = converter(titleZh);
        
        // 紳士分級審查 (引入指數休眠防呆)
        let genres = (item.genres || []).map((g: string) => genreMap[g] || g);
        const needsAgeCheck = item.genres?.includes('Ecchi') || item.genres?.includes('Hentai') || item.tags?.some((t:any) => t.name === 'Nudity' || t.name === 'Explicit');
        
        if (needsAgeCheck) {
           const ageRating = await getJikanAgeRating(item.title.romaji || nativeTitle || item.title.english || '');
           if (ageRating.includes('R+') || ageRating.includes('Rx')) {
              if (!genres.includes('紳士')) genres.push('紳士');
           }
           await sleep(350); 
        }
        
        const id = `anilist-${item.id}`;
        const seasonMap: Record<string, string> = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
        const yearSeason = `${year} ${seasonMap[currentSeason]}`;
        
        allAnime.push({
          id,
          titleZh,
          coverImage: finalCover,
          yearSeason,
          genres
        });
      }
    } catch(e) {
      if (onProgress) onProgress(`發生錯誤: ${e}`);
    }
  }
  
  if (onProgress) onProgress('✨ 爬取與翻譯完成！');
  return allAnime;
}
