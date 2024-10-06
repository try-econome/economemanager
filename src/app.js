const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();

// Set view engine to EJS
app.set('view engine', 'ejs');

// Middleware to parse JSON request bodies
app.use(express.json());

// Cloud URL where all available extensions are listed
const extensionsUrl = 'https://raw.githubusercontent.com/try-econome/Cloud/refs/heads/main/extensions.json'; // Replace with your actual cloud URL

// Function to detect and load installed @econome extensions
function loadExtensions() {
    const nodeModulesDir = path.join(__dirname, 'node_modules');
    const packageJson = require('../package.json');

    // Get list of installed dependencies starting with @econome/
    const installedExtensions = Object.keys(packageJson.dependencies || {}).filter(dep => dep.startsWith('@econome/'));

    installedExtensions.forEach(extensionName => {
        const extensionPath = path.join(nodeModulesDir, extensionName, 'package.json');
        if (fs.existsSync(extensionPath)) {
            const extPackage = require(extensionPath);
            if (extPackage["express-extension"]) {
                console.log(`Loading extension: ${extensionName}`);
                const extension = require(extensionName);
                app.use(`/${extensionName.split('/')[1]}`, extension.router); // Mount the extension's router
            }
        }
    });
}

// Serve static files for the management page (CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Fetch available extensions from the cloud URL, excluding installed ones
app.get('/extensions/available', async (req, res) => {
    try {
        const response = await axios.get(extensionsUrl);
        const availableExtensions = response.data;

        // Get installed extensions from package.json
        const packageJson = require('../package.json');
        const installedExtensions = Object.keys(packageJson.dependencies || {}).filter(dep => dep.startsWith('@econome/'));

        // Filter out already installed extensions
        const filteredExtensions = availableExtensions.filter(ext => !installedExtensions.includes(ext.name));

        res.json(filteredExtensions);
    } catch (error) {
        console.error('Error fetching available extensions:', error);
        res.status(500).send('Error fetching available extensions');
    }
});

// Fetch installed extensions and render them with details
app.get('/extensions/installed', (req, res) => {
    const packageJson = require('../package.json');
    const installedExtensions = Object.keys(packageJson.dependencies || {}).filter(dep => dep.startsWith('@econome/'));

    const extensionDetails = installedExtensions.map((ext) => {
        const extensionPath = path.join(__dirname, 'node_modules', ext, 'package.json');
        const extensionPackage = fs.existsSync(extensionPath) ? require(extensionPath) : { description: 'No description available' };
        return {
            name: ext,
            description: extensionPackage.description || 'No description available',
        };
    });

    res.json(extensionDetails);
});


// Install an extension
app.post('/extensions/install', (req, res) => {
    const extensionName = req.body.extension; // e.g., "@econome/extension1"
    exec(`npm install ${extensionName}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error installing ${extensionName}:`, stderr);
            res.status(500).send(`Error installing ${extensionName}: ${stderr}`);
            return;
        }
        console.log(`Successfully installed ${extensionName}`);
        res.send(`Successfully installed ${extensionName}`);
    });
});

// Uninstall an extension
app.post('/extensions/uninstall', (req, res) => {
    const extensionName = req.body.extension; // e.g., "@econome/extension1"
    exec(`npm uninstall ${extensionName}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error uninstalling ${extensionName}:`, stderr);
            res.status(500).send(`Error uninstalling ${extensionName}: ${stderr}`);
            return;
        }
        console.log(`Successfully uninstalled ${extensionName}`);
        res.send(`Successfully uninstalled ${extensionName}`);
    });
});

// Function to detect and load installed @econome extensions
function loadExtensions() {
    const nodeModulesDir = path.join(__dirname, 'node_modules');
    const packageJson = require('../package.json');

    // Get list of installed dependencies starting with @econome/
    const installedExtensions = Object.keys(packageJson.dependencies || {}).filter(dep => dep.startsWith('@econome/'));

    installedExtensions.forEach(extensionName => {
        const extensionPath = path.join(nodeModulesDir, extensionName, 'package.json');
        if (fs.existsSync(extensionPath)) {
            const extPackage = require(extensionPath);
            if (extPackage["express-extension"]) {
                console.log(`Loading extension: ${extensionName}`);
                const extension = require(extensionName);
                app.use(`/${extensionName.split('/')[1]}`, extension.router); // Mount the extension's router
            }
        }
    });
}


// Root route to serve the management page
app.get('/', (req, res) => {
    res.render('manage-extensions'); // Use EJS template for rendering
});

// Start the Express server
const PORT = 3500;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
