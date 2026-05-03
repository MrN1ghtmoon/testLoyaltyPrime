// GameWheel.js - Добавляем функционал бесплатного вращения
import { useState, useEffect } from 'react';
import './GameWheel.css';

const API_URL = 'http://localhost:3001';

// Настройки по умолчанию
const DEFAULT_SECTORS = [
    { name: 'x5', value: 5, multiplier: 5, color: '#2ecc71', icon: '⭐', weight: 15 },
    { name: 'x2', value: 2, multiplier: 2, color: '#3498db', icon: '🎯', weight: 25 },
    { name: 'x10', value: 10, multiplier: 10, color: '#e74c3c', icon: '🔥', weight: 5 },
    { name: 'x0', value: 0, multiplier: 0, color: '#95a5a6', icon: '💀', weight: 30 },
    { name: 'x3', value: 3, multiplier: 3, color: '#f39c12', icon: '✨', weight: 20 },
    { name: 'x1', value: 1, multiplier: 1, color: '#1abc9c', icon: '🍀', weight: 35 },
    { name: 'x20', value: 20, multiplier: 20, color: '#9b59b6', icon: '💎', weight: 3 },
    { name: 'x15', value: 15, multiplier: 15, color: '#e67e22', icon: '🏆', weight: 10 }
];

