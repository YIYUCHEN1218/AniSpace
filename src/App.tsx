import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import type { Anime, WatchedAnime, SortOption } from './types';
import AnimeCard from './components/AnimeCard';
import FilterBar from './components/FilterBar';
import ReviewModal from './components/ReviewModal';
import ImportExportButtons from './components/ImportExportButtons';
import Pagination from './components/Pagination';
import { Layers, DownloadCloud, Loader2 } from 'lucide-react';
import { scrapeAnimeData } from './services/scraper';

const LOCAL_STORAGE_KEY = 'anime_manager_watched_list';
const PLAN_TO_WATCH_KEY = 'anime_manager_plan_to_watch';
const NSFW_GENRES = ['Hentai', 'Ecchi', 'Erotica', 'Boys Love', 'Girls Love', '耽美', '百合', '紳士', '福利'];
const ITEMS_PER_PAGE = 25;

const seasonWeight: Record<string, number> = { '冬': 4, '秋': 3, '夏': 2, '春': 1 };
const parseSeason = (ys: string) => {
  if (!ys) return 0;
  const parts = ys.split(' ');
  const year = parseInt(parts[0]) || 0;
  const seasonValue = seasonWeight[parts[1]] || 0;
  return year * 10 + seasonValue;
};

function getCurrentSeasonInfo() {
  const date = new Date();
  let year = date.getFullYear();
  let currentSeasonIndex = Math.floor(date.getMonth() / 3);
  const seasonZhMap = ['冬', '春', '夏', '秋'];
  const seasonEngMap = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  return { year, seasonZh: seasonZhMap[currentSeasonIndex], seasonEng: seasonEngMap[currentSeasonIndex] };
}

