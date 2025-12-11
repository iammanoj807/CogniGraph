import React, { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import ChatInterface from './components/ChatInterface';
import WelcomeScreen from './components/WelcomeScreen';
import { MessageSquare } from 'lucide-react';
import axios from 'axios';

// Utils: Generate or retrieve Session ID for isolation
const getSessionId = () => {
  let sid = localStorage.getItem('cognigraph-session-id');
  if (!sid) {
    // Simple UUID Fallback
    sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('cognigraph-session-id', sid);
  }
  return sid;
};

// Configure Axios to always send Session ID
axios.defaults.headers.common['X-Session-ID'] = getSessionId();

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [highlightedNodes, setHighlightedNodes] = useState([]);

  // Responsive State: Tracks if window is mobile-sized
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    // Initial load - Reset session to ensure fresh start
    const API_URL = import.meta.env.VITE_API_URL || '';
    axios.post(`${API_URL}/reset`)
      .then(res => setGraphData(res.data))
      .catch(err => console.error("Failed to reset session", err));

    // Handle Resize for Responsive Layout
    const handleWindowResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const [activeMobileTab, setActiveMobileTab] = useState('graph'); // 'graph' or 'chat' for mobile
  const sidebarRef = useRef(null);
  const SIDEBAR_WIDTH = 400; // Fixed width for desktop chat sidebar

  const [autoTriggerUpload, setAutoTriggerUpload] = useState(false);

  // Resets the current session to allow a new file upload
  const handleResetSession = () => {
    setGraphData({ nodes: [], links: [] });
    setHighlightedNodes([]);
    setAutoTriggerUpload(true); // Auto-open file dialog on next render
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-[#0f172a] text-white overflow-hidden relative">

      {/* 
        MAIN CONTENT AREA (Graph / Welcome)
        Desktop: Flex-1 (Takes remaining space)
        Mobile: 
          - Default: h-[60vh]
          - Chat Expanded: h-0/hidden (to give full space to chat)
      */}
      <div
        className={`
            w-full relative order-1 md:order-1 transition-all duration-300 ease-in-out
            ${isMobile
            ? 'absolute inset-0 z-0 h-full' // Mobile: Always full screen background
            : 'h-full md:flex-1' // Desktop: Flex share
          }
 
        `}
      >
        {graphData.nodes?.length > 0 ? (
          <>
            <GraphView data={graphData} highlightedNodes={highlightedNodes} />

            {/* Floating Upload Button */}
            <button
              onClick={handleResetSession}
              className="absolute top-4 right-4 z-20 md:right-8 p-3 bg-gray-800/80 hover:bg-blue-600 backdrop-blur-md text-white rounded-xl shadow-lg border border-gray-600 hover:border-blue-500 transition-all duration-200 flex items-center gap-2 group"
              title="Upload New Document"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
              <span className="text-sm font-medium hidden sm:inline">Upload New</span>
            </button>
          </>
        ) : (
          <WelcomeScreen
            onUploadSuccess={setGraphData}
            autoTrigger={autoTriggerUpload}
            onOpenChat={() => setActiveMobileTab('chat')}
          />
        )}
      </div>

      {/* Mobile Floating Toggle for Chat (Only show when Graph is active) */}
      {isMobile && activeMobileTab === 'graph' && graphData.nodes?.length > 0 && (
        <button
          onClick={() => setActiveMobileTab('chat')}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-bounce-in"
        >
          <MessageSquare size={20} />
          <span className="font-semibold">Open Chat</span>
        </button>
      )}

      {/* 
        RIGHT SIDEBAR (Chat)
        Desktop: Fixed width 400px
        Mobile: 
          - Default: h-[40vh] (bottom sheet)
          - Expanded: h-full (covers screen)
      */}
      <div
        className={`
            w-full md:h-full bg-gray-900 border-t md:border-t-0 md:border-l border-gray-700 z-10 shadow-2xl transition-all duration-300 ease-in-out flex flex-col order-2 md:order-3
            ${isMobile
            ? (activeMobileTab === 'chat' ? 'absolute inset-0 h-full z-30' : 'hidden') // Mobile: Overlay or Hidden
            : ''
          }
        `}
        style={!isMobile ? { width: SIDEBAR_WIDTH } : {}}
        ref={sidebarRef}
      >
        <ChatInterface
          onNewGraphData={setGraphData}
          onHighlightNodes={setHighlightedNodes}
          hasUploadedDocument={graphData.nodes.length > 0}
          isMobileExpanded={activeMobileTab === 'chat'}
          onToggleMobileExpand={() => setActiveMobileTab(prev => prev === 'chat' ? 'graph' : 'chat')}
        />
      </div>
    </div>
  );
}

export default App;
