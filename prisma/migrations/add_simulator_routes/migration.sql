CREATE TABLE `simulator_routes` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `device_id`  VARCHAR(100) NOT NULL,
  `route`      JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `simulator_routes_device_id_key` (`device_id`),
  INDEX `idx_simulator_routes_device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
