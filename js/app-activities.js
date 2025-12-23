import { createApp, ref, computed, onMounted } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { auth, db, onAuthStateChanged, collection, query, where, getDocs, addDoc, updateDoc, doc, writeBatch, signOut } from './firebase-config.js';
import { exportToCSV, convertLegacyRaceRow } from './csv-utils.js';

const app = createApp({
    setup() {
        const activities = ref([]);
        const user = ref(null);
        const filters = ref({ month: new Date().toISOString().slice(0, 7), type: 'all' });
        const showModal = ref(false);
        const showBackupModal = ref(false);
        
        // Form Data
        const form = ref({
            type: 'training',
            date: new Date().toISOString().split('T')[0],
            distanceInputValue: 0,
            distanceInputUnit: 'km',
            timeH: 0, timeM: 0, timeS: 0,
            workoutCategories: [],
            // ...其他欄位初始值
        });

        // 監聽登入
        onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                window.location.href = 'index.html';
            } else {
                user.value = currentUser;
                await loadActivities();
                checkBackupStatus();
            }
        });

        // 讀取活動
        const loadActivities = async () => {
            if (!user.value) return;
            // 實務上這裡建議加 .orderBy('date', 'desc') 但需要建立索引
            // 這裡先抓全部回前端排序，或簡單用 query
            const q = query(collection(db, `users/${user.value.uid}/activities`));
            const querySnapshot = await getDocs(q);
            activities.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 前端排序
            activities.value.sort((a, b) => new Date(b.date) - new Date(a.date));
        };

        // 篩選
        const filteredActivities = computed(() => {
            return activities.value.filter(act => {
                const matchMonth = act.date.startsWith(filters.value.month);
                const matchType = filters.value.type === 'all' || act.type === filters.value.type;
                return matchMonth && matchType;
            });
        });

        // 統計
        const monthlyStats = computed(() => {
            const list = filteredActivities.value;
            return {
                totalKm: list.reduce((sum, act) => sum + (act.distanceKm || 0), 0),
                raceCount: list.filter(a => a.type === 'race').length,
                trainingCount: list.filter(a => a.type === 'training').length
            };
        });

        // 備份檢查邏輯
        const checkBackupStatus = async () => {
            // 從 users/{uid} 讀取 lastBackupMonth
            const userDocRef = doc(db, 'users', user.value.uid);
            // ... (讀取邏輯)
            // 這裡省略具體讀取 userDoc 的 code，概念同規劃書
            // 假設需要備份：
            // showBackupModal.value = true; 
        };
        
        // 匯入舊 CSV
        const importLegacyCSV = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            Papa.parse(file, {
                header: true,
                complete: async (results) => {
                    const batch = writeBatch(db);
                    let count = 0;
                    results.data.forEach(row => {
                        if (row['比賽名稱'] || row['Race Name']) { // 簡單過濾空行
                             const actData = convertLegacyRaceRow(row);
                             const newRef = doc(collection(db, `users/${user.value.uid}/activities`));
                             batch.set(newRef, actData);
                             count++;
                        }
                    });
                    await batch.commit();
                    alert(`成功匯入 ${count} 筆紀錄`);
                    loadActivities();
                }
            });
        };

        // 儲存活動
        const saveActivity = async () => {
            // 計算總秒數與 KM
            const durationSec = (form.value.timeH||0)*3600 + (form.value.timeM||0)*60 + (form.value.timeS||0);
            const distanceKm = form.value.distanceInputUnit === 'km' ? form.value.distanceInputValue : form.value.distanceInputValue/1000;
            
            const payload = {
                ...form.value,
                durationSec,
                distanceKm,
                uid: user.value.uid, // 安全起見
                updatedAt: new Date().toISOString()
            };

            await addDoc(collection(db, `users/${user.value.uid}/activities`), payload);
            showModal.value = false;
            loadActivities();
        };

        const logout = () => signOut(auth);

        return {
            activities, filters, filteredActivities, monthlyStats,
            showModal, showBackupModal, form,
            saveActivity, importLegacyCSV, exportCSV: () => exportToCSV('activities.csv', activities.value),
            openModal: (type) => { form.value.type = type; showModal.value = true; },
            logout, formatDuration: (s) => { /* 轉 HH:MM:SS */ return s; } 
        };
    }
});

app.mount('#app');
