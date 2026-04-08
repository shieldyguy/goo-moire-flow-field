import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSpring, animated, config } from "@react-spring/web";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  X,
  RotateCcw,
  Share2,
  Settings,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { encodePreset, MovementData } from "@/lib/encoding/presetEncoder";
import { uploadOgImage } from "@/lib/uploadOgImage";

// ─── Color helpers ───
const hslToHex = (hsl: string): string => {
  const m = hsl.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (!m) return hsl; // already hex or unknown format, pass through
  const h = parseInt(m[1]) / 360;
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1/3); g = hue2rgb(h); b = hue2rgb(h - 1/3);
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// ─── Music note helpers ───
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const hzToMidi = (hz: number): number => Math.round(12 * Math.log2(hz / 440) + 69);
const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
const hzToNoteName = (hz: number): string => {
  const midi = hzToMidi(hz);
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
};

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
  getSnapshot?: () => HTMLCanvasElement | null;
  getMovement?: () => MovementData;
  initializeAudio?: () => Promise<boolean>;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  position,
  onClose,
  settings,
  setSettings,
  getSnapshot,
  getMovement,
  initializeAudio,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const controllerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Main panel animation
  const panelSpring = useSpring({
    opacity: 1,
    transform: "scale(1)",
    from: { opacity: 0, transform: "scale(0.9)" },
    config: config.wobbly,
  });

  // Handle export functionality
  const handleExport = () => {
    try {
      const movement = getMovement?.();
      const encoded = encodePreset(settings, movement);
      const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;

      navigator.clipboard
        .writeText(url)
        .then(() => {
          toast({
            title: "Preset Exported",
            description: "URL copied to clipboard!",
          });
        })
        .catch(() => {
          toast({
            title: "Export Failed",
            description: "Could not copy to clipboard",
            variant: "destructive",
          });
        });

      // Fire-and-forget: upload OG preview image
      const canvas = getSnapshot?.();
      if (canvas) {
        uploadOgImage(canvas, encoded).catch(() => {
          // Silent failure — the URL is already on the clipboard
        });
      }
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
        top: 16, // Position near top with 16px margin
        width: panelWidth,
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
      if (
        controllerRef.current &&
        !controllerRef.current.contains(event.target as Node)
      ) {
        // If clicking outside the controller but on the panel, don't close
        if (
          panelRef.current &&
          panelRef.current.contains(event.target as Node)
        ) {
          return;
        }
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Menu items
  const menuItems = [
    { id: "layer1", label: "Layer 1", color: "from-pink-500 to-rose-600" },
    { id: "layer2", label: "Layer 2", color: "from-blue-500 to-indigo-600" },
    { id: "goo", label: "Effects", color: "from-emerald-500 to-teal-600" },
    { id: "audio", label: "Audio", color: "from-violet-500 to-purple-600" },
  ];

  // Animation for menu items
  const menuItemSprings = menuItems.map((_, index) =>
    useSpring({
      opacity: 1,
      transform: "translateY(0px)",
      from: { opacity: 0, transform: "translateY(20px)" },
      delay: 100 + index * 50,
      config: config.wobbly,
    }),
  );

  // Update settings with new values
  const handleUpdateSetting = (
    section: string,
    property: string,
    value: any,
  ) => {
    setSettings((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: value,
      },
    }));
  };

  // Throttle color picker to ~10 FPS to avoid choking the render pipeline
  const colorThrottleRef = useRef(0);
  const handleColorChange = useCallback(
    (section: string, value: string) => {
      const now = Date.now();
      if (now - colorThrottleRef.current < 100) return; // ~10 FPS
      colorThrottleRef.current = now;
      setSettings((prev: any) => ({
        ...prev,
        [section]: { ...prev[section], color: value },
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Reset settings to defaults with random colors
  const resetSettings = () => {
    const randomColor1 = generateRandomColor();
    const randomColor2 = generateRandomColor();

    setSettings((prev: any) => ({
      layer1: {
        spacing: 33,
        size: 19,
        rotation: 0,
        color: randomColor1,
        type: "dots",
      },
      layer2: {
        spacing: 35,
        size: 20.5,
        rotation: 0,
        color: randomColor2,
        type: "dots",
      },
      goo: {
        enabled: true,
        blur: 6,
        threshold: 41,
        prePixelate: 1,
        postPixelate: 1,
        driftFriction: 0,
      },
      touch: prev.touch,
      audio: prev.audio,
    }));

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
        right: "20px",
        top: `${panelPosition.top}px`,
      };
    } else {
      return {
        left: `${panelPosition.left + 420}px`,
        top: `${panelPosition.top}px`,
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
          ...panelSpring,
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
                      ? id === "layer1"
                        ? "bg-amber-700/70 text-amber-50"
                        : id === "layer2"
                          ? "bg-teal-800/70 text-teal-50"
                          : id === "goo"
                            ? "bg-rose-900/70 text-rose-50"
                            : "bg-purple-900/70 text-purple-50"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
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
                  {activeSection === "goo" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">
                          Enable Effects
                        </label>
                        <Switch
                          checked={settings.goo.enabled}
                          onCheckedChange={(checked) =>
                            handleUpdateSetting("goo", "enabled", checked)
                          }
                          className="data-[state=checked]:bg-rose-700"
                        />
                      </div>

                      {settings.goo.enabled && (
                        <>
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Pre-Pixelate
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings.goo.prePixelate}
                              </span>
                            </div>
                            <Slider
                              value={[settings.goo.prePixelate]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  "goo",
                                  "prePixelate",
                                  value[0],
                                )
                              }
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Blur
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings.goo.blur}
                              </span>
                            </div>
                            <Slider
                              value={[settings.goo.blur]}
                              min={1}
                              max={30}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting("goo", "blur", value[0])
                              }
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Threshold
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings.goo.threshold}
                              </span>
                            </div>
                            <Slider
                              value={[settings.goo.threshold]}
                              min={1}
                              max={255}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  "goo",
                                  "threshold",
                                  value[0],
                                )
                              }
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Post-Pixelate
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings.goo.postPixelate}
                              </span>
                            </div>
                            <Slider
                              value={[settings.goo.postPixelate]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  "goo",
                                  "postPixelate",
                                  value[0],
                                )
                              }
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">
                            Drift Friction
                          </label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                            {settings.goo.driftFriction ?? 0}
                          </span>
                        </div>
                        <Slider
                          value={[settings.goo.driftFriction ?? 0]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) =>
                            handleUpdateSetting(
                              "goo",
                              "driftFriction",
                              value[0],
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {activeSection === "touch" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">
                          Pinch to Zoom
                        </label>
                        <Switch
                          checked={settings.touch?.enablePinchZoom ?? true}
                          onCheckedChange={(checked) =>
                            handleUpdateSetting(
                              "touch",
                              "enablePinchZoom",
                              checked,
                            )
                          }
                          className="data-[state=checked]:bg-purple-700"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">
                          Pinch to Rotate
                        </label>
                        <Switch
                          checked={settings.touch?.enablePinchRotate ?? true}
                          onCheckedChange={(checked) =>
                            handleUpdateSetting(
                              "touch",
                              "enablePinchRotate",
                              checked,
                            )
                          }
                          className="data-[state=checked]:bg-purple-700"
                        />
                      </div>
                    </div>
                  )}

                  {activeSection === "audio" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-200">
                          Enable Audio
                        </label>
                        <Switch
                          checked={settings.audio?.enabled ?? false}
                          onCheckedChange={async (checked) => {
                            handleUpdateSetting("audio", "enabled", checked);
                            if (checked && initializeAudio) {
                              await initializeAudio();
                            }
                          }}
                          className="data-[state=checked]:bg-purple-700"
                        />
                      </div>

                      {settings.audio?.enabled && (
                        <>
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Master Volume
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {Math.round(
                                  (settings.audio?.masterVolume ?? 0.3) * 100,
                                )}
                                %
                              </span>
                            </div>
                            <Slider
                              value={[
                                (settings.audio?.masterVolume ?? 0.3) * 100,
                              ]}
                              min={0}
                              max={500}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  "audio",
                                  "masterVolume",
                                  value[0] / 100,
                                )
                              }
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Interaction Range
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {(
                                  settings.audio?.interactionRadius ?? 0.1
                                ).toFixed(3)}
                                x
                              </span>
                            </div>
                            <Slider
                              value={[
                                // Expo → linear: t = log(val/min) / log(max/min)
                                Math.log(
                                  (settings.audio?.interactionRadius ?? 0.1) /
                                    0.005,
                                ) /
                                  Math.log(2.0 / 0.005) *
                                  100,
                              ]}
                              min={0}
                              max={100}
                              step={0.5}
                              onValueChange={(value) => {
                                // Linear → expo: val = min * (max/min)^(t/100)
                                const t = value[0] / 100;
                                const val =
                                  0.005 * Math.pow(2.0 / 0.005, t);
                                handleUpdateSetting(
                                  "audio",
                                  "interactionRadius",
                                  Math.round(val * 10000) / 10000,
                                );
                              }}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Base Note
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {hzToNoteName(settings.audio?.frequencyRange?.min ?? 80)}
                              </span>
                            </div>
                            <Slider
                              value={[
                                hzToMidi(settings.audio?.frequencyRange?.min ?? 80),
                              ]}
                              min={24}
                              max={96}
                              step={1}
                              onValueChange={(value) => {
                                const newMin = midiToHz(value[0]);
                                const oldSemitones = 12 * Math.log2(
                                  (settings.audio?.frequencyRange?.max ?? 800) /
                                  (settings.audio?.frequencyRange?.min ?? 80)
                                );
                                handleUpdateSetting(
                                  "audio",
                                  "frequencyRange",
                                  {
                                    min: newMin,
                                    max: newMin * Math.pow(2, oldSemitones / 12),
                                  },
                                );
                              }}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Range
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {Math.round(
                                  12 * Math.log2(
                                    (settings.audio?.frequencyRange?.max ?? 800) /
                                    (settings.audio?.frequencyRange?.min ?? 80)
                                  )
                                )} st
                              </span>
                            </div>
                            <Slider
                              value={[
                                Math.round(
                                  12 * Math.log2(
                                    (settings.audio?.frequencyRange?.max ?? 800) /
                                    (settings.audio?.frequencyRange?.min ?? 80)
                                  )
                                ),
                              ]}
                              min={1}
                              max={72}
                              step={1}
                              onValueChange={(value) => {
                                const min = settings.audio?.frequencyRange?.min ?? 80;
                                handleUpdateSetting(
                                  "audio",
                                  "frequencyRange",
                                  {
                                    min,
                                    max: min * Math.pow(2, value[0] / 12),
                                  },
                                );
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="text-sm text-zinc-200">
                              Skip Voicing
                            </label>
                            <Switch
                              checked={settings.audio?.skipVoicing ?? true}
                              onCheckedChange={(checked) =>
                                handleUpdateSetting("audio", "skipVoicing", checked)
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Layer settings */}
                  {(activeSection === "layer1" ||
                    activeSection === "layer2") && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Type</label>
                          <select
                            value={settings[activeSection].type}
                            onChange={(e) =>
                              handleUpdateSetting(
                                activeSection,
                                "type",
                                e.target.value,
                              )
                            }
                            className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono"
                          >
                            <option value="dots">Dots</option>
                            <option value="lines">Lines</option>
                            <option value="squares">Concentric Squares</option>
                          </select>
                        </div>
                      </div>

                      {/* Conditional control for concentric shapes */}
                      {settings[activeSection].type === "squares" && (
                        <>
                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Number of Squares
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings[activeSection].numShapes || 3}
                              </span>
                            </div>
                            <Slider
                              value={[settings[activeSection].numShapes || 3]}
                              min={1}
                              max={30}
                              step={1}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  activeSection,
                                  "numShapes",
                                  value[0],
                                )
                              }
                            />
                          </div>

                          <div>
                            <div className="flex justify-between">
                              <label className="text-sm text-zinc-200">
                                Stroke Width
                              </label>
                              <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                                {settings[activeSection].strokeWidth || 1}px
                              </span>
                            </div>
                            <Slider
                              value={[settings[activeSection].strokeWidth || 1]}
                              min={0.5}
                              max={10}
                              step={0.5}
                              onValueChange={(value) =>
                                handleUpdateSetting(
                                  activeSection,
                                  "strokeWidth",
                                  value[0],
                                )
                              }
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">
                            Spacing
                          </label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                            {settings[activeSection].spacing}px
                          </span>
                        </div>
                        <Slider
                          value={[settings[activeSection].spacing]}
                          min={10}
                          max={200}
                          step={1}
                          onValueChange={(value) =>
                            handleUpdateSetting(
                              activeSection,
                              "spacing",
                              value[0],
                            )
                          }
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">Size</label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                            {settings[activeSection].size}px
                          </span>
                        </div>
                        <Slider
                          value={[settings[activeSection].size]}
                          min={1}
                          max={300}
                          step={0.5}
                          onValueChange={(value) =>
                            handleUpdateSetting(activeSection, "size", value[0])
                          }
                        />
                      </div>

                      <div>
                        <div className="flex justify-between">
                          <label className="text-sm text-zinc-200">
                            Rotation
                          </label>
                          <span className="text-xs bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300 font-mono">
                            {settings[activeSection].rotation}°
                          </span>
                        </div>
                        <Slider
                          value={[settings[activeSection].rotation]}
                          min={0}
                          max={360}
                          step={0.1}
                          onValueChange={(value) =>
                            handleUpdateSetting(
                              activeSection,
                              "rotation",
                              value[0],
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="text-sm text-zinc-200">Color</label>
                        <div className="relative h-12">
                          <input
                            type="color"
                            value={hslToHex(settings[activeSection].color)}
                            onChange={(e) =>
                              handleColorChange(
                                activeSection,
                                e.target.value,
                              )
                            }
                            className="w-full h-full opacity-0 cursor-pointer absolute z-10"
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundColor: settings[activeSection].color,
                            }}
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
