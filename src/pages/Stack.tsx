import { Radio, MessageSquare, Target, Server, BarChart3, Shield } from 'lucide-react';
import StackCard from '../components/StackCard';

export default function Stack() {
  return (
    <div>
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-black text-[#191715] mb-6">How MOTIX Is Built</h1>
          <p className="text-xl text-gray-600">
            A transparent overview of the technology stack powering real-time radio ad verification.
          </p>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <StackCard
              icon={Radio}
              iconColor="green"
              title="Audio Ingestion"
              description="Live broadcast streams are ingested continuously. Voice-Activity Detection (VAD) gates silence and suppresses non-speech segments before transcription."
              tags={[
                'Icecast/HLS streams',
                'Silero VAD',
                'FFmpeg',
                '60s segmentation',
                'Real-time chunking',
              ]}
            />

            <StackCard
              icon={MessageSquare}
              iconColor="purple"
              title="Speech Recognition"
              description="Each audio chunk is transcribed using a fine-tuned Whisper model, optimised for Australian English and commercial radio vocabulary."
              tags={[
                'OpenAI Whisper (faster-whisper)',
                'Australian English optimisation',
                'Real-time transcription',
                '< 1x processing time',
              ]}
            />

            <StackCard
              icon={Target}
              iconColor="green"
              title="NER & Brand Detection"
              description="A custom NLP pipeline identifies brand names, product mentions, and commercial intent signals across 27,000+ known Australian advertisers."
              tags={[
                'spaCy EntityRuler',
                '27K+ brand gazetteer',
                'Custom NER pipeline',
                'Contextual classifiers',
                'Intent detection',
              ]}
            />

            <StackCard
              icon={Server}
              iconColor="purple"
              title="Infrastructure"
              description="Cloud-native, cost-optimised deployment built for Australian radio at national scale."
              tags={[
                'OVH Cloud VMs',
                'PostgreSQL',
                'systemd workers',
                'Prometheus + Grafana',
                '100+ stations monitored',
              ]}
            />

            <StackCard
              icon={BarChart3}
              iconColor="green"
              title="Reporting & API"
              description="Verified detections are stored and surfaced via a REST API, with CSV and PDF export, campaign-level filtering, and near real-time latency."
              tags={[
                'FastAPI',
                'PostgreSQL',
                'REST API',
                'CSV + PDF export',
                'Timezone-aware (AEST)',
              ]}
            />

            <StackCard
              icon={Shield}
              iconColor="purple"
              title="Privacy Architecture"
              description="Designed from day one to be passive, read-only, and non-intrusive. No broadcaster cooperation required."
              tags={[
                'Transcript-only storage',
                'No raw audio retention',
                'Encrypted at rest',
                'No broadcaster access required',
              ]}
            />
          </div>

          <div className="bg-[#E6E7FF] rounded-2xl p-8 border border-[#4131e0]/20 max-w-3xl mx-auto text-center">
            <p className="text-xl text-gray-700 leading-relaxed">
              MOTIX is not a fingerprinting system. It listens and understands - enabling a new tier
              of broadcast intelligence beyond simple spot matching.
            </p>
          </div>
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
