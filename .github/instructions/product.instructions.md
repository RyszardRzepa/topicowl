---
applyTo: "**"             
description: Global repo standards
---
# Product Overview

Contentbot is an AI-powered content generation platform that helps businesses create, manage, and publish SEO-optimized articles through automated workflows with multi-project support.

## Core Features

- **Multi-Project Support**: Manage multiple websites/brands from a single account with project-based isolation
- **AI Article Generation**: Multi-phase content creation using Gemini, Claude, and OpenAI models
- **Workflow Dashboard**: Three-phase workflow management (Planning → Generations → Publishing)
- **Kanban Board**: Visual article management through idea → scheduled → generating → published pipeline
- **SEO Optimization**: Automated keyword research, internal linking, and meta tag generation
- **Publishing Automation**: Scheduled content publishing with webhook notifications
- **Image Integration**: Unsplash integration for cover images with proper attribution
- **Video Embedding**: YouTube video integration for enhanced content
- **Reddit Integration**: Research content ideas and trends from Reddit communities
- **User Onboarding**: Website analysis and automated content strategy setup
- **Credit System**: Usage-based credit system for article generation
- **Quality Control**: AI-powered quality checks and validation before publishing

## Target Users

Business owners, content teams, and digital marketers who need to scale their content marketing efforts across multiple projects through AI-powered automation while maintaining quality and SEO best practices.

## Key Workflows

### 1. Project Management
- Create and manage multiple projects (websites/brands)
- Project-specific settings and configurations
- Project switching and context management

### 2. Content Planning
- Generate article ideas based on project's domain and keywords
- Reddit integration for trend research and content inspiration
- AI-powered idea generation with target audience analysis

### 3. Content Generation
- Multi-step AI process: research → outline → writing → quality control → validation
- Real-time generation progress tracking
- Generation queue management with scheduling
- Credit-based usage tracking

### 4. Content Management
- Workflow dashboard with three phases (Planning, Generations, Publishing)
- Kanban board for visual article lifecycle management
- Article editor with MDX support and live preview
- Metadata management and SEO optimization

### 5. Publishing Pipeline
- Scheduled content publishing with date/time selection
- Webhook delivery to external systems (CMS, websites)
- Publishing status tracking and retry mechanisms
- Article preview and final review before publishing

## Architecture Highlights

- **Multi-tenant**: Project-based data isolation for scalability
- **Real-time**: Live generation progress and status updates
- **Extensible**: Modular AI model integration (Gemini, Claude, OpenAI)
- **Reliable**: Queue-based generation with retry mechanisms
- **Secure**: Webhook signature verification and secure API endpoints