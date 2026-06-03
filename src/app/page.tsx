'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { motion, stagger, useAnimate, AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowDown } from 'lucide-react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Link from 'next/link';
import Floating, { FloatingElement } from '@/components/ui/parallax-floating';
import { useT } from '@/lib/i18n/hooks';
import { GooeyText } from '@/components/ui/gooey-text-morphing';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/button';
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

// Ambient backdrop images — fill the edges around the hero content.
const heroImages = galleryImages.slice(0, 12);

// Intro animation texts
const introTexts = ['AI Design', 'Fluxa'];


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

gsap.registerPlugin(ScrollTrigger, useGSAP);

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT('home');
  const [scope, animate] = useAnimate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const refCode = searchParams.get('ref') ?? '';
  const containerRef = useRef<HTMLDivElement>(null);

  const features = [
    { number: t('landing.feature_1_number'), title: t('landing.feature_1_title'), description: t('landing.feature_1_description') },
    { number: t('landing.feature_2_number'), title: t('landing.feature_2_title'), description: t('landing.feature_2_description') },
    { number: t('landing.feature_3_number'), title: t('landing.feature_3_title'), description: t('landing.feature_3_description') },
  ];

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
      animate('.floating-image', { opacity: [0, 0.5] }, { duration: 0.8, delay: stagger(0.08) });
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

  useGSAP(
    () => {
      // Hero scales down as first card rises (depth effect)
      gsap.to('.hero-section', {
        scale: 0.92,
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      // Nav bar fades in after hero scrolls out
      gsap.set('.fixed-nav', { autoAlpha: 0, y: -8 });
      ScrollTrigger.create({
        trigger: '.hero-section',
        start: 'bottom top',
        onEnter: () => gsap.to('.fixed-nav', { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }),
        onLeaveBack: () => gsap.to('.fixed-nav', { autoAlpha: 0, y: -8, duration: 0.2 }),
      });

      gsap.set(['.scroll-heading', '.feature-card', '.gallery-card', '.scroll-cta'], {
        opacity: 0,
        y: 30,
      });

      gsap.utils.toArray<Element>('.scroll-heading').forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });

      ScrollTrigger.batch('.feature-card', {
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power2.out',
            stagger: 0.12,
            overwrite: true,
          }),
        start: 'top 85%',
        once: true,
      });

      ScrollTrigger.batch('.gallery-card', {
        interval: 0.08,
        batchMax: 4,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.05,
            overwrite: true,
          }),
        start: 'top 90%',
        once: true,
      });

      gsap.to('.scroll-cta', {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.scroll-cta', start: 'top 85%', once: true },
      });

      // CTA expands to full width as it scrolls into view
      const ctaTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.scroll-cta',
          start: 'top 65%',
          end: 'top 5%',
          scrub: 1,
        },
      });
      ctaTl
        .to('.cta-content-wrap', { paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }, 0)
        .to('.scroll-cta', { borderRadius: 0 }, 0);

    },
    { scope: containerRef },
  );

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      setShowAuthDialog(true);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <div className="aurora-bg" />

      {/* Fixed nav - appears after scrolling past hero */}
      <header className="fixed-nav fixed top-0 left-0 right-0 z-40">
        <div className="bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="max-w-6xl mx-auto px-6 flex h-14 items-center">
            {/* Left: Logo */}
            <div className="flex-1">
              <Link href="/" className="flex items-center gap-2 w-fit">
                <span className="font-semibold text-lg">Fluxa</span>
              </Link>
            </div>

            {/* Center: Nav */}
            <nav className="flex items-center gap-1">
              <Link
                href="/app"
                className="px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                App
              </Link>
              <Link
                href="/pricing"
                className="px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                Pricing
              </Link>
            </nav>

            {/* Right: Controls */}
            <div className="flex-1 flex items-center justify-end gap-3">
              <ThemeToggle />
              {isAuthenticated !== null && (
                <Button size="sm" onClick={handleGetStarted}>
                  {isAuthenticated ? 'App' : 'Get Started'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

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
        className="hero-section relative min-h-screen flex items-center justify-center overflow-hidden"
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
          <FloatingElement depth={0.7} className="top-[42%] left-[1%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-28 h-36 md:w-36 md:h-48 relative">
              <Image src={heroImages[8].url} alt={heroImages[8].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 112px, 144px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1.1} className="top-[42%] right-[1%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-28 h-36 md:w-36 md:h-48 relative">
              <Image src={heroImages[9].url} alt={heroImages[9].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 112px, 144px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={0.4} className="top-[26%] left-[8%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-24 h-24 md:w-32 md:h-32 relative">
              <Image src={heroImages[10].url} alt={heroImages[10].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 96px, 128px" />
            </motion.div>
          </FloatingElement>
          <FloatingElement depth={1.3} className="top-[26%] right-[8%]">
            <motion.div initial={{ opacity: 0 }} className="floating-image w-24 h-24 md:w-32 md:h-32 relative">
              <Image src={heroImages[11].url} alt={heroImages[11].alt} fill loading="lazy" placeholder="blur" blurDataURL={blurDataURL} className="object-cover rounded-2xl shadow-xl" sizes="(max-width: 768px) 96px, 128px" />
            </motion.div>
          </FloatingElement>
        </Floating>

        {/* Center Content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 px-10 py-10 text-center flex flex-col items-center gap-6 rounded-3xl backdrop-blur-md"
        >
          <h1 className="text-6xl md:text-[64pt] font-bold tracking-tight leading-none" style={headingFont}>
            Fluxa
          </h1>

          <p className="max-w-md text-base md:text-lg text-muted-foreground">
            {t('landing.hero_tagline')}
          </p>

          <motion.button
            onClick={handleGetStarted}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity"
          >
            {t('landing.hero_cta')}
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
      <section className="sticky top-0 z-10 bg-background rounded-t-[2rem] overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="scroll-heading max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={headingFont}>
            {t('landing.features_heading')}
          </h2>
        </div>

        <div className="mt-14 grid gap-px md:grid-cols-3 border border-border rounded-2xl overflow-hidden">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="feature-card bg-background p-8 flex flex-col gap-4 transition-colors hover:bg-card/60"
            >
              <span className="text-xs font-mono text-muted-foreground/40 tracking-widest">{feature.number}</span>
              <h3 className="text-lg font-semibold" style={headingFont}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ============ SHOWCASE + CTA + FOOTER CARD ============ */}
      <section className="sticky top-0 z-20 bg-background rounded-t-[2rem] overflow-hidden">

        {/* Showcase */}
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-24 md:pb-20">
          <div className="scroll-heading mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={headingFont}>
                {t('landing.showcase_heading')}
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t('landing.showcase_description')}
            </p>
          </div>
          <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
            {galleryImages.map((image) => (
              <div
                key={image.url}
                className="gallery-card group relative block break-inside-avoid overflow-hidden rounded-2xl border border-border"
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
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="cta-content-wrap relative mx-auto max-w-6xl px-6 pb-20 md:pb-28">
          <div className="scroll-cta relative overflow-hidden rounded-3xl bg-zinc-900 dark:border dark:border-border dark:bg-card px-8 py-16 text-center md:px-16 md:py-20">
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-bold tracking-tight text-white dark:text-card-foreground" style={headingFont}>
                {t('landing.cta_heading')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm md:text-base text-zinc-400 dark:text-muted-foreground">
                {t('landing.cta_description')}
              </p>
              <motion.button
                onClick={handleGetStarted}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90 dark:bg-foreground dark:text-background"
              >
                {t('landing.cta_button')}
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border">
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

      </section>

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
