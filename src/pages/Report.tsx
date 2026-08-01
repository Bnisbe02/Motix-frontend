import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, Table, ChevronLeft, FileDown, AlertTriangle, Loader2 } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import ReportFilters from '../components/ReportFilters';
import ReportTable from '../components/ReportTable';
import ReportCharts from '../components/ReportCharts';
import { useSpotReport } from '../hooks/useSpotReport';
import { getCampaignById } from '../data/campaigns';
import {
  SpotReportResponse,
  ReportFilters as FilterType,
  ReportQueryParams,
} from '../types/report';

export default function Report() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = campaignId ? getCampaignById(campaignId) : undefined;

  const [filters, setFilters] = useState<FilterType>({
    brand: campaign?.clientName ?? '',
    station: 'All Stations',
    from: campaign?.startDate ?? '',
    to: campaign?.endDate ?? '',
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;
  const [reportData, setReportData] = useState<SpotReportResponse | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const { isLoading, isExportingCsv, isExportingPdf, error, fetchReport, exportCsv, exportPdf } =
    useSpotReport();

  const availableStations = useMemo(() => campaign?.stations ?? [], [campaign]);

  const handleRunReport = async (newFilters: FilterType): Promise<void> => {
    setFilters(newFilters);
    setCurrentPage(1);
    const data = await fetchReport({ ...newFilters, page: 1, pageSize });
    if (data) {
      setReportData(data);
    }
  };

  const handlePageChange = async (page: number): Promise<void> => {
    setCurrentPage(page);
    const data = await fetchReport({ ...filters, page, pageSize });
    if (data) {
      setReportData(data);
    }
  };

  const handleExportCsv = async (): Promise<void> => {
    await exportCsv({ ...filters, page: currentPage, pageSize });
  };

  const handleExportPdf = async (): Promise<void> => {
    await exportPdf({ ...filters, page: currentPage, pageSize });
  };

  const handleRetry = async (): Promise<void> => {
    const data = await fetchReport({ ...filters, page: currentPage, pageSize });
    if (data) {
      setReportData(data);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        {campaign && (
          <Link
            to={`/app/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1 text-body-sm text-gray-600 hover:text-[#4131e0] mb-5 interactive-base"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to {campaign.campaignName}
          </Link>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 hover-lift">
          <div className="border-b border-gray-200 px-8 py-5">
            <h1 className="text-heading-2 text-[#191715]">Aired Time Report</h1>
            <p className="text-body text-gray-600 mt-1.5">
              Filter and view verified detections from your monitoring session
            </p>
          </div>
          <div className="p-8">
            <ReportFilters
              initialFilters={filters}
              availableStations={availableStations}
              isLoading={isLoading}
              onSubmit={handleRunReport}
            />
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-amber-900 mb-1">
                  Report temporarily unavailable
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  This does not affect your data. Please try again shortly.
                </p>
                <p className="text-sm text-amber-700 mb-4">{error}</p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && reportData && reportData.data.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-heading-3 text-gray-900 mb-2">
                No detections in this range
              </h3>
              <p className="text-body text-gray-600 mb-6">
                Your filters returned zero results. This could mean the campaign hasn't aired yet, or these specific stations haven't broadcast your spots during the selected timeframe.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-left">
                <p className="text-body-sm text-blue-900 font-medium mb-2">Try adjusting:</p>
                <ul className="text-body-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Expand your date range</li>
                  <li>Select different stations or "All Stations"</li>
                  <li>Verify your campaign is currently active</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {reportData && reportData.data.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-5">
                <h2 className="text-heading-3 text-[#191715]">
                  {reportData.meta.total.toLocaleString()} verified detections
                </h2>

                <div className="bg-gray-100 rounded-lg p-1 flex">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-body-sm font-medium transition-all interactive-base ${
                      viewMode === 'table'
                        ? 'bg-white shadow-sm text-[#191715]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('chart')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-body-sm font-medium transition-all interactive-base ${
                      viewMode === 'chart'
                        ? 'bg-white shadow-sm text-[#191715]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Charts
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCsv}
                  disabled={isExportingCsv || isExportingPdf}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-body-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 interactive-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingCsv ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Export CSV
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={isExportingCsv || isExportingPdf}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-body-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 interactive-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Export PDF
                </button>
              </div>
            </div>

            {viewMode === 'table' ? (
              <ReportTable
                items={reportData.items}
                total={reportData.meta.total}
                currentPage={currentPage}
                pageSize={pageSize}
                isLoading={isLoading}
                onPageChange={handlePageChange}
              />
            ) : (
              <ReportCharts items={reportData.items} />
            )}
          </>
        )}

        {!reportData && !isLoading && !error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-[#4131e0]/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <BarChart3 className="w-8 h-8 text-[#4131e0]" />
              </div>
              <h3 className="text-heading-3 text-gray-900 mb-2">
                Ready to generate your report
              </h3>
              <p className="text-body text-gray-600 mb-6">
                Configure your filters above and click "Run Report" to view verified detections from the monitoring feed.
              </p>
              <div className="inline-flex items-center gap-2 text-body-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                Reports typically return results within 2-3 seconds
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
