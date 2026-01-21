/**
 * Field Management for Google Places API
 * 
 * Enforces field-level minimization to reduce API costs and data exposure.
 */

export const PLACES_FIELDS = {
  // Basic fields
  place_id: 'id',
  name: 'displayName',
  rating: 'rating',
  address: 'formattedAddress',
  phone: 'nationalPhoneNumber',
  website: 'websiteUri',
  
  // Location fields
  location: 'location',
  viewport: 'viewport',
  
  // Hours fields
  opening_hours: 'currentOpeningHours',
  secondary_opening_hours: 'secondaryOpeningHours',
  
  // Additional fields
  price_level: 'priceLevel',
  user_rating_count: 'userRatingCount',
  photos: 'photos',
  reviews: 'reviews',
  types: 'types',
  plus_code: 'plusCode',
} as const;

export type PlaceField = keyof typeof PLACES_FIELDS;

/**
 * Validates that requested fields are allowed and minimizes to only requested fields.
 */
export function validateFields(
  requested: string[],
  allowed: string[] = Object.keys(PLACES_FIELDS)
): { valid: boolean; fields: string[]; error?: string } {
  const invalid = requested.filter(f => !allowed.includes(f));
  
  if (invalid.length > 0) {
    return {
      valid: false,
      fields: [],
      error: `Disallowed fields: ${invalid.join(', ')}`,
    };
  }

  // Return only requested fields (minimization)
  return {
    valid: true,
    fields: requested.length > 0 ? requested : allowed,
  };
}

/**
 * Gets the minimum field set for a given use case.
 */
export function getMinimalFields(useCase: 'search' | 'details' | 'photos' | 'hours' | 'reviews'): string[] {
  switch (useCase) {
    case 'search':
      return ['place_id', 'name', 'rating', 'address', 'opening_hours'];
    case 'details':
      return ['place_id', 'name', 'rating', 'address', 'phone', 'website', 'opening_hours'];
    case 'photos':
      return ['place_id', 'photos'];
    case 'hours':
      return ['place_id', 'opening_hours'];
    case 'reviews':
      return ['place_id', 'reviews'];
    default:
      return ['place_id', 'name'];
  }
}
