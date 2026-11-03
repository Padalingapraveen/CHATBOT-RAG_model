
import json
import re

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import (
    Flask,
    jsonify,
    request,
    render_template,
    send_file
)

from werkzeug.utils import secure_filename

from services.generation import generate_answer
from services.pdf_reader import extract_pdf_text


app = Flask(__name__)


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

UPLOAD_FOLDER = BASE_DIR / "uploads"

TEXT_FILE = BASE_DIR / "extracted_text.txt"

METADATA_FILE = UPLOAD_FOLDER / "documents.json"

CHAT_HISTORY_FILE = UPLOAD_FOLDER / "chat_history.json"

UPLOAD_FOLDER.mkdir(exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024


# --------------------------------------------------
# METADATA FUNCTIONS
# --------------------------------------------------

def load_metadata():

    if not METADATA_FILE.exists():
        return []

    try:

        data = json.loads(
            METADATA_FILE.read_text(encoding="utf-8")
        )

        if not isinstance(data, list):
            raise ValueError("Invalid document metadata format.")

        return data

    except (json.JSONDecodeError, OSError, ValueError):

        app.logger.exception(
            "Document metadata could not be loaded."
        )

        raise RuntimeError(
            "Document metadata is corrupted or unavailable. "
            "Check uploads/documents.json."
        )


def save_metadata(documents):

    temp_file = METADATA_FILE.with_suffix(".tmp")

    temp_file.write_text(
        json.dumps(documents, indent=4),
        encoding="utf-8"
    )

    temp_file.replace(METADATA_FILE)


def get_document_records():
    """
    Get all uploaded PDF records.

    Existing PDFs without metadata are included
    using their stored UUID filename.
    """

    documents = load_metadata()

    cleaned_documents = []
    known_ids = set()

    for document in documents:

        if not isinstance(document, dict):
            continue

        document_id = document.get("id")

        if (
            not isinstance(document_id, str)
            or not re.fullmatch(r"[a-fA-F0-9]{32}", document_id)
            or document_id in known_ids
        ):
            continue

        known_ids.add(document_id)
        cleaned_documents.append(document)

    documents = cleaned_documents

    # Find PDFs without metadata.
    for pdf_path in sorted(UPLOAD_FOLDER.glob("*.pdf")):

        document_id = pdf_path.stem

        if document_id in known_ids:
            continue

        text_path = pdf_path.with_suffix(".txt")

        pages = 0
        characters = 0

        if text_path.exists():

            text = text_path.read_text(
                encoding="utf-8"
            )

            pages = text.count("--- Page ")
            characters = len(text)

        documents.append({

            "id": document_id,

            "filename": pdf_path.name,

            "stored_filename": pdf_path.name,

            "pages": pages,

            "characters": characters,

            "uploaded_at": None

        })

        known_ids.add(document_id)

    existing_ids = {
        path.stem
        for path in UPLOAD_FOLDER.glob("*.pdf")
    }

    documents = [
        document
        for document in documents
        if document.get("id") in existing_ids
    ]

    save_metadata(documents)

    return documents


# --------------------------------------------------
# CHAT HISTORY FUNCTIONS
# --------------------------------------------------

def load_chat_history():
    """
    Load all saved conversations.
    """

    if not CHAT_HISTORY_FILE.exists():
        return []

    try:

        data = json.loads(
            CHAT_HISTORY_FILE.read_text(encoding="utf-8")
        )

        if not isinstance(data, list):
            raise ValueError("Invalid chat history format.")

        return data

    except (json.JSONDecodeError, OSError, ValueError):

        app.logger.exception(
            "Chat history could not be loaded."
        )

        raise RuntimeError(
            "Chat history is corrupted or unavailable. "
            "Check uploads/chat_history.json."
        )


def save_chat_history(chats):
    """
    Save conversations safely using a temporary file.
    """

    temp_file = CHAT_HISTORY_FILE.with_suffix(".tmp")

    temp_file.write_text(
        json.dumps(chats, indent=4),
        encoding="utf-8"
    )

    temp_file.replace(CHAT_HISTORY_FILE)


def find_chat(chat_id):
    """
    Find one conversation using its ID.
    """

    chats = load_chat_history()

    for chat in chats:

        if chat.get("id") == chat_id:
            return chat, chats

    return None, chats


def create_chat():
    """
    Create a new empty conversation.
    """

    now = datetime.now(timezone.utc).isoformat()

    chat = {

        "id": uuid4().hex,

        "title": "New Chat",

        "created_at": now,

        "updated_at": now,

        "messages": []

    }

    chats = load_chat_history()

    chats.insert(0, chat)

    save_chat_history(chats)

    return chat


# --------------------------------------------------
# REFRESH BACKWARD-COMPATIBLE TEXT FILE
# --------------------------------------------------

def refresh_active_text_file():

    remaining_pdfs = list(
        UPLOAD_FOLDER.glob("*.pdf")
    )

    if not remaining_pdfs:

        TEXT_FILE.unlink(missing_ok=True)
        return

    latest_pdf = max(
        remaining_pdfs,
        key=lambda path: path.stat().st_mtime
    )

    latest_text = latest_pdf.with_suffix(".txt")

    if latest_text.exists():

        temp_file = TEXT_FILE.with_suffix(".tmp")

        temp_file.write_text(
            latest_text.read_text(encoding="utf-8"),
            encoding="utf-8"
        )

        temp_file.replace(TEXT_FILE)

    else:

        TEXT_FILE.unlink(missing_ok=True)


# --------------------------------------------------
# HOME PAGE
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():

    return render_template("index.html")


# --------------------------------------------------
# STATUS API
# --------------------------------------------------

@app.route("/status", methods=["GET"])
def status():

    return jsonify({

        "project": "DocuMind AI",

        "status": "Running",

        "version": "1.0"

    }), 200


# --------------------------------------------------
# DOCUMENT LIBRARY API
# --------------------------------------------------

@app.route("/documents", methods=["GET"])
def get_documents():

    try:

        documents = get_document_records()

        return jsonify({

            "success": True,

            "documents": documents,

            "total": len(documents)

        }), 200

    except Exception:

        app.logger.exception(
            "Could not load document library."
        )

        return jsonify({

            "success": False,

            "error": "Unable to load document library."

        }), 500


# --------------------------------------------------
# PDF PREVIEW API
# --------------------------------------------------

@app.route(
    "/documents/<document_id>/preview",
    methods=["GET"]
)
def preview_pdf(document_id):

    try:

        # Validate document ID.
        if not re.fullmatch(
            r"[a-fA-F0-9]{32}",
            document_id
        ):

            return jsonify({

                "success": False,

                "error": "Invalid document ID."

            }), 400

        # Check whether the document is registered.
        documents = get_document_records()

        document = next(
            (
                item for item in documents
                if item.get("id") == document_id
            ),
            None
        )

        if document is None:

            return jsonify({

                "success": False,

                "error": "Document not found."

            }), 404

        # Build the PDF path using the validated UUID.
        pdf_path = UPLOAD_FOLDER / f"{document_id}.pdf"

        if not pdf_path.is_file():

            return jsonify({

                "success": False,

                "error": "PDF file not found."

            }), 404

        # Serve the PDF inside the browser.
        return send_file(

            pdf_path,

            mimetype="application/pdf",

            as_attachment=False,

            download_name=document.get(
                "filename",
                "document.pdf"
            ),

            conditional=True

        )

    except Exception:

        app.logger.exception(
            "PDF preview failed."
        )

        return jsonify({

            "success": False,

            "error": "Unable to preview PDF."

        }), 500


# --------------------------------------------------
# DELETE DOCUMENT API
# --------------------------------------------------

@app.route(
    "/documents/<document_id>",
    methods=["DELETE"]
)
def delete_document(document_id):

    try:

        if not re.fullmatch(
            r"[a-fA-F0-9]{32}",
            document_id
        ):

            return jsonify({

                "success": False,

                "error": "Invalid document ID."

            }), 400

        documents = get_document_records()

        document = next(
            (
                item for item in documents
                if item.get("id") == document_id
            ),
            None
        )

        if document is None:

            return jsonify({

                "success": False,

                "error": "Document not found."

            }), 404

        pdf_path = UPLOAD_FOLDER / f"{document_id}.pdf"

        text_path = UPLOAD_FOLDER / f"{document_id}.txt"

        pdf_path.unlink(missing_ok=True)

        text_path.unlink(missing_ok=True)

        remaining_documents = [
            item
            for item in documents
            if item.get("id") != document_id
        ]

        save_metadata(remaining_documents)

        refresh_active_text_file()

        app.logger.info(
            "Document deleted: %s",
            document.get("filename")
        )

        return jsonify({

            "success": True,

            "message": "Document deleted successfully.",

            "id": document_id

        }), 200

    except Exception:

        app.logger.exception(
            "Document deletion failed."
        )

        return jsonify({

            "success": False,

            "error": "Unable to delete document."

        }), 500


# --------------------------------------------------
# PDF UPLOAD API
# --------------------------------------------------

@app.route("/upload", methods=["POST"])
def upload_pdf():

    pdf_path = None
    text_path = None

    try:

        if "file" not in request.files:

            return jsonify({

                "success": False,

                "error": "Please select a PDF file."

            }), 400

        file = request.files["file"]

        if not file.filename:

            return jsonify({

                "success": False,

                "error": "No file selected."

            }), 400

        original_name = secure_filename(file.filename)

        if not original_name:

            return jsonify({

                "success": False,

                "error": "Invalid filename."

            }), 400

        if not original_name.lower().endswith(".pdf"):

            return jsonify({

                "success": False,

                "error": "Only PDF files are allowed."

            }), 400

        document_id = uuid4().hex

        saved_name = f"{document_id}.pdf"

        pdf_path = UPLOAD_FOLDER / saved_name

        text_path = pdf_path.with_suffix(".txt")

        file.save(str(pdf_path))

        extracted_text = extract_pdf_text(
            str(pdf_path)
        )

        if not extracted_text.strip():

            raise ValueError(
                "No extractable text found. "
                "The PDF may be scanned or empty."
            )

        text_path.write_text(
            extracted_text,
            encoding="utf-8"
        )

        document = {

            "id": document_id,

            "filename": original_name,

            "stored_filename": saved_name,

            "pages": extracted_text.count("--- Page "),

            "characters": len(extracted_text),

            "uploaded_at": datetime.now(
                timezone.utc
            ).isoformat()

        }

        documents = get_document_records()

        documents = [
            item
            for item in documents
            if item.get("id") != document_id
        ]

        documents.append(document)

        save_metadata(documents)

        refresh_active_text_file()

        app.logger.info(
            "PDF uploaded: %s",
            original_name
        )

        return jsonify({

            "success": True,

            "message": "PDF uploaded successfully.",

            **document

        }), 200

    except ValueError as e:

        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)

        if text_path is not None:
            text_path.unlink(missing_ok=True)

        return jsonify({

            "success": False,

            "error": str(e)

        }), 400

    except Exception:

        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)

        if text_path is not None:
            text_path.unlink(missing_ok=True)

        app.logger.exception(
            "PDF upload failed."
        )

        return jsonify({

            "success": False,

            "error": "PDF upload failed. Check server logs."

        }), 500


