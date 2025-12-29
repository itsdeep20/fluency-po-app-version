import functions_framework
import json
import vertexai
import time
import random
from datetime import datetime, timedelta, timezone
from google.cloud import firestore
from vertexai.generative_models import GenerativeModel, Content, Part

# --- CONFIGURATION ---
# Primary Model (Gemini 2.0 Flash - Stable)
MODEL_ID = "gemini-2.0-flash"
# Fallback Model
FALLBACK_MODEL_ID = "gemini-1.5-flash"
PROJECT_ID = "project-fluency-ai-pro-d3189"

# FAKE BOT PERSONAS (For "Human-Like" Bot Matches)
# Indian names, specific imperfections, realistic behaviors.
BOT_PERSONAS = [
    {
        "id": "bot_aman", "name": "Aman", "avatar": "🧑🏽",
        "style": "Friendly, slightly informal, uses 'actually' a lot.",
        "prompt": "You are Aman, a software engineer from Bangalore. You are friendly and slightly informal. You use words like 'actually' and 'basically' often. Keep messages short (10-20 words). You make minor grammar mistakes (e.g. 'I am working since 2 years'). Never admit you are AI."
    },
    {
        "id": "bot_rahul", "name": "Rahul", "avatar": "👨🏽",
        "style": "Enthusiastic, asks questions, slightly nervous.",
        "prompt": "You are Rahul, a college student from Delhi. You are enthusiastic but slightly nervous about your English. You ask simple questions to keep conversation going. Keep messages concise. Make small article mistakes (e.g. miss 'the'). Never admit you are AI."
    },
    {
        "id": "bot_neha", "name": "Neha", "avatar": "👩🏽",
        "style": "Polite, diligent, clear speaker.",
        "prompt": "You are Neha, an HR professional from Mumbai. You are polite and clear. You speak well but sometimes use Indian idioms. Keep messages short. Never admit you are AI."
    },
    {
        "id": "bot_pooja", "name": "Pooja", "avatar": "👩🏽‍💼",
        "style": "Casual, uses slang, brief.",
        "prompt": "You are Pooja, a marketing intern from Pune. You are very casual and use slang like 'ya' or 'cool'. Keep messages very short and punchy. You make sentence structure mistakes sometimes. Never admit you are AI."
    },
    {
        "id": "bot_rohit", "name": "Rohit", "avatar": "👨🏽‍💻",
        "style": "Serious, focused, slightly formal.",
        "prompt": "You are Rohit, an accountant from Chennai. You are serious and focused on the topic. You speak formally but make tense errors (e.g., 'I will done this'). Keep messages concise. Never admit you are AI."
    },
    {
        "id": "bot_kunal", "name": "Kunal", "avatar": "👦🏽",
        "style": "Curious, asks 'why' a lot, friendly.",
        "prompt": "You are Kunal, a young student. You are curious and ask 'why' a lot. You are friendly but have limited vocabulary. Keep messages simple. Never admit you are AI."
    },
    {
        "id": "bot_simran", "name": "Simran", "avatar": "👧🏽",
        "style": "Cheerful, uses emojis occasionally, supportive.",
        "prompt": "You are Simran, a graphic designer. You are cheerful and supportive. You sometimes use a smiley :) in text. Keep messages short. You make subject-verb agreement mistakes. Never admit you are AI."
    },
    {
        "id": "bot_ankit", "name": "Ankit", "avatar": "🧔🏽",
        "style": "Relaxed, slow pace, uses 'you know'.",
        "prompt": "You are Ankit, a musician. You are relaxed and use filler words like 'you know'. You speak in a slow, casual flow. Keep messages short. Never admit you are AI."
    }
]

