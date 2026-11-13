import { useRef, useState } from 'react';
import type { GymPhotoRow } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Icon } from '../../components/ui/Icon';
import { Empty, ErrorNote, PageHead, Skeleton } from '../ui';

const MAX = 12;
const moveId = (ids: string[], from: number, to: number) => { const a = [...ids]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
const MAX_MB = 8;

export default function Photos() {
  useDocumentTitle('Photos');
  const { data, loading, setData } = useFetch<{ photos: GymPhotoRow[] }>('/gym/photos');
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const photos = data?.photos ?? [];

  const upload = async (files: FileList | File[]) => {
    setErr('');
    const list = Array.from(files).slice(0, MAX - photos.length);
    for (const file of list) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErr(`${file.name}: use JPEG, PNG or WebP`); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { setErr(`${file.name}: larger than ${MAX_MB} MB`); continue; }
      setUploading((n) => n + 1);
      try {
        const r = await api<{ photo: GymPhotoRow }>('/gym/photos', { method: 'POST', body: file });
        setData((d) => ({ photos: [...(d?.photos ?? []), r.photo] }));
      } catch (e) {
        setErr(`${file.name}: ${e instanceof ApiError ? e.message : 'upload failed'}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const reorder = async (ids: string[]) => {
    setData({ photos: ids.map((id) => photos.find((p) => p.id === id)!) });
    try { setData(await api('/gym/photos/order', { method: 'PUT', body: { ids } })); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not reorder'); }
  };
  const makeCover = (id: string) => reorder([id, ...photos.filter((p) => p.id !== id).map((p) => p.id)]);
  const remove = async (p: GymPhotoRow) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api(`/gym/photos/${p.id}`, { method: 'DELETE' });
      setData({ photos: photos.filter((x) => x.id !== p.id) });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not delete'); }
  };
  const caption = async (p: GymPhotoRow, c: string) => {
    if ((p.caption ?? '') === c) return;
    try {
      const r = await api<{ photo: GymPhotoRow }>(`/gym/photos/${p.id}`, { method: 'PATCH', body: { caption: c || null } });
      setData({ photos: photos.map((x) => (x.id === p.id ? r.photo : x)) });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save caption'); }
  };

  return (
    <>
      <PageHead eyebrow="Photos" title="Photos">The first photo is your cover on the map and in search. Up to {MAX} photos, JPEG/PNG/WebP, at least 600 px wide.</PageHead>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
        disabled={photos.length >= MAX}
        className={`mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed p-10 text-center transition-colors disabled:opacity-50 ${drag ? 'border-gold bg-gold-deep' : 'border-line-2 bg-surface hover:border-gold'}`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold text-gold-ink"><Icon name="plus" size={22} strokeWidth={2.6} /></span>
        <span className="font-semibold">{uploading ? `Uploading ${uploading}…` : photos.length >= MAX ? 'Photo limit reached' : 'Drop photos here or click to choose'}</span>
        <span className="text-[13px] text-muted">{photos.length}/{MAX} used · location data is removed automatically</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
      <div className="mb-5"><ErrorNote message={err} /></div>

      {loading && !data ? <Skeleton h={260} /> : photos.length === 0 ? <Empty>No photos yet. Gyms with photos get far more visits.</Empty> : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((p, i) => (
            <figure key={p.id} className="card m-0 overflow-hidden">
              <div className="relative aspect-[4/3] bg-field">
                <img src={p.url} alt={p.caption ?? 'Gym photo'} className="h-full w-full object-cover" loading="lazy" />
                {i === 0 && <span className="absolute top-3 left-3 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gold-ink">COVER</span>}
              </div>
              <figcaption className="flex flex-col gap-3 p-4">
                <input className="field !h-10 !text-sm" placeholder="Caption (optional)" defaultValue={p.caption ?? ''} maxLength={120} onBlur={(e) => caption(p, e.target.value.trim())} aria-label="Caption" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" disabled={i === 0} onClick={() => reorder(moveId(photos.map((x) => x.id), i, i - 1))}>← Earlier</button>
                  <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" disabled={i === photos.length - 1} onClick={() => reorder(moveId(photos.map((x) => x.id), i, i + 1))}>Later →</button>
                  {i !== 0 && <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => makeCover(p.id)}>Make cover</button>}
                  <button type="button" className="btn btn-ghost ml-auto !h-9 !px-3 !text-[13px] text-error" onClick={() => remove(p)}>Delete</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
