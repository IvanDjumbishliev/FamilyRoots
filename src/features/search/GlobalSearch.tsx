import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ActionLink } from '@/components/ActionLink';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { State } from '@/components/State';
import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';
import { Choices } from '@/features/people/Choices';
import { usePeopleQuery } from '@/features/people/usePeople';
import type { PeopleRepository } from '@/services/peopleRepository';
import type {
  SearchFilters,
  SearchItem,
  SearchRepository,
} from '@/services/searchRepository';

const categoryChoices: {
  value: NonNullable<SearchFilters['category']>;
  label: string;
}[] = [
  { value: 'all', label: 'All records' },
  { value: 'people', label: 'People' },
  { value: 'events', label: 'Events' },
  { value: 'archive', label: 'Photos & Documents' },
  { value: 'books', label: 'Books' },
];

const categoryIcons: Record<SearchItem['category'], string> = {
  person: '👤',
  event: '📅',
  archive: '📷',
  book: '📖',
};

const PAGE_SIZE = 10;

export function GlobalSearch({
  repository,
  peopleRepo,
  initialTreeId,
}: {
  repository: SearchRepository;
  peopleRepo?: PeopleRepository;
  initialTreeId?: string;
}) {
  const router = useRouter();
  const treesQuery = usePeopleQuery(
    useCallback(
      async () => (peopleRepo ? peopleRepo.trees() : []),
      [peopleRepo],
    ),
  );

  const [query, setQuery] = useState('');
  const [selectedTree, setSelectedTree] = useState<string>(
    initialTreeId ?? 'all',
  );
  const [category, setCategory] =
    useState<NonNullable<SearchFilters['category']>>('all');

  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const executeSearch = useCallback(
    async (
      searchTerm: string,
      tree: string,
      cat: typeof category,
      p: number,
    ) => {
      if (!searchTerm.trim()) {
        setResults([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const offset = p * PAGE_SIZE;
        // Request PAGE_SIZE + 1 to check for hasMore
        const data = await repository.search({
          query: searchTerm.trim(),
          treeId: tree === 'all' ? undefined : tree,
          category: cat,
          limit: PAGE_SIZE + 1,
          offset,
        });

        if (data.length > PAGE_SIZE) {
          setHasMore(true);
          setResults(data.slice(0, PAGE_SIZE));
        } else {
          setHasMore(false);
          setResults(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search request failed.');
      } finally {
        setLoading(false);
      }
    },
    [repository],
  );

  // Trigger search on debounce or filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      void executeSearch(query, selectedTree, category, 0);
    }, 250);
    return () => clearTimeout(timer);
  }, [category, executeSearch, query, selectedTree]);

  function handleNextPage() {
    const next = page + 1;
    setPage(next);
    void executeSearch(query, selectedTree, category, next);
  }

  function handlePrevPage() {
    if (page === 0) return;
    const prev = page - 1;
    setPage(prev);
    void executeSearch(query, selectedTree, category, prev);
  }

  const treeChoices = [
    { value: 'all', label: 'All Trees' },
    ...(treesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <View style={{ gap: 16 }}>
      {/* Search Input Card */}
      <Card>
        <Type variant="heading">Global Search</Type>
        <Type tone="muted">
          Search people, aliases, milestone events, archive photos, and books.
        </Type>

        <View style={{ marginTop: 12, gap: 12 }}>
          <TextField
            label="Search keyword"
            placeholder="Search by name, place, event, document, or book title…"
            value={query}
            onChangeText={setQuery}
          />

          <View style={{ gap: 8 }}>
            <Choices
              label="Record Category"
              value={category}
              choices={categoryChoices}
              onChange={setCategory}
            />

            {treeChoices.length > 2 && (
              <Choices
                label="Filter by Family Tree"
                value={selectedTree}
                choices={treeChoices}
                onChange={setSelectedTree}
              />
            )}
          </View>
        </View>
      </Card>

      {/* Results Section */}
      {loading && <LoadingState label="Searching family records…" />}
      {error && <ErrorState message={error} />}

      {!loading && !error && query.trim() && results.length === 0 && (
        <State
          kind="empty"
          title="No records found"
          message={`No matches found for "${query}". Try adjusting keywords or category filters.`}
        />
      )}

      {!loading && results.length > 0 && (
        <View style={{ gap: 12 }}>
          <Type variant="label" tone="muted">
            Showing results {page * PAGE_SIZE + 1}–
            {page * PAGE_SIZE + results.length} (Page {page + 1})
          </Type>

          {results.map((item) => (
            <Card key={`${item.category}-${item.id}`}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Type variant="heading">
                    {categoryIcons[item.category]} {item.title}
                  </Type>
                  {item.subtitle && <Type tone="muted">{item.subtitle}</Type>}
                  {item.detail ? (
                    <Type numberOfLines={2}>{item.detail}</Type>
                  ) : null}
                  {item.tree_name && (
                    <Type tone="muted" style={{ fontSize: 11 }}>
                      Tree: {item.tree_name}
                    </Type>
                  )}
                </View>

                <ActionLink
                  href={item.link as any}
                  label="View"
                  variant="secondary"
                />
              </View>
            </Card>
          ))}

          {/* Pagination Controls */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Button
              label="← Previous page"
              variant="secondary"
              disabled={page === 0 || loading}
              onPress={handlePrevPage}
            />
            <Type tone="muted">Page {page + 1}</Type>
            <Button
              label="Next page →"
              variant="secondary"
              disabled={!hasMore || loading}
              onPress={handleNextPage}
            />
          </View>
        </View>
      )}
    </View>
  );
}
