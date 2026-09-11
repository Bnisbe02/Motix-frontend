import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Station } from '../types/pcr';

/*
  Station registry hook.

  The registry is small and effectively static, so it is fetched once per
  page load and cached in module scope. Every component that calls
  useStations() shares the same request and the same result.
*/

let cachedStations: Station[] | null = null;
let inflight: Promise<Station[]> | null = null;

async function fetchStations(): Promise<Station[]> {
  if (cachedStations) {
    return cachedStations;
  }

  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('network', { ascending: true, nullsFirst: false })
        .order('display_name', { ascending: true });

      if (error) {
        inflight = null;
        throw new Error(error.message);
      }

      cachedStations = (data ?? []) as Station[];
      return cachedStations;
    })();
  }

  return inflight;
}

/** Drop the module cache (e.g. after an admin edits the registry). */
export function invalidateStationsCache(): void {
  cachedStations = null;
  inflight = null;
}

export interface UseStationsResult {
  stations: Station[];
  byCallsign: Record<string, Station>;
  isLoading: boolean;
  error: string | null;
}

export function useStations(): UseStationsResult {
  const [stations, setStations] = useState<Station[]>(cachedStations ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(cachedStations === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchStations()
      .then((rows) => {
        if (mounted) {
          setStations(rows);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load stations');
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const byCallsign = stations.reduce<Record<string, Station>>((acc, station) => {
    acc[station.callsign] = station;
    return acc;
  }, {});

  return { stations, byCallsign, isLoading, error };
}
