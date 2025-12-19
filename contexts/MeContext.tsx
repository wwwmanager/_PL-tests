// REL-001: Me Context Provider
// Provides user context across the app for debugging "empty lists" issues

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, type MeResponse } from "../services/api/meApi";

type MeState =
    | { status: "loading" }
    | { status: "unauthenticated" }
    | { status: "error"; error: string }
    | { status: "ready"; me: MeResponse };

const MeContext = createContext<MeState>({ status: "loading" });

export function MeProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<MeState>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const me = await getMe();
                if (!cancelled) setState({ status: "ready", me });
            } catch (e: any) {
                const status = e?.response?.status || e?.statusCode;
                if (status === 401) {
                    if (!cancelled) setState({ status: "unauthenticated" });
                } else {
                    if (!cancelled) setState({ status: "error", error: e?.message ?? "Ошибка загрузки /me" });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}

export function useMe() {
    return useContext(MeContext);
}

export default MeContext;
