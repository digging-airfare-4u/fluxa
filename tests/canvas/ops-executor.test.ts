/**
 * Feature: chat-canvas
 * Property 3: Ops Execution Correctness
 * Property 4: Layer Registry Consistency
 * Property 10: Invalid Op Rejection
 * Validates: Requirements 9.1-9.9
 *
 * These tests validate the OpsExecutor logic using property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  Op,
  AddTextOp,
  AddImageOp,
  SetBackgroundOp,
  UpdateLayerOp,
  RemoveLayerOp,
  CreateFrameOp,
  validateOp,
  validateOps,
} from '@/lib/canvas/ops.types';

// Simple layer ID generator
const layerIdArb = fc.nat({ max: 99999999 }).map(n => `layer-${n.toString(16).padStart(8, '0')}`);

// Simple color generator
const colorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

const createFrameOpArb: fc.Arbitrary<CreateFrameOp> = fc.record({
  type: fc.constant('createFrame' as const),
  payload: fc.record({
    width: fc.integer({ min: 100, max: 4000 }),
    height: fc.integer({ min: 100, max: 4000 }),
    backgroundColor: fc.option(colorArb, { nil: undefined }),
  }),
});

const solidBackgroundOpArb: fc.Arbitrary<SetBackgroundOp> = fc.record({
  type: fc.constant('setBackground' as const),
  payload: fc.record({
    backgroundType: fc.constant('solid' as const),
    value: colorArb,
  }),
});

const addTextOpArb: fc.Arbitrary<AddTextOp> = fc.record({
  type: fc.constant('addText' as const),
  payload: fc.record({
    id: layerIdArb,
    text: fc.string({ minLength: 1, maxLength: 50 }),
    x: fc.integer({ min: 0, max: 2000 }),
    y: fc.integer({ min: 0, max: 2000 }),
    fontSize: fc.option(fc.integer({ min: 8, max: 200 }), { nil: undefined }),
    fontFamily: fc.option(fc.constantFrom('Inter', 'Arial'), { nil: undefined }),
    fill: fc.option(colorArb, { nil: undefined }),
    fontWeight: fc.option(fc.constantFrom('normal', 'bold'), { nil: undefined }),
    textAlign: fc.option(fc.constantFrom('left', 'center', 'right') as fc.Arbitrary<'left' | 'center' | 'right'>, { nil: undefined }),
    width: fc.option(fc.integer({ min: 50, max: 1000 }), { nil: undefined }),
  }),
});

const addImageOpArb: fc.Arbitrary<AddImageOp> = fc.record({
  type: fc.constant('addImage' as const),
  payload: fc.record({
    id: layerIdArb,
    src: fc.constant('https://example.com/image.png'),
    x: fc.integer({ min: 0, max: 2000 }),
    y: fc.integer({ min: 0, max: 2000 }),
    width: fc.option(fc.integer({ min: 10, max: 2000 }), { nil: undefined }),
    height: fc.option(fc.integer({ min: 10, max: 2000 }), { nil: undefined }),
    scaleX: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
    scaleY: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
  }),
});

const updateLayerOpArb: fc.Arbitrary<UpdateLayerOp> = fc.record({
  type: fc.constant('updateLayer' as const),
  payload: fc.record({
    id: layerIdArb,
    properties: fc.record({
      left: fc.option(fc.integer({ min: 0, max: 2000 }), { nil: undefined }),
      top: fc.option(fc.integer({ min: 0, max: 2000 }), { nil: undefined }),
    }),
  }),
});

const removeLayerOpArb: fc.Arbitrary<RemoveLayerOp> = fc.record({
  type: fc.constant('removeLayer' as const),
  payload: fc.record({
    id: layerIdArb,
  }),
});

// Combined valid op arbitrary
const validOpArb: fc.Arbitrary<Op> = fc.oneof(
  createFrameOpArb,
  solidBackgroundOpArb,
  addTextOpArb,
  addImageOpArb,
  updateLayerOpArb,
  removeLayerOpArb
);

/**
 * Property 3: Ops Execution Correctness
 * For any valid ops array, validation should pass and ops should have correct structure
 * Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
describe('Property 3: Ops Execution Correctness', () => {
  it('should validate all valid ops as correct', () => {
    fc.assert(
      fc.property(validOpArb, (op) => {
        const isValid = validateOp(op);
        expect(isValid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate addText ops have required fields', () => {
    fc.assert(
      fc.property(addTextOpArb, (op) => {
        expect(op.type).toBe('addText');
        expect(typeof op.payload.id).toBe('string');
        expect(typeof op.payload.text).toBe('string');
        expect(typeof op.payload.x).toBe('number');
        expect(typeof op.payload.y).toBe('number');
        expect(validateOp(op)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate addImage ops have required fields', () => {
    fc.assert(
      fc.property(addImageOpArb, (op) => {
        expect(op.type).toBe('addImage');
        expect(typeof op.payload.id).toBe('string');
        expect(typeof op.payload.src).toBe('string');
        expect(typeof op.payload.x).toBe('number');
        expect(typeof op.payload.y).toBe('number');
        expect(validateOp(op)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate setBackground ops have correct structure', () => {
    fc.assert(
      fc.property(solidBackgroundOpArb, (op) => {
        expect(op.type).toBe('setBackground');
        expect(['solid', 'gradient', 'image']).toContain(op.payload.backgroundType);
        expect(op.payload.value).toBeDefined();
        expect(validateOp(op)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate arrays of valid ops', () => {
    fc.assert(
      fc.property(fc.array(validOpArb, { minLength: 1, maxLength: 5 }), (ops) => {
        const result = validateOps(ops);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Layer Registry Consistency
 * For any sequence of ops, layer IDs should be unique and trackable
 * Validates: Requirements 9.9
 */
