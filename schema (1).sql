-- =====================================================================
-- SkillPath AI - Database Schema (MySQL 8.0+)
-- ---------------------------------------------------------------------
-- How to run:
--   mysql -u root -p < schema.sql
-- This file:
--   1. Creates the "skillpath" database
--   2. Creates all tables with primary keys, foreign keys and timestamps
--   3. Adds seed data (IT roles and the skills needed for each role)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Create and select the database
-- ---------------------------------------------------------------------
-- utf8mb4 supports all characters (including emojis and Indian scripts)
CREATE DATABASE IF NOT EXISTS skillpath
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE skillpath;


-- ---------------------------------------------------------------------
-- 2. Drop old tables (so you can re-run this file safely)
-- ---------------------------------------------------------------------
-- Child tables are dropped first, because they depend on parent tables.
DROP TABLE IF EXISTS roadmap_steps;
DROP TABLE IF EXISTS roadmaps;
DROP TABLE IF EXISTS gap_reports;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS role_skills;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;


-- ---------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------

-- users: everyone who signs up on SkillPath AI
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,           -- unique id for each user
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,             -- no two users can share an email
  password_hash VARCHAR(255) NOT NULL,                    -- store a hash (e.g. bcrypt), never the real password
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP       -- filled in automatically
) ENGINE=InnoDB;


-- profiles: extra career info for each user
CREATE TABLE profiles (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,                            -- which user this profile belongs to
  target_role    VARCHAR(100),                            -- the job the user wants, e.g. "Frontend Developer"
  current_skills TEXT,                                    -- skills the user already has, e.g. "HTML, CSS"
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- If a user is deleted, their profile is deleted too
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- roles: the IT job roles we give guidance for
CREATE TABLE roles (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE                  -- e.g. "Backend Developer"
) ENGINE=InnoDB;


-- role_skills: the skills needed for each role
CREATE TABLE role_skills (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  role_id        INT NOT NULL,                            -- which role this skill belongs to
  skill_name     VARCHAR(100) NOT NULL,
  importance     TINYINT NOT NULL,                        -- 1 = nice to have, 5 = must have
  learning_order INT NOT NULL,                            -- 1 = learn this first, 2 = next, ...
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CHECK (importance BETWEEN 1 AND 5)                      -- only allow values 1 to 5
) ENGINE=InnoDB;


-- quizzes: one row each time a user takes a quiz for a role
CREATE TABLE quizzes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  role_id    INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score      INT DEFAULT NULL,                            -- NULL until the quiz is finished
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- quiz_questions: the questions inside a quiz, plus the user's answer
CREATE TABLE quiz_questions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id        INT NOT NULL,                            -- which quiz this question is part of
  question_text  TEXT NOT NULL,
  option_a       VARCHAR(255) NOT NULL,
  option_b       VARCHAR(255) NOT NULL,
  option_c       VARCHAR(255) NOT NULL,
  option_d       VARCHAR(255) NOT NULL,
  correct_option ENUM('A','B','C','D') NOT NULL,          -- the right answer
  user_answer    ENUM('A','B','C','D') DEFAULT NULL,      -- NULL until the user answers
  skill_name     VARCHAR(100) NOT NULL,                   -- which skill this question tests
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- gap_reports: skills the user is missing for a role
CREATE TABLE gap_reports (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  role_id        INT NOT NULL,
  missing_skills TEXT,                                    -- e.g. "React, Git, Testing"
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- roadmaps: a learning plan made for a user and a role
CREATE TABLE roadmaps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  role_id    INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- roadmap_steps: the individual steps inside a roadmap
CREATE TABLE roadmap_steps (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  roadmap_id     INT NOT NULL,                            -- which roadmap this step belongs to
  skill_name     VARCHAR(100) NOT NULL,
  resource_title VARCHAR(255),                            -- e.g. "MDN JavaScript Guide"
  resource_link  VARCHAR(500),                            -- URL to the learning resource
  step_order     INT NOT NULL,                            -- 1 = first step, 2 = second, ...
  status         ENUM('pending','done') NOT NULL DEFAULT 'pending',
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ---------------------------------------------------------------------
-- 4. Seed data: IT roles
-- ---------------------------------------------------------------------
-- We set the ids by hand (1-5) so the role_skills below can use them.
INSERT INTO roles (id, role_name) VALUES
  (1, 'Frontend Developer'),
  (2, 'Backend Developer'),
  (3, 'Full Stack Developer'),
  (4, 'Data Analyst'),
  (5, 'DevOps Engineer');


-- ---------------------------------------------------------------------
-- 5. Seed data: skills for each role
-- ---------------------------------------------------------------------
-- Columns: (role_id, skill_name, importance 1-5, learning_order)

-- Frontend Developer (role_id = 1)
INSERT INTO role_skills (role_id, skill_name, importance, learning_order) VALUES
  (1, 'HTML',              5, 1),
  (1, 'CSS',               5, 2),
  (1, 'JavaScript',        5, 3),
  (1, 'Git and GitHub',    4, 4),
  (1, 'Responsive Design', 4, 5),
  (1, 'React',             5, 6),
  (1, 'REST API Basics',   3, 7),
  (1, 'Frontend Testing',  2, 8);

-- Backend Developer (role_id = 2)
INSERT INTO role_skills (role_id, skill_name, importance, learning_order) VALUES
  (2, 'JavaScript',               5, 1),
  (2, 'Git and GitHub',           4, 2),
  (2, 'Node.js',                  5, 3),
  (2, 'Express.js',               5, 4),
  (2, 'SQL and MySQL',            5, 5),
  (2, 'REST API Design',          5, 6),
  (2, 'Authentication (JWT)',     4, 7),
  (2, 'Deployment Basics',        3, 8);

-- Full Stack Developer (role_id = 3)
INSERT INTO role_skills (role_id, skill_name, importance, learning_order) VALUES
  (3, 'HTML and CSS',     5, 1),
  (3, 'JavaScript',       5, 2),
  (3, 'Git and GitHub',   4, 3),
  (3, 'React',            5, 4),
  (3, 'Node.js',          5, 5),
  (3, 'Express.js',       4, 6),
  (3, 'SQL and MySQL',    5, 7),
  (3, 'Deployment Basics',3, 8);

-- Data Analyst (role_id = 4)
INSERT INTO role_skills (role_id, skill_name, importance, learning_order) VALUES
  (4, 'Excel',                 5, 1),
  (4, 'Statistics Basics',     5, 2),
  (4, 'SQL',                   5, 3),
  (4, 'Python',                4, 4),
  (4, 'Pandas',                4, 5),
  (4, 'Data Visualization',    4, 6),
  (4, 'Power BI or Tableau',   4, 7);

-- DevOps Engineer (role_id = 5)
INSERT INTO role_skills (role_id, skill_name, importance, learning_order) VALUES
  (5, 'Linux Basics',          5, 1),
  (5, 'Networking Basics',     4, 2),
  (5, 'Git and GitHub',        5, 3),
  (5, 'Shell Scripting',       4, 4),
  (5, 'Docker',                5, 5),
  (5, 'CI/CD (GitHub Actions)',4, 6),
  (5, 'Cloud Basics (AWS)',    4, 7),
  (5, 'Kubernetes',            3, 8);


-- ---------------------------------------------------------------------
-- 6. Quick check (optional): see each role's skills in learning order
-- ---------------------------------------------------------------------
-- SELECT r.role_name, rs.learning_order, rs.skill_name, rs.importance
-- FROM role_skills rs
-- JOIN roles r ON r.id = rs.role_id
-- ORDER BY r.id, rs.learning_order;
