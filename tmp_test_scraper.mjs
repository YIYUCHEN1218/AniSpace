
async function runMockScrape() {
  const query = `
    query ($season: MediaSeason, $seasonYear: Int) {
      Page(page: 1, perPage: 1) {
        media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          id
          title { romaji english native }
          genres
          tags { name }
          coverImage { extraLarge }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { season: 'SPRING', seasonYear: 2026 } })
    });
    const json = await res.json();
    const item = json.data.Page.media[0];

    console.log('--- [Step 1] AniList Raw Response ---');
    console.log(JSON.stringify(item, null, 2));

    const nativeTitle = item.title.native || item.title.romaji;
    console.log('\n--- [Step 2] Fetching Bangumi Info for:', nativeTitle, '---');
    const bgmRes = await fetch('https://api.bgm.tv/search/subject/' + encodeURIComponent(nativeTitle) + '?type=2');
    const bgmJson = await bgmRes.json();
    const bgmItem = bgmJson.list ? bgmJson.list[0] : {};
    console.log(JSON.stringify(bgmItem, null, 2));

    console.log('\n--- [Step 3] Final Processed Object (Simulated) ---');
    const final = {
      id: 'anilist-' + item.id,
      titleZh: bgmItem.name_cn || bgmItem.name || nativeTitle,
      coverImage: bgmItem.images ? bgmItem.images.large.replace('/c/', '/l/') : item.coverImage.extraLarge,
      yearSeason: '2026 春',
      genres: item.genres
    };
    console.log(JSON.stringify(final, null, 2));
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

runMockScrape();
