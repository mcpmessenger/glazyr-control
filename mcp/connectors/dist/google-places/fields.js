"use strict";
/**
 * Field Management for Google Places API
 *
 * Enforces field-level minimization to reduce API costs and data exposure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLACES_FIELDS = void 0;
exports.validateFields = validateFields;
exports.getMinimalFields = getMinimalFields;
exports.PLACES_FIELDS = {
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
};
/**
 * Validates that requested fields are allowed and minimizes to only requested fields.
 */
function validateFields(requested, allowed = Object.keys(exports.PLACES_FIELDS)) {
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
function getMinimalFields(useCase) {
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
//# sourceMappingURL=fields.js.map