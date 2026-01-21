# Test Valuation MCP Server Directly
# This tests if the server's agent_executor is actually fixed

Write-Host "=== Testing Valuation MCP Server Directly ===" -ForegroundColor Cyan
Write-Host ""

$body = @{
    tool = "agent_executor"
    inputs = @{
        input = "what's the unicorn score for https://github.com/mcpmessenger/slashmcp?"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Sending request to Valuation MCP Server..."
Write-Host "Query: what's the unicorn score for https://github.com/mcpmessenger/slashmcp?"
Write-Host ""

try {
    $result = Invoke-WebRequest -Uri "https://valuation-mcp-server-554655392699.us-central1.run.app/mcp/invoke" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing | Select-Object -ExpandProperty Content
    
    $parsed = $result | ConvertFrom-Json
    
    Write-Host "=== Response Received ===" -ForegroundColor Green
    Write-Host ""
    
    if ($parsed.content -and $parsed.content.Count -gt 0 -and $parsed.content[0].text) {
        $responseText = $parsed.content[0].text
        Write-Host "Response Text:" -ForegroundColor Yellow
        Write-Host $responseText
        Write-Host ""
        
        # Check if it looks like a real unicorn score response
        if ($responseText -match "unicorn score|score:|Soaring|potential|status") {
            Write-Host "✅ Looks like a real response!" -ForegroundColor Green
        } elseif ($responseText -match "do not have|cannot access|no access|not available") {
            Write-Host "❌ Still showing 'no access' response - fix may not be deployed" -ForegroundColor Red
        } else {
            Write-Host "⚠️  Response received but format unclear" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Full Response:" -ForegroundColor Yellow
        Write-Host ($parsed | ConvertTo-Json -Depth 10)
    }
    
} catch {
    Write-Host "=== Error ===" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:"
        Write-Host $responseBody
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
