import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as OpenCC from 'opencc-js';

const YEAR = parseInt(process.argv[2]);
const SEASON = process.argv[3]?.toUpperCase();

if (!YEAR || !SEASON) {
  console.error("用法: node fetch_anime.mjs <YEAR> <SEASON>");
  console.error("範例: node fetch_anime.mjs 2024 SPRING");
  process.exit(1);
}

// Genre map for translation
const genreMap = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士'
};

async function fetchFromAniList(year, season) {
  console.log(`📡 正在從 AniList 獲取 ${year} 年 ${season} 季度的動畫...`);
  const query = `
      query ($season: MediaSeason, $seasonYear: Int) {
        Page(page: 1, perPage: 50) {
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
            id
            title { romaji english native }
            episodes
            genres
            tags { name rank }
            coverImage { large extraLarge }
          }
        }
      }
    `;
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables: { season, seasonYear: year } })
  });

  if (!response.ok) throw new Error(`AniList API 錯誤: ${response.statusText}`);
  const data = await response.json();
  return data.data.Page.media;
}

// 2. Wikipedia 翻譯或修正 (搜尋引擎 redirect 方案)
async function getWikipediaTaiwanTranslation(nativeTitle) {
  try {
    const searchUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(nativeTitle)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return "";
    const searchJson = await searchRes.json();
    if (searchJson.query?.search && searchJson.query.search.length > 0) {
      const matchTitle = searchJson.query.search[0].title;
      
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

// 3. Bangumi 取封面與譯名
async function getBangumiDataInfo(nativeTitle) {
  try {
    const res = await fetch(`https://api.bgm.tv/search/subject/${encodeURIComponent(nativeTitle)}?type=2&responseGroup=small`);
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

// 4. MyAnimeList/Jikan 動畫分級判定 (判定 R+ 或 Rx 紳士)
async function getJikanAgeRating(title) {
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

// 檢查重複的動畫並刪除
function removeDuplicates(animeList) {
  console.log("🔍 正在檢查清單內的重複項目...");
  const seenMap = new Set();
  const uniqueList = [];
  for (const anime of animeList) {
    if (!seenMap.has(anime.id)) {
      seenMap.add(anime.id);
      uniqueList.push(anime);
    }
  }
  return uniqueList;
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

const SEASON_MONTH_MAP = {
  'WINTER': '01', 'SPRING': '04', 'SUMMER': '07', 'FALL': '10'
};

async function fetchACGSecretsTitles(year, season) {
  const month = SEASON_MONTH_MAP[season];
  if (!month) return new Map();
  try {
    const url = `https://acgsecrets.hk/bangumi/${year}${month}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return new Map();
    const html = await res.text();
    const titleMap = new Map();
    // acgsecrets.hk uses JSON-LD or script data for anime info
    const regex = /"name":"([^"]+)","alternateName":\["([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const zh = match[1].trim();
      const jp = match[2].trim();
      if (zh && jp) titleMap.set(jp, zh);
    }
    return titleMap;
  } catch (e) {
    return new Map();
  }
}

async function main() {
  try {
    const acgTitlesMap = await fetchACGSecretsTitles(YEAR, SEASON);
    if (acgTitlesMap.size > 0) {
      console.log(`🌐 已從 ACG Secrets 獲取 ${acgTitlesMap.size} 個優先標題。`);
    }

    let animeList = await fetchFromAniList(YEAR, SEASON);
    console.log(`✅ 成功從 AniList 獲取 ${animeList.length} 筆資料。`);
    animeList = removeDuplicates(animeList);

    console.log("🌐 正在下載 bangumi-data 作為靜態輔助翻譯庫...");
    let bgmData = { items: [] };
    try {
      const bRes = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
      if (bRes.ok) bgmData = await bRes.json();
    } catch(e) {}

    console.log(`🚀 開始並行處理 ${animeList.length} 筆資料...`);
    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    
    let completed = 0;
    const processedList = await parallelLimit(animeList, 5, async (anime) => {
      const native = anime.title.native || anime.title.romaji;
      
      let titleZh = "";
      let finalCover = "";

      // Priority 0: ACG Secrets
      if (acgTitlesMap.has(native)) {
        titleZh = acgTitlesMap.get(native);
      }

      // Phase 1: bangumi-data
      if (!titleZh && bgmData.items.length > 0) {
          const bgmItem = bgmData.items.find((bgm) => bgm.title === native || (bgm.titleTranslate && Object.values(bgm.titleTranslate).flat().includes(native)));
          if (bgmItem && bgmItem.titleTranslate) {
            if (bgmItem.titleTranslate['zh-Hant']) {
              titleZh = bgmItem.titleTranslate['zh-Hant'][0];
            } else if (bgmItem.titleTranslate['zh-Hans']) {
              titleZh = bgmItem.titleTranslate['zh-Hans'][0];
            }
          }
      }

      const bgmInfo = await getBangumiDataInfo(native);
      if (bgmInfo.image) {
         finalCover = bgmInfo.image.replace(/\/c\/|\/m\/|\/s\//g, '/l/');
      } else {
         finalCover = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
      }
      
      if (!titleZh && bgmInfo.title) {
        titleZh = bgmInfo.title;
      }
      
      if (!titleZh) {
          titleZh = anime.title.native || anime.title.romaji || anime.title.english;
      }

      titleZh = converter(titleZh);

      const needsAgeCheck = anime.genres?.includes('Ecchi') || anime.genres?.includes('Hentai') || anime.tags?.some(t => t.name === 'Nudity' || t.name === 'Explicit');
      let genres = (anime.genres || []).map((g) => genreMap[g] || g);
      if (needsAgeCheck) {
          const ageRating = await getJikanAgeRating(anime.title.romaji || native || anime.title.english || '');
          if (ageRating.includes('R+') || ageRating.includes('Rx')) {
              if (!genres.includes('紳士')) genres.push('紳士');
          }
      }

      completed++;
      if (completed % 5 === 0 || completed === animeList.length) {
        console.log(`  進度: [${completed}/${animeList.length}] 正在處理...`);
      }

      return {
        sourceId: `anilist-${anime.id}`,
        titleZh: titleZh,
        titleRomaji: anime.title.romaji,
        titleEnglish: anime.title.english,
        titleNative: anime.title.native,
        episodes: anime.episodes,
        genres: genres,
        coverImage: finalCover
      };
    });

    const outputPath = path.join(process.cwd(), 'new_anime_results.json');
    await fs.writeFile(outputPath, JSON.stringify(processedList, null, 2), 'utf-8');
    console.log(`\n🎉 抓取與翻譯完成！結果已儲存至: ${outputPath}`);
  } catch (err) {
    console.error("❌ 發生錯誤:", err);
  }
}

main();
