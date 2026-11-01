import React, { useEffect, useState } from 'react';
import { Award, Sparkles } from 'lucide-react';

interface ConfettiProps {
  show: boolean;
  pointsEarned: number;
  taskTitle: string;
  onDismiss: () => void;
}

export const ConfettiEffect: React.FC<ConfettiProps> = ({
  show,
  pointsEarned,
  taskTitle,
  onDismiss,
}) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number }>>([]);

  useEffect(() => {
    if (show) {
      const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#38BDF8', '#10B981', '#F59E0B'];
      const p = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      }));
      setParticles(p);

      const timer = setTimeout(() => {
        onDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-ping opacity-75"
          style={{
            top: `${p.y}%`,
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDuration: `${Math.random() * 1.5 + 1}s`,
          }}
        />
      ))}

      {/* Center Congratulations Badge */}
      <div className="pointer-events-auto rounded-3xl glass-panel-elevated border border-amber-400/40 p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-90 fade-in duration-300">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-0.5 shadow-xl shadow-amber-500/30 flex items-center justify-center mb-4">
          <div className="w-full h-full bg-neutral-900 rounded-[14px] flex items-center justify-center">
            <Award className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>TASK COMPLETED!</span>
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight">
          +{pointsEarned} Points Added!
        </h3>

        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
          {taskTitle}
        </p>

        <p className="text-[11px] text-emerald-400 font-semibold mt-3">
          Leaderboard updated live!
        </p>

        <button
          onClick={onDismiss}
          className="mt-5 w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold transition-all border border-white/10"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
};
