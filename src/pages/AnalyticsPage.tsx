import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Trophy, Calendar, Activity } from 'lucide-react';
import { db } from '../db';
import type { Workout, Exercise, PersonalRecord, OverloadSuggestion } from '../types';
import { calcWorkoutVolume, getMuscleGroupColor, calcBMI, getBMICategory, getOverloadSuggestions } from '../utils';
import { useProfile } from '../store/profile';
import { format, subWeeks, endOfWeek, eachWeekOfInterval } from 'date-fns';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-iron-800 border border-iron-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-iron-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.value?.toLocaleString()} {p.name}</p>
      ))}
    </div>
  );
};

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const TREND_META = {
  improving: { label: '↑ Improving', cls: 'text-volt-400' },
  stalled:   { label: '→ Plateau',   cls: 'text-amber-400' },
  new:       { label: '★ New PR',    cls: 'text-iron-400' },
  deload:    { label: '↓ Deload',    cls: 'text-red-400' },
} as const;

export function AnalyticsPage() {
  const [tab, setTab] = useState<'overview' | 'volume' | 'prs'>('overview');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [overloadSuggestions, setOverloadSuggestions] = useState<OverloadSuggestion[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<{ week: string; volume: number; count: number }[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<{ name: string; volume: number; color: string }[]>([]);
  const profile = useProfile();
  const bmi = useMemo(() => calcBMI(profile.weightKg, profile.heightCm), [profile.weightKg, profile.heightCm]);
  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);

  useEffect(() => {
    async function load() {
      const all = await db.workouts.filter(w => !!w.completedAt).toArray();
      const exAll = await db.exercises.toArray();
      const prAll = await db.personalRecords.orderBy('achievedAt').reverse().toArray();
      const exMap: Record<string, Exercise> = {};
      exAll.forEach(e => { exMap[e.id] = e; });

      setWorkouts(all);
      setExercises(exMap);
      setPrs(prAll);
      setOverloadSuggestions(getOverloadSuggestions(all, exMap, 100));

      // Weekly volume (last 12 weeks)
      const now = new Date();
      const weeks = eachWeekOfInterval({ start: subWeeks(now, 11), end: now }, { weekStartsOn: 1 });
      const wv = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const ws = all.filter(w => {
          const d = new Date(w.completedAt!);
          return d >= weekStart && d <= weekEnd;
        });
        return {
          week: format(weekStart, 'MMM d'),
          volume: Math.round(ws.reduce((s, w) => s + (w.totalVolume ?? calcWorkoutVolume(w)), 0) / 1000),
          count: ws.length,
        };
      });
      setWeeklyVolume(wv);

      // Muscle group volume (last 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = all.filter(w => w.completedAt! > thirtyDaysAgo);
      const mgVol: Record<string, number> = {};
      for (const w of recent) {
        for (const ex of w.exercises) {
          const exData = exMap[ex.exerciseId];
          if (!exData) continue;
          const vol = ex.sets.filter(s => s.completed && s.type !== 'warmup').reduce((s, set) => s + set.weight * set.reps, 0);
          for (const mg of exData.muscleGroups) {
            mgVol[mg] = (mgVol[mg] ?? 0) + vol;
          }
        }
      }
      setMuscleVolume(Object.entries(mgVol).sort((a, b) => b[1] - a[1]).map(([name, volume]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        volume: Math.round(volume),
        color: getMuscleGroupColor(name),
      })));
    }
    load();
  }, []);

  const totalVol = workouts.reduce((s, w) => s + (w.totalVolume ?? calcWorkoutVolume(w)), 0);
  const avgDuration = workouts.length > 0
    ? workouts.reduce((s, w) => s + (w.completedAt! - w.startedAt), 0) / workouts.length
    : 0;

  // Build PR map, capturing most-recent achievedAt per exercise (prs is sorted desc by achievedAt)
  const prByExercise: Record<string, { name: string; weight?: number; e1rm?: number; achievedAt: number }> = {};
  for (const pr of prs) {
    if (!prByExercise[pr.exerciseId]) {
      prByExercise[pr.exerciseId] = {
        name: exercises[pr.exerciseId]?.name ?? 'Unknown',
        achievedAt: pr.achievedAt,
      };
    }
    if (pr.type === 'weight') prByExercise[pr.exerciseId].weight = pr.value;
    if (pr.type === 'estimated1rm') prByExercise[pr.exerciseId].e1rm = pr.value;
  }

  // Sort PRs by most recently achieved first
  const sortedPrEntries = Object.entries(prByExercise).sort(([, a], [, b]) => b.achievedAt - a.achievedAt);

  // Build overload map keyed by exerciseId for O(1) lookups in PR list
  const overloadMap = Object.fromEntries(overloadSuggestions.map(s => [s.exerciseId, s]));

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-iron-800">
        <h1 className="text-2xl font-black text-white">Analytics</h1>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        {(['overview', 'volume', 'prs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-300'}`}>
            {t === 'prs' ? 'PRs' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 space-y-4">
        {tab === 'overview' && (
          <>
            {profile.weightKg > 0 && profile.heightCm > 0 && (
              <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-white font-bold text-sm">Body metrics summary</p>
                    <p className="text-iron-500 text-xs">From your profile data</p>
                  </div>
                  <div className="text-iron-400 text-xs">{bmiCategory}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
                    <p className="text-iron-400 text-[11px] uppercase tracking-wide">Weight</p>
                    <p className="text-white text-xl font-black mt-2">{profile.weightKg} kg</p>
                  </div>
                  <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
                    <p className="text-iron-400 text-[11px] uppercase tracking-wide">Height</p>
                    <p className="text-white text-xl font-black mt-2">{profile.heightCm} cm</p>
                  </div>
                  <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
                    <p className="text-iron-400 text-[11px] uppercase tracking-wide">BMI</p>
                    <p className="text-white text-xl font-black mt-2">{bmi.toFixed(1)}</p>
                  </div>
                  <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
                    <p className="text-iron-400 text-[11px] uppercase tracking-wide">Goal</p>
                    <p className="text-white text-xl font-black mt-2">{profile.goal}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Workouts', value: workouts.length, icon: Activity, color: 'text-volt-400' },
                { label: 'Total Volume', value: `${(totalVol / 1000).toFixed(1)}t`, icon: TrendingUp, color: 'text-green-400' },
                { label: 'Avg Duration', value: avgDuration > 0 ? `${Math.round(avgDuration / 60000)}m` : '–', icon: Calendar, color: 'text-blue-400' },
                { label: 'Personal Records', value: prs.length, icon: Trophy, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-iron-900 rounded-2xl p-4 border border-iron-800">
                  <s.icon size={18} className={`${s.color} mb-2`} />
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-iron-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {muscleVolume.length > 0 && (
              <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4">
                <p className="text-white font-bold text-sm mb-4">Muscle Group Volume (30d)</p>
                <div className="space-y-2">
                  {muscleVolume.map(m => {
                    const maxVol = muscleVolume[0].volume;
                    return (
                      <div key={m.name} className="flex items-center gap-3">
                        <span className="text-iron-300 text-xs w-20 flex-shrink-0">{m.name}</span>
                        <div className="flex-1 h-2 bg-iron-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(m.volume / maxVol) * 100}%`, backgroundColor: m.color }} />
                        </div>
                        <span className="text-iron-400 text-xs w-16 text-right flex-shrink-0">{m.volume.toLocaleString()} kg</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'volume' && (
          <>
            <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4">
              <p className="text-white font-bold text-sm mb-1">Weekly Volume</p>
              <p className="text-iron-500 text-xs mb-4">Tonnes lifted per week (last 12 weeks)</p>
              {weeklyVolume.some(w => w.volume > 0) ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="volume" name="t" fill="#d4f52a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-iron-600 text-sm">Log workouts to see volume trends</div>
              )}
            </div>

            <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4">
              <p className="text-white font-bold text-sm mb-1">Weekly Sessions</p>
              <p className="text-iron-500 text-xs mb-4">Workouts per week</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={weeklyVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" name="sessions" stroke="#ff6b35" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === 'prs' && (
          <div className="space-y-2">
            {sortedPrEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-iron-500">
                <Trophy size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No PRs yet. Start training!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 pb-1">
                  <p className="text-xs text-iron-500">{sortedPrEntries.length} exercises tracked</p>
                  <p className="text-xs text-iron-600">Most recent first</p>
                </div>
                {sortedPrEntries.map(([id, pr]) => {
                  const suggestion = overloadMap[id];
                  const trendMeta = suggestion ? TREND_META[suggestion.trend] : null;
                  return (
                    <div key={id} className="bg-iron-900 rounded-2xl border border-iron-800 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                          <Trophy size={14} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{pr.name}</p>
                          <p className="text-iron-500 text-xs">{timeAgo(pr.achievedAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {pr.weight !== undefined && <p className="text-white font-bold text-sm">{pr.weight} kg</p>}
                          {pr.e1rm !== undefined && <p className="text-iron-500 text-xs">e1RM {pr.e1rm} kg</p>}
                          {trendMeta && <p className={`text-[10px] font-bold ${trendMeta.cls}`}>{trendMeta.label}</p>}
                        </div>
                      </div>
                      {/* Next target row */}
                      {suggestion && (
                        <div className="flex items-center gap-2 border-t border-iron-800 px-4 py-2.5">
                          <TrendingUp size={12} className="text-volt-400 flex-shrink-0" />
                          <p className="text-xs text-iron-400">
                            Next target:{' '}
                            <span className="font-bold text-volt-300">
                              {suggestion.suggestedWeight}kg × {suggestion.suggestedReps}
                            </span>
                            {suggestion.sessionCount > 1 && (
                              <span className="ml-2 text-iron-600">· {suggestion.sessionCount} sessions</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
