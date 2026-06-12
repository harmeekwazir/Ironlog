import { useState, useEffect, useRef } from 'react';
import { Plus, Check, ChevronDown, ChevronUp, Trash2, Pencil, Play } from 'lucide-react';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { ExercisePicker } from '../components/common/ExercisePicker';
import { db } from '../db';
import type { Exercise, SetType, WorkoutSet } from '../types';
import { getSetTypeLabel, getSetTypeBadgeColor, formatDuration, estimate1RM } from '../utils';

const SET_TYPES: SetType[] = ['warmup', 'working', 'failure', 'dropset', 'amrap', 'tempo', 'assisted', 'partial'];
const DEFAULT_REST: Record<string, number> = { warmup: 60, working: 120, failure: 180, dropset: 60, amrap: 180, tempo: 90, assisted: 90, partial: 60 };

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono text-volt-400">{formatDuration(elapsed)}</span>;
}

export function WorkoutPage() {
  const { workout, startWorkout, addExercise, removeExercise, addSet, updateSet, completeSet, finishWorkout, discardWorkout, updateWorkoutName, startRestTimer } = useActiveWorkout();
  const { setPage } = useNav();
  const [showPicker, setShowPicker] = useState(false);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [showFinish, setShowFinish] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadExercises() {
      const all = await db.exercises.toArray();
      const map: Record<string, Exercise> = {};
      all.forEach(e => { map[e.id] = e; });
      setExercises(map);
    }
    loadExercises();
  }, []);

  if (!workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen pb-24 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-volt-400/10 border border-volt-400/20 flex items-center justify-center mb-6">
          <Play size={32} className="text-volt-400 ml-1" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Ready to train?</h2>
        <p className="text-iron-400 text-sm mb-8">Start a new workout session and track every set.</p>
        <button onClick={() => startWorkout()} className="w-full max-w-xs py-4 rounded-2xl bg-volt-400 text-iron-950 font-black text-lg active:scale-95 transition-transform">
          Start Workout
        </button>
      </div>
    );
  }

  if (summary) {
    const duration = summary.completedAt - summary.startedAt;
    const sets = summary.exercises.reduce((s: number, e: any) => s + e.sets.filter((x: any) => x.completed).length, 0);
    return (
      <div className="flex flex-col min-h-screen pb-24 px-4 pt-12 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-volt-400 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-iron-950" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-black text-white">Workout Complete!</h1>
          <p className="text-iron-400 text-sm mt-1">{summary.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Duration', value: formatDuration(duration) },
            { label: 'Total Sets', value: `${sets}` },
            { label: 'Total Volume', value: `${(summary.totalVolume ?? 0).toLocaleString()} kg` },
            { label: 'Exercises', value: `${summary.exercises.length}` },
          ].map(s => (
            <div key={s.label} className="bg-iron-900 rounded-2xl p-4 border border-iron-800 text-center">
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-iron-400 text-xs mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { setSummary(null); setPage('dashboard'); }} className="w-full py-4 rounded-2xl bg-volt-400 text-iron-950 font-black text-lg">
          Done
        </button>
      </div>
    );
  }

  const toggleExpanded = (i: number) => {
    setExpanded(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  };

  const handleFinish = async () => {
    const completed = await finishWorkout();
    if (completed) setSummary(completed);
  };

  const handleAddExercise = (exerciseId: string) => {
    addExercise(exerciseId);
    setExpanded(prev => new Set([...prev, workout.exercises.length]));
    setShowPicker(false);
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-iron-950/95 backdrop-blur border-b border-iron-800 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {editName ? (
              <input ref={nameRef} value={nameInput} onChange={e => setNameInput(e.target.value)}
                onBlur={() => { updateWorkoutName(nameInput || workout.name); setEditName(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { updateWorkoutName(nameInput || workout.name); setEditName(false); } }}
                className="text-xl font-black text-white bg-transparent outline-none border-b border-volt-400 w-full" />
            ) : (
              <button onClick={() => { setNameInput(workout.name); setEditName(true); setTimeout(() => nameRef.current?.focus(), 0); }}
                className="flex items-center gap-2 text-left">
                <h1 className="text-xl font-black text-white truncate">{workout.name}</h1>
                <Pencil size={14} className="text-iron-500 flex-shrink-0" />
              </button>
            )}
            <p className="text-iron-500 text-xs"><ElapsedTimer startedAt={workout.startedAt} /></p>
          </div>
          <button onClick={() => setShowFinish(true)} className="px-4 py-2 bg-volt-400 text-iron-950 rounded-xl font-bold text-sm">Finish</button>
        </div>
      </div>

      {/* Confirm finish dialog */}
      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
          <div className="w-full bg-iron-900 rounded-t-3xl p-6 space-y-3">
            <h2 className="text-xl font-black text-white text-center">Finish Workout?</h2>
            <p className="text-iron-400 text-sm text-center">Your session will be saved with all logged sets.</p>
            <button onClick={() => { setShowFinish(false); handleFinish(); }} className="w-full py-4 bg-volt-400 text-iron-950 rounded-2xl font-black text-lg">Save & Finish</button>
            <button onClick={() => { discardWorkout(); setShowFinish(false); setPage('dashboard'); }} className="w-full py-3 bg-iron-800 text-red-400 rounded-2xl font-semibold">Discard Workout</button>
            <button onClick={() => setShowFinish(false)} className="w-full py-3 text-iron-400 rounded-2xl font-semibold">Keep Going</button>
          </div>
        </div>
      )}

      {/* Exercises */}
      <div className="px-4 pt-4 space-y-3">
        {workout.exercises.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-iron-500 text-sm mb-1">No exercises added yet</p>
            <p className="text-iron-600 text-xs">Tap + Add Exercise below to get started</p>
          </div>
        )}
        {workout.exercises.map((ex, exIdx) => {
          const exData = exercises[ex.exerciseId];
          const isOpen = expanded.has(exIdx);
          const completedSets = ex.sets.filter(s => s.completed).length;
          return (
            <div key={ex.id} className="bg-iron-900 rounded-2xl border border-iron-800 overflow-hidden">
              <button onClick={() => toggleExpanded(exIdx)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{exData?.name ?? 'Exercise'}</p>
                  <p className="text-iron-500 text-xs">{completedSets}/{ex.sets.length} sets · {exData?.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  {completedSets === ex.sets.length && ex.sets.length > 0 && (
                    <div className="w-5 h-5 rounded-full bg-volt-400 flex items-center justify-center">
                      <Check size={12} className="text-iron-950" strokeWidth={3} />
                    </div>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeExercise(exIdx); }} className="w-7 h-7 flex items-center justify-center text-iron-600 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                  {isOpen ? <ChevronUp size={16} className="text-iron-400" /> : <ChevronDown size={16} className="text-iron-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-iron-800">
                  {/* Set header */}
                  <div className="grid grid-cols-[40px_1fr_80px_64px_40px] gap-1 px-4 py-2 text-[10px] text-iron-500 uppercase tracking-wider">
                    <span>Type</span><span></span><span className="text-center">Weight</span><span className="text-center">Reps</span><span></span>
                  </div>

                  {ex.sets.map((set, setIdx) => (
                    <SetRow key={set.id} set={set} setIdx={setIdx}
                      onUpdate={(u) => updateSet(exIdx, setIdx, u)}
                      onComplete={() => completeSet(exIdx, setIdx)}
                      onStartRest={() => startRestTimer(DEFAULT_REST[set.type] ?? 120, ex.exerciseId)}
                    />
                  ))}

                  {/* Add set buttons */}
                  <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
                    {(['working', 'warmup', 'dropset', 'failure', 'amrap'] as SetType[]).map(t => (
                      <button key={t} onClick={() => addSet(exIdx, t)}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-iron-800 text-iron-300 text-xs font-medium hover:bg-iron-700">
                        <Plus size={12} /> {getSetTypeLabel(t)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={() => setShowPicker(true)}
          className="w-full py-3 rounded-2xl border border-dashed border-iron-700 text-iron-400 font-semibold text-sm flex items-center justify-center gap-2 hover:border-volt-400/50 hover:text-volt-400 transition-colors">
          <Plus size={16} /> Add Exercise
        </button>
      </div>

      {showPicker && <ExercisePicker onSelect={handleAddExercise} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

interface SetRowProps {
  set: WorkoutSet;
  setIdx: number;
  onUpdate: (u: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onStartRest: () => void;
}

function SetRow({ set, setIdx, onUpdate, onComplete }: SetRowProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const badge = getSetTypeBadgeColor(set.type);
  const label = getSetTypeLabel(set.type);

  return (
    <div className={`grid grid-cols-[40px_1fr_80px_64px_40px] gap-1 items-center px-4 py-2 transition-colors ${set.completed ? 'bg-volt-400/5' : ''}`}>
      {/* Type badge */}
      <div className="relative">
        <button onClick={() => setTypeOpen(o => !o)} className={`text-[9px] font-bold px-1 py-0.5 rounded w-full text-center leading-tight ${badge}`}>
          {label.slice(0, 4)}
        </button>
        {typeOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-iron-800 rounded-xl border border-iron-700 shadow-xl py-1 min-w-[120px]">
            {SET_TYPES.map(t => (
              <button key={t} onClick={() => { onUpdate({ type: t }); setTypeOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-iron-200 hover:bg-iron-700 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full inline-block ${getSetTypeBadgeColor(t).split(' ')[0].replace('text-', 'bg-')}`} />
                {getSetTypeLabel(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Set number & e1rm hint */}
      <div className="flex flex-col">
        <span className="text-iron-500 text-xs">Set {setIdx + 1}</span>
        {set.weight > 0 && set.reps > 1 && (
          <span className="text-iron-600 text-[10px]">e1RM: {estimate1RM(set.weight, set.reps)}kg</span>
        )}
      </div>

      {/* Weight input */}
      <div className="flex items-center bg-iron-800 rounded-lg overflow-hidden">
        <button onClick={() => onUpdate({ weight: Math.max(0, (set.weight ?? 0) - 2.5) })} className="px-1.5 py-2 text-iron-400 text-sm font-bold active:bg-iron-700">−</button>
        <input type="number" value={set.weight || ''} onChange={e => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
          placeholder="0" className="flex-1 w-0 bg-transparent text-white text-center text-sm font-bold outline-none py-2" />
        <button onClick={() => onUpdate({ weight: (set.weight ?? 0) + 2.5 })} className="px-1.5 py-2 text-iron-400 text-sm font-bold active:bg-iron-700">+</button>
      </div>

      {/* Reps input */}
      <div className="flex items-center bg-iron-800 rounded-lg overflow-hidden">
        <button onClick={() => onUpdate({ reps: Math.max(0, (set.reps ?? 0) - 1) })} className="px-1.5 py-2 text-iron-400 text-sm font-bold active:bg-iron-700">−</button>
        <input type="number" value={set.reps || ''} onChange={e => onUpdate({ reps: parseInt(e.target.value) || 0 })}
          placeholder="0" className="flex-1 w-0 bg-transparent text-white text-center text-sm font-bold outline-none py-2" />
        <button onClick={() => onUpdate({ reps: (set.reps ?? 0) + 1 })} className="px-1.5 py-2 text-iron-400 text-sm font-bold active:bg-iron-700">+</button>
      </div>

      {/* Complete / remove */}
      <button onClick={onComplete}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${set.completed ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-400 hover:bg-iron-700'}`}>
        <Check size={14} strokeWidth={3} />
      </button>
    </div>
  );
}
