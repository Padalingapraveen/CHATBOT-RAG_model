
import json
from pathlib import Path

from sentence_transformers import SentenceTransformer, util

from .chunking import create_page_chunks
from .pdf_reader import extract_pdf_text


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_FOLDER = BASE_DIR / "uploads"
TEXT_FILE = BASE_DIR / "extracted_text.txt"
METADATA_FILE = UPLOAD_FOLDER / "documents.json"


# --------------------------------------------------
# RETRIEVAL SETTINGS
# --------------------------------------------------

DEFAULT_TOP_K = 3

# Chunks below this similarity score are ignored.
DEFAULT_SIMILARITY_THRESHOLD = 0.30


# --------------------------------------------------
# MODEL AND INDEX CACHE
# --------------------------------------------------

model = None
chunks = []
chunk_embeddings = None
indexed_files_signature = None


# --------------------------------------------------
# LOAD SENTENCE TRANSFORMER MODEL
# --------------------------------------------------

def load_model():

    global model

    if model is None:

        print("Loading Sentence Transformer model...")

        model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    return model


# --------------------------------------------------
# LOAD DOCUMENT METADATA
# --------------------------------------------------

def get_document_metadata():

    if not METADATA_FILE.exists():
        return {}

    try:

        documents = json.loads(
            METADATA_FILE.read_text(encoding="utf-8")
        )

        if not isinstance(documents, list):
            raise ValueError(
                "Invalid document metadata format."
            )

        return {
            item["id"]: item
            for item in documents
            if isinstance(item, dict)
            and isinstance(item.get("id"), str)
        }

    except (json.JSONDecodeError, OSError, ValueError) as error:

        raise RuntimeError(
            "Unable to read uploads/documents.json."
        ) from error


# --------------------------------------------------
# GET ALL DOCUMENT FILES
# --------------------------------------------------

def get_document_files():

    UPLOAD_FOLDER.mkdir(exist_ok=True)

    document_files = []

    pdf_files = sorted(
        UPLOAD_FOLDER.glob("*.pdf")
    )

    for pdf_path in pdf_files:

        text_path = pdf_path.with_suffix(".txt")

        # Extract text if missing.
        if not text_path.exists():

            print(
                "Extracting text from:",
                pdf_path.name
            )

            extracted_text = extract_pdf_text(
                str(pdf_path)
            )

            if not extracted_text.strip():

                print(
                    "Skipping empty PDF:",
                    pdf_path.name
                )

                continue

            text_path.write_text(
                extracted_text,
                encoding="utf-8"
            )

        if text_path.exists():

            document_files.append({
                "document_id": pdf_path.stem,
                "pdf_path": pdf_path,
                "text_path": text_path
            })

    # Backward compatibility.
    if not document_files and TEXT_FILE.exists():

        document_files.append({
            "document_id": "legacy",
            "pdf_path": None,
            "text_path": TEXT_FILE
        })

    return document_files


# --------------------------------------------------
# DOCUMENT INDEX SIGNATURE
# --------------------------------------------------

def get_files_signature(document_files):

    signature = []

    for document in document_files:

        text_path = document["text_path"]
        pdf_path = document["pdf_path"]

        signature.append((
            str(text_path),
            text_path.stat().st_mtime_ns,
            text_path.stat().st_size
        ))

        if pdf_path is not None:

            signature.append((
                str(pdf_path),
                pdf_path.stat().st_mtime_ns,
                pdf_path.stat().st_size
            ))

    if METADATA_FILE.exists():

        signature.append((
            str(METADATA_FILE),
            METADATA_FILE.stat().st_mtime_ns,
            METADATA_FILE.stat().st_size
        ))

    return tuple(signature)


# --------------------------------------------------
# BUILD MULTI-DOCUMENT INDEX
# --------------------------------------------------

def load_document_index():

    global chunks
    global chunk_embeddings
    global indexed_files_signature

    document_files = get_document_files()

    if not document_files:

        raise FileNotFoundError(
            "No documents found. Please upload a PDF first."
        )

    current_signature = get_files_signature(
        document_files
    )

    # Reuse index if nothing changed.
    if indexed_files_signature == current_signature:

        print("Using existing document index.")

        return

    print("\nBuilding multi-document search index...")

    metadata = get_document_metadata()

    all_chunks = []

    # Process every document.
    for document in document_files:

        document_id = document["document_id"]
        text_path = document["text_path"]

        document_info = metadata.get(
            document_id,
            {}
        )

        if document_id == "legacy":

            filename = "extracted_text.txt"

        else:

            filename = document_info.get(
                "filename",
                document_id + ".pdf"
            )

        print("Processing:", filename)

        text = text_path.read_text(
            encoding="utf-8"
        )

        if not text.strip():

            print(
                "Skipping empty document:",
                filename
            )

            continue

        document_chunks = create_page_chunks(
            text,
            chunk_size=200,
            overlap=20
        )

        # Chunk numbers start from 1 for each PDF.
        for chunk_number, chunk in enumerate(
            document_chunks,
            start=1
        ):

            all_chunks.append({

                "document_id": document_id,

                "filename": filename,

                "page": chunk["page"],

                "chunk_number": chunk_number,

                "text": chunk["text"]

            })

    if not all_chunks:

        raise ValueError(
            "No readable document chunks found."
        )

    # Generate embeddings.
    current_model = load_model()

    print("Generating document embeddings...")

    new_embeddings = current_model.encode(
        [chunk["text"] for chunk in all_chunks],
        convert_to_tensor=True,
        show_progress_bar=False
    )

    # Update index after successful processing.
    chunks = all_chunks

    chunk_embeddings = new_embeddings

    indexed_files_signature = current_signature

    print("\nDocument index built successfully!")

    print("Total documents:", len(document_files))

    print("Total chunks:", len(chunks))


