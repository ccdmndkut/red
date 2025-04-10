// components/MediaViewerModal.js
// Use global React from script tags
const { useEffect } = React;

/**
 * A simple modal for displaying a single image or video.
 * Note: Currently might be superseded by GalleryModal in the main app flow.
 */
function MediaViewerModal({ mediaUrl, mediaType, onClose }) {
    if (!mediaUrl) return null;

    // Basic type detection (can be enhanced)
    const isImage = mediaType === 'image';
    const isVideo = mediaType === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.includes('v.redd.it');

    // Close modal on Escape key press
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape' || event.keyCode === 27) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Close modal on background click
    const handleBackgroundClick = (e) => {
        // Only close if the click is directly on the modal background
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal" onClick={handleBackgroundClick}>
            {/* Stop propagation prevents background click from closing when clicking content */}
            <div className="modal-content media-viewer-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">×</button>
                {isImage && <img src={mediaUrl} alt="Media Content" />}
                {isVideo && (
                    <video
                        src={mediaUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        // Mute v.redd.it videos by default as they often lack sound initially
                        muted={mediaUrl.includes('v.redd.it')}
                        style={{ outline: 'none', maxWidth: '100%', maxHeight: '90vh' }} // Ensure video fits
                    >
                        Video not supported.
                    </video>
                )}
                {/* Fallback for unsupported types */}
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

export default MediaViewerModal;