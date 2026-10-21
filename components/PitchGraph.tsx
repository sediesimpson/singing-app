"use client";

import { useEffect, useRef } from "react";
import { midiToNoteName, type NoteReading } from "@/lib/audio/notes";
import { IN_TUNE_CENTS } from "@/lib/audio/config";

const WINDOW_MS = 6000;        // show the last 6 seconds (fits a whole 5 s attempt)
const VISIBLE_SEMITONES = 12;  // one octave tall
const LABEL_WIDTH = 40;        // space on the left for note names
const RIGHT_PAD = 16;          // room so the "you are here" dot isn't cut off

const COLORS = {
  grid: "#eceef1",
  gridC: "#d6dae0",
  label: "#9ca3af",
  inTune: "#16a34a",
  off: "#f59e0b",
  band: "rgba(22, 163, 74, 0.10)",
  bandCentre: "rgba(22, 163, 74, 0.45)",
};

type Point = { t: number; midi: number | null };

type Props = {
  reading: NoteReading | null;
  targetMidi?: number | null;
  centerMidi?: number | null; // pin the view here, e.g. the middle of a scale
  paused?: boolean;           // freeze the picture, e.g. while showing a result
  height?: number;
};

export function PitchGraph({ reading, targetMidi = null, centerMidi = null, paused = false, height = 260 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readingRef = useRef(reading);
  const targetRef = useRef(targetMidi);
  const centerRef = useRef(centerMidi);
  const pausedRef = useRef(paused);

  useEffect(() => { readingRef.current = reading; }, [reading]);
  useEffect(() => { targetRef.current = targetMidi; }, [targetMidi]);
  useEffect(() => { centerRef.current = centerMidi; }, [centerMidi]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const points: Point[] = [];
    let center = centerRef.current ?? targetRef.current ?? 57; // start the view around A3
    let raf = 0;
    let wasPaused = false;
    const fontFamily = getComputedStyle(canvas).fontFamily; // match the page's font

    const draw = () => {
      // While paused, skip drawing so the last frame stays on screen.
      // On resume, start with a clean graph instead of the old attempt jumping sideways.
      if (pausedRef.current) {
        wasPaused = true;
        raf = requestAnimationFrame(draw);
        return;
      }
      if (wasPaused) {
        points.length = 0;
        wasPaused = false;
      }

      const now = performance.now();
      const r = readingRef.current;
      const target = targetRef.current;

      // 1. Record this frame, forget anything older than the window
      points.push({ t: now, midi: r ? r.midi : null });
      while (points.length && now - points[0].t > WINDOW_MS) points.shift();

      // 2. Glide the view towards the pinned centre, the target, or your voice
      const focus = centerRef.current ?? target ?? (r ? r.midi : null);
      if (focus !== null) center += (focus - center) * 0.05;

      // 3. Match the canvas to its on-screen size (sharp on retina screens)
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // 4. Helpers: turn a note and a time into a pixel position
      const low = center - VISIBLE_SEMITONES / 2;
      const plotRight = w - RIGHT_PAD;
      const yFor = (midi: number) => h - ((midi - low) / VISIBLE_SEMITONES) * h;
      const xFor = (t: number) =>
        LABEL_WIDTH + (1 - (now - t) / WINDOW_MS) * (plotRight - LABEL_WIDTH);

      // 5. Grid: faint lines on the natural notes only (no sharps), a bit darker on every C
      ctx.font = `11px ${fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.lineWidth = 1;
      for (let m = Math.ceil(low); m <= low + VISIBLE_SEMITONES; m++) {
        const name = midiToNoteName(m);
        if (name.includes("#")) continue;
        const y = Math.round(yFor(m)) + 0.5; // +0.5 keeps 1px lines crisp
        if (y < 8 || y > h - 8) continue; // skip lines and labels squashed against the edges
        ctx.strokeStyle = m % 12 === 0 ? COLORS.gridC : COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(LABEL_WIDTH, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        if (target !== null && Math.abs(m - target) < 1) continue; // the target label goes here instead
        ctx.fillStyle = COLORS.label;
        ctx.fillText(name, 8, y);
      }

      // 6. Target band: the zone that counts as in tune, with a dashed centre line and its name
      if (target !== null) {
        const band = IN_TUNE_CENTS / 100;
        const top = yFor(target + band);
        const bottom = yFor(target - band);
        const mid = yFor(target);
        ctx.fillStyle = COLORS.band;
        ctx.fillRect(LABEL_WIDTH, top, w - LABEL_WIDTH, bottom - top);

        ctx.strokeStyle = COLORS.bandCentre;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(LABEL_WIDTH, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `600 11px ${fontFamily}`;
        ctx.fillStyle = COLORS.inTune;
        ctx.fillText(midiToNoteName(target), 8, mid);
      }

      // 7. Your voice: green when in tune, amber when off, fading out as it gets older
      const colorFor = (midi: number) => {
        const aim = target ?? Math.round(midi);
        return Math.abs(midi - aim) * 100 <= IN_TUNE_CENTS ? COLORS.inTune : COLORS.off;
      };
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (a.midi === null || b.midi === null) continue; // gap = silence
        ctx.globalAlpha = 0.25 + 0.75 * (1 - (now - b.t) / WINDOW_MS);
        ctx.strokeStyle = colorFor(b.midi);
        ctx.beginPath();
        ctx.moveTo(xFor(a.t), yFor(a.midi));
        ctx.lineTo(xFor(b.t), yFor(b.midi));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 8. "You are here": a dot with a soft halo where you're singing right now
      const latest = points[points.length - 1];
      if (latest?.midi != null) {
        const x = xFor(latest.t);
        const y = yFor(latest.midi);
        ctx.fillStyle = colorFor(latest.midi);
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl bg-gray-50 ring-1 ring-gray-100"
      style={{ height }}
    />
  );
}