import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Sparkles, Send, User, Bot, RotateCcw, FileText, Loader2 } from 'lucide-react';
import { useResume } from '../context/ResumeContext';
import { useAuth } from '../context/AuthContext';
import { resumeToText } from '../utils/resumeText';

const SUGGESTIONS = [
    'Review my resume and tell me the 3 biggest improvements',
    'Which skills should I learn next for my target role?',
    'How do I answer "Tell me about yourself"?',
    'How can I get a referral at a top company?',
    'How should I negotiate my first job offer?',
    'Write a strong LinkedIn headline for me',
];

const WELCOME = {
    role: 'assistant',
    content: "Hi! I'm your AI career coach. Ask me anything about resumes, interviews, skills to learn, job search or offers. I can see the resume in your Resume Builder, so my advice is personalised.",
};

const storageKey = (userId) => `aiready-coach-${userId || 'guest'}`;
const loadHistory = (userId) => {
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey(userId)) || 'null');
        return Array.isArray(saved) && saved.length ? saved : [WELCOME];
    } catch {
        return [WELCOME];
    }
};

const CareerCoach = () => {
    const { user } = useAuth();
    const { resumeData, resumeId, loadFromCloud } = useResume();
    const [messages, setMessages] = useState(() => loadHistory(user?._id));
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [useResumeContext, setUseResumeContext] = useState(true);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (!resumeId) loadFromCloud();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        try { sessionStorage.setItem(storageKey(user?._id), JSON.stringify(messages.slice(-30))); } catch { /* storage unavailable */ }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, user]);

    const resumeText = resumeToText(resumeData);
    const hasResume = !!resumeId && resumeText.length > 80;

    const send = async (text) => {
        const content = (text ?? input).trim();
        if (!content || sending) return;
        const next = [...messages, { role: 'user', content }];
        setMessages(next);
        setInput('');
        setError('');
        setSending(true);
        try {
            const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const token = localStorage.getItem('token');
            // the welcome message is UI only; send the real conversation (last 20 turns)
            const history = next.filter((m) => m.content !== WELCOME.content).slice(-20).map(({ role, content: c }) => ({ role, content: c.slice(0, 4000) }));
            const { data } = await axios.post(`${NODE_API}/ai/career-chat`, {
                messages: history,
                resume_text: useResumeContext && hasResume ? resumeText : undefined,
            }, { headers: { Authorization: `Bearer ${token}` } });
            setMessages([...next, { role: 'assistant', content: data.reply, offline: !!data.fallback }]);
        } catch (err) {
            setError(err.response?.data?.message || 'The coach could not answer right now. Please try again.');
            setMessages(messages); // roll back the unanswered question
            setInput(content);
        } finally {
            setSending(false);
        }
    };

    const reset = () => {
        setMessages([WELCOME]);
        setError('');
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto font-sans flex flex-col h-[calc(100vh-4rem)] md:h-screen">
            <header className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Sparkles className="text-brand-600" size={30} />
                        AI Career Coach
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">Personal advice on resumes, interviews, skills and your job search.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border ${hasResume ? 'border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700 text-slate-400'}`}
                        title={hasResume ? 'Let the coach read your Resume Builder resume' : 'Create a resume in the Resume Builder to get personalised advice'}>
                        <input type="checkbox" className="accent-brand-600" checked={useResumeContext && hasResume} disabled={!hasResume}
                            onChange={(e) => setUseResumeContext(e.target.checked)} />
                        <FileText size={14} /> {hasResume ? 'Use my resume' : 'No resume yet'}
                    </label>
                    <button onClick={reset} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:border-brand-300 transition-colors">
                        <RotateCcw size={14} /> New chat
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-soft p-4 md:p-6 space-y-5">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200' : 'bg-brand-600 text-white'}`}>
                            {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                        </div>
                        <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                            ? 'bg-brand-600 text-white rounded-tr-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'}`}>
                            {m.content}
                            {m.offline && <div className="mt-2 text-[11px] font-bold text-amber-600">Offline answer - the AI model is unavailable right now.</div>}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center"><Bot size={18} /></div>
                        <div className="rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 text-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" /> Thinking...
                        </div>
                    </div>
                )}
                {messages.length === 1 && !sending && (
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SUGGESTIONS.map((s) => (
                            <button key={s} onClick={() => send(s)} className="text-left text-sm font-medium px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-colors">
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {error && <div className="mt-3 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
                <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask about your resume, interviews, skills, offers..."
                    maxLength={4000}
                    className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <button type="submit" disabled={sending || !input.trim()} aria-label="Send"
                    className="px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-2 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors">
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};

export default CareerCoach;
