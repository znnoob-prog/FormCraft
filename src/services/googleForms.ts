import {
  ChangeSummaryItem,
  DraftForm,
  DraftFormItem,
  FormItem,
  FormResponse,
  FormTemplate,
  GoogleForm,
  LibraryFormEntry,
  QuestionKind,
} from '../types/forms';

const FORMS_API_BASE = 'https://forms.googleapis.com/v1/forms';
const LIBRARY_STORAGE_KEY = 'formcraft_library_v1';

export class FormsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FormsApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Google Forms request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse errors
    }
    throw new FormsApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export function extractFormId(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Enter a Google Form URL or Form ID.');
  }

  if (trimmed.includes('/forms/d/e/')) {
    throw new Error(
      'That looks like a public responder link (/d/e/...). Open the form in Google Forms editor and paste the URL containing /forms/d/<FORM_ID>/edit.'
    );
  }

  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleanId.length < 10) {
    throw new Error('Could not recognize a valid Google Form ID from that input.');
  }
  return cleanId;
}

export async function createForm(
  accessToken: string,
  title: string,
  documentTitle?: string
): Promise<GoogleForm> {
  const res = await fetch(FORMS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: title.trim() || 'Untitled Form',
        documentTitle: (documentTitle || title).trim() || 'Untitled Form',
      },
    }),
  });
  return handleResponse<GoogleForm>(res);
}

export async function getForm(accessToken: string, formId: string): Promise<GoogleForm> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`${FORMS_API_BASE}/${safeFormId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleResponse<GoogleForm>(res);
}

export async function batchUpdateForm(
  accessToken: string,
  formId: string,
  requests: Record<string, unknown>[]
): Promise<GoogleForm> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`${FORMS_API_BASE}/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      includeFormInResponse: true,
      requests,
    }),
  });
  const data = await handleResponse<{ form: GoogleForm }>(res);
  return data.form;
}

export async function listResponses(
  accessToken: string,
  formId: string
): Promise<FormResponse[]> {
  const safeFormId = encodeURIComponent(formId.trim());
  const allResponses: FormResponse[] = [];
  let pageToken: string | undefined;
  let guard = 0;

  do {
    const url = new URL(`${FORMS_API_BASE}/${safeFormId}/responses`);
    url.searchParams.set('pageSize', '200');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await handleResponse<{
      responses?: FormResponse[];
      nextPageToken?: string;
    }>(res);

    if (data.responses?.length) {
      allResponses.push(...data.responses);
    }
    pageToken = data.nextPageToken;
    guard += 1;
  } while (pageToken && guard < 15);

  return allResponses.sort(
    (a, b) =>
      new Date(b.lastSubmittedTime || b.createTime).getTime() -
      new Date(a.lastSubmittedTime || a.createTime).getTime()
  );
}

export function getQuestionKind(item: FormItem): QuestionKind {
  if (item.pageBreakItem) return 'SECTION_BREAK';
  if (item.textItem) return 'TEXT_BLOCK';
  const q = item.questionItem?.question;
  if (!q) return 'UNSUPPORTED';
  if (q.textQuestion) {
    return q.textQuestion.paragraph ? 'PARAGRAPH' : 'SHORT_ANSWER';
  }
  if (q.choiceQuestion) {
    if (q.choiceQuestion.type === 'RADIO') return 'MULTIPLE_CHOICE';
    if (q.choiceQuestion.type === 'CHECKBOX') return 'CHECKBOXES';
    if (q.choiceQuestion.type === 'DROP_DOWN') return 'DROPDOWN';
  }
  if (q.scaleQuestion) return 'LINEAR_SCALE';
  if (q.dateQuestion) return 'DATE';
  if (q.timeQuestion) return 'TIME';
  return 'UNSUPPORTED';
}

export function getQuestionKindLabel(kind: QuestionKind): string {
  switch (kind) {
    case 'SHORT_ANSWER':
      return 'Short answer';
    case 'PARAGRAPH':
      return 'Paragraph';
    case 'MULTIPLE_CHOICE':
      return 'Multiple choice';
    case 'CHECKBOXES':
      return 'Checkboxes';
    case 'DROPDOWN':
      return 'Dropdown';
    case 'LINEAR_SCALE':
      return 'Linear scale';
    case 'DATE':
      return 'Date';
    case 'TIME':
      return 'Time';
    case 'SECTION_BREAK':
      return 'Section break';
    case 'TEXT_BLOCK':
      return 'Title & text';
    default:
      return 'Custom item';
  }
}

