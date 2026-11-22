import { jsPDF } from 'jspdf';

/**
 * Generates an ATS-compliant, 100% vector-text PDF resume.
 * Ensures selectable text, standard fonts, and hierarchical parsing structure.
 */
export const generateAtsPdf = (resumeData) => {
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

    const drawSectionHeader = (title) => {
        checkPageBreak(16);
        currentY += 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59); // Slate-800
        pdf.text(title.toUpperCase(), margin, currentY);
        currentY += 1.5;

        // Clean divider line
        pdf.setDrawColor(203, 213, 225); // Slate-300
        pdf.setLineWidth(0.4);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
    };

    // --- Header: Name & Contact ---
    const contact = resumeData.contact || {};
    const fullName = contact.fullName || 'YOUR NAME';

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42); // Slate-900
    pdf.text(fullName, margin, currentY);
    currentY += 5;

    // Contact line
    const contactParts = [];
    if (contact.email) contactParts.push(contact.email);
    if (contact.phone) contactParts.push(contact.phone);
    if (contact.linkedin) contactParts.push(contact.linkedin.replace(/^https?:\/\//, ''));
    if (contact.portfolio) contactParts.push(contact.portfolio.replace(/^https?:\/\//, ''));

    if (contactParts.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105); // Slate-600
        const contactLine = contactParts.join('  |  ');
        const lines = pdf.splitTextToSize(contactLine, contentWidth);
        lines.forEach(l => {
            pdf.text(l, margin, currentY);
            currentY += 4;
        });
    }

    currentY += 2;

    // --- Summary ---
    if (resumeData.summary && resumeData.summary.trim()) {
        drawSectionHeader('Professional Summary');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(51, 65, 85);
        const summaryLines = pdf.splitTextToSize(resumeData.summary.trim(), contentWidth);
        summaryLines.forEach(line => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    }

    // --- Experience ---
    if (Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        drawSectionHeader('Work Experience');
        resumeData.experience.forEach(exp => {
            checkPageBreak(14);
            // Role & Dates
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(exp.role || 'Role', margin, currentY);

            const dates = `${exp.startDate || ''}${exp.startDate && exp.endDate ? ' - ' : ''}${exp.endDate || ''}`;
            if (dates.trim()) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(100, 116, 139);
                const dateWidth = pdf.getTextWidth(dates);
                pdf.text(dates, pageWidth - margin - dateWidth, currentY);
            }
            currentY += 4.5;

            // Company
            if (exp.company) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text(exp.company, margin, currentY);
                currentY += 4.5;
            }

            // Description bullets
            if (exp.description) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(51, 65, 85);

                const bullets = exp.description.split('\n').filter(b => b.trim());
                bullets.forEach(bullet => {
                    const cleanBullet = bullet.replace(/^[•\-*]\s*/, '').trim();
                    const lines = pdf.splitTextToSize(cleanBullet, contentWidth - 4);
                    lines.forEach((line, idx) => {
                        checkPageBreak(5);
                        if (idx === 0) {
                            pdf.text('•', margin, currentY);
                        }
                        pdf.text(line, margin + 4, currentY);
                        currentY += 4.2;
                    });
                });
            }
            currentY += 3;
        });
    }

    // --- Projects ---
    if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        drawSectionHeader('Projects');
        resumeData.projects.forEach(proj => {
            checkPageBreak(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(proj.title || 'Project', margin, currentY);

            if (proj.link) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8.5);
                pdf.setTextColor(37, 99, 235);
                const cleanLink = proj.link.replace(/^https?:\/\//, '');
                const linkWidth = pdf.getTextWidth(cleanLink);
                pdf.text(cleanLink, pageWidth - margin - linkWidth, currentY);
            }
            currentY += 4.5;

            if (proj.description) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(51, 65, 85);
                const projBullets = proj.description.split('\n').filter(b => b.trim());
                projBullets.forEach(b => {
                    const cleanB = b.replace(/^[•\-*]\s*/, '').trim();
                    const lines = pdf.splitTextToSize(cleanB, contentWidth - 4);
                    lines.forEach((line, idx) => {
                        checkPageBreak(5);
                        if (idx === 0) pdf.text('•', margin, currentY);
                        pdf.text(line, margin + 4, currentY);
                        currentY += 4.2;
                    });
                });
            }
            currentY += 3;
        });
    }

    // --- Education ---
    if (Array.isArray(resumeData.education) && resumeData.education.length > 0) {
        drawSectionHeader('Education');
        resumeData.education.forEach(edu => {
            checkPageBreak(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(edu.degree || 'Degree', margin, currentY);

            if (edu.year) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(100, 116, 139);
                const yearWidth = pdf.getTextWidth(edu.year);
                pdf.text(edu.year, pageWidth - margin - yearWidth, currentY);
            }
            currentY += 4.5;

            if (edu.institution) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text(edu.institution, margin, currentY);
                currentY += 4.5;
            }
            currentY += 2;
        });
    }

    // --- Skills ---
    if (Array.isArray(resumeData.skills) && resumeData.skills.length > 0) {
        drawSectionHeader('Technical Skills');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 65, 85);
        const skillString = resumeData.skills.join(', ');
        const skillLines = pdf.splitTextToSize(skillString, contentWidth);
        skillLines.forEach(line => {
            checkPageBreak(5);
            pdf.text(line, margin, currentY);
            currentY += 4.5;
        });
    }

    const safeFilename = (fullName.trim() || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_') + '_ATS.pdf';
    pdf.save(safeFilename);
};

