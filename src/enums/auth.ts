export const AuthEnums = {
    AUTHENTICATED: "AUTHENTICATED",
    UNAUTHENTICATED: "UNAUTHENTICATED",
    CHECKING: "CHECKING",
} as const;

export type AuthStatus = (typeof AuthEnums)[keyof typeof AuthEnums];
