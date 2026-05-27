import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'anime_data.json');

async function patch() {
  console.log("Fetching bangumi-data for Taiwanese translations...");
  const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
  const bgmData = await res.json();
  
  if (!fs.existsSync(DATA_FILE)) {
    console.error("No anime_data.json found!");
    return;
  }
  
  const animeData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let patchedCount = 0;
  
  for (let i = 0; i < animeData.length; i++) {
    const item = animeData[i];
    
    // Find the anime in bangumi-data
    const bgmItem = bgmData.items.find(bgm => {
      return bgm.sites && bgm.sites.some(s => s.site === 'mal' && s.id === item.id.toString());
    });
    
    if (bgmItem && bgmItem.titleTranslate) {
      // Prefer zh-Hant (Traditional Chinese), fallback to zh-Hans, then fallback to original
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
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(animeData, null, 2), 'utf-8');
  console.log(`\n✅ 成功將 ${patchedCount}/${animeData.length} 部動畫更新為官方中文/台灣翻譯！`);
}

patch();
