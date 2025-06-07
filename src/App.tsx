import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AllRecords from "./pages/AllRecords";
import AppSidebar from "@/components/AppSidebar";
import ULPPage from "./pages/ULPPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <AppSidebar />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/all-records" element={<AllRecords />} />
              <Route path="/ulp" element={<ULPPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;