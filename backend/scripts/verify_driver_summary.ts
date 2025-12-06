import fetch from 'node-fetch';

async function verify() {
    const API_URL = 'http://localhost:3001/api';
    console.log('🔍 Проверка endpoint Driver Blank Summary...');

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

        // 2. Get Drivers to find a driver ID
        console.log('2. Получение списка водителей...');
        const driversRes = await fetch(`${API_URL}/drivers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!driversRes.ok) {
            throw new Error(`Get Drivers failed: ${driversRes.status}`);
        }

        const driversData = await driversRes.json() as any;
        const drivers = driversData.data?.drivers || driversData.drivers || driversData;

        if (!drivers || drivers.length === 0) {
            console.log('⚠️ Нет водителей в системе, пропускаем тест summary.');
            console.log('🎉 ВЕРИФИКАЦИЯ ЧАСТИЧНО УСПЕШНА (нет данных для теста).');
            return;
        }

        const driverId = drivers[0].id;
        console.log(`✅ Найден водитель: ${drivers[0].employee?.fullName || driverId}`);

        // 3. Get Driver Blank Summary
        console.log(`3. Получение summary бланков для водителя ${driverId}...`);
        const summaryRes = await fetch(`${API_URL}/blanks/summary/driver/${driverId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!summaryRes.ok) {
            const errorText = await summaryRes.text();
            throw new Error(`Get Summary failed: ${summaryRes.status} - ${errorText}`);
        }

        const summary = await summaryRes.json();
        console.log('✅ Summary получен:', JSON.stringify(summary, null, 2));

        console.log('🎉 ВЕРИФИКАЦИЯ УСПЕШНА! Endpoint Driver Blank Summary работает.');

    } catch (err) {
        console.error('❌ Ошибка верификации:', err);
        process.exit(1);
    }
}

verify();
