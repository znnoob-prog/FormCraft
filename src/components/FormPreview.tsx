import React, { useMemo, useState } from 'react';
import { CheckCircle2, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { getQuestionKind } from '../services/googleForms';
import { DraftForm, DraftFormItem } from '../types/forms';

interface FormPreviewProps {
  draft: DraftForm;
}

export const FormPreview: React.FC<FormPreviewProps> = ({ draft }) => {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const sections = useMemo(() => {
    const groups: Array<{
      title: string;
      description?: string;
      items: DraftFormItem[];
    }> = [
      {
        title: draft.info.title || 'Untitled Form',
        description: draft.info.description,
        items: [],
      },
    ];

    for (const item of draft.items) {
      if (item.pageBreakItem) {
        groups.push({
          title: item.title || 'Next Section',
          description: item.description,
          items: [],
        });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [draft]);

  const safeSectionIdx = Math.min(sectionIdx, Math.max(0, sections.length - 1));
  const currentSection = sections[safeSectionIdx];

  const validateCurrentSection = (): boolean => {
    const nextErrors: Record<string, string> = {};
    for (const item of currentSection.items) {
      if (!item.questionItem?.question.required) continue;
      const val = values[item._clientId];
      const empty =
        val === undefined ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0);
      if (empty) {
        nextErrors[item._clientId] = 'This question is required.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextOrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentSection()) return;

    if (safeSectionIdx < sections.length - 1) {
      setSectionIdx(safeSectionIdx + 1);
    } else {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setValues({});
    setErrors({});
    setSectionIdx(0);
    setSubmitted(false);
  };

  const toggleCheckbox = (clientId: string, option: string) => {
    setValues((prev) => {
      const existing = Array.isArray(prev[clientId]) ? (prev[clientId] as string[]) : [];
      const next = existing.includes(option)
        ? existing.filter((v) => v !== option)
        : [...existing, option];
      return { ...prev, [clientId]: next };
    });
    if (errors[clientId]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[clientId];
        return copy;
      });
    }
  };

  const setSingleValue = (clientId: string, val: string) => {
    setValues((prev) => ({ ...prev, [clientId]: val }));
    if (errors[clientId]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[clientId];
        return copy;
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          Interactive dry-run preview — submissions here test validation only and are not recorded.
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Preview Canvas */}
      <div className="flex justify-center py-2">
        <div
          className={`w-full transition-all duration-200 ${
            viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-[680px]'
          }`}
        >
          {submitted ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-900 font-display">
                Dry-run validation passed
              </h3>
              <p className="text-sm text-slate-600">
                All required questions in “{draft.info.title || 'Untitled Form'}” were answered cleanly.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Run preview again
              </button>
            </div>
          ) : (
            <form onSubmit={handleNextOrSubmit} className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                {sections.length > 1 && (
                  <div className="text-xs font-mono text-slate-500 mb-2 tabular-nums">
                    Section {safeSectionIdx + 1} of {sections.length}
                  </div>
                )}
                <h2 className="text-2xl font-bold text-slate-900 font-display">
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {currentSection.description}
                  </p>
                )}
              </div>

              {currentSection.items.map((item) => {
                const kind = getQuestionKind(item);
                const q = item.questionItem?.question;
                const val = values[item._clientId];
                const err = errors[item._clientId];

                if (kind === 'TEXT_BLOCK') {
                  return (
                    <div
                      key={item._clientId}
                      className="bg-white border border-slate-200 rounded-xl p-5"
                    >
                      <h3 className="text-base font-semibold text-slate-900 font-display">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={item._clientId}
                    className={`bg-white border rounded-xl p-5 space-y-3 ${
                      err ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {item.title || 'Untitled question'}
                        {q?.required && (
                          <span className="ml-1.5 text-xs font-medium text-red-600">
                            (Required)
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      )}
                    </div>

                    {kind === 'SHORT_ANSWER' && (
                      <input
                        type="text"
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) => setSingleValue(item._clientId, e.target.value)}
                        placeholder="Your answer"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    )}

                    {kind === 'PARAGRAPH' && (
                      <textarea
                        rows={3}
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) => setSingleValue(item._clientId, e.target.value)}
                        placeholder="Your detailed answer"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    )}

                    {(kind === 'MULTIPLE_CHOICE' || kind === 'CHECKBOXES') &&
                      q?.choiceQuestion && (
                        <div className="space-y-2">
                          {q.choiceQuestion.options.map((opt, i) => {
                            const optLabel = opt.isOther ? 'Other' : opt.value || '';
                            const isRadio = kind === 'MULTIPLE_CHOICE';
                            const checked = isRadio
                              ? val === optLabel
                              : Array.isArray(val) && val.includes(optLabel);
                            return (
                              <label
                                key={i}
                                className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer py-1"
                              >
                                <input
                                  type={isRadio ? 'radio' : 'checkbox'}
                                  name={item._clientId}
                                  checked={checked}
                                  onChange={() =>
                                    isRadio
                                      ? setSingleValue(item._clientId, optLabel)
                                      : toggleCheckbox(item._clientId, optLabel)
                                  }
                                  className="w-4 h-4 text-blue-600 border-slate-300"
                                />
                                <span>{optLabel}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                    {kind === 'DROPDOWN' && q?.choiceQuestion && (
                      <select
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) => setSingleValue(item._clientId, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                      >
                        <option value="">Choose an option</option>
                        {q.choiceQuestion.options
                          .filter((o) => !o.isOther && o.value)
                          .map((o, i) => (
                            <option key={i} value={o.value}>
                              {o.value}
                            </option>
                          ))}
                      </select>
                    )}

                    {kind === 'LINEAR_SCALE' && q?.scaleQuestion && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          {Array.from(
                            {
                              length:
                                q.scaleQuestion.high - q.scaleQuestion.low + 1,
                            },
                            (_, offset) => String(q.scaleQuestion!.low + offset)
                          ).map((score) => {
                            const active = val === score;
                            return (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setSingleValue(item._clientId, score)}
                                className={`flex-1 py-2 text-xs font-mono font-semibold rounded-lg border transition-colors tabular-nums ${
                                  active
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                {score}
                              </button>
                            );
                          })}
                        </div>
                        {(q.scaleQuestion.lowLabel || q.scaleQuestion.highLabel) && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{q.scaleQuestion.lowLabel}</span>
                            <span>{q.scaleQuestion.highLabel}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {kind === 'DATE' && (
                      <input
                        type={q?.dateQuestion?.includeTime ? 'datetime-local' : 'date'}
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) => setSingleValue(item._clientId, e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    )}

                    {kind === 'TIME' && (
                      <input
                        type="time"
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) => setSingleValue(item._clientId, e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    )}

                    {err && <p className="text-xs font-medium text-red-600">{err}</p>}
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                {safeSectionIdx > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSectionIdx(safeSectionIdx - 1)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {safeSectionIdx < sections.length - 1 ? 'Continue' : 'Test Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
