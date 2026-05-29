import React, { useRef } from 'react';
import './ImportExportButtons.css';
import { Upload, Download, ArrowRightLeft } from 'lucide-react';
import Papa from 'papaparse';
import type { WatchedAnime, Anime } from '../types';
import { useAnime } from '../contexts/AnimeContext';

const ImportExportButtons: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    watchedList, 
    planToWatchList, 
    customAnimeList,
    corrections,
    handleImport,
    handleImportPlan,
    handleImportCustomAnime,
    handleImportCorrections
  } = useAnime();

  const handleExport = () => {
    const exportData: any[] = [];
    
    // 1. WATCHED
    watchedList.forEach(item => {
      exportData.push({
        DataType: 'WATCHED',
        ID: item.id,
        動畫名稱: item.titleZh,
        原名: '',
        推出年份與季節: item.yearSeason,
        封面圖片網址: item.coverImage,
        分類標籤: item.genres.join(', '),
        使用者評分: item.userRating,
        簡單評論: item.userComment,
        觀看時間: item.watchedDate
      });
    });

    // 2. PLAN
    planToWatchList.forEach(item => {
      exportData.push({
        DataType: 'PLAN',
        ID: item.id,
        動畫名稱: item.titleZh,
        原名: '',
        推出年份與季節: item.yearSeason,
        封面圖片網址: item.coverImage,
        分類標籤: item.genres.join(', '),
        使用者評分: '',
        簡單評論: '',
        觀看時間: ''
      });
    });

    // 3. CUSTOM
    customAnimeList.forEach(item => {
      exportData.push({
        DataType: 'CUSTOM',
        ID: item.id,
        動畫名稱: item.titleZh,
        原名: '',
        推出年份與季節: item.yearSeason,
        封面圖片網址: item.coverImage,
        分類標籤: item.genres.join(', '),
        使用者評分: '',
        簡單評論: '',
        觀看時間: ''
      });
    });

    // 4. CORRECTION
    Object.entries(corrections).forEach(([original, corrected]) => {
      exportData.push({
        DataType: 'CORRECTION',
        ID: '',
        動畫名稱: corrected,
        原名: original,
        推出年份與季節: '',
        封面圖片網址: '',
        分類標籤: '',
        使用者評分: '',
        簡單評論: '',
        觀看時間: ''
      });
    });

    const csvContent = Papa.unparse(exportData);
    // 加入 BOM 以支援 Excel/Google Sheets 顯示中文 UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AniSpace_本地備份_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedWatched: WatchedAnime[] = [];
        const parsedPlan: Anime[] = [];
        const parsedCustom: Anime[] = [];
        const parsedCorrections: Record<string, string> = {};

        results.data.forEach((row: any) => {
          // 向下相容：如果沒有 DataType，預設當作 WATCHED
          const dataType = row['DataType'] || 'WATCHED';
          
          if (dataType === 'CORRECTION') {
            const original = row['原名'];
            const corrected = row['動畫名稱'];
            if (original && corrected) {
              parsedCorrections[original] = corrected;
            }
          } else {
            const animeBase = {
              id: row['ID'] || String(Date.now() + Math.random()), 
              titleZh: row['動畫名稱'] || '',
              yearSeason: row['推出年份與季節'] || '',
              coverImage: row['封面圖片網址'] || '',
              genres: row['分類標籤'] ? row['分類標籤'].split(', ') : [],
            };
            
            if (!animeBase.titleZh) return; // skip invalid rows

            if (dataType === 'WATCHED') {
              parsedWatched.push({
                ...animeBase,
                userRating: Number(row['使用者評分']) || 0,
                userComment: row['簡單評論'] || '',
                watchedDate: row['觀看時間'] || new Date().toISOString()
              });
            } else if (dataType === 'PLAN') {
              parsedPlan.push(animeBase);
            } else if (dataType === 'CUSTOM') {
              parsedCustom.push(animeBase);
            }
          }
        });

        let importCount = 0;
        if (parsedWatched.length > 0) {
          handleImport(parsedWatched);
          importCount += parsedWatched.length;
        }
        if (parsedPlan.length > 0) {
          handleImportPlan(parsedPlan);
          importCount += parsedPlan.length;
        }
        if (parsedCustom.length > 0) {
          handleImportCustomAnime(parsedCustom);
          importCount += parsedCustom.length;
        }
        if (Object.keys(parsedCorrections).length > 0) {
          handleImportCorrections(parsedCorrections);
          importCount += Object.keys(parsedCorrections).length;
        }

        if (importCount > 0) {
          alert(`成功從本地備份還原 ${importCount} 筆資料！`);
        } else {
          alert('解析失敗：找不到有效的動畫資料，請確認 CSV 格式是否正確。');
        }

        // 清空 input 讓下一次也可以選同一個檔案
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        alert('檔案讀取錯誤:' + error.message);
      }
    });
  };

  return (
    <div className="import-export-container">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
      <button className="btn-glass import-btn" onClick={() => fileInputRef.current?.click()} title="從 CSV 匯入 (相容 Google 試算表)">
        <Upload size={18} />
        <span className="btn-text">匯入資料</span>
      </button>
      <ArrowRightLeft size={16} className="btn-divider-icon" />
      <button 
        className="btn-glass export-btn" 
        onClick={handleExport} 
        disabled={watchedList.length === 0 && planToWatchList.length === 0 && customAnimeList.length === 0 && Object.keys(corrections).length === 0} 
        title="將所有資料匯出為 CSV 備份 (可直接在 Google 試算表編輯)"
      >
        <Download size={18} />
        <span className="btn-text">本地備份</span>
      </button>
    </div>
  );
};

export default ImportExportButtons;
