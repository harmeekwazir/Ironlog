import { useMemo, useState } from 'react';
import { User, Settings2, Sparkles } from 'lucide-react';
import { useNav } from '../store/nav';
import { useProfile, type ActivityLevel, type TrainingGoal } from '../store/profile';
import { calcBMI, getBMICategory, estimateMaintenanceCalories } from '../utils';

const GOALS: TrainingGoal[] = ['Build strength', 'Build muscle', 'Maintain', 'Lose fat'];
const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: '1–2 workouts / week' },
  { value: 'moderate', label: 'Moderate', description: '3–4 workouts / week' },
  { value: 'high', label: 'High', description: '5+ workouts / week' },
];

export function ProfilePage() {
  const { setPage } = useNav();
  const { weightKg, heightCm, age, goal, activityLevel, notes, updateProfile } = useProfile();
  const [localNotes, setLocalNotes] = useState(notes);

  const bmi = useMemo(() => calcBMI(weightKg, heightCm), [weightKg, heightCm]);
  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);
  const maintenanceCalories = useMemo(() => estimateMaintenanceCalories(weightKg, heightCm, age, activityLevel), [weightKg, heightCm, age, activityLevel]);

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-iron-800 flex items-center justify-between">
        <div>
          <p className="text-iron-400 text-xs uppercase tracking-wider">Profile</p>
          <h1 className="text-2xl font-black text-white">Body metrics</h1>
        </div>
        <button onClick={() => setPage('settings')} className="text-iron-300 hover:text-white transition-colors flex items-center gap-2 text-sm">
          <Settings2 size={16} /> Settings
        </button>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-3xl bg-volt-400/10 flex items-center justify-center text-volt-400">
              <User size={20} />
            </div>
            <div>
              <p className="text-white font-bold text-base">Personal metrics</p>
              <p className="text-iron-400 text-sm">Track weight, height, age and progress goals.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-xs uppercase tracking-wide">Weight</p>
              <p className="text-white text-2xl font-black mt-2">{weightKg} kg</p>
            </div>
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-xs uppercase tracking-wide">Height</p>
              <p className="text-white text-2xl font-black mt-2">{heightCm} cm</p>
            </div>
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-xs uppercase tracking-wide">BMI</p>
              <p className="text-white text-2xl font-black mt-2">{bmi > 0 ? bmi.toFixed(1) : '–'}</p>
            </div>
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-xs uppercase tracking-wide">Goal</p>
              <p className="text-white text-2xl font-black mt-2">{goal}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide">Weight (kg)</div>
            <input value={weightKg} onChange={(e) => updateProfile({ weightKg: Number(e.target.value) || 0 })}
              type="number" min={0} className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none" />
          </label>
          <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide">Height (cm)</div>
            <input value={heightCm} onChange={(e) => updateProfile({ heightCm: Number(e.target.value) || 0 })}
              type="number" min={0} className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide">Age</div>
            <input value={age} onChange={(e) => updateProfile({ age: Number(e.target.value) || 0 })}
              type="number" min={0} className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none" />
          </label>
          <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide">Activity</div>
            <select value={activityLevel} onChange={(e) => updateProfile({ activityLevel: e.target.value as ActivityLevel })}
              className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none appearance-none">
              {ACTIVITY_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide">Goal</div>
            <select value={goal} onChange={(e) => updateProfile({ goal: e.target.value as TrainingGoal })}
              className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none appearance-none">
              {GOALS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold">Body health metrics</p>
              <p className="text-iron-500 text-sm">Calculated from your weight, height and age.</p>
            </div>
            <div className="rounded-2xl bg-volt-400/10 px-3 py-2 text-volt-300 text-xs font-semibold">{bmiCategory}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">Ideal weight</p>
              <p className="text-white text-lg font-bold mt-2">{Math.round((22 * (heightCm / 100) ** 2) || 0)} kg</p>
            </div>
            <div className="rounded-2xl bg-iron-950 p-3 border border-iron-800">
              <p className="text-iron-400 text-[11px] uppercase tracking-wide">Maintenance</p>
              <p className="text-white text-lg font-bold mt-2">{maintenanceCalories ? `${maintenanceCalories} kcal` : '–'}</p>
            </div>
          </div>
          <p className="text-iron-500 text-xs">Use these metrics as a guide for workout planning and nutrition tracking.</p>
        </div>

        <label className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-2">
          <div className="flex items-center gap-2 text-iron-400 text-xs uppercase tracking-wide font-semibold">
            <Sparkles size={14} /> Notes
          </div>
          <textarea value={localNotes} onChange={(e) => { setLocalNotes(e.target.value); updateProfile({ notes: e.target.value }); }}
            rows={4} className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none resize-none" placeholder="Training notes, focus areas, or nutrition reminders" />
        </label>
      </div>
    </div>
  );
}