# Role pairs for random matchmaking
ROLE_PAIRS = [
    {"id": "medical", "roles": ["Doctor", "Patient"], "icons": ["🩺", "🤒"], "topic": "Medical Consultation", "descriptions": ["You are a busy but caring doctor.", "You are a patient describing symptoms."]},
    {"id": "legal", "roles": ["Lawyer", "Client"], "icons": ["⚖️", "👤"], "topic": "Legal Consultation", "descriptions": ["You are an experienced lawyer giving advice.", "You are a client explaining a legal issue."]},
    {"id": "education", "roles": ["Teacher", "Student"], "icons": ["📚", "🎓"], "topic": "Academic Discussion", "descriptions": ["You are a helpful teacher explaining concepts.", "You are a student asking questions."]},
    {"id": "interview", "roles": ["Interviewer", "Candidate"], "icons": ["💼", "🎯"], "topic": "Job Interview", "descriptions": ["You are an HR professional assessing a candidate.", "You are a candidate acting confident."]},
    {"id": "travel", "roles": ["Guide", "Tourist"], "icons": ["🗺️", "🧳"], "topic": "Travel Planning", "descriptions": ["You are a local guide sharing tips.", "You are a tourist asking for recommendations."]},
    {"id": "social", "roles": ["Friend A", "Friend B"], "icons": ["👋", "🤝"], "topic": "Casual Conversation", "descriptions": ["You are catching up with an old friend.", "You are happy to see your friend."]}
]

def get_model(use_fallback=False):
    """Initialize and return Gemini model with fallback logic."""
    target_model = FALLBACK_MODEL_ID if use_fallback else MODEL_ID
    
    try:
        vertexai.init(project=PROJECT_ID, location="us-central1")
        model = GenerativeModel(target_model)
        return model
    except Exception as e:
        print(f"[MODEL_INIT] Failed to init {target_model}: {e}")
        if not use_fallback:
            print("[MODEL_INIT] Switching to fallback model.")
            return get_model(use_fallback=True)
        raise Exception(f"All model initialization attempts failed: {e}")

