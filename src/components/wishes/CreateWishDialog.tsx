import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CreateWishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateWishDialog = ({ open, onOpenChange, onSuccess }: CreateWishDialogProps) => {
  const [wishTitle, setWishTitle] = useState("");
  const [isSplitting, setIsSplitting] = useState(false);
  const [todoList, setTodoList] = useState<string[]>([]);

  const handleSplit = async () => {
    if (!wishTitle.trim()) return;

    setIsSplitting(true);
    console.log('[CreateWish] ========== 开始分裂心愿 ==========');
    console.log('[CreateWish] 心愿内容:', wishTitle);
    
    try {
      // 本地开发时，如果 Vercel dev 运行在 3000 端口，优先使用它
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ?? '';
      
      // 本地开发时，尝试使用 localhost:3000（如果运行了 vercel dev）
      const primaryEndpoint = isLocalhost && !apiBase
        ? 'http://localhost:3000/api/split-wish'
        : (apiBase 
          ? `${apiBase.replace(/\/$/, '')}/api/split-wish` 
          : '/api/split-wish');
      const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/split-wish';

      console.log('[CreateWish] API端点配置:', {
        apiBase,
        primaryEndpoint,
        fallbackEndpoint,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      });

      const makeRequest = async (url: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        try {
          console.log(`[CreateWish] 📡 请求URL: ${url}`);
          const requestBody = { wish: wishTitle };
          console.log('[CreateWish] 请求体:', requestBody);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
            cache: 'no-store',
          });
          
          clearTimeout(timeoutId);
          
          console.log(`[CreateWish] 📊 响应状态:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          return response;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      // Start request
      let response: Response;
      try {
        response = await makeRequest(primaryEndpoint);
        if (response.status === 404 && primaryEndpoint !== fallbackEndpoint) {
          console.log('[CreateWish] ⚠️ 主端点返回404，尝试备用端点...');
          response = await makeRequest(fallbackEndpoint);
        }
      } catch (error) {
        // 如果主端点网络错误，尝试备用端点
        if (primaryEndpoint !== fallbackEndpoint) {
          console.log('[CreateWish] ⚠️ 主端点网络错误，尝试备用端点...');
          response = await makeRequest(fallbackEndpoint);
        } else {
          throw error;
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '无法读取错误信息');
        console.error(`[CreateWish] ❌ API返回错误 (${response.status}):`, errorText);
        throw new Error(`API返回错误: ${response.status} - ${errorText}`);
      }

      const responseText = await response.clone().text();
      console.log('[CreateWish] 📄 响应原文:', responseText);
      
      const data = await response.json();
      console.log('[CreateWish] 📦 解析后的数据:', data);
      console.log('[CreateWish] 📋 todoList:', data.todoList);
      
      if (data.todoList && Array.isArray(data.todoList) && data.todoList.length > 0) {
        console.log('[CreateWish] ✅ 成功获取待办清单，数量:', data.todoList.length);
        setTodoList(data.todoList);
      } else {
        console.warn('[CreateWish] ⚠️ 待办清单为空或格式不正确，使用默认值');
        setTodoList([
          "明确目标和期望",
          "制定实施计划",
          "开始第一步行动",
          "持续跟踪进度"
        ]);
      }
    } catch (error) {
      console.error('[CreateWish] ❌ 分裂心愿时出错:', error);
      console.error('[CreateWish] 错误详情:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // 如果 AI 拆解失败，使用默认的简单拆解
      console.log('[CreateWish] 🔄 使用默认待办清单');
      setTodoList([
        "明确目标和期望",
        "制定实施计划",
        "开始第一步行动",
        "持续跟踪进度"
      ]);
    } finally {
      setIsSplitting(false);
      console.log('[CreateWish] ========== 分裂心愿完成 ==========');
    }
  };

  const handleSave = async () => {
    if (!wishTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase as any)
        .from('wishes')
        .insert({
          user_id: user.id,
          title: wishTitle.trim(),
          todo_list: todoList,
        });

      if (error) throw error;

      // Reset form
      setWishTitle("");
      setTodoList([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving wish:', error);
    }
  };

  const handleClose = () => {
    setWishTitle("");
    setTodoList([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#4A4A4A]">
            创建心愿
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-[#666] mb-2 block">
              你的心愿是什么？
            </label>
            <Input
              value={wishTitle}
              onChange={(e) => setWishTitle(e.target.value)}
              placeholder="例如：做一张专辑"
              className="bg-white/80 border-white/40"
              disabled={isSplitting}
            />
          </div>

          {todoList.length > 0 && (
            <div className="bg-white/60 rounded-lg p-4 border border-white/40">
              <h4 className="text-sm font-semibold text-[#9D85BE] mb-2">待办清单</h4>
              <ul className="space-y-2">
                {todoList.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-[#666]">
                    <span className="text-[#9D85BE] mt-0.5">•</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSplit}
              disabled={!wishTitle.trim() || isSplitting}
              className="flex-1 bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8]"
            >
              {isSplitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  拆解中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  分裂
                </>
              )}
            </Button>
            {todoList.length > 0 && (
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-primary to-accent"
              >
                保存
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

