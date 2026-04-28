export interface RenpyLogicalLine {
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Checks if a character at a given index is escaped by backslashes.
 *
 * Counts consecutive backslashes immediately before the character. An odd number
 * of backslashes means the character is escaped, even means it's not.
 *
 * @param text - The text string to check
 * @param index - Index of the character to check
 * @returns True if the character is escaped (preceded by odd number of backslashes)
 *
 * @example
 * ```typescript
 * isEscaped('foo\\"bar', 4)  // → true  (quote is escaped)
 * isEscaped('foo\\\\"bar', 5) // → false (quote is not escaped)
 * ```
 *
 * @complexity O(n) worst case where n = number of consecutive backslashes before index
 */
function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
    backslashCount++;
  }
  return backslashCount % 2 === 1;
}

/**
 * Strips trailing comments from a line of Ren'Py code.
 *
 * Removes `#` and everything after it, but only if the `#` is not inside a string
 * literal. Uses a stateful scanner that tracks string boundaries with escape handling.
 * If the line contains triple-quoted strings, returns the line unchanged (triple-quoted
 * strings can contain `#` characters that are not comments).
 *
 * @param line - A single line of Ren'Py code
 * @returns The line with trailing comment removed (if any)
 *
 * @example
 * ```typescript
 * stripTrailingComment('label start:  # This is a comment')
 * // → 'label start:  '
 *
 * stripTrailingComment('$ name = "#ff0000"  # Color')
 * // → '$ name = "#ff0000"  '
 *
 * stripTrailingComment('""" # not a comment """')
 * // → '""" # not a comment """' (unchanged)
 * ```
 *
 * @complexity O(n) time where n = line length, O(1) space
 */
function stripTrailingComment(line: string): string {
  let inString: false | '"' | "'" = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextThree = line.slice(i, i + 3);

    if (!inString && (nextThree === '"""' || nextThree === "'''")) {
      return line;
    }

    if (inString) {
      if (char === inString && !isEscaped(line, i)) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === '#') {
      return line.slice(0, i);
    }
  }

  return line;
}

/**
 * Converts physical lines of Ren'Py code into logical lines.
 *
 * A logical line is a complete Ren'Py statement, which may span multiple physical lines
 * via:
 * - **Backslash continuation**: Line ends with `\`
 * - **Parenthesis/bracket/brace nesting**: Unclosed `()`, `[]`, or `{}`
 * - **Open string literals**: Unclosed `"` or `'` (not triple-quoted)
 *
 * The algorithm uses a state machine that tracks:
 * - `parenDepth`: Nesting level of brackets
 * - `inString`: Whether inside a string literal (and which quote type)
 *
 * Triple-quoted strings are skipped wholesale (not tracked as `inString`) since they
 * can contain arbitrary characters including newlines, quotes, and brackets.
 *
 * Comments are stripped before analysis to avoid false positives from `# (`, `# "`, etc.
 *
 * @param code - Multi-line Ren'Py code string
 * @returns Array of logical lines with start/end line numbers (1-indexed)
 *
 * @example
 * ```typescript
 * const code = `
 * label start:
 *     $ x = (1 +
 *            2)
 *     return
 * `;
 * const logical = getLogicalLines(code);
 * // [
 * //   { text: 'label start:', startLine: 2, endLine: 2 },
 * //   { text: '    $ x = (1 +\n           2)', startLine: 3, endLine: 4 },
 * //   { text: '    return', startLine: 5, endLine: 5 }
 * // ]
 * ```
 *
 * @complexity O(n) time where n = total code length, O(n) space
 */
export function getLogicalLines(code: string): RenpyLogicalLine[] {
  const physicalLines = code.split('\n');
  const logicalLines: RenpyLogicalLine[] = [];

  let currentText = '';
  let startLine = 1;
  let parenDepth = 0;
  let inString: false | '"' | "'" = false;

  physicalLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const commentFreeLine = stripTrailingComment(line);

    if (!currentText) {
      startLine = lineNumber;
      currentText = line;
    } else {
      currentText += `\n${line}`;
    }

    for (let i = 0; i < commentFreeLine.length; i++) {
      const char = commentFreeLine[i];
      const nextThree = commentFreeLine.slice(i, i + 3);

      if (nextThree === '"""' || nextThree === "'''") {
        i += 2;
        continue;
      }

      if (inString) {
        if (char === inString && !isEscaped(commentFreeLine, i)) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = char;
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        parenDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        parenDepth = Math.max(0, parenDepth - 1);
      }
    }

    const endsWithBackslash = /\\\s*$/.test(commentFreeLine);
    const continues = inString || parenDepth > 0 || endsWithBackslash;

    if (!continues) {
      logicalLines.push({
        text: currentText,
        startLine,
        endLine: lineNumber,
      });
      currentText = '';
    }
  });

  if (currentText) {
    logicalLines.push({
      text: currentText,
      startLine,
      endLine: physicalLines.length,
    });
  }

  return logicalLines;
}
