import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import AllAnimePage from './pages/AllAnimePage';
import PlanToWatchPage from './pages/PlanToWatchPage';
import WatchedPage from './pages/WatchedPage';
import ImportExportButtons from './components/ImportExportButtons';
import GoogleSyncButton from './components/GoogleSyncButton';
import { Layers, DownloadCloud, Loader2 } from 'lucide-react';
import { useAnime } from './contexts/AnimeContext';

function App() {
  const {
    handleSync,
    isScraping,
    scrapeProgress
  } = useAnime();

  const location = useLocation();
  const currentPath = location.pathname;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <GoogleSyncButton />
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
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
                className="btn-glass"
                onClick={handleSync}
                disabled={isScraping}
                style={{ fontSize: '0.85rem', padding: 'var(--spacing-2) var(--spacing-4)' }}
              >
                {isScraping ? <Loader2 className="animate-spin" size={16} /> : <DownloadCloud size={16} />}
                {isScraping ? scrapeProgress : '同步最新動漫'}
              </button>
              <ImportExportButtons />
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


    </div>
  );
}

export default App;
