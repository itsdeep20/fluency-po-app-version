"""
Test script to verify Gemini 3 Flash Preview works with Vertex AI
Testing with global region as shown in Vertex AI Studio
"""
import vertexai
from vertexai.generative_models import GenerativeModel
import sys

PROJECT_ID = "project-fluency-ai-pro-d3189"
# Try global as shown in Vertex AI Studio
LOCATIONS = ["us-central1", "global", "us-west1"]
MODEL_ID = "gemini-3-flash-preview"

for LOCATION in LOCATIONS:
    print(f"\nTrying with location: {LOCATION}")
    print("-" * 40)
    
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        model = GenerativeModel(MODEL_ID)
        
        response = model.generate_content("Say hello in one word.")
        print("SUCCESS!")
        print(f"Response: {response.text}")
        print(f"Working location: {LOCATION}")
        sys.exit(0)
    except Exception as e:
        print(f"FAILED with {LOCATION}: {type(e).__name__}")
        
print("All locations failed!")
sys.exit(1)
