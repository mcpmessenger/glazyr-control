/**
 * Google Places MCP Connector
 * 
 * Role: Trusted sensory input - provides grounded, external truth about businesses,
 * locations, ratings, hours, and Place IDs.
 * 
 * Risk Level: Low (read-heavy, no destructive actions)
 */

import { MCPConnector, MCPStep, MCPConstraints, AuthContext, DryRunResult, ExecutionResult, AuditEvent } from '../types';

interface GooglePlacesConfig {
  apiKey?: string;
  apiKeyRef?: string; // Reference to secure vault key
}

interface PlacesSearchInput {
  query?: string;
  location?: string;
  radius_meters?: number;
  lat?: number;
  lng?: number;
  type?: string;
}

interface PlaceDetailsInput {
  place_id: string;
  fields?: string[];
}

interface PlacePhotosInput {
  place_id: string;
  max_width?: number;
  max_height?: number;
}

interface PlaceHoursInput {
  place_id: string;
}

interface PlaceReviewsInput {
  place_id: string;
}

export class GooglePlacesConnector implements MCPConnector {
  name = 'google-places';
  version = '1.0.0';
  private config: GooglePlacesConfig;
  private apiCallsUsed = 0;

  constructor(config: GooglePlacesConfig = {}) {
    this.config = config;
  }

  async authorize(context: Record<string, unknown>): Promise<AuthContext> {
    // Google Places API key should be resolved from secure vault
    // This connector never receives raw secrets, only references
    const apiKey = this.config.apiKey || (context.apiKeyRef ? await this.resolveApiKey(context.apiKeyRef as string) : null);
    
    return {
      authenticated: !!apiKey,
      metadata: {
        hasApiKey: !!apiKey,
      },
    };
  }

  async dryRun(step: MCPStep, constraints: MCPConstraints): Promise<DryRunResult> {
    // Google Places is read-only, so most actions are low risk
    const action = step.action.toLowerCase();
    
    // Validate action is supported
    const supportedActions = ['places_search', 'place_details', 'place_photos', 'place_hours', 'place_reviews'];
    if (!supportedActions.includes(action)) {
      return {
        allowed: false,
        reason: `Unsupported action: ${action}`,
        estimatedRisk: 'high',
      };
    }

    // Check API call budget
    const budget = constraints.budget;
    if (budget?.api_calls && this.apiCallsUsed >= budget.api_calls) {
      return {
        allowed: false,
        reason: 'API call budget exceeded',
        estimatedRisk: 'low',
      };
    }

    // Validate input structure
    const validation = this.validateInput(step.action, step.input);
    if (!validation.valid) {
      return {
        allowed: false,
        reason: validation.error || 'Invalid input structure',
        estimatedRisk: 'low',
      };
    }

    return {
      allowed: true,
      estimatedRisk: 'low',
      requiresHumanApproval: false,
      warnings: validation.warnings,
    };
  }

