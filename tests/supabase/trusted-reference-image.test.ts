import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../supabase/functions/_shared/errors/index.ts';
import { validateTrustedProjectReferenceImageUrl } from '../../supabase/functions/_shared/utils/trusted-reference-image.ts';

function createServiceClient(rows: Array<{ storage_path: string }> = [], error: unknown = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(async () => ({ data: rows, error })),
  };

  return {
    from: vi.fn(() => chain),
  };
}

describe('validateTrustedProjectReferenceImageUrl', () => {
  it('allows trusted COS origins without querying assets', async () => {
    const serviceClient = createServiceClient();

    await expect(
      validateTrustedProjectReferenceImageUrl(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient as any,
        'project-1',
        'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/path/to/ref.png',
      ),
    ).resolves.toBeUndefined();

    expect(serviceClient.from).not.toHaveBeenCalled();
  });

  it('allows project-owned asset URLs resolved from storage_path', async () => {
    const serviceClient = createServiceClient([
      { storage_path: 'user-1/project-1/ref.png' },
    ]);

    await expect(
      validateTrustedProjectReferenceImageUrl(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient as any,
        'project-1',
        'https://fluxa-1390058464.cos.ap-tokyo.myqcloud.com/user-1/project-1/ref.png',
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects untrusted external reference image URLs', async () => {
    const serviceClient = createServiceClient([]);

    await expect(
      validateTrustedProjectReferenceImageUrl(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient as any,
        'project-1',
        'https://example.com/not-trusted.png',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
