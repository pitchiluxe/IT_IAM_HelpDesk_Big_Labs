import { API } from '../api.js';
import { toast } from '../wm.js';
import { esc } from './lab1.js';

const SYSTEM_PROMPT = `You are Lab Assistant, a knowledgeable AI tutor for an IT/IAM/Help Desk training environment. You help learners with:
- Windows local user and group management (Lab 1)
- Microsoft Entra ID MFA and identity troubleshooting (Lab 2)
- ServiceNow-style help desk ticketing (Lab 3)
- Active Directory Users and Computers administration
- PowerShell and CMD commands
- NTFS permissions and access troubleshooting

Be concise, practical, and encouraging. Give step-by-step guidance when asked. Connect technical concepts to real job responsibilities. Use clear language a junior IT professional can understand. If asked about something outside the lab scope, gently redirect to the training topics.`;

export function openChatbot(body) {
  let messages = [];
  let ollamaReady = false;
  let availableModels = [];
  let selectedModel = '';
  let isSending = false;

  body.innerHTML = `
    <div class="app" style="height:100%;display:flex;flex-direction:column">
      <div class="chat-header">
        <div class="chat-bot-avatar">🤖</div>
        <div>
          <div style="font-weight:600;font-size:14px">Lab Assistant</div>
          <div id="chat-status" style="font-size:11px;color:#888">Checking Ollama…</div>
        </div>
        <div style="flex:1"></div>
        <select id="chat-model" class="field" style="width:140px;font-size:11px;display:none"></select>
        <button class="btn btn-sm" id="chat-clear" title="Clear conversation">🗑️</button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-area">
        <textarea id="chat-input" class="field chat-input" placeholder="Ask Lab Assistant about IT, IAM, Active Directory, ticketing, PowerShell…" rows="2"></textarea>
        <button class="btn btn-primary" id="chat-send">Send</button>
      </div>
    </div>`;

  const msgEl = body.querySelector('#chat-messages');
  const input = body.querySelector('#chat-input');
  const sendBtn = body.querySelector('#chat-send');
  const statusEl = body.querySelector('#chat-status');
  const modelSel = body.querySelector('#chat-model');
  const clearBtn = body.querySelector('#chat-clear');

  function addMessage(role, text) {
    const isUser = role === 'user';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (isUser ? 'chat-user' : 'chat-bot');
    bubble.innerHTML = isUser
      ? `<div class="chat-bubble-text">${esc(text)}</div>`
      : `<div class="chat-bubble-text">${formatMarkdown(text)}</div>`;
    msgEl.appendChild(bubble);
    msgEl.scrollTop = msgEl.scrollHeight;
    return bubble;
  }

  function formatMarkdown(text) {
    return esc(text)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre class="chat-code">${esc(code)}</pre>`)
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
      .replace(/\n/g, '<br>');
  }

  function showTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bot';
    bubble.id = 'chat-typing';
    bubble.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
    msgEl.appendChild(bubble);
    msgEl.scrollTop = msgEl.scrollHeight;
  }
  function hideTyping() { const t = body.querySelector('#chat-typing'); if (t) t.remove(); }

  function showWelcome() {
    addMessage('assistant', "Hello! I'm **Lab Assistant**, your AI tutor for this IT/IAM/Help Desk training environment.\n\nI can help you with:\n- Windows user and group management\n- Entra ID MFA and identity troubleshooting\n- Help desk ticketing workflows\n- Active Directory administration\n- PowerShell commands\n- NTFS permissions\n\nWhat would you like to learn about today?");
  }

  async function checkOllama() {
    try {
      const s = await API.ollamaStatus();
      if (s.available) {
        ollamaReady = true;
        availableModels = s.models || [];
        selectedModel = s.model || 'llama3.2';
        statusEl.innerHTML = '<span style="color:#2ecc71">● Online</span> — ' + selectedModel;
        if (availableModels.length > 1) {
          modelSel.style.display = '';
          modelSel.innerHTML = availableModels.map(m => `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`).join('');
          modelSel.onchange = () => { selectedModel = modelSel.value; statusEl.innerHTML = '<span style="color:#2ecc71">● Online</span> — ' + selectedModel; };
        }
      } else {
        statusEl.innerHTML = '<span style="color:#e74c3c">● Offline</span> — Install Ollama to enable AI';
      }
    } catch {
      statusEl.innerHTML = '<span style="color:#e74c3c">● Offline</span> — Ollama not detected';
    }
    showWelcome();
  }

  async function send() {
    if (isSending) return;
    const text = input.value.trim();
    if (!text) return;
    isSending = true;
    sendBtn.disabled = true;
    input.value = '';
    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    showTyping();
    try {
      const chatMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
      const res = await API.ollamaChat(chatMessages, selectedModel);
      hideTyping();
      if (res.offline) {
        addMessage('assistant', "I'm currently offline because Ollama isn't running. To enable AI assistance:\n\n1. Install Ollama from https://ollama.com/download\n2. Run `ollama serve` in a terminal\n3. Pull a model with `ollama pull llama3.2`\n\nOnce Ollama is running, I'll be able to help you with all the lab topics!");
      } else {
        addMessage('assistant', res.reply || 'No response received.');
        messages.push({ role: 'assistant', content: res.reply || '' });
      }
    } catch (e) {
      hideTyping();
      addMessage('assistant', 'Error: ' + e.message);
    }
    isSending = false;
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.onclick = send;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  clearBtn.onclick = () => {
    messages = [];
    msgEl.innerHTML = '';
    showWelcome();
    toast('Conversation cleared');
  };

  checkOllama();
}
