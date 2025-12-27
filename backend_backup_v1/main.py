import functions_framework
import json
import vertexai
import time
import random
from google.cloud import firestore
from vertexai.generative_models import GenerativeModel, Content, Part

# Use stable Gemini 1.5 Flash model (verified working)
MODEL_ID = "gemini-1.5-flash-001"
PROJECT_ID = "project-fluency-ai-pro-d3189"

# Role pairs for random matchmaking
ROLE_PAIRS = [
    {
        "id": "medical",
        "roles": ["Doctor", "Patient"],
        "icons": ["🩺", "🤒"],
        "topic": "Medical Consultation",
        "descriptions": [
            "You are a busy but caring doctor at a city clinic. Ask about symptoms, suggest tests, and provide advice.",
            "You are a patient visiting the doctor for a health concern. Describe your symptoms clearly."
        ]
    },
    {
        "id": "legal",
        "roles": ["Lawyer", "Client"],
        "icons": ["⚖️", "👤"],
        "topic": "Legal Consultation",
        "descriptions": [
            "You are an experienced lawyer. Listen to the case, ask relevant questions, and provide legal guidance.",
            "You are a client seeking legal advice. Explain your situation and ask questions about your options."
        ]
    },
    {
        "id": "education",
        "roles": ["Teacher", "Student"],
        "icons": ["📚", "🎓"],
        "topic": "Academic Discussion",
        "descriptions": [
            "You are a helpful teacher. Explain concepts clearly, encourage questions, and guide learning.",
            "You are an eager student. Ask questions, share your understanding, and engage with the topic."
        ]
    },
    {
        "id": "interview",
        "roles": ["Interviewer", "Candidate"],
        "icons": ["💼", "🎯"],
        "topic": "Job Interview",
        "descriptions": [
            "You are a professional HR interviewer. Ask about experience, skills, and assess the candidate.",
            "You are a job candidate. Present your qualifications confidently and answer questions clearly."
        ]
    },
    {
        "id": "travel",
        "roles": ["Guide", "Tourist"],
        "icons": ["🗺️", "🧳"],
        "topic": "Travel Planning",
        "descriptions": [
            "You are a knowledgeable local guide. Share information about places, food, and culture.",
            "You are a curious tourist. Ask about destinations, local customs, and travel tips."
        ]
    },
    {
        "id": "friends",
        "roles": ["Friend A", "Friend B"],
        "icons": ["👋", "🤝"],
        "topic": "Casual Conversation",
        "descriptions": [
            "You are catching up with an old friend. Share news, ask about their life, be warm and engaging.",
            "You are meeting your friend after a long time. Share updates, laugh, and reconnect."
        ]
    }
]

def get_model():
    """Initialize and return Gemini model with fallback locations."""
    try:
        vertexai.init(project=PROJECT_ID, location="us-central1")
        model = GenerativeModel(MODEL_ID)
        return model
    except Exception as e:
        print(f"[MODEL_INIT] Error with us-central1: {str(e)}")
        try:
            vertexai.init(project=PROJECT_ID, location="global")
            model = GenerativeModel(MODEL_ID)
            return model
        except Exception as e2:
            print(f"[MODEL_INIT] Error with global: {str(e2)}")
            raise e2

def call_gemini_with_retry(model, chat_session, message, max_retries=3):
    for i in range(max_retries):
        try:
            return chat_session.send_message(str(message))
        except Exception as e:
            error_str = str(e)
            print(f"[GEMINI_RETRY] Attempt {i+1} failed: {error_str[:100]}")
            if "429" in error_str or "Resource exhausted" in error_str:
                wait_time = (2 ** i) + random.random()
                time.sleep(wait_time)
            elif "billing" in error_str.lower() or "quota" in error_str.lower():
                raise Exception(f"Billing/Quota Error: {error_str[:200]}")
            else:
                raise e
    return chat_session.send_message(str(message))

