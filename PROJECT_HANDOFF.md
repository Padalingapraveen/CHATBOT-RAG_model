# DocuMind AI - Developer Handoff

This document records the current implementation for future development. The user-facing setup and usage guide is [`README.md`](README.md).

## Current application

DocuMind AI is a Flask browser application for uploading PDFs, searching their extracted text, and asking questions. The browser UI is in `templates/index.html` and `static/`; HTTP handling is in `app.py`.

The main request flow is:

1. `POST /upload` saves the PDF under a generated ID, extracts page-marked text with `services/pdf_reader.py`, and writes metadata to `uploads/documents.json`.
2. `GET /documents` provides the library; `DELETE /documents/<id>` removes an uploaded PDF and its text.
3. `POST /ask` validates the question and selected document IDs, then calls `services/generation.py`.
4. `services/retrieval.py` chunks documents by page, embeds chunks with `all-MiniLM-L6-v2`, and ranks candidates by cosine similarity.
5. `services/generation.py` sends the retrieved context to the configured Ollama API and returns an answer plus source details.

## Repository map

```text
app.py
requirements.txt
data/sample.pdf
services/
  chunking.py
  embeddings.py
  embed_chunks.py
  generation.py
  pdf_reader.py
  retrieval.py
static/css/style.css
static/js/chat.js
templates/index.html
uploads/
extracted_text.txt
```

## Important behavior and state

- `GET /` serves the UI; `GET /status` returns the project name, running status, and version.
- PDF uploads are capped at 20 MB. The code checks the sanitized `.pdf` filename extension and rejects documents with no extracted text.
- The text extraction format includes `--- Page N ---` markers. `create_page_chunks` uses those markers to preserve page numbers; do not remove them without updating retrieval and source attribution.
- Chunking uses 200 words per chunk with a 20-word overlap.
- The sentence-transformer model and document embeddings are cached in process memory. The index is refreshed when tracked source files or metadata change, but embeddings are not saved to disk.
- Ollama defaults to `http://localhost:11434/api/generate` and model `llama3.2`; configure with `OLLAMA_URL` and `OLLAMA_MODEL`.
- Uploaded documents and metadata persist under `uploads/`. `extracted_text.txt` is maintained as a compatibility copy of the most recently modified stored document's text. If no uploaded PDF remains, that copy is removed.
- When there are no uploaded PDF files, retrieval can fall back to the root `extracted_text.txt` for backwards compatibility.
- `services/embeddings.py` and `services/embed_chunks.py` remain standalone embedding examples; the Flask Q&A path uses `services/retrieval.py`.

## Development and verification

Install dependencies with `pip install -r requirements.txt`. Run Ollama with the configured model available, then start the local development server with `python app.py`.

There is no committed automated test suite or test/lint configuration at present. PDF text extraction does not include OCR, and the Flask development server is configured with debug mode enabled; do not expose it directly to untrusted networks.

## Follow-up opportunities

- Add focused tests for upload validation, document management, page-aware chunking, retrieval, and API error responses.
- Add OCR only if scanned PDFs are in scope.
- Consider persisting embeddings if index rebuild time becomes a problem.
- Before deployment, add authentication and use a production WSGI server with appropriate upload and data-retention controls.
