# Testing Valuation MCP Server Directly

Test the Valuation MCP server endpoints directly (without going through glazyr-control agent).

## Server URL

```
https://valuation-mcp-server-554655392699.us-central1.run.app
```

## Test 1: Check Health

```powershell
Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected response:
```json
{"status":"healthy","service":"valuation-mcp-server","version":"1.0.0"}
```

## Test 2: Get Manifest

```powershell
Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/manifest" -UseBasicParsing | Select-Object -ExpandProperty Content
```

This shows all available tools and their schemas.

## Test 3: Analyze GitHub Repository

```powershell
$body = @{
    tool = "analyze_github_repository"
    arguments = @{
        owner = "langchain-ai"
        repo = "langchain"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Test 4: Calculate Valuation

**Note:** This requires repo_data from analyze_github_repository first.

```powershell
# First, get repo data (use result from Test 3)
$repoData = @{
    # Paste the actual repo_data from analyze_github_repository result here
} | ConvertTo-Json -Depth 10

$body = @{
    tool = "calculate_valuation"
    arguments = @{
        repo_data = $repoData
        method = "cost_based"
        team_size = 5
        hourly_rate = 150.0
        development_months = 12
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Test 5: Compare with Market

**Note:** This requires repo_metrics from analyze_github_repository first.

```powershell
# First, get repo metrics (use result from Test 3)
$repoMetrics = @{
    # Paste the actual repo_metrics from analyze_github_repository result here
} | ConvertTo-Json -Depth 10

$body = @{
    tool = "compare_with_market"
    arguments = @{
        repo_metrics = $repoMetrics
        category = "mcp-server"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Complete Test Script

Here's a complete PowerShell script that tests all three tools in sequence:

```powershell
# Valuation MCP Server URL
$baseUrl = "https://valuation-mcp-server-554655392699.us-central1.run.app"

# Test 1: Health Check
Write-Host "`n=== Test 1: Health Check ===" -ForegroundColor Cyan
$health = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing | Select-Object -ExpandProperty Content
Write-Host $health

# Test 2: Get Manifest
Write-Host "`n=== Test 2: Get Manifest ===" -ForegroundColor Cyan
$manifest = Invoke-WebRequest -Uri "$baseUrl/mcp/manifest" -UseBasicParsing | Select-Object -ExpandProperty Content
Write-Host $manifest

# Test 3: Analyze Repository
Write-Host "`n=== Test 3: Analyze Repository ===" -ForegroundColor Cyan
$analyzeBody = @{
    tool = "analyze_github_repository"
    arguments = @{
        owner = "langchain-ai"
        repo = "langchain"
    }
} | ConvertTo-Json -Depth 10

$analyzeResult = Invoke-WebRequest -Uri "$baseUrl/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $analyzeBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host $analyzeResult

# Parse the result to extract repo_data for next tests
$analyzeJson = $analyzeResult | ConvertFrom-Json
$repoData = $analyzeJson.content[0].text | ConvertFrom-Json

# Test 4: Calculate Valuation
Write-Host "`n=== Test 4: Calculate Valuation ===" -ForegroundColor Cyan
$valuationBody = @{
    tool = "calculate_valuation"
    arguments = @{
        repo_data = $repoData
        method = "cost_based"
        team_size = 5
        hourly_rate = 150.0
        development_months = 12
    }
} | ConvertTo-Json -Depth 10

$valuationResult = Invoke-WebRequest -Uri "$baseUrl/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $valuationBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host $valuationResult

# Test 5: Compare with Market
Write-Host "`n=== Test 5: Compare with Market ===" -ForegroundColor Cyan
$compareBody = @{
    tool = "compare_with_market"
    arguments = @{
        repo_metrics = $repoData
        category = "mcp-server"
    }
} | ConvertTo-Json -Depth 10

$compareResult = Invoke-WebRequest -Uri "$baseUrl/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $compareBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host $compareResult

Write-Host "`n=== All Tests Complete ===" -ForegroundColor Green
```

## Expected Response Format

The MCP server returns responses in this format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "...analysis or result data..."
    }
  ]
}
```

## Troubleshooting

### Error: "Tool not found"
- Check the tool name matches exactly: `analyze_github_repository`, `calculate_valuation`, `compare_with_market`
- Verify the manifest to see available tools

### Error: "Missing required parameter"
- Check that all required parameters are included
- For `calculate_valuation`: requires `repo_data` and `method`
- For `compare_with_market`: requires `repo_metrics`

### Error: Connection timeout
- Check network connectivity
- Verify the server URL is correct
- The server may be processing (analysis can take time)

### Invalid JSON
- Make sure to use `ConvertTo-Json -Depth 10` for nested objects
- Check that PowerShell isn't escaping characters incorrectly

## Testing Different Repositories

Try different repositories:

```powershell
# Test with a different repo
$body = @{
    tool = "analyze_github_repository"
    arguments = @{
        owner = "microsoft"
        repo = "vscode"
    }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Testing Different Valuation Methods

```powershell
# Test different methods
$methods = @("cost_based", "market_based", "scorecard", "income_based")

foreach ($method in $methods) {
    Write-Host "`nTesting method: $method" -ForegroundColor Yellow
    
    $body = @{
        tool = "calculate_valuation"
        arguments = @{
            repo_data = $repoData  # From analyze_github_repository
            method = $method
        }
    } | ConvertTo-Json -Depth 10
    
    $result = Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing | Select-Object -ExpandProperty Content
    
    Write-Host $result
}
```
