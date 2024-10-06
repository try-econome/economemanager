const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();

// Set view engine to EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware to parse JSON request bodies
app.use(express.json());

// Cloud URL where all available extensions are listed
const extensionsUrl = 'https://raw.githubusercontent.com/try-econome/Cloud/refs/heads/main/extensions.json'; // Replace with your actual cloud URL

// Function to find the user's package.json
function findUserPackageJson() {
    // Assumes the user is running the app in their project directory
    return path.resolve(process.cwd(), 'package.json');
}

// Function to detect and load installed @econome extensions
function loadExtensions() {
    const nodeModulesDir = path.join(__dirname, 'node_modules');
    const userPackageJsonPath = findUserPackageJson();

    // Load the user's package.json
    const packageJson = require(userPackageJsonPath);

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

        // Load the user's package.json
        const userPackageJsonPath = findUserPackageJson();
        const packageJson = require(userPackageJsonPath);
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
app.get('/extensions/installed', async (req, res) => {
    const userPackageJsonPath = findUserPackageJson();
    const packageJson = require(userPackageJsonPath);
    const installedExtensions = Object.keys(packageJson.dependencies || {}).filter(dep => dep.startsWith('@econome/'));

    const extensionDetails = await Promise.all(installedExtensions.map(async (ext) => {
        const extensionPath = path.join(__dirname, 'node_modules', ext, 'package.json');
        let extensionPackage = {};

        // Check if the package.json exists and has a description
        if (fs.existsSync(extensionPath)) {
            extensionPackage = require(extensionPath);
        } else {
            // Fetch from the cloud if local package.json doesn't exist
            try {
                const availableExtensions = (await axios.get(extensionsUrl)).data;
                const matchedExtension = availableExtensions.find(e => e.name === ext);
                if (matchedExtension) {
                    extensionPackage.description = matchedExtension.description || 'No description available';
                }
            } catch (error) {
                console.error(`Error fetching extension details for ${ext}:`, error);
            }
        }

        return {
            name: ext,
            description: extensionPackage.description || 'No description available', // Default if no description is found
            url: `https://registry.npmjs.org/${encodeURIComponent(ext)}` // Construct URL for the npm registry
        };
    }));

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

// Load all extensions at the start
loadExtensions();

// Root route to serve the management page
app.get('/', (req, res) => {
    res.render('manage-extensions'); // Render the view
});

// Start the Express server
const PORT = 3500;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
