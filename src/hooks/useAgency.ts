import { useAuth } from './useAuth';

/*
  Reads the agency id and user id from the signed-in user's JWT, the same way
  useBrandKit does. Central so every PCR page resolves tenancy identically.
*/

export interface AgencyContext {
  agencyId: string | null;
  userId: string | null;
  isLoading: boolean;
  /** Set when authentication finished but no agency_id claim is present. */
  error: string | null;
}

function readAgencyId(appMetadata: Record<string, unknown> | undefined): string | null {
  const raw = appMetadata?.agency_id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useAgency(): AgencyContext {
  const { user, isLoading } = useAuth();
  const agencyId = readAgencyId(user?.app_metadata);
  const userId = user?.id ?? null;

  return {
    agencyId,
    userId,
    isLoading,
    error: !isLoading && !agencyId ? 'No agency assigned to this account' : null,
  };
}
