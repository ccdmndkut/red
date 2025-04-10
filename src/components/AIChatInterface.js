import React, { useState } from 'react';

function AIChatInterface(props) {
    // Get Reddit data from props
    const redditData = props.redditData;

    // State declarations using React.useState
    const [chatHistory, setChatHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    // Helper function to prepare data context
    function prepareDataContext(data) {
        if (!data) return "No data available";

        try {
            // If data is too large, create a summary instead of sending everything
            const stringified = JSON.stringify(data);
            if (stringified.length > 4000) {
                // Create a summary with key information
                return `Reddit data summary: ${getContentSummary(data)}`;
            }
            return stringified;
        } catch (e) {
            return "Data available but cannot be stringified";
        }
    }

    // Helper function for data summary
    function getContentSummary(data) {
        if (Array.isArray(data)) {
            return `Total posts: ${data.length}`;
        } else if (typeof data === 'object') {
            return `Data object with properties: ${Object.keys(data).join(', ')}`;
        }
        return "Unknown data format";
    }

    // Function to send message to AI
    function sendMessage() {
        if (!userInput.trim() || !apiKey) return;

        // Add user message to chat history
        const newUserMessage = { role: 'user', content: userInput };
        setChatHistory([...chatHistory, newUserMessage]);
        setIsLoading(true);

        // Prepare data context and send to OpenRouter
        const dataContext = prepareDataContext(redditData);

        fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Reddit Scraper'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o',
                messages: [
                    { role: 'system', content: 'You are analyzing Reddit data provided by the user. Be helpful and informative.' },
                    { role: 'user', content: `Here is the Reddit data: ${dataContext}\n\nMy question is: ${userInput}` }
                ]
            })
        })
            .then(response => response.json())
            .then(data => {
                // Add AI response to chat history
                if (data.choices && data.choices[0]) {
                    setChatHistory([...chatHistory, newUserMessage, data.choices[0].message]);
                } else {
                    throw new Error('Invalid response from API');
                }
            })
            .catch(error => {
                console.error('Error calling AI:', error);
                setChatHistory([...chatHistory, newUserMessage, {
                    role: 'assistant',
                    content: 'Sorry, there was an error processing your request. Please check your API key and try again.'
                }]);
            })
            .finally(() => {
                setIsLoading(false);
                setUserInput('');
            });
    }

    // Handle input change
    function handleInputChange(e) {
        setUserInput(e.target.value);
    }

    // Handle key press (for Enter key)
    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // Render the component
    return React.createElement('div', { className: 'ai-chat-container' },
        React.createElement('h2', null, 'Ask AI About This Data'),

        // API Key input
        React.createElement('div', { className: 'api-key-input' },
            React.createElement('input', {
                type: apiKeyVisible ? 'text' : 'password',
                placeholder: 'Enter your OpenRouter API key',
                value: apiKey,
                onChange: (e) => setApiKey(e.target.value),
                className: 'api-key-field'
            }),
            React.createElement('button', {
                onClick: () => setApiKeyVisible(!apiKeyVisible),
                className: 'toggle-visibility-btn'
            }, apiKeyVisible ? 'Hide' : 'Show')
        ),

        // Chat messages
        React.createElement('div', { className: 'chat-messages' },
            chatHistory.length === 0
                ? React.createElement('div', { className: 'empty-chat' }, 'Ask a question about the Reddit data you\'ve scraped!')
                : chatHistory.map((msg, idx) =>
                    React.createElement('div', {
                        key: idx,
                        className: `message ${msg.role}`
                    },
                        React.createElement('strong', null, msg.role === 'user' ? 'You' : 'AI'),
                        React.createElement('div', { className: 'message-content' }, msg.content)
                    )
                ),
            isLoading && React.createElement('div', { className: 'loading' }, 'AI is thinking...')
        ),

        // Chat input
        React.createElement('div', { className: 'chat-input' },
            React.createElement('textarea', {
                placeholder: 'Ask about the Reddit data...',
                value: userInput,
                onChange: handleInputChange,
                onKeyPress: handleKeyPress,
                disabled: isLoading,
                className: 'chat-textarea'
            }),
            React.createElement('button', {
                onClick: sendMessage,
                disabled: !apiKey || !userInput.trim() || isLoading,
                className: 'send-button'
            }, isLoading ? 'Sending...' : 'Send')
        )
    );
}

export default AIChatInterface; 