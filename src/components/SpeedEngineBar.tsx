import React from 'react';
import {
  Zap,
  Gauge,
  Sliders,
  Flame,
  Layers,
  TrendingUp,
  Cpu,
  Play,
  Square,
  Pause,
  RefreshCw,
} from 'lucide-react';
import { formatSpeed, formatBytes } from '../utils/formatters';

interface SpeedEngineBarProps {
  currentSpeed: number;
  peakSpeed: number;
  totalDownloaded: number;
  activeWorkers: number;
  concurrency: number;
  onConcurrencyChange: (threads: number) => void;
  turboMultiChunk: boolean;
  onToggleTurboMultiChunk: (enabled: boolean) => void;
  onStartDownload: () => void;
  onStopDownload: () => void;
  isDownloading: boolean;
  isPaused: boolean;
  hasPendingTasks: boolean;
}

export const SpeedEngineBar: React.FC<SpeedEngineBarProps> = ({
  currentSpeed,
  peakSpeed,
  totalDownloaded,
  activeWorkers,
  concurrency,
  onConcurrencyChange,
  turboMultiChunk,
  onToggleTurboMultiChunk,
  onStartDownload,
  onStopDownload,
  isDownloading,
  isPaused,
  hasPendingTasks,
}) => {
  const CONCURRENCY_PRESETS = [
    { threads: 2, label: '2x Leve' },
    { threads: 4, label: '4x Rápido' },
    { threads: 8, label: '8x Turbo' },
    { threads: 16, label: '16x Extremo' },
  ];

  const maxScale = Math.max(20 * 1024 * 1024, peakSpeed * 1.1);
  const gaugePercent = Math.min(100, Math.round((currentSpeed / maxScale) * 100));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Decorative speed lines */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Speedometer display */}
        <div className="flex items-center space-x-5">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 p-2 shadow-inner">
            <Gauge className={`w-10 h-10 ${isDownloading ? 'text-orange-500 animate-pulse' : 'text-slate-600'}`} />
            <div
              className="absolute inset-0 rounded-2xl border-2 border-orange-500/30"
              style={{
                boxShadow: currentSpeed > 0 ? '0 0 15px rgba(249, 115, 22, 0.4)' : 'none',
              }}
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-orange-400 flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 fill-orange-400" />
                <span>Motor de Aceleração Turbo</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isDownloading
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 animate-pulse'
                  : isPaused
                  ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isDownloading ? 'Em Execução' : isPaused ? 'Pausado' : 'Pronto'}
              </span>
            </div>

            <div className="flex items-baseline space-x-3 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                {formatSpeed(currentSpeed)}
              </span>
              <span className="text-xs text-slate-400 font-medium">taxa em tempo real</span>
            </div>

            <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Pico:</span>
                <span className="font-mono font-bold text-amber-300">
                  {formatSpeed(peakSpeed)}
                </span>
              </div>
              <span>•</span>
              <div>
                <span>Total transferido:</span>{' '}
                <span className="font-mono font-bold text-slate-200">
                  {formatBytes(totalDownloaded)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed Bar Progress Indicator */}
        <div className="flex-1 max-w-sm hidden xl:block">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-medium">
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Carga dos Streams Paralelos</span>
            </span>
            <span className="font-mono text-slate-300">
              {activeWorkers} de {concurrency} conexões ativas
            </span>
          </div>

          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-500 to-rose-500 transition-all duration-300 shadow-sm shadow-orange-500/50"
              style={{ width: `${Math.max(5, gaugePercent)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
            <span>0 MB/s</span>
            <span>{formatSpeed(maxScale / 2)}</span>
            <span>{formatSpeed(maxScale)}</span>
          </div>
        </div>

        {/* Action Controls: START DOWNLOAD & STOP DOWNLOAD & Tuning */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Dynamic Action Button: Changes between Iniciar o Download and Parar o Download */}
          <div className="flex items-center space-x-2">
            {isDownloading ? (
              <button
                onClick={onStopDownload}
                className="flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40"
                title="Parar imediatamente todas as transferências ativas"
              >
                <Square className="w-4 h-4 fill-current animate-pulse" />
                <span>Parar o Download</span>
              </button>
            ) : (
              <button
                onClick={onStartDownload}
                className="flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl active:scale-95 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/40"
                title="Iniciar o download para a pasta local"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                <span>{isPaused && hasPendingTasks ? 'Continuar o Download' : 'Iniciar o Download'}</span>
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Concurrency Selector */}
          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex items-center space-x-1 justify-center">
            {CONCURRENCY_PRESETS.map((p) => {
              const isSelected = concurrency === p.threads;
              return (
                <button
                  key={p.threads}
                  onClick={() => onConcurrencyChange(p.threads)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                  title={`${p.threads} downloads simultâneos em paralelo`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Multi-Chunk Range switch */}
          <button
            onClick={() => onToggleTurboMultiChunk(!turboMultiChunk)}
            className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              turboMultiChunk
                ? 'bg-orange-950/50 text-orange-300 border-orange-800/80 shadow-md shadow-orange-500/10'
                : 'bg-slate-950/50 text-slate-400 border-slate-800'
            }`}
            title="Divide arquivos grandes (>16MB) em partes para baixar com múltiplos canais simultâneos"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Chunk {turboMultiChunk ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
