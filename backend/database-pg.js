const { Pool } = require('pg');
require('dotenv').config();

// Настройка подключения к БД
const isProduction = process.env.NODE_ENV === 'production';

let poolConfig;
if (isProduction) {
    // Для Render - используем DATABASE_URL
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false  // Важно для Render
        }
    };
} else {
    // Для локальной разработки
    poolConfig = {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'loyalty_prime'
    };
}

const pool = new Pool(poolConfig);

// Добавьте обработку ошибок подключения
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Выполнен запрос:', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
}

async function initDatabase() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                company VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                password VARCHAR(255) NOT NULL,
                brand_color VARCHAR(50) DEFAULT '#2A4B7C',
                description TEXT DEFAULT 'Добро пожаловать в программу лояльности!',
                active BOOLEAN DEFAULT TRUE,
                settings JSONB DEFAULT '{}',
                tiers_settings JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS promotions (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                emoji VARCHAR(10) DEFAULT '🎯',
                description TEXT,
                products TEXT,
                reward_type VARCHAR(20) DEFAULT 'discount',
                reward_value INTEGER DEFAULT 0,
                is_free BOOLEAN DEFAULT FALSE,
                price INTEGER DEFAULT 100,
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS quests (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                emoji VARCHAR(10) DEFAULT '✅',
                title VARCHAR(255) NOT NULL,
                description TEXT,
                reward INTEGER DEFAULT 10,
                active BOOLEAN DEFAULT TRUE,
                expires_days INTEGER DEFAULT 30,
                end_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                vk_id VARCHAR(100) NOT NULL,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255),
                birthday_date DATE,
                bonus_balance INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0,
                total_spent INTEGER DEFAULT 0,
                current_tier VARCHAR(50) DEFAULT 'Новичок',
                last_daily DATE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(vk_id, company_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                amount INTEGER DEFAULT 0,
                bonus_earned INTEGER DEFAULT 0,
                bonus_spent INTEGER DEFAULT 0,
                description TEXT,
                items JSONB DEFAULT '[]',
                source VARCHAR(50) DEFAULT 'pos',
                store_id VARCHAR(100),
                cashier_id VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS user_quests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                quest_id INTEGER REFERENCES quests(id) ON DELETE CASCADE,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reward_claimed BOOLEAN DEFAULT TRUE,
                UNIQUE(user_id, quest_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS user_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                total_earned INTEGER DEFAULT 0,
                streak INTEGER DEFAULT 0,
                last_login_date DATE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, company_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS user_quest_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                quest_id INTEGER REFERENCES quests(id) ON DELETE CASCADE,
                progress INTEGER DEFAULT 0,
                completed BOOLEAN DEFAULT FALSE,
                claimed BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, quest_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS user_purchased_promotions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                promotion_cycle_start TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                used_at TIMESTAMP,
                UNIQUE(user_id, promotion_id, promotion_cycle_start)
            )
        `);

       await query(`
    CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        link TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
        is_paid BOOLEAN DEFAULT FALSE,
        bonus_cost INTEGER DEFAULT 0,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

        await query(`
            CREATE TABLE IF NOT EXISTS user_classification (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                user_type VARCHAR(50) DEFAULT 'new', -- new, active, regular, dormant
                first_visit_date TIMESTAMP,
                last_purchase_date TIMESTAMP,
                last_app_visit_date TIMESTAMP,
                purchases_this_week INTEGER DEFAULT 0,
                app_visits_this_week INTEGER DEFAULT 0,
                purchases_last_two_weeks INTEGER DEFAULT 0,
                consecutive_weeks_with_4_purchases INTEGER DEFAULT 0,
                week_reset_date TIMESTAMP,
                classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, company_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                type VARCHAR(50) DEFAULT 'push',
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                audience VARCHAR(50) DEFAULT 'all', -- all, new, active, regular, dormant
                status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
                sent_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS notification_campaigns (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                trigger_type VARCHAR(50), -- nullable, not used anymore
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                audience VARCHAR(50) DEFAULT 'all',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS cashier_credentials (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
                login VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Таблицы созданы/проверены');
		
         await initLocationTables();
        await addMissingColumns();
		await addGiveawayColumns();
		await migrateGiveawaysTable();
        await addPromotionRewardColumns();
        await addGameSettingsTable();  
        await addGameSettingsColumns();
        await addDailyBonusSettings(); 
        await addTransactionColumns();
        await ensureAllQuestsExist();
		await checkAndResetQuests();
		await addQuestColumns();
		await addStreakColumns();
		await addBonusSettingsColumn();
		await addNotificationCampaignColumns();
		await addUserProgressSpentColumn();
        await insertTestData();

    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
    }
}
async function addDailyBonusSettings() {
    try {
        const checkTable = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'daily_bonus_settings'
        `);
        
        if (checkTable.rows.length === 0) {
            console.log('📝 Добавляем колонку daily_bonus_settings в таблицу companies...');
            await query(`ALTER TABLE companies ADD COLUMN daily_bonus_settings JSONB DEFAULT '{"enabled": true, "baseAmount": 10, "streakBonus": 5}'`);
            console.log('✅ Колонка daily_bonus_settings добавлена');
        }
    } catch (error) {
        console.error('❌ Ошибка добавления daily_bonus_settings:', error);
    }
}

async function addStreakColumns() {
  try {
    const checkColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_progress' AND column_name = 'last_streak_update_date'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('📝 Добавляем колонку last_streak_update_date в таблицу user_progress...');
      await query(`ALTER TABLE user_progress ADD COLUMN last_streak_update_date TIMESTAMP`);
      console.log('✅ Колонка last_streak_update_date добавлена');
    }
  } catch (error) {
    console.error('Ошибка добавления колонки стрика:', error);
  }
}

