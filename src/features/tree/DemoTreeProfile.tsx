import { Redirect } from 'expo-router';

import { ActionLink } from '@/components/ActionLink';
import { Card } from '@/components/Card';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { Type } from '@/components/Type';
import { useFamily } from '@/features/family/useFamily';
import {
  connectionLabel,
  endpoints,
} from '@/features/relationships/relationshipGraph';

import { demoTree } from './demoTree';

export function DemoTreeProfile({ personId }: { personId: string }) {
  const { snapshot, workspace } = useFamily();
  const { people, connections } = demoTree(snapshot, workspace);
  const index = new Map(people.map((person) => [person.id, person]));
  const person = index.get(personId);
  if (!person) return <Redirect href="/family-tree" />;
  const links = connections.flatMap((link) => {
    const [a, b] = endpoints(link);
    const relative =
      a === personId ? index.get(b) : b === personId ? index.get(a) : undefined;
    return relative ? [{ link, relative }] : [];
  });
  return (
    <Screen>
      <ActionLink
        href="/family-tree"
        label="Back to Family Tree"
        variant="quiet"
        dismissTo
      />
      <PageHeading
        title={person.name}
        description={person.subtitle ?? 'Demo profile'}
      />
      <ActionLink
        href={{
          pathname: '/family-tree/add',
          params: { relativeTo: person.id },
        }}
        label="Add relative"
        icon="add"
      />
      <Card>
        <Type variant="heading" accessibilityRole="header">
          Relationships
        </Type>
        {!links.length && <Type tone="muted">No connections recorded.</Type>}
        {links.map(({ link, relative }) => (
          <ActionLink
            key={link.id}
            href={{
              pathname: '/family-tree/[personId]',
              params: { personId: relative.id },
            }}
            label={`${connectionLabel(link, personId)} · ${relative.name}`}
            variant="quiet"
          />
        ))}
      </Card>
    </Screen>
  );
}
