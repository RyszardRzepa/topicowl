// Test script to verify write prompt saving functionality
// This is a simple test to check if the writePrompt is being saved correctly

const testWritePromptSaving = async () => {
  console.log("Testing write prompt saving functionality...");
  
  // Mock data for testing
  const testData = {
    researchData: {
      researchData: "Sample research data for testing"
    },
    title: "Test Article Title",
    keywords: ["test", "article", "prompt"],
    userId: "test-user-id",
    generationId: 1 // This should trigger prompt saving
  };

  try {
    const response = await fetch('http://localhost:3000/api/articles/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Write endpoint called successfully");
      console.log("Response:", result);
    } else {
      console.log("❌ Write endpoint failed");
      console.log("Status:", response.status);
      console.log("Error:", await response.text());
    }
  } catch (error) {
    console.log("❌ Network error:", error.message);
  }
};

// Note: This is just a test script template
// To actually run this, you would need to:
// 1. Start your development server (npm run dev)
// 2. Have a valid database connection
// 3. Have proper authentication setup
// 4. Run this script with Node.js

console.log("Test script created. To run actual tests, start your dev server and modify this script with real data.");