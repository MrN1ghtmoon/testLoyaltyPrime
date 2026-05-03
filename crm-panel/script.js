// ========== УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ ==========
function openModal(type) {
    const modal = document.getElementById(type + 'Modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + 'Modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        
        if (type === 'promotion') {
            // Сбрасываем все поля
            const nameInput = document.getElementById('promoName');
            const emojiSelect = document.getElementById('promoEmoji');
            
            if (nameInput) {
                nameInput.disabled = false;
                nameInput.style.background = '';
                nameInput.style.cursor = '';
                nameInput.value = '';
            }
            if (emojiSelect) {
                emojiSelect.disabled = false;
                emojiSelect.style.background = '';
                emojiSelect.style.cursor = '';
                emojiSelect.value = '🎯';
            }
            
            // Очищаем обработчики
            const bonusInput = document.getElementById('promoBonusValue');
            if (bonusInput) bonusInput.oninput = null;
            
            const discountInput = document.getElementById('promoDiscountValue');
            if (discountInput) discountInput.oninput = null;
            
            const rewardTypeSelect = document.getElementById('promoRewardType');
            if (rewardTypeSelect) rewardTypeSelect.onchange = null;
            
            // Сбрасываем переменные
            cleanPromoDescription = '';
            currentEditingPromotionId = null;
            
            // Очищаем предпросмотр
            const previewDiv = document.getElementById('promoDescriptionPreview');
            if (previewDiv) previewDiv.innerHTML = '';
        }
        
        if (type === 'quest') {
            // Сбрасываем поля задания
            const titleInput = document.getElementById('questTitle');
            const descInput = document.getElementById('questDesc');
            const rewardInput = document.getElementById('questReward');
            const activeCheckbox = document.getElementById('questActive');
            const endDateInput = document.getElementById('questEndDate');
            const modalTitle = document.getElementById('questModalTitle');
            
            if (titleInput) {
                titleInput.disabled = false;
                titleInput.style.background = '';
                titleInput.style.cursor = '';
                titleInput.value = '';
            }
            if (descInput) {
                descInput.disabled = false;
                descInput.style.background = '';
                descInput.style.cursor = '';
                descInput.value = '';
            }
            if (rewardInput) rewardInput.value = 10;
            if (activeCheckbox) activeCheckbox.checked = true;
            if (endDateInput) endDateInput.value = '';
            if (modalTitle) modalTitle.textContent = 'Добавить задание';
            
            currentEditingQuestId = null;
        }
    }
}

function switchToRegister() {
    closeModal('login');
    openModal('register');
}

function switchToLogin() {
    closeModal('register');
    openModal('login');
}

function toggleFaq(element) {
    const item = element.closest('.faq-item');
    if (item) {
        item.classList.toggle('active');
        const span = element.querySelector('span');
        if (span) span.textContent = item.classList.contains('active') ? '−' : '+';
    }
}

