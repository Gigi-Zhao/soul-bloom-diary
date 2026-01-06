import { useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WeeklyLetter {
  id: string;
  week_start_date: string;
  week_end_date: string;
  content: string;
  created_at: string;
}

interface WeeklyLettersProps {
  letters: WeeklyLetter[];
}

export const WeeklyLetters = ({ letters }: WeeklyLettersProps) => {
  const [selectedLetter, setSelectedLetter] = useState<WeeklyLetter | null>(null);

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = `${start.getMonth() + 1}月${start.getDate()}日`;
    const endStr = `${end.getMonth() + 1}月${end.getDate()}日`;
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      {/* Glass Box Container */}
      <div className="relative w-full max-w-2xl">
        <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
          <h2 className="text-2xl font-semibold text-[#4A4A4A] mb-6 text-center">
            时光信箱
          </h2>
          
          {/* Letters Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {letters.map((letter, index) => (
              <motion.div
                key={letter.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedLetter(letter)}
                className="cursor-pointer group"
              >
                <div className="bg-gradient-to-br from-[#F3E8FF] to-[#E9D5FF] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-white/60">
                  <div className="text-center">
                    <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                      💌
                    </div>
                    <div className="text-xs text-[#666] font-medium">
                      {formatDateRange(letter.week_start_date, letter.week_end_date)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {letters.length === 0 && (
            <div className="text-center py-12 text-[#999]">
              <div className="text-6xl mb-4">✉️</div>
              <p>还没有收到信件哦</p>
              <p className="text-sm mt-2">每周日晚上会收到一封新的总结信件</p>
            </div>
          )}
        </div>
      </div>

      {/* Letter Detail Modal */}
      <AnimatePresence>
        {selectedLetter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedLetter(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotateX: -15 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateX: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Letter Paper */}
              <div className="bg-gradient-to-br from-[#FFFBF0] to-[#FFF8E7] rounded-2xl shadow-2xl border-2 border-[#E8DCC8] overflow-hidden">
                {/* Close Button */}
                <button
                  onClick={() => setSelectedLetter(null)}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors shadow-lg"
                >
                  <X className="w-5 h-5 text-[#666]" />
                </button>

                {/* Letter Content */}
                <div className="p-8 md:p-12 overflow-y-auto max-h-[70vh] custom-scrollbar">
                  {/* Letter Header */}
                  <div className="text-center mb-8 pb-6 border-b-2 border-[#E8DCC8]/50">
                    <div className="text-4xl mb-3">💌</div>
                    <h3 className="text-xl font-semibold text-[#4A4A4A] mb-2">
                      本周总结
                    </h3>
                    <p className="text-sm text-[#999]">
                      {formatDateRange(selectedLetter.week_start_date, selectedLetter.week_end_date)}
                    </p>
                  </div>

                  {/* Letter Body */}
                  <div className="space-y-4 text-[#4A4A4A] leading-relaxed">
                    {selectedLetter.content.split('\n').map((paragraph, idx) => (
                      paragraph.trim() && (
                        <motion.p
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="text-base indent-8"
                        >
                          {paragraph}
                        </motion.p>
                      )
                    ))}
                  </div>

                  {/* Letter Footer */}
                  <div className="mt-8 pt-6 border-t-2 border-[#E8DCC8]/50 text-right">
                    <p className="text-sm text-[#999]">
                      {new Date(selectedLetter.created_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-sm text-[#9D85BE] font-medium mt-2">
                      你的心灵伙伴
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(157, 133, 190, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(157, 133, 190, 0.5);
        }
      `}</style>
    </div>
  );
};
