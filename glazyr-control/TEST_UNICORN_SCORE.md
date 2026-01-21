# Testing Unicorn Score

## Issue: Agent Doesn't Recognize Tools

When you ask:
```
/valuation what's the unicorn score for mcpmessenger/slashmcp?
```

The Valuation MCP server's agent responds that it doesn't have access to that information, suggesting it's not recognizing the `analyze_github_repository` and `unicorn_hunter` tools.

## Solution: Use More Explicit Language

Try these formats instead:

### Format 1: Explicit Analysis Request
```
/valuation analyze the mcpmessenger/slashmcp repository using the analyze_github_repository tool
```

### Format 2: Direct Tool Mention
```
/valuation use the unicorn_hunter tool to calculate the unicorn score for mcpmessenger/slashmcp
```

### Format 3: Two-Step Process (Most Reliable)

**Step 1: Get analysis**
```
/valuation analyze the mcpmessenger/slashmcp repository
```

**Step 2: Calculate unicorn score (after you get analysis results)**
```
/valuation use the unicorn_hunter tool on that repository data
```

### Format 4: Via calculate_valuation
```
/valuation calculate the valuation of mcpmessenger/slashmcp using unicorn_hunter method
```

## Alternative: Call Tools Directly via API

If the agent continues to have issues, you can call the tools directly (bypassing the agent):

```powershell
# Direct tool call to analyze_github_repository
$analyzeBody = @{
    tool = "analyze_github_repository"
    arguments = @{
        owner = "mcpmessenger"
        repo = "slashmcp"
    }
} | ConvertTo-Json -Depth 10

$analyzeResult = Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $analyzeBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

# Parse and use for unicorn_hunter
$analyzeJson = $analyzeResult | ConvertFrom-Json
$repoDataText = $analyzeJson.content[0].text
$repoData = $repoDataText | ConvertFrom-Json

# Call unicorn_hunter directly
$unicornBody = @{
    tool = "unicorn_hunter"
    arguments = @{
        repo_data = $repoData
    }
} | ConvertTo-Json -Depth 10

$unicornResult = Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $unicornBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Why This Happens

The Valuation MCP server has:
- Tools: `analyze_github_repository`, `calculate_valuation`, `compare_with_market`, `unicorn_hunter`
- Agent: Uses these tools but may not always recognize when to use them

The agent needs clear instructions about which tools to use, especially for multi-step operations like:
1. Analyze repository → get repo_data
2. Use repo_data → calculate unicorn score

## Recommendation

**Try this format:**
```
/valuation analyze mcpmessenger/slashmcp repository and then calculate its unicorn score using the unicorn_hunter tool
```

Or use the two-step process for best reliability.
