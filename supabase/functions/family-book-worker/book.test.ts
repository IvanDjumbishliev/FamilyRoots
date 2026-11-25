import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSections,
  outline,
  sampleContext,
  type BookSettings,
} from './book';

const settings: BookSettings = {
  title: 'Roots',
  subtitle: 'A Family Journey',
  author: 'Family editors',
  copyright: 'Private edition',
  dedication: 'For the next generation',
  acknowledgments: 'Special thanks to our ancestors and contributors',
  template: 'classic-heritage',
  fontTheme: 'serif',
  language: 'en',
  theme: 'forest',
  branch: null,
  sample: true,
  privacy: 'private',
  consent: false,
  biographies: [],
  events: [],
  media: [],
};

test('generates every section including dedication, acknowledgments and verifies facts with references', () => {
  const sections = buildSections(settings, sampleContext(true));
  assert.deepEqual(
    sections.map(({ title }) => title),
    outline('en').map(({ title }) => title),
  );
  assert.match(
    sections.find(({ key }) => key === 'introduction')!.paragraphs.join(' '),
    /fictional sample/,
  );
  assert.match(
    sections.find(({ key }) => key === 'dedication')!.paragraphs[0],
    /For the next generation/,
  );
  assert.match(
    sections.find(({ key }) => key === 'acknowledgments')!.paragraphs[0],
    /Special thanks to our ancestors/,
  );
  assert.match(
    sections.find(({ key }) => key === 'biographies')!.paragraphs[0],
    /Mara Petrova.*\[P1\].*\[R1\]/,
  );
  assert.match(
    sections.find(({ key }) => key === 'sources')!.paragraphs[0],
    /\[R1\] Private tree source/,
  );
  assert.match(
    sections.find(({ key }) => key === 'generations')!.paragraphs[1],
    /Generation 2.*Elena/,
  );
});

test('localizes headings, retains exact names and omits unsupported profile details', () => {
  const data = sampleContext(true);
  data.people[0].verified = false;
  const result = buildSections({ ...settings, language: 'bg' }, data);
  assert.equal(
    result.find(({ key }) => key === 'biographies')?.title,
    'Биографии',
  );
  const body = result.find(({ key }) => key === 'biographies')!.paragraphs[0];
  assert.match(body, /Mara Petrova.*\[P1\]/);
  assert.doesNotMatch(body, /1882|Bookbinder|Plovdiv/);
});

test('keeps archive captions and custom photo captions associated with the correct files', () => {
  const data = sampleContext(false);
  data.media = [
    {
      id: 'one',
      title: 'Album photograph',
      credit: 'Licensed by the contributor',
      mime: 'image/jpeg',
      path: 'private',
      description: null,
    },
    {
      id: 'two',
      title: 'Register scan',
      credit: null,
      mime: 'application/pdf',
      path: null,
      description: null,
    },
  ];
  const gallery = buildSections(
    {
      ...settings,
      privacy: 'full',
      consent: true,
      mediaCaptions: {
        one: 'Grandma’s wedding portrait in Sofia',
      },
    },
    data,
  ).find(({ key }) => key === 'gallery');

  assert.deepEqual(gallery?.mediaIds, ['one', 'two']);
  assert.equal(
    gallery?.photos?.[0].caption,
    'Grandma’s wedding portrait in Sofia',
  );
  assert.match(gallery!.paragraphs[0], /Grandma’s wedding portrait in Sofia/);
  assert.match(gallery!.paragraphs[0], /Licensed by the contributor/);
  assert.match(gallery!.paragraphs[1], /Archive document reference/);
});

test('supports templates (Classic Heritage, Modern Minimal, Vintage Archive) and font themes', () => {
  const templates = [
    'classic-heritage',
    'modern-minimal',
    'vintage-archive',
  ] as const;
  for (const template of templates) {
    const config: BookSettings = {
      ...settings,
      template,
      fontTheme: 'editorial',
      theme: 'sepia',
    };
    const sections = buildSections(config, sampleContext(true));
    assert.equal(sections.length, 15);
  }
});
