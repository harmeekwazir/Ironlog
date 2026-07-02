import { Flame, Zap } from 'lucide-react';
import type { WorkoutSuggestion } from '../../types';

const LOAD_ADVICE_META: Record<WorkoutSuggestion['loadAdvice'], { label: string; cls: string }> = {
  normal: { label: 'Full session', cls: 'bg-volt-400/10 text-volt-300' },
  light: { label: 'Go lighter', cls: 'bg-amber-400/10 text-amber-300' },
  reduce: { label: 'Reduced load', cls: 'bg-red-400/10 text-red-300' },
};

export function SuggestedWorkoutCard({ suggestion, onStart }: { suggestion: WorkoutSuggestion; onStart: () => void }) {
  const advice = LOAD_ADVICE_META[suggestion.loadAdvice];
  return (
    <section className="overflow-hidden rounded-[28px] border border-iron-800 bg-iron-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-volt-400/10 flex items-center justify-center text-volt-400">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-volt-400 text-[11px] font-bold uppercase tracking-[0.15em]">Suggested for you</p>
            <h2 className="text-white text-lg font-black">{suggestion.label} Day</h2>
          </div>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${advice.cls}`}>{advice.label}</span>
      </div>
      <p className="text-iron-400 text-xs mt-3">{suggestion.reason}</p>
      <div className="mt-4 space-y-1.5">
        {suggestion.exercises.map(ex => (
          <div key={ex.exerciseId} className="flex items-center gap-3 rounded-xl bg-iron-950 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{ex.exerciseName}</p>
              <p className="text-iron-500 text-[11px]">
                {ex.sets} × {ex.targetReps}{ex.suggestedWeight ? ` @ ${ex.suggestedWeight}kg` : ''}
              </p>
            </div>
            {!ex.isFamiliar && (
              <span className="flex-shrink-0 rounded-full bg-blue-400/10 px-2 py-0.5 text-[9px] font-bold text-blue-300 flex items-center gap-1">
                <Flame size={9} /> New
              </span>
            )}
          </div>
        ))}
      </div>
      <button onClick={onStart} className="w-full mt-4 rounded-2xl bg-volt-400 py-3 text-sm font-black text-iron-950">
        Start this workout
      </button>
    </section>
  );
}
