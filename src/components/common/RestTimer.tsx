import { useEffect, useState, useCallback } from 'react';
import { X, SkipForward } from 'lucide-react';
import { useActiveWorkout } from '../../store/activeWorkout';
import { formatRestTime } from '../../utils';

export function RestTimer() {
  const { restTimer, stopRestTimer } = useActiveWorkout();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!restTimer) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - restTimer.startedAt) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [restTimer]);

  const skip = useCallback(() => {
    stopRestTimer();
    setElapsed(0);
  }, [stopRestTimer]);

  if (!restTimer) return null;

  const remaining = Math.max(0, restTimer.duration - elapsed);
  const progress = Math.min(1, elapsed / restTimer.duration);
  const isOver = remaining === 0;
  const circumference = 2 * Math.PI * 38;
  const strokeDash = circumference * (1 - progress);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-4 px-5 py-3 rounded-2xl shadow-2xl border ${
        isOver
          ? 'bg-volt-400/20 border-volt-400/50'
          : 'bg-iron-800 border-iron-600'
      }`}>
        {/* Circular timer */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r="38" fill="none" stroke="#333" strokeWidth="4" />
            <circle
              cx="42" cy="42" r="38" fill="none"
              stroke={isOver ? '#d4f52a' : '#d4f52a'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              className="transition-all duration-100"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-sm font-mono font-bold ${
            isOver ? 'text-volt-400' : 'text-white'
          }`}>
            {isOver ? '✓' : formatRestTime(remaining)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-iron-400 uppercase tracking-wider">
            {isOver ? 'Rest complete' : 'Resting'}
          </p>
          <p className="text-sm text-white font-medium">
            {isOver ? 'Ready when you are' : `${formatRestTime(restTimer.duration)} target`}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={skip}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-iron-700 hover:bg-volt-400/20 text-iron-300 hover:text-volt-400 transition-colors"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={skip}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-iron-700 hover:bg-red-500/20 text-iron-300 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
