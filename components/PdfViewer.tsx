
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PdfViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: string;
  onScrollToEnd?: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file, onScrollToEnd }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setHasReachedEnd(false);
  };

  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => {
      const nextPage = Math.min(prev + 1, numPages || 1);
      if (nextPage === numPages && !hasReachedEnd) {
        setHasReachedEnd(true);
        onScrollToEnd?.();
      }
      return nextPage;
    });
  }, [numPages, hasReachedEnd, onScrollToEnd]);

  // Handle container resize for responsive PDF rendering
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (event.key === 'ArrowRight') {
        goToNextPage();
      } else if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPrevPage, goToNextPage]);

  // Auto-play logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && numPages) {
      interval = setInterval(() => {
        setPageNumber(prev => {
          if (prev < numPages) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            if (!hasReachedEnd) {
              setHasReachedEnd(true);
              onScrollToEnd?.();
            }
            return prev;
          }
        });
      }, 3000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, numPages, hasReachedEnd, onScrollToEnd]);

  const togglePlay = () => {
    if (pageNumber === numPages) {
      setPageNumber(1);
    }
    setIsPlaying(!isPlaying);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={viewerRef}
      className={`flex flex-col bg-gray-100 dark:bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen p-0 fullscreen' : 'w-full h-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800'}`}
    >
      {/* Main Content Area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 ${isFullscreen ? 'p-0' : 'p-4'}`}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full w-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full w-full text-red-500 gap-2">
              <span className="material-symbols-outlined text-4xl">error</span>
              <p>Failed to load PDF</p>
            </div>
          }
          className="max-h-full max-w-full shadow-2xl h-full"
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth ? Math.max(300, Math.min(containerWidth - (isFullscreen ? 0 : 32), 1200)) : undefined}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Controls Bar */}
      <div className={`bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 shrink-0 ${isFullscreen ? 'p-3' : 'p-4'}`}>
        {/* Play/Pause & Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 transition-colors"
            title="Previous Page"
          >
            <span className="material-symbols-rounded text-2xl">skip_previous</span>
          </button>

          <button
            onClick={togglePlay}
            className="p-3 rounded-full bg-indigo text-white hover:bg-indigo-600 transition-colors shadow-md hover:shadow-lg active:scale-95 transform duration-100"
            title={isPlaying ? "Pause" : "Play Slideshow"}
          >
            <span className="material-symbols-rounded text-2xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 0)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 transition-colors"
            title="Next Page"
          >
            <span className="material-symbols-rounded text-2xl">skip_next</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xl mx-4 hidden sm:block">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Page {pageNumber}</span>
            <span>{numPages || '--'}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 cursor-pointer group"
            onClick={(e) => {
              if (!numPages) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const newPage = Math.max(1, Math.min(numPages, Math.ceil(percentage * numPages)));
              setPageNumber(newPage);
              if (newPage === numPages && !hasReachedEnd) {
                setHasReachedEnd(true);
                onScrollToEnd?.();
              }
            }}>
            <div
              className="bg-indigo h-1.5 rounded-full transition-all duration-300 relative group-hover:bg-indigo-600"
              style={{ width: `${((pageNumber) / (numPages || 1)) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow opacity-70 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
        </div>

        {/* Page Count & Fullscreen */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
            <span className="text-gray-900 dark:text-white">{pageNumber}</span> / {numPages || '--'}
          </span>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span className="material-symbols-rounded text-2xl">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;