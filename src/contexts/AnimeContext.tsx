import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Anime, WatchedAnime } from '../types';
import { LOCAL_STORAGE_KEY, PLAN_TO_WATCH_KEY, CACHED_DATA_KEY } from '../utils/constants';

import { useTitleCorrections } from '../hooks/useTitleCorrections';

const REMOTE_DB_URL = import.meta.env.DEV 
  ? '/anime_data.json' 
  : 'https://raw.githubusercontent.com/YIYUCHEN1218/AniSpace/main/public/anime_data.json';

interface AnimeContextType {
  allAnime: Anime[];
  watchedList: WatchedAnime[];
  planToWatchList: Anime[];
  isScraping: boolean;
  scrapeProgress: string;
  handleSync: () => Promise<void>;
  handleAddCustomAnime: (anime: Anime) => void;
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

    if (loadedData.length === 0) {
      fetch(`${REMOTE_DB_URL}?v=` + new Date().getTime())
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            setAllAnime(data);
            localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(data));
          }
        }).catch(() => {});
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

  const handleSync = async () => {
    setIsScraping(true);
    setScrapeProgress('正在從遠端同步最新資料庫...');
    try {
      const res = await fetch(`${REMOTE_DB_URL}?v=` + new Date().getTime());
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setAllAnime(data);
          localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(data));
          setScrapeProgress('同步成功！');
        } else {
           setScrapeProgress('獲取資料為空...');
        }
      } else {
        setScrapeProgress('同步失敗，伺服器錯誤...');
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

  const handleAddCustomAnime = (anime: Anime) => {
    setAllAnime(prev => {
      const newList = [anime, ...prev];
      localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(newList));
      return newList;
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
      handleSync,
      handleAddCustomAnime,
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
