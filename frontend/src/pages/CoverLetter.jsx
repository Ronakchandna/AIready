import React, { useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { clean as cleanPdfText } from '../utils/generateAtsPdf';
import { PenTool, Download, Copy, CheckCircle, FileText } from 'lucide-react';

const CoverLetter = () => {
    const [resumeText, setResumeText] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!resumeText.trim() || !jobDescription.trim()) {
            setError('Please provide both your resume text and the job description.');
            return;
        }

        setLoading(true);
        setError('');
        setCoverLetter('');

        try {
            const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const token = localStorage.getItem('token');
            const response = await axios.post(`${NODE_API}/ai/generate-cover-letter`, {
                resume_text: resumeText,
                job_description: jobDescription
            }, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            if (response.data.success) {
                setCoverLetter(response.data.cover_letter);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to generate cover letter. Please check your connection or AI Engine.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(coverLetter);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadPDF = () => {
        if (!coverLetter) return;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10.5);
        pdf.setTextColor(30, 41, 59);

        let currentY = 25;
        const paragraphs = coverLetter.split('\n');

        paragraphs.forEach(p => {
            if (!p.trim()) {
                currentY += 4;
                return;
            }
            const lines = pdf.splitTextToSize(cleanPdfText(p), contentWidth);
            lines.forEach(line => {
                if (currentY > pageHeight - margin) {
                    pdf.addPage();
                    currentY = margin;
                }
                pdf.text(line, margin, currentY);
                currentY += 5.5;
            });
            currentY += 3;
        });

        pdf.save('Cover_Letter.pdf');
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
            <header>
                <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <PenTool className="text-brand-600" size={32} />
                    AI Cover Letter Generator
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">Instantly draft a tailored, professional cover letter using your resume and the target job description.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={16} className="text-brand-500" />
                            Your Resume Text
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Paste the core text from your resume. The AI will use this to highlight your actual experience.</p>
                        <textarea
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 h-48 focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-500 bg-slate-50 dark:bg-slate-950 transition-all text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none"
                            placeholder="e.g. Senior Software Engineer with 5+ years of experience in React, Node.js..."
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                        />
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                            Target Job Description
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Paste the job description you are applying for. We will align your cover letter perfectly to these requirements.</p>
                        <textarea
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 h-48 focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-500 bg-slate-50 dark:bg-slate-950 transition-all text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none"
                            placeholder="e.g. We are looking for a Senior React Developer with Next.js experience to lead our frontend team..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                    </div>

                    {error && <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !resumeText.trim() || !jobDescription.trim()}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-95 flex items-center justify-center gap-2 ${loading || !resumeText.trim() || !jobDescription.trim() ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none text-slate-500 dark:text-slate-400' : 'bg-brand-600 hover:bg-brand-700 shadow-glow hover:shadow-glow-lg'}`}
                    >
                        {loading ? 'Crafting your perfect letter...' : '✨ Generate Cover Letter'}
                    </button>
                </div>

                {/* Preview Column */}
                <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-2xl flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-inner min-h-[600px]">
                    {coverLetter ? (
                        <>
                            <div className="flex justify-end gap-3 mb-4">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 border font-medium text-sm transition-colors"
                                >
                                    {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    {copied ? 'Copied!' : 'Copy Text'}
                                </button>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg shadow-sm hover:bg-slate-900 font-medium text-sm transition-colors"
                                >
                                    <Download size={16} />
                                    Download PDF
                                </button>
                            </div>

                            <div
                                id="cover-letter-preview"
                                className="bg-white dark:bg-slate-800 p-10 flex-1 shadow-md border border-slate-200 dark:border-slate-700 rounded-xl overflow-y-auto whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed font-serif text-sm"
                            >
                                {coverLetter}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center space-y-4">
                            <PenTool size={48} className="opacity-50" />
                            <p className="font-medium max-w-xs">Your AI-generated cover letter will appear here formatted as a clean, structured document.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoverLetter;
