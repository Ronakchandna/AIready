import logging

import fitz  # PyMuPDF

import config

log = logging.getLogger("pdf")


class PDFExtractionError(ValueError):
    """Raised when the bytes are not a readable PDF."""


def is_pdf(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF (page-limited). Raises PDFExtractionError for invalid/encrypted files."""
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
        parts = []
        for i in range(min(len(doc), config.MAX_PDF_PAGES)):
            parts.append(doc.load_page(i).get_text("text"))
        return "\n".join(parts).strip()
    except PDFExtractionError:
        raise
    except Exception as exc:
        log.warning("PDF text extraction failed: %s", exc)
        raise PDFExtractionError("Text extraction from the PDF failed.") from exc
    finally:
        doc.close()
