export const formatBytes = (bytes?: number | string): string => {
  if (bytes === undefined || bytes === null || bytes === '') return '--';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num < 0) return '--';
  if (num === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const val = parseFloat((num / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i]}`;
};

export const formatSpeed = (bytesPerSec?: number): string => {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  const k = 1024;
  if (bytesPerSec < k * k) {
    return `${(bytesPerSec / k).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (k * k)).toFixed(2)} MB/s`;
};

export const formatTimeAgo = (timestamp?: number | string): string => {
  if (!timestamp) return '--';
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diffSec = Math.floor((now - time) / 1000);

  if (diffSec < 5) return 'agora mesmo';
  if (diffSec < 60) return `há ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour}h`;
  const diffDays = Math.floor(diffHour / 24);
  return `há ${diffDays} dias`;
};

export const formatDateTime = (timestamp?: number | string): string => {
  if (!timestamp) return '--';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'ARQ';
};
