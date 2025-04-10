// Define AIChatInterface as a global variable, without any module syntax
// Use var instead of const/let for maximum compatibility
var AIChatInterface = function (props) {
    // Use plain React.useState for state management
    var redditDataState = React.useState(props.redditData);
    var redditData = redditDataState[0];
    var setRedditData = redditDataState[1];

    var chatHistoryState = React.useState([]);
    var chatHistory = chatHistoryState[0];
    var setChatHistory = chatHistoryState[1];

    var userInputState = React.useState('');
    var userInput = userInputState[0];
    var setUserInput = userInputState[1];

    // Load API key from localStorage
    var apiKeyState = React.useState(function () {
        try {
            var savedKey = localStorage.getItem('openRouterApiKey');
            return savedKey || '';
        } catch (e) {
            console.error('Error loading API key from localStorage:', e);
            return '';
        }
    });
    var apiKey = apiKeyState[0];
    var setApiKey = apiKeyState[1];

    var isLoadingState = React.useState(false);
    var isLoading = isLoadingState[0];
    var setIsLoading = isLoadingState[1];

    var apiKeyVisibleState = React.useState(false);
    var apiKeyVisible = apiKeyVisibleState[0];
    var setApiKeyVisible = apiKeyVisibleState[1];

    // Effect to save API key to localStorage when it changes
    React.useEffect(function () {
        try {
            if (apiKey) {
                localStorage.setItem('openRouterApiKey', apiKey);
            }
        } catch (e) {
            console.error('Error saving API key to localStorage:', e);
        }
    }, [apiKey]);

    // Function to save API key
    function saveApiKey() {
        try {
            localStorage.setItem('openRouterApiKey', apiKey);
            alert('API key saved successfully!');
        } catch (e) {
            console.error('Error saving API key to localStorage:', e);
            alert('Failed to save API key: ' + e.message);
        }
    }

    // Helper function to prepare data context
    function prepareDataContext(data) {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            return "No Reddit posts have been loaded yet. Please fetch posts from a subreddit first.";
        }

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

    // Function to send messages to OpenRouter AI
    function sendMessage() {
        if (!userInput.trim() || !apiKey) return;

        // Add user message to chat history
        var newUserMessage = { role: 'user', content: userInput };
        var updatedHistory = chatHistory.concat([newUserMessage]);
        setChatHistory(updatedHistory);
        setIsLoading(true);

        // Prepare data context and send to OpenRouter
        var dataContext = prepareDataContext(redditData);

        fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Reddit Scraper'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o',
                messages: [
                    { role: 'system', content: 'You are analyzing Reddit data provided by the user. Be helpful and informative.' },
                    { role: 'user', content: 'Here is the Reddit data: ' + dataContext + '\n\nMy question is: ' + userInput }
                ]
            })
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.choices && data.choices[0]) {
                    setChatHistory(updatedHistory.concat([data.choices[0].message]));
                } else {
                    throw new Error('Invalid response from API');
                }
            })
            .catch(function (error) {
                console.error('Error calling AI:', error);
                setChatHistory(updatedHistory.concat([{
                    role: 'assistant',
                    content: 'Sorry, there was an error processing your request. Please check your API key and try again.'
                }]));
            })
            .finally(function () {
                setIsLoading(false);
                setUserInput('');
            });
    }

    // Update redditData when props change
    React.useEffect(function () {
        setRedditData(props.redditData);
    }, [props.redditData]);

    // Create the component UI without JSX
    return React.createElement('div', { className: 'card main-controls ai-chat-section' }, [
        // Header with title and API key input
        React.createElement('div', { key: 'header', className: 'app-header' }, [
            React.createElement('div', { key: 'title-area', className: 'app-title' }, [
                React.createElement('h2', { key: 'main-title' }, 'AI Chat Assistant'),
                React.createElement('span', { key: 'subtitle', className: 'app-subtitle' }, 'Analyze Reddit data with AI')
            ]),

            React.createElement('div', { key: 'api-input', className: 'api-key-input' }, [
                React.createElement('input', {
                    key: 'api-field',
                    type: apiKeyVisible ? 'text' : 'password',
                    placeholder: 'Enter your OpenRouter API key',
                    value: apiKey,
                    onChange: function (e) { setApiKey(e.target.value); },
                    className: 'api-key-field'
                }),
                React.createElement('button', {
                    key: 'toggle-btn',
                    onClick: function () { setApiKeyVisible(!apiKeyVisible); },
                    className: 'toggle-visibility-btn'
                }, apiKeyVisible ? 'Hide' : 'Show'),
                React.createElement('button', {
                    key: 'save-btn',
                    onClick: saveApiKey,
                    className: 'save-key-btn'
                }, 'Save Key')
            ])
        ]),

        // Chat interface
        React.createElement('div', { key: 'chat-interface', className: 'chat-interface' }, [
            // Data status indicator
            Array.isArray(redditData) && redditData.length === 0 ?
                React.createElement('div', {
                    key: 'no-data',
                    className: 'no-data-warning',
                    style: {
                        padding: '10px',
                        margin: '10px 0',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '5px',
                        textAlign: 'center',
                        border: '1px solid #ffeeba'
                    }
                }, 'No Reddit posts loaded. Please fetch posts from a subreddit before using the AI chat.') : null,

            // Chat messages
            React.createElement('div', { key: 'messages', className: 'chat-messages' },
                chatHistory.length === 0
                    ? [React.createElement('div', { key: 'empty', className: 'empty-chat' }, 'Ask a question about the Reddit data you\'ve scraped!')]
                    : chatHistory.map(function (msg, idx) {
                        return React.createElement('div', {
                            key: 'msg-' + idx,
                            className: 'message ' + msg.role
                        }, [
                            React.createElement('strong', { key: 'role' }, msg.role === 'user' ? 'You' : 'AI'),
                            React.createElement('div', { key: 'content', className: 'message-content' }, msg.content)
                        ]);
                    }).concat(
                        isLoading ? [React.createElement('div', { key: 'loading', className: 'loading' }, 'AI is thinking...')] : []
                    )
            ),

            // Chat input
            React.createElement('div', { key: 'input-area', className: 'chat-input' }, [
                React.createElement('textarea', {
                    key: 'input',
                    placeholder: 'Ask about the Reddit data...',
                    value: userInput,
                    onChange: function (e) { setUserInput(e.target.value); },
                    onKeyPress: function (e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    },
                    disabled: isLoading,
                    className: 'chat-textarea'
                }),
                React.createElement('button', {
                    key: 'send-btn',
                    onClick: sendMessage,
                    disabled: !apiKey || !userInput.trim() || isLoading || (Array.isArray(redditData) && redditData.length === 0),
                    className: 'send-button',
                    title: !apiKey ? 'Please enter an API key' :
                        !userInput.trim() ? 'Please enter a question' :
                            (Array.isArray(redditData) && redditData.length === 0) ? 'Please fetch Reddit posts first' :
                                'Send your question to the AI'
                }, isLoading ? 'Sending...' : 'Send')
            ])
        ])
    ]);
};

// Make the component available globally
window.AIChatInterface = AIChatInterface; 