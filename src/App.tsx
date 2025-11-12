import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import Journals from "./pages/Journals";
import You from "./pages/You";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import CreateFriend from "./pages/CreateFriend";
import RoleSetup from "./pages/RoleSetup";
import Moments from "./pages/Moments";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// 需要缓存的页面组件
const CachedPages = () => {
  const location = useLocation();
  const path = location.pathname;

  // 定义需要缓存的页面路径
  const cachedRoutes = [
    { path: '/journals', component: <Journals /> },
    { path: '/you', component: <You /> },
    { path: '/friends', component: <Friends /> },
    { path: '/moments', component: <Moments /> },
    { path: '/profile', component: <Profile /> },
  ];

  // 检查当前路径是否是缓存路由
  const isCachedRoute = cachedRoutes.some(route => path === route.path);

  if (!isCachedRoute) {
    // 如果不是缓存路由，使用正常的 Routes
    return (
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/chat/:roleId" element={<Chat />} />
        <Route path="/create-friend" element={<CreateFriend />} />
        <Route path="/create-friend/setup" element={<RoleSetup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // 渲染所有缓存的页面，通过 display 控制显示
  return (
    <>
      {cachedRoutes.map((route) => (
        <div
          key={route.path}
          style={{
            display: path === route.path ? 'block' : 'none',
            height: '100%',
            width: '100%',
          }}
        >
          {route.component}
        </div>
      ))}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CachedPages />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
