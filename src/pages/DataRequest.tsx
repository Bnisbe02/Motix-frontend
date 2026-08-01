import { useState } from 'react';
import { FileText, Trash2, CreditCard as Edit3 } from 'lucide-react';
import Layout from '../components/Layout';

export default function DataRequest() {
  const [requestType, setRequestType] = useState<'access' | 'deletion' | 'correction'>('access');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestTypeChange = (type: 'access' | 'deletion' | 'correction'): void => {
    setRequestType(type);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setName(e.target.value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handleDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setDetails(e.target.value);
  };

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: requestType, name, email, details }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Submission failed. Please try again.');
      } else {
        setIsSubmitted(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setIsSubmitting(false);
  };

  const requestTypes = [
    {
      type: 'access' as const,
      icon: FileText,
      title: 'Access My Data',
      description: 'Request a copy of your personal information',
    },
    {
      type: 'deletion' as const,
      icon: Trash2,
      title: 'Delete My Data',
      description: 'Request deletion of your personal information',
    },
    {
      type: 'correction' as const,
      icon: Edit3,
      title: 'Correct My Data',
      description: 'Request correction of inaccurate information',
    },
  ];

  const referenceNumber = Date.now().toString(36).toUpperCase();

  return (
    <Layout>
      <div className="py-16 bg-[#191715] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-heading-1">Data Rights Request</h1>
          <p className="text-body text-gray-400 mt-2">
            Submit a request to access, correct, or delete your personal information
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isSubmitted ? (
          <div className="bg-[#E6E7FF] rounded-xl p-8 text-center">
            <h2 className="text-heading-3 text-[#191715]">Request Received</h2>
            <p className="text-body text-gray-600 mt-2">
              We will respond to your request within 30 days at the email address you provided.
            </p>
            <p className="text-label text-gray-500 mt-4">Reference: {referenceNumber}</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-heading-3 text-[#191715] mb-4">Select Request Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {requestTypes.map(({ type, icon: Icon, title, description }) => {
                  const isActive = requestType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleRequestTypeChange(type)}
                      className={`p-6 rounded-lg text-left transition-all interactive-base ${
                        isActive
                          ? 'border-2 border-[#4131e0] bg-[#E6E7FF]'
                          : 'border-2 border-gray-200 hover:border-[#4131e0]/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-3 ${isActive ? 'text-[#4131e0]' : 'text-gray-400'}`} />
                      <h3 className="text-body-sm font-semibold text-[#191715] mb-1">{title}</h3>
                      <p className="text-label text-gray-600">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
              <h2 className="text-heading-3 text-[#191715]">Your Information</h2>

              <div>
                <label htmlFor="name" className="block text-label text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-label text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="details" className="block text-label text-gray-700 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  id="details"
                  value={details}
                  onChange={handleDetailsChange}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  placeholder="Provide any additional context for your request..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-body-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !name || !email}
                className="w-full bg-[#4131e0] text-white py-3 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>

              <p className="text-label text-gray-500 text-center">
                We will respond to your request within 30 days as required by privacy law.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
