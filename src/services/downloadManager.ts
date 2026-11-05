/**
 * Download Manager with Turbo Multi-Threading Concurrency,
 * real-time transfer speedometer (MB/s, peak speed), pause/resume/stop controls,
 * and direct disk streaming.
 */

import { DriveFile, downloadFileStream, downloadLargeFileMultiChunk } from './drive';
import {
  writeStreamToLocalFile,
  writeBufferToLocalFile,
  triggerBrowserDownload,
} from './localFileSystem';

export interface DownloadTask {
  id: string;
  file: DriveFile;
  pathSegments: string[];
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'paused';
  totalBytes: number;
  downloadedBytes: number;
  speedBytesPerSec: number;
  progressPercent: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface SpeedTelemetry {
  currentSpeedBytes: number; // bytes/sec
  peakSpeedBytes: number;
  totalDownloadedBytes: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  errorCount: number;
  isPaused: boolean;
  hasActiveDownloads: boolean;
}

export type DownloadListener = (tasks: DownloadTask[], telemetry: SpeedTelemetry) => void;

class DownloadManager {
  private queue: DownloadTask[] = [];
  private activeTasks: Map<string, DownloadTask> = new Map();
  private completedTasks: DownloadTask[] = [];
  private activeControllers: Map<string, AbortController> = new Map();
  private maxConcurrency: number = 6; // Default Turbo 6x
  private turboMultiChunk: boolean = true;
  private isPaused: boolean = false;
  private listeners: Set<DownloadListener> = new Set();
  private targetDirectoryHandle: FileSystemDirectoryHandle | null = null;
  private accessToken: string | null = null;

  // Speed telemetry metrics
  private peakSpeed: number = 0;
  private speedSamples: { timestamp: number; bytes: number }[] = [];
  private speedTicker: any = null;

  constructor() {
    this.startSpeedTicker();
  }

  public setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  public setTargetDirectory(handle: FileSystemDirectoryHandle | null) {
    this.targetDirectoryHandle = handle;
  }

  public setConcurrency(concurrency: number) {
    this.maxConcurrency = Math.max(1, Math.min(concurrency, 16));
    if (!this.isPaused) {
      this.processQueue();
    }
  }

  public getConcurrency(): number {
    return this.maxConcurrency;
  }

  public setTurboMultiChunk(enabled: boolean) {
    this.turboMultiChunk = enabled;
  }

  public isTurboMultiChunk(): boolean {
    return this.turboMultiChunk;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const allTasks = [
      ...Array.from(this.activeTasks.values()),
      ...this.queue,
      ...this.completedTasks.slice(-30), // keep last 30 for history
    ];

    const currentSpeed = this.isPaused ? 0 : this.calculateCurrentSpeed();
    if (currentSpeed > this.peakSpeed) {
      this.peakSpeed = currentSpeed;
    }

    const totalDownloaded =
      this.completedTasks.reduce((acc, t) => acc + (t.downloadedBytes || 0), 0) +
      Array.from(this.activeTasks.values()).reduce((acc, t) => acc + (t.downloadedBytes || 0), 0);

    const hasActiveDownloads = this.activeTasks.size > 0 || (this.queue.length > 0 && !this.isPaused);

    const telemetry: SpeedTelemetry = {
      currentSpeedBytes: currentSpeed,
      peakSpeedBytes: this.peakSpeed,
      totalDownloadedBytes: totalDownloaded,
      activeCount: this.activeTasks.size,
      queuedCount: this.queue.length,
      completedCount: this.completedTasks.filter((t) => t.status === 'completed').length,
      errorCount: this.completedTasks.filter((t) => t.status === 'error').length,
      isPaused: this.isPaused,
      hasActiveDownloads,
    };

    this.listeners.forEach((fn) => fn(allTasks, telemetry));
  }

  private startSpeedTicker() {
    if (this.speedTicker) return;
    this.speedTicker = setInterval(() => {
      const now = Date.now();
      this.speedSamples = this.speedSamples.filter((s) => now - s.timestamp < 2000);
      this.notify();
    }, 400);
  }

