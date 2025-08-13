-- Schema and Data Integrity Validation Script
-- This script validates the multi-project migration completeness

\echo '🔍 Validating Database Schema and Data Integrity...'
\echo ''

-- Check if all required tables exist with project_id columns
\echo '📋 Table Structure Validation:'
\echo '================================'

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'contentbot' 
    AND column_name = 'project_id'
ORDER BY table_name;

\echo ''
\echo '🔗 Foreign Key Constraints Validation:'
\echo '======================================'

SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'contentbot'
    AND kcu.column_name = 'project_id'
ORDER BY tc.table_name;

\echo ''
\echo '📊 Index Validation:'
\echo '==================='

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'contentbot' 
    AND indexdef LIKE '%project_id%'
ORDER BY tablename;

\echo ''
\echo '🔢 Data Migration Completeness:'
\echo '==============================='

-- Check for orphaned records in each table
WITH data_validation AS (
    SELECT 'articles' as table_name,
           COUNT(*) as total_records,
           COUNT(project_id) as records_with_project,
           COUNT(*) - COUNT(project_id) as orphaned_records
    FROM contentbot.articles
    
    UNION ALL
    
    SELECT 'article_generation' as table_name,
           COUNT(*) as total_records,
           COUNT(project_id) as records_with_project,
           COUNT(*) - COUNT(project_id) as orphaned_records
    FROM contentbot.article_generation
    
    UNION ALL
    
    SELECT 'generation_queue' as table_name,
           COUNT(*) as total_records,
           COUNT(project_id) as records_with_project,
           COUNT(*) - COUNT(project_id) as orphaned_records
    FROM contentbot.generation_queue
    
    UNION ALL
    
    SELECT 'webhook_deliveries' as table_name,
           COUNT(*) as total_records,
           COUNT(project_id) as records_with_project,
           COUNT(*) - COUNT(project_id) as orphaned_records
    FROM contentbot.webhook_deliveries
    
    UNION ALL
    
    SELECT 'article_settings' as table_name,
           COUNT(*) as total_records,
           COUNT(project_id) as records_with_project,
           COUNT(*) - COUNT(project_id) as orphaned_records
    FROM contentbot.article_settings
)
SELECT 
    table_name,
    total_records,
    records_with_project,
    orphaned_records,
    CASE 
        WHEN orphaned_records = 0 THEN '✅ OK'
        ELSE '❌ ISSUES'
    END as status
FROM data_validation
ORDER BY table_name;

\echo ''
\echo '👥 User-Project Relationships:'
\echo '============================='

-- Check users without projects
SELECT 
    'Users without projects' as check_type,
    COUNT(*) as count
FROM contentbot.users u
LEFT JOIN contentbot.projects p ON u.id = p.user_id
WHERE p.id IS NULL

UNION ALL

-- Check projects per user
SELECT 
    'Users with multiple projects' as check_type,
    COUNT(*) as count
FROM (
    SELECT user_id, COUNT(*) as project_count
    FROM contentbot.projects
    GROUP BY user_id
    HAVING COUNT(*) > 1
) multi_project_users;

\echo ''
\echo '🔍 Data Integrity Issues:'
\echo '========================='

-- Check for articles referencing non-existent projects
SELECT 
    'Articles with invalid project_id' as issue_type,
    COUNT(*) as count
FROM contentbot.articles a
LEFT JOIN contentbot.projects p ON a.project_id = p.id
WHERE a.project_id IS NOT NULL AND p.id IS NULL

UNION ALL

-- Check for user-project mismatches in articles
SELECT 
    'Articles with user-project mismatch' as issue_type,
    COUNT(*) as count
FROM contentbot.articles a
JOIN contentbot.projects p ON a.project_id = p.id
WHERE a.user_id != p.user_id

UNION ALL

-- Check for generation records with user-project mismatches
SELECT 
    'Generation records with user-project mismatch' as issue_type,
    COUNT(*) as count
FROM contentbot.article_generation ag
JOIN contentbot.projects p ON ag.project_id = p.id
WHERE ag.user_id != p.user_id;

\echo ''
\echo '📈 Summary Statistics:'
\echo '====================='

SELECT 
    'Total Users' as metric,
    COUNT(*) as value
FROM contentbot.users

UNION ALL

SELECT 
    'Total Projects' as metric,
    COUNT(*) as value
FROM contentbot.projects

UNION ALL

SELECT 
    'Total Articles' as metric,
    COUNT(*) as value
FROM contentbot.articles

UNION ALL

SELECT 
    'Articles with project_id' as metric,
    COUNT(*) as value
FROM contentbot.articles
WHERE project_id IS NOT NULL;

\echo ''
\echo '✅ Schema and data integrity validation complete!'