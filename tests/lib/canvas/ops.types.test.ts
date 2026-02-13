/**
 * Feature: canvas-ops-validation
 * Property 8: Validate operation schema contract
 * Validates: Requirements 8.1-8.6
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { validateOp, validateOps } from '@/lib/canvas/ops.types';

const layerIdArb = fc
  .nat({ max: 99999999 })
  .map((n) => `layer-${n.toString(16).padStart(8, '0')}`);

describe('validateOp', () => {
  it('should accept valid addText operations (property-based)', () => {
    fc.assert(
      fc.property(
        layerIdArb,
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.integer({ min: 0, max: 4096 }),
        fc.integer({ min: 0, max: 4096 }),
        (id, text, x, y) => {
          const op = {
            type: 'addText',
            payload: {
              id,
              text,
              x,
              y,
            },
          };

          expect(validateOp(op)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject operations with unknown type', () => {
    const op = {
      type: 'unknown-op',
      payload: {
        id: 'layer-12345678',
      },
    };

    expect(validateOp(op)).toBe(false);
  });
});

describe('validateOps', () => {
  it('should return errors for invalid entries and expose indexes', () => {
    const result = validateOps([
      {
        type: 'addText',
        payload: { id: 'layer-12345678', text: 'ok', x: 100, y: 200 },
      },
      {
        type: 'addImage',
        payload: { id: 'layer-87654321', src: 123, x: 20, y: 40 },
      },
      {
        type: 'removeLayer',
        payload: { id: 'layer-abcdef12' },
      },
    ] as unknown[]);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Invalid op at index 1']);
  });
});
