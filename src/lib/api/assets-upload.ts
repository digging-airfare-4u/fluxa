import { supabase } from '@/lib/supabase/client';

export interface UploadAssetParams {
  projectId: string;
  documentId?: string;
  file: File;
}

export interface UploadAssetResult {
  assetId: string;
  storagePath: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export async function uploadDroppedAsset({ projectId, documentId, file }: UploadAssetParams): Promise<UploadAssetResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Authentication required');
  }

  const accessToken = session.access_token;
  const formData = new FormData();
  formData.append('projectId', projectId);
  if (documentId) {
    formData.append('documentId', documentId);
  }
  formData.append('file', file);

  const response = await fetch('/api/assets/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Upload failed';
    throw new Error(message);
  }

  return data as UploadAssetResult;
}
