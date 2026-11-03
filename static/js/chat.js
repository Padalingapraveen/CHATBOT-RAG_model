
// --------------------------------------------------
// DOCUMIND AI - MAIN CHAT ELEMENTS
// --------------------------------------------------

const chatForm = document.getElementById("chatForm");
const questionInput = document.getElementById("questionInput");
const chatArea = document.getElementById("chatArea");
const sendButton = document.getElementById("sendButton");


// --------------------------------------------------
// CHAT HISTORY ELEMENTS
// --------------------------------------------------

const newChatButton = document.getElementById("newChatButton");
const chatHistoryList = document.getElementById("chatHistoryList");

let currentConversationId = null;


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
let documentRecords = [];


// --------------------------------------------------
// UPLOAD ELEMENTS
// --------------------------------------------------

const pdfInput = document.getElementById("pdfInput");
const uploadButton = document.getElementById("uploadButton");
const uploadStatus = document.getElementById("uploadStatus");


// --------------------------------------------------
// PDF.JS VIEWER ELEMENTS
// --------------------------------------------------

const pdfPreviewModal = document.getElementById("pdfPreviewModal");
const pdfPreviewTitle = document.getElementById("pdfPreviewTitle");
const pdfPreviewFilename = document.getElementById("pdfPreviewFilename");
const closePdfPreviewButton = document.getElementById("closePdfPreviewButton");

const pdfPreviousPageButton = document.getElementById("pdfPreviousPageButton");
const pdfNextPageButton = document.getElementById("pdfNextPageButton");
const pdfPageInput = document.getElementById("pdfPageInput");
const goToPdfPageButton = document.getElementById("goToPdfPageButton");
const pdfPageStatus = document.getElementById("pdfPageStatus");

const pdfZoomOutButton = document.getElementById("pdfZoomOutButton");
const pdfZoomInButton = document.getElementById("pdfZoomInButton");
const pdfZoomLevel = document.getElementById("pdfZoomLevel");
const pdfFitPageButton = document.getElementById("pdfFitPageButton");
const pdfFullscreenButton = document.getElementById("pdfFullscreenButton");

const pdfSearchInput = document.getElementById("pdfSearchInput");
const pdfSearchButton = document.getElementById("pdfSearchButton");
const pdfClearSearchButton = document.getElementById("pdfClearSearchButton");
const pdfSearchStatus = document.getElementById("pdfSearchStatus");

const pdfViewerContainer = document.getElementById("pdfViewerContainer");
const pdfLoadingMessage = document.getElementById("pdfLoadingMessage");
const pdfPageContainer = document.getElementById("pdfPageContainer");
const pdfCanvas = document.getElementById("pdfCanvas");
const pdfTextLayer = document.getElementById("pdfTextLayer");
const pdfPreviewError = document.getElementById("pdfPreviewError");


// --------------------------------------------------
// PDF.JS STATE
// --------------------------------------------------

let currentPdfDocument = null;
let currentPreviewDocumentId = null;
let currentPreviewPage = 1;
let currentPreviewPageCount = 0;
let currentPdfScale = 1;
let currentPdfRenderTask = null;
let currentPdfLoadingTask = null;

let currentPdfSearchQuery = "";
let currentPdfSearchMatches = [];
let currentPdfSearchIndex = -1;
let pdfSearchRequestId = 0;

let pdfRenderRequestId = 0;
let pdfFitMode = false;
let pdfLastViewport = null;


// --------------------------------------------------
// PDF.JS INITIALIZATION
// --------------------------------------------------

if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
} else {
    console.error(
        "PDF.js could not be loaded. Check the PDF.js script in index.html."
    );
}


// --------------------------------------------------
// SAFE INLINE MARKDOWN RENDERER
// --------------------------------------------------

function renderInlineMarkdown(text, container) {
    const pattern =
        /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(
                document.createTextNode(
                    text.slice(lastIndex, match.index)
                )
            );
        }

        const token = match[0];
        let element;
        let content;

        if (token.startsWith("**") || token.startsWith("__")) {
            element = document.createElement("strong");
            content = token.slice(2, -2);
        } else if (token.startsWith("~~")) {
            element = document.createElement("del");
            content = token.slice(2, -2);
        } else if (token.startsWith("*") || token.startsWith("_")) {
            element = document.createElement("em");
            content = token.slice(1, -1);
        } else {
            element = document.createElement("code");
            content = token.slice(1, -1);
        }

        element.textContent = content;
        container.appendChild(element);

        lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
        container.appendChild(
            document.createTextNode(text.slice(lastIndex))
        );
    }
}


// --------------------------------------------------
// MARKDOWN BLOCK RENDERER
// --------------------------------------------------

