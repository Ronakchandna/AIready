import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, Building2, MapPin, Link as LinkIcon, Plus, Trash2, Calendar, ChevronDown } from 'lucide-react';

const COLUMNS = [
    { id: 'saved', title: 'Saved Jobs', color: 'bg-slate-100 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700/50' },
    { id: 'applied', title: 'Applied', color: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/50' },
    { id: 'interviewing', title: 'Interviewing', color: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800/50' },
    { id: 'offer', title: 'Offers', color: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/50' }
];

const JobTracker = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ company: '', role: '', url: '', location: '', status: 'saved' });

    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem('token');
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${API_URL}/jobs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                setJobs(data.data);
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleAddJob = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.post(`${API_URL}/jobs`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                setJobs([data.data, ...jobs]);
                setShowModal(false);
                setFormData({ company: '', role: '', url: '', location: '', status: 'saved' });
            }
        } catch (error) {
            console.error('Error adding job:', error.response?.data || error.message);
            alert('Failed to save job. Check console for details.');
        }
    };

    const updateJobStatus = async (jobId, newStatus) => {
        try {
            const token = localStorage.getItem('token');
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';

            // Optimistic update
            setJobs(jobs.map(job => job._id === jobId ? { ...job, status: newStatus } : job));

            await axios.put(`${API_URL}/jobs/${jobId}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Error updating job:', error);
            fetchJobs(); // Revert on failure
        }
    };

    const deleteJob = async (jobId) => {
        if (!window.confirm('Are you sure you want to delete this job?')) return;
        try {
            const token = localStorage.getItem('token');
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';

            // Optimistic update
            setJobs(jobs.filter(job => job._id !== jobId));

            await axios.delete(`${API_URL}/jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Error deleting job:', error);
            fetchJobs(); // Revert on failure
        }
    };

    const handleDragStart = (e, jobId) => {
        e.dataTransfer.setData('jobId', jobId);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, columnId) => {
        e.preventDefault();
        const jobId = e.dataTransfer.getData('jobId');
        const job = jobs.find(j => j._id === jobId);
        if (job && job.status !== columnId) {
            updateJobStatus(jobId, columnId);
        }
    };

    const filterJobsByStatus = (status) => {
        return jobs.filter(job => job.status === status);
    };

    const [mobileFilter, setMobileFilter] = useState('saved');

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto h-full flex flex-col font-sans">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 md:mb-8 shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Briefcase className="text-brand-600 dark:text-brand-400" size={28} />
                        Job Tracker
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 md:mt-2 font-medium text-sm md:text-base">Drag and drop applications to track your progress.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-brand-600 text-white px-5 md:px-6 py-2.5 md:py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-glow active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center text-sm md:text-base"
                >
                    <Plus size={20} /> Add New Job
                </button>
            </header>

            {loading ? (
                <div className="flex-1 flex justify-center items-center text-slate-400 font-bold animate-pulse">
                    Loading board...
                </div>
            ) : (
                <>
                    {/* ─── MOBILE: Tabbed list view ─── */}
                    <div className="md:hidden flex-1 flex flex-col">
                        {/* Status tabs */}
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-3">
                            {COLUMNS.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => setMobileFilter(col.id)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                                        mobileFilter === col.id
                                            ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {col.title} ({filterJobsByStatus(col.id).length})
                                </button>
                            ))}
                        </div>

                        {/* Job cards */}
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {filterJobsByStatus(mobileFilter).length === 0 ? (
                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm text-center">
                                    No jobs in this column yet
                                </div>
                            ) : (
                                filterJobsByStatus(mobileFilter).map(job => (
                                    <div key={job._id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-800 dark:text-gray-100 text-[15px] leading-tight flex-1 mr-2">{job.role}</h4>
                                            <button onClick={() => deleteJob(job._id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-bold mb-3">
                                            <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                                            {job.company}
                                        </div>
                                        {/* Status change dropdown */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status:</span>
                                            <div className="relative">
                                                <select
                                                    value={job.status}
                                                    onChange={(e) => updateJobStatus(job._id, e.target.value)}
                                                    className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 pl-2 pr-7 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                                                >
                                                    {COLUMNS.map(col => (
                                                        <option key={col.id} value={col.id}>{col.title}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                                            {job.location && (
                                                <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                                    <MapPin size={12} /> {job.location}
                                                </span>
                                            )}
                                            {job.url && (
                                                <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors">
                                                    <LinkIcon size={12} /> View Job
                                                </a>
                                            )}
                                            <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md ml-auto text-slate-400 dark:text-slate-500">
                                                <Calendar size={12} />
                                                {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ─── DESKTOP: Kanban board (unchanged) ─── */}
                    <div className="hidden md:flex flex-1 gap-6 overflow-x-auto pb-4 custom-scrollbar">
                        {COLUMNS.map(col => (
                            <div
                                key={col.id}
                                className={`min-w-[320px] w-[320px] flex flex-col rounded-2xl border ${col.border} ${col.color} p-4 transition-all duration-200 hover:border-brand-400 dark:hover:border-brand-500`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <h3 className="font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest text-sm">{col.title}</h3>
                                    <span className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                        {filterJobsByStatus(col.id).length}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                    {filterJobsByStatus(col.id).map(job => (
                                        <div
                                            key={job._id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, job._id)}
                                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing active:shadow-lg active:scale-[0.98] group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                    {job.role}
                                                </h4>
                                                <button
                                                    onClick={() => deleteJob(job._id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-bold mb-3">
                                                <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                                                {job.company}
                                            </div>

                                            <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                                                {job.location && (
                                                    <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                                        <MapPin size={12} /> {job.location}
                                                    </span>
                                                )}
                                                {job.url && (
                                                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors">
                                                        <LinkIcon size={12} /> View Job
                                                    </a>
                                                )}
                                                <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md ml-auto text-slate-400 dark:text-slate-500">
                                                    <Calendar size={12} />
                                                    {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {filterJobsByStatus(col.id).length === 0 && (
                                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl h-24 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-xs p-4 text-center transition-colors hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500">
                                            Drop a job here
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>  
            )}

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Add New Job</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
                        </div>
                        <form onSubmit={handleAddJob} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Company Name</label>
                                <input required autoFocus className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="e.g. Acme Corp" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Role / Title</label>
                                <input required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} placeholder="e.g. Frontend Engineer" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Job URL (Optional)</label>
                                <input type="url" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Location (Optional)</label>
                                <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Remote, NY" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Initial Status</label>
                                <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none text-slate-800 dark:text-slate-100" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="saved">Saved / Planning to Apply</option>
                                    <option value="applied">Applied</option>
                                    <option value="interviewing">Interviewing</option>
                                    <option value="offer">Got an Offer!</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-glow">Save Job</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* UI ENHANCEMENT — inline scrollbar styles removed, now in global index.css as .custom-scrollbar */}
        </div>
    );
};

export default JobTracker;
