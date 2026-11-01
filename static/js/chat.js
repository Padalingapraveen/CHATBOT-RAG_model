
// --------------------------------------------------
// MAIN CHAT ELEMENTS
// --------------------------------------------------

const chatForm = document.getElementById("chatForm");
const questionInput = document.getElementById("questionInput");
const chatArea = document.getElementById("chatArea");
const sendButton = document.getElementById("sendButton");


// --------------------------------------------------
// DOCUMENT LIBRARY ELEMENTS
// --------------------------------------------------

const documentList = document.getElementById("documentList");
const documentCount = document.getElementById("documentCount");

const selectAllButton = document.getElementById("selectAllButton");
const clearSelectionButton = document.getElementById("clearSelectionButton");
const deleteSelectedButton = document.getElementById("deleteSelectedButton");

const scopeStatus = document.getElementById("scopeStatus");

const selectedDocuments = new Set();


// --------------------------------------------------
// UPLOAD ELEMENTS
// --------------------------------------------------

const pdfInput = document.getElementById("pdfInput");
const uploadButton = document.getElementById("uploadButton");
const uploadStatus = document.getElementById("uploadStatus");


// --------------------------------------------------
// ADD CHAT MESSAGE
// --------------------------------------------------

function addMessage(role, text) {

    const message = document.createElement("div");
    message.className = `message ${role}`;

    const label = document.createElement("div");
    label.className = "message-label";

    label.textContent =
        role === "user" ? "You" : "DocuMind AI";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    message.appendChild(label);
    message.appendChild(content);

    chatArea.appendChild(message);
    chatArea.scrollTop = chatArea.scrollHeight;

    return message;
}


// --------------------------------------------------
// ADD SOURCE DETAILS
// --------------------------------------------------

function addSources(message, sources) {

    if (!Array.isArray(sources) || sources.length === 0) {
        return;
    }

    const sourceBox = document.createElement("div");
    sourceBox.className = "sources";

    const heading = document.createElement("strong");
    heading.textContent = "Sources";

    const list = document.createElement("ul");

    sources.forEach(source => {

        const item = document.createElement("li");

        const filename = source.filename || "Unknown document";
        const page = source.page ?? "Unknown";
        const chunk = source.chunk_number;
        const score = source.similarity;

        let description = `${filename} | Page ${page}`;

        if (chunk !== undefined) {
            description += ` | Chunk ${chunk}`;
        }

        if (typeof score === "number") {
            description += ` | Similarity: ${score.toFixed(3)}`;
        }

        item.textContent = description;
        list.appendChild(item);

    });

    sourceBox.appendChild(heading);
    sourceBox.appendChild(list);

    message.appendChild(sourceBox);

    chatArea.scrollTop = chatArea.scrollHeight;
}


// --------------------------------------------------
// WELCOME MESSAGE
// --------------------------------------------------

function showWelcomeMessage(title, description) {

    chatArea.innerHTML = "";

    const welcome = document.createElement("div");
    welcome.className = "welcome-message";

    const heading = document.createElement("h1");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    welcome.appendChild(heading);
    welcome.appendChild(paragraph);

    chatArea.appendChild(welcome);
}


// --------------------------------------------------
// UPDATE DOCUMENT SELECTION STATUS
// --------------------------------------------------

function updateSelectionStatus() {

    const count = selectedDocuments.size;

    if (count === 0) {

        scopeStatus.textContent = "Searching all documents";

    } else {

        scopeStatus.textContent =
            `Searching ${count} selected document(s)`;

    }

    deleteSelectedButton.disabled = count === 0;
}


// --------------------------------------------------
// LOAD DOCUMENT LIBRARY
// --------------------------------------------------

