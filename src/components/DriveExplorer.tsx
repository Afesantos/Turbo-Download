import React, { useState, useMemo } from 'react';
import {
  Folder,
  File,
  FileText,
  FileSpreadsheet,
  FileVideo,
  FileImage,
  FileArchive,
  Download,
  FolderSync,
  Search,
  CheckSquare,
  Square,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  ArrowUpDown,
  ExternalLink,
  CheckCircle,
  Archive,
  Play,
} from 'lucide-react';
import { DriveFile, isGoogleWorkspaceDoc } from '../services/drive';
import { formatBytes, formatTimeAgo, formatDateTime } from '../utils/formatters';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface DriveExplorerProps {
  files: DriveFile[];
  isLoading: boolean;
  breadcrumbs: BreadcrumbItem[];
  onNavigateFolder: (folderId: string, folderName: string) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onRefresh: () => void;
  selectedFileIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownloadSelected: () => void;
  onDownloadZip: () => void;
  onWatchSelected: () => void;
  onDownloadSingle: (file: DriveFile) => void;
  onToggleWatchSingle: (file: DriveFile) => void;
  isItemWatched: (id: string) => boolean;
  localFolderConfigured: boolean;
  concurrency: number;
  onStartDownload?: () => void;
  onStopDownload?: () => void;
  isDownloading?: boolean;
  isPaused?: boolean;
  hasPendingTasks?: boolean;
}

