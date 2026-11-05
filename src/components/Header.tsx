import React from 'react';
import { Zap, HardDrive, Cloud, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { User } from 'firebase/auth';
import { formatSpeed } from '../utils/formatters';

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  localFolderName: string | null;
  currentSpeed: number;
  peakSpeed: number;
  concurrency: number;
  isAutoSyncActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  localFolderName,
  currentSpeed,
  peakSpeed,
  concurrency,
  isAutoSyncActive,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                DriveSync Turbo
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">
                {concurrency}x Threads
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Sincronização em tempo real & downloads ultrarrápidos para o seu PC
            </p>
          </div>
        </div>

        {/* Live Speed telemetry chip */}
        <div className="hidden md:flex items-center space-x-4 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  currentSpeed > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  currentSpeed > 0 ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              />
            </span>
            <div className="text-left">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Velocidade Atual
              </div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {formatSpeed(currentSpeed)}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="text-left">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Pico Atingido
            </div>
            <div className="text-sm font-mono font-bold text-amber-400">
              {formatSpeed(peakSpeed)}
            </div>
          </div>
        </div>

        {/* Status Indicators & Auth */}
        <div className="flex items-center space-x-3">
          {/* Drive & Local Folder Badges */}
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${
                user
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{user ? 'Drive Conectado' : 'Drive Desconectado'}</span>
            </div>

            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${
                localFolderName
                  ? 'bg-blue-950/40 text-blue-300 border-blue-800/50'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">
                {localFolderName ? localFolderName : 'Pasta Pendente'}
              </span>
            </div>
          </div>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center space-x-3 bg-slate-800/70 border border-slate-700/70 rounded-xl px-2.5 py-1.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuário'}
                  className="w-7 h-7 rounded-full border border-slate-600"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-slate-200 truncate max-w-[130px]">
                  {user.displayName || user.email?.split('@')[0]}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                  {user.email}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Desconectar da conta Google"
                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              )}
              <span>Conectar Google Drive</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
