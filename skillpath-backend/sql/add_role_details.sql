-- =====================================================================
-- add_role_details.sql
-- Run this ONCE on your existing "skillpath" database:
--   mysql -u root -p skillpath < sql/add_role_details.sql
--
-- It adds the extra columns the new routes need. It does not delete any data.
-- If you run it a second time, MySQL will say "Duplicate column name".
-- That just means it already ran, and you can ignore it.
-- =====================================================================

USE skillpath;
SET NAMES utf8mb4; -- read this file as UTF-8, so the emoji icons are saved correctly

-- 1. roles: an emoji icon, a category and a one-line summary for each role
ALTER TABLE roles
  ADD COLUMN icon     VARCHAR(10)  NULL,   -- e.g. a small emoji
  ADD COLUMN category VARCHAR(100) NULL,   -- e.g. "Web Development"
  ADD COLUMN summary  VARCHAR(255) NULL;   -- one sentence about the job

-- 2. quizzes: save the user's answers, e.g. {"HTML": 3, "CSS": 1}
--    (stored as JSON text, so we can show the full report again later)
ALTER TABLE quizzes
  ADD COLUMN answers TEXT NULL;

-- 3. Fill in the details for the 5 seeded roles
UPDATE roles SET icon = '🎨', category = 'Web Development',
  summary = 'Build the parts of websites and apps that people see and click.'
  WHERE id = 1;

UPDATE roles SET icon = '⚙️', category = 'Web Development',
  summary = 'Write the server code, APIs and databases that power an app.'
  WHERE id = 2;

UPDATE roles SET icon = '🧩', category = 'Web Development',
  summary = 'Handle both the frontend and the backend of a web application.'
  WHERE id = 3;

UPDATE roles SET icon = '📊', category = 'Data',
  summary = 'Turn raw data into charts, reports and business decisions.'
  WHERE id = 4;

UPDATE roles SET icon = '🚀', category = 'Cloud & Infrastructure',
  summary = 'Automate how software is built, tested and shipped to servers.'
  WHERE id = 5;

-- Quick check (optional):
-- SELECT id, role_name, icon, category, summary FROM roles;
