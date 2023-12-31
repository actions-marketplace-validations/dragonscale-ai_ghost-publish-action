/**
 *     Copyright [2023] [Dragonscale Industires Inc.]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { execSync } = require('child_process');
const { log } = require('console');
const { exit } = require('process');

/**
 * Main function for the action
 */
async function main() {
    const GhostAdminAPI = require('@tryghost/admin-api');
    const fs = require('fs');

    // Initialize the Ghost Admin API client
    const api = new GhostAdminAPI({
        url: process.env.INPUT_GHOST_API_URL,
        key: process.env.INPUT_GHOST_ADMIN_API_KEY,
        version: 'v5.0'
    });

    try {
        const latestMdFile = getLatestFile('.md');

        if (latestMdFile == null | latestMdFile == "") {
            console.log("No markdown in HEAD commit");
            process.exit(0);
        }

        let markdownContent = fs.readFileSync(latestMdFile, 'utf8');

        // Upload images and update Markdown content
        markdownContent = await uploadImagesAndReplaceUrls(api, markdownContent);

        const htmlContent = convertMarkdownToHTML(markdownContent); // Implement this function
        const jsonMetadataFile = latestMdFile.replace('.md', '.json');
        const metadata = JSON.parse(fs.readFileSync(jsonMetadataFile, 'utf8'));

        // Create a new post in Ghost
        const response = await api.posts.add({
            ...metadata,
            html: htmlContent,
            status: 'draft'
        }, {
            source: 'html'
        });

        console.log('Post created:', response.url);
    } catch (error) {
        console.error('Failed to create post:', error);
        process.exit(1);
    }
}

/**
 * Get the latest file with a specific extension from the last commit
 */
function getLatestFile(extension) {
    try {
        // Print the Git version
        console.log('Git Version:', execSync('git --version').toString().trim());

        // Print the current working directory
        console.log('Current working directory:', __dirname);

        // List the contents of the current directory
        console.log('Directory contents:', execSync('ls -la').toString());

        // Show git log
        console.log("Git log:\n", execSync('git log --oneline -n 5').toString());

        // Execute the Git command
        const command = `git diff-tree --no-commit-id --name-only HEAD -r | grep '${extension}$'`;
        console.log('Executing command:', command); // Debug log
        const latestFile = execSync(command).toString().trim();
        console.log('Found file:', latestFile); // Debug log
        return latestFile || null;
    } catch (error) {
        console.error('Error finding the latest file:', error);
        return null;
    }
}

/**
 * Convert Markdown content to HTML
 */
function convertMarkdownToHTML(markdown) {
    const MarkdownIt = require('markdown-it');
    const md = new MarkdownIt();
    return md.render(markdown);
}

/**
 * Upload images found in Markdown content to Ghost and replace local URLs
 */
async function uploadImagesAndReplaceUrls(api, markdownContent) {
    let updatedMarkdownContent = markdownContent;
    const imagePaths = extractImagePaths(markdownContent);

    for (let imagePath of imagePaths) {
        try {
            const uploadedImageUrl = await uploadImageToGhost(api, imagePath);
            updatedMarkdownContent = updatedMarkdownContent.replace(imagePath, uploadedImageUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            process.exit(1);
        }
    }

    return updatedMarkdownContent;
}

/**
 * Extract local image paths from Markdown content
 */
function extractImagePaths(markdownContent) {
    const regex = /!\[.*?\]\((.*?)\)/g;
    const paths = [];
    let match;

    while ((match = regex.exec(markdownContent)) !== null) {
        paths.push(match[1]);
    }

    return paths;
}

/**
 * Upload an image file to Ghost and return the uploaded image URL
 */
async function uploadImageToGhost(api, imagePath) {
    try {
        const uploadedImage = await api.images.upload({ file: imagePath });
        return uploadedImage.url;
    } catch (error) {
        console.error('Error uploading image to Ghost:', error);
        throw error;
    }
}

main();
