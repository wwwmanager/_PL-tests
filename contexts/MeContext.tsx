// REL-001: Me Context Provider
// Provides user context across the app for debugging "empty lists" issues

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMe, type MeResponse } from "../services/api/meApi";

type MeState =
    | { status: "loading" }
    | { status: "unauthenticated" }
    | { status: "error"; error: string }
    | { status: "ready"; me: MeResponse };

type MeContextValue = MeState & {
    refetch: () => Promise<void>;
};

const MeContext = createContext<MeContextValue>({ status: "loading", refetch: async () => { } });

export function MeProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<MeState>({ status: "loading" });

    const fetchMe = useCallback(async () => {
        setState({ status: "loading" });
        try {
            const me = await getMe();
            setState({ status: "ready", me });
        } catch (e: any) {
            const status = e?.response?.status || e?.statusCode;
            if (status === 401) {
                setState({ status: "unauthenticated" });
            } else {
                setState({ status: "error", error: e?.message ?? "Ошибка загрузки /me" });
            }
        }
    }, []);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    const value: MeContextValue = {
        ...state,
        refetch: fetchMe,
    };

    return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
    return useContext(MeContext);
}

export default MeContext;
