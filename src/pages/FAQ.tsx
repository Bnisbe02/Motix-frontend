import FAQCategory from '../components/FAQCategory';

export default function FAQ() {
  const agencyQuestions = [
    {
      question: 'What does MOTIX actually do?',
      answer:
        'MOTIX verifies radio advertising playout in near real time. It ingests live broadcast audio, transcribes it, identifies brands and commercial intent, and logs verified spots within minutes - enabling same-day optimisation and reducing makegoods.',
    },
    {
      question: 'Does MOTIX only work with metro stations?',
      answer:
        'No. MOTIX is engineered for nationwide scalability, including metro and regional markets. Its cloud-native design enables cost-effective deployment across Australia and future international markets.',
    },
    {
      question: 'Can MOTIX show me every spot in real time?',
      answer:
        'For national brand campaigns with strong brand signals, MOTIX reliably detects and verifies ads within minutes. Locally produced ads with very soft CTAs or minimal brand identifiers may produce lower confidence scores - a natural limitation of semantic AI systems. We explain this in detail in the Accuracy section below.',
    },
    {
      question: 'Can I optimise campaigns mid-flight?',
      answer:
        "Yes, while MOTIX can't help you optimise, it can give you the insights to work with networks that you may have missed in the old world. MOTIX enables agencies to see under-delivery or daypart drift in-time to adjust creative, placements, or rotations within the same campaign window.",
    },
    {
      question: 'Does this replace my Post-Time Reports?',
      answer:
        'MOTIX supplements, not replaces, station logs. It gives planners independent, near real-time observability, while traditional logs remain the final source of truth.',
    },
  ];

  const accuracyQuestions = [
    {
      question: "What is MOTIX's accuracy?",
      answer: (
        <div>
          <p className="mb-3">Early pilot ingestion across national brands shows:</p>
          <ul className="list-disc ml-6 space-y-2 mb-3">
            <li>99.1% Precision (verified spots are real)</li>
            <li>91.2% Overall Accuracy</li>
          </ul>
          <p>
            Higher brand-signal environments (national advertisers, strong CTAs) consistently deliver
            strong model performance.
          </p>
        </div>
      ),
    },
    {
      question: 'What affects detection confidence?',
      answer:
        'Ads with explicit brand mentions, clear product names, or strong call-to-action language produce the highest confidence scores. Locally-produced ads with very soft language or minimal brand identifiers may fall below the detection threshold. This is by design - MOTIX prioritises not logging false positives, which would create billing disputes.',
    },
    {
      question: 'How does MOTIX handle music or news content?',
      answer:
        'MOTIX uses voice-activity detection and content classification to separate commercial segments from non-commercial content. Music beds and presenter talk are filtered at the ingestion layer. News content is deprioritised in the detection pipeline.',
    },
  ];

  const technicalQuestions = [
    {
      question: "Does MOTIX need access to the station's systems?",
      answer:
        'No. MOTIX is entirely passive. It ingests publicly available broadcast streams or feeds provided voluntarily. No station integration, no API access to playout systems, and no changes to existing broadcaster infrastructure are required.',
    },
    {
      question: 'How is the audio data handled?',
      answer:
        'MOTIX transcribes audio in real time and stores transcript-level data only. No raw broadcast audio is retained beyond the processing window. All data is encrypted at rest and in transit.',
    },
    {
      question: 'What feed types does MOTIX support?',
      answer:
        'MOTIX currently supports internet streams (HLS/Icecast), with OTA feed ingestion available for stations that provide a direct signal. Studio feeds are also supported for networks that choose to participate.',
    },
    {
      question: 'How fast is the verification?',
      answer:
        'Detection typically completes within 1-3 minutes of a spot airing, depending on audio processing load and stream latency.',
    },
  ];

  const commercialQuestions = [
    {
      question: 'How is MOTIX priced?',
      answer:
        'MOTIX is currently in a structured pilot phase. Pricing is modelled as a percentage of verified media spend - aligning our incentives directly with accurate delivery. Exact terms are discussed with each agency partner.',
    },
    {
      question: 'Can I get early access?',
      answer:
        "Yes. We're onboarding a small number of agency partners for our initial pilot. Submit your details via the contact form and we'll be in touch within 2 business days.",
    },
    {
      question: 'Is MOTIX available for regional campaigns?',
      answer:
        'Yes. Regional market coverage is a core design goal, not an afterthought. MOTIX is built to run efficiently on regional stations - including low-population markets where programmatic data is weakest.',
    },
  ];

  return (
    <div>
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-bold text-dark mb-6 text-center">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-600 text-center mb-16">
            Find answers to common questions about MOTIX and our services.
          </p>

          <FAQCategory title="For Agencies & Media Buyers" questions={agencyQuestions} />
          <FAQCategory title="Accuracy & Performance" questions={accuracyQuestions} />
          <FAQCategory title="Technical & Integration" questions={technicalQuestions} />
          <FAQCategory title="Commercial & Access" questions={commercialQuestions} />
        </div>
      </section>

      <section className="py-20 bg-primary text-white text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold mb-8">
            BRING REAL-TIME VISIBILITY TO YOUR RADIO CAMPAIGNS
          </h2>
          <a
            href="#contact"
            className="inline-block bg-white text-primary px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all"
          >
            Request Early Access
          </a>
        </div>
      </section>
    </div>
  );
}
