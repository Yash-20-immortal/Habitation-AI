const API_URL = 'http://127.0.0.1:5000';

/**
 * UTILS
 */
function getUserId() {
    return localStorage.getItem('habitation_user_id');
}

function setUserId(id) {
    localStorage.setItem('habitation_user_id', id);
}

function logout() {
    localStorage.removeItem('habitation_user_id');
    window.location.href = '/login.html';
}

/**
 * AUTH FLOW
 */
function toggleAuth(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('login-error').innerText = '';
    document.getElementById('signup-error').innerText = '';
}

async function handleLogin(e) {
    if(e) e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        
        if (res.ok && data.user_id) {
            setUserId(data.user_id);
            window.location.href = '/index.html';
        } else {
            errorDiv.innerText = data.error || 'Login failed';
        }
    } catch (err) {
        errorDiv.innerText = 'Network connection error';
    }
}

async function handleSignup(e) {
    if(e) e.preventDefault();
    const user = document.getElementById('signup-username').value;
    const pass = document.getElementById('signup-password').value;
    const errorDiv = document.getElementById('signup-error');
    
    try {
        const res = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        
        if (res.ok && data.user_id) {
            setUserId(data.user_id);
            window.location.href = '/index.html';
        } else {
            errorDiv.innerText = data.error || 'Signup failed';
        }
    } catch (err) {
        errorDiv.innerText = 'Network connection error';
    }
}

/**
 * DASHBOARD FLOW AND DATA FETCHING (NEW REQUIRED LOGIC)
 */
async function fetchUser() {
    const userId = getUserId();
    if (!userId) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/get_user?user_id=${userId}`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('display-username').innerText = data.username;
            document.getElementById('xp-display').innerText = data.xp;
            
            // XP History logic
            let history = JSON.parse(localStorage.getItem("xpHistory")) || [];
            if (history.length === 0 || history[history.length - 1] !== data.xp) {
                history.push(data.xp);
                localStorage.setItem("xpHistory", JSON.stringify(history));
            }
            
            localStorage.setItem("username", data.username);
            localStorage.setItem("xp", data.xp);
        }
    } catch (error) {
        console.error("Error loading user:", error);
    }
}

// NEW: FETCH STATS AND ACTIVITY
async function fetchUserStats() {
    const userId = getUserId();
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/user_stats?user_id=${userId}`);
        if(res.ok) {
            const data = await res.json();
            
            // Streak
            const streakDisplay = document.getElementById('streak-display');
            if(streakDisplay) streakDisplay.innerText = data.streak || 0;
            
            // Level & XP Progress
            const level = Math.floor(data.xp / 100);
            const progress = data.xp % 100;
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            const levelDisplay = document.getElementById('level-display');
            
            if (levelDisplay) levelDisplay.innerText = level;
            if (progressText) progressText.innerText = progress;
            if (progressFill) progressFill.style.width = `${progress}%`;
            
            // Save for Dashboard
            localStorage.setItem("level", level);
            localStorage.setItem("streak", data.streak || 0);
        }
    } catch(err) {
        console.error("Error loading user stats:", err);
    }
}

function renderChart() {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById("xpChart");
    if (!ctx) return;
    
    const xpData = JSON.parse(localStorage.getItem("xpHistory")) || [];
    
    if (window.xpChartInstance) {
        window.xpChartInstance.destroy();
    }

    window.xpChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: xpData.map((_, i) => "Day " + (i+1)),
            datasets: [{
                label: "XP Growth",
                data: xpData,
                borderColor: "#7f5af0",
                fill: true,
                tension: 0.4
            }]
        }
    });
}

function loadAvatar() {
    const avatar = localStorage.getItem("avatar");
    const avatarDiv = document.getElementById("profile-avatar");
    if (avatar && avatarDiv) {
        avatarDiv.innerHTML = `<img src="https://api.dicebear.com/7.x/bottts/svg?seed=${avatar}" style="width:100%; height:100%; border-radius:50%;">`;
        avatarDiv.style.background = 'none';
    }
}

function loadProfileData() {
    const nameEl = document.getElementById("profile-name");
    const levelEl = document.getElementById("profile-level");
    const xpEl = document.getElementById("profile-xp");
    const streakEl = document.getElementById("profile-streak");
    
    if (nameEl) nameEl.innerText = localStorage.getItem("username") || "Player";
    if (levelEl) levelEl.innerText = localStorage.getItem("level") || "1";
    if (xpEl) xpEl.innerText = localStorage.getItem("xp") || "0";
    if (streakEl) streakEl.innerText = localStorage.getItem("streak") || "0";
    
    renderChart();
}

