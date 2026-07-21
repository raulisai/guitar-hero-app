export const ATTACK_MIN_INTERVAL_MS = 140
export const ATTACK_RISE_RATIO = 1.28

/** Detects the energy jump produced by a new pluck, including repeated notes. */
export function isRmsAttack(
  rms: number,
  baselineRms: number,
  gateRms: number,
  millisecondsSinceLastAttack: number,
): boolean {
  if (millisecondsSinceLastAttack < ATTACK_MIN_INTERVAL_MS) return false
  const minimumAttackEnergy = Math.max(gateRms * 1.7, 0.006)
  if (rms < minimumAttackEnergy) return false
  if (baselineRms <= gateRms) return true
  return rms >= baselineRms * ATTACK_RISE_RATIO
}