function renderMarkdown(text, container) {
    if (typeof text !== "string" || !text.trim()) {
        return;
    }

    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];

        if (!line.trim()) {
            index++;
            continue;
        }

        // FENCED CODE BLOCK
        if (line.trim().startsWith("```")) {
            const language = line.trim().slice(3).trim();
            const codeLines = [];

            index++;

            while (
                index < lines.length &&
                !lines[index].trim().startsWith("```")
            ) {
                codeLines.push(lines[index]);
                index++;
            }

            if (index < lines.length) {
                index++;
            }

            const pre = document.createElement("pre");
            pre.className = "markdown-code-block";

            const code = document.createElement("code");

            if (language) {
                code.className =
                    `language-${language.replace(/[^a-zA-Z0-9_-]/g, "")}`;
            }

            code.textContent = codeLines.join("\n");
            pre.appendChild(code);
            container.appendChild(pre);

            continue;
        }

        // HEADINGS
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const level = headingMatch[1].length;
            const heading = document.createElement(`h${level}`);

            renderInlineMarkdown(headingMatch[2], heading);
            container.appendChild(heading);

            index++;
            continue;
        }

        // HORIZONTAL RULE
        if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
            container.appendChild(document.createElement("hr"));
            index++;
            continue;
        }

        // UNORDERED LIST
        if (/^\s*[-*+]\s+/.test(line)) {
            const list = document.createElement("ul");

            while (
                index < lines.length &&
                /^\s*[-*+]\s+/.test(lines[index])
            ) {
                const item = document.createElement("li");

                const content = lines[index].replace(
                    /^\s*[-*+]\s+/,
                    ""
                );

                renderInlineMarkdown(content, item);
                list.appendChild(item);
                index++;
            }

            container.appendChild(list);
            continue;
        }

        // ORDERED LIST
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const list = document.createElement("ol");

            while (
                index < lines.length &&
                /^\s*\d+[.)]\s+/.test(lines[index])
            ) {
                const item = document.createElement("li");

                const content = lines[index].replace(
                    /^\s*\d+[.)]\s+/,
                    ""
                );

                renderInlineMarkdown(content, item);
                list.appendChild(item);
                index++;
            }

            container.appendChild(list);
            continue;
        }

        // BLOCKQUOTE
        if (/^\s*>\s?/.test(line)) {
            const quote = document.createElement("blockquote");

            while (
                index < lines.length &&
                /^\s*>\s?/.test(lines[index])
            ) {
                const content = lines[index].replace(/^\s*>\s?/, "");
                const paragraph = document.createElement("p");

                renderInlineMarkdown(content, paragraph);
                quote.appendChild(paragraph);
                index++;
            }

            container.appendChild(quote);
            continue;
        }

        // NORMAL PARAGRAPH
        const paragraph = document.createElement("p");

        renderInlineMarkdown(line, paragraph);
        index++;

        while (
            index < lines.length &&
            lines[index].trim() &&
            !/^\s*#{1,6}\s+/.test(lines[index]) &&
            !/^\s*[-*+]\s+/.test(lines[index]) &&
            !/^\s*\d+[.)]\s+/.test(lines[index]) &&
            !/^\s*>\s?/.test(lines[index]) &&
            !lines[index].trim().startsWith("```") &&
            !/^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[index])
        ) {
            paragraph.appendChild(document.createElement("br"));
            renderInlineMarkdown(lines[index], paragraph);
            index++;
        }

        container.appendChild(paragraph);
    }
}


// --------------------------------------------------
// PDF SOURCE LOOKUP
// --------------------------------------------------

function findSourceDocument(source) {
    if (!source || typeof source !== "object") {
        return null;
    }

    const possibleIds = [
        source.document_id,
        source.documentId,
        source.doc_id,
        source.file_id,
        source.id
    ];

    for (const id of possibleIds) {
        if (
            typeof id === "string" &&
            /^[a-fA-F0-9]{32}$/.test(id)
        ) {
            const matchingDocument = documentRecords.find(
                item => item.id === id
            );

            if (matchingDocument) {
                return matchingDocument;
            }
        }
    }

    const filename =
        source.filename ||
        source.file_name ||
        source.document_name;

    if (typeof filename === "string" && filename.trim()) {
        const normalizedName = filename.trim().toLowerCase();

        return documentRecords.find(item => {
            const names = [
                item.filename,
                item.stored_filename
            ];

            return names.some(name =>
                typeof name === "string" &&
                name.toLowerCase() === normalizedName
            );
        }) || null;
    }

    return null;
}


// --------------------------------------------------
// PDF VIEWER HELPERS
// --------------------------------------------------

function setPdfLoading(message) {
    if (pdfLoadingMessage) {
        pdfLoadingMessage.textContent = message;
        pdfLoadingMessage.hidden = false;
    }

    if (pdfPageContainer) {
        pdfPageContainer.hidden = true;
    }
}

function hidePdfLoading() {
    if (pdfLoadingMessage) {
        pdfLoadingMessage.hidden = true;
    }
}

function showPdfError(message) {
    if (pdfPreviewError) {
        pdfPreviewError.textContent = message;
        pdfPreviewError.hidden = false;
    }

    hidePdfLoading();
}

function clearPdfError() {
    if (pdfPreviewError) {
        pdfPreviewError.textContent = "";
        pdfPreviewError.hidden = true;
    }
}

