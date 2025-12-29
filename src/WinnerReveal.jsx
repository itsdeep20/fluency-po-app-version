import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, Crown, Star, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

// Sound effect URLs (free sounds)
const SOUNDS = {
    drumRoll: 'https://assets.mixkit.co/active_storage/sfx/2548/2548-preview.mp3',
    fanfare: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
    tada: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
    applause: 'https://assets.mixkit.co/active_storage/sfx/477/477-preview.mp3',
    countUp: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
};

const WinnerReveal = ({
    dualAnalysis,
    myUserId,
    opponentData,
    onClose,
    onDashboard,
    feedbackState,
    onFeedback,
    onSetFeedbackRating,
    onSetFeedbackText
}) => {
    const [phase, setPhase] = useState(0); // 0: intro, 1: vocabulary, 2: grammar, 3: fluency, 4: sentence, 5: final, 6: winner
    const audioRef = useRef(null);

    // Player1 is always "me" - the backend receives myMsgs as player1History
    // and oppMsgs as player2History in App.jsx endSession function
    const myScores = dualAnalysis?.player1;
    const oppScores = dualAnalysis?.player2;

    // Fallback for missing data with reasonable defaults
    const safeMyScores = myScores || { vocabulary: 50, grammar: 50, fluency: 50, sentence_making: 50, overall: 50, feedback: 'Analysis unavailable' };
    const safeOppScores = oppScores || { vocabulary: 50, grammar: 50, fluency: 50, sentence_making: 50, overall: 50, feedback: 'Analysis unavailable' };

    // Calculate overall from individual scores if overall is 0 or missing
    const calculateOverall = (scores) => {
        if (scores.overall && scores.overall > 0) return scores.overall;
        const v = scores.vocabulary || 0;
        const g = scores.grammar || 0;
        const f = scores.fluency || 0;
        const s = scores.sentence_making || 0;
        if (v + g + f + s === 0) return 50; // Default if all zeros
        return Math.round((v + g + f + s) / 4);
    };

    const myTotal = calculateOverall(safeMyScores);
    const oppTotal = calculateOverall(safeOppScores);
    const winner = myTotal > oppTotal ? 'me' : (myTotal < oppTotal ? 'opponent' : 'tie');

    // Debug logging
    console.log('WinnerReveal Data:', {
        dualAnalysis,
        myScores: safeMyScores,
        oppScores: safeOppScores,
        myTotal,
        oppTotal,
        winner
    });

    const metrics = [
        { name: 'Vocabulary', key: 'vocabulary', icon: '📚', emoji: '🔤', color: 'from-emerald-500 to-green-600' },
        { name: 'Grammar', key: 'grammar', icon: '✍️', emoji: '📝', color: 'from-teal-500 to-cyan-600' },
        { name: 'Fluency', key: 'fluency', icon: '💬', emoji: '🗣️', color: 'from-blue-500 to-indigo-600' },
        { name: 'Sentence Making', key: 'sentence_making', icon: '📝', emoji: '✨', color: 'from-orange-500 to-amber-600' }
    ];

    // Play sound helper
    const playSound = (soundUrl, volume = 0.5) => {
        try {
            const audio = new Audio(soundUrl);
            audio.volume = volume;
            audio.play().catch(() => { });
        } catch (e) { }
    };

    // Animation sequence
    useEffect(() => {
        // Phase 0: Intro + drum roll
        playSound(SOUNDS.drumRoll, 0.3);

        const timers = [
            setTimeout(() => setPhase(1), 1500),  // Show vocabulary
            setTimeout(() => { setPhase(2); playSound(SOUNDS.countUp, 0.2); }, 2800),  // Show grammar
            setTimeout(() => { setPhase(3); playSound(SOUNDS.countUp, 0.2); }, 4100),  // Show fluency
            setTimeout(() => { setPhase(4); playSound(SOUNDS.countUp, 0.2); }, 5400),  // Show sentence making
            setTimeout(() => { setPhase(5); playSound(SOUNDS.tada, 0.4); }, 6700),    // Show final score
            setTimeout(() => {
                setPhase(6);
                // Winner announcement effects
                if (winner === 'me') {
                    playSound(SOUNDS.fanfare, 0.5);
                    // Massive confetti burst
                    const duration = 3000;
                    const end = Date.now() + duration;
                    const colors = ['#10B981', '#34D399', '#FBBF24', '#F472B6', '#60A5FA'];

                    (function frame() {
                        confetti({
                            particleCount: 5,
                            angle: 60,
                            spread: 55,
                            origin: { x: 0 },
                            colors: colors
                        });
                        confetti({
                            particleCount: 5,
                            angle: 120,
                            spread: 55,
                            origin: { x: 1 },
                            colors: colors
                        });
                        if (Date.now() < end) requestAnimationFrame(frame);
                    }());
                } else if (winner === 'tie') {
                    playSound(SOUNDS.applause, 0.4);
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                } else {
                    playSound(SOUNDS.applause, 0.3);
                }
            }, 8000)
        ];

        return () => timers.forEach(t => clearTimeout(t));
    }, [winner]);

    // Score counter animation
    const AnimatedScore = ({ value, delay = 0 }) => {
        const [count, setCount] = useState(0);

        useEffect(() => {
            const timer = setTimeout(() => {
                let start = 0;
                const duration = 800;
                const stepTime = 20;
                const steps = duration / stepTime;
                const increment = value / steps;

                const counter = setInterval(() => {
                    start += increment;
                    if (start >= value) {
                        setCount(value);
                        clearInterval(counter);
                    } else {
                        setCount(Math.floor(start));
                    }
                }, stepTime);

                return () => clearInterval(counter);
            }, delay);

            return () => clearTimeout(timer);
        }, [value, delay]);

        return <span>{count}</span>;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
            <motion.div
                initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                className="bg-gradient-to-br from-emerald-900 via-teal-900 to-green-900 rounded-3xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden border border-emerald-500/30 my-auto"
            >
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-emerald-400/20 rounded-full"
                            initial={{ x: Math.random() * 100 + '%', y: '100%' }}
                            animate={{ y: '-20%', opacity: [0, 1, 0] }}
                            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                        />
                    ))}
                </div>

                {/* Phase 0: Intro Header */}
                <AnimatePresence>
                    {phase >= 0 && (
                        <motion.div
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                            className="text-center mb-8 relative z-10"
                        >
                            <motion.div
                                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.5, repeat: phase < 6 ? Infinity : 0, repeatDelay: 1 }}
                                className="inline-flex items-center gap-2"
                            >
                                <Sparkles className="text-yellow-400 w-8 h-8" />
                                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-emerald-200 to-white">
                                    {phase < 6 ? '⚔️ CALCULATING RESULTS...' : '🏆 MATCH COMPLETE!'}
                                </h2>
                                <Sparkles className="text-yellow-400 w-8 h-8" />
                            </motion.div>

                            {phase < 6 && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(phase / 6) * 100}%` }}
                                    className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full mt-4 mx-auto max-w-xs"
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Player Headers */}
                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <motion.div
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className={`text-center p-4 rounded-2xl transition-all duration-500 ${phase >= 6 && winner === 'me'
                            ? 'bg-gradient-to-br from-emerald-400/30 to-green-500/30 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30'
                            : 'bg-white/10 border border-white/20'
                            }`}
                    >
                        <div className="text-4xl mb-2">👤</div>
                        <div className="font-bold text-white text-lg">You</div>
                        {phase >= 6 && winner === 'me' && (
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', delay: 0.5 }}
                                className="text-3xl mt-2"
                            >
                                👑
                            </motion.div>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className={`text-center p-4 rounded-2xl transition-all duration-500 ${phase >= 6 && winner === 'opponent'
                            ? 'bg-gradient-to-br from-yellow-400/30 to-orange-500/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/30'
                            : 'bg-white/10 border border-white/20'
                            }`}
                    >
                        <div className="text-4xl mb-2">{opponentData?.avatar || '🧑'}</div>
                        <div className="font-bold text-white text-lg">{opponentData?.name || 'Opponent'}</div>
                        {phase >= 6 && winner === 'opponent' && (
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', delay: 0.5 }}
                                className="text-3xl mt-2"
                            >
                                👑
                            </motion.div>
                        )}
                    </motion.div>
                </div>

                {/* Metrics - Revealed one by one */}
                <div className="space-y-3 mb-6 relative z-10">
                    {metrics.map((metric, idx) => (
                        <AnimatePresence key={metric.key}>
                            {phase >= idx + 1 && (
                                <motion.div
                                    initial={{ opacity: 0, x: idx % 2 === 0 ? -100 : 100, scale: 0.8 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-white flex items-center gap-2 text-lg">
                                            <span className="text-2xl">{metric.icon}</span> {metric.name}
                                        </span>
                                        <span className="text-2xl">{metric.emoji}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-3xl font-black text-emerald-400">
                                                <AnimatedScore value={safeMyScores[metric.key] || 0} delay={200} />
                                            </div>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${safeMyScores[metric.key] || 0}%` }}
                                                transition={{ delay: 0.3, duration: 0.8 }}
                                                className={`h-3 bg-gradient-to-r ${metric.color} rounded-full mt-2 shadow-lg`}
                                            />
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-amber-400">
                                                <AnimatedScore value={safeOppScores[metric.key] || 0} delay={200} />
                                            </div>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${safeOppScores[metric.key] || 0}%` }}
                                                transition={{ delay: 0.3, duration: 0.8 }}
                                                className="h-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full mt-2 shadow-lg"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    ))}
                </div>

                {/* Final Score */}
                <AnimatePresence>
                    {phase >= 5 && (
                        <motion.div
                            initial={{ scale: 0, rotateX: 90 }}
                            animate={{ scale: 1, rotateX: 0 }}
                            transition={{ type: 'spring', damping: 12 }}
                            className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white rounded-2xl p-6 text-center mb-6 relative z-10 shadow-2xl border border-emerald-400/50"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="text-sm font-bold mb-2 tracking-wider"
                            >
                                ⚡ FINAL SCORE ⚡
                            </motion.div>
                            <div className="text-6xl font-black flex items-center justify-center gap-4">
                                <motion.span
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-emerald-100"
                                >
                                    <AnimatedScore value={Math.round(myTotal)} delay={0} />
                                </motion.span>
                                <span className="text-3xl opacity-50 text-emerald-300">vs</span>
                                <motion.span
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-white"
                                >
                                    <AnimatedScore value={Math.round(oppTotal)} delay={0} />
                                </motion.span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Winner Announcement */}
                <AnimatePresence>
                    {phase >= 6 && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 12, delay: 0.3 }}
                            className={`relative z-10 mb-6 p-6 rounded-2xl text-center ${winner === 'me'
                                ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500'
                                : winner === 'opponent'
                                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                }`}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 1, repeat: 2 }}
                                className="text-6xl mb-2"
                            >
                                {winner === 'me' ? '👑' : winner === 'opponent' ? '😔' : '🤝'}
                            </motion.div>
                            <h3 className="text-2xl font-black text-white mb-1">
                                {winner === 'me'
                                    ? '🎉 YOU WON! 🎉'
                                    : winner === 'opponent'
                                        ? `${opponentData?.name || 'Opponent'} Wins`
                                        : "IT'S A TIE!"}
                            </h3>
                            <p className="text-white/80 text-sm">
                                {winner === 'me'
                                    ? 'Congratulations! Your English skills are impressive!'
                                    : winner === 'opponent'
                                        ? "Great effort! Keep practicing and you'll win next time!"
                                        : 'What a close match! Both of you did great!'}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Return Dashboard Button */}
                {phase >= 6 && (
                    <div className="space-y-4">
                        {/* Contextual Feedback Section */}
                        <div className="mt-4 pt-6 border-t border-emerald-500/20 text-left">
                            <div className="text-[10px] font-black text-emerald-400 uppercase mb-3 tracking-widest">How was this match?</div>
                            {feedbackState.submitted ? (
                                <div className="bg-emerald-400/10 text-emerald-200 rounded-2xl p-4 text-center text-sm font-bold flex items-center justify-center gap-2 border border-emerald-500/30">
                                    <Star size={16} fill="currentColor" /> Match recorded! Thank you.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-center gap-3">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                onClick={() => onSetFeedbackRating(star)}
                                                className={`text-3xl transition-all transform ${feedbackState.rating >= star ? 'text-yellow-400 scale-125' : 'text-emerald-900/50 hover:text-emerald-400'}`}
                                            >
                                                ⭐
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={feedbackState.text}
                                        onChange={(e) => onSetFeedbackText(e.target.value)}
                                        placeholder="Rate the opponent or the AI scoring..."
                                        className="w-full p-4 bg-emerald-900/40 rounded-2xl border border-emerald-500/30 text-emerald-100 text-sm focus:border-emerald-400 focus:outline-none h-24 resize-none placeholder:text-emerald-700"
                                    />
                                    {feedbackState.rating > 0 && (
                                        <motion.button
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => onFeedback(feedbackState.rating, feedbackState.text)}
                                            className="w-full py-3 bg-emerald-500 text-emerald-950 rounded-xl font-black text-xs hover:bg-emerald-400 transition-colors uppercase tracking-widest"
                                        >
                                            Submit Match Feedback
                                        </motion.button>
                                    )}
                                </div>
                            )}
                        </div>

                        <motion.button
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            onClick={onDashboard}
                            className="w-full bg-white text-emerald-900 font-black py-4 rounded-2xl hover:scale-[1.02] transition-transform shadow-2xl relative z-20 flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            Complete Session & Exit
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};


export default WinnerReveal;
