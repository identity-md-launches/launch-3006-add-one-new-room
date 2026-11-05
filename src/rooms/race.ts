import { DOCS, ROUND_SECONDS, roundStart } from '../../shared/chain';
import { duration, fastestStretch, GOALS, MAX_GOAL_KM, MIN_GOAL_KM, MM_PER_WORK, paceKm, parseGoal, raceProgress, TRACK_PATH, trackInward, trackPoint, validGoal } from '../../shared/race';
import { history, kmPerDay, live, loadHistory, onLive, previewOnly } from '../lib/store';
import { esc, fmt, timeAgo, type Room } from './ui';

/** The race is one visitor's own, so it lives on this device. startWork is null until a settled count has been read. */
interface Race { goalKm: number; startWork: number | null; startedAt: number; installation: string | null; finishedAt: number | null }

const KEY = 'sw.race';
const load = (): Race | null => { try { const raw = localStorage.getItem(KEY); const race = raw ? JSON.parse(raw) : null; return race && validGoal(race.goalKm) ? race : null; } catch { return null; } };
const save = (race: Race | null) => { try { if (race) localStorage.setItem(KEY, JSON.stringify(race)); else localStorage.removeItem(KEY); } catch { /* private window */ } };

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const goalKm = (km: number) => `${fmt(km, Number.isInteger(km) ? 0 : 1)} km`;
const bloom = (x: number) => `<g transform="translate(${x} 100)">${Array.from({ length: 8 }, (_, i) => `<ellipse cy="-11" rx="3.4" ry="7" fill="var(--sunflower)" transform="rotate(${i * 45})"/>`).join('')}<circle r="6" fill="var(--soil)"/></g>`;
const checks = Array.from({ length: 10 }, (_, i) => `<rect x="${174 + (i % 2) * 6}" y="${155 + Math.floor(i / 2) * 6}" width="6" height="6" fill="${i % 4 === 0 || i % 4 === 3 ? '#fff1c9' : '#23194f'}"/>`).join('');

