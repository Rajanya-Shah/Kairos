<?php
require_once __DIR__ . '/../backend/db.php';

try {
    $pdo = getDB();

    // Add columns to users table
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL;");
    }
    catch (Exception $e) {
    }
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN typing_to_id INT UNSIGNED DEFAULT NULL;");
    }
    catch (Exception $e) {
    }
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN last_typing TIMESTAMP NULL DEFAULT NULL;");
    }
    catch (Exception $e) {
    }

    // Add columns to contacts table
    try {
        $pdo->exec("ALTER TABLE contacts ADD COLUMN theme VARCHAR(50) NOT NULL DEFAULT 'default';");
    }
    catch (Exception $e) {
    }

    // Add columns to messages table
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN type ENUM('text', 'image') NOT NULL DEFAULT 'text';");
    }
    catch (Exception $e) {
    }
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN is_ephemeral BOOLEAN NOT NULL DEFAULT FALSE;");
    }
    catch (Exception $e) {
    }
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN seen_at TIMESTAMP NULL DEFAULT NULL;");
    }
    catch (Exception $e) {
    }

    echo "Database migrated successfully.\n";

}
catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
