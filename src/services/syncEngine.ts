/**
 * Real-Time Automatic Synchronization Engine
 * Continuously watches selected Google Drive files and folders,
 * detects changes or new files via metadata polling (5s - 60s),
 * and triggers immediate high-speed downloads to the user's local computer folder.
 */

import { DriveFile, getDriveFileMeta, listAllFilesRecursively } from './drive';
import { downloadManager } from './downloadManager';

export interface WatchedItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  addedAt: number;
}

export interface SyncLedgerEntry {
  fileId: string;
  fileName: string;
  modifiedTime?: string;
  md5Checksum?: string;
  lastSyncedAt: number;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'sync' | 'error' | 'change_detected';
  message: string;
  fileName?: string;
}

export interface SyncEngineState {
  isActive: boolean;
  isChecking: boolean;
  intervalSeconds: number;
  lastCheckTimestamp: number | null;
  watchedItems: WatchedItem[];
  recentLogs: SyncLogEntry[];
}

export type SyncStateListener = (state: SyncEngineState) => void;

const WATCHED_STORAGE_KEY = 'drivesync_watched_items_v1';
const LEDGER_STORAGE_KEY = 'drivesync_ledger_v1';

class SyncEngine {
  private watchedItems: Map<string, WatchedItem> = new Map();
  private syncLedger: Map<string, SyncLedgerEntry> = new Map();
  private logs: SyncLogEntry[] = [];
  private isActive: boolean = true;
  private isChecking: boolean = false;
  private intervalSeconds: number = 10; // Default 10s real-time check
  private lastCheckTimestamp: number | null = null;
  private pollTimer: any = null;
  private listeners: Set<SyncStateListener> = new Set();
  private accessToken: string | null = null;

  constructor() {
    this.loadStateFromStorage();
    this.startPollingLoop();
  }

