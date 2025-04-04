
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, RotateCcw } from "lucide-react";
import ColorPicker from './ColorPicker';

interface RadialMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const RadialMenu: React.FC<RadialMenuProps> = ({
  position,
  onClose,
  settings,
  setSettings
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Calculate menu size and position based on screen size
  const menuSize = Math.min(window.innerWidth, window.innerHeight) * 0.6;
  const menuRadius = menuSize / 2;
  
  // Ensure menu stays within screen bounds - use the position directly from props
  const menuX = Math.min(Math.max(position.x, menuRadius), window.innerWidth - menuRadius);
  const menuY = Math.min(Math.max(position.y, menuRadius), window.innerHeight - menuRadius);
  
  useEffect(() => {
    // Handle clicks outside the menu to close it
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Calculate positions for menu items in a circle
  const menuItems = [
    { id: 'layer1', label: 'Layer 1', icon: '1' },
    { id: 'layer2', label: 'Layer 2', icon: '2' },
    { id: 'goo', label: 'Goo Effect', icon: 'G' },
  ];
  
  const itemPositions = menuItems.map((item, index) => {
    const angle = (index * 2 * Math.PI) / menuItems.length;
    const radius = menuRadius * 0.6; // Position items at 60% of menu radius
    return {
      ...item,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  });
  
  const handleUpdateSetting = (section: string, property: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: value
      }
    }));
  };
  
  const resetSettings = () => {
    setSettings({
      layer1: {
        spacing: 30,
        size: 8,
        rotation: 0,
        color: '#ff5555'
      },
      layer2: {
        spacing: 30,
        size: 8,
        rotation: 45,
        color: '#5555ff'
      },
      goo: {
        blur: 8,
        threshold: 128,
        resolution: 100 // Default is full resolution
      }
    });
  };

  // Calculate settings panel position - place it beside the menu, not on top
  const getPanelPosition = () => {
    // Position the panel to the right of the menu by default
    let left = menuX + menuRadius + 20; // 20px padding
    let top = menuY - 150; // Center vertically

    // Check if panel would go off the right edge of the screen
    if (left + 300 > window.innerWidth) { // Assuming panel width is ~300px
      left = menuX - menuRadius - 320; // Position to the left instead
    }

    // Make sure panel doesn't go off the top or bottom
    if (top < 20) {
      top = 20;
    } else if (top + 300 > window.innerHeight) {
      top = window.innerHeight - 320;
    }

    return { left, top };
  };

  const panelPosition = getPanelPosition();

  return (
    <div className="fixed z-50">
      {/* Main menu circle */}
      <div 
        ref={menuRef}
        className="absolute animate-scale-in"
        style={{
          width: menuSize,
          height: menuSize,
          left: menuX - menuRadius,
          top: menuY - menuRadius
        }}
      >
        <div className="absolute w-full h-full rounded-full glass-panel flex items-center justify-center">
          {/* Menu title */}
          <div className="absolute top-6 text-center w-full text-primary font-semibold">
            Moire Control Panel
          </div>
          
          {/* Close button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          {/* Reset button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 left-2 rounded-full"
            onClick={resetSettings}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          {/* Menu items */}
          {itemPositions.map((item) => (
            <div
              key={item.id}
              className={`radial-menu-item w-16 h-16 ${activeSection === item.id ? 'bg-primary/20 text-primary' : ''}`}
              style={{
                transform: `translate(${item.x}px, ${item.y}px)`
              }}
              onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
            >
              <div className="text-center">
                <div className="text-lg font-bold">{item.icon}</div>
                <div className="text-xs">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Settings panel - positioned beside the radial menu */}
      {activeSection && (
        <div 
          className="fixed bg-background/90 backdrop-blur rounded-lg p-4 shadow-lg animate-fade-in w-72"
          style={{
            left: panelPosition.left,
            top: panelPosition.top
          }}
        >
          <h3 className="text-primary font-semibold mb-4 text-center">
            {activeSection === 'layer1' ? 'Layer 1 Settings' : 
             activeSection === 'layer2' ? 'Layer 2 Settings' : 
             'Goo Effect Settings'}
          </h3>
          
          {(activeSection === 'layer1' || activeSection === 'layer2') && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Dot Spacing: {settings[activeSection].spacing}px</label>
                <Slider 
                  value={[settings[activeSection].spacing]} 
                  min={10} 
                  max={80} 
                  step={1}
                  onValueChange={(value) => handleUpdateSetting(activeSection, 'spacing', value[0])}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Dot Size: {settings[activeSection].size}px</label>
                <Slider 
                  value={[settings[activeSection].size]} 
                  min={1} 
                  max={20} 
                  step={1}
                  onValueChange={(value) => handleUpdateSetting(activeSection, 'size', value[0])}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Rotation: {settings[activeSection].rotation}°</label>
                <Slider 
                  value={[settings[activeSection].rotation]} 
                  min={0} 
                  max={360} 
                  step={5}
                  onValueChange={(value) => handleUpdateSetting(activeSection, 'rotation', value[0])}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Color</label>
                <ColorPicker 
                  color={settings[activeSection].color}
                  onChange={(color) => handleUpdateSetting(activeSection, 'color', color)}
                />
              </div>
            </div>
          )}
          
          {activeSection === 'goo' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Resolution: {settings.goo.resolution}%</label>
                <Slider 
                  value={[settings.goo.resolution]} 
                  min={5} 
                  max={100} 
                  step={5}
                  onValueChange={(value) => handleUpdateSetting('goo', 'resolution', value[0])}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Blur: {settings.goo.blur}px</label>
                <Slider 
                  value={[settings.goo.blur]} 
                  min={0} 
                  max={20} 
                  step={1}
                  onValueChange={(value) => handleUpdateSetting('goo', 'blur', value[0])}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Threshold: {settings.goo.threshold}</label>
                <Slider 
                  value={[settings.goo.threshold]} 
                  min={0} 
                  max={255} 
                  step={1}
                  onValueChange={(value) => handleUpdateSetting('goo', 'threshold', value[0])}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RadialMenu;
