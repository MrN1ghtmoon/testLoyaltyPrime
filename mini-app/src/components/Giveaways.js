import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

export function Giveaways({ selectedGroupId, userId, userBalance, onBalanceUpdate }) {
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchasingId, setPurchasingId] = useState(null);
  const [purchasedGiveaways, setPurchasedGiveaways] = useState({});

  useEffect(() => {
    if (selectedGroupId) {
      loadGiveaways();
      if (userId) {
        loadPurchasedGiveaways();
      }
    }
  }, [selectedGroupId, userId]);

  const loadGiveaways = async () => {
    if (!selectedGroupId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Загружаем розыгрыши с информацией о покупке для пользователя
      const url = userId 
        ? `${API_URL}/api/giveaways/${selectedGroupId}/active?userId=${userId}`
        : `${API_URL}/api/giveaways/${selectedGroupId}/active`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        console.log('Загружены розыгрыши:', data.giveaways);
        setGiveaways(data.giveaways);
      } else {
        setError('Ошибка загрузки розыгрышей');
      }
    } catch (error) {
      console.error('Ошибка загрузки розыгрышей:', error);
      setError('Не удалось загрузить розыгрыши');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchasedGiveaways = async () => {
    if (!selectedGroupId || !userId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/giveaways/purchased/${selectedGroupId}`);
      const data = await response.json();
      
      if (data.success) {
        const purchasedMap = {};
        data.purchased.forEach(p => {
          purchasedMap[p.giveaway_id] = true;
        });
        setPurchasedGiveaways(purchasedMap);
        console.log('Купленные розыгрыши:', purchasedMap);
      }
    } catch (error) {
      console.error('Ошибка загрузки купленных розыгрышей:', error);
    }
  };

  const purchaseGiveaway = async (giveaway) => {
    if (!userId || !selectedGroupId) {
      alert('Ошибка: пользователь не авторизован');
      return;
    }
    
    if (userBalance < giveaway.bonus_cost) {
      alert(`❌ Недостаточно бонусов! Нужно: ${giveaway.bonus_cost}, у вас: ${userBalance}`);
      return;
    }
    
    if (!confirm(`Купить доступ к розыгрышу "${giveaway.name}" за ${giveaway.bonus_cost} бонусов?`)) {
      return;
    }
    
    setPurchasingId(giveaway.id);
    
    try {
      const response = await fetch(`${API_URL}/api/giveaways/${giveaway.id}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          companyId: selectedGroupId
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Обновляем баланс
        if (onBalanceUpdate) {
          await onBalanceUpdate(-giveaway.bonus_cost, 'spend');
        }
        
        // Обновляем список купленных розыгрышей
        await loadPurchasedGiveaways();
        
        alert(`✅ Доступ к розыгрышу "${giveaway.name}" куплен!`);
      } else {
        alert(`❌ Ошибка: ${data.message || 'Не удалось купить доступ'}`);
      }
    } catch (error) {
      console.error('Ошибка покупки:', error);
      alert('❌ Ошибка подключения к серверу');
    } finally {
      setPurchasingId(null);
    }
  };

  const openGiveaway = (giveaway) => {
    // Для платных розыгрышей проверяем, куплен ли доступ
    if (giveaway.is_paid && !purchasedGiveaways[giveaway.id]) {
      alert(`❌ Доступ к розыгрышу "${giveaway.name}" не куплен. Приобретите его за ${giveaway.bonus_cost} бонусов.`);
      return;
    }
    
    // Открываем ссылку в новом окне
    window.open(giveaway.link, '_blank', 'noopener,noreferrer');
  };

  const isGiveawayAvailable = (giveaway) => {
    if (!giveaway.active) return false;
    
    // Проверяем дату окончания
    if (giveaway.end_date && new Date(giveaway.end_date) < new Date()) {
      return false;
    }
    
    // Для платных проверяем, куплен ли доступ
    if (giveaway.is_paid && !purchasedGiveaways[giveaway.id]) {
      return false;
    }
    
    return true;
  };

  // Функция для форматирования даты окончания
  const formatEndDate = (endDate) => {
    if (!endDate) return null;
    const date = new Date(endDate);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Функция для получения оставшегося времени
  const getTimeLeft = (endDate) => {
    if (!endDate) return null;
    const now = new Date();
    const end = new Date(endDate);
    const diffMs = end - now;
    
    if (diffMs <= 0) return 'Завершен';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `Осталось ${diffDays} ${getDaysWord(diffDays)}`;
    } else if (diffHours > 0) {
      return `Осталось ${diffHours} ${getHoursWord(diffHours)}`;
    } else {
      return `Осталось ${diffMinutes} ${getMinutesWord(diffMinutes)}`;
    }
  };

  const getDaysWord = (days) => {
    if (days >= 11 && days <= 14) return 'дней';
    const lastDigit = days % 10;
    if (lastDigit === 1) return 'день';
    if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
    return 'дней';
  };

  const getHoursWord = (hours) => {
    if (hours >= 11 && hours <= 14) return 'часов';
    const lastDigit = hours % 10;
    if (lastDigit === 1) return 'час';
    if (lastDigit >= 2 && lastDigit <= 4) return 'часа';
    return 'часов';
  };

  const getMinutesWord = (minutes) => {
    if (minutes >= 11 && minutes <= 14) return 'минут';
    const lastDigit = minutes % 10;
    if (lastDigit === 1) return 'минута';
    if (lastDigit >= 2 && lastDigit <= 4) return 'минуты';
    return 'минут';
  };

  if (loading) {
    return (
      <div style={{ 
        background: 'rgba(30, 35, 48, 0.7)', 
        borderRadius: 28, 
        padding: 20,
        textAlign: 'center',
        color: 'white'
      }}>
        <div style={{ fontSize: 16 }}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        background: 'rgba(30, 35, 48, 0.7)', 
        borderRadius: 28, 
        padding: 20,
        textAlign: 'center',
        color: '#ff6b6b'
      }}>
        <div style={{ fontSize: 16 }}>{error}</div>
        <button 
          onClick={loadGiveaways}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (giveaways.length === 0) {
    return (
      <div style={{ 
        background: 'rgba(30, 35, 48, 0.7)', 
        borderRadius: 28, 
        padding: 20,
        textAlign: 'center',
        color: 'white'
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎰</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Нет активных розыгрышей
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>
          Следите за обновлениями! Скоро появятся новые розыгрыши 🎁
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'rgba(30, 35, 48, 0.7)', 
      borderRadius: 28, 
      padding: 20
    }}>
      <h3 style={{ 
        fontSize: 18, 
        marginBottom: 16, 
        color: 'white',
        fontWeight: 700
      }}>
        🎰 Розыгрыши
      </h3>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 12 
      }}>
        {giveaways.map(giveaway => {
          const isAvailable = isGiveawayAvailable(giveaway);
          const isPurchased = purchasedGiveaways[giveaway.id];
          const endDate = giveaway.end_date ? new Date(giveaway.end_date) : null;
          const isExpired = endDate && endDate < new Date();
          const timeLeftText = getTimeLeft(giveaway.end_date);
          const formattedEndDate = formatEndDate(giveaway.end_date);
          
          return (
            <div 
              key={giveaway.id}
              style={{ 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: 16, 
                padding: 16,
                cursor: isAvailable ? 'pointer' : 'not-allowed',
                transition: 'transform 0.2s, background 0.2s',
                border: `1px solid ${giveaway.is_paid ? 'rgba(255,217,102,0.3)' : 'rgba(255,255,255,0.1)'}`,
                opacity: isAvailable ? 1 : 0.6
              }}
              onMouseEnter={(e) => {
                if (isAvailable) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (isAvailable) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                }
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'space-between',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 8
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: 16,
                    color: 'white',
                    marginBottom: 4
                  }}>
                    🎁 {giveaway.name}
                    {giveaway.is_paid && (
                      <span style={{
                        background: '#ffd966',
                        color: '#1a1f2e',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 600
                      }}>
                        💎 Платный
                      </span>
                    )}
                    {!giveaway.is_paid && (
                      <span style={{
                        background: '#a8e6cf',
                        color: '#1a1f2e',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 600
                      }}>
                        🎁 Бесплатный
                      </span>
                    )}
                    {isExpired && (
                      <span style={{
                        background: '#e74c3c',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 600
                      }}>
                        ⏰ Завершен
                      </span>
                    )}
                  </div>
                  
                  {giveaway.description && (
                    <div style={{ 
                      fontSize: 13, 
                      opacity: 0.7, 
                      marginBottom: 8, 
                      color: 'white',
                      lineHeight: 1.4
                    }}>
                      {giveaway.description}
                    </div>
                  )}
                  
                  {/* ДАТА ОКОНЧАНИЯ - ВИДНА ВСЕГДА */}
                  {formattedEndDate && !isExpired && (
                    <div style={{ 
                      fontSize: 12, 
                      color: timeLeftText?.includes('Осталось') ? '#ffd966' : '#aaa',
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap'
                    }}>
                      <span>📅 До {formattedEndDate}</span>
                      {timeLeftText && timeLeftText !== 'Завершен' && (
                        <span style={{ 
                          background: 'rgba(0,0,0,0.3)', 
                          padding: '2px 8px', 
                          borderRadius: 12,
                          fontSize: 11,
                          color: '#ffd966'
                        }}>
                          ⏰ {timeLeftText}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {formattedEndDate && isExpired && (
                    <div style={{ 
                      fontSize: 12, 
                      color: '#e74c3c',
                      marginTop: 6
                    }}>
                      ⏰ Розыгрыш завершен {formattedEndDate}
                    </div>
                  )}
                  
                  {giveaway.is_paid && !isPurchased && !isExpired && (
                    <div style={{ 
                      fontSize: 13, 
                      color: '#ffd966',
                      marginTop: 8,
                      fontWeight: 600
                    }}>
                      💰 Стоимость доступа: {giveaway.bonus_cost} бонусов
                    </div>
                  )}
                  
                  {giveaway.is_paid && isPurchased && !isExpired && (
                    <div style={{ 
                      fontSize: 12, 
                      color: '#2ecc71',
                      marginTop: 8,
                      fontWeight: 600
                    }}>
                      ✅ Доступ куплен
                    </div>
                  )}
                </div>
                
                {!isExpired && (
                  <div>
                    {giveaway.is_paid && !isPurchased ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          purchaseGiveaway(giveaway);
                        }}
                        disabled={purchasingId === giveaway.id || userBalance < giveaway.bonus_cost}
                        style={{
                          padding: '8px 16px',
                          background: userBalance >= giveaway.bonus_cost ? '#ffd966' : '#666',
                          border: 'none',
                          borderRadius: 12,
                          color: userBalance >= giveaway.bonus_cost ? '#1a1f2e' : '#aaa',
                          fontWeight: 600,
                          cursor: userBalance >= giveaway.bonus_cost ? 'pointer' : 'not-allowed',
                          fontSize: 13
                        }}
                      >
                        {purchasingId === giveaway.id ? '⏳...' : `Купить за ${giveaway.bonus_cost}`}
                      </button>
                    ) : (
                      <div
                        onClick={() => openGiveaway(giveaway)}
                        style={{
                          padding: '8px 16px',
                          background: isAvailable ? '#3498db' : '#555',
                          borderRadius: 12,
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 13,
                          textAlign: 'center',
                          cursor: isAvailable ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {isAvailable ? 'Участвовать →' : (isExpired ? 'Завершен' : 'Недоступен')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}