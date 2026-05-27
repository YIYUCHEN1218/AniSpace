import axios from 'axios';
import * as cheerio from 'cheerio';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Searches Bahamut Anime Crazy for a title and returns the most relevant match.
 * @param {string} title 
 * @returns {Promise<{titleZh: string, coverImage: string} | null>}
 */
export async function fetchBahamutData(title) {
    if (!title) return null;
    try {
        const searchUrl = `https://ani.gamer.com.tw/search.php?keyword=${encodeURIComponent(title)}`;
        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const bestMatch = $('a.theme-list-main').first();
        
        if (bestMatch.length > 0) {
            const zhTitle = bestMatch.find('.theme-name').text().trim();
            const href = bestMatch.attr('href') || '';
            const snMatch = href.match(/sn=(\d+)/);
            const sn = snMatch ? snMatch[1] : null;
            
            return {
                titleZh: zhTitle,
                coverImage: sn ? `https://p2.bahamut.com.tw/anime/${sn}.jpg` : ''
            };
        }
    } catch (error) {
        console.error(`[Bahamut] Error searching for "${title}":`, error.message);
    }
    return null;
}

/**
 * Fetches seasonal anime data from ACGSecrets.hk.
 * @param {number} year 
 * @param {string} season WINTER | SPRING | SUMMER | FALL
 * @returns {Promise<Map<string, any>>}
 */
export async function fetchACGSecretsSeasonal(year, season) {
    const seasonToMonth = { 'WINTER': '01', 'SPRING': '04', 'SUMMER': '07', 'FALL': '10' };
    const month = seasonToMonth[season.toUpperCase()];
    if (!month) return new Map();

    const url = `https://acgsecrets.hk/bangumi/${year}${month}/`;
    const animeMap = new Map();

    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);

        $('.anime-item').each((_, el) => {
            const title = $(el).find('.anime-name').text().trim();
            // Some items might have date/time info
            const timeInfo = $(el).find('.anime-extra').text().trim();
            
            // Try to find the Japanese title from the context if possible (often in scripts)
            // But for now we just map by the name we found.
            if (title) {
                animeMap.set(title, {
                    titleZh: title,
                    timeInfo: timeInfo
                });
            }
        });

        // Optional: Also check for the script data which often contains more stable titles
        const scriptData = $('script[type="application/ld+json"]').html();
        if (scriptData) {
            try {
                const json = JSON.parse(scriptData);
                if (Array.isArray(json)) {
                    json.forEach(item => {
                        if (item['@type'] === 'TVSeries' || item['@type'] === 'Movie') {
                            const name = item.name;
                            const altName = item.alternateName;
                            if (name) {
                                animeMap.set(name, {
                                    titleZh: name,
                                    alternateName: Array.isArray(altName) ? altName[0] : altName
                                });
                                if (Array.isArray(altName)) {
                                    altName.forEach(alt => animeMap.set(alt, { titleZh: name }));
                                } else if (altName) {
                                    animeMap.set(altName, { titleZh: name });
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

    } catch (error) {
        console.error(`[ACGSecrets] Error fetching season ${year}${month}:`, error.message);
    }

    return animeMap;
}

/**
 * Fallback search using Bangumi API.
 * @param {string} title 
 * @returns {Promise<{titleZh: string, coverImage: string} | null>}
 */
export async function fetchBangumiData(title) {
    if (!title) return null;
    try {
        const res = await axios.get(`https://api.bgm.tv/search/subject/${encodeURIComponent(title)}?type=2&responseGroup=small`);
        const json = res.data;
        if (json && json.list && json.list.length > 0) {
            const item = json.list[0];
            return {
                titleZh: item.name_cn || item.name || '',
                coverImage: item.images?.large || item.images?.common || ''
            };
        }
    } catch (error) {
        // Quietly fail
    }
    return null;
}
