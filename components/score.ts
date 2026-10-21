// Shared score colours: green = good, amber = okay, red = needs work.
// Always shown next to the number itself, so colour is never the only clue.

export function scoreColor(accuracy: number): string {
  if (accuracy >= 70) return "text-green-600";
  if (accuracy >= 40) return "text-amber-500";
  return "text-red-500";
}

// Background + text pair for small chips; grey when there's no score yet
export function scoreChip(accuracy: number | null): string {
  if (accuracy === null) return "bg-gray-100 text-gray-400";
  if (accuracy >= 70) return "bg-green-100 text-green-800";
  if (accuracy >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

// Bar fill for a 0–100 score
export function scoreBar(accuracy: number): string {
  if (accuracy >= 70) return "bg-green-500";
  if (accuracy >= 40) return "bg-amber-400";
  return "bg-red-400";
}
