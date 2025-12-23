// csv-utils.js

// 輔助：將 "H:MM:SS" 或 "MM:SS" 轉為總秒數
function timeStrToSec(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // 假設是 MM:SS
    }
    return 0;
}

// 輔助：根據距離判斷賽事類別
function getDistanceCategory(km) {
    if (Math.abs(km - 42.195) < 2) return 'FM';
    if (Math.abs(km - 21.0975) < 2) return 'HM';
    if (Math.abs(km - 10) < 1) return '10K';
    if (Math.abs(km - 5) < 1) return '5K';
    return 'other';
}

// 核心：將舊 CSV 的一行轉換為 Firestore Activity 物件
function convertLegacyRaceRow(row) {
    // 處理距離： "21 km" -> 21.0
    const rawDist = row['距離'] || "0";
    const distVal = parseFloat(rawDist.replace(/[^\d.]/g, '')); // 移除 " km" 等非數字字元

    // 處理時間
    const finishTimeStr = row['完成時間'] || "0:00:00";
    
    return {
        type: 'race', // 舊資料全為比賽
        date: row['比賽日期'] || new Date().toISOString().split('T')[0],
        
        // 通用欄位
        distanceKm: distVal,
        distanceInputValue: distVal,
        distanceInputUnit: 'km',
        durationSec: timeStrToSec(finishTimeStr),
        locationName: row['地點'] || '',
        note: row['備註'] || '',
        locationMapUrl: '', // 舊資料無 URL
        rpe: 0, // 舊資料無 RPE
        createdAt: new Date(),
        
        // 比賽專用欄位
        raceName: row['Race Name'] || '',
        raceNameZh: row['比賽名稱'] || '',
        distanceCategory: getDistanceCategory(distVal),
        officialTimeStr: finishTimeStr,
        officialTimeSec: timeStrToSec(finishTimeStr),
        chipTimeStr: finishTimeStr, // 假設晶片時間同官方時間
        chipTimeSec: timeStrToSec(finishTimeStr),
        rankCategory: parseInt(row['組別名次']) || 0,
        rankOverall: parseInt(row['總名次']) || 0,
        feeRaw: row['費用'] || '',
        temperatureC: parseFloat(row['溫度']) || 0,
        organizer: row['主辦單位'] || '',
        startTime: row['起步時間'] || '',
        categoryName: row['賽事組別'] || '',
        bibNumber: row['參賽編號'] || '',
        participantName: row['參賽者'] || ''
    };
}

// CSV 解析器 (使用 PapaParse 或簡易實作，這裡提供簡易版供參考)
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        // 簡易逗號分隔處理 (若欄位內有逗號需改用正規 regex 或 PapaParse)
        const currentline = lines[i].split(',');
        if (currentline.length < headers.length) continue;
        
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j] ? currentline[j].trim() : '';
        }
        result.push(convertLegacyRaceRow(obj));
    }
    return result;
}
