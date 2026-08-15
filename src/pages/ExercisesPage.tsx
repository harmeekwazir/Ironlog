import { useEffect, useState } from 'react';
import { Search, Plus, X, Trash2, ChevronRight, ChevronLeft, Dumbbell } from 'lucide-react';
import { db } from '../db';
import type { Exercise, MuscleGroup } from '../types';
import { generateId } from '../utils';
import { useNav } from '../store/nav';
import { useSyncStatus } from '../store/sync';

const CATEGORIES: { key: MuscleGroup | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
];

const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'bands', 'other'];

export function ExercisesPage() {
  const { setPage } = useNav();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MuscleGroup | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [form, setForm] = useState({ name: '', category: 'chest' as MuscleGroup, equipment: ['barbell'] as string[], notes: '' });
  const [prs, setPrs] = useState<Record<string, { weight?: number; e1rm?: number }>>({});
  const lastSyncedAt = useSyncStatus(s => s.lastSyncedAt);

  async function reload() {
    const all = await db.exercises.toArray();
    setExercises(all);
    const prAll = await db.personalRecords.toArray();
    const map: Record<string, { weight?: number; e1rm?: number }> = {};
    for (const pr of prAll) {
      if (!map[pr.exerciseId]) map[pr.exerciseId] = {};
      if (pr.type === 'weight') map[pr.exerciseId].weight = pr.value;
      if (pr.type === 'estimated1rm') map[pr.exerciseId].e1rm = pr.value;
    }
    setPrs(map);
  }

  useEffect(() => { reload(); }, [lastSyncedAt]);

  const filtered = exercises.filter(e => {
    const matchQ = e.name.toLowerCase().includes(query.toLowerCase());
    const matchC = category === 'all' || e.category === category;
    return matchQ && matchC;
  });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const ex: Exercise = {
      id: generateId(),
      name: form.name.trim(),
      muscleGroups: [form.category],
      equipment: form.equipment as any,
      category: form.category,
      notes: form.notes || undefined,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.exercises.add(ex);
    setForm({ name: '', category: 'chest', equipment: ['barbell'], notes: '' });
    setShowCreate(false);
    reload();
  };

  const handleDelete = async (ex: Exercise) => {
    await db.exercises.delete(ex.id);
    setSelected(null);
    reload();
  };

  if (selected) {
    const pr = prs[selected.id] ?? {};
    return (
      <div className="flex flex-col min-h-full pb-24">
        <div className="sticky top-0 z-10 bg-iron-950/95 backdrop-blur border-b border-iron-800 px-4 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-iron-400"><X size={20} /></button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white">{selected.name}</h1>
            <p className="text-iron-500 text-xs capitalize">{selected.category}</p>
          </div>
          {selected.isCustom && (
            <button onClick={() => handleDelete(selected)} className="w-8 h-8 flex items-center justify-center text-red-400"><Trash2 size={16} /></button>
          )}
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Best Weight', value: pr.weight ? `${pr.weight} kg` : '–' },
              { label: 'Est. 1RM', value: pr.e1rm ? `${pr.e1rm} kg` : '–' },
            ].map(s => (
              <div key={s.label} className="bg-iron-900 rounded-2xl p-4 border border-iron-800 text-center">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-iron-500 text-xs uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4 space-y-3">
            <div className="flex justify-between"><span className="text-iron-400 text-sm">Category</span><span className="text-white text-sm capitalize font-medium">{selected.category}</span></div>
            <div className="flex justify-between"><span className="text-iron-400 text-sm">Equipment</span><span className="text-white text-sm capitalize font-medium">{selected.equipment.join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-iron-400 text-sm">Type</span><span className="text-white text-sm font-medium">{selected.isCustom ? 'Custom' : 'Built-in'}</span></div>
          </div>
          {selected.notes && (
            <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4">
              <p className="text-iron-400 text-xs uppercase tracking-wider mb-2">Notes</p>
              <p className="text-white text-sm">{selected.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-iron-950/95 backdrop-blur border-b border-iron-800">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setPage('settings')} className="w-8 h-8 flex items-center justify-center rounded-full text-iron-400 -ml-1.5" aria-label="Back to settings"><ChevronLeft size={22} /></button>
          <h1 className="flex-1 text-2xl font-black text-white">Exercises</h1>
          <button onClick={() => setShowCreate(s => !s)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-volt-400/10 text-volt-400 text-sm font-semibold">
            <Plus size={14} /> New
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-iron-800 rounded-xl">
            <Search size={16} className="text-iron-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent text-white placeholder-iron-500 text-sm outline-none" />
            {query && <button onClick={() => setQuery('')}><X size={14} className="text-iron-400" /></button>}
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c.key ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-300'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="mx-4 mt-4 p-4 bg-iron-900 rounded-2xl border border-iron-800 space-y-3">
          <p className="text-white font-bold text-sm">New Exercise</p>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Exercise name" className="w-full px-3 py-2.5 bg-iron-800 rounded-xl text-white text-sm outline-none border border-iron-700 focus:border-volt-400" />
          <div>
            <p className="text-iron-500 text-xs mb-2">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key as MuscleGroup }))}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${form.category === c.key ? 'bg-volt-400 text-iron-950' : 'bg-iron-700 text-iron-300'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-iron-500 text-xs mb-2">Equipment</p>
            <div className="flex gap-2 flex-wrap">
              {EQUIPMENT_OPTIONS.map(eq => (
                <button key={eq} onClick={() => setForm(f => ({
                  ...f,
                  equipment: f.equipment.includes(eq) ? f.equipment.filter(x => x !== eq) : [...f.equipment, eq]
                }))} className={`px-2 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${form.equipment.includes(eq) ? 'bg-volt-400 text-iron-950' : 'bg-iron-700 text-iron-300'}`}>
                  {eq}
                </button>
              ))}
            </div>
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" rows={2} className="w-full px-3 py-2 bg-iron-800 rounded-xl text-white text-sm outline-none border border-iron-700 focus:border-volt-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 py-2.5 bg-volt-400 text-iron-950 rounded-xl font-bold text-sm">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-iron-800 text-iron-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-iron-800/40">
        {filtered.map(ex => {
          const pr = prs[ex.id] ?? {};
          return (
            <button key={ex.id} onClick={() => setSelected(ex)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-iron-800/30 text-left transition-colors">
              <div className="w-10 h-10 rounded-xl bg-iron-900 flex items-center justify-center flex-shrink-0">
                <Dumbbell size={16} className="text-volt-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{ex.name}</p>
                <p className="text-iron-500 text-xs capitalize">{ex.category} · {ex.equipment.slice(0, 2).join(', ')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {pr.weight && <p className="text-white text-sm font-bold">{pr.weight} kg</p>}
                {pr.e1rm && <p className="text-iron-500 text-xs">e1RM {pr.e1rm}</p>}
              </div>
              <ChevronRight size={14} className="text-iron-700 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
