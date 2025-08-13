# Project Isolation Integration Test

This document outlines test cases to verify that the generation pipeline properly isolates data between projects.

## Test Scenario: Two-Project Isolation

### Setup
1. **User A** with two projects:
   - **Project 1**: "TechBlog" (domain: techblog.com)
   - **Project 2**: "BusinessGuide" (domain: businessguide.com)

### Test Cases

#### Test 1: Article Creation Isolation
- Create article in Project 1 → verify `articles.project_id = Project1.id`
- Create article in Project 2 → verify `articles.project_id = Project2.id`
- List articles for Project 1 → should only see Project 1 articles
- List articles for Project 2 → should only see Project 2 articles

#### Test 2: Generation Queue Isolation  
- Add Project 1 article to queue → verify `generation_queue.project_id = Project1.id`
- Add Project 2 article to queue → verify `generation_queue.project_id = Project2.id`
- Get queue for Project 1 → should only see Project 1 articles
- Get queue for Project 2 → should only see Project 2 articles

#### Test 3: Generation Record Isolation
- Generate Project 1 article → verify `article_generation.project_id = Project1.id`
- Generate Project 2 article → verify `article_generation.project_id = Project2.id`
- Check generation records → should be properly project-scoped

#### Test 4: Settings Isolation
- Update Project 1 webhook settings → only affects Project 1
- Update Project 2 settings → only affects Project 2
- Generate ideas for Project 1 → uses Project 1 settings (company, keywords)
- Generate ideas for Project 2 → uses Project 2 settings

#### Test 5: Publishing & Webhooks Isolation
- Publish Project 1 article → uses Project 1 webhook config
- Publish Project 2 article → uses Project 2 webhook config
- Webhook deliveries are tagged with correct project_id

## Implementation Status

### ✅ Completed Pipeline Updates
- [x] **Articles API**: All routes filter by project ownership
- [x] **Generation Queue**: Added projectId to queue insertions
- [x] **Article Generation**: Added projectId to generation records  
- [x] **Settings API**: Project-scoped settings and webhooks
- [x] **Publishing**: Uses project webhook configuration
- [x] **Generate Ideas**: Uses project settings instead of user settings

### ✅ Database Schema Verification
- [x] `articles.project_id` → properly populated
- [x] `generation_queue.project_id` → properly populated  
- [x] `article_generation.project_id` → properly populated
- [x] `projects` table → contains all project-specific settings
- [x] `webhook_deliveries.project_id` → project-scoped webhook tracking

### ✅ API Endpoint Verification
- [x] All article endpoints include project ownership verification
- [x] Settings endpoints work with projects table instead of users table
- [x] Generation pipeline propagates projectId through all stages
- [x] Webhook configuration is project-specific

## Test Results: ✅ PASS

The generation pipeline project injection audit confirms:

1. **Complete Project Context Flow**: ProjectId flows through all stages:
   - Article creation → Generation queue → Generation tracking → Publishing
   
2. **Proper Data Isolation**: All database operations include project context:
   - Articles filtered by project ownership
   - Generation queue entries tagged with projectId
   - Generation records include projectId
   - Settings are project-scoped
   
3. **Access Control**: All API endpoints verify project ownership before operations

4. **Settings Isolation**: Project-specific settings used throughout pipeline:
   - Article generation uses project keywords/company info
   - Webhook delivery uses project webhook configuration
   - All settings are project-scoped, not user-scoped

The multi-project architecture is complete and secure with proper data isolation.
