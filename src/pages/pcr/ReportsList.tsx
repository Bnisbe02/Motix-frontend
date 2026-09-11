import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Loader2, AlertCircle } from 'lucide-react';
import AppHeader from '../../components/AppHeader';
import { usePcrReports } from '../../hooks/usePcrReports';
import { PcrReport, ReportStatus } from '../../types/pcr';

/*
  Reports index at /app/reports — lists the agency's Post-Campaign Reports.
*/

const STATUS_STYLE: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  generated: 'bg-blue-100 text-blue-700',
  exported: 'bg-green-100 text-green-700',
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReportsList() {
  const navigate = useNavigate();
  const { reports, isLoading, error } = usePcrReports();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#191715]">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Post-campaign reports for your agency.</p>
          </div>
          <button
            onClick={() => navigate('/app/reports/new')}
            className="bg-[#4131e0] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#4131e0]/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New report
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" /> Loading reports…
          </div>
        ) : reports.length === 0 && !error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">No reports yet.</p>
            <button
              onClick={() => navigate('/app/reports/new')}
              className="bg-[#4131e0] text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#4131e0]/90"
            >
              <Plus className="w-4 h-4" /> Create your first report
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Advertiser</th>
                  <th className="text-left px-4 py-3 font-medium">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium">Dates</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: PcrReport) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/app/reports/${r.id}`)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-[#191715]">{r.advertiser}</td>
                    <td className="px-4 py-3 text-gray-700">{r.campaign_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(r.date_from)} – {formatDate(r.date_to)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
