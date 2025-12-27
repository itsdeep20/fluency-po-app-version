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

const WinnerReveal = ({ dualAnalysis, myUserId, opponentData, onClose }) => {
    const [phase, setPhase] = useState(0); // 0: intro, 1: vocabulary, 2: grammar, 3: fluency, 4: sentence, 5: final, 6: winner
    const [countedScores, setCountedScores] = useState({});
    const audioRef = useRef(null);

    // Determine who is player1 vs player2 based on userId
    const amIPlayer1 = myUserId === opponentData?.creatorId;
    const myScores = amIPlayer1 ? dualAnalysis?.player1 : dualAnalysis?.player2;
    const oppScores = amIPlayer1 ? dualAnalysis?.player2 : dualAnalysis?.player1;

    // Fallback for missing data
    const safeMyScores = myScores || { vocabulary: 0, grammar: 0, fluency: 0, sentence_making: 0, overall: 0, feedback: '' };
    const safeOppScores = oppScores || { vocabulary: 0, grammar: 0, fluency: 0, sentence_making: 0, overall: 0, feedback: '' };

    const myTotal = safeMyScores.overall;
    const oppTotal = safeOppScores.overall;
    const winner = myTotal > oppTotal ? 'me' : (myTotal < oppTotal ? 'opponent' : 'tie');

    const metrics = [
        { name: 'Vocabulary', key: 'vocabulary', icon: '📚', emoji: '🔤', color: 'from-blue-500 to-blue-600' },
        { name: 'Grammar', key: 'grammar', icon: '✍️', emoji: '📝', color: 'from-green-500 to-green-600' },
        { name: 'Fluency', key: 'fluency', icon: '💬', emoji: '🗣️', color: 'from-purple-500 to-purple-600' },
        { name: 'Sentence Making', key: 'sentence_making', icon: '📝', emoji: '✨', color: 'from-orange-500 to-orange-600' }
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
                    const colors = ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#00BFFF'];

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
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
        >
            <motion.div
                initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl shadow-2xl max-w-2xl w-full p-8 relative overflow-hidden border border-purple-500/30"
            >
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-white/20 rounded-full"
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
                                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
                                    {phase < 6 ? '⚔️ CALCULATING RESULTS...' : '🏆 MATCH COMPLETE!'}
                                </h2>
                                <Sparkles className="text-yellow-400 w-8 h-8" />
                            </motion.div>

                            {phase < 6 && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(phase / 6) * 100}%` }}
                                    className="h-1 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full mt-4 mx-auto max-w-xs"
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
                            ? 'bg-gradient-to-br from-yellow-400/30 to-orange-500/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/30'
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
                                            <div className="text-3xl font-black text-cyan-400">
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
                                            <div className="text-3xl font-black text-pink-400">
                                                <AnimatedScore value={safeOppScores[metric.key] || 0} delay={200} />
                                            </div>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${safeOppScores[metric.key] || 0}%` }}
                                                transition={{ delay: 0.3, duration: 0.8 }}
                                                className="h-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full mt-2 shadow-lg"
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
                            className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white rounded-2xl p-6 text-center mb-6 relative z-10 shadow-2xl"
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
                                    className="text-white drop-shadow-lg"
                                >
                                    <AnimatedScore value={myTotal} delay={0} />
                                </motion.span>
                                <span className="text-3xl opacity-60">VS</span>
                                <motion.span
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-white drop-shadow-lg"
                                >
                                    <AnimatedScore value={oppTotal} delay={200} />
                                </motion.span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Winner Announcement */}
                <AnimatePresence>
                    {phase >= 6 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', damping: 10, delay: 0.3 }}
                            className="text-center mb-6 relative z-10"
                        >
                            {winner === 'me' && (
                                <motion.div
                                    className="space-y-3"
                                    initial={{ y: 50 }}
                                    animate={{ y: 0 }}
                                >
                                    <motion.div
                                        animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.8, repeat: 2 }}
                                        className="text-7xl"
                                    >
                                        🏆
                                    </motion.div>
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                        className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"
                                    >
                                        🎉 YOU WIN! 🎉
                                    </motion.div>
                                    <p className="text-gray-300 max-w-md mx-auto">{safeMyScores.feedback}</p>
                                </motion.div>
                            )}
                            {winner === 'opponent' && (
                                <motion.div className="space-y-3">
                                    <div className="text-6xl">💪</div>
                                    <div className="text-3xl font-black text-purple-400">OPPONENT WINS!</div>
                                    <p className="text-gray-300 max-w-md mx-auto">{safeMyScores.feedback}</p>
                                    <p className="text-sm text-gray-400 mt-2">Keep practicing - you'll get them next time!</p>
                                </motion.div>
                            )}
                            {winner === 'tie' && (
                                <motion.div className="space-y-3">
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="text-6xl"
                                    >
                                        🤝
                                    </motion.div>
                                    <div className="text-3xl font-black text-blue-400">IT'S A TIE!</div>
                                    <p className="text-gray-300">You're evenly matched! Amazing battle!</p>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Close Button */}
                {phase >= 6 && (
                    <motion.button
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg relative z-10 flex items-center justify-center gap-2"
                    >
                        <Zap size={20} /> Back to Dashboard
                    </motion.button>
                )}
            </motion.div>
        </motion.div>
    );
};

export default WinnerReveal;
