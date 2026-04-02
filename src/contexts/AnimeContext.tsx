import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Anime, WatchedAnime } from '../types';
import { LOCAL_STORAGE_KEY, PLAN_TO_WATCH_KEY, CACHED_DATA_KEY } from '../utils/constants';
import { parseSeason, getSeasonInfo } from '../utils/season';
import { scrapeAnimeData, searchAnimeOnline } from '../services/scraper';
import { useTitleCorrections } from '../hooks/useTitleCorrections';

interface AnimeContextType {
  allAnime: Anime[];
  watchedList: WatchedAnime[];
  planToWatchList: Anime[];
  isScraping: boolean;
  scrapeProgress: string;
  handleScrape: (year: number | 'ALL', season: string) => Promise<void>;
  handleSearchOnline: (query: string) => Promise<Anime[]>;
  handleSaveReview: (watchedAnime: WatchedAnime) => void;
  handlePlanToWatchToggle: (anime: Anime) => void;
  handleImport: (importedData: WatchedAnime[]) => void;
  // Correction hook exports
  setCorrection: (original: string, corrected: string) => void;
  getCorrectedTitle: (original: string) => string;
}

const AnimeContext = createContext<AnimeContextType | undefined>(undefined);

export const AnimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [watchedList, setWatchedList] = useState<WatchedAnime[]>([]);
  const [planToWatchList, setPlanToWatchList] = useState<Anime[]>([]);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  
  const autoScrapeChecked = useRef(false);
  const { setCorrection, getCorrectedTitle } = useTitleCorrections();

  useEffect(() => {
    let loadedData: Anime[] = [];
    const cachedData = localStorage.getItem(CACHED_DATA_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.length > 0) {
          loadedData = parsed;
          setAllAnime(parsed);
        }
      } catch (e) { }
    }

    const checkAndRunAutoScrape = async (currentData: Anime[]) => {
      if (autoScrapeChecked.current) return;
      autoScrapeChecked.current = true;
      
      const seasonsToScan = [getSeasonInfo(0), getSeasonInfo(-1)];
      let updatedData = [...currentData];
      let needsSave = false;

      for (const target of seasonsToScan) {
        const targetString = `${target.year} ${target.seasonZh}`;
        const hasData = updatedData.some(a => a.yearSeason === targetString);
        
        if (!hasData) {
          try {
            console.log(`Auto scraping for: ${targetString}`);
            const data = await scrapeAnimeData(target.year, target.seasonEng);
            if (data && data.length > 0) {
              const mergedMap = new Map();
              updatedData.forEach(item => mergedMap.set(item.id, item));
              data.forEach(item => mergedMap.set(item.id, item));
              updatedData = Array.from(mergedMap.values());
              updatedData.sort((a, b) => parseSeason(b.yearSeason) - parseSeason(a.yearSeason));
              needsSave = true;
            }
          } catch (e) {
            console.error(`Auto scrape failed for ${targetString}:`, e);
          }
        }
      }

      if (needsSave) {
        setAllAnime(updatedData);
        localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(updatedData));
      }
    };

    if (loadedData.length === 0) {
      fetch('/anime_data.json')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            loadedData = data;
            setAllAnime(data);
            localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(data));
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

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchedList));
  }, [watchedList]);

  useEffect(() => {
    localStorage.setItem(PLAN_TO_WATCH_KEY, JSON.stringify(planToWatchList));
  }, [planToWatchList]);

  const handleScrape = async (year: number | 'ALL', season: string) => {
    setIsScraping(true);
    setScrapeProgress('正在初始化爬蟲模組...');
    try {
      const START_YEAR = 2010;
      const currentYear = new Date().getFullYear();
      const yearsToScrape = year === 'ALL'
        ? Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i)
        : [year];

      for (const y of yearsToScrape) {
        const data = await scrapeAnimeData(y, season, (msg) => {
          setScrapeProgress(msg);
        });
        
        if (data && data.length > 0) {
          setAllAnime(prev => {
            const mergedMap = new Map();
            prev.forEach(item => mergedMap.set(item.id, item));
            data.forEach(item => mergedMap.set(item.id, item));
            const mergedData = Array.from(mergedMap.values());
            mergedData.sort((a, b) => parseSeason(b.yearSeason) - parseSeason(a.yearSeason));
            localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(mergedData));
            return mergedData;
          });
        }
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

  const handleSearchOnline = async (query: string) => {
    return await searchAnimeOnline(query);
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

  const handlePlanToWatchToggle = (anime: Anime) => {
    setPlanToWatchList(prev => {
      if (prev.some(p => p.id === anime.id)) {
        return prev.filter(p => p.id !== anime.id);
      } else {
        return [anime, ...prev];
      }
    });
  };

  const handleImport = (importedData: WatchedAnime[]) => {
    setWatchedList(prev => {
      const newMap = new Map(prev.map(i => [i.id, i]));
      importedData.forEach(item => newMap.set(item.id, item));
      return Array.from(newMap.values());
    });
    const importedIds = new Set(importedData.map(i => i.id));
    setPlanToWatchList(prev => prev.filter(p => !importedIds.has(p.id)));
  };

  return (
    <AnimeContext.Provider value={{
      allAnime,
      watchedList,
      planToWatchList,
      isScraping,
      scrapeProgress,
      handleScrape,
      handleSearchOnline,
      handleSaveReview,
      handlePlanToWatchToggle,
      handleImport,
      setCorrection,
      getCorrectedTitle
    }}>
      {children}
    </AnimeContext.Provider>
  );
};

export const useAnime = () => {
  const context = useContext(AnimeContext);
  if (context === undefined) {
    throw new Error('useAnime must be used within an AnimeProvider');
  }
  return context;
};