function updatePdfToolbar() {
    if (pdfPageInput) {
        pdfPageInput.value = currentPreviewPage;
        pdfPageInput.max = currentPreviewPageCount || "";
    }

    if (pdfPageStatus) {
        pdfPageStatus.textContent = currentPreviewPageCount
            ? `of ${currentPreviewPageCount} pages`
            : "";
    }

    if (pdfPreviousPageButton) {
        pdfPreviousPageButton.disabled =
            !currentPdfDocument || currentPreviewPage <= 1;
    }

    if (pdfNextPageButton) {
        pdfNextPageButton.disabled =
            !currentPdfDocument ||
            currentPreviewPage >= currentPreviewPageCount;
    }

    if (pdfZoomLevel) {
        pdfZoomLevel.textContent =
            `${Math.round(currentPdfScale * 100)}%`;
    }
}

function clearPdfSearchHighlights() {
    if (!pdfTextLayer) {
        return;
    }

    pdfTextLayer.querySelectorAll(
        ".pdf-search-highlight, .pdf-search-active"
    ).forEach(element => {
        element.classList.remove(
            "pdf-search-highlight",
            "pdf-search-active"
        );
    });
}

function resetPdfSearch() {
    pdfSearchRequestId++;

    currentPdfSearchQuery = "";
    currentPdfSearchMatches = [];
    currentPdfSearchIndex = -1;

    clearPdfSearchHighlights();

    if (pdfSearchStatus) {
        pdfSearchStatus.textContent = "";
    }
}

function cancelPdfRender() {
    if (currentPdfRenderTask) {
        try {
            currentPdfRenderTask.cancel();
        } catch (error) {
            console.debug("PDF render cancellation:", error);
        }

        currentPdfRenderTask = null;
    }
}


// --------------------------------------------------
// OPEN PDF PREVIEW
// --------------------------------------------------

async function openPdfPreview(documentId, page = 1) {
    if (!pdfPreviewModal || !window.pdfjsLib) {
        alert("The PDF viewer is unavailable. Please refresh the page.");
        return;
    }

    const sourceDocument = documentRecords.find(
        item => item.id === documentId
    );

    if (!sourceDocument) {
        alert(
            "This PDF is no longer available. Refresh the document library."
        );
        return;
    }

    // Invalidate pending rendering and search operations.
    pdfRenderRequestId++;
    resetPdfSearch();
    cancelPdfRender();

    if (currentPdfLoadingTask) {
        try {
            await currentPdfLoadingTask.destroy();
        } catch (error) {
            console.debug("Previous PDF loading task:", error);
        }

        currentPdfLoadingTask = null;
    }

    if (currentPdfDocument) {
        try {
            await currentPdfDocument.destroy();
        } catch (error) {
            console.debug("Previous PDF cleanup:", error);
        }

        currentPdfDocument = null;
    }

    currentPreviewDocumentId = documentId;
    currentPreviewPage = Math.max(1, Number.parseInt(page, 10) || 1);
    currentPreviewPageCount = 0;
    currentPdfScale = 1;
    pdfFitMode = true;
    pdfLastViewport = null;

    pdfPreviewTitle.textContent = "PDF Preview";
    pdfPreviewFilename.textContent =
        sourceDocument.filename || "Document.pdf";

    pdfPreviewModal.hidden = false;
    document.body.classList.add("pdf-preview-open");

    clearPdfError();
    setPdfLoading("Loading PDF document...");
    updatePdfToolbar();

    if (pdfSearchInput) {
        pdfSearchInput.value = "";
    }

    try {
        const previewUrl =
            `/documents/${encodeURIComponent(documentId)}/preview`;

        currentPdfLoadingTask = window.pdfjsLib.getDocument({
            url: previewUrl
        });

        const loadedPdf = await currentPdfLoadingTask.promise;

        // Ignore results if the user opened another PDF meanwhile.
        if (currentPreviewDocumentId !== documentId) {
            await loadedPdf.destroy();
            return;
        }

        currentPdfDocument = loadedPdf;
        currentPreviewPageCount = loadedPdf.numPages;

        currentPreviewPage = Math.min(
            Math.max(1, currentPreviewPage),
            currentPreviewPageCount
        );

        updatePdfToolbar();

        await renderPdfPage(currentPreviewPage, true);
    } catch (error) {
        console.error("PDF loading error:", error);

        showPdfError(
            "Unable to load this PDF. Check the server connection, " +
            "the PDF.js CDN connection, and the document preview endpoint."
        );
    }
}


// --------------------------------------------------
// RENDER PDF PAGE
// --------------------------------------------------

async function renderPdfPage(pageNumber, fitToPage = false) {
    if (!currentPdfDocument || !pdfCanvas || !pdfTextLayer) {
        return;
    }

    const requestedDocument = currentPdfDocument;
    const requestedDocumentId = currentPreviewDocumentId;
    const renderId = ++pdfRenderRequestId;

    cancelPdfRender();
    clearPdfError();
    setPdfLoading("Rendering page...");

    try {
        const page = await requestedDocument.getPage(pageNumber);

        if (
            renderId !== pdfRenderRequestId ||
            requestedDocument !== currentPdfDocument
        ) {
            return;
        }

        const baseViewport = page.getViewport({ scale: 1 });

        let scale = currentPdfScale;

        if (fitToPage || pdfFitMode) {
            const availableWidth = Math.max(
                200,
                (pdfViewerContainer.clientWidth || 800) - 50
            );

            const availableHeight = Math.max(
                200,
                (pdfViewerContainer.clientHeight || 600) - 50
            );

            const widthScale = availableWidth / baseViewport.width;
            const heightScale = availableHeight / baseViewport.height;

            scale = Math.min(widthScale, heightScale);
            scale = Math.max(0.3, Math.min(scale, 3));
            currentPdfScale = scale;
        }

        const viewport = page.getViewport({ scale });

        const outputScale = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        const canvasContext = pdfCanvas.getContext("2d");

        pdfCanvas.width = Math.floor(viewport.width * outputScale);
        pdfCanvas.height = Math.floor(viewport.height * outputScale);

        pdfCanvas.style.width = `${viewport.width}px`;
        pdfCanvas.style.height = `${viewport.height}px`;

        pdfPageContainer.style.width = `${viewport.width}px`;
        pdfPageContainer.style.height = `${viewport.height}px`;
        pdfPageContainer.hidden = false;

        pdfTextLayer.innerHTML = "";
        pdfTextLayer.style.width = `${viewport.width}px`;
        pdfTextLayer.style.height = `${viewport.height}px`;

        const renderContext = {
            canvasContext,
            viewport,
            transform: outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null
        };

        const renderTask = page.render(renderContext);
        currentPdfRenderTask = renderTask;

        await renderTask.promise;

        if (
            renderId !== pdfRenderRequestId ||
            requestedDocument !== currentPdfDocument ||
            requestedDocumentId !== currentPreviewDocumentId
        ) {
            return;
        }

        // Create selectable text on top of the rendered page.
        const textContent = await page.getTextContent();

        if (
            renderId !== pdfRenderRequestId ||
            requestedDocument !== currentPdfDocument
        ) {
            return;
        }

        if (typeof window.pdfjsLib.renderTextLayer === "function") {
            const textLayerTask = window.pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                textContent,
                container: pdfTextLayer,
                viewport,
                textDivs: []
            });

            if (textLayerTask && textLayerTask.promise) {
                await textLayerTask.promise;
            } else if (textLayerTask && typeof textLayerTask.then === "function") {
                await textLayerTask;
            }
        } else {
            // The PDF remains readable if the CDN text-layer API differs.
            console.warn(
                "PDF.js text-layer API is unavailable; text selection is disabled."
            );
        }

        if (
            renderId !== pdfRenderRequestId ||
            requestedDocument !== currentPdfDocument
        ) {
            return;
        }

        currentPreviewPage = pageNumber;
        pdfLastViewport = viewport;

        hidePdfLoading();
        updatePdfToolbar();

        if (currentPdfSearchQuery) {
            highlightSearchOnCurrentPage();
        }

        if (fitToPage || pdfFitMode) {
            pdfViewerContainer.scrollTop = 0;
            pdfViewerContainer.scrollLeft = 0;
        }
    } catch (error) {
        if (error && error.name === "RenderingCancelledException") {
            return;
        }

        console.error("PDF page rendering error:", error);

        if (renderId === pdfRenderRequestId) {
            showPdfError(
                `Unable to render page ${pageNumber}. Please try another page.`
            );
        }
    } finally {
        if (renderId === pdfRenderRequestId) {
            currentPdfRenderTask = null;
        }
    }
}


// --------------------------------------------------
// PAGE NAVIGATION
// --------------------------------------------------

async function goToPdfPage() {
    if (!currentPdfDocument) {
        return;
    }

    const page = Number.parseInt(pdfPageInput.value, 10);

    if (!Number.isInteger(page) || page < 1 || page > currentPreviewPageCount) {
        if (pdfSearchStatus) {
            pdfSearchStatus.textContent =
                `Enter a page between 1 and ${currentPreviewPageCount}.`;
        }

        pdfPageInput.value = currentPreviewPage;
        return;
    }

    pdfFitMode = false;
    await renderPdfPage(page);
}

if (goToPdfPageButton) {
    goToPdfPageButton.addEventListener("click", goToPdfPage);
}

if (pdfPageInput) {
    pdfPageInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            goToPdfPage();
        }
    });
}

if (pdfPreviousPageButton) {
    pdfPreviousPageButton.addEventListener("click", async () => {
        if (currentPdfDocument && currentPreviewPage > 1) {
            pdfFitMode = false;
            await renderPdfPage(currentPreviewPage - 1);
        }
    });
}

if (pdfNextPageButton) {
    pdfNextPageButton.addEventListener("click", async () => {
        if (
            currentPdfDocument &&
            currentPreviewPage < currentPreviewPageCount
        ) {
            pdfFitMode = false;
            await renderPdfPage(currentPreviewPage + 1);
        }
    });
}


// --------------------------------------------------
// ZOOM CONTROLS
// --------------------------------------------------

async function changePdfZoom(amount) {
    if (!currentPdfDocument) {
        return;
    }

    pdfFitMode = false;

    currentPdfScale = Math.max(
        0.5,
        Math.min(3, currentPdfScale + amount)
    );

    await renderPdfPage(currentPreviewPage);
}

