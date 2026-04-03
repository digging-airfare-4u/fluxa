'use client';

/**
 * Editor Page - Project editor with canvas and chat
 * Requirements: 6.1, 6.4, 6.5, 6.6, 6.7 - Editor layout
 * Requirements: 11.5, 14.3 - Integration with chat and realtime
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FullscreenLoading } from '@/components/ui/lottie-loading';
import { EditorLayout, EditorLayoutRef } from '@/components/editor';
import { 
  fetchProjectWithDetails, 
  updateProject,
  type Project,
  type Document,
  type Conversation,
} from '@/lib/supabase/queries/projects';
import { subscribeToOps, fetchOps, recordsToOps } from '@/lib/realtime/subscribeOps';
import { subscribeToJobs } from '@/lib/realtime/subscribeJobs';
import type { Op } from '@/lib/canvas/ops.types';

interface ProjectData {
  project: Project;
  document: Document;
  conversation: Conversation;
}

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('editor');
  const projectId = params.projectId as string;
  const initialPrompt = searchParams.get('prompt') || undefined;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to EditorLayout for executing ops
  const editorRef = useRef<EditorLayoutRef>(null);
  const documentId = projectData?.document.id;

  // Load project data
  useEffect(() => {
    async function loadProject() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchProjectWithDetails(projectId);
        
        if (!data) {
          setError(t('project.not_found'));
          return;
        }

        // Get the first document and conversation
        const document = data.documents[0];
        const conversation = data.conversations[0];

        if (!document || !conversation) {
          setError(t('project.incomplete'));
          return;
        }

        setProjectData({
          project: data.project,
          document,
          conversation,
        });
      } catch (err) {
        console.error('[Editor] Failed to load project:', err);
        setError(t('project.load_failed'));
      } finally {
        setIsLoading(false);
      }
    }

    if (projectId) {
      void loadProject();
    }
  }, [projectId, t]);

  // Subscribe to realtime updates and load initial ops
  useEffect(() => {
    if (!documentId) return;

    let opsSubscription: ReturnType<typeof subscribeToOps> | null = null;
    let jobsSubscription: ReturnType<typeof subscribeToJobs> | null = null;
    let initialOpsLoaded = false;
    let cancelled = false;

    // Load initial ops and then subscribe to realtime
    const initializeOps = async () => {
      try {
        // First, fetch existing ops
        const records = await fetchOps(documentId);
        if (cancelled) return;
        
        const lastSeq = records.length > 0 ? Math.max(...records.map(r => r.seq)) : 0;
        
        // Subscribe to new ops with lastSeq to avoid duplicates
        opsSubscription = subscribeToOps(
          documentId,
          {
            onNewOps: (ops: Op[]) => {
              if (!initialOpsLoaded || cancelled) {
                console.log('[Editor] Ignoring realtime ops until initial load completes');
                return;
              }
              console.log('[Editor] New ops received via Realtime:', ops.length);
              if (editorRef.current) {
                editorRef.current.executeOps(ops);
              }
            },
            onError: (error) => {
              console.error('[Editor] Ops subscription error:', error);
            },
          },
          lastSeq
        );

        // Load initial ops
        if (records.length > 0 && !cancelled) {
          console.log('[Editor] Loading initial ops:', records.length, 'lastSeq:', lastSeq);
          const ops = recordsToOps(records);
          setTimeout(async () => {
            if (!cancelled && editorRef.current) {
              await editorRef.current.executeOps(ops);
              // Fit all content in view after initial load
              editorRef.current.fitAllContent();
            }
            initialOpsLoaded = true;
          }, 100);
        } else {
          initialOpsLoaded = true;
        }
      } catch (err) {
        console.error('[Editor] Failed to initialize ops:', err);
      }
    };

    initializeOps();

    // Subscribe to job changes
    jobsSubscription = subscribeToJobs(
      projectId,
      {
        onProcessing: (job) => {
          console.log('[Editor] Job processing:', job.id);
        },
        onDone: (job) => {
          console.log('[Editor] Job done:', job.id);
        },
        onFailed: (job) => {
          console.error('[Editor] Job failed:', job.id, job.error);
        },
      }
    );

    return () => {
      cancelled = true;
      opsSubscription?.unsubscribe();
      jobsSubscription?.unsubscribe();
    };
  }, [documentId, projectId]);

  // Handle opening settings
  const handleOpenSettings = useCallback(() => {
    router.push('/app?settings=true');
  }, [router]);

  // Handle project name change
  const handleProjectNameChange = useCallback(async (name: string) => {
    if (!projectData) return;

    try {
      const updated = await updateProject(projectId, { name });
      setProjectData(prev => prev ? {
        ...prev,
        project: updated,
      } : null);
    } catch (err) {
      console.error('[Editor] Failed to update project name:', err);
    }
  }, [projectId, projectData]);

  // Loading state
  if (isLoading) {
    return <FullscreenLoading />;
  }

  // Error state
  if (error || !projectData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="font-heading font-semibold text-text-primary">
            {error || t('project.not_found')}
          </h2>
          <p className="text-sm text-text-secondary max-w-[300px]">
            {t('project.load_denied')}
          </p>
          <button
            onClick={() => router.push('/app')}
            className="btn-primary mt-4"
          >
            {t('project.back_home')}
          </button>
        </div>
      </div>
    );
  }

  const { project, document, conversation } = projectData;

  return (
    <EditorLayout
      ref={editorRef}
      projectId={project.id}
      documentId={document.id}
      conversationId={conversation.id}
      projectName={project.name}
      canvasWidth={document.width}
      canvasHeight={document.height}
      onProjectNameChange={handleProjectNameChange}
      initialPrompt={initialPrompt}
      onOpenSettings={handleOpenSettings}
    />
  );
}
