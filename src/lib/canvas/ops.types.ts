/**
 * Canvas Ops Type Definitions
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

export type OpType =
  | 'createFrame'
  | 'setBackground'
  | 'addText'
  | 'addImage'
  | 'addRect'
  | 'updateLayer'
  | 'removeLayer'
  | 'setLayerVisibility'
  | 'setLayerLock'
  | 'renameLayer';

export interface BaseOp {
  type: OpType;
}

/**
 * Requirement 8.1: createFrame op
 * Creates the canvas frame with specified dimensions
 */
export interface CreateFrameOp extends BaseOp {
  type: 'createFrame';
  payload: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
}

/**
 * Gradient configuration for setBackground
 */
export interface GradientConfig {
  type: 'linear' | 'radial';
  colorStops: Array<{ offset: number; color: string }>;
  coords?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

/**
 * Requirement 8.2: setBackground op
 * Sets the canvas background color, gradient, or image
 */
export interface SetBackgroundOp extends BaseOp {
  type: 'setBackground';
  payload: {
    backgroundType: 'solid' | 'gradient' | 'image';
    value: string | GradientConfig; // color string, gradient config, or image URL
  };
}

/**
 * Requirement 8.3: addText op
 * Adds a text layer to the canvas
 */
export interface AddTextOp extends BaseOp {
  type: 'addText';
  payload: {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize?: number;      // default: 24
    fontFamily?: string;    // default: 'Inter'
    fill?: string;          // default: '#000000'
    fontWeight?: string;    // default: 'normal'
    textAlign?: 'left' | 'center' | 'right';
    width?: number;         // for text wrapping
  };
}

/**
 * Requirement 8.4: addImage op
 * Adds an image layer to the canvas
 */
export interface AddImageOp extends BaseOp {
  type: 'addImage';
  payload: {
    id: string;
    src: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
  };
}

/**
 * addRect op
 * Adds a rectangle layer to the canvas
 * Requirements: 8.1, 8.4
 */
export interface AddRectOp extends BaseOp {
  type: 'addRect';
  payload: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  };
}

/**
 * setLayerVisibility op
 * Persists layer visibility state
 * Requirements: 8.1
 */
export interface SetLayerVisibilityOp extends BaseOp {
  type: 'setLayerVisibility';
  payload: {
    id: string;
    visible: boolean;
  };
}

/**
 * setLayerLock op
 * Persists layer lock state
 * Requirements: 8.2
 */
export interface SetLayerLockOp extends BaseOp {
  type: 'setLayerLock';
  payload: {
    id: string;
    locked: boolean;
  };
}

/**
 * renameLayer op
 * Persists custom layer name
 * Requirements: 9.1
 */
export interface RenameLayerOp extends BaseOp {
  type: 'renameLayer';
  payload: {
    id: string;
    name: string;
  };
}

/**
 * Requirement 8.5: updateLayer op
 * Updates properties of an existing layer
 */
export interface UpdateLayerOp extends BaseOp {
  type: 'updateLayer';
  payload: {
    id: string;
    properties: Record<string, unknown>;
  };
}

/**
 * Requirement 8.6: removeLayer op
 * Removes a layer from the canvas
 */
export interface RemoveLayerOp extends BaseOp {
  type: 'removeLayer';
  payload: {
    id: string;
  };
}

/**
 * Union type of all ops
 */
export type Op =
  | CreateFrameOp
  | SetBackgroundOp
  | AddTextOp
  | AddImageOp
  | AddRectOp
  | UpdateLayerOp
  | RemoveLayerOp
  | SetLayerVisibilityOp
  | SetLayerLockOp
  | RenameLayerOp;

/**
 * Response from generate-ops endpoint
 */
export interface GenerateOpsResponse {
  plan: string;
  ops: Op[];
}

/**
 * Database ops record
 */
export interface OpsRecord {
  id: string;
  document_id: string;
  conversation_id?: string;
  message_id?: string;
  seq: number;
  op_type: OpType;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Type guards for ops
 */
export function isCreateFrameOp(op: Op): op is CreateFrameOp {
  return op.type === 'createFrame';
}

export function isSetBackgroundOp(op: Op): op is SetBackgroundOp {
  return op.type === 'setBackground';
}

export function isAddTextOp(op: Op): op is AddTextOp {
  return op.type === 'addText';
}

export function isAddImageOp(op: Op): op is AddImageOp {
  return op.type === 'addImage';
}

export function isUpdateLayerOp(op: Op): op is UpdateLayerOp {
  return op.type === 'updateLayer';
}

export function isRemoveLayerOp(op: Op): op is RemoveLayerOp {
  return op.type === 'removeLayer';
}

export function isAddRectOp(op: Op): op is AddRectOp {
  return op.type === 'addRect';
}

export function isSetLayerVisibilityOp(op: Op): op is SetLayerVisibilityOp {
  return op.type === 'setLayerVisibility';
}

export function isSetLayerLockOp(op: Op): op is SetLayerLockOp {
  return op.type === 'setLayerLock';
}

export function isRenameLayerOp(op: Op): op is RenameLayerOp {
  return op.type === 'renameLayer';
}

/**
 * Validate op has required fields
 */
export function validateOp(op: unknown): op is Op {
  if (!op || typeof op !== 'object') return false;
  
  const opObj = op as Record<string, unknown>;
  if (typeof opObj.type !== 'string') return false;
  if (!opObj.payload || typeof opObj.payload !== 'object') return false;

  const validTypes: OpType[] = [
    'createFrame',
    'setBackground',
    'addText',
    'addImage',
    'addRect',
    'updateLayer',
    'removeLayer',
    'setLayerVisibility',
    'setLayerLock',
    'renameLayer',
  ];

  if (!validTypes.includes(opObj.type as OpType)) return false;

  return validateOpPayload(opObj as unknown as Op);
}

/**
 * Validate op payload based on type
 */
function validateOpPayload(op: Op): boolean {
  switch (op.type) {
    case 'createFrame':
      return (
        typeof op.payload.width === 'number' &&
        typeof op.payload.height === 'number'
      );

    case 'setBackground':
      return (
        ['solid', 'gradient', 'image'].includes(op.payload.backgroundType) &&
        op.payload.value !== undefined
      );

    case 'addText':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.text === 'string' &&
        typeof op.payload.x === 'number' &&
        typeof op.payload.y === 'number'
      );

    case 'addImage':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.src === 'string' &&
        typeof op.payload.x === 'number' &&
        typeof op.payload.y === 'number'
      );

    case 'addRect':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.x === 'number' &&
        typeof op.payload.y === 'number' &&
        typeof op.payload.width === 'number' &&
        typeof op.payload.height === 'number'
      );

    case 'updateLayer':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.properties === 'object'
      );

    case 'removeLayer':
      return typeof op.payload.id === 'string';

    case 'setLayerVisibility':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.visible === 'boolean'
      );

    case 'setLayerLock':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.locked === 'boolean'
      );

    case 'renameLayer':
      return (
        typeof op.payload.id === 'string' &&
        typeof op.payload.name === 'string'
      );

    default:
      return false;
  }
}

/**
 * Validate array of ops
 */
export function validateOps(ops: unknown[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(ops)) {
    return { valid: false, errors: ['Ops must be an array'] };
  }

  ops.forEach((op, index) => {
    if (!validateOp(op)) {
      errors.push(`Invalid op at index ${index}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
