import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export function LoyaltyCard({ userInfo, selectedGroup }) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Генерация QR-кода
    const generateQRCode = async () => {
        if (!userInfo || !selectedGroup) return;
        
        setIsGenerating(true);
        
        const qrDataString = JSON.stringify({
            vkId: userInfo.id,
            userName: `${userInfo.first_name} ${userInfo.last_name}`,
            companyId: selectedGroup.id,
            companyName: selectedGroup.name,
            timestamp: Date.now(),
            expiresIn: 5 * 60 * 1000,
            version: '1.0'
        });
        
        try {
            const qrDataUrl = await QRCode.toDataURL(qrDataString, {
                width: 300,
                margin: 2,
                color: {
                    dark: selectedGroup.color || '#000000',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'H'
            });
            setQrCodeUrl(qrDataUrl);
            setCountdown(300);
        } catch (err) {
            console.error('Ошибка генерации QR-кода:', err);
        } finally {
            setIsGenerating(false);
        }
    };
    
    // Таймер
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);
    
    // Автообновление
    useEffect(() => {
        generateQRCode();
        const interval = setInterval(() => generateQRCode(), 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [userInfo, selectedGroup]);
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>🎫 Моя карта лояльности</h3>
                <button onClick={generateQRCode} style={styles.refreshBtn} disabled={isGenerating}>
                    {isGenerating ? '🔄 Генерация...' : '🔄 Обновить'}
                </button>
            </div>
            
            <div style={styles.qrContainer}>
                {qrCodeUrl ? (
                    <img 
                        src={qrCodeUrl} 
                        alt="QR-код для кассы" 
                        style={styles.qrCode}
                    />
                ) : (
                    <div style={styles.qrPlaceholder}>
                        <div>{isGenerating ? 'Генерация QR-кода...' : '📱'}</div>
                    </div>
                )}
                
                <div style={styles.qrHint}>
                    <div>📸 Покажите этот QR-код кассиру</div>
                    <div style={styles.timer}>
                        ⏱️ Действителен: {formatTime(countdown)}
                    </div>
                </div>
            </div>
            
            <div style={styles.instruction}>
                <div style={styles.instructionTitle}>📖 Как использовать:</div>
                <ol style={styles.instructionList}>
                    <li>Покажите QR-код кассиру</li>
                    <li>Кассир отсканирует QR-код с помощью камеры или загрузит фото</li>
                    <li>Бонусы начислятся автоматически</li>
                </ol>
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: 'rgba(30, 35, 48, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: 28,
        padding: 20,
        marginBottom: 20,
        border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 18,
        fontWeight: 700,
        margin: 0,
        color: 'white'
    },
    refreshBtn: {
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        padding: '8px 16px',
        borderRadius: 20,
        color: 'white',
        fontSize: 12,
        cursor: 'pointer'
    },
    qrContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 20
    },
    qrCode: {
        width: 250,
        height: 250,
        borderRadius: 20,
        backgroundColor: 'white',
        padding: 10,
        cursor: 'pointer'
    },
    qrPlaceholder: {
        width: 250,
        height: 250,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#aaa',
        fontSize: 48
    },
    qrHint: {
        textAlign: 'center',
        marginTop: 12,
        fontSize: 12,
        opacity: 0.8,
        color: 'white'
    },
    timer: {
        fontSize: 11,
        color: '#ffd966',
        marginTop: 4
    },
    instruction: {
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 16,
        padding: 12,
        fontSize: 11,
        color: 'white'
    },
    instructionTitle: {
        fontWeight: 600,
        marginBottom: 8
    },
    instructionList: {
        marginLeft: 20,
        lineHeight: 1.6
    }
};