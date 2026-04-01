import React from 'react';
import './AnimeCard.css';
import type { Anime, WatchedAnime } from '../types';
import { Star, PlusCircle, CheckCircle, Heart } from 'lucide-react';

interface AnimeCardProps {
  anime: Anime | WatchedAnime;
  isWatched?: boolean;
  isPlanToWatch?: boolean;
  onActionClick: (anime: Anime) => void;
  onPlanToWatchToggle?: (anime: Anime) => void;
}

const AnimeCard: React.FC<AnimeCardProps> = ({ 
  anime, 
  isWatched = false, 
  isPlanToWatch = false,
  onActionClick,
  onPlanToWatchToggle
}) => {
  const watchedAnime = anime as WatchedAnime;

  return (
    <div className="anime-card fade-in">
      <div className="card-image-container">
        {anime.coverImage ? (
          <img src={anime.coverImage} alt={anime.titleZh} className="card-image" loading="lazy" />
        ) : (
          <div className="card-image placeholder">無圖片</div>
        )}
        
        {/* Heart icon in top right: only show if NOT watched */}
        {!isWatched && onPlanToWatchToggle && (
          <button 
            className={`heart-btn ${isPlanToWatch ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlanToWatchToggle(anime);
            }}
            title={isPlanToWatch ? "移除期待動畫" : "加入期待動畫"}
          >
            <Heart size={20} fill={isPlanToWatch ? 'currentColor' : 'none'} className={isPlanToWatch ? 'heart-fill' : ''}/>
          </button>
        )}

        <div className="card-overlay">
          <button 
            className={`action-btn ${isWatched ? 'watched' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onActionClick(anime);
            }}
          >
            {isWatched ? (
              <>
                <CheckCircle size={20} />
                <span>編輯評論</span>
              </>
            ) : (
              <>
                <PlusCircle size={20} />
                <span>加入已看</span>
              </>
            )}
          </button>
        </div>
        
        {isWatched && watchedAnime.userRating && (
          <div className="rating-badge">
            <Star size={14} fill="currentColor" />
            <span>{watchedAnime.userRating}</span>
          </div>
        )}
      </div>
      
      <div className="card-content">
        <h3 className="card-title" title={anime.titleZh}>{anime.titleZh}</h3>
        <p className="card-year">{anime.yearSeason}</p>
        
        <div className="card-tags">
          {anime.genres.slice(0, 3).map((genre, idx) => (
            <span key={idx} className="glass-pill">{genre}</span>
          ))}
          {anime.genres.length > 3 && (
            <span className="glass-pill">+{anime.genres.length - 3}</span>
          )}
        </div>
        
        {isWatched && watchedAnime.userComment && (
          <p className="card-comment" title={watchedAnime.userComment}>
            "{watchedAnime.userComment}"
          </p>
        )}
      </div>
    </div>
  );
};

export default AnimeCard;
