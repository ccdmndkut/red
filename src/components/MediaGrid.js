// components/MediaGrid.js
// Use global React from script tags
const { useState, useEffect } = React;
// capitalize is available globally from utils.js

/**
 * Displays posts with media in a grid layout, supporting multi-image "exploded" view.
 * Instagram-style grid layout.
 */
function MediaGrid({ posts, onOpenMedia, gridSize = 240, getMediaInfo }) {
    const [explodedPostId, setExplodedPostId] = useState(null);
    const [explodedItems, setExplodedItems] = useState({});

    // Close exploded view when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click target is NOT within an exploded grid or its toggle button
            if (!event.target.closest('.exploded-grid') && !event.target.closest('.multi-image-indicator')) {
                // Only close if an exploded view is currently open
                if (explodedPostId !== null) {
                    setExplodedPostId(null);
                }
            }
        };

        // Add listener only when an exploded view is active
        if (explodedPostId) {
            document.addEventListener('click', handleClickOutside, true);
            document.addEventListener('touchstart', handleClickOutside, true);
        }

        // Cleanup function to remove the listener
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
            document.removeEventListener('touchstart', handleClickOutside, true);
        };
    }, [explodedPostId]);

    // Handle click on multi-image indicator to toggle explode/collapse
    const handleExplodeToggle = (postId, e) => {
        e.stopPropagation(); // Important: Prevent grid item click/modal open
        setExplodedPostId(currentExplodedId =>
            currentExplodedId === postId ? null : postId // Toggle behavior
        );
    };

    // Filter posts to only those with valid media info
    const validMediaPosts = posts.filter(post => {
        const mediaInfo = getMediaInfo(post);
        return mediaInfo?.items && mediaInfo.items.length > 0;
    });

    if (validMediaPosts.length === 0) {
        return null;
    }

    return (
        <div className="media-grid instagram-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))` }}>
            {validMediaPosts.map(post => {
                const mediaInfo = getMediaInfo(post);
                const hasMultipleItems = mediaInfo.items.length > 1;
                const previewItem = mediaInfo.items[0]; // First item for preview
                const isCurrentlyExploded = explodedPostId === post.id;

                // Handler for clicking the main card
                const handleCardClick = () => {
                    if (!hasMultipleItems) {
                        onOpenMedia(mediaInfo, 0);
                    }
                };

                return (
                    // Container helps manage position for the exploded grid
                    <div key={post.id} className="media-grid-item-container instagram-grid-item">
                        {/* The main clickable media card */}
                        <div
                            className="media-item-card instagram-card"
                            onClick={handleCardClick}
                            title={post.title}
                        >
                            {/* Preview Media (Video or Image) */}
                            {previewItem.type === 'video' ? (
                                <div className="instagram-video-container">
                                    <video
                                        src={previewItem.url}
                                        muted
                                        loop
                                        playsInline
                                        onClick={(e) => { if (!hasMultipleItems) { e.stopPropagation(); onOpenMedia(mediaInfo, 0); } }}
                                        style={{ pointerEvents: hasMultipleItems ? 'none' : 'auto' }}
                                    />
                                    <div className="instagram-video-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                            <path d="M5 3v18a1 1 0 001.54.84l16-9a1 1 0 000-1.68l-16-9A1 1 0 005 3zm2 1.85L19.1 12 7 19.15V4.85z" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <img
                                    src={previewItem.thumbnail || previewItem.url}
                                    alt={post.title}
                                    loading="lazy"
                                    onClick={(e) => { if (!hasMultipleItems) { e.stopPropagation(); onOpenMedia(mediaInfo, 0); } }}
                                />
                            )}

                            {/* Media type indicator - only show for video */}
                            {previewItem.type === 'video' && (
                                <div className="media-item-type instagram-media-type">
                                    {capitalize(previewItem.type)}
                                </div>
                            )}

                            {/* Indicator for multiple items - Instagram-style gallery icon */}
                            {hasMultipleItems && (
                                <div
                                    className="multi-image-indicator instagram-gallery-indicator"
                                    onClick={(e) => handleExplodeToggle(post.id, e)}
                                    title={`View ${mediaInfo.items.length} items (${isCurrentlyExploded ? 'Click to collapse' : 'Click to expand'})`}
                                    aria-expanded={isCurrentlyExploded}
                                    role="button"
                                    tabIndex="0"
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleExplodeToggle(post.id, e); }}
                                >
                                    <svg viewBox="0 0 48 48" fill="white">
                                        <path d="M34.8 29.7V11c0-2.9-2.3-5.2-5.2-5.2H11.1C8.2 5.8 6 8.1 6 11v18.7c0 2.9 2.3 5.2 5.2 5.2h18.5c2.8-.1 5.1-2.4 5.1-5.2zM11.1 31.6c-.4 0-.7-.3-.7-.7V11c0-.4.3-.7.7-.7h18.5c.4 0 .7.3.7.7v19.9c0 .4-.3.7-.7.7H11.1zm31.6-11.7v18.8c0 2.9-2.3 5.2-5.2 5.2H18.8c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1h18.7c1.7 0 3-1.3 3-3V19.8c0-.6.5-1.1 1.1-1.1.6 0 1.1.6 1.1 1.2z" />
                                    </svg>
                                </div>
                            )}

                            {/* Info overlay - Instagram-style gradient overlay */}
                            <div className="media-item-info instagram-info-overlay">
                                <span>{post.title.length > 40 ? post.title.substring(0, 37) + '...' : post.title}</span>
                            </div>
                        </div>

                        {/* Exploded view (conditionally rendered) - Instagram style grid */}
                        {isCurrentlyExploded && hasMultipleItems && (
                            <div className="exploded-grid instagram-exploded-grid" onClick={e => e.stopPropagation()}>
                                {mediaInfo.items.map((item, index) => (
                                    <div
                                        key={item.id || item.url || index}
                                        className="exploded-item instagram-exploded-item"
                                        onClick={() => onOpenMedia(mediaInfo, index)}
                                        title={`View item ${index + 1}`}
                                        role="button"
                                        tabIndex="0"
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenMedia(mediaInfo, index); }}
                                    >
                                        {item.type === 'video' ? (
                                            <div className="exploded-video-container instagram-exploded-video">
                                                <video src={item.thumbnail || item.url} muted loop playsInline />
                                                <div className="exploded-video-icon instagram-video-badge">▶</div>
                                            </div>
                                        ) : (
                                            <img src={item.thumbnail || item.url} alt={`${post.title} - item ${index + 1}`} loading="lazy" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Make MediaGrid available globally - moved outside the component function
window.MediaGrid = MediaGrid;