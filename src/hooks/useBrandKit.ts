import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  BrandKit,
  BrandKitInput,
  BrandAssetKind,
  BRAND_ASSETS_BUCKET,
} from '../types/pcr';

/*
  Brand kit hook.

  - Reads the agency id from the JWT app_metadata.agency_id claim (via
    useAuth). Without it nothing is queried and `error` explains why.
  - `save` upserts on agency_id, so the first save creates the row.
  - `uploadAsset` writes to brand-assets/<agency_id>/<kind>.<ext> and then
    persists the path on the kit. RLS on storage.objects requires the first
    path segment to equal the agency id.
  - `getAssetUrl` mints a 1-hour signed URL (the bucket is private).
  - Nothing here throws to the caller: every operation returns a result
    object and the hook surfaces `error` as state.
*/

const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_ASSET_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
};

const ALLOWED_EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  svg: 'svg',
};

const KIND_TO_COLUMN: Record<BrandAssetKind, 'logo_light_path' | 'logo_dark_path' | 'cover_image_path'> = {
  logo_light: 'logo_light_path',
  logo_dark: 'logo_dark_path',
  cover_image: 'cover_image_path',
};

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface UseBrandKitResult {
  /** The saved kit, or null when the agency has not saved one yet. */
  brandKit: BrandKit | null;
  agencyId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  save: (partial: BrandKitInput) => Promise<SaveResult>;
  uploadAsset: (file: File, kind: BrandAssetKind) => Promise<UploadResult>;
  removeAsset: (kind: BrandAssetKind) => Promise<SaveResult>;
  getAssetUrl: (path: string | null | undefined) => Promise<string | null>;
  reload: () => Promise<void>;
}

/** Resolve the file extension we will store, or null if the file is not allowed. */
export function resolveAssetExtension(file: File): string | null {
  const byMime = ALLOWED_ASSET_TYPES[file.type];
  if (byMime) {
    return byMime;
  }
  const dot = file.name.lastIndexOf('.');
  if (dot === -1) {
    return null;
  }
  const ext = file.name.slice(dot + 1).toLowerCase();
  return ALLOWED_EXTENSIONS[ext] ?? null;
}

/** Validate an asset before upload. Returns an error message or null when OK. */
export function validateBrandAsset(file: File): string | null {
  if (resolveAssetExtension(file) === null) {
    return 'Only PNG, JPG or SVG files are accepted.';
  }
  if (file.size > MAX_ASSET_BYTES) {
    return 'File is too large. Maximum size is 2 MB.';
  }
  return null;
}

function readAgencyId(appMetadata: Record<string, unknown> | undefined): string | null {
  const raw = appMetadata?.agency_id;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useBrandKit(): UseBrandKitResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const agencyId = readAgencyId(user?.app_metadata);

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!agencyId) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('agency_id', agencyId)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
        setBrandKit(null);
      } else {
        setError(null);
        setBrandKit((data as BrandKit | null) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand kit');
      setBrandKit(null);
    } finally {
      setIsLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!agencyId) {
      setError('No agency assigned to this account');
      setBrandKit(null);
      setIsLoading(false);
      return;
    }

    void load();
  }, [agencyId, isAuthLoading, load]);

  const save = useCallback(
    async (partial: BrandKitInput): Promise<SaveResult> => {
      if (!agencyId) {
        const message = 'No agency assigned to this account';
        setError(message);
        return { success: false, error: message };
      }

      setIsSaving(true);
      try {
        const { data, error: upsertError } = await supabase
          .from('brand_kits')
          .upsert({ ...partial, agency_id: agencyId }, { onConflict: 'agency_id' })
          .select('*')
          .single();

        if (upsertError) {
          setError(upsertError.message);
          return { success: false, error: upsertError.message };
        }

        setBrandKit(data as BrandKit);
        setError(null);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save brand kit';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [agencyId]
  );

  const uploadAsset = useCallback(
    async (file: File, kind: BrandAssetKind): Promise<UploadResult> => {
      if (!agencyId) {
        const message = 'No agency assigned to this account';
        setError(message);
        return { success: false, error: message };
      }

      const validationError = validateBrandAsset(file);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const ext = resolveAssetExtension(file) as string;
      // Path MUST start with the agency id — storage RLS checks the first folder segment.
      const path = `${agencyId}/${kind}.${ext}`;

      setIsSaving(true);
      try {
        const { error: uploadError } = await supabase.storage
          .from(BRAND_ASSETS_BUCKET)
          .upload(path, file, {
            upsert: true,
            cacheControl: '0',
            contentType: file.type || undefined,
          });

        if (uploadError) {
          setError(uploadError.message);
          return { success: false, error: uploadError.message };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsSaving(false);
      }

      const saved = await save({ [KIND_TO_COLUMN[kind]]: path });
      if (!saved.success) {
        return { success: false, error: saved.error };
      }

      return { success: true, path };
    },
    [agencyId, save]
  );

  const removeAsset = useCallback(
    async (kind: BrandAssetKind): Promise<SaveResult> => {
      const column = KIND_TO_COLUMN[kind];
      const currentPath = brandKit?.[column] ?? null;

      if (currentPath) {
        try {
          // Best effort: a stale object is harmless, the DB path is the source of truth.
          await supabase.storage.from(BRAND_ASSETS_BUCKET).remove([currentPath]);
        } catch {
          /* ignore */
        }
      }

      return save({ [column]: null });
    },
    [brandKit, save]
  );

  const getAssetUrl = useCallback(
    async (path: string | null | undefined): Promise<string | null> => {
      if (!path) {
        return null;
      }
      try {
        const { data, error: signError } = await supabase.storage
          .from(BRAND_ASSETS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

        if (signError || !data?.signedUrl) {
          return null;
        }
        return data.signedUrl;
      } catch {
        return null;
      }
    },
    []
  );

  return {
    brandKit,
    agencyId,
    isLoading: isAuthLoading || isLoading,
    isSaving,
    error,
    save,
    uploadAsset,
    removeAsset,
    getAssetUrl,
    reload: load,
  };
}