  private recordBytes(bytes: number) {
    if (this.isPaused) return;
    this.speedSamples.push({ timestamp: Date.now(), bytes });
  }

  private calculateCurrentSpeed(): number {
    if (this.isPaused || this.speedSamples.length === 0) return 0;
    const now = Date.now();
    const recent = this.speedSamples.filter((s) => now - s.timestamp <= 1500);
    if (recent.length === 0) return 0;
    const sumBytes = recent.reduce((a, b) => a + b.bytes, 0);
    const windowSeconds = Math.max(0.5, (now - recent[0].timestamp) / 1000);
    return Math.round(sumBytes / windowSeconds);
  }

  public enqueueFiles(
    files: { file: DriveFile; pathSegments: string[] }[],
    autoStart: boolean = true
  ): string[] {
    const taskIds: string[] = [];

    for (const item of files) {
      if (item.file.isFolder) continue; // folders are traversed, not downloaded directly

      // Check if already in queue or active
      const isAlreadyRunning =
        this.queue.some((q) => q.file.id === item.file.id) ||
        Array.from(this.activeTasks.values()).some((a) => a.file.id === item.file.id);

      if (isAlreadyRunning) continue;

      const total = parseInt(item.file.size || '0', 10);
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const task: DownloadTask = {
        id: taskId,
        file: item.file,
        pathSegments: item.pathSegments,
        status: 'queued',
        totalBytes: total,
        downloadedBytes: 0,
        speedBytesPerSec: 0,
        progressPercent: 0,
      };

      this.queue.push(task);
      taskIds.push(taskId);
    }

    if (autoStart) {
      this.isPaused = false;
    }

    this.notify();
    if (!this.isPaused) {
      this.processQueue();
    }
    return taskIds;
  }

  /**
   * Resume/Start download execution
   */
  public resume(): void {
    this.isPaused = false;
    // Restore any paused tasks to queued
    for (const task of this.queue) {
      if (task.status === 'paused') {
        task.status = 'queued';
      }
    }
    this.notify();
    this.processQueue();
  }

  /**
   * Stop/Pause all active downloads and halt the queue immediately
   */
  public pause(): void {
    this.isPaused = true;
    this.speedSamples = [];

    // Abort all in-flight fetch streams
    this.activeControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch {}
    });
    this.activeControllers.clear();

    // Move currently active tasks back into the head of the queue with 'paused' status
    const tasksToRequeue: DownloadTask[] = [];
    this.activeTasks.forEach((task) => {
      task.status = 'paused';
      task.speedBytesPerSec = 0;
      tasksToRequeue.push(task);
    });
    this.activeTasks.clear();

    // Prepend to queue so they resume first
    this.queue = [...tasksToRequeue, ...this.queue];
    for (const task of this.queue) {
      if (task.status === 'queued') {
        task.status = 'paused';
      }
    }

