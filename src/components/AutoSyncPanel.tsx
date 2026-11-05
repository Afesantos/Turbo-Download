import React, { useState } from 'react';
import {
  RefreshCw,
  Clock,
  Play,
  Pause,
  Eye,
  CheckCircle2,
  Trash2,
  Activity,
  FolderSync,
  ListCollapse,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WatchedItem, SyncLogEntry } from '../services/syncEngine';
import { formatTimeAgo, formatDateTime } from '../utils/formatters';

interface AutoSyncPanelProps {
  isActive: boolean;
  onToggleActive: () => void;
  intervalSeconds: number;
  onChangeInterval: (seconds: number) => void;
  isChecking: boolean;
  lastCheckTimestamp: number | null;
  onTriggerSync: () => void;
  watchedItems: WatchedItem[];
  onRemoveWatched: (id: string) => void;
  onClearAllWatched: () => void;
  recentLogs: SyncLogEntry[];
}

export const AutoSyncPanel: React.FC<AutoSyncPanelProps> = ({
  isActive,
  onToggleActive,
  intervalSeconds,
  onChangeInterval,
  isChecking,
  lastCheckTimestamp,
  onTriggerSync,
  watchedItems,
  onRemoveWatched,
  onClearAllWatched,
  recentLogs,
}) => {
  const [showWatchedList, setShowWatchedList] = useState(false);
  const [showLogsList, setShowLogsList] = useState(false);

  const INTERVAL_OPTIONS = [
    { value: 5, label: '5s (Tempo Real Instantâneo)' },
    { value: 10, label: '10s (Recomendado)' },
    { value: 30, label: '30s (Equilibrado)' },
    { value: 60, label: '60s (Econômico)' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Auto-Sync Master Switch & Status */}
        <div className="flex items-start space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              isActive
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 shadow-md shadow-emerald-500/10'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
            }`}
          >
            <FolderSync className={`w-6 h-6 ${isActive && isChecking ? 'animate-spin' : ''}`} />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-100 text-base">
                Sincronização Automática em Tempo Real
              </h3>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isActive
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span>{isActive ? 'Monitoramento Ativo' : 'Pausado'}</span>
              </span>
            </div>

            <div className="flex items-center space-x-2 mt-1 text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  Última verificação:{' '}
                  <strong className="text-slate-300 font-mono">
                    {formatTimeAgo(lastCheckTimestamp ?? undefined)}
                  </strong>
                </span>
              </span>

              <span>•</span>

              <button
                onClick={() => setShowWatchedList(!showWatchedList)}
                className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 flex items-center space-x-1"
              >
                <span>{watchedItems.length} item(ns) monitorado(s)</span>
                {showWatchedList ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              <span>•</span>

              <button
                onClick={() => setShowLogsList(!showLogsList)}
                className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 flex items-center space-x-1"
              >
                <Activity className="w-3 h-3" />
                <span>Histórico</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Controls (Interval selector, Force Sync button, Toggle ON/OFF) */}
        <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center">
          {/* Interval Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Ciclo:</span>
            <select
              value={intervalSeconds}
              onChange={(e) => onChangeInterval(Number(e.target.value))}
              disabled={!isActive}
              className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer text-xs"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger immediate sync */}
          <button
            onClick={onTriggerSync}
            disabled={isChecking || !isActive}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all disabled:opacity-40"
            title="Verificar e sincronizar imediatamente agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isChecking ? 'Verificando...' : 'Sincronizar Agora'}</span>
          </button>

          {/* Master Toggle Button */}
          <button
            onClick={onToggleActive}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            }`}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isActive ? 'Pausar Auto-Sync' : 'Ativar Auto-Sync'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Watched Items List */}
      {showWatchedList && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Arquivos e Pastas em Monitoramento Contínuo
            </h4>
            {watchedItems.length > 0 && (
              <button
                onClick={onClearAllWatched}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
              >
                Limpar Todos
              </button>
            )}
          </div>

          {watchedItems.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
              Nenhum arquivo ou pasta adicionado à sincronização contínua ainda.
              <br />
              <span className="text-slate-300 font-medium">
                Dica: Selecione arquivos ou pastas na lista abaixo e clique em &quot;Sincronizar em Tempo Real&quot;.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {watchedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                >
                  <div className="flex items-center space-x-2 truncate mr-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        item.isFolder
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          : 'bg-blue-950 text-blue-400 border border-blue-800/60'
                      }`}
                    >
                      {item.isFolder ? 'Pasta' : 'Arquivo'}
                    </span>
                    <span className="text-slate-200 truncate font-medium" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  <button
                    onClick={() => onRemoveWatched(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Remover do monitoramento contínuo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expandable Logs List */}
      {showLogsList && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Registro de Eventos em Tempo Real</span>
            </h4>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-2.5 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1.5">
            {recentLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-2">
                Nenhum evento registrado até o momento.
              </div>
            ) : (
              recentLogs.map((log) => {
                const color =
                  log.type === 'change_detected'
                    ? 'text-emerald-400'
                    : log.type === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-400';

                return (
                  <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                    <span className={color}>• {log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
