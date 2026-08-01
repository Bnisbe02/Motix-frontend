import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AccessPending() {
  const navigate = useNavigate();

  const handleBackToLogin = (): void => {
    navigate('/app');
  };

  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        {/* MOTIX Logo */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#00d76f] tracking-tight">MOTIX</h1>
          <p className="text-[9px] font-semibold tracking-widest text-[#191715] -mt-1">
            WE HEARD THAT
          </p>
        </div>

        {/* Clock Icon */}
        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Clock className="w-7 h-7 text-amber-500" />
        </div>

        {/* Heading */}
        <h2 className="text-heading-3 text-[#191715] mb-2">Access Pending</h2>

        {/* Description */}
        <p className="text-body-sm text-gray-600 leading-relaxed mb-6">
          Your account has been received. The MOTIX pilot is currently invitation-only — our
          team will be in touch once your access has been confirmed.
        </p>

        {/* Contact Block */}
        <div className="bg-[#E6E7FF] rounded-lg p-4 mb-6">
          <p className="text-label text-[#4131e0] mb-1">GET IN TOUCH</p>
          <a
            href="mailto:beats@fibrecast.com.au"
            className="text-body-sm text-[#4131e0] hover:underline font-medium"
          >
            beats@fibrecast.com.au
          </a>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 w-full">
          <button
            onClick={handleBackToLogin}
            className="w-full bg-[#4131e0] text-white py-2.5 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base"
          >
            Back to Login
          </button>
          <button
            onClick={handleSignOut}
            className="w-full border border-gray-200 text-body-sm font-medium text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 interactive-base"
          >
            Try a different account
          </button>
        </div>
      </div>
    </div>
  );
}
