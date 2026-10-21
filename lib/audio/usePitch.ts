import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { frequencyToMidi, frequencyToNote, midiToFrequency, type NoteReading } from "./notes";

const MIN_CLARITY = 0.9;
const MIN_FREQ = 60;
const MAX_FREQ = 1200;
const SMOOTHING_WINDOW = 7; // median of the last 7 frames (~115 ms)
const HOLD_FRAMES = 10;     // ride through dropouts shorter than ~165 ms

export function usePitch() {
  const [reading, setReading] = useState<NoteReading | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    rafRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setIsListening(false);
    setReading(null);
  }, []);

  // Returns whether the mic opened, so callers can stop if permission was refused
  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const buffer = new Float32Array(detector.inputLength);

            const history: number[] = [];
      let missedFrames = 0;

      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        const [pitch, clarity] = detector.findPitch(buffer, audioCtx.sampleRate);
        const isValid = clarity >= MIN_CLARITY && pitch >= MIN_FREQ && pitch <= MAX_FREQ;

        if (isValid) {
          missedFrames = 0;
          history.push(frequencyToMidi(pitch));
          if (history.length > SMOOTHING_WINDOW) history.shift();

          const sorted = [...history].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          setReading(frequencyToNote(midiToFrequency(median)));
        } else {
          missedFrames++;
          if (missedFrames > HOLD_FRAMES) {
            history.length = 0;
            setReading(null);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      streamRef.current = stream;
      audioCtxRef.current = audioCtx;
      setIsListening(true);
      tick();
      return true;
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings.");
      return false;
    }
  }, []);

  useEffect(() => stop, [stop]); // clean up if the component unmounts

  return { reading, isListening, error, start, stop };
}