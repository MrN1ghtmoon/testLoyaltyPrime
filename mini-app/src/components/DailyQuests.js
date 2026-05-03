import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:3001';

export function DailyQuests({ userBalance, onBalanceUpdate, userId, selectedGroupId, vkId }) {
  const [quests, setQuests] = useState([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastStreakUpdateDate, setLastStreakUpdateDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastLoginDate, setLastLoginDate] = useState(null);
  const hasCheckedToday = useRef(false);
  const hasAutoCompleted = useRef(false);
  const streakCheckPerformed = useRef(false);

  // Функция для получения ключа localStorage для задания
  const getQuestStorageKey = (quest) => {
    return `quest_claimed_${userId}_${selectedGroupId}_${quest.id}`;
  };

  // Функция для проверки, можно ли получить бонус за задание (с учетом durationDays)
  const canClaimQuestBonus = (quest) => {
    if (!userId || !selectedGroupId) return false;
    
    const key = getQuestStorageKey(quest);
    const saved = localStorage.getItem(key);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const lastClaimDate = new Date(data.date);
        const today = new Date();
        const daysDiff = Math.floor((today - lastClaimDate) / (1000 * 60 * 60 * 24));
        
        const durationDays = quest.durationDays || 1;
        if (daysDiff < durationDays) {
          return false;
        }
      } catch(e) {}
    }
    return true;
  };

  // Сохраняем факт получения бонуса за задание
  const saveClaimedDate = (quest) => {
    if (!userId || !selectedGroupId) return;
    const today = new Date().toISOString();
    const key = getQuestStorageKey(quest);
    localStorage.setItem(key, JSON.stringify({ 
      date: today, 
      claimed: true,
      questId: quest.id,
      questTitle: quest.title
    }));
  };

  const getLastClaimDate = (quest) => {
    if (!userId || !selectedGroupId) return null;
    const key = getQuestStorageKey(quest);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return new Date(data.date);
      } catch(e) {}
    }
    return null;
  };

  const getTimeRemainingText = (quest) => {
    if (!userId || !selectedGroupId) return null;
    
    const lastClaimDate = getLastClaimDate(quest);
    if (!lastClaimDate) return null;
    
    const durationDays = quest.durationDays || 1;
    const nextAvailableDate = new Date(lastClaimDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    const now = new Date();
    
    if (now >= nextAvailableDate) return null;
    
    const diffMs = nextAvailableDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      return `Доступно через: ${days}д ${hours}ч`;
    } else if (diffHours > 0) {
      return `Доступно через: ${diffHours}ч ${diffMinutes}м`;
    } else {
      return `Доступно через: ${diffMinutes}м`;
    }
  };

  // ============ ФУНКЦИИ ДЛЯ СТРИКА ============
  
  // Получить список ежедневных заданий (durationDays = 1)
  const getDailyQuests = (questsList) => {
    return questsList.filter(q => q.durationDays === 1);
  };

  // Проверить, выполнены ли все ежедневные задания сегодня
  const areAllDailyQuestsCompletedToday = (questsList) => {
    const dailyQuests = getDailyQuests(questsList);
    if (dailyQuests.length === 0) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Проверяем, что все ежедневные задания выполнены и получены сегодня
    const allCompleted = dailyQuests.every(quest => {
      if (!quest.completed || !quest.claimed) return false;
      
      const lastClaimDate = getLastClaimDate(quest);
      if (!lastClaimDate) return false;
      
      const claimDate = new Date(lastClaimDate);
      claimDate.setHours(0, 0, 0, 0);
      
      return claimDate.getTime() === today.getTime();
    });
    
    return allCompleted;
  };

  // Проверить, были ли выполнены все ежедневные задания в указанную дату
  const wereAllDailyQuestsCompletedOnDate = (questsList, date) => {
    const dailyQuests = getDailyQuests(questsList);
    if (dailyQuests.length === 0) return false;
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const allCompleted = dailyQuests.every(quest => {
      const lastClaimDate = getLastClaimDate(quest);
      if (!lastClaimDate) return false;
      
      const claimDate = new Date(lastClaimDate);
      claimDate.setHours(0, 0, 0, 0);
      
      return claimDate.getTime() === targetDate.getTime();
    });
    
    return allCompleted;
  };

  // Получить все даты, когда были выполнены все ежедневные задания
  const getAllStreakDates = (questsList) => {
    const dailyQuests = getDailyQuests(questsList);
    if (dailyQuests.length === 0) return [];
    
    // Собираем все даты выполнения для каждого ежедневного задания
    const allCompletionDates = {};
    
    dailyQuests.forEach(quest => {
      const lastClaimDate = getLastClaimDate(quest);
      if (lastClaimDate) {
        const dateKey = lastClaimDate.toDateString();
        if (!allCompletionDates[dateKey]) {
          allCompletionDates[dateKey] = [];
        }
        allCompletionDates[dateKey].push(quest.id);
      }
    });
    
    // Фильтруем только те даты, где выполнены ВСЕ ежедневные задания
    const streakDates = [];
    const dailyQuestIds = dailyQuests.map(q => q.id);
    
    for (const [dateKey, completedQuestIds] of Object.entries(allCompletionDates)) {
      // Проверяем, что все ежедневные задания выполнены в этот день
      const allCompleted = dailyQuestIds.every(id => completedQuestIds.includes(id));
      if (allCompleted) {
        streakDates.push(new Date(dateKey));
      }
    }
    
    // Сортируем по убыванию
    return streakDates.sort((a, b) => b - a);
  };

  // Рассчитать текущий стрик на основе выполненных ежедневных заданий
  const calculateCurrentStreak = (questsList) => {
    const streakDates = getAllStreakDates(questsList);
    if (streakDates.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Проверяем, выполнены ли задания сегодня
    const completedToday = areAllDailyQuestsCompletedToday(questsList);
    
    // Проверяем, выполнены ли задания вчера
    const completedYesterday = wereAllDailyQuestsCompletedOnDate(questsList, yesterday);
    
    if (!completedToday && !completedYesterday) {
      return 0; // Стрик потерян
    }
    
    // Считаем непрерывную цепочку
    let currentStreak = 0;
    let checkDate = completedToday ? today : yesterday;
    
    while (true) {
      const completed = wereAllDailyQuestsCompletedOnDate(questsList, checkDate);
      if (!completed) break;
      
      currentStreak++;
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return currentStreak;
  };

  // Сохранение стрика в БД
  const saveStreakToDB = async (streakValue, lastUpdateDate) => {
    if (!userId || !selectedGroupId) return;
    
    try {
      await fetch(`${API_URL}/api/users/${userId}/streak/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedGroupId,
          streak: streakValue,
          lastStreakUpdateDate: lastUpdateDate || new Date().toISOString()
        })
      });
      console.log(`💾 Стрик сохранен в БД: ${streakValue}`);
    } catch (error) {
      console.error('Ошибка сохранения стрика:', error);
    }
    
    // Также сохраняем в localStorage
    localStorage.setItem(`daily_streak_${userId}_${selectedGroupId}`, streakValue);
    if (lastUpdateDate) {
      localStorage.setItem(`daily_streak_last_update_${userId}_${selectedGroupId}`, lastUpdateDate);
    }
  };

  // Загрузка стрика из БД
  const loadStreakFromDB = async () => {
    if (!userId || !selectedGroupId) return { streak: 0, lastUpdateDate: null };
    
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/streak/${selectedGroupId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return { 
            streak: data.streak || 0, 
            lastUpdateDate: data.lastStreakUpdateDate 
          };
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки стрика:', error);
    }
    
    // Fallback на localStorage
    const savedStreak = localStorage.getItem(`daily_streak_${userId}_${selectedGroupId}`);
    const savedDate = localStorage.getItem(`daily_streak_last_update_${userId}_${selectedGroupId}`);
    return { 
      streak: savedStreak ? parseInt(savedStreak) : 0, 
      lastUpdateDate: savedDate || null 
    };
  };

  // Обновление стрика после выполнения заданий
  const updateStreakAfterCompletion = async (updatedQuests) => {
    const newStreak = calculateCurrentStreak(updatedQuests);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const completedToday = areAllDailyQuestsCompletedToday(updatedQuests);
    const lastUpdateDateObj = lastStreakUpdateDate ? new Date(lastStreakUpdateDate) : null;
    const lastUpdateDay = lastUpdateDateObj ? new Date(lastUpdateDateObj) : null;
    if (lastUpdateDay) lastUpdateDay.setHours(0, 0, 0, 0);
    
    // Если сегодня все задания выполнены и стрик увеличился
    if (completedToday && newStreak > streak) {
      const bonusText = newStreak === 1 ? 'начали' : `увеличили до ${newStreak}`;
      showNotification(`🔥 Отлично! Вы ${bonusText} серию дней! +${newStreak * 5} бонусов за стрик!`);
      
      // Начисляем бонус за стрик (например, 5 бонусов за каждый день стрика)
      if (onBalanceUpdate) {
        await onBalanceUpdate(newStreak * 5, 'earn');
      }
    }
    
    // Проверяем потерю стрика
    if (lastUpdateDay && lastUpdateDay < today && !completedToday) {
      const wasCompletedYesterday = wereAllDailyQuestsCompletedOnDate(updatedQuests, 
        new Date(today.setDate(today.getDate() - 1)));
      
      if (!wasCompletedYesterday && streak > 0) {
        showNotification(`⚠️ Серия прервана! Вы пропустили выполнение ежедневных заданий. Начните новую серию!`);
      }
    }
    
    if (newStreak !== streak) {
      setStreak(newStreak);
      setLastStreakUpdateDate(completedToday ? new Date().toISOString() : lastStreakUpdateDate);
      await saveStreakToDB(newStreak, completedToday ? new Date().toISOString() : lastStreakUpdateDate);
    }
  };

  // Функция для обновления прогресса задания
  const updateQuestProgress = (questType, increment = 1) => {
    console.log(`📢 updateQuestProgress вызван: тип=${questType}, инкремент=${increment}`);
    
    setQuests(prev => {
      const updated = prev.map(quest => {
        // Проверяем соответствие типа задания
        let matches = false;
        const questTypeFromTitle = mapQuestType(quest.title);
        
        if (questType === questTypeFromTitle && !quest.completed && !quest.claimed) {
          matches = true;
        }
        
        if (matches) {
          const targetValue = quest.target;
          const newProgress = Math.min(quest.progress + increment, targetValue);
          const completed = newProgress >= targetValue;
          
          console.log(`    -> Новый прогресс: ${newProgress}/${targetValue}, completed=${completed}`);
          
          // НЕМЕДЛЕННО СОХРАНЯЕМ ПРОГРЕСС В БД
          if (userId && selectedGroupId) {
            saveQuestProgressToDB(quest.id, newProgress, completed);
          }
          
          if (completed && !quest.completed) {
            console.log(`    ✅ Задание "${quest.title}" выполнено!`);
          }
          
          return { ...quest, progress: newProgress, completed };
        }
        return quest;
      });
      
      return updated;
    });
  };

  // НОВАЯ ФУНКЦИЯ: сохранение прогресса в БД
  const saveQuestProgressToDB = async (questId, progress, completed) => {
    if (!userId || !selectedGroupId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/quests/progress/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedGroupId,
          questId: questId,
          progress: progress,
          completed: completed
        })
      });
      
      if (response.ok) {
        console.log(`💾 Прогресс задания ${questId} сохранен: ${progress}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения прогресса:', error);
    }
  };

  const updateQuestProgressRef = useRef(updateQuestProgress);

  // Обновляем ref при изменении функции
  useEffect(() => {
    updateQuestProgressRef.current = updateQuestProgress;
  }, [updateQuestProgress]);

  // Регистрируем глобальную функцию и обработчик событий
  useEffect(() => {
    // Глобальная функция
    const wrappedUpdateQuestProgress = (questType, increment = 1) => {
      console.log(`🌐 Глобальный вызов: тип=${questType}`);
      if (updateQuestProgressRef.current) {
        updateQuestProgressRef.current(questType, increment);
      } else {
        console.error('❌ updateQuestProgressRef.current не определен');
      }
    };
    
    window.updateQuestProgress = wrappedUpdateQuestProgress;
    
    // Обработчик событий (запасной вариант)
    const handleQuestProgress = (event) => {
      console.log(`📡 Событие questProgress:`, event.detail);
      if (event.detail && updateQuestProgressRef.current) {
        updateQuestProgressRef.current(event.detail.type, event.detail.increment || 1);
      }
    };
    
    window.addEventListener('questProgress', handleQuestProgress);
    
    console.log('✅ DailyQuests: зарегистрированы глобальные функции для обновления прогресса');
    
    return () => {
      delete window.updateQuestProgress;
      window.removeEventListener('questProgress', handleQuestProgress);
    };
  }, []);

  const markQuestAsCompleted = async (quest) => {
    if (!userId || !selectedGroupId) return;
    
    if (!canClaimQuestBonus(quest)) {
      setQuests(prev => prev.map(q => {
        if (q.id === quest.id) {
          return { ...q, completed: true, claimed: true };
        }
        return q;
      }));
      return;
    }
    
    setQuests(prev => prev.map(q => {
      if (q.id === quest.id) {
        return { ...q, completed: true, claimed: false };
      }
      return q;
    }));
  };

  const claimQuestBonus = async (quest) => {
    if (!userId || !selectedGroupId) return;
    
    if (!canClaimQuestBonus(quest)) {
      const timeRemaining = getTimeRemainingText(quest);
      showNotification(`❌ Бонус пока недоступен. ${timeRemaining || 'Попробуйте позже'}`);
      return;
    }
    
    if (quest.claimed) {
      showNotification('❌ Вы уже получили бонус за этот период');
      return;
    }
    
    try {
      if (onBalanceUpdate) {
        await onBalanceUpdate(quest.reward, 'earn');
      }
      
      setQuests(prev => {
        const updated = prev.map(q => 
          q.id === quest.id ? { ...q, claimed: true } : q
        );
        // Обновляем стрик после изменения статуса задания
        setTimeout(() => updateStreakAfterCompletion(updated), 0);
        return updated;
      });
      
      saveClaimedDate(quest);
      
      await fetch(`${API_URL}/api/users/completeQuest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          questId: quest.id,
          reward: quest.reward,
          claimReward: true
        })
      });
      
      showNotification(`🎁 Задание "${quest.title}" выполнено! +${quest.reward} бонусов!`);
      
    } catch (error) {
      console.error('Ошибка начисления бонуса:', error);
      showNotification('❌ Ошибка при получении бонуса');
    }
  };

  const handleDailyLogin = async (quest) => {
    if (!userId || !selectedGroupId) return;
    
    if (!canClaimQuestBonus(quest)) {
      setQuests(prev => prev.map(q => {
        if (q.id === quest.id) {
          return { ...q, completed: true, claimed: true };
        }
        return q;
      }));
      return;
    }
    
    setQuests(prev => prev.map(q => {
      if (q.id === quest.id) {
        return { ...q, completed: true, claimed: false };
      }
      return q;
    }));
    
    showNotification(`✅ Задание "${quest.title}" выполнено! Нажмите "Забрать" чтобы получить +${quest.reward} бонусов!`);
  };

  const loadLastCompletedDates = async () => {
    if (!userId || !selectedGroupId) return {};
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/quests/last-completed/${selectedGroupId}`);
      if (response.ok) {
        const data = await response.json();
        return data.dates || {};
      }
    } catch (error) {
      console.error('Ошибка загрузки дат выполнения:', error);
    }
    return {};
  };

  const loadUserProgress = async () => {
    if (!userId || !selectedGroupId) return null;
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/quests/progress/all`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Ошибка загрузки прогресса из БД:', error);
    }
    return null;
  };

  const loadQuestsFromDB = async () => {
    if (!selectedGroupId) return [];
    try {
      const response = await fetch(`${API_URL}/api/quests/${selectedGroupId}`);
      if (response.ok) {
        const questsData = await response.json();
        const userProgress = await loadUserProgress();
        const userQuestProgress = userProgress?.quests || [];
        
        console.log('📥 Загруженный прогресс из БД:', userQuestProgress);
        
        const transformed = questsData
          .filter(q => q.active)
          .map(q => {
            const userProgressForQuest = userQuestProgress.find(p => p.id === q.id);
            
            // Используем прогресс из БД, если он есть
            let progress = userProgressForQuest?.progress || 0;
            let isCompleted = userProgressForQuest?.completed || false;
            let isClaimed = userProgressForQuest?.claimed || false;
            
            // Проверяем в localStorage для заданий с периодом
            const key = getQuestStorageKey(q);
            const saved = localStorage.getItem(key);
            if (saved && !isClaimed) {
              try {
                const data = JSON.parse(saved);
                const lastClaimDate = new Date(data.date);
                const today = new Date();
                const durationDays = q.duration_days || 1;
                const daysDiff = Math.floor((today - lastClaimDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff < durationDays) {
                  isClaimed = true;
                  isCompleted = true;
                }
              } catch(e) {}
            }
            
            return {
              id: q.id,
              title: q.title,
              description: q.description || '',
              reward: q.reward,
              type: mapQuestType(q.title),
              target: getTargetByType(q.title),
              progress: progress,
              completed: isCompleted,
              claimed: isClaimed,
              emoji: q.emoji || '✅',
              durationDays: q.duration_days || 1,
              status: q.active ? 'active' : 'inactive',
              lastCompletedAt: null
            };
          });
        
        console.log('📋 ЗАГРУЖЕННЫЕ ЗАДАНИЯ С ПРОГРЕССОМ:');
        transformed.forEach(q => {
          console.log(`  - ${q.title}: прогресс ${q.progress}/${q.target}, completed=${q.completed}, durationDays=${q.durationDays}`);
        });
        
        // Загружаем сохраненный стрик
        const { streak: savedStreak, lastUpdateDate: savedLastUpdate } = await loadStreakFromDB();
        
        // Рассчитываем актуальный стрик на основе выполненных заданий
        const calculatedStreak = calculateCurrentStreak(transformed);
        
        // Используем максимальный из сохраненного и рассчитанного
        // (на случай, если в БД старые данные)
        const finalStreak = Math.max(savedStreak, calculatedStreak);
        setStreak(finalStreak);
        setLastStreakUpdateDate(savedLastUpdate);
        
        // Если стрик потерян, обновляем БД
        if (calculatedStreak === 0 && savedStreak > 0) {
          await saveStreakToDB(0, null);
          showNotification(`⚠️ Ваша серия из ${savedStreak} дней прервана! Выполняйте ежедневные задания каждый день, чтобы не терять серию.`);
        }
        
        return transformed;
      }
    } catch (error) {
      console.error('Ошибка загрузки заданий из БД:', error);
    }
    return [];
  };

  const saveProgressToDB = async (questsData, totalEarnedData, streakData, lastLoginData) => {
    if (!userId || !selectedGroupId) return;
    try {
      await fetch(`${API_URL}/api/users/${userId}/quests/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedGroupId,
          quests: questsData.map(q => ({
            id: q.id,
            progress: q.progress,
            completed: q.completed,
            claimed: q.claimed
          })),
          totalEarned: totalEarnedData,
          streak: streakData,
          lastLoginDate: lastLoginData || new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Ошибка сохранения прогресса в БД:', error);
    }
  };

  const saveQuestCompletionToDB = async (questId, reward) => {
    if (!userId) return false;
    try {
      const response = await fetch(`${API_URL}/api/users/completeQuest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          questId: questId,
          reward: reward,
          claimReward: false
        })
      });
      
      const data = await response.json();
      return response.ok && data.success;
    } catch (error) {
      console.error('Ошибка сохранения выполнения задания:', error);
      return false;
    }
  };

  const claimReward = async (quest) => {
    if (!quest.completed || quest.claimed) {
      return;
    }
    await claimQuestBonus(quest);
  };

  // Загрузка заданий
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const loadedQuests = await loadQuestsFromDB();
      setQuests(loadedQuests);
      setLoading(false);
    };
    if (selectedGroupId && userId) init();
  }, [selectedGroupId, userId]);

  // Автоматическая отметка заданий как выполненных при достижении цели
  useEffect(() => {
    if (!loading && quests.length > 0) {
      const questsToCheck = quests.filter(q => 
        (q.type === 'spin_wheel' || q.type === 'scratch_card' || q.type === 'play_dice') &&
        q.progress >= q.target && !q.completed && !q.claimed
      );
      
      console.log('🔍 Проверка заданий для автовыполнения:', questsToCheck.map(q => q.title));
      
      for (const quest of questsToCheck) {
        markQuestAsCompleted(quest);
      }
    }
  }, [quests, loading]);

  // Автоматическое выполнение ежедневного входа
  useEffect(() => {
    if (!loading && quests.length > 0 && !hasAutoCompleted.current) {
      hasAutoCompleted.current = true;
      
      const dailyLoginQuest = quests.find(q => q.type === 'daily_login');
      if (dailyLoginQuest && !dailyLoginQuest.completed && !dailyLoginQuest.claimed) {
        handleDailyLogin(dailyLoginQuest);
      }
    }
  }, [loading, quests]);

  // Проверка стрика при загрузке (проверяем, не пропустил ли пользователь день)
  useEffect(() => {
    if (!loading && quests.length > 0 && !streakCheckPerformed.current) {
      streakCheckPerformed.current = true;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const completedToday = areAllDailyQuestsCompletedToday(quests);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const completedYesterday = wereAllDailyQuestsCompletedOnDate(quests, yesterday);
      
      // Если сегодня не выполнено и вчера не выполнено, но стрик > 0 - сбрасываем
      if (!completedToday && !completedYesterday && streak > 0) {
        setStreak(0);
        saveStreakToDB(0, null);
        showNotification(`⚠️ Серия прервана! Вы не выполнили ежедневные задания вовремя.`);
      }
    }
  }, [loading, quests, streak]);

  // Сохранение прогресса
  useEffect(() => {
    if (!loading && quests.length > 0 && userId && selectedGroupId) {
      saveProgressToDB(quests, totalEarned, streak, lastLoginDate);
    }
  }, [quests, totalEarned, streak, loading, userId, selectedGroupId]);

  const showNotification = (message) => {
    const notification = document.createElement('div');
    notification.innerHTML = `<div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2ecc71;padding:12px 20px;border-radius:30px;color:white;z-index:1000;animation:slideUp 0.3s ease;">${message}</div>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  function mapQuestType(title) {
    const lowerTitle = title.toLowerCase();
    console.log(`🔍 mapQuestType для "${title}" -> lower: "${lowerTitle}"`);
    
    if (lowerTitle.includes('ежедневный вход')) return 'daily_login';
    if (lowerTitle.includes('стрик')) return 'daily_streak';
    if (lowerTitle.includes('потратить')) return 'spend_amount';
    if (lowerTitle.includes('покупк')) return 'purchase_count';
    if (lowerTitle.includes('колесо удачи')) return 'spin_wheel';
    if (lowerTitle.includes('скретч')) return 'scratch_card';
    if (lowerTitle.includes('кости')) return 'play_dice';
    
    console.log(`⚠️ Тип не определен для "${title}", возвращаю daily_login`);
    return 'daily_login';
  }
  
  function getTargetByType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('потратить 1000')) return 1000;
    if (lowerTitle.includes('потратить 2000')) return 2000;
    if (lowerTitle.includes('2 покупки')) return 2;
    if (lowerTitle.includes('5 покупок')) return 5;
    if (lowerTitle.includes('колесо удачи 3 раза')) return 3;
    if (lowerTitle.includes('скретч-карту 3 раза')) return 3;
    if (lowerTitle.includes('кости 3 раза')) return 3;
    if (lowerTitle.includes('стрик из 7 дней')) return 7;
    return 1;
  }

  const getCompletedCount = () => quests.filter(q => q.completed).length;
  const totalAvailable = quests.reduce((sum, q) => sum + (q.completed && !q.claimed ? q.reward : 0), 0);

  // Вспомогательная функция для склонения слова "день"
  const getStreakWord = (days) => {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  };

  // Получаем количество выполненных ежедневных заданий сегодня
  const getCompletedDailyCount = () => {
    const dailyQuests = getDailyQuests(quests);
    const completed = dailyQuests.filter(q => q.completed && q.claimed).length;
    return { completed, total: dailyQuests.length };
  };

  const dailyStats = getCompletedDailyCount();
  const allDailyCompleted = dailyStats.total > 0 && dailyStats.completed === dailyStats.total;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: 20, color: 'white' }}>Загрузка заданий...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>📋 Задания</h3>
          <div style={styles.streak}>
            🔥 Серия: {streak} {getStreakWord(streak)}
            {streak > 0 && (
              <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 5 }}>
                (ежедневные задания)
              </span>
            )}
          </div>
          {dailyStats.total > 0 && (
            <div style={{ fontSize: 11, color: allDailyCompleted ? '#2ecc71' : '#f39c12', marginTop: 4 }}>
              📅 Ежедневные задания: {dailyStats.completed}/{dailyStats.total}
              {allDailyCompleted && (
                <span style={{ marginLeft: 8 }}>✅ Серия увеличится завтра!</span>
              )}
            </div>
          )}
        </div>
        <div style={styles.rewardInfo}>🎁 Доступно: {totalAvailable} бонусов</div>
      </div>
      
      <div style={styles.progressOverview}>
        <div style={styles.progressBarContainer}>
          <div style={{...styles.progressBarFill, width: quests.length > 0 ? `${(getCompletedCount()/quests.length)*100}%` : '0%'}} />
        </div>
        <div style={styles.progressText}>Выполнено {getCompletedCount()} из {quests.length}</div>
      </div>
      
      <div style={styles.questsList}>
        {quests.map(quest => {
          let statusDisplay = '';
          let statusColor = '';
          let timeRemaining = null;
          
          if (quest.claimed) {
            timeRemaining = getTimeRemainingText(quest);
          }
          
          if (quest.claimed) {
            if (timeRemaining) {
              statusDisplay = `⏳ ${timeRemaining}`;
              statusColor = '#f39c12';
            } else {
              statusDisplay = '✅ Получено';
              statusColor = '#2ecc71';
            }
          } else if (quest.completed) {
            statusDisplay = '🎁 Готово к получению';
            statusColor = '#f39c12';
          } else if (quest.status === 'active') {
            statusDisplay = '🟢 Активно';
            statusColor = '#2ecc71';
          } else {
            statusDisplay = '⚫ Неактивно';
            statusColor = '#888';
          }
          
          // Показываем индикатор ежедневного задания
          const isDailyQuest = quest.durationDays === 1;
          
          return (
            <div key={quest.id} style={{...styles.questItem, background: quest.completed ? 'rgba(46,204,113,0.15)' : 'rgba(0,0,0,0.3)', borderLeft: quest.completed ? '3px solid #2ecc71' : '3px solid transparent', opacity: quest.claimed && !timeRemaining ? 0.6 : 1}}>
              <div style={styles.questInfo}>
                <div style={styles.questTitle}>
                  <span style={{ fontSize: 24, marginRight: 8 }}>{quest.emoji}</span>
                  {quest.title}
                  {isDailyQuest && (
                    <span style={{ fontSize: 10, marginLeft: 8, background: quest.completed && quest.claimed ? '#2ecc71' : '#f39c12', padding: '2px 6px', borderRadius: 12, color: '#333' }}>
                      {quest.completed && quest.claimed ? '✅ Выполнено' : '📅 Ежедневное'}
                    </span>
                  )}
                </div>
                <div style={styles.questDescription}>{quest.description}</div>
                {quest.durationDays > 1 && (quest.type === 'spin_wheel' || quest.type === 'scratch_card' || quest.type === 'play_dice') && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    ⏱️ Бонус доступен 1 раз в {quest.durationDays} {getDaysWord(quest.durationDays)}
                  </div>
                )}
                {quest.type === 'daily_login' && quest.durationDays > 1 && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    ⏱️ Бонус доступен 1 раз в {quest.durationDays} {getDaysWord(quest.durationDays)}
                  </div>
                )}
                {/* Прогресс бар */}
                {quest.target > 1 && !quest.claimed && !quest.completed && (
                  <div style={styles.questProgress}>
                    <div style={styles.progressBarContainerSmall}>
                      <div style={{...styles.progressBarFillSmall, width: `${(quest.progress/quest.target)*100}%`}} />
                    </div>
                    <span style={styles.progressTextSmall}>{quest.progress}/{quest.target}</span>
                  </div>
                )}
                {/* Показываем прогресс даже если задание выполнено но не получено */}
                {quest.target > 1 && quest.completed && !quest.claimed && (
                  <div style={styles.questProgress}>
                    <div style={styles.progressBarContainerSmall}>
                      <div style={{...styles.progressBarFillSmall, width: `100%`, background: '#2ecc71'}} />
                    </div>
                    <span style={styles.progressTextSmall}>{quest.target}/{quest.target}</span>
                  </div>
                )}
                <div style={{ ...styles.questStatus, color: statusColor }}>{statusDisplay}</div>
              </div>
              <div style={styles.questReward}>
                <div style={styles.rewardValue}>+{quest.reward}</div>
                <div style={styles.rewardLabel}>бонусов</div>
                {!quest.completed ? (
                  <div style={{ ...styles.statusPending, color: quest.status === 'active' ? '#aaa' : '#888' }}>
                    {quest.status === 'active' ? '⏳ Не выполнено' : '🔒 Неактивно'}
                  </div>
                ) : quest.claimed ? (
                  <div style={styles.statusClaimed}>✅ Получено</div>
                ) : (
                  <button onClick={() => claimReward(quest)} style={styles.claimButton}>Забрать</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {quests.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, opacity: 0.7, color: 'white' }}>Нет активных заданий</div>
      )}
      
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function getDaysWord(days) {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дня';
  return 'дней';
}

const styles = {
  container: { background: 'rgba(30, 35, 48, 0.7)', borderRadius: 28, padding: 20, marginBottom: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: 'white' },
  streak: { fontSize: 12, color: '#ffd966', marginTop: 4 },
  rewardInfo: { fontSize: 13, color: '#ffd966', background: 'rgba(255,215,0,0.15)', padding: '6px 12px', borderRadius: 20 },
  progressOverview: { marginBottom: 20, padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 16 },
  progressBarContainer: { height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', background: 'linear-gradient(90deg,#2ecc71,#27ae60)', borderRadius: 3, transition: 'width 0.3s' },
  progressText: { fontSize: 11, opacity: 0.7, textAlign: 'center', color: 'white' },
  questsList: { display: 'flex', flexDirection: 'column', gap: 10 },
  questItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 20, flexWrap: 'wrap', gap: 12 },
  questInfo: { flex: 1 },
  questTitle: { fontWeight: 700, marginBottom: 4, color: 'white', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  questDescription: { fontSize: 12, opacity: 0.7, marginBottom: 4, color: 'white' },
  questStatus: { fontSize: 11, marginBottom: 8, fontWeight: 500 },
  questProgress: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  progressBarContainerSmall: { flex: 1, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressBarFillSmall: { height: '100%', background: '#ffd966', borderRadius: 2, transition: 'width 0.3s' },
  progressTextSmall: { fontSize: 10, opacity: 0.7, minWidth: 50, color: 'white' },
  questReward: { textAlign: 'center', minWidth: 90 },
  rewardValue: { fontSize: 18, fontWeight: 'bold', color: '#ffd966' },
  rewardLabel: { fontSize: 10, opacity: 0.7, marginBottom: 8, color: 'white' },
  statusPending: { fontSize: 11 },
  statusClaimed: { fontSize: 11, color: '#2ecc71' },
  claimButton: { background: '#ff4d4d', border: 'none', padding: '6px 12px', borderRadius: 20, color: 'white', fontSize: 12, cursor: 'pointer', width: '100%' }
};