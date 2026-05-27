import React, { useRef } from 'react';
import './ImportExportButtons.css';
import { Upload, Download, ArrowRightLeft } from 'lucide-react';
import Papa from 'papaparse';
import type { WatchedAnime } from '../types';

interface ImportExportButtonsProps {
  watchedData: WatchedAnime[];
  onImport: (data: WatchedAnime[]) => void;
}

const ImportExportButtons: React.FC<ImportExportButtonsProps> = ({ watchedData, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    // 建立要匯出的 CSV 資料格式
    const exportData = watchedData.map(item => ({
      ID: item.id,
      動畫名稱: item.titleZh,
      推出年份與季節: item.yearSeason,
      封面圖片網址: item.coverImage,
      分類標籤: item.genres.join(', '),
      使用者評分: item.userRating,
      簡單評論: item.userComment,
      觀看時間: item.watchedDate
    }));

    const csvContent = Papa.unparse(exportData);
    // 加入 BOM 以支援 Excel/Google Sheets 顯示中文 UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `已看過動畫備份_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData: WatchedAnime[] = results.data.map((row: any) => ({
          id: row['ID'] || String(Date.now()), // 確保有ID
          titleZh: row['動畫名稱'] || '',
          yearSeason: row['推出年份與季節'] || '',
          coverImage: row['封面圖片網址'] || '',
          genres: row['分類標籤'] ? row['分類標籤'].split(', ') : [],
          userRating: Number(row['使用者評分']) || 0,
          userComment: row['簡單評論'] || '',
          watchedDate: row['觀看時間'] || new Date().toISOString()
        })).filter(item => item.titleZh); // 過濾掉沒有名稱的無效行

        if (parsedData.length > 0) {
          onImport(parsedData);
          alert(`成功匯入 ${parsedData.length} 筆已觀看動畫紀錄！`);
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
        onChange={handleImport}
        style={{ display: 'none' }}
      />
      <button className="btn-glass import-btn" onClick={() => fileInputRef.current?.click()} title="從 CSV 匯入 (相容 Google 試算表)">
        <Upload size={18} />
        <span className="btn-text">匯入資料</span>
      </button>
      <ArrowRightLeft size={16} className="btn-divider-icon" />
      <button className="btn-glass export-btn" onClick={handleExport} disabled={watchedData.length === 0} title="匯出為 CSV (可直接在 Google 試算表編輯)">
        <Download size={18} />
        <span className="btn-text">匯出備份</span>
      </button>
    </div>
  );
};

export default ImportExportButtons;
