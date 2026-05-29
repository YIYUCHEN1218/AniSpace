import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Anime, WatchedAnime } from '../types';
import { LOCAL_STORAGE_KEY, PLAN_TO_WATCH_KEY, CACHED_DATA_KEY, CUSTOM_ANIME_KEY } from '../utils/constants';

import { useTitleCorrections } from '../hooks/useTitleCorrections';

const getDbUrl = () => {
  const source = import.meta.env.VITE_DATA_SOURCE;
  if (source === 'remote') return 'https://raw.githubusercontent.com/YIYUCHEN1218/AniSpace/main/public/anime_data.json';
  if (source === 'local') return '/anime_data.json';
  return import.meta.env.DEV 
    ? '/anime_data.json' 
    : 'https://raw.githubusercontent.com/YIYUCHEN1218/AniSpace/main/public/anime_data.json';
};
const REMOTE_DB_URL = getDbUrl();

interface AnimeContextType {
  allAnime: Anime[];
  customAnimeList: Anime[];
  watchedList: WatchedAnime[];
  planToWatchList: Anime[];
  isScraping: boolean;
  scrapeProgress: string;
  handleSync: () => Promise<void>;
  handleAddCustomAnime: (anime: Anime) => void;
  handleImportCustomAnime: (importedData: Anime[]) => void;
  handleSaveReview: (watchedAnime: WatchedAnime) => void;
  handleRemoveReview: (animeId: string) => void;
  handlePlanToWatchToggle: (anime: Anime) => void;
  handleImport: (importedData: WatchedAnime[]) => void;
  handleImportPlan: (importedData: Anime[]) => void;
  // Correction hook exports
  corrections: Record<string, string>;
  setCorrection: (original: string, corrected: string) => void;
  getCorrectedTitle: (original: string) => string;
  handleImportCorrections: (importedCorrections: Record<string, string>) => void;
}

const AnimeContext = createContext<AnimeContextType | undefined>(undefined);

export const AnimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteAnime, setRemoteAnime] = useState<Anime[]>([]);
  const [customAnimeList, setCustomAnimeList] = useState<Anime[]>(() => {
    const saved = localStorage.getItem(CUSTOM_ANIME_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const allAnime = useMemo(() => [...customAnimeList, ...remoteAnime], [customAnimeList, remoteAnime]);
  const [watchedList, setWatchedList] = useState<WatchedAnime[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [planToWatchList, setPlanToWatchList] = useState<Anime[]>(() => {
    const saved = localStorage.getItem(PLAN_TO_WATCH_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  

  const { corrections, setCorrection, getCorrectedTitle, handleImportCorrections } = useTitleCorrections();

  useEffect(() => {
    let loadedData: Anime[] = [];
    const cachedData = localStorage.getItem(CACHED_DATA_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.length > 0) {
          loadedData = parsed;
          setRemoteAnime(parsed);
        }
      } catch (e) { }
    }

    if (loadedData.length === 0) {
      fetch(`${REMOTE_DB_URL}?v=` + new Date().getTime())
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            setRemoteAnime(data);
            localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(data));
          }
        }).catch(() => {});
    }

  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchedList));
  }, [watchedList]);

  useEffect(() => {
    localStorage.setItem(PLAN_TO_WATCH_KEY, JSON.stringify(planToWatchList));
  }, [planToWatchList]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_ANIME_KEY, JSON.stringify(customAnimeList));
  }, [customAnimeList]);

  const handleSync = async () => {
    setIsScraping(true);
    setScrapeProgress('正在從遠端同步最新資料庫...');
    try {
      const res = await fetch(`${REMOTE_DB_URL}?v=` + new Date().getTime());
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setRemoteAnime(data);
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
    setCustomAnimeList(prev => [anime, ...prev]);
  };

  const handleImportCustomAnime = (importedData: Anime[]) => {
    setCustomAnimeList(prev => {
      const newMap = new Map(importedData.map(i => [i.id, i]));
      prev.forEach(item => newMap.set(item.id, item));
      return Array.from(newMap.values());
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

  const handleRemoveReview = (animeId: string) => {
    setWatchedList(prev => prev.filter(w => w.id !== animeId));
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
      const newMap = new Map(importedData.map(i => [i.id, i]));
      prev.forEach(item => newMap.set(item.id, item));
      return Array.from(newMap.values());
    });
    const importedIds = new Set(importedData.map(i => i.id));
    setPlanToWatchList(prev => prev.filter(p => !importedIds.has(p.id)));
  };

  const handleImportPlan = (importedData: Anime[]) => {
    setPlanToWatchList(prev => {
      const newMap = new Map(importedData.map(i => [i.id, i]));
      prev.forEach(item => newMap.set(item.id, item));
      return Array.from(newMap.values());
    });
  };

  return (
    <AnimeContext.Provider value={{
      allAnime,
      customAnimeList,
      watchedList,
      planToWatchList,
      isScraping,
      scrapeProgress,
      handleSync,
      handleAddCustomAnime,
      handleImportCustomAnime,
      handleSaveReview,
      handleRemoveReview,
      handlePlanToWatchToggle,
      handleImport,
      handleImportPlan,
      corrections,
      setCorrection,
      getCorrectedTitle,
      handleImportCorrections
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
