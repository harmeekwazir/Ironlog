import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Mic, MicOff, Square } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { useActiveWorkout } from '../../store/activeWorkout';
import type { Exercise, SetType } from '../../types';
import { getSetTypeLabel } from '../../utils';
import { parseVoiceLog, type ParsedVoiceLog } from '../../utils/voice';

const SET_TYPES: SetType[] = ['working', 'warmup', 'failure', 'dropset', 'amrap', 'tempo'];

function getRecognitionCtor(): typeof SpeechRecognition | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

type Status = 'idle' | 'listening' | 'reviewing' | 'unsupported' | 'denied' | 'added';

export function VoiceLoggerSheet({ exercises, onClose }: { exercises: Record<string, Exercise>; onClose: () => void }) {
  const logVoiceSets = useActiveWorkout(s => s.logVoiceSets);
  const [status, setStatus] = useState<Status>(getRecognitionCtor() ? 'idle' : 'unsupported');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceLog | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const exerciseList = Object.values(exercises).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  function startListening() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setStatus('unsupported'); return; }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Accumulated in a plain closure variable, not React state — onend needs the
    // up-to-the-moment value synchronously, and state set just before stop() hasn't
    // necessarily committed yet by the time onend fires.
    let finalText = '';
    recognition.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interimText += result[0].transcript;
      }
      setTranscript(finalText.trim());
      setInterim(interimText);
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setStatus('denied');
    };
    recognition.onend = () => {
      const full = finalText.trim();
      if (full) {
        setParsed(parseVoiceLog(full, exerciseList));
        setStatus('reviewing');
      } else {
        setStatus(prev => (prev === 'denied' ? prev : 'idle'));
      }
    };

    setTranscript('');
    setInterim('');
    setParsed(null);
    setStatus('listening');
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function handleConfirm() {
    if (!parsed?.exercise) return;
    const sets = Array.from({ length: parsed.setsCount }, () => ({ weight: parsed.weight, reps: parsed.reps, type: parsed.type }));
    logVoiceSets(parsed.exercise.id, sets);
    setStatus('added');
    window.setTimeout(() => setStatus('idle'), 1100);
  }

  return (
    <BottomSheet onClose={onClose}>
      <h2 className="text-xl font-black text-white">Voice log</h2>
      <p className="mt-1 text-sm text-iron-500">Speak a set, then review before it's added.</p>

      {status === 'idle' && (
        <div className="py-6 text-center">
          <button onClick={startListening} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-volt-400 text-iron-950">
            <Mic size={32} />
          </button>
          <p className="mt-4 font-bold text-white">Tap to log by voice</p>
          <p className="mt-1 px-4 text-sm text-iron-500">Try "Bench press, 3 sets of 8 at 60 kilos" or "Squat, 100 for 5"</p>
        </div>
      )}

      {status === 'listening' && (
        <div className="py-6 text-center">
          <button onClick={stopListening} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white animate-pulse">
            <Square size={26} fill="currentColor" />
          </button>
          <p className="mt-4 font-bold text-white">Listening… tap to stop</p>
          <p className="mt-2 min-h-10 px-2 text-sm text-iron-300">
            {transcript}{interim && <span className="text-iron-500"> {interim}</span>}
          </p>
        </div>
      )}

      {status === 'reviewing' && parsed && (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-iron-400">Exercise</span>
            <select
              value={parsed.exercise?.id ?? ''}
              onChange={e => setParsed({ ...parsed, exercise: exerciseList.find(ex => ex.id === e.target.value) })}
              className="mt-1.5 w-full rounded-2xl border border-iron-800 bg-iron-950 px-3 py-3 text-white outline-none"
            >
              {!parsed.exercise && <option value="" disabled>Didn't catch that — pick one</option>}
              {exerciseList.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-iron-400">Weight (kg)</span>
              <input
                type="number" value={parsed.weight} min={0}
                onChange={e => setParsed({ ...parsed, weight: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-2xl border border-iron-800 bg-iron-950 px-3 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-iron-400">Reps</span>
              <input
                type="number" value={parsed.reps} min={0}
                onChange={e => setParsed({ ...parsed, reps: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-2xl border border-iron-800 bg-iron-950 px-3 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-iron-400">Sets</span>
              <input
                type="number" value={parsed.setsCount} min={1} max={10}
                onChange={e => setParsed({ ...parsed, setsCount: Math.max(1, Math.min(10, Number(e.target.value))) })}
                className="mt-1.5 w-full rounded-2xl border border-iron-800 bg-iron-950 px-3 py-3 text-white outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SET_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setParsed({ ...parsed, type: t })}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${parsed.type === t ? 'border-volt-400 bg-volt-400 text-iron-950' : 'border-iron-800 text-iron-400'}`}
              >
                {getSetTypeLabel(t)}
              </button>
            ))}
          </div>

          <p className="text-xs italic text-iron-600">Heard: "{parsed.transcript}"</p>

          <div className="flex gap-2">
            <button onClick={() => setStatus('idle')} className="flex-1 rounded-2xl bg-iron-800 py-3.5 font-bold text-iron-300">Retry</button>
            <button
              onClick={handleConfirm}
              disabled={!parsed.exercise}
              className="flex-1 rounded-2xl bg-volt-400 py-3.5 font-black text-iron-950 disabled:opacity-40"
            >
              Add {parsed.setsCount > 1 ? `${parsed.setsCount} sets` : 'set'}
            </button>
          </div>
        </div>
      )}

      {status === 'added' && (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-volt-400/15 text-volt-400"><Check size={28} /></div>
          <p className="mt-3 font-bold text-white">Logged!</p>
        </div>
      )}

      {status === 'unsupported' && (
        <div className="py-6 text-center">
          <MicOff size={32} className="mx-auto text-iron-600" />
          <p className="mt-3 font-bold text-white">Voice logging isn't available in this browser</p>
          <p className="mt-1 text-sm text-iron-500">Try Chrome or Safari, or log sets manually.</p>
        </div>
      )}

      {status === 'denied' && (
        <div className="py-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400" />
          <p className="mt-3 font-bold text-white">Microphone access denied</p>
          <p className="mt-1 text-sm text-iron-500">Enable microphone access for this site in your browser settings to use voice logging.</p>
        </div>
      )}
    </BottomSheet>
  );
}
