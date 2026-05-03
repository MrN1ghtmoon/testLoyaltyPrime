import os
import json
import random
import time
import threading
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# ========== КОНФИГУРАЦИЯ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ==========
TOKEN = os.getenv('VK_TOKEN', '')
APP_ID = os.getenv('APP_ID', '54517632')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3001')
PORT = int(os.getenv('PORT', 10000))

# Для Render отключаем Long Poll (он не работает в бесплатном тайере)
# Вместо этого используем только Flask API для отправки сообщений
USE_LONG_POLL = os.getenv('USE_LONG_POLL', 'false').lower() == 'true'

print(f"🚀 VK Bot starting...")
print(f"📱 App ID: {APP_ID}")
print(f"🔑 VK Token: {'✅ Set' if TOKEN else '❌ MISSING'}")
print(f"🔗 Backend URL: {BACKEND_URL}")
print(f"📡 Long Poll: {'✅ Enabled' if USE_LONG_POLL else '❌ Disabled (using API only)'}")
print(f"🌐 Port: {PORT}")

# Инициализация Flask
app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех

# Инициализация VK API (только для отправки сообщений)
vk = None
try:
    import vk_api
    from vk_api.utils import get_random_id
    
    if TOKEN:
        vk_session = vk_api.VkApi(token=TOKEN)
        vk = vk_session.get_api()
        print("✅ VK API initialized")
    else:
        print("❌ VK_TOKEN not set, bot will not work")
except Exception as e:
    print(f"❌ Failed to init VK API: {e}")


# ========== ФУНКЦИЯ ОТПРАВКИ СООБЩЕНИЙ ==========
def send_message(user_id, text, keyboard=None, attachment=None):
    """Отправка сообщения пользователю"""
    if not vk:
        print("❌ VK API not initialized")
        return False
    
    try:
        random_id = random.randint(1, 2 ** 63 - 1)
        params = {
            "peer_id": int(user_id),
            "message": text,
            "random_id": random_id
        }
        
        if keyboard:
            params["keyboard"] = json.dumps(keyboard, ensure_ascii=False)
        
        if attachment:
            params["attachment"] = attachment
        
        vk.messages.send(**params)
        print(f"✅ Sent to {user_id}: {text[:50]}...")
        return True
    except Exception as e:
        print(f"❌ Error sending to {user_id}: {e}")
        return False


# ========== ФУНКЦИЯ ЗАГРУЗКИ ИЗОБРАЖЕНИЙ ==========
def upload_photo_from_url(image_url):
    """Загружает изображение по ссылке на сервера VK"""
    if not vk:
        return None
    
    try:
        # Скачиваем изображение
        response = requests.get(image_url, timeout=30)
        if response.status_code != 200:
            print(f"❌ Failed to download image: {response.status_code}")
            return None
        
        # Получаем URL для загрузки
        upload_url = vk.photos.getMessagesUploadServer()['upload_url']
        
        # Загружаем на сервер VK
        upload_response = requests.post(upload_url, files={'photo': response.content})
        upload_data = upload_response.json()
        
        # Сохраняем изображение
        saved_photo = vk.photos.saveMessagesPhoto(
            server=upload_data['server'],
            photo=upload_data['photo'],
            hash=upload_data['hash']
        )
        
        photo_id = saved_photo[0]['id']
        owner_id = saved_photo[0]['owner_id']
        attachment = f"photo{owner_id}_{photo_id}"
        
        print(f"✅ Image uploaded: {attachment}")
        return attachment
        
    except Exception as e:
        print(f"❌ Error uploading image: {e}")
        return None


# ========== КЛАВИАТУРА ==========
def get_main_keyboard():
    return {
        "buttons": [
            [
                {"action": {"type": "text", "label": "📖 Описание"}, "color": "primary"},
                {"action": {"type": "open_app", "label": "🚀 Перейти в приложение", "app_id": int(APP_ID)}}
            ],
            [
                {"action": {"type": "text", "label": "ℹ️ Помощь"}, "color": "secondary"}
            ]
        ],
        "inline": False
    }


# ========== FLASK ENDPOINTS ==========

@app.route('/health', methods=['GET'])
def health():
    """Health check для Render"""
    return jsonify({
        'status': 'ok',
        'bot_active': vk is not None,
        'token_set': bool(TOKEN),
        'app_id': APP_ID,
        'timestamp': time.time()
    })


@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'name': 'Loyalty Prime VK Bot',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': ['/health', '/send_message', '/send_messages', '/send_campaign_messages']
    })


