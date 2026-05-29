import React, { createContext, useContext, useState } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { useAnime } from './AnimeContext';

interface GoogleSyncContextType {
  isLoggedIn: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  login: () => void;
  logout: () => void;
  syncToDrive: () => Promise<void>;
  restoreFromDrive: () => Promise<void>;
}

const GoogleSyncContext = createContext<GoogleSyncContextType | undefined>(undefined);

export const GoogleSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('google_access_token');
    const expiresAt = localStorage.getItem('google_token_expires_at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      return token;
    }
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
    return null;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('google_last_sync'));
  
  const { 
    watchedList, 
    planToWatchList, 
    customAnimeList,
    corrections,
    handleImport,
    handleImportCustomAnime,
    handleImportCorrections
  } = useAnime();

  const isLoggedIn = !!accessToken;

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
      localStorage.setItem('google_token_expires_at', expiresAt.toString());
      setAccessToken(tokenResponse.access_token);
      setTimeout(() => restoreFlow(tokenResponse.access_token), 500);
    },
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    onError: (error) => console.error('Login Failed:', error)
  });

  const logout = () => {
    googleLogout();
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
  };

  const updateSyncTime = () => {
    const now = new Date();
    const time = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLastSyncTime(time);
    localStorage.setItem('google_last_sync', time);
  };

  // 尋找備份檔案
  const findBackupFile = async (token: string) => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="backup.json"', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  };

  const syncToDrive = async () => {
    if (!accessToken) return;
    setIsSyncing(true);
    try {
      let fileId = await findBackupFile(accessToken);

      // 準備要上傳的資料
      const backupData = JSON.stringify({ 
        watchedList, 
        planToWatchList,
        customAnimeList,
        corrections
      });

      if (!fileId) {
        // 檔案不存在，先建立 Metadata
        const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: 'backup.json', parents: ['appDataFolder'] })
        });
        if (metaRes.status === 401) {
          logout();
          throw new Error('Unauthorized');
        }
        const metaData = await metaRes.json();
        fileId = metaData.id;
      }

      // 更新檔案內容 (PATCH media)
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: backupData
      });

      if (uploadRes.status === 401) {
        logout();
        throw new Error('Unauthorized');
      }

      if (uploadRes.ok) {
        updateSyncTime();
        alert('雲端備份成功！');
      } else {
        throw new Error('Upload failed');
      }

    } catch (error: any) {
      console.error('Sync Error:', error);
      if (error.message !== 'Unauthorized') {
        alert('同步失敗，請稍後再試。');
      } else {
        alert('登入狀態已過期，請重新登入。');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFlow = async (token: string) => {
    setIsSyncing(true);
    try {
      const fileId = await findBackupFile(token);
      if (!fileId) {
        console.log("No backup found on drive.");
        return; 
      }

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
      }

      if (res.ok) {
        const data = await res.json();
        
        let confirmMsg = `在雲端找到了備份資料：\n`;
        if (data.watchedList) confirmMsg += `- ${data.watchedList.length} 筆已觀看\n`;
        if (data.customAnimeList) confirmMsg += `- ${data.customAnimeList.length} 筆自訂動畫\n`;
        if (data.corrections) confirmMsg += `- ${Object.keys(data.corrections).length} 筆名稱修改\n`;
        confirmMsg += `\n是否要與本地資料合併/覆蓋？`;

        if ((data.watchedList || data.customAnimeList || data.corrections) && window.confirm(confirmMsg)) {
           if (data.watchedList) handleImport(data.watchedList);
           if (data.customAnimeList) handleImportCustomAnime(data.customAnimeList);
           if (data.corrections) handleImportCorrections(data.corrections);
           
           alert('資料還原完成！');
           updateSyncTime();
        }
      }
    } catch (error: any) {
      console.error('Restore Error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromDrive = async () => {
    if (accessToken) await restoreFlow(accessToken);
  };

  return (
    <GoogleSyncContext.Provider value={{
      isLoggedIn,
      isSyncing,
      lastSyncTime,
      login,
      logout,
      syncToDrive,
      restoreFromDrive
    }}>
      {children}
    </GoogleSyncContext.Provider>
  );
};

export const useGoogleSync = () => {
  const context = useContext(GoogleSyncContext);
  if (context === undefined) {
    throw new Error('useGoogleSync must be used within a GoogleSyncProvider');
  }
  return context;
};
