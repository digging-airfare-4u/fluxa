/**
 * Placement Utilities
 * Provides collision detection and free space finding for canvas object placement
 * Requirements: Smart placeholder placement - place new objects in unoccupied areas
 */

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  );
}

/**
 * Check if a candidate position would overlap with any existing objects
 */
function hasCollision(
  candidate: BoundingBox,
  existingBoxes: BoundingBox[]
): boolean {
  return existingBoxes.some((box) => boxesOverlap(candidate, box));
}

export interface FindFreePositionOptions {
  /** Width of the object to place */
  width: number;
  /** Height of the object to place */
  height: number;
  /** Bounding boxes of existing objects on canvas */
  existingObjects: BoundingBox[];
  /** Viewport bounds (visible area in canvas coordinates) */
  viewportBounds: BoundingBox;
  /** Minimum gap between objects (default: 40) */
  gap?: number;
  /** Preferred starting position (default: center of viewport) */
  preferredPosition?: Position;
}

/**
 * Find a free position for placing a new object that doesn't overlap existing objects.
 * 
 * Algorithm:
 * 1. Try the preferred position (or center of viewport)
 * 2. If occupied, try positions in a spiral pattern outward from the center
 * 3. Search in grid increments to find an unoccupied slot
 * 4. Fallback to a random position if no free space found after max attempts
 */
export function findFreePosition(options: FindFreePositionOptions): Position {
  const {
    width,
    height,
    existingObjects,
    viewportBounds,
    gap = 40,
    preferredPosition,
  } = options;

  // If no existing objects, place at preferred position or center
  if (existingObjects.length === 0) {
    if (preferredPosition) {
      return preferredPosition;
    }
    return {
      x: viewportBounds.left + (viewportBounds.width - width) / 2,
      y: viewportBounds.top + (viewportBounds.height - height) / 2,
    };
  }

  // Start from preferred position or viewport center
  const centerX = preferredPosition?.x ?? 
    (viewportBounds.left + (viewportBounds.width - width) / 2);
  const centerY = preferredPosition?.y ?? 
    (viewportBounds.top + (viewportBounds.height - height) / 2);

  // Grid step for searching (object size + gap)
  const stepX = width + gap;
  const stepY = height + gap;

  // Maximum search radius (in grid steps)
  const maxSteps = 20;

  // Spiral search pattern: try positions in expanding squares from center
  for (let ring = 0; ring <= maxSteps; ring++) {
    // Generate positions for this ring
    const positions = ring === 0 
      ? [{ x: centerX, y: centerY }]
      : generateRingPositions(centerX, centerY, stepX, stepY, ring);

    for (const pos of positions) {
      const candidate: BoundingBox = {
        left: pos.x,
        top: pos.y,
        width,
        height,
      };

      // Check if position is within reasonable bounds (allow some overflow)
      const expandedBounds = {
        left: viewportBounds.left - width,
        top: viewportBounds.top - height,
        width: viewportBounds.width + width * 2,
        height: viewportBounds.height + height * 2,
      };

      const isInBounds = 
        pos.x >= expandedBounds.left &&
        pos.x <= expandedBounds.left + expandedBounds.width &&
        pos.y >= expandedBounds.top &&
        pos.y <= expandedBounds.top + expandedBounds.height;

      if (isInBounds && !hasCollision(candidate, existingObjects)) {
        return pos;
      }
    }
  }

  // Fallback: place below all existing objects
  const maxBottom = Math.max(
    ...existingObjects.map((obj) => obj.top + obj.height)
  );
  return {
    x: viewportBounds.left + (viewportBounds.width - width) / 2,
    y: maxBottom + gap,
  };
}

/**
 * Generate positions forming a ring at the given distance from center
 */
function generateRingPositions(
  centerX: number,
  centerY: number,
  stepX: number,
  stepY: number,
  ring: number
): Position[] {
  const positions: Position[] = [];

  // Top and bottom edges
  for (let dx = -ring; dx <= ring; dx++) {
    positions.push({ x: centerX + dx * stepX, y: centerY - ring * stepY });
    positions.push({ x: centerX + dx * stepX, y: centerY + ring * stepY });
  }

  // Left and right edges (excluding corners already added)
  for (let dy = -ring + 1; dy < ring; dy++) {
    positions.push({ x: centerX - ring * stepX, y: centerY + dy * stepY });
    positions.push({ x: centerX + ring * stepX, y: centerY + dy * stepY });
  }

  return positions;
}

/**
 * Get the viewport bounds in canvas coordinates from a Fabric canvas
 */
export function getViewportBounds(
  canvas: { viewportTransform: number[] | undefined; getWidth(): number; getHeight(): number }
): BoundingBox {
  const vpt = canvas.viewportTransform;
  const zoom = vpt?.[0] ?? 1;
  const panX = vpt?.[4] ?? 0;
  const panY = vpt?.[5] ?? 0;

  // Convert screen coordinates to canvas coordinates
  const left = -panX / zoom;
  const top = -panY / zoom;
  const width = canvas.getWidth() / zoom;
  const height = canvas.getHeight() / zoom;

  return { left, top, width, height };
}
