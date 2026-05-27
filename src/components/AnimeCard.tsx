import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './AnimeCard.css';
import type { Anime, WatchedAnime } from '../types';
import { Star, Heart, Edit2, Check, X } from 'lucide-react';
import { useAnime } from '../contexts/AnimeContext';

interface AnimeCardProps {
  anime: Anime | WatchedAnime;
  isWatched: boolean;
  isPlanToWatch: boolean;
  onActionClick: (anime: Anime) => void;
  onPlanToWatchToggle: (anime: Anime) => void;
}

interface PopoverPos {
  top: number;
  left: number;
  width: number;
}

const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  isWatched,
  isPlanToWatch,
  onActionClick,
  onPlanToWatchToggle,
}) => {
  const { setCorrection, getCorrectedTitle } = useAnime();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [popoverPos, setPopoverPos] = useState<PopoverPos>({ top: 0, left: 0, width: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

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
    setNewTitle(displayTitle);
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const popupWidth = Math.max(rect.width * 1.365, 315);
      setPopoverPos({
        top: rect.top + rect.height * 0.28,
        left: rect.left + rect.width / 2 - popupWidth / 2,
        width: popupWidth,
      });
    }
    setIsEditingTitle(true);
  };

  const handleCancel = () => setIsEditingTitle(false);

  return (
    <div className="anime-card fade-in" ref={cardRef}>
      {/* Edit title — Top Left */}
      <button
        className="edit-title-btn"
        onClick={handleEditClick}
        title="編輯顯示名稱"
      >
        <Edit2 size={14} />
      </button>

      {/* Plan-to-watch — Top Right */}
      <button
        className={`heart-btn ${isPlanToWatch ? 'active' : ''}`}
        onClick={() => onPlanToWatchToggle(anime as Anime)}
        title={isPlanToWatch ? '從期待清單移除' : '加入期待清單'}
      >
        <Heart size={20} className={isPlanToWatch ? 'heart-fill' : ''} />
      </button>

      <div className="card-image-container">
        <img src={anime.coverImage} alt={displayTitle} className="card-image" loading="lazy" />

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

        <div className="card-tags-container">
          <div className="card-tags-summary">
            {anime.genres.slice(0, 4).map(genre => (
              <span key={genre} className="genre-tag mini">{genre}</span>
            ))}
            {anime.genres.length > 4 && (
              <span className="genre-tag mini count">+{anime.genres.length - 4}</span>
            )}
          </div>
          <div className="card-tags-full">
            {anime.genres.map(genre => (
              <span key={genre} className="genre-tag mini">{genre}</span>
            ))}
          </div>
        </div>

        {isWatched && (anime as WatchedAnime).userComment && (
          <p className="card-comment">"{(anime as WatchedAnime).userComment}"</p>
        )}
      </div>

      {/* Edit-title popup — Portal ensures it's unaffected by card transforms */}
      {isEditingTitle && createPortal(
        <>
          <div className="card-edit-backdrop" onClick={handleCancel} />
          <div
            className="card-edit-popup"
            style={{ top: popoverPos.top, left: popoverPos.left, width: popoverPos.width }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-edit-popup-label">顯示名稱</div>
            <form onSubmit={handleTitleSubmit}>
              <input
                type="text"
                className="card-edit-popup-input"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
              />
              <div className="card-edit-popup-actions">
                <button type="button" className="card-edit-popup-btn cancel" onClick={handleCancel} title="取消">
                  <X size={15} />
                </button>
                <button type="submit" className="card-edit-popup-btn save" title="儲存">
                  <Check size={15} />
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};

export default AnimeCard;
