/**
 * Simple Playwright Test Script
 * 
 * Run with: npx ts-node test-playwright.ts
 * Or: npm run build && node dist/test-playwright.js
 */

import { PlaywrightConnector, PlaywrightPolicy } from './playwright';

async function testPlaywright() {
  console.log('🚀 Testing Playwright Connector\n');

  // Initialize connector
  const connector = new PlaywrightConnector(
    { 
      headless: false, // Set to true to run in background
      timeout: 30000 
    },
    new PlaywrightPolicy()
  );

  try {
    // Test 1: Navigate to a website
    console.log('Test 1: Navigating to example.com...');
    const navigateStep = {
      step_id: 'test-1',
      action: 'open_url',
      input: { url: 'https://example.com' }
    };

    const constraints = {
      allowlist_domains: ['example.com'],
      budget: { max_steps: 10, max_time_ms: 30000 }
    };

    // Dry run first
    const dryRun = await connector.dryRun(navigateStep, constraints);
    console.log('   Dry run result:', dryRun.allowed ? '✅ Allowed' : '❌ Blocked');
    if (dryRun.reason) console.log('   Reason:', dryRun.reason);

    if (!dryRun.allowed) {
      console.log('   ⚠️ Navigation blocked. Check constraints.');
      return;
    }

    // Execute
    const navResult = await connector.execute(navigateStep, constraints);
    if (navResult.status === 'success') {
      console.log('   ✅ Navigation successful!');
      console.log('   URL:', navResult.telemetry?.url);
      console.log('   Duration:', navResult.telemetry?.duration_ms, 'ms');
    } else {
      console.log('   ❌ Navigation failed:', navResult.error);
      return;
    }

    // Wait a moment so you can see the page
    console.log('\n   (Waiting 2 seconds so you can see the page...)');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Extract text
    console.log('\nTest 2: Extracting page text...');
    const extractStep = {
      step_id: 'test-2',
      action: 'extract_text',
      input: {} // Extract all visible text
    };

    const extractResult = await connector.execute(extractStep, constraints);
    if (extractResult.status === 'success') {
      const text = extractResult.output?.text as string;
      console.log('   ✅ Text extracted!');
      console.log('   Text length:', text?.length, 'characters');
      console.log('   Preview:', text?.substring(0, 150).replace(/\s+/g, ' ') + '...');
    } else {
      console.log('   ❌ Text extraction failed:', extractResult.error);
    }

    // Test 3: Take screenshot
    console.log('\nTest 3: Taking screenshot...');
    const screenshotStep = {
      step_id: 'test-3',
      action: 'screenshot',
      input: { full_page: true }
    };

    const screenshotResult = await connector.execute(screenshotStep, constraints);
    if (screenshotResult.status === 'success') {
      console.log('   ✅ Screenshot captured!');
      console.log('   Screenshot hash:', screenshotResult.proof?.screenshot_hash);
      console.log('   DOM snapshot hash:', screenshotResult.proof?.dom_snapshot_hash);
    } else {
      console.log('   ❌ Screenshot failed:', screenshotResult.error);
    }

    // Test 4: Test policy enforcement (try blocked domain)
    console.log('\nTest 4: Testing policy enforcement (blocked domain)...');
    const blockedStep = {
      step_id: 'test-4',
      action: 'open_url',
      input: { url: 'https://google.com' }
    };

    const blockedConstraints = {
      allowlist_domains: ['example.com'], // Only example.com allowed
      budget: { max_steps: 10 }
    };

    const blockedDryRun = await connector.dryRun(blockedStep, blockedConstraints);
    if (!blockedDryRun.allowed) {
      console.log('   ✅ Policy correctly blocked unauthorized domain!');
      console.log('   Reason:', blockedDryRun.reason);
    } else {
      console.log('   ⚠️ Policy did not block (unexpected)');
    }

    // Test 5: Test audit event
    console.log('\nTest 5: Testing audit event...');
    const audit = connector.auditEvent(navResult);
    console.log('   ✅ Audit event created:');
    console.log('   ', JSON.stringify(audit, null, 2));

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test error:', error);
  } finally {
    // Always close the browser
    console.log('\nClosing browser...');
    await connector.close();
    console.log('✅ Browser closed');
  }
}

// Run the test
testPlaywright().catch(console.error);
