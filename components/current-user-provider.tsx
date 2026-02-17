"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface CurrentUser {
    id: string;
    name: string;
    email: string;
    role: "power_user" | "normal_user";
}

interface CurrentUserContextValue {
    currentUser: CurrentUser | null;
    setCurrentUser: (user: CurrentUser | null) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined);

export function CurrentUserProvider({
    children,
    initialUser,
}: {
    children: React.ReactNode;
    initialUser: CurrentUser | null;
}) {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialUser);

    const value = useMemo(
        () => ({ currentUser, setCurrentUser }),
        [currentUser],
    );

    return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
    const context = useContext(CurrentUserContext);
    if (!context) {
        throw new Error("useCurrentUser must be used within a CurrentUserProvider");
    }
    return context;
}

