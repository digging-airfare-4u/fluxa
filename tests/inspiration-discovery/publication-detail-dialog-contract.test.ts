import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('publication detail dialog contract', () => {
  const dialogSource = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationDetailDialog.tsx'),
    'utf8'
  );
  const contentSource = readFileSync(
    resolve(process.cwd(), 'src/components/discover/PublicationDetailContent.tsx'),
    'utf8'
  );

  it('keeps the dialog shell fixed while moving scrolling into the inner publication detail content', () => {
    expect(dialogSource).toContain('Dialog');
    expect(dialogSource).toContain('DialogContent');
    expect(dialogSource).toContain('DialogTitle');
    expect(dialogSource).toContain('className="sr-only"');
    expect(dialogSource).toContain('max-w-5xl');
    expect(dialogSource).toContain('max-h-[90vh]');
    expect(dialogSource).not.toContain('overflow-y-auto');
    expect(dialogSource).toContain('publicationId');
    expect(dialogSource).toContain('onPublicationChange');
    expect(dialogSource).toContain('const handleOpenChange = (nextOpen: boolean) => {');
    expect(dialogSource).toContain('if (!nextOpen) {');
    expect(dialogSource).toContain('onPublicationChange(null);');
    expect(dialogSource).toContain('onOpenChange(nextOpen);');
    expect(dialogSource).toContain('<Dialog open={open} onOpenChange={handleOpenChange}>');
    expect(dialogSource).toContain('<PublicationDetailContent');
    expect(contentSource).toContain('h-[85vh]');
    expect(contentSource).toContain('overflow-y-auto');
  });

  it('moves the former detail page content into a reusable component', () => {
    expect(contentSource).toContain('fetchPublicationDetail');
    expect(contentSource).toContain('fetchPublicationSnapshot');
    expect(contentSource).toContain('fetchRelatedPublications');
    expect(contentSource).toContain('checkUserInteractions');
    expect(contentSource).toContain('incrementViewCount');
    expect(contentSource).toContain('CommentSection');
    expect(contentSource).toContain('LikeButton');
    expect(contentSource).toContain('BookmarkButton');
    expect(contentSource).toContain('FollowButton');
    expect(contentSource).toContain('setPublication(null);');
    expect(contentSource).toContain('setSnapshot(null);');
    expect(contentSource).toContain('setAuthor(null);');
    expect(contentSource).toContain('setRelatedWorks([]);');
    expect(contentSource).toContain('onOpenPublication');
    expect(contentSource).toContain('<PublicationCard');
    expect(contentSource).toContain('publication={item}');
    expect(contentSource).toContain('onOpenDetail={onOpenPublication}');
    expect(contentSource).toContain('layout="discover"');
  });

  it('renders an inline generic error state for load failures without reusing the not found state', () => {
    expect(contentSource).toContain('const [loadError, setLoadError] = useState<string | null>(null);');
    expect(contentSource).toContain('setLoadError(null);');
    expect(contentSource).toContain("setLoadError(t('discover.load_error'));\n");
    expect(contentSource).toContain('if (loadError) {');
    expect(contentSource).toContain("{t('discover.load_error_title')}");
    expect(contentSource).toContain('{loadError}');
    expect(contentSource).not.toContain('setNotFound(true);\n        setLoadError');
  });

  it('surfaces the source prompt in the dialog content so users can recreate the work', () => {
    expect(contentSource).toContain('const promptMessage = useMemo(');
    expect(contentSource).toContain("t('discover.prompt_label')");
    expect(contentSource).toContain('promptMessage?.content');
  });
});
