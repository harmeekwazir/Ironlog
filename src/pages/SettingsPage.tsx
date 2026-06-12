import { useState } from 'react';
import { Download, Upload, Trash2, Database, Info, ChevronRight, Shield, Smartphone, User, Settings2 } from 'lucide-react';
import { db } from '../db';
import { useNav } from '../store/nav';
import { useProfile } from '../store/profile';

export function SettingsPage() {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const { setPage } = useNav();
  const profile = useProfile();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleExportJSON = async () => {
    const workouts = await db.workouts.toArray();
    const exercises = await db.exercises.toArray();
    const prs = await db.personalRecords.toArray();
    const templates = await db.templates.toArray();
    const data = { version: 1, exportedAt: new Date().toISOString(), workouts, exercises, prs, templates };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ironlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    flash('Backup exported successfully');
  };

  const handleExportCSV = async () => {
    const workouts = await db.workouts.filter(w => !!w.completedAt).toArray();
    const exercises = await db.exercises.toArray();
    const exMap: Record<string, string> = {};
    exercises.forEach(e => { exMap[e.id] = e.name; });

    const rows: string[][] = [['Date', 'Workout', 'Exercise', 'Set #', 'Type', 'Weight (kg)', 'Reps', 'Volume']];
    for (const w of workouts) {
      for (const ex of w.exercises) {
        ex.sets.filter(s => s.completed).forEach((s, i) => {
          rows.push([
            new Date(w.completedAt!).toISOString().slice(0, 10),
            w.name,
            exMap[ex.exerciseId] ?? ex.exerciseId,
            String(i + 1), s.type, String(s.weight), String(s.reps), String(s.weight * s.reps),
          ]);
        });
      }
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ironlog-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    flash('CSV exported successfully');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.workouts) await db.workouts.bulkPut(data.workouts);
      if (data.exercises) await db.exercises.bulkPut(data.exercises);
      if (data.prs) await db.personalRecords.bulkPut(data.prs);
      flash('Backup restored successfully! Refresh the app.');
    } catch {
      flash('Failed to import — invalid file format');
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    await db.workouts.clear();
    await db.personalRecords.clear();
    setConfirm(null);
    flash('All workout data cleared');
  };

  const handleClearWorkouts = async () => {
    await db.workouts.clear();
    await db.personalRecords.clear();
    setConfirm(null);
    flash('Workout history cleared');
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-iron-800">
        <h1 className="text-2xl font-black text-white">Settings</h1>
      </div>

      {msg && (
        <div className="mx-4 mt-4 px-4 py-3 bg-volt-400/10 border border-volt-400/30 rounded-xl text-volt-400 text-sm font-medium animate-fade-in">
          {msg}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {/* Data section */}
        <div>
          <p className="text-iron-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">Data & Backup</p>
          <div className="bg-iron-900 rounded-2xl border border-iron-800 overflow-hidden divide-y divide-iron-800">
            <button onClick={handleExportJSON} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-iron-800/50 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-volt-400/10 flex items-center justify-center"><Download size={16} className="text-volt-400" /></div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Export Backup (JSON)</p>
                <p className="text-iron-500 text-xs">Full backup of all workout data</p>
              </div>
              <ChevronRight size={14} className="text-iron-600" />
            </button>

            <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-iron-800/50 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center"><Download size={16} className="text-blue-400" /></div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Export as CSV</p>
                <p className="text-iron-500 text-xs">Spreadsheet-compatible format</p>
              </div>
              <ChevronRight size={14} className="text-iron-600" />
            </button>

            <label className="w-full flex items-center gap-3 px-4 py-4 hover:bg-iron-800/50 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center"><Upload size={16} className="text-green-400" /></div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Import Backup</p>
                <p className="text-iron-500 text-xs">Restore from a JSON backup file</p>
              </div>
              <ChevronRight size={14} className="text-iron-600" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        <div>
          <p className="text-iron-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">Profile</p>
          <button onClick={() => setPage('profile')} className="w-full bg-iron-900 rounded-2xl border border-iron-800 p-4 text-left hover:border-volt-400/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-volt-400/10 flex items-center justify-center text-volt-300">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Body metrics & goals</p>
                <p className="text-iron-500 text-xs">Weight {profile.weightKg} kg · Height {profile.heightCm} cm · Goal {profile.goal}</p>
              </div>
              <Settings2 size={16} className="text-iron-500" />
            </div>
          </button>
        </div>

        {/* Privacy */}
        <div>
          <p className="text-iron-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">Privacy</p>
          <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4 space-y-3">
            {[
              { icon: Shield, label: 'No account required', desc: 'IronLog works 100% offline', color: 'text-volt-400', bg: 'bg-volt-400/10' },
              { icon: Database, label: 'Stored on your device', desc: 'IndexedDB — your data stays local', color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { icon: Smartphone, label: 'Install as PWA', desc: 'Add to home screen for app experience', color: 'text-purple-400', bg: 'bg-purple-400/10' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}><s.icon size={14} className={s.color} /></div>
                <div>
                  <p className="text-white text-sm font-medium">{s.label}</p>
                  <p className="text-iron-500 text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div>
          <p className="text-iron-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">Danger Zone</p>
          <div className="bg-iron-900 rounded-2xl border border-red-900/30 overflow-hidden divide-y divide-iron-800">
            <button onClick={() => setConfirm('workouts')} className="w-full flex items-center gap-3 px-4 py-4 text-left">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center"><Trash2 size={16} className="text-red-400" /></div>
              <div className="flex-1">
                <p className="text-red-400 font-semibold text-sm">Clear Workout History</p>
                <p className="text-iron-500 text-xs">Delete all workouts and PRs</p>
              </div>
            </button>
          </div>
        </div>

        {/* App info */}
        <div className="flex items-center gap-3 px-1">
          <Info size={14} className="text-iron-600" />
          <p className="text-iron-600 text-xs">IronLog v1.0 · Local-first · No tracking · Open source</p>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
          <div className="w-full bg-iron-900 rounded-t-3xl p-6 space-y-3">
            <h2 className="text-xl font-black text-white text-center">Are you sure?</h2>
            <p className="text-iron-400 text-sm text-center">This action cannot be undone. All your workout history will be permanently deleted.</p>
            <button onClick={confirm === 'all' ? handleClearAll : handleClearWorkouts} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-lg">Delete Forever</button>
            <button onClick={() => setConfirm(null)} className="w-full py-3 bg-iron-800 text-iron-300 rounded-2xl font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
