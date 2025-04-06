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
    { id: 'goo', label: 'Effects', color: 'from-emerald-500 to-teal-600' },
    { id: 'touch', label: 'Touch', color: 'from-purple-500 to-indigo-600' },
    { id: 'lfo', label: 'LFO', color: 'from-amber-500 to-amber-600' },
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
    // Track the last changed parameter for LFO target
    if (section !== 'lfo' && property !== 'lastChangedParam') {
      setSettings((prev: any) => ({
        ...prev,
        lfo: {
          ...prev.lfo,
          lastChangedParam: {
            section,
            property
          }
        }
      }));
    }
    
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
        color: randomColor1,
        type: 'dots'
      },
      layer2: {
        spacing: 30,
        size: 8,
        rotation: 45,
        color: randomColor2,
        type: 'dots'
      },
      goo: {
        enabled: false,
        blur: 8,
        threshold: 128,
        prePixelate: 1,
        postPixelate: 1
      },
      touch: {
        enablePinchZoom: true,
        enablePinchRotate: true
      },
      lfo: {
        enabled: false,
        targetSection: 'layer1',
        targetProperty: 'rotation',
        rate: 0.1,
        amount: 10,
        lastChangedParam: {
          section: 'layer1',
          property: 'rotation'
        }
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

  // Map slider value to logarithmic scale
  const expScale = (value, min, max) => {
    return min * Math.pow(max/min, value);
  }

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
                          : id === 'goo'
                            ? "bg-rose-900/70 text-rose-50"
                            : id === 'lfo'
                              ? "bg-amber-800/80 text-amber-50 hover:bg-amber-700/80"
                              : "bg-purple-900/70 text-purple-50"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  )}
                  onClick={() => setActiveSection(id)}
                >
                  <div className="font-medium">{label}</div>
                </animated.button>
              ))}
              
              {/* Export button */}
              <animated.button
                style={menuItemSprings[4]}
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
                              <label className="text-sm text-zinc-200">Pre-Pixelate</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.goo.prePixelate}</span>
                            </div>
                            <Slider
                              value={[settings.goo.prePixelate]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) => handleUpdateSetting('goo', 'prePixelate', value[0])}
                            />
                          </div>

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
                              <label className="text-sm text-zinc-200">Post-Pixelate</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.goo.postPixelate}</span>
                            </div>
                            <Slider
                              value={[settings.goo.postPixelate]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) => handleUpdateSetting('goo', 'postPixelate', value[0])}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  
                  {activeSection === 'touch' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">Pinch to Zoom</label>
                        <Switch
                          checked={settings.touch?.enablePinchZoom ?? true}
                          onCheckedChange={(checked) => handleUpdateSetting('touch', 'enablePinchZoom', checked)}
                          className="data-[state=checked]:bg-purple-700"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">Pinch to Rotate</label>
                        <Switch
                          checked={settings.touch?.enablePinchRotate ?? true}
                          onCheckedChange={(checked) => handleUpdateSetting('touch', 'enablePinchRotate', checked)}
                          className="data-[state=checked]:bg-purple-700"
                        />
                      </div>
                    </div>
                  )}

                  {activeSection === 'lfo' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">Enable LFO</label>
                        <Switch
                          checked={settings.lfo?.enabled ?? false}
                          onCheckedChange={(checked) => handleUpdateSetting('lfo', 'enabled', checked)}
                          className="data-[state=checked]:bg-amber-700"
                        />
                      </div>
                      
                      <div className="mt-2 p-2 bg-zinc-900/50 rounded-sm">
                        <p className="text-sm text-zinc-300 mb-1">
                          Modulating: <span className="font-semibold">{`${settings.lfo.lastChangedParam.section}.${settings.lfo.lastChangedParam.property}`}</span>
                          <span className="ml-1 text-xs opacity-70">
                            {settings.lfo.lastChangedParam.property === 'rotation' && '(degrees)'}
                            {settings.lfo.lastChangedParam.property === 'spacing' && '(px)'}
                            {settings.lfo.lastChangedParam.property === 'size' && '(px)'}
                            {(settings.lfo.lastChangedParam.property === 'blur' || 
                              settings.lfo.lastChangedParam.property === 'threshold' || 
                              settings.lfo.lastChangedParam.property === 'prePixelate' || 
                              settings.lfo.lastChangedParam.property === 'postPixelate') && '(value)'}
                          </span>
                        </p>                    
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Rate (Hz)</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings.lfo.rate.toFixed(3)} Hz</span>
                        </div>
                        <Slider
                          value={[Math.log(settings.lfo.rate / 0.001) / Math.log(5000)]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) => {
                            const logRate = 0.001 * Math.pow(5000, value[0]);
                            handleUpdateSetting('lfo', 'rate', logRate);
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Amount</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                            {settings.lfo.amount}
                            <span className="opacity-70 ml-1">
                              {settings.lfo.lastChangedParam.property === 'rotation' && '°'}
                              {settings.lfo.lastChangedParam.property === 'spacing' && 'px'}
                              {settings.lfo.lastChangedParam.property === 'size' && 'px'}
                            </span>
                          </span>
                        </div>
                        <Slider
                          value={[settings.lfo.amount]}
                          min={0}
                          max={100}
                          step={0.1}
                          onValueChange={(value) => handleUpdateSetting('lfo', 'amount', value[0])}
                        />
                        <p className="text-xs text-zinc-400 mt-1">
                          Range: ±{settings.lfo.amount}{' '}
                          {settings.lfo.lastChangedParam.property === 'rotation' ? '°' : 
                           settings.lfo.lastChangedParam.property === 'spacing' || 
                           settings.lfo.lastChangedParam.property === 'size' ? 'px' : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Layer settings */}
                  {(activeSection === 'layer1' || activeSection === 'layer2') && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Type</label>
                          <select
                            value={settings[activeSection].type}
                            onChange={(e) => handleUpdateSetting(activeSection, 'type', e.target.value)}
                            className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono"
                          >
                            <option value="dots">Dots</option>
                            <option value="lines">Lines</option>
                            <option value="squares">Concentric Squares</option>
                          </select>
                        </div>
                      </div>

                      {/* Conditional control for concentric shapes */}
                      {settings[activeSection].type === 'squares' && (
                        <>
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">Number of Squares</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].numShapes || 3}</span>
                            </div>
                            <Slider
                              value={[settings[activeSection].numShapes || 3]}
                              min={1}
                              max={30}
                              step={1}
                              onValueChange={(value) => handleUpdateSetting(activeSection, 'numShapes', value[0])}
                            />
                          </div>
                          
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">Stroke Width</label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].strokeWidth || 1}px</span>
                            </div>
                            <Slider
                              value={[settings[activeSection].strokeWidth || 1]}
                              min={0.5}
                              max={10}
                              step={0.5}
                              onValueChange={(value) => handleUpdateSetting(activeSection, 'strokeWidth', value[0])}
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Spacing</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">{settings[activeSection].spacing}px</span>
                        </div>
                        <Slider
                          value={[settings[activeSection].spacing]}
                          min={10}
                          max={200}
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
                          max={300}
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
                          step={0.1}
                          onValueChange={(value) => handleUpdateSetting(activeSection, 'rotation', value[0])}
                        />
                      </div>

                      <div>
                        <label className="text-sm text-zinc-200">Color</label>
                        <div className="relative h-12">
                          <input
                            type="color"
                            value={settings[activeSection].color}
                            onChange={(e) => handleUpdateSetting(activeSection, 'color', e.target.value)}
                            className="w-full h-full opacity-0 cursor-pointer absolute z-10"
                          />
                          <div 
                            className="absolute inset-0"
                            style={{ backgroundColor: settings[activeSection].color }}
                          />
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