# --------------------------------------------------
# CREATE NEW CHAT API
# --------------------------------------------------

@app.route("/chats", methods=["POST"])
def create_new_chat():

    try:

        chat = create_chat()

        return jsonify({

            "success": True,

            "chat": chat

        }), 201

    except Exception:

        app.logger.exception(
            "Could not create new chat."
        )

        return jsonify({

            "success": False,

            "error": "Unable to create a new chat."

        }), 500


# --------------------------------------------------
# GET ALL CHAT HISTORY API
# --------------------------------------------------

@app.route("/chats", methods=["GET"])
def get_chats():

    try:

        chats = load_chat_history()

        summaries = []

        for chat in chats:

            messages = chat.get("messages", [])

            summaries.append({

                "id": chat.get("id"),

                "title": chat.get("title", "New Chat"),

                "created_at": chat.get("created_at"),

                "updated_at": chat.get("updated_at"),

                "message_count": len(messages)

            })

        return jsonify({

            "success": True,

            "chats": summaries

        }), 200

    except Exception:

        app.logger.exception(
            "Could not load chat history."
        )

        return jsonify({

            "success": False,

            "error": "Unable to load chat history."

        }), 500


# --------------------------------------------------
# OPEN PREVIOUS CHAT API
# --------------------------------------------------