// ========== ОТПРАВКА ДЕМО-ЗАЯВКИ НА ПОЧТУ ==========
async function submitDemo() {
    const brandName = document.getElementById('demoBrand')?.value;
    const email = document.getElementById('demoEmail')?.value;
    
    if (!brandName || !email) {
        alert('Пожалуйста, заполните оба поля');
        return;
    }
    
    if (!email.includes('@')) {
        alert('Пожалуйста, введите корректный email');
        return;
    }
    
    const button = document.querySelector('.cta-button');
    const originalText = button.textContent;
    button.textContent = '⏳ Отправка...';
    button.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/api/demo-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandName, email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Спасибо! Заявка отправлена. Мы свяжемся с вами в ближайшее время.');
            document.getElementById('demoBrand').value = '';
            document.getElementById('demoEmail').value = '';
        } else {
            alert('❌ ' + (data.message || 'Ошибка отправки. Попробуйте позже.'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Не удалось отправить заявку. Проверьте подключение к интернету.');
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// ========== CRM PANEL DATA ==========
let currentBusiness = null;
let notificationsHistory = [];
let tiers = [];


let promotions = [];
let questsManager = [];
let currentEditingQuestId = null;
let currentEditingPromotionId = null;
let presetQuestsList = [];
let giveaways = [];
let currentEditingGiveawayId = null;

const API_URL = 'http://localhost:3001';

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С COOKIE ==========
function setCookie(name, value, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
    console.log('🍪 Cookie saved:', name, '=', value);
}

function getCookie(name) {
    const value = document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
    console.log('🍪 Cookie read:', name, '=', value);
    return value;
}

function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    console.log('🍪 Cookie deleted:', name);
}

// Fallback to localStorage if cookies don't work (file:// protocol)
function setStorage(name, value, days = 7) {
    const expires = Date.now() + days * 864e5;
    const data = { value, expires };
    localStorage.setItem('crm_' + name, JSON.stringify(data));
    console.log('💾 LocalStorage saved:', name, '=', value);
}

function getStorage(name) {
    const dataStr = localStorage.getItem('crm_' + name);
    if (!dataStr) return null;
    
    try {
        const data = JSON.parse(dataStr);
        if (Date.now() > data.expires) {
            localStorage.removeItem('crm_' + name);
            console.log('💾 LocalStorage expired:', name);
            return null;
        }
        console.log('💾 LocalStorage read:', name, '=', data.value);
        return data.value;
    } catch (e) {
        return null;
    }
}

function deleteStorage(name) {
    localStorage.removeItem('crm_' + name);
    console.log('💾 LocalStorage deleted:', name);
}

// Проверка сохраненной сессии при загрузке страницы
async function checkSavedSession() {
    console.log('🔍 Checking saved session...');
    
    // Пробуем cookies first
    let savedCompanyId = getCookie('crm_company_id');
    
    // Если cookies не работают, пробуем localStorage
    if (!savedCompanyId) {
        savedCompanyId = getStorage('company_id');
    }
    
    if (savedCompanyId) {
        try {
            console.log('🔍 Found saved company ID:', savedCompanyId);
            // Проверяем, что компания все еще существует
            const response = await fetch(`${API_URL}/api/companies/list`);
            const companies = await response.json();
            
            const company = companies.find(c => c.id === parseInt(savedCompanyId));
            
            if (company) {
                console.log('✅ Восстановлена сессия для:', company.company || company.name);
                currentBusiness = company;
                loadCRMPanel();
                return true;
            } else {
                console.log('❌ Company not found in database');
            }
        } catch (error) {
            console.error('❌ Ошибка восстановления сессии:', error);
        }
        
        // Если сессия невалидна, очищаем
        deleteCookie('crm_company_id');
        deleteCookie('crm_company_name');
        deleteStorage('company_id');
        deleteStorage('company_name');
    } else {
        console.log('ℹ️ No saved session found');
    }
    
    return false;
}

// Сохранение сессии при входе
function saveSession(company) {
    console.log('💾 Saving session for:', company.company || company.name);
    setCookie('crm_company_id', company.id, 7); // 7 дней
    setCookie('crm_company_name', company.company || company.name, 7);
    
    // Fallback to localStorage
    setStorage('company_id', company.id, 7);
    setStorage('company_name', company.company || company.name, 7);
}

// Очистка сессии при выходе
function clearSession() {
    console.log('🗑️ Clearing session');
    deleteCookie('crm_company_id');
    deleteCookie('crm_company_name');
    deleteStorage('company_id');
    deleteStorage('company_name');
}

// ========== РЕГИСТРАЦИЯ И ВХОД ==========
function openCRMLogin() { openModal('login'); }
function openCRMRegister() { openModal('register'); }

async function handleCRMRegister() {
    const company = document.getElementById('registerCompany').value;
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    const errorElement = document.getElementById('registerError');
    
    if (!company || !name || !email || !phone || !password || !confirm) {
        errorElement.textContent = 'Заполните все поля';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    if (password !== confirm) {
        errorElement.textContent = 'Пароли не совпадают';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен быть не менее 6 символов';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/companies/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company, name, email, phone, password,
                brandColor: '#2A4B7C',
                description: `Добро пожаловать в ${company}!`
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Регистрация успешна! Теперь вы можете войти в CRM.');
            closeModal('register');
            openModal('login');
        } else {
            errorElement.textContent = data.message || 'Ошибка регистрации';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 3000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorElement.textContent = 'Сервер не доступен. Убедитесь, что backend запущен на порту 3001';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
    }
}

async function handleCRMLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    
    if (!email || !password) {
        errorElement.textContent = 'Заполните все поля';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/companies/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (data.success) {
            currentBusiness = data.company;
            saveSession(data.company); // Сохраняем сессию в cookie
            closeModal('login');
            loadCRMPanel();
        } else {
            errorElement.textContent = 'Неверный email или пароль';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 3000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorElement.textContent = 'Сервер не доступен. Проверьте подключение к бэкенду.';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
    }
}

// ========== CRM ПАНЕЛЬ ==========
async function loadCRMPanel() {
    document.getElementById('mainSite').style.display = 'none';
    document.getElementById('crmPanel').style.display = 'block';
    document.body.style.background = '#f0f2f5';
    document.body.classList.add('crm-open');
    
    const businessInfo = document.getElementById('businessInfo');
    if (businessInfo) {
        businessInfo.innerHTML = `
            <div class="business-name">${escapeHtml(currentBusiness.company || currentBusiness.name || 'Бизнес')}</div>
            <div class="business-email">${escapeHtml(currentBusiness.email || '')}</div>
        `;
    }
    
    await loadPresetQuests();
    await loadPromotionsAndQuestsFromDB();
    await loadGiveaways();
    await loadAnalytics('month');
    loadLoyaltySettings();
    await loadWheelSettings();
    await loadScratchSettings();
    await loadDiceSettings();  
    loadNotificationsHistory();
    await loadCampaigns();
    await loadBonusSettings();
	loadCitiesAndAddresses();
	await loadCashierCredentials();	
}

function closeCRMPanel() {
    document.getElementById('mainSite').style.display = 'block';
    document.getElementById('crmPanel').style.display = 'none';
    document.body.style.background = '#ffffff';
    document.body.classList.remove('crm-open');
    currentBusiness = null;
    clearSession(); // Очищаем сессию при выходе
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// ========== МОДУЛЬ 1: АНАЛИТИКА ==========
async function loadAnalytics(period = 'month') {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/analytics?period=${period}`);
        const data = await response.json();
        
        if (data.success && data.analytics) {
            const analytics = data.analytics;
            
            // Update stats grid with REAL data
            const statsGrid = document.getElementById('statsGrid');
            if (statsGrid) {
                const revenue = analytics.revenue || 0;
                const activeUsers = analytics.activeUsers || 0;
                const newUsers = analytics.newUsers || 0;
                const trend = analytics.revenueTrend || 0;
                
                const trendIcon = trend >= 0 ? '↑' : '↓';
                const trendClass = trend >= 0 ? 'up' : 'down';
                const trendValue = Math.abs(trend);
                
                statsGrid.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-icon">💰</div>
                        <div class="stat-info">
                            <div class="stat-value">${revenue.toLocaleString()} ₽</div>
                            <div class="stat-label">Выручка за период</div>
                            <div class="stat-trend ${trendClass}">${trendIcon} ${trendValue}%</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-info">
                            <div class="stat-value">${activeUsers}</div>
                            <div class="stat-label">Активных покупателей</div>
                            <div class="stat-trend up">Совершили покупки</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🆕</div>
                        <div class="stat-info">
                            <div class="stat-value">${newUsers}</div>
                            <div class="stat-label">Новых пользователей</div>
                            <div class="stat-trend up">Зарегистрировались</div>
                        </div>
                    </div>
                `;
            }
            
            // Update user segmentation with REAL classification data
            const segmentsList = document.getElementById('segmentsList');
            if (segmentsList) {
                const classif = analytics.classification || { new: 0, active: 0, regular: 0, dormant: 0, total: 0 };
                const total = classif.total || 0;
                
                const segments = [
                    { name: '🌱 Новичок', desc: '1 покупка, ≤14 дней', count: classif.new || 0, percent: total > 0 ? Math.round((classif.new / total) * 100) : 0, color: '#3498db' },
                    { name: '🔥 Активный', desc: '2+ покупок, ≤7 дней между', count: classif.active || 0, percent: total > 0 ? Math.round((classif.active / total) * 100) : 0, color: '#2ecc71' },
                    { name: '⭐ Постоянный', desc: '2+ покупок, ≤3 дней между', count: classif.regular || 0, percent: total > 0 ? Math.round((classif.regular / total) * 100) : 0, color: '#f39c12' },
                    { name: '😴 Спящий', desc: '1+ покупок, ≥20 дней', count: classif.dormant || 0, percent: total > 0 ? Math.round((classif.dormant / total) * 100) : 0, color: '#e74c3c' }
                ];
                
                segmentsList.innerHTML = segments.map(seg => `
                    <div class="segment-item">
                        <div class="segment-header">
                            <div class="segment-color" style="background-color: ${seg.color}"></div>
                            <div>
                                <div class="segment-name">${seg.name}</div>
                                <div style="font-size: 11px; color: #999; margin-top: 2px;">${seg.desc}</div>
                            </div>
                            <div class="segment-count">${seg.count} чел.</div>
                            <div class="segment-percent">${seg.percent}%</div>
                        </div>
                        <div class="segment-bar">
                            <div class="segment-fill" style="width: ${seg.percent}%; background-color: ${seg.color}"></div>
                        </div>
                    </div>
                `).join('');
            }
            
            // Update daily activity chart
            const activityChart = document.getElementById('activityChart');
            if (activityChart) {
                const dailyActivity = analytics.dailyActivity || [];
                
                if (dailyActivity.length > 0) {
                    const maxValue = Math.max(...dailyActivity.map(d => parseInt(d.transactions) || 0));
                    activityChart.innerHTML = `
                        <div class="activity-chart">
                            ${dailyActivity.slice(-14).map((day, i) => `
                                <div class="bar-container">
                                    <div class="bar" style="height: ${maxValue > 0 ? (parseInt(day.transactions) / maxValue) * 150 : 0}px">
                                        <span class="bar-value">${day.transactions}</span>
                                    </div>
                                    <div class="bar-label">${new Date(day.date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'})}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    // Показываем сообщение при отсутствии данных
                    activityChart.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #999;">
                            <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Нет данных активности</div>
                            <div style="font-size: 13px;">Покупки через POS терминал появятся здесь</div>
                        </div>
                    `;
                }
            }
            
            // Update top products
            const topProducts = document.getElementById('topProducts');
            if (topProducts) {
                const products = analytics.topProducts || [];
                const totalRevenue = analytics.revenue || 0;
                
                if (products.length > 0) {
                    topProducts.innerHTML = `
                        <div class="products-table">
                            <div class="table-header">
                                <div>Продукт</div>
                                <div>Продажи</div>
                                <div>Выручка</div>
                                <div>Доля</div>
                            </div>
                            ${products.map((p, i) => {
                                const items = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
                                const productName = Array.isArray(items) ? items.join(', ') : String(items);
                                const salesCount = parseInt(p.sales_count) || 0;
                                const revenue = parseInt(p.revenue) || 0;
                                const share = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
                                
                                return `
                                    <div class="table-row">
                                        <div class="product-name">
                                            <span class="product-rank">${i+1}</span> 
                                            ${productName.substring(0, 30)}${productName.length > 30 ? '...' : ''}
                                        </div>
                                        <div>${salesCount} шт.</div>
                                        <div>${revenue.toLocaleString()} ₽</div>
                                        <div>
                                            <div class="product-bar">
                                                <div class="product-fill" style="width: ${share}%"></div>
                                                <span>${share}%</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                } else {
                    // Показываем сообщение при отсутствии данных
                    topProducts.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #999;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🛒</div>
                            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Нет продаж</div>
                            <div style="font-size: 13px;">Продажи через POS терминал появятся здесь</div>
                        </div>
                    `;
                }
            }
        } else {
            console.warn('Аналитика не получена:', data);
        }
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
        // При ошибке показываем нули
        showEmptyAnalytics();
    }
}

// Показать пустую аналитику с нулями
function showEmptyAnalytics() {
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-info">
                    <div class="stat-value">0 ₽</div>
                    <div class="stat-label">Выручка за период</div>
                    <div class="stat-trend up">↑ 0%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-info">
                    <div class="stat-value">0</div>
                    <div class="stat-label">Активных покупателей</div>
                    <div class="stat-trend up">Совершили покупки</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🆕</div>
                <div class="stat-info">
                    <div class="stat-value">0</div>
                    <div class="stat-label">Новых пользователей</div>
                    <div class="stat-trend up">Зарегистрировались</div>
                </div>
            </div>
        `;
    }
    
    const segmentsList = document.getElementById('segmentsList');
    if (segmentsList) {
        segmentsList.innerHTML = `
            <div class="segment-item">
                <div class="segment-header">
                    <div class="segment-color" style="background-color: #3498db"></div>
                    <div>
                        <div class="segment-name">🌱 Новичок</div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">1 покупка, ≤14 дней</div>
                    </div>
                    <div class="segment-count">0 чел.</div>
                    <div class="segment-percent">0%</div>
                </div>
                <div class="segment-bar">
                    <div class="segment-fill" style="width: 0%; background-color: #3498db"></div>
                </div>
            </div>
            <div class="segment-item">
                <div class="segment-header">
                    <div class="segment-color" style="background-color: #2ecc71"></div>
                    <div>
                        <div class="segment-name">🔥 Активный</div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">2+ покупок, ≤7 дней между</div>
                    </div>
                    <div class="segment-count">0 чел.</div>
                    <div class="segment-percent">0%</div>
                </div>
                <div class="segment-bar">
                    <div class="segment-fill" style="width: 0%; background-color: #2ecc71"></div>
                </div>
            </div>
            <div class="segment-item">
                <div class="segment-header">
                    <div class="segment-color" style="background-color: #f39c12"></div>
                    <div>
                        <div class="segment-name">⭐ Постоянный</div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">2+ покупок, ≤3 дней между</div>
                    </div>
                    <div class="segment-count">0 чел.</div>
                    <div class="segment-percent">0%</div>
                </div>
                <div class="segment-bar">
                    <div class="segment-fill" style="width: 0%; background-color: #f39c12"></div>
                </div>
            </div>
            <div class="segment-item">
                <div class="segment-header">
                    <div class="segment-color" style="background-color: #e74c3c"></div>
                    <div>
                        <div class="segment-name">😴 Спящий</div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">1+ покупок, ≥20 дней</div>
                    </div>
                    <div class="segment-count">0 чел.</div>
                    <div class="segment-percent">0%</div>
                </div>
                <div class="segment-bar">
                    <div class="segment-fill" style="width: 0%; background-color: #e74c3c"></div>
                </div>
            </div>
        `;
    }
}

// ========== МОДУЛЬ 2: ЛОЯЛЬНОСТЬ (УРОВНИ) ==========
async function loadTiersSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/tiers`);
        const data = await response.json();
        
        if (data.success && data.tiers && data.tiers.length > 0) {
            tiers = data.tiers;
            renderTiersSettings();
        } else {
            tiers = [
                { name: "🌱 Новичок", threshold: 0, multiplier: 1, cashback: 3, color: "#95a5a6", icon: "🌱" },
                { name: "🥉 Бронза", threshold: 500, multiplier: 1.2, cashback: 5, color: "#cd7f32", icon: "🥉" },
                { name: "🥈 Серебро", threshold: 2000, multiplier: 1.5, cashback: 7, color: "#bdc3c7", icon: "🥈" },
                { name: "🥇 Золото", threshold: 8000, multiplier: 2, cashback: 10, color: "#f1c40f", icon: "🥇" },
                { name: "💎 Бриллиант", threshold: 20000, multiplier: 2.5, cashback: 15, color: "#00b4d8", icon: "💎" }
            ];
            renderTiersSettings();
        }
    } catch (error) {
        console.error('Ошибка загрузки уровней:', error);
        renderTiersSettings();
    }
}

function renderTiersSettings() {
    const container = document.getElementById('tiersSettingsList');
    if (!container) return;
    
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
    
    container.innerHTML = sortedTiers.map((tier, idx) => `
        <div class="tier-config-item" style="border-left: 4px solid ${tier.color}">
            <div class="tier-config-header">
                <div class="tier-config-title">
                    <div class="tier-icon-preview" style="background: ${tier.color}20; border-radius: 12px; padding: 4px 8px;">
                        <span style="font-size: 20px;">${tier.icon || '⭐'}</span>
                        <input type="text" value="${escapeHtml(tier.name)}" 
                               onchange="updateTierConfig(${idx}, 'name', this.value)" 
                               class="tier-name-input"
                               style="width: 120px; margin-left: 8px;">
                    </div>
                    <input type="color" value="${tier.color}" 
                           onchange="updateTierConfig(${idx}, 'color', this.value)" 
                           class="tier-color-input">
                    <select onchange="updateTierConfig(${idx}, 'icon', this.value)" class="tier-icon-select">
                        ${getIconOptions(tier.icon)}
                    </select>
                </div>
                <button class="btn-remove" onclick="removeTierConfig(${idx})" ${sortedTiers.length <= 1 ? 'disabled style="opacity:0.5"' : ''}>🗑️</button>
            </div>
            
            <div class="tier-config-fields">
                <div class="config-field">
                    <label>💰 Порог LTV (бонусов или ₽):</label>
                    <input type="number" value="${tier.threshold}" 
                           onchange="updateTierConfig(${idx}, 'threshold', parseInt(this.value))" 
                           class="config-input">
                </div>
                
                <!-- ИСПРАВЛЕНО: убрали multiplier, оставили только cashback -->
                <div class="config-field">
                    <label>💰 Кешбэк (% начисления):</label>
                    <input type="number" step="0.5" value="${tier.cashback || 3}" 
                           onchange="updateTierConfig(${idx}, 'cashback', parseFloat(this.value))" 
                           class="config-input">
                    <small style="display: block; margin-top: 4px; color: #666;">Процент от суммы покупки, который начисляется бонусами</small>
                </div>
            </div>
            
            <div class="tier-preview">
                <div style="background: ${tier.color}; padding: 8px 12px; border-radius: 12px; color: white;">
                    ${tier.icon} ${escapeHtml(tier.name)}: кешбэк ${tier.cashback || 3}% • порог ${tier.threshold.toLocaleString()}
                </div>
            </div>
        </div>
    `).join('');
}


function getIconOptions(selectedIcon) {
    const icons = ['🌱', '🥉', '🥈', '🥇', '💎', '⭐', '🏆', '👑', '🔥', '⚡', '🎯'];
    return icons.map(icon => `<option value="${icon}" ${selectedIcon === icon ? 'selected' : ''}>${icon}</option>`).join('');
}

function updateTierConfig(index, field, value) {
    if (tiers[index]) {
        tiers[index][field] = value;
        renderTiersSettings();
        if (window.tiersSaveTimeout) clearTimeout(window.tiersSaveTimeout);
        window.tiersSaveTimeout = setTimeout(() => saveTiersToServer(), 1000);
    }
}

function addTierConfig() {
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
    const lastTier = sortedTiers[sortedTiers.length - 1];
    const newThreshold = lastTier ? lastTier.threshold + 5000 : 1000;
    // ИСПРАВЛЕНО: убрали multiplier
    const newCashback = lastTier ? Math.min(30, lastTier.cashback + 2) : 3;
    
    tiers.push({
        name: `Уровень ${tiers.length + 1}`,
        threshold: newThreshold,
        cashback: newCashback,
        color: getNextColor(tiers.length),
        icon: getNextIcon(tiers.length)
    });
    renderTiersSettings();
    saveTiersToServer();
}

function getNextColor(index) {
    const colors = ['#95a5a6', '#cd7f32', '#bdc3c7', '#f1c40f', '#00b4d8', '#9b59b6', '#e74c3c', '#2ecc71', '#e67e22', '#1abc9c'];
    return colors[index % colors.length];
}

function getNextIcon(index) {
    const icons = ['🌱', '🥉', '🥈', '🥇', '💎', '⭐', '🏆', '👑', '🔥', '⚡'];
    return icons[index % icons.length];
}

function removeTierConfig(index) {
    if (tiers.length <= 1) {
        alert('❌ Нельзя удалить последний уровень');
        return;
    }
    if (confirm(`Удалить уровень "${tiers[index].name}"?`)) {
        tiers.splice(index, 1);
        renderTiersSettings();
        saveTiersToServer();
    }
}

async function saveTiersToServer() {
    if (!currentBusiness) return;
    
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/tiers`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tiers: sortedTiers })
        });
        
        const data = await response.json();
        if (data.success) {
            showSaveIndicator();
        }
    } catch (error) {
        console.error('Ошибка сохранения уровней:', error);
    }
}

function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 1500);
    }
}

function loadLoyaltySettings() {
    loadTiersSettings();
}

function saveLoyaltySettings() {
    saveTiersToServer();
    alert('✅ Настройки сохранены!');
}

// ========== МОДУЛЬ 3: УВЕДОМЛЕНИЯ ==========
function sendNotification() {
    const type = document.getElementById('notifType')?.value || 'Push';
    const segment = document.getElementById('notifSegment')?.value || 'all';
    const title = document.getElementById('notifTitle')?.value || '';
    const message = document.getElementById('notifMessage')?.value || '';
    
    if (!title || !message) {
        alert('Заполните заголовок и сообщение');
        return;
    }
    
    const notification = { 
        id: Date.now(), 
        type, 
        segment, 
        title, 
        message, 
        date: new Date().toLocaleString(), 
        status: 'sent' 
    };
    notificationsHistory.unshift(notification);
    if (notificationsHistory.length > 20) notificationsHistory.pop();
    loadNotificationsHistory();
    
    document.getElementById('notifTitle').value = '';
    document.getElementById('notifMessage').value = '';
    alert(`✅ Уведомление отправлено!\nАудитория: ${getSegmentName(segment)}`);
}

function getSegmentName(segment) {
    const segments = { 'all':'Все', 'active':'Активные', 'sleeping':'Спящие', 'vip':'VIP', 'new':'Новые' };
    return segments[segment] || segment;
}

async function sendDirectMessage() {
    if (!currentBusiness) {
        alert('❌ Ошибка: компания не выбрана');
        return;
    }
    
    const segment = document.getElementById('notifSegment')?.value || 'all';
    const title = document.getElementById('notifTitle')?.value || '';
    const message = document.getElementById('notifMessage')?.value || '';
    const imageUrl = document.getElementById('notifImageUrl')?.value || null;
    const buttonLink = document.getElementById('notifButtonLink')?.value || null;
    const buttonText = document.getElementById('notifButtonText')?.value || 'Перейти';
    
    if (!title || !message) {
        alert('❌ Заполните заголовок и текст сообщения');
        return;
    }
    
    const segmentNames = {
        'all': '📊 Все пользователи',
        'new': '🌱 Новичок',
        'active': '🔥 Активный',
        'regular': '⭐ Постоянный',
        'dormant': '😴 Спящий'
    };
    
    const segmentName = segmentNames[segment] || segment;
    
    // Предпросмотр
    let previewMessage = `📨 Рассылка сообщения\n\n`;
    previewMessage += `👥 Аудитория: ${segmentName}\n`;
    previewMessage += `📝 Заголовок: ${title}\n\n`;
    previewMessage += `💬 Текст:\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\n\n`;
    if (buttonLink) previewMessage += `🔗 Кнопка: ${buttonText} → ${buttonLink}\n`;
    previewMessage += `\nОтправить?`;
    
    if (!confirm(previewMessage)) {
        return;
    }
    
    const sendBtn = event.target;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = '⏳ Отправка...';
    sendBtn.disabled = true;
    
    try {
        // Получаем пользователей выбранного сегмента
        const usersResponse = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/users/segment/${segment}`);
        const usersData = await usersResponse.json();
        
        if (!usersData.success) {
            throw new Error('Не удалось получить пользователей');
        }
        
        const users = usersData.users || [];
        
        if (users.length === 0) {
            alert(`❌ В выбранном сегменте нет пользователей`);
            sendBtn.textContent = originalText;
            sendBtn.disabled = false;
            return;
        }
        
        // Отправляем запрос на backend для рассылки
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                audience: segment, 
                title, 
                message,
                image_url: imageUrl,
                button_link: buttonLink,
                button_text: buttonText
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Рассылка отправлена!\n\n📨 Получателей: ${data.sentCount || users.length} пользователей\n👥 Аудитория: ${segmentName}`);
            
            // Очищаем поля
            document.getElementById('notifTitle').value = '';
            document.getElementById('notifMessage').value = '';
            document.getElementById('notifImageUrl').value = '';
            document.getElementById('notifButtonLink').value = '';
            document.getElementById('notifButtonText').value = '';
            
            // Обновляем историю
            await loadNotificationsHistory();
        } else {
            alert('❌ Ошибка отправки: ' + (data.message || data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        alert('❌ Ошибка подключения к серверу: ' + error.message);
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
    }
}

// ========== УПРАВЛЕНИЕ КАМПАНИЯМИ ==========

let currentEditingCampaignId = null;

async function loadCampaigns() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/campaigns`);
        const data = await response.json();
        
        if (data.success) {
            renderCampaignsList(data.campaigns);
        }
    } catch (error) {
        console.error('Ошибка загрузки кампаний:', error);
    }
}

function renderCampaignsList(campaigns) {
    const container = document.getElementById('campaignsList');
    if (!container) return;
    
    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">📭 Нет кампаний. Создайте первую!</div>';
        return;
    }
    
    const audienceNames = {
        'all': 'Все',
        'new': 'Новичок',
        'active': 'Активный',
        'regular': 'Постоянный',
        'dormant': 'Спящий',
        'birthday': 'День рождения'
    };
    
    container.innerHTML = campaigns.map(campaign => {
        const lastSent = campaign.last_sent_at ? new Date(campaign.last_sent_at).toLocaleString('ru-RU') : 'Не отправлялась';
        const isActive = campaign.is_active;
        
        return `
            <div style="margin-bottom: 16px; padding: 16px; background: ${isActive ? '#f0fff4' : '#f8f9fa'}; border-radius: 12px; border-left: 4px solid ${isActive ? '#2ecc71' : '#95a5a6'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
                            ${campaign.is_default ? '📦 ' : ''}${escapeHtml(campaign.name)}
                            ${campaign.is_default ? '<span style="font-size: 11px; background: #3498db; color: white; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">Шаблон</span>' : ''}
                        </div>
                        <div style="font-size: 13px; color: #555; margin-bottom: 4px;">📨 ${escapeHtml(campaign.title)}</div>
                        <div style="font-size: 12px; color: #888;">
                            👥 ${audienceNames[campaign.audience] || campaign.audience} • 
                            ⏰ Раз в ${campaign.interval_days || 1} ${getDaysWord(campaign.interval_days || 1)}
                            ${campaign.image_url ? ' • 🖼️ С картинкой' : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 12px; padding: 4px 12px; border-radius: 20px; background: ${isActive ? '#2ecc71' : '#95a5a6'}; color: white; font-weight: 600;">
                            ${isActive ? '✅ Включена' : '❌ Выключена'}
                        </span>
                    </div>
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                    🕐 Последняя отправка: ${lastSent}
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button onclick="editCampaign(${campaign.id})" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">✏️ Редактировать</button>
                    <button onclick="toggleCampaign(${campaign.id}, ${!isActive})" style="padding: 8px 16px; background: ${isActive ? '#e74c3c' : '#2ecc71'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">
                        ${isActive ? '⏸️ Выключить' : '▶️ Включить'}
                    </button>
                    ${!campaign.is_default ? `<button onclick="deleteCampaign(${campaign.id})" style="padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">🗑️ Удалить</button>` : ''}
                    <button onclick="sendCampaignNow(${campaign.id})" style="padding: 8px 16px; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">🚀 Отправить сейчас</button>
                </div>
            </div>
        `;
    }).join('');
}

function getDaysWord(days) {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
}

