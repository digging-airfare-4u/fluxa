import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { AuthError, ValidationError, errorToResponse, AssetError } from '../_shared/errors/index.ts';
import { AssetService } from '../_shared/services/asset.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_UPLOAD_BYTES = Number(Deno.env.get('DRAG_DROP_UPLOAD_MAX_BYTES') || 20 * 1024 * 1024);

function parseFormData(formData: FormData): { projectId: string; documentId?: string; file: File } {
  const projectId = String(formData.get('projectId') || '').trim();
  const rawDocumentId = formData.get('documentId');
  const documentId = typeof rawDocumentId === 'string' && rawDocumentId.trim() ? rawDocumentId.trim() : undefined;
  const file = formData.get('file');

  if (!projectId || !(file instanceof File)) {
    throw new ValidationError('projectId and file are required');
  }

  return { projectId, documentId, file };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', ['Only POST method is supported']);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthError('Missing authorization header', 'MISSING_AUTH');
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new ValidationError('Invalid multipart form data');
    }

    const { projectId, documentId, file } = parseFormData(formData);

    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError('Unsupported file type', ['UNSUPPORTED_MIME_TYPE']);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ValidationError('File exceeds max upload size', ['PAYLOAD_TOO_LARGE']);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthError('Invalid authorization', 'INVALID_AUTH');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new AuthError('Project not found or access denied', 'PROJECT_ACCESS_DENIED', 403);
    }

    const imageData = await file.arrayBuffer();
    const assetService = new AssetService(supabaseService, supabaseUrl);
    const asset = await assetService.uploadUserAsset(user.id, projectId, imageData, mimeType, { documentId });

    return new Response(
      JSON.stringify({
        assetId: asset.id,
        storagePath: asset.storagePath,
        url: asset.publicUrl,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        dimensions: asset.dimensions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      const fieldErrors = error.fieldErrors || [];
      if (fieldErrors.includes('UNSUPPORTED_MIME_TYPE')) {
        return new Response(
          JSON.stringify({ error: { code: 'UNSUPPORTED_MIME_TYPE', message: error.message } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (fieldErrors.includes('PAYLOAD_TOO_LARGE')) {
        return new Response(
          JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: error.message } }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: error.message } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (error instanceof AuthError) {
      const isForbidden = error.code === 'PROJECT_ACCESS_DENIED';
      return new Response(
        JSON.stringify({
          error: {
            code: isForbidden ? 'FORBIDDEN' : 'UNAUTHORIZED',
            message: error.message,
          },
        }),
        {
          status: isForbidden ? 403 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (error instanceof AssetError) {
      return new Response(
        JSON.stringify({ error: { code: 'UPLOAD_FAILED', message: error.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return errorToResponse(error, corsHeaders);
  }
});
