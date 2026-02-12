import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function Session() {
    const { unitId } = useParams();
    const { api } = useAuth();
    const navigate = useNavigate();

    // Game State
    const [queue, setQueue] = useState([]);
    const [currentWord, setCurrentWord] = useState(null);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('idle'); // idle, success, error, review_error, completed
    const [loading, setLoading] = useState(true);
    const [feedbackMsg, setFeedbackMsg] = useState('');

    // Review Mode State
    const [showAnswer, setShowAnswer] = useState(false);

    // Stats
    const [progress, setProgress] = useState({ total: 0, done: 0 });
    const inputRef = useRef(null);

    useEffect(() => {
        fetchWords();
    }, [unitId]);

    // Polling for Sync
    useEffect(() => {
        if (loading || status === 'completed') return;

        const interval = setInterval(async () => {
            try {
                // Determine if we should check (only if idle to avoid interrupting typing)
                if (status !== 'idle' && status !== 'error' && status !== 'review_error') return;

                const res = await api.get('/session');
                const serverSession = res.data;

                if (!serverSession) return; // Session complete or deleted

                // Check if server is ahead
                if (serverSession.progress.done > progress.done) {
                    console.log("Syncing from server...");
                    setQueue(serverSession.queue);
                    setProgress(serverSession.progress);
                    setCurrentWord(serverSession.queue[0]);
                    setInput('');
                    setStatus('idle');
                    setFeedbackMsg('');
                    setShowAnswer(false);
                }
            } catch (err) {
                console.error("Sync error:", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [loading, status, progress.done, api]);

    const fetchWords = async () => {
        try {
            // 1. Try to fetch existing session first
            let session = null;
            try {
                const sessionRes = await api.get('/session');
                session = sessionRes.data;
            } catch (err) {
                console.warn("Failed to fetch session. This might be normal if table doesn't exist yet or no session.", err);
            }

            // If session exists and matches current unit(s), use it
            if (session && session.unit_ids === unitId) {
                setQueue(session.queue);
                setProgress(session.progress);
                setCurrentWord(session.queue[0]);
                setLoading(false);
                setTimeout(() => inputRef.current?.focus(), 100);
                return;
            }

            // 2. If no valid session, start new one
            let words = [];
            try {
                // Check for multiple IDs (comma separated)
                if (unitId.includes(',')) {
                    const res = await api.get(`/words?units=${unitId}`);
                    words = res.data.words;
                }
                // Check for 'all'
                else if (unitId === 'all') {
                    const res = await api.get('/units');
                    const units = res.data;
                    for (const u of units) {
                        const wRes = await api.get(`/units/${u.id}`);
                        words = [...words, ...wRes.data.words];
                    }
                }
                // Single Unit
                else {
                    const res = await api.get(`/units/${unitId}`);
                    words = res.data.words;
                }
            } catch (err) {
                console.error("Failed to fetch words:", err);
                alert(`Error fetching words: ${err.response?.data?.error || err.message}`);
                navigate('/');
                return;
            }

            if (words.length === 0) {
                alert("No words found!");
                navigate('/');
                return;
            }

            // Shuffle
            const shuffled = [...words].sort(() => Math.random() - 0.5);
            const initialProgress = { total: shuffled.length, done: 0 };

            setQueue(shuffled);
            setCurrentWord(shuffled[0]);
            setProgress(initialProgress);
            setLoading(false);

            // Create new session in DB
            try {
                await api.post('/session', {
                    unit_ids: unitId,
                    queue: shuffled,
                    progress: initialProgress
                });
            } catch (err) {
                console.error("Failed to create session:", err);
                if (err.response?.status === 500) {
                    alert("Warning: Progress saving is not working. Did you restart the backend server? (Error 500)");
                }
            }

            // Focus input
            setTimeout(() => inputRef.current?.focus(), 100);

        } catch (err) {
            console.error("Critical session error:", err);
            alert(`Failed to start session: ${err.message}`);
            navigate('/');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (showAnswer) return; // Prevent submit in review mode
        if (status === 'review_error') return; // Block input during review error feedback
        if (status !== 'idle' && status !== 'error') return;

        const answer = input.trim().toLowerCase();
        const correct = currentWord.en.toLowerCase();

        if (answer === correct) {
            handleConfirmCorrect();
        } else {
            // Typing error (allow retry)
            setStatus('error');
            const capitalizedEn = currentWord.en.charAt(0).toUpperCase() + currentWord.en.slice(1);
            setFeedbackMsg(`Correct: ${capitalizedEn}`);

            // Allow retry without moving queue yet
            setTimeout(() => {
                setStatus('idle');
                setFeedbackMsg('');
            }, 2000);
        }
    };

    const handleKnowWord = () => {
        if (status !== 'idle' && status !== 'error') return;
        // Show answer and switch to review mode
        const capitalizedEn = currentWord.en.charAt(0).toUpperCase() + currentWord.en.slice(1);
        setInput(capitalizedEn);
        setShowAnswer(true);
    };

    const handleConfirmCorrect = () => {
        setStatus('success');
        setShowAnswer(false);

        const newQueue = queue.slice(1);
        const newProgress = { ...progress, done: progress.done + 1 };
        setProgress(newProgress);

        if (newQueue.length === 0) {
            handleComplete();
        } else {
            // Save progress to DB
            api.put('/session', {
                queue: newQueue,
                progress: newProgress
            }).catch(console.error);

            setTimeout(() => {
                setQueue(newQueue);
                setCurrentWord(newQueue[0]);
                setInput('');
                setStatus('idle');
            }, 800);
        }
    };

    const handleMarkWrong = () => {
        setStatus('review_error'); // Lock UI with special error state
        const capitalizedEn = currentWord.en.charAt(0).toUpperCase() + currentWord.en.slice(1);
        setFeedbackMsg(`Correct: ${capitalizedEn}`);
        setShowAnswer(false);
        setInput(''); // Clear input immediately so it doesn't look like a success

        // Move to end of queue
        const newQueue = [...queue.slice(1), currentWord];
        setQueue(newQueue);

        setTimeout(() => {
            setStatus('idle');
            setFeedbackMsg('');
            setCurrentWord(newQueue[0]);
        }, 2000);
    };

    const handleComplete = async () => {
        setStatus('completed');
        try {
            await api.delete('/session');
        } catch (err) {
            console.error("Failed to clear session", err);
        }
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    // Helper for dynamic font size
    const getFontSize = (text) => {
        if (!text) return '3rem';
        if (text.length > 20) return 'clamp(1.2rem, 3vw, 1.5rem)';
        if (text.length > 10) return 'clamp(1.5rem, 4vw, 2.2rem)';
        return 'clamp(2rem, 5vw, 3rem)';
    };

    if (loading) return <div className="container" style={{ paddingTop: '5rem', textAlign: 'center' }}>Loading Session...</div>;

    if (status === 'completed') {
        return (
            <div className="container" style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass-panel"
                    style={{ padding: '4rem', textAlign: 'center' }}
                >
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--color-secondary)' }}>Excellent!</h1>
                    <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--color-text-muted)' }}>You've mastered all {progress.total} words.</p>
                    <Link to="/" className="btn-primary">Back to Dashboard</Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', paddingTop: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                <Link to="/" className="btn-secondary" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>← Exit</Link>
                <div style={{ color: 'var(--color-text-muted)' }}>
                    Progress: {progress.done} / {progress.total}
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentWord.id}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-panel"
                    style={{ padding: '4rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                >
                    {/* Status Feedback Overlays */}
                    {status === 'success' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{
                                position: 'absolute', inset: 0,
                                background: 'rgba(16, 185, 129, 0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 10
                            }}
                        >
                            <span style={{ fontSize: '5rem' }}>✅</span>
                        </motion.div>
                    )}

                    {(status === 'error' || status === 'review_error') && (
                        <div style={{ marginBottom: '2rem' }}>
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                style={{ color: '#f43f5e', fontSize: '1.5rem', fontWeight: 'bold' }}
                            >
                                {feedbackMsg}
                            </motion.div>
                        </div>
                    )}

                    <h2 style={{
                        fontSize: getFontSize(currentWord.ru),
                        marginBottom: '3rem',
                        overflowWrap: 'anywhere',
                        hyphens: 'auto',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                        lineHeight: '1.3'
                    }}>
                        {currentWord.ru}
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '2rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type English translation..."
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    fontSize: '1.2rem',
                                    textAlign: 'center',
                                    padding: '1rem',
                                    maxWidth: '500px',
                                    borderRadius: '8px',
                                    border: '2px solid',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white',
                                    outline: 'none',
                                    borderColor: (status === 'error' || status === 'review_error') ? '#f43f5e' : (status === 'success' ? '#10b981' : 'rgba(255,255,255,0.1)')
                                }}
                                autoComplete="off"
                                autoFocus
                                disabled={status !== 'idle' && status !== 'error' && !showAnswer}
                                readOnly={showAnswer}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            {!showAnswer ? (
                                <>
                                    <button type="submit" className="btn-primary" style={{ display: 'none' }}>Submit</button>
                                    <button
                                        type="button"
                                        onClick={handleKnowWord}
                                        className="btn-secondary"
                                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                                    >
                                        I Know This
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleMarkWrong}
                                        className="btn-secondary"
                                        style={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                                    >
                                        I was wrong
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmCorrect}
                                        className="btn-primary"
                                    >
                                        Next
                                    </button>
                                </>
                            )}
                        </div>
                    </form>

                    <p style={{ marginTop: '2rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        Press Enter to submit
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
