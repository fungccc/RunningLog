// js/csv-utils.js

// 匯出 CSV 的通用函式
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

// 解析舊版比賽紀錄 CSV (Mapping Logic)
export function convertLegacyRaceRow(row) {
    // 假設 row 是從 CSV 解析出的物件，key 為 CSV 標頭
    // "比賽日期" -> date
    // "完成時間" -> officialTimeStr
    
    // 簡易的時間轉換 HH:MM:SS -> seconds
    const parseTime = (str) => {
        if (!str) return 0;
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1]; // 假設 MM:SS
        return 0;
    };

    // 距離處理
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
        type: 'race', // 強制設定
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
        officialTimeSec: parseTime(row['完成時間']),
        note: row['備註'] || '',
        distanceInputValue: distVal,
        distanceInputUnit: 'km',
        distanceKm: distVal,
        distanceCategory: distCat,
        createdAt: new Date().toISOString()
    };
}
