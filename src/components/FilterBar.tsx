import React, { useState } from 'react';
import './FilterBar.css';
import { Search, SlidersHorizontal, ArrowDownAZ, Plus } from 'lucide-react';
import { getRelativeSeasonString } from '../utils/season';
import AddAnimeModal from './AddAnimeModal';

interface FilterBarProps {
  years: string[];
  genres: string[];
  selectedYear: string;
  selectedGenres: string[];
  searchQuery: string;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onYearChange: (year: string) => void;
  onGenreChange: (genres: string[]) => void;
  onSearchChange: (search: string) => void;
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
  const [isAddAnimeOpen, setIsAddAnimeOpen] = useState(false);

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
            onClick={() => setIsAddAnimeOpen(true)}
            title="手動新增動畫"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <SlidersHorizontal size={18} className="filter-icon" />
            <select 
              value={years.includes(selectedYear) || selectedYear === '~ 2009' ? selectedYear : ""} 
              onChange={(e) => handleYearSelect(e.target.value)}
              className="filter-select"
            >
              <option value="">所有年份</option>
              {(() => {
                const elements: React.JSX.Element[] = [];
                let currentYear = '';
                years.forEach((ys, index) => {
                  const y = ys.match(/\d+/)?.[0] || '';
                  if (currentYear !== '' && currentYear !== y) {
                    elements.push(<option key={`sep-${index}`} disabled>──────────</option>);
                  }
                  currentYear = y;
                  elements.push(<option key={ys} value={ys}>{ys}</option>);
                });
                return elements;
              })()}
              <option disabled>──────────</option>
              <option value="~ 2009">~ 2009</option>
              <option disabled>&nbsp;</option>
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
            className={`genre-tag ${selectedGenres.includes('福利') ? 'active' : ''}`}
            onClick={() => toggleGenre('福利')}
            style={{ borderColor: 'rgba(255, 50, 50, 0.4)', color: selectedGenres.includes('福利') ? '#fff' : '#ff5555', backgroundColor: selectedGenres.includes('福利') ? '#ff3333' : 'transparent' }}
          >
            福利
          </button>
        </div>
      </div>

      <AddAnimeModal 
        isOpen={isAddAnimeOpen} 
        onClose={() => setIsAddAnimeOpen(false)} 
      />
    </div>
  );
};

export default FilterBar;
