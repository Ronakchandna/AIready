import { jsPDF } from 'jspdf';

// The built-in PDF fonts only cover Latin-1 (WinAnsi). AI-generated text often contains typographic
// characters (non-breaking hyphens, smart quotes, special spaces) that would print as garbage,
// so map them to safe equivalents and drop anything else the font cannot draw.
const BULLET = '-'; // bullet-like characters become '-' (and are stripped at the start of a bullet line)
const REPLACEMENTS = [
    [[0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x2043], '-'],
    [[0x2018, 0x2019, 0x201a, 0x201b, 0x2032], "'"],
    [[0x201c, 0x201d, 0x201e, 0x2033], '"'],
    [[0x2026], '...'],
    [[0x2022, 0x25cf, 0x25aa, 0x2023, 0x25e6], BULLET],
    [[0x00a0, 0x2002, 0x2003, 0x2007, 0x2009, 0x200a, 0x202f], ' '],
    [[0x200b, 0x200c, 0x200d, 0xfeff, 0x2713, 0x2714], ''],
    [[0x20b9], 'Rs.'],
    [[0x2192], '->'],
];
const CHAR_MAP = new Map();
REPLACEMENTS.forEach(([codes, to]) => codes.forEach((c) => CHAR_MAP.set(c, to)));

const isPrintable = (code) =>
    code === 9 || code === 10 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff);

export const clean = (value) => {
    let out = '';
    for (const ch of String(value ?? '')) {
        const code = ch.codePointAt(0);
        if (CHAR_MAP.has(code)) out += CHAR_MAP.get(code);
        else if (isPrintable(code)) out += ch;
    }
    return out.trim();
};

/**
 * Generates an ATS-compliant, 100% vector-text PDF resume.
 * Ensures selectable text, standard fonts, and hierarchical parsing structure.
 * Returns the jsPDF document (already saved unless options.save === false).
 */
export const generateAtsPdf = (resumeData, options = {}) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = 18;

    const checkPageBreak = (neededSpace = 12) => {
        if (currentY + neededSpace > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
            return true;
        }
        return false;
    };

    // Bold title on the left with optional grey text (dates/link) on the right.
    // The title wraps instead of running into the right-hand text.
    const drawTitleRow = (title, right, rightColor = [100, 116, 139]) => {
        let rightWidth = 0;
        if (right) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            rightWidth = pdf.getTextWidth(right) + 4;
            pdf.setTextColor(...rightColor);
            pdf.text(right, pageWidth - margin - (rightWidth - 4), currentY);
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(15, 23, 42);
        pdf.splitTextToSize(title, contentWidth - rightWidth).forEach((line) => {
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    };

    // Wrapped secondary line (company, institution)
    const drawSubline = (text, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(71, 85, 105);
        pdf.splitTextToSize(text, contentWidth).forEach((line) => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    };

    // Bullet list from a multi-line description
    const drawBullets = (description) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        String(description).split('\n').map((b) => clean(b).replace(/^[-*]\s*/, '').trim()).filter(Boolean)
            .forEach((bullet) => {
                pdf.splitTextToSize(bullet, contentWidth - 4).forEach((line, idx) => {
                    checkPageBreak(5);
                    // drawn dot instead of a text glyph, so ATS text extraction stays clean
                    if (idx === 0) {
                        pdf.setFillColor(71, 85, 105);
                        pdf.circle(margin + 1, currentY - 1.1, 0.55, 'F');
                    }
                    pdf.text(line, margin + 4, currentY);
                    currentY += 4.2;
                });
            });
    };

    const drawSectionHeader = (title) => {
        checkPageBreak(16);
        currentY += 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59); // Slate-800
        pdf.text(title.toUpperCase(), margin, currentY);
        currentY += 1.5;
        pdf.setDrawColor(203, 213, 225); // Slate-300
        pdf.setLineWidth(0.4);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
    };

    // --- Header: Name & Contact ---
    const contact = resumeData.contact || {};
    const fullName = clean(contact.fullName) || 'YOUR NAME';

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42); // Slate-900
    pdf.splitTextToSize(fullName, contentWidth).forEach((line) => {
        pdf.text(line, margin, currentY);
        currentY += 6;
    });
    currentY -= 1;

    const contactParts = [contact.email, contact.phone, contact.location, contact.linkedin, contact.portfolio]
        .map((p) => clean(p).replace(/^https?:\/\//, '').replace(/\/$/, ''))
        .filter(Boolean);
    if (contactParts.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105); // Slate-600
        pdf.splitTextToSize(contactParts.join('  |  '), contentWidth).forEach((l) => {
            pdf.text(l, margin, currentY);
            currentY += 4;
        });
    }
    currentY += 2;

    // --- Summary ---
    const summary = clean(resumeData.summary);
    if (summary) {
        drawSectionHeader('Professional Summary');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(51, 65, 85);
        pdf.splitTextToSize(summary, contentWidth).forEach((line) => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    }

    // --- Experience ---
    if (Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        drawSectionHeader('Work Experience');
        resumeData.experience.forEach((exp) => {
            checkPageBreak(14);
            const start = clean(exp.startDate);
            const end = clean(exp.endDate);
            const dates = start && end ? `${start} - ${end}` : start || end;
            drawTitleRow(clean(exp.role) || 'Role', dates);
            if (clean(exp.company)) drawSubline(clean(exp.company), true);
            if (exp.description) drawBullets(exp.description);
            currentY += 3;
        });
    }

    // --- Projects ---
    if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        drawSectionHeader('Projects');
        resumeData.projects.forEach((proj) => {
            checkPageBreak(12);
            const link = clean(proj.link).replace(/^https?:\/\//, '').replace(/\/$/, '');
            drawTitleRow(clean(proj.title) || 'Project', link, [37, 99, 235]);
            if (proj.description) drawBullets(proj.description);
            currentY += 3;
        });
    }

    // --- Education ---
    if (Array.isArray(resumeData.education) && resumeData.education.length > 0) {
        drawSectionHeader('Education');
        resumeData.education.forEach((edu) => {
            checkPageBreak(12);
            drawTitleRow(clean(edu.degree) || 'Degree', clean(edu.year));
            if (clean(edu.institution)) drawSubline(clean(edu.institution));
            currentY += 2;
        });
    }

    // --- Skills ---
    const skills = (Array.isArray(resumeData.skills) ? resumeData.skills : []).map(clean).filter(Boolean);
    if (skills.length > 0) {
        drawSectionHeader('Technical Skills');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        pdf.splitTextToSize(skills.join(', '), contentWidth).forEach((line) => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    }

    const safeFilename = (fullName.trim() || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_') + '_ATS.pdf';
    if (options.save !== false) pdf.save(safeFilename);
    return pdf;
};
