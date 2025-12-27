import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore, collection, query, getDoc, setDoc, onSnapshot,
  doc, serverTimestamp, orderBy
} from 'firebase/firestore';
import {
  Send, Zap, Swords, Trophy, Briefcase, Coffee, Stethoscope,
  Train, Plane, Loader2, LogOut, MessageCircle, Target,
  Users, Hash, Clock, Award, User, X, Info, Play, Menu, Settings, HelpCircle, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import WinnerReveal from './WinnerReveal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let auth, db, analytics;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  analytics = getAnalytics(app);
} catch (e) { console.error("Firebase init error", e); }

const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🦄', '🐲', '🦅', '🐬', '🦋', '🌸'];

const SIMULATIONS = [
  { id: 'sim_interview', cat: 'Career', title: 'Job Interview', icon: Briefcase, color: 'bg-blue-500', desc: 'Nail your next interview.', stages: ['Reception', 'Interview', 'Exit'], greeting: "Welcome! Have a seat. Why should we hire you? 💼" },
  { id: 'sim_cafe', cat: 'Social', title: 'Coffee Shop', icon: Coffee, color: 'bg-amber-500', desc: 'Order complex drinks.', stages: ['Counter', 'Table', 'Exit'], greeting: "Hi! What can I get you today? ☕" },
  { id: 'sim_doctor', cat: 'Health', title: 'Doctor Visit', icon: Stethoscope, color: 'bg-red-500', desc: 'Describe symptoms clearly.', stages: ['Waiting', 'Consultation', 'Pharmacy'], greeting: "Come in. What's the problem? 🏥" },
  { id: 'sim_station', cat: 'Travel', title: 'Train Station', icon: Train, color: 'bg-green-500', desc: 'Buy tickets confidently.', stages: ['Counter', 'Platform', 'Train'], greeting: "Ticket for which train? 🚉" },
  { id: 'sim_travel', cat: 'Travel', title: 'Travel Agency', icon: Plane, color: 'bg-indigo-500', desc: 'Plan your trip.', stages: ['Meeting', 'Planning', 'Booking'], greeting: "Hey! Where would you like to go? 🗺️" },
  { id: 'sim_friend', cat: 'Social', title: 'Casual Chat', icon: Users, color: 'bg-pink-500', desc: 'Small talk practice.', stages: ['Meeting', 'Chatting', 'Goodbye'], greeting: "Hi friend! How have you been? 👋" },
];

