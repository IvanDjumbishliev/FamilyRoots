import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { downloadArchiveFile } from '@/features/archive/archiveDownload';
import { BookPreview } from '@/features/books/BookPreview';
import { Choices } from '@/features/people/Choices';
import {
  bookError,
  type BookRepository,
  type BookRevision,
} from '@/services/bookRepository';
import type {
  BookMedia,
  BookPhoto,
  BookSettings,
  BookTemplate,
  FontTheme,
  Section,
  SectionKey,
  Theme,
} from '../../../supabase/functions/family-book-worker/book';

type BookData = Awaited<ReturnType<BookRepository['read']>>;

const templateChoices: { value: BookTemplate; label: string }[] = [
  { value: 'classic-heritage', label: 'Classic Heritage' },
  { value: 'modern-minimal', label: 'Modern Minimal' },
  { value: 'vintage-archive', label: 'Vintage Archive' },
];

const fontThemeChoices: { value: FontTheme; label: string }[] = [
  { value: 'serif', label: 'Serif (Traditional)' },
  { value: 'sans', label: 'Sans-Serif (Modern)' },
  { value: 'editorial', label: 'Editorial (Bookish)' },
];

const colorThemeChoices: { value: Theme; label: string }[] = [
  { value: 'forest', label: 'Forest Green' },
  { value: 'ink', label: 'Ink Blue' },
  { value: 'sepia', label: 'Sepia Warmth' },
  { value: 'rose', label: 'Rose Heritage' },
  { value: 'slate', label: 'Slate Charcoal' },
];

