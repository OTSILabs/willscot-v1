import { getCurrentUserServerAction, type ServerCurrentUser } from "@/app/actions/current-user";
import Link from "next/link";

type UserRole = ServerCurrentUser["role"];

interface AccessGuardProps {
    children: React.ReactNode;
    allowed?: UserRole[];
}

export function AccessNotAllowed() {
    return (
        <div className="flex py-20 flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">
                You don&apos;t have permission to view this page.
            </p>
            <Link
                href="/traces"
                className="text-sm underline underline-offset-4 hover:no-underline"
            >
                Go back to Traces
            </Link>
        </div>
    );
}

export async function AccessGuard({ children, allowed }: AccessGuardProps) {
    if (!allowed || allowed.length === 0) {
        return <>{children}</>;
    }

    const currentUser = await getCurrentUserServerAction();
    if (!currentUser || !allowed.includes(currentUser.role)) {
        return <AccessNotAllowed />;
    }

    return <>{children}</>;
}

