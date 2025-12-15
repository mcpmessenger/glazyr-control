"""
Google Places Python Bridge

Bridges the TypeScript Google Places connector to Python, supporting both
HTTP and subprocess communication patterns.
"""

import json
import os
import subprocess
import time
import uuid
from typing import Any, Dict, Optional

import requests

from ..tracing import get_request_id
from ..telemetry import log_connector_execution


class GooglePlacesBridge:
    """
    Bridge to the TypeScript Google Places connector.
    
    Supports two communication modes:
    1. HTTP (preferred): Requires a local HTTP server running the connector
    2. Subprocess: Directly executes Node.js (less stable, for development)
    """

    def __init__(
        self,
        connector_path: Optional[str] = None,
        http_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        """
        Initialize the bridge.
        
        Args:
            connector_path: Path to compiled TypeScript connector dist directory
            http_url: URL of HTTP server running connector (preferred)
            api_key: Google Places API key (or use secrets manager)
        """
        self.connector_path = connector_path or os.environ.get(
            "MCP_CONNECTORS_DIST", "/opt/mcp/connectors/dist"
        )
        self.http_url = http_url or os.environ.get("MCP_CONNECTORS_HTTP_URL")
        self.api_key = api_key

    def search(
        self,
        query: str,
        location: Optional[Dict[str, float]] = None,
        radius_meters: int = 1000,
        limit: int = 5,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        request_id = request_id or get_request_id() or str(uuid.uuid4())
        start_time = time.time()
        """
        Execute a Google Places search.
        
        Args:
            query: Search query (e.g., "vegan restaurants")
            location: Optional dict with 'lat' and 'lng' keys
            radius_meters: Search radius in meters (default 1000)
            limit: Maximum number of results (default 5)
            request_id: Optional request ID for tracing
            
        Returns:
            Dict with search results following ExecutionResult schema
            
        Raises:
            RuntimeError: If execution fails
        """
        if not request_id:
            request_id = str(uuid.uuid4())

        step = {
            "step_id": request_id,
            "action": "places_search",
            "input": {
                "query": query,
                "radius_meters": radius_meters,
                **({"lat": location["lat"], "lng": location["lng"]} if location else {}),
            },
        }

        constraints = {
            "max_results": limit,
            "fields": ["place_id", "name", "rating", "formatted_address", "opening_hours"],
            "budget": {"api_calls": 3},
        }

        # Prefer HTTP bridge if available
        try:
            if self.http_url:
                result = self._execute_via_http(step, constraints)
            else:
                result = self._execute_via_subprocess(step, constraints)
            
            # Log telemetry
            duration_ms = (time.time() - start_time) * 1000
            log_connector_execution(
                connector="google_places",
                request_id=request_id,
                status=result.get("status", "unknown"),
                duration_ms=duration_ms,
                error=result.get("error"),
            )
            
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            log_connector_execution(
                connector="google_places",
                request_id=request_id,
                status="error",
                duration_ms=duration_ms,
                error=str(e),
            )
            raise

    def place_details(
        self,
        place_id: str,
        fields: Optional[list] = None,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get details for a specific place.
        
        Args:
            place_id: Google Places place_id
            fields: Optional list of fields to retrieve
            request_id: Optional request ID for tracing
            
        Returns:
            Dict with place details
        """
        if not request_id:
            request_id = str(uuid.uuid4())

        step = {
            "step_id": request_id,
            "action": "place_details",
            "input": {"place_id": place_id, **({"fields": fields} if fields else {})},
        }

        constraints = {
            "budget": {"api_calls": 1},
            **({"fields": fields} if fields else {}),
        }

        if self.http_url:
            return self._execute_via_http(step, constraints)
        else:
            return self._execute_via_subprocess(step, constraints)

    def _execute_via_http(self, step: Dict[str, Any], constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Execute via HTTP server (preferred method)."""
        try:
            response = requests.post(
                f"{self.http_url}/google-places/execute",
                json={"step": step, "constraints": constraints},
                timeout=30,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()
            
            # Check if result indicates an error
            if isinstance(result, dict) and result.get("status") == "error":
                error_msg = result.get("error", "Unknown error")
                raise RuntimeError(f"Connector error: {error_msg}")
            
            return result
        except requests.exceptions.Timeout:
            raise RuntimeError("HTTP bridge request timed out")
        except requests.exceptions.HTTPError as e:
            # Try to extract error message from response
            try:
                error_data = e.response.json()
                error_msg = error_data.get("error", str(e))
            except:
                error_msg = str(e)
            raise RuntimeError(f"HTTP bridge failed: {error_msg}")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"HTTP bridge failed: {str(e)}")

    def _execute_via_subprocess(self, step: Dict[str, Any], constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Execute via Node.js subprocess (fallback, less stable)."""
        # Build the Node.js script
        script = f"""
const {{ GooglePlacesConnector }} = require('{self.connector_path}/google-places');
const connector = new GooglePlacesConnector({{
    apiKeyRef: 'GOOGLE_PLACES_API_KEY'
}});

const step = {json.dumps(step)};
const constraints = {json.dumps(constraints)};

connector.execute(step, constraints)
    .then(result => {{
        console.log(JSON.stringify(result));
    }})
    .catch(err => {{
        console.error(JSON.stringify({{
            status: 'error',
            step_id: step.step_id,
            error: err.message || String(err)
        }}));
        process.exit(1);
    }});
"""
        try:
            env = os.environ.copy()
            if self.api_key:
                env["GOOGLE_PLACES_API_KEY_GOOGLE_PLACES_API_KEY"] = self.api_key

            result = subprocess.run(
                ["node", "-e", script],
                capture_output=True,
                text=True,
                timeout=30,
                env=env,
            )

            if result.returncode != 0:
                error_output = result.stderr or result.stdout
                raise RuntimeError(f"Subprocess failed: {error_output}")

            output = result.stdout.strip()
            if not output:
                raise RuntimeError("No output from connector")

            parsed_result = json.loads(output)
            
            # Check if result indicates an error
            if isinstance(parsed_result, dict) and parsed_result.get("status") == "error":
                error_msg = parsed_result.get("error", "Unknown error")
                raise RuntimeError(f"Connector error: {error_msg}")
            
            return parsed_result
        except subprocess.TimeoutExpired:
            raise RuntimeError("Connector execution timed out")
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Invalid JSON response: {str(e)}")
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise  # Re-raise RuntimeErrors as-is
            raise RuntimeError(f"Subprocess bridge failed: {str(e)}")


# Singleton instance (initialized on first use)
_bridge_instance: Optional[GooglePlacesBridge] = None


def get_google_places_bridge() -> GooglePlacesBridge:
    """Get or create the singleton bridge instance."""
    global _bridge_instance
    if _bridge_instance is None:
        from ..secrets import get_google_places_api_key

        api_key = get_google_places_api_key()
        _bridge_instance = GooglePlacesBridge(api_key=api_key)
    return _bridge_instance
