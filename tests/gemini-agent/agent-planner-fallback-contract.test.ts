import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent planner fallback contract', () => {
  it('only uses planner json fallback for structured-output parse failures, not provider overloads', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/agent/index.ts'),
      'utf8',
    );

    expect(source).toContain('isStructuredOutputFallbackEligible(error)');
    expect(source).toContain('if (!isStructuredOutputFallbackEligible(error))');
    expect(source).toContain("summary: 'Direct response (planner fallback)'");
  });
});