function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'watched' | 'plan_to_watch'>('all');
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [watchedList, setWatchedList] = useState<WatchedAnime[]>([]);
  const [planToWatchList, setPlanToWatchList] = useState<Anime[]>([]);

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [show18Plus, setShow18Plus] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | WatchedAnime | null>(null);

  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  
  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [scrapeYear, setScrapeYear] = useState<number>(new Date().getFullYear());
  const [scrapeSeason, setScrapeSeason] = useState<string>(getCurrentSeasonInfo().seasonEng);
  
  const autoScrapeChecked = useRef(false);

  useEffect(() => {
    let loadedData: Anime[] = [];
    const cachedData = localStorage.getItem('anime_manager_cached_data');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.length > 0) {
          loadedData = parsed;
          setAllAnime(parsed);
        }
      } catch (e) { }
    }

    if (loadedData.length === 0) {
      fetch('/anime_data.json')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            loadedData = data;
            setAllAnime(data);
            localStorage.setItem('anime_manager_cached_data', JSON.stringify(data));
          }
          checkAndRunAutoScrape(loadedData);
        }).catch(() => {
          checkAndRunAutoScrape(loadedData);
        });
    } else {
      checkAndRunAutoScrape(loadedData);
    }

    const savedWatched = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedWatched) {
      try { setWatchedList(JSON.parse(savedWatched)); } catch (e) {}
    }

    const savedPlan = localStorage.getItem(PLAN_TO_WATCH_KEY);
    if (savedPlan) {
      try { setPlanToWatchList(JSON.parse(savedPlan)); } catch (e) {}
    }
  }, []);

  const checkAndRunAutoScrape = (currentData: Anime[]) => {
    if (autoScrapeChecked.current) return;
    autoScrapeChecked.current = true;
    
    const curr = getCurrentSeasonInfo();
    const targetString = `${curr.year} ${curr.seasonZh}`;
    
    // 如果本地資料庫，沒有任何一部動畫屬於 "本季" (即使用者尚未手動更新過本季)
    const hasCurrentSeason = currentData.some(a => a.yearSeason === targetString);
    if (!hasCurrentSeason) {
      console.log(`[AutoScrape] Missing ${targetString}, triggering silent update...`);
      // We run silently
      scrapeAnimeData(curr.year, curr.seasonEng).then(data => {
        if (data && data.length > 0) {
          setAllAnime(prev => {
            const mergedMap = new Map();
            prev.forEach(item => mergedMap.set(item.id, item));
            data.forEach(item => mergedMap.set(item.id, item));
            const mergedData = Array.from(mergedMap.values());
            mergedData.sort((a, b) => parseSeason(b.yearSeason) - parseSeason(a.yearSeason));
            localStorage.setItem('anime_manager_cached_data', JSON.stringify(mergedData));
            return mergedData;
          });
        }
      }).catch(e => console.error('Auto scrape failed:', e));
    }
  };

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchedList));
  }, [watchedList]);

  useEffect(() => {
    localStorage.setItem(PLAN_TO_WATCH_KEY, JSON.stringify(planToWatchList));
  }, [planToWatchList]);

  const availableYears = useMemo(() => {
    const years = new Set(allAnime.map(a => a.yearSeason));
    return Array.from(years).sort((a, b) => parseSeason(b) - parseSeason(a));
  }, [allAnime]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    allAnime.forEach(a => {
      a.genres.forEach(g => {
        if (!NSFW_GENRES.includes(g)) genres.add(g);
      });
    });
    return Array.from(genres).sort();
  }, [allAnime]);

  const filteredData = useMemo(() => {
    let sourceData = allAnime;
    if (activeTab === 'watched') sourceData = watchedList;
    if (activeTab === 'plan_to_watch') sourceData = planToWatchList;

    let result = sourceData.filter(anime => {
      const isNSFW = anime.genres.some(g => NSFW_GENRES.includes(g));
      if (!show18Plus && isNSFW) return false;

      const matchYear = selectedYear ? anime.yearSeason === selectedYear : true;
      const matchGenre = selectedGenres.length === 0 ? true : selectedGenres.some(sg => {
        if (sg === '紳士') return anime.genres.includes('紳士') || anime.genres.includes('Hentai') || anime.genres.includes('Ecchi') || anime.genres.includes('福利');
        return anime.genres.includes(sg);
      });
      const matchSearch = searchQuery ? anime.titleZh.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      return matchYear && matchGenre && matchSearch;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'date_desc') return parseSeason(b.yearSeason) - parseSeason(a.yearSeason);
      if (sortBy === 'date_asc') return parseSeason(a.yearSeason) - parseSeason(b.yearSeason);
      if (sortBy === 'rating_desc' || sortBy === 'rating_asc') {
        const aRating = activeTab === 'watched' ? ((a as WatchedAnime).userRating || 0) : 0;
        const bRating = activeTab === 'watched' ? ((b as WatchedAnime).userRating || 0) : 0;
        if (sortBy === 'rating_desc') return bRating - aRating;
        if (sortBy === 'rating_asc') return aRating - bRating;
      }
      return 0;
    });

    return result;
  }, [activeTab, allAnime, watchedList, planToWatchList, selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      const yOffset = -20; 
      const y = mainContent.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [currentPage]);

  const handleActionClick = (anime: Anime) => {
    const existingWatched = watchedList.find(w => w.id === anime.id);
    setSelectedAnime(existingWatched || anime);
    setIsModalOpen(true);
  };

  const handlePlanToWatchToggle = (anime: Anime) => {
    setPlanToWatchList(prev => {
      if (prev.some(p => p.id === anime.id)) {
        return prev.filter(p => p.id !== anime.id);
      } else {
        return [anime, ...prev];
      }
    });
  };

  const handleSaveReview = (watchedAnime: WatchedAnime) => {
    setWatchedList(prev => {
      const existingIdx = prev.findIndex(w => w.id === watchedAnime.id);
      if (existingIdx !== -1) {
        const newList = [...prev];
        newList[existingIdx] = watchedAnime;
        return newList;
      } else {
        return [watchedAnime, ...prev];
      }
    });
    setPlanToWatchList(prev => prev.filter(p => p.id !== watchedAnime.id));
  };

  const handleImport = (importedData: WatchedAnime[]) => {
    setWatchedList(prev => {
      const newMap = new Map(prev.map(i => [i.id, i]));
      importedData.forEach(item => newMap.set(item.id, item));
      return Array.from(newMap.values());
    });
    const importedIds = new Set(importedData.map(i => i.id));
    setPlanToWatchList(prev => prev.filter(p => !importedIds.has(p.id)));
    setActiveTab('watched');
  };

  const handleScrape = async (year: number, season: string) => {
    setIsScraping(true);
    setScrapeProgress('初始化爬蟲模組...');
    try {
      const data = await scrapeAnimeData(year, season, setScrapeProgress);
      if (data && data.length > 0) {
        setAllAnime(prev => {
          const mergedMap = new Map();
          prev.forEach(item => mergedMap.set(item.id, item));
          data.forEach(item => mergedMap.set(item.id, item));
          const mergedData = Array.from(mergedMap.values());
          mergedData.sort((a, b) => parseSeason(b.yearSeason) - parseSeason(a.yearSeason));
          localStorage.setItem('anime_manager_cached_data', JSON.stringify(mergedData));
          return mergedData;
        });
      }
    } catch (err) {
      console.error(err);
      setScrapeProgress('發生錯誤...');
    } finally {
      setTimeout(() => {
        setIsScraping(false);
        setScrapeProgress('');
      }, 2000);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header container">
        <div className="header-left">
          <h1 className="app-title"><Layers className="header-icon" /> AniSpace 動畫庫</h1>
          <p className="subtitle">為您記錄每一場感動</p>
        </div>

        <div className="header-right">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              所有動畫庫
            </button>
            <button
              className={`nav-tab ${activeTab === 'plan_to_watch' ? 'active' : ''}`}
              onClick={() => setActiveTab('plan_to_watch')}
            >
              期待動畫
            </button>
            <button
              className={`nav-tab ${activeTab === 'watched' ? 'active' : ''}`}
              onClick={() => setActiveTab('watched')}
            >
              動畫紀錄
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className="btn-glass"
              onClick={() => setIsScrapeModalOpen(true)}
              disabled={isScraping}
              style={{ fontSize: '0.85rem', padding: 'var(--spacing-2) var(--spacing-4)' }}
            >
              {isScraping ? <Loader2 className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
              {isScraping ? scrapeProgress : '搜尋新動畫'}
            </button>
            <ImportExportButtons
              watchedData={watchedList}
              onImport={handleImport}
            />
          </div>
        </div>
      </header>

      <main id="main-content" className="container wrapper">
        <FilterBar
          years={availableYears}
          genres={availableGenres}
          selectedYear={selectedYear}
          selectedGenres={selectedGenres}
          searchQuery={searchQuery}
          sortBy={sortBy}
          show18Plus={show18Plus}
          onYearChange={setSelectedYear}
          onGenreChange={setSelectedGenres}
          onSearchChange={setSearchQuery}
          onSortChange={(s) => setSortBy(s as SortOption)}
          on18PlusChange={setShow18Plus}
        />

        {filteredData.length === 0 ? (
          <div className="empty-state glass-panel fade-in">
            <h2>沒有找到符合的動畫</h2>
            <p>資料庫目前為最新狀態，或請調整您的過濾條件。</p>
            {isScraping && <p style={{ color: 'var(--accent-color)', marginTop: 'var(--spacing-4)' }}><Loader2 className="animate-spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> 正在努力抓取中，請不要關閉頁面...</p>}
          </div>
        ) : (
          <>
            <div className="anime-grid">
              {paginatedData.map(anime => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  isWatched={watchedList.some(w => w.id === anime.id)}
                  isPlanToWatch={planToWatchList.some(p => p.id === anime.id)}
                  onActionClick={handleActionClick}
                  onPlanToWatchToggle={handlePlanToWatchToggle}
                />
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </main>

      <ReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        anime={selectedAnime}
        onSave={handleSaveReview}
      />

      {isScrapeModalOpen && (
        <div className="modal-overlay fade-in" onClick={() => setIsScrapeModalOpen(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>選擇特定季度掃描</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>輸入您想要擴充收藏庫的特定年份與季節。不再需要一次抓滿好幾年了！</p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
              <select 
                value={scrapeYear} 
                onChange={e => setScrapeYear(Number(e.target.value))} 
                style={{ appearance: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '8px' }}
              >
                {Array.from({length: new Date().getFullYear() - 1999 + 2}, (_, i) => 2000 + i).slice().reverse().map(y => (
                  <option key={y} value={y}>{y} 年</option>
                ))}
              </select>

              <select 
                value={scrapeSeason} 
                onChange={e => setScrapeSeason(e.target.value)} 
                style={{ appearance: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '8px' }}
              >
                <option value="WINTER">冬 (1-3月)</option>
                <option value="SPRING">春 (4-6月)</option>
                <option value="SUMMER">夏 (7-9月)</option>
                <option value="FALL">秋 (10-12月)</option>
              </select>
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-glass" onClick={() => setIsScrapeModalOpen(false)}>取消返回</button>
              <button className="btn-primary" onClick={() => { setIsScrapeModalOpen(false); handleScrape(scrapeYear, scrapeSeason); }}>
                開始抓取
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
