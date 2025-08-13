#!/usr/bin/env tsx

/**
 * Migration script to associate existing articles, article settings, and article generation
 * records with the first available project for each user.
 * 
 * Run this script after creating your first project to migrate existing data.
 */

import { db } from "../src/server/db";
import { articles, articleSettings, articleGeneration, projects, users } from "../src/server/db/schema";
import { eq, isNull, and } from "drizzle-orm";

async function migrateToProjects() {
  console.log("🚀 Starting migration to project-based structure...");

  try {
    // Get all users who have projects
    const usersWithProjects = await db
      .select({
        userId: users.id,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(users)
      .innerJoin(projects, eq(users.id, projects.userId));

    console.log(`📊 Found ${usersWithProjects.length} users with projects`);

    for (const userProject of usersWithProjects) {
      const { userId, projectId, projectName } = userProject;
      
      console.log(`\n👤 Processing user ${userId} with project "${projectName}" (ID: ${projectId})`);

      // Migrate articles without projectId
      const articlesResult = await db
        .update(articles)
        .set({ projectId })
        .where(and(
          eq(articles.userId, userId),
          isNull(articles.projectId)
        ))
        .returning({ id: articles.id, title: articles.title });

      console.log(`  📝 Migrated ${articlesResult.length} articles`);
      articlesResult.forEach(article => {
        console.log(`    - "${article.title}" (ID: ${article.id})`);
      });

      // Migrate article generation records without projectId
      const generationResult = await db
        .update(articleGeneration)
        .set({ projectId })
        .where(and(
          eq(articleGeneration.userId, userId),
          isNull(articleGeneration.projectId)
        ))
        .returning({ id: articleGeneration.id, articleId: articleGeneration.articleId });

      console.log(`  🔄 Migrated ${generationResult.length} article generation records`);
      generationResult.forEach(gen => {
        console.log(`    - Generation for article ${gen.articleId} (ID: ${gen.id})`);
      });

      // Check for existing article settings for this project
      const existingSettings = await db
        .select()
        .from(articleSettings)
        .where(eq(articleSettings.projectId, projectId))
        .limit(1);

      if (existingSettings.length === 0) {
        // Create article settings for this project if none exist
        const settingsResult = await db
          .insert(articleSettings)
          .values({
            projectId,
            maxWords: 800, // Default value
            excludedDomains: [],
          })
          .returning({ id: articleSettings.id });

        console.log(`  ⚙️  Created article settings (ID: ${settingsResult[0]?.id})`);
      } else {
        console.log(`  ⚙️  Article settings already exist for this project`);
      }
    }

    // Check for orphaned data (users without projects)
    const orphanedArticles = await db
      .select({
        userId: articles.userId,
        count: articles.id,
      })
      .from(articles)
      .leftJoin(projects, eq(articles.userId, projects.userId))
      .where(and(
        isNull(articles.projectId),
        isNull(projects.id)
      ));

    if (orphanedArticles.length > 0) {
      console.log(`\n⚠️  Warning: Found ${orphanedArticles.length} articles from users without projects`);
      console.log("   These users need to create a project first, then run this migration again.");
    }

    console.log("\n✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateToProjects()
  .then(() => {
    console.log("🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });