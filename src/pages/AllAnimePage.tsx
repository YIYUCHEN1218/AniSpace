import { useState, useMemo, useEffect } from 'react';
import type { Anime, WatchedAnime, SortOption } from '../types';
import AnimeCard from '../components/AnimeCard';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ReviewModal from '../components/ReviewModal';
import { Loader2 } from 'lucide-react';
import { useAnime } from '../contexts/AnimeContext';
import { NSFW_GENRES, ITEMS_PER_PAGE } from '../utils/constants';
import { parseSeason } from '../utils/season';

const AllAnimePage = () => {
  const { 
    allAnime, 
    watchedList, 
    planToWatchList, 
    handleSaveReview, 
    handlePlanToWatchToggle,
    isScraping
  } = useAnime();

  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [show18Plus, setShow18Plus] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | WatchedAnime | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set(allAnime.map(a => a.yearSeason));
    return Array.from(years).sort((a, b) => parseSeason(b) - parseSeason(a));
  }, [allAnime]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    allAnime.forEach(a => {
      a.genres.forEach(g => {
        if (!NSFW_GENRES.includes(g)) genres.add(g);
      });
    });
    return Array.from(genres).sort();
  }, [allAnime]);

  const filteredData = useMemo(() => {
    let result = allAnime.filter(anime => {
      const isNSFW = anime.genres.some(g => NSFW_GENRES.includes(g));
      if (!show18Plus && isNSFW) return false;

      const matchYear = selectedYear ? anime.yearSeason === selectedYear : true;
      const matchGenre = selectedGenres.length === 0 ? true : selectedGenres.some(sg => {
        if (sg === '紳士') return anime.genres.includes('紳士') || anime.genres.includes('Hentai') || anime.genres.includes('Ecchi') || anime.genres.includes('福利');
        return anime.genres.includes(sg);
      });
      const matchSearch = searchQuery ? anime.titleZh.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      return matchYear && matchGenre && matchSearch;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'date_desc') return parseSeason(b.yearSeason) - parseSeason(a.yearSeason);
      if (sortBy === 'date_asc') return parseSeason(a.yearSeason) - parseSeason(b.yearSeason);
      return 0;
    });

    return result;
  }, [allAnime, selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedGenres, searchQuery, sortBy, show18Plus]);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to the filter bar but slightly past its top to perfectly hide the main header
    const filterElement = document.querySelector('.filter-bar-container');
    if (filterElement) {
      const yOffset = 5; // Positive offset scrolls slightly past the top
      const y = filterElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <FilterBar
        years={availableYears}
        genres={availableGenres}
        selectedYear={selectedYear}
        selectedGenres={selectedGenres}
        searchQuery={searchQuery}
        sortBy={sortBy}
        show18Plus={show18Plus}
        onYearChange={setSelectedYear}
        onGenreChange={setSelectedGenres}
        onSearchChange={setSearchQuery}
        onSortChange={(s) => setSortBy(s as SortOption)}
        on18PlusChange={setShow18Plus}
      />

      {filteredData.length === 0 ? (
          <div className="empty-state glass-panel fade-in" id="main-content">
            <h2>沒有找到符合的動畫</h2>
            <p>請嘗試其他搜尋關鍵字或調整過濾條件。</p>
            {isScraping && (
            <p style={{ color: 'var(--accent-color)', marginTop: 'var(--spacing-4)' }}>
              <Loader2 className="animate-spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> 
              正在努力抓取中，請不要關閉頁面...
            </p>
          )}
        </div>
      ) : (
        <div id="main-content">
          <div className="anime-grid">
            {paginatedData.map(anime => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                isWatched={watchedList.some(w => w.id === anime.id)}
                isPlanToWatch={planToWatchList.some(p => p.id === anime.id)}
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
        </div>
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

export default AllAnimePage;
