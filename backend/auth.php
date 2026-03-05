<?php
// ============================================================
// Kairos – Authentication  (register / login / logout / me)
// ============================================================
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db.php';

$action = $_REQUEST['action'] ?? '';

switch ($action) {

    // ----------------------------------------------------------
    case 'register':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if (strlen($username) < 3 || strlen($username) > 50) {
            echo json_encode(['error' => 'Username must be 3–50 characters.']);
            exit;
        }
        if (strlen($password) < 6) {
            echo json_encode(['error' => 'Password must be at least 6 characters.']);
            exit;
        }

        $db = getDB();
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            echo json_encode(['error' => 'Username already taken.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $ins = $db->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        $ins->execute([$username, $hash]);

        $id = (int)$db->lastInsertId();
        $_SESSION['user_id'] = $id;
        $_SESSION['username'] = $username;

        echo json_encode(['success' => true, 'id' => $id, 'username' => $username]);
        break;

    // ----------------------------------------------------------
    case 'login':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        $db = getDB();
        $stmt = $db->prepare('SELECT id, username, password_hash, avatar FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            echo json_encode(['error' => 'Invalid username or password.']);
            exit;
        }

        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['username'] = $user['username'];

        echo json_encode([
            'success' => true,
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'avatar' => $user['avatar'],
        ]);
        break;

    // ----------------------------------------------------------
    case 'logout':
        session_destroy();
        echo json_encode(['success' => true]);
        break;

    // ----------------------------------------------------------
    case 'me':
        if (empty($_SESSION['user_id'])) {
            echo json_encode(['error' => 'Not authenticated.']);
            exit;
        }
        echo json_encode([
            'id' => (int)$_SESSION['user_id'],
            'username' => $_SESSION['username'],
        ]);
        break;

    // ----------------------------------------------------------
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action.']);
}
