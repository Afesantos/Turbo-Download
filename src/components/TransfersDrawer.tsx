import React, { useState } from 'react';
import {
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Flame,
  Clock,
  Trash2,
} from 'lucide-react';
import { DownloadTask, SpeedTelemetry } from '../services/downloadManager';
import { formatBytes, formatSpeed } from '../utils/formatters';

interface TransfersDrawerProps {
  tasks: DownloadTask[];
  telemetry: SpeedTelemetry;
  onClearCompleted: () => void;
}

export const TransfersDrawer: React.FC<TransfersDrawerProps> = ({
  tasks,
  telemetry,
  onClearCompleted,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeTasks = tasks.filter((t) => t.status === 'downloading');
  const queuedTasks = tasks.filter((t) => t.status === 'queued');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const errorTasks = tasks.filter((t) => t.status === 'error');

  const hasActivity = activeTasks.length > 0 || queuedTasks.length > 0;

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* Header Bar */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 flex items-center justify-between cursor-pointer select-none border-b border-slate-800"
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                hasActivity
                  ? 'bg-orange-500/20 text-orange-400 animate-pulse border border-orange-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {hasActivity ? (
                <Flame className="w-4 h-4 fill-orange-400" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">
                  {hasActivity ? 'Transferências em Andamento' : 'Downloads Concluídos'}
                </span>
                {hasActivity && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    {formatSpeed(telemetry.currentSpeedBytes)}
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-400">
                {activeTasks.length > 0 && `${activeTasks.length} baixando`}
                {queuedTasks.length > 0 && ` • ${queuedTasks.length} na fila`}
                {completedTasks.length > 0 && ` • ${completedTasks.length} salvos`}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 text-slate-400 hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="p-3 max-h-80 overflow-y-auto space-y-2.5">
            {/* Clear completed button */}
            {completedTasks.length > 0 && (
              <div className="flex justify-end pb-1 border-b border-slate-800">
                <button
                  onClick={onClearCompleted}
                  className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-rose-400 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar Concluídos ({completedTasks.length})</span>
                </button>
              </div>
            )}

            {/* Active & Queued Tasks */}
            {tasks.map((task) => {
              const isDownloading = task.status === 'downloading';
              const isCompleted = task.status === 'completed';
              const isError = task.status === 'error';

              return (
                <div
                  key={task.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-slate-200 font-medium truncate max-w-[200px]"
                      title={task.file.name}
                    >
                      {task.file.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {isDownloading && formatSpeed(task.speedBytesPerSec)}
                      {isCompleted && (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Salvo</span>
                        </span>
                      )}
                      {isError && <span className="text-rose-400 font-semibold">Erro</span>}
                      {task.status === 'queued' && (
                        <span className="text-slate-500">Aguardando...</span>
                      )}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isError
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-orange-500 to-amber-500'
                      }`}
                      style={{
                        width: `${isCompleted ? 100 : task.progressPercent || 5}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>
                      {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}
                    </span>
                    <span>{task.progressPercent}%</span>
                  </div>

                  {task.error && (
                    <div className="text-[10px] text-rose-400 mt-1 bg-rose-950/40 p-1 rounded">
                      {task.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
