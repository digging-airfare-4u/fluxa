/**
 * Provider Configs API Client
 * Frontend service layer for shared provider configuration CRUD
 * Requirements: 2.4-2.6, 6.5
 */

// ============================================================================
// Types
// ============================================================================

/** User model identifier format: `user:{configId}` */
export type UserModelIdentifier = `user:${string}`;

/** Model value passed to generation APIs — system model_name or user:{configId} */
export type ModelValue = string | UserModelIdentifier;

/** Provider types supported for user configuration */
export type ProviderType = 'volcengine' | 'openai-compatible' | 'anthropic-compatible';
export type ProviderModelType = 'image' | 'chat';

/** Input for creating or updating a provider config */
export interface ProviderConfigInput {
  provider: ProviderType;
  apiKey?: string;
  apiUrl: string;
  modelName: string;
  displayName: string;
  modelType?: ProviderModelType;
}

/** User provider config as returned by the API (masked key, no plaintext) */
export interface UserProviderConfig {
  id: string;
  user_id: string;
  provider: string;
  api_url: string;
  model_name: string;
  display_name: string;
  model_type?: ProviderModelType;
  is_enabled: boolean;
  api_key_masked: string;
  model_identifier: UserModelIdentifier;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfigsContext {
  data: UserProviderConfig[];
  canManage: boolean;
}

/** Test provider request params */
export interface TestProviderParams {
  provider: ProviderType;
  apiUrl: string;
  apiKey?: string;
  modelName: string;
  configId?: string;
}

/** Structured API error from provider-configs routes */
export interface ProviderConfigApiError {
  code: string;
  message: string;
}

export class ProviderConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}


// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a JSON error body from a Response, returning a typed error.
 */
async function parseErrorResponse(
  res: Response,
): Promise<ProviderConfigError> {
  try {
    const body = await res.json();
    const err = body?.error as ProviderConfigApiError | undefined;
    return new ProviderConfigError(
      err?.message || `Request failed (${res.status})`,
      err?.code || 'UNKNOWN',
      res.status,
    );
  } catch {
    return new ProviderConfigError(
      `Request failed (${res.status})`,
      'UNKNOWN',
      res.status,
    );
  }
}

/**
 * Resolve a valid access token from the current browser session.
 */
async function getAccessToken(): Promise<string> {
  const { supabase } = await import('@/lib/supabase/client');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new ProviderConfigError(
      'Authentication required',
      'AUTH_REQUIRED',
      401,
    );
  }

  if (session?.access_token) {
    return session.access_token;
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshData.session?.access_token) {
    throw new ProviderConfigError(
      'Authentication required',
      'AUTH_REQUIRED',
      401,
    );
  }

  return refreshData.session.access_token;
}

/**
 * Call authenticated provider-config routes with the current user's access token.
 */
async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch provider configs plus current user's management capability.
 * Requirements: 2.4
 */
export async function fetchProviderConfigsContext(): Promise<ProviderConfigsContext> {
  const res = await authorizedFetch('/api/provider-configs', { method: 'GET' });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  return {
    data: body.data as UserProviderConfig[],
    canManage: body.canManage === true,
  };
}

/**
 * Fetch the provider configs visible to the current user (masked keys).
 * Requirements: 2.4
 */
export async function fetchUserProviderConfigs(): Promise<UserProviderConfig[]> {
  const context = await fetchProviderConfigsContext();
  return context.data;
}

/**
 * Create a new provider config.
 * Requirements: 2.4, 2.6
 */
export async function createProviderConfig(
  input: ProviderConfigInput,
): Promise<UserProviderConfig> {
  const res = await authorizedFetch('/api/provider-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: input.provider,
      apiKey: input.apiKey,
      apiUrl: input.apiUrl,
      modelName: input.modelName,
      displayName: input.displayName,
      modelType: input.modelType,
    }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  return body.data as UserProviderConfig;
}

/**
 * Update an existing provider config by ID.
 * Requirements: 2.5
 */
export async function updateProviderConfig(
  id: string,
  input: Partial<ProviderConfigInput>,
): Promise<UserProviderConfig> {
  const res = await authorizedFetch(`/api/provider-configs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: input.apiKey,
      apiUrl: input.apiUrl,
      modelName: input.modelName,
      displayName: input.displayName,
      modelType: input.modelType,
    }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  return body.data as UserProviderConfig;
}

/**
 * Toggle a provider config's enabled state.
 * Requirements: 7.2, 7.3
 */
export async function updateProviderEnabled(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  const res = await authorizedFetch(`/api/provider-configs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isEnabled }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
}

/**
 * Delete a provider config and its stored credentials.
 * Requirements: 7.5
 */
export async function deleteProviderConfig(id: string): Promise<void> {
  const res = await authorizedFetch(`/api/provider-configs/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseErrorResponse(res);
}

/**
 * Test provider connectivity before saving.
 * Requirements: 4.3-4.5, 4.8
 */
export async function testProviderConnection(
  params: TestProviderParams,
): Promise<{ success: boolean; error?: ProviderConfigApiError }> {
  const res = await authorizedFetch('/api/test-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: params.provider,
      apiUrl: params.apiUrl,
      apiKey: params.apiKey,
      modelName: params.modelName,
      configId: params.configId,
    }),
  });
  const body = await res.json();
  return {
    success: body.success === true,
    error: body.error as ProviderConfigApiError | undefined,
  };
}

// ============================================================================
// Model Defaults
// ============================================================================

/** Model default keys managed via system_settings */
export type ModelDefaultKey = 'default_chat_model' | 'default_image_model' | 'agent_default_brain_model';

export type ModelDefaults = Record<ModelDefaultKey, string | null>;

/**
 * Fetch current model defaults from system_settings.
 * Returns null for any unset key.
 */
export async function fetchModelDefaults(): Promise<ModelDefaults> {
  const res = await authorizedFetch('/api/system-settings/model-defaults', {
    method: 'GET',
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return res.json();
}

/**
 * Update model defaults (partial — only provided keys are changed).
 * Pass null to reset a key to system default.
 */
export async function updateModelDefaults(
  updates: Partial<Record<ModelDefaultKey, string | null>>,
): Promise<void> {
  const res = await authorizedFetch('/api/system-settings/model-defaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw await parseErrorResponse(res);
}
