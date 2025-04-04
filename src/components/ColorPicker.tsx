
import React from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  // Predefined color palette
  const colorPalette = [
    '#ff5555', // Red
    '#ffaa55', // Orange
    '#ffff55', // Yellow
    '#55ff55', // Green
    '#55ffff', // Cyan
    '#5555ff', // Blue
    '#ff55ff', // Magenta
    '#ffffff', // White
    '#aaaaaa', // Light Gray
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {colorPalette.map((paletteColor) => (
        <div
          key={paletteColor}
          className={`color-swatch ${color === paletteColor ? 'ring-2 ring-primary' : ''}`}
          style={{ backgroundColor: paletteColor }}
          onClick={() => onChange(paletteColor)}
        />
      ))}
      
      {/* Custom color input */}
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 cursor-pointer"
      />
    </div>
  );
};

export default ColorPicker;
