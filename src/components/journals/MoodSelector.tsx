import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Mood configuration with emoji faces and colors
 */
const MOODS = [
  { id: "happy", emoji: "😊", color: "bg-[#F4D35E]", face: "⋅⋅\n ͜", x: "65%", y: "35%" },
  { id: "excited", emoji: "😃", color: "bg-[#EE964B]", face: "⋅ ⋅\n ͜", x: "35%", y: "50%" },
  { id: "content", emoji: "😌", color: "bg-[#C8E7C8]", face: "˘ ˘\n ᵕ", x: "30%", y: "20%" },
  { id: "calm", emoji: "😐", color: "bg-[#A8A39D]", face: "⋅ ⋅\n o", x: "50%", y: "15%" },
  { id: "tired", emoji: "😑", color: "bg-[#9C8574]", face: "– –\n ⌇", x: "70%", y: "30%" },
  { id: "sad", emoji: "😢", color: "bg-[#6C8EAD]", face: "⋅ ⋅\n ︵", x: "15%", y: "30%" },
  { id: "worried", emoji: "😰", color: "bg-[#7FA99B]", face: "– –\n ⌢", x: "70%", y: "55%" },
  { id: "sleepy", emoji: "😴", color: "bg-[#8FB5D3]", face: "˘ ˘\n ︵", x: "20%", y: "45%" },
  { id: "anxious", emoji: "😔", color: "bg-[#C5A3D9]", face: "˘ ˘\n ︿", x: "45%", y: "65%" },
  { id: "angry", emoji: "😠", color: "bg-[#F4A5AE]", face: "ˇ ˇ\n ︿", x: "55%", y: "70%" },
];

interface MoodSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectMood: (mood: string) => void;
}

/**
 * MoodSelector Component
 * Displays a circular mood wheel for users to select their current mood
 */
export const MoodSelector = ({ open, onClose, onSelectMood }: MoodSelectorProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#E8E4DC] border-none p-0 overflow-hidden">
        <div className="relative w-full h-[80vh] flex items-center justify-center">
          {/* Central prompt text */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
            <div className="bg-[#B8D4C8] px-6 py-2 rounded-md">
              <p className="text-lg font-medium text-foreground whitespace-nowrap">
                亲，今天过的怎么样？
              </p>
            </div>
          </div>

          {/* Mood circles arranged in a circular pattern */}
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              onClick={() => onSelectMood(mood.id)}
              className={`
                absolute w-24 h-24 rounded-full ${mood.color}
                flex items-center justify-center
                hover:scale-110 transition-transform duration-200
                shadow-lg
              `}
              style={{ left: mood.x, top: mood.y, transform: `translate(-50%, -50%)` }}
            >
              <span className="text-2xl font-medium text-black/80 whitespace-pre-line text-center leading-tight">
                {mood.face}
              </span>
            </button>
          ))}

          {/* Bottom right arrow for skipping */}
          <div className="absolute bottom-12 right-12">
            <button
              onClick={onClose}
              className="text-4xl text-foreground hover:scale-110 transition-transform"
            >
              →
            </button>
          </div>

          {/* Bottom buttons */}
          <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-24">
            <button
              onClick={onClose}
              className="w-16 h-16 rounded-full border-4 border-foreground flex items-center justify-center hover:bg-accent transition-colors"
            >
              <span className="text-3xl">✕</span>
            </button>
            <button className="w-16 h-16 flex items-center justify-center hover:scale-110 transition-transform">
              <span className="text-4xl">✏️</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
