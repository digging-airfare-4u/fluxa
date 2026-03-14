'use client';

/**
 * User Profile Page
 * Requirements: 5.1 - Display user profile with points information
 * 
 * Shows user profile with points balance, membership level, and transaction history.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, User, Bookmark, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserProfilePoints } from '@/components/points';
import { PublicationDetailDialog } from '@/components/discover';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { supabase } from '@/lib/supabase/client';
import {
  fetchOwnPublications,
  fetchMyBookmarkedPublications,
  updatePublication,
  toggleBookmark,
  type GalleryPublication,
} from '@/lib/supabase/queries/publications';
import { fetchPublicProfile, updateProfile } from '@/lib/supabase/queries/profiles';

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
  const [inviteCode, setInviteCode] = useState('');
  const [isRedeemingInvite, setIsRedeemingInvite] = useState(false);
  const [inviteRedeemError, setInviteRedeemError] = useState<string | null>(null);
  const [inviteRedeemSuccess, setInviteRedeemSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const [ownPubs, ownBookmarks, profile] = await Promise.all([
          fetchOwnPublications({ limit: 50 }),
          fetchMyBookmarkedPublications(50),
          fetchPublicProfile(user.id),
        ]);
        setPublications(ownPubs);
        setBookmarks(ownBookmarks);
        setDisplayName(profile?.display_name || '');
        setBio(profile?.bio || '');
      }
    }
    getUser();
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

  const handleRedeemInviteCode = async () => {
    setInviteRedeemError(null);
    setInviteRedeemSuccess(null);

    const normalizedCode = inviteCode.trim();
    if (!normalizedCode) {
      setInviteRedeemError('Please enter an invite code.');
      return;
    }

    setIsRedeemingInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setInviteRedeemError('Please sign in again and retry.');
        return;
      }

      const response = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invite_code: normalizedCode }),
      });

      const payload = await response.json();
      if (payload?.success === true) {
        const membership_expires_at = payload?.membership_expires_at as string | null;
        setInviteRedeemSuccess(
          membership_expires_at
            ? `Invite redeemed successfully. Pro valid until ${new Date(membership_expires_at).toLocaleString()}.`
            : 'Invite redeemed successfully.'
        );
        setInviteCode('');
        return;
      }

      const businessCode = payload?.error?.code as string | undefined;
      if (businessCode === 'ALREADY_REDEEMED') {
        setInviteRedeemError('ALREADY_REDEEMED: You already redeemed an invite reward.');
      } else if (businessCode === 'CODE_USED') {
        setInviteRedeemError('CODE_USED: This invite code has already been used.');
      } else if (businessCode === 'CODE_EXPIRED') {
        setInviteRedeemError('CODE_EXPIRED: This invite code has expired.');
      } else if (businessCode === 'INVALID_CODE') {
        setInviteRedeemError('INVALID_CODE: Invalid invite code.');
      } else {
        setInviteRedeemError('INTERNAL_ERROR: Failed to redeem invite code.');
      }
    } catch {
      setInviteRedeemError('INTERNAL_ERROR: Failed to redeem invite code.');
    } finally {
      setIsRedeemingInvite(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0D0915]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0D0915]/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
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

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl border bg-white dark:bg-[#1A1028] p-4 space-y-3">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 50))} placeholder="Display name" />
            <Button onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save profile'}</Button>
          </div>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} placeholder="Bio" rows={2} />
        </div>

        <div className="rounded-xl border bg-white dark:bg-[#1A1028] p-4 space-y-3">
          <h2 className="text-sm font-semibold">Invite Code</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              disabled={isRedeemingInvite}
            />
            <Button onClick={handleRedeemInviteCode} disabled={isRedeemingInvite}>
              {isRedeemingInvite ? 'Redeeming...' : 'Redeem'}
            </Button>
          </div>
          {inviteRedeemError && (
            <p className="text-sm text-destructive">{inviteRedeemError}</p>
          )}
          {inviteRedeemSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              {inviteRedeemSuccess} membership_expires_at updated.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant={tab === 'points' ? 'default' : 'outline'} size="sm" onClick={() => setTab('points')}>
            <User className="size-4 mr-1" /> Points
          </Button>
          <Button variant={tab === 'publications' ? 'default' : 'outline'} size="sm" onClick={() => setTab('publications')}>
            <FileText className="size-4 mr-1" /> My Publications
          </Button>
          <Button variant={tab === 'bookmarks' ? 'default' : 'outline'} size="sm" onClick={() => setTab('bookmarks')}>
            <Bookmark className="size-4 mr-1" /> My Bookmarks
          </Button>
        </div>

        {tab === 'points' && <UserProfilePoints userId={userId} />}

        {tab === 'publications' && (
          publications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No publications yet.</p>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-4">
              {publications.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  publication={pub}
                  onOpenDetail={(publicationId) => {
                    setActivePublicationId(publicationId);
                    setIsPublicationDialogOpen(true);
                  }}
                  footerActions={(
                    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                      <Button size="sm" variant="outline" disabled>
                        Detail in modal
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleHideToggle(pub)}>
                        {pub.status === 'hidden' ? 'Unhide' : 'Hide'}
                      </Button>
                    </div>
                  )}
                />
              ))}
            </div>
          )
        )}

        {tab === 'bookmarks' && (
          bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-4">
              {bookmarks.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  publication={pub}
                  onOpenDetail={(publicationId) => {
                    setActivePublicationId(publicationId);
                    setIsPublicationDialogOpen(true);
                  }}
                  footerActions={(
                    <div onClick={(e) => e.preventDefault()}>
                      <Button size="sm" variant="outline" onClick={() => handleRemoveBookmark(pub.id)}>
                        Remove bookmark
                      </Button>
                    </div>
                  )}
                />
              ))}
            </div>
          )
        )}
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
