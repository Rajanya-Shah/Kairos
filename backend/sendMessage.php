<?php
// ============================================================
// Kairos – Send a Message
// ============================================================
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];
$receiverId = (int)($_POST['receiver_id'] ?? 0);
$content = trim($_POST['content'] ?? '');
$isEphemeral = !empty($_POST['is_ephemeral']) && $_POST['is_ephemeral'] !== 'false' ? 1 : 0;
$type = 'text';

if ($receiverId === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'receiver_id is required.']);
    exit;
}

// Handle Image Upload
if (!empty($_FILES['image']['tmp_name'])) {
    $type = 'image';
    $uploadDir = __DIR__ . '/../assets/uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid image format.']);
        exit;
    }

    if ($_FILES['image']['size'] > 5 * 1024 * 1024) { // 5MB limit
        http_response_code(400);
        echo json_encode(['error' => 'Image too large (max 5MB).']);
        exit;
    }

    $filename = uniqid('img_') . '.' . $ext;
    if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        $content = 'assets/uploads/' . $filename;
    }
    else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save image.']);
        exit;
    }
}
else if ($content === '') {
    http_response_code(400);
    echo json_encode(['error' => 'content is required for text messages.']);
    exit;
}
else if (mb_strlen($content) > 5000) {
    http_response_code(400);
    echo json_encode(['error' => 'Message too long.']);
    exit;
}

$db = getDB();

// Verify the receiver is actually a contact
$uid1 = min($me, $receiverId);
$uid2 = max($me, $receiverId);
$check = $db->prepare(
    'SELECT id FROM contacts WHERE user_id_1 = ? AND user_id_2 = ?'
);
$check->execute([$uid1, $uid2]);
if (!$check->fetch()) {
    http_response_code(403);
    echo json_encode(['error' => 'You are not connected with this user.']);
    exit;
}

$ins = $db->prepare(
    'INSERT INTO messages (sender_id, receiver_id, type, content, status, is_ephemeral) VALUES (?, ?, ?, ?, "sent", ?)'
);
$ins->execute([$me, $receiverId, $type, $content, $isEphemeral]);
$msgId = (int)$db->lastInsertId();

// Return the inserted message for immediate rendering
$stmt = $db->prepare('SELECT * FROM messages WHERE id = ?');
$stmt->execute([$msgId]);
$msg = $stmt->fetch();

echo json_encode([
    'success' => true,
    'message' => $msg,
]);
