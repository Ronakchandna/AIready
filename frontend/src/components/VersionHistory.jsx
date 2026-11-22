import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { X, History, Save, RotateCcw, Trash2, Loader2, TrendingUp } from 'lucide-react';

const API = () => process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const scoreColor = (s) => (s >= 70 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : s >= 50
    ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20');

// Small inline chart of match scores over time (oldest -> newest)
const ScoreTrend = ({ versions }) => {
    const pts = versions.filter((v) => typeof v.score === 'number').slice().reverse();
    if (pts.length < 2) return null;
    const w = 300, h = 70, pad = 8;
    const x = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
    const y = (s) => h - pad - (s / 100) * (h - 2 * pad);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
    const change = pts[pts.length - 1].score - pts[0].score;
    return (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                <span className="flex items-center gap-1"><TrendingUp size={14} /> Match score over time</span>
                <span className={change >= 0 ? 'text-emerald-600' : 'text-red-600'}>{change >= 0 ? '+' : ''}{change} points</span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" role="img" aria-label="Score trend">
                <path d={d} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => <circle key={p._id} cx={x(i)} cy={y(p.score)} r="3.5" fill="#4f46e5" />)}
            </svg>
        </div>
    );
};

/**
 * Side panel listing saved versions of the current resume.
 * Props: resumeId, onBeforeSnapshot (saves the editor first), onRestored (reloads the editor), onClose
 */
const VersionHistory = ({ resumeId, onBeforeSnapshot, onRestored, onClose }) => {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [label, setLabel] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!resumeId) { setLoading(false); return; }
        try {
            const { data } = await axios.get(`${API()}/resume/${resumeId}/versions`, auth());
            setVersions(data.data || []);
        } catch {
            setError('Could not load versions.');
        } finally {
            setLoading(false);
        }
    }, [resumeId]);

    useEffect(() => { load(); }, [load]);

    const run = async (key, fn) => {
        setBusy(key);
        setError('');
        try { await fn(); } catch (e) { setError(e.response?.data?.message || 'Something went wrong.'); } finally { setBusy(''); }
    };

    const snapshot = () => run('save', async () => {
        await onBeforeSnapshot();
        await axios.post(`${API()}/resume/${resumeId}/versions`, { label }, auth());
        setLabel('');
        await load();
    });

    const restore = (v) => run(v._id, async () => {
        if (!window.confirm(`Restore "${v.label}"? Your current resume is kept as a version too.`)) return;
        await onBeforeSnapshot();
        await axios.post(`${API()}/resume/${resumeId}/versions/${v._id}/restore`, {}, auth());
        await onRestored();
        await load();
    });

    const remove = (v) => run(v._id, async () => {
        if (!window.confirm(`Delete version "${v.label}"?`)) return;
        await axios.delete(`${API()}/resume/${resumeId}/versions/${v._id}`, auth());
        await load();
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <aside className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 shadow-2xl flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><History className="text-brand-600" size={20} /> Version history</h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
                </div>

                {!resumeId ? (
                    <p className="p-6 text-sm text-slate-500">Save your resume to the cloud first, then you can keep versions of it.</p>
                ) : (
                    <>
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Save a snapshot before big changes. Each version keeps the match score from your latest analysis, so you can see your progress.</p>
                            <div className="flex gap-2">
                                <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Tailored for Google SDE"
                                    className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                                <button onClick={snapshot} disabled={!!busy} className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
                                    {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                                </button>
                            </div>
                            {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {loading ? (
                                <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>
                            ) : versions.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-10">No versions yet.</p>
                            ) : (
                                <>
                                    <ScoreTrend versions={versions} />
                                    <ul className="space-y-3">
                                        {versions.map((v) => (
                                            <li key={v._id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 flex items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{v.label || 'Untitled version'}</div>
                                                    <div className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {v.skillCount} skills</div>
                                                </div>
                                                {typeof v.score === 'number' && <span className={`text-xs font-black px-2 py-1 rounded-lg ${scoreColor(v.score)}`}>{v.score}</span>}
                                                <button onClick={() => restore(v)} disabled={!!busy} title="Restore this version" className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                                    {busy === v._id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                                </button>
                                                <button onClick={() => remove(v)} disabled={!!busy} title="Delete version" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={16} /></button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </>
                )}
            </aside>
        </div>
    );
};

export default VersionHistory;
