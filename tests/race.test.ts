import { describe, expect, it } from 'vitest';
import { duration, fastestStretch, GOALS, MAX_GOAL_KM, MIN_GOAL_KM, MM_PER_WORK, paceKm, parseGoal, raceProgress, trackInward, trackPoint, validGoal, workToKm } from '../shared/race';

describe('the distance race', () => {
  it('turns work into kilometres at the ratio the API reports', () => {
    expect(3817 * MM_PER_WORK).toBe(3351326);
    expect(workToKm(1000)).toBeCloseTo(0.878);
  });

  it('counts only work settled after the start', () => {
    const p = raceProgress(1000, 3000, 5);
    expect(p.km).toBeCloseTo(1.756);
    expect(p.left).toBeCloseTo(3.244);
    expect(p.share).toBeCloseTo(0.3512);
    expect(p.done).toBe(false);
    expect(raceProgress(1000, 1000, 5).share).toBe(0);
  });

  it('never runs backwards and stops at the line', () => {
    expect(raceProgress(1000, 900, 5).km).toBe(0);
    const over = raceProgress(0, 100000, 5);
    expect(over.done).toBe(true);
    expect(over.share).toBe(1);
    expect(over.left).toBe(0);
  });

  it('reads typed goals and refuses the rest', () => {
    expect(parseGoal('15')).toBe(15);
    expect(parseGoal(' 7,5 ')).toBe(7.5);
    expect(parseGoal('12.34')).toBe(12.3);
    for (const bad of ['', '   ', 'far', '0', '0.5', '1001', '-5', 'Infinity']) expect(parseGoal(bad)).toBeNull();
    expect(parseGoal(String(MIN_GOAL_KM))).toBe(MIN_GOAL_KM);
    expect(parseGoal(String(MAX_GOAL_KM))).toBe(MAX_GOAL_KM);
  });

  it('offers only goals it can run', () => {
    for (const g of GOALS) expect(validGoal(g.km)).toBe(true);
    for (const bad of [null, '5', NaN, 0, 5000]) expect(validGoal(bad)).toBe(false);
  });

  it('paces by the day', () => {
    expect(paceKm(86400_000, 8.8)).toBeCloseTo(8.8);
    expect(paceKm(-5, 8.8)).toBe(0);
  });

  it('says durations in words, with no minus sign', () => {
    expect(duration(0)).toBe('a minute');
    expect(duration(600)).toBe('10 minutes');
    expect(duration(3600)).toBe('an hour');
    expect(duration(7200)).toBe('2 hours');
    expect(duration(86400 * 3)).toBe('3 days');
    expect(duration(-500)).toBe('a minute');
  });
});

describe('the fastest stretch', () => {
  const need = (km: number) => Math.ceil((km * 1e6) / MM_PER_WORK);

  it('finds the shortest run of rounds that covers the goal', () => {
    const active = [{ round: 1, work: need(1) / 2 }, { round: 50, work: need(1) / 2 }, { round: 100, work: need(1) / 2 }, { round: 101, work: need(1) / 2 }];
    const best = fastestStretch(active, 1)!;
    expect(best.fromRound).toBe(100);
    expect(best.toRound).toBe(101);
    expect(best.seconds).toBe(1200);
  });

  it('counts a single big round', () => {
    expect(fastestStretch([{ round: 7, work: need(1) }], 1)).toMatchObject({ fromRound: 7, toRound: 7, seconds: 600 });
  });

  it('is null until the record is long enough', () => {
    expect(fastestStretch([], 5)).toBeNull();
    expect(fastestStretch([{ round: 1, work: 10 }], 5)).toBeNull();
  });

  it('handles rounds out of order', () => {
    const active = [{ round: 9, work: need(1) / 2 }, { round: 8, work: need(1) / 2 }];
    expect(fastestStretch(active, 1)).toMatchObject({ fromRound: 8, toRound: 9 });
  });
});

describe('the track', () => {
  const close = (a: { x: number; y: number }, x: number, y: number) => { expect(a.x).toBeCloseTo(x, 3); expect(a.y).toBeCloseTo(y, 3); };

  it('starts and finishes on the same line', () => {
    close(trackPoint(0), 180, 170);
    close(trackPoint(1), 180, 170);
  });

  it('runs anticlockwise around the stadium', () => {
    close(trackPoint(0.5), 180, 30);
    expect(trackPoint(0.25).x).toBeGreaterThan(330);
    expect(trackPoint(0.75).x).toBeLessThan(30);
  });

  it('clamps past either end and stays in the box', () => {
    close(trackPoint(-1), 180, 170);
    close(trackPoint(2), 180, 170);
    for (let i = 0; i <= 200; i++) {
      const p = trackPoint(i / 200);
      expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(340 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(170 + 1e-6);
    }
  });

  it('moves without jumps', () => {
    for (let i = 1; i <= 400; i++) {
      const a = trackPoint((i - 1) / 400), b = trackPoint(i / 400);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(2.1);
    }
  });

  it('points inward from the lane', () => {
    close(trackInward(trackPoint(0.5)), 0, 1);
    close(trackInward(trackPoint(0)), 0, -1);
    expect(trackInward(trackPoint(0.75)).x).toBeGreaterThan(0.99);
  });
});