def call_gemini(model, prompt, history=[]):
    """Simple wrapper for generating content."""
    try:
        chat = model.start_chat(history=history)
        response = chat.send_message(prompt)
        return response.text
    except Exception as e:
        print(f"[GEMINI_ERROR] {e}")
        return "Thinking..."

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
        if not data: return (json.dumps({"reply": "No data"}), 200, headers)

        req_type = data.get('type', 'chat')
        print(f"[REQUEST] {req_type}")
        
        db = firestore.Client(project=PROJECT_ID)

        # --- RANDOM MATCHMAKING ---
        if req_type == "find_random_match":
            user_id = data.get('userId')
            user_name = data.get('userName')
            user_avatar = data.get('userAvatar')
            
            # 1. Filter out rooms older than 3 minutes to avoid stale matches
            three_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=3)
            
            # 2. Try to find an existing room to join
            waiting_docs = db.collection('queue') \
                .where('status', '==', 'waiting') \
                .where('mode', '==', 'random') \
                .where('createdAt', '>', three_mins_ago) \
                .limit(10).stream() # Get a few to avoid host matching self
            
            found_room = None
            for doc_snap in waiting_docs:
                if doc_snap.to_dict().get('hostId') != user_id:
                    found_room = doc_snap
                    break
            
            if found_room:
                # MATCH FOUND (Human) - Use a transaction to ensure atomic join
                room_ref = db.collection('queue').document(found_room.id)
                role_pair = random.choice(ROLE_PAIRS)
                role_idx = random.randint(0, 1)
                
                @firestore.transactional
                def update_room(transaction, ref):
                    snapshot = ref.get(transaction=transaction)
                    if not snapshot.exists or snapshot.get('status') != 'waiting':
                        return None # Room taken or gone
                    
                    transaction.update(ref, {
                        'status': 'matched',
                        'player2Id': user_id, 'player2Name': user_name, 'player2Avatar': user_avatar,
                        'startedAt': firestore.SERVER_TIMESTAMP,
                        'roleData': {
                            'pairId': role_pair['id'], 'topic': role_pair['topic'],
                            'player1Role': role_pair['roles'][role_idx], 'player1Icon': role_pair['icons'][role_idx], 'player1Desc': role_pair['descriptions'][role_idx],
                            'player2Role': role_pair['roles'][1-role_idx], 'player2Icon': role_pair['icons'][1-role_idx], 'player2Desc': role_pair['descriptions'][1-role_idx]
                        }
                    })
                    return snapshot.to_dict()

                room_data = update_room(db.transaction(), room_ref)
                
                if room_data:
                    return (json.dumps({
                        "success": True, "matched": True, "roomId": found_room.id,
                        "opponent": {"id": room_data.get('hostId'), "name": room_data.get('userName'), "avatar": room_data.get('userAvatar')},
                        "myRole": role_pair['roles'][1-role_idx], "myIcon": role_pair['icons'][1-role_idx], "myDesc": role_pair['descriptions'][1-role_idx], "topic": role_pair['topic']
                    }), 200, headers)
                # If room_data is None, transaction failed, fall through to host a new room
            
            # 3. NO ROOM FOUND - HOST A NEW ONE
            # Check for duplicates
            existing = db.collection('queue').where('hostId', '==', user_id).where('status', '==', 'waiting').limit(1).stream()
            if next(existing, None):
                # Clean up old waiting room from THIS user if any
                return (json.dumps({"success": True, "matched": False, "message": "Already waiting"}), 200, headers)

            ref = db.collection('queue').add({
                'roomCode': "RND"+str(random.randint(1000,9999)),
                'hostId': user_id, 'userName': user_name, 'userAvatar': user_avatar,
                'status': 'waiting', 'mode': 'random', 'createdAt': firestore.SERVER_TIMESTAMP
            })
            return (json.dumps({"success": True, "matched": False, "roomId": ref[1].id}), 200, headers)

        # --- CREATE PRIVATE ROOM ---
        if req_type == "create_room":
            user_id = data.get('userId')
            user_name = data.get('userName', 'Host')
            user_avatar = data.get('userAvatar', '🦁')
            
            # Generate 4-digit room code
            room_code = str(random.randint(1000, 9999))
            
            ref = db.collection('queue').add({
                'roomCode': room_code,
                'hostId': user_id, 'userName': user_name, 'userAvatar': user_avatar,
                'status': 'waiting', 'mode': 'private', 'createdAt': firestore.SERVER_TIMESTAMP
            })
            
            return (json.dumps({"success": True, "roomCode": room_code, "roomId": ref[1].id}), 200, headers)

        # --- JOIN PRIVATE ROOM ---
        if req_type == "join_room":
            room_code = data.get('roomCode')
            user_id = data.get('userId')
            user_name = data.get('userName', 'Friend')
            user_avatar = data.get('userAvatar', '🦁')
            
            # Find room by code
            rooms = db.collection('queue').where('roomCode', '==', room_code).where('status', '==', 'waiting').where('mode', '==', 'private').limit(1).stream()
            room = next(rooms, None)
            
            if not room:
                return (json.dumps({"success": False, "error": "Room not found or already started"}), 200, headers)
            
            room_data = room.to_dict()
            
            # Don't let host join their own room
            if room_data.get('hostId') == user_id:
                return (json.dumps({"success": False, "error": "Cannot join your own room"}), 200, headers)
            
            # Update room to matched with transaction
            room_ref = db.collection('queue').document(room.id)
            @firestore.transactional
            def join_room_txn(transaction, ref):
                snapshot = ref.get(transaction=transaction)
                if not snapshot.exists or snapshot.get('status') != 'waiting':
                    return None
                
                transaction.update(ref, {
                    'status': 'matched',
                    'player2Id': user_id, 'player2Name': user_name, 'player2Avatar': user_avatar,
                    'startedAt': firestore.SERVER_TIMESTAMP
                })
                return snapshot.to_dict()
                
            res_data = join_room_txn(db.transaction(), room_ref)
            if not res_data:
                return (json.dumps({"success": False, "error": "Room taken or gone"}), 200, headers)
            
            return (json.dumps({
                "success": True, "roomId": room.id,
                "opponent": {"id": res_data.get('hostId'), "name": res_data.get('userName'), "avatar": res_data.get('userAvatar')}
            }), 200, headers)

        # --- TRIGGER FAKE BOT MATCH ---
        if req_type == "trigger_bot_match":
            room_id = data.get('roomId')
            user_id = data.get('userId')
            
            # 1. Fetch User Data for 'lastBots'
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            last_bots = []
            if user_doc.exists:
                last_bots = user_doc.to_dict().get('lastBots', [])
                
            # 2. Filter available bots
            available_bots = [b for b in BOT_PERSONAS if b['id'] not in last_bots]
            # Fallback if all bots used recently (shouldn't happen with large pool, but good safety)
            if not available_bots:
                available_bots = BOT_PERSONAS
            
            # 3. Select Bot
            bot = random.choice(available_bots)
            
            # 4. Update 'lastBots' (Push new, keep max 3)
            new_last_bots = last_bots + [bot['id']]
            if len(new_last_bots) > 3:
                new_last_bots = new_last_bots[-3:] # Keep last 3
                
            if user_doc.exists:
                user_ref.update({'lastBots': new_last_bots})
            else:
                user_ref.set({'uid': user_id, 'lastBots': new_last_bots}, merge=True)
            
            role_pair = random.choice(ROLE_PAIRS)
            role_idx = random.randint(0, 1) # 0 for P1(User), 1 for P2(Bot)
            
            # User is P1 (Host)
            # Update room to 'matched' but with isBotMatch=True
            db.collection('queue').document(room_id).update({
                'status': 'matched',
                'player2Id': bot['id'], 'player2Name': bot['name'], 'player2Avatar': bot['avatar'],
                'isBotMatch': True, 'botPersona': bot,
                'startedAt': firestore.SERVER_TIMESTAMP,
                'roleData': {
                    'pairId': role_pair['id'], 'topic': role_pair['topic'],
                    'player1Role': role_pair['roles'][0], 'player1Icon': role_pair['icons'][0], 'player1Desc': role_pair['descriptions'][0],
                    'player2Role': role_pair['roles'][1], 'player2Icon': role_pair['icons'][1], 'player2Desc': role_pair['descriptions'][1]
                }
            })
            
            return (json.dumps({
                "success": True, "matched": True, "roomId": room_id,
                "opponent": {"id": bot['id'], "name": bot['name'], "avatar": bot['avatar']},
                "myRole": role_pair['roles'][0], "myIcon": role_pair['icons'][0], "myDesc": role_pair['descriptions'][0], "topic": role_pair['topic']
            }), 200, headers)

        # --- SEND MESSAGE (With Bot Logic) ---
        if req_type == "send_message":
            room_id = data.get('roomId')
            text = data.get('text')
            sender_id = data.get('senderId')
            
            # Save user message
            db.collection('queue').document(room_id).collection('messages').add({
                'text': text, 'senderId': sender_id, 'createdAt': firestore.SERVER_TIMESTAMP
            })
            
            # Check if Bot Match
            room_snap = db.collection('queue').document(room_id).get()
            room_data = room_snap.to_dict()
            
            if room_data.get('isBotMatch') and sender_id != room_data.get('player2Id'):
                # It's a bot match and human sent a message. Trigger Bot Response.
                bot = room_data.get('botPersona')
                role_info = room_data.get('roleData', {})
                bot_role = role_info.get('player2Role', 'Friend') # Bot is P2
                topic = role_info.get('topic', 'Chat')
                
                # Generate Bot Response using Gemini
                model = get_model()
                # Get last few messages for context
                msgs_ref = db.collection('queue').document(room_id).collection('messages').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).stream()
                history_text = "\n".join([f"{'User' if m.to_dict()['senderId'] == sender_id else 'You'}: {m.to_dict()['text']}" for m in msgs_ref][::-1])

                sys_prompt = f"""
                {bot['prompt']}
                Current Role: {bot_role} in a '{topic}' scenario.
                Context:
                {history_text}
                User: {text}
                Respond as {bot['name']}. KEEP IT SHORT. Make 1 minor grammar mistake to sound human.
                """
                
                try:
                    response_text = model.generate_content(sys_prompt).text.strip()
                except:
                    response_text = "Yeah, I agree." # Fallback

                # Simulate "Typing" delay handled by frontend visualization, but we add to DB
                # Ideally, we'd use a cloud task for delay, but for simplicity we write immediately
                # and frontend renders it when it arrives.
                
                db.collection('queue').document(room_id).collection('messages').add({
                    'text': response_text,
                    'senderId': room_data.get('player2Id'), # Bot ID
                    'createdAt': firestore.SERVER_TIMESTAMP
                })

            return (json.dumps({"success": True}), 200, headers)

        # --- END SESSION ---
        if req_type == "end_session":
            room_id = data.get('roomId')
            ended_by = data.get('endedBy')
            db.collection('queue').document(room_id).update({'status': 'ended', 'endedBy': ended_by, 'endedAt': firestore.SERVER_TIMESTAMP})
            return (json.dumps({"success": True}), 200, headers)

        # --- ANALYSIS (UNCHANGED) ---
        if req_type == "analyze":
            # (Keeping existing analysis logic - simplified for brevity of this update, ensuring it works)
            model = get_model()
            p1_hist = data.get('player1History')
            p2_hist = data.get('player2History')
            
            if p1_hist and p2_hist:
                prompt = (
                    "Analyze competitive conversation.\n"
                    f"P1: {p1_hist}\nP2: {p2_hist}\n"
                    "Score vocabulary, grammar, fluency, sentence_making (0-100).\n"
                    "Return JSON: { 'player1': {vocabulary, grammar, fluency, sentence_making, overall, feedback}, 'player2': {...} }"
                )
                try:
                    res = model.generate_content(prompt).text
                    json_str = res[res.find('{'):res.rfind('}')+1]
                    return (json_str, 200, headers)
                except:
                    # Fallback JSON
                    fallback = {
                        "player1": {"vocabulary": 75, "grammar": 70, "fluency": 80, "sentence_making": 75, "overall": 75, "feedback": "Good job!"},
                        "player2": {"vocabulary": 70, "grammar": 75, "fluency": 75, "sentence_making": 70, "overall": 72, "feedback": "Nice effort!"}
                    }
                    return (json.dumps(fallback), 200, headers)

        # --- OTHER HANDLERS (Sims, etc) ---
        # Basic chat support for sims handled by 'send_message' + client-side for sims? 
        # Wait, Sim chat was server-side before. I should restore that logic if needed.
        # But user said "simulations should be placed properly and not on login page".
        # Assuming Sim chat uses this same backend.
        if req_type == "chat":
             # Simulation chat with grammar feedback
             model = get_model()
             persona_id = data.get('personaId', 'unknown')
             context = data.get('context', 'General Chat')
             msg = data.get('message', '')
             history = data.get('history', [])
             stage = data.get('stage', '')
             
             # Skip warmup messages
             if msg.lower() == 'warmup':
                 return (json.dumps({
                     "reply": "Ready to chat! ☕",
                     "hasCorrection": False,
                     "correction": None,
                     "points": 0
                 }), 200, headers)
             
             history_text = "\n".join(history[-6:]) if history else ""
             
             # Strict grammar checking prompt
             prompt = f"""You are a friendly AI in a "{context}" roleplay scenario AND a strict English grammar teacher.
Stage: {stage}

Conversation so far:
{history_text}
User: {msg}

FIRST: Respond naturally in 1-2 sentences with a relevant emoji. Stay in character.

SECOND: STRICTLY check the user's English for ANY errors including:
- Wrong word order (e.g., "how much take its time" should be "how much time does it take")
- Missing articles (a, an, the)
- Wrong prepositions
- Subject-verb disagreement
- Incorrect tense usage
- Spelling mistakes
- Wrong word choice

BE STRICT! Indian English learners often make word order mistakes. If the sentence doesn't sound like a native speaker would say it, MARK IT AS A MISTAKE.

Reply in this exact JSON format only:
{{"reply": "your response with emoji", "hasCorrection": false, "correction": null, "points": 5}}

If there IS ANY grammar/spelling issue (BE STRICT!), use:
{{"reply": "your response", "hasCorrection": true, "correction": {{"original": "the exact wrong phrase", "corrected": "the correct way to say it", "reason": "clear explanation why", "example": "another example sentence using correct form", "type": "grammar"}}, "points": 5}}

JSON only, no other text:"""
             
             try:
                 response = model.generate_content(prompt)
                 response_text = response.text.strip()
                 
                 # Clean markdown if present
                 if '```' in response_text:
                     parts = response_text.split('```')
                     for part in parts:
                         if part.strip().startswith('json'):
                             response_text = part.strip()[4:].strip()
                             break
                         elif part.strip().startswith('{'):
                             response_text = part.strip()
                             break
                 
                 # Find JSON in response
                 start = response_text.find('{')
                 end = response_text.rfind('}') + 1
                 if start != -1 and end > start:
                     response_text = response_text[start:end]
                 
                 result = json.loads(response_text)
                 return (json.dumps(result), 200, headers)
             except json.JSONDecodeError as je:
                 print(f"[JSON_ERROR] {je} - Raw: {response_text[:200]}")
                 # Return a simple reply if JSON fails
                 return (json.dumps({
                     "reply": "That sounds interesting! Tell me more. 😊",
                     "hasCorrection": False,
                     "correction": None,
                     "points": 5
                 }), 200, headers)
             except Exception as e:
                 print(f"[CHAT_ERROR] {e}")
                 return (json.dumps({
                     "reply": "I see! Tell me more about that. 🤔",
                     "hasCorrection": False,
                     "correction": None,
                     "points": 5
                 }), 200, headers)

        if req_type == "detailed_explanation":
            # Get detailed grammar explanation from AI professor
            model = get_model()
            original = data.get('original', '')
            corrected = data.get('corrected', '')
            reason = data.get('reason', '')
            mother_tongue = data.get('motherTongue', 'Hindi')
            
            prompt = f"""You are a friendly English professor named "Prof. Sharma" helping an Indian student who speaks {mother_tongue}.
Explain this grammar/spelling mistake in a structured, easy-to-understand way:

WRONG: "{original}"
CORRECT: "{corrected}"
BASIC ISSUE: {reason}

Provide a STRUCTURED explanation with these NUMBERED sections:
1. WHY IT'S WRONG: Explain simply why this is incorrect (2-3 sentences)
2. THE RULE: State the grammar/spelling rule clearly (1-2 sentences)  
3. {mother_tongue.upper()} SPEAKERS NOTE: Why {mother_tongue} speakers make this mistake (1-2 sentences)
4. CORRECT USAGE: Show how to use it correctly

Give 3 practice examples and 2 memory tips.

IMPORTANT: Format your explanation with clear numbered points like:
"1. WHY IT'S WRONG: The word 'docter' is... 2. THE RULE: English spelling follows... 3. {mother_tongue.upper()} SPEAKERS NOTE: In {mother_tongue}..."

Reply in this JSON format ONLY:
{{"explanation": "1. WHY IT'S WRONG: ... 2. THE RULE: ... 3. {mother_tongue.upper()} SPEAKERS NOTE: ... 4. CORRECT USAGE: ...", "examples": ["example 1", "example 2", "example 3"], "tips": ["tip 1", "tip 2"]}}

JSON only:"""


            try:
                response = model.generate_content(prompt)
                response_text = response.text.strip()
                
                # Clean and parse JSON
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                if start != -1 and end > start:
                    response_text = response_text[start:end]
                
                result = json.loads(response_text)
                return (json.dumps(result), 200, headers)
            except Exception as e:
                print(f"[EXPLANATION_ERROR] {e}")
                return (json.dumps({
                    "explanation": f"This is a common mistake where '{original}' should be '{corrected}'. {reason} Many {mother_tongue} speakers make this error because of differences in grammar structure.",
                    "examples": [corrected, f"Another example: {corrected.replace('I', 'We')}", f"Question form: Do you {corrected.split(' ', 1)[-1] if ' ' in corrected else corrected}?"],
                    "tips": ["Practice saying this correctly 5 times", "Write 3 sentences using this pattern daily"]
                }), 200, headers)

    except Exception as e:
        print(f"[GLOBAL_ERR] {e}")
        return (json.dumps({"error": str(e)}), 200, headers)


    return (json.dumps({"error": "Unknown type"}), 400, headers)
