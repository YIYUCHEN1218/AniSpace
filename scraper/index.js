import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_FILE = path.join(process.cwd(), 'public', 'anime_data.json');
const START_YEAR = 2024; // 為求示範快速，預設從2024開始抓取。改為2000即可抓取完整資料
const END_YEAR = 2025;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAnimeByYear(year) {
  let allAnime = [];
  let page = 1;
  let hasNextPage = true;

  console.log(`開始抓取 ${year} 年的資料...`);

  while (hasNextPage) {
    try {
      const response = await axios.get(`https://api.jikan.moe/v4/anime`, {
        params: {
          start_date: `${year}-01-01`,
          end_date: `${year}-12-31`,
          order_by: 'start_date',
          sort: 'asc',
          limit: 25,
          page: page
        }
      });

      const { data, pagination } = response.data;
      
      const formattedData = data.map(item => {
        // 嘗試從同義詞或英文名稱中尋找中文(簡單判斷是否有中文字元)
        const hasChinese = (str) => /[\u4e00-\u9fa5]/.test(str);
        
        let titleZh = item.title; // 預設原文或羅馬拼音
        
        // 如果有 synonyms，嘗試找尋中文
        if (item.title_synonyms && item.title_synonyms.length > 0) {
          const zhSynonym = item.title_synonyms.find(syn => hasChinese(syn));
          if (zhSynonym) titleZh = zhSynonym;
        }

        return {
          id: item.mal_id.toString(),
          titleZh: titleZh,
          coverImage: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
          yearSeason: `${item.year || year} ${item.season ? translateSeason(item.season) : '全年'}`,
          genres: item.genres.map(g => translateGenre(g.name))
        };
      });

      console.log(`[${year}] 取得第 ${page} 頁，共 ${formattedData.length} 筆資料`);
      allAnime = allAnime.concat(formattedData);

      hasNextPage = pagination.has_next_page;
      page++;

      // Jikan API 有比較嚴格的 Rate Limit (3 requests per second)
      // 我們設定 1 秒的延遲以確保不被封鎖
      await sleep(1000); 

      // 為了測試展示，我們只抓前 2 頁，如果需要全量資料可以把下面這段註解掉
      if (page > 2) {
        console.log(`[${year}] 達到展示頁數限制，停止抓取該年度 (請修改腳本以取得所有資料)`);
        break;
      }
      
    } catch (error) {
      console.error(`抓取 ${year} 第 ${page} 頁失敗:`, error.message);
      break; 
    }
  }

  return allAnime;
}

function translateSeason(season) {
  const map = { 'winter': '冬', 'spring': '春', 'summer': '夏', 'fall': '秋' };
  return map[season.toLowerCase()] || season;
}

function translateGenre(genre) {
  // 簡易中文翻譯
  const map = {
    'Action': '動作', 'Adventure': '冒險', 'Comedy': '喜劇', 'Drama': '劇情',
    'Fantasy': '奇幻', 'Horror': '恐怖', 'Mystery': '懸疑', 'Romance': '愛情',
    'Sci-Fi': '科幻', 'Slice of Life': '日常', 'Sports': '運動', 'Supernatural': '超自然',
    'Suspense': '懸疑', 'Award Winning': '獲獎', 'Avant Garde': '前衛', 'Boys Love': '耽美',
    'Girls Love': '百合', 'Gourmet': '美食', 'Workplace': '職場'
  };
  return map[genre] || genre;
}

async function main() {
  let finalAnimeList = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const animeData = await fetchAnimeByYear(y);
    finalAnimeList = finalAnimeList.concat(animeData);
  }
  
  // 取得台灣翻譯 (Bangumi-Data)
  try {
    console.log("正在從 bangumi-data 取得官方繁體中文/台灣翻譯...");
    const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
    if (res.ok) {
      const bgmData = await res.json();
      let patchedCount = 0;
      
      finalAnimeList.forEach(item => {
        const bgmItem = bgmData.items.find(bgm => {
          return bgm.sites && bgm.sites.some(s => s.site === 'mal' && s.id === item.id.toString());
        });
        
        if (bgmItem && bgmItem.titleTranslate) {
          const twTitles = bgmItem.titleTranslate['zh-Hant'];
          const cnTitles = bgmItem.titleTranslate['zh-Hans'];
          
          if (twTitles && twTitles.length > 0) {
            item.titleZh = twTitles[0];
            patchedCount++;
          } else if (cnTitles && cnTitles.length > 0) {
            item.titleZh = cnTitles[0];
            patchedCount++;
          }
        }
      });
      console.log(`✅ 成功為 ${patchedCount}/${finalAnimeList.length} 部動畫替換為台灣/中文官方翻譯！`);
    }
  } catch(e) {
    console.warn("無法取得繁中翻譯資料:", e.message);
  }

  // 確保 public 目錄存在
  const publicDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(finalAnimeList, null, 2), 'utf-8');
  console.log(`\n✅ 抓取完成！共 ${finalAnimeList.length} 筆資料已儲存至 ${DATA_FILE}`);
}

main();
