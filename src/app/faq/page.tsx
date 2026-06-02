'use client';

/**
 * FAQ Page
 */

import { SiteHeader, SiteFooter } from '@/components/layout';

const faqs: { question: string; answer: string }[] = [
  {
    question: 'What is Fluxa?',
    answer:
      'Fluxa is an AI-powered design generation platform. You describe what you want in natural language, and Fluxa generates editable visual designs on an interactive canvas.',
  },
  {
    question: 'Do I need design experience to use Fluxa?',
    answer:
      'No. Fluxa is built so anyone can create designs by simply describing their idea. You can then refine the result directly on the canvas.',
  },
  {
    question: 'How does the points system work?',
    answer:
      'AI generation features consume points. New users receive initial points upon registration, and you can obtain more points through membership plans. Each generation deducts points based on the feature used.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept payments through our supported payment providers. Available methods are shown at checkout on the Pricing page.',
  },
  {
    question: 'Can I get a refund?',
    answer:
      'Because points and digital generations are delivered instantly, purchases are generally non-refundable once points are used. For billing errors, duplicate charges, or unused purchases, please review our Refund & Dispute Policy or contact support@fluxa.app.',
  },
  {
    question: 'Who owns the designs I create?',
    answer:
      'You retain the rights to the content you create with Fluxa, subject to our Terms of Service. You are responsible for how you use AI-generated content.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'We use encrypted data transmission and secure storage, and apply access controls to protect your data. See our Privacy Policy for full details.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach us anytime at support@fluxa.app. We aim to respond within 1–2 business days.',
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Content */}
      <main className="container max-w-2xl mx-auto py-10 px-6 flex-1">
        <h1 className="text-2xl font-bold mb-6">Frequently Asked Questions</h1>

        <div className="space-y-5 text-sm">
          {faqs.map((faq) => (
            <section key={faq.question}>
              <h2 className="text-base font-semibold mb-2">{faq.question}</h2>
              <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
            </section>
          ))}

          <section>
            <h2 className="text-base font-semibold mb-2">Still have questions?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Reach out and we&apos;ll be happy to help.
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
