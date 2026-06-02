'use client';

/**
 * Contact Us Page
 */

import { SiteHeader, SiteFooter } from '@/components/layout';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6 flex-1">
        <h1 className="text-2xl font-bold mb-6">Contact Us</h1>

        <div className="space-y-5 text-sm">
          <section>
            <p className="text-muted-foreground leading-relaxed">
              We&apos;re here to help. Whether you have a question about your account, billing, a
              technical issue, or general feedback, please get in touch and we&apos;ll respond as soon
              as we can.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">General &amp; Support</h2>
            <p className="text-muted-foreground leading-relaxed">
              For product help, account questions, and general inquiries:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Billing &amp; Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              For payment, billing, or refund-related questions:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy and data-related requests:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:privacy@fluxa.app" className="text-primary hover:underline">privacy@fluxa.app</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Response Time</h2>
            <p className="text-muted-foreground leading-relaxed">
              We typically respond within 1–2 business days.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
