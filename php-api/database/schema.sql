-- NowPetMe MySQL / MariaDB schema.
-- Import with phpMyAdmin (cPanel -> phpMyAdmin -> select your database -> Import).
-- Requires MySQL 5.7+ or MariaDB 10.3+ (InnoDB, utf8mb4).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username         VARCHAR(30)  NOT NULL,
  email            VARCHAR(191) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  email_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  verification_hash CHAR(64)    NULL,
  reset_hash       CHAR(64)     NULL,
  reset_expires    DATETIME     NULL,
  bio              TEXT         NULL,
  xp               INT          NOT NULL DEFAULT 0,
  voting_streak    INT          NOT NULL DEFAULT 0,
  votes_cast       INT          NOT NULL DEFAULT 0,
  last_vote_date   DATE         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_uq (username),
  UNIQUE KEY users_email_uq (email),
  KEY users_verification_idx (verification_hash),
  KEY users_reset_idx (reset_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pets (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(50)  NOT NULL,
  category         VARCHAR(20)  NOT NULL,
  breed            VARCHAR(80)  NULL,
  photo_url        VARCHAR(255) NOT NULL,
  story            TEXT         NULL,
  personality_tags TEXT         NULL,            -- JSON array, e.g. ["playful","lazy"]
  total_score      INT          NOT NULL DEFAULT 0,
  vote_count       INT          NOT NULL DEFAULT 0,
  bayesian_score   DOUBLE       NOT NULL DEFAULT 0,
  report_count     INT          NOT NULL DEFAULT 0,
  hidden           TINYINT(1)   NOT NULL DEFAULT 0,
  owner_ip         VARCHAR(32)  NULL,
  owner_id         INT UNSIGNED NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY pets_rank_idx (hidden, bayesian_score),
  KEY pets_category_idx (category, hidden),
  KEY pets_created_idx (created_at),
  KEY pets_owner_id_idx (owner_id),
  KEY pets_owner_ip_idx (owner_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pet_of_the_day (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pet_id  INT UNSIGNED NOT NULL,
  `date`  DATE         NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY potd_date_uq (`date`),
  KEY potd_pet_idx (pet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS votes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pet_id     INT UNSIGNED NOT NULL,
  voter_ip   VARCHAR(32)  NOT NULL,
  score      TINYINT UNSIGNED NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY votes_pet_ip_uq (pet_id, voter_ip),
  KEY votes_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pet_id       INT UNSIGNED NOT NULL,
  text         VARCHAR(255) NOT NULL,
  commenter_ip VARCHAR(32)  NULL,
  user_id      INT UNSIGNED NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY comments_pet_idx (pet_id, created_at),
  KEY comments_user_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_likes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id INT UNSIGNED NOT NULL,
  voter_ip   VARCHAR(32)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY comment_likes_uq (comment_id, voter_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_reactions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id INT UNSIGNED NOT NULL,
  voter_ip   VARCHAR(32)  NOT NULL,
  emoji      VARCHAR(16)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY comment_reactions_uq (comment_id, voter_ip, emoji)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS achievements (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  unlocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY achievements_user_code_uq (user_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_type VARCHAR(10)  NOT NULL,
  target_id   INT UNSIGNED NOT NULL,
  reporter_ip VARCHAR(32)  NOT NULL,
  reason      VARCHAR(500) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reports_uq (target_type, target_id, reporter_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(128)  NOT NULL,
  data       MEDIUMTEXT    NOT NULL,
  expires_at INT UNSIGNED  NOT NULL,
  PRIMARY KEY (id),
  KEY sessions_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  k            VARCHAR(100) NOT NULL,
  window_start INT UNSIGNED NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
