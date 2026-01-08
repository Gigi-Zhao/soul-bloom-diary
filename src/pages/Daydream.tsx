import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// 消息角色类型
type MessageRole = 'narrator' | 'npc' | 'user';

// 消息结构
interface DreamMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// 用户设定
interface DreamSetup {
  identity: string;      // 身份
  dailyLife: string;     // 日常
  person: string;        // 想遇到的人
  tone: string;          // 基调
}

// AI返回的JSON结构
interface AIResponse {
  narrator?: string;       // 旁白文本
  npc_say?: string;        // NPC对话
  options: string[];       // 3个建议选项
  chapter_end?: boolean;   // 是否进入下一章
  current_chapter?: number; // 当前章节号
}

// 状态类型
type DreamStatus = 'idle' | 'loading' | 'typing';

// 章节配置
const CHAPTERS = [
  { id: 1, name: "日常" },
  { id: 2, name: "转机" },
  { id: 3, name: "发展" },
  { id: 4, name: "高潮" },
  { id: 5, name: "结局" }
];

const Daydream = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // 状态管理
  const [phase, setPhase] = useState<'setup' | 'story'>('setup');
  const [setup, setSetup] = useState<DreamSetup>({
    identity: '',
    dailyLife: '',
    person: '',
    tone: ''
  });
  const [messages, setMessages] = useState<DreamMessage[]>([]);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [chapterProgress, setChapterProgress] = useState(1);
  const [status, setStatus] = useState<DreamStatus>('idle');
  const [userInput, setUserInput] = useState('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 打字机效果状态
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingQueueRef = useRef<DreamMessage[]>([]);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText]);
  
  // 打字机效果
  const typeMessage = async (message: DreamMessage) => {
    return new Promise<void>((resolve) => {
      setIsTyping(true);
      setTypingText('');
      
      let currentIndex = 0;
      const text = message.content;
      const speed = 30; // 打字速度（毫秒）
      
      const timer = setInterval(() => {
        if (currentIndex < text.length) {
          setTypingText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(timer);
          setIsTyping(false);
          setTypingText('');
          setMessages(prev => [...prev, message]);
          resolve();
        }
      }, speed);
      
      typingTimeoutRef.current = timer;
    });
  };
  
  // 处理打字队列
  useEffect(() => {
    if (typingQueueRef.current.length > 0 && !isTyping && status !== 'loading') {
      const nextMessage = typingQueueRef.current.shift();
      if (nextMessage) {
        setStatus('typing');
        typeMessage(nextMessage).then(() => {
          if (typingQueueRef.current.length === 0) {
            setStatus('idle');
          }
        });
      }
    }
  }, [isTyping, status]);
  
  // 添加消息到打字队列
  const addMessageWithTyping = (message: DreamMessage) => {
    typingQueueRef.current.push(message);
  };
  
  // 调用AI API
  const callDaydreamAPI = async (isInitial: boolean = false) => {
    setStatus('loading');
    setCurrentOptions([]);
    
    // 创建AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/daydream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setup: setup,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          currentChapter: chapterProgress,
          isInitial: isInitial
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error('API请求失败');
      }
      
      const data: AIResponse = await response.json();
      
      // 处理旁白
      if (data.narrator) {
        addMessageWithTyping({
          id: `narrator-${Date.now()}`,
          role: 'narrator',
          content: data.narrator,
          timestamp: Date.now()
        });
      }
      
      // 处理NPC对话
      if (data.npc_say) {
        addMessageWithTyping({
          id: `npc-${Date.now()}`,
          role: 'npc',
          content: data.npc_say,
          timestamp: Date.now()
        });
      }
      
      // 等待打字完成后再显示选项
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 设置选项
      setCurrentOptions(data.options || []);
      
      // 检查是否进入下一章
      if (data.chapter_end && chapterProgress < CHAPTERS.length) {
        setChapterProgress(prev => prev + 1);
      }
      
      if (data.current_chapter) {
        setChapterProgress(data.current_chapter);
      }
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('请求被取消');
      } else {
        console.error('API调用失败:', error);
        toast({
          title: "出错了",
          description: "无法生成故事内容，请重试",
          variant: "destructive"
        });
        setStatus('idle');
      }
    }
  };
  
  // 开始白日梦
  const handleStartDream = () => {
    if (!setup.identity || !setup.dailyLife || !setup.person || !setup.tone) {
      toast({
        title: "请填写完整",
        description: "请填写所有必填项后再开始",
        variant: "destructive"
      });
      return;
    }
    
    setPhase('story');
    setChapterProgress(1);
    callDaydreamAPI(true);
  };
  
  // 处理用户选择/输入
  const handleUserChoice = (choice: string) => {
    if (status !== 'idle') return;
    
    // 添加用户消息
    const userMessage: DreamMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: choice,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    
    // 调用API
    callDaydreamAPI(false);
  };
  
  // 处理发送按钮
  const handleSend = () => {
    if (userInput.trim() && status === 'idle') {
      handleUserChoice(userInput.trim());
    }
  };
  
  // 清理函数
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearInterval(typingTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // 渲染设置页面
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50 relative overflow-hidden">
        {/* 动态背景效果 */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-40 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-5 py-8 max-w-2xl">
          <div className="flex items-center mb-8 mt-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-[#4A4A4A] hover:bg-white/50"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
            <h1 className="text-3xl font-semibold text-center mb-8 text-[#4A4A4A] animate-fade-in">
              我想做一场白日梦...
            </h1>
            
            <div className="space-y-6 animate-fade-in-up">
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我现在的身份是</label>
                <Input
                  placeholder="例如：一名普通的银行职员"
                  value={setup.identity}
                  onChange={(e) => setSetup(prev => ({ ...prev, identity: e.target.value }))}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我的平淡日常是</label>
                <Input
                  placeholder="例如：每天对着电脑处理枯燥的报表"
                  value={setup.dailyLife}
                  onChange={(e) => setSetup(prev => ({ ...prev, dailyLife: e.target.value }))}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我想遇到的人是</label>
                <Input
                  placeholder="例如：一位神秘的陌生人"
                  value={setup.person}
                  onChange={(e) => setSetup(prev => ({ ...prev, person: e.target.value }))}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">故事的基调是</label>
                <Input
                  placeholder="例如：温暖治愈 / 悬疑刺激 / 浪漫甜蜜"
                  value={setup.tone}
                  onChange={(e) => setSetup(prev => ({ ...prev, tone: e.target.value }))}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
            </div>
            
            <div className="flex justify-center mt-8">
              <Button
                size="lg"
                onClick={handleStartDream}
                className="bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8] text-white px-8 py-6 text-lg rounded-full shadow-lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                开始做梦
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // 渲染故事页面
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50 flex flex-col">
      {/* 顶部进度条 */}
      <div className="sticky top-0 z-10 bg-white/50 backdrop-blur-md px-5 py-4 border-b border-white/50">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-[#4A4A4A] hover:bg-white/50 mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 flex items-center gap-1">
              {CHAPTERS.map((chapter, index) => (
                <div key={chapter.id} className="flex-1 flex items-center gap-1">
                  <div className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full h-2 rounded-full transition-all ${
                        index + 1 <= chapterProgress
                          ? 'bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9]'
                          : 'bg-white/60'
                      }`}
                    />
                    <span
                      className={`text-xs mt-1 transition-colors ${
                        index + 1 === chapterProgress
                          ? 'text-[#4A4A4A] font-semibold'
                          : index + 1 < chapterProgress
                          ? 'text-[#666]'
                          : 'text-[#999]'
                      }`}
                    >
                      {chapter.name}
                    </span>
                  </div>
                  {index < CHAPTERS.length - 1 && (
                    <div className="w-1 h-1 rounded-full bg-[#ddd]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in-up">
              {message.role === 'narrator' && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                  <p className="text-[#666] text-base leading-relaxed italic">
                    {message.content}
                  </p>
                </div>
              )}
              
              {message.role === 'npc' && (
                <div className="bg-gradient-to-br from-[#F3E8FF]/60 to-[#E9D5FF]/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/60 shadow-sm">
                  <p className="text-[#4A4A4A] text-base leading-relaxed">
                    {message.content}
                  </p>
                </div>
              )}
              
              {message.role === 'user' && (
                <div className="flex justify-end">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 max-w-md border border-white/80 shadow-sm">
                    <p className="text-[#4A4A4A]">
                      {message.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* 正在打字的消息 */}
          {isTyping && typingText && (
            <div className="animate-fade-in-up">
              {typingQueueRef.current[0]?.role === 'narrator' && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                  <p className="text-[#666] text-base leading-relaxed italic">
                    {typingText}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
              )}
              
              {typingQueueRef.current[0]?.role === 'npc' && (
                <div className="bg-gradient-to-br from-[#F3E8FF]/60 to-[#E9D5FF]/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/60 shadow-sm">
                  <p className="text-[#4A4A4A] text-base leading-relaxed">
                    {typingText}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Loading状态 */}
          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/80 shadow-sm">
                <p className="text-[#666] text-sm flex items-center gap-2">
                  <span className="animate-spin">✨</span>
                  正在构思情节...
                </p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 底部输入区域 */}
      <div className="sticky bottom-0 bg-white/60 backdrop-blur-md border-t border-white/50 px-5 py-4">
        <div className="container mx-auto max-w-3xl">
          {/* 智能选项 */}
          {currentOptions.length > 0 && status === 'idle' && (
            <div className="mb-3 space-y-2">
              {currentOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleUserChoice(option)}
                  className="w-full text-left bg-white/70 hover:bg-white/90 border border-white/80 rounded-2xl px-4 py-3 text-[#4A4A4A] transition-all hover:scale-[1.01] shadow-sm"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          
          {/* 输入框 */}
          <div className="flex gap-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={status === 'idle' ? "输入你的选择..." : "请等待..."}
              disabled={status !== 'idle'}
              className="bg-white/70 border-white/80 text-[#4A4A4A] placeholder:text-[#999] disabled:opacity-50 rounded-full"
            />
            <Button
              onClick={handleSend}
              disabled={status !== 'idle' || !userInput.trim()}
              className="bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8] disabled:opacity-50 rounded-full px-6"
            >
              发送
            </Button>
          </div>
        </div>
      </div>
      
      {/* CSS动画 */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Daydream;
