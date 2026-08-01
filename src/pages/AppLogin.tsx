import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function AppLogin() {
  const { isAuthenticated, loginWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/campaigns');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const result = await loginWithEmail(email, password);

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/app`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccessMessage('Password reset link sent! Check your email.');
      setShowForgotPassword(false);
      setResetEmail('');
    }

    setIsSubmitting(false);
  };

  const handleGoogleLogin = async (): Promise<void> => {
    setIsGoogleLoading(true);
    await loginWithGoogle();
    setIsGoogleLoading(false);
  };

  const handleCancelForgotPassword = (): void => {
    setShowForgotPassword(false);
    setError(null);
    setResetEmail('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#00d76f] tracking-tight">MOTIX</h1>
          <p className="text-[9px] font-semibold tracking-widest text-[#191715] -mt-1">
            WE HEARD THAT
          </p>
          <p className="text-sm text-gray-500 mt-3">Agency Dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">
            {successMessage}
          </div>
        )}

        {showForgotPassword ? (
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="reset-email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isSubmitting}
              className="w-full bg-[#4131e0] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 transition-all"
            >
              {isSubmitting ? 'Sending reset link...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={handleCancelForgotPassword}
              className="w-full text-sm text-[#4131e0] hover:underline font-medium"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] focus:border-transparent"
              placeholder="Enter your password"
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#4131e0] text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 transition-all"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="w-full text-sm text-gray-600 hover:text-[#4131e0] font-medium"
          >
            Forgot password?
          </button>
        </form>
        )}

        {!showForgotPassword && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border-2 border-gray-200 rounded-xl hover:border-[#4131e0] hover:bg-[#4131e0]/5 transition-all font-semibold text-[#191715] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{isGoogleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
            </button>
          </>
        )}

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            Access is restricted to approved agency accounts.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Contact beats@fibrecast.com.au to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
