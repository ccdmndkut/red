// components/GalleryModal.js
// Use global React from script tags
const { useState, useEffect, useCallback } = React;

/**
 * An Instagram-style modal for viewing and navigating image/video galleries.
 */
function GalleryModal({ galleryUrls, initialIndex = 0, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [likeActive, setLikeActive] = useState(false);
    const [saveActive, setSaveActive] = useState(false);
    const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);

    // Validate input
    if (!galleryUrls || galleryUrls.length === 0) {
        console.warn("GalleryModal rendered with no galleryUrls.");
        return null;
    }

    // Ensure initialIndex is valid
    useEffect(() => {
        setCurrentIndex(Math.max(0, Math.min(initialIndex, galleryUrls.length - 1)));
    }, [initialIndex, galleryUrls.length]);

    // Navigation handlers
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

    // Handle keyboard navigation (Escape, Left/Right arrows)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') handleNext();
            else if (e.key === 'ArrowLeft') handlePrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, handleNext, handlePrev]);

    // Close modal on background click
    const handleBackgroundClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle double tap/click to like
    const handleDoubleTap = (e) => {
        e.preventDefault();
        setLikeActive(true);
        // Show heart animation
        setShowDoubleTapHeart(true);
        setTimeout(() => setShowDoubleTapHeart(false), 1000);
    };

    // Toggle like
    const toggleLike = () => {
        setLikeActive(!likeActive);
    };

    // Toggle save
    const toggleSave = () => {
        setSaveActive(!saveActive);
    };

    // Get current media item safely
    const currentMedia = galleryUrls[currentIndex];
    if (!currentMedia || !currentMedia.url) {
        console.error("Invalid media item at index", currentIndex, galleryUrls);
        // Optionally close the modal or show an error state
        return (
            <div className="modal instagram-modal" onClick={handleBackgroundClick}>
                <div className="modal-content instagram-modal-content" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">×</button>
                    <p style={{ padding: '20px', color: 'var(--text-primary)' }}>Error displaying media item.</p>
                </div>
            </div>
        );
    }

    // Determine if current item is video
    const isVideo = currentMedia.type === 'video' ||
        currentMedia.url?.endsWith('.mp4') ||
        currentMedia.url?.includes('v.redd.it');

    return (
        <div className="modal instagram-modal" onClick={handleBackgroundClick}>
            <div className="modal-content instagram-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button className="modal-close-btn instagram-close-btn" onClick={onClose} title="Close (Esc)">
                    <svg aria-label="Close" fill="#ffffff" height="18" viewBox="0 0 48 48" width="18">
                        <path clipRule="evenodd" d="M41.8 9.8L27.5 24l14.2 14.2c.6.6.6 1.5 0 2.1l-1.4 1.4c-.6.6-1.5.6-2.1 0L24 27.5 9.8 41.8c-.6.6-1.5.6-2.1 0l-1.4-1.4c-.6-.6-.6-1.5 0-2.1L20.5 24 6.2 9.8c-.6-.6-.6-1.5 0-2.1l1.4-1.4c.6-.6 1.5-.6 2.1 0L24 20.5 38.3 6.2c.6-.6 1.5-.6 2.1 0l1.4 1.4c.6.6.6 1.6 0 2.2z" fillRule="evenodd"></path>
                    </svg>
                </button>

                {/* Instagram-style header */}
                <div className="instagram-header">
                    <div className="instagram-user-info">
                        <div className="instagram-avatar"></div>
                        <div className="instagram-username">Reddit Post</div>
                    </div>
                    <div className="instagram-more-options">
                        <svg aria-label="More options" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                            <circle clipRule="evenodd" cx="8" cy="24" fillRule="evenodd" r="4.5"></circle>
                            <circle clipRule="evenodd" cx="24" cy="24" fillRule="evenodd" r="4.5"></circle>
                            <circle clipRule="evenodd" cx="40" cy="24" fillRule="evenodd" r="4.5"></circle>
                        </svg>
                    </div>
                </div>

                {/* Main viewer area */}
                <div className="instagram-viewer">
                    <div
                        className="instagram-main-image"
                        onDoubleClick={handleDoubleTap}
                    >
                        {/* Double tap heart animation */}
                        {showDoubleTapHeart && (
                            <div className="instagram-double-tap-heart">
                                <svg viewBox="0 0 48 48" width="100" height="100">
                                    <path fill="#fff" d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"></path>
                                </svg>
                            </div>
                        )}

                        {isVideo ? (
                            <video
                                key={currentMedia.url}
                                src={currentMedia.url}
                                controls
                                autoPlay
                                loop
                                playsInline
                                muted={currentMedia.url.includes('v.redd.it')}
                                className="instagram-media-content"
                            >
                                Video not supported.
                            </video>
                        ) : (
                            <img
                                key={currentMedia.url}
                                src={currentMedia.url}
                                alt={`Gallery item ${currentIndex + 1}`}
                                className="instagram-media-content"
                            />
                        )}

                        {/* Navigation arrows (only if more than one item) */}
                        {galleryUrls.length > 1 && (
                            <>
                                <button className="instagram-nav-button prev" onClick={(e) => { e.stopPropagation(); handlePrev(); }} title="Previous (Left arrow)">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                        <path d="M17.51 3.87L15.73 2.1 5.84 12l9.9 9.9 1.77-1.77L9.38 12l8.13-8.13z"></path>
                                    </svg>
                                </button>
                                <button className="instagram-nav-button next" onClick={(e) => { e.stopPropagation(); handleNext(); }} title="Next (Right arrow)">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"></path>
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Navigation dots (only if more than one item) */}
                    {galleryUrls.length > 1 && (
                        <div className="instagram-dots">
                            {galleryUrls.map((_, index) => (
                                <div
                                    key={index}
                                    className={`instagram-dot ${index === currentIndex ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                                ></div>
                            ))}
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="instagram-actions">
                        <div className="instagram-action-buttons">
                            <div
                                className={`instagram-like ${likeActive ? 'active' : ''}`}
                                onClick={toggleLike}
                                title={likeActive ? "Unlike" : "Like"}
                            >
                                {likeActive ? (
                                    <svg aria-label="Unlike" fill="#ed4956" height="24" viewBox="0 0 48 48" width="24">
                                        <path d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"></path>
                                    </svg>
                                ) : (
                                    <svg aria-label="Like" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                                        <path d="M34.6 6.1c5.7 0 10.4 5.2 10.4 11.5 0 6.8-5.9 11-11.5 16S25 41.3 24 41.9c-1.1-.7-4.7-4-9.5-8.3-5.7-5-11.5-9.2-11.5-16C3 11.3 7.7 6.1 13.4 6.1c4.2 0 6.5 2 8.1 4.3 1.9 2.6 2.2 3.9 2.5 3.9.3 0 .6-1.3 2.5-3.9 1.6-2.3 3.9-4.3 8.1-4.3m0-3c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5.6 0 1.1-.2 1.6-.5 1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"></path>
                                    </svg>
                                )}
                            </div>
                            <div className="instagram-comment" title="Comment">
                                <svg aria-label="Comment" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                                    <path clipRule="evenodd" d="M47.5 46.1l-2.8-11c1.8-3.3 2.8-7.1 2.8-11.1C47.5 11 37 .5 24 .5S.5 11 .5 24 11 47.5 24 47.5c4 0 7.8-1 11.1-2.8l11 2.8c.8.2 1.6-.6 1.4-1.4zm-3-22.1c0 4-1 7-2.6 10-.2.4-.3.9-.2 1.4l2.1 8.4-8.3-2.1c-.5-.1-1-.1-1.4.2-1.8 1-5.2 2.6-10 2.6-11.4 0-20.6-9.2-20.6-20.5S12.7 3.5 24 3.5 44.5 12.7 44.5 24z" fillRule="evenodd"></path>
                                </svg>
                            </div>
                            <div className="instagram-share" title="Share">
                                <svg aria-label="Share Post" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                                    <path d="M47.8 3.8c-.3-.5-.8-.8-1.3-.8h-45C.9 3.1.3 3.5.1 4S0 5.2.4 5.7l15.9 15.6 5.5 22.6c.1.6.6 1 1.2 1.1h.2c.5 0 1-.3 1.3-.7l23.2-39c.4-.4.4-1 .1-1.5zM5.2 6.1h35.5L18 18.7 5.2 6.1zm18.7 33.6l-4.4-18.4L42.4 8.6 23.9 39.7z"></path>
                                </svg>
                            </div>
                            <div
                                className={`instagram-save ${saveActive ? 'active' : ''}`}
                                onClick={toggleSave}
                                title={saveActive ? "Unsave" : "Save"}
                            >
                                {saveActive ? (
                                    <svg aria-label="Remove" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                                        <path d="M43.5 48c-.4 0-.8-.2-1.1-.4L24 28.9 5.6 47.6c-.4.4-1.1.6-1.6.3-.6-.2-1-.8-1-1.4v-45C3 .7 3.7 0 4.5 0h39c.8 0 1.5.7 1.5 1.5v45c0 .6-.4 1.2-.9 1.4-.2.1-.4.1-.6.1z"></path>
                                    </svg>
                                ) : (
                                    <svg aria-label="Save" fill="#262626" height="24" viewBox="0 0 48 48" width="24">
                                        <path d="M43.5 48c-.4 0-.8-.2-1.1-.4L24 29 5.6 47.6c-.4.4-1.1.6-1.6.3-.6-.2-1-.8-1-1.4v-45C3 .7 3.7 0 4.5 0h39c.8 0 1.5.7 1.5 1.5v45c0 .6-.4 1.2-.9 1.4-.2.1-.4.1-.6.1zM24 26c.8 0 1.6.3 2.2.9l15.8 16V3H6v39.9l15.8-16c.6-.6 1.4-.9 2.2-.9z"></path>
                                    </svg>
                                )}
                            </div>
                        </div>

                        {/* Likes count */}
                        <div className="instagram-likes-count">
                            {likeActive ? "1 like" : "0 likes"}
                        </div>

                        {/* Caption */}
                        <div className="instagram-caption">
                            <span className="instagram-username">Reddit Post</span>
                            <span className="instagram-caption-text">
                                {currentMedia.caption || `Gallery item ${currentIndex + 1} of ${galleryUrls.length}`}
                            </span>
                        </div>

                        {/* Time */}
                        <div className="instagram-time">Just now</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Make GalleryModal available globally
window.GalleryModal = GalleryModal;