async function fetchActivity() {
    const userId = getUserId();
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/activity?user_id=${userId}`);
        if(res.ok) {
            const data = await res.json();
            const list = document.getElementById('activity-list');
            if(!list) return;
            
            list.innerHTML = '';
            
            if (!data.activities || data.activities.length === 0) {
                list.innerHTML = '<li style="justify-content:center;color:#888;">No recent activity.</li>';
                return;
            }
            
            data.activities.forEach(act => {
                const li = document.createElement('li');
                // The timestamp is in UTC, we show local hour:minute
                const t = new Date(act.timestamp + "Z").toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                li.innerHTML = `
                    <span class="act-text">${act.action}</span>
                    <span class="act-xp">+${act.xp} XP</span>
                    <span class="act-time">${t}</span>
                `;
                list.appendChild(li);
            });
        }
    } catch(err) {
        console.error("Error loading activity:", err);
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('missions-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No active missions. Add a new mission above! ✨</div>';
        return;
    }
    
    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'mission-item';
        div.innerHTML = `
            <div class="mission-details">
                <span class="mission-name">${task.task_name}</span>
                <span class="mission-xp-tag">+${task.xp_reward} XP</span>
            </div>
            <button class="complete-btn" data-id="${task.id}">Complete</button>
        `;
        container.appendChild(div);
    });
}

// Ensure old inline handlers don't throw errors
window.handleAddTask = function(e) {
    if(e) e.preventDefault();
};

async function fetchTasks() {
    const userId = getUserId();
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/tasks?user_id=${userId}`);
        const data = await res.json();
        if (res.ok) {
            renderTasks(data.tasks || []);
        }
    } catch (err) {
        console.error("Error loading tasks", err);
    }
}

