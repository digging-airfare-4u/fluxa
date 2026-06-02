'use client';

/**
 * About Us Page
 */

import { SiteHeader, SiteFooter } from '@/components/layout';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6 flex-1">
        <h1 className="text-2xl font-bold mb-6">About Us</h1>

        <div className="space-y-5 text-sm">
          <section>
            <h2 className="text-base font-semibold mb-2">Who We Are</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fluxa is an AI-powered design generation platform. We help individuals and teams turn
              natural language descriptions into beautiful, editable visual designs—no professional
              design skills required. Through a chat-driven canvas, anyone can create graphics, layouts,
              and visual concepts in minutes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              We believe great design should be accessible to everyone. Our mission is to remove the
              technical barriers between an idea and a finished design, so creators can focus on what
              they want to express rather than how to produce it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">What We Offer</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 mt-1.5">
              <li>AI-driven design generation from natural language prompts</li>
              <li>An interactive canvas for refining and editing designs</li>
              <li>AI image generation and visual asset creation</li>
              <li>A flexible points system with membership plans</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Have questions or feedback? We&apos;d love to hear from you.
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
