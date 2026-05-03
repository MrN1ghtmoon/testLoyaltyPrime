// DiceRoll.js - Исправленная версия с загрузкой настроек из CRM
import { useState, useEffect } from 'react';
import './DiceRoll.css';

const API_URL = 'http://localhost:3001';

// Комбинации по умолчанию
const DEFAULT_COMBINATIONS = {
    '2': { name: 'Змеиные глаза', multiplier: 15, icon: '🐍', color: '#2ecc71', description: 'Редкая комбинация!', enabled: true },
    '3': { name: 'Тройка', multiplier: 4, icon: '3️⃣', color: '#f39c12', description: 'Счастливое число', enabled: true },
    '4': { name: 'Четверка', multiplier: 3, icon: '4️⃣', color: '#16a085', description: 'Хорошо!', enabled: true },
    '5': { name: 'Пятерка', multiplier: 2.5, icon: '5️⃣', color: '#27ae60', description: 'Неплохо!', enabled: true },
    '6': { name: 'Шестерка', multiplier: 2, icon: '6️⃣', color: '#2980b9', description: 'Средний результат', enabled: true },
    '7': { name: 'Счастливая семерка', multiplier: 8, icon: '🍀', color: '#f1c40f', description: 'Удача на вашей стороне!', enabled: true },
    '8': { name: 'Восьмерка', multiplier: 2.5, icon: '8️⃣', color: '#8e44ad', description: 'Хорошо!', enabled: true },
    '9': { name: 'Девятка', multiplier: 3, icon: '9️⃣', color: '#d35400', description: 'Отлично!', enabled: true },
    '10': { name: 'Десятка', multiplier: 4, icon: '🔟', color: '#c0392b', description: 'Прекрасно!', enabled: true },
    '11': { name: 'Одиннадцать', multiplier: 6, icon: '✨', color: '#e67e22', description: 'Отличная комбинация!', enabled: true },
    '12': { name: 'Боксерские перчатки', multiplier: 15, icon: '🥊', color: '#e74c3c', description: 'Максимальная удача!', enabled: true },
    'double': { name: 'Дубль', multiplier: 5, icon: '🎲', color: '#9b59b6', description: 'Одинаковые кости!', enabled: true },
    'even': { name: 'Четная сумма', multiplier: 1.5, icon: '📊', color: '#3498db', description: 'Хороший результат', enabled: true },
    'odd': { name: 'Нечетная сумма', multiplier: 1.2, icon: '🎯', color: '#1abc9c', description: 'Неплохо!', enabled: true }
};

