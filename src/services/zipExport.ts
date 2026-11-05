import JSZip from 'jszip';
import { DriveFile, downloadFileStream, isGoogleWorkspaceDoc, listAllFilesRecursively } from './drive';
import { triggerBrowserDownload, writeBufferToLocalFile } from './localFileSystem';

export const exportSelectedFilesToZip = async (
  accessToken: string,
  files: DriveFile[],
  targetDirHandle: FileSystemDirectoryHandle | null,
  onProgress?: (percent: number, currentItem: string) => void
): Promise<void> => {
  const zip = new JSZip();
  let totalItems = 0;
  let processedItems = 0;

  // Flatten folders if any
  const allDownloadItems: { file: DriveFile; path: string }[] = [];

  for (const item of files) {
    if (item.isFolder) {
      const recursive = await listAllFilesRecursively(accessToken, item.id, [item.name]);
      for (const rec of recursive) {
        allDownloadItems.push({
          file: rec.file,
          path: rec.pathSegments.join('/') + '/',
        });
      }
    } else {
      allDownloadItems.push({
        file: item,
        path: '',
      });
    }
  }

  totalItems = allDownloadItems.length;

  for (const item of allDownloadItems) {
    if (onProgress) {
      onProgress(Math.round((processedItems / Math.max(1, totalItems)) * 100), item.file.name);
    }

    try {
      const { stream, finalFileName } = await downloadFileStream(accessToken, item.file);
      const res = new Response(stream);
      const blob = await res.blob();
      const zipPath = item.path ? `${item.path}${finalFileName}` : finalFileName;
      zip.file(zipPath, blob);
    } catch (err) {
      console.warn(`Erro ao adicionar ${item.file.name} ao ZIP:`, err);
    }
    processedItems++;
  }

  if (onProgress) {
    onProgress(95, 'Comprimindo arquivo final ZIP...');
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipName = `DriveSync_${new Date().toISOString().slice(0, 10)}.zip`;

  if (targetDirHandle) {
    await writeBufferToLocalFile(targetDirHandle, [], zipName, zipBlob);
  } else {
    triggerBrowserDownload(zipBlob, zipName);
  }

  if (onProgress) {
    onProgress(100, 'Concluído!');
  }
};