export function createClientItemId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function toDraftForm(form: GoogleForm): DraftForm {
  return {
    formId: form.formId,
    info: {
      title: form.info?.title ?? 'Untitled Form',
      documentTitle: form.info?.documentTitle ?? form.info?.title ?? 'Untitled Form',
      description: form.info?.description ?? '',
    },
    settings: {
      quizSettings: {
        isQuiz: Boolean(form.settings?.quizSettings?.isQuiz),
      },
      emailCollectionType: form.settings?.emailCollectionType,
    },
    responderUri: form.responderUri,
    revisionId: form.revisionId,
    items: (form.items ?? []).map((item) => ({
      ...structuredClone(item),
      _clientId: item.itemId || createClientItemId(),
    })),
  };
}

export function createBlankDraftItem(kind: QuestionKind): DraftFormItem {
  const _clientId = createClientItemId();
  switch (kind) {
    case 'SHORT_ANSWER':
      return {
        _clientId,
        title: 'Untitled short answer question',
        questionItem: { question: { required: false, textQuestion: { paragraph: false } } },
      };
    case 'PARAGRAPH':
      return {
        _clientId,
        title: 'Untitled paragraph question',
        questionItem: { question: { required: false, textQuestion: { paragraph: true } } },
      };
    case 'MULTIPLE_CHOICE':
      return {
        _clientId,
        title: 'Untitled multiple choice question',
        questionItem: {
          question: {
            required: false,
            choiceQuestion: {
              type: 'RADIO',
              options: [{ value: 'Option 1' }, { value: 'Option 2' }],
            },
          },
        },
      };
    case 'CHECKBOXES':
      return {
        _clientId,
        title: 'Untitled checkboxes question',
        questionItem: {
          question: {
            required: false,
            choiceQuestion: {
              type: 'CHECKBOX',
              options: [{ value: 'Option 1' }, { value: 'Option 2' }],
            },
          },
        },
      };
    case 'DROPDOWN':
      return {
        _clientId,
        title: 'Untitled dropdown question',
        questionItem: {
          question: {
            required: false,
            choiceQuestion: {
              type: 'DROP_DOWN',
              options: [{ value: 'Option 1' }, { value: 'Option 2' }],
            },
          },
        },
      };
    case 'LINEAR_SCALE':
      return {
        _clientId,
        title: 'Untitled rating scale',
        questionItem: {
          question: {
            required: false,
            scaleQuestion: { low: 1, high: 5, lowLabel: 'Low', highLabel: 'High' },
          },
        },
      };
    case 'DATE':
      return {
        _clientId,
        title: 'Untitled date question',
        questionItem: {
          question: {
            required: false,
            dateQuestion: { includeTime: false, includeYear: true },
          },
        },
      };
    case 'TIME':
      return {
        _clientId,
        title: 'Untitled time question',
        questionItem: {
          question: {
            required: false,
            timeQuestion: { duration: false },
          },
        },
      };
    case 'SECTION_BREAK':
      return {
        _clientId,
        title: 'New section',
        description: '',
        pageBreakItem: {},
      };
    case 'TEXT_BLOCK':
    default:
      return {
        _clientId,
        title: 'Section notes',
        description: 'Additional context for respondents.',
        textItem: {},
      };
  }
}

function stripClientFields(item: DraftFormItem): FormItem {
  const { _clientId: _ignored, ...cloned } = structuredClone(item);
  // Clean empty strings from optional fields
  if (cloned.description === '') {
    delete cloned.description;
  }
  if (cloned.questionItem?.question?.choiceQuestion) {
    const cq = cloned.questionItem.question.choiceQuestion;
    cq.options = cq.options.filter((opt) => opt.isOther || (opt.value && opt.value.trim() !== ''));
    // Dropdown cannot contain isOther
    if (cq.type === 'DROP_DOWN') {
      cq.options = cq.options.filter((opt) => !opt.isOther);
    }
    if (cq.options.length === 0) {
      cq.options = [{ value: 'Option 1' }];
    }
  }
  return cloned;
}

