import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";

/**
 * Mood configuration with images and colors
 */
const MOODS = [
  { id: "happy", name: "开心", image: "/moods/happy.png", color: "#FFD166" },
  { id: "excited", name: "期待", image: "/moods/excited.png", color: "#EF476F" },
  { id: "content", name: "满足", image: "/moods/content.png", color: "#C8E7C8" },
  { id: "calm", name: "平静", image: "/moods/calm.png", color: "#A8A39D" },
  { id: "tired", name: "累", image: "/moods/tired.png", color: "#9C8574" },
  { id: "sad", name: "悲伤", image: "/moods/sad.png", color: "#6C8EAD" },
  { id: "worried", name: "担心", image: "/moods/worried.png", color: "#7FA99B" },
  { id: "confused", name: "迷茫", image: "/moods/confused.png", color: "#8FB5D3" },
  { id: "anxious", name: "心动", image: "/moods/anxious.png", color: "#C5A3D9" },
  { id: "angry", name: "生气", image: "/moods/angry.png", color: "#06FFA5" },
];

interface MoodSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectMood: (mood: string) => void;
}

/**
 * MoodSelector Component
 * Displays a rotating mood wheel that spins and stops when opened
 */
export const MoodSelector = ({ open, onClose, onSelectMood }: MoodSelectorProps) => {
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSpinning(true);
      const timer = setTimeout(() => {
        setIsSpinning(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 w-screen h-screen bg-gradient-to-b from-[hsl(var(--background))] to-[hsl(var(--muted))]">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Central prompt text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20 pointer-events-none">
              <div className="bg-[#B8D4C8] px-6 py-2 rounded-md shadow-lg">
                <p className="text-lg font-medium text-foreground whitespace-nowrap">
                  亲，今天过的怎么样？
                </p>
              </div>
            </div>

            {/* Rotating mood wheel */}
            <div 
              className={`relative w-[400px] h-[400px] ${isSpinning ? 'animate-spin-slow' : ''}`}
              style={{
                animation: isSpinning ? 'spin 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
              }}
            >
              {MOODS.map((mood, index) => {
                const angle = (index * 360) / MOODS.length;
                const radius = 160;
                const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
                const y = Math.sin((angle - 90) * Math.PI / 180) * radius;

                return (
                  <button
                    key={mood.id}
                    onClick={() => onSelectMood(mood.id)}
                    className="absolute w-24 h-24 flex items-center justify-center transition-transform hover:scale-110"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    }}
                  >
                    <img 
                      src={mood.image} 
                      alt={mood.name}
                      className="w-24 h-24 object-contain"
                    />
                  </button>
                );
              })}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl text-[#8B7355] hover:opacity-70 transition-opacity"
            >
              ×
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
