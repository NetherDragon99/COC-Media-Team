import React, { useState } from 'react';
import { Task } from '../types.ts';
import { PlusCircle, X, Sparkles, Link as LinkIcon, Award, FileText } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Task) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onAddTask }) => {
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState('Video');
  const [description, setDescription] = useState('');
  const [taskLink, setTaskLink] = useState('');
  const [points, setPoints] = useState(50);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Task description is required.');
      return;
    }

    onAddTask({
      taskName: taskName.trim(),
      category: category.trim(),
      description: description.trim(),
      taskLink: taskLink.trim(),
      points: Number(points) || 50,
    });

    onClose();
  };

  const categories = ['Video', 'Audio', 'Broadcast', 'Lighting', 'Graphics', 'Social'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Create New Media Task</h2>
              <p className="text-xs text-neutral-400">Publish a production task to the COC Media board</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              placeholder="e.g. Multi-Track Worship Audio Stem Export"
              value={taskName}
              onChange={(e) => {
                setTaskName(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#121622] border border-white/15 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-neutral-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Reward Points
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="5"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value, 10) || 50)}
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-white/[0.06] border border-white/15 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <Award className="absolute left-3.5 top-3.5 w-4 h-4 text-amber-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Description &amp; Deliverables
            </label>
            <textarea
              rows={3}
              placeholder="Describe deliverables, specs, camera gear, or audio guidelines..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Resource / File URL (TaskLink)
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://drive.google.com/... or folder link"
                value={taskLink}
                onChange={(e) => setTaskLink(e.target.value)}
                className="w-full px-4 py-3 pl-10 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
              <LinkIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
            </div>
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 text-sm font-semibold transition-all border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Add Task
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
