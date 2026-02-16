import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
    const { api, logout, user } = useAuth();
    const [units, setUnits] = useState([]);
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const [activeSession, setActiveSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const unitsRes = await api.get('/units');
            if (Array.isArray(unitsRes.data)) {
                setUnits(unitsRes.data);
            } else {
                console.error("Unexpected response for units:", unitsRes.data);
                // Optionally alert/warn user if it's not what we expect
                if (typeof unitsRes.data === 'string' && unitsRes.data.includes('<!doctype html>')) {
                    console.error("Received HTML instead of JSON. Proxy might be misconfigured.");
                }
            }

            try {
                const sessionRes = await api.get('/session');
                setActiveSession(sessionRes.data);
            } catch (err) {
                console.error("Failed to fetch session:", err);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ""));
        formData.append('language', selectedLanguage);

        try {
            await api.post('/units', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchData();
        } catch (err) {
            alert('Failed to upload unit');
        }
    };

    const toggleSelect = (id) => {
        setSelectedUnits(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Delete ${selectedUnits.length} units? This cannot be undone.`)) return;

        try {
            await Promise.all(selectedUnits.map(id => api.delete(`/units/${id}`)));
            setSelectedUnits([]);
            fetchData();
        } catch (err) {
            console.error(err);
            alert(`Failed to delete: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
        }
    };

    const handlePracticeSelected = () => {
        if (selectedUnits.length === 0) return;
        navigate(`/session/${selectedUnits.join(',')}`);
    };

    return (
        <div className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
                <h1 className="page-title" style={{ margin: 0, textAlign: 'left' }}>Your Learning Units</h1>
                <button onClick={logout} className="btn-secondary">Logout</button>
            </header>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel"
                style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}
            >
                <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Upload New Unit</h2>
                    <p style={{ color: 'var(--color-text-muted)' }}>Supported formats: CSV, TXT (English, Spanish, Russian)</p>
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9rem' }}>Language:</span>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-sm)',
                                outline: 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {selectedUnits.length > 0 && (
                        <>
                            <button onClick={handleDeleteSelected} className="btn-secondary" style={{ borderColor: '#f43f5e', color: '#f43f5e' }}>
                                Delete ({selectedUnits.length})
                            </button>
                            <button onClick={handlePracticeSelected} className="btn-primary">
                                Practice Selected
                            </button>
                        </>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".csv,.txt"
                        onChange={handleFileChange}
                    />
                    <button onClick={handleUploadClick} className="btn-primary">
                        + Add Unit
                    </button>
                </div>
            </motion.div>

            {/* Active Session Banner - More Prominent */}
            {activeSession && (
                <div style={{ marginBottom: '2rem' }}>
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel"
                        style={{
                            padding: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)',
                            border: '2px solid #10b981',
                            textAlign: 'center'
                        }}
                    >
                        <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#10b981' }}>Session in Progress</h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                            You have an unfinished session. Continue where you left off?
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                                <span>Progress: {activeSession.progress.done} completed</span>
                            </div>
                            <Link
                                to={`/session/${activeSession.unit_ids}`}
                                className="btn-primary"
                                style={{
                                    background: '#10b981',
                                    borderColor: '#10b981',
                                    fontSize: '1.2rem',
                                    padding: '12px 32px'
                                }}
                            >
                                Continue Learning ►
                            </Link>
                        </div>
                    </motion.div>
                </div>
            )}

            {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading units...</p>
            ) : (
                <div className="units-grid">
                    {units.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                            <p style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>No units found. Upload one to get started!</p>
                        </div>
                    ) : (
                        units.map((unit, index) => (
                            <motion.div
                                key={unit.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="glass-panel"
                                style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
                            >
                                <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedUnits.includes(unit.id)}
                                        onChange={() => toggleSelect(unit.id)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                </div>
                                <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem', paddingRight: '2rem' }}>{unit.name}</h3>
                                <div style={{ marginTop: 'auto' }}>
                                    <Link to={`/session/${unit.id}`} className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>
                                        Start Session
                                    </Link>
                                </div>
                            </motion.div>
                        ))
                    )}

                    {units.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: units.length * 0.1 }}
                            className="glass-panel"
                            style={{
                                padding: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                border: '1px solid var(--color-secondary)',
                                background: 'rgba(6, 182, 212, 0.1)'
                            }}
                        >
                            <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: 'var(--color-secondary)' }}>Master All</h3>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Review words from all your units in one session.</p>
                            <div style={{ marginTop: 'auto' }}>
                                <Link to="/session/all" className="btn-primary" style={{ width: '100%', textAlign: 'center', background: 'var(--color-secondary)' }}>
                                    Practice All
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
}
