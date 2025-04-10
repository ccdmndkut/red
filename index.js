// Use globals from script tags in index.html
// React, ReactDOM, and JSZip are loaded via script tags
// Components are also loaded via script tags

// Find the root element in your index.html
const rootElement = document.getElementById('root');

if (rootElement) {
    // Create a root
    const root = ReactDOM.createRoot(rootElement);

    // Render the main application component (defined in RedditScraper.js)
    root.render(
        <React.StrictMode>
            <RedditScraper />
        </React.StrictMode>
    );
} else {
    console.error("Fatal Error: Root element with ID 'root' not found in the DOM.");
    // Optionally display a message to the user on the page itself
    document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">Application failed to load: Root element not found.</div>';
}