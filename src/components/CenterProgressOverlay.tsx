import React from 'react';
import {
  Download,
  Flame,
  CheckCircle,
  Square,
  RefreshCw,
  HardDrive,
  FileText,
  Sparkles,
  Cpu,
  TrendingUp,
  X,
  Minimize2,
} from 'lucide-react';
import { DownloadTask, SpeedTelemetry } from '../services/downloadManager';
import { formatBytes, formatSpeed } from '../utils/formatters';

interface CenterProgressOverlayProps {
  tasks: DownloadTask[];
  telemetry: SpeedTelemetry;
  onStopDownload: () => void;
  localFolderName: string | null;
  concurrency: number;
}

export const CenterProgressOverlay: React.FC<CenterProgressOverlayProps> = ({
  tasks,
  telemetry,
  onStopDownload,
  localFolderName,
  concurrency,
}) => {
  const activeTasks = tasks.filter((t) => t.status === 'downloading');
  const queuedTasks = tasks.filter((t) => t.status === 'queued');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const isDownloading = telemetry.hasActiveDownloads || activeTasks.length > 0;

  // Calculate overall bytes and percentage across all current active and queued tasks
  const relevantTasks = tasks.filter(
    (t) => t.status === 'downloading' || t.status === 'queued' || t.status === 'completed'
  );

  const totalBytesExpected = relevantTasks.reduce((sum, t) => sum + (t.totalBytes || 0), 0);
  const totalBytesDownloaded = relevantTasks.reduce(
    (sum, t) => sum + (t.downloadedBytes || 0),
    0
  );

  let overallPercent = 0;
  if (totalBytesExpected > 0) {
    overallPercent = Math.min(100, Math.round((totalBytesDownloaded / totalBytesExpected) * 100));
  } else if (relevantTasks.length > 0) {
    overallPercent = Math.min(
      100,
      Math.round((completedTasks.length / relevantTasks.length) * 100)
    );
  }

  // Only show when downloads are active
  if (!isDownloading) {
    return null;
  }

  const currentFile = activeTasks[0]?.file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-orange-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100 ring-4 ring-orange-500/10">
        {/* Glow ambient background lights */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 animate-pulse">
              <Flame className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Download em Andamento
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">
                  {concurrency}x Turbo
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate max-w-[240px]">
                  Salvando em: <strong className="text-slate-200">{localFolderName || 'Downloads'}</strong>
                </span>
              </p>
            </div>
          </div>

          {/* Real-time speed badge */}
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Taxa Instantânea
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 drop-shadow-sm">
              {formatSpeed(telemetry.currentSpeedBytes)}
            </div>
          </div>
        </div>

        {/* Big Central Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">Progresso Geral</span>
            <span className="text-2xl font-extrabold font-mono text-white">
              {overallPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-950 h-5 rounded-full overflow-hidden p-1 border border-slate-800 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-300 shadow-lg shadow-orange-500/50 relative overflow-hidden"
              style={{ width: `${Math.max(5, overallPercent)}%` }}
            >
              {/* Animated striped shimmer line */}
              <div className="absolute inset-0 bg-white/20 opacity-40 animate-[shimmer_2s_infinite] [background-image:linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] [background-size:20px_20px]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
            <span>
              {formatBytes(totalBytesDownloaded)} de {formatBytes(totalBytesExpected)}
            </span>
            <span>
              {completedTasks.length} de {relevantTasks.length} arquivo(s) salvos
            </span>
          </div>
        </div>

        {/* Current Active File Info */}
        {currentFile && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-6 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5 truncate mr-3">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Baixando Agora:
                </span>
                <span className="text-slate-200 font-semibold truncate block" title={currentFile.name}>
                  {currentFile.name}
                </span>
              </div>
            </div>

            {activeTasks[0] && (
              <span className="font-mono text-emerald-400 font-bold shrink-0">
                {activeTasks[0].progressPercent}%
              </span>
            )}
          </div>
        )}

        {/* Action Controls: Prominent STOP Button */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Cpu className="w-4 h-4 text-slate-500" />
            <span>
              <strong className="text-white font-mono">{activeTasks.length}</strong> streams ativos
            </span>
          </div>

          <button
            onClick={onStopDownload}
            className="flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40"
            title="Parar imediatamente todas as transferências ativas"
          >
            <Square className="w-4 h-4 fill-current animate-pulse" />
            <span>Parar o Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
