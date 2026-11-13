import { useState, type FormEvent } from 'react';
import { fieldErrors, packageSchema, type GymPackageRow } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Icon } from '../../components/ui/Icon';
import { durationLabel, rwf } from '../../lib/format';
import { Empty, ErrorNote, Modal, PageHead, Skeleton, Toggle } from '../ui';

const PRESETS = [
  { label: 'Day', days: 1 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

type Form = { id?: string; name: string; description: string; durationDays: string; priceRwf: string; perks: string; active: boolean };
const blank: Form = { name: '', description: '', durationDays: '30', priceRwf: '', perks: 'Full gym access', active: true };

function Editor({ initial, onClose, onSaved }: { initial: Form; onClose: () => void; onSaved: (p: GymPackageRow[]) => void }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      name: f.name,
      description: f.description || null,
      durationDays: f.durationDays,
      priceRwf: f.priceRwf.replace(/[,\s]/g, ''),
      perks: f.perks.split('\n').map((s) => s.trim()).filter(Boolean),
      active: f.active,
    };
    const parsed = packageSchema.safeParse(body);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const r = await api<{ packages: GymPackageRow[] }>(f.id ? `/gym/packages/${f.id}` : '/gym/packages', { method: f.id ? 'PUT' : 'POST', body: parsed.data });
      onSaved(r.packages);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.fields) setErrors(e2.fields);
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save');
      setBusy(false);
    }
  };
  const priceChanged = initial.id && initial.priceRwf !== f.priceRwf;

  return (
    <Modal open onClose={onClose} title={f.id ? 'Edit package' : 'New package'}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <ErrorNote message={err} />
        <div>
          <label className="field-label" htmlFor="pk-name">Name</label>
          <input id="pk-name" className="field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Monthly unlimited" aria-invalid={!!errors.name} />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <span className="field-label">Length</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.days} type="button" className="chip !h-9 !px-3.5 !text-[13px]" aria-pressed={f.durationDays === String(p.days)} onClick={() => set('durationDays', String(p.days))}>{p.label}</button>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted">
              <input className="field !h-9 !w-24 !rounded-full !px-3" inputMode="numeric" value={f.durationDays} onChange={(e) => set('durationDays', e.target.value.replace(/\D/g, ''))} aria-label="Days" aria-invalid={!!errors.durationDays} /> days
            </label>
          </div>
          {errors.durationDays && <p className="field-error">{errors.durationDays}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="pk-price">Price (RWF)</label>
          <input id="pk-price" className="field" inputMode="numeric" value={f.priceRwf} onChange={(e) => set('priceRwf', e.target.value.replace(/[^\d,]/g, ''))} placeholder="40,000" aria-invalid={!!errors.priceRwf} />
          {errors.priceRwf && <p className="field-error">{errors.priceRwf}</p>}
          {priceChanged && <p className="mt-2 text-[13px] text-warning">Members who already paid keep their current price. The new price applies to new purchases and renewals. The change is logged.</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="pk-desc">Description <span className="font-normal text-faint">(optional)</span></label>
          <input id="pk-desc" className="field" value={f.description} maxLength={300} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pk-perks">What’s included <span className="font-normal text-faint">(one per line, up to 8)</span></label>
          <textarea id="pk-perks" className="field !min-h-[110px]" value={f.perks} onChange={(e) => set('perks', e.target.value)} aria-invalid={!!errors.perks} />
          {errors.perks && <p className="field-error">{errors.perks}</p>}
        </div>
        <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Available to buy" hint="Hidden packages stay valid for members who already have them." />
        <button type="submit" className="btn btn-gold !h-[52px]" disabled={busy}>{busy ? 'Saving…' : 'Save package'}</button>
      </form>
    </Modal>
  );
}

export default function Packages() {
  useDocumentTitle('Packages');
  const { data, loading, setData } = useFetch<{ packages: GymPackageRow[] }>('/gym/packages');
  const [editing, setEditing] = useState<Form | null>(null);
  const [err, setErr] = useState('');
  const list = data?.packages ?? [];

  const move = async (i: number, dir: -1 | 1) => {
    const ids = list.map((p) => p.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    setData({ packages: ids.map((id) => list.find((p) => p.id === id)!) });
    try {
      setData(await api('/gym/packages/order', { method: 'PUT', body: { ids } }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not reorder');
    }
  };
  const remove = async (p: GymPackageRow) => {
    if (!confirm(`Delete “${p.name}”?`)) return;
    try {
      await api(`/gym/packages/${p.id}`, { method: 'DELETE' });
      setData({ packages: list.filter((x) => x.id !== p.id) });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not delete');
    }
  };

  return (
    <>
      <PageHead eyebrow="Packages" title="Packages & prices" actions={<button type="button" className="btn btn-gold !h-11" onClick={() => setEditing(blank)}><Icon name="plus" size={16} /> New package</button>}>
        This is what members see on your gym profile, in this order. You set the prices.
      </PageHead>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {loading && !data ? <Skeleton h={300} /> : list.length === 0 ? <Empty>No packages yet. Add your first one so members can join.</Empty> : (
        <div className="flex flex-col gap-3">
          {list.map((p, i) => (
            <div key={p.id} className={`card flex flex-wrap items-center gap-4 p-5 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-col">
                <button type="button" aria-label="Move up" disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-field hover:text-text disabled:opacity-30" onClick={() => move(i, -1)}><Icon name="arrowRight" size={14} className="-rotate-90" /></button>
                <button type="button" aria-label="Move down" disabled={i === list.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-field hover:text-text disabled:opacity-30" onClick={() => move(i, 1)}><Icon name="arrowRight" size={14} className="rotate-90" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{p.name}</span>
                  {!p.active && <span className="rounded-full bg-field px-2.5 py-0.5 text-xs font-bold text-muted">HIDDEN</span>}
                </div>
                <div className="mt-1 text-sm text-muted">{durationLabel(p.durationDays)} · {p.perks.join(' · ') || 'No perks listed'}</div>
              </div>
              <div className="text-right">
                <div className="disp text-[30px] text-gold">{rwf(p.priceRwf)}</div>
                <div className="text-xs text-muted">{p.activeMembers} active member{p.activeMembers === 1 ? '' : 's'}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost !h-10 !px-4" onClick={() => setEditing({ id: p.id, name: p.name, description: p.description ?? '', durationDays: String(p.durationDays), priceRwf: p.priceRwf.toLocaleString('en-US'), perks: p.perks.join('\n'), active: p.active })}>Edit</button>
                <button type="button" className="btn btn-ghost !h-10 !px-4" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Icon name="close" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <Editor initial={editing} onClose={() => setEditing(null)} onSaved={(packages) => { setData({ packages }); setEditing(null); }} />}
    </>
  );
}
