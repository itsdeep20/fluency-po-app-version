import subprocess
import json
import urllib.request

PROJECT_ID = "project-fluency-ai-pro-d3189"
URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/queue"

def get_access_token():
    try:
        # Run gcloud command to get token
        result = subprocess.run(
            ["gcloud.cmd", "auth", "print-access-token"], 
            capture_output=True, text=True, check=True, shell=True
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"Error getting token: {e}")
        return None

def list_rooms():
    token = get_access_token()
    if not token:
        print("Failed to get auth token.")
        return

    req = urllib.request.Request(URL)
    req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
        documents = data.get('documents', [])
        
        if not documents:
            print("Collection 'queue' is EMPTY (No documents found via REST API).")
            return

        print(f"Found {len(documents)} documents:")
        for doc in documents:
            fields = doc.get('fields', {})
            # Extract values (Firestore JSON format matches { 'stringValue': '...' })
            room_code = fields.get('roomCode', {}).get('stringValue', 'N/A')
            status = fields.get('status', {}).get('stringValue', 'N/A')
            print(f"- Doc: {doc['name'].split('/')[-1]}")
            print(f"  RoomCode: '{room_code}'")
            print(f"  Status: '{status}'")
            print("-" * 20)

    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_rooms()
