import {useEffect, useState} from 'react';
import {Ban, Bookmark, Flag, Heart, MessageCircle, Plus, Send, Trash2, BookmarkCheck} from 'lucide-react';
import type {CommunityPostDto, CommunityPostInput} from '@other-half/contracts';
import type {CityId, CityTheme} from '../types';
import {CreatePostModal} from './CreatePostModal';
import {ReportMemberDialog} from './ReportMemberDialog';
import {blockMember} from '../services/safety';
import {
  createCommunityComment, createCommunityPost, getCommunityComments, getCommunityPosts,
  removeCommunityPost, setCommunityPostLike, setCommunityPostSaved,
} from '../services/community';

const POST_TYPE_LABEL: Record<CommunityPostDto['postType'], string> = {
  ROOM_AVAILABLE: 'Room available', LOOKING_FOR_FLATMATE: 'Looking for a flatmate', GENERAL: 'Community update',
};

export function FeedView({cityId, neighborhood, city, userId}: {
  cityId: CityId; neighborhood: string; city: CityTheme; userId: string;
}) {
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityPostDto['comments']>>({});
  const [commentCursors, setCommentCursors] = useState<Record<string, string | null>>({});
  const [loadingOlderComments, setLoadingOlderComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [reportTarget, setReportTarget] = useState<{id: string; name: string} | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setNotice(''); setOpenComments(null); setComments({});
    void getCommunityPosts({cityId, ...(neighborhood !== 'All Areas' ? {neighborhood} : {}), savedOnly}, controller.signal)
      .then((page) => {if (!controller.signal.aborted) {setPosts(page.items); setNextCursor(page.nextCursor);}})
      .catch((cause: unknown) => {if (!controller.signal.aborted) {setError(cause instanceof Error ? cause.message : 'Could not load city updates.'); setPosts([]);}})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [cityId, neighborhood, savedOnly]);

  const publish = async (input: CommunityPostInput) => {
    const post = await createCommunityPost(input);
    if (savedOnly) setSavedOnly(false);
    if (post.cityId === cityId && (neighborhood === 'All Areas' || post.neighborhood.toLowerCase() === neighborhood.toLowerCase())) {
      setPosts((current) => [post, ...current]);
      setNotice('Your update is live.');
    } else {
      setNotice(`Your update is live in ${post.neighborhood}. Change the neighborhood filter to see it.`);
    }
    setShowComposer(false);
  };

  const toggleLike = async (post: CommunityPostDto) => {
    setBusyPostId(post.id); setError('');
    try {
      const next = !post.likedByMe;
      await setCommunityPostLike(post.id, next);
      setPosts((current) => current.map((item) => item.id === post.id ? {...item, likedByMe: next, likeCount: Math.max(0, item.likeCount + (next ? 1 : -1))} : item));
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not update the like.');}
    finally {setBusyPostId(null);}
  };

  const toggleSave = async (post: CommunityPostDto) => {
    setBusyPostId(post.id); setError('');
    try {
      const next = !post.savedByMe;
      await setCommunityPostSaved(post.id, next);
      setPosts((current) => current.flatMap((item) => item.id !== post.id ? [item] : savedOnly && !next ? [] : [{...item, savedByMe: next}]));
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not save the update.');}
    finally {setBusyPostId(null);}
  };

  const showPostComments = async (post: CommunityPostDto) => {
    if (openComments === post.id) {setOpenComments(null); return;}
    setOpenComments(post.id);
    if (comments[post.id]) return;
    try {
      const page = await getCommunityComments(post.id);
      setComments((current) => ({...current, [post.id]: page.items}));
      setCommentCursors((current) => ({...current, [post.id]: page.nextCursor}));
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load comments.');}
  };

  const loadOlderComments = async (postId: string) => {
    const cursor = commentCursors[postId];
    if (!cursor || loadingOlderComments) return;
    setLoadingOlderComments(true); setError('');
    try {
      const page = await getCommunityComments(postId, cursor);
      setComments((current) => ({...current, [postId]: [...page.items, ...(current[postId] ?? [])]}));
      setCommentCursors((current) => ({...current, [postId]: page.nextCursor}));
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load older comments.');}
    finally {setLoadingOlderComments(false);}
  };

  const submitComment = async (event: React.FormEvent<HTMLFormElement>, post: CommunityPostDto) => {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    setBusyPostId(post.id); setError('');
    try {
      const item = await createCommunityComment(post.id, commentDraft);
      setComments((current) => ({...current, [post.id]: [...(current[post.id] ?? []), item]}));
      setPosts((current) => current.map((entry) => entry.id === post.id ? {...entry, commentCount: entry.commentCount + 1} : entry));
      setCommentDraft('');
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not send the comment.');}
    finally {setBusyPostId(null);}
  };

  const deletePost = async (post: CommunityPostDto) => {
    if (!window.confirm('Delete this community update? This will hide it and its comments from the feed.')) return;
    setBusyPostId(post.id); setError('');
    try {await removeCommunityPost(post.id); setPosts((current) => current.filter((entry) => entry.id !== post.id));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not delete this update.');}
    finally {setBusyPostId(null);}
  };

  const blockAuthor = async (post: CommunityPostDto) => {
    if (!window.confirm(`Block ${post.authorDisplayName}? Their posts will disappear from your community feed.`)) return;
    setBusyPostId(post.id); setError('');
    try {await blockMember(post.authorId); setPosts((current) => current.filter((entry) => entry.authorId !== post.authorId));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not block this member.');}
    finally {setBusyPostId(null);}
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const page = await getCommunityPosts({cityId, ...(neighborhood !== 'All Areas' ? {neighborhood} : {}), savedOnly, cursor: nextCursor});
      setPosts((current) => [...current, ...page.items]); setNextCursor(page.nextCursor);
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load more updates.');}
    finally {setLoadingMore(false);}
  };

  return <section className="space-y-4" aria-label={`${city.name} community updates`}>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-white p-4 shadow-kinship-1"><div><h2 className="font-extrabold text-[#1E293B]">City community</h2><p className="mt-1 text-xs text-[#64748B]">Real updates from signed-in Other Half members.</p></div><div className="flex gap-2"><button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly((current) => !current)} className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F2EE] px-3.5 py-2.5 text-xs font-bold text-[#475569]">{savedOnly ? <BookmarkCheck className="h-4 w-4"/> : <Bookmark className="h-4 w-4"/>}{savedOnly ? 'All updates' : 'Saved'}</button><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#F05A4A] px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4"/> Share update</button></div></header>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Loading city updates…</div> : posts.length === 0 ? <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-9 text-center"><h3 className="font-bold text-[#1E293B]">{savedOnly ? 'No saved updates' : 'No updates here yet'}</h3><p className="mt-1 text-sm text-[#64748B]">{savedOnly ? 'Save a community update and it will appear here.' : `Be the first to share a real update with members in ${neighborhood === 'All Areas' ? city.name : neighborhood}.`}</p>{!savedOnly && <button type="button" onClick={() => setShowComposer(true)} className="mt-4 rounded-full bg-[#1E293B] px-5 py-2.5 text-sm font-bold text-white">Write the first update</button>}</div> : <div className="space-y-4">
      {posts.map((post) => <article key={post.id} className="rounded-[24px] bg-white p-5 shadow-kinship-1">
        <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-[#F05A4A]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#AD2A20]">{POST_TYPE_LABEL[post.postType]}</span><h3 className="mt-3 font-extrabold text-[#1E293B]">{post.authorDisplayName}</h3><p className="mt-0.5 text-xs text-[#64748B]">{post.neighborhood}, {city.name} · {new Date(post.createdAt).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'})}</p></div><div className="flex items-center gap-1">{post.authorId === userId ? <button type="button" disabled={busyPostId === post.id} onClick={() => void deletePost(post)} aria-label="Delete your update" className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4"/></button> : <><button type="button" disabled={busyPostId === post.id} onClick={() => void blockAuthor(post)} aria-label={`Block ${post.authorDisplayName}`} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><Ban className="h-4 w-4"/></button><button type="button" onClick={() => setReportTarget({id: post.authorId, name: post.authorDisplayName})} aria-label={`Report ${post.authorDisplayName}`} className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Flag className="h-4 w-4"/></button></>}</div></div>
        {post.flatTitle && <div className="mt-4 rounded-xl bg-[#FAF9F6] p-3"><p className="text-sm font-bold text-[#1E293B]">{post.flatTitle}</p>{post.rentPerMonth !== null && <p className="mt-1 text-xs font-semibold text-[#64748B]">₹{new Intl.NumberFormat('en-IN').format(post.rentPerMonth)} per month</p>}</div>}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#334155]">{post.caption}</p>
        {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-[#F4F2EE] px-2.5 py-1 text-[10px] font-bold text-[#64748B]">#{tag.replace(/\s+/g, '')}</span>)}</div>}
        <div className="mt-4 flex items-center gap-4 border-t border-slate-900/5 pt-3">
          <button type="button" disabled={busyPostId === post.id} onClick={() => void toggleLike(post)} aria-pressed={post.likedByMe} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#475569] disabled:opacity-50"><Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-[#F05A4A] text-[#F05A4A]' : ''}`}/>{post.likeCount}</button>
          <button type="button" onClick={() => void showPostComments(post)} aria-expanded={openComments === post.id} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#475569]"><MessageCircle className="h-4 w-4"/>{post.commentCount} comments</button>
          <button type="button" disabled={busyPostId === post.id} onClick={() => void toggleSave(post)} aria-pressed={post.savedByMe} aria-label={post.savedByMe ? 'Unsave update' : 'Save update'} className="ml-auto rounded-full p-2 text-[#475569] disabled:opacity-50"><Bookmark className={`h-4 w-4 ${post.savedByMe ? 'fill-amber-500 text-amber-600' : ''}`}/></button>
        </div>
        {openComments === post.id && <div className="mt-2 space-y-3 border-t border-slate-900/5 pt-3">
          {commentCursors[post.id] && <button type="button" disabled={loadingOlderComments} onClick={() => void loadOlderComments(post.id)} className="text-xs font-bold text-[#64748B] disabled:opacity-50">{loadingOlderComments ? 'Loading…' : 'Load older comments'}</button>}
          {(comments[post.id] ?? post.comments).map((comment) => <p key={comment.id} className="text-xs leading-5"><span className="mr-1.5 font-bold text-[#1E293B]">{comment.authorDisplayName}</span><span className="text-[#475569]">{comment.body}</span><span className="ml-2 text-[#94A3B8]">{new Date(comment.createdAt).toLocaleDateString('en-IN')}</span></p>)}
          <form onSubmit={(event) => void submitComment(event, post)} className="flex items-center gap-2"><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Write a helpful comment…" aria-label="Comment" className="h-10 flex-1 rounded-full bg-[#F4F2EE] px-4 text-xs outline-none focus:ring-2 focus:ring-[#F05A4A]/40"/><button type="submit" disabled={busyPostId === post.id || !commentDraft.trim()} aria-label="Send comment" className="grid h-10 w-10 place-items-center rounded-full bg-[#F05A4A] text-white disabled:opacity-50"><Send className="h-4 w-4"/></button></form>
        </div>}
      </article>)}
    </div>}
    {!loading && nextCursor && <div className="text-center"><button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1E293B] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more updates'}</button></div>}
    {showComposer && <CreatePostModal defaultCity={cityId} defaultNeighborhood={neighborhood} onClose={() => setShowComposer(false)} onPublish={publish}/>}
    {reportTarget && <ReportMemberDialog userId={reportTarget.id} displayName={reportTarget.name} onClose={() => setReportTarget(null)}/>}
  </section>;
}
