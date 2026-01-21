# Continue Testing Valuation MCP Tools
# Run this after you've successfully tested analyze_github_repository

$baseUrl = "https://valuation-mcp-server-554655392699.us-central1.run.app"

# Step 1: Analyze repository (you already did this, but let's do it again to get fresh data)
Write-Host "`n=== Step 1: Analyze Repository ===" -ForegroundColor Cyan
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

$analyzeJson = $analyzeResult | ConvertFrom-Json
$repoDataText = $analyzeJson.content[0].text

# Parse the repo data (it's a JSON string inside the text)
$repoData = $repoDataText | ConvertFrom-Json

Write-Host "Repository Analysis Complete!" -ForegroundColor Green
Write-Host "Stars: $($repoData.metrics.stars)"
Write-Host "Overall Score: $($repoData.scores.overall_score)"

# Step 2: Calculate Valuation
Write-Host "`n=== Step 2: Calculate Valuation (Cost-Based) ===" -ForegroundColor Cyan
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

# Step 3: Compare with Market
Write-Host "`n=== Step 3: Compare with Market ===" -ForegroundColor Cyan
$compareBody = @{
    tool = "compare_with_market"
    arguments = @{
        repo_metrics = $repoData.metrics
        category = "langchain"
    }
} | ConvertTo-Json -Depth 10

$compareResult = Invoke-WebRequest -Uri "$baseUrl/mcp/invoke" `
    -Method POST `
    -ContentType "application/json" `
    -Body $compareBody `
    -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host $compareResult

Write-Host "`n=== All Tests Complete! ===" -ForegroundColor Green
