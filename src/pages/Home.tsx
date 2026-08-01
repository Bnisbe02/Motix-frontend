import { Clock, Globe, TrendingUp, Radio, MessageSquare, Target, BarChart3, CheckCircle2, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div>
      {/* HERO SECTION */}
      <section className="py-20 sm:py-32 bg-gradient-to-br from-[#4131e0]/5 via-white to-[#191715]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#191715] mb-8 leading-tight">
              REAL-TIME RADIO AD VERIFICATION, BUILT FOR NATIONAL SCALE
            </h1>
            <p className="text-xl text-gray-600 font-light mb-12 max-w-4xl mx-auto leading-relaxed">
              MOTIX brings digital-grade transparency to Australian radio, accelerating the campaign visibility networks have always provided, but now in minutes, not days. Optimise campaigns mid-flight across metro and regional markets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#contact"
                className="bg-[#4131e0] text-white px-8 py-4 rounded-lg text-lg font-semibold hover:brightness-95 interactive-base"
              >
                Request Early Access
              </a>
              <a
                href="#features"
                className="border-2 border-[#4131e0] text-[#4131e0] px-8 py-4 rounded-lg text-lg font-semibold hover:bg-[#4131e0] hover:text-white interactive-base"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPS SECTION */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-[#00d76f]/10 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Real-Time Verification</h3>
              <p className="text-gray-600">
                AI-powered detection delivers verified spot playout within minutes.
              </p>
            </div>

            {/* Card 2 */}
            <div className="shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-[#00d76f]/10 rounded-xl flex items-center justify-center mb-6">
                <Globe className="w-6 h-6 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Engineered for National Scalability</h3>
              <p className="text-gray-600">
                Cloud-native architecture built to scale efficiently across metro and regional Australia.
              </p>
            </div>

            {/* Card 3 */}
            <div className="shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-[#00d76f]/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Optimisation Like Digital</h3>
              <p className="text-gray-600">
                Make mid-flight adjustments with real-time campaign performance insight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="py-12 bg-[#4131e0] text-white text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold mb-8">
            BRING REAL-TIME VISIBILITY TO YOUR RADIO CAMPAIGNS
          </h2>
          <a
            href="#contact"
            className="inline-block bg-white text-[#4131e0] px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 interactive-base"
          >
            Request Early Access
          </a>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Four steps to verified radio ad monitoring</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-[#00d76f] rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Radio className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Ingest Audio</h3>
              <p className="text-gray-600 text-center">OTA or studio feed</p>
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-[#00d76f] transform -translate-y-1/2"></div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-[#00d76f] rounded-xl flex items-center justify-center mb-6 mx-auto">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Transcribe in Real Time</h3>
              <p className="text-gray-600 text-center">AI-powered speech recognition</p>
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-[#00d76f] transform -translate-y-1/2"></div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-[#00d76f] rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">AI Entity + Intent Detection</h3>
              <p className="text-gray-600 text-center">Semantic understanding</p>
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-[#00d76f] transform -translate-y-1/2"></div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-[#00d76f] rounded-xl flex items-center justify-center mb-6 mx-auto">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Instant Verification & Reporting</h3>
              <p className="text-gray-600 text-center">Minutes, not days</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE SECTION */}
      <section id="platform" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">Built for Performance</h2>
            <p className="text-xl text-gray-600">
              Professional-grade campaign monitoring and analytics
            </p>
          </div>

          <div className="space-y-16">
            {/* Campaign Dashboard */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-dark mb-4">Live Campaign Monitoring</h3>
                <p className="text-lg text-gray-600 mb-6">
                  Track spot delivery, daypart compliance, and share of voice across all monitored stations. Get instant alerts when campaigns need attention.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Real-time campaign status updates</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Automated daypart violation detection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Multi-campaign oversight dashboard</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
                <img
                  src="/Screenshot_2026-03-15_161009.png"
                  alt="Campaign monitoring dashboard"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Campaign Details */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 rounded-xl overflow-hidden shadow-2xl border border-gray-200">
                <img
                  src="/Screenshot_2026-03-15_161032.png"
                  alt="Campaign analytics detail view"
                  className="w-full h-auto"
                />
              </div>
              <div className="order-1 md:order-2">
                <h3 className="text-3xl font-bold text-dark mb-4">Deep Campaign Analytics</h3>
                <p className="text-lg text-gray-600 mb-6">
                  Drill into individual campaigns for verified spot playout, hourly distribution analysis, and competitive benchmarking.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Hourly playout visualization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Share of voice tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Compliance breach alerts</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Reporting */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-dark mb-4">Flexible Reporting</h3>
                <p className="text-lg text-gray-600 mb-6">
                  Generate custom aired time reports filtered by brand, station, and date range. Export verified detection data for reconciliation and invoicing.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Multi-dimensional filtering</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Quick date range selection</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">Export-ready data formats</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
                <img
                  src="/Screenshot_2026-03-15_161110.png"
                  alt="Reporting interface"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACCURACY SECTION */}
      <section id="accuracy" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">Accuracy That Delivers</h2>
            <p className="text-xl text-gray-600">
              Evidence from early pilot ingestion across national brands and regional content
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Precision */}
            <div className="bg-[#E6E7FF] rounded-2xl p-12 text-center">
              <div className="text-6xl font-black text-[#4131e0] mb-4">99.1%</div>
              <div className="text-xl font-semibold text-dark">Precision</div>
            </div>

            {/* Overall Accuracy */}
            <div className="bg-[#E6E7FF] rounded-2xl p-12 text-center">
              <div className="text-6xl font-black text-[#4131e0] mb-4">91.2%</div>
              <div className="text-xl font-semibold text-dark">Overall Accuracy</div>
            </div>
          </div>
        </div>
      </section>

      {/* FUTURE CAPABILITIES */}
      <section id="future" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">BUILDING TO LISTEN - AND UNDERSTAND</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Beyond verification, MOTIX is developing semantic processing capabilities that transform radio monitoring into strategic intelligence.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Capability 1 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Sentiment Scoring</h3>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Emotional Tone Mapping</h3>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Message Saturation Analysis</h3>
              </div>
            </div>

            {/* Capability 4 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Competitive Narrative Insights</h3>
              </div>
            </div>

            {/* Capability 5 */}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Natural-Language Chat-to-Database</h3>
              </div>
            </div>

            {/* Capability 6 */}
            <div className="flex items-start gap-3">
              <Zap className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Instant Insights</h3>
              </div>
            </div>
          </div>

          {/* Chat Interface Screenshot */}
          <div className="max-w-4xl mx-auto mb-12 rounded-xl overflow-hidden shadow-2xl border border-gray-200">
            <img
              src="/Screenshot_2026-03-15_161139.png"
              alt="Natural language chat interface"
              className="w-full h-auto"
            />
          </div>

          {/* Quote Box */}
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 border border-[#E4E7EC]">
            <p className="text-xl text-gray-700 italic text-center">
              Ask MOTIX like you'd ask a network coordinator - and get answers in seconds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
