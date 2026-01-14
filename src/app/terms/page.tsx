'use client';

/**
 * Terms of Service Page
 */

import { SiteHeader } from '@/components/layout';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: January 2026</p>

        <div className="space-y-5 text-sm">
          <section>
            <h2 className="text-base font-semibold mb-2">1. Service Description</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fluxa is an AI-powered design generation platform that allows users to create visual designs
              through natural language conversation. By using this service, you agree to comply with the following terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You need to register an account to access the full features of Fluxa. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Providing accurate and complete registration information</li>
              <li>Maintaining the security of your account and password</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Points System</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fluxa uses a points system to manage AI feature usage:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>New users receive initial points upon registration</li>
              <li>Using AI generation features consumes points</li>
              <li>Points can be obtained through membership upgrades or other means</li>
              <li>Points are non-transferable and non-refundable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain all rights to the content you create. However, you grant Fluxa the necessary licenses
              to provide the service. You may not use this service to create:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Illegal or infringing content</li>
              <li>Harmful, fraudulent, or misleading content</li>
              <li>Content that infringes on others&apos; intellectual property rights</li>
              <li>Content containing malware or harmful code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              AI-generated content may not be perfect or accurate. You understand and agree that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>AI output is for reference only and requires human review</li>
              <li>We do not guarantee the accuracy of AI-generated content</li>
              <li>You are responsible for how you use AI-generated content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Service Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify, suspend, or terminate the service at any time.
              Users will be notified in advance of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The service is provided &quot;as is&quot; without any express or implied warranties.
              To the maximum extent permitted by law, we are not liable for any indirect, incidental,
              or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions, please contact us:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
