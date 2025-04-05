import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, RotateCcw, Share2, Settings, ChevronRight, ChevronLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { encodePreset } from '@/lib/encoding/presetEncoder';

// Function to generate random colors
const generateRandomColor = () => {
  // Generate muted, stylish colors instead of fully saturated ones
  const h = Math.floor(Math.random() * 360); // Hue: 0-359
  const s = 40 + Math.floor(Math.random() * 30); // Saturation: 40-69%
  const l = 40 + Math.floor(Math.random() * 20); // Lightness: 40-59%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
};

interface ControlPanelProps {
  position: { x: number; y: number };
  onClose: () => void;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  position,
  onClose,
  settings,
  setSettings
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const controllerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Main panel animation
  const panelSpring = useSpring({
    opacity: 1,
    transform: 'scale(1)',
    from: { opacity: 0, transform: 'scale(0.9)' },
    config: config.wobbly
  });

  // Handle export functionality
  const handleExport = () => {
    try {
      const encoded = encodePreset(settings);
      const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
      
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: "Preset Exported",
          description: "URL copied to clipboard!",
        });
      }).catch(() => {
        toast({
          title: "Export Failed",
          description: "Could not copy to clipboard",
          variant: "destructive",
        });
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not encode preset",
        variant: "destructive",
      });
    }
  };

  // Ensure controller stays within screen bounds
  const calculatePanelPosition = () => {
    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Panel dimensions (approximate)
    const panelWidth = viewportWidth < 768 ? viewportWidth - 32 : 400; // Full width - margins on mobile
    const panelHeight = 500;
    
    // On mobile, center horizontally and position near top
    if (viewportWidth < 768) {
      return {
        left: 16, // 16px margin on each side
        top: 16,  // Position near top with 16px margin
        width: panelWidth
      };
    }
    
    // Desktop positioning logic
    let left;
    let top;
    
    // Horizontal positioning - prefer positioning near the click if possible
    if (position.x + panelWidth > viewportWidth - 20) {
      // Too close to right edge, move it left
      left = Math.max(10, viewportWidth - panelWidth - 20);
    } else if (position.x - 20 < 0) {
      // Too close to left edge, move it right
      left = 20;
    } else {
      // Position it near the click
      left = position.x - 20;
    }
    
    // Vertical positioning
    if (position.y + panelHeight > viewportHeight - 20) {
      // Too close to bottom edge, move it up
      top = Math.max(10, viewportHeight - panelHeight - 20);
    } else if (position.y - 20 < 0) {
      // Too close to top edge, move it down
      top = 20;
    } else {
      // Position it near the click
      top = position.y - 20;
    }
    
    return { left, top, width: panelWidth };
  };

  // Calculate position once when component mounts
  const panelPosition = calculatePanelPosition();

  // Handle clicks outside the controller to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (controllerRef.current && !controllerRef.current.contains(event.target as Node)) {
        // If clicking outside the controller but on the panel, don't close
        if (panelRef.current && panelRef.current.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Menu items 
  const menuItems = [
    { id: 'layer1', label: 'Layer 1', color: 'from-pink-500 to-rose-600' },
    { id: 'layer2', label: 'Layer 2', color: 'from-blue-500 to-indigo-600' },
    { id: 'goo', label: 'Goo Effect', color: 'from-emerald-500 to-teal-600' },
  ];

  // Animation for menu items
  const menuItemSprings = menuItems.map((_, index) => 
    useSpring({
      opacity: 1,
      transform: 'translateY(0px)',
      from: { opacity: 0, transform: 'translateY(20px)' },
      delay: 100 + (index * 50),
      config: config.wobbly
    })
  );

  // Update settings with new values
  const handleUpdateSetting = (section: string, property: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: value
      }
    }));
  };

  // Reset settings to defaults with random colors
  const resetSettings = () => {
    const randomColor1 = generateRandomColor();
    const randomColor2 = generateRandomColor();
    
    setSettings({
      layer1: {
        spacing: 30,
        size: 8,
        rotation: 0,
        color: randomColor1
      },
      layer2: {
        spacing: 30,
        size: 8,
        rotation: 45,
        color: randomColor2
      },
      goo: {
        enabled: false,
        blur: 8,
        threshold: 128,
        resolution: 100
      }
    });

    toast({
      title: "Settings Reset",
      description: "All settings have been reset with new random colors",
    });
  };

  // Calculate the best position for the settings panel
  const getSettingsPanelPosition = () => {
    // Check if we're near the right edge of the screen
    const isRightSide = position.x > window.innerWidth / 2;
    
    if (isRightSide) {
      return {
        right: '20px',
        top: `${panelPosition.top}px`
      };
    } else {
      return {
        left: `${panelPosition.left + 420}px`,
        top: `${panelPosition.top}px`
      };
    }
  };

  return (
    <>
      {/* Main Control Panel */}
      <animated.div
        ref={controllerRef}
        className="fixed z-50"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
          ...panelSpring
        }}
      >
        <div className="bg-zinc-900/95 backdrop-blur-lg overflow-hidden shadow-xl">
          {/* Main content area */}
          <div className="flex">
            {/* Left sidebar with tabs */}
            <div className="w-1/3 flex flex-col border-r border-zinc-700">
              {menuItems.map(({ id, label, color }, index) => (
                <animated.button
                  key={id}
                  style={menuItemSprings[index]}
                  className={cn(
                    "py-2 px-3 text-left focus:outline-none",
                    activeSection === id 
                      ? id === 'layer1' 
                        ? "bg-amber-700/70 text-amber-50" 
                        : id === 'layer2'
                          ? "bg-teal-800/70 text-teal-50"
                          : "bg-rose-900/70 text-rose-50"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  )}
                  onClick={() => setActiveSection(id)}
                >
                  <div className="font-medium">{label}</div>
                </animated.button>
              ))}
              
              {/* Export button */}
              <animated.button
                style={menuItemSprings[3]}
                className="mt-auto py-2 px-3 text-left bg-amber-800/80 text-amber-50 hover:bg-amber-700/80 transition-all focus:outline-none"
                onClick={handleExport}
              >
                <div className="font-medium flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Export Preset
                </div>
              </animated.button>
            </div>
            
            {/* Right side with settings */}
            <div className="w-2/3 bg-zinc-800/70 p-2">
              {activeSection ? (
                <div className="animate-in fade-in duration-300">
                  {activeSection === 'goo' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">Enable Effects</label>
                        <Switch
                          checked={settings.goo.enabled}
                          onCheckedChange={(checked) => handleUpdateSetting('goo', 'enabled', checked)}
                          className="data-[state=checked]:bg-rose-700"
                        />
                      </div>
                      
                      {settings.goo.enabled && (
                        <>
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">Blur</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.goo.blur}</span>
                            </div>
                            <Slider
                              value={[settings.goo.blur]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) => handleUpdateSetting('goo', 'blur', value[0])}
                            />
                          </div>
                          
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">Threshold</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.goo.threshold}</span>
                            </div>
                            <Slider
                              value={[settings.goo.threshold]}
                              min={1}
                              max={255}
                              step={1}
                              onValueChange={(value) => handleUpdateSetting('goo', 'threshold', value[0])}
                            />
                          </div>
                          
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">Resolution</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.goo.resolution}%</span>
                            </div>
                            <Slider
                              value={[settings.goo.resolution]}
                              min={10}
                              max={100}
                              step={5}
                              onValueChange={(value) => handleUpdateSetting('goo', 'resolution', value[0])}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Layer settings */}
                  {(activeSection === 'layer1' || activeSection === 'layer2') && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Spacing</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].spacing}px</span>
                        </div>
                        <Slider
                          value={[settings[activeSection].spacing]}
                          min={10}
                          max={100}
                          step={1}
                          onValueChange={(value) => handleUpdateSetting(activeSection, 'spacing', value[0])}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Size</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].size}px</span>
                        </div>
                        <Slider
                          value={[settings[activeSection].size]}
                          min={1}
                          max={80}
                          step={0.5}
                          onValueChange={(value) => handleUpdateSetting(activeSection, 'size', value[0])}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Rotation</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].rotation}°</span>
                        </div>
                        <Slider
                          value={[settings[activeSection].rotation]}
                          min={0}
                          max={360}
                          step={1}
                          onValueChange={(value) => handleUpdateSetting(activeSection, 'rotation', value[0])}
                        />
                      </div>

                      <div>
                        <label className="text-sm text-zinc-200">Color</label>
                        <div className="color-picker-container relative h-12">
                          <input
                            type="color"
                            value={settings[activeSection].color}
                            onChange={(e) => handleUpdateSetting(activeSection, 'color', e.target.value)}
                            className="w-full h-full opacity-100 cursor-pointer absolute z-10"
                          />
                          <div 
                            className="absolute inset-0 pointer-events-none"
                            style={{ backgroundColor: settings[activeSection].color }}
                          />
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs bg-zinc-900/80 text-zinc-200 font-mono pointer-events-none">
                            {settings[activeSection].color.toUpperCase()}
                          </div>
                        </div>
                        <div className="mt-1.5 grid grid-cols-6 gap-1">
                          {['#ff5555', '#5555ff', '#55ff55', '#ffff55', '#ff55ff', '#55ffff', 
                            '#ff9955', '#9955ff', '#55ff99', '#99ff55', '#ff55aa', '#55aaff'].map((color) => (
                            <button
                              key={color}
                              className="w-full aspect-square hover:opacity-80 focus:outline-none"
                              style={{ backgroundColor: color }}
                              onClick={() => handleUpdateSetting(activeSection, 'color', color)}
                              aria-label={`Select color ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                  <Settings className="w-8 h-8" />
                  <p className="text-sm">Select a category</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </animated.div>
    </>
  );
};

export default ControlPanel; 