async function loadDocuments(options = {}) {

    const preferredSelection = options.selectedIds;

    documentList.innerHTML = "";

    const loading = document.createElement("p");
    loading.className = "library-loading";
    loading.textContent = "Loading documents...";

    documentList.appendChild(loading);

    try {

        const response = await fetch("/documents");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to load documents."
            );
        }

        const documents = data.documents || [];

        documentCount.textContent = documents.length;

        documentList.innerHTML = "";

        // IDs of available documents
        const availableIds = new Set(
            documents.map(doc => doc.id)
        );

        // Remove IDs of deleted documents
        for (const id of selectedDocuments) {

            if (!availableIds.has(id)) {
                selectedDocuments.delete(id);
            }

        }

        // Select a newly uploaded document
        if (Array.isArray(preferredSelection)) {

            selectedDocuments.clear();

            preferredSelection.forEach(id => {

                if (availableIds.has(id)) {
                    selectedDocuments.add(id);
                }

            });

        }

        // Empty library
        if (documents.length === 0) {

            const emptyMessage = document.createElement("p");

            emptyMessage.className = "library-empty";

            emptyMessage.textContent =
                "No documents uploaded yet.";

            documentList.appendChild(emptyMessage);

            updateSelectionStatus();

            return;

        }

        // Display all uploaded PDFs
        documents.forEach(doc => {

            const card = document.createElement("label");
            card.className = "library-document";

            // Checkbox
            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.value = doc.id;
            checkbox.checked = selectedDocuments.has(doc.id);

            // Document details
            const details = document.createElement("div");

            details.className = "library-document-details";

            // Original uploaded filename
            const name = document.createElement("strong");

            name.textContent =
                doc.filename || doc.stored_filename || "Unknown PDF";

            // Page information
            const info = document.createElement("small");

            info.textContent = `${doc.pages ?? 0} pages`;

            details.appendChild(name);
            details.appendChild(info);

            card.appendChild(checkbox);
            card.appendChild(details);

            documentList.appendChild(card);

            // Selection event
            checkbox.addEventListener("change", function() {

                if (checkbox.checked) {

                    selectedDocuments.add(doc.id);

                } else {

                    selectedDocuments.delete(doc.id);

                }

                updateSelectionStatus();

            });

        });

        updateSelectionStatus();

    }

    catch (error) {

        documentList.innerHTML = "";

        const errorMessage = document.createElement("p");

        errorMessage.className = "library-error";
        errorMessage.textContent = error.message;

        documentList.appendChild(errorMessage);

        console.error("Document library error:", error);

    }

}


// --------------------------------------------------
// SELECT ALL DOCUMENTS
// --------------------------------------------------

selectAllButton.addEventListener("click", function() {

    const checkboxes = documentList.querySelectorAll(
        'input[type="checkbox"]'
    );

    checkboxes.forEach(checkbox => {

        checkbox.checked = true;

        selectedDocuments.add(checkbox.value);

    });

    updateSelectionStatus();

});


// --------------------------------------------------
// DESELECT ALL DOCUMENTS
// --------------------------------------------------

clearSelectionButton.addEventListener("click", function() {

    const checkboxes = documentList.querySelectorAll(
        'input[type="checkbox"]'
    );

    checkboxes.forEach(checkbox => {

        checkbox.checked = false;

    });

    selectedDocuments.clear();

    updateSelectionStatus();

});


// --------------------------------------------------
// DELETE SELECTED DOCUMENTS
// --------------------------------------------------

