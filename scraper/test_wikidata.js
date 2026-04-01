async function test() {
  const q = `
  SELECT ?mal_id ?itemLabel WHERE {
    ?item wdt:P4086 ?mal_id.
    VALUES ?mal_id { "52991" "52701" "54449" }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-tw". }
  }`;
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(q) + '&format=json';
  const res = await fetch(url, {headers:{'User-Agent':'AnimeApp/1.0', 'Accept': 'application/sparql-results+json'}});
  if (!res.ok) {
    console.log(res.status, await res.text());
    return;
  }
  const d = await res.json();
  console.log(d.results.bindings);
}
test();
