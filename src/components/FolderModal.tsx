import React, { useState } from 'react';
import {
  FolderOpen,
  HardDrive,
  ExternalLink,
  CheckCircle,
  Download,
  ShieldAlert,
  X,
  Sparkles,
  Info,
} from 'lucide-react';
import { isInsideIframe } from '../services/localFileSystem';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderName: string | null;
  onSelectNativeFolder: () => Promise<boolean>;
  onSelectDownloadsFolder: (subfolder: string) => void;
  isSelecting: boolean;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  currentFolderName,
  onSelectNativeFolder,
  onSelectDownloadsFolder,
  isSelecting,
}) => {
  const [subfolderName, setSubfolderName] = useState('DriveSync');
  const [iframeErrorNotice, setIframeErrorNotice] = useState(false);
  const inIframe = isInsideIframe();

  if (!isOpen) return null;

  const handleNativeClick = async () => {
    setIframeErrorNotice(false);
    const success = await onSelectNativeFolder();
    if (success) {
      onClose();
    } else {
      if (inIframe) {
        setIframeErrorNotice(true);
      }
    }
  };

  const handleDownloadsClick = () => {
    onSelectDownloadsFolder(subfolderName.trim() || 'DriveSync');
    onClose();
  };

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden text-slate-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-white">
              Escolher Pasta de Destino no Computador
            </h3>
            <p className="text-xs text-slate-400">
              Defina como os arquivos serão gravados no seu computador
            </p>
          </div>
        </div>

        {/* Iframe Notice if detected or triggered */}
        {(inIframe || iframeErrorNotice) && (
          <div className="mb-4 bg-amber-950/60 border border-amber-800/80 rounded-2xl p-4 text-xs text-amber-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Restrição de Segurança do Navegador em iframes</span>
            </div>
            <p className="text-amber-200/90 leading-relaxed">
              O navegador bloqueia o seletor nativo de pastas quando executado dentro de painéis
              embutidos (iframe). Você pode usar o <strong>Modo Rápido de Downloads</strong> abaixo
              ou abrir o app em uma <strong>aba separada</strong> para acesso total ao disco.
            </p>
            {appUrl && (
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-xl shadow-md transition-all mt-1"
              >
                <span>Abrir App em Nova Aba</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Option 1: Fast Downloads Folder (Always works everywhere) */}
          <div className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">
                      Pasta Padrão de Downloads do PC
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
                      100% Compatível
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Salva automaticamente na pasta <strong>Downloads</strong> do seu sistema
                    operacional (Windows, Mac ou Linux).
                  </p>

                  <div className="mt-3 flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-mono">Downloads /</span>
                    <input
                      type="text"
                      value={subfolderName}
                      onChange={(e) => setSubfolderName(e.target.value)}
                      placeholder="DriveSync"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-emerald-500 w-36"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-900 flex justify-end">
              <button
                onClick={handleDownloadsClick}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                Definir como Pasta de Downloads
              </button>
            </div>
          </div>

          {/* Option 2: Native Disk Handle (showDirectoryPicker) */}
          <div className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">
                    Selecionar Pasta Física Específica
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">
                    Acesso Nativo
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Abre a janela nativa do seu sistema operacional para escolher qualquer diretório
                  específico no disco rígido ou SSD.
                </p>
                <div className="mt-3">
                  <button
                    onClick={handleNativeClick}
                    disabled={isSelecting}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Abrir Seletor de Pastas do Windows/Mac</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current status display */}
        {currentFolderName && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Pasta atualmente vinculada:</span>
            <span className="font-mono font-bold text-emerald-400">{currentFolderName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
