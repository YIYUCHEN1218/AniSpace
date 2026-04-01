import React, { useState, useEffect } from 'react';
import './ReviewModal.css';
import type { Anime, WatchedAnime } from '../types';
import { X, Star } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime: Anime | WatchedAnime | null;
  onSave: (anime: WatchedAnime) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, anime, onSave }) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [hoverRating, setHoverRating] = useState<number>(0);

  useEffect(() => {
    if (anime) {
      const watched = anime as WatchedAnime;
      setRating(watched.userRating || 0);
      setComment(watched.userComment || '');
    }
  }, [anime, isOpen]);

  if (!isOpen || !anime) return null;

  const handleSave = () => {
    const watchedDate = (anime as WatchedAnime).watchedDate || new Date().toISOString();
    
    onSave({
      ...anime,
      userRating: rating,
      userComment: comment,
      watchedDate
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel fade-in" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className="modal-header">
          {anime.coverImage && (
            <img src={anime.coverImage} alt={anime.titleZh} className="modal-image" />
          )}
          <div className="modal-info">
            <h2 className="modal-title">{anime.titleZh}</h2>
            <p className="modal-subtitle">{anime.yearSeason}</p>
          </div>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>給予評分 (1-10)</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                <Star
                  key={val}
                  size={28}
                  className={`star ${val <= (hoverRating || rating) ? 'filled' : ''}`}
                  onMouseEnter={() => setHoverRating(val)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(val)}
                  fill={val <= (hoverRating || rating) ? "currentColor" : "none"}
                />
              ))}
              <span className="rating-value">{hoverRating || rating || '-'} / 10</span>
            </div>
          </div>

          <div className="form-group">
            <label>簡單評論</label>
            <textarea
              placeholder="寫下您對這部動畫的看法..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>取消</button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={rating === 0}
          >
            儲存紀錄
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