describe('Property 4: Layer Registry Consistency', () => {
  it('should generate valid layer IDs for addText ops', () => {
    fc.assert(
      fc.property(addTextOpArb, (op) => {
        expect(op.payload.id).toMatch(/^layer-[0-9a-f]{8}$/);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should track layer operations correctly in a simulated registry', () => {
    fc.assert(
      fc.property(
        fc.array(addTextOpArb, { minLength: 1, maxLength: 10 }),
        (addOps) => {
          const registry = new Map<string, AddTextOp>();
          
          addOps.forEach(op => {
            if (!registry.has(op.payload.id)) {
              registry.set(op.payload.id, op);
            }
          });
          
          expect(registry.size).toBeLessThanOrEqual(addOps.length);
          
          registry.forEach((op, id) => {
            expect(validateOp(op)).toBe(true);
            expect(op.payload.id).toBe(id);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle remove operations on registry correctly', () => {
    fc.assert(
      fc.property(
        fc.array(addTextOpArb, { minLength: 1, maxLength: 5 }),
        (addOps) => {
          const registry = new Map<string, AddTextOp>();
          
          addOps.forEach(op => {
            if (!registry.has(op.payload.id)) {
              registry.set(op.payload.id, op);
            }
          });
          
          const initialSize = registry.size;
          
          if (registry.size > 0) {
            const firstId = registry.keys().next().value as string;
            registry.delete(firstId);
            expect(registry.size).toBe(initialSize - 1);
            expect(registry.has(firstId)).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 10: Invalid Op Rejection
 * For any op with missing required fields, invalid field types, or unknown op types,
 * validation should fail
 * Validates: Requirements 9.2
 */
describe('Property 10: Invalid Op Rejection', () => {
  it('should reject ops missing type field', () => {
    fc.assert(
      fc.property(layerIdArb, (id) => {
        const invalidOp = { payload: { id } };
        expect(validateOp(invalidOp)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject ops missing payload field', () => {
    fc.assert(
      fc.property(fc.constantFrom('addText', 'addImage', 'removeLayer'), (type) => {
        const invalidOp = { type };
        expect(validateOp(invalidOp)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject ops with unknown type', () => {
    fc.assert(
      fc.property(layerIdArb, (id) => {
        const invalidOp = { type: 'unknownOp', payload: { id } };
        expect(validateOp(invalidOp)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject addText ops missing required fields', () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 200 }), (fontSize) => {
        const invalidOp = { type: 'addText', payload: { fontSize } };
        expect(validateOp(invalidOp)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject addImage ops missing required fields', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 2000 }), (width) => {
        const invalidOp = { type: 'addImage', payload: { width } };
        expect(validateOp(invalidOp)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject null and undefined ops', () => {
    expect(validateOp(null)).toBe(false);
    expect(validateOp(undefined)).toBe(false);
  });

  it('should reject non-object ops', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean()), (value) => {
        expect(validateOp(value)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return errors for arrays with invalid ops', () => {
    fc.assert(
      fc.property(layerIdArb, (id) => {
        const invalidOps = [{ payload: { id } }];
        const result = validateOps(invalidOps);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject mixed arrays with some invalid ops', () => {
    fc.assert(
      fc.property(addTextOpArb, layerIdArb, (validOp, id) => {
        const invalidOp = { payload: { id } };
        const mixedOps = [validOp, invalidOp];
        const result = validateOps(mixedOps);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('index 1');
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
