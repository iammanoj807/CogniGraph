import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
import axios from 'axios';

const ChatInterface = ({ onUploadSuccess, onNewGraphData, onHighlightNodes, hasUploadedDocument, isMobileExpanded, onToggleMobileExpand }) => {
    const [messages, setMessages] = useState([
        { role: 'ai', content: 'Hello! I am ready to answer questions about your document. 🚀' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
    const messagesEndRef = useRef(null);

    // Auto-scroll to the latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cleanup chat when document is removed or reset
    useEffect(() => {
        if (!hasUploadedDocument) {
            setMessages([{ role: 'ai', content: 'Hello! I am ready to answer questions about your document. 🚀' }]);
        }
    }, [hasUploadedDocument]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // Guardrail: Ensure document is present before chatting
        if (!hasUploadedDocument) {
            setMessages(prev => [...prev, {
                role: 'ai',
                content: 'Please upload a document first! I need a document to answer your questions accurately.'
            }]);
            return;
        }

        setIsLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const response = await axios.post(`${API_URL}/chat`, {
                message: input,
                model_provider: selectedModel
            });

            const botMessage = {
                role: 'ai',
                content: response.data.response,
                highlighted_nodes: response.data.highlighted_nodes
            };
            setMessages(prev => [...prev, botMessage]);

            // Notify parent to highlight specific nodes in the graph
            if (response.data.highlighted_nodes && onHighlightNodes) {
                onHighlightNodes(response.data.highlighted_nodes);
            }

        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage = error.response?.data?.detail ||
                (error.message === "Network Error" ? "Network error. Please check your connection." : "I'm having trouble processing that request. It might be too long or complex. Please try shortening it.");
            setMessages(prev => [...prev, { role: 'ai', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setMessages([{ role: 'ai', content: 'Chat cleared. Upload a new document to start over.' }]);
        onNewGraphData({ nodes: [], links: [] });
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-2 text-blue-400">
                    <MessageSquare size={20} />
                    <h2 className="font-bold text-lg tracking-wide hidden sm:block">CogniChat</h2>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    <img
                        src="/graph-favicon.svg"
                        alt="CogniGraph Logo"
                        className="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity"
                    />

                    {/* Mobile: Toggle Expand/Collapse */}
                    <button
                        onClick={onToggleMobileExpand}
                        className="md:hidden p-2 text-blue-400 hover:text-blue-300 transition"
                        title={isMobileExpanded ? "Show Graph" : "Expand Chat"}
                    >
                        {isMobileExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </button>
                </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} `}>
                        <div className={`max-w-[85%] p-3 rounded-2xl shadow-md text-sm leading-relaxed break-words ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                            } `}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-700 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-gray-800 border-t border-gray-700">
                <div className="flex gap-2 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about your document..."
                        className="flex-1 bg-gray-900 text-white rounded-xl pl-4 pr-12 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-gray-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg flex items-center justify-center"
                    >
                        <Send size={18} />
                    </button>
                </div>

                {/* Footer / Credits */}
                <div className="text-center mt-4 pt-4 border-t border-gray-700/50 flex flex-col items-center gap-0">
                    <span className="text-[10px] text-gray-500 font-mono tracking-wider">Powered by GPT-4o Mini</span>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
