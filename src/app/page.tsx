'use client';

import { Suspense, useEffect, useState } from 'react';
import { motion, stagger, useAnimate, AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowDown, Sparkles, PenTool, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Floating, { FloatingElement } from '@/components/ui/parallax-floating';
import { GooeyText } from '@/components/ui/gooey-text-morphing';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { storeReferralCodeLocally } from '@/lib/supabase/queries/referral-codes';

// Shimmer SVG for blur placeholder - creates a gradient animation effect
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f0f0f0" offset="0%"/>
      <stop stop-color="#e0e0e0" offset="50%"/>
      <stop stop-color="#f0f0f0" offset="100%"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

// Blur placeholder - a tiny colored SVG that matches the overall tone
const blurDataURL = `data:image/svg+xml;base64,${toBase64(shimmer(10, 10))}`;

// Gallery images from public/sample folder
const galleryImages = [
  { url: '/sample/01f865bb053175f4e952512704baaa17.jpg', alt: 'Sample Design 1' },
  { url: '/sample/2b0d0ceddfe1f1ce29ecb50f2ebc37ae.jpg', alt: 'Sample Design 2' },
  { url: '/sample/362ff03354226fb63489bd21959d8927.jpg', alt: 'Sample Design 3' },
  { url: '/sample/530949644_17864159331442749_1051769471511318798_n.jpg', alt: 'Sample Design 4' },
  { url: '/sample/6572ee1397eb5b39d9f9e35a062d3917.jpg', alt: 'Sample Design 5' },
  { url: '/sample/839a78e669dc61ad87d7ad1c9deca22d.jpg', alt: 'Sample Design 6' },
  { url: '/sample/8f093d46a8db249ca0020d20c5e73c03.jpg', alt: 'Sample Design 7' },
  { url: '/sample/ad044f92996151f948e8e7a8546ac8fb.jpg', alt: 'Sample Design 8' },
  { url: '/sample/c771b25650836a9eac75d3ac52cfec58.jpg', alt: 'Sample Design 9' },
  { url: '/sample/d43c48303116029c12116fdd9e1fe492.jpg', alt: 'Sample Design 10' },
  { url: '/sample/dd3c4e6c98d7d1cae9e21cececf08a00.jpg', alt: 'Sample Design 11' },
  { url: '/sample/ed84576cb05d7b379edffd42c276c169.jpg', alt: 'Sample Design 12' },
  { url: '/sample/ef1ffcbd5df74f8d19650da2b5bdbd96.jpg', alt: 'Sample Design 13' },
  { url: '/sample/fb5c389b21c483dd4bef41fb6d3f9943.jpg', alt: 'Sample Design 14' },
  { url: '/sample/ff0d496b2667a7f87666e9c8974648e0.jpg', alt: 'Sample Design 15' },
];

// Restrained set used as ambient backdrop behind the hero (edges only).
const heroImages = galleryImages.slice(0, 8);

// Intro animation texts
const introTexts = ['AI Design', 'Fluxa'];

// Product features (sourced from the About page's "What We Offer").
const features = [
  {
    icon: Sparkles,
    title: 'Prompt to Design',
    description:
      'Describe what you need in plain language and Fluxa generates a finished, editable design in seconds.',
  },
  {
    icon: PenTool,
    title: 'Interactive Canvas',
    description:
      'Refine, rearrange, and polish every element on an infinite canvas built for fast iteration.',
  },
  {
    icon: ImageIcon,
    title: 'AI Images & Assets',
    description:
      'Create on-brand images and visual assets without leaving your workspace or breaking your flow.',
  },
];

// Footer links (legal & company), shown in the page footer.
const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refund', label: 'Refund' },
  { href: '/cookies', label: 'Cookies' },
];