async function addTask(e) {
    if (e) e.preventDefault();
    const userId = getUserId();
    if (!userId) return;
    
    const nameInput = document.getElementById('new-task-name');
    const xpInput = document.getElementById('new-task-xp');
    
    const taskName = nameInput.value.trim();
    const xpReward = parseInt(xpInput.value);
    
    if (!taskName || isNaN(xpReward)) return;
    
    try {
        const res = await fetch(`${API_URL}/add_task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: userId,
                task_name: taskName, 
                xp_reward: xpReward 
            })
        });
        
        if (res.ok) {
            nameInput.value = '';
            xpInput.value = '20';
            // NEW: Instantly refresh tasks
            await fetchTasks();
            lastActionTime = Date.now();
            onTaskAdded();
        }
    } catch (err) {
        console.error("Failed to add task", err);
    }
}

async function completeTask(taskId) {
    const userId = getUserId();
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/complete_task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: taskId, user_id: userId })
        });
        
        if (res.ok) {
            // NEW: Instantly refresh both XP display and Tasks list from server
            await fetchUser();
            await fetchTasks();
            await fetchUserStats();
            await fetchActivity();
            lastActionTime = Date.now();
            onTaskCompleted();
        }
    } catch (err) {
        console.error("Failed to complete task", err);
    }
}

/**
 * AI ROBO DOG SYSTEM
 */
let lastActionTime = Date.now();

function setDogMood(mood) {
    const dog = document.getElementById("robo-dog");
    if (!dog) return;
    dog.classList.remove("happy", "excited", "sleepy", "idle");
    if (mood) dog.classList.add(mood);
}

function onTaskAdded() {
    setDogMood("excited");
    showDogMessage("New mission 👀 let's go!");
}

function onTaskCompleted() {
    setDogMood("happy");
    showDogMessage("That was clean 🐶🔥");
}

// Auto Mood Logic
setInterval(() => {
    let now = Date.now();
    if (now - lastActionTime > 20000) {
        setDogMood("sleepy");
        showDogMessage("You disappeared… 😴");
    } else if (now - lastActionTime > 4000) {
        setDogMood("idle");
    }
}, 5000);

function formatAIMessage(action, futureXP) {
    if (action === "study") return `📚 Study now! Future XP can reach ${futureXP}`;
    if (action === "rest") return `⚡ Rest first! Future XP can reach ${futureXP}`;
    if (action === "gym") return `💪 Hit gym! Future XP can reach ${futureXP}`;
    return "Thinking...";
}

function getAISuggestion() {
    const currentXP = parseInt(localStorage.getItem("xp")) || 0;
    const currentStreak = parseInt(localStorage.getItem("streak")) || 0;
    const currentEnergy = 50;

    fetch("http://127.0.0.1:5000/ai_suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            energy: currentEnergy,
            xp: currentXP,
            streak: currentStreak
        })
    })
    .then(res => res.json())
    .then(data => {
        const message = formatAIMessage(data.action, data.future_xp);
        showDogMessage(message);
    })
    .catch(() => console.error("AI suggestion failed"));
}

// Random Interactions
setInterval(() => {
    if (Date.now() - lastActionTime <= 20000) {
        getAISuggestion();
    }
}, 20000);

let moveDogTimeout;
function moveDog() {
    const dog = document.getElementById("robo-dog");
    if (!dog) return;
    
    const x = Math.random() * (window.innerWidth - 100);
    const y = Math.random() * (window.innerHeight - 100);

    dog.style.left = x + "px";
    dog.style.top = y + "px";
    
    let duration = 3000;
    if (dog.classList.contains("excited")) {
        duration = 2000;
        dog.style.transition = "all 2s ease-in-out";
    } else if (dog.classList.contains("sleepy")) {
        duration = 5000;
        dog.style.transition = "all 5s ease-in-out";
    } else {
        duration = 3000;
        dog.style.transition = "all 3s ease-in-out";
    }
    
    clearTimeout(moveDogTimeout);
    moveDogTimeout = setTimeout(moveDog, duration);
}

function showDogMessage(text) {
    const bubble = document.getElementById("dog-bubble");
    const dog = document.getElementById("robo-dog");
    if (!bubble || !dog) return;

    bubble.innerText = text;
    bubble.style.display = "block";
    bubble.style.left = dog.offsetLeft + "px";
    bubble.style.top = (dog.offsetTop - 50) + "px";

    setTimeout(() => {
        bubble.style.display = "none";
    }, 3000);
}

function initDog() {
    const dog = document.getElementById("robo-dog");
    if (!dog) return;
    
    dog.style.display = "block";
    moveDog(); // Self-calling movement loop handles intervals dynamically
    lastActionTime = Date.now();

    dog.addEventListener("click", async () => {
        const userId = getUserId();
        if (!userId) return;
        
        try {
            const res = await fetch(API_URL + "/tasks?user_id=" + userId);
            const data = await res.json();
            const tasks = data.tasks || [];

            if (tasks.length === 0) {
                showDogMessage("Add a mission to begin 🚀");
            } else {
                let best = tasks.reduce((a, b) => a.xp_reward > b.xp_reward ? a : b);
                showDogMessage("This one looks valuable 👀 : " + best.task_name);
            }
            lastActionTime = Date.now();
            setDogMood("excited");
        } catch (err) {
            showDogMessage("Systems glitching! ⚙️");
        }
    });
}

/**
 * INITIAL LOAD
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we are on
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm && signupForm) {
        // We are on login.html
        loginForm.addEventListener('submit', handleLogin);
        signupForm.addEventListener('submit', handleSignup);
        localStorage.removeItem('habitation_user_id'); 
    } 
    
    // Check if we are on Dashboard
    if (document.getElementById('xp-display')) {
        // Event delegation for Complete / Add Task
        const form = document.getElementById('add-task-form');
        if (form) {
            form.addEventListener('submit', addTask);
        }
        
        document.addEventListener('click', function(e) {
            if (e.target.matches('.complete-btn')) {
                completeTask(e.target.dataset.id);
            }
        });

        // Safe Profile Toggle
        const avatar = document.getElementById("profile-avatar");
        const panel = document.getElementById("profile-panel");

        if (avatar && panel) {
            avatar.onclick = () => {
                panel.classList.toggle("open");
                if (panel.classList.contains("open")) {
                    loadProfileData();
                }
            };
        }
        
        const closeBtn = document.getElementById("close-profile");
        if (closeBtn && panel) {
            closeBtn.onclick = () => {
                panel.classList.remove("open");
            }
        }
        
        document.querySelectorAll(".avatar-option").forEach(el => {
            el.onclick = () => {
                localStorage.setItem("avatar", el.dataset.avatar);
                loadAvatar();
            };
        });

        // NEW: Calling both as requested on load
        fetchUser();
        fetchTasks();
        fetchUserStats();
        fetchActivity();
        initDog();
        loadAvatar();
    }
});
