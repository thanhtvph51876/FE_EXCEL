export const API_BASE = window.EXCELAI_API_BASE || "http://127.0.0.1:8002";
let resolvedApiBase = "";

const ACCESS_TOKEN_KEY = "excelai_token";
const REFRESH_TOKEN_KEY = "excelai_refresh_token";
const USER_KEY = "excelai_current_user";
let refreshPromise = null;
let memoryAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
let memoryRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY) || "";

function migrateLegacyLocalStorageTokens() {
    const legacyAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    const legacyRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || "";
    if (!memoryAccessToken && legacyAccessToken) {
        memoryAccessToken = legacyAccessToken;
        sessionStorage.setItem(ACCESS_TOKEN_KEY, legacyAccessToken);
    }
    if (!memoryRefreshToken && legacyRefreshToken) {
        memoryRefreshToken = legacyRefreshToken;
        sessionStorage.setItem(REFRESH_TOKEN_KEY, legacyRefreshToken);
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

migrateLegacyLocalStorageTokens();

export function getAccessToken() {
    return memoryAccessToken || sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getRefreshToken() {
    return memoryRefreshToken || sessionStorage.getItem(REFRESH_TOKEN_KEY) || "";
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
    if (accessToken) {
        memoryAccessToken = accessToken;
        sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    if (refreshToken) {
        memoryRefreshToken = refreshToken;
        sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    return { accessToken, refreshToken, user: payload.user || null };
}

export function clearAuth() {
    memoryAccessToken = "";
    memoryRefreshToken = "";
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

function backendCandidates() {
    const configured = window.EXCELAI_API_BASE || API_BASE;
    const candidates = [configured];
    if (configured.includes("127.0.0.1")) candidates.push(configured.replace("127.0.0.1", "localhost"));
    if (configured.includes("localhost")) candidates.push(configured.replace("localhost", "127.0.0.1"));
    return [...new Set(candidates)];
}

export function getApiBase() {
    return resolvedApiBase || API_BASE;
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

async function fetchBackend(path, options = {}) {
    const bases = resolvedApiBase ? [resolvedApiBase, ...backendCandidates().filter(base => base !== resolvedApiBase)] : backendCandidates();
    let lastError = null;
    for (const base of bases) {
        try {
            const res = await fetch(`${base}${path}`, {
                ...options,
                headers: buildHeaders(options)
            });
            resolvedApiBase = base;
            return res;
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Không kết nối được backend tại ${backendCandidates().join(" hoặc ")}. Hãy kiểm tra server API đang chạy trên port 8002.`);
}

export async function fetchWithBackendFallback(path, options = {}) {
    return fetchBackend(path, options);
}

async function fetchJson(path, options = {}) {
    try {
        const res = await fetchBackend(path, {
            ...options,
            headers: buildHeaders(options)
        });
        return res;
    } catch (error) {
        throw error;
    }
}

export async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        clearAuth();
        emitAuthExpired();
        throw new Error("Phiên đăng nhập đã hết hạn.");
    }

    if (!refreshPromise) {
        refreshPromise = fetchBackend("/api/auth/refresh", {
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
    const isAuthEntryPoint = path === "/api/auth/login" || path === "/api/auth/register";
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
    } else if (res.status === 401 && !skipRefresh && !isAuthEntryPoint) {
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
