export interface RenpyLogicalLine {
  text: string;
  startLine: number;
  endLine: number;
}

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
    backslashCount++;
  }
  return backslashCount % 2 === 1;
}

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
