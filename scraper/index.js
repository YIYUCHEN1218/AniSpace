import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as OpenCC from 'opencc-js';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'public', 'anime_data.json');
const START_YEAR = 2010; 
const END_YEAR = new Date().getFullYear(); // Up to current year

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const genreMap = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士', 'Ecchi': '福利'
};

const SEASON_MONTH_MAP = {
  'WINTER': '01',
  'SPRING': '04',
  'SUMMER': '07',
  'FALL': '10'
};

async function fetchACGSecretsTitles(year, season) {
  const month = SEASON_MONTH_MAP[season.toUpperCase()];
  if (!month) return new Map();
  
  try {
    const url = `https://acgsecrets.hk/bangumi/${year}${month}/`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = res.data;
    
    const titleMap = new Map();
    const regex = /"name":"([^"]+)","alternateName":\["([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const zh = match[1].trim();
      const jp = match[2].trim();
      if (zh && jp) titleMap.set(jp, zh);
    }
    
    return titleMap;
  } catch (e) {
    console.warn(`Failed to fetch acgsecrets.hk titles for ${year} ${season}:`, e.message);
    return new Map();
  }
}

async function fetchAniListBySeason(year, season) {
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
  try {
    const res = await axios.post('https://graphql.anilist.co', 
      { query, variables: { season, seasonYear: year } },
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return res.data.data.Page.media || [];
  } catch (e) {
    console.error(`AniList API error for ${year} ${season}:`, e.message);
    return [];
  }
}

async function getBangumiDataInfo(nativeTitle) {
  try {
    const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(nativeTitle)}?type=2&responseGroup=small`;
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const json = res.data;
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

async function getJikanAgeRating(title, retries = 3, delay = 1000) {
  try {
    const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`, {
        validateStatus: (status) => status < 500
    });
    if (res.status === 429 && retries > 0) {
      await sleep(delay);
      return getJikanAgeRating(title, retries - 1, delay * 2);
    }
    if (res.status !== 200) return "";
    const json = res.data;
    if (json && json.data && json.data.length > 0) {
      return json.data[0].rating || "";
    }
  } catch(e) {}
  return "";
}

async function parallelLimit(items, limit, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function main() {
  const ALL_SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  let finalAnimeList = [];

  // Pre-fetch bangumi-data
  console.log('正在準備翻譯引擎與字典檔...');
  let bgmData = { items: [] };
  try {
    const res = await axios.get("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
    if (res.status === 200) bgmData = res.data;
  } catch(e) {
    console.warn("Failed to fetch bangumi-data");
  }

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (const currentSeason of ALL_SEASONS) {
      console.log(`\n🔍 正在爬取: ${year} 年 ${currentSeason} 季...`);
      
      // Fetch ACG Secrets titles map
      const acgTitlesMap = await fetchACGSecretsTitles(year, currentSeason);
      
      const seasonData = await fetchAniListBySeason(year, currentSeason);
      console.log(`🚀 正在並行處理 ${seasonData.length} 部動畫資料...`);
      
      const processedResults = await parallelLimit(seasonData, 5, async (item) => {
        const nativeTitle = item.title.native || item.title.romaji;

        let titleZh = "";
        let finalCover = "";

        // Priority 0: ACG Secrets.HK
        if (acgTitlesMap.has(nativeTitle)) {
          titleZh = acgTitlesMap.get(nativeTitle);
        }

        // Phase 1: bangumi-data
        if (!titleZh && bgmData.items.length > 0) {
           const bgmItem = bgmData.items.find(bgm => bgm.title === nativeTitle || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(nativeTitle)));
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
        let genres = (item.genres || []).map(g => genreMap[g] || g);
        const needsAgeCheck = item.genres?.includes('Ecchi') || item.genres?.includes('Hentai') || item.tags?.some(t => t.name === 'Nudity' || t.name === 'Explicit');
        
        if (needsAgeCheck) {
           const ageRating = await getJikanAgeRating(item.title.romaji || nativeTitle || item.title.english || '');
           if (ageRating.includes('R+') || ageRating.includes('Rx')) {
              if (!genres.includes('紳士')) genres.push('紳士');
           }
        }

        const seasonMap = { 'WINTER': '冬', 'SPRING': '春', 'SUMMER': '夏', 'FALL': '秋' };
        return {
          id: `anilist-${item.id}`,
          titleZh,
          coverImage: finalCover,
          yearSeason: `${year} ${seasonMap[currentSeason]}`,
          genres
        };
      });

      finalAnimeList = [...finalAnimeList, ...processedResults];
    }
  }

  // Ensure public directory exists
  const publicDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Sort by date descending (Year DESC, Season priority)
  const seasonOrder = { '冬': 4, '秋': 3, '夏': 2, '春': 1 };
  const parseSeasonScore = (yearSeason) => {
    const parts = yearSeason.split(' ');
    if (parts.length !== 2) return 0;
    const year = parseInt(parts[0], 10);
    const season = seasonOrder[parts[1]] || 0;
    return year * 10 + season;
  };
  finalAnimeList.sort((a, b) => parseSeasonScore(b.yearSeason) - parseSeasonScore(a.yearSeason));

  fs.writeFileSync(DATA_FILE, JSON.stringify(finalAnimeList, null, 2), 'utf-8');
  console.log(`\n✨ 抓取與翻譯完成！共 ${finalAnimeList.length} 筆資料已儲存至 ${DATA_FILE}`);
}

main();
