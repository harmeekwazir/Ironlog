import { useState, useEffect } from 'react';
import { Search, X, Plus, ChevronRight, Dumbbell } from 'lucide-react';
import { db } from '../../db';
import type { Exercise, MuscleGroup } from '../../types';
import { generateId } from '../../utils';

const CATEGORIES: { key: MuscleGroup | 'all'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'chest',     label: 'Chest' },
  { key: 'back',      label: 'Back' },
  { key: 'legs',      label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps',    label: 'Biceps' },
  { key: 'triceps',   label: 'Triceps' },
  { key: 'forearms',  label: 'Forearms' },
  { key: 'core',      label: 'Core' },
  { key: 'cardio',    label: 'Cardio' },
];

interface Props {
  onSelect: (exerciseId: string) => void;
  onClose: () => void;
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    chest: '💪', back: '🏋️', legs: '🦵', shoulders: '🔝',
    biceps: '💪', triceps: '💪', forearms: '🤜', arms: '💪',
    core: '🎯', cardio: '🏃', full_body: '🔥', 'full-body': '🔥',
  };
  return emojis[category] || '💪';
}

export function ExercisePicker({ onSelect, onClose }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MuscleGroup | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MuscleGroup>('chest');

  useEffect(() => {
    db.exercises.toArray().then(setExercises);
  }, []);

  const filtered = exercises.filter(e => {
    const matchQuery = e.name.toLowerCase().includes(query.toLowerCase());
    const matchCat = category === 'all' || e.category === category;
    return matchQuery && matchCat;
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ex: Exercise = {
      id: generateId(),
      name: newName.trim(),
      muscleGroups: [newCategory],
      equipment: ['other'],
      category: newCategory,
      isCustom: true,
      createdAt: Date.now(),
    };
    await db.exercises.add(ex);
    setExercises(prev => [...prev, ex]);
    setNewName('');
    setShowCreate(false);
    onSelect(ex.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-iron-950">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-iron-800">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-iron-400 hover:text-white">
          <X size={20} />
        </button>
        <h2 className="flex-1 text-lg font-bold text-white">Add Exercise</h2>
        <button onClick={() => setShowCreate(s => !s)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-volt-400/10 text-volt-400 text-sm font-semibold">
          <Plus size={14} /> New
        </button>
      </div>

      <div className="px-4 py-3 border-b border-iron-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-iron-800 rounded-xl">
          <Search size={16} className="text-iron-400" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises..." className="flex-1 bg-transparent text-white placeholder-iron-500 text-sm outline-none" />
          {query && <button onClick={() => setQuery('')} className="text-iron-400"><X size={14} /></button>}
        </div>
      </div>

      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-iron-800">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c.key ? 'bg-volt-400 text-iron-950' : 'bg-iron-800 text-iron-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="px-4 py-3 bg-iron-900 border-b border-iron-800 space-y-2">
          <p className="text-xs text-iron-400 uppercase tracking-wider">New Custom Exercise</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Exercise name..." className="w-full px-3 py-2 bg-iron-800 rounded-xl text-white text-sm outline-none border border-iron-600 focus:border-volt-400" />
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.filter(c => c.key !== 'all').map(c => (
              <button key={c.key} onClick={() => setNewCategory(c.key as MuscleGroup)}
                className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${newCategory === c.key ? 'bg-volt-400 text-iron-950' : 'bg-iron-700 text-iron-300'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 py-2 bg-volt-400 text-iron-950 rounded-xl font-semibold text-sm">Create & Add</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-iron-800 rounded-xl text-iron-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-iron-500">
            <Dumbbell size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No exercises found</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 text-volt-400 text-sm font-medium">+ Create "{query}"</button>
          </div>
        ) : (
          <div className="divide-y divide-iron-800/40">
            {filtered.map(ex => (
              <button key={ex.id} onClick={() => onSelect(ex.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-iron-800/50 transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-iron-800 flex items-center justify-center flex-shrink-0 text-lg">
                  {getCategoryEmoji(ex.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{ex.name}</p>
                  <p className="text-iron-500 text-xs capitalize">{ex.category} · {ex.equipment.join(', ')}</p>
                </div>
                {ex.isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded bg-iron-700 text-iron-400">Custom</span>}
                <ChevronRight size={14} className="text-iron-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
