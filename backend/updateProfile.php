<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];

if (empty($_FILES['avatar']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No avatar uploaded.']);
    exit;
}

$uploadDir = __DIR__ . '/../assets/avatars/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$ext = strtolower(pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
if (!in_array($ext, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid image format.']);
    exit;
}

if ($_FILES['avatar']['size'] > 5 * 1024 * 1024) { // 5MB limit
    http_response_code(400);
    echo json_encode(['error' => 'Image too large (max 5MB).']);
    exit;
}

$filename = uniqid('avatar_') . '.' . $ext;
if (move_uploaded_file($_FILES['avatar']['tmp_name'], $uploadDir . $filename)) {
    $path = 'assets/avatars/' . $filename;
    $db = getDB();
    $db->prepare('UPDATE users SET avatar = ? WHERE id = ?')->execute([$path, $me]);

    // Also update session if keeping state there is needed, but we fetch on /auth.php
    echo json_encode(['success' => true, 'avatar' => $path]);
}
else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save avatar.']);
}
