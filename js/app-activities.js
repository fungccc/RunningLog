import { createApp, ref, computed } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { auth, db, onAuthStateChanged, collection, query, getDocs, addDoc, updateDoc, doc, writeBatch, signOut } from './firebase-config.js';
import { exportToCSV, convertLegacyRaceRow, convertGarminActivityRow, parseGarminSplits } from './csv-utils.js';

const app = createApp({
    setup() {
        const activities = ref([]);
        const user = ref(null);
        const filters = ref({ month: new Date().toISOString().slice(0, 7), type: 'all' });
        const showModal = ref(false);
        const isEdit = ref(false); // 判斷是否為編輯模式
        const currentId = ref(null); // 編輯中的 ID
        
        const form = ref({
            type: 'training',
            date: new Date().toISOString().split('T')[0],
            distanceInputValue: 0,
            distanceInputUnit: 'km',
            timeH: 0, timeM: 0, timeS: 0,
            workoutTitle: '',
            workoutCategories: [],
            note: '',
            // ...其他欄位
            raceNameZh: ''
        });

        // 初始化與登入檢查
        onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) window.location.href = 'index.html';
            else {
                user.value = currentUser;
                await loadActivities();
            }
        });

        const loadActivities = async () => {
            if (!user.value) return;
            const q = query(collection(db, `users/${user.value.uid}/activities`));
            const snap = await getDocs(q);
            activities.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            activities.value.sort((a, b) => new Date(b.date) - new Date(a.date));
        };

        const filteredActivities = computed(() => {
            return activities.value.filter(act => {
                const matchMonth = act.date.startsWith(filters.value.month);
                const matchType = filters.value.type === 'all' || act.type === filters.value.type;
                return matchMonth && matchType;
            });
        });

        // 開啟新增視窗
        const openModal = (type) => {
            isEdit.value = false;
            currentId.value = null;
            form.value = {
                type: type || 'training',
                date: new Date().toISOString().split('T')[0],
                distanceInputValue: 0, distanceInputUnit: 'km',
                timeH: 0, timeM: 0, timeS: 0,
                workoutTitle: '', workoutCategories: [], note: '', raceNameZh: ''
            };
            showModal.value = true;
        };

        // 開啟編輯視窗
        const editActivity = (act) => {
            isEdit.value = true;
            currentId.value = act.id;
            
            // 時間轉換回 H M S
            const s = act.durationSec || 0;
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;

            form.value = {
                ...act,
                timeH: h, timeM: m, timeS: sec,
                // 確保 UI 綁定正確
                distanceInputValue: act.distanceInputValue || act.distanceKm,
                distanceInputUnit: act.distanceInputUnit || 'km'
            };
            showModal.value = true;
        };

        const saveActivity = async () => {
            const durationSec = (form.value.timeH||0)*3600 + (form.value.timeM||0)*60 + (form.value.timeS||0);
            const distanceKm = form.value.distanceInputUnit === 'km' ? form.value.distanceInputValue : form.value.distanceInputValue/1000;
            
            const payload = {
                ...form.value,
                durationSec,
                distanceKm,
                updatedAt: new Date().toISOString()
            };

            // 移除 UI 暫存欄位
            delete payload.timeH; delete payload.timeM; delete payload.timeS; delete payload.id;

            if (isEdit.value && currentId.value) {
                // 更新模式
                await updateDoc(doc(db, `users/${user.value.uid}/activities`, currentId.value), payload);
            } else {
                // 新增模式
                payload.createdAt = new Date().toISOString();
                await addDoc(collection(db, `users/${user.value.uid}/activities`), payload);
            }
            
            showModal.value = false;
            loadActivities();
        };

        // 通用匯入處理 (自動判斷格式)
        const handleImport = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const batch = writeBatch(db);
                    let count = 0;
                    const headers = results.meta.fields;

                    // 判斷 CSV 類型
                    if (headers.includes('計圈') || headers.includes('Lap')) {
                        // Garmin 單次詳細 (分圈)
                        const actData = parseGarminSplits(results.data);
                        const newRef = doc(collection(db, `users/${user.value.uid}/activities`));
                        batch.set(newRef, actData);
                        count = 1;
                        alert('已匯入詳細分圈資料，請記得「編輯」該活動以設定正確日期！');
                    } 
                    else if (headers.includes('活動類型') || headers.includes('Activity Type')) {
                        // Garmin 列表
                        results.data.forEach(row => {
                            if(row['活動類型'] || row['Activity Type']) {
                                const actData = convertGarminActivityRow(row);
                                const newRef = doc(collection(db, `users/${user.value.uid}/activities`));
                                batch.set(newRef, actData);
                                count++;
                            }
                        });
                    }
                    else if (headers.includes('比賽名稱') || headers.includes('Race Name')) {
                        // 舊版比賽紀錄
                        results.data.forEach(row => {
                            if(row['比賽名稱'] || row['Race Name']) {
                                const actData = convertLegacyRaceRow(row);
                                const newRef = doc(collection(db, `users/${user.value.uid}/activities`));
                                batch.set(newRef, actData);
                                count++;
                            }
                        });
                    } else {
                        alert('無法識別的 CSV 格式，請確認標題列。');
                        return;
                    }

                    if(count > 0) {
                        await batch.commit();
                        alert(`成功匯入 ${count} 筆紀錄`);
                        loadActivities();
                    }
                }
            });
            // 清空 Input 讓同個檔案可再選
            event.target.value = '';
        };

        return {
            activities, filters, filteredActivities, showModal, form, isEdit,
            saveActivity, handleImport, editActivity, 
            openModal,
            exportCSV: () => exportToCSV('activities.csv', activities.value),
            logout: () => signOut(auth),
            // 簡易計算統計
            monthlyStats: computed(() => {
                 const list = filteredActivities.value;
                 return {
                     totalKm: list.reduce((s, a) => s + (a.distanceKm||0), 0),
                     raceCount: list.filter(a => a.type === 'race').length,
                     trainingCount: list.filter(a => a.type === 'training').length
                 };
            }),
            formatDuration: (s) => {
                if(!s) return '0:00';
                const m = Math.floor(s/60);
                const sec = Math.floor(s%60);
                return `${m}:${sec.toString().padStart(2,'0')}`;
            }
        };
    }
});
app.mount('#app');
