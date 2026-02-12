import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { TenderRegistryWithRelations, TenderStatus, ConstructionScope } from '../../../lib/supabase';

export const useTenderData = () => {
  const [tenders, setTenders] = useState<TenderRegistryWithRelations[]>([]);
  const [statuses, setStatuses] = useState<TenderStatus[]>([]);
  const [constructionScopes, setConstructionScopes] = useState<ConstructionScope[]>([]);
  const [tenderNumbers, setTenderNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTenders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tender_registry')
      .select('*, status:status_id(id, name), construction_scope:construction_scope_id(id, name)')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setTenders(data as TenderRegistryWithRelations[]);
    }
    setLoading(false);
  };

  const fetchStatuses = async () => {
    const { data } = await supabase.from('tender_statuses').select('*').order('name');
    setStatuses(data || []);
  };

  const fetchConstructionScopes = async () => {
    const { data } = await supabase.from('construction_scopes').select('*').order('name');
    setConstructionScopes(data || []);
  };

  const fetchTenderNumbers = async () => {
    const { data } = await supabase
      .from('tenders')
      .select('tender_number')
      .order('created_at', { ascending: false });

    const unique = Array.from(new Set(data?.map(t => t.tender_number) || []));
    setTenderNumbers(unique);
  };

  useEffect(() => {
    fetchTenders();
    fetchStatuses();
    fetchConstructionScopes();
    fetchTenderNumbers();
  }, []);

  return { tenders, statuses, constructionScopes, tenderNumbers, loading, refetch: fetchTenders };
};
