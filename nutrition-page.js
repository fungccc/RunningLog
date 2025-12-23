// 1. 複製 Prompt 到剪貼簿
function copyPrompt() {
    const promptText = `# Role
你是一個專業的馬拉松補給品資料輸入助理... (此處填入上方 prompt.txt 的完整內容) ...依照上述規則產出 JSON Array。`;

    navigator.clipboard.writeText(promptText).then(() => {
        alert("指令已複製！請前往 ChatGPT 貼上。");
    }).catch(err => {
        console.error('複製失敗:', err);
    });
}

// 2. 解析 JSON 並寫入 Firestore
async function parseAndImportAI() {
    const inputStr = document.getElementById('aiJsonInput').value.trim();
    if (!inputStr) return;

    try {
        // 清洗資料：有時候 AI 還是會包在 ```json ... ``` 裡面
        let cleanStr = inputStr;
        // 移除開頭的 ```json 或 ```
        cleanStr = cleanStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
        // 移除結尾的 ```
        cleanStr = cleanStr.replace(/\s*```$/, '');

        const nutritionItems = JSON.parse(cleanStr);

        if (!Array.isArray(nutritionItems)) {
            throw new Error("格式錯誤：必須是 JSON Array [...]");
        }

        // 批次寫入 Firestore
        const batch = db.batch();
        const userUid = firebase.auth().currentUser.uid;
        const colRef = db.collection('users').doc(userUid).collection('nutrition_db');

        let count = 0;
        nutritionItems.forEach(item => {
            // 基本驗證，確保必要欄位存在
            if (!item.name) return;

            const docRef = colRef.doc(); // 自動產生 ID
            batch.set(docRef, {
                ...item,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            count++;
        });

        await batch.commit();
        
        alert(`成功匯入 ${count} 筆補給品資料！`);
        document.getElementById('aiJsonInput').value = ''; // 清空
        // 此處應呼叫重新讀取列表的函式，例如 loadNutritionList();

    } catch (e) {
        alert("解析失敗，請確認貼上的是正確的 JSON 格式。\n錯誤訊息: " + e.message);
        console.error(e);
    }
}
