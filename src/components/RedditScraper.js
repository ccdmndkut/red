// RedditScraper.js
// Use globals from script tags instead of imports
// React hooks are available from the React global
const { useState, useCallback, useEffect, useMemo, useRef } = React;
// JSZip is available globally from script tags

// Import modularized components
// import MediaViewerModal from './components/MediaViewerModal'; // Currently unused
// GalleryModal and MediaGrid are available globally from script tags
// import GalleryModal from './components/GalleryModal';
// import MediaGrid from './components/MediaGrid';

// Import utility functions
// capitalize and formatTime are available globally from utils.js
// import { capitalize, formatTime } from './utils';

// --- Main Reddit Scraper Component ---
function RedditScraper() {
    // --- State ---
    const [subreddit, setSubreddit] = useState('');
    const [posts, setPosts] = useState([]); // Stores ALL fetched posts
    const [isLoading, setIsLoading] = useState(false);
    const [isCommentsLoading, setIsCommentsLoading] = useState(false); // Global state for batch comment loading
    const [isMediaDownloading, setIsMediaDownloading] = useState(false); // State for media download
    const [error, setError] = useState('');
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [credentials, setCredentials] = useState(() => {
        const savedCreds = localStorage.getItem('redditApiCredentials');
        return savedCreds ? JSON.parse(savedCreds) : { clientId: '', clientSecret: '' };
    });
    const [limit, setLimit] = useState(25);
    const [sort, setSort] = useState('hot');
    const [topTimeFrame, setTopTimeFrame] = useState('day');
    const [afterToken, setAfterToken] = useState(''); // Store the "after" token for pagination
    const [hasMorePosts, setHasMorePosts] = useState(false); // Flag to indicate if more posts can be loaded

    // Gallery State
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [galleryUrls, setGalleryUrls] = useState([]); // Array of {url, type, id, thumbnail}
    const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);
    const [gallerySelectedMedia, setGallerySelectedMedia] = useState([]); // Store selected gallery media items

    // Media Grid State
    const [gridSize, setGridSize] = useState(160);

    // Media Filter State
    const [mediaFilter, setMediaFilter] = useState('all'); // 'all', 'image', 'video'
    const [selectedPosts, setSelectedPosts] = useState(new Set());
    const [commentLimit, setCommentLimit] = useState(50);

    // Search Feature State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchScope, setSearchScope] = useState('subreddit');
    const [multipleSubreddits, setMultipleSubreddits] = useState('');
    const [searchSort, setSearchSort] = useState('relevance');
    const [searchTimeLimit, setSearchTimeLimit] = useState('all');

    // Access Token Management
    const accessTokenRef = useRef(null);
    const tokenExpiryRef = useRef(0);

    // Add a loading progress state
    const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });

    // Add state for back to top button visibility
    const [showBackToTop, setShowBackToTop] = useState(false);

    // --- Effects ---

    // Save credentials to localStorage
    useEffect(() => {
        localStorage.setItem('redditApiCredentials', JSON.stringify(credentials));
    }, [credentials]);

    // Handle scroll and show/hide back to top button
    useEffect(() => {
        const handleScroll = () => {
            // Show button when user scrolls down 300px from the top
            if (window.scrollY > 300) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll);

        // Remove scroll event listener on cleanup
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Scroll to top function
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // --- API Callbacks ---

    // Get Reddit Access Token
    const getAccessToken = useCallback(async () => {
        // Check if existing token is valid
        if (accessTokenRef.current && Date.now() < tokenExpiryRef.current) {
            return accessTokenRef.current;
        }

        const { clientId, clientSecret } = credentials;
        if (!clientId || !clientSecret) {
            throw new Error("Client ID and Secret are required.");
        }

        console.log('Fetching new Reddit access token...');
        const authString = `${clientId}:${clientSecret}`;
        let base64Auth;
        try {
            base64Auth = btoa(authString); // Standard encoding
        } catch (e) {
            console.error("Error encoding credentials:", e);
            throw new Error("Invalid Client ID or Secret format.");
        }

        try {
            const response = await fetch('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${base64Auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'ReactRedditScraper/3.0 by YourUsername', // Customize User-Agent
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
            // Set expiry slightly earlier (e.g., 5 minutes buffer) for safety
            tokenExpiryRef.current = Date.now() + (data.expires_in - 300) * 1000;
            console.log('Access token obtained successfully.');
            return accessTokenRef.current;

        } catch (err) {
            console.error('Access token error:', err);
            setError(`Access Token Error: ${err.message}`);
            accessTokenRef.current = null; // Invalidate token state
            tokenExpiryRef.current = 0;
            setShowAuthModal(true); // Prompt user to fix credentials
            throw err; // Re-throw to stop the calling function (fetchPosts/searchReddit)
        }
    }, [credentials]); // Re-run only if credentials change


    // Fetch Posts from a Subreddit
    const fetchPosts = useCallback(async (loadMore = false) => {
        const sub = subreddit.trim();
        if (!sub) { setError('Please enter a subreddit name.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 10 || numericLimit > 1000) { setError('Post limit must be between 10 and 1000.'); return; }

        if (!loadMore) {
            setIsLoading(true);
            setError('');
            setPosts([]);
            setSelectedPosts(new Set());
            setAfterToken(''); // Reset pagination token
            setHasMorePosts(false);
            setSearchQuery(''); // Clear search when fetching normally
            setLoadingProgress({ loaded: 0, total: numericLimit });
        } else {
            setIsLoading(true);
            setError('');
            setLoadingProgress({ loaded: 0, total: numericLimit });
        }

        console.log(`Fetching posts from r/${sub}, Sort: ${sort}, Limit: ${numericLimit}, Timeframe (if top): ${topTimeFrame}${loadMore ? ', After: ' + afterToken : ''}`);

        try {
            const accessToken = await getAccessToken();
            const baseRedditUrl = 'https://oauth.reddit.com'; // Use OAuth endpoint

            // Calculate remaining posts to fetch
            let remainingToFetch = loadMore ? numericLimit : numericLimit;
            let currentAfterToken = loadMore ? afterToken : '';
            let allNewPosts = [];

            // Reddit API has a maximum of 100 posts per request
            // Loop until we get the desired number of posts or there are no more posts
            while (remainingToFetch > 0 && (currentAfterToken !== null || allNewPosts.length === 0)) {
                // Calculate batch size (max 100 per API request)
                const batchSize = Math.min(remainingToFetch, 100);

                let apiUrl;
                const afterParam = currentAfterToken ? `&after=${currentAfterToken}` : '';

                if (sort === 'top' || sort === 'controversial') {
                    apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${batchSize}&t=${topTimeFrame}${afterParam}&raw_json=1`;
                } else {
                    apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${batchSize}${afterParam}&raw_json=1`;
                }

                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'User-Agent': 'ReactRedditScraper/3.0 by YourUsername',
                    }
                });

                if (!response.ok) {
                    let errorMsg = `API Error (${response.status})`;
                    try {
                        const errorData = await response.json();
                        console.error('Reddit API Error (Posts):', errorData);
                        if (response.status === 404) errorMsg = `Subreddit 'r/${sub}' not found or private.`;
                        else if (response.status === 403) errorMsg = `Access denied to 'r/${sub}' (private/quarantined?).`;
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
                const batchPosts = data.data.children.map(child => ({
                    ...child.data,
                    isExpanded: false,      // For long text expansion
                    comments: [],           // Store fetched comments
                    commentsLoading: false, // Loading state for *this* post's comments
                    showComments: false,    // Visibility state for *this* post's comments
                    commentsError: null     // Error state for *this* post's comments
                }));

                // Add this batch to our collection
                allNewPosts = [...allNewPosts, ...batchPosts];

                // Update progress
                setLoadingProgress(prev => ({
                    loaded: allNewPosts.length,
                    total: numericLimit
                }));

                // Update remaining count
                remainingToFetch -= batchPosts.length;

                // Update after token for next batch (if needed)
                currentAfterToken = data.data.after;

                // If no more posts are available or we've reached our limit, exit loop
                if (!currentAfterToken || batchPosts.length === 0) {
                    break;
                }

                // Optional: add a small delay between requests to avoid rate limiting
                if (remainingToFetch > 0) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // Store the last "after" token for pagination
            setAfterToken(currentAfterToken || '');
            setHasMorePosts(!!currentAfterToken);

            // Append new posts to existing ones if loading more
            setPosts(prevPosts => loadMore ? [...prevPosts, ...allNewPosts] : allNewPosts);

            console.log(`Fetched ${allNewPosts.length} posts. ${currentAfterToken ? 'More available.' : 'No more posts.'}`);

        } catch (err) {
            console.error("Fetch posts error:", err);
            // Avoid overwriting specific auth errors if they occurred
            if (!error || !error.startsWith('Access Token Error')) {
                setError(`Fetch failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
            setLoadingProgress({ loaded: 0, total: 0 }); // Reset progress
        }
    }, [subreddit, limit, sort, topTimeFrame, credentials, getAccessToken, error, afterToken]); // Include afterToken dependency


    // Search Reddit
    const searchReddit = useCallback(async (loadMore = false) => {
        const query = searchQuery.trim();
        if (!query) { setError('Please enter a search query.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 10 || numericLimit > 1000) { setError('Result limit must be between 10 and 1000.'); return; }

        let targetSubreddits = '';
        let restrictSr = false;
        if (searchScope === 'subreddit') {
            targetSubreddits = subreddit.trim();
            if (!targetSubreddits) { setError('Please enter a subreddit name to search within.'); return; }
            restrictSr = true; // Restrict search to this subreddit only
        } else if (searchScope === 'multiple') {
            targetSubreddits = multipleSubreddits.trim().split(',').map(s => s.trim()).filter(s => s).join('+');
            if (!targetSubreddits) { setError('Please enter at least one subreddit name for multiple search.'); return; }
            restrictSr = false; // Do not restrict_sr when searching multiple subs via /r/sub1+sub2/search
        } // 'all' scope uses the global search endpoint

        if (!loadMore) {
            setIsLoading(true);
            setError('');
            setPosts([]);
            setSelectedPosts(new Set());
            setAfterToken(''); // Reset pagination token
            setHasMorePosts(false);
            setLoadingProgress({ loaded: 0, total: numericLimit });
        } else {
            setIsLoading(true);
            setError('');
            setLoadingProgress({ loaded: 0, total: numericLimit });
        }

        console.log(`Searching Reddit. Scope: ${searchScope}, Query: "${query}", Sort: ${searchSort}, Limit: ${numericLimit}, Time: ${searchTimeLimit}${loadMore ? ', After: ' + afterToken : ''}`);

        try {
            const accessToken = await getAccessToken();
            const baseRedditUrl = 'https://oauth.reddit.com';
            const timeParam = searchTimeLimit !== 'all' ? `&t=${searchTimeLimit}` : '';
            const queryParam = `q=${encodeURIComponent(query)}`;
            const sortParam = `&sort=${searchSort}`;
            const rawJsonParam = '&raw_json=1';

            // Calculate remaining posts to fetch
            let remainingToFetch = loadMore ? numericLimit : numericLimit;
            let currentAfterToken = loadMore ? afterToken : '';
            let allSearchResults = [];

            // Loop until we get the desired number of posts or there are no more results
            while (remainingToFetch > 0 && (currentAfterToken !== null || allSearchResults.length === 0)) {
                // Calculate batch size (max 100 per API request)
                const batchSize = Math.min(remainingToFetch, 100);
                const limitParam = `&limit=${batchSize}`;
                const afterParam = currentAfterToken ? `&after=${currentAfterToken}` : '';
                let apiUrl;

                if (searchScope === 'subreddit') {
                    // Search within a specific subreddit
                    apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?${queryParam}&restrict_sr=1${limitParam}${sortParam}${timeParam}${afterParam}${rawJsonParam}`;
                } else if (searchScope === 'multiple') {
                    // Search within multiple subreddits (no restrict_sr needed here)
                    apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?${queryParam}${limitParam}${sortParam}${timeParam}${afterParam}${rawJsonParam}`;
                    // Note: The behavior of sort=relevance might differ across multiple subs vs global search
                } else { // searchScope === 'all'
                    // Search across all of Reddit
                    apiUrl = `${baseRedditUrl}/search?${queryParam}${limitParam}${sortParam}${timeParam}${afterParam}${rawJsonParam}`;
                }

                console.log("Search API URL:", apiUrl);

                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'User-Agent': 'ReactRedditScraper/3.0 by YourUsername',
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
                const batchResults = data.data.children.map(child => ({
                    ...child.data,
                    isExpanded: false,
                    comments: [],
                    commentsLoading: false,
                    showComments: false,
                    commentsError: null
                }));

                // Add this batch to our collection
                allSearchResults = [...allSearchResults, ...batchResults];

                // Update progress
                setLoadingProgress(prev => ({
                    loaded: allSearchResults.length,
                    total: numericLimit
                }));

                // Update remaining count
                remainingToFetch -= batchResults.length;

                // Update after token for next batch (if needed)
                currentAfterToken = data.data.after;

                // If no more posts are available or we've reached our limit, exit loop
                if (!currentAfterToken || batchResults.length === 0) {
                    break;
                }

                // Optional: add a small delay between requests to avoid rate limiting
                if (remainingToFetch > 0) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // Store the last "after" token for pagination
            setAfterToken(currentAfterToken || '');
            setHasMorePosts(!!currentAfterToken);

            // Append new posts to existing ones if loading more
            setPosts(prevPosts => loadMore ? [...prevPosts, ...allSearchResults] : allSearchResults);

            console.log(`Found ${allSearchResults.length} search results. ${currentAfterToken ? 'More available.' : 'No more results.'}`);

        } catch (err) {
            console.error("Search error:", err);
            if (!error || !error.startsWith('Access Token Error')) {
                setError(`Search failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
            setLoadingProgress({ loaded: 0, total: 0 }); // Reset progress
        }
    }, [searchQuery, limit, searchScope, subreddit, multipleSubreddits, searchSort, searchTimeLimit, credentials, getAccessToken, error, afterToken]);


    // --- Media Info Helper (Memoized) ---
    const getMediaInfo = useCallback((post) => {
        if (!post) return null;

        try {
            const cleanUrl = (url) => url ? url.replace(/&amp;/g, '&') : null;

            // 1. Reddit Galleries
            if (post.is_gallery && post.gallery_data?.items?.length > 0 && post.media_metadata) {
                const galleryItems = post.gallery_data.items.map(item => {
                    const metadata = post.media_metadata[item.media_id];
                    if (!metadata || metadata.status !== 'valid') return null;

                    let bestUrl = null;
                    let type = 'image'; // Default
                    let thumbnailUrl = null;

                    // Try finding highest quality MP4 or image URL
                    if (metadata.s) { // Source object
                        if (metadata.s.mp4) { bestUrl = metadata.s.mp4; type = 'video'; }
                        else if (metadata.s.gif) { bestUrl = metadata.s.gif; type = 'image'; } // Treat GIF as image
                        else if (metadata.s.u) { bestUrl = metadata.s.u; type = 'image'; }
                    }

                    // Fallback to highest resolution preview if no source URL found
                    if (!bestUrl && metadata.p?.length > 0) {
                        bestUrl = metadata.p[metadata.p.length - 1].u;
                        type = 'image'; // Previews are images
                    }

                    // Extract thumbnail (use smallest preview or the main URL)
                    if (metadata.p?.length > 0) thumbnailUrl = metadata.p[0].u;
                    else if (metadata.t) thumbnailUrl = metadata.t; // Check for 't' thumbnail property
                    else thumbnailUrl = bestUrl; // Fallback to the main URL

                    if (!bestUrl) return null; // Skip if no valid URL

                    return {
                        id: metadata.id || item.media_id, // Use metadata ID or gallery item ID
                        url: cleanUrl(bestUrl),
                        thumbnail: cleanUrl(thumbnailUrl),
                        type: type
                    };
                }).filter(Boolean); // Filter out nulls

                if (galleryItems.length > 0) {
                    return {
                        url: cleanUrl(post.url), // Link to the gallery post itself
                        type: 'gallery',
                        items: galleryItems
                    };
                }
            }

            // 2. Videos (Reddit Hosted, Rich Embed Preview, Direct Link)
            let videoUrl = null;
            let videoThumbnail = cleanUrl(post.thumbnail);
            if (videoThumbnail === 'default' || videoThumbnail === 'self' || videoThumbnail === 'nsfw') videoThumbnail = null;

            if (post.is_video && post.media?.reddit_video) {
                videoUrl = post.media.reddit_video.fallback_url;
                videoThumbnail = videoThumbnail || cleanUrl(post.preview?.images?.[0]?.source?.url); // Use preview image if thumb missing
            } else if (post.post_hint === 'hosted:video' && post.media?.reddit_video) {
                videoUrl = post.media.reddit_video.fallback_url;
                videoThumbnail = videoThumbnail || cleanUrl(post.preview?.images?.[0]?.source?.url);
            } else if (post.post_hint === 'rich:video' && post.preview?.reddit_video_preview) {
                videoUrl = post.preview.reddit_video_preview.fallback_url; // Often lower quality
                videoThumbnail = videoThumbnail || cleanUrl(post.preview?.images?.[0]?.source?.url);
            } else if (/\.(mp4|mov|webm)$/i.test(post.url_overridden_by_dest || post.url)) {
                videoUrl = post.url_overridden_by_dest || post.url;
                videoThumbnail = videoThumbnail || cleanUrl(post.preview?.images?.[0]?.source?.url);
            }

            if (videoUrl) {
                const finalUrl = cleanUrl(videoUrl);
                // Attempt to get a better thumbnail if the default one is bad
                const finalThumbnail = videoThumbnail || cleanUrl(post.preview?.images?.[0]?.resolutions?.slice(-1)[0]?.url) || cleanUrl(post.preview?.images?.[0]?.source?.url) || finalUrl;
                return {
                    url: finalUrl,
                    type: 'video',
                    items: [{ id: post.id + '_video', url: finalUrl, thumbnail: finalThumbnail, type: 'video' }]
                };
            }

            // 3. Single Images (Hint, Direct Link, Preview Fallback)
            let imageUrl = null;
            let imageThumbnail = cleanUrl(post.thumbnail);
            if (imageThumbnail === 'default' || imageThumbnail === 'self' || imageThumbnail === 'nsfw') imageThumbnail = null;

            // Prefer direct URL or overridden URL if hint is image
            if (post.post_hint === 'image') {
                imageUrl = post.url_overridden_by_dest || post.url;
            }
            // Check URLs even without hint
            else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(post.url_overridden_by_dest || post.url)) {
                imageUrl = post.url_overridden_by_dest || post.url;
            }
            // Fallback to high-res preview image if available
            else if (post.preview?.images?.[0]?.source?.url) {
                const previewUrl = cleanUrl(post.preview.images[0].source.url);
                // Ensure the preview URL itself looks like an image file
                if (/\.(jpg|jpeg|png|gif|webp)$/i.test(previewUrl)) {
                    imageUrl = previewUrl;
                }
            }

            if (imageUrl) {
                const finalUrl = cleanUrl(imageUrl);
                // Try to get a better thumbnail, fallback to the image itself
                const finalThumbnail = imageThumbnail || cleanUrl(post.preview?.images?.[0]?.resolutions?.[0]?.url) || finalUrl;
                return {
                    url: finalUrl,
                    type: 'image',
                    items: [{ id: post.id + '_image', url: finalUrl, thumbnail: finalThumbnail, type: 'image' }]
                };
            }

            // 4. No specific media type identified
            return null;

        } catch (err) {
            console.error(`Error processing media for post ${post?.id}:`, err, post);
            return null; // Return null on error
        }
    }, []); // No dependencies, self-contained based on 'post' argument


    // --- Derived State (Filtered Posts) ---
    const displayedPosts = useMemo(() => {
        console.log("Filtering posts. Current filter:", mediaFilter);
        if (mediaFilter === 'all') {
            return posts; // Show all fetched posts
        }
        return posts.filter(post => {
            const mediaInfo = getMediaInfo(post);
            if (!mediaInfo || !mediaInfo.items || mediaInfo.items.length === 0) return false;

            // Filter logic:
            // 'image' filter includes single images AND galleries
            // 'video' filter includes only single videos
            if (mediaFilter === 'image' && (mediaInfo.type === 'image' || mediaInfo.type === 'gallery')) {
                return true;
            }
            if (mediaFilter === 'video' && mediaInfo.type === 'video') {
                return true;
            }
            return false; // Doesn't match active filter
        });
    }, [posts, mediaFilter, getMediaInfo]);


    // --- UI Callbacks & Handlers ---

    // Select/Deselect a single post
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
    }, []);

    // Select all currently visible/displayed posts
    const handleSelectAllDisplayed = useCallback(() => {
        setSelectedPosts(new Set(displayedPosts.map(post => post.id)));
        console.log(`Selected ${displayedPosts.length} displayed posts.`);
    }, [displayedPosts]);

    // Deselect all posts
    const handleDeselectAll = useCallback(() => {
        setSelectedPosts(new Set());
        console.log("Deselected all posts.");
    }, []);

    // Toggle text expansion for a post
    const toggleExpand = useCallback((postId) => {
        setPosts(prevPosts => prevPosts.map(p =>
            p.id === postId ? { ...p, isExpanded: !p.isExpanded } : p
        ));
    }, []);

    // Open the gallery modal
    const openGallery = useCallback((mediaInfo, index = 0) => {
        if (!mediaInfo?.items || mediaInfo.items.length === 0) {
            console.warn("Attempted to open gallery with no items:", mediaInfo);
            setError("Could not open media gallery - no items found.");
            return;
        }
        console.log(`Opening gallery: ${mediaInfo.items.length} items, start index ${index}`);
        setGalleryUrls(mediaInfo.items); // Set the items for the modal
        setInitialGalleryIndex(index);   // Set the starting image/video
        setShowGalleryModal(true);       // Show the modal

        // Reset gallery selections when opening a new gallery
        setGallerySelectedMedia([]);
    }, []);

    // Handle media selection from the gallery modal
    const handleGalleryMediaSelect = useCallback((selectedMediaItems) => {
        console.log(`Gallery media selection updated: ${selectedMediaItems.length} items selected`);
        setGallerySelectedMedia(selectedMediaItems);
    }, []);

    // Add selected gallery media to download selection
    const addGallerySelectionToDownload = useCallback(() => {
        if (gallerySelectedMedia.length === 0) {
            alert("No media items selected in the gallery. Hold Shift + Click to select items.");
            return;
        }

        // Find posts that contain the selected media URLs
        const mediaUrls = new Set(gallerySelectedMedia.map(item => item.url));
        const postsToAdd = posts.filter(post => {
            const mediaInfo = getMediaInfo(post);
            if (mediaInfo?.type === 'gallery' && mediaInfo?.items) {
                // Check if any of the gallery items match our selected URLs
                return mediaInfo.items.some(item => mediaUrls.has(item.url));
            }
            return false;
        });

        if (postsToAdd.length === 0) {
            alert("Could not find posts containing the selected media items.");
            return;
        }

        // Add the post IDs to the selected posts set
        setSelectedPosts(prev => {
            const newSelection = new Set(prev);
            postsToAdd.forEach(post => newSelection.add(post.id));
            return newSelection;
        });

        console.log(`Added ${postsToAdd.length} posts containing selected gallery media to download selection`);
        setShowGalleryModal(false); // Close the gallery modal
        setGallerySelectedMedia([]); // Clear gallery selection
    }, [gallerySelectedMedia, posts, getMediaInfo]);

    // Fetch Comments for a Single Post
    const fetchCommentsForPost = useCallback(async (postId) => {
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) {
            console.warn(`Post ${postId} not found in state for fetching comments.`);
            return;
        }
        const currentPost = posts[postIndex];

        // If already loading, do nothing
        if (currentPost.commentsLoading) return;

        // Toggle visibility if comments are loaded and not showing, or if currently showing
        if (currentPost.comments.length > 0 || currentPost.commentsError) {
            if (!currentPost.showComments) {
                console.log(`Showing existing comments/error for post ${postId}`);
            } else {
                console.log(`Hiding comments for post ${postId}`);
            }
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                updatedPosts[postIndex] = { ...currentPost, showComments: !currentPost.showComments };
                return updatedPosts;
            });
            // If comments were already loaded OR there was an error, don't re-fetch unless forced
            if (currentPost.comments.length > 0 || currentPost.commentsError) return;
        }

        // If commentLimit is 0, don't fetch, just show disabled state
        if (commentLimit === 0) {
            console.log(`Comment limit is 0, skipping fetch for post ${postId}`);
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                updatedPosts[postIndex] = { ...currentPost, commentsError: "Comment fetching disabled (limit 0)", showComments: true };
                return updatedPosts;
            });
            return;
        }

        console.log(`Fetching comments for post ${postId} (Sub: ${currentPost.subreddit}, Limit: ${commentLimit})`);
        setPosts(prevPosts => {
            const updatedPosts = [...prevPosts];
            updatedPosts[postIndex] = { ...currentPost, commentsLoading: true, commentsError: null, showComments: true }; // Show loading state
            return updatedPosts;
        });

        try {
            const accessToken = await getAccessToken();
            const shortId = postId.startsWith('t3_') ? postId.substring(3) : postId;
            const postSubreddit = currentPost.subreddit;
            if (!postSubreddit) throw new Error("Subreddit name missing in post data.");

            // API URL for comments
            const commentApiUrl = `https://oauth.reddit.com/r/${postSubreddit}/comments/${shortId}?limit=${commentLimit}&depth=1&sort=confidence&raw_json=1`;

            const response = await fetch(commentApiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'ReactRedditScraper/3.0 by YourUsername',
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

            // Validate structure: [post_data, comment_data]
            if (!Array.isArray(commentData) || commentData.length < 2 || !commentData[1]?.data?.children) {
                // Handle valid empty comments case
                if (commentData?.[1]?.data?.children?.length === 0) {
                    console.log(`No comments found for post ${postId}.`);
                    setPosts(prevPosts => {
                        const updatedPosts = [...prevPosts];
                        // Ensure index is still valid
                        if (updatedPosts[postIndex]?.id === postId) {
                            updatedPosts[postIndex] = { ...updatedPosts[postIndex], comments: [], commentsLoading: false, showComments: true, commentsError: null };
                        }
                        return updatedPosts;
                    });
                    return; // Success (no comments)
                }
                // Otherwise, structure is unexpected
                console.error('Unexpected comment data structure:', commentData);
                throw new Error('Unexpected comment data structure from Reddit.');
            }

            // Extract and clean comments (top-level only due to depth=1)
            const fetchedComments = commentData[1].data.children
                .map(child => child.data)
                // Filter out deleted users/removed comments/stickied moderator comments
                .filter(c => c && c.author && c.body && c.author !== '[deleted]' && c.body !== '[removed]' && !c.stickied);

            console.log(`Fetched ${fetchedComments.length} comments for post ${postId}`);
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                if (updatedPosts[postIndex]?.id === postId) { // Ensure we update the right post
                    updatedPosts[postIndex] = {
                        ...updatedPosts[postIndex],
                        comments: fetchedComments,
                        commentsLoading: false,
                        showComments: true, // Keep open after loading
                        commentsError: null // Clear previous errors
                    };
                }
                return updatedPosts;
            });

        } catch (err) {
            console.error(`Failed to fetch comments for post ${postId}:`, err);
            setPosts(prevPosts => {
                const updatedPosts = [...prevPosts];
                if (updatedPosts[postIndex]?.id === postId) {
                    updatedPosts[postIndex] = {
                        ...updatedPosts[postIndex],
                        commentsLoading: false,
                        commentsError: err.message || 'Failed to load.',
                        showComments: true // Keep section open to show the error
                    };
                }
                return updatedPosts;
            });
        }
    }, [posts, commentLimit, getAccessToken]); // Dependencies


    // Batch Fetch Comments for Selected Posts
    const fetchSelectedComments = useCallback(async () => {
        const postsToFetch = Array.from(selectedPosts);
        if (postsToFetch.length === 0) { alert("No posts selected."); return; }
        if (isLoading || isCommentsLoading || isMediaDownloading) return; // Prevent concurrent ops
        if (commentLimit === 0) { alert("Comment fetching disabled (limit 0)."); return; }

        setError('');
        setIsCommentsLoading(true); // Set global batch loading state
        console.log(`Starting batch comment fetch for ${postsToFetch.length} selected posts...`);

        // Use Promise.allSettled to fetch all, regardless of individual failures
        const results = await Promise.allSettled(
            postsToFetch.map(postId => fetchCommentsForPost(postId))
        );

        // Log any rejections from the batch
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Batch comment fetch failed for post ${postsToFetch[index]}:`, result.reason);
                // Error state is already handled within fetchCommentsForPost for the specific post
            }
        });

        console.log(`Batch comment fetch finished.`);
        setIsCommentsLoading(false); // Clear global batch loading state
    }, [selectedPosts, isLoading, isCommentsLoading, isMediaDownloading, commentLimit, fetchCommentsForPost]);


    // Download Cleaned JSON Data
    const downloadJson = useCallback(() => {
        const postsToDownload = selectedPosts.size > 0
            ? posts.filter(p => selectedPosts.has(p.id)) // Selected posts
            : displayedPosts; // Or currently displayed/filtered posts

        if (postsToDownload.length === 0) {
            alert("No posts selected or displayed to download.");
            return;
        }

        console.log(`Preparing JSON download for ${postsToDownload.length} posts.`);

        try {
            const cleanedPosts = postsToDownload.map(post => ({
                id: post.id,
                title: post.title,
                author: post.author,
                subreddit: post.subreddit,
                created_utc: post.created_utc,
                score: post.score,
                upvote_ratio: post.upvote_ratio,
                num_comments_api: post.num_comments, // Original count from API
                num_comments_fetched: post.comments?.length ?? 0, // Actual fetched count
                permalink: `https://reddit.com${post.permalink}`,
                url: post.url_overridden_by_dest || post.url,
                is_self: post.is_self,
                selftext: post.is_self ? post.selftext : null,
                link_flair_text: post.link_flair_text || null,
                post_hint: post.post_hint || null,
                media_info: getMediaInfo(post), // Include processed media info
                comments: post.comments?.map(comment => ({ // Include fetched comments
                    id: comment.id,
                    author: comment.author,
                    created_utc: comment.created_utc,
                    score: comment.score,
                    body: comment.body,
                    is_submitter: comment.is_submitter || false,
                    permalink: `https://reddit.com${comment.permalink}`
                })) ?? [] // Ensure comments is always an array
            }));

            const dataToSave = {
                source_details: {
                    type: searchQuery ? 'search' : 'subreddit_fetch',
                    subreddit: subreddit || null,
                    multiple_subreddits: searchScope === 'multiple' ? multipleSubreddits : null,
                    scope: searchQuery ? searchScope : null,
                    query: searchQuery || null,
                },
                fetch_parameters: {
                    sort: searchQuery ? searchSort : sort,
                    time_filter: searchQuery ? searchTimeLimit : (sort === 'top' || sort === 'controversial' ? topTimeFrame : null),
                    post_limit_requested: limit,
                    comment_limit_per_post: commentLimit,
                },
                export_details: {
                    media_filter_active: mediaFilter,
                    exported_content: selectedPosts.size > 0 ? 'selected_posts' : 'displayed_posts',
                    timestamp: new Date().toISOString(),
                    post_count: cleanedPosts.length,
                },
                posts: cleanedPosts
            };

            const jsonString = JSON.stringify(dataToSave, null, 2); // Pretty print
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sourceName = (subreddit || multipleSubreddits || 'reddit_search').replace(/[^a-zA-Z0-9_+]/g, '_');
            const type = selectedPosts.size > 0 ? 'selected' : 'displayed';
            a.download = `reddit_export_${sourceName}_${type}_${timestamp}.json`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            console.log("JSON download initiated.");

        } catch (err) {
            console.error("Failed to create or download JSON:", err);
            setError("Failed to prepare JSON data for download. See console.");
        }
    }, [posts, displayedPosts, selectedPosts, subreddit, multipleSubreddits, searchQuery, searchScope, sort, searchSort, topTimeFrame, searchTimeLimit, mediaFilter, limit, commentLimit, getMediaInfo]);


    // Download Selected Media as ZIP
    const downloadSelectedMedia = useCallback(async () => {
        if (selectedPosts.size === 0) { alert("No posts selected for media download."); return; }
        if (typeof JSZip === 'undefined') {
            setError("JSZip library not found. Cannot create ZIP archive.");
            console.error("JSZip is required for media download.");
            return;
        }
        if (isMediaDownloading) return; // Prevent simultaneous downloads

        setIsMediaDownloading(true); setError('');
        console.log(`Preparing media download for ${selectedPosts.size} selected posts...`);

        const zip = new JSZip();
        const mediaToFetch = [];
        const fetchErrors = [];

        // 1. Collect all media items from selected posts
        posts.forEach(post => {
            if (selectedPosts.has(post.id)) {
                const mediaInfo = getMediaInfo(post);
                if (mediaInfo?.items?.length > 0) {
                    mediaInfo.items.forEach((item, index) => {
                        if (item.url && (item.type === 'image' || item.type === 'video')) {
                            try {
                                const url = new URL(item.url); // Validate URL structure
                                const pathParts = url.pathname.split('/');
                                let baseFilename = pathParts[pathParts.length - 1] || `${post.id}_item_${index}`;
                                baseFilename = baseFilename.split('?')[0].replace(/[^a-zA-Z0-9_.-]/g, '_'); // Sanitize
                                const extension = baseFilename.includes('.') ? '' : (item.type === 'video' ? '.mp4' : '.jpg'); // Default extension
                                const filename = `${post.subreddit}_${post.id}_${index}_${baseFilename}${extension}`; // More descriptive filename

                                mediaToFetch.push({ url: item.url, filename: filename, postId: post.id });
                            } catch (urlError) {
                                console.warn(`Skipping invalid media URL (${post.id}): ${item.url}`, urlError);
                                fetchErrors.push(`Invalid URL (${post.id}): ${item.url.substring(0, 50)}...`);
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

        // 2. Fetch media files (concurrently with Promise.allSettled)
        // WARNING: CORS issues are highly likely for many external domains.
        // This works best for i.redd.it, v.redd.it. Others may fail.
        const fetchPromises = mediaToFetch.map(async (media) => {
            try {
                // console.log(`Fetching: ${media.url}`); // Can be verbose
                // Using 'no-cors' mode might allow fetching but gives an opaque response (blob size 0)
                // which isn't useful for saving. Standard fetch relies on server CORS headers.
                const response = await fetch(media.url /*, { mode: 'cors' } */);

                if (!response.ok) {
                    // Try fetching via a CORS proxy if direct fetch fails? (Requires setting up a proxy)
                    // Example: const proxyUrl = `https://cors-anywhere.herokuapp.com/${media.url}`;
                    // const response = await fetch(proxyUrl);
                    // if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} for ${media.filename}`);
                    // }
                }

                const blob = await response.blob();
                if (blob.size === 0) {
                    console.warn(`Fetched empty blob for ${media.filename} (URL: ${media.url}) - Possibly CORS issue or empty file.`);
                    // throw new Error(`Empty file received (check CORS)`); // Optional: treat as error
                }

                zip.file(media.filename, blob, { binary: true });
                successCount++;
                return { status: 'fulfilled', filename: media.filename };

            } catch (fetchError) {
                console.error(`Failed: ${media.filename} (URL: ${media.url.substring(0, 60)}...):`, fetchError);
                fetchErrors.push(`Failed (${media.postId}): ${media.filename} - ${fetchError.message}`);
                // Add error placeholder to zip
                zip.file(`${media.filename}_FETCH_ERROR.txt`, `Failed to download:\nURL: ${media.url}\nError: ${fetchError.message}\n\nPossible causes: CORS restriction, network error, invalid link.`);
                return { status: 'rejected', filename: media.filename, reason: fetchError.message };
            }
        });

        // Wait for all fetches to complete or fail
        await Promise.allSettled(fetchPromises);

        console.log(`Media fetching complete. Success: ${successCount}, Failed: ${fetchErrors.length}`);

        // 3. Add error log if necessary
        if (fetchErrors.length > 0) {
            const errorLogContent = `Media Download Report (${new Date().toISOString()})\n\n`
                + `Total Files Attempted: ${mediaToFetch.length}\n`
                + `Successfully Added: ${successCount}\n`
                + `Failed: ${fetchErrors.length}\n\n`
                + `Errors:\n-------\n${fetchErrors.join('\n')}\n\n`
                + `Note: Failures are often due to Cross-Origin Resource Sharing (CORS) restrictions `
                + `set by the website hosting the media. Direct browser fetching might be blocked. `
                + `Other causes include network issues or broken links.`;
            zip.file('_DOWNLOAD_ERRORS.txt', errorLogContent);
            setError(`Note: ${fetchErrors.length} media file(s) failed to download. Check _DOWNLOAD_ERRORS.txt in the ZIP.`);
        }

        // 4. Generate and Trigger ZIP Download (if any files added or errors occurred)
        if (successCount > 0 || fetchErrors.length > 0) {
            try {
                console.log("Generating ZIP file...");
                const zipBlob = await zip.generateAsync(
                    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
                    (metadata) => { // Progress callback
                        // Update UI with metadata.percent if desired
                        // console.log(`Zipping progress: ${metadata.percent.toFixed(1)}%`);
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
        } else {
            console.log("No media successfully downloaded, ZIP not generated.");
            if (fetchErrors.length === 0) alert("No downloadable media found in selection."); // Should have been caught earlier
        }

        setIsMediaDownloading(false);
    }, [posts, selectedPosts, getMediaInfo, subreddit, multipleSubreddits, isMediaDownloading]); // Dependencies


    // --- Inline Component for Instagram-Style Media in Post Card ---
    // Kept here as it's tightly coupled with post data and openGallery callback
    const InstagramMediaDisplay = ({ mediaInfo, post }) => {
        if (!mediaInfo?.items || mediaInfo.items.length === 0) return null;

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
                </div>

                {/* Media Area - Click opens gallery */}
                <div className="instagram-post-media" onClick={() => openGallery(mediaInfo, 0)} title="Click to view full media / gallery">
                    <div className={hasMultiple ? "instagram-post-carousel" : "instagram-post-single"}>
                        {firstItem.type === 'video' ? (
                            <div className="instagram-post-video-container">
                                <video src={firstItem.url} muted loop playsInline>Video not supported</video>
                                <div className="instagram-post-video-icon" title="Video">▶</div>
                            </div>
                        ) : (
                            // Use thumbnail for potentially faster loading in the card itself
                            <img src={firstItem.thumbnail || firstItem.url} alt={post.title} loading="lazy" />
                        )}
                        {/* Multiple items indicator */}
                        {hasMultiple && (
                            <div className="instagram-post-carousel-indicator">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                                    <path d="M3 1.5A1.5 1.5 0 0 0 1.5 3v10A1.5 1.5 0 0 0 3 14.5h10a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 13 1.5H3zM1.5 2a.5.5 0 0 1 .5-.5H3a.5.5 0 0 1 0 1H2a.5.5 0 0 1-.5-.5zm13 .5a.5.5 0 0 1-.5.5H13a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5zM2 13.5a.5.5 0 0 1-.5.5V13a.5.5 0 0 1 .5.5zm11.5-.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5-.5z" />
                                    <path d="M12.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h9z" />
                                </svg>
                                {mediaInfo.items.length} items
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions (Placeholders) */}
                <div className="instagram-post-actions">
                    <div title="Upvote (placeholder)">♥</div>
                    <div title="Comments (placeholder)">💬</div>
                    <div title="Share (placeholder)">📤</div>
                    <div className="instagram-post-save" title="Save (placeholder)">🔖</div>
                </div>

                {/* Info Section */}
                <div className="instagram-post-info">
                    <div className="instagram-post-likes">{post.score?.toLocaleString() || 0} upvotes</div>
                    <div className="instagram-post-caption">
                        <a href={`https://reddit.com/u/${post.author}`} target="_blank" rel="noopener noreferrer" className="instagram-post-caption-username">
                            {post.author}
                        </a>
                        <span className="instagram-post-caption-text"> {post.title}</span>
                    </div>
                    {/* Link to Reddit comments */}
                    <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer" className="instagram-post-comments-count" title="View comments on Reddit">
                        View {post.num_comments?.toLocaleString() || 0} comments
                    </a>
                    <div className="instagram-post-time">{formatTime(post.created_utc)}</div>
                </div>
            </div>
        );
    };

    // --- Render ---
    return (
        <div className="container">
            {/* --- Modals --- */}
            {showAuthModal && (
                <div className="modal" onClick={() => setShowAuthModal(false)}>
                    <div className="modal-content auth-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAuthModal(false)} title="Close">×</button>
                        <h3>Reddit API Credentials</h3>
                        <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                            Required for API access. Create a 'script' type app at <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer">Reddit Apps</a>.
                        </p>
                        <div style={{ margin: '20px 0' }}>
                            <div className="control-group">
                                <label htmlFor="clientId">Client ID <span>*</span></label>
                                <input
                                    id="clientId"
                                    value={credentials.clientId}
                                    onChange={(e) => setCredentials(c => ({ ...c, clientId: e.target.value.trim() }))}
                                    placeholder="Enter Reddit Client ID"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="control-group" style={{ marginTop: '15px' }}>
                                <label htmlFor="clientSecret">Client Secret <span>*</span></label>
                                <input
                                    id="clientSecret"
                                    type="password"
                                    value={credentials.clientSecret}
                                    onChange={(e) => setCredentials(c => ({ ...c, clientSecret: e.target.value.trim() }))}
                                    placeholder="Enter Reddit Client Secret"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                            <button className="ghost-btn" onClick={() => setShowAuthModal(false)}>Cancel</button>
                            <button
                                onClick={() => {
                                    if (credentials.clientId && credentials.clientSecret) {
                                        setShowAuthModal(false);
                                        setError(''); // Clear previous errors
                                        accessTokenRef.current = null; // Force token refresh
                                        tokenExpiryRef.current = 0;
                                        console.log("Credentials saved.");
                                    } else {
                                        alert('Please enter both Client ID and Client Secret.');
                                    }
                                }}
                                disabled={!credentials.clientId || !credentials.clientSecret}
                            >
                                Save Credentials
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGalleryModal && (
                <GalleryModal
                    galleryUrls={galleryUrls}
                    initialIndex={initialGalleryIndex}
                    onClose={() => setShowGalleryModal(false)}
                    onMediaSelect={handleGalleryMediaSelect}
                />
            )}

            {/* Add button to add selected gallery items to download selection */}
            {showGalleryModal && gallerySelectedMedia.length > 0 && (
                <div className="gallery-selection-action">
                    <button
                        className="add-gallery-selection-btn"
                        onClick={addGallerySelectionToDownload}
                    >
                        Add {gallerySelectedMedia.length} selected items to download ({selectedPosts.size} posts selected)
                    </button>
                </div>
            )}

            {/* --- Main Controls Card --- */}
            <div className="card main-controls">
                {/* App Header with API Config Button */}
                <div className="app-header">
                    <div className="app-title">
                        <h2>Reddit Content Scraper</h2>
                        <span className="app-subtitle">Browse, search, and download media from Reddit</span>
                    </div>
                    <button className="api-config-btn" onClick={() => setShowAuthModal(true)} disabled={isLoading || isCommentsLoading || isMediaDownloading} title="Edit API Credentials">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                        </svg>
                        API Settings
                    </button>
                </div>

                {/* Content Filter Tabs */}
                <div className="content-filter-tabs">
                    {['all', 'image', 'video'].map(filterValue => (
                        <button
                            key={filterValue}
                            className={`filter-tab ${mediaFilter === filterValue ? 'active' : ''}`}
                            onClick={() => setMediaFilter(filterValue)}
                            disabled={isLoading || isCommentsLoading || isMediaDownloading}
                        >
                            {filterValue === 'all' ? (
                                <><span className="icon">📋</span> All Posts</>
                            ) : filterValue === 'image' ? (
                                <><span className="icon">🖼️</span> Images & Galleries</>
                            ) : (
                                <><span className="icon">🎬</span> Videos</>
                            )}
                        </button>
                    ))}
                    <div className="count-badge">
                        {posts.length > 0 ? `${displayedPosts.length}/${posts.length}` : '0/0'}
                    </div>
                </div>

                {/* Main Input Area */}
                <div className="input-area">
                    <div className="input-tabs">
                        <button className={`input-tab ${!searchQuery ? 'active' : ''}`} onClick={() => setSearchQuery('')}>
                            Browse Subreddit
                        </button>
                        <button className={`input-tab ${searchQuery ? 'active' : ''}`} onClick={() => searchQuery ? null : setSearchQuery(' ')}>
                            Search Reddit
                        </button>
                    </div>

                    {/* Conditional rendering based on active tab */}
                    <div className="input-panel">
                        {!searchQuery ? (
                            /* Subreddit Fetch Panel */
                            <div className="subreddit-panel">
                                <div className="main-input-row">
                                    <div className="subreddit-input-group">
                                        <div className="input-prefix">r/</div>
                                        <input
                                            className="main-input"
                                            value={subreddit}
                                            onChange={(e) => setSubreddit(e.target.value.replace(/r\/|\s/g, ''))}
                                            placeholder="Enter subreddit name"
                                            onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
                                            disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                            autoFocus
                                        />
                                    </div>

                                    <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                        <option value="hot">🔥 Hot</option>
                                        <option value="new">🆕 New</option>
                                        <option value="top">⭐ Top</option>
                                        <option value="controversial">⚔️ Controversial</option>
                                        <option value="rising">📈 Rising</option>
                                    </select>

                                    {(sort === 'top' || sort === 'controversial') && (
                                        <select value={topTimeFrame} onChange={(e) => setTopTimeFrame(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                            <option value="hour">Last Hour</option>
                                            <option value="day">Today</option>
                                            <option value="week">This Week</option>
                                            <option value="month">This Month</option>
                                            <option value="year">This Year</option>
                                            <option value="all">All Time</option>
                                        </select>
                                    )}

                                    <div className="limit-input-group">
                                        <input
                                            type="number"
                                            value={limit}
                                            onChange={(e) => setLimit(Math.max(10, Math.min(1000, parseInt(e.target.value, 10) || 10)))}
                                            min="10" max="1000" step="10"
                                            onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
                                            disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                            title="Set number of posts to fetch (10-1000). Values over 100 will be retrieved in batches automatically."
                                        />
                                        <span className="limit-label" title="Set number of posts to fetch (10-1000). Values over 100 will be retrieved in batches automatically.">posts (10-1000)</span>
                                    </div>

                                    <button
                                        className={`fetch-button ${isLoading && !searchQuery ? 'loading' : ''}`}
                                        onClick={fetchPosts}
                                        disabled={isLoading || isCommentsLoading || isMediaDownloading || !subreddit.trim()}
                                    >
                                        {isLoading && !searchQuery ? (
                                            <>
                                                <span className="spinner"></span>
                                                {loadingProgress.loaded > 0 ? `Loading ${loadingProgress.loaded}/${loadingProgress.total}...` : 'Loading...'}
                                                {loadingProgress.loaded > 0 && (
                                                    <div className="loading-progress-container">
                                                        <div className="loading-progress-bar" style={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}></div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>Fetch Posts</>
                                        )}
                                    </button>
                                </div>

                                <div className="extra-options">
                                    <div className="comment-option">
                                        <label>Comments:</label>
                                        <select value={commentLimit} onChange={(e) => setCommentLimit(Number(e.target.value))} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                            <option value="0">None</option>
                                            <option value="20">Top 20</option>
                                            <option value="50">Top 50</option>
                                            <option value="100">Top 100</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Search Panel */
                            <div className="search-panel">
                                <div className="main-input-row">
                                    <input
                                        className="search-input"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Enter search terms..."
                                        onKeyDown={(e) => e.key === 'Enter' && searchReddit()}
                                        disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                    />

                                    <select className="scope-select" value={searchScope} onChange={(e) => setSearchScope(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                        <option value="subreddit">In r/{subreddit || '...'}</option>
                                        <option value="multiple">Multiple Subreddits</option>
                                        <option value="all">All of Reddit</option>
                                    </select>

                                    <button
                                        className={`search-button ${isLoading && searchQuery ? 'loading' : ''}`}
                                        onClick={searchReddit}
                                        disabled={isLoading || isCommentsLoading || isMediaDownloading || !searchQuery.trim() || (searchScope === 'subreddit' && !subreddit.trim()) || (searchScope === 'multiple' && !multipleSubreddits.trim().split(',').map(s => s.trim()).filter(s => s).length)}
                                    >
                                        {isLoading && searchQuery ? (
                                            <>
                                                <span className="spinner"></span>
                                                {loadingProgress.loaded > 0 ? `Searching ${loadingProgress.loaded}/${loadingProgress.total}...` : 'Searching...'}
                                                {loadingProgress.loaded > 0 && (
                                                    <div className="loading-progress-container">
                                                        <div className="loading-progress-bar" style={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}></div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>🔍 Search</>
                                        )}
                                    </button>
                                </div>

                                {searchScope === 'multiple' && (
                                    <div className="multi-sub-row">
                                        <input
                                            className="multi-sub-input"
                                            value={multipleSubreddits}
                                            onChange={(e) => setMultipleSubreddits(e.target.value)}
                                            placeholder="Comma-separated subreddits: pics, aww, dataisbeautiful..."
                                            onKeyDown={(e) => e.key === 'Enter' && searchReddit()}
                                            disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                        />
                                    </div>
                                )}

                                <div className="search-options">
                                    <div className="search-option">
                                        <label>Sort:</label>
                                        <select value={searchSort} onChange={(e) => setSearchSort(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                            <option value="relevance">Relevance</option>
                                            <option value="hot">Hot</option>
                                            <option value="new">New</option>
                                            <option value="top">Top</option>
                                            <option value="comments">Most Comments</option>
                                        </select>
                                    </div>

                                    <div className="search-option">
                                        <label>Time:</label>
                                        <select value={searchTimeLimit} onChange={(e) => setSearchTimeLimit(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                            <option value="all">All Time</option>
                                            <option value="hour">Past Hour</option>
                                            <option value="day">Past Day</option>
                                            <option value="week">Past Week</option>
                                            <option value="month">Past Month</option>
                                            <option value="year">Past Year</option>
                                        </select>
                                    </div>

                                    <div className="search-option">
                                        <label>Limit:</label>
                                        <input
                                            type="number"
                                            value={limit}
                                            onChange={(e) => setLimit(Math.max(10, Math.min(1000, parseInt(e.target.value, 10) || 10)))}
                                            min="10" max="1000" step="10"
                                            disabled={isLoading || isCommentsLoading || isMediaDownloading}
                                            title="Set number of posts to fetch (10-1000). Values over 100 will be retrieved in batches automatically."
                                        />
                                        <span className="limit-help" title="Values over 100 will be fetched in batches">10-1000</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div> {/* End Main Controls Card */}

            {/* AI Chat Interface */}
            <AIChatInterface redditData={posts} />

            {/* --- Media Grid --- */}
            {displayedPosts.length > 0 && mediaFilter !== 'all' && (
                <div className="card media-grid-container">
                    <MediaGrid
                        posts={displayedPosts}
                        onMediaClick={handleMediaClick}
                        selectedPosts={selectedPosts}
                        onSelectMedia={handleSelectPost}
                        isLoading={isLoading || isCommentsLoading || isMediaDownloading}
                        type={mediaFilter}
                        gridSize={gridSize}
                        getMediaInfo={getMediaInfo} // Pass helper
                    />
                </div>
            )}

            {/* --- Action Buttons for Results --- */}
            {posts.length > 0 && (
                <div className="action-buttons-container card">
                    <div className="selection-controls">
                        <span title={`${selectedPosts.size} of ${displayedPosts.length} displayed posts selected`}>
                            {selectedPosts.size} selected
                        </span>
                        <button className="ghost-btn" onClick={handleSelectAllDisplayed} disabled={isLoading || isCommentsLoading || isMediaDownloading || displayedPosts.length === 0} title={`Select all ${displayedPosts.length} visible posts`}>
                            Select Visible ({displayedPosts.length})
                        </button>
                        <button className="ghost-btn" onClick={handleDeselectAll} disabled={isLoading || isCommentsLoading || isMediaDownloading || selectedPosts.size === 0} title="Deselect all posts">
                            Deselect All
                        </button>
                    </div>

                    <div className="batch-actions">
                        {/* Comment Fetch Buttons */}
                        <button onClick={fetchSelectedComments} disabled={selectedPosts.size === 0 || isLoading || isCommentsLoading || isMediaDownloading || commentLimit === 0} title={commentLimit === 0 ? "Comment loading disabled (limit 0)" : `Load comments for ${selectedPosts.size} selected (Limit: ${commentLimit})`}>
                            {isCommentsLoading ? 'Loading...' : `Load Sel. Comments (${selectedPosts.size})`}
                        </button>

                        {/* Download Buttons */}
                        <button onClick={downloadJson} disabled={isLoading || isCommentsLoading || isMediaDownloading || displayedPosts.length === 0} title={selectedPosts.size > 0 ? `Download JSON for ${selectedPosts.size} selected` : `Download JSON for ${displayedPosts.length} displayed`}>
                            {selectedPosts.size > 0 ? `DL Sel. JSON (${selectedPosts.size})` : `DL Disp. JSON (${displayedPosts.length})`}
                        </button>
                        <button onClick={downloadSelectedMedia} disabled={selectedPosts.size === 0 || isLoading || isMediaDownloading} title="Download media (images/videos) from selected posts as ZIP (May face CORS issues)">
                            {isMediaDownloading ? 'Zipping Media...' : `DL Sel. Media (${selectedPosts.size})`}
                        </button>
                    </div>
                </div>
            )}

            {/* --- Error Display --- */}
            {error && <div className="error card" role="alert">{error} <button onClick={() => setError('')}>×</button></div>}

            {/* --- Post List --- */}
            <div className="post-list-container" style={{ marginTop: '10px' }}>
                {/* Post List Header */}
                {posts.length > 0 && displayedPosts.length > 0 && (
                    <div className="post-list-header">
                        <div className="post-list-heading">
                            <h3>Post List ({displayedPosts.length} shown of {posts.length} loaded posts)</h3>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && posts.length === 0 && (
                    <div className="card loading-placeholder-card">
                        <div className="loading-placeholder placeholder-line wide"></div>
                        <div className="loading-placeholder placeholder-line medium"></div>
                        <div className="loading-placeholder placeholder-rect"></div>
                    </div>
                )}

                {/* No Results / Filtered Out States */}
                {!isLoading && posts.length > 0 && displayedPosts.length === 0 && (
                    <div className="card info-message">No posts match the current media filter ('{mediaFilter === 'image' ? 'Images & Galleries' : capitalize(mediaFilter)}'). Try 'All Posts'.</div>
                )}
                {!isLoading && posts.length === 0 && (subreddit || searchQuery) && !error && (
                    <div className="card info-message">No posts found {searchQuery ? `for query "${searchQuery}"` : `in r/${subreddit}`}. Check spelling or try again.</div>
                )}
                {/* Initial state message */}
                {!isLoading && posts.length === 0 && !subreddit && !searchQuery && !error && (
                    <div className="card info-message">
                        Enter a subreddit and click "Fetch Posts", or use the search. Don't forget <a href="#" onClick={(e) => { e.preventDefault(); setShowAuthModal(true); }}>API Credentials</a>.
                    </div>
                )}

                {/* Render Displayed Posts */}
                {displayedPosts.map(post => {
                    const mediaInfo = getMediaInfo(post);
                    const isSelected = selectedPosts.has(post.id);
                    const isLongText = post.selftext && (post.selftext.length > 400 || post.selftext.split('\n').length > 8);

                    return (
                        <div
                            key={post.id}
                            className={`card post-card ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => {
                                // Don't toggle selection when clicking links, buttons, or media
                                if (e.target.tagName === 'A' ||
                                    e.target.tagName === 'BUTTON' ||
                                    e.target.className === 'media-link' ||
                                    e.target.className.includes('show-comments-btn') ||
                                    e.target.closest('.show-comments-btn') ||
                                    e.target.closest('.comment-section-container')) {
                                    return;
                                }
                                handleSelectPost(post.id);
                            }}
                        >
                            {/* Selection Checkbox - visually hidden but present for accessibility */}
                            <input
                                type="checkbox"
                                className="post-checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectPost(post.id)}
                                aria-label={isSelected ? 'Deselect post' : 'Select post'}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            />

                            {/* Post Header */}
                            <h4 className="post-title">
                                <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer" title={post.title}>
                                    {post.title}
                                </a>
                                {mediaInfo?.items?.length > 0 && (
                                    <span className="media-link" onClick={() => openGallery(mediaInfo, 0)} title={`View ${mediaInfo.type === 'gallery' ? `${mediaInfo.items.length} items` : capitalize(mediaInfo.type)}`}>
                                        View {mediaInfo.type === 'gallery' ? 'Gallery' : capitalize(mediaInfo.type)}
                                    </span>
                                )}
                            </h4>

                            {/* Post Meta */}
                            <div className="post-info">
                                <a href={`https://reddit.com/u/${post.author}`} target="_blank" rel="noopener noreferrer">u/{post.author}</a>
                                <span>{post.score?.toLocaleString()} pts ({post.upvote_ratio * 100}%)</span>
                                <span>{formatTime(post.created_utc)}</span>
                                {(searchScope === 'all' || searchScope === 'multiple') && post.subreddit && (
                                    <span><a href={`https://reddit.com/r/${post.subreddit}`} target="_blank" rel="noopener noreferrer">r/{post.subreddit}</a></span>
                                )}
                                <span>{post.num_comments?.toLocaleString()} comments</span>
                                {post.link_flair_text && <span className="flair" title={`Flair: ${post.link_flair_text}`}>{post.link_flair_text}</span>}
                            </div>

                            {/* Media Display (Instagram Style) */}
                            {mediaInfo?.items?.length > 0 && (
                                <InstagramMediaDisplay mediaInfo={mediaInfo} post={post} />
                            )}

                            {/* Post Body (Selftext) */}
                            {post.is_self && post.selftext && (
                                <div className="post-selftext">
                                    <div className="post-content">
                                        <p style={{ whiteSpace: 'pre-wrap' }}>{post.selftext}</p>
                                    </div>
                                </div>
                            )}

                            {/* External Link (if not self/media) */}
                            {!post.is_self && !mediaInfo && (post.url_overridden_by_dest || post.url) && (
                                <div className="post-external-link">
                                    <span className="link-label">Link:</span>
                                    <a href={post.url_overridden_by_dest || post.url} target="_blank" rel="noopener noreferrer nofollow" title={post.url_overridden_by_dest || post.url}>
                                        {(post.url_overridden_by_dest || post.url).length > 80 ? (post.url_overridden_by_dest || post.url).substring(0, 80) + '...' : (post.url_overridden_by_dest || post.url)}
                                    </a>
                                </div>
                            )}

                            {/* Comments Section */}
                            <div className="post-comments-area">
                                <div
                                    className={`show-comments-btn ${post.showComments ? 'active' : ''} ${(isCommentsLoading || post.commentsLoading || commentLimit === 0) ? 'disabled' : ''}`}
                                    onClick={() => !isCommentsLoading && !post.commentsLoading && commentLimit !== 0 && fetchCommentsForPost(post.id)}
                                >
                                    {post.commentsLoading ? 'Loading...' :
                                        post.showComments ? `Hide Comments (${post.comments?.length ?? 0})` :
                                            post.comments?.length > 0 ? `Show Comments (${post.comments.length})` :
                                                commentLimit === 0 ? 'Comments Disabled' :
                                                    `Load Comments (${post.num_comments?.toLocaleString() || 0})`}
                                    <span className="icon">▼</span>
                                </div>

                                <div className={`comment-section-container ${post.showComments ? 'visible' : ''}`}>
                                    {post.commentsError && !post.commentsLoading && (
                                        <span className="comment-error">Error: {post.commentsError}</span>
                                    )}
                                    {!post.commentsError && (
                                        <div className="comment-section">
                                            {post.comments?.length > 0 ? (
                                                post.comments.map(comment => (
                                                    comment.id ? ( // Ensure valid comment
                                                        <div key={comment.id} className="comment">
                                                            <div className="comment-meta">
                                                                <a href={`https://reddit.com/u/${comment.author}`} target="_blank" rel="noopener noreferrer">u/{comment.author}</a>
                                                                <span>{comment.score?.toLocaleString()} pts</span>
                                                                <span>{formatTime(comment.created_utc)}</span>
                                                                {comment.is_submitter && <span className="op-badge">(OP)</span>}
                                                                <a href={`https://reddit.com${comment.permalink}`} target="_blank" rel="noopener noreferrer" title="Link to comment" className="comment-link">🔗</a>
                                                            </div>
                                                            <div className="comment-body" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
                                                        </div>
                                                    ) : null
                                                ))
                                            ) : (!post.commentsLoading && <p className="no-comments">No comments to display.</p>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div> // End post-card
                    );
                })}
            </div> {/* End Post List Container */}

            {/* Add Load More button after the post list */}
            {posts.length > 0 && hasMorePosts && (
                <div className="load-more-container">
                    <button
                        className={`load-more-button ${isLoading ? 'loading' : ''}`}
                        onClick={() => searchQuery.trim() ? searchReddit(true) : fetchPosts(true)}
                        disabled={isLoading || isCommentsLoading || isMediaDownloading}
                    >
                        {isLoading ? (
                            <>
                                {loadingProgress.loaded > 0 ? `Loading ${loadingProgress.loaded}/${loadingProgress.total}...` : 'Loading...'}
                                {loadingProgress.loaded > 0 && (
                                    <div className="loading-progress-container">
                                        <div className="loading-progress-bar" style={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}></div>
                                    </div>
                                )}
                            </>
                        ) : (
                            'Load More Posts'
                        )}
                    </button>
                </div>
            )}

            {/* Back to top button */}
            {showBackToTop && (
                <button
                    className="back-to-top-btn"
                    onClick={scrollToTop}
                    aria-label="Back to top"
                >
                    ↑ TOP
                </button>
            )}

        </div> // End Container
    );
}

// Make RedditScraper available globally instead of using export
// The variable 'RedditScraper' will be accessible to other scripts loaded after this one
window.RedditScraper = RedditScraper;

/* Add this right before the last line of the file */
// Add styles for the updated UI components
const styleTag = document.createElement('style');
styleTag.textContent = `
.main-controls {
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.app-title {
  display: flex;
  flex-direction: column;
}

.app-title h2 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--text-primary);
}

.app-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.api-config-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--bg-highlight);
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
}

.content-filter-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  position: relative;
}

.filter-tab {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.filter-tab:hover {
  background: var(--bg-hover);
}

.filter-tab.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.filter-tab .icon {
  font-size: 1rem;
}

.count-badge {
  position: absolute;
  right: 0;
  top: -8px;
  background-color: var(--bg-highlight);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 0.75rem;
}

.input-area {
  background-color: var(--bg-card);
  border-radius: 8px;
  overflow: hidden;
}

.input-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.input-tab {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.input-tab.active {
  color: var(--primary-color);
  box-shadow: inset 0 -2px 0 var(--primary-color);
}

.input-panel {
  padding: 20px;
}

.main-input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.subreddit-input-group {
  flex: 2;
  min-width: 180px;
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-input);
}

.input-prefix {
  background-color: var(--bg-highlight);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-weight: 500;
  border-right: 1px solid var(--border-color);
}

.main-input {
  flex: 1;
  border: none;
  padding: 10px 12px;
  font-size: 1rem;
  background: transparent;
}

.sort-select,
.search-input,
.scope-select {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-input);
}

.search-input {
  flex: 3;
  min-width: 250px;
}

.scope-select {
  min-width: 140px;
}

.limit-input-group {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-input);
}

.limit-input-group input {
  width: 50px;
  border: none;
  text-align: center;
  padding: 10px 0;
  background: transparent;
}

.limit-label {
  padding: 0 10px 0 5px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.fetch-button,
.search-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.fetch-button:hover:not(:disabled),
.search-button:hover:not(:disabled) {
  background-color: var(--primary-darker);
}

.fetch-button:disabled,
.search-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.multi-sub-row {
  margin-bottom: 15px;
}

.multi-sub-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-input);
}

.extra-options,
.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.search-option,
.comment-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-option label,
.comment-option label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Back to Top Button */
.back-to-top-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 0.9rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 100;
  transition: all 0.3s ease;
}

.back-to-top-btn:hover {
  background-color: var(--primary-darker);
  transform: translateY(-3px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

@media (max-width: 767px) {
  .back-to-top-btn {
    width: 40px;
    height: 40px;
    font-size: 0.8rem;
    bottom: 15px;
    right: 15px;
  }
}
`;
document.head.appendChild(styleTag);

window.RedditScraper = RedditScraper;