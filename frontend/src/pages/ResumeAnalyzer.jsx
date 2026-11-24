import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileText, Activity, X, Loader2, Lightbulb, AlertTriangle, Sparkles, PenTool } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useResume } from '../context/ResumeContext';
import { resumeToText } from '../utils/resumeText';
import { NODE_API, postAi, aiErrorText, checkPdf, WAKING_MESSAGE, warmUpAi, MAX_PDF_MB } from '../utils/aiClient';

const MAX_JD = 15000;
const MAX_RESUME = 30000;

const BREAKDOWN_LABELS = {
    sections: 'Section headings',
    contact: 'Contact details',
    length: 'Length',
    quantified_impact: 'Quantified impact',
    action_verbs: 'Action verbs',
    bullet_points: 'Bullet points',
    projects: 'Projects',
};

const Dial = ({ value, color, label, caption, suffix = '' }) => (
    <div className="flex flex-col items-center">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">{label}</h3>
        <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={[{ value }, { value: Math.max(0, 100 - value) }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                        startAngle={90} endAngle={-270} dataKey="value" stroke="none" isAnimationActive={false}>
                        <Cell fill={color} />
                        <Cell fill="#e2e8f0" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{Math.round(value)}{suffix}</span>
            </div>
        </div>
        <p className="text-center text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium max-w-[180px]">{caption}</p>
    </div>
);

const Chips = ({ items, tone }) => (
    <div className="flex flex-wrap gap-2">
        {items.map((kw) => (
            <span key={kw} className={`px-3 py-1.5 border text-xs font-bold rounded-full ${tone === 'good'
                ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-800/60 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400'}`}>{kw}</span>
        ))}
    </div>
);

const ResumeAnalyzer = () => {
    const { resumeData, resumeId, loadFromCloud } = useResume();
    const [source, setSource] = useState('pdf'); // 'pdf' | 'builder'
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        warmUpAi(); // start waking the free AI engine while the user fills the form
        if (!resumeId) loadFromCloud();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const builderText = resumeToText(resumeData);
    const hasBuilderResume = !!resumeId && builderText.length > 80;

    const pickFile = (f) => {
        if (!f) return;
        const problem = checkPdf(f);
        setError(problem);
        setFile(problem ? null : f);
        setResult(null);
    };

    const handleAnalyze = async () => {
        const jd = jobDescription.trim();
        if (source === 'pdf' && !file) return setError('Please upload your resume PDF.');
        if (source === 'builder' && !hasBuilderResume) return setError('Your Resume Builder resume is empty. Fill it in or upload a PDF instead.');
        if (jd.length < 30) return setError('Paste the full job description (at least a few sentences) so the match is meaningful.');

        setError('');
        setResult(null);
        setLoading(true);
        setStatus('Analyzing your resume...');

        const formData = new FormData();
        if (source === 'pdf') formData.append('resume_file', file);
        else formData.append('resume_text', builderText.slice(0, MAX_RESUME));
        formData.append('job_description', jd.slice(0, MAX_JD));

        try {
            const response = await postAi('/ai/analyze-resume', formData, {
                onStatus: (s) => setStatus(s === 'waking' ? WAKING_MESSAGE : 'Analyzing your resume...'),
            });
            const analysis = { ...response.data.data, warning: response.data.warning };
            setResult(analysis);

            // Save the score for the dashboard (best effort)
            const token = localStorage.getItem('token');
            if (token) {
                axios.post(`${NODE_API}/user/resume-analysis`, {
                    score: Math.round(analysis.score || 0),
                    missingKeywords: analysis.missing_keywords || [],
                    feedback: analysis.feedback || 'Analysis Completed'
                }, { headers: { Authorization: `Bearer ${token}` } }).catch((e) => console.error('Failed to save analysis score:', e));
            }
        } catch (err) {
            console.error(err);
            setError(aiErrorText(err, 'The analysis failed. Please try again.'));
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const tabClass = (active) => `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${active
        ? 'bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 shadow-sm'
        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`;

    const atsBreakdown = result?.breakdown?.ats ? Object.entries(result.breakdown.ats) : [];
    const suggestions = [...(result?.ai_suggestions || []), ...(result?.suggestions || [])];

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Resume Analyzer</h1>
                <p className="text-gray-600 dark:text-gray-400">Check your resume against a job description: match score, ATS score, missing skills and how to improve.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100"><UploadCloud size={20} className="text-brand-600" /> Your resume</h2>
                        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 mb-4">
                            <button type="button" className={tabClass(source === 'pdf')} onClick={() => { setSource('pdf'); setError(''); }}><UploadCloud size={16} /> Upload PDF</button>
                            <button type="button" className={tabClass(source === 'builder')} onClick={() => { setSource('builder'); setError(''); }}><PenTool size={16} /> From Resume Builder</button>
                        </div>

                        {source === 'pdf' ? (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => inputRef.current?.click()}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragging
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            >
                                <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" data-testid="resume-file"
                                    onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <FileText className="text-brand-600 shrink-0" size={28} />
                                        <div className="text-left min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[220px]">{file.name}</p>
                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB - click to change</p>
                                        </div>
                                        <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><X size={18} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <UploadCloud className="mx-auto text-brand-500 mb-2" size={32} />
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Click to choose or drag your resume PDF here</p>
                                        <p className="text-xs text-slate-500 mt-1">PDF up to {MAX_PDF_MB} MB. Scanned PDFs are read with OCR.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className={`rounded-xl border p-4 text-sm ${hasBuilderResume ? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10' : 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800'}`}>
                                {hasBuilderResume ? (
                                    <>
                                        <p className="font-bold text-slate-800 dark:text-slate-100">{resumeData.contact?.fullName || resumeData.title || 'My resume'}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {(resumeData.experience || []).length} experience, {(resumeData.projects || []).length} projects, {(resumeData.skills || []).length} skills - the latest version from your Resume Builder.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-amber-700 dark:text-amber-400 font-medium">Your Resume Builder resume is empty. Create one in the Resume Builder or upload a PDF.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100"><FileText size={20} className="text-brand-600" /> Target job description</h2>
                        <textarea
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 h-48 focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 bg-slate-50 dark:bg-slate-950 outline-none transition-all resize-y text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                            placeholder="Paste the full job description: responsibilities, requirements, skills..."
                            value={jobDescription}
                            maxLength={MAX_JD}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                        <p className="text-right text-[11px] text-slate-400 mt-1">{jobDescription.length.toLocaleString()} / {MAX_JD.toLocaleString()}</p>
                    </div>

                    {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/40">{error}</div>}

                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${loading ? 'bg-brand-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 shadow-glow hover:shadow-glow-lg active:scale-[0.98]'}`}
                    >
                        {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : 'Analyze Match Score'}
                    </button>
                    {loading && status && <p className="text-sm text-center text-slate-500 dark:text-slate-400 font-medium">{status}</p>}
                </div>

                {/* Results */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 md:p-8 flex flex-col">
                    <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100"><Activity size={24} /> Analysis Report</h2>

                    {!result ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16 text-center">
                            {loading ? <Loader2 size={48} className="mb-4 animate-spin text-brand-400" /> : <FileText size={48} className="mb-4 opacity-50" />}
                            <p>{loading ? 'Reading your resume and comparing it with the job...' : 'Add your resume and a job description to see your scores.'}</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col py-4 mt-2 space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <Dial label="Job Match" value={result.score || 0} suffix="%" caption={result.feedback}
                                    color={result.score >= 75 ? '#22c55e' : result.score >= 50 ? '#eab308' : '#ef4444'} />
                                <Dial label="ATS Score" value={result.base_score || 0} caption="Structure, contact info, impact and formatting"
                                    color={(result.base_score || 0) >= 80 ? '#3b82f6' : (result.base_score || 0) >= 60 ? '#f97316' : '#ef4444'} />
                            </div>

                            {result.breakdown && (
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    {[['Skill coverage', result.breakdown.skill_coverage], ['Keyword phrases', result.breakdown.phrase_coverage], ['Text similarity', result.breakdown.text_similarity]].map(([label, v]) => (
                                        <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{v == null ? '-' : `${Math.round(v)}%`}</p>
                                            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {suggestions.length > 0 && (
                                <div className="bg-brand-50/60 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/40 p-5 rounded-2xl">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                        {result.ai_suggestions?.length ? <Sparkles size={18} className="text-brand-600" /> : <Lightbulb size={18} className="text-brand-600" />}
                                        How to improve
                                    </h3>
                                    <ul className="space-y-2">
                                        {suggestions.slice(0, 8).map((s, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"><span className="text-brand-500 font-bold">{i + 1}.</span><span>{s}</span></li>
                                        ))}
                                    </ul>
                                    {result.warning && <p className="mt-3 text-[11px] font-bold text-amber-600">{result.warning}</p>}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.matched_keywords?.length > 0 && (
                                    <div className="p-5 border border-green-200 dark:border-green-900/50 rounded-2xl">
                                        <h3 className="font-bold text-green-800 dark:text-green-500 mb-3">Matched keywords ({result.matched_keywords.length})</h3>
                                        <Chips items={result.matched_keywords} tone="good" />
                                    </div>
                                )}
                                {result.missing_keywords?.length > 0 && (
                                    <div className="p-5 border border-red-200 dark:border-red-900/50 rounded-2xl">
                                        <h3 className="font-bold text-red-800 dark:text-red-500 mb-3">Missing keywords ({result.missing_keywords.length})</h3>
                                        <Chips items={result.missing_keywords} tone="bad" />
                                    </div>
                                )}
                            </div>

                            {atsBreakdown.length > 0 && (
                                <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">ATS score breakdown</h3>
                                    <div className="space-y-3">
                                        {atsBreakdown.map(([key, { score, max }]) => (
                                            <div key={key}>
                                                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                                    <span>{BREAKDOWN_LABELS[key] || key}</span><span>{score} / {max}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    <div className={`h-full rounded-full ${score / max >= 0.8 ? 'bg-green-500' : score / max >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${max ? (score / max) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {result.word_count != null && <p className="text-[11px] text-slate-400 mt-3">{result.word_count} words (ideal 300-900)</p>}
                                </div>
                            )}

                            {result.ats_issues?.length > 0 && (
                                <div className="p-5 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
                                    <h3 className="font-bold text-amber-800 dark:text-amber-500 mb-3 flex items-center gap-2"><AlertTriangle size={18} /> ATS issues to fix</h3>
                                    <ul className="space-y-1.5 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                                        {result.ats_issues.map((s) => <li key={s}>{s}</li>)}
                                    </ul>
                                </div>
                            )}

                            {result.section_analysis && (
                                <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Sections found</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(result.section_analysis).map(([section, isPresent]) => (
                                            <div key={section} className={`flex items-center gap-3 p-3 rounded-xl border ${isPresent ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50'}`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${isPresent ? 'bg-green-100 dark:bg-green-800/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-800/40 text-red-600 dark:text-red-400'}`}>
                                                    {isPresent ? '✓' : '×'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{section}</p>
                                                    <p className={`text-xs font-semibold ${isPresent ? 'text-green-600' : 'text-red-500'}`}>{isPresent ? 'Found' : 'Missing'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumeAnalyzer;
