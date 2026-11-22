import logging
from functools import lru_cache

import fitz  # PyMuPDF

import config

log = logging.getLogger("pdf")

# A PDF whose text layer has fewer characters than this is treated as scanned (image-only)
MIN_TEXT_CHARS = 50
OCR_MAX_PAGES = 5   # OCR is slow and memory hungry; resumes are short
OCR_DPI = 200


class PDFExtractionError(ValueError):
    """Raised when the bytes are not a readable PDF."""


def is_pdf(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


@lru_cache(maxsize=1)
def _tessdata():
    """Path of Tesseract's language data, or None when Tesseract is not installed."""
    try:
        return fitz.get_tessdata()
    except Exception:  # RuntimeError when Tesseract cannot be found
        return None


def ocr_available() -> bool:
    return _tessdata() is not None


def _ocr_page(page) -> str:
    tp = page.get_textpage_ocr(language="eng", dpi=OCR_DPI, full=True, tessdata=_tessdata())
    return page.get_text("text", textpage=tp)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF (page-limited). Scanned PDFs are read with OCR when Tesseract is
    installed. Raises PDFExtractionError for invalid/encrypted files."""
    if not is_pdf(pdf_bytes):
        raise PDFExtractionError("File is not a valid PDF.")
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        log.warning("Could not open PDF: %s", exc)
        raise PDFExtractionError("The PDF could not be read.") from exc
    try:
        if doc.needs_pass:
            raise PDFExtractionError("The PDF is password protected.")
        pages = [doc.load_page(i) for i in range(min(len(doc), config.MAX_PDF_PAGES))]
        text = "\n".join(p.get_text("text") for p in pages).strip()
        if len(text) < MIN_TEXT_CHARS and ocr_available():
            log.info("PDF has no text layer - running OCR on %d page(s)", min(len(pages), OCR_MAX_PAGES))
            ocr_text = "\n".join(_ocr_page(p) for p in pages[:OCR_MAX_PAGES]).strip()
            if len(ocr_text) > len(text):
                text = ocr_text
        return text
    except PDFExtractionError:
        raise
    except Exception as exc:
        log.warning("PDF text extraction failed: %s", exc)
        raise PDFExtractionError("Text extraction from the PDF failed.") from exc
    finally:
        doc.close()
