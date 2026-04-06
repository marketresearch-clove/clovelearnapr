# Piper TTS Local Development Setup for Windows
# This script installs and runs Piper TTS with CORS enabled

param(
    [switch]$SkipPiperInstall = $false,
    [switch]$StartServer = $false
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Piper TTS Local Setup (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Python
Write-Host "[1/5] Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    $pythonCmd = Get-Command python3.exe -ErrorAction SilentlyContinue
}

if (-not $pythonCmd) {
    Write-Host "❌ Python not found. Please install Python 3.8+ from https://www.python.org/" -ForegroundColor Red
    exit 1
}

$pythonVersion = & python --version 2>&1
Write-Host "✅ $pythonVersion found" -ForegroundColor Green
Write-Host ""

# Step 2: Install Piper
if (-not $SkipPiperInstall) {
    Write-Host "[2/5] Installing Piper TTS..." -ForegroundColor Yellow
    & python -m pip install --upgrade pip
    & python -m pip install piper-tts flask flask-cors
    Write-Host "✅ Piper TTS installed" -ForegroundColor Green
} else {
    Write-Host "[2/5] Skipping Piper installation" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Create wrapper script
Write-Host "[3/5] Creating CORS wrapper script..." -ForegroundColor Yellow

$piperDir = "$env:USERPROFILE\.piper-tts"
if (-not (Test-Path $piperDir)) {
    New-Item -ItemType Directory -Path $piperDir | Out-Null
}

$wrapperScript = @'
#!/usr/bin/env python3
"""
Piper TTS Server with CORS support for web applications.
Wraps piper-tts-server with Flask to add CORS headers.
"""

import json
import subprocess
import sys
from pathlib import Path

try:
    from flask import Flask, request, jsonify, send_file
    from flask_cors import CORS
except ImportError:
    print("Flask not installed. Installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "flask", "flask-cors"], check=True)
    from flask import Flask, request, jsonify, send_file
    from flask_cors import CORS

import io
import tempfile
import os

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type"]
    }
})

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "piper-cors-wrapper"}), 200

@app.route('/api/voices', methods=['GET', 'OPTIONS'])
def get_voices():
    """List available Piper voices."""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "piper", "--list-voices"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            voices = []
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    voices.append(line.strip())
            return jsonify({"voices": voices, "count": len(voices)}), 200
        else:
            return jsonify({"error": "Could not list voices", "details": result.stderr}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST', 'OPTIONS'])
def synthesize():
    """Synthesize text to speech."""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' parameter"}), 400
        
        text = data['text']
        speaker = data.get('speaker', 'en_US-lessac-high')  # Default voice
        length_scale = float(data.get('lengthScale', 1.0))
        
        if len(text) > 5000:
            return jsonify({"error": "Text too long (max 5000 chars)"}), 400
        
        # Create temp file for output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            # Run Piper synthesis
            piper_cmd = [
                sys.executable, "-m", "piper",
                "--model", speaker,
                "--output-file", tmp_path,
                "--length-scale", str(length_scale),
                "--quiet"
            ]
            
            result = subprocess.run(
                piper_cmd,
                input=text.encode('utf-8'),
                capture_output=True,
                timeout=30
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                return jsonify({"error": f"Synthesis failed: {error_msg}"}), 500
            
            # Read the audio file
            with open(tmp_path, 'rb') as f:
                audio_data = f.read()
            
            if not audio_data:
                return jsonify({"error": "No audio generated"}), 500
            
            # Return audio
            audio_io = io.BytesIO(audio_data)
            return send_file(
                audio_io,
                mimetype='audio/wav',
                as_attachment=False,
                download_name='output.wav'
            )
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except:
                    pass
    
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Synthesis timeout (>30s)"}), 504
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
            "trace": error_trace if app.debug else None
        }), 500

@app.route('/', methods=['GET'])
def index():
    """Info page."""
    return jsonify({
        "name": "Piper TTS CORS Server",
        "version": "1.0",
        "endpoints": {
            "health": "GET /health",
            "voices": "GET /api/voices",
            "synthesize": "POST /api/tts",
        },
        "example_request": {
            "text": "Hello, world!",
            "speaker": "en_US-lessac-high",
            "lengthScale": 0.9
        }
    }), 200

