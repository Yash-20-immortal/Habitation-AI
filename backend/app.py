from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from game_logic import State, astar_suggest, dfs_simulate
import sqlite3
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'database_v2.db')

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            xp INTEGER DEFAULT 0
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            xp_reward INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )''')
        c.execute('''CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            xp INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )''')
        try:
            c.execute('ALTER TABLE users ADD COLUMN last_active_date TEXT')
            c.execute('ALTER TABLE users ADD COLUMN streak_count INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass # Columns already exist
        conn.commit()

init_db()

@app.route('/')
def home():
    return app.send_static_file('login.html')

@app.route('/login.html')
def login_page():
    return app.send_static_file('login.html')

@app.route('/index.html')
def index_page():
    return app.send_static_file('index.html')

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
        
    hashed_pw = generate_password_hash(password)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("INSERT INTO users (username, password, xp) VALUES (?, ?, 0)", (username, hashed_pw))
            user_id = c.lastrowid
            conn.commit()
        return jsonify({'message': 'User created successfully', 'user_id': user_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        
        if user and check_password_hash(user['password'], password):
            return jsonify({'message': 'Login successful', 'user_id': user['id']}), 200
            
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/get_user', methods=['GET'])
def get_user():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, username, xp FROM users WHERE id = ?", (user_id,))
        user = c.fetchone()
        
    if user:
        return jsonify(dict(user)), 200
    return jsonify({'error': 'User not found'}), 404

@app.route('/user_stats', methods=['GET'])
def user_stats():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT xp, COALESCE(streak_count, 0) as streak FROM users WHERE id = ?", (user_id,))
        stats = c.fetchone()
        
    if stats:
        return jsonify(dict(stats)), 200
    return jsonify({'error': 'User not found'}), 404

@app.route('/activity', methods=['GET'])
def get_activity():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT action, xp, timestamp FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 10", (user_id,))
        activities = [dict(row) for row in c.fetchall()]
        
    return jsonify({'activities': activities}), 200

@app.route("/ai_suggest", methods=["POST"])
def ai_suggest():
    data = request.json

    state = State(
        energy=data.get("energy", 50),
        xp=data.get("xp", 0),
        streak=data.get("streak", 0)
    )

    best_action = astar_suggest(state)
    future_xp = dfs_simulate(state)

    return jsonify({
        "action": best_action,
        "future_xp": future_xp
    })

@app.route('/tasks', methods=['GET'])
def get_tasks():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, task_name, xp_reward FROM tasks WHERE user_id = ? ORDER BY id DESC", (user_id,))
        tasks = [dict(row) for row in c.fetchall()]
        
    return jsonify({'tasks': tasks}), 200

@app.route('/add_task', methods=['POST'])
def add_task():
    data = request.json
    user_id = data.get('user_id')
    task_name = data.get('task_name')
    xp_reward = data.get('xp_reward')
    
    if not all([user_id, task_name, xp_reward]):
        return jsonify({'error': 'Missing fields'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO tasks (user_id, task_name, xp_reward) VALUES (?, ?, ?)", 
                  (user_id, task_name, int(xp_reward)))
        conn.commit()
        
        # Return updated task list
        conn.row_factory = sqlite3.Row
        c2 = conn.cursor()
        c2.execute("SELECT id, task_name, xp_reward FROM tasks WHERE user_id = ? ORDER BY id DESC", (user_id,))
        tasks = [dict(row) for row in c2.fetchall()]
        
    return jsonify({'message': 'Task added successfully', 'tasks': tasks}), 200

@app.route('/complete_task', methods=['POST'])
def complete_task():
    data = request.json
    task_id = data.get('task_id')
    user_id = data.get('user_id')
    
    if not all([task_id, user_id]):
        return jsonify({'error': 'Missing fields'}), 400
        
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        # Get task XP and Name
        c.execute("SELECT xp_reward, task_name FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
        task = c.fetchone()
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
            
        xp_gained = task[0]
        
        # Delete task
        c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        
        # Add XP to user
        c.execute("UPDATE users SET xp = xp + ? WHERE id = ?", (xp_gained, user_id))
        
        # Log activity
        c.execute("INSERT INTO activity_log (user_id, action, xp) VALUES (?, ?, ?)", 
                  (user_id, f"Completed: {task[1]}", xp_gained))
        
        # Calculate streak logic
        import datetime
        today_str = datetime.date.today().isoformat()
        
        c.execute("SELECT last_active_date, COALESCE(streak_count, 0) FROM users WHERE id = ?", (user_id,))
        user_data = c.fetchone()
        last_date, streak_count = user_data[0], user_data[1]
        
        if last_date != today_str:
            if last_date:
                try:
                    last_date_obj = datetime.date.fromisoformat(last_date)
                    if (datetime.date.today() - last_date_obj).days == 1:
                        streak_count += 1
                    else:
                        streak_count = 1
                except ValueError:
                    streak_count = 1
            else:
                streak_count = 1
            
            c.execute("UPDATE users SET last_active_date = ?, streak_count = ? WHERE id = ?", 
                      (today_str, streak_count, user_id))
        
        conn.commit()
        
        # Return updated XP and tasks
        conn.row_factory = sqlite3.Row
        c2 = conn.cursor()
        c2.execute("SELECT xp FROM users WHERE id = ?", (user_id,))
        new_xp = c2.fetchone()['xp']
        
        c2.execute("SELECT id, task_name, xp_reward FROM tasks WHERE user_id = ? ORDER BY id DESC", (user_id,))
        tasks = [dict(row) for row in c2.fetchall()]
        
    return jsonify({
        'message': 'Task completed', 
        'gained_xp': xp_gained,
        'new_xp': new_xp,
        'tasks': tasks
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
