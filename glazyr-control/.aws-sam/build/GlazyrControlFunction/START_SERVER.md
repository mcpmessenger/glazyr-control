# How to Start glazyr-control Server

## Quick Setup (Windows PowerShell)

### 1. Create Virtual Environment (if not already created)

```powershell
cd glazyr-control
py -m venv .venv
```

### 2. Activate Virtual Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

**Note:** If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3. Install Dependencies

```powershell
python -m pip install -r requirements.txt
```

Or if `python` doesn't work:
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 4. Set Environment Variables

**Required:**
```powershell
$env:OPENAI_API_KEY = "your-openai-api-key"
```

**Optional (for Google Places):**
```powershell
$env:GOOGLE_PLACES_API_KEY = "your-google-places-key"
```

**Optional (for Sentry):**
```powershell
$env:SENTRY_DSN = "https://your-dsn@sentry.io/project-id"
$env:SENTRY_ENABLED = "true"
```

**Optional (for Prometheus - enabled by default):**
```powershell
$env:PROMETHEUS_ENABLED = "true"  # Default is true
```

### 5. Start the Server

```powershell
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Or if `python` doesn't work:
```powershell
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### 6. Test It

In another terminal:
```bash
curl http://localhost:8000/healthz
curl http://localhost:8000/metrics
```

## Alternative: Use py launcher directly

If activation doesn't work, you can use the venv Python directly:

```powershell
cd glazyr-control

# Install dependencies (first time only)
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Set environment variables
$env:OPENAI_API_KEY = "your-key"

# Start server
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Troubleshooting

### "python is not recognized"

Use `py` launcher or full path:
- `py -m pip install -r requirements.txt`
- `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`

### "Activate.ps1 cannot be loaded"

Run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Server won't start

1. Check if port 8000 is already in use
2. Make sure virtual environment is activated or use full path
3. Verify all dependencies installed: `pip list`

### Metrics endpoint not working

1. Prometheus is enabled by default
2. Check: `curl http://localhost:8000/metrics`
3. Should return Prometheus-format metrics
