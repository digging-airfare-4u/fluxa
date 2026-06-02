'use client';

/**
 * SiteFooter Component
 * Common footer with company, legal, and product links.
 * Provides public access to legal/policy pages required for payment review.
 */

import Image from 'next/image';
import Link from 'next/link';

const footerSections: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/app', label: 'Home' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact Us' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/refund', label: 'Refund & Dispute Policy' },
      { href: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <Image
                src="/logo.png"
                alt="Fluxa logo"
                width={32}
                height={32}
                className="size-8 rounded-lg"
              />
              <span className="font-semibold text-lg">Fluxa</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              An AI-powered design generation platform that turns natural language into beautiful visual designs.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {year} Fluxa. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Contact: <a href="mailto:support@fluxa.app" className="hover:text-foreground transition-colors">support@fluxa.app</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
