import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  LayoutTemplate,
  RefreshCw,
} from 'lucide-react';
import { ConfirmationModal } from './components/ConfirmationModal';
import { FormEditor } from './components/FormEditor';
import { FormPreview } from './components/FormPreview';
import { FormSettings } from './components/FormSettings';
import { LandingView } from './components/LandingView';
import { ResponsesAnalytics } from './components/ResponsesAnalytics';
import { Sidebar } from './components/Sidebar';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/auth';
import {
  batchUpdateForm,
  compileBatchUpdate,
  createForm,
  extractFormId,
  FORM_TEMPLATES,
  FormsApiError,
  getForm,
  listResponses,
  loadLibraryForms,
  removeLibraryForm,
  toDraftForm,
  upsertLibraryForm,
} from './services/googleForms';
import {
  ChangeSummaryItem,
  DraftForm,
  FormResponse,
  FormTemplate,
  GoogleForm,
  LibraryFormEntry,
} from './types/forms';

type WorkspaceTab = 'editor' | 'preview' | 'responses' | 'settings';

interface PendingConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  changes?: ChangeSummaryItem[];
  onConfirm: () => Promise<void>;
}

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [library, setLibrary] = useState<LibraryFormEntry[]>(() => loadLibraryForms());
  const [activeForm, setActiveForm] = useState<GoogleForm | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('editor');

  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const [newFormModalOpen, setNewFormModalOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [emptyUrlInput, setEmptyUrlInput] = useState('');
  const [emptyUrlError, setEmptyUrlError] = useState<string | null>(null);
  const [copiedResponder, setCopiedResponder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  useEffect(() => {
    const unsub = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setNeedsAuth(false);
        setAuthReady(true);
      },
      (existingUser) => {
        setUser(existingUser);
        setAccessToken(null);
        setNeedsAuth(true);
        setAuthReady(true);
      }
    );
    return () => unsub();
  }, []);

  const handleApiError = useCallback((err: unknown): string => {
    if (err instanceof FormsApiError && err.status === 401) {
      clearAccessToken();
      setAccessToken(null);
      setNeedsAuth(true);
      return 'Your Google session expired. Sign in again to continue.';
    }
    return err instanceof Error ? err.message : 'An unexpected error occurred.';
  }, []);

  const requireToken = useCallback((): string => {
    const token = accessToken || getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      throw new Error('Authentication required.');
    }
    return token;
  }, [accessToken]);

  const loadResponsesForForm = useCallback(
    async (formId: string, tokenOverride?: string) => {
      const token = tokenOverride || getAccessToken() || accessToken;
      if (!token) return;
      setIsLoadingResponses(true);
      setResponsesError(null);
      try {
        const list = await listResponses(token, formId);
        setResponses(list);
      } catch (err) {
        setResponsesError(handleApiError(err));
      } finally {
        setIsLoadingResponses(false);
      }
    },
    [accessToken, handleApiError]
  );

  const openFormById = useCallback(
    async (rawFormId: string, tokenOverride?: string) => {
      const token = tokenOverride || requireToken();
      setIsLoadingForm(true);
      setWorkspaceError(null);
      try {
        const form = await getForm(token, rawFormId);
        const nextDraft = toDraftForm(form);
        setActiveForm(form);
        setDraftForm(nextDraft);
        setSelectedItemId(nextDraft.items[0]?._clientId ?? null);
        setLibrary(upsertLibraryForm(form));
        setResponses([]);
        void loadResponsesForForm(form.formId, token);
      } catch (err) {
        const msg = handleApiError(err);
        setWorkspaceError(msg);
        throw new Error(msg);
      } finally {
        setIsLoadingForm(false);
      }
    },
    [requireToken, handleApiError, loadResponsesForForm]
  );

  const handleLogin = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      if (activeForm) {
        void loadResponsesForForm(activeForm.formId, result.accessToken);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not complete Google sign-in.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    setUser(null);
    setNeedsAuth(true);
    setActiveForm(null);
    setDraftForm(null);
    setResponses([]);
  };

  const handleOpenByInput = async (input: string) => {
    const id = extractFormId(input);
    await openFormById(id);
    setActiveTab('editor');
  };

  const handleSelectLibraryForm = (formId: string) => {
    if (activeForm?.formId === formId) return;
    const hasUnsaved =
      activeForm &&
      draftForm &&
      compileBatchUpdate(activeForm, draftForm).summary.length > 0;

    if (hasUnsaved) {
      setPendingConfirm({
        title: 'Discard unsaved edits?',
        description: `You have uncommitted changes on "${activeForm.info.title}". Switching forms will discard those local edits.`,
        confirmLabel: 'Switch form',
        tone: 'danger',
        onConfirm: async () => {
          await openFormById(formId);
        },
      });
      return;
    }

    void openFormById(formId).catch(() => {});
  };

  const handleCreateBlankFormConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newFormTitle.trim() || 'Untitled Form';
    setIsMutating(true);
    setWorkspaceError(null);
    try {
      const token = requireToken();
      const created = await createForm(token, title, title);
      const nextDraft = toDraftForm(created);
      setActiveForm(created);
      setDraftForm(nextDraft);
      setSelectedItemId(null);
      setResponses([]);
      setLibrary(upsertLibraryForm(created));
      setActiveTab('editor');
      setNewFormModalOpen(false);
      setNewFormTitle('');
      showToast(`Created "${created.info.title}" in Google Forms`);
    } catch (err) {
      setWorkspaceError(handleApiError(err));
    } finally {
      setIsMutating(false);
    }
  };

  const handleRequestCreateFromTemplate = (template: FormTemplate) => {
    setPendingConfirm({
      title: `Create "${template.name}" in Google Forms?`,
      description:
        'This will create a new Google Form in your account and populate it with starter questions.',
      confirmLabel: 'Create Form',
      changes: template.items.map((item) => ({
        kind: 'create' as const,
        label: item.title || 'Starter question',
        detail: template.category,
      })),
      onConfirm: async () => {
        const token = requireToken();
        const created = await createForm(
          token,
          template.info.title,
          template.info.documentTitle
        );
        const requests: Record<string, unknown>[] = [];
        if (template.info.description) {
          requests.push({
            updateFormInfo: {
              info: {
                title: template.info.title,
                description: template.info.description,
              },
              updateMask: 'title,description',
            },
          });
        }
        template.items.forEach((item, idx) => {
          requests.push({
            createItem: {
              item,
              location: { index: idx },
            },
          });
        });
        const populated = await batchUpdateForm(token, created.formId, requests);
        const nextDraft = toDraftForm(populated);
        setActiveForm(populated);
        setDraftForm(nextDraft);
        setSelectedItemId(nextDraft.items[0]?._clientId ?? null);
        setResponses([]);
        setLibrary(upsertLibraryForm(populated));
        setActiveTab('editor');
        showToast(`Created "${populated.info.title}" from template`);
      },
    });
  };

  const handleRequestSaveChanges = () => {
    if (!activeForm || !draftForm) return;
    const { requests, summary } = compileBatchUpdate(activeForm, draftForm);
    if (requests.length === 0) return;

    setPendingConfirm({
      title: `Save changes to "${activeForm.info.title}"?`,
      description:
        'Review the updates below before applying them to your live Google Form.',
      confirmLabel: 'Save to Google Forms',
      changes: summary,
      onConfirm: async () => {
        const token = requireToken();
        const updated = await batchUpdateForm(token, activeForm.formId, requests);
        const nextDraft = toDraftForm(updated);
        setActiveForm(updated);
        setDraftForm(nextDraft);
        // Keep selection stable by itemId or index
        if (selectedItemId) {
          const stillExists = nextDraft.items.find(
            (it) => it._clientId === selectedItemId
          );
          if (!stillExists) {
            setSelectedItemId(nextDraft.items[0]?._clientId ?? null);
          }
        }
        setLibrary(upsertLibraryForm(updated));
        showToast('Changes saved to Google Forms');
      },
    });
  };

  const handleDiscardDraft = () => {
    if (!activeForm) return;
    const reset = toDraftForm(activeForm);
    setDraftForm(reset);
    setSelectedItemId(reset.items[0]?._clientId ?? null);
    showToast('Discarded local draft edits');
  };

  const handleExecuteConfirm = async () => {
    if (!pendingConfirm) return;
    setIsMutating(true);
    setWorkspaceError(null);
    try {
      await pendingConfirm.onConfirm();
      setPendingConfirm(null);
    } catch (err) {
      setWorkspaceError(handleApiError(err));
      setPendingConfirm(null);
    } finally {
      setIsMutating(false);
    }
  };

  const handleCopyResponderLink = async () => {
    if (!activeForm?.responderUri) return;
    await navigator.clipboard.writeText(activeForm.responderUri);
    setCopiedResponder(true);
    setTimeout(() => setCopiedResponder(false), 1800);
  };

  const pendingDiffCount = useMemo(() => {
    if (!activeForm || !draftForm) return 0;
    return compileBatchUpdate(activeForm, draftForm).summary.length;
  }, [activeForm, draftForm]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Initializing workspace...</div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <LandingView
        onSignIn={handleLogin}
        isSigningIn={isSigningIn}
        authError={authError}
        needsReconnect={Boolean(user)}
        userEmail={user?.email}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      <Sidebar
        library={library}
        activeFormId={activeForm?.formId ?? null}
        userEmail={user?.email ?? null}
        userName={user?.displayName ?? null}
        isBusy={isLoadingForm || isMutating}
        onOpenByInput={handleOpenByInput}
        onSelectForm={handleSelectLibraryForm}
        onRemoveFromLibrary={(id) => setLibrary(removeLibraryForm(id))}
        onCreateBlankForm={() => {
          setNewFormTitle('');
          setNewFormModalOpen(true);
        }}
        onCreateFromTemplate={handleRequestCreateFromTemplate}
        onSignOut={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6">
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <span className="text-slate-500 whitespace-nowrap">Forms</span>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-slate-900 truncate font-display">
              {activeForm ? activeForm.info.title : 'Workspace'}
            </span>
          </div>

          {activeForm && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void openFormById(activeForm.formId)}
                disabled={isLoadingForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                title="Reload latest form structure from Google Forms"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingForm ? 'animate-spin' : ''}`}
                />
                Sync
              </button>
              {activeForm.responderUri && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyResponderLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    {copiedResponder ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedResponder ? 'Copied link' : 'Share link'}
                  </button>
                  <a
                    href={activeForm.responderUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Live Form
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              )}
            </div>
          )}
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1200px] w-full mx-auto">
          {workspaceError && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-4"
            >
              <span>{workspaceError}</span>
              <button
                type="button"
                onClick={() => setWorkspaceError(null)}
                className="text-xs font-semibold text-red-700 hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoadingForm && !activeForm ? (
            <div className="space-y-4">
              <div className="h-14 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : !activeForm || !draftForm ? (
            /* Empty Workspace Onboarding State */
            <div className="py-8 max-w-3xl mx-auto space-y-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-display">
                  Open or create a Google Form
                </h1>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Paste an existing Google Forms edit URL to inspect its questions and responses, create a blank form, or start from a structured template.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Open Existing */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 font-display">
                      <FolderOpen className="w-4 h-4 text-blue-600" />
                      Open existing form
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      Paste the editor URL (<span className="font-mono">/forms/d/.../edit</span>) or raw Form ID from Google Forms.
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setEmptyUrlError(null);
                      try {
                        await handleOpenByInput(emptyUrlInput);
                        setEmptyUrlInput('');
                      } catch (err) {
                        setEmptyUrlError(
                          err instanceof Error ? err.message : 'Unable to open form.'
                        );
                      }
                    }}
                    className="mt-4 space-y-2"
                  >
                    <input
                      type="text"
                      value={emptyUrlInput}
                      onChange={(e) => {
                        setEmptyUrlInput(e.target.value);
                        if (emptyUrlError) setEmptyUrlError(null);
                      }}
                      placeholder="https://docs.google.com/forms/d/..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                    {emptyUrlError && (
                      <p className="text-xs text-red-600">{emptyUrlError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!emptyUrlInput.trim() || isLoadingForm}
                      className="w-full px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                    >
                      Open in Studio
                    </button>
                  </form>
                </div>

                {/* Create Blank */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 font-display">
                      <FilePlus2 className="w-4 h-4 text-blue-600" />
                      Create blank Google Form
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      Provision a new Google Form directly in your Drive and design its questions in the split outline studio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFormTitle('');
                      setNewFormModalOpen(true);
                    }}
                    className="mt-4 w-full px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    New Blank Form
                  </button>
                </div>
              </div>

              {/* Templates Row */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3">
                  <LayoutTemplate className="w-4 h-4 text-slate-400" />
                  <span>Or launch a real Google Form from a template</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {FORM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleRequestCreateFromTemplate(tpl)}
                      className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-600 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {tpl.category} · {tpl.items.length} questions
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 font-display">
                          {tpl.name}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                      <div className="mt-3 text-xs font-semibold text-blue-600">
                        Use template →
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Form Studio */
            <div className="space-y-5">
              {/* Segmented Workspace Mode Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div
                  role="tablist"
                  aria-label="Form studio views"
                  className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
                >
                  {(
                    [
                      {
                        id: 'editor',
                        label:
                          pendingDiffCount > 0
                            ? `Editor (${pendingDiffCount})`
                            : 'Editor',
                      },
                      { id: 'preview', label: 'Preview' },
                      {
                        id: 'responses',
                        label: `Responses (${responses.length})`,
                      },
                      { id: 'settings', label: 'Settings' },
                    ] as Array<{ id: WorkspaceTab; label: string }>
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap tabular-nums ${
                          active
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs text-slate-500 tabular-nums">
                  {activeForm.items?.length ?? 0} live items ·{' '}
                  {activeForm.settings?.quizSettings?.isQuiz ? 'Quiz mode' : 'Standard form'}
                </div>
              </div>

              {activeTab === 'editor' && (
                <FormEditor
                  originalForm={activeForm}
                  draft={draftForm}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onChangeDraft={(updater) =>
                    setDraftForm((prev) => (prev ? updater(prev) : prev))
                  }
                  onDiscardDraft={handleDiscardDraft}
                  onRequestSave={handleRequestSaveChanges}
                />
              )}

              {activeTab === 'preview' && <FormPreview draft={draftForm} />}

              {activeTab === 'responses' && (
                <ResponsesAnalytics
                  form={activeForm}
                  responses={responses}
                  isLoading={isLoadingResponses}
                  error={responsesError}
                  onRefresh={() => void loadResponsesForForm(activeForm.formId)}
                />
              )}

              {activeTab === 'settings' && (
                <FormSettings
                  originalForm={activeForm}
                  draft={draftForm}
                  onChangeDraft={(updater) =>
                    setDraftForm((prev) => (prev ? updater(prev) : prev))
                  }
                  onRequestSave={handleRequestSaveChanges}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Blank Form Confirmation Dialog */}
      {newFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-form-dialog-title"
        >
          <form
            onSubmit={handleCreateBlankFormConfirm}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <h2
                id="new-form-dialog-title"
                className="text-base font-semibold text-slate-900 font-display"
              >
                Create new Google Form
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Confirm to create a new blank form file in your Google account.
              </p>
            </div>
            <div className="p-6">
              <label
                htmlFor="new-form-title-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Form title
              </label>
              <input
                id="new-form-title-input"
                type="text"
                autoFocus
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="e.g. Q4 Product Feedback"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setNewFormModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutating}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {isMutating ? 'Creating...' : 'Create Form'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mandatory Confirmation Modal for All Mutating Workspace API Calls */}
      <ConfirmationModal
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ''}
        description={pendingConfirm?.description ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel ?? 'Confirm'}
        tone={pendingConfirm?.tone ?? 'primary'}
        changes={pendingConfirm?.changes}
        isSubmitting={isMutating}
        onConfirm={() => void handleExecuteConfirm()}
        onCancel={() => {
          if (!isMutating) setPendingConfirm(null);
        }}
      />

      {/* Non-intrusive Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
