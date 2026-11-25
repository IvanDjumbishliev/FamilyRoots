import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Type } from '@/components/Type';
import type {
  BookSettings,
  BookTemplate,
  FontTheme,
  Section,
  Theme,
} from '../../../supabase/functions/family-book-worker/book';

export const previewPalette: Record<
  Theme,
  {
    bg: string;
    text: string;
    accent: string;
    border: string;
    soft: string;
  }
> = {
  forest: {
    bg: '#FAF7F0',
    text: '#242E2B',
    accent: '#173D33',
    border: '#C2A36B',
    soft: '#E8E1D5',
  },
  ink: {
    bg: '#F5F7FC',
    text: '#1C2E4A',
    accent: '#1C2E4A',
    border: '#8CA4C4',
    soft: '#E0E6F0',
  },
  sepia: {
    bg: '#FAF2E3',
    text: '#4F301F',
    accent: '#4F301F',
    border: '#AD784F',
    soft: '#E8D9C5',
  },
  rose: {
    bg: '#FDF5F5',
    text: '#591F2E',
    accent: '#591F2E',
    border: '#CC8C99',
    soft: '#F4DFE3',
  },
  slate: {
    bg: '#F5F5F7',
    text: '#333840',
    accent: '#333840',
    border: '#99A6B2',
    soft: '#E1E4E8',
  },
};

export function BookPreview({
  settings,
  section,
  pageNumber,
  totalPages,
}: {
  settings: BookSettings;
  section: Section;
  pageNumber: number;
  totalPages: number;
}) {
  const theme = settings.theme ?? 'forest';
  const template: BookTemplate = settings.template ?? 'classic-heritage';
  const fontTheme: FontTheme = settings.fontTheme ?? 'serif';
  const palette = previewPalette[theme] ?? previewPalette.forest;

  const isCover = section.key === 'cover';
  const isTitle = section.key === 'title';

  const fontFamily =
    fontTheme === 'sans'
      ? 'sans-serif'
      : fontTheme === 'editorial'
        ? 'Georgia, serif'
        : 'serif';

  const paragraphs =
    section.edit !== undefined
      ? section.edit.split(/\n\n+/)
      : section.paragraphs;

  // Background and borders based on template
  const isDarkCover = isCover && template === 'classic-heritage';
  const pageBg = isDarkCover ? palette.accent : palette.bg;
  const pageText = isDarkCover ? '#FAF7F0' : palette.text;
  const pageAccent = isDarkCover ? '#FAF7F0' : palette.accent;

  return (
    <Card>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Type variant="label" tone="muted">
          Page {pageNumber} of {totalPages} · {template.replace('-', ' ')}
        </Type>
        <View
          style={{
            width: '100%',
            maxWidth: 520,
            aspectRatio: 595 / 842,
            backgroundColor: pageBg,
            borderRadius: 4,
            padding: 32,
            borderWidth: 1,
            borderColor: palette.soft,
            position: 'relative',
            overflow: 'hidden',
            justifyContent: isCover ? 'center' : 'flex-start',
            ...(template === 'vintage-archive'
              ? {
                  borderWidth: 3,
                  borderColor: isCover ? palette.border : palette.accent,
                }
              : {}),
          }}
        >
          {/* Header */}
          {!isCover && (
            <View
              style={{
                borderBottomWidth: template === 'vintage-archive' ? 2 : 1,
                borderBottomColor: palette.border,
                paddingBottom: 6,
                marginBottom: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Type
                style={{
                  fontSize: 10,
                  color: palette.accent,
                  fontFamily,
                  textTransform:
                    template === 'modern-minimal' ? 'uppercase' : 'none',
                  letterSpacing: template === 'modern-minimal' ? 1.5 : 0,
                }}
              >
                {settings.title}
              </Type>
              <Type
                style={{
                  fontSize: 10,
                  color: palette.accent,
                  fontFamily,
                }}
              >
                {pageNumber}
              </Type>
            </View>
          )}

          {/* Cover decorative elements */}
          {isCover && template === 'modern-minimal' && (
            <View
              style={{
                width: 6,
                height: 80,
                backgroundColor: palette.accent,
                marginBottom: 24,
              }}
            />
          )}

          {isCover && template === 'classic-heritage' && (
            <View
              style={{
                width: 60,
                height: 4,
                backgroundColor: palette.border,
                marginBottom: 24,
              }}
            />
          )}

          {/* Section Title */}
          {!isCover && !isTitle && (
            <Type
              accessibilityRole="header"
              style={{
                fontSize: template === 'vintage-archive' ? 20 : 18,
                fontWeight: 'bold',
                color: pageAccent,
                fontFamily,
                marginBottom: 14,
                textAlign: template === 'vintage-archive' ? 'center' : 'left',
              }}
            >
              {section.title}
            </Type>
          )}

          {/* Section Body */}
          <View style={{ gap: 12 }}>
            {paragraphs.map((p, idx) => (
              <Type
                key={idx}
                style={{
                  fontSize: isCover && idx === 0 ? 24 : isCover ? 14 : 11,
                  fontWeight: isCover && idx === 0 ? 'bold' : 'normal',
                  color: pageText,
                  fontFamily,
                  lineHeight: isCover ? 28 : 16,
                  textAlign:
                    isCover || template === 'vintage-archive'
                      ? 'center'
                      : 'left',
                }}
              >
                {p}
              </Type>
            ))}
          </View>

          {/* Photographs gallery if any */}
          {section.key === 'gallery' &&
          (section.photos?.length || section.mediaIds?.length) ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {(
                section.photos ??
                section.mediaIds?.map((id) => ({ id, caption: undefined })) ??
                []
              ).map((photo, pIdx) => (
                <View
                  key={pIdx}
                  style={{
                    borderWidth: 1,
                    borderColor: palette.border,
                    padding: 8,
                    borderRadius: 4,
                    backgroundColor: palette.soft,
                    alignItems: 'center',
                  }}
                >
                  <Type style={{ fontSize: 10, color: pageText }}>
                    📷 Photograph #{pIdx + 1}
                  </Type>
                  {photo.caption ? (
                    <Type
                      style={{
                        fontSize: 9,
                        fontStyle: 'italic',
                        color: pageText,
                        marginTop: 4,
                      }}
                    >
                      {photo.caption}
                    </Type>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* Footer for non-cover */}
          {!isCover && (
            <View
              style={{
                position: 'absolute',
                bottom: 16,
                left: 32,
                right: 32,
                flexDirection: 'row',
                justifyContent:
                  template === 'vintage-archive' ? 'center' : 'flex-end',
              }}
            >
              <Type
                style={{
                  fontSize: 9,
                  color: palette.accent,
                  fontFamily,
                }}
              >
                {template === 'vintage-archive'
                  ? `— ${pageNumber} —`
                  : String(pageNumber)}
              </Type>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}
