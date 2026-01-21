/**
 * Example Usage of MCP Connectors
 * 
 * Demonstrates how to use Google Places and Playwright connectors together
 * in a "Find → Verify → Act" loop.
 */

import { GooglePlacesConnector } from './google-places';
import { PlaywrightConnector } from './playwright';
import { PlaywrightPolicy } from './playwright/policy';

/**
 * Example: Find top-rated coffee shop and book a meeting
 * 
 * This demonstrates the orchestration flow:
 * 1. Google Places finds candidates
 * 2. Planner chooses top result
 * 3. Playwright opens site and finds booking form
 * 4. Human approves before submission
 */
export async function findAndBookCoffeeShop() {
  // Initialize connectors
  const placesConnector = new GooglePlacesConnector({
    apiKeyRef: 'GOOGLE_PLACES_KEY_REF',
  });

  const playwrightConnector = new PlaywrightConnector(
    { headless: false, timeout: 30000 },
    new PlaywrightPolicy()
  );

  try {
    // Step 1: Search for coffee shops (Google Places)
    const searchStep = {
      step_id: 's1',
      action: 'places_search',
      input: {
        query: 'coffee shops near Union Square',
        location: 'San Francisco',
        radius_meters: 1500,
      },
    };

    const searchConstraints = {
      max_results: 10,
      fields: ['place_id', 'name', 'rating', 'address', 'opening_hours'],
      budget: { api_calls: 3 },
    };

    // Dry run
    const searchDryRun = await placesConnector.dryRun(searchStep, searchConstraints);
    if (!searchDryRun.allowed) {
      console.error('Search blocked:', searchDryRun.reason);
      return;
    }

    // Execute search
    const searchResult = await placesConnector.execute(searchStep, searchConstraints);
    if (searchResult.status !== 'success') {
      console.error('Search failed:', searchResult.error);
      return;
    }

    const results = searchResult.output?.results as any[];
    if (!results || results.length === 0) {
      console.log('No coffee shops found');
      return;
    }

    // Step 2: Choose top result (highest rating)
    const topResult = results.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    console.log(`Selected: ${topResult.name} (Rating: ${topResult.rating})`);

    // Step 3: Get place details (Google Places)
    const detailsStep = {
      step_id: 's2',
      action: 'place_details',
      input: {
        place_id: topResult.place_id,
        fields: ['website', 'phone', 'opening_hours'],
      },
    };

    const detailsResult = await placesConnector.execute(detailsStep, searchConstraints);
    if (detailsResult.status !== 'success') {
      console.error('Details fetch failed:', detailsResult.error);
      return;
    }

    const placeDetails = detailsResult.output as any;
    const website = placeDetails.website;

    if (!website) {
      console.log('No website available for this place');
      return;
    }

    // Step 4: Open website (Playwright)
    const openStep = {
      step_id: 's3',
      action: 'open_url',
      input: { url: website },
    };

    const playwrightConstraints = {
      allowlist_domains: [new URL(website).hostname],
      budget: { max_steps: 10, max_time_ms: 30000 },
    };

    const openDryRun = await playwrightConnector.dryRun(openStep, playwrightConstraints);
    if (!openDryRun.allowed) {
      console.error('Open URL blocked:', openDryRun.reason);
      return;
    }

    const openResult = await playwrightConnector.execute(openStep, playwrightConstraints);
    if (openResult.status !== 'success') {
      console.error('Open URL failed:', openResult.error);
      return;
    }

    // Step 5: Extract text to find booking form (Playwright)
    const extractStep = {
      step_id: 's4',
      action: 'extract_text',
      input: {}, // Extract all visible text
    };

    const extractResult = await playwrightConnector.execute(extractStep, playwrightConstraints);
    if (extractResult.status !== 'success') {
      console.error('Extract text failed:', extractResult.error);
      return;
    }

    const pageText = extractResult.output?.text as string;
    console.log('Page text extracted, looking for booking form...');

    // Step 6: Take screenshot for human review (Playwright)
    const screenshotStep = {
      step_id: 's5',
      action: 'screenshot',
      input: { full_page: true },
    };

    const screenshotResult = await playwrightConnector.execute(screenshotStep, playwrightConstraints);
    if (screenshotResult.status === 'success') {
      console.log('Screenshot captured for review');
      console.log('Screenshot hash:', screenshotResult.proof?.screenshot_hash);
    }

    // At this point, the control plane would:
    // 1. Show the business source (from Google Places)
    // 2. Show the planned browser actions
    // 3. Calculate risk score
    // 4. Request human approval

    // Step 7: Type in booking form (requires approval)
    // This would only execute if human_approval flag is set
    const typeStep = {
      step_id: 's6',
      action: 'type',
      input: {
        selector: '#booking-email',
        text_ref: 'USER_EMAIL', // Reference to secure vault
      },
      requires_human_approval: true, // Must be explicitly set
    };

    const typeDryRun = await playwrightConnector.dryRun(typeStep, playwrightConstraints);
    if (typeDryRun.allowed && typeDryRun.requiresHumanApproval) {
      console.log('⚠️ Type action requires human approval');
      console.log('Risk level:', typeDryRun.estimatedRisk);
    }

    // Cleanup
    await playwrightConnector.close();

    console.log('✅ Find → Verify → Act loop completed');
  } catch (error) {
    console.error('Error in orchestration:', error);
    await playwrightConnector.close();
  }
}

/**
 * Example: Simple Google Places search
 */
export async function simplePlacesSearch() {
  const connector = new GooglePlacesConnector({
    apiKeyRef: 'GOOGLE_PLACES_KEY_REF',
  });

  const step = {
    step_id: 's1',
    action: 'places_search',
    input: {
      query: 'restaurants in Manhattan',
      location: 'New York',
    },
  };

  const constraints = {
    max_results: 5,
    fields: ['place_id', 'name', 'rating'],
    budget: { api_calls: 1 },
  };

  const result = await connector.execute(step, constraints);
  console.log('Search results:', result.output);
}

/**
 * Example: Read-only Playwright operations
 */
export async function readOnlyBrowserOps() {
  const connector = new PlaywrightConnector({ headless: true });

  // Navigate
  const navigateStep = {
    step_id: 's1',
    action: 'open_url',
    input: { url: 'https://example.com' },
  };

  const constraints = {
    allowlist_domains: ['example.com'],
    budget: { max_steps: 5 },
  };

  await connector.execute(navigateStep, constraints);

  // Extract text
  const extractStep = {
    step_id: 's2',
    action: 'extract_text',
    input: {},
  };

  const extractResult = await connector.execute(extractStep, constraints);
  console.log('Extracted text:', extractResult.output?.text);

  // Screenshot
  const screenshotStep = {
    step_id: 's3',
    action: 'screenshot',
    input: { full_page: true },
  };

  const screenshotResult = await connector.execute(screenshotStep, constraints);
  console.log('Screenshot hash:', screenshotResult.proof?.screenshot_hash);

  await connector.close();
}
