export interface SpotReportMeta {
  brand: string;
  station: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
}

export interface SpotReportItem {
  ts_utc: string;
  station: string;
  brand: string;
  creative_id: string;
  duration_sec: number;
  confidence: number;
}

export interface SpotReportResponse {
  meta: SpotReportMeta;
  items: SpotReportItem[];
}

export interface ReportFilters {
  brand: string;
  station: string;
  from: string;
  to: string;
}

export interface ReportQueryParams extends ReportFilters {
  page: number;
  pageSize: number;
}
