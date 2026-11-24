import type { BackendClient } from '@/lib/supabase';
import {
  createHistoricalSearch,
  ProviderError,
  recordSchema,
  type GenealogyProvider,
} from '@/features/discovery/historicalSearch';

export type ResearchAction = 'save' | 'attach' | 'reject' | 'hypothesis';
export type Hypothesis = 'parent' | 'child' | 'partner';

export function fictionalProvider(client: BackendClient): GenealogyProvider {
  return {
    id: 'fictional-archive',
    name: 'Fictional Archive',
    terms: { cache: 'none', allowSaving: true },
    async search(query) {
      const { data, error } = await client.rpc(
        'search_fictional_historical_records',
        {
          p_name: query.name,
          p_place: query.place,
          p_from: query.from,
          p_to: query.to,
          p_type: query.type,
        },
      );
      if (error?.code === 'P0001')
        throw new ProviderError('Search limit reached. Try again in a minute.');
      if (error) throw error;
      return data;
    },
  };
}

export function createResearchRepository(client: BackendClient) {
  return {
    search: createHistoricalSearch([fictionalProvider(client)]),
    async saved(tree: string) {
      const { data, error } = await client
        .from('research_findings')
        .select(
          'id,record,research_matches(person_id,status,related_person_id,hypothesis)',
        )
        .eq('tree_id', tree)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map(({ record, id, research_matches }) => ({
        id,
        record: recordSchema.parse(record),
        matches: research_matches,
      }));
    },
    async update(
      tree: string,
      provider: string,
      record: string,
      action: ResearchAction,
      person?: string,
      related?: string,
      hypothesis?: Hypothesis,
    ) {
      if (provider !== 'fictional-archive')
        throw new Error('Saving for this provider is unavailable.');
      const { error } = await client.rpc('update_fictional_research', {
        p_tree: tree,
        p_record: record,
        p_action: action,
        p_person: person,
        p_related: related,
        p_hypothesis: hypothesis,
      });
      if (error) throw error;
    },
  };
}
export type ResearchRepository = ReturnType<typeof createResearchRepository>;
