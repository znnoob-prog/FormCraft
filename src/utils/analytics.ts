import { FormItem, FormResponse, GoogleForm } from '../types/forms';
import { getQuestionKind } from '../services/googleForms';

export interface OptionBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface VerbatimEntry {
  responseId: string;
  submittedAt: string;
  value: string;
}

export interface QuestionAnalytics {
  questionId: string;
  itemId?: string;
  title: string;
  kindLabel: string;
  type: 'choice' | 'scale' | 'text';
  answeredCount: number;
  responseRate: number;
  buckets?: OptionBucket[];
  scaleMean?: number;
  scaleLow?: number;
  scaleHigh?: number;
  verbatims?: VerbatimEntry[];
}

export function getResponseAnswerValues(
  response: FormResponse,
  questionId: string
): string[] {
  const ans = response.answers?.[questionId];
  if (!ans) return [];
  if (ans.textAnswers?.answers?.length) {
    return ans.textAnswers.answers
      .map((a) => a.value ?? '')
      .filter((v) => v !== '');
  }
  if (ans.fileUploadAnswers?.answers?.length) {
    return ans.fileUploadAnswers.answers.map((f) => f.fileName || f.fileId);
  }
  return [];
}

export function getFlattenQuestions(
  form: GoogleForm
): Array<{ questionId: string; title: string; item: FormItem }> {
  const list: Array<{ questionId: string; title: string; item: FormItem }> = [];
  for (const item of form.items ?? []) {
    if (item.questionItem?.question?.questionId) {
      list.push({
        questionId: item.questionItem.question.questionId,
        title: item.title || 'Untitled question',
        item,
      });
    } else if (item.questionGroupItem?.questions?.length) {
      for (const q of item.questionGroupItem.questions) {
        if (q.questionId) {
          list.push({
            questionId: q.questionId,
            title: `${item.title || 'Grid'} — ${q.rowQuestion?.title || 'Row'}`,
            item,
          });
        }
      }
    }
  }
  return list;
}

export function computeQuestionAnalytics(
  form: GoogleForm,
  responses: FormResponse[]
): QuestionAnalytics[] {
  const total = responses.length;
  const results: QuestionAnalytics[] = [];

  for (const item of form.items ?? []) {
    const q = item.questionItem?.question;
    if (!q?.questionId) continue;

    const questionId = q.questionId;
    const title = item.title || 'Untitled question';
    const kind = getQuestionKind(item);

    if (q.choiceQuestion) {
      const counts = new Map<string, number>();
      q.choiceQuestion.options.forEach((opt) => {
        if (opt.value) counts.set(opt.value, 0);
      });

      let answeredCount = 0;
      for (const r of responses) {
        const vals = getResponseAnswerValues(r, questionId);
        if (vals.length > 0) answeredCount += 1;
        for (const v of vals) {
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }

      const buckets: OptionBucket[] = Array.from(counts.entries()).map(
        ([label, count]) => ({
          label,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        })
      );

      results.push({
        questionId,
        itemId: item.itemId,
        title,
        kindLabel: kind.replace('_', ' ').toLowerCase(),
        type: 'choice',
        answeredCount,
        responseRate: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
        buckets,
      });
    } else if (q.scaleQuestion) {
      const low = q.scaleQuestion.low ?? 1;
      const high = q.scaleQuestion.high ?? 5;
      const counts = new Map<string, number>();
      for (let n = low; n <= high; n++) {
        counts.set(String(n), 0);
      }

      let answeredCount = 0;
      let sum = 0;
      for (const r of responses) {
        const vals = getResponseAnswerValues(r, questionId);
        if (vals.length > 0) {
          answeredCount += 1;
          const num = Number(vals[0]);
          if (!Number.isNaN(num)) sum += num;
          counts.set(vals[0], (counts.get(vals[0]) ?? 0) + 1);
        }
      }

      const buckets: OptionBucket[] = Array.from(counts.entries()).map(
        ([label, count]) => ({
          label,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        })
      );

      results.push({
        questionId,
        itemId: item.itemId,
        title,
        kindLabel: 'linear scale',
        type: 'scale',
        answeredCount,
        responseRate: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
        buckets,
        scaleLow: low,
        scaleHigh: high,
        scaleMean: answeredCount > 0 ? Math.round((sum / answeredCount) * 100) / 100 : undefined,
      });
    } else {
      const verbatims: VerbatimEntry[] = [];
      for (const r of responses) {
        const vals = getResponseAnswerValues(r, questionId);
        if (vals.length > 0) {
          verbatims.push({
            responseId: r.responseId,
            submittedAt: r.lastSubmittedTime || r.createTime,
            value: vals.join(', '),
          });
        }
      }

      results.push({
        questionId,
        itemId: item.itemId,
        title,
        kindLabel: kind.replace('_', ' ').toLowerCase(),
        type: 'text',
        answeredCount: verbatims.length,
        responseRate: total > 0 ? Math.round((verbatims.length / total) * 100) : 0,
        verbatims,
      });
    }
  }

  return results;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportResponsesToCsv(form: GoogleForm, responses: FormResponse[]): void {
  const questions = getFlattenQuestions(form);
  const headers = [
    'Response ID',
    'Submitted At',
    'Respondent Email',
    ...questions.map((q) => q.title),
  ];

  const rows = responses.map((res) => {
    const base = [
      res.responseId,
      res.lastSubmittedTime || res.createTime,
      res.respondentEmail ?? '',
    ];
    const answers = questions.map((q) =>
      getResponseAnswerValues(res, q.questionId).join('; ')
    );
    return [...base, ...answers].map(escapeCsvCell).join(',');
  });

  const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${slugify(form.info?.title || 'form')}-responses.csv`);
}

export function exportResponsesToJson(form: GoogleForm, responses: FormResponse[]): void {
  const payload = {
    formId: form.formId,
    title: form.info?.title,
    exportedAt: new Date().toISOString(),
    responseCount: responses.length,
    responses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerDownload(blob, `${slugify(form.info?.title || 'form')}-responses.json`);
}

function slugify(str: string): string {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'google-form'
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
