-- Migration script to associate existing data with projects
-- Run this after creating your first project

-- First, let's see what we're working with
SELECT 
  u.id as user_id,
  u.email,
  p.id as project_id,
  p.name as project_name,
  COUNT(a.id) as article_count
FROM contentbot.users u
LEFT JOIN contentbot.projects p ON u.id = p.user_id
LEFT JOIN contentbot.articles a ON u.id = a.user_id AND a.project_id IS NULL
GROUP BY u.id, u.email, p.id, p.name
ORDER BY u.id;

-- Update articles to reference the first project for each user
UPDATE contentbot.articles 
SET project_id = (
  SELECT p.id 
  FROM contentbot.projects p 
  WHERE p.user_id = articles.user_id 
  ORDER BY p.created_at ASC 
  LIMIT 1
)
WHERE project_id IS NULL;

-- Update article_generation records to reference the first project for each user
UPDATE contentbot.article_generation 
SET project_id = (
  SELECT p.id 
  FROM contentbot.projects p 
  WHERE p.user_id = article_generation.user_id 
  ORDER BY p.created_at ASC 
  LIMIT 1
)
WHERE project_id IS NULL;

-- Create article_settings for projects that don't have them yet
INSERT INTO contentbot.article_settings (project_id, max_words, excluded_domains)
SELECT 
  p.id,
  800, -- default max_words
  '[]'::jsonb -- empty excluded_domains array
FROM contentbot.projects p
LEFT JOIN contentbot.article_settings s ON p.id = s.project_id
WHERE s.id IS NULL;

-- Verify the migration
SELECT 
  'Articles' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project,
  COUNT(*) - COUNT(project_id) as orphaned_records
FROM contentbot.articles
UNION ALL
SELECT 
  'Article Generation' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project,
  COUNT(*) - COUNT(project_id) as orphaned_records
FROM contentbot.article_generation
UNION ALL
SELECT 
  'Article Settings' as table_name,
  COUNT(*) as total_records,
  COUNT(project_id) as records_with_project,
  COUNT(*) - COUNT(project_id) as orphaned_records
FROM contentbot.article_settings;