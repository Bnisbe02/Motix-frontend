import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Overview from './pages/Overview';
import FAQ from './pages/FAQ';
import Stack from './pages/Stack';
import AppLogin from './pages/AppLogin';
import AuthCallback from './pages/AuthCallback';
import AccessPending from './pages/AccessPending';
import Privacy from './pages/Privacy';
import Campaigns from './pages/Campaigns';
import CampaignDashboard from './pages/CampaignDashboard';
import CampaignSettings from './pages/CampaignSettings';
import Report from './pages/Report';
import ChatSearch from './pages/ChatSearch';
import AdminAuditLog from './pages/AdminAuditLog';
import DataRequest from './pages/DataRequest';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/overview" element={<Layout><Overview /></Layout>} />
        <Route path="/faq" element={<Layout><FAQ /></Layout>} />
        <Route path="/stack" element={<Layout><Stack /></Layout>} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/app" element={<AppLogin />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/app/access-pending" element={<AccessPending />} />
        <Route
          path="/app/campaigns"
          element={
            <ProtectedRoute>
              <Campaigns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/campaigns/:campaignId"
          element={
            <ProtectedRoute>
              <CampaignDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/campaigns/:campaignId/settings"
          element={
            <ProtectedRoute>
              <CampaignSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/campaigns/:campaignId/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/chat"
          element={
            <ProtectedRoute>
              <ChatSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute>
              <AdminAuditLog />
            </ProtectedRoute>
          }
        />
        <Route path="/data-request" element={<Layout><DataRequest /></Layout>} />
        <Route path="/app/dashboard" element={<Navigate to="/app/campaigns" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