@app.route('/send_message', methods=['POST'])
def send_message_api():
    """Отправка одного сообщения (из backend)"""
    try:
        data = request.json
        user_id = data.get('user_id')
        message = data.get('message')
        keyboard = data.get('keyboard')
        
        if not user_id or not message:
            return jsonify({'success': False, 'error': 'user_id and message required'}), 400
        
        success = send_message(user_id, message, keyboard)
        
        return jsonify({
            'success': success,
            'user_id': user_id
        })
    except Exception as e:
        print(f"❌ Error in send_message: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/send_messages', methods=['POST'])
def send_messages():
    """Массовая рассылка сообщений (из CRM)"""
    try:
        data = request.json
        title = data.get('title', '')
        message = data.get('message', '')
        image_url = data.get('image_url')
        button_link = data.get('button_link')
        button_text = data.get('button_text', 'Перейти')
        users = data.get('users', [])
        
        print(f"📨 Received broadcast task for {len(users)} users")
        
        full_message = f"📢 {title}\n\n{message}"
        sent_count = 0
        failed_count = 0
        
        # Загружаем изображение один раз
        photo_attachment = None
        if image_url:
            photo_attachment = upload_photo_from_url(image_url)
        
        # Создаем клавиатуру с кнопкой
        keyboard = None
        if button_link:
            keyboard = {
                "buttons": [[{"action": {"type": "open_link", "link": button_link, "label": button_text}}]],
                "inline": True
            }
        
        for user in users:
            vk_id = user.get('vk_id')
            try:
                if photo_attachment:
                    success = send_message(vk_id, full_message, keyboard, photo_attachment)
                elif image_url:
                    success = send_message(vk_id, full_message + f"\n\n🖼️ Изображение: {image_url}", keyboard)
                else:
                    success = send_message(vk_id, full_message, keyboard)
                
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
                
                time.sleep(0.05)  # Небольшая задержка
                
            except Exception as e:
                print(f"❌ Error sending to {vk_id}: {e}")
                failed_count += 1
        
        print(f"✅ Broadcast complete: sent={sent_count}, failed={failed_count}")
        
        return jsonify({
            'success': True,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'total': len(users)
        })
        
    except Exception as e:
        print(f"❌ Error in send_messages: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/send_campaign_messages', methods=['POST'])
def send_campaign_messages():
    """Отправка сообщений кампании"""
    try:
        data = request.json
        campaign_id = data.get('campaign_id')
        title = data.get('title', '')
        message = data.get('message', '')
        image_url = data.get('image_url')
        button_link = data.get('button_link')
        button_text = data.get('button_text', 'Перейти')
        users = data.get('users', [])
        
        print(f"📨 Received campaign {campaign_id} task for {len(users)} users")
        
        full_message = f"{title}\n\n{message}"
        sent_count = 0
        failed_count = 0
        
        # Загружаем изображение один раз
        photo_attachment = None
        if image_url:
            photo_attachment = upload_photo_from_url(image_url)
        
        # Создаем клавиатуру с кнопкой
        keyboard = None
        if button_link:
            keyboard = {
                "buttons": [[{"action": {"type": "open_link", "link": button_link, "label": button_text}}]],
                "inline": True
            }
        
        for user in users:
            vk_id = user.get('vk_id')
            try:
                if photo_attachment:
                    success = send_message(vk_id, full_message, keyboard, photo_attachment)
                elif image_url:
                    success = send_message(vk_id, full_message + f"\n\n🖼️ Изображение: {image_url}", keyboard)
                else:
                    success = send_message(vk_id, full_message, keyboard)
                
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
                
                time.sleep(0.05)
                
            except Exception as e:
                print(f"❌ Error sending campaign to {vk_id}: {e}")
                failed_count += 1
        
        print(f"✅ Campaign {campaign_id} complete: sent={sent_count}, failed={failed_count}")
        
        return jsonify({
            'success': True,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'total': len(users)
        })
        
    except Exception as e:
        print(f"❌ Error in send_campaign_messages: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/send_messages_status', methods=['GET'])
def send_messages_status():
    return jsonify({'status': 'ok', 'bot_active': vk is not None})


# ========== LONG POLL БОТ (ОПЦИОНАЛЬНО) ==========
def run_longpoll():
    """Запуск Long Poll бота в отдельном потоке (только если USE_LONG_POLL=true)"""
    if not USE_LONG_POLL:
        print("📡 Long Poll disabled (USE_LONG_POLL=false)")
        return
    
    if not vk:
        print("❌ Cannot start Long Poll: VK API not initialized")
        return
    
    try:
        vk_session = vk_api.VkApi(token=TOKEN)
        longpoll = VkLongPoll(vk_session)
        
        print("📡 Long Poll bot started. Waiting for messages...")
        
        while True:
            try:
                for event in longpoll.listen():
                    if event.type == VkEventType.MESSAGE_NEW and event.to_me:
                        user_id = event.user_id
                        text = event.text.lower().strip()
                        print(f"💬 Message from {user_id}: '{text}'")
                        
                        if text in ('привет', 'start', 'начать'):
                            send_message(user_id, "👋 Привет! Добро пожаловать!\n\nИспользуй кнопки ниже.", get_main_keyboard())
                        elif text in ('описание', '📖 описание'):
                            send_message(user_id, "📖 **Наше предложение**\n\nБонусы, акции, личный кабинет.\nНажмите «Перейти в приложение»!", get_main_keyboard())
                        elif text in ('помощь', 'ℹ помощь', 'ℹ️ помощь'):
                            send_message(user_id, "ℹ️ **Помощь**\n\n• Описание — подробности.\n• Перейти в приложение — запуск Mini App.\n• Бот присылает уведомления.", get_main_keyboard())
                        else:
                            send_message(user_id, "Пожалуйста, используйте кнопки меню.", get_main_keyboard())
                            
            except Exception as e:
                print(f"❌ Long Poll error: {e}, reconnecting in 5 seconds...")
                time.sleep(5)
                
    except Exception as e:
        print(f"❌ Failed to start Long Poll: {e}")


# ========== ЗАПУСК ==========
if __name__ == '__main__':
    # Запускаем Long Poll в отдельном потоке (если включен)
    if USE_LONG_POLL:
        longpoll_thread = threading.Thread(target=run_longpoll, daemon=True)
        longpoll_thread.start()
    
    # Запускаем Flask сервер
    print(f"🚀 Flask server starting on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)