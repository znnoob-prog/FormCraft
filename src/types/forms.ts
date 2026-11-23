export type ChoiceType = 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';

export type QuestionKind =
  | 'SHORT_ANSWER'
  | 'PARAGRAPH'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'DROPDOWN'
  | 'LINEAR_SCALE'
  | 'DATE'
  | 'TIME'
  | 'SECTION_BREAK'
  | 'TEXT_BLOCK'
  | 'UNSUPPORTED';

export interface ChoiceOption {
  value?: string;
  isOther?: boolean;
}

export interface ChoiceQuestion {
  type: ChoiceType;
  options: ChoiceOption[];
  shuffle?: boolean;
}

export interface TextQuestion {
  paragraph?: boolean;
}

export interface ScaleQuestion {
  low: number;
  high: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface DateQuestion {
  includeTime?: boolean;
  includeYear?: boolean;
}

export interface TimeQuestion {
  duration?: boolean;
}

export interface CorrectAnswer {
  value: string;
}

export interface Grading {
  pointValue?: number;
  correctAnswers?: {
    answers: CorrectAnswer[];
  };
  generalFeedback?: {
    text: string;
  };
}

export interface FormQuestion {
  questionId?: string;
  required?: boolean;
  grading?: Grading;
  choiceQuestion?: ChoiceQuestion;
  textQuestion?: TextQuestion;
  scaleQuestion?: ScaleQuestion;
  dateQuestion?: DateQuestion;
  timeQuestion?: TimeQuestion;
  fileUploadQuestion?: Record<string, unknown>;
  rowQuestion?: { title?: string };
}

export interface QuestionItem {
  question: FormQuestion;
  image?: {
    contentUri?: string;
    altText?: string;
  };
}

export interface QuestionGroupItem {
  questions: FormQuestion[];
  grid?: {
    columns: ChoiceQuestion;
    shuffleQuestions?: boolean;
  };
}

export interface FormItem {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: QuestionItem;
  questionGroupItem?: QuestionGroupItem;
  pageBreakItem?: Record<string, unknown>;
  textItem?: Record<string, unknown>;
  imageItem?: Record<string, unknown>;
  videoItem?: Record<string, unknown>;
}

export interface FormInfo {
  title: string;
  documentTitle?: string;
  description?: string;
}

export interface FormSettings {
  quizSettings?: {
    isQuiz?: boolean;
  };
  emailCollectionType?: 'DO_NOT_COLLECT' | 'VERIFIED' | 'RESPONDER_INPUT';
}

export interface GoogleForm {
  formId: string;
  info: FormInfo;
  settings?: FormSettings;
  revisionId?: string;
  responderUri?: string;
  linkedSheetId?: string;
  items?: FormItem[];
}

export interface DraftFormItem extends FormItem {
  _clientId: string;
}

export interface DraftForm {
  formId: string;
  info: FormInfo;
  settings: FormSettings;
  responderUri?: string;
  revisionId?: string;
  items: DraftFormItem[];
}

export interface TextAnswer {
  value: string;
}

export interface FileUploadAnswer {
  fileId: string;
  fileName: string;
  mimeType: string;
}

export interface Answer {
  questionId: string;
  grade?: {
    score?: number;
    correct?: boolean;
  };
  textAnswers?: {
    answers: TextAnswer[];
  };
  fileUploadAnswers?: {
    answers: FileUploadAnswer[];
  };
}

export interface FormResponse {
  formId: string;
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  respondentEmail?: string;
  totalScore?: number;
  answers?: Record<string, Answer>;
}

export interface LibraryFormEntry {
  formId: string;
  title: string;
  responderUri?: string;
  itemCount: number;
  lastOpenedAt: string;
}

export interface ChangeSummaryItem {
  kind: 'info' | 'settings' | 'create' | 'update' | 'delete' | 'reorder' | 'replace';
  label: string;
  detail?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  info: FormInfo;
  isQuiz?: boolean;
  items: Omit<FormItem, 'itemId'>[];
}
