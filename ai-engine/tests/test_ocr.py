"""Scanned (image-only) PDFs: text is read with OCR when Tesseract is installed (Docker image, CI)."""
import fitz
import pytest

from utils.pdf_extractor import extract_text_from_pdf, ocr_available

LINES = ["PRIYA SHARMA", "Software Engineer", "Skills: Python, React, Docker"]


def scanned_pdf() -> bytes:
    """Render a text page to an image and wrap that image in a new PDF (no text layer)."""
    src = fitz.open()
    page = src.new_page()
    for i, line in enumerate(LINES):
        page.insert_text((72, 120 + i * 40), line, fontsize=20)
    pix = page.get_pixmap(dpi=200)
    out = fitz.open()
    scan = out.new_page(width=page.rect.width, height=page.rect.height)
    scan.insert_image(scan.rect, pixmap=pix)
    return out.tobytes()


def test_scanned_pdf_has_no_text_layer():
    doc = fitz.open(stream=scanned_pdf(), filetype="pdf")
    assert doc[0].get_text().strip() == ""


@pytest.mark.skipif(not ocr_available(), reason="Tesseract OCR is not installed")
def test_ocr_reads_scanned_pdf():
    text = extract_text_from_pdf(scanned_pdf()).lower()
    assert "priya sharma" in text
    assert "python" in text and "docker" in text


@pytest.mark.skipif(ocr_available(), reason="only relevant without Tesseract")
def test_scanned_pdf_without_ocr_returns_empty_text():
    assert extract_text_from_pdf(scanned_pdf()) == ""


def test_text_pdf_does_not_use_ocr(monkeypatch):
    import utils.pdf_extractor as pe

    monkeypatch.setattr(pe, "_ocr_page", lambda page: pytest.fail("OCR should not run for text PDFs"))
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Jane Roe - Backend engineer with Python and FastAPI experience. " * 3)
    assert "Jane Roe" in extract_text_from_pdf(doc.tobytes())