function canUpdateInPlace(orig: FormItem, draft: DraftFormItem): boolean {
  if (!orig.itemId || orig.itemId !== draft.itemId) return false;
  if (orig.pageBreakItem && draft.pageBreakItem) return true;
  if (orig.textItem && draft.textItem) return true;
  if (orig.questionGroupItem && draft.questionGroupItem) return true;
  if (orig.questionItem && draft.questionItem) {
    const oq = orig.questionItem.question;
    const dq = draft.questionItem.question;
    if (oq.textQuestion && dq.textQuestion) return true;
    if (oq.choiceQuestion && dq.choiceQuestion) return true;
    if (oq.scaleQuestion && dq.scaleQuestion) return true;
    if (oq.dateQuestion && dq.dateQuestion) return true;
    if (oq.timeQuestion && dq.timeQuestion) return true;
  }
  return false;
}

function stableItemEqual(a: FormItem, b: FormItem): boolean {
  return JSON.stringify(stripClientFields(a as DraftFormItem)) === JSON.stringify(stripClientFields(b as DraftFormItem));
}

export function validateDraftForm(draft: DraftForm): string[] {
  const errors: string[] = [];
  if (!draft.info.title.trim()) {
    errors.push('Form title cannot be empty.');
  }
  draft.items.forEach((item, idx) => {
    const label = item.title?.trim() || `Item #${idx + 1}`;
    const cq = item.questionItem?.question?.choiceQuestion;
    if (cq) {
      const values = cq.options
        .filter((o) => !o.isOther)
        .map((o) => (o.value ?? '').trim());
      if (values.some((v) => v === '')) {
        errors.push(`"${label}" has an empty choice option.`);
      }
      const unique = new Set(values);
      if (unique.size !== values.length) {
        errors.push(`"${label}" has duplicate option labels (Google Forms requires unique options).`);
      }
      if (values.length === 0 && !cq.options.some((o) => o.isOther)) {
        errors.push(`"${label}" must have at least one option.`);
      }
    }
    const sq = item.questionItem?.question?.scaleQuestion;
    if (sq) {
      if (sq.low < 0 || sq.low > 1 || sq.high < 2 || sq.high > 10 || sq.low >= sq.high) {
        errors.push(`"${label}" scale bounds must start at 0 or 1 and end between 2 and 10.`);
      }
    }
  });
  return errors;
}

