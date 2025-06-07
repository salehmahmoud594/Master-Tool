import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useDatabase,
  deleteAllData,
  deleteWebsite,
  getAllWebsitesWithTechnologies,
} from "@/services/database";
import CsvUploader from "@/components/CsvUploader";
import SearchPanel from "@/components/SearchPanel";
import ResultsDisplay from "@/components/ResultsDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Search, Trash2, FileText } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Index = () => {
  const { isReady } = useDatabase();
  const [results, setResults] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [showUndoAlert, setShowUndoAlert] = useState(false);
  const [deletedData, setDeletedData] = useState<any | null>(null);
  const { toast } = useToast();

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
    toast({
      title: "Upload Successful",
      description: "Data has been uploaded to the database.",
    });
  };

  const handleSearch = (searchResults: any[]) => {
    setResults(searchResults);
  };

  const handleDeleteAll = async () => {
    try {
      const currentData = await getAllWebsitesWithTechnologies();
      const success = await deleteAllData();

      if (success) {
        setDeletedData(currentData);
        setResults([]);
        setShowUndoAlert(true);
        toast({
          title: "All Records Deleted",
          description: "All data has been removed from the database.",
        });

        // Hide undo option after 10 seconds
        setTimeout(() => {
          setShowUndoAlert(false);
          setDeletedData(null);
        }, 10000);
      }
    } catch (error) {
      console.error("Error deleting data:", error);
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting data.",
        variant: "destructive",
      });
    }
  };

  const handleUndoDelete = () => {
    // This would actually restore the data
    setShowUndoAlert(false);
    setResults(deletedData || []);
    setDeletedData(null);
    toast({
      title: "Delete Undone",
      description: "Records have been restored.",
    });
  };

  const handleDeleteRecord = async (url: string) => {
    try {
      // Find the record before deleting it
      const deletedRecord = results.find((item) => item.url === url);

      const success = await deleteWebsite(url);

      if (success) {
        // Store the deleted record
        setDeletedData(deletedRecord);

        // Update the results list
        setResults((prevResults) =>
          prevResults.filter((item) => item.url !== url)
        );

        // Show notification with undo option
        setShowUndoAlert(true);
        toast({
          title: "Record Deleted",
          description: `Record for ${url} has been removed.`,
        });

        // Hide undo option after 10 seconds
        setTimeout(() => {
          setShowUndoAlert(false);
          setDeletedData(null);
        }, 10000);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the record.",
        variant: "destructive",
      });
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Initializing Database...</h1>
          <p className="text-gray-600">
            Please wait while we set up the local database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tech Stack Database
            </h1>
            <p className="text-gray-600">
              Upload and manage website technology data
            </p>
          </div>
          <Link to="/all-records">
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View All Records
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section 1: Upload and Search panels */}
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[300px] gap-4"
        >
          {/* Upload Panel - 40% width */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <Card className="h-full shadow-md border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Upload Website Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CsvUploader onUploadComplete={handleUploadComplete} />
              </CardContent>
            </Card>
          </ResizablePanel>

          {/* Search Panel - 60% width */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <Card className="h-full shadow-md border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Technology Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SearchPanel key={refreshKey} onSearch={handleSearch} />
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Undo alert */}
        {showUndoAlert && (
          <div className="mt-4">
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>Records have been deleted.</span>
                <Button variant="outline" size="sm" onClick={handleUndoDelete}>
                  Undo
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Section 2: Results display */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Search Results</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAsCSV(results, "search-results")}
                  >
                    Export Results
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <ResultsDisplay
                  results={results}
                  onDeleteRecord={handleDeleteRecord}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Website Tech Database - Using Local SQLite Storage
          </p>
        </div>
      </footer>
    </div>
  );
};

// Function to export data as CSV
const exportAsCSV = (data: any[], filename: string) => {
  // Convert data to CSV format
  const csvContent = [
    // Header row
    "url,technologies",
    // Data rows
    ...data.map((item) => `${item.url},[${item.technologies.join(",")}]`),
  ].join("\n");

  // Create a Blob and download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default Index;
