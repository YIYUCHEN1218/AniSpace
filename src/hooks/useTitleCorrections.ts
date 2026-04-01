import { useState, useEffect } from 'react';
import { TITLE_CORRECTIONS_KEY } from '../utils/constants';

export type TitleCorrections = Record<string, string>;

export function useTitleCorrections() {
  const [corrections, setCorrections] = useState<TitleCorrections>(() => {
    const saved = localStorage.getItem(TITLE_CORRECTIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(TITLE_CORRECTIONS_KEY, JSON.stringify(corrections));
  }, [corrections]);

  const setCorrection = (original: string, corrected: string) => {
    setCorrections(prev => ({
      ...prev,
      [original]: corrected
    }));
  };

  const getCorrectedTitle = (original: string) => {
    return corrections[original] || original;
  };

  return { corrections, setCorrection, getCorrectedTitle };
}
