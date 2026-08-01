import { useState } from 'react';
import { ReportQueryParams, SpotReportResponse } from '../types/report';
import { supabase } from '../lib/supabase';

export interface UseSpotReportReturn {
  isLoading: boolean;
  isExportingCsv: boolean;
  isExportingPdf: boolean;
  error: string | null;
  fetchReport: (params: ReportQueryParams) => Promise<SpotReportResponse | null>;
  exportCsv: (params: ReportQueryParams) => Promise<void>;
  exportPdf: (params: ReportQueryParams) => Promise<void>;
}

function buildQueryString(params: ReportQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.append('brand', params.brand);
  searchParams.append('station', params.station);
  searchParams.append('from', params.from);
  searchParams.append('to', params.to);
  searchParams.append('page', params.page.toString());
  searchParams.append('pageSize', params.pageSize.toString());
  return searchParams.toString();
}

export function useSpotReport(): UseSpotReportReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (
    params: ReportQueryParams
  ): Promise<SpotReportResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(params);
      const response = await fetch(`/api/spots/report?${queryString}`, {
        headers: {
          Accept: 'application/json',
          'X-Client-Token': import.meta.env.VITE_CLIENT_TOKEN ?? '',
        },
      });

      if (response.status >= 500) {
        setError('Report service unavailable. Please try again shortly.');
        return null;
      }

      if (response.status === 401) {
        setError('Session expired. Please sign in again.');
        return null;
      }

      if (!response.ok) {
        setError('Unable to connect to MOTIX API. Please check your connection.');
        return null;
      }

      const data = await response.json();

      if (!data.meta || !Array.isArray(data.items)) {
        setError('Invalid response format from API.');
        return null;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('access_log')
            .insert({
              user_id: user.id,
              user_email: user.email ?? 'unknown',
              event_type: 'report_access',
              resource: 'spot_report',
              metadata: {
                brand: params.brand ?? null,
                station: params.station ?? null,
                from: params.from ?? null,
                to: params.to ?? null,
                page: params.page ?? 1,
                result_count: data.items?.length ?? 0,
              },
              ip_address: null,
              user_agent: navigator.userAgent,
            });
        }
      } catch {
        // Audit log failure must never surface to the user
      }

      return data as SpotReportResponse;
    } catch (err) {
      setError('Unable to connect to MOTIX API. Please check your connection.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const exportCsv = async (params: ReportQueryParams): Promise<void> => {
    setIsExportingCsv(true);
    setError(null);

    try {
      const queryString = buildQueryString(params);
      const response = await fetch(`/api/spots/report/export/csv?${queryString}`, {
        headers: {
          Accept: 'text/csv',
          'X-Client-Token': import.meta.env.VITE_CLIENT_TOKEN ?? '',
        },
      });

      if (!response.ok) {
        setError('Failed to export CSV. Please try again.');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `motix-report-${params.from}-to-${params.to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export CSV. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const exportPdf = async (params: ReportQueryParams): Promise<void> => {
    setIsExportingPdf(true);
    setError(null);

    try {
      const queryString = buildQueryString(params);
      const response = await fetch(`/api/spots/report/export/pdf?${queryString}`, {
        headers: {
          Accept: 'application/pdf',
          'X-Client-Token': import.meta.env.VITE_CLIENT_TOKEN ?? '',
        },
      });

      if (!response.ok) {
        setError('Failed to export PDF. Please try again.');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `motix-report-${params.from}-to-${params.to}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return {
    isLoading,
    isExportingCsv,
    isExportingPdf,
    error,
    fetchReport,
    exportCsv,
    exportPdf,
  };
}
