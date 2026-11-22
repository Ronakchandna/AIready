// Plain-text version of the builder's resume data, used as context for AI features.
export const resumeToText = (r) => {
    if (!r) return '';
    const c = r.contact || {};
    const lines = [
        c.fullName,
        [c.email, c.phone, c.linkedin, c.portfolio].filter(Boolean).join(' | '),
        r.summary && `Summary\n${r.summary}`,
        (r.experience || []).length && `Experience\n${r.experience.map((e) =>
            `${e.role || ''} at ${e.company || ''} (${[e.startDate, e.endDate].filter(Boolean).join(' - ')})\n${e.description || ''}`).join('\n')}`,
        (r.projects || []).length && `Projects\n${r.projects.map((p) => `${p.title || ''}: ${p.description || ''}`).join('\n')}`,
        (r.education || []).length && `Education\n${r.education.map((e) => `${e.degree || ''}, ${e.institution || ''} ${e.year || ''}`).join('\n')}`,
        (r.skills || []).length && `Skills\n${r.skills.join(', ')}`,
    ];
    return lines.filter(Boolean).join('\n\n').trim();
};
