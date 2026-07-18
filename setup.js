/**
 * Setup script to download required libraries and create placeholder icons
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🎤 Voice Trainer PWA - Setup Script\n');

// Create directories if they don't exist
const libDir = path.join(__dirname, 'public', 'lib');
const iconsDir = path.join(__dirname, 'public', 'assets', 'icons');

if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Function to download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${path.basename(dest)}`);

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      console.error(`❌ Error downloading ${path.basename(dest)}:`, err.message);
      reject(err);
    });
  });
}

// Function to create simple colored SVG icon
function createSVGIcon(size, color, dest) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="white" opacity="0.9"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size/4}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">🎤</text>
</svg>`;

  fs.writeFileSync(dest, svg);
  console.log(`✅ Created: ${path.basename(dest)}`);
}

async function setup() {
  try {
    // Download Pitchfinder
    console.log('\n📦 Step 1: Downloading Pitchfinder...');
    try {
      await downloadFile(
        'https://unpkg.com/pitchfinder@2.3.0/dist/pitchfinder.umd.js',
        path.join(libDir, 'pitchfinder.min.js')
      );
    } catch (err) {
      console.log('⚠️  Could not download Pitchfinder automatically.');
      console.log('   Please download manually from: https://github.com/peterkhayes/pitchfinder');
      console.log('   Or use CDN in index.html: https://unpkg.com/pitchfinder@2.3.0/dist/pitchfinder.umd.js\n');
    }

    // Note about FormantAnalyzer
    console.log('\n📦 Step 2: FormantAnalyzer setup...');
    console.log('ℹ️  FormantAnalyzer needs to be installed via npm:');
    console.log('   Run: npm install formantanalyzer');
    console.log('   Then manually copy from node_modules to public/lib/');
    console.log('   Or check: https://github.com/tabahi/formantanalyzer.js\n');

    // Create placeholder icons
    console.log('\n🎨 Step 3: Creating placeholder icons...');
    createSVGIcon(192, '#e94560', path.join(iconsDir, 'icon-192x192.svg'));
    createSVGIcon(512, '#e94560', path.join(iconsDir, 'icon-512x512.svg'));

    console.log('\n⚠️  Note: SVG icons created. For PNG icons:');
    console.log('   1. Convert SVGs to PNGs using an online tool');
    console.log('   2. Or create custom icons at https://www.pwabuilder.com/');
    console.log('   3. Save as icon-192x192.png and icon-512x512.png\n');

    console.log('✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Install npm dependencies: npm install');
    console.log('2. Set up FormantAnalyzer library (see instructions above)');
    console.log('3. Convert SVG icons to PNG (see instructions above)');
    console.log('4. Run dev server: npm run dev');
    console.log('5. Deploy to Vercel: vercel\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setup();
