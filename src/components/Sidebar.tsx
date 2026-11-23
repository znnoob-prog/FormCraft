import React, { useState } from 'react';
import {
  FilePlus2,
  FileText,
  FolderOpen,
  LayoutTemplate,
  LogOut,
  Trash2,
} from 'lucide-react';
import { FORM_TEMPLATES } from '../services/googleForms';
import { FormTemplate, LibraryFormEntry } from '../types/forms';

interface SidebarProps {
  library: LibraryFormEntry[];
  activeFormId: string | null;
  userEmail: string | null;
  userName: string | null;
  isBusy: boolean;
  onOpenByInput: (input: string) => Promise<void>;
  onSelectForm: (formId: string) => void;
  onRemoveFromLibrary: (formId: string) => void;
  onCreateBlankForm: () => void;
  onCreateFromTemplate: (template: FormTemplate) => void;
  onSignOut: () => void;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  library,
  activeFormId,
  userEmail,
  userName,
  isBusy,
  onOpenByInput,
  onSelectForm,
  onRemoveFromLibrary,
  onCreateBlankForm,
  onCreateFromTemplate,
  onSignOut,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    setIsOpening(true);
    try {
      await onOpenByInput(urlInput);
      setUrlInput('');
    } catch (err: unknown) {
      setInputError(err instanceof Error ? err.message : 'Unable to open form.');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <aside className="w-full lg:w-[272px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col lg:h-screen lg:sticky lg:top-0">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <span className="text-base font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
          FormCraft
        </span>
        <button
          type="button"
          onClick={onCreateBlankForm}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          New Form
        </button>
      </div>

      {/* Open by URL or ID */}
      <div className="p-4 border-b border-slate-200">
        <form onSubmit={handleOpenSubmit} className="space-y-2">
          <label
            htmlFor="open-form-input"
            className="block text-xs font-medium text-slate-600"
          >
            Open existing Google Form
          </label>
          <div className="flex gap-1.5">
            <input
              id="open-form-input"
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder="Paste /forms/d/... URL or ID"
              className="min-w-0 flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={isOpening || isBusy || !urlInput.trim()}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Open Form"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          {inputError && (
            <p className="text-xs text-red-600 leading-snug">{inputError}</p>
          )}
        </form>
      </div>

      {/* Scrollable Library & Templates */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Recent Forms */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Your workspace forms</span>
            <span className="font-mono tabular-nums">{library.length}</span>
          </div>

          {library.length === 0 ? (
            <div className="px-2.5 py-4 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 leading-relaxed">
              No forms opened yet. Create a new form, pick a template below, or paste an existing Google Form URL above.
            </div>
          ) : (
            <ul className="space-y-1">
              {library.map((entry) => {
                const isActive = entry.formId === activeFormId;
                return (
                  <li key={entry.formId} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectForm(entry.formId)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-start gap-2.5 pr-8 ${
                        isActive
                          ? 'bg-blue-50/80 text-blue-900'
                          : 'text-slate-700 hover:bg-slate-100/80'
                      }`}
                    >
                      <FileText
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">
                          {entry.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums truncate">
                          {entry.itemCount} {entry.itemCount === 1 ? 'item' : 'items'} ·{' '}
                          {formatRelativeTime(entry.lastOpenedAt)}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromLibrary(entry.formId);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-1.5 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition-all"
                      title="Remove from sidebar list"
                      aria-label={`Remove ${entry.title} from list`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Starter Templates */}
        <div>
          <div className="px-2 mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>Quick-start templates</span>
          </div>
          <div className="space-y-1.5">
            {FORM_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={isBusy}
                onClick={() => onCreateFromTemplate(tpl)}
                className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {tpl.name}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                    {tpl.items.length}Q
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-snug">
                  {tpl.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {userName || 'Google Account'}
          </div>
          {userEmail && (
            <div className="text-[11px] text-slate-500 truncate">{userEmail}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
