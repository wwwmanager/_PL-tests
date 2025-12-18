import fetch from 'node-fetch';

async function verify() {
    const API_URL = 'http://localhost:3001/api';
    console.log('🔍 Проверка миграции Пользователей и Ролей...');

    try {
        // 1. Login
        console.log('1. Вход в систему (Login)...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: '123' })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.data.token;
        console.log('✅ Вход выполнен. Токен получен.');

        // 2. Get Users
        console.log('2. Получение списка пользователей...');
        const usersRes = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!usersRes.ok) {
            throw new Error(`Get Users failed: ${usersRes.status}`);
        }

        const users = await usersRes.json();
        console.log(`✅ Пользователи получены. Найдено: ${users.length}`);
        if (users.length > 0) {
            console.log('   Первый пользователь:', users[0].email, users[0].fullName);
        }

        // 3. Get Roles
        console.log('3. Получение списка ролей...');
        const rolesRes = await fetch(`${API_URL}/roles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!rolesRes.ok) {
            throw new Error(`Get Roles failed: ${rolesRes.status}`);
        }

        const roles = await rolesRes.json();
        console.log(`✅ Роли получены. Найдено: ${roles.length}`);
        if (roles.length > 0) {
            console.log('   Первая роль:', roles[0].code, roles[0].name);
        }

        console.log('🎉 ВЕРИФИКАЦИЯ УСПЕШНА! API Пользователей и Ролей работает.');

    } catch (err) {
        console.error('❌ Ошибка верификации:', err);
        process.exit(1);
    }
}

verify();
