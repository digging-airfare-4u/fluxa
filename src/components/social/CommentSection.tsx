'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Send, CornerDownRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AuthDialog } from '@/components/auth';
import { fetchComments, createComment, deleteComment, type Comment } from '@/lib/supabase/queries/comments';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
interface CommentSectionProps { publicationId: string; publicationOwnerId: string; commentCount: number; }
export function CommentSection({ publicationId, publicationOwnerId, commentCount }: CommentSectionProps) {
  const t = useTranslations('common');
  const [comments, setComments] = useState<Comment[]>([]); const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false); const [offset, setOffset] = useState(0);
  const [newComment, setNewComment] = useState(''); const [replyTo, setReplyTo] = useState<{id:string;name:string}|null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); const [currentUserId, setCurrentUserId] = useState<string|null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({data:{user}}) => setCurrentUserId(user?.id||null)); }, []);
  const loadComments = useCallback(async (more=false) => {
    try { if(!more) setIsLoading(true); const o = more ? offset : 0;
      const data = await fetchComments(publicationId, {limit:20,offset:o});
      if(more) setComments(p=>[...p,...data]); else setComments(data);
      setOffset(o+data.length); setHasMore(data.length===20);
    } catch(e) { console.error('[Comments]',e); } finally { setIsLoading(false); }
  }, [publicationId, offset]);
  useEffect(() => { loadComments(); }, [publicationId]); // eslint-disable-line
  const handleSubmit = async () => {
    if(!newComment.trim()||isSubmitting) return;
    if(!currentUserId){ setAuthOpen(true); return; }
    setIsSubmitting(true);
    try { await createComment({publicationId,content:newComment.trim(),parentId:replyTo?.id}); setNewComment(''); setReplyTo(null); loadComments(); }
    catch(e) { console.error(e); } finally { setIsSubmitting(false); }
  };
  const handleDelete = async (id:string) => { try { await deleteComment(id); loadComments(); } catch(e) { console.error(e); } };
  const canDel = (c:Comment) => currentUserId===c.user_id || currentUserId===publicationOwnerId;
  const fmtTime = (d:string) => { const ms=Date.now()-new Date(d).getTime(); const m=Math.floor(ms/60000); if(m<1) return 'just now'; if(m<60) return `${m}m`; const h=Math.floor(m/60); if(h<24) return `${h}h`; const dy=Math.floor(h/24); if(dy<30) return `${dy}d`; return new Date(d).toLocaleDateString(); };
  const renderComment = (c:Comment, isReply=false) => (
    <div key={c.id} className={cn("flex gap-2", isReply && "ml-8 mt-2")}>
      {c.author?.avatar_url ? <Image src={c.author.avatar_url} alt="" width={isReply?24:28} height={isReply?24:28} className={cn("rounded-full object-cover shrink-0", isReply?"size-6":"size-7")} unoptimized /> : <div className={cn("rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0", isReply?"size-6":"size-7")}>{(c.author?.display_name||'U')[0]}</div>}
      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-medium">{c.author?.display_name||'User'}</span><span className="text-[10px] text-muted-foreground">{fmtTime(c.created_at)}</span></div>
        <p className="text-sm mt-0.5">{c.content}</p>
        <div className="flex items-center gap-2 mt-1">{!isReply && <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={()=>setReplyTo({id:c.id,name:c.author?.display_name||'User'})}>{t('discover.reply_to')}</button>}{canDel(c) && <button className="text-[10px] text-muted-foreground hover:text-red-500" onClick={()=>handleDelete(c.id)}>{t('discover.delete_comment')}</button>}</div></div>
    </div>);
  return (<div className="space-y-4"><h3 className="text-sm font-semibold">{t('discover.comments')} ({commentCount})</h3>
    <div className="space-y-2">{replyTo && <div className="flex items-center gap-2 text-xs text-muted-foreground"><CornerDownRight className="size-3"/><span>{t('discover.reply_to')} @{replyTo.name}</span><button className="text-foreground" onClick={()=>setReplyTo(null)}>×</button></div>}<div className="flex gap-2"><Textarea value={newComment} onChange={e=>setNewComment(e.target.value.slice(0,500))} placeholder={t('discover.comment_placeholder')} rows={1} className="resize-none text-sm flex-1"/><Button size="icon" onClick={handleSubmit} disabled={!newComment.trim()||isSubmitting}>{isSubmitting?<Loader2 className="size-4 animate-spin"/>:<Send className="size-4"/>}</Button></div>{!currentUserId && <p className="text-xs text-muted-foreground">{t('discover.login_to_interact')}</p>}</div>
    {isLoading ? <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="flex gap-2 animate-pulse"><div className="size-7 rounded-full bg-muted"/><div className="flex-1 space-y-1"><div className="h-3 w-20 bg-muted rounded"/><div className="h-4 w-3/4 bg-muted rounded"/></div></div>)}</div> : <div className="space-y-3">{comments.map(c=><div key={c.id}>{renderComment(c)}{c.replies?.map(r=>renderComment(r,true))}</div>)}</div>}
    {hasMore && <Button variant="ghost" size="sm" className="w-full text-xs" onClick={()=>loadComments(true)}>{t('discover.load_more_comments')}</Button>}
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
  </div>);
}
