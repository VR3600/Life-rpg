// 1. Firebase Configuration & Initialization
const firebaseConfig = {
    apiKey: "AIzaSyCw9gDIXIFWbwwi81_ZrDNrsZ8sy87__Sg",
    authDomain: "liferpg-web.firebaseapp.com",
    projectId: "liferpg-web",
    storageBucket: "liferpg-web.firebasestorage.app",
    messagingSenderId: "402208578628",
    appId: "1:402208578628:web:a0f0def0e7e937803ff011",
    measurementId: "G-DT1WT7K9H0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. DOM Elements
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

const questForm = document.getElementById('quest-form');
const questList = document.getElementById('quest-list');
const loadingSkeleton = document.getElementById('loading-skeleton');

let currentUser = null;
let currentInventory = []; // Store inventory locally

// 3. Authentication Logic
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        authView.classList.remove('active');
        authView.classList.add('hidden');
        appView.classList.remove('hidden');
        appView.classList.add('active');
        loadUserData();
        loadQuests();
    } else {
        currentUser = null;
        appView.classList.remove('active');
        appView.classList.add('hidden');
        authView.classList.remove('hidden');
        authView.classList.add('active');
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (signupError) {
                errorMsg.textContent = "Error: " + signupError.message;
            }
        } else {
            errorMsg.textContent = "Error: " + error.message;
        }
    }
});

logoutBtn.addEventListener('click', () => auth.signOut());

// 4. Player Stats & RPG Progression Engine
async function loadUserData() {
    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        await userRef.set({ xp: 0, level: 1, gold: 0, streak: 1, inventory: [], lastActive: new Date().toISOString() });
        updateUI(0, 1, 0, 1, []);
    } else {
        const data = doc.data();
        updateUI(data.xp, data.level, data.gold, data.streak, data.inventory || []);
    }
}

function updateUI(xp, level, gold, streak, inventory = currentInventory) {
    currentInventory = inventory; // Update local state
    const nextLevelXP = level * 100; 

    // Apply Persistent Rewards (Badge & Theme)
    let lvlDisplay = level;
    if (inventory.includes("Profile Badge")) lvlDisplay += " 👑";
    if (inventory.includes("Epic Theme")) {
        document.documentElement.style.setProperty('--neon-cyan', '#ff0055');
        document.documentElement.style.setProperty('--neon-teal', '#ff0055');
    }

    document.getElementById('player-lvl').innerHTML = lvlDisplay;
    document.getElementById('player-xp').textContent = xp;
    document.getElementById('next-lvl-xp').textContent = nextLevelXP;
    document.getElementById('player-gold').textContent = gold;
    document.getElementById('player-streak').textContent = streak;

    const fillPercentage = Math.min((xp / nextLevelXP) * 100, 100);
    document.getElementById('xp-bar-fill').style.width = `${fillPercentage}%`;
}

// 5. Database CRUD & Task Logic
async function loadQuests() {
    loadingSkeleton.classList.remove('hidden');
    db.collection('users').doc(currentUser.uid).collection('quests')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            loadingSkeleton.classList.add('hidden');
            questList.innerHTML = '';
            snapshot.forEach((doc) => {
                const quest = doc.data();
                renderQuest(doc.id, quest.title, quest.attribute);
            });
        });
}

questForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('quest-input').value.trim();
    const attribute = document.getElementById('quest-attribute').value;

    if (title === "") return; 

    await db.collection('users').doc(currentUser.uid).collection('quests').add({
        title,
        attribute,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('quest-input').value = '';
});

function renderQuest(id, title, attribute) {
    const li = document.createElement('li');
    li.className = 'quest-item';
    li.innerHTML = `
        <div class="quest-info">
            <input type="checkbox" onchange="completeQuest('${id}')">
            <span>${title}</span>
            <span class="attr-badge">${attribute}</span>
        </div>
        <button class="btn-delete" onclick="deleteQuest('${id}')">✕</button>
    `;
    questList.appendChild(li);
}

// Complete Quest & Gain XP (Rewards Economy + Optimistic UI)
// Complete Quest & Gain XP (Rewards, Optimistic UI & Audio Feedback)
window.completeQuest = async (id) => {
    // 1. Audio: Task check karte hi "Coin Drop" sound
    new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3?filename=coin-drop-39914.mp3').play().catch(e => console.log('Audio blocked by browser'));

    const checkbox = document.querySelector(`input[onchange="completeQuest('${id}')"]`);
    if(checkbox) checkbox.closest('li').remove();

    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();
    let { xp, level, gold, streak, inventory = [] } = doc.data();

    xp += 25; 
    gold += 10; 

    const requiredXP = level * 100;
    if (xp >= requiredXP) {
        level += 1;
        xp = xp - requiredXP; 
        
        // 2. Audio: Level Up hone par "Retro Arcade Win" sound
        new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3').play().catch(e => console.log('Audio blocked by browser'));
        
        setTimeout(() => alert(`🎉 LEVEL UP! You are now Level ${level}!`), 100); 
    }

    updateUI(xp, level, gold, streak, inventory);
    
    await userRef.update({ xp, level, gold, streak });
    await db.collection('users').doc(currentUser.uid).collection('quests').doc(id).delete();
};

// 6. Rewards Shop Logic (Buy Items & Apply Effects)
document.querySelectorAll('.btn-buy').forEach(button => {
    button.addEventListener('click', async (e) => {
        const cost = parseInt(e.target.getAttribute('data-cost'));
        const itemName = e.target.previousElementSibling.textContent.trim(); 
        
        const userRef = db.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();
        let { xp, level, gold, streak, inventory = [] } = doc.data();

        if (inventory.includes(itemName)) {
            alert(`You already own the ${itemName}!`);
            return; 
        }

        if (gold >= cost) {
            gold -= cost; 
            inventory.push(itemName); 
            
            if (itemName === "Weekend Cheat Day" || itemName === "Render Fast-Track Boost") {
                alert(`🎟️ REWARD UNLOCKED: Enjoy your ${itemName}!`);
            }

            updateUI(xp, level, gold, streak, inventory);
            await userRef.update({ gold, inventory });
            
            alert(`🎉 Successfully purchased: ${itemName}!`);
        } else {
            alert(`Not enough Gold! You need ${cost - gold} more 💰.`);
        }
    });
});