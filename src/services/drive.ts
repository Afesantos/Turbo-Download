/**
 * Google Drive API v3 High-Speed Service
 * Handles listing, folder traversal, streaming download, multi-threaded acceleration,
 * and export conversions for Google Workspace native files.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // bytes as string from API
  modifiedTime?: string;
  md5Checksum?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  isFolder: boolean;
  exportFormat?: {
    mimeType: string;
    extension: string;
  };
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// Map Google Docs / Sheets / Slides to export configurations
export const GOOGLE_WORKSPACE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'image/png',
    extension: '.png',
  },
};

export const isGoogleWorkspaceDoc = (mimeType: string): boolean => {
  return mimeType.startsWith('application/vnd.google-apps.') && mimeType !== 'application/vnd.google-apps.folder';
};

/**
 * List files and folders in a specific parent folder or root
 */
export const listDriveFiles = async (
  accessToken: string,
  folderId: string = 'root',
  queryFilter: string = '',
  pageToken?: string,
  pageSize: number = 100
): Promise<DriveListResponse> => {
  let q = `'${folderId}' in parents and trashed = false`;

  if (queryFilter.trim()) {
    q += ` and name contains '${queryFilter.replace(/'/g, "\\'")}'`;
  }

  const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, iconLink, thumbnailLink, parents)';
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('fields', fields);
  url.searchParams.set('orderBy', 'folder,name');
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Erro ao carregar arquivos do Drive (${response.status})`);
  }

  const data = await response.json();
  const files: DriveFile[] = (data.files || []).map((f: any) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const exportConfig = GOOGLE_WORKSPACE_EXPORTS[f.mimeType];
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      modifiedTime: f.modifiedTime,
      md5Checksum: f.md5Checksum,
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      parents: f.parents,
      isFolder,
      exportFormat: exportConfig,
    };
  });

  return {
    files,
    nextPageToken: data.nextPageToken,
  };
};

/**
 * Get details of a single file or folder
 */
export const getDriveFileMeta = async (
  accessToken: string,
  fileId: string
): Promise<DriveFile> => {
  const fields = 'id, name, mimeType, size, modifiedTime, md5Checksum, iconLink, thumbnailLink, parents';
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao obter metadados do arquivo (${response.status})`);
  }

  const f = await response.json();
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    md5Checksum: f.md5Checksum,
    iconLink: f.iconLink,
    thumbnailLink: f.thumbnailLink,
    parents: f.parents,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    exportFormat: GOOGLE_WORKSPACE_EXPORTS[f.mimeType],
  };
};

/**
 * Recursively list all files in a folder hierarchy.
 * Returns file list with relative path segments.
 */
export interface FileWithPath {
  file: DriveFile;
  pathSegments: string[];
}

export const listAllFilesRecursively = async (
  accessToken: string,
  folderId: string,
  currentPath: string[] = []
): Promise<FileWithPath[]> => {
  const result: FileWithPath[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const resp = await listDriveFiles(accessToken, folderId, '', pageToken, 100);
    for (const item of resp.files) {
      if (item.isFolder) {
        const subFiles = await listAllFilesRecursively(
          accessToken,
          item.id,
          [...currentPath, item.name]
        );
        result.push(...subFiles);
      } else {
        result.push({
          file: item,
          pathSegments: currentPath,
        });
      }
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);

  return result;
};

/**
 * Ultra-fast direct streaming download from Google Drive
 * Uses HTTP streaming response with progress tracking.
 */
export const downloadFileStream = async (
  accessToken: string,
  file: DriveFile,
  onProgress?: (bytesDownloaded: number, totalBytes: number | undefined) => void
): Promise<{
  stream: ReadableStream<Uint8Array>;
  totalBytes?: number;
  finalFileName: string;
}> => {
  let downloadUrl: string;
  let finalFileName = file.name;

  if (isGoogleWorkspaceDoc(file.mimeType)) {
    const exportConfig = file.exportFormat || GOOGLE_WORKSPACE_EXPORTS[file.mimeType] || {
      mimeType: 'application/pdf',
      extension: '.pdf',
    };
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportConfig.mimeType)}`;
    if (!finalFileName.endsWith(exportConfig.extension)) {
      finalFileName += exportConfig.extension;
    }
  } else {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  }

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha no download (${response.status}: ${response.statusText})`);
  }

  if (!response.body) {
    throw new Error('Corpo de resposta vazio recebido do Google Drive.');
  }

  const contentLengthHeader = response.headers.get('Content-Length');
  const totalBytes = contentLengthHeader
    ? parseInt(contentLengthHeader, 10)
    : file.size
    ? parseInt(file.size, 10)
    : undefined;

  let downloaded = 0;
  const originalReader = response.body.getReader();

  const monitoredStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await originalReader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value) {
          downloaded += value.byteLength;
          if (onProgress) {
            onProgress(downloaded, totalBytes);
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      originalReader.cancel(reason);
    },
  });

  return {
    stream: monitoredStream,
    totalBytes,
    finalFileName,
  };
};

/**
 * Multi-Range Chunk Accelerated Downloader for large binary files (>16MB)
 * Downloads multiple byte segments concurrently and stitches them,
 * maxing out throughput.
 */
export const downloadLargeFileMultiChunk = async (
  accessToken: string,
  file: DriveFile,
  numChunks: number = 4,
  onProgress?: (bytesDownloaded: number, totalBytes: number) => void
): Promise<{
  blob: Blob;
  finalFileName: string;
}> => {
  const totalBytes = parseInt(file.size || '0', 10);
  if (!totalBytes || totalBytes < 16 * 1024 * 1024 || isGoogleWorkspaceDoc(file.mimeType)) {
    // Fall back to direct stream
    const { stream, finalFileName } = await downloadFileStream(accessToken, file, (b, t) => {
      if (onProgress && t) onProgress(b, t);
    });
    const response = new Response(stream);
    const blob = await response.blob();
    return { blob, finalFileName };
  }

  const chunkSize = Math.ceil(totalBytes / numChunks);
  const chunkRanges: { start: number; end: number }[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize - 1, totalBytes - 1);
    chunkRanges.push({ start, end });
  }

  let totalDownloaded = 0;
  const chunkProgress = new Array(numChunks).fill(0);

  const downloadPromises = chunkRanges.map(async (range, index) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Range: `bytes=${range.start}-${range.end}`,
      },
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(`Falha no chunk range ${range.start}-${range.end}: status ${res.status}`);
    }

    if (!res.body) {
      throw new Error('Sem corpo no chunk');
    }

    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        parts.push(value);
        chunkProgress[index] += value.byteLength;
        totalDownloaded = chunkProgress.reduce((a, b) => a + b, 0);
        if (onProgress) {
          onProgress(totalDownloaded, totalBytes);
        }
      }
    }

    return new Blob(parts as BlobPart[]);
  });

  const downloadedBlobs = await Promise.all(downloadPromises);
  const finalBlob = new Blob(downloadedBlobs, { type: file.mimeType });

  return {
    blob: finalBlob,
    finalFileName: file.name,
  };
};
