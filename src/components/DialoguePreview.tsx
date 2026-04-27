/**
 * @file DialoguePreview.tsx
 * @description Inline "Player View" panel for the code editor.
 * Shows a mock Ren'Py textbox for dialogue lines or a choice screen for menu blocks,
 * updating in real-time as the cursor moves through the file.
 */

import React from 'react';

// --- Types ---

interface DialogueData {
  kind: 'dialogue';
  charName: string | null;
  charColor: string | null;
  text: string;
  whoPrefix?: string;
  whoSuffix?: string;
  whatPrefix?: string;
  whatSuffix?: string;
}

export interface MenuChoice {
  text: string;
  condition?: string;
  destination?: string;
}

interface MenuData {
  kind: 'menu';
  prompt?: string;
  choices: MenuChoice[];
}

export type DialoguePreviewData = DialogueData | MenuData;

interface DialoguePreviewProps {
  data: DialoguePreviewData | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// --- Text tag renderer ---

/** Parse Ren'Py text tags and variable interpolations into styled React nodes. */
function renderRenpyText(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  const tagRe = /\{([^}]*)\}|\[([^\]]*)\]/g;

  let pos = 0;
  let key = 0;
  let bold = false;
  let italic = false;
  let underline = false;
  let strike = false;
  let color: string | undefined;

  const push = (str: string) => {
    if (!str) return;
    const style: React.CSSProperties = {};
    if (bold) style.fontWeight = 'bold';
    if (italic) style.fontStyle = 'italic';
    if (underline && strike) style.textDecoration = 'underline line-through';
    else if (underline) style.textDecoration = 'underline';
    else if (strike) style.textDecoration = 'line-through';
    if (color) style.color = color;

    if (Object.keys(style).length > 0) {
      segments.push(<span key={key++} style={style}>{str}</span>);
    } else {
      segments.push(<React.Fragment key={key++}>{str}</React.Fragment>);
    }
  };

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(text)) !== null) {
    push(text.slice(pos, match.index));
    pos = match.index + match[0].length;

    if (match[2] !== undefined) {
      segments.push(
        <span key={key++} className="opacity-50 italic">[{match[2]}]</span>
      );
    } else {
      const tag = match[1];
      if (tag === 'b') bold = true;
      else if (tag === '/b') bold = false;
      else if (tag === 'i') italic = true;
      else if (tag === '/i') italic = false;
      else if (tag === 'u') underline = true;
      else if (tag === '/u') underline = false;
      else if (tag === 's') strike = true;
      else if (tag === '/s') strike = false;
      else if (tag === '/color') color = undefined;
      else if (tag === '/size') { /* no-op */ }
      else {
        const colorMatch = tag.match(/^color=(#[0-9a-fA-F]{3,8}|[a-z]+)$/i);
        if (colorMatch) color = colorMatch[1];
      }
    }
  }

  push(text.slice(pos));
  return <>{segments}</>;
}

// --- Sub-renderers ---

const DialogueBox: React.FC<{ data: DialogueData }> = ({ data }) => (
  <div
    className="rounded"
    style={{
      background: 'rgba(0,0,0,0.82)',
      border: '1px solid rgba(255,255,255,0.12)',
      padding: '10px 14px',
    }}
  >
    {data.charName && (
      <div className="mb-1.5">
        <span
          className="inline-block text-xs font-bold px-2 py-0.5 rounded"
          style={{
            background: data.charColor ? `${data.charColor}33` : 'rgba(255,255,255,0.12)',
            color: data.charColor ?? '#ffffff',
            border: `1px solid ${data.charColor ?? 'rgba(255,255,255,0.25)'}55`,
          }}
        >
          {data.whoPrefix}{data.charName}{data.whoSuffix}
        </span>
      </div>
    )}
    <p className="text-sm leading-relaxed" style={{ color: '#f0f0f0', fontFamily: 'serif' }}>
      {data.whatPrefix && <span className="opacity-60">{data.whatPrefix}</span>}
      {renderRenpyText(data.text)}
      {data.whatSuffix && <span className="opacity-60">{data.whatSuffix}</span>}
    </p>
  </div>
);

const ChoiceScreen: React.FC<{ data: MenuData }> = ({ data }) => (
  <div
    className="rounded"
    style={{
      background: 'rgba(0,0,0,0.82)',
      border: '1px solid rgba(255,255,255,0.12)',
      padding: '10px 14px',
    }}
  >
    {data.prompt && (
      <p className="text-sm mb-2" style={{ color: '#d0d0d0', fontFamily: 'serif' }}>
        {renderRenpyText(data.prompt)}
      </p>
    )}
    <div className="space-y-1">
      {data.choices.map((choice, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex-1 px-3 py-1 rounded text-sm"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#f0f0f0',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            {renderRenpyText(choice.text)}
            {choice.condition && (
              <span className="ml-2 font-mono opacity-40" style={{ fontSize: '10px' }}>
                if {choice.condition}
              </span>
            )}
          </div>
          {choice.destination && (
            <span className="text-xs opacity-50 whitespace-nowrap" style={{ color: '#818cf8' }}>
              → {choice.destination}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);

// --- Main component ---

const DialoguePreview: React.FC<DialoguePreviewProps> = ({ data, isExpanded, onToggleExpand }) => {
  const label = data?.kind === 'menu' ? 'Choice Preview' : 'Dialogue Preview';

  return (
    <div className="flex-none border-t border-gray-700 bg-gray-900 select-none">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        aria-label={isExpanded ? 'Collapse player view' : 'Expand player view'}
      >
        <span className="font-medium tracking-wide uppercase" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          {data ? (
            data.kind === 'dialogue'
              ? <DialogueBox data={data} />
              : <ChoiceScreen data={data} />
          ) : (
            <p className="text-xs text-gray-600 italic py-1">No dialogue or menu at cursor</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DialoguePreview;
