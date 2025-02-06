let selectedModel = localStorage.getItem('selectedModel');
let chatSessions = JSON.parse(localStorage.getItem('chatSessions')) || [];
let activeSessionIndex = localStorage.getItem('activeSessionIndex') !== null ? parseInt(localStorage.getItem('activeSessionIndex')) : null;
let username = localStorage.getItem('username') || 'User';
let apiKey = localStorage.getItem('apiKey') || '';

document.getElementById('modelSelect').value = selectedModel || 'klusterai/Meta-Llama-3.1-8B-Instruct-Turbo';

if (selectedModel) {
    document.getElementById('modelSelection').style.display = 'none';
    document.getElementById('activeModel').innerHTML = `Using model: ${selectedModel}`;
}

renderChatList();
renderChatHistory();

function selectModel() {
    selectedModel = document.getElementById('modelSelect').value;
    localStorage.setItem('selectedModel', selectedModel);
    document.getElementById('modelSelection').style.display = 'none';
    document.getElementById('activeModel').innerHTML = `Using model: ${selectedModel}`;
}

function newChat() {
    const newSession = { title: `Chat ${chatSessions.length + 1}`, messages: [] };
    chatSessions.push(newSession);
    activeSessionIndex = chatSessions.length - 1;
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    localStorage.setItem('activeSessionIndex', activeSessionIndex);
    renderChatList();
    renderChatHistory();

    document.getElementById('modelSelection').style.display = 'block';
    document.getElementById('activeModel').innerHTML = '';
}

function setUsername() {
    const newUsername = prompt('Please enter your username:');
    if (newUsername) {
        username = newUsername;
        localStorage.setItem('username', username);
        alert(`Username set to ${username}`);
    }
}

function setApiKey() {
    const newApiKey = prompt('Please enter your API key:');
    if (newApiKey) {
        apiKey = newApiKey;
        localStorage.setItem('apiKey', apiKey);
        alert('API key set.');
    }
}

async function sendMessage() {
    const userInput = document.getElementById('userInput').value.trim();

    if (!userInput) {
        alert('Please enter a message.');
        return;
    }

    const responseDiv = document.getElementById('chatHistory');
    responseDiv.innerHTML += `<div class="chat-entry user"><strong>${username}:</strong> ${marked.parse(userInput)}</div>`;
    document.getElementById('userInput').value = '';

    sendMessageToAPI(userInput);
}

async function sendMessageToAPI(userInput) {
    if (!apiKey) {
        alert('Please set your API key first.');
        return;
    }

    const apiUrl = 'https://api.kluster.ai/v1/chat/completions';

    const payload = {
        model: selectedModel,
        messages: chatSessions[activeSessionIndex].messages.concat({ role: 'user', content: userInput })
    };

    try {
        const data = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (data.choices && data.choices.length > 0) {
            const markdownContent = data.choices[0].message.content;
            const formattedResponse = marked.parse(markdownContent);
            const responseDiv = document.getElementById('chatHistory');
            responseDiv.innerHTML += `<div class="chat-entry assistant"><strong>Assistant:</strong> ${renderWithCopyButton(formattedResponse)}</div>`;

            // Store the message and response in history
            chatSessions[activeSessionIndex].messages.push({ role: 'user', content: userInput });
            chatSessions[activeSessionIndex].messages.push({ role: 'assistant', content: markdownContent });
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            renderChatHistory();
        } else {
            const responseDiv = document.getElementById('chatHistory');
            responseDiv.innerHTML += `<div class="chat-entry assistant"><strong>Assistant:</strong> No response from the API.</div>`;
        }
    } catch (error) {
        const responseDiv = document.getElementById('chatHistory');
        responseDiv.innerHTML += `<div class="chat-entry assistant"><strong>Assistant:</strong> Error: ${error.message}</div>`;
    }
}

async function fetchWithRetry(url, options, retries = 5, backoff = 3000) {
    for (let i = 0; i < retries; i++) {
        const response = await fetch(url, options);

        if (response.ok) {
            return response.json();
        } else if (response.status === 429 && i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff *= 2; // Exponential backoff
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }
}

function renderChatHistory() {
    const responseDiv = document.getElementById('chatHistory');
    if (activeSessionIndex !== null && chatSessions[activeSessionIndex]) {
        responseDiv.innerHTML = chatSessions[activeSessionIndex].messages.map(
            message => `<div class="chat-entry ${message.role}"><strong>${message.role.charAt(0).toUpperCase() + message.role.slice(1)}:</strong> ${renderWithCopyButton(marked.parse(message.content))}</div>`
        ).join('');
    } else {
        responseDiv.innerHTML = '';
    }
}

function renderWithCopyButton(content) {
    const codeBlockRegex = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;
    let formattedContent = content.replace(codeBlockRegex, (match, code) => {
        return `<div class="code-block"><pre><code>${escapeHtml(code)}</code></pre><button class="copy-button" onclick="copyToClipboard(\`${escapeHtml(code)}\`)">Copy</button></div>`;
    });
    return formattedContent;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function renderChatList() {
    const chatListDiv = document.getElementById('chatList');
    chatListDiv.innerHTML = chatSessions.map(
        (chat, index) => `
            <div class="chat-entry">
                <input type="text" class="rename-input" value="${chat.title}" onchange="renameChat(${index}, this.value)">
                <button onclick="loadChat(${index})">Open</button>
                <button onclick="deleteChat(${index})">Delete</button>
            </div>
        `
    ).join('');
}

function loadChat(index) {
    activeSessionIndex = index;
    localStorage.setItem('activeSessionIndex', activeSessionIndex);
    renderChatHistory();
}

function deleteChat(index) {
    chatSessions.splice(index, 1);
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    if (activeSessionIndex === index) {
        activeSessionIndex = null;
        localStorage.removeItem('activeSessionIndex');
        renderChatHistory();
    } else if (activeSessionIndex > index) {
        activeSessionIndex--;
        localStorage.setItem('activeSessionIndex', activeSessionIndex);
    }
    renderChatList();
}

function renameChat(index, newName) {
    chatSessions[index].title = newName;
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    renderChatList();
}