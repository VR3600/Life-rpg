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
    
    // Aaj ki date nikalna (e.g., "2026-09-12")
    const today = new Date().toISOString().split('T')[0];

    if (!doc.exists) {
        await userRef.set({ xp: 0, level: 1, gold: 0, streak: 1, inventory: [], lastBossDate: today, lastActive: new Date().toISOString() });
        updateUI(0, 1, 0, 1, []);
        addBossQuest(); // First time login par boss quest assign karo
    } else {
        const data = doc.data();
        updateUI(data.xp, data.level, data.gold, data.streak, data.inventory || []);
        
        // Agar aaj login kiya hai aur Boss Quest nahi mila, toh assign karo
        if (data.lastBossDate !== today) {
            await userRef.update({ lastBossDate: today });
            addBossQuest();
        }
    }
}

async function addBossQuest() {
    const bossQuests = [
        { title: "Defeat the Dragon (Deep Work 4 Hrs) 🐉", attribute: "Focus" },
        { title: "Iron Golem Workout (Run 5km) 🌋", attribute: "Strength" },
        { title: "Wizard's Trial (Read 50 Pages) 🧙‍♂️", attribute: "Intellect" }
    ];
    const randomBoss = bossQuests[Math.floor(Math.random() * bossQuests.length)];

    await db.collection('users').doc(currentUser.uid).collection('quests').add({
        title: randomBoss.title,
        attribute: randomBoss.attribute,
        isBossQuest: true, // Special tag Boss Quest ke liye
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function updateUI(xp, level, gold, streak, inventory = currentInventory) {
    currentInventory = inventory;
    const nextLevelXP = level * 100;

    // Dynamic Rank Logic
    let rank = "🛡️ Novice Scrapper";
    if (level >= 5 && level <= 9) rank = "⚔️ Cyber Apprentice";
    else if (level >= 10 && level <= 19) rank = "🧙‍♂️ Code Sorcerer";
    else if (level >= 20) rank = "👑 Neon Overlord";

    let lvlDisplay = `${level} - ${rank}`;

    // Inventory Effects Logic
    if (inventory.includes("Profile Badge")) lvlDisplay += " 🌟";
    if (inventory.includes("GitHub Pro Avatar")) lvlDisplay = "👾 " + lvlDisplay;

    if (inventory.includes("Epic Theme")) {
        document.documentElement.style.setProperty('--neon-cyan', '#ff0055');
        document.documentElement.style.setProperty('--neon-teal', '#ff0055');
    }

    // Glowing Combo Animation Injector
    if (!document.getElementById('combo-style')) {
        const style = document.createElement('style');
        style.id = 'combo-style';
        style.innerHTML = `@keyframes blink { 0%, 100% { opacity: 1; text-shadow: 0 0 10px #ff0055; } 50% { opacity: 0.4; text-shadow: none; } }`;
        document.head.appendChild(style);
    }

    // Streak Combo UI Update
    let streakHTML = streak;
    if (streak >= 3) {
        streakHTML = `${streak} <span style="color: #ff0055; animation: blink 1s infinite; font-size: 0.7em; margin-left: 10px; font-weight: bold;">🔥 COMBO ACTIVE: +50% XP!</span>`;
    }

    document.getElementById('player-lvl').innerHTML = lvlDisplay;
    document.getElementById('player-xp').textContent = xp;
    document.getElementById('next-lvl-xp').textContent = nextLevelXP;
    document.getElementById('player-gold').textContent = gold;
    document.getElementById('player-streak').innerHTML = streakHTML;

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
                renderQuest(doc.id, quest.title, quest.attribute, quest.isBossQuest);
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

function renderQuest(id, title, attribute, isBossQuest = false) {
    const li = document.createElement('li');
    li.className = 'quest-item';

    // Boss Quest Styling
    let bossStyle = '';
    let bossBadge = '';
    if (isBossQuest) {
        bossStyle = 'border: 1px solid #ff0055; box-shadow: 0 0 10px rgba(255, 0, 85, 0.4); background: rgba(255, 0, 85, 0.1);';
        bossBadge = '<span style="color: #ff0055; font-weight: bold; margin-right: 10px;">👹 BOSS QUEST</span>';
    }

    // RPG Badge Mapping Logic
    const badges = {
        'Intellect': '🧠 INT',
        'Strength': '⚔️ STR',
        'Agility': '⚡ AGI',
        'Charisma': '💬 CHR',
        'Vitality': '❤️ VIT',
        'Focus': '🎯 FCS'
    };

    const displayAttr = badges[attribute] || attribute;

    li.innerHTML = `
        <div class="quest-info" style="${bossStyle}">
            <input type="checkbox" onchange="completeQuest('${id}', ${isBossQuest})">
            <span>${bossBadge} ${title}</span>
            <span class="attr-badge">${displayAttr}</span>
        </div>
        <button class="btn-delete" onclick="deleteQuest('${id}')">✕</button>
    `;
    questList.appendChild(li);
}

// Complete Quest & Gain XP (Rewards, Boss Logic, Optimistic UI & Audio)
window.completeQuest = async (id, isBossQuest = false) => {
    new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3?filename=coin-drop-39914.mp3').play().catch(e => console.log('Audio blocked by browser'));

    const checkbox = document.querySelector(`input[onchange="completeQuest('${id}', ${isBossQuest})"]`);
    if (checkbox) checkbox.closest('li').remove();

    const userRef = db.collection('users').doc(currentUser.uid);
    const doc = await userRef.get();
    let { xp, level, gold, streak, inventory = [] } = doc.data();

    streak += 1;

    let earnedXP = isBossQuest ? 100 : 25;
    let earnedGold = isBossQuest ? 100 : 10;
    
    // Combo multiplier logic (3 ya zyada streak par 1.5x)
    if (streak >= 3) {
        earnedXP = Math.floor(earnedXP * 1.5); 
        earnedGold = Math.floor(earnedGold * 1.5); 
    }

    xp += earnedXP;
    gold += earnedGold;

    if (isBossQuest) {
        setTimeout(() => alert(`💥 EPIC VICTORY! You defeated the Boss and looted ${earnedGold} Gold!`), 100);
    }

    const requiredXP = level * 100;
    if (xp >= requiredXP) {
        level += 1;
        xp = xp - requiredXP;

        new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3').play().catch(e => console.log('Audio blocked by browser'));
        
        triggerShake();

        setTimeout(() => alert(`🎉 LEVEL UP! You are now Level ${level}!`), 300);
    }

    updateUI(xp, level, gold, streak, inventory);

    await userRef.update({ xp, level, gold, streak });
    await db.collection('users').doc(currentUser.uid).collection('quests').doc(id).delete();
};

// 6. Delete Quest (Trash Task without XP/Gold)
window.deleteQuest = async (id) => {
    const deleteBtn = document.querySelector(`button[onclick="deleteQuest('${id}')"]`);
    if (deleteBtn) deleteBtn.closest('li').remove();

    new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=error-126627.mp3').play().catch(e => console.log('Audio blocked'));

    await db.collection('users').doc(currentUser.uid).collection('quests').doc(id).delete();
};

// 7. Rewards Shop Logic (Buy Items & Apply Effects)
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
            } else {
                alert(`🎉 Successfully purchased: ${itemName}!`);
            }

            updateUI(xp, level, gold, streak, inventory);
            triggerShake(); // Item buy karne par bhi effect
            
            await userRef.update({ gold, inventory });
        } else {
            alert(`Not enough Gold! You need ${cost - gold} more 💰.`);
        }
    });
});

// 8. Screen Shake Engine (Game Feel)
window.triggerShake = () => {
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.innerHTML = `
            @keyframes shake {
                0% { transform: translate(0, 0); }
                20% { transform: translate(-5px, 5px); }
                40% { transform: translate(5px, -5px); }
                60% { transform: translate(-5px, -5px); }
                80% { transform: translate(5px, 5px); }
                100% { transform: translate(0, 0); }
            }
            .screen-shake {
                animation: shake 0.3s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 300);
};