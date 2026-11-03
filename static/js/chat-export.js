
// --------------------------------------------------
// DOCUMIND AI - CHAT EXPORT
// Export current conversation as TXT or PDF
// --------------------------------------------------

const exportTxtButton = document.getElementById("exportTxtButton");
const exportPdfButton = document.getElementById("exportPdfButton");
const exportChatArea = document.getElementById("chatArea");

// --------------------------------------------------
// GET CURRENT CONVERSATION
// --------------------------------------------------

function getConversationText() {
    if (!exportChatArea) {
        throw new Error("Chat area not found.");
    }

    const messages = exportChatArea.querySelectorAll(".message");

    if (messages.length === 0) {
        throw new Error("There are no messages to export.");
    }

    const conversation = [];

    conversation.push("DOCUMIND AI");
    conversation.push("Document Assistant Conversation");
    conversation.push("Exported: " + new Date().toLocaleString());
    conversation.push("=".repeat(65));
    conversation.push("");

    messages.forEach((message, index) => {
        const label = message.querySelector(".message-label");
        const content = message.querySelector(".message-content");
        const sources = message.querySelector(".sources");

        const role = label
            ? label.textContent.trim()
            : "Message";

        const messageText = content
            ? content.innerText.trim()
            : "";

        if (!messageText) {
            return;
        }

        conversation.push(role.toUpperCase());
        conversation.push("-".repeat(40));
        conversation.push(messageText);

        if (sources) {
            conversation.push("");
            conversation.push("SOURCES:");

            const sourceItems = sources.querySelectorAll("li");

            sourceItems.forEach(source => {
                conversation.push(
                    "• " + source.innerText.trim()
                );
            });
        }

        conversation.push("");
        conversation.push("=".repeat(65));
        conversation.push("");
    });

    return conversation.join("\n");
}

// --------------------------------------------------
// GENERATE FILE NAME
// --------------------------------------------------

function getExportFileName(extension) {
    const date = new Date();

    const timestamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
        "_",
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0")
    ].join("");

    return `DocuMind_Conversation_${timestamp}.${extension}`;
}

// --------------------------------------------------
// EXPORT AS TXT
// --------------------------------------------------

function exportConversationAsTxt() {
    try {
        const text = getConversationText();

        const blob = new Blob(
            [text],
            { type: "text/plain;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = getExportFileName("txt");

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("TXT export error:", error);
        alert(error.message);
    }
}

// --------------------------------------------------
// PDF TEXT WRAPPING
// --------------------------------------------------

function addPdfText(doc, text, state) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const leftMargin = 18;
    const rightMargin = 18;
    const bottomMargin = 20;

    const usableWidth = pageWidth - leftMargin - rightMargin;

    const lines = doc.splitTextToSize(
        String(text),
        usableWidth
    );

    lines.forEach(line => {
        if (state.y > pageHeight - bottomMargin) {
            doc.addPage();
            state.y = 20;
        }

        doc.text(line, leftMargin, state.y);
        state.y += state.lineHeight;
    });
}

// --------------------------------------------------
// ADD PDF PAGE NUMBERS
// --------------------------------------------------

function addPdfPageNumbers(doc) {
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);

        doc.text(
            `DocuMind AI | Page ${page} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: "center" }
        );
    }
}

// --------------------------------------------------
// EXPORT AS PDF
// --------------------------------------------------

function exportConversationAsPdf() {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error(
                "PDF export library is unavailable. Check your internet connection."
            );
        }

        const text = getConversationText();

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const state = {
            y: 20,
            lineHeight: 6
        };

        // Document title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.setTextColor(35, 75, 130);

        pdf.text("DocuMind AI", 18, state.y);

        state.y += 9;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(80, 80, 80);

        pdf.text(
            "Document Assistant Conversation",
            18,
            state.y
        );

        state.y += 7;

        pdf.setFontSize(9);

        pdf.text(
            "Exported: " + new Date().toLocaleString(),
            18,
            state.y
        );

        state.y += 9;

        pdf.setDrawColor(180, 190, 205);
        pdf.line(18, state.y, 192, state.y);

        state.y += 10;

        // Conversation content
        const lines = text.split("\n");

        lines.forEach(line => {
            const trimmedLine = line.trim();

            if (trimmedLine === "DOCUMIND AI") {
                return;
            }

            if (trimmedLine === "Document Assistant Conversation") {
                return;
            }

            if (trimmedLine.startsWith("Exported:")) {
                return;
            }

            if (trimmedLine.startsWith("=====")) {
                state.y += 2;
                return;
            }

            if (trimmedLine.startsWith("-----")) {
                state.y += 1;
                return;
            }

            if (
                trimmedLine === "YOU" ||
                trimmedLine === "DOCUMIND AI" ||
                trimmedLine === "SOURCES:"
            ) {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(11);
                pdf.setTextColor(35, 75, 130);

                addPdfText(pdf, trimmedLine, state);

                state.y += 1;
                return;
            }

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.setTextColor(45, 45, 45);

            if (trimmedLine.startsWith("•")) {
                addPdfText(pdf, trimmedLine, state);
            } else if (trimmedLine) {
                addPdfText(pdf, trimmedLine, state);
            } else {
                state.y += 3;
            }
        });

        // Add page numbers
        addPdfPageNumbers(pdf);

        // Download
        pdf.save(getExportFileName("pdf"));

    } catch (error) {
        console.error("PDF export error:", error);
        alert(error.message);
    }
}

// --------------------------------------------------
// EXPORT BUTTON EVENTS
// --------------------------------------------------

if (exportTxtButton) {
    exportTxtButton.addEventListener(
        "click",
        exportConversationAsTxt
    );
}

if (exportPdfButton) {
    exportPdfButton.addEventListener(
        "click",
        exportConversationAsPdf
    );
}

// --------------------------------------------------
// EXPORT BUTTON STATE
// --------------------------------------------------

function updateExportButtonState() {
    const hasMessages = exportChatArea &&
        exportChatArea.querySelector(".message") !== null;

    if (exportTxtButton) {
        exportTxtButton.disabled = !hasMessages;
    }

    if (exportPdfButton) {
        exportPdfButton.disabled = !hasMessages;
    }
}

// Observe chat changes, including newly added messages.
if (exportChatArea) {
    const exportObserver = new MutationObserver(() => {
        updateExportButtonState();
    });

    exportObserver.observe(exportChatArea, {
        childList: true,
        subtree: true
    });
}

updateExportButtonState();
