import React from 'react';
import {
  FolderOpen,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  FolderSync,
} from 'lucide-react';
import { isFileSystemAccessSupported } from '../services/localFileSystem';

interface FolderSelectorCardProps {
  localFolderName: string | null;
  onSelectFolder: () => void;
  isSelecting: boolean;
  onClearFolder?: () => void;
}

export const FolderSelectorCard: React.FC<FolderSelectorCardProps> = ({
  localFolderName,
  onSelectFolder,
  isSelecting,
  onClearFolder,
}) => {
  const isSupported = isFileSystemAccessSupported();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
      {/* Background accent glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Folder status and description */}
        <div className="flex items-start space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              localFolderName
                ? 'bg-blue-950/60 text-blue-400 border-blue-800/80 shadow-md shadow-blue-500/10'
                : 'bg-amber-950/50 text-amber-400 border-amber-800/60'
            }`}
          >
            {localFolderName ? (
              <FolderSync className="w-6 h-6 animate-pulse" />
            ) : (
              <FolderOpen className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-slate-100 text-base">
                Pasta de Destino no Computador
              </h2>
              {localFolderName ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/70">
                  <CheckCircle className="w-3 h-3" />
                  <span>Sincronização Nativa Ativa</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/70">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Ação Necessária</span>
                </span>
              )}
            </div>

            {localFolderName ? (
              <div className="mt-1 flex items-center space-x-2 text-sm text-slate-300 font-mono bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800 max-w-fit">
                <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-bold text-white truncate max-w-xs sm:max-w-md">
                  {localFolderName}
                </span>
                <span className="text-xs text-emerald-400 font-sans font-medium">
                  • Gravação direta em disco
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Escolha a pasta do seu computador onde os arquivos do Google Drive serão salvos e
                mantidos atualizados automaticamente sem diálogos repetitivos de download.
              </p>
            )}

            {!isSupported && (
              <div className="mt-2 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 max-w-lg">
                ⚠️ Seu navegador não suporta escrita direta contínua no disco (File System Access).
                Os arquivos serão baixados pelo navegador. Use <strong>Google Chrome, Microsoft Edge ou Brave</strong> para sincronização nativa na pasta.
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
          {localFolderName && onClearFolder && (
            <button
              onClick={onClearFolder}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors border border-transparent hover:border-rose-900/40"
            >
              Trocar Pasta
            </button>
          )}

          <button
            onClick={onSelectFolder}
            disabled={isSelecting}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/25 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSelecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span>
              {localFolderName ? 'Alterar Pasta Local' : 'Escolher Pasta no Computador'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
