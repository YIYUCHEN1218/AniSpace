import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import AllAnimePage from './pages/AllAnimePage';
import PlanToWatchPage from './pages/PlanToWatchPage';
import WatchedPage from './pages/WatchedPage';
import ImportExportButtons from './components/ImportExportButtons';
import { Layers, DownloadCloud, Loader2 } from 'lucide-react';
import { useAnime } from './contexts/AnimeContext';
import { getCurrentSeasonInfo } from './utils/season';

function App() {
  const { 
    watchedList, 
    handleImport, 
    handleScrape, 
    isScraping, 
    scrapeProgress 
  } = useAnime();

  const location = useLocation();
  const currentPath = location.pathname;

  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [scrapeYear, setScrapeYear] = useState<number | 'ALL'>(new Date().getFullYear());
  const [scrapeSeason, setScrapeSeason] = useState<string>(getCurrentSeasonInfo().seasonEng);

  return (
    <div className="app-container">
      <header className="app-header container">
        <div className="header-left">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="app-title"><Layers className="header-icon" /> AniSpace 動畫庫</h1>
          </Link>
          <p className="subtitle">為您記錄每一場感動</p>
        </div>

        <div className="header-right">
          <div className="nav-tabs">
            <Link 
              to="/" 
              className={`nav-tab ${currentPath === '/' ? 'active' : ''}`}
            >
              所有動畫
            </Link>
            <Link 
              to="/plan" 
              className={`nav-tab ${currentPath === '/plan' ? 'active' : ''}`}
            >
              期待動畫
            </Link>
            <Link 
              to="/records" 
              className={`nav-tab ${currentPath === '/records' ? 'active' : ''}`}
            >
              動畫紀錄
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className="btn-glass"
              onClick={() => setIsScrapeModalOpen(true)}
              disabled={isScraping}
              style={{ fontSize: '0.85rem', padding: 'var(--spacing-2) var(--spacing-4)' }}
            >
              {isScraping ? <Loader2 className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
              {isScraping ? scrapeProgress : '搜尋新動畫'}
            </button>
            <ImportExportButtons
              watchedData={watchedList}
              onImport={handleImport}
            />
          </div>
        </div>
      </header>

      <main className="container wrapper">
        <Routes>
          <Route path="/" element={<AllAnimePage />} />
          <Route path="/plan" element={<PlanToWatchPage />} />
          <Route path="/records" element={<WatchedPage />} />
        </Routes>
      </main>

      {isScrapeModalOpen && (
        <div className="modal-overlay fade-in" onClick={() => setIsScrapeModalOpen(false)}>
          <div className="scrape-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="scrape-modal-header">
              <h2 className="scrape-modal-title">蒐集新動畫</h2>
              <p className="scrape-modal-subtitle">
                選擇年份與季度，系統將自動從 AniList、Bangumi 等平台抓取最新動畫資料並合併至收藏庫。
              </p>
            </div>
            <div className="scrape-modal-divider" />
            <div className="scrape-field">
              <span className="scrape-field-label">年份</span>
              <select
                className="scrape-select"
                value={scrapeYear}
                onChange={e => {
                  const val = e.target.value;
                  setScrapeYear(val === 'ALL' ? 'ALL' : Number(val));
                }}
              >
                <option value="ALL">全部（2010 年起）</option>
                {Array.from(
                  { length: new Date().getFullYear() - 1999 + 2 },
                  (_, i) => 2000 + i
                ).slice().reverse().map(y => (
                  <option key={y} value={y}>{y} 年</option>
                ))}
              </select>
            </div>
            {scrapeYear !== 'ALL' && (
              <div className="scrape-field">
                <span className="scrape-field-label">季度</span>
                <div className="season-chips">
                  {([
                    { value: 'ALL',   label: '全部' },
                    { value: 'WINTER', label: '冬（1-3月）' },
                    { value: 'SPRING', label: '春（4-6月）' },
                    { value: 'SUMMER', label: '夏（7-9月）' },
                    { value: 'FALL',   label: '秋（10-12月）' },
                  ] as const).map(s => (
                    <button
                      key={s.value}
                      className={`season-chip ${scrapeSeason === s.value ? 'active' : ''}`}
                      onClick={() => setScrapeSeason(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="scrape-modal-actions">
              <button className="btn-glass" onClick={() => setIsScrapeModalOpen(false)}>取消返回</button>
              <button
                className="btn-primary"
                onClick={() => {
                  setIsScrapeModalOpen(false);
                  handleScrape(scrapeYear, scrapeYear === 'ALL' ? 'ALL' : scrapeSeason);
                }}
              >
                開始抓取
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
