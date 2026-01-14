'use client';

/**
 * Landing Page - Fluxa Home
 * Minimal landing page with logo and floating images
 * Features intro animation on first visit
 */

import { useEffect, useState } from 'react';
import { motion, stagger, useAnimate, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import Floating, { FloatingElement } from '@/components/ui/parallax-floating';
import { GooeyText } from '@/components/ui/gooey-text-morphing';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';

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

// Intro animation texts
const introTexts = ['AI Design', 'Fluxa'];

export default function LandingPage() {
  const router = useRouter();
  const [scope, animate] = useAnimate();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showIntro, setShowIntro] = useState(true);

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
      animate('img', { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.1) });
    }
  }, [animate, showIntro]);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
  }

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

      <div
        ref={scope}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Floating Images Background */}
        <Floating sensitivity={-2} className="overflow-hidden pointer-events-none">
          {/* Top row */}
          <FloatingElement depth={0.5} className="top-[2%] left-[2%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[0].url} alt={galleryImages[0].alt} className="w-40 h-40 md:w-52 md:h-52 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={1} className="top-[5%] left-[18%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[1].url} alt={galleryImages[1].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={1.5} className="top-[0%] left-[38%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[2].url} alt={galleryImages[2].alt} className="w-36 h-28 md:w-48 md:h-36 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={0.8} className="top-[3%] right-[18%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[3].url} alt={galleryImages[3].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={2} className="top-[2%] right-[2%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[4].url} alt={galleryImages[4].alt} className="w-40 h-40 md:w-52 md:h-52 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>

          {/* Middle row - left side */}
          <FloatingElement depth={1.2} className="top-[35%] left-[-2%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[5].url} alt={galleryImages[5].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={0.6} className="top-[42%] left-[12%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[6].url} alt={galleryImages[6].alt} className="w-36 h-36 md:w-44 md:h-44 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>

          {/* Middle row - right side */}
          <FloatingElement depth={0.9} className="top-[38%] right-[10%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[7].url} alt={galleryImages[7].alt} className="w-36 h-36 md:w-44 md:h-44 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={1.8} className="top-[32%] right-[-2%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[8].url} alt={galleryImages[8].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>

          {/* Bottom row */}
          <FloatingElement depth={1.3} className="bottom-[5%] left-[0%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[9].url} alt={galleryImages[9].alt} className="w-40 h-40 md:w-52 md:h-52 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={0.7} className="bottom-[8%] left-[16%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[10].url} alt={galleryImages[10].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={2} className="bottom-[2%] left-[36%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[11].url} alt={galleryImages[11].alt} className="w-36 h-28 md:w-48 md:h-36 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={1.1} className="bottom-[6%] right-[16%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[12].url} alt={galleryImages[12].alt} className="w-44 h-56 md:w-56 md:h-72 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
          <FloatingElement depth={0.5} className="bottom-[3%] right-[0%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[13].url} alt={galleryImages[13].alt} className="w-40 h-40 md:w-52 md:h-52 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>

          {/* Extra fill image */}
          <FloatingElement depth={1.6} className="top-[22%] left-[8%]">
            <motion.img initial={{ opacity: 0 }} src={galleryImages[14].url} alt={galleryImages[14].alt} className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-2xl shadow-xl" />
          </FloatingElement>
        </Floating>

        {/* Center Content - Fluxa + Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center flex flex-col items-center gap-6"
        >
          {/* Name - matches GooeyText position */}
          <span className="text-6xl md:text-[60pt] font-bold tracking-tight">Fluxa</span>

          {/* CTA Button */}
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
      </div>

      {/* Auth Dialog */}
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog} 
      />
    </div>
  );
}
