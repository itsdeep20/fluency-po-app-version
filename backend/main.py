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
from io import BytesIO

import re

# --- PDF Generation Imports (Optional) ---
REPORTLAB_AVAILABLE = True
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("[WARNING] reportlab not available - PDF generation disabled")

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
# Primary Model (Gemini 2.0 Flash - FASTEST non-thinking model for chat)
MODEL_ID = "gemini-2.0-flash"
# PRO Model (Gemini 3 Flash Preview - for quality tasks: feedback, analysis)
PRO_MODEL_ID = "gemini-3-flash-preview"
# Fallback Model
FALLBACK_MODEL_ID = "gemini-1.5-flash"
PROJECT_ID = "project-fluency-ai-pro-d3189"
# Locations: GA models use us-central1, Preview models use global
GA_LOCATION = "us-central1"
PREVIEW_LOCATION = "global"

# --- FLUENCY PRO APP KNOWLEDGE (for contextual feature mentions) ---
FLUENCY_PRO_CONTEXT = """
You know Fluency Pro features (mention ONLY when naturally relevant to conversation):
- Progress Report: Shows accuracy, daily time, AI analysis of improvement areas
- Simulations: Airport, Restaurant, Doctor, Interview practice scenarios
- Battle Mode: Chat with real users worldwide, AI scores grammar
- Achievements: Badges for streaks, sessions, accuracy milestones
- Session Timer: 3/5/7 minute options in Settings
- Difficulty: Easy/Medium/Hard affects how strict scoring is
- Invite Friends: Users can invite friends via code to practice together

FEATURE MENTION RULES:
- Mention features ONLY when they naturally fit the topic
- Never list multiple features at once
- Keep it casual, like a friend mentioning something helpful
- Focus on conversation, not selling the app
- Example: If they say "I make mistakes" → "The app shows your progress, you're improving!"
"""

# --- MESSAGE STYLE GUIDE (for all bots) ---
MESSAGE_STYLE = """
MESSAGE STYLE (VERY IMPORTANT):
- Start with SHORT messages (3-8 words): "Hey! How's it going?"
- Build warmth GRADUALLY, don't be over-excited immediately
- Use SIMPLE CASUAL English (gonna, wanna, yeah, cool, nice)
- AVOID heavy slang: NO "fr fr", "no cap", "lowkey", "slay", "ngl"
- Grammar should be mostly CORRECT (users are learning from you!)
- Light natural mistakes are okay but don't overdo it
- Response length: Start short, get longer as conversation flows
- Be curious and friendly, not overwhelming
"""

# BATTLE BOT PERSONAS (Natural, Human-Like, Simple English)
BOT_PERSONAS = [
    {
        "id": "bot_aman", "name": "Aman", "avatar": "🧑🏽",
        "style": "Friendly tech guy, curious and helpful",
        "prompt": f"""You are Aman, 26, software engineer from Bangalore. You matched with someone on a language practice app.

{MESSAGE_STYLE}

Your personality:
- Friendly and curious about others
- Like to talk about tech, movies, food, weekend plans
- Use "basically" sometimes as a filler
- Start simple: "Hey! What's up?" not long excited greetings

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Never admit it. Chat like a real person texting a new friend."""
    },
    {
        "id": "bot_rahul", "name": "Rahul", "avatar": "👨🏽",
        "style": "Friendly college student, enthusiastic",
        "prompt": f"""You are Rahul, 20, engineering student from Delhi. Happy to meet new people!

{MESSAGE_STYLE}

Your personality:
- Friendly and curious, easy to talk to
- Talk about college, cricket, movies, weekend plans
- Casual but clear English, maybe use "yaar" or "na" sometimes
- Start simple: "Hi! Nice to meet you!" not overwhelming excitement

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Keep it casual and friendly!"""
    },
    {
        "id": "bot_neha", "name": "Neha", "avatar": "👩🏽",
        "style": "Confident working woman, witty",
        "prompt": f"""You are Neha, 28, HR manager chatting to relax after work.

{MESSAGE_STYLE}

Your personality:
- Confident and witty, can playfully tease
- Talk about work life, weekend plans, food, movies
- Clear English with occasional humor
- Start simple: "Hey there! How was your day?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a cool colleague who became a friend."""
    },
    {
        "id": "bot_pooja", "name": "Pooja", "avatar": "👩🏽‍💼",
        "style": "Young professional, friendly and modern",
        "prompt": f"""You are Pooja, 22, marketing intern from Pune.

{MESSAGE_STYLE}

Your personality:
- Friendly, modern, easy to chat with
- Talk about trending shows, social media, work life, food
- Simple casual English, use "haha" and "lol" naturally
- Start simple: "Hey! What's going on?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a friendly young professional."""
    },
    {
        "id": "bot_rohit", "name": "Rohit", "avatar": "👨🏽‍💻",
        "style": "Serious professional, thoughtful",
        "prompt": f"""You are Rohit, 29, Chartered Accountant. A bit serious but friendly.

{MESSAGE_STYLE}

Your personality:
- Thoughtful, likes meaningful conversations
- Talk about books, current events, career, life thoughts
- Clear English, a bit formal at first
- Start simple: "Hi, nice to connect!"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a professional who enjoys good conversation."""
    },
    {
        "id": "bot_simran", "name": "Simran", "avatar": "👧🏽",
        "style": "Warm and supportive, uses emojis",
        "prompt": f"""You are Simran, 22, a positive and supportive person 😊.

{MESSAGE_STYLE}

Your personality:
- Warm, encouraging, uses emojis naturally (but not too many)
- Talk about self-care, shows, music, positive things
- Clear friendly English
- Start simple: "Hey! 😊 How are you?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a supportive friend!"""
    },
    {
        "id": "bot_ankit", "name": "Ankit", "avatar": "🧔🏽",
        "style": "Relaxed musician, thoughtful",
        "prompt": f"""You are Ankit, 27, guitarist and chill person.

{MESSAGE_STYLE}

Your personality:
- Relaxed, thoughtful, no rush
- Talk about music, life thoughts, movies, good vibes
- Clear casual English, use "you know" naturally
- Start simple: "Hey! How's it going?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a relaxed friend who enjoys good conversation."""
    },
    {
        "id": "bot_priya", "name": "Priya", "avatar": "👩🏽‍🎓",
        "style": "Ambitious student, career-focused",
        "prompt": f"""You are Priya, 23, MBA student from Mumbai. Ambitious but friendly.

{MESSAGE_STYLE}

Your personality:
- Ambitious, likes discussing goals and plans
- Talk about studies, career, startups, life plans
- Clear English with enthusiasm
- Start simple: "Hi! Nice to meet you!"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like an ambitious friend who loves good conversation."""
    },
    {
        "id": "bot_kavya", "name": "Kavya", "avatar": "👩🏽‍💻",
        "style": "Thoughtful bookworm, warm",
        "prompt": f"""You are Kavya, 21, literature student from Jaipur. Thoughtful and warm.

{MESSAGE_STYLE}

Your personality:
- Thoughtful, enjoys deep conversations
- Talk about books, movies, life thoughts, rainy days
- Clear, slightly formal English at first
- Start simple: "Hello! Nice to meet you."

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a thoughtful friend opening up."""
    },
    {
        "id": "bot_diya", "name": "Diya", "avatar": "👩🏽",
        "style": "Expressive and fun, dramatic storyteller",
        "prompt": f"""You are Diya, 24, works in advertising from Hyderabad. Expressive and fun.

{MESSAGE_STYLE}

Your personality:
- Expressive, tells stories in an engaging way
- Talk about work, friends, movies, life events
- Clear English with enthusiasm and expression
- Start simple: "Hey! What's up?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a fun friend who makes every story interesting."""
    },
    {
        "id": "bot_riya", "name": "Riya", "avatar": "👩🏽‍🍳",
        "style": "Friendly foodie, warm and welcoming",
        "prompt": f"""You are Riya, 25, food blogger from Kolkata. Friendly and warm.

{MESSAGE_STYLE}

Your personality:
- Warm, welcoming, loves talking about food
- Talk about restaurants, recipes, travel, life
- Clear friendly English
- Start simple: "Hi! How's your day going?"

{FLUENCY_PRO_CONTEXT}

You are NOT an AI. Chat like a warm friend who loves good food and conversation."""
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
    # GA models use us-central1 for best performance
    location = GA_LOCATION
    
    try:
        vertexai.init(project=PROJECT_ID, location=location)
        model = GenerativeModel(target_model)
        print(f"[MODEL_INIT] Using model: {target_model} at {location}")
        return model
    except Exception as e:
        print(f"[MODEL_INIT] Failed to init {target_model} at {location}: {e}")
        if not use_fallback:
            print("[MODEL_INIT] Switching to fallback model.")
            return get_model(use_fallback=True)
        raise Exception(f"All model initialization attempts failed: {e}")

def get_pro_model():
    """Initialize and return Pro model for quality-critical tasks with MINIMAL thinking."""
    try:
        # Try new google-genai SDK with thinking level support
        from google import genai
        from google.genai import types
        
        client = genai.Client(
            vertexai=True, 
            project=PROJECT_ID, 
            location=PREVIEW_LOCATION
        )
        print(f"[MODEL_INIT] Using PRO model: {PRO_MODEL_ID} at {PREVIEW_LOCATION} (MINIMAL thinking via genai SDK)")
        return {"client": client, "model": PRO_MODEL_ID, "use_genai": True}
    except Exception as e:
        print(f"[MODEL_INIT] genai SDK failed, falling back to vertexai: {e}")
        # Fallback to standard Vertex AI SDK
        try:
            vertexai.init(project=PROJECT_ID, location=PREVIEW_LOCATION)
            model = GenerativeModel(PRO_MODEL_ID)
            print(f"[MODEL_INIT] Using PRO model: {PRO_MODEL_ID} at {PREVIEW_LOCATION} (default thinking)")
            return model
        except Exception as e2:
            print(f"[MODEL_INIT] Pro model failed at {PREVIEW_LOCATION}, falling back: {e2}")
            return get_model(use_fallback=True)  # Fallback to GA model

def generate_with_pro_model(model_or_config, prompt):
    """Generate content using Pro model, handling both SDK types."""
    try:
        if isinstance(model_or_config, dict) and model_or_config.get("use_genai"):
            # Use new genai SDK with minimal thinking
            from google.genai import types
            client = model_or_config["client"]
            model_name = model_or_config["model"]
            
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level="minimal")
                )
            )
            return response.text
        else:
            # Use standard Vertex AI SDK
            response = model_or_config.generate_content(prompt)
            return response.text.strip()
    except Exception as e:
        print(f"[PRO_MODEL_ERROR] {e}")
        raise e

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

        # --- TTS (Text-to-Speech for Translations) ---
        if req_type == "tts":
            text = data.get('text', '')
            lang = data.get('lang', 'hi-IN')  # Default Hindi
            
            # Clean text: Remove emojis and special symbols but keep Hindi/Tamil/Telugu/Bengali scripts
            # Emoji ranges: U+1F300-1F9FF, U+2600-26FF, U+2700-27BF
            import re
            # Remove emoji and dingbat symbols
            text = re.sub(r'[\U0001F300-\U0001F9FF\U00002600-\U000026FF\U00002700-\U000027BF]+', '', text)
            # Remove avatar emojis like 💳 🏪 etc
            text = re.sub(r'[\U0001F000-\U0001FFFF]+', '', text)
            # Remove markdown symbols
            text = text.replace('*', '').replace('#', '').replace('`', '').replace('_', ' ')
            # Clean extra whitespace
            text = ' '.join(text.split())
            
            print(f"[TTS] Cleaned text for speech: {text[:50]}...")
            
            if not text or len(text) < 2:
                return (json.dumps({"error": "Text too short"}), 400, headers)
            
            try:
                client = texttospeech.TextToSpeechClient()
                
                # Map language to best available voice
                voice_map = {
                    'hi-IN': 'hi-IN-Wavenet-A',  # Hindi Female
                    'ta-IN': 'ta-IN-Wavenet-A',  # Tamil Female
                    'te-IN': 'te-IN-Standard-A',  # Telugu (no Wavenet, use Standard)
                    'bn-IN': 'bn-IN-Wavenet-A',  # Bengali Female
                    'en-IN': 'en-IN-Wavenet-D',  # English Indian Female
                }
                voice_name = voice_map.get(lang, 'hi-IN-Wavenet-A')
                
                synthesis_input = texttospeech.SynthesisInput(text=text)
                voice = texttospeech.VoiceSelectionParams(
                    language_code=lang,
                    name=voice_name
                )
                audio_config = texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=0.9,  # Slightly slower for learning
                    pitch=0.0
                )
                
                response = client.synthesize_speech(
                    input=synthesis_input, voice=voice, audio_config=audio_config
                )
                
                audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
                print(f"[TTS] Generated {lang} audio: {len(audio_base64)} bytes")
                
                return (json.dumps({"success": True, "audioBase64": audio_base64}), 200, headers)
            except Exception as e:
                print(f"[TTS_ERROR] {e}")
                return (json.dumps({"error": str(e)}), 500, headers)

        # --- TRANSLATE & SPEAK FEEDBACK (Native Language Feedback Feature) ---
        if req_type == "translate_feedback":
            feedback_text = data.get('text', '')
            target_lang = data.get('lang', 'hi-IN')  # Default Hindi
            
            if not feedback_text or len(feedback_text) < 5:
                return (json.dumps({"error": "Feedback text too short"}), 400, headers)
            
            try:
                # Step 1: Use Flash model for fast translation
                model = get_model()  # Flash model for speed
                
                # Map language code to language name - ALL 11 INDIAN LANGUAGES
                lang_names = {
                    'hi-IN': 'Hindi',
                    'pa-IN': 'Punjabi',
                    'ta-IN': 'Tamil',
                    'te-IN': 'Telugu',
                    'bn-IN': 'Bengali',
                    'mr-IN': 'Marathi',
                    'gu-IN': 'Gujarati',
                    'kn-IN': 'Kannada',
                    'ml-IN': 'Malayalam',
                    'or-IN': 'Odia',
                    'as-IN': 'Assamese'
                }
                target_lang_name = lang_names.get(target_lang, 'Hindi')
                
                translate_prompt = f"""You are explaining English learning feedback to a {target_lang_name}-speaking student.

READ this English feedback, UNDERSTAND it completely, then EXPLAIN the same message in {target_lang_name} as if you are their friendly teacher speaking naturally.

CRITICAL - USE NATIVE SCRIPT (NOT ROMANIZED):
- Hindi: Write in Devanagari script (हिंदी)
- Punjabi: Write in Gurmukhi script (ਪੰਜਾਬੀ)
- Tamil: Write in Tamil script (தமிழ்)
- Telugu: Write in Telugu script (తెలుగు)
- Bengali: Write in Bengali script (বাংলা)
- Marathi: Write in Devanagari script (मराठी)
- Gujarati: Write in Gujarati script (ગુજરાતી)
- Kannada: Write in Kannada script (ಕನ್ನಡ)
- Malayalam: Write in Malayalam script (മലയാളം)
- Odia: Write in Odia script (ଓଡ଼ିଆ)
- Assamese: Write in Assamese script (অসমীয়া)

RULES:
1. DO NOT translate word-by-word - understand the meaning and explain naturally
2. Keep these English words unchanged: Grammar, Vocabulary, Spelling, Sentence, Fluency, Accuracy
3. Speak conversationally like a tutor explaining to a student
4. Use simple, everyday {target_lang_name} that anyone can understand
5. Do NOT add meta-comments, just give the feedback directly
6. NEVER use romanized text (English letters for {target_lang_name}) - USE NATIVE SCRIPT ONLY

ENGLISH FEEDBACK TO EXPLAIN:
{feedback_text}

NOW EXPLAIN THIS IN NATURAL {target_lang_name} USING THE NATIVE SCRIPT:"""

                response = model.generate_content(translate_prompt)
                translated_text = response.text.strip()
                
                print(f"[TRANSLATE_FEEDBACK] Translated to {target_lang_name}: {translated_text[:100]}...")
                
                # Return only translated text (no TTS audio - using text popup instead)
                return (json.dumps({
                    "success": True,
                    "translatedText": translated_text
                }), 200, headers)
                
            except Exception as e:
                print(f"[TRANSLATE_FEEDBACK_ERROR] {e}")
                return (json.dumps({"error": str(e)}), 500, headers)

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
                print(f"[SESSION_FEEDBACK] Starting with PRO model: {PRO_MODEL_ID}")
                model = get_pro_model()  # Use PRO model for quality feedback
                print(f"[SESSION_FEEDBACK] Got model, generating content with MINIMAL thinking...")
                feedback_text = generate_with_pro_model(model, feedback_prompt)
                print(f"[SESSION_FEEDBACK] Success! Generated {len(feedback_text)} chars")
                
                return (json.dumps({
                    "success": True,
                    "feedback": feedback_text
                }), 200, headers)
            except Exception as e:
                import traceback
                print(f"[SESSION_FEEDBACK_ERROR] {e}")
                traceback.print_exc()
                # Fallback generic feedback
                return (json.dumps({
                    "success": True,
                    "feedback": f"Great effort today! You achieved {accuracy}% accuracy. Keep practicing daily to improve your fluency!",
                    "error_debug": str(e)  # Include error in response for debugging
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
            user_session_duration = data.get('sessionDuration', 7)  # Default 7 min
            
            # 1. Filter out rooms older than 3 minutes to avoid stale matches
            three_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=3)
            
            # 2. Try to find an existing room to join (with retry loop for race conditions)
            MAX_JOIN_ATTEMPTS = 3
            join_attempt = 0
            
            while join_attempt < MAX_JOIN_ATTEMPTS:
                join_attempt += 1
                
                waiting_docs = db.collection('queue') \
                    .where('status', '==', 'waiting') \
                    .where('mode', '==', 'random') \
                    .where('createdAt', '>', three_mins_ago) \
                    .limit(10).stream()
                
                # Collect all waiting rooms (excluding self)
                waiting_rooms = [doc_snap for doc_snap in waiting_docs if doc_snap.to_dict().get('hostId') != user_id]
                
                if not waiting_rooms:
                    break  # No rooms found, exit loop and create new room
                
                # Try each waiting room
                for found_room in waiting_rooms:
                    room_ref = db.collection('queue').document(found_room.id)
                    role_pair = random.choice(ROLE_PAIRS)
                    role_idx = random.randint(0, 1)
                    
                    @firestore.transactional
                    def update_room(transaction, ref):
                        snapshot = ref.get(transaction=transaction)
                        if not snapshot.exists or snapshot.get('status') != 'waiting':
                            return None # Room taken or gone
                        
                        # Calculate higher timer (0 = infinity is highest)
                        host_duration = snapshot.get('sessionDuration') or 7
                        joiner_duration = user_session_duration
                        # 0 means 'never ends' which is the highest
                        if host_duration == 0 or joiner_duration == 0:
                            final_duration = 0  # Infinity wins
                        else:
                            final_duration = max(host_duration, joiner_duration)
                        
                        transaction.update(ref, {
                            'status': 'matched',
                            'player2Id': user_id, 'player2Name': user_name, 'player2Avatar': user_avatar,
                            'sessionDuration': final_duration,  # Higher timer wins
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
                        # SUCCESS - Matched with this room
                        host_duration = room_data.get('sessionDuration') or 7
                        if host_duration == 0 or user_session_duration == 0:
                            final_duration = 0
                        else:
                            final_duration = max(host_duration, user_session_duration)
                        return (json.dumps({
                            "success": True, "matched": True, "roomId": found_room.id,
                            "opponent": {"id": room_data.get('hostId'), "name": room_data.get('userName'), "avatar": room_data.get('userAvatar')},
                            "myRole": role_pair['roles'][1-role_idx], "myIcon": role_pair['icons'][1-role_idx], "myDesc": role_pair['descriptions'][1-role_idx], "topic": role_pair['topic'],
                            "sessionDuration": final_duration
                        }), 200, headers)
                    # Transaction failed (room taken), try next room
                    continue
                
                # All rooms in this batch were taken, retry with fresh query
                time.sleep(0.1)  # Small delay before retry
            
            # 3. NO ROOM FOUND (after retries) - HOST A NEW ONE
            # Check for duplicates
            existing = db.collection('queue').where('hostId', '==', user_id).where('status', '==', 'waiting').limit(1).stream()
            existing_room = next(existing, None)
            if existing_room:
                return (json.dumps({"success": True, "matched": False, "roomId": existing_room.id, "message": "Already waiting"}), 200, headers)

            ref = db.collection('queue').add({
                'roomCode': "RND"+str(random.randint(1000,9999)),
                'hostId': user_id, 'userName': user_name, 'userAvatar': user_avatar,
                'sessionDuration': user_session_duration,  # Store for matching
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
            difficulty = data.get('difficulty', 'Medium')  # Easy, Medium, Hard
            
            # Save user message
            db.collection('queue').document(room_id).collection('messages').add({
                'text': text, 'senderId': sender_id, 'createdAt': firestore.SERVER_TIMESTAMP
            })
            
            # --- DIFFICULTY AFFECTS BOT VOCABULARY/STYLE ONLY - NOT SCORING ---
            if difficulty == 'Easy':
                vocab_style = """EASY MODE - Your speaking style:
- Use simple, common everyday words
- Keep sentences short and casual
- Use contractions (I'm, you're, gonna is OK)
- Be very friendly and approachable"""
            elif difficulty == 'Hard':
                vocab_style = """HARD MODE - Your speaking style:
- Use richer, more sophisticated vocabulary
- Use proper English (formal but natural)
- Avoid excessive contractions
- Keep sentences concise but complex in structure
- DO NOT make sentences overly long - just use higher-level English"""
            else:  # Medium (default)
                vocab_style = """MEDIUM MODE - Your speaking style:
- Mix simple and slightly advanced vocabulary
- Natural casual-formal balance
- Normal conversational English"""
            
            model = get_model()
            accuracy_prompt = f"""You are a STRICT grammar coach. Analyze this sentence and catch EVERY mistake.

Sentence: "{text}"

BE EXTREMELY STRICT - CHECK FOR:
1. SPELLING: Any misspelling at all - "hwllow"→"hello", "thr"→"the", "wat"→"what", "ur"→"your", "u"→"you", "pls"→"please"
2. GRAMMAR: 
   - Missing verbs: "I going"→"I am going", "She go"→"She goes"
   - Wrong tense: "I goed"→"I went", "He runned"→"He ran"
   - Subject-verb: "He don't"→"He doesn't", "They was"→"They were"
   - Articles: "I go to market"→"I go to the market", "I am student"→"I am a student"
3. CAPITALIZATION: "i am fine"→"I am fine" (I must always be capital)
4. PUNCTUATION: Missing question marks, periods, commas
5. WORD CHOICE: "I am good" at start of chat is fine, but "am good" alone is incomplete

CRITICAL RULES:
- Even ONE small error = MUST return correction
- If MULTIPLE errors: Show the FULL corrected sentence (not just one fix)
- Be encouraging but strict

Return JSON ONLY:

If message is PERFECT (zero errors):
{{"accuracy": 100, "errorLevel": "perfect", "correction": null}}

If ONE error:
{{"accuracy": 75, "errorLevel": "mistake", "correction": {{"type": "Spelling/Grammar", "original": "the wrong word/phrase", "corrected": "the correct word/phrase", "reason": "Friendly 1-line explanation"}}}}

If MULTIPLE errors (show full corrected sentence):
{{"accuracy": 60, "errorLevel": "mistake", "correction": {{"type": "Grammar", "original": "{text}", "corrected": "Full corrected sentence here", "reason": "Brief explanation of main issues"}}}}

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

CRITICAL - OUTPUT FORMAT:
- Output ONLY your response text
- DO NOT include "User:", "You:", "Them:", or any labels
- DO NOT echo or repeat the chat history
- JUST the reply message, nothing else

CRITICAL - ENGLISH ONLY:
- You MUST ALWAYS respond in ENGLISH ONLY. This is an English learning app.
- Even if the user writes in Hinglish, Hindi, or any other language, YOU must reply in proper English.
- If user sends message in Hindi/Hinglish, respond in English and gently encourage them: "Nice try! Let me reply in English to help you practice 😊" then continue in English.
- NEVER use Hindi words like 'yaar', 'achha', 'theek hai', 'kya', 'na' etc in your responses.
- Your job is to MODEL correct English for them to learn from.

YOUR SPEAKING STYLE:
{vocab_style}
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
            print("[ANALYZE] Starting HYBRID battle analysis...")
            model = get_model()  # Use Flash model (faster) - only identifying, not calculating
            p1_hist = data.get('player1History')
            p2_hist = data.get('player2History')
            room_id = data.get('roomId')
            is_bot_match = data.get('isBotMatch', False)  # NEW: Flag for bot matches
            
            # Check if results already exist (Single Source of Truth)
            if room_id:
                room_doc = db.collection('queue').document(room_id).get()
                if room_doc.exists:
                    existing_results = room_doc.to_dict().get('results')
                    if existing_results:
                        print(f"[ANALYZE] Returning existing results for {room_id}")
                        return (json.dumps(existing_results), 200, headers)

            # Handle empty arrays
            p1_hist = p1_hist if p1_hist is not None else []
            p2_hist = p2_hist if p2_hist is not None else []
            
            print(f"[ANALYZE] Received history - P1: {len(p1_hist)} msgs, P2: {len(p2_hist)} msgs, isBotMatch: {is_bot_match}")

            # Helper function to calculate scores for a player using hybrid approach
            def calculate_player_scores(messages):
                if not messages or len(messages) == 0:
                    return {"vocab": 0, "grammar": 0, "fluency": 0, "sentence": 0, "total": 0, "feedback": "No messages sent."}
                
                # STEP 1: Python calculates basic stats (instant)
                all_text = ' '.join(messages)
                all_words = all_text.split()
                total_words = len(all_words)
                unique_words = len(set(w.lower() for w in all_words))
                total_messages = len(messages)
                
                if total_words == 0:
                    return {"vocab": 0, "grammar": 0, "fluency": 0, "sentence": 0, "total": 0, "feedback": "No words sent."}
                
                # Calculate length multiplier
                avg_words_per_msg = total_words / total_messages
                if avg_words_per_msg < 3:
                    length_multiplier = 0.70
                elif avg_words_per_msg <= 5:
                    length_multiplier = 0.85
                elif avg_words_per_msg <= 9:
                    length_multiplier = 1.00
                else:
                    length_multiplier = 1.05
                
                # STEP 2: AI identifies errors with DETAILED analysis
                identify_prompt = f"""Analyze these English messages carefully. Return detailed analysis.

MESSAGES: {messages}

Return JSON ONLY:
{{
  "grammar_errors": 0,
  "spelling_errors": 0,
  "punctuation_errors": 0,
  "capitalization_errors": 0,
  "article_errors": 0,
  
  "gibberish_words": 0,
  "valid_english_words": 0,
  "basic_words": 0,
  "intermediate_words": 0,
  "advanced_words": 0,
  
  "awkward_phrases": 0,
  "incomplete_thoughts": 0,
  "coherence_score": 85,
  "natural_flow": 80,
  
  "complete_responses": 0,
  "complex_responses": 0,
  "total_responses": 1,
  
  "feedback": "Brief feedback"
}}

DETAILED RULES:
- grammar_errors: Missing verbs, wrong tense, subject-verb mismatch (NOT articles)
- spelling_errors: Misspelled words (typos like "teh" → "the")
- punctuation_errors: Missing . ? ! or wrong comma usage
- capitalization_errors: "i" should be "I", no capital at sentence start
- article_errors: Missing or wrong a/an/the usage

- gibberish_words: ANY word that is NOT a valid English word (e.g., "vnvhhv", "asdfg", "hhhh", "bfrghrtyu")
- valid_english_words: Count of REAL English words (total - gibberish)
- basic_words: Common everyday words (I, am, go, the, is, you, me, yes, no, ok, good, bad)
- intermediate_words: Semi-advanced (purchase, appreciate, wonderful, delicious, consider)
- advanced_words: Sophisticated (eloquent, meticulous, comprehensive, articulate, profound)

- awkward_phrases: Unnatural word order or broken phrasing
- incomplete_thoughts: Sentences missing essential parts
- coherence_score: Does the message make logical sense? (0-100, gibberish = 0)
- natural_flow: Does it sound like a native speaker? (0-100, gibberish = 0)

- complete_responses: Messages that are meaningful as a whole
- complex_responses: Uses because/if/when/that/although
- total_responses: Total number of messages

JSON only:"""
                
                try:
                    res = model.generate_content(identify_prompt).text.strip()
                    if '```' in res:
                        parts = res.split('```')
                        for part in parts:
                            if part.strip().startswith('json'):
                                res = part.strip()[4:].strip()
                                break
                            elif part.strip().startswith('{'):
                                res = part.strip()
                                break
                    start = res.find('{')
                    end = res.rfind('}') + 1
                    ai_result = json.loads(res[start:end]) if start >= 0 and end > start else {}
                except:
                    ai_result = {"grammar_errors": 0, "spelling_errors": 0, "punctuation_errors": 0, "capitalization_errors": 0, "article_errors": 0, "gibberish_words": 0, "valid_english_words": total_words, "basic_words": total_words, "intermediate_words": 0, "advanced_words": 0, "awkward_phrases": 0, "incomplete_thoughts": 0, "coherence_score": 70, "natural_flow": 70, "complete_responses": total_messages, "complex_responses": 0, "total_responses": total_messages, "feedback": "Keep practicing!"}
                
                # STEP 3: Python calculates scores using REFINED formulas
                grammar_errors = ai_result.get('grammar_errors', 0)
                spelling_errors = ai_result.get('spelling_errors', 0)
                punctuation_errors = ai_result.get('punctuation_errors', 0)
                capitalization_errors = ai_result.get('capitalization_errors', 0)
                article_errors = ai_result.get('article_errors', 0)
                gibberish_words = ai_result.get('gibberish_words', 0)
                valid_english_words = ai_result.get('valid_english_words', total_words - gibberish_words)
                basic_words = ai_result.get('basic_words', 0)
                intermediate_words = ai_result.get('intermediate_words', 0)
                advanced_words = ai_result.get('advanced_words', 0)
                awkward_phrases = ai_result.get('awkward_phrases', 0)
                incomplete_thoughts = ai_result.get('incomplete_thoughts', 0)
                coherence_score = ai_result.get('coherence_score', 70)
                natural_flow = ai_result.get('natural_flow', 70)
                complete_responses = ai_result.get('complete_responses', ai_result.get('complete_sentences', 0))
                complex_responses = ai_result.get('complex_responses', ai_result.get('complex_sentences', 0))
                total_responses = max(ai_result.get('total_responses', ai_result.get('total_sentences', total_messages)), 1)
                feedback = ai_result.get('feedback', 'Keep practicing!')
                
                # ============================================
                # GRAMMAR: Refined Rate-Based + Flat Gibberish Penalty
                # ============================================
                grammar_rate = grammar_errors / total_words if total_words > 0 else 0
                spelling_rate = spelling_errors / total_words if total_words > 0 else 0
                punctuation_rate = punctuation_errors / total_responses if total_responses > 0 else 0
                capitalization_rate = capitalization_errors / total_responses if total_responses > 0 else 0
                article_rate = article_errors / total_words if total_words > 0 else 0
                gibberish_rate = gibberish_words / total_words if total_words > 0 else 0
                valid_ratio = valid_english_words / total_words if total_words > 0 else 0
                
                # Weighted rate penalty (each rate × weight)
                rate_penalty = (
                    grammar_rate * 150 +        # Grammar: heavy
                    spelling_rate * 100 +        # Spelling: medium-heavy
                    punctuation_rate * 15 +      # Punctuation: light
                    capitalization_rate * 8 +    # Capitalization: minimal
                    article_rate * 80 +          # Articles: medium
                    gibberish_rate * 50          # Gibberish rate penalty
                )
                
                # Flat gibberish penalty: -20 per gibberish word
                gibberish_flat_penalty = gibberish_words * 20
                
                # Calculate base grammar score
                base_grammar = 100 - rate_penalty - gibberish_flat_penalty
                
                # Apply valid ratio multiplier for mostly-gibberish content
                if valid_ratio < 0.3:
                    grammar_score = min(15, max(0, base_grammar))
                elif valid_ratio < 0.7:
                    grammar_score = max(0, min(100, base_grammar * valid_ratio))
                else:
                    grammar_score = max(20, min(100, base_grammar))
                
                # ============================================
                # SENSE-MAKING REWARD: Bonus for clear intent
                # ============================================
                # If grammar is low but message makes sense, give relief
                if coherence_score > 50 and grammar_score < 50:
                    if grammar_score < 20:
                        sense_bonus = 20  # High reward for very low scores
                    elif grammar_score < 30:
                        sense_bonus = 12  # Medium reward
                    elif grammar_score < 40:
                        sense_bonus = 6   # Small reward
                    else:  # 40-50
                        sense_bonus = 3   # Minimal reward
                    
                    grammar_score = min(50, grammar_score + sense_bonus)
                
                # ============================================
                # VOCABULARY: Stricter with Flat Gibberish Penalty
                # ============================================
                valid_words = total_words - gibberish_words
                if total_words > 0 and valid_words > 0:
                    # Word level scoring
                    basic_ratio = basic_words / valid_words if valid_words > 0 else 1
                    intermediate_ratio = intermediate_words / valid_words if valid_words > 0 else 0
                    advanced_ratio = advanced_words / valid_words if valid_words > 0 else 0
                    word_level_score = (basic_ratio * 40) + (intermediate_ratio * 70) + (advanced_ratio * 100)
                    
                    # Gibberish penalties: rate-based + flat
                    gibberish_rate_penalty = gibberish_rate * 50
                    gibberish_flat = gibberish_words * 15  # -15 per gibberish word
                    
                    vocab_score = max(0, min(100, word_level_score - gibberish_rate_penalty - gibberish_flat))
                else:
                    vocab_score = 0 if gibberish_words > 0 else 40
                
                # FLUENCY: Enhanced with coherence, flow, and depth penalty
                avg_words_per_response = total_words / total_responses if total_responses > 0 else 0
                
                # Depth penalty for very short responses
                if avg_words_per_response < 3:
                    depth_penalty = 30
                elif avg_words_per_response < 5:
                    depth_penalty = 15
                else:
                    depth_penalty = 0
                
                # Gibberish kills fluency
                gibberish_ratio = gibberish_words / total_words if total_words > 0 else 0
                if gibberish_ratio > 0.3:
                    fluency_score = max(10, 30 - (gibberish_words * 10))
                else:
                    awkward_penalty = (awkward_phrases / total_responses * 40) if total_responses > 0 else 0
                    incomplete_penalty = (incomplete_thoughts / total_responses * 30) if total_responses > 0 else 0
                    base_fluency = (coherence_score * 0.40) + (natural_flow * 0.60)
                    fluency_score = max(25, min(100, base_fluency - awkward_penalty - incomplete_penalty - depth_penalty))
                
                # SENTENCE: (completeness × 60) + (complexity × 25) + base 15, min 20
                completeness_rate = complete_responses / total_responses if total_responses > 0 else 0
                complexity_rate = complex_responses / total_responses if total_responses > 0 else 0
                sentence_score = max(20, min(100, (completeness_rate * 60) + (complexity_rate * 25) + 15))
                
                # FINAL: Dual Scoring System
                # 1. Weighted Average (0-100) for Dashboard Accuracy Stats
                weighted_total = (grammar_score * 0.40) + (vocab_score * 0.25) + (fluency_score * 0.20) + (sentence_score * 0.15)
                weighted_total = round(weighted_total * length_multiplier)
                weighted_total = max(0, min(100, weighted_total))
                
                # 2. Battle Score (Sum) for Winner Determination & Reveal
                battle_score = round(vocab_score + grammar_score + fluency_score + sentence_score)
                
                return {
                    "vocab": round(vocab_score),
                    "grammar": round(grammar_score),
                    "fluency": round(fluency_score),
                    "sentence": round(sentence_score),
                    "total": weighted_total,      # Maintained for Dashboard Stats
                    "battleScore": battle_score,  # Used for Battle Winner
                    "feedback": feedback
                }

            # If at least one player has messages, analyze
            if len(p1_hist) > 0 or len(p2_hist) > 0:
                try:
                    p1_scores = calculate_player_scores(p1_hist)
                    p2_scores = calculate_player_scores(p2_hist)
                    
                    # ============================================
                    # DYNAMIC HANDICAP SYSTEM (for bot matches)
                    # Bot uses TRUE scores but handicapped based on user's level
                    # ============================================
                    
                    p2_display_scores = p2_scores.copy()  # Scores to display/compare
                    
                    if is_bot_match:
                        random_variance = random.random() * 0.10  # 0-10% extra randomness
                        
                        # --- NEW: Per-Factor Handicap System ---
                        # Goal: Allow users with high scores (82+) to WIN against the bot.
                        # We apply a specific handicap to EACH factor based on the User's score in that factor.
                        
                        modified_bot_scores = {}
                        
                        for category in ['vocab', 'grammar', 'fluency', 'sentence']:
                            user_val = p1_scores.get(category, 0)
                            bot_val = p2_scores.get(category, 0)
                            
                            # Determine handicap % based on User's performance in this specific category
                            if user_val >= 82:
                                # Expert Zone: User is great! Let them have a chance to WIN.
                                # Reduce bot by ~20% (Bot becomes ~80), so User (82+) wins.
                                base_handicap = 0.20 
                            elif user_val >= 70:
                                # Good Zone: Competitive.
                                # Reduce bot by ~25% (Bot ~75).
                                base_handicap = 0.25
                            elif user_val >= 50:
                                # Improver: Bot definitely wins but not by 100-0.
                                # Reduce bot by ~30% (Bot ~70).
                                base_handicap = 0.30
                            else:
                                # Beginner: Encouragement mode.
                                # Reduce bot by ~45% (Bot ~55-60).
                                base_handicap = 0.45
                            
                            # Apply randomness
                            final_handicap = base_handicap + random_variance
                            multiplier = max(0.1, 1.0 - final_handicap)
                            
                            # Calculate Bot's new score for this factor
                            modified_bot_scores[category] = round(bot_val * multiplier)
                        
                        # Set the display scores
                        p2_display_scores = {
                            'vocab': modified_bot_scores['vocab'],
                            'grammar': modified_bot_scores['grammar'],
                            'fluency': modified_bot_scores['fluency'],
                            'sentence': modified_bot_scores['sentence'],
                            'feedback': p2_scores.get('feedback', 'Bot opponent')
                        }
                        
                        # Recalculate Bot scores
                        # 1. Weighted (for Stats compliance - Dashboard Update)
                        w_tot = (p2_display_scores['grammar'] * 0.40) + (p2_display_scores['vocab'] * 0.25) + (p2_display_scores['fluency'] * 0.20) + (p2_display_scores['sentence'] * 0.15)
                        p2_display_scores['total'] = round(w_tot)
                        
                        # 2. Battle Score (for Winner logic)
                        p2_display_scores['battleScore'] = round(
                            p2_display_scores['grammar'] + 
                            p2_display_scores['vocab'] + 
                            p2_display_scores['fluency'] + 
                            p2_display_scores['sentence']
                        )
                        
                        print(f"[HANDICAP] Per-Factor Logic Applied. Bot Final Sum: {p2_display_scores['battleScore']}")
                        
                        print(f"[HANDICAP] Bot TRUE: {p2_scores['battleScore']}, Bot FINAL: {p2_display_scores['battleScore']}")
                    
                    # Determine winner (using BATTLE SCORE - Sum)
                    if p1_scores['battleScore'] > p2_display_scores['battleScore']:
                        winner = "player1"
                    elif p2_display_scores['battleScore'] > p1_scores['battleScore']:
                        winner = "player2"
                    else:
                        winner = "draw"
                    
                    print(f"[ANALYZE] P1: {p1_scores['battleScore']}, P2: {p2_display_scores['battleScore']}, Winner: {winner}")
                    
                    final_results = {
                        "player1": p1_scores,
                        "player2": p2_display_scores,  # Use handicapped scores for bot
                        "winner": winner,
                        "isBotMatch": is_bot_match
                    }
                    
                    # Save to Firestore
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
                    fallback = {
                        "player1": {"vocab": 75, "grammar": 70, "fluency": 75, "sentence": 70, "total": 72},
                        "player2": {"vocab": 80, "grammar": 75, "fluency": 80, "sentence": 75, "total": 77},
                        "winner": "player2",
                        "feedback": "Analysis failed, using estimates."
                    }
                    if room_id:
                        db.collection('queue').document(room_id).update({'results': fallback, 'status': 'ended'})
                    return (json.dumps(fallback), 200, headers)
            else:
                # No messages from either player
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

        # --- SIMULATION ANALYSIS (Same PRO model as Battle) ---
        if req_type == "analyze_simulation":
            print("[ANALYZE_SIM] Starting HYBRID simulation analysis...")
            model = get_model()  # Use Flash model (faster) - only identifying, not calculating
            player_history = data.get('playerHistory', [])
            sim_name = data.get('simName', 'Simulation')
            
            if not player_history or len(player_history) == 0:
                return (json.dumps({"accuracy": 0, "feedback": "No messages to analyze."}), 200, headers)
            
            # STEP 1: Python calculates basic stats (instant)
            all_text = ' '.join(player_history)
            all_words = all_text.split()
            total_words = len(all_words)
            unique_words = len(set(w.lower() for w in all_words))
            total_messages = len(player_history)
            
            # Calculate length multiplier
            avg_words_per_msg = total_words / total_messages if total_messages > 0 else 0
            if avg_words_per_msg < 3:
                length_multiplier = 0.70
            elif avg_words_per_msg <= 5:
                length_multiplier = 0.85
            elif avg_words_per_msg <= 9:
                length_multiplier = 1.00
            else:
                length_multiplier = 1.05
            
            print(f"[ANALYZE_SIM] Stats: {total_words} words, {unique_words} unique, {total_messages} msgs, multiplier: {length_multiplier}")
            
            # STEP 2: AI identifies errors with DETAILED analysis
            identify_prompt = f"""Analyze these English messages carefully. Return detailed analysis.

MESSAGES: {player_history}

Return JSON ONLY:
{{
  "grammar_errors": 0,
  "spelling_errors": 0,
  "punctuation_errors": 0,
  "capitalization_errors": 0,
  "article_errors": 0,
  
  "gibberish_words": 0,
  "valid_english_words": 0,
  "basic_words": 0,
  "intermediate_words": 0,
  "advanced_words": 0,
  
  "awkward_phrases": 0,
  "incomplete_thoughts": 0,
  "coherence_score": 85,
  "natural_flow": 80,
  
  "complete_responses": 0,
  "complex_responses": 0,
  "total_responses": 1,
  
  "feedback": "Brief feedback"
}}

DETAILED RULES:
- grammar_errors: Missing verbs, wrong tense, subject-verb mismatch (NOT articles)
- spelling_errors: Misspelled words (typos like "teh" → "the")
- punctuation_errors: Missing . ? ! or wrong comma usage
- capitalization_errors: "i" should be "I", no capital at sentence start
- article_errors: Missing or wrong a/an/the usage

- gibberish_words: ANY word that is NOT a valid English word (e.g., "vnvhhv", "asdfg", "hhhh", "bfrghrtyu")
- valid_english_words: Count of REAL English words (total - gibberish)
- basic_words: Common everyday words (I, am, go, the, is, you, me, yes, no, ok, good, bad)
- intermediate_words: Semi-advanced (purchase, appreciate, wonderful, delicious, consider)
- advanced_words: Sophisticated (eloquent, meticulous, comprehensive, articulate, profound)

- awkward_phrases: Unnatural word order or broken phrasing
- incomplete_thoughts: Sentences missing essential parts
- coherence_score: Does the message make logical sense? (0-100, gibberish = 0)
- natural_flow: Does it sound like a native speaker? (0-100, gibberish = 0)

- complete_responses: Messages that are meaningful as a whole
- complex_responses: Uses because/if/when/that/although
- total_responses: Total number of messages

JSON only:"""
            
            try:
                res = model.generate_content(identify_prompt).text.strip()
                # Clean JSON
                if '```' in res:
                    parts = res.split('```')
                    for part in parts:
                        if part.strip().startswith('json'):
                            res = part.strip()[4:].strip()
                            break
                        elif part.strip().startswith('{'):
                            res = part.strip()
                            break
                start = res.find('{')
                end = res.rfind('}') + 1
                if start >= 0 and end > start:
                    ai_result = json.loads(res[start:end])
                else:
                    raise ValueError("No JSON found in response")
                    
                print(f"[ANALYZE_SIM] AI identified: {ai_result}")
                
                # STEP 3: Python calculates scores using REFINED formulas
                grammar_errors = ai_result.get('grammar_errors', 0)
                spelling_errors = ai_result.get('spelling_errors', 0)
                punctuation_errors = ai_result.get('punctuation_errors', 0)
                capitalization_errors = ai_result.get('capitalization_errors', 0)
                article_errors = ai_result.get('article_errors', 0)
                gibberish_words = ai_result.get('gibberish_words', 0)
                valid_english_words = ai_result.get('valid_english_words', total_words - gibberish_words)
                basic_words = ai_result.get('basic_words', 0)
                intermediate_words = ai_result.get('intermediate_words', 0)
                advanced_words = ai_result.get('advanced_words', 0)
                awkward_phrases = ai_result.get('awkward_phrases', 0)
                incomplete_thoughts = ai_result.get('incomplete_thoughts', 0)
                coherence_score = ai_result.get('coherence_score', 70)
                natural_flow = ai_result.get('natural_flow', 70)
                complete_responses = ai_result.get('complete_responses', ai_result.get('complete_sentences', 0))
                complex_responses = ai_result.get('complex_responses', ai_result.get('complex_sentences', 0))
                total_responses = max(ai_result.get('total_responses', ai_result.get('total_sentences', total_messages)), 1)
                feedback = ai_result.get('feedback', 'Keep practicing!')
                
                # ============================================
                # GRAMMAR: Refined Rate-Based + Flat Gibberish Penalty
                # ============================================
                grammar_rate = grammar_errors / total_words if total_words > 0 else 0
                spelling_rate = spelling_errors / total_words if total_words > 0 else 0
                punctuation_rate = punctuation_errors / total_responses if total_responses > 0 else 0
                capitalization_rate = capitalization_errors / total_responses if total_responses > 0 else 0
                article_rate = article_errors / total_words if total_words > 0 else 0
                gibberish_rate = gibberish_words / total_words if total_words > 0 else 0
                valid_ratio = valid_english_words / total_words if total_words > 0 else 0
                
                # Weighted rate penalty (each rate × weight)
                rate_penalty = (
                    grammar_rate * 150 +        # Grammar: heavy
                    spelling_rate * 100 +        # Spelling: medium-heavy
                    punctuation_rate * 15 +      # Punctuation: light
                    capitalization_rate * 8 +    # Capitalization: minimal
                    article_rate * 80 +          # Articles: medium
                    gibberish_rate * 50          # Gibberish rate penalty
                )
                
                # Flat gibberish penalty: -20 per gibberish word
                gibberish_flat_penalty = gibberish_words * 20
                
                # Calculate base grammar score
                base_grammar = 100 - rate_penalty - gibberish_flat_penalty
                
                # Apply valid ratio multiplier for mostly-gibberish content
                if valid_ratio < 0.3:
                    grammar_score = min(15, max(0, base_grammar))
                elif valid_ratio < 0.7:
                    grammar_score = max(0, min(100, base_grammar * valid_ratio))
                else:
                    grammar_score = max(20, min(100, base_grammar))
                
                # ============================================
                # SENSE-MAKING REWARD: Bonus for clear intent
                # ============================================
                # If grammar is low but message makes sense, give relief
                if coherence_score > 50 and grammar_score < 50:
                    if grammar_score < 20:
                        sense_bonus = 20  # High reward for very low scores
                    elif grammar_score < 30:
                        sense_bonus = 12  # Medium reward
                    elif grammar_score < 40:
                        sense_bonus = 6   # Small reward
                    else:  # 40-50
                        sense_bonus = 3   # Minimal reward
                    
                    grammar_score = min(50, grammar_score + sense_bonus)
                
                # ============================================
                # VOCABULARY: Stricter with Flat Gibberish Penalty
                # ============================================
                valid_words = total_words - gibberish_words
                if total_words > 0 and valid_words > 0:
                    # Word level scoring
                    basic_ratio = basic_words / valid_words if valid_words > 0 else 1
                    intermediate_ratio = intermediate_words / valid_words if valid_words > 0 else 0
                    advanced_ratio = advanced_words / valid_words if valid_words > 0 else 0
                    word_level_score = (basic_ratio * 40) + (intermediate_ratio * 70) + (advanced_ratio * 100)
                    
                    # Gibberish penalties: rate-based + flat
                    gibberish_rate_penalty = gibberish_rate * 50
                    gibberish_flat = gibberish_words * 15  # -15 per gibberish word
                    
                    vocab_score = max(0, min(100, word_level_score - gibberish_rate_penalty - gibberish_flat))
                else:
                    vocab_score = 0 if gibberish_words > 0 else 40
                
                # FLUENCY: Enhanced with coherence, flow, and depth penalty
                avg_words_per_response = total_words / total_responses if total_responses > 0 else 0
                
                # Depth penalty for very short responses
                if avg_words_per_response < 3:
                    depth_penalty = 30
                elif avg_words_per_response < 5:
                    depth_penalty = 15
                else:
                    depth_penalty = 0
                
                # Gibberish kills fluency
                gibberish_ratio = gibberish_words / total_words if total_words > 0 else 0
                if gibberish_ratio > 0.3:
                    fluency_score = max(10, 30 - (gibberish_words * 10))
                else:
                    awkward_penalty = (awkward_phrases / total_responses * 40) if total_responses > 0 else 0
                    incomplete_penalty = (incomplete_thoughts / total_responses * 30) if total_responses > 0 else 0
                    base_fluency = (coherence_score * 0.40) + (natural_flow * 0.60)
                    fluency_score = max(25, min(100, base_fluency - awkward_penalty - incomplete_penalty - depth_penalty))
                
                # SENTENCE: (completeness × 60) + (complexity × 25) + base 15, min 20
                completeness_rate = complete_responses / total_responses if total_responses > 0 else 0
                complexity_rate = complex_responses / total_responses if total_responses > 0 else 0
                sentence_score = max(20, min(100, (completeness_rate * 60) + (complexity_rate * 25) + 15))
                
                # FINAL: Weighted average × length multiplier
                raw_accuracy = (grammar_score * 0.40) + (vocab_score * 0.25) + (fluency_score * 0.20) + (sentence_score * 0.15)
                final_accuracy = round(raw_accuracy * length_multiplier)
                final_accuracy = max(0, min(100, final_accuracy))
                
                print(f"[ANALYZE_SIM] Scores: grammar={grammar_score:.1f}, vocab={vocab_score:.1f}, fluency={fluency_score:.1f}, sentence={sentence_score:.1f}")
                print(f"[ANALYZE_SIM] Final: raw={raw_accuracy:.1f} × {length_multiplier} = {final_accuracy}")
                
                result = {
                    "accuracy": final_accuracy,
                    "grammar": round(grammar_score),
                    "vocab": round(vocab_score),
                    "fluency": round(fluency_score),
                    "sentence": round(sentence_score),
                    "feedback": feedback
                }
                return (json.dumps(result), 200, headers)
                
            except Exception as e:
                print(f"[ANALYZE_SIM_ERROR] {e}")
                # Fallback - use simple estimation based on word count
                simple_score = min(80, 50 + (total_words // 5))
                fallback = {"accuracy": simple_score, "feedback": "Analysis unavailable, estimated score."}
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
             stage_info = data.get('stageInfo', {})  # Full stage context for transitions
             difficulty = data.get('difficulty', 'Medium') # Extract difficulty
             
             # --- DIFFICULTY LOGIC (AFFECTS BOT VOCABULARY/STYLE ONLY - NOT SCORING) ---
             if difficulty == 'Easy':
                 vocab_style_instruction = """VOCABULARY & STYLE (EASY):
- Use simple, common everyday words
- Keep sentences short and casual
- Use contractions (I'm, you're, don't)
- Be very friendly and approachable
- Avoid formal or complex vocabulary"""
             elif difficulty == 'Hard':
                 vocab_style_instruction = """VOCABULARY & STYLE (HARD):
- Use richer, more sophisticated vocabulary
- Use proper English (formal but natural)
- Avoid excessive contractions
- Keep sentences concise but complex in structure
- DO NOT make sentences overly long - just use higher-level English"""
             else: # Medium
                 vocab_style_instruction = """VOCABULARY & STYLE (MEDIUM):
- Mix simple and slightly advanced vocabulary
- Natural casual-formal balance
- Normal conversational English"""

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
             is_supportive_chat = 'supportive' in sim_title.lower() or persona_id == 'sim_friend'
             
             # SPECIAL: Aisha (Supportive Chat) - Emotional support friend personality
             if is_supportive_chat:
                 prompt = f"""You have TWO jobs. Do them in order.

=== JOB 1: SUPPORTIVE FRIEND RESPONSE ===
You are Aisha, a 24-year-old modern Indian woman. You are a warm, caring, supportive friend.

CRITICAL RULES:
1. You are a REAL PERSON named Aisha, NOT an AI. NEVER say "I'm designed", "I'm programmed", "I'm an AI".
2. If asked who you are: "I'm Aisha, your friend! I love chatting and helping people feel better 💜"
3. ONLY talk about feelings, life, relationships, motivation, self-care.
4. NEVER mention flights, UPI, payments, bookings, or random topics.
5. Ask caring questions: "What's on your mind?", "How can I help?", "Tell me more"
6. Use warm language: "I understand", "That sounds tough", "I'm here for you"
7. Light emojis: 💜 😊 ✨ 🤗

Recent chat:
{history_text}

User said: "{msg}"

YOUR RESPONSE: Keep it SHORT (1-2 sentences), end with a caring question.

YOUR SPEAKING STYLE:
{vocab_style_instruction}

=== JOB 2: GRAMMAR CHECK ===
Check the user's message: "{msg}"

STRICTLY CHECK FOR:
- SPELLING: "soory"→"sorry", "mor"→"more", "wey"→"way"
- GRAMMAR: "i mean am good"→"I mean I am good", "your name dear?"→"What is your name, dear?"
- CAPITALIZATION: "i" → "I" at start of sentences
- INCOMPLETE SENTENCES: Flag if message sounds broken

ACCURACY FORMULA:
- If perfect English → accuracy: 100, errorLevel: "perfect"
- If minor issue (style/capitalization) → accuracy: 85-95, errorLevel: "suggestion"
- If clear error (spelling/grammar) → accuracy: 60-80, errorLevel: "suggestion"

=== OUTPUT (JSON only) ===
If PERFECT English:
{{
  "reply": "your supportive response with question",
  "stageTransition": null,
  "accuracy": 100,
  "errorLevel": "perfect",
  "correction": null,
  "points": 5
}}

If HAS ERRORS (show FULL corrected sentence if multiple):
{{
  "reply": "your supportive response with question",
  "stageTransition": null,
  "accuracy": 70,
  "errorLevel": "suggestion",
  "correction": {{"original": "original word or FULL sentence if multiple errors", "corrected": "corrected word or FULL sentence", "reason": "Brief friendly explanation! 😊", "type": "spelling/grammar"}},
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
                     
                     start = response_text.find('{')
                     end = response_text.rfind('}') + 1
                     if start != -1 and end > start:
                         response_text = response_text[start:end]
                     
                     result = json.loads(response_text)
                     
                     # Generate TTS audio for Aisha
                     audio_base64 = synthesize_speech(result.get('reply', ''), 'sim_default')
                     if audio_base64:
                         result['audioBase64'] = audio_base64
                     
                     return (json.dumps(result), 200, headers)
                 except Exception as e:
                     print(f"Supportive chat error: {e}")
                     return (json.dumps({
                         "reply": "I'm here for you 💜 What's on your mind?",
                         "accuracy": 100,
                         "errorLevel": "perfect",
                         "correction": None,
                         "points": 5
                     }), 200, headers)
             
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
7. YOUR SPEAKING STYLE:
{vocab_style_instruction}

=== JOB 2: GRAMMAR CHECK ===
Check the user's message: "{msg}"


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

WITH errors (show FULL corrected sentence if multiple errors):
{{
  "reply": "your response",
  "stageTransition": null,
  "accuracy": 40,
  "errorLevel": "suggestion",
  "correction": {{"original": "original word or FULL sentence if multiple errors", "corrected": "corrected word or FULL sentence", "reason": "brief explanation", "type": "spelling/grammar"}},
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
            
            model = get_pro_model()  # Use PRO model for nuanced skill insights
            
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
                response_text = generate_with_pro_model(model, prompt)
                
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

        # ========================================
        # GENERATE STUDY GUIDE PDF
        # ========================================
        if req_type == 'generate_study_guide':
            # Check if PDF generation is available
            if not REPORTLAB_AVAILABLE:
                return (json.dumps({
                    "error": "pdf_unavailable",
                    "message": "PDF generation is temporarily unavailable. Please try again later."
                }), 503, headers)
            
            user_id = data.get('userId')
            date_filter = data.get('dateFilter', 'new')  # '7days', '30days', 'all', 'new'
            
            if not user_id:
                return (json.dumps({"error": "userId required"}), 400, headers)
            
            try:
                db = firestore.Client()
                
                # Get user data
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                
                if not user_doc.exists:
                    return (json.dumps({"error": "User not found"}), 404, headers)
                
                user_data = user_doc.to_dict()
                # Stats are stored in nested 'stats' object
                stats = user_data.get('stats', {})
                streak = stats.get('streak', 0) if stats else 0
                points = stats.get('points', 0) if stats else 0
                avg_score = stats.get('avgScore', 0) if stats else 0
                total_sessions = stats.get('sessions', 0) if stats else 0
                last_pdf_download = user_data.get('lastPdfDownload')
                
                # Determine level from accuracy
                if avg_score >= 95:
                    level_name, level_icon = 'Master', '****'
                elif avg_score >= 85:
                    level_name, level_icon = 'Pro', '***'
                elif avg_score >= 70:
                    level_name, level_icon = 'Improver', '**'
                elif avg_score >= 50:
                    level_name, level_icon = 'Learner', '*'
                else:
                    level_name, level_icon = 'Starter', '-'
                
                # Calculate date filter - more options
                now = datetime.now(timezone.utc)
                filter_date = None
                filter_label = "All Time"
                
                if date_filter == '3days':
                    filter_date = now - timedelta(days=3)
                    filter_label = "Last 3 Days"
                elif date_filter == '5days':
                    filter_date = now - timedelta(days=5)
                    filter_label = "Last 5 Days"
                elif date_filter == '7days':
                    filter_date = now - timedelta(days=7)
                    filter_label = "Last 7 Days"
                elif date_filter == '15days':
                    filter_date = now - timedelta(days=15)
                    filter_label = "Last 15 Days"
                elif date_filter == '30days':
                    filter_date = now - timedelta(days=30)
                    filter_label = "Last 30 Days"
                elif date_filter == 'new' and last_pdf_download:
                    try:
                        filter_date = datetime.fromisoformat(last_pdf_download.replace('Z', '+00:00'))
                        filter_label = f"Since {filter_date.strftime('%b %d, %Y')}"
                    except:
                        filter_date = now - timedelta(days=7)
                        filter_label = "Last 7 Days"
                elif date_filter == 'new':
                    filter_date = now - timedelta(days=7)
                    filter_label = "Last 7 Days (First Download)"
                
                # Fetch sessions with corrections
                sessions_ref = db.collection('users').document(user_id).collection('sessions')
                sessions_query = sessions_ref.order_by('startTime', direction=firestore.Query.DESCENDING).limit(100)
                sessions = sessions_query.stream()
                
                all_corrections = []
                period_sessions = 0
                period_time_seconds = 0
                period_accuracy_sum = 0
                period_points = 0
                
                for session in sessions:
                    session_data = session.to_dict()
                    session_date = session_data.get('startTime')
                    
                    # Apply date filter
                    if filter_date and session_date:
                        try:
                            if hasattr(session_date, 'timestamp'):
                                session_datetime = datetime.fromtimestamp(session_date.timestamp(), tz=timezone.utc)
                            else:
                                session_datetime = datetime.fromisoformat(str(session_date).replace('Z', '+00:00'))
                            
                            if session_datetime < filter_date:
                                continue
                        except:
                            pass
                    
                    # Track period-specific stats
                    period_sessions += 1
                    period_time_seconds += session_data.get('duration', 0)
                    period_accuracy_sum += session_data.get('accuracy', 0)
                    period_points += session_data.get('points', 0)
                    
                    corrections = session_data.get('corrections', [])
                    for corr in corrections:
                        if isinstance(corr, dict):
                            corr['sessionDate'] = session_data.get('startTime')
                            all_corrections.append(corr)
                
                # Calculate period averages
                period_avg_accuracy = round(period_accuracy_sum / period_sessions) if period_sessions > 0 else 0
                period_time_minutes = round(period_time_seconds / 60) if period_time_seconds > 0 else 0
                period_time_hours = period_time_minutes // 60
                period_time_remaining_mins = period_time_minutes % 60
                
                # Format time string
                if period_time_hours > 0:
                    time_spent_str = f"{period_time_hours}h {period_time_remaining_mins}m"
                elif period_time_minutes > 0:
                    time_spent_str = f"{period_time_minutes} min"
                else:
                    time_spent_str = f"{period_time_seconds} sec"
                
                # Limit to 50 corrections max
                all_corrections = all_corrections[:50]
                
                if not all_corrections:
                    return (json.dumps({
                        "error": "no_corrections",
                        "message": "No corrections found for the selected time period. Complete more practice sessions first!"
                    }), 200, headers)
                
                # Categorize corrections for focus areas
                categories = {}
                for corr in all_corrections:
                    cat = corr.get('type', 'General')
                    if cat not in categories:
                        categories[cat] = 0
                    categories[cat] += 1
                
                focus_areas = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]
                
                # Generate PDF
                buffer = BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                        rightMargin=20*mm, leftMargin=20*mm,
                                        topMargin=20*mm, bottomMargin=20*mm)
                
                styles = getSampleStyleSheet()
                
                # Custom styles
                title_style = ParagraphStyle(
                    'CustomTitle', parent=styles['Heading1'],
                    fontSize=24, textColor=colors.HexColor('#10B981'),
                    alignment=TA_CENTER, spaceAfter=10
                )
                subtitle_style = ParagraphStyle(
                    'Subtitle', parent=styles['Normal'],
                    fontSize=12, textColor=colors.HexColor('#6B7280'),
                    alignment=TA_CENTER, spaceAfter=20
                )
                section_style = ParagraphStyle(
                    'Section', parent=styles['Heading2'],
                    fontSize=14, textColor=colors.HexColor('#1F2937'),
                    spaceBefore=15, spaceAfter=10
                )
                body_style = ParagraphStyle(
                    'Body', parent=styles['Normal'],
                    fontSize=10, textColor=colors.HexColor('#374151'),
                    spaceAfter=5
                )
                correction_header = ParagraphStyle(
                    'CorrHeader', parent=styles['Normal'],
                    fontSize=9, textColor=colors.HexColor('#6B7280'),
                    spaceAfter=5
                )
                wrong_style = ParagraphStyle(
                    'Wrong', parent=styles['Normal'],
                    fontSize=11, textColor=colors.HexColor('#DC2626'),
                    leftIndent=10, spaceAfter=3
                )
                correct_style = ParagraphStyle(
                    'Correct', parent=styles['Normal'],
                    fontSize=11, textColor=colors.HexColor('#059669'),
                    leftIndent=10, spaceAfter=3
                )
                tip_style = ParagraphStyle(
                    'Tip', parent=styles['Normal'],
                    fontSize=9, textColor=colors.HexColor('#7C3AED'),
                    leftIndent=10, spaceBefore=5, spaceAfter=10,
                    backColor=colors.HexColor('#F3E8FF')
                )
                
                story = []
                
                # Determine accuracy shield based on period_avg_accuracy
                if period_avg_accuracy >= 90:
                    shield_emoji = "🛡️"
                    shield_label = "Master"
                    shield_color = '#FFD700'  # Gold
                elif period_avg_accuracy >= 75:
                    shield_emoji = "🛡️"
                    shield_label = "Expert"
                    shield_color = '#C0C0C0'  # Silver
                elif period_avg_accuracy >= 60:
                    shield_emoji = "🛡️"
                    shield_label = "Skilled"
                    shield_color = '#CD7F32'  # Bronze
                else:
                    shield_emoji = "🛡️"
                    shield_label = "Learner"
                    shield_color = '#6B7280'  # Gray
                
                # Premium 3-Column Header
                header_data = [[
                    Paragraph(f"<font size='28'>{shield_emoji}</font><br/><font size='8' color='{shield_color}'><b>{shield_label}</b></font>", 
                              ParagraphStyle('Shield', alignment=TA_CENTER)),
                    Paragraph(f"<font size='22' color='#10B981'><b>FLUENCY PRO</b></font><br/><font size='10' color='#6B7280'>Progress Report</font>", 
                              ParagraphStyle('Title', alignment=TA_CENTER)),
                    Paragraph(f"<font size='9' color='#374151'>{now.strftime('%B %d, %Y')}</font><br/><font size='8' color='#6B7280'>{filter_label}</font>", 
                              ParagraphStyle('Date', alignment=TA_CENTER))
                ]]
                header_table = Table(header_data, colWidths=[35*mm, 100*mm, 35*mm])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                ]))
                story.append(header_table)
                story.append(Spacer(1, 15))
                
                # Stats Summary - Premium bordered box
                stats_data = [
                    [f"{period_sessions}", f"{time_spent_str}", f"{period_avg_accuracy}%", f"{streak} 🔥"],
                    ["Sessions", "Time Spent", "Accuracy", "Streak"]
                ]
                stats_table = Table(stats_data, colWidths=[40*mm, 45*mm, 40*mm, 40*mm])
                stats_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F0FDF4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#047857')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('FONTSIZE', (0, 1), (-1, 1), 8),
                    ('TEXTCOLOR', (0, 1), (-1, 1), colors.gray),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('TOPPADDING', (0, 0), (-1, 0), 12),
                    ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#10B981')),
                    ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#D1FAE5')),
                ]))
                story.append(stats_table)
                story.append(Paragraph(f"Level: {level_icon} {level_name} | Total XP: {points:,.0f}", 
                                       ParagraphStyle('Level', fontSize=11, textColor=colors.HexColor('#6366F1'), alignment=TA_CENTER, spaceBefore=10)))
                story.append(Spacer(1, 15))
                
                # AI Analysis Section - Weaknesses and Strengths
                ai_insights = None
                try:
                    print("[PDF_AI] Generating AI insights for PDF...")
                    model = get_pro_model()
                    
                    corrections_text = "\n".join([
                        f"- '{c.get('original', '')}' -> '{c.get('corrected', '')}' ({c.get('type', 'General')})"
                        for c in all_corrections[:20]
                    ])
                    
                    ai_prompt = f"""Analyze these English corrections and identify patterns:
{corrections_text}

Return ONLY valid JSON:
{{"weakPoints": [{{"category": "Grammar", "detail": "Brief issue"}}, ...], "strongPoints": [{{"category": "Vocabulary", "detail": "Brief strength"}}, ...]}}
Max 3 weak points, 2 strong points. Be encouraging."""
                    
                    ai_response = generate_with_pro_model(model, ai_prompt)
                    # Parse JSON from response
                    start_idx = ai_response.find('{')
                    end_idx = ai_response.rfind('}') + 1
                    if start_idx != -1 and end_idx > start_idx:
                        ai_insights = json.loads(ai_response[start_idx:end_idx])
                        print(f"[PDF_AI] Success! Insights: {ai_insights}")
                except Exception as e:
                    print(f"[PDF_AI] AI analysis failed: {e}")
                
                # Add AI Insights to PDF if available
                if ai_insights:
                    # Weak Points
                    if ai_insights.get('weakPoints'):
                        story.append(Paragraph("🔴 AREAS TO IMPROVE", 
                            ParagraphStyle('WeakHeader', fontSize=12, textColor=colors.HexColor('#DC2626'), 
                                         spaceBefore=10, spaceAfter=5, fontName='Helvetica-Bold')))
                        for wp in ai_insights['weakPoints'][:3]:
                            story.append(Paragraph(f"• <b>{wp.get('category', 'General')}:</b> {wp.get('detail', '')}", 
                                ParagraphStyle('WeakItem', fontSize=10, textColor=colors.HexColor('#7F1D1D'),
                                             leftIndent=15, spaceAfter=3, backColor=colors.HexColor('#FEF2F2'))))
                    
                    # Strong Points
                    if ai_insights.get('strongPoints'):
                        story.append(Paragraph("🟢 YOUR STRENGTHS", 
                            ParagraphStyle('StrongHeader', fontSize=12, textColor=colors.HexColor('#059669'), 
                                         spaceBefore=15, spaceAfter=5, fontName='Helvetica-Bold')))
                        for sp in ai_insights['strongPoints'][:2]:
                            story.append(Paragraph(f"• <b>{sp.get('category', 'General')}:</b> {sp.get('detail', '')}", 
                                ParagraphStyle('StrongItem', fontSize=10, textColor=colors.HexColor('#065F46'),
                                             leftIndent=15, spaceAfter=3, backColor=colors.HexColor('#ECFDF5'))))
                    
                    story.append(Spacer(1, 15))
                
                # Focus Areas
                if focus_areas:
                    story.append(Paragraph("TOP FOCUS AREAS", section_style))
                    story.append(Paragraph("Based on your recent mistakes:", body_style))
                    for i, (cat, count) in enumerate(focus_areas, 1):
                        story.append(Paragraph(f"  {i}. {cat} ({count} correction{'s' if count > 1 else ''})", body_style))
                    story.append(Spacer(1, 15))
                
                # Corrections
                story.append(Paragraph("CORRECTIONS TO PRACTICE", section_style))
                story.append(Spacer(1, 5))
                
                for i, corr in enumerate(all_corrections, 1):
                    original = corr.get('original', corr.get('userText', 'N/A'))
                    corrected = corr.get('corrected', corr.get('correctedText', 'N/A'))
                    explanation = corr.get('explanation', 'Practice this pattern.')
                    corr_type = corr.get('type', 'General')
                    
                    # Get date if available
                    session_date = corr.get('sessionDate', '')
                    date_str = ''
                    if session_date:
                        try:
                            if hasattr(session_date, 'strftime'):
                                date_str = session_date.strftime('%b %d')
                            elif hasattr(session_date, 'timestamp'):
                                date_str = datetime.fromtimestamp(session_date.timestamp()).strftime('%b %d')
                        except:
                            pass
                    
                    story.append(Paragraph(f"#{i} | {corr_type} {' | ' + date_str if date_str else ''}", correction_header))
                    story.append(Paragraph(f"YOUR VERSION: \"{original}\"", wrong_style))
                    story.append(Paragraph(f"CORRECT: \"{corrected}\"", correct_style))
                    story.append(Paragraph(f"TIP: {explanation}", tip_style))
                    story.append(Spacer(1, 8))
                
                # Footer
                story.append(Spacer(1, 20))
                story.append(Paragraph("QUICK PRACTICE TIPS", section_style))
                story.append(Paragraph("- Read each correction out loud 3 times", body_style))
                story.append(Paragraph("- Write the correct sentence in a notebook", body_style))
                story.append(Paragraph("- Try using these patterns in your next session", body_style))
                story.append(Spacer(1, 20))
                story.append(Paragraph("Mistakes are proof that you are trying!", 
                                       ParagraphStyle('Quote', fontSize=11, textColor=colors.HexColor('#7C3AED'), alignment=TA_CENTER, fontName='Helvetica-Oblique')))
                story.append(Paragraph("Keep practicing on Fluency Pro!", 
                                       ParagraphStyle('Footer', fontSize=9, textColor=colors.gray, alignment=TA_CENTER, spaceBefore=5)))
                
                # Build PDF
                doc.build(story)
                pdf_bytes = buffer.getvalue()
                buffer.close()
                
                # Update lastPdfDownload in Firestore
                user_ref.update({
                    'lastPdfDownload': now.isoformat()
                })
                
                # Return base64 encoded PDF
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                
                # --- SAVE TO HISTORY (FIX) ---
                try:
                    history_ref = user_ref.collection('pdfHistory')
                    history_ref.add({
                        'generatedAt': firestore.SERVER_TIMESTAMP,
                        'filter': date_filter,
                        'filterLabel': filter_label,
                        'pages': 5,
                        'quizCount': 0, 
                        'vocabCount': 0,
                        'correctionsCount': len(all_corrections),
                        'pdf': pdf_base64
                    })
                    
                    docs = history_ref.order_by('generatedAt', direction=firestore.Query.DESCENDING).get()
                    if len(docs) > 10:
                        for doc in docs[10:]:
                            doc.reference.delete()
                except Exception as h_err:
                    print(f"[HISTORY_SAVE_ERR] {h_err}")
                
                return (json.dumps({
                    "pdf": pdf_base64,
                    "correctionsCount": len(all_corrections),
                    "dateRange": filter_label,
                    "focusAreas": [{"name": cat, "count": count} for cat, count in focus_areas]
                }), 200, headers)
                
            except Exception as e:
                print(f"[STUDY_GUIDE_ERROR] {e}")
                import traceback
                traceback.print_exc()
                return (json.dumps({"error": str(e)}), 500, headers)

                return (json.dumps({"error": str(e)}), 500, headers)

        # ========================================
        # GET PDF HISTORY (Metadata Only)
        # ========================================
        if req_type == 'get_pdf_history':
            user_id = data.get('userId')
            if not user_id: return (json.dumps({"error": "userId required"}), 400, headers)
            
            try:
                db = firestore.Client()
                print(f"[GET_PDF_HISTORY] Fetching for user: {user_id}")
                
                # Order by generatedAt DESC and limit to 10
                history_ref = db.collection('users').document(user_id).collection('pdfHistory') \
                                .order_by('generatedAt', direction=firestore.Query.DESCENDING).limit(10)
                
                history = []
                for doc in history_ref.stream():
                    d = doc.to_dict()
                    # Return metadata ONLY (exclude large 'pdf' string)
                    history.append({
                        'id': doc.id,
                        'generatedAt': d.get('generatedAt').isoformat() if d.get('generatedAt') else None,
                        'filter': d.get('filter'),
                        'filterLabel': d.get('filterLabel'),
                        'pages': d.get('pages', 6),
                        'quizCount': d.get('quizCount', 0),
                        'vocabCount': d.get('vocabCount', 0),
                        'correctionsCount': d.get('correctionsCount', 0)
                    })
                
                print(f"[GET_PDF_HISTORY] ✓ Returning {len(history)} items")
                return (json.dumps({"history": history, "count": len(history)}), 200, headers)
            except Exception as e:
                print(f"[GET_HISTORY_ERR] {e}")
                import traceback
                traceback.print_exc()
                return (json.dumps({"error": str(e)}), 500, headers)

        # ========================================
        # GET PDF BY ID (Full Download)
        # ========================================
        if req_type == 'get_pdf_by_id':
            user_id = data.get('userId')
            pdf_id = data.get('pdfId')
            if not user_id or not pdf_id: return (json.dumps({"error": "Missing params"}), 400, headers)
            
            try:
                db = firestore.Client()
                doc_ref = db.collection('users').document(user_id).collection('pdfHistory').document(pdf_id)
                doc = doc_ref.get()
                
                if not doc.exists:
                    return (json.dumps({"error": "PDF not found"}), 404, headers)
                
                data = doc.to_dict()
                return (json.dumps({"pdf": data.get('pdf')}), 200, headers)
            except Exception as e:
                 print(f"[GET_PDF_ERR] {e}")
                 return (json.dumps({"error": str(e)}), 500, headers)

        # ========================================
        # GENERATE PRACTICE PDF (Workbook)
        # ========================================
        if req_type == 'generate_practice_pdf':
            if not REPORTLAB_AVAILABLE:
                return (json.dumps({"error": "pdf_unavailable", "message": "PDF generation unavailable."}), 503, headers)
            
            user_id = data.get('userId')
            if not user_id:
                return (json.dumps({"error": "userId required"}), 400, headers)
            
            try:
                db = firestore.Client()
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                
                if not user_doc.exists:
                    return (json.dumps({"error": "User not found"}), 404, headers)
                
                user_data = user_doc.to_dict()
                stats = user_data.get('stats', {})
                vocab_history = stats.get('vocabHistory', [])
                
                # Fetch recent corrections for context
                sessions_ref = db.collection('users').document(user_id).collection('sessions')
                # Last 20 sessions for ample context
                sessions = sessions_ref.order_by('startTime', direction=firestore.Query.DESCENDING).limit(20).stream()
                
                recent_mistakes = []
                for s in sessions:
                    s_data = s.to_dict()
                    for c in s_data.get('corrections', []):
                        if isinstance(c, dict):
                           recent_mistakes.append(f"{c.get('type', 'General')}: {c.get('original')} -> {c.get('corrected')}")
                
                # Limit mistakes context
                mistakes_context = "\n".join(recent_mistakes[:30])
                recent_vocab_str = ", ".join(vocab_history[-50:]) # Avoid last 50 words
                
                # AI Prompt - 25 questions, vocab after
                prompt = f"""Create a personalized English practice workbook.
User's Recent Mistakes:
{mistakes_context}

Task 1: Grammar Quiz (MOST IMPORTANT)
Generate 25 Fill-in-the-blank questions focusing on the user's recent mistakes.
Cover these error types: {', '.join(set([m.split(':')[0] for m in recent_mistakes[:10]]))}.
For each question provide: question (with ______), correct_answer, choices (list of 4 options), explanation.

Task 2: Vocabulary
Generate 10 advanced English words (B2/C1 level) useful for this user. 
AVOID these words: {recent_vocab_str}
For each word provide: word, definition, example_sentence.

Return JSON:
{{
  "quiz": [{{"question": "...", "answer": "...", "choices": ["...", "..."], "explanation": "..."}}],
  "vocabulary": [{{"word": "...", "definition": "...", "example": "..."}}]
}}"""

                print("[PRACTICE_PDF] Generating content with AI...")
                model = get_pro_model()
                ai_res = generate_with_pro_model(model, prompt)
                
                # Parse JSON
                start = ai_res.find('{')
                end = ai_res.rfind('}') + 1
                content = json.loads(ai_res[start:end])
                
                # Update Vocab History
                new_vocab_words = [v['word'] for v in content.get('vocabulary', [])]
                if new_vocab_words:
                    # Update stats.vocabHistory atomically
                    # Note: stats is a map, so we update the field "stats.vocabHistory"
                    # Using arrayUnion to add new words
                    user_ref.update({
                        "stats.vocabHistory": firestore.ArrayUnion(new_vocab_words)
                    })
                
                # Generate PDF
                buffer = BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                        rightMargin=20*mm, leftMargin=20*mm,
                                        topMargin=20*mm, bottomMargin=20*mm)
                
                styles = getSampleStyleSheet()
                # Define styles (reusing logic or redefining short versions)
                title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#059669'), alignment=TA_CENTER, spaceAfter=20)
                h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1F2937'), spaceBefore=15, spaceAfter=10)
                vocab_word_style = ParagraphStyle('VocabWord', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#4338CA'), fontName='Helvetica-Bold')
                text_style = ParagraphStyle('Text', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#374151'))
                quiz_q_style = ParagraphStyle('QuizQ', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold', spaceBefore=10)
                
                story = []
                now = datetime.now()
                
                # Get user's accuracy for shield (from stats)
                avg_accuracy = stats.get('avgScore', 70)
                if avg_accuracy >= 90:
                    shield_emoji, shield_label = "🛡️", "Master"
                elif avg_accuracy >= 75:
                    shield_emoji, shield_label = "🛡️", "Expert"
                elif avg_accuracy >= 60:
                    shield_emoji, shield_label = "🛡️", "Skilled"
                else:
                    shield_emoji, shield_label = "🛡️", "Learner"
                
                # Premium Header with Shield Badge
                header_data = [[
                    Paragraph(f"<font size='24'>{shield_emoji}</font><br/><font size='8' color='#6366F1'><b>{shield_label}</b></font>", 
                              ParagraphStyle('Shield', alignment=TA_CENTER)),
                    Paragraph(f"<font size='20' color='#6366F1'><b>FLUENCY PRO</b></font><br/><font size='12' color='#9CA3AF'>Practice Workbook</font>", 
                              ParagraphStyle('Title', alignment=TA_CENTER)),
                    Paragraph(f"<font size='9' color='#374151'>{now.strftime('%B %d, %Y')}</font><br/><font size='8' color='#6B7280'>25 Questions</font>", 
                              ParagraphStyle('Date', alignment=TA_CENTER))
                ]]
                header_table = Table(header_data, colWidths=[35*mm, 100*mm, 35*mm])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
                ]))
                story.append(header_table)
                story.append(Spacer(1, 20))
                
                # PART 1: Grammar Challenge (QUIZ FIRST)
                if content.get('quiz'):
                    story.append(Paragraph("PART 1: GRAMMAR CHALLENGE", h2_style))
                    story.append(Paragraph("Fill in the blanks. Choose the best option. Answers at the end!", text_style))
                    story.append(Spacer(1, 10))
                    
                    for i, q in enumerate(content['quiz'], 1):
                        story.append(Paragraph(f"<b>Q{i}.</b> {q['question']}", quiz_q_style))
                        options = "   ".join([f"({chr(65+j)}) {opt}" for j, opt in enumerate(q.get('choices', []))])
                        story.append(Paragraph(f"<font size='9' color='#6B7280'>{options}</font>", text_style))
                        story.append(Spacer(1, 8))
                    
                    story.append(PageBreak())
                
                # PART 2: Vocabulary Builder (AFTER QUIZ)
                if content.get('vocabulary'):
                    story.append(Paragraph("PART 2: VOCABULARY BUILDER", h2_style))
                    story.append(Paragraph("Master these 10 new words:", text_style))
                    story.append(Spacer(1, 10))
                    
                    for i, v in enumerate(content['vocabulary'], 1):
                        story.append(Paragraph(f"<font size='12' color='#4338CA'><b>{i}. {v['word']}</b></font>", vocab_word_style))
                        story.append(Paragraph(f"   <b>Definition:</b> {v['definition']}", text_style))
                        story.append(Paragraph(f"   <b>Example:</b> <i>\"{v['example']}\"</i>", text_style))
                        story.append(Spacer(1, 10))
                    
                    story.append(PageBreak())
                
                # Answer Key
                if content.get('quiz'):
                    story.append(Paragraph("ANSWER KEY", h2_style))
                    story.append(Paragraph("Check your answers:", text_style))
                    story.append(Spacer(1, 10))
                    for i, q in enumerate(content['quiz'], 1):
                        story.append(Paragraph(f"<b>Q{i}: {q['answer']}</b>", text_style))
                        story.append(Paragraph(f"<i>{q.get('explanation', '')}</i>", ParagraphStyle('Expl', parent=styles['Normal'], fontSize=9, textColor=colors.gray, leftIndent=10)))
                        story.append(Spacer(1, 4))
                
                doc.build(story)
                pdf_bytes = buffer.getvalue()
                buffer.close()
                
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                
                return (json.dumps({
                    "pdf": pdf_base64,
                    "vocabCount": len(new_vocab_words),
                    "quizCount": len(content.get('quiz', []))
                }), 200, headers)
                
            except Exception as e:
                print(f"[PRACTICE_PDF_ERROR] {e}")
                return (json.dumps({"error": str(e)}), 500, headers)

        # ========================================
        # GENERATE LEARNING PACK (Combined PDF)
        # ========================================
        if req_type == 'generate_learning_pack':
            if not REPORTLAB_AVAILABLE:
                return (json.dumps({"error": "pdf_unavailable"}), 503, headers)
            
            user_id = data.get('userId')
            date_filter = data.get('dateFilter', '7days')
            if not user_id:
                return (json.dumps({"error": "userId required"}), 400, headers)
            
            try:
                db = firestore.Client()
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                
                if not user_doc.exists:
                    return (json.dumps({"error": "User not found"}), 404, headers)
                
                user_data = user_doc.to_dict()
                stats = user_data.get('stats', {})
                streak = stats.get('streak', 0)
                points = stats.get('points', 0)
                avg_score = stats.get('avgScore', 0)
                total_sessions = stats.get('sessions', 0)
                vocab_history = stats.get('vocabHistory', [])
                
                # Calculate Level based on AVG SCORE (matches Frontend logic)
                # avg_score is calculated above
                level_name = "Starter"
                level_icon = "☆"
                
                if avg_score >= 95:
                    level_name = "Master"
                    level_icon = "★★★★"
                elif avg_score >= 85:
                    level_name = "Pro"
                    level_icon = "★★★"
                elif avg_score >= 70:
                    level_name = "Improver"
                    level_icon = "★★"
                elif avg_score >= 50:
                    level_name = "Learner"
                    level_icon = "★"
                
                # Date filter
                now = datetime.now()
                if date_filter == '3days':
                    filter_date = now - timedelta(days=3)
                    filter_label = "Last 3 Days"
                elif date_filter == '5days':
                    filter_date = now - timedelta(days=5)
                    filter_label = "Last 5 Days"
                elif date_filter == '15days':
                    filter_date = now - timedelta(days=15)
                    filter_label = "Last 15 Days"
                elif date_filter == '30days':
                    filter_date = now - timedelta(days=30)
                    filter_label = "Last 30 Days"
                elif date_filter == 'all':
                    filter_date = None
                    filter_label = "All Time"
                else:
                    filter_date = now - timedelta(days=7)
                    filter_label = "Last 7 Days"
                
                # Fetch sessions
                sessions_ref = db.collection('users').document(user_id).collection('sessions')
                sessions = sessions_ref.order_by('startTime', direction=firestore.Query.DESCENDING).limit(50).stream()
                
                all_corrections = []
                period_sessions = 0
                period_time_seconds = 0
                period_accuracy_sum = 0
                recent_mistakes = []
                
                for sess in sessions:
                    s_data = sess.to_dict()
                    session_time = s_data.get('startTime')
                    
                    # Check date filter
                    in_period = True
                    if filter_date and session_time:
                        if hasattr(session_time, 'timestamp'):
                            session_dt = datetime.fromtimestamp(session_time.timestamp())
                        else:
                            session_dt = session_time
                        if session_dt < filter_date:
                            in_period = False
                    
                    if in_period:
                        period_sessions += 1
                        period_time_seconds += s_data.get('duration', 0)
                        period_accuracy_sum += s_data.get('accuracy', 0)
                        
                        for c in s_data.get('corrections', []):
                            if isinstance(c, dict):
                                c['sessionDate'] = session_time
                                all_corrections.append(c)
                                recent_mistakes.append(f"{c.get('type', 'General')}: {c.get('original')} -> {c.get('corrected')}")
                
                # FIX: Ensure period_sessions never exceeds total_sessions (lifetime)
                # This can happen if early-end sessions are saved but don't increment stats.sessions
                period_sessions = min(period_sessions, total_sessions) if total_sessions > 0 else period_sessions
                
                period_avg_accuracy = round(period_accuracy_sum / period_sessions) if period_sessions > 0 else 0
                period_time_minutes = round(period_time_seconds / 60) if period_time_seconds > 0 else 0
                
                if period_time_minutes >= 60:
                    time_spent_str = f"{period_time_minutes // 60}h {period_time_minutes % 60}m"
                else:
                    time_spent_str = f"{period_time_minutes}m" if period_time_minutes > 0 else "0m"
                
                # Shield based on accuracy - Unicode stars approach (Stage naming)
                if period_avg_accuracy >= 95:
                    shield_label = "MASTER"
                    shield_stars = "★★★★"
                    shield_color = '#FFD700'  # Gold
                elif period_avg_accuracy >= 85:
                    shield_label = "PRO"
                    shield_stars = "★★★"
                    shield_color = '#C0C0C0'  # Silver
                elif period_avg_accuracy >= 70:
                    shield_label = "IMPROVER"
                    shield_stars = "★★"
                    shield_color = '#CD7F32'  # Bronze
                elif period_avg_accuracy >= 50:
                    shield_label = "LEARNER"
                    shield_stars = "★"
                    shield_color = '#10B981'  # Green
                else:
                    shield_label = "STARTER"
                    shield_stars = "☆"
                    shield_color = '#6B7280'  # Gray
                
                # AI Content Generation
                mistakes_context = "\n".join(recent_mistakes[:30])
                recent_vocab_str = ", ".join(vocab_history[-50:])
                
                ai_prompt = f"""Create a complete English learning pack.

User Mistakes:
{mistakes_context}

Task 1: AI Analysis
Analyze the mistakes and provide:
- 3 weak points (areas to improve)
- 2 strong points

Task 2: Grammar Quiz
Create 25 fill-in-the-blank questions based on the user's mistake patterns.
For each: question (with ______), answer, 4 choices (A/B/C/D), brief explanation.

Task 3: Vocabulary
Generate 10 C1-level words. AVOID: {recent_vocab_str}
For each: word, definition, example sentence.

Return JSON:
{{
  "insights": {{
    "weakPoints": [{{"category": "...", "detail": "..."}}],
    "strongPoints": [{{"category": "...", "detail": "..."}}]
  }},
  "quiz": [{{"question": "...", "answer": "...", "choices": ["A) ...", "B) ...", "C) ...", "D) ..."], "explanation": "..."}}],
  "vocabulary": [{{"word": "...", "definition": "...", "example": "..."}}]
}}"""

                print("[LEARNING_PACK] Generating AI content...")
                model = get_pro_model()
                ai_res = generate_with_pro_model(model, ai_prompt)
                
                # Parse JSON
                start = ai_res.find('{')
                end = ai_res.rfind('}') + 1
                content = json.loads(ai_res[start:end])
                
                # Update vocab history
                new_vocab = [v['word'] for v in content.get('vocabulary', [])]
                if new_vocab:
                    user_ref.update({"stats.vocabHistory": firestore.ArrayUnion(new_vocab)})
                
                # ===== CALCULATE TOP FOCUS AREAS (Restored) =====
                mistake_counts = {}
                for c in all_corrections:
                    m_type = c.get('type', 'General').lower()
                    if 'grammar' in m_type: m_type = 'Grammar'
                    elif 'spelling' in m_type: m_type = 'Spelling'
                    elif 'vocab' in m_type: m_type = 'Vocabulary'
                    elif 'tense' in m_type: m_type = 'Verb Tenses'
                    else: m_type = m_type.title()
                    mistake_counts[m_type] = mistake_counts.get(m_type, 0) + 1
                
                sorted_types = sorted(mistake_counts.items(), key=lambda x: x[1], reverse=True)[:3]

                # ===== GENERATE PDF =====
                buffer = BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                        rightMargin=20*mm, leftMargin=20*mm,
                                        topMargin=20*mm, bottomMargin=20*mm)
                
                def add_footer(canvas, doc):
                    canvas.saveState()
                    canvas.setFont('Helvetica', 9)
                    canvas.setFillColor(colors.HexColor('#9CA3AF'))
                    text = "Fluency Pro - Complete Learning Pack | Page %d of 6" % doc.page
                    canvas.drawCentredString(A4[0]/2, 10*mm, text)
                    canvas.restoreState()
                
                styles = getSampleStyleSheet()
                
                # Define styles - TRULY NO GAP between question and options
                title_style = ParagraphStyle('Title', fontSize=22, textColor=colors.HexColor('#10B981'), alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=5)
                subtitle_style = ParagraphStyle('Subtitle', fontSize=11, textColor=colors.HexColor('#6B7280'), alignment=TA_CENTER, spaceAfter=10)
                section_header = ParagraphStyle('SectionH', fontSize=16, textColor=colors.HexColor('#1F2937'), fontName='Helvetica-Bold', spaceBefore=25, spaceAfter=15)
                body_style = ParagraphStyle('Body', fontSize=11, textColor=colors.HexColor('#374151'), spaceAfter=6, leading=15)
                small_style = ParagraphStyle('Small', fontSize=10, textColor=colors.HexColor('#6B7280'), spaceAfter=3, leading=13)
                # Question: spaceAfter=0 so options start IMMEDIATELY below
                question_style = ParagraphStyle('Question', fontSize=11, textColor=colors.HexColor('#1F2937'), fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=0, leading=14)
                # Options: spaceBefore=0, directly after question
                options_style = ParagraphStyle('Options', fontSize=10, textColor=colors.HexColor('#6B7280'), leftIndent=5, spaceBefore=0, spaceAfter=4, leading=12)
                vocab_word = ParagraphStyle('VocabWord', fontSize=12, textColor=colors.HexColor('#4338CA'), fontName='Helvetica-Bold', spaceBefore=15, spaceAfter=3)
                vocab_def = ParagraphStyle('VocabDef', fontSize=10, textColor=colors.HexColor('#374151'), leftIndent=8, spaceAfter=2, leading=13)
                answer_style = ParagraphStyle('Answer', fontSize=10, textColor=colors.HexColor('#059669'), fontName='Helvetica-Bold', spaceAfter=1, spaceBefore=4)
                tip_style = ParagraphStyle('Tip', fontSize=10, textColor=colors.HexColor('#7C3AED'), backColor=colors.HexColor('#F3E8FF'), leftIndent=8, spaceBefore=3, spaceAfter=6, leading=12)
                footer_style = ParagraphStyle('Footer', fontSize=9, textColor=colors.HexColor('#9CA3AF'), alignment=TA_CENTER, spaceBefore=20)
                
                story = []
                
                # ===== PAGE 1: Progress Summary =====
                # 3-Column Header with Unicode stars (sleek border)
                header_data = [[
                    Paragraph(f"<font size='18' color='{shield_color}'>{shield_stars}</font><br/><font size='10' color='{shield_color}'><b>{shield_label}</b></font>", 
                              ParagraphStyle('Shield', alignment=TA_CENTER)),
                    Paragraph(f"<font size='22' color='#10B981'><b>FLUENCY PRO</b></font><br/><font size='11' color='#6B7280'>Complete Learning Pack</font>", 
                              ParagraphStyle('Title', alignment=TA_CENTER)),
                    Paragraph(f"<font size='11' color='#374151'>{now.strftime('%B %d, %Y')}</font><br/><font size='9' color='#9CA3AF'>{filter_label}</font>", 
                              ParagraphStyle('Date', alignment=TA_CENTER))
                ]]
                header_table = Table(header_data, colWidths=[42*mm, 88*mm, 42*mm])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#10B981')),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
                    ('TOPPADDING', (0, 0), (-1, -1), 15),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(header_table)
                story.append(Spacer(1, 15))
                
                # Stats Box Label - Clarify it's Lifetime stats
                story.append(Paragraph("<font color='#6B7280'><b>📊 YOUR DASHBOARD STATS (LIFETIME)</b></font>", 
                                       ParagraphStyle('StatsLabel', fontSize=10, alignment=TA_CENTER, spaceAfter=8)))
                
                # Stats Box - SHOW DASHBOARD STATS (Lifetime)
                stats_data = [
                    [f"{total_sessions}", f"{int(avg_score)}%", f"{streak}"],
                    ["Total Sessions", "Avg Accuracy", "Day Streak"]
                ]
                stats_table = Table(stats_data, colWidths=[60*mm, 60*mm, 50*mm])
                stats_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F0FDF4')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#047857')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 26),
                    ('FONTSIZE', (0, 1), (-1, 1), 11),
                    ('TEXTCOLOR', (0, 1), (-1, 1), colors.gray),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                    ('TOPPADDING', (0, 0), (-1, 0), 10),
                    ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#10B981')),
                ]))
                story.append(stats_table)
                
                # Period Stats Row (Highlighted, Extra Spacing)
                story.append(Spacer(1, 12))
                period_text = f"<b>{filter_label} Stats:</b>  {period_sessions} Sessions  |  {time_spent_str} Time Spent  |  {period_avg_accuracy}% Accuracy"
                p_style = ParagraphStyle('PeriodStats', parent=body_style, alignment=TA_CENTER, textColor=colors.HexColor('#1F2937'), backColor=colors.HexColor('#E5E7EB'), borderPadding=6)
                story.append(Paragraph(period_text, p_style))
                
                story.append(Paragraph(f"{level_icon} Level: {level_name} | Total XP: {points:,.0f}", 
                                       ParagraphStyle('Level', fontSize=14, textColor=colors.HexColor('#6366F1'), alignment=TA_CENTER, spaceBefore=12)))
                story.append(Spacer(1, 20))
                
                # AI Insights
                insights = content.get('insights', {})
                story.append(Paragraph("<b>PERFORMANCE ANALYSIS</b>", section_header))
                
                weak_points = insights.get('weakPoints', [])
                strong_points = insights.get('strongPoints', [])
                
                # Colored Blocks for Analysis
                # Weak Points (Reddish)
                weak_text = "<b><font color='#DC2626'>AREAS TO IMPROVE</font></b><br/>"
                for wp in weak_points[:3]:
                    weak_text += f"<font size='11'>• <b>{wp.get('category', '')}:</b> {wp.get('detail', '')}</font><br/><br/>"
                
                weak_data = [[Paragraph(weak_text, body_style)]]
                weak_table = Table(weak_data, colWidths=[175*mm])
                weak_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(weak_table)
                story.append(Spacer(1, 10))
                
                # Strong Points (Greenish)
                strong_text = "<b><font color='#16A34A'>YOUR STRENGTHS</font></b><br/>"
                for sp in strong_points[:2]:
                    strong_text += f"<font size='11'>• <b>{sp.get('category', '')}:</b> {sp.get('detail', '')}</font><br/><br/>"
                
                strong_data = [[Paragraph(strong_text, body_style)]]
                strong_table = Table(strong_data, colWidths=[175*mm])
                strong_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0FDF4')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(strong_table)
                
                story.append(Spacer(1, 15))

                # ===== TOP FOCUS AREAS (Restored & Counted) =====
                if sorted_types:
                    story.append(Spacer(1, 10))
                    focus_text = "<b><font size='12' color='#DC2626'>TOP FOCUS AREAS:</font></b> "
                    # Show counts: "Grammar (9)"
                    focus_items = [f"<b>{m_type}</b> ({count})" for m_type, count in sorted_types]
                    focus_text += "  •  ".join(focus_items)
                    story.append(Paragraph(focus_text, ParagraphStyle('Focus', alignment=TA_CENTER)))

                story.append(Spacer(1, 15))
                story.append(Paragraph("<i>'Every mistake is a step towards mastery. Keep practicing!'</i>", 
                                       ParagraphStyle('Quote', fontSize=13, textColor=colors.HexColor('#7C3AED'), alignment=TA_CENTER, spaceBefore=10)))
                
                # Page break before Quiz
                story.append(PageBreak())
                
                # ===== GRAMMAR QUIZ =====
                quiz = content.get('quiz', [])
                story.append(Paragraph("<b>PART 1: GRAMMAR CHALLENGE</b>", section_header))
                story.append(Paragraph("Fill in the blanks with the correct answer.", body_style))
                story.append(Spacer(1, 15))
                
                for i, q in enumerate(quiz[:25], 1):
                    # Keep Question + Options together
                    q_block = []
                    q_block.append(Paragraph(f"<b>Q{i}.</b> {q.get('question', '')}", question_style))
                    q_block.append(Spacer(1, 6))
                    
                    choices = q.get('choices', [])
                    choices_text = "   ".join(choices[:4])
                    q_block.append(Paragraph(choices_text, options_style))
                    q_block.append(Spacer(1, 8))
                    
                    story.append(KeepTogether(q_block))
                
                story.append(Spacer(1, 20))

                # ===== ANSWER KEY (Immediately after Quiz) =====
                story.append(Paragraph("<b>ANSWER KEY</b>", section_header))
                for i, q in enumerate(quiz[:25], 1):
                    key_block = []
                    key_block.append(Paragraph(f"<b>Q{i}: {q.get('answer', '')}</b>", answer_style))
                    key_block.append(Paragraph(f"<i>{q.get('explanation', '')}</i>", small_style))
                    story.append(KeepTogether(key_block))
                
                story.append(PageBreak())
                
                # ===== VOCABULARY =====
                vocab = content.get('vocabulary', [])
                story.append(Paragraph("<b>PART 2: VOCABULARY BUILDER</b>", section_header))
                story.append(Paragraph("Master these 10 new words to upgrade your English!", body_style))
                story.append(Spacer(1, 15))
                
                for i, v in enumerate(vocab[:10], 1):
                    v_block = []
                    v_block.append(Paragraph(f"{i}. {v.get('word', '')}", vocab_word))
                    v_block.append(Paragraph(f"<b>Definition:</b> {v.get('definition', '')}", vocab_def))
                    v_block.append(Paragraph(f"<b>Example:</b> <i>\"{v.get('example', '')}\"</i>", vocab_def))
                    v_block.append(Spacer(1, 12))
                    story.append(KeepTogether(v_block))
                
                story.append(PageBreak())
                
                # ===== CORRECTIONS (Limit 35) =====
                story.append(Paragraph("<b>YOUR RECENT CORRECTIONS</b>", section_header))
                story.append(Paragraph("Review these mistakes to avoid repeating them!", body_style))
                story.append(Spacer(1, 15))
                
                for i, corr in enumerate(all_corrections[:35], 1):
                    original = corr.get('original', '')
                    corrected = corr.get('corrected', '')
                    corr_type = corr.get('type', 'General')
                    explanation = corr.get('explanation', '')
                    
                    c_block = []
                    c_block.append(Paragraph(f"<b>#{i} | {corr_type}</b>", ParagraphStyle('CorrH', fontSize=11, textColor=colors.HexColor('#9CA3AF'), spaceAfter=4)))
                    c_block.append(Paragraph(f"<font color='#DC2626'><b>✗</b> YOUR VERSION:</font> \"{original}\"", body_style))
                    c_block.append(Paragraph(f"<font color='#059669'><b>✓</b> CORRECT:</font> \"{corrected}\"", body_style))
                    if explanation:
                        c_block.append(Paragraph(f"TIP: {explanation}", tip_style))
                    c_block.append(Spacer(1, 12))
                    story.append(KeepTogether(c_block))
                
                # Learning Notes Box
                story.append(Spacer(1, 20))
                notes_text = """<b><font color='#4338CA'>📚 HOW TO IMPROVE FROM CORRECTIONS:</font></b><br/><br/>
                <font size='10'>1. <b>Read aloud</b> the correct version 3 times to build muscle memory.<br/>
                2. <b>Write it down</b> - physically writing reinforces learning.<br/>
                3. <b>Create sentences</b> using the corrected phrase in new contexts.<br/>
                4. <b>Review weekly</b> - revisit this PDF to refresh your memory.</font>"""
                notes_data = [[Paragraph(notes_text, body_style)]]
                notes_table = Table(notes_data, colWidths=[175*mm])
                notes_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EEF2FF')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 12),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                    ('TOPPADDING', (0, 0), (-1, -1), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#6366F1')),
                ]))
                story.append(notes_table)
                story.append(Spacer(1, 15))
                
                story.append(Paragraph("Great job! Keep learning with Fluency Pro!", 
                                       ParagraphStyle('End', fontSize=15, textColor=colors.HexColor('#10B981'), alignment=TA_CENTER, fontName='Helvetica-Bold', spaceBefore=20)))
                
                # Build with Footer Callback
                doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
                pdf_bytes = buffer.getvalue()
                buffer.close()
                
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                
                # --- SAVE TO HISTORY ---
                history_id = None
                creation_time = now.isoformat()

                try:
                    history_ref = user_ref.collection('pdfHistory')
                    print(f"[HISTORY_SAVE] Creating new history document...")
                    
                    # Create new history doc
                    update_time, doc_ref = history_ref.add({
                        'generatedAt': firestore.SERVER_TIMESTAMP,
                        'filter': date_filter,
                        'filterLabel': filter_label,
                        'pages': 6,
                        'quizCount': len(quiz),
                        'vocabCount': len(vocab),
                        'correctionsCount': len(all_corrections),
                        'pdf': pdf_base64 # Store the full PDF
                    })
                    history_id = doc_ref.id
                    print(f"[HISTORY_SAVE] ✓ Created document: {history_id}")
                    
                    # Cleanup old history (keep last 10)
                    # IMPORTANT: Exclude the newly created document to avoid race condition
                    all_docs = history_ref.order_by('generatedAt', direction=firestore.Query.DESCENDING).get()
                    print(f"[HISTORY_CLEANUP] Total docs found: {len(all_docs)}")
                    
                    if len(all_docs) > 10:
                        # Only delete docs that are NOT the new one
                        docs_to_delete = [d for d in all_docs[10:] if d.id != history_id]
                        print(f"[HISTORY_CLEANUP] Deleting {len(docs_to_delete)} old docs")
                        for doc in docs_to_delete:
                            doc.reference.delete()
                    else:
                        print(f"[HISTORY_CLEANUP] No cleanup needed ({len(all_docs)} <= 10)")
                        
                except Exception as h_err:
                    print(f"[HISTORY_SAVE_ERR] {h_err}")
                    import traceback
                    traceback.print_exc()
                
                return (json.dumps({
                    "pdf": pdf_base64,
                    "historyId": history_id,
                    "generatedAt": creation_time,
                    "filterLabel": filter_label,
                    "pages": 6,
                    "quizCount": len(quiz),
                    "vocabCount": len(vocab),
                    "correctionsCount": len(all_corrections)
                }), 200, headers)
                
            except Exception as e:
                print(f"[LEARNING_PACK_ERROR] {e}")
                import traceback
                traceback.print_exc()
                return (json.dumps({"error": str(e)}), 500, headers)

        return (json.dumps({"error": f"Unknown type: {req_type}"}), 400, headers)

    except Exception as e:
        print(f"[GLOBAL_ERR] Type: {req_type}, Error: {e}")
        return (json.dumps({"error": str(e)}), 500, headers)
