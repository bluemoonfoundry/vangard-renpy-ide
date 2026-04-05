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
