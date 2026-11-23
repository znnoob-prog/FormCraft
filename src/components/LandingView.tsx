import React from 'react';
import { ArrowRight, BarChart3, Eye, Layers, Table2 } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';

interface LandingViewProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  authError: string | null;
  needsReconnect?: boolean;
  userEmail?: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  isSigningIn,
  authError,
  needsReconnect = false,
  userEmail,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            FormCraft
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#builder"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Split Editor
            </a>
            <a
              href="#analytics"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Response Analytics
            </a>
            <a
              href="#templates"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Templates
            </a>
          </nav>

          <div className="shrink-0">
            <GoogleSignInButton
              onClick={onSignIn}
              disabled={isSigningIn}
              label={isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            />
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split */}
        <section className="max-w-[1360px] mx-auto px-6 lg:px-10 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <p className="text-sm font-medium text-blue-600 mb-3">
                Google Forms Studio
              </p>
              <h1 className="text-4xl lg:text-[2.85rem] font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance] font-display">
                A calmer, faster workspace for Google Forms.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                Design structured questions in a split outline-and-inspector canvas, review every batch change before it publishes, and cross-filter live responses without leaving one workspace.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <GoogleSignInButton
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  label={
                    isSigningIn
                      ? 'Connecting...'
                      : needsReconnect
                      ? 'Reconnect Google Forms'
                      : 'Sign in with Google'
                  }
                />
                {needsReconnect && userEmail && (
                  <span className="text-sm text-slate-500">
                    Session refresh required for {userEmail}
                  </span>
                )}
              </div>

              {authError && (
                <div
                  role="alert"
                  className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
                >
                  {authError}
                </div>
              )}

              <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900 font-display">
                    Outline Editor
                  </div>
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Reorder, duplicate, and edit questions without scroll fatigue.
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 font-display">
                    Reviewed Saves
                  </div>
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Inspect a clear diff summary before updating your live form.
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 font-display">
                    Cross-Filtering
                  </div>
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Click chart bars to filter respondent rows and export CSV.
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Architectural Workspace Preview */}
            <div className="lg:col-span-7 flex">
              <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="h-11 px-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
                  <div className="text-xs font-medium text-slate-600 truncate">
                    Forms / Product Experience Feedback
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 shrink-0">
                    <span className="text-blue-600">Editor</span>
                    <span>Preview</span>
                    <span>Responses</span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 min-h-[380px]">
                  {/* Outline Column */}
                  <div className="sm:col-span-5 p-4 bg-slate-50/40 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 pb-1">
                      Form outline · 4 items
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-blue-600 ring-2 ring-blue-600/10">
                      <div className="text-xs font-medium text-blue-700">
                        01 · Linear scale · Required
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        How satisfied are you with the product overall?
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-xs text-slate-500">
                        02 · Multiple choice · Required
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        Which area brings you the most value?
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-xs text-slate-500">03 · Paragraph</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        What friction point should we fix next?
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-xs text-slate-500">04 · Date</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        Preferred follow-up window
                      </div>
                    </div>
                  </div>

                  {/* Inspector + Distribution Preview */}
                  <div className="sm:col-span-7 p-5 flex flex-col justify-between bg-white">
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <span className="text-sm font-semibold text-slate-900 font-display">
                          Question Inspector
                        </span>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          Scale 1–5
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Prompt</div>
                          <div className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-slate-50/50">
                            How satisfied are you with the product overall?
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Low label (1)</div>
                            <div className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                              Not satisfied
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">High label (5)</div>
                            <div className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                              Very satisfied
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Live response distribution sample</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          Mean 4.32
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { score: '5', pct: 54 },
                          { score: '4', pct: 29 },
                          { score: '3', pct: 12 },
                          { score: '2', pct: 5 },
                        ].map((row) => (
                          <div key={row.score} className="flex items-center gap-2.5 text-xs">
                            <span className="w-3 font-mono text-slate-500 tabular-nums">
                              {row.score}
                            </span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-sm"
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                            <span className="w-9 text-right font-mono text-slate-600 tabular-nums">
                              {row.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capability Sections */}
        <section className="border-t border-slate-200 bg-white py-14">
          <div className="max-w-[1360px] mx-auto px-6 lg:px-10 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div id="builder">
              <Layers className="w-5 h-5 text-blue-600 mb-3" />
              <h2 className="text-base font-semibold text-slate-900 font-display">
                01. Structured Split Builder
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Navigate long surveys from a fixed outline rail while editing options, validation, and quiz points side-by-side.
              </p>
            </div>
            <div>
              <Eye className="w-5 h-5 text-blue-600 mb-3" />
              <h2 className="text-base font-semibold text-slate-900 font-display">
                02. Dry-Run Preview
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Test required fields and section flow across desktop and mobile viewports before sharing the live link.
              </p>
            </div>
            <div id="analytics">
              <BarChart3 className="w-5 h-5 text-blue-600 mb-3" />
              <h2 className="text-base font-semibold text-slate-900 font-display">
                03. Interactive Breakdowns
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Inspect choice percentages, linear scale means, and searchable verbatim answers in one clean grid.
              </p>
            </div>
            <div id="templates">
              <Table2 className="w-5 h-5 text-blue-600 mb-3" />
              <h2 className="text-base font-semibold text-slate-900 font-display">
                04. Table & CSV Export
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Drill into individual submissions in a slide-over drawer and export clean CSV or JSON datasets anytime.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-5">
        <div className="max-w-[1360px] mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>FormCraft — Connected directly to your Google Forms account</span>
          <button
            type="button"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Connect Google Forms
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
