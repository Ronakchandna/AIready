import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { X, FolderOpen, Plus, Trash2, Copy, Pencil, Loader2, Check, FileText } from 'lucide-react';

const API = () => process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const when = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Side panel listing all of the user's saved resumes: open, rename, duplicate, delete, create new.
 * Props: currentId, onBeforeSwitch (saves the editor first), onOpen(resume), onNew(), onRenamed(title), onClose
 */
const MyResumes = ({ currentId, onBeforeSwitch, onOpen, onNew, onRenamed, onClose }) => {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [renaming, setRenaming] = useState(null); // { id, title }

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API()}/resume/all`, auth());
            setResumes(data.data || []);
        } catch {
            setError('Could not load your resumes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const run = async (key, fn) => {
        setBusy(key);
        setError('');
        try { await fn(); } catch (e) { setError(e.response?.data?.message || 'Something went wrong.'); } finally { setBusy(''); }
    };

    const open = (r) => run(r._id, async () => {
        if (r._id !== currentId && currentId) await onBeforeSwitch();
        onOpen(r);
        onClose();
    });

    const createNew = () => run('new', async () => {
        if (currentId) await onBeforeSwitch();
        onNew();
        onClose();
    });

    const duplicate = (r) => run(r._id, async () => {
        await axios.post(`${API()}/resume`, { title: `${r.title || 'Resume'} (copy)`, content: r.content }, auth());
        await load();
    });

    const saveTitle = () => run(renaming.id, async () => {
        const title = renaming.title.trim();
        if (title) {
            await axios.post(`${API()}/resume`, { id: renaming.id, title }, auth());
            if (renaming.id === currentId) onRenamed(title); // keep the editor's title in sync
        }
        setRenaming(null);
        await load();
    });

    const remove = (r) => run(r._id, async () => {
        if (!window.confirm(`Delete "${r.title || 'Untitled resume'}"? This also deletes its saved versions and cannot be undone.`)) return;
        await axios.delete(`${API()}/resume/${r._id}`, auth());
        if (r._id === currentId) onNew(); // the open resume is gone: start fresh
        await load();
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <aside className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 shadow-2xl flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><FolderOpen className="text-brand-600" size={20} /> My resumes</h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
                </div>

                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Keep a separate resume for each kind of job. Your current resume is saved before you switch.</p>
                    <button onClick={createNew} disabled={!!busy} className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} New blank resume
                    </button>
                    {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>
                    ) : resumes.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-10">No saved resumes yet. Click "Save to Cloud" in the builder.</p>
                    ) : (
                        <ul className="space-y-3">
                            {resumes.map((r) => {
                                const current = r._id === currentId;
                                const c = r.content || {};
                                return (
                                    <li key={r._id} className={`rounded-xl border p-3 ${current ? 'border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10' : 'border-slate-100 dark:border-slate-800'}`}>
                                        {renaming?.id === r._id ? (
                                            <form onSubmit={(e) => { e.preventDefault(); saveTitle(); }} className="flex gap-2">
                                                <input autoFocus value={renaming.title} maxLength={120} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                                                    className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                                                <button type="submit" aria-label="Save name" className="p-2 rounded-lg text-brand-600 hover:bg-brand-50"><Check size={16} /></button>
                                                <button type="button" aria-label="Cancel" onClick={() => setRenaming(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                                            </form>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => open(r)} disabled={!!busy} className="flex-1 min-w-0 text-left flex items-center gap-3 group">
                                                    <FileText size={20} className="text-brand-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-700">
                                                            {r.title || 'Untitled resume'} {current && <span className="ml-1 text-[10px] uppercase tracking-wider text-brand-600">Open</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {[c.contact?.fullName, `${(c.experience || []).length} exp`, `${(c.skills || []).length} skills`].filter(Boolean).join(' · ')}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">Updated {when(r.updatedAt)}</div>
                                                    </div>
                                                </button>
                                                {busy === r._id && <Loader2 size={16} className="animate-spin text-slate-400" />}
                                                <button onClick={() => setRenaming({ id: r._id, title: r.title || '' })} disabled={!!busy} title="Rename" className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"><Pencil size={15} /></button>
                                                <button onClick={() => duplicate(r)} disabled={!!busy} title="Duplicate" className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"><Copy size={15} /></button>
                                                <button onClick={() => remove(r)} disabled={!!busy} title="Delete" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>
        </div>
    );
};

export default MyResumes;
