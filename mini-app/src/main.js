import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { App } from './App.js';

// Инициализируем VK Bridge
vkBridge.send('VKWebAppInit');

// Рендерим приложение
createRoot(document.getElementById('root')).render(<App />);