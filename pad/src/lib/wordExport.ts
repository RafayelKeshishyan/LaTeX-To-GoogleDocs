import {
  AlignmentType,
  Document as WordDocument,
  HeadingLevel,
  Math as WordMath,
  MathCurlyBrackets,
  MathFraction,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  MathSubScript,
  MathSubSuperScript,
  MathSuperScript,
  Packer,
  Paragraph,
  TextRun,
  type MathComponent,
} from 'docx';
import type { Block, PadSheet } from './document';
import { blockListName } from './document';
import { latexToMathML } from './mathml';

function childElements(element: Element): Element[] {
  return Array.from(element.children);
}

function mathChildren(element: Element): MathComponent[] {
  return Array.from(element.childNodes).flatMap((node) => {
    if (node.nodeType === 3) {
      const text = node.textContent || '';
      return text.trim() ? [new MathRun(text)] : [];
    }
    return node instanceof Element ? mathElement(node) : [];
  });
}

function componentChildren(element: Element | undefined): MathComponent[] {
  return element ? mathElement(element) : [];
}

function mathElement(element: Element): MathComponent[] {
  const children = childElements(element);
  switch (element.localName) {
    case 'annotation':
    case 'annotation-xml':
    case 'none':
      return [];
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'mphantom':
    case 'menclose':
    case 'merror':
      return mathChildren(element);
    case 'semantics':
      return children[0] ? mathElement(children[0]) : [];
    case 'mi':
    case 'mn':
    case 'mo':
    case 'mtext':
    case 'ms':
      return [new MathRun(element.textContent || '')];
    case 'mspace':
      return [new MathRun(' ')];
    case 'mfrac':
      return [
        new MathFraction({
          numerator: componentChildren(children[0]),
          denominator: componentChildren(children[1]),
        }),
      ];
    case 'msqrt':
      return [new MathRadical({ children: mathChildren(element) })];
    case 'mroot':
      return [
        new MathRadical({
          children: componentChildren(children[0]),
          degree: componentChildren(children[1]),
        }),
      ];
    case 'msup':
      return [
        new MathSuperScript({
          children: componentChildren(children[0]),
          superScript: componentChildren(children[1]),
        }),
      ];
    case 'msub':
      return [
        new MathSubScript({
          children: componentChildren(children[0]),
          subScript: componentChildren(children[1]),
        }),
      ];
    case 'msubsup':
      return [
        new MathSubSuperScript({
          children: componentChildren(children[0]),
          subScript: componentChildren(children[1]),
          superScript: componentChildren(children[2]),
        }),
      ];
    case 'mover':
      return [
        new MathSuperScript({
          children: componentChildren(children[0]),
          superScript: componentChildren(children[1]),
        }),
      ];
    case 'munder':
      return [
        new MathSubScript({
          children: componentChildren(children[0]),
          subScript: componentChildren(children[1]),
        }),
      ];
    case 'munderover':
      return [
        new MathSubSuperScript({
          children: componentChildren(children[0]),
          subScript: componentChildren(children[1]),
          superScript: componentChildren(children[2]),
        }),
      ];
    case 'mfenced': {
      const options = { children: mathChildren(element) };
      const open = element.getAttribute('open') || '(';
      const close = element.getAttribute('close') || ')';
      if (open === '[' && close === ']') return [new MathSquareBrackets(options)];
      if (open === '{' && close === '}') return [new MathCurlyBrackets(options)];
      if (open === '(' && close === ')') return [new MathRoundBrackets(options)];
      return [new MathRun(open), ...options.children, new MathRun(close)];
    }
    case 'mtable':
      return children.flatMap((row, index) => [
        ...(index ? [new MathRun('; ')] : []),
        ...mathElement(row),
      ]);
    case 'mtr':
    case 'mlabeledtr':
      return children.flatMap((cell, index) => [
        ...(index ? [new MathRun(', ')] : []),
        ...mathElement(cell),
      ]);
    case 'mtd':
      return mathChildren(element);
    default:
      return mathChildren(element);
  }
}

function latexToWordMath(latex: string): WordMath {
  const mathml = latexToMathML(latex);
  if (!mathml) return new WordMath({ children: [new MathRun(latex)] });

  const parsed = new DOMParser().parseFromString(mathml, 'application/xml');
  if (parsed.querySelector('parsererror')) {
    return new WordMath({ children: [new MathRun(latex)] });
  }

  const children = mathElement(parsed.documentElement);
  return new WordMath({ children: children.length ? children : [new MathRun(latex)] });
}

function proseParagraphs(block: Extract<Block, { type: 'prose' }>): Paragraph[] {
  const lines = block.text.split(/\r?\n/);
  return (lines.length ? lines : ['']).map(
    (line) => new Paragraph({ children: [new TextRun(line || ' ')] }),
  );
}

export async function createWordDocumentBlob(sheet: PadSheet): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: sheet.title, heading: HeadingLevel.HEADING_1 }),
  ];

  for (const block of sheet.blocks) {
    const heading = blockListName(sheet.blocks, block.id);
    if (block.type === 'prose') {
      children.push(
        new Paragraph({
          text: heading,
          heading: HeadingLevel.HEADING_2,
        }),
      );
      children.push(...proseParagraphs(block));
      continue;
    }

    children.push(
      new Paragraph({
        text: heading,
        heading: HeadingLevel.HEADING_2,
      }),
    );
    children.push(
      block.latex.trim()
        ? new Paragraph({
            children: [latexToWordMath(block.latex)],
            alignment: AlignmentType.CENTER,
          })
        : new Paragraph({ children: [new TextRun('(No answer)')] }),
    );
  }

  const document = new WordDocument({
    creator: 'EquaNote',
    title: sheet.title,
    description: 'Math work exported from EquaNote with editable Office Math equations.',
    sections: [{ children }],
  });

  return Packer.toBlob(document);
}

export function downloadWordBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
