import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * CreateFriend Page
 * Upload image to create AI companion with AI-generated character details
 */
const CreateFriend = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "错误",
        description: "请选择图片文件",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAndAnalyze = async () => {
    if (!imageFile || !imagePreview) {
      toast({
        title: "错误",
        description: "请先选择图片",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Extract base64 data and MIME type from data URL
      // imagePreview format: "data:image/jpeg;base64,/9j/4AAQ..."
      let base64Image: string;
      let mimeType = 'image/jpeg'; // default
      
      if (imagePreview.includes(',')) {
        const [header, data] = imagePreview.split(',');
        base64Image = data;
        // Extract MIME type from header: "data:image/jpeg;base64"
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      } else {
        base64Image = imagePreview;
      }

      // Prefer env-based base URL for local dev; use relative path in production
      const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ?? '';
      const primaryEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/analyze-character` : '/api/analyze-character';
      const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/analyze-character';

      console.log('Starting image analysis...');
      console.log('Primary endpoint:', primaryEndpoint);
      console.log('Image size:', base64Image.length, 'characters');

      // Try primary endpoint first with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout after 60 seconds');
        controller.abort();
      }, 60000); // 60 second timeout

      try {
        let response = await fetch(primaryEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: `data:${mimeType};base64,${base64Image}`,
          }),
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If 404, retry with fallback absolute vercel URL
        if (response.status === 404 && primaryEndpoint !== fallbackEndpoint) {
          console.log('Primary endpoint 404, trying fallback...');
          response = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: `data:${mimeType};base64,${base64Image}`,
            }),
            cache: 'no-store',
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorText = errorData.error || response.statusText;
          console.error('API error response:', errorData);
          throw new Error(`分析失败: ${errorText}`);
        }

        const data = await response.json();
        console.log('Analysis result:', data);

        // Validate the response data
        if (!data.name || !data.description || !data.tags || !data.catchphrase) {
          console.error('Incomplete data received:', data);
          throw new Error('服务器返回的数据不完整');
        }
        
        // Navigate to role setup page with the analyzed data
        navigate('/create-friend/setup', {
          state: {
            avatarUrl: imagePreview,
            name: data.name,
            description: data.description,
            tags: data.tags,
            catchphrase: data.catchphrase,
          },
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('请求超时，请重试');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "无法分析图片，请重试",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSkipToManual = () => {
    navigate('/create-friend/setup', {
      state: {
        avatarUrl: imagePreview,
      },
    });
  };

  return (
    <div className="min-h-screen pb-8 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/friends')}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">创建 AI 朋友</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Image upload area */}
        <div className="flex flex-col items-center space-y-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            {imagePreview ? (
              <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-primary/20 hover:border-primary/40 transition-all">
                <img
                  src={imagePreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-48 h-48 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/40 transition-all">
                <Upload className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">点击选择头像</p>
          </label>

          <p className="text-center text-sm text-muted-foreground px-4">
            上传头像后，自能可以根据图片智能生成角色信息，<br />
            或者你也可以完全自定义创建
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {imagePreview && (
            <>
              <Button
                onClick={handleUploadAndAnalyze}
                disabled={uploading}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
              >
                {uploading ? "分析中..." : "智能生成角色信息"}
              </Button>
              <Button
                onClick={handleSkipToManual}
                variant="outline"
                className="w-full py-6"
              >
                跳过，手动创建
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateFriend;