    this.notify();
  }

  /**
   * Cancel and clear all pending and active downloads
   */
  public stopAll(): void {
    this.pause();
    this.queue = [];
    this.notify();
  }

  public clearCompleted() {
    this.completedTasks = [];
    this.notify();
  }

  public getPendingCount(): number {
    return this.queue.length + this.activeTasks.size;
  }

  private async processQueue() {
    if (!this.accessToken || this.isPaused) return;

    while (!this.isPaused && this.activeTasks.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.status = 'downloading';
      task.startedAt = Date.now();
      this.activeTasks.set(task.id, task);

      const controller = new AbortController();
      this.activeControllers.set(task.id, controller);

      this.notify();

      // Launch worker without blocking the loop
      this.executeDownload(task, controller.signal).finally(() => {
        this.activeControllers.delete(task.id);
        this.activeTasks.delete(task.id);

        if (task.status === 'completed' || task.status === 'downloading') {
          task.status = 'completed';
          task.progressPercent = 100;
          task.completedAt = Date.now();
          this.completedTasks.unshift(task);
        } else if (task.status === 'error') {
          this.completedTasks.unshift(task);
        }

        this.notify();
        if (!this.isPaused) {
          this.processQueue();
        }
      });
    }
  }

  private async executeDownload(task: DownloadTask, signal: AbortSignal): Promise<void> {
    if (!this.accessToken) {
      task.status = 'error';
      task.error = 'Sem autorização ativa do Google Drive.';
      return;
    }

    let lastProgressBytes = task.downloadedBytes || 0;
    let lastProgressTime = Date.now();

    const handleProgress = (bytes: number, totalExpected?: number) => {
      if (signal.aborted || this.isPaused) return;

      const deltaBytes = bytes - lastProgressBytes;
      const now = Date.now();
      const deltaTime = (now - lastProgressTime) / 1000;

      if (deltaBytes > 0) {
        this.recordBytes(deltaBytes);
      }

      if (deltaTime >= 0.3) {
        task.speedBytesPerSec = Math.round(deltaBytes / deltaTime);
        lastProgressBytes = bytes;
        lastProgressTime = now;
      }

      task.downloadedBytes = bytes;
      if (totalExpected && totalExpected > 0) {
        task.totalBytes = totalExpected;
        task.progressPercent = Math.min(100, Math.round((bytes / totalExpected) * 100));
      } else if (task.totalBytes > 0) {
        task.progressPercent = Math.min(100, Math.round((bytes / task.totalBytes) * 100));
      }
      this.notify();
    };

    try {
      const fileBytes = parseInt(task.file.size || '0', 10);
      const isHugeFile = fileBytes > 25 * 1024 * 1024; // > 25MB

      let canWriteDirectly = false;
      if (this.targetDirectoryHandle) {
        try {
          canWriteDirectly = await (this.targetDirectoryHandle as any).queryPermission({ mode: 'readwrite' }) === 'granted';
          if (!canWriteDirectly) {
            canWriteDirectly = await (this.targetDirectoryHandle as any).requestPermission({ mode: 'readwrite' }) === 'granted';
          }
        } catch {
          canWriteDirectly = false;
        }
      }

      if (canWriteDirectly && this.targetDirectoryHandle) {
        if (this.turboMultiChunk && isHugeFile && !task.file.exportFormat) {
          // Accelerated multi-range parallel chunk download
          const { blob, finalFileName } = await downloadLargeFileMultiChunk(
            this.accessToken,
            task.file,
            4,
            (b, t) => handleProgress(b, t),
            signal
          );
          if (signal.aborted || this.isPaused) return;
          await writeBufferToLocalFile(
            this.targetDirectoryHandle,
            task.pathSegments,
            finalFileName,
            blob
          );
        } else {
          // Direct native streaming write to disk
          const { stream, totalBytes, finalFileName } = await downloadFileStream(
            this.accessToken,
            task.file,
            (b, t) => handleProgress(b, t),
            signal
          );
          if (signal.aborted || this.isPaused) return;
          await writeStreamToLocalFile(
            this.targetDirectoryHandle,
            task.pathSegments,
            finalFileName,
            stream,
            totalBytes,
            (b, t) => handleProgress(b, t)
          );
        }
      } else {
        // Fallback: high-speed stream to browser download
        const { stream, totalBytes, finalFileName } = await downloadFileStream(
          this.accessToken,
          task.file,
          (b, t) => handleProgress(b, t),
          signal
        );
        if (signal.aborted || this.isPaused) return;
        const res = new Response(stream);
        const blob = await res.blob();
        triggerBrowserDownload(blob, finalFileName);
      }

      if (!signal.aborted && !this.isPaused) {
        task.status = 'completed';
        task.progressPercent = 100;
        task.completedAt = Date.now();
      }
    } catch (err: any) {
      if (signal.aborted || err.name === 'AbortError' || this.isPaused) {
        task.status = 'paused';
        task.speedBytesPerSec = 0;
        return;
      }
      console.error(`Erro ao baixar arquivo ${task.file.name}:`, err);
      task.status = 'error';
      task.error = err?.message || 'Falha desconhecida no download.';
    }
  }
}

export const downloadManager = new DownloadManager();
