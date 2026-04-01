import { useState, useEffect, useMemo } from 'react';
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
const NSFW_GENRES = ['Hentai', 'Ecchi', 'Erotica', 'Boys Love', 'Girls Love', '耽美', '百合', '紳士'];
const ITEMS_PER_PAGE = 25; // 5 rows * 5 columns

// Helper for sorting yearSeason strings like "2025 冬"
const seasonWeight: Record<string, number> = { '冬': 4, '秋': 3, '夏': 2, '春': 1 };
const parseSeason = (ys: string) => {
  if (!ys) return 0;
  const parts = ys.split(' ');
  const year = parseInt(parts[0]) || 0;
  const seasonValue = seasonWeight[parts[1]] || 0;
  return year * 10 + seasonValue;
};

function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'watched' | 'plan_to_watch'>('all');
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [watchedList, setWatchedList] = useState<WatchedAnime[]>([]);
  const [planToWatchList, setPlanToWatchList] = useState<Anime[]>([]);

  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [show18Plus, setShow18Plus] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | WatchedAnime | null>(null);

  // Scraper state
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');

  // Load data
  useEffect(() => {
    // 1. Check local storage cache first
    const cachedData = localStorage.getItem('anime_manager_cached_data');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.length > 0) {
          setAllAnime(parsed);
          return; // Skip fetching json if we already have full cache
        }
      } catch (e) { }
    }

    // 2. Fallback to public json
    fetch('/anime_data.json')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setAllAnime(data);
          localStorage.setItem('anime_manager_cached_data', JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Failed to load anime data:', err);
      });

    // 2. Load watched list from LocalStorage
    const savedWatched = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedWatched) {
      try {
        setWatchedList(JSON.parse(savedWatched));
      } catch (e) {
        console.error('Failed to parse watched list from localStorage', e);
      }
    }

    // 3. Load plan to watch list
    const savedPlan = localStorage.getItem(PLAN_TO_WATCH_KEY);
    if (savedPlan) {
      try {
        setPlanToWatchList(JSON.parse(savedPlan));
      } catch (e) {
        console.error('Failed to parse plan to watch list from localStorage', e);
      }
    }
  }, []);

  // Save changes to localStorage whenever watchedList updates
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchedList));
  }, [watchedList]);

  useEffect(() => {
    localStorage.setItem(PLAN_TO_WATCH_KEY, JSON.stringify(planToWatchList));
  }, [planToWatchList]);

  // Derived state for filters options
  const availableYears = useMemo(() => {
    const years = new Set(allAnime.map(a => a.yearSeason));
    return Array.from(years).sort((a, b) => parseSeason(b) - parseSeason(a)); // Descending year & season
  }, [allAnime]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    allAnime.forEach(a => {
      a.genres.forEach(g => {
        if (!NSFW_GENRES.includes(g)) {
          genres.add(g);
        }
      });
    });
    return Array.from(genres).sort();
  }, [allAnime]);

  // Filter and sort logic
  const filteredData = useMemo(() => {
    let sourceData = allAnime;
    if (activeTab === 'watched') sourceData = watchedList;
    if (activeTab === 'plan_to_watch') sourceData = planToWatchList;

    // Filtering
    let result = sourceData.filter(anime => {
      const isNSFW = anime.genres.some(g => NSFW_GENRES.includes(g));

      // 18+ limit filter
      if (!show18Plus && isNSFW) {
        return false;
      }

      const matchYear = selectedYear ? anime.yearSeason === selectedYear : true;
      const matchGenre = selectedGenres.length === 0 ? true : selectedGenres.some(sg => {
        if (sg === '紳士') return anime.genres.includes('紳士') || anime.genres.includes('Hentai') || anime.genres.includes('Ecchi');
        return anime.genres.includes(sg);
      });
      const matchSearch = searchQuery ? anime.titleZh.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      return matchYear && matchGenre && matchSearch;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'date_desc') {
        return parseSeason(b.yearSeason) - parseSeason(a.yearSeason);
      }
      if (sortBy === 'date_asc') {
        return parseSeason(a.yearSeason) - parseSeason(b.yearSeason);
      }
      if (sortBy === 'rating_desc' || sortBy === 'rating_asc') {
        // Only sort by rating if in watched tab, else fallback to date
        const aRating = activeTab === 'watched' ? ((a as WatchedAnime).userRating || 0) : 0;
        const bRating = activeTab === 'watched' ? ((b as WatchedAnime).userRating || 0) : 0;

        if (sortBy === 'rating_desc') return bRating - aRating;
        if (sortBy === 'rating_asc') return aRating - bRating;
      }
      return 0;
    });

    return result;
  }, [activeTab, allAnime, watchedList, planToWatchList, selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

  // Pagination Effect: reset to page 1 on filter/tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Scroll to top when page changes
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      // 確保捲動到剛好能看到 FilterBar 和標題的合適位置
      const yOffset = -20; 
      const y = mainContent.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Handlers
  const handleActionClick = (anime: Anime) => {
    // If it's already in watched list, we pass that object to edit it
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
        // Update
        const newList = [...prev];
        newList[existingIdx] = watchedAnime;
        return newList;
      } else {
        // Add new
        return [watchedAnime, ...prev];
      }
    });

    // Sub-requirement: Auto remove from planToWatch list once added to watched list
    setPlanToWatchList(prev => prev.filter(p => p.id !== watchedAnime.id));
  };

  const handleImport = (importedData: WatchedAnime[]) => {
    setWatchedList(prev => {
      const newMap = new Map(prev.map(i => [i.id, i]));
      importedData.forEach(item => {
        newMap.set(item.id, item);
      });
      return Array.from(newMap.values());
    });

    // Cleanup planToWatch overlaps
    const importedIds = new Set(importedData.map(i => i.id));
    setPlanToWatchList(prev => prev.filter(p => !importedIds.has(p.id)));

    setActiveTab('watched'); // Switch to watched tab to see imported results
  };

  const isAnimeWatched = (id: string) => {
    return watchedList.some(w => w.id === id);
  };

  const isPlanToWatch = (id: string) => {
    return planToWatchList.some(p => p.id === id);
  };

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeProgress('初始化爬蟲模組...');
    try {
      const data = await scrapeAnimeData(setScrapeProgress);
      if (data && data.length > 0) {
        setAllAnime(prev => {
          // 資料庫新舊合併 (Merge State)
          const mergedMap = new Map();
          // 保留舊的
          prev.forEach(item => mergedMap.set(item.id, item));
          // 寫入/更新新的
          data.forEach(item => mergedMap.set(item.id, item));
          
          const mergedData = Array.from(mergedMap.values());
          // 排序
          mergedData.sort((a, b) => parseSeason(b.yearSeason) - parseSeason(a.yearSeason));
          
          // 寫入硬碟快取
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
              onClick={handleScrape}
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
            <p>如果是初次使用或資料庫為空，請點擊右上角的 <strong>「搜尋新動畫」</strong> 按鈕來取得最新資料。</p>
            {isScraping && <p style={{ color: 'var(--accent-color)', marginTop: 'var(--spacing-4)' }}><Loader2 className="animate-spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> 正在努力抓取中，由於需遵守 API 限制保護規範，可能需要一至數分鐘，請不要關閉頁面...</p>}
          </div>
        ) : (
          <>
            <div className="anime-grid">
              {paginatedData.map(anime => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  isWatched={isAnimeWatched(anime.id)}
                  isPlanToWatch={isPlanToWatch(anime.id)}
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
    </div>
  );
}

export default App;
