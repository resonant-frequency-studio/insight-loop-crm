import { useRef } from "react";

/**
 * Hook to handle sidebar drag-to-resize functionality
 */
export function useSidebarDrag(
  isCollapsed: boolean,
  setIsCollapsed: (value: boolean) => void
) {
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle if this click actually started on the collapse handle or its children
    const target = e.target as Node;
    const currentTarget = e.currentTarget as HTMLElement;
    if (target !== currentTarget && !currentTarget.contains(target)) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startCollapsed = isCollapsed;
    const dragThreshold = 10; // Minimum pixels to move before considering it a drag
    const pointerId = e.pointerId;
    const handleElement = e.currentTarget as HTMLElement;
    
    let hasMoved = false;
    let finalDeltaX = 0;
    let isActive = true;

    // Prevent text selection during drag
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    const originalPointerEvents = document.body.style.pointerEvents;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    document.body.style.pointerEvents = 'auto';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      // Only handle if this is the same pointer interaction and still active
      if (moveEvent.pointerId !== pointerId || !isActive) return;
      
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      finalDeltaX = deltaX;
      
      if (Math.abs(deltaX) > dragThreshold) {
        hasMoved = true;
        isDraggingRef.current = true;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      // Only handle if this is the same pointer interaction and still active
      if (upEvent.pointerId !== pointerId || !isActive) return;
      
      isActive = false;
      upEvent.preventDefault();
      
      // Restore styles
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
      document.body.style.pointerEvents = originalPointerEvents;
      
      const wasDragging = hasMoved;
      isDraggingRef.current = false;
      
      if (wasDragging) {
        // Snap based on drag direction
        // Dragging left (negative deltaX) → collapse
        // Dragging right (positive deltaX) → expand
        if (finalDeltaX < 0) {
          setIsCollapsed(true);
        } else {
          setIsCollapsed(false);
        }
      } else {
        // If no drag occurred, toggle on click
        setIsCollapsed(!startCollapsed);
      }
      
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      
      // Release pointer capture
      if (handleElement.hasPointerCapture && handleElement.hasPointerCapture(pointerId)) {
        handleElement.releasePointerCapture(pointerId);
      }
    };

    // Set pointer capture FIRST to ensure we only get events for this interaction
    // This prevents other elements from receiving pointer events during the drag
    try {
      handleElement.setPointerCapture(pointerId);
    } catch {
      // If pointer capture fails, don't set up drag handlers
      // Restore styles and return early
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
      document.body.style.pointerEvents = originalPointerEvents;
      return;
    }
    
    // Use capture phase to ensure we catch events, but only for this specific pointer
    // The pointerId check ensures we only handle events from this interaction
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsCollapsed(!isCollapsed);
    }
  };

  return {
    handlePointerDown,
    handleKeyDown,
  };
}

