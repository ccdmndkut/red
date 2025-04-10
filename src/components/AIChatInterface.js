import React, { useState } from 'react';

function AIChatInterface({ redditData }) {
    const [chatHistory, setChatHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    const sendMessage = async () => {
        if (!userInput.trim() || !apiKey) return;

        // Add user message to chat history
        const newUserMessage = { role: 'user', content: userInput };
        setChatHistory(prev => [...prev, newUserMessage]);
        setIsLoading(true);

        try {
            // Create a summary of the Reddit data to provide context
            const dataContext = prepareDataContext(redditData);

            // Prepare messages array with context and user question
            const messages = [
                { role: 'system', content: 'You are analyzing Reddit data provided by the user. Be helpful and informative.' },
                { role: 'user', content: `Here is the Reddit data: ${dataContext}\n\nMy question is: ${userInput}` }
            ];

            // Send to OpenRouter
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Reddit Scraper'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o',
                    messages: messages
                })
            });

            const data = await response.json();

            // Add AI response to chat history
            if (data.choices && data.choices[0]) {
                setChatHistory(prev => [...prev, data.choices[0].message]);
            } else {
                throw new Error('Invalid response from API');
            }

        } catch (error) {
            console.error('Error calling AI:', error);
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, there was an error processing your request. Please check your API key and try again.'
            }]);
        } finally {
            setIsLoading(false);
            setUserInput('');
        }
    };

    // Helper function to prepare data context
    const prepareDataContext = (data) => {
        if (!data) return "No data available";

        try {
            // If data is too large, create a summary instead of sending everything
            const stringified = JSON.stringify(data);
            if (stringified.length > 4000) {
                // Create a summary with key information
                return `Reddit data summary: 
          ${data.subreddit ? `Subreddit: ${data.subreddit}` : ''}
          Total posts: ${Array.isArray(data) ? data.length : 'Unknown'}
          Types of content: ${getContentTypes(data)}`;
            }
            return stringified;
        } catch (e) {
            return "Data available but cannot be stringified";
        }
    };

    // Helper function to identify content types
    const getContentTypes = (data) => {
        // This is a simplified example - adjust based on actual data structure
        const types = new Set();
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.is_video) types.add('videos');
                if (item.url && /\.(jpg|jpeg|png|gif)$/i.test(item.url)) types.add('images');
                if (item.selftext) types.add('text posts');
                if (item.comments) types.add('comments');
            });
        }
        return Array.from(types).join(', ') || 'unknown';
    };

    return (
        <div className="ai-chat-container">
            <h2>Ask AI About This Data</h2>

            {/* API Key input */}
            <div className="api-key-input">
                <input
                    type={apiKeyVisible ? "text" : "password"}
                    placeholder="Enter your OpenRouter API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="api-key-field"
                />
                <button
                    onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    className="toggle-visibility-btn"
                >
                    {apiKeyVisible ? "Hide" : "Show"}
                </button>
            </div>

            {/* Chat messages */}
            <div className="chat-messages">
                {chatHistory.length === 0 ? (
                    <div className="empty-chat">
                        Ask a question about the Reddit data you've scraped!
                    </div>
                ) : (
                    chatHistory.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
                            <div className="message-content">{msg.content}</div>
                        </div>
                    ))
                )}
                {isLoading && <div className="loading">AI is thinking...</div>}
            </div>

            {/* Chat input */}
            <div className="chat-input">
                <textarea
                    placeholder="Ask about the Reddit data..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isLoading}
                    className="chat-textarea"
                />
                <button
                    onClick={sendMessage}
                    disabled={!apiKey || !userInput.trim() || isLoading}
                    className="send-button"
                >
                    {isLoading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default AIChatInterface; 