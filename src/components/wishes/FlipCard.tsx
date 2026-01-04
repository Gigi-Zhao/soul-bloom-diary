import { useState } from "react";
import { cn } from "@/lib/utils";

interface FlipCardProps {
  title: string;
  todoList: string[];
  className?: string;
}

export const FlipCard = ({ title, todoList, className }: FlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={cn("relative h-48 w-full cursor-pointer perspective-1000", className)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={cn(
          "relative w-full h-full transition-transform duration-500 preserve-3d",
          isFlipped && "rotate-y-180"
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 backface-hidden rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 p-6 flex items-center justify-center shadow-lg"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-lg font-medium text-[#4A4A4A] text-center leading-relaxed">
            {title}
          </p>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-white/70 backdrop-blur-md border border-white/40 p-6 shadow-lg overflow-y-auto"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#9D85BE] mb-3">待办清单</h3>
            {todoList.length > 0 ? (
              <ul className="space-y-2">
                {todoList.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-[#666]">
                    <span className="text-[#9D85BE] mt-0.5">•</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无待办事项
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        @media (prefers-reduced-motion: reduce) {
          .preserve-3d {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