deleteSelectedButton.addEventListener("click", async function() {

    const ids = Array.from(selectedDocuments);

    if (ids.length === 0) {

        uploadStatus.textContent =
            "Please select documents to delete.";

        return;

    }

    const confirmed = window.confirm(
        `Are you sure you want to permanently delete ${ids.length} selected document(s)?`
    );

    if (!confirmed) {
        return;
    }

    deleteSelectedButton.disabled = true;
    deleteSelectedButton.textContent = "Deleting...";

    let deletedCount = 0;
    const errors = [];

    try {

        for (const id of ids) {

            try {

                const response = await fetch(
                    `/documents/${encodeURIComponent(id)}`,
                    {
                        method: "DELETE"
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {

                    throw new Error(
                        data.error || "Deletion failed."
                    );

                }

                selectedDocuments.delete(id);

                deletedCount++;

            }

            catch (error) {

                errors.push(error.message);

            }

        }

        // Refresh library after deletion
        await loadDocuments();

        if (errors.length === 0) {

            uploadStatus.textContent =
                `${deletedCount} document(s) deleted successfully.`;

            showWelcomeMessage(
                "Document Library Updated",
                "Your selected documents have been deleted."
            );

        } else {

            uploadStatus.textContent =
                `${deletedCount} deleted. ${errors.length} could not be deleted.`;

            console.error("Deletion errors:", errors);

        }

    }

    catch (error) {

        uploadStatus.textContent = error.message;

        console.error("Document deletion error:", error);

        await loadDocuments();

    }

    finally {

        deleteSelectedButton.textContent = "Delete Selected";

        updateSelectionStatus();

    }

});


// --------------------------------------------------
// SEND QUESTION TO FLASK
// --------------------------------------------------

chatForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const question = questionInput.value.trim();

    if (!question) {
        return;
    }

    const welcome = document.querySelector(".welcome-message");

    if (welcome) {
        welcome.remove();
    }

    addMessage("user", question);

    questionInput.value = "";

    sendButton.disabled = true;
    sendButton.textContent = "Thinking...";

    const loadingMessage = addMessage(
        "assistant",
        "Searching documents and generating an answer..."
    );

    try {

        const response = await fetch("/ask", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                question: question,

                selected_documents: Array.from(selectedDocuments)

            })

        });

        const data = await response.json();

        loadingMessage.remove();

        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Something went wrong."
            );

        }

        const result = data.result;

        const answer =
            result.answer || "No answer was generated.";

        const answerMessage = addMessage(
            "assistant",
            answer
        );

        addSources(
            answerMessage,
            result.sources
        );

    }

    catch (error) {

        loadingMessage.remove();

        addMessage(
            "assistant",
            "Sorry, I couldn't generate an answer. " +
            error.message
        );

        console.error("DocuMind error:", error);

    }

    finally {

        sendButton.disabled = false;
        sendButton.textContent = "Send ↑";

        questionInput.focus();

    }

});


// --------------------------------------------------
// ENTER TO SEND
// SHIFT + ENTER FOR NEW LINE
// --------------------------------------------------

questionInput.addEventListener("keydown", function(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        chatForm.requestSubmit();

    }

});


// --------------------------------------------------
// OPEN PDF FILE SELECTOR
// --------------------------------------------------

uploadButton.addEventListener("click", function() {

    pdfInput.click();

});


// --------------------------------------------------
// UPLOAD PDF
// --------------------------------------------------

pdfInput.addEventListener("change", async function() {

    const file = pdfInput.files[0];

    if (!file) {
        return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {

        uploadStatus.textContent =
            "Please select a PDF file.";

        pdfInput.value = "";

        return;

    }

    if (file.size > 20 * 1024 * 1024) {

        uploadStatus.textContent =
            "File must be smaller than 20 MB.";

        pdfInput.value = "";

        return;

    }

    const formData = new FormData();

    formData.append("file", file);

    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading...";

    uploadStatus.textContent =
        "Uploading and extracting PDF text...";

    try {

        const response = await fetch("/upload", {

            method: "POST",

            body: formData

        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Upload failed."
            );

        }

        uploadStatus.textContent =
            `Upload successful! ${data.pages} pages extracted.`;

        // Refresh library and select the uploaded PDF
        await loadDocuments({
            selectedIds: [data.id]
        });

        showWelcomeMessage(
            "Your document is ready!",
            `Ask questions about ${data.filename}.`
        );

    }

    catch (error) {

        uploadStatus.textContent = error.message;

        console.error("PDF upload error:", error);

    }

    finally {

        uploadButton.disabled = false;
        uploadButton.textContent = "+ Upload PDF";

        pdfInput.value = "";

    }

});


// --------------------------------------------------
// INITIALIZE APPLICATION
// --------------------------------------------------

deleteSelectedButton.disabled = true;

loadDocuments();
