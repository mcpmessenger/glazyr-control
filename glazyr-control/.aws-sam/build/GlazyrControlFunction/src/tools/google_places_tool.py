"""
LangChain tool wrapper for Google Places search.

Provides a LangChain-compatible tool that can be bound to an LLM
for function calling / tool use.
"""

import uuid
from typing import Any, Dict, Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from ..connectors.google_places import get_google_places_bridge


class GooglePlacesSearchInput(BaseModel):
    """Input schema for Google Places search tool."""

    query: str = Field(description="Search query (e.g., 'vegan restaurants near me')")
    location: Optional[Dict[str, float]] = Field(
        None,
        description="Optional location dict with 'lat' and 'lng' keys (e.g., {'lat': 41.58, 'lng': -93.62})",
    )
    radius_meters: int = Field(2000, description="Search radius in meters (default 2000)")
    limit: int = Field(5, description="Maximum number of results to return (default 5)")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "vegan restaurants near me",
                "location": {"lat": 41.58, "lng": -93.62},
                "radius_meters": 2000,
                "limit": 5,
            }
        }


def _execute_google_places_search(
    query: str,
    location: Optional[Dict[str, float]] = None,
    radius_meters: int = 2000,
    limit: int = 5,
) -> str:
    """
    Execute a Google Places search and return formatted results.
    
    This function is called by LangChain when the LLM decides to use
    the google_places_search tool.
    
    Returns:
        JSON string with search results, or error message
    """
    try:
        bridge = get_google_places_bridge()
        request_id = str(uuid.uuid4())

        result = bridge.search(
            query=query,
            location=location,
            radius_meters=radius_meters,
            limit=limit,
            request_id=request_id,
        )

        # Handle different result statuses
        if result.get("status") == "success":
            output = result.get("output", {})
            results = output.get("results", [])
            if not results:
                return "No places found matching the search criteria."

            # Format results for LLM consumption
            formatted = []
            for place in results:
                place_str = f"- {place.get('name', 'Unknown')}"
                if place.get("rating"):
                    place_str += f" (Rating: {place.get('rating')}/5.0"
                    if place.get("user_rating_count"):
                        place_str += f", {place.get('user_rating_count')} reviews"
                    place_str += ")"
                if place.get("address"):
                    place_str += f"\n  Address: {place.get('address')}"
                if place.get("open_now") is not None:
                    place_str += f"\n  Currently: {'Open' if place.get('open_now') else 'Closed'}"
                if place.get("place_id"):
                    place_str += f"\n  Place ID: {place.get('place_id')}"
                formatted.append(place_str)

            return "Found places:\n\n" + "\n\n".join(formatted)

        elif result.get("status") == "blocked":
            error = result.get("error", "Search was blocked")
            return f"Search blocked: {error}"

        elif result.get("status") == "error":
            error = result.get("error", "Unknown error")
            return f"Search error: {error}"

        else:
            return f"Unexpected result status: {result.get('status')}"

    except Exception as e:
        return f"Error executing Google Places search: {str(e)}"


# Create the LangChain tool
google_places_search_tool = StructuredTool.from_function(
    func=_execute_google_places_search,
    name="google_places_search",
    description=(
        "Search for places (restaurants, businesses, points of interest) using Google Places API. "
        "Use this when the user asks about finding businesses, restaurants, or locations. "
        "Requires a search query and optionally a location (latitude/longitude) and radius. "
        "Returns formatted results with names, ratings, addresses, and place IDs."
    ),
    args_schema=GooglePlacesSearchInput,
    return_direct=False,
)
