import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { State } from '@/components/State';
import { Type } from '@/components/Type';
import { groupGenerations } from '@/features/family/familySummary';
import { PersonList } from '@/features/family/PersonList';
import { useFamily } from '@/features/family/useFamily';

export default function TreeScreen() {
  const { snapshot } = useFamily();
  const generations = groupGenerations(snapshot.people);

  return (
    <Screen>
      <PageHeading
        title="Family Tree"
        description="Family members grouped by generation."
      />
      <ActionLink href="/family-tree/add" icon="add" label="Add Person" />
      {generations.length ? (
        generations.map(([generation, people]) => (
          <Card key={generation}>
            <Type variant="heading" accessibilityRole="header">
              Generation {generation}
            </Type>
            <PersonList people={people} />
          </Card>
        ))
      ) : (
        <Card>
          <State
            kind="empty"
            title="Start with one person"
            message="Add yourself or a relative. Use generation 1 for the oldest generation you know."
          />
        </Card>
      )}
    </Screen>
  );
}
