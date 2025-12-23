// js/app-nutrition.js
import { createApp, ref, onMounted } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { auth, db, onAuthStateChanged, collection, getDocs, addDoc, doc, deleteDoc, writeBatch, signOut } from './firebase-config.js';

const app = createApp({
    setup() {
        const items = ref([]);
        const user = ref(null);
        const aiJsonInput = ref('');
        const showModal = ref(false);
        const form = ref({
            name: '', brand: '', type: 'gel',
            energyKcal: 0, sodiumMg: 0, carbG: 0, note: ''
        });

        // 登入狀態監聽
        onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                window.location.href = 'index.html';
            } else {
                user.value = currentUser;
                await loadItems();
            }
        });

        const loadItems = async () => {
            if (!user.value) return;
            try {
                const querySnapshot = await getDocs(collection(db, `users/${user.value.uid}/nutrition_db`));
                items.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error("讀取失敗:", e);
            }
        };

        const saveItem = async () => {
            if (!user.value) return;
            await addDoc(collection(db, `users/${user.value.uid}/nutrition_db`), {
                ...form.value,
                updatedAt: new Date().toISOString()
            });
            showModal.value = false;
            form.value = { name: '', brand: '', type: 'gel', energyKcal: 0, sodiumMg: 0, carbG: 0, note: '' };
            loadItems();
        };

        const deleteItem = async (id) => {
            if (!confirm('確定刪除?')) return;
            await deleteDoc(doc(db, `users/${user.value.uid}/nutrition_db`, id));
            loadItems();
        };

        const importAiJson = async () => {
            try {
                const data = JSON.parse(aiJsonInput.value);
                if (!Array.isArray(data)) throw new Error("格式非 Array");
                const batch = writeBatch(db);
                data.forEach(item => {
                    const ref = doc(collection(db, `users/${user.value.uid}/nutrition_db`));
                    batch.set(ref, { ...item, updatedAt: new Date().toISOString() });
                });
                await batch.commit();
                alert(`成功匯入 ${data.length} 筆`);
                aiJsonInput.value = '';
                loadItems();
            } catch (e) {
                alert("JSON 錯誤: " + e.message);
            }
        };

        const copyPrompt = () => {
            const t = "請幫我解析以下補給品資訊，並回傳純 JSON Array 格式。欄位包含: name, brand, type (gel/drink/bar/other), energyKcal (number), sodiumMg (number), carbG (number), note。不要 Markdown。";
            navigator.clipboard.writeText(t);
            alert("指令已複製");
        };

        return {
            items, user, aiJsonInput, showModal, form,
            saveItem, deleteItem, importAiJson, copyPrompt,
            logout: () => signOut(auth)
        };
    }
});

app.mount('#app');
