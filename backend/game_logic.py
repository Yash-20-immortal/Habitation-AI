class State:
    def __init__(self, energy, xp, streak):
        self.energy = energy
        self.xp = xp
        self.streak = streak

def get_actions():
    return ["study", "rest", "gym"]

def apply_action(state, action):
    if action == "study":
        return State(state.energy - 10, state.xp + 20, state.streak + 1)
    elif action == "rest":
        return State(state.energy + 15, state.xp + 5, state.streak)
    elif action == "gym":
        return State(state.energy - 5, state.xp + 15, state.streak + 1)

def heuristic(state):
    return (100 - state.energy) + (500 - state.xp)

def astar_suggest(initial_state):
    import heapq

    open_list = []
    heapq.heappush(open_list, (0, id(initial_state), initial_state, []))  # Added id() to prevent comparison issues
    visited = set()

    while open_list:
        cost, _, current, path = heapq.heappop(open_list)

        if current.xp >= initial_state.xp + 40:
            return path[0] if path else "rest"

        key = (current.energy, current.xp, current.streak)
        if key in visited:
            continue
        visited.add(key)

        for action in get_actions():
            next_state = apply_action(current, action)
            new_path = path + [action]

            g = len(new_path)
            h = heuristic(next_state)

            heapq.heappush(open_list, (g + h, id(next_state), next_state, new_path))

    return "rest"

# DFS for future simulation
def dfs_simulate(state, depth=3):
    if depth == 0:
        return state.xp

    best = state.xp

    for action in get_actions():
        next_state = apply_action(state, action)
        result = dfs_simulate(next_state, depth - 1)
        best = max(best, result)

    return best
