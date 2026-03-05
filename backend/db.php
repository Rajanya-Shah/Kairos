<?php
// ============================================================
// Kairos – Database Connection (PDO)
// ============================================================
// ⚠  Update these credentials to match your local environment.
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'kairos');
define('DB_USER', 'root');
define('DB_PASS', '');          // Change to your MySQL password
define('DB_CHAR', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHAR;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed.']);
            exit;
        }
    }
    return $pdo;
}
