import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const YEAR = parseInt(process.argv[2]);
const SEASON = process.argv[3]?.toUpperCase();

if (!YEAR || !SEASON) {
  console.error("用法: node fetch_anime.mjs <YEAR> <SEASON>");
  console.error("範例: node fetch_anime.mjs 2024 SPRING");
  process.exit(1);
}

// 1. 使用 AniList 抓取動畫資料
async function fetchFromAniList(year, season) {
  console.log(`📡 正在從 AniList 獲取 ${year} 年 ${season} 季度的動畫...`);
  const query = `
      query ($season: MediaSeason, $seasonYear: Int) {
        Page(page: 1, perPage: 50) {
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            episodes
            coverImage {
              large
            }
          }
        }
      }
    `;
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { season, seasonYear: year }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList API 錯誤: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data.Page.media;
}

// 2. 上網查詢相對應的中文翻譯與封面圖片 (在此使用 Bangumi REST API)
async function getBangumiData(title, index, total) {
  try {
    const queryTerm = title.native || title.romaji || title.english;
    if (!queryTerm) return { name: "", image: "" };

    // 延遲以避免觸發 Bangumi API 的 Rate Limit
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log(`  [${index}/${total}] 查詢 Bangumi 資料: ${queryTerm}`);

    const response = await fetch(`https://api.bgm.tv/search/subject/${encodeURIComponent(queryTerm)}?type=2&responseGroup=small`, {
      headers: {
        'User-Agent': 'AnimeTracker/1.0 (Skill)'
      }
    });

    if (!response.ok) return { name: "", image: "" };

    const data = await response.json();
    if (data && data.list && data.list.length > 0) {
      const item = data.list[0];
      return {
        name: item.name_cn || item.name || "",
        image: item.images?.large || item.images?.common || ""
      };
    }
  } catch (e) {
    console.warn(`  ↳ 查詢失敗 (${queryTerm}): ${e.message}`);
  }
  return { name: "", image: "" };
}

// 3. 檢查重複的動畫並刪除
function removeDuplicates(animeList) {
  console.log("🔍 正在檢查清單內的重複項目...");
  const seenMap = new Set();
  const uniqueList = [];

  for (const anime of animeList) {
    // 利用 AniList ID 去重
    if (!seenMap.has(anime.id)) {
      seenMap.add(anime.id);
      uniqueList.push(anime);
    } else {
      console.log(`  ↳ 移除重複項目: ${anime.title.romaji}`);
    }
  }
  return uniqueList;
}

async function main() {
  try {
    // Step 1. 抓取 AniList
    let animeList = await fetchFromAniList(YEAR, SEASON);
    console.log(`✅ 成功獲取 ${animeList.length} 筆資料。`);

    // Step 2. 內部去重
    animeList = removeDuplicates(animeList);
    console.log(`✅ 去重後共 ${animeList.length} 筆資料。`);

    // Step 3. 找尋中文翻譯與封面圖片
    console.log("🌐 正在透過 Bangumi API 補齊中文翻譯與封面圖片...");
    const processedList = [];
    let cur = 1;
    for (const anime of animeList) {
      const bgmData = await getBangumiData(anime.title, cur++, animeList.length);
      processedList.push({
        sourceId: `anilist-${anime.id}`,
        titleZh: bgmData.name || anime.title.native || anime.title.romaji,
        titleRomaji: anime.title.romaji,
        titleEnglish: anime.title.english,
        titleNative: anime.title.native,
        episodes: anime.episodes,
        coverImage: bgmData.image || anime.coverImage?.large
      });
    }

    const outputPath = path.join(process.cwd(), 'new_anime_results.json');
    await fs.writeFile(outputPath, JSON.stringify(processedList, null, 2), 'utf-8');
    console.log(`\n🎉 抓取與翻譯完成！結果已儲存至: ${outputPath}`);
  } catch (err) {
    console.error("❌ 發生錯誤:", err);
  }
}

main();
