"use client";

import { useEffect, useRef, useState } from "react";
import type { DayPoint } from "@/lib/exercises/progress";

const PLOT_HEIGHT = 180;
const AXIS_BAND = 24; // room under the plot for the date labels
const LEFT = 40;      // room for the % labels
const RIGHT = 12;
const TOP = 10;

const INK = "#1f2937";
const GRID = "#e5e7eb";
const MUTED = "#9ca3af";

const fmtDay = (d: Date) => d.toLocaleDateString("en", { month: "short", day: "numeric" });

type Props = { points: DayPoint[]; days: number };

// Average score per day: one line, a dot per day you practised, and a hover readout
export function AccuracyChart({ points, days }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Measure the container so the SVG draws at its real size (text stays the same size on any screen)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const plotW = Math.max(width - LEFT - RIGHT, 0);
  const span = end.getTime() - start.getTime();
  const xFor = (d: Date) => LEFT + ((d.getTime() - start.getTime()) / span) * plotW;
  const yFor = (pct: number) => TOP + (1 - pct / 100) * PLOT_HEIGHT;

  const coords = points.map((p) => ({ ...p, x: xFor(p.day), y: yFor(p.accuracy) }));
  const path = coords.map((c, i) => `${i ? "L" : "M"}${c.x},${c.y}`).join(" ");

  // Snap the hover to whichever day is nearest the pointer, so you aim at a date, not a 2px line
  function onPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left + LEFT;
    let nearest = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(coords[nearest].x - x)) nearest = i;
    });
    setActive(nearest);
  }

  // Same readout from the keyboard: arrow keys step through the days
  function onKeyDown(e: React.KeyboardEvent) {
    if (!coords.length) return;
    if (e.key === "ArrowRight") setActive((i) => Math.min((i ?? -1) + 1, coords.length - 1));
    if (e.key === "ArrowLeft") setActive((i) => Math.max((i ?? coords.length) - 1, 0));
  }

  const hovered = active !== null ? coords[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={TOP + PLOT_HEIGHT + AXIS_BAND}
          role="img"
          aria-label={`Average score per day over the last ${days} days`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="outline-none focus-visible:ring-2 focus-visible:ring-gray-300 rounded-lg"
        >
          {/* Gridlines at 0 / 50 / 100%: solid hairlines, quiet */}
          {[0, 50, 100].map((pct) => (
            <g key={pct}>
              <line x1={LEFT} x2={LEFT + plotW} y1={yFor(pct)} y2={yFor(pct)} stroke={GRID} strokeWidth={1} />
              <text x={LEFT - 8} y={yFor(pct)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED}>
                {pct}%
              </text>
            </g>
          ))}

          {/* Date labels: first and last day of the window */}
          <text x={LEFT} y={TOP + PLOT_HEIGHT + 16} fontSize={11} fill={MUTED}>{fmtDay(start)}</text>
          <text x={LEFT + plotW} y={TOP + PLOT_HEIGHT + 16} textAnchor="end" fontSize={11} fill={MUTED}>today</text>

          {/* Crosshair on the hovered day */}
          {hovered && (
            <line x1={hovered.x} x2={hovered.x} y1={TOP} y2={TOP + PLOT_HEIGHT} stroke={MUTED} strokeWidth={1} />
          )}

          <path d={path} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {coords.map((c, i) => (
            <circle
              key={c.day.getTime()}
              cx={c.x}
              cy={c.y}
              r={i === active ? 5.5 : 4}
              fill={INK}
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}

          {/* Invisible layer that catches the pointer across the whole plot */}
          <rect
            x={LEFT}
            y={TOP}
            width={plotW}
            height={PLOT_HEIGHT}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-white px-3 py-2 text-xs shadow-md ring-1 ring-gray-200"
          style={{ left: hovered.x, top: hovered.y - 10 }}
        >
          <div className="text-sm font-semibold text-gray-900">{hovered.accuracy}%</div>
          <div className="text-gray-500 whitespace-nowrap">
            {fmtDay(hovered.day)} · {hovered.rounds} {hovered.rounds === 1 ? "round" : "rounds"}
          </div>
        </div>
      )}
    </div>
  );
}
