import { useEffect, useState } from 'react';
import { getMyOrganization, OrganizationDto } from '../api/organizationApi';

export function useOrganization() {
    const [organization, setOrganization] = useState<OrganizationDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                const org = await getMyOrganization();
                if (!cancelled) {
                    setOrganization(org);
                    setError(null);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setError(e?.message ?? 'Failed to load organization');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    return { organization, loading, error };
}
