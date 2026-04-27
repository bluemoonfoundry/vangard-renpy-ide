import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import type { WarpVariableDraft } from '@/lib/warpAfterWarp';

interface WarpVariablesModalProps {
  isOpen: boolean;
  defaultVariables: WarpVariableDraft[];
  hasExistingAfterWarp: boolean;
  warpLabelName?: string;
  onClose: () => void;
  onConfirm: (variableDrafts: WarpVariableDraft[]) => void;
}

const WarpVariablesModal: React.FC<WarpVariablesModalProps> = ({
  isOpen,
  defaultVariables,
  hasExistingAfterWarp,
  warpLabelName,
  onClose,
  onConfirm,
}) => {
  const [drafts, setDrafts] = useState<WarpVariableDraft[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { modalProps, contentRef } = useModalAccessibility({ isOpen, onClose, titleId: 'warp-variables-title' });

  const defaultDrafts = useMemo(() => drafts.filter(draft => draft.source === 'default'), [drafts]);
  const interpolatedDrafts = useMemo(() => drafts.filter(draft => draft.source === 'interpolated'), [drafts]);
  const variableCount = useMemo(() => drafts.length, [drafts.length]);

  useEffect(() => {
    if (!isOpen) return;
    setDrafts(defaultVariables.map(variable => ({ ...variable })));
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [isOpen, defaultVariables]);

  if (!isOpen) return null;

  const updateDraft = (index: number, value: string) => {
    setDrafts(prev => prev.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, value } : draft
    )));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirm(drafts);
  };

  const renderDraftGroup = (title: string, helpText: string, groupDrafts: WarpVariableDraft[], groupKind: 'default' | 'interpolated') => {
    if (groupDrafts.length === 0) return null;

    return (
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{helpText}</p>
        </div>
        <div className="space-y-3">
          {groupDrafts.map((draft) => {
            const index = drafts.findIndex(entry => entry.name === draft.name);
            return (
              <div key={draft.name} className="grid gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-center">
                <div className="min-w-0">
                  <label className="block font-mono text-sm text-gray-300" htmlFor={`warp-var-${draft.name}`}>
                    {draft.name}
                  </label>
                  <span className="mt-1 inline-flex rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-400">
                    {groupKind}
                  </span>
                </div>
                <input
                  id={`warp-var-${draft.name}`}
                  ref={index === 0 ? firstInputRef : undefined}
                  type="text"
                  value={draft.value}
                  onChange={event => updateDraft(index, event.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      {...modalProps}
    >
      <div
        ref={contentRef}
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-100 shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="border-b border-gray-800 px-5 py-4">
          <h2 id="warp-variables-title" className="text-lg font-semibold">Warp Variables</h2>
          <p className="mt-1 text-sm text-gray-400">
            {warpLabelName ? `Edit any default values before warping to ${warpLabelName}. ` : 'Edit any default values you want applied for this warp launch. '}
            The IDE will write a temporary <code className="rounded bg-gray-800 px-1 py-0.5 font-mono text-xs">_ide_after_warp.rpy</code> and remove it when the game stops.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <main className="max-h-[68vh] overflow-y-auto px-5 py-4">
            {hasExistingAfterWarp && (
              <div className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                This project already defines <code className="font-mono text-xs">label after_warp</code>, so the temporary file will only carry the variable overrides.
              </div>
            )}

            {drafts.length > 0 ? (
              <div className="space-y-5">
                {renderDraftGroup(
                  'Default variables',
                  'These are existing game variables already tracked by the analyzer.',
                  defaultDrafts,
                  'default',
                )}
                {renderDraftGroup(
                  'Interpolated variables',
                  'These come from text like [mc_name] and are prefilled with default_<name>.',
                  interpolatedDrafts,
                  'interpolated',
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-950/30 px-4 py-6 text-sm text-gray-400">
                No default variables were found. RenIDE can still generate the temporary after_warp hook if needed.
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              {variableCount} variable{variableCount === 1 ? '' : 's'} available for temporary warp overrides.
            </div>
          </main>

          <footer className="flex items-center justify-end gap-3 border-t border-gray-800 bg-gray-950/70 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Warp Now
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default WarpVariablesModal;