if (pdfZoomInButton) {
    pdfZoomInButton.addEventListener("click", () => {
        changePdfZoom(0.2);
    });
}

if (pdfZoomOutButton) {
    pdfZoomOutButton.addEventListener("click", () => {
        changePdfZoom(-0.2);
    });
}

if (pdfFitPageButton) {
    pdfFitPageButton.addEventListener("click", async () => {
        if (!currentPdfDocument) {
            return;
        }

        pdfFitMode = true;
        await renderPdfPage(currentPreviewPage, true);
    });
}


// --------------------------------------------------
// PDF FULLSCREEN
// --------------------------------------------------

if (pdfFullscreenButton) {
    pdfFullscreenButton.addEventListener("click", async () => {
        const fullscreenTarget =
            document.querySelector(".pdf-preview-container");

        if (!fullscreenTarget) {
            return;
        }

        try {
            if (!document.fullscreenElement) {
                await fullscreenTarget.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error("Fullscreen error:", error);

            if (pdfSearchStatus) {
                pdfSearchStatus.textContent =
                    "Fullscreen is not available in this browser.";
            }
        }
    });
}


// --------------------------------------------------
// SEARCH THE PDF DOCUMENT
// --------------------------------------------------

async function searchPdfDocument() {
    if (!currentPdfDocument) {
        return;
    }

    const query = pdfSearchInput.value.trim();

    resetPdfSearch();

    if (!query) {
        if (pdfSearchStatus) {
            pdfSearchStatus.textContent = "Enter text to search.";
        }
        return;
    }

    currentPdfSearchQuery = query;

    const requestId = ++pdfSearchRequestId;
    const searchDocument = currentPdfDocument;

    if (pdfSearchStatus) {
        pdfSearchStatus.textContent = "Searching document...";
    }

    try {
        const normalizedQuery = query.toLocaleLowerCase();
        const matches = [];

        for (
            let pageNumber = 1;
            pageNumber <= searchDocument.numPages;
            pageNumber++
        ) {
            if (
                requestId !== pdfSearchRequestId ||
                searchDocument !== currentPdfDocument
            ) {
                return;
            }

            const page = await searchDocument.getPage(pageNumber);
            const textContent = await page.getTextContent();

            for (const item of textContent.items) {
                if (
                    typeof item.str === "string" &&
                    item.str.toLocaleLowerCase().includes(normalizedQuery)
                ) {
                    matches.push({
                        page: pageNumber,
                        text: item.str
                    });
                }
            }
        }

        if (
            requestId !== pdfSearchRequestId ||
            searchDocument !== currentPdfDocument
        ) {
            return;
        }

        currentPdfSearchMatches = matches;

        if (matches.length === 0) {
            if (pdfSearchStatus) {
                pdfSearchStatus.textContent = "No matches found.";
            }
            return;
        }

        currentPdfSearchIndex = 0;

        if (pdfSearchStatus) {
            pdfSearchStatus.textContent =
                `${matches.length} matching text item(s) found.`;
        }

        const firstMatchPage = matches[0].page;

        pdfFitMode = false;
        await renderPdfPage(firstMatchPage);
    } catch (error) {
        console.error("PDF search error:", error);

        if (pdfSearchStatus) {
            pdfSearchStatus.textContent =
                "Search failed. Please try again.";
        }
    }
}

function highlightSearchOnCurrentPage() {
    if (!pdfTextLayer || !currentPdfSearchQuery) {
        return;
    }

    clearPdfSearchHighlights();

    const query = currentPdfSearchQuery.toLocaleLowerCase();

    const spans = Array.from(
        pdfTextLayer.querySelectorAll("span")
    );

    let firstMatch = null;

    spans.forEach(span => {
        if (
            span.textContent &&
            span.textContent.toLocaleLowerCase().includes(query)
        ) {
            span.classList.add("pdf-search-highlight");

            if (!firstMatch) {
                firstMatch = span;
            }
        }
    });

    if (firstMatch) {
        firstMatch.classList.add("pdf-search-active");
    }
}

if (pdfSearchButton) {
    pdfSearchButton.addEventListener("click", searchPdfDocument);
}

if (pdfSearchInput) {
    pdfSearchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchPdfDocument();
        }
    });
}

if (pdfClearSearchButton) {
    pdfClearSearchButton.addEventListener("click", () => {
        if (pdfSearchInput) {
            pdfSearchInput.value = "";
        }

        resetPdfSearch();

        if (pdfSearchStatus) {
            pdfSearchStatus.textContent = "Search cleared.";
        }
    });
}


// --------------------------------------------------
// CLOSE PDF PREVIEW
// --------------------------------------------------

