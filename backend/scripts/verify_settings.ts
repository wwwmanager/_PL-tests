import fetch from 'node-fetch';

async function verify() {
    const API_URL = 'http://localhost:3001/api';
    console.log('🔍 Проверка endpoint Settings...');

    try {
        // 1. Login
        console.log('1. Вход в систему...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: '123' })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.data.token;
        console.log('✅ Вход выполнен.');

        // 2. Get App Settings
        console.log('2. Получение AppSettings...');
        const appRes = await fetch(`${API_URL}/settings/app`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!appRes.ok) {
            const errorText = await appRes.text();
            throw new Error(`Get AppSettings failed: ${appRes.status} - ${errorText}`);
        }

        const appSettings = await appRes.json();
        console.log('✅ AppSettings получены:', JSON.stringify(appSettings, null, 2));

        // 3. Get Season Settings
        console.log('3. Получение SeasonSettings...');
        const seasonRes = await fetch(`${API_URL}/settings/season`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!seasonRes.ok) {
            const errorText = await seasonRes.text();
            throw new Error(`Get SeasonSettings failed: ${seasonRes.status} - ${errorText}`);
        }

        const seasonSettings = await seasonRes.json();
        console.log('✅ SeasonSettings получены:', JSON.stringify(seasonSettings, null, 2));

        // 4. Save App Settings (test PUT)
        console.log('4. Сохранение AppSettings (тест PUT)...');
        const updatedApp = { ...appSettings.data, appMode: 'central' };
        const saveAppRes = await fetch(`${API_URL}/settings/app`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedApp)
        });

        if (!saveAppRes.ok) {
            const errorText = await saveAppRes.text();
            throw new Error(`Save AppSettings failed: ${saveAppRes.status} - ${errorText}`);
        }

        console.log('✅ AppSettings сохранены.');

        console.log('🎉 ВЕРИФИКАЦИЯ УСПЕШНА! Settings API работает.');

    } catch (err) {
        console.error('❌ Ошибка верификации:', err);
        process.exit(1);
    }
}

verify();