# --------------------------------------------------
# RETRIEVE RELEVANT CHUNKS
# --------------------------------------------------

def retrieve_relevant_chunks(
    question,
    top_k=DEFAULT_TOP_K,
    selected_documents=None,
    similarity_threshold=DEFAULT_SIMILARITY_THRESHOLD
):
    """
    Retrieve relevant chunks independently from each selected PDF.

    top_k:
        Maximum number of chunks retrieved from each document.

    selected_documents:
        Document IDs to search.
        Empty selection means search all uploaded documents.

    similarity_threshold:
        Minimum cosine similarity required for a chunk.
    """

    # Validate question.
    if not isinstance(question, str) or not question.strip():

        raise ValueError(
            "Question cannot be empty."
        )

    # Validate top_k.
    if not isinstance(top_k, int) or top_k < 1:

        raise ValueError(
            "top_k must be a positive integer."
        )

    # Validate similarity threshold.
    if (
        not isinstance(similarity_threshold, (int, float))
        or isinstance(similarity_threshold, bool)
        or not 0 <= similarity_threshold <= 1
    ):

        raise ValueError(
            "Similarity threshold must be between 0 and 1."
        )

    # Validate selected documents.
    if selected_documents is None:

        selected_documents = []

    if not isinstance(selected_documents, list):

        raise ValueError(
            "Selected documents must be a list of IDs."
        )

    if not all(
        isinstance(doc_id, str)
        for doc_id in selected_documents
    ):

        raise ValueError(
            "Invalid selected document IDs."
        )

    # Build or refresh index.
    load_document_index()

    # Get available document IDs.
    available_ids = list(dict.fromkeys(
        chunk["document_id"]
        for chunk in chunks
    ))

    # Determine which documents to search.
    if selected_documents:

        invalid_ids = (
            set(selected_documents) - set(available_ids)
        )

        if invalid_ids:

            raise ValueError(
                "One or more selected documents are unavailable. "
                "Refresh the document library and try again."
            )

        document_ids = list(
            dict.fromkeys(selected_documents)
        )

    else:

        document_ids = available_ids

    # Encode question once.
    current_model = load_model()

    question_embedding = current_model.encode(
        question.strip(),
        convert_to_tensor=True
    )

    results = []

    # Search each document separately.
    for document_id in document_ids:

        candidate_indices = [
            index
            for index, chunk in enumerate(chunks)
            if chunk["document_id"] == document_id
        ]

        if not candidate_indices:
            continue

        candidate_embeddings = chunk_embeddings[
            candidate_indices
        ]

        similarities = util.cos_sim(
            question_embedding,
            candidate_embeddings
        )[0]

        # Get top K candidate chunks.
        count = min(
            top_k,
            len(candidate_indices)
        )

        top_indices = similarities.argsort(
            descending=True
        )[:count]

        for index in top_indices:

            result_index = int(index.item())

            similarity_score = float(
                similarities[result_index].item()
            )

            # Ignore weakly related chunks.
            if similarity_score < similarity_threshold:

                continue

            chunk_index = candidate_indices[
                result_index
            ]

            chunk = chunks[chunk_index]

            results.append({

                "document_id": chunk["document_id"],

                "filename": chunk["filename"],

                "page": chunk["page"],

                "chunk_number": chunk["chunk_number"],

                "text": chunk["text"],

                "similarity": similarity_score

            })

    # Sort combined results by similarity.
    results.sort(
        key=lambda item: item["similarity"],
        reverse=True
    )

    # Retrieval summary.
    print("\nRETRIEVAL SUMMARY")

    print(
        "Similarity threshold:",
        similarity_threshold
    )

    for document_id in document_ids:

        document_results = [
            result
            for result in results
            if result["document_id"] == document_id
        ]

        if document_results:

            print(
                document_results[0]["filename"],
                "->",
                len(document_results),
                "relevant chunks retrieved"
            )

        else:

            print(
                document_id,
                "-> No relevant chunks found"
            )

    print(
        "\nTotal relevant chunks:",
        len(results)
    )

    return results


# --------------------------------------------------
# TEST RETRIEVAL
# --------------------------------------------------

if __name__ == "__main__":

    question = input(
        "Enter your question: "
    )

    results = retrieve_relevant_chunks(
        question
    )

    print("\nRETRIEVAL RESULTS")

    if not results:

        print(
            "No sufficiently relevant information found."
        )

    for result in results:

        print("\n------------------------------")

        print(
            "Document:",
            result["filename"]
        )

        print(
            "Document ID:",
            result["document_id"]
        )

        print(
            "Page:",
            result["page"]
        )

        print(
            "Chunk:",
            result["chunk_number"]
        )

        print(
            "Similarity:",
            round(result["similarity"], 4)
        )

        print(
            "Text:",
            result["text"]
        )
