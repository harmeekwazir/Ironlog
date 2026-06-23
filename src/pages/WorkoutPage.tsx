import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Check, ChevronDown, ChevronUp, CopyPlus, Gauge,
  Pencil, Play, Plus, Save, Sparkles, Trash2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { ExercisePicker } from '../components/common/ExercisePicker';
import { db } from '../db';
import type { Exercise, ReadinessCheck, SetType, Workout, WorkoutSet, WorkoutTemplate } from '../types';
import {
  calculateReadiness, estimate1RM, formatDuration, generateId,
  getReadinessLabel, getSetTypeBadgeColor, getSetTypeLabel,
} from '../utils';

const SET_TYPES: SetType[] = ['warmup', 'working', 'failure', 'dropset', 'amrap', 'tempo', 'assisted', 'partial'];
const DEFAULT_REST: Record<string, number> = { warmup: 60, working: 120, failure: 180, dropset: 60, amrap: 180, tempo: 90, assisted: 90, partial: 60 };

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Date.now() - startedAt);
    const frame = window.requestAnimationFrame(update);
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, [startedAt]);
  return <span className="font-mono text-volt-400">{formatDuration(elapsed)}</span>;
}

export function WorkoutPage() {
  const {
    workout, startWorkout, addExercise, removeExercise, addSet, updateSet,
    completeSet, finishWorkout, discardWorkout, updateWorkoutName,
  } = useActiveWorkout();
  const { setPage } = useNav();
  const [showPicker, setShowPicker] = useState(false);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [showFinish, setShowFinish] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [sessionRpe, setSessionRpe] = useState(7);
  const [pendingTemplate, setPendingTemplate] = useState<WorkoutTemplate | null | undefined>(undefined);
  const [summary, setSummary] = useState<Workout | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [allExercises, allTemplates] = await Promise.all([
      db.exercises.toArray(),
      db.templates.orderBy('createdAt').reverse().toArray(),
    ]);
    setExercises(Object.fromEntries(allExercises.map(e => [e.id, e])));
    setTemplates(allTemplates);
  };

  useEffect(() => {
    Promise.all([
      db.exercises.toArray(),
      db.templates.orderBy('createdAt').reverse().toArray(),
    ]).then(([allExercises, allTemplates]) => {
      setExercises(Object.fromEntries(allExercises.map(e => [e.id, e])));
      setTemplates(allTemplates);
    });
  }, []);

  const handleReadinessComplete = (check: ReadinessCheck) => {
    startWorkout('Quick Workout', check, pendingTemplate ?? undefined);
    setExpanded(new Set([0]));
    setPendingTemplate(undefined);
  };

  const saveAsTemplate = async () => {
    if (!workout) return;
    const template: WorkoutTemplate = {
      id: generateId(),
      name: templateName.trim() || workout.name,
      sourceWorkoutId: workout.id,
      createdAt: Date.now(),
      exercises: workout.exercises.map(item => ({
        exerciseId: item.exerciseId,
        sets: Math.max(1, item.sets.length),
        targetReps: String(item.sets.find(set => set.reps > 0)?.reps ?? '8-12'),
        restSeconds: item.restSeconds ?? DEFAULT_REST[item.sets[0]?.type ?? 'working'],
        type: item.sets[0]?.type ?? 'working',
      })),
    };
    await db.templates.put(template);
    setShowSaveTemplate(false);
    setTemplateName('');
    await loadData();
  };

  if (!workout && !summary) {
    return (
      <div className="min-h-screen pb-28">
        <header className="px-5 pt-12 pb-5">
          <p className="text-volt-400 text-xs font-bold uppercase tracking-[0.18em]">Training desk</p>
          <h1 className="text-3xl font-black text-white mt-2">What are we training?</h1>
          <p className="text-iron-400 text-sm mt-2">Every session starts with a quick readiness check.</p>
        </header>

        <div className="px-4 space-y-5">
          <button
            onClick={() => setPendingTemplate(null)}
            className="group w-full overflow-hidden rounded-[28px] border border-volt-400/25 bg-gradient-to-br from-volt-400/15 via-iron-900 to-iron-900 p-5 text-left"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-volt-400 text-iron-950 flex items-center justify-center">
                <Play size={21} fill="currentColor" />
              </div>
              <span className="text-volt-300 text-xs font-bold">Start fresh →</span>
            </div>
            <h2 className="text-white text-xl font-black mt-8">Blank workout</h2>
            <p className="text-iron-400 text-sm mt-1">Build the session as you go.</p>
          </button>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-white font-bold">Your templates</h2>
                <p className="text-iron-500 text-xs mt-0.5">Repeat the plan, progress the work.</p>
              </div>
              <CopyPlus size={18} className="text-iron-500" />
            </div>
            {templates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-iron-700 bg-iron-900/60 px-5 py-8 text-center">
                <p className="text-iron-300 text-sm font-semibold">No templates yet</p>
                <p className="text-iron-600 text-xs mt-1">Save one from an active workout.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(template => (
                  <div key={template.id} className="flex items-center gap-3 rounded-2xl border border-iron-800 bg-iron-900 p-3">
                    <button onClick={() => setPendingTemplate(template)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-iron-800 flex items-center justify-center text-volt-400">
                        <Sparkles size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{template.name}</p>
                        <p className="text-iron-500 text-xs">{template.exercises.length} exercises</p>
                      </div>
                    </button>
                    <button
                      onClick={async () => { await db.templates.delete(template.id); await loadData(); }}
                      className="p-2 text-iron-600 hover:text-red-400"
                      aria-label={`Delete ${template.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {pendingTemplate !== undefined && (
          <ReadinessSheet
            onClose={() => setPendingTemplate(undefined)}
            onComplete={handleReadinessComplete}
          />
        )}
      </div>
    );
  }

  if (summary) {
    const duration = summary.completedAt! - summary.startedAt;
    const sets = summary.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0);
    return (
      <div className="min-h-screen px-4 pt-12 pb-28">
        <div className="rounded-[32px] border border-volt-400/20 bg-gradient-to-b from-volt-400/15 to-iron-900 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-volt-400 flex items-center justify-center mx-auto">
            <Check size={32} className="text-iron-950" strokeWidth={3} />
          </div>
          <p className="text-volt-300 text-xs font-bold uppercase tracking-[0.2em] mt-5">Session banked</p>
          <h1 className="text-3xl font-black text-white mt-2">{summary.name}</h1>
          <p className="text-iron-400 text-sm mt-2">Load {summary.workload} AU · RPE {summary.sessionRpe}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            ['Duration', formatDuration(duration)],
            ['Completed sets', `${sets}`],
            ['Total volume', `${(summary.totalVolume ?? 0).toLocaleString()} kg`],
            ['Readiness', `${summary.readinessScore ?? '—'}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-iron-900 rounded-2xl p-4 border border-iron-800">
              <p className="text-xl font-black text-white">{value}</p>
              <p className="text-iron-500 text-[11px] mt-1 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { setSummary(null); setPage('dashboard'); }} className="w-full py-4 mt-5 rounded-2xl bg-volt-400 text-iron-950 font-black text-lg">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!workout) return null;

  const handleFinish = async () => {
    const completed = await finishWorkout(sessionRpe, exercises);
    if (completed) setSummary(completed);
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-30 border-b border-iron-800 bg-iron-950/95 px-4 pt-11 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {editName ? (
              <input
                ref={nameRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => { updateWorkoutName(nameInput || workout.name); setEditName(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { updateWorkoutName(nameInput || workout.name); setEditName(false); } }}
                className="w-full border-b border-volt-400 bg-transparent text-xl font-black text-white outline-none"
              />
            ) : (
              <button
                onClick={() => { setNameInput(workout.name); setEditName(true); window.setTimeout(() => nameRef.current?.focus(), 0); }}
                className="flex max-w-full items-center gap-2 text-left"
              >
                <h1 className="truncate text-xl font-black text-white">{workout.name}</h1>
                <Pencil size={14} className="shrink-0 text-iron-500" />
              </button>
            )}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <ElapsedTimer startedAt={workout.startedAt} />
              <span className="text-iron-700">•</span>
              <span className="text-iron-400">{workout.readinessScore}% ready</span>
              <span className="rounded-full bg-volt-400/10 px-1.5 py-0.5 text-[10px] font-bold text-volt-300">×{workout.recoveryMultiplier}</span>
            </div>
          </div>
          <button onClick={() => { setTemplateName(workout.name); setShowSaveTemplate(true); }} className="p-2.5 rounded-xl bg-iron-800 text-iron-300" aria-label="Save template">
            <Save size={17} />
          </button>
          <button onClick={() => setShowFinish(true)} className="rounded-xl bg-volt-400 px-4 py-2.5 text-sm font-black text-iron-950">Finish</button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {workout.exercises.length === 0 && (
          <div className="rounded-3xl border border-dashed border-iron-700 py-14 text-center">
            <p className="text-iron-300 text-sm font-semibold">Your session is empty</p>
            <p className="text-iron-600 text-xs mt-1">Add the first movement below.</p>
          </div>
        )}
        {workout.exercises.map((item, exerciseIndex) => {
          const exercise = exercises[item.exerciseId];
          const isOpen = expanded.has(exerciseIndex);
          const complete = item.sets.filter(set => set.completed).length;
          return (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-iron-800 bg-iron-900">
              <button
                onClick={() => setExpanded(previous => {
                  const next = new Set(previous);
                  if (next.has(exerciseIndex)) next.delete(exerciseIndex);
                  else next.add(exerciseIndex);
                  return next;
                })}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${complete === item.sets.length ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-300'}`}>
                  {complete === item.sets.length ? <Check size={17} /> : exerciseIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-white">{exercise?.name ?? 'Exercise'}</p>
                  <p className="text-xs text-iron-500">{complete}/{item.sets.length} sets · {exercise?.category}</p>
                </div>
                <button onClick={event => { event.stopPropagation(); removeExercise(exerciseIndex); }} className="p-2 text-iron-600 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
                {isOpen ? <ChevronUp size={17} className="text-iron-500" /> : <ChevronDown size={17} className="text-iron-500" />}
              </button>

              {isOpen && (
                <div className="border-t border-iron-800 px-3 pb-3">
                  <div className="space-y-2 pt-3">
                    {item.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        setIndex={setIndex}
                        onUpdate={updates => updateSet(exerciseIndex, setIndex, updates)}
                        onComplete={() => completeSet(exerciseIndex, setIndex)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pt-3 scrollbar-hide">
                    {(['working', 'warmup', 'dropset', 'failure', 'amrap'] as SetType[]).map(type => (
                      <button key={type} onClick={() => addSet(exerciseIndex, type)} className="flex shrink-0 items-center gap-1 rounded-xl bg-iron-800 px-3 py-2 text-xs font-semibold text-iron-300">
                        <Plus size={12} /> {getSetTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        <button onClick={() => setShowPicker(true)} className="w-full rounded-2xl border border-dashed border-iron-700 py-3.5 text-sm font-bold text-iron-400 hover:border-volt-400/50 hover:text-volt-400">
          <Plus size={16} className="inline mr-1" /> Add exercise
        </button>
      </div>

      {showPicker && <ExercisePicker onSelect={id => { addExercise(id); setExpanded(previous => new Set([...previous, workout.exercises.length])); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}

      {showSaveTemplate && (
        <BottomSheet onClose={() => setShowSaveTemplate(false)}>
          <Save size={22} className="text-volt-400" />
          <h2 className="text-xl font-black text-white mt-3">Save as template</h2>
          <p className="text-iron-400 text-sm mt-1">Sets, target reps, order and rest times will be reusable.</p>
          <input value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full mt-5 rounded-2xl border border-iron-700 bg-iron-800 px-4 py-3 text-white outline-none focus:border-volt-400" />
          <button onClick={() => void saveAsTemplate()} className="w-full mt-3 rounded-2xl bg-volt-400 py-3.5 font-black text-iron-950">Save template</button>
        </BottomSheet>
      )}

      {showFinish && (
        <BottomSheet onClose={() => setShowFinish(false)}>
          <Gauge size={24} className="text-volt-400" />
          <h2 className="text-xl font-black text-white mt-3">How hard was that?</h2>
          <p className="text-iron-400 text-sm mt-1">Session RPE × duration becomes your training load.</p>
          <div className="mt-5 rounded-2xl bg-iron-800 p-4">
            <div className="flex items-end justify-between">
              <span className="text-sm font-semibold text-iron-300">Session RPE</span>
              <span className="text-3xl font-black text-volt-400">{sessionRpe}</span>
            </div>
            <input type="range" min="1" max="10" step="0.5" value={sessionRpe} onChange={e => setSessionRpe(Number(e.target.value))} className="accent-volt-400 w-full mt-4" />
            <div className="flex justify-between text-[10px] text-iron-600"><span>Easy</span><span>Maximal</span></div>
          </div>
          <button onClick={() => void handleFinish()} className="w-full mt-4 rounded-2xl bg-volt-400 py-3.5 font-black text-iron-950">Save workout</button>
          <button onClick={() => { discardWorkout(); setShowFinish(false); setPage('dashboard'); }} className="w-full mt-2 py-3 text-sm font-semibold text-red-400">Discard workout</button>
        </BottomSheet>
      )}
    </div>
  );
}

function ReadinessSheet({ onClose, onComplete }: { onClose: () => void; onComplete: (check: ReadinessCheck) => void }) {
  const [values, setValues] = useState({ sleep: 3, soreness: 3, energy: 3, stress: 3, motivation: 3 });
  const result = useMemo(() => calculateReadiness(values), [values]);

  const submit = async () => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const existing = await db.readiness.where('date').equals(date).first();
    const check: ReadinessCheck = {
      id: existing?.id ?? generateId(),
      date,
      ...values,
      ...result,
      createdAt: Date.now(),
    };
    await db.readiness.put(check);
    onComplete(check);
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-volt-400 text-xs font-bold uppercase tracking-[0.18em]">Hooper check</p>
          <h2 className="text-2xl font-black text-white mt-2">How are you arriving?</h2>
          <p className="text-iron-400 text-sm mt-1">Five quick signals tune today’s recovery multiplier.</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-white">{result.score}</p>
          <p className="text-xs font-bold text-volt-400">{getReadinessLabel(result.score)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {([
          ['sleep', 'Sleep quality', 'Poor', 'Great'],
          ['soreness', 'Muscle soreness', 'Fresh', 'Very sore'],
          ['energy', 'Energy', 'Flat', 'Charged'],
          ['stress', 'Life stress', 'Calm', 'High'],
          ['motivation', 'Motivation', 'Low', 'Locked in'],
        ] as const).map(([key, label, low, high]) => (
          <label key={key} className="block">
            <div className="flex justify-between text-sm"><span className="font-semibold text-iron-200">{label}</span><span className="font-black text-white">{values[key]}/5</span></div>
            <input type="range" min="1" max="5" value={values[key]} onChange={e => setValues(previous => ({ ...previous, [key]: Number(e.target.value) }))} className="accent-volt-400 w-full mt-2" />
            <div className="flex justify-between text-[10px] text-iron-600"><span>{low}</span><span>{high}</span></div>
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-volt-400/15 bg-volt-400/5 p-3">
        <div className="flex items-center gap-2 text-sm text-iron-300"><BatteryCharging size={17} className="text-volt-400" /> Recovery multiplier</div>
        <span className="font-black text-volt-300">×{result.recoveryMultiplier}</span>
      </div>
      <button onClick={() => void submit()} className="w-full mt-4 rounded-2xl bg-volt-400 py-3.5 font-black text-iron-950">Start workout</button>
    </BottomSheet>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border-t border-iron-700 bg-iron-900 p-5 pb-8 animate-slide-up">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-iron-500"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

function SetRow({ set, setIndex, onUpdate, onComplete }: {
  set: WorkoutSet;
  setIndex: number;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const e1rm = estimate1RM(set.weight, set.reps);
  const stress = ((set.rpe ?? 7) * Math.max(0.65, Math.min(1.35, set.reps / 10))).toFixed(1);

  return (
    <div className={`rounded-2xl border p-3 transition-colors ${set.completed ? 'border-volt-400/25 bg-volt-400/5' : 'border-iron-800 bg-iron-950/70'}`}>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setTypeOpen(open => !open)} className={`rounded-lg px-2 py-1 text-[10px] font-black ${getSetTypeBadgeColor(set.type)}`}>
            {getSetTypeLabel(set.type)}
          </button>
          {typeOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-36 rounded-xl border border-iron-700 bg-iron-800 p-1 shadow-xl">
              {SET_TYPES.map(type => (
                <button key={type} onClick={() => { onUpdate({ type }); setTypeOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-iron-200 hover:bg-iron-700">
                  {getSetTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex-1 text-xs font-bold text-iron-500">Set {setIndex + 1}</span>
        <span className="text-[10px] text-iron-600">stress {stress}</span>
        <button onClick={onComplete} className={`w-8 h-8 rounded-xl flex items-center justify-center ${set.completed ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-400'}`}>
          <Check size={14} strokeWidth={3} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <NumberField label="kg" value={set.weight} step={2.5} onChange={weight => onUpdate({ weight })} />
        <NumberField label="reps" value={set.reps} step={1} onChange={reps => onUpdate({ reps })} />
        <NumberField label="RPE" value={set.rpe ?? 7} step={0.5} min={1} max={10} onChange={rpe => onUpdate({ rpe })} />
      </div>
      <p className="mt-2 h-4 text-right text-[10px] text-iron-600">
        {e1rm ? `Brzycki e1RM ${e1rm} kg` : set.reps > 0 && set.reps < 10 ? 'e1RM starts at 10 reps' : ''}
      </p>
    </div>
  );
}

function NumberField({ label, value, step, min = 0, max, onChange }: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl bg-iron-800 px-2 py-2">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-iron-600">{label}</span>
      <input
        type="number"
        value={value || ''}
        step={step}
        min={min}
        max={max}
        onChange={event => onChange(Math.max(min, Math.min(max ?? Infinity, Number(event.target.value) || 0)))}
        className="mt-0.5 w-full bg-transparent text-base font-black text-white outline-none"
      />
    </label>
  );
}