@app.route("/chats/<chat_id>", methods=["GET"])
def get_chat(chat_id):

    try:

        if not re.fullmatch(
            r"[a-fA-F0-9]{32}",
            chat_id
        ):

            return jsonify({

                "success": False,

                "error": "Invalid chat ID."

            }), 400

        chat, chats = find_chat(chat_id)

        if chat is None:

            return jsonify({

                "success": False,

                "error": "Chat not found."

            }), 404

        return jsonify({

            "success": True,

            "chat": chat

        }), 200

    except Exception:

        app.logger.exception(
            "Could not open chat."
        )

        return jsonify({

            "success": False,

            "error": "Unable to open chat."

        }), 500


# --------------------------------------------------
# DELETE CHAT API
# --------------------------------------------------

@app.route(
    "/chats/<chat_id>",
    methods=["DELETE"]
)
def delete_chat(chat_id):

    try:

        if not re.fullmatch(
            r"[a-fA-F0-9]{32}",
            chat_id
        ):

            return jsonify({

                "success": False,

                "error": "Invalid chat ID."

            }), 400

        chat, chats = find_chat(chat_id)

        if chat is None:

            return jsonify({

                "success": False,

                "error": "Chat not found."

            }), 404

        chats = [
            item
            for item in chats
            if item.get("id") != chat_id
        ]

        save_chat_history(chats)

        return jsonify({

            "success": True,

            "message": "Chat deleted successfully."

        }), 200

    except Exception:

        app.logger.exception(
            "Could not delete chat."
        )

        return jsonify({

            "success": False,

            "error": "Unable to delete chat."

        }), 500


