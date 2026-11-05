/**
 * Service to manage local computer directory access via File System Access API
 * and IndexedDB persistence for seamless continuous real-time synchronization.
 */

const DB_NAME = 'DriveSyncLocalStore';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'target_sync_directory';

export interface LocalFolderInfo {
  name: string;
  isSupported: boolean;
  hasPermission: boolean;
  isIframe: boolean;
}

// Check if app is running in an iframe (e.g. AI Studio preview)
export const isInsideIframe = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
};

// Check if File System Access API is supported in the user's browser
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

// Open IndexedDB instance
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Store directory handle in IndexedDB
export const saveStoredDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Não foi possível persistir handle no IndexedDB:', err);
  }
};

// Retrieve directory handle from IndexedDB
export const getStoredDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(HANDLE_KEY);
    return await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

// Clear directory handle from IndexedDB
export const clearStoredDirectoryHandle = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  } catch (err) {
    console.warn('Erro ao limpar handle do IndexedDB:', err);
  }
};

// Verify or ask for readwrite permission
export const verifyPermission = async (
  fileHandle: any,
  readWrite: boolean = true
): Promise<boolean> => {
  const options = {
    mode: readWrite ? 'readwrite' : 'read',
  };
  try {
    if (typeof fileHandle.queryPermission === 'function') {
      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
    }
    if (typeof fileHandle.requestPermission === 'function') {
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch (err) {
    console.warn('Permissão de acesso à pasta não foi concedida:', err);
  }
  return false;
};

const FALLBACK_FOLDER_KEY = 'drivesync_fallback_folder';

export const saveFallbackFolderName = (name: string) => {
  try {
    localStorage.setItem(FALLBACK_FOLDER_KEY, name);
  } catch {}
};

export const getFallbackFolderName = (): string | null => {
  try {
    return localStorage.getItem(FALLBACK_FOLDER_KEY);
  } catch {
    return null;
  }
};

export const clearFallbackFolder = () => {
  try {
    localStorage.removeItem(FALLBACK_FOLDER_KEY);
  } catch {}
};

// Prompt user to select directory on computer
export const pickLocalDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('NOT_SUPPORTED');
  }

  try {
    // @ts-ignore - showDirectoryPicker is supported in modern chromium browsers
    const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: 'drivesync_folder',
      mode: 'readwrite',
    });

    const hasPermission = await verifyPermission(dirHandle, true);
    if (!hasPermission) {
      throw new Error('PERMISSION_DENIED');
    }

    await saveStoredDirectoryHandle(dirHandle);
    clearFallbackFolder();
    return dirHandle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null; // User cancelled
    }
    if (
      error.name === 'SecurityError' ||
      error.message?.includes('Cross-origin') ||
      error.message?.includes('iframe') ||
      error.message?.includes('subframe')
    ) {
      throw new Error('IFRAME_SECURITY_RESTRICTION');
    }
    throw error;
  }
};

// Recursively traverse or create subfolders inside directory handle
export const getOrCreateSubdirectory = async (
  rootHandle: FileSystemDirectoryHandle,
  pathSegments: string[]
): Promise<FileSystemDirectoryHandle> => {
  let currentHandle = rootHandle;
  for (const rawSegment of pathSegments) {
    if (!rawSegment) continue;
    // Replace characters forbidden by OS filesystems: < > : " / \ | ? *
    const segment = rawSegment.trim().replace(/[<>:"/\\|?*]/g, '_');
    if (!segment) continue;
    currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
  }
  return currentHandle;
};

// Stream write data directly to file on user disk with progress callbacks
export const writeStreamToLocalFile = async (
  targetDirHandle: FileSystemDirectoryHandle,
  pathSegments: string[],
  fileName: string,
  readableStream: ReadableStream<Uint8Array>,
  totalBytesExpected?: number,
  onProgress?: (bytesWritten: number, total: number | undefined) => void
): Promise<void> => {
  const dir = await getOrCreateSubdirectory(targetDirHandle, pathSegments);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });

  const reader = readableStream.getReader();
  let bytesWritten = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await (writable as any).write(value);
        bytesWritten += value.byteLength;
        if (onProgress) {
          onProgress(bytesWritten, totalBytesExpected);
        }
      }
    }
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      // ignore
    }
    throw err;
  }
};

// Direct buffer write
export const writeBufferToLocalFile = async (
  targetDirHandle: FileSystemDirectoryHandle,
  pathSegments: string[],
  fileName: string,
  data: Uint8Array | ArrayBuffer | Blob
): Promise<void> => {
  const dir = await getOrCreateSubdirectory(targetDirHandle, pathSegments);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await (writable as any).write(data);
  await writable.close();
};

// Fallback browser download (when File System Access API is not active or user prefers manual download)
export const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
};
