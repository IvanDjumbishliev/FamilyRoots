import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { useSearch } from '@/features/search/useSearch';

export default function SearchScreen() {
  const { repository, peopleRepo, firstTree } = useSearch();

  return (
    <Screen>
      <PageHeading
        title="Search Records"
        description="Find people, life events, photos, and books across your family trees."
      />
      {repository && (
        <GlobalSearch
          repository={repository}
          peopleRepo={peopleRepo}
          initialTreeId={firstTree}
        />
      )}
    </Screen>
  );
}