export function compileBatchUpdate(
  original: GoogleForm,
  draft: DraftForm
): { requests: Record<string, unknown>[]; summary: ChangeSummaryItem[] } {
  const requests: Record<string, unknown>[] = [];
  const summary: ChangeSummaryItem[] = [];

  const origTitle = original.info?.title ?? '';
  const origDesc = original.info?.description ?? '';
  const draftTitle = draft.info.title.trim();
  const draftDesc = draft.info.description ?? '';

  if (origTitle !== draftTitle || origDesc !== draftDesc) {
    const maskParts: string[] = [];
    if (origTitle !== draftTitle) maskParts.push('title');
    if (origDesc !== draftDesc) maskParts.push('description');
    requests.push({
      updateFormInfo: {
        info: {
          title: draftTitle,
          description: draftDesc,
        },
        updateMask: maskParts.join(','),
      },
    });
    summary.push({
      kind: 'info',
      label: 'Update form header',
      detail:
        origTitle !== draftTitle
          ? `Rename form to "${draftTitle}"`
          : 'Update form description',
    });
  }

  const origIsQuiz = Boolean(original.settings?.quizSettings?.isQuiz);
  const draftIsQuiz = Boolean(draft.settings?.quizSettings?.isQuiz);
  if (origIsQuiz !== draftIsQuiz) {
    requests.push({
      updateSettings: {
        settings: {
          quizSettings: { isQuiz: draftIsQuiz },
        },
        updateMask: 'quizSettings.isQuiz',
      },
    });
    summary.push({
      kind: 'settings',
      label: draftIsQuiz ? 'Enable Quiz mode' : 'Disable Quiz mode',
      detail: draftIsQuiz
        ? 'Allows point values and answer keys on questions'
        : 'Switch form back to standard survey mode',
    });
  }

  const origItems = original.items ?? [];
  const draftByItemId = new Map<string, DraftFormItem>();
  draft.items.forEach((d) => {
    if (d.itemId) draftByItemId.set(d.itemId, d);
  });

  // Simulated server items state tracking exact sequential indices
  type SimNode = { key: string; origItem?: FormItem; isNew: boolean };
  const simulated: SimNode[] = origItems.map((item, i) => ({
    key: item.itemId || `orig_${i}`,
    origItem: item,
    isNew: false,
  }));

  const replacedIds = new Set<string>();

  // 1. Delete removed items or items whose fundamental type changed (Google Forms API forbids changing question oneof type in place)
  for (let i = simulated.length - 1; i >= 0; i--) {
    const node = simulated[i];
    const origItem = node.origItem!;
    const matchingDraft = origItem.itemId ? draftByItemId.get(origItem.itemId) : undefined;

    if (!matchingDraft) {
      requests.push({ deleteItem: { location: { index: i } } });
      simulated.splice(i, 1);
      summary.push({
        kind: 'delete',
        label: `Delete "${origItem.title || 'Untitled item'}"`,
        detail: getQuestionKindLabel(getQuestionKind(origItem)),
      });
    } else if (!canUpdateInPlace(origItem, matchingDraft)) {
      requests.push({ deleteItem: { location: { index: i } } });
      simulated.splice(i, 1);
      replacedIds.add(matchingDraft._clientId);
      summary.push({
        kind: 'replace',
        label: `Convert "${matchingDraft.title || 'Untitled item'}"`,
        detail: `${getQuestionKindLabel(getQuestionKind(origItem))} → ${getQuestionKindLabel(
          getQuestionKind(matchingDraft)
        )}`,
      });
    }
  }

  // 2. Create newly added items (and replaced type-changed items) at their target positions
  draft.items.forEach((draftItem, targetIdx) => {
    const existingSimIdx = simulated.findIndex(
      (n) => !n.isNew && n.origItem?.itemId && n.origItem.itemId === draftItem.itemId
    );
    if (existingSimIdx === -1) {
      const insertAt = Math.min(targetIdx, simulated.length);
      const cleanItem = stripClientFields(draftItem);
      delete cleanItem.itemId;
      if (cleanItem.questionItem?.question) {
        delete cleanItem.questionItem.question.questionId;
      }
      requests.push({
        createItem: {
          item: cleanItem,
          location: { index: insertAt },
        },
      });
      simulated.splice(insertAt, 0, {
        key: draftItem._clientId,
        isNew: true,
      });

      if (!replacedIds.has(draftItem._clientId)) {
        summary.push({
          kind: 'create',
          label: `Add "${draftItem.title || 'Untitled item'}"`,
          detail: getQuestionKindLabel(getQuestionKind(draftItem)),
        });
      }
    }
  });

  // 3. Reorder any out-of-position items via moveItem
  let reorderedCount = 0;
  for (let targetIdx = 0; targetIdx < draft.items.length; targetIdx++) {
    const draftItem = draft.items[targetIdx];
    const currentIdx = simulated.findIndex((n) =>
      n.isNew ? n.key === draftItem._clientId : n.origItem?.itemId === draftItem.itemId
    );
    if (currentIdx !== -1 && currentIdx !== targetIdx) {
      requests.push({
        moveItem: {
          originalLocation: { index: currentIdx },
          newLocation: { index: targetIdx },
        },
      });
      const [moved] = simulated.splice(currentIdx, 1);
      simulated.splice(targetIdx, 0, moved);
      reorderedCount += 1;
    }
  }
  if (reorderedCount > 0) {
    summary.push({
      kind: 'reorder',
      label: `Reorder ${reorderedCount} item${reorderedCount > 1 ? 's' : ''}`,
      detail: 'Matches updated outline sequence',
    });
  }

  // 4. Update existing items whose content changed
  for (let idx = 0; idx < draft.items.length; idx++) {
    const draftItem = draft.items[idx];
    const simNode = simulated[idx];
    if (!simNode || simNode.isNew || !simNode.origItem) continue;

    if (!stableItemEqual(simNode.origItem, draftItem)) {
      const cleanItem = stripClientFields(draftItem);
      const maskParts = ['title', 'description'];
      if (cleanItem.questionItem) maskParts.push('questionItem');
      if (cleanItem.questionGroupItem) maskParts.push('questionGroupItem');

      requests.push({
        updateItem: {
          item: cleanItem,
          location: { index: idx },
          updateMask: maskParts.join(','),
        },
      });
      summary.push({
        kind: 'update',
        label: `Update "${draftItem.title || 'Untitled item'}"`,
        detail: getQuestionKindLabel(getQuestionKind(draftItem)),
      });
    }
  }

  return { requests, summary };
}

