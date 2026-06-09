import { apiFetch, clearAuth, getAccessToken, setAuthTokens } from "./config.js";

export const authService = {
    async getCurrentUser() {
        const token = getAccessToken();
        if (!token) return null;
        const user = await apiFetch("/api/auth/me");
        localStorage.setItem("excelai_current_user", JSON.stringify(user));
        return user;
    },

    async login(email, password) {
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        setAuthTokens(data);
        return data;
    },

    async register(name, email, password) {
        const data = await apiFetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });
        setAuthTokens(data);
        return data;
    },

    async logout() {
        try {
            await apiFetch("/api/auth/logout", { method: "POST" });
        } finally {
            clearAuth();
        }
    },

    saveCurrentUser(user) {
        localStorage.setItem("excelai_current_user", JSON.stringify(user));
    }
};

export default authService;
