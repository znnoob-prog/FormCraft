import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { FormResponse, GoogleForm } from '../types/forms';
import {
  computeQuestionAnalytics,
  exportResponsesToCsv,
  exportResponsesToJson,
  getFlattenQuestions,
  getResponseAnswerValues,
} from '../utils/analytics';

interface ResponsesAnalyticsProps {
  form: GoogleForm;
  responses: FormResponse[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

interface ActiveFilter {
  questionId: string;
  questionTitle: string;
  value: string;
}

export const ResponsesAnalytics: React.FC<ResponsesAnalyticsProps> = ({
  form,
  responses,
  isLoading,
  error,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const flatQuestions = useMemo(() => getFlattenQuestions(form), [form]);

  const filteredResponses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return responses.filter((res) => {
      if (activeFilter) {
        const vals = getResponseAnswerValues(res, activeFilter.questionId);
        if (!vals.includes(activeFilter.value)) return false;
      }
      if (!query) return true;
      if (res.responseId.toLowerCase().includes(query)) return true;
      if (res.respondentEmail?.toLowerCase().includes(query)) return true;
      for (const q of flatQuestions) {
        const vals = getResponseAnswerValues(res, q.questionId);
        if (vals.some((v) => v.toLowerCase().includes(query))) return true;
      }
      return false;
    });
  }, [responses, activeFilter, searchQuery, flatQuestions]);

  const analytics = useMemo(
    () => computeQuestionAnalytics(form, filteredResponses),
    [form, filteredResponses]
  );

  const avgCompletionPct = useMemo(() => {
    if (responses.length === 0 || flatQuestions.length === 0) return 0;
    let totalAnswered = 0;
    for (const r of responses) {
      for (const q of flatQuestions) {
        if (getResponseAnswerValues(r, q.questionId).length > 0) {
          totalAnswered += 1;
        }
      }
    }
    return Math.round((totalAnswered / (responses.length * flatQuestions.length)) * 100);
  }, [responses, flatQuestions]);

  const latestSubmission = useMemo(() => {
    if (responses.length === 0) return '—';
    const dt = new Date(responses[0].lastSubmittedTime || responses[0].createTime);
    return dt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [responses]);

  const selectedIndex = useMemo(
    () => filteredResponses.findIndex((r) => r.responseId === selectedResponseId),
    [filteredResponses, selectedResponseId]
  );
  const selectedResponse = selectedIndex >= 0 ? filteredResponses[selectedIndex] : null;

  const handleCopyResponderLink = async () => {
    if (!form.responderUri) return;
    await navigator.clipboard.writeText(form.responderUri);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  if (isLoading && responses.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              className="h-24 bg-white border border-slate-200 rounded-xl p-4 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 space-y-3">
        <p className="text-sm font-semibold text-red-700">
          Unable to load responses from Google Forms
        </p>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-6">
        <h3 className="text-base font-semibold text-slate-900 font-display">
          No responses submitted yet
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Share your live Google Form link with respondents. Once submissions arrive, question distributions, cross-filtering, and CSV exports will appear here.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {form.responderUri && (
            <button
              type="button"
              onClick={handleCopyResponderLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied responder link' : 'Copy responder link'}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Check for responses
          </button>
        </div>
      </div>
    );
  }

  const previewColumns = flatQuestions.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Total responses</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {responses.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Questions tracked</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {flatQuestions.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Avg. item completion</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {avgCompletionPct}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Latest submission</div>
          <div className="mt-1.5 text-base font-semibold text-slate-900 font-mono tabular-nums truncate">
            {latestSubmission}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search answers, email, or response ID"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          {activeFilter && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-lg">
              <span className="truncate max-w-[260px]">
                Filtered: <strong>{activeFilter.value}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveFilter(null)}
                className="text-blue-700 hover:text-blue-950"
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => exportResponsesToCsv(form, filteredResponses)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportResponsesToJson(form, filteredResponses)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Question Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analytics.map((qa) => (
          <div
            key={qa.questionId}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 font-display leading-snug">
                  {qa.title}
                </h3>
                {qa.scaleMean !== undefined && (
                  <span className="text-xs font-mono font-semibold text-blue-700 tabular-nums shrink-0">
                    Mean {qa.scaleMean}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {qa.answeredCount} answered ({qa.responseRate}%) · {qa.kindLabel}
              </p>

              {(qa.type === 'choice' || qa.type === 'scale') && qa.buckets && (
                <div className="mt-4 space-y-2">
                  {qa.buckets.map((bucket) => {
                    const isActive =
                      activeFilter?.questionId === qa.questionId &&
                      activeFilter.value === bucket.label;
                    return (
                      <button
                        key={bucket.label}
                        type="button"
                        onClick={() =>
                          setActiveFilter(
                            isActive
                              ? null
                              : {
                                  questionId: qa.questionId,
                                  questionTitle: qa.title,
                                  value: bucket.label,
                                }
                          )
                        }
                        className={`w-full text-left group rounded-lg p-1.5 -mx-1.5 transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        title="Click to cross-filter responses by this answer"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs mb-1">
                          <span className="font-medium text-slate-800 truncate">
                            {bucket.label}
                          </span>
                          <span className="font-mono text-slate-600 tabular-nums shrink-0">
                            {bucket.count} ({bucket.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-all ${
                              isActive ? 'bg-blue-700' : 'bg-blue-600 group-hover:bg-blue-700'
                            }`}
                            style={{ width: `${bucket.percentage}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {qa.type === 'text' && qa.verbatims && (
                <div className="mt-4 max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {qa.verbatims.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400">No text responses yet.</p>
                  ) : (
                    qa.verbatims.slice(0, 12).map((entry) => (
                      <button
                        key={entry.responseId}
                        type="button"
                        onClick={() => setSelectedResponseId(entry.responseId)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors block"
                      >
                        {entry.value}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* High-Density Responses Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 font-display">
            Individual submissions
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Showing {filteredResponses.length} of {responses.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4 whitespace-nowrap">Submitted</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Respondent</th>
                {previewColumns.map((col) => (
                  <th
                    key={col.questionId}
                    className="py-2.5 px-4 max-w-[220px] truncate"
                  >
                    {col.title}
                  </th>
                ))}
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredResponses.map((res) => {
                const dt = new Date(res.lastSubmittedTime || res.createTime);
                return (
                  <tr
                    key={res.responseId}
                    onClick={() => setSelectedResponseId(res.responseId)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {dt.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {dt.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {res.respondentEmail || (
                        <span className="font-mono text-slate-400">
                          {res.responseId.slice(0, 10)}
                        </span>
                      )}
                    </td>
                    {previewColumns.map((col) => {
                      const vals = getResponseAnswerValues(res, col.questionId);
                      return (
                        <td
                          key={col.questionId}
                          className="py-2.5 px-4 text-slate-800 max-w-[220px] truncate"
                        >
                          {vals.length > 0 ? vals.join(', ') : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-right font-medium text-blue-600 whitespace-nowrap">
                      View
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Respondent Slide-Over Drawer */}
      {selectedResponse && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
          onClick={() => setSelectedResponseId(null)}
        >
          <div
            className="w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 font-display truncate">
                  {selectedResponse.respondentEmail || 'Anonymous Respondent'}
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                  {new Date(
                    selectedResponse.lastSubmittedTime || selectedResponse.createTime
                  ).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={selectedIndex <= 0}
                  onClick={() =>
                    setSelectedResponseId(filteredResponses[selectedIndex - 1].responseId)
                  }
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Previous submission"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={selectedIndex >= filteredResponses.length - 1}
                  onClick={() =>
                    setSelectedResponseId(filteredResponses[selectedIndex + 1].responseId)
                  }
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Next submission"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedResponseId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-1"
                  aria-label="Close submission detail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100">
              {flatQuestions.map((q) => {
                const vals = getResponseAnswerValues(selectedResponse, q.questionId);
                return (
                  <div key={q.questionId} className="py-3.5 first:pt-0">
                    <div className="text-xs font-medium text-slate-500">{q.title}</div>
                    <div className="mt-1 text-sm text-slate-900 leading-relaxed">
                      {vals.length > 0 ? vals.join(', ') : <span className="text-slate-400">No answer</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
