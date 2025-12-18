/**
 * Quick Test Component for Backend API
 * Temporary - for testing waybill API adapter
 */

import { useEffect, useState } from 'react';
import { getWaybills } from '../services/waybillApi';

export function BackendApiTest() {
    const [waybills, setWaybills] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadWaybills() {
            try {
                console.log('🧪 Testing waybill API...');
                const data = await getWaybills();
                console.log('✅ Waybills loaded:', data);
                setWaybills(data);
            } catch (err) {
                console.error('❌ Error loading waybills:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        }

        loadWaybills();
    }, []);

    return (
        <div style={{ padding: '20px', background: '#f0f0f0', margin: '20px', borderRadius: '8px' }}>
            <h2 style={{ color: '#333' }}>🧪 Backend API Test</h2>

            {loading && <p>Loading waybills...</p>}

            {error && (
                <div style={{ background: '#ffcccc', padding: '10px', borderRadius: '4px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {!loading && !error && (
                <div>
                    <p><strong>✅ Loaded {waybills.length} waybills</strong></p>
                    <pre style={{ background: 'white', padding: '10px', overflow: 'auto', maxHeight: '300px' }}>
                        {JSON.stringify(waybills, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
