/* ==========================================================================
   EXCELAI BOT - HISTORY PERSISTENCE SERVICE
   ========================================================================== */

export const historyService = {
    loadChatThreads(defaultThreads) {
        const data = localStorage.getItem("excelai_chat_threads");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse chat threads, dùng mặc định", e);
            }
        }
        return defaultThreads;
    },

    saveChatThreads(threads) {
        localStorage.setItem("excelai_chat_threads", JSON.stringify(threads));
    },

    loadOperationsHistory() {
        const data = localStorage.getItem("excelai_operations_history");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse operations history", e);
            }
        }
        // Trả về dữ liệu hoạt động mặc định nếu chưa có
        return [
            { id: 1, type: "VBA", action: "Tạo VBA: Gửi Email tự động", time: "09:00", date: "04/06/2026" },
            { id: 2, type: "Formula", action: "Tạo Formula: XLOOKUP nâng cao", time: "08:15", date: "03/06/2026" }
        ];
    },

    saveOperationsHistory(operations) {
        localStorage.setItem("excelai_operations_history", JSON.stringify(operations));
    },

    addOperation(type, action) {
        const list = this.loadOperationsHistory();
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        const dateStr = now.toLocaleDateString('vi-VN');
        
        list.unshift({
            id: Date.now(),
            type,
            action,
            time: timeStr,
            date: dateStr
        });
        
        if (list.length > 25) list.pop(); // Giới hạn 25 logs thao tác
        this.saveOperationsHistory(list);
        return list;
    },

    clearDemoData() {
        localStorage.removeItem("excelai_chat_threads");
        localStorage.removeItem("excelai_operations_history");
        localStorage.removeItem("excelai_users");
        localStorage.removeItem("excelai_apikeys");
        localStorage.removeItem("excelai_coupons");
        localStorage.removeItem("excelai_prompt_config");
    }
};
