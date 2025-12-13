import React, { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import ChatInterface from './components/ChatInterface';
import WelcomeScreen from './components/WelcomeScreen';
import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Desktop State: Track if chat sidebar is open
  const [isDesktopChatOpen, setIsDesktopChatOpen] = useState(true);

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
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#0f172a] text-white overflow-hidden relative">

      {/* 
        MAIN CONTENT AREA (Graph / Welcome)
        Desktop: Flex-1 (Takes remaining space)
        Mobile: 
          - Default: h-[60vh]
          - Chat Expanded: h-0/hidden (to give full space to chat)
      */}
      <div
        className={`
            relative order-1 md:order-1 transition-all duration-300 ease-in-out min-w-0
            ${isMobile
            ? 'absolute inset-0 z-0 h-full w-full' // Mobile: Full screen absolute
            : 'h-full md:flex-1' // Desktop: Flex share (removed fixed w-full to prevent overflow)
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
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-500/30 transition-all duration-300"
        >
          <MessageSquare size={20} />
          <span>Open Chat</span>
        </button>
      )}

      {/* 
        DESKTOP CHAT TOGGLE BUTTON
        Visible only on Desktop (md:flex)
        Positions itself relative to the sidebar edge.
       */}
      {!isMobile && (
        <button
          onClick={() => setIsDesktopChatOpen(prev => !prev)}
          className="hidden md:flex absolute top-[50%] -translate-y-1/2 z-40 items-center justify-center w-8 h-12 bg-gray-800 border border-gray-600 border-r-0 rounded-l-lg hover:bg-blue-600 hover:border-blue-500 text-gray-400 hover:text-white transition-all duration-300 shadow-xl"
          style={{ right: isDesktopChatOpen ? SIDEBAR_WIDTH : 0 }}
          title={isDesktopChatOpen ? "Close Chat" : "Open Chat"}
        >
          {isDesktopChatOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      )}

      {/* 
        RIGHT SIDEBAR (Chat)
        Desktop: Fixed width 400px (or 0px if closed)
        Mobile: 
          - Default: h-[40vh] (bottom sheet)
          - Expanded: h-full (covers screen)
      */}
      <div
        className={`
            w-full md:h-full bg-gray-900 border-t md:border-t-0 md:border-l border-gray-700 z-10 shadow-2xl transition-all duration-300 ease-in-out flex flex-col order-2 md:order-3
            ${isMobile
            ? (activeMobileTab === 'chat' ? 'absolute inset-0 h-full z-30' : 'hidden') // Mobile: Overlay or Hidden
            : 'relative' // Desktop: Relative to flow
          }
        `}
        style={!isMobile ? { width: isDesktopChatOpen ? SIDEBAR_WIDTH : 0, overflow: 'hidden' } : {}}
        ref={sidebarRef}
      >
        <div style={{ minWidth: isMobile ? '100%' : SIDEBAR_WIDTH, height: '100%' }}> {/* Wrapper to prevent content squishing during transition */}
          <ChatInterface
            onNewGraphData={setGraphData}
            onHighlightNodes={setHighlightedNodes}
            hasUploadedDocument={graphData.nodes.length > 0}
            isMobileExpanded={activeMobileTab === 'chat'}
            onToggleMobileExpand={() => setActiveMobileTab(prev => prev === 'chat' ? 'graph' : 'chat')}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
