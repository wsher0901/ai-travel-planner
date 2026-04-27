'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type NativeScrollBehavior = 'smooth' | 'auto';

interface ScrollToElementOptions {
  offset?: number;
  behavior?: NativeScrollBehavior;
}

export interface ScrollAreaHandle {
  scrollToElement: (id: string, options?: ScrollToElementOptions) => void;
  scrollToTop: (behavior?: NativeScrollBehavior) => void;
  scrollToBottom: (behavior?: NativeScrollBehavior) => void;
  isElementVisible: (id: string) => boolean;
  getScrollElement: () => HTMLDivElement | null;
}

interface ScrollAreaProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

function findChild(container: HTMLDivElement, id: string): HTMLElement | null {
  const safe = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id;
  return container.querySelector<HTMLElement>(`[data-scroll-id="${safe}"]`);
}

const ScrollArea = forwardRef<ScrollAreaHandle, ScrollAreaProps>(function ScrollArea(
  { children, className, style },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    getScrollElement: () => scrollRef.current,

    scrollToTop: (behavior = 'smooth') => {
      scrollRef.current?.scrollTo({ top: 0, behavior });
    },

    scrollToBottom: (behavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    },

    isElementVisible: (id) => {
      const container = scrollRef.current;
      if (!container) return false;
      const child = findChild(container, id);
      if (!child) return false;
      const cRect = container.getBoundingClientRect();
      const eRect = child.getBoundingClientRect();
      return eRect.top >= cRect.top && eRect.bottom <= cRect.bottom;
    },

    scrollToElement: (id, options = {}) => {
      const container = scrollRef.current;
      if (!container) return;
      const child = findChild(container, id);
      if (!child) return;
      const { offset, behavior = 'smooth' } = options;
      const cRect = container.getBoundingClientRect();
      const eRect = child.getBoundingClientRect();
      let delta: number;
      if (typeof offset === 'number') {
        delta = eRect.top - cRect.top - offset;
      } else {
        const childCenter = eRect.top + eRect.height / 2;
        const containerCenter = cRect.top + cRect.height / 2;
        delta = childCenter - containerCenter;
      }
      container.scrollTo({ top: container.scrollTop + delta, behavior });
    },
  }), []);

  const combinedClassName = ['[&::-webkit-scrollbar]:hidden', className].filter(Boolean).join(' ');

  return (
    <div
      ref={scrollRef}
      className={combinedClassName}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
});

export default ScrollArea;
