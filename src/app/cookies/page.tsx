'use client';

/**
 * Cookie Policy Page
 */

import { SiteHeader, SiteFooter } from '@/components/layout';

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6 flex-1">
        <h1 className="text-2xl font-bold mb-1">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: January 2026</p>

        <div className="space-y-5 text-sm">
          <section>
            <h2 className="text-base font-semibold mb-2">1. What Are Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. They help the
              site function properly, remember your preferences, and understand how the site is used. We
              also use similar technologies such as local storage for the same purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. How We Use Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Keep you signed in to your account</li>
              <li>Remember your preferences, such as theme and language</li>
              <li>Maintain your session and security</li>
              <li>Understand and improve how our service is used</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Types of Cookies We Use</h2>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Essential Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              Required for core functionality such as authentication and security. The service cannot
              function properly without these.
            </p>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Preference Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              Remember choices you make, such as your theme and language settings.
            </p>
            <h3 className="text-sm font-medium mt-3 mb-1.5">Analytics Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              Help us understand how visitors interact with our service so we can improve it. These
              collect information in an aggregated, anonymized form.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Third-Party Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Some cookies may be set by third-party services we rely on, such as authentication,
              payment processing, and analytics providers. These providers have their own privacy and
              cookie policies governing how they use such data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Managing Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can control and delete cookies through your browser settings. Most browsers let you
              block or remove cookies, but please note that disabling essential cookies may prevent parts
              of the service—such as signing in—from working correctly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology or
              legal requirements. The &quot;Last updated&quot; date above indicates when this policy was
              last revised.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about our use of cookies, please contact us:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:privacy@fluxa.app" className="text-primary hover:underline">privacy@fluxa.app</a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
