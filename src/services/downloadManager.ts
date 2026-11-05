/**
 * Download Manager with Turbo Multi-Threading Concurrency,
 * real-time transfer speedometer (MB/s, peak speed), and direct disk streaming.
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
  status: 'queued' | 'downloading' | 'completed' | 'error';
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
}

export type DownloadListener = (tasks: DownloadTask[], telemetry: SpeedTelemetry) => void;

class DownloadManager {
  private queue: DownloadTask[] = [];
  private activeTasks: Map<string, DownloadTask> = new Map();
  private completedTasks: DownloadTask[] = [];
  private maxConcurrency: number = 6; // Default Turbo 6x
  private turboMultiChunk: boolean = true;
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
    this.processQueue();
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

    const currentSpeed = this.calculateCurrentSpeed();
    if (currentSpeed > this.peakSpeed) {
      this.peakSpeed = currentSpeed;
    }

    const totalDownloaded = this.completedTasks.reduce(
      (acc, t) => acc + (t.downloadedBytes || 0),
      0
    ) + Array.from(this.activeTasks.values()).reduce((acc, t) => acc + (t.downloadedBytes || 0), 0);

    const telemetry: SpeedTelemetry = {
      currentSpeedBytes: currentSpeed,
      peakSpeedBytes: this.peakSpeed,
      totalDownloadedBytes: totalDownloaded,
      activeCount: this.activeTasks.size,
      queuedCount: this.queue.length,
      completedCount: this.completedTasks.filter((t) => t.status === 'completed').length,
      errorCount: this.completedTasks.filter((t) => t.status === 'error').length,
    };

    this.listeners.forEach((fn) => fn(allTasks, telemetry));
  }

  private startSpeedTicker() {
    if (this.speedTicker) return;
    this.speedTicker = setInterval(() => {
      // Clean samples older than 2 seconds
      const now = Date.now();
      this.speedSamples = this.speedSamples.filter((s) => now - s.timestamp < 2000);
      this.notify();
    }, 400);
  }

  private recordBytes(bytes: number) {
    this.speedSamples.push({ timestamp: Date.now(), bytes });
  }

  private calculateCurrentSpeed(): number {
    if (this.speedSamples.length === 0) return 0;
    const now = Date.now();
    const recent = this.speedSamples.filter((s) => now - s.timestamp <= 1500);
    if (recent.length === 0) return 0;
    const sumBytes = recent.reduce((a, b) => a + b.bytes, 0);
    const windowSeconds = Math.max(0.5, (now - recent[0].timestamp) / 1000);
    return Math.round(sumBytes / windowSeconds);
  }

  public enqueueFiles(
    files: { file: DriveFile; pathSegments: string[] }[]
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

    this.notify();
    this.processQueue();
    return taskIds;
  }

  public clearCompleted() {
    this.completedTasks = [];
    this.notify();
  }

  private async processQueue() {
    if (!this.accessToken) return;

    while (this.activeTasks.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.status = 'downloading';
      task.startedAt = Date.now();
      this.activeTasks.set(task.id, task);
      this.notify();

      // Launch worker without blocking the loop
      this.executeDownload(task).finally(() => {
        this.activeTasks.delete(task.id);
        this.completedTasks.unshift(task);
        this.notify();
        this.processQueue();
      });
    }
  }

  private async executeDownload(task: DownloadTask): Promise<void> {
    if (!this.accessToken) {
      task.status = 'error';
      task.error = 'Sem autorização ativa do Google Drive.';
      return;
    }

    let lastProgressBytes = 0;
    let lastProgressTime = Date.now();

    const handleProgress = (bytes: number, totalExpected?: number) => {
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

      // Direct write to computer folder if FileSystemDirectoryHandle is available
      if (this.targetDirectoryHandle) {
        if (this.turboMultiChunk && isHugeFile && !task.file.exportFormat) {
          // Accelerated multi-range parallel chunk download
          const { blob, finalFileName } = await downloadLargeFileMultiChunk(
            this.accessToken,
            task.file,
            4,
            (b, t) => handleProgress(b, t)
          );
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
            (b, t) => handleProgress(b, t)
          );
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
        // Fallback: in-memory stream to browser download
        const { stream, totalBytes, finalFileName } = await downloadFileStream(
          this.accessToken,
          task.file,
          (b, t) => handleProgress(b, t)
        );
        const res = new Response(stream);
        const blob = await res.blob();
        triggerBrowserDownload(blob, finalFileName);
      }

      task.status = 'completed';
      task.progressPercent = 100;
      task.completedAt = Date.now();
    } catch (err: any) {
      console.error(`Erro ao baixar arquivo ${task.file.name}:`, err);
      task.status = 'error';
      task.error = err?.message || 'Falha desconhecida no download.';
    }
  }
}

export const downloadManager = new DownloadManager();
