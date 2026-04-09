import React, { useState, useRef, useEffect } from 'react';
import { PlaceholderConfig, uploadTemplateImage, uploadCanvasImage } from '../lib/certificateTemplateService';
import { getEnabledSignatures, CertificateSignature } from '../lib/certificateSignatureService';

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

// Popular Google Fonts - no API key needed
const GOOGLE_FONTS = [
  // Sans-Serif
  { name: 'Inter', category: 'sans-serif' },
  { name: 'Roboto', category: 'sans-serif' },
  { name: 'Open Sans', category: 'sans-serif' },
  { name: 'Lato', category: 'sans-serif' },
  { name: 'Montserrat', category: 'sans-serif' },
  { name: 'Poppins', category: 'sans-serif' },
  { name: 'Nunito', category: 'sans-serif' },
  // Serif
  { name: 'Playfair Display', category: 'serif' },
  { name: 'Merriweather', category: 'serif' },
  { name: 'Lora', category: 'serif' },
  { name: 'EB Garamond', category: 'serif' },
  { name: 'Cormorant Garamond', category: 'serif' },
  // Display
  { name: 'Cinzel', category: 'display' },
  { name: 'Abril Fatface', category: 'display' },
  // Handwriting
  { name: 'Dancing Script', category: 'handwriting' },
  { name: 'Pacifico', category: 'handwriting' },
  { name: 'Great Vibes', category: 'handwriting' },
  { name: 'Sacramento', category: 'handwriting' },
  // Monospace
  { name: 'Source Code Pro', category: 'monospace' },
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverBg, setIsDragOverBg] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set(['Inter']));
  const [enabledSignatures, setEnabledSignatures] = useState<CertificateSignature[]>([]);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // Guide lines and snapping state
  const [dragGuides, setDragGuides] = useState<Array<{
    type: 'center-h' | 'center-v' | 'align-left' | 'align-right' | 'align-top' | 'align-bottom' | 'align-center-h' | 'align-center-v';
    position: number;
  }>>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const SNAP_TOLERANCE = 8;

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

  // SVG data URI signature - fallback when no signatures are configured
  const SAMPLE_SIGNATURE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
    </style>
  </defs>
  <path d="M 10 60 C 20 20, 30 10, 50 40 S 70 70, 90 45 S 120 10, 140 35 S 165 65, 190 40"
    fill="none" stroke="#1a1a2e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 10 65 L 190 65" fill="none" stroke="#1a1a2e" stroke-width="0.8" opacity="0.4"/>
