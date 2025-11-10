import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/journals" element={<Journals />} />
          <Route path="/you" element={<You />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/chat/:roleId" element={<Chat />} />
          <Route path="/create-friend" element={<CreateFriend />} />
          <Route path="/create-friend/setup" element={<RoleSetup />} />
          <Route path="/moments" element={<Moments />} />
          <Route path="/profile" element={<Profile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
