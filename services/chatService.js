import { aiService } from "./aiService.js";

export const chatService = {
    async askFile(fileObj, question) {
        const answer = await aiService.generateChatResponse(question, [], "", fileObj?.id || null);
        return {
            answer,
            summary: `Phân tích tệp ${fileObj?.name || "đang chọn"}`,
            recommendedAction: "Xem báo cáo biểu đồ"
        };
    }
};

export default chatService;
