import { useState, useEffect } from 'react';
import vkBridge from '@vkontakte/vk-bridge';
import './ReferralSystem.css';

export function ReferralSystem({ onBalanceUpdate, userId, selectedGroupId }) {
    const [referralCode, setReferralCode] = useState('');
    const [referralInput, setReferralInput] = useState('');
    const [referrals, setReferrals] = useState([]);
    const [referralStats, setReferralStats] = useState({
        total: 0,
        active: 0,
        earned: 0
    });
    const [inviteLink, setInviteLink] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [activateSuccess, setActivateSuccess] = useState(false);
    const [activateError, setActivateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [usedReferralCode, setUsedReferralCode] = useState(null);

    // Загрузка реферальных данных
    useEffect(() => {
        if (userId && selectedGroupId) {
            loadReferralData();
        }
    }, [userId, selectedGroupId]);

    const loadReferralData = () => {
        // Загружаем реферальный код пользователя
        const savedCode = localStorage.getItem(`referral_code_${userId}_${selectedGroupId}`);
        if (savedCode) {
            setReferralCode(savedCode);
        } else {
            const newCode = generateReferralCode();
            setReferralCode(newCode);
            localStorage.setItem(`referral_code_${userId}_${selectedGroupId}`, newCode);
        }
        
        // Загружаем список приглашенных
        const referralsKey = `referrals_${userId}_${selectedGroupId}`;
        const savedReferrals = localStorage.getItem(referralsKey);
        if (savedReferrals) {
            setReferrals(JSON.parse(savedReferrals));
        }
        
        // Загружаем статистику
        const statsKey = `referral_stats_${userId}_${selectedGroupId}`;
        const savedStats = localStorage.getItem(statsKey);
        if (savedStats) {
            setReferralStats(JSON.parse(savedStats));
        } else {
            updateReferralStats();
        }
        
        // Проверяем, использовал ли пользователь чей-то реферальный код
        const usedCode = localStorage.getItem(`used_referral_code_${userId}_${selectedGroupId}`);
        if (usedCode) {
            setUsedReferralCode(usedCode);
        }
        
        // Генерируем ссылку для приглашения
        const link = generateInviteLink(savedCode || newCode);
        setInviteLink(link);
        
        setLoading(false);
    };

    const generateReferralCode = () => {
        // Генерируем уникальный код на основе ID пользователя и случайных символов
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `${userId}_${randomPart}`;
        return code;
    };

    const generateInviteLink = (code) => {
        // Получаем текущий URL приложения
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0];
        return `${baseUrl}?ref=${code}`;
    };

    const copyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
            
            // Вибрация при успешном копировании
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        } catch (err) {
            // Fallback через VK Bridge
            try {
                await vkBridge.send("VKWebAppCopyText", { text: inviteLink });
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            } catch(e) {
                alert('Не удалось скопировать ссылку');
            }
        }
    };

    const shareInvite = async () => {
    try {
        await vkBridge.send("VKWebAppShare", {
            link: inviteLink,
            text: `Присоединяйся к программе лояльности! Используй мой реферальный код: ${referralCode}`
        });
        
        // 🔥 ОБНОВЛЯЕМ КВЕСТ "ПРИГЛАСИТЬ ДРУГА" 🔥
        if (typeof window.updateQuestProgress === 'function') {
            window.updateQuestProgress('invite_friend', 1);
            console.log('✅ Квест "Пригласить друга" обновлен');
        }
    } catch (error) {
        console.error('Ошибка шаринга:', error);
        copyInviteLink();
    }
};

    // Обновление статистики
    const updateReferralStats = () => {
        const referralsKey = `referrals_${userId}_${selectedGroupId}`;
        const referralsList = JSON.parse(localStorage.getItem(referralsKey) || '[]');
        
        const stats = {
            total: referralsList.length,
            active: referralsList.filter(r => r.active).length,
            earned: referralsList.reduce((sum, r) => sum + (r.earnedBonus || 0), 0)
        };
        
        setReferrals(referralsList);
        setReferralStats(stats);
        localStorage.setItem(`referral_stats_${userId}_${selectedGroupId}`, JSON.stringify(stats));
    };

    // Добавление нового реферала
    const addReferral = (newUserId, refCode) => {
        const referralsKey = `referrals_${userId}_${selectedGroupId}`;
        const currentReferrals = JSON.parse(localStorage.getItem(referralsKey) || '[]');
        
        // Проверяем, не добавлен ли уже
        if (!currentReferrals.find(r => r.userId === newUserId)) {
            currentReferrals.push({
                userId: newUserId,
                code: refCode,
                date: new Date().toISOString(),
                active: true,
                earnedBonus: 50
            });
            localStorage.setItem(referralsKey, JSON.stringify(currentReferrals));
            
            // Начисляем бонус за приглашение
            if (onBalanceUpdate) {
                onBalanceUpdate(50, 'earn');
            }
            
            updateReferralStats();
            return true;
        }
        return false;
    };

    // Активация чужого реферального кода
    const submitReferralCode = async () => {
        if (!referralInput.trim()) {
            setActivateError('Введите реферальный код');
            setTimeout(() => setActivateError(''), 3000);
            return;
        }
        
        // Проверяем, не использовал ли уже пользователь код
        const usedKey = `used_referral_code_${userId}_${selectedGroupId}`;
        const alreadyUsed = localStorage.getItem(usedKey);
        if (alreadyUsed) {
            setActivateError('Вы уже активировали реферальный код ранее');
            setTimeout(() => setActivateError(''), 3000);
            return;
        }
        
        // Проверяем, не пытается ли пользователь использовать свой собственный код
        if (referralInput === referralCode) {
            setActivateError('Нельзя активировать свой собственный реферальный код');
            setTimeout(() => setActivateError(''), 3000);
            return;
        }
        
        // Ищем пригласившего пользователя по коду
        const allUsers = JSON.parse(localStorage.getItem('loyaltyPrime_users') || '{}');
        let inviterId = null;
        
        // Проверяем все сохраненные коды
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('referral_code_')) {
                const code = localStorage.getItem(key);
                if (code === referralInput) {
                    // Извлекаем userId из ключа
                    const match = key.match(/referral_code_(.+)_(.+)/);
                    if (match) {
                        inviterId = match[1];
                        break;
                    }
                }
            }
        }
        
        if (!inviterId) {
            setActivateError('Неверный реферальный код');
            setTimeout(() => setActivateError(''), 3000);
            return;
        }
        
        // Сохраняем, что пользователь использовал код
        localStorage.setItem(usedKey, referralInput);
        setUsedReferralCode(referralInput);
        
        // Начисляем бонус пользователю за активацию кода
        if (onBalanceUpdate) {
            onBalanceUpdate(100, 'earn'); // Бонус за активацию кода
        }
        
        // Добавляем пользователя в рефералы пригласившего
        const inviterReferralsKey = `referrals_${inviterId}_${selectedGroupId}`;
        const inviterReferrals = JSON.parse(localStorage.getItem(inviterReferralsKey) || '[]');
        
        if (!inviterReferrals.find(r => r.userId === userId)) {
            inviterReferrals.push({
                userId: userId,
                code: referralInput,
                date: new Date().toISOString(),
                active: true,
                earnedBonus: 50
            });
            localStorage.setItem(inviterReferralsKey, JSON.stringify(inviterReferrals));
            
            // Обновляем статистику пригласившего в localStorage
            const inviterStatsKey = `referral_stats_${inviterId}_${selectedGroupId}`;
            const inviterStats = JSON.parse(localStorage.getItem(inviterStatsKey) || '{"total":0,"active":0,"earned":0}');
            inviterStats.total += 1;
            inviterStats.active += 1;
            inviterStats.earned += 50;
            localStorage.setItem(inviterStatsKey, JSON.stringify(inviterStats));
        }
        
        setActivateSuccess(true);
        setTimeout(() => setActivateSuccess(false), 3000);
        
        // Очищаем поле ввода
        setReferralInput('');
    };

    // Проверка реферального кода при загрузке (из URL параметров)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode && !usedReferralCode && refCode !== referralCode) {
            // Автоматически активируем код из URL
            setReferralInput(refCode);
            setTimeout(() => {
                submitReferralCode();
            }, 1000);
        }
    }, [referralCode, usedReferralCode]);

    if (loading) {
        return <div className="referral-loading">Загрузка реферальной системы...</div>;
    }

    return (
        <div className="referral-system">
            <div className="referral-header">
                <h3>👥 Реферальная программа</h3>
                <p>Приглашайте друзей и получайте бонусы!</p>
            </div>

            {/* Статистика */}
            <div className="referral-stats-card">
                <div className="stat-item">
                    <div className="stat-value">{referralStats.total}</div>
                    <div className="stat-label">Приглашений</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{referralStats.active}</div>
                    <div className="stat-label">Активных</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{referralStats.earned}</div>
                    <div className="stat-label">Заработано</div>
                </div>
            </div>

            {/* Ввод чужого реферального кода */}
            <div className="enter-referral-section">
                <div className="referral-title">🔑 Есть реферальный код?</div>
                <div className="referral-input-group">
                    <input 
                        type="text" 
                        placeholder="Введите код приглашения"
                        className="referral-input"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value)}
                        disabled={!!usedReferralCode}
                    />
                    <button 
                        className="referral-submit-btn"
                        onClick={submitReferralCode}
                        disabled={!referralInput || !!usedReferralCode}
                    >
                        Активировать
                    </button>
                </div>
                {activateError && (
                    <div className="referral-error">{activateError}</div>
                )}
                {activateSuccess && (
                    <div className="referral-success">✅ Код активирован! Вы получили 100 бонусов!</div>
                )}
                {usedReferralCode && (
                    <div className="referral-used">
                        ✅ Вы уже активировали код: {usedReferralCode}
                    </div>
                )}
            </div>

            {/* Ваш реферальный код */}
            <div className="referral-code-section">
                <div className="code-label">👇 Ваш реферальный код:</div>
                <div className="code-display">
                    <span className="code">{referralCode}</span>
                    <button className="copy-btn" onClick={copyInviteLink}>
                        {copySuccess ? '✅' : '📋'}
                    </button>
                </div>
                <div className="code-hint">
                    Поделитесь этим кодом с друзьями!
                </div>
            </div>

            {/* Информация о бонусах */}
            <div className="referral-bonus-info">
                <div className="bonus-item">
                    <span className="bonus-icon">🎁</span>
                    <div>
                        <div className="bonus-title">За приглашение друга</div>
                        <div className="bonus-desc">+50 бонусов за каждого приглашённого</div>
                    </div>
                </div>
                <div className="bonus-item">
                    <span className="bonus-icon">🎉</span>
                    <div>
                        <div className="bonus-title">За активацию кода</div>
                        <div className="bonus-desc">+100 бонусов при вводе реферального кода</div>
                    </div>
                </div>
                <div className="bonus-item">
                    <span className="bonus-icon">💎</span>
                    <div>
                        <div className="bonus-title">За активность друга</div>
                        <div className="bonus-desc">+10% от покупок друга (до 500 бонусов)</div>
                    </div>
                </div>
            </div>

            {/* Кнопка приглашения */}
            <button className="share-invite-btn" onClick={shareInvite}>
                📤 Пригласить друга
            </button>

            {/* Список приглашенных */}
            {referrals.length > 0 && (
                <div className="referrals-list">
                    <h4>📋 Ваши приглашения ({referrals.length})</h4>
                    {referrals.map((ref, idx) => (
                        <div key={idx} className="referral-item">
                            <div className="referral-info">
                                <span className="referral-status active">✅</span>
                                <span>Приглашён {new Date(ref.date).toLocaleDateString()}</span>
                            </div>
                            <div className="referral-bonus">+{ref.earnedBonus} бонусов</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}