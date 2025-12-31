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

Recent chat:
{history_text}

Them: {text}

INSTRUCTIONS:
- Reply as {bot['name']} texting a friend on WhatsApp
- Keep it SHORT (1-2 sentences max)
- Be casual and natural, NOT formal
- Ask follow-up questions sometimes to keep chat going
- Make your typical grammar mistakes as per your character
- NO role-play, NO scenarios - just casual friendly chat
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
            
            # If both players have at least some messages, analyze
            if len(p1_hist) > 0 or len(p2_hist) > 0:
                prompt = (
                    "ACT AS A STRICT ENGLISH EXAMINER. Analyze the conversation history below.\n"
                    f"Player 1 (Human): {p1_hist}\n"
                    f"Player 2 (Opponent): {p2_hist}\n\n"
                    "Calculate 4 scores (0-100) for EACH player based on these rules:\n"
                    "1. VOCABULARY: Range of words used. Deduct for repetition or basic words.\n"
                    "2. GRAMMAR: Deduct 5 points per error (tense, articles, prepositions).\n"
                    "3. FLUENCY: Smoothness and natural flow. Deduct for awkward phrasing.\n"
                    "4. SENTENCE: Sentence structure variety and complexity. Deduct for short/fragmented sentences.\n\n"
                    "Determine the WINNER based on the higher TOTAL score.\n\n"
                    "IMPORTANT: Provide SPECIFIC feedback for EACH player mentioning their actual strengths and weaknesses from their messages.\n\n"
                    "Return strict JSON only:\n"
                    "{\n"
                    "  \"player1\": { \"vocab\": 75, \"grammar\": 80, \"fluency\": 70, \"sentence\": 75, \"total\": 300, \"feedback\": \"You used good vocabulary like 'consultation' but made a grammar error with articles.\" },\n"
                    "  \"player2\": { \"vocab\": 80, \"grammar\": 85, \"fluency\": 90, \"sentence\": 85, \"total\": 340, \"feedback\": \"Your sentences were well-structured and natural. Watch for tense consistency.\" },\n"
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


    return (json.dumps({"error": f"Unknown type: {req_type}, keys: {list(data.keys())}"}), 400, headers)
