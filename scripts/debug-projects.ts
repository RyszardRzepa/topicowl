#!/usr/bin/env tsx

/**
 * Debug script to check project and article state
 */

import { db } from "../src/server/db";
import { projects, articles, users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function debugProjects() {
  console.log("🔍 Debugging project state...\n");

  try {
    // Check all users
    const allUsers = await db.select().from(users);
    console.log(`👥 Total users: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
      console.log(`    Onboarding completed: ${user.onboardingCompleted}`);
    });

    // Check all projects
    const allProjects = await db.select().from(projects);
    console.log(`\n🏢 Total projects: ${allProjects.length}`);
    allProjects.forEach(project => {
      console.log(`  - "${project.name}" by ${project.userId} (ID: ${project.id})`);
      console.log(`    Website: ${project.websiteUrl}`);
      console.log(`    Domain: ${project.domain}`);
      console.log(`    Created: ${project.createdAt}`);
    });

    // Check all articles
    const allArticles = await db.select().from(articles);
    console.log(`\n📝 Total articles: ${allArticles.length}`);
    allArticles.forEach(article => {
      console.log(`  - "${article.title}" (ID: ${article.id})`);
      console.log(`    User: ${article.userId}, Project: ${article.projectId}`);
      console.log(`    Status: ${article.status}`);
    });

    // Check for articles without project IDs
    const orphanedArticles = allArticles.filter(a => !a.projectId);
    if (orphanedArticles.length > 0) {
      console.log(`\n⚠️  Articles without project ID: ${orphanedArticles.length}`);
      orphanedArticles.forEach(article => {
        console.log(`  - "${article.title}" (ID: ${article.id}) - User: ${article.userId}`);
      });
    }

    // Check for user/project mismatches
    if (allUsers.length > 0 && allProjects.length > 0) {
      console.log(`\n🔍 User/Project relationship check:`);
      allProjects.forEach(project => {
        const matchingUser = allUsers.find(u => u.id === project.userId);
        if (matchingUser) {
          console.log(`  ✅ Project "${project.name}" belongs to user ${matchingUser.email}`);
        } else {
          console.log(`  ❌ Project "${project.name}" has orphaned userId: ${project.userId}`);
        }
      });
    }

    console.log("\n✅ Debug completed!");
    
  } catch (error) {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  }
}

// Run the debug
debugProjects()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });