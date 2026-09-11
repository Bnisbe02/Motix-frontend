import { useState, useEffect, useCallback } from 'react';
import { PcrReport } from '../types/pcr';
import { listReports } from '../lib/pcrApi';
import { useAgency } from './useAgency';

/*
  Lists the agency's PCR reports for the reports index page. Read relies on
  RLS; the hook only queries once an agency claim is present. Never throws.
*/

export interface UsePcrReportsResult {
  reports: PcrReport[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function usePcrReports(): UsePcrReportsResult {
  const { agencyId, isLoading: authLoading, error: agencyError } = useAgency();
  const [reports, setReports] = useState<PcrReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const rows = await listReports();
      setReports(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!agencyId) {
      setError(agencyError);
      setReports([]);
      setIsLoading(false);
      return;
    }
    void load();
  }, [authLoading, agencyId, agencyError, load]);

  return { reports, isLoading: authLoading || isLoading, error, reload: load };
}