// Добавляем недостающие колонки в таблицу transactions
async function addTransactionColumns() {
    try {
        // Проверяем и добавляем колонку store_id
        const checkStoreId = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'store_id'
        `);
        
        if (checkStoreId.rows.length === 0) {
            console.log('📝 Добавляем колонку store_id в таблицу transactions...');
            await query(`ALTER TABLE transactions ADD COLUMN store_id VARCHAR(100)`);
            console.log('✅ Колонка store_id добавлена');
        }
        
        // Проверяем и добавляем колонку cashier_id
        const checkCashierId = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'cashier_id'
        `);
        
        if (checkCashierId.rows.length === 0) {
            console.log('📝 Добавляем колонку cashier_id в таблицу transactions...');
            await query(`ALTER TABLE transactions ADD COLUMN cashier_id VARCHAR(100)`);
            console.log('✅ Колонка cashier_id добавлена');
        }
        
        // Проверяем и добавляем колонку metadata
        const checkMetadata = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'metadata'
        `);
        
        if (checkMetadata.rows.length === 0) {
            console.log('📝 Добавляем колонку metadata в таблицу transactions...');
            await query(`ALTER TABLE transactions ADD COLUMN metadata JSONB DEFAULT '{}'`);
            console.log('✅ Колонка metadata добавлена');
        }
        
        console.log('✅ Все колонки transactions проверены');
    } catch (error) {
        console.error('❌ Ошибка добавления колонок transactions:', error);
    }
}

async function getDailyBonusSettings(companyId) {
    try {
        const result = await query(
            'SELECT daily_bonus_settings FROM companies WHERE id = $1',
            [companyId]
        );
        
        if (result.rows.length > 0) {
            let settings = result.rows[0].daily_bonus_settings;
            if (typeof settings === 'string') {
                settings = JSON.parse(settings);
            }
            return settings || { enabled: true, baseAmount: 10, streakBonus: 5 };
        }
        
        return { enabled: true, baseAmount: 10, streakBonus: 5 };
    } catch (error) {
        console.error('Ошибка получения настроек ежедневного бонуса:', error);
        return { enabled: true, baseAmount: 10, streakBonus: 5 };
    }
}

async function updateDailyBonusSettings(companyId, settings) {
    try {
        await query(
            'UPDATE companies SET daily_bonus_settings = $1 WHERE id = $2',
            [JSON.stringify(settings), companyId]
        );
        return { success: true };
    } catch (error) {
        console.error('Ошибка обновления настроек ежедневного бонуса:', error);
        throw error;
    }
}

// Функция для обеспечения наличия всех 20 заданий у каждой компании
async function ensureAllQuestsExist() {
    try {
        console.log('🔍 Проверяем наличие всех заданий у компаний...');
        
        // Получаем все компании
        const companiesResult = await query('SELECT id FROM companies');
        const companies = companiesResult.rows;
        
        // Получаем список всех предустановленных заданий
        const presetQuests = getPresetQuests();
        
        for (const company of companies) {
            const companyId = company.id;
            
            // Получаем текущие задания компании
            const currentQuestsResult = await query(
                'SELECT title FROM quests WHERE company_id = $1',
                [companyId]
            );
            const currentQuestTitles = currentQuestsResult.rows.map(row => row.title);
            
            // Проверяем, каких заданий не хватает
            const missingQuests = presetQuests.filter(
                preset => !currentQuestTitles.includes(preset.title)
            );
            
            // Добавляем недостающие задания
            if (missingQuests.length > 0) {
                console.log(`📝 Компания ${companyId}: добавляем ${missingQuests.length} отсутствующих заданий`);
                
                for (const quest of missingQuests) {
                    await query(`
                        INSERT INTO quests (company_id, emoji, title, description, reward, active, expires_days, created_at, updated_at) 
                        VALUES ($1, $2, $3, $4, $5, false, NULL, NOW(), NOW())
                    `, [companyId, quest.emoji, quest.title, quest.description, quest.reward]);
                }
                
                console.log(`✅ Компания ${companyId}: добавлено ${missingQuests.length} заданий`);
            }
        }
        
        console.log('✅ Проверка заданий завершена');
    } catch (error) {
        console.error('❌ Ошибка обеспечения наличия заданий:', error);
    }
}

// Добавьте эту функцию в database-pg.js после initDatabase()

async function addGameSettingsTable() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS game_settings (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                game_type VARCHAR(50) NOT NULL,
                settings JSONB DEFAULT '{}',
                active BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица game_settings создана/проверена');
        
        // Добавляем уникальное ограничение если его нет
        try {
            await query(`
                ALTER TABLE game_settings ADD CONSTRAINT unique_company_game 
                UNIQUE (company_id, game_type)
            `);
        } catch (e) {
            // Ограничение уже существует - игнорируем
            if (!e.message.includes('already exists')) {
                console.log('⚠️ Уникальное ограничение уже существует');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка создания game_settings:', error);
    }
}

// Функция для получения настроек игры
async function getGameSettings(companyId, gameType) {
    try {
        // Убеждаемся, что таблица и колонки существуют
        await addGameSettingsTable();
        await addGameSettingsColumns();
        
        const result = await query(
            'SELECT settings, active FROM game_settings WHERE company_id = $1 AND game_type = $2',
            [companyId, gameType]
        );
        
        if (result.rows.length > 0) {
            let settings = result.rows[0].settings;
            if (typeof settings === 'string') {
                settings = JSON.parse(settings);
            }
            return {
                settings: settings,
                active: result.rows[0].active
            };
        }
        
        // Возвращаем настройки по умолчанию для каждого типа игры
        let defaultSettings = {};
        
        if (gameType === 'wheel') {
            defaultSettings = {
                spinCost: 25,
                sectors: [
                    { name: 'x5', value: 5, multiplier: 5, color: '#2ecc71', icon: '⭐', weight: 15 },
                    { name: 'x2', value: 2, multiplier: 2, color: '#3498db', icon: '🎯', weight: 25 },
                    { name: 'x10', value: 10, multiplier: 10, color: '#e74c3c', icon: '🔥', weight: 5 },
                    { name: 'x0', value: 0, multiplier: 0, color: '#95a5a6', icon: '💀', weight: 30 },
                    { name: 'x3', value: 3, multiplier: 3, color: '#f39c12', icon: '✨', weight: 20 },
                    { name: 'x1', value: 1, multiplier: 1, color: '#1abc9c', icon: '🍀', weight: 35 },
                    { name: 'x20', value: 20, multiplier: 20, color: '#9b59b6', icon: '💎', weight: 3 },
                    { name: 'x15', value: 15, multiplier: 15, color: '#e67e22', icon: '🏆', weight: 10 }
                ],
                maxSpinsPerDay: 10,
                freeSpinDaily: false
            };
        } else if (gameType === 'scratch') {
            defaultSettings = {
                cost: 20,
                maxAttempts: 3,
                symbols: [
                    { id: '🍒', name: 'Вишня', value: 10, multiplier: 1, color: '#e74c3c', prob: 15 },
                    { id: '🍋', name: 'Лимон', value: 15, multiplier: 1.5, color: '#f1c40f', prob: 14 },
                    { id: '🍊', name: 'Апельсин', value: 20, multiplier: 2, color: '#e67e22', prob: 13 },
                    { id: '🍉', name: 'Арбуз', value: 25, multiplier: 2.5, color: '#2ecc71', prob: 12 },
                    { id: '⭐', name: 'Звезда', value: 50, multiplier: 5, color: '#f39c12', prob: 10 },
                    { id: '💎', name: 'Алмаз', value: 100, multiplier: 10, color: '#9b59b6', prob: 8 },
                    { id: '7️⃣', name: 'Семёрка', value: 200, multiplier: 20, color: '#e74c3c', prob: 5 },
                    { id: '🎰', name: 'ДЖЕКПОТ', value: 500, multiplier: 50, color: '#ff4d4d', prob: 3 }
                ],
                hintCost: 15,
                freeHintDaily: false
            };
        } else if (gameType === 'dice') {
            defaultSettings = {
                cost: 25,
                jackpotBase: 1000,
                betMultipliers: [1, 2, 3, 5, 10],
                combinations: {
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
                },
                jackpotChance: 1,
                jackpotContribution: 10
            };
        }
        
        return {
            settings: defaultSettings,
            active: true
        };
    } catch (error) {
        console.error('Ошибка getGameSettings:', error);
        return { settings: {}, active: true };
    }
}

// Функция для сохранения настроек игры
async function saveGameSettings(companyId, gameType, settings, active) {
    try {
        // Убеждаемся, что таблица и колонки существуют
        await addGameSettingsTable();
        await addGameSettingsColumns();
        
        const settingsJson = JSON.stringify(settings);
        const result = await query(
            `INSERT INTO game_settings (company_id, game_type, settings, active, updated_at) 
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (company_id, game_type) 
             DO UPDATE SET 
                settings = EXCLUDED.settings,
                active = EXCLUDED.active,
                updated_at = NOW()
             RETURNING *`,
            [companyId, gameType, settingsJson, active]
        );
        
        let savedSettings = result.rows[0].settings;
        if (typeof savedSettings === 'string') {
            savedSettings = JSON.parse(savedSettings);
        }
        
        return {
            settings: savedSettings,
            active: result.rows[0].active
        };
    } catch (error) {
        console.error('Ошибка saveGameSettings:', error);
        throw error;
    }
}


function getPresetQuests() {
    return [
        { emoji: '💰', title: 'Потратить 1000 рублей за 3 дня', description: 'Совершите покупки на общую сумму 1000₽ в течение 3 дней', reward: 50, durationDays: 3, targetType: 'spend_amount', targetValue: 1000 },
        { emoji: '💰', title: 'Потратить 2000 рублей за 7 дней', description: 'Совершите покупки на общую сумму 2000₽ в течение 7 дней', reward: 100, durationDays: 7, targetType: 'spend_amount', targetValue: 2000 },
        { emoji: '🛍️', title: '2 Покупки за 3 дня', description: 'Совершите 2 покупки в течение 3 дней', reward: 60, durationDays: 3, targetType: 'purchase_count', targetValue: 2 },
        { emoji: '🛍️', title: '5 Покупок за 7 дней', description: 'Совершите 5 покупок в течение 7 дней', reward: 120, durationDays: 7, targetType: 'purchase_count', targetValue: 5 },
        { emoji: '🎡', title: 'Сыграть в колесо удачи 3 раза', description: 'Покрутите колесо фортуны 3 раза', reward: 40, durationDays: 7, targetType: 'spin_wheel', targetValue: 3 },
        { emoji: '🎫', title: 'Сыграть в скретч-карту 3 раза', description: 'Сыграйте в скретч-карту 3 раза', reward: 40, durationDays: 7, targetType: 'scratch_card', targetValue: 3 },
        { emoji: '🎲', title: 'Сыграть в кости 3 раза', description: 'Сыграйте в игру в кости 3 раза', reward: 40, durationDays: 7, targetType: 'play_dice', targetValue: 3 },
        { emoji: '🔥', title: 'Стрик из 7 дней', description: 'Выполняйте все ежедневные задания 7 дней подряд', reward: 150, durationDays: 7, targetType: 'daily_streak', targetValue: 7 },
        { emoji: '✅', title: 'Ежедневный вход', description: 'Заходите в приложение каждый день', reward: 10, durationDays: 1, targetType: 'daily_login', targetValue: 1 },
        { emoji: '🎁', title: 'Воспользоваться акцией', description: 'Купите и активируйте акцию за баллы у партнера', reward: 20, durationDays: 7, targetType: 'use_promotion', targetValue: 1 }
    ];
}
function getPresetPromotions() {
    return [
        { name: 'Латте со скидкой', emoji: '☕', description: 'Скидка на латте любого объема', reward_type: 'discount', reward_value: 15 },
        { name: 'Капучино за баллы', emoji: '☕', description: 'Скидка на капучино в любое время', reward_type: 'discount', reward_value: 20 },
        { name: 'Двойной эспрессо', emoji: '⚡', description: 'Скидка на двойной эспрессо', reward_type: 'discount', reward_value: 25 },
        { name: 'Чизкейк дня', emoji: '🍰', description: 'Скидка на чизкейк', reward_type: 'discount', reward_value: 30 },
        { name: 'Круассан + кофе', emoji: '🥐', description: 'Скидка на комбо круассан и кофе', reward_type: 'discount', reward_value: 20 },
        { name: 'Завтрак в кофейне', emoji: '🍳', description: 'Скидка на завтрак до 12:00', reward_type: 'discount', reward_value: 15 },
        { name: 'Обеденное меню', emoji: '🍱', description: 'Скидка на обеденное комбо', reward_type: 'discount', reward_value: 25 },
        { name: 'Свежая выпечка', emoji: '🥖', description: 'Скидка на любую выпечку', reward_type: 'discount', reward_value: 20 },
        { name: 'Холодные напитки', emoji: '🧊', description: 'Скидка на айс-кофе и лимонады', reward_type: 'discount', reward_value: 15 },
        { name: 'Десерт к кофе', emoji: '🍮', description: 'Скидка на любой десерт', reward_type: 'discount', reward_value: 25 },
        { name: 'Сезонный напиток', emoji: '🍂', description: 'Скидка на сезонные напитки', reward_type: 'discount', reward_value: 20 },
        { name: 'Кофе с собой', emoji: '🥤', description: 'Скидка на кофе в стаканчике', reward_type: 'discount', reward_value: 10 },
        { name: 'Вечернее удовольствие', emoji: '🌙', description: 'Скидка после 18:00 на всё меню', reward_type: 'discount', reward_value: 30 },
        { name: 'Семейный набор', emoji: '👨‍👩‍👧‍👦', description: 'Скидка при заказе от 3 позиций', reward_type: 'discount', reward_value: 20 },
        { name: 'Авторский чай', emoji: '🍵', description: 'Скидка на авторские чайные напитки', reward_type: 'discount', reward_value: 15 },
        { name: 'Сэндвич + напиток', emoji: '🥪', description: 'Скидка на комбо сэндвич и напиток', reward_type: 'discount', reward_value: 25 },
        { name: 'Утренний бонус', emoji: '🌅', description: 'Скидка с 8:00 до 10:00 на кофе', reward_type: 'discount', reward_value: 30 },
        { name: 'Кофе для друзей', emoji: '👥', description: 'Скидка при покупке 2+ кофе', reward_type: 'discount', reward_value: 20 },
        { name: 'Сладкий подарок', emoji: '🍪', description: 'Скидка на печенье и макаруны', reward_type: 'discount', reward_value: 15 },
        { name: 'Кофейная дегустация', emoji: '✨', description: 'Скидка на дегустационный сет', reward_type: 'discount', reward_value: 25 }
    ];
}
// Добавьте эту функцию после getPresetPromotions():

async function addPresetDataForCompany(companyId) {
    try {
        console.log(`📝 Добавление предустановленных данных для компании ${companyId}...`);
        
        // Добавляем 20 предустановленных акций
        const presetPromotions = getPresetPromotions();
        for (const promo of presetPromotions) {
            await query(`
                INSERT INTO promotions (company_id, name, emoji, description, reward_type, reward_value, active, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            `, [companyId, promo.name, promo.emoji, promo.description, promo.reward_type, promo.reward_value]);
        }
        console.log(`✅ Добавлено ${presetPromotions.length} акций`);
        
        // Добавляем 20 предустановленных заданий (неактивные по умолчанию, без срока действия)
        const presetQuests = getPresetQuests();
        for (const quest of presetQuests) {
            await query(`
                INSERT INTO quests (company_id, emoji, title, description, reward, active, expires_days, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, false, NULL, NOW(), NOW())
            `, [companyId, quest.emoji, quest.title, quest.description, quest.reward]);
        }
        console.log(`✅ Добавлено ${presetQuests.length} заданий`);
        
    } catch (error) {
        console.error('❌ Ошибка добавления предустановленных данных:', error);
    }
}

async function getCompanyTiers(companyId) {
    try {
        const result = await query('SELECT tiers_settings FROM companies WHERE id = $1', [companyId]);
        
        if (result.rows.length > 0 && result.rows[0].tiers_settings) {
            let tiers = result.rows[0].tiers_settings;
            if (typeof tiers === 'string') {
                tiers = JSON.parse(tiers);
            }
            return tiers;
        }
        
        const defaultTiers = [
            { name: "🌱 Новичок", threshold: 0, cashback: 3, color: "#95a5a6", icon: "🌱" },
            { name: "🥉 Бронза", threshold: 500, cashback: 5, color: "#cd7f32", icon: "🥉" },
            { name: "🥈 Серебро", threshold: 2000, cashback: 7, color: "#bdc3c7", icon: "🥈" },
            { name: "🥇 Золото", threshold: 8000, cashback: 10, color: "#f1c40f", icon: "🥇" },
            { name: "💎 Бриллиант", threshold: 20000, cashback: 15, color: "#00b4d8", icon: "💎" }
        ];
        
        await updateCompanyTiers(companyId, defaultTiers);
        return defaultTiers;
    } catch (error) {
        console.error('❌ Ошибка getCompanyTiers:', error);
        return [
            { name: "🌱 Новичок", threshold: 0, cashback: 3, color: "#95a5a6", icon: "🌱" },
            { name: "🥉 Бронза", threshold: 500, cashback: 5, color: "#cd7f32", icon: "🥉" },
            { name: "🥈 Серебро", threshold: 2000, cashback: 7, color: "#bdc3c7", icon: "🥈" },
            { name: "🥇 Золото", threshold: 8000, cashback: 10, color: "#f1c40f", icon: "🥇" },
            { name: "💎 Бриллиант", threshold: 20000, cashback: 15, color: "#00b4d8", icon: "💎" }
        ];
    }
}

async function updateCompanyTiers(companyId, tiersSettings) {
    try {
        if (!Array.isArray(tiersSettings)) {
            throw new Error('tiersSettings должен быть массивом');
        }
        
        const sortedTiers = [...tiersSettings].sort((a, b) => a.threshold - b.threshold);
        const tiersJson = JSON.stringify(sortedTiers);
        
        const result = await query(
            'UPDATE companies SET tiers_settings = $1::jsonb WHERE id = $2 RETURNING tiers_settings',
            [tiersJson, companyId]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`Компания с id ${companyId} не найдена`);
        }
        
        let updatedTiers = result.rows[0].tiers_settings;
        if (typeof updatedTiers === 'string') {
            updatedTiers = JSON.parse(updatedTiers);
        }
        
        return updatedTiers;
    } catch (error) {
        console.error('❌ Ошибка updateCompanyTiers:', error);
        throw error;
    }
}

async function addMissingColumns() {
    try {
        const checkTiers = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'tiers_settings'
        `);
        
        if (checkTiers.rows.length === 0) {
            console.log('📝 Добавляем колонку tiers_settings в таблицу companies...');
            // ИСПРАВЛЕНО: убрали multiplier, оставили только cashback
            const defaultTiers = JSON.stringify([
                {"name": "🌱 Новичок", "threshold": 0, "cashback": 3, "color": "#95a5a6", "icon": "🌱"},
                {"name": "🥉 Бронза", "threshold": 500, "cashback": 5, "color": "#cd7f32", "icon": "🥉"},
                {"name": "🥈 Серебро", "threshold": 2000, "cashback": 7, "color": "#bdc3c7", "icon": "🥈"},
                {"name": "🥇 Золото", "threshold": 8000, "cashback": 10, "color": "#f1c40f", "icon": "🥇"},
                {"name": "💎 Бриллиант", "threshold": 20000, "cashback": 15, "color": "#00b4d8", "icon": "💎"}
            ]);
            await query(`
                ALTER TABLE companies 
                ADD COLUMN tiers_settings JSONB DEFAULT $1::jsonb
            `, [defaultTiers]);
            console.log('✅ Колонка tiers_settings добавлена');
        } else {
            // Обновляем существующие записи: удаляем multiplier, оставляем cashback
            console.log('📝 Обновляем существующие tiers_settings, удаляем multiplier...');
            const companies = await query('SELECT id, tiers_settings FROM companies WHERE tiers_settings IS NOT NULL');
            for (const company of companies.rows) {
                let tiers = company.tiers_settings;
                if (typeof tiers === 'string') {
                    tiers = JSON.parse(tiers);
                }
                if (Array.isArray(tiers)) {
                    let updated = false;
                    const newTiers = tiers.map(tier => {
                        if (tier.multiplier !== undefined) {
                            updated = true;
                            const { multiplier, ...rest } = tier;
                            // Если cashback не задан, используем multiplier * 5 как fallback
                            if (rest.cashback === undefined) {
                                rest.cashback = Math.min(30, (multiplier || 1) * 5);
                            }
                            return rest;
                        }
                        return tier;
                    });
                    if (updated) {
                        await query(
                            'UPDATE companies SET tiers_settings = $1::jsonb WHERE id = $2',
                            [JSON.stringify(newTiers), company.id]
                        );
                        console.log(`✅ Обновлены уровни для компании ${company.id}`);
                    }
                }
            }
        }
        
        const checkStartDate = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'start_date'
        `);
        
        if (checkStartDate.rows.length === 0) {
            console.log('📝 Добавляем колонки start_date и end_date в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN start_date TIMESTAMP`);
            await query(`ALTER TABLE promotions ADD COLUMN end_date TIMESTAMP`);
            console.log('✅ Колонки start_date и end_date добавлены');
        }
        
        const checkExpiresDays = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'expires_days'
        `);
        
        if (checkExpiresDays.rows.length === 0) {
            console.log('📝 Добавляем колонку expires_days в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN expires_days INTEGER DEFAULT 30`);
            console.log('✅ Колонка expires_days добавлена');
        }
        
        const checkEndDate = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'end_date'
        `);
        
        if (checkEndDate.rows.length === 0) {
            console.log('📝 Добавляем колонку end_date в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN end_date TIMESTAMP`);
            console.log('✅ Колонка end_date добавлена');
        }
        
        const checkEmoji = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'emoji'
        `);
        
        if (checkEmoji.rows.length === 0) {
            console.log('📝 Добавляем колонку emoji в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN emoji VARCHAR(10) DEFAULT '🎯'`);
            console.log('✅ Колонка emoji добавлена');
        }
        
        // Добавляем колонки reward_type и reward_value
        const checkRewardType = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'reward_type'
        `);
        
        if (checkRewardType.rows.length === 0) {
            console.log('📝 Добавляем колонки reward_type и reward_value в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN reward_type VARCHAR(20) DEFAULT 'discount'`);
            await query(`ALTER TABLE promotions ADD COLUMN reward_value INTEGER DEFAULT 0`);
            console.log('✅ Колонки reward_type и reward_value добавлены');
        }
        
        // Добавляем колонку birthday_date
        const checkBirthday = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'birthday_date'
        `);
        
        if (checkBirthday.rows.length === 0) {
            console.log('📝 Добавляем колонку birthday_date в таблицу users...');
            await query(`ALTER TABLE users ADD COLUMN birthday_date DATE`);
            console.log('✅ Колонка birthday_date добавлена');
        }
        
        // Создаем таблицу user_purchased_promotions если не существует
        const checkPurchasedTable = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'user_purchased_promotions'
        `);
        
        if (checkPurchasedTable.rows.length === 0) {
            console.log('📝 Создаем таблицу user_purchased_promotions...');
            await query(`
                CREATE TABLE user_purchased_promotions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    promotion_cycle_start TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    used_at TIMESTAMP,
                    UNIQUE(user_id, promotion_id, promotion_cycle_start)
                )
            `);
            console.log('✅ Таблица user_purchased_promotions создана');
        }
        
        // Добавляем колонку products
        const checkProducts = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'products'
        `);
        
        if (checkProducts.rows.length === 0) {
            console.log('📝 Добавляем колонку products в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN products TEXT DEFAULT ''`);
            console.log('✅ Колонка products добавлена');
        }
        
        // Добавляем колонку is_free (вместо requires_purchase)
        const checkIsFree = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'is_free'
        `);
        
        if (checkIsFree.rows.length === 0) {
            console.log('📝 Добавляем колонку is_free в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN is_free BOOLEAN DEFAULT FALSE`);
            console.log('✅ Колонка is_free добавлена');
        }
        
        // Добавляем колонку price
        const checkPrice = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'price'
        `);
        
        if (checkPrice.rows.length === 0) {
            console.log('📝 Добавляем колонку price в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN price INTEGER DEFAULT 100`);
            console.log('✅ Колонка price добавлена');
        }
        
        // Удаляем устаревшую колонку requires_purchase если она есть
        const checkRequiresPurchase = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'requires_purchase'
        `);
        
        if (checkRequiresPurchase.rows.length > 0) {
            console.log('📝 Удаляем устаревшую колонку requires_purchase...');
            await query(`ALTER TABLE promotions DROP COLUMN requires_purchase`);
            console.log('✅ Колонка requires_purchase удалена');
        }
        
        console.log('✅ Все недостающие колонки добавлены');
        
    } catch (error) {
        console.error('❌ Ошибка при добавлении колонок:', error);
    }
}


async function insertTestData() {
    try {
        const result = await query('SELECT COUNT(*) FROM companies');
        const count = parseInt(result.rows[0].count);
        if (count === 0) {
            console.log('📝 Добавление тестовых данных...');
            
            // ИСПРАВЛЕНО: убрали multiplier, оставили только cashback
            const defaultTiers = JSON.stringify([
                {"name": "🌱 Новичок", "threshold": 0, "cashback": 3, "color": "#95a5a6", "icon": "🌱"},
                {"name": "🥉 Бронза", "threshold": 500, "cashback": 5, "color": "#cd7f32", "icon": "🥉"},
                {"name": "🥈 Серебро", "threshold": 2000, "cashback": 7, "color": "#bdc3c7", "icon": "🥈"},
                {"name": "🥇 Золото", "threshold": 8000, "cashback": 10, "color": "#f1c40f", "icon": "🥇"},
                {"name": "💎 Бриллиант", "threshold": 20000, "cashback": 15, "color": "#00b4d8", "icon": "💎"}
            ]);
            
            // Добавляем первую компанию
            const result1 = await query(`
                INSERT INTO companies (company, name, email, phone, password, brand_color, description, tiers_settings) 
                VALUES ('Пиццерия "Маргарита"', 'Иван Петров', 'pizza@test.com', '+7 (999) 123-45-67', '123456', '#e74c3c', 'Итальянская кухня, пицца, паста', $1)
                RETURNING id
            `, [defaultTiers]);
            
            // Добавляем вторую компанию
            const result2 = await query(`
                INSERT INTO companies (company, name, email, phone, password, brand_color, description, tiers_settings) 
                VALUES ('Кофейня "Кофеин"', 'Анна Сидорова', 'coffee@test.com', '+7 (999) 234-56-78', '123456', '#8e44ad', 'Ароматный кофе, десерты, выпечка', $1)
                RETURNING id
            `, [defaultTiers]);
            
            // Добавляем предустановленные данные для обеих компаний
            await addPresetDataForCompany(result1.rows[0].id);
            await addPresetDataForCompany(result2.rows[0].id);
            
            console.log('✅ Тестовые данные добавлены с 20 акциями и 20 заданиями для каждой компании');
        } else {
            console.log(`📊 В базе уже есть ${count} компаний`);
            
            // Проверяем, есть ли у существующих компаний акции и задания
            const companies = await getAllCompanies();
            for (const company of companies) {
                const promotionsCount = await query('SELECT COUNT(*) FROM promotions WHERE company_id = $1', [company.id]);
                const questsCount = await query('SELECT COUNT(*) FROM quests WHERE company_id = $1', [company.id]);
                
                if (parseInt(promotionsCount.rows[0].count) === 0) {
                    console.log(`📝 Добавляем предустановленные акции для компании ${company.id}...`);
                    await addPresetDataForCompany(company.id);
                }
                
                if (parseInt(questsCount.rows[0].count) === 0) {
                    console.log(`📝 Добавляем предустановленные задания для компании ${company.id}...`);
                    const presetQuests = getPresetQuests();
                    for (const quest of presetQuests) {
                        await query(`
                            INSERT INTO quests (company_id, emoji, title, description, reward, active, expires_days, created_at, updated_at) 
                            VALUES ($1, $2, $3, $4, $5, true, 30, NOW(), NOW())
                        `, [company.id, quest.emoji, quest.title, quest.description, quest.reward]);
                    }
                    console.log(`✅ Добавлено ${presetQuests.length} заданий для компании ${company.id}`);
                }
                
                // ОБНОВЛЕНИЕ: миграция существующих уровней — удаляем multiplier
                const tiersResult = await query('SELECT tiers_settings FROM companies WHERE id = $1', [company.id]);
                if (tiersResult.rows.length > 0 && tiersResult.rows[0].tiers_settings) {
                    let tiers = tiersResult.rows[0].tiers_settings;
                    if (typeof tiers === 'string') {
                        tiers = JSON.parse(tiers);
                    }
                    if (Array.isArray(tiers) && tiers.length > 0 && tiers[0].multiplier !== undefined) {
                        console.log(`📝 Обновляем уровни для компании ${company.id}, удаляем multiplier...`);
                        const newTiers = tiers.map(tier => {
                            const { multiplier, ...rest } = tier;
                            // Если cashback не задан, используем multiplier * 5 как fallback, но не больше 30%
                            if (rest.cashback === undefined) {
                                rest.cashback = Math.min(30, (multiplier || 1) * 5);
                            }
                            return rest;
                        });
                        await query(
                            'UPDATE companies SET tiers_settings = $1::jsonb WHERE id = $2',
                            [JSON.stringify(newTiers), company.id]
                        );
                        console.log(`✅ Уровни обновлены для компании ${company.id}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка вставки тестовых данных:', error);
    }
}

