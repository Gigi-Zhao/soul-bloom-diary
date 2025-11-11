import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CacheProvider, KeepAlive } from "@/lib/cache";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CacheProvider>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/journals" element={<KeepAlive><Journals /></KeepAlive>} />
            <Route path="/you" element={<KeepAlive><You /></KeepAlive>} />
            <Route path="/friends" element={<KeepAlive><Friends /></KeepAlive>} />
            <Route path="/chat/:roleId" element={<Chat />} />
            <Route path="/create-friend" element={<CreateFriend />} />
            <Route path="/create-friend/setup" element={<RoleSetup />} />
            <Route path="/moments" element={<KeepAlive><Moments /></KeepAlive>} />
            <Route path="/profile" element={<KeepAlive><Profile /></KeepAlive>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CacheProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
