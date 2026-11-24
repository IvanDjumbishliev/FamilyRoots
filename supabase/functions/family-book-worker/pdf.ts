import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'npm:pdf-lib@1.17.1';

import type { BookMedia, BookSettings, Section } from './book.ts';

const paper = { width: 595, height: 842, margin: 56 };
const colors = {
  forest: {
    accent: rgb(0.09, 0.24, 0.2),
    paper: rgb(0.98, 0.97, 0.94),
    soft: rgb(0.76, 0.64, 0.42),
  },
  ink: {
    accent: rgb(0.11, 0.18, 0.29),
    paper: rgb(0.96, 0.97, 0.99),
    soft: rgb(0.55, 0.64, 0.77),
  },
  sepia: {
    accent: rgb(0.31, 0.19, 0.12),
    paper: rgb(0.98, 0.95, 0.89),
    soft: rgb(0.68, 0.47, 0.31),
  },
};
const bodyColor = rgb(0.14, 0.18, 0.17);

function textLines(text: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/u)) {
      const joined = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(joined, size) <= max) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > max) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderPdf(
  settings: BookSettings,
  sections: Section[],
  media: BookMedia[],
  loadImage: (item: BookMedia) => Promise<Uint8Array | undefined>,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [sansBytes, serifBytes] = await Promise.all(
    ['DejaVuSans', 'DejaVuSerif'].map((font) =>
      Deno.readFile(new URL(`./fonts/${font}.ttf`, import.meta.url)),
    ),
  );
  const body = await pdf.embedFont(sansBytes, { subset: true });
  const heading = await pdf.embedFont(serifBytes, { subset: true });
  const supported = new Map(
    [body, heading].map((font) => [font, new Set(font.getCharacterSet())]),
  );
  const safe = (text: string, font: PDFFont) =>
    [...text]
      .map((char) =>
        char === '\n' ||
        char === '\r' ||
        supported.get(font)?.has(char.codePointAt(0)!)
          ? char
          : '�',
      )
      .join('');
  const color = colors[settings.theme];
  const { width, height, margin } = paper;
  const textWidth = width - 2 * margin;
  pdf.setTitle(settings.title);
  pdf.setAuthor(settings.author);
  pdf.setLanguage(settings.language);
  pdf.setCreator('FamilyRoots AI');
  const table: { title: string; page: number }[] = [];
  let page: PDFPage;
  let y = 0;

  function start(cover = false) {
    page = pdf.addPage([width, height]);
    if (pdf.getPageCount() > 190)
      throw new Error(
        'The PDF exceeds 190 pages. Shorten edited sections or narrow the selection.',
      );
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: cover ? color.accent : color.paper,
    });
    if (!cover) {
      const running = textLines(
        safe(settings.title, body),
        body,
        8,
        textWidth - 32,
      )[0];
      page.drawText(running, {
        x: margin,
        y: height - 38,
        size: 8,
        font: body,
        color: color.accent,
      });
      page.drawLine({
        start: { x: margin, y: height - 48 },
        end: { x: width - margin, y: height - 48 },
        thickness: 0.6,
        color: color.soft,
      });
      page.drawText(String(pdf.getPageCount()), {
        x: width - margin - 20,
        y: 31,
        size: 9,
        font: body,
        color: color.accent,
      });
    }
    y = cover ? 567 : height - 91;
    return page;
  }

  function draw(text: string, size = 11, font = body, cover = false) {
    for (const line of textLines(safe(text, font), font, size, textWidth)) {
      if (y < 65 + size) start(cover);
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: cover
          ? color.paper
          : font === heading
            ? color.accent
            : bodyColor,
      });
      y -= size * 1.5;
    }
    y -= 12;
  }
  let contents: PDFPage | undefined;
  for (const section of sections) {
    const cover = section.key === 'cover';
    start(cover);
    if (cover)
      page!.drawRectangle({
        x: margin,
        y: 603,
        width: 82,
        height: 4,
        color: color.soft,
      });
    if (section.key === 'contents') {
      contents = page!;
      draw(section.title, 28, heading);
      continue;
    }
    const front = section.key === 'cover' || section.key === 'title';
    if (!front) draw(section.title, 28, heading);
    if (sectionKeysAfterContents.has(section.key))
      table.push({ title: section.title, page: pdf.getPageCount() });
    const blocks =
      section.edit !== undefined
        ? section.edit.split(/\n\n+/)
        : section.paragraphs;
    if (
      section.key === 'gallery' &&
      section.edit === undefined &&
      section.mediaIds?.length
    ) {
      for (const [index, id] of section.mediaIds.entries()) {
        const item = media.find((candidate) => candidate.id === id);
        const imageData = item ? await loadImage(item) : undefined;
        if (imageData?.length) {
          try {
            const jpg = imageData[0] === 0xff && imageData[1] === 0xd8;
            const image = jpg
              ? await pdf.embedJpg(imageData)
              : await pdf.embedPng(imageData);
            const scaled = image.scaleToFit(textWidth, 230);
            if (y < scaled.height + 140) start();
            page!.drawImage(image, {
              x: margin,
              y: y - scaled.height,
              width: scaled.width,
              height: scaled.height,
            });
            y -= scaled.height + 15;
          } catch {
            // An unavailable thumbnail leaves its caption and source credit in the book.
          }
        }
        if (blocks[index]) draw(blocks[index], 10);
      }
    } else {
      for (const [index, block] of blocks.entries()) {
        draw(
          block,
          front && index === 0 ? (cover ? 40 : 34) : front ? 15 : 11,
          front && index === 0 ? heading : body,
          cover,
        );
      }
    }
  }
  if (contents) {
    page = contents;
    y = height - 148;
    for (const item of table) {
      page.drawText(safe(item.title, body), {
        x: margin,
        y,
        font: body,
        size: 12,
        color: bodyColor,
      });
      const number = String(item.page);
      page.drawText(number, {
        x: width - margin - body.widthOfTextAtSize(number, 12),
        y,
        font: body,
        size: 12,
        color: color.accent,
      });
      page.drawLine({
        start: { x: margin, y: y - 12 },
        end: { x: width - margin, y: y - 12 },
        thickness: 0.3,
        color: color.soft,
      });
      y -= 33;
    }
  }
  return pdf.save();
}
const sectionKeysAfterContents = new Set([
  'introduction',
  'tree',
  'generations',
  'biographies',
  'events',
  'gallery',
  'timeline',
  'sources',
  'closing',
]);
