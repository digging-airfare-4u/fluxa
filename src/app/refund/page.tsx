'use client';

/**
 * Refund & Dispute Policy Page
 */

import { SiteHeader, SiteFooter } from '@/components/layout';

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6 flex-1">
        <h1 className="text-2xl font-bold mb-1">Refund &amp; Dispute Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: January 2026</p>

        <div className="space-y-5 text-sm">
          <section>
            <h2 className="text-base font-semibold mb-2">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fluxa sells digital products in the form of points and membership plans that unlock AI
              generation features. Because these products are delivered electronically and consumed
              instantly, this policy explains when refunds are available and how to resolve billing
              disputes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. Digital Goods &amp; Points</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>Points are delivered to your account immediately after a successful payment.</li>
              <li>Once points have been used for AI generation, they are non-refundable.</li>
              <li>Unused points may be eligible for a refund as described in Section 3.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Eligibility for Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              We will review refund requests in the following situations:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>You were charged more than once for the same purchase (duplicate charge).</li>
              <li>You were charged due to a technical or billing error on our side.</li>
              <li>You purchased points that remain completely unused, and you request a refund within 14 days of purchase.</li>
              <li>A purchased feature was unavailable due to a verified fault on our platform.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-1.5">
              Refunds are generally not provided for points that have already been used, for change of
              mind after points have been consumed, or for dissatisfaction with AI-generated output,
              which is inherently variable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. How to Request a Refund</h2>
            <p className="text-muted-foreground leading-relaxed">
              To request a refund, email us at{' '}
              <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>{' '}
              with the following details:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>The email address associated with your account</li>
              <li>The order number or payment receipt</li>
              <li>The date of the transaction</li>
              <li>A brief description of the reason for your request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Processing Time</h2>
            <p className="text-muted-foreground leading-relaxed">
              We aim to review refund requests within 5 business days. If approved, refunds are issued
              to your original payment method. Depending on your payment provider or bank, it may take
              an additional 5–10 business days for the funds to appear.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Subscriptions &amp; Renewals</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you purchase a recurring membership, you may cancel at any time to prevent future
              renewals. Cancellation stops the next billing cycle; the current paid period remains
              active until it ends. Partial periods are generally non-refundable unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Disputes &amp; Chargebacks</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you believe a charge is incorrect, please contact us first at{' '}
              <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>{' '}
              so we can resolve it quickly. We will work with you in good faith to investigate and
              correct any verified billing errors. Opening a chargeback or dispute before contacting us
              may delay resolution, as funds are held by the payment provider during the dispute process.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any refund or billing questions, please contact us:
            </p>
            <p className="text-muted-foreground mt-1.5">
              Email: <a href="mailto:support@fluxa.app" className="text-primary hover:underline">support@fluxa.app</a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