async function closePdfPreview() {
    if (!pdfPreviewModal) {
        return;
    }

    pdfPreviewModal.hidden = true;
    document.body.classList.remove("pdf-preview-open");

    pdfRenderRequestId++;
    resetPdfSearch();
    cancelPdfRender();

    const loadingTask = currentPdfLoadingTask;
    const pdfDocument = currentPdfDocument;

    currentPdfLoadingTask = null;
    currentPdfDocument = null;
    currentPreviewDocumentId = null;
    currentPreviewPage = 1;
    currentPreviewPageCount = 0;
    currentPdfScale = 1;
    pdfFitMode = false;
    pdfLastViewport = null;

    if (loadingTask) {
        try {
            await loadingTask.destroy();
        } catch (error) {
            console.debug("PDF loading cleanup:", error);
        }
    } else if (pdfDocument) {
        try {
            await pdfDocument.destroy();
        } catch (error) {
            console.debug("PDF document cleanup:", error);
        }
    }

    if (pdfTextLayer) {
        pdfTextLayer.innerHTML = "";
    }

    if (pdfCanvas) {
        const context = pdfCanvas.getContext("2d");

        if (context) {
            context.clearRect(
                0,
                0,
                pdfCanvas.width,
                pdfCanvas.height
            );
        }

        pdfCanvas.width = 0;
        pdfCanvas.height = 0;
        pdfCanvas.style.width = "";
        pdfCanvas.style.height = "";
    }

    if (pdfPageContainer) {
        pdfPageContainer.hidden = true;
        pdfPageContainer.style.width = "";
        pdfPageContainer.style.height = "";
    }

    if (pdfPreviewError) {
        pdfPreviewError.hidden = true;
        pdfPreviewError.textContent = "";
    }

    setPdfLoading("Select a source to preview a PDF.");
    updatePdfToolbar();
}

if (closePdfPreviewButton) {
    closePdfPreviewButton.addEventListener("click", closePdfPreview);
}

if (pdfPreviewModal) {
    pdfPreviewModal.addEventListener("click", event => {
        if (event.target === pdfPreviewModal) {
            closePdfPreview();
        }
    });
}

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        pdfPreviewModal &&
        !pdfPreviewModal.hidden
    ) {
        // Let the browser close fullscreen first.
        if (document.fullscreenElement) {
            return;
        }

        closePdfPreview();
    }
});


// --------------------------------------------------
// ADD CHAT MESSAGE
// --------------------------------------------------

