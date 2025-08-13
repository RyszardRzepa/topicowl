#!/usr/bin/env tsx

/**
 * Validation script to check for data migration completeness
 * Verifies all existing data has proper project_id associations
 */

import { db } from "../src/server/db";
import { 
  articles, 
  articleSettings, 
  articleGeneration, 
  generationQueue,
  webhookDeliveries,
  projects, 
  users 
} from "../src/server/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

interface ValidationResult {
  table: string;
  totalRecords: number;
  recordsWithProject: number;
  orphanedRecords: number;
  issues: string[];
}

async function validateProjectMigration(): Promise<ValidationResult[]> {
  console.log("🔍 Validating project migration completeness...\n");

  const results: ValidationResult[] = [];

  // Check articles table
  const articlesValidation = await validateTable("articles", articles.id, articles.projectId);
  results.push(articlesValidation);

  // Check article_generation table
  const generationValidation = await validateTable("article_generation", articleGeneration.id, articleGeneration.projectId);
  results.push(generationValidation);

  // Check generation_queue table
  const queueValidation = await validateTable("generation_queue", generationQueue.id, generationQueue.projectId);
  results.push(queueValidation);

  // Check webhook_deliveries table
  const webhookValidation = await validateTable("webhook_deliveries", webhookDeliveries.id, webhookDeliveries.projectId);
  results.push(webhookValidation);

  // Check article_settings table
  const settingsValidation = await validateTable("article_settings", articleSettings.id, articleSettings.projectId);
  results.push(settingsValidation);

  // Check for users without projects
  const usersWithoutProjects = await db
    .select({
      userId: users.id,
      email: users.email,
    })
    .from(users)
    .leftJoin(projects, eq(users.id, projects.userId))
    .where(isNull(projects.id));

  if (usersWithoutProjects.length > 0) {
    console.log(`⚠️  Found ${usersWithoutProjects.length} users without projects:`);
    usersWithoutProjects.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.userId})`);
    });
  }

  // Check for project integrity
  const projectIntegrityIssues = await checkProjectIntegrity();
  
  return results;
}

async function validateTable(tableName: string, idColumn: any, projectIdColumn: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: tableName,
    totalRecords: 0,
    recordsWithProject: 0,
    orphanedRecords: 0,
    issues: []
  };

  try {
    // Get total count and count with project_id
    const counts = await db
      .select({
        total: sql<number>`count(*)`,
        withProject: sql<number>`count(${projectIdColumn})`,
      })
      .from(idColumn.table);

    result.totalRecords = counts[0]?.total ?? 0;
    result.recordsWithProject = counts[0]?.withProject ?? 0;
    result.orphanedRecords = result.totalRecords - result.recordsWithProject;

    console.log(`📊 ${tableName}:`);
    console.log(`   Total records: ${result.totalRecords}`);
    console.log(`   Records with project_id: ${result.recordsWithProject}`);
    console.log(`   Orphaned records: ${result.orphanedRecords}`);

    if (result.orphanedRecords > 0) {
      result.issues.push(`${result.orphanedRecords} records missing project_id`);
      console.log(`   ❌ ${result.orphanedRecords} records are missing project_id`);
    } else {
      console.log(`   ✅ All records have project_id`);
    }

  } catch (error) {
    result.issues.push(`Error validating table: ${error}`);
    console.log(`   ❌ Error validating ${tableName}: ${error}`);
  }

  console.log("");
  return result;
}

async function checkProjectIntegrity(): Promise<string[]> {
  const issues: string[] = [];

  try {
    // Check for invalid project_id references
    const invalidProjectRefs = await db
      .select({
        table: sql<string>`'articles'`,
        count: sql<number>`count(*)`,
      })
      .from(articles)
      .leftJoin(projects, eq(articles.projectId, projects.id))
      .where(isNull(projects.id));

    if (invalidProjectRefs[0]?.count > 0) {
      issues.push(`${invalidProjectRefs[0].count} articles reference non-existent projects`);
    }

    // Check user-project relationships
    const userProjectMismatch = await db
      .select({
        articleId: articles.id,
        articleUserId: articles.userId,
        projectUserId: projects.userId,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(sql`${articles.userId} != ${projects.userId}`);

    if (userProjectMismatch.length > 0) {
      issues.push(`${userProjectMismatch.length} articles have mismatched user-project relationships`);
      console.log(`⚠️  Found ${userProjectMismatch.length} articles with user-project mismatches:`);
      userProjectMismatch.forEach(mismatch => {
        console.log(`   - Article ${mismatch.articleId}: article.user_id=${mismatch.articleUserId}, project.user_id=${mismatch.projectUserId}`);
      });
    }

  } catch (error) {
    issues.push(`Error checking project integrity: ${error}`);
  }

  return issues;
}

// Run the validation
validateProjectMigration()
  .then((results) => {
    console.log("📋 Validation Summary:");
    console.log("=".repeat(50));
    
    let totalIssues = 0;
    results.forEach(result => {
      if (result.issues.length > 0) {
        console.log(`❌ ${result.table}: ${result.issues.join(", ")}`);
        totalIssues += result.issues.length;
      } else {
        console.log(`✅ ${result.table}: All records properly migrated`);
      }
    });

    if (totalIssues === 0) {
      console.log("\n🎉 All data has been properly migrated to project-based structure!");
    } else {
      console.log(`\n⚠️  Found ${totalIssues} issues that need attention.`);
      console.log("Run the migration script to fix orphaned records.");
    }

    process.exit(totalIssues > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("💥 Validation failed:", error);
    process.exit(1);
  });