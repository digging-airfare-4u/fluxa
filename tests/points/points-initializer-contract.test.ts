import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('points initializer contract', () => {
  it('separates initial fetch from realtime subscription so store initialization does not resubscribe', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/app/layout.tsx'),
      'utf8',
    );

    expect(source).toContain('const fetchedPointsUserIdRef = useRef<string | null>(null);');
    expect(source).toContain('if (fetchedPointsUserIdRef.current === userId) return;');
    expect(source).toContain('fetchedPointsUserIdRef.current = userId;');
    expect(source).toContain('}, [userId, fetchPoints]);');
    expect(source).toContain('const unsubscribe = subscribeToChanges(userId);');
    expect(source).toContain('}, [userId, subscribeToChanges]);');
    expect(source).not.toContain('}, [userId, fetchPoints, subscribeToChanges, isInitialized]);');
  });
});
