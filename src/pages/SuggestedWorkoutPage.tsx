import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { db } from '../db';
import { useActiveWorkout } from '../store/activeWorkout';
import { useNav } from '../store/nav';
import { ReadinessSheet } from '../components/common/ReadinessSheet';
import { SuggestedWorkoutCard } from '../components/common/SuggestedWorkoutCard';
import type { Exercise, ReadinessCheck, Workout } from '../types';
import { generateId, getWorkoutSuggestion } from '../utils';

const DEFAULT_REST = 120;

export function SuggestedWorkoutPage() {
  const { workout, startWorkout } = useActiveWorkout();
  const { setPage } = useNav();
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [pastWorkouts, setPastWorkouts] = useState<Workout[]>([]);
  const [showReadiness, setShowReadiness] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([db.exercises.toArray(), db.workouts.toArray()]).then(([allExercises, allWorkouts]) => {
      setExercises(Object.fromEntries(allExercises.map(e => [e.id, e])));
      setPastWorkouts(allWorkouts.filter(w => !w.isTemplate));
      setLoaded(true);
    });
  }, []);

  const suggestion = useMemo(
    () => (Object.keys(exercises).length ? getWorkoutSuggestion(pastWorkouts, exercises) : null),
    [pastWorkouts, exercises],
  );

  const handleReadinessComplete = (check: ReadinessCheck) => {
    if (!suggestion) return;
    startWorkout(`${suggestion.label} Day`, check, {
      id: generateId(),
      name: `${suggestion.label} Day`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      exercises: suggestion.exercises.map(e => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        targetReps: e.targetReps,
        restSeconds: DEFAULT_REST,
        type: 'working',
      })),
    });
    setShowReadiness(false);
    setPage('workout');
  };

  if (workout) {
    return (
      <div className="min-h-screen px-4 pt-12 pb-28 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-volt-400/10 flex items-center justify-center text-volt-400 mb-4">
          <Sparkles size={24} />
        </div>
        <h1 className="text-xl font-black text-white">A workout is already active</h1>
        <p className="text-iron-400 text-sm mt-2">Finish or discard it before starting a new suggestion.</p>
        <button onClick={() => setPage('workout')} className="mt-5 rounded-2xl bg-volt-400 px-5 py-3 text-sm font-black text-iron-950">
          Go to active workout
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="px-5 pt-12 pb-5">
        <p className="text-volt-400 text-xs font-bold uppercase tracking-[0.18em]">Suggestion engine</p>
        <h1 className="text-3xl font-black text-white mt-2">What should I train?</h1>
        <p className="text-iron-400 text-sm mt-2">Built from your recovery, training load and progression history.</p>
      </header>

      <div className="px-4">
        {!loaded ? (
          <div className="rounded-3xl border border-dashed border-iron-700 bg-iron-900/60 px-5 py-14 text-center">
            <p className="text-iron-300 text-sm font-semibold">Crunching your data…</p>
          </div>
        ) : !suggestion || suggestion.exercises.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-iron-700 bg-iron-900/60 px-5 py-14 text-center">
            <p className="text-iron-300 text-sm font-semibold">Not enough data yet</p>
            <p className="text-iron-600 text-xs mt-1">Log a few workouts and exercises so the engine has something to work with.</p>
          </div>
        ) : (
          <SuggestedWorkoutCard suggestion={suggestion} onStart={() => setShowReadiness(true)} />
        )}
      </div>

      {showReadiness && (
        <ReadinessSheet onClose={() => setShowReadiness(false)} onComplete={handleReadinessComplete} />
      )}
    </div>
  );
}