function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = `message ${role}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "DocuMind AI";

    const content = document.createElement("div");
    content.className = "message-content";

    if (role === "assistant") {
        renderMarkdown(text || "", content);
    } else {
        content.textContent = text || "";
    }

    message.appendChild(label);
    message.appendChild(content);
    chatArea.appendChild(message);

    chatArea.scrollTop = chatArea.scrollHeight;

    return message;
}


// --------------------------------------------------
// ADD CLICKABLE SOURCE DETAILS
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

        const filename =
            source.filename ||
            source.file_name ||
            source.document_name ||
            "Unknown document";

        const page = Number.parseInt(
            source.page ?? source.page_number,
            10
        );

        const chunk = source.chunk_number;
        const score = source.similarity;

        // Do not name this variable "document":
        // that would shadow the browser's document object.
        const sourceDocument = findSourceDocument(source);

        const description = sourceDocument
            ? sourceDocument.filename || filename
            : filename;

        if (
            sourceDocument &&
            Number.isInteger(page) &&
            page > 0
        ) {
            const sourceButton = document.createElement("button");

            sourceButton.type = "button";
            sourceButton.className = "source-link";
            sourceButton.textContent = description;
            sourceButton.title = `Open ${description} at page ${page}`;

            sourceButton.addEventListener("click", () => {
                openPdfPreview(sourceDocument.id, page);
            });

            item.appendChild(sourceButton);
        } else {
            const filenameText = document.createElement("span");
            filenameText.textContent = description;
            item.appendChild(filenameText);
        }

        const details = document.createElement("span");

        let detailText =
            ` | Page ${Number.isInteger(page) ? page : "Unknown"}`;

        if (chunk !== undefined && chunk !== null) {
            detailText += ` | Chunk ${chunk}`;
        }

        if (typeof score === "number") {
            detailText += ` | Similarity: ${score.toFixed(3)}`;
        }

        details.textContent = detailText;
        item.appendChild(details);
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
// CONVERSATION MESSAGE RENDERING
// --------------------------------------------------

function renderConversationMessages(messages) {
    chatArea.innerHTML = "";

    if (!Array.isArray(messages) || messages.length === 0) {
        showWelcomeMessage(
            "New Conversation",
            "Upload PDFs, select documents and ask questions about their content."
        );
        return;
    }

    messages.forEach(message => {
        const role = message.role || "assistant";

        const messageText =
            message.content ??
            message.text ??
            message.message ??
            message.answer ??
            "";

        const messageElement = addMessage(role, messageText);

        if (role !== "user") {
            addSources(messageElement, message.sources);
        }
    });

    chatArea.scrollTop = chatArea.scrollHeight;
}


// --------------------------------------------------
// CHAT HISTORY DISPLAY
// --------------------------------------------------

function renderChatHistory(chats) {
    chatHistoryList.innerHTML = "";

    if (!Array.isArray(chats) || chats.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "library-empty";
        emptyMessage.textContent = "No previous chats.";

        chatHistoryList.appendChild(emptyMessage);
        return;
    }

    chats.forEach(chat => {
        const chatId =
            chat.id ||
            chat.conversation_id ||
            chat.chat_id;

        if (!chatId) {
            return;
        }

        const chatItem = document.createElement("div");
        chatItem.className = "chat-history-item";

        if (chatId === currentConversationId) {
            chatItem.classList.add("active");
        }

        const title = document.createElement("button");
        title.type = "button";
        title.className = "chat-history-title";
        title.textContent = chat.title || "New Conversation";
        title.title = title.textContent;

        title.addEventListener("click", () => {
            openConversation(chatId);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-chat-button";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete conversation";

        deleteButton.addEventListener("click", event => {
            event.stopPropagation();
            deleteConversation(chatId);
        });

        chatItem.appendChild(title);
        chatItem.appendChild(deleteButton);
        chatHistoryList.appendChild(chatItem);
    });
}


// --------------------------------------------------
// LOAD CHAT HISTORY
// --------------------------------------------------

async function loadChatHistory() {
    chatHistoryList.innerHTML = "";

    const loading = document.createElement("p");
    loading.className = "library-loading";
    loading.textContent = "Loading chat history.";

    chatHistoryList.appendChild(loading);

    try {
        const response = await fetch("/chats");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to load chat history."
            );
        }

        const chats = data.chats || data.conversations || [];

        renderChatHistory(chats);

        return chats;
    } catch (error) {
        chatHistoryList.innerHTML = "";

        const errorMessage = document.createElement("p");
        errorMessage.className = "library-error";
        errorMessage.textContent = error.message;

        chatHistoryList.appendChild(errorMessage);

        console.error("Chat history error:", error);

        return [];
    }
}


// --------------------------------------------------
// CREATE NEW CONVERSATION
// --------------------------------------------------

async function createNewConversation() {
    if (sendButton.disabled) {
        return;
    }

    newChatButton.disabled = true;
    newChatButton.textContent = "Creating...";

    try {
        const response = await fetch("/chats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to create a new chat."
            );
        }

        const conversation = data.conversation || data.chat || {};

        currentConversationId =
            data.conversation_id ||
            data.chat_id ||
            conversation.id ||
            conversation.conversation_id ||
            data.id ||
            null;

        if (!currentConversationId) {
            throw new Error(
                "The server did not return a conversation ID."
            );
        }

        showWelcomeMessage(
            "New Conversation",
            "Upload PDFs, select documents and ask questions about their content."
        );

        questionInput.value = "";

        await loadChatHistory();

        questionInput.focus();
    } catch (error) {
        console.error("New conversation error:", error);
        alert(error.message);
    } finally {
        newChatButton.disabled = false;
        newChatButton.textContent = "+ New Chat";
    }
}

if (newChatButton) {
    newChatButton.addEventListener("click", createNewConversation);
}


// --------------------------------------------------
// OPEN EXISTING CONVERSATION
// --------------------------------------------------

async function openConversation(conversationId) {
    if (sendButton.disabled) {
        return;
    }

    try {
        chatArea.innerHTML = "";

        const loading = document.createElement("p");
        loading.className = "library-loading";
        loading.textContent = "Loading conversation...";

        chatArea.appendChild(loading);

        const response = await fetch(
            `/chats/${encodeURIComponent(conversationId)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to open conversation."
            );
        }

        const conversation = data.conversation || data.chat || data;

        currentConversationId =
            conversation.id ||
            conversation.conversation_id ||
            conversationId;

        const messages = conversation.messages || [];

        let lastSelectedDocuments = null;

        for (let i = messages.length - 1; i >= 0; i--) {
            if (
                messages[i].role === "user" &&
                Array.isArray(messages[i].selected_documents)
            ) {
                lastSelectedDocuments =
                    messages[i].selected_documents;

                break;
            }
        }

        if (lastSelectedDocuments !== null) {
            await loadDocuments({
                selectedIds: lastSelectedDocuments
            });
        }

        renderConversationMessages(messages);

        await loadChatHistory();

        questionInput.focus();
    } catch (error) {
        console.error("Open conversation error:", error);

        showWelcomeMessage(
            "Unable to Open Chat",
            error.message
        );
    }
}


// --------------------------------------------------
// DELETE CONVERSATION
// --------------------------------------------------

