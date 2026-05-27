import { useState, useMemo, useEffect } from 'react';
import type { Anime, WatchedAnime } from '../types';
import AnimeCard from '../components/AnimeCard';
import Pagination from '../components/Pagination';
import ReviewModal from '../components/ReviewModal';
import { useAnime } from '../contexts/AnimeContext';
import { ITEMS_PER_PAGE } from '../utils/constants';
import { Search } from 'lucide-react';

const PlanToWatchPage = () => {
  const { 
    watchedList, 
    planToWatchList, 
    handleSaveReview, 
    handlePlanToWatchToggle
  } = useAnime();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | WatchedAnime | null>(null);

  const filteredData = useMemo(() => {
    return planToWatchList.filter(anime => 
      anime.titleZh.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [planToWatchList, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const handleActionClick = (anime: Anime) => {
    const existingWatched = watchedList.find(w => w.id === anime.id);
    setSelectedAnime(existingWatched || anime);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const headerElement = document.querySelector('.page-header');
    if (headerElement) {
      const yOffset = 5;
      const y = headerElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  return (
    <>
      <div className="page-header" style={{ marginBottom: 'var(--spacing-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section-title">期待動畫 ({filteredData.length})</h2>
        <div className="search-box glass-panel" style={{ flex: '1', maxWidth: '400px', padding: '0', background: 'transparent', border: 'none' }}>
           <div style={{ position: 'relative' }}>
            <Search size={20} className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="搜尋期待清單..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: '100%', paddingLeft: '40px' }}
            />
           </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="empty-state glass-panel fade-in">
          <h2>{searchQuery ? "找不到符合的動畫" : "尚未添加任何期待動畫"}</h2>
          <p>{searchQuery ? "請嘗試其他搜尋關鍵字。" : "在所有動畫中點擊 ❤️ 圖示，即可在此查看。"}</p>
        </div>
      ) : (
        <>
          <div className="anime-grid">
            {paginatedData.map(anime => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                isWatched={watchedList.some(w => w.id === anime.id)}
                isPlanToWatch={true}
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

export default PlanToWatchPage;