export function BookEditor({
  book,
  repository,
  reload,
  availableMedia = [],
}: {
  book: BookData;
  repository: BookRepository;
  reload: () => void;
  availableMedia?: BookMedia[];
}) {
  // Working state for book draft
  const [settings, setSettings] = useState<BookSettings>(book.settings);
  const [sections, setSections] = useState<Section[]>(book.sections);
  const [selectedKey, setSelectedKey] = useState<SectionKey>(
    book.sections[0]?.key ?? 'cover',
  );

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'chapters' | 'cover' | 'design' | 'photos' | 'preview' | 'revisions'
  >('chapters');

  // Photo management state
  const [newPhotoMediaId, setNewPhotoMediaId] = useState('');

  // Revisions history
  const [revisions, setRevisions] = useState<BookRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // Export & Download
  const [permission, setPermission] = useState(false);

  // Web beforeunload warning for unsaved changes
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [hasUnsavedChanges]);

  // Load revisions on mount
  useEffect(() => {
    let mounted = true;
    async function fetchRevisions() {
      setLoadingRevisions(true);
      try {
        const revs = await repository.revisions(book.id);
        if (mounted) setRevisions(revs);
      } catch {
        // ignore error fetching revisions
      } finally {
        if (mounted) setLoadingRevisions(false);
      }
    }
    void fetchRevisions();
    return () => {
      mounted = false;
    };
  }, [book.id, repository]);

  const currentSection = sections.find((s) => s.key === selectedKey);
  const generating = book.status === 'queued' || book.status === 'working';
  const path =
    book.status === 'ready' && book.pdf_revision === book.revision
      ? book.pdf_path
      : null;

  // Mark modified
  function markDirty() {
    setHasUnsavedChanges(true);
    setSaveSuccessMessage('');
  }

  // 1. Edit chapter title and text
  function updateSectionTitle(title: string) {
    markDirty();
    setSections((prev) =>
      prev.map((s) => (s.key === selectedKey ? { ...s, title } : s)),
    );
  }

  function updateSectionText(text: string) {
    markDirty();
    setSections((prev) =>
      prev.map((s) => (s.key === selectedKey ? { ...s, edit: text } : s)),
    );
  }

  // 2. Reorder chapters
  function moveSection(fromIndex: number, direction: 'up' | 'down') {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= sections.length) return;
    markDirty();
    setSections((prev) => {
      const copy = [...prev];
      const item = copy.splice(fromIndex, 1)[0];
      copy.splice(toIndex, 0, item);
      return copy;
    });
  }

  // 3. Add and remove photographs in gallery
  function addPhotograph(mediaId: string) {
    if (!mediaId) return;
    markDirty();
    setSections((prev) =>
      prev.map((s) => {
        if (s.key === 'gallery') {
          const currentPhotos =
            s.photos ??
            s.mediaIds?.map((id) => ({ id, caption: undefined })) ??
            [];
          return {
            ...s,
            photos: [...currentPhotos, { id: mediaId, caption: '' }],
            mediaIds: [...(s.mediaIds ?? []), mediaId],
          };
        }
        return s;
      }),
    );
    setNewPhotoMediaId('');
  }

  function removePhotograph(index: number) {
    markDirty();
    setSections((prev) =>
      prev.map((s) => {
        if (s.key === 'gallery') {
          const currentPhotos = [
            ...(s.photos ??
              s.mediaIds?.map((id) => ({ id, caption: undefined })) ??
              []),
          ];
          currentPhotos.splice(index, 1);
          return {
            ...s,
            photos: currentPhotos,
            mediaIds: currentPhotos.map((p) => p.id),
          };
        }
        return s;
      }),
    );
  }

  // 4. Edit photograph caption
  function updatePhotoCaption(index: number, caption: string) {
    markDirty();
    setSections((prev) =>
      prev.map((s) => {
        if (s.key === 'gallery') {
          const currentPhotos = [
            ...(s.photos ??
              s.mediaIds?.map((id) => ({ id, caption: undefined })) ??
              []),
          ];
          if (currentPhotos[index]) {
            currentPhotos[index] = { ...currentPhotos[index], caption };
          }
          return {
            ...s,
            photos: currentPhotos,
          };
        }
        return s;
      }),
    );
    // Also store in settings mediaCaptions for persistence
    const gallery = sections.find((s) => s.key === 'gallery');
    const photo = (gallery?.photos ?? [])[index];
    if (photo) {
      setSettings((prev) => ({
        ...prev,
        mediaCaptions: {
          ...(prev.mediaCaptions ?? {}),
          [photo.id]: caption,
        },
      }));
    }
  }

  // Save book draft
  async function saveDraft() {
    setIsSaving(true);
    setIssue('');
    setSaveSuccessMessage('');
    try {
      // Sync cover fields and dedication/acknowledgments to sections
      const updatedSections = sections.map((sec) => {
        if (sec.key === 'cover' || sec.key === 'title') {
          return {
            ...sec,
            paragraphs: [
              settings.title,
              settings.subtitle,
              settings.author,
            ].filter(Boolean),
          };
        }
        if (sec.key === 'dedication' && settings.dedication) {
          return {
            ...sec,
            paragraphs: [settings.dedication],
          };
        }
        if (sec.key === 'acknowledgments' && settings.acknowledgments) {
          return {
            ...sec,
            paragraphs: [settings.acknowledgments],
          };
        }
        return sec;
      });

      const newRev = await repository.saveDraft(
        book.id,
        book.revision,
        settings,
        updatedSections,
      );
      setHasUnsavedChanges(false);
      setSaveSuccessMessage(`Draft saved! (Revision ${newRev})`);
      reload();
    } catch (err) {
      setIssue(bookError(err));
    } finally {
      setIsSaving(false);
    }
  }

  // Restore revision
  function restoreRevision(rev: BookRevision) {
    if (
      hasUnsavedChanges &&
      !window.confirm?.(
        'You have unsaved changes. Discard and restore revision?',
      )
    ) {
      return;
    }
    setSettings(rev.settings as BookSettings);
    setSections(rev.sections);
    markDirty();
    setSaveSuccessMessage(
      `Loaded revision ${rev.revision}. Click 'Save book draft' to keep.`,
    );
  }

  async function perform(fn: () => Promise<unknown>, refresh = true) {
    setIssue('');
    setBusy(true);
    try {
      await fn();
      if (refresh) reload();
    } catch (error) {
      setIssue(bookError(error));
    } finally {
      setBusy(false);
    }
  }

  const gallerySection = sections.find((s) => s.key === 'gallery');
  const galleryPhotos: BookPhoto[] =
    gallerySection?.photos ??
    gallerySection?.mediaIds?.map((id) => ({
      id,
      caption: settings.mediaCaptions?.[id] ?? '',
    })) ??
    [];

  const currentIndex = sections.findIndex((s) => s.key === selectedKey);

  return (
    <View style={{ gap: 16 }}>
      {/* Draft Actions Bar */}
      <Card>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Type variant="heading">Book Draft Editor</Type>
            <Type tone="muted">
              Revision {book.revision} ·{' '}
              {hasUnsavedChanges ? '⚠️ Unsaved edits' : 'Saved'}
            </Type>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              label={isSaving ? 'Saving…' : 'Save book draft'}
              variant="primary"
              disabled={isSaving || generating}
              onPress={() => void saveDraft()}
            />
            {book.status === 'failed' && (
              <Button
                label="Retry generation"
                disabled={busy}
                onPress={() =>
                  void perform(() =>
                    repository.queue(book.id, book.revision, 'retry'),
                  )
                }
              />
            )}
          </View>
        </View>

        {hasUnsavedChanges && (
          <Type tone="muted" style={{ marginTop: 8 }}>
            ⚠️ You have unsaved changes. Be sure to save before exporting or
            navigating away.
          </Type>
        )}
        {saveSuccessMessage && (
          <Type tone="accent" style={{ marginTop: 8, color: '#173D33' }}>
            ✓ {saveSuccessMessage}
          </Type>
        )}
        {issue && <ErrorState message={issue} />}
      </Card>

      {/* Editor Navigation Tabs */}
      <Card>
        <Choices
          label="Editor Navigation"
          choices={[
            { value: 'chapters', label: '📖 Chapters & Text' },
            { value: 'cover', label: '🎨 Cover & Titles' },
            { value: 'design', label: '✨ Template & Styling' },
            { value: 'photos', label: '📷 Photographs' },
            { value: 'preview', label: '👁️ Page Preview' },
            { value: 'revisions', label: '🕒 History' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </Card>

      {/* TAB 1: Chapters & Text */}
      {activeTab === 'chapters' && (
        <Card>
          <Type variant="heading">Edit Chapters & Reorder</Type>
          <Type tone="muted">
            Select a chapter to edit its title, content, or change section
            order.
          </Type>

          <View style={{ marginTop: 12, gap: 12 }}>
            <Choices
              label="Selected Chapter"
              value={selectedKey}
              onChange={setSelectedKey}
              choices={sections.map((s, idx) => ({
                value: s.key,
                label: `${idx + 1}. ${s.title}`,
              }))}
            />

            {currentSection && (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Type variant="label">
                    Chapter Position: #{currentIndex + 1} of {sections.length}
                  </Type>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Button
                      label="⬆ Move Up"
                      variant="secondary"
                      disabled={currentIndex === 0}
                      onPress={() => moveSection(currentIndex, 'up')}
                    />
                    <Button
                      label="⬇ Move Down"
                      variant="secondary"
                      disabled={currentIndex === sections.length - 1}
                      onPress={() => moveSection(currentIndex, 'down')}
                    />
                  </View>
                </View>

                <TextField
                  label="Chapter Title"
                  value={currentSection.title}
                  onChangeText={updateSectionTitle}
                />

                <TextField
                  label="Chapter Text"
                  multiline
                  maxLength={20000}
                  value={
                    currentSection.edit !== undefined
                      ? currentSection.edit
                      : currentSection.paragraphs.join('\n\n')
                  }
                  onChangeText={updateSectionText}
                />
              </View>
            )}
          </View>
        </Card>
      )}

      {/* TAB 2: Cover, Titles & Attributions */}
      {activeTab === 'cover' && (
        <Card>
          <Type variant="heading">Cover, Subtitle & Dedication</Type>
          <Type tone="muted">
            Customize author attribution, title, subtitle, dedication, and
            acknowledgments.
          </Type>

          <View style={{ marginTop: 16, gap: 14 }}>
            <TextField
              label="Book Title"
              value={settings.title}
              maxLength={120}
              onChangeText={(title) => {
                markDirty();
                setSettings((s) => ({ ...s, title }));
              }}
            />

            <TextField
              label="Subtitle"
              value={settings.subtitle}
              maxLength={220}
              onChangeText={(subtitle) => {
                markDirty();
                setSettings((s) => ({ ...s, subtitle }));
              }}
            />

            <TextField
              label="Author or Family Attribution"
              value={settings.author}
              maxLength={120}
              onChangeText={(author) => {
                markDirty();
                setSettings((s) => ({ ...s, author }));
              }}
            />

            <TextField
              label="Dedication"
              multiline
              maxLength={1200}
              value={settings.dedication}
              onChangeText={(dedication) => {
                markDirty();
                setSettings((s) => ({ ...s, dedication }));
              }}
            />

            <TextField
              label="Acknowledgments"
              multiline
              maxLength={1200}
              value={settings.acknowledgments ?? ''}
              onChangeText={(acknowledgments) => {
                markDirty();
                setSettings((s) => ({ ...s, acknowledgments }));
              }}
            />
          </View>
        </Card>
      )}

      {/* TAB 3: Design, Templates & Fonts */}
      {activeTab === 'design' && (
        <Card>
          <Type variant="heading">Choose Design Template & Themes</Type>
          <Type tone="muted">
            Select an original design template, typography, and color palette.
          </Type>

          <View style={{ marginTop: 16, gap: 16 }}>
            <Choices
              label="Book Template"
              value={settings.template ?? 'classic-heritage'}
              choices={templateChoices}
              onChange={(template) => {
                markDirty();
                setSettings((s) => ({ ...s, template }));
              }}
            />

            <Choices
              label="Font Theme"
              value={settings.fontTheme ?? 'serif'}
              choices={fontThemeChoices}
              onChange={(fontTheme) => {
                markDirty();
                setSettings((s) => ({ ...s, fontTheme }));
              }}
            />

            <Choices
              label="Color Theme"
              value={settings.theme}
              choices={colorThemeChoices}
              onChange={(theme) => {
                markDirty();
                setSettings((s) => ({ ...s, theme }));
              }}
            />
          </View>
        </Card>
      )}

      {/* TAB 4: Photographs & Captions */}
      {activeTab === 'photos' && (
        <Card>
          <Type variant="heading">Manage Photographs & Captions</Type>
          <Type tone="muted">
            Add or remove photographs and customize their captions in the book
            gallery.
          </Type>

          <View style={{ marginTop: 16, gap: 14 }}>
            {galleryPhotos.length === 0 ? (
              <Type tone="muted">No photographs in this book draft yet.</Type>
            ) : (
              galleryPhotos.map((photo, idx) => (
                <View
                  key={idx}
                  style={{
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#DDD',
                    borderRadius: 6,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Type variant="label">Photograph #{idx + 1}</Type>
                    <Button
                      label="Remove"
                      variant="quiet"
                      onPress={() => removePhotograph(idx)}
                    />
                  </View>
                  <TextField
                    label="Caption"
                    value={photo.caption ?? ''}
                    maxLength={300}
                    onChangeText={(cap) => updatePhotoCaption(idx, cap)}
                  />
                </View>
              ))
            )}

            {/* Add photograph */}
            {availableMedia.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Type variant="label">Add Photograph from Family Archive</Type>
                <Choices
                  label="Select Photo"
                  value={newPhotoMediaId}
                  choices={availableMedia.map((m) => ({
                    value: m.id,
                    label: m.title || 'Untitled item',
                  }))}
                  onChange={setNewPhotoMediaId}
                />
                <Button
                  label="Add Selected Photograph"
                  variant="secondary"
                  disabled={!newPhotoMediaId}
                  onPress={() => addPhotograph(newPhotoMediaId)}
                />
              </View>
            )}
          </View>
        </Card>
      )}

      {/* TAB 5: Page Preview */}
      {activeTab === 'preview' && currentSection && (
        <View style={{ gap: 12 }}>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Type variant="heading">Individual Page Preview</Type>
              <Choices
                label="Preview Page"
                value={selectedKey}
                onChange={setSelectedKey}
                choices={sections.map((s, idx) => ({
                  value: s.key,
                  label: `${idx + 1}. ${s.title.slice(0, 15)}`,
                }))}
              />
            </View>
          </Card>

          <BookPreview
            settings={settings}
            section={currentSection}
            pageNumber={currentIndex + 1}
            totalPages={sections.length}
          />
        </View>
      )}

      {/* TAB 6: Revision History */}
      {activeTab === 'revisions' && (
        <Card>
          <Type variant="heading">Revision History</Type>
          <Type tone="muted">
            Track past revisions and restore a previous version of your draft.
          </Type>

          {loadingRevisions ? (
            <Type tone="muted">Loading revisions…</Type>
          ) : revisions.length === 0 ? (
            <Type tone="muted" style={{ marginTop: 12 }}>
              No previous revisions saved yet. Saving updates to this draft will
              create revision snapshots.
            </Type>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {revisions.map((rev) => (
                <View
                  key={rev.id}
                  style={{
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 6,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ gap: 2 }}>
                    <Type variant="label">Revision {rev.revision}</Type>
                    <Type tone="muted">
                      {rev.title} · {new Date(rev.created_at).toLocaleString()}
                    </Type>
                  </View>
                  <Button
                    label="Restore"
                    variant="secondary"
                    onPress={() => restoreRevision(rev)}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      {/* Export & PDF Section */}
      <Card>
        <Type variant="heading">Export & Download</Type>
        <Type tone="muted">
          Generate an updated PDF reflecting all saved edits, photographs, and
          template choices.
        </Type>

        <View style={{ marginTop: 12, gap: 12 }}>
          <Button
            label="I reviewed the draft for sensitive details and reproduction permissions"
            variant="secondary"
            accessibilityRole="checkbox"
            aria-checked={permission}
            selected={permission}
            accessibilityState={{ checked: permission }}
            onPress={() => setPermission(!permission)}
          />

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label={generating ? 'Exporting PDF…' : 'Export updated book PDF'}
              variant="primary"
              disabled={!permission || busy || generating || hasUnsavedChanges}
              onPress={() =>
                void perform(() =>
                  repository.queue(book.id, book.revision, 'pdf'),
                )
              }
            />

            {path && (
              <Button
                label="Download PDF"
                disabled={busy}
                onPress={() =>
                  void perform(async () => {
                    const url = await repository.download(path);
                    await downloadArchiveFile(
                      url,
                      `${settings.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'family-history'}.pdf`,
                      'application/pdf',
                    );
                  }, false)
                }
              />
            )}
          </View>

          {hasUnsavedChanges && (
            <Type tone="muted">
              Save your draft changes first before exporting to ensure the PDF
              reflects your latest edits.
            </Type>
          )}
        </View>
      </Card>
    </View>
  );
}
