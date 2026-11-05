/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
} from './services/auth';
import {
  DriveFile,
  listDriveFiles,
  listAllFilesRecursively,
} from './services/drive';
import {
  pickLocalDirectory,
  getStoredDirectoryHandle,
  clearStoredDirectoryHandle,
  verifyPermission,
  saveFallbackFolderName,
  getFallbackFolderName,
  clearFallbackFolder,
  isInsideIframe,
} from './services/localFileSystem';
import {
  downloadManager,
  DownloadTask,
  SpeedTelemetry,
} from './services/downloadManager';
import {
  syncEngine,
  WatchedItem,
  SyncEngineState,
  SyncLogEntry,
} from './services/syncEngine';
import { exportSelectedFilesToZip } from './services/zipExport';

import { Header } from './components/Header';
import { FolderSelectorCard } from './components/FolderSelectorCard';
import { FolderModal } from './components/FolderModal';
import { SpeedEngineBar } from './components/SpeedEngineBar';
import { AutoSyncPanel } from './components/AutoSyncPanel';
import { DriveExplorer } from './components/DriveExplorer';
import { TransfersDrawer } from './components/TransfersDrawer';
import { CenterProgressOverlay } from './components/CenterProgressOverlay';
import {
  Zap,
  Cloud,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Flame,
  CheckCircle,
  AlertCircle,
  FolderSync,
} from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);

  // Local folder state
  const [localDirHandle, setLocalDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [isSelectingFolder, setIsSelectingFolder] = useState<boolean>(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [isNativeDisk, setIsNativeDisk] = useState<boolean>(false);

  // Google Drive files & navigation
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Meu Drive' },
  ]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Download Manager state
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [telemetry, setTelemetry] = useState<SpeedTelemetry>({
    currentSpeedBytes: 0,
    peakSpeedBytes: 0,
    totalDownloadedBytes: 0,
    activeCount: 0,
    queuedCount: 0,
    completedCount: 0,
    errorCount: 0,
    isPaused: false,
    hasActiveDownloads: false,
  });
  const [concurrency, setConcurrency] = useState<number>(downloadManager.getConcurrency());
  const [turboMultiChunk, setTurboMultiChunk] = useState<boolean>(
    downloadManager.isTurboMultiChunk()
  );

  // Sync Engine state
  const [syncState, setSyncState] = useState<SyncEngineState>({
    isActive: true,
    isChecking: false,
    intervalSeconds: 10,
    lastCheckTimestamp: null,
    watchedItems: [],
    recentLogs: [],
  });

  // Modal / Toast alerts
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setFeedbackToast({ type, message });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // 1. Initialize Auth and restore stored folder handle
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setCachedAccessToken(accessToken);
        downloadManager.setAccessToken(accessToken);
        syncEngine.setAccessToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setCachedAccessToken(null);
        downloadManager.setAccessToken(null);
        syncEngine.setAccessToken(null);
        setNeedsAuth(true);
      }
    );

    // Try restoring directory handle from IndexedDB or fallback
    getStoredDirectoryHandle().then(async (handle) => {
      if (handle) {
        try {
          const hasPerm = await verifyPermission(handle, false);
          if (hasPerm) {
            setLocalDirHandle(handle);
            setLocalFolderName(handle.name);
            setIsNativeDisk(true);
            downloadManager.setTargetDirectory(handle);
            return;
          }
        } catch {
          // ignore
        }
      }
      // Check fallback folder
      const fallback = getFallbackFolderName();
      if (fallback) {
        setLocalFolderName(`Downloads / ${fallback}`);
        setIsNativeDisk(false);
      } else {
        // Automatically default to Downloads / DriveSync so user always has ready-to-go destination
        saveFallbackFolderName('DriveSync');
        setLocalFolderName('Downloads / DriveSync');
        setIsNativeDisk(false);
      }
    });

    // Subscribe to DownloadManager updates
    const unsubscribeDownloads = downloadManager.subscribe((updatedTasks, updatedTelemetry) => {
      setTasks([...updatedTasks]);
      setTelemetry({ ...updatedTelemetry });
    });

    // Subscribe to SyncEngine updates
    const unsubscribeSync = syncEngine.subscribe((updatedSyncState) => {
      setSyncState({ ...updatedSyncState });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDownloads();
      unsubscribeSync();
    };
  }, []);

  // 2. Fetch Drive files when token or folder changes
  const loadFiles = useCallback(
    async (folderId: string) => {
      if (!token) return;
      setIsLoadingFiles(true);
      try {
        const resp = await listDriveFiles(token, folderId);
        setFiles(resp.files);
        setSelectedFileIds(new Set());
      } catch (err: any) {
        console.error('Erro ao listar arquivos:', err);
        showToast(err?.message || 'Erro ao carregar arquivos do Drive.', 'error');
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) {
      loadFiles(currentFolderId);
    }
  }, [token, currentFolderId, loadFiles]);

  // Auth actions
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        downloadManager.setAccessToken(res.accessToken);
        syncEngine.setAccessToken(res.accessToken);
        setNeedsAuth(false);
        showToast('Google Drive conectado com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Falha no login:', err);
      showToast('Falha ao conectar conta Google. Verifique os popups.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFiles([]);
    setNeedsAuth(true);
    showToast('Você desconectou da conta Google.', 'info');
  };

  // Local folder selection
  const handleSelectNativeFolder = async (): Promise<boolean> => {
    setIsSelectingFolder(true);
    try {
      const handle = await pickLocalDirectory();
      if (handle) {
        setLocalDirHandle(handle);
        setLocalFolderName(handle.name);
        setIsNativeDisk(true);
        downloadManager.setTargetDirectory(handle);
        showToast(`Pasta física "${handle.name}" vinculada para gravação direta!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Erro ao selecionar pasta física:', err);
      return false;
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleSelectDownloadsFolder = (subfolder: string) => {
    saveFallbackFolderName(subfolder);
    clearStoredDirectoryHandle();
    setLocalDirHandle(null);
    setLocalFolderName(`Downloads / ${subfolder}`);
    setIsNativeDisk(false);
    downloadManager.setTargetDirectory(null);
    showToast(`Pasta configurada: Downloads/${subfolder} (Download direto)`, 'success');
  };

  const handleQuickSetDownloads = () => {
    handleSelectDownloadsFolder('DriveSync');
  };

  const handleClearLocalFolder = async () => {
    await clearStoredDirectoryHandle();
    clearFallbackFolder();
    setLocalDirHandle(null);
    setLocalFolderName(null);
    setIsNativeDisk(false);
    downloadManager.setTargetDirectory(null);
    showToast('Pasta local desvinculada.', 'info');
  };

  // Navigation
  const handleNavigateFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  // Selection
  const handleToggleSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFileIds(new Set(files.map((f) => f.id)));
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  // Compute relative folder path from breadcrumbs to recreate the identical structure locally
  const getCurrentFolderPath = (): string[] => {
    return breadcrumbs.slice(1).map((b) => b.name);
  };

  // Download & Sync actions
  const handleStartDownload = async () => {
    if (!token) {
      showToast('Por favor, conecte sua conta Google Drive primeiro.', 'error');
      return;
    }

    // 1. If currently paused with pending tasks, resume them
    if (downloadManager.getIsPaused() && downloadManager.getPendingCount() > 0) {
      downloadManager.resume();
      showToast('Downloads retomados!', 'success');
      return;
    }

    // 2. If user has selected files, start downloading them
    if (selectedFileIds.size > 0) {
      await handleDownloadSelected();
      return;
    }

    // 3. If no files selected, download all files and folders currently displayed
    if (files.length > 0) {
      if (!localDirHandle && !localFolderName) {
        handleQuickSetDownloads();
      }
      const currentFolderSegments = getCurrentFolderPath();
      const filesToEnqueue: { file: DriveFile; pathSegments: string[] }[] = [];

      for (const item of files) {
        if (item.isFolder) {
          const recursive = await listAllFilesRecursively(token, item.id, [
            ...currentFolderSegments,
            item.name,
          ]);
          filesToEnqueue.push(...recursive);
        } else {
          filesToEnqueue.push({ file: item, pathSegments: currentFolderSegments });
        }
      }

      if (filesToEnqueue.length > 0) {
        downloadManager.enqueueFiles(filesToEnqueue);
        showToast(
          `Iniciando download de ${filesToEnqueue.length} arquivo(s) com criação das mesmas pastas!`,
          'success'
        );
      } else {
        showToast('Nenhum arquivo disponível para download.', 'info');
      }
      return;
    }

    showToast('Nenhum arquivo disponível para download nesta pasta.', 'info');
  };

  const handleStopDownload = () => {
    downloadManager.pause();
    showToast('Download interrompido/pausado.', 'info');
  };

  const handleDownloadSelected = async () => {
    if (!token) return;
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    if (!localDirHandle && !localFolderName) {
      handleQuickSetDownloads();
    }

    const currentFolderSegments = getCurrentFolderPath();
    const filesToEnqueue: { file: DriveFile; pathSegments: string[] }[] = [];

    for (const item of selectedItems) {
      if (item.isFolder) {
        showToast(`Mapeando subpastas de "${item.name}"...`, 'info');
        const recursiveFiles = await listAllFilesRecursively(token, item.id, [
          ...currentFolderSegments,
          item.name,
        ]);
        filesToEnqueue.push(...recursiveFiles);
      } else {
        filesToEnqueue.push({ file: item, pathSegments: currentFolderSegments });
      }
    }

    downloadManager.enqueueFiles(filesToEnqueue);
    showToast(
      `${filesToEnqueue.length} arquivo(s) enfileirados recriando a mesma estrutura de pastas!`,
      'success'
    );
  };

  const handleDownloadSingle = async (file: DriveFile) => {
    if (!token) return;
    const currentFolderSegments = getCurrentFolderPath();
    if (file.isFolder) {
      showToast(`Mapeando pasta "${file.name}"...`, 'info');
      const recursiveFiles = await listAllFilesRecursively(token, file.id, [
        ...currentFolderSegments,
        file.name,
      ]);
      downloadManager.enqueueFiles(recursiveFiles);
      showToast(
        `Pasta "${file.name}" (${recursiveFiles.length} arquivos) enfileirada com estrutura idêntica!`,
        'success'
      );
    } else {
      downloadManager.enqueueFiles([{ file, pathSegments: currentFolderSegments }]);
      showToast(`Download de "${file.name}" iniciado!`, 'success');
    }
  };

  const handleWatchSelected = () => {
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    selectedItems.forEach((item) => {
      syncEngine.watchItem(item);
    });

    showToast(
      `${selectedItems.length} item(ns) adicionados à sincronização automática em tempo real!`,
      'success'
    );
    setSelectedFileIds(new Set());
  };

  const handleToggleWatchSingle = (file: DriveFile) => {
    if (syncEngine.isItemWatched(file.id)) {
      syncEngine.unwatchItem(file.id);
      showToast(`"${file.name}" removido do monitoramento em tempo real.`, 'info');
    } else {
      syncEngine.watchItem(file);
      showToast(`"${file.name}" agora sincroniza automaticamente em tempo real!`, 'success');
    }
  };

  const handleDownloadZip = async () => {
    if (!token) return;
    const selectedItems = files.filter((f) => selectedFileIds.has(f.id));
    if (selectedItems.length === 0) return;

    showToast('Preparando compactação ZIP dos arquivos selecionados...', 'info');
    try {
      await exportSelectedFilesToZip(token, selectedItems, localDirHandle, (pct, name) => {
        // progress callback
      });
      showToast('Arquivo ZIP gerado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao gerar ZIP:', err);
      showToast('Falha na criação do ZIP.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border ${
              feedbackToast.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
                : feedbackToast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : 'bg-slate-900 text-slate-200 border-slate-700'
            }`}
          >
            {feedbackToast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {feedbackToast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {feedbackToast.type === 'info' && <Zap className="w-4 h-4 text-amber-400" />}
            <span>{feedbackToast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        user={user}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        localFolderName={localFolderName}
        currentSpeed={telemetry.currentSpeedBytes}
        peakSpeed={telemetry.peakSpeedBytes}
        concurrency={concurrency}
        isAutoSyncActive={syncState.isActive}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Not Logged In Hero Banner */}
        {!user ? (
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl mx-auto space-y-6 relative z-10">
              <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase">
                <Flame className="w-4 h-4" />
                <span>Velocidade Máxima & Sincronização Direta</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Baixe e sincronize arquivos do Google Drive na sua pasta local com{' '}
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-rose-400 bg-clip-text text-transparent">
                  velocidade extrema
                </span>
                .
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Conecte seu Google Drive, escolha uma pasta no seu computador e mantenha seus
                documentos atualizados em tempo real com conexões multi-thread paralelas e gravação
                direta no disco.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-3.5 rounded-2xl text-sm transition-all shadow-xl shadow-white/10 active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Conectar com Google Drive</span>
                </button>

                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3.5 rounded-2xl text-sm border border-slate-700 transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span>Configurar Pasta no Computador</span>
                </button>
              </div>

              {/* Feature pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center mb-2 font-bold">
                    <Flame className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Aceleração Turbo até 16x</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Downloads simultâneos paralelos e divisão em múltiplos canais de rede para saturar
                    sua largura de banda.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 font-bold">
                    <FolderSync className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Sincronização em Tempo Real</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Monitore arquivos e pastas continuamente a cada 5s-10s. Qualquer alteração remota é
                    baixada instantaneamente.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">Gravação Nativa no Disco</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Usa a moderna API File System Access para salvar direto na pasta do seu PC sem
                    inchar a memória do navegador.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Local Folder Selector */}
            <FolderSelectorCard
              localFolderName={localFolderName}
              onOpenFolderModal={() => setIsFolderModalOpen(true)}
              onQuickSetDownloads={handleQuickSetDownloads}
              onClearFolder={handleClearLocalFolder}
              isNativeDisk={isNativeDisk}
            />

            {/* Step 2: Download Speed Engine & Concurrency Controls */}
            <SpeedEngineBar
              currentSpeed={telemetry.currentSpeedBytes}
              peakSpeed={telemetry.peakSpeedBytes}
              totalDownloaded={telemetry.totalDownloadedBytes}
              activeWorkers={telemetry.activeCount}
              concurrency={concurrency}
              onConcurrencyChange={(threads) => {
                setConcurrency(threads);
                downloadManager.setConcurrency(threads);
                showToast(`Modo ajustado para ${threads} conexões simultâneas.`, 'info');
              }}
              turboMultiChunk={turboMultiChunk}
              onToggleTurboMultiChunk={(enabled) => {
                setTurboMultiChunk(enabled);
                downloadManager.setTurboMultiChunk(enabled);
                showToast(
                  `Multi-Chunk para arquivos grandes ${enabled ? 'ativado' : 'desativado'}.`,
                  'info'
                );
              }}
              onStartDownload={handleStartDownload}
              onStopDownload={handleStopDownload}
              isDownloading={telemetry.hasActiveDownloads && !telemetry.isPaused}
              isPaused={telemetry.isPaused}
              hasPendingTasks={telemetry.activeCount > 0 || telemetry.queuedCount > 0}
            />

            {/* Step 3: Real-Time Automatic Synchronization Controls */}
            <AutoSyncPanel
              isActive={syncState.isActive}
              onToggleActive={() => syncEngine.setIsActive(!syncState.isActive)}
              intervalSeconds={syncState.intervalSeconds}
              onChangeInterval={(sec) => syncEngine.setInterval(sec)}
              isChecking={syncState.isChecking}
              lastCheckTimestamp={syncState.lastCheckTimestamp}
              onTriggerSync={() => {
                syncEngine.triggerImmediateSync();
                showToast('Verificando alterações no Google Drive agora...', 'info');
              }}
              watchedItems={syncState.watchedItems}
              onRemoveWatched={(id) => syncEngine.unwatchItem(id)}
              onClearAllWatched={() => syncEngine.clearAllWatched()}
              recentLogs={syncState.recentLogs}
            />

            {/* Step 4: Google Drive Files Explorer */}
            <DriveExplorer
              files={files}
              isLoading={isLoadingFiles}
              breadcrumbs={breadcrumbs}
              onNavigateFolder={handleNavigateFolder}
              onNavigateBreadcrumb={handleNavigateBreadcrumb}
              onRefresh={() => loadFiles(currentFolderId)}
              selectedFileIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onDownloadSelected={handleDownloadSelected}
              onDownloadZip={handleDownloadZip}
              onWatchSelected={handleWatchSelected}
              onDownloadSingle={handleDownloadSingle}
              onToggleWatchSingle={handleToggleWatchSingle}
              isItemWatched={(id) => syncEngine.isItemWatched(id)}
              localFolderConfigured={!!localDirHandle}
              concurrency={concurrency}
              onStartDownload={handleStartDownload}
              onStopDownload={handleStopDownload}
              isDownloading={telemetry.hasActiveDownloads && !telemetry.isPaused}
              isPaused={telemetry.isPaused}
              hasPendingTasks={telemetry.activeCount > 0 || telemetry.queuedCount > 0}
            />
          </>
        )}
      </main>

      {/* Floating Active Transfers Drawer */}
      <TransfersDrawer
        tasks={tasks}
        telemetry={telemetry}
        onClearCompleted={() => downloadManager.clearCompleted()}
        onStartDownload={handleStartDownload}
        onStopDownload={handleStopDownload}
      />

      {/* Local Folder Configuration Modal */}
      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        currentFolderName={localFolderName}
        onSelectNativeFolder={handleSelectNativeFolder}
        onSelectDownloadsFolder={handleSelectDownloadsFolder}
        isSelecting={isSelectingFolder}
      />

      {/* Prominent Center Progress Bar Overlay when downloading */}
      <CenterProgressOverlay
        tasks={tasks}
        telemetry={telemetry}
        onStopDownload={handleStopDownload}
        localFolderName={localFolderName}
        concurrency={concurrency}
      />
    </div>
  );
}
