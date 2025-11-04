import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, PencilBrush } from 'fabric';
import type { Canvas as FabricCanvasType } from 'fabric';
import { useAuthStore } from '../store/authStore';

interface CanvasProps {
  onSolve: (imageData: string) => void;
  onStartTutor: (imageData: string) => void;
  onStartCoach: (imageData: string) => void;
  onUpdateCanvas?: () => string | null; // Callback to get current canvas image
  isProcessing: boolean;
}

const DRAWING_COLORS = {
  cyan: '#00FFFF',      // Bright cyan that glows
  pink: '#FF00FF',      // Bright magenta/pink
  yellow: '#FFFF00',    // Bright yellow
  green: '#00FF88',     // Bright neon green
  orange: '#FF6600',    // Bright orange
};

export default function Canvas({ onSolve, onStartTutor, onStartCoach, onUpdateCanvas, isProcessing }: CanvasProps) {
  // Expose function to get current canvas image
  const getCanvasImage = useCallback(() => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return null;
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    return dataURL.split(',')[1] || dataURL;
  }, []);

  // Expose getCanvasImage to parent if callback provided
  useEffect(() => {
    if (onUpdateCanvas) {
      // Store the function reference (this is a simple approach)
      // In a more complex setup, you might use useImperativeHandle
      (window as any).__getCanvasImage = getCanvasImage;
    }
    return () => {
      // Cleanup
      if ((window as any).__getCanvasImage) {
        delete (window as any).__getCanvasImage;
      }
    };
  }, [onUpdateCanvas, getCanvasImage]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvasType | null>(null);
  const [selectedColor, setSelectedColor] = useState<keyof typeof DRAWING_COLORS>('cyan');
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    // Calculate canvas size (viewport minus header)
    const updateCanvasSize = () => {
      const headerHeight = 64; // Approximate header height
      const width = window.innerWidth;
      const height = window.innerHeight - headerHeight;

      canvasElement.width = width;
      canvasElement.height = height;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Initialize Fabric.js canvas
    const fabricCanvas = new FabricCanvas(canvasElement, {
      backgroundColor: '#1a1a1a', // Dark background
      isDrawingMode: false, // Start with drawing mode off
    });

    // Create and set up the brush for free drawing
    // Must create brush before enabling drawing mode
    const brush = new PencilBrush(fabricCanvas);
    brush.width = 3;
    brush.color = DRAWING_COLORS[selectedColor];
    
    // Assign brush to canvas BEFORE enabling drawing mode
    fabricCanvas.freeDrawingBrush = brush;
    
    // Small delay to ensure brush is fully initialized
    requestAnimationFrame(() => {
      fabricCanvas.isDrawingMode = true;
    });

    // Ensure brush is always valid when drawing mode is enabled
    // This is critical - Fabric.js will crash if drawing mode is on but brush is invalid
    const ensureBrush = () => {
      if (fabricCanvas.isDrawingMode) {
        if (!fabricCanvas.freeDrawingBrush || 
            typeof fabricCanvas.freeDrawingBrush.onMouseMove !== 'function' ||
            typeof fabricCanvas.freeDrawingBrush.onMouseDown !== 'function') {
          // Temporarily disable drawing mode to prevent errors
          fabricCanvas.isDrawingMode = false;
          
          // Create new brush
          const brush = new PencilBrush(fabricCanvas);
          const oldBrush = fabricCanvas.freeDrawingBrush;
          brush.width = oldBrush?.width || 3;
          brush.color = oldBrush?.color || DRAWING_COLORS[selectedColor];
          fabricCanvas.freeDrawingBrush = brush;
          
          // Re-enable drawing mode with valid brush
          requestAnimationFrame(() => {
            fabricCanvas.isDrawingMode = true;
          });
        }
      }
    };

    // Enable zoom and pan
    fabricCanvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = fabricCanvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.max(0.1, Math.min(5, zoom));
      fabricCanvas.setZoom(zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;
    let wasDrawingMode = false;

    fabricCanvas.on('mouse:down', (opt) => {
      ensureBrush(); // Ensure brush is valid before mouse events
      if (opt.e.ctrlKey || opt.e.metaKey) {
        isPanning = true;
        wasDrawingMode = fabricCanvas.isDrawingMode;
        fabricCanvas.isDrawingMode = false; // Disable drawing for panning
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        opt.e.preventDefault();
      }
    });

    fabricCanvas.on('mouse:move', (opt) => {
      ensureBrush(); // Ensure brush is valid before mouse events
      if (isPanning) {
        const vpt = fabricCanvas.viewportTransform;
        if (vpt) {
          vpt[4] += opt.e.clientX - lastPosX;
          vpt[5] += opt.e.clientY - lastPosY;
          fabricCanvas.setViewportTransform(vpt);
          lastPosX = opt.e.clientX;
          lastPosY = opt.e.clientY;
        }
        opt.e.preventDefault();
      }
    });

    fabricCanvas.on('mouse:up', () => {
      ensureBrush(); // Ensure brush is valid
      if (isPanning) {
        fabricCanvas.isDrawingMode = wasDrawingMode; // Restore drawing mode
        isPanning = false;
      }
    });

    fabricCanvasRef.current = fabricCanvas;

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      fabricCanvas.dispose();
    };
  }, []);

  useEffect(() => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;

    // Ensure brush exists - create new one if needed
    if (!fabricCanvas.freeDrawingBrush || typeof fabricCanvas.freeDrawingBrush.onMouseMove !== 'function') {
      const brush = new PencilBrush(fabricCanvas);
      fabricCanvas.freeDrawingBrush = brush;
    }

    // Update brush properties
    if (tool === 'pencil') {
      fabricCanvas.freeDrawingBrush.width = 3;
      fabricCanvas.freeDrawingBrush.color = DRAWING_COLORS[selectedColor];
      // Disable drawing mode, update brush, then re-enable
      fabricCanvas.isDrawingMode = false;
      requestAnimationFrame(() => {
        fabricCanvas.isDrawingMode = true;
      });
    } else if (tool === 'eraser') {
      fabricCanvas.freeDrawingBrush.width = 20;
      fabricCanvas.freeDrawingBrush.color = '#1a1a1a'; // Match dark background
      // Disable drawing mode, update brush, then re-enable
      fabricCanvas.isDrawingMode = false;
      requestAnimationFrame(() => {
        fabricCanvas.isDrawingMode = true;
      });
    }
  }, [tool, selectedColor]);

  const handleColorSelect = (color: keyof typeof DRAWING_COLORS) => {
    setSelectedColor(color);
    setTool('pencil');
  };

  const handleClear = () => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;

    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#1a1a1a'; // Dark background
    fabricCanvas.renderAll();
  };

  const handleImageUpload = (file: File) => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) {
      console.error('Canvas not initialized');
      return;
    }

    if (!file) {
      console.error('No file provided');
      return;
    }

    // Temporarily disable drawing mode when adding image
    const wasDrawingMode = fabricCanvas.isDrawingMode;
    fabricCanvas.isDrawingMode = false;

    const reader = new FileReader();
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      fabricCanvas.isDrawingMode = wasDrawingMode;
    };

    reader.onload = (e) => {
      const imgUrl = e.target?.result as string;
      if (!imgUrl) {
        console.error('Failed to read file as data URL');
        fabricCanvas.isDrawingMode = wasDrawingMode;
        return;
      }

      // FabricImage.fromURL in Fabric.js v6 returns a promise
      const result = FabricImage.fromURL(imgUrl);
      
      if (result && typeof result.then === 'function') {
        // It's a promise
        result
          .then((img) => {
            if (!img) {
              console.error('Failed to create image from URL');
              fabricCanvas.isDrawingMode = wasDrawingMode;
              return;
            }

            try {
              const canvasWidth = fabricCanvas.getWidth();
              const canvasHeight = fabricCanvas.getHeight();
              const imgWidth = img.width || 1;
              const imgHeight = img.height || 1;
              const imgAspect = imgWidth / imgHeight;
              const canvasAspect = canvasWidth / canvasHeight;

              let newWidth = canvasWidth;
              let newHeight = canvasHeight;

              if (imgAspect > canvasAspect) {
                newHeight = canvasWidth / imgAspect;
              } else {
                newWidth = canvasHeight * imgAspect;
              }

              img.set({
                left: (canvasWidth - newWidth) / 2,
                top: (canvasHeight - newHeight) / 2,
                scaleX: newWidth / imgWidth,
                scaleY: newHeight / imgHeight,
                selectable: false,
                evented: false,
              });

              fabricCanvas.add(img);
              fabricCanvas.sendObjectToBack(img);
              fabricCanvas.renderAll();
              
              // Restore drawing mode
              fabricCanvas.isDrawingMode = wasDrawingMode;
            } catch (error) {
              console.error('Error setting up image:', error);
              fabricCanvas.isDrawingMode = wasDrawingMode;
            }
          })
          .catch((error) => {
            console.error('Error loading image from promise:', error);
            fabricCanvas.isDrawingMode = wasDrawingMode;
          });
      } else {
        // Fallback: try callback style
        FabricImage.fromURL(imgUrl, (img: FabricImage | null) => {
          if (!img) {
            console.error('Failed to create image from URL');
            fabricCanvas.isDrawingMode = wasDrawingMode;
            return;
          }

          try {
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            const imgWidth = img.width || 1;
            const imgHeight = img.height || 1;
            const imgAspect = imgWidth / imgHeight;
            const canvasAspect = canvasWidth / canvasHeight;

            let newWidth = canvasWidth;
            let newHeight = canvasHeight;

            if (imgAspect > canvasAspect) {
              newHeight = canvasWidth / imgAspect;
            } else {
              newWidth = canvasHeight * imgAspect;
            }

            img.set({
              left: (canvasWidth - newWidth) / 2,
              top: (canvasHeight - newHeight) / 2,
              scaleX: newWidth / imgWidth,
              scaleY: newHeight / imgHeight,
              selectable: false,
              evented: false,
            });

            fabricCanvas.add(img);
            fabricCanvas.sendObjectToBack(img);
            fabricCanvas.renderAll();
            
            // Restore drawing mode
            fabricCanvas.isDrawingMode = wasDrawingMode;
          } catch (error) {
            console.error('Error setting up image:', error);
            fabricCanvas.isDrawingMode = wasDrawingMode;
          }
        });
      }
    };

    reader.readAsDataURL(file);
  };

  const handlePaste = (e: Event) => {
    const clipboardEvent = e as ClipboardEvent;
    const items = clipboardEvent.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleImageUpload(blob);
          clipboardEvent.preventDefault();
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageUpload(files[0]);
    }
  };

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const handleSolve = () => {
    const fabricCanvas = fabricCanvasRef.current;
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });

    // Convert to base64 (remove data:image/png;base64, prefix if needed)
    const base64 = dataURL.split(',')[1] || dataURL;
    onSolve(base64);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-900"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 flex items-center space-x-2">
        {/* Color Selection */}
        {Object.entries(DRAWING_COLORS).map(([colorName, colorValue]) => (
          <button
            key={colorName}
            onClick={() => handleColorSelect(colorName as keyof typeof DRAWING_COLORS)}
            className={`w-8 h-8 rounded-full border-2 ${
              selectedColor === colorName && tool === 'pencil'
                ? 'border-white'
                : 'border-gray-600'
            }`}
            style={{ backgroundColor: colorValue }}
            title={colorName}
          />
        ))}

        {/* Eraser */}
        <button
          onClick={() => setTool('eraser')}
          className={`px-3 py-1 rounded text-white ${
            tool === 'eraser' ? 'bg-gray-700' : 'hover:bg-gray-700'
          }`}
          title="Eraser"
        >
          🧹
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="px-3 py-1 rounded text-white hover:bg-gray-700"
          title="Clear Canvas"
        >
          🗑️
        </button>

        {/* Upload */}
        <label className="px-3 py-1 rounded text-white hover:bg-gray-700 cursor-pointer" title="Upload Image">
          📤
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageUpload(file);
              }
              // Reset input so same file can be selected again
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="absolute bottom-6 right-6 z-10 flex flex-col space-y-3">
        <button
          onClick={handleSolve}
          disabled={isProcessing}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          title="Solve problem (outputs to console)"
        >
          {isProcessing ? 'Processing...' : 'Solve Problem'}
        </button>
        <button
          onClick={() => {
            const fabricCanvas = fabricCanvasRef.current;
            if (!fabricCanvas) return;
            const dataURL = fabricCanvas.toDataURL({
              format: 'png',
              quality: 1,
              multiplier: 1,
            });
            const base64 = dataURL.split(',')[1] || dataURL;
            onStartTutor(base64);
          }}
          disabled={isProcessing}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          title="Start Socratic tutor session"
        >
          {isProcessing ? 'Starting...' : 'Start Tutor'}
        </button>
        <button
          onClick={() => {
            const fabricCanvas = fabricCanvasRef.current;
            if (!fabricCanvas) return;
            const dataURL = fabricCanvas.toDataURL({
              format: 'png',
              quality: 1,
              multiplier: 1,
            });
            const base64 = dataURL.split(',')[1] || dataURL;
            onStartCoach(base64);
          }}
          disabled={isProcessing}
          className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          title="Start Coach with Google Gemini (streaming)"
        >
          {isProcessing ? 'Starting...' : 'Start Coach'}
        </button>
      </div>
    </div>
  );
}