export const DriveExplorer: React.FC<DriveExplorerProps> = ({
  files,
  isLoading,
  breadcrumbs,
  onNavigateFolder,
  onNavigateBreadcrumb,
  onRefresh,
  selectedFileIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDownloadSelected,
  onDownloadZip,
  onWatchSelected,
  onDownloadSingle,
  onToggleWatchSingle,
  isItemWatched,
  localFolderConfigured,
  concurrency,
  onStartDownload,
  onStopDownload,
  isDownloading = false,
  isPaused = false,
  hasPendingTasks = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'folders' | 'documents' | 'media' | 'large'
  >('all');
  const [sortField, setSortField] = useState<'name' | 'size' | 'modifiedTime'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }

    // Filter type
    if (filterType === 'folders') {
      result = result.filter((f) => f.isFolder);
    } else if (filterType === 'documents') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (isGoogleWorkspaceDoc(f.mimeType) ||
            f.mimeType.includes('pdf') ||
            f.mimeType.includes('word') ||
            f.mimeType.includes('sheet') ||
            f.mimeType.includes('text') ||
            f.name.endsWith('.pdf') ||
            f.name.endsWith('.docx') ||
            f.name.endsWith('.xlsx') ||
            f.name.endsWith('.txt'))
      );
    } else if (filterType === 'media') {
      result = result.filter(
        (f) =>
          !f.isFolder &&
          (f.mimeType.startsWith('image/') ||
            f.mimeType.startsWith('video/') ||
            f.mimeType.startsWith('audio/'))
      );
    } else if (filterType === 'large') {
      result = result.filter((f) => {
        const size = parseInt(f.size || '0', 10);
        return !f.isFolder && size >= 20 * 1024 * 1024; // >= 20MB
      });
    }

    // Sort
    result.sort((a, b) => {
      // Folders always top
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      if (sortField === 'name') {
        const comp = a.name.localeCompare(b.name, 'pt-BR');
        return sortAsc ? comp : -comp;
      }
      if (sortField === 'size') {
        const sizeA = parseInt(a.size || '0', 10);
        const sizeB = parseInt(b.size || '0', 10);
        return sortAsc ? sizeA - sizeB : sizeB - sizeA;
      }
      if (sortField === 'modifiedTime') {
        const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
        const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [files, searchQuery, filterType, sortField, sortAsc]);

  const allSelected =
    filteredFiles.length > 0 && filteredFiles.every((f) => selectedFileIds.has(f.id));

  // Compute selected size
  const totalSelectedBytes = useMemo(() => {
    return files
      .filter((f) => selectedFileIds.has(f.id))
      .reduce((sum, f) => sum + parseInt(f.size || '0', 10), 0);
  }, [files, selectedFileIds]);

  const getFileIcon = (file: DriveFile) => {
    if (file.isFolder) {
      return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    }
    if (file.mimeType.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (file.mimeType.includes('document') || file.mimeType.includes('pdf') || file.name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (file.mimeType.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-purple-400" />;
    }
    if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
      return <FileVideo className="w-5 h-5 text-rose-400" />;
    }
    if (file.mimeType.includes('zip') || file.mimeType.includes('tar') || file.mimeType.includes('rar')) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleSort = (field: 'name' | 'size' | 'modifiedTime') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Top Bar: Breadcrumbs & Refresh */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-1.5 text-xs text-slate-400 overflow-x-auto py-1">
          {breadcrumbs.map((b, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={b.id}>
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                <button
                  onClick={() => onNavigateBreadcrumb(index)}
                  className={`px-2 py-1 rounded-lg transition-colors font-medium whitespace-nowrap ${
                    isLast
                      ? 'text-white font-bold bg-slate-800/80 cursor-default'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {b.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Actions, Refresh and File count */}
        <div className="flex items-center space-x-2 text-xs">
          {onStartDownload && (
            <button
              onClick={onStartDownload}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              title="Iniciar download de arquivos"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Iniciar Download</span>
            </button>
          )}

          {onStopDownload && (
            <button
              onClick={onStopDownload}
              disabled={!isDownloading && !hasPendingTasks}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                isDownloading || hasPendingTasks
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 ring-2 ring-rose-500/30'
                  : 'bg-slate-800/60 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-40'
              }`}
              title="Parar downloads imediatamente"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar Download</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <span className="text-slate-400 hidden sm:inline">{files.length} itens</span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Atualizar lista do Google Drive"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar arquivos por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'folders', label: 'Pastas' },
            { id: 'documents', label: 'Documentos' },
            { id: 'media', label: 'Mídia' },
            { id: 'large', label: 'Grandes (>20MB)' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilterType(chip.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                filterType === chip.id
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar (when 1 or more items are selected) */}
      {selectedFileIds.size > 0 && (
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-slate-950 border-b border-blue-900/40 p-3 px-4 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-3 text-xs text-blue-200">
            <span className="font-bold text-white bg-blue-600 px-2 py-0.5 rounded-md">
              {selectedFileIds.size}
            </span>
            <span>item(ns) selecionado(s)</span>
            {totalSelectedBytes > 0 && (
              <span className="text-slate-400">({formatBytes(totalSelectedBytes)})</span>
            )}
            <button
              onClick={onClearSelection}
              className="text-slate-400 hover:text-white underline text-xs"
            >
              Desmarcar todos
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto-Sync selected */}
            <button
              onClick={onWatchSelected}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              title="Adiciona os itens selecionados ao monitoramento contínuo em tempo real"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Sincronizar em Tempo Real</span>
            </button>

            {/* Iniciar Download Selecionados */}
            <button
              onClick={onDownloadSelected}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400/40 active:scale-95 transition-all"
              title={`Iniciar download dos ${selectedFileIds.size} itens selecionados`}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Iniciar Download ({selectedFileIds.size})</span>
            </button>

            {/* Parar Download (when downloading or pending) */}
            {(isDownloading || hasPendingTasks) && onStopDownload && (
              <button
                onClick={onStopDownload}
                className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 ring-1 ring-rose-400/40 active:scale-95 transition-all"
                title="Parar imediatamente os downloads em andamento"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Parar Download</span>
              </button>
            )}

            {/* Zip archive download */}
            <button
              onClick={onDownloadZip}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700 transition-all"
              title="Baixar como arquivo compactado .ZIP"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Baixar ZIP</span>
            </button>
          </div>
        </div>
      )}

      {/* Files Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className="py-3 px-4 w-10">
                <button
                  onClick={allSelected ? onClearSelection : onSelectAll}
                  className="text-slate-400 hover:text-white"
                  title={allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Nome do Arquivo / Pasta</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('size')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors w-28"
              >
                <div className="flex items-center space-x-1">
                  <span>Tamanho</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('modifiedTime')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors w-36 hidden sm:table-cell"
              >
                <div className="flex items-center space-x-1">
                  <span>Modificado</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-right w-44">Ações Rápidas</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                  <span>Carregando arquivos do Google Drive...</span>
                </td>
              </tr>
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-500">
                    <Folder className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-slate-300">Nenhum arquivo encontrado.</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta pasta está vazia ou o termo buscado não retornou resultados.
                  </p>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const isWatched = isItemWatched(file.id);

                return (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-800/40 transition-colors group ${
                      isSelected ? 'bg-blue-950/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onToggleSelect(file.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Square className="w-4 h-4 group-hover:text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* File / Folder Name with Icon */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-3">
                        <div className="shrink-0">{getFileIcon(file)}</div>

                        <div className="truncate">
                          {file.isFolder ? (
                            <button
                              onClick={() => onNavigateFolder(file.id, file.name)}
                              className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate text-left block"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-200 truncate block">
                              {file.name}
                            </span>
                          )}

                          {file.exportFormat && (
                            <span className="text-[10px] text-blue-400 font-mono">
                              Exporta como {file.exportFormat.extension}
                            </span>
                          )}
                        </div>

                        {/* Real-time sync badge */}
                        {isWatched && (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0"
                            title="Monitorado para sincronização contínua em tempo real"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Auto-Sync</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 font-mono text-slate-400 text-xs whitespace-nowrap">
                      {file.isFolder ? '--' : formatBytes(file.size)}
                    </td>

                    {/* Modified Time */}
                    <td
                      className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap hidden sm:table-cell"
                      title={formatDateTime(file.modifiedTime)}
                    >
                      {formatTimeAgo(file.modifiedTime)}
                    </td>

                    {/* Quick Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Toggle Real-Time Sync */}
                        <button
                          onClick={() => onToggleWatchSingle(file)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            isWatched
                              ? 'text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                          }`}
                          title={
                            isWatched
                              ? 'Remover do monitoramento automático'
                              : 'Ativar sincronização automática em tempo real'
                          }
                        >
                          <FolderSync className="w-4 h-4" />
                        </button>

                        {/* Direct Download Now */}
                        <button
                          onClick={() => onDownloadSingle(file)}
                          className="flex items-center space-x-1 bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border border-slate-700 hover:border-orange-500"
                          title="Baixar agora para a pasta do computador"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Baixar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
