/**
 * Field Management for Google Places API
 *
 * Enforces field-level minimization to reduce API costs and data exposure.
 */
export declare const PLACES_FIELDS: {
    readonly place_id: "id";
    readonly name: "displayName";
    readonly rating: "rating";
    readonly address: "formattedAddress";
    readonly phone: "nationalPhoneNumber";
    readonly website: "websiteUri";
    readonly location: "location";
    readonly viewport: "viewport";
    readonly opening_hours: "currentOpeningHours";
    readonly secondary_opening_hours: "secondaryOpeningHours";
    readonly price_level: "priceLevel";
    readonly user_rating_count: "userRatingCount";
    readonly photos: "photos";
    readonly reviews: "reviews";
    readonly types: "types";
    readonly plus_code: "plusCode";
};
export type PlaceField = keyof typeof PLACES_FIELDS;
/**
 * Validates that requested fields are allowed and minimizes to only requested fields.
 */
export declare function validateFields(requested: string[], allowed?: string[]): {
    valid: boolean;
    fields: string[];
    error?: string;
};
/**
 * Gets the minimum field set for a given use case.
 */
export declare function getMinimalFields(useCase: 'search' | 'details' | 'photos' | 'hours' | 'reviews'): string[];
//# sourceMappingURL=fields.d.ts.map