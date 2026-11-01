import re
def create_chunks(text, chunk_size=200, overlap=20):

    # Convert text into a list of words
    words = text.split()

    # Store all chunks
    chunks = []

    # Calculate how far to move each time
    step = chunk_size - overlap

    # Start position
    start = 0

    # Continue until all words are processed
    while start < len(words):

        # Calculate ending position
        end = start + chunk_size

        # Extract words for current chunk
        chunk_words = words[start:end]

        # Convert list of words back into text
        chunk_text = " ".join(chunk_words)

        # Store the chunk
        chunks.append(chunk_text)

        # Move to next chunk
        start += step

    return chunks


if __name__ == "__main__":

    with open("extracted_text.txt", "r", encoding="utf-8") as file:
        text = file.read()

    chunks = create_chunks(text)

    print("Total Chunks:", len(chunks))

    for i, chunk in enumerate(chunks, start=1):
        print(f"\nChunk {i}")
        print(chunk[:100])



def create_page_chunks(text, chunk_size=200, overlap=20):

    if chunk_size <= 0:
        raise ValueError("Chunk size must be greater than 0")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("Overlap must be smaller than chunk size")

    # Separate the extracted text by PDF page markers
    pages = re.split(r"--- Page (\d+) ---", text)

    all_chunks = []

    # Each page number is followed by its page text
    for i in range(1, len(pages), 2):

        page_number = int(pages[i])
        page_text = pages[i + 1].strip()

        words = page_text.split()

        step = chunk_size - overlap

        start = 0

        while start < len(words):

            end = start + chunk_size

            chunk_text = " ".join(words[start:end])

            all_chunks.append({
                "page": page_number,
                "text": chunk_text
            })

            start += step

    return all_chunks