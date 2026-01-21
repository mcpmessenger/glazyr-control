# Troubleshooting Valuation MCP Queries

## Common Issue: "Agent stopped due to iteration limit"

This happens when the Valuation MCP server's agent needs to make multiple tool calls (e.g., analyze repository → calculate unicorn score) but hits iteration limits.

## Solutions

### Solution 1: Use More Direct Queries (Recommended)

Instead of asking the agent to do everything, be more explicit:

**❌ Less effective:**
```
/valuation unicorn_hunter analyze https://github.com/mcpmessenger/slashmcp
```

**✅ Better:**
```
/valuation analyze the mcpmessenger/slashmcp repository and calculate its unicorn score
```

**✅ Even better (two-step):**
```
/valuation analyze the mcpmessenger/slashmcp repository
```
Then:
```
/valuation calculate the unicorn score for that repository
```

### Solution 2: Use Owner/Repo Format

The Valuation MCP server works better with `owner/repo` format than full GitHub URLs:

**❌ Less effective:**
```
/valuation analyze https://github.com/mcpmessenger/slashmcp
```

**✅ Better:**
```
/valuation analyze the mcpmessenger/slashmcp repository
```

### Solution 3: Direct Tool Calls (Advanced)

If you have the repo_data, you can call tools directly via API:

```powershell
# Step 1: Analyze repository
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

# Step 2: Extract repo_data and call unicorn_hunter
$analyzeJson = $analyzeResult | ConvertFrom-Json
$repoDataText = $analyzeJson.content[0].text
$repoData = $repoDataText | ConvertFrom-Json

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

## Best Practices

### ✅ Good Query Formats

1. **Simple analysis:**
   ```
   /valuation analyze the langchain-ai/langchain repository
   ```

2. **Unicorn score (natural language):**
   ```
   /valuation what's the unicorn score for langchain-ai/langchain?
   ```

3. **Valuation with method:**
   ```
   /valuation calculate the valuation of langchain-ai/langchain using unicorn_hunter method
   ```

### ❌ Problematic Query Formats

1. **Too complex in one query:**
   ```
   /valuation unicorn_hunter analyze https://github.com/owner/repo
   ```

2. **Full GitHub URLs (less reliable):**
   ```
   /valuation analyze https://github.com/owner/repo
   ```

3. **Ambiguous requests:**
   ```
   /valuation do everything for that repo
   ```

## Why This Happens

The Valuation MCP server uses an agent that:
1. Receives your query
2. Decides which tools to call
3. Calls tools in sequence
4. Combines results

When you ask for "unicorn_hunter analyze", the agent needs to:
1. Parse the request
2. Call `analyze_github_repository` 
3. Extract repo_data
4. Call `unicorn_hunter` with repo_data
5. Format the response

This can exceed iteration limits if the agent takes too many steps.

## Workaround: Two-Step Process

**Step 1: Analyze**
```
/valuation analyze the mcpmessenger/slashmcp repository
```

**Step 2: Calculate Unicorn Score**
```
/valuation calculate the unicorn score for mcpmessenger/slashmcp
```

The agent can use the context from the first query to make the second one simpler.

## Technical Details

- **Timeout**: Increased to 180 seconds for valuation queries
- **Iteration Limit**: Set by Valuation MCP server (not configurable from glazyr-control)
- **Tool Chaining**: Agent may need to call 2-3 tools in sequence

## Summary

- ✅ Use `owner/repo` format instead of full URLs
- ✅ Break complex queries into simpler steps
- ✅ Be explicit about what you want
- ✅ Use natural language rather than tool names directly
- ❌ Avoid combining multiple operations in one query
