# DocuMind AI

DocuMind AI is a local document Q&A application. Upload text-based PDF files, choose which documents to search, and ask questions in a browser. It retrieves relevant page-aware passages with sentence embeddings and uses a local Ollama model to write answers with source references.

## Features

- Upload, list, select, and delete PDF documents.
- Extract PDF text and retain page markers for source attribution.
- Search all uploaded documents or only selected documents.
- Retrieve relevant passages using `all-MiniLM-L6-v2`.
- Generate answers with Ollama (defaults to `llama3.2`).
- Show source document names, PDF pages, chunk numbers, and similarity scores.
- Keep uploaded PDFs, extracted text, and document metadata on the local machine.

## Requirements

- Python with support for the pinned packages in [`requirements.txt`](requirements.txt).
- Ollama installed and running locally.
- The Ollama model configured for the app (default: `llama3.2`).
- Internet access on first use may be required to download the sentence-transformer model.

## Setup

From the project directory in Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Install Ollama, then download the default language model:

```powershell
ollama pull llama3.2
```

Start Ollama using the Ollama application or service, then start the Flask app:

```powershell
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). The first question may take longer while the embedding model loads and the document index is built.

The Ollama endpoint and model can be overridden with environment variables:

```powershell
$env:OLLAMA_URL = "http://localhost:11434/api/generate"
$env:OLLAMA_MODEL = "llama3.2"
python app.py
```

## How to use

1. Select **Upload PDF** and choose a PDF with extractable text. Uploads are limited to 20 MB.
2. Select documents in the library, or leave all documents deselected to search all of them.
3. Enter a question and submit it. The answer includes source information when relevant passages are found.
4. Select documents and choose **Delete Selected** to remove them from local storage.

Scanned/image-only PDFs are not OCR-processed and may be rejected if no text can be extracted.

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Serve the browser application |
| `GET` | `/status` | Return application status and version |
| `GET` | `/documents` | List stored PDF documents |
| `POST` | `/upload` | Upload a PDF as multipart form data using the `file` field |
| `DELETE` | `/documents/<document_id>` | Delete one stored PDF and its extracted text |
| `POST` | `/ask` | Retrieve relevant content and generate an answer |

Example question request:

```json
{
  "question": "What is the main topic?",
  "selected_documents": []
}
```

`selected_documents` is a list of document IDs returned by `GET /documents`. An empty list searches all available documents. Successful `/ask` responses contain `result.answer` and `result.sources`.

## Project structure

```text
DocuMind-AI/
|-- app.py                  # Flask application and HTTP endpoints
|-- .gitignore              # Excludes local environments and generated/user data
|-- requirements.txt        # Pinned Python dependencies
|-- data/
|   `-- sample.pdf          # Example PDF (ignored by Git)
|-- services/
|   |-- chunking.py         # Word-based, page-aware chunking
|   |-- embeddings.py       # Embedding demonstration
|   |-- embed_chunks.py     # Chunk embedding demonstration
|   |-- generation.py       # Retrieval context and Ollama answer generation
|   |-- pdf_reader.py       # PDF text extraction
|   `-- retrieval.py        # Embedding index and similarity search
|-- static/
|   |-- css/style.css
|   `-- js/chat.js
|-- templates/
|   `-- index.html
|-- uploads/                # Uploaded PDFs, extracted text, and metadata
|-- extracted_text.txt      # Legacy/active-text compatibility file
|-- README.md
`-- PROJECT_HANDOFF.md     # Developer notes
```

## Storage and implementation notes

- Uploaded PDFs and their extracted text are stored in `uploads/`; document metadata is stored in `uploads/documents.json`.
- The root `.gitignore` excludes virtual environments, caches, all PDF files, uploaded metadata, and generated `extracted_text.txt`. PDFs are intentionally kept out of Git, including `data/sample.pdf`.
- The app enforces a 20 MB request limit and stores uploaded files under generated IDs rather than their original names.
- `extracted_text.txt` is maintained as a compatibility copy of the most recently modified stored document's extracted text.
- Retrieval splits page text into word-based chunks of 200 words with 20-word overlap. The embedding index is held in memory and rebuilt when the tracked document files change; embeddings are not persisted between app restarts.
- The application has no authentication or multi-user isolation. Do not expose this development server to an untrusted network.
- The Flask server started by `python app.py` is a development server with debug mode enabled. Use a production WSGI server and appropriate security controls before deployment.

## Current limitations

- PDF extraction uses `pypdf`; image-only/scanned documents need OCR, which is not included.
- Answer generation requires a reachable Ollama service and an available configured model.
- The project does not currently include an automated test suite.

## Related documentation

See [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md) for a concise implementation snapshot and guidance for future development.
