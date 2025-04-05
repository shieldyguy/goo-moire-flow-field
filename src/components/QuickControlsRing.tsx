import React, { useState, useEffect } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { RefreshCw, Maximize, Download, ChevronUp, ChevronDown, Zap, X, Sliders, Palette, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

// For responsive design
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;

interface QuickControlsRingProps {
  position: { x: number, y: number };
  onClose: () => void;
  onAction: (actionType: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface Position {
  x: number;
  y: number;
}

const QuickControlsRing: React.FC<QuickControlsRingProps> = ({ position, onClose, onAction, open, setOpen }) => {
  const isMobile = IS_MOBILE;
  const [safePosition, setSafePosition] = useState<Position>(position);

  // Calculate safe position to ensure the ring stays within viewport bounds
  const calculateSafePosition = (pos: Position): Position => {
    if (typeof window === 'undefined') return pos;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Approximate dimensions of the control ring
    const ringWidth = isMobile ? 210 : 210;
    const ringHeight = isMobile ? 210 : 210;
    
    // Calculate bounds to keep ring fully visible
    const minX = ringWidth / 2;
    const maxX = viewportWidth - (ringWidth / 2);
    const minY = ringHeight / 2;
    const maxY = viewportHeight - (ringHeight / 2);
    
    return {
      x: Math.min(Math.max(pos.x, minX), maxX),
      y: Math.min(Math.max(pos.y, minY), maxY)
    };
  };

  // Update safe position when props position changes
  useEffect(() => {
    setSafePosition(calculateSafePosition(position));
  }, [position]);

  // Ring spring animation
  const ringSpring = useSpring({
    opacity: open ? 1 : 0,
    scale: open ? 1 : 0.5,
    config: config.gentle
  });

  // Define a function for center button click (can be the same as onClose or do something else)
  const centerButtonClick = () => {
    onClose();
  };

  // Define functions for the various actions
  const toggleLayer1 = () => {
    onAction('reset');
    onClose();
  };

  const centerMenu = () => {
    onAction('randomize');
    onClose();
  };

  const toggleLayer2 = () => {
    onAction('export');
    onClose();
  };

  return (
    <animated.div
      className="fixed z-40"
      style={{ 
        left: safePosition.x, 
        top: safePosition.y, 
        transform: 'translate(-50%, -50%)', 
        ...ringSpring
      }}
    >
      {/* Center button */}
      <button 
        className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 
        w-16 h-16 rounded-sm bg-zinc-900 border-2 border-zinc-700 
        text-zinc-300 flex items-center justify-center
        hover:border-zinc-600 hover:text-zinc-100 z-10`}
        onClick={centerButtonClick}
      >
        <Sliders size={22} />
      </button>

      {/* Ring of action buttons */}
      <div className="grid grid-cols-3 grid-rows-3 gap-3" style={{ width: '210px', height: '210px' }}>
        {/* Empty cells for corners in the grid for better spacing */}
        <div></div>

        {/* Top */}
        <button 
          className={`
            ${isMobile ? 'w-14 h-14' : 'w-16 h-16'} 
            rounded-sm bg-amber-800/80 border-2 border-amber-700/60 
            text-amber-100 flex items-center justify-center
            hover:border-amber-600 transition-colors
          `}
          onClick={toggleLayer1}
        >
          <RefreshCw size={isMobile ? 18 : 22} />
        </button>

        <div></div>

        {/* Left */}
        <button 
          className={`
            ${isMobile ? 'w-14 h-14' : 'w-16 h-16'} 
            rounded-sm bg-teal-800/80 border-2 border-teal-700/60 
            text-teal-100 flex items-center justify-center
            hover:border-teal-600 transition-colors
          `}
          onClick={centerMenu}
        >
          <Maximize size={isMobile ? 18 : 22} />
        </button>

        {/* Center is empty - center button is positioned absolute */}
        <div className="flex items-center justify-center">
          {/* Center button is positioned absolute above */}
        </div>

        {/* Right */}
        <button 
          className={`
            ${isMobile ? 'w-14 h-14' : 'w-16 h-16'} 
            rounded-sm bg-rose-900/80 border-2 border-rose-800/60 
            text-rose-100 flex items-center justify-center
            hover:border-rose-700 transition-colors
          `}
          onClick={toggleLayer2}
        >
          <Download size={isMobile ? 18 : 22} />
        </button>

        <div></div>

        {/* Bottom */}
        <button 
          className={`
            ${isMobile ? 'w-14 h-14' : 'w-16 h-16'} 
            rounded-sm bg-zinc-800 border-2 border-zinc-700 
            text-zinc-400 flex items-center justify-center
            hover:border-zinc-600 hover:text-zinc-200 transition-colors
          `}
          onClick={() => setOpen(false)}
        >
          <X size={isMobile ? 18 : 22} />
        </button>

        <div></div>
      </div>
    </animated.div>
  );
};

export default QuickControlsRing; 