const STAT_INFO = {
  streak: { title: 'Streak 🔥', desc: 'Number of consecutive days you have practiced. Keep it going!' },
  points: { title: 'Total Points ⭐', desc: 'Points earned from sessions. Higher scores = more points.' },
  level: { title: 'Your Level 🏆', desc: 'Your rank based on total points. Level up by practicing!' },
  avgScore: { title: 'Average Score 📊', desc: 'Your average performance score across all sessions.' },
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [view, setView] = useState('landing');

  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [stats, setStats] = useState({ streak: 0, points: 0, level: 'Rookie', sessions: 0, avgScore: 0 });
  const [userAvatar, setUserAvatar] = useState('🦁');

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState("Finding a partner...");
  const searchTimeoutRef = useRef(null);
  const matchListener = useRef(null);
  const chatListener = useRef(null);
  const randomSearchListener = useRef(null);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStatInfo, setShowStatInfo] = useState(null);

  const [dualAnalysis, setDualAnalysis] = useState(null);
  const [showWinnerReveal, setShowWinnerReveal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // 'practice' | 'compete' | 'friend' | 'google' | 'guest'
  const [recentChats, setRecentChats] = useState([
    { id: 'recent_1', type: 'simulation', title: 'Job Interview', icon: '💼', lastMessage: 'Why should we hire you?', timestamp: new Date(Date.now() - 3600000), simId: 'sim_interview' },
    { id: 'recent_2', type: 'friend', title: 'Alex', icon: '🦊', lastMessage: 'Great practice session!', timestamp: new Date(Date.now() - 86400000), friendId: 'friend_123', friendOnline: true },
    { id: 'recent_3', type: 'simulation', title: 'Coffee Shop', icon: '☕', lastMessage: 'Large latte, please!', timestamp: new Date(Date.now() - 172800000), simId: 'sim_cafe' },
  ]);
  const [pendingInvites, setPendingInvites] = useState([]);

  const messagesEndRef = useRef(null);

  // Effects
  useEffect(() => {
    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch(console.error);
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u); setIsAuthChecking(false);
        if (u) setView(v => v === 'landing' ? 'dashboard' : v); else { setUser(null); setView('landing'); }
      });
      return () => unsub();
    } else setIsAuthChecking(false);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStats(prev => ({ ...prev, ...data.stats }));
          if (data.userAvatar) setUserAvatar(data.userAvatar);
        } else {
          await setDoc(docRef, { uid: user.uid, stats, userAvatar, lastBots: [] });
        }
      } catch (e) { console.error(e); }
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); setTimerActive(false); endSession(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [timerActive]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const handleLogin = async (p) => { try { if (p === 'google') await signInWithPopup(auth, new GoogleAuthProvider()); else await signInAnonymously(auth); } catch (e) { } };

  const saveUserData = async (newStats, newAvatar) => {
    if (!user) return;
    try { await setDoc(doc(db, 'users', user.uid), { stats: newStats || stats, userAvatar: newAvatar || userAvatar }, { merge: true }); } catch (e) { }
  };

  const selectAvatar = (av) => { setUserAvatar(av); saveUserData(null, av); setShowProfile(false); };

  // Matchmaking
  const createPrivateRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    try {
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'create_room', userId: user.uid, userName: user.displayName || 'Host', userAvatar })
      });
      const data = await res.json();
      if (data.success) {
        setRoomCode(data.roomCode);
        const unsub = onSnapshot(doc(db, 'queue', data.roomId), (snap) => {
          if (snap.exists() && snap.data().status === 'matched') {
            unsub();
            joinMatch(data.roomId, { id: snap.data().player2Id, name: snap.data().player2Name, avatar: snap.data().player2Avatar }, 'human', 'Friend Match');
            setShowRoomInput(false); setRoomCode("");
          }
        });
      } else { alert(data.error || 'Failed to create room'); }
    } catch (e) { alert(e.message); } finally { setIsCreatingRoom(false); }
  };

  const joinRoom = async (code) => {
    if (!code || code.length < 4) return;
    try {
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'join_room', roomCode: code, userId: user.uid, userName: user.displayName || 'Friend', userAvatar })
      });
      const data = await res.json();
      if (data.success) {
        joinMatch(data.roomId, data.opponent, 'human', 'Friend Match');
        setShowRoomInput(false);
      } else alert(data.error || 'Failed to join room');
    } catch (e) { alert(e.message); }
  };

  const startRandomMatch = async () => {
    if (isSearching) return;
    setIsSearching(true); setSearchStatusText("Finding a partner...");
    setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'find_random_match', userId: user.uid, userName: user.displayName || 'Player', userAvatar })
        });
        const data = await res.json();
        if (data.success) {
          if (data.matched) { joinMatch(data.roomId, data.opponent, 'human', data.topic); }
          else {
            setSearchStatusText("Waiting for opponent...");
            searchTimeoutRef.current = setTimeout(() => { setSearchStatusText("Connecting you..."); triggerBot(data.roomId); }, 8000);
            randomSearchListener.current = onSnapshot(doc(db, 'queue', data.roomId), (snap) => {
              if (snap.exists() && snap.data().status === 'matched' && !snap.data().isBotMatch) {
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                const r = snap.data(); const amI = r.hostId === user.uid;
                joinMatch(data.roomId, { id: amI ? r.player2Id : r.hostId, name: amI ? r.player2Name : r.userName, avatar: amI ? r.player2Avatar : r.userAvatar }, 'human', r.roleData?.topic);
              }
            });
          }
        } else { alert("Error finding match"); setIsSearching(false); }
      } catch (e) { console.error(e); setIsSearching(false); }
    }, 1000);
  };

  const triggerBot = async (roomId) => {
    try {
      const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'trigger_bot_match', roomId, userId: user.uid }) });
      const data = await res.json();
      if (data.success && data.matched) joinMatch(data.roomId, data.opponent, 'human', data.topic);
    } catch (e) { setIsSearching(false); }
  };

  const joinMatch = (roomId, opponent, type, topic) => {
    if (randomSearchListener.current) randomSearchListener.current();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearching(false);
    setActiveSession({ id: roomId, opponent, type, topic });
    setMessages([{ id: 'sys', sender: 'system', text: `Connected with ${opponent.name}` }]);
    setTimeRemaining(420); setTimerActive(true); setView('chat');

    const q = query(collection(db, 'queue', roomId, 'messages'), orderBy('createdAt'));
    chatListener.current = onSnapshot(q, (snap) => {
      const msgs = []; snap.forEach(d => msgs.push({ id: d.id, sender: d.data().senderId === user.uid ? 'me' : 'opponent', text: d.data().text }));
      setMessages(prev => [...prev.filter(m => m.sender === 'system'), ...msgs]);
    });
    matchListener.current = onSnapshot(doc(db, 'queue', roomId), (snap) => {
      if (snap.exists() && snap.data().status === 'ended' && snap.data().endedBy !== user.uid) endSession(false);
    });
  };

  const startSimulation = (sim) => {
    setActiveSession({ id: sim.id, opponent: { name: sim.title, avatar: '🤖' }, type: 'bot', topic: sim.desc });
    setMessages([{ id: 'sys', sender: 'system', text: sim.greeting }]);
    setCurrentStage(sim.stages[0]);
    setView('chat');
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeSession) return;
    const text = inputText; setInputText("");
    if (activeSession.type === 'bot') {
      setMessages(prev => [...prev, { id: 'loc' + Date.now(), sender: 'me', text }]);
      try {
        const history = messages.filter(m => m.sender !== 'system').map(m => m.text);
        console.log('Sending to backend:', { type: 'chat', message: text, personaId: activeSession.id });
        const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat', message: text, personaId: activeSession.id, context: activeSession.topic, history, stage: currentStage }) });
        const data = await res.json();
        console.log('Backend response:', data);
        if (data.reply) setTimeout(() => setMessages(prev => [...prev, { id: 'bot' + Date.now(), sender: 'opponent', text: data.reply }]), 800);
        else if (data.error) {
          console.error('Backend error:', data.error);
          setTimeout(() => setMessages(prev => [...prev, { id: 'err' + Date.now(), sender: 'opponent', text: 'Sorry, I didn\'t catch that.' }]), 800);
        }
      } catch (e) {
        console.error('Chat fetch error:', e);
        setMessages(prev => [...prev, { id: 'err' + Date.now(), sender: 'opponent', text: 'Connection issue. Try again.' }]);
      }
    } else {
      try { await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'send_message', roomId: activeSession.id, text, senderId: user.uid }) }); } catch (e) { console.error('Send message error:', e); }
    }
  };

  const endSession = async (initiatedByMe = true) => {
    setTimerActive(false);
    if (initiatedByMe && activeSession?.type !== 'bot') {
      try { await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'end_session', roomId: activeSession.id, endedBy: user.uid }) }); } catch (e) { }
    }
    if (chatListener.current) chatListener.current();
    if (matchListener.current) matchListener.current();

    if (activeSession?.type === 'bot') {
      setStats(prev => { const n = { ...prev, sessions: prev.sessions + 1, points: prev.points + 15 }; saveUserData(n, null); return n; });
      setView('dashboard'); setActiveSession(null);
    } else {
      setView('analyzing');
      try {
        const myMsgs = messages.filter(m => m.sender === 'me').map(m => m.text);
        const oppMsgs = messages.filter(m => m.sender === 'opponent').map(m => m.text);
        const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'analyze', player1History: myMsgs, player2History: oppMsgs }) });
        const data = await res.json();
        setDualAnalysis(data);
        const myScore = data?.player1?.overall || 70;
        setStats(prev => { const n = { ...prev, sessions: prev.sessions + 1, points: prev.points + myScore, avgScore: Math.round((prev.avgScore * prev.sessions + myScore) / (prev.sessions + 1)) }; saveUserData(n, null); return n; });
        setShowWinnerReveal(true);
        setView('dashboard');
      } catch (e) { setView('dashboard'); }
      setActiveSession(null);
    }
  };

  // Loading
  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>;

  // LOGIN
  if (view === 'landing') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-teal-200 to-emerald-200 rounded-full opacity-50 blur-3xl"></div>

        {/* Premium Logo */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <MessageCircle className="text-white" size={26} />
            </div>
            <h1 className="text-4xl font-black">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
              <span className="text-gray-900">ency</span>
            </h1>
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">PRO</span>
          </div>
        </div>

        {/* Feature-focused tagline */}
        <div className="relative z-10 mb-8">
          <p className="text-gray-600 text-lg font-medium mb-3">Master English Through</p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <MessageCircle size={14} /> Real Conversations
            </span>
            <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <Swords size={14} /> Live Competitions
            </span>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <Sparkles size={14} /> AI Feedback
            </span>
          </div>
        </div>

        {/* Social Proof */}
        <div className="relative z-10 mb-8 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
          <div className="flex -space-x-2">
            {['🦁', '🐯', '🦊', '🐼'].map((emoji, i) => (
              <div key={i} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg shadow-sm border-2 border-white">{emoji}</div>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-emerald-700 font-bold text-sm">4,200+ learners</span>
            </div>
            <span className="text-gray-500 text-xs">practicing right now</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 space-y-3">
          <button
            onClick={() => { setLoadingAction('google'); handleLogin('google'); }}
            disabled={loadingAction === 'google'}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-emerald-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {loadingAction === 'google' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span>or try it first</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={() => { setLoadingAction('guest'); handleLogin('guest'); }}
            disabled={loadingAction === 'guest'}
            className="w-full py-4 border-2 border-gray-200 rounded-2xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loadingAction === 'guest' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <User size={18} />
                Continue as Guest
              </>
            )}
          </button>
        </div>

        <p className="relative z-10 mt-8 text-xs text-gray-400">By continuing you agree to Terms & Privacy Policy.</p>
      </div>
    </div>
  );

  // DASHBOARD
  if (view === 'dashboard' && user) return (
    <div className="min-h-screen bg-gray-100 font-sans md:py-8">
      <div className="max-w-2xl mx-auto bg-white shadow-xl md:rounded-3xl relative">
        {/* HEADER */}
        <header className="px-4 py-3 flex justify-between items-center border-b border-gray-100 bg-white sticky top-0 z-20">
          <button onClick={() => setShowMenu(true)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <MessageCircle className="text-white" size={18} />
            </div>
            <h1 className="text-xl font-black">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
              <span className="text-gray-900">ency</span>
            </h1>
            <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-full">PRO</span>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl hover:ring-2 hover:ring-emerald-200 transition-all">
            {userAvatar}
          </button>
        </header>

        <main className="p-4 space-y-4">
          {/* Quick Stats Bar */}
          <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-3">
            <button onClick={() => setShowStatInfo('streak')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Zap className="text-orange-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Streak</div>
                <div className="text-sm font-black text-gray-900">{stats.streak || 0} days</div>
              </div>
            </button>
            <div className="w-px h-8 bg-gray-200"></div>
            <button onClick={() => setShowStatInfo('points')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="text-purple-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Points</div>
                <div className="text-sm font-black text-gray-900">{stats.points || 0}</div>
              </div>
            </button>
            <div className="w-px h-8 bg-gray-200"></div>
            <button onClick={() => setShowStatInfo('avgScore')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Target className="text-emerald-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Accuracy</div>
                <div className="text-sm font-black text-emerald-600">{stats.avgScore || 0}%</div>
              </div>
            </button>
          </div>

          {/* MAIN ACTION - Free Practice */}
          <button
            onClick={() => { setLoadingAction('practice'); setTimeout(() => { setView('simlab'); setLoadingAction(null); }, 300); }}
            disabled={loadingAction === 'practice'}
            className="w-full py-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-3xl shadow-xl shadow-emerald-200 text-white group relative overflow-hidden hover:shadow-2xl hover:shadow-emerald-300 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center gap-4">
              {loadingAction === 'practice' ? (
                <Loader2 className="animate-spin" size={32} />
              ) : (
                <>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Play className="fill-white" size={28} />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-black">Start Practicing</div>
                    <div className="text-emerald-100 text-sm">Master real-life conversations</div>
                  </div>
                </>
              )}
            </div>
          </button>

          {/* SECONDARY ACTIONS */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setLoadingAction('compete'); startRandomMatch(); }}
              disabled={isSearching || loadingAction === 'compete'}
              className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white text-left hover:from-black hover:to-gray-900 transition-all relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              {(isSearching || loadingAction === 'compete') ? (
                <Loader2 className="animate-spin absolute right-4 top-4 text-yellow-400" size={20} />
              ) : (
                <Swords className="absolute right-3 top-3 opacity-20" size={36} />
              )}
              <Trophy className="text-yellow-400 mb-2" size={24} />
              <div className="font-bold text-lg">Battle Mode</div>
              <div className="text-gray-400 text-xs">Challenge global players</div>
            </button>
            <button
              onClick={() => { setLoadingAction('friend'); setShowRoomInput(true); setTimeout(() => setLoadingAction(null), 300); }}
              disabled={loadingAction === 'friend'}
              className="p-5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white text-left hover:from-indigo-700 hover:to-violet-700 transition-all relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              {loadingAction === 'friend' ? (
                <Loader2 className="animate-spin absolute right-4 top-4" size={20} />
              ) : (
                <Users className="absolute right-3 top-3 opacity-20" size={36} />
              )}
              <Hash className="text-indigo-200 mb-2" size={24} />
              <div className="font-bold text-lg">With Friends</div>
              <div className="text-indigo-200 text-xs">Create private room</div>
            </button>
          </div>

          {/* User Info Card */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
              {userAvatar}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{user.isAnonymous ? 'Guest Player' : user.displayName || 'Player'}</div>
              <div className="text-xs text-gray-500">Level: <span className="text-emerald-600 font-semibold">{stats.level}</span></div>
            </div>
            <button onClick={() => setShowStatInfo('level')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold hover:bg-emerald-200 transition-colors">
              View Stats
            </button>
          </div>

          {/* Pending Friend Invites */}
          {pendingInvites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl animate-bounce">
                🎮
              </div>
              <div className="flex-1">
                <div className="font-bold text-indigo-900 text-sm">{pendingInvites[0].name} wants to practice!</div>
                <div className="text-xs text-indigo-600">Waiting for you to join...</div>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                Join Now
              </button>
            </motion.div>
          )}

          {/* Recent Chats Section */}
          {recentChats.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-500 uppercase">Recent Conversations</h3>
                <button className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">See All</button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {recentChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      if (chat.type === 'simulation') {
                        const sim = SIMULATIONS.find(s => s.id === chat.simId);
                        if (sim) startSimulation(sim);
                      } else if (chat.type === 'friend') {
                        // Start friend match flow
                        setShowRoomInput(true);
                      }
                    }}
                    className="flex-shrink-0 w-40 bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-emerald-300 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{chat.icon}</span>
                      {chat.type === 'friend' && chat.friendOnline && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-gray-900 text-sm truncate group-hover:text-emerald-700">{chat.title}</div>
                    <div className="text-xs text-gray-400 truncate mt-1">{chat.lastMessage}</div>
                    <div className="text-[10px] text-gray-300 mt-2">
                      {new Date(chat.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* MENU DRAWER */}
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMenu(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl overflow-y-auto flex flex-col"
              >
                <div className="p-6 flex flex-col flex-1 min-h-0">
                  {/* Menu Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                        <MessageCircle className="text-white" size={18} />
                      </div>
                      <h1 className="text-xl font-black">
                        <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
                        <span className="text-gray-900">ency</span>
                      </h1>
                      <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-full">PRO</span>
                    </div>
                    <button onClick={() => setShowMenu(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {/* User Profile */}
                  <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-6 hover:bg-gray-100 transition-colors">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">{userAvatar}</div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">{user.isAnonymous ? 'Guest' : user.displayName?.split(' ')[0]}</div>
                      <div className="text-xs text-emerald-600 font-medium">{stats.level}</div>
                    </div>
                    <div className="text-gray-400">›</div>
                  </button>

                  {/* Quick Practice Section */}
                  <div className="mb-4">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 px-2">Quick Practice</div>
                    <div className="space-y-1">
                      {SIMULATIONS.slice(0, 4).map(sim => (
                        <button
                          key={sim.id}
                          onClick={() => { setShowMenu(false); startSimulation(sim); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors group"
                        >
                          <div className={`w-8 h-8 ${sim.color} rounded-lg flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                            <sim.icon size={16} />
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-700 text-sm">{sim.title}</div>
                            <div className="text-[10px] text-gray-400">{sim.desc}</div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => { setShowMenu(false); setView('simlab'); }}
                        className="w-full text-center text-xs text-emerald-600 font-semibold py-2 hover:text-emerald-700"
                      >
                        View All Simulations →
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 mb-4"></div>

                  {/* Menu Items */}
                  <nav className="space-y-1">
                    <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <User size={20} />
                      <span className="font-medium">Profile & Avatar</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <Award size={20} />
                      <span className="font-medium">Achievements</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <Settings size={20} />
                      <span className="font-medium">Settings</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <HelpCircle size={20} />
                      <span className="font-medium">Help & Support</span>
                    </button>
                  </nav>

                  {/* Divider */}
                  <div className="my-6 border-t border-gray-100"></div>

                  {/* Sign Out */}
                  <button onClick={() => { setShowMenu(false); signOut(auth); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* MODALS */}
        <AnimatePresence>
          {showWinnerReveal && dualAnalysis && <WinnerReveal analysis={dualAnalysis} myUserId={user.uid} opponentData={activeSession?.opponent} onClose={() => setShowWinnerReveal(false)} onDashboard={() => { setShowWinnerReveal(false); setView('dashboard'); }} />}
        </AnimatePresence>

        <AnimatePresence>
          {showRoomInput && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => { setShowRoomInput(false); setRoomCode(""); setRoomCodeInput(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>
                <h3 className="text-2xl font-black mb-6 text-center">Play with Friend</h3>
                {roomCode ? (
                  <div className="text-center space-y-4">
                    <div className="text-6xl font-mono font-black text-emerald-600 bg-emerald-50 py-6 rounded-2xl">{roomCode}</div>
                    <p className="text-gray-500">Share this code with your friend!</p>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on Fluency Pro! Code: ${roomCode}`)}`)} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl">Share on WhatsApp</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button onClick={createPrivateRoom} disabled={isCreatingRoom} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
                      {isCreatingRoom ? <Loader2 className="animate-spin" /> : <Hash />} Create Room
                    </button>
                    <div className="text-center text-gray-400 text-sm">— or join with code —</div>
                    <input
                      placeholder="Enter 4-digit code"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 5))}
                      className="w-full p-4 text-center text-2xl font-mono bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-emerald-400 focus:outline-none"
                      maxLength={5}
                    />
                    <button
                      onClick={() => { if (roomCodeInput.length >= 4) joinRoom(roomCodeInput); }}
                      disabled={roomCodeInput.length < 4}
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Users /> Join Room
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showProfile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>
                <h3 className="text-2xl font-black mb-6 text-center">Choose Avatar</h3>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {AVATARS.map(av => (
                    <button key={av} onClick={() => selectAvatar(av)} className={`text-4xl p-3 rounded-xl hover:bg-gray-100 transition-colors ${userAvatar === av ? 'bg-emerald-100 ring-2 ring-emerald-500' : ''}`}>{av}</button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-6">
                  <button
                    onClick={() => { setShowProfile(false); signOut(auth); }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors"
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStatInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStatInfo(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-xs text-center" onClick={e => e.stopPropagation()}>
                <div className="text-3xl mb-2">{showStatInfo === 'streak' ? '🔥' : showStatInfo === 'points' ? '⭐' : showStatInfo === 'level' ? '🏆' : '📊'}</div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{STAT_INFO[showStatInfo]?.title}</h3>
                <p className="text-gray-500 text-sm">{STAT_INFO[showStatInfo]?.desc}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // SIMULATION LAB
  if (view === 'simlab') return (
    <div className="min-h-screen bg-gray-100 font-sans md:py-8">
      <div className="max-w-2xl mx-auto bg-white shadow-xl md:rounded-3xl relative">
        <header className="px-6 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          <h1 className="text-xl font-black text-gray-900">Simulation Lab</h1>
        </header>
        <main className="p-6">
          <p className="text-gray-500 mb-6">Choose a real-life scenario to practice your English conversation skills.</p>
          <div className="grid grid-cols-2 gap-4">
            {SIMULATIONS.map(sim => (
              <button key={sim.id} onClick={() => startSimulation(sim)} className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-left hover:border-emerald-500 hover:shadow-lg transition-all group">
                <div className={`w-12 h-12 ${sim.color} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}><sim.icon size={24} /></div>
                <div className="font-bold text-gray-900">{sim.title}</div>
                <div className="text-xs text-gray-400 mt-1">{sim.desc}</div>
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );

  // CHAT
  if (view === 'chat') return (
    <div className="h-screen bg-gray-100 font-sans flex flex-col">
      <div className="max-w-2xl w-full mx-auto bg-white flex-1 shadow-xl md:my-4 md:rounded-3xl md:max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <header className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{activeSession?.opponent?.avatar || '👤'}</div>
            <div>
              <div className="font-bold text-gray-900">{activeSession?.opponent?.name}</div>
              <div className="text-xs text-red-500 font-bold flex items-center gap-1"><Clock size={12} /> {formatTime(timeRemaining)}</div>
            </div>
          </div>
          <button onClick={() => endSession(true)} className="px-4 py-2 bg-red-500 text-white font-bold rounded-full text-sm hover:bg-red-600 transition-colors">End Session</button>
        </header>

        {/* Scrollable Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : m.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
              {m.sender === 'system' ? <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-3 py-1 rounded-full">{m.text}</span> :
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${m.sender === 'me' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>{m.text}</div>}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Fixed Input */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-full border border-gray-100">
            <input autoFocus value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type your message..." className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none" />
            <button onClick={sendMessage} disabled={!inputText.trim()} className="p-2.5 bg-emerald-600 text-white rounded-full disabled:opacity-50 disabled:bg-gray-300"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );

  // ANALYZING
  if (view === 'analyzing') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans">
      <div className="max-w-md bg-white rounded-3xl shadow-xl p-10 text-center">
        <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={48} />
        <h2 className="text-xl font-black text-gray-900">Analyzing...</h2>
        <p className="text-gray-400 text-sm mt-2">Checking grammar, vocabulary, and fluency.</p>
      </div>
    </div>
  );

  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
};

export default App;
