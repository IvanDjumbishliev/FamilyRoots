import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'npm:pdf-lib@1.17.1';

import type { BookMedia, BookSettings, Section } from './book.ts';

const paper = { width: 595, height: 842, margin: 56 };

export const bookColors = {
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
  rose: {
    accent: rgb(0.35, 0.12, 0.18),
    paper: rgb(0.99, 0.96, 0.96),
    soft: rgb(0.8, 0.55, 0.6),
  },
  slate: {
    accent: rgb(0.2, 0.22, 0.25),
    paper: rgb(0.96, 0.96, 0.97),
    soft: rgb(0.6, 0.65, 0.7),
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
  const sansFont = await pdf.embedFont(sansBytes, { subset: true });
  const serifFont = await pdf.embedFont(serifBytes, { subset: true });

  const fontTheme = settings.fontTheme ?? 'serif';
  const body = fontTheme === 'sans' ? sansFont : serifFont;
  const heading = fontTheme === 'sans' ? sansFont : serifFont;

  const supported = new Map(
    [sansFont, serifFont].map((font) => [
      font,
      new Set(font.getCharacterSet()),
    ]),
  );
  const safe = (text: string, font: PDFFont) =>
    [...text]
      .map((char) =>
        char === '\n' ||
        char === '\r' ||
        supported.get(font)?.has(char.codePointAt(0)!)
          ? char
          : '',
      )
      .join('');

  const template = settings.template ?? 'classic-heritage';
  const color = bookColors[settings.theme] ?? bookColors.forest;
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

    // Apply template styling for background
    if (cover) {
      if (template === 'modern-minimal') {
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: color.paper,
        });
        // Modern minimal clean bar
        page.drawRectangle({
          x: margin,
          y: height - 120,
          width: 6,
          height: 140,
          color: color.accent,
        });
      } else if (template === 'vintage-archive') {
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: color.paper,
        });
        // Vintage double border on cover
        page.drawRectangle({
          x: margin - 16,
          y: margin - 16,
          width: width - 2 * (margin - 16),
          height: height - 2 * (margin - 16),
          borderColor: color.accent,
          borderWidth: 2,
        });
        page.drawRectangle({
          x: margin - 10,
          y: margin - 10,
          width: width - 2 * (margin - 10),
          height: height - 2 * (margin - 10),
          borderColor: color.soft,
          borderWidth: 0.75,
        });
      } else {
        // Classic heritage: rich saturated cover
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: color.accent,
        });
        // Gold / soft accent border
        page.drawRectangle({
          x: margin - 12,
          y: margin - 12,
          width: width - 2 * (margin - 12),
          height: height - 2 * (margin - 12),
          borderColor: color.soft,
          borderWidth: 1.5,
        });
      }
    } else {
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: color.paper,
      });

      // Template page headers & footers
      if (template === 'vintage-archive') {
        // Vintage archive decorative header
        const running = textLines(
          safe(settings.title, serifFont),
          serifFont,
          9,
          textWidth - 40,
        )[0];
        page.drawText(running, {
          x: margin,
          y: height - 38,
          size: 9,
          font: serifFont,
          color: color.accent,
        });
        page.drawLine({
          start: { x: margin, y: height - 44 },
          end: { x: width - margin, y: height - 44 },
          thickness: 1.2,
          color: color.accent,
        });
        page.drawLine({
          start: { x: margin, y: height - 47 },
          end: { x: width - margin, y: height - 47 },
          thickness: 0.4,
          color: color.soft,
        });
        page.drawText(`— ${pdf.getPageCount()} —`, {
          x: width / 2 - 16,
          y: 28,
          size: 9,
          font: serifFont,
          color: color.accent,
        });
      } else if (template === 'modern-minimal') {
        // Modern minimal header
        const running = textLines(
          safe(settings.title.toUpperCase(), sansFont),
          sansFont,
          7,
          textWidth - 40,
        )[0];
        page.drawText(running, {
          x: margin,
          y: height - 36,
          size: 7,
          font: sansFont,
          color: color.soft,
        });
        page.drawText(String(pdf.getPageCount()), {
          x: width - margin - 20,
          y: height - 36,
          size: 8,
          font: sansFont,
          color: color.accent,
        });
      } else {
        // Classic heritage header
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
    }
    y = cover ? 567 : height - 91;
    return page;
  }

  function draw(text: string, size = 11, font = body, cover = false) {
    const isCoverLight =
      cover &&
      (template === 'modern-minimal' || template === 'vintage-archive');
    const textColor = cover
      ? isCoverLight
        ? color.accent
        : color.paper
      : font === heading
        ? color.accent
        : bodyColor;

    for (const line of textLines(safe(text, font), font, size, textWidth)) {
      if (y < 65 + size) start(cover);
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: textColor,
      });
      y -= size * 1.5;
    }
    y -= 12;
  }

  let contents: PDFPage | undefined;
  for (const section of sections) {
    const cover = section.key === 'cover';
    start(cover);
    if (cover) {
      if (template === 'classic-heritage') {
        page!.drawRectangle({
          x: margin,
          y: 603,
          width: 82,
          height: 4,
          color: color.soft,
        });
      }
    }
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
      (section.photos?.length || section.mediaIds?.length)
    ) {
      const photoItems =
        section.photos ??
        section.mediaIds?.map((id) => ({ id, caption: undefined })) ??
        [];
      for (const [index, photo] of photoItems.entries()) {
        const item = media.find((candidate) => candidate.id === photo.id);
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
        // Custom photo caption if provided, else paragraph block
        const customCaption = photo.caption;
        if (customCaption) {
          const creditLine = item?.credit ? ` · ${item.credit}` : '';
          draw(`${customCaption}${creditLine}`, 10);
        } else if (blocks[index]) {
          draw(blocks[index], 10);
        }
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
  'dedication',
  'acknowledgments',
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
