import { X } from 'lucide-react';

export function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border-t border-iron-700 bg-iron-900 p-5 pb-8 animate-slide-up">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-iron-500"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}
