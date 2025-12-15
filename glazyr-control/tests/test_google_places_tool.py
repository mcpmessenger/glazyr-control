"""
Integration tests for Google Places tool and bridge.

These tests verify the integration between:
- LangChain tool wrapper
- Python bridge
- TypeScript connector (mocked or via HTTP/subprocess)
"""

import os
import unittest
from unittest.mock import MagicMock, patch

# Only run tests if langchain is available
try:
    from langchain_core.messages import HumanMessage
    from langchain_openai import ChatOpenAI
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

from src.tools.google_places_tool import google_places_search_tool, GooglePlacesSearchInput
from src.connectors.google_places import GooglePlacesBridge


@unittest.skipIf(not LANGCHAIN_AVAILABLE, "langchain not available")
class TestGooglePlacesTool(unittest.TestCase):
    """Test LangChain tool wrapper."""

    def test_tool_schema(self):
        """Test that tool has correct schema."""
        self.assertEqual(google_places_search_tool.name, "google_places_search")
        self.assertIsNotNone(google_places_search_tool.description)
        self.assertIsNotNone(google_places_search_tool.args_schema)

    def test_tool_input_validation(self):
        """Test input schema validation."""
        # Valid input
        valid_input = GooglePlacesSearchInput(
            query="coffee shops",
            location={"lat": 41.58, "lng": -93.62},
            radius_meters=2000,
            limit=5,
        )
        self.assertEqual(valid_input.query, "coffee shops")
        self.assertEqual(valid_input.location["lat"], 41.58)

    @patch("src.tools.google_places_tool.get_google_places_bridge")
    def test_tool_execution_mock(self, mock_bridge):
        """Test tool execution with mocked bridge."""
        # Mock bridge response
        mock_bridge_instance = MagicMock()
        mock_bridge_instance.search.return_value = {
            "status": "success",
            "output": {
                "results": [
                    {
                        "name": "Test Coffee Shop",
                        "rating": 4.5,
                        "address": "123 Main St",
                        "place_id": "test_id_1",
                    }
                ]
            },
            "telemetry": {"duration_ms": 100},
        }
        mock_bridge.return_value = mock_bridge_instance

        # Execute tool
        result = google_places_search_tool.invoke({
            "query": "coffee shops",
            "limit": 5,
        })

        # Verify result
        self.assertIn("Test Coffee Shop", result)
        self.assertIn("Rating: 4.5", result)
        mock_bridge_instance.search.assert_called_once()

    @patch("src.tools.google_places_tool.get_google_places_bridge")
    def test_tool_execution_error(self, mock_bridge):
        """Test tool execution with error."""
        # Mock bridge error
        mock_bridge_instance = MagicMock()
        mock_bridge_instance.search.side_effect = Exception("API error")
        mock_bridge.return_value = mock_bridge_instance

        # Execute tool
        result = google_places_search_tool.invoke({
            "query": "coffee shops",
        })

        # Verify error is handled gracefully
        self.assertIn("Error", result)


class TestGooglePlacesBridge(unittest.TestCase):
    """Test Python bridge to TypeScript connector."""

    def test_bridge_initialization(self):
        """Test bridge can be initialized."""
        bridge = GooglePlacesBridge(
            http_url="http://localhost:3001",
            api_key="test_key",
        )
        self.assertEqual(bridge.http_url, "http://localhost:3001")
        self.assertEqual(bridge.api_key, "test_key")

    @patch("src.connectors.google_places.requests.post")
    def test_bridge_http_execution(self, mock_post):
        """Test bridge execution via HTTP."""
        # Mock HTTP response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": "success",
            "output": {"results": []},
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        bridge = GooglePlacesBridge(http_url="http://localhost:3001")
        result = bridge.search(query="coffee shops")

        self.assertEqual(result["status"], "success")
        mock_post.assert_called_once()

    @patch("src.connectors.google_places.subprocess.run")
    @patch("src.connectors.google_places.os.environ", {"PATH": "/usr/bin"})
    def test_bridge_subprocess_execution(self, mock_subprocess):
        """Test bridge execution via subprocess."""
        # Mock subprocess response
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '{"status": "success", "output": {"results": []}}'
        mock_result.stderr = ""
        mock_subprocess.return_value = mock_result

        bridge = GooglePlacesBridge(connector_path="/opt/mcp/connectors/dist")
        result = bridge.search(query="coffee shops")

        self.assertEqual(result["status"], "success")
        mock_subprocess.assert_called_once()


@unittest.skipIf(not LANGCHAIN_AVAILABLE, "langchain not available")
class TestAgentIntegration(unittest.TestCase):
    """Test agent integration with tools."""

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch("src.agent.ChatOpenAI")
    @patch("src.agent.get_tools")
    def test_agent_with_tools(self, mock_get_tools, mock_chat):
        """Test agent initialization with tools."""
        from src.agent import execute_agent, _get_tools

        # Mock tools
        mock_tool = MagicMock()
        mock_tool.name = "google_places_search"
        mock_get_tools.return_value = [mock_tool]

        # Mock LLM response (no tool calls)
        mock_llm_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "Test response"
        mock_response.tool_calls = []
        mock_llm_instance.invoke.return_value = mock_response
        mock_chat.return_value = mock_llm_instance

        # This would normally call the real agent, but we're mocking it
        # In a real integration test, you'd use a test LLM or mock the entire flow
        tools = _get_tools()
        self.assertGreater(len(tools), 0)


if __name__ == "__main__":
    unittest.main()
