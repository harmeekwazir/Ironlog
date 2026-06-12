import { useEffect, useMemo, useState } from 'react';
import { Flame, Trophy, TrendingUp, Calendar, Dumbbell, Plus, Settings2, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { db } from '../db';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { useProfile } from '../store/profile';
import { formatDuration, calcWorkoutVolume, calcBMI, getMuscleGroupColor } from '../utils';
import type { Workout } from '../types';
import { format, isToday, isThisWeek, subWeeks, endOfWeek, eachWeekOfInterval } from 'date-fns';

export function Dashboard() {
  const { workout, startWorkout } = useActiveWorkout();
  const { setPage } = useNav();
  const profile = useProfile();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [stats, setStats] = useState({ streak: 0, weeklyCount: 0, totalPRs: 0, totalLifted: 0 });
  const [weeklyVolume, setWeeklyVolume] = useState<{ week: string; volume: number; count: number }[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<{ name: string; volume: number; color: string }[]>([]);

  const bodyMetrics = useMemo(() => ({
    bmi: calcBMI(profile.weightKg, profile.heightCm),
    idealWeight: Math.round(22 * (profile.heightCm / 100) ** 2),
  }), [profile.weightKg, profile.heightCm]);

  useEffect(() => {
    async function load() {
      const allCompleted = await db.workouts.filter(w => !!w.completedAt).toArray();
      const recent = await db.workouts.orderBy('completedAt').reverse().filter(w => !!w.completedAt).limit(5).toArray();
      setRecentWorkouts(recent);

      const prs = await db.personalRecords.count();

      const sorted = allCompleted.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      let streak = 0;
      const seenDays = new Set<string>();
      for (const w of sorted) {
        const day = format(new Date(w.completedAt!), 'yyyy-MM-dd');
        if (!seenDays.has(day)) {
          seenDays.add(day);
          streak += 1;
        }
      }

      const weeklyCount = allCompleted.filter(w => isThisWeek(new Date(w.completedAt!), { weekStartsOn: 1 })).length;
      const totalLifted = allCompleted.reduce((s, w) => s + (w.totalVolume ?? calcWorkoutVolume(w)), 0);

      const weeks = eachWeekOfInterval({ start: subWeeks(new Date(), 7), end: new Date() }, { weekStartsOn: 1 });
      const weekData = weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const items = allCompleted.filter((w) => {
          const date = new Date(w.completedAt!);
          return date >= weekStart && date <= weekEnd;
        });
        return {
          week: format(weekStart, 'MMM d'),
          volume: Math.round(items.reduce((sum, w) => sum + (w.totalVolume ?? calcWorkoutVolume(w)), 0) / 1000),
          count: items.length,
        };
      });

      const exercises = await db.exercises.toArray();
      const exMap = Object.fromEntries(exercises.map((ex) => [ex.id, ex]));
      const muscleVolumeTotals: Record<string, number> = {};
      for (const workout of allCompleted.slice(-20)) {
        for (const exercise of workout.exercises) {
          const exerciseData = exMap[exercise.exerciseId];
          if (!exerciseData) continue;
          const volume = exercise.sets.filter((s) => s.completed && s.type !== 'warmup').reduce((sum, set) => sum + set.weight * set.reps, 0);
          exerciseData.muscleGroups.forEach((group) => {
            muscleVolumeTotals[group] = (muscleVolumeTotals[group] ?? 0) + volume;
          });
        }
      }
      const muscleVolumeItems = Object.entries(muscleVolumeTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, volume]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), volume, color: getMuscleGroupColor(name) }));

      setStats({ streak, weeklyCount, totalPRs: prs, totalLifted });
      setWeeklyVolume(weekData);
      setMuscleVolume(muscleVolumeItems);
    }
    load();
  }, [profile]);

  const handleStartWorkout = () => {
    if (!workout) startWorkout();
    setPage('workout');
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-iron-400 text-sm font-medium">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">Welcome back</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPage('profile')} className="rounded-3xl border border-iron-800 bg-iron-900 p-3 text-iron-300 hover:text-white transition-colors">
            <User size={18} />
          </button>
          <button onClick={() => setPage('settings')} className="rounded-3xl border border-iron-800 bg-iron-900 p-3 text-iron-300 hover:text-white transition-colors">
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 grid gap-3 mb-6">
        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-iron-400 text-xs uppercase tracking-wide">Body metrics</p>
              <p className="text-white text-lg font-black mt-2">{profile.goal}</p>
            </div>
            <div className="rounded-3xl bg-volt-400/10 px-3 py-2 text-volt-300 text-xs font-semibold">Update profile</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-3xl bg-iron-950 p-4 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">Weight</p>
              <p className="text-white text-2xl font-black mt-2">{profile.weightKg} kg</p>
            </div>
            <div className="rounded-3xl bg-iron-950 p-4 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">Height</p>
              <p className="text-white text-2xl font-black mt-2">{profile.heightCm} cm</p>
            </div>
            <div className="rounded-3xl bg-iron-950 p-4 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">BMI</p>
              <p className="text-white text-2xl font-black mt-2">{bodyMetrics.bmi > 0 ? bodyMetrics.bmi.toFixed(1) : '–'}</p>
            </div>
            <div className="rounded-3xl bg-iron-950 p-4 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">Ideal weight</p>
              <p className="text-white text-2xl font-black mt-2">{bodyMetrics.idealWeight} kg</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Workout Streak', value: `${stats.streak}`, icon: Flame, color: 'text-ember-400' },
            { label: 'This Week', value: `${stats.weeklyCount}`, icon: Calendar, color: 'text-blue-400' },
            { label: 'Total PRs', value: `${stats.totalPRs}`, icon: Trophy, color: 'text-volt-400' },
            { label: 'Total Volume', value: stats.totalLifted > 1000 ? `${(stats.totalLifted / 1000).toFixed(1)}k` : `${stats.totalLifted}`, icon: TrendingUp, color: 'text-green-400' },
          ].map((item) => (
            <div key={item.label} className="bg-iron-900 rounded-3xl border border-iron-800 p-4">
              <item.icon size={18} className={`${item.color} mb-2`} />
              <p className="text-2xl font-black text-white">{item.value}</p>
              <p className="text-iron-500 text-xs mt-1 uppercase tracking-wide">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 mb-6">
        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-white font-bold">Weekly volume</p>
              <p className="text-iron-500 text-xs">Last 8 weeks</p>
            </div>
            <div className="text-iron-400 text-xs">kg × 1000</div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} wrapperStyle={{ borderRadius: 12, border: '1px solid #2b2b2b', background: '#121212' }} />
                <Bar dataKey="volume" name="t" fill="#d4f52a" radius={[8, 8, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-white font-bold">Weekly sessions</p>
              <p className="text-iron-500 text-xs">Workout frequency</p>
            </div>
            <div className="text-iron-400 text-xs">sessions</div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip wrapperStyle={{ borderRadius: 12, border: '1px solid #2b2b2b', background: '#121212' }} />
                <Line type="monotone" dataKey="count" stroke="#ff6b35" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-base">Focus areas</h2>
          <button onClick={() => setPage('analytics')} className="text-volt-400 text-sm font-medium">View trends</button>
        </div>
        <div className="grid gap-3">
          {muscleVolume.length === 0 ? (
            <div className="rounded-3xl bg-iron-900 border border-iron-800 p-4 text-iron-500 text-sm">Add workouts to see muscle group volume.</div>
          ) : muscleVolume.map((item) => (
            <div key={item.name} className="rounded-3xl bg-iron-900 border border-iron-800 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-white font-bold text-sm">{item.name}</p>
                <p className="text-iron-400 text-xs">{item.volume.toLocaleString()} kg</p>
              </div>
              <div className="h-2 rounded-full bg-iron-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.volume / muscleVolume[0].volume * 100)}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {workout === null && (
        <div className="mx-4 mb-6">
          <button onClick={handleStartWorkout}
            className="w-full py-4 rounded-2xl bg-volt-400 text-iron-950 font-black text-lg tracking-tight flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-volt-400/20">
            <Plus size={22} strokeWidth={3} /> Start Workout
          </button>
        </div>
      )}

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-base">Recent Workouts</h2>
          <button onClick={() => setPage('history')} className="text-volt-400 text-sm font-medium">See all</button>
        </div>
        {recentWorkouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-iron-900 rounded-2xl border border-iron-800">
            <Dumbbell size={32} className="text-iron-600 mb-3" />
            <p className="text-iron-400 text-sm">No workouts yet. Start lifting!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((w) => {
              const duration = w.completedAt && w.startedAt ? w.completedAt - w.startedAt : 0;
              const vol = w.totalVolume ?? calcWorkoutVolume(w);
              return (
                <button key={w.id} onClick={() => setPage('history')} className="w-full flex items-center gap-3 px-4 py-3 bg-iron-900 rounded-2xl border border-iron-800 text-left hover:border-iron-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-iron-800 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={18} className="text-volt-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{w.name}</p>
                    <p className="text-iron-500 text-xs">
                      {isToday(new Date(w.completedAt!)) ? 'Today' : format(new Date(w.completedAt!), 'MMM d')}
                      {duration > 0 && ` · ${formatDuration(duration)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-bold">{vol > 0 ? `${vol.toLocaleString()} kg` : '–'}</p>
                    <p className="text-iron-500 text-xs">{w.exercises?.length ?? 0} exercises</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