// ============ CRUD операции для акций ============
async function getPromotions(companyId) {
    const result = await query('SELECT * FROM promotions WHERE company_id = $1 ORDER BY created_at DESC', [companyId]);
    return result.rows;
}

async function addPromotion(companyId, promotionData) {
    const { name, emoji, description, startDate, endDate, active, reward_type, reward_value, products, is_free, price } = promotionData;
    const result = await query(
        `INSERT INTO promotions (company_id, name, emoji, description, start_date, end_date, active, reward_type, reward_value, products, is_free, price, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) 
         RETURNING *`,
        [companyId, name, emoji || '🎯', description || '', startDate || null, endDate || null, active !== undefined ? active : true, reward_type || 'discount', reward_value || 0, products || '', is_free || false, price || 100]
    );
    return result.rows[0];
}

async function updatePromotion(promotionId, promotionData) {
    const { name, emoji, description, startDate, endDate, active, reward_type, reward_value, products, is_free, price } = promotionData;
    const result = await query(
        `UPDATE promotions 
         SET name = $1, emoji = $2, description = $3, start_date = $4, end_date = $5, active = $6, reward_type = $7, reward_value = $8, products = $9, is_free = $10, price = $11, updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [name, emoji, description, startDate || null, endDate || null, active, reward_type || 'discount', reward_value || 0, products || '', is_free || false, price || 100, promotionId]
    );
    return result.rows[0];
}

async function deletePromotion(promotionId) {
    await query('DELETE FROM promotions WHERE id = $1', [promotionId]);
    return true;
}

// ============ CRUD операции для заданий ============
async function getQuests(companyId) {
    const result = await query(`
        SELECT id, emoji, title, description, reward, active, 
               duration_days, created_at, updated_at, last_completed_at
        FROM quests 
        WHERE company_id = $1 
        ORDER BY created_at DESC
    `, [companyId]);
    return result.rows;
}

async function addQuest(companyId, questData) {
    const { emoji, title, description, reward, active, expiresDays } = questData;
    // Ограничиваем durationDays от 1 до 7
    let durationDays = expiresDays || 7;
    if (durationDays < 1) durationDays = 1;
    if (durationDays > 7) durationDays = 7;
    
    const result = await query(
        `INSERT INTO quests (company_id, emoji, title, description, reward, active, duration_days, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
         RETURNING *`,
        [companyId, emoji || '✅', title, description || '', reward || 10, active !== undefined ? active : true, durationDays]
    );
    return result.rows[0];
}

async function updateQuest(questId, questData) {
    const { emoji, title, description, reward, active, expiresDays } = questData;
    const result = await query(
        `UPDATE quests 
         SET emoji = $1, title = $2, description = $3, reward = $4, active = $5, expires_days = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [emoji, title, description, reward, active, expiresDays || 30, questId]
    );
    return result.rows[0];
}

async function deleteQuest(questId) {
    await query('DELETE FROM quests WHERE id = $1', [questId]);
    return true;
}

// ============ Операции с компаниями ============
async function addCompany(companyData) {
    const { company, name, email, phone, password, brandColor, description } = companyData;
    const defaultTiers = JSON.stringify([
        { name: "🌱 Новичок", threshold: 0, multiplier: 1, cashback: 3, color: "#95a5a6", icon: "🌱" },
        { name: "🥉 Бронза", threshold: 500, multiplier: 1.2, cashback: 5, color: "#cd7f32", icon: "🥉" },
        { name: "🥈 Серебро", threshold: 2000, multiplier: 1.5, cashback: 7, color: "#bdc3c7", icon: "🥈" },
        { name: "🥇 Золото", threshold: 8000, multiplier: 2, cashback: 10, color: "#f1c40f", icon: "🥇" },
        { name: "💎 Бриллиант", threshold: 20000, multiplier: 2.5, cashback: 15, color: "#00b4d8", icon: "💎" }
    ]);
    
    const result = await query(
        `INSERT INTO companies (company, name, email, phone, password, brand_color, description, tiers_settings, active, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW()) 
         RETURNING id, company, email, brand_color as "brandColor", description, created_at`,
        [company, name, email, phone || '', password, brandColor || '#2A4B7C', description || `Добро пожаловать в ${company}!`, defaultTiers]
    );
    
    const newCompanyId = result.rows[0].id;
    
    // Добавляем предустановленные акции и задания для новой компании
    await addPresetDataForCompany(newCompanyId);
    
    return result.rows[0];
}

async function getCompanyByEmail(email) {
    const result = await query('SELECT * FROM companies WHERE email = $1', [email]);
    return result.rows[0];
}

async function getAllCompanies() {
    const result = await query(`
        SELECT 
            id, 
            company, 
            brand_color as "brandColor", 
            description,
            COALESCE(settings->>'company_emoji', '🏢') as "companyEmoji"
        FROM companies 
        WHERE active = true 
        ORDER BY created_at DESC
    `);
    return result.rows;
}

async function getCompanyById(id) {
    const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
    return result.rows[0];
}

// ============ Операции с пользователями ============
async function getUserById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
}

async function getUserByVkId(vkId, companyId) {
    const result = await query('SELECT * FROM users WHERE vk_id = $1 AND company_id = $2', [vkId, companyId]);
    return result.rows[0];
}

async function createUser(vkId, companyId, name) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(
            `INSERT INTO users (vk_id, company_id, name, bonus_balance, created_at) 
             VALUES ($1, $2, $3, 100, NOW()) 
             RETURNING *`,
            [vkId, companyId, name || 'Пользователь']
        );
        
        const user = result.rows[0];
        
        await client.query(
            `INSERT INTO user_progress (user_id, company_id, total_earned, streak, created_at) 
             VALUES ($1, $2, 100, 0, NOW())`,
            [user.id, companyId]
        );
        
        await client.query('COMMIT');
        return user;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}


async function addQuestColumns() {
    try {
        // Проверяем и добавляем колонку duration_days (количество дней на выполнение)
        const checkDuration = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'duration_days'
        `);
        
        if (checkDuration.rows.length === 0) {
            console.log('📝 Добавляем колонку duration_days в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN duration_days INTEGER DEFAULT 1`);
            console.log('✅ Колонка duration_days добавлена');
        }
        
        // Проверяем и добавляем колонку last_completed_at (когда задание было выполнено)
        const checkLastCompleted = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'last_completed_at'
        `);
        
        if (checkLastCompleted.rows.length === 0) {
            console.log('📝 Добавляем колонку last_completed_at в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN last_completed_at TIMESTAMP`);
            console.log('✅ Колонка last_completed_at добавлена');
        }
        
        // Проверяем и добавляем колонку reset_at (когда задание сбросится)
        const checkResetAt = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'reset_at'
        `);
        
        if (checkResetAt.rows.length === 0) {
            console.log('📝 Добавляем колонку reset_at в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN reset_at TIMESTAMP`);
            console.log('✅ Колонка reset_at добавлена');
        }
        
        // Проверяем и добавляем колонку target_type (тип цели задания)
        const checkTargetType = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'target_type'
        `);
        
        if (checkTargetType.rows.length === 0) {
            console.log('📝 Добавляем колонку target_type в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN target_type VARCHAR(50) DEFAULT 'daily_login'`);
            console.log('✅ Колонка target_type добавлена');
        }
        
        // Проверяем и добавляем колонку target_value (значение цели задания)
        const checkTargetValue = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quests' AND column_name = 'target_value'
        `);
        
        if (checkTargetValue.rows.length === 0) {
            console.log('📝 Добавляем колонку target_value в таблицу quests...');
            await query(`ALTER TABLE quests ADD COLUMN target_value INTEGER DEFAULT 1`);
            console.log('✅ Колонка target_value добавлена');
        }
        
        // Обновляем существующие задания - устанавливаем duration_days = 1 для daily_login
        await query(`
            UPDATE quests 
            SET duration_days = 1 
            WHERE title ILIKE '%вход%' AND duration_days IS NULL
        `);
        
        // Для остальных заданий по умолчанию 7 дней
        await query(`
            UPDATE quests 
            SET duration_days = 7 
            WHERE duration_days IS NULL
        `);
        
        // Обновляем target_type и target_value для существующих заданий
        await updateQuestTargetTypes();
        
    } catch (error) {
        console.error('❌ Ошибка добавления колонок заданий:', error);
    }
}

// Функция для обновления target_type и target_value на основе названия задания
async function updateQuestTargetTypes() {
    try {
        const quests = await query('SELECT id, title FROM quests');
        
        for (const quest of quests.rows) {
            const title = quest.title.toLowerCase();
            let targetType = 'daily_login';
            let targetValue = 1;
            
            if (title.includes('потратить') && title.includes('рублей')) {
                targetType = 'spend_amount';
                // Извлекаем сумму из названия
                const match = title.match(/(\d+)\s*рублей/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('покуп')) {
                targetType = 'purchase_count';
                // Извлекаем количество покупок
                const match = title.match(/(\d+)\s*покупок/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('колесо')) {
                targetType = 'spin_wheel';
                const match = title.match(/(\d+)\s*раза/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('скретч')) {
                targetType = 'scratch_card';
                const match = title.match(/(\d+)\s*раза/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('кости')) {
                targetType = 'play_dice';
                const match = title.match(/(\d+)\s*раза/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('стрик')) {
                targetType = 'daily_streak';
                const match = title.match(/(\d+)\s*дней/);
                if (match) targetValue = parseInt(match[1]);
            } else if (title.includes('вход')) {
                targetType = 'daily_login';
                targetValue = 1;
            } else if (title.includes('акци')) {
                targetType = 'use_promotion';
                targetValue = 1;
            }
            
            await query(
                'UPDATE quests SET target_type = $1, target_value = $2 WHERE id = $3',
                [targetType, targetValue, quest.id]
            );
        }
    } catch (error) {
        console.error('Ошибка обновления target_type:', error);
    }
}
async function checkAndResetQuests(userId, companyId) {
    const now = new Date();
    
    // Получаем все задания пользователя
    const userQuests = await query(`
        SELECT uqp.*, q.duration_days, q.title
        FROM user_quest_progress uqp
        JOIN quests q ON uqp.quest_id = q.id
        WHERE uqp.user_id = $1 AND q.company_id = $2
    `, [userId, companyId]);
    
    for (const quest of userQuests.rows) {
        // Если задание выполнено и есть дата выполнения
        if (quest.completed && quest.updated_at) {
            const completedDate = new Date(quest.updated_at);
            const daysSinceCompleted = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
            const durationDays = quest.duration_days || 1;
            
            // Если прошло больше дней чем duration_days - сбрасываем задание
            if (daysSinceCompleted >= durationDays) {
                await query(`
                    UPDATE user_quest_progress 
                    SET progress = 0, 
                        completed = FALSE, 
                        claimed = FALSE,
                        updated_at = NOW()
                    WHERE user_id = $1 AND quest_id = $2
                `, [userId, quest.quest_id]);
            }
        }
    }
}

// Функция для отслеживания прогресса покупок
async function trackPurchaseProgress(userId, companyId, purchaseAmount) {
    try {
        // Получаем все активные задания типа purchase_count и spend_amount
        const questsResult = await query(
            `SELECT * FROM quests 
             WHERE company_id = $1 
             AND active = true 
             AND (target_type = 'purchase_count' OR target_type = 'spend_amount')`,
            [companyId]
        );
        
        for (const quest of questsResult.rows) {
            const durationDays = quest.duration_days || 7; // По умолчанию 7 дней
            
            // Получаем прогресс пользователя
            const progressResult = await query(
                'SELECT * FROM user_quest_progress WHERE user_id = $1 AND quest_id = $2',
                [userId, quest.id]
            );
            
            // Вычисляем дату начала временного окна
            const windowStartDate = new Date();
            windowStartDate.setDate(windowStartDate.getDate() - durationDays);
            
            // Получаем количество покупок в пределах временного окна из транзакций
            const transactionsResult = await query(
                `SELECT COUNT(*) as purchase_count, COALESCE(SUM(amount), 0) as total_amount
                 FROM transactions 
                 WHERE user_id = $1 
                 AND company_id = $2
                 AND source = 'pos'
                 AND bonus_earned > 0
                 AND created_at >= $3`,
                [userId, companyId, windowStartDate]
            );
            
            const actualProgress = quest.target_type === 'purchase_count' 
                ? parseInt(transactionsResult.rows[0].purchase_count)
                : parseInt(transactionsResult.rows[0].total_amount);
            
            // Проверяем выполнено ли задание
            const completed = actualProgress >= quest.target_value;
            
            if (progressResult.rows.length === 0) {
                // Инициализируем прогресс
                await query(
                    'INSERT INTO user_quest_progress (user_id, quest_id, progress, completed, claimed, updated_at) VALUES ($1, $2, $3, $4, false, NOW())',
                    [userId, quest.id, actualProgress, completed]
                );
            } else {
                const progress = progressResult.rows[0];
                
                // Пропускаем уже выполненные задания
                if (progress.completed) continue;
                
                // Обновляем прогресс актуальными данными из временного окна
                await query(
                    'UPDATE user_quest_progress SET progress = $1, completed = $2, updated_at = NOW() WHERE user_id = $3 AND quest_id = $4',
                    [actualProgress, completed, userId, quest.id]
                );
                
                // Если задание выполнено, начисляем награду
                if (completed && !progress.completed) {
                    await updateUserBalance(userId, quest.reward, 'earn', `Задание выполнено: ${quest.title}`);
                    await query(
                        'INSERT INTO user_quests (user_id, quest_id, completed_at, reward_claimed) VALUES ($1, $2, NOW(), true)',
                        [userId, quest.id]
                    );
                    console.log(`✅ Задание выполнено: ${quest.title}, пользователь ${userId}, награда: ${quest.reward}`);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка trackPurchaseProgress:', error);
    }
}

// Функция для отметки выполнения задания "Воспользоваться акцией"
async function trackPromotionUsage(userId, companyId) {
    try {
        // Ищем задание типа use_promotion
        const questResult = await query(
            `SELECT * FROM quests 
             WHERE company_id = $1 
             AND active = true 
             AND target_type = 'use_promotion'`,
            [companyId]
        );
        
        if (questResult.rows.length === 0) return;
        
        const quest = questResult.rows[0];
        
        // Проверяем прогресс
        const progressResult = await query(
            'SELECT * FROM user_quest_progress WHERE user_id = $1 AND quest_id = $2',
            [userId, quest.id]
        );
        
        if (progressResult.rows.length === 0) {
            // Инициализируем прогресс
            await query(
                'INSERT INTO user_quest_progress (user_id, quest_id, progress, completed, claimed) VALUES ($1, $2, 1, true, false)',
                [userId, quest.id]
            );
        } else {
            const progress = progressResult.rows[0];
            
            // Пропускаем уже выполненные задания
            if (progress.completed) return;
            
            // Отмечаем как выполненное
            await query(
                'UPDATE user_quest_progress SET progress = 1, completed = true, updated_at = NOW() WHERE user_id = $1 AND quest_id = $2',
                [userId, quest.id]
            );
            
            // Начисляем награду
            await updateUserBalance(userId, quest.reward, 'earn', `Задание выполнено: ${quest.title}`);
            await query(
                'INSERT INTO user_quests (user_id, quest_id, completed_at, reward_claimed) VALUES ($1, $2, NOW(), true)',
                [userId, quest.id]
            );
        }
    } catch (error) {
        console.error('Ошибка trackPromotionUsage:', error);
    }
}

// Функция для сброса прогресса задания при переключении active
async function resetQuestProgress(questId) {
    try {
        // Сбрасываем прогресс для всех пользователей
        await query(
            'UPDATE user_quest_progress SET progress = 0, completed = false, claimed = false, updated_at = NOW() WHERE quest_id = $1',
            [questId]
        );
        
        // Удаляем записи о выполнении
        await query(
            'DELETE FROM user_quests WHERE quest_id = $1',
            [questId]
        );
        
        console.log(`Прогресс задания ${questId} сброшен для всех пользователей`);
    } catch (error) {
        console.error('Ошибка resetQuestProgress:', error);
    }
}



async function updateUserBalance(userId, change, type, description, metadata = {}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userResult = await client.query(
            'SELECT bonus_balance, total_earned, total_spent, company_id FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('Пользователь не найден');
        }
        
        const user = userResult.rows[0];
        const newBalance = type === 'earn' ? user.bonus_balance + change : user.bonus_balance - change;
        
        if (newBalance < 0) {
            throw new Error('Недостаточно бонусов');
        }
        
        // Обновляем баланс пользователя
        await client.query(
            'UPDATE users SET bonus_balance = $1 WHERE id = $2',
            [newBalance, userId]
        );
        
        if (type === 'earn') {
            await client.query(
                'UPDATE users SET total_earned = total_earned + $1 WHERE id = $2',
                [change, userId]
            );
            await client.query(
                `INSERT INTO user_progress (user_id, company_id, total_earned, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id, company_id)
                 DO UPDATE SET total_earned = user_progress.total_earned + $3, updated_at = NOW()`,
                [userId, user.company_id, change]
            );
        } else if (type === 'spend') {
            // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: при списании увеличиваем total_spent
            const spendAmount = Math.abs(change);
            await client.query(
                'UPDATE users SET total_spent = total_spent + $1 WHERE id = $2',
                [spendAmount, userId]
            );
            await client.query(
                `INSERT INTO user_progress (user_id, company_id, total_spent, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id, company_id)
                 DO UPDATE SET total_spent = user_progress.total_spent + $3, updated_at = NOW()`,
                [userId, user.company_id, spendAmount]
            );
        }
        
        // Добавляем транзакцию
        const source = metadata.source || (type === 'earn' ? 'app' : 'game');
        await client.query(
            `INSERT INTO transactions (user_id, company_id, amount, bonus_earned, bonus_spent, description, source, metadata, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [userId, user.company_id, 
             type === 'spend' ? Math.abs(change) : 0, 
             type === 'earn' ? change : 0, 
             type === 'spend' ? Math.abs(change) : 0, 
             description, source, JSON.stringify(metadata)]
        );
        
        await client.query('COMMIT');
        
        return {
            newBalance,
            totalEarned: type === 'earn' ? user.total_earned + change : user.total_earned,
            totalSpent: type === 'spend' ? (user.total_spent || 0) + Math.abs(change) : (user.total_spent || 0)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function completeUserQuest(userId, questId, reward) {
    const existing = await query(
        'SELECT * FROM user_quests WHERE user_id = $1 AND quest_id = $2',
        [userId, questId]
    );
    
    if (existing.rows.length > 0) {
        return null;
    }
    
    await query(
        'INSERT INTO user_quests (user_id, quest_id, completed_at, reward_claimed) VALUES ($1, $2, NOW(), $3)',
        [userId, questId, true]
    );
    
    await updateUserBalance(userId, reward, 'earn', `Задание выполнено! +${reward} бонусов`);
    
    return { questId, reward };
}

async function getUserCompletedQuests(userId) {
    const result = await query(
        `SELECT quest_id FROM user_quests WHERE user_id = $1`,
        [userId]
    );
    return result.rows;
}

async function getUserProgress(userId, companyId) {
    const result = await query(
        `SELECT * FROM user_progress WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
    );
    return result.rows[0];
}

async function updateUserProgress(userId, companyId, progressData) {
    const { totalEarned, streak, lastLoginDate } = progressData;
    const result = await query(
        `INSERT INTO user_progress (user_id, company_id, total_earned, streak, last_login_date, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, company_id) 
         DO UPDATE SET 
            total_earned = EXCLUDED.total_earned,
            streak = EXCLUDED.streak,
            last_login_date = EXCLUDED.last_login_date,
            updated_at = NOW()
         RETURNING *`,
        [userId, companyId, totalEarned || 0, streak || 0, lastLoginDate || null]
    );
    return result.rows[0];
}

async function updateQuestProgress(userId, questId, progress, completed, claimed) {
    const result = await query(
        `INSERT INTO user_quest_progress (user_id, quest_id, progress, completed, claimed, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, quest_id) 
         DO UPDATE SET 
            progress = EXCLUDED.progress,
            completed = EXCLUDED.completed,
            claimed = EXCLUDED.claimed,
            updated_at = NOW()
         RETURNING *`,
        [userId, questId, progress, completed, claimed]
    );
    return result.rows[0];
}

async function getAllUserQuestProgress(userId) {
    const result = await query(
        `SELECT quest_id, progress, completed, claimed, updated_at 
         FROM user_quest_progress 
         WHERE user_id = $1`,
        [userId]
    );
    return result.rows.map(row => ({
        quest_id: row.quest_id,
        progress: row.progress,
        completed: row.completed,
        claimed: row.claimed,
        updated_at: row.updated_at
    }));
}

async function checkDailyBonusClaimed(userId, companyId) {
    const result = await query(
        `SELECT last_login_date FROM user_progress 
         WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
    );
    
    if (result.rows.length === 0) return false;
    
    const today = new Date().toDateString();
    const lastLogin = result.rows[0].last_login_date 
        ? new Date(result.rows[0].last_login_date).toDateString() 
        : null;
    
    return lastLogin === today;
}

async function claimDailyBonus(userId, companyId, bonusAmount, newStreak) {
    const result = await query(
        `INSERT INTO user_progress (user_id, company_id, streak, last_login_date, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id, company_id) 
         DO UPDATE SET 
            streak = EXCLUDED.streak,
            last_login_date = EXCLUDED.last_login_date,
            updated_at = NOW()
         RETURNING *`,
        [userId, companyId, newStreak]
    );
    
    await updateUserBalance(userId, bonusAmount, 'earn', 'Ежедневный бонус');
    
    return result.rows[0];
}
// Добавьте эту функцию в addMissingColumns() или выполните отдельно:
async function addPromotionRewardColumns() {
    try {
        const checkRewardType = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'reward_type'
        `);
        
        if (checkRewardType.rows.length === 0) {
            console.log('📝 Добавляем колонку reward_type в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN reward_type VARCHAR(50) DEFAULT 'bonus'`);
            console.log('✅ Колонка reward_type добавлена');
        }
        
        const checkRewardValue = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'reward_value'
        `);
        
        if (checkRewardValue.rows.length === 0) {
            console.log('📝 Добавляем колонку reward_value в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN reward_value INTEGER DEFAULT 0`);
            console.log('✅ Колонка reward_value добавлена');
        }
        
        // Добавляем колонку products если её нет
        const checkProducts = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'products'
        `);
        
        if (checkProducts.rows.length === 0) {
            console.log('📝 Добавляем колонку products в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN products TEXT`);
            console.log('✅ Колонка products добавлена');
        }
        
        // Добавляем колонку is_free если её нет
        const checkIsFree = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'is_free'
        `);
        
        if (checkIsFree.rows.length === 0) {
            console.log('📝 Добавляем колонку is_free в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN is_free BOOLEAN DEFAULT FALSE`);
            console.log('✅ Колонка is_free добавлена');
        }
        
        // Добавляем колонку price если её нет
        const checkPrice = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'promotions' AND column_name = 'price'
        `);
        
        if (checkPrice.rows.length === 0) {
            console.log('📝 Добавляем колонку price в таблицу promotions...');
            await query(`ALTER TABLE promotions ADD COLUMN price INTEGER DEFAULT 100`);
            console.log('✅ Колонка price добавлена');
        }
    } catch (error) {
        console.error('❌ Ошибка добавления колонок:', error);
    }
}

async function addGameSettingsColumns() {
    try {
        // Проверяем существование таблицы
        const checkTable = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'game_settings'
            )
        `);
        
        if (!checkTable.rows[0].exists) {
            console.log('📝 Таблица game_settings не существует, будет создана при первом использовании');
            return;
        }
        
        // Проверяем и добавляем колонку game_type если её нет
        const checkGameType = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'game_settings' AND column_name = 'game_type'
        `);
        
        if (checkGameType.rows.length === 0) {
            console.log('📝 Добавляем колонку game_type в таблицу game_settings...');
            await query(`ALTER TABLE game_settings ADD COLUMN game_type VARCHAR(50)`);
            console.log('✅ Колонка game_type добавлена');
        }
        
        // Проверяем и добавляем колонку settings если её нет
        const checkSettings = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'game_settings' AND column_name = 'settings'
        `);
        
        if (checkSettings.rows.length === 0) {
            console.log('📝 Добавляем колонку settings в таблицу game_settings...');
            await query(`ALTER TABLE game_settings ADD COLUMN settings JSONB DEFAULT '{}'`);
            console.log('✅ Колонка settings добавлена');
        }
        
        // Проверяем и добавляем колонку active если её нет
        const checkActive = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'game_settings' AND column_name = 'active'
        `);
        
        if (checkActive.rows.length === 0) {
            console.log('📝 Добавляем колонку active в таблицу game_settings...');
            await query(`ALTER TABLE game_settings ADD COLUMN active BOOLEAN DEFAULT TRUE`);
            console.log('✅ Колонка active добавлена');
        }
        
        // Проверяем и добавляем колонку company_id если её нет
        const checkCompanyId = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'game_settings' AND column_name = 'company_id'
        `);
        
        if (checkCompanyId.rows.length === 0) {
            console.log('📝 Добавляем колонку company_id в таблицу game_settings...');
            await query(`ALTER TABLE game_settings ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
            console.log('✅ Колонка company_id добавлена');
        }
        
        // Проверяем и добавляем колонку updated_at если её нет
        const checkUpdated = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'game_settings' AND column_name = 'updated_at'
        `);
        
        if (checkUpdated.rows.length === 0) {
            console.log('📝 Добавляем колонку updated_at в таблицу game_settings...');
            await query(`ALTER TABLE game_settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
            console.log('✅ Колонка updated_at добавлена');
        }
        
        console.log('✅ Все колонки game_settings проверены');
    } catch (error) {
        console.error('❌ Ошибка добавления колонок game_settings:', error);
    }
}
// Добавьте эту функцию в database-pg.js после других функций

// Получение истории покупок пользователя
async function getUserPurchaseHistory(userId, limit = 50) {
    const result = await query(
        `SELECT id, amount, bonus_earned, bonus_spent, description, store_id, cashier_id, created_at 
         FROM transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

// Добавление покупки в историю (уже есть в updateUserBalance, но добавим отдельный метод для POS)
async function addPurchaseTransaction(userId, companyId, amount, bonusEarned, storeId, cashierId) {
    const result = await query(
        `INSERT INTO transactions (user_id, company_id, amount, bonus_earned, description, store_id, cashier_id, source, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pos', NOW()) 
         RETURNING *`,
        [userId, companyId, amount, bonusEarned, `Покупка на ${amount}₽`, storeId || 'unknown', cashierId || 'cashier_001']
    );
    return result.rows[0];
}
// Обновление баланса с записью транзакции
async function updateBalanceWithTransaction(userId, companyId, change, type, description, metadata = {}) {
    const user = await getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');
    
    const newBalance = type === 'earn' ? user.bonus_balance + change : user.bonus_balance - change;
    if (newBalance < 0) throw new Error('Недостаточно бонусов');
    
    // Обновляем баланс
    await query('UPDATE users SET bonus_balance = $1 WHERE id = $2', [newBalance, userId]);
    
    if (type === 'earn') {
        await query('UPDATE users SET total_earned = total_earned + $1 WHERE id = $2', [change, userId]);
        await query('UPDATE user_progress SET total_earned = total_earned + $1 WHERE user_id = $2', [change, userId]);
        
        // Добавляем транзакцию начисления
        await query(
            `INSERT INTO transactions (user_id, company_id, amount, bonus_earned, description, source, created_at, metadata) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
            [userId, companyId, metadata.amount || 0, change, description, metadata.source || 'app', JSON.stringify(metadata)]
        );
    } else if (type === 'spend') {
        await query('UPDATE users SET total_spent = total_spent + $1 WHERE id = $2', [change, userId]);
        
        // Добавляем транзакцию списания
        await query(
            `INSERT INTO transactions (user_id, company_id, bonus_spent, description, source, created_at, metadata) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [userId, companyId, change, description, metadata.source || 'app', JSON.stringify(metadata)]
        );
    }
    
    return newBalance;
}
// Добавление транзакции списания
async function addSpendTransaction(userId, companyId, bonusSpent, description, storeId, cashierId) {
    const result = await query(
        `INSERT INTO transactions (user_id, company_id, bonus_spent, description, store_id, cashier_id, source, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pos', NOW()) 
         RETURNING *`,
        [userId, companyId, bonusSpent, description || `Списание ${bonusSpent} бонусов`, storeId || 'unknown', cashierId || 'cashier_001']
    );
    return result.rows[0];
}
// Получение всех транзакций пользователя с деталями
async function getUserTransactions(userId, companyId, limit = 100) {
    const result = await query(
        `SELECT id, amount, bonus_earned, bonus_spent, description, store_id, cashier_id, source, created_at 
         FROM transactions 
         WHERE user_id = $1 AND company_id = $2 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId, companyId, limit]
    );
    return result.rows;
}

// ============ Функции для дня рождения ============
async function updateUserBirthday(userId, birthdayDate) {
    const result = await query(
        'UPDATE users SET birthday_date = $1 WHERE id = $2 RETURNING birthday_date',
        [birthdayDate, userId]
    );
    return result.rows[0];
}

async function getUserBirthday(userId) {
    const result = await query(
        'SELECT birthday_date FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0]?.birthday_date;
}

// ============ Функции для купленных акций ============
async function purchasePromotion(userId, promotionId, companyId, promotionCycleStart, bonusCost, isFree, promotionName) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Для бесплатных акций не списываем бонусы
        if (!isFree && bonusCost > 0) {
            // Проверяем баланс
            const user = await client.query('SELECT bonus_balance FROM users WHERE id = $1', [userId]);
            if (user.rows[0].bonus_balance < bonusCost) {
                throw new Error('Недостаточно бонусов');
            }
            
            // Списываем бонусы
            await client.query(
                'UPDATE users SET bonus_balance = bonus_balance - $1, total_spent = total_spent + $1 WHERE id = $2',
                [bonusCost, userId]
            );
        }
        
        // Записываем покупку
        const result = await client.query(
            `INSERT INTO user_purchased_promotions (user_id, promotion_id, company_id, promotion_cycle_start) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [userId, promotionId, companyId, promotionCycleStart]
        );
        
        // Добавляем транзакцию (только одну!) с названием акции
        const description = isFree ? `Бесплатная акция: ${promotionName}` : `Покупка акции: ${promotionName}`;
        const transactionBonusSpent = isFree ? 0 : bonusCost;
        
        await client.query(
            `INSERT INTO transactions (user_id, company_id, bonus_spent, description, source, created_at, metadata) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [userId, companyId, transactionBonusSpent, description, 'app', JSON.stringify({ promotion_id: promotionId, promotion_name: promotionName, is_free: isFree })]
        );
        
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getUserPurchasedPromotions(userId, companyId) {
    const result = await query(
        `SELECT upp.*, p.name, p.reward_value, p.start_date, p.end_date, p.active
         FROM user_purchased_promotions upp
         JOIN promotions p ON upp.promotion_id = p.id
         WHERE upp.user_id = $1 AND upp.company_id = $2
         ORDER BY upp.purchased_at DESC`,
        [userId, companyId]
    );
    return result.rows;
}

async function hasUserPurchasedPromotion(userId, promotionId, promotionCycleStart) {
    const result = await query(
        `SELECT id FROM user_purchased_promotions 
         WHERE user_id = $1 AND promotion_id = $2 AND promotion_cycle_start = $3`,
        [userId, promotionId, promotionCycleStart]
    );
    return result.rows.length > 0;
}

async function usePurchasedPromotion(userId, promotionId, promotionCycleStart) {
    const result = await query(
        `UPDATE user_purchased_promotions 
         SET used = TRUE, used_at = NOW() 
         WHERE user_id = $1 AND promotion_id = $2 AND promotion_cycle_start = $3 AND used = FALSE
         RETURNING *`,
        [userId, promotionId, promotionCycleStart]
    );
    return result.rows[0];
}

async function checkPromotionCycle(promotionId) {
    const result = await query(
        `SELECT start_date, active FROM promotions WHERE id = $1`,
        [promotionId]
    );
    return result.rows[0];
}

// ============ Функции для Розыгрышей (Giveaways) ============
async function getGiveaways(companyId, includeInactive = false) {
    await migrateGiveawaysTable();
    
    let queryText = 'SELECT * FROM giveaways WHERE company_id = $1';
    const params = [companyId];
    
    if (!includeInactive) {
        queryText += ' AND active = true';
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText, params);
    return result.rows;
}

async function addGiveaway(companyId, giveawayData) {
    const { name, link, description, active, is_paid, bonus_cost, end_date } = giveawayData;
    
    // Проверяем обязательные поля
    if (!name || !link) {
        throw new Error('name и link обязательны');
    }
    
    const result = await query(
        `INSERT INTO giveaways (company_id, name, link, description, active, is_paid, bonus_cost, end_date, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
         RETURNING *`,
        [companyId, name, link, description || '', active !== undefined ? active : true, 
         is_paid === true, bonus_cost || 0, end_date || null]
    );
    return result.rows[0];
}

async function updateGiveaway(giveawayId, giveawayData) {
    const { name, link, description, active, is_paid, bonus_cost, end_date } = giveawayData;
    
    const result = await query(
        `UPDATE giveaways 
         SET name = $2, link = $3, description = $4, active = $5, is_paid = $6, bonus_cost = $7, end_date = $8, updated_at = NOW()
         WHERE id = $1 
         RETURNING *`,
        [giveawayId, name, link, description, active, is_paid === true, bonus_cost || 0, end_date || null]
    );
    return result.rows[0];
}

async function deleteGiveaway(giveawayId) {
    await query('DELETE FROM giveaways WHERE id = $1', [giveawayId]);
    return true;
}

async function purchaseGiveaway(userId, giveawayId, companyId, bonusCost) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Проверяем баланс
        const user = await client.query('SELECT bonus_balance FROM users WHERE id = $1', [userId]);
        if (user.rows[0].bonus_balance < bonusCost) {
            throw new Error('Недостаточно бонусов');
        }
        
        // Списываем бонусы
        await client.query(
            'UPDATE users SET bonus_balance = bonus_balance - $1, total_spent = total_spent + $1 WHERE id = $2',
            [bonusCost, userId]
        );
        
        // Записываем покупку розыгрыша
        const result = await client.query(
            `INSERT INTO user_purchased_giveaways (user_id, giveaway_id, company_id, purchased_at) 
             VALUES ($1, $2, $3, NOW()) 
             RETURNING *`,
            [userId, giveawayId, companyId]
        );
        
        // Добавляем транзакцию
        await client.query(
            `INSERT INTO transactions (user_id, company_id, bonus_spent, description, source, created_at, metadata) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [userId, companyId, bonusCost, `Покупка доступа к розыгрышу #${giveawayId}`, 'app', JSON.stringify({ giveaway_id: giveawayId })]
        );
        
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
async function hasUserPurchasedGiveaway(userId, giveawayId) {
    const result = await query(
        'SELECT id FROM user_purchased_giveaways WHERE user_id = $1 AND giveaway_id = $2',
        [userId, giveawayId]
    );
    return result.rows.length > 0;
}
// ============ Функции для Классификации Пользователей ============
async function initializeUserClassification(userId, companyId) {
    const existing = await query(
        'SELECT * FROM user_classification WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
    );
    
    if (existing.rows.length === 0) {
        const now = new Date();
        const weekResetDate = new Date(now);
        // Устанавливаем дату сброса на конец текущей недели (воскресенье)
        weekResetDate.setDate(weekResetDate.getDate() + (7 - weekResetDate.getDay()));
        weekResetDate.setHours(23, 59, 59, 999);
        
        await query(
            `INSERT INTO user_classification 
             (user_id, company_id, user_type, first_visit_date, last_app_visit_date, week_reset_date, classified_at, updated_at) 
             VALUES ($1, $2, 'new', $3, $3, $4, NOW(), NOW())`,
            [userId, companyId, now, weekResetDate]
        );
    }
}

async function updateUserClassification(userId, companyId, activityType) {
    // activityType: 'purchase' или 'app_visit'
    const classification = await query(
        'SELECT * FROM user_classification WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
    );
    
    if (classification.rows.length === 0) {
        await initializeUserClassification(userId, companyId);
        return;
    }
    
    const user = classification.rows[0];
    const now = new Date();
    
    // Проверяем, нужно ли сбросить недельные счетчики
    const weekResetDate = new Date(user.week_reset_date);
    if (now > weekResetDate) {
        // Сбрасываем недельные счетчики
        const newWeekResetDate = new Date(now);
        newWeekResetDate.setDate(newWeekResetDate.getDate() + (7 - newWeekResetDate.getDay()));
        newWeekResetDate.setHours(23, 59, 59, 999);
        
        await query(
            `UPDATE user_classification 
             SET purchases_this_week = 0, 
                 app_visits_this_week = 0,
                 week_reset_date = $1,
                 updated_at = NOW()
             WHERE user_id = $2 AND company_id = $3`,
            [newWeekResetDate, userId, companyId]
        );
        
        user.purchases_this_week = 0;
        user.app_visits_this_week = 0;
    }
    
    // Обновляем счетчики активности
    if (activityType === 'purchase') {
        await query(
            `UPDATE user_classification 
             SET purchases_this_week = purchases_this_week + 1,
                 purchases_last_two_weeks = purchases_last_two_weeks + 1,
                 last_purchase_date = NOW(),
                 updated_at = NOW()
             WHERE user_id = $1 AND company_id = $2`,
            [userId, companyId]
        );
    } else if (activityType === 'app_visit') {
        await query(
            `UPDATE user_classification 
             SET app_visits_this_week = app_visits_this_week + 1,
                 last_app_visit_date = NOW(),
                 updated_at = NOW()
             WHERE user_id = $1 AND company_id = $2`,
            [userId, companyId]
        );
    }
    
    // Пересчитываем тип пользователя
    await recalculateUserType(userId, companyId);
}

async function recalculateUserType(userId, companyId) {
    const user = await query(
        'SELECT * FROM user_classification WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
    );
    
    if (user.rows.length === 0) return;
    
    const userData = user.rows[0];
    const now = new Date();
    
    // Получаем все покупки пользователя
    const allPurchases = await query(
        `SELECT created_at FROM transactions 
         WHERE user_id = $1 AND company_id = $2 
         AND source = 'pos' 
         AND amount > 0
         ORDER BY created_at DESC`,
        [userId, companyId]
    );
    
    // Если нет покупок - спящий
    if (allPurchases.rows.length === 0) {
        await query(
            `UPDATE user_classification 
             SET user_type = 'dormant', classified_at = NOW(), updated_at = NOW()
             WHERE user_id = $1 AND company_id = $2`,
            [userId, companyId]
        );
        console.log(`📊 Пользователь ${userId}: dormant (нет покупок)`);
        return;
    }
    
    const lastPurchaseDate = new Date(allPurchases.rows[0].created_at);
    const daysSinceLastPurchase = Math.floor((now - lastPurchaseDate) / (1000 * 60 * 60 * 24));
    const totalPurchases = allPurchases.rows.length;
    
    // Вычисляем максимальный интервал между покупками (в днях)
    let maxIntervalDays = 0;
    if (allPurchases.rows.length >= 2) {
        for (let i = 0; i < allPurchases.rows.length - 1; i++) {
            const currentDate = new Date(allPurchases.rows[i].created_at);
            const nextDate = new Date(allPurchases.rows[i + 1].created_at);
            const intervalDays = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));
            if (intervalDays > maxIntervalDays) {
                maxIntervalDays = intervalDays;
            }
        }
    }
    
    let newUserType = 'dormant'; // По умолчанию спящий
    
    // Логика классификации (проверяем в порядке приоритета):
    
    // 1. Спящий - 1+ покупок и прошло ≥20 дней с последней покупки
    if (daysSinceLastPurchase >= 20) {
        newUserType = 'dormant';
    }
    // 2. Постоянный - 2+ покупок и между каждыми покупками ≤3 дней
    else if (totalPurchases >= 2 && maxIntervalDays <= 3) {
        newUserType = 'regular';
    }
    // 3. Активный - 2+ покупок и между каждыми покупками ≤7 дней
    else if (totalPurchases >= 2 && maxIntervalDays <= 7) {
        newUserType = 'active';
    }
    // 4. Новичок - 1 покупка и прошло ≤14 дней
    else if (totalPurchases === 1 && daysSinceLastPurchase <= 14) {
        newUserType = 'new';
    }
    // 5. Если не подошел ни один критерий - спящий
    else {
        newUserType = 'dormant';
    }
    
    // Обновляем тип пользователя
    await query(
        `UPDATE user_classification 
         SET user_type = $1, classified_at = NOW(), updated_at = NOW()
         WHERE user_id = $2 AND company_id = $3`,
        [newUserType, userId, companyId]
    );
    
    console.log(`📊 Пользователь ${userId}: ${newUserType} (всего покупок: ${totalPurchases}, последняя: ${daysSinceLastPurchase}дн назад, макс. интервал: ${maxIntervalDays}дн)`);
}

// Пересчет классификации всех пользователей компании
async function recalculateAllUsersClassification(companyId) {
    const users = await query(
        'SELECT user_id FROM user_classification WHERE company_id = $1',
        [companyId]
    );
    
    console.log(`🔄 Начинаем пересчет классификации для ${users.rows.length} пользователей компании ${companyId}`);
    
    for (const userRow of users.rows) {
        await recalculateUserType(userRow.user_id, companyId);
    }
    
    console.log(`✅ Пересчет классификации завершен`);
}

async function getUserClassification(userId, companyId) {
    const result = await query(
        'SELECT * FROM user_classification WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
    );
    return result.rows[0];
}

async function getAllUsersClassification(companyId) {
    const result = await query(
        `SELECT uc.*, u.name, u.vk_id, u.bonus_balance, u.created_at as user_created_at
         FROM user_classification uc
         JOIN users u ON uc.user_id = u.id
         WHERE uc.company_id = $1
         ORDER BY uc.classified_at DESC`,
        [companyId]
    );
    return result.rows;
}

async function getUsersByType(companyId, userType) {
    const result = await query(
        `SELECT uc.*, u.name, u.vk_id, u.bonus_balance, u.created_at as user_created_at
         FROM user_classification uc
         JOIN users u ON uc.user_id = u.id
         WHERE uc.company_id = $1 AND uc.user_type = $2
         ORDER BY uc.classified_at DESC`,
        [companyId, userType]
    );
    return result.rows;
}

async function getClassificationStats(companyId) {
    const result = await query(
        `SELECT 
            user_type,
            COUNT(*) as count
         FROM user_classification
         WHERE company_id = $1
         GROUP BY user_type`,
        [companyId]
    );
    
    const stats = {
        new: 0,
        active: 0,
        regular: 0,
        dormant: 0,
        total: 0
    };
    
    result.rows.forEach(row => {
        stats[row.user_type] = parseInt(row.count);
        stats.total += parseInt(row.count);
    });
    
    return stats;
}

// ============ Функции для Реальной Аналитики CRM ============
async function getRealAnalytics(companyId, period = 'month') {
    const now = new Date();
    let startDate;
    
    // Определяем начало периода
    switch (period) {
        case 'day':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'year':
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Получаем реальную выручку (только POS-транзакции с amount > 0)
    // ИСКЛЮЧАЕМ транзакции из игр (у них amount = 0)
    const revenueResult = await query(
        `SELECT 
            COUNT(*) as total_transactions,
            COALESCE(SUM(amount), 0) as total_revenue,
            COALESCE(SUM(bonus_earned), 0) as total_bonuses_earned,
            COALESCE(SUM(bonus_spent), 0) as total_bonuses_spent
         FROM transactions
         WHERE company_id = $1
         AND source = 'pos'
         AND amount > 0
         AND created_at >= $2`,
        [companyId, startDate]
    );
    
    // Получаем количество активных пользователей (совершивших покупку в период)
    const activeUsersResult = await query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM transactions
         WHERE company_id = $1
         AND source = 'pos'
         AND amount > 0
         AND created_at >= $2`,
        [companyId, startDate]
    );
    
    // Получаем количество новых пользователей (зарегистрировались в период)
    const newUsersResult = await query(
        `SELECT COUNT(*) as count
         FROM users
         WHERE company_id = $1
         AND created_at >= $2`,
        [companyId, startDate]
    );
    
    // Получаем классификацию пользователей
    const classificationStats = await getClassificationStats(companyId);
    
    // Получаем топ продуктов
    const topProductsResult = await query(
        `SELECT 
            items,
            COUNT(*) as sales_count,
            COALESCE(SUM(amount), 0) as revenue
         FROM transactions
         WHERE company_id = $1
         AND source = 'pos'
         AND amount > 0
         AND items != '[]'
         AND created_at >= $2
         GROUP BY items
         ORDER BY sales_count DESC
         LIMIT 10`,
        [companyId, startDate]
    );
    
    // Получаем активность по дням
    const dailyActivityResult = await query(
        `SELECT 
            DATE(created_at) as date,
            COUNT(*) as transactions,
            COUNT(DISTINCT user_id) as unique_users,
            COALESCE(SUM(amount), 0) as revenue
         FROM transactions
         WHERE company_id = $1
         AND source = 'pos'
         AND amount > 0
         AND created_at >= $2
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [companyId, startDate]
    );
    
    // Получаем средний чек
    const avgCheckResult = await query(
        `SELECT 
            COALESCE(AVG(amount), 0) as avg_check,
            COALESCE(AVG(bonus_earned), 0) as avg_bonus
         FROM transactions
         WHERE company_id = $1
         AND source = 'pos'
         AND amount > 0
         AND created_at >= $2`,
        [companyId, startDate]
    );
    
    return {
        revenue: parseInt(revenueResult.rows[0].total_revenue),
        totalTransactions: parseInt(revenueResult.rows[0].total_transactions),
        totalBonusesEarned: parseInt(revenueResult.rows[0].total_bonuses_earned),
        totalBonusesSpent: parseInt(revenueResult.rows[0].total_bonuses_spent),
        activeUsers: parseInt(activeUsersResult.rows[0].count),
        newUsers: parseInt(newUsersResult.rows[0].count),
        classification: classificationStats,
        avgCheck: Math.round(parseInt(avgCheckResult.rows[0].avg_check)),
        avgBonus: Math.round(parseInt(avgCheckResult.rows[0].avg_bonus)),
        dailyActivity: dailyActivityResult.rows,
        topProducts: topProductsResult.rows
    };
}
async function addGiveawayColumns() {
    try {
        // Проверяем и добавляем колонку is_paid (платный/бесплатный)
        const checkIsPaid = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'giveaways' AND column_name = 'is_paid'
        `);
        
        if (checkIsPaid.rows.length === 0) {
            console.log('📝 Добавляем колонку is_paid в таблицу giveaways...');
            await query(`ALTER TABLE giveaways ADD COLUMN is_paid BOOLEAN DEFAULT FALSE`);
            console.log('✅ Колонка is_paid добавлена');
        }
        
        // Проверяем и добавляем колонку bonus_cost (стоимость в бонусах для платных розыгрышей)
        const checkBonusCost = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'giveaways' AND column_name = 'bonus_cost'
        `);
        
        if (checkBonusCost.rows.length === 0) {
            console.log('📝 Добавляем колонку bonus_cost в таблицу giveaways...');
            await query(`ALTER TABLE giveaways ADD COLUMN bonus_cost INTEGER DEFAULT 0`);
            console.log('✅ Колонка bonus_cost добавлена');
        }
        
        // Проверяем и добавляем колонку end_date (дата окончания розыгрыша)
        const checkEndDate = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'giveaways' AND column_name = 'end_date'
        `);
        
        if (checkEndDate.rows.length === 0) {
            console.log('📝 Добавляем колонку end_date в таблицу giveaways...');
            await query(`ALTER TABLE giveaways ADD COLUMN end_date TIMESTAMP`);
            console.log('✅ Колонка end_date добавлена');
        }
        
        // Создаем таблицу user_purchased_giveaways для отслеживания покупок платных розыгрышей
        const checkPurchasedTable = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'user_purchased_giveaways'
        `);
        
        if (checkPurchasedTable.rows.length === 0) {
            console.log('📝 Создаем таблицу user_purchased_giveaways...');
            await query(`
                CREATE TABLE user_purchased_giveaways (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    giveaway_id INTEGER REFERENCES giveaways(id) ON DELETE CASCADE,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    used BOOLEAN DEFAULT FALSE,
                    UNIQUE(user_id, giveaway_id)
                )
            `);
            console.log('✅ Таблица user_purchased_giveaways создана');
        }
        
        console.log('✅ Все колонки giveaways проверены');
    } catch (error) {
        console.error('❌ Ошибка добавления колонок giveaways:', error);
    }
}

async function migrateGiveawaysTable() {
    try {
        // Проверяем существование таблицы
        const tableExists = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'giveaways'
            )
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('📝 Таблица giveaways не существует, будет создана позже');
            return;
        }
        
        // Получаем список существующих колонок
        const columns = await query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'giveaways'
        `);
        
        const existingColumns = columns.rows.map(c => c.column_name);
        console.log('📋 Существующие колонки giveaways:', existingColumns);
        
        // Удаляем устаревшие колонки
        const columnsToDrop = ['title', 'start_date', 'end_date_old'];
        for (const col of columnsToDrop) {
            if (existingColumns.includes(col)) {
                console.log(`📝 Удаляем устаревшую колонку ${col}...`);
                await query(`ALTER TABLE giveaways DROP COLUMN ${col}`);
            }
        }
        
        // Обновляем список колонок после удаления
        const updatedColumns = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'giveaways'
        `);
        const currentColumns = updatedColumns.rows.map(c => c.column_name);
        
        // Добавляем колонку name если её нет
        if (!currentColumns.includes('name')) {
            console.log('📝 Добавляем колонку name...');
            await query(`ALTER TABLE giveaways ADD COLUMN name VARCHAR(255)`);
            await query(`UPDATE giveaways SET name = 'Розыгрыш' WHERE name IS NULL`);
            await query(`ALTER TABLE giveaways ALTER COLUMN name SET NOT NULL`);
        }
        
        // Добавляем колонку link если её нет
        if (!currentColumns.includes('link')) {
            console.log('📝 Добавляем колонку link...');
            await query(`ALTER TABLE giveaways ADD COLUMN link TEXT NOT NULL DEFAULT ''`);
        }
        
        // Добавляем колонку description если её нет
        if (!currentColumns.includes('description')) {
            console.log('📝 Добавляем колонку description...');
            await query(`ALTER TABLE giveaways ADD COLUMN description TEXT`);
        }
        
        // Добавляем колонку active если её нет
        if (!currentColumns.includes('active')) {
            console.log('📝 Добавляем колонку active...');
            await query(`ALTER TABLE giveaways ADD COLUMN active BOOLEAN DEFAULT TRUE`);
        }
        
        // Добавляем колонку is_paid если её нет
        if (!currentColumns.includes('is_paid')) {
            console.log('📝 Добавляем колонку is_paid...');
            await query(`ALTER TABLE giveaways ADD COLUMN is_paid BOOLEAN DEFAULT FALSE`);
        }
        
        // Добавляем колонку bonus_cost если её нет
        if (!currentColumns.includes('bonus_cost')) {
            console.log('📝 Добавляем колонку bonus_cost...');
            await query(`ALTER TABLE giveaways ADD COLUMN bonus_cost INTEGER DEFAULT 0`);
        }
        
        // Добавляем колонку end_date если её нет
        if (!currentColumns.includes('end_date')) {
            console.log('📝 Добавляем колонку end_date...');
            await query(`ALTER TABLE giveaways ADD COLUMN end_date TIMESTAMP`);
        } else {
            // Удаляем ограничение NOT NULL если оно есть
            console.log('📝 Проверяем ограничение NOT NULL на end_date...');
            const endDateCol = columns.rows.find(c => c.column_name === 'end_date');
            if (endDateCol && endDateCol.is_nullable === 'NO') {
                await query(`ALTER TABLE giveaways ALTER COLUMN end_date DROP NOT NULL`);
                console.log('✅ Удалено ограничение NOT NULL с end_date');
            }
        }
        
        // Добавляем колонку created_at если её нет
        if (!currentColumns.includes('created_at')) {
            console.log('📝 Добавляем колонку created_at...');
            await query(`ALTER TABLE giveaways ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        }
        
        // Добавляем колонку updated_at если её нет
        if (!currentColumns.includes('updated_at')) {
            console.log('📝 Добавляем колонку updated_at...');
            await query(`ALTER TABLE giveaways ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        }
        
        console.log('✅ Все колонки giveaways добавлены/проверены');
    } catch (error) {
        console.error('❌ Ошибка миграции giveaways:', error);
    }
}
// Добавляем колонку bonus_settings в таблицу companies
async function addBonusSettingsColumn() {
    try {
        const checkColumn = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'bonus_settings'
        `);
        
        if (checkColumn.rows.length === 0) {
            console.log('📝 Добавляем колонку bonus_settings в таблицу companies...');
            // ИСПРАВЛЕНО: переименовали maxBonusPaymentPercent в maxBonusPaymentPercent (оставили как есть, но в UI будем показывать как "Макс. % оплаты")
            await query(`
                ALTER TABLE companies 
                ADD COLUMN bonus_settings JSONB DEFAULT '{
                    "rubToBonus": 10,
                    "maxBonusPaymentPercent": 25,
                    "minPurchaseForBonus": 1000,
                    "bonusRatePerThousand": 10
                }'::jsonb
            `);
            console.log('✅ Колонка bonus_settings добавлена');
        } else {
            await query(`
                UPDATE companies 
                SET bonus_settings = '{
                    "rubToBonus": 10,
                    "maxBonusPaymentPercent": 25,
                    "minPurchaseForBonus": 1000,
                    "bonusRatePerThousand": 10
                }'::jsonb
                WHERE bonus_settings IS NULL OR bonus_settings = '{}'::jsonb
            `);
        }
    } catch (error) {
        console.error('❌ Ошибка добавления bonus_settings:', error);
    }
}

// Добавляем новые колонки для notification_campaigns
async function addNotificationCampaignColumns() {
    try {
        // Проверяем и добавляем колонку interval_days
        const checkInterval = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'interval_days'
        `);
        
        if (checkInterval.rows.length === 0) {
            console.log('📝 Добавляем колонку interval_days в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN interval_days INTEGER DEFAULT 1`);
            console.log('✅ Колонка interval_days добавлена');
        }
        
        // Проверяем и добавляем колонку image_url
        const checkImage = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'image_url'
        `);
        
        if (checkImage.rows.length === 0) {
            console.log('📝 Добавляем колонку image_url в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN image_url TEXT`);
            console.log('✅ Колонка image_url добавлена');
        }
        
        // Проверяем и добавляем колонку is_default
        const checkDefault = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'is_default'
        `);
        
        if (checkDefault.rows.length === 0) {
            console.log('📝 Добавляем колонку is_default в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN is_default BOOLEAN DEFAULT FALSE`);
            console.log('✅ Колонка is_default добавлена');
        }
        
        // Проверяем и добавляем колонку last_sent_at
        const checkLastSent = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'last_sent_at'
        `);
        
        if (checkLastSent.rows.length === 0) {
            console.log('📝 Добавляем колонку last_sent_at в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN last_sent_at TIMESTAMP`);
            console.log('✅ Колонка last_sent_at добавлена');
        }
        
        // Исправляем колонку trigger_type - делаем nullable (допускает NULL)
        console.log('📝 Изменяем колонку trigger_type на nullable...');
        try {
            await query(`ALTER TABLE notification_campaigns ALTER COLUMN trigger_type DROP NOT NULL`);
            console.log('✅ Колонка trigger_type теперь допускает NULL');
        } catch (error) {
            console.log('⚠️ Колонка trigger_type уже nullable или не существует:', error.message);
        }
        
        // Проверяем и добавляем колонку audience в таблицу notifications (если её нет)
        const checkNotifAudience = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'audience'
        `);
        
        if (checkNotifAudience.rows.length === 0) {
            console.log('📝 Добавляем колонку audience в таблицу notifications...');
            await query(`ALTER TABLE notifications ADD COLUMN audience VARCHAR(50) DEFAULT 'all'`);
            console.log('✅ Колонка audience добавлена в notifications');
        }
        
        // Проверяем и добавляем колонку status в таблицу notifications (если её нет)
        const checkNotifStatus = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'status'
        `);
        
        if (checkNotifStatus.rows.length === 0) {
            console.log('📝 Добавляем колонку status в таблицу notifications...');
            await query(`ALTER TABLE notifications ADD COLUMN status VARCHAR(50) DEFAULT 'pending'`);
            console.log('✅ Колонка status добавлена в notifications');
        }
        
        // Проверяем и добавляем колонку sent_count в таблицу notifications (если её нет)
        const checkNotifSentCount = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'sent_count'
        `);
        
        if (checkNotifSentCount.rows.length === 0) {
            console.log('📝 Добавляем колонку sent_count в таблицу notifications...');
            await query(`ALTER TABLE notifications ADD COLUMN sent_count INTEGER DEFAULT 0`);
            console.log('✅ Колонка sent_count добавлена в notifications');
        }
        
        // Проверяем и добавляем колонку sent_at в таблицу notifications (если её нет)
        const checkNotifSentAt = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'sent_at'
        `);
        
        if (checkNotifSentAt.rows.length === 0) {
            console.log('📝 Добавляем колонку sent_at в таблицу notifications...');
            await query(`ALTER TABLE notifications ADD COLUMN sent_at TIMESTAMP`);
            console.log('✅ Колонка sent_at добавлена в notifications');
        }
        
        // Проверяем и добавляем колонку button_link в таблицу notification_campaigns
        const checkButtonLink = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'button_link'
        `);
        
        if (checkButtonLink.rows.length === 0) {
            console.log('📝 Добавляем колонку button_link в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN button_link TEXT`);
            console.log('✅ Колонка button_link добавлена');
        }
        
        // Проверяем и добавляем колонку button_text в таблицу notification_campaigns
        const checkButtonText = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notification_campaigns' AND column_name = 'button_text'
        `);
        
        if (checkButtonText.rows.length === 0) {
            console.log('📝 Добавляем колонку button_text в таблицу notification_campaigns...');
            await query(`ALTER TABLE notification_campaigns ADD COLUMN button_text VARCHAR(50) DEFAULT 'Перейти'`);
            console.log('✅ Колонка button_text добавлена');
        }
        
        // Проверяем и добавляем колонку image_url в таблицу notifications
        const checkNotifImage = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'image_url'
        `);
        
        if (checkNotifImage.rows.length === 0) {
            console.log('📝 Добавляем колонку image_url в таблицу notifications...');
            await query(`ALTER TABLE notifications ADD COLUMN image_url TEXT`);
            console.log('✅ Колонка image_url добавлена в notifications');
        }
        
        console.log('✅ Все колонки notification_campaigns проверены');
    } catch (error) {
        console.error('❌ Ошибка добавления колонок notification_campaigns:', error);
    }
}

