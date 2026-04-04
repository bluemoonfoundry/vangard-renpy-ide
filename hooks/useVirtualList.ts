import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface VirtualItem<T> {
  item: T;
  index: number;
  offsetTop: number;
}

/**
 * Minimal fixed-height virtual list hook.
 * Attach containerRef to the scrollable element, wire onScroll, and render
 * only the returned virtualItems inside a position:relative spacer of totalHeight.
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  overscan = 3,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const { virtualItems, totalHeight } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    if (items.length === 0) return { virtualItems: [] as VirtualItem<T>[], totalHeight: 0 };
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
    );
    const virtualItems: VirtualItem<T>[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({ item: items[i], index: i, offsetTop: i * itemHeight });
    }
    return { virtualItems, totalHeight };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return { containerRef, handleScroll, virtualItems, totalHeight };
}
