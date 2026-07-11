export function nextScrollPosition(position: number, speed: number, elapsedMs: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(speed) || !Number.isFinite(elapsedMs)) return 0
  return Math.max(0, position + Math.max(0, speed) * Math.max(0, elapsedMs) / 1000)
}

export function seekBySeconds(position: number, speed: number, seconds: number): number {
  return Math.max(0, position + speed * seconds)
}
