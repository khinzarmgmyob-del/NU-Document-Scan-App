import React from 'react';
import { Table, Check } from 'lucide-react';
import { DocumentSectionBlock } from '../types';

interface AutoFramedDocumentViewProps {
  title?: string;
  subtitle?: string;
  sections: DocumentSectionBlock[];
  tableData?: string[][];
}

export const AutoFramedDocumentView: React.FC<AutoFramedDocumentViewProps> = ({
  title,
  subtitle,
  sections,
  tableData,
}) => {
  return (
    <div className="bg-[#F8FAFC] dark:bg-dark-bg rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden shadow-sm font-sans">
      {/* 1. TOP HEADER BANNER (100% Raw Photo Matching: Deep Navy #0B2A59) */}
      {(title || subtitle) && (
        <div className="bg-[#0B2A59] px-6 py-5 text-center text-white border-b border-blue-900">
          {title && (
            <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-blue-200/90 mt-1 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* 2. DOCUMENT CONTENT AREA */}
      <div className="p-4 sm:p-6 space-y-4">
        {sections.map((section, sIdx) => {
          // Check if section is a standalone bottom text callout (e.g. "ရေရှည် ကာကွယ်ပေးနိုင်မည့် RDPNight Solution")
          if (
            section.title &&
            (section.title.includes('RDPNight') || section.title.includes('ရေရှည်') || section.title.includes('Solution')) &&
            (!section.items || section.items.length === 0) &&
            !section.content
          ) {
            return (
              <div key={sIdx} className="pt-2">
                <h4 className="text-sm sm:text-base font-bold text-[#1E3A8A] dark:text-blue-400">
                  {section.title}
                </h4>
              </div>
            );
          }

          // Table Section
          if (section.type === 'table' && section.table && section.table.length > 0) {
            return (
              <div
                key={sIdx}
                className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card overflow-hidden shadow-2xs"
              >
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border flex items-center gap-2">
                  <Table className="w-4 h-4 text-[#0B2A59] dark:text-blue-400" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                    {section.title || 'Structured Table Matrix'}
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {section.table.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0
                              ? 'bg-[#0B2A59] text-white font-semibold'
                              : rIdx % 2 === 1
                              ? 'bg-slate-50 dark:bg-dark-surface/50 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-dark-border'
                              : 'bg-white dark:bg-dark-card text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-dark-border'
                          }
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 border-r border-slate-200/50 dark:border-dark-border last:border-r-0">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          // Determine Theme & Accent
          const isDanger = section.type === 'danger_box' || section.colorTheme === 'red';
          const isWarning = section.type === 'warning_box' || section.colorTheme === 'yellow' || section.colorTheme === 'amber';
          const isOption = section.title && (section.title.includes('ရွေးချယ်စရာ') || section.title.includes('Option'));

          let titleColor = 'text-[#1E3A8A] dark:text-blue-400';
          let accentBar = <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />;

          if (isDanger) {
            titleColor = 'text-[#991B1B] dark:text-red-400';
            accentBar = <div className="w-1 h-4 bg-red-600 rounded-full shrink-0" />;
          } else if (isWarning || isOption) {
            titleColor = 'text-slate-900 dark:text-white';
            accentBar = null;
          }

          return (
            <div
              key={sIdx}
              className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-4 sm:p-5 shadow-2xs space-y-3"
            >
              {/* Card Title */}
              {section.title && (
                <div className="flex items-center gap-2">
                  {accentBar}
                  <h4 className={`text-xs sm:text-sm font-bold tracking-tight ${titleColor}`}>
                    {section.title}
                  </h4>
                </div>
              )}

              {/* Bullet Items with Green Checkmark ✔ */}
              {section.items && section.items.length > 0 && (
                <div className="space-y-2.5">
                  {section.items.map((item, iIdx) => {
                    let titleText = item.text;
                    let descText = item.subtext || '';

                    if (!descText) {
                      if (titleText.includes('–')) {
                        const parts = titleText.split('–');
                        titleText = parts[0].trim();
                        descText = parts.slice(1).join('–').trim();
                      } else if (titleText.includes(': ')) {
                        const parts = titleText.split(': ');
                        titleText = parts[0].trim();
                        descText = parts.slice(1).join(': ').trim();
                      }
                    }

                    return (
                      <div key={iIdx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <div className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {titleText}
                          </span>
                          {descText && (
                            <div className="text-slate-600 dark:text-slate-400 text-xs sm:text-xs mt-0.5 leading-relaxed">
                              - {descText}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Yellow Note / Warning Callout Box */}
              {section.content && (
                <div className="p-2.5 sm:p-3 rounded-md bg-[#FEF9C3] dark:bg-amber-950/40 border border-[#FDE047] dark:border-amber-800/80 text-[#854D0E] dark:text-amber-200 text-xs leading-relaxed font-medium">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}

        {/* Fallback Standalone Table if present and not in sections */}
        {(!sections || !sections.some(s => s.type === 'table')) && tableData && tableData.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-dark-surface border-b border-slate-200 dark:border-dark-border flex items-center gap-2">
              <Table className="w-4 h-4 text-[#0B2A59] dark:text-blue-400" />
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                Structured Table Matrix
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <tbody>
                  {tableData.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx === 0
                          ? 'bg-[#0B2A59] text-white font-semibold'
                          : rIdx % 2 === 1
                          ? 'bg-slate-50 dark:bg-dark-surface/50 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-dark-border'
                          : 'bg-white dark:bg-dark-card text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-dark-border'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 border-r border-slate-200/50 dark:border-dark-border last:border-r-0">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
