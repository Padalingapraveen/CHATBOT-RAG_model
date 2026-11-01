from sentence_transformers import SentenceTransformer
from chunking import create_chunks

# Load the pretrained embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Read the extracted PDF text
with open("extracted_text.txt", "r", encoding="utf-8") as file:
    text = file.read()

# Divide the PDF text into chunks
chunks = create_chunks(text)

# Convert every chunk into an embedding
embeddings = model.encode(chunks)

# Display the results
print("Total Chunks:", len(chunks))
print("Embedding Shape:", embeddings.shape)
print("First Chunk:", chunks[0])
print("First Embedding:", embeddings[0])