// ========== NOTIFICATIONS ==========

// Отправка рассылки
async function sendNotification(companyId, audience, title, message) {
    try {
        // Получаем пользователей по аудитории
        const users = await getUsersBySegment(companyId, audience);
        
        // Сохраняем в историю рассылок
        const result = await query(
            `INSERT INTO notifications (company_id, title, message, audience, status, sent_count, sent_at)
             VALUES ($1, $2, $3, $4, 'sent', $5, NOW())
             RETURNING *`,
            [companyId, title, message, audience, users.length]
        );
        
        console.log(`📨 Рассылка отправлена: ${title} (${users.length} пользователей, аудитория: ${audience})`);
        
        return {
            success: true,
            notification: result.rows[0],
            sentCount: users.length,
            users: users.map(u => ({ vk_id: u.vk_id, name: u.name }))
        };
    } catch (error) {
        console.error('❌ Ошибка отправки рассылки:', error);
        throw error;
    }
}

// Получение истории рассылок
async function getNotificationHistory(companyId, limit = 50) {
    try {
        const result = await query(
            `SELECT * FROM notifications 
             WHERE company_id = $1 
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения истории рассылок:', error);
        throw error;
    }
}

// Получение кампаний компании
async function getNotificationCampaigns(companyId) {
    try {
        const result = await query(
            `SELECT * FROM notification_campaigns 
             WHERE company_id = $1 
             ORDER BY created_at DESC`,
            [companyId]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения кампаний:', error);
        throw error;
    }
}

// Добавление кампании
async function addNotificationCampaign(companyId, name, title, message, audience, isActive = true, intervalDays = 1, imageUrl = null, isDefault = false, buttonLink = null, buttonText = 'Перейти') {
    try {
        const result = await query(
            `INSERT INTO notification_campaigns (company_id, name, title, message, audience, is_active, interval_days, image_url, is_default, button_link, button_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [companyId, name, title, message, audience, isActive, intervalDays, imageUrl, isDefault, buttonLink, buttonText]
        );
        console.log(`✅ Кампания добавлена: ${name}`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Ошибка добавления кампании:', error);
        throw error;
    }
}

// Обновление кампании
async function updateNotificationCampaign(campaignId, name, title, message, audience, isActive, intervalDays, imageUrl, buttonLink, buttonText) {
    try {
        const result = await query(
            `UPDATE notification_campaigns 
             SET name = $2, title = $3, message = $4, audience = $5, is_active = $6, interval_days = $7, image_url = $8, updated_at = NOW(), button_link = $9, button_text = $10
             WHERE id = $1
             RETURNING *`,
            [campaignId, name, title, message, audience, isActive, intervalDays, imageUrl, buttonLink, buttonText]
        );
        console.log(`✅ Кампания обновлена: ${name}`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Ошибка обновления кампании:', error);
        throw error;
    }
}

// Удаление кампании
async function deleteNotificationCampaign(campaignId) {
    try {
        // Проверяем, является ли кампания стандартной
        const checkResult = await query(
            `SELECT is_default FROM notification_campaigns WHERE id = $1`,
            [campaignId]
        );
        
        if (checkResult.rows.length === 0) {
            throw new Error('Кампания не найдена');
        }
        
        if (checkResult.rows[0].is_default) {
            throw new Error('Нельзя удалить стандартную кампанию');
        }
        
        await query(`DELETE FROM notification_campaigns WHERE id = $1`, [campaignId]);
        console.log(`🗑️ Кампания удалена: ${campaignId}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Ошибка удаления кампании:', error);
        throw error;
    }
}

// Переключение активности кампании
async function toggleNotificationCampaign(campaignId, isActive) {
    try {
        const result = await query(
            `UPDATE notification_campaigns 
             SET is_active = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [campaignId, isActive]
        );
        return result.rows[0];
    } catch (error) {
        console.error('❌ Ошибка переключения кампании:', error);
        throw error;
    }
}

// Получение активных кампаний для автоматического запуска
async function getActiveCampaigns(companyId) {
    try {
        const result = await query(
            `SELECT * FROM notification_campaigns 
             WHERE company_id = $1 AND is_active = TRUE
             AND (last_sent_at IS NULL OR last_sent_at <= NOW() - (interval_days || ' days')::INTERVAL)
             ORDER BY created_at DESC`,
            [companyId]
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения активных кампаний:', error);
        throw error;
    }
}

// Получение пользователей по сегменту
async function getUsersBySegment(companyId, audience) {
    try {
        let userQuery;
        
        switch (audience) {
            case 'new':
                userQuery = `
                    SELECT u.vk_id, u.name, u.company_id
                    FROM users u
                    JOIN user_classification uc ON u.id = uc.user_id AND u.company_id = uc.company_id
                    WHERE u.company_id = $1 AND uc.user_type = 'new'
                `;
                break;
            case 'active':
                userQuery = `
                    SELECT u.vk_id, u.name, u.company_id
                    FROM users u
                    JOIN user_classification uc ON u.id = uc.user_id AND u.company_id = uc.company_id
                    WHERE u.company_id = $1 AND uc.user_type = 'active'
                `;
                break;
            case 'regular':
                userQuery = `
                    SELECT u.vk_id, u.name, u.company_id
                    FROM users u
                    JOIN user_classification uc ON u.id = uc.user_id AND u.company_id = uc.company_id
                    WHERE u.company_id = $1 AND uc.user_type = 'regular'
                `;
                break;
            case 'dormant':
                userQuery = `
                    SELECT u.vk_id, u.name, u.company_id
                    FROM users u
                    JOIN user_classification uc ON u.id = uc.user_id AND u.company_id = uc.company_id
                    WHERE u.company_id = $1 AND uc.user_type = 'dormant'
                `;
                break;
            case 'birthday':
                // Получаем пользователей с днем рождения в текущем месяце из mini-app
                const currentMonth = new Date().getMonth() + 1; // PostgreSQL months are 1-12
                userQuery = `
                    SELECT u.vk_id, u.name, u.company_id
                    FROM users u
                    WHERE u.company_id = $1 
                    AND EXTRACT(MONTH FROM u.birthday) = $2
                `;
                break;
            default: // all
                userQuery = `
                    SELECT vk_id, name, company_id
                    FROM users
                    WHERE company_id = $1
                `;
        }
        
        // Для birthday передаем дополнительный параметр - месяц
        const queryParams = audience === 'birthday' ? [companyId, currentMonth] : [companyId];
        const result = await query(userQuery, queryParams);
        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения пользователей по сегменту:', error);
        throw error;
    }
}

// Выполнение кампании (отправка уведомлений через бота)
async function executeCampaign(campaignId) {
    try {
        const campaignResult = await query(
            `SELECT * FROM notification_campaigns WHERE id = $1`,
            [campaignId]
        );
        
        if (campaignResult.rows.length === 0) {
            throw new Error('Кампания не найдена');
        }
        
        const campaign = campaignResult.rows[0];
        const users = await getUsersBySegment(campaign.company_id, campaign.audience);
        
        // Сохраняем в историю рассылок
        await query(
            `INSERT INTO notifications (company_id, title, message, audience, status, sent_count, sent_at, image_url)
             VALUES ($1, $2, $3, $4, 'sent', $5, NOW(), $6)`,
            [campaign.company_id, campaign.title, campaign.message, campaign.audience, users.length, campaign.image_url]
        );
        
        // Обновляем last_sent_at
        await query(
            `UPDATE notification_campaigns SET last_sent_at = NOW() WHERE id = $1`,
            [campaignId]
        );
        
        console.log(`🤖 Кампания выполнена: ${campaign.name} (${users.length} пользователей)`);
        
        return {
            success: true,
            campaign: campaign,
            users: users.map(u => ({ vk_id: u.vk_id, name: u.name })),
            sentCount: users.length,
            image_url: campaign.image_url,
            button_link: campaign.button_link,
            button_text: campaign.button_text || 'Перейти'
        };
    } catch (error) {
        console.error('❌ Ошибка выполнения кампании:', error);
        throw error;
    }
}


// Сохранение отправленного уведомления в историю
async function saveNotificationToHistory(companyId, title, message, audience, sentCount, imageUrl = null) {
    try {
        const result = await query(
            `INSERT INTO notifications (company_id, title, message, audience, status, sent_count, sent_at, image_url)
             VALUES ($1, $2, $3, $4, 'sent', $5, NOW(), $6)
             RETURNING *`,
            [companyId, title, message, audience, sentCount, imageUrl]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Ошибка сохранения истории:', error);
        return null;
    }
}

// Добавьте эти функции в database-pg.js после существующих

// ============ API ДЛЯ ГОРОДОВ И АДРЕСОВ ============

// Создание таблиц городов и адресов
async function initLocationTables() {
    try {
        // Таблица городов
        await query(`
            CREATE TABLE IF NOT EXISTS cities (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(company_id, name)
            )
        `);
        
        // Таблица адресов
        await query(`
            CREATE TABLE IF NOT EXISTS addresses (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
                address TEXT NOT NULL,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                phone VARCHAR(50),
                working_hours TEXT,
                is_main BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Таблица выбранных локаций пользователей (ДОБАВИТЬ СЮДА)
        await query(`
            CREATE TABLE IF NOT EXISTS user_selected_locations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                selected_address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, company_id)
            )
        `);
        
        console.log('✅ Таблицы городов, адресов и выбранных локаций созданы/проверены');
    } catch (error) {
        console.error('❌ Ошибка создания таблиц локаций:', error);
    }
}

// Получить все города компании
async function getCities(companyId) {
    const result = await query(
        'SELECT * FROM cities WHERE company_id = $1 AND is_active = true ORDER BY sort_order, name',
        [companyId]
    );
    return result.rows;
}

// Получить город по ID
async function getCityById(cityId) {
    const result = await query('SELECT * FROM cities WHERE id = $1', [cityId]);
    return result.rows[0];
}

// Добавить город
async function addCity(companyId, name, sortOrder = 0) {
    const result = await query(
        `INSERT INTO cities (company_id, name, sort_order) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (company_id, name) DO UPDATE SET 
            is_active = true, 
            updated_at = NOW()
         RETURNING *`,
        [companyId, name, sortOrder]
    );
    return result.rows[0];
}

// Обновить город
async function updateCity(cityId, name, isActive, sortOrder) {
    const result = await query(
        `UPDATE cities 
         SET name = $1, is_active = $2, sort_order = $3, updated_at = NOW()
         WHERE id = $4 
         RETURNING *`,
        [name, isActive, sortOrder, cityId]
    );
    return result.rows[0];
}

// Удалить город (мягкое удаление)
async function deleteCity(cityId) {
    await query('UPDATE cities SET is_active = false WHERE id = $1', [cityId]);
    // Также деактивируем связанные адреса
    await query('UPDATE addresses SET is_active = false WHERE city_id = $1', [cityId]);
    return true;
}

// Получить все адреса компании
async function getAddresses(companyId, cityId = null) {
    let queryText = `
        SELECT a.*, c.name as city_name 
        FROM addresses a
        LEFT JOIN cities c ON a.city_id = c.id
        WHERE a.company_id = $1 AND a.is_active = true
    `;
    const params = [companyId];
    
    if (cityId) {
        queryText += ` AND a.city_id = $2`;
        params.push(cityId);
    }
    
    queryText += ` ORDER BY a.is_main DESC, a.sort_order, a.address`;
    
    const result = await query(queryText, params);
    return result.rows;
}

// Получить адрес по ID
async function getAddressById(addressId) {
    const result = await query(
        `SELECT a.*, c.name as city_name 
         FROM addresses a
         LEFT JOIN cities c ON a.city_id = c.id
         WHERE a.id = $1`,
        [addressId]
    );
    return result.rows[0];
}

// Добавить адрес
async function addAddress(companyId, addressData) {
    const { cityId, address, latitude, longitude, phone, workingHours, isMain, sortOrder = 0 } = addressData;
    
    // Если этот адрес устанавливается как основной, сбрасываем флаг у других адресов
    if (isMain) {
        await query(
            'UPDATE addresses SET is_main = false WHERE company_id = $1',
            [companyId]
        );
    }
    
    const result = await query(
        `INSERT INTO addresses (company_id, city_id, address, latitude, longitude, phone, working_hours, is_main, sort_order) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [companyId, cityId || null, address, latitude || null, longitude || null, phone || null, workingHours || null, isMain || false, sortOrder]
    );
    return result.rows[0];
}

// Обновить адрес
async function updateAddress(addressId, addressData) {
    const { cityId, address, latitude, longitude, phone, workingHours, isMain, isActive, sortOrder } = addressData;
    
    // Если этот адрес устанавливается как основной, сбрасываем флаг у других адресов
    if (isMain) {
        const addr = await getAddressById(addressId);
        if (addr) {
            await query(
                'UPDATE addresses SET is_main = false WHERE company_id = $1',
                [addr.company_id]
            );
        }
    }
    
    const result = await query(
        `UPDATE addresses 
         SET city_id = $1, address = $2, latitude = $3, longitude = $4, 
             phone = $5, working_hours = $6, is_main = $7, is_active = $8, 
             sort_order = $9, updated_at = NOW()
         WHERE id = $10 
         RETURNING *`,
        [cityId || null, address, latitude || null, longitude || null, 
         phone || null, workingHours || null, isMain || false, isActive !== undefined ? isActive : true, 
         sortOrder || 0, addressId]
    );
    return result.rows[0];
}

// Удалить адрес (мягкое удаление)
async function deleteAddress(addressId) {
    await query('UPDATE addresses SET is_active = false WHERE id = $1', [addressId]);
    return true;
}

// Получить основную локацию (город + адрес) для отображения в mini-app
async function getMainLocation(companyId) {
    // Сначала пытаемся получить основной адрес
    let address = await query(
        `SELECT a.*, c.name as city_name 
         FROM addresses a
         LEFT JOIN cities c ON a.city_id = c.id
         WHERE a.company_id = $1 AND a.is_active = true AND a.is_main = true
         LIMIT 1`,
        [companyId]
    );
    
    if (address.rows.length > 0) {
        return {
            city: address.rows[0].city_name,
            address: address.rows[0].address,
            addressId: address.rows[0].id,
            phone: address.rows[0].phone,
            workingHours: address.rows[0].working_hours,
            latitude: address.rows[0].latitude,
            longitude: address.rows[0].longitude
        };
    }
    
    // Если нет основного адреса, берем первый активный
    address = await query(
        `SELECT a.*, c.name as city_name 
         FROM addresses a
         LEFT JOIN cities c ON a.city_id = c.id
         WHERE a.company_id = $1 AND a.is_active = true
         ORDER BY a.sort_order
         LIMIT 1`,
        [companyId]
    );
    
    if (address.rows.length > 0) {
        return {
            city: address.rows[0].city_name,
            address: address.rows[0].address,
            addressId: address.rows[0].id,
            phone: address.rows[0].phone,
            workingHours: address.rows[0].working_hours,
            latitude: address.rows[0].latitude,
            longitude: address.rows[0].longitude
        };
    }
    
    return null;
}

// Получить все локации для отображения в mini-app (для выбора города и адреса)
async function getAllLocationsForApp(companyId) {
    const cities = await getCities(companyId);
    const addresses = await getAddresses(companyId);
    
    // Группируем адреса по городам
    const locationsByCity = {};
    for (const city of cities) {
        locationsByCity[city.id] = {
            cityId: city.id,
            cityName: city.name,
            addresses: addresses.filter(a => a.city_id === city.id)
        };
    }
    
    // Добавляем адреса без города
    const addressesWithoutCity = addresses.filter(a => !a.city_id);
    if (addressesWithoutCity.length > 0) {
        locationsByCity['no_city'] = {
            cityId: null,
            cityName: 'Другие адреса',
            addresses: addressesWithoutCity
        };
    }
    
    return {
        cities: cities,
        addresses: addresses,
        locationsByCity: locationsByCity,
        mainLocation: await getMainLocation(companyId)
    };
}

// Обновить выбранную локацию пользователя
async function updateUserSelectedLocation(userId, companyId, addressId) {
    const result = await query(
        `INSERT INTO user_selected_locations (user_id, company_id, selected_address_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, company_id) 
         DO UPDATE SET selected_address_id = $3, updated_at = NOW()
         RETURNING *`,
        [userId, companyId, addressId]
    );
    return result.rows[0];
}

// Получить выбранную локацию пользователя
async function getUserSelectedLocation(userId, companyId) {
    const result = await query(
        `SELECT usl.*, a.address, a.city_id, c.name as city_name, a.phone, a.working_hours, a.latitude, a.longitude
         FROM user_selected_locations usl
         LEFT JOIN addresses a ON usl.selected_address_id = a.id
         LEFT JOIN cities c ON a.city_id = c.id
         WHERE usl.user_id = $1 AND usl.company_id = $2`,
        [userId, companyId]
    );
    
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    
    // Если нет выбранной локации, возвращаем основную
    return await getMainLocation(companyId);
}

// ========== CASHIER CREDENTIALS ==========

async function getCashierCredentials(companyId) {
    try {
        const result = await query(
            'SELECT login, password FROM cashier_credentials WHERE company_id = $1',
            [companyId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения данных кассира:', error);
        return null;
    }
}

async function findCashierByLogin(login) {
    try {
        const result = await query(
            `SELECT cc.company_id, cc.login, cc.password, c.name as company_name
             FROM cashier_credentials cc
             JOIN companies c ON cc.company_id = c.id
             WHERE cc.login = $1`,
            [login]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    } catch (error) {
        console.error('Ошибка поиска кассира по логину:', error);
        return null;
    }
}

async function saveGreetingSettings(companyId, greetingText, greetingEmoji, companyEmoji, fullGreetingText) {
    try {
        const result = await query(
            `UPDATE companies 
             SET settings = jsonb_set(
                 jsonb_set(
                     jsonb_set(
                         COALESCE(settings, '{}'::jsonb),
                         '{greeting}',
                         jsonb_build_object('text', $2::text, 'emoji', $3::text)
                     ),
                     '{company_emoji}',
                     to_jsonb($4::text)
                 ),
                 '{full_greeting_text}',
                 to_jsonb($5::text)
             )
             WHERE id = $1
             RETURNING id, settings`,
            [companyId, greetingText, greetingEmoji, companyEmoji || '🏢', fullGreetingText || '']
        );
        
        return result.rows[0];
    } catch (error) {
        console.error('Ошибка сохранения приветствия:', error);
        throw error;
    }
}

async function getGreetingSettings(companyId) {
    try {
        const result = await query(
            `SELECT 
                COALESCE(settings->'greeting'->>'text', 'Добро пожаловать!') as greeting_text,
                COALESCE(settings->'greeting'->>'emoji', '👋') as greeting_emoji,
                COALESCE(settings->>'company_emoji', '🏢') as company_emoji,
                COALESCE(settings->>'full_greeting_text', '') as full_greeting_text
             FROM companies 
             WHERE id = $1`,
            [companyId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return { 
            greeting_text: 'Добро пожаловать!', 
            greeting_emoji: '👋',
            company_emoji: '🏢',
            full_greeting_text: ''
        };
    } catch (error) {
        console.error('Ошибка получения приветствия:', error);
        return { 
            greeting_text: 'Добро пожаловать!', 
            greeting_emoji: '👋',
            company_emoji: '🏢',
            full_greeting_text: ''
        };
    }
}

async function saveCashierCredentials(companyId, login, password) {
    try {
        const result = await query(
            `INSERT INTO cashier_credentials (company_id, login, password, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (company_id) 
             DO UPDATE SET login = $2, password = $3, updated_at = NOW()
             RETURNING *`,
            [companyId, login, password]
        );
        
        return result.rows[0];
    } catch (error) {
        console.error('Ошибка сохранения данных кассира:', error);
        throw error;
    }
}
async function addUserProgressSpentColumn() {
    try {
        const checkColumn = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user_progress' AND column_name = 'total_spent'
        `);
        
        if (checkColumn.rows.length === 0) {
            console.log('📝 Добавляем колонку total_spent в таблицу user_progress...');
            await query(`ALTER TABLE user_progress ADD COLUMN total_spent INTEGER DEFAULT 0`);
            console.log('✅ Колонка total_spent добавлена в user_progress');
        }
    } catch (error) {
        console.error('Ошибка добавления total_spent в user_progress:', error);
    }
}
async function getUserFullData(userId, companyId) {
    try {
        // Получаем пользователя
        const userResult = await query(
            'SELECT * FROM users WHERE id = $1 AND company_id = $2',
            [userId, companyId]
        );
        
        if (userResult.rows.length === 0) return null;
        
        const user = userResult.rows[0];
        
        // Получаем прогресс пользователя
        const progressResult = await query(
            'SELECT * FROM user_progress WHERE user_id = $1 AND company_id = $2',
            [userId, companyId]
        );
        
        const progress = progressResult.rows[0] || {};
        
        // Получаем историю транзакций (последние 50)
        const historyResult = await query(
            `SELECT id, description, bonus_earned, bonus_spent, created_at, source
             FROM transactions 
             WHERE user_id = $1 AND company_id = $2 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId, companyId]
        );
        
        // Форматируем историю
        const history = historyResult.rows.map(t => ({
            id: t.id,
            desc: t.description,
            points: t.bonus_earned > 0 ? `+${t.bonus_earned}` : `-${t.bonus_spent}`,
            date: new Date(t.created_at).toLocaleString('ru-RU'),
            type: t.bonus_earned > 0 ? 'earn' : 'spend',
            source: t.source
        }));
        
        return {
            id: user.id,
            vk_id: user.vk_id,
            name: user.name,
            bonus_balance: user.bonus_balance || 0,
            total_earned: user.total_earned || 0,
            total_spent: user.total_spent || 0,
            regDate: new Date(user.created_at).toLocaleDateString('ru-RU'),
            lastDaily: progress.last_login_date,
            streak: progress.streak || 0,
            history: history
        };
    } catch (error) {
        console.error('Ошибка getUserFullData:', error);
        throw error;
    }
}



module.exports = {
    pool,
    query,
    initDatabase,
    addCompany,
    getCompanyByEmail,
    getAllCompanies,
    getCompanyById,
    getUserById,
    getUserByVkId,
    createUser,
    updateUserBalance,
    getPromotions,
    addPromotion,
    updatePromotion,
    deletePromotion,
    getQuests,
    addQuest,
    updateQuest,
    deleteQuest,
    completeUserQuest,
    getUserCompletedQuests,
    getUserProgress,
    updateUserProgress,
    updateQuestProgress,
    getAllUserQuestProgress,
    checkDailyBonusClaimed,
    claimDailyBonus,
    getCompanyTiers,
    updateCompanyTiers,
    getPresetQuests,
	getPresetPromotions,
	addPresetDataForCompany,
	getGameSettings,
	saveGameSettings,
	addGameSettingsTable,
    addGameSettingsColumns,
	getUserPurchaseHistory,
	addPurchaseTransaction,
	getUserTransactions,
	updateBalanceWithTransaction,
	addSpendTransaction,
	getDailyBonusSettings,
	updateDailyBonusSettings,
    updateUserBirthday,
    getUserBirthday,
    purchasePromotion,
    getUserPurchasedPromotions,
    hasUserPurchasedPromotion,
    usePurchasedPromotion,
    checkPromotionCycle,
	addQuestColumns,
	checkAndResetQuests,
    trackPurchaseProgress,
    trackPromotionUsage,
    resetQuestProgress,
    // Giveaways
    getGiveaways,
    addGiveaway,
    updateGiveaway,
    deleteGiveaway,
    // User Classification
    initializeUserClassification,
    updateUserClassification,
    recalculateUserType,
    getUserClassification,
    getAllUsersClassification,
    getUsersByType,
    getClassificationStats,
	addGiveawayColumns,
	hasUserPurchasedGiveaway,
	purchaseGiveaway,
	migrateGiveawaysTable,
    getRealAnalytics,
    recalculateAllUsersClassification,
	addStreakColumns,
	addBonusSettingsColumn,
    // Notifications
    sendNotification,
    getNotificationHistory,
    getNotificationCampaigns,
    addNotificationCampaign,
    updateNotificationCampaign,
    deleteNotificationCampaign,
    toggleNotificationCampaign,
    getActiveCampaigns,
    getUsersBySegment,
    executeCampaign,
	saveNotificationToHistory,
	initLocationTables,
    getCities,
    addCity,
    updateCity,
    deleteCity,
    getAddresses,
    getAddressById,
    addAddress,
    updateAddress,
    deleteAddress,
    getAllLocationsForApp,
    getUserSelectedLocation,
    updateUserSelectedLocation,
    getMainLocation,
    // Cashier credentials
    getCashierCredentials,
    saveCashierCredentials,
    findCashierByLogin,
	addUserProgressSpentColumn,
	getUserFullData,
    // Greeting settings
    saveGreetingSettings,
    getGreetingSettings
};