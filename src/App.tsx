import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { useNav } from './store/nav';
import { BottomNav } from './components/common/BottomNav';
import { RestTimer } from './components/common/RestTimer';
import { Dashboard } from './pages/Dashboard';
import { WorkoutPage } from './pages/WorkoutPage';
import { HistoryPage } from './pages/HistoryPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { seedExercises } from './db';

function PageRouter() {
  const { page } = useNav();
  switch (page) {
    case 'dashboard': return <Dashboard />;
    case 'workout': return <WorkoutPage />;
    case 'history': return <HistoryPage />;
    case 'exercises': return <ExercisesPage />;
    case 'analytics': return <AnalyticsPage />;
    case 'settings': return <SettingsPage />;
    case 'profile': return <ProfilePage />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    seedExercises();
  }, []);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setShowSplash(false), 1100);
    const removeTimer = window.setTimeout(() => setSplashVisible(false), 1600);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-iron-950 text-white tap-highlight-none max-w-lg mx-auto relative overflow-hidden">
      <main className="flex-1">
        <PageRouter />
      </main>
      <BottomNav />
      <RestTimer />
      {splashVisible && (
        <div className={`fixed inset-0 z-50 bg-iron-950 flex items-center justify-center p-6 transition-opacity duration-500 ease-out ${showSplash ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-volt-400/15 border border-volt-400/25 flex items-center justify-center mx-auto animate-pulse">
              <Dumbbell size={36} className="text-volt-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">IronLog</h1>
              <p className="text-iron-400 text-sm mt-2">Track lifts, volume, and PRs with confidence.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
