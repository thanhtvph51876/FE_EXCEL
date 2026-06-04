/* ==========================================================================
   EXCELAI BOT - DATA RECONCILIATION SERVICE (MOCK)
   ========================================================================== */

import { fileService } from './fileService.js';
import { aiService } from './aiService.js';

export const reconciliationService = {
    runReconciliation(fileA, fileB, keyA, keyB, valA, valB, tolerance = 0) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const results = fileService.performReconciliation(fileA, fileB, keyA, keyB, valA, valB);
                
                // Post-process based on tolerance
                if (tolerance > 0) {
                    const originalMismatchCount = results.mismatched.length;
                    results.mismatched = results.mismatched.filter(m => Math.abs(m.difference) > tolerance);
                    results.mismatchedCount = results.mismatched.length;
                    
                    // Subtract from total mismatch amount
                    let totalValDiff = 0;
                    results.mismatched.forEach(m => totalValDiff += Math.abs(m.difference));
                    results.totalDifference = totalValDiff;
                }
                
                const advice = aiService.generateReconciliationSuggestions(results);
                
                resolve({
                    matchedCount: results.matchedCount,
                    mismatchedCount: results.mismatchedCount,
                    missingInBCount: results.missingInBCount,
                    missingInACount: results.missingInACount,
                    totalDifference: results.totalDifference || 0,
                    mismatched: results.mismatched,
                    missingInB: results.missingInB,
                    missingInA: results.missingInA,
                    advice
                });
            }, 1000);
        });
    }
};

export default reconciliationService;