# --------------------------------------------------
# QUESTION ANSWERING API WITH CONVERSATION MEMORY
# --------------------------------------------------

@app.route("/ask", methods=["POST"])
def ask_question():

    try:

        data = request.get_json(silent=True)

        if not isinstance(data, dict):

            return jsonify({

                "success": False,

                "error": "Request must contain valid JSON."

            }), 400

        question = data.get("question", "")

        if (
            not isinstance(question, str)
            or not question.strip()
        ):

            return jsonify({

                "success": False,

                "error": "Please provide a valid question."

            }), 400

        selected_documents = data.get(
            "selected_documents",
            []
        )

        if not isinstance(selected_documents, list):

            return jsonify({

                "success": False,

                "error": "Selected documents must be a list."

            }), 400

        if not all(
            isinstance(item, str)
            and re.fullmatch(r"[a-fA-F0-9]{32}", item)
            for item in selected_documents
        ):

            return jsonify({

                "success": False,

                "error": "Invalid selected document ID."

            }), 400

        question = question.strip()

        selected_documents = list(
            dict.fromkeys(selected_documents)
        )

        # ------------------------------------------
        # GET OR CREATE CONVERSATION
        # ------------------------------------------

        chat_id = data.get("conversation_id")

        if chat_id:

            if (
                not isinstance(chat_id, str)
                or not re.fullmatch(
                    r"[a-fA-F0-9]{32}",
                    chat_id
                )
            ):

                return jsonify({

                    "success": False,

                    "error": "Invalid conversation ID."

                }), 400

            chat, chats = find_chat(chat_id)

            if chat is None:

                return jsonify({

                    "success": False,

                    "error": "Conversation not found."

                }), 404

        else:

            chat = create_chat()

            chat_id = chat["id"]

            chats = load_chat_history()

        # ------------------------------------------
        # GET PREVIOUS CONVERSATION MESSAGES
        # ------------------------------------------

        conversation_history = chat.get(
            "messages",
            []
        )

        # ------------------------------------------
        # GENERATE ANSWER WITH MEMORY
        # ------------------------------------------

        app.logger.info(
            "Received question: %s",
            question
        )

        result = generate_answer(

            question,

            selected_documents=selected_documents,

            conversation_history=conversation_history

        )

        if not isinstance(result, dict):

            raise RuntimeError(
                "Answer generator returned an invalid response."
            )

        answer = result.get(
            "answer",
            "No answer was generated."
        )

        sources = result.get("sources", [])

        if not isinstance(answer, str):
            answer = str(answer)

        if not isinstance(sources, list):
            sources = []

        # ------------------------------------------
        # SAVE USER AND ASSISTANT MESSAGES
        # ------------------------------------------

        now = datetime.now(timezone.utc).isoformat()

        # Use the first question as the chat title.
        if not chat.get("messages"):

            chat["title"] = (
                question[:45] + "..."
                if len(question) > 45
                else question
            )

        # Save user question.
        chat["messages"].append({

            "role": "user",

            "content": question,

            "timestamp": now,

            "selected_documents": selected_documents

        })

        # Save assistant answer.
        chat["messages"].append({

            "role": "assistant",

            "content": answer,

            "timestamp": now,

            "sources": sources

        })

        chat["updated_at"] = now

        # Update the conversation in the history list.
        for index, item in enumerate(chats):

            if item.get("id") == chat_id:

                chats[index] = chat
                break

        else:

            chats.insert(0, chat)

        save_chat_history(chats)

        # ------------------------------------------
        # SEND RESPONSE TO FRONTEND
        # ------------------------------------------

        return jsonify({

            "success": True,

            "question": question,

            "conversation_id": chat_id,

            "result": result

        }), 200

    except ValueError as e:

        return jsonify({

            "success": False,

            "error": str(e)

        }), 400

    except Exception:

        app.logger.exception(
            "Question answering failed."
        )

        return jsonify({

            "success": False,

            "error": "Unable to generate an answer. Check server logs."

        }), 500


# --------------------------------------------------
# FILE TOO LARGE ERROR
# --------------------------------------------------

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({

        "success": False,

        "error": "File is too large. Maximum allowed size is 20 MB."

    }), 413


# --------------------------------------------------
# RUN FLASK APPLICATION
# --------------------------------------------------

if __name__ == "__main__":

    app.run(

        host="127.0.0.1",

        port=5000,

        debug=True

    )
