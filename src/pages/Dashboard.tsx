import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BatteryCharging, CalendarDays, ChevronRight,
  Clock, Dumbbell, FileText, Flame, Gauge, Settings2, ShieldCheck, TrendingUp, User, Zap,
} from 'lucide-react';
import { eachDayOfInterval, format, formatDistanceToNow, isToday, startOfDay, subDays } from 'date-fns';
import { db } from '../db';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { useSyncStatus } from '../store/sync';
import type { Exercise, IndividualMuscle, MuscleSplit, OverloadSuggestion, PersonalRecord, ReadinessCheck, WeeklyReport, Workout } from '../types';
import {
  calcMuscleStress, calcWorkoutVolume, formatDuration, getAcwr, getMuscleRecovery,
  getOverloadSuggestions, getReadinessLabel, getWeeklyReport, MUSCLE_LABELS, MUSCLE_SPLITS, SPLIT_LABELS,
} from '../utils';
import { BottomSheet } from '../components/common/BottomSheet';
import frontSvgRaw from '../assets/front.svg?raw';
import backSvgRaw from '../assets/Back.svg?raw';

function readinessTheme(score?: number) {
  if (score === undefined) return { label: 'text-volt-300', badge: 'bg-volt-400/10 text-volt-300', gauge: '#d4f52a', gradFrom: 'from-volt-400/15' };
  if (score < 50)          return { label: 'text-red-300',  badge: 'bg-red-400/10 text-red-300',   gauge: '#f87171', gradFrom: 'from-red-400/15' };
  if (score < 70)          return { label: 'text-amber-300', badge: 'bg-amber-400/10 text-amber-300', gauge: '#fbbf24', gradFrom: 'from-amber-400/15' };
  if (score < 85)          return { label: 'text-blue-300', badge: 'bg-blue-400/10 text-blue-300',  gauge: '#60a5fa', gradFrom: 'from-blue-400/15' };
  return                          { label: 'text-volt-300', badge: 'bg-volt-400/10 text-volt-300',  gauge: '#d4f52a', gradFrom: 'from-volt-400/15' };
}

