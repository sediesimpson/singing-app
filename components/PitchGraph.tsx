"use client";

import { useEffect, useRef } from "react";
import { midiToNoteName, type NoteReading } from "@/lib/audio/notes";
import { IN_TUNE_CENTS } from "@/lib/audio/config";

const WINDOW_MS = 5000;        // show the last 5 seconds
const VISIBLE_SEMITONES = 12;  // one octave tall
const LABEL_WIDTH = 40;        // space on the left for note names

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
      const yFor = (midi: number) => h - ((midi - low) / VISIBLE_SEMITONES) * h;
      const xFor = (t: number) =>
        LABEL_WIDTH + (1 - (now - t) / WINDOW_MS) * (w - LABEL_WIDTH);

      // 5. Grid: one line per semitone, a darker line on every C
      ctx.font = "12px sans-serif";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 1;
      for (let m = Math.ceil(low); m <= low + VISIBLE_SEMITONES; m++) {
        const y = yFor(m);
        ctx.strokeStyle = m % 12 === 0 ? "#9ca3af" : "#e5e7eb";
        ctx.beginPath();
        ctx.moveTo(LABEL_WIDTH, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = "#6b7280";
        ctx.fillText(midiToNoteName(m), 4, y);
      }

      // 6. Target band: the zone that counts as in tune
      if (target !== null) {
        const band = IN_TUNE_CENTS / 100;
        const top = yFor(target + band);
        const bottom = yFor(target - band);
        ctx.fillStyle = "rgba(29, 158, 117, 0.2)";
        ctx.fillRect(LABEL_WIDTH, top, w - LABEL_WIDTH, bottom - top);
      }

      // 7. Your voice: green segments when in tune, amber when off
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (a.midi === null || b.midi === null) continue; // gap = silence
        const aim = target ?? Math.round(b.midi);
        const centsOff = Math.abs(b.midi - aim) * 100;
        ctx.strokeStyle = centsOff <= IN_TUNE_CENTS ? "#16a34a" : "#d97706";
        ctx.beginPath();
        ctx.moveTo(xFor(a.t), yFor(a.midi));
        ctx.lineTo(xFor(b.t), yFor(b.midi));
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border"
      style={{ height }}
    />
  );
}