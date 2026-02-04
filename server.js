const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sed_system_secret_key_2024_change_in_production';

// ==================== УЛУЧШЕННЫЕ CORS НАСТРОЙКИ ====================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Length');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  
  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ==================== БАЗОВЫЕ НАСТРОЙКИ ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ==================== СОЗДАНИЕ ДИРЕКТОРИЙ ====================
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const LOGS_DIR = path.join(__dirname, 'logs');

[UPLOADS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Создана папка: ${dir}`);
  }
});

// ==================== ЛОГИРОВАНИЕ ====================
const logger = {
  info: (msg, data = {}) => {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: msg,
      ...data
    };
    console.log(JSON.stringify(log));
    fs.appendFileSync(path.join(LOGS_DIR, 'app.log'), JSON.stringify(log) + '\n');
  },
  error: (msg, err = {}) => {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: msg,
      error: err.message || err
    };
    console.error(JSON.stringify(log));
    fs.appendFileSync(path.join(LOGS_DIR, 'error.log'), JSON.stringify(log) + '\n');
  }
};

// ==================== НАСТРОЙКА MULTER ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[<>:"/\\|?*]/g, '_');
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Недопустимый тип файла: ${file.mimetype}`), false);
    }
  }
}).single('file');

// ==================== "БАЗА ДАННЫХ" В ПАМЯТИ ====================
let users = [];
let documents = [];

// Инициализация администратора
async function initAdmin() {
  const adminExists = users.find(u => u.username === 'admin');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    users.push({
      id: 1,
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date()
    });
    logger.info('Создан администратор по умолчанию');
  }
}

// ==================== АУТЕНТИФИКАЦИЯ ====================
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Требуется авторизация' 
      });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          error: 'Недействительный токен' 
        });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при аутентификации' 
    });
  }
};

// ==================== РОУТЫ ====================

// Главная страница
app.get('/', (req, res) => {
  res.redirect('/registry.html');
});

// Проверка здоровья
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uploadsDir: fs.existsSync(UPLOADS_DIR),
    timestamp: new Date().toISOString()
  });
});

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Заполните все поля' 
      });
    }
    
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Пользователь уже существует' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now(),
      username,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date()
    };
    
    users.push(user);
    
    res.status(201).json({ 
      success: true, 
      message: 'Регистрация успешна' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Заполните все поля' 
      });
    }
    
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверные учетные данные' 
      });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверные учетные данные' 
      });
    }
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      }, 
      SECRET_KEY, 
      { expiresIn: '8h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Загрузка файла - УПРОЩЕННАЯ ВЕРСИЯ
app.post('/api/upload', authenticateToken, (req, res) => {
  upload(req, res, async function(err) {
    try {
      if (err) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'Файл не был загружен' 
        });
      }
      
      // Генерация хеша файла
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileHash = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');
      
      const document = {
        id: Date.now(),
        name: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
        hash: fileHash,
        userId: req.user.userId,
        username: req.user.username,
        uploadedAt: new Date()
      };
      
      documents.push(document);
      
      // Отправляем УПРОЩЕННЫЙ ответ
      res.status(200).json({
        success: true,
        message: 'Файл успешно загружен',
        documentId: document.id,
        fileName: document.name,
        fileSize: document.size
      });
      
    } catch (error) {
      console.error('Upload processing error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка при обработке файла' 
      });
    }
  });
});

// Список документов
app.get('/api/documents', authenticateToken, (req, res) => {
  try {
    const userDocs = documents.filter(doc => doc.userId === req.user.userId);
    
    const formattedDocs = userDocs.map(doc => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      type: doc.type,
      uploadedAt: doc.uploadedAt,
      sizeFormatted: formatFileSize(doc.size)
    }));
    
    res.json({
      success: true,
      documents: formattedDocs
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при получении документов' 
    });
  }
});

// Скачивание документа
app.get('/api/download/:id', authenticateToken, (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const doc = documents.find(d => d.id === docId);
    
    if (!doc) {
      return res.status(404).json({ 
        success: false, 
        error: 'Документ не найден' 
      });
    }
    
    if (doc.userId !== req.user.userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступ запрещен' 
      });
    }
    
    const filePath = path.join(UPLOADS_DIR, doc.storedName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Файл не найден на сервере' 
      });
    }
    
    res.download(filePath, doc.name);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при скачивании файла' 
    });
  }
});

// Удаление документа
app.delete('/api/document/:id', authenticateToken, (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const docIndex = documents.findIndex(d => d.id === docId);
    
    if (docIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Документ не найден' 
      });
    }
    
    const doc = documents[docIndex];
    
    if (doc.userId !== req.user.userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступ запрещен' 
      });
    }
    
    // Удаление файла с диска
    const filePath = path.join(UPLOADS_DIR, doc.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Удаление из массива
    documents.splice(docIndex, 1);
    
    res.json({
      success: true,
      message: 'Документ удален'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при удалении документа' 
    });
  }
});

// Вспомогательная функция
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== ЗАПУСК СЕРВЕРА ====================
app.listen(PORT, async () => {
  await initAdmin();
  
  console.log(`
╔══════════════════════════════════════════════════╗
║           СЭД - ИСПРАВЛЕННАЯ ВЕРСИЯ             ║
╚══════════════════════════════════════════════════╝

✅ Сервер запущен: http://localhost:${PORT}
📁 Папка загрузок: ${UPLOADS_DIR}

👤 Тестовый пользователь:
   • Логин:    admin
   • Пароль:   Admin123!

🔧 Проверка здоровья:
   • GET http://localhost:${PORT}/api/health

════════════════════════════════════════════════════
  `);
});
