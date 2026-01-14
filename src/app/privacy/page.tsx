'use client';

/**
 * Privacy Policy Page
 */

import { SiteHeader } from '@/components/layout';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: January 2026</p>

        <div className="space-y-5 text-sm">
          <section>
            <h2 className="text-base font-semibold mb-2">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect the following types of information to provide and improve our services:
            </p>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Account Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Email address</li>
              <li>Username and profile information</li>
              <li>Account preferences</li>
            </ul>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Usage Data</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Projects and designs you create</li>
              <li>Conversation history with AI</li>
              <li>Feature usage and points consumption</li>
            </ul>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Technical Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Device type and browser information</li>
              <li>IP address and approximate location</li>
              <li>Access times and page views</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. How We Use Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the collected information to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your requests and transactions</li>
              <li>Send service-related notifications</li>
              <li>Provide customer support</li>
              <li>Analyze usage patterns to improve our product</li>
              <li>Prevent fraud and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We may share information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>With your consent</li>
              <li>With service providers (e.g., cloud storage, payment processing)</li>
              <li>To comply with legal requirements</li>
              <li>To protect our rights and safety</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. AI Data Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Regarding data processing for AI features:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Your prompts are sent to AI service providers for processing</li>
              <li>We may use anonymized data to improve AI models</li>
              <li>You can delete your conversation history at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement reasonable technical and organizational measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Encrypted data transmission (HTTPS/TLS)</li>
              <li>Secure data storage</li>
              <li>Access controls and authentication</li>
              <li>Regular security audits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the following rights regarding your data:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Access and export your data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and data</li>
              <li>Withdraw consent</li>
              <li>Object to data processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Keep you signed in</li>
              <li>Remember your preferences</li>
              <li>Analyze website usage</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-1.5">
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as necessary to provide our services. After account deletion,
              we will delete your personal data within a reasonable timeframe, unless required by law to retain it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Policy Updates</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. Significant changes will be communicated
              via email or website notification. Continued use of the service constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any privacy-related questions, please contact us:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:privacy@fluxa.app" className="text-primary hover:underline">privacy@fluxa.app</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
