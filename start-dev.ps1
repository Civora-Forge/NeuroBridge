# Neurobridge Development Environment Startup Script (Windows PowerShell)
# Usage: .\start-dev.ps1

Write-Host "🧠 Starting Neurobridge Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists, if not create from example
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ .env file created. Please update GEMINI_API_KEY if needed." -ForegroundColor Green
    } else {
        Write-Host "✗ .env.example not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 1: Installing/Updating Dependencies..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm install failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Start Vite dev server in background
Write-Host "Step 2: Starting Vite Development Server (port 5173)..." -ForegroundColor Cyan
$viteProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru
Write-Host "✓ Vite server started (PID: $($viteProcess.Id))" -ForegroundColor Green
Write-Host ""

# Start Python backend
Write-Host "Step 3: Starting Flask Backend (port 5000)..." -ForegroundColor Cyan
Write-Host "Setting up Python environment..." -ForegroundColor Yellow

# Check Python
$pythonCmd = python --version 2>&1
if (-Not $?) {
    Write-Host "✗ Python not found! Please install Python 3.8+" -ForegroundColor Red
    Stop-Process -Id $viteProcess.Id
    exit 1
}

Write-Host "✓ Python found: $pythonCmd" -ForegroundColor Green

# Create venv if needed
if (-Not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate venv and install requirements
Write-Host "Activating virtual environment and installing packages..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"
pip install --quiet -r backend/requirements.txt

Write-Host "✓ Python packages installed" -ForegroundColor Green

# Start Flask server in background
$flaskProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python app.py" -PassThru
Write-Host "✓ Flask server started (PID: $($flaskProcess.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✓ Neurobridge is launching!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔌 Backend:   http://localhost:5000" -ForegroundColor Cyan
Write-Host "📊 Health:    http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vite process ID:  $($viteProcess.Id)" -ForegroundColor Gray
Write-Host "Flask process ID: $($flaskProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop both servers, close these windows or run:" -ForegroundColor Yellow
Write-Host "  Stop-Process -Id $($viteProcess.Id); Stop-Process -Id $($flaskProcess.Id)"
Write-Host ""
