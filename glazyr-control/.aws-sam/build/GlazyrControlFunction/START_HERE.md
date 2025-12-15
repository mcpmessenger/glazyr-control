# Quick Start - glazyr-control Server

## ✅ Virtual Environment is Ready!

The virtual environment has been created and dependencies installed.

## Start the Server

### Option 1: Using venv Python directly (Easiest)

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control

# Set environment variables
$env:OPENAI_API_KEY = "your-openai-key-here"

# Start server
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Option 2: Activate venv first

```powershell
cd C:\Users\senti\OneDrive\Desktop\glazyr\glazyr-control

# Activate venv
.\.venv\Scripts\Activate.ps1

# Set environment variables
$env:OPENAI_API_KEY = "your-openai-key-here"

# Start server
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

**Note:** If activation fails with execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Test It

Once the server is running, open another terminal and test:

```bash
# Health check
curl http://localhost:8000/healthz

# Prometheus metrics (should work automatically)
curl http://localhost:8000/metrics
```

## Environment Variables

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key

**Optional:**
- `GOOGLE_PLACES_API_KEY` - For Google Places tool (if using)
- `SENTRY_DSN` - For error tracking (if using Sentry)
- `SENTRY_ENABLED` - Set to "true" to enable Sentry
- `PROMETHEUS_ENABLED` - Default is "true" (metrics enabled)

## What's Working

✅ Virtual environment created  
✅ Dependencies installed (including Prometheus & Sentry)  
✅ Server ready to start  
✅ Prometheus metrics endpoint will be available at `/metrics`  
✅ Sentry ready (just add DSN to enable)
