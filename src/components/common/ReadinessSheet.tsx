import { useMemo, useState } from 'react';
import { BatteryCharging } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../db';
import type { ReadinessCheck } from '../../types';
import { calculateReadiness, generateId, getReadinessLabel } from '../../utils';
import { BottomSheet } from './BottomSheet';

export function ReadinessSheet({ onClose, onComplete }: { onClose: () => void; onComplete: (check: ReadinessCheck) => void }) {
  const [values, setValues] = useState({ sleep: 3, soreness: 3, energy: 3, stress: 3, motivation: 3 });
  const result = useMemo(() => calculateReadiness(values), [values]);

  const submit = async () => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const existing = await db.readiness.where('date').equals(date).first();
    const check: ReadinessCheck = {
      id: existing?.id ?? generateId(),
      date,
      ...values,
      ...result,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.readiness.put(check);
    onComplete(check);
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-volt-400 text-xs font-bold uppercase tracking-[0.18em]">Hooper check</p>
          <h2 className="text-2xl font-black text-white mt-2">How are you arriving?</h2>
          <p className="text-iron-400 text-sm mt-1">Five quick signals tune today’s recovery multiplier.</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-white">{result.score}</p>
          <p className="text-xs font-bold text-volt-400">{getReadinessLabel(result.score)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {([
          ['sleep', 'Sleep quality', 'Poor', 'Great'],
          ['soreness', 'Muscle soreness', 'Fresh', 'Very sore'],
          ['energy', 'Energy', 'Flat', 'Charged'],
          ['stress', 'Life stress', 'Calm', 'High'],
          ['motivation', 'Motivation', 'Low', 'Locked in'],
        ] as const).map(([key, label, low, high]) => (
          <label key={key} className="block">
            <div className="flex justify-between text-sm"><span className="font-semibold text-iron-200">{label}</span><span className="font-black text-white">{values[key]}/5</span></div>
            <input type="range" min="1" max="5" value={values[key]} onChange={e => setValues(previous => ({ ...previous, [key]: Number(e.target.value) }))} className="accent-volt-400 w-full mt-2" />
            <div className="flex justify-between text-[10px] text-iron-600"><span>{low}</span><span>{high}</span></div>
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-volt-400/15 bg-volt-400/5 p-3">
        <div className="flex items-center gap-2 text-sm text-iron-300"><BatteryCharging size={17} className="text-volt-400" /> Recovery multiplier</div>
        <span className="font-black text-volt-300">×{result.recoveryMultiplier}</span>
      </div>
      <button onClick={() => void submit()} className="w-full mt-4 rounded-2xl bg-volt-400 py-3.5 font-black text-iron-950">Start workout</button>
    </BottomSheet>
  );
}
