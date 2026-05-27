import fs from 'fs/promises';
import path from 'path';
import * as OpenCC from 'opencc-js';
import { fetchBahamutData, fetchACGSecretsSeasonal, fetchBangumiData } from '../../../../scraper/scraper_utils.mjs';

const YEAR = parseInt(process.argv[2]);
const SEASON = process.argv[3]?.toUpperCase();

if (!YEAR || !SEASON) {
  console.error("用法: node fetch_anime.mjs <YEAR> <SEASON>");
  console.error("範例: node fetch_anime.mjs 2024 SPRING");
  process.exit(1);
}

const genreMap = {
  'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
  'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
  'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
  'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
  'Girls Love': '百合', 'Gourmet': '美食', 'Mecha': '機甲', 'Music': '音樂', 'Psychological': '心理',
  'Thriller': '驚悚', 'Mahou Shoujo': '魔法少女', 'Hentai': '紳士'
};

async function fetchFromAniList(year, season) {
  console.log(`📡 正在從 AniList 獲取 ${year} 年 ${season} 季度的動畫清單...`);
  const query = `
      query ($season: MediaSeason, $seasonYear: Int) {
        Page(page: 1, perPage: 100) {
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

async function getJikanAgeRating(title) {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    if (res.ok) {
      const json = await res.json();
      return json.data?.[0]?.rating || "";
    }
  } catch(e) {}
  return "";
}

function removeDuplicates(animeList) {
  const seenMap = new Set();
  return animeList.filter(anime => {
    if (seenMap.has(anime.id)) return false;
    seenMap.add(anime.id);
    return true;
  });
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
      if (executing.length >= limit) await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

async function main() {
  try {
    console.log(`🚀 開始處理 ${YEAR} ${SEASON} 季度的動畫任務...`);
    
    // 1. 預載 ACG Secrets
    console.log(`🌐 正在從 ACG Secrets 預載季度資訊...`);
    const acgDataMap = await fetchACGSecretsSeasonal(YEAR, SEASON);
    
    // 2. 獲取 AniList
    let animeList = await fetchFromAniList(YEAR, SEASON);
    animeList = removeDuplicates(animeList);
    console.log(`✅ 成功獲取 ${animeList.length} 筆基礎資料。`);

    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    let completed = 0;

    const processedList = await parallelLimit(animeList, 3, async (anime) => {
      const native = anime.title.native || anime.title.romaji;
      const romaji = anime.title.romaji || "";
      const english = anime.title.english || "";
      
      let titleZh = "";
      let finalCover = "";
      let matchingSource = "";

      // Step 1: 巴哈姆特搜尋 (最高優先)
      const bData = await fetchBahamutData(native) || await fetchBahamutData(romaji) || await fetchBahamutData(english);
      if (bData) {
        titleZh = bData.titleZh;
        finalCover = bData.coverImage;
        matchingSource = "Bahamut";
      }

      // Step 2: ACGSecrets 補足
      const acgMatch = acgDataMap.get(native) || acgDataMap.get(romaji) || acgDataMap.get(english);
      if (acgMatch) {
        if (!titleZh) {
          titleZh = acgMatch.titleZh;
          matchingSource = "ACGSecrets";
        }
      }

      // Step 3: Bangumi 補足
      if (!titleZh || !finalCover) {
        const bgmInfo = await fetchBangumiData(native) || await fetchBangumiData(romaji);
        if (bgmInfo) {
          if (!titleZh) {
            titleZh = bgmInfo.titleZh;
            matchingSource = "Bangumi";
          }
          if (!finalCover) {
            finalCover = bgmInfo.coverImage.replace(/\/c\/|\/m\/|\/s\//g, '/l/');
          }
        }
      }

      // Final fallbacks
      if (!titleZh) {
        titleZh = converter(native || romaji || english);
        matchingSource = "AniList (Converted)";
      }
      if (!finalCover) {
        finalCover = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
      }

      // 年齡分級判定
      const needsAgeCheck = anime.genres?.includes('Ecchi') || anime.genres?.includes('Hentai') || anime.tags?.some(t => t.name === 'Nudity' || t.name === 'Explicit');
      let genres = (anime.genres || []).map((g) => genreMap[g] || g);
      if (needsAgeCheck) {
        const ageRating = await getJikanAgeRating(romaji || native || english);
        if (ageRating.includes('R+') || ageRating.includes('Rx')) {
          if (!genres.includes('紳士')) genres.push('紳士');
        }
      }

      completed++;
      console.log(`  [${completed}/${animeList.length}] 處理完成: ${titleZh} (來源: ${matchingSource})`);

      return {
        sourceId: `anilist-${anime.id}`,
        titleZh: titleZh,
        titleRomaji: romaji,
        titleEnglish: english,
        titleNative: native,
        episodes: anime.episodes,
        genres: genres,
        coverImage: finalCover,
        yearSeason: `${YEAR} ${SEASON}`,
        airTime: acgMatch?.timeInfo || ""
      };
    });

    const outputPath = path.join(process.cwd(), 'new_anime_results.json');
    await fs.writeFile(outputPath, JSON.stringify(processedList, null, 2), 'utf-8');
    console.log(`\n🎉 任務完成！結果已儲存至: ${outputPath}`);
  } catch (err) {
    console.error("❌ 發生錯誤:", err);
  }
}

main();
