import React, { useEffect } from 'react';
import { AlertTriangle, Check, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { ChangeSummaryItem } from '../types/forms';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  changes?: ChangeSummaryItem[];
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  changes,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const renderChangeIcon = (kind: ChangeSummaryItem['kind']) => {
    switch (kind) {
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-600 shrink-0" />;
      case 'create':
        return <Plus className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'replace':
      case 'reorder':
        return <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />;
      default:
        return <Check className="w-4 h-4 text-blue-600 shrink-0" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            {tone === 'danger' && (
              <div className="mt-0.5 p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2
                id="confirm-modal-title"
                className="text-base font-semibold text-slate-900 font-display"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {changes && changes.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 max-h-64 overflow-y-auto">
            <p className="text-xs font-medium text-slate-500 mb-2.5 tabular-nums">
              {changes.length} pending {changes.length === 1 ? 'change' : 'changes'} to apply in Google Forms
            </p>
            <ul className="divide-y divide-slate-200/70 border border-slate-200 rounded-lg bg-white">
              {changes.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
                  <span className="mt-0.5">{renderChangeIcon(item.kind)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{item.label}</div>
                    {item.detail && (
                      <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600'
            }`}
          >
            {isSubmitting ? 'Applying...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
