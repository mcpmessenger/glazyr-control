"""
LangChain tool wrappers for Valuation MCP Server tools.

Provides LangChain-compatible tools for:
- Analyzing GitHub repositories
- Calculating repository valuations
- Comparing repositories with market benchmarks
"""

import json
import uuid
from typing import Any, Dict, Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from ..connectors.valuation_mcp import get_valuation_mcp_bridge


# ============================================================================
# Tool 1: Analyze GitHub Repository
# ============================================================================

class AnalyzeRepositoryInput(BaseModel):
    """Input schema for analyze_github_repository tool."""

    owner: str = Field(description="GitHub repository owner (username or organization)")
    repo: str = Field(description="GitHub repository name")


def _execute_analyze_repository(owner: str, repo: str) -> str:
    """
    Execute a GitHub repository analysis.
    
    Returns:
        Formatted analysis results, or error message
    """
    try:
        bridge = get_valuation_mcp_bridge()
        request_id = str(uuid.uuid4())

        result = bridge.analyze_repository(
            owner=owner,
            repo=repo,
            request_id=request_id,
        )

        # Handle result
        if result.get("status") == "error":
            error = result.get("error", "Unknown error")
            return f"Analysis error: {error}"

        # Extract content from result
        content = result.get("content", [])
        if isinstance(content, list) and len(content) > 0:
            # MCP tools return content as list of text blocks
            analysis_text = "\n".join([str(item.get("text", "")) for item in content if isinstance(item, dict)])
            if analysis_text:
                return analysis_text

        # Fallback: return JSON if content structure is different
        return json.dumps(result, indent=2)

    except Exception as e:
        return f"Error executing repository analysis: {str(e)}"


analyze_github_repository_tool = StructuredTool.from_function(
    func=_execute_analyze_repository,
    name="analyze_github_repository",
    description=(
        "Comprehensive analysis of a GitHub repository including metrics, scores, and development activity. "
        "Use this when the user asks about analyzing a GitHub repository, understanding its codebase, "
        "or getting metrics about a project. Requires the repository owner and repository name."
    ),
    args_schema=AnalyzeRepositoryInput,
    return_direct=False,
)


# ============================================================================
# Tool 2: Calculate Valuation
# ============================================================================

class CalculateValuationInput(BaseModel):
    """Input schema for calculate_valuation tool."""

    repo_data: Dict[str, Any] = Field(
        description="Repository analysis data (from analyze_github_repository tool output)"
    )
    method: str = Field(
        description="Valuation methodology: 'cost_based', 'market_based', 'scorecard', or 'income_based'"
    )
    team_size: Optional[int] = Field(
        None,
        description="Development team size (default: 1)"
    )
    hourly_rate: Optional[float] = Field(
        None,
        description="Hourly development rate in USD (default: 100.0)"
    )
    development_months: Optional[int] = Field(
        None,
        description="Development duration in months (default: 6)"
    )
    market_multiplier: Optional[float] = Field(
        None,
        description="Market multiplier for valuation (default: 10.0)"
    )


def _execute_calculate_valuation(
    repo_data: Dict[str, Any],
    method: str,
    team_size: Optional[int] = None,
    hourly_rate: Optional[float] = None,
    development_months: Optional[int] = None,
    market_multiplier: Optional[float] = None,
) -> str:
    """
    Calculate repository valuation using specified methodology.
    
    Returns:
        Formatted valuation results, or error message
    """
    try:
        bridge = get_valuation_mcp_bridge()
        request_id = str(uuid.uuid4())

        result = bridge.calculate_valuation(
            repo_data=repo_data,
            method=method,
            team_size=team_size,
            hourly_rate=hourly_rate,
            development_months=development_months,
            market_multiplier=market_multiplier,
            request_id=request_id,
        )

        # Handle result
        if result.get("status") == "error":
            error = result.get("error", "Unknown error")
            return f"Valuation calculation error: {error}"

        # Extract content from result
        content = result.get("content", [])
        if isinstance(content, list) and len(content) > 0:
            valuation_text = "\n".join([str(item.get("text", "")) for item in content if isinstance(item, dict)])
            if valuation_text:
                return valuation_text

        # Fallback: return JSON if content structure is different
        return json.dumps(result, indent=2)

    except Exception as e:
        return f"Error calculating valuation: {str(e)}"


calculate_valuation_tool = StructuredTool.from_function(
    func=_execute_calculate_valuation,
    name="calculate_valuation",
    description=(
        "Calculate repository valuation using multiple methodologies (cost_based, market_based, "
        "scorecard, or income_based). Use this when the user asks about valuing a repository, "
        "estimating its worth, or calculating its monetary value. Requires repository analysis data "
        "(from analyze_github_repository) and a valuation method."
    ),
    args_schema=CalculateValuationInput,
    return_direct=False,
)


# ============================================================================
# Tool 3: Compare with Market
# ============================================================================

class CompareWithMarketInput(BaseModel):
    """Input schema for compare_with_market tool."""

    repo_metrics: Dict[str, Any] = Field(
        description="Repository metrics (from analyze_github_repository tool output)"
    )
    category: Optional[str] = Field(
        None,
        description="Project category for comparison (e.g., 'mcp-server', 'langchain', 'web-framework')"
    )


def _execute_compare_with_market(
    repo_metrics: Dict[str, Any],
    category: Optional[str] = None,
) -> str:
    """
    Compare repository with market benchmarks.
    
    Returns:
        Formatted comparison results, or error message
    """
    try:
        bridge = get_valuation_mcp_bridge()
        request_id = str(uuid.uuid4())

        result = bridge.compare_with_market(
            repo_metrics=repo_metrics,
            category=category,
            request_id=request_id,
        )

        # Handle result
        if result.get("status") == "error":
            error = result.get("error", "Unknown error")
            return f"Market comparison error: {error}"

        # Extract content from result
        content = result.get("content", [])
        if isinstance(content, list) and len(content) > 0:
            comparison_text = "\n".join([str(item.get("text", "")) for item in content if isinstance(item, dict)])
            if comparison_text:
                return comparison_text

        # Fallback: return JSON if content structure is different
        return json.dumps(result, indent=2)

    except Exception as e:
        return f"Error comparing with market: {str(e)}"


compare_with_market_tool = StructuredTool.from_function(
    func=_execute_compare_with_market,
    name="compare_with_market",
    description=(
        "Compare repository with market benchmarks and similar projects. Use this when the user "
        "asks about how a repository compares to similar projects, market positioning, or "
        "competitive analysis. Requires repository metrics (from analyze_github_repository) "
        "and optionally a project category."
    ),
    args_schema=CompareWithMarketInput,
    return_direct=False,
)
