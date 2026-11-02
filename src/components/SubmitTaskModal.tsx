import React, { useState } from 'react';
import { Task, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Award, CheckCircle2, MessageSquare, HelpCircle, Clock, X, Loader2 } from 'lucide-react';

interface SubmitTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  language: Language;
  onClose: () => void;
  onSubmit: (task: Task, comment: string, questionAnswer: string, actualDurationMinutes?: number) => Promise<void>;
  userName: string;
}

export const SubmitTaskModal: React.FC<SubmitTaskModalProps> = ({
  isOpen,
  task,
  language,
  onClose,
  onSubmit,
  userName,
}) => {
  const t = translations[language];
  const [comment, setComment] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [actualDuration, setActualDuration] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (task.isCommentRequired && !comment.trim()) {
      setError(language === 'ar' ? 'يرجى كتابة الملاحظات أو رابط التسليم (إلزامي).' : 'Please write your comment or delivery proof (required).');
      return;
    }

    if (task.isQuestionRequired && !questionAnswer.trim()) {
      setError(language === 'ar' ? 'يرجى الإجابة على سؤال المهمة (إلزامي).' : 'Please answer the task question (required).');
      return;
    }

    setIsSubmitting(true);
    try {
      const durationVal = actualDuration ? parseInt(actualDuration, 10) : undefined;
      await onSubmit(task, comment.trim(), questionAnswer.trim(), durationVal);
      setComment('');
      setQuestionAnswer('');
      setActualDuration('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/30 mb-2">
              <Award className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>+{task.points} {t.points}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {t.submitTaskTitle}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {task.title} • <span className="text-neutral-200 font-semibold">{userName}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Question Prompt if configured */}
          {task.enableQuestion && (
            <div className="p-4 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0A84FF]">
                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                <span>{task.isQuestionRequired ? t.questionAnswerPrompt : 'Task Question'}</span>
              </div>
              <p className="text-sm font-semibold text-white leading-relaxed">
                {task.questionPrompt}
              </p>
              <input
                type="text"
                autoFocus
                placeholder={language === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}
                value={questionAnswer}
                onChange={(e) => {
                  setQuestionAnswer(e.target.value);
                  setError('');
                }}
                className="w-full mt-2 px-3.5 py-3 rounded-xl bg-[#000000]/70 border border-white/20 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              />
            </div>
          )}

          {/* Actual Duration Logging */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t.actualDurationPrompt}</span>
            </label>
            <input
              type="number"
              min="1"
              max="1440"
              placeholder="e.g. 45"
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
            />
          </div>

          {/* Comment / Evidence */}
          {(task.enableComment || task.isCommentRequired) && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{task.isCommentRequired ? t.commentRequiredPrompt : t.commentPrompt}</span>
                </span>
              </label>
              <textarea
                rows={3}
                placeholder={language === 'ar' ? 'اكتب ملحوظة أو رابط درايف أو تفاصيل التنفيذ...' : 'Add notes, Google Drive link, or proof...'}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#0A84FF] text-sm resize-none"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 text-sm font-semibold transition-all border border-white/10"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#0A84FF] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-bold shadow-lg shadow-[#0A84FF]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.submitting}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.confirmSubmission}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
