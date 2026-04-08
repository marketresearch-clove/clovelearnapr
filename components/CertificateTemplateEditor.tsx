import React, { useState, useRef, useEffect } from 'react';
import { PlaceholderConfig, uploadTemplateImage } from '../lib/certificateTemplateService';

interface CertificateTemplateEditorProps {
  initialConfig: PlaceholderConfig[];
  backgroundImageUrl: string;
  templateName: string;
  width: number;
  height: number;
  onSave: (config: PlaceholderConfig[], imageUrl: string, width: number, height: number) => void;
  onCancel: () => void;
}

const AVAILABLE_PLACEHOLDERS = [
  { id: 'userName', name: 'User Name', type: 'text' },
  { id: 'courseTitle', name: 'Course Title', type: 'text' },
  { id: 'issueDate', name: 'Issue Date', type: 'text' },
  { id: 'certificateId', name: 'Certificate ID', type: 'text' },
  { id: 'grade', name: 'Grade', type: 'text' },
  { id: 'signature_1', name: 'Signature 1', type: 'signature' },
  { id: 'signature_2', name: 'Signature 2', type: 'signature' },
  { id: 'signature_3', name: 'Signature 3', type: 'signature' },
];

const CertificateTemplateEditor: React.FC<CertificateTemplateEditorProps> = ({
  initialConfig,
  backgroundImageUrl,
  templateName,
  width: initialWidth,
  height: initialHeight,
  onSave,
  onCancel,
}) => {
  const [placeholders, setPlaceholders] = useState<PlaceholderConfig[]>(initialConfig);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(backgroundImageUrl);
  const [dimensions, setDimensions] = useState({ width: initialWidth, height: initialHeight });
  const [isUploading, setIsUploading] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sample data for preview mode
  const PREVIEW_DATA: Record<string, string> = {
    userName: 'John Doe',
    courseTitle: 'Full Stack Development',
    issueDate: 'May 15, 2026',
    certificateId: 'CERT-2026-001',
    grade: 'Qualified'
  };

  const SAMPLE_SIGNATURE = 'https://veaawierrnjkdsfiziqen.supabase.co/storage/v1/object/public/certificate-signatures/sample-signature.png';

  // Sync dimensions when backgroundImageUrl changes on initial load
  useEffect(() => {
    if (backgroundImageUrl && (!dimensions.width || dimensions.width === 3125)) {
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
        // Initial zoom to fit width or something reasonable
        if (viewportRef.current) {
          const vw = viewportRef.current.clientWidth - 160; // account for px-20 (80*2)
          const scale = Math.min(1, vw / img.width);
          setZoom(scale);
        }
      };
      img.src = backgroundImageUrl;
    }
  }, [backgroundImageUrl]);

  // Handle zooming with wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || true) { // Default to zoom for easier interaction
      e.preventDefault();
      const zoomSpeed = 0.001;
      const newZoom = Math.min(Math.max(0.1, zoom - e.deltaY * zoomSpeed), 5);
      setZoom(newZoom);
    }
  };

  // Panning handlers
  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only pan if we're not dragging a placeholder
    if ((e.target as HTMLElement).closest('.placeholder-item')) return;
    
    setIsPanning(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const startX = clientX - offset.x;
    const startY = clientY - offset.y;

    const handlePanMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      setOffset({
        x: moveX - startX,
        y: moveY - startY
      });
    };

    const handlePanEnd = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('touchmove', handlePanMove);
      window.removeEventListener('touchend', handlePanEnd);
    };

    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('touchmove', handlePanMove, { passive: false });
    window.addEventListener('touchend', handlePanEnd);
  };

  // Pinch zoom handler
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      if (lastTouchDistance !== null) {
        const delta = dist - lastTouchDistance;
        const zoomSpeed = 0.005;
        setZoom(prev => Math.min(Math.max(0.1, prev + delta * zoomSpeed), 5));
      }
      setLastTouchDistance(dist);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(null);
  };

  // Force re-render on resize to update scaled font sizes in preview
  const [, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;

      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const increment = e.shiftKey ? 10 : 1;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          updatePlaceholder(selectedId, { y: Math.max(0, (placeholders.find(p => p.id === selectedId)?.y || 0) - increment) });
          break;
        case 'ArrowDown':
          e.preventDefault();
          updatePlaceholder(selectedId, { y: Math.min(dimensions.height, (placeholders.find(p => p.id === selectedId)?.y || 0) + increment) });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          updatePlaceholder(selectedId, { x: Math.max(0, (placeholders.find(p => p.id === selectedId)?.x || 0) - increment) });
          break;
        case 'ArrowRight':
          e.preventDefault();
          updatePlaceholder(selectedId, { x: Math.min(dimensions.width, (placeholders.find(p => p.id === selectedId)?.x || 0) + increment) });
          break;
        case 'Delete':
        case 'Backspace':
          // Only delete if it's not in an input
          removePlaceholder(selectedId);
          break;
        case 'Escape':
          setSelectedId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, placeholders, dimensions.width, dimensions.height]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const uploadedUrl = await uploadTemplateImage(file, templateName || 'template');
      setImageUrl(uploadedUrl);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
      };
      img.src = uploadedUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const addPlaceholder = (placeholderInfo: typeof AVAILABLE_PLACEHOLDERS[0]) => {
    if (placeholders.find(p => p.id === placeholderInfo.id)) {
      alert('This placeholder is already added.');
      return;
    }

    const newPlaceholder: PlaceholderConfig = {
      id: placeholderInfo.id,
      name: placeholderInfo.name,
      type: placeholderInfo.type as any,
      x: dimensions.width / 2,
      y: dimensions.height / 2,
      fontSize: 24,
      fontFamily: 'Inter',
      color: '#000000',
      textAlign: 'center',
      fontWeight: 'normal',
      maxWidth: placeholderInfo.type === 'signature' ? 200 : undefined,
      maxHeight: placeholderInfo.type === 'signature' ? 100 : undefined,
    };

    setPlaceholders([...placeholders, newPlaceholder]);
    setSelectedId(newPlaceholder.id);
  };

  const removePlaceholder = (id: string) => {
    setPlaceholders(placeholders.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updatePlaceholder = (id: string, updates: Partial<PlaceholderConfig>) => {
    setPlaceholders(placeholders.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    setSelectedId(id);
    const placeholder = placeholders.find(p => p.id === id);
    if (!placeholder || !containerRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = placeholder.x;
    const initialY = placeholder.y;

    // Calculate scale if image is resized in preview
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;
      
      updatePlaceholder(id, {
        x: Math.round(initialX + dx),
        y: Math.round(initialY + dy),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsResizing(id);
    const placeholder = placeholders.find(p => p.id === id);
    if (!placeholder || !containerRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = placeholder.maxWidth || 200;
    const initialHeight = placeholder.maxHeight || 100;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;
      
      updatePlaceholder(id, {
        maxWidth: Math.round(Math.max(50, initialWidth + dx)),
        maxHeight: Math.round(Math.max(20, initialHeight + dy)),
      });
    };

    const handleResizeEnd = () => {
      setIsResizing(null);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  const selectedPlaceholder = placeholders.find(p => p.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Controls */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 flex flex-col gap-6 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Template Background</h3>
              <button
                onClick={() => setIsPreview(!isPreview)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                  isPreview ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isPreview ? 'Back to Edit' : 'Preview Mode'}
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="file"
                accept=".png,.webp,.jpg,.jpeg"
                onChange={handleImageUpload}
                className="hidden"
                id="bg-upload"
              />
              <label
                htmlFor="bg-upload"
                className="block w-full text-center py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 transition-all"
              >
                {isUploading ? 'Uploading...' : 'Change Background Image'}
              </label>
              {imageUrl && (
                <p className="text-xs text-gray-500 truncate">Current: {imageUrl}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Available Placeholders</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => addPlaceholder(p)}
                  disabled={placeholders.some(item => item.id === p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    placeholders.some(item => item.id === p.id)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
                  }`}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>

          {selectedPlaceholder && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Properties</h3>
                <button
                  onClick={() => removePlaceholder(selectedPlaceholder.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove Placeholder"
                >
                  <span className="material-symbols-rounded">delete</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={selectedPlaceholder.color || '#000000'}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { color: e.target.value })}
                      className="h-8 w-12 rounded border p-0.5"
                    />
                    <input
                      type="text"
                      value={selectedPlaceholder.color || '#000000'}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { color: e.target.value })}
                      className="flex-1 text-sm border rounded px-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedPlaceholder.fontSize}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full text-sm border rounded px-2 h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Weight</label>
                    <select
                      value={selectedPlaceholder.fontWeight}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { fontWeight: e.target.value })}
                      className="w-full text-sm border rounded px-2 h-8"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Alignment</label>
                  <div className="flex border rounded overflow-hidden">
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        onClick={() => updatePlaceholder(selectedPlaceholder.id, { textAlign: align })}
                        className={`flex-1 py-1 text-sm ${
                          selectedPlaceholder.textAlign === align ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {align.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">X Pos</label>
                    <input
                      type="number"
                      value={selectedPlaceholder.x}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { x: parseInt(e.target.value) })}
                      className="w-full text-sm border rounded px-2 h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Y Pos</label>
                    <input
                      type="number"
                      value={selectedPlaceholder.y}
                      onChange={(e) => updatePlaceholder(selectedPlaceholder.id, { y: parseInt(e.target.value) })}
                      className="w-full text-sm border rounded px-2 h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!selectedPlaceholder && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <span className="material-symbols-rounded text-gray-300 text-4xl mb-2">touch_app</span>
              <p className="text-sm text-gray-500">Select a placeholder on the image to edit its properties</p>
            </div>
          )}
        </div>

        {/* Editor Area */}
        <div 
          ref={viewportRef}
          className={`flex-1 bg-gray-200 overflow-hidden px-20 py-12 flex items-center justify-center relative ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onTouchStart={handlePanStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
            <button 
              onClick={() => setZoom(prev => Math.min(prev + 0.1, 5))}
              className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-rounded">add</span>
            </button>
            <button 
              onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.1))}
              className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-rounded">remove</span>
            </button>
            <button 
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              title="Reset Zoom & Pan"
            >
              <span className="material-symbols-rounded">restart_alt</span>
            </button>
          </div>

          <div 
            ref={containerRef}
            className="relative bg-white shadow-2xl flex-shrink-0 origin-center transition-transform duration-75"
            style={{ 
              width: dimensions.width, 
              height: dimensions.height,
              aspectRatio: `${dimensions.width}/${dimensions.height}`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
            }}
          >
            {imageUrl ? (
              <img 
                ref={imageRef}
                src={imageUrl} 
                alt="Template" 
                className="w-full h-full pointer-events-none select-none block"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Upload a background image to start
              </div>
            )}

            {placeholders.map((p) => (
              <div
                key={p.id}
                onMouseDown={(e) => {
                  if (isPreview) return;
                  e.stopPropagation(); // Prevent panning when dragging placeholder
                  handleMouseDown(e, p.id);
                }}
                className={`placeholder-item absolute select-none whitespace-nowrap px-2 py-1 rounded transition-shadow ${
                  isPreview ? '' : 
                  selectedId === p.id ? 'ring-2 ring-primary shadow-lg z-20 cursor-move' : 'z-10 hover:ring-1 hover:ring-primary/50 cursor-move'
                }`}
                style={{
                  left: `${(p.x / dimensions.width) * 100}%`,
                  top: `${(p.y / dimensions.height) * 100}%`,
                  color: p.color,
                  // Scale font size for preview visibility
                  fontSize: `${(p.fontSize || 24) * (containerRef.current?.offsetWidth || dimensions.width) / dimensions.width}px`,
                  fontFamily: p.fontFamily,
                  fontWeight: p.fontWeight,
                  transform: `translate(${p.textAlign === 'center' ? '-50%' : p.textAlign === 'right' ? '-100%' : '0'}, -50%)`,
                  backgroundColor: isPreview ? 'transparent' : (selectedId === p.id ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)'),
                }}
              >
                {p.type === 'signature' ? (
                  <div 
                    className="relative"
                    style={{ 
                      width: `${(p.maxWidth || 200) * (containerRef.current?.offsetWidth || dimensions.width) / dimensions.width}px`,
                      height: `${(p.maxHeight || 100) * (containerRef.current?.offsetWidth || dimensions.width) / dimensions.width}px`,
                    }}
                  >
                    {isPreview ? (
                      <img 
                        src={SAMPLE_SIGNATURE} 
                        alt={p.name} 
                        className="w-full h-full object-contain opacity-80" 
                      />
                    ) : (
                      <div className="w-full h-full border border-dashed border-gray-400 flex flex-col items-center justify-center text-[10px] text-gray-500 bg-white/50">
                        <span className="font-bold">{p.name}</span>
                        <span>{p.maxWidth}x{p.maxHeight}</span>
                      </div>
                    )}
                    
                    {!isPreview && selectedId === p.id && (
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, p.id)}
                        className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize rounded-full z-30 transform translate-x-1/2 translate-y-1/2 border border-white"
                      />
                    )}
                  </div>
                ) : (
                  isPreview ? (PREVIEW_DATA[p.id] || `{${p.id}}`) : `{${p.id}}`
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - Actions */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-600">Template: </span>
          <span className="text-sm font-bold text-gray-900">{templateName || 'Untitled Template'}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(placeholders, imageUrl, dimensions.width, dimensions.height)}
            disabled={!imageUrl}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Save Template Config
          </button>
        </div>
      </div>
    </div>
  );
};

export default CertificateTemplateEditor;
