
from pypdf import PdfReader

# Function to read a PDF file
def extract_pdf_text(pdf_path):

    # Open the PDF
    reader = PdfReader(pdf_path)

    # Store extracted text
    full_text = ""

    # Count pages
    total_pages = len(reader.pages)

    print("Total Pages:", total_pages)

    # Read each page
    for page_number, page in enumerate(reader.pages, start=1):

        # Extract text from current page
        page_text = page.extract_text() or ""

        # Add page information and text
        full_text += f"\n--- Page {page_number} ---\n"
        full_text += page_text

    return full_text


# Execute the function
if __name__ == "__main__":

    pdf_path = "data/sample.pdf"

    text = extract_pdf_text(pdf_path)

    # Display extracted information
    print("\nExtracted Text:")
    print(text)

    # Count words
    word_count = len(text.split())

    print("\nTotal Words:", word_count)

    # Save extracted text
    with open("extracted_text.txt", "w", encoding="utf-8") as file:
        file.write(text)

    print("\nText saved successfully!")