function showAddCampaignModal() {
    currentEditingCampaignId = null;
    document.getElementById('campaignModalTitle').textContent = '➕ Создать кампанию';
    document.getElementById('campaignName').value = '';
    document.getElementById('campaignAudience').value = 'all';
    document.getElementById('campaignTitle').value = '';
    document.getElementById('campaignMessage').value = '';
    document.getElementById('campaignImageUrl').value = '';
    document.getElementById('campaignButtonLink').value = '';
    document.getElementById('campaignButtonText').value = '';
    document.getElementById('campaignInterval').value = '7';
    document.getElementById('campaignActive').checked = false;
    document.getElementById('campaignSendNow').checked = false;
    document.getElementById('campaignError').style.display = 'none';
    
    // Show interval field by default
    document.getElementById('campaignIntervalGroup').style.display = 'block';
    
    document.getElementById('campaignModal').style.display = 'flex';
    
    // Add event listener for audience change
    document.getElementById('campaignAudience').onchange = function() {
        const audience = this.value;
        const intervalGroup = document.getElementById('campaignIntervalGroup');
        
        if (audience === 'birthday') {
            // Hide interval for birthday campaigns
            intervalGroup.style.display = 'none';
        } else {
            // Show interval for other campaigns
            intervalGroup.style.display = 'block';
        }
    };
}

function closeCampaignModal() {
    document.getElementById('campaignModal').style.display = 'none';
}

async function editCampaign(campaignId) {
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/campaigns`);
        const data = await response.json();
        
        if (data.success) {
            const campaign = data.campaigns.find(c => c.id === campaignId);
            if (!campaign) return;
            
            currentEditingCampaignId = campaignId;
            document.getElementById('campaignModalTitle').textContent = '✏️ Редактировать кампанию';
            document.getElementById('campaignName').value = campaign.name;
            document.getElementById('campaignAudience').value = campaign.audience;
            document.getElementById('campaignTitle').value = campaign.title;
            document.getElementById('campaignMessage').value = campaign.message;
            document.getElementById('campaignImageUrl').value = campaign.image_url || '';
            document.getElementById('campaignButtonLink').value = campaign.button_link || '';
            document.getElementById('campaignButtonText').value = campaign.button_text || '';
            document.getElementById('campaignInterval').value = campaign.interval_days || 7;
            document.getElementById('campaignActive').checked = campaign.is_active;
            document.getElementById('campaignSendNow').checked = false;
            document.getElementById('campaignError').style.display = 'none';
            
            // Hide/show interval based on audience
            const intervalGroup = document.getElementById('campaignIntervalGroup');
            if (campaign.audience === 'birthday') {
                intervalGroup.style.display = 'none';
            } else {
                intervalGroup.style.display = 'block';
            }
            
            document.getElementById('campaignModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Ошибка загрузки кампании:', error);
        alert('❌ Ошибка загрузки кампании');
    }
}

async function saveCampaign() {
    const name = document.getElementById('campaignName').value.trim();
    const audience = document.getElementById('campaignAudience').value;
    const title = document.getElementById('campaignTitle').value.trim();
    const message = document.getElementById('campaignMessage').value.trim();
    const imageUrl = document.getElementById('campaignImageUrl').value.trim() || null;
    const buttonLink = document.getElementById('campaignButtonLink').value.trim() || null;
    const buttonText = document.getElementById('campaignButtonText').value.trim() || 'Перейти';
    const intervalDays = audience === 'birthday' ? 1 : (parseInt(document.getElementById('campaignInterval').value) || 7);
    const isActive = document.getElementById('campaignActive').checked;
    const sendNow = document.getElementById('campaignSendNow').checked;
    
    if (!name || !title || !message) {
        const errorEl = document.getElementById('campaignError');
        errorEl.textContent = '❌ Заполните название, заголовок и сообщение';
        errorEl.style.display = 'block';
        return;
    }
    
    // Check if trying to create a second birthday campaign
    if (audience === 'birthday' && !currentEditingCampaignId) {
        // Load existing campaigns to check
        try {
            const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/campaigns`);
            const data = await response.json();
            
            if (data.success) {
                const hasBirthdayCampaign = data.campaigns.some(c => c.audience === 'birthday');
                if (hasBirthdayCampaign) {
                    const errorEl = document.getElementById('campaignError');
                    errorEl.textContent = '❌ Кампания дня рождения уже существует. Нельзя создать более одной.';
                    errorEl.style.display = 'block';
                    return;
                }
            }
        } catch (error) {
            console.error('Ошибка проверки кампаний:', error);
        }
    }
    
    try {
        const url = currentEditingCampaignId 
            ? `${API_URL}/api/campaigns/${currentEditingCampaignId}`
            : `${API_URL}/api/companies/${currentBusiness.id}/campaigns`;
        
        const method = currentEditingCampaignId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                title,
                message,
                audience,
                image_url: imageUrl,
                button_link: buttonLink,
                button_text: buttonText,
                interval_days: intervalDays,
                is_active: isActive
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Если нужно отправить сразу
            if (sendNow && isActive) {
                await sendCampaignNow(data.campaign.id || currentEditingCampaignId);
            }
            
            closeCampaignModal();
            await loadCampaigns();
            alert(`✅ Кампания ${currentEditingCampaignId ? 'обновлена' : 'создана'}!`);
        } else {
            const errorEl = document.getElementById('campaignError');
            errorEl.textContent = '❌ ' + (data.message || data.error);
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка сохранения кампании:', error);
        const errorEl = document.getElementById('campaignError');
        errorEl.textContent = '❌ Ошибка сохранения: ' + error.message;
        errorEl.style.display = 'block';
    }
}

async function toggleCampaign(campaignId, isActive) {
    try {
        const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/toggle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCampaigns();
            alert(isActive ? '✅ Кампания включена' : '⏸️ Кампания выключена');
        }
    } catch (error) {
        console.error('Ошибка переключения кампании:', error);
        alert('❌ Ошибка переключения кампании');
    }
}

async function deleteCampaign(campaignId) {
    if (!confirm('❓ Вы уверены, что хотите удалить эту кампанию?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/campaigns/${campaignId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCampaigns();
            alert('✅ Кампания удалена');
        }
    } catch (error) {
        console.error('Ошибка удаления кампании:', error);
        alert('❌ Ошибка удаления кампании');
    }
}

async function sendCampaignNow(campaignId) {
    if (!confirm('🚀 Отправить кампанию прямо сейчас?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/execute`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCampaigns();
            await loadNotificationsHistory();
            alert(`✅ Кампания отправлена ${data.sentCount || 0} пользователям`);
        } else {
            alert('❌ Ошибка отправки: ' + (data.message || data.error));
        }
    } catch (error) {
        console.error('Ошибка отправки кампании:', error);
        alert('❌ Ошибка отправки кампании');
    }
}


