#!/bin/bash
# =====================================================
# Piper TTS Local Development Setup
# =====================================================
# This script installs and runs Piper TTS with CORS
# enabled for web-based applications.
#
# Usage: bash setup-piper-local.sh
# Then access at: http://localhost:5002
# =====================================================

set -e

echo "=========================================="
echo "Piper TTS Local Setup"
echo "=========================================="

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux"* ]]; then
    OS="Linux"
else
    OS="Unknown"
fi

echo "Detected OS: $OS"
echo ""

# Step 1: Check Python
echo "[1/5] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✅ Python $PYTHON_VERSION found"
echo ""

# Step 2: Install Piper TTS
echo "[2/5] Installing Piper TTS..."
pip3 install --upgrade pip
pip3 install piper-tts

echo "✅ Piper TTS installed"
echo ""

# Step 3: Create CORS wrapper script
echo "[3/5] Creating CORS wrapper script..."
mkdir -p ~/.piper-tts

cat > ~/.piper-tts/piper-server-cors.py << 'EOF'
#!/usr/bin/env python3
"""
Piper TTS Server with CORS support for web applications.
This wraps the standard Piper server with Flask to add CORS headers.
"""

import json
import subprocess
import sys
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import os

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Piper server subprocess
piper_process = None

def start_piper_subprocess():
    """Start the piper-tts-server subprocess."""
    global piper_process
    try:
        piper_process = subprocess.Popen(
            [sys.executable, "-m", "piper.server"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print("✅ Piper server subprocess started")
    except Exception as e:
        print(f"❌ Failed to start Piper subprocess: {e}")
        raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "piper-cors-wrapper"}), 200

@app.route('/api/voices', methods=['GET'])
def get_voices():
    """List available Piper voices."""
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
            return jsonify({"voices": voices}), 200
        else:
            return jsonify({"error": result.stderr}), 500
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
        speaker = data.get('speaker', 'en_US/lessac_high')
        length_scale = float(data.get('lengthScale', 1.0))
        
        # Run Piper synthesis
        piper_cmd = [
            sys.executable, "-m", "piper",
            "--model", speaker,
            "--output-file", "-",
            "--length-scale", str(length_scale)
        ]
        
        result = subprocess.run(
            piper_cmd,
            input=text,
            capture_output=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return jsonify({"error": "Synthesis failed: " + result.stderr.decode()}), 500
        
        # Return audio data
        audio_io = io.BytesIO(result.stdout)
        audio_io.seek(0)
        
        return send_file(
            audio_io,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='output.wav'
        )
    
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Synthesis timeout"}), 504
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Piper TTS Server with CORS...")
    print("📡 Listening at http://0.0.0.0:5002")
    print("🌐 CORS enabled for all origins")
    print("")
    
    app.run(
        host='0.0.0.0',
        port=5002,
        debug=False,
        threaded=True
    )
EOF

chmod +x ~/.piper-tts/piper-server-cors.py
echo "✅ CORS wrapper created"
echo ""

# Step 4: Install Flask for CORS server (optional)
echo "[4/5] Installing Flask for CORS server (optional)..."
pip3 install Flask flask-cors

echo "✅ Flask dependencies installed"
echo ""

# Step 5: Summary
echo "[5/5] Setup complete!"
echo ""
echo "=========================================="
echo "✅ Piper TTS Ready!"
echo "=========================================="
echo ""
echo "To start Piper with CORS support, run:"
echo ""
echo "  python3 ~/.piper-tts/piper-server-cors.py"
echo ""
echo "Or run the standard Piper server (basic CORS):"
echo ""
echo "  piper-tts-server --host 0.0.0.0 --port 5002"
echo ""
echo "Then in your app, set:"
echo "  VITE_PIPER_API_URL=http://localhost:5002"
echo ""
echo "Test endpoint:"
echo "  curl http://localhost:5002/api/voices"
echo ""
echo "Available voices: lessac-high, amy-medium, ryan-high"
echo ""
