// Общие функции для всех страниц

// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('sed_token');
    const userData = localStorage.getItem('sed_user');
    
    if (!token || !userData) {
        return null;
    }
    
    try {
        return JSON.parse(userData);
    } catch (error) {
        return null;
    }
}

// Показ уведомлений
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => {
        if (n.parentNode) n.remove();
    });
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <div>${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Получение иконки файла по MIME типу
function getFileIcon(mimeType) {
    if (!mimeType) return 'fas fa-file';
    
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (mimeType.includes('image')) return 'fas fa-file-image';
    if (mimeType.includes('text')) return 'fas fa-file-alt';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fas fa-file-archive';
    
    return 'fas fa-file';
}

// Выход из системы
function logout() {
    localStorage.removeItem('sed_token');
    localStorage.removeItem('sed_user');
    window.location.href = '/registry.html';
}

// Проверка на главной странице
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    const user = checkAuth();
    if (user) {
        document.querySelector('.nav-links').innerHTML += `
            <li><a href="/main.html" class="nav-link">Мои документы</a></li>
            <li><a href="#" onclick="logout()" class="nav-link">Выход (${user.username})</a></li>
        `;
    }
}