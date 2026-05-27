import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Plus, Check, Star } from 'lucide-react';
import { useAnime } from '../contexts/AnimeContext';
import type { Anime } from '../types';
import './OnlineSearchModal.css';

interface OnlineSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnlineSearchModal: React.FC<OnlineSearchModalProps> = ({ isOpen, onClose }) => {
  const { handleSearchOnline, planToWatchList, watchedList, handlePlanToWatchToggle, handleSaveReview } = useAnime();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await handleSearchOnline(query);
      setResults(data);
    } catch (error) {
      console.error('Online search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdded = (animeId: string) => {
    return planToWatchList.some(p => p.id === animeId) || watchedList.some(w => w.id === animeId);
  };

  const getStatusLabel = (animeId: string) => {
    if (watchedList.some(w => w.id === animeId)) return '已觀看';
    if (planToWatchList.some(p => p.id === animeId)) return '待看清單';
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="online-search-modal-overlay" onClick={onClose}>
      <div className="online-search-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="online-search-header">
          <h2>線上搜尋</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form className="online-search-input-group" onSubmit={handleSearch}>
          <div className="online-search-input-wrapper">
            <Search size={20} className="search-input-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder="輸入動畫名稱 (中、日、英均可)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="online-search-input"
            />
          </div>
          <button type="submit" className="online-search-btn" disabled={isLoading || !query.trim()}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            <span>搜尋</span>
          </button>
        </form>

        <div className="online-search-results">
          {isLoading ? (
            <div className="search-loading">
              <Loader2 className="animate-spin" size={40} />
              <p>正在搜尋雲端資料庫...</p>
            </div>
          ) : results.length > 0 ? (
            results.map(anime => {
              const added = isAdded(anime.id);
              const status = getStatusLabel(anime.id);
              
              return (
                <div key={anime.id} className="search-result-card">
                  <img src={anime.coverImage} alt={anime.titleZh} className="result-cover" />
                  <div className="result-info">
                    <div className="result-title">{anime.titleZh}</div>
                    <div className="result-meta">{anime.yearSeason}</div>
                    <div className="result-actions">
                      {added ? (
                        <span className="action-btn added">
                          <Check size={14} style={{ marginRight: 4 }} />
                          {status}
                        </span>
                      ) : (
                        <>
                          <button 
                            className="action-btn"
                            onClick={() => handlePlanToWatchToggle(anime)}
                          >
                            <Plus size={14} style={{ marginRight: 4 }} />
                            想看
                          </button>
                          <button 
                            className="action-btn"
                            onClick={() => handleSaveReview({
                              ...anime,
                              userRating: 0,
                              userComment: '',
                              watchedDate: new Date().toISOString().split('T')[0]
                            })}
                          >
                            <Star size={14} style={{ marginRight: 4 }} />
                            看過
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : hasSearched ? (
            <div className="search-empty">
              <p>找不到相關動畫，請嘗試其他關鍵字。</p>
            </div>
          ) : (
            <div className="search-empty">
          <p>請輸入關鍵字開始自動搜尋</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnlineSearchModal;
