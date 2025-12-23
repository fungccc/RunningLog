// js/csv-utils.js

// 通用匯出 CSV
export function exportToCSV(filename, rows) {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
        keys.join(separator) +
        '\n' +
        rows.map(row => {
            return keys.map(k => {
                let cell = row[k] === null || row[k] === undefined ? '' : row[k];
                cell = cell instanceof Date ? cell.toISOString().split('T')[0] : cell.toString();
                cell = cell.replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
                return cell;
            }).join(separator);
        }).join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// 輔助：時間字串轉秒數 (支援 H:M:S, M:S, M:S.ms)
const parseTimeStr = (str) => {
    if (!str) return 0;
    // 移除毫秒部分 (例如 "07:02.2" -> "07:02")
    let cleanStr = str.toString().trim();
    if(cleanStr.includes('.')) cleanStr = cleanStr.split('.')[0];
    
    const parts = cleanStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // H:M:S
    if (parts.length === 2) return parts[0] * 60 + parts[1]; // M:S
    return 0;
};

// 1. 舊版 CSV 解析 (Legacy)
export function convertLegacyRaceRow(row) {
    let distVal = 0;
    let distCat = "Other";
    if (row['距離']) {
        distVal = parseFloat(row['距離'].replace(/[^\d.]/g, ''));
        if (row['距離'].includes('42.195')) distCat = 'FM';
        else if (row['距離'].includes('21')) distCat = 'HM';
        else if (row['距離'].includes('10')) distCat = '10K';
        else if (row['距離'].includes('5')) distCat = '5K';
    }

    return {
        type: 'race',
        date: row['比賽日期'] || new Date().toISOString().split('T')[0],
        raceNameZh: row['比賽名稱'] || '',
        raceName: row['Race Name'] || '',
        locationName: row['地點'] || '',
        feeRaw: row['費用'] || '',
        organizer: row['主辦單位'] || '',
        startTime: row['起步時間'] || '',
        categoryName: row['賽事組別'] || '',
        bibNumber: row['參賽編號'] || '',
        participantName: row['參賽者'] || '',
        temperatureC: parseFloat(row['溫度']) || null,
        rankCategory: row['組別名次'] || '',
        rankOverall: row['總名次'] || '',
        officialTimeStr: row['完成時間'] || '',
        officialTimeSec: parseTimeStr(row['完成時間']),
        note: row['備註'] || '',
        distanceInputValue: distVal,
        distanceInputUnit: 'km',
        distanceKm: distVal,
        distanceCategory: distCat,
        createdAt: new Date().toISOString()
    };
}

// 2. Garmin 多筆活動列表 (garmin_Activities.csv)
export function convertGarminActivityRow(row) {
    // 欄位: 活動類型, 日期, 標題, 距離, 時間, 平均配速...
    const typeMap = {
        'Running': 'training', '跑步': 'training',
        'Street Running': 'race', '街道跑步': 'race',
        'Cycling': 'cross', '騎乘': 'cross',
        'Lap Swimming': 'cross', '泳池游泳': 'cross'
    };

    const rawType = row['活動類型'] || row['Activity Type'] || 'Running';
    const type = typeMap[rawType] || 'training';

    // 日期處理 "2025-12-21 07:46:20" -> "2025-12-21"
    // js/csv-utils.js

// ... (前略)

// 修正後的 convertGarminActivityRow
export function convertGarminActivityRow(row) {
    // ... (前略 map 定義)

    const rawType = row['活動類型'] || row['Activity Type'] || 'Running';
    const type = typeMap[rawType] || 'training';

    // === 修改開始: iPhone Safari 安全的日期處理 ===
    let date = new Date().toISOString().split('T')[0]; // 預設今天
    const rawDate = row['日期'] || row['Date'];
    
    if (rawDate) {
        // 將 "2025-12-21 07:46:20" 轉為 "2025-12-21T07:46:20" (ISO格式)
        // 或是直接取前 10 碼
        if(rawDate.includes('T')) {
            date = rawDate.split('T')[0];
        } else {
            // 處理中間是空白的情況
            date = rawDate.replace(/\//g, '-').split(' ')[0];
        }
    }
    // === 修改結束 ===

    // ... (後續程式碼保持不變)

    // 距離與時間
    const distRaw = row['距離'] || row['Distance'] || "0";
    const distanceKm = parseFloat(distRaw.toString().replace(/,/g, ''));
    
    const timeRaw = row['時間'] || row['Time'] || "00:00:00";
    const durationSec = parseTimeStr(timeRaw);

    // 備註資訊
    const pace = row['平均配速'] || row['Avg Pace'] || '';
    const hr = row['平均心率'] || row['Avg HR'] || '';
    const note = `Garmin匯入 | 配速: ${pace} | HR: ${hr}`;

    return {
        type,
        date,
        workoutTitle: row['標題'] || row['Title'] || rawType,
        distanceInputValue: distanceKm,
        distanceInputUnit: 'km',
        distanceKm,
        durationSec,
        officialTimeStr: timeRaw, // 若是比賽可顯示
        note,
        createdAt: new Date().toISOString()
    };
}

// 3. Garmin 單次詳細分圈 (activity_xxx.csv)
export function parseGarminSplits(rows) {
    // 這個格式通常沒有日期(在檔名或表頭外)，我們預設為今天，讓使用者匯入後編輯
    // 欄位: 計圈, 時間, 距離公里, ...
    
    let totalDist = 0;
    let totalSec = 0;
    let splitNotes = [];

    rows.forEach(row => {
        // 確保是數據行
        if (!row['計圈'] && !row['Lap']) return;
        
        const dist = parseFloat(row['距離公里'] || row['Distance'] || 0);
        const timeStr = row['時間'] || row['Time'];
        const sec = parseTimeStr(timeStr);
        const pace = row['平均配速分/公里'] || row['Avg Pace'] || '';

        totalDist += dist;
        totalSec += sec;
        
        splitNotes.push(`Lap ${row['計圈']||row['Lap']}: ${dist}km @ ${timeStr} (${pace})`);
    });

    return {
        type: 'training', // 預設為訓練
        date: new Date().toISOString().split('T')[0], // 預設今天，需手動改
        workoutTitle: 'Garmin 詳細匯入 (請編輯日期)',
        distanceInputValue: parseFloat(totalDist.toFixed(2)),
        distanceInputUnit: 'km',
        distanceKm: parseFloat(totalDist.toFixed(2)),
        durationSec: totalSec,
        note: "分圈數據:\n" + splitNotes.join('\n'),
        workoutCategories: ['intervals'], // 假設有分圈通常是間歇或長跑
        createdAt: new Date().toISOString()
    };
}
