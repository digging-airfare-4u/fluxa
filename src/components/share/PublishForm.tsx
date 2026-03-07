'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Upload, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { fetchCategories, publishConversation, updatePublicationSnapshot, fetchExistingPublication, uploadCoverImage, type Category } from '@/lib/supabase/queries/publications';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
interface PublishFormProps { open: boolean; onOpenChange: (open: boolean) => void; conversationId: string; projectId: string; documentId: string; onSuccess?: (id: string) => void; }
export function PublishForm({ open, onOpenChange, conversationId, projectId, documentId, onSuccess }: PublishFormProps) {
  const t = useTranslations('common');
  const [categories, setCategories] = useState<Category[]>([]); const [conversationImages, setConversationImages] = useState<string[]>([]);
  const [existingPubId, setExistingPubId] = useState<string|null>(null);
  const [selectedCover, setSelectedCover] = useState(''); const [coverFile, setCoverFile] = useState<File|null>(null); const [coverPreview, setCoverPreview] = useState('');
  const [title, setTitle] = useState(''); const [categoryId, setCategoryId] = useState(''); const [description, setDescription] = useState('');
  const [isPublishing, setIsPublishing] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if(!open) return; fetchCategories().then(setCategories).catch(console.error);
    fetchExistingPublication(conversationId).then(p=>setExistingPubId(p?.id||null)).catch(console.error); }, [open,conversationId]);
  useEffect(() => { if(!open) return; (async()=>{ const{data:msgs}=await supabase.from('messages').select('metadata').eq('conversation_id',conversationId).eq('role','assistant');
    const urls:string[]=[]; for(const m of(msgs||[])){const meta=m.metadata as Record<string,unknown>|null; const iu=meta?.imageUrl as string|undefined; if(iu)urls.push(iu); const op=(meta?.op as{payload?:{src?:string}})?.payload?.src; if(op)urls.push(op);} setConversationImages([...new Set(urls)]); })(); },[open,conversationId]);
  const handleFileUpload = useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0]; if(f){setCoverFile(f);setSelectedCover('');setCoverPreview(URL.createObjectURL(f));}}, []);
  const handlePublish = async () => {
    setError(''); if(!title.trim()){setError('Title is required');return;} if(!categoryId){setError('Category is required');return;} if(!selectedCover&&!coverFile){setError('Cover image is required');return;}
    setIsPublishing(true);
    try { let coverUrl=selectedCover;
      if(existingPubId){ if(coverFile) coverUrl=await uploadCoverImage(coverFile,existingPubId); await updatePublicationSnapshot(existingPubId);
        await supabase.from('publications').update({title:title.trim(),description:description.trim()||null,category_id:categoryId,cover_image_url:coverUrl}).eq('id',existingPubId); onSuccess?.(existingPubId);
      } else { const tempId=crypto.randomUUID(); if(coverFile) coverUrl=await uploadCoverImage(coverFile,tempId);
        const pubId=await publishConversation({conversationId,title:title.trim(),description:description.trim()||undefined,coverImageUrl:coverUrl,categoryId}); onSuccess?.(pubId); }
    } catch(e){console.error(e);setError(t('share.publish_error'));} finally{setIsPublishing(false);}
  };
  const isUpdate=!!existingPubId;
  return (<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t('share.publish_title')}</DialogTitle><p className="text-xs text-muted-foreground">{t('share.publish_description')}</p></DialogHeader>
    <div className="space-y-4"><div><Label className="text-sm font-medium">{t('share.upload_cover')}</Label><div className="mt-2 grid grid-cols-4 gap-2">
      <label className={cn("aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors text-center")}><Upload className="size-5 text-muted-foreground mb-1"/><span className="text-[10px] text-muted-foreground">{t('share.local_upload')}</span><input type="file" accept="image/*" className="hidden" onChange={handleFileUpload}/></label>
      {coverPreview && <div className="aspect-square rounded-lg overflow-hidden relative border-2 border-primary"><Image src={coverPreview} alt="Cover" fill className="object-cover" unoptimized/><div className="absolute top-1 right-1 size-4 rounded-full bg-primary flex items-center justify-center"><Check className="size-2.5 text-primary-foreground"/></div></div>}
      {conversationImages.slice(0,coverPreview?5:7).map((url,i)=><div key={i} onClick={()=>{setSelectedCover(url);setCoverFile(null);setCoverPreview('');}} className={cn("aspect-square rounded-lg overflow-hidden relative cursor-pointer border-2 transition-colors",selectedCover===url?"border-primary":"border-transparent hover:border-primary/30")}><Image src={url} alt="" fill className="object-cover" unoptimized/>{selectedCover===url&&<div className="absolute top-1 right-1 size-4 rounded-full bg-primary flex items-center justify-center"><Check className="size-2.5 text-primary-foreground"/></div>}</div>)}</div></div>
      <div><Label htmlFor="pub-title">{t('share.cover_title')}</Label><div className="relative mt-1"><Input id="pub-title" value={title} onChange={e=>setTitle(e.target.value.slice(0,50))} placeholder={t('share.cover_title_placeholder')} maxLength={50}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{title.length}/50</span></div></div>
      <div><Label htmlFor="pub-category">{t('share.select_category')}</Label><select id="pub-category" value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">{t('share.select_category')}</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder={t('share.description_placeholder')} rows={2}/>
      {error && <p className="text-xs text-red-500">{error}</p>}{isUpdate && <p className="text-xs text-muted-foreground">{t('share.already_published')}</p>}</div>
    <DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>{t('share.cancel')}</Button><Button onClick={handlePublish} disabled={isPublishing}>{isPublishing?<><Loader2 className="size-4 mr-2 animate-spin"/>{t('share.publishing')}</>:isUpdate?t('share.update_button'):t('share.publish_button')}</Button></DialogFooter>
  </DialogContent></Dialog>);
}
