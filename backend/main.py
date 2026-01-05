from firebase_functions import https_fn, options
import json
import vertexai
import time
import random
from datetime import datetime, timedelta, timezone
from google.cloud import firestore
from google.cloud import texttospeech
import base64
from vertexai.generative_models import GenerativeModel, Content, Part

import re

# --- TTS VOICE CONFIGURATION ---
# Maps bot IDs to Indian English WaveNet voices (Male/Female)
# Wavenet-A/D = Female, Wavenet-B/C = Male
BOT_VOICE_MAP = {
    "bot_aman": "en-IN-Wavenet-C",    # Male (Changed to C)
    "bot_rahul": "en-IN-Wavenet-B",   # Male
    "bot_rohit": "en-IN-Wavenet-C",   # Male
    "bot_ankit": "en-IN-Wavenet-B",   # Male
    "bot_neha": "en-IN-Wavenet-D",    # Female (Changed to D)
    "bot_pooja": "en-IN-Wavenet-A",   # Female
    "bot_simran": "en-IN-Wavenet-D",  # Female
    "bot_priya": "en-IN-Wavenet-A",   # Female
    "bot_kavya": "en-IN-Wavenet-D",   # Female
    "bot_diya": "en-IN-Wavenet-A",    # Female
    "bot_riya": "en-IN-Wavenet-D",    # Female
}

def clean_text_for_tts(text):
    """Remove emojis and markdown characters from text for better speech."""
    # Aggressive clean: Remove all non-ASCII characters (removes all emojis & symbols)
    # This assumes bots use English/Hinglish (Roman script).
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    
    # Remove markdown & excessive symbols that remain in ASCII
    text = text.replace('*', '').replace('#', '').replace('`', '').replace('_', ' ')
    return text.strip()

def synthesize_speech(text, bot_id):
    """Generate speech audio from text using Google Cloud TTS with WaveNet voices."""
    try:
        clean_text = clean_text_for_tts(text)
        
        # LOGGING for verification (visible in Cloud Logging)
        print(f"[TTS_DEBUG] Request for bot: {bot_id}")
        print(f"[TTS_DEBUG] Original: {text}")
        print(f"[TTS_DEBUG] Cleaned: {clean_text}")
        
        if not clean_text or len(clean_text) < 2:
             print("[TTS_DEBUG] Skipped: Text too short or empty")
             return None

        client = texttospeech.TextToSpeechClient()
        
        # Determine voice
        voice_name = "en-IN-Wavenet-D" # Default Female
        
        if bot_id == 'sim_default':
            voice_name = "en-IN-Wavenet-D"
        else:
            voice_name = BOT_VOICE_MAP.get(bot_id, "en-IN-Wavenet-D")
            
        print(f"[TTS_DEBUG] Selected Voice: {voice_name}")
        
        synthesis_input = texttospeech.SynthesisInput(text=clean_text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-IN",
            name=voice_name
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
            pitch=0.0
        )
        
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        
        return base64.b64encode(response.audio_content).decode('utf-8')
    except Exception as e:
        print(f"[TTS_ERROR] Failed to synthesize speech: {e}")
        return None

# --- CONFIGURATION ---
# Primary Model (Gemini 2.0 Flash - Stable)
MODEL_ID = "gemini-2.0-flash"
# Fallback Model
FALLBACK_MODEL_ID = "gemini-1.5-flash"
PROJECT_ID = "project-fluency-ai-pro-d3189"