export function DiceRoll({ onBalanceUpdate, userBalance, companyId }) {
    const [dice1, setDice1] = useState(3);
    const [dice2, setDice2] = useState(4);
    const [isRolling, setIsRolling] = useState(false);
    const [result, setResult] = useState(null);
    const [lastWin, setLastWin] = useState(null);
    const [jackpot, setJackpot] = useState(1000);
    const [betMultiplier, setBetMultiplier] = useState(1);
    const [showCombinations, setShowCombinations] = useState(false);
    const [comboHistory, setComboHistory] = useState([]);
    const [particles, setParticles] = useState([]);
    
    // Настройки игры (загружаются с сервера)
    const [settings, setSettings] = useState({
        cost: 25,
        jackpotBase: 1000,
        betMultipliers: [1, 2, 3, 5, 10],
        combinations: DEFAULT_COMBINATIONS,
        jackpotChance: 1,
        jackpotContribution: 10,
        active: true
    });
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    
    // Загрузка настроек с сервера
    useEffect(() => {
        const loadSettings = async () => {
            if (!companyId) return;
            
            try {
                const response = await fetch(`${API_URL}/api/games/${companyId}/dice`);
                const data = await response.json();
                
                if (data.success && data.active !== false) {
                    setSettings({
                        cost: data.settings.cost || 25,
                        jackpotBase: data.settings.jackpotBase || 1000,
                        betMultipliers: data.settings.betMultipliers || [1, 2, 3, 5, 10],
                        combinations: data.settings.combinations || DEFAULT_COMBINATIONS,
                        jackpotChance: data.settings.jackpotChance || 1,
                        jackpotContribution: data.settings.jackpotContribution || 10,
                        active: data.active
                    });
                    
                    // Устанавливаем джекпот из настроек
                    setJackpot(data.settings.jackpotBase || 1000);
                }
            } catch (error) {
                console.error('Ошибка загрузки настроек костей:', error);
            }
            setSettingsLoaded(true);
        };
        
        loadSettings();
    }, [companyId]);
    
    // Создание частиц для эффекта выигрыша
    const createParticles = () => {
        const newParticles = [];
        for (let i = 0; i < 30; i++) {
            newParticles.push({
                id: Date.now() + i + Math.random(),
                x: Math.random() * window.innerWidth,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 8,
                life: 1,
                color: `hsl(${Math.random() * 60 + 40}, 100%, 60%)`
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
        
        setTimeout(() => clearInterval(interval), 1500);
    };
    
    // Сохранение джекпота
    const saveJackpot = (value) => {
        setJackpot(value);
        localStorage.setItem('dice_jackpot', value);
    };
    
    // Загрузка сохранённых данных
    useEffect(() => {
        const saved = localStorage.getItem('dice_jackpot');
        if (saved) setJackpot(parseInt(saved));
        
        const savedHistory = localStorage.getItem('dice_history');
        if (savedHistory) {
            try {
                setComboHistory(JSON.parse(savedHistory));
            } catch(e) {}
        }
    }, []);
    
    // Получение комбинации из настроек
    const getCombo = (sum, isDouble) => {
        const combos = settings.combinations;
        
        if (isDouble && sum === 2 && combos['2']?.enabled !== false) return combos['2'];
        if (isDouble && sum === 12 && combos['12']?.enabled !== false) return combos['12'];
        if (sum === 7 && combos['7']?.enabled !== false) return combos['7'];
        if (sum === 11 && combos['11']?.enabled !== false) return combos['11'];
        if (isDouble && combos['double']?.enabled !== false) return combos['double'];
        if (sum === 10 && combos['10']?.enabled !== false) return combos['10'];
        if (sum === 9 && combos['9']?.enabled !== false) return combos['9'];
        if (sum === 8 && combos['8']?.enabled !== false) return combos['8'];
        if (sum === 3 && combos['3']?.enabled !== false) return combos['3'];
        if (sum === 4 && combos['4']?.enabled !== false) return combos['4'];
        if (sum === 5 && combos['5']?.enabled !== false) return combos['5'];
        if (sum === 6 && combos['6']?.enabled !== false) return combos['6'];
        if (sum % 2 === 0 && combos['even']?.enabled !== false) return combos['even'];
        if (combos['odd']?.enabled !== false) return combos['odd'];
        
        return null;
    };
    
    // Определение комбинации и расчет выигрыша
    const evaluateRoll = (val1, val2) => {
        const sum = val1 + val2;
        const isDouble = val1 === val2;
        let winAmount = 0;
        let combo = getCombo(sum, isDouble);
        
        if (combo) {
            winAmount = Math.floor(settings.cost * combo.multiplier * betMultiplier);
        }
        
        // Шанс на джекпот
        const jackpotChance = Math.random() < (settings.jackpotChance / 100);
        let isJackpot = false;
        
        if (jackpotChance && winAmount > 0) {
            winAmount += jackpot;
            combo = { ...combo, name: `${combo.name} + ДЖЕКПОТ!`, multiplier: combo.multiplier + 10, icon: '💎' };
            saveJackpot(settings.jackpotBase);
            isJackpot = true;
        } else if (!jackpotChance && winAmount === 0) {
            const addedToJackpot = Math.floor(settings.cost * betMultiplier * (settings.jackpotContribution / 100));
            saveJackpot(jackpot + addedToJackpot);
        }
        
        return { winAmount, combo, isJackpot };
    };
    
    const rollDice = async () => {
    if (isRolling) return;
    if (!settings.active) {
        alert('Игра временно недоступна');
        return;
    }
    
    const totalCost = settings.cost * betMultiplier;
    if (userBalance < totalCost) {
        alert(`❌ Недостаточно бонусов! Нужно ${totalCost} бонусов.`);
        return;
    }
    
    
    await onBalanceUpdate(-totalCost, 'spend', { source: 'game', gameType: 'dice' });
    
    setIsRolling(true);
    setResult(null);
    
    let rollCount = 0;
    const maxRolls = 12;
    const final1 = Math.floor(Math.random() * 6) + 1;
    const final2 = Math.floor(Math.random() * 6) + 1;
    
    const interval = setInterval(() => {
        setDice1(Math.floor(Math.random() * 6) + 1);
        setDice2(Math.floor(Math.random() * 6) + 1);
        rollCount++;
        
        if (rollCount >= maxRolls) {
            clearInterval(interval);
            setDice1(final1);
            setDice2(final2);
            
            const { winAmount, combo, isJackpot } = evaluateRoll(final1, final2);
            
            // ✅ Используем async функцию внутри setTimeout
            setTimeout(async () => {
                if (winAmount > 0) {
                    // ✅ Дожидаемся начисления выигрыша
                    await onBalanceUpdate(winAmount, 'earn', { source: 'game', gameType: 'dice' });
                    setLastWin(winAmount);
                    createParticles();
                    
                    const newHistory = [{
                        id: Date.now(),
                        dice1: final1,
                        dice2: final2,
                        combo: combo?.name || 'Выигрыш',
                        win: winAmount,
                        multiplier: betMultiplier
                    }, ...comboHistory].slice(0, 10);
                    setComboHistory(newHistory);
                    localStorage.setItem('dice_history', JSON.stringify(newHistory));
                    
                    setResult({
                        win: true,
                        amount: winAmount,
                        combo: combo,
                        message: `${combo?.icon || '🎉'} ${combo?.name || 'Выигрыш'}! +${winAmount} бонусов!`,
                        isJackpot
                    });
                    
                    if (winAmount > 100) {
                        try { navigator.vibrate?.(200); } catch(e) {}
                    }
                } else {
                    setResult({
                        win: false,
                        amount: 0,
                        message: `😢 Выпало ${final1} и ${final2} (сумма ${final1 + final2}). Попробуйте ещё раз!`
                    });
                }
                
                setIsRolling(false);
                
                // ✅ Обновляем прогресс задания (даже при проигрыше, за саму игру)
                if (typeof window.updateQuestProgress === 'function') {
                    console.log('🎲 Вызов updateQuestProgress для play_dice');
                    window.updateQuestProgress('play_dice', 1);
                } else {
                    console.error('❌ window.updateQuestProgress не функция!');
                    window.dispatchEvent(new CustomEvent('questProgress', { 
                        detail: { type: 'play_dice', increment: 1 } 
                    }));
                }
            }, 200);
        }
    }, 80);
};
    
    // Функция для отображения точек на кубике
    const renderDiceDots = (value) => {
        const dotPositions = {
            1: [[1, 1]],
            2: [[0, 0], [2, 2]],
            3: [[0, 0], [1, 1], [2, 2]],
            4: [[0, 0], [0, 2], [2, 0], [2, 2]],
            5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
            6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
        };
        
        const positions = dotPositions[value] || [];
        
        return (
            <div className="dice-dots-grid">
                {[0, 1, 2].map(row => (
                    [0, 1, 2].map(col => {
                        const hasDot = positions.some(([r, c]) => r === row && c === col);
                        return (
                            <div 
                                key={`${row}-${col}`} 
                                className={`dice-dot ${hasDot ? 'active' : ''}`}
                            />
                        );
                    })
                ))}
            </div>
        );
    };
    
    if (!settingsLoaded) {
        return (
            <div className="dice-roll-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <div style={{ color: 'white' }}>Загрузка...</div>
            </div>
        );
    }
    
    if (!settings.active) {
        return (
            <div className="dice-roll-container" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎲</div>
                <div style={{ color: '#ffd966', fontSize: '18px', fontWeight: 'bold' }}>Игра временно недоступна</div>
                <div style={{ color: '#aaa', fontSize: '14px', marginTop: '8px' }}>Загляните позже!</div>
            </div>
        );
    }
    
    // Фильтруем активные комбинации для отображения
    const activeCombinations = Object.entries(settings.combinations).filter(([_, combo]) => combo.enabled !== false);
    
    return (
        <div className="dice-roll-container">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        position: 'fixed',
                        left: p.x,
                        top: p.y,
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        opacity: p.life,
                        backgroundColor: p.color,
                        pointerEvents: 'none',
                        zIndex: 1000,
                        transform: `scale(${p.life})`
                    }}
                />
            ))}
            
            <div className="dice-header">
                <div className="dice-title">
                    <span className="dice-main-emoji">🎲</span>
                    <h3>Кости: Премиум</h3>
                </div>
                <div className="dice-stats-panel">
                    <div className="jackpot-display">
                        <span className="jackpot-icon">💎</span>
                        <span className="jackpot-value">{jackpot.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            {/* Множитель ставки */}
            <div className="bet-multiplier-section">
                <div className="multiplier-label">Множитель ставки:</div>
                <div className="multiplier-buttons">
                    {settings.betMultipliers.map(mult => (
                        <button
                            key={mult}
                            className={`multiplier-btn ${betMultiplier === mult ? 'active' : ''}`}
                            onClick={() => setBetMultiplier(mult)}
                            disabled={isRolling}
                        >
                            x{mult}
                        </button>
                    ))}
                </div>
                <div className="total-cost">
                    Стоимость: <span className="cost-value">{settings.cost * betMultiplier}</span> бонусов
                </div>
            </div>
            
            {/* Игровая область с костями */}
            <div className="dice-game-area">
                <div className="dice-table">
                    <div className={`dice-wrapper ${isRolling ? 'rolling' : ''}`}>
                        <div className="dice-cube">
                            {renderDiceDots(dice1)}
                        </div>
                    </div>
                    <div className="dice-vs">VS</div>
                    <div className={`dice-wrapper ${isRolling ? 'rolling' : ''}`}>
                        <div className="dice-cube">
                            {renderDiceDots(dice2)}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Кнопка броска */}
            <div className="dice-controls">
                <button
                    className={`roll-btn ${isRolling ? 'spinning' : ''}`}
                    onClick={rollDice}
                    disabled={isRolling || userBalance < settings.cost * betMultiplier}
                >
                    {isRolling ? (
                        <><span className="spinner-icon">🎲</span> Бросаем...</>
                    ) : (
                        <><span className="roll-icon">🎲</span> Бросить кости!</>
                    )}
                </button>
            </div>
            
            {/* Результат */}
            {result && (
                <div className={`dice-result ${result.win ? 'win' : 'lose'} ${result.isJackpot ? 'jackpot' : ''}`}>
                    <div className="result-emoji">{result.win ? (result.isJackpot ? '💎' : '🎉') : '😢'}</div>
                    <div className="result-message">{result.message}</div>
                    {result.win && result.combo && (
                        <div className="combo-badge" style={{ backgroundColor: result.combo.color }}>
                            x{result.combo.multiplier}
                        </div>
                    )}
                </div>
            )}
            
            {/* Последний выигрыш */}
            {lastWin !== null && !result && lastWin > 0 && (
                <div className="last-win-card">
                    <span className="trophy-icon">🏆</span>
                    <span>Последний выигрыш: {lastWin} бонусов</span>
                </div>
            )}
            
            {/* Таблица комбинаций */}
            <div className="combinations-section">
                <button 
                    className="combinations-toggle"
                    onClick={() => setShowCombinations(!showCombinations)}
                >
                    {showCombinations ? '📋 Скрыть комбинации' : '📖 Показать все комбинации'}
                </button>
                
                {showCombinations && (
                    <div className="combinations-grid">
                        {activeCombinations.map(([key, combo]) => (
                            <div key={key} className="combo-card" style={{ borderColor: combo.color }}>
                                <div className="combo-icon">{combo.icon}</div>
                                <div className="combo-name">{combo.name}</div>
                                <div className="combo-multiplier">x{combo.multiplier}</div>
                                <div className="combo-desc">{combo.description}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* История комбинаций */}
            {comboHistory.length > 0 && (
                <div className="history-section">
                    <div className="history-title">📜 Последние выигрыши</div>
                    <div className="history-list">
                        {comboHistory.slice(0, 5).map(entry => (
                            <div key={entry.id} className="history-item">
                                <div className="history-dice">
                                    🎲 {entry.dice1} + {entry.dice2}
                                </div>
                                <div className="history-combo">{entry.combo}</div>
                                <div className="history-win">+{entry.win}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}