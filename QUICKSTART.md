# Quick Start Guide 🚀

Get your Voice Trainer PWA up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

This will automatically run the setup script and download Pitchfinder.

## Step 2: Copy FormantAnalyzer Library

The formantanalyzer package is already installed via npm. Copy it to your public folder:

### On Windows (PowerShell):
```powershell
Copy-Item "node_modules\formantanalyzer\dist\formantanalyzer.min.js" "public\lib\"
```

### On Mac/Linux:
```bash
cp node_modules/formantanalyzer/dist/formantanalyzer.min.js public/lib/
```

## Step 3: Create Icons (Quick Method)

### Option A: Use SVG Icons (Already created!)
The setup script created SVG icons for you. Update `manifest.json`:

```json
"icons": [
  {
    "src": "/assets/icons/icon-192x192.svg",
    "sizes": "192x192",
    "type": "image/svg+xml"
  },
  {
    "src": "/assets/icons/icon-512x512.svg",
    "sizes": "512x512",
    "type": "image/svg+xml"
  }
]
```

### Option B: Convert to PNG
Use an online SVG to PNG converter like:
- https://cloudconvert.com/svg-to-png
- https://svgtopng.com/

Upload the SVG files from `public/assets/icons/` and download as PNG.

## Step 4: Run Locally

```bash
npm run dev
```

Visit: http://localhost:3000

🎉 **You're ready to go!**

## Step 5: Deploy to Vercel

### Quick Deploy:
```bash
npx vercel
```

Follow the prompts and your app will be live in seconds!

### Or use Vercel Dashboard:
1. Go to https://vercel.com
2. Click "New Project"
3. Import your Git repo
4. Click "Deploy"

---

## Troubleshooting

### Libraries not loading?
Check that files exist:
- `public/lib/pitchfinder.min.js`
- `public/lib/formantanalyzer.min.js`

### Microphone not working?
- Make sure you're on `localhost` or `https://`
- Allow microphone permissions when prompted

### Icons not showing?
- Use SVG icons (already created)
- Or convert to PNG and update `manifest.json`

---

## Next Steps

1. **Customize your target note** in Settings ⚙️
2. **Start with Section I** to practice pitch
3. **Practice daily** to build your streak! 🔥

Need help? Check the full [README.md](README.md) for detailed documentation.

---

Made with 💖 for your voice training journey
