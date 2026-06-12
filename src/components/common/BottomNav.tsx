import { Home, Dumbbell, BarChart2, Clock, BookOpen } from 'lucide-react';
import { useNav, type Page } from '../../store/nav';
import { useActiveWorkout } from '../../store/activeWorkout';

const navItems: { page: Page; icon: React.ElementType; label: string }[] = [
  { page: 'dashboard', icon: Home, label: 'Home' },
  { page: 'history', icon: Clock, label: 'History' },
  { page: 'workout', icon: Dumbbell, label: 'Train' },
  { page: 'analytics', icon: BarChart2, label: 'Stats' },
  { page: 'exercises', icon: BookOpen, label: 'Exercises' },
];

export function BottomNav() {
  const { page, setPage } = useNav();
  const { workout } = useActiveWorkout();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-iron-950/95 backdrop-blur-xl border-t border-iron-800">
      <div className="flex items-center">
        {navItems.map(({ page: p, icon: Icon, label }) => {
          const isActive = page === p;
          const isWorkout = p === 'workout';
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                isWorkout
                  ? 'py-1'
                  : isActive
                  ? 'text-volt-400'
                  : 'text-iron-500 hover:text-iron-300'
              }`}
            >
              {isWorkout ? (
                <div className={`w-12 h-12 -mt-4 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                  isActive
                    ? 'bg-volt-400 text-iron-950 scale-110'
                    : workout
                    ? 'bg-ember-500 text-white animate-pulse'
                    : 'bg-iron-700 text-iron-300'
                }`}>
                  <Icon size={22} />
                  {workout && !isActive && (
                    <span className="absolute top-0 right-1/4 w-2 h-2 bg-volt-400 rounded-full border border-iron-950" />
                  )}
                </div>
              ) : (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[10px] mt-0.5 font-medium">{label}</span>
                </>
              )}
              {isWorkout && (
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-volt-400' : workout ? 'text-ember-400' : 'text-iron-500'}`}>
                  {workout ? 'Active' : 'Train'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area padding */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
