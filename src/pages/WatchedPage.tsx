import { useState, useMemo, useEffect } from 'react';
import type { WatchedAnime, SortOption } from '../types';
import AnimeCard from '../components/AnimeCard';
import Pagination from '../components/Pagination';
import ReviewModal from '../components/ReviewModal';
import { useAnime } from '../contexts/AnimeContext';
import { ITEMS_PER_PAGE } from '../utils/constants';
import { Search } from 'lucide-react';

const WatchedPage = () => {
  const { 
    watchedList, 
    handleSaveReview, 
    handlePlanToWatchToggle 
  } = useAnime();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<WatchedAnime | null>(null);

  const filteredData = useMemo(() => {
    let result = watchedList.filter(anime => 
      anime.titleZh.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return result.sort((a, b) => {
      if (sortBy === 'rating_desc') return (b.userRating || 0) - (a.userRating || 0);
      if (sortBy === 'rating_asc') return (a.userRating || 0) - (b.userRating || 0);
      return 0; // In reality, we should sort by date_desc by default
    });
  }, [watchedList, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const handleActionClick = (anime: any) => {
    setSelectedAnime(anime as WatchedAnime);
    setIsModalOpen(true);
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const headerElement = document.querySelector('.page-header');
    if (headerElement) {
      const yOffset = 5;
      const y = headerElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length, sortBy]);

  return (
    <>
      <div className="page-header" style={{ marginBottom: 'var(--spacing-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section-title">動畫紀錄 ({filteredData.length})</h2>
        <div style={{ display: 'flex', gap: '12px', flex: '1', maxWidth: '600px', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: '1', position: 'relative' }}>
            <Search size={20} className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="搜尋觀看紀錄..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: '100%', paddingLeft: '40px' }}
            />
          </div>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="filter-select"
            style={{ minWidth: '160px' }}
          >
            <option value="date_desc">首播年份 (新到舊)</option>
            <option value="rating_desc">評分 (最高)</option>
            <option value="rating_asc">評分 (最低)</option>
          </select>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="empty-state glass-panel fade-in">
          <h2>{searchQuery ? "找不到符合的動畫" : "尚未有任何觀看紀錄"}</h2>
          <p>{searchQuery ? "請嘗試其他搜尋關鍵字。" : "在所有動畫中點擊「加入已看」按鈕，即可在此記錄。"}</p>
        </div>
      ) : (
        <>
          <div className="anime-grid">
            {paginatedData.map(anime => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                isWatched={true}
                isPlanToWatch={false}
                onActionClick={handleActionClick}
                onPlanToWatchToggle={handlePlanToWatchToggle}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <ReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        anime={selectedAnime}
        onSave={handleSaveReview}
      />
    </>
  );
};

export default WatchedPage;
