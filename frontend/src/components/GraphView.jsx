import React, { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';

const GraphView = ({ data, highlightedNodes = [] }) => {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // Auto-rotate camera slightly for dynamic effect
        if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(-150); // More repulsion = less clutter
            fgRef.current.d3Force('link').distance(80); // Longer edges = more spread out

            // Set initial camera position logic
            // zoomToFit ensures everything is visible but maximized.
            // We wait slightly for the force engine to spread nodes out.
            setTimeout(() => {
                if (fgRef.current) {
                    fgRef.current.zoomToFit(1000, 20); // Minimal padding = Maximum graph size
                }
            }, 600); // Slightly longer wait for physics to settle

            // Enable panning via OrbitControls config
            // react-force-graph-3d uses Three.js OrbitControls exposed via .controls()
            const controls = fgRef.current.controls();
            if (controls) {
                controls.enablePan = true;
                controls.enableZoom = true;
                controls.enableRotate = true;

                // Adjust damping for smoother mobile feel
                controls.enableDamping = true;
                controls.dampingFactor = 0.2;
            }
        }
    }, [data]); // Run when data loads

    // Function to pan the camera (strafe)
    const handlePan = (direction) => {
        if (!fgRef.current) return;

        // This moves the camera position relative to its current orientation
        // We need to calculate right/up vectors to move correctly

        const currentPos = fgRef.current.cameraPosition();

        // Simple heuristic: 
        // We just modify X/Y for basic movement, but for "Up" we move Y, for "Right" we move X relative to screen.
        // Since we can't easily access the THREE.Camera object to get local vectors here, we try to simulate it.
        // Actually, for ForceGraph3D, modifying x/y indiscriminately works if we are looking roughly at 0,0,0.

        const offset = 40; // Larger step
        let { x, y, z } = currentPos;

        // To pan, we must move BOTH the camera AND the lookAt target (controls.target)
        // AND we must ensure we get the updated lookAt target first.
        const controls = fgRef.current.controls();
        const target = controls ? controls.target : { x: 0, y: 0, z: 0 };

        let dx = 0, dy = 0;

        // Naive screen-space-ish mapping
        if (direction === 'up') dy = offset;
        if (direction === 'down') dy = -offset;
        if (direction === 'left') dx = -offset;
        if (direction === 'right') dx = offset;

        const newPos = { x: x - dx, y: y - dy, z: z };
        const newTarget = { x: target.x - dx, y: target.y - dy, z: target.z };

        fgRef.current.cameraPosition(
            newPos,
            newTarget,
            500 // Smooth transition
        );
    };
    // Focus on highlighted nodes and update visuals
    useEffect(() => {
        console.log("GraphView received highlightedNodes:", highlightedNodes);
        if (fgRef.current) {
            // 1. Update Camera Focus
            if (highlightedNodes.length > 0) {
                const node = data.nodes.find(n => n.id === highlightedNodes[0]);
                if (node) {
                    const distance = 180; // "Average view" - wider context
                    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
                    fgRef.current.cameraPosition(
                        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                        node,
                        2000
                    );
                }
            }

            // 2. Manually update Three.js objects (SpriteText) and Node Colors
            // This is necessary because nodeThreeObject is cached and doesn't auto-update
            data.nodes.forEach(node => {
                const isHighlighted = highlightedNodes.includes(node.id);

                // Update SpriteText (if it exists)
                if (node.__threeObj) {
                    const sprite = node.__threeObj;
                    sprite.color = isHighlighted ? '#86efac' : 'white'; // Light Green
                    sprite.textHeight = isHighlighted ? 5 : 4;
                    sprite.backgroundColor = isHighlighted ? 'rgba(134, 239, 172, 0.2)' : 'rgba(0,0,0,0.5)';
                    sprite.position.y = isHighlighted ? 10 : 10;
                }

                // Update Node Color (for the sphere)
                // We modify the node object directly so the accessor picks it up or we force update
                node.color = isHighlighted ? '#86efac' : '#3b82f6';
                node.val = isHighlighted ? 4 : 1; // Slightly larger size
            });

            // 3. Force graph to re-render the scene to apply color/size changes
            // Re-setting the graph data reference or using internal methods can help,
            // but usually modifying the objects + d3Reheat is enough for positions, 
            // for colors we might need to trigger a prop update.
            // However, since we modified __threeObj directly, that part is done.
            // For the sphere, we rely on the accessor.
            fgRef.current.refresh();
        }
    }, [highlightedNodes, data]);

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth, // Use clientWidth for better mobile sizing (excludes scrollbar)
                    height: containerRef.current.clientHeight
                });
            }
        };

        updateDimensions();

        // Add robust resize handling
        window.addEventListener('resize', updateDimensions);
        window.addEventListener('orientationchange', updateDimensions); // Specific for mobile

        const observer = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateDimensions);
            window.removeEventListener('orientationchange', updateDimensions);
            observer.disconnect();
        };
    }, []);

    const handleZoomIn = () => {
        if (fgRef.current) {
            const currentPos = fgRef.current.cameraPosition();
            fgRef.current.cameraPosition(
                { x: currentPos.x * 0.8, y: currentPos.y * 0.8, z: currentPos.z * 0.8 },
                null,
                500
            );
        }
    };

    const handleZoomOut = () => {
        if (fgRef.current) {
            const currentPos = fgRef.current.cameraPosition();
            fgRef.current.cameraPosition(
                { x: currentPos.x * 1.2, y: currentPos.y * 1.2, z: currentPos.z * 1.2 },
                null,
                500
            );
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden">
            {dimensions.width > 0 && (
                <ForceGraph3D
                    ref={fgRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={data}
                    nodeLabel="id"
                    nodeRelSize={6}
                    nodeVal={node => highlightedNodes.includes(node.id) ? 4 : 1}
                    nodeColor={node => highlightedNodes.includes(node.id) ? '#86efac' : '#3b82f6'}
                    nodeThreeObjectExtend={true}
                    nodeThreeObject={node => {
                        const isHighlighted = highlightedNodes.includes(node.id);
                        const sprite = new SpriteText(node.id);
                        sprite.color = isHighlighted ? '#86efac' : 'white'; // Light Green
                        sprite.textHeight = isHighlighted ? 5 : 4;
                        sprite.padding = 2; // Add some padding
                        sprite.backgroundColor = isHighlighted ? 'rgba(134, 239, 172, 0.2)' : 'rgba(0,0,0,0.5)';
                        sprite.borderRadius = 4;
                        sprite.position.y = isHighlighted ? 10 : 10; // Offset higher for larger nodes
                        return sprite;
                    }}
                    linkColor={link => {
                        const isHighlighted = highlightedNodes.includes(link.source.id) || highlightedNodes.includes(link.target.id);
                        return isHighlighted ? '#4ade80' : 'rgba(255,255,255,0.5)';
                    }}
                    linkWidth={link => {
                        const isHighlighted = highlightedNodes.includes(link.source.id) || highlightedNodes.includes(link.target.id);
                        return isHighlighted ? 3 : 1.5;
                    }}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.005}
                    backgroundColor="#0f172a"
                    showNavInfo={false}
                    onNodeClick={node => {
                        // Focus on node
                        const distance = 225;
                        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
                        fgRef.current.cameraPosition(
                            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                            node,
                            3000
                        );
                    }}
                />
            )}
            <div className="absolute top-4 left-4 glass-panel p-4 max-w-xs pointer-events-none">
                <h3 className="text-sm md:text-lg font-bold text-blue-400">Knowledge Graph</h3>
                <p className="hidden md:block text-sm text-gray-400">
                    Interactive 3D visualization of extracted concepts. Click a node to focus.
                </p>
            </div>

            // Controls Container - Bottom Right (Zoom)
            <div className="absolute bottom-8 right-8 flex flex-col gap-2">
                <button
                    onClick={handleZoomIn}
                    className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg transition border border-gray-600 flex items-center justify-center p-0"
                    title="Zoom In"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button
                    onClick={handleZoomOut}
                    className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg transition border border-gray-600 flex items-center justify-center p-0"
                    title="Zoom Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>

            {/* D-Pad - Bottom Left */}
            <div className="absolute bottom-8 left-8 flex flex-col items-center gap-1">
                <button onClick={() => handlePan('up')} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg border border-gray-600 active:bg-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
                <div className="flex gap-2">
                    <button onClick={() => handlePan('left')} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg border border-gray-600 active:bg-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button onClick={() => handlePan('down')} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg border border-gray-600 active:bg-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <button onClick={() => handlePan('right')} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg border border-gray-600 active:bg-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GraphView;