export function GameWheel({ onBalanceUpdate, userBalance, companyId, userId }) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const [lastWin, setLastWin] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showGlow, setShowGlow] = useState(false);
    const [spinCount, setSpinCount] = useState(0);
    const [bestWin, setBestWin] = useState(0);
    const [particles, setParticles] = useState([]);
    
    // Настройки игры (загружаются с сервера)
    const [settings, setSettings] = useState({
        spinCost: 25,
        sectors: DEFAULT_SECTORS,
        maxSpinsPerDay: 10,
        freeSpinDaily: false,
        active: true
    });
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    
    // Состояние для бесплатного вращения
    const [freeSpinAvailable, setFreeSpinAvailable] = useState(false);
    const [freeSpinUsed, setFreeSpinUsed] = useState(false);
    const [lastFreeSpinDate, setLastFreeSpinDate] = useState(null);

    // Загрузка настроек с сервера
    useEffect(() => {
        const loadSettings = async () => {
            if (!companyId) return;
            
            try {
                const response = await fetch(`${API_URL}/api/games/${companyId}/wheel`);
                const data = await response.json();
                
                if (data.success && data.active !== false) {
                    setSettings({
                        spinCost: data.settings.spinCost || 25,
                        sectors: data.settings.sectors || DEFAULT_SECTORS,
                        maxSpinsPerDay: data.settings.maxSpinsPerDay || 10,
                        freeSpinDaily: data.settings.freeSpinDaily || false,
                        active: data.active
                    });
                }
            } catch (error) {
                console.error('Ошибка загрузки настроек колеса:', error);
            }
            setSettingsLoaded(true);
        };
        
        loadSettings();
    }, [companyId]);

    // Загрузка состояния бесплатного вращения из localStorage
    useEffect(() => {
        if (!userId) return;
        
        const key = `wheel_free_spin_${userId}_${companyId}`;
        const saved = localStorage.getItem(key);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const today = new Date().toDateString();
                
                // Проверяем, было ли бесплатное вращение сегодня
                if (data.date === today) {
                    setFreeSpinUsed(data.used);
                    setFreeSpinAvailable(false);
                    setLastFreeSpinDate(data.date);
                } else {
                    // Новый день - сбрасываем
                    setFreeSpinUsed(false);
                    setFreeSpinAvailable(settings.freeSpinDaily);
                    setLastFreeSpinDate(null);
                }
            } catch(e) {}
        } else {
            // Первый раз - бесплатное вращение доступно если включено в настройках
            setFreeSpinAvailable(settings.freeSpinDaily);
            setFreeSpinUsed(false);
        }
    }, [userId, companyId, settings.freeSpinDaily]);

    useEffect(() => {
        const saved = localStorage.getItem('wheel_spin_history');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setSpinCount(data.spinCount || 0);
                setBestWin(data.bestWin || 0);
            } catch(e) {}
        }
    }, []);

    const saveStats = (winAmount) => {
        const newSpinCount = spinCount + 1;
        const newBestWin = Math.max(bestWin, winAmount);
        setSpinCount(newSpinCount);
        setBestWin(newBestWin);
        localStorage.setItem('wheel_spin_history', JSON.stringify({
            spinCount: newSpinCount,
            bestWin: newBestWin
        }));
    };

    // Сохранение состояния бесплатного вращения
    const saveFreeSpinState = (used) => {
        const today = new Date().toDateString();
        const key = `wheel_free_spin_${userId}_${companyId}`;
        localStorage.setItem(key, JSON.stringify({
            used: used,
            date: today
        }));
        setFreeSpinUsed(used);
        setFreeSpinAvailable(!used && settings.freeSpinDaily);
        setLastFreeSpinDate(today);
    };

    const createParticles = (x, y) => {
        const newParticles = [];
        for (let i = 0; i < 20; i++) {
            newParticles.push({
                id: Date.now() + i,
                x: x || window.innerWidth / 2,
                y: y || window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5,
                life: 1,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`
            });
        }
        setParticles(prev => [...prev, ...newParticles]);
        
        const interval = setInterval(() => {
            setParticles(prev => prev.filter(p => p.life > 0).map(p => ({
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                vy: p.vy + 0.3,
                life: p.life - 0.02
            })));
        }, 16);
        
        setTimeout(() => clearInterval(interval), 1000);
    };

    const playSound = (type) => {
        if (typeof window !== 'undefined') {
            try {
                navigator.vibrate?.(type === 'win' ? 100 : 50);
            } catch(e) {}
        }
    };

    const spin = async (useFreeSpin = false) => {
    if (isSpinning) return;
    if (!settings.active) {
        alert('Игра временно недоступна');
        return;
    }
    
    let cost = settings.spinCost;
    
    // Если используем бесплатное вращение
    if (useFreeSpin && freeSpinAvailable && !freeSpinUsed) {
        cost = 0;
        saveFreeSpinState(true);
    }
    
    if (userBalance < cost && cost > 0) {
        alert(`Недостаточно бонусов! Нужно ${cost} бонусов.`);
        return;
    }
    
    if (cost > 0) {
        await onBalanceUpdate(-cost, 'spend', { source: 'game', gameType: 'wheel' });
    }
    
    setIsSpinning(true);
    setResult(null);
    setShowConfetti(false);
    setShowGlow(true);
    setTimeout(() => setShowGlow(false), 500);
    playSound('spin');
    
    const weights = settings.sectors.map(s => s.weight || 10);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let sectorIndex = 0;
    let cumulative = 0;
    
    for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
            sectorIndex = i;
            break;
        }
    }
    
    const sectorAngle = 360 / settings.sectors.length;
    const spins = 8 + Math.floor(Math.random() * 5);
    const targetRotation = rotation + 360 * spins + (360 - (sectorIndex * sectorAngle) - 15);
    
    setRotation(targetRotation);
    
    // Сохраняем значения для использования в setTimeout
    const selectedSector = settings.sectors[sectorIndex];
    const currentCost = cost;
    
    // ✅ Обернём в Promise, чтобы дождаться анимации
    await new Promise(resolve => {
        setTimeout(async () => {
            const sector = selectedSector;
            let prize = null;
            
            if (sector.value === 0) {
                prize = { type: 'lose', value: 0, message: 'Попробуйте ещё раз!', sector: sector };
                setLastWin('0');
                playSound('lose');
            } else {
                const winAmount = sector.value;
                // ✅ Дожидаемся начисления выигрыша
                await onBalanceUpdate(winAmount, 'earn', { source: 'game', gameType: 'wheel' });
                
                setLastWin(winAmount);
                saveStats(winAmount);
                setShowConfetti(true);
                createParticles();
                playSound('win');
                
                setTimeout(() => setShowConfetti(false), 2500);
                prize = { type: 'bonus', value: winAmount, message: `+${winAmount} бонусов`, sector: sector };
                
                // ✅ Обновляем прогресс задания
                console.log('🎡 GameWheel: Выигрыш', winAmount, 'бонусов');
                
                if (typeof window.updateQuestProgress === 'function') {
                    console.log('🎡 Вызов updateQuestProgress для spin_wheel');
                    window.updateQuestProgress('spin_wheel', 1);
                } else {
                    console.error('❌ window.updateQuestProgress не функция!');
                    window.dispatchEvent(new CustomEvent('questProgress', { 
                        detail: { type: 'spin_wheel', increment: 1 } 
                    }));
                }
                
                if (winAmount > 10) {
                    try { navigator.vibrate?.(200); } catch(e) {}
                }
            }
            
            setResult(prize);
            setIsSpinning(false);
            resolve();
        }, 3500);
    });
};

    const getSectorGradient = (color, isWinning) => {
        if (isWinning) return `radial-gradient(circle at 30% 30%, ${color}, ${color}cc)`;
        return `linear-gradient(135deg, ${color}, ${color}dd)`;
    };

    if (!settingsLoaded) {
        return (
            <div className="game-wheel-classic" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <div style={{ color: 'white' }}>Загрузка...</div>
            </div>
        );
    }

    if (!settings.active) {
        return (
            <div className="game-wheel-classic" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎡</div>
                <div style={{ color: '#ffd966', fontSize: '18px', fontWeight: 'bold' }}>Игра временно недоступна</div>
                <div style={{ color: '#aaa', fontSize: '14px', marginTop: '8px' }}>Загляните позже!</div>
            </div>
        );
    }

    return (
        <div className="game-wheel-classic">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="classic-particle"
                    style={{
                        position: 'fixed',
                        left: p.x,
                        top: p.y,
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: p.color,
                        opacity: p.life,
                        pointerEvents: 'none',
                        zIndex: 2000
                    }}
                />
            ))}

            {showGlow && <div className="classic-glow-effect" />}

            {showConfetti && (
                <div className="classic-confetti">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            className="confetti-piece"
                            style={{
                                '--x': `${Math.random() * 200 - 100}%`,
                                '--delay': `${Math.random() * 2}s`,
                                '--color': `hsl(${Math.random() * 360}, 80%, 60%)`
                            }}
                        />
                    ))}
                    <div className="confetti-text">🎉 ПОБЕДА! 🎉</div>
                </div>
            )}
            
            <div className="classic-header">
                <div className="header-left">
                    <h3>🎡 КОЛЕСО ФОРТУНЫ</h3>
                    <div className="stats-badge">
                        <span>🎲 {spinCount}</span>
                        <span>🏆 {bestWin}</span>
                    </div>
                </div>
                <div className="classic-cost">
                    <span className="cost-icon">🎟️</span>
                    <span className="cost-value">{settings.spinCost}</span>
                </div>
            </div>
            
            {/* Баннер бесплатного вращения */}
            {settings.freeSpinDaily && freeSpinAvailable && !freeSpinUsed && (
                <div className="free-spin-banner" style={{
                    background: 'linear-gradient(135deg, #f1c40f, #e67e22)',
                    borderRadius: '30px',
                    padding: '10px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>🎁</span>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>Доступно 1 бесплатное вращение!</span>
                    </div>
                    <button
                        onClick={() => spin(true)}
                        disabled={isSpinning}
                        style={{
                            background: 'white',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '30px',
                            color: '#e67e22',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        Использовать 🎲
                    </button>
                </div>
            )}
            
            {/* Баннер что бесплатное вращение использовано */}
            {settings.freeSpinDaily && !freeSpinAvailable && freeSpinUsed && (
                <div className="free-spin-used" style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '30px',
                    padding: '8px 16px',
                    marginBottom: '16px',
                    textAlign: 'center'
                }}>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>🎁 Бесплатное вращение уже использовано сегодня. Завтра будет новое!</span>
                </div>
            )}
            
            <div className="classic-wheel-container">
                <div className="classic-wheel-wrapper">
                    <div className={`classic-wheel ${isSpinning ? 'spinning' : ''}`}
                        style={{ transform: `rotate(${rotation}deg)` }}>
                        {settings.sectors.map((sector, index) => {
                            const angle = index * (360 / settings.sectors.length);
                            const skewAngle = 90 - (360 / settings.sectors.length);
                            
                            return (
                                <div
                                    key={index}
                                    className={`classic-sector ${result?.sector === sector && !isSpinning ? 'highlight' : ''}`}
                                    style={{
                                        transform: `rotate(${angle}deg) skewY(${skewAngle}deg)`,
                                        background: getSectorGradient(sector.color, result?.sector === sector && !isSpinning),
                                        width: '50%',
                                        height: '50%',
                                        left: '50%',
                                        top: '50%',
                                        position: 'absolute',
                                        transformOrigin: '0% 0%',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div 
                                        className="classic-sector-content"
                                        style={{
                                            transform: `skewY(${-skewAngle}deg)`,
                                            position: 'absolute',
                                            left: '25%',
                                            top: '18%',
                                            textAlign: 'center',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span className="classic-icon" style={{ fontSize: '28px', marginBottom: '4px' }}>{sector.icon || '🎲'}</span>
                                        <span className="classic-multiplier" style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{sector.name}</span>
                                        {sector.value > 0 && (
                                            <span className="classic-bonus" style={{ fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: '20px', marginTop: '4px' }}>+{sector.value}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="classic-pointer">
                        <div className="pointer-glow" />
                    </div>
                    <div className="classic-center">
                        <div className="center-icon">🎲</div>
                    </div>
                </div>
            </div>
            
            <div className="classic-spin-wrapper">
                <button
                    className={`classic-spin-btn ${isSpinning ? 'spinning' : ''}`}
                    onClick={() => spin(false)}
                    disabled={isSpinning || (!freeSpinAvailable && userBalance < settings.spinCost)}
                >
                    <span className="btn-text">{isSpinning ? 'ВРАЩЕНИЕ...' : 'КРУТИТЬ'}</span>
                    {!isSpinning && <span className="btn-icon">🎲</span>}
                </button>
            </div>
            
            {result && (
                <div className={`classic-result ${result.type === 'bonus' ? 'win' : 'lose'} ${!isSpinning ? 'show' : ''}`}>
                    <div className="result-icon">{result.type === 'bonus' ? '🏆' : '😢'}</div>
                    <div className="result-text">
                        {result.type === 'bonus' ? `+${result.value} БОНУСОВ!` : result.message}
                    </div>
                    {result.type === 'bonus' && (
                        <div className="result-animation">✨</div>
                    )}
                </div>
            )}
            
            {!result && lastWin && lastWin !== '0' && (
                <div className="classic-last-win">
                    <span className="last-icon">🏆</span>
                    <span>ПОСЛЕДНИЙ ВЫИГРЫШ: +{lastWin}</span>
                </div>
            )}

            <div className="classic-chances">
                <div className="chance-item">
                    <span className="chance-dot green" />
                    <span>Выигрыш: до {Math.max(...settings.sectors.map(s => s.value))}</span>
                </div>
                <div className="chance-item">
                    <span className="chance-dot red" />
                    <span>Стоимость: {settings.spinCost}</span>
                </div>
                <div className="chance-item">
                    <span className="chance-dot gray" />
                    <span>Шанс: {Math.round((settings.sectors.filter(s => s.value > 0).length / settings.sectors.length) * 100)}%</span>
                </div>
            </div>
        </div>
    );
}