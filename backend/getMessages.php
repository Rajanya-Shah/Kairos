<?php
// ============================================================
// Kairos – Fetch Messages between current user and a contact
// Also marks received messages as "seen"
// ============================================================
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];
$contactId = (int)($_GET['contact_id'] ?? 0);
$after = (int)($_GET['after'] ?? 0); // optional: fetch only newer messages (for polling)

if ($contactId === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'contact_id is required.']);
    exit;
}

$db = getDB();

// Verify contact relationship
$uid1 = min($me, $contactId);
$uid2 = max($me, $contactId);
$check = $db->prepare('SELECT id FROM contacts WHERE user_id_1 = ? AND user_id_2 = ?');
$check->execute([$uid1, $uid2]);
if (!$check->fetch()) {
    http_response_code(403);
    echo json_encode(['error' => 'Not connected.']);
    exit;
}

// Mark messages sent TO me by this contact as "seen"
$db->prepare(
    'UPDATE messages SET status = "seen"
     WHERE sender_id = ? AND receiver_id = ? AND status != "seen"'
)->execute([$contactId, $me]);

// Fetch messages
if ($after > 0) {
    $stmt = $db->prepare(
        'SELECT * FROM messages
         WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
           AND id > ?
         ORDER BY created_at ASC'
    );
    $stmt->execute([$me, $contactId, $contactId, $me, $after]);
}
else {
    $stmt = $db->prepare(
        'SELECT * FROM messages
         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
         ORDER BY created_at ASC
         LIMIT 200'
    );
    $stmt->execute([$me, $contactId, $contactId, $me]);
}

$messages = $stmt->fetchAll();

// Cast int fields
foreach ($messages as &$m) {
    $m['id'] = (int)$m['id'];
    $m['sender_id'] = (int)$m['sender_id'];
    $m['receiver_id'] = (int)$m['receiver_id'];
}

echo json_encode($messages);
