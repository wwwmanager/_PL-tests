/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDomainHealthCheck } from './mockApi';
import { resetMockApiState } from './mockApi';

// Mock dependencies if needed, but here we want to test the integration within mockApi
// We rely on mockApi's internal state which is reset via resetMockApiState

describe('runDomainHealthCheck', () => {
    beforeEach(() => {
        resetMockApiState();
    });

    it('should return ok: true for empty initial state', async () => {
        const result = await runDomainHealthCheck();
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.stats).toBeDefined();
        expect(result.stats?.waybillsCount).toBeGreaterThanOrEqual(0);
    });

    // We could add more tests here by manipulating mockApi state to create violations
    // but the core logic is in runDomainInvariants which is already tested.
    // This test ensures the glue code in mockApi works.
});
