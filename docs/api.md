# ChatCanvas API Documentation

## Edge Functions

### POST /functions/v1/generate-ops

Generates canvas operations from user prompts using AI.

#### Request

**Headers:**
- `Authorization: Bearer <access_token>` (required) - Supabase auth token
- `Content-Type: application/json`

**Body:**
```json
{
  "projectId": "uuid",
  "documentId": "uuid",
  "conversationId": "uuid",
  "prompt": "string",
  "assetsContext": [
    {
      "id": "uuid",
      "url": "string",
      "type": "upload|generate"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| projectId | uuid | Yes | Project ID |
| documentId | uuid | Yes | Document ID |
| conversationId | uuid | Yes | Conversation ID |
| prompt | string | Yes | User's design request |
| assetsContext | array | No | Available assets for the AI to reference |

#### Response

**Success (200):**
```json
{
  "plan": "string - Design approach explanation",
  "ops": [
    {
      "type": "setBackground|addText|addImage|updateLayer|removeLayer",
      "payload": { ... }
    }
  ]
}
```

**Rejection Response (200):**
When the AI cannot comply with the request:
```json
{
  "plan": "unable to comply: <reason>",
  "ops": []
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Missing required fields or invalid JSON |
| 401 | UNAUTHORIZED | Missing authorization header |
| 403 | UNAUTHORIZED | Project not found or access denied |
| 500 | AI_ERROR | AI generation failed |
| 500 | INTERNAL_ERROR | Unexpected server error |

#### Op Types

##### setBackground
```json
{
  "type": "setBackground",
  "payload": {
    "backgroundType": "solid|gradient|image",
    "value": "string|GradientConfig"
  }
}
```

##### addText
```json
{
  "type": "addText",
  "payload": {
    "id": "layer-<uuid>",
    "text": "string",
    "x": 100,
    "y": 100,
    "fontSize": 24,
    "fontFamily": "Inter",
    "fill": "#000000",
    "fontWeight": "normal|bold",
    "textAlign": "left|center|right",
    "width": 500
  }
}
```

##### addImage
```json
{
  "type": "addImage",
  "payload": {
    "id": "layer-<uuid>",
    "src": "https://...",
    "x": 100,
    "y": 100,
    "width": 400,
    "height": 300
  }
}
```

##### updateLayer
```json
{
  "type": "updateLayer",
  "payload": {
    "id": "layer-<uuid>",
    "properties": {
      "left": 200,
      "top": 150
    }
  }
}
```

##### removeLayer
```json
{
  "type": "removeLayer",
  "payload": {
    "id": "layer-<uuid>"
  }
}
```

#### Example Usage

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-ops`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: 'project-uuid',
      documentId: 'document-uuid',
      conversationId: 'conversation-uuid',
      prompt: 'Create a summer sale poster with bold colors',
    }),
  }
);

const { plan, ops } = await response.json();
// Execute ops on canvas
await opsExecutor.execute(ops);
```

---

### POST /functions/v1/generate-image

Generates images from text prompts using AI image generation APIs (e.g., DALL-E).
Uses async job processing - returns immediately with a job ID, then processes in the background.

#### Request

**Headers:**
- `Authorization: Bearer <access_token>` (required) - Supabase auth token
- `Content-Type: application/json`

**Body:**
```json
{
  "projectId": "uuid",
  "documentId": "uuid",
  "prompt": "string",
  "width": 512,
  "height": 512,
  "conversationId": "uuid"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| projectId | uuid | Yes | - | Project ID |
| documentId | uuid | Yes | - | Document ID |
| prompt | string | Yes | - | Image description |
| width | number | No | 512 | Desired image width |
| height | number | No | 512 | Desired image height |
| conversationId | uuid | No | - | Optional conversation ID for linking |

#### Response

**Accepted (202):**
```json
{
  "jobId": "uuid"
}
```

The job ID can be used to track the job status via Realtime subscription or polling.

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Missing required fields or invalid JSON |
| 401 | UNAUTHORIZED | Missing or invalid authorization |
| 403 | UNAUTHORIZED | Project not found or access denied |
| 404 | INVALID_REQUEST | Document not found |
| 500 | INTERNAL_ERROR | Failed to create job |

#### Job Status Flow

Jobs follow this state machine:
```
queued → processing → done
                   ↘ failed
```

**Job Output (when done):**
```json
{
  "assetId": "uuid",
  "storagePath": "userId/projectId/assetId.png",
  "signedUrl": "https://...",
  "layerId": "layer-xxxxxxxx",
  "op": {
    "type": "addImage",
    "payload": {
      "id": "layer-xxxxxxxx",
      "src": "https://...",
      "x": 284,
      "y": 419,
      "width": 512,
      "height": 512
    }
  },
  "revisedPrompt": "string (if provided by AI)"
}
```

**Job Error (when failed):**
```json
{
  "error": "Error message describing what went wrong"
}
```

#### Example Usage

```typescript
// 1. Start image generation
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-image`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: 'project-uuid',
      documentId: 'document-uuid',
      prompt: 'A beautiful sunset over mountains',
      width: 512,
      height: 512,
    }),
  }
);

const { jobId } = await response.json();

// 2. Subscribe to job updates via Realtime
const subscription = supabase
  .channel('job-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'jobs',
      filter: `id=eq.${jobId}`,
    },
    (payload) => {
      const job = payload.new;
      if (job.status === 'done') {
        // Execute the addImage op on canvas
        opsExecutor.execute([job.output.op]);
      } else if (job.status === 'failed') {
        console.error('Image generation failed:', job.error);
      }
    }
  )
  .subscribe();
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| SUPABASE_URL | Yes | - | Supabase project URL |
| SUPABASE_ANON_KEY | Yes | - | Supabase anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | Yes | - | Supabase service role key (for Edge Functions) |
| AI_PROVIDER | No | openai | AI provider (openai, anthropic) |
| AI_API_KEY | Yes | - | AI provider API key |
| AI_MODEL | No | gpt-4o-mini | AI model to use |
| AI_API_URL | No | - | Custom API endpoint (OpenAI compatible) |
| IMAGE_PROVIDER | No | openai | Image generation provider |
| IMAGE_API_KEY | No | AI_API_KEY | Image provider API key (falls back to AI_API_KEY) |
| IMAGE_MODEL | No | dall-e-3 | Image generation model to use |