export function loadLibraryForms(): LibraryFormEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertLibraryForm(form: GoogleForm): LibraryFormEntry[] {
  const existing = loadLibraryForms().filter((entry) => entry.formId !== form.formId);
  const nextEntry: LibraryFormEntry = {
    formId: form.formId,
    title: form.info?.title || 'Untitled Form',
    responderUri: form.responderUri,
    itemCount: form.items?.length ?? 0,
    lastOpenedAt: new Date().toISOString(),
  };
  const updated = [nextEntry, ...existing].slice(0, 25);
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
  return updated;
}

export function removeLibraryForm(formId: string): LibraryFormEntry[] {
  const updated = loadLibraryForms().filter((entry) => entry.formId !== formId);
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'product-feedback',
    name: 'Product Feedback Survey',
    category: 'Research',
    description: 'NPS rating, feature priorities, and open qualitative feedback.',
    info: {
      title: 'Product Experience Feedback',
      documentTitle: 'Product Experience Feedback',
      description: 'Help us sharpen the workflow. Takes about 2 minutes to complete.',
    },
    items: [
      {
        title: 'How satisfied are you with the product overall?',
        questionItem: {
          question: {
            required: true,
            scaleQuestion: {
              low: 1,
              high: 5,
              lowLabel: 'Not satisfied',
              highLabel: 'Very satisfied',
            },
          },
        },
      },
      {
        title: 'Which area brings you the most value today?',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: [
                { value: 'Speed & keyboard workflows' },
                { value: 'Reporting & analytics' },
                { value: 'Team collaboration' },
                { value: 'Integrations' },
                { isOther: true },
              ],
            },
          },
        },
      },
      {
        title: 'What is the one friction point you wish we fixed next?',
        questionItem: {
          question: {
            required: false,
            textQuestion: { paragraph: true },
          },
        },
      },
    ],
  },
  {
    id: 'event-registration',
    name: 'Workshop Registration',
    category: 'Events',
    description: 'Attendee details, session track selection, and dietary notes.',
    info: {
      title: 'Workshop & Summit Registration',
      documentTitle: 'Workshop & Summit Registration',
      description: 'Reserve your seat and choose your afternoon breakout session.',
    },
    items: [
      {
        title: 'Full name',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      {
        title: 'Preferred breakout session',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'DROP_DOWN',
              options: [
                { value: 'Design Systems at Scale' },
                { value: 'Applied AI Workflows' },
                { value: 'Product Analytics Deep Dive' },
              ],
            },
          },
        },
      },
      {
        title: 'Which days will you attend?',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'CHECKBOX',
              options: [
                { value: 'Day 1 — Keynotes' },
                { value: 'Day 2 — Hands-on Labs' },
              ],
            },
          },
        },
      },
      {
        title: 'Accessibility or dietary requirements',
        questionItem: {
          question: {
            required: false,
            textQuestion: { paragraph: true },
          },
        },
      },
    ],
  },
  {
    id: 'discovery-interview',
    name: 'Customer Discovery Intake',
    category: 'Product',
    description: 'Pre-call intake covering role, workflow tools, and availability.',
    info: {
      title: 'Customer Discovery Intake',
      documentTitle: 'Customer Discovery Intake',
      description: 'Quick context before our 25-minute conversation.',
    },
    items: [
      {
        title: 'Your role or team',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      {
        title: 'How often do you run surveys or intake forms?',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: [
                { value: 'Daily' },
                { value: 'Weekly' },
                { value: 'Monthly' },
                { value: 'Quarterly' },
              ],
            },
          },
        },
      },
      {
        title: 'Preferred interview date',
        questionItem: {
          question: {
            required: false,
            dateQuestion: { includeYear: true, includeTime: false },
          },
        },
      },
    ],
  },
];
