# Valuation MCP Server Integration

## Overview

The Valuation Analysis MCP Server has been integrated into Glazyr Control, providing tools for analyzing and valuing GitHub repositories.

**Server URL**: `https://valuation-mcp-server-554655392699.us-central1.run.app`

## Available Tools

### 1. `analyze_github_repository`
Comprehensive analysis of a GitHub repository including metrics, scores, and development activity.

**Input:**
- `owner` (string): GitHub repository owner (username or organization)
- `repo` (string): GitHub repository name

**Example:**
```python
# The agent can now use this tool when users ask about analyzing repositories
# "Analyze the langchain-ai/langchain repository"
```

### 2. `calculate_valuation`
Calculate repository valuation using multiple methodologies.

**Input:**
- `repo_data` (dict): Repository analysis data (from `analyze_github_repository`)
- `method` (string): Valuation methodology - one of:
  - `cost_based`: Based on development costs
  - `market_based`: Based on market comparisons
  - `scorecard`: Scorecard methodology
  - `income_based`: Based on potential income
- `team_size` (int, optional): Development team size (default: 1)
- `hourly_rate` (float, optional): Hourly development rate in USD (default: 100.0)
- `development_months` (int, optional): Development duration in months (default: 6)
- `market_multiplier` (float, optional): Market multiplier (default: 10.0)

**Example:**
```python
# The agent can use this after analyzing a repository
# "Calculate the valuation of this repository using cost-based method"
```

### 3. `compare_with_market`
Compare repository with market benchmarks and similar projects.

**Input:**
- `repo_metrics` (dict): Repository metrics (from `analyze_github_repository`)
- `category` (string, optional): Project category (e.g., 'mcp-server', 'langchain', 'web-framework')

**Example:**
```python
# The agent can use this to compare repositories
# "How does this repository compare to similar projects in the mcp-server category?"
```

## Architecture

The integration follows the standard Glazyr connector pattern:

1. **Python Bridge** (`src/connectors/valuation_mcp.py`)
   - HTTP client for the Valuation MCP server
   - Handles authentication, error handling, and telemetry
   - Provides convenience methods for each tool

2. **LangChain Tools** (`src/tools/valuation_tools.py`)
   - Wraps bridge methods as LangChain-compatible tools
   - Provides structured input schemas
   - Formats output for LLM consumption

3. **Agent Registration** (`src/agent.py`)
   - Tools are automatically registered via `_get_tools()`
   - Available to the agent for function calling

## Configuration

The server URL can be configured via environment variable:

```bash
export VALUATION_MCP_SERVER_URL="https://valuation-mcp-server-554655392699.us-central1.run.app"
```

If not set, it defaults to the production URL above.

## Usage

The tools are automatically available to the agent. Users can interact with them through natural language:

- "Analyze the langchain-ai/langchain repository"
- "What's the valuation of this repository?"
- "Compare this repository with similar projects in the mcp-server category"

The agent will automatically:
1. Detect when to use these tools
2. Call the appropriate tool with correct parameters
3. Format and return results to the user

## Testing

To test the integration:

```python
from glazyr_control.src.connectors.valuation_mcp import get_valuation_mcp_bridge

bridge = get_valuation_mcp_bridge()

# Test repository analysis
result = bridge.analyze_repository(owner="langchain-ai", repo="langchain")
print(result)
```

## Error Handling

The bridge includes comprehensive error handling:
- Timeout protection (60 seconds)
- HTTP error handling
- Telemetry logging for all operations
- Request ID tracking for debugging

## Telemetry

All tool executions are logged via `log_connector_execution()` with:
- Connector name: `valuation_mcp`
- Request ID for tracing
- Status (success/error)
- Duration in milliseconds
- Error messages (if any)
