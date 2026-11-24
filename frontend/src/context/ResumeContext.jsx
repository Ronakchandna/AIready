import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { NODE_API, postAi, aiErrorText, checkPdf } from '../utils/aiClient';

const ResumeContext = createContext();

export const useResume = () => useContext(ResumeContext);

export const ResumeProvider = ({ children }) => {
    const [resumeData, setResumeData] = useState({
        title: 'My Resume',
        contact: {
            fullName: 'John Doe',
            phone: '(123) 456-7890',
            email: 'john.doe@example.com',
            linkedin: 'linkedin.com/in/johndoe',
            portfolio: 'johndoe.dev'
        },
        summary: 'A passionate software engineer with experience in building scalable web applications.',
        experience: [],
        education: [],
        skills: [],
        projects: [],
        theme: 'modern'
    });

    const [resumeId, setResumeId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    const loadFromCloud = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setIsLoading(true);
        try {
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${API_URL}/resume`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success && data.data) {
                setResumeId(data.data._id);
                const content = data.data.content || {};
                setResumeData({
                    title: data.data.title || content.title || 'My Resume',
                    contact: {
                        fullName: content.contact?.fullName || '',
                        email: content.contact?.email || '',
                        phone: content.contact?.phone || '',
                        linkedin: content.contact?.linkedin || '',
                        portfolio: content.contact?.portfolio || ''
                    },
                    summary: content.summary || '',
                    experience: Array.isArray(content.experience) ? content.experience : [],
                    education: Array.isArray(content.education) ? content.education : [],
                    projects: Array.isArray(content.projects) ? content.projects : [],
                    skills: Array.isArray(content.skills) ? content.skills : [],
                    theme: content.theme || 'modern'
                });
                setLastSaved(new Date());
            } else if (data.success && !data.data) {
                // No resume found, do nothing (keep default state)
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error('Failed to load resume from cloud:', error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const saveToCloud = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setIsSaving(true);
        try {
            const API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000/api';
            const payload = {
                title: resumeData.title || 'My Resume',
                content: resumeData
            };
            if (resumeId) payload.id = resumeId;

            const { data } = await axios.post(`${API_URL}/resume`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                if (!resumeId) setResumeId(data.data._id);
                setLastSaved(new Date());

                // Trigger background evaluation of global rank
                try {
                    const text = `
                        Summary: ${resumeData.summary || ''}
                        Experience: ${(resumeData.experience || []).map(e => `${e.role} at ${e.company}. ${e.description || ''}`).join(' ')}
                        Education: ${(resumeData.education || []).map(e => `${e.degree} at ${e.institution}. ${e.year || ''}`).join(' ')}
                        Projects: ${(resumeData.projects || []).map(p => `${p.title}. ${p.description || ''}`).join(' ')}
                        Skills: ${(resumeData.skills || []).join(', ')}
                    `;
                    axios.post(`${API_URL}/user/rank`, { resumeText: text }, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(e => console.error('Silent rank evaluation failed', e));
                } catch (e) { }
            }
        } catch (error) {
            console.error('Failed to save resume to cloud:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-load on mount
    useEffect(() => {
        loadFromCloud();
    }, []);

    const loadResume = (id, content) => {
        setResumeId(id);
        setResumeData({
            title: content.title || 'My Resume',
            contact: {
                fullName: content.contact?.fullName || '',
                email: content.contact?.email || '',
                phone: content.contact?.phone || '',
                linkedin: content.contact?.linkedin || '',
                portfolio: content.contact?.portfolio || ''
            },
            summary: content.summary || '',
            experience: Array.isArray(content.experience) ? content.experience : [],
            education: Array.isArray(content.education) ? content.education : [],
            projects: Array.isArray(content.projects) ? content.projects : [],
            skills: Array.isArray(content.skills) ? content.skills : [],
            theme: content.theme || 'modern'
        });
        setLastSaved(new Date());
    };

    const createNewResume = () => {
        setResumeId(null);
        setResumeData({
            title: 'New Resume',
            contact: { fullName: '', phone: '', email: '', linkedin: '', portfolio: '' },
            summary: '',
            experience: [],
            education: [],
            skills: [],
            projects: [],
            theme: 'modern'
        });
        setLastSaved(null);
    };

    // Import a resume / LinkedIn PDF: the AI fills the builder, the result is saved to the cloud.
    // Returns { success, error }. onStatus('waking') is called while the free AI engine starts up.
    const importPdf = async (file, kind, onStatus) => {
        const fileError = checkPdf(file);
        if (fileError) return { success: false, error: fileError };
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const endpoint = kind === 'linkedin' ? '/ai/parse-linkedin' : '/ai/parse-resume';
            const response = await postAi(endpoint, formData, { onStatus });
            const aiData = response.data?.data;
            if (!response.data?.success || !aiData) {
                return { success: false, error: 'The AI could not read this PDF. Try another file or fill the builder manually.' };
            }

            let n = Date.now();
            const withIds = (list) => (Array.isArray(list) ? list : [])
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({ ...item, id: n++ })); // ids are needed to edit/remove single entries
            const newResumeData = {
                title: aiData.title || (kind === 'linkedin' ? 'LinkedIn Import' : 'Imported Resume'),
                contact: {
                    fullName: aiData.contact?.fullName || '',
                    email: aiData.contact?.email || '',
                    phone: aiData.contact?.phone || '',
                    linkedin: aiData.contact?.linkedin || '',
                    portfolio: aiData.contact?.portfolio || ''
                },
                summary: aiData.summary || '',
                experience: withIds(aiData.experience),
                education: withIds(aiData.education),
                projects: withIds(aiData.projects),
                skills: (Array.isArray(aiData.skills) ? aiData.skills : [])
                    .map((s) => (typeof s === 'string' ? s : s?.name || '')).map((s) => s.trim()).filter(Boolean),
                theme: resumeData.theme || 'modern'
            };

            const empty = !newResumeData.contact.fullName && !newResumeData.summary
                && !newResumeData.experience.length && !newResumeData.education.length && !newResumeData.skills.length;
            if (empty) {
                return { success: false, error: 'No resume details were found in this PDF. Make sure it is your resume (not a blank or image-only page).' };
            }

            // Save to the cloud so it shows up in My Resumes and the other tools immediately
            let savedId = null;
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const label = kind === 'linkedin' ? 'LinkedIn Import' : 'Imported PDF';
                    const saveResponse = await axios.post(`${NODE_API}/resume`, {
                        title: `${label} - ${new Date().toLocaleDateString()}`,
                        content: newResumeData
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    if (saveResponse.data.success) {
                        savedId = saveResponse.data.data._id;
                        setLastSaved(new Date());
                    }
                } catch (e) {
                    console.error('Auto-save after import failed', e);
                }

                // Update the global rank in the background
                const text = [
                    `Summary: ${newResumeData.summary}`,
                    `Experience: ${newResumeData.experience.map((e) => `${e.role || ''} at ${e.company || ''}. ${e.description || ''}`).join(' ')}`,
                    `Education: ${newResumeData.education.map((e) => `${e.degree || ''} at ${e.institution || ''}. ${e.year || ''}`).join(' ')}`,
                    `Projects: ${newResumeData.projects.map((p) => `${p.title || ''}. ${p.description || ''}`).join(' ')}`,
                    `Skills: ${newResumeData.skills.join(', ')}`,
                ].join('\n');
                axios.post(`${NODE_API}/user/rank`, { resumeText: text }, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => { });
            }

            setResumeData(newResumeData);
            setResumeId(savedId);
            return { success: true, saved: !!savedId };
        } catch (error) {
            console.error('PDF import failed:', error);
            return { success: false, error: aiErrorText(error, 'Could not import this PDF. Please try again.') };
        } finally {
            setIsLoading(false);
        }
    };

    const importFromLinkedIn = (file, onStatus) => importPdf(file, 'linkedin', onStatus);
    const importPrebuiltResume = (file, onStatus) => importPdf(file, 'resume', onStatus);

    const updateContact = (field, value) => {
        setResumeData(prev => ({
            ...prev,
            contact: { ...prev.contact, [field]: value }
        }));
    };

    const updateTheme = (theme) => {
        setResumeData(prev => ({ ...prev, theme }));
    };

    const updateSummary = (value) => {
        setResumeData(prev => ({ ...prev, summary: value }));
    };

    const addExperience = (exp) => {
        setResumeData(prev => ({
            ...prev,
            experience: [...prev.experience, { id: Date.now(), ...exp }]
        }));
    };

    const removeExperience = (id) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.filter(exp => exp.id !== id)
        }));
    };

    const addEducation = (edu) => {
        setResumeData(prev => ({
            ...prev,
            education: [...prev.education, { id: Date.now(), ...edu }]
        }));
    };

    const removeEducation = (id) => {
        setResumeData(prev => ({
            ...prev,
            education: prev.education.filter(edu => edu.id !== id)
        }));
    };

    const addSkill = (skill) => {
        if (!resumeData.skills.includes(skill)) {
            setResumeData(prev => ({
                ...prev,
                skills: [...prev.skills, skill]
            }));
        }
    };

    const removeSkill = (skill) => {
        setResumeData(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skill)
        }));
    };

    const addProject = (project) => {
        setResumeData(prev => ({
            ...prev,
            projects: [...(prev.projects || []), { id: Date.now(), ...project }]
        }));
    };

    const removeProject = (id) => {
        setResumeData(prev => ({
            ...prev,
            projects: (prev.projects || []).filter(proj => proj.id !== id)
        }));
    };

    return (
        <ResumeContext.Provider value={{
            resumeData,
            updateContact,
            updateSummary,
            addExperience,
            removeExperience,
            addEducation,
            removeEducation,
            addSkill,
            removeSkill,
            addProject,
            removeProject,
            updateTheme,
            saveToCloud,
            loadFromCloud,
            loadResume,
            createNewResume,
            updateTitle: (title) => setResumeData((prev) => ({ ...prev, title })),
            importFromLinkedIn,
            importPrebuiltResume,
            resumeId,
            isSaving,
            isLoading,
            lastSaved
        }}>
            {children}
        </ResumeContext.Provider>
    );
};
