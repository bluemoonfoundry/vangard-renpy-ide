/**
 * Computes a boolean mask indicating which lines are inside triple-quoted string literals.
 *
 * Scans code character-by-character to detect triple-quoted string boundaries (`"""` or `'''`).
 * Lines inside triple-quoted strings are marked `true` in the mask, including the opening
 * and closing lines. This mask is used by other parsers to skip analysis of triple-quoted
 * content, which can contain arbitrary text including syntax that would otherwise trigger
 * false positives (e.g., `label`, `jump`, unbalanced brackets).
 *
 * The algorithm uses a state machine:
 * - `inTripleQuoteBlock`: Whether currently inside a triple-quoted string
 * - `tripleQuoteSeq`: Which quote sequence opened the current block (`"""` or `'''`)
 * - `lineIndex`: Current line number (0-indexed)
 *
 * When a triple-quote sequence is encountered:
 * - If outside a block: opens a new block, marks line as true
 * - If inside a block with matching sequence: closes the block
 * - Mismatched sequences inside a block are ignored (e.g., `"""` inside a `'''` block)
 *
 * @param content - Multi-line Ren'Py code
 * @returns Boolean array where `result[i]` is true if line i is inside a triple-quoted string
 *
 * @example
 * ```typescript
 * const code = `
 * label start:
 *     """
 *     This is a docstring
 *     with multiple lines
 *     """
 *     return
 * `;
 * const mask = getTripleQuotedLineMask(code);
 * // [false, false, true, true, true, true, false, false]
 * ```
 *
 * @complexity O(n) time where n = total content length, O(m) space where m = number of lines
 */
export function getTripleQuotedLineMask(content: string): boolean[] {
  const lines = content.split('\n');
  const mask = new Array<boolean>(lines.length).fill(false);

  let inTripleQuoteBlock = false;
  let tripleQuoteSeq: '"""' | "'''" = '"""';
  let lineIndex = 0;

  for (let i = 0; i < content.length; i++) {
    const nextThree = content.slice(i, i + 3);
    if (inTripleQuoteBlock) {
      mask[lineIndex] = true;
      if (nextThree === tripleQuoteSeq) {
        inTripleQuoteBlock = false;
        i += 2;
        continue;
      }
      if (content[i] === '\n') {
        lineIndex++;
      }
      continue;
    }

    if (nextThree === '"""' || nextThree === "'''") {
      mask[lineIndex] = true;
      inTripleQuoteBlock = true;
      tripleQuoteSeq = nextThree as '"""' | "'''";
      i += 2;
      continue;
    }

    if (content[i] === '\n') {
      lineIndex++;
    }
  }

  return mask;
}