</svg>`)}`

  // Get signature details by signature ID (signature_1, signature_2, signature_3)
  const getSignatureDetails = (signatureId: string): CertificateSignature | null => {
    const signatureIndex = parseInt(signatureId.split('_')[1]) - 1; // signature_1 -> index 0
    return enabledSignatures[signatureIndex] || null;
  };

  // Get signature image URL by signature ID
  const getSignatureUrl = (signatureId: string): string => {
    const signature = getSignatureDetails(signatureId);
    if (signature?.signature_image_url) {
      return signature.signature_image_url;
    }
    return SAMPLE_SIGNATURE;
  };

  // Fetch enabled signatures for preview
  useEffect(() => {
    const fetchSignatures = async () => {
      try {
        const signatures = await getEnabledSignatures();
        setEnabledSignatures(signatures);
      } catch (error) {
        console.error('Failed to load signatures:', error);
        // Fallback to sample signatures if fetch fails
        setEnabledSignatures([]);
      }
    };
    fetchSignatures();
  }, []);

  // Pre-load fonts for existing placeholders and sync dimensions on initial load
  useEffect(() => {
    // Pre-load Google Fonts used in existing placeholders
    placeholders.forEach((p) => {
      if (p.fontFamily && p.fontFamily !== 'Inter') {
        loadGoogleFont(p.fontFamily);
      }
    });

    // Sync dimensions when backgroundImageUrl changes on initial load
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
  }, [backgroundImageUrl, placeholders]);

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

  // Load a Google Font dynamically
  const loadGoogleFont = (fontName: string) => {
    if (loadedFonts.has(fontName)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap`;
    document.head.appendChild(link);
    setLoadedFonts((prev) => new Set([...prev, fontName]));
  };

  // Calculate guide lines for snapping
  const calculateGuideLines = (id: string, x: number, y: number) => {
    const guides: typeof dragGuides = [];
    const draggingElement = placeholders.find(p => p.id === id);
    if (!draggingElement) return guides;

    const elemWidth = draggingElement.maxWidth || 200;
    const elemHeight = draggingElement.maxHeight || 100;
    const elemCenterX = x + elemWidth / 2;
    const elemCenterY = y + elemHeight / 2;
    const canvasCenterX = dimensions.width / 2;
    const canvasCenterY = dimensions.height / 2;

    // Center guides
    if (Math.abs(elemCenterX - canvasCenterX) < SNAP_TOLERANCE) {
      guides.push({ type: 'center-v', position: canvasCenterX });
    }
    if (Math.abs(elemCenterY - canvasCenterY) < SNAP_TOLERANCE) {
      guides.push({ type: 'center-h', position: canvasCenterY });
    }

    // Check alignment with other elements
    for (const other of placeholders) {
      if (other.id === id) continue;

      const otherWidth = other.maxWidth || 200;
      const otherHeight = other.maxHeight || 100;
      const otherCenterX = other.x + otherWidth / 2;
      const otherCenterY = other.y + otherHeight / 2;

      // Left edge alignment
      if (Math.abs(x - other.x) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-left', position: other.x });
      }
      // Right edge alignment
      if (Math.abs(x + elemWidth - (other.x + otherWidth)) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-right', position: other.x + otherWidth - elemWidth });
      }
      // Top edge alignment
      if (Math.abs(y - other.y) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-top', position: other.y });
      }
      // Bottom edge alignment
      if (Math.abs(y + elemHeight - (other.y + otherHeight)) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-bottom', position: other.y + otherHeight - elemHeight });
      }
      // Horizontal center alignment
      if (Math.abs(elemCenterX - otherCenterX) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-center-h', position: otherCenterX - elemWidth / 2 });
      }
      // Vertical center alignment
      if (Math.abs(elemCenterY - otherCenterY) < SNAP_TOLERANCE) {
        guides.push({ type: 'align-center-v', position: otherCenterY - elemHeight / 2 });
      }
    }

    return guides;
  };

  // Apply snapping to position
  const applySnapping = (id: string, x: number, y: number) => {
    if (!snapEnabled) return { x, y };

    const guides = calculateGuideLines(id, x, y);
    const draggingElement = placeholders.find(p => p.id === id);
    if (!draggingElement) return { x, y };

    let snappedX = x;
    let snappedY = y;

    for (const guide of guides) {
      switch (guide.type) {
        case 'center-v':
        case 'align-left':
        case 'align-right':
        case 'align-center-h':
          snappedX = guide.position;
          break;
        case 'center-h':
        case 'align-top':
        case 'align-bottom':
        case 'align-center-v':
          snappedY = guide.position;
          break;
      }
    }

    return { x: snappedX, y: snappedY };
  };

  // Process background image upload/drop
  const processBackgroundImage = async (file: File) => {
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
      console.error('Failed to upload background image:', error);
      alert('Failed to upload background image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle canvas drag-over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set to false if leaving the viewport itself
    if ((e.target as HTMLElement) === viewportRef.current) {
      setIsDragOver(false);
    }
  };

  // Handle canvas drop with image files
  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please drop an image file');
      return;
    }

    try {
      setIsImageUploading(true);

      // Get container and viewport dimensions for coordinate calculation
      if (!containerRef.current || !viewportRef.current) {
        throw new Error('Canvas not ready');
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportRect = viewportRef.current.getBoundingClientRect();

      // Calculate drop position relative to viewport
      const dropX = e.clientX - viewportRect.left;
      const dropY = e.clientY - viewportRect.top;

      // Convert viewport coordinates to canvas coordinates
      // Account for zoom, pan, and scaling
      const canvasX = Math.round(
        (dropX - offset.x - (viewportRect.width - containerRect.width) / 2) / zoom
      );
      const canvasY = Math.round(
        (dropY - offset.y - (viewportRect.height - containerRect.height) / 2) / zoom
      );

      // Upload the image
      const uploadedUrl = await uploadCanvasImage(file);

      // Create new image placeholder
      const newImagePlaceholder: PlaceholderConfig = {
        id: `image_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        type: 'image',
        x: Math.max(0, Math.min(canvasX, dimensions.width)),
        y: Math.max(0, Math.min(canvasY, dimensions.height)),
        maxWidth: 200,
        maxHeight: 200,
        opacity: 1,
        imageUrl: uploadedUrl,
      };

      // Add to placeholders and select it
      setPlaceholders([...placeholders, newImagePlaceholder]);
      setSelectedId(newImagePlaceholder.id);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsImageUploading(false);
    }
  };

  // Handle sidebar image upload
  const handleSidebarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImageUploading(true);

      // Upload the image
      const uploadedUrl = await uploadCanvasImage(file);

      // Create new image placeholder at center of canvas
      const newImagePlaceholder: PlaceholderConfig = {
        id: `image_${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        type: 'image',
        x: dimensions.width / 2,
        y: dimensions.height / 2,
        maxWidth: 200,
        maxHeight: 200,
        opacity: 1,
        imageUrl: uploadedUrl,
      };

      // Add to placeholders and select it
      setPlaceholders([...placeholders, newImagePlaceholder]);
      setSelectedId(newImagePlaceholder.id);

      // Reset input
      e.target.value = '';
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsImageUploading(false);
    }
  };

  // Handle background image upload from file input
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processBackgroundImage(file);
  };

  // Handle background drag-over
  const handleBackgroundDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOverBg(true);
    }
  };

  // Handle background drag-leave
  const handleBackgroundDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e.target as HTMLElement) === e.currentTarget) {
      setIsDragOverBg(false);
    }
  };

  // Handle background drop
  const handleBackgroundDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverBg(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please drop an image file');
      return;
    }

    await processBackgroundImage(file);
  };

  // Delete background image
  const handleDeleteBackground = () => {
    if (window.confirm('Are you sure you want to remove the background image?')) {
      setImageUrl('');
      setDimensions({ width: 3125, height: 2400 });
    }
  };

  // Set a canvas element image as the background image
  const handleSetImageAsBackground = () => {
    if (!selectedPlaceholder || selectedPlaceholder.type !== 'image' || !selectedPlaceholder.imageUrl) {
      return;
    }

    if (
      window.confirm(
        'This will set the image as the background and remove it from canvas elements. Continue?'
      )
    ) {
      // Set the image as background
      setImageUrl(selectedPlaceholder.imageUrl);

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
      };
      img.src = selectedPlaceholder.imageUrl;

      // Remove the image placeholder from canvas
      removePlaceholder(selectedPlaceholder.id);
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
      // Initialize signature elements default config
      ...(placeholderInfo.type === 'signature' && {
        signatureElements: {
          showSignatureImage: true,
          showSignedLabel: true,
          showName: true,
          showDesignation: true,
        },
        signatureLabelText: 'Signed:',
      }),
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

    setIsDragging(true);
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

      let newX = Math.round(initialX + dx);
      let newY = Math.round(initialY + dy);

      // Calculate guides
      const guides = calculateGuideLines(id, newX, newY);
      setDragGuides(guides);

      // Apply snapping if enabled
      if (snapEnabled && guides.length > 0) {
        const snapped = applySnapping(id, newX, newY);
        newX = snapped.x;
        newY = snapped.y;
      }

      updatePlaceholder(id, {
        x: newX,
        y: newY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragGuides([]);
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
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${isPreview ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              <div
                onDragOver={handleBackgroundDragOver}
                onDragLeave={handleBackgroundDragLeave}
                onDrop={handleBackgroundDrop}
                className={`rounded-lg border-2 border-dashed transition-all ${isDragOverBg
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <label
                  htmlFor="bg-upload"
                  className="block w-full text-center py-3 cursor-pointer transition-colors"
                >
                  {isUploading ? (
                    'Uploading...'
                  ) : isDragOverBg ? (
                    <span className="text-primary font-semibold">Drop to set background</span>
                  ) : (
                    <span className="text-gray-700 hover:text-primary">Change Background Image</span>
                  )}
                </label>
              </div>
              {imageUrl && (
                <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 truncate flex-1">
                    <span className="font-medium">Background:</span> {imageUrl.split('/').pop()}
                  </p>
                  <button
                    onClick={handleDeleteBackground}
                    className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete background image"
                  >
                    <span className="material-symbols-rounded text-sm">delete</span>
                  </button>
                </div>
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${placeholders.some(item => item.id === p.id)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
                    }`}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Insert Image</h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleSidebarImageUpload}
              className="hidden"
              id="canvas-img-upload"
              disabled={isImageUploading}
            />
            <label
              htmlFor="canvas-img-upload"
              className={`flex items-center justify-center gap-2 w-full py-2 px-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-all text-sm text-gray-600 ${isImageUploading
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-primary hover:text-primary hover:bg-gray-50'
                }`}
            >
              <span className="material-symbols-rounded text-base">add_photo_alternate</span>
              <span>Upload Image</span>
            </label>
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
                {/* Image-specific controls */}
                {selectedPlaceholder.type === 'image' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Opacity</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={(selectedPlaceholder.opacity ?? 1) * 100}
                          onChange={(e) =>
                            updatePlaceholder(selectedPlaceholder.id, {
                              opacity: parseInt(e.target.value) / 100,
                            })
                          }
                          className="flex-1"
                        />
                        <span className="text-xs font-medium text-gray-600 w-8 text-right">
                          {Math.round((selectedPlaceholder.opacity ?? 1) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Width</label>
                        <input
                          type="number"
                          value={selectedPlaceholder.maxWidth || 200}
                          onChange={(e) =>
                            updatePlaceholder(selectedPlaceholder.id, {
                              maxWidth: parseInt(e.target.value),
                            })
                          }
                          className="w-full text-sm border rounded px-2 h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Height</label>
                        <input
                          type="number"
                          value={selectedPlaceholder.maxHeight || 200}
                          onChange={(e) =>
                            updatePlaceholder(selectedPlaceholder.id, {
                              maxHeight: parseInt(e.target.value),
                            })
                          }
                          className="w-full text-sm border rounded px-2 h-8"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSetImageAsBackground}
                      className="w-full mt-2 py-2 px-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-rounded text-base">image</span>
                      Set as Background
                    </button>
                  </>
                )}

                {/* Text-specific controls (not for images) */}
                {selectedPlaceholder.type !== 'image' && (
                  <>
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

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Font Family</label>
                      <select
                        value={selectedPlaceholder.fontFamily || 'Inter'}
                        onChange={(e) => {
                          loadGoogleFont(e.target.value);
                          updatePlaceholder(selectedPlaceholder.id, {
                            fontFamily: e.target.value,
                          });
                        }}
                        className="w-full text-sm border rounded px-2 h-8"
                        style={{ fontFamily: selectedPlaceholder.fontFamily || 'Inter' }}
                      >
                        {GOOGLE_FONTS.map((f) => (
                          <option
                            key={f.name}
                            value={f.name}
                            style={{ fontFamily: f.name }}
                          >
                            {f.name} ({f.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Font Size</label>
                        <input
                          type="number"
                          value={selectedPlaceholder.fontSize}
                          onChange={(e) =>
                            updatePlaceholder(selectedPlaceholder.id, {
                              fontSize: parseInt(e.target.value),
                            })
                          }
                          className="w-full text-sm border rounded px-2 h-8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Weight</label>
                        <select
                          value={selectedPlaceholder.fontWeight}
                          onChange={(e) =>
                            updatePlaceholder(selectedPlaceholder.id, {
                              fontWeight: e.target.value,
                            })
                          }
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
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() =>
                              updatePlaceholder(selectedPlaceholder.id, {
                                textAlign: align,
                              })
                            }
                            className={`flex-1 py-1 text-sm ${selectedPlaceholder.textAlign === align
                                ? 'bg-primary text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            {align.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Signature-specific controls */}
                    {selectedPlaceholder.type === 'signature' && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-3">Signature Elements</h4>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPlaceholder.signatureElements?.showSignatureImage ?? true}
                              onChange={(e) =>
                                updatePlaceholder(selectedPlaceholder.id, {
                                  signatureElements: {
                                    ...(selectedPlaceholder.signatureElements || {}),
                                    showSignatureImage: e.target.checked,
                                  },
                                })
                              }
                              className="rounded"
                            />
                            <span className="text-gray-700">Show Signature Image</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPlaceholder.signatureElements?.showSignedLabel ?? true}
                              onChange={(e) =>
                                updatePlaceholder(selectedPlaceholder.id, {
                                  signatureElements: {
                                    ...(selectedPlaceholder.signatureElements || {}),
                                    showSignedLabel: e.target.checked,
                                  },
                                })
                              }
                              className="rounded"
                            />
                            <span className="text-gray-700">Show "Signed:" Label</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPlaceholder.signatureElements?.showName ?? true}
                              onChange={(e) =>
                                updatePlaceholder(selectedPlaceholder.id, {
                                  signatureElements: {
                                    ...(selectedPlaceholder.signatureElements || {}),
                                    showName: e.target.checked,
                                  },
                                })
                              }
                              className="rounded"
                            />
                            <span className="text-gray-700">Show Name</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPlaceholder.signatureElements?.showDesignation ?? true}
                              onChange={(e) =>
                                updatePlaceholder(selectedPlaceholder.id, {
                                  signatureElements: {
                                    ...(selectedPlaceholder.signatureElements || {}),
                                    showDesignation: e.target.checked,
                                  },
                                })
                              }
                              className="rounded"
                            />
                            <span className="text-gray-700">Show Designation</span>
                          </label>
                        </div>

                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Label Text</label>
                          <input
                            type="text"
                            value={selectedPlaceholder.signatureLabelText || 'Signed:'}
                            onChange={(e) =>
                              updatePlaceholder(selectedPlaceholder.id, {
                                signatureLabelText: e.target.value,
                              })
                            }
                            placeholder="e.g., Signed:"
                            className="w-full text-sm border rounded px-2 h-8"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Position controls (common for all) */}
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

                {/* Snap to Guides Toggle */}
                <div className="border-t pt-4 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={snapEnabled}
                      onChange={(e) => setSnapEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-gray-700">
                      Snap to Guides (8px) {snapEnabled ? '✓ On' : '○ Off'}
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Guides show when dragging. Snap aligns elements automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!selectedPlaceholder && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <span className="material-symbols-rounded text-gray-300 text-4xl mb-2">touch_app</span>
              <p className="text-sm text-gray-500">Select a placeholder on the image to edit its properties</p>
              {isPreview && (
                <p className="text-xs text-primary mt-3 px-3 py-2 bg-primary/10 rounded-lg">
                  ✨ Preview Mode: You can drag and resize elements while viewing the preview!
                </p>
              )}
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleCanvasDrop}
        >
          {/* Drag Over Indicator */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-4 border-dashed border-primary rounded-lg pointer-events-none">
              <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex items-center gap-3">
                <span className="material-symbols-rounded text-primary text-3xl">add_photo_alternate</span>
                <p className="text-primary font-bold text-lg">Drop image onto canvas</p>
              </div>
            </div>
          )}

          {/* Image Uploading Overlay */}
          {isImageUploading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 rounded-lg pointer-events-none">
              <div className="flex items-center gap-2 bg-white rounded-xl px-5 py-3 shadow-lg">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-gray-700">Uploading image…</span>
              </div>
            </div>
          )}

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
                  e.stopPropagation(); // Prevent panning when dragging placeholder
                  handleMouseDown(e, p.id);
                }}
                className={`placeholder-item absolute select-none whitespace-nowrap px-2 py-1 rounded transition-shadow ${selectedId === p.id ? 'ring-2 ring-primary shadow-lg z-20 cursor-move' : 'z-10 hover:ring-1 hover:ring-primary/50 cursor-move'
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
                  backgroundColor: selectedId === p.id ? 'rgba(255,255,255,0.8)' : (isPreview ? 'transparent' : 'rgba(255,255,255,0.2)'),
                }}
              >
                {p.type === 'signature' || p.type === 'image' ? (
                  <div
                    className="relative"
                    style={{
                      width: `${(p.maxWidth || 200) * (containerRef.current?.offsetWidth || dimensions.width) / dimensions.width}px`,
                      height: `${(p.maxHeight || 100) * (containerRef.current?.offsetWidth || dimensions.width) / dimensions.width}px`,
                      opacity: p.opacity ?? 1,
                    }}
                  >
                    {p.type === 'signature' ? (
                      isPreview ? (
                        <div className="w-full h-full flex flex-col items-center justify-start">
                          {/* Signature Image */}
                          {(p.signatureElements?.showSignatureImage ?? true) && (
                            <img
                              src={getSignatureUrl(p.id)}
                              alt={p.name}
                              className="w-full flex-1 object-contain opacity-90"
                              onError={(e) => {
                                // Fallback to sample if signature image fails to load
                                (e.target as HTMLImageElement).src = SAMPLE_SIGNATURE;
                              }}
                            />
                          )}
                          {/* Signature Details - as displayed in certificate */}
                          {getSignatureDetails(p.id) && (
                            (p.signatureElements?.showSignedLabel ||
                             p.signatureElements?.showName ||
                             p.signatureElements?.showDesignation) && (
                              <div className="w-full border-t border-gray-300 bg-white/50 py-1 px-1 flex flex-col items-center justify-center">
                                {p.signatureElements?.showSignedLabel && (
                                  <p className="text-[7px] font-medium text-gray-700 leading-tight">
                                    {p.signatureLabelText || 'Signed:'}
                                  </p>
                                )}
                                {p.signatureElements?.showName && (
                                  <p className="text-[8px] font-semibold text-gray-800 leading-tight">
                                    {getSignatureDetails(p.id)?.name}
                                  </p>
                                )}
                                {p.signatureElements?.showDesignation && (
                                  <p className="text-[6px] text-gray-600 leading-tight">
                                    {getSignatureDetails(p.id)?.designation}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full border border-dashed border-gray-400 flex flex-col items-center justify-center text-[10px] text-gray-500 bg-white/50">
                          <span className="font-bold">{p.name}</span>
                          <span>{p.maxWidth}x{p.maxHeight}</span>
                          {enabledSignatures.length > 0 && (
                            <span className="text-[8px] text-primary mt-1">
                              📋 Real signature loaded
                            </span>
                          )}
                        </div>
                      )
                    ) : (
                      // Image type rendering
                      p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-contain select-none pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-400 bg-white/50">
                          <span className="material-symbols-rounded">image</span>
                        </div>
                      )
                    )}

                    {selectedId === p.id && (
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

          {/* Guide Lines Overlay */}
          {dragGuides.length > 0 && isDragging && (
            <svg
              className="absolute pointer-events-none"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                top: 0,
                left: 0,
                zIndex: 15,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                overflow: 'visible'
              }}
            >
              {dragGuides.map((guide, idx) => {
                switch (guide.type) {
                  case 'center-h':
                    return (
                      <line
                        key={idx}
                        x1={0}
                        y1={guide.position}
                        x2={dimensions.width}
                        y2={guide.position}
                        stroke="#ff6b35"
                        strokeDasharray="4,4"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    );
                  case 'center-v':
                    return (
                      <line
                        key={idx}
                        x1={guide.position}
                        y1={0}
                        x2={guide.position}
                        y2={dimensions.height}
                        stroke="#ff6b35"
                        strokeDasharray="4,4"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    );
                  case 'align-left':
                  case 'align-right':
                  case 'align-center-h':
                    return (
                      <line
                        key={idx}
                        x1={guide.position}
                        y1={0}
                        x2={guide.position}
                        y2={dimensions.height}
                        stroke="#3b82f6"
                        strokeDasharray="2,2"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    );
                  case 'align-top':
                  case 'align-bottom':
                  case 'align-center-v':
                    return (
                      <line
                        key={idx}
                        x1={0}
                        y1={guide.position}
                        x2={dimensions.width}
                        y2={guide.position}
                        stroke="#3b82f6"
                        strokeDasharray="2,2"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </svg>
          )}
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