export const raceRoom: Room = (el) => {
  let race = load();
  let undo: Race | null = null;
  let notice = '';
  let drawnGoal: number | null | undefined;
  let spin = 0;

  el.innerHTML = `
    <header><h2>Distance race</h2><p>Pick a distance and follow the real hamster toward it, one settled round at a time.</p></header>
    <section>
      <fieldset class="race-goals"><legend>Pick a distance goal</legend>
        <div class="goal-row">${GOALS.map((g) => `<label class="goal"><input type="radio" name="race-goal" value="${g.km}"/><span class="num">${goalKm(g.km)}</span></label>`).join('')}</div>
      </fieldset>
      <svg class="race-track" viewBox="0 0 360 200" role="img" data-track>
        <path d="${TRACK_PATH}" fill="none" stroke="var(--ember)" stroke-width="30" transform="translate(3 4)"/>
        <path d="${TRACK_PATH}" fill="#1f6b43" stroke="var(--soil)" stroke-width="30"/>
        <path d="${TRACK_PATH}" fill="none" stroke="#fff1c9" stroke-width="1.5" stroke-dasharray="6 9"/>
        <path d="${TRACK_PATH}" fill="none" stroke="var(--sunflower)" stroke-width="8" pathLength="100" stroke-dasharray="0 100" data-lap/>
        ${bloom(92)}${bloom(268)}
        ${checks}
        <g data-marks></g>
        <text class="race-goal" x="180" y="96" text-anchor="middle" data-goal-km></text>
        <text x="180" y="116" text-anchor="middle" data-goal-name></text>
        <g class="race-marker" data-pace-marker><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" fill="var(--moth)" stroke="#23194f" stroke-width="2"/></g>
        <g class="race-marker" data-runner>
          <g class="race-wheel" data-wheel><circle r="13" fill="#fff1c9" stroke="#23194f" stroke-width="2.5"/><path d="M0-13V13M-13 0H13M-9.2-9.2 9.2 9.2M-9.2 9.2 9.2-9.2" stroke="#23194f" stroke-width="1" opacity=".35"/></g>
          <g data-hamster><ellipse cx="-.5" cy="1.5" rx="7.5" ry="5.5" fill="var(--ember)"/><circle cx="5" cy="-1" r="3.8" fill="var(--ember)"/><circle cx="4" cy="-4.6" r="1.6" fill="var(--ember)"/><circle cx="6.2" cy="-1.5" r="1" fill="#23194f"/></g>
        </g>
      </svg>
      <ul class="race-key small">
        <li><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="var(--ember)" stroke="#23194f" stroke-width="1.5"/></svg>His settled work</li>
        <li><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" transform="rotate(45 8 8)" fill="var(--moth)" stroke="#23194f" stroke-width="1.5"/></svg>His usual pace</li>
      </ul>
      <p class="big num race-headline" data-headline></p>
      <div class="stack small race-lines">
        <p role="status" data-status></p>
        <p class="soft" data-pace></p>
        <p class="soft" data-sky-note></p>
      </div>
      <div class="row">
        <button type="button" class="link-button" data-restart>Start again from now</button>
        <button type="button" class="link-button" data-undo>Undo</button>
      </div>
      <p class="small" role="status" data-notice></p>
    </section>
    <section>
      <h3>Your own distance</h3>
      <form class="stack" data-custom novalidate>
        <label class="small" for="race-custom">Any distance from ${fmt(MIN_GOAL_KM)} to ${fmt(MAX_GOAL_KM)} km</label>
        <div class="row">
          <input type="text" id="race-custom" name="race-custom" inputmode="decimal" autocomplete="off" placeholder="15" style="flex:1 1 120px;width:auto"/>
          <button class="stamp quiet">Set this goal</button>
        </div>
        <p class="note warm" id="race-custom-error" data-error hidden></p>
      </form>
    </section>
    <section>
      <h3>Fastest on record</h3>
      <p class="small" data-record></p>
    </section>
    <section>
      <h3>How it is counted</h3>
      <p class="small">One unit of settled work is one accepted pass of the magnet, and one pass is ${fmt(MM_PER_WORK)} mm of wheel. So this is an estimate of how far the wheel turned, not of how far a hamster walked. <a href="${DOCS}/system/measurement/" target="_blank" rel="noopener">How the wheel is measured</a></p>
      <p class="small soft" style="margin-top:8px">Your race is saved on this device. The hamster does not know about it, so all you can do is hope.</p>
    </section>`;

  const q = <T extends Element = HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const set = (selector: string, text: string) => { const n = q(selector); if (n.textContent !== text) n.textContent = text; };
  const put = (selector: string, t: number) => { const p = trackPoint(t); q<SVGGElement>(selector).style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`; };
  const radios = [...el.querySelectorAll<HTMLInputElement>('input[name="race-goal"]')];
  const customInput = q<HTMLInputElement>('#race-custom');

  /** Ties the race to the settled count, and starts it over if the count itself has restarted. */
  const settle = () => {
    if (!race || live.settledWork === null) return;
    const restarted = race.startWork !== null && (live.settledWork < race.startWork || Boolean(race.installation && live.installation && race.installation !== live.installation));
    if (race.startWork === null || restarted) {
      if (restarted) notice = 'Squeekchain restarted its settled count, so this race starts again from the new count.';
      race = { ...race, startWork: live.settledWork, startedAt: Date.now(), installation: live.installation, finishedAt: null };
      save(race);
    }
    if (race.finishedAt === null && raceProgress(race.startWork!, live.settledWork, race.goalKm).done) { race = { ...race, finishedAt: Date.now() }; save(race); }
  };

  const drawGoal = (km: number | null) => {
    if (km === drawnGoal) return;
    drawnGoal = km;
    radios.forEach((r) => { r.checked = km !== null && Number(r.value) === km; });
    const preset = GOALS.find((g) => g.km === km);
    if (km !== null && !preset && customInput !== document.activeElement) customInput.value = String(km);
    if (preset) customInput.value = '';
    set('[data-goal-km]', km === null ? 'No goal yet' : goalKm(km));
    set('[data-goal-name]', km === null ? 'Pick one above' : preset?.name ?? 'Your distance');
    q('[data-marks]').innerHTML = [0.25, 0.5, 0.75].map((t) => {
      const p = trackPoint(t), n = trackInward(p), value = km === null ? '' : fmt(km * t, km >= 100 ? 0 : km >= 10 ? 1 : 2);
      return `<path d="M${p.x - n.x * 15} ${p.y - n.y * 15}L${p.x + n.x * 15} ${p.y + n.y * 15}" stroke="#fff1c9" stroke-width="2"/><text x="${p.x + n.x * 30}" y="${p.y + n.y * 30 + 4}" text-anchor="middle">${esc(value)}</text>`;
    }).join('');
  };

  const update = () => {
    settle();
    drawGoal(race?.goalKm ?? null);
    const running = race && race.startWork !== null && live.settledWork !== null ? raceProgress(race.startWork, live.settledWork, race.goalKm) : null;
    const share = running?.share ?? 0;
    q('[data-lap]').setAttribute('stroke-dasharray', `${share * 100} 100`);
    put('[data-runner]', share);
    // He faces the way he runs, which is backwards along the top straight.
    q('[data-hamster]').setAttribute('transform', share > 0.25 && share < 0.75 ? 'scale(-1 1)' : '');

    const elapsed = race ? Date.now() - race.startedAt : 0;
    const paced = race ? paceKm(elapsed, kmPerDay) : 0;
    const showPace = Boolean(running && !running.done);
    q('[data-pace-marker]').style.display = showPace ? '' : 'none';
    if (race && showPace) put('[data-pace-marker]', Math.min(1, paced / race.goalKm));

    if (!race) {
      set('[data-headline]', 'Pick a distance');
      set('[data-status]', 'He starts from his newest settled work, and the track fills in as more of it settles.');
      set('[data-pace]', `He usually covers about ${fmt(kmPerDay, 1)} km on a day he runs.`);
    } else if (!running) {
      set('[data-headline]', `${goalKm(race.goalKm)} to go`);
      set('[data-status]', previewOnly ? 'This preview cannot read the settled record, so the race only moves on the real site.' : live.error ? 'The settled record could not be read. The race starts as soon as it comes back.' : 'Reading his settled work. The race starts from there.');
      set('[data-pace]', '');
    } else if (running.done) {
      set('[data-headline]', 'Finished');
      set('[data-status]', `He covered ${goalKm(race.goalKm)} of settled work after you started on ${when(race.startedAt)}.`);
      set('[data-pace]', race.finishedAt ? `You first saw him over the line on ${when(race.finishedAt)}. Pick a longer goal to keep going, or start again from now.` : '');
    } else {
      const gap = running.km - Math.min(race.goalKm, paced);
      set('[data-headline]', `${fmt(running.left, 2)} km left`);
      set('[data-status]', `${fmt(running.km, 2)} of ${goalKm(race.goalKm)} settled since you started on ${when(race.startedAt)}.`);
      set('[data-pace]', `At his usual ${fmt(kmPerDay, 1)} km a running day he gets there in about ${duration((running.left / kmPerDay) * 86400)}. He is ${fmt(Math.abs(gap), 2)} km ${gap >= 0 ? 'ahead of' : 'behind'} that pace.`);
    }

    const settled = live.settledAt ? ` Last settled ${timeAgo(Math.min(Date.now(), Date.parse(live.settledAt)))}, through round ${fmt(live.frontier)}.` : '';
    const sky = live.sky === 'day' ? `He is running now${live.rpm ? ` at ${fmt(live.rpm)} rpm` : ''}. That work joins the race once its round settles, usually within fifteen minutes.` : live.sky === 'lost' ? 'No signal from the wheel. Settled work still counts, and the track waits for more.' : 'He is asleep, so the track waits for him.';
    set('[data-sky-note]', `${sky}${settled}`);

    q('[data-track]').setAttribute('aria-label', !race ? 'Race track with no goal picked yet.' : running ? `Race track. The hamster has covered ${fmt(running.km, 2)} of ${goalKm(race.goalKm)}.` : `Race track with a goal of ${goalKm(race.goalKm)}. The race has not started.`);
    q('[data-restart]').hidden = !race;
    q('[data-undo]').hidden = !undo;
    set('[data-notice]', notice);

    const best = race ? fastestStretch(history.active, race.goalKm) : null;
    set('[data-record]', !race ? 'Pick a goal to see the quickest he has ever covered it.' : !history.active.length ? 'Reading the rounds on record.' : best ? `The quickest ${goalKm(race.goalKm)} in the ${fmt(history.active.length)} active rounds this site has read took ${duration(best.seconds)}, ending ${day((roundStart(best.toRound) + ROUND_SECONDS) * 1000)}.` : `He has not covered ${goalKm(race.goalKm)} in the ${fmt(history.active.length)} active rounds this site has read, so this one would be a first.`);

    const wheel = q<SVGGElement>('[data-wheel]');
    const rpm = live.sky === 'day' ? Math.round(live.rpm) : 0;
    if (rpm !== spin) { spin = rpm; wheel.style.animationDuration = rpm ? `${60 / rpm}s` : ''; }
  };

  const pick = (km: number) => {
    undo = null;
    notice = '';
    // A new goal moves the finish line. The start stays where it was, so no running is lost.
    race = race ? { ...race, goalKm: km, finishedAt: null } : { goalKm: km, startWork: null, startedAt: Date.now(), installation: null, finishedAt: null };
    save(race);
    update();
  };

  radios.forEach((r) => r.addEventListener('change', () => { if (r.checked) { clearError(); pick(Number(r.value)); } }));

  const error = q('[data-error]');
  const clearError = () => { error.hidden = true; error.textContent = ''; customInput.removeAttribute('aria-invalid'); customInput.removeAttribute('aria-describedby'); };
  q('[data-custom]').addEventListener('submit', (e) => {
    e.preventDefault();
    const km = parseGoal(customInput.value);
    if (km === null) {
      error.textContent = `Enter a number from ${fmt(MIN_GOAL_KM)} to ${fmt(MAX_GOAL_KM)}, such as 15.`;
      error.hidden = false;
      customInput.setAttribute('aria-invalid', 'true');
      customInput.setAttribute('aria-describedby', 'race-custom-error');
      customInput.focus();
      return;
    }
    clearError();
    customInput.value = String(km);
    pick(km);
  });

  q('[data-restart]').addEventListener('click', () => {
    if (!race) return;
    undo = race;
    notice = 'The race starts again from his newest settled work.';
    race = { ...race, startWork: null, startedAt: Date.now(), installation: null, finishedAt: null };
    save(race);
    update();
    q('[data-undo]').focus();
  });
  q('[data-undo]').addEventListener('click', () => {
    if (!undo) return;
    race = undo;
    undo = null;
    notice = 'The race is back as it was.';
    save(race);
    update();
    q('[data-restart]').focus();
  });

  update();
  void loadHistory();
  const off = onLive(update);
  return () => { off(); };
};
