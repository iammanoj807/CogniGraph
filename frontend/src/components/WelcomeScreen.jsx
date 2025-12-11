import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, ArrowRight } from 'lucide-react';
import axios from 'axios';

const WelcomeScreen = ({ onUploadSuccess, autoTrigger }) => {
    const fileInputRef = useRef(null);
    const hasTriggeredRef = useRef(false); // Guard against StrictMode double-fire
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-click upload if triggered from "Upload New" button
    useEffect(() => {
        if (autoTrigger && fileInputRef.current && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            fileInputRef.current.click();
        }
    }, [autoTrigger]);

    const [retryIn, setRetryIn] = useState(0);

    // Auto-countdown for rate limit errors
    useEffect(() => {
        if (!retryIn) return;

        const timer = setInterval(() => {
            setRetryIn(prev => {
                if (prev <= 1) {
                    setError(null); // Clear error when timer hits 0
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [retryIn]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setRetryIn(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const response = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onUploadSuccess(response.data);

        } catch (err) {
            console.error("Upload failed:", err);
            const errorMsg = err.response?.data?.detail || "Failed to upload document. Please try again.";

            // Check for wait time in error message
            const match = errorMsg.match(/wait (\d+)s/);
            if (match && match[1]) {
                setRetryIn(parseInt(match[1], 10));
            }

            setError(errorMsg);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-gray-900 via-[#0f172a] to-gray-900 text-white p-8 pb-40 md:pb-8">
            <div className="max-w-2xl text-center space-y-8 animate-fade-in-up">

                {/* Icon */}
                <div className="flex justify-center">
                    <div className="p-6 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <FileText size={64} className="text-blue-400" />
                    </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-4">
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent pb-2">
                        Welcome to CogniGraph
                    </h1>
                    <p className="text-base md:text-xl text-gray-400 leading-relaxed max-w-lg mx-auto">
                        Transform your documents into interactive Knowledge Graphs.
                        Upload a PDF or Text file to visualize concepts, explore relationships, and chat with your data.
                    </p>
                </div>

                {/* Upload Button */}
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={() => fileInputRef.current.click()}
                        disabled={isUploading}
                        className="group relative px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all duration-300 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={24} />
                                <span>Upload</span>
                            </>
                        )}
                    </button>

                    {error && (
                        <p className="text-red-400 text-sm animate-pulse font-mono">
                            {retryIn > 0
                                ? (() => {
                                    const h = Math.floor(retryIn / 3600);
                                    const m = Math.floor((retryIn % 3600) / 60);
                                    const s = retryIn % 60;
                                    return `API Rate Limit Hit. Retrying allowed in: ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
                                })()
                                : error}
                        </p>
                    )}

                    <p className="text-sm text-gray-500">
                        Supported formats: .pdf, .txt, .md
                    </p>

                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".txt,.pdf,.md"
                />
            </div>

            {/* Footer Section */}
            <div className="absolute bottom-6 left-0 w-full flex flex-col items-center gap-2">
                <p className="text-[10px] md:text-xs text-gray-400 max-w-md text-center px-4 italic">
                    Privacy Notice: No data is stored. All documents are processed in-memory for this session only.
                </p>
                <div className="text-gray-400 text-[10px] font-mono">
                    © CogniGraph 2025
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
