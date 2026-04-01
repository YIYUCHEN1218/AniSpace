import React, { useState } from 'react';
import './AnimeCard.css';
import type { Anime, WatchedAnime } from '../types';
import { Star, Heart, Edit2, Check } from 'lucide-react';
import { useAnime } from '../contexts/AnimeContext';

interface AnimeCardProps {
  anime: Anime | WatchedAnime;
  isWatched: boolean;
  isPlanToWatch: boolean;
  onActionClick: (anime: Anime) => void;
  onPlanToWatchToggle: (anime: Anime) => void;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ 
  anime, 
  isWatched, 
  isPlanToWatch,
  onActionClick, 
  onPlanToWatchToggle 
}) => {
  const { setCorrection, getCorrectedTitle } = useAnime();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(getCorrectedTitle(anime.titleZh));

  const displayTitle = getCorrectedTitle(anime.titleZh);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      setCorrection(anime.titleZh, newTitle.trim());
      setIsEditingTitle(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  return (
    <div className="anime-card fade-in">
      {/* Title correction icon - Top Left */}
      <button 
        className="edit-title-btn" 
        onClick={handleEditClick}
        title="編輯顯示名稱"
      >
        <Edit2 size={14} />
      </button>

      {/* Plan to watch toggle - Top Right */}
      <button 
        className={`heart-btn ${isPlanToWatch ? 'active' : ''}`}
        onClick={() => onPlanToWatchToggle(anime as Anime)}
        title={isPlanToWatch ? "從期待清單移除" : "加入期待清單"}
      >
        <Heart size={20} className={isPlanToWatch ? "heart-fill" : ""} />
      </button>

      <div className="card-image-container">
        <img src={anime.coverImage} alt={displayTitle} className="card-image" loading="lazy" />
        
        {/* Rating Badge */}
        {isWatched && (anime as WatchedAnime).userRating && (
          <div className="rating-badge">
            <Star size={14} fill="#fbbf24" />
            <span>{(anime as WatchedAnime).userRating}</span>
          </div>
        )}

        <div className="card-overlay">
          <button 
            className={`action-btn ${isWatched ? 'watched' : ''}`}
            onClick={(e) => {
               e.stopPropagation();
               onActionClick(anime as Anime);
            }}
          >
            {isWatched ? '查看評價' : '加入已看'}
          </button>
        </div>
      </div>

      <div className="card-content">
        <h3 className="card-title">{displayTitle}</h3>
        <p className="card-year">{anime.yearSeason}</p>
        
        <div className="card-tags">
          {anime.genres.slice(0, 4).map(genre => (
            <span key={genre} className="genre-tag mini">{genre}</span>
          ))}
          {anime.genres.length > 4 && (
            <span className="genre-tag mini">+{anime.genres.length - 4}</span>
          )}
        </div>

        {isWatched && (anime as WatchedAnime).userComment && (
          <p className="card-comment">"{((anime as WatchedAnime).userComment)}"</p>
        )}
      </div>

      {/* Title Edit Popover */}
      {isEditingTitle && (
        <div className="edit-popover" onClick={() => setIsEditingTitle(false)}>
          <div className="edit-popover-content glass-panel" onClick={e => e.stopPropagation()}>
            <h4>修正動畫名稱</h4>
            <form onSubmit={handleTitleSubmit}>
              <input 
                type="text" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
                className="scrape-select"
                style={{ width: '100%', marginBottom: '12px', padding: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-glass" onClick={() => setIsEditingTitle(false)}>取消</button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 12px' }}>
                  <Check size={16} style={{ marginRight: '4px' }} /> 儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimeCard;
