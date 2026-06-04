/* ==========================================================================
   EXCELAI BOT - SYSTEM MANAGEMENT AND ADMIN SERVICE
   ========================================================================== */

import { initialApiKeys, initialSystemLogs, initialPromptConfig, initialJobs, initialFeedbacks } from './mockData.js';

export const adminService = {
    loadAPIKeys() {
        const data = localStorage.getItem("excelai_apikeys");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse API Keys", e);
            }
        }
        localStorage.setItem("excelai_apikeys", JSON.stringify(initialApiKeys));
        return initialApiKeys;
    },

    saveAPIKeys(keys) {
        localStorage.setItem("excelai_apikeys", JSON.stringify(keys));
    },

    loadPromptConfig() {
        const data = localStorage.getItem("excelai_prompt_config");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse prompt config", e);
            }
        }
        localStorage.setItem("excelai_prompt_config", JSON.stringify(initialPromptConfig));
        return initialPromptConfig;
    },

    savePromptConfig(config) {
        localStorage.setItem("excelai_prompt_config", JSON.stringify(config));
    },

    loadSystemLogs() {
        const data = localStorage.getItem("excelai_system_logs");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse system logs", e);
            }
        }
        localStorage.setItem("excelai_system_logs", JSON.stringify(initialSystemLogs));
        return initialSystemLogs;
    },

    saveSystemLogs(logs) {
        localStorage.setItem("excelai_system_logs", JSON.stringify(logs));
    },

    addSystemLog(type, text) {
        const logs = this.loadSystemLogs();
        const timeNow = new Date().toTimeString().split(' ')[0];
        logs.push({ time: timeNow, type, text });
        if (logs.length > 30) logs.shift();
        this.saveSystemLogs(logs);
        return logs;
    },

    getSystemDashboardMetrics(users) {
        const totalUsers = users.length + 15477;
        const activeUsersCount = users.filter(u => u.status === "Hoạt động").length + 12845;
        
        let totalRequests = 0;
        users.forEach(u => totalRequests += u.usageCount);
        totalRequests += 128470;
        
        const filesProcessed = Math.round(totalRequests * 0.45);
        
        // Dynamic counts
        const jobs = this.loadJobs();
        const failedJobs = jobs.filter(j => j.status === "failed").length;
        const errorRate = ((failedJobs / Math.max(1, jobs.length)) * 10).toFixed(2) + "%";

        return {
            totalUsers,
            activeUsers: activeUsersCount,
            totalRequests,
            filesProcessed,
            uptime: "99.98%",
            errorRate: errorRate
        };
    },

    // QUẢN LÝ JOBS/FILES MONITORING
    loadJobs() {
        const data = localStorage.getItem("excelai_jobs");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse jobs", e);
            }
        }
        localStorage.setItem("excelai_jobs", JSON.stringify(initialJobs));
        return initialJobs;
    },

    saveJobs(jobs) {
        localStorage.setItem("excelai_jobs", JSON.stringify(jobs));
    },

    addJob(fileName, owner, size, type, status, duration = "0.5s", error = "") {
        const jobs = this.loadJobs();
        const newJob = {
            id: "job_" + Date.now(),
            fileName,
            owner,
            size,
            type,
            status,
            duration,
            error
        };
        jobs.unshift(newJob);
        if (jobs.length > 50) jobs.pop();
        this.saveJobs(jobs);
        return newJob;
    },

    // QUẢN LÝ FEEDBACK & SUPPORT
    loadFeedbacks() {
        const data = localStorage.getItem("excelai_feedbacks");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse feedbacks", e);
            }
        }
        localStorage.setItem("excelai_feedbacks", JSON.stringify(initialFeedbacks));
        return initialFeedbacks;
    },

    saveFeedbacks(feedbacks) {
        localStorage.setItem("excelai_feedbacks", JSON.stringify(feedbacks));
    },

    addFeedback(userName, type, text) {
        const feedbacks = this.loadFeedbacks();
        const newFb = {
            id: Date.now(),
            userName,
            type,
            text,
            status: "new",
            reply: ""
        };
        feedbacks.unshift(newFb);
        this.saveFeedbacks(feedbacks);
        return newFb;
    },

    replyFeedback(id, replyText) {
        const feedbacks = this.loadFeedbacks();
        const fb = feedbacks.find(f => f.id === id);
        if (fb) {
            fb.reply = replyText;
            fb.status = "resolved";
            this.saveFeedbacks(feedbacks);
            return fb;
        }
        return null;
    },

    // THIẾT LẬP BẢO MẬT & ADMIN SETTINGS
    loadSecuritySettings() {
        const data = localStorage.getItem("excelai_security_settings");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse security settings", e);
            }
        }
        const defaultSettings = {
            fileSizeLimit: 10, // MB
            allowedTypes: ".csv, .xlsx, .xls",
            dataRetention: 30, // days
            enableMacroWarning: true,
            rateLimit: 100, // requests/min
            sensitiveDataWarning: true,
            adminAccessControl: "IP Whitelist (Disabled)",
            maintenanceMode: false,
            appName: "ExcelAI Workspace",
            supportEmail: "support@excelai.com"
        };
        localStorage.setItem("excelai_security_settings", JSON.stringify(defaultSettings));
        return defaultSettings;
    },

    saveSecuritySettings(settings) {
        localStorage.setItem("excelai_security_settings", JSON.stringify(settings));
    }
};

export default adminService;
