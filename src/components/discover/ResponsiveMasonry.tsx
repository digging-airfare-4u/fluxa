'use client';

/**
 * Responsive masonry columns with stable item placement across append operations.
 *
 * Avoids CSS multi-column reflow so existing cards do not jump between columns
 * when more items are appended during infinite scroll.
 */

import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface MasonryBreakpoint {
  minWidth: number;
  columns: number;
}

interface ResponsiveMasonryProps<T> {
  items: T[];
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  columnClassName?: string;
  breakpoints?: MasonryBreakpoint[];
}

const DEFAULT_BREAKPOINTS: MasonryBreakpoint[] = [
  { minWidth: 1280, columns: 4 },
  { minWidth: 1024, columns: 3 },
  { minWidth: 0, columns: 2 },
];

function resolveColumnCount(width: number, breakpoints: MasonryBreakpoint[]): number {
  const sortedBreakpoints = [...breakpoints].sort((left, right) => right.minWidth - left.minWidth);
  return sortedBreakpoints.find((breakpoint) => width >= breakpoint.minWidth)?.columns ?? 2;
}

export function ResponsiveMasonry<T>({
  items,
  getItemKey,
  renderItem,
  className,
  columnClassName,
  breakpoints = DEFAULT_BREAKPOINTS,
}: ResponsiveMasonryProps<T>) {
  const [columnCount, setColumnCount] = useState(() => resolveColumnCount(1440, breakpoints));

  useEffect(() => {
    const updateColumnCount = () => {
      setColumnCount(resolveColumnCount(window.innerWidth, breakpoints));
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);

    return () => {
      window.removeEventListener('resize', updateColumnCount);
    };
  }, [breakpoints]);

  const columns = useMemo(() => {
    const nextColumns = Array.from({ length: columnCount }, () => [] as Array<{ item: T; index: number }>);

    items.forEach((item, index) => {
      nextColumns[index % columnCount].push({ item, index });
    });

    return nextColumns;
  }, [columnCount, items]);

  return (
    <div className={cn('flex items-start gap-5', className)}>
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className={cn('min-w-0 flex-1', columnClassName)}>
          {column.map(({ item, index }) => (
            <Fragment key={getItemKey(item, index)}>
              {renderItem(item, index)}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