@functions_framework.http
def fluency_backend(request):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    if request.method == 'OPTIONS': 
        return ('', 204, headers)
    
    try:
        data = request.get_json(silent=True)
        if not data: 
            return (json.dumps({"reply": "No data received"}), 200, headers)

        req_type = data.get('type', 'chat')
        print(f"[REQUEST] Type: {req_type}")

        # Initialize model for AI requests
        model = None
        if req_type in ['chat', 'analyze']:
            try:
                model = get_model()
            except Exception as e:
                error_msg = str(e)
                print(f"[MODEL_ERROR] {error_msg}")
                return (json.dumps({
                    "reply": f"AI initialization error: {error_msg[:100]}",
                    "error": error_msg
                }), 200, headers)

        db = firestore.Client(project=PROJECT_ID)

        # ==================== ROOM MANAGEMENT ====================
        if req_type == "create_room":
            try:
                user_id = data.get('userId')
                user_name = data.get('userName')
                user_avatar = data.get('userAvatar')
                
                room_code = str(random.randint(100000, 999999))
                print(f"[CREATE_ROOM] Code: {room_code}, User: {user_name}")

                doc_ref = db.collection('queue').add({
                    'roomCode': room_code,
                    'hostId': user_id,
                    'createdBy': user_id,
                    'userName': user_name,
                    'userAvatar': user_avatar,
                    'status': 'waiting',
                    'mode': 'friend',  # friend or random
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'startedAt': None,
                    'timerDuration': 420  # 7 minutes in seconds
                })
                
                return (json.dumps({
                    "success": True, 
                    "roomId": doc_ref[1].id, 
                    "roomCode": room_code
                }), 200, headers)

            except Exception as e:
                print(f"[CREATE_ROOM] Error: {str(e)}")
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        if req_type == "join_room":
            try:
                room_code = data.get('roomCode')
                user_id = data.get('userId')
                user_name = data.get('userName')
                user_avatar = data.get('userAvatar')
                
                print(f"[JOIN_ROOM] Code: {room_code}, User: {user_name}")

                docs = db.collection('queue').where('roomCode', '==', room_code).stream()
                found_doc = None
                for d in docs:
                    found_doc = d
                    break
                
                if not found_doc:
                    return (json.dumps({"success": False, "error": "Room not found. Check the code."}), 200, headers)
                
                room_data = found_doc.to_dict()
                
                if room_data.get('status') == 'matched':
                    return (json.dumps({"success": False, "error": "Room is already full!"}), 200, headers)
                
                if room_data.get('status') != 'waiting':
                    return (json.dumps({"success": False, "error": f"Room unavailable (Status: {room_data.get('status')})"}), 200, headers)

                doc_ref = db.collection('queue').document(found_doc.id)
                doc_ref.update({
                    'status': 'matched',
                    'player2Id': user_id,
                    'player2Name': user_name,
                    'player2Avatar': user_avatar,
                    'startedAt': firestore.SERVER_TIMESTAMP
                })
                
                return (json.dumps({
                    "success": True, 
                    "roomId": found_doc.id,
                    "opponent": {
                        "id": room_data.get('hostId'),
                        "name": room_data.get('userName'),
                        "avatar": room_data.get('userAvatar')
                    }
                }), 200, headers)

            except Exception as e:
                print(f"[JOIN_ROOM] Error: {str(e)}")
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        # ==================== RANDOM MATCHMAKING ====================
        if req_type == "find_random_match":
            try:
                user_id = data.get('userId')
                user_name = data.get('userName')
                user_avatar = data.get('userAvatar')
                
                print(f"[RANDOM_MATCH] User: {user_name}")

                # Check for existing waiting random rooms
                waiting_docs = db.collection('queue').where('status', '==', 'waiting').where('mode', '==', 'random').limit(1).stream()
                found_doc = None
                for d in waiting_docs:
                    if d.to_dict().get('hostId') != user_id:  # Don't match with self
                        found_doc = d
                        break
                
                if found_doc:
                    # Match found! Assign roles
                    room_data = found_doc.to_dict()
                    role_pair = random.choice(ROLE_PAIRS)
                    role_index = random.randint(0, 1)  # Randomly assign roles
                    
                    doc_ref = db.collection('queue').document(found_doc.id)
                    doc_ref.update({
                        'status': 'matched',
                        'player2Id': user_id,
                        'player2Name': user_name,
                        'player2Avatar': user_avatar,
                        'startedAt': firestore.SERVER_TIMESTAMP,
                        'roleData': {
                            'pairId': role_pair['id'],
                            'topic': role_pair['topic'],
                            'player1Role': role_pair['roles'][role_index],
                            'player1Icon': role_pair['icons'][role_index],
                            'player1Desc': role_pair['descriptions'][role_index],
                            'player2Role': role_pair['roles'][1 - role_index],
                            'player2Icon': role_pair['icons'][1 - role_index],
                            'player2Desc': role_pair['descriptions'][1 - role_index]
                        }
                    })
                    
                    return (json.dumps({
                        "success": True,
                        "matched": True,
                        "roomId": found_doc.id,
                        "opponent": {
                            "id": room_data.get('hostId'),
                            "name": room_data.get('userName'),
                            "avatar": room_data.get('userAvatar')
                        },
                        "myRole": role_pair['roles'][1 - role_index],
                        "myIcon": role_pair['icons'][1 - role_index],
                        "myDesc": role_pair['descriptions'][1 - role_index],
                        "topic": role_pair['topic']
                    }), 200, headers)
                else:
                    # No match found, create waiting room
                    room_code = "RND" + str(random.randint(10000, 99999))
                    doc_ref = db.collection('queue').add({
                        'roomCode': room_code,
                        'hostId': user_id,
                        'createdBy': user_id,
                        'userName': user_name,
                        'userAvatar': user_avatar,
                        'status': 'waiting',
                        'mode': 'random',
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'startedAt': None,
                        'timerDuration': 420
                    })
                    
                    return (json.dumps({
                        "success": True,
                        "matched": False,
                        "roomId": doc_ref[1].id,
                        "message": "Searching for opponent..."
                    }), 200, headers)

            except Exception as e:
                print(f"[RANDOM_MATCH] Error: {str(e)}")
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        if req_type == "cancel_random_search":
            try:
                room_id = data.get('roomId')
                db.collection('queue').document(room_id).delete()
                return (json.dumps({"success": True}), 200, headers)
            except Exception as e:
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        # ==================== MESSAGING ====================
        if req_type == "send_message":
            try:
                room_id = data.get('roomId')
                text = data.get('text')
                sender_id = data.get('senderId')
                
                db.collection('queue').document(room_id).collection('messages').add({
                    'text': text,
                    'senderId': sender_id,
                    'createdAt': firestore.SERVER_TIMESTAMP
                })
                
                return (json.dumps({"success": True}), 200, headers)

            except Exception as e:
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        if req_type == "end_session":
            try:
                room_id = data.get('roomId')
                ended_by = data.get('endedBy')
                
                db.collection('queue').document(room_id).update({
                    'status': 'ended',
                    'endedBy': ended_by,
                    'endedAt': firestore.SERVER_TIMESTAMP
                })
                
                return (json.dumps({"success": True}), 200, headers)

            except Exception as e:
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        # ==================== AI ANALYSIS ====================
        if req_type == "analyze":
            player1_history = data.get('player1History')
            player2_history = data.get('player2History')
            
            if player1_history and player2_history:
                # DUAL-PLAYER COMPETITIVE ANALYSIS
                p1_text = "\n".join(player1_history) if player1_history else "No messages"
                p2_text = "\n".join(player2_history) if player2_history else "No messages"
                
                prompt = (
                    "You are analyzing a competitive English conversation between two learners.\n"
                    f"Player 1 Messages:\n{p1_text}\n\n"
                    f"Player 2 Messages:\n{p2_text}\n\n"
                    "Grade BOTH players independently on these 4 metrics (0-100 each):\n"
                    "1. VOCABULARY: Word variety, advanced terms, appropriate usage\n"
                    "2. GRAMMAR: Tense accuracy, article usage, subject-verb agreement\n"
                    "3. FLUENCY: Natural flow, coherence, conversation quality\n"
                    "4. SENTENCE_MAKING: Sentence complexity, structure variety, clause usage\n\n"
                    "IMPORTANT: If a player has few or no messages, give them lower scores (40-60 range).\n"
                    "If both have good messages, score fairly based on quality.\n\n"
                    "Return ONLY valid JSON in this exact format:\n"
                    "{\n"
                    '  "player1": {"vocabulary": 75, "grammar": 72, "fluency": 78, "sentence_making": 70, "overall": 74, "feedback": "Good effort..."},\n'
                    '  "player2": {"vocabulary": 68, "grammar": 80, "fluency": 72, "sentence_making": 75, "overall": 74, "feedback": "Nice try..."}\n'
                    "}\n"
                    "Calculate 'overall' as the average of the 4 metrics (rounded). Keep feedback under 40 words and encouraging."
                )
                
                try:
                    response = model.generate_content(prompt)
                    resp_text = response.text
                    if "```json" in resp_text:
                        resp_text = resp_text.split("```json")[1].split("```")[0].strip()
                    elif "{" in resp_text:
                        resp_text = resp_text[resp_text.find("{"):resp_text.rfind("}")+1]
                    
                    # Validate JSON
                    parsed = json.loads(resp_text)
                    return (json.dumps(parsed), 200, headers)
                except Exception as e:
                    print(f"[ANALYZE] Error: {str(e)}")
                    # Return fallback scores
                    fallback = {
                        "player1": {"vocabulary": 65, "grammar": 68, "fluency": 70, "sentence_making": 65, "overall": 67, "feedback": "Good conversation! Keep practicing to improve."},
                        "player2": {"vocabulary": 62, "grammar": 70, "fluency": 68, "sentence_making": 63, "overall": 66, "feedback": "Nice effort! Practice more for better fluency."}
                    }
                    return (json.dumps(fallback), 200, headers)
            else:
                # SINGLE-PLAYER ANALYSIS
                history = data.get('history', [])
                history_text = "\n".join(str(h) for h in history)
                prompt = (
                    "Analyze this conversation for fluency, grammar, and vocabulary.\n"
                    f"Conversation:\n{history_text}\n\n"
                    "Focus on the USER's messages only. Identify mistakes and provide constructive feedback.\n"
                    "Return JSON with 'score' (0-100), 'feedback' (encouraging string), "
                    "and 'corrections' (list of {'original': '', 'corrected': ''} objects)."
                )
                try:
                    response = model.generate_content(prompt)
                    resp_text = response.text
                    if "```json" in resp_text:
                        resp_text = resp_text.split("```json")[1].split("```")[0].strip()
                    elif "{" in resp_text:
                        resp_text = resp_text[resp_text.find("{"):resp_text.rfind("}")+1]
                    return (resp_text, 200, headers)
                except Exception as e:
                    return (json.dumps({"score": 75, "feedback": "Good conversation! Keep practicing.", "corrections": []}), 200, headers)

        # ==================== SIMULATION CHAT ====================
        persona_id = data.get('personaId')
        user_msg = data.get('message')
        raw_history = data.get('history', [])
        current_stage = data.get('stage', 'Main Area')
        sim_id = data.get('simId', '')

        # ENHANCED SIMULATION PROMPTS - Never break character, always engage
        simulation_prompts = {
            'sim_train': f"""You are Priya, a busy but helpful Railway Station Superintendent at an Indian railway station.
CURRENT LOCATION: {current_stage}

YOUR PERSONALITY:
- Professional but warm
- Speaks in short, clear sentences (10-20 words max)
- Uses simple English that learners can understand
- Asks follow-up questions to keep conversation going
- Shows mild impatience if user is unclear, but always helps

RULES YOU MUST FOLLOW:
1. NEVER break character - you ARE Priya, not an AI
2. NEVER describe scenery or atmosphere
3. NEVER use bullet points or formatting
4. ALWAYS ask a follow-up question or give a clear instruction
5. If user goes off-topic, gently redirect to train/station topics
6. Use Indian context (Delhi, Mumbai, Jaipur trains, etc.)

EXAMPLE RESPONSES:
- "Platform 4. Your train leaves in 15 minutes. Got your ticket?"
- "Which class? Sleeper is cheaper. AC costs more. What's your budget?"
- "The Rajdhani? That's sold out today. Tomorrow morning works?"

Now respond to the user naturally as Priya:""",

            'sim_airport': f"""You are Ravi, a strict but professional Airport Security Officer at an Indian airport.
CURRENT LOCATION: {current_stage}

YOUR PERSONALITY:
- Very professional and security-focused
- Speaks in short, direct sentences (10-15 words)
- Firm but polite
- Asks for documents and verification
- Explains procedures clearly

RULES YOU MUST FOLLOW:
1. NEVER break character - you ARE Ravi, not an AI
2. NEVER describe scenery or atmosphere
3. NEVER use bullet points or formatting
4. ALWAYS maintain security protocol in your responses
5. If user is confused, explain the process step by step
6. Use Indian airport context (Delhi T3, Mumbai T2, etc.)

EXAMPLE RESPONSES:
- "Passport please. Put your bag on the scanner belt."
- "Any liquids over 100ml? They need to go in the tray."
- "Gate B7. Boarding starts in 20 minutes. Keep your pass ready."

Now respond naturally as Ravi:""",

            'sim_interview': f"""You are Arjun, a senior HR Manager at a top Indian IT company conducting interviews.
CURRENT LOCATION: {current_stage}

YOUR PERSONALITY:
- Professional and evaluative
- Speaks clearly and directly (15-25 words)
- Asks probing questions about skills and experience
- Notes good answers but also challenges weak ones
- Encouraging but professional

RULES YOU MUST FOLLOW:
1. NEVER break character - you ARE Arjun, not an AI
2. NEVER describe the room or atmosphere
3. NEVER use bullet points or formatting
4. ALWAYS ask follow-up questions based on answers
5. Keep the interview flowing naturally
6. Indian corporate context (TCS, Infosys, startups, etc.)

EXAMPLE RESPONSES:
- "Interesting. Tell me about a project where you faced a real challenge."
- "Good skills. But why are you leaving your current company after just one year?"
- "We offer competitive salary. What are your expectations?"

Now respond naturally as Arjun:""",

            'sim_doctor': f"""You are Dr. Sharma, a caring family physician at a city clinic in India.
CURRENT LOCATION: {current_stage}

YOUR PERSONALITY:
- Warm and caring but professional
- Speaks clearly (15-20 words)
- Asks about symptoms in detail
- Explains medical advice simply
- Reassuring but honest

RULES YOU MUST FOLLOW:
1. NEVER break character - you ARE Dr. Sharma, not an AI
2. NEVER describe the clinic or atmosphere
3. NEVER use bullet points or formatting
4. ALWAYS ask about symptoms or give medical guidance
5. Use Indian medical context (Apollo, Fortis, government clinic, etc.)
6. Recommend simple remedies and when to return

EXAMPLE RESPONSES:
- "Fever for three days? Any cough or body pain with it?"
- "Sounds like viral. Take rest and drink fluids. Come back if it gets worse."
- "I'll write a prescription. Take this medicine twice daily after food."

Now respond naturally as Dr. Sharma:""",

            'sim_cafe': f"""You are Maya, a friendly barista at a trendy coffee shop in an Indian city.
CURRENT LOCATION: {current_stage}

YOUR PERSONALITY:
- Warm and chatty
- Uses casual, friendly language (10-20 words)
- Makes small talk
- Suggests popular items
- Remembers regular customers

RULES YOU MUST FOLLOW:
1. NEVER break character - you ARE Maya, not an AI
2. NEVER describe the cafe atmosphere
3. NEVER use bullet points or formatting
4. ALWAYS engage in friendly conversation
5. Suggest food and drinks naturally
6. Indian cafe context (filter coffee, chai, samosa, etc.)

EXAMPLE RESPONSES:
- "Hi! The filter coffee is fresh. Want to try our new hazelnut latte?"
- "That's 180 rupees. Cash or UPI?"
- "Nice choice! The paneer sandwich goes great with that. Want one?"

Now respond naturally as Maya:"""
        }

        # Get the right prompt or use default
        sys_prompt = simulation_prompts.get(sim_id, simulation_prompts.get(persona_id, f"""You are a helpful conversation partner for English practice.
Keep responses short (15-25 words), natural, and engaging.
Ask follow-up questions to keep the conversation going.
Never break character or mention being an AI.
Current context: {current_stage}"""))

        try:
            model = GenerativeModel(MODEL_ID, system_instruction=[sys_prompt])
            
            formatted_history = []
            for h in raw_history:
                if isinstance(h, dict) and h.get('sender') in ['me', 'opponent']:
                    role = "user" if h['sender'] == 'me' else "model"
                    if not formatted_history or formatted_history[-1].role != role:
                        formatted_history.append(Content(role=role, parts=[Part.from_text(str(h.get('text', '')))]))
            
            chat_session = model.start_chat(history=formatted_history[-10:])
            response = call_gemini_with_retry(model, chat_session, user_msg)
            
            reply = response.text.replace('*', '').strip()
            # Enforce length limit
            if len(reply.split()) > 30:
                reply = " ".join(reply.split()[:25]) + "..."
                
            return (json.dumps({"reply": reply}), 200, headers)
            
        except Exception as e:
            error_msg = str(e)
            print(f"[CHAT_ERROR] {error_msg}")
            return (json.dumps({"reply": f"Connection issue. Please try again.", "error": error_msg[:100]}), 200, headers)

    except Exception as e:
        print(f"[GLOBAL_ERROR] {str(e)}")
        return (json.dumps({"reply": f"Server error: {str(e)[:50]}"}), 200, headers)
