import Layout from '../components/Layout';

export default function Privacy() {
  return (
    <Layout>
      <div className="py-16 bg-[#191715] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-heading-1">Privacy Policy</h1>
          <p className="text-body text-gray-400 mt-2">Last updated March 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Overview</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            MOTIX is an AI-powered radio advertising verification platform operated by Fibrecast Pty Ltd (ABN pending), trading as MOTIX. This policy describes how we collect, use, and protect information in connection with our platform and services. By accessing MOTIX, you agree to the practices described here.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Information We Collect</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            We collect information you provide directly — including name, email address, and company name when you request access or submit a contact form. When you use the MOTIX dashboard, we collect usage data including authentication logs, campaign queries, and report activity. We do not collect personal information from radio broadcast audio. Transcription data is processed to identify brand and advertiser activity only.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">How We Use Your Information</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            Your information is used to operate and improve the MOTIX platform, respond to enquiries, manage your account access, and provide verified campaign reporting. We do not sell your personal information to third parties. We do not use your data to serve advertising.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Data Storage and Security</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            Platform data is stored on infrastructure operated by Supabase (United States) and OVH Cloud (Australia/Europe). Authentication is managed via Supabase Auth with server-side JWT verification. All data in transit is encrypted via TLS. Access to production data is restricted to authorised Fibrecast personnel only.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Data Retention</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            Contact form submissions are retained for 12 months. Authentication logs are retained for 90 days. Campaign detection data is retained for the duration of your pilot agreement plus 30 days. You may request deletion of your data at any time by contacting us.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Your Rights</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            You have the right to access, correct, or request deletion of your personal information. To exercise these rights, contact us at beats@fibrecast.com.au. We will respond to all requests within 30 days.
          </p>
          <a
            href="/data-request"
            className="inline-flex items-center gap-2 mt-4 bg-[#4131e0] text-white px-5 py-2.5 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base"
          >
            Submit a Data Request →
          </a>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Cookies</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            MOTIX uses session cookies for authentication only. We do not use tracking cookies, advertising cookies, or third-party analytics cookies. Claude.ai products are ad-free.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Changes to This Policy</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            We may update this policy as the platform evolves. Material changes will be communicated via email to registered users. Continued use of MOTIX after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-heading-3 text-[#191715] mb-4">Contact</h2>
          <p className="text-body text-gray-600 leading-relaxed">
            For privacy enquiries: beats@fibrecast.com.au. For general enquiries about MOTIX: fibrecast.com.au.
          </p>
        </section>

        <div className="border-t border-gray-200 mt-12 pt-8">
          <p className="text-body-sm text-gray-500">
            MOTIX is a product of Fibrecast Pty Ltd. This platform is currently in private beta.
          </p>
        </div>
      </div>
    </Layout>
  );
}
