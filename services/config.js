export const API_BASE = window.EXCELAI_API_BASE || "http://localhost:8002";

const ACCESS_TOKEN_KEY = "excelai_token";
const REFRESH_TOKEN_KEY = "excelai_refresh_token";
const USER_KEY = "excelai_current_user";
let refreshPromise = null;

export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function pickAccessToken(payload = {}) {
    return payload.accessToken || payload.access_token || payload.token || "";
}

function pickRefreshToken(payload = {}) {
    return payload.refreshToken || payload.refresh_token || "";
}

export function setAuthTokens(payload = {}) {
    const accessToken = pickAccessToken(payload);
    const refreshToken = pickRefreshToken(payload);
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    return { accessToken, refreshToken, user: payload.user || null };
}

export function clearAuth() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
    return Boolean(getAccessToken());
}

function emitAuthExpired() {
    window.dispatchEvent(new CustomEvent("excelai:auth-expired"));
}

function buildHeaders(options = {}) {
    const token = getAccessToken();
    const isFormData = options.body instanceof FormData;
    return {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };
}

async function fetchJson(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: buildHeaders(options)
    });
    return res;
}

export async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        clearAuth();
        emitAuthExpired();
        throw new Error("Phiên đăng nhập đã hết hạn.");
    }

    if (!refreshPromise) {
        refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        })
            .then(async (res) => {
                if (!res.ok) {
                    clearAuth();
                    emitAuthExpired();
                    throw new Error("Phiên đăng nhập đã hết hạn.");
                }
                const payload = await res.json();
                setAuthTokens(payload);
                return payload;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

async function parseError(res) {
    const err = await res.json().catch(() => ({}));
    const message = err.message || err.detail || `Lỗi ${res.status}`;
    return new Error(String(message).replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]"));
}

export async function apiFetchWithAuth(path, options = {}) {
    const skipRefresh = options.skipAuthRefresh || path === "/api/auth/refresh";
    const requestOptions = { ...options };
    delete requestOptions.skipAuthRefresh;

    let res = await fetchJson(path, requestOptions);

    if (res.status === 401 && !skipRefresh && getRefreshToken()) {
        try {
            await refreshAccessToken();
            res = await fetchJson(path, requestOptions);
        } catch (err) {
            throw err;
        }
    } else if ((res.status === 401 || res.status === 403) && path === "/api/auth/refresh") {
        clearAuth();
        emitAuthExpired();
    }

    if (!res.ok) {
        throw await parseError(res);
    }

    if (res.status === 204) return null;
    return res.json();
}

export const apiFetch = apiFetchWithAuth;
