/**
 * Feature: chat-canvas
 * Property 2: Ops Schema Validation Round-Trip
 * Validates: Requirements 8.7, 12.6, 16.5, 16.6
 *
 * For any valid ops JSON that conforms to the schema, serializing to string
 * and parsing back SHALL produce an equivalent object that passes validation.
 * For any invalid ops JSON, validation SHALL return errors and reject the input.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateOpsResponse,
  validateSingleOp,
  validateOpsArray,
  isValidLayerId,
  isValidHexColor,
  generateLayerId,
  isValidResult,
  getErrorSummary,
  type ValidationResult,
} from '@/ai/schema/validate';
import type {
  Op,
  AddTextOp,
  AddImageOp,
  SetBackgroundOp,
  UpdateLayerOp,
  RemoveLayerOp,
  CreateFrameOp,
  GenerateOpsResponse,
  GradientConfig,
} from '@/lib/canvas/ops.types';

// ============================================================================
// Arbitraries for generating valid ops
// ============================================================================

// Valid layer ID generator (format: layer-<alphanumeric>)
const validLayerIdArb = fc.nat({ max: 99999999 }).map(n => `layer-${n.toString(16).padStart(8, '0')}`);

// Valid hex color generator
const validHexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => 
  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
);

// Valid plan string generator
const validPlanArb = fc.string({ minLength: 1, maxLength: 500 });

// CreateFrame op arbitrary
const createFrameOpArb: fc.Arbitrary<CreateFrameOp> = fc.record({
  type: fc.constant('createFrame' as const),
  payload: fc.record({
    width: fc.integer({ min: 1, max: 4096 }),
    height: fc.integer({ min: 1, max: 4096 }),
    backgroundColor: fc.option(validHexColorArb, { nil: undefined }),
  }),
});

// SetBackground (solid) op arbitrary
const solidBackgroundOpArb: fc.Arbitrary<SetBackgroundOp> = fc.record({
  type: fc.constant('setBackground' as const),
  payload: fc.record({
    backgroundType: fc.constant('solid' as const),
    value: validHexColorArb,
  }),
});

// SetBackground (gradient) op arbitrary
const gradientConfigArb: fc.Arbitrary<GradientConfig> = fc.record({
  type: fc.constantFrom('linear', 'radial') as fc.Arbitrary<'linear' | 'radial'>,
  colorStops: fc.array(
    fc.record({
      offset: fc.double({ min: 0, max: 1, noNaN: true }),
      color: validHexColorArb,
    }),
    { minLength: 2, maxLength: 5 }
  ),
  coords: fc.option(
    fc.record({
      x1: fc.integer({ min: 0, max: 1000 }),
      y1: fc.integer({ min: 0, max: 1000 }),
      x2: fc.integer({ min: 0, max: 1000 }),
      y2: fc.integer({ min: 0, max: 1000 }),
    }),
    { nil: undefined }
  ),
});

const gradientBackgroundOpArb: fc.Arbitrary<SetBackgroundOp> = fc.record({
  type: fc.constant('setBackground' as const),
  payload: fc.record({
    backgroundType: fc.constant('gradient' as const),
    value: gradientConfigArb,
  }),
});

// AddText op arbitrary
const addTextOpArb: fc.Arbitrary<AddTextOp> = fc.record({
  type: fc.constant('addText' as const),
  payload: fc.record({
    id: validLayerIdArb,
    text: fc.string({ minLength: 1, maxLength: 200 }),
    x: fc.integer({ min: 0, max: 4096 }),
    y: fc.integer({ min: 0, max: 4096 }),
    fontSize: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
    fontFamily: fc.option(fc.constantFrom('Inter', 'Arial', 'Helvetica'), { nil: undefined }),
    fill: fc.option(validHexColorArb, { nil: undefined }),
    fontWeight: fc.option(
      fc.constantFrom('normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'),
      { nil: undefined }
    ),
    textAlign: fc.option(
      fc.constantFrom('left', 'center', 'right') as fc.Arbitrary<'left' | 'center' | 'right'>,
      { nil: undefined }
    ),
    width: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
  }),
});

// AddImage op arbitrary
const addImageOpArb: fc.Arbitrary<AddImageOp> = fc.record({
  type: fc.constant('addImage' as const),
  payload: fc.record({
    id: validLayerIdArb,
    src: fc.constantFrom(
      'https://example.com/image.png',
      'https://storage.example.com/assets/123.jpg',
      '/assets/local-image.webp'
    ),
    x: fc.integer({ min: 0, max: 4096 }),
    y: fc.integer({ min: 0, max: 4096 }),
    width: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
    height: fc.option(fc.integer({ min: 1, max: 4096 }), { nil: undefined }),
    scaleX: fc.option(fc.double({ min: 0.01, max: 100, noNaN: true }), { nil: undefined }),
    scaleY: fc.option(fc.double({ min: 0.01, max: 100, noNaN: true }), { nil: undefined }),
  }),
});

// UpdateLayer op arbitrary
const updateLayerOpArb: fc.Arbitrary<UpdateLayerOp> = fc.record({
  type: fc.constant('updateLayer' as const),
  payload: fc.record({
    id: validLayerIdArb,
    properties: fc.record({
      left: fc.option(fc.integer({ min: 0, max: 4096 }), { nil: undefined }),
      top: fc.option(fc.integer({ min: 0, max: 4096 }), { nil: undefined }),
      opacity: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    }),
  }),
});

// RemoveLayer op arbitrary
const removeLayerOpArb: fc.Arbitrary<RemoveLayerOp> = fc.record({
  type: fc.constant('removeLayer' as const),
  payload: fc.record({
    id: validLayerIdArb,
  }),
});

// Combined valid op arbitrary
const validOpArb: fc.Arbitrary<Op> = fc.oneof(
  createFrameOpArb,
  solidBackgroundOpArb,
  gradientBackgroundOpArb,
  addTextOpArb,
  addImageOpArb,
  updateLayerOpArb,
  removeLayerOpArb
);

// Valid GenerateOpsResponse arbitrary
const validOpsResponseArb: fc.Arbitrary<GenerateOpsResponse> = fc.record({
  plan: validPlanArb,
  ops: fc.array(validOpArb, { minLength: 0, maxLength: 10 }),
});

// ============================================================================
// Arbitraries for generating invalid ops
// ============================================================================

// Invalid layer ID (doesn't match pattern)
const invalidLayerIdArb = fc.oneof(
  fc.constant('invalid-id'),
  fc.constant('layer_123'),
  fc.constant('LAYER-abc'),
  fc.constant(''),
  fc.nat().map(n => n.toString())
);

// Invalid op type
const invalidOpTypeArb = fc.constantFrom(
  'unknownOp',
  'deleteLayer',
  'moveLayer',
  'ADDTEXT',
  ''
);

// Op missing required fields
const opMissingFieldsArb = fc.oneof(
  // addText missing id
  fc.record({
    type: fc.constant('addText'),
    payload: fc.record({
      text: fc.string(),
      x: fc.integer(),
      y: fc.integer(),
    }),
  }),
  // addText missing text
  fc.record({
    type: fc.constant('addText'),
    payload: fc.record({
      id: validLayerIdArb,
      x: fc.integer(),
      y: fc.integer(),
    }),
  }),
  // addImage missing src
  fc.record({
    type: fc.constant('addImage'),
    payload: fc.record({
      id: validLayerIdArb,
      x: fc.integer(),
      y: fc.integer(),
    }),
  }),
  // setBackground missing value
  fc.record({
    type: fc.constant('setBackground'),
    payload: fc.record({
      backgroundType: fc.constant('solid'),
    }),
  })
);

// Op with invalid field types
const opInvalidTypesArb = fc.oneof(
  // addText with non-string text
  fc.record({
    type: fc.constant('addText'),
    payload: fc.record({
      id: validLayerIdArb,
      text: fc.integer(), // should be string
      x: fc.integer(),
      y: fc.integer(),
    }),
  }),
  // addText with non-number x
  fc.record({
    type: fc.constant('addText'),
    payload: fc.record({
      id: validLayerIdArb,
      text: fc.string(),
      x: fc.string(), // should be number
      y: fc.integer(),
    }),
  }),
  // createFrame with string dimensions
  fc.record({
    type: fc.constant('createFrame'),
    payload: fc.record({
      width: fc.string(), // should be number
      height: fc.integer(),
    }),
  })
);

// ============================================================================
// Property 2: Ops Schema Validation Round-Trip Tests
// ============================================================================

describe('Property 2: Ops Schema Validation Round-Trip', () => {
  /**
   * For any valid ops JSON, serializing to string and parsing back
   * SHALL produce an equivalent object that passes validation.
   */
  describe('Valid ops round-trip', () => {
    it('should validate and round-trip valid GenerateOpsResponse', () => {
      fc.assert(
        fc.property(validOpsResponseArb, (response) => {
          // Serialize to JSON string
          const jsonString = JSON.stringify(response);
          
          // Parse back
          const parsed = JSON.parse(jsonString);
          
          // Validate the parsed result
          const result = validateOpsResponse(parsed);
          
          expect(result.valid).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.data?.plan).toBe(response.plan);
          expect(result.data?.ops.length).toBe(response.ops.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should validate and round-trip individual valid ops', () => {
      fc.assert(
        fc.property(validOpArb, (op) => {
          // Serialize to JSON string
          const jsonString = JSON.stringify(op);
          
          // Parse back
          const parsed = JSON.parse(jsonString);
          
          // Validate the parsed result
          const result = validateSingleOp(parsed);
          
          expect(result.valid).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.data?.type).toBe(op.type);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should validate and round-trip ops arrays', () => {
      fc.assert(
        fc.property(fc.array(validOpArb, { minLength: 1, maxLength: 10 }), (ops) => {
          // Serialize to JSON string
          const jsonString = JSON.stringify(ops);
          
          // Parse back
          const parsed = JSON.parse(jsonString);
          
          // Validate the parsed result
          const result = validateOpsArray(parsed);
          
          expect(result.valid).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.data?.length).toBe(ops.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve all op properties through round-trip', () => {
      fc.assert(
        fc.property(addTextOpArb, (op) => {
          const jsonString = JSON.stringify(op);
          const parsed = JSON.parse(jsonString);
          const result = validateSingleOp(parsed);
          
          expect(result.valid).toBe(true);
          if (result.valid && result.data) {
            const data = result.data as AddTextOp;
            expect(data.payload.id).toBe(op.payload.id);
            expect(data.payload.text).toBe(op.payload.text);
            expect(data.payload.x).toBe(op.payload.x);
            expect(data.payload.y).toBe(op.payload.y);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any invalid ops JSON, validation SHALL return errors and reject the input.
   */
  describe('Invalid ops rejection', () => {
    it('should reject ops with unknown type', () => {
      fc.assert(
        fc.property(invalidOpTypeArb, validLayerIdArb, (type, id) => {
          const invalidOp = { type, payload: { id } };
          const result = validateSingleOp(invalidOp);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject ops missing required fields', () => {
      fc.assert(
        fc.property(opMissingFieldsArb, (invalidOp) => {
          const result = validateSingleOp(invalidOp);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject ops with invalid field types', () => {
      fc.assert(
        fc.property(opInvalidTypesArb, (invalidOp) => {
          const result = validateSingleOp(invalidOp);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject non-object data', () => {
      fc.assert(
        fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), (data) => {
          const result = validateOpsResponse(data);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject response missing plan field', () => {
      fc.assert(
        fc.property(fc.array(validOpArb, { minLength: 0, maxLength: 5 }), (ops) => {
          const invalidResponse = { ops };
          const result = validateOpsResponse(invalidResponse);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject response missing ops field', () => {
      fc.assert(
        fc.property(validPlanArb, (plan) => {
          const invalidResponse = { plan };
          const result = validateOpsResponse(invalidResponse);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject addText ops with invalid layer ID format', () => {
      fc.assert(
        fc.property(invalidLayerIdArb, (invalidId) => {
          const invalidOp = {
            type: 'addText',
            payload: {
              id: invalidId,
              text: 'Hello',
              x: 100,
              y: 100,
            },
          };
          const result = validateSingleOp(invalidOp);
          
          expect(result.valid).toBe(false);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Helper function tests
   */
  describe('Helper functions', () => {
    it('should correctly identify valid layer IDs', () => {
      fc.assert(
        fc.property(validLayerIdArb, (id) => {
          expect(isValidLayerId(id)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly reject invalid layer IDs', () => {
      fc.assert(
        fc.property(invalidLayerIdArb, (id) => {
          expect(isValidLayerId(id)).toBe(false);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly identify valid hex colors', () => {
      fc.assert(
        fc.property(validHexColorArb, (color) => {
          expect(isValidHexColor(color)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid layer IDs', () => {
      for (let i = 0; i < 100; i++) {
        const id = generateLayerId();
        expect(isValidLayerId(id)).toBe(true);
      }
    });

    it('should correctly use isValidResult type guard', () => {
      fc.assert(
        fc.property(validOpsResponseArb, (response) => {
          const result = validateOpsResponse(response);
          
          if (isValidResult(result)) {
            // TypeScript should know result.data is defined here
            expect(result.data.plan).toBeDefined();
            expect(result.data.ops).toBeDefined();
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate meaningful error summaries', () => {
      const invalidOp = { type: 'unknownOp', payload: {} };
      const result = validateSingleOp(invalidOp);
      
      if (!result.valid && result.errors) {
        const summary = getErrorSummary(result.errors);
        expect(summary.length).toBeGreaterThan(0);
        expect(summary).not.toBe('No errors');
      }
    });
  });
});
