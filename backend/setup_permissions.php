<?php
require_once __DIR__ . '/database.php';

global $con;
if (!$con) {
    die("Database connection failed.\n");
}

$sql = "
CREATE TABLE IF NOT EXISTS `app_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `emp_id` varchar(50) NOT NULL,
  `module_name` varchar(50) NOT NULL,
  `can_access` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emp_module` (`emp_id`, `module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if ($con->query($sql)) {
    echo "app_permissions table created or already exists.\n";
} else {
    echo "Error creating table: " . $con->error . "\n";
}
