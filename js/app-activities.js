import { createApp, ref, computed } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { auth, db, onAuthStateChanged, collection, query, getDocs, addDoc, updateDoc, doc, writeBatch, signOut } from './firebase-config.js';
import { exportToCSV, convertLegacyRaceRow, convertGarminActivityRow, parseGarminSplits } from './csv-utils.js';

const app = createApp({
    setup() {
        const activities = ref([]);
        const user = ref(null);
        const filters = ref({ month: new Date().toISOString().slice(0, 7), type: 'all' });
        const showModal = ref(false);
        const isEdit = ref(false);
        const currentId = ref(null);
        
        // 錯誤處理專用：顯示友善訊息
        const handleError = (error, context) => {
            console.error(`Error in ${context}:`, error);
            // 針對 Load failed 提供更具體的建議
            if (error.message && error.message.includes('Load failed')) {
                alert(`連線失敗！\n1. 請確認手機與電腦在同一 WiFi\n2. 請確認 Firebase Console 的 "Authorized domains" 已加入此 IP`);
            } else {
                alert(`發生錯誤 (${context}): ${error.message}`);
            }
        };

        const form = ref({
            type: 'training',
            date: new Date().toISOString().split('T')[0],
            distanceInputValue: 0,
            distanceInputUnit: 'km',
            timeH: 0, timeM: 0, timeS: 0,
            workoutTitle: '',
            workoutCategories: [],
            note: '',
            raceNameZh: ''
        });

        // 監聽登入狀態 (加入 Try-Catch 避免 Promise Uncaught)
        onAuthStateChanged(auth, async (currentUser) => {
            try {
                if (!currentUser) {
                    // 若未登入，導回首頁
                    window.location.href = 'index.html';
                } else {
                    user.value = currentUser;
                    await loadActivities();
                }
            } catch (e) {
                handleError(e, "登入初始化");
            }
        });

        // 讀取活動資料
        const loadActivities = async () => {
            if (!user.value) return;
            try {
                const q = query(collection(db, `users/${user.value.uid}/activities`));
                const snap = await getDocs(q);
                activities.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // 排序：新到舊
                activities.value.sort((a, b) => new Date(b.date) - new Date(a.date));
            } catch (e) {
                handleError(e, "讀取活動列表");
            }
        };

        const filteredActivities = computed(() => {
            if (!activities.value) return [];
            return activities.value.filter(act => {
                // 防呆：確保 date 存在
                const actDate = act.date || '';
                const matchMonth = actDate.startsWith(filters.value.month);
                const matchType = filters.value.type === 'all' || act.type === filters.value.type;
                return matchMonth && matchType;
            });
        });

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

        const editActivity = (act) => {
            isEdit.value = true;
            currentId.value = act.id;
            
            const s = act.durationSec || 0;
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;

            form.value = {
                ...act,
                timeH: h, timeM: m, timeS: sec,
                distanceInputValue: act.distanceInputValue || act.distanceKm,
                distanceInputUnit: act.distanceInputUnit || 'km'
            };
            showModal.value = true;
        };

        const saveActivity = async () => {
            try {
                const durationSec = (form.value.timeH||0)*3600 + (form.value.timeM||0)*60 + (form.value.timeS||0);
                const distanceKm = form.value.distanceInputUnit === 'km' ? form.value.distanceInputValue : form.value.distanceInputValue/1000;
                
                const payload = {
                    ...form.value,
                    durationSec,
                    distanceKm,
                    updatedAt: new Date().toISOString()
                };

                delete payload.timeH; delete payload.timeM; delete payload.timeS; delete payload.id;

                if (isEdit.value && currentId.value) {
                    await updateDoc(doc(db, `users/${user.value.uid}/activities`, currentId.value), payload);
                } else {
                    payload.createdAt = new Date().toISOString();
                    await addDoc(collection(db, `users/${user.value.uid}/activities`), payload);
                }
                
                showModal.value = false;
                loadActivities();
            } catch (e) {
                handleError(e, "儲存活動");
            }
        };

        const handleImport = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // 確保 PapaParse 已載入
            if (typeof Papa === 'undefined') {
                alert("CSV 解析庫未載入，請檢查網路或 index.html");
                return;
            }

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        const batch = writeBatch(db);
                        let count = 0;
                        const headers = results.meta.fields || [];

                        if (headers.includes('計圈') || headers.includes('Lap')) {
                            const actData = parseGarminSplits(results.data);
                            const newRef = doc(collection(db, `users/${user.value.uid}/activities`));
                            batch.set(newRef, actData);
                            count = 1;
                            alert('已匯入詳細分圈資料，請記得「編輯」該活動以設定正確日期！');
                        } 
                        else if (headers.includes('活動類型') || headers.includes('Activity Type')) {
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
                    } catch (e) {
                        handleError(e, "匯入 CSV");
                    }
                },
                error: (err) => {
                    handleError(err, "解析 CSV 檔案");
                }
            });
            event.target.value = '';
        };

        // 安全登出
        const logout = async () => {
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (e) {
                handleError(e, "登出");
            }
        };

        return {
            activities, filters, filteredActivities, showModal, form, isEdit,
            saveActivity, handleImport, editActivity, 
            openModal, logout,
            exportCSV: () => exportToCSV('activities.csv', activities.value),
            monthlyStats: computed(() => {
                 const list = filteredActivities.value || [];
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
