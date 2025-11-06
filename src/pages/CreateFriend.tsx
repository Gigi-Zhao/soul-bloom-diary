import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

      console.log('Invoking Supabase edge function analyze-character');
      const { data, error } = await supabase.functions.invoke('analyze-character', {
        body: { image: base64Image },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error((error as any).message || '分析失败');
      }

      console.log('Analysis result:', data);

      // Validate the response data
      if (!data || !data.name || !data.description || !data.tags || !data.catchphrase) {
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