export function Dashboard() {
  const { workout } = useActiveWorkout();
  const { setPage } = useNav();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [readiness, setReadiness] = useState<ReadinessCheck | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [suggestions, setSuggestions] = useState<OverloadSuggestion[]>([]);
  const lastSyncedAt = useSyncStatus(s => s.lastSyncedAt);

  useEffect(() => {
    const load = async () => {
      const date = format(new Date(), 'yyyy-MM-dd');
      const [allWorkouts, todayReadiness, prs, exAll] = await Promise.all([
        db.workouts.filter(item => !!item.completedAt).toArray(),
        db.readiness.where('date').equals(date).last(),
        db.personalRecords.toArray(),
        db.exercises.toArray(),
      ]);
      const sorted = allWorkouts.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      setWorkouts(sorted);
      setReadiness(todayReadiness ?? null);
      setPersonalRecords(prs);
      const exMap: Record<string, Exercise> = {};
      exAll.forEach(e => { exMap[e.id] = e; });
      setExercises(exMap);
      setSuggestions(getOverloadSuggestions(sorted, exMap, 5));
    };
    void load();
  }, [lastSyncedAt]);

  const prCount = personalRecords.length;
  const acwr = useMemo(() => getAcwr(workouts), [workouts]);
  const weeklyReport = useMemo(
    () => getWeeklyReport(workouts, exercises, personalRecords),
    [workouts, exercises, personalRecords],
  );
  const muscleRecovery = useMemo(
    () => getMuscleRecovery(workouts, exercises).sort((a, b) => a.recovery - b.recovery),
    [workouts, exercises],
  );
  const weekWorkouts = workouts.filter(item => (item.completedAt ?? 0) >= subDays(new Date(), 7).getTime());
  const weekLoad = weekWorkouts.reduce((sum, item) => sum + (item.workload ?? 0), 0);
  const averageRecovery = Math.round(muscleRecovery.reduce((sum, item) => sum + item.recovery, 0) / muscleRecovery.length);
  const totalVolume = workouts.reduce((sum, item) => sum + (item.totalVolume ?? calcWorkoutVolume(item)), 0);

  const theme = readinessTheme(readiness?.score);
  const recovColor = averageRecovery >= 75 ? '#d4f52a' : averageRecovery >= 45 ? '#fbbf24' : '#f87171';

  const advisory = (() => {
    if (averageRecovery < 45) {
      const sore = muscleRecovery.filter(m => m.recovery < 40).map(m => MUSCLE_LABELS[m.muscle]).slice(0, 3).join(', ');
      return { Icon: AlertTriangle, cls: 'border-red-400/20 bg-red-400/5', iconCls: 'text-red-400', title: 'High muscle fatigue', body: `${sore} need recovery. Consider a lighter session today.` };
    }
    if (readiness && readiness.score < 50) {
      return { Icon: AlertTriangle, cls: 'border-amber-400/20 bg-amber-400/5', iconCls: 'text-amber-400', title: 'Low readiness today', body: 'Reduce intensity or focus on mobility and recovery work.' };
    }
    if (acwr.status === 'High spike') {
      return { Icon: Zap, cls: 'border-red-400/20 bg-red-400/5', iconCls: 'text-red-400', title: 'Training load spike', body: `ACWR ${acwr.ratio.toFixed(2)} exceeds the safe ceiling. Reduce weekly volume to manage injury risk.` };
    }
    if (averageRecovery >= 80 && readiness && readiness.score >= 80) {
      return { Icon: Zap, cls: 'border-volt-400/20 bg-volt-400/5', iconCls: 'text-volt-400', title: 'Peak condition', body: 'Full recovery + high readiness. Push your limits today.' };
    }
    return null;
  })();

  return (
    <div className="min-h-screen pb-28">
      <header className="px-5 pt-11 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-iron-500">{format(new Date(), 'EEEE · MMM d')}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Training command</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage('profile')} className="rounded-2xl border border-iron-800 bg-iron-900 p-3 text-iron-400"><User size={18} /></button>
            <button onClick={() => setPage('settings')} className="rounded-2xl border border-iron-800 bg-iron-900 p-3 text-iron-400"><Settings2 size={18} /></button>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-4">
        {/* Readiness card — colors react to score */}
        <section className="overflow-hidden rounded-[30px] border border-iron-800 bg-iron-900">
          <div className="grid grid-cols-[1.15fr_.85fr]">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-volt-400">Today's readiness</p>
              {readiness ? (
                <>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-5xl font-black tracking-tighter text-white">{readiness.score}</span>
                    <span className="pb-1 text-sm font-bold text-iron-500">/100</span>
                  </div>
                  <p className={`mt-1 text-sm font-bold ${theme.label}`}>{getReadinessLabel(readiness.score)}</p>
                  <div className={`mt-4 inline-flex items-center gap-2 rounded-full ${theme.badge} px-3 py-1.5 text-xs font-bold`}>
                    <BatteryCharging size={14} /> Recovery ×{readiness.recoveryMultiplier}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-2xl font-black text-white">No check-in yet</h2>
                  <p className="mt-2 max-w-48 text-sm leading-relaxed text-iron-400">Take the 20-second Hooper check before training.</p>
                </>
              )}
            </div>
            {/* Gauge right — gradient and ring color both driven by readiness score */}
            <div className={`relative flex items-center justify-center bg-gradient-to-br ${theme.gradFrom} to-transparent p-5`}>
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(${theme.gauge} ${(readiness?.score ?? 0) * 3.6}deg, #222 0deg)` }}
              >
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-iron-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-iron-500">Muscles</span>
                  <span className="text-2xl font-black" style={{ color: recovColor }}>{averageRecovery}%</span>
                  <span className="text-[10px] text-iron-500">recovered</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setPage('workout')} className="flex w-full items-center justify-between border-t border-iron-800 px-5 py-4 text-left">
            <div>
              <p className="text-sm font-black text-white">{workout ? 'Resume active workout' : readiness ? 'Start today’s workout' : 'Check in & start'}</p>
              <p className="mt-0.5 text-xs text-iron-500">{workout ? workout.name : 'Readiness gates every new session'}</p>
            </div>
            <div className="rounded-xl bg-volt-400 p-2.5 text-iron-950"><ArrowRight size={18} /></div>
          </button>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Metric icon={Gauge} label="7d load" value={`${weekLoad}`} tint="text-blue-400" />
          <Metric icon={Activity} label="ACWR" value={acwr.ratio ? acwr.ratio.toFixed(2) : '—'} tint={acwr.ratio > 1.5 ? 'text-red-400' : 'text-volt-400'} />
          <Metric icon={Flame} label="Sessions" value={`${weekWorkouts.length}`} tint="text-ember-400" />
        </section>

        {/* Advisory banner — surfaces one actionable state at a time */}
        {advisory && (
          <div className={`rounded-2xl border ${advisory.cls} p-4 flex items-start gap-3`}>
            <advisory.Icon size={18} className={`${advisory.iconCls} mt-0.5 flex-shrink-0`} />
            <div>
              <p className="text-sm font-bold text-white">{advisory.title}</p>
              <p className="mt-0.5 text-xs text-iron-400">{advisory.body}</p>
            </div>
          </div>
        )}

        {(weeklyReport.sessions > 0 || weeklyReport.prevSessions > 0) && (
          <WeeklyReportCard report={weeklyReport} />
        )}

        <section className="rounded-[28px] border border-iron-800 bg-iron-900 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-black text-white">Load status</p>
              <p className="mt-0.5 text-xs text-iron-500">Acute : chronic workload ratio</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
              acwr.status === 'Sweet spot' ? 'bg-volt-400/10 text-volt-300' :
              acwr.status === 'High spike' ? 'bg-red-400/10 text-red-400' :
              'bg-iron-800 text-iron-300'
            }`}>{acwr.status}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-iron-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-400 via-volt-400 to-red-400" style={{ width: `${Math.min(100, (acwr.ratio / 2) * 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-iron-600">
            <span>Acute {acwr.acute} AU</span><span>Chronic {acwr.chronicWeekly} AU/wk</span>
          </div>
        </section>

        <ConsistencyGrid workouts={workouts} />

        <BodyHeatmap muscleRecovery={muscleRecovery} workouts={workouts} exercises={exercises} />

        {/* Progressive overload — only renders when there's training history */}
        {suggestions.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-black text-white">Next session targets</h2>
                <p className="text-xs text-iron-500">Progressive overload suggestions</p>
              </div>
              <button onClick={() => setPage('analytics')} className="text-xs font-bold text-volt-400">View PRs</button>
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map(s => (
                <OverloadCard key={s.exerciseId} suggestion={s} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-black text-white">Recent sessions</h2>
              <p className="text-xs text-iron-500">{prCount} PRs · {(totalVolume / 1000).toFixed(1)}t lifetime volume</p>
            </div>
            <button onClick={() => setPage('history')} className="text-xs font-bold text-volt-400">All history</button>
          </div>
          {workouts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-iron-700 py-10 text-center">
              <Dumbbell size={25} className="mx-auto text-iron-700" />
              <p className="mt-3 text-sm text-iron-400">Your first session starts the story.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.slice(0, 4).map(item => (
                <button key={item.id} onClick={() => setPage('history')} className="flex w-full items-center gap-3 rounded-2xl border border-iron-800 bg-iron-900 p-3 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-iron-800"><Dumbbell size={16} className="text-volt-400" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{item.name}</p>
                    <p className="text-xs text-iron-500">{isToday(new Date(item.completedAt!)) ? 'Today' : format(new Date(item.completedAt!), 'MMM d')} · {formatDuration(item.completedAt! - item.startedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{item.workload ?? 0} AU</p>
                    <p className="text-[10px] text-iron-600">RPE {item.sessionRpe ?? '—'}</p>
                  </div>
                  <ChevronRight size={15} className="text-iron-600" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  const volumeDelta = report.prevVolume > 0
    ? Math.round(((report.volume - report.prevVolume) / report.prevVolume) * 100)
    : null;
  const sessionsDelta = report.sessions - report.prevSessions;

  return (
    <section className="rounded-[28px] border border-iron-800 bg-iron-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-black text-white">Weekly report</p>
          <p className="mt-0.5 text-xs text-iron-500">{format(report.weekStart, 'MMM d')} – today · vs. last week</p>
        </div>
        <FileText size={18} className="text-volt-400 flex-shrink-0" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ReportStat label="Sessions" value={`${report.sessions}`} delta={sessionsDelta} />
        <ReportStat label="Volume" value={`${(report.volume / 1000).toFixed(1)}t`} delta={volumeDelta} suffix="%" />
        <ReportStat label="PRs" value={`${report.prsThisWeek}`} />
      </div>

      {report.topExercise && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-iron-950 px-3 py-2">
          <TrendingUp size={12} className="flex-shrink-0 text-volt-400" />
          <p className="text-[11px] font-bold text-iron-300">
            Top lift: {report.topExercise.name} · {(report.topExercise.volume / 1000).toFixed(1)}t · {report.muscleGroupsHit} muscle groups trained
          </p>
        </div>
      )}
    </section>
  );
}

function ReportStat({ label, value, delta, suffix = '' }: { label: string; value: string; delta?: number | null; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-iron-800 bg-iron-950/60 p-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-iron-600">{label}</p>
      {!!delta && (
        <p className={`mt-1 text-[10px] font-bold ${delta > 0 ? 'text-volt-400' : 'text-red-400'}`}>
          {delta > 0 ? '+' : ''}{delta}{suffix} vs last wk
        </p>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tint }: { icon: React.ElementType; label: string; value: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-iron-800 bg-iron-900 p-3">
      <Icon size={15} className={tint} />
      <p className="mt-3 text-xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-iron-600">{label}</p>
    </div>
  );
}

const TREND_META = {
  improving: { label: '↑ Improving', cls: 'text-volt-400' },
  stalled:   { label: '→ Plateau',   cls: 'text-amber-400' },
  new:       { label: '★ First run', cls: 'text-iron-500' },
  deload:    { label: '↓ Deload',    cls: 'text-red-400' },
} as const;

function OverloadCard({ suggestion: s }: { suggestion: OverloadSuggestion }) {
  const meta = TREND_META[s.trend];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-iron-800 bg-iron-900 p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-iron-800">
        <TrendingUp size={16} className="text-volt-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{s.exerciseName}</p>
        <p className="text-xs text-iron-500">Last: {s.lastWeight}kg × {s.lastReps}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-black text-volt-400">{s.suggestedWeight}kg × {s.suggestedReps}</p>
        <p className={`text-[10px] font-bold ${meta.cls}`}>{meta.label}</p>
      </div>
    </div>
  );
}

type MuscleRecoveryItem = { muscle: IndividualMuscle; stress: number; fitness: number; recovery: number; hoursUntilReady: number };

const FRONT_IDS: Partial<Record<IndividualMuscle, string[]>> = {
  chest:       ['chest'],
  front_delts: ['shoulder-front-delts'],
  side_delts:  ['shoulder-side-delts'],
  triceps:     ['triceps', 'triceps_2'],
  biceps:      ['biceps', 'biceps_2'],
  forearms:    ['forearms', 'forearms_2', 'forearms_3', 'forearms_4', 'forearms_5'],
  abs:         ['abs', 'abs-obliques'],
  quads:       ['quads', 'quads_2', 'quads_3', 'quads_4', 'quads_5'],
  calves:      ['calves', 'calves_2', 'calves_3', 'calves_4', 'calves_5'],
  lats:        ['back-lats'],
  upper_back:  ['back-traps'],
  glutes:      ['glutes-adductors'],
};

const BACK_IDS: Partial<Record<IndividualMuscle, string[]>> = {
  rear_delts: ['shoulder-rear-delts'],
  side_delts: ['shoulder-side-delts'],
  triceps:    ['triceps'],
  forearms:   ['forearm-extensors', 'forearm-extensors_2', 'forearm-extensors_3', 'forearm-supinator', 'forearm-flexor'],
  lats:       ['back-lats'],
  upper_back: ['back-upper-back', 'back-upperback', 'back-middle-back', 'back-upper-traps', 'back-mid-traps', 'back-lower-traps'],
  hamstrings: ['hamstrings'],
  glutes:     ['glutes', 'glutes-abductors', 'glutes-abductors_2', 'glutes-adductors', 'glutes-adductors_2'],
  quads:      ['quads', 'quads_2'],
  calves:     ['calves'],
  abs:        ['abs-obliques'],
};

// Reverse lookup so a click anywhere on either SVG can resolve back to the muscle it
// represents. The muscle-region id sits on an outer <g>, but the painted <path>
// elements are nested several levels deeper inside their own decorative <g id="Vector_
// NN"> wrappers — so a plain closest('[id]') stops at the nearest of those decorative
// ids instead of reaching the muscle region. REGION_SELECTOR below targets only the
// known region ids specifically, skipping over everything in between.
const ID_TO_MUSCLE = new Map<string, IndividualMuscle>();
for (const idsMap of [FRONT_IDS, BACK_IDS]) {
  for (const [muscle, ids] of Object.entries(idsMap) as [IndividualMuscle, string[]][]) {
    for (const id of ids) ID_TO_MUSCLE.set(id, muscle);
  }
}
const REGION_SELECTOR = [...ID_TO_MUSCLE.keys()].map(id => `#${CSS.escape(id)}`).join(',');

const HEATMAP_REGIONS = (Object.keys(MUSCLE_SPLITS) as MuscleSplit[]).map(split => ({
  label: SPLIT_LABELS[split],
  muscles: MUSCLE_SPLITS[split],
}));

// Continuous 3-stop gradient (fatigued → recovering → ready) instead of flat buckets, so
// 52% and 71% read as visibly different shades rather than both showing as amber.
const HM_STOPS: [number, [number, number, number]][] = [
  [0, [248, 113, 113]],   // red-400 — fatigued
  [50, [251, 191, 36]],   // amber-400 — recovering
  [100, [212, 245, 42]],  // volt-400 — ready
];

function hmColor(r: number): string {
  const clamped = Math.max(0, Math.min(100, r));
  let lo = HM_STOPS[0], hi = HM_STOPS[HM_STOPS.length - 1];
  for (let i = 0; i < HM_STOPS.length - 1; i++) {
    if (clamped >= HM_STOPS[i][0] && clamped <= HM_STOPS[i + 1][0]) {
      lo = HM_STOPS[i];
      hi = HM_STOPS[i + 1];
      break;
    }
  }
  const t = hi[0] === lo[0] ? 0 : (clamped - lo[0]) / (hi[0] - lo[0]);
  const [r1, g1, b1] = lo[1];
  const [r2, g2, b2] = hi[1];
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(r1, r2)},${mix(g1, g2)},${mix(b1, b2)})`;
}

function formatHoursUntilReady(hours: number): string {
  if (hours <= 0) return 'Ready now';
  if (hours < 24) return `Ready in ${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `Ready in ${days}d${rem ? ` ${rem}h` : ''}`;
}

function colorSvg(
  raw: string,
  idsMap: Partial<Record<IndividualMuscle, string[]>>,
  byMuscle: Partial<Record<IndividualMuscle, MuscleRecoveryItem>>,
  selectedMuscle: IndividualMuscle | null,
): string {
  const NEUTRAL = '#374151';
  const colorMap = new Map<string, string>();
  for (const ids of Object.values(idsMap)) {
    if (ids) for (const id of ids) colorMap.set(id, NEUTRAL);
  }
  for (const [muscle, ids] of Object.entries(idsMap) as [IndividualMuscle, string[]][]) {
    if (!ids?.length) continue;
    const item = byMuscle[muscle];
    const color = item ? hmColor(item.recovery) : NEUTRAL;
    for (const id of ids) colorMap.set(id, color);
  }
  const selectedIds = new Set(selectedMuscle ? idsMap[selectedMuscle] ?? [] : []);

  // Source art draws every shape twice — a filled shape plus a separate stroke-only
  // outline path tracing the same lines. These two blanket rules (lower specificity
  // than the #id ones below, so the per-muscle fills still win) give every part of the
  // body a consistent dark look by default: unmapped regions (background anatomy we
  // have no recovery data for — traps, neck, etc.) go flat black instead of the source
  // art's light gray, and every outline stroke goes white so the line work still reads
  // against that black.
  const baseRules = [
    'path[fill]:not([fill="none"]),ellipse[fill]:not([fill="none"]),rect[fill]:not([fill="none"]),circle[fill]:not([fill="none"]){fill:#000}',
    'path[stroke],ellipse[stroke],rect[stroke],circle[stroke]{stroke:#fff;stroke-opacity:.75;stroke-width:1.5px;vector-effect:non-scaling-stroke}',
  ];

  const rules = [...colorMap.entries()].map(([id, color]) => {
    const selector = `#${id},#${id} path,#${id} ellipse,#${id} rect,#${id} circle`;
    const highlight = selectedIds.has(id) ? 'stroke:#fff;stroke-width:3px;stroke-opacity:1;' : '';
    return `${selector}{fill:${color};fill-opacity:.7;${highlight}cursor:pointer;transition:filter .15s ease}${selector}:hover{filter:brightness(1.25)}`;
  });
  const sized = raw
    .replace(/(\s)width="[^"]*"/, '$1width="100%"')
    .replace(/\sheight="[^"]*"/, '');
  return sized.replace(/(<svg[^>]*>)/, `$1<style>${[...baseRules, ...rules].join('')}</style>`);
}

function BodyHeatmap({ muscleRecovery, workouts, exercises }: { muscleRecovery: MuscleRecoveryItem[]; workouts: Workout[]; exercises: Record<string, Exercise> }) {
  const [selectedMuscle, setSelectedMuscle] = useState<IndividualMuscle | null>(null);
  const [hover, setHover] = useState<{ muscle: IndividualMuscle; x: number; y: number; side: 'front' | 'back' } | null>(null);
  // Capability check, not a screen-size guess: a touch device sometimes fires a
  // synthetic mousemove right after a tap, which would otherwise leave a tooltip
  // stuck on screen after the finger has already lifted.
  const supportsHover = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  );

  const byMuscle = useMemo(
    () => Object.fromEntries(muscleRecovery.map(m => [m.muscle, m])) as Partial<Record<IndividualMuscle, MuscleRecoveryItem>>,
    [muscleRecovery],
  );
  const lastTrainedAt = useMemo(() => {
    const map: Partial<Record<IndividualMuscle, number>> = {};
    for (const w of workouts) {
      if (!w.completedAt) continue;
      const stressMap = calcMuscleStress(w, exercises);
      for (const muscle of Object.keys(stressMap) as IndividualMuscle[]) {
        if (!map[muscle] || w.completedAt > map[muscle]!) map[muscle] = w.completedAt;
      }
    }
    return map;
  }, [workouts, exercises]);

  const frontHtml = useMemo(() => colorSvg(frontSvgRaw, FRONT_IDS, byMuscle, selectedMuscle), [byMuscle, selectedMuscle]);
  const backHtml  = useMemo(() => colorSvg(backSvgRaw, BACK_IDS, byMuscle, selectedMuscle), [byMuscle, selectedMuscle]);

  const readyCount = muscleRecovery.filter(m => m.recovery >= 75).length;
  const fatiguedCount = muscleRecovery.filter(m => m.recovery < 45).length;
  const recoveringCount = muscleRecovery.length - readyCount - fatiguedCount;

  const readyRegions = HEATMAP_REGIONS
    .filter(region => {
      const items = region.muscles.map(m => byMuscle[m]).filter(Boolean) as MuscleRecoveryItem[];
      if (!items.length) return true;
      return Math.round(items.reduce((s, m) => s + m.recovery, 0) / items.length) >= 75;
    })
    .map(r => r.label);
  const suggestion = readyRegions.length === 0
    ? 'Rest or active recovery'
    : readyRegions.length === HEATMAP_REGIONS.length
    ? 'Full body ready'
    : readyRegions.join(' · ') + ' recommended';

  function handleSvgClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = (e.target as Element).closest(REGION_SELECTOR);
    if (!el) return;
    const muscle = ID_TO_MUSCLE.get(el.id);
    if (muscle) setSelectedMuscle(muscle);
  }

  function handleSvgMouseMove(side: 'front' | 'back') {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (!supportsHover) return;
      const el = (e.target as Element).closest(REGION_SELECTOR);
      const muscle = el ? ID_TO_MUSCLE.get(el.id) : undefined;
      if (!muscle) { setHover(null); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      setHover({ muscle, x: e.clientX - rect.left, y: e.clientY - rect.top, side });
    };
  }

  function clearHover() {
    if (supportsHover) setHover(null);
  }

  const selectedItem = selectedMuscle ? byMuscle[selectedMuscle] : undefined;

  return (
    <section className="rounded-[28px] border border-iron-800 bg-iron-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-black text-white">Muscle recovery</p>
          <p className="mt-0.5 text-xs text-iron-500">{readyCount} ready · {recoveringCount} recovering · {fatiguedCount} fatigued</p>
        </div>
        <ShieldCheck size={20} className="text-volt-400 flex-shrink-0" />
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-iron-950 px-3 py-2">
        <Zap size={12} className="flex-shrink-0 text-volt-400" />
        <p className="text-[11px] font-bold text-iron-300">{suggestion}</p>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg, #f87171 0%, #fbbf24 50%, #d4f52a 100%)' }} />
        <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-iron-500">
          <span>Fatigued</span>
          <span>Recovering</span>
          <span>Ready</span>
        </div>
      </div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-iron-600">Tap a muscle for details</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="relative">
          <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-iron-500">Front</p>
          <div
            onClick={handleSvgClick}
            onMouseMove={handleSvgMouseMove('front')}
            onMouseLeave={clearHover}
            dangerouslySetInnerHTML={{ __html: frontHtml }}
            className="w-full"
          />
          {hover?.side === 'front' && <MuscleTooltip hover={hover} byMuscle={byMuscle} />}
        </div>
        <div className="relative">
          <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-iron-500">Back</p>
          <div
            onClick={handleSvgClick}
            onMouseMove={handleSvgMouseMove('back')}
            onMouseLeave={clearHover}
            dangerouslySetInnerHTML={{ __html: backHtml }}
            className="w-full"
          />
          {hover?.side === 'back' && <MuscleTooltip hover={hover} byMuscle={byMuscle} />}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {muscleRecovery.map(m => (
          <button
            key={m.muscle}
            onClick={() => setSelectedMuscle(m.muscle)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
              selectedMuscle === m.muscle ? 'border-white/40 bg-iron-800' : 'border-iron-800 bg-iron-950 hover:border-iron-700'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: hmColor(m.recovery) }} />
            <span className="text-iron-300">{MUSCLE_LABELS[m.muscle]}</span>
            <span className="text-iron-500">{m.recovery}%</span>
          </button>
        ))}
      </div>

      {selectedMuscle && (
        <MuscleDetailSheet
          muscle={selectedMuscle}
          item={selectedItem}
          lastTrainedAt={lastTrainedAt[selectedMuscle]}
          onClose={() => setSelectedMuscle(null)}
        />
      )}
    </section>
  );
}

function MuscleTooltip({
  hover, byMuscle,
}: {
  hover: { muscle: IndividualMuscle; x: number; y: number };
  byMuscle: Partial<Record<IndividualMuscle, MuscleRecoveryItem>>;
}) {
  const recovery = byMuscle[hover.muscle]?.recovery ?? 0;
  const color = hmColor(recovery);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-iron-700 bg-iron-950 px-2.5 py-1.5 text-[11px] font-bold shadow-xl"
      style={{ left: hover.x, top: hover.y - 10 }}
    >
      <span className="text-white">{MUSCLE_LABELS[hover.muscle]}</span>
      <span className="ml-1.5" style={{ color }}>{recovery}%</span>
    </div>
  );
}

function MuscleDetailSheet({
  muscle, item, lastTrainedAt, onClose,
}: {
  muscle: IndividualMuscle;
  item?: MuscleRecoveryItem;
  lastTrainedAt?: number;
  onClose: () => void;
}) {
  const recovery = item?.recovery ?? 0;
  const color = hmColor(recovery);
  const status = recovery >= 75 ? 'Ready to train' : recovery >= 45 ? 'Recovering' : 'Fatigued';
  const advice = recovery >= 75
    ? `${MUSCLE_LABELS[muscle]} is fully recovered — a great candidate for today's session.`
    : recovery >= 45
    ? `${MUSCLE_LABELS[muscle]} is partway recovered. Training it now works, but expect reduced output.`
    : `${MUSCLE_LABELS[muscle]} is still fatigued. Give it more time before training it hard again.`;

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}22` }}>
          <ShieldCheck size={20} style={{ color }} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{status}</p>
          <h2 className="text-xl font-black text-white">{MUSCLE_LABELS[muscle]}</h2>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <span className="text-5xl font-black tracking-tighter" style={{ color }}>{recovery}%</span>
        <span className="pb-1 text-sm font-bold text-iron-500">recovered</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-iron-800">
        <div className="h-full rounded-full" style={{ width: `${recovery}%`, background: color }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-iron-800 bg-iron-950/60 p-3">
          <Clock size={14} className="text-iron-500" />
          <p className="mt-2 text-sm font-black text-white">{formatHoursUntilReady(item?.hoursUntilReady ?? 0)}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-iron-600">Until ready</p>
        </div>
        <div className="rounded-2xl border border-iron-800 bg-iron-950/60 p-3">
          <CalendarDays size={14} className="text-iron-500" />
          <p className="mt-2 text-sm font-black text-white">{lastTrainedAt ? formatDistanceToNow(lastTrainedAt, { addSuffix: true }) : 'Never'}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-iron-600">Last trained</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-iron-400">{advice}</p>
    </BottomSheet>
  );
}

function ConsistencyGrid({ workouts }: { workouts: Workout[] }) {
  const days = eachDayOfInterval({ start: subDays(startOfDay(new Date()), 90), end: startOfDay(new Date()) });
  const counts = workouts.reduce<Record<string, number>>((acc, workout) => {
    if (!workout.completedAt) return acc;
    const key = format(new Date(workout.completedAt), 'yyyy-MM-dd');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const activeDays = days.filter(day => counts[format(day, 'yyyy-MM-dd')]).length;

  return (
    <section className="rounded-[28px] border border-iron-800 bg-iron-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-black text-white">Consistency</p>
          <p className="mt-0.5 text-xs text-iron-500">Last 13 weeks</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-volt-400"><CalendarDays size={15} /> {activeDays} active days</div>
      </div>
      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1.5 overflow-hidden">
        {days.map(day => {
          const count = counts[format(day, 'yyyy-MM-dd')] ?? 0;
          return (
            <div
              key={day.toISOString()}
              title={`${format(day, 'MMM d')}: ${count} workout${count === 1 ? '' : 's'}`}
              className={`aspect-square min-w-0 rounded-[3px] ${count > 1 ? 'bg-volt-300' : count === 1 ? 'bg-volt-500/80' : 'bg-iron-800'}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-iron-600">
        <span>13 weeks ago</span>
        <div className="flex items-center gap-1"><span>Less</span><i className="h-2.5 w-2.5 rounded-sm bg-iron-800" /><i className="h-2.5 w-2.5 rounded-sm bg-volt-500/80" /><i className="h-2.5 w-2.5 rounded-sm bg-volt-300" /><span>More</span></div>
        <span>Today</span>
      </div>
    </section>
  );
}
