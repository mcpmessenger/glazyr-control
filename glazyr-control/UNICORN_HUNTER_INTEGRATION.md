# Unicorn Hunter Feature Integration

## Overview

The **Unicorn Hunter** feature is now available through the Valuation MCP server. This gamified valuation tool provides speculative estimates with a $1 billion cap, making repository valuation analysis more engaging and accessible.

## How to Use

### Via Extension (Recommended)

Simply use the `/valuation` prefix with the unicorn_hunter tool or method:

**Option 1: Direct tool call**
```
/valuation unicorn_hunter analyze langchain-ai/langchain
```

**Option 2: Via calculate_valuation with method**
```
/valuation calculate the valuation of langchain-ai/langchain using unicorn_hunter method
```

**Option 3: Natural language**
```
/valuation what's the unicorn score for langchain-ai/langchain?
```

### Via API

**Direct tool invocation:**
```powershell
$body = @{
    tool = "unicorn_hunter"
    arguments = @{
        repo_data = $repoData  # From analyze_github_repository
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Via calculate_valuation method:**
```powershell
$body = @{
    tool = "calculate_valuation"
    arguments = @{
        repo_data = $repoData
        method = "unicorn_hunter"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Expected Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"method\":\"unicorn_hunter\",\"unicorn_score\":75.5,\"status\":\"🚀 Soaring! ($500M+ potential)\",\"tier\":\"soaring\",\"component_scores\":{\"community_momentum\":82.3,\"development_velocity\":71.5,\"technology_quality\":78.0,\"market_potential\":68.2,\"network_effects\":73.1},\"speculative_valuation_ranges\":{\"conservative\":45000000.0,\"realistic\":89000000.0,\"optimistic\":175000000.0,\"maximum_cap\":1000000000,\"currency\":\"USD\"}}"
    }
  ]
}
```

## Unicorn Score Breakdown

### Scoring Factors (Total: 100 points)

1. **Community Momentum (25%)**: Stars, forks, watchers
2. **Development Velocity (20%)**: Contributors, commits, frequency
3. **Technology Quality (20%)**: Health, activity, overall scores
4. **Market Potential (20%)**: Growth indicators and adoption metrics
5. **Network Effects (15%)**: Fork adoption and community engagement

### Status Tiers

- 🦄 **90+**: Unicorn Alert ($1B+ potential)
- 🚀 **75-89**: Soaring ($500M+ potential)
- ⭐ **60-74**: Rising Star ($100M+ potential)
- 📈 **45-59**: Promising ($10M+ potential)
- 🌱 **30-44**: Early Stage ($1M+ potential)
- 💡 **<30**: Seed Stage ($100K+ potential)

## Example Queries

### High-Scoring Repository
```
/valuation unicorn_hunter analyze langchain-ai/langchain
```

**Expected:**
- Unicorn Score: 80-90+
- Status: "🚀 Soaring!" or "🦄 Unicorn Alert!"
- Valuation: Hundreds of millions

### Early Stage Project
```
/valuation what's the unicorn score for my-new-startup/repo?
```

**Expected:**
- Unicorn Score: 20-40
- Status: "🌱 Early Stage" or "💡 Seed Stage"
- Valuation: Thousands to low millions

### Compare Multiple Projects
```
/valuation compare unicorn scores for langchain-ai/langchain and microsoft/vscode
```

## Integration Status

✅ **Fully Integrated**
- Routing via `/valuation` prefix works
- Valuation MCP server supports `unicorn_hunter` tool
- Extension can call it directly
- No code changes needed in glazyr-control

## Technical Details

### Tool Name
- `unicorn_hunter` (standalone tool)
- `calculate_valuation` with `method: "unicorn_hunter"`

### Input Requirements
- Requires `repo_data` from `analyze_github_repository` tool
- Can be called directly if you have repository analysis data

### Response Format
- Returns JSON with unicorn score, status, tier, component scores, and valuation ranges
- Includes disclaimers about speculative nature
- Capped at $1B maximum valuation

## Testing

### Quick Test via Extension

1. Start glazyr-control server
2. Configure extension to point to it
3. Type in extension:
   ```
   /valuation analyze the langchain-ai/langchain repository and calculate its unicorn score
   ```

### Test via API

```powershell
# First analyze the repository
$analyzeBody = @{
    tool = "analyze_github_repository"
    arguments = @{
        owner = "langchain-ai"
        repo = "langchain"
    }
} | ConvertTo-Json -Depth 10

$analyzeResult = Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $analyzeBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

$analyzeJson = $analyzeResult | ConvertFrom-Json
$repoDataText = $analyzeJson.content[0].text
$repoData = $repoDataText | ConvertFrom-Json

# Then calculate unicorn score
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

Write-Host $unicornResult
```

## Benefits

1. **Engaging**: Gamified scoring makes valuation fun
2. **Accessible**: Clear status tiers help users understand potential
3. **Comprehensive**: 5-factor scoring provides holistic view
4. **Shareable**: Fun scores encourage social sharing
5. **Professional**: Includes disclaimers and realistic caps

## Notes

- All valuations are **speculative** and include disclaimers
- Maximum cap of $1B prevents unrealistic expectations
- Scores use logarithmic scaling for fair assessment
- Works with existing `/valuation` routing - no changes needed!
