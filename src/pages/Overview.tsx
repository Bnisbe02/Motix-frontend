import { Clock, Server, Target, Radio, MessageSquare, BarChart3, CheckCircle2, Zap, Shield, TrendingUp } from 'lucide-react';

export default function Overview() {
  return (
    <div>
      {/* HERO */}
      <section className="py-20 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl font-black text-dark mb-8 leading-tight">
              Real-Time Radio Ad Verification for Modern Media Teams
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              MOTIX brings digital-grade transparency to Australian radio, verifying commercial playout in minutes and enabling agencies to optimise campaigns mid-flight - across both metro and regional markets.
            </p>
            <a
              href="#contact"
              className="inline-block bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:brightness-95 interactive-base mb-6"
            >
              Request Early Access
            </a>
            <p className="text-sm text-gray-500 italic">
              Engineered for nationwide scalability with architecture designed for international expansion.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT MOTIX DOES */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Real-Time Verification</h3>
              <p className="text-gray-600">
                AI-powered ingestion + transcription verifies commercial playout within minutes. Built for high confidence on national brand campaigns.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Engineered for Scale</h3>
              <p className="text-gray-600">
                Cloud-native architecture designed for metro and regional deployment, with a roadmap built for international markets.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-heading-3 text-dark mb-4">Built for Agencies</h3>
              <p className="text-gray-600">
                Designed by a former radio rep who processed thousands of post-time reports. Faster insights, fewer makegoods, and real-time optimisation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW MOTIX WORKS */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">How MOTIX Works</h2>
            <p className="text-xl text-gray-600">Four steps to verified radio ad monitoring</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Radio className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Ingest Audio</h3>
              <p className="text-gray-600 text-center">
                OTA feed or studio feed. Copyrighted audio automatically suppressed.
              </p>
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-primary transform -translate-y-1/2"></div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-6 mx-auto">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Transcribe in Real Time</h3>
              <p className="text-gray-600 text-center">
                Speech recognition tracks commercial content with voice-activity gating.
              </p>
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-primary transform -translate-y-1/2"></div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">AI Entity Detection</h3>
              <p className="text-gray-600 text-center">
                Brand names, product mentions, and identifiers extracted using semantic understanding.
              </p>
              <div className="hidden lg:block absolute right-[-1rem] top-1/2 w-8 h-0.5 bg-primary transform -translate-y-1/2"></div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-6 mx-auto">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3 text-center">Instant Verification</h3>
              <p className="text-gray-600 text-center">
                Spot-level playout verification delivered within minutes, not days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ACCURACY METRICS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">Accuracy That Delivers</h2>
            <p className="text-xl text-gray-600">
              Evidence from early pilot ingestion across national brands and regional content
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-lightPurple rounded-2xl p-12 text-center">
              <div className="text-6xl font-black text-primary mb-4">99.1%</div>
              <div className="text-xl font-semibold text-dark">Precision</div>
            </div>

            <div className="bg-lightPurple rounded-2xl p-12 text-center">
              <div className="text-6xl font-black text-primary mb-4">91.2%</div>
              <div className="text-xl font-semibold text-dark">Overall Accuracy</div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <p className="text-gray-600 text-center">
              Locally produced ads with softer CTAs or weaker brand identifiers can produce lower confidence scores. This is a natural characteristic of semantic AI systems that prioritise intent over acoustic matching.
            </p>
          </div>
        </div>
      </section>

      {/* FUTURE CAPABILITIES */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">BUILDING TO LISTEN - AND UNDERSTAND</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Beyond verification, MOTIX is developing semantic processing capabilities that transform radio monitoring into strategic intelligence.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Sentiment Scoring</h3>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Emotional Tone Mapping</h3>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Message Saturation Analysis</h3>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Competitive Narrative Insights</h3>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Natural-Language Chat-to-Database</h3>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Zap className="w-6 h-6 text-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-dark mb-1">Instant Insights</h3>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 border border-gray-200">
            <p className="text-xl text-gray-700 italic text-center">
              Ask MOTIX like you'd ask a network coordinator - and get answers in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* PRIVACY & COMPLIANCE */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Bullet Points */}
            <div>
              <h2 className="text-4xl font-bold text-dark mb-8">Privacy & Compliance by Design</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">MOTIX stores transcript-level data only</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">No copyrighted broadcast audio is stored or redistributed</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">All data encrypted at rest and in transit</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">No broadcaster integration required</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">No access to station playout logs</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green flex-shrink-0 mt-1" />
                  <p className="text-gray-700">No change to existing broadcaster workflows</p>
                </div>
              </div>
            </div>

            {/* Right: Quote Card */}
            <div className="bg-lightPurple border border-primary/20 rounded-2xl p-8">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <p className="text-xl text-gray-700 leading-relaxed">
                MOTIX operates as a passive, read-only system that requires no station integration and no interference with existing broadcast infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY AGENCIES USE MOTIX */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark mb-4">Why Agencies Use MOTIX</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-green/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Clock className="w-8 h-8 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3">Same-Day Optimisation</h3>
              <p className="text-gray-600">Make campaign adjustments in real time</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3">Independent Verification</h3>
              <p className="text-gray-600">Third-party validation of campaign delivery</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <TrendingUp className="w-8 h-8 text-green" />
              </div>
              <h3 className="text-heading-3 text-dark mb-3">Reduced Makegoods</h3>
              <p className="text-gray-600">Minimise campaign drift and delivery issues</p>
            </div>
          </div>

          {/* Founder Quote */}
          <div className="max-w-4xl mx-auto bg-white border border-gray-200 shadow-sm rounded-2xl p-8">
            <p className="text-xl text-gray-700 mb-6 leading-relaxed">
              After 13 years in radio, I've seen firsthand how slow verification limits what the medium can deliver. MOTIX gives radio the observability planners expect - without disrupting broadcaster workflows.
            </p>
            <p className="text-gray-600 font-semibold">- Brenton Nisbet, Founder</p>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
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
