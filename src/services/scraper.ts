import * as OpenCC from 'opencc-js';
import type { Anime } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const START_YEAR = 2024; // You can change this to 2000 for full scrape
const END_YEAR = 2025;

// Genre map for translation (Deleted Ecchi > 紳士, mapped Hentai > 紳士)
const genreMap: Record<string, string> = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士'
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

// 強勢維基百科搜尋 (藉由搜尋日本標題，獲取官方中文版 redirect)
async function getWikipediaTaiwanTranslation(nativeTitle: string): Promise<string> {
  try {
    // 1. Search for closest article
    const searchUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(nativeTitle)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return "";
    const searchJson = await searchRes.json();
    if (searchJson.query?.search && searchJson.query.search.length > 0) {
      const matchTitle = searchJson.query.search[0].title;
      
      // 2. Fetch the zh-tw variant of that exact article
      const url = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(matchTitle)}&redirects=1&format=json&variant=zh-tw&origin=*`;
      const res = await fetch(url);
      const json = await res.json();
      const pages = json.query?.pages;
      if (pages) {
        for (const p in pages) {
          if (pages[p].title) return pages[p].title;
        }
      }
      return matchTitle;
    }
  } catch (e) {}
  return "";
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

// Jikan API Age rating checks
async function getJikanAgeRating(title: string): Promise<string> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    if (!res.ok) return "";
    const json = await res.json();
    if (json && json.data && json.data.length > 0) {
      return json.data[0].rating || "";
    }
  } catch(e) {}
  return "";
}

export async function scrapeAnimeData(onProgress?: (msg: string) => void): Promise<Anime[]> {
  let allAnime: Anime[] = [];
  
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  if (onProgress) onProgress('正在準備翻譯引擎與字典檔...');

  let bgmData: any = { items: [] };
  try {
    const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
    if (res.ok) bgmData = await res.json();
  } catch(e) {}

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (const season of SEASONS) {
      if (onProgress) onProgress(`🔍 正在爬取 AniList: ${year} 年 ${season} 季...`);
      
      try {
        const seasonData = await fetchAniListBySeason(year, season);
        
        for (let i = 0; i < seasonData.length; i++) {
          const item = seasonData[i];
          const nativeTitle = item.title.native || item.title.romaji;
          
          if (onProgress) onProgress(`翻譯與分級審查 (${allAnime.length}): ${nativeTitle}`);
          
          let titleZh = "";
          let finalCover = "";
          let fromBgmData = false;
          
          if (bgmData.items.length > 0) {
             const bgmItem = bgmData.items.find((bgm: any) => bgm.title === nativeTitle || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(nativeTitle)));
             if (bgmItem && bgmItem.titleTranslate) {
                if (bgmItem.titleTranslate['zh-Hant']) {
                  titleZh = bgmItem.titleTranslate['zh-Hant'][0];
                  fromBgmData = true; // High confidence official Taiwan title
                } else if (bgmItem.titleTranslate['zh-Hans']) {
                  titleZh = bgmItem.titleTranslate['zh-Hans'][0];
                }
             }
          }
          
          // 若有需要，從 Bangumi API 取得封面與備用翻譯
          const bgmInfo = await getBangumiDataInfo(nativeTitle);
          // 強制將 Bangumi 圖片網址改為大圖 (/l/) 解決模糊問題
          if (bgmInfo.image) {
             finalCover = bgmInfo.image.replace(/\/c\/|\/m\/|\/s\//g, '/l/');
          } else {
             finalCover = item.coverImage?.extraLarge || item.coverImage?.large || "";
          }
          
          if (!titleZh && bgmInfo.title) {
             titleZh = bgmInfo.title;
          }
          await sleep(WAIT_BETWEEN_REQUESTS); 
          
          // Phase 2: 如果沒有自信的繁體名字 (fromBgmData)，透過維基百科搜尋引擎直接提取 zh-tw 官方名稱
          if (!fromBgmData) {
             const wikiTitle = await getWikipediaTaiwanTranslation(nativeTitle);
             if (wikiTitle && wikiTitle !== nativeTitle) {
               titleZh = wikiTitle;
               fromBgmData = true; // Wiki is usually very good
             }
             await sleep(WAIT_BETWEEN_REQUESTS); 
          }
          
          // Phase 3: 最後防線，純粹使用 OpenCC 將簡體轉繁體
          if (!titleZh) {
             titleZh = item.title.native || item.title.romaji || item.title.english || "未知動畫";
          }
          
          titleZh = converter(titleZh);
          
          // Phase 4: 高效紳士分級判定 (僅在 AniList 通報有疑慮時，才呼叫 Jikan API 避免拖慢全體速度)
          let genres = (item.genres || []).map((g: string) => genreMap[g] || g);
          const needsAgeCheck = item.genres?.includes('Ecchi') || item.genres?.includes('Hentai') || item.tags?.some((t:any) => t.name === 'Nudity' || t.name === 'Explicit');
          
          if (needsAgeCheck) {
             const ageRating = await getJikanAgeRating(item.title.romaji || nativeTitle || item.title.english || '');
             if (ageRating.includes('R+') || ageRating.includes('Rx')) {
                if (!genres.includes('紳士')) genres.push('紳士');
             }
             await sleep(350); // Respect Jikan Rate limit
          }
          
          const id = `anilist-${item.id}`;
          const seasonMap: Record<string, string> = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
          const yearSeason = `${year} ${seasonMap[season]}`;
          
          allAnime.push({
            id,
            titleZh,
            coverImage: finalCover,
            yearSeason,
            genres
          });
        }
        
      } catch(e) {
      }
    }
  }
  
  if (onProgress) onProgress('✨ 爬取與翻譯完成！');
  return allAnime;
}
