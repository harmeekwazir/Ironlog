import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BatteryCharging, CalendarDays, ChevronRight,
  Dumbbell, Flame, Gauge, Settings2, ShieldCheck, User,
} from 'lucide-react';
import { eachDayOfInterval, format, isToday, startOfDay, subDays } from 'date-fns';
import { db } from '../db';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import type { ReadinessCheck, Workout } from '../types';
import {
  calcWorkoutVolume, formatDuration, getAcwr, getMuscleRecovery,
  getReadinessLabel, MUSCLE_LABELS,
} from '../utils';

export function Dashboard() {
  const { workout } = useActiveWorkout();
  const { setPage } = useNav();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [readiness, setReadiness] = useState<ReadinessCheck | null>(null);
  const [prCount, setPrCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const date = format(new Date(), 'yyyy-MM-dd');
      const [allWorkouts, todayReadiness, prs] = await Promise.all([
        db.workouts.filter(item => !!item.completedAt).toArray(),
        db.readiness.where('date').equals(date).last(),
        db.personalRecords.count(),
      ]);
      setWorkouts(allWorkouts.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)));
      setReadiness(todayReadiness ?? null);
      setPrCount(prs);
    };
    void load();
  }, []);

  const acwr = useMemo(() => getAcwr(workouts), [workouts]);
  const muscleRecovery = useMemo(
    () => getMuscleRecovery(workouts).sort((a, b) => a.recovery - b.recovery),
    [workouts],
  );
  const weekWorkouts = workouts.filter(item => (item.completedAt ?? 0) >= subDays(new Date(), 7).getTime());
  const weekLoad = weekWorkouts.reduce((sum, item) => sum + (item.workload ?? 0), 0);
  const averageRecovery = Math.round(muscleRecovery.reduce((sum, item) => sum + item.recovery, 0) / muscleRecovery.length);
  const totalVolume = workouts.reduce((sum, item) => sum + (item.totalVolume ?? calcWorkoutVolume(item)), 0);

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
        <section className="overflow-hidden rounded-[30px] border border-iron-800 bg-iron-900">
          <div className="grid grid-cols-[1.15fr_.85fr]">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-volt-400">Today’s readiness</p>
              {readiness ? (
                <>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-5xl font-black tracking-tighter text-white">{readiness.score}</span>
                    <span className="pb-1 text-sm font-bold text-iron-500">/100</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-volt-300">{getReadinessLabel(readiness.score)}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-volt-400/10 px-3 py-1.5 text-xs font-bold text-volt-300">
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
            <div className="relative flex items-center justify-center bg-gradient-to-br from-volt-400/15 to-transparent p-5">
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#d4f52a ${(readiness?.score ?? 0) * 3.6}deg, #222 0deg)` }}
              >
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-iron-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-iron-500">Muscles</span>
                  <span className="text-2xl font-black text-white">{averageRecovery}%</span>
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

        <section className="rounded-[28px] border border-iron-800 bg-iron-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-white">Muscle recovery</p>
              <p className="mt-0.5 text-xs text-iron-500">48h exponential fatigue decay · 15 muscles</p>
            </div>
            <ShieldCheck size={20} className="text-volt-400" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {muscleRecovery.map(item => (
              <div key={item.muscle} className="rounded-2xl bg-iron-950 p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] font-bold text-iron-400">{MUSCLE_LABELS[item.muscle]}</span>
                  <span className={`text-[10px] font-black ${item.recovery >= 75 ? 'text-volt-400' : item.recovery >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{item.recovery}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-iron-800">
                  <div className={`h-full rounded-full ${item.recovery >= 75 ? 'bg-volt-400' : item.recovery >= 45 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${item.recovery}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

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

function Metric({ icon: Icon, label, value, tint }: { icon: React.ElementType; label: string; value: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-iron-800 bg-iron-900 p-3">
      <Icon size={15} className={tint} />
      <p className="mt-3 text-xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-iron-600">{label}</p>
    </div>
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
