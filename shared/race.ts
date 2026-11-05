/** The distance race: settled work turned into kilometres, and the track it is drawn on. */
import { ROUND_SECONDS } from './chain';
import type { ActiveRound } from './almanac';

/**
 * Millimetres of wheel per unit of work. One unit is one accepted magnet pass, and the docs say distance
 * comes from the wheel's fixed circumference without naming it. The figure is the API's own ratio:
 * /v1/measurement/stats reports observedDistanceMm 3351326 for 3817 work units, exactly 878 each.
 */
export const MM_PER_WORK = 878;

export const GOALS = [
  { km: 5, name: 'Park run' },
  { km: 10, name: 'Town race' },
  { km: 21.1, name: 'Half marathon' },
  { km: 42.2, name: 'Marathon' },
  { km: 100, name: 'Ultra' },
] as const;
export const MIN_GOAL_KM = 1;
export const MAX_GOAL_KM = 1000;

export const workToKm = (work: number) => (work * MM_PER_WORK) / 1e6;
export const validGoal = (km: unknown): km is number => typeof km === 'number' && Number.isFinite(km) && km >= MIN_GOAL_KM && km <= MAX_GOAL_KM;

/** Reads a typed goal, to one decimal place. Null when it is not a distance the race can run. */
export function parseGoal(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const km = Math.round(Number(text) * 10) / 10;
  return validGoal(km) ? km : null;
}

export interface Progress { km: number; left: number; share: number; done: boolean }

export function raceProgress(startWork: number, settledWork: number, goalKm: number): Progress {
  const km = workToKm(Math.max(0, settledWork - startWork));
  return { km, left: Math.max(0, goalKm - km), share: Math.min(1, km / goalKm), done: km >= goalKm };
}

/** How far a steady pace would have carried him since the race began. */
export const paceKm = (elapsedMs: number, kmPerDay: number) => (Math.max(0, elapsedMs) / 86400_000) * kmPerDay;

export function duration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return minutes === 1 ? 'a minute' : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? 'an hour' : `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

export interface Stretch { fromRound: number; toRound: number; seconds: number; work: number }

/** The shortest run of rounds in which he covered the goal. Null if the record is not that long yet. */
export function fastestStretch(active: ActiveRound[], goalKm: number): Stretch | null {
  const need = (goalKm * 1e6) / MM_PER_WORK;
  const rounds = [...active].sort((a, b) => a.round - b.round);
  let best: Stretch | null = null;
  let from = 0, sum = 0;
  rounds.forEach((r, to) => {
    sum += r.work;
    while (sum - rounds[from].work >= need) { sum -= rounds[from].work; from++; }
    if (sum < need) return;
    const seconds = (r.round - rounds[from].round + 1) * ROUND_SECONDS;
    if (!best || seconds < best.seconds) best = { fromRound: rounds[from].round, toRound: r.round, seconds, work: sum };
  });
  return best;
}

/** The track: a stadium in a 360 by 200 box. A race starts on the home straight and runs anticlockwise. */
const STRAIGHT = 180, RADIUS = 70, LEFT = 90, RIGHT = 270, MID = 100, TOP = 30, BOTTOM = 170;
const ARC = Math.PI * RADIUS;
const PERIMETER = 2 * STRAIGHT + 2 * ARC;

export const TRACK_PATH = `M180 ${BOTTOM}H${RIGHT}A${RADIUS} ${RADIUS} 0 0 0 ${RIGHT} ${TOP}H${LEFT}A${RADIUS} ${RADIUS} 0 0 0 ${LEFT} ${BOTTOM}H180`;

export function trackPoint(t: number): { x: number; y: number } {
  let d = Math.min(1, Math.max(0, t)) * PERIMETER;
  if (d <= STRAIGHT / 2) return { x: 180 + d, y: BOTTOM };
  d -= STRAIGHT / 2;
  if (d <= ARC) { const a = Math.PI / 2 - d / RADIUS; return { x: RIGHT + RADIUS * Math.cos(a), y: MID + RADIUS * Math.sin(a) }; }
  d -= ARC;
  if (d <= STRAIGHT) return { x: RIGHT - d, y: TOP };
  d -= STRAIGHT;
  if (d <= ARC) { const a = -Math.PI / 2 - d / RADIUS; return { x: LEFT + RADIUS * Math.cos(a), y: MID + RADIUS * Math.sin(a) }; }
  return { x: LEFT + (d - ARC), y: BOTTOM };
}

/** The unit direction from a point on the track toward the infield. */
export function trackInward(p: { x: number; y: number }): { x: number; y: number } {
  const dx = Math.min(RIGHT, Math.max(LEFT, p.x)) - p.x, dy = MID - p.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}
