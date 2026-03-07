"use client";

import { useEffect, useRef } from "react";

interface WheelPickerProps {
  label: string;
  options: Array<string | number>;
  value: string | number;
  onChange: (value: string) => void;
}

const ITEM_HEIGHT = 36;

export default function WheelPicker({ label, options, value, onChange }: WheelPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastIndexRef = useRef(-1);
  const scrollEndTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const index = options.findIndex((item) => String(item) === String(value));
    if (!ref.current || index < 0) return;

    const targetTop = index * ITEM_HEIGHT;
    const currentTop = ref.current.scrollTop;
    if (Math.abs(currentTop - targetTop) > 1) {
      ref.current.scrollTo({ top: targetTop, behavior: "auto" });
    }
    lastIndexRef.current = index;
  }, [options, value]);

  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current) {
        window.clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = null;
      }
    };
  }, []);

  const handleScroll = () => {
    if (scrollEndTimerRef.current) {
      window.clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = window.setTimeout(() => {
      if (!ref.current) return;
      const rawIndex = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const safeIndex = Math.max(0, Math.min(options.length - 1, rawIndex));
      const targetTop = safeIndex * ITEM_HEIGHT;
      if (Math.abs(ref.current.scrollTop - targetTop) > 1) {
        ref.current.scrollTo({ top: targetTop, behavior: "auto" });
      }
      if (safeIndex !== lastIndexRef.current) {
        lastIndexRef.current = safeIndex;
        onChange(String(options[safeIndex]));
      }
    }, 80);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">{label}</p>
      <div className="relative">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-lg border border-brand-100 bg-brand-100/50" />
        <div
          ref={ref}
          onScroll={handleScroll}
          className="wheel-picker-scroll h-40 snap-y snap-mandatory overflow-y-auto rounded-xl border border-blue-100 bg-white py-[52px] touch-pan-y overscroll-contain"
        >
          {options.map((item) => {
            const selected = String(item) === String(value);
            return (
              <div
                key={String(item)}
                className={`snap-center px-3 text-center text-sm leading-9 transition ${
                  selected ? "font-semibold text-brand-700" : "text-slate-400"
                }`}
                style={{ height: ITEM_HEIGHT }}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
