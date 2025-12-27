from google.cloud import firestore
import os

PROJECT_ID = "project-fluency-ai-pro-d3189"

def list_rooms():
    print(f"Connecting to Firestore Project: {PROJECT_ID}...")
    try:
        db = firestore.Client(project=PROJECT_ID)
        print("Connected. Querying 'queue' collection...")
        
        docs = db.collection('queue').stream()
        
        count = 0
        for doc in docs:
            count += 1
            data = doc.to_dict()
            print(f"Doc ID: {doc.id} | roomCode: '{data.get('roomCode')}' | status: {data.get('status')} | createdBy: {data.get('userName')}")
            
        if count == 0:
            print("Collection 'queue' is EMPTY.")
        else:
            print(f"Total documents found: {count}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    list_rooms()
