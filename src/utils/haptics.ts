import { useSettings } from '../store/settings';

function vibrate(pattern: number | number[]) {
  if (!useSettings.getState().hapticsEnabled) return;
  navigator.vibrate?.(pattern);
}

export function hapticSetComplete() {
  vibrate(15);
}

export function hapticWorkoutComplete() {
  vibrate([20, 40, 20]);
}

export function hapticPR() {
  vibrate([30, 50, 30, 50, 60]);
}
