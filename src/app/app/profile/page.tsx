'use client';

/**
 * User Profile Page
 * Requirements: 5.1 - Display user profile with points information
 *
 * Shows user profile with points balance, membership level, and transaction history.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bookmark, Check, Copy, FileText, Share2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserProfilePoints } from '@/components/points';
import { PublicationDetailDialog } from '@/components/discover';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { supabase } from '@/lib/supabase/client';
import {
  fetchMyBookmarkedPublications,
  fetchOwnPublications,
  toggleBookmark,
  type GalleryPublication,
  updatePublication,
} from '@/lib/supabase/queries/publications';
import { fetchPublicProfile, updateProfile } from '@/lib/supabase/queries/profiles';
import { getMyReferralCode } from '@/lib/supabase/queries/referral-codes';

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations('home');
  const [userId, setUserId] = useState<string | undefined>();
  const [tab, setTab] = useState<'points' | 'publications' | 'bookmarks'>('points');
  const [publications, setPublications] = useState<GalleryPublication[]>([]);
  const [bookmarks, setBookmarks] = useState<GalleryPublication[]>([]);
  const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
  const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const [ownPubs, ownBookmarks, profile, referralCode] = await Promise.all([
          fetchOwnPublications({ limit: 50 }),
          fetchMyBookmarkedPublications(50),
          fetchPublicProfile(user.id),
          getMyReferralCode(),
        ]);
        setPublications(ownPubs);
        setBookmarks(ownBookmarks);
        setDisplayName(profile?.display_name || '');
        setBio(profile?.bio || '');
        setMyReferralCode(referralCode);
      }
    }

    void getUser();
  }, []);

  const handleOpenPublication = useCallback((publicationId: string) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }, []);

  const reloadPublicationLists = async () => {
    const [ownPubs, ownBookmarks] = await Promise.all([
      fetchOwnPublications({ limit: 50 }),
      fetchMyBookmarkedPublications(50),
    ]);
    setPublications(ownPubs);
    setBookmarks(ownBookmarks);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHideToggle = async (publication: GalleryPublication) => {
    const nextStatus = publication.status === 'hidden' ? 'published' : 'hidden';
    await updatePublication(publication.id, { status: nextStatus });
    await reloadPublicationLists();
  };

  const handleRemoveBookmark = async (publicationId: string) => {
    await toggleBookmark(publicationId);
    await reloadPublicationLists();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0D0915]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-[#0D0915]/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex items-center gap-2">
              <User className="size-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">{t('profile.title')}</h1>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 space-y-6">
        <div className="space-y-3 rounded-xl border bg-white p-4 dark:bg-[#1A1028]">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 50))} placeholder="Display name" />
            <Button onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save profile'}</Button>
          </div>
          <Textarea value={bio} onChange={(event) => setBio(event.target.value.slice(0, 200))} placeholder="Bio" rows={2} />
        </div>

        {myReferralCode && (
          <div className="space-y-3 rounded-xl border bg-white p-4 dark:bg-[#1A1028]">
            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">My Referral Code</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Share your code with friends. You get +50 points and they get +30 points when they sign up!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm font-mono tracking-wider">
                {myReferralCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const url = `${window.location.origin}/?ref=${myReferralCode}`;
                  await navigator.clipboard.writeText(url);
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
              >
                {referralCopied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                <span className="ml-1">{referralCopied ? 'Copied!' : 'Copy Link'}</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant={tab === 'points' ? 'default' : 'outline'} size="sm" onClick={() => setTab('points')}>
            <User className="mr-1 size-4" /> Points
          </Button>
          <Button variant={tab === 'publications' ? 'default' : 'outline'} size="sm" onClick={() => setTab('publications')}>
            <FileText className="mr-1 size-4" /> My Publications
          </Button>
          <Button variant={tab === 'bookmarks' ? 'default' : 'outline'} size="sm" onClick={() => setTab('bookmarks')}>
            <Bookmark className="mr-1 size-4" /> My Bookmarks
          </Button>
        </div>

        {tab === 'points' ? <UserProfilePoints userId={userId} /> : null}

        {tab === 'publications' ? (
          publications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No publications yet.</p>
          ) : (
            <div className="mt-4 columns-1 md:columns-2 xl:columns-3 gap-6">
              {publications.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  publication={pub}
                  onOpenDetail={handleOpenPublication}
                  layout="discover"
                  footerActions={(
                    <div className="flex items-center gap-2" onClick={(event) => event.preventDefault()}>
                      <Button size="sm" variant="secondary" className="rounded-full px-4" onClick={() => handleHideToggle(pub)}>
                        {pub.status === 'hidden' ? 'Unhide' : 'Hide'}
                      </Button>
                    </div>
                  )}
                />
              ))}
            </div>
          )
        ) : null}

        {tab === 'bookmarks' ? (
          bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
          ) : (
            <div className="mt-4 columns-1 md:columns-2 xl:columns-3 gap-6">
              {bookmarks.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  publication={pub}
                  onOpenDetail={handleOpenPublication}
                  layout="discover"
                  footerActions={(
                    <div onClick={(event) => event.preventDefault()}>
                      <Button size="sm" variant="outline" className="rounded-full px-4" onClick={() => handleRemoveBookmark(pub.id)}>
                        Remove bookmark
                      </Button>
                    </div>
                  )}
                />
              ))}
            </div>
          )
        ) : null}
      </main>

      <PublicationDetailDialog
        open={isPublicationDialogOpen}
        onOpenChange={setIsPublicationDialogOpen}
        publicationId={activePublicationId}
        onPublicationChange={setActivePublicationId}
      />
    </div>
  );
}
