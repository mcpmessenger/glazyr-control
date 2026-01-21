/**
 * Demo Script - How to Use MCP Connectors
 * 
 * Run with: npx ts-node demo.ts
 * Or compile first: npm run build && node dist/demo.js
 */

import { GooglePlacesConnector } from './google-places';
import { PlaywrightConnector, PlaywrightPolicy } from './playwright';

/**
 * Demo 1: Google Places Search
 */
async function demoGooglePlaces() {
  console.log('\n=== Demo 1: Google Places Search ===\n');

  const connector = new GooglePlacesConnector({
    // In production, this would resolve from secure vault
    // For demo, you can set: process.env.GOOGLE_PLACES_API_KEY_REF = 'your-key'
    apiKeyRef: process.env.GOOGLE_PLACES_KEY_REF || 'DEMO_KEY_REF'
  });

  const step = {
    step_id: 'demo-places-1',
    action: 'places_search',
    input: {
      query: 'coffee shops',
      location: 'San Francisco',
      radius_meters: 1000
    }
  };

  const constraints = {
    max_results: 5,
    fields: ['place_id', 'name', 'rating', 'address'],
    budget: { api_calls: 1 }
  };

  // Always dry run first
  console.log('1. Dry run check...');
  const dryRun = await connector.dryRun(step, constraints);
  console.log('   Allowed:', dryRun.allowed);
  if (dryRun.reason) console.log('   Reason:', dryRun.reason);
  if (dryRun.warnings) console.log('   Warnings:', dryRun.warnings);

  if (!dryRun.allowed) {
    console.log('   ⚠️ Execution blocked. Check API key configuration.');
    return;
  }

  // Execute
  console.log('\n2. Executing search...');
  const result = await connector.execute(step, constraints);

  if (result.status === 'success') {
    console.log('   ✅ Success!');
    console.log('   Results:', JSON.stringify(result.output?.results, null, 2));
    console.log('   API calls used:', result.telemetry?.api_calls_used);
  } else {
    console.log('   ❌ Error:', result.error);
  }

  // Audit
  console.log('\n3. Audit event:');
  const audit = connector.auditEvent(result);
  console.log('   ', JSON.stringify(audit, null, 2));
}

/**
 * Demo 2: Playwright Read-Only Operations
 */
async function demoPlaywrightReadOnly() {
  console.log('\n=== Demo 2: Playwright Read-Only ===\n');

  const connector = new PlaywrightConnector(
    { headless: true, timeout: 30000 },
    new PlaywrightPolicy()
  );

  try {
    // Navigate
    console.log('1. Navigating to example.com...');
    const navigateStep = {
      step_id: 'demo-pw-1',
      action: 'open_url',
      input: { url: 'https://example.com' }
    };

    const constraints = {
      allowlist_domains: ['example.com'],
      budget: { max_steps: 5, max_time_ms: 10000 }
    };

    const dryRun = await connector.dryRun(navigateStep, constraints);
    if (!dryRun.allowed) {
      console.log('   ⚠️ Navigation blocked:', dryRun.reason);
      return;
    }

    const navResult = await connector.execute(navigateStep, constraints);
    if (navResult.status === 'success') {
      console.log('   ✅ Navigated successfully');
      console.log('   URL:', navResult.telemetry?.url);
    } else {
      console.log('   ❌ Error:', navResult.error);
      return;
    }

    // Extract text
    console.log('\n2. Extracting text...');
    const extractStep = {
      step_id: 'demo-pw-2',
      action: 'extract_text',
      input: {}
    };

    const extractResult = await connector.execute(extractStep, constraints);
    if (extractResult.status === 'success') {
      const text = extractResult.output?.text as string;
      console.log('   ✅ Text extracted');
      console.log('   Preview:', text?.substring(0, 100) + '...');
    }

    // Screenshot
    console.log('\n3. Taking screenshot...');
    const screenshotStep = {
      step_id: 'demo-pw-3',
      action: 'screenshot',
      input: { full_page: true }
    };

    const screenshotResult = await connector.execute(screenshotStep, constraints);
    if (screenshotResult.status === 'success') {
      console.log('   ✅ Screenshot captured');
      console.log('   Hash:', screenshotResult.proof?.screenshot_hash);
      console.log('   DOM snapshot hash:', screenshotResult.proof?.dom_snapshot_hash);
    }

  } finally {
    await connector.close();
    console.log('\n4. Browser closed');
  }
}

/**
 * Demo 3: Playwright Write Operations (Requires Approval)
 */
async function demoPlaywrightWrite() {
  console.log('\n=== Demo 3: Playwright Write Operations ===\n');

  const connector = new PlaywrightConnector(
    { headless: false, timeout: 30000 }, // Show browser for demo
    new PlaywrightPolicy()
  );

  try {
    // Navigate first
    await connector.execute({
      step_id: 'demo-pw-write-1',
      action: 'open_url',
      input: { url: 'https://example.com' }
    }, { allowlist_domains: ['example.com'] });

    // Type operation (high risk)
    console.log('1. Checking type operation...');
    const typeStep = {
      step_id: 'demo-pw-write-2',
      action: 'type',
      input: {
        selector: 'input[type="text"]',
        text_ref: 'DEMO_TEXT' // Would resolve from secure vault
      },
      requires_human_approval: false // Not approved yet
    };

    const dryRun = await connector.dryRun(typeStep, {
      allowlist_domains: ['example.com']
    });

    console.log('   Allowed:', dryRun.allowed);
    console.log('   Risk:', dryRun.estimatedRisk);
    console.log('   Requires approval:', dryRun.requiresHumanApproval);

    if (dryRun.requiresHumanApproval) {
      console.log('\n   ⚠️ This action requires human approval!');
      console.log('   In production, show approval UI to user.');
      console.log('   For demo, setting requires_human_approval: true');
      
      typeStep.requires_human_approval = true;
    }

    // In a real app, you'd wait for user approval here
    // For demo, we'll skip actual execution
    console.log('\n   (Skipping actual type execution for demo)');

  } finally {
    await connector.close();
  }
}

/**
 * Main demo runner
 */
async function main() {
  console.log('🚀 MCP Connectors Demo\n');
  console.log('This demo shows how to use the connectors.');
  console.log('Note: Some operations require API keys or user approval.\n');

  // Demo 1: Google Places
  try {
    await demoGooglePlaces();
  } catch (error) {
    console.error('Google Places demo error:', error);
  }

  // Demo 2: Playwright Read-Only
  try {
    await demoPlaywrightReadOnly();
  } catch (error) {
    console.error('Playwright read-only demo error:', error);
  }

  // Demo 3: Playwright Write
  try {
    await demoPlaywrightWrite();
  } catch (error) {
    console.error('Playwright write demo error:', error);
  }

  console.log('\n✅ Demo complete!');
  console.log('\nNext steps:');
  console.log('1. Configure API keys (Google Places)');
  console.log('2. Set up secure vault for text references');
  console.log('3. Integrate with glazyr-control or glazyr-extension');
  console.log('4. See USAGE_GUIDE.md for integration patterns');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { demoGooglePlaces, demoPlaywrightReadOnly, demoPlaywrightWrite };
