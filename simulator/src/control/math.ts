export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function moveToward(current: number, target: number, maxDelta: number): number {
  if (target > current) return Math.min(target, current + maxDelta)
  if (target < current) return Math.max(target, current - maxDelta)
  return target
}

export function smoothstep(value: number): number {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export function finite(...values: number[]): boolean {
  return values.every(Number.isFinite)
}