async function deleteConversation(conversationId) {
    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this conversation?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `/chats/${encodeURIComponent(conversationId)}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to delete conversation."
            );
        }

        if (currentConversationId === conversationId) {
            currentConversationId = null;

            showWelcomeMessage(
                "Welcome to DocuMind AI",
                "Start a new conversation by asking a question about your documents."
            );
        }

        await loadChatHistory();
    } catch (error) {
        console.error("Delete conversation error:", error);
        alert(error.message);
    }
}


// --------------------------------------------------
// DOCUMENT SELECTION STATUS
// --------------------------------------------------

function updateSelectionStatus() {
    const count = selectedDocuments.size;

    if (scopeStatus) {
        scopeStatus.textContent = count === 0
            ? "Searching all documents"
            : `Searching ${count} selected document(s)`;
    }

    if (deleteSelectedButton) {
        deleteSelectedButton.disabled = count === 0;
    }
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

        documentRecords = documents;

        documentCount.textContent = documents.length;

        documentList.innerHTML = "";

        const availableIds = new Set(
            documents.map(doc => doc.id)
        );

        for (const id of selectedDocuments) {
            if (!availableIds.has(id)) {
                selectedDocuments.delete(id);
            }
        }

        if (Array.isArray(preferredSelection)) {
            selectedDocuments.clear();

            preferredSelection.forEach(id => {
                if (availableIds.has(id)) {
                    selectedDocuments.add(id);
                }
            });
        }

        if (documents.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "library-empty";
            emptyMessage.textContent = "No documents uploaded yet.";

            documentList.appendChild(emptyMessage);

            updateSelectionStatus();
            return;
        }

        documents.forEach(doc => {
            const card = document.createElement("label");
            card.className = "library-document";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = doc.id;
            checkbox.checked = selectedDocuments.has(doc.id);

            const details = document.createElement("div");
            details.className = "library-document-details";

            const name = document.createElement("strong");
            name.textContent =
                doc.filename || doc.stored_filename || "Unknown PDF";

            const info = document.createElement("small");
            info.textContent = `${doc.pages ?? 0} pages`;

            details.appendChild(name);
            details.appendChild(info);

            card.appendChild(checkbox);
            card.appendChild(details);

            documentList.appendChild(card);

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedDocuments.add(doc.id);
                } else {
                    selectedDocuments.delete(doc.id);
                }

                updateSelectionStatus();
            });
        });

        updateSelectionStatus();
    } catch (error) {
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

if (selectAllButton) {
    selectAllButton.addEventListener("click", () => {
        const checkboxes = documentList.querySelectorAll(
            'input[type="checkbox"]'
        );

        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedDocuments.add(checkbox.value);
        });

        updateSelectionStatus();
    });
}


// --------------------------------------------------
// DESELECT ALL DOCUMENTS
// --------------------------------------------------

if (clearSelectionButton) {
    clearSelectionButton.addEventListener("click", () => {
        const checkboxes = documentList.querySelectorAll(
            'input[type="checkbox"]'
        );

        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        selectedDocuments.clear();

        updateSelectionStatus();
    });
}


// --------------------------------------------------
// DELETE SELECTED DOCUMENTS
// --------------------------------------------------

if (deleteSelectedButton) {
    deleteSelectedButton.addEventListener("click", async () => {
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
                } catch (error) {
                    errors.push(error.message);
                }
            }

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
        } catch (error) {
            uploadStatus.textContent = error.message;

            console.error("Document deletion error:", error);

            await loadDocuments();
        } finally {
            deleteSelectedButton.textContent = "Delete Selected";
            updateSelectionStatus();
        }
    });
}


// --------------------------------------------------
// SEND QUESTION TO FLASK
// --------------------------------------------------

if (chatForm) {
    chatForm.addEventListener("submit", async event => {
        event.preventDefault();

        const question = questionInput.value.trim();

        if (!question || sendButton.disabled) {
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
                    question,
                    selected_documents: Array.from(selectedDocuments),
                    conversation_id: currentConversationId
                })
            });

            const data = await response.json();

            loadingMessage.remove();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Something went wrong."
                );
            }

            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }

            const result = data.result || {};

            const answer = result.answer || "No answer was generated.";

            const answerMessage = addMessage("assistant", answer);

            addSources(answerMessage, result.sources);

            await loadChatHistory();
        } catch (error) {
            loadingMessage.remove();

            addMessage(
                "assistant",
                "Sorry, I couldn't generate an answer. " + error.message
            );

            console.error("DocuMind error:", error);
        } finally {
            sendButton.disabled = false;
            sendButton.textContent = "Send ↑";
            questionInput.focus();
        }
    });
}


// --------------------------------------------------
// ENTER TO SEND; SHIFT + ENTER FOR NEW LINE
// --------------------------------------------------

if (questionInput) {
    questionInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            chatForm.requestSubmit();
        }
    });
}


// --------------------------------------------------
// OPEN PDF FILE SELECTOR
// --------------------------------------------------

if (uploadButton) {
    uploadButton.addEventListener("click", () => {
        pdfInput.click();
    });
}


// --------------------------------------------------
// UPLOAD PDF
// --------------------------------------------------

if (pdfInput) {
    pdfInput.addEventListener("change", async () => {
        const file = pdfInput.files[0];

        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            uploadStatus.textContent = "Please select a PDF file.";
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

            await loadDocuments({
                selectedIds: [data.id]
            });

            showWelcomeMessage(
                "Your document is ready!",
                `Ask questions about ${data.filename}.`
            );
        } catch (error) {
            uploadStatus.textContent = error.message;

            console.error("PDF upload error:", error);
        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = "+ Upload PDF";
            pdfInput.value = "";
        }
    });
}


// --------------------------------------------------
// INITIALIZE APPLICATION
// --------------------------------------------------

async function initializeApplication() {
    if (deleteSelectedButton) {
        deleteSelectedButton.disabled = true;
    }

    await loadDocuments();

    const chats = await loadChatHistory();

    if (chats.length > 0) {
        const latestChat = chats[0];

        const latestChatId =
            latestChat.id ||
            latestChat.conversation_id ||
            latestChat.chat_id;

        if (latestChatId) {
            await openConversation(latestChatId);
        }
    }

    updatePdfToolbar();
}

initializeApplication();