  public setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token && this.watchedItems.size > 0 && this.isActive) {
      this.triggerImmediateSync();
    }
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state: SyncEngineState = {
      isActive: this.isActive,
      isChecking: this.isChecking,
      intervalSeconds: this.intervalSeconds,
      lastCheckTimestamp: this.lastCheckTimestamp,
      watchedItems: Array.from(this.watchedItems.values()),
      recentLogs: this.logs.slice(-50),
    };
    this.listeners.forEach((fn) => fn(state));
  }

  private loadStateFromStorage() {
    try {
      const storedWatched = localStorage.getItem(WATCHED_STORAGE_KEY);
      if (storedWatched) {
        const parsed = JSON.parse(storedWatched);
        parsed.forEach((item: WatchedItem) => this.watchedItems.set(item.id, item));
      }

      const storedLedger = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (storedLedger) {
        const parsed = JSON.parse(storedLedger);
        parsed.forEach((item: SyncLedgerEntry) => this.syncLedger.set(item.fileId, item));
      }
    } catch (err) {
      console.warn('Erro ao carregar estado do localStorage:', err);
    }
  }

  private persistState() {
    try {
      localStorage.setItem(
        WATCHED_STORAGE_KEY,
        JSON.stringify(Array.from(this.watchedItems.values()))
      );
      localStorage.setItem(
        LEDGER_STORAGE_KEY,
        JSON.stringify(Array.from(this.syncLedger.values()))
      );
    } catch (err) {
      console.warn('Erro ao salvar estado no localStorage:', err);
    }
  }

  public addLog(type: SyncLogEntry['type'], message: string, fileName?: string) {
    const entry: SyncLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      message,
      fileName,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 80) {
      this.logs.pop();
    }
    this.notify();
  }

  public setInterval(seconds: number) {
    this.intervalSeconds = Math.max(5, Math.min(seconds, 300));
    this.startPollingLoop();
    this.addLog('info', `Intervalo de verificação em tempo real ajustado para ${this.intervalSeconds}s.`);
    this.notify();
  }

  public setIsActive(active: boolean) {
    this.isActive = active;
    if (active) {
      this.addLog('info', 'Sincronização automática em tempo real ATIVADA.');
      this.startPollingLoop();
      this.triggerImmediateSync();
    } else {
      this.addLog('info', 'Sincronização automática em tempo real PAUSADA.');
      this.stopPollingLoop();
    }
    this.notify();
  }

  public isItemWatched(id: string): boolean {
    return this.watchedItems.has(id);
  }

  public watchItem(file: DriveFile) {
    if (this.watchedItems.has(file.id)) return;

    this.watchedItems.set(file.id, {
      id: file.id,
      name: file.name,
      isFolder: file.isFolder,
      mimeType: file.mimeType,
      addedAt: Date.now(),
    });

    this.persistState();
    this.addLog(
      'info',
      `Item adicionado ao monitoramento em tempo real: ${file.name} (${file.isFolder ? 'Pasta' : 'Arquivo'})`,
      file.name
    );
    this.notify();

    // Trigger immediate download/sync for newly watched item
    this.checkSingleWatchedItem(this.watchedItems.get(file.id)!);
  }

  public unwatchItem(fileId: string) {
    const item = this.watchedItems.get(fileId);
    if (item) {
      this.watchedItems.delete(fileId);
      this.persistState();
      this.addLog('info', `Item removido do monitoramento: ${item.name}`, item.name);
      this.notify();
    }
  }

  public clearAllWatched() {
    this.watchedItems.clear();
    this.persistState();
    this.addLog('info', 'Todos os itens foram removidos do monitoramento.');
    this.notify();
  }

  private startPollingLoop() {
    this.stopPollingLoop();
    if (!this.isActive) return;

    this.pollTimer = setInterval(() => {
      this.checkAllWatchedItems();
    }, this.intervalSeconds * 1000);
  }

  private stopPollingLoop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async triggerImmediateSync() {
    await this.checkAllWatchedItems();
  }

  private async checkAllWatchedItems() {
    if (!this.accessToken || !this.isActive || this.isChecking || this.watchedItems.size === 0) {
      return;
    }

    this.isChecking = true;
    this.lastCheckTimestamp = Date.now();
    this.notify();

    try {
      for (const item of this.watchedItems.values()) {
        await this.checkSingleWatchedItem(item);
      }
    } catch (err: any) {
      console.error('Erro durante checagem de sincronização:', err);
      this.addLog('error', `Erro na sincronização: ${err?.message || 'Falha de rede'}`);
    } finally {
      this.isChecking = false;
      this.notify();
    }
  }

  private async checkSingleWatchedItem(item: WatchedItem) {
    if (!this.accessToken) return;

    if (!item.isFolder) {
      // Single file check
      try {
        const fileMeta = await getDriveFileMeta(this.accessToken, item.id);
        const ledgerEntry = this.syncLedger.get(fileMeta.id);

        const hasChanged =
          !ledgerEntry ||
          (fileMeta.modifiedTime && fileMeta.modifiedTime !== ledgerEntry.modifiedTime) ||
          (fileMeta.md5Checksum && fileMeta.md5Checksum !== ledgerEntry.md5Checksum);

        if (hasChanged) {
          this.addLog(
            'change_detected',
            `Alteração detectada no arquivo: ${fileMeta.name}. Iniciando download automático...`,
            fileMeta.name
          );

          downloadManager.enqueueFiles([
            {
              file: fileMeta,
              pathSegments: [],
            },
          ]);

          this.syncLedger.set(fileMeta.id, {
            fileId: fileMeta.id,
            fileName: fileMeta.name,
            modifiedTime: fileMeta.modifiedTime,
            md5Checksum: fileMeta.md5Checksum,
            lastSyncedAt: Date.now(),
          });
          this.persistState();
        }
      } catch (err) {
        console.warn(`Erro ao verificar arquivo monitorado ${item.name}:`, err);
      }
    } else {
      // Folder recursive check
      try {
        const allFiles = await listAllFilesRecursively(this.accessToken, item.id, [item.name]);
        const changedFiles: { file: DriveFile; pathSegments: string[] }[] = [];

        for (const itemWithPath of allFiles) {
          const fileMeta = itemWithPath.file;
          const ledgerEntry = this.syncLedger.get(fileMeta.id);

          const hasChanged =
            !ledgerEntry ||
            (fileMeta.modifiedTime && fileMeta.modifiedTime !== ledgerEntry.modifiedTime) ||
            (fileMeta.md5Checksum && fileMeta.md5Checksum !== ledgerEntry.md5Checksum);

          if (hasChanged) {
            changedFiles.push(itemWithPath);
            this.syncLedger.set(fileMeta.id, {
              fileId: fileMeta.id,
              fileName: fileMeta.name,
              modifiedTime: fileMeta.modifiedTime,
              md5Checksum: fileMeta.md5Checksum,
              lastSyncedAt: Date.now(),
            });
          }
        }

        if (changedFiles.length > 0) {
          this.addLog(
            'change_detected',
            `Pasta '${item.name}': ${changedFiles.length} arquivo(s) novo(s) ou atualizado(s) encontrados. Sincronizando...`,
            item.name
          );
          downloadManager.enqueueFiles(changedFiles);
          this.persistState();
        }
      } catch (err) {
        console.warn(`Erro ao verificar pasta monitorada ${item.name}:`, err);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