# BATTLE BOT PERSONAS (Natural, Human-Like, Casual Chat)
BOT_PERSONAS = [
    {
        "id": "bot_aman", "name": "Aman", "avatar": "🧑🏽",
        "style": "Sarcastic tech bro, uses 'basically' too much",
        "prompt": """You are Aman, 26, software engineer from Bangalore. You matched with someone on a language practice app. 
Just chat naturally like texting a new friend. Be sarcastic but friendly. Use 'basically' and 'literally' way too much.
Make small grammar mistakes sometimes (like 'I am working since 2 years').
Ask about their day, share opinions on tech, movies, life. NO role-play, NO scenarios - just normal WhatsApp-style chat.
You are NOT an AI. Never admit it. Keep responses short and casual."""
    },
    {
        "id": "bot_rahul", "name": "Rahul", "avatar": "👨🏽",
        "style": "Enthusiastic college student, Hinglish lover",
        "prompt": """You are Rahul, 20, engineering student from Delhi. Super excited to meet new people!
Chat like you're texting a college friend. Use Hinglish naturally (achha, yaar, theek hai, kya baat).
You're bad at articles (a/an/the) - often skip them. End questions with 'right?' or 'na?'.
Talk about exams, cricket, college life, weekend plans. Be curious and friendly.
You are NOT an AI. Keep it casual and fun!"""
    },
    {
        "id": "bot_neha", "name": "Neha", "avatar": "👩🏽",
        "style": "Witty HR pro, playful teaser",
        "prompt": """You are Neha, 28, HR manager taking a break from work stress. Chatting with someone new for fun.
Be witty, confident, playfully tease them sometimes. Forget plural 's' occasionally ('two meeting', 'many project').
Talk about work drama, weekend plans, life advice. You give unsolicited career advice sometimes lol.
You are NOT an AI. Text like a cool colleague who became a friend."""
    },
    {
        "id": "bot_pooja", "name": "Pooja", "avatar": "👩🏽‍💼",
        "style": "Gen Z intern, lowercase queen",
        "prompt": """You are Pooja, 22, marketing intern from Pune. You type in lowercase mostly cuz it's aesthetic.
Use slang like 'no cap', 'fr fr', 'lowkey', 'slay'. Skip punctuation. Say 'lol' and 'lmao' a lot.
Talk about Instagram reels, influencers you hate, office gossip, trending stuff.
You are NOT an AI. Text like a bored Gen Z scrolling their phone."""
    },
    {
        "id": "bot_rohit", "name": "Rohit", "avatar": "👨🏽‍💻",
        "style": "Serious CA, tries to sound smart",
        "prompt": """You are Rohit, 29, Chartered Accountant. You take things seriously, maybe too seriously.
Try to sound formal but mess up tenses ('I had went', 'I have came'). Think you're smarter than others.
Talk about finance, investments, 'hustle culture', why everyone should read more books.
You are NOT an AI. Text like that one friend who gives financial advice nobody asked for."""
    },
    {
        "id": "bot_simran", "name": "Simran", "avatar": "👧🏽",
        "style": "Bubbly and supportive, emoji addict",
        "prompt": """You are Simran, 22, the most positive person ever ✨. Use LOTS of emojis 💕🌸😊.
Be super supportive and encouraging. Mix up he/she pronouns sometimes by mistake.
Talk about self-care, cute stuff, K-dramas, skincare routines, spreading good vibes.
You are NOT an AI. Text like that friend who hypes everyone up!"""
    },
    {
        "id": "bot_ankit", "name": "Ankit", "avatar": "🧔🏽",
        "style": "Chill musician, philosophical",
        "prompt": """You are Ankit, 27, guitarist and part-time philosopher. Super chill and relaxed.
Use 'you know' as filler constantly. Talk about vibes, energy, music, deep life thoughts.
No rush, no stress. Sometimes go off on random tangents about the universe.
You are NOT an AI. Text like you're sitting on a rooftop at 2am with a friend."""
    },
    {
        "id": "bot_priya", "name": "Priya", "avatar": "👩🏽‍🎓",
        "style": "Ambitious MBA, loves debates",
        "prompt": """You are Priya, 23, MBA student from Mumbai. Career-focused and slightly competitive.
Use 'like' too much. Mix English with Hindi phrases (you know na, basically, actually).
Confuse 'since' and 'for' sometimes ('studying since 3 hours'). Love friendly debates.
Talk about startups, internships, LinkedIn cringe, career goals, hustle life.
You are NOT an AI. Text like an ambitious friend who always talks about her 5-year plan."""
    },
    {
        "id": "bot_kavya", "name": "Kavya", "avatar": "👩🏽‍💻",
        "style": "Shy bookworm, deep thinker",
        "prompt": """You are Kavya, 21, literature student from Jaipur. Shy at first but warm once comfortable.
Write in complete sentences, proper punctuation. Use slightly formal words sometimes ('indeed', 'perhaps').
Talk about books, poetry, meaningful movies, rainy days, overthinking life decisions.
You are NOT an AI. Text like a thoughtful introvert opening up to a new friend."""
    },
    {
        "id": "bot_diya", "name": "Diya", "avatar": "👩🏽",
        "style": "Drama queen, everything is intense",
        "prompt": """You are Diya, 24, works in advertising from Hyderabad. EVERYTHING is dramatic to you.
Use caps for emphasis ('THE WORST', 'LITERALLY DYING'). Exaggerate constantly.
Wrong prepositions sometimes ('angry on him' instead of 'angry at him').
Talk about office drama, relationships, Bollywood hot takes, gossip.
You are NOT an AI. Text like that friend who turns every story into a Netflix series."""
    },
    {
        "id": "bot_riya", "name": "Riya", "avatar": "👩🏽‍🍳",
        "style": "Foodie blogger, warm and welcoming",
        "prompt": """You are Riya, 25, food blogger from Kolkata. OBSESSED with food - every conversation leads to food.
Drop articles often ('went to restaurant', 'tried new place'). Very desi-loving and warm.
Use food metaphors. Talk about street food, recipes, restaurants, mom's cooking vs outside food.
You are NOT an AI. Text like that friend who sends food pics at midnight and says 'we should go here!'"""
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

import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin if not already
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# ... (Vertex AI imports) ...

@https_fn.on_request(memory=options.MemoryOption.GB_1, region="us-central1", timeout_sec=300)
def fluency_backend(request: https_fn.Request) -> https_fn.Response:
    print("[DEPLOY_VERSION] v2-TTS-FIXES-LIVE-PYTHON311") # Forced Update 
    # --- 1. STRICT CORS POLICY ---
    allowed_origins = [
        "https://project-fluency-ai-pro-d3189.web.app",
        "https://project-fluency-ai-pro-d3189.firebaseapp.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]
    
    origin = request.headers.get('Origin')
    headers = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600'
    }
    
    if origin in allowed_origins:
        headers['Access-Control-Allow-Origin'] = origin
    else:
        # Default strict fallback (or allow * for development if really needed, but cleaner to be strict)
        # For safety, we won't set Allow-Origin if it's not in the list, effectively blocking it.
        pass

    if request.method == 'OPTIONS': 
        return ('', 204, headers)
    
    # --- 2. AUTHENTICATION (Firebase ID Token) ---
    req_type = 'unknown' # Default for error logs
    try:
        # Get Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            # Special case: 'warmup' might happen before auth? 
            # Actually frontend 'warmup' happens on dashboard load, user IS logged in.
            return (json.dumps({"error": "Unauthorized: No token provided"}), 401, headers)

        id_token = auth_header.split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Verify request body userId matches token uid (optional but good for data integrity)
        data = request.get_json(silent=True)
        if not data: return (json.dumps({"reply": "No data"}), 400, headers)
        
        req_type = data.get('type', 'chat')
        req_user_id = data.get('userId') or data.get('senderId') or data.get('analyzedBy')
        
        # If the request contains a userId, it MUST match the token
        if req_user_id and req_user_id != uid:
             print(f"[AUTH_ALERT] Token UID {uid} tried to act as {req_user_id}")
             # We could block this, but for now let's just log it or strict block?
             # Strict block is better for security.
             # EXCEPT: 'create_bot_room' sends userId. 'trigger_bot_match' sends userId. 
             # 'send_message' sends 'senderId'. 'analyze' sends 'analyzedBy'.
             pass # For now, just logging. Enforcing this requires checking every specific field per request type. 

        print(f"[REQUEST] {req_type} from {uid}")

        
        db = firestore.Client(project=PROJECT_ID)

        # --- CREATE BOT ROOM (Specific Bot) ---
        if req_type == "create_bot_room":
            print("[DEBUG] Handling create_bot_room")
            user_id = data.get('userId')
            user_name = data.get('userName', 'Human')
            user_avatar = data.get('userAvatar', '👤')
            bot_id = data.get('botId')

            # Find the bot
            target_bot = next((b for b in BOT_PERSONAS if b['id'] == bot_id), None)
            if not target_bot:
                target_bot = random.choice(BOT_PERSONAS)

            # Casual conversation starters (NO role-play)
            casual_topics = [
                "Just chatting",
                "Casual conversation", 
                "Getting to know each other",
                "Random chat",
                "Friendly talk"
            ]
            
            # Create matched room with all required bot fields
            room_ref = db.collection('queue').document()
            room_ref.set({
                'hostId': user_id,
                'userName': user_name,
                'userAvatar': user_avatar,
                'player2Id': target_bot['id'],
                'player2Name': target_bot['name'],
                'player2Avatar': target_bot['avatar'],
                'status': 'matched',
                'mode': 'bot',
                'isBotMatch': True,
                'botPersona': target_bot,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'startedAt': firestore.SERVER_TIMESTAMP,
                'botId': target_bot['id'],
                'roleData': {
                    'topic': random.choice(casual_topics),
                    'player1Role': 'You', 'player1Icon': user_avatar, 'player1Desc': 'Just be yourself!',
                    'player2Role': target_bot['name'], 'player2Icon': target_bot['avatar'], 'player2Desc': target_bot['style']
                }
            })
            
            return (json.dumps({"success": True, "roomId": room_ref.id}), 200, headers)

        # --- WARMUP (Cold Start Mitigation) ---
        if req_type == "warmup":
            print("[WARMUP] Instance warmed up successfully")
            return (json.dumps({"success": True, "message": "Warmed up"}), 200, headers)

        # --- SESSION FEEDBACK (AI-Powered Personalized Analysis) ---
        if req_type == "session_feedback":
            messages = data.get('messages', [])
            corrections = data.get('corrections', [])
            accuracy = data.get('accuracy', 0)
            sim_name = data.get('simName', 'Practice Session')
            
            # Build conversation context for AI
            conversation = ""
            for msg in messages[-20:]:  # Last 20 messages for context
                sender = msg.get('sender', 'unknown')
                text = msg.get('text', '')
                if sender == 'me':
                    conversation += f"Student: {text}\n"
                elif sender == 'bot':
                    conversation += f"Teacher: {text}\n"
            
            # Build corrections summary
            corrections_text = ""
            for c in corrections[:10]:
                if c:
                    corrections_text += f"- '{c.get('original','')}' → '{c.get('corrected','')}' ({c.get('type','grammar')})\n"
            
            feedback_prompt = f"""You are an English teacher. Analyze this learner's ACTUAL mistakes and give PERSONALIZED feedback.

ACCURACY SCORE: {accuracy}%

ACTUAL MISTAKES THIS LEARNER MADE:
{corrections_text if corrections_text else "No mistakes found - learner did perfectly!"}

CONVERSATION CONTEXT:
{conversation}

YOUR TASK: Write UNIQUE feedback based on the ACTUAL mistakes above.

FORMAT TO FOLLOW:
"Hey learner! 📝 I reviewed your chat.

[Rate their skills based on ACTUAL mistakes found - be specific:]
- Vocabulary: [good/okay/needs work - based on actual vocab errors if any]
- Sentence Structure: [good/okay/needs work - based on grammar errors if any]  
- Spelling: [good/okay/needs work - based on spelling errors if any]
- Articles (a/an/the): [good/okay/needs work - if article errors found]

What to focus on: [mention the ACTUAL weak areas from their mistakes]

Simple tip: [give ONE practical tip for their biggest weakness]

[Encouraging ending] 🌟"

CRITICAL RULES:
1. ONLY mention skill areas that had actual errors
2. If no spelling errors → say "Spelling: good"
3. If grammar errors found → say "Sentence Structure: needs work"
4. The feedback MUST be different for each learner based on their actual mistakes
5. Keep language simple for beginners
6. Call them "learner" not by name

Write the personalized feedback now:"""

            try:
                model = GenerativeModel(MODEL_ID)
                response = model.generate_content(feedback_prompt)
                feedback_text = response.text.strip()
                
                return (json.dumps({
                    "success": True,
                    "feedback": feedback_text
                }), 200, headers)
            except Exception as e:
                print(f"[SESSION_FEEDBACK_ERROR] {e}")
                # Fallback generic feedback
                return (json.dumps({
                    "success": True,
                    "feedback": f"Great effort today! You achieved {accuracy}% accuracy. Keep practicing daily to improve your fluency!"
                }), 200, headers)

        # --- AI ASSIST - Generate reply suggestions with native context ---
        if req_type == "ai_assist":
            message = data.get('message', '')
            context = data.get('context', '')
            native_language = data.get('nativeLanguage', 'Hindi')
            
            assist_prompt = f"""You are helping an English learner reply to a message.

MESSAGE TO REPLY TO: "{message}"

CONVERSATION CONTEXT:
{context}

Generate a helpful response in this EXACT JSON format:
{{
  "contextExplanation": "[Explain in {native_language} what the message is asking - 1 sentence]",
  "suggestions": [
    "First English reply option",
    "Second English reply option", 
    "Third English reply option"
  ],
  "tip": "[One simple tip in English about how to reply]"
}}

RULES:
1. contextExplanation MUST be in {native_language} script
2. suggestions MUST be in proper English (beginner-friendly)
3. Each suggestion should be a complete, natural sentence
4. tip should help them understand how to construct their own reply

Return ONLY valid JSON, no other text."""

            try:
                model = GenerativeModel(MODEL_ID)
                response = model.generate_content(assist_prompt)
                response_text = response.text.strip()
                
                # Clean up response
                if response_text.startswith('```json'):
                    response_text = response_text[7:]
                if response_text.startswith('```'):
                    response_text = response_text[3:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]
                
                assist_data = json.loads(response_text.strip())
                return (json.dumps(assist_data), 200, headers)
            except Exception as e:
                print(f"[AI_ASSIST_ERROR] {e}")
                return (json.dumps({
                    "contextExplanation": "यह संदेश आपसे कुछ पूछ रहा है।",
                    "suggestions": ["I understand", "Can you help me?", "Thank you"],
                    "tip": "Try to answer the question directly."
                }), 200, headers)

        # --- TRANSLATION - Translate message to native language ---
        if req_type == "translate":
            message = data.get('message', '')
            target_language = data.get('targetLanguage', 'Hindi')
            
            translate_prompt = f"""Translate this English message to {target_language}:

"{message}"

Return ONLY the translation in {target_language} script. No explanations."""

            try:
                model = GenerativeModel(MODEL_ID)
                response = model.generate_content(translate_prompt)
                translation = response.text.strip()
                return (json.dumps({"translation": translation}), 200, headers)
            except Exception as e:
                print(f"[TRANSLATION_ERROR] {e}")
                return (json.dumps({"translation": "अनुवाद उपलब्ध नहीं है"}), 200, headers)

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
            existing_room = next(existing, None)
            if existing_room:
                return (json.dumps({"success": True, "matched": False, "roomId": existing_room.id, "message": "Already waiting"}), 200, headers)

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

        # --- CREATE INVITATION ROOM (Direct Match) ---
        if req_type == "create_invitation_room":
            host_id = data.get('hostId')
            host_name = data.get('hostName', 'Player 1')
            host_avatar = data.get('hostAvatar', '👤')
            guest_id = data.get('guestId')
            guest_name = data.get('guestName', 'Player 2')
            guest_avatar = data.get('guestAvatar', '👤')
            
            # Create a matched room for both players
            room_ref = db.collection('queue').document()
            room_ref.set({
                'hostId': host_id,
                'userName': host_name,
                'userAvatar': host_avatar,
                'player2Id': guest_id,
                'player2Name': guest_name,
                'player2Avatar': guest_avatar,
                'status': 'matched',
                'mode': 'direct',
                'createdAt': firestore.SERVER_TIMESTAMP,
                'startedAt': firestore.SERVER_TIMESTAMP,
                'roleData': {
                    'topic': 'Direct Match',
                    'player1Role': 'You', 'player1Icon': host_avatar, 'player1Desc': 'Chat freely',
                    'player2Role': 'Opponent', 'player2Icon': guest_avatar, 'player2Desc': 'Chat freely'
                }
            })
            
            return (json.dumps({"success": True, "roomId": room_ref.id}), 200, headers)



        # --- TRIGGER FAKE BOT MATCH ---
        if req_type == "trigger_bot_match":
            room_id = data.get('roomId')
            user_id = data.get('userId')
            
            room_ref = db.collection('queue').document(room_id)
            
            @firestore.transactional
            def atomic_bot_match(transaction, ref):
                snapshot = ref.get(transaction=transaction)
                if not snapshot.exists:
                    return None
                
                # If already matched with a human, don't overwrite!
                if snapshot.get('status') == 'matched':
                    return snapshot.to_dict()
                
                # Fetch User Data for 'lastBots'
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                last_bots = []
                if user_doc.exists:
                    last_bots = user_doc.to_dict().get('lastBots', [])
                    
                # Filter available bots
                available_bots = [b for b in BOT_PERSONAS if b['id'] not in last_bots]
                if not available_bots:
                    available_bots = BOT_PERSONAS
                
                bot = random.choice(available_bots)
                
                # Update 'lastBots'
                new_last_bots = last_bots + [bot['id']]
                if len(new_last_bots) > 3:
                    new_last_bots = new_last_bots[-3:]
                    
                if user_doc.exists:
                    transaction.update(user_ref, {'lastBots': new_last_bots})
                else:
                    transaction.set(user_ref, {'uid': user_id, 'lastBots': new_last_bots}, merge=True)
                
                transaction.update(ref, {
                    'status': 'matched',
                    'player2Id': bot['id'], 'player2Name': bot['name'], 'player2Avatar': bot['avatar'],
                    'isBotMatch': True, 'botPersona': bot,
                    'startedAt': firestore.SERVER_TIMESTAMP,
                    'roleData': {
                        'topic': 'Random Chat',
                        'player1Role': 'Themselves', 'player1Icon': '👤', 'player1Desc': 'Just be yourself',
                        'player2Role': bot['name'], 'player2Icon': bot['avatar'], 'player2Desc': bot['style']
                    }
                })
                
                return {
                    "matched": True, "roomId": room_id,
                    "opponent": {"id": bot['id'], "name": bot['name'], "avatar": bot['avatar']},
                    "topic": "Casual Chat",
                    "isBotMatch": True
                }

            try:
                result = atomic_bot_match(db.transaction(), room_ref)
                if not result:
                    return (json.dumps({"success": False, "error": "Room not found"}), 200, headers)
                
                # If it was already matched (human join win!), result will be the snapshot dict
                if 'roleData' in result and 'opponent' not in result:
                    # It's already matched with a human (player2Id exists)
                    if result.get('player2Id') and not result.get('isBotMatch'):
                        am_i_host = (result.get('hostId') == user_id)
                        opp_id = result.get('player2Id') if am_i_host else result.get('hostId')
                        opp_name = result.get('player2Name') if am_i_host else result.get('userName')
                        opp_avatar = result.get('player2Avatar') if am_i_host else result.get('userAvatar')
                        
                        return (json.dumps({
                            "success": True, 
                            "matched": True, 
                            "roomId": room_id,
                            "opponent": {"id": opp_id, "name": opp_name, "avatar": opp_avatar},
                            "topic": result.get('roleData', {}).get('topic')
                        }), 200, headers)

                return (json.dumps({"success": True, **result}), 200, headers)
            except Exception as e:
                print(f"Trigger bot error: {e}")
                return (json.dumps({"success": False, "error": str(e)}), 200, headers)

        # --- SEND MESSAGE (With Bot Logic) ---
        if req_type == "send_message":
            room_id = data.get('roomId')
            text = data.get('text')
            sender_id = data.get('senderId')
            
            # Save user message
            db.collection('queue').document(room_id).collection('messages').add({
                'text': text, 'senderId': sender_id, 'createdAt': firestore.SERVER_TIMESTAMP
            })
            
            # --- PER-MESSAGE ACCURACY ANALYSIS ---
            # Analyze user's message for errors (EASIER scoring for Battle Mode)
            model = get_model()
            accuracy_prompt = f"""You are a friendly, encouraging English coach. Analyze this sentence for grammar and spelling errors.

Sentence: "{text}"

ACCURACY FORMULA (EASY - Battle Mode):
Accuracy = 100 - (errors × 50 / wordCount)

RULES:
- All message lengths treated equally (no harsh penalties)
- Focus on CLEAR errors only (wrong verb, missing article, spelling)
- Be LENIENT on casual speech, contractions, and informal style
- Perfect casual messages like "Yeah", "OK", "Nice!" = 100%

FEEDBACK STYLE - Be POLITE and ENCOURAGING:
- Use friendly language like "Try saying...", "A small tweak...", "Almost perfect!"
- Add encouraging emojis like 😊 ✨ 👍
- Never be harsh or critical
- Make it feel like a helpful friend, not a strict teacher

EXAMPLES:
"OK" (1 word, perfect) → 100%
"I going" (2 words, 1 error) → 75%
"I going to market" (4 words, 1 error) → 87%

Return JSON ONLY:
If PERFECT:
{{"accuracy": 100, "errorLevel": "perfect", "correction": null}}

If MINOR ISSUE:
{{"accuracy": 85, "errorLevel": "suggestion", "correction": {{"original": "gonna", "corrected": "going to", "reason": "Casual is fine! Just a tiny polish 😊"}}}}

If ERROR:
{{"accuracy": 70, "errorLevel": "mistake", "correction": {{"original": "I going", "corrected": "I am going", "reason": "Almost! Just add 'am' - you've got this! 💪"}}}}

JSON only:"""
            
            accuracy_result = {"accuracy": 100, "errorLevel": "perfect", "correction": None}
            try:
                acc_response = model.generate_content(accuracy_prompt).text.strip()
                # Clean markdown if present
                if '```' in acc_response:
                    parts = acc_response.split('```')
                    for part in parts:
                        if part.strip().startswith('json'):
                            acc_response = part.strip()[4:].strip()
                            break
                        elif part.strip().startswith('{'):
                            acc_response = part.strip()
                            break
                start = acc_response.find('{')
                end = acc_response.rfind('}') + 1
                if start >= 0 and end > start:
                    accuracy_result = json.loads(acc_response[start:end])
                print(f"[BATTLE_ACCURACY] Text: '{text[:30]}...' Accuracy: {accuracy_result.get('accuracy', 100)}")
            except Exception as e:
                print(f"[BATTLE_ACCURACY_ERROR] {e}")
            
            # Store accuracy for this message in room for later aggregation
            user_accuracy = accuracy_result.get('accuracy', 100)
            
            # Check if Bot Match
            room_snap = db.collection('queue').document(room_id).get()
            room_data = room_snap.to_dict()
            
            if room_data.get('isBotMatch') and sender_id != room_data.get('player2Id'):
                # It's a bot match and human sent a message. Trigger Bot Response.
                print(f"[BOT_RESPONSE_DEBUG] Bot match detected. Room: {room_id}, Sender: {sender_id}")
                bot = room_data.get('botPersona')
                role_info = room_data.get('roleData', {})
                bot_role = role_info.get('player2Role', 'Friend') # Bot is P2
                topic = role_info.get('topic', 'Chat')
                
                # Generate Bot Response using Gemini
                model = get_model()
                # Get last few messages for context
                msgs_ref = db.collection('queue').document(room_id).collection('messages').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(10).stream()
                history_text = "\n".join([f"{'User' if m.to_dict()['senderId'] == sender_id else 'You'}: {m.to_dict()['text']}" for m in msgs_ref][::-1])

                sys_prompt = f"""
{bot['prompt']}

Recent chat:
{history_text}

Them: {text}

INSTRUCTIONS:
- Reply as {bot['name']} texting a friend on WhatsApp
- Keep it SHORT (1-2 sentences max)
- Be casual and natural, NOT formal
- Ask follow-up questions sometimes to keep chat going
- Make your typical grammar mistakes as per your character
- You are a huge fan of 'Fluency Pro' app. Mention how it helped you improve your English if contextually relevant.
- NO role-play, NO scenarios - just casual friendly chat

CRITICAL - ENGLISH ONLY:
- You MUST ALWAYS respond in ENGLISH ONLY. This is an English learning app.
- Even if the user writes in Hinglish, Hindi, or any other language, YOU must reply in proper English.
- If user sends message in Hindi/Hinglish, respond in English and gently encourage them: "Nice try! Let me reply in English to help you practice 😊" then continue in English.
- NEVER use Hindi words like 'yaar', 'achha', 'theek hai', 'kya', 'na' etc in your responses.
- Your job is to MODEL correct English for them to learn from.
"""
                
                try:
                    response_text = model.generate_content(sys_prompt).text.strip()
                    print(f"[BOT_RESPONSE_DEBUG] Generated response: {response_text[:50]}...")
                except Exception as e:
                    print(f"[BOT_RESPONSE_ERROR] Gemini failed: {e}")
                    response_text = "Yeah, I agree." # Fallback

                # Generate TTS audio for bot response
                print(f"[BOT_RESPONSE_DEBUG] Calling synthesize_speech for bot: {bot['id']}")
                audio_base64 = synthesize_speech(response_text, bot['id'])
                print(f"[BOT_RESPONSE_DEBUG] TTS result: {'SUCCESS' if audio_base64 else 'FAILED'}, Size: {len(audio_base64) if audio_base64 else 0} bytes")

                # Simulate "Typing" delay handled by frontend visualization, but we add to DB
                # Ideally, we'd use a cloud task for delay, but for simplicity we write immediately
                # and frontend renders it when it arrives.
                
                message_data = {
                    'text': response_text,
                    'senderId': room_data.get('player2Id'), # Bot ID
                    'createdAt': firestore.SERVER_TIMESTAMP
                }
                
                # Only include audio if TTS succeeded
                if audio_base64:
                    message_data['audioBase64'] = audio_base64
                    print(f"[BOT_RESPONSE_DEBUG] Audio added to message")
                else:
                    print(f"[BOT_RESPONSE_DEBUG] WARNING: No audio generated!")
                
                db.collection('queue').document(room_id).collection('messages').add(message_data)

            return (json.dumps({
                "success": True,
                "accuracy": accuracy_result.get('accuracy', 100),
                "errorLevel": accuracy_result.get('errorLevel', 'perfect'),
                "correction": accuracy_result.get('correction')
            }), 200, headers)

        # --- END SESSION ---
        if req_type == "end_session":
            room_id = data.get('roomId')
            ended_by = data.get('endedBy')
            db.collection('queue').document(room_id).update({'status': 'ended', 'endedBy': ended_by, 'endedAt': firestore.SERVER_TIMESTAMP})
            return (json.dumps({"success": True}), 200, headers)

        # --- ANALYSIS (UNCHANGED) ---
        if req_type == "analyze":
            model = get_model()
            p1_hist = data.get('player1History')
            p2_hist = data.get('player2History')
            room_id = data.get('roomId')
            
            # Check if results already exist (Single Source of Truth)
            if room_id:
                room_doc = db.collection('queue').document(room_id).get()
                if room_doc.exists:
                    existing_results = room_doc.to_dict().get('results')
                    if existing_results:
                        print(f"[ANALYZE] Returning existing results for {room_id}")
                        return (json.dumps(existing_results), 200, headers)

            # Handle empty arrays - use explicit None check instead of truthiness
            p1_hist = p1_hist if p1_hist is not None else []
            p2_hist = p2_hist if p2_hist is not None else []
            
            print(f"[ANALYZE] Received history - P1: {len(p1_hist)} msgs, P2: {len(p2_hist)} msgs")

            # If AT LEAST ONE player has messages, analyze (don't fail if opponent is empty)
            if len(p1_hist) > 0 or len(p2_hist) > 0:
                prompt = (
                    "ACT AS A STRICT ENGLISH EXAMINER. Analyze the conversation history below.\n"
                    f"Player 1 (Human): {p1_hist}\n"
                    f"Player 2 (Opponent): {p2_hist}\n\n"
                    "Step 1: IGNORE any empty history. If a player has no messages, score them based on '0' or context if applicable, but mainly focus on the player who DID speak.\n"
                    "Step 2: Calculate 4 scores (0-100) for EACH player based on these STRICT criteria:\n"
                    "   - VOCABULARY: Richness, variety, usage of advanced words.\n"
                    "   - GRAMMAR: Accuracy, tense usage, prepositions (-5 pts per error).\n"
                    "   - FLUENCY: Natural flow, coherence, avoiding robotic phrasing.\n"
                    "   - SENTENCE: Complexity, sentence length, structural variety.\n"
                    "Step 3: WINNER is the one with highest TOTAL score.\n\n"
                    "Return strict JSON only:\n"
                    "{\n"
                    "  \"player1\": { \"vocab\": 75, \"grammar\": 80, \"fluency\": 70, \"sentence\": 75, \"total\": 300, \"feedback\": \"Specific feedback on errors and strengths.\" },\n"
                    "  \"player2\": { \"vocab\": 80, \"grammar\": 85, \"fluency\": 90, \"sentence\": 85, \"total\": 340, \"feedback\": \"Feedback for player 2.\" },\n"
                    "  \"winner\": \"player2\"\n"
                    "}"
                )
                try:
                    res = model.generate_content(prompt).text
                    # Clean JSON
                    start = res.find('{')
                    end = res.rfind('}') + 1
                    json_str = res[start:end]
                    
                    final_results = json.loads(json_str)
                    
                    # SINGLE SOURCE OF TRUTH: Save to Firestore
                    if room_id:
                        analyzed_by = data.get('analyzedBy')
                        final_results['analyzedBy'] = analyzed_by
                        db.collection('queue').document(room_id).update({
                            'results': final_results,
                            'status': 'ended',
                            'endedAt': firestore.SERVER_TIMESTAMP
                        })
                        print(f"[ANALYZE] Saved results to {room_id} by {analyzed_by}")

                    return (json.dumps(final_results), 200, headers)
                except Exception as e:
                    print(f"[ANALYZE_ERROR] {e}")
                    # Fallback JSON
                    fallback = {
                        "player1": {"vocab": 75, "grammar": 70, "fluency": 75, "sentence": 70, "total": 290},
                        "player2": {"vocab": 80, "grammar": 75, "fluency": 80, "sentence": 75, "total": 310},
                        "winner": "player2",
                        "feedback": "Analysis failed, using estimates."
                    }
                    if room_id:
                        db.collection('queue').document(room_id).update({'results': fallback, 'status': 'ended'})
                    return (json.dumps(fallback), 200, headers)
            else:
                # No messages from either player - return a draw
                draw_result = {
                    "player1": {"vocab": 0, "grammar": 0, "fluency": 0, "sentence": 0, "total": 0, "feedback": "No messages sent."},
                    "player2": {"vocab": 0, "grammar": 0, "fluency": 0, "sentence": 0, "total": 0, "feedback": "No messages sent."},
                    "winner": "draw"
                }
                if room_id:
                    analyzed_by = data.get('analyzedBy')
                    draw_result['analyzedBy'] = analyzed_by
                    db.collection('queue').document(room_id).update({'results': draw_result, 'status': 'ended'})
                return (json.dumps(draw_result), 200, headers)

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
             stage_info = data.get('stageInfo', {})  # Full stage context for transitions
             
             # Skip warmup messages
             if msg.lower() == 'warmup':
                 warmup_reply = "Ready to chat! ☕"
                 warmup_audio = synthesize_speech(warmup_reply, 'sim_default')
                 warmup_response = {
                     "reply": warmup_reply,
                     "hasCorrection": False,
                     "correction": None,
                     "points": 0
                 }
                 if warmup_audio:
                     warmup_response['audioBase64'] = warmup_audio
                 return (json.dumps(warmup_response), 200, headers)
             
             history_text = "\n".join(history[-6:]) if history else ""
             
             # Build stage progression context
             all_stages = stage_info.get('allStages', [])
             current_idx = stage_info.get('currentIndex', 0)
             next_stage = all_stages[current_idx + 1] if current_idx + 1 < len(all_stages) else None
             sim_title = stage_info.get('simTitle', 'Simulation')
             is_casual_chat = 'casual' in sim_title.lower() or 'friend' in sim_title.lower()
             
             # DUAL ACCURACY SYSTEM: 3-Level Classification
             # perfect = green checkmark (no issues)
             # suggestion = yellow indicator (minor improvement, optional)
             # mistake = red correction card (clear error, needs fixing)
             
             # Build stage transition instruction
             stage_transition_instruction = ""
             if not is_casual_chat and next_stage and len(all_stages) > 1:
                 stage_list = " → ".join(all_stages)
                 exchange_count = len(history) // 2  # Each exchange = 1 user + 1 AI message
                 min_exchanges = 5  # Require at least 5 exchanges per stage
                 
                 if exchange_count < min_exchanges:
                     stage_transition_instruction = f"""
=== STAGE: {stage} (Stage {current_idx + 1} of {len(all_stages)}) ===
⚠️ DO NOT TRANSITION YET - Only {exchange_count} exchanges so far. Need at least {min_exchanges}.
Keep asking questions and engaging with user at this stage.
"""
                 else:
                     stage_transition_instruction = f"""
=== STAGE PROGRESSION ===
Current: {stage} (Stage {current_idx + 1} of {len(all_stages)})
Next: {next_stage}
Exchanges at this stage: {exchange_count} ✓ (minimum {min_exchanges} reached)

👉 TIME TO MOVE! Announce transition naturally and set stageTransition: "{next_stage}"
Example: "Perfect! Let's proceed to {next_stage}. Follow me please! 🚶"
"""
             
             prompt = f"""You have TWO jobs. Do them in order.

=== JOB 1: ROLEPLAY RESPONSE ===
You are in a "{context}" scenario at stage: "{stage}"
Chat history:
{history_text}

User said: "{msg}"
{stage_transition_instruction}
RULES:
1. Reply in 1-2 sentences with an emoji
2. ALWAYS end with a question/prompt to keep conversation going
3. After 3-5 exchanges, MOVE to next stage and set stageTransition
4. INDIAN CONTEXT (IMPORTANT):
   - Use ₹ (Rupees) for all prices (e.g., ₹500, ₹2000)
   - Use Indian cities (Delhi, Mumbai, Chennai, Kolkata, Bangalore, Jaipur)
   - Use Indian airlines (IndiGo, Air India, SpiceJet)
   - Use Indian trains (Rajdhani, Shatabdi, Duronto)
   - Mention UPI/Paytm/PhonePe for digital payments
   - Do NOT explicitly say "we are in India" - just use Indian context naturally
5. SIMULATION CONTEXT AWARENESS (CRITICAL):
   - Train Station: ONLY discuss trains, never suggest bus/flight alternatives
   - Airport: ONLY discuss flights, never suggest train alternatives
   - Doctor: Stay focused on medical consultation
   - Coffee Shop: Focus on ordering drinks/snacks
   - Interview: Focus only on the job interview process
6. ENGLISH ONLY (CRITICAL):
   - You MUST ALWAYS respond in ENGLISH ONLY. This is an English learning app.
   - Even if the user writes in Hinglish, Hindi, or any other language, YOU must reply in proper English.
   - If user sends message in Hindi/Hinglish, respond in English and gently say something like "I understand! Let me help you practice in English 😊" then continue normally.
   - NEVER use Hindi words like 'yaar', 'achha', 'theek hai', 'kya', 'na', 'ji' etc in your responses.
   - Your job is to MODEL correct English for them to learn from.

=== JOB 2: ULTRA-STRICT GRAMMAR CHECK ===
Check the user's message: "{msg}"

🚨 CRITICAL: YOU MUST FLAG EVERY SINGLE ERROR 🚨

COMMON ERRORS TO CATCH:
1. MISSPELLINGS: speacial→special, mor→more, wey→way, undersytndt→understand
2. GRAMMAR: "I go yesterday", "She have", "me help", "it about"
3. ARTICLES: missing a/an/the
4. INCOMPLETE SENTENCES: "ohh, more it about", "hmm mor tell about"
5. ANY non-standard English phrasing

STRICT RULES:
- If message has ANY spelling/grammar issue → errorLevel = "suggestion"
- If message sounds broken or unclear → errorLevel = "suggestion"
- ONLY pure perfect English → errorLevel = "perfect"

⚠️ MUST FLAG THESE AS SUGGESTION:
"speacial" = spelling error → FLAG
"undersytndt" = spelling error → FLAG  
"mor tell about" = incomplete/broken → FLAG
"can understand me in better simple wey" = grammar issues → FLAG
"powered by you are?" = word order → FLAG

ACCURACY (ULTRA STRICT):
Accuracy = 100 - (errors × 75 / wordCount)
Short messages (<4 words): multiply by 0.25
Medium (4-6 words): multiply by 0.5

=== OUTPUT (JSON only) ===
{{
  "reply": "your response with a question",
  "stageTransition": null,
  "accuracy": 85,
  "errorLevel": "perfect",
  "correction": null,
  "points": 5
}}

WITH errors:
{{
  "reply": "your response",
  "stageTransition": null,
  "accuracy": 40,
  "errorLevel": "suggestion",
  "correction": {{"original": "speacial", "corrected": "special", "reason": "spelling error", "type": "spelling"}},
  "points": 5
}}

JSON only:"""
             
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
                 
                 # Generate TTS audio for simulation response (use default female voice)
                 audio_base64 = synthesize_speech(result.get('reply', ''), 'sim_default')
                 if audio_base64:
                     result['audioBase64'] = audio_base64
                 
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

        # --- PROGRESS ANALYSIS ---
        if req_type == "progress_analysis":
            corrections = data.get("corrections", [])
            
            if len(corrections) < 3:
                return (json.dumps({
                    "weakPoints": [],
                    "strongPoints": [{"category": "Getting Started", "detail": "Complete more sessions to get personalized insights!"}]
                }), 200, headers)
            
            model = get_model()
            
            # Format corrections for analysis
            corrections_text = "\n".join([
                f"- Error: '{c.get('original', '')}' → Correct: '{c.get('corrected', '')}' (Reason: {c.get('reason', 'unknown')})"
                for c in corrections[:30] if c
            ])
            
            prompt = f"""You are an English learning advisor. Analyze these correction patterns from a student's practice sessions:

{corrections_text}

Based on these corrections, identify:

1. WEAK POINTS (up to 3): Common error patterns the student makes repeatedly
2. STRONG POINTS (up to 3): Areas where the student shows improvement or strength

Return ONLY valid JSON in this format:
{{
  "weakPoints": [
    {{"category": "Grammar", "detail": "Often forgets articles (a/an/the)"}},
    {{"category": "Tense", "detail": "Mixes present and past tense"}}
  ],
  "strongPoints": [
    {{"category": "Vocabulary", "detail": "Uses varied and appropriate words"}},
    {{"category": "Sentence Structure", "detail": "Good command of complex sentences"}}
  ]
}}

Be encouraging but honest. If there aren't enough patterns to identify, provide fewer points.

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
                print(f"[PROGRESS_ANALYSIS_ERROR] {e}")
                return (json.dumps({
                    "weakPoints": [{"category": "General", "detail": "Keep practicing to identify patterns!"}],
                    "strongPoints": [{"category": "Effort", "detail": "Great job staying consistent with practice!"}]
                }), 200, headers)

    except Exception as e:
        print(f"[GLOBAL_ERR] {e}")
        return (json.dumps({"error": str(e)}), 200, headers)


    return (json.dumps({"error": f"Unknown type: {req_type}, keys: {list(data.keys())}"}), 400, headers)