const headingFont = { fontFamily: 'var(--font-heading)' } as const;

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scope, animate] = useAnimate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const refCode = searchParams.get('ref') ?? '';

  // Persist referral code to localStorage (survives OAuth redirects)
  useEffect(() => {
    if (refCode) {
      storeReferralCodeLocally(refCode);
    }
  }, [refCode]);

  // Auto-hide intro after animation completes
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro) {
      animate('.floating-image', { opacity: [0, 0.55] }, { duration: 0.6, delay: stagger(0.1) });
    }
  }, [animate, showIntro]);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      setShowAuthDialog(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="aurora-bg" />

      {/* Intro Animation */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          >
            <GooeyText
              texts={introTexts}
              morphTime={1.5}
              cooldownTime={0.5}
              className="h-24"
              textClassName="font-bold"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ HERO ============ */}
      <section
        ref={scope}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Restrained floating samples - pushed to the edges as ambient backdrop */}
        <Floating sensitivity={-1.5} className="overflow-hidden pointer-events-none">
          <FloatingElement depth={0.5} className="top-[6%] left-[3%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-32 h-32 md:w-44 md:h-44 relative">
              <Image src={heroImages[0].url} alt={heroImages[0].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 128px, 176px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1} className="top-[10%] left-[16%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-36 h-48 md:w-48 md:h-64 relative">
              <Image src={heroImages[1].url} alt={heroImages[1].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 144px, 192px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={0.8} className="top-[8%] right-[16%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-36 h-48 md:w-48 md:h-64 relative">
              <Image src={heroImages[2].url} alt={heroImages[2].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 144px, 192px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1.6} className="top-[6%] right-[3%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-32 h-32 md:w-44 md:h-44 relative">
              <Image src={heroImages[3].url} alt={heroImages[3].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 128px, 176px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1.2} className="bottom-[10%] left-[4%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-36 h-48 md:w-48 md:h-64 relative">
              <Image src={heroImages[4].url} alt={heroImages[4].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 144px, 192px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={0.6} className="bottom-[14%] left-[18%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-28 h-28 md:w-40 md:h-40 relative">
              <Image src={heroImages[5].url} alt={heroImages[5].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 112px, 160px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={0.9} className="bottom-[14%] right-[17%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-28 h-28 md:w-40 md:h-40 relative">
              <Image src={heroImages[6].url} alt={heroImages[6].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 112px, 160px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1.8} className="bottom-[9%] right-[4%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-36 h-48 md:w-48 md:h-64 relative">
              <Image src={heroImages[7].url} alt={heroImages[7].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 144px, 192px" />
            </motion.div>
          </FloatingElement>
        </Floating>

        {/* Radial vignette: fades the backdrop toward the center so content reads */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_center,var(--background)_30%,transparent_100%)]" />

        {/* Center Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 px-6 text-center flex flex-col items-center gap-6"
        >
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
            AI design, from prompt to canvas
          </span>

          <h1 className="text-6xl md:text-[64pt] font-bold tracking-tight leading-none" style={headingFont}>
            Fluxa
          </h1>

          <p className="max-w-xl text-base md:text-lg text-muted-foreground">
            Turn a sentence into a finished design. Generate, refine, and export — all on one AI-native canvas.
          </p>

          <motion.button
            onClick={handleGetStarted}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-muted-foreground"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="h-5 w-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[#7C3AED]">
            What Fluxa does
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={headingFont}>
            Design at the speed of thought
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group rounded-2xl border border-border bg-card/60 p-7 backdrop-blur transition-colors hover:border-[#7C3AED]/40"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold" style={headingFont}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============ SHOWCASE ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div className="max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[#06B6D4]">
              Showcase
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={headingFont}>
              Made with Fluxa
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            A glimpse of what people create — posters, social posts, brand visuals, and more.
          </p>
        </motion.div>

        <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
          {galleryImages.map((image, index) => (
            <motion.div
              key={image.url}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: (index % 4) * 0.05 }}
              className="group relative block break-inside-avoid overflow-hidden rounded-2xl border border-border"
            >
              <Image
                src={image.url}
                alt={image.alt}
                width={400}
                height={500}
                loading="lazy"
                placeholder="blur"
                blurDataURL={blurDataURL}
                className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] px-8 py-16 text-center text-white md:px-16 md:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-bold tracking-tight" style={headingFont}>
              Ready to design at the speed of thought?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm md:text-base text-white/80">
              Start free with flexible points, and upgrade to a membership plan whenever you need more.
            </p>
            <motion.button
              onClick={handleGetStarted}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-medium text-[#7C3AED] transition-opacity hover:opacity-90"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
          <span className="text-xl font-bold tracking-tight" style={headingFont}>
            Fluxa
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <span className="text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()} Fluxa
          </span>
        </div>
      </footer>

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        initialReferralCode={refCode}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  );
}
