import React from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <div className="flex flex-col h-full bg-background border-r w-[240px] ">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Navigation</h2>
            </div>
            <div className="flex flex-col gap-1 p-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left font-medium"
                onClick={() => navigate("/")}
              >
                Tech Stack Database
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left font-medium"
                onClick={() => navigate("/ulp")}
              >
                ULP
              </Button>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
};

export default AppSidebar;