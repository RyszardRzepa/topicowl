// Quick test for the simplified API
async function testAPI() {
  try {
    console.log('Testing simplified generate ideas API...');
    
    const response = await fetch('/api/articles/generate-ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.ideas) {
      console.log(`✅ Success! Generated ${data.ideas.length} ideas`);
    } else {
      console.log('❌ Failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testAPI();