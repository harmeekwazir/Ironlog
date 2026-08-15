import { useEffect, useState } from 'react';
import { ChevronRight, Dumbbell, X, Calendar, Timer, Zap, Weight, Save, Check } from 'lucide-react';
import { db } from '../db';
import type { Workout, Exercise } from '../types';
import { formatDuration, calcWorkoutVolume, generateId } from '../utils';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useSyncStatus } from '../store/sync';

function groupByDate(workouts: Workout[]): Record<string, Workout[]> {
  const groups: Record<string, Workout[]> = {};
  for (const w of workouts) {
    const d = new Date(w.completedAt!);
    let label: string;
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else if (isThisWeek(d, { weekStartsOn: 1 })) label = format(d, 'EEEE');
    else label = format(d, 'MMMM d, yyyy');
    if (!groups[label]) groups[label] = [];
    groups[label].push(w);
  }
  return groups;
}

export function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [selected, setSelected] = useState<Workout | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const lastSyncedAt = useSyncStatus(s => s.lastSyncedAt);

  useEffect(() => {
    async function load() {
      const all = await db.workouts.filter(w => !!w.completedAt).reverse().sortBy('completedAt');
      const exAll = await db.exercises.toArray();
      const map: Record<string, Exercise> = {};
      exAll.forEach(e => { map[e.id] = e; });
      setWorkouts(all.reverse());
      setExercises(map);
    }
    load();
  }, [lastSyncedAt]);

  const groups = groupByDate([...workouts].reverse());

  const saveAsTemplate = async (workout: Workout) => {
    const existing = await db.templates.filter(template => template.sourceWorkoutId === workout.id).first();
    const id = existing?.id ?? generateId();
    await db.templates.put({
      id,
      name: workout.name,
      sourceWorkoutId: workout.id,
      createdAt: existing?.createdAt ?? Date.now(),
      lastUsed: existing?.lastUsed,
      updatedAt: Date.now(),
      exercises: workout.exercises.map(item => {
        const completedSets = item.sets.filter(set => set.completed);
        const referenceSets = completedSets.length > 0 ? completedSets : item.sets;
        const firstSet = referenceSets[0];
        return {
          exerciseId: item.exerciseId,
          sets: Math.max(1, referenceSets.length),
          targetReps: String(firstSet?.reps || '8-12'),
          restSeconds: item.restSeconds ?? firstSet?.restSeconds ?? 120,
          type: firstSet?.type ?? 'working',
        };
      }),
    });
    setSavedTemplateId(workout.id);
  };

  if (selected) {
    const duration = selected.completedAt! - selected.startedAt;
    const totalVol = selected.totalVolume ?? calcWorkoutVolume(selected);
    const totalSets = selected.exercises.reduce((s, e) => s + e.sets.filter(x => x.completed).length, 0);
    return (
      <div className="flex flex-col min-h-full pb-24">
        <div className="sticky top-0 z-10 bg-iron-950/95 backdrop-blur border-b border-iron-800 px-4 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-iron-400">
            <X size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white">{selected.name}</h1>
            <p className="text-iron-500 text-xs">{format(new Date(selected.completedAt!), 'PPP')}</p>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          <button
            onClick={() => void saveAsTemplate(selected)}
            disabled={savedTemplateId === selected.id}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl border py-3 font-bold text-sm transition-colors ${
              savedTemplateId === selected.id
                ? 'border-volt-400/20 bg-volt-400/10 text-volt-300'
                : 'border-iron-700 bg-iron-900 text-white hover:border-volt-400/40'
            }`}
          >
            {savedTemplateId === selected.id ? <Check size={16} /> : <Save size={16} />}
            {savedTemplateId === selected.id ? 'Saved to templates' : 'Save as template'}
          </button>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Timer, label: 'Duration', value: formatDuration(duration) },
              { icon: Zap, label: 'Sets', value: `${totalSets}` },
              { icon: Weight, label: 'Volume', value: totalVol > 0 ? `${(totalVol).toLocaleString()}` : '–' },
            ].map(s => (
              <div key={s.label} className="bg-iron-900 rounded-2xl p-3 border border-iron-800 text-center">
                <s.icon size={16} className="text-volt-400 mx-auto mb-1" />
                <p className="text-white font-black text-sm">{s.value}</p>
                <p className="text-iron-500 text-[10px] uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {selected.exercises.map((ex) => {
            const exData = exercises[ex.exerciseId];
            const completedSets = ex.sets.filter(s => s.completed);
            return (
              <div key={ex.id} className="bg-iron-900 rounded-2xl border border-iron-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-iron-800">
                  <p className="text-white font-bold text-sm">{exData?.name ?? 'Exercise'}</p>
                  <p className="text-iron-500 text-xs">{completedSets.length} sets</p>
                </div>
                <div className="divide-y divide-iron-800/40">
                  {completedSets.map((set, si) => (
                    <div key={set.id} className="flex items-center px-4 py-2 gap-3">
                      <span className="text-iron-600 text-xs w-8">#{si + 1}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-iron-800 text-iron-300 capitalize">{set.type}</span>
                      <span className="text-white font-bold text-sm flex-1">{set.weight} kg × {set.reps}</span>
                      <span className="text-iron-500 text-xs">{Math.round(set.weight * set.reps)} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-iron-800">
        <h1 className="text-2xl font-black text-white">History</h1>
        <p className="text-iron-500 text-sm mt-0.5">{workouts.length} workouts logged</p>
      </div>

      {workouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-24">
          <Calendar size={40} className="text-iron-700 mb-3" />
          <p className="text-iron-400 text-sm">No workouts yet</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {Object.entries(groups).map(([label, ws]) => (
            <div key={label}>
              <p className="text-iron-500 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
              <div className="space-y-2">
                {ws.map(w => {
                  const duration = w.completedAt! - w.startedAt;
                  return (
                    <button key={w.id} onClick={() => setSelected(w)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-iron-900 rounded-2xl border border-iron-800 text-left hover:border-iron-700 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-iron-800 flex items-center justify-center flex-shrink-0">
                        <Dumbbell size={18} className="text-volt-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{w.name}</p>
                        <p className="text-iron-500 text-xs">{formatDuration(duration)} · {w.exercises?.length ?? 0} exercises</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white text-sm font-bold">{(w.totalVolume ?? calcWorkoutVolume(w)).toLocaleString()}</p>
                        <p className="text-iron-600 text-[10px]">kg</p>
                      </div>
                      <ChevronRight size={14} className="text-iron-600 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}
