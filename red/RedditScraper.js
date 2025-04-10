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

    // Gallery State
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [galleryUrls, setGalleryUrls] = useState([]); // Array of {url, type, id, thumbnail}
    const [initialGalleryIndex, setInitialGalleryIndex] = useState(0);

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

    // --- Effects ---

    // Save credentials to localStorage
    useEffect(() => {
        localStorage.setItem('redditApiCredentials', JSON.stringify(credentials));
    }, [credentials]);

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
    const fetchPosts = useCallback(async () => {
        const sub = subreddit.trim();
        if (!sub) { setError('Please enter a subreddit name.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 1 || numericLimit > 100) { setError('Post limit must be between 1 and 100.'); return; }

        setIsLoading(true); setError(''); setPosts([]); setSelectedPosts(new Set());
        setSearchQuery(''); // Clear search when fetching normally

        console.log(`Fetching posts from r/${sub}, Sort: ${sort}, Limit: ${numericLimit}, Timeframe (if top): ${topTimeFrame}`);

        try {
            const accessToken = await getAccessToken();
            const baseRedditUrl = 'https://oauth.reddit.com'; // Use OAuth endpoint
            let apiUrl;

            if (sort === 'top' || sort === 'controversial') {
                apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${numericLimit}&t=${topTimeFrame}&raw_json=1`;
            } else {
                apiUrl = `${baseRedditUrl}/r/${sub}/${sort}?limit=${numericLimit}&raw_json=1`;
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
            const initialPosts = data.data.children.map(child => ({
                ...child.data,
                isExpanded: false,      // For long text expansion
                comments: [],           // Store fetched comments
                commentsLoading: false, // Loading state for *this* post's comments
                showComments: false,    // Visibility state for *this* post's comments
                commentsError: null     // Error state for *this* post's comments
            }));

            setPosts(initialPosts);
            console.log(`Fetched ${initialPosts.length} posts.`);

        } catch (err) {
            console.error("Fetch posts error:", err);
            // Avoid overwriting specific auth errors if they occurred
            if (!error || !error.startsWith('Access Token Error')) {
                setError(`Fetch failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [subreddit, limit, sort, topTimeFrame, credentials, getAccessToken, error]); // Include 'error' dependency? Maybe not needed directly


    // Search Reddit
    const searchReddit = useCallback(async () => {
        const query = searchQuery.trim();
        if (!query) { setError('Please enter a search query.'); return; }
        if (!credentials.clientId || !credentials.clientSecret) { setError('API Credentials required.'); setShowAuthModal(true); return; }
        const numericLimit = parseInt(limit, 10);
        if (isNaN(numericLimit) || numericLimit < 1 || numericLimit > 100) { setError('Result limit must be between 1 and 100.'); return; }

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

        setIsLoading(true); setError(''); setPosts([]); setSelectedPosts(new Set());

        console.log(`Searching Reddit. Scope: ${searchScope}, Query: "${query}", Sort: ${searchSort}, Limit: ${numericLimit}, Time: ${searchTimeLimit}`);

        try {
            const accessToken = await getAccessToken();
            const baseRedditUrl = 'https://oauth.reddit.com';
            const timeParam = searchTimeLimit !== 'all' ? `&t=${searchTimeLimit}` : '';
            const queryParam = `q=${encodeURIComponent(query)}`;
            const limitParam = `&limit=${numericLimit}`;
            const sortParam = `&sort=${searchSort}`;
            const rawJsonParam = '&raw_json=1';
            let apiUrl;

            if (searchScope === 'subreddit') {
                // Search within a specific subreddit
                apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?${queryParam}&restrict_sr=1${limitParam}${sortParam}${timeParam}${rawJsonParam}`;
            } else if (searchScope === 'multiple') {
                // Search within multiple subreddits (no restrict_sr needed here)
                apiUrl = `${baseRedditUrl}/r/${targetSubreddits}/search?${queryParam}${limitParam}${sortParam}${timeParam}${rawJsonParam}`;
                // Note: The behavior of sort=relevance might differ across multiple subs vs global search
            } else { // searchScope === 'all'
                // Search across all of Reddit
                apiUrl = `${baseRedditUrl}/search?${queryParam}${limitParam}${sortParam}${timeParam}${rawJsonParam}`;
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

            // Clear main subreddit input if searching 'all' for clarity? Optional.
            // if (searchScope === 'all') {
            //     setSubreddit('');
            // }

        } catch (err) {
            console.error("Search error:", err);
            if (!error || !error.startsWith('Access Token Error')) {
                setError(`Search failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, limit, searchScope, subreddit, multipleSubreddits, searchSort, searchTimeLimit, credentials, getAccessToken, error]);


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
    }, []);


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
                />
            )}

            {/* --- Main Controls Card --- */}
            <div className="card">
                <h2>Reddit Scraper Advanced</h2>

                {/* Media Filter Header */}
                <div className="media-filter-header">
                    <div>
                        <h3>View Filter</h3>
                        <span className="count-display">
                            {posts.length > 0 ? `${displayedPosts.length} / ${posts.length} posts shown` : 'No posts loaded'}
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

                {/* Subreddit Fetch Controls */}
                <div className="control-section">
                    <h3>Fetch from Subreddit</h3>
                    <div className="controls-grid">
                        <div className="control-group">
                            <label htmlFor="subredditInput">Subreddit (no r/):</label>
                            <input
                                id="subredditInput"
                                value={subreddit}
                                onChange={(e) => setSubreddit(e.target.value.replace(/r\/|\s/g, ''))}
                                placeholder="e.g., pics"
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
                            </select>
                        </div>
                        {(sort === 'top' || sort === 'controversial') && (
                            <div className="control-group">
                                <label htmlFor="timeFrameSelect">Time Frame:</label>
                                <select id="timeFrameSelect" value={topTimeFrame} onChange={(e) => setTopTimeFrame(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                    <option value="hour">Hour</option>
                                    <option value="day">Day</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="year">Year</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>
                        )}
                        <div className="control-group">
                            <label htmlFor="limitInput">Post Limit (1-100):</label>
                            <input
                                id="limitInput" type="number" value={limit}
                                onChange={(e) => setLimit(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                                min="1" max="100" step="1"
                                onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
                                disabled={isLoading || isCommentsLoading || isMediaDownloading}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="commentLimitSelect">Load Comments:</label>
                            <select id="commentLimitSelect" value={commentLimit} onChange={(e) => setCommentLimit(Number(e.target.value))} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                <option value="20">Top 20</option>
                                <option value="50">Top 50</option>
                                <option value="100">Top 100</option>
                                <option value="0">None</option>
                            </select>
                        </div>
                    </div>
                    <div className="action-buttons">
                        <button onClick={fetchPosts} disabled={isLoading || isCommentsLoading || isMediaDownloading || !subreddit.trim()}>
                            {isLoading && !searchQuery ? 'Loading...' : `Fetch r/${subreddit || '...'}`}
                        </button>
                        <button className="ghost-btn" onClick={() => setShowAuthModal(true)} disabled={isLoading || isCommentsLoading || isMediaDownloading} title="Edit API Credentials">
                            API Credentials
                        </button>
                    </div>
                </div>

                {/* Search Section */}
                <div className="control-section">
                    <h3>Search Reddit</h3>
                    <div className="controls-grid">
                        <div className="control-group long-span">
                            <label htmlFor="searchQueryInput">Search Query:</label>
                            <input id="searchQueryInput" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Enter search terms..." onKeyDown={(e) => e.key === 'Enter' && searchReddit()} disabled={isLoading || isCommentsLoading || isMediaDownloading} />
                        </div>
                        <div className="control-group">
                            <label htmlFor="searchScopeSelect">Search In:</label>
                            <select id="searchScopeSelect" value={searchScope} onChange={(e) => setSearchScope(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                <option value="subreddit">Current Subreddit</option>
                                <option value="multiple">Multiple Subs</option>
                                <option value="all">All Reddit</option>
                            </select>
                        </div>
                        {searchScope === 'multiple' && (
                            <div className="control-group long-span">
                                <label htmlFor="multipleSubredditsInput">Subreddits (comma-sep):</label>
                                <input id="multipleSubredditsInput" value={multipleSubreddits} onChange={(e) => setMultipleSubreddits(e.target.value)} placeholder="e.g. pics, aww, dataisbeautiful" onKeyDown={(e) => e.key === 'Enter' && searchReddit()} disabled={isLoading || isCommentsLoading || isMediaDownloading} />
                            </div>
                        )}
                        <div className="control-group">
                            <label htmlFor="searchSortSelect">Sort Results By:</label>
                            <select id="searchSortSelect" value={searchSort} onChange={(e) => setSearchSort(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                <option value="relevance">Relevance</option>
                                <option value="hot">Hot</option>
                                <option value="new">New</option>
                                <option value="top">Top</option>
                                <option value="comments">Comment Count</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label htmlFor="searchTimeLimitSelect">Time Period:</label>
                            <select id="searchTimeLimitSelect" value={searchTimeLimit} onChange={(e) => setSearchTimeLimit(e.target.value)} disabled={isLoading || isCommentsLoading || isMediaDownloading}>
                                <option value="all">All Time</option>
                                <option value="hour">Hour</option>
                                <option value="day">Day</option>
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                                <option value="year">Year</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label htmlFor="searchLimitInput">Result Limit:</label>
                            <input id="searchLimitInput" type="number" value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))} min="1" max="100" step="1" onKeyDown={(e) => e.key === 'Enter' && searchReddit()} disabled={isLoading || isCommentsLoading || isMediaDownloading} />
                        </div>
                    </div>
                    <div className="action-buttons spaced">
                        <button onClick={searchReddit} disabled={isLoading || isCommentsLoading || isMediaDownloading || !searchQuery.trim() || (searchScope === 'subreddit' && !subreddit.trim()) || (searchScope === 'multiple' && !multipleSubreddits.trim().split(',').map(s => s.trim()).filter(s => s).length)}>
                            {isLoading && searchQuery ? 'Searching...' : 'Search Reddit'}
                        </button>
                        <span className="scope-indicator">
                            {searchScope === 'subreddit' ? (subreddit.trim() ? `in r/${subreddit}` : 'Requires subreddit') :
                                searchScope === 'multiple' ? (multipleSubreddits.trim() ? `in specified subs` : 'Requires subs') :
                                    'across all Reddit'}
                        </span>
                    </div>
                </div>

            </div> {/* End Controls Card */}

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

            {/* --- Media Grid View --- */}
            {/* Show only if posts exist AND the filter is image or video */}
            {posts.length > 0 && displayedPosts.length > 0 && (mediaFilter === 'image' || mediaFilter === 'video') && (
                <div className="card media-grid-section">
                    <div className="media-grid-header">
                        <h3>Media Grid ({mediaFilter === 'image' ? 'Images/Galleries' : 'Videos'})</h3>
                        <div className="grid-controls">
                            <label htmlFor="gridSizeSlider">Grid Size:</label>
                            <input id="gridSizeSlider" type="range" className="grid-size-slider" min="100" max="350" step="10" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} disabled={isLoading || isCommentsLoading || isMediaDownloading} aria-label="Adjust grid item size" />
                            <span>{gridSize}px</span>
                        </div>
                    </div>
                    <MediaGrid
                        posts={displayedPosts} // Pass filtered posts
                        onOpenMedia={openGallery} // Use gallery opener
                        gridSize={gridSize}
                        getMediaInfo={getMediaInfo} // Pass helper
                    />
                </div>
            )}

            {/* --- Post List --- */}
            <div className="post-list-container" style={{ marginTop: '10px' }}>
                {/* Post List Header */}
                {posts.length > 0 && displayedPosts.length > 0 && (
                    <div className="post-list-header card">
                        <h3>Post List ({displayedPosts.length} posts)</h3>
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

        </div> // End Container
    );
}

// Make RedditScraper available globally instead of using export
// The variable 'RedditScraper' will be accessible to other scripts loaded after this one
window.RedditScraper = RedditScraper;