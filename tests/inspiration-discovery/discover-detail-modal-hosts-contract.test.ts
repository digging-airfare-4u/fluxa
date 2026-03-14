import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('discover detail modal host contract', () => {
  const homeSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/page.tsx'),
    'utf8'
  );
  const discoverSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/discover/page.tsx'),
    'utf8'
  );
  const profileSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/profile/page.tsx'),
    'utf8'
  );
  const userProfileSource = readFileSync(
    resolve(process.cwd(), 'src/app/app/user/[userId]/page.tsx'),
    'utf8'
  );

  it('mounts the shared publication detail dialog on the home inspiration feed', () => {
    expect(homeSource).toContain("import { PublicationDetailDialog } from '@/components/discover';");
    expect(homeSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(homeSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(homeSource).toContain('onOpenDetail={(publicationId) => {');
    expect(homeSource).toContain('setActivePublicationId(publicationId);');
    expect(homeSource).toContain('setIsPublicationDialogOpen(true);');
    expect(homeSource).toContain('<PublicationDetailDialog');
    expect(homeSource).toContain('open={isPublicationDialogOpen}');
    expect(homeSource).toContain('onOpenChange={setIsPublicationDialogOpen}');
    expect(homeSource).toContain('publicationId={activePublicationId}');
    expect(homeSource).toContain('onPublicationChange={setActivePublicationId}');
  });

  it('mounts the shared publication detail dialog on the discover feed', () => {
    expect(discoverSource).toContain("import { PublicationDetailDialog } from '@/components/discover';");
    expect(discoverSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(discoverSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(discoverSource).toContain('const handleOpenPublication = useCallback((publicationId: string) => {');
    expect(discoverSource).toContain('setActivePublicationId(publicationId);');
    expect(discoverSource).toContain('setIsPublicationDialogOpen(true);');
    expect(discoverSource).toContain('}, []);');
    expect(discoverSource).toContain('<PublicationCard key={pub.id} publication={pub} onOpenDetail={handleOpenPublication} />');
    expect(discoverSource).toContain('<PublicationDetailDialog');
    expect(discoverSource).toContain('open={isPublicationDialogOpen}');
    expect(discoverSource).toContain('onOpenChange={setIsPublicationDialogOpen}');
    expect(discoverSource).toContain('publicationId={activePublicationId}');
    expect(discoverSource).toContain('onPublicationChange={setActivePublicationId}');
  });

  it('mounts the shared publication detail dialog on the profile page tabs', () => {
    expect(profileSource).toContain("import { PublicationDetailDialog } from '@/components/discover';");
    expect(profileSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(profileSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(profileSource).toContain('onOpenDetail={(publicationId) => {');
    expect(profileSource).toContain('setActivePublicationId(publicationId);');
    expect(profileSource).toContain('setIsPublicationDialogOpen(true);');
    expect(profileSource).toContain('<PublicationDetailDialog');
    expect(profileSource).toContain('open={isPublicationDialogOpen}');
    expect(profileSource).toContain('onOpenChange={setIsPublicationDialogOpen}');
    expect(profileSource).toContain('publicationId={activePublicationId}');
    expect(profileSource).toContain('onPublicationChange={setActivePublicationId}');
    expect(profileSource).toContain('publication={pub}');
    expect(profileSource).toContain('onOpenDetail={(publicationId) => {');
  });

  it('mounts the shared publication detail dialog on the creator profile page', () => {
    expect(userProfileSource).toContain("import { PublicationDetailDialog } from '@/components/discover';");
    expect(userProfileSource).toContain('const [activePublicationId, setActivePublicationId] = useState<string | null>(null);');
    expect(userProfileSource).toContain('const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);');
    expect(userProfileSource).toContain('const handleOpenPublication = useCallback((publicationId: string) => {');
    expect(userProfileSource).toContain('setActivePublicationId(publicationId);');
    expect(userProfileSource).toContain('setIsPublicationDialogOpen(true);');
    expect(userProfileSource).toContain('}, []);');
    expect(userProfileSource).toContain('<PublicationCard key={pub.id} publication={pub} onOpenDetail={handleOpenPublication} />');
    expect(userProfileSource).toContain('<PublicationDetailDialog');
    expect(userProfileSource).toContain('open={isPublicationDialogOpen}');
    expect(userProfileSource).toContain('onOpenChange={setIsPublicationDialogOpen}');
    expect(userProfileSource).toContain('publicationId={activePublicationId}');
    expect(userProfileSource).toContain('onPublicationChange={setActivePublicationId}');
  });
});
