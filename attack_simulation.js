// Скрипт для тестирования системы безопасности
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function simulateBruteForceAttack() {
    console.log('🚨 Начинаем имитацию атаки brute-force...');
    
    const fakeIP = `10.0.0.${Math.floor(Math.random() * 255)}`;
    
    for (let i = 1; i <= 10; i++) {
        try {
            await axios.post(`${BASE_URL}/login`, {
                username: 'admin',
                password: `wrong_password_${i}`
            }, {
                headers: {
                    'X-Forwarded-For': fakeIP
                }
            });
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.log(`✅ Атака заблокирована после ${i} попыток!`);
                return;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('❌ Атака не была заблокирована!');
}

async function simulateDDoSAttack() {
    console.log('🚨 Начинаем имитацию DDoS атаки...');
    
    const promises = [];
    for (let i = 0; i < 200; i++) {
        promises.push(
            axios.get(`${BASE_URL}/documents`, {
                headers: {
                    'Authorization': 'Bearer invalid_token'
                }
            }).catch(() => {})
        );
        
        if (i % 50 === 0) {
            console.log(`Отправлено ${i} запросов...`);
        }
    }
    
    await Promise.all(promises);
    console.log('✅ Имитация DDoS завершена');
}

async function simulateFileTampering() {
    console.log('🚨 Начинаем имитацию подмены файлов...');
    
    // 1. Создаем временный файл
    const fs = require('fs');
    const crypto = require('crypto');
    const path = require('path');
    
    const testFile = path.join(__dirname, 'test_file.txt');
    const secureFile = path.join(__dirname, 'secure_uploads', 'test_file.txt');
    
    // Создаем оригинальный файл
    fs.writeFileSync(testFile, 'Оригинальное содержимое документа');
    
    // Вычисляем хеш
    const originalHash = crypto.createHash('sha256')
        .update(fs.readFileSync(testFile))
        .digest('hex');
    
    console.log(`Оригинальный хеш: ${originalHash.substring(0, 16)}...`);
    
    // Подменяем содержимое
    fs.writeFileSync(testFile, 'ПОДМЕНЕННОЕ содержимое ВРЕДОНОСНЫМ кодом!');
    
    const tamperedHash = crypto.createHash('sha256')
        .update(fs.readFileSync(testFile))
        .digest('hex');
    
    console.log(`Хеш после подмены: ${tamperedHash.substring(0, 16)}...`);
    
    if (originalHash !== tamperedHash) {
        console.log('✅ Система должна обнаружить изменение хеша!');
    }
    
    // Очистка
    if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
    }
}

async function testAllProtections() {
    console.log('🧪 Тестирование системы защиты СЭД\n');
    
    await simulateBruteForceAttack();
    console.log('---');
    
    await simulateDDoSAttack();
    console.log('---');
    
    await simulateFileTampering();
    console.log('---');
    
    console.log('📊 Тестирование завершено!');
    console.log('Проверьте логи безопасности в security_logs.json');
}

// Запуск тестов
testAllProtections().catch(console.error);