import React, { useState } from 'react';
import './FilterBar.css';
import { Search, SlidersHorizontal, ArrowDownAZ, AlertTriangle, Globe } from 'lucide-react';
import { getRelativeSeasonString } from '../utils/season';
import OnlineSearchModal from './OnlineSearchModal';

interface FilterBarProps {
  years: string[];
  genres: string[];
  selectedYear: string;
  selectedGenres: string[];
  searchQuery: string;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  years,
  genres,
  selectedYear,
  selectedGenres,
  searchQuery,
  sortBy,
  onYearChange,
  onGenreChange,
  onSearchChange,
  onSortChange
}) => {
  const [isOnlineSearchOpen, setIsOnlineSearchOpen] = useState(false);

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      onGenreChange(selectedGenres.filter(g => g !== genre));
    } else {
      onGenreChange([...selectedGenres, genre]);
    }
  };

  const prevSeason = getRelativeSeasonString(-1);
  const currentSeason = getRelativeSeasonString(0);

  const handleYearSelect = (year: string) => {
    onYearChange(year);
  };

  const handleSeasonToggle = (target: string) => {
    if (selectedYear === target) {
      onYearChange(''); // Un-toggle
    } else {
      onYearChange(target);
    }
  };

  return (
    <div className="filter-bar-container">
      <div className="filter-section glass-panel fade-in">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="搜尋動畫名稱..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          <button 
            className="online-search-trigger" 
            onClick={() => setIsOnlineSearchOpen(true)}
            title="線上搜尋新番資訊"
          >
            <Globe size={18} />
          </button>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <SlidersHorizontal size={18} className="filter-icon" />
            <select 
              value={years.includes(selectedYear) ? selectedYear : ""} 
              onChange={(e) => handleYearSelect(e.target.value)}
              className="filter-select"
            >
              <option value="">所有年份</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="quick-tabs">
              <button 
                className={`quick-tab ${selectedYear === prevSeason ? 'active' : ''}`} 
                onClick={() => handleSeasonToggle(prevSeason)}
              >
                上季動畫
              </button>
              <button 
                className={`quick-tab ${selectedYear === currentSeason ? 'active' : ''}`} 
                onClick={() => handleSeasonToggle(currentSeason)}
              >
                本季新番
              </button>
            </div>
          </div>

          <div className="filter-group right-aligned">
            <ArrowDownAZ size={18} className="filter-icon" />
            <select 
              value={sortBy} 
              onChange={(e) => onSortChange(e.target.value)}
              className="filter-select"
            >
              <option value="date_desc">首播年份 (新到舊)</option>
              <option value="date_asc">首播年份 (舊到新)</option>
              <option value="rating_desc">你的評分 (高到低)</option>
              <option value="rating_asc">你的評分 (低到高)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="genres-section glass-panel fade-in">
        <span className="genres-label">分類:</span>
        <div className="genres-wrap">
          <button 
            className={`genre-tag ${selectedGenres.length === 0 ? 'active' : ''}`}
            onClick={() => onGenreChange([])}
          >
            全部
          </button>
          {genres.map(genre => (
            <button
              key={genre}
              className={`genre-tag ${selectedGenres.includes(genre) ? 'active' : ''}`}
              onClick={() => toggleGenre(genre)}
            >
              {genre}
            </button>
          ))}
          <button
            className={`genre-tag ${selectedGenres.includes('紳士') ? 'active' : ''}`}
            onClick={() => toggleGenre('紳士')}
            style={{ borderColor: 'rgba(255, 50, 50, 0.4)', color: selectedGenres.includes('紳士') ? '#fff' : '#ff5555', backgroundColor: selectedGenres.includes('紳士') ? '#ff3333' : 'transparent' }}
          >
            紳士
          </button>
        </div>
      </div>

      <OnlineSearchModal 
        isOpen={isOnlineSearchOpen} 
        onClose={() => setIsOnlineSearchOpen(false)} 
      />
    </div>
  );
};

export default FilterBar;
