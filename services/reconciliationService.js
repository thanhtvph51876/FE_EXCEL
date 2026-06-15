import { fileService } from "./fileService.js";

export const reconciliationService = {
    async runReconciliation(fileA, fileB, keyA, keyB, valA, valB, tolerance = 0) {
        const results = await fileService.performReconciliation(fileA, fileB, keyA, keyB, valA, valB);
        if (tolerance > 0) {
            results.mismatched = results.mismatched.filter(item => Math.abs(item.difference) > tolerance);
            results.mismatchedCount = results.mismatched.length;
        }
        return {
            matchedCount: results.matchedCount,
            mismatchedCount: results.mismatchedCount,
            missingInBCount: results.missingInBCount,
            missingInACount: results.missingInACount,
            totalDifference: results.mismatched.reduce((sum, item) => sum + Math.abs(item.difference || 0), 0),
            mismatched: results.mismatched,
            missingInB: results.missingInB,
            missingInA: results.missingInA,
            advice: results.aiNarrative || ""
        };
    }
};

export default reconciliationService;