if __name__ == '__main__':
    debug_mode = os.environ.get('PIPER_DEBUG', 'false').lower() == 'true'
    
    print("\n" + "="*50)
    print("🎤 Piper TTS Server (CORS Enabled)")
    print("="*50)
    print(f"📡 Listening at http://0.0.0.0:5002")
    print(f"🌐 CORS: Enabled for all origins")
    print(f"🐛 Debug: {'ON' if debug_mode else 'OFF'}")
    print("\n📚 Endpoints:")
    print("  GET  /health       - Health check")
    print("  GET  /api/voices   - List voices")
    print("  POST /api/tts      - Synthesize audio")
    print("\n🎵 Example voice models:")
    print("  en_US-lessac-high  - Clear, professional (female)")
    print("  en_US-amy-medium   - Natural, balanced (female)")
    print("  en_US-ryan-high    - Authoritative (male)")
    print("\n💡 Set VITE_PIPER_API_URL=http://localhost:5002 in your app")
    print("="*50 + "\n")
    
    app.run(
        host='0.0.0.0',
        port=5002,
        debug=debug_mode,
        threaded=True,
        use_reloader=False
    )
'@

$wrapperPath = Join-Path $piperDir "piper-server-cors.py"
Set-Content -Path $wrapperPath -Value $wrapperScript -Encoding UTF8

Write-Host "✅ CORS wrapper created at: $wrapperPath" -ForegroundColor Green
Write-Host ""

# Step 4: Create convenience startup scripts
Write-Host "[4/5] Creating startup scripts..." -ForegroundColor Yellow

$startCorsScript = @"
@echo off
REM Start Piper TTS with CORS wrapper
echo.
echo Starting Piper TTS with CORS support...
echo.
python "$wrapperPath"
pause
"@

$startSimpleScript = @"
@echo off
REM Start simple Piper TTS server (basic CORS)
echo.
echo Starting Piper TTS Server (basic CORS)...
echo Listening at http://localhost:5002
echo.
python -m piper.server --host 0.0.0.0 --port 5002
pause
"@

$startCorsPath = Join-Path $piperDir "start-piper-cors.bat"
$startSimplePath = Join-Path $piperDir "start-piper-simple.bat"

Set-Content -Path $startCorsPath -Value $startCorsScript -Encoding ASCII
Set-Content -Path $startSimplePath -Value $startSimpleScript -Encoding ASCII

Write-Host "✅ Startup scripts created" -ForegroundColor Green
Write-Host ""

# Step 5: Summary and next steps
Write-Host "[5/5] Setup complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Piper TTS Ready!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📂 Install location: $piperDir" -ForegroundColor White
Write-Host ""

Write-Host "🚀 To start Piper:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Option 1 (With CORS wrapper - recommended):" -ForegroundColor White
Write-Host "    $startCorsPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Option 2 (Simple server):" -ForegroundColor White
Write-Host "    $startSimplePath" -ForegroundColor Green
Write-Host ""
Write-Host "  Option 3 (Direct command):" -ForegroundColor White
Write-Host "    python -m piper.server --host 0.0.0.0 --port 5002" -ForegroundColor Green
Write-Host ""

Write-Host "🔧 Configuration:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Set in .env or .env.local:" -ForegroundColor White
Write-Host "    VITE_PIPER_API_URL=http://localhost:5002" -ForegroundColor Green
Write-Host ""

Write-Host "🧪 Test your setup:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Start Piper (use one of the options above)" -ForegroundColor White
Write-Host "  2. Open http://localhost:5002/health in browser" -ForegroundColor Green
Write-Host "  3. Should see: {status: healthy}" -ForegroundColor Green
Write-Host ""

Write-Host "🎵 Available voices:" -ForegroundColor Cyan
Write-Host "  - en_US-lessac-high (female, professional)" -ForegroundColor White
Write-Host "  - en_US-amy-medium (female, natural)" -ForegroundColor White
Write-Host "  - en_US-ryan-high (male, authoritative)" -ForegroundColor White
Write-Host ""

Write-Host "📖 See FREE_UNLIMITED_TTS_GUIDE.md for full documentation" -ForegroundColor Yellow
Write-Host ""
