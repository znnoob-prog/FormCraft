import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Save } from 'lucide-react';
import { compileBatchUpdate } from '../services/googleForms';
import { DraftForm, GoogleForm } from '../types/forms';

interface FormSettingsProps {
  originalForm: GoogleForm;
  draft: DraftForm;
  onChangeDraft: (updater: (prev: DraftForm) => DraftForm) => void;
  onRequestSave: () => void;
}

export const FormSettings: React.FC<FormSettingsProps> = ({
  originalForm,
  draft,
  onChangeDraft,
  onRequestSave,
}) => {
  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const { summary } = useMemo(
    () => compileBatchUpdate(originalForm, draft),
    [originalForm, draft]
  );

  const isQuiz = Boolean(draft.settings?.quizSettings?.isQuiz);

  const copyText = async (text: string, which: 'uri' | 'id') => {
    await navigator.clipboard.writeText(text);
    if (which === 'uri') {
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 1800);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Configuration */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Form configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes made here are staged until you confirm and save to Google Forms.
            </p>
          </div>
          <button
            type="button"
            disabled={summary.length === 0}
            onClick={onRequestSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            Review & Save
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Form title
            </label>
            <input
              type="text"
              value={draft.info.title}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  info: { ...prev.info, title: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Form description
            </label>
            <textarea
              rows={3}
              value={draft.info.description ?? ''}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  info: { ...prev.info, description: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Quiz mode</div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Assign point values and correct answer keys to questions inside the Form Editor.
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer shrink-0 pt-0.5">
              <input
                type="checkbox"
                checked={isQuiz}
                onChange={(e) =>
                  onChangeDraft((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      quizSettings: { isQuiz: e.target.checked },
                    },
                  }))
                }
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="ml-2 text-xs font-medium text-slate-700">
                {isQuiz ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Right: Share & Identifiers */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 font-display border-b border-slate-100 pb-3">
          Share & identifiers
        </h2>

        {originalForm.responderUri && (
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1.5">
              Public responder URL
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={originalForm.responderUri}
                className="min-w-0 flex-1 px-3 py-2 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => copyText(originalForm.responderUri!, 'uri')}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
              >
                {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <a
              href={originalForm.responderUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Open live form in new tab
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <div className="text-xs font-medium text-slate-600 mb-1.5">
            Google Form ID
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={originalForm.formId}
              className="min-w-0 flex-1 px-3 py-2 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <button
              type="button"
              onClick={() => copyText(originalForm.formId, 'id')}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Revision <span className="font-mono">{originalForm.revisionId || '—'}</span> ·{' '}
            <a
              href={`https://docs.google.com/forms/d/${encodeURIComponent(originalForm.formId)}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open in native Google Forms
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
