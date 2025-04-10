const { useState, useCallback, useEffect, useMemo, useRef } = React; // Add useRef here
// --- Media Viewer Modal (enhanced) ---
function MediaViewerModal({ mediaUrl, mediaType, onClose }) {
    if (!mediaUrl) return null;
    const isImage = mediaType === 'image';
    const isVideo = mediaType === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.includes('v.redd.it');

    useEffect(() => {
        const handleEsc = (event) => { if (event.keyCode === 27) onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content media-viewer-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">×</button>
                {isImage && <img src={mediaUrl} alt="Media Content" />}
                {isVideo && <video src={mediaUrl} controls autoPlay loop playsInline muted={mediaUrl.includes('v.redd.it')} style={{ outline: 'none' }}>Video not supported.</video>}
                {!isImage && !isVideo && (
                    <div style={{ padding: '20px', color: 'var(--text-primary)' }}>
                        <p>Cannot display this media type directly.</p>
                        <a href={mediaUrl} target="_blank" rel="noopener noreferrer">Open link in new tab</a>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- NEW: Gallery Modal Component ---
function GalleryModal({ galleryUrls, initialIndex = 0, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') handleNext();
            else if (e.key === 'ArrowLeft') handlePrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, onClose]); // Add galleryUrls.length to dependencies if it can change while modal is open

    const handleNext = useCallback(() => {
        setCurrentIndex(prevIndex =>
            prevIndex === galleryUrls.length - 1 ? 0 : prevIndex + 1
        );
    }, [galleryUrls.length]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prevIndex =>
            prevIndex === 0 ? galleryUrls.length - 1 : prevIndex - 1
        );
    }, [galleryUrls.length]);

    const currentMedia = galleryUrls[currentIndex];
    const isVideo = currentMedia?.url?.endsWith('.mp4') ||
        currentMedia?.url?.includes('v.redd.it');

    if (!galleryUrls || galleryUrls.length === 0) return null;

    return (
        <div className="modal instagram-modal" onClick={onClose}>
            <div className="modal-content instagram-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Custom close button for Instagram modal */}
                <button className="modal-close-btn" onClick={onClose} title="Close (Esc)" style={{ zIndex: 10 /* Ensure it's above content */ }}>×</button>

                {/* Instagram-style header */}
                <div className="instagram-header">
                    <div className="instagram-avatar"></div>
                    <div className="instagram-username">Reddit Post</div> {/* Placeholder */}
                </div>

                <div className="instagram-viewer">
                    <div className="instagram-main-image">
                        {isVideo ? (
                            <video
                                key={currentMedia.url} // Key change forces re-render on source change
                                src={currentMedia.url}
                                controls
                                autoPlay
                                loop
                                playsInline
                                muted={currentMedia.url.includes('v.redd.it')}
                                style={{ outline: 'none' }}
                            >
                                Video not supported.
                            </video>
                        ) : (
                            <img src={currentMedia.url} alt={`Gallery item ${currentIndex + 1}`} />
                        )}

                        {/* Navigation arrows */}
                        {galleryUrls.length > 1 && (
                            <>
                                <button className="instagram-nav-button prev" onClick={(e) => { e.stopPropagation(); handlePrev(); }} title="Previous (Left arrow)">
                                    ‹
                                </button>
                                <button className="instagram-nav-button next" onClick={(e) => { e.stopPropagation(); handleNext(); }} title="Next (Right arrow)">
                                    ›
                                </button>
                            </>
                        )}
                    </div>

                    {/* Instagram-style navigation dots */}
                    {galleryUrls.length > 1 && (
                        <div className="instagram-dots">
                            {galleryUrls.map((_, index) => (
                                <div
                                    key={index}
                                    className={`instagram-dot ${index === currentIndex ? 'active' : ''}`}
                                    onClick={() => setCurrentIndex(index)}
                                ></div>
                            ))}
                        </div>
                    )}

                    {/* Instagram-style action bar (Placeholder actions) */}
                    <div className="instagram-actions">
                        <div className="instagram-like" title="Like">♥</div>
                        <div className="instagram-comment" title="Comment">💬</div>
                        <div className="instagram-share" title="Share">📤</div>
                        <div className="instagram-save" title="Save">🔖</div>
                    </div>
                </div>
            </div>
        </div>
    );
}


// --- New Resizable Media Grid Component ---
function MediaGrid({ posts, onOpenMedia, gridSize = 160, getMediaInfo }) {
    const [explodedPostId, setExplodedPostId] = useState(null); // ID of post that is "exploded"

    // Get all media posts using useMemo for optimization
    const mediaPosts = useMemo(() => {
        console.log("Recalculating media posts for grid"); // Debugging memoization
        return posts.filter(post => {
            const mediaInfo = getMediaInfo(post);
            // Filter only posts that *have* media info and items
            return mediaInfo?.items && mediaInfo.items.length > 0;
        });
    }, [posts, getMediaInfo]); // Dependencies: recalculate if posts or getMediaInfo changes

    // Handle click on a post with multiple images to toggle exploded view
    const handleExplodeToggle = (postId, e) => {
        e.stopPropagation(); // Prevent click from propagating to parent elements
        setExplodedPostId(currentExplodedId =>
            currentExplodedId === postId ? null : postId // Toggle: if same, close; otherwise, open
        );
    };

    // Close exploded view when clicking anywhere else on the page
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click is outside any 'exploded-grid' or 'multi-image-indicator'
            if (!event.target.closest('.exploded-grid') && !event.target.closest('.multi-image-indicator')) {
                if (explodedPostId !== null) {
                    console.log("Clicked outside, closing exploded grid:", explodedPostId);
                    setExplodedPostId(null);
                }
            }
        };

        if (explodedPostId) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside); // Add touch support
        }

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [explodedPostId]); // Only re-run this effect if explodedPostId changes

    if (mediaPosts.length === 0) {
        return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>No media found matching the current filters.</p>;
    }

    return (
        // Main grid container
        <div className="media-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))` }}>
            {mediaPosts.map(post => {
                const mediaInfo = getMediaInfo(post);
                // Ensure mediaInfo and items exist before trying to access them
                if (!mediaInfo || !mediaInfo.items || mediaInfo.items.length === 0) {
                    return null; // Skip rendering if no valid media items
                }
                const hasMultipleItems = mediaInfo.items.length > 1;
                const previewItem = mediaInfo.items[0]; // Get the first item for preview
                const isCurrentlyExploded = explodedPostId === post.id;

                return (
                    // Container for each grid item + its potential exploded view
                    <div key={post.id} className="media-grid-item-container" style={{ position: 'relative' /* Needed for absolute positioning of exploded grid */ }}>
                        {/* The main clickable media card */}
                        <div
                            className="media-item-card"
                            onClick={() => !hasMultipleItems && onOpenMedia(mediaInfo, 0)} // Open modal directly if only one item
                            title={post.title}
                        >
                            {/* Display video or image */}
                            {previewItem.type === 'video' ? (
                                <video src={previewItem.url} muted loop playsInline onClick={() => onOpenMedia(mediaInfo, 0)} />
                            ) : (
                                <img src={previewItem.url} alt={post.title} loading="lazy" onClick={() => onOpenMedia(mediaInfo, 0)} />
                            )}

                            {/* Media type indicator (Video/Image) */}
                            <div className="media-item-type">
                                {capitalize(previewItem.type)}
                            </div>

                            {/* Indicator for multiple items, clickable to explode */}
                            {hasMultipleItems && (
                                <div
                                    className="multi-image-indicator"
                                    onClick={(e) => handleExplodeToggle(post.id, e)}
                                    title={`View ${mediaInfo.items.length} items`}
                                >
                                    {/* Use an icon or just the count */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '4px' }}>
                                        <path d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 13 1.5H3zM1.5 2a.5.5 0 0 1 .5-.5H3a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm13 .5a.5.5 0 0 1-.5.5H13a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5zM2 13.5a.5.5 0 0 1-.5.5V13a.5.5 0 0 1 .5.5zm11.5-.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5-.5z" />
                                        <path d="M12.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h9z" />
                                    </svg>
                                    {mediaInfo.items.length}
                                </div>
                            )}

                            {/* Info overlay showing post title on hover */}
                            <div className="media-item-info">
                                <span>{post.title.length > 40 ? post.title.substring(0, 37) + '...' : post.title}</span>
                            </div>
                        </div>

                        {/* Exploded view: Rendered conditionally below the card */}
                        {isCurrentlyExploded && hasMultipleItems && (
                            <div className="exploded-grid" onClick={e => e.stopPropagation()}>
                                {mediaInfo.items.map((item, index) => (
                                    <div
                                        key={item.id || index} // Use item ID if available, otherwise index
                                        className="exploded-item"
                                        onClick={() => onOpenMedia(mediaInfo, index)}
                                        title={`View item ${index + 1}`}
                                    >
                                        {/* Display video or image for each item in the exploded grid */}
                                        {item.type === 'video' ? (
                                            <video src={item.url} muted loop playsInline />
                                        ) : (
                                            <img src={item.url} alt={`${post.title} ${index + 1}`} loading="lazy" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div> // End media-grid-item-container
                );
            })}
        </div> // End media-grid
    );
}


// --- Reddit Scraper Component ---
function RedditScraper() {
    // --- State ---
    const [subreddit, setSubreddit] = useState('');
    const [posts, setPosts] = useState([]); // Stores ALL fetched posts
    const [isLoading, setIsLoading] = useState(false);
    const [isCommentsLoading, setIsCommentsLoading] = useState(false); // Separate state for batch comment loading
    const [isMediaDownloading, setIsMediaDownloading] = useState(false); // State for media download
    const [error, setError] = useState('');
    const [showAuthModal, setShowAuthModal] = useState(false);
    // Load credentials from localStorage or use defaults
    const [credentials, setCredentials] = useState(() => {
        const savedCreds = localStorage.getItem('redditApiCredentials');
        return savedCreds ? JSON.parse(savedCreds) : { clientId: '', clientSecret: '' };
    });
    const [limit, setLimit] = useState(25); // Default post limit
    const [sort, setSort] = useState('hot');
    const [topTimeFrame, setTopTimeFrame] = useState('day'); // Default time frame for 'top' sort

    // Media Modal State (individual viewer) - Keep for non-gallery media? Or remove if gallery handles all? Let's keep for now.
    // const [showMediaModal, setShowMediaModal] = useState(false);
    // const [mediaUrl, setMediaUrl] = useState(null);
    // const [mediaType, setMediaType] = useState(null);

    // Gallery State
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [galleryUrls, setGalleryUrls] = useState([]); // Should be array of {url, type, id} objects
    const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);

    // Media Grid State
    const [gridSize, setGridSize] = useState(160); // State for resizable grid

    // Media Filter State
    const [mediaFilter, setMediaFilter] = useState('all'); // 'all', 'image', 'video'
    const [selectedPosts, setSelectedPosts] = useState(new Set()); // Set of selected post IDs
    const [commentLimit, setCommentLimit] = useState(50); // Default comment fetch limit

    // Search Feature State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchScope, setSearchScope] = useState('subreddit'); // 'subreddit', 'multiple', or 'all'
    const [multipleSubreddits, setMultipleSubreddits] = useState(''); // For multiple subreddit search
    const [searchSort, setSearchSort] = useState('relevance'); // Default sort for search results
    const [searchTimeLimit, setSearchTimeLimit] = useState('all'); // 'hour', 'day', 'week', 'month', 'year', 'all'

    // --- Save credentials to localStorage whenever they change ---
    useEffect(() => {
        localStorage.setItem('redditApiCredentials', JSON.stringify(credentials));
    }, [credentials]);

    // --- Access Token Logic (Using useRef to persist token between renders) ---
    const accessTokenRef = useRef(null);
    const tokenExpiryRef = useRef(0);

    const getAccessToken = useCallback(async () => {
        if (accessTokenRef.current && Date.now() < tokenExpiryRef.current) {
            return accessTokenRef.current;
        }

        const { clientId, clientSecret } = credentials;
        if (!clientId || !clientSecret) {
            throw new Error("Client ID and Secret are required.");
        }

        console.log('Fetching new Reddit access token...');
        const authString = `${clientId}:${clientSecret}`;
        // Use try-catch for btoa in case of unexpected input
        let base64Auth;
        try {
            base64Auth = btoa(authString);
        } catch (e) {
            throw new Error("Invalid Client ID or Secret format.");
        }

        try {
            const response = await fetch('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${base64Auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'RedditScraperAdvanced/2.1 by YourUsername', // Optional: Customize User-Agent
                },
                body: 'grant_type=client_credentials',
            });

            if (!response.ok) {
                let errorMsg = 'Failed to get access token.';
                try {
                    const errorData = await response.json();
                    errorMsg = `(${response.status}) ${errorData.error_description || errorData.message || errorData.error || 'Check Credentials'}`;
                } catch (jsonError) {
                    errorMsg = `(${response.status}) ${response.statusText || 'Check Credentials'}`;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            accessTokenRef.current = data.access_token;
            // Set expiry slightly earlier (e.g., 5 minutes buffer)
            tokenExpiryRef.current = Date.now() + (data.expires_in - 300) * 1000;
            console.log('Access token obtained successfully.');
            return accessTokenRef.current;
        } catch (err) {
            console.error('Access token error:', err);
            setError(`Access Token Error: ${err.message}`);
            accessTokenRef.current = null;
            tokenExpiryRef.current = 0;
            setShowAuthModal(true); // Prompt user to check credentials
            throw err; // Re-throw to stop the calling function (fetchPosts/searchReddit)
        }
    }, [credentials]); // Re-run only if credentials change

    // --- Utility Function: Capitalize ---
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';


    // --- Fetch Posts Logic ---
    const fetchPosts = async () => {
        const sub = subreddit.trim();
        if (!sub) { setError('Please enter a subreddit name.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 1 || numericLimit > 100) { setError('Post limit must be between 1 and 100.'); return; }

        setIsLoading(true); setError(''); setPosts([]); setSelectedPosts(new Set()); // Clear posts and selection
        // Clear search query when fetching normally
        setSearchQuery('');
        setSearchScope('subreddit'); // Reset search scope if needed

        console.log(`Fetching posts from r/${sub}, Sort: ${sort}, Limit: ${numericLimit}, Timeframe (if top): ${topTimeFrame}`);

        try {
            const accessToken = await getAccessToken();
            let apiUrl;
            const baseRedditUrl = 'https://oauth.reddit.com'; // Use HTTPS OAuth endpoint

            if (sort === 'top') {
                apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${numericLimit}&t=${topTimeFrame}&raw_json=1`;
            } else {
                // Handles hot, new, controversial, rising, relevance (relevance often needs search endpoint but let's try this first)
                apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${numericLimit}&raw_json=1`;
                // Note: 'relevance' might not work as expected with standard listing endpoints.
                // The Search endpoint is typically used for relevance sorting.
                // Consider adjusting if 'relevance' sort doesn't behave as desired.
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'RedditScraperAdvanced/2.1 by YourUsername', // Consistent User-Agent
                }
            });

            if (!response.ok) {
                let errorMsg = `API Error (${response.status})`;
                try {
                    const errorData = await response.json();
                    console.error('Reddit API Error (Posts):', errorData);
                    if (response.status === 404) errorMsg = `Subreddit 'r/${sub}' not found or private.`;
                    else if (response.status === 403) errorMsg = `Access denied to 'r/${sub}' (might be private or quarantined).`;
                    else errorMsg = `(${response.status}): ${errorData.message || 'API error fetching posts'}`;
                } catch (jsonError) {
                    errorMsg = `(${response.status}) ${response.statusText || 'Failed to fetch posts'}`;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (!data?.data?.children) {
                console.error('Unexpected API response structure:', data);
                throw new Error('Unexpected API response structure from Reddit.');
            }

            // Process posts: Add default states needed by the UI
            const initialPosts = data.data.children.map(child => ({
                ...child.data,
                isExpanded: false,      // For long text expansion
                comments: [],           // Store fetched comments here
                commentsLoading: false, // State for loading comments for *this* post
                showComments: false,    // State for toggling comment visibility
                commentsError: null     // Store comment loading errors for *this* post
            }));

            setPosts(initialPosts);
            console.log(`Fetched ${initialPosts.length} posts.`);

        } catch (err) {
            console.error("Fetch posts error:", err);
            // Avoid overwriting specific errors from getAccessToken
            if (!error) setError(`Fetch failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Search Reddit Logic ---
    const searchReddit = async () => {
        const query = searchQuery.trim();
        if (!query) { setError('Please enter a search query.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 1 || numericLimit > 100) { setError('Result limit must be between 1 and 100.'); return; }

        let targetSubreddits = '';
        if (searchScope === 'subreddit') {
            targetSubreddits = subreddit.trim();
            if (!targetSubreddits) { setError('Please enter a subreddit name to search within.'); return; }
        } else if (searchScope === 'multiple') {
            targetSubreddits = multipleSubreddits.trim().split(',').map(s => s.trim()).filter(s => s).join('+');
            if (!targetSubreddits) { setError('Please enter at least one subreddit name for multiple search.'); return; }
        } // 'all' scope doesn't need targetSubreddits defined here

        setIsLoading(true); setError(''); setPosts([]); setSelectedPosts(new Set()); // Clear posts and selection
        // Clear regular subreddit input when searching 'all' or 'multiple'
        if (searchScope !== 'subreddit') {
            // setSubreddit(''); // Optional: Decide if you want to clear the main subreddit input
        }

        console.log(`Searching Reddit. Scope: ${searchScope}, Query: "${query}", Sort: ${searchSort}, Limit: ${numericLimit}, Time: ${searchTimeLimit}`);

        try {
            const accessToken = await getAccessToken();
            const baseRedditUrl = 'https://oauth.reddit.com';
            const timeParam = searchTimeLimit !== 'all' ? `&t=${searchTimeLimit}` : '';
            let apiUrl;

            if (searchScope === 'subreddit') {
                apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${numericLimit}&sort=${searchSort}${timeParam}&raw_json=1`;
            } else if (searchScope === 'multiple') {
                apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?q=${encodeURIComponent(query)}&limit=${numericLimit}&sort=${searchSort}${timeParam}&raw_json=1`; // No restrict_sr=1
            } else { // searchScope === 'all'
                apiUrl = `${baseRedditUrl}/search?q=${encodeURIComponent(query)}&limit=${numericLimit}&sort=${searchSort}${timeParam}&raw_json=1`;
            }

            console.log("Search API URL:", apiUrl); // Debugging

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'RedditScraperAdvanced/2.1 by YourUsername',
                }
            });

            if (!response.ok) {
                let errorMsg = `Search API Error (${response.status})`;
                try {
                    const errorData = await response.json();
                    console.error('Reddit API Error (Search):', errorData);
                    if (response.status === 404 && (searchScope === 'subreddit' || searchScope === 'multiple')) errorMsg = `One or more specified subreddits not found or private.`;
                    else if (response.status === 403) errorMsg = `Access denied to search endpoint or specified subreddits.`;
                    else errorMsg = `(${response.status}): ${errorData.message || 'API error during search'}`;
                } catch (jsonError) {
                    errorMsg = `(${response.status}) ${response.statusText || 'Failed to perform search'}`;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (!data?.data?.children) {
                console.error('Unexpected API response structure for search:', data);
                throw new Error('Unexpected API response structure from Reddit search.');
            }

            // Process search results (same structure as regular posts)
            const searchResults = data.data.children.map(child => ({
                ...child.data,
                isExpanded: false,
                comments: [],
                commentsLoading: false,
                showComments: false,
                commentsError: null
            }));

            setPosts(searchResults);
            console.log(`Found ${searchResults.length} search results.`);

            // Maybe update the main subreddit display if searching all?
            // If searching 'all', the concept of a 'current subreddit' is less relevant
            if (searchScope === 'all') {
                setSubreddit(''); // Clear the main subreddit display? Or show 'All'?
            }


        } catch (err) {
            console.error("Search error:", err);
            // Avoid overwriting specific errors from getAccessToken
            if (!error) setError(`Search failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Enhanced Get Media Info Helper (Memoized) ---
    const getMediaInfo = useCallback((post) => {
        if (!post) return null;

        try {
            // 1. Handle Reddit Galleries (Most specific)
            if (post.is_gallery && post.gallery_data && post.media_metadata) {
                const galleryItems = Object.values(post.media_metadata)
                    .map(metadata => {
                        if (!metadata || metadata.status !== 'valid') return null;

                        // Find the best quality URL (prefer non-preview if available)
                        let bestUrl = '';
                        let type = 'image'; // Default type

                        if (metadata.s) { // Source object (often highest quality)
                            if (metadata.s.mp4) { bestUrl = metadata.s.mp4; type = 'video'; }
                            else if (metadata.s.gif) { bestUrl = metadata.s.gif; type = 'image'; } // Treat gifs as images for simplicity here
                            else if (metadata.s.u) { bestUrl = metadata.s.u; type = 'image'; }
                        }

                        // Fallback to previews if source isn't available or suitable
                        if (!bestUrl && metadata.p && metadata.p.length > 0) {
                            // Get highest resolution preview URL
                            bestUrl = metadata.p[metadata.p.length - 1].u;
                            type = 'image'; // Previews are usually images
                        }

                        // Fallback to thumbnail if nothing else works (low quality)
                        if (!bestUrl && metadata.t) { // Thumbnail URL (might exist if others don't)
                            bestUrl = metadata.t;
                            type = 'image';
                        }


                        if (!bestUrl) return null; // Skip if no URL found

                        // Clean URL (replace &amp;)
                        const cleanedUrl = bestUrl.replace(/&amp;/g, '&');

                        // Extract ID from metadata key if possible, otherwise use URL as key
                        const id = metadata.id || cleanedUrl;

                        // Get a thumbnail (prefer smallest preview, fallback to URL itself)
                        const thumbnailUrl = (metadata.p && metadata.p.length > 0)
                            ? metadata.p[0].u.replace(/&amp;/g, '&')
                            : (metadata.t ? metadata.t.replace(/&amp;/g, '&') : cleanedUrl);


                        return { id: id, url: cleanedUrl, thumbnail: thumbnailUrl, type: type };
                    })
                    .filter(item => item !== null); // Remove any null entries

                if (galleryItems.length > 0) {
                    return {
                        url: post.url, // Gallery link itself
                        type: 'gallery',
                        items: galleryItems
                    };
                }
                // If gallery parsing failed but it *is* a gallery, return minimal info
                return { url: post.url, type: 'gallery', items: [] };
            }

            // 2. Handle Videos (Hosted, Rich, or direct links)
            let videoUrl = null;
            let videoThumbnail = post.thumbnail && post.thumbnail !== 'default' && post.thumbnail !== 'self' ? post.thumbnail.replace(/&amp;/g, '&') : null;

            if (post.is_video && post.media?.reddit_video) {
                videoUrl = post.media.reddit_video.fallback_url;
            } else if (post.post_hint === 'hosted:video' && post.media?.reddit_video) {
                videoUrl = post.media.reddit_video.fallback_url;
            } else if (post.post_hint === 'rich:video' && post.preview?.reddit_video_preview) { // e.g., YouTube embeds sometimes have this
                videoUrl = post.preview.reddit_video_preview.fallback_url; // This might be low res
                // Try to get a better thumbnail from preview images if available
                videoThumbnail = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || videoThumbnail;
            } else if (post.url_overridden_by_dest && /\.(mp4|mov|webm)$/i.test(post.url_overridden_by_dest)) {
                videoUrl = post.url_overridden_by_dest;
            } else if (post.url && /\.(mp4|mov|webm)$/i.test(post.url)) {
                videoUrl = post.url; // Direct video link in post URL
            }


            // If we found a video URL, return video info
            if (videoUrl) {
                const cleanedVideoUrl = videoUrl.replace(/&amp;/g, '&');
                // Fallback thumbnail if specific one wasn't found
                const finalThumbnail = videoThumbnail || post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&');
                return {
                    url: cleanedVideoUrl,
                    type: 'video',
                    items: [{ id: post.id + '_video', url: cleanedVideoUrl, thumbnail: finalThumbnail, type: 'video' }]
                };
            }


            // 3. Handle Single Images (Hint, Direct URL, Preview)
            let imageUrl = null;
            let imageThumbnail = post.thumbnail && post.thumbnail !== 'default' && post.thumbnail !== 'self' ? post.thumbnail.replace(/&amp;/g, '&') : null;

            if (post.post_hint === 'image' && post.url_overridden_by_dest) {
                imageUrl = post.url_overridden_by_dest;
            } else if (post.post_hint === 'image' && post.url) {
                imageUrl = post.url;
            } else if (post.url_overridden_by_dest && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url_overridden_by_dest)) {
                imageUrl = post.url_overridden_by_dest;
            } else if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
                imageUrl = post.url;
            }
            // Fallback: Use high-res preview image if a direct image URL wasn't found but preview exists
            else if (!imageUrl && post.preview?.images?.[0]?.source?.url) {
                const previewUrl = post.preview.images[0].source.url;
                if (/\.(jpg|jpeg|png|gif|webp)$/i.test(previewUrl)) {
                    imageUrl = previewUrl;
                    // Use the preview itself as thumbnail if specific one is missing
                    imageThumbnail = imageThumbnail || imageUrl.replace(/&amp;/g, '&');
                }
            }

            // If we found an image URL, return image info
            if (imageUrl) {
                const cleanedImageUrl = imageUrl.replace(/&amp;/g, '&');
                const finalThumbnail = imageThumbnail || cleanedImageUrl; // Fallback thumb to full image
                return {
                    url: cleanedImageUrl,
                    type: 'image',
                    items: [{ id: post.id + '_image', url: cleanedImageUrl, thumbnail: finalThumbnail, type: 'image' }]
                };
            }

            // 4. No specific media type found
            return null;

        } catch (err) {
            console.error(`Error processing media for post ${post?.id}:`, err, post);
            return null; // Return null on error
        }
    }, []); // No dependencies, this function is self-contained based on the 'post' argument


    // --- Filtered Posts (Derived State using useMemo) ---
    const displayedPosts = useMemo(() => {
        console.log("Filtering posts. Current filter:", mediaFilter); // Debugging
        if (mediaFilter === 'all') {
            return posts; // Return all fetched posts if filter is 'all'
        }
        return posts.filter(post => {
            const mediaInfo = getMediaInfo(post);
            if (!mediaInfo) return false; // Skip if no media info

            // Check based on filter type
            if (mediaFilter === 'image' && (mediaInfo.type === 'image' || mediaInfo.type === 'gallery')) {
                return true; // Include both single images and galleries
            }
            if (mediaFilter === 'video' && mediaInfo.type === 'video') {
                return true;
            }
            return false; // Doesn't match 'image' or 'video' filter
        });
    }, [posts, mediaFilter, getMediaInfo]); // Dependencies: recalculate when posts, filter, or the helper change


    // --- Selection Handlers ---
    const handleSelectPost = useCallback((postId) => {
        setSelectedPosts(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(postId)) {
                newSelected.delete(postId);
            } else {
                newSelected.add(postId);
            }
            return newSelected;
        });
    }, []); // No dependencies needed

    const handleSelectAllDisplayed = useCallback(() => {
        // Select only the IDs of the currently *displayed* (filtered) posts
        setSelectedPosts(prevSelected => {
            const newSelected = new Set(prevSelected); // Start with current selection
            displayedPosts.forEach(post => newSelected.add(post.id));
            console.log(`Selecting ${displayedPosts.length} displayed posts. Total selected: ${newSelected.size}`);
            return newSelected;
        });
    }, [displayedPosts]); // Depends on the list of displayed posts

    const handleDeselectAll = useCallback(() => {
        setSelectedPosts(new Set()); // Clear the selection set
        console.log("Deselected all posts.");
    }, []); // No dependencies needed


    // --- Fetch Comments for a Single Post ---
    const fetchCommentsForPost = async (postId) => {
        // Find the index of the post in the main 'posts' array to update it directly
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) {
            console.warn(`Post ${postId} not found in state for fetching comments.`);
            return; // Post not found in the current state
        }
        const currentPost = posts[postIndex];

        // Don't refetch if already loading for this specific post
        if (currentPost.commentsLoading) {
            console.log(`Comments for post ${postId} are already loading.`);
            return;
        }

        // If comments are already loaded and we just want to show them, toggle visibility
        if (!currentPost.showComments && currentPost.comments.length > 0 && !currentPost.commentsError) {
            console.log(`Toggling visibility for already loaded comments on post ${postId}`);
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                updatedPosts[postIndex] = { ...currentPost, showComments: true };
                return updatedPosts;
            });
            return;
        }
        // If comments are shown, toggle to hide them
        if (currentPost.showComments) {
            console.log(`Hiding comments for post ${postId}`);
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                updatedPosts[postIndex] = { ...currentPost, showComments: false };
                return updatedPosts;
            });
            return;
        }

        // If commentLimit is 0, don't attempt to fetch
        if (commentLimit === 0) {
            console.log(`Comment limit is 0, skipping fetch for post ${postId}`);
            // Optionally set commentsError or a message here
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                updatedPosts[postIndex] = { ...currentPost, commentsError: "Comment fetching disabled (limit 0)", showComments: true }; // Show error state
                return updatedPosts;
            });
            return;
        }


        console.log(`Fetching comments for post ${postId} (Subreddit: ${currentPost.subreddit}, Limit: ${commentLimit})`);
        // Update loading state specifically for this post
        setPosts(prevPosts => {
            const updatedPosts = [...prevPosts];
            updatedPosts[postIndex] = { ...currentPost, commentsLoading: true, commentsError: null };
            return updatedPosts;
        });

        try {
            const accessToken = await getAccessToken();
            // Extract the short ID (remove 't3_' prefix)
            const shortId = postId.startsWith('t3_') ? postId.substring(3) : postId;
            // Use the correct subreddit from the post data itself
            const postSubreddit = currentPost.subreddit;
            if (!postSubreddit) {
                throw new Error("Subreddit name missing in post data.");
            }

            // Construct the comments API URL
            const commentApiUrl = `https://oauth.reddit.com/r/${postSubreddit}/comments/${shortId}?limit=${commentLimit}&depth=1&sort=confidence&raw_json=1`; // `confidence` is often a good default sort

            const response = await fetch(commentApiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'RedditScraperAdvanced/2.1 by YourUsername',
                }
            });

            if (!response.ok) {
                let errorMsg = `Comment API Error (${response.status})`;
                try {
                    const errorData = await response.json();
                    console.error(`Reddit API Error (Comments for ${postId}):`, errorData);
                    errorMsg = `(${response.status}): ${errorData.message || 'Failed to load comments'}`;
                } catch (jsonError) {
                    errorMsg = `(${response.status}) ${response.statusText || 'Failed to load comments'}`;
                }
                throw new Error(errorMsg);
            }

            const commentData = await response.json();

            // Validate comment data structure (Reddit API returns an array: [post_data, comment_data])
            if (!commentData || !Array.isArray(commentData) || commentData.length < 2 || !commentData[1]?.data?.children) {
                // Check for a valid but empty comments case
                if (commentData?.[1]?.data?.children?.length === 0) {
                    console.log(`No comments found for post ${postId}.`);
                    setPosts(prevPosts => {
                        const updatedPosts = [...prevPosts];
                        updatedPosts[postIndex] = { ...currentPost, comments: [], commentsLoading: false, showComments: true, commentsError: null };
                        return updatedPosts;
                    });
                    return; // Successfully handled empty comments
                }
                // Otherwise, it's an unexpected structure
                console.error('Unexpected comment data structure:', commentData);
                throw new Error('Unexpected comment data structure from Reddit.');
            }

            // Extract and clean comments (top-level only due to depth=1)
            const fetchedComments = commentData[1].data.children
                .map(child => child.data)
                .filter(c => c && c.author && c.body && c.author !== '[deleted]' && c.body !== '[removed]' && !c.stickied); // Filter out deleted/removed/stickied

            console.log(`Fetched ${fetchedComments.length} comments for post ${postId}`);
            // Update the specific post in the main 'posts' array with the fetched comments
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                // Ensure we're updating the correct post based on its index
                updatedPosts[postIndex] = {
                    ...currentPost, // Spread the original post data first
                    comments: fetchedComments,
                    commentsLoading: false,
                    showComments: true, // Show comments immediately after loading
                    commentsError: null // Clear any previous error
                };
                // console.log("Post state after comment fetch:", updatedPosts[postIndex]); // Debugging
                return updatedPosts;
            });

        } catch (err) {
            console.error(`Failed to fetch comments for post ${postId}:`, err);
            // Update the specific post with the error message
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                // Ensure we update the correct post
                if (updatedPosts[postIndex]) {
                    updatedPosts[postIndex] = {
                        ...currentPost, // Spread original data
                        commentsLoading: false,
                        commentsError: err.message || 'Failed to load.',
                        showComments: true // Keep section open to show the error
                    };
                }
                return updatedPosts;
            });
        }
    };


    // --- Batch Fetch Comments for Selected Posts ---
    const fetchSelectedComments = async () => {
        const postsToFetch = Array.from(selectedPosts);
        if (postsToFetch.length === 0) {
            alert("No posts selected to load comments for.");
            return;
        }
        if (isLoading || isCommentsLoading) return; // Prevent concurrent fetches
        if (commentLimit === 0) {
            alert("Comment fetching is disabled (limit set to 0).");
            return;
        }

        setError('');
        setIsCommentsLoading(true); // Set global batch loading state
        console.log(`Starting batch comment fetch for ${postsToFetch.length} selected posts...`);

        // Fetch comments for each selected post sequentially or in parallel (Promise.allSettled)
        // Using Promise.allSettled to ensure all fetches complete, even if some fail
        const results = await Promise.allSettled(
            postsToFetch.map(postId => fetchCommentsForPost(postId))
        );

        // Log results (optional)
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Failed to fetch comments for post ${postsToFetch[index]} in batch:`, result.reason);
                // Error is already set on the individual post state by fetchCommentsForPost
            }
        });

        console.log(`Batch comment fetch finished for ${postsToFetch.length} posts.`);
        setIsCommentsLoading(false); // Clear global batch loading state
    };

    // --- Batch Fetch Comments for All *Displayed* Posts ---
    const fetchAllDisplayedComments = async () => {
        const postsToFetch = displayedPosts.map(post => post.id); // Get IDs of currently visible posts
        if (postsToFetch.length === 0) {
            alert("No posts are currently displayed to load comments for.");
            return;
        }
        if (isLoading || isCommentsLoading) return;
        if (commentLimit === 0) {
            alert("Comment fetching is disabled (limit set to 0).");
            return;
        }

        setError('');
        setIsCommentsLoading(true);
        console.log(`Starting batch comment fetch for ${postsToFetch.length} displayed posts...`);

        const results = await Promise.allSettled(
            postsToFetch.map(postId => fetchCommentsForPost(postId))
        );

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Failed to fetch comments for displayed post ${postsToFetch[index]} in batch:`, result.reason);
            }
        });

        console.log(`Batch comment fetch finished for ${postsToFetch.length} displayed posts.`);
        setIsCommentsLoading(false);
    };


    // --- Toggle Comment Visibility (Acts on main posts state) ---
    // This is now handled within fetchCommentsForPost, but keep a simple toggle just in case?
    // Or rely entirely on the logic within fetchCommentsForPost. Let's remove this separate toggle
    // to avoid conflicting logic. The button click should always call fetchCommentsForPost.
    /*
    const toggleCommentVisibility = (postId) => {
        setPosts(prevPosts => prevPosts.map(p =>
            p.id === postId ? { ...p, showComments: !p.showComments } : p
        ));
    };
    */


    // --- Cleaned JSON Download ---
    const downloadJson = useCallback(() => {
        // Determine which set of posts to download
        const postsToDownload = selectedPosts.size > 0
            ? posts.filter(p => selectedPosts.has(p.id)) // Use selected posts if any
            : displayedPosts; // Otherwise, use the currently displayed/filtered posts

        if (postsToDownload.length === 0) {
            alert("No posts selected or displayed to download.");
            return;
        }

        console.log(`Preparing JSON download for ${postsToDownload.length} posts.`);

        try {
            // Create a cleaned data structure for export
            const cleanedPosts = postsToDownload.map(post => ({
                id: post.id,
                title: post.title,
                author: post.author,
                subreddit: post.subreddit, // Include subreddit for each post
                created_utc: post.created_utc,
                score: post.score,
                upvote_ratio: post.upvote_ratio,
                num_comments_original: post.num_comments, // Original comment count reported by API
                num_comments_fetched: post.comments.length, // Actual number of comments fetched
                permalink: `https://reddit.com${post.permalink}`,
                url: post.url_overridden_by_dest || post.url, // The main link URL
                is_self: post.is_self,
                selftext: post.is_self ? post.selftext : null, // Only include selftext for self-posts
                link_flair_text: post.link_flair_text || null,
                post_hint: post.post_hint || null,
                media_info: getMediaInfo(post), // Include processed media info
                // Include fetched comments if available
                comments: post.comments.map(comment => ({
                    id: comment.id,
                    author: comment.author,
                    created_utc: comment.created_utc,
                    score: comment.score,
                    body: comment.body, // Plain text body
                    is_submitter: comment.is_submitter || false,
                    permalink: `https://reddit.com${comment.permalink}` // Full permalink to comment
                }))
            }));

            // Structure the final JSON file
            const dataToSave = {
                source_subreddit: subreddit || (searchScope === 'multiple' ? multipleSubreddits : (searchScope === 'all' ? 'All Reddit' : 'N/A')),
                search_query: searchQuery || null,
                sort_criteria: searchQuery ? searchSort : sort,
                time_filter: searchQuery ? searchTimeLimit : (sort === 'top' ? topTimeFrame : null),
                media_filter: mediaFilter,
                post_limit_requested: limit,
                comment_limit_per_post: commentLimit,
                download_type: selectedPosts.size > 0 ? 'selected_posts' : 'displayed_posts',
                download_timestamp: new Date().toISOString(),
                post_count: cleanedPosts.length,
                posts: cleanedPosts // The array of cleaned posts
            };

            // Stringify and create Blob
            const jsonString = JSON.stringify(dataToSave, null, 2); // Pretty print JSON
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = blobUrl;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sourceName = (subreddit || multipleSubreddits || 'reddit_search').replace(/[^a-zA-Z0-9_+]/g, '_'); // Sanitize filename
            const type = selectedPosts.size > 0 ? 'selected' : 'displayed';
            a.download = `reddit_export_${sourceName}_${type}_${timestamp}.json`;

            // Trigger download and cleanup
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl); // Free up memory

            console.log("JSON download initiated.");

        } catch (err) {
            console.error("Failed to create or download JSON:", err);
            setError("Failed to prepare JSON data for download. See console for details.");
        }
    }, [posts, displayedPosts, selectedPosts, subreddit, multipleSubreddits, searchQuery, searchScope, sort, searchSort, topTimeFrame, searchTimeLimit, mediaFilter, limit, commentLimit, getMediaInfo]);


    // --- Download Selected Media (using JSZip) ---
    const downloadSelectedMedia = useCallback(async () => {
        if (selectedPosts.size === 0) {
            alert("No posts selected to download media from.");
            return;
        }
        if (typeof JSZip === 'undefined') {
            setError("JSZip library not loaded. Cannot download media archive.");
            console.error("JSZip is not defined. Make sure the library is included correctly.");
            return;
        }

        setIsMediaDownloading(true);
        setError('');
        console.log(`Preparing media download for ${selectedPosts.size} selected posts...`);

        const zip = new JSZip();
        const mediaToFetch = [];
        const fetchErrors = [];

        // Identify all media URLs from selected posts (including galleries)
        posts.forEach(post => {
            if (selectedPosts.has(post.id)) {
                const mediaInfo = getMediaInfo(post);
                if (mediaInfo?.items && mediaInfo.items.length > 0) {
                    mediaInfo.items.forEach((item, index) => {
                        if (item.url && (item.type === 'image' || item.type === 'video')) {
                            try {
                                // Generate a reasonably unique filename
                                const urlParts = new URL(item.url); // Use URL API for easier parsing
                                const pathParts = urlParts.pathname.split('/');
                                let baseFilename = pathParts[pathParts.length - 1] || `${post.id}_item_${index}`;
                                // Sanitize filename (remove query params, replace invalid chars)
                                baseFilename = baseFilename.split('?')[0].replace(/[^a-zA-Z0-9_.-]/g, '_');

                                // Ensure it has an extension
                                const extension = baseFilename.includes('.') ? '' : (item.type === 'video' ? '.mp4' : '.jpg'); // Default extensions

                                // Add post ID and index for uniqueness, especially in galleries
                                const filename = `${post.id}_${index}_${baseFilename}${extension}`;

                                mediaToFetch.push({ url: item.url, filename: filename, postId: post.id });
                            } catch (urlError) {
                                console.warn(`Skipping invalid media URL: ${item.url}`, urlError);
                                fetchErrors.push(`Invalid URL (${post.id}): ${item.url}`);
                            }
                        }
                    });
                }
            }
        });

        if (mediaToFetch.length === 0) {
            alert("No downloadable image or video links found in the selected posts.");
            setIsMediaDownloading(false);
            return;
        }

        console.log(`Attempting to fetch ${mediaToFetch.length} media files...`);
        let successCount = 0;


        // Fetch media files (consider concurrency limits if needed)
        // Using Promise.allSettled to handle individual fetch failures gracefully
        const fetchPromises = mediaToFetch.map(async (media) => {
            try {
                // IMPORTANT: CORS limitations apply! Direct fetching from i.redd.it / v.redd.it
                // might work, but other domains (imgur, gfycat etc.) likely WILL NOT WORK
                // without a CORS proxy. This implementation assumes direct fetch works.
                console.log(`Fetching: ${media.url}`);
                const response = await fetch(media.url); // Add { mode: 'cors' } if testing? Unlikely to help much.

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} for ${media.url}`);
                }
                if (response.redirected) {
                    // Handle potential redirects if necessary, though fetch usually follows them
                    console.log(`Redirected fetch for ${media.url} to ${response.url}`);
                }

                const blob = await response.blob();

                // Check blob size? Optional.
                if (blob.size === 0) {
                    console.warn(`Fetched empty blob for ${media.filename} (URL: ${media.url})`);
                    // Optionally skip adding empty files or add an error note
                    // throw new Error(`Empty file received for ${media.url}`);
                }

                // Add the fetched blob to the zip file
                zip.file(media.filename, blob, { binary: true });
                successCount++;
                console.log(`Successfully added ${media.filename} to zip.`);
                return { status: 'fulfilled', filename: media.filename }; // Indicate success

            } catch (fetchError) {
                console.error(`Failed to fetch or add ${media.filename} (URL: ${media.url}):`, fetchError);
                fetchErrors.push(`Failed (${media.postId}): ${media.filename} - ${fetchError.message}`);
                // Optionally add a placeholder/error file to the zip
                zip.file(`${media.filename}_FETCH_ERROR.txt`, `Failed to download:\nURL: ${media.url}\nError: ${fetchError.message}`);
                return { status: 'rejected', filename: media.filename, reason: fetchError.message }; // Indicate failure
            }
        });

        // Wait for all fetch operations to settle
        await Promise.allSettled(fetchPromises);

        console.log(`Media fetching complete. Success: ${successCount}, Errors: ${fetchErrors.length}`);

        // Add an error log file to the zip if there were failures
        if (fetchErrors.length > 0) {
            const errorLogContent = `Media Download Report (${new Date().toISOString()})\n\nTotal Files Attempted: ${mediaToFetch.length}\nSuccessful: ${successCount}\nFailed: ${fetchErrors.length}\n\nErrors:\n-------\n${fetchErrors.join('\n')}\n\nNote: Failures may be due to CORS restrictions, network issues, or invalid links.`;
            zip.file('_DOWNLOAD_ERRORS.txt', errorLogContent);
            setError(`Note: ${fetchErrors.length} media file(s) failed to download. Check _DOWNLOAD_ERRORS.txt in the ZIP.`);
        }

        // Proceed to generate zip only if at least one file was successful (or if errors occurred but we still want the zip)
        if (successCount > 0 || fetchErrors.length > 0) {
            try {
                console.log("Generating ZIP file...");
                const zipBlob = await zip.generateAsync(
                    { type: "blob" },
                    (metadata) => { // Progress callback (optional)
                        // console.log(`Zipping progress: ${metadata.percent.toFixed(2)} %`);
                        // Update UI with progress if desired
                    }
                );

                console.log("ZIP generation complete. Triggering download.");
                const blobUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = blobUrl;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const sourceName = (subreddit || multipleSubreddits || 'reddit_media').replace(/[^a-zA-Z0-9_+]/g, '_');
                a.download = `reddit_media_${sourceName}_${timestamp}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);

            } catch (zipError) {
                console.error("Failed to generate or download ZIP:", zipError);
                setError("Failed to generate the ZIP file. See console for details.");
            }
        } else if (successCount === 0 && fetchErrors.length > 0) {
            // Only errors, no zip generated - error message already set.
            console.log("No media successfully downloaded.");
        } else {
            // This case shouldn't normally be reached if mediaToFetch > 0
            console.log("No media was processed for download.");
        }


        setIsMediaDownloading(false); // Reset download state
    }, [posts, selectedPosts, getMediaInfo, subreddit, multipleSubreddits]); // Dependencies for the callback


    // --- Other Helpers (formatTime, toggleExpand - integrated into post structure) ---
    const formatTime = useCallback((timestamp) => {
        const seconds = Math.floor(Date.now() / 1000) - timestamp;
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }, []); // No dependencies, pure function

    const toggleExpand = useCallback((postId) => {
        setPosts(prevPosts => prevPosts.map(p =>
            p.id === postId ? { ...p, isExpanded: !p.isExpanded } : p
        ));
    }, []); // No dependencies needed

    // --- Open Gallery Function ---
    const openGallery = useCallback((mediaInfo, index = 0) => {
        if (!mediaInfo?.items || mediaInfo.items.length === 0) {
            console.warn("Attempted to open gallery with no items:", mediaInfo);
            return;
        }
        console.log(`Opening gallery with ${mediaInfo.items.length} items, starting at index ${index}`);
        setGalleryUrls(mediaInfo.items); // Pass the array of {url, type, id, thumbnail}
        setInitialGalleryIndex(index);
        setShowGalleryModal(true);
    }, []); // No dependencies needed


    // --- Instagram Style Media Component (Inline in Post Card) ---
    // Defined as a separate component for clarity, used within the post mapping
    const InstagramMediaDisplay = ({ mediaInfo, post }) => {
        // Basic check if mediaInfo is valid and has items
        if (!mediaInfo?.items || mediaInfo.items.length === 0) {
            // Optionally render a placeholder or nothing if no media
            return null;
        }

        const firstItem = mediaInfo.items[0];
        const hasMultiple = mediaInfo.items.length > 1;

        return (
            <div className="instagram-post">
                {/* Header */}
                <div className="instagram-post-header">
                    <div className="instagram-post-user">
                        <div className="instagram-post-avatar" title={post.author}></div>
                        <a href={`https://reddit.com/u/${post.author}`} target="_blank" rel="noopener noreferrer" className="instagram-post-username">
                            {post.author}
                        </a>
                    </div>
                    {/* Optional: More options icon */}
                    {/* <div className="instagram-post-more" title="More options">•••</div> */}
                </div>

                {/* Media Area */}
                <div className="instagram-post-media" onClick={() => openGallery(mediaInfo, 0)} title="Click to view gallery">
                    {/* Display first item */}
                    <div className={hasMultiple ? "instagram-post-carousel" : "instagram-post-single"}>
                        {firstItem.type === 'video' ? (
                            <div className="instagram-post-video-container">
                                <video src={firstItem.url} muted loop playsInline>Video not supported</video>
                                {/* Video icon only shown if it's actually a video */}
                                <div className="instagram-post-video-icon" title="Video">▶</div>
                            </div>
                        ) : (
                            <img src={firstItem.url} alt={post.title} loading="lazy" />
                        )}
                        {/* Indicator for multiple items */}
                        {hasMultiple && (
                            <div className="instagram-post-carousel-indicator">
                                {/* Use an icon + count */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                                    <path d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 13 1.5H3zM1.5 2a.5.5 0 0 1 .5-.5H3a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm13 .5a.5.5 0 0 1-.5.5H13a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5zM2 13.5a.5.5 0 0 1-.5.5V13a.5.5 0 0 1 .5.5zm11.5-.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5-.5z" />
                                    <path d="M12.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h9z" />
                                </svg>
                                1 / {mediaInfo.items.length}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions (Placeholder) */}
                <div className="instagram-post-actions">
                    <div title="Upvote (placeholder)">♥</div>
                    <div title="Comments (placeholder)">💬</div>
                    <div title="Share (placeholder)">📤</div>
                    <div className="instagram-post-save" title="Save (placeholder)">🔖</div>
                </div>

                {/* Info Section */}
                <div className="instagram-post-info">
                    <div className="instagram-post-likes">{post.score?.toLocaleString() || 0} upvotes</div>
                    {/* Caption using post title */}
                    <div className="instagram-post-caption">
                        <a href={`https://reddit.com/u/${post.author}`} target="_blank" rel="noopener noreferrer" className="instagram-post-caption-username">
                            {post.author}
                        </a>
                        <span className="instagram-post-caption-text"> {post.title}</span>
                    </div>
                    {/* Link to actual comments */}
                    <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer" className="instagram-post-comments-count">
                        View all {post.num_comments?.toLocaleString() || 0} comments on Reddit
                    </a>
                    <div className="instagram-post-time">{formatTime(post.created_utc)}</div>
                </div>
            </div>
        );
    };


    // --- JSX Structure ---
    return (
        <div className="container">
            {/* --- Modals --- */}
            {showAuthModal && (
                <div className="modal" onClick={() => setShowAuthModal(false)}>
                    <div className="modal-content auth-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAuthModal(false)} title="Close">×</button>
                        <h3>Reddit API Credentials</h3>
                        <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                            Required for accessing the Reddit API. Create an app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer">Reddit Apps</a> (select 'script' type).
                        </p>
                        <div style={{ margin: '20px 0' }}>
                            <div className="control-group">
                                <label htmlFor="clientId">Client ID <span>*</span></label>
                                <input
                                    id="clientId"
                                    value={credentials.clientId}
                                    onChange={(e) => setCredentials(c => ({ ...c, clientId: e.target.value }))}
                                    placeholder="Enter Reddit Client ID"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="control-group" style={{ marginTop: '15px' }}>
                                <label htmlFor="clientSecret">Client Secret <span>*</span></label>
                                <input
                                    id="clientSecret"
                                    type="password" // Use password type
                                    value={credentials.clientSecret}
                                    onChange={(e) => setCredentials(c => ({ ...c, clientSecret: e.target.value }))}
                                    placeholder="Enter Reddit Client Secret"
                                    autoComplete="new-password" // Prevent browser autofill issues
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                            <button className="ghost-btn" onClick={() => setShowAuthModal(false)}>Cancel</button>
                            <button
                                onClick={() => {
                                    if (credentials.clientId.trim() && credentials.clientSecret.trim()) {
                                        setShowAuthModal(false);
                                        setError(''); // Clear previous errors
                                        accessTokenRef.current = null; // Force token refresh on next API call
                                        tokenExpiryRef.current = 0;
                                        console.log("Credentials saved.");
                                    } else {
                                        alert('Please enter both Client ID and Client Secret.');
                                    }
                                }}
                                disabled={!credentials.clientId.trim() || !credentials.clientSecret.trim()}
                            >
                                Save Credentials
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove the basic MediaViewerModal if GalleryModal handles everything */}
            {/* {showMediaModal && ( <MediaViewerModal ... /> )} */}

            {showGalleryModal && (
                <GalleryModal
                    galleryUrls={galleryUrls}
                    initialIndex={initialGalleryIndex}
                    onClose={() => setShowGalleryModal(false)}
                />
            )}

            {/* --- Main Controls Card --- */}
            <div className="card">
                <h2>Reddit Scraper Advanced</h2>

                {/* --- Media Filter Header --- */}
                <div className="media-filter-header">
                    <div> {/* Flex container for title and count */}
                        <h3>View Filter</h3>
                        <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                            {posts.length > 0 ? `${displayedPosts.length} post${displayedPosts.length !== 1 ? 's' : ''} shown` : 'No posts loaded'}
                        </span>
                    </div>
                    <div className="media-filter-options">
                        {['all', 'image', 'video'].map(filterValue => (
                            <React.Fragment key={filterValue}>
                                <input
                                    type="radio"
                                    id={`filter${filterValue}`}
                                    name="mediaFilter"
                                    value={filterValue}
                                    checked={mediaFilter === filterValue}
                                    onChange={(e) => setMediaFilter(e.target.value)}
                                    disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                />
                                <label htmlFor={`filter${filterValue}`}>
                                    {filterValue === 'all' ? 'All Posts' : filterValue === 'image' ? 'Images & Galleries' : 'Videos'}
                                </label>
                            </React.Fragment>
                        ))}
                    </div>
                </div>


                {/* --- Subreddit Fetch Controls --- */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Fetch from Subreddit</h3>
                    <div className="controls-grid">
                        <div className="control-group">
                            <label htmlFor="subredditInput">Subreddit (e.g., pics):</label>
                            <input
                                id="subredditInput"
                                value={subreddit}
                                onChange={(e) => setSubreddit(e.target.value.replace(/r\/|\s/g, ''))} // Basic cleaning
                                placeholder="Enter subreddit name"
                                onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                autoFocus
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="sortSelect">Sort by:</label>
                            <select id="sortSelect" value={sort} onChange={(e) => setSort(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                <option value="hot">Hot</option>
                                <option value="new">New</option>
                                <option value="top">Top</option>
                                <option value="controversial">Controversial</option>
                                <option value="rising">Rising</option>
                                {/* <option value="relevance">Relevance (Use Search)</option> */}
                            </select>
                        </div>
                        {/* Time Frame selector - only visible when "top" or "controversial" is selected */}
                        {(sort === 'top' || sort === 'controversial') && (
                            <div className="control-group">
                                <label htmlFor="timeFrameSelect">Time Frame:</label>
                                <select
                                    id="timeFrameSelect"
                                    value={topTimeFrame}
                                    onChange={(e) => setTopTimeFrame(e.target.value)}
                                    disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                >
                                    <option value="hour">Past Hour</option>
                                    <option value="day">Past 24 Hours</option>
                                    <option value="week">Past Week</option>
                                    <option value="month">Past Month</option>
                                    <option value="year">Past Year</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>
                        )}
                        <div className="control-group">
                            <label htmlFor="limitInput">Post Limit (1-100):</label>
                            <input
                                id="limitInput"
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))} // Clamp value
                                min="1" max="100" step="1"
                                onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="commentLimitSelect">Comment Limit:</label>
                            <select
                                id="commentLimitSelect"
                                value={commentLimit}
                                onChange={(e) => setCommentLimit(Number(e.target.value))}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            >
                                <option value="20">Top 20</option>
                                <option value="50">Top 50</option>
                                <option value="100">Top 100</option>
                                <option value="0">None</option>
                            </select>
                        </div>
                    </div>
                    {/* --- Primary Action Buttons --- */}
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={fetchPosts} disabled={isLoading || isCommentsLoading || isMediaDownloading || !subreddit.trim()}>
                            {isLoading && !searchQuery ? 'Loading...' : `Fetch r/${subreddit || '...'}`}
                        </button>
                        <button className="ghost-btn" onClick={() => setShowAuthModal(true)} disabled={isLoading || isCommentsLoading || isMediaDownloading} title="Edit API Credentials">
                            API Credentials
                        </button>
                    </div>
                </div>


                {/* --- Search Section --- */}
                <div>
                    <h3 style={{ marginTop: '0', marginBottom: '15px' }}>Search Reddit</h3>
                    <div className="controls-grid">
                        <div className="control-group" style={{ gridColumn: 'span 2' }}> {/* Span 2 columns */}
                            <label htmlFor="searchQueryInput">Search Query:</label>
                            <input
                                id="searchQueryInput"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Enter search terms..."
                                onKeyDown={(e) => e.key === 'Enter' && searchReddit()}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="searchScopeSelect">Search In:</label>
                            <select
                                id="searchScopeSelect"
                                value={searchScope}
                                onChange={(e) => setSearchScope(e.target.value)}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            >
                                <option value="subreddit">Current Subreddit</option>
                                <option value="multiple">Multiple Subs</option>
                                <option value="all">All Reddit</option>
                            </select>
                        </div>

                        {/* Show multiple subreddits input only when 'multiple' scope is selected */}
                        {searchScope === 'multiple' && (
                            <div className="control-group" style={{ gridColumn: 'span 2' }}> {/* Span 2 columns */}
                                <label htmlFor="multipleSubredditsInput">Subreddits (comma-sep):</label>
                                <input
                                    id="multipleSubredditsInput"
                                    value={multipleSubreddits}
                                    onChange={(e) => setMultipleSubreddits(e.target.value)}
                                    placeholder="e.g. pics, aww, dataisbeautiful"
                                    onKeyDown={(e) => e.key === 'Enter' && searchReddit()}
                                    disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                />
                            </div>
                        )}

                        {/* Search Sort Options */}
                        <div className="control-group">
                            <label htmlFor="searchSortSelect">Sort Results By:</label>
                            <select
                                id="searchSortSelect"
                                value={searchSort}
                                onChange={(e) => setSearchSort(e.target.value)}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            >
                                <option value="relevance">Relevance</option>
                                <option value="hot">Hot</option>
                                <option value="new">New</option>
                                <option value="top">Top</option>
                                <option value="comments">Comment Count</option>
                            </select>
                        </div>
                        {/* Search Time Limit */}
                        <div className="control-group">
                            <label htmlFor="searchTimeLimitSelect">Time Period:</label>
                            <select
                                id="searchTimeLimitSelect"
                                value={searchTimeLimit}
                                onChange={(e) => setSearchTimeLimit(e.target.value)}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            >
                                <option value="all">All Time</option>
                                <option value="hour">Past Hour</option>
                                <option value="day">Past 24 Hours</option>
                                <option value="week">Past Week</option>
                                <option value="month">Past Month</option>
                                <option value="year">Past Year</option>
                            </select>
                        </div>
                        {/* Search Result Limit (uses the same 'limit' state) */}
                        <div className="control-group">
                            <label htmlFor="searchLimitInput">Result Limit (1-100):</label>
                            <input
                                id="searchLimitInput"
                                type="number"
                                value={limit} // Re-use the limit state
                                onChange={(e) => setLimit(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                                min="1" max="100" step="1"
                                onKeyDown={(e) => e.key === 'Enter' && searchReddit()}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            />
                        </div>
                    </div>
                    {/* Search Action Button */}
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={searchReddit}
                            // Disable logic based on scope and inputs
                            disabled={
                                isLoading || isCommentsLoading || isMediaDownloading ||
                                !searchQuery.trim() ||
                                (searchScope === 'subreddit' && !subreddit.trim()) ||
                                (searchScope === 'multiple' && !multipleSubreddits.trim().split(',').map(s => s.trim()).filter(s => s).length)
                            }
                        >
                            {isLoading && searchQuery ? 'Searching...' : 'Search Reddit'}
                        </button>
                        {/* Helper text indicating search scope */}
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em', flex: '1', textAlign: 'right' }}>
                            {searchScope === 'subreddit' ?
                                (subreddit.trim() ? `Searching in r/${subreddit}` : 'Requires subreddit above') :
                                (searchScope === 'multiple' ?
                                    (multipleSubreddits.trim() ? `Searching in specified subs` : 'Requires subs below') :
                                    'Searching all Reddit')
                            }
                        </span>
                    </div>
                </div>

            </div> {/* End Controls Card */}


            {/* --- Action Buttons for Results --- */}
            {/* Show only if there are posts loaded */}
            {posts.length > 0 && (
                <div className="action-buttons-container">
                    {/* Selection Info & Controls */}
                    <span title={`${selectedPosts.size} of ${displayedPosts.length} posts selected`}>
                        {selectedPosts.size} selected
                    </span>
                    <button
                        className="ghost-btn"
                        onClick={handleSelectAllDisplayed}
                        disabled={isLoading || isCommentsLoading || isMediaDownloading || displayedPosts.length === 0}
                        title={`Select all ${displayedPosts.length} currently visible posts`}
                    >
                        Select Visible ({displayedPosts.length})
                    </button>
                    <button
                        className="ghost-btn"
                        onClick={handleDeselectAll}
                        disabled={isLoading || isCommentsLoading || isMediaDownloading || selectedPosts.size === 0}
                        title="Deselect all posts"
                    >
                        Deselect All
                    </button>

                    <span style={{ borderLeft: '1px solid var(--border-color)', height: '24px', margin: '0 5px' }}></span> {/* Separator */}

                    {/* Comment Fetch Buttons */}
                    <button
                        onClick={fetchSelectedComments}
                        disabled={selectedPosts.size === 0 || isLoading || isCommentsLoading || isMediaDownloading || commentLimit === 0}
                        title={commentLimit === 0 ? "Comment fetching disabled (limit 0)" : `Fetch comments for the ${selectedPosts.size} selected posts (Limit: ${commentLimit})`}
                    >
                        {isCommentsLoading ? 'Loading...' : `Load Sel. Comments (${selectedPosts.size})`}
                    </button>
                    {/* Maybe remove "Load Displayed Comments" as it might be confusing / less useful? Keep for now. */}
                    {/*
                    <button onClick={fetchAllDisplayedComments} disabled={isLoading || isCommentsLoading || displayedPosts.length === 0 || commentLimit === 0} title={`Fetch comments for all ${displayedPosts.length} currently displayed posts (Limit: ${commentLimit})`}>
                        Load Disp. Comments ({displayedPosts.length})
                    </button>
                    */}

                    <span style={{ borderLeft: '1px solid var(--border-color)', height: '24px', margin: '0 5px' }}></span> {/* Separator */}

                    {/* Download Buttons */}
                    <button
                        onClick={downloadJson}
                        disabled={isLoading || isCommentsLoading || isMediaDownloading || posts.length === 0} // Disable if no posts at all
                        title={selectedPosts.size > 0 ? `Download cleaned JSON for ${selectedPosts.size} selected posts` : `Download cleaned JSON for all ${displayedPosts.length} displayed posts`}
                    >
                        {selectedPosts.size > 0 ? `DL Selected JSON (${selectedPosts.size})` : 'DL Visible JSON'}
                    </button>
                    <button
                        onClick={downloadSelectedMedia}
                        disabled={selectedPosts.size === 0 || isLoading || isMediaDownloading} // Disable if no selection or already downloading
                        title="Download media (images/videos) from selected posts as ZIP. May be blocked by CORS."
                    >
                        {isMediaDownloading ? 'Zipping Media...' : `DL Selected Media (${selectedPosts.size})`}
                    </button>

                </div>
            )}


            {/* --- Error Display --- */}
            {error && <div className="error" role="alert">{error}</div>}


            {/* --- Post List --- */}
            <div className="post-list-container" style={{ marginTop: '10px' }}>
                {/* Loading State */}
                {isLoading && posts.length === 0 && (
                    <div className="card">
                        {/* Basic Loading Placeholder */}
                        <div className="loading-placeholder placeholder-line" style={{ width: '70%', height: '20px', marginBottom: '15px' }}></div>
                        <div className="loading-placeholder placeholder-line short" style={{ height: '14px', marginBottom: '10px' }}></div>
                        <div className="loading-placeholder placeholder-line" style={{ height: '14px', width: '80%', marginBottom: '20px' }}></div>
                        <div className="loading-placeholder" style={{ height: '100px' }}></div>
                    </div>
                )}

                {/* No Results / Filtered Out States */}
                {!isLoading && posts.length > 0 && displayedPosts.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '30px', padding: '20px' }}>
                        No posts match the current media filter ('{mediaFilter === 'image' ? 'Images & Galleries' : mediaFilter}'). Try selecting 'All Posts'.
                    </p>
                )}
                {!isLoading && posts.length === 0 && (searchQuery || subreddit) && !error && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '30px', padding: '20px' }}>
                        No posts found {searchQuery ? `for search query "${searchQuery}"` : `in r/${subreddit}`}. Check spelling or try different terms/subreddit.
                    </p>
                )}
                {/* Initial state message */}
                {!isLoading && posts.length === 0 && !subreddit && !searchQuery && !error && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '30px', padding: '20px' }}>
                        Enter a subreddit name and click "Fetch Posts", or use the search function above. <br /> Don't forget to set your <a href="#" onClick={(e) => { e.preventDefault(); setShowAuthModal(true); }}>API Credentials</a>.
                    </p>
                )}

                {/* Displayed Posts */}
                {displayedPosts.map(post => {
                    const mediaInfo = getMediaInfo(post); // Get media info once per post
                    const isSelected = selectedPosts.has(post.id);
                    const isLongText = post.selftext && (post.selftext.length > 400 || post.selftext.split('\n').length > 8);

                    return (
                        <div key={post.id} className={`card ${isSelected ? 'selected' : ''}`}>
                            {/* Selection Checkbox */}
                            <input
                                type="checkbox"
                                className="post-checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectPost(post.id)}
                                title={isSelected ? 'Deselect this post' : 'Select this post'}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading} // Disable during loading states
                            />

                            {/* Post Header & Title */}
                            <h4 style={{ marginBottom: '8px' }}>
                                {/* Title with link to Reddit post */}
                                <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer" title={post.title}>
                                    {post.title}
                                </a>
                                {/* Media Link (only if media exists) */}
                                {mediaInfo?.items && mediaInfo.items.length > 0 && (
                                    <span
                                        className="media-link"
                                        onClick={() => openGallery(mediaInfo, 0)} // Always open gallery
                                        title={`View ${mediaInfo.type === 'gallery' ? `${mediaInfo.items.length} items` : capitalize(mediaInfo.type)}`}
                                        style={{ marginLeft: '10px', cursor: 'pointer' }} // Explicit cursor
                                    >
                                        View {mediaInfo.type === 'gallery' ? 'Gallery' : capitalize(mediaInfo.type)}
                                    </span>
                                )}
                            </h4>

                            {/* Post Meta Info */}
                            <div className="post-info">
                                <a href={`https://reddit.com/u/${post.author}`} target="_blank" rel="noopener noreferrer" title={`View u/${post.author}'s profile`}>
                                    u/{post.author}
                                </a>
                                <span>{post.score?.toLocaleString()} pts ({post.upvote_ratio * 100}%)</span>
                                <span>{formatTime(post.created_utc)}</span>
                                {/* Show subreddit if searching across 'all' or 'multiple' */}
                                {(searchScope === 'all' || searchScope === 'multiple') && post.subreddit && (
                                    <span><a href={`https://reddit.com/r/${post.subreddit}`} target="_blank" rel="noopener noreferrer">r/{post.subreddit}</a></span>
                                )}
                                <span>{post.num_comments?.toLocaleString()} comments</span>
                                {post.link_flair_text && <span title={`Flair: ${post.link_flair_text}`}>Flair: {post.link_flair_text}</span>}
                            </div>

                            {/* Media Display (Instagram Style) */}
                            {/* Conditionally render if mediaInfo is valid */}
                            {mediaInfo && mediaInfo.items && mediaInfo.items.length > 0 && (
                                <InstagramMediaDisplay mediaInfo={mediaInfo} post={post} />
                            )}

                            {/* Post Body (Selftext) */}
                            {post.is_self && post.selftext && (
                                <div style={{ marginTop: '15px' }}>
                                    {/* Use dangerouslySetInnerHTML ONLY if you trust the source OR sanitize it first.
                                         Reddit's selftext_html is generally safe-ish but still a risk.
                                         Using plain selftext is safer. */}
                                    <div className="post-content" style={{ maxHeight: post.isExpanded ? 'none' : '150px', overflow: 'hidden' }}>
                                        {/* Render selftext as plain text (safer) */}
                                        <p style={{ whiteSpace: 'pre-wrap' /* Preserve line breaks */ }}>{post.selftext}</p>
                                    </div>
                                    {isLongText && (
                                        <button
                                            className="ghost-btn"
                                            onClick={() => toggleExpand(post.id)}
                                            style={{ fontSize: '0.85em', padding: '5px 10px', marginTop: '5px' }}
                                        >
                                            {post.isExpanded ? 'Show Less' : 'Read More'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* External Link (if not self-post and no direct media was rendered) */}
                            {!post.is_self && !mediaInfo && (post.url_overridden_by_dest || post.url) && (
                                <div style={{ marginTop: '15px', wordBreak: 'break-all', fontSize: '0.9em' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '5px' }}>Link:</span>
                                    <a
                                        href={post.url_overridden_by_dest || post.url}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow" // Add nofollow for external links
                                        title={post.url_overridden_by_dest || post.url}
                                    >
                                        {/* Display a shortened version of the URL */}
                                        {(post.url_overridden_by_dest || post.url).length > 80
                                            ? (post.url_overridden_by_dest || post.url).substring(0, 80) + '...'
                                            : (post.url_overridden_by_dest || post.url)}
                                    </a>
                                </div>
                            )}


                            {/* Comments Section */}
                            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                                {/* Button text logic needs refinement based on state */}
                                <button
                                    className="ghost-btn"
                                    onClick={() => fetchCommentsForPost(post.id)} // Always call this function
                                    // Disable if globally loading, or specifically loading for this post, or limit is 0
                                    disabled={isCommentsLoading || post.commentsLoading || commentLimit === 0}
                                    style={{ fontSize: '0.85em', padding: '5px 10px' }}
                                >
                                    {post.commentsLoading ? 'Loading Comments...' :
                                        post.showComments ? `Hide Comments (${post.comments.length})` :
                                            post.comments.length > 0 ? `Show Comments (${post.comments.length})` :
                                                commentLimit === 0 ? 'Comments Disabled' :
                                                    `Load Comments (${post.num_comments?.toLocaleString() || 0})`
                                    }
                                </button>
                                {/* Show specific error for this post's comments */}
                                {post.showComments && post.commentsError && !post.commentsLoading && (
                                    <span className="error" style={{ fontSize: '0.85em', marginLeft: '10px', display: 'inline-block', padding: '3px 8px', border: 'none', background: 'none', marginBottom: 0 }}>
                                        Error: {post.commentsError}
                                    </span>
                                )}

                                {/* Render Comments if shown */}
                                {post.showComments && !post.commentsError && (
                                    <div className="comment-section" style={{ marginTop: '15px' }}>
                                        {post.comments.length > 0 ? (
                                            post.comments.map(comment => (
                                                // Ensure comment has an ID before rendering
                                                comment.id ? (
                                                    <div key={comment.id} className="comment">
                                                        <div className="comment-meta">
                                                            {/* Link to comment author profile */}
                                                            <a href={`https://reddit.com/u/${comment.author}`} target="_blank" rel="noopener noreferrer">
                                                                u/{comment.author}
                                                            </a>
                                                            <span>{comment.score?.toLocaleString()} pts</span>
                                                            <span>{formatTime(comment.created_utc)}</span>
                                                            {comment.is_submitter && <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>(OP)</span>}
                                                            {/* Direct link to comment */}
                                                            <a href={`https://reddit.com${comment.permalink}`} target="_blank" rel="noopener noreferrer" title="Link to comment">🔗</a>
                                                        </div>
                                                        {/* Render comment body - use plain text for safety */}
                                                        <div className="comment-body" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
                                                    </div>
                                                ) : null // Skip rendering if comment has no ID (shouldn't happen often)
                                            ))
                                        ) : (!post.commentsLoading && // Only show "No comments" if not loading
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', margin: 0 }}>No comments to display (or none fetched).</p>
                                        )}
                                    </div>
                                )}
                            </div> {/* End Comments Section Wrapper */}
                        </div> // End post card
                    );
                })}
            </div> {/* End Post List Container */}

            {/* Media Grid View (Optional Section) */}
            {/* Show only if posts exist AND the filter is image or video */}
            {posts.length > 0 && (mediaFilter === 'image' || mediaFilter === 'video') && (
                <div className="card" style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ margin: 0 }}>
                            Media Grid ({mediaFilter === 'image' ? 'Images/Galleries' : 'Videos'})
                        </h3>
                        {/* Grid Size Controls */}
                        <div className="grid-controls">
                            <label htmlFor="gridSizeSlider" style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginRight: '5px' }}>Grid Size:</label>
                            <input
                                id="gridSizeSlider"
                                type="range"
                                className="grid-size-slider"
                                min="100"
                                max="350" // Increased max size slightly
                                step="10"
                                value={gridSize}
                                onChange={(e) => setGridSize(Number(e.target.value))}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                aria-label="Adjust grid item size"
                            />
                            <span style={{ fontSize: '0.9em', minWidth: '40px', textAlign: 'right', color: 'var(--text-secondary)' }}>{gridSize}px</span>
                        </div>
                    </div>

                    {/* The actual MediaGrid component */}
                    <MediaGrid
                        posts={displayedPosts} // Pass only the filtered posts
                        onOpenMedia={openGallery} // Use the unified gallery opener
                        gridSize={gridSize}
                        getMediaInfo={getMediaInfo} // Pass the memoized helper function
                    />
                </div>
            )}

        </div> // End Container
    );
}

// Mount the React app to the DOM
// Ensure the 'root' element exists in index.html
const rootElement = document.getElementById('root');
if (rootElement) {
    const reactRoot = ReactDOM.createRoot(rootElement);
    reactRoot.render(<RedditScraper />);
} else {
    console.error("Root element #root not found in the DOM.");
}