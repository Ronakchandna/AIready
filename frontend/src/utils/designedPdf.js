import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports the on-screen resume preview (with its visual theme) as an A4 PDF image.
 * Looks exactly like the preview, but the text is not selectable - so it is meant for
 * sending to people, while the ATS PDF is the one to upload to job portals.
 *
 * @param {HTMLElement} element  the A4 paper element of the preview
 * @param {string} fileName
 */
export const downloadDesignedPdf = async (element, fileName) => {
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        // the preview may be zoomed: render the clone at 100%
        onclone: (doc) => {
            doc.querySelectorAll('[data-preview-zoom]').forEach((el) => { el.style.transform = 'none'; });
        },
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / pageW;
    const pagePx = Math.floor(pageH * pxPerMm);

    // Slice the tall canvas into A4 pages
    for (let y = 0, page = 0; y < canvas.height; y += pagePx, page++) {
        const sliceH = Math.min(pagePx, canvas.height - y);
        if (page > 0 && sliceH < pxPerMm * 8) break; // ignore an almost empty trailing strip
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH / pxPerMm);
    }
    pdf.save(fileName);
};
