from sentence_transformers import SentenceTransformer, util

# Load a pretrained embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Three sample sentences
sentences = [
    "I love Python programming.",
    "Python is my favourite programming language.",
    "I enjoy cooking delicious food."
]

# Convert sentences into numerical vectors
embeddings = model.encode(sentences)

# Compare the first and second sentences
similarity = util.cos_sim(
    embeddings[0],
    embeddings[1]
)

print("Similarity:", similarity.item())