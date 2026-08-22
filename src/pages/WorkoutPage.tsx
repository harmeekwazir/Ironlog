import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, ChevronDown, ChevronUp, CopyPlus, Gauge, Mic,
  Pencil, Play, Plus, Save, Sparkles, Trash2, Trophy,
} from 'lucide-react';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { ExercisePicker } from '../components/common/ExercisePicker';
import { BottomSheet } from '../components/common/BottomSheet';
import { ReadinessSheet } from '../components/common/ReadinessSheet';
import { VoiceLoggerSheet } from '../components/common/VoiceLoggerSheet';
import { db } from '../db';
import type { Exercise, ReadinessCheck, SetType, Workout, WorkoutSet, WorkoutTemplate } from '../types';
import { estimate1RM, formatDuration, generateId, getSetTypeBadgeColor, getSetTypeLabel } from '../utils';
import { playPR, playWorkoutComplete } from '../utils/sound';
import { hapticPR, hapticWorkoutComplete } from '../utils/haptics';
import { useSyncStatus } from '../store/sync';

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
    workout, startWorkout, addExercise, removeExercise, addSet, removeSet, updateSet,
    completeSet, finishWorkout, discardWorkout, updateWorkoutName,
  } = useActiveWorkout();
  const { setPage } = useNav();
  const [showPicker, setShowPicker] = useState(false);
  const [showVoiceLogger, setShowVoiceLogger] = useState(false);
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
  const [prCount, setPrCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const lastSyncedAt = useSyncStatus(s => s.lastSyncedAt);

  useEffect(() => {
    if (!summary) return;
    if (prCount > 0) { playPR(); hapticPR(); } else { playWorkoutComplete(); hapticWorkoutComplete(); }
  }, [summary, prCount]);

  const loadData = async () => {
    const [allExercises, allTemplates] = await Promise.all([
      db.exercises.toArray(),
      db.templates.orderBy('createdAt').reverse().toArray(),
    ]);
    setExercises(Object.fromEntries(allExercises.map(e => [e.id, e])));
    setTemplates(allTemplates);
  };

  useEffect(() => { void loadData(); }, [lastSyncedAt]);

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
      updatedAt: Date.now(),
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
    const isPR = prCount > 0;
    return (
      <div className="min-h-screen px-4 pt-12 pb-28">
        <div className={`relative overflow-hidden rounded-[32px] border p-6 text-center ${
          isPR ? 'border-amber-400/25 bg-gradient-to-b from-amber-400/15 to-iron-900' : 'border-volt-400/20 bg-gradient-to-b from-volt-400/15 to-iron-900'
        }`}>
          <ConfettiBurst celebratory={isPR} />
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            className={`relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${isPR ? 'bg-amber-400' : 'bg-volt-400'}`}
          >
            <Check size={32} className="text-iron-950" strokeWidth={3} />
          </motion.div>
          <p className={`relative z-10 mt-5 text-xs font-bold uppercase tracking-[0.2em] ${isPR ? 'text-amber-300' : 'text-volt-300'}`}>
            {isPR ? 'New personal record!' : 'Session banked'}
          </p>
          <h1 className="relative z-10 mt-2 text-3xl font-black text-white">{summary.name}</h1>
          <p className="relative z-10 mt-2 text-sm text-iron-400">Load {summary.workload} AU · RPE {summary.sessionRpe}</p>
          {isPR && (
            <div className="relative z-10 mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-300">
              <Trophy size={14} /> {prCount} exercise{prCount > 1 ? 's' : ''} hit a new best
            </div>
          )}
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
    const result = await finishWorkout(sessionRpe, exercises);
    if (result) {
      setSummary(result.workout);
      setPrCount(result.prCount);
    }
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
          <button onClick={() => setShowVoiceLogger(true)} className="p-2.5 rounded-xl bg-iron-800 text-iron-300" aria-label="Log by voice">
            <Mic size={17} />
          </button>
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${item.sets.length > 0 && complete === item.sets.length ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-300'}`}>
                  {item.sets.length > 0 && complete === item.sets.length ? <Check size={17} /> : exerciseIndex + 1}
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
                    {item.sets.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-iron-700 px-4 py-5 text-center">
                        <p className="text-sm font-semibold text-iron-300">No sets yet</p>
                      </div>
                    )}
                    {item.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        setIndex={setIndex}
                        onUpdate={updates => updateSet(exerciseIndex, setIndex, updates)}
                        onComplete={() => completeSet(exerciseIndex, setIndex)}
                        onRemove={() => removeSet(exerciseIndex, setIndex)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pt-3 scrollbar-hide">
                    {SET_TYPES.map(type => (
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

      {showVoiceLogger && <VoiceLoggerSheet exercises={exercises} onClose={() => setShowVoiceLogger(false)} />}

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

interface ConfettiParticle { id: number; angle: number; distance: number; size: number; color: string; delay: number }

function ConfettiBurst({ celebratory }: { celebratory: boolean }) {
  // Lazy initializer runs once on mount — the blessed spot for one-time impure (random) setup.
  const [particles] = useState<ConfettiParticle[]>(() => {
    const colors = celebratory
      ? ['#fbbf24', '#f59e0b', '#fde68a', '#d4f52a']
      : ['#d4f52a', '#a3e635', '#e8ff5a'];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / 24 + Math.random() * 0.3,
      distance: 80 + Math.random() * 90,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length],
      delay: Math.random() * 0.12,
    }));
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      {particles.map(p => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance - 20,
            opacity: 0,
            scale: 0.4,
            rotate: 180,
          }}
          transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

function SetRow({ set, setIndex, onUpdate, onComplete, onRemove }: {
  set: WorkoutSet;
  setIndex: number;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const e1rm = estimate1RM(set.weight, set.reps);
  const config = SET_TYPE_CONFIG[set.type];
  const stress = ((set.rpe ?? config.defaultRpe) * Math.max(0.65, Math.min(1.35, set.reps / 10))).toFixed(1);
  const changeType = (type: SetType) => {
    const next = SET_TYPE_CONFIG[type];
    onUpdate({
      type,
      rpe: set.rpe ?? next.defaultRpe,
      restSeconds: next.restSeconds,
      tempo: type === 'tempo' ? (set.tempo ?? '3-1-1') : undefined,
    });
    setTypeOpen(false);
  };

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
                <button key={type} onClick={() => changeType(type)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-iron-200 hover:bg-iron-700">
                  {getSetTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex-1 text-xs font-bold text-iron-500">Set {setIndex + 1}</span>
        <span className="text-[10px] text-iron-600">stress {stress}</span>
        <button
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-iron-800 text-iron-500 hover:text-red-400"
          aria-label={`Remove set ${setIndex + 1}`}
        >
          <Trash2 size={13} />
        </button>
        <motion.button
          onClick={onComplete}
          animate={set.completed ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${set.completed ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-400'}`}
        >
          <Check size={14} strokeWidth={3} />
        </motion.button>
      </div>
      <div className={`grid gap-2 mt-3 ${config.showTempo ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <NumberField label={config.weightLabel} value={set.weight} step={2.5} onChange={weight => onUpdate({ weight })} />
        <NumberField label={config.repsLabel} value={set.reps} step={1} onChange={reps => onUpdate({ reps })} />
        <NumberField label="RPE" value={set.rpe ?? config.defaultRpe} step={0.5} min={1} max={10} onChange={rpe => onUpdate({ rpe })} />
        {config.showTempo && (
          <TextField label="tempo" value={set.tempo ?? '3-1-1'} onChange={tempo => onUpdate({ tempo })} />
        )}
        {config.showRest && (
          <NumberField label="rest sec" value={set.restSeconds ?? config.restSeconds} step={15} min={0} onChange={restSeconds => onUpdate({ restSeconds })} />
        )}
      </div>
      <p className="mt-2 min-h-4 text-right text-[10px] text-iron-600">
        {config.footer(set, e1rm)}
      </p>
    </div>
  );
}

const SET_TYPE_CONFIG: Record<SetType, {
  defaultRpe: number;
  restSeconds: number;
  weightLabel: string;
  repsLabel: string;
  showTempo?: boolean;
  showRest?: boolean;
  footer: (set: WorkoutSet, e1rm: number | null) => string;
}> = {
  warmup: {
    defaultRpe: 5,
    restSeconds: 60,
    weightLabel: 'kg',
    repsLabel: 'reps',
    showRest: true,
    footer: () => 'Warm-up sets stay out of PR and volume targets',
  },
  working: {
    defaultRpe: 7,
    restSeconds: 120,
    weightLabel: 'kg',
    repsLabel: 'reps',
    footer: (set, e1rm) => e1rm ? `Brzycki e1RM ${e1rm} kg` : set.reps > 0 && set.reps < 10 ? 'e1RM starts at 10 reps' : '',
  },
  failure: {
    defaultRpe: 10,
    restSeconds: 180,
    weightLabel: 'kg',
    repsLabel: 'reps hit',
    showRest: true,
    footer: () => 'Failure set: logged at max effort',
  },
  dropset: {
    defaultRpe: 9,
    restSeconds: 45,
    weightLabel: 'drop kg',
    repsLabel: 'drop reps',
    showRest: true,
    footer: () => 'Drop set: rest defaults short',
  },
  superset: {
    defaultRpe: 8,
    restSeconds: 60,
    weightLabel: 'kg',
    repsLabel: 'reps',
    showRest: true,
    footer: () => 'Superset: rest after the pairing',
  },
  amrap: {
    defaultRpe: 10,
    restSeconds: 180,
    weightLabel: 'kg',
    repsLabel: 'max reps',
    showRest: true,
    footer: (_set, e1rm) => e1rm ? `AMRAP e1RM ${e1rm} kg` : 'AMRAP uses achieved reps',
  },
  tempo: {
    defaultRpe: 8,
    restSeconds: 90,
    weightLabel: 'kg',
    repsLabel: 'reps',
    showTempo: true,
    showRest: true,
    footer: set => `Tempo ${set.tempo ?? '3-1-1'}`,
  },
  assisted: {
    defaultRpe: 8,
    restSeconds: 90,
    weightLabel: 'assist kg',
    repsLabel: 'reps',
    showRest: true,
    footer: () => 'Assisted set: kg means assistance used',
  },
  partial: {
    defaultRpe: 9,
    restSeconds: 75,
    weightLabel: 'kg',
    repsLabel: 'partials',
    showRest: true,
    footer: () => 'Partial reps logged separately',
  },
};

function NumberField({ label, value, step, min = 0, max, onChange }: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <label className="rounded-xl bg-iron-800 px-2 py-2">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-iron-600">{label}</span>
      <input
        type="number"
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={event => {
          const raw = event.target.value;
          setText(raw);
          if (raw !== '' && !Number.isNaN(Number(raw))) onChange(Number(raw));
        }}
        onBlur={() => {
          const clamped = Math.max(min, Math.min(max ?? Infinity, Number(text) || min));
          setText(String(clamped));
          onChange(clamped);
        }}
        className="mt-0.5 w-full bg-transparent text-base font-black text-white outline-none"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl bg-iron-800 px-2 py-2">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-iron-600">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-0.5 w-full bg-transparent text-base font-black text-white outline-none"
      />
    </label>
  );
}
