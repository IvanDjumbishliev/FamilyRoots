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
  subtitle: '',
  author: 'Family editors',
  copyright: 'Private edition',
  dedication: 'For the next generation',
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

test('generates every section, verifies facts with references and includes a sample disclaimer', () => {
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

test('keeps archive captions associated with the correct files', () => {
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
    { ...settings, privacy: 'full', consent: true },
    data,
  ).find(({ key }) => key === 'gallery');
  assert.deepEqual(gallery?.mediaIds, ['one', 'two']);
  assert.match(gallery!.paragraphs[0], /Licensed by the contributor/);
  assert.match(gallery!.paragraphs[1], /Archive document reference/);
});