  async execute(step: MCPStep, constraints: MCPConstraints): Promise<ExecutionResult> {
    const startTime = Date.now();
    const action = step.action.toLowerCase();

    try {
      // Dry run check first
      const dryRun = await this.dryRun(step, constraints);
      if (!dryRun.allowed) {
        return {
          status: 'blocked',
          step_id: step.step_id,
          error: dryRun.reason || 'Execution blocked by dry run',
        };
      }

      // Resolve API key
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return {
          status: 'error',
          step_id: step.step_id,
          error: 'Google Places API key not configured',
        };
      }

      // Execute action
      let output: Record<string, unknown>;
      switch (action) {
        case 'places_search':
          output = await this.placesSearch(step.input as unknown as PlacesSearchInput, constraints);
          break;
        case 'place_details':
          output = await this.placeDetails(step.input as unknown as PlaceDetailsInput, constraints);
          break;
        case 'place_photos':
          output = await this.placePhotos(step.input as unknown as PlacePhotosInput, constraints);
          break;
        case 'place_hours':
          output = await this.placeHours(step.input as unknown as PlaceHoursInput, constraints);
          break;
        case 'place_reviews':
          output = await this.placeReviews(step.input as unknown as PlaceReviewsInput, constraints);
          break;
        default:
          return {
            status: 'error',
            step_id: step.step_id,
            error: `Unsupported action: ${action}`,
          };
      }

      this.apiCallsUsed++;
      const duration = Date.now() - startTime;

      return {
        status: 'success',
        step_id: step.step_id,
        output,
        telemetry: {
          duration_ms: duration,
          api_calls_used: this.apiCallsUsed,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        step_id: step.step_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        telemetry: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  auditEvent(result: ExecutionResult): AuditEvent {
    return {
      timestamp: Date.now(),
      connector: this.name,
      step_id: result.step_id,
      action: 'execute',
      status: result.status,
      metadata: {
        telemetry: result.telemetry,
      },
    };
  }

  // Private helper methods

  private async getApiKey(): Promise<string | null> {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }
    if (this.config.apiKeyRef) {
      return await this.resolveApiKey(this.config.apiKeyRef);
    }
    return null;
  }

  private async resolveApiKey(ref: string): Promise<string | null> {
    // In production, this would resolve from a secure vault
    // For now, return null to indicate key resolution needed
    // This should be implemented by the extension or secure vault service
    return process.env[`GOOGLE_PLACES_API_KEY_${ref}`] || null;
  }

  private validateInput(action: string, input: Record<string, unknown>): { valid: boolean; error?: string; warnings?: string[] } {
    const warnings: string[] = [];

    switch (action) {
      case 'places_search':
        if (!input.query && !input.location && (!input.lat || !input.lng)) {
          return { valid: false, error: 'places_search requires query, location, or lat/lng' };
        }
        break;
      case 'place_details':
      case 'place_photos':
      case 'place_hours':
      case 'place_reviews':
        if (!input.place_id) {
          return { valid: false, error: `${action} requires place_id` };
        }
        break;
    }

    return { valid: true, warnings };
  }

  private async placesSearch(input: PlacesSearchInput, constraints: MCPConstraints): Promise<Record<string, unknown>> {
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error('API key not available');

    // Build query parameters
    const params = new URLSearchParams();
    
    if (input.query) {
      params.append('query', input.query);
    } else if (input.location) {
      params.append('query', input.location);
    }

    if (input.lat && input.lng) {
      params.append('location', `${input.lat},${input.lng}`);
    }

    if (input.radius_meters) {
      params.append('radius', input.radius_meters.toString());
    }

    if (input.type) {
      params.append('type', input.type);
    }

    // Apply field minimization from constraints
    const fields = constraints.fields || ['place_id', 'name', 'rating', 'formatted_address', 'opening_hours'];
    params.append('fields', fields.join(','));

    // Limit results
    const maxResults = constraints.max_results || 10;
    params.append('key', apiKey);

    // Make API call
    const url = `https://places.googleapis.com/v1/places:searchText`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        textQuery: input.query || input.location,
        maxResultCount: maxResults,
        locationBias: input.lat && input.lng ? {
          circle: {
            center: { latitude: input.lat, longitude: input.lng },
            radius: input.radius_meters || 1500,
          },
        } : undefined,
        includedTypes: input.type ? [input.type] : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    
    // Transform to simplified format
    const results = (data.places || []).slice(0, maxResults).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text,
      rating: place.rating,
      address: place.formattedAddress,
      open_now: place.currentOpeningHours?.openNow,
      price_level: place.priceLevel,
      user_rating_count: place.userRatingCount,
    }));

    return { results };
  }

  private async placeDetails(input: PlaceDetailsInput, constraints: MCPConstraints): Promise<Record<string, unknown>> {
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error('API key not available');

    const fields = input.fields || constraints.fields || ['id', 'displayName', 'rating', 'formattedAddress', 'openingHours'];
    const fieldMask = fields.join(',');

    const url = `https://places.googleapis.com/v1/places/${input.place_id}?fields=${fieldMask}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${error}`);
    }

    const place = await response.json() as any;
    
    return {
      place_id: place.id,
      name: place.displayName?.text,
      rating: place.rating,
      address: place.formattedAddress,
      opening_hours: place.currentOpeningHours?.weekdayDescriptions,
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
    };
  }

  private async placePhotos(input: PlacePhotosInput, constraints: MCPConstraints): Promise<Record<string, unknown>> {
    const apiKey = await this.getApiKey();
    if (!apiKey) throw new Error('API key not available');

    // First get place details to access photos
    const details = await this.placeDetails({ place_id: input.place_id }, constraints);
    
    // Note: Actual photo retrieval requires additional API calls
    // This is a simplified version
    return {
      place_id: input.place_id,
      photos: [], // Would contain photo metadata
      message: 'Photo retrieval requires additional API calls',
    };
  }

  private async placeHours(input: PlaceHoursInput, constraints: MCPConstraints): Promise<Record<string, unknown>> {
    const details = await this.placeDetails({ place_id: input.place_id, fields: ['openingHours'] }, constraints);
    
    return {
      place_id: input.place_id,
      opening_hours: details.opening_hours,
      open_now: details.open_now,
    };
  }

  private async placeReviews(input: PlaceReviewsInput, constraints: MCPConstraints): Promise<Record<string, unknown>> {
    const details = await this.placeDetails({ place_id: input.place_id, fields: ['reviews'] }, constraints);
    
    return {
      place_id: input.place_id,
      reviews: details.reviews || [],
    };
  }
}
