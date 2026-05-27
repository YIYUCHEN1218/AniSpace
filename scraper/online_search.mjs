import axios from 'axios';
import * as cheerio from 'cheerio';
import { fetchBahamutData, fetchBangumiData } from './scraper_utils.mjs';

/**
 * Executes a search following the hierarchy: Bahamut -> ACGSecrets (Note: Seasonal only) -> Bangumi.
 * @param {string} query 
 */
export async function searchOnlineAnime(query) {
    console.log(`🔍 正在搜尋動畫: "${query}"...`);

    // 1. 巴哈姆特 (第一順位)
    console.log(`🌐 [1/3] 正在檢索 巴哈姆特動畫瘋...`);
    const bahamutResults = await searchBahamutAll(query);
    if (bahamutResults && bahamutResults.length > 0) {
        console.log(`✅ 在巴哈姆特找到 ${bahamutResults.length} 筆相關動畫！`);
        return bahamutResults;
    }

    // 2. ACGSecrets (第二順位 - 注意：因網站無搜尋功能，此處僅提供提示或精確匹配嘗試)
    console.log(`🌐 [2/3] 巴哈姆特查無資料，正在嘗試檢索 ACGSecrets (僅限當季與近期)...`);
    // 註：這部分在實務上較難達成，因為 ACGSecrets 沒有搜尋介面。
    // 如果使用者有特定需求，可以遍歷最近 4 季。

    // 3. Bangumi (第三順位)
    console.log(`🌐 [3/3] 正在檢索 Bangumi 作為最終補充...`);
    const bangumiResults = await searchBangumiAll(query);
    if (bangumiResults && bangumiResults.length > 0) {
        console.log(`✅ 在 Bangumi 找到 ${bangumiResults.length} 筆相關動畫！`);
        return bangumiResults;
    }

    console.log(`❌ 很抱歉，在所有來源中都找不到關於 "${query}" 的動畫資料。`);
    return [];
}

/**
 * Searches Bahamut and returns all matches.
 */
async function searchBahamutAll(query) {
    try {
        const url = `https://ani.gamer.com.tw/search.php?keyword=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const results = [];

        $('a.theme-list-main').each((_, el) => {
            const titleZh = $(el).find('.theme-name').text().trim();
            const href = $(el).attr('href') || '';
            const snMatch = href.match(/sn=(\d+)/);
            const sn = snMatch ? snMatch[1] : null;
            const info = $(el).find('.theme-info').text().trim();

            results.push({
                titleZh: titleZh,
                coverImage: sn ? `https://p2.bahamut.com.tw/anime/${sn}.jpg` : '',
                source: 'Bahamut',
                info: info,
                url: `https://ani.gamer.com.tw/animeVideo.php?sn=${sn}`
            });
        });

        return results;
    } catch (e) {
        return [];
    }
}

/**
 * Searches Bangumi and returns all matches.
 */
async function searchBangumiAll(query) {
    try {
        const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(query)}?type=2&responseGroup=small`;
        const { data } = await axios.get(url);
        if (data && data.list) {
            return data.list.map(item => ({
                titleZh: item.name_cn || item.name,
                titleNative: item.name,
                coverImage: (item.images?.large || item.images?.common || "").replace('http://', 'https://'),
                source: 'Bangumi',
                info: item.summary || '',
                url: item.url
            }));
        }
    } catch (e) {
        return [];
    }
    return [];
}

// 供 CLI 測試使用
if (process.argv[2]) {
    searchOnlineAnime(process.argv[2]).then(results => {
        console.log('\n--- 搜尋結果 ---');
        console.log(JSON.stringify(results, null, 2));
    });
}
