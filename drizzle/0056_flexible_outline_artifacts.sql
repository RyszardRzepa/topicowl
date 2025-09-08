-- Add structure_template to projects
ALTER TABLE topicowl.projects ADD COLUMN structure_template jsonb;

-- Add structure_override to articles
ALTER TABLE topicowl.articles ADD COLUMN structure_override jsonb;

-- Add artifacts and checklist to article_generation
ALTER TABLE topicowl.article_generation ADD COLUMN artifacts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE topicowl.article_generation ADD COLUMN checklist jsonb;
