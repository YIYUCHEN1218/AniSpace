import fs from 'fs';

async function test() {
  console.log("Fetching bangumi-data...");
  const res = await fetch("https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json");
  const data = await res.json();
  
  let matchCount = 0;
  // Let's check if we can find Dungeon Meshi MAL id 52701
  const dungeonMeshi = data.items.find(item => {
    return item.sites.some(site => site.site === 'myanimelist' && site.id === '52701');
  });
  
  console.log(dungeonMeshi ? dungeonMeshi.titleTranslate : "Not found");
}

test();
