import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ListPlus,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  compileBatchUpdate,
  createBlankDraftItem,
  createClientItemId,
  getQuestionKind,
  getQuestionKindLabel,
  validateDraftForm,
} from '../services/googleForms';
import {
  ChoiceOption,
  DraftForm,
  DraftFormItem,
  GoogleForm,
  QuestionKind,
} from '../types/forms';

interface FormEditorProps {
  originalForm: GoogleForm;
  draft: DraftForm;
  selectedItemId: string | null;
  onSelectItem: (clientId: string | null) => void;
  onChangeDraft: (updater: (prev: DraftForm) => DraftForm) => void;
  onDiscardDraft: () => void;
  onRequestSave: () => void;
}

const QUESTION_TYPES: Array<{ kind: QuestionKind; label: string }> = [
  { kind: 'SHORT_ANSWER', label: 'Short answer' },
  { kind: 'PARAGRAPH', label: 'Paragraph' },
  { kind: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { kind: 'CHECKBOXES', label: 'Checkboxes' },
  { kind: 'DROPDOWN', label: 'Dropdown' },
  { kind: 'LINEAR_SCALE', label: 'Linear scale' },
  { kind: 'DATE', label: 'Date' },
  { kind: 'TIME', label: 'Time' },
  { kind: 'SECTION_BREAK', label: 'Section break' },
  { kind: 'TEXT_BLOCK', label: 'Title & text' },
];

export const FormEditor: React.FC<FormEditorProps> = ({
  originalForm,
  draft,
  selectedItemId,
  onSelectItem,
  onChangeDraft,
  onDiscardDraft,
  onRequestSave,
}) => {
  const [bulkOptionsText, setBulkOptionsText] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);

  const selectedItem = useMemo(
    () => draft.items.find((it) => it._clientId === selectedItemId) ?? draft.items[0] ?? null,
    [draft.items, selectedItemId]
  );

  const validationErrors = useMemo(() => validateDraftForm(draft), [draft]);
  const { summary } = useMemo(
    () => compileBatchUpdate(originalForm, draft),
    [originalForm, draft]
  );

  const hasChanges = summary.length > 0;

  const updateItem = (clientId: string, updater: (item: DraftFormItem) => DraftFormItem) => {
    onChangeDraft((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it._clientId === clientId ? updater(it) : it)),
    }));
  };

  const addItem = (kind: QuestionKind, insertAfterClientId?: string) => {
    const newItem = createBlankDraftItem(kind);
    onChangeDraft((prev) => {
      const next = [...prev.items];
      if (insertAfterClientId) {
        const idx = next.findIndex((i) => i._clientId === insertAfterClientId);
        if (idx !== -1) {
          next.splice(idx + 1, 0, newItem);
          return { ...prev, items: next };
        }
      }
      next.push(newItem);
      return { ...prev, items: next };
    });
    onSelectItem(newItem._clientId);
  };

  const duplicateItem = (clientId: string) => {
    const idx = draft.items.findIndex((i) => i._clientId === clientId);
    if (idx === -1) return;
    const source = structuredClone(draft.items[idx]);
    delete source.itemId;
    if (source.questionItem?.question) {
      delete source.questionItem.question.questionId;
    }
    source._clientId = createClientItemId();
    source.title = source.title ? `${source.title} (copy)` : 'Untitled copy';

    onChangeDraft((prev) => {
      const next = [...prev.items];
      next.splice(idx + 1, 0, source);
      return { ...prev, items: next };
    });
    onSelectItem(source._clientId);
  };

  const deleteItem = (clientId: string) => {
    const idx = draft.items.findIndex((i) => i._clientId === clientId);
    if (idx === -1) return;
    const remaining = draft.items.filter((i) => i._clientId !== clientId);
    onChangeDraft((prev) => ({ ...prev, items: remaining }));
    if (selectedItem?._clientId === clientId) {
      const nextSelected = remaining[Math.min(idx, remaining.length - 1)]?._clientId ?? null;
      onSelectItem(nextSelected);
    }
  };

  const moveItem = (clientId: string, direction: -1 | 1) => {
    const idx = draft.items.findIndex((i) => i._clientId === clientId);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= draft.items.length) return;
    onChangeDraft((prev) => {
      const next = [...prev.items];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return { ...prev, items: next };
    });
  };

  const convertItemKind = (item: DraftFormItem, nextKind: QuestionKind) => {
    const currentKind = getQuestionKind(item);
    if (currentKind === nextKind) return;

    const template = createBlankDraftItem(nextKind);
    const preservedTitle = item.title;
    const preservedDesc = item.description;
    const preservedRequired = item.questionItem?.question?.required ?? false;
    const existingOptions = item.questionItem?.question?.choiceQuestion?.options;

    const converted: DraftFormItem = {
      ...template,
      _clientId: item._clientId,
      itemId: item.itemId,
      title: preservedTitle,
      description: preservedDesc,
    };

    if (converted.questionItem?.question) {
      converted.questionItem.question.required = preservedRequired;
      if (
        item.questionItem?.question?.questionId &&
        getQuestionKind(item) !== 'SECTION_BREAK' &&
        getQuestionKind(item) !== 'TEXT_BLOCK'
      ) {
        converted.questionItem.question.questionId = item.questionItem.question.questionId;
      }
      if (converted.questionItem.question.choiceQuestion && existingOptions?.length) {
        converted.questionItem.question.choiceQuestion.options =
          nextKind === 'DROPDOWN'
            ? existingOptions.filter((o) => !o.isOther)
            : structuredClone(existingOptions);
        if (converted.questionItem.question.choiceQuestion.options.length === 0) {
          converted.questionItem.question.choiceQuestion.options = [{ value: 'Option 1' }];
        }
      }
    }

    updateItem(item._clientId, () => converted);
  };

  const handleApplyBulkOptions = (item: DraftFormItem) => {
    const lines = bulkOptionsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const uniqueLines = Array.from(new Set(lines));
    updateItem(item._clientId, (prev) => {
      if (!prev.questionItem?.question?.choiceQuestion) return prev;
      return {
        ...prev,
        questionItem: {
          ...prev.questionItem,
          question: {
            ...prev.questionItem.question,
            choiceQuestion: {
              ...prev.questionItem.question.choiceQuestion,
              options: uniqueLines.map((value) => ({ value })),
            },
          },
        },
      };
    });
    setBulkOptionsText('');
    setShowBulkPaste(false);
  };

  const selectedKind = selectedItem ? getQuestionKind(selectedItem) : null;
  const isQuiz = Boolean(draft.settings?.quizSettings?.isQuiz);

  return (
    <div className="space-y-5">
      {/* Draft Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {validationErrors.length > 0 ? (
            <div className="flex items-center gap-2 text-xs font-medium text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{validationErrors[0]}</span>
            </div>
          ) : hasChanges ? (
            <div className="text-xs font-medium text-amber-700 tabular-nums">
              {summary.length} pending {summary.length === 1 ? 'change' : 'changes'} ready to review
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Synced with Google Forms</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onDiscardDraft}
            disabled={!hasChanges}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={onRequestSave}
            disabled={!hasChanges || validationErrors.length > 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Save className="w-3.5 h-3.5" />
            Review & Save
          </button>
        </div>
      </div>

      {/* Form Header Surface */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6">
            <label
              htmlFor="form-title-input"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Form title
            </label>
            <input
              id="form-title-input"
              type="text"
              value={draft.info.title}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  info: { ...prev.info, title: e.target.value },
                }))
              }
              placeholder="Untitled Form"
              className="w-full px-3.5 py-2 text-base font-semibold text-slate-900 bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 font-display"
            />
          </div>
          <div className="lg:col-span-6">
            <label
              htmlFor="form-desc-input"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Description for respondents
            </label>
            <input
              id="form-desc-input"
              type="text"
              value={draft.info.description ?? ''}
              onChange={(e) =>
                onChangeDraft((prev) => ({
                  ...prev,
                  info: { ...prev.info, description: e.target.value },
                }))
              }
              placeholder="Optional instructions or estimated completion time"
              className="w-full px-3.5 py-2 text-sm text-slate-700 bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Split Outline + Focused Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Structured Outline */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/60">
            <span className="text-xs font-semibold text-slate-700 font-display">
              Form outline
            </span>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {draft.items.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-slate-700">No items in this form yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Add your first question or section block below.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {draft.items.map((item, idx) => {
                const isSelected = selectedItem?._clientId === item._clientId;
                const kind = getQuestionKind(item);
                const isReq = Boolean(item.questionItem?.question?.required);
                return (
                  <li
                    key={item._clientId}
                    className={`group flex items-start gap-2.5 px-4 py-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => onSelectItem(item._clientId)}
                  >
                    <span className="mt-0.5 text-xs font-mono text-slate-400 tabular-nums w-5 shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium truncate ${
                          isSelected ? 'text-blue-950' : 'text-slate-900'
                        }`}
                      >
                        {item.title?.trim() || 'Untitled item'}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5 truncate">
                        <span>{getQuestionKindLabel(kind)}</span>
                        {isReq && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700 font-medium">Required</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => moveItem(item._clientId, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-25"
                        title="Move up"
                        aria-label="Move item up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(item._clientId, 1)}
                        disabled={idx === draft.items.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-25"
                        title="Move down"
                        aria-label="Move item down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateItem(item._clientId)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white"
                        title="Duplicate"
                        aria-label="Duplicate item"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item._clientId)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white"
                        title="Delete"
                        aria-label="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quick Add Palette */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Insert item {selectedItem ? 'after selection' : ''}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUESTION_TYPES.map((qt) => (
                <button
                  key={qt.kind}
                  type="button"
                  onClick={() => addItem(qt.kind, selectedItem?._clientId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:border-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  {qt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Focused Item Inspector */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          {!selectedItem ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-slate-700">
                Select an item from the outline or insert a new question
              </p>
              <p className="mt-1 text-xs text-slate-500">
                All question prompts, option lists, validation, and quiz settings appear here.
              </p>
            </div>
          ) : selectedKind === 'UNSUPPORTED' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900 font-display">
                  Custom Google Forms Item
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {selectedItem.itemId || 'New'}
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                This item uses an advanced Google Forms block (such as a grid, file upload, image, or video item). You can still edit its title and description or reorder/delete it safely.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={selectedItem.title ?? ''}
                  onChange={(e) =>
                    updateItem(selectedItem._clientId, (prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Inspector Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 font-display">
                    Item Inspector
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    Position {draft.items.findIndex((i) => i._clientId === selectedItem._clientId) + 1} of{' '}
                    {draft.items.length}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    aria-label="Question type"
                    value={selectedKind ?? 'SHORT_ANSWER'}
                    onChange={(e) =>
                      convertItemKind(selectedItem, e.target.value as QuestionKind)
                    }
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  >
                    {QUESTION_TYPES.map((qt) => (
                      <option key={qt.kind} value={qt.kind}>
                        {qt.label}
                      </option>
                    ))}
                  </select>

                  {selectedItem.questionItem && (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItem.questionItem.question.required)}
                        onChange={(e) =>
                          updateItem(selectedItem._clientId, (prev) => ({
                            ...prev,
                            questionItem: prev.questionItem
                              ? {
                                  ...prev.questionItem,
                                  question: {
                                    ...prev.questionItem.question,
                                    required: e.target.checked,
                                  },
                                }
                              : prev.questionItem,
                          }))
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      Required
                    </label>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    {selectedKind === 'SECTION_BREAK' || selectedKind === 'TEXT_BLOCK'
                      ? 'Heading'
                      : 'Question prompt'}
                  </label>
                  <input
                    type="text"
                    value={selectedItem.title ?? ''}
                    onChange={(e) =>
                      updateItem(selectedItem._clientId, (prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Enter question or heading"
                    className="w-full px-3.5 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Helper text / description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={selectedItem.description ?? ''}
                    onChange={(e) =>
                      updateItem(selectedItem._clientId, (prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Clarifying instructions shown below the prompt"
                    className="w-full px-3.5 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-y"
                  />
                </div>
              </div>

              {/* Choice Question Controls */}
              {selectedItem.questionItem?.question.choiceQuestion && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Answer options
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowBulkPaste((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                        Bulk paste
                      </button>
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            selectedItem.questionItem.question.choiceQuestion.shuffle
                          )}
                          onChange={(e) =>
                            updateItem(selectedItem._clientId, (prev) => {
                              const cq = prev.questionItem?.question.choiceQuestion;
                              if (!cq || !prev.questionItem) return prev;
                              return {
                                ...prev,
                                questionItem: {
                                  ...prev.questionItem,
                                  question: {
                                    ...prev.questionItem.question,
                                    choiceQuestion: { ...cq, shuffle: e.target.checked },
                                  },
                                },
                              };
                            })
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                        />
                        Shuffle order
                      </label>
                    </div>
                  </div>

                  {showBulkPaste && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <p className="text-xs text-slate-600">
                        Paste one option per line to replace the current option list:
                      </p>
                      <textarea
                        rows={4}
                        value={bulkOptionsText}
                        onChange={(e) => setBulkOptionsText(e.target.value)}
                        placeholder={'Engineering\nDesign\nProduct\nOperations'}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBulkPaste(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyBulkOptions(selectedItem)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                        >
                          Apply options
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {selectedItem.questionItem.question.choiceQuestion.options.map(
                      (opt, oIdx) => {
                        const opts =
                          selectedItem.questionItem!.question.choiceQuestion!.options;
                        return (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 w-5 tabular-nums">
                              {oIdx + 1}.
                            </span>
                            {opt.isOther ? (
                              <div className="flex-1 px-3 py-1.5 text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
                                Other (respondent write-in)
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={opt.value ?? ''}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  updateItem(selectedItem._clientId, (prev) => {
                                    const cq =
                                      prev.questionItem?.question.choiceQuestion;
                                    if (!cq || !prev.questionItem) return prev;
                                    const nextOpts: ChoiceOption[] = cq.options.map(
                                      (o, idx) =>
                                        idx === oIdx ? { ...o, value: nextVal } : o
                                    );
                                    return {
                                      ...prev,
                                      questionItem: {
                                        ...prev.questionItem,
                                        question: {
                                          ...prev.questionItem.question,
                                          choiceQuestion: { ...cq, options: nextOpts },
                                        },
                                      },
                                    };
                                  });
                                }}
                                placeholder={`Option ${oIdx + 1}`}
                                className="flex-1 px-3 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                              />
                            )}
                            <button
                              type="button"
                              disabled={opts.length <= 1}
                              onClick={() =>
                                updateItem(selectedItem._clientId, (prev) => {
                                  const cq = prev.questionItem?.question.choiceQuestion;
                                  if (!cq || !prev.questionItem) return prev;
                                  return {
                                    ...prev,
                                    questionItem: {
                                      ...prev.questionItem,
                                      question: {
                                        ...prev.questionItem.question,
                                        choiceQuestion: {
                                          ...cq,
                                          options: cq.options.filter(
                                            (_, idx) => idx !== oIdx
                                          ),
                                        },
                                      },
                                    },
                                  };
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50 disabled:opacity-25"
                              title="Remove option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(selectedItem._clientId, (prev) => {
                          const cq = prev.questionItem?.question.choiceQuestion;
                          if (!cq || !prev.questionItem) return prev;
                          const count = cq.options.filter((o) => !o.isOther).length + 1;
                          const nextOpts = [...cq.options];
                          const otherIdx = nextOpts.findIndex((o) => o.isOther);
                          const newOpt = { value: `Option ${count}` };
                          if (otherIdx !== -1) {
                            nextOpts.splice(otherIdx, 0, newOpt);
                          } else {
                            nextOpts.push(newOpt);
                          }
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                choiceQuestion: { ...cq, options: nextOpts },
                              },
                            },
                          };
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add option
                    </button>

                    {selectedItem.questionItem.question.choiceQuestion.type !==
                      'DROP_DOWN' &&
                      !selectedItem.questionItem.question.choiceQuestion.options.some(
                        (o) => o.isOther
                      ) && (
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(selectedItem._clientId, (prev) => {
                              const cq = prev.questionItem?.question.choiceQuestion;
                              if (!cq || !prev.questionItem) return prev;
                              return {
                                ...prev,
                                questionItem: {
                                  ...prev.questionItem,
                                  question: {
                                    ...prev.questionItem.question,
                                    choiceQuestion: {
                                      ...cq,
                                      options: [...cq.options, { isOther: true }],
                                    },
                                  },
                                },
                              };
                            })
                          }
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          + Add "Other" write-in
                        </button>
                      )}
                  </div>
                </div>
              )}

              {/* Linear Scale Controls */}
              {selectedItem.questionItem?.question.scaleQuestion && (
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Lower bound
                    </label>
                    <select
                      value={selectedItem.questionItem.question.scaleQuestion.low}
                      onChange={(e) => {
                        const low = Number(e.target.value);
                        updateItem(selectedItem._clientId, (prev) => {
                          const sq = prev.questionItem?.question.scaleQuestion;
                          if (!sq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                scaleQuestion: { ...sq, low },
                              },
                            },
                          };
                        });
                      }}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Upper bound
                    </label>
                    <select
                      value={selectedItem.questionItem.question.scaleQuestion.high}
                      onChange={(e) => {
                        const high = Number(e.target.value);
                        updateItem(selectedItem._clientId, (prev) => {
                          const sq = prev.questionItem?.question.scaleQuestion;
                          if (!sq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                scaleQuestion: { ...sq, high },
                              },
                            },
                          };
                        });
                      }}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Low label (optional)
                    </label>
                    <input
                      type="text"
                      value={
                        selectedItem.questionItem.question.scaleQuestion.lowLabel ?? ''
                      }
                      onChange={(e) => {
                        const lowLabel = e.target.value;
                        updateItem(selectedItem._clientId, (prev) => {
                          const sq = prev.questionItem?.question.scaleQuestion;
                          if (!sq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                scaleQuestion: { ...sq, lowLabel },
                              },
                            },
                          };
                        });
                      }}
                      placeholder="e.g. Strongly disagree"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      High label (optional)
                    </label>
                    <input
                      type="text"
                      value={
                        selectedItem.questionItem.question.scaleQuestion.highLabel ?? ''
                      }
                      onChange={(e) => {
                        const highLabel = e.target.value;
                        updateItem(selectedItem._clientId, (prev) => {
                          const sq = prev.questionItem?.question.scaleQuestion;
                          if (!sq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                scaleQuestion: { ...sq, highLabel },
                              },
                            },
                          };
                        });
                      }}
                      placeholder="e.g. Strongly agree"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Date Options */}
              {selectedItem.questionItem?.question.dateQuestion && (
                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        selectedItem.questionItem.question.dateQuestion.includeYear ?? true
                      )}
                      onChange={(e) =>
                        updateItem(selectedItem._clientId, (prev) => {
                          const dq = prev.questionItem?.question.dateQuestion;
                          if (!dq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                dateQuestion: { ...dq, includeYear: e.target.checked },
                              },
                            },
                          };
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    Include year
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        selectedItem.questionItem.question.dateQuestion.includeTime
                      )}
                      onChange={(e) =>
                        updateItem(selectedItem._clientId, (prev) => {
                          const dq = prev.questionItem?.question.dateQuestion;
                          if (!dq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                dateQuestion: { ...dq, includeTime: e.target.checked },
                              },
                            },
                          };
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    Include time
                  </label>
                </div>
              )}

              {/* Time Options */}
              {selectedItem.questionItem?.question.timeQuestion && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        selectedItem.questionItem.question.timeQuestion.duration
                      )}
                      onChange={(e) =>
                        updateItem(selectedItem._clientId, (prev) => {
                          const tq = prev.questionItem?.question.timeQuestion;
                          if (!tq || !prev.questionItem) return prev;
                          return {
                            ...prev,
                            questionItem: {
                              ...prev.questionItem,
                              question: {
                                ...prev.questionItem.question,
                                timeQuestion: { ...tq, duration: e.target.checked },
                              },
                            },
                          };
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    Collect elapsed duration instead of time of day
                  </label>
                </div>
              )}

              {/* Quiz Grading Section (shown when Quiz mode is enabled in Settings) */}
              {isQuiz && selectedItem.questionItem && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Quiz grading
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600" htmlFor="quiz-points">
                        Points
                      </label>
                      <input
                        id="quiz-points"
                        type="number"
                        min={0}
                        max={100}
                        value={selectedItem.questionItem.question.grading?.pointValue ?? 0}
                        onChange={(e) => {
                          const pointValue = Math.max(0, Number(e.target.value) || 0);
                          updateItem(selectedItem._clientId, (prev) => {
                            if (!prev.questionItem) return prev;
                            return {
                              ...prev,
                              questionItem: {
                                ...prev.questionItem,
                                question: {
                                  ...prev.questionItem.question,
                                  grading: {
                                    ...prev.questionItem.question.grading,
                                    pointValue,
                                  },
                                },
                              },
                            };
                          });
                        }}
                        className="w-20 px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {selectedItem.questionItem.question.choiceQuestion && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1.5">
                        Correct answer key
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.questionItem.question.choiceQuestion.options
                          .filter((o) => !o.isOther && o.value)
                          .map((opt) => {
                            const val = opt.value!;
                            const currentCorrect =
                              selectedItem.questionItem?.question.grading?.correctAnswers?.answers.map(
                                (a) => a.value
                              ) ?? [];
                            const isChecked = currentCorrect.includes(val);
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() =>
                                  updateItem(selectedItem._clientId, (prev) => {
                                    if (!prev.questionItem) return prev;
                                    const existing =
                                      prev.questionItem.question.grading?.correctAnswers?.answers.map(
                                        (a) => a.value
                                      ) ?? [];
                                    const isCheckbox =
                                      prev.questionItem.question.choiceQuestion?.type ===
                                      'CHECKBOX';
                                    const nextValues = isCheckbox
                                      ? isChecked
                                        ? existing.filter((v) => v !== val)
                                        : [...existing, val]
                                      : isChecked
                                      ? []
                                      : [val];
                                    return {
                                      ...prev,
                                      questionItem: {
                                        ...prev.questionItem,
                                        question: {
                                          ...prev.questionItem.question,
                                          grading: {
                                            ...prev.questionItem.question.grading,
                                            correctAnswers: {
                                              answers: nextValues.map((value) => ({
                                                value,
                                              })),
                                            },
                                          },
                                        },
                                      },
                                    };
                                  })
                                }
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                {isChecked ? '✓ ' : ''}
                                {val}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