async function loadNotificationsHistory() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/notifications/history?limit=50`);
        const data = await response.json();
        
        if (data.success) {
            renderNotificationsHistory(data.history);
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
    }
}

function renderNotificationsHistory(history) {
    const container = document.getElementById('notificationsHistory');
    if (!container) return;
    
    const segmentNames = {
        'all': 'Все',
        'new': 'Новичок',
        'active': 'Активный',
        'regular': 'Постоянный',
        'dormant': 'Спящий'
    };
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">📭 Нет отправленных сообщений</div>';
        return;
    }
    
    container.innerHTML = history.map(notif => `
        <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 12px; border-left: 3px solid #ff4d4d;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(notif.title)}</div>
                    <div style="font-size: 13px; color: #555; margin-bottom: 8px;">${escapeHtml(notif.message.substring(0, 100))}${notif.message.length > 100 ? '...' : ''}</div>
                </div>
                <div style="font-size: 12px; color: #2ecc71; white-space: nowrap; margin-left: 12px;">✅ ${notif.sent_count || 0} чел.</div>
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 8px;">
                👥 ${segmentNames[notif.audience] || notif.audience} • ${new Date(notif.sent_at || notif.created_at).toLocaleString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// ========== МОДУЛЬ 4: МАРКЕТИНГ ==========

async function loadPresetQuests() {
    try {
        const response = await fetch(`${API_URL}/api/preset-quests`);
        const data = await response.json();
        if (data.success) {
            presetQuestsList = data.quests;
            const select = document.getElementById('questPresetSelect');
            if (select) {
                select.innerHTML = '<option value="">-- Выберите готовое задание --</option>' +
                    presetQuestsList.map(q => `<option value="${escapeHtml(q.title)}" data-emoji="${q.emoji}" data-desc="${escapeHtml(q.description)}" data-reward="${q.reward}">${q.emoji} ${q.title}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки предустановленных заданий:', error);
    }
}

function loadPresetQuest() {
    const select = document.getElementById('questPresetSelect');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.value) {
        document.getElementById('questTitle').value = selectedOption.value;
        document.getElementById('questDesc').value = selectedOption.getAttribute('data-desc') || '';
        document.getElementById('questReward').value = selectedOption.getAttribute('data-reward') || 10;
        const emoji = selectedOption.getAttribute('data-emoji') || '✅';
        const emojiSelect = document.getElementById('questEmoji');
        if (emojiSelect) {
            for (let i = 0; i < emojiSelect.options.length; i++) {
                if (emojiSelect.options[i].value === emoji) {
                    emojiSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
}

async function loadPromotionsAndQuestsFromDB() {
    if (!currentBusiness) return;
    const companyId = currentBusiness.id;
    
    try {
        const promotionsResponse = await fetch(`${API_URL}/api/promotions/${companyId}`);
        if (promotionsResponse.ok) {
            promotions = await promotionsResponse.json();
            promotions = promotions.map(p => ({
                ...p,
                reward_type: p.reward_type || 'bonus',
                reward_value: p.reward_value || (p.discount || 0)
            }));
        } else {
            promotions = [];
        }
        
        const questsResponse = await fetch(`${API_URL}/api/quests/${companyId}`);
        if (questsResponse.ok) {
            questsManager = await questsResponse.json();
        } else {
            questsManager = [];
        }
        
        // Важно: вызываем рендер после загрузки данных
        renderPromotionsList();
        renderQuestsManagerList();
    } catch (error) {
        console.error('Ошибка загрузки из БД:', error);
        promotions = [];
        questsManager = [];
        renderPromotionsList();
        renderQuestsManagerList();
    }
}

// ========== АКЦИИ ==========


function loadPresetPromotion() {
    const select = document.getElementById('promoPresetSelect');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.value) {
        document.getElementById('promoName').value = selectedOption.value;
        document.getElementById('promoDesc').value = selectedOption.getAttribute('data-desc') || '';
        const emoji = selectedOption.getAttribute('data-emoji') || '🎯';
        const emojiSelect = document.getElementById('promoEmoji');
        if (emojiSelect) {
            for (let i = 0; i < emojiSelect.options.length; i++) {
                if (emojiSelect.options[i].value === emoji) {
                    emojiSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
}
function renderPromotionsList() {
    const container = document.getElementById('promotionsList');
    if (!container) return;
    
    if (!promotions || promotions.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет акций. Акции создаются автоматически при регистрации компании.</div>';
        return;
    }
    
    container.innerHTML = promotions.map(promo => {
        const startDate = promo.start_date ? new Date(promo.start_date) : null;
        const endDate = promo.end_date ? new Date(promo.end_date) : null;
        const now = new Date();
        
        // Проверяем, указаны ли даты
        const hasDates = startDate && endDate;
        
        // Если даты не указаны - акция НЕ активна
        if (!hasDates) {
            return `
                <div class="promotion-item" style="opacity: 0.7; background: #f8f9fa;">
                    <div class="promotion-header">
                        <div class="promotion-emojis">${promo.emoji || '🎯'}</div>
                        <div class="promotion-name">${escapeHtml(promo.name)}</div>
                        <div class="promotion-reward" style="background:#ffd966; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">${promo.reward_type === 'bonus' ? `+${promo.reward_value} бонусов` : `${promo.reward_value}% скидка`}</div>
                        <div class="promotion-status inactive" style="background:#e2e3e5; color:#383d41;">❌ Неактивна</div>
                        <button class="btn-edit" onclick="editPromotion(${promo.id})" style="background:#17a2b8; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">✏️</button>
                    </div>
                    <div class="promotion-desc" style="font-size:13px; color:#e74c3c; margin:8px 0 4px 60px;">
                        ⚠️ Для активации акции необходимо указать дату начала и окончания!
                    </div>
                    <div class="promotion-dates" style="font-size:11px; color:#999; margin-left:60px;">
                        📅 Дата не указана
                    </div>
                </div>
            `;
        }
        
        // Проверяем, истекла ли акция (дата окончания в прошлом)
        const isExpired = endDate < now;
        
        // Проверяем, активна ли по датам (текущее время между start и end)
        const isActiveByDate = !isExpired && startDate <= now && endDate >= now;
        
        // Определяем статус
        let status = 'inactive';
        let statusText = '';
        
        if (isExpired) {
            status = 'expired';
            statusText = 'Истекла';
        } else if (promo.active && isActiveByDate) {
            status = 'active';
            statusText = 'Активна';
        } else if (promo.active && !isActiveByDate && startDate > now) {
            status = 'waiting';
            statusText = 'Ожидает дат';
        } else if (promo.active && !isActiveByDate && startDate <= now && endDate < now) {
            status = 'expired';
            statusText = 'Истекла';
        } else {
            status = 'inactive';
            statusText = 'Отключена';
        }
        
        const rewardType = promo.reward_type || 'bonus';
        const rewardValue = promo.reward_value || 0;
        const rewardText = rewardType === 'bonus' ? `+${rewardValue} бонусов` : `${rewardValue}% скидка`;
        
        // Показываем цену или бесплатную отметку
        const priceDisplay = promo.is_free 
            ? '<span style="background:#3498db; color:white; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">🎁 Бесплатная</span>'
            : `<span style="background:#9b59b6; color:white; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">💎 ${promo.price || 100} баллов</span>`;
        
        let displayDescription = promo.description || '';
        
        const formatDateTime = (date) => {
            if (!date) return 'не указана';
            return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        };
        
        return `
            <div class="promotion-item">
                <div class="promotion-header">
                    <div class="promotion-emojis">${promo.emoji || '🎯'}</div>
                    <div class="promotion-name">${escapeHtml(promo.name)}</div>
                    <div class="promotion-reward" style="background:#ffd966; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">${rewardText}</div>
                    ${priceDisplay}
                    <div class="promotion-status ${status}">${statusText}</div>
                    <button class="btn-edit" onclick="editPromotion(${promo.id})" style="background:#17a2b8; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">✏️</button>
                </div>
                <div class="promotion-desc" style="font-size:13px; color:#555; margin:8px 0 4px 60px;">${escapeHtml(displayDescription)}</div>
                <div class="promotion-dates" style="font-size:11px; color:#999; margin-left:60px;">
                    📅 ${formatDateTime(startDate)} → ${formatDateTime(endDate)}
                    ${status === 'waiting' ? '<span style="color:#f39c12; margin-left:8px;">⏳ Акция начнется позже</span>' : ''}
                    ${status === 'active' ? '<span style="color:#2ecc71; margin-left:8px;">✅ Активна сейчас</span>' : ''}
                    ${status === 'expired' ? '<span style="color:#e74c3c; margin-left:8px;">⏰ Акция завершена</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}
async function loadPresetPromotions() {
    try {
        const response = await fetch(`${API_URL}/api/preset-promotions`);
        const data = await response.json();
        if (data.success) {
            presetPromotionsList = data.promotions;
        }
    } catch (error) {
        console.error('Ошибка загрузки пресетов акций:', error);
    }
}

function showAddPromotionModal() {
    currentEditingPromotionId = null;
    
    // Очищаем поля
    document.getElementById('promoName').value = '';
    document.getElementById('promoName').disabled = false;
    document.getElementById('promoName').style.background = 'white';
    document.getElementById('promoName').style.cursor = 'text';
    document.getElementById('promoDescription').value = '';
    document.getElementById('promoProducts').value = '';
    document.getElementById('promoDiscountValue').value = 10;
    document.getElementById('promoIsFree').checked = false;
    document.getElementById('promoPrice').value = 100;
    document.getElementById('promoStartDate').value = '';
    document.getElementById('promoEndDate').value = '';
    document.getElementById('promoActive').checked = true;
    
    // Показываем поле цены
    document.getElementById('promoPriceField').style.display = 'block';
    document.getElementById('promoFreeNote').style.display = 'none';
    
    document.getElementById('promotionModalTitle').textContent = '➕ Создать новую акцию';
    document.getElementById('savePromotionBtn').textContent = '💾 Создать акцию';
    document.getElementById('deletePromotionBtn').style.display = 'none';
    
    openModal('promotion');
}

// Переключение поля цены при изменении "Бесплатная акция"
function togglePromoPriceField() {
    const isFree = document.getElementById('promoIsFree').checked;
    const priceField = document.getElementById('promoPriceField');
    const freeNote = document.getElementById('promoFreeNote');
    
    if (isFree) {
        priceField.style.display = 'none';
        freeNote.style.display = 'block';
    } else {
        priceField.style.display = 'block';
        freeNote.style.display = 'none';
    }
}

async function editPromotion(promotionId) {
    const promo = promotions.find(p => p.id === promotionId);
    if (!promo) return;
    
    currentEditingPromotionId = promotionId;
    
    // Заполняем поля - название теперь редактируемое
    const nameInput = document.getElementById('promoName');
    
    nameInput.value = promo.name;
    nameInput.disabled = false;
    nameInput.style.background = 'white';
    nameInput.style.cursor = 'text';
    
    // Описание
    document.getElementById('promoDescription').value = promo.description || '';
    
    // Продукты
    document.getElementById('promoProducts').value = promo.products || '';
    
    // Загружаем значение скидки
    document.getElementById('promoDiscountValue').value = promo.reward_value || 0;
    
    // Бесплатная акция и цена (обратная логика: is_free вместо requires_purchase)
    document.getElementById('promoIsFree').checked = promo.is_free || false;
    document.getElementById('promoPrice').value = promo.price || 100;
    
    // Показываем/скрываем поле цены
    if (promo.is_free) {
        document.getElementById('promoPriceField').style.display = 'none';
        document.getElementById('promoFreeNote').style.display = 'block';
    } else {
        document.getElementById('promoPriceField').style.display = 'block';
        document.getElementById('promoFreeNote').style.display = 'none';
    }
    
    // Даты
    if (promo.start_date) {
        const start = new Date(promo.start_date);
        const offset = start.getTimezoneOffset();
        const localDate = new Date(start.getTime() - (offset * 60 * 1000));
        document.getElementById('promoStartDate').value = localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById('promoStartDate').value = '';
    }
    
    if (promo.end_date) {
        const end = new Date(promo.end_date);
        const offset = end.getTimezoneOffset();
        const localDate = new Date(end.getTime() - (offset * 60 * 1000));
        document.getElementById('promoEndDate').value = localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById('promoEndDate').value = '';
    }
    
    document.getElementById('promoActive').checked = promo.active;
    
    // Обновляем заголовок и кнопку
    document.getElementById('promotionModalTitle').textContent = '✏️ Редактировать акцию';
    document.getElementById('savePromotionBtn').textContent = '💾 Сохранить изменения';
    document.getElementById('deletePromotionBtn').style.display = 'block';
    
    openModal('promotion');
}

async function savePromotion() {
    const rewardValue = parseInt(document.getElementById('promoDiscountValue').value) || 0;
    const startDate = document.getElementById('promoStartDate').value;
    const endDate = document.getElementById('promoEndDate').value;
    const active = document.getElementById('promoActive').checked;
    const name = document.getElementById('promoName').value.trim();
    const description = document.getElementById('promoDescription').value.trim();
    const products = document.getElementById('promoProducts').value.trim();
    const isFree = document.getElementById('promoIsFree').checked;
    const price = isFree ? 0 : (parseInt(document.getElementById('promoPrice').value) || 100);
    const errorElement = document.getElementById('promotionError');
    
    // Validate name
    if (!name) {
        errorElement.textContent = '❌ Укажите название акции';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    // ВАЛИДАЦИЯ ДАТ
    if (!startDate) {
        errorElement.textContent = '❌ Укажите дату начала акции (обязательное поле)';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    if (!endDate) {
        errorElement.textContent = '❌ Укажите дату окончания акции (обязательное поле)';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Проверка: дата окончания должна быть ПОСЛЕ даты начала (с учетом времени)
    if (end <= start) {
        errorElement.textContent = '❌ Дата и время окончания должны быть ПОСЛЕ даты и времени начала.';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    // Проверка: минимальная длительность акции - 12 часов
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 12) {
        const remainingMinutes = Math.ceil((12 - diffHours) * 60);
        const remainingHours = Math.floor(remainingMinutes / 60);
        const remainingMins = remainingMinutes % 60;
        
        let timeText = '';
        if (remainingHours > 0) {
            timeText = `${remainingHours} ${getHoursWord(remainingHours)}`;
            if (remainingMins > 0) timeText += ` ${remainingMins} минут`;
        } else {
            timeText = `${remainingMins} минут`;
        }
        
        errorElement.textContent = `❌ Акция должна длиться минимум 12 часов. Добавьте ещё ${timeText}.`;
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 5000);
        return;
    }
    
    // Валидация значения скидки
    if (rewardValue <= 0) {
        errorElement.textContent = '❌ Укажите размер скидки (больше 0)';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    if (rewardValue > 100) {
        errorElement.textContent = '❌ Скидка не может превышать 100%';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    // Проверка: выбрана ли компания
    if (!currentBusiness || !currentBusiness.id) {
        errorElement.textContent = '❌ Компания не выбрана. Перезагрузите страницу.';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    try {
        const promotionData = {
            name,
            description,
            products,
            startDate, 
            endDate, 
            active,
            reward_type: 'discount',
            reward_value: rewardValue,
            is_free: isFree,
            price: price
        };
        
        let response;
        if (currentEditingPromotionId) {
            // Обновляем существующую акцию
            response = await fetch(`${API_URL}/api/promotions/${currentEditingPromotionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(promotionData)
            });
        } else {
            // Создаем новую акцию
            response = await fetch(`${API_URL}/api/promotions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: currentBusiness.id,
                    ...promotionData
                })
            });
        }
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            await loadPromotionsAndQuestsFromDB();
            closeModal('promotion');
            
            const formattedStart = start.toLocaleString('ru-RU');
            const formattedEnd = end.toLocaleString('ru-RU');
            const durationHours = Math.round(diffHours * 10) / 10;
            alert(`✅ Акция ${currentEditingPromotionId ? 'обновлена' : 'создана'}!\n📅 ${formattedStart} → ${formattedEnd}\n⏱️ Длительность: ${durationHours} часов`);
        } else {
            errorElement.textContent = data.message || 'Ошибка сохранения';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 3000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorElement.textContent = 'Ошибка подключения к серверу: ' + error.message;
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 5000);
    }
}

// Вспомогательная функция для склонения слова "час"
function getHoursWord(hours) {
    const lastDigit = hours % 10;
    const lastTwoDigits = hours % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'часов';
    }
    
    switch (lastDigit) {
        case 1: return 'час';
        case 2:
        case 3:
        case 4: return 'часа';
        default: return 'часов';
    }
}



async function togglePromotion(id, isActive) {
    const promo = promotions.find(p => p.id === id);
    if (promo) {
        promo.active = isActive;
        try {
            await fetch(`${API_URL}/api/promotions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(promo)
            });
        } catch (error) {}
        renderPromotionsList();
    }
}

async function deleteCurrentPromotion() {
    if (!currentEditingPromotionId) return;
    
    if (!confirm('Вы уверены, что хотите удалить эту акцию?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/promotions/${currentEditingPromotionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            await loadPromotionsAndQuestsFromDB();
            closeModal('promotion');
            alert('✅ Акция успешно удалена');
        } else {
            alert('❌ Ошибка удаления акции');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка подключения к серверу');
    }
}

// ========== ЗАДАНИЯ ==========
function renderQuestsManagerList() {
    const container = document.getElementById('questsManagerList');
    if (!container) return;
    
    if (!questsManager || questsManager.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет заданий. Задания создаются автоматически при регистрации компании.</div>';
        return;
    }
    
    container.innerHTML = questsManager.map(quest => {
        const status = quest.active ? 'active' : 'inactive';
        const statusText = quest.active ? '✅ Активно' : '❌ Отключено';
        const durationDays = quest.duration_days || 1;
        
        // Показываем предупреждение если дней больше 7
        const daysWarning = durationDays > 7 ? '⚠️ Превышает лимит (макс. 7)' : '';
        
        // Показываем тип задания и цель
        let questTypeInfo = '';
        if (quest.target_type === 'purchase_count') {
            questTypeInfo = `<span style="color:#3498db; margin-left:8px;">🛒 Цель: ${quest.target_value} покупок</span>`;
        } else if (quest.target_type === 'spend_amount') {
            questTypeInfo = `<span style="color:#3498db; margin-left:8px;">💰 Цель: ${quest.target_value}₽</span>`;
        } else if (quest.target_type === 'use_promotion') {
            questTypeInfo = `<span style="color:#3498db; margin-left:8px;">🎁 Цель: Использовать акцию</span>`;
        }
        
        return `
            <div class="promotion-item">
                <div class="promotion-header">
                    <div class="promotion-emojis">${quest.emoji || '✅'}</div>
                    <div class="promotion-name">${escapeHtml(quest.title)}</div>
                    <div class="promotion-reward" style="background:#ffd966; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700;">+${quest.reward} бонусов</div>
                    <div class="promotion-status ${status}">${statusText}</div>
                    <button class="btn-edit" onclick="editQuest(${quest.id})" style="background:#17a2b8; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">✏️</button>
                </div>
                <div class="promotion-desc" style="font-size:13px; color:#555; margin:8px 0 4px 60px;">${escapeHtml(quest.description || '')}</div>
                <div class="promotion-dates" style="font-size:11px; color:#999; margin-left:60px;">
                    ⏱️ Дней на выполнение: ${durationDays} ${daysWarning ? `<span style="color:#e74c3c; margin-left:8px;">${daysWarning}</span>` : ''}
                    ${questTypeInfo}
                    ${!quest.active ? '<span style="color:#e74c3c; margin-left:8px;">🔒 Задание отключено</span>' : '<span style="color:#2ecc71; margin-left:8px;">🟢 Задание активно в приложении</span>'}
                </div>
                <div class="promotion-actions" style="margin-left:60px; margin-top:8px;">
                    <label style="font-size:13px; display: flex; align-items: center; gap: 12px;">
                        <span>Активно в приложении:</span>
                        <input type="checkbox" ${quest.active ? 'checked' : ''} onchange="toggleQuest(${quest.id}, this.checked)">
                    </label>
                </div>
            </div>
        `;
    }).join('');
}


async function loadQuestsManager() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/quests/${currentBusiness.id}`);
        if (response.ok) {
            questsManager = await response.json();
            renderQuestsManagerList();
        }
    } catch (error) {
        console.error('Ошибка загрузки заданий:', error);
    }
}
function showAddQuestModal() {
    alert('❌ Добавление новых заданий отключено.\nЗадания создаются автоматически при регистрации компании.\nВы можете только редактировать существующие задания через кнопку ✏️');
}

async function editQuest(questId) {
    const quest = questsManager.find(q => q.id === questId);
    if (!quest) return;
    
    currentEditingQuestId = questId;
    
    // Заполняем поля названия и описания (только для чтения)
    const titleInput = document.getElementById('questTitle');
    const descInput = document.getElementById('questDesc');
    
    if (titleInput) {
        titleInput.value = quest.title;
        titleInput.disabled = true;
        titleInput.style.background = '#f0f0f0';
        titleInput.style.cursor = 'not-allowed';
    }
    
    if (descInput) {
        descInput.value = quest.description || '';
        descInput.disabled = true;
        descInput.style.background = '#f0f0f0';
        descInput.style.cursor = 'not-allowed';
    }
    
    // Разрешаем редактировать награду, активность и количество дней
    const rewardInput = document.getElementById('questReward');
    if (rewardInput) {
        rewardInput.value = quest.reward;
    }
    
    const activeCheckbox = document.getElementById('questActive');
    if (activeCheckbox) {
        activeCheckbox.checked = quest.active;
    }
    
    // Количество дней на выполнение с ограничением от 1 до 7
    const durationDaysInput = document.getElementById('questDurationDays');
    if (durationDaysInput) {
        durationDaysInput.value = quest.duration_days || 1;
        durationDaysInput.min = 1;
        durationDaysInput.max = 7;
        durationDaysInput.step = 1;
    }
    
    document.getElementById('questModalTitle').textContent = 'Редактировать задание';
    openModal('quest');
}
async function saveQuest() {
    const reward = parseInt(document.getElementById('questReward').value) || 10;
    const active = document.getElementById('questActive').checked;
    const durationDays = parseInt(document.getElementById('questDurationDays').value) || 1;
    const errorElement = document.getElementById('questError');
    
    // Валидация
    if (reward <= 0) {
        errorElement.textContent = '❌ Укажите количество бонусов (больше 0)';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    // НОВАЯ ВАЛИДАЦИЯ: от 1 до 7 дней
    if (durationDays < 1) {
        errorElement.textContent = '❌ Количество дней на выполнение должно быть не менее 1';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    if (durationDays > 7) {
        errorElement.textContent = '❌ Количество дней на выполнение не может превышать 7';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    // Проверка на целое число
    if (!Number.isInteger(durationDays)) {
        errorElement.textContent = '❌ Количество дней должно быть целым числом';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    const saveBtn = document.getElementById('saveQuestBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Сохранение...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/api/quests/${currentEditingQuestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reward, active, durationDays })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            await loadQuestsManager();
            closeModal('quest');
            alert('✅ Задание обновлено!');
        } else {
            errorElement.textContent = data.message || 'Ошибка сохранения';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 3000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorElement.textContent = 'Ошибка подключения к серверу';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function toggleQuest(id, isActive) {
    const quest = questsManager.find(q => q.id === id);
    if (quest) {
        quest.active = isActive;
        try {
            await fetch(`${API_URL}/api/quests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: isActive })
            });
        } catch (error) {}
        renderQuestsManagerList();
    }
}

// ========== НАСТРОЙКИ ==========
async function saveBusinessSettings() {
    if (!currentBusiness) {
        alert('Ошибка: не загружены данные компании');
        return;
    }
    
    try {
        const brandColor = document.getElementById('brandColor')?.value || '#2A4B7C';
        
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/branding`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandColor })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Настройки брендирования сохранены!\n\nЦвет будет применен в mini-app при следующем открытии.');
        } else {
            alert('❌ Ошибка сохранения: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка подключения к серверу');
    }
}

// Загрузить информацию о компании (только для чтения)
function loadCompanyInformation() {
    if (!currentBusiness) return;
    
    document.getElementById('infoCompanyName').textContent = currentBusiness.company || '-';
    document.getElementById('infoOwnerName').textContent = currentBusiness.name || '-';
    document.getElementById('infoEmail').textContent = currentBusiness.email || '-';
    document.getElementById('infoPhone').textContent = currentBusiness.phone || '-';
}

// Загрузить цвет бренда
function loadBrandColor() {
    if (!currentBusiness) return;
    
    const brandColor = currentBusiness.brand_color || currentBusiness.brandColor || '#2A4B7C';
    const colorInput = document.getElementById('brandColor');
    if (colorInput) {
        colorInput.value = brandColor;
        updateBrandPreview(brandColor);
    }
}

// Обновить предпросмотр брендирования
function updateBrandPreview(color) {
    const previewBtn = document.querySelector('.preview-btn');
    const previewBar = document.querySelector('.preview-bar');
    const previewBadge = document.querySelector('.preview-badge');
    
    if (previewBtn) previewBtn.style.background = color;
    if (previewBar) previewBar.style.background = `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`;
    if (previewBadge) previewBadge.style.background = color;
}

// Обработчик изменения цвета бренда
document.addEventListener('DOMContentLoaded', () => {
    const brandColorInput = document.getElementById('brandColor');
    if (brandColorInput) {
        brandColorInput.addEventListener('input', (e) => {
            updateBrandPreview(e.target.value);
        });
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    const fullGreetingTextInput = document.getElementById('fullGreetingText');
    if (fullGreetingTextInput) {
        fullGreetingTextInput.addEventListener('input', updateGreetingPreview);
    }
    
    document.querySelectorAll('.crm-nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const module = btn.dataset.module;
            document.querySelectorAll('.crm-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.crm-module').forEach(m => m.classList.remove('active'));
            const activeModule = document.getElementById(`${module}Module`);
            if (activeModule) activeModule.classList.add('active');
            if (module === 'marketing') {
                renderPromotionsList();
                renderQuestsManagerList();
            }
            if (module === 'loyalty') {
                loadLoyaltySettings();
            }
            if (module === 'information') {
                loadCompanyInformation();
            }
            if (module === 'settings') {
                loadBrandColor();
                initEmojiPicker();
                loadGreetingSettings();
            }
            if (module === 'cashier') {
                loadCashierCredentials();
            }
        });
    });
    
    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadAnalytics();
        });
    });
    
    const programActive = document.getElementById('programActive');
    if (programActive) {
        programActive.addEventListener('change', () => {
            const label = document.getElementById('programStatusLabel');
            if (label) label.textContent = programActive.checked ? 'Активна' : 'Приостановлена';
        });
    }
    
    const savedGames = localStorage.getItem('loyalty_games');
    if (savedGames) try { games = JSON.parse(savedGames); } catch(e) {}
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
	const rewardTypeSelect = document.getElementById('promoRewardType');
    if (rewardTypeSelect) {
        rewardTypeSelect.addEventListener('change', (e) => toggleRewardFields(e.target.value));
    }
});

// Добавьте эти функции в script.js

// ========== НАСТРОЙКА КОЛЕСА ФОРТУНЫ ==========
let wheelSettings = {
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
    freeSpinDaily: false,
    active: true
};

let wheelSettingsLoaded = false;

async function loadWheelSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/wheel`);
        const data = await response.json();
        
        if (data.success) {
            wheelSettings = {
                spinCost: data.settings.spinCost || 25,
                sectors: data.settings.sectors || wheelSettings.sectors,
                maxSpinsPerDay: data.settings.maxSpinsPerDay || 10,
                freeSpinDaily: data.settings.freeSpinDaily || false
            };
            wheelSettings.active = data.active;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек колеса:', error);
    }
    
    wheelSettingsLoaded = true;
    renderWheelSettings();
}

function renderWheelSettings() {
    const container = document.getElementById('wheelSettingsContainer');
    if (!container) return;
    
    const totalWeight = wheelSettings.sectors.reduce((sum, s) => sum + (s.weight || 10), 0);
    
    container.innerHTML = `
        <div class="wheel-settings-card">
            <div class="wheel-header">
                <h3>🎡 Колесо фортуны</h3>
                <div class="toggle-switch">
                    <input type="checkbox" id="wheelActive" ${wheelSettings.active ? 'checked' : ''} onchange="toggleWheelActive(this.checked)">
                    <span>${wheelSettings.active ? 'Активно' : 'Отключено'}</span>
                </div>
            </div>
            
            <div class="wheel-settings-grid">
                <div class="wheel-setting-group">
                    <label>💰 Стоимость вращения (бонусов)</label>
                    <input type="number" id="wheelSpinCost" value="${wheelSettings.spinCost}" min="1" max="1000" onchange="updateWheelSpinCost(this.value)">
                </div>
                <div class="wheel-setting-group">
                    <label>🔄 Максимум вращений в день</label>
                    <input type="number" id="wheelMaxSpins" value="${wheelSettings.maxSpinsPerDay}" min="1" max="100" onchange="updateWheelMaxSpins(this.value)">
                </div>
                <div class="wheel-setting-group">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <span>🎁 Бесплатное вращение в день</span>
                        <input type="checkbox" 
                               id="wheelFreeSpin" 
                               ${wheelSettings.freeSpinDaily ? 'checked' : ''} 
                               onchange="updateWheelFreeSpin(this.checked)"
                               style="width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: #ff4d4d;">
                        <span id="wheelFreeSpinStatus" style="font-size: 12px; color: ${wheelSettings.freeSpinDaily ? '#2ecc71' : '#888'}">
                            ${wheelSettings.freeSpinDaily ? '✅ Включена' : '⭕ Отключена'}
                        </span>
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 12px;">🎯 Сектора колеса</h4>
                <div class="sectors-list" id="sectorsList"></div>
                <button class="btn-add-sector" onclick="addSector()">+ Добавить сектор</button>
            </div>
            
            <div class="wheel-stats">
                <h4>📊 Статистика вероятностей</h4>
                <div class="wheel-stats-grid" id="wheelStats"></div>
            </div>
        </div>
    `;
    
    renderSectorsList();
    renderWheelStats();
}

function renderSectorsList() {
    const container = document.getElementById('sectorsList');
    if (!container) return;
    
    container.innerHTML = wheelSettings.sectors.map((sector, idx) => `
        <div class="sector-item">
            <div class="sector-preview" style="background: ${sector.color}">
                <span>${sector.icon}</span>
                <span>${sector.name}</span>
            </div>
            <div class="sector-fields">
                <div class="sector-field">
                    <label>Название</label>
                    <input type="text" value="${sector.name}" onchange="updateSector(${idx}, 'name', this.value)" style="width: 60px;">
                </div>
                <div class="sector-field">
                    <label>Значение</label>
                    <input type="number" value="${sector.value}" onchange="updateSector(${idx}, 'value', parseInt(this.value))" style="width: 70px;">
                </div>
                <div class="sector-field">
                    <label>Вес (%)</label>
                    <input type="number" value="${sector.weight || 10}" onchange="updateSector(${idx}, 'weight', parseInt(this.value))" min="1" max="100" style="width: 70px;">
                </div>
                <div class="sector-field">
                    <label>Цвет</label>
                    <input type="color" value="${sector.color}" onchange="updateSector(${idx}, 'color', this.value)" style="width: 50px; height: 32px;">
                </div>
                <div class="sector-field">
                    <label>Иконка</label>
                    <select onchange="updateSector(${idx}, 'icon', this.value)" style="width: 60px;">
                        ${getIconOptions(sector.icon)}
                    </select>
                </div>
            </div>
            <button class="sector-remove" onclick="removeSector(${idx})" ${wheelSettings.sectors.length <= 3 ? 'disabled style="opacity:0.5"' : ''}>🗑️</button>
        </div>
    `).join('');
}

function renderWheelStats() {
    const container = document.getElementById('wheelStats');
    if (!container) return;
    
    const totalWeight = wheelSettings.sectors.reduce((sum, s) => sum + (s.weight || 10), 0);
    const expectedValue = wheelSettings.sectors.reduce((sum, s) => sum + (s.value * (s.weight / totalWeight)), 0);
    
    container.innerHTML = `
        <div>
            <div class="wheel-stat-value">${totalWeight}%</div>
            <div class="wheel-stat-label">Сумма весов</div>
        </div>
        <div>
            <div class="wheel-stat-value">${expectedValue.toFixed(2)}</div>
            <div class="wheel-stat-label">Ожидаемый выигрыш</div>
        </div>
        <div>
            <div class="wheel-stat-value">${wheelSettings.spinCost}</div>
            <div class="wheel-stat-label">Стоимость вращения</div>
        </div>
    `;
    
    // Предупреждение если ожидаемый выигрыш слишком большой
    if (expectedValue > wheelSettings.spinCost) {
        const warning = document.createElement('div');
        warning.className = 'warning-text';
        warning.innerHTML = '⚠️ Внимание: ожидаемый выигрыш превышает стоимость вращения! Это может привести к быстрому накоплению бонусов у пользователей.';
        if (!container.parentElement.querySelector('.warning-text')) {
            container.parentElement.appendChild(warning);
        }
    } else if (container.parentElement.querySelector('.warning-text')) {
        container.parentElement.querySelector('.warning-text').remove();
    }
}

function getIconOptions(selectedIcon) {
    const icons = ['⭐', '🎯', '🔥', '💀', '✨', '🍀', '💎', '🏆', '🎲', '💰', '🎁', '⚡', '👑', '🎉'];
    return icons.map(icon => `<option value="${icon}" ${selectedIcon === icon ? 'selected' : ''}>${icon}</option>`).join('');
}

function updateSector(index, field, value) {
    if (wheelSettings.sectors[index]) {
        wheelSettings.sectors[index][field] = value;
        renderSectorsList();
        renderWheelStats();
        saveWheelSettingsDebounced();
    }
}

function addSector() {
    const newSector = {
        name: `x${wheelSettings.sectors.length + 1}`,
        value: wheelSettings.sectors.length + 1,
        multiplier: wheelSettings.sectors.length + 1,
        color: getRandomColor(),
        icon: '🎲',
        weight: 10
    };
    wheelSettings.sectors.push(newSector);
    renderSectorsList();
    renderWheelStats();
    saveWheelSettingsDebounced();
}

function removeSector(index) {
    if (wheelSettings.sectors.length <= 3) {
        alert('❌ Нельзя удалить сектор. Минимум 3 сектора');
        return;
    }
    if (confirm(`Удалить сектор "${wheelSettings.sectors[index].name}"?`)) {
        wheelSettings.sectors.splice(index, 1);
        renderSectorsList();
        renderWheelStats();
        saveWheelSettingsDebounced();
    }
}

function getRandomColor() {
    const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f39c12', '#1abc9c', '#9b59b6', '#e67e22', '#95a5a6'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateWheelSpinCost(value) {
    wheelSettings.spinCost = parseInt(value) || 25;
    renderWheelStats();
    saveWheelSettingsDebounced();
}

function updateWheelMaxSpins(value) {
    wheelSettings.maxSpinsPerDay = parseInt(value) || 10;
    saveWheelSettingsDebounced();
}

function updateWheelFreeSpin(checked) {
    wheelSettings.freeSpinDaily = checked;
    
    // Обновляем текст статуса
    const statusSpan = document.getElementById('wheelFreeSpinStatus');
    if (statusSpan) {
        statusSpan.textContent = checked ? '✅ Включена' : '⭕ Отключена';
        statusSpan.style.color = checked ? '#2ecc71' : '#888';
    }
    
    saveWheelSettingsDebounced();
}

function toggleWheelActive(active) {
    wheelSettings.active = active;
    saveWheelSettingsDebounced();
}

let saveWheelTimeout = null;

function saveWheelSettingsDebounced() {
    if (saveWheelTimeout) clearTimeout(saveWheelTimeout);
    saveWheelTimeout = setTimeout(() => saveWheelSettings(), 1000);
}

async function saveWheelSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/wheel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: {
                    spinCost: wheelSettings.spinCost,
                    sectors: wheelSettings.sectors,
                    maxSpinsPerDay: wheelSettings.maxSpinsPerDay,
                    freeSpinDaily: wheelSettings.freeSpinDaily
                },
                active: wheelSettings.active
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showSaveIndicator();
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек колеса:', error);
    }
}

async function saveAllGameSettings() {
    await saveWheelSettings();
    await saveScratchSettings();
	await saveDiceSettings();
    alert('✅ Все настройки игр сохранены!');
}

// ========== НАСТРОЙКА СКРЕТЧ-КАРТЫ ==========
let scratchSettings = {
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
    freeHintDaily: false,
    active: true
};

let scratchSettingsLoaded = false;

async function loadScratchSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/scratch`);
        const data = await response.json();
        
        if (data.success) {
            scratchSettings = {
                cost: data.settings.cost || 20,
                maxAttempts: data.settings.maxAttempts || 3,
                symbols: data.settings.symbols || scratchSettings.symbols,
                hintCost: data.settings.hintCost || 15,
                freeHintDaily: data.settings.freeHintDaily || false
            };
            scratchSettings.active = data.active;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек скретч-карты:', error);
    }
    
    scratchSettingsLoaded = true;
    renderScratchSettings();
}

function renderScratchSettings() {
    const container = document.getElementById('scratchSettingsContainer');
    if (!container) return;
    
    const totalProb = scratchSettings.symbols.reduce((sum, s) => sum + (s.prob || 10), 0);
    
    container.innerHTML = `
        <div class="scratch-settings-card">
            <div class="scratch-header">
                <h3>🎫 Скретч-карта (Найди 3 одинаковых)</h3>
                <div class="toggle-switch">
                    <input type="checkbox" id="scratchActive" ${scratchSettings.active ? 'checked' : ''} onchange="toggleScratchActive(this.checked)">
                    <span>${scratchSettings.active ? 'Активна' : 'Отключена'}</span>
                </div>
            </div>
            
            <div class="scratch-settings-grid">
                <div class="scratch-setting-group">
                    <label>💰 Стоимость игры (бонусов)</label>
                    <input type="number" id="scratchCost" value="${scratchSettings.cost}" min="1" max="500" onchange="updateScratchCost(this.value)">
                </div>
                <div class="scratch-setting-group">
                    <label>🖱️ Максимум попыток</label>
                    <input type="number" id="scratchMaxAttempts" value="${scratchSettings.maxAttempts}" min="1" max="10" onchange="updateScratchMaxAttempts(this.value)">
                </div>
                <div class="scratch-setting-group">
                    <label>💡 Стоимость подсказки (бонусов)</label>
                    <input type="number" id="scratchHintCost" value="${scratchSettings.hintCost}" min="0" max="100" onchange="updateScratchHintCost(this.value)">
                </div>
                <div class="scratch-setting-group">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <span>🎁 Бесплатная подсказка в день</span>
                        <input type="checkbox" 
                               id="scratchFreeHint" 
                               ${scratchSettings.freeHintDaily ? 'checked' : ''} 
                               onchange="updateScratchFreeHint(this.checked)"
                               style="width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: #ff4d4d;">
                        <span id="scratchFreeHintStatus" style="font-size: 12px; color: ${scratchSettings.freeHintDaily ? '#2ecc71' : '#888'}">
                            ${scratchSettings.freeHintDaily ? '✅ Включена' : '⭕ Отключена'}
                        </span>
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 12px;">🎯 Символы и призы</h4>
                <div class="symbols-list" id="symbolsList"></div>
                <button class="btn-add-symbol" onclick="addSymbol()">+ Добавить символ</button>
            </div>
            
            <div class="scratch-stats">
                <h4>📊 Статистика вероятностей</h4>
                <div class="scratch-stats-grid" id="scratchStats"></div>
            </div>
        </div>
    `;
    
    renderSymbolsList();
    renderScratchStats();
}

function renderSymbolsList() {
    const container = document.getElementById('symbolsList');
    if (!container) return;
    
    container.innerHTML = scratchSettings.symbols.map((symbol, idx) => `
        <div class="symbol-item">
            <div class="symbol-preview" style="background: ${symbol.color}">
                <span>${symbol.id}</span>
                <span>${symbol.name}</span>
            </div>
            <div class="symbol-fields">
                <div class="symbol-field">
                    <label>Эмодзи</label>
                    <input type="text" value="${symbol.id}" onchange="updateSymbol(${idx}, 'id', this.value)" maxlength="2" style="width: 50px;">
                </div>
                <div class="symbol-field">
                    <label>Название</label>
                    <input type="text" value="${symbol.name}" onchange="updateSymbol(${idx}, 'name', this.value)" style="width: 80px;">
                </div>
                <div class="symbol-field">
                    <label>Бонус</label>
                    <input type="number" value="${symbol.value}" onchange="updateSymbol(${idx}, 'value', parseInt(this.value))" style="width: 70px;">
                </div>
                <div class="symbol-field">
                    <label>Множитель</label>
                    <input type="number" step="0.5" value="${symbol.multiplier}" onchange="updateSymbol(${idx}, 'multiplier', parseFloat(this.value))" style="width: 70px;">
                </div>
                <div class="symbol-field">
                    <label>Вес (%)</label>
                    <input type="number" value="${symbol.prob || 10}" onchange="updateSymbol(${idx}, 'prob', parseInt(this.value))" min="1" max="100" style="width: 70px;">
                </div>
                <div class="symbol-field">
                    <label>Цвет</label>
                    <input type="color" value="${symbol.color}" onchange="updateSymbol(${idx}, 'color', this.value)" style="width: 50px; height: 32px;">
                </div>
            </div>
            <button class="symbol-remove" onclick="removeSymbol(${idx})" ${scratchSettings.symbols.length <= 3 ? 'disabled style="opacity:0.5"' : ''}>🗑️</button>
        </div>
    `).join('');
}

function renderScratchStats() {
    const container = document.getElementById('scratchStats');
    if (!container) return;
    
    const totalProb = scratchSettings.symbols.reduce((sum, s) => sum + (s.prob || 10), 0);
    const avgWin = scratchSettings.symbols.reduce((sum, s) => sum + (s.value * s.multiplier * (s.prob / totalProb)), 0);
    const maxWin = Math.max(...scratchSettings.symbols.map(s => s.value * s.multiplier));
    
    container.innerHTML = `
        <div>
            <div class="scratch-stat-value">${totalProb}%</div>
            <div class="scratch-stat-label">Сумма весов</div>
        </div>
        <div>
            <div class="scratch-stat-value">${avgWin.toFixed(0)}</div>
            <div class="scratch-stat-label">Ср. выигрыш</div>
        </div>
        <div>
            <div class="scratch-stat-value">${maxWin}</div>
            <div class="scratch-stat-label">Макс. выигрыш</div>
        </div>
        <div>
            <div class="scratch-stat-value">${scratchSettings.cost}</div>
            <div class="scratch-stat-label">Стоимость</div>
        </div>
    `;
}

function updateSymbol(index, field, value) {
    if (scratchSettings.symbols[index]) {
        scratchSettings.symbols[index][field] = value;
        renderSymbolsList();
        renderScratchStats();
        saveScratchSettingsDebounced();
    }
}

function addSymbol() {
    const newSymbol = {
        id: '🎲',
        name: `Символ ${scratchSettings.symbols.length + 1}`,
        value: 50,
        multiplier: 5,
        color: getRandomColor(),
        prob: 10
    };
    scratchSettings.symbols.push(newSymbol);
    renderSymbolsList();
    renderScratchStats();
    saveScratchSettingsDebounced();
}

function removeSymbol(index) {
    if (scratchSettings.symbols.length <= 3) {
        alert('❌ Нельзя удалить символ. Минимум 3 символа');
        return;
    }
    if (confirm(`Удалить символ "${scratchSettings.symbols[index].name}"?`)) {
        scratchSettings.symbols.splice(index, 1);
        renderSymbolsList();
        renderScratchStats();
        saveScratchSettingsDebounced();
    }
}

function updateScratchCost(value) {
    scratchSettings.cost = parseInt(value) || 20;
    renderScratchStats();
    saveScratchSettingsDebounced();
}

function updateScratchMaxAttempts(value) {
    scratchSettings.maxAttempts = parseInt(value) || 3;
    saveScratchSettingsDebounced();
}

function updateScratchHintCost(value) {
    scratchSettings.hintCost = parseInt(value) || 15;
    saveScratchSettingsDebounced();
}

function updateScratchFreeHint(checked) {
    scratchSettings.freeHintDaily = checked;
    
    // Обновляем текст статуса
    const statusSpan = document.getElementById('scratchFreeHintStatus');
    if (statusSpan) {
        statusSpan.textContent = checked ? '✅ Включена' : '⭕ Отключена';
        statusSpan.style.color = checked ? '#2ecc71' : '#888';
    }
    
    saveScratchSettingsDebounced();
}

function toggleScratchActive(active) {
    scratchSettings.active = active;
    saveScratchSettingsDebounced();
}

let saveScratchTimeout = null;

function saveScratchSettingsDebounced() {
    if (saveScratchTimeout) clearTimeout(saveScratchTimeout);
    saveScratchTimeout = setTimeout(() => saveScratchSettings(), 1000);
}

async function saveScratchSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/scratch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: {
                    cost: scratchSettings.cost,
                    maxAttempts: scratchSettings.maxAttempts,
                    symbols: scratchSettings.symbols,
                    hintCost: scratchSettings.hintCost,
                    freeHintDaily: scratchSettings.freeHintDaily
                },
                active: scratchSettings.active
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showSaveIndicator();
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек скретч-карты:', error);
    }
}
// Добавьте в script.js после функций для скретч-карты

// ========== НАСТРОЙКА ИГРЫ В КОСТИ ==========
let diceSettings = {
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
    jackpotContribution: 10,
    active: true
};

let diceSettingsLoaded = false;

async function loadDiceSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/dice`);
        const data = await response.json();
        
        if (data.success) {
            diceSettings = {
                cost: data.settings.cost || 25,
                jackpotBase: data.settings.jackpotBase || 1000,
                betMultipliers: data.settings.betMultipliers || [1, 2, 3, 5, 10],
                combinations: data.settings.combinations || diceSettings.combinations,
                jackpotChance: data.settings.jackpotChance || 1,
                jackpotContribution: data.settings.jackpotContribution || 10
            };
            diceSettings.active = data.active;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек костей:', error);
    }
    
    diceSettingsLoaded = true;
    renderDiceSettings();
}

function renderDiceSettings() {
    const container = document.getElementById('diceSettingsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="dice-settings-card">
            <div class="dice-header-settings">
                <h3>🎲 Кости (Dice Roll)</h3>
                <div class="toggle-switch">
                    <input type="checkbox" id="diceActive" ${diceSettings.active ? 'checked' : ''} onchange="toggleDiceActive(this.checked)">
                    <span>${diceSettings.active ? 'Активна' : 'Отключена'}</span>
                </div>
            </div>
            
            <div class="dice-settings-grid">
                <div class="dice-setting-group">
                    <label>💰 Стоимость игры (бонусов)</label>
                    <input type="number" id="diceCost" value="${diceSettings.cost}" min="1" max="500" onchange="updateDiceCost(this.value)">
                </div>
                <div class="dice-setting-group">
                    <label>💎 Базовый джекпот</label>
                    <input type="number" id="diceJackpotBase" value="${diceSettings.jackpotBase}" min="100" max="10000" onchange="updateDiceJackpotBase(this.value)">
                </div>
                <div class="dice-setting-group">
                    <label>🎲 Шанс на джекпот (%)</label>
                    <input type="number" id="diceJackpotChance" value="${diceSettings.jackpotChance}" min="0" max="10" step="0.5" onchange="updateDiceJackpotChance(this.value)">
                    <small style="font-size: 10px; color: #666;">0.5 = 0.5% шанс</small>
                </div>
                <div class="dice-setting-group">
                    <label>📈 Пополнение джекпота (%)</label>
                    <input type="number" id="diceJackpotContribution" value="${diceSettings.jackpotContribution}" min="0" max="50" onchange="updateDiceJackpotContribution(this.value)">
                    <small style="font-size: 10px; color: #666;">% от проигрыша в джекпот</small>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 12px;">⚡ Множители ставки</h4>
                <div class="multipliers-list" id="multipliersList"></div>
                <button class="btn-add-multiplier" onclick="addMultiplier()">+ Добавить множитель</button>
            </div>
            
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 12px;">🎯 Комбинации и выигрыши</h4>
                <div class="combinations-list" id="diceCombinationsList"></div>
            </div>
            
            <div class="dice-stats-info">
                <h4>📊 Информация</h4>
                <div class="dice-stats-grid" id="diceStatsInfo"></div>
            </div>
        </div>
    `;
    
    renderMultipliersList();
    renderDiceCombinationsList();
    renderDiceStatsInfo();
}

function renderMultipliersList() {
    const container = document.getElementById('multipliersList');
    if (!container) return;
    
    if (diceSettings.betMultipliers.length === 0) {
        container.innerHTML = '<div style="color: #888; padding: 10px;">Нет множителей</div>';
        return;
    }
    
    container.innerHTML = diceSettings.betMultipliers.map((mult, idx) => `
        <div class="multiplier-tag">
            <span style="font-weight: bold;">x${mult}</span>
            <button onclick="removeMultiplier(${idx})" 
                    style="
                        background: #dc3545; 
                        color: white; 
                        border: none; 
                        border-radius: 50%; 
                        width: 22px; 
                        height: 22px; 
                        font-size: 14px; 
                        cursor: pointer;
                        margin-left: 8px;
                    ">×</button>
        </div>
    `).join('');
}

// Замените существующую функцию addMultiplier на эту:

function addMultiplier() {
    // Создаём модальное окно для ввода множителя
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: #1e2538;
            border-radius: 24px;
            padding: 24px;
            width: 300px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
            <h3 style="color: white; margin-bottom: 20px;">➕ Добавить множитель</h3>
            <input type="number" 
                   id="newMultiplierInput" 
                   placeholder="Например: 1.5, 2, 3.7..."
                   step="0.1"
                   min="0.5"
                   max="50"
                   style="
                       width: 100%;
                       padding: 12px;
                       border-radius: 12px;
                       border: 1px solid #ff4d4d;
                       background: #2a2f3f;
                       color: white;
                       font-size: 16px;
                       text-align: center;
                       margin-bottom: 20px;
                   "
                   autofocus>
            <div style="display: flex; gap: 12px;">
                <button id="confirmMultiplier" style="
                    flex: 1;
                    padding: 12px;
                    background: linear-gradient(135deg, #2ecc71, #27ae60);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">✅ Добавить</button>
                <button id="cancelMultiplier" style="
                    flex: 1;
                    padding: 12px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">❌ Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('newMultiplierInput');
    const confirmBtn = document.getElementById('confirmMultiplier');
    const cancelBtn = document.getElementById('cancelMultiplier');
    
    const addMultiplierValue = () => {
        let newMult = parseFloat(input.value);
        
        // Валидация
        if (isNaN(newMult)) {
            alert('❌ Пожалуйста, введите число');
            return;
        }
        
        if (newMult < 0.5) {
            alert('❌ Множитель не может быть меньше 0.5');
            return;
        }
        
        if (newMult > 50) {
            alert('❌ Множитель не может быть больше 50');
            return;
        }
        
        // Проверка на дубликат
        if (diceSettings.betMultipliers.includes(newMult)) {
            alert(`❌ Множитель x${newMult} уже существует`);
            return;
        }
        
        // Добавляем множитель и сортируем
        diceSettings.betMultipliers.push(newMult);
        diceSettings.betMultipliers.sort((a, b) => a - b);
        
        renderMultipliersList();
        saveDiceSettingsDebounced();
        
        modal.remove();
        alert(`✅ Множитель x${newMult} добавлен!`);
    };
    
    confirmBtn.onclick = addMultiplierValue;
    cancelBtn.onclick = () => modal.remove();
    
    // Закрытие по Escape
    const onKeyDown = (e) => {
        if (e.key === 'Escape') modal.remove();
        if (e.key === 'Enter') addMultiplierValue();
    };
    document.addEventListener('keydown', onKeyDown);
    
    // Убираем обработчик при закрытии
    const removeHandler = () => {
        document.removeEventListener('keydown', onKeyDown);
    };
    modal.addEventListener('remove', removeHandler);
}

function removeMultiplier(index) {
    if (diceSettings.betMultipliers.length <= 1) {
        alert('❌ Нельзя удалить последний множитель');
        return;
    }
    
    const multiplier = diceSettings.betMultipliers[index];
    
    // Подтверждение удаления с указанием значения
    if (confirm(`Удалить множитель x${multiplier}?`)) {
        diceSettings.betMultipliers.splice(index, 1);
        renderMultipliersList();
        saveDiceSettingsDebounced();
        alert(`✅ Множитель x${multiplier} удалён`);
    }
}

function renderDiceCombinationsList() {
    const container = document.getElementById('diceCombinationsList');
    if (!container) return;
    
    const combos = Object.entries(diceSettings.combinations);
    
    container.innerHTML = combos.map(([key, combo]) => `
        <div class="combo-config-item">
            <div class="combo-preview" style="background: ${combo.color}20; border-left: 3px solid ${combo.color}">
                <span>${combo.icon}</span>
                <span>${combo.name.substring(0, 10)}</span>
            </div>
            <div class="combo-fields">
                <div class="combo-field">
                    <label>Название</label>
                    <input type="text" value="${combo.name}" onchange="updateDiceCombo('${key}', 'name', this.value)" style="width: 100px;">
                </div>
                <div class="combo-field">
                    <label>Множитель</label>
                    <input type="number" step="0.5" value="${combo.multiplier}" onchange="updateDiceCombo('${key}', 'multiplier', parseFloat(this.value))" style="width: 70px;">
                </div>
                <div class="combo-field">
                    <label>Иконка</label>
                    <input type="text" value="${combo.icon}" onchange="updateDiceCombo('${key}', 'icon', this.value)" maxlength="2" style="width: 50px;">
                </div>
                <div class="combo-field">
                    <label>Цвет</label>
                    <input type="color" value="${combo.color}" onchange="updateDiceCombo('${key}', 'color', this.value)" style="width: 50px; height: 32px;">
                </div>
            </div>
            <div class="combo-toggle">
                <label>Активна</label>
                <input type="checkbox" ${combo.enabled !== false ? 'checked' : ''} onchange="updateDiceCombo('${key}', 'enabled', this.checked)">
            </div>
        </div>
    `).join('');
}

function renderDiceStatsInfo() {
    const container = document.getElementById('diceStatsInfo');
    if (!container) return;
    
    const totalCombos = Object.values(diceSettings.combinations).filter(c => c.enabled !== false).length;
    const maxMultiplier = Math.max(...Object.values(diceSettings.combinations).map(c => c.multiplier));
    const minMultiplier = Math.min(...Object.values(diceSettings.combinations).map(c => c.multiplier));
    
    container.innerHTML = `
        <div>
            <div class="dice-stat-value">${totalCombos}</div>
            <div class="dice-stat-label">Активных комбинаций</div>
        </div>
        <div>
            <div class="dice-stat-value">x${maxMultiplier}</div>
            <div class="dice-stat-label">Макс. множитель</div>
        </div>
        <div>
            <div class="dice-stat-value">x${minMultiplier}</div>
            <div class="dice-stat-label">Мин. множитель</div>
        </div>
        <div>
            <div class="dice-stat-value">${diceSettings.betMultipliers.length}</div>
            <div class="dice-stat-label">Доступно ставок</div>
        </div>
    `;
}

function updateDiceCombo(key, field, value) {
    if (diceSettings.combinations[key]) {
        diceSettings.combinations[key][field] = value;
        renderDiceCombinationsList();
        renderDiceStatsInfo();
        saveDiceSettingsDebounced();
    }
}

function updateDiceCost(value) {
    diceSettings.cost = parseInt(value) || 25;
    renderDiceStatsInfo();
    saveDiceSettingsDebounced();
}

function updateDiceJackpotBase(value) {
    diceSettings.jackpotBase = parseInt(value) || 1000;
    saveDiceSettingsDebounced();
}

function updateDiceJackpotChance(value) {
    diceSettings.jackpotChance = parseFloat(value) || 1;
    saveDiceSettingsDebounced();
}

function updateDiceJackpotContribution(value) {
    diceSettings.jackpotContribution = parseInt(value) || 10;
    saveDiceSettingsDebounced();
}

function toggleDiceActive(active) {
    diceSettings.active = active;
    saveDiceSettingsDebounced();
}

let saveDiceTimeout = null;

function saveDiceSettingsDebounced() {
    if (saveDiceTimeout) clearTimeout(saveDiceTimeout);
    saveDiceTimeout = setTimeout(() => saveDiceSettings(), 1000);
}

async function saveDiceSettings() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/games/${currentBusiness.id}/dice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: {
                    cost: diceSettings.cost,
                    jackpotBase: diceSettings.jackpotBase,
                    betMultipliers: diceSettings.betMultipliers,
                    combinations: diceSettings.combinations,
                    jackpotChance: diceSettings.jackpotChance,
                    jackpotContribution: diceSettings.jackpotContribution
                },
                active: diceSettings.active
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showSaveIndicator();
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек костей:', error);
    }
}

// ========== РОЗЫГРЫШИ (GIVEAWAYS) ==========

// Load giveaways from database
async function loadGiveaways() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/giveaways/${currentBusiness.id}`);
        const data = await response.json();
        
        if (data.success) {
            giveaways = data.giveaways;
            renderGiveawaysList();
        }
    } catch (error) {
        console.error('Ошибка загрузки розыгрышей:', error);
    }
}

// Render giveaways list
function renderGiveawaysList() {
    const container = document.getElementById('giveawaysList');
    if (!container) return;
    
    if (giveaways.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Нет розыгрышей. Добавьте первый розыгрыш!</div>';
        return;
    }
    
    container.innerHTML = giveaways.map(giveaway => {
        const now = new Date();
        const endDate = giveaway.end_date ? new Date(giveaway.end_date) : null;
        const isExpired = endDate && endDate < now;
        const isPaid = giveaway.is_paid;
        
        // Форматируем дату окончания
        let endDateText = '';
        if (endDate) {
            endDateText = endDate.toLocaleDateString('ru-RU') + ' ' + endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        
        return `
            <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e0e0e0; ${isExpired ? 'opacity: 0.6;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
                            🎰 ${escapeHtml(giveaway.name)}
                            ${isPaid ? '<span style="background: #ffd966; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">💎 Платный</span>' : '<span style="background: #a8e6cf; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">🎁 Бесплатный</span>'}
                            ${isExpired ? '<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⏰ Завершен</span>' : ''}
                        </div>
                        <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                            <a href="${escapeHtml(giveaway.link)}" target="_blank" style="color: #3498db; word-break: break-all;">
                                ${escapeHtml(giveaway.link)}
                            </a>
                        </div>
                        ${isPaid ? `<div style="font-size: 13px; color: #e67e22; margin-top: 4px;">💰 Стоимость доступа: ${giveaway.bonus_cost} бонусов</div>` : ''}
                        ${endDate ? `<div style="font-size: 12px; color: #999; margin-top: 4px;">📅 Действует до: ${endDateText}</div>` : ''}
                        ${giveaway.description ? `<div style="font-size: 13px; color: #555; margin-top: 8px;">${escapeHtml(giveaway.description)}</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: 16px;">
                        <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${giveaway.active && !isExpired ? '#e8f5e9' : '#ffebee'}; color: ${giveaway.active && !isExpired ? '#2e7d32' : '#c62828'};">
                            ${giveaway.active && !isExpired ? '✅ Активен' : '❌ Неактивен'}
                        </span>
                        <button onclick="editGiveaway(${giveaway.id})" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            ✏️
                        </button>
                        <button onclick="deleteGiveaway(${giveaway.id})" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🗑️
                        </button>
                    </div>
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 8px;">
                    Создан: ${new Date(giveaway.created_at).toLocaleString('ru-RU')}
                </div>
            </div>
        `;
    }).join('');
}

// Open giveaway modal
function openGiveawayModal() {
    currentEditingGiveawayId = null;
    document.getElementById('giveawayModalTitle').textContent = 'Добавить розыгрыш';
    document.getElementById('giveawayName').value = '';
    document.getElementById('giveawayLink').value = '';
    document.getElementById('giveawayDescription').value = '';
    document.getElementById('giveawayIsPaid').checked = false;
    document.getElementById('giveawayPaidFields').style.display = 'none';
    document.getElementById('giveawayBonusCost').value = 100;
    document.getElementById('giveawayEndDate').value = '';
    document.getElementById('giveawayActive').checked = true;
    document.getElementById('giveawayError').style.display = 'none';
    openModal('giveaway');
}

// Edit giveaway
function editGiveaway(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;
    
    currentEditingGiveawayId = id;
    document.getElementById('giveawayModalTitle').textContent = 'Редактировать розыгрыш';
    document.getElementById('giveawayName').value = giveaway.name;
    document.getElementById('giveawayLink').value = giveaway.link;
    document.getElementById('giveawayDescription').value = giveaway.description || '';
    document.getElementById('giveawayIsPaid').checked = giveaway.is_paid || false;
    
    // Показываем/скрываем поля в зависимости от is_paid
    const paidFields = document.getElementById('giveawayPaidFields');
    if (paidFields) {
        paidFields.style.display = (giveaway.is_paid) ? 'block' : 'none';
    }
    
    document.getElementById('giveawayBonusCost').value = giveaway.bonus_cost || 100;
    
    // Устанавливаем дату окончания
    if (giveaway.end_date) {
        const endDate = new Date(giveaway.end_date);
        const offset = endDate.getTimezoneOffset();
        const localDate = new Date(endDate.getTime() - (offset * 60 * 1000));
        document.getElementById('giveawayEndDate').value = localDate.toISOString().slice(0, 16);
    } else {
        document.getElementById('giveawayEndDate').value = '';
    }
    
    document.getElementById('giveawayActive').checked = giveaway.active;
    document.getElementById('giveawayError').style.display = 'none';
    openModal('giveaway');
}


async function saveGiveaway() {
    const name = document.getElementById('giveawayName').value.trim();
    const link = document.getElementById('giveawayLink').value.trim();
    const description = document.getElementById('giveawayDescription').value.trim();
    const active = document.getElementById('giveawayActive').checked;
    const is_paid = document.getElementById('giveawayIsPaid').checked;
    const bonus_cost = is_paid ? parseInt(document.getElementById('giveawayBonusCost').value) || 0 : 0;
    const end_date = document.getElementById('giveawayEndDate').value || null;
    const errorElement = document.getElementById('giveawayError');
    
    if (!name || !link) {
        errorElement.textContent = 'Заполните название и ссылку';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    try {
        new URL(link);
    } catch (e) {
        errorElement.textContent = 'Введите корректную ссылку';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    if (is_paid && (bonus_cost <= 0 || bonus_cost > 10000)) {
        errorElement.textContent = 'Стоимость доступа должна быть от 1 до 10000 бонусов';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
        return;
    }
    
    try {
        const data = {
            companyId: currentBusiness.id,
            name,
            link,
            description,
            active,
            is_paid,      // <-- ВАЖНО: передаём is_paid
            bonus_cost,   // <-- ВАЖНО: передаём bonus_cost
            end_date      // <-- ВАЖНО: передаём end_date
        };
        
        console.log('Отправляем данные розыгрыша:', data);
        
        let response;
        if (currentEditingGiveawayId) {
            response = await fetch(`${API_URL}/api/giveaways/${currentEditingGiveawayId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch(`${API_URL}/api/giveaways`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        const result = await response.json();
        if (result.success) {
            closeModal('giveaway');
            await loadGiveaways();
            showNotification('Розыгрыш сохранен', 'success');
        } else {
            errorElement.textContent = result.message || 'Ошибка сохранения';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 3000);
        }
    } catch (error) {
        console.error('Ошибка сохранения розыгрыша:', error);
        errorElement.textContent = 'Ошибка сервера';
        errorElement.style.display = 'block';
        setTimeout(() => errorElement.style.display = 'none', 3000);
    }
}
// Delete giveaway
async function deleteGiveaway(id) {
    if (!confirm('Удалить этот розыгрыш?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/giveaways/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            await loadGiveaways();
            showNotification('Розыгрыш удален', 'success');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления розыгрыша');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ========== РОЗЫГРЫШИ (GIVEAWAYS) С ПЛАТНЫМ ДОСТУПОМ ==========

// Переключение полей для платного розыгрыша
function toggleGiveawayPaidFields() {
    const isPaidCheckbox = document.getElementById('giveawayIsPaid');
    const paidFields = document.getElementById('giveawayPaidFields');
    
    if (isPaidCheckbox && paidFields) {
        paidFields.style.display = isPaidCheckbox.checked ? 'block' : 'none';
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ==========
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем сохраненную сессию
    checkSavedSession();
});

// ============ НАСТРОЙКИ БОНУСНОЙ СИСТЕМЫ ==========

let bonusSettings = {
    rubToBonus: 10,
    maxBonusPaymentPercent: 25,
    minPurchaseForBonus: 1000,
    bonusRatePerThousand: 10
};

async function loadBonusSettings() {
    if (!currentBusiness) {
        console.log('❌ currentBusiness не загружен, пропускаем загрузку настроек бонусов');
        return;
    }
    
    console.log('📝 Загрузка настроек бонусов для компании:', currentBusiness.id);
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/bonus-settings`);
        const data = await response.json();
        
        if (data.success) {
            bonusSettings = data.settings;
            console.log('✅ Настройки бонусов загружены:', bonusSettings);
            renderBonusSettings();
        } else {
            console.error('Ошибка загрузки:', data);
            renderBonusSettings(); // Рендерим с настройками по умолчанию
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек бонусов:', error);
        renderBonusSettings(); // Рендерим с настройками по умолчанию
    }
}

function renderBonusSettings() {
    const container = document.getElementById('bonusSettingsContainer');
    if (!container) {
        console.error('❌ Контейнер bonusSettingsContainer не найден в DOM!');
        return;
    }
    
    console.log('🎨 Рендерим настройки бонусов');
    
    container.innerHTML = `
        <div class="settings-card">
            <h3>💰 Настройки бонусной системы</h3>
            <div class="bonus-settings-description" style="margin-bottom: 20px; padding: 12px; background: #e8f5e9; border-radius: 12px;">
                <p style="margin: 0; font-size: 13px; color: #2e7d32;">
                    💡 Настройте параметры использования бонусов в вашей программе лояльности.
                    Процент начисления бонусов (кешбэк) настраивается в <strong>уровнях программы лояльности</strong>.
                </p>
            </div>
            
            <div class="bonus-setting-row">
                <div class="setting-info">
                    <label>💱 Курс: 1 рубль = ? бонусов</label>
                    <div class="setting-description">Сколько бонусов нужно потратить, чтобы оплатить 1 рубль</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="rubToBonus" value="${bonusSettings.rubToBonus}" min="1" max="1000" step="1" style="width: 120px; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                    <span class="setting-unit">бонусов = 1 ₽</span>
                </div>
            </div>
            
            <div class="bonus-setting-row">
                <div class="setting-info">
                    <label>📊 Максимальный процент оплаты бонусами</label>
                    <div class="setting-description">Какую часть стоимости заказа можно оплатить бонусами (0-100%)</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="maxBonusPaymentPercent" value="${bonusSettings.maxBonusPaymentPercent}" min="0" max="100" step="5" style="width: 120px; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                    <span class="setting-unit">% от суммы заказа</span>
                </div>
            </div>
            
            <div class="bonus-setting-row">
                <div class="setting-info">
                    <label>💰 Минимальная сумма для начисления бонусов</label>
                    <div class="setting-description">Минимальная сумма покупки для получения бонусов</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="minPurchaseForBonus" value="${bonusSettings.minPurchaseForBonus}" min="0" max="100000" step="100" style="width: 120px; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                    <span class="setting-unit">₽</span>
                </div>
            </div>
            
            <div class="bonus-preview" style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 12px;">
                <h4 style="margin-bottom: 12px;">📱 Предпросмотр в POS-терминале:</h4>
                <div style="background: white; padding: 16px; border-radius: 8px;">
                    <div style="margin-bottom: 8px;">
                        <span style="color: #666;">💰 Списание бонусов:</span>
                        <div style="font-size: 12px; color: #888; margin-top: 4px;">
                            📌 1 ₽ = <strong id="previewRubToBonus">${bonusSettings.rubToBonus}</strong> бонусов
                        </div>
                    </div>
                    <div id="previewMaxPayment" style="margin-bottom: 8px;">
                        <div style="font-size: 12px; color: #888;">
                            📌 Максимальный процент оплаты бонусами: <strong>${bonusSettings.maxBonusPaymentPercent}%</strong>
                        </div>
                        <div id="previewExample" style="font-size: 11px; color: #2ecc71; margin-top: 4px;">
                            Пример: при заказе на 1000₽ можно оплатить бонусами до ${Math.floor(1000 * bonusSettings.maxBonusPaymentPercent / 100)}₽ 
                            (${Math.floor(1000 * bonusSettings.maxBonusPaymentPercent / 100 * bonusSettings.rubToBonus)} бонусов)
                        </div>
                    </div>
                    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #9b59b6;">
                        ⭐ <strong>Кешбэк (начисление):</strong> настраивается в уровнях лояльности
                        <div style="font-size: 11px; color: #888; margin-top: 4px;">
                            Пример: при кешбэке 10% и покупке на 1000₽ → начисляется 100 бонусов
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="btn-save" onclick="saveBonusSettings()" style="margin-top: 20px; width: 100%;">💾 Сохранить настройки</button>
        </div>
    `;
    
    // Добавляем обработчики для обновления предпросмотра
    const rubToBonusInput = document.getElementById('rubToBonus');
    const maxPercentInput = document.getElementById('maxBonusPaymentPercent');
    
    if (rubToBonusInput) {
        rubToBonusInput.addEventListener('input', updateBonusPreview);
    }
    if (maxPercentInput) {
        maxPercentInput.addEventListener('input', updateBonusPreview);
    }
}

function updateBonusPreview() {
    const rubToBonus = parseInt(document.getElementById('rubToBonus')?.value) || 10;
    const maxPercent = parseInt(document.getElementById('maxBonusPaymentPercent')?.value) || 25;
    
    const previewRubToBonus = document.getElementById('previewRubToBonus');
    if (previewRubToBonus) {
        previewRubToBonus.textContent = rubToBonus;
    }
    
    const previewExample = document.getElementById('previewExample');
    if (previewExample) {
        const maxRub = Math.floor(1000 * maxPercent / 100);
        const maxBonuses = maxRub * rubToBonus;
        previewExample.innerHTML = `Пример: при заказе на 1000₽ можно оплатить бонусами до ${maxRub}₽ 
            (${maxBonuses} бонусов)`;
    }
}

async function saveBonusSettings() {
    if (!currentBusiness) {
        alert('❌ Компания не выбрана');
        return;
    }
    
    const rubToBonus = parseInt(document.getElementById('rubToBonus').value);
    const maxBonusPaymentPercent = parseInt(document.getElementById('maxBonusPaymentPercent').value);
    const minPurchaseForBonus = parseInt(document.getElementById('minPurchaseForBonus').value);
    
    // Валидация
    if (isNaN(rubToBonus) || rubToBonus < 1 || rubToBonus > 1000) {
        alert('❌ Курс рубль→бонус должен быть от 1 до 1000');
        return;
    }
    
    if (isNaN(maxBonusPaymentPercent) || maxBonusPaymentPercent < 0 || maxBonusPaymentPercent > 100) {
        alert('❌ Максимальный процент оплаты бонусами должен быть от 0 до 100');
        return;
    }
    
    if (isNaN(minPurchaseForBonus) || minPurchaseForBonus < 0) {
        alert('❌ Минимальная сумма для начисления бонусов должна быть >= 0');
        return;
    }
    
    const saveBtn = event.target;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '💾 Сохранение...';
    saveBtn.disabled = true;
    
    try {
        // ИСПРАВЛЕНО: убрали bonusRatePerThousand
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/bonus-settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rubToBonus,
                maxBonusPaymentPercent,
                minPurchaseForBonus
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            bonusSettings = data.settings;
            showSaveIndicator();
            alert('✅ Настройки бонусной системы сохранены!');
            renderBonusSettings();
        } else {
            alert('❌ Ошибка сохранения: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('❌ Ошибка подключения к серверу: ' + error.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}
// ============ УПРАВЛЕНИЕ ГОРОДАМИ И АДРЕСАМИ ==========

let cities = [];
let addresses = [];

async function loadCitiesAndAddresses() {
    if (!currentBusiness) return;
    
    try {
        // Загружаем города
        const citiesResponse = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/cities`);
        const citiesData = await citiesResponse.json();
        if (citiesData.success) {
            cities = citiesData.cities;
            renderCitiesList();
        }
        
        // Загружаем адреса
        const addressesResponse = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/addresses`);
        const addressesData = await addressesResponse.json();
        if (addressesData.success) {
            addresses = addressesData.addresses;
            renderAddressesList();
        }
    } catch (error) {
        console.error('Ошибка загрузки локаций:', error);
    }
}

function renderCitiesList() {
    const container = document.getElementById('citiesList');
    if (!container) return;
    
    if (!cities || cities.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Нет городов</div>';
        return;
    }
    
    container.innerHTML = cities.map(city => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
            <span>${escapeHtml(city.name)}</span>
            <div>
                <button onclick="editCity(${city.id})" style="background: #3498db; border: none; border-radius: 4px; padding: 4px 8px; color: white; cursor: pointer; margin-right: 4px;">✏️</button>
                <button onclick="deleteCity(${city.id})" style="background: #e74c3c; border: none; border-radius: 4px; padding: 4px 8px; color: white; cursor: pointer;">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderAddressesList() {
    const container = document.getElementById('addressesList');
    if (!container) return;
    
    if (!addresses || addresses.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Нет адресов</div>';
        return;
    }
    
    container.innerHTML = addresses.map(addr => `
        <div style="display: flex; justify-content: space-between; align-items: start; padding: 12px; border-bottom: 1px solid #eee; ${addr.is_main ? 'background: #e8f5e9;' : ''}">
            <div style="flex: 1;">
                <div>
                    <strong>${escapeHtml(addr.address)}</strong>
                    ${addr.is_main ? '<span style="background: #2ecc71; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">Основной</span>' : ''}
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                    ${addr.city_name ? `🏙️ ${escapeHtml(addr.city_name)}` : '🌍 Без города'}
                    ${addr.phone ? ` • 📞 ${addr.phone}` : ''}
                    ${addr.working_hours ? ` • ⏰ ${addr.working_hours.substring(0, 50)}${addr.working_hours.length > 50 ? '...' : ''}` : ''}
                </div>
            </div>
            <div>
                <button onclick="editAddress(${addr.id})" style="background: #3498db; border: none; border-radius: 4px; padding: 4px 8px; color: white; cursor: pointer; margin-right: 4px;">✏️</button>
                <button onclick="deleteAddress(${addr.id})" style="background: #e74c3c; border: none; border-radius: 4px; padding: 4px 8px; color: white; cursor: pointer;">🗑️</button>
            </div>
        </div>
    `).join('');
}

let currentEditingCityId = null;
let currentEditingAddressId = null;

function openCityModal() {
    currentEditingCityId = null;
    document.getElementById('cityModalTitle').textContent = '➕ Добавить город';
    document.getElementById('cityName').value = '';
    document.getElementById('citySortOrder').value = 0;
    document.getElementById('cityModal').style.display = 'flex';
}

function editCity(cityId) {
    const city = cities.find(c => c.id === cityId);
    if (!city) return;
    
    currentEditingCityId = cityId;
    document.getElementById('cityModalTitle').textContent = '✏️ Редактировать город';
    document.getElementById('cityName').value = city.name;
    document.getElementById('citySortOrder').value = city.sort_order || 0;
    document.getElementById('cityModal').style.display = 'flex';
}

async function saveCity() {
    const name = document.getElementById('cityName').value.trim();
    const sortOrder = parseInt(document.getElementById('citySortOrder').value) || 0;
    
    if (!name) {
        alert('Введите название города');
        return;
    }
    
    try {
        let response;
        if (currentEditingCityId) {
            response = await fetch(`${API_URL}/api/cities/${currentEditingCityId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, isActive: true, sortOrder })
            });
        } else {
            response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/cities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, sortOrder })
            });
        }
        
        const data = await response.json();
        if (data.success) {
            closeCityModal();
            await loadCitiesAndAddresses();
            alert(`Город ${currentEditingCityId ? 'обновлен' : 'добавлен'}!`);
        } else {
            alert('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка сохранения города:', error);
        alert('Ошибка сервера');
    }
}

async function deleteCity(cityId) {
    if (!confirm('Удалить город? Все адреса этого города также будут скрыты.')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/cities/${cityId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            await loadCitiesAndAddresses();
            alert('Город удален');
        }
    } catch (error) {
        console.error('Ошибка удаления города:', error);
        alert('Ошибка сервера');
    }
}

function closeCityModal() {
    document.getElementById('cityModal').style.display = 'none';
}

function openAddressModal() {
    currentEditingAddressId = null;
    document.getElementById('addressModalTitle').textContent = '➕ Добавить адрес';
    document.getElementById('addressCityId').value = '';
    document.getElementById('addressText').value = '';
    document.getElementById('addressLatitude').value = '';
    document.getElementById('addressLongitude').value = '';
    document.getElementById('addressPhone').value = '';
    document.getElementById('addressWorkingHours').value = '';
    document.getElementById('addressIsMain').checked = false;
    document.getElementById('addressModal').style.display = 'flex';
    
    // Заполняем select городов
    const citySelect = document.getElementById('addressCityId');
    citySelect.innerHTML = '<option value="">-- Без города --</option>' + 
        cities.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

function editAddress(addressId) {
    const address = addresses.find(a => a.id === addressId);
    if (!address) return;
    
    currentEditingAddressId = addressId;
    document.getElementById('addressModalTitle').textContent = '✏️ Редактировать адрес';
    
    const citySelect = document.getElementById('addressCityId');
    citySelect.innerHTML = '<option value="">-- Без города --</option>' + 
        cities.map(c => `<option value="${c.id}" ${address.city_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    
    document.getElementById('addressText').value = address.address;
    document.getElementById('addressLatitude').value = address.latitude || '';
    document.getElementById('addressLongitude').value = address.longitude || '';
    document.getElementById('addressPhone').value = address.phone || '';
    document.getElementById('addressWorkingHours').value = address.working_hours || '';
    document.getElementById('addressIsMain').checked = address.is_main || false;
    document.getElementById('addressModal').style.display = 'flex';
}

async function saveAddress() {
    const cityId = document.getElementById('addressCityId').value || null;
    const address = document.getElementById('addressText').value.trim();
    const latitude = document.getElementById('addressLatitude').value || null;
    const longitude = document.getElementById('addressLongitude').value || null;
    const phone = document.getElementById('addressPhone').value || null;
    const workingHours = document.getElementById('addressWorkingHours').value || null;
    const isMain = document.getElementById('addressIsMain').checked;
    
    if (!address) {
        alert('Введите адрес');
        return;
    }
    
    try {
        let response;
        if (currentEditingAddressId) {
            response = await fetch(`${API_URL}/api/addresses/${currentEditingAddressId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityId, address, latitude, longitude, phone, workingHours, isMain, isActive: true })
            });
        } else {
            response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityId, address, latitude, longitude, phone, workingHours, isMain })
            });
        }
        
        const data = await response.json();
        if (data.success) {
            closeAddressModal();
            await loadCitiesAndAddresses();
            alert(`Адрес ${currentEditingAddressId ? 'обновлен' : 'добавлен'}!`);
        } else {
            alert('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка сохранения адреса:', error);
        alert('Ошибка сервера');
    }
}

async function deleteAddress(addressId) {
    if (!confirm('Удалить адрес?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/addresses/${addressId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            await loadCitiesAndAddresses();
            alert('Адрес удален');
        }
    } catch (error) {
        console.error('Ошибка удаления адреса:', error);
        alert('Ошибка сервера');
    }
}

function closeAddressModal() {
    document.getElementById('addressModal').style.display = 'none';
}

// ========== МОДУЛЬ: СТРАНИЦА КАССИРА ==========

async function saveCashierCredentials() {
    if (!currentBusiness) {
        showCashierStatus('❌ Ошибка: компания не выбрана', 'error');
        return;
    }
    
    const login = document.getElementById('cashierLogin').value.trim();
    const password = document.getElementById('cashierPassword').value;
    const passwordConfirm = document.getElementById('cashierPasswordConfirm').value;
    
    if (!login || !password) {
        showCashierStatus('❌ Заполните все поля', 'error');
        return;
    }
    
    if (password !== passwordConfirm) {
        showCashierStatus('❌ Пароли не совпадают', 'error');
        return;
    }
    
    if (password.length < 4) {
        showCashierStatus('❌ Пароль должен быть не менее 4 символов', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/cashier-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showCashierStatus('✅ Данные кассира успешно сохранены!', 'success');
            // Clear password fields
            document.getElementById('cashierPassword').value = '';
            document.getElementById('cashierPasswordConfirm').value = '';
        } else {
            showCashierStatus('❌ ' + (data.message || 'Ошибка сохранения'), 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения данных кассира:', error);
        showCashierStatus('❌ Ошибка подключения к серверу', 'error');
    }
}

function showCashierStatus(message, type) {
    const statusEl = document.getElementById('cashierCredentialsStatus');
    if (!statusEl) return;
    
    statusEl.innerHTML = `<div class="${type === 'success' ? 'success' : 'error'}" style="padding: 12px; border-radius: 8px; margin-top: 8px;">${message}</div>`;
    
    setTimeout(() => {
        statusEl.innerHTML = '';
    }, 3000);
}

function openCashierPage() {
    // Open cashier.html in new window (no companyId needed - cashier page is independent)
    window.open('cashier.html', '_blank', 'width=800,height=900,scrollbars=yes');
}

async function loadCashierCredentials() {
    if (!currentBusiness) return;
    
    try {
        const response = await fetch(`${API_URL}/api/companies/${currentBusiness.id}/cashier-credentials`);
        const data = await response.json();
        
        if (data.success && data.credentials) {
            document.getElementById('cashierLogin').value = data.credentials.login || '';
            // Don't load password for security
        }
    } catch (error) {
        console.error('Ошибка загрузки данных кассира:', error);
    }
}

// ========== GREETING SETTINGS ==========

// Available emojis for selection
const availableEmojis = [
    '🏢', '🏪', '🏬', '🏭', '🏗️', '🏠', '🏡', '🏘️',
    '🍕', '☕', '🍔', '🍰', '🍩', '🧁', '🍦', '🍪',
    '🛍️', '🎁', '💎', '👗', '👟', '💄', '📱', '💻',
    '🏋️', '🎨', '📚', '🎭', '🎪', '🎬', '🎵', '⚽',
    '🏥', '💊', '🏨', '🚗', '⛽', '🔧', '💈', '🐾',
    '👋', '🎉', '🌟', '💫', '✨', '🎊', '🎈', '🔥'
];

// Initialize emoji picker
function initEmojiPicker() {
    const pickerContainer = document.getElementById('emojiPicker');
    if (!pickerContainer) {
        console.error('emojiPicker element not found');
        return;
    }
    
    pickerContainer.innerHTML = '';
    
    availableEmojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.type = 'button';
        emojiBtn.className = 'emoji-btn';
        emojiBtn.textContent = emoji;
        emojiBtn.style.cssText = `
            font-size: 24px;
            padding: 8px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
        `;
        
        emojiBtn.onmouseover = function() {
            this.style.transform = 'scale(1.2)';
            this.style.borderColor = '#667eea';
        };
        
        emojiBtn.onmouseout = function() {
            if (document.getElementById('selectedEmoji').value !== emoji) {
                this.style.transform = 'scale(1)';
                this.style.borderColor = '#e0e0e0';
            }
        };
        
        emojiBtn.onclick = function() {
            document.querySelectorAll('#emojiPicker .emoji-btn').forEach(btn => {
                btn.style.borderColor = '#e0e0e0';
                btn.style.background = 'white';
                btn.style.transform = 'scale(1)';
            });
            
            this.style.borderColor = '#667eea';
            this.style.background = '#f0f3ff';
            this.style.transform = 'scale(1.2)';
            
            document.getElementById('selectedEmoji').value = emoji;
            updateGreetingPreview();
        };
        
        pickerContainer.appendChild(emojiBtn);
    });
    
    // Select default emoji
    const defaultEmoji = document.getElementById('selectedEmoji').value;
    const defaultBtn = Array.from(document.querySelectorAll('#emojiPicker .emoji-btn')).find(
        btn => btn.textContent === defaultEmoji
    );
    if (defaultBtn) {
        defaultBtn.style.borderColor = '#667eea';
        defaultBtn.style.background = '#f0f3ff';
        defaultBtn.style.transform = 'scale(1.2)';
    }
}

// Update greeting preview
function updateGreetingPreview() {
    const emoji = document.getElementById('selectedEmoji').value;
    const fullText = document.getElementById('fullGreetingText').value || 'Добро пожаловать в нашу компанию!';
    
    let previewHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 8px;">${emoji}</div>
            <div style="font-size: 18px; opacity: 0.9;">Название компании</div>
    `;
    
    if (fullText) {
        previewHTML += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 14px; opacity: 0.8;">${fullText}</div>`;
    }
    
    previewHTML += `</div>`;
    
    document.getElementById('greetingPreview').innerHTML = previewHTML;
}

// Load greeting settings from backend
async function loadGreetingSettings() {
    if (!currentBusiness) {
        console.error('currentBusiness is null');
        return;
    }
    
    if (!currentBusiness.id) {
        console.error('currentBusiness.id is undefined:', currentBusiness);
        return;
    }
    
    console.log('Loading greeting settings for company ID:', currentBusiness.id);
    
    try {
        const url = `${API_URL}/api/companies/${currentBusiness.id}/greeting-settings`;
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success && data.settings) {
            document.getElementById('selectedEmoji').value = data.settings.company_emoji || '🏢';
            document.getElementById('fullGreetingText').value = data.settings.full_greeting_text || '';
            
            updateGreetingPreview();
            
            // Update emoji picker selection
            const selectedEmoji = data.settings.company_emoji || '🏢';
            document.querySelectorAll('#emojiPicker .emoji-btn').forEach(btn => {
                if (btn.textContent === selectedEmoji) {
                    btn.style.borderColor = '#667eea';
                    btn.style.background = '#f0f3ff';
                    btn.style.transform = 'scale(1.2)';
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек приветствия:', error);
    }
}

// Save greeting settings to backend
async function saveGreetingSettings() {
    if (!currentBusiness) {
        console.error('currentBusiness is null');
        showGreetingStatus('❌ Ошибка: компания не выбрана', 'error');
        return;
    }
    
    if (!currentBusiness.id) {
        console.error('currentBusiness.id is undefined:', currentBusiness);
        showGreetingStatus('❌ Ошибка: ID компании не найден', 'error');
        return;
    }
    
    const companyEmoji = document.getElementById('selectedEmoji').value;
    const fullGreetingText = document.getElementById('fullGreetingText').value.trim();
    
    console.log('=== Saving Greeting Settings ===');
    console.log('Company ID:', currentBusiness.id);
    console.log('Company Emoji:', companyEmoji);
    console.log('Full Greeting Text:', fullGreetingText);
    
    const payload = {
        greetingText: 'Welcome', // Required field, dummy value
        greetingEmoji: companyEmoji, // Required field, using company emoji
        companyEmoji: companyEmoji,
        fullGreetingText: fullGreetingText
    };
    
    console.log('Payload:', payload);
    
    try {
        const url = `${API_URL}/api/companies/${currentBusiness.id}/greeting-settings`;
        console.log('POST to URL:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            showGreetingStatus('✅ Настройки успешно сохранены!', 'success');
            updateGreetingPreview();
        } else {
            console.error('Server error:', data);
            showGreetingStatus('❌ ' + (data.message || data.error || 'Ошибка сохранения'), 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения приветствия:', error);
        showGreetingStatus('❌ Ошибка подключения: ' + error.message, 'error');
    }
}

// Show greeting status message
function showGreetingStatus(message, type) {
    const statusEl = document.getElementById('greetingStatus');
    if (!statusEl) return;
    
    statusEl.innerHTML = `<div style="padding: 12px; border-radius: 8px; margin-top: 8px; ${type === 'success' ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">${message}</div>`;
    
    setTimeout(() => {
        statusEl.innerHTML = '';
    }, 3